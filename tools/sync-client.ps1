<#
.SYNOPSIS
  Copy the shared AI Studio core (pages, scripts, styles) into a client studio folder,
  or (-Check) report which client studios are behind the core.

.DESCRIPTION
  The core lives in bizconnect-ai-studio\docs. Each client studio (one business) lives in
  ..\ai-studio-clients\<client-folder>\ with its own git repo and its own brand folder:
      <client>\docs\brands\<BrandId>\brand.js, brand.css, img\
  Sync overwrites the client's copy of the core files (the pages, brand.js loader and the WHOLE
  docs\assets folder, so never keep client-only files in docs\assets) and points the loader at
  <BrandId>. It never touches the client's brand folder, CNAME, README or AGENTS.md.
  It stops if a core-owned file in the client was edited by hand since the last sync (use -Force to overwrite).
  Run it whenever the core changes, check the client in a browser, then commit + push the client repo.

  The core is a STARTING POINT, not a cage: a client may customise any core file. List the files it has
  taken over (paths relative to docs\, one per line, # for comments) in <client>\CLIENT_OWNED.txt, e.g.
      assets/app.css      # salon-specific layout tweaks
  Sync then never overwrites, deletes or hash-checks those files, so the client keeps its version while
  still receiving every other core improvement. Remove a line to hand the file back to the core.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\tools\sync-client.ps1 -Client ..\ai-studio-clients\rootbloom-ai-studio -BrandId rootbloom
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\tools\sync-client.ps1 -Check
#>
param(
  [string]$Client,
  [ValidatePattern('^[a-z0-9_-]{1,40}$')][string]$BrandId,
  [switch]$Check,
  [switch]$Force
)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$core = Join-Path $repo 'docs'
$utf8 = New-Object Text.UTF8Encoding $false

function CoreRev {
  try { $r = (& git -C $repo rev-parse --short HEAD 2>$null); if ($LASTEXITCODE -eq 0 -and $r) { return "$r".Trim() } } catch {}
  return 'unknown'
}
function CoreDirty {
  try { $s = (& git -C $repo status --porcelain -- docs 2>$null); return [bool]$s } catch { return $false }
}
function Hash($path) {   # text: line endings normalised (a CRLF vs LF checkout is not a hand edit); media: raw bytes
  $sha = [Security.Cryptography.SHA256]::Create()
  if ($path -match '\.(js|css|html|txt|md|json)$') { $bytes = [Text.Encoding]::UTF8.GetBytes(([IO.File]::ReadAllText($path) -replace "`r`n", "`n")) }
  else { $bytes = [IO.File]::ReadAllBytes($path) }
  (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('X2') }) -join '').Substring(0, 16)
}
function OwnedFiles($clientRoot) {   # core files this client has taken over (CLIENT_OWNED.txt)
  $f = Join-Path $clientRoot 'CLIENT_OWNED.txt'
  if (-not (Test-Path $f)) { return @() }
  @(Get-Content $f -Encoding UTF8 | ForEach-Object {
      $x = (($_ -replace '#.*$', '').Trim()).Replace('/', '\')
      do { $y = $x; $x = $x -replace '^(\.\\|\\|docs\\)', '' } while ($x -ne $y)   # accept ./x, /x, docs/x
      $x } | Where-Object { $_ })
}
function ManifestRows($clientDocs) {   # "hash path" per core file; "@hash path" = core's hash of a client-owned file
  $m = Join-Path $clientDocs 'CORE_FILES.txt'
  if (-not (Test-Path $m)) { return @() }
  @(Get-Content $m -Encoding UTF8 | Where-Object { $_ } | ForEach-Object { $h, $rel = $_ -split ' ', 2; [pscustomobject]@{ Hash = $h.TrimStart('@'); Owned = $h.StartsWith('@'); Rel = $rel } })
}
function CoreFiles {   # the files sync owns, relative to docs\ (everything except brands\)
  Get-ChildItem $core -Recurse -File | Where-Object { $_.FullName -notlike (Join-Path $core 'brands\*') } |
    ForEach-Object { $_.FullName.Substring($core.Length + 1) }
}

# ---------- -Check: list every client and whether it matches the current core ----------
if ($Check) {
  $rev = CoreRev
  $clients = Join-Path $repo '..\ai-studio-clients'
  Write-Host "Core is at $rev$(if (CoreDirty) { ' (with UNCOMMITTED changes in docs)' })"
  foreach ($d in Get-ChildItem $clients -Directory) {
    $v = Join-Path $d.FullName 'docs\CORE_VERSION.txt'
    if (-not (Test-Path $v)) { Write-Host ("  {0,-28} NOT SYNCED" -f $d.Name); continue }
    $line = (Get-Content $v -TotalCount 1 -Encoding UTF8)
    $state = if ($line -match "core $([regex]::Escape($rev)) ") { 'OK' } else { 'STALE (re-sync it)' }
    $own = OwnedFiles $d.FullName
    $rows = ManifestRows (Join-Path $d.FullName 'docs')
    $own2 = foreach ($o in $own) {   # flag owned files whose core version has moved on since the client took them over
      $r = $rows | Where-Object { $_.Rel -eq $o -and $_.Owned }; $cf = Join-Path $core $o
      if ($r -and (Test-Path $cf) -and (Hash $cf) -ne $r.Hash) { "$o (core has changed since; compare)" } else { $o } }
    $note = if ($own.Count) { "   customised: $($own2 -join ', ')" } else { '' }
    Write-Host ("  {0,-28} {1}   [{2}]{3}" -f $d.Name, $state, $line, $note)
  }
  return
}

if (-not $Client -or -not $BrandId) { throw 'Give -Client <folder> -BrandId <id>, or -Check.' }
$Client = (Resolve-Path $Client).Path   # .NET file calls ignore the PowerShell location
$clientDocs = Join-Path $Client 'docs'
$brandDir = Join-Path $clientDocs "brands\$BrandId"
if (-not (Test-Path (Join-Path $brandDir 'brand.js'))) { throw "Missing $brandDir\brand.js - create the brand folder first (copy tools\brand-template)." }
if (CoreDirty) { Write-Warning 'The core has uncommitted changes in docs\. Commit the core first so CORE_VERSION.txt names a real commit.' }
$owned = OwnedFiles $Client
$coreList = @(CoreFiles)
foreach ($o in $owned) {
  if ($o -match '(^|\\)\.\.(\\|$)' -or [IO.Path]::IsPathRooted($o)) { throw "CLIENT_OWNED.txt: '$o' points outside docs\. List paths like assets/app.css." }
  if ($o -eq 'brand.js') { throw 'brand.js (the loader) cannot be client-owned; customise docs\brands\<id>\ instead.' }
  if ($o -like 'brands\*') { throw "CLIENT_OWNED.txt: '$o' is in brands\ (always the client's own); remove the line." }
  if (Test-Path (Join-Path $core $o) -PathType Container) { throw "CLIENT_OWNED.txt: '$o' is a folder; list individual files." }
  if ($coreList -notcontains $o) { Write-Warning "CLIENT_OWNED.txt: '$o' is not a core file (typo?). Ignoring it." }
}
$owned = @($owned | Where-Object { $coreList -contains $_ })
if ($owned.Count) { Write-Host "Keeping the client's own version of: $($owned -join ', ')" }

# ---------- refuse to overwrite hand edits (unless -Force) ----------
$manifest = Join-Path $clientDocs 'CORE_FILES.txt'
if ((Test-Path $manifest) -and -not $Force) {
  # (a file that was owned and is now handed back counts too: its recorded hash is the core's, so an edited copy differs)
  $edited = foreach ($r in ManifestRows $clientDocs) {
    $p = Join-Path $clientDocs $r.Rel
    if (($owned -notcontains $r.Rel) -and (Test-Path $p) -and (Hash $p) -ne $r.Hash) { $r.Rel }
  }
  if ($edited) { throw "These core files were edited by hand in the client since the last sync:`n  $($edited -join "`n  ")`nKeep the edit: add the path to $Client\CLIENT_OWNED.txt. Share it with every studio: move it into the core. Discard it: re-run with -Force." }
}

# ---------- copy ----------
$keep = @{}                                                       # client-owned files: hold them while assets\ is rebuilt
foreach ($rel in $owned) {
  $p = Join-Path $clientDocs $rel
  if (Test-Path $p -PathType Leaf) { $keep[$rel] = [IO.File]::ReadAllBytes($p) }
  else { Write-Warning "Owned file $rel is missing in the client; restoring the core's version so the studio still works."; $keep[$rel] = [IO.File]::ReadAllBytes((Join-Path $core $rel)) }
}
$assets = Join-Path $clientDocs 'assets'
if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }   # stale core files must not linger
foreach ($rel in CoreFiles) {
  if ($rel -eq 'brand.js' -or $owned -contains $rel) { continue } # loader written below; client-owned files restored below
  $dest = Join-Path $clientDocs $rel
  New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
  Copy-Item (Join-Path $core $rel) $dest -Force
}
foreach ($rel in $keep.Keys) { $dest = Join-Path $clientDocs $rel; New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null; [IO.File]::WriteAllBytes($dest, $keep[$rel]) }
$loader = [IO.File]::ReadAllText((Join-Path $core 'brand.js'))
$new = $loader -replace 'var DEFAULT_BRAND = "[^"]*";', "var DEFAULT_BRAND = `"$BrandId`";"
if ($new -eq $loader -and $BrandId -ne 'bizconnect') { throw 'Could not set DEFAULT_BRAND in docs\brand.js (the line changed?).' }
[IO.File]::WriteAllText((Join-Path $clientDocs 'brand.js'), $new, $utf8)
New-Item -ItemType File -Force (Join-Path $clientDocs '.nojekyll') | Out-Null   # GitHub Pages: serve files as-is

# ---------- stamp + manifest ----------
$rev = CoreRev
[IO.File]::WriteAllText((Join-Path $clientDocs 'CORE_VERSION.txt'), "Synced from bizconnect-ai-studio core $rev on $(Get-Date -Format 'yyyy-MM-dd HH:mm')`n", $utf8)
$rows = foreach ($rel in (CoreFiles) + @('brand.js')) {
  if ($owned -contains $rel) { "@$(Hash (Join-Path $core $rel)) $rel" } else { "$(Hash (Join-Path $clientDocs $rel)) $rel" } }
[IO.File]::WriteAllText($manifest, (($rows | Sort-Object -Unique) -join "`n") + "`n", $utf8)
Write-Host "Synced core $rev -> $clientDocs (brand: $BrandId). Now open it locally, check it, then commit + push the client repo."

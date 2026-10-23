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
function Hash($path) { (Get-FileHash $path -Algorithm SHA256).Hash.Substring(0, 16) }
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
    Write-Host ("  {0,-28} {1}   [{2}]" -f $d.Name, $state, $line)
  }
  return
}

if (-not $Client -or -not $BrandId) { throw 'Give -Client <folder> -BrandId <id>, or -Check.' }
$Client = (Resolve-Path $Client).Path   # .NET file calls ignore the PowerShell location
$clientDocs = Join-Path $Client 'docs'
$brandDir = Join-Path $clientDocs "brands\$BrandId"
if (-not (Test-Path (Join-Path $brandDir 'brand.js'))) { throw "Missing $brandDir\brand.js - create the brand folder first (copy tools\brand-template)." }
if (CoreDirty) { Write-Warning 'The core has uncommitted changes in docs\. Commit the core first so CORE_VERSION.txt names a real commit.' }

# ---------- refuse to overwrite hand edits (unless -Force) ----------
$manifest = Join-Path $clientDocs 'CORE_FILES.txt'
if ((Test-Path $manifest) -and -not $Force) {
  $edited = foreach ($row in Get-Content $manifest -Encoding UTF8) {
    $h, $rel = $row -split ' ', 2
    $p = Join-Path $clientDocs $rel
    if ((Test-Path $p) -and (Hash $p) -ne $h) { $rel }
  }
  if ($edited) { throw "These core files were edited by hand in the client since the last sync:`n  $($edited -join "`n  ")`nMove the change into the core (or brand folder), or re-run with -Force to discard it." }
}

# ---------- copy ----------
$assets = Join-Path $clientDocs 'assets'
if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }   # stale core files must not linger
foreach ($rel in CoreFiles) {
  if ($rel -eq 'brand.js') { continue }                          # written below with this client's brand id
  $dest = Join-Path $clientDocs $rel
  New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
  Copy-Item (Join-Path $core $rel) $dest -Force
}
$loader = [IO.File]::ReadAllText((Join-Path $core 'brand.js'))
$new = $loader -replace 'var DEFAULT_BRAND = "[^"]*";', "var DEFAULT_BRAND = `"$BrandId`";"
if ($new -eq $loader -and $BrandId -ne 'bizconnect') { throw 'Could not set DEFAULT_BRAND in docs\brand.js (the line changed?).' }
[IO.File]::WriteAllText((Join-Path $clientDocs 'brand.js'), $new, $utf8)
New-Item -ItemType File -Force (Join-Path $clientDocs '.nojekyll') | Out-Null   # GitHub Pages: serve files as-is

# ---------- stamp + manifest ----------
$rev = CoreRev
[IO.File]::WriteAllText((Join-Path $clientDocs 'CORE_VERSION.txt'), "Synced from bizconnect-ai-studio core $rev on $(Get-Date -Format 'yyyy-MM-dd HH:mm')`n", $utf8)
$rows = foreach ($rel in (CoreFiles) + @('brand.js')) { "$(Hash (Join-Path $clientDocs $rel)) $rel" }
[IO.File]::WriteAllText($manifest, (($rows | Sort-Object -Unique) -join "`n") + "`n", $utf8)
Write-Host "Synced core $rev -> $clientDocs (brand: $BrandId). Now open it locally, check it, then commit + push the client repo."

<#
.SYNOPSIS
  Copy the shared AI Studio core (pages, scripts, styles) into a client studio folder.

.DESCRIPTION
  The core lives in bizconnect-ai-studio\docs. Each client studio (one business) lives in
  ..\ai-studio-clients\<client-folder>\ with its own git repo and its own brand folder:
      <client>\docs\brands\<BrandId>\brand.js, brand.css, img\
  This script overwrites the client's copy of the core files and points the brand loader
  (docs\brand.js) at <BrandId>. It never touches the client's brand folder, README or AGENTS.md.
  Run it whenever the core changes, then commit + push the client repo.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\tools\sync-client.ps1 -Client ..\ai-studio-clients\rootbloom-ai-studio -BrandId rootbloom
#>
param(
  [Parameter(Mandatory = $true)][string]$Client,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9_-]{1,40}$')][string]$BrandId
)
$ErrorActionPreference = 'Stop'
$core = Join-Path $PSScriptRoot '..\docs' | Resolve-Path
$clientDocs = Join-Path $Client 'docs'
$brandDir = Join-Path $clientDocs "brands\$BrandId"
if (-not (Test-Path (Join-Path $brandDir 'brand.js'))) { throw "Missing $brandDir\brand.js - create the brand folder first (copy docs\brands\_template)." }

# 1. pages + shared assets (everything in core docs except the brands folder)
foreach ($f in Get-ChildItem $core -File) {
  if ($f.Name -eq 'brand.js') { continue }          # written below with this client's brand id
  Copy-Item $f.FullName (Join-Path $clientDocs $f.Name) -Force
}
$assets = Join-Path $clientDocs 'assets'
if (Test-Path $assets) { Remove-Item $assets -Recurse -Force }   # stale core files must not linger
Copy-Item (Join-Path $core 'assets') $assets -Recurse -Force

# 2. brand loader pointed at this client
$loader = Get-Content (Join-Path $core 'brand.js') -Raw -Encoding UTF8
$loader = $loader -replace 'var DEFAULT_BRAND = "[^"]*";', "var DEFAULT_BRAND = `"$BrandId`";"
[IO.File]::WriteAllText((Join-Path $clientDocs 'brand.js'), $loader, (New-Object Text.UTF8Encoding $false))

# 3. GitHub Pages: serve files as-is (no Jekyll)
New-Item -ItemType File -Force (Join-Path $clientDocs '.nojekyll') | Out-Null

$rev = (git -C (Join-Path $PSScriptRoot '..') rev-parse --short HEAD 2>$null)
Set-Content -Path (Join-Path $clientDocs 'CORE_VERSION.txt') -Value "Synced from bizconnect-ai-studio core $rev on $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -Encoding UTF8
Write-Host "Synced core -> $clientDocs (brand: $BrandId, core $rev)"

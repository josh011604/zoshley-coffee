$ErrorActionPreference = 'Stop'

$version = 'v2.101.0'
$downloadUrl = "https://github.com/supabase/cli/releases/download/$version/supabase_2.101.0_windows_amd64.tar.gz"
$tempRoot = Join-Path $env:TEMP 'supabase-cli-install'
$targetDir = 'C:\Users\Zosh\ZoshleyCoffeeShop\zoshley-coffee\node_modules\@supabase\cli-windows-x64\bin'
$targetSupabase = Join-Path $targetDir 'supabase.exe'
$targetSupabaseGo = Join-Path $targetDir 'supabase-go.exe'

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$archivePath = Join-Path $tempRoot 'supabase.tar.gz'
Invoke-WebRequest -Uri $downloadUrl -OutFile $archivePath
tar -xzf $archivePath -C $tempRoot

$supabaseExe = Get-ChildItem -Path $tempRoot -Filter 'supabase.exe' -Recurse | Select-Object -First 1
if (-not $supabaseExe) {
  throw 'supabase.exe was not found in the downloaded archive.'
}

$supabaseGoExe = Get-ChildItem -Path $tempRoot -Filter 'supabase-go.exe' -Recurse | Select-Object -First 1
if (-not $supabaseGoExe) {
  throw 'supabase-go.exe was not found in the downloaded archive.'
}

Copy-Item $supabaseExe.FullName $targetSupabase -Force
Copy-Item $supabaseGoExe.FullName $targetSupabaseGo -Force
Write-Host "Installed Supabase CLI binaries to $targetDir"
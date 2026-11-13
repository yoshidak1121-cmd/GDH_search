[CmdletBinding()]
param([switch]$LibraryOnly,[switch]$Silent,[ValidatePattern('^\d+\.\d+\.\d+$')][string]$ExpectedVersion)
$ErrorActionPreference = 'Stop'
function Get-GdhReleasePlan($Release) {
    if ($Release.draft -or $Release.prerelease -or $Release.tag_name -notmatch '^v(\d+\.\d+\.\d+)$') { throw 'Invalid release' }
    $version = $Release.tag_name.Substring(1)
    $tag = $Release.tag_name
    $package = "GDH_Search_Setup_v$version.zip"
    $hashes = "SHA256SUMS_v$version.txt"
    $prefix = "https://github.com/yoshidak1121-cmd/GDH_search/releases/download/$tag/"
    $assets = @($Release.assets | Where-Object { $_.name -eq $package })
    $checksums = @($Release.assets | Where-Object { $_.name -eq $hashes })
    if ($assets.Count -ne 1 -or $checksums.Count -ne 1 -or $assets[0].browser_download_url -cne ($prefix + $package) -or $checksums[0].browser_download_url -cne ($prefix + $hashes)) { throw 'Invalid release assets' }
    return @{ Version=$version; Package=$package; Url=$assets[0].browser_download_url; HashUrl=$checksums[0].browser_download_url }
}
function Test-GdhPackage([string]$PackagePath, [string]$ChecksumText, [string]$Name) {
    $entries = @($ChecksumText -split '\r?\n' | Where-Object { $_ -match ('^([a-fA-F0-9]{64})  ' + [regex]::Escape($Name) + '$') })
    if ($entries.Count -ne 1) { throw 'Missing or duplicate checksum' }
    $expected = $entries[0].Substring(0,64)
    if ((Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash -ine $expected) { throw 'Checksum mismatch' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($PackagePath)
    try {
        $total = 0L
        foreach ($entry in $archive.Entries) {
            $nameInZip = $entry.FullName.Replace('\','/')
            if (!$nameInZip.StartsWith('GDH_Search_Setup/', [StringComparison]::Ordinal) -or $nameInZip.Contains(':') -or ($nameInZip -split '/' | Where-Object { $_ -eq '..' -or $_ -eq '.' })) { throw 'Unsafe ZIP entry' }
            $total += $entry.Length
            if ($total -gt 100MB) { throw 'Package too large' }
        }
    } finally { $archive.Dispose() }
}
if ($LibraryOnly) { return }
$work = $null
$updateLock = $null
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Write-Host 'GDH Update...'
    $base = Join-Path $env:LOCALAPPDATA 'GDH_Search'
    if(!(Test-Path -LiteralPath $base)){New-Item -ItemType Directory -Path $base | Out-Null}
    if((Get-Item -LiteralPath $base).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Update folder must not be a link'}
    $updateLock=[IO.File]::Open((Join-Path $base 'update.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    $release = Invoke-RestMethod -Uri 'https://github.com/yoshidak1121-cmd/GDH_search/releases/latest/download/gdh-release.json' -TimeoutSec 30 -Headers @{ Accept='application/json'; 'User-Agent'='GDH-Search-Updater' }
    $plan = Get-GdhReleasePlan $release
    if($ExpectedVersion -and $plan.Version -ne $ExpectedVersion){throw 'Release changed; check again'}
    $base = Join-Path $env:LOCALAPPDATA 'GDH_Search'
    $current = Join-Path $base 'Extension\manifest.json'
    if (Test-Path -LiteralPath $current) {
        $installed = Get-Content -LiteralPath $current -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([version]$installed.version -ge [version]$plan.Version) { Write-Host "v$($installed.version): latest"; if(!$Silent){Read-Host 'Enter' | Out-Null}; exit 0 }
    }
    $work = Join-Path ([IO.Path]::GetTempPath()) ('GDH-Update-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $work | Out-Null
    $packagePath = Join-Path $work $plan.Package
    $hashPath = Join-Path $work 'SHA256SUMS.txt'
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 90 -Uri $plan.Url -OutFile $packagePath
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 30 -Uri $plan.HashUrl -OutFile $hashPath
    Test-GdhPackage -PackagePath $packagePath -ChecksumText (Get-Content -LiteralPath $hashPath -Raw) -Name $plan.Package
    $expanded = Join-Path $work 'Expanded'
    Expand-Archive -LiteralPath $packagePath -DestinationPath $expanded
    $setupRoot = Join-Path $expanded 'GDH_Search_Setup'
    $manifest = Get-Content -LiteralPath (Join-Path $setupRoot 'GDH_Search_Extension\manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.version -ne $plan.Version -or $manifest.name -ne 'GDH 機械情報 拡張検索') { throw 'Package version mismatch' }
    if($Silent){& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $setupRoot 'Setup.ps1') -AutomatedUpdate}
    else {& powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $setupRoot 'Setup.ps1')}
    if ($LASTEXITCODE -ne 0) { throw 'Setup failed' }
} catch {
    Write-Host "GDH Update failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if($updateLock){$updateLock.Dispose()}
    if ($work -and (Test-Path -LiteralPath $work)) { Remove-Item -LiteralPath $work -Recurse -Force }
}

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
. (Join-Path $root 'installer\Browser.ps1')
. (Join-Path $root 'installer\Update.ps1') -LibraryOnly
function Assert($Condition, [string]$Message) { if (!$Condition) { throw $Message } }
function MustFail([scriptblock]$Action) { $failed=$false; try { & $Action } catch { $failed=$true }; Assert $failed 'Expected rejection' }
$both=@('Edge','Chrome')
Assert ((Select-GdhBrowser -Requested Chrome -Saved Edge -Installed $both -Running Edge -Default Edge) -eq 'Chrome') 'Explicit browser'
Assert ((Select-GdhBrowser -Saved Chrome -Installed $both -Running Edge -Default Edge) -eq 'Chrome') 'Saved browser'
Assert ((Select-GdhBrowser -Installed $both -Running Chrome -Default Edge) -eq 'Chrome') 'Single running browser'
Assert ((Select-GdhBrowser -Installed $both -Running $both -Default Edge) -eq 'Edge') 'Default browser'
Assert ((Select-GdhBrowser -Saved Chrome -Installed @('Edge')) -eq 'Edge') 'Only installed browser'
Assert ($null -eq (Select-GdhBrowser -Installed $both)) 'Ambiguous must ask'
MustFail { Select-GdhBrowser -Requested Chrome -Installed @('Edge') }
$tag='v1.0.0'
$url='https://github.com/yoshidak1121-cmd/GDH_search/releases/download/v1.0.0/'
$release=@{tag_name=$tag;draft=$false;prerelease=$false;assets=@(@{name='GDH_Search_Setup_v1.0.0.zip';browser_download_url=($url+'GDH_Search_Setup_v1.0.0.zip')},@{name='SHA256SUMS_v1.0.0.txt';browser_download_url=($url+'SHA256SUMS_v1.0.0.txt')})}
Assert ((Get-GdhReleasePlan $release).Version -eq '1.0.0') 'Release selection'
$release.assets[0].browser_download_url='https://example.com/setup.zip'
MustFail { Get-GdhReleasePlan $release }
$release.assets[0].browser_download_url=$url+'GDH_Search_Setup_v1.0.0.zip'
$release.prerelease=$true;MustFail { Get-GdhReleasePlan $release };$release.prerelease=$false
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('GDH-Setup-Test-'+[guid]::NewGuid().ToString('N'))
$previousLocal=$env:LOCALAPPDATA
try {
 New-Item -ItemType Directory -Path $testRoot | Out-Null
 $env:LOCALAPPDATA=Join-Path $testRoot 'Local'
 $desktopFixture=Join-Path $testRoot 'Desktop';New-Item -ItemType Directory -Path $desktopFixture | Out-Null
 Remove-GdhLegacyShortcut -Desktop $desktopFixture -Updater 'C:\Synthetic\Update.bat'
 Assert (@(Get-ChildItem -LiteralPath $desktopFixture).Count -eq 0) 'No desktop file created'
 $linkPath=Join-Path $desktopFixture 'GDH Update.lnk';$shell=New-Object -ComObject WScript.Shell
 $link=$shell.CreateShortcut($linkPath);$link.TargetPath='C:\Synthetic\Update.bat';$link.Description='GDH Search Update';$link.Save()
 Remove-GdhLegacyShortcut -Desktop $desktopFixture -Updater 'C:\Synthetic\Update.bat'
 Assert (!(Test-Path -LiteralPath $linkPath)) 'Owned legacy shortcut removed'
 $link=$shell.CreateShortcut($linkPath);$link.TargetPath='C:\Other\Update.bat';$link.Description='Other';$link.Save()
 Remove-GdhLegacyShortcut -Desktop $desktopFixture -Updater 'C:\Synthetic\Update.bat'
 Assert (Test-Path -LiteralPath $linkPath) 'Unrelated shortcut preserved'
 $fixture=Join-Path $testRoot 'Package'
 $extension=Join-Path $fixture 'GDH_Search_Extension'
 New-Item -ItemType Directory -Path $extension -Force | Out-Null
 foreach ($name in @('Setup.ps1','Browser.ps1','NativeHost.cs','NativeHost.ps1','Update.bat','Update.ps1')) { Copy-Item -LiteralPath (Join-Path $root "installer\$name") -Destination $fixture }
 $manifest=@{name='GDH 機械情報 拡張検索';manifest_version=3;version='1.0.0'}
 $manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $extension 'manifest.json') -Encoding UTF8
 Set-Content -LiteralPath (Join-Path $extension 'old.txt') -Value 'synthetic'
 & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $fixture 'Setup.ps1') -PrepareOnly -Language en
 Assert ($LASTEXITCODE -eq 0) 'First placement'
 $base=Join-Path $env:LOCALAPPDATA 'GDH_Search'
 $target=Join-Path $base 'Extension'
 Assert (Test-Path -LiteralPath (Join-Path $target 'old.txt')) 'First file'
 Assert (Test-Path -LiteralPath (Join-Path $base 'Update.bat')) 'Persistent updater'
 Assert (!(Test-Path -LiteralPath (Join-Path $base 'setup.json'))) 'PrepareOnly stores no browser selection'
 Set-Content -LiteralPath (Join-Path $base 'unrelated.txt') -Value 'keep'
 $manifest.version='1.0.1';$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $extension 'manifest.json') -Encoding UTF8
 Remove-Item -LiteralPath (Join-Path $extension 'old.txt');Set-Content -LiteralPath (Join-Path $extension 'new.txt') -Value 'synthetic'
 & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $fixture 'Setup.ps1') -PrepareOnly -Language en
 Assert ($LASTEXITCODE -eq 0) 'Update placement'
 Assert (Test-Path -LiteralPath (Join-Path $target 'new.txt')) 'New file'
 Assert (!(Test-Path -LiteralPath (Join-Path $target 'old.txt'))) 'Stale file removed'
 Assert (@(Get-ChildItem -LiteralPath $base -Directory -Filter 'Backup-*').Count -eq 1) 'Backup kept'
 Assert ((Get-Content -LiteralPath (Join-Path $base 'unrelated.txt')) -eq 'keep') 'Unrelated files preserved'
 $other=@{name='Unrelated extension';manifest_version=3;version='1.0.0'}
 $other | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'manifest.json') -Encoding UTF8
 & powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File (Join-Path $fixture 'Setup.ps1') -PrepareOnly -Language en
 Assert ($LASTEXITCODE -ne 0) 'Unrelated target rejected'
 Assert ((Get-Content -LiteralPath (Join-Path $target 'manifest.json') -Raw | ConvertFrom-Json).name -eq 'Unrelated extension') 'Unrelated target not replaced'
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 $zipSource=Join-Path $testRoot 'ZipSource';$zipRoot=Join-Path $zipSource 'GDH_Search_Setup'
 New-Item -ItemType Directory -Path $zipRoot -Force | Out-Null
 Set-Content -LiteralPath (Join-Path $zipRoot 'synthetic.txt') -Value 'fixture'
 $zip=Join-Path $testRoot 'GDH_Search_Setup_v1.0.0.zip'
 [IO.Compression.ZipFile]::CreateFromDirectory($zipSource,$zip)
 $checksum=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash+'  GDH_Search_Setup_v1.0.0.zip'
 Test-GdhPackage $zip $checksum 'GDH_Search_Setup_v1.0.0.zip'
 MustFail { Test-GdhPackage $zip (('0'*64)+'  GDH_Search_Setup_v1.0.0.zip') 'GDH_Search_Setup_v1.0.0.zip' }
 MustFail { Test-GdhPackage $zip ($checksum+"`n"+$checksum) 'GDH_Search_Setup_v1.0.0.zip' }
 Remove-Item -LiteralPath $zip
 $archive=[IO.Compression.ZipFile]::Open($zip,[IO.Compression.ZipArchiveMode]::Create)
 $null=$archive.CreateEntry('GDH_Search_Setup/../escape.txt');$archive.Dispose()
 $checksum=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash+'  GDH_Search_Setup_v1.0.0.zip'
 MustFail { Test-GdhPackage $zip $checksum 'GDH_Search_Setup_v1.0.0.zip' }
 # Run the complete updater with synthetic downloads and a stubbed setup process.
 Remove-Item -LiteralPath $zip
 $zipExtension=Join-Path $zipRoot 'GDH_Search_Extension';New-Item -ItemType Directory -Path $zipExtension | Out-Null
 @{name='GDH 機械情報 拡張検索';version='1.0.0'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $zipExtension 'manifest.json') -Encoding UTF8
 Set-Content -LiteralPath (Join-Path $zipRoot 'Setup.ps1') -Value '# synthetic only'
 [IO.Compression.ZipFile]::CreateFromDirectory($zipSource,$zip)
 $script:fixtureZip=$zip
 $script:fixtureHash=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash+'  GDH_Search_Setup_v1.0.0.zip'
 @{name='GDH 機械情報 拡張検索';version='0.9.0'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $target 'manifest.json') -Encoding UTF8
 $script:setupCalls=0
 function Invoke-RestMethod { param($Uri,$TimeoutSec,$Headers);Assert ($Uri -eq 'https://github.com/yoshidak1121-cmd/GDH_search/releases/latest/download/gdh-release.json') 'Pinned release source';return ($script:release | ConvertTo-Json -Depth 10) }
 function Invoke-WebRequest { param([switch]$UseBasicParsing,$TimeoutSec,$Uri,$OutFile);if($Uri.EndsWith('.zip')){Copy-Item -LiteralPath $script:fixtureZip -Destination $OutFile}else{Set-Content -LiteralPath $OutFile -Value $script:fixtureHash -Encoding ASCII} }
 function powershell.exe { param([switch]$NoLogo,[switch]$NoProfile,$ExecutionPolicy,$File);Assert (Test-Path -LiteralPath $File) 'Verified setup file';$script:setupCalls++;$global:LASTEXITCODE=0 }
 . (Join-Path $root 'installer\Update.ps1')
 Assert ($script:setupCalls -eq 1) 'Verified update invokes setup exactly once'
 Assert (!(Test-Path -LiteralPath $work)) 'Update temporary files removed'
 Write-Host 'PASS: Windows browser selection, first/update placement, backup, stale cleanup, unrelated-target refusal, updater assets/checksum/ZIP rejection; no browser/profile/registry writes'
} finally { $env:LOCALAPPDATA=$previousLocal; if(Test-Path -LiteralPath $testRoot){Remove-Item -LiteralPath $testRoot -Recurse -Force} }

exit 0

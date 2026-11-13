$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
. (Join-Path $root 'installer\NativeHost.ps1')
function Assert($Condition,[string]$Message){if(!$Condition){throw $Message}}
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('GDH-Native-Test-'+[guid]::NewGuid().ToString('N'))
$registryKeys=@('HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.yoshidak.gdh_search_updater','HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\com.yoshidak.gdh_search_updater')
$createdRegistry=@()
try{
 New-Item -ItemType Directory -Path (Join-Path $testRoot 'Extension') -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $root 'installer\NativeHost.cs') -Destination $testRoot
 @{name='GDH 機械情報 拡張検索';manifest_version=3;version='0.9.0'}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $testRoot 'Extension\manifest.json') -Encoding UTF8
 $hostInfo=Install-GdhNativeHost -Base $testRoot -ExtensionPath (Join-Path $testRoot 'Extension') -SkipRegistration
 Assert ((Get-GdhExtensionId 'c:\GDH\Extension') -eq 'immllbhlcfkcidcejhbpjdfpmkmfkokc') 'Chromium SHA256 UTF16 path fixture'
 Assert ($hostInfo.Id -match '^[a-p]{32}$') 'Chromium path-derived ID'
 Assert ((Get-GdhExtensionId 'c:\GDH\Extension') -eq (Get-GdhExtensionId 'C:\GDH\Extension')) 'Drive letter normalization'
 if(@($registryKeys|Where-Object{Test-Path -LiteralPath $_}).Count -eq 0){
  $hostInfo=Install-GdhNativeHost -Base $testRoot -ExtensionPath (Join-Path $testRoot 'Extension')
  $createdRegistry=$registryKeys
  foreach($key in $registryKeys){Assert ((Get-Item -LiteralPath $key).GetValue('') -eq $hostInfo.Manifest) 'Per-user host registration'}
 }
 $origin='chrome-extension://'+$hostInfo.Id+'/'
 function Invoke-FixtureHost([string]$Caller,$Message,[int]$Oversized=0){
  $start=New-Object Diagnostics.ProcessStartInfo
  $start.FileName=$hostInfo.Executable;$start.Arguments=$Caller;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
  $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
  $process=[Diagnostics.Process]::Start($start)
  try{
   $bytes=[Text.Encoding]::UTF8.GetBytes(($Message|ConvertTo-Json -Compress));$size=if($Oversized){$Oversized}else{$bytes.Length}
   try {
   $process.StandardInput.BaseStream.Write([BitConverter]::GetBytes([int]$size),0,4)
   if(!$Oversized){$process.StandardInput.BaseStream.Write($bytes,0,$bytes.Length)}
   $process.StandardInput.BaseStream.Flush()
   }catch{if($Caller -eq $origin){throw}}
   $reader=New-Object IO.BinaryReader($process.StandardOutput.BaseStream)
   do{
    $count=$reader.ReadInt32();Assert ($count -gt 0 -and $count -lt 4096) 'Framed JSON output only'
    $reply=[Text.Encoding]::UTF8.GetString($reader.ReadBytes($count))|ConvertFrom-Json
   }while($reply.type -eq 'progress')
   Assert ($process.WaitForExit(30000)) 'Host exits promptly'
   return $reply
  }finally{if(!$process.HasExited){$process.Kill()};$process.Dispose()}
 }
 $ping=Invoke-FixtureHost $origin @{action='ping'};Assert ($ping.ok -and $ping.version -eq '0.9.0') ('Native ping: '+($ping|ConvertTo-Json -Compress))
 $denied=Invoke-FixtureHost 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/' @{action='ping'}
 Assert ($denied.code -eq 'ORIGIN_DENIED') 'Foreign origin rejected'
 Assert ((Invoke-FixtureHost $origin @{action='delete';path='C:\anything'}).code -eq 'INVALID_REQUEST') 'Arbitrary commands rejected'
 Assert ((Invoke-FixtureHost $origin @{action='update';version='1.0.0 & echo unsafe'}).code -eq 'INVALID_REQUEST') 'Argument injection rejected'
 Assert ((Invoke-FixtureHost $origin @{action='ping'} 5000).code -eq 'INVALID_REQUEST') 'Oversized input rejected'
 @'
param([switch]$Silent,[string]$ExpectedVersion)
if(!$Silent){exit 2}
Write-Host 'SYNTHETIC CHILD LOG MUST NOT ENTER NATIVE STDOUT'
$path=Join-Path $PSScriptRoot 'Extension\manifest.json'
$manifest=Get-Content -LiteralPath $path -Raw -Encoding UTF8|ConvertFrom-Json
$manifest.version=$ExpectedVersion
$manifest|ConvertTo-Json|Set-Content -LiteralPath $path -Encoding UTF8
exit 0
'@|Set-Content -LiteralPath (Join-Path $testRoot 'Update.ps1') -Encoding UTF8
 $updated=Invoke-FixtureHost $origin @{action='update';version='1.0.1'}
 Assert ($updated.ok -and $updated.version -eq '1.0.1') 'Verified child update and clean protocol'
 'exit 1'|Set-Content -LiteralPath (Join-Path $testRoot 'Update.ps1') -Encoding UTF8
 Assert ((Invoke-FixtureHost $origin @{action='update';version='1.0.2'}).code -eq 'UPDATE_FAILED') 'Child failure surfaced'
 Write-Host 'PASS: native executable framing, Chromium path ID, HKCU host registration, origin/action/size/argument guards, silent verified child update, child-log isolation and failure'
}finally{
 foreach($key in $createdRegistry){Remove-Item -LiteralPath $key -Force}
 if(Test-Path -LiteralPath $testRoot){Remove-Item -LiteralPath $testRoot -Recurse -Force}
}
exit 0

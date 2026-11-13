function Get-GdhExtensionId([string]$ExtensionPath) {
    $path=[IO.Path]::GetFullPath($ExtensionPath).TrimEnd('\')
    if($path -match '^[a-z]:'){$path=$path.Substring(0,1).ToUpperInvariant()+$path.Substring(1)}
    $sha=[Security.Cryptography.SHA256]::Create()
    try{$hash=$sha.ComputeHash([Text.Encoding]::Unicode.GetBytes($path))}finally{$sha.Dispose()}
    $id='';foreach($byte in $hash[0..15]){$id += [char](97+($byte -shr 4));$id += [char](97+($byte -band 15))};return $id
}
function Install-GdhNativeHost([string]$Base,[string]$ExtensionPath,[switch]$SkipRegistration) {
    if((Get-Item -LiteralPath $Base).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Helper folder must not be a link'}
    $source=Join-Path $Base 'NativeHost.cs'
    $hash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.Substring(0,16).ToLowerInvariant()
    $exe=Join-Path $Base "Native-$hash.exe"
    if(!(Test-Path -LiteralPath $exe)){
        Add-Type -TypeDefinition (Get-Content -LiteralPath $source -Raw -Encoding UTF8) -ReferencedAssemblies 'System.Web.Extensions.dll' -OutputAssembly $exe -OutputType ConsoleApplication
    }
    $id=Get-GdhExtensionId $ExtensionPath
    $hostPath=Join-Path $Base 'com.yoshidak.gdh_search_updater.json'
    if((Test-Path -LiteralPath $hostPath)-and((Get-Item -LiteralPath $hostPath).Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'Helper manifest must not be a link'}
    $json=@{name='com.yoshidak.gdh_search_updater';description='GDH Search updater';path=$exe;type='stdio';allowed_origins=@("chrome-extension://$id/")} | ConvertTo-Json
    [IO.File]::WriteAllText($hostPath,$json,(New-Object Text.UTF8Encoding($false)))
    if(!$SkipRegistration){
        foreach($browser in @('Google\Chrome','Microsoft\Edge')){
            $key="HKCU:\Software\$browser\NativeMessagingHosts\com.yoshidak.gdh_search_updater"
            New-Item -Path $key -Force | Out-Null;Set-Item -LiteralPath $key -Value $hostPath
        }
    }
    return @{Id=$id;Executable=$exe;Manifest=$hostPath}
}

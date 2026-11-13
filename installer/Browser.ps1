function Get-GdhBrowserExecutable([string]$Name) {
    $paths = if ($Name -eq 'Edge') {
        @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe")
    } else {
        @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
    }
    return $paths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
function Select-GdhBrowser([string]$Requested, [string]$Saved, [string[]]$Installed, [string[]]$Running, [string]$Default) {
    if ($Requested) {
        if ($Requested -notin $Installed) { throw "$Requested not found" }
        return $Requested
    }
    if ($Saved -in $Installed) { return $Saved }
    $active = @($Running | Where-Object { $_ -in $Installed } | Select-Object -Unique)
    if ($active.Count -eq 1) { return $active[0] }
    if ($Default -in $Installed) { return $Default }
    if ($Installed.Count -eq 1) { return $Installed[0] }
    return $null
}
function Find-GdhBrowser([string]$Requested, [string]$Saved) {
    $installed = @('Edge','Chrome' | Where-Object { Get-GdhBrowserExecutable $_ })
    $running = @()
    if (Get-Process -Name msedge -ErrorAction SilentlyContinue) { $running += 'Edge' }
    if (Get-Process -Name chrome -ErrorAction SilentlyContinue) { $running += 'Chrome' }
    $default = $null
    try {
        $progId = (Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice').ProgId
        if ($progId -like 'MSEdgeHTM*') { $default = 'Edge' }
        elseif ($progId -like 'ChromeHTML*') { $default = 'Chrome' }
    } catch {}
    Select-GdhBrowser -Requested $Requested -Saved $Saved -Installed $installed -Running $running -Default $default
}

function Remove-GdhLegacyShortcut([string]$Desktop, [string]$Updater) {
    if (!$Desktop) { return }
    $path = Join-Path $Desktop 'GDH Update.lnk'
    if (!(Test-Path -LiteralPath $path -PathType Leaf)) { return }
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($path)
    if ($link.TargetPath -eq $Updater -and $link.Description -eq 'GDH Search Update') { Remove-Item -LiteralPath $path }
}

[CmdletBinding()]
param(
    [ValidateSet('Edge', 'Chrome')][string]$Browser,
    [ValidateSet('Auto', 'ja', 'en')][string]$Language = 'Auto',
    [switch]$PrepareOnly,
    [switch]$AutomatedUpdate
)
$ErrorActionPreference = 'Stop'
if ($Language -eq 'Auto') { $Language = if ([Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'ja') { 'ja' } else { 'en' } }
function T([string]$Japanese, [string]$English) { if ($Language -eq 'ja') { return $Japanese }; return $English }
. (Join-Path $PSScriptRoot 'Browser.ps1')
$createdFolders = New-Object 'System.Collections.Generic.List[string]'
$filesPlaced = $false
$backupMoved = $false
$rolledBack = $false
try {
    $source = Join-Path $PSScriptRoot 'GDH_Search_Extension'
    $manifestPath = Join-Path $source 'manifest.json'
    if (!(Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw (T 'ZIPをすべて展開してから実行してください。' 'Extract the entire ZIP first.') }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.name -ne 'GDH 機械情報 拡張検索' -or $manifest.manifest_version -ne 3) { throw 'Invalid extension package' }
    if (!$env:LOCALAPPDATA) { throw 'LOCALAPPDATA unavailable' }
    $base = Join-Path $env:LOCALAPPDATA 'GDH_Search'
    $target = Join-Path $base 'Extension'
    $isUpdate = Test-Path -LiteralPath (Join-Path $target 'manifest.json')
    $preferences = Join-Path $base 'setup.json'
    if (!$PrepareOnly -and !$AutomatedUpdate) {
        $savedBrowser = $null
        if (Test-Path -LiteralPath $preferences -PathType Leaf) {
            try { $savedBrowser = (Get-Content -LiteralPath $preferences -Raw -Encoding UTF8 | ConvertFrom-Json).Browser } catch {}
        }
        $Browser = Find-GdhBrowser -Requested $Browser -Saved $savedBrowser
        if (!$Browser) {
            $choice = Read-Host (T 'ブラウザー：1 Edge / 2 Chrome' 'Browser: 1 Edge / 2 Chrome')
            if ($choice -eq '1') { $Browser = 'Edge' } elseif ($choice -eq '2') { $Browser = 'Chrome' } else { throw 'Select 1 or 2' }
        }
        $exe = Get-GdhBrowserExecutable $Browser
        if (!$exe) { throw "$Browser not found" }
    }
    if (!(Test-Path -LiteralPath $base)) {
        New-Item -ItemType Directory -Path $base | Out-Null
        $createdFolders.Add($base)
    }
    if ((Get-Item -LiteralPath $base).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw (T '配置先にリンクフォルダーは使用できません。' 'The installation folder must not be a link.') }
    $stage = Join-Path $base ('Staging-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    $createdFolders.Add($stage)
    Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $stage -Recurse -Force
    $stagedManifest = Get-Content -LiteralPath (Join-Path $stage 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($stagedManifest.version -ne $manifest.version) { throw (T '配置ファイルの確認に失敗しました。' 'Verification of the staged files failed.') }
    # All directory moves remain inside the dedicated per-user installation root.
    $resolvedBase = [IO.Path]::GetFullPath($base).TrimEnd('\') + '\'
    foreach ($folder in @($target, $stage)) {
        if (![IO.Path]::GetFullPath($folder).StartsWith($resolvedBase, [StringComparison]::OrdinalIgnoreCase)) { throw (T '配置先の検証に失敗しました。' 'Installation path validation failed.') }
    }
    $backup = $null
    if (Test-Path -LiteralPath $target) {
        if ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw (T '既存の保存先にリンクフォルダーは使用できません。' 'The existing extension folder must not be a link.') }
        $existingManifest = Join-Path $target 'manifest.json'
        if (!(Test-Path -LiteralPath $existingManifest)) { throw (T '既存の保存先が本ツールのフォルダーではありません。配置を中止しました。' 'The existing folder does not belong to this tool. Setup stopped.') }
        $existing = Get-Content -LiteralPath $existingManifest -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($existing.name -ne $manifest.name) { throw (T '既存の保存先が別の拡張機能です。配置を中止しました。' 'The existing folder belongs to another extension. Setup stopped.') }
        $backup = Join-Path $base ('Backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
        Move-Item -LiteralPath $target -Destination $backup
        $backupMoved = $true
        $createdFolders.Add($backup)
    }
    try {
        Move-Item -LiteralPath $stage -Destination $target
        $filesPlaced = $true
        $createdFolders.Add($target)
    }
    catch {
        if ($backupMoved -and !(Test-Path -LiteralPath $target)) { Move-Item -LiteralPath $backup -Destination $target; $rolledBack = $true }
        throw
    }
    foreach ($name in @('Update.bat','Update.ps1','NativeHost.cs','NativeHost.ps1')) {
        $launcher = Join-Path $base $name
        if ((Test-Path -LiteralPath $launcher) -and ((Get-Item -LiteralPath $launcher).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Updater path must not be a link' }
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $launcher -Force
    }
    Write-Host (T "GDH v$($manifest.version)：配置完了" "GDH v$($manifest.version): files ready") -ForegroundColor Green
    if ($PrepareOnly) { exit 0 }
    . (Join-Path $base 'NativeHost.ps1')
    $null = Install-GdhNativeHost -Base $base -ExtensionPath $target
    if($AutomatedUpdate){exit 0}
    if ((Test-Path -LiteralPath $preferences) -and ((Get-Item -LiteralPath $preferences).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Settings path must not be a link' }
    @{ Browser = $Browser } | ConvertTo-Json | Set-Content -LiteralPath $preferences -Encoding UTF8
    try { Remove-GdhLegacyShortcut -Desktop ([Environment]::GetFolderPath('Desktop')) -Updater (Join-Path $base 'Update.bat') } catch {}
    if (!$isUpdate) { try { Set-Clipboard -Value $target } catch {} }
    $url = if ($Browser -eq 'Edge') { 'edge://extensions/' } else { 'chrome://extensions/' }
    Start-Process -FilePath $exe -ArgumentList $url
    Write-Host "$Browser"
    if ($isUpdate) {
        Write-Host (T '本拡張機能の ↻ → GDH画面でF5。' 'Click Reload on this extension, then press F5 on GDH.')
    } else {
        Write-Host (T '開発者モード → 展開して読み込み → 次のフォルダーを選択。' 'Developer mode > Load unpacked > select this folder:')
        Write-Host $target
    }
    Read-Host (T 'Enterで終了' 'Enter to close') | Out-Null
    exit 0
} catch {
    Write-Host (T "更新できませんでした：$($_.Exception.Message)" "Update failed: $($_.Exception.Message)") -ForegroundColor Red
    exit 1
}

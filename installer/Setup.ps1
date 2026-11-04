[CmdletBinding()]
param(
    [ValidateSet('Edge', 'Chrome')][string]$Browser,
    [ValidateSet('Auto', 'ja', 'en')][string]$Language = 'Auto',
    [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
# Japanese Windows UI uses Japanese; all other UI languages use English.
if ($Language -eq 'Auto') {
    $Language = if ([Globalization.CultureInfo]::CurrentUICulture.TwoLetterISOLanguageName -eq 'ja') { 'ja' } else { 'en' }
}
function T([string]$Japanese, [string]$English) {
    if ($Language -eq 'ja') { return $Japanese }
    return $English
}
Write-Host (T '表示言語：日本語' 'Display language: English')
try {
    $source = Join-Path $PSScriptRoot 'GDH_Search_Extension'
    $manifestPath = Join-Path $source 'manifest.json'
    if (!(Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw (T '配布ファイルが不足しています。ZIPをすべて展開してから実行してください。' 'Package files are missing. Extract the entire ZIP before running setup.') }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.name -ne 'GDH 機械情報 拡張検索' -or $manifest.manifest_version -ne 3) { throw (T '拡張機能の種類を確認できません。' 'The extension package could not be identified.') }
    if (!$env:LOCALAPPDATA) { throw (T 'ユーザーの保存先を確認できません。' 'The per-user installation location is unavailable.') }
    $base = Join-Path $env:LOCALAPPDATA 'GDH_Search'
    $target = Join-Path $base 'Extension'
    New-Item -ItemType Directory -Path $base -Force | Out-Null
    if ((Get-Item -LiteralPath $base).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw (T '配置先にリンクフォルダーは使用できません。' 'The installation folder must not be a link.') }
    $stage = Join-Path $base ('Staging-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
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
    }
    try { Move-Item -LiteralPath $stage -Destination $target }
    catch {
        if ($backup -and !(Test-Path -LiteralPath $target)) { Move-Item -LiteralPath $backup -Destination $target }
        throw
    }
    Write-Host (T "配置完了：バージョン $($manifest.version)" "Installation complete: version $($manifest.version)") -ForegroundColor Green
    Write-Host (T "読み込み先：$target" "Extension folder: $target")
    if ($backup) { Write-Host (T "更新前のバックアップ：$backup" "Previous version backup: $backup") }
    if ($PrepareOnly) { exit 0 }
    if (!$Browser) {
        $choice = Read-Host (T '使用するブラウザーを選択してください（1: Edge / 2: Chrome）' 'Choose your browser (1: Edge / 2: Chrome)')
        if ($choice -eq '1') { $Browser = 'Edge' } elseif ($choice -eq '2') { $Browser = 'Chrome' } else { throw (T '1または2を入力して、もう一度実行してください。ファイルの配置は完了しています。' 'Enter 1 or 2 and run setup again. Files have already been installed.') }
    }
    $paths = if ($Browser -eq 'Edge') {
        @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe")
    } else {
        @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
    }
    $exe = $paths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (!$exe) { throw (T "$Browser が見つかりません。ブラウザーの拡張機能管理画面を手動で開いてください。" "$Browser was not found. Open the browser extension management page manually.") }
    try { Set-Clipboard -Value $target; Write-Host (T '読み込み先をクリップボードにコピーしました。' 'The extension folder path has been copied to the clipboard.') } catch { Write-Host (T 'パスをコピーできませんでした。上の読み込み先を手動で指定してください。' 'Could not copy the path. Select the extension folder shown above manually.') }
    $url = if ($Browser -eq 'Edge') { 'edge://extensions/' } else { 'chrome://extensions/' }
    Start-Process -FilePath $exe -ArgumentList $url
    Write-Host ''
    Write-Host (T '【初回】開発者モードをオン → 展開して読み込み → パスを貼り付けてフォルダーを選択。' '[First install] Turn on Developer mode > Load unpacked > paste the path and select the folder.')
    Write-Host (T '【更新】登録済み拡張機能の再読み込みボタンを押してください。' '[Update] Click Reload on the installed extension.')
    Write-Host (T '以前別の場所から登録した場合は、古い登録を削除して上記の読み込み先を登録してください。' 'If you previously loaded a different folder, remove that extension and load the folder shown above.')
    Write-Host (T 'GDHの機械情報検索画面も再読み込みし、右下の「拡張検索」を押してください。' 'Reload the GDH machine search page and click the extension search button at the bottom right.')
    Write-Host (T '保存先のExtensionフォルダーは移動・削除しないでください。' 'Do not move or delete the installed Extension folder.')
    Read-Host (T 'Enterキーで終了' 'Press Enter to close') | Out-Null
    exit 0
} catch {
    Write-Host (T "導入を完了できませんでした：$($_.Exception.Message)" "Setup could not complete: $($_.Exception.Message)") -ForegroundColor Red
    Write-Host (T '手動で導入する場合は、同梱の「はじめに.txt」を参照してください。' 'For manual installation, see the included START_HERE.txt (Japanese / English).')
    exit 1
}

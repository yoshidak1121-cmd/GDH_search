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
$createdFolders = New-Object 'System.Collections.Generic.List[string]'
$filesPlaced = $false
$clipboardChanged = $false
$browserOpened = $false
$backupMoved = $false
$rolledBack = $false
$base = $null
$target = $null
$stage = $null
$backup = $null
function Show-ChangeSummary {
    Write-Host ''
    Write-Host (T '【実際に行った変更】' '[Changes made by this run]') -ForegroundColor Cyan
    if ($filesPlaced) {
        Write-Host (T "拡張機能ファイルを配置しました：$target" "Extension files were placed at: $target")
    } else {
        Write-Host (T '拡張機能ファイルの配置は完了していません。' 'Extension file placement did not complete.')
    }
    Write-Host (T '作成したフォルダー（この実行で作成したもの）：' 'Folders created by this run:')
    if ($createdFolders.Count -eq 0) { Write-Host (T '  なし' '  None') }
    foreach ($folder in $createdFolders) {
        if (Test-Path -LiteralPath $folder) { Write-Host "  $folder" }
        elseif ($folder -eq $stage -and $filesPlaced) { Write-Host (T "  $folder （一時作業用。配置先へ移動済み）" "  $folder (temporary staging folder; moved to the destination)") }
        else { Write-Host (T "  $folder （移動・復元により、この場所には残っていません）" "  $folder (no longer at this location after moving or restoration)") }
    }
    if ($backupMoved -and !$rolledBack -and (Test-Path -LiteralPath $backup)) { Write-Host (T "以前のファイルを退避したフォルダー：$backup" "Previous files were moved to: $backup") }
    if ($rolledBack) { Write-Host (T '配置に失敗したため、以前のファイルを元の場所へ戻しました。' 'Placement failed; the previous files were restored to their original location.') }
    if ($clipboardChanged) { Write-Host (T 'クリップボード：配置先のパスに変更しました。' 'Clipboard: replaced with the destination folder path.') }
    else { Write-Host (T 'クリップボード：この処理では変更していません。' 'Clipboard: not changed by this run.') }
    if ($browserOpened) { Write-Host (T "ブラウザー：$Browser の拡張機能管理画面を開くよう要求しました。" "Browser: requested the $Browser extension management page to open.") }
    else { Write-Host (T 'ブラウザー：管理画面を開く処理は完了していません。' 'Browser: no completed request to open the management page.') }
    Write-Host (T 'この処理はファイルの配置支援です。ブラウザーへの拡張機能のインストール・登録・有効化は行っていません。' 'This script only prepares files. It has NOT installed, registered, or enabled the extension in your browser.') -ForegroundColor Yellow
    Write-Host (T '既存のブラウザー登録状態も確認していません。登録・有効化・更新後の再読み込みは、ブラウザーで手動で行ってください。' 'Existing browser registration was not checked. Register, enable, or reload the extension manually in the browser.')
    Write-Host (T '管理ポリシー・レジストリ・ブラウザープロファイル・PCの恒久的な実行ポリシーは変更していません。' 'Management policies, the registry, browser profiles, and the permanent PowerShell execution policy were not changed.')
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
    Write-Host ''
    Write-Host (T '【これから行う変更】' '[Planned changes]') -ForegroundColor Cyan
    Write-Host (T "保存用フォルダーを必要に応じて作成します：$base" "Create the storage folder if needed: $base")
    Write-Host (T "拡張機能ファイルを配置します：$target" "Place extension files in: $target")
    Write-Host (T '作業中はStaging-で始まる一時フォルダーを作成し、配置先へ移動します。' 'Create a temporary Staging-* folder, then move it to the destination.')
    Write-Host (T '配置先に以前の本ツールがあれば、Backup-で始まるフォルダーへ退避します。' 'If this tool already exists at the destination, move it to a Backup-* folder.')
    if (!$PrepareOnly) {
        Write-Host (T '配置先のパスをクリップボードへコピーし、選択したブラウザーの管理画面を開きます。' 'Copy the destination path to the clipboard and open the selected browser extension management page.')
    }
    Write-Host (T 'ファイルの配置だけを行い、ブラウザーへのインストール・登録・有効化は行いません。' 'This prepares files only; it does not install, register, or enable the extension in the browser.')
    Write-Host (T '管理ポリシー・レジストリ・ブラウザープロファイル・PCの恒久的な実行ポリシーは変更しません。' 'Management policies, the registry, browser profiles, and permanent execution policy will not be changed.')
    if (!$PrepareOnly) { Read-Host (T '内容を確認し、Enterキーでファイル配置を開始（中止はCtrl+C）' 'Review the plan, then press Enter to prepare files (Ctrl+C to cancel)') | Out-Null }
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
    Write-Host (T "配置完了：バージョン $($manifest.version)" "File preparation complete: version $($manifest.version)") -ForegroundColor Green
    Write-Host (T "読み込み先：$target" "Extension folder: $target")
    if ($backup) { Write-Host (T "更新前のバックアップ：$backup" "Previous version backup: $backup") }
    if ($PrepareOnly) { Show-ChangeSummary; exit 0 }
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
    try { Set-Clipboard -Value $target; $clipboardChanged = $true; Write-Host (T '読み込み先をクリップボードにコピーしました。' 'The extension folder path has been copied to the clipboard.') } catch { Write-Host (T 'パスをコピーできませんでした。上の読み込み先を手動で指定してください。' 'Could not copy the path. Select the extension folder shown above manually.') }
    $url = if ($Browser -eq 'Edge') { 'edge://extensions/' } else { 'chrome://extensions/' }
    Start-Process -FilePath $exe -ArgumentList $url
    $browserOpened = $true
    Write-Host ''
    Write-Host (T '【初回1】Edge右上の「…」→ 拡張機能 → 拡張機能の管理（管理画面が開いていれば不要）。' '[First setup 1] Edge: top-right ... > Extensions > Manage extensions (skip if already open).')
    Write-Host (T '【初回2】Chromeは右上の縦3点 → 拡張機能 → 拡張機能を管理。' '[First setup 2] Chrome: top-right three-dot menu > Extensions > Manage extensions.')
    Write-Host (T '【初回3】管理画面の「開発者モード／デベロッパー モード」をオンにします。' '[First setup 3] Turn on Developer mode on the extension management page.')
    Write-Host (T '【初回4】「展開して読み込み／パッケージ化されていない拡張機能を読み込む」をクリック。' '[First setup 4] Click Load unpacked.')
    Write-Host (T '【初回5】下部の「フォルダー」ボックスへCtrl+Vでパスを貼り付け → 右下の「フォルダーの選択」をクリック。' '[First setup 5] Paste the copied path into the Folder box with Ctrl+V > click Select Folder at the bottom right.')
    Write-Host (T 'フォルダーボックスがない場合：上部のアドレス欄（Ctrl+L）→ Ctrl+V → Enter → フォルダーの選択。' 'If there is no Folder box: top address bar (Ctrl+L) > Ctrl+V > Enter > Select Folder.')
    Write-Host (T '【更新】登録済み拡張機能の再読み込みボタンを押してください。' '[Update] Click Reload on the installed extension.')
    Write-Host (T '以前別の場所から登録した場合は、古い登録を削除して上記の読み込み先を登録してください。' 'If you previously loaded a different folder, remove that extension and load the folder shown above.')
    Write-Host (T 'GDHの機械情報検索画面も再読み込みし、右下の「拡張検索」を押してください。' 'Reload the GDH machine search page and click the extension search button at the bottom right.')
    Write-Host (T '保存先のExtensionフォルダーは移動・削除しないでください。' 'Do not move or delete the installed Extension folder.')
    Show-ChangeSummary
    Read-Host (T 'Enterキーで終了' 'Press Enter to close') | Out-Null
    exit 0
} catch {
    Write-Host (T "導入を完了できませんでした：$($_.Exception.Message)" "Setup could not complete: $($_.Exception.Message)") -ForegroundColor Red
    Write-Host (T '手動で導入する場合は、同梱の「はじめに.txt」を参照してください。' 'For manual installation, see the included START_HERE.txt (Japanese / English).')
    Show-ChangeSummary
    exit 1
}

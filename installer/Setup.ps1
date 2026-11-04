[CmdletBinding()]
param(
    [ValidateSet('Edge', 'Chrome')][string]$Browser,
    [switch]$PrepareOnly
)
$ErrorActionPreference = 'Stop'
try {
    $source = Join-Path $PSScriptRoot 'GDH_Search_Extension'
    $manifestPath = Join-Path $source 'manifest.json'
    if (!(Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw '配布ファイルが不足しています。ZIPをすべて展開してから実行してください。' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($manifest.name -ne 'GDH 機械情報 拡張検索' -or $manifest.manifest_version -ne 3) { throw '拡張機能の種類を確認できません。' }
    if (!$env:LOCALAPPDATA) { throw 'ユーザーの保存先を確認できません。' }
    $base = Join-Path $env:LOCALAPPDATA 'GDH_Search'
    $target = Join-Path $base 'Extension'
    New-Item -ItemType Directory -Path $base -Force | Out-Null
    if ((Get-Item -LiteralPath $base).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw '配置先にリンクフォルダーは使用できません。' }
    $stage = Join-Path $base ('Staging-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $stage | Out-Null
    Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $stage -Recurse -Force
    $stagedManifest = Get-Content -LiteralPath (Join-Path $stage 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($stagedManifest.version -ne $manifest.version) { throw '配置ファイルの確認に失敗しました。' }
    # All directory moves remain inside the dedicated per-user installation root.
    $resolvedBase = [IO.Path]::GetFullPath($base).TrimEnd('\') + '\'
    foreach ($folder in @($target, $stage)) {
        if (![IO.Path]::GetFullPath($folder).StartsWith($resolvedBase, [StringComparison]::OrdinalIgnoreCase)) { throw '配置先の検証に失敗しました。' }
    }
    $backup = $null
    if (Test-Path -LiteralPath $target) {
        if ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw '既存の保存先にリンクフォルダーは使用できません。' }
        $existingManifest = Join-Path $target 'manifest.json'
        if (!(Test-Path -LiteralPath $existingManifest)) { throw '既存の保存先が本ツールのフォルダーではありません。配置を中止しました。' }
        $existing = Get-Content -LiteralPath $existingManifest -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($existing.name -ne $manifest.name) { throw '既存の保存先が別の拡張機能です。配置を中止しました。' }
        $backup = Join-Path $base ('Backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
        Move-Item -LiteralPath $target -Destination $backup
    }
    try { Move-Item -LiteralPath $stage -Destination $target }
    catch {
        if ($backup -and !(Test-Path -LiteralPath $target)) { Move-Item -LiteralPath $backup -Destination $target }
        throw
    }
    Write-Host "配置完了：バージョン $($manifest.version)" -ForegroundColor Green
    Write-Host "読み込み先：$target"
    if ($backup) { Write-Host "更新前のバックアップ：$backup" }
    if ($PrepareOnly) { exit 0 }
    if (!$Browser) {
        $choice = Read-Host '使用するブラウザーを選択してください（1: Edge / 2: Chrome）'
        if ($choice -eq '1') { $Browser = 'Edge' } elseif ($choice -eq '2') { $Browser = 'Chrome' } else { throw '1または2を入力して、もう一度実行してください。ファイルの配置は完了しています。' }
    }
    $paths = if ($Browser -eq 'Edge') {
        @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe")
    } else {
        @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
    }
    $exe = $paths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (!$exe) { throw "$Browser が見つかりません。ブラウザーの拡張機能管理画面を手動で開いてください。" }
    try { Set-Clipboard -Value $target; Write-Host '読み込み先をクリップボードにコピーしました。' } catch { Write-Host 'パスをコピーできませんでした。上の読み込み先を手動で指定してください。' }
    $url = if ($Browser -eq 'Edge') { 'edge://extensions/' } else { 'chrome://extensions/' }
    Start-Process -FilePath $exe -ArgumentList $url
    Write-Host ''
    Write-Host '【初回】開発者モードをオン → 展開して読み込み → パスを貼り付けてフォルダーを選択。'
    Write-Host '【更新】登録済み拡張機能の再読み込みボタンを押してください。'
    Write-Host '以前別の場所から登録した場合は、古い登録を削除して上記の読み込み先を登録してください。'
    Write-Host 'GDHの機械情報検索画面も再読み込みし、右下の「拡張検索」を押してください。'
    Write-Host '保存先のExtensionフォルダーは移動・削除しないでください。'
    Read-Host 'Enterキーで終了' | Out-Null
    exit 0
} catch {
    Write-Host "導入を完了できませんでした：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host '手動で導入する場合は、同梱の「はじめに.txt」を参照してください。'
    exit 1
}

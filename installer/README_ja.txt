GDH Search 導入・更新（Windows）

今回
1. ZIPをすべて展開し、Install.batを実行。
2. 開いたブラウザーで本拡張機能の ↻ を押す。
3. GDH画面でF5。

次回から
デスクトップの「GDH Update」をダブルクリックするだけで、最新版を取得・配置します。
その後、本拡張機能の ↻ とGDH画面のF5を行ってください。
ショートカットがない場合：%LOCALAPPDATA%\GDH_Search\Update.bat
通信・照合に失敗した場合は配置を開始しません。旧版はBackup-*に保持します。

初回のみ
開発者モード → 展開して読み込み → コピーされた配置先を選択。
配置先：%LOCALAPPDATA%\GDH_Search\Extension
ブラウザーへの登録・有効化は手動です。管理者権限は不要です。
以前別の配置先で登録した場合は、初回のみ上記の配置先へ登録し直してください。

ブラウザー
前回の選択 → 起動中の1種類 → 既定ブラウザー → 唯一のインストール先、の順で自動選択。
判別できない場合だけ、1（Edge）または2（Chrome）を入力します。
切り替える場合：powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Setup.ps1 -Browser Chrome
Edgeにする場合は末尾を -Browser Edge にします。選択は次回から保持されます。
ブラウザープロファイルとGDH画面は、普段使用しているものを選んでください。

手動で管理画面を開く場合：edge://extensions/ または chrome://extensions/
本ツールはベータ版です。GDHの標準機能ではありません。
本番の通常取得は引き続きCSV方式です。

GDH Search 導入・更新（Windows）

今回
1. ZIPをすべて展開し、Install.batを実行。
2. 開いたブラウザーで本拡張機能の ↻ を押す。
3. GDH画面でF5。

GitHubから更新
ポップアップの「GitHubから更新」または次のURLで最新版を取得します。
https://github.com/yoshidak1121-cmd/GDH_search/releases/latest/download/GDH_Search_Setup.zip
バージョン番号の選択は不要です。展開後Install.batを実行し、↻ → GDHでF5。
デスクトップにファイルは作成しません。以前本ツールが作った未変更の「GDH Update」は削除します。
旧版はBackup-*に保持します。ブラウザーへの反映は手動です。

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

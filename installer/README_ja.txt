GDH Search 自動更新（Windows / Edge・Chrome）

最初の1回
1. 最新版Setup ZIPをすべて展開し、Install.batを実行。
2. 開発者モードをオンにし、本拡張機能の ↻ を押す。権限確認が出た場合は確認する。
3. GDHでF5。ポップアップの「更新・設定」からヘルパーの接続を確認できます。

次回から
起動時に「最新版があります。バージョンアップしますか？」と表示されたら「はい」。
最新版の取得・SHA-256照合・一式の置換・拡張機能の再読み込み・起動元GDH画面のF5相当まで自動で行います。
更新中に別ページへ移動したGDHタブは再読み込みしません。

Windows更新ヘルパー
ブラウザーからの承認済み更新指示だけを受け付ける小さな補助プログラムです。常駐しません。
%LOCALAPPDATA%\GDH_Search に配置し、Windowsの現在のユーザーのChrome／Edge NativeMessagingHostsに登録します。
管理ポリシー・ブラウザープロファイル・恒久的な実行ポリシーを変更しません。デスクトップにファイルを作りません。
取得元は yoshidak1121-cmd/GDH_search の正式リリースに固定し、実データやGDH認証情報は送りません。
古いアプリ内ファイルは新フォルダーへの置換で除き、旧版はBackup-*に保持します。
企業のポリシーでヘルパーが許可されない場合は、従来の手動更新を利用してください。

手動更新・初回登録
https://github.com/yoshidak1121-cmd/GDH_search/releases/latest/download/GDH_Search_Setup.zip
初回登録は「展開して読み込み」で %LOCALAPPDATA%\GDH_Search\Extension を指定。
以前別の場所から登録した場合は、この配置先へ登録し直してください。
管理画面：edge://extensions/ または chrome://extensions/
案内はポップアップの「更新・設定」にあり、ブラウザー公式の説明へも進めます。
本ツールはベータ版です。GDHの標準機能ではありません。通常の取得はCSV方式を維持します。

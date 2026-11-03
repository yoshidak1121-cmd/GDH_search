# Chrome / Edge 拡張機能の導入

配布ファイル：`GDH_Search_Extension_v1.4.0.zip`

1. ZIPを展開し、`GDH_Search_Extension` フォルダーを残します。
2. Edgeは `edge://extensions`、Chromeは `chrome://extensions` を開き、開発者モード（デベロッパーモード）を有効にします。
3. 「展開して読み込み」または「パッケージ化されていない拡張機能を読み込む」で、`manifest.json` がある `GDH_Search_Extension` フォルダーを選択します。
4. ログイン済みのGDH機械情報検索画面を再読み込みします。
5. 右下の「拡張検索」を押します。ツールバーの拡張機能からも開閉できます。
6. 「データ取得」を押し、「CSVファイルを出力します。よろしいですか？」を確認します。圧縮なしのCSVをダウンロードし、検索へ反映します。

ZIPをそのまま選択するのではなく、展開したフォルダーを指定してください。アンインストールはブラウザの拡張機能管理画面から行えます。

## 項目別検索

CSV取込後に「項目別条件」を開きます。契約タイプはチェックボックス、販売会社はプルダウン、機械メーカーなどは入力候補から選べます。ほかのCSV列は「項目を追加」で表示してください。

同じ項目で複数選ぶとOR、異なる項目同士とキーワード条件はANDです。候補を選んだら「検索」を押します。「空欄も選択」だけを選べば空欄のみを検索できます。日付・月数の範囲指定も使えます。

拡張機能を更新する場合は、以前と同じ展開先のファイルを更新し、拡張機能管理画面の再読み込みボタンを押してからGDHページを再読み込みしてください。別のフォルダーを追加すると二重登録になるため、以前の拡張機能を更新してください。

## 動作範囲

- 提供された `global-service.fa-cnc.idc-t.melco.co.jp` の `/cncservice/` 配下だけで動作します。
- GDH本体へのファイル設置は不要です。閲覧中のページに拡張検索ボタンと検索画面を追加します。
- 機械情報検索フォーム `#frmmain` がある画面で使います。GDH側の現在の検索条件でCSVを出力します。
- ZIP選択は圧縮なしに固定し、CSV出力確認だけを表示します。
- CSVはブラウザ内で処理します。localStorage、IndexedDB、外部サーバーへ保存しません。
- 「閉じる」またはGDHページの再読み込みで取り込んだデータは破棄されます。ダウンロードしたCSVは通常のダウンロード先に残ります。
- CSV取得中は閉じる操作を抑止します。取得失敗時は既存の検索データを維持します。
- Webストアへの登録・署名配布は行っていません。導入先のブラウザへの読み込みと本番接続確認が必要です。

## 検証

Edge 156の独立したテストプロファイルに実際のManifest V3パッケージを読み込み、模擬GDHページで取得・検索・ダウンロードを検証しました。192,836行・約59MBの架空CSVの受け渡しも確認しています。GDH本番に通信するテストは行っていません。

## 開発者向けビルド

`node scripts/build-extension.cjs` を実行すると `dist/GDH_Search_Extension` を生成します。ビューアのHTML・CSS・Worker・JavaScriptは既存のindex.htmlから生成し、インライン実行を使いません。referenceの実データはコピーしません。

テストはPlaywrightが利用できる環境で `node tests/extension.cjs` を実行します。既定はテスト用Chromium、`TEST_EXTENSION_CHANNEL=msedge` でEdgeを指定できます。HTTP(S)通信はすべてテスト内で処理し、GDH本番へ通信しません。

参考：[Chrome公式の拡張機能読み込み手順](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)、[拡張機能のCSP](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)。

# GDH Machine Search - Manual installation / 手動導入

Windows one-time setup: extract the latest Setup ZIP, run **Install.bat**, keep Developer mode enabled, reload the extension and press F5 on GDH. This registers the per-user native update helper. Later startup prompts need only **Yes**. **Updates and setup** provides Edge/Chrome instructions. No desktop files are created.

Windows：今回だけ最新版Setup ZIPの **Install.bat** でヘルパー登録 → 開発者モードをオン → 拡張機能の ↻ → GDHでF5。次回からは起動時の確認で **はい** を選ぶと自動更新・再読み込みまで行います。**更新・設定** からブラウザー別の案内を確認できます。デスクトップへの配置はありません。

## English quick start

For Windows, Microsoft Edge or Google Chrome. This is the manual extension package.
For guided file preparation, use `GDH_Search_Setup_v1.20.1.zip` and read `START_HERE.txt`.

1. Extract the ZIP and keep `GDH_Search_Extension` in a permanent location.
2. Open `edge://extensions/` or `chrome://extensions/` in the browser/profile you use for GDH.
3. Enable **Developer mode**, click **Load unpacked**, and select the folder containing `manifest.json`.
4. Confirm that **GDH 機械情報 拡張検索** is enabled. Its registered name is Japanese.
5. Reload the GDH machine information search page and click **Search** / **拡張検索** at the bottom right.
6. Select English in the search screen. Use **Get data from GDH** or **Load local data**, then **Search**.

Updates: replace files in the same folder, click **Reload** for the extension, check the version,
then reload GDH and retrieve the data again. Downloading the ZIP alone does not update it.

Supported environment: `https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/`.
Separate regional GDH URLs are not supported. GDH access is required; company policies may restrict installation.
CSV values are not translated. CSV data is processed locally; downloaded CSV files remain on the PC.
This is a personally developed beta extension, not a standard GDH feature. No guarantee of operation or support is provided.
For independent development of a similar extension, consult Yoshida, NC Strategy.

## 日本語

手順案内付きの配布ZIPは `GDH_Search_Setup_v1.20.1.zip` です。`START_HERE.txt` から開始します。
手動導入は以下を参照してください。海外拠点の別URLには対応していません。

# Chrome / Edge 拡張機能の導入

Windows用の導入支援パッケージも提供します。`GDH_Search_Setup_v1.20.1.zip` をすべて展開し、`Install.bat` を実行してください。配置・更新を補助し、最後の登録操作は手動で行います。詳しくは [READMEの導入支援手順](README.md#導入支援batを使うwindows)および同梱の「START_HERE.txt」を参照してください。

配布ファイル：`GDH_Search_Extension_v1.20.1.zip`

1. ZIPを展開し、`GDH_Search_Extension` フォルダーを残します。
2. Edgeは `edge://extensions`、Chromeは `chrome://extensions` を開き、開発者モード（デベロッパーモード）を有効にします。
3. 「展開して読み込み」または「パッケージ化されていない拡張機能を読み込む」で、`manifest.json` がある `GDH_Search_Extension` フォルダーを選択します。
4. ログイン済みのGDH機械情報検索画面を再読み込みします。
5. 右下の「拡張検索」を押します。ツールバーの拡張機能からも開閉できます。
6. 「GDHからデータ取得」を押し、「CSVファイルを出力します。よろしいですか？」を確認します。圧縮なしのCSVをダウンロードし、検索へ反映します。

ZIPをそのまま選択するのではなく、展開したフォルダーを指定してください。アンインストールはブラウザの拡張機能管理画面から行えます。

## 7項目の検索

機械シリアル、NCシリアル、契約タイプ、機械メーカー、エンドユーザー、輸出国、輸入国の順に、左が項目名・右が入力欄になるよう表示します。行間を詰めた表示で、検索ボタンは入力欄の下にあります。一致方法や空欄指定は「詳細条件」で開けます。候補はCSVを読み込むたびに更新します。同じ項目内はOR、項目同士はANDです。条件を設定して「この条件で検索」を押します。

エンドユーザーは、入力語で全半角・かな・空白・法人格略記を吸収する検索ができます。候補を選ぶとその元表記との完全一致になり、類似候補は自動で選択されません。元データの名寄せや書き換えはしません。

拡張機能の更新は同じ展開先のファイルを更新し、管理画面の再読み込みボタンを押してからGDHページも再読み込みしてください。

## 表示言語

右上の「言語 / Language」で日本語／Englishを選択できます。検索条件・読み込んだCSV・表示結果を保持して切り替えます。CSV内の値は元の表記を維持します。ポップアップにも言語選択があります。

GDHのCSVは「GDHからデータ取得」、このPCのCSVファイルは「ローカルからデータ取得」で読み込みます。

## 複数値・重複

カンマで連結されたメーカー名・シリアル・国などは、分割した各値で検索できます。該当する行には色付きの「重複あり」を表示し、詳細で元のセル値も確認できます。同一NCシリアルが別行にある場合も表示します。項目間の値の対応関係を推定した行の作成は行いません。

「詳細条件」を開いて「重複ありのみ表示」をチェックし、検索すると重複対象の行だけを表示します。通常の項目条件とも併用できます。条件クリア・CSV再読込で解除します。

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

画面上部に「本画面は個人が作成した拡張画面であり、GDHの標準機能ではありません。ベータ版のため、動作保証およびサポートは提供していません。」「同様の拡張画面の独自制作をご希望の場合は、NC戦略 吉田までご相談ください。」を表示します。

GDHからの取得中のメッセージは取得ボタン直下に表示します。通常30秒〜1分かかります。5分以上動きがない場合はGDHからCSVを手動でダウンロードし、「ローカルからデータ取得」で読み込んでください。通信エラーが先に表示された場合も、手動取得へ切り替えられます。
Retrieval status appears below Get data from GDH. Retrieval usually takes 30 seconds to 1 minute. If there is no activity for more than 5 minutes, download the CSV manually and use Load local data. You may also switch to manual retrieval if a connection error appears earlier.

IDで終わる列を含め、CSVの全項目を保持します。現在の33列CSVは33列すべてを読み込み、詳細表示・全項目検索でも利用できます。元CSVは変更しません。
All CSV columns, including those ending in ID, are retained. All 33 columns in the current CSV remain available for record details and all-column search. Original CSV files are unchanged.

# GDH追加画面とCSV自動取得（本番未接続）

v1.3.0ではChrome / Edgeの拡張機能としてページ内へ追加する配布形式も提供します。この形式ではGDH本体にファイルを設置する必要はありません。導入は `EXTENSION_INSTALL.md` を参照してください。以下はGDH本体への直接組み込み形式の手順を含みます。

現行GDHの画面上で以下を手動実施するとCSVが取得できると伺っています。
1. CSV出力
2. ZIP圧縮画面「取り消し」
3. 「CSVファイルを出力します」→「決定」
4. CSVをダウンロード

v1.2.0では提供HTMLの `outputcsv_run(false)` と `submitForm` を確認し、同じ出力先・圧縮なしのフォーム送信をfetchで行うアダプターを実装しました。ZIP選択ダイアログは表示せず `iszip=false` に固定し、CSV出力確認を表示します。ダイアログやダウンロードフォルダーを自動操作する処理はありません。

## 接続インターフェース

アプリ起動前（またはユーザーが「データ取得」を押す前）に、GDHホストの許可されたコードで次を定義します。

```js
// 同じGDH機械情報検索画面上で、gdh-export.jsを読み込んだ後に設定する場合。
window.GDH_CSV_EXPORT_ADAPTER = window.createGdhCsvExportAdapter({
  form: document.getElementById('frmmain')
});
```


上記はビューアを同じwindowで動かす場合です。iframeの場合は下記の `sourceForm` を使います。リファレンスHTMLのパラメーター値・セッション・顧客情報をコードに固定していません。

## 連携前チェック

- データ出力APIのHTTPメソッド、URL、リクエストパラメータ
- エクスポート対象範囲、検索条件、ページ数の影響（全件出力か）
- 認証セッション・CSRF・CORSとGDH画面の同一オリジン可否
- CSV Content-Type/Content-Disposition、文字コード、圧縮の有無
- 権限、監査ログ、出力上限・通信時間制限
- GDH側の将来的なCSV列増減時の運用

CSV取得に失敗した場合、ビューアは以前読み込んだ検索元データを保持し、エラーを表示します。再取得に成功するまで既存の検索機能は動作します。

## v1.1.0：GDH向け埋め込み画面

提供ファイルは `index.html` と `gdh-embed.js` です。これは一般的な同一オリジンiframeの接続口であり、GDH固有の拡張APIではありません。GDH本番のメニュー・設定・ファイルには変更を加えていません。

### GDH管理者が確認する事項

1. 正式な画面追加手順、表示先となるDOM要素、配置可能なファイルURLを確認する。
2. GDHと同じオリジンにファイルを配置し、下記の引数へ確認済みURLを渡す。
3. 既存のCSP、iframe許可、ダウンロード許可、認証・認可との整合性を確認する。このHTMLにはインラインscript/styleとBlob Workerがあるため、配置先のポリシーによっては外部ファイル化などの追加対応が必要。CSPを一律解除しない。
4. CSV取得は既存の正規処理を `exportCsv` として渡す。未指定ならCSVの手動選択を使用できる。
5. 導入先で実CSV、通信失敗、権限不足、大容量時のメモリを確認する。

### 呼び出し例

以下は呼び出し形式です。引数はGDH側で確認した実要素・実URL・正規出力関数を渡してください。架空のGDHエンドポイントは指定しません。

```js
// 配置済みのgdh-embed.jsをGDHの正式な方法で読み込んだ後に実行。
function addMachineSearch(containerElement, confirmedViewerUrl, authorizedExportCsv) {
  return window.mountCncMachineViewer(containerElement, {
    viewerUrl: confirmedViewerUrl,
    exportCsv: authorizedExportCsv // 任意。省略すれば手動CSV読込のみ。
  });
}
```

- `containerElement`：GDH側で用意した表示領域。既存要素は消去せずiframeを追加する。
- `viewerUrl`：配置済みindex.htmlの実URL。同一オリジンのHTTP(S)のみ許可。`embedded=1` は自動付与。
- `exportCsv`：ユーザーが「データ取得」を押したときに呼ぶasync関数。CSVのBlob、成功Response、または `{ blob, fileName }` を返す。GDHの既存認証・権限を継承する実装はホスト側で行う。
- 戻り値：生成したiframe。画面を閉じる際はホスト側で `frame.remove()` できる。
- 接続関数はiframeのload完了後に設定される。親画面のBlobをビューア側のBlobとして渡す処理を含む。
- iframeをsandbox化する場合はスクリプト、同一オリジン連携、CSVダウンロードの許可設計を管理者が確認する。埋め込み側に権限昇格やGDH画面の自動操作はない。

### 確認範囲

Edge 156のローカルテストサーバーで、埋め込み表示、複合検索、親画面のCSV Blob受け渡し、同一バイトのダウンロード、別オリジンURLの拒否を検証済み。GDH固有の画面登録方法とCSP、本番での出力応答は未確認です。出力先とフォーム送信方式は提供HTMLで確認しました。

## v1.2.0：提供画面に基づくフォーム連携

### 確認した実装

`reference/機械情報 検索.html` の `outputcsv_run` は、`iszip` を設定し、CSV出力確認後に `viewcreator/dataview/list_csv` へ `#frmmain` をPOSTします。`submitForm` は `pdf=false` を設定し、ダウンロード検知用に時刻の `downloadToken` を使います。新アダプターはこの経路を使用します。対象のビュー識別子は保存HTMLの値を転記せず、現在のフォームから取得します。

### GDH側の呼び出し

GDH管理者が正式に認めた方法で、**機械情報検索画面と同じオリジン・同じ親document**に `gdh-export.js`、続いて `gdh-embed.js` を読み込みます。表示領域と配置URLは実際の設定から渡してください。

```js
function addGdhMachineSearch(containerElement, confirmedViewerUrl) {
  return window.mountCncMachineViewer(containerElement, {
    viewerUrl: confirmedViewerUrl,
    sourceForm: document.getElementById('frmmain')
  });
}
```

既存の `exportCsv` を明示した場合はその関数を優先します。GDH側の検索フォームが存在しない独立した追加ページからは、この方法で接続できません。元画面のフォームを利用できる表示領域が必要です。

### 取得動作

1. ユーザーがビューアの「データ取得」を押す。
2. GDHの `imuiConfirm`（存在しなければ標準confirm）で「CSVファイルを出力します。よろしいですか？」を確認する。取消しの場合は通信しない。
3. 生きている検索フォームから、重複名を含む検索条件・ビューID・現在のセキュリティ項目を取得する。フォーム自体は変更しない。
4. `iszip=false`、`pdf=false`、新しい `downloadToken` を設定し、HTML内の相対出力パスを現在のbaseURIで解決。同一オリジンへURLエンコード形式でPOSTする。Cookieはsame-originで引き継ぐ。
5. CSV Blobをビューアへ返す。ビューアが同じバイト列をダウンロードし、検索元を更新する。

出力対象は**現在のGDHフォームの検索条件**です。全件取得したい場合は、GDH側で必要な条件を設定してください。権限や件数上限を変更する処理はありません。

### エラーと制限

- 403などのHTTPエラー、リダイレクト、HTML／JSON／ZIP応答、空ファイルを拒否。認証切れをCSVとして扱わない。
- 既定の通信タイムアウトは120秒。`createGdhCsvExportAdapter({form, timeoutMs})` で変更可能。同時実行を抑止し、自動再送は行わない。
- 取得失敗・取消しでは既存の検索データを保持する。
- アダプターが前提とするフォーム項目が消えた場合は送信せずエラー表示する。
- 現時点では保存HTMLとローカル模擬サーバーで確認済み。本番の認証・CSRF仕様、CSP、全件出力範囲、出力上限、CSV応答ヘッダー、監査ログは本番確認が必要。GDH本体は変更していない。

### テスト

開発用Playwrightが利用できる環境で `node tests/gdh-export.cjs` を実行します。テスト用フォームとCSVだけを使い、GDH本番には接続しません。フォーム値・重複項目の保持、圧縮なしPOST、確認取消し、CSV取込とダウンロード、HTML／ZIP／権限エラー／リダイレクト／空応答、二重実行、タイムアウト、別オリジンの拒否を検証します。

# GDH追加画面とCSV自動取得（本番未接続）

現行GDHの画面上で以下を手動実施するとCSVが取得できると伺っています。
1. CSV出力
2. ZIP圧縮画面「取り消し」
3. 「CSVファイルを出力します」→「決定」
4. CSVをダウンロード

この導線はCSV形式を選択する業務フローの説明です。ブラウザDOMを自動クリックする実装は初期版には含めません。CSV取得のHTTPリクエスト/API/認証方式が確認できれば、画面操作を省略し、取得レスポンスを直接検索元へ渡します。

## 接続インターフェース

アプリ起動前（またはユーザーが「データ取得」を押す前）に、GDHホストの許可されたコードで次を定義します。

```js
// 例：データ取得APIの実際のエンドポイントが分かった後に実装する
window.GDH_CSV_EXPORT_ADAPTER = async function () {
  const response = await fetch('/[正式に確認したCSV出力パス]', {
    method: 'GET',
    credentials: 'same-origin'
  });
  if (!response.ok) throw new Error('GDH CSV export failed: ' + response.status);
  return { blob: await response.blob(), fileName: 'GDH_machine_export.csv' };
};
```

`/[正式に確認したCSV出力パス]` は仮の例であり、実在するAPIではありません。実際のCSV出力がPOSTやCSRFトークンなどを必要とする場合はGDHの正式仕様に合わせてください。APIがない場合は、正規に許可されたGDH拡張手段を検討します。

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

Edge 156のローカルテストサーバーで、埋め込み表示、複合検索、親画面のCSV Blob受け渡し、同一バイトのダウンロード、別オリジンURLの拒否を検証済み。GDH固有の画面登録方法、CSP、出力APIは未確認です。

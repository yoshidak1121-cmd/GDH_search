# GDH CSV自動取得：接続仕様（未接続）

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

/* Candidate correspondence only; never converts records or fills CSV columns. */
(function(root){
 'use strict';
 const candidates=[
  ['contract_id','契約ID','候補','PK・一意性・型は未確認。契約番号と区別する。'],
  ['contract_no','契約番号','候補','契約IDと区別し、先頭ゼロ・記号を保持する。'],
  ['contract_type','契約タイプ','候補','コードか表示名か、値の定義を確認する。'],
  ['contract_period','契約期間（月）','定義確認','月単位か未確認。単位確定前に数値変換しない。'],
  ['contract_start_date','契約開始日','候補','形式・空値・タイムゾーンを確認する。'],
  ['contract_end_date','契約終了日','候補','形式・空値・終了日の意味を確認する。'],
  ['contract_from_location_code','契約元拠点','定義確認','拠点コードとCSVの表示値の対応を確認する。'],
  ['contractor_id','契約者ID','候補','契約者名ではない。名称には別の定義・対応が必要。'],
  ['contract_notes',null,'対象外','CSV33項目に対応する列なし。備考を他項目へ流用しない。'],
  ['nc_serial_no','NCシリアル番号','候補','工作機械シリアル・NCモデルIDとは別。重複だけで契約を統合しない。'],
  ...['del_flg','ins_user_id','upd_user_id','ins_date','ins_id','ins_pgmid','upd_date','upd_id','upd_pgmid'].map(field=>[field,null,'対象外',field==='del_flg'?'削除フラグの定義は未確認。勝手に行を除外しない。':'管理項目。CSVの業務ID・業務日付へ流用しない。'])
 ].map(row=>Object.freeze({field:row[0],csv:row[1],status:row[2],note:row[3]}));
 const csvColumns=['NCシリアル番号','NCシリーズ名','NCシステム型名','工作機械シリアル番号','工作機械モデル番号','機械メーカー','サービス拠点','契約番号','契約タイプ','契約期間（月）','契約開始日','契約終了日','契約元拠点','契約者名','販売日','販売会社','機械代理店','輸出国','輸入国','機械出荷日','設置日','エンドユーザー','NCモデルID','工作機械ID','契約ID','契約者ID','販売ID','機械代理店ID','機械代理店住所ID','出荷ID','エンドユーザーID','設置先住所ID','設置ID'];
 function describe(fields=null){
  if(fields!==null&&(!Array.isArray(fields)||fields.some(f=>typeof f!=='string')))throw new TypeError('Expected field names');
  const rows=candidates.map(row=>({...row,present:fields===null?null:fields.includes(row.field)}));
  return {rows,unavailableCsv:csvColumns.filter(column=>!rows.some(row=>row.csv===column)),unexpectedFields:fields===null?[]:fields.filter(field=>!rows.some(row=>row.field===field)),candidateCount:rows.filter(row=>row.csv).length};
 }
 root.GdhContractSchema=Object.freeze({describe});
})(globalThis);

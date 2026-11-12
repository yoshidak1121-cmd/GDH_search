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
 const remainingSources=[
  ['NCシリーズ名',['ZGDDTM_NC_MODEL.nc_series_name'],'NC情報のnc_model_idとの対応は未確認。'],
  ['NCシステム型名',['ZGDDTM_NC_MODEL.nc_system_model_name','ZGDDTB_NC_INFO_RS.shipped_nc_system_model_name'],'現在のモデル名か出荷時の型名か未確定。'],
  ['工作機械シリアル番号',['ZGDDTM_MACHINERY_TOOL.machinery_tool_serial_no'],'NC情報のmachinery_tool_idとの対応は未確認。'],
  ['工作機械モデル番号',['ZGDDTM_MACHINERY_TOOL.machinery_tool_model_no'],'NC情報のmachinery_tool_idとの対応は未確認。'],
  ['機械メーカー',['ZGDDTM_CUSTOMER.customer_name','ZGDDTM_MACHINERY_TOOL.machinery_vendor_id'],'メーカーIDと顧客ID・表示名の対応は未確認。'],
  ['サービス拠点',['ZGDDTM_SERVICE_LOCATION.service_location_name','ZGDDTB_NC_INFO_RS.service_location_code'],'コードと表示名の対応は未確認。'],
  ['契約者名',['ZGDDTM_CUSTOMER.customer_name','ZGDDTB_CONTRACT_INFO.contractor_id'],'契約者IDと顧客ID・表示名の対応は未確認。'],
  ['販売日',['ZGDDTB_SALES_INFO.sales_date'],'NCシリアルによる対応・複数販売の扱いは未確認。'],
  ['販売会社',['ZGDDTB_SALES_INFO.sales_company_location_code','ZGDDTB_NC_INFO_RS.sales_company_location_code'],'どちらのコードを使うか未確定。'],
  ['機械代理店',['ZGDDTM_CUSTOMER.customer_name','ZGDDTB_SALES_INFO.machinery_dealer_id'],'代理店IDと顧客ID・表示名の対応は未確認。'],
  ['輸出国',['ZGDDTB_SHIPPING_INFO.shipping_from_country_code','ZGDDTM_COUNTRY.country_name'],'国コード・名称・複数出荷の対応は未確認。'],
  ['輸入国',['ZGDDTB_SHIPPING_INFO.shipping_to_country_code','ZGDDTM_COUNTRY.country_name'],'国コード・名称・複数出荷の対応は未確認。'],
  ['機械出荷日',['ZGDDTB_SHIPPING_INFO.machine_shipping_date'],'NCシリアルによる対応・複数出荷の扱いは未確認。'],
  ['設置日',['ZGDDTB_INSTALLATION_INFO.installation_date'],'NCシリアルによる対応・複数設置の扱いは未確認。'],
  ['エンドユーザー',['ZGDDTM_CUSTOMER.customer_name','ZGDDTB_INSTALLATION_INFO.enduser_id'],'エンドユーザーIDと顧客ID・表示名の対応は未確認。'],
  ['NCモデルID',['ZGDDTB_NC_INFO_RS.nc_model_id'],'モデルマスタのキー定義・一意性は未確認。'],
  ['工作機械ID',['ZGDDTB_NC_INFO_RS.machinery_tool_id'],'工作機械マスタのキー定義・一意性は未確認。'],
  ['販売ID',['ZGDDTB_SALES_INFO.sales_id'],'キー定義・一意性・行の粒度は未確認。'],
  ['機械代理店ID',['ZGDDTB_SALES_INFO.machinery_dealer_id'],'顧客IDとの関係は未確認。'],
  ['機械代理店住所ID',['ZGDDTB_SALES_INFO.machinery_dealer_address_id'],'顧客住所IDとの関係は未確認。'],
  ['出荷ID',['ZGDDTB_SHIPPING_INFO.shipping_id'],'キー定義・一意性・行の粒度は未確認。'],
  ['エンドユーザーID',['ZGDDTB_INSTALLATION_INFO.enduser_id'],'顧客IDとの関係は未確認。'],
  ['設置先住所ID',['ZGDDTB_INSTALLATION_INFO.installation_address_id'],'顧客住所IDとの関係は未確認。'],
  ['設置ID',['ZGDDTB_INSTALLATION_INFO.installation_id'],'キー定義・一意性・行の粒度は未確認。']
 ];
 function migration(){
  const rows=csvColumns.map(csv=>{
   const contract=candidates.find(row=>row.csv===csv),other=remainingSources.find(row=>row[0]===csv);
   return {csv,sources:contract?['ZGDDTB_CONTRACT_INFO.'+contract.field]:[...other[1]],note:contract?contract.note:other[2]};
  });
  return {rows,tables:[...new Set(rows.flatMap(row=>row.sources.map(source=>source.split('.')[0])))].sort()};
 }
 function report(result,version){
  const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=100?String(value):'—';
  const lines=['GDH getData まとめ診断 '+(/^\d+\.\d+\.\d+$/.test(version)?version:''),'対象：契約情報・1ページ目・最大100件','取得元：'+(result.source==='getData-live'?'本番':'モック'),'件数：'+count(result.summary?.count),'項目数：'+count(result.summary?.fields?.length),'検索データ未変更。全体一意性・結合・単位は未確定。','', 'キー | 空欄 | 異なる値 | 重複値 | 重複行 | 文字列以外'];
  for(const field of ['contract_id','contract_no','nc_serial_no','contractor_id']){
   const row=result.keyChecks?.find(row=>row.field===field);if(row)lines.push([field,...['blankCount','distinctCount','duplicateValues','duplicateRows','nonStringCount'].map(key=>count(row[key]))].join(' | '));
  }
  lines.push('','項目 | 空欄 | 文字列 | 数値 | その他 | 日付形式（件数）');
  for(const field of ['contract_type','contract_period','contract_start_date','contract_end_date','contract_from_location_code']){
   const row=result.fieldChecks?.find(row=>row.field===field);if(row)lines.push([field,...['blankCount','stringCount','numberCount','otherCount'].map(key=>count(row[key])),['ymdDash','ymdSlash','ymdCompact','dateTime','other'].map(key=>key+':'+count(row.dateFormats?.[key])).join(', ')].join(' | '));
  }
  lines.push('','取得元候補：33項目・'+migration().tables.length+'テーブル（名称に基づく候補のみ）。','実レコード・ID・コードの実値・URL・認証情報は含みません。');
  return lines.join('\n');
 }
 root.GdhContractSchema=Object.freeze({describe,migration,report});
})(globalThis);

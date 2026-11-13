/* Extension-only validation controls. Opening this panel never enables or runs retrieval. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const panel=$('validationPanel'),toggle=$('validationEnabled'),run=$('validationRun'),scenario=$('validationScenario'),result=$('validationResult');
 let busy=false,ready=false,latestReport=null;
 const errors={MODE_OFF:'検証モードはOFFです。ONにしてから実行してください。',PRODUCTION_DISABLED:'モック側から本番通信はできません。',WRONG_PAGE:'対象のGDHタブを開き直してください。',WRONG_TABLE:'選んだタブでZALSの契約情報テーブルを開いてください。',PAGE_NOT_READY:'契約情報テーブルを単独のタブで開いてから再度お試しください。',RPC_UNCONFIRMED:'画面の通信形式が確認済みの形式と異なります。通信せず停止しました。',NETWORK_ERROR:'GDHとの通信に失敗しました。',CONFIRM_REQUIRED:'本番読み取りの確認が必要です。',ABORTED:'読み取りを中止しました。',AUTH_REQUIRED:'認証エラーを安全に検出しました。',HTTP_ERROR:'通信エラーを安全に検出しました。',INVALID_JSON:'不正なJSONを安全に拒否しました。',INVALID_RESPONSE:'不正な応答を安全に拒否しました。',TIMEOUT:'タイムアウトを安全に検出しました。',BUSY:'検証中です。完了までお待ちください。'};
 function show(text,state=''){result.textContent=text;result.dataset.state=state;}
 function renderSchema(fields=null,keyChecks=null){
  const review=GdhContractSchema.describe(fields);
  $('schemaOverview').textContent=`getData 19項目中、CSVの対応候補は${review.candidateCount}項目。対応候補がないCSV項目は${review.unavailableCsv.length}項目です。すべて定義確認前の候補です。`;
  $('schemaRows').replaceChildren();
  for(const row of review.rows){
   const tr=document.createElement('tr');
   for(const text of [row.field,row.csv||'—',row.status+'／'+(row.present===null?'未取得':row.present?'応答あり':'今回の応答に項目なし'),row.note]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
   $('schemaRows').append(tr);
  }
  $('unavailableCsv').replaceChildren();for(const field of review.unavailableCsv){const li=document.createElement('li');li.textContent=field;$('unavailableCsv').append(li);}
  $('keyRows').replaceChildren();$('keyReviewTable').hidden=!keyChecks;
  $('keyReviewStatus').textContent=keyChecks?'本番で取得したページ内だけの集計です。空データは各件数0です。':'本番読み取り後に件数だけ表示します。ID・シリアル番号の実値は表示しません。';
  for(const row of keyChecks||[]){const tr=document.createElement('tr');for(const value of [row.field,row.blankCount,row.distinctCount,row.duplicateValues,row.duplicateRows,row.nonStringCount]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}$('keyRows').append(tr);}
 }
 function setReport(response=null){
  latestReport=response?(response.source==='getData-batch'?GdhMigrationCatalog.report(response,chrome.runtime.getManifest().version):GdhContractSchema.report(response,chrome.runtime.getManifest().version)):null;
  $('reviewText').value=latestReport||'';$('reviewText').hidden=true;$('copyStatus').textContent='';
 }
 function controls(){
  $('copyReview').disabled=busy||!latestReport;
  $('batchRun').disabled=busy||!ready||!toggle.checked;
  run.disabled=!ready||busy||!toggle.checked;toggle.disabled=!ready||busy;scenario.disabled=busy;
  $('validationClose').disabled=busy;
  $('liveRefresh').disabled=busy;$('liveTab').disabled=busy;
  $('liveRun').disabled=!ready||busy||!toggle.checked||!$('liveTab').value;
  run.textContent=busy?'検証中…':scenario.value==='success'?'モック100件を検証':'選んだ内容で検証';
 }
 async function open(){
  panel.hidden=false;ready=false;controls();
  try{toggle.checked=await GDH_GETDATA_VALIDATION.enabled();ready=true;show(toggle.checked?'検証モードはONです。内容を選んで検証してください。':'検証モードはOFFです。ONにしてから実行してください。');}
  catch{show('設定を読み込めませんでした。検証タブを開き直してください。','error');}
  controls();toggle.focus();
 }
 toggle.addEventListener('change',async()=>{
  const value=toggle.checked;ready=false;controls();
  try{await GDH_GETDATA_VALIDATION.setEnabled(value);show(value?'検証モードはONです。「検証」ボタンを押してください。':'検証モードはOFFです。');}
  catch{toggle.checked=!value;show('設定を保存できませんでした。再度お試しください。','error');}
  finally{ready=true;controls();}
 });
 scenario.addEventListener('change',controls);
 run.addEventListener('click',async()=>{
  if(busy||run.disabled)return;
  busy=true;controls();renderSchema();setReport();$('validationFields').hidden=true;$('validationFieldList').replaceChildren();show('架空データを検証しています…');
  try{
   const {summary}=await GDH_GETDATA_VALIDATION.run({scenario:scenario.value});
   renderSchema(summary.fields);
   setReport({source:"getData-mock",summary});
   show(`${summary.valid?'検証成功':'項目を確認してください'}：${summary.count}件・${summary.fields.length}項目\n${summary.count===0?'空データを正常に処理しました。':'件数と項目名を確認しました。'}\nGDHへの通信は行っていません。`,summary.valid?'success':'error');
   for(const field of summary.fields){const li=document.createElement('li');li.textContent=field;$('validationFieldList').append(li);}
   $('validationFields').hidden=!summary.fields.length;
  }catch(error){show((errors[error.code]||'検証に失敗しました。設定を確認してください。')+'\nGDHへの通信は行っていません。','error');}
  finally{busy=false;controls();}
 });
 $('liveTab').addEventListener('change',controls);
 $('liveRefresh').addEventListener('click',async()=>{
  busy=true;controls();
  try{
   const response=await chrome.runtime.sendMessage({type:'GDH_GETDATA_TABS'});
   if(!response?.ok)throw Error();
   $('liveTab').replaceChildren(new Option('契約情報を開いているタブを選択',''));
   for(const tab of response.tabs)$('liveTab').append(new Option(tab.label+'・タブ '+tab.id,String(tab.id)));
   if(response.tabs.length===1)$('liveTab').value=String(response.tabs[0].id);
   show(response.tabs.length?'GDHタブを選んで「本番100件を読み取り」を押してください。':'GDHタブが見つかりません。同じブラウザで契約情報を開いてください。');
  }catch{show('GDHタブの一覧を取得できませんでした。','error');}
  finally{busy=false;controls();}
 });
 $('liveRun').addEventListener('click',async()=>{
  if(busy||$('liveRun').disabled)return;
  if(!window.confirm('選択したGDHタブの契約情報を、現在の検索条件で1ページ目・最大100件読み取ります。実行しますか？'))return;
  busy=true;controls();renderSchema();setReport();$('validationFields').hidden=true;$('validationFieldList').replaceChildren();show('GDHから最大100件を読み取り中です…');
  try{
   const response=await chrome.runtime.sendMessage({type:'GDH_GETDATA_READ',tabId:Number($('liveTab').value),confirmed:true});
   if(!response?.ok){show(errors[response?.code]||'本番読み取りに失敗しました。GDH画面を確認してください。','error');return;}
   const {summary}=response;
   renderSchema(summary.fields,response.keyChecks);
   setReport(response);
   show(`本番読み取り${summary.valid?'成功':'：項目を確認してください'}：${summary.count}件・${summary.fields.length}項目\n検索データは変更していません。`,summary.valid?'success':'error');
   for(const field of summary.fields){const li=document.createElement('li');li.textContent=field;$('validationFieldList').append(li);}
   $('validationFields').hidden=!summary.fields.length;
  }catch{show('接続が切れました。自動再送は行いません。GDHの状態を確認してください。','error');}
  finally{busy=false;controls();}
 });
 $('batchRun').addEventListener('click',async()=>{
  if(busy||$('batchRun').disabled)return;
  if(!window.confirm('開いている対象テーブル（最大10種類）を各100件まで読み取り、候補キーを一時メモリで照合します。実行しますか？'))return;
  busy=true;controls();setReport();$('batchStatus').textContent='一括点検中…';
  try{
   const response=await chrome.runtime.sendMessage({type:'GDH_GETDATA_BATCH',confirmed:true});
   if(!response?.ok){show(errors[response?.code]||'一括点検に失敗しました。','error');return;}
   setReport(response);const loaded=response.tables.filter(row=>row.ok).length;
   $('batchStatus').textContent=`${loaded}/10テーブルを取得。未取得・複数タブ・候補関係はまとめ診断に表示します。`;
   $('reviewText').value=latestReport;$('reviewText').hidden=false;show('一括点検が完了しました。「診断結果をまとめてコピー」で結果を共有できます。');
  }catch{show('一括点検が中断されました。自動再送は行いません。','error');}
  finally{busy=false;controls();}
 });
 $('validationClose').addEventListener('click',async()=>{
  if(busy)return;
  ready=false;controls();
  try{await GDH_GETDATA_VALIDATION.setEnabled(false);toggle.checked=false;show('検証モードをOFFにしました。タブを閉じて検索画面に戻れます。');$('validationFields').hidden=true;document.querySelector('h1').focus();}
  catch{show('OFFにできませんでした。再度お試しください。','error');}
  finally{ready=true;controls();}
 });
 const migration=GdhContractSchema.migration();
 $('migrationOverview').textContent=`33項目の取得元候補は契約情報を含む${migration.tables.length}テーブル。追加の取得・結合・変換は行いません。`;
 for(const row of migration.rows){const tr=document.createElement('tr');for(const text of [row.csv,row.sources.join(' / '),row.note]){const td=document.createElement('td');td.textContent=text;tr.append(td);}$('migrationRows').append(tr);}
 $('copyReview').addEventListener('click',async()=>{
  if(!latestReport||busy)return;
  try{await navigator.clipboard.writeText(latestReport);$('copyStatus').textContent='コピーしました。この結果だけを共有できます。';}
  catch{$('reviewText').hidden=false;$('reviewText').focus();$('reviewText').select();$('copyStatus').textContent='表示された結果をCtrl+Cでコピーしてください。';}
 });
 renderSchema();
 open();
})();

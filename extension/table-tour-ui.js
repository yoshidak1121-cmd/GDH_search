'use strict';
{
 const $=id=>document.getElementById(id),key='gdhTableTourReport';
 const labels={completed:'調査終了',partial:'調査終了（一部未確認）',running:'調査中',stopped:'停止しました',interrupted:'画面移動・接続切断で停止しました',TIMEOUT:'読み取りが時間切れです',AUTH_REQUIRED:'認証・権限を確認してください',HTTP_ERROR:'読み取りが拒否されました',NETWORK_ERROR:'通信できませんでした',SELECT_ZALS:'テーブル一覧でZALSを選んでください',CLEAR_FILTER:'一覧の検索欄を空欄にしてください',LIST_MISMATCH:'確認済みの16テーブルと一覧が一致しません',WRONG_PAGE:'GDHのテーブル一覧を選んでください',BUSY:'別の調査が動作中です',SCHEMA_MISMATCH:'テーブル項目の構造が異なります',RPC_UNCONFIRMED:'読み取り経路を確認できません',PAGE_NOT_READY:'GDH標準の読取処理が利用できません',INVALID_RESPONSE:'応答を安全に解析できません',WRONG_TABLE:'想定したテーブル画面ではありません',RESPONSE_LIMIT:'応答サイズの上限です',STOPPED:'停止しました',EXPIRED:'実行期限が切れました',INVALID_REQUEST:'調査条件が一致しません'};
 let report=null,running=false,busy=false,tabId=null,session=null,generation=0,saveQueue=Promise.resolve();
 function controls(){for(const id of ['find','target'])$(id).disabled=running||busy;$('start').disabled=running||busy||!$('target').value;$('stop').disabled=!running;for(const id of ['copy','download'])$(id).disabled=!report;$('clear').disabled=running||busy||!report;}
 function draw(){controls();$('results').replaceChildren();if(!report)return;$('status').textContent=(labels[report.status]||report.status)+`（${report.tables.length}/16）`;for(const row of report.tables){const li=document.createElement('li');li.textContent=row.table+'：'+(row.ok?`${row.count}件・${row.columns.length}カラム／ソース候補${row.sourceReview.functions.length}件`:(labels[row.code]||'未確認'));$('results').append(li);}}
 async function save(){const value=JSON.parse(JSON.stringify(report));saveQueue=saveQueue.then(()=>chrome.storage.local.set({[key]:value})).catch(()=>{$('saved').textContent='自動保存できません。結果をファイルに保存してください。';});await saveQueue;}
 async function bounded(p){let timer;try{return await Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('interrupted')),25000);})]);}finally{clearTimeout(timer);}}
 async function execute(command,args={}){const r=await bounded(chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:inspectGdhTables,args:[command,{...args,session}]}));return r?.[0]?.result||{ok:false,code:'interrupted'};}
 async function stop(status){if(!running)return;running=false;busy=true;generation++;report.status=status;draw();try{await execute('stop');}catch{}busy=false;draw();await save();}
 $('find').onclick=async()=>{busy=true;controls();try{const tabs=await chrome.tabs.query({url:'https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/tablemaintenance/table_list*'});$('target').replaceChildren(new Option('対象を選択',''));for(const [i,t] of tabs.entries())$('target').append(new Option('テーブル一覧 '+(i+1),String(t.id)));if(tabs.length===1)$('target').value=String(tabs[0].id);if(!tabs.length)$('status').textContent='GDHのテーブル一覧を開いてください。';}finally{busy=false;controls();}};
 $('target').onchange=controls;
 $('start').onclick=async()=>{
  if(running||busy)return;running=true;busy=true;session=crypto.randomUUID();tabId=Number($('target').value);const run=++generation;
  report={format:'gdh-table-tour-v1',extensionVersion:chrome.runtime.getManifest().version,status:'running',tables:[],notes:['ZALSの確認済み16テーブル、各先頭100件以内の読み取り専用調査。','管理画面の保存処理を業務画面の書き込み経路には使用しません。','実値・認証値・URLは保存しません。DB型・制約・採番・更新条件は追加確認が必要です。']};draw();
  try{
   await bounded(chrome.scripting.executeScript({target:{tabId},world:'MAIN',files:['source-inspector.js']}));if(run!==generation)return;
   const start=await execute('start',{catalog:GDH_TABLE_CATALOG});if(run!==generation)return;if(!start.ok)throw Error(start.code);busy=false;draw();const expires=Date.now()+600000;
   for(const table of start.tables){
    if(run!==generation)return;if(Date.now()>expires)throw Error('EXPIRED');$('status').textContent=`読取中：${table}（${report.tables.length}/16）`;
    const row=await execute('read',{table,deadline:Date.now()+20000});if(run!==generation)return;
    report.tables.push({table,...row});draw();await save();if(!row.ok)throw Error(row.code);
   }
   await stop(report.tables.every(r=>r.schemaMatches)?'completed':'partial');
  }catch(error){if(run===generation)await stop(labels[error.message]?error.message:'interrupted');}
 };
 $('stop').onclick=()=>stop('stopped');
 $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));$('saved').textContent='コピーしました。';}catch{$('output').hidden=false;$('output').value=JSON.stringify(report,null,2);$('output').focus();$('output').select();$('saved').textContent='Ctrl+Cでコピーしてください。';}};
 $('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='GDH_table_tour.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('clear').onclick=async()=>{if(running||busy)return;await saveQueue;await chrome.storage.local.remove(key);report=null;$('output').value='';$('output').hidden=true;$('status').textContent='記録を削除しました。';draw();};
 window.addEventListener('pagehide',()=>{generation++;running=false;if(tabId!==null)chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:inspectGdhTables,args:['stop',{session}]}).catch(()=>{});});
 (async()=>{busy=true;controls();try{const saved=await chrome.storage.local.get(key);if(saved[key]?.format==='gdh-table-tour-v1'){report=saved[key];draw();$('status').textContent='前回の保存結果です。自動再開しません。';}}finally{busy=false;controls();}})();
}

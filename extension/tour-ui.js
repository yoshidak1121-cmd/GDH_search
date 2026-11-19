'use strict';
{
 const $=id=>document.getElementById(id),pattern='https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/*',key='gdhFormTourReport';
 const explanations={running:'巡回中',completed:'巡回終了',partial:'巡回終了（一部未確認）',stopped:'停止しました',interrupted:'接続が切れたため停止しました',WRONG_SCREEN:'開始画面の選択とGDHの画面を確認してください',WRONG_PAGE:'GDHの画面を選んでください',CLOSE_DIALOG_FIRST:'開いている参照画面を閉じてから開始してください',ALREADY_RUNNING:'この画面では別の調査が実行中です',SESSION_LOST:'画面が移動したため停止しました','open-timeout':'画面が開きません。ポップアップ制限または未対応の構造です','close-unrecognized':'閉じるボタンを識別できないため停止しました','unexpected-dialog':'想定外の画面で停止しました','ambiguous-dialog':'複数の画面が開いたため停止しました','user-interaction':'GDHの手動操作を検出したため停止しました','form-changed':'元の入力内容に変化があったため停止しました','submit-blocked':'フォーム送信を止め、巡回を停止しました','controller-lost':'調査画面との接続が切れたため停止しました','time-limit':'10分の上限で停止しました',unrecognized:'未確認（ボタンを特定できません）','no-recognized-fields':'未確認（項目を取得できません）',collected:'取得済み','collected-window':'別ウィンドウを取得済み',opening:'開いています',opened:'開きました'};
 let report=null,running=false,busy=false,session=null,generation=0,stack=[],owned=new Set(),knownTabs=new Set(),saveQueue=Promise.resolve();
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const bounded=async promise=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('interrupted')),5000);})]);}finally{clearTimeout(timer);}};
 const execute=async(tabId,func,args)=>{const result=await bounded(chrome.scripting.executeScript({target:{tabId},world:'ISOLATED',func,args}));const r=result?.[0]?.result;if(!r?.ok)throw Error(r?.code||'interrupted');return r;};
 function controls(){for(const id of ['find','target','scope'])$(id).disabled=running||busy;$('start').disabled=running||busy||!$('target').value;$('stop').disabled=!running;for(const id of ['copy','download'])$(id).disabled=!report;$('clear').disabled=running||busy||!report;}
 function draw(){controls();$('results').replaceChildren();if(!report)return;$('status').textContent=explanations[report.status]||'未対応の状態で停止しました';for(const page of report.pages){const li=document.createElement('li');li.textContent=(page.scope==='machine'?'NC情報':page.scope)+'：'+(explanations[page.status]||page.status);$('results').append(li);for(const entry of page.log||[]){const row=document.createElement('li');row.textContent='　'+entry.label+'：'+(explanations[entry.status]||entry.status);$('results').append(row);}}$('output').value=JSON.stringify(report,null,2);}
 function save(){const value=JSON.parse(JSON.stringify(report));saveQueue=saveQueue.then(async()=>{try{await bounded(chrome.storage.local.set({[key]:value}));$('saved').textContent='途中結果を保存しました。';}catch{$('saved').textContent='自動保存できません。結果をファイルに保存してください。';}});return saveQueue;}
 async function attach(tabId,scope,run){
  const record={scope,status:'running',log:[],observation:null};report.pages.push(record);
  const item={tabId,scope,record};stack.push(item);
  record.observation=(await execute(tabId,observeGdhRegistration,['start',session,scope])).report;
  if(run!==generation)throw Error('stopped');
  const engine=await execute(tabId,stepGdhFormTour,['start',session,{scope}]);record.status=engine.status;
 }
 async function finish(status){
  running=false;busy=true;generation++;report.status=status;draw();
  // No automatic close on interruption: leave the page available for inspection.
  await Promise.allSettled(stack.map(async item=>{
   await execute(item.tabId,stepGdhFormTour,['stop',session]);
   const snapshot=await execute(item.tabId,observeGdhRegistration,['stop',session]);item.record.observation=snapshot.report;
  }));
  stack=[];owned.clear();busy=false;draw();await save();
 }
 async function loop(run){
  try{
   while(running&&run===generation){
    if(Date.now()-report.startedAt>600000){await finish('time-limit');return;}
    for(const parent of stack.slice(0,-1)){
     const held=await execute(parent.tabId,stepGdhFormTour,['step',session,{expiresAt:Date.now()+2500,childPending:true}]);
     if(held.status!=='running')throw Error(held.status);
    }
    const item=stack.at(-1),r=await execute(item.tabId,stepGdhFormTour,['step',session,{expiresAt:Date.now()+2500,childDone:item.childDone===true}]);item.childDone=false;
    if(run!==generation)return;
    item.record.status=r.status;item.record.log=r.log;
    item.record.observation=(await execute(item.tabId,observeGdhRegistration,['snapshot',session])).report;
    if(run!==generation)return;
    if(r.awaiting==='form'){
     const tabs=await bounded(chrome.tabs.query({url:pattern}));
     const children=tabs.filter(t=>!knownTabs.has(t.id)&&t.openerTabId===item.tabId);
     if(children.length>1)throw Error('ambiguous-dialog');
     if(children.length===1){const child=children[0];if(child.status==='complete'){knownTabs.add(child.id);owned.add(child.id);await attach(child.id,r.label,run);}}
    }
    if(r.status!=='running'){
     if(!['completed','partial'].includes(r.status)){await finish(r.status);return;}
     item.record.observation=(await execute(item.tabId,observeGdhRegistration,['stop',session])).report;
     if(run!==generation)return;
     stack.pop();
     if(owned.has(item.tabId)){await chrome.tabs.remove(item.tabId);owned.delete(item.tabId);}
     if(!stack.length){report.status=report.pages.some(p=>p.status==='partial')?'partial':'completed';running=false;draw();await save();return;}
     stack.at(-1).childDone=true;
    }
    draw();await save();await sleep(500);
   }
  }catch(error){if(run===generation)await finish(explanations[error.message]?error.message:'interrupted');}
 }
 $('find').onclick=async()=>{busy=true;controls();try{const tabs=await bounded(chrome.tabs.query({url:pattern}));$('target').replaceChildren(new Option('対象を選択',''));for(const [i,t] of tabs.entries())$('target').append(new Option(`GDH ${i+1}：${t.title||'タブ'}`,String(t.id)));if(tabs.length===1)$('target').value=String(tabs[0].id);}catch{$('status').textContent='タブを取得できませんでした。';}finally{busy=false;controls();}};
 $('target').onchange=controls;
 $('start').onclick=async()=>{
  if(running||busy)return;busy=true;running=true;controls();session=crypto.randomUUID();const run=++generation;
  report={format:'gdh-form-tour-v1',sessionId:session,extensionVersion:chrome.runtime.getManifest().version,status:'running',startedAt:Date.now(),pages:[],notes:['自動操作は参照画面・新規入力画面を開く、詳細検索を展開する、閉じる操作のみ。候補選択・入力・保存はしません。','入力実値・顧客名・実ID・URL・認証値は出力しません。HTML属性は業務上の必須条件を確定するものではありません。','画面を開く際にはGDH標準の読取通信が発生します。登録APIや連動する候補の検証は対象外です。']};stack=[];owned=new Set();
  try{knownTabs=new Set((await bounded(chrome.tabs.query({}))).map(t=>t.id));await attach(Number($('target').value),$('scope').value,run);if(run!==generation)return;busy=false;draw();await save();loop(run);}
  catch(error){if(run===generation)await finish(explanations[error.message]?error.message:'interrupted');}
 };
 $('stop').onclick=()=>{if(running)finish('stopped');};
 $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(report,null,2));$('saved').textContent='コピーしました。';}catch{$('output').hidden=false;$('output').focus();$('output').select();$('saved').textContent='表示された結果をCtrl+Cでコピーしてください。';}};
 $('download').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='GDH_form_tour.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('clear').onclick=async()=>{if(running||busy)return;busy=true;controls();try{await saveQueue;await bounded(chrome.storage.local.remove(key));report=null;$('output').value='';$('output').hidden=true;$('status').textContent='記録を削除しました。';}catch{$('saved').textContent='削除できませんでした。';}finally{busy=false;draw();}};
 window.addEventListener('pagehide',()=>{for(const item of stack){chrome.scripting.executeScript({target:{tabId:item.tabId},world:'ISOLATED',func:stepGdhFormTour,args:['stop',session]}).catch(()=>{});chrome.scripting.executeScript({target:{tabId:item.tabId},world:'ISOLATED',func:observeGdhRegistration,args:['stop',session]}).catch(()=>{});}});
 (async()=>{busy=true;controls();try{const data=await bounded(chrome.storage.local.get(key));if(data[key]?.format==='gdh-form-tour-v1'){report=data[key];draw();$('status').textContent='前回保存した結果です。自動再開はしません。';}}catch{$('saved').textContent='前回の記録を取得できませんでした。';}finally{busy=false;controls();}})();
}

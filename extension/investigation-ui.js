'use strict';
{
 const $=id=>document.getElementById(id),storageKey='gdhRegistrationInvestigation';
 const pattern='https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/*';
 let latest=null,target=null,session=null,recording=false,busy=false,timer=null,polling=false,persistedKey=null,generation=0,saving=Promise.resolve();
 const messages={WRONG_PAGE:'GDHのタブを選んでください。',WRONG_SCREEN:'選んだタブで「機械情報 登録／更新」を開いてください。',ALREADY_RUNNING:'このGDHタブでは別の調査が記録中です。開始済みの調査画面から停止してください。',SESSION_LOST:'GDH画面が移動・再読み込みされ、記録が終了しました。ここまでの結果を保存します。'};
 const bounded=async(promise,ms=5000)=>{let handle;try{return await Promise.race([promise,new Promise((_,reject)=>{handle=setTimeout(()=>reject(Error('接続の応答がありません。')),ms);})]);}finally{clearTimeout(handle);}};
 function controls(){
  $('startInvestigation').disabled=busy||recording||!$('targetTab').value;
  $('stopInvestigation').disabled=busy||!recording;
  $('targetTab').disabled=busy||recording;$('findTabs').disabled=busy||recording;
  for(const id of ['copyInvestigation','downloadInvestigation'])$(id).disabled=!latest;
  $('clearInvestigation').disabled=recording||busy||!latest;
 }
 function display(){
  if(!latest){$('summary').textContent='記録はありません。';$('changes').replaceChildren();controls();return;}
  const fields=latest.current?.screens?.reduce((total,s)=>total+s.fields.length,0)||0;
  $('summary').textContent=`画面構成 ${latest.schemas.length} 件／現在の項目 ${fields} 件／操作 ${latest.events.length} 件／値の変化 ${latest.transitions.length} 件`;
  $('changes').replaceChildren();
  for(const change of latest.transitions.slice(-30)){
   const item=document.createElement('li'),action=latest.events.find(e=>e.sequence===change.afterAction);
   item.textContent=`${Math.floor(change.ms/1000)}秒：${change.label} — ${change.change==='cleared'?'空欄になった':change.change==='filled'?'値が入った':'値が変わった'}${action?'（直前：'+(action.field||'')+' '+action.action+'）':''}`;
   $('changes').append(item);
  }
  $('reportText').value=JSON.stringify(latest,null,2);controls();
 }
 function save(){
  const value=latest;
  saving=saving.then(async()=>{
   if(!value||value.sessionId+":"+value.revision===persistedKey)return;
   try{await bounded(chrome.storage.local.set({[storageKey]:value}));persistedKey=value.sessionId+":"+value.revision;$('saveStatus').textContent='途中結果をこのブラウザに保存しました。';}
   catch{$('saveStatus').textContent='自動保存できません。終了前にコピーまたはファイル保存をしてください。';}
  });return saving;
 }
 async function call(command){
  const result=await bounded(chrome.scripting.executeScript({target:{tabId:target},world:'ISOLATED',func:observeGdhRegistration,args:[command,session]}));
  const response=result?.[0]?.result;
  if(!response?.ok)throw Error(messages[response?.code]||'調査を開始・継続できませんでした。');
  return {...response.report,extensionVersion:chrome.runtime.getManifest().version};
 }
 async function finishLost(message){
  recording=false;clearInterval(timer);
  // Stop best-effort. A discarded/closed tab may no longer contain the observer.
  chrome.scripting.executeScript({target:{tabId:target},world:'ISOLATED',func:observeGdhRegistration,args:['stop',session]}).catch(()=>{});
  if(latest)latest={...latest,status:'interrupted',revision:latest.revision+1};
  $('investigationStatus').textContent=message;display();await save();
 }
 async function poll(){
  if(polling||!recording)return;polling=true;const run=generation;
  try{const result=await call('snapshot');if(run!==generation)return;latest=result;if(latest.status!=='recording'){recording=false;clearInterval(timer);$('investigationStatus').textContent='記録を終了しました。結果を共有できます。';}else $('investigationStatus').textContent=`記録中（${Math.floor(latest.elapsedMs/1000)}秒）。GDHで参照画面を開く・候補を選ぶ操作を行ってください。`;display();await save();}
  catch(error){if(run===generation)await finishLost(error.message);}
  finally{polling=false;controls();}
 }
 $('findTabs').addEventListener('click',async()=>{
  busy=true;controls();
  try{const tabs=await bounded(chrome.tabs.query({url:pattern}));$('targetTab').replaceChildren(new Option('登録画面を開いたタブを選択',''));for(const [index,tab] of tabs.entries())$('targetTab').append(new Option(`GDH ${index+1}：${tab.title||'タブ'}`,String(tab.id)));if(tabs.length===1)$('targetTab').value=String(tabs[0].id);$('investigationStatus').textContent=tabs.length?'「機械情報 登録／更新」を開いたタブを選んで開始してください。':'GDHのタブが見つかりません。同じブラウザで開いてください。';}
  catch{$('investigationStatus').textContent='タブの一覧を取得できませんでした。';}finally{busy=false;controls();}
 });
 $('targetTab').addEventListener('change',controls);
 $('startInvestigation').addEventListener('click',async()=>{
  if(busy||recording||!$('targetTab').value)return;
  busy=true;generation++;target=Number($('targetTab').value);session=crypto.randomUUID();controls();
  try{const result=await call('start');latest=result;persistedKey=null;recording=true;display();await save();$('investigationStatus').textContent='記録中。GDHの参照画面を開く・候補を選ぶ操作を行ってください。';timer=setInterval(poll,1000);}
  catch(error){$('investigationStatus').textContent=error.message;chrome.scripting.executeScript({target:{tabId:target},world:'ISOLATED',func:observeGdhRegistration,args:['stop',session]}).catch(()=>{});}
  finally{busy=false;controls();}
 });
 $('stopInvestigation').addEventListener('click',async()=>{
  if(busy||!recording)return;busy=true;generation++;recording=false;clearInterval(timer);controls();
  try{latest=await call('stop');$('investigationStatus').textContent='停止しました。結果をコピーまたはファイル保存できます。';display();await save();}
  catch(error){await finishLost(error.message);}finally{busy=false;controls();}
 });
 $('copyInvestigation').addEventListener('click',async()=>{
  if(!latest)return;const text=JSON.stringify(latest,null,2);
  try{await navigator.clipboard.writeText(text);$('saveStatus').textContent='コピーしました。この結果を共有してください。';}
  catch{$('reportText').value=text;$('reportText').hidden=false;$('reportText').focus();$('reportText').select();$('saveStatus').textContent='表示された結果をCtrl+Cでコピーしてください。';}
 });
 $('downloadInvestigation').addEventListener('click',()=>{
  if(!latest)return;const url=URL.createObjectURL(new Blob([JSON.stringify(latest,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='GDH_registration_investigation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 $('clearInvestigation').addEventListener('click',async()=>{
  if(recording||busy)return;busy=true;controls();try{await saving;await bounded(chrome.storage.local.remove(storageKey));latest=null;persistedKey=null;$('saveStatus').textContent='保存した記録を削除しました。';$('reportText').value='';$('reportText').hidden=true;display();}catch{$('saveStatus').textContent='記録を削除できませんでした。';}finally{busy=false;controls();}
 });
 window.addEventListener('pagehide',()=>{if(recording)chrome.scripting.executeScript({target:{tabId:target},world:'ISOLATED',func:observeGdhRegistration,args:['stop',session]}).catch(()=>{});});
 (async()=>{busy=true;controls();try{const data=await bounded(chrome.storage.local.get(storageKey));if(data[storageKey]?.format==='gdh-registration-observation-v1'){latest=data[storageKey];persistedKey=latest.sessionId+":"+latest.revision;display();$('investigationStatus').textContent='前回保存した結果を表示しています。調査は自動再開しません。';}}catch{$('saveStatus').textContent='前回の記録を読み込めませんでした。';}finally{busy=false;controls();}})();
}

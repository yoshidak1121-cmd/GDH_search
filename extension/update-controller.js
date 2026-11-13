/* Native helper executes only the pinned updater. No GDH content is sent to it. */
'use strict';
const GDH_NATIVE_HOST='com.yoshidak.gdh_search_updater';
let gdhUpdateState={phase:'idle'},gdhUpdatePort=null;
function gdhUpdateClient(sender){
 if(sender.id!==chrome.runtime.id||!sender.url)return false;
 try{const url=new URL(sender.url);return url.protocol==='chrome-extension:'&&url.hostname===chrome.runtime.id&&['/popup.html','/viewer.html','/update.html'].includes(url.pathname);}catch{return false;}
}
function gdhNativeRequest(message,onProgress){
 return new Promise((resolve,reject)=>{
  let port,settled=false;
  const timer=setTimeout(()=>finish(null,'UPDATE_TIMEOUT'),250000);
  function finish(result,error){if(settled)return;settled=true;clearTimeout(timer);if(gdhUpdatePort===port)gdhUpdatePort=null;try{port?.disconnect();}catch{}error?reject(Error(error)):resolve(result);}
  try{
   port=chrome.runtime.connectNative(GDH_NATIVE_HOST);gdhUpdatePort=port;
   port.onMessage.addListener(result=>{if(result?.type==='progress'){onProgress?.();return;}finish(result);});
   port.onDisconnect.addListener(()=>{const error=chrome.runtime.lastError;finish(null,error?'HELPER_REQUIRED':'UPDATE_FAILED');});
   port.postMessage(message);
  }catch{finish(null,'HELPER_REQUIRED');}
 });
}
function gdhUpdateWait(promise,ms=3000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('UPDATE_TIMEOUT')),ms);})]).finally(()=>clearTimeout(timer));}
let gdhApplyInFlight=null;
function gdhApplyPendingUpdate(){
 if(gdhApplyInFlight)return gdhApplyInFlight;
 gdhApplyInFlight=gdhApplyPendingUpdateOnce().finally(()=>{gdhApplyInFlight=null;});return gdhApplyInFlight;
}
async function gdhApplyPendingUpdateOnce(){
 const {gdhUpdatePending:pending}=await chrome.storage.local.get('gdhUpdatePending');
 if(!pending)return;
 // A worker restart during installation must not start a second update or reload pages.
 if(pending.phase!=='reload')return;
 gdhUpdateState={phase:'reloading',version:pending.version};
 await chrome.storage.local.remove('gdhUpdatePending');
 const current=chrome.runtime.getManifest().version;
 if(current!==pending.version||Date.now()-pending.createdAt>300000){gdhUpdateState={phase:'failed',code:'APPLY_FAILED'};return;}
 const tabs=await chrome.tabs.query({url:'https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/*'});let reloaded=0;
 for(const target of pending.targets||[]){
  if(!tabs.some(tab=>tab.id===target.tabId))continue;
  try{
   const check=await gdhUpdateWait(chrome.scripting.executeScript({target:{tabId:target.tabId,documentIds:[target.documentId]},func:()=>true}));
   if(check[0]?.documentId===target.documentId){await chrome.tabs.reload(target.tabId);reloaded++;}
  }catch{}
 }
 gdhUpdateState={phase:'done',version:current,reloaded,skipped:(pending.targetCount||0)-reloaded};
 try{
  const guide=await chrome.tabs.get(pending.guideTabId);
  if(guide.url?.startsWith(chrome.runtime.getURL('update.html')))await chrome.tabs.update(guide.id,{url:chrome.runtime.getURL('update.html?done=1&reloaded='+reloaded+'&skipped='+gdhUpdateState.skipped+'&lang='+(pending.language==='en'?'en':'ja'))});
 }catch{}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(!gdhUpdateClient(sender)||!['GDH_UPDATE_START','GDH_UPDATE_STATUS','GDH_UPDATE_PING','GDH_UPDATE_MANAGER'].includes(message?.type))return;
 (async()=>{
  if(message.type==='GDH_UPDATE_STATUS')return {...gdhUpdateState,currentVersion:chrome.runtime.getManifest().version};
  if(message.type==='GDH_UPDATE_MANAGER'){
   if(!['Edge','Chrome'].includes(message.browser))return {ok:false};
   await chrome.tabs.create({url:message.browser==='Edge'?'edge://extensions/':'chrome://extensions/'});return {ok:true};
  }
  if(message.type==='GDH_UPDATE_PING'){
   if(gdhUpdatePort)return {ok:false,code:'BUSY'};
   try{return await gdhNativeRequest({action:'ping'});}catch{return {ok:false,code:'HELPER_REQUIRED'};}
  }
  if(message.confirmed!==true||!/^\d+\.\d+\.\d+$/.test(message.version||''))return {ok:false,code:'INVALID_REQUEST'};
  const targetVersion=message.version.split('.').map(Number),currentVersion=chrome.runtime.getManifest().version.split('.').map(Number);
  const different=targetVersion.findIndex((value,index)=>value!==currentVersion[index]);
  if(different<0||targetVersion[different]<currentVersion[different])return {ok:false,code:'UP_TO_DATE'};
  if(gdhUpdatePort||['preparing','installing','reloading'].includes(gdhUpdateState.phase)||typeof liveBusy!=='undefined'&&liveBusy)return {ok:false,code:'BUSY'};
  gdhUpdateState={phase:'preparing',version:message.version};
  const tabs=await chrome.tabs.query({url:'https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/*'});
  const eligible=tabs.filter(tab=>tab.id===message.tabId),targets=[];
  for(const tab of eligible){try{const result=await gdhUpdateWait(chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>true}));if(typeof result[0]?.documentId==='string')targets.push({tabId:tab.id,documentId:result[0].documentId});}catch{}}
  const language=message.language==='en'?'en':'ja';
  const guide=await chrome.tabs.create({url:chrome.runtime.getURL('update.html?lang='+language)});
  gdhUpdateState={phase:'installing',version:message.version};
  await chrome.storage.local.set({gdhUpdatePending:{phase:'installing',version:message.version,createdAt:Date.now()}});
  // The UI receives an immediate acknowledgement; the native port owns the long task.
  gdhNativeRequest({action:'update',version:message.version}).then(async result=>{
   if(result?.ok!==true||result.version!==message.version)throw Error(result?.code||'UPDATE_FAILED');
   gdhUpdateState={phase:'reloading',version:message.version};
   await chrome.storage.local.set({gdhUpdatePending:{phase:'reload',version:message.version,createdAt:Date.now(),targets,targetCount:eligible.length,guideTabId:guide.id,language}});
   chrome.runtime.reload();
  }).catch(async error=>{
   await chrome.storage.local.remove('gdhUpdatePending');
   gdhUpdateState={phase:error.message==='HELPER_REQUIRED'?'helper-required':'failed',code:['HELPER_REQUIRED','UPDATE_TIMEOUT'].includes(error.message)?error.message:'UPDATE_FAILED'};
  });
  return {ok:true};
 })().then(value=>{try{respond(value);}catch{}},()=>{if(gdhUpdateState.phase==='preparing')gdhUpdateState={phase:'failed',code:'UPDATE_FAILED'};try{respond({ok:false,code:'UPDATE_FAILED'});}catch{}});
 return true;
});
chrome.runtime.onInstalled?.addListener(()=>gdhApplyPendingUpdate().catch(()=>{}));
chrome.runtime.onStartup?.addListener(()=>gdhApplyPendingUpdate().catch(()=>{}));
gdhApplyPendingUpdate().catch(()=>{});

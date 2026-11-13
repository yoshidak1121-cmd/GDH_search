'use strict';
importScripts('getdata-live.js','getdata-catalog.js','update-controller.js','csv-navigation.js');
let liveBusy=false,currentBatch=null;
const pattern='https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/*';
const BATCH_LIMIT_MS=60000,READ_LIMIT_MS=18000,PROBE_LIMIT_MS=2000;
function failure(code){return Object.assign(new Error(code),{code});}
function within(promise,ms,code='TIMEOUT'){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(failure(code)),Math.max(0,ms));})]).finally(()=>clearTimeout(timer));
}
function snapshot(job){return {ok:true,jobId:job.id,status:job.cancelled&&job.status==='running'?'stopping':job.status,phase:job.phase,table:job.table,completed:job.tables.length,total:GdhMigrationCatalog.tables.length,elapsedMs:(job.finishedAt??Date.now())-job.startedAt,reason:job.reason,result:{...job.result,run:{status:job.status,reason:job.reason,table:job.table,elapsedMs:(job.finishedAt??Date.now())-job.startedAt}}};}
function stopNative(job){
 if(!job.active)return;
 const {tabId,readId}=job.active;
 chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:cancelGdhRead,args:[readId]}).catch(()=>{});
}
function stopBatch(job,reason='CANCELLED'){
 if(!job||job.status!=='running'||job.cancelled)return;
 job.reason=reason;job.cancelled=true;job.signalCancel();stopNative(job);
}
function remaining(job){
 if(job.cancelled)throw failure(job.reason||'CANCELLED');
 const ms=job.deadline-Date.now();if(ms<=0)throw failure('BATCH_TIMEOUT');return ms;
}
function task(job,operation,limit,code='TIMEOUT'){
 const ms=Math.min(remaining(job),limit);
 return Promise.race([within(operation(),ms,code),job.cancelPromise]);
}
function publish(job,samples){job.result={ok:true,source:'getData-batch',tables:[...job.tables],relationships:GdhMigrationCatalog.compare(samples)};}
async function runBatch(job,seedTabId){
 const samples=new Map(),found=new Map();let validSeed=null,authStopped=false;
 const overallTimer=setTimeout(()=>stopBatch(job,'BATCH_TIMEOUT'),BATCH_LIMIT_MS);
 try{
  const tabs=await task(job,()=>chrome.tabs.query({url:pattern}),PROBE_LIMIT_MS,'DISCOVERY_TIMEOUT');
  const discoveryEnd=Math.min(job.deadline,Date.now()+10000);
  // Inspect a selected tab first. Discovery never waits indefinitely on a frozen tab.
  tabs.sort((a,b)=>Number(b.id===seedTabId)-Number(a.id===seedTabId));
  let discoveryComplete=true;
  for(const tab of tabs){
   remaining(job);if(Date.now()>=discoveryEnd){discoveryComplete=false;break;}
   job.phase='discovery';job.table=null;
   try{
    const response=await task(job,()=>chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>{
     if(location.origin!=='https://global-service.fa-cnc.idc-t.melco.co.jp'||typeof window.createRequestData!=='function')return null;
     try{const request=window.createRequestData();return request.db_source==='ZALS'?{table:request.tablename}:null;}catch{return null;}
    }}),Math.min(PROBE_LIMIT_MS,discoveryEnd-Date.now()),'DISCOVERY_TIMEOUT');
    const table=response[0]?.result?.table;
    if(table==='ZGDDTB_CONTRACT_INFO'&&tab.id===seedTabId)validSeed=tab.id;
    if(GdhMigrationCatalog.tables.some(config=>config.table===table)){const ids=found.get(table)||[];ids.push(tab.id);found.set(table,ids);}
   }catch(error){if(job.cancelled)throw error;discoveryComplete=false;}
  }
  if(seedTabId==null&&discoveryComplete&&(found.get('ZGDDTB_CONTRACT_INFO')||[]).length===1)validSeed=found.get('ZGDDTB_CONTRACT_INFO')[0];
  for(const config of GdhMigrationCatalog.tables){
   remaining(job);
   if((await task(job,()=>chrome.storage.local.get('gdhGetDataValidationEnabled'),PROBE_LIMIT_MS)).gdhGetDataValidationEnabled!==true)throw failure('MODE_OFF');
   if(authStopped){job.tables.push({table:config.table,ok:false,code:'AUTH_REQUIRED'});publish(job,samples);continue;}
   const ownIds=config.table==='ZGDDTB_CONTRACT_INFO'&&validSeed!==null?[validSeed]:(found.get(config.table)||[]);
   const ids=ownIds.length===0&&validSeed!==null?[validSeed]:ownIds;
   if(ids.length!==1){job.tables.push({table:config.table,ok:false,code:ids.length?'DUPLICATE_TABS':discoveryComplete?'NOT_OPEN':'DISCOVERY_TIMEOUT'});publish(job,samples);continue;}
   remaining(job);job.phase='reading';job.table=config.table;
   const readId=crypto.randomUUID();job.active={tabId:ids[0],readId};
   try{
    const response=await task(job,()=>chrome.scripting.executeScript({target:{tabId:ids[0]},world:'MAIN',func:readGdhContractPage,args:[{...config,collect:true,allowTableSwitch:true,readId,deadline:Math.min(job.deadline,Date.now()+15000)}]}),READ_LIMIT_MS);
    remaining(job);
    const result=response[0]?.result;
    if(result?.ok){const {sample,...summary}=result;job.tables.push({table:config.table,...summary,ok:result.summary.valid,code:result.summary.valid?undefined:'SCHEMA_MISMATCH'});if(result.summary.valid&&Array.isArray(sample))samples.set(config.table,sample);}
    else{job.tables.push({table:config.table,ok:false,code:result?.code||'PAGE_NOT_READY'});if(result?.code==='AUTH_REQUIRED')authStopped=true;if(result?.code==='TIMEOUT')throw failure('READ_TIMEOUT');}
   }catch(error){
    stopNative(job);
    if(!job.tables.some(row=>row.table===config.table))job.tables.push({table:config.table,ok:false,code:error.code||'PAGE_NOT_READY'});
    // Do not start another request while a timed-out injection may still be pending.
    throw failure(error.code==='TIMEOUT'?'READ_TIMEOUT':error.code||'PAGE_NOT_READY');
   }finally{job.active=null;publish(job,samples);}
  }
  job.status='completed';job.phase='finished';job.table=null;
 }catch(error){
  stopNative(job);job.reason=error.code||'PAGE_NOT_READY';job.status=['BATCH_TIMEOUT','READ_TIMEOUT','DISCOVERY_TIMEOUT','TIMEOUT'].includes(job.reason)?'timeout':job.reason==='CANCELLED'||job.reason==='MODE_OFF'?'cancelled':'interrupted';job.phase='finished';
 }finally{
  clearTimeout(overallTimer);job.finishedAt=Date.now();job.signalCancel();
  for(const config of GdhMigrationCatalog.tables)if(!job.tables.some(row=>row.table===config.table))job.tables.push({table:config.table,ok:false,code:job.reason||'NOT_ATTEMPTED'});
  publish(job,samples);samples.clear();job.active=null;delete job.cancelPromise;delete job.signalCancel;
  if(currentBatch===job)liveBusy=false;
 }
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('validation.html'))return;
 if(!['GDH_GETDATA_TABS','GDH_GETDATA_READ','GDH_GETDATA_BATCH','GDH_GETDATA_BATCH_STATUS','GDH_GETDATA_BATCH_CANCEL'].includes(message?.type))return;
 (async()=>{
  if(message.type==='GDH_GETDATA_BATCH_STATUS')return currentBatch&&(!message.jobId||message.jobId===currentBatch.id)?snapshot(currentBatch):{ok:false,code:'BATCH_LOST'};
  if(message.type==='GDH_GETDATA_BATCH_CANCEL'){
   if(!currentBatch||(message.jobId&&message.jobId!==currentBatch.id))return {ok:false,code:'BATCH_LOST'};
   stopBatch(currentBatch);return snapshot(currentBatch);
  }
  if(message.type==='GDH_GETDATA_TABS'){
   const tabs=await within(chrome.tabs.query({url:pattern}),PROBE_LIMIT_MS);
   return {ok:true,tabs:tabs.filter(t=>Number.isInteger(t.id)).map(t=>({id:t.id,label:t.title==='ZGDDTB_CONTRACT_INFO'?'契約情報':'GDH（契約情報を開いているか確認）'}))};
  }
  if(liveBusy||gdhUpdatePort||['preparing','installing','reloading'].includes(gdhUpdateState.phase))return {ok:false,code:'BUSY'};
  if((await within(chrome.storage.local.get('gdhGetDataValidationEnabled'),PROBE_LIMIT_MS)).gdhGetDataValidationEnabled!==true)return {ok:false,code:'MODE_OFF'};
  if(liveBusy||gdhUpdatePort||['preparing','installing','reloading'].includes(gdhUpdateState.phase))return {ok:false,code:'BUSY'};
  if(message.confirmed!==true)return {ok:false,code:'CONFIRM_REQUIRED'};
  if(message.type==='GDH_GETDATA_BATCH'){
   let rejectCancel;
   const job={id:crypto.randomUUID(),status:'running',phase:'discovery',table:null,startedAt:Date.now(),deadline:Date.now()+BATCH_LIMIT_MS,tables:[],cancelled:false,owner:sender.tab?.id??message.ownerTabId};
   job.cancelPromise=new Promise((_,reject)=>{rejectCancel=reject;});job.cancelPromise.catch(()=>{});job.signalCancel=()=>rejectCancel(failure(job.reason||'CANCELLED'));
   publish(job,new Map());currentBatch=job;liveBusy=true;
   runBatch(job,message.tabId).catch(()=>{});
   return snapshot(job);
  }
  if(!Number.isInteger(message.tabId))return {ok:false,code:'CONFIRM_REQUIRED'};
  liveBusy=true;const readId=crypto.randomUUID();
  try{
   const tabs=await within(chrome.tabs.query({url:pattern}),PROBE_LIMIT_MS);
   if(!tabs.some(t=>t.id===message.tabId))return {ok:false,code:'WRONG_PAGE'};
   const response=await within(chrome.scripting.executeScript({target:{tabId:message.tabId},world:'MAIN',func:readGdhContractPage,args:[{readId,deadline:Date.now()+15000}]}),READ_LIMIT_MS);
   return response[0]?.result||{ok:false,code:'PAGE_NOT_READY'};
  }catch(error){chrome.scripting.executeScript({target:{tabId:message.tabId},world:'MAIN',func:cancelGdhRead,args:[readId]}).catch(()=>{});return {ok:false,code:error.code||'PAGE_NOT_READY'};}
  finally{liveBusy=false;}
 })().then(respond,error=>respond({ok:false,code:error.code||'PAGE_NOT_READY'}));
 return true;
});
chrome.tabs.onRemoved.addListener(tabId=>{if(currentBatch?.status==='running'&&currentBatch.owner===tabId)stopBatch(currentBatch);});

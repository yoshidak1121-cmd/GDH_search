'use strict';
importScripts('getdata-live.js','getdata-catalog.js');
let liveBusy=false;
const pattern='https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/*';
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('validation.html'))return;
 if(!['GDH_GETDATA_TABS','GDH_GETDATA_READ','GDH_GETDATA_BATCH'].includes(message?.type))return;
 (async()=>{
  if(message.type==='GDH_GETDATA_TABS'){
   const tabs=await chrome.tabs.query({url:pattern});
   return {ok:true,tabs:tabs.filter(t=>Number.isInteger(t.id)).map(t=>({id:t.id,label:t.title==='ZGDDTB_CONTRACT_INFO'?'契約情報':'GDH（契約情報を開いているか確認）'}))};
  }
  if(liveBusy)return {ok:false,code:'BUSY'};
  liveBusy=true;
  try{
   if((await chrome.storage.local.get('gdhGetDataValidationEnabled')).gdhGetDataValidationEnabled!==true)return {ok:false,code:'MODE_OFF'};
   if(message.type==='GDH_GETDATA_BATCH'){
    if(message.confirmed!==true)return {ok:false,code:'CONFIRM_REQUIRED'};
    return await inspectOpenTables();
   }
   if(message.confirmed!==true||!Number.isInteger(message.tabId))return {ok:false,code:'CONFIRM_REQUIRED'};
   const tabs=await chrome.tabs.query({url:pattern});
   if(!tabs.some(t=>t.id===message.tabId))return {ok:false,code:'WRONG_PAGE'};
   const results=await chrome.scripting.executeScript({target:{tabId:message.tabId},world:'MAIN',func:readGdhContractPage});
   return results[0]?.result||{ok:false,code:'PAGE_NOT_READY'};
  }finally{liveBusy=false;}
 })().then(respond,()=>respond({ok:false,code:'PAGE_NOT_READY'}));
 return true;
});

async function inspectOpenTables(){
 const tabs=await chrome.tabs.query({url:pattern});
 const found=new Map(),tables=[],samples=new Map();
 for(const tab of tabs){
  try{
   const results=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'MAIN',func:()=>{
    if(location.origin!=='https://global-service.fa-cnc.idc-t.melco.co.jp'||typeof window.createRequestData!=='function')return null;
    try{const request=window.createRequestData();return request.db_source==='ZALS'?{table:request.tablename}:null;}catch{return null;}
   }});
   const table=results[0]?.result?.table;
   if(GdhMigrationCatalog.tables.some(config=>config.table===table)){const ids=found.get(table)||[];ids.push(tab.id);found.set(table,ids);}
  }catch{}
 }
 for(const config of GdhMigrationCatalog.tables){
  if((await chrome.storage.local.get('gdhGetDataValidationEnabled')).gdhGetDataValidationEnabled!==true)return {ok:false,code:'MODE_OFF'};
  const ids=found.get(config.table)||[];
  if(ids.length!==1){tables.push({table:config.table,ok:false,code:ids.length?'DUPLICATE_TABS':'NOT_OPEN'});continue;}
  try{
   const results=await chrome.scripting.executeScript({target:{tabId:ids[0]},world:'MAIN',func:readGdhContractPage,args:[{...config,collect:true}]});
   const result=results[0]?.result;
   if(result?.ok){
    const {sample,...summary}=result;
    tables.push({table:config.table,...summary});
    if(result.summary.valid&&Array.isArray(sample))samples.set(config.table,sample);
   }else tables.push({table:config.table,ok:false,code:result?.code||'PAGE_NOT_READY'});
  }catch{tables.push({table:config.table,ok:false,code:'PAGE_NOT_READY'});}
 }
 const relationships=GdhMigrationCatalog.compare(samples);samples.clear();
 return {ok:true,source:'getData-batch',tables,relationships};
}

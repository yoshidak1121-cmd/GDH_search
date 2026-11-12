'use strict';
importScripts('getdata-live.js');
let liveBusy=false;
const pattern='https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/*';
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('validation.html'))return;
 if(!['GDH_GETDATA_TABS','GDH_GETDATA_READ'].includes(message?.type))return;
 (async()=>{
  if(message.type==='GDH_GETDATA_TABS'){
   const tabs=await chrome.tabs.query({url:pattern});
   return {ok:true,tabs:tabs.filter(t=>Number.isInteger(t.id)).map(t=>({id:t.id,label:t.title==='ZGDDTB_CONTRACT_INFO'?'契約情報':'GDH（契約情報を開いているか確認）'}))};
  }
  if(liveBusy)return {ok:false,code:'BUSY'};
  liveBusy=true;
  try{
   if((await chrome.storage.local.get('gdhGetDataValidationEnabled')).gdhGetDataValidationEnabled!==true)return {ok:false,code:'MODE_OFF'};
   if(message.confirmed!==true||!Number.isInteger(message.tabId))return {ok:false,code:'CONFIRM_REQUIRED'};
   const tabs=await chrome.tabs.query({url:pattern});
   if(!tabs.some(t=>t.id===message.tabId))return {ok:false,code:'WRONG_PAGE'};
   const results=await chrome.scripting.executeScript({target:{tabId:message.tabId},world:'MAIN',func:readGdhContractPage});
   return results[0]?.result||{ok:false,code:'PAGE_NOT_READY'};
  }finally{liveBusy=false;}
 })().then(respond,()=>respond({ok:false,code:'PAGE_NOT_READY'}));
 return true;
});

/* One-time navigation intent, per tab, kept only in extension session storage. */
'use strict';
{
 const path='/cncservice/viewcreator/dataview/list/ZGDS0130vBASE';
 const sourcePath=value=>value===path;
 const locks=new Set();
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(!['GDH_CSV_NAVIGATE','GDH_CSV_NAVIGATION_RESUME'].includes(message?.type))return;
  let url;
  try{url=new URL(sender.url);}catch{return;}
  if(sender.id!==chrome.runtime.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id)||!GDH_SEARCH_ORIGINS.has(url.origin))return;
  const tabId=sender.tab.id,key='gdhCsvNavigation:'+tabId;
  (async()=>{
   if(locks.has(tabId))return {ok:false,code:'BUSY'};
   locks.add(tabId);
   try{
    const stored=(await chrome.storage.session.get(key))[key];
    if(message.type==='GDH_CSV_NAVIGATE'){
     if(!['/cncservice/home','/cncservice/home/',path].includes(url.pathname)||(message.path!==undefined&&message.path!==path))return {ok:false,code:'INVALID_SOURCE'};
     if(stored&&Date.now()-stored.createdAt<60000)return {ok:false,code:'BUSY'};
     const intent={path,origin:url.origin,language:message.language==='en'?'en':'ja',createdAt:Date.now()};
     await chrome.storage.session.set({[key]:intent});
     try{await chrome.tabs.update(tabId,{url:intent.origin+intent.path+'?getDataOnInit=false'});}catch{await chrome.storage.session.remove(key);return {ok:false,code:'NAVIGATION_FAILED'};}
     return {ok:true};
    }
    if(!stored)return {ok:true,start:false};
    // Consume before replying. Reload, duplicate delivery and failure never retry export.
    await chrome.storage.session.remove(key);
    if(Date.now()-stored.createdAt>60000||!sourcePath(stored.path))return {ok:false,code:'EXPIRED'};
    if(url.origin!==(stored.origin??GDH_SEARCH_PRODUCTION_ORIGIN)||url.pathname!==stored.path||url.searchParams.get('getDataOnInit')!=='false'||message.ready!==true)return {ok:false,code:'FORM_UNAVAILABLE'};
    return {ok:true,start:true,language:stored.language};
   }finally{locks.delete(tabId);}
  })().then(value=>{try{respond(value);}catch{}},()=>{try{respond({ok:false,code:'NAVIGATION_FAILED'});}catch{}});
  return true;
 });
 chrome.tabs.onRemoved?.addListener(tabId=>{chrome.storage.session?.remove('gdhCsvNavigation:'+tabId).catch(()=>{});});
}

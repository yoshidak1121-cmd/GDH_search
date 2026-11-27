/* Tab routing stores tab IDs, source origins and short-lived request metadata, never CSV bytes. */
'use strict';
{
 const searchPath='/cncservice/viewcreator/dataview/list/ZGDS0130vBASE';
 const prefix='gdhViewer:',pendingPrefix='gdhTabExport:',locks=new Set();
 const hostOrigin=url=>{try{const u=new URL(url);return GDH_SEARCH_ORIGINS.has(u.origin)&&u.pathname.startsWith('/cncservice/')?u.origin:null;}catch{return null;}};
 const viewer=url=>{try{const u=new URL(url);return u.protocol==='chrome-extension:'&&u.hostname===chrome.runtime.id&&u.pathname==='/viewer.html';}catch{return false;}};
 const get=async key=>(await chrome.storage.session.get(key))[key];
 async function source(tabId,origin){const tab=await chrome.tabs.get(tabId);if(hostOrigin(tab.url)!==origin)throw Error('SOURCE_UNAVAILABLE');}
 async function finish(viewerId,binding){
  const job=await get(pendingPrefix+binding.sourceTabId);
  if(job?.viewerId===viewerId){await chrome.storage.session.remove(pendingPrefix+binding.sourceTabId);await chrome.tabs.sendMessage(binding.sourceTabId,{type:'GDH_TAB_EXPORT_CLEAR',requestId:job.requestId}).catch(()=>{});}
 }
 async function startExport(sourceId,job,resume=false){
  const origin=job.origin??GDH_SEARCH_PRODUCTION_ORIGIN;
  await source(sourceId,origin);
  const result=await chrome.tabs.sendMessage(sourceId,{type:'GDH_TAB_EXPORT_START',origin,requestId:job.requestId,language:job.language,resume,confirmed:true});
  if(!result?.ok)throw Error(result?.code||'SOURCE_UNAVAILABLE');
  if(result.navigate){
   if(resume)throw Error('FORM_UNAVAILABLE');
   await chrome.storage.session.set({[pendingPrefix+sourceId]:{...job,phase:'navigation'}});
   await chrome.tabs.update(sourceId,{active:true,url:origin+searchPath+'?getDataOnInit=false'});
  }else await chrome.storage.session.set({[pendingPrefix+sourceId]:{...job,phase:'reading'}});
 }
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  const type=message?.type;
  if(!['GDH_VIEWER_OPEN','GDH_VIEWER_CONTEXT','GDH_VIEWER_EXPORT_START','GDH_VIEWER_EXPORT_STATUS','GDH_VIEWER_EXPORT_CHUNK','GDH_VIEWER_EXPORT_END','GDH_TAB_SOURCE_READY'].includes(type))return;
  if(sender.id!==chrome.runtime.id||sender.frameId!==0||!Number.isInteger(sender.tab?.id))return;
  const origin=hostOrigin(sender.url),isViewer=viewer(sender.url);
  if((type==='GDH_VIEWER_OPEN'||type==='GDH_TAB_SOURCE_READY')?!origin:!isViewer)return;
  const caller=sender.tab.id;
  (async()=>{
   if(type==='GDH_VIEWER_OPEN'){
    if(locks.has(caller))return {ok:false,code:'BUSY'};
    locks.add(caller);
    try{
     await source(caller,origin);
     const all=await chrome.storage.session.get(null);
     for(const [key,binding] of Object.entries(all))if(key.startsWith(prefix)&&binding.sourceTabId===caller){
      try{
       const tab=await chrome.tabs.get(binding.viewerId);
       const contexts=await chrome.runtime.getContexts({contextTypes:['TAB'],tabIds:[tab.id],frameIds:[0]});
       if((binding.origin??GDH_SEARCH_PRODUCTION_ORIGIN)===origin&&contexts.some(context=>viewer(context.documentUrl))){
        await chrome.tabs.update(tab.id,{active:true});await chrome.windows.update(tab.windowId,{focused:true});return {ok:true,viewerId:tab.id};
       }
      }catch{}
      await chrome.storage.session.remove(key);
     }
     const tab=await chrome.tabs.create({url:chrome.runtime.getURL('viewer.html?lang='+(message.language==='en'?'en':'ja')),openerTabId:caller});
     await chrome.storage.session.set({[prefix+tab.id]:{sourceTabId:caller,viewerId:tab.id,origin}});
     return {ok:true,viewerId:tab.id};
    }finally{locks.delete(caller);}
   }
   if(type==='GDH_TAB_SOURCE_READY'){
    const key=pendingPrefix+caller,job=await get(key);if(!job||job.phase!=='navigation')return {ok:true};
    const u=new URL(sender.url);
    if(Date.now()>job.deadline||u.origin!==(job.origin??GDH_SEARCH_PRODUCTION_ORIGIN)||u.pathname!==searchPath||u.searchParams.get('getDataOnInit')!=='false'||message.ready!==true){await chrome.storage.session.set({[key]:{...job,phase:'error',code:'FORM_UNAVAILABLE'}});return {ok:false};}
    // Consume the navigation phase before starting. Reload never starts a second export.
    await chrome.storage.session.set({[key]:{...job,phase:'reading'}});
    try{await startExport(caller,job,true);await chrome.tabs.update(job.viewerId,{active:true});}catch{await chrome.storage.session.set({[key]:{...job,phase:'error',code:'SOURCE_UNAVAILABLE'}});}
    return {ok:true};
   }
   const binding=await get(prefix+caller);if(!binding)return {ok:false,code:'SOURCE_UNAVAILABLE'};
   const sourceOrigin=binding.origin??GDH_SEARCH_PRODUCTION_ORIGIN;
   if(type==='GDH_VIEWER_CONTEXT'){await source(binding.sourceTabId,sourceOrigin);return {ok:true,sourceTabId:binding.sourceTabId};}
   if(type==='GDH_VIEWER_EXPORT_END'){await finish(caller,binding);return {ok:true};}
   await source(binding.sourceTabId,sourceOrigin);
   const key=pendingPrefix+binding.sourceTabId;
   if(type==='GDH_VIEWER_EXPORT_START'){
    if(message.confirmed!==true)return {ok:false,code:'CONFIRM_REQUIRED'};
    if(locks.has(binding.sourceTabId))return {ok:false,code:'BUSY'};
    locks.add(binding.sourceTabId);
    try{
     const previous=await get(key);if(previous&&Date.now()<previous.deadline)return {ok:false,code:'BUSY'};
     const job={viewerId:caller,origin:sourceOrigin,requestId:crypto.randomUUID(),language:message.language==='en'?'en':'ja',deadline:Date.now()+180000,phase:'starting'};
     await chrome.storage.session.set({[key]:job});
     try{await startExport(binding.sourceTabId,job);return {ok:true};}catch(error){await finish(caller,binding);return {ok:false,code:error.message};}
    }finally{locks.delete(binding.sourceTabId);}
   }
   const job=await get(key);if(!job||job.viewerId!==caller)return {ok:false,code:'REQUEST_LOST'};
   if(Date.now()>job.deadline){await finish(caller,binding);return {ok:false,code:'TIMEOUT'};}
   if(job.phase==='error')return {ok:false,code:job.code};
   if(job.phase==='navigation'||job.phase==='starting')return {ok:true,status:'waiting'};
   return await chrome.tabs.sendMessage(binding.sourceTabId,{type:type==='GDH_VIEWER_EXPORT_CHUNK'?'GDH_TAB_EXPORT_CHUNK':'GDH_TAB_EXPORT_STATUS',requestId:job.requestId,offset:message.offset});
  })().then(respond,()=>respond({ok:false,code:'SOURCE_UNAVAILABLE'}));
  return true;
 });
 chrome.tabs.onRemoved.addListener(tabId=>{
  (async()=>{
   const all=await chrome.storage.session.get(null);
   for(const [key,binding] of Object.entries(all))if(key.startsWith(prefix)&&(binding.sourceTabId===tabId||binding.viewerId===tabId)){await finish(binding.viewerId,binding);await chrome.storage.session.remove(key);}
   await chrome.storage.session.remove(pendingPrefix+tabId);
  })().catch(()=>{});
 });
}

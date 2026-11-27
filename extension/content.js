/* GDH stays the source of the current authenticated CSV form; the viewer is a separate tab. */
(function(){
 'use strict';
 if(!GDH_SEARCH_ORIGINS.has(location.origin)||!location.pathname.startsWith('/cncservice/'))return;
 const isHome=['/cncservice/home','/cncservice/home/'].includes(location.pathname);
 let uiLang='ja',job=null,opening=false;
 function sourceForm(){const form=document.getElementById('frmmain');return form instanceof HTMLFormElement&&form.querySelector('[name="dataview_cd"]')?form:null;}
 function csvFormReady(){
  const form=sourceForm(),label=(document.title+' '+(document.querySelector('h1')?.textContent||'')).replace(/\s/g,'');
  return !!(form&&/機械情報検索|machineinformationsearch|machinesearch/i.test(label)&&location.pathname===window.GDH_CSV_SEARCH_PATH&&['dataview_cd','iszip','pdf','downloadToken','form_submit'].every(name=>form.querySelector('[name="'+name+'"]')));
 }
 function clear(){if(job)clearTimeout(job.timer);job=null;}
 async function open(language){
  if(['ja','en'].includes(language))uiLang=language;
  if(opening)return {ok:false,error:'画面を開いています。'};
  if(!sourceForm()&&!isHome)return {ok:false,error:'GDHのホームまたは機械情報検索画面で使用してください。'};
  opening=true;
  try{return await chrome.runtime.sendMessage({type:'GDH_VIEWER_OPEN',language:uiLang});}
  catch{return {ok:false,error:'拡張ツールを開けませんでした。GDH画面を再読み込みしてください。'};}
  finally{opening=false;}
 }
 function start(message){
  if(message.confirmed!==true||typeof message.requestId!=='string'||message.requestId.length>100)return {ok:false,code:'INVALID_REQUEST'};
  if(message.origin!==location.origin)return {ok:false,code:'SOURCE_UNAVAILABLE'};
  if(job?.status==='reading')return {ok:false,code:'BUSY'};
  if(!message.resume&&(isHome||location.pathname===window.GDH_CSV_SEARCH_PATH))return {ok:true,navigate:true};
  const form=sourceForm();if(!form||message.resume&&!csvFormReady())return {ok:false,code:'FORM_UNAVAILABLE'};
  clear();const current={id:message.requestId,status:'reading',blob:null,error:null,offset:0};job=current;
  current.timer=setTimeout(()=>{if(job===current)clear();},180000);
  // The viewer has already shown the same CSV confirmation before requesting this export.
  const exporter=window.createGdhCsvExportAdapter({form,confirmExport:()=>true});
  exporter().then(result=>{if(job!==current)return;current.blob=result.blob;current.fileName=result.fileName;current.status='ready';},error=>{if(job!==current)return;current.error=String(error?.message||'GDHからの取得に失敗しました。');current.status='error';});
  return {ok:true};
 }
 chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||sender.tab)return;
  if(message?.type==='GDH_SEARCH_TOGGLE'){open(message.language).then(respond);return true;}
  if(!['GDH_TAB_EXPORT_START','GDH_TAB_EXPORT_STATUS','GDH_TAB_EXPORT_CHUNK','GDH_TAB_EXPORT_CLEAR'].includes(message?.type))return;
  (async()=>{
   if(message.type==='GDH_TAB_EXPORT_START')return start(message);
   if(!job||message.requestId!==job.id)return {ok:false,code:'REQUEST_LOST'};
   if(message.type==='GDH_TAB_EXPORT_CLEAR'){clear();return {ok:true};}
   if(message.type==='GDH_TAB_EXPORT_STATUS')return {ok:true,status:job.status,error:job.error,size:job.blob?.size,fileName:job.fileName};
   if(job.status!=='ready'||message.offset!==job.offset)return {ok:false,code:'INVALID_CHUNK'};
   const current=job,bytes=new Uint8Array(await current.blob.slice(current.offset,current.offset+512*1024).arrayBuffer());
   if(job!==current)return {ok:false,code:'REQUEST_LOST'};
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   current.offset+=bytes.length;return {ok:true,data:btoa(binary),nextOffset:current.offset};
  })().then(respond,error=>respond({ok:false,code:'EXPORT_FAILED',error:String(error.message)}));return true;
 });
 function addButton(){
  const form=sourceForm();if(!form&&!isHome||document.getElementById('gdh-search-extension-button'))return;
  const toolbar=document.createElement('div');toolbar.id='gdh-search-extension-toolbar';toolbar.style.cssText='display:flex;clear:both;padding:8px 12px;';
  const button=document.createElement('button');button.id='gdh-search-extension-button';button.type='button';button.textContent='✦ 拡張ツールを新しいタブで開く ↗';button.style.cssText='max-width:100%;padding:12px 20px;border:0;border-radius:8px;background:#1768dc;color:white;font:700 14px sans-serif;cursor:pointer;';
  const status=document.createElement('span');status.setAttribute('role','status');
  button.addEventListener('click',async()=>{const result=await open();status.textContent=result?.ok?'':result?.error||'画面を開けませんでした。再度お試しください。';});
  toolbar.append(button,status);if(form)form.before(toolbar);else document.body.prepend(toolbar);
 }
 addButton();
 (async()=>{
  if(document.readyState!=='complete')await new Promise(resolve=>{const timer=setTimeout(resolve,30000);window.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});});
  let ready=document.readyState==='complete'&&csvFormReady();
  if(!ready&&location.pathname===window.GDH_CSV_SEARCH_PATH)ready=await new Promise(resolve=>{
   const timer=setTimeout(()=>{observer.disconnect();resolve(false);},10000);
   const observer=new MutationObserver(()=>{if(csvFormReady()){clearTimeout(timer);observer.disconnect();resolve(true);}});observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true});
  });
  if(ready)await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  await chrome.runtime.sendMessage({type:'GDH_TAB_SOURCE_READY',ready});
 })().catch(()=>{});
 // Opening the viewer is always an explicit click, including on the GDH home page.
 const observer=new MutationObserver(addButton);observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);
})();

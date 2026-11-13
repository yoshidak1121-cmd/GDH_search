/* Extension viewer <-> isolated content script; CSV bytes never use runtime messaging. */
'use strict';
{
 const params=new URLSearchParams(location.hash.slice(1));
 const channel=params.get('channel'), hostOrigin=params.get('hostOrigin');
 const allowed='https://global-service.fa-cnc.idc-t.melco.co.jp';
 const pending=new Map();
 if(channel && hostOrigin===allowed && window.parent!==window){
  if(params.get('csvAvailable')==='0'){
   for(const id of ['fetchBtn','fetchDuration','fetchFallback']){const element=document.getElementById(id);if(element)element.hidden=true;}
   const note=document.createElement('p');note.id='gdh-home-csv-note';note.setAttribute('role','status');
   const translate=()=>{note.textContent=document.documentElement.lang==='en'?'Opened from GDH Home. Use Load local data to select a CSV file.':'GDHホームから開きました。「ローカルからデータ取得」でCSVファイルを選択してください。';};
   document.querySelector('.fetch-area')?.before(note);translate();window.addEventListener('gdh-language-changed',translate);
  }

  window.GDH_CSV_EXPORT_ADAPTER=()=>new Promise((resolve,reject)=>{
   const requestId=crypto.randomUUID();
   const timer=setTimeout(()=>{pending.delete(requestId);reject(Error('GDHとの接続がタイムアウトしました。'));},125000);
   pending.set(requestId,{resolve,reject,timer});
   window.parent.postMessage({type:'GDH_SEARCH_EXPORT',channel,requestId},hostOrigin);
  });
  window.addEventListener('message',event=>{
   const m=event.data;
   if(event.source!==window.parent||event.origin!==hostOrigin||m?.channel!==channel)return;
   if(m.type==='GDH_SEARCH_LANGUAGE'&&['ja','en'].includes(m.language)){window.setUiLanguage?.(m.language);return;}
   if(m.type!=='GDH_SEARCH_RESULT')return;
   const request=pending.get(m.requestId);if(!request)return;
   clearTimeout(request.timer);pending.delete(m.requestId);
   if(m.error)request.reject(Error(String(m.error)));
   else if(m.buffer instanceof ArrayBuffer)request.resolve({blob:new Blob([m.buffer],{type:'text/csv'}),fileName:m.fileName||'GDH_machine_export.csv'});
   else request.reject(Error('GDHからCSVデータを受け取れませんでした。'));
  });
  window.addEventListener('gdh-language-changed',event=>{if(['ja','en'].includes(event.detail))window.parent.postMessage({type:'GDH_SEARCH_LANGUAGE',channel,language:event.detail},hostOrigin);});
  window.addEventListener('keydown',event=>{if(event.key==='Escape')window.parent.postMessage({type:'GDH_SEARCH_CLOSE',channel},hostOrigin);});
 }
}

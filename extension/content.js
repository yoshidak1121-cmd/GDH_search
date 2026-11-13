/* Runs only on the supplied GDH host, in the extension's isolated world. */
(function(){
 'use strict';
 const allowed='https://global-service.fa-cnc.idc-t.melco.co.jp';
 if(location.origin!==allowed||!location.pathname.startsWith('/cncservice/'))return;
 let panel=null,frame=null,channel=null,exportCsv=null,busy=false,closeButton=null,titleElement=null,uiLang='ja';
 const isHome=location.pathname==='/cncservice/home'||location.pathname==='/cncservice/home/';
 const extensionOrigin='chrome-extension://'+chrome.runtime.id;
 function sourceForm(){const form=document.getElementById('frmmain');return form instanceof HTMLFormElement&&form.querySelector('[name="dataview_cd"]')?form:null;}
 function close(){if(busy)return false;panel?.remove();panel=null;frame=null;channel=null;exportCsv=null;return true;}
 function setHostLanguage(language){
  if(!['ja','en'].includes(language))return;uiLang=language;
  if(titleElement)titleElement.textContent=uiLang==='en'?'GDH Search':'GDH 拡張ツール';
  if(closeButton){closeButton.textContent=uiLang==='en'?'Close':'閉じる';closeButton.setAttribute('aria-label',uiLang==='en'?'Close search':'拡張ツールを閉じる');}
  if(panel)panel.setAttribute('aria-label',uiLang==='en'?'GDH Search':'GDH 拡張ツール');
  if(frame)frame.title=uiLang==='en'?'CNC Machine Viewer':'CNC機械情報ビューア';
  const button=document.getElementById('gdh-search-extension-button');if(button)button.textContent=uiLang==='en'?'✦ Tools →':'✦ 拡張ツール →';
 }
 function toggle(language){if(['ja','en'].includes(language))setHostLanguage(language);
  if(panel)return close()?{ok:true}:{ok:false,error:uiLang==='en'?'CSV retrieval is in progress. Close after it finishes.':'CSV取得中です。完了後に閉じてください。'};
  const form=sourceForm();if(!form&&!isHome)return {ok:false,error:uiLang==='en'?'Use this on the GDH machine search page.':'GDHの機械情報検索画面で使用してください。'};
  const confirmExport=()=>window.confirm(uiLang==='en'?'Export a CSV file?':'CSVファイルを出力します。よろしいですか？');
  exportCsv=form?window.createGdhCsvExportAdapter({form,confirmExport}):window.createGdhHomeCsvExportAdapter({confirmExport});channel=crypto.randomUUID();
  panel=document.createElement('div');panel.id='gdh-search-extension-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','GDH 拡張ツール');
  panel.style.cssText='position:fixed;inset:12px;z-index:2147483646;background:#fff;border:1px solid #cbd6e5;border-radius:10px;box-shadow:0 8px 40px #0005;display:flex;flex-direction:column;overflow:hidden;';
  const bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#14243c;color:white;font:14px sans-serif;';
  const title=document.createElement('span');titleElement=title;title.textContent='GDH 拡張ツール';closeButton=document.createElement('button');closeButton.textContent='閉じる';closeButton.setAttribute('aria-label','拡張ツールを閉じる');closeButton.style.cssText='padding:6px 14px;cursor:pointer;';closeButton.addEventListener('click',close);bar.append(title,closeButton);
  frame=document.createElement('iframe');frame.title='CNC機械情報ビューア';frame.style.cssText='width:100%;flex:1;min-height:0;border:0;background:white;';
  const url=new URL(chrome.runtime.getURL('viewer.html'));url.searchParams.set('lang',uiLang);url.hash=new URLSearchParams({channel,hostOrigin:location.origin,home:isHome?'1':'0'});frame.src=url.href;
  panel.append(bar,frame);document.body.appendChild(panel);setHostLanguage(uiLang);return {ok:true};
 }
 window.addEventListener('message',async event=>{
  const m=event.data;
  if(!frame||event.source!==frame.contentWindow||event.origin!==extensionOrigin||m?.channel!==channel)return;
  if(m.type==='GDH_SEARCH_LANGUAGE'){setHostLanguage(m.language);return;}
  if(m.type==='GDH_SEARCH_CLOSE'){close();return;}
  if(m.type!=='GDH_SEARCH_EXPORT'||typeof m.requestId!=='string'||m.requestId.length>100)return;
  const target=frame.contentWindow,currentChannel=channel;
  const send=data=>target.postMessage({type:'GDH_SEARCH_RESULT',channel:currentChannel,requestId:m.requestId,...data},extensionOrigin,data.buffer?[data.buffer]:[]);
  if(busy){send({error:'CSV取得中です。完了までお待ちください。'});return;}
  busy=true;closeButton.disabled=true;
  try{const result=await exportCsv();const buffer=await result.blob.arrayBuffer();send({buffer,fileName:result.fileName});}
  catch(error){send({error:error?.message||'GDHからの取得に失敗しました。'});}
  finally{busy=false;if(closeButton)closeButton.disabled=false;}
 });
 chrome.runtime.onMessage.addListener((message,_sender,respond)=>{if(message?.type==='GDH_SEARCH_TOGGLE'){try{respond(toggle(message.language));}catch(error){respond({ok:false,error:error.message});}}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel)close();});
 function addButton(){
  const form=sourceForm();if(!form&&!isHome)return;if(document.getElementById('gdh-search-extension-button'))return;
  const toolbar=document.createElement('div');toolbar.id='gdh-search-extension-toolbar';toolbar.style.cssText='display:flex;justify-content:flex-start;clear:both;position:relative;box-sizing:border-box;width:100%;padding:8px 12px;';
  const button=document.createElement('button');button.id='gdh-search-extension-button';button.type='button';button.textContent='✦ 拡張ツール →';button.style.cssText='position:relative;flex:0 1 auto;white-space:normal;padding:12px 20px;border:0;border-radius:8px;background:linear-gradient(135deg,#2586f5,#1454c4);color:white;font:700 14px sans-serif;box-shadow:0 3px 14px #0003;cursor:pointer;';button.addEventListener('click',toggle);const style=document.createElement('style');style.textContent='#gdh-search-extension-button{transition:filter .15s,transform .15s;max-width:calc(100vw - 36px)}#gdh-search-extension-button:hover{filter:brightness(1.12);transform:translateY(-2px)}#gdh-search-extension-button:focus-visible{outline:3px solid #75baff;outline-offset:3px}@media(prefers-reduced-motion:reduce){#gdh-search-extension-button{transition:none}#gdh-search-extension-button:hover{transform:none}}';document.head.appendChild(style);toolbar.appendChild(button);if(form)form.before(toolbar);else document.body.prepend(toolbar);
 }
 addButton();
 if(isHome&&window.confirm(uiLang==='en'?'Open GDH Search?':'拡張検索を開きますか？'))toggle();
 const observer=new MutationObserver(addButton);observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);
})();

/* Runs only on the supplied GDH host, in the extension's isolated world. */
(function(){
 'use strict';
 const allowed='https://global-service.fa-cnc.idc-t.melco.co.jp';
 if(location.origin!==allowed||!location.pathname.startsWith('/cncservice/'))return;
 let panel=null,frame=null,channel=null,exportCsv=null,busy=false,closeButton=null,titleElement=null,uiLang='ja';
 const extensionOrigin='chrome-extension://'+chrome.runtime.id;
 function sourceForm(){const form=document.getElementById('frmmain');return form instanceof HTMLFormElement&&form.querySelector('[name="dataview_cd"]')?form:null;}
 function close(){if(busy)return false;panel?.remove();panel=null;frame=null;channel=null;exportCsv=null;return true;}
 function setHostLanguage(language){
  if(!['ja','en'].includes(language))return;uiLang=language;
  if(titleElement)titleElement.textContent=uiLang==='en'?'GDH Search':'GDH 拡張検索';
  if(closeButton){closeButton.textContent=uiLang==='en'?'Close':'閉じる';closeButton.setAttribute('aria-label',uiLang==='en'?'Close search':'拡張検索を閉じる');}
  if(panel)panel.setAttribute('aria-label',uiLang==='en'?'GDH Search':'GDH 拡張検索');
  if(frame)frame.title=uiLang==='en'?'CNC Machine Viewer':'CNC機械情報ビューア';
  const button=document.getElementById('gdh-search-extension-button');if(button){button.querySelector('[data-tool-label]').textContent=uiLang==='en'?'Extension tools':'拡張ツール';button.setAttribute('aria-label',uiLang==='en'?'Extension tools':'拡張ツール');}
 }
 function toggle(language){if(['ja','en'].includes(language))setHostLanguage(language);
  if(panel)return close()?{ok:true}:{ok:false,error:uiLang==='en'?'CSV retrieval is in progress. Close after it finishes.':'CSV取得中です。完了後に閉じてください。'};
  const form=sourceForm();if(!form)return {ok:false,error:uiLang==='en'?'Use this on the GDH machine search page.':'GDHの機械情報検索画面で使用してください。'};
  exportCsv=window.createGdhCsvExportAdapter({form,confirmExport:()=>window.confirm(uiLang==='en'?'Export a CSV file?':'CSVファイルを出力します。よろしいですか？')});channel=crypto.randomUUID();
  panel=document.createElement('div');panel.id='gdh-search-extension-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','GDH 拡張検索');
  panel.style.cssText='position:fixed;inset:12px;z-index:2147483646;background:#fff;border:1px solid #cbd6e5;border-radius:10px;box-shadow:0 8px 40px #0005;display:flex;flex-direction:column;overflow:hidden;';
  const bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#14243c;color:white;font:14px sans-serif;';
  const title=document.createElement('span');titleElement=title;title.textContent='GDH 拡張検索';closeButton=document.createElement('button');closeButton.textContent='閉じる';closeButton.setAttribute('aria-label','拡張検索を閉じる');closeButton.style.cssText='padding:6px 14px;cursor:pointer;';closeButton.addEventListener('click',close);bar.append(title,closeButton);
  frame=document.createElement('iframe');frame.title='CNC機械情報ビューア';frame.style.cssText='width:100%;flex:1;min-height:0;border:0;background:white;';
  const url=new URL(chrome.runtime.getURL('viewer.html'));url.searchParams.set('lang',uiLang);url.hash=new URLSearchParams({channel,hostOrigin:location.origin});frame.src=url.href;
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
  if(!sourceForm()||document.getElementById('gdh-search-extension-button'))return;
  if(!document.getElementById('gdh-tools-button-style')){
   const style=document.createElement('style');style.id='gdh-tools-button-style';style.textContent=`
    #gdh-search-extension-button{position:fixed;right:18px;bottom:18px;z-index:2147483645;display:flex;align-items:center;gap:9px;padding:10px 17px;border:1px solid #6ca6f4;border-radius:10px;background:linear-gradient(135deg,#287ceb,#1557ba);color:#fff;font:700 13px sans-serif;box-shadow:0 3px 8px #17478430,0 0 12px #3786ee20,inset 0 1px 0 #ffffff30;cursor:pointer;transition:filter .16s ease,transform .16s ease,box-shadow .16s ease}
    #gdh-search-extension-button svg{width:16px;height:16px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:1.7}
    #gdh-search-extension-button:hover{filter:brightness(1.08);transform:translateY(-1px);box-shadow:0 5px 12px #17478438,0 0 14px #3786ee28}
    #gdh-search-extension-button:focus-visible{outline:3px solid #85baff;outline-offset:3px}
    #gdh-search-extension-button:active{transform:translateY(0)}
    @media(prefers-reduced-motion:reduce){#gdh-search-extension-button{transition:none}#gdh-search-extension-button:hover{transform:none}}
   `;document.head.appendChild(style);
  }
  const button=document.createElement('button');button.id='gdh-search-extension-button';button.type='button';button.setAttribute('aria-label','拡張ツール');
  button.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m10 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 2v6m-3-3h6M19 16v6m-3-3h6"/></svg><span data-tool-label>拡張ツール</span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6"/></svg>';
  button.addEventListener('click',()=>toggle());document.body.appendChild(button);
 }
 addButton();
 const observer=new MutationObserver(addButton);observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);
})();

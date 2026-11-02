/* Runs only on the supplied GDH host, in the extension's isolated world. */
(function(){
 'use strict';
 const allowed='https://global-service.fa-cnc.idc-t.melco.co.jp';
 if(location.origin!==allowed||!location.pathname.startsWith('/cncservice/'))return;
 let panel=null,frame=null,channel=null,exportCsv=null,busy=false,closeButton=null;
 const extensionOrigin='chrome-extension://'+chrome.runtime.id;
 function sourceForm(){const form=document.getElementById('frmmain');return form instanceof HTMLFormElement&&form.querySelector('[name="dataview_cd"]')?form:null;}
 function close(){if(busy)return false;panel?.remove();panel=null;frame=null;channel=null;exportCsv=null;return true;}
 function toggle(){
  if(panel)return close()?{ok:true}:{ok:false,error:'CSV取得中です。完了後に閉じてください。'};
  const form=sourceForm();if(!form)return {ok:false,error:'GDHの機械情報検索画面で使用してください。'};
  exportCsv=window.createGdhCsvExportAdapter({form});channel=crypto.randomUUID();
  panel=document.createElement('div');panel.id='gdh-search-extension-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','GDH 拡張検索');
  panel.style.cssText='position:fixed;inset:12px;z-index:2147483646;background:#fff;border:1px solid #cbd6e5;border-radius:10px;box-shadow:0 8px 40px #0005;display:flex;flex-direction:column;overflow:hidden;';
  const bar=document.createElement('div');bar.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#14243c;color:white;font:14px sans-serif;';
  const title=document.createElement('span');title.textContent='GDH 拡張検索';closeButton=document.createElement('button');closeButton.textContent='閉じる';closeButton.setAttribute('aria-label','拡張検索を閉じる');closeButton.style.cssText='padding:6px 14px;cursor:pointer;';closeButton.addEventListener('click',close);bar.append(title,closeButton);
  frame=document.createElement('iframe');frame.title='CNC機械情報ビューア';frame.style.cssText='width:100%;flex:1;min-height:0;border:0;background:white;';
  const url=new URL(chrome.runtime.getURL('viewer.html'));url.hash=new URLSearchParams({channel,hostOrigin:location.origin});frame.src=url.href;
  panel.append(bar,frame);document.body.appendChild(panel);return {ok:true};
 }
 window.addEventListener('message',async event=>{
  const m=event.data;
  if(!frame||event.source!==frame.contentWindow||event.origin!==extensionOrigin||m?.channel!==channel)return;
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
 chrome.runtime.onMessage.addListener((message,_sender,respond)=>{if(message?.type==='GDH_SEARCH_TOGGLE'){try{respond(toggle());}catch(error){respond({ok:false,error:error.message});}}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel)close();});
 function addButton(){
  if(!sourceForm()||document.getElementById('gdh-search-extension-button'))return;
  const button=document.createElement('button');button.id='gdh-search-extension-button';button.type='button';button.textContent='拡張検索';button.style.cssText='position:fixed;right:18px;bottom:18px;z-index:2147483645;padding:12px 20px;border:0;border-radius:8px;background:#1768dc;color:white;font:700 14px sans-serif;box-shadow:0 3px 14px #0003;cursor:pointer;';button.addEventListener('click',toggle);document.body.appendChild(button);
 }
 addButton();
 const observer=new MutationObserver(addButton);observer.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);
})();

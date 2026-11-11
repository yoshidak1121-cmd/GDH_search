'use strict';
let language='ja';
const englishError='Open the GDH machine search page, reload it, and try again.';
document.getElementById('popupLanguage').addEventListener('change',event=>{
 language=event.target.value;document.documentElement.lang=language;
 document.querySelector('h1').textContent=language==='en'?'GDH Extension tools':'GDH 拡張ツール';
 document.querySelector('body>p').textContent=language==='en'?'Use this on the GDH machine search page.':'GDHの機械情報検索画面で使用します。';
 document.getElementById('open').textContent=language==='en'?'Open / close tools':'拡張ツールを開く／閉じる';document.getElementById('status').textContent='';
});
document.getElementById('open').addEventListener('click',async()=>{
 const status=document.getElementById('status');
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});if(!tab?.id)throw Error();
  const result=await chrome.tabs.sendMessage(tab.id,{type:'GDH_SEARCH_TOGGLE',language});
  if(!result?.ok){status.textContent=result?.error||(language==='en'?englishError:'GDHの機械情報検索画面を開いてください。');return;}
  window.close();
 }catch{status.textContent=language==='en'?englishError:'GDHの機械情報検索画面を開き、ページを再読み込みしてからお試しください。';}
});

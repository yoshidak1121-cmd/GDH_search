'use strict';
document.getElementById('open').addEventListener('click',async()=>{
 const status=document.getElementById('status');
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id)throw Error();
  const result=await chrome.tabs.sendMessage(tab.id,{type:'GDH_SEARCH_TOGGLE'});
  if(!result?.ok){status.textContent=result?.error||'GDHの機械情報検索画面を開いてください。';return;}
  window.close();
 }catch{status.textContent='GDHの機械情報検索画面を開き、ページを再読み込みしてからお試しください。';}
});

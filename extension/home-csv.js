/* Resolve an observed source path and request one-time, same-tab navigation. */
(function(){
 'use strict';
 window.createGdhHomeCsvExportAdapter=function({language=()=>'ja'}){
  let busy=false;
  return async function(){
   if(busy)throw Error('CSV取得を実行中です。');
   busy=true;
   try{
    const urls=new Set();
    for(const link of document.querySelectorAll('a[href]')){
     const label=[link.textContent,link.title,link.getAttribute('aria-label')].join('').replace(/\s/g,'');
     if(!/機械情報検索|machineinformationsearch|machinesearch/i.test(label))continue;
     try{const url=new URL(link.getAttribute('href'),document.baseURI);
      if(url.origin===location.origin&&!url.username&&!url.password&&/^\/cncservice\/viewcreator\/dataview\/list\/[^/]+\/?$/.test(url.pathname))urls.add(url.href);
     }catch{}
    }
    if(urls.size===0){
     const {gdhCsvSourcePath:path}=await chrome.storage.local.get('gdhCsvSourcePath');
     if(typeof path==='string'&&/^\/cncservice\/viewcreator\/dataview\/list\/[A-Za-z0-9_-]+\/?$/.test(path))urls.add(new URL(path,location.origin).href);
    }
    if(urls.size!==1)throw Error('取得元が未登録です。一度だけ機械情報検索画面を開いてからホームへ戻ってください。CSV取得は開始していません。');
    const path=new URL([...urls][0]).pathname;
    if(!/^\/cncservice\/viewcreator\/dataview\/list\/[A-Za-z0-9_-]+\/?$/.test(path))throw Error('取得元の画面パスを確認できません。');
    const result=await chrome.runtime.sendMessage({type:'GDH_CSV_NAVIGATE',path,language:language()});
    if(!result?.ok)throw Error('機械情報検索画面への移動を開始できませんでした。再度お試しください。');
    return {navigating:true};
   }finally{busy=false;}
  };
 };
})();

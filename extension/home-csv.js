/* Keep only an observed page path; read authentication from a fresh live form. */
(function(){
 'use strict';
 window.createGdhHomeCsvExportAdapter=function({confirmExport,timeoutMs=20000}){
  let busy=false;
  return async function(){
   if(busy)throw Error('CSV取得を実行中です。');
   busy=true;let frame,timer;
   try{
    if(!await confirmExport())throw Error('CSV出力を取り消しました。');
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
    frame=document.createElement('iframe');frame.hidden=true;frame.setAttribute('aria-hidden','true');
    frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms allow-downloads');
    await new Promise((resolve,reject)=>{
     timer=setTimeout(()=>reject(Error('機械情報検索画面の読み込みがタイムアウトしました。')),timeoutMs);
     frame.onload=()=>{clearTimeout(timer);resolve();};frame.onerror=()=>reject(Error('機械情報検索画面を読み込めませんでした。'));
     frame.src=[...urls][0];document.body.append(frame);
    });
    let doc;
    try{
     const url=new URL(frame.contentWindow.location.href);
     if(url.origin!==location.origin||!/^\/cncservice\/viewcreator\/dataview\/list\/[^/]+\/?$/.test(url.pathname))throw Error();
     doc=frame.contentDocument;
    }catch{throw Error('機械情報検索画面を確認できません。ログイン状態・権限を確認してください。');}
    const form=doc?.getElementById('frmmain');
    if(!form||!form.querySelector('[name="dataview_cd"]'))throw Error('機械情報検索画面のCSV出力フォームが見つかりません。');
    return await window.createGdhCsvExportAdapter({form,confirmExport:()=>true})();
   }finally{clearTimeout(timer);frame?.remove();busy=false;}
  };
 };
})();

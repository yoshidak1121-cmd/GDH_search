/* Non-blocking startup check: pinned public metadata, no cookies or GDH data. */
(function(){
 'use strict';
 const endpoint='https://api.github.com/repos/yoshidak1121-cmd/GDH_search/releases/latest';
 const tr=(ja,en)=>document.documentElement.lang==='en'?en:ja;
 const compare=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;};
 const current=chrome.runtime.getManifest().version;
 let latest=null,banner=null;
 function draw(){
  if(!latest||compare(latest,current)<=0)return;
  banner?.remove();banner=document.createElement('section');banner.className='gdh-update-banner';banner.setAttribute('role','status');
  const text=document.createElement('p');text.textContent=tr('最新版があります。バージョンアップしますか？','A newer version is available. Update now?')+' '+current+' → '+latest;
  const note=document.createElement('p');note.className='gdh-update-note';note.textContent=tr('更新後、このGDH画面を自動で再読み込みします。','This GDH page will reload automatically after updating.');
  const actions=document.createElement('div');actions.className='gdh-update-actions';
  const yes=document.createElement('button');yes.type='button';yes.textContent=tr('はい','Yes');yes.addEventListener('click',async()=>{
   yes.disabled=true;
   try{
    let tab=await chrome.tabs.getCurrent();if(!tab)[tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const result=await chrome.runtime.sendMessage({type:'GDH_UPDATE_START',confirmed:true,version:latest,language:document.documentElement.lang==='en'?'en':'ja',tabId:tab?.id});
    if(!result?.ok){text.textContent=tr('取得・点検中は更新できません。完了後にお試しください。','Finish the current retrieval before updating.');yes.disabled=false;}
   }catch{text.textContent=tr('更新案内を開き直してください。','Reopen the update guide.');yes.disabled=false;}
  });
  const no=document.createElement('button');no.type='button';no.className='secondary';no.textContent=tr('後で','Later');no.addEventListener('click',()=>{banner.remove();banner=null;latest=null;});
  actions.append(yes,no);banner.append(text,note,actions);document.body.prepend(banner);
 }
 async function check(){
  const {gdhReleaseInfo:cached}=await chrome.storage.local.get('gdhReleaseInfo');
  if(cached&&Date.now()-cached.checkedAt<300000&&/^\d+\.\d+\.\d+$/.test(cached.version)){latest=cached.version;draw();return;}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),7000);
  try{
   const response=await fetch(endpoint,{credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal,headers:{Accept:'application/vnd.github+json'}});
   if(!response.ok)return;
   const release=await response.json();
   if(release.draft!==false||release.prerelease!==false||!/^v\d+\.\d+\.\d+$/.test(release.tag_name||''))return;
   latest=release.tag_name.slice(1);
   const prefix='https://github.com/yoshidak1121-cmd/GDH_search/releases/download/'+release.tag_name+'/';
   if(compare(latest,current)>0&&!['GDH_Search_Setup_v'+latest+'.zip','SHA256SUMS_v'+latest+'.txt'].every(name=>release.assets?.some(asset=>asset.name===name&&asset.browser_download_url===prefix+name)))return;
   await chrome.storage.local.set({gdhReleaseInfo:{checkedAt:Date.now(),version:latest}});draw();
  }catch{}finally{clearTimeout(timer);}
 }
 new MutationObserver(draw).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 check().catch(()=>{});
})();

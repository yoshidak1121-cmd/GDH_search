'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const extension=path.resolve('dist/GDH_Search_Extension'),manifestFile=path.join(extension,'manifest.json');
(async()=>{
 const original=fs.readFileSync(manifestFile,'utf8'),current=JSON.parse(original).version;
 const parts=current.split('.').map(Number);parts[2]++;const next=parts.join('.');
 const prefix='https://github.com/yoshidak1121-cmd/GDH_search/releases/download/v'+next+'/';
 const release={tag_name:'v'+next,draft:false,prerelease:false,assets:['GDH_Search_Setup_v'+next+'.zip','SHA256SUMS_v'+next+'.txt'].map(name=>({name,browser_download_url:prefix+name}))};
 const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,ignoreDefaultArgs:['--disable-extensions'],args:['--enable-unsafe-extension-debugging']});
 try{
  let loads=0,checks=0,checkFailure=true;const otherRequests=[];
  const origin='https://global-service.fa-cnc.idc-t.melco.co.jp';
  await context.route(/^https?:/,route=>{
   const url=new URL(route.request().url());
   if(url.href==='https://api.github.com/repos/yoshidak1121-cmd/GDH_search/releases/latest'){checks++;if(checkFailure)return route.fulfill({status:403,body:'rate limited'});assert.equal(route.request().headers().cookie,undefined);return route.fulfill({contentType:'application/json',body:JSON.stringify(release)});}
   if(url.href===origin+'/cncservice/synthetic-update'){
    loads++;return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fixture '+loads+'</h1><form id="frmmain" method="post"><input name="dataview_cd" value="synthetic-view"></form>'});
   }
   otherRequests.push(url.href);return route.abort();
  });
  const extensionsPage=await context.newPage();await extensionsPage.goto('chrome://extensions/');
  const developerMode=extensionsPage.locator('extensions-toolbar #devMode');await developerMode.waitFor();
  if(!await developerMode.evaluate(element=>element.checked))await developerMode.click();
  assert.equal(await developerMode.evaluate(element=>element.checked),true);
  const cdp=await context.browser().newBrowserCDPSession();const registered=await cdp.send('Extensions.loadUnpacked',{path:extension});
  const host=await context.newPage();await host.goto(origin+'/cncservice/synthetic-update');
  await host.locator('#gdh-search-extension-button').click();
  const frame=host.frameLocator('#gdh-search-extension-panel iframe');
  await frame.locator('.gdh-update-check').filter({hasText:'HTTP 403'}).waitFor();
  assert.equal(await frame.locator('.gdh-update-banner').count(),0);
  await frame.locator('body').evaluate(()=>chrome.storage.local.set({gdhReleaseInfo:{checkedAt:Date.now(),version:chrome.runtime.getManifest().version}}));
  checkFailure=false;await frame.getByRole('button',{name:'再確認',exact:true}).click();
  await frame.locator('.gdh-update-banner').filter({hasText:'最新版があります'}).waitFor();assert.equal(checks,2);
  await frame.locator('body').evaluate(()=>chrome.runtime.sendMessage({type:'GDH_UPDATE_STATUS'}));
  let worker,ready=false;
  for(let attempt=0;attempt<30&&!ready;attempt++){
   worker=context.serviceWorkers().filter(item=>item.url().startsWith('chrome-extension://'+registered.id+'/')).at(-1);
   if(worker)try{await worker.evaluate(()=>{
   chrome.runtime.connectNative=()=>{
    let receive;
    globalThis.fixtureNativeMessages=[];
    const port={onMessage:{addListener:listener=>receive=listener},onDisconnect:{addListener(){}},disconnect(){},postMessage:message=>{globalThis.fixtureNativeMessages.push(message);}};
    globalThis.fixtureNativeReply=message=>receive(message);return port;
   };
   });ready=true;}catch{}
   if(!ready)await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert(ready,'Registered unpacked extension worker ready');
  const guidePromise=context.waitForEvent('page');await frame.getByRole('button',{name:'はい',exact:true}).click();
  const guide=await guidePromise;await guide.waitForLoadState();
  await guide.locator('#updateStatus').filter({hasText:'取得・確認'}).waitFor();
  const messages=await worker.evaluate(()=>globalThis.fixtureNativeMessages);
  assert.deepEqual(messages,[{action:'update',version:next}]);
  assert.equal(loads,1);
  // The synthetic helper replaces only this ignored build manifest, then reports success.
  fs.writeFileSync(manifestFile,JSON.stringify({...JSON.parse(original),version:next}));
  await worker.evaluate(version=>{setTimeout(()=>globalThis.fixtureNativeReply({ok:true,version}),10);},next);
  await host.getByRole('heading',{name:'Fixture 2',exact:true}).waitFor({timeout:30000});
  assert.equal(loads,2);assert.deepEqual(otherRequests,[]);
  const newWorker=context.serviceWorkers().filter(item=>item.url().startsWith('chrome-extension://'+registered.id+'/')).at(-1);assert(newWorker);
  const state=await newWorker.evaluate(()=>gdhUpdateState);assert.equal(state.phase,'done');assert.equal(state.reloaded,1);
  const pending=await newWorker.evaluate(()=>chrome.storage.local.get('gdhUpdatePending'));assert.equal(pending.gdhUpdatePending,undefined);
  if(!guide.isClosed())await guide.locator('#updateStatus').filter({hasText:'更新完了'}).waitFor();
  console.log('PASS: visible HTTP failure, manual retry bypasses cache, startup GitHub check without cookies, exact update prompt, Yes starts native version-only request, replaced files are reloaded, original GDH document receives exactly one automatic F5, pending state cleared');
 }finally{await context.close();fs.writeFileSync(manifestFile,original);}
})().catch(error=>{console.error(error);process.exitCode=1;});

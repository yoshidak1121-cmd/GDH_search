'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const origin='https://global-service.fa-cnc.idc-t.melco.co.jp';
const rpc='/cncservice/tablemaintenance(2f)views(2f)table(5f)edit.jssprpc';
const columns=['contract_id','contract_no','contract_type','contract_period','contract_start_date','contract_end_date','contract_from_location_code','contractor_id','contract_notes','nc_serial_no','del_flg','ins_user_id','upd_user_id','ins_date','ins_id','ins_pgmid','upd_date','upd_id','upd_pgmid'];
(async()=>{
 const extension=path.resolve('dist/GDH_Search_Extension');
 const context=await chromium.launchPersistentContext('',{channel:'chromium',headless:true,args:['--disable-extensions-except='+extension,'--load-extension='+extension]});
 try{
  let mode='success',posts=[],blocked=[],release;
  const rows=Array.from({length:100},(_,i)=>({...Object.fromEntries(columns.map(c=>[c,c==='contract_notes'?'SYNTHETIC-PRIVATE-RECORD':null])),contract_id:i===0?'':i===1?'01':i===2?'1':i===3?1:'SYNTHETIC-ID-'+i,contract_no:'SYNTHETIC-NO-'+i,nc_serial_no:'SYNTHETIC-NC-'+Math.floor(i/2),contractor_id:'SYNTHETIC-PARTY-'+Math.floor(i/5)}));
  const html=`<!doctype html><title>synthetic table</title><script>
   window.createRequestData=()=>({db_source:'ZALS',tablename:'ZGDDTB_CONTRACT_INFO',pagenumber:'3',pageline:'50',isphysicalname:undefined,searches:{tm_seach_fieldname__contract_id:''}});
   window.ImJson={toJSONString:args=>JSON.stringify(args,(key,value)=>value===undefined?'__UNDEFINED__':value).replaceAll('"__UNDEFINED__"','undefined')};
   window.ImAjax={setContentTypeAndReqHeaders:(xhr,type)=>{xhr.setRequestHeader('Content-Type',type);xhr.setRequestHeader('X-Fixture','present');return xhr;}};
   window.ImJsspRpc={receive:xhr=>JSON.parse(xhr.responseText)};
   window.server={getData:function(){var argsArray=[];return ImJsspRpc.sendJsspRpcRequest('${origin}${rpc}?im_mark=SYNTHETIC-CURRENT&im_func=getData&im_from=tablemaintenance(2f)views(2f)table(5f)edit', argsArray, null, null, 'post');}};
  </script>`;
  await context.route(/^https?:/,async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===origin&&url.pathname==='/cncservice/synthetic-table')return route.fulfill({contentType:'text/html',body:html});
   if(url.origin===origin&&url.pathname===rpc){
    posts.push({url:req.url(),method:req.method(),body:req.postData(),headers:req.headers()});
    if(mode==='hold')await new Promise(resolve=>{release=resolve;});
    if(mode==='auth')return route.fulfill({status:403,body:'forbidden'});
    if(mode==='html')return route.fulfill({contentType:'text/html',body:'<html>login</html>'});
    if(mode==='http')return route.fulfill({status:500,body:'error'});
    if(mode==='invalid')return route.fulfill({contentType:'application/json',body:'{"data":undefined}'});
    if(mode==='script')return route.fulfill({contentType:'application/json',body:'({error:false,data:[],attack:(window.fixtureAttack=true)})'});
    if(mode==='extended')return route.fulfill({contentType:'application/json',body:JSON.stringify({error:false,data:rows}).replace('"contract_period":null','"contract_period":undefined')});
    if(mode==='empty')return route.fulfill({contentType:'application/json',body:'{"error":false,"data":[]}'});
    return route.fulfill({contentType:'application/json',body:JSON.stringify({error:false,data:rows})});
   }
   blocked.push(req.url());return route.abort();
  });
  const host=await context.newPage();await host.goto(origin+'/cncservice/synthetic-table');
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const base=worker.url().replace(/\/[^/]*$/,'');
  const ui=await context.newPage();await ui.goto(base+'/validation.html');
  await ui.locator('#liveRefresh').click();
  const tabs=await ui.locator('#liveTab option').evaluateAll(options=>options.map(x=>x.value).filter(Boolean));assert.equal(tabs.length,1);
  const tabId=Number(tabs[0]);await ui.locator('#liveTab').selectOption(String(tabId));
  const send=()=>ui.evaluate(tabId=>chrome.runtime.sendMessage({type:'GDH_GETDATA_READ',tabId,confirmed:true}),tabId);
  assert.equal((await send()).code,'MODE_OFF');assert.equal(posts.length,0);
  await ui.locator('#validationEnabled').check();
  let accept=false;ui.on('dialog',dialog=>accept?dialog.accept():dialog.dismiss());
  await ui.locator('#liveRun').click();assert.equal(posts.length,0);
  accept=true;await ui.locator('#liveRun').click();
  await ui.locator('#validationResult').filter({hasText:'本番読み取り成功：100件・19項目'}).waitFor();
  await ui.locator('#schemaReview summary').first().click();
  assert.equal(await ui.locator('#schemaRows tr').count(),19);assert.equal(await ui.locator('#unavailableCsv li').count(),24);assert.equal(await ui.locator('#keyRows tr').count(),4);
  assert(!(await ui.locator('body').textContent()).includes('SYNTHETIC-ID-'));
  assert.equal(posts.length,1);assert.equal(posts[0].method,'POST');assert.equal(posts[0].headers['x-fixture'],'present');
  const payload=JSON.parse(posts[0].body.replace(/\bundefined\b/g,'null'));
  assert.equal(payload.length,1);assert.equal(payload[0].pagenumber,'1');assert.equal(payload[0].pageline,'100');assert(posts[0].body.includes('undefined'));
  assert.equal(await host.evaluate(()=>createRequestData().pagenumber),'3');
  assert(!(await ui.locator('body').textContent()).includes('SYNTHETIC-PRIVATE-RECORD'));
  const result=await send();assert.equal(result.ok,true);assert(!('data' in result));assert(!JSON.stringify(result).includes('SYNTHETIC-CURRENT'));assert(!JSON.stringify(result).includes('SYNTHETIC-ID-'));
  const contractKey=result.keyChecks.find(row=>row.field==='contract_id'),ncKey=result.keyChecks.find(row=>row.field==='nc_serial_no');
  assert.equal(contractKey.blankCount,1);assert.equal(contractKey.nonStringCount,1);assert.equal(contractKey.distinctCount,99);assert.equal(contractKey.duplicateValues,0);
  assert.equal(ncKey.distinctCount,50);assert.equal(ncKey.duplicateValues,50);assert.equal(ncKey.duplicateRows,100);
  for(const [testMode,code] of [['auth','AUTH_REQUIRED'],['html','AUTH_REQUIRED'],['http','HTTP_ERROR'],['invalid','INVALID_RESPONSE'],['script','INVALID_RESPONSE']]){mode=testMode;assert.equal((await send()).code,code);}
  assert.equal(await host.evaluate(()=>window.fixtureAttack),undefined);
  await host.evaluate(()=>{ImJsspRpc.receive=xhr=>JSON.parse(xhr.responseText.replace(/"(?:[^"\\]|\\.)*"|\bundefined\b/g,token=>token==='undefined'?'null':token));});
  mode='extended';assert.equal((await send()).summary.count,100);
  mode='empty';const empty=await send();assert.equal(empty.summary.count,0);assert(empty.keyChecks.every(row=>row.blankCount===0&&row.distinctCount===0&&row.duplicateRows===0));
  await host.evaluate(()=>{window.savedSetTimeout=window.setTimeout;window.setTimeout=(callback,ms,...args)=>ms===15000?(queueMicrotask(callback),0):savedSetTimeout(callback,ms,...args);});
  assert.equal((await send()).code,'TIMEOUT');
  await host.evaluate(()=>{window.setTimeout=window.savedSetTimeout;delete window.savedSetTimeout;});
  mode='hold';const first=send();
  await host.waitForFunction(()=>true);while(!release)await new Promise(r=>setTimeout(r,10));
  assert.equal((await send()).code,'BUSY');release();assert.equal((await first).ok,true);
  const before=posts.length;
  await host.evaluate(()=>{window.createRequestData=()=>({db_source:'ZALS',tablename:'OTHER'});});
  assert.equal((await send()).code,'WRONG_TABLE');assert.equal(posts.length,before);
  await host.reload();await host.evaluate(()=>{server.getData=function(){var argsArray=[];return ImJsspRpc.sendJsspRpcRequest('https://example.com/?im_mark=SYNTHETIC',argsArray,null,null,'post');};});
  assert.equal((await send()).code,'RPC_UNCONFIRMED');assert.equal(posts.length,before);
  const popup=await context.newPage();await popup.goto(base+'/popup.html');
  assert.equal(await popup.evaluate(tabId=>chrome.runtime.sendMessage({type:'GDH_GETDATA_READ',tabId,confirmed:true}),tabId),undefined);
  await popup.close();await ui.locator('#validationClose').click();assert.equal((await send()).code,'MODE_OFF');
  const saved=await ui.evaluate(()=>chrome.storage.local.get(null));assert.deepEqual(saved,{gdhGetDataValidationEnabled:false});
  assert.deepEqual(blocked,[]);
  console.log('PASS: real MV3 worker/MAIN transport, explicit confirmation/OFF gate, current RPC URL, native serializer/security headers/receiver, 1 page/100 max, metadata only, HTTP/auth/invalid/empty, duplicate guard, wrong table/URL/sender, no records/tokens saved, synthetic routes only');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

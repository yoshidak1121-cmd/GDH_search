'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const origin='https://global-service.fa-cnc.idc-t.melco.co.jp';
const fixture=`<!doctype html><meta charset="utf-8"><title>機械情報 登録／更新</title><h1>機械情報 登録 / 更新</h1>
<form id="fixture"><table><tbody>
<tr><th><label for="nc">NCシステム型名</label></th><td><input id="nc" readonly value="SYNTHETIC-PRIVATE-NC"><button type="button" id="lookup">参照</button></td></tr>
<tr><th><label for="machine">工作機械モデル番号</label></th><td><input id="machine" readonly value="SYNTHETIC-PRIVATE-MACHINE"></td></tr>
<tr><th><label for="serial">NCシリアル番号 *</label></th><td><input id="serial" required maxlength="60"></td></tr>
<tr><th><label for="company">販売会社</label></th><td><select id="company"><option>SYNTHETIC-PRIVATE-CUSTOMER</option></select></td></tr>
<tr><th><label for="memo">機械メモ</label></th><td><textarea id="memo">SYNTHETIC-PRIVATE-MEMO</textarea></td></tr>
<tr><th><label for="secretToken">サービスセンター</label></th><td><input id="secretToken" value="SYNTHETIC-PRIVATE-TOKEN"></td></tr>
</tbody></table><input type="hidden" name="machinery_tool_id" value="SYNTHETIC-PRIVATE-ID"><input type="hidden" name="im_mark" value="SYNTHETIC-PRIVATE-MARK"><input type="password" value="SYNTHETIC-PRIVATE-PASSWORD"><button id="save" type="submit">登録</button><button id="allocate" type="button">仮採番</button></form>
<script>window.writes=0;document.querySelector('form').onsubmit=e=>{e.preventDefault();window.writes++};document.querySelector('#allocate').onclick=()=>window.writes++;
document.querySelector('#lookup').onclick=()=>{const frame=document.createElement('iframe');frame.id='dialog';frame.style='width:700px;height:350px';frame.src='/cncservice/synthetic-lookup?secret=SYNTHETIC-PRIVATE-URL';document.body.append(frame);};</script>`;
const lookup=`<!doctype html><meta charset="utf-8"><title>一覧選択画面</title><table><tbody><tr><th>NCシステム型名</th><td><input id="query"></td><td><select><option>を含む</option><option>と一致する</option><option>から始まる</option><option>で終わる</option></select></td></tr></tbody></table><button id="choose">選択</button><script>document.querySelector('#choose').onclick=()=>{parent.document.querySelector('#nc').value='SYNTHETIC-PRIVATE-NEW-NC';parent.document.querySelector('#machine').value='';parent.document.querySelector('[name=machinery_tool_id]').value='';parent.document.querySelector('#dialog').remove();};</script>`;
async function until(operation,predicate,message){
 const end=Date.now()+6000;let result;
 while(Date.now()<end){result=await operation();if(predicate(result))return result;await new Promise(resolve=>setTimeout(resolve,100));}
 assert.fail(message+' '+JSON.stringify(result));
}
(async()=>{
 const extension=path.resolve('dist/GDH_Search_Extension');
 const context=await chromium.launchPersistentContext('',{channel:process.env.TEST_CHROMIUM_EXECUTABLE?undefined:'chromium',executablePath:process.env.TEST_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-extensions-except='+extension,'--load-extension='+extension]});
 try{
  const requests=[];
  await context.route(/^https?:/,async route=>{
   const request=route.request(),url=new URL(request.url());requests.push({method:request.method(),path:url.pathname});
   if(url.origin===origin&&url.pathname==='/cncservice/synthetic-registration')return route.fulfill({contentType:'text/html',body:fixture});
   if(url.origin===origin&&url.pathname==='/cncservice/synthetic-lookup')return route.fulfill({contentType:'text/html',body:lookup});
   return route.abort();
  });
  const host=await context.newPage();await host.goto(origin+'/cncservice/synthetic-registration');
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  const base=worker.url().replace(/\/[^/]*$/,'');
  const popup=await context.newPage();await popup.goto(base+'/popup.html');
  await popup.locator('#popupLanguage').selectOption('en');
  assert.equal(await popup.locator('#investigationLink').textContent(),'Investigate registration form');
  assert.equal(await popup.locator('h1+p').textContent(),'Use this on the GDH home or machine search page.');
  await popup.close();
  const ui=await context.newPage();await ui.goto(base+'/investigation.html');
  await until(()=>ui.locator('#findTabs').isEnabled(),Boolean,'UI ready');
  assert.equal(await ui.locator('#copyInvestigation').isDisabled(),true);
  assert.equal(await worker.evaluate(async()=>!!(await chrome.storage.local.get('gdhRegistrationInvestigation')).gdhRegistrationInvestigation),false);
  await ui.locator('#findTabs').click();await ui.locator('#startInvestigation').click();
  const read=()=>worker.evaluate(async()=>(await chrome.storage.local.get('gdhRegistrationInvestigation')).gdhRegistrationInvestigation);
  let report=await until(read,r=>r?.current?.screens?.[0]?.fields.length>=6,'initial schema');
  assert(report.current.screens[0].fields.some(f=>f.label==='NCシリアル番号'&&f.required&&f.maxLength===60));
  assert.equal(await host.evaluate(()=>writes),0);assert.equal(await host.locator('iframe').count(),0,'no automatic click');
  assert.equal(JSON.stringify(report).includes('SYNTHETIC-PRIVATE'),false);
  assert.equal(JSON.stringify(report).includes('im_mark'),false);
  await host.locator('#lookup').click();
  report=await until(read,r=>r?.schemas.some(s=>s.fields.some(f=>f.searchOperators?.includes('と一致する'))),'iframe operator schema');
  const schemaCount=report.schemas.length;
  await host.frameLocator('#dialog').locator('#choose').click();
  report=await until(read,r=>r?.transitions.some(t=>t.label==='工作機械モデル番号'&&t.change==='cleared'),'field disappearance');
  assert(report.transitions.some(t=>t.label==='NCシステム型名'&&t.change==='changed'));
  assert(report.transitions.some(t=>t.label==='内部項目（候補）：machinery_tool_id'&&t.change==='cleared'));
  assert(report.schemas.length>=schemaCount,'closed iframe schema retained');
  assert(report.events.some(e=>e.action==='選択'));
  await host.evaluate(()=>{document.querySelector('#machine').value='SYNTHETIC-PRIVATE-RESTORED';document.querySelector('[name=machinery_tool_id]').value='SYNTHETIC-PRIVATE-RESTORED-ID';});
  report=await until(read,r=>r?.transitions.some(t=>t.label==='工作機械モデル番号'&&t.change==='filled'),'silent value property change');
  assert.equal(JSON.stringify(report).includes('SYNTHETIC-PRIVATE'),false,'values and token URLs never exported');
  await ui.locator('#stopInvestigation').click();
  report=await until(read,r=>r?.status==='stopped','stopped report persisted');
  assert.equal(await host.evaluate(()=>writes),0);assert(requests.every(r=>r.method==='GET'),'observer sends no writes');
  assert.equal(requests.filter(r=>r.path.includes('synthetic-lookup')).length,1,'only manual lookup navigation');
  const savedRevision=report.revision;
  await host.evaluate(()=>document.querySelector('#machine').value='SYNTHETIC-PRIVATE-AFTER-STOP');
  await new Promise(resolve=>setTimeout(resolve,350));
  const snap=await worker.evaluate(async(session)=>{const [tab]=await chrome.tabs.query({url:'https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/synthetic-registration'});const [r]=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',func:s=>window.__gdhRegistrationObservationV1.snapshot(),args:[session]});return r.result;},report.sessionId);
  assert.equal(snap.revision,savedRevision,'stopped observer no longer samples');
  await ui.reload();await until(()=>ui.locator('#copyInvestigation').isEnabled(),Boolean,'saved report restored');
  assert.equal((await read()).revision,savedRevision,'opening result never restarts recording');
  await ui.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async()=>{throw Error('fixture denied');}},configurable:true}));
  await ui.locator('#copyInvestigation').click();assert.equal(await ui.locator('#reportText').isVisible(),true);
  assert.equal((await ui.locator('#reportText').inputValue()).includes('SYNTHETIC-PRIVATE'),false);
  await ui.locator('#clearInvestigation').click();await until(read,r=>!r,'delete saved record');
  // A new recording must stop safely after a real navigation and retain partial output.
  await ui.locator('#findTabs').click();await ui.locator('#startInvestigation').click();
  await until(read,r=>r?.status==='recording','restart explicitly');
  await host.reload();report=await until(read,r=>r?.status==='interrupted','navigation interrupts rather than auto-injecting');
  assert.equal(JSON.stringify(report).includes('SYNTHETIC-PRIVATE'),false);
  // An unrelated page is rejected before installing a new recorder.
  await host.evaluate(()=>{document.title='Unrelated page';document.body.replaceChildren(document.createElement('p'));});
  await ui.locator('#startInvestigation').click();
  await until(()=>ui.locator('#investigationStatus').textContent(),s=>s.includes('「機械情報 登録／更新」を開いて'),'wrong screen rejected');
  assert.equal(await host.evaluate(()=>!!window.__gdhRegistrationObservationV1),false);
  console.log('form investigation: MV3 injection, no writes, private values excluded, iframe schema, silent resets, stop, persistence, copy fallback, navigation and wrong-screen checks passed');
 }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

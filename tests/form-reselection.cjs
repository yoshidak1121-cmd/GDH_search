'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:process.env.TEST_CHROMIUM_EXECUTABLE?undefined:'chromium',executablePath:process.env.TEST_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage();
 await page.route('https://global-service.fa-cnc.idc-t.melco.co.jp/**',r=>r.fulfill({contentType:'text/html',body:'<h1>機械情報 登録／更新</h1>'}));
 for(const scenario of ['same','duplicate','unmarked','absent','empty','changed','timeout','stop','manual']){
  await page.goto('https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/test');
  await page.evaluate(scenario=>{
   const labels=['NCシステム型名','工作機械モデル番号','サービスセンター'];
   window.selected=0;window.writes=0;
   document.body.innerHTML='<h1>機械情報 登録／更新</h1><form><table>'+['NCシリアル番号',...labels].map((label,i)=>`<tr><th>${label}</th><td><input readonly value="${scenario==='empty'?'':'PRIVATE-'+i}">${i?'<button type="button" class="lookup" title="検索">参照</button>':''}</td></tr>`).join('')+'</table><button type="submit">保存</button></form>';
   document.querySelector('form').onsubmit=e=>{e.preventDefault();writes++};
   for(const b of document.querySelectorAll('.lookup'))b.onclick=()=>{
    const label=b.closest('tr').querySelector('th').textContent;
    const input=b.parentElement.querySelector('input');
    const d=document.createElement('div');d.setAttribute('role','dialog');
    const row=`<tr ${scenario==='unmarked'?'':'aria-selected="true"'}><td>${scenario==='absent'?'OTHER':input.value}</td><td><button type="button" class="choose">選択</button></td></tr>`;
    d.innerHTML='<h2>一覧選択画面</h2><button type="button" title="閉じる">閉じる</button><table><tr><th>'+label+'</th><th>操作</th></tr>'+row+(scenario==='duplicate'?row:'')+'</table>';
    d.querySelector('[title]').onclick=()=>d.remove();
    for(const choose of d.querySelectorAll('.choose'))choose.onclick=()=>{selected++;if(scenario==='changed')document.querySelector('input').value='PRIVATE-CHANGED';if(scenario!=='timeout')d.remove();};
    document.body.append(d);
   };
  },scenario);
  await page.addScriptTag({path:path.resolve('extension/form-investigation.js')});
  await page.addScriptTag({path:path.resolve('extension/form-tour.js')});
  const id='synthetic-session-123456';
  assert((await page.evaluate(id=>observeGdhRegistration('start',id,'machine'),id)).ok);
  assert((await page.evaluate(id=>stepGdhFormTour('start',id,{scope:'machine',reselectCurrent:true}),id)).ok);
  let result;const end=Date.now()+25000;
  do{
   result=await page.evaluate(id=>stepGdhFormTour('step',id,{expiresAt:Date.now()+2500}),id);
   if(scenario==='stop'&&result.actions===1)await page.evaluate(id=>stepGdhFormTour('stop',id),id);
   if(scenario==='manual'&&result.actions===1)await page.locator('h1').click();
   if(result.status!=='running')break;
   await page.waitForTimeout(100);
  }while(Date.now()<end);
  const selected=await page.evaluate(()=>selected);
  if(scenario==='same'){assert.equal(result.status,'completed');assert.equal(selected,3);assert.equal(result.log.filter(x=>x.status==='same-value-observed').length,3);}
  else if(scenario==='changed'){assert.equal(result.status,'form-changed');assert.equal(selected,1);}
  else if(scenario==='timeout'){assert.equal(result.status,'selection-timeout');assert.equal(selected,1);}
  else if(scenario==='stop'){assert.equal(result.status,'stopped');assert.equal(selected,0);}
  else if(scenario==='manual'){assert.equal(result.status,'user-interaction');assert.equal(selected,0);}
  else{assert.equal(result.status,'partial',scenario);assert.equal(selected,0);assert(result.log.some(x=>x.status.startsWith('skipped-')));}
  assert.equal(await page.evaluate(()=>writes),0);
  const report=await page.evaluate(id=>observeGdhRegistration('stop',id),id);
  assert(!JSON.stringify({result,report}).includes('PRIVATE'));
  console.log('PASS',scenario);
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

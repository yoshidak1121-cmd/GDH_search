'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:process.env.TEST_CHROMIUM_EXECUTABLE?undefined:'chromium',executablePath:process.env.TEST_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage();
 await page.route('https://global-service.fa-cnc.idc-t.melco.co.jp/**',r=>r.fulfill({contentType:'text/html',body:'<h1>機械情報 登録／更新</h1>'}));
 for(const scenario of ['same','duplicate','unmarked','absent','empty','changed','timeout','stop','manual','diag-split','diag-empty','diag-cap','diag-stop','diag-search','diag-search-timeout','diag-search-ambiguous','diag-search-stop']){
  await page.goto('https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/test');
  await page.evaluate(scenario=>{
   const labels=['NCシステム型名','工作機械モデル番号','サービスセンター'];
   window.selected=0;window.writes=0;
   document.body.innerHTML='<h1>機械情報 登録／更新</h1><form><table>'+['NCシリアル番号',...labels].map((label,i)=>`<tr><th>${label}</th><td><input readonly value="${['empty','diag-empty'].includes(scenario)?'':'PRIVATE-'+i}">${i?'<button type="button" class="lookup" title="検索">参照</button>':''}</td></tr>`).join('')+'</table><button type="submit">保存</button></form>';
   document.querySelector('form').onsubmit=e=>{e.preventDefault();writes++};
   for(const b of document.querySelectorAll('.lookup'))b.onclick=()=>{
    const label=b.closest('tr').querySelector('th').textContent;
    const input=b.parentElement.querySelector('input');
    const d=document.createElement('div');d.setAttribute('role','dialog');
    const row=`<tr ${scenario==='unmarked'?'':'aria-selected="true"'}><td>${scenario==='absent'?'OTHER':input.value}</td><td><button type="button" class="choose">選択</button></td></tr>`;
    d.innerHTML='<h2>一覧選択画面</h2><button type="button" title="閉じる">閉じる</button><table><tr><th>'+label+'</th><th>操作</th></tr>'+row+(scenario==='duplicate'?row:'')+'</table>';
    d.querySelector('[title]').onclick=()=>d.remove();
    for(const choose of d.querySelectorAll('.choose'))choose.onclick=()=>{selected++;if(scenario==='changed')document.querySelector('input').value='PRIVATE-CHANGED';if(scenario!=='timeout')d.remove();};
    if(scenario.startsWith('diag-')){
     const old=d.querySelector('table');const grid=document.createElement('div');grid.className='ui-jqgrid';
     grid.innerHTML='<div class="ui-jqgrid-hdiv"><table><tr><th>'+label+'</th><th>PRIVATE-UNKNOWN-HEADER</th></tr></table></div><div class="ui-jqgrid-bdiv"><table><tr class="jqgfirstrow"><td></td><td></td></tr>'+Array.from({length:scenario==='diag-cap'?510:1},()=>'<tr aria-selected="true" id="PRIVATE-ID" onclick="window.writes++"><td>'+input.value+'</td><td><a href="https://private.invalid/?token=PRIVATE-TOKEN">PRIVATE-CUSTOMER</a><button type="button">選択</button></td></tr>').join('')+'</table></div>';
     old.replaceWith(grid);
    }
    if(scenario.startsWith('diag-search')){
     const search=document.createElement('div');search.innerHTML='<input type="text"><button type="button">検索</button>';
     if(scenario==='diag-search-ambiguous')search.append(document.createElement('input'));
     d.prepend(search);
     const body=d.querySelector('.ui-jqgrid-bdiv table');
     body.querySelectorAll('tr:not(.jqgfirstrow) td:first-child').forEach(c=>c.textContent='OTHER');
     search.querySelector('button').onclick=()=>{
      if(scenario==='diag-search-timeout')return;
      setTimeout(()=>{body.querySelector('tr:not(.jqgfirstrow) td').textContent=search.querySelector('input').value;},200);
     };
    }
    document.body.append(d);
   };
  },scenario);
  await page.addScriptTag({path:path.resolve('extension/form-investigation.js')});
  await page.addScriptTag({path:path.resolve('extension/form-tour.js')});
  const id='synthetic-session-123456';const diagnostic=scenario.startsWith('diag-');
  assert((await page.evaluate(id=>observeGdhRegistration('start',id,'machine'),id)).ok);
  assert((await page.evaluate(({id,diagnostic,searchCurrent})=>stepGdhFormTour('start',id,{scope:'machine',reselectCurrent:true,diagnoseLookup:diagnostic,searchCurrent}),{id,diagnostic,searchCurrent:scenario.startsWith('diag-search')})).ok);
  let result;const end=Date.now()+25000;
  do{
   result=await page.evaluate(id=>stepGdhFormTour('step',id,{expiresAt:Date.now()+2500}),id);
   if((scenario==='stop'||scenario==='diag-stop')&&result.actions===1)await page.evaluate(id=>stepGdhFormTour('stop',id),id);
   if(scenario==='diag-search-stop'&&result.log.some(x=>x.status==='searching-current'))await page.evaluate(id=>stepGdhFormTour('stop',id),id);
   if(scenario==='manual'&&result.actions===1)await page.locator('h1').click();
   if(result.status!=='running')break;
   await page.waitForTimeout(100);
  }while(Date.now()<end);
  const selected=await page.evaluate(()=>selected);
  if(diagnostic){
   assert.equal(selected,0);
   if(scenario==='diag-search-timeout'){assert.equal(result.status,'search-timeout');assert.equal(result.lookupDiagnostics.length,0);}
   else if(scenario==='diag-search-stop'){assert.equal(result.status,'stopped');assert.equal(result.lookupDiagnostics.length,0);}
   else if(scenario==='diag-stop'){assert.equal(result.status,'stopped');assert.equal(result.lookupDiagnostics.length,0);}
   else{
    assert.equal(result.status,scenario==='diag-search-ambiguous'?'partial':'completed');assert.equal(result.lookupDiagnostics.length,3);
    for(const d of result.lookupDiagnostics){
     const body=d.tables.find(t=>t.headerAndBodySeparated);
     assert(body,'split header detected');assert.equal(body.matchingColumnCount,1);
     assert.equal(body.inlineClickRows,scenario==='diag-cap'?500:1);
     assert.equal(body.matchingRows,['diag-empty','diag-search-ambiguous'].includes(scenario)?0:scenario==='diag-cap'?500:1);
     assert.equal(d.truncated,scenario==='diag-cap');
     assert(body.splitHeaderColumns.includes('unknown'));
     if(scenario==='diag-search')assert.equal(d.searchStatus,'search-results-observed');
     if(scenario==='diag-search-ambiguous')assert.equal(d.searchStatus,'search-unrecognized');
    }
   }
  }
  else if(scenario==='same'){assert.equal(result.status,'completed');assert.equal(selected,3);assert.equal(result.log.filter(x=>x.status==='same-value-observed').length,3);}
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

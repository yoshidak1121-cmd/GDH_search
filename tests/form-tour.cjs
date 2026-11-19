'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const origin='https://global-service.fa-cnc.idc-t.melco.co.jp';
const scopes={machine:['NCシステム型名','工作機械モデル番号','サービスセンター'],契約情報:['契約ID','契約元拠点','契約者'],販売情報:['販売ID','販売会社','機械代理店','機械代理店住所'],出荷情報:['出荷ID','輸出国','輸入国'],設置先情報:['設置ID','エンドユーザー','設置先住所']};
function fixture(scope){return `<!doctype html><meta charset="utf-8"><title>${scope==='machine'?'機械情報 登録／更新':scope}</title><h1>${scope==='machine'?'機械情報 登録／更新':scope}</h1><form><table><tr><th>NCシリアル番号</th><td><input readonly value="SYNTHETIC-PRIVATE-SERIAL"></td></tr>${scopes[scope].map((label,i)=>`<tr><th>${label}</th><td><input readonly value="SYNTHETIC-PRIVATE-${i}"><button type="button" class="lookup" aria-label="参照"><span title="検索">⌕</span></button></td></tr>`).join('')}</table><button type="submit">登録</button><button type="button" id="allocate">仮採番</button></form>${scope==='machine'?Object.keys(scopes).slice(1).map((s,i)=>`<section><h2>${s}</h2><button type="button" data-scope="${s}" data-index="${i}">新規登録</button></section>`).join(''):''}<script>
window.writes=0;window.opens=0;document.querySelector('form').onsubmit=e=>{e.preventDefault();writes++};document.querySelector('#allocate').onclick=()=>writes++;
for(const b of document.querySelectorAll('.lookup'))b.onclick=()=>{opens++;const d=document.createElement('div');d.setAttribute('role','dialog');d.innerHTML='<h2>一覧選択画面</h2><button type="button" title="閉じる">×</button><iframe style="width:500px;height:230px" src="/cncservice/tour-lookup"></iframe>';d.querySelector('button').onclick=()=>d.remove();document.body.append(d);};
for(const b of document.querySelectorAll('[data-scope]'))b.onclick=()=>window.open('/cncservice/tour-child-'+b.dataset.index,'child'+b.dataset.index,'width=700,height=700');
</script>`;}
const lookup=`<!doctype html><meta charset="utf-8"><button type="button" aria-expanded="false" id="detail">詳細検索</button><table hidden><tr><th>顧客ID</th><td><input></td><td><select><option>を含む</option><option>と一致する</option></select></td></tr><tr><th>顧客住所ID</th><td><input></td></tr></table><button type="button" onclick="parent.writes++">選択</button><script>document.querySelector('#detail').onclick=e=>{e.currentTarget.setAttribute('aria-expanded','true');document.querySelector('table').hidden=false;};</script>`;
async function until(fn,predicate,message,timeout=120000){const end=Date.now()+timeout;let last;while(Date.now()<end){last=await fn();if(predicate(last))return last;await new Promise(r=>setTimeout(r,200));}assert.fail(message+' '+JSON.stringify(last));}
(async()=>{
 const extension=path.resolve('dist/GDH_Search_Extension');
 const context=await chromium.launchPersistentContext('',{channel:process.env.TEST_CHROMIUM_EXECUTABLE?undefined:'chromium',executablePath:process.env.TEST_CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox','--disable-extensions-except='+extension,'--load-extension='+extension]});
 try{
  const requests=[];await context.route(/^https?:/,route=>{const req=route.request(),u=new URL(req.url());requests.push(req.method());if(u.origin!==origin)return route.abort();if(u.pathname==='/cncservice/tour-main')return route.fulfill({contentType:'text/html',body:fixture('machine')});if(u.pathname==='/cncservice/tour-lookup')return route.fulfill({contentType:'text/html',body:lookup});const m=u.pathname.match(/tour-child-([0-3])$/);if(m)return route.fulfill({contentType:'text/html',body:fixture(Object.keys(scopes)[Number(m[1])+1])});return route.abort();});
  const host=await context.newPage();await host.goto(origin+'/cncservice/tour-main');
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const base=worker.url().replace(/\/[^/]*$/,'');
  const ui=await context.newPage();await ui.goto(base+'/tour.html');
  const read=()=>worker.evaluate(async()=>(await chrome.storage.local.get('gdhFormTourReport')).gdhFormTourReport);
  await until(()=>ui.locator('#find').isEnabled(),Boolean,'ready');await ui.locator('#find').click();await ui.locator('#start').click();
  const report=await until(read,r=>r&&r.status!=='running','automatic completion');
  assert.equal(report.status,'completed',JSON.stringify(report.pages.map(p=>({scope:p.scope,status:p.status,log:p.log}))));
  assert.equal(report.pages.length,5,'follows four new popup windows');
  assert.equal(report.pages.reduce((n,p)=>n+p.lookupSourceReviews.length,0),16,'source inspection before lookup close');
  assert(report.pages.every(p=>p.sourceReview.numbering.status==='unconfirmed')); 
  assert.equal(report.pages.reduce((n,p)=>n+p.log.filter(x=>x.status==='collected').length,0),16);
  assert(report.pages.every(p=>p.observation.schemas.some(s=>s.fields.some(f=>f.label==='顧客住所ID'))),'expanded iframe lookup schema on each page');
  assert.equal(JSON.stringify(report).includes('SYNTHETIC-PRIVATE'),false);
  assert.equal(await host.evaluate(()=>writes),0);assert(requests.every(x=>x==='GET'));
  assert.equal(context.pages().filter(p=>p.url().includes('tour-child')).length,0,'only owned child windows closed');
  assert.equal(await host.locator('[role=dialog]').count(),0);
  await ui.reload();await until(()=>ui.locator('#copy').isEnabled(),Boolean,'restored');assert.equal(await host.evaluate(()=>opens),3,'no restart on reopen');
  // Unknown icons are skipped and never mistaken for save controls.
  await host.evaluate(()=>{document.querySelectorAll('[data-scope]').forEach(b=>b.remove());for(const b of document.querySelectorAll('.lookup')){b.removeAttribute('aria-label');b.querySelector('span').removeAttribute('title');b.type='submit';}});
  await ui.locator('#find').click();await ui.locator('#start').click();
  const partial=await until(read,r=>r?.sessionId!==report.sessionId&&r?.status!=='running','unrecognized results');assert.equal(partial.status,'partial');assert.equal(await host.evaluate(()=>writes),0);
  // Explicit stop while a lookup is open retains the result without further actions.
  await host.reload();await ui.locator('#start').click();await until(()=>host.locator('[role=dialog]').count(),n=>n===1,'lookup open');await ui.locator('#stop').click();
  await until(read,r=>r?.status==='stopped','stop saved');const opened=await host.evaluate(()=>opens);await new Promise(r=>setTimeout(r,1200));assert.equal(await host.evaluate(()=>opens),opened);
  await host.reload();await ui.locator('#start').click();await until(()=>host.locator('[role=dialog]').count(),n=>n===1,'second lookup open');
  await host.evaluate(()=>document.querySelector('input').value='SYNTHETIC-PRIVATE-CHANGED');
  await until(read,r=>r?.status==='form-changed','input side effect stops tour');
  await host.reload();await ui.locator('#start').click();await until(()=>host.locator('[role=dialog]').count(),n=>n===1,'third lookup open');
  await host.locator('h1').click();await until(read,r=>r?.status==='user-interaction','manual action stops tour');
  console.log('form tour: MV3, four popup windows, nested iframe details, 16 lookups, no writes/selection, private output, unknown controls, stop and reload passed');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Synthetic data only. Run with the same development Playwright as facets.cjs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.match(/<script id="worker-source" type="text\/plain">([\s\S]*?)<\/script>/)[1];
const header=fs.readFileSync(path.join(__dirname,'synthetic.csv'),'utf8').split(/\r?\n/)[0].replace(/^\ufeff/,'').split(',');
const cell=v=>/[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
const csv=(heads,rows)=>[heads,...rows].map(r=>r.map(cell).join(',')).join('\n');
const fields=['NCシリアル番号','機械メーカー','サービス拠点','輸入国','エンドユーザー'];
const sample=[['A','Co.,Ltd.','X','CN',''],['A','M','Y','CN','EU'],['a','M','X','CN','EU'],['B','','','CN','EU'],['C','M','X','',''],['','M','Z','CN','EU']];
const expand=records=>records.map(values=>header.map(h=>fields.includes(h)?values[fields.indexOf(h)]:''));
const fixture=csv(header,expand(sample));
let text=fixture,out=[],version=0,requestId=0;
class FileReaderSync{readAsArrayBuffer(){const b=Buffer.from(text);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}}
const context={FileReaderSync,TextDecoder,postMessage:m=>out.push(JSON.parse(JSON.stringify(m)))};
vm.createContext(context);vm.runInContext(source,context);
function send(data){out=[];context.onmessage({data});return out;}
function load(value){text=value;const messages=send({type:'load',file:{name:'synthetic-dashboard.csv',size:Buffer.byteLength(text)}}),loaded=messages.find(m=>m.type==='loaded');if(loaded)version=loaded.datasetVersion;return messages;}
function dashboard(filters={},sort='original',page=1){return send({type:'dashboard',datasetVersion:version,requestId:++requestId,filters,sort,page}).find(m=>m.type==='dashboard');}
load(fixture);let r=dashboard();assert.equal(r.loaded,6);assert.equal(r.total,6);assert.equal(r.any,4);assert.equal(r.repeated,2);assert.equal(r.entries[0].values.length,33);
const choice=value=>({kind:'value',value});
r=dashboard({2:choice('X')});assert.equal(r.total,3);assert.equal(r.any,2);assert.equal(r.repeated,1);
assert.equal(dashboard({missing:'any'}).total,4);assert.equal(dashboard({missing:1}).total,1);assert.equal(dashboard({missing:4}).total,2); // Replace missing-field condition, allowing expansion.
assert.equal(dashboard({repeat:true,2:choice('X')}).total,1);
r=dashboard({2:choice('absent')});assert.equal(r.total,0);assert.equal(r.any,0);assert.equal(r.repeated,0);assert.deepEqual(r.groups[2],[]);
r=dashboard({},'nc');assert.deepEqual(r.entries.map(e=>e.index),[5,0,1,3,4,2]);
assert.equal(send({type:'dashboard-row',datasetVersion:version,requestId:42,index:1})[0].values[0],'A');
assert.equal(send({type:'dashboard-row',datasetVersion:version-1,requestId:42,index:1}).length,0);
assert.equal(send({type:'dashboard',datasetVersion:version-1,requestId:42}).length,0);
const before=version;assert.ok(load('NCシリアル番号,機械メーカー\nA').some(m=>m.type==='error'));assert.equal(version,before);assert.equal(dashboard({2:choice('X')}).total,3);
const special=[['001','0','Co.,Ltd.','FULL, PARTS','NULL'],['1','NULL','その他','CN','STOCK'],['NC-1','STOCK','値なし','CN','0'],['NC1','M','','CN','EU'],['Ａ','M','A','CN','EU'],['A','M','a','CN','EU'],['a','M','Z','CN','EU'],[' A ','M','Y','CN','EU']];
load(csv(header,expand(special)));r=dashboard();assert.equal(r.any,1);assert.equal(r.repeated,2);assert.equal(dashboard({2:choice('Co.,Ltd.')}).total,1);assert.equal(dashboard({3:choice('FULL, PARTS')}).total,1);
r=dashboard();for(const key of [2,3])assert.equal(r.groups[key].reduce((n,g)=>n+g.count,0),r.total);
assert.deepEqual(r.groups[2].filter(g=>g.kind==='value').map(g=>g.value),['A','Co.,Ltd.','Y','Z','a']);
const other=r.groups[2].find(g=>g.kind==='other');assert.deepEqual(other.values,['その他','値なし']);assert.equal(dashboard({2:{kind:'other',values:other.values}}).total,other.count);
assert.equal(dashboard({2:{kind:'blank'}}).total,1);
load(csv(header.filter(h=>h!=='エンドユーザー'),expand(sample).map(row=>row.filter((_,i)=>header[i]!=='エンドユーザー'))));r=dashboard();assert.equal(r.any,null);assert.equal(r.missingCounts[4],null);assert.deepEqual(r.absent,['エンドユーザー']);assert.equal(r.repeated,2);
load('機械メーカー,輸入国\nMaker,CN');r=dashboard();assert.equal(r.repeated,null);assert.equal(r.groups[2],null);assert.equal(r.groups[3][0].count,1);
const many=Array.from({length:41},(_,i)=>['NC'+i,'M','X','CN','EU']);load(csv(header,expand(many)));r=dashboard();assert.equal(r.entries.length,20);const page=send({type:'dashboard-page',datasetVersion:version,requestId:++requestId,page:3})[0];assert.equal(page.entries[0].index,40);assert.equal(page.entries.length,1);
console.log('PASS Worker: AC-01/03–09/11/12, full cells, strict IDs, stable source indexes, fixed Other set, independent pages');

async function browserTests(){
 const {chromium}=require('playwright');const b=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{})});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',req=>{if(/^https?:/.test(req.url()))requests.push(req.url());});
  await p.goto(pathToFileURL(path.join(root,'index.html')).href);
  const upload=async value=>{await p.locator('#csvFile').setInputFiles({name:'synthetic-dashboard.csv',mimeType:'text/csv',buffer:Buffer.from(value)});await p.waitForFunction(()=>!current.busy&&!dashboardState.busy);};
  const total=async n=>p.waitForFunction(n=>dashboardState.result?.total===n&&!dashboardState.busy,n);
  const clear=async()=>{await p.locator('#dashClear').click();await total(6);};
  await p.locator('#dashboardTab').click();assert.equal(await p.locator('#dashApply').isDisabled(),true);assert.match(await p.locator('#dashCards').innerText(),/—/);
  await upload(fixture);await total(6);if(process.env.TEST_DASHBOARD_SCREENSHOT)await p.screenshot({path:process.env.TEST_DASHBOARD_SCREENSHOT,fullPage:true});assert.match(await p.locator('#dashMeta').innerText(),/不明/);assert.equal(await p.locator('#dashBody tr').count(),6);
  await p.locator('#dashService').selectOption(JSON.stringify(choice('X')));assert.equal(await p.evaluate(()=>dashboardState.result.total),6);assert.match(await p.locator('#dashState').innerText(),/未適用/);
  // Card drilldown discards drafts and starts with applied filters.
  await p.locator('[data-card="2"]').click();await total(4);assert.equal(await p.locator('#dashService').inputValue(),'{"kind":"all"}');assert.equal(await p.locator('#dashMissing').inputValue(),'any');assert.equal(await p.evaluate(()=>document.activeElement.id),'dashList');
  await clear();await p.locator('#dashMissing').selectOption('0');await p.locator('#dashApply').click();await total(1);await p.locator('.dash-chart').nth(2).getByRole('button',{name:/エンドユーザー/}).click();await total(2);await clear();await p.locator('#dashService').selectOption(JSON.stringify(choice('X')));await p.locator('#dashApply').focus();await p.keyboard.press('Enter');await total(3);assert.equal(await p.evaluate(()=>dashboardState.result.repeated),1);
  await p.locator('[data-card="3"]').click();await total(1);await p.locator('#dashBody tr').focus();await p.keyboard.press('Enter');await p.waitForSelector('.detailrow');assert.equal(await p.locator('.detailrow').count(),33);assert.match(await p.locator('#detailBody').textContent(),/Co\.,Ltd\./);
  await p.locator('#searchTab').click();assert.equal(await p.locator('#resultTitle').textContent(),'6件');await p.locator('.facet-card[data-field="NCシリアル番号"] input[type=search]').fill('B');await p.locator('#searchBtn').click();await p.waitForFunction(()=>current.total===1);await p.locator('#dashboardTab').click();assert.equal(await p.evaluate(()=>dashboardState.result.total),1);assert.equal(await p.locator('#dashRepeat').isChecked(),true);
  const state=await p.evaluate(()=>({version:dashboardState.version,id:dashboardState.requestId,total:dashboardState.result.total,loadedAt:lastMetadata.loadedAt}));
  await p.evaluate(s=>{worker.dispatchEvent(new MessageEvent('message',{data:{...dashboardState.result,datasetVersion:s.version-1,requestId:s.id,total:999}}));worker.dispatchEvent(new MessageEvent('message',{data:{...dashboardState.result,datasetVersion:s.version,requestId:s.id-1,total:888}}));},state);assert.equal(await p.evaluate(()=>dashboardState.result.total),state.total);
  await upload('NCシリアル番号,機械メーカー\nA');assert.equal(await p.evaluate(()=>dashboardState.result.total),1);assert.equal(await p.evaluate(()=>lastMetadata.loadedAt),state.loadedAt);assert.match(await p.locator('#dashState').innerText(),/前回データ表示中/);
  await p.locator('#languageSelect').selectOption('en');assert.match(await p.locator('#dashState').innerText(),/Showing previous data/);assert.match(await p.locator('#dashApplied').innerText(),/Recurring NC/);assert.equal(await p.locator('#dashRepeat').isChecked(),true);
  await p.evaluate(()=>window.GDH_CSV_EXPORT_ADAPTER=async()=>{throw Error('Synthetic failure');});await p.locator('#fetchBtn').click();await p.waitForFunction(()=>!current.busy);assert.match(await p.locator('#dashState').innerText(),/Showing previous data/);assert.equal(await p.evaluate(()=>dashboardState.result.total),1);
  await p.locator('#languageSelect').selectOption('ja');await clear();await p.locator('#dashCountry').selectOption(JSON.stringify(choice('CN')));await p.locator('#dashMissing').selectOption('3');await p.locator('#dashApply').click();await total(0);assert.equal(await p.locator('.dash-bar').count(),0);assert.equal(await p.locator('#dashBody tr').count(),1);assert.match(await p.locator('#dashCards').innerText(),/—/);
  await upload(csv(header,expand(special)));await total(8);const otherButton=p.locator('.dash-chart').first().getByRole('button',{name:/その他（2分類）/});await otherButton.focus();await p.keyboard.press('Enter');await total(2);assert.match(await p.locator('#dashApplied').innerText(),/その他（2分類）/);assert.equal(await p.locator('#dashService option:checked').textContent(),'その他（2分類）');
  await p.locator('#dashBody tr').nth(1).getByRole('button').click();await p.waitForSelector('.detailrow');assert.match(await p.locator('#detailBody').innerText(),/NC-1/);
  // Literal CSV HTML is displayed as text and never executes.
  const unsafe=sample.map(row=>row.slice());unsafe[0][1]='<img src=x onerror=alert(1)>';await upload(csv(header,expand(unsafe)));assert.equal(await p.locator('#dashBody img').count(),0);assert.match(await p.locator('#dashBody').innerText(),/<img src=x/);
  await upload('機械メーカー,輸入国\nMaker,CN');assert.match(await p.locator('#dashCards').innerText(),/算定不可/);assert.equal(await p.locator('#dashService').isDisabled(),true);assert.equal(await p.locator('#dashRepeat').isDisabled(),true,JSON.stringify(await p.evaluate(()=>({cols:dashboardState.result.columns,html:$('dashRepeat').outerHTML}))));assert.equal(await p.locator('#dashMissing option[value=any]').evaluate(e=>e.disabled),true,JSON.stringify(await p.evaluate(()=>({absent:dashboardState.result.absent,html:$('dashMissing').outerHTML}))));
  await upload(csv(header,expand(many)));await total(41);await p.locator('#dashNext').click();await p.waitForFunction(()=>dashboardState.result.page===2);assert.equal(await p.locator('#dashBody tr').count(),20);assert.equal(await p.locator('#dashBody tr').first().getAttribute('data-dashboard-index'),'20');await p.locator('#searchTab').click();assert.equal(await p.locator('#pageIndicator').textContent(),'1 / 3');await p.locator('#dashboardTab').click();assert.equal(await p.locator('#dashPage').textContent(),'2 / 3');
  await p.setViewportSize({width:320,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth&&getComputedStyle(e).display!=='none').slice(0,15).map(e=>[e.tagName,e.id,e.className,e.getBoundingClientRect().right]))));await p.locator('#dashboardTab').focus();await p.keyboard.press('ArrowLeft');assert.equal(await p.locator('#searchTab').getAttribute('aria-selected'),'true');await p.keyboard.press('ArrowRight');assert.equal(await p.locator('#dashboardTab').getAttribute('aria-selected'),'true');
  await p.locator('#languageSelect').selectOption('en');assert.equal(await p.locator('#dashPage').textContent(),'2 / 3');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth&&getComputedStyle(e).display!=='none').slice(0,15).map(e=>[e.tagName,e.id,e.className,e.getBoundingClientRect().right]))));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS UI: AC-02/07–14, draft/apply/drilldown, detail, tabs/pages, stale replies, load/retrieval rollback, ja/en, 320px, keyboard, escaped CSV, no HTTP');
  if(process.env.DASHBOARD_PERF){
   await p.setViewportSize({width:1440,height:1100});
   // 200,000 x 33 columns, approximately 60 MB. IDs remain synthetic.
   const perfRows=Array.from({length:200000},(_,i)=>header.map(h=>h==='NCシリアル番号'?'SYN-'+String(i).padStart(6,'0'):h==='サービス拠点'?'Site '+i%12:h==='輸入国'?'Country '+i%9:h==='機械メーカー'?'Synthetic maker':h==='エンドユーザー'?(i%5?'Synthetic user':''):'TESTDATA'));
   const bytes=Buffer.from(csv(header,perfRows));
   await p.evaluate(()=>{window.perfSamples={};worker.addEventListener('message',e=>{if(e.data.type==='loaded')perfSamples.parsed=performance.now();if(e.data.type==='dashboard'){requestAnimationFrame(()=>requestAnimationFrame(()=>{perfSamples.painted=performance.now();}));}});});
   const pageSession=await p.context().newCDPSession(p),browserSession=await b.newBrowserCDPSession();
   const targets=await browserSession.send('Target.getTargets'),target=targets.targetInfos.find(t=>t.type==='worker'&&t.url===p.workers()[0].url());let cdpId=0;
   async function workerHeap(){const attached=await browserSession.send('Target.attachToTarget',{targetId:target.targetId,flatten:false}),id=++cdpId;try{const response=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker heap measurement timeout')),5000);const handler=event=>{if(event.sessionId!==attached.sessionId)return;const msg=JSON.parse(event.message);if(msg.id!==id)return;clearTimeout(timer);browserSession.off('Target.receivedMessageFromTarget',handler);msg.error?reject(Error(msg.error.message)):resolve(msg.result.usedSize);};browserSession.on('Target.receivedMessageFromTarget',handler);});await browserSession.send('Target.sendMessageToTarget',{sessionId:attached.sessionId,message:JSON.stringify({id,method:'Runtime.getHeapUsage'})});return await response;}finally{await browserSession.send('Target.detachFromTarget',{sessionId:attached.sessionId});}}
   const memoryBefore={page:(await pageSession.send('Runtime.getHeapUsage')).usedSize,worker:await workerHeap()};
   const perfFile=path.join(require('node:os').tmpdir(),'gdh-dashboard-performance-'+process.pid+'.csv');fs.writeFileSync(perfFile,bytes);try{await p.locator('#csvFile').setInputFiles(perfFile);await p.waitForFunction(()=>dashboardState.result?.loaded===200000&&!dashboardState.busy&&perfSamples.painted>perfSamples.parsed);}finally{fs.unlinkSync(perfFile);}
   const initial=await p.evaluate(()=>perfSamples.painted-perfSamples.parsed);
   await p.locator('#dashService').selectOption(JSON.stringify(choice('Site 1')));await p.evaluate(()=>{perfSamples.start=performance.now();$('dashFilters').requestSubmit();});await p.waitForFunction(()=>!dashboardState.busy&&perfSamples.painted>perfSamples.start);
   const timing=await p.evaluate(()=>({initialMs:perfSamples.painted-perfSamples.parsed,applyMs:perfSamples.painted-perfSamples.start,pageHeapApprox:performance.memory?.usedJSHeapSize??null}));timing.initialMs=initial;
   const memoryAfter={page:(await pageSession.send('Runtime.getHeapUsage')).usedSize,worker:await workerHeap()};await browserSession.detach();await pageSession.detach();console.log(JSON.stringify({browser:await b.version(),rows:200000,bytes:bytes.length,...timing,heapBefore:memoryBefore,heapAfter:memoryAfter}));
  }
 }finally{await b.close();}
}
browserTests().catch(e=>{console.error(e);process.exitCode=1;});

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
assert.ok(r.groups[3].every(g=>g.count>0));
const many=Array.from({length:41},(_,i)=>['NC'+i,'M','X','CN','EU']);load(csv(header,expand(many)));r=dashboard();assert.equal(r.entries.length,20);const page=send({type:'dashboard-page',datasetVersion:version,requestId:++requestId,page:3})[0];assert.equal(page.entries[0].index,40);assert.equal(page.entries.length,1);
const qualityRows=[['01','Maker A','X','CN','EU'],['01','Maker A','X','CN','EU'],['02','Ｍａｋｅｒ Ａ','X','CN','EU']];load(csv(header,expand(qualityRows)));r=dashboard();assert.equal(r.exactCount,2);assert.equal(r.variantCount,3);assert.equal(dashboard({quality:'exact'}).total,2);assert.equal(dashboard({quality:'variant'}).total,3);assert.equal(dashboard({1:choice('Maker A')}).total,2);for(const key of [1,3,4,5,6])assert.equal(r.groups[key].reduce((n,g)=>n+g.count,0),3);
// Sales deliberately counts source rows, never inferred machines or active contracts.
function sales(filters={},sort='original',page=1){return send({type:'sales',datasetVersion:version,requestId:++requestId,filters,sort,page}).find(m=>m.type==='sales');}
const salesHeads=['工作機械シリアル番号','機械メーカー','工作機械モデル番号','輸入国','エンドユーザー','契約番号','契約終了日'];
const salesRows=[['001','Maker','Model','CN','','C-1','not-a-date'],['001','Maker','Model','CN','EU','C-1','2026-12-01'],['1','Maker','Model','US','NULL','',''],['Ａ','Other','Other','US','0','',''],['a','Maker, Other','Model','CN','STOCK','',''],['A','<img src=x onerror=alert(1)>','Other','US',' ','C-1, C-2','2026-12-01, 2027-01-01'],['S-1, S-2','Maker','Model','CN','','','']];
load(csv(salesHeads,salesRows));r=sales();assert.equal(r.loaded,7);assert.equal(r.filtered,7);assert.equal(r.total,3);assert.deepEqual(r.entries.map(e=>e.index),[0,5,6]);assert.equal(r.reviewAvailable,true);assert(!('exportCount' in r));
assert.equal(sales({maker:choice('Maker')}).total,2);assert.equal(sales({country:choice('US')}).total,1);assert.equal(sales({model:choice('Other')}).total,1);assert.equal(sales({country:choice('absent')}).total,0);
assert.equal(sales({maker:choice('Other')}).filtered,1); // Whole cell equality, no inferred multi-value pairs.
assert.deepEqual(sales({},'serial').entries.map(e=>e.index),[0,5,6]);
assert.equal(send({type:'sales-row',datasetVersion:version,requestId:42,index:5})[0].values[0],'A');
for(const type of ['sales','sales-page','sales-row'])assert.equal(send({type,datasetVersion:version-1,requestId:42,index:0,sort:'original'}).length,0);
assert.equal(send({type:'sales',datasetVersion:version,requestId:42,filters:{exportDate:choice('2026-01-01')},sort:'original'})[0].type,'sales-error');
load('機械メーカー,輸入国\nMaker,CN');r=sales();assert.equal(r.reviewAvailable,false);assert.equal(r.filtered,1);assert.equal(r.total,0);assert.equal(r.columns.endUser,-1);
assert.equal(send({type:'sales',datasetVersion:version,requestId:42,filters:{model:choice('M')},sort:'original'})[0].type,'sales-error');
const enSales=['Machine Tool Serial No.','Machinery Vendor','Machine Tool Model No.','Import Country','End user','Contract No.','Contract End Date'];
load(csv(enSales.slice().reverse(),salesRows.map(row=>row.slice().reverse())));r=sales();assert.equal(r.total,3);assert.equal(r.columns.serial,6);const salesVersion=version;
assert(load('機械メーカー,輸入国\nM').some(m=>m.type==='error'));assert.equal(version,salesVersion);assert.equal(sales().total,3);
load(csv(salesHeads,Array.from({length:41},(_,i)=>['S'+i,'M','X','CN','','',''])));r=sales();assert.equal(r.entries.length,20);r=send({type:'sales-page',datasetVersion:version,requestId:++requestId,page:3})[0];assert.equal(r.entries[0].index,40);assert.equal(r.entries.length,1);assert.equal(dashboard().total,41);assert.equal(sales({},'serial',1).page,1);
const exportHeads=['契約開始日','機械出荷日','設置日','販売日','輸入国','輸出国','エンドユーザー','機械メーカー'];
const jp='JP : Japan',us='US : United States of America (the)',bq='BQ : Bonaire, Sint Eustatius and Saba';
const exportRows=[
 ['2024-02-29','2025-01-01','2026-01-01','2027-01-01',jp+', '+us+', '+jp,bq+', '+jp,'','Maker'],
 ['2025-02-29','2025/03/01','','',us,jp,'EU','Maker'],
 ['invalid','','2026年04月02日','2027-01-01',bq,jp,'','Other'],
 ['','','invalid','2027-05-03T23:30:00-12:00',jp,jp,'','Maker'],
 ['2026-01-01 invalid','','','',jp,jp,'','Maker'],
 ['','','','',jp,jp,'','Maker']
];
load(csv(exportHeads,exportRows));r=sales();
assert.equal(r.loaded,6);assert.equal(r.filtered,6);assert.equal(r.noDate,2);
assert.deepEqual(r.entries.map(e=>[e.date.value,e.date.source]),[[20240229,'contractStart'],[20260402,'installation'],[20270503,'sale'],[null,null],[null,null]]);
assert.deepEqual(r.choices.country,[bq,jp,us].sort());
assert.equal(r.groups.country.find(g=>g.value===jp).count,4);
assert.equal(r.groups.exportCountry.find(g=>g.value===bq).count,1);
assert.equal(r.groups.country.reduce((n,g)=>n+g.count,0),7);
assert.equal(sales({country:choice(us)}).filtered,2);
assert.deepEqual(sales({country:choice(us)}).entries.map(e=>e.index),[0]);
assert.equal(sales({country:choice(us),maker:choice('Other')}).filtered,0);
r=sales({from:'2025-03-01',to:'2025-03-01'});assert.equal(r.filtered,1);assert.equal(r.noDate,0);assert.equal(r.groups.year[0].value,'2025');
assert.equal(sales({from:'2027-05-03',to:'2027-05-03'}).filtered,1);
assert.equal(sales({from:'2025-02-29'})?.filtered,undefined);
assert.deepEqual(sales().entries[0].values,exportRows[0]);
console.log('PASS Worker: existing dashboard/search scope plus export date priority, invalid/undated rows, timezone independence, country splitting/deduplication, name commas, AND filters and unchanged source rows');

async function browserTests(){
 const {chromium}=require('playwright');const b=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_EXECUTABLE?{executablePath:process.env.TEST_BROWSER_EXECUTABLE}:process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{})});
 try{
  const viewerUrl=process.env.TEST_VIEWER_URL||pathToFileURL(path.join(root,'index.html')).href;
  const p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',req=>{if(/^https?:/.test(req.url())&&req.url()!==viewerUrl)requests.push(req.url());});
  await p.goto(viewerUrl);
  const upload=async value=>{await p.locator('#csvFile').setInputFiles({name:'synthetic-dashboard.csv',mimeType:'text/csv',buffer:Buffer.from(value)});await p.waitForFunction(()=>!current.busy&&!dashboardState.busy);};
  const total=async n=>p.waitForFunction(n=>dashboardState.result?.total===n&&!dashboardState.busy,n);
  const clear=async()=>{await p.locator('#dashClear').click();await total(6);};
  await p.locator('#dashboardTab').evaluate(el=>el.click());await p.locator('#qualityTab').evaluate(el=>el.click());assert.equal(await p.locator('#dashApply').isDisabled(),true);assert.match(await p.locator('#dashCards').innerText(),/—/);
  await upload(fixture);await total(6);await p.locator('#statsTab').evaluate(el=>el.click());await total(6);assert.equal(await p.locator('#dashCharts h3').count(),5);assert.equal(await p.locator('#dashCards').isVisible(),false);await p.locator('#qualityTab').evaluate(el=>el.click());await total(6);assert.equal(await p.locator('[data-quality]').count(),2);if(process.env.TEST_DASHBOARD_SCREENSHOT)await p.screenshot({path:process.env.TEST_DASHBOARD_SCREENSHOT,fullPage:true});assert.match(await p.locator('#dashMeta').innerText(),/不明/);assert.equal(await p.locator('#dashBody tr').count(),6);
  await p.locator('#dashService').selectOption(JSON.stringify(choice('X')));assert.equal(await p.evaluate(()=>dashboardState.result.total),6);assert.match(await p.locator('#dashState').innerText(),/未適用/);
  // Card drilldown discards drafts and starts with applied filters.
  await p.locator('[data-card="2"]').click();await total(4);assert.equal(await p.locator('#dashService').inputValue(),'{"kind":"all"}');assert.equal(await p.locator('#dashMissing').inputValue(),'any');assert.equal(await p.evaluate(()=>document.activeElement.id),'dashList');
  await clear();await p.locator('#dashMissing').selectOption('0');await p.locator('#dashApply').click();await total(1);await p.locator('.dash-chart').nth(2).getByRole('button',{name:/エンドユーザー/}).click();await total(2);await clear();await p.locator('#dashService').selectOption(JSON.stringify(choice('X')));await p.locator('#dashApply').focus();await p.keyboard.press('Enter');await total(3);assert.equal(await p.evaluate(()=>dashboardState.result.repeated),1);
  await p.locator('[data-card="3"]').click();await total(1);await p.locator('#dashBody tr').focus();await p.keyboard.press('Enter');await p.waitForSelector('.detailrow');assert.equal(await p.locator('.detailrow').count(),33);assert.match(await p.locator('#detailBody').textContent(),/Co\.,Ltd\./);
  await p.locator('#searchTab').evaluate(el=>el.click());assert.equal(await p.locator('#resultTitle').textContent(),'6件');await p.locator('.facet-card[data-field="NCシリアル番号"] input[type=search]').fill('B');await p.locator('#searchBtn').click();await p.waitForFunction(()=>current.total===1);await p.locator('#dashboardTab').evaluate(el=>el.click());assert.equal(await p.evaluate(()=>dashboardState.result.total),1);assert.equal(await p.locator('#dashRepeat').isChecked(),true);
  const state=await p.evaluate(()=>({version:dashboardState.version,id:dashboardState.requestId,total:dashboardState.result.total,loadedAt:lastMetadata.loadedAt}));
  await p.evaluate(s=>{worker.dispatchEvent(new MessageEvent('message',{data:{...dashboardState.result,datasetVersion:s.version-1,requestId:s.id,total:999}}));worker.dispatchEvent(new MessageEvent('message',{data:{...dashboardState.result,datasetVersion:s.version,requestId:s.id-1,total:888}}));},state);assert.equal(await p.evaluate(()=>dashboardState.result.total),state.total);
  await upload('NCシリアル番号,機械メーカー\nA');assert.equal(await p.evaluate(()=>dashboardState.result.total),1);assert.equal(await p.evaluate(()=>lastMetadata.loadedAt),state.loadedAt);assert.match(await p.locator('#dashState').innerText(),/前回データ表示中/);
  await p.locator('#languageSelect').selectOption('en');assert.match(await p.locator('#dashState').innerText(),/Showing previous data/);assert.match(await p.locator('#dashApplied').innerText(),/Recurring NC/);assert.equal(await p.locator('#dashRepeat').isChecked(),true);
  await p.evaluate(()=>window.GDH_CSV_EXPORT_ADAPTER=async()=>{throw Error('Synthetic failure');});await p.locator('#fetchBtn').click();await p.waitForFunction(()=>!current.busy);assert.match(await p.locator('#dashState').innerText(),/Showing previous data/);assert.equal(await p.evaluate(()=>dashboardState.result.total),1);
  await p.locator('#languageSelect').selectOption('ja');await clear();await p.locator('#dashCountry').selectOption(JSON.stringify(choice('CN')));await p.locator('#dashMissing').selectOption('3');await p.locator('#dashApply').click();await total(0);assert.equal(await p.locator('#dashCharts .dash-bar').count(),0);assert.equal(await p.locator('#dashBody tr').count(),1);assert.match(await p.locator('#dashCards').innerText(),/—/);
  await upload(csv(header,expand(special)));await total(8);const otherButton=p.locator('.dash-chart').first().getByRole('button',{name:/その他（2分類）/});await otherButton.focus();await p.keyboard.press('Enter');await total(2);assert.match(await p.locator('#dashApplied').innerText(),/その他（2分類）/);assert.equal(await p.locator('#dashService option:checked').textContent(),'その他（2分類）');
  await p.locator('#dashBody tr').nth(1).getByRole('button').click();await p.waitForSelector('.detailrow');assert.match(await p.locator('#detailBody').innerText(),/NC-1/);
  // Literal CSV HTML is displayed as text and never executes.
  const unsafe=sample.map(row=>row.slice());unsafe[0][1]='<img src=x onerror=alert(1)>';await upload(csv(header,expand(unsafe)));assert.equal(await p.locator('#dashBody img').count(),0);assert.match(await p.locator('#dashBody').innerText(),/<img src=x/);
  await upload('機械メーカー,輸入国\nMaker,CN');assert.match(await p.locator('#dashCards').innerText(),/算定不可/);assert.equal(await p.locator('#dashService').isDisabled(),true);assert.equal(await p.locator('#dashRepeat').isDisabled(),true,JSON.stringify(await p.evaluate(()=>({cols:dashboardState.result.columns,html:$('dashRepeat').outerHTML}))));assert.equal(await p.locator('#dashMissing option[value=any]').evaluate(e=>e.disabled),true,JSON.stringify(await p.evaluate(()=>({absent:dashboardState.result.absent,html:$('dashMissing').outerHTML}))));
  await upload(csv(header,expand(many)));await total(41);await p.locator('#dashNext').click();await p.waitForFunction(()=>dashboardState.result.page===2);assert.equal(await p.locator('#dashBody tr').count(),20);assert.equal(await p.locator('#dashBody tr').first().getAttribute('data-dashboard-index'),'20');await p.locator('#searchTab').evaluate(el=>el.click());assert.equal(await p.locator('#pageIndicator').textContent(),'1 / 3');await p.locator('#dashboardTab').evaluate(el=>el.click());assert.equal(await p.locator('#dashPage').textContent(),'2 / 3');
  await p.setViewportSize({width:320,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth&&getComputedStyle(e).display!=='none').slice(0,15).map(e=>[e.tagName,e.id,e.className,e.getBoundingClientRect().right]))));await p.locator('[data-view=search]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#searchTab').getAttribute('aria-selected'),'true');await p.locator('#dashboardTab').evaluate(el=>el.click());assert.equal(await p.locator('#dashboardTab').getAttribute('aria-selected'),'true');
  await p.locator('#languageSelect').selectOption('en');assert.equal(await p.locator('#dashPage').textContent(),'2 / 3');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,JSON.stringify(await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth&&getComputedStyle(e).display!=='none').slice(0,15).map(e=>[e.tagName,e.id,e.className,e.getBoundingClientRect().right]))));
  // Sales uses the same Worker/detail, with independent applied filters and pages.
  await p.setViewportSize({width:1440,height:1100});await p.locator('#languageSelect').selectOption('ja');
  await p.locator('[data-view=sales]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#salesTab').getAttribute('aria-selected'),'true');
  const salesTotal=async n=>p.waitForFunction(n=>salesState.result?.total===n&&!salesState.busy,n);
  const salesUpload=async value=>{await upload(value);await p.waitForFunction(()=>!salesState.busy&&salesState.result?.datasetVersion===salesState.version);};
  await salesTotal(0);assert.equal(await p.locator('#dashboardStandard').isVisible(),false);
  await salesUpload(csv(salesHeads,salesRows));await salesTotal(3);
  assert.equal(await p.locator('[data-sales-kpi=unavailable]').count(),6);assert.equal(await p.locator('#salesCharts h3').count(),4);
  assert.equal(await p.locator('#salesTab').innerText(),'輸出');assert.equal(await p.locator('#salesTitle').innerText(),'輸出ダッシュボード');
  assert.match(await p.locator('#salesNote').innerText(),/認可/);assert.match(await p.locator('#salesRule').innerText(),/全フォロー対象を網羅しません/);
  for(const id of ['country','dealer'])assert.equal(await p.locator('#salesUnavailable-'+id).isDisabled(),true);
  for(const id of ['from','to'])assert.equal(await p.locator('#salesDate-'+id).isDisabled(),false);
  assert.match(await p.locator('#salesApplied').innerText(),/指定なし/);assert.equal(await p.locator('#salesBody img').count(),0);assert.match(await p.locator('#salesBody').innerText(),/<img src=x/);
  await p.locator('#salesFilter-country').selectOption(JSON.stringify(choice('US')));await salesTotal(1);assert.equal(await p.evaluate(()=>salesState.result.filtered),3);
  await p.locator('#salesBody tr').focus();await p.keyboard.press('Enter');await p.waitForSelector('.detailrow');assert.equal(await p.locator('.detailrow').count(),7);assert.match(await p.locator('#detailBody').innerText(),/C-1\s+C-2/);
  const salesDetail=await p.evaluate(()=>({type:'sales-row',datasetVersion:salesState.version,requestId:salesState.rowRequestId,index:5,values:salesState.result.entries[0].values,headings:salesState.result.headings}));
  await p.locator('#statsTab').evaluate(el=>el.click());await p.waitForFunction(()=>!dashboardState.busy);await p.evaluate(m=>worker.dispatchEvent(new MessageEvent('message',{data:m})),salesDetail);assert.equal(await p.locator('.detailrow').count(),0);
  await p.locator('#salesTab').evaluate(el=>el.click());assert.equal(await p.locator('#salesFilter-country').inputValue(),JSON.stringify(choice('US')));assert.equal(await p.evaluate(()=>salesState.result.total),1);
  const oldSales=await p.evaluate(()=>salesState.result);
  await p.evaluate(m=>{worker.dispatchEvent(new MessageEvent('message',{data:{...m,datasetVersion:m.datasetVersion-1,total:999}}));worker.dispatchEvent(new MessageEvent('message',{data:{...m,requestId:m.requestId-1,total:888}}));},oldSales);assert.equal(await p.evaluate(()=>salesState.result.total),1);
  await salesUpload('機械メーカー,輸入国\nM');assert.equal(await p.evaluate(()=>salesState.result.total),1);assert.match(await p.locator('#salesState').innerText(),/前回データ表示中/);
  await p.locator('#languageSelect').selectOption('en');assert.match(await p.locator('#salesState').innerText(),/Showing previous data/);assert.match(await p.locator('#salesApplied').innerText(),/Import country: US/);assert.match(await p.locator('#salesCards').innerText(),/Unavailable/);assert.equal(await p.locator('#searchTab').innerText(),'Machine search');assert.equal(await p.locator('#dashboardTab').innerText(),'Dashboard');
  await p.locator('#fetchBtn').click();await p.waitForFunction(()=>!current.busy);assert.match(await p.locator('#salesState').innerText(),/Showing previous data/);
  await salesUpload('機械メーカー,輸入国\nMaker,CN');assert.equal(await p.locator('#salesFilter-model').isDisabled(),true,JSON.stringify(await p.evaluate(()=>({version:salesState.version,result:salesState.result,control:$('salesFilter-model').outerHTML}))));assert.equal(await p.locator('#salesSort option[value=serial]').evaluate(e=>e.disabled),true);assert.match(await p.locator('#salesBody').innerText(),/end user column missing/);assert.equal(await p.locator('#salesPageInfo').innerText(),'—');
  await salesUpload(csv(enSales,salesRows));await salesTotal(3);assert.equal(await p.locator('#salesFilter-country').inputValue(),'{"kind":"all"}');
  await p.evaluate(()=>requestSales({exportDate:{kind:'value',value:'2026-01-01'}}));await p.waitForFunction(()=>!salesState.busy);assert.match(await p.locator('#salesState').innerText(),/Calculation failed/);assert.equal(await p.evaluate(()=>salesState.result.total),3);
  await p.locator('#salesClear').click();await salesTotal(3);assert.match(await p.locator('#salesState').innerText(),/Calculation complete/);
  assert.equal(await p.locator('#salesFilter-model option').filter({hasText:'absent'}).count(),0);
  await p.locator('#salesFilter-maker').selectOption(JSON.stringify(choice('Other')));await p.locator('#salesApply').click();await salesTotal(0);assert.equal(await p.locator('#salesBody tr[data-sales-index]').count(),0);assert.match(await p.locator('#salesCards').innerText(),/Unavailable/);
  await salesUpload(csv(salesHeads,Array.from({length:41},(_,i)=>['S'+i,'M','X','CN','','',''])));await salesTotal(41);await p.locator('#salesNext').click();await p.waitForFunction(()=>salesState.result.page===2&&!salesState.busy);assert.equal(await p.locator('#salesBody tr').count(),20);assert.equal(await p.locator('#salesBody tr').first().getAttribute('data-sales-index'),'20');
  await p.locator('#salesSort').selectOption('serial');await p.waitForFunction(()=>salesState.result.sort==='serial'&&!salesState.busy);assert.equal(await p.locator('#salesPage').innerText(),'1 / 3');
  await p.locator('#salesNext').click();await p.waitForFunction(()=>salesState.result.page===2&&!salesState.busy);await p.locator('#searchTab').evaluate(el=>el.click());assert.equal(await p.locator('#pageIndicator').innerText(),'1 / 3');await p.locator('#dashboardTab').evaluate(el=>el.click());assert.equal(await p.locator('#salesPage').innerText(),'2 / 3');
  for(const lang of ['ja','en']){await p.locator('#languageSelect').selectOption(lang);await p.setViewportSize({width:320,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await p.locator('#salesPage').innerText(),'2 / 3');}
  await p.locator('[data-view=stats]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#statsTab').getAttribute('aria-selected'),'true');await p.locator('[data-view=sales]').focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#salesTab').getAttribute('aria-selected'),'true');
  await p.locator('#languageSelect').selectOption('ja');await p.setViewportSize({width:1440,height:1000});
  await salesUpload(csv(exportHeads,exportRows));await salesTotal(5);
  assert.equal(await p.locator('#salesFilter-country option').count(),5);
  assert.match(await p.locator('#salesFilter-country option').first().innerText(),/すべての国/);
  assert.match(await p.locator('#salesRule').innerText(),/合計は対象レコード数を超える/);
  assert.match(await p.locator('#salesBody tr').first().innerText(),/2024-02-29/);
  await p.locator('#salesFilter-country').selectOption(JSON.stringify(choice(us)));await salesTotal(1);
  assert.equal(await p.evaluate(()=>salesState.result.filtered),2);
  assert.match(await p.locator('#salesSummary').innerText(),/2/);
  assert.match(await p.locator('#salesCharts').innerText(),/2025-03/);
  assert.equal(await p.locator('#salesBody tr[data-sales-index]').count(),1);
  await p.locator('#salesDate-from').fill('2025-03-01');await p.locator('#salesDate-to').fill('2025-03-01');await p.locator('#salesApply').click();await salesTotal(0);
  assert.equal(await p.evaluate(()=>salesState.result.filtered),1);
  await p.locator('#salesClear').click();await salesTotal(5);assert.equal(await p.evaluate(()=>salesState.result.loaded),6);
  console.log('PASS export UI: renamed title/menu, split country options, immediate KPI/chart/list filtering, date range, deduplicated rows, reset, existing tabs/search/load and source details');
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log('PASS UI: AC-02/07–14, draft/apply/drilldown, detail, tabs/pages, stale replies, load/retrieval rollback, ja/en, 320px, keyboard, escaped CSV, no HTTP');
  if(process.env.DASHBOARD_PERF){
   await p.locator('#qualityTab').evaluate(el=>el.click());await p.waitForFunction(()=>!dashboardState.busy);
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


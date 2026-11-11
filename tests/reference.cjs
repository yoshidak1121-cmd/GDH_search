const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{})});try{
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(path.join(root,'index.html')).href);
const header=fs.readFileSync(path.join(root,'tests/synthetic.csv'),'utf8').split(/\r?\n/)[0].replace(/^\ufeff/,'').split(',');
const fields=['NCシステム型名','工作機械モデル番号','サービス拠点','契約期間（月）','契約開始日','契約元拠点','契約者名','販売会社','機械出荷日'];
const values=['SYSTEM-A','MODEL-A','SITE-A','12','2026/01/01','OFFICE-A','HOLDER-A','SALES-A','2026/02/01'];
const records=[Object.fromEntries(fields.map((f,i)=>[f,values[i]])),Object.fromEntries(fields.map((f,i)=>[f,i%2?'   ':'OTHER'])),{}];
records.forEach((r,i)=>r['NCシリアル番号']='NC'+i);
const csv=[header,...records.map(r=>header.map(h=>r[h]||''))].map(r=>r.join(',')).join('\n');
await page.locator('#csvFile').setInputFiles({name:'reference-synthetic.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
await page.waitForFunction(()=>current.loaded&&!current.busy&&!dashboardState.busy);
assert.equal(await page.locator('#referenceSearch').isVisible(),false);await page.locator('#advancedToggle').check();assert.match(await page.locator('#referenceTitle').innerText(),/参考検索.*空欄/);assert.equal(await page.locator('#referenceFields .facet-card').count(),9);
for(let i=0;i<fields.length;i++){
 const card=page.locator('#referenceFields .facet-card[data-field="'+fields[i]+'"]');const input=card.locator('input[type=search]');await input.fill(values[i]);
 if(await input.getAttribute('role')==='combobox')await card.getByRole('option',{name:values[i]+'（1件）',exact:true}).click();
 await page.locator('#searchBtn').click();await page.waitForFunction(()=>document.querySelector('#resultTitle').textContent==='1件');assert.match(await page.locator('#resultsBody').innerText(),/NC0/);
 await page.locator('#resetBtn').click();await page.waitForFunction(()=>document.querySelector('#resultTitle').textContent==='3件');await page.locator('#advancedToggle').check();
}
await page.locator('#referenceFields .facet-card[data-field="サービス拠点"] input[type=search]').fill('SITE-A');await page.getByRole('option',{name:'SITE-A（1件）',exact:true}).click();await page.locator('.facet-card[data-field="NCシリアル番号"] input[type=search]').fill('NC1');await page.locator('#searchBtn').click();await page.waitForFunction(()=>document.querySelector('#resultTitle').textContent==='0件');
await page.locator('#resetBtn').click();await page.locator('#dashboardTab').evaluate(el=>el.click());await page.locator('#qualityTab').evaluate(el=>el.click());await page.waitForFunction(()=>!dashboardState.busy);
assert.equal(await page.locator('#blankRates tbody tr').count(),33);
const row=name=>page.locator('#blankRates tbody tr').filter({has:page.locator('td:first-child',{hasText:name})});
assert.match(await row('NCシステム型名').innerText(),/1 \/ 3.*33\.3%/);assert.match(await row('工作機械モデル番号').innerText(),/2 \/ 3.*66\.7%/);assert.match(await row('NCシリアル番号').innerText(),/0 \/ 3.*0\.0%/);
await page.locator('#dashService').selectOption(JSON.stringify({kind:'value',value:'SITE-A'}));await page.locator('#dashApply').click();await page.waitForFunction(()=>!dashboardState.busy&&dashboardState.result.total===1);assert.match(await row('工作機械モデル番号').innerText(),/0 \/ 1.*0\.0%/);
await page.locator('#languageSelect').selectOption('en');assert.match(await page.locator('#blankRates').innerText(),/Blank rate by field/);await page.locator('#searchTab').evaluate(el=>el.click());await page.locator('#advancedToggle').check();assert.match(await page.locator('#referenceTitle').innerText(),/Reference search/);
assert.doesNotMatch(await page.locator('#tableWrap thead').innerText(),/undefined/);
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.locator('#languageSelect').selectOption('ja');await page.setViewportSize({width:1440,height:1200});await page.screenshot({path:path.join(root,'dist/reference-v1.11.0.png'),fullPage:true});
await page.locator('#dashboardTab').evaluate(el=>el.click());await page.locator('#qualityTab').evaluate(el=>el.click());await page.waitForFunction(()=>!dashboardState.busy);await page.evaluate(()=>requestDashboard({2:{kind:'value',value:'absent'}}));await page.waitForFunction(()=>!dashboardState.busy&&dashboardState.result.total===0);assert.match(await page.locator('#blankRates tbody tr').first().innerText(),/0 \/ 0.*—/);assert.deepEqual(errors,[]);console.log('PASS: 9 reference fields, notice, exact candidates, query search, AND, reset, 33 blank rates, whitespace, applied denominator, ja/en, mobile');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

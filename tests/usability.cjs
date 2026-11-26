// Synthetic data only. Verify the reviewed loading/search flow and accessible states.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_EXECUTABLE?{executablePath:process.env.TEST_BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href+'?embedded=1');
  assert(await page.locator('#loadPrompt').isVisible());
  for(const selector of ['#searchView','.resultspanel','.metrics'])assert.equal(await page.locator(selector).isVisible(),false);
  const fetchBox=await page.locator('#fetchBtn').boundingBox(),fileBox=await page.locator('#fileBtn').boundingBox();
  assert.equal(fetchBox.y,fileBox.y,'Data sources share one row');
  assert(await page.locator('.topbar #languageSelect').isVisible());
  if(process.env.TEST_SCREENSHOT)await page.screenshot({path:process.env.TEST_SCREENSHOT.replace(/\.png$/,'-initial.png'),fullPage:true});
  await page.locator('.beta-notice summary').focus();await page.keyboard.press('Enter');
  assert(await page.locator('#betaStatement').isVisible());
  await page.keyboard.press('Enter');assert.equal(await page.locator('#betaStatement').isVisible(),false);
  await page.selectOption('#languageSelect','en');assert.match(await page.locator('#loadPrompt').innerText(),/No data loaded/);
  assert.equal(await page.locator('#fileBtn').innerText(),'Open CSV from this PC');
  await page.selectOption('#languageSelect','ja');
  await page.locator('#csvFile').setInputFiles(path.join(root,'tests/synthetic.csv'));
  await page.waitForFunction(()=>document.getElementById('resultTitle').textContent==='3件');
  assert.equal(await page.locator('#loadPrompt').isVisible(),false);
  assert.equal(await page.locator('#loadEditor').isVisible(),false);
  assert.equal(await page.locator('#toggleLoad').getAttribute('aria-expanded'),'false');
  const overview=await page.locator('.intro').boundingBox(),metadata=await page.locator('.header-summary').boundingBox();
  assert(metadata.x>overview.x+overview.width,'Source metadata is to the right of the page title');
  assert.match(await page.locator('.header-summary #totalCount').innerText(),/3.*件/);
  assert.equal(await page.locator('#sourceKind').innerText(),'PCのCSVファイル');
  assert.match(await page.locator('.source-note').innerText(),/更新日時は取得していません/);
  assert.equal(await page.locator('#sortOrder option:checked').textContent(),'読み込んだ順');
  assert.equal(await page.locator('#exportResults').isEnabled(),true);
  const nc=page.locator('.facet-card[data-field="NCシリアル番号"] input[type=search]');
  const sample=await page.locator('#resultsBody tr').first().locator('td').nth(2).innerText();
  await nc.fill(sample);assert(await page.locator('#exportHint').isVisible());
  assert.equal(await page.locator('#exportResults').isEnabled(),false);
  await page.selectOption('#pageSize','50');
  await page.waitForFunction(()=>document.getElementById('status').classList.contains('show')===false);
  assert.equal(await page.locator('#exportResults').isEnabled(),false,'Paging must not apply draft filters');
  assert.match(await page.locator('#exportHint').innerText(),/条件を変更/);
  const resultY=(await page.locator('.resultspanel').boundingBox()).y;
  await page.locator('#searchBtn').click();await page.waitForFunction(()=>!document.getElementById('exportResults').disabled);
  assert.equal(await page.locator('#toggleFilters').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#searchEditor').isVisible(),false);
  assert((await page.locator('.resultspanel').boundingBox()).y<resultY);
  assert(await page.locator('#collapsedSummary').isVisible());
  await page.selectOption('#languageSelect','en');
  assert.equal(await page.locator('#toggleFilters').textContent(),'Show filters');
  assert.equal(await page.locator('#sourceKind').innerText(),'CSV on this PC');
  await page.locator('#toggleFilters').focus();await page.keyboard.press('Enter');assert.equal(await nc.inputValue(),sample);
  await page.locator('#toggleLoad').click();
  // A failed reload must retain the successful source, filename, rows and usable controls.
  const filename=await page.locator('#filename').innerText();
  await page.evaluate(()=>window.GDH_CSV_EXPORT_ADAPTER=async()=>{throw Error('Synthetic retrieval failure');});
  await page.locator('#fetchBtn').click();await page.locator('#fetchStatus.err').waitFor();
  assert.equal(await page.locator('#filename').innerText(),filename);
  assert.equal(await page.locator('#sourceKind').innerText(),'CSV on this PC');
  assert(await page.locator('#searchBtn').isEnabled());
  await page.evaluate(csv=>window.GDH_CSV_EXPORT_ADAPTER=async()=>({blob:new Blob([csv]),fileName:'synthetic-gdh.csv'}),fs.readFileSync(path.join(root,'tests/synthetic.csv'),'utf8'));
  const download=page.waitForEvent('download');await page.locator('#fetchBtn').click();await download;
  await page.waitForFunction(()=>document.getElementById('filename').textContent==='synthetic-gdh.csv');
  assert.equal(await page.locator('#sourceKind').innerText(),'GDH');
  assert.equal(await page.locator('#fetchHelp').isVisible(),false,'Retrieval guidance closes after success');
  assert.equal(await page.locator('#loadEditor').isVisible(),false,'Successful reload returns to compact mode');
  for(const lang of ['en','ja']){
   await page.selectOption('#languageSelect',lang);
   assert.doesNotMatch(await page.locator('#searchSummary').innerText(),/条件を変更しました|Filters changed/,'Language changes must preserve the applied state');
   for(const width of [1440,720,390,320]){
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow: '+lang+'/'+width);
    assert(await page.locator('#languageSelect').isVisible());
    assert(await page.locator('#searchBtn').isVisible());
   }
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>document.documentElement.style.zoom='2');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'200% zoom without page overflow');
  await page.evaluate(()=>document.documentElement.style.zoom='');
  // Measure key text colors against their rendered backgrounds (no whole-page compliance claim).
  const contrast=await page.evaluate(()=>{
   const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number);
   const lum=color=>rgb(color).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
   return ['.load-guidance','.language-control','.source-note','.menu-secondary [aria-current]'].map(selector=>{
    const el=document.querySelector(selector);let parent=el,bg;
    do{bg=getComputedStyle(parent).backgroundColor;parent=parent.parentElement;}while(bg==='rgba(0, 0, 0, 0)'&&parent);
    const a=lum(getComputedStyle(el).color),b=lum(bg==='rgba(0, 0, 0, 0)'?'rgb(255,255,255)':bg);
    return {selector,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
   });
  });
  for(const {selector,ratio} of contrast)assert(ratio>=4.5,selector+' contrast '+ratio);
  if(process.env.TEST_SCREENSHOT)await page.screenshot({path:process.env.TEST_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[]);console.log('PASS: onboarding, source actions, disclosure/keyboard, bilingual metadata, reload rollback, mobile/zoom and key text contrast');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

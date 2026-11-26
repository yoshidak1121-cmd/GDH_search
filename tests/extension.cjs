const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),extensionPath=path.join(root,'dist/GDH_Search_Extension');
const origin='https://global-service.fa-cnc.idc-t.melco.co.jp',search='/cncservice/viewcreator/dataview/list/ZGDS0130vBASE';
(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:process.env.TEST_EXTENSION_CHANNEL||'chromium',headless:true,...(process.env.TEST_BROWSER_EXECUTABLE?{executablePath:process.env.TEST_BROWSER_EXECUTABLE}:{}),args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
 context.setDefaultTimeout(15000);
 try{
  const fixture=fs.readFileSync(path.join(root,'tests/synthetic.csv'));let mode='csv',loads=0,largeFixture;const posts=[],blocked=[],errors=[];
  const englishFixture=Buffer.from(require('./english-headers.json').join(',')+'\n'+fixture.toString('utf8').trimEnd().split(/\r?\n/).slice(1).join('\n'));
  const hostHtml=`<!doctype html><html><head><title>機械情報 検索</title><base href="${origin}/cncservice/"></head><body><h1>機械情報 検索</h1><form id="frmmain" method="post"><input name="dataview_cd" value="synthetic-view"><input name="iszip" value="original"><input name="pdf" value="original"><input name="downloadToken" value="original"><input name="form_submit" value="true"><input name="keyword" value="first"><input name="keyword" value="second"></form></body></html>`;
  await context.route(/^https?:/,async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.href==='https://github.com/yoshidak1121-cmd/GDH_search/releases/latest/download/gdh-release.json')return route.fulfill({contentType:'application/json',body:JSON.stringify({tag_name:'v0.0.0',draft:false,prerelease:false,assets:[]})});
   if(url.origin===origin&&url.pathname==='/cncservice/home')return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>GDH home fixture</h1>'});
   if(url.origin===origin&&url.pathname===search){assert.equal(url.searchParams.get('getDataOnInit'),'false');loads++;return route.fulfill({contentType:'text/html; charset=utf-8',body:hostHtml+'<img src="/cncservice/load-barrier">'});}
   if(url.origin===origin&&url.pathname==='/cncservice/load-barrier'){await new Promise(resolve=>setTimeout(resolve,100));return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});}
   if(url.origin===origin&&url.pathname==='/cncservice/mock')return route.fulfill({contentType:'text/html; charset=utf-8',body:hostHtml});
   if(url.origin===origin&&url.pathname==='/cncservice/viewcreator/dataview/list_csv'){
    assert.equal(await source.evaluate(()=>document.readyState),'complete');posts.push({method:req.method(),fields:new URLSearchParams(req.postData())});
    if(mode==='error')return route.fulfill({status:403,body:'Forbidden'});
    return route.fulfill({contentType:'text/csv',headers:{'Content-Disposition':'attachment; filename="synthetic.csv"'},body:mode==='large'?largeFixture:mode==='english'?englishFixture:fixture});
   }
   blocked.push(req.url());return route.abort();
  });
  const source=await context.newPage();await source.goto(origin+'/cncservice/home');await source.locator('#gdh-search-extension-button').waitFor();
  assert.equal(await source.locator('#gdh-search-extension-panel').count(),0);
  const opened=context.waitForEvent('page');await source.locator('#gdh-search-extension-button').click();const page=await opened;await page.waitForLoadState();
  page.on('pageerror',e=>errors.push(e.message));let accept=true;const dialogs=[];page.on('dialog',async d=>{dialogs.push(d.message());await(accept?d.accept():d.dismiss());});
  assert.match(page.url(),/^chrome-extension:\/\/[^/]+\/viewer.html/);
  await page.locator('#csvFile').setInputFiles(path.join(root,'tests/synthetic.csv'));await page.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  const pageCount=context.pages().length;await source.locator('#gdh-search-extension-button').click();assert.equal(context.pages().length,pageCount);
  // Cancellation does not navigate or post, and loaded CSV stays usable.
  accept=false;await page.locator('#fetchBtn').click();await page.locator('#fetchStatus.err').waitFor();assert.equal(posts.length,0);assert.equal(loads,0);accept=true;
  let downloadPromise=page.waitForEvent('download');await page.locator('#fetchBtn').click();let download=await downloadPromise.catch(async error=>{console.error('CSV status:',await page.locator('#fetchStatus').textContent());throw error;});
  assert.deepEqual(fs.readFileSync(await download.path()),fixture);await page.locator('#resultTitle').filter({hasText:'3件'}).waitFor();assert.equal(loads,1);assert.equal(posts.length,1);
  assert.equal(posts[0].method,'POST');assert.equal(posts[0].fields.get('iszip'),'false');assert.deepEqual(posts[0].fields.getAll('keyword'),['first','second']);
  await source.reload();await source.locator('#gdh-search-extension-button').waitFor();assert.equal(posts.length,1);assert.match(await page.locator('#resultTitle').textContent(),/3件/);
  await source.locator('#gdh-search-extension-button').click();assert.equal(context.pages().length,pageCount);
  downloadPromise=page.waitForEvent('download');await page.locator('#fetchBtn').click();await downloadPromise;await page.locator('#resultTitle').filter({hasText:'3件'}).waitFor();assert.equal(posts.length,2);
  mode='error';await page.locator('#fetchBtn').click();await page.locator('#fetchStatus.err').waitFor();assert.match(await page.locator('#resultTitle').textContent(),/3件/);mode='english';
  downloadPromise=page.waitForEvent('download');await page.locator('#fetchBtn').click();assert.deepEqual(fs.readFileSync(await(await downloadPromise).path()),englishFixture);await page.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  const exported=page.waitForEvent('download');await page.locator('#exportResults').click();assert.ok(fs.readFileSync(await(await exported).path(),'utf8').startsWith('\ufeff'+require('./english-headers.json').map(h=>'"'+h+'"').join(',')));
  await page.locator('[data-menu=dashboard]').click();await page.locator('#dashBody tr[data-dashboard-index]').first().waitFor();assert.equal(await page.locator('#dashBody tr[data-dashboard-index]').count(),3);
  await page.locator('[data-menu=search]').click();await page.locator('#languageSelect').selectOption('en');assert.match(await page.locator('#fetchBtn').textContent(),/Get data from GDH/);await page.locator('#languageSelect').selectOption('ja');
  console.log('PASS: separate tab, source navigation, CSV retry and dashboard');
  // Registration is isolated, packaged and has no server write path.
  const beforeMock=posts.length;await page.locator('[data-menu=registration]').click();await page.locator('#registrationView').waitFor();
  const registration=page.frameLocator('#registrationFrame');await registration.locator('#maker').waitFor();
  const frameBox=await page.locator('#registrationFrame').boundingBox();assert(frameBox.y+frameBox.height<=page.viewportSize().height,'Registration controls must fit within the outer viewport');
  assert.match(await registration.locator('.mock-notice').textContent(),/開発中・モックアップのみ/);assert.equal(await registration.locator('#mazakOption').isVisible(),false);
  await registration.locator('#mazakDemo').click();assert.equal(await registration.locator('#mazakOption').isVisible(),true);
  await registration.locator('[name=customerMode][value=mazak]').check();await registration.locator('#mazakCompany').selectOption({label:'マザック現地拠点A（サンプル）'});
  await registration.locator('#maker').fill('Synthetic Maker');assert.equal(await registration.locator('#mazakOption').isVisible(),false);assert.equal(await registration.locator('[name=customerMode][value=maker]').isChecked(),true);
  await registration.locator('#shipCountry').selectOption('ID');assert.equal(await registration.locator('#serviceCenter').inputValue(),'MEIN');assert.equal(await registration.locator('#outsourcer').inputValue(),'MEIN');
  await registration.locator('#masterButton').click();await registration.locator('[data-service=MEIN]').click();assert.match(await registration.locator('#masterCount').textContent(),/MEIN：1件/);
  await page.screenshot({path:'dist/usability-review-registration.png'});
  await registration.locator('#unavailableCountries').click();assert.match(await registration.locator('#masterCount').textContent(),/143件/);assert.equal(await registration.locator('#masterRows tr').count(),143);assert(!(await registration.locator('#masterRows tr td:nth-child(2)').allTextContents()).includes('AQ'));
  await registration.locator('[data-service=all]').click();await registration.locator('#masterSort').selectOption('code');const ascending=await registration.locator('#masterRows tr td:nth-child(2)').allTextContents();await registration.locator('#masterDirection').click();const descending=await registration.locator('#masterRows tr td:nth-child(2)').allTextContents();assert.deepEqual(descending,[...ascending].reverse());
  await registration.locator('#masterSearch').fill('ZZZ-no-country');assert.match(await registration.locator('#masterCount').textContent(),/0件/);
  await registration.locator('[data-close=masterDialog]').click();await registration.locator('#saveDraft').click();assert.match(await registration.locator('#toast').textContent(),/ブラウザに保存/);
  await page.locator('[data-menu=search]').click();await page.locator('#resultTitle').filter({hasText:'3件'}).waitFor();await page.locator('[data-menu=registration]').click();assert.equal(await registration.locator('#maker').inputValue(),'Synthetic Maker');assert.equal(posts.length,beforeMock);
  await page.locator('[data-menu=search]').click();
  console.log('PASS: registration mock, MAZAK condition, service filters and sorting');
  // Large CSV transfer uses bounded packets and keeps byte-for-byte contents.
  const columns=Array(33).fill('');columns[0]='SYNTHETIC-SCALE';columns[4]='M800V';columns[21]='架空'.repeat(45);
  largeFixture=Buffer.from(fixture.toString('utf8').split(/\r?\n/)[0]+'\n'+(columns.join(',')+'\n').repeat(192836));assert(largeFixture.length>50*1024*1024);mode='large';
  downloadPromise=page.waitForEvent('download',{timeout:180000});await page.locator('#fetchBtn').click();download=await downloadPromise;assert.deepEqual(fs.readFileSync(await download.path()),largeFixture);await page.locator('#resultTitle').filter({hasText:'192,836件'}).waitFor({timeout:120000});
  const worker=context.serviceWorkers()[0];const storage=await worker.evaluate(()=>chrome.storage.session.get(null));assert(!Object.keys(storage).some(x=>x.startsWith('gdhTabExport:')));assert(!JSON.stringify(storage).includes('SYNTHETIC-SCALE'));
  // An unbound extension page and a web page cannot borrow the viewer's source.
  const unattached=await context.newPage();await unattached.goto(page.url());const rejected=await unattached.evaluate(()=>chrome.runtime.sendMessage({type:'GDH_VIEWER_EXPORT_START',confirmed:true}));assert.equal(rejected.ok,false);await unattached.close();
  const beforeForgery=posts.length;await source.evaluate(()=>window.postMessage({type:'GDH_VIEWER_EXPORT_START',confirmed:true},location.origin));assert.equal(posts.length,beforeForgery);
  await source.close();await page.locator('#fetchBtn').click();await page.locator('#fetchStatus.err').waitFor();assert.match(await page.locator('#resultTitle').textContent(),/192,836件/);
  assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);assert(dialogs.includes('CSVファイルを出力します。よろしいですか？'));
  console.log('PASS: separate/reused viewer tab, original form and session, navigation/resume once, cancel/failure retention, English CSV, dashboard, isolated registration mock, MAZAK dependency, service filters/sort, >50MB bounded transfer, unbound/forged request rejection, source-closed retention');
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

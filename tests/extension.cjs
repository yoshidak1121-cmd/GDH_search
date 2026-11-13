const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),extensionPath=path.join(root,'dist/GDH_Search_Extension');
const origin='https://global-service.fa-cnc.idc-t.melco.co.jp';
(async()=>{
 const context=await chromium.launchPersistentContext('',{channel:process.env.TEST_EXTENSION_CHANNEL||'chromium',headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
 try{
  const fixture=fs.readFileSync(path.join(root,'tests/synthetic.csv'));
  let largeFixture;
  const fixtureLines=fixture.toString('utf8').trimEnd().split(/\r?\n/),duplicateHeader=fixtureLines[0].replace(/^\ufeff/,'').split(','),duplicateRows=fixtureLines.slice(1).map(r=>r.split(','));
  duplicateRows[0][duplicateHeader.indexOf('機械メーカー')]='TEST MANUFACTURER, EXTRA MAKER';duplicateRows[0][duplicateHeader.indexOf('工作機械シリアル番号')]='S-001, S-009';
  const quote=v=>/[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
  const duplicateFixture=Buffer.from([duplicateHeader,...duplicateRows].map(r=>r.map(quote).join(',')).join('\n'));
  const englishFixture=Buffer.from(require('./english-headers.json').join(',')+'\n'+fixtureLines.slice(1).join('\n'));
  let mode='csv',homeLoads=0;const posts=[];const blocked=[];
  const hostHtml=`<!doctype html><html><head><base href="${origin}/cncservice/"></head><body><h1>テスト専用GDH機械情報画面</h1><form id="frmmain" method="post"><input name="dataview_cd" value="synthetic-view"><input name="iszip" value="original"><input name="pdf" value="original"><input name="downloadToken" value="original"><input name="form_submit" value="true"><input name="keyword" value="first"><input name="keyword" value="second"></form></body></html>`;
  await context.route(/^https?:/,async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.href==='https://github.com/yoshidak1121-cmd/GDH_search/releases/latest/download/gdh-release.json')return route.fulfill({contentType:'application/json',body:JSON.stringify({tag_name:'v0.0.0',draft:false,prerelease:false,assets:[]})});
   if(url.origin===origin&&url.pathname==='/cncservice/home')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><h1>GDH home fixture</h1><a id="machineSearchLink" href="/cncservice/viewcreator/dataview/list/synthetic-machine">機械情報 検索</a>'});
   if(url.origin===origin&&url.pathname==='/cncservice/viewcreator/dataview/list/synthetic-machine'){homeLoads++;return route.fulfill({contentType:'text/html; charset=utf-8',body:hostHtml.replace('<head>','<head><title>機械情報 検索</title>').replace('</form>','<input name="csrf_mock" value="dynamic-home-fixture"></form>')});}
   if(url.origin===origin&&url.pathname==='/cncservice/mock')return route.fulfill({contentType:'text/html; charset=utf-8',body:hostHtml});
   if(url.origin===origin&&url.pathname==='/cncservice/viewcreator/dataview/list_csv'){
    posts.push({method:req.method(),fields:new URLSearchParams(req.postData())});
    if(mode==='error')return route.fulfill({status:403,body:'Forbidden'});
    return route.fulfill({contentType:'text/csv',headers:{'Content-Disposition':'attachment; filename="synthetic.csv"'},body:mode==='large'?largeFixture:mode==='duplicate'?duplicateFixture:mode==='english'?englishFixture:fixture});
   }
   blocked.push(req.url());return route.abort();
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const dialogs=[];let accept=true;page.on('dialog',async d=>{dialogs.push(d.message());await (accept?d.accept():d.dismiss());});
  // Home opens in place after explicit confirmation, with no search-page request.
  accept=false;await page.goto(origin+'/cncservice/home?');
  await page.locator('#gdh-search-extension-button').waitFor();
  assert.equal(await page.locator('#gdh-search-extension-panel').count(),0);
  assert.equal(dialogs.pop(),'拡張検索を開きますか？');
  accept=true;await page.reload();
  const homeFrame=page.frameLocator('#gdh-search-extension-panel iframe');
  await homeFrame.locator('#gdh-home-csv-note').waitFor();
  assert.equal(new URL(page.url()).pathname,'/cncservice/home');
  assert.equal(await homeFrame.locator('#fetchBtn').isVisible(),true);
  await homeFrame.locator('#csvFile').setInputFiles(path.join(root,'tests/synthetic.csv'));
  await homeFrame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  assert.equal(posts.length,0);assert.deepEqual(blocked,[]);
  assert.equal(dialogs.pop(),'拡張検索を開きますか？');
  accept=false;await homeFrame.locator('#fetchBtn').click();await homeFrame.locator('#fetchStatus.err').waitFor();
  assert.equal(homeLoads,0);assert.equal(posts.length,0);assert.equal(dialogs.pop(),'CSVファイルを出力します。よろしいですか？');
  accept=true;const homeDownload=page.waitForEvent('download');await homeFrame.locator('#fetchBtn').click();await homeDownload;
  await homeFrame.locator('body').evaluate(()=>new Promise(resolve=>{const check=()=>document.getElementById('fetchBtn').disabled?setTimeout(check,20):resolve();check();}));
  await homeFrame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  assert.equal(await homeFrame.locator('#fetchStatus.err').count(),0);
  assert.equal(homeLoads,1);assert.equal(posts.length,1);assert.equal(posts[0].fields.get('csrf_mock'),'dynamic-home-fixture');
  assert.equal(new URL(page.url()).pathname,'/cncservice/home');assert.equal(await page.locator('iframe[aria-hidden="true"]').count(),0);
  assert.equal(dialogs.pop(),'CSVファイルを出力します。よろしいですか？');
  await page.locator('#machineSearchLink').evaluate(link=>{link.href='https://example.com/cncservice/viewcreator/dataview/list/synthetic-machine';});
  await homeFrame.locator('#fetchBtn').click();await homeFrame.locator('#fetchStatus.err').waitFor();
  assert.equal(homeLoads,1);assert.equal(posts.length,1);assert.deepEqual(blocked,[]);dialogs.pop();posts.length=0;
  await page.getByRole('button',{name:'拡張ツールを閉じる'}).click();
  await page.locator('#gdh-search-extension-button').click();await homeFrame.locator('#gdh-home-csv-note').waitFor();
  // Capture only the verified page path, then export from a home with no menu link.
  await page.goto(origin+'/cncservice/viewcreator/dataview/list/synthetic-machine?csrf_mock=never-save&keyword=never-save');
  await page.locator('#gdh-search-extension-button').waitFor();
  await page.goto(origin+'/cncservice/home?');await homeFrame.locator('#gdh-home-csv-note').waitFor();
  await page.locator('#machineSearchLink').evaluate(link=>link.remove());
  const rememberedDownload=page.waitForEvent('download');await homeFrame.locator('#fetchBtn').click();await rememberedDownload;
  await homeFrame.locator('body').evaluate(()=>new Promise(resolve=>{const check=()=>document.getElementById('fetchBtn').disabled?setTimeout(check,20):resolve();check();}));
  const remembered=await homeFrame.locator('body').evaluate(()=>chrome.storage.local.get('gdhCsvSourcePath'));
  assert.equal(remembered.gdhCsvSourcePath,'/cncservice/viewcreator/dataview/list/synthetic-machine');
  assert.equal(new URL(page.url()).pathname,'/cncservice/home');assert.equal(posts.length,1);
  dialogs.length=0;posts.length=0;
  await page.goto(origin+'/cncservice/mock');
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});const button=await page.locator('#gdh-search-extension-button').boundingBox(),heading=await page.locator('h1').boundingBox(),form=await page.locator('#frmmain').boundingBox();assert(button.y>=heading.y+heading.height);assert(button.y+button.height<=form.y);assert(button.x<40);assert(button.x+button.width<=width);}
  await page.setViewportSize({width:1440,height:900});
  await page.locator('#gdh-search-extension-button').click();
  const frame=page.frameLocator('#gdh-search-extension-panel iframe');await frame.locator('#fetchBtn').waitFor();
  const frameUrl=await page.locator('#gdh-search-extension-panel iframe').getAttribute('src');assert.match(frameUrl,/^chrome-extension:\/\//);
  const downloadPromise=page.waitForEvent('download');await frame.locator('#fetchBtn').click();
  const download=await downloadPromise;assert.equal(download.suggestedFilename(),'synthetic.csv');assert.deepEqual(fs.readFileSync(await download.path()),fixture);
  await frame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  mode='english';const englishDownload=page.waitForEvent('download');await frame.locator('#fetchBtn').click();assert.deepEqual(fs.readFileSync(await (await englishDownload).path()),englishFixture);await frame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  const resultsDownload=page.waitForEvent('download');await frame.locator('#exportResults').click();const resultsFile=await resultsDownload;assert.match(resultsFile.suggestedFilename(),/^GDH_search_results_.*\.csv$/);const resultsCSV=fs.readFileSync(await resultsFile.path(),'utf8');assert.ok(resultsCSV.startsWith('\ufeff'+require('./english-headers.json').map(h=>'"'+h+'"').join(',')));assert.match(resultsCSV,/"X1001"/);mode='csv';
  await frame.locator('[data-view=stats]').click();await frame.locator('#dashBody tr[data-dashboard-index]').first().waitFor();
  assert.equal(await frame.locator('#dashBody tr[data-dashboard-index]').count(),3);
  await frame.locator('#dashBody tr[data-dashboard-index]').first().getByRole('button').click();await frame.locator('.detailrow').first().waitFor();assert.equal(await frame.locator('.detailrow').count(),33);
  await frame.locator('[data-view=search]').click();
  await frame.locator('#languageSelect').selectOption('en');await frame.locator('#resultTitle').filter({hasText:'3 records'}).waitFor();await page.getByRole('button',{name:'Close search',exact:true}).waitFor();assert.match(await frame.locator('#fetchBtn').textContent(),/Get data from GDH/);
  await frame.locator('#languageSelect').selectOption('ja');await frame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();await page.getByRole('button',{name:'拡張ツールを閉じる',exact:true}).waitFor();
  assert.deepEqual(posts[0].fields.getAll('keyword'),['first','second']);assert.equal(posts[0].fields.get('iszip'),'false');assert.equal(posts[0].method,'POST');
  const serial=frame.locator('.facet-card[data-field="NCシリアル番号"]');
  await serial.getByRole('searchbox').fill('X1001');await serial.getByRole('button',{name:'入力語をOR条件に追加'}).click();await serial.getByRole('searchbox').fill('X1003');await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'2件'}).waitFor();
  const maker=frame.locator('.facet-card[data-field="機械メーカー"]');
  await maker.getByRole('combobox').fill('Test Manufacturer');await maker.getByRole('option',{name:'Test Manufacturer（2件）',exact:true}).click();await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'1件'}).waitFor();
  await maker.getByRole('combobox').fill('TEST MANUFACTURER');await maker.getByRole('option',{name:'TEST MANUFACTURER（1件）',exact:true}).click();await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'2件'}).waitFor();
  await frame.locator('#advancedToggle').check();await frame.locator('.facet-card[data-field="輸入国"]').getByLabel(/空欄/).check();await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'2件'}).waitFor();
  mode='error';await frame.locator('#fetchBtn').click();await frame.locator('#fetchStatus.err').waitFor();assert.equal(await frame.locator('#resultTitle').textContent(),'2件');
  mode='csv';accept=false;const before=posts.length;await frame.locator('#fetchBtn').click();await frame.locator('#fetchStatus.err').waitFor();assert.equal(posts.length,before);accept=true;
  mode='duplicate';const duplicateDownload=page.waitForEvent('download');await frame.locator('#fetchBtn').click();await duplicateDownload;await frame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  await maker.getByRole('combobox').fill('EXTRA MAKER');await maker.getByRole('option',{name:'EXTRA MAKER（1件）',exact:true}).click();await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'1件'}).waitFor();
  await frame.locator('#advancedToggle').check();const machineSerial=frame.locator('.facet-card[data-field="工作機械シリアル番号"]');await machineSerial.getByRole('searchbox').fill('S-009');await machineSerial.getByLabel('機械シリアルの一致方法').selectOption('exact');await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'1件'}).waitFor();assert.equal(await frame.locator('#resultsBody .duplicate-badge').textContent(),'重複あり');
  await frame.locator('tr[data-index]').click();await frame.locator('#detailBody .duplicate-badge').waitFor();await frame.locator('#closeDetail').click();
  await page.getByRole('button',{name:'拡張ツールを閉じる'}).click();assert.equal(await page.locator('#gdh-search-extension-panel').count(),0);
  await page.locator('#gdh-search-extension-button').click();await frame.locator('#fetchBtn').waitFor();assert.equal(await frame.locator('#filename').textContent(),'未読み込み');
  // A host-page message cannot impersonate the extension iframe.
  const countBefore=posts.length;await page.evaluate(()=>{const u=new URL(document.querySelector('#gdh-search-extension-panel iframe').src);window.postMessage({type:'GDH_SEARCH_EXPORT',channel:new URLSearchParams(u.hash.slice(1)).get('channel'),requestId:'forged'},location.origin);});
  await page.waitForTimeout(100);assert.equal(posts.length,countBefore);
  // Exercise the transferable ArrayBuffer bridge above runtime-message size limits.
  const columns=Array(33).fill('');columns[0]='SYNTHETIC-SCALE';columns[4]='M800V';columns[21]='架空'.repeat(45);
  const header=fixture.toString('utf8').split(/\r?\n/)[0];
  largeFixture=Buffer.from(header+'\n'+(columns.join(',')+'\n').repeat(192836));
  assert.ok(largeFixture.length>50*1024*1024);mode='large';
  const largeDownload=page.waitForEvent('download');await frame.locator('#fetchBtn').click();
  const largeFile=await largeDownload;assert.equal(fs.statSync(await largeFile.path()).size,largeFixture.length);
  await frame.locator('#resultTitle').filter({hasText:'192,836件'}).waitFor({timeout:120000});
  if(process.env.TEST_SCREENSHOT)await page.screenshot({path:process.env.TEST_SCREENSHOT,fullPage:true});
  await page.getByRole('button',{name:'拡張ツールを閉じる'}).click();
  // Visible validation entry opens a separate extension page; CSV state stays intact.
  await page.locator('#gdh-search-extension-button').click();await frame.locator('#fetchBtn').waitFor();
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});
   let box;
   for(let attempt=0;attempt<20;attempt++){
    box=await frame.getByRole('link',{name:'検証',exact:true}).boundingBox();
    if(box&&box.x>=0&&box.x+box.width<=width)break;
    await page.waitForTimeout(50); // Wait for the iframe renderer to apply the viewport resize.
   }
   assert(box&&box.x>=0&&box.x+box.width<=width,JSON.stringify({width,box}));
  }
  await page.setViewportSize({width:1440,height:900});
  const validationTab=context.waitForEvent('page');await frame.getByRole('link',{name:'検証',exact:true}).click();
  const validation=await validationTab;await validation.waitForLoadState();
  const validationPosts=posts.length,validationBlocked=blocked.length;
  assert.equal(await validation.locator('#validationEnabled').isChecked(),false);
  assert.equal(await validation.locator('#validationRun').isDisabled(),true);
  await validation.locator('#validationEnabled').check();await validation.locator('#validationRun').click();
  await validation.locator('#validationResult').filter({hasText:'検証成功：100件・19項目'}).waitFor();
  await validation.locator('#validationFields summary').click();assert.equal(await validation.locator('#validationFieldList li').count(),19);
  await validation.reload();assert.equal(await validation.locator('#validationEnabled').isChecked(),true);
  await validation.locator('#validationScenario').selectOption('invalid-json');await validation.locator('#validationRun').click();
  await validation.locator('#validationResult').filter({hasText:'不正なJSONを安全に拒否'}).waitFor();
  await validation.locator('#validationScenario').selectOption('empty');await validation.locator('#validationRun').click();
  await validation.locator('#validationResult').filter({hasText:'検証成功：0件・0項目'}).waitFor();
  await validation.locator('#validationClose').click();await validation.locator('#validationResult').filter({hasText:'OFFにしました'}).waitFor();
  assert.equal(await validation.locator('#validationEnabled').isChecked(),false);
  await validation.close();await page.bringToFront();assert.equal(posts.length,validationPosts);assert.equal(blocked.length,validationBlocked);
  assert.equal(dialogs[0],'CSVファイルを出力します。よろしいですか？');assert.deepEqual(errors,[]);
  // A different site does not receive the GDH button.
  await page.goto('https://example.com/').catch(()=>{});assert.equal(await page.locator('#gdh-search-extension-button').count(),0);
  console.log('PASS: home confirmation, CSV export via live iframe form with no navigation, cancellation, external-link refusal, loaded MV3 extension, GDH button, packaged Worker, CSV transfer/download, OR search, error/cancel rollback, close/reopen, forged-message rejection, host scope, 192836-row CSV transfer, validation UI/settings/persistence and zero validation HTTP');
  console.log('Browser: '+context.browser().version());
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


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
  let mode='csv';const posts=[];const blocked=[];
  const hostHtml=`<!doctype html><html><head><base href="${origin}/cncservice/"></head><body><h1>テスト専用GDH機械情報画面</h1><form id="frmmain" method="post"><input name="dataview_cd" value="synthetic-view"><input name="iszip" value="original"><input name="pdf" value="original"><input name="downloadToken" value="original"><input name="form_submit" value="true"><input name="keyword" value="first"><input name="keyword" value="second"></form></body></html>`;
  await context.route(/^https?:/,async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===origin&&url.pathname==='/cncservice/mock')return route.fulfill({contentType:'text/html; charset=utf-8',body:hostHtml});
   if(url.origin===origin&&url.pathname==='/cncservice/viewcreator/dataview/list_csv'){
    posts.push({method:req.method(),fields:new URLSearchParams(req.postData())});
    if(mode==='error')return route.fulfill({status:403,body:'Forbidden'});
    return route.fulfill({contentType:'text/csv',headers:{'Content-Disposition':'attachment; filename="synthetic.csv"'},body:mode==='large'?largeFixture:mode==='duplicate'?duplicateFixture:fixture});
   }
   blocked.push(req.url());return route.abort();
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const dialogs=[];let accept=true;page.on('dialog',async d=>{dialogs.push(d.message());await (accept?d.accept():d.dismiss());});
  await page.goto(origin+'/cncservice/mock');
  await page.locator('#gdh-search-extension-button').click();
  const frame=page.frameLocator('#gdh-search-extension-panel iframe');await frame.locator('#fetchBtn').waitFor();
  const frameUrl=await page.locator('#gdh-search-extension-panel iframe').getAttribute('src');assert.match(frameUrl,/^chrome-extension:\/\//);
  const downloadPromise=page.waitForEvent('download');await frame.locator('#fetchBtn').click();
  const download=await downloadPromise;assert.equal(download.suggestedFilename(),'synthetic.csv');assert.deepEqual(fs.readFileSync(await download.path()),fixture);
  await frame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  assert.deepEqual(posts[0].fields.getAll('keyword'),['first','second']);assert.equal(posts[0].fields.get('iszip'),'false');assert.equal(posts[0].method,'POST');
  const serial=frame.locator('.facet-card[data-field="NCシリアル番号"]');
  await serial.getByRole('searchbox').fill('X1001');await serial.getByRole('button',{name:'入力語をOR条件に追加'}).click();await serial.getByRole('searchbox').fill('X1003');await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'2件'}).waitFor();
  const maker=frame.locator('.facet-card[data-field="機械メーカー"]');
  await maker.getByRole('combobox').fill('Test Manufacturer');await maker.getByRole('option',{name:'Test Manufacturer（2件）',exact:true}).click();await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'1件'}).waitFor();
  await maker.getByRole('combobox').fill('TEST MANUFACTURER');await maker.getByRole('option',{name:'TEST MANUFACTURER（1件）',exact:true}).click();await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'2件'}).waitFor();
  await frame.locator('.facet-card[data-field="輸入国"]').getByLabel(/空欄/).check();await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'2件'}).waitFor();
  mode='error';await frame.locator('#fetchBtn').click();await frame.locator('#status.err').waitFor();assert.equal(await frame.locator('#resultTitle').textContent(),'2件');
  mode='csv';accept=false;const before=posts.length;await frame.locator('#fetchBtn').click();await frame.locator('#status.err').waitFor();assert.equal(posts.length,before);accept=true;
  mode='duplicate';const duplicateDownload=page.waitForEvent('download');await frame.locator('#fetchBtn').click();await duplicateDownload;await frame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  await maker.getByRole('combobox').fill('EXTRA MAKER');await maker.getByRole('option',{name:'EXTRA MAKER（1件）',exact:true}).click();await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'1件'}).waitFor();
  const machineSerial=frame.locator('.facet-card[data-field="工作機械シリアル番号"]');await machineSerial.getByRole('searchbox').fill('S-009');await machineSerial.getByLabel('機械シリアルの一致方法').selectOption('exact');await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'1件'}).waitFor();assert.equal(await frame.locator('#resultsBody .duplicate-badge').textContent(),'重複あり');
  await frame.locator('tr[data-index]').click();await frame.locator('#detailBody .duplicate-badge').waitFor();await frame.locator('#closeDetail').click();
  await page.getByRole('button',{name:'拡張検索を閉じる'}).click();assert.equal(await page.locator('#gdh-search-extension-panel').count(),0);
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
  await page.getByRole('button',{name:'拡張検索を閉じる'}).click();
  assert.equal(dialogs[0],'CSVファイルを出力します。よろしいですか？');assert.deepEqual(errors,[]);
  // A different site does not receive the GDH button.
  await page.goto('https://example.com/').catch(()=>{});assert.equal(await page.locator('#gdh-search-extension-button').count(),0);
  console.log('PASS: loaded MV3 extension, GDH button, packaged Worker, CSV transfer/download, OR search, error/cancel rollback, close/reopen, forged-message rejection, host scope, 192836-row CSV transfer');
  console.log('Browser: '+context.browser().version());
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});


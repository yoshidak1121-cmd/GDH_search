// Synthetic/local UI checks only; no GDH connection.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.resolve(__dirname,'../index.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_EXECUTABLE?{executablePath:process.env.TEST_BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?embedded=1`);
  const menu=page.locator('.menu-tree');assert.equal(await menu.locator('details').count(),3);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});
   for(const view of ['stats','sales','quality','search']){
    const button=menu.locator(`[data-view="${view}"]`);await button.click();
    assert.equal(await button.getAttribute('aria-current'),'page');
    assert.equal(await page.locator('#dashboard').isVisible(),view!=='search');
    if(view==='sales')assert(await page.locator('#salesView').isVisible());
    if(view==='quality'||view==='stats')assert(await page.locator('#dashboardStandard').isVisible());
    const box=await button.boundingBox();assert.equal(box.height,34);
   }
  }
  await menu.locator('summary').first().click();assert.equal(await menu.locator('[data-view="search"]').isVisible(),false);
  await menu.locator('summary').first().click();await menu.locator('[data-view="search"]').focus();await page.keyboard.press('Enter');
  await page.selectOption('#languageSelect','en');assert.equal(await menu.locator('[data-view="quality"]').textContent(),'Data quality');
  assert.deepEqual(errors,[]);console.log('PASS: navigation, collapse, keyboard, language and 390/1440px layouts');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

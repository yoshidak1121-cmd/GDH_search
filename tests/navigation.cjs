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
  const menu=page.locator('.menu-tree');assert.equal(await menu.locator('[data-menu]').count(),3);
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:900});
   for(const view of ['stats','sales','quality','search']){
    await menu.locator(`[data-menu="${view==='stats'||view==='sales'?'dashboard':view}"]`).click();
    const button=menu.locator(`[data-view="${view}"]`);await button.click();
    assert.equal(await button.getAttribute('aria-current'),'page');
    assert.equal(await page.locator('#dashboard').isVisible(),view!=='search');
    if(view==='sales')assert(await page.locator('#salesView').isVisible());
    if(view==='quality'||view==='stats')assert(await page.locator('#dashboardStandard').isVisible());
    const box=await button.boundingBox();assert(box.height>=36);
    assert.equal(await menu.locator('[aria-current="page"]:visible').count(),1);
    assert(await page.locator('#languageSelect').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   }
  }
  await menu.locator('[data-menu="dashboard"]').focus();await page.keyboard.press('Enter');assert(await page.locator('#dashboard').isVisible());
  await menu.locator('[data-menu="search"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#dashboard').isVisible(),false);
  await page.selectOption('#languageSelect','en');assert.equal(await menu.locator('[data-view="quality"]').textContent(),'Data quality');
  assert.deepEqual(errors,[]);console.log('PASS: two-level navigation, current page, keyboard, shared language and 390/1440px layouts');
 }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

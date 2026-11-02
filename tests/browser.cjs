const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright'); // Development-only; the viewer itself has no dependencies.
const root = path.resolve(__dirname, '..');
(async () => {
 const browser = await chromium.launch({headless:true, ...(process.env.TEST_BROWSER_CHANNEL ? {channel:process.env.TEST_BROWSER_CHANNEL} : {})});
 let server;
 try {
  const page = await browser.newPage({viewport:{width:1600,height:1000}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.locator('#csvFile').setInputFiles(path.join(root,'tests/synthetic.csv'));
  const count = n => page.waitForFunction(n=>document.querySelector('#resultTitle').textContent===n+'件', n);
  await count(3);
  await page.locator('input[value="standard"]').check();
  await page.locator('#keyword').fill('X1001 X1003');await page.locator('#searchBtn').click();await count(0);
  await page.locator('#queryJoin').selectOption('OR');await count(2);
  await page.locator('#keyword').fill('(M800V OR M800W) AND X1002');await page.locator('#searchBtn').click();await count(1);
  assert.match(await page.locator('#resultsBody').innerText(),/X1002/);
  await page.locator('tr[data-index]').focus();await page.keyboard.press('Enter');await page.waitForSelector('.detailrow');
  assert.equal(await page.locator('.detailrow').count(),33);
  await page.locator('#keyword').fill('X1001 OR');await page.locator('#searchBtn').click();await page.waitForSelector('#status.err');
  assert.match(await page.locator('#resultsBody').innerText(),/X1002/);
  await page.locator('#resetBtn').click();await count(3);assert.equal(await page.locator('#queryJoin').inputValue(),'AND');
  await page.locator('#keyword').fill('X1001 X1003');await page.locator('#queryJoin').selectOption('OR');await count(2);
  await page.locator('#csvFile').setInputFiles(path.join(root,'tests/synthetic.csv'));await count(3);assert.equal(await page.locator('#queryJoin').inputValue(),'AND');
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:1600,height:1000});
  server=http.createServer((req,res)=>{
   const pathname=new URL(req.url,'http://localhost').pathname;
   if(pathname==='/host'){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.end('<div id="mount"></div><script src="/gdh-embed.js"></script><script>window.mounted=mountCncMachineViewer(document.getElementById("mount"),{viewerUrl:"/index.html",exportCsv:async()=>({blob:await (await fetch("/tests/synthetic.csv")).blob(),fileName:"synthetic.csv"})});</script>');return;
   }
   const allowed={'/index.html':'text/html; charset=utf-8','/gdh-embed.js':'text/javascript; charset=utf-8','/tests/synthetic.csv':'text/csv; charset=utf-8'};
   if(!allowed[pathname]){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',allowed[pathname]);res.end(fs.readFileSync(path.join(root,pathname.slice(1))));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  await page.goto('http://127.0.0.1:'+server.address().port+'/host');
  const frame=page.frameLocator('iframe');await frame.locator('#fetchBtn').waitFor();
  await page.waitForFunction(()=>typeof document.querySelector('iframe').contentWindow.GDH_CSV_EXPORT_ADAPTER==='function');
  assert.equal(await frame.locator('.topbar').isVisible(),false);
  const download=page.waitForEvent('download');await frame.locator('#fetchBtn').click();assert.equal((await download).suggestedFilename(),'synthetic.csv');
  await frame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
  await frame.locator('input[value="standard"]').check();await frame.locator('#keyword').fill('X1001 OR X1003');await frame.locator('#searchBtn').click();await frame.locator('#resultTitle').filter({hasText:'2件'}).waitFor();
  assert.equal(await page.evaluate(()=>{try{mountCncMachineViewer(document.getElementById('mount'),{viewerUrl:'https://example.com/index.html'});return false;}catch{return true;}}),true);
  if(process.env.TEST_SCREENSHOT)await page.screenshot({path:process.env.TEST_SCREENSHOT,fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: browser AND/OR, expression errors, keyboard detail, reset/reload, mobile layout, same-origin GDH iframe and parent Blob adapter');
  console.log('Browser: '+browser.version());
 } finally {await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});

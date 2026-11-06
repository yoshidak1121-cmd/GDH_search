const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..'),en=require('./english-headers.json');
const ja=fs.readFileSync(path.join(__dirname,'synthetic.csv'),'utf8').replace(/^\ufeff/,'').split(/\r?\n/)[0].split(',');
(async()=>{const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;if(name!=='/index.html'){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'index.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{})});
 for(const ui of ['ja','en'])for(const heads of [ja,en]){const p=await browser.newPage({acceptDownloads:true});try{
  await p.goto('http://127.0.0.1:'+server.address().port+'/index.html?lang='+ui);
  const row=en.map((_,i)=>i===0?'NC-TEST-001':i===3?'SER-TEST-001':i===5?'Example Maker':i===21?'Example User':''),csv=[heads,row].map(r=>r.join(',')).join('\n');
  await p.evaluate(csv=>{window.GDH_CSV_EXPORT_ADAPTER=async()=>({blob:new Blob([csv],{type:'text/csv'}),fileName:'synthetic-english.csv'});},csv);
  const pending=p.waitForEvent('download');await p.locator('#fetchBtn').click();const download=await pending;
  assert.equal(fs.readFileSync(await download.path(),'utf8'),csv);await p.waitForFunction(()=>document.querySelector('#totalCount').textContent.includes('1'));
  const serial=p.locator('.facet-card[data-field="工作機械シリアル番号"] input[type="search"]');await serial.fill('SER-TEST-001');await p.locator('#searchBtn').click();await p.waitForFunction(()=>document.querySelector('#resultsBody tr[data-index]'));
  assert.match(await p.locator('#resultsBody').innerText(),/Example Maker/);await p.locator('#resultsBody tr[data-index]').click();await p.waitForSelector('.detailrow');assert.equal(await p.locator('.detailrow').count(),33);
  await p.locator('#languageSelect').selectOption(ui==='ja'?'en':'ja');assert.equal(await serial.inputValue(),'SER-TEST-001');assert.match(await p.locator('#detailBody').innerText(),/Example User/);assert.equal(await p.locator('.detailrow').count(),33);
  // Local loading uses the same mapping as downloaded CSVs.
  await p.locator('#csvFile').setInputFiles({name:'synthetic-local.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await p.waitForFunction(()=>document.querySelector('#filename').textContent==='synthetic-local.csv');assert.match(await p.locator('#resultsBody').innerText(),/NC-TEST-001/);
  console.log('PASS: UI '+ui+', '+(heads===en?'English':'Japanese')+' headers, unchanged download, automatic/local import, serial filter, all details and language switch');
 }finally{await p.close();}}
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 let server,browser;
 const requests=[];
 try{
 server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname==='/gdh/host'){
   res.setHeader('Content-Type','text/html; charset=utf-8');
   res.end(`<!doctype html><base href="/gdh/"><form id="frmmain" method="post"><input name="dataview_cd" value="synthetic-view"><input name="keyword" value="first"><input name="keyword" value="second"><input name="iszip" value="original"><input name="pdf" value="original"><input name="downloadToken" value="original"><input name="form_submit" value="true"><input name="csrf_mock" value="dynamic-test-value"><input name="mockMode" value="csv"></form><div id="mount"></div><script src="/gdh-export.js"></script><script src="/gdh-embed.js"></script><script>window.confirmAnswer=true;window.imuiConfirm=(message,title,yes,no)=>{window.lastPrompt=message;(window.confirmAnswer?yes:no)();};window.adapter=createGdhCsvExportAdapter();window.frame=mountCncMachineViewer(document.getElementById('mount'),{viewerUrl:'/index.html',sourceForm:document.getElementById('frmmain')});</script>`);return;
  }
  if(pathname==='/gdh/viewcreator/dataview/list_csv'){
   let body='';for await(const chunk of req)body+=chunk;
   const fields=new URLSearchParams(body);requests.push({method:req.method,type:req.headers['content-type'],fields});
   const mode=fields.get('mockMode');
   if(mode==='forbidden'){res.writeHead(403);res.end();return;}
   if(mode==='redirect'){res.writeHead(302,{Location:'/login'});res.end();return;}
   if(mode==='html'){res.setHeader('Content-Type','text/html');res.end('<html>Login</html>');return;}
   if(mode==='zip'){res.end('PK\x03\x04not-csv');return;}
   if(mode==='empty'){res.end();return;}
   if(mode==='slow')await new Promise(resolve=>setTimeout(resolve,150));
   res.setHeader('Content-Type','text/csv');res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent('架空データ.csv'));
   res.end(fs.readFileSync(path.join(root,'tests/synthetic.csv')));return;
  }
  const files={'/index.html':'text/html; charset=utf-8','/gdh-export.js':'text/javascript','/gdh-embed.js':'text/javascript'};
  if(files[pathname]){res.setHeader('Content-Type',files[pathname]);res.end(fs.readFileSync(path.join(root,pathname.slice(1))));return;}
  res.writeHead(404);res.end();
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{})});
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:'+server.address().port+'/gdh/host');
 await page.waitForFunction(()=>typeof frame.contentWindow.GDH_CSV_EXPORT_ADAPTER==='function');
 const frame=page.frameLocator('iframe');const download=page.waitForEvent('download');await frame.locator('#fetchBtn').click();
 assert.equal((await download).suggestedFilename(),'架空データ.csv');await frame.locator('#resultTitle').filter({hasText:'3件'}).waitFor();
 assert.equal(requests.length,1);const r=requests[0];assert.equal(r.method,'POST');assert.match(r.type,/application\/x-www-form-urlencoded/);
 assert.deepEqual(r.fields.getAll('keyword'),['first','second']);assert.equal(r.fields.get('csrf_mock'),'dynamic-test-value');
 assert.equal(r.fields.get('dataview_cd'),'synthetic-view');assert.equal(r.fields.get('iszip'),'false');assert.equal(r.fields.get('pdf'),'false');assert.match(r.fields.get('downloadToken'),/^\d+$/);
 assert.deepEqual(await page.evaluate(()=>['iszip','pdf','downloadToken'].map(n=>document.getElementById('frmmain').elements[n].value)),['original','original','original']);
 assert.equal(await page.evaluate(()=>lastPrompt),'CSVファイルを出力します。よろしいですか？');
 for(const mode of ['html','zip','empty','forbidden','redirect']){
  await page.evaluate(mode=>document.getElementById('frmmain').elements.mockMode.value=mode,mode);
  await frame.locator('#fetchBtn').click();await frame.locator('#status.err').waitFor();assert.equal(await frame.locator('#resultTitle').textContent(),'3件');
 }
 const beforeCancel=requests.length;await page.evaluate(()=>{confirmAnswer=false;});await frame.locator('#fetchBtn').click();await frame.locator('#status.err').waitFor();assert.equal(requests.length,beforeCancel);
 await page.evaluate(()=>{confirmAnswer=true;document.getElementById('frmmain').elements.mockMode.value='slow';});
 const busy=await page.evaluate(async()=>{const p=adapter();let blocked=false;try{await adapter();}catch{blocked=true;}await p;return blocked;});assert.equal(busy,true);
 const timeout=await page.evaluate(async()=>{try{await createGdhCsvExportAdapter({timeoutMs:20})();return false;}catch(e){return e.message.includes('タイムアウト');}});assert.equal(timeout,true);
 await page.evaluate(()=>{document.getElementById('frmmain').elements.mockMode.value='csv';});
 const afterTimeout=await page.evaluate(async()=>{const result=await adapter();return result.blob.size>0;});assert.equal(afterTimeout,true);
 const beforeMissing=requests.length;
 assert.equal(await page.evaluate(async()=>{document.getElementById('frmmain').elements.form_submit.remove();try{await adapter();return false;}catch{return true;}}),true);assert.equal(requests.length,beforeMissing);
 const beforeCross=requests.length;
 assert.equal(await page.evaluate(async()=>{document.querySelector('base').href='https://example.com/';try{await adapter();return false;}catch{return true;}}),true);assert.equal(requests.length,beforeCross);
 console.log('PASS: GDH form POST, repeated/current fields, CSV-only flags, live security field, confirmation, iframe import/download, error rollback, cancellation, busy lock, timeout, missing fields, same-origin guard');
 }finally{if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});

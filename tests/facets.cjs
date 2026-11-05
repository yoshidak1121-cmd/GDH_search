const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{})});
 try{
 const header=fs.readFileSync(path.join(root,'tests/synthetic.csv'),'utf8').split(/\r?\n/)[0].replace(/^\ufeff/,'').split(',');
 const data=[['QA1','A','Maker A','US','(株)あおぞら','DEMO-001'],['QA2','B','Maker B','US','㈱アオゾラ','DEMO001'],['QA3','B','Maker A','DE','株式会社あおぞら','DEMO-003'],['QA4','','Maker A','DE','株式会社あおそら','DEMO-004'],['QA5','A','Maker B','US','有限会社あおぞら','DEMO-005']];
 const rows=data.map(([id,type,maker,country,name,serial])=>{const r=Array(33).fill('');for(const [h,v] of Object.entries({'NCシリアル番号':id,'契約タイプ':type,'機械メーカー':maker,'輸入国':country,'輸出国':'JP','エンドユーザー':name,'工作機械シリアル番号':serial}))r[header.indexOf(h)]=v;return r;});
 const bytes=(heads=header,body=rows)=>Buffer.from([heads,...body].map(r=>r.join(',')).join('\n'));
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 const count=n=>page.waitForFunction(n=>document.querySelector('#resultTitle').textContent===n+'件',n);
 const load=async buffer=>{await page.locator('#csvFile').setInputFiles({name:'synthetic-seven.csv',mimeType:'text/csv',buffer});await page.waitForFunction(()=>!document.getElementById('fileBtn').disabled);await count(5);};
 const search=async n=>{await page.locator('#searchBtn').click();await count(n);};
 const card=name=>page.locator('.facet-card[data-field="'+name+'"]');
 const clear=async()=>{await page.locator('#resetBtn').click();await count(5);await page.locator('#advancedToggle').check();};
 await load(bytes());await page.locator('#advancedToggle').check();assert.equal(await page.locator('#facetFields .facet-card').count(),7);assert.equal(await page.locator('#keyword').isVisible(),false);
 for(const name of ['工作機械シリアル番号','NCシリアル番号','エンドユーザー']){assert.ok((await card(name).locator('input[type=search]').boundingBox()).width>180,'Input width: '+name);}
 const box=async name=>card(name).boundingBox();
 const left=await box('工作機械シリアル番号'),right=await box('契約タイプ');assert.ok(right.x>left.x+left.width,'Contract is in the right column');
 for(const name of ['NCシリアル番号','機械メーカー','エンドユーザー'])assert.equal((await box(name)).x,left.x);
 for(const name of ['輸入国','輸出国'])assert.equal((await box(name)).x,right.x);
 const searchBox=await page.locator('#searchBtn').boundingBox();for(const name of ['工作機械シリアル番号','NCシリアル番号','機械メーカー','エンドユーザー','契約タイプ','輸入国','輸出国']){const field=await box(name);assert.ok(searchBox.y>=field.y+field.height,'Search below '+name);}
 assert.equal(await card('機械メーカー').getByRole('option').count(),0); // Candidate menu closed until focus.
 await card('契約タイプ').getByLabel('A（2件）',{exact:true}).check();await card('契約タイプ').getByLabel('B（2件）',{exact:true}).check();await search(4);
 await card('機械メーカー').getByRole('combobox').fill('Maker A');await card('機械メーカー').getByRole('option',{name:'Maker A（3件）',exact:true}).click();await search(2);
 await card('輸入国').getByRole('combobox').fill('US');await card('輸入国').getByRole('option',{name:'US（3件）',exact:true}).click();await search(1);
 await clear();await card('工作機械シリアル番号').getByRole('searchbox').fill('DEMO001');await search(1);assert.match(await page.locator('#resultsBody').innerText(),/QA2/);
 await clear();await card('エンドユーザー').getByRole('combobox',{name:'エンドユーザー',exact:true}).fill('株式会社あおぞら');await card('エンドユーザー').getByRole('combobox',{name:'エンドユーザー',exact:true}).press('Enter');await count(3);assert.match(await card('エンドユーザー').locator('.facet-values').innerText(),/含む/);assert.equal(await card('エンドユーザー').locator('.facet-values button').count(),1);
 await card('NCシリアル番号').getByRole('searchbox').fill('QA1');await search(1);
 await clear();const input=card('エンドユーザー').getByRole('combobox',{name:'エンドユーザー',exact:true});await input.fill('株式会社あおぞら');await card('エンドユーザー').getByRole('option',{name:'㈱アオゾラ（1件）',exact:true}).waitFor();await input.press('ArrowDown');assert.ok(await input.getAttribute('aria-activedescendant'));await card('エンドユーザー').getByRole('option',{name:'㈱アオゾラ（1件）',exact:true}).click();await search(1);assert.match(await page.locator('#resultsBody').innerText(),/QA2/);assert.match(await card('エンドユーザー').locator('.facet-values').innerText(),/元の表記/);
 await clear();await input.fill('株式会社あおぞら');await card('エンドユーザー').getByRole('option',{name:/株式会社あおそら.*類似候補/}).waitFor();await search(3); // Similar candidates are not automatically included.
 await clear();const makerInput=card('機械メーカー').getByRole('combobox');await makerInput.fill('Maker B');await card('機械メーカー').getByRole('option',{name:'Maker B（2件）',exact:true}).waitFor();await makerInput.fill('Maker A');await makerInput.press('ArrowDown');await makerInput.press('Enter');assert.doesNotMatch(await card('機械メーカー').locator('.facet-values').innerText(),/Maker B/);await clear();await card('機械メーカー').getByRole('combobox').fill('Maker');await page.locator('#searchBtn').click();await page.locator('#status.err').waitFor();assert.match(await page.locator('#status').textContent(),/候補から選択/);await clear();
 await card('契約タイプ').getByLabel(/空欄/).check();await search(1);assert.match(await page.locator('#resultsBody').innerText(),/QA4/);await clear();assert.equal(await card('契約タイプ').getByRole('checkbox').count(),2+1);
 const changed=rows.map(r=>r.map((v,i)=>header[i]==='機械メーカー'&&v==='Maker A'?'Maker C':v));await load(bytes(header,changed));const changedMaker=card('機械メーカー').getByRole('combobox');await changedMaker.fill('Maker C');await card('機械メーカー').getByRole('option',{name:'Maker C（3件）',exact:true}).waitFor();assert.equal(await card('機械メーカー').locator('.facet-values button').count(),0);await clear();
 const reversed=header.slice().reverse();await load(bytes(reversed,rows.map(r=>r.slice().reverse())));await card('NCシリアル番号').getByRole('searchbox').fill('QA3');await search(1);await clear();
 const missing=header.filter(h=>h!=='輸出国');await load(bytes(missing,rows.map(r=>r.filter((_,i)=>header[i]!=='輸出国'))));await card('輸出国').getByText('このCSVに対応する列がありません。').waitFor();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);for(const name of ['工作機械シリアル番号','NCシリアル番号','エンドユーザー'])assert.ok((await card(name).locator('input[type=search]').boundingBox()).width>120);
 if(process.env.TEST_SCREENSHOT){await load(bytes());await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:process.env.TEST_SCREENSHOT,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS: fixed seven fields, OR/AND, explicit choices, serial punctuation, end-user variants/raw exact/similar candidates, Enter behavior, clear, CSV reorder/missing column, mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

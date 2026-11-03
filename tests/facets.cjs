const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.TEST_BROWSER_CHANNEL?{channel:process.env.TEST_BROWSER_CHANNEL}:{})});
 try{
 const header=fs.readFileSync(path.join(root,'tests/synthetic.csv'),'utf8').split(/\r?\n/)[0].replace(/^\ufeff/,'').split(',');
 const make=(id,type,service,maker,date,months)=>{const row=Array(33).fill('');for(const [h,v] of Object.entries({'NCシリアル番号':id,'契約タイプ':type,'サービス拠点':service,'機械メーカー':maker,'契約開始日':date,'契約期間（月）':months,'販売会社':'Sales A','輸出国':'JP','輸入国':'US'}))row[header.indexOf(h)]=v;return row.join(',');};
 const buffer=Buffer.from(header.join(',')+'\n'+[make('QA1','A','East','Maker A','2024/01/01','12'),make('QA2','B','East','Maker B','2024-06-30','24'),make('QA3','B','West','Maker A','2025/01/01','36'),make('QA4','','East','Maker A','','')].join('\n'));
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(root,'index.html')).href);
 const load=async()=>{await page.locator('#csvFile').setInputFiles({name:'synthetic-fields.csv',mimeType:'text/csv',buffer});await count(4);};
 const count=n=>page.waitForFunction(n=>document.querySelector('#resultTitle').textContent===n+'件',n).catch(async e=>{console.log({expected:n,actual:await page.locator('#resultTitle').textContent(),status:await page.locator('#status').textContent(),errors});throw e;});
 const search=async n=>{await page.locator('#searchBtn').click();await count(n);};
 const card=name=>page.locator('.facet-card[data-column="'+header.indexOf(name)+'"]');
 const add=async name=>{await page.locator('#facetField').selectOption(String(header.indexOf(name)));await page.locator('#addFacet').click();};
 await load();await page.locator('#facetPanel summary').click();
 await card('契約タイプ').getByLabel('A（1件）',{exact:true}).check();await card('契約タイプ').getByLabel('B（2件）',{exact:true}).check();await search(3);
 await card('サービス拠点').getByRole('combobox').fill('East');await card('サービス拠点').getByRole('option',{name:'East（3件）',exact:true}).click();await search(2);
 await card('機械メーカー').getByRole('combobox').fill('Maker A');await card('機械メーカー').getByRole('option',{name:'Maker A（3件）',exact:true}).waitFor();await card('機械メーカー').getByRole('combobox').press('ArrowDown');await page.keyboard.press('Enter');await search(1);
 await page.locator('#keyword').fill('QA2');await search(0);await page.locator('#clearFacets').click();await count(1);
 await page.locator('#resetBtn').click();await count(4);
 await card('契約タイプ').getByLabel(/空欄も選択/).check();await search(1);assert.match(await page.locator('#resultsBody').innerText(),/QA4/);
 await page.locator('#clearFacets').click();await count(4);
 await add('契約期間（月）');await card('契約期間（月）').getByLabel('契約期間（月） 最小月数',{exact:true}).fill('12');await card('契約期間（月）').getByLabel('契約期間（月） 最大月数',{exact:true}).fill('24');await search(2);
 await card('契約期間（月）').getByRole('combobox').fill('36');await card('契約期間（月）').getByRole('option',{name:'36（1件）'}).click();await search(3);
 await card('契約期間（月）').getByLabel(/空欄も選択/).check();await search(4);
 await add('契約開始日');await card('契約開始日').getByLabel('契約開始日 開始日',{exact:true}).fill('2024-01-01');await card('契約開始日').getByLabel('契約開始日 終了日',{exact:true}).fill('2024-06-30');await search(2);
 await card('契約開始日').getByLabel('契約開始日 開始日',{exact:true}).fill('2025-01-01');await page.locator('#searchBtn').click();await page.locator('#status.err').waitFor();assert.equal(await page.locator('#resultTitle').textContent(),'2件');
 await page.locator('#clearFacets').click();await count(4);await add('NCシリアル番号');await card('NCシリアル番号').getByRole('searchbox').fill('QA1');await card('NCシリアル番号').getByRole('button',{name:'OR条件として追加'}).click();await card('NCシリアル番号').getByRole('searchbox').fill('QA3');await search(2);
 await card('NCシリアル番号').getByRole('button',{name:'NCシリアル番号の条件を削除'}).click();await search(4);
 await add('NCシリーズ名');await card('NCシリーズ名').getByText('この列は全件空欄です。').waitFor();assert.equal(await card('NCシリーズ名').getByRole('combobox').isDisabled(),true);
 await page.locator('#resetBtn').click();await count(4);
 await card('機械メーカー').getByRole('combobox').fill('Maker B');await load();assert.equal(await page.locator('#facetCount').textContent(),'指定なし');assert.equal(await page.locator('.facet-card').count(),6);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 if(process.env.TEST_SCREENSHOT){await page.setViewportSize({width:1440,height:1100});await page.screenshot({path:process.env.TEST_SCREENSHOT,fullPage:true});}
 assert.deepEqual(errors,[]);console.log('PASS: field UI OR/AND, exact suggestions and keyboard choice, keyword intersection, blank, numeric union, date validation, ID input, clear/remove/reload, empty column, mobile');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

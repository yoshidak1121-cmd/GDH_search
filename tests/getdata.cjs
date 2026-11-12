'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
(async()=>{
 let network=0;const saved={};
 const context=vm.createContext({setTimeout,clearTimeout,console:{table(){}},fetch(){network++;throw Error('Network forbidden');},chrome:{storage:{local:{async get(key){return {[key]:saved[key]};},async set(values){Object.assign(saved,values);}}}}});
 for(const file of ['getdata-adapter.js','getdata-validation.js','getdata-schema.js'])vm.runInContext(fs.readFileSync('extension/'+file,'utf8'),context);
 const schema=context.GdhContractSchema.describe();
 assert.equal(schema.rows.length,19);assert.equal(schema.candidateCount,9);assert.equal(schema.unavailableCsv.length,24);
 const pairs=new Map(schema.rows.map(row=>[row.field,row.csv]));
 assert.equal(pairs.get('contract_id'),'契約ID');assert.equal(pairs.get('contract_no'),'契約番号');
 assert.equal(pairs.get('nc_serial_no'),'NCシリアル番号');assert.equal(pairs.get('contractor_id'),'契約者ID');
 for(const column of ['工作機械シリアル番号','契約者名','NCモデルID'])assert(schema.unavailableCsv.includes(column));
 const partial=context.GdhContractSchema.describe(['contract_id','unexpected']);assert.equal(partial.rows.find(row=>row.field==='contract_id').present,true);assert.equal(partial.rows.find(row=>row.field==='contract_no').present,false);assert.equal(partial.unexpectedFields[0],'unexpected');
 const app=fs.readFileSync('index.html','utf8');
 const canonical=[...app.slice(app.indexOf('const englishHeaders ='),app.indexOf('const cap =')).matchAll(/\["[^"]+","([^"]+)"\]/g)].map(match=>match[1]);
 assert.equal(canonical.length,33);assert.deepEqual([...new Set([...schema.rows.map(row=>row.csv).filter(Boolean),...schema.unavailableCsv])].sort(),canonical.sort());
 const migration=context.GdhContractSchema.migration();assert.equal(migration.rows.length,33);assert.equal(migration.tables.length,10);
 const metadata=new Map();
 for(const part of fs.readFileSync('reference/ZALS_TABLE_COLUMNS.md','utf8').split(/\n## /).slice(1)){
  const table=part.match(/`([A-Z][A-Z0-9_]+)`/);if(table)metadata.set(table[1],new Set([...part.matchAll(/\|\s*\d+\s*\|\s*`([a-z0-9_]+)`/g)].map(match=>match[1])));
 }
 for(const row of migration.rows)for(const source of row.sources){const [table,column]=source.split('.');assert(metadata.get(table)?.has(column),source);}
 assert(migration.rows.find(row=>row.csv==='NCシステム型名').sources.length===2);
 const safeReport=context.GdhContractSchema.report({source:'getData-live',summary:{count:100,fields:['SYNTHETIC-SECRET']},data:['SYNTHETIC-SECRET'],im_mark:'SYNTHETIC-SECRET',keyChecks:[{field:'contract_id',blankCount:0,distinctCount:100}]},'1.18.0');
 assert(!safeReport.includes('SYNTHETIC-SECRET'));assert(safeReport.includes('contract_id | 0 | 100'));assert(safeReport.includes('33項目・10テーブル'));
 const api=context.GDH_GETDATA_VALIDATION;
 assert.equal(await api.enabled(),false);
 await assert.rejects(api.run(),{code:'MODE_OFF'});
 await api.setEnabled(true);
 const result=await api.run();assert.equal(result.data.length,100);assert.equal(result.summary.fields.length,19);assert.equal(result.summary.valid,true);assert.equal(result.request.pageline,100);
 assert.equal((await api.run({scenario:'empty',pagenumber:2})).summary.count,0);
 for(const [scenario,code] of [['http-error','HTTP_ERROR'],['auth-error','AUTH_REQUIRED'],['forbidden','AUTH_REQUIRED'],['error','INVALID_RESPONSE'],['invalid-json','INVALID_JSON'],['invalid-data','INVALID_RESPONSE']])await assert.rejects(api.run({scenario}),{code});
 await assert.rejects(api.run({source:'production'}),{code:'PRODUCTION_DISABLED'});
 const short=context.GdhGetData.create({isEnabled:api.enabled,timeoutMs:10});
 const pending=short({scenario:'timeout'});await assert.rejects(short(),{code:'BUSY'});await assert.rejects(pending,{code:'TIMEOUT'});
 assert.equal((await short()).data.length,100);
 await api.setEnabled(false);await assert.rejects(api.run(),{code:'MODE_OFF'});
 assert.equal(network,0);assert.deepEqual(saved,{gdhGetDataValidationEnabled:false});
 const manifest=JSON.parse(fs.readFileSync('extension/manifest.json'));
 assert(!manifest.content_scripts[0].js.some(s=>s.includes('getdata')));
 assert(!manifest.web_accessible_resources[0].resources.some(s=>s.includes('getdata')));
 console.log('PASS: OFF/ON, 100 rows/19 columns, empty, HTTP/auth/RPC/JSON errors, production blocked, timeout, duplicate guard, boolean-only storage, zero network');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Synthetic-only smoke test; never include real GDH exports in source control.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const match = html.match(/<script id="worker-source" type="text\/plain">([\s\S]*?)<\/script>/);
if (!match) throw Error('Worker code missing');
const out = [];
class FileReaderSync { readAsArrayBuffer(file) { const buf = fs.readFileSync(file.path); return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); } }
const context = { FileReaderSync, TextDecoder, postMessage: msg => out.push(msg), Date, Map, Array, Math, String, Number, RegExp, Set };
vm.createContext(context); vm.runInContext(match[1], context);
function send(data) { const start = out.length; context.onmessage({ data }); return out.slice(start); }
function search(query, mode = 'fuzzy') { return send({ type: 'search', query, mode, column: 'all', sort: 'relevance', page: 1, pageSize: 20 }).find(msg => msg.type === 'page'); }
const file = path.join(__dirname, 'synthetic.csv');
const messages = send({ type: 'load', file: { path: file, name: 'synthetic.csv', size: fs.statSync(file).size } });
const loaded = messages.find(msg => msg.type === 'loaded');
if (!loaded || loaded.count !== 3 || loaded.headings.length !== 33) throw Error('CSV parse/count failed');
if (search('M800V', 'standard').total !== 2) throw Error('Whitespace normalization failed');
if (search('M800W', 'fuzzy').total !== 3) throw Error('Fuzzy model lookup failed');
if (search('X1001').total !== 1) throw Error('Identifier exact lookup failed');
if (search('X1004').total !== 0) throw Error('Identifier misidentified as same machine');
console.log('PASS: 33-column CSV, normalization, fuzzy model search, strict IDs');
function booleanSearch(query, join='AND', column='all', mode='standard', page=1, pageSize=20) {
 return send({type:'search',query,join,column,mode,sort:'original',page,pageSize});
}
function expectIds(query, expected, join='AND', column='all', mode='standard') {
 const page=booleanSearch(query,join,column,mode).find(m=>m.type==='page');
 if(!page || page.entries.map(e=>e.values[0]).join(',')!==expected) throw Error('Boolean lookup failed: '+query);
}
expectIds('M800V X1001','X1001');
expectIds('X1001 X1003','X1001,X1003','OR');
expectIds('X1001 or X1003','X1001,X1003');
expectIds('M800V and X1001','X1001');
expectIds('X1001 OR X1002 AND M800W','X1001');
expectIds('(X1001 OR X1002) AND M800W','');
expectIds('(M800V OR M800W) AND X1002','X1002');
expectIds('"Test Manufacturer" AND X1003','X1003');
expectIds('X1001 OR X1004','X1001','AND','all','fuzzy');
expectIds('X1001 OR X1003','X1001,X1003','AND','0');
expectIds('X1001 OR X1003','X1001,X1003','AND','all-columns');
expectIds('M800V AND X1003','X1003','AND','all','fuzzy');
expectIds('M800V AND X1004','','AND','all','fuzzy');
const first=booleanSearch('X1001 OR X1003','AND','all','standard',1,1).find(m=>m.type==='page');
if(first.total!==2 || first.entries[0].values[0]!=='X1001')throw Error('Boolean page 1');
const second=send({type:'page-request',page:2,pageSize:1}).find(m=>m.type==='page');
if(second.entries[0].values[0]!=='X1003')throw Error('Boolean page 2');
for(const query of ['AND X1001','X1001 OR','(X1001 OR X1002','X1001)','"unfinished','()']) {
 if(!booleanSearch(query).some(m=>m.type==='error'))throw Error('Invalid expression accepted: '+query);
 const retained=send({type:'page-request',page:2,pageSize:1}).find(m=>m.type==='page');
 if(retained.total!==2 || retained.entries[0].values[0]!=='X1003')throw Error('Invalid query changed results');
}
console.log('PASS: AND/OR, precedence, parentheses, phrases, column scopes, fuzzy IDs, paging, invalid expressions');


// Reject malformed CSV and retain the last successfully loaded dataset.
function loadText(text) {
  context.FileReaderSync = class { readAsArrayBuffer() { const b=Buffer.from(text); return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength); } };
  return send({type:'load',file:{name:'invalid.csv',size:Buffer.byteLength(text)}});
}
for(const csv of ['NCシリアル番号,機械メーカー\nX1,"unfinished', 'NCシリアル番号,機械メーカー\nX1,"maker"tail', 'NCシリアル番号,\nX1,maker', 'NCシリアル番号,NCシリアル番号\nX1,X2', 'NCシリアル番号,機械メーカー\nX1']) {
  if(!loadText(csv).some(m=>m.type==='error')) throw Error('Invalid CSV accepted');
  if(search('X1001').total!==1) throw Error('Previous dataset lost after failed load');
}
const valid=loadText('NCシリアル番号,機械メーカー\r\nX1,"Maker, Inc.\nLine ""two"""\r\n');
if(!valid.some(m=>m.type==='loaded'&&m.count===1)) throw Error('Quoted multiline CSV failed');
console.log('PASS: malformed CSV, rollback, quoted commas/newlines/quotes');

// Field filters: exact selected values are OR; different columns are AND.
const headers=fs.readFileSync(file,'utf8').split(/\r?\n/)[0].replace(/^\ufeff/,'').split(',');
const fixtureRows=[
 ['QA1','A','East','Maker A','2024/01/01','12'],
 ['QA2','B','East','Maker B','2024-06-30','24'],
 ['QA3','B','West','Maker A','2025/01/01','36'],
 ['QA4','','East','Maker A','',''],
];
const fieldRows=fixtureRows.map(([id,type,service,maker,date,months])=>{const row=Array(33).fill('');for(const [h,v] of Object.entries({'NCシリアル番号':id,'契約タイプ':type,'サービス拠点':service,'機械メーカー':maker,'契約開始日':date,'契約期間（月）':months,'販売会社':'Sales A','輸出国':'JP'}))row[headers.indexOf(h)]=v;return row;});
loadText(headers.join(',')+'\n'+fieldRows.map(r=>r.join(',')).join('\n'));
const f=(name,values=[],extra={})=>({column:headers.indexOf(name),values,...extra});
function filtered(filters,expected,query='',mode='standard'){
 const result=send({type:'search',query,column:'all',mode,filters,sort:'original',page:1,pageSize:20}).find(m=>m.type==='page');
 if(!result||result.entries.map(e=>e.values[0]).join(',')!==expected)throw Error('Field filtering mismatch: '+JSON.stringify(filters));
}
filtered([f('契約タイプ',['A','B'])],'QA1,QA2,QA3');
filtered([f('契約タイプ',['A','B']),f('サービス拠点',['East'])],'QA1,QA2');
filtered([f('契約タイプ',['B']),f('機械メーカー',['Maker A'])],'QA3');
filtered([f('機械メーカー',['Maker'])],''); // Selected values never become partial/fuzzy matches.
filtered([f('契約タイプ',[],{blank:true})],'QA4');
filtered([f('契約タイプ',['A'],{blank:true})],'QA1,QA4');
filtered([f('契約期間（月）',[],{min:'12',max:'24'})],'QA1,QA2');
filtered([f('契約期間（月）',['36'],{min:'12',max:'12',blank:true})],'QA1,QA3,QA4');
filtered([f('契約開始日',[],{min:'2024-01-01',max:'2024-06-30'})],'QA1,QA2');
filtered([f('契約開始日',[],{min:'2025-01-01',blank:true})],'QA3,QA4');
filtered([f('NCシリアル番号',['QA1','QA3'])],'QA1,QA3');
filtered([f('NCシリアル番号',['QA5'])],'','QA5','fuzzy');
filtered([f('サービス拠点',['East'])],'QA2','QA2 OR QA3');
for(const bad of [f('契約期間（月）',[],{min:'24',max:'12'}),f('契約開始日',[],{min:'2024-02-30'}),{column:99,values:['A']}]){
 if(!send({type:'search',query:'',filters:[bad]}).some(m=>m.type==='error'))throw Error('Invalid field filter accepted');
 const retained=send({type:'page-request',page:1,pageSize:20}).find(m=>m.type==='page');
 if(retained.entries[0].values[0]!=='QA2')throw Error('Invalid filter replaced results');
}
const options=send({type:'candidates',column:headers.indexOf('契約タイプ'),query:'',requestId:42}).find(m=>m.type==='candidates');
if(options.distinct!==2||options.blankCount!==1||options.options.find(x=>x.value==='B').count!==2)throw Error('Candidate counts');
const makerOptions=send({type:'candidates',column:headers.indexOf('機械メーカー'),query:'maker b',requestId:43}).find(m=>m.type==='candidates');
if(makerOptions.total!==1||makerOptions.options[0].value!=='Maker B')throw Error('Candidate narrowing');
loadText(headers.join(',')+'\n'+fieldRows[0].join(','));
const refreshed=send({type:'candidates',column:headers.indexOf('契約タイプ'),query:'',requestId:44}).find(m=>m.type==='candidates');
if(refreshed.distinct!==1||refreshed.options[0].count!==1)throw Error('Stale candidates after reload');
console.log('PASS: field OR/AND, exact choices, blank, number/date ranges, ID text, keyword intersection, invalid-filter rollback, candidates and reload');

const multi=fieldRows[0].slice();multi[0]='QA5';multi[headers.indexOf('契約開始日')]='2020/01/01, 2024/05/01';multi[headers.indexOf('契約期間（月）')]='12, 36';
const csvCell=v=>/[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
loadText(headers.join(',')+'\n'+multi.map(csvCell).join(','));
filtered([f('契約開始日',[],{min:'2024-01-01',max:'2024-12-31'}),f('契約期間（月）',[],{min:'36',max:'36'})],'QA5');
filtered([f('契約開始日',[],{min:'2023-01-01',max:'2023-12-31'})],'');
console.log('PASS: multi-valued date/month cells match any value within range');

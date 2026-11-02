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

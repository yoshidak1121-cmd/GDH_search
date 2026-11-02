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

// Official header names with synthetic values only; never include a real export.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const source=html.match(/<script id="worker-source" type="text\/plain">([\s\S]*?)<\/script>/)[1];
const en=require('./english-headers.json'),ja=fs.readFileSync(path.join(__dirname,'synthetic.csv'),'utf8').replace(/^\ufeff/,'').split(/\r?\n/)[0].split(',');
assert.equal(en.length,33);assert.equal(new Set(en).size,33);
let text='',out=[];const ctx={TextDecoder,FileReaderSync:class{readAsArrayBuffer(){const b=Buffer.from(text);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}},postMessage:m=>out.push(JSON.parse(JSON.stringify(m)))};vm.createContext(ctx);vm.runInContext(source,ctx);
const send=data=>{out=[];ctx.onmessage({data});return out;},cell=v=>/[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
const rows=[en.map((_,i)=>i===0?'NC-1':i===3?'SER-1':i===5?'Alpha, Beta':i===21?'Example User':'value-'+i),en.map((_,i)=>i===0?'NC-1':i===3?'SER-2':i===5?'Beta':i===21?'Other User':'value-'+i)];
function load(headers,values=rows){text=[headers,...values].map(r=>r.map(cell).join(',')).join('\n');return send({type:'load',file:{name:'synthetic.csv',size:Buffer.byteLength(text)}});}
function search(filters=[],duplicatesOnly=false){return send({type:'search',filters,duplicatesOnly,sort:'nc',mode:'standard',column:'all',page:1,pageSize:20}).find(m=>m.type==='page');}
for(const heads of [ja,en,en.map((h,i)=>i%2?h:ja[i])]){
 const loaded=load(heads).find(m=>m.type==='loaded');assert(loaded);assert.deepEqual(loaded.headings,ja);assert.equal(loaded.duplicateCount,2);
 assert.deepEqual(search().entries[0].values,rows[0]);
 assert.equal(search([{column:3,queries:['SER-1'],match:'exact'}]).total,1);
 assert.equal(search([{column:5,values:['Alpha']}]).total,1);
 assert.equal(search([],true).total,2);
 const dash=send({type:'dashboard',datasetVersion:loaded.datasetVersion,requestId:1,filters:{},sort:'original',page:1}).find(m=>m.type==='dashboard');assert.equal(dash.total,2);assert.equal(dash.repeated,2);assert.deepEqual(dash.absent,[]);
}
let loaded=load([...en].reverse(),rows.map(r=>[...r].reverse())).find(m=>m.type==='loaded');assert.deepEqual(loaded.headings,[...ja].reverse());assert.equal(search().total,2);
assert(load(['NC Serial No.','NCシリアル番号'],[['A','B']]).some(m=>m.type==='error'&&m.message.includes('重複')));assert.equal(search().total,2);
assert(load(['NC Serial No.','Future Column'],[['ID-1','Unchanged value']]).some(m=>m.type==='loaded'&&m.headings[1]==='Future Column'));
assert(load(['nc serial no.','Future Column'],[['ID-1','value']]).some(m=>m.type==='error')); // Only explicitly defined names are aliases.
console.log('PASS: all 33 official English mappings, Japanese/mixed/reordered headers, untouched values, filters, duplicates, NC sort, dashboard, duplicate-column rollback and unknown columns');

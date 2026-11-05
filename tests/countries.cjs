const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.match(/<script id="worker-source" type="text\/plain">([\s\S]*?)<\/script>/)[1];
const countries=Array.from({length:40},(_,i)=>'AA'+String(i).padStart(2,'0')).concat('US');
const records=countries.concat('US','US','AA01');
const csv=['輸入国,輸出国,機械メーカー',...records.map(c=>[c,c,'Maker '+c].join(','))].join('\n');
let out=[];
class FileReaderSync{readAsArrayBuffer(){const b=Buffer.from(csv);return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);}}
const context={FileReaderSync,TextDecoder,postMessage:m=>out.push(m)};
vm.createContext(context);vm.runInContext(source,context);
function send(data){out=[];context.onmessage({data});assert.equal(out.some(m=>m.type==='error'),false);return out;}
send({type:'load',file:{name:'synthetic-countries.csv',size:Buffer.byteLength(csv)}});
for(const column of [0,1]){
 const candidates=query=>send({type:'candidates',column,query,requestId:1}).find(m=>m.type==='candidates');
 const all=candidates('');assert.equal(all.total,41);assert.ok(all.options.some(o=>o.value==='US'),'US must be available without typing (column '+column+')');assert.equal(all.options.length,41);
 assert.deepEqual(Array.from(all.options.slice(0,3),o=>o.value),['US','AA01','AA00']);assert.equal(all.options[0].count,3);assert.equal(all.options[1].count,2);
 const us=candidates('us');assert.equal(us.options.length,1);assert.equal(us.options[0].value,'US');
 const result=send({type:'search',query:'',column:'all',filters:[{column,values:['US']}],page:1,pageSize:20}).find(m=>m.type==='page');assert.equal(result.total,3);
}
const makers=send({type:'candidates',column:2,query:'',requestId:2}).find(m=>m.type==='candidates');assert.equal(makers.options.length,30);
assert.deepEqual(Array.from(makers.options.slice(0,3),o=>o.value),['Maker US','Maker AA01','Maker AA00']);
console.log('PASS: US visible among 41 import/export countries, case-insensitive suggestions, exact filtering, manufacturer limit retained');

const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),source=html.match(/<script id="worker-source" type="text\/plain">([\s\S]*?)<\/script>/)[1];
let text='',out=[];const ctx={TextDecoder,FileReaderSync:class{readAsArrayBuffer(){const b=Buffer.from(text);return b.buffer.slice(b.byteOffset,b.byteOffset+b.length);}},postMessage:m=>out.push(JSON.parse(JSON.stringify(m)))};vm.createContext(ctx);vm.runInContext(source,ctx);
const send=data=>{out=[];ctx.onmessage({data});return out;};const quote=v=>'"'+v.replace(/"/g,'""')+'"';
assert(send({type:'export-results'}).some(m=>m.type==='error'));
for(const heads of [['NC Serial No.','Machinery Vendor','End user','Custom'],['NCシリアル番号','機械メーカー','エンドユーザー','Custom']]){
 const rows=Array.from({length:45},(_,i)=>['NC-'+String(i).padStart(3,'0'),i<43?'Alpha':'Beta','  Example, "User"\n株式会社  ','']);text=[heads,...rows].map(r=>r.map(quote).join(',')).join('\r\n');
 assert(send({type:'load',file:{name:'synthetic.csv',size:text.length}}).some(m=>m.type==='loaded'));
 let page=send({type:'search',filters:[{column:1,values:['Alpha']}],sort:'nc',page:2,pageSize:20}).find(m=>m.type==='page');assert.equal(page.total,43);assert.equal(page.entries.length,20);
 const result=send({type:'export-results'})[0];assert.equal(result.count,43);assert(result.csv.startsWith('\ufeff'));ctx.exportText=result.csv.slice(1);const parsed=JSON.parse(JSON.stringify(vm.runInContext('parseCSV(exportText)',ctx)));assert.deepEqual(parsed,[heads,...rows.slice(0,43)]);
 text='bad';assert(send({type:'load',file:{name:'broken.csv',size:3}}).some(m=>m.type==='error'));assert.equal(send({type:'export-results'})[0].csv,result.csv);
 page=send({type:'search',query:'NO-MATCH',mode:'standard',column:'all',page:1,pageSize:20}).find(m=>m.type==='page');assert.equal(page.total,0);assert(send({type:'export-results'}).some(m=>m.type==='error'));
}
console.log('PASS: full filtered results beyond page 2, order, original Japanese/English/unknown headers, raw comma/quote/newline/space/empty cells, BOM, failed-load rollback, unloaded/zero-result rejection');

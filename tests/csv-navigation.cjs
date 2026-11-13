'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
(async()=>{
 let listener,removed,now=1000,fail=false;const data={},moves=[];
 const origin='https://global-service.fa-cnc.idc-t.melco.co.jp',path='/cncservice/viewcreator/dataview/list/ZGDS0130vBASE';
 class Clock extends Date{static now(){return now;}}
 const chrome={runtime:{id:'fixture',onMessage:{addListener:fn=>listener=fn}},storage:{session:{get:async key=>({[key]:data[key]}),set:async values=>Object.assign(data,values),remove:async key=>{delete data[key];}}},tabs:{update:async(id,options)=>{if(fail)throw Error();moves.push({id,...options});},onRemoved:{addListener:fn=>removed=fn}}};
 vm.runInNewContext(fs.readFileSync('extension/csv-navigation.js','utf8'),{chrome,URL,Date:Clock,Set});
 const sender=url=>({id:'fixture',frameId:0,tab:{id:1},url:origin+url});
 const call=(message,from=sender('/cncservice/home'))=>new Promise(resolve=>{const result=listener(message,from,resolve);if(result!==true)resolve(undefined);});
 const start=()=>call({type:'GDH_CSV_NAVIGATE',path,language:'en'});
 assert.equal(await call({type:'GDH_CSV_NAVIGATE',path},{...sender('/cncservice/home'),frameId:1}),undefined);
 assert.equal(await call({type:'GDH_CSV_NAVIGATE',path},{...sender('/cncservice/home'),id:'other'}),undefined);
 assert.equal((await call({type:'GDH_CSV_NAVIGATE',path:'https://example.com/'})).ok,false);
 assert.equal((await start()).ok,true);assert.deepEqual(moves,[{id:1,url:origin+path+'?getDataOnInit=false'}]);
 assert.equal((await start()).code,'BUSY');assert.equal(moves.length,1);
 const resume=()=>call({type:'GDH_CSV_NAVIGATION_RESUME',ready:true},sender(path+'?getDataOnInit=false'));
 assert.equal((await resume()).start,true);assert.equal(Object.keys(data).length,0);assert.equal((await resume()).start,false);
 await start();now+=60001;assert.equal((await resume()).code,'EXPIRED');assert.equal(Object.keys(data).length,0);
 await start();assert.equal((await call({type:'GDH_CSV_NAVIGATION_RESUME',ready:true},sender('/cncservice/login'))).code,'FORM_UNAVAILABLE');assert.equal(Object.keys(data).length,0);
 await start();assert.equal((await call({type:'GDH_CSV_NAVIGATION_RESUME',ready:false},sender(path+'?getDataOnInit=false'))).code,'FORM_UNAVAILABLE');
 await start();assert.equal((await call({type:'GDH_CSV_NAVIGATION_RESUME',ready:true},sender(path+'?getDataOnInit=true'))).code,'FORM_UNAVAILABLE');
 fail=true;assert.equal((await start()).code,'NAVIGATION_FAILED');assert.equal(Object.keys(data).length,0);fail=false;
 await start();removed(1);await Promise.resolve();assert.equal(Object.keys(data).length,0);
 assert(!JSON.stringify(data).includes('csrf'));
 console.log('PASS: trusted top-frame sender, allowed source path, per-tab duplicate guard, one-time resume, expiry, wrong page/form, navigation failure and closed-tab cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});

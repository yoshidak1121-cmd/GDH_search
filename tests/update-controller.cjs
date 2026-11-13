'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const id='abcdefghijklmnopabcdefghijklmnop';
function fixture({store={},version='1.20.0',changedDocument=false}={}){
 let listener,port,liveBusy=false;
 const events=[],native=[];
 const url=file=>'chrome-extension://'+id+'/'+file;
 const chrome={runtime:{id,getURL:url,getManifest:()=>({version}),onMessage:{addListener:fn=>listener=fn},reload:()=>events.push(['runtime.reload']),connectNative:name=>{
  assert.equal(name,'com.yoshidak.gdh_search_updater');
  let messageListener,disconnectListener;
  port={onMessage:{addListener:fn=>messageListener=fn},onDisconnect:{addListener:fn=>disconnectListener=fn},postMessage:message=>native.push(message),disconnect(){},reply:message=>messageListener(message),error:()=>{chrome.runtime.lastError={message:'synthetic missing host'};disconnectListener();delete chrome.runtime.lastError;}};return port;
 }},storage:{local:{get:async key=>({[key]:store[key]}),set:async values=>Object.assign(store,values),remove:async key=>{delete store[key];}}},tabs:{query:async()=>[{id:1},{id:2}],create:async options=>{events.push(['create',options.url]);return {id:3};},get:async()=>({url:url('update.html')}),reload:async tabId=>events.push(['tabs.reload',tabId]),update:async(tabId,options)=>events.push(['tabs.update',tabId,options.url])},scripting:{executeScript:async options=>{events.push(['document',options.target]);return [{documentId:changedDocument?'new-document':'original-document'}];}}};
 const context=vm.createContext({chrome,URL,Date,setTimeout,clearTimeout,console,liveBusy});
 vm.runInContext(fs.readFileSync('extension/update-controller.js','utf8'),context);
 const sender={id,url:url('popup.html')};
 const send=(message,from=sender)=>new Promise(resolve=>{const asyncResponse=listener(message,from,resolve);if(!asyncResponse)resolve(undefined);});
 const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
 return {send,events,native,store,flush,port:()=>port};
}
(async()=>{
 const a=fixture();await a.flush();
 assert.equal(await a.send({type:'GDH_UPDATE_START',confirmed:true,version:'1.21.0'},{id,url:'https://global-service.fa-cnc.idc-t.melco.co.jp/cncservice/'}),undefined);
 assert.equal((await a.send({type:'GDH_UPDATE_START',version:'1.21.0'})).code,'INVALID_REQUEST');
 assert.equal((await a.send({type:'GDH_UPDATE_START',confirmed:true,version:'1.20.0'})).code,'UP_TO_DATE');assert.equal(a.native.length,0);
 const start=await a.send({type:'GDH_UPDATE_START',confirmed:true,version:'1.21.0',tabId:1});assert.equal(start.ok,true);assert.equal(a.native.length,1);assert.deepEqual(JSON.parse(JSON.stringify(a.native[0])),{action:'update',version:'1.21.0'});
 a.port().reply({type:'progress',phase:'installing'});assert.equal((await a.send({type:'GDH_UPDATE_STATUS'})).phase,'installing');
 assert.equal((await a.send({type:'GDH_UPDATE_START',confirmed:true,version:'1.21.0',tabId:1})).code,'BUSY');
 a.port().reply({ok:true,version:'1.21.0'});await a.flush();assert.deepEqual(a.events.filter(e=>e[0]==='runtime.reload'),[['runtime.reload']]);assert.equal(a.store.gdhUpdatePending.phase,'reload');
 const reboot=fixture({store:a.store,version:'1.21.0'});await reboot.flush();assert.deepEqual(reboot.events.filter(e=>e[0]==='tabs.reload'),[['tabs.reload',1]]);assert.equal(a.store.gdhUpdatePending,undefined);assert(reboot.events.some(e=>e[0]==='tabs.update'&&e[2].includes('reloaded=1')));
 const missing=fixture();await missing.send({type:'GDH_UPDATE_START',confirmed:true,version:'1.21.0',tabId:1});missing.port().error();await missing.flush();assert.equal((await missing.send({type:'GDH_UPDATE_STATUS'})).phase,'helper-required');assert(!missing.events.some(e=>e[0]==='runtime.reload'));
 const invalid=fixture();await invalid.send({type:'GDH_UPDATE_START',confirmed:true,version:'1.21.0',tabId:1});invalid.port().reply({ok:true,version:'1.22.0'});await invalid.flush();assert.equal((await invalid.send({type:'GDH_UPDATE_STATUS'})).phase,'failed');assert.equal(invalid.store.gdhUpdatePending,undefined);assert(!invalid.events.some(e=>e[0]==='runtime.reload'));
 const moved=fixture({version:'1.21.0',changedDocument:true,store:{gdhUpdatePending:{phase:'reload',version:'1.21.0',createdAt:Date.now(),targets:[{tabId:1,documentId:'original-document'}],targetCount:1,guideTabId:3}}});await moved.flush();assert(!moved.events.some(e=>e[0]==='tabs.reload'));assert.equal((await moved.send({type:'GDH_UPDATE_STATUS'})).skipped,1);
 const expired=fixture({version:'1.21.0',store:{gdhUpdatePending:{phase:'reload',version:'1.21.0',createdAt:Date.now()-400000,targets:[{tabId:1,documentId:'original-document'}],targetCount:1,guideTabId:3}}});await expired.flush();assert(!expired.events.some(e=>e[0]==='tabs.reload'));assert.equal(expired.store.gdhUpdatePending,undefined);
 console.log('PASS: explicit update consent, trusted clients, no downgrade, native message contains version only, duplicate guard, failure handling, extension reload and one-time F5 of original GDH document only');
})().catch(error=>{console.error(error);process.exitCode=1;});

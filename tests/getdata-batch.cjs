'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function harness({hangRead=0,hangProbe=false,delayRead=0}={}){
 let now=0,nextTimer=1,nextId=1,listener,removed,ctx,enabled=true,lateResolve;
 const timers=new Map(),reads=[],cancels=[];
 const setTimer=(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,due:now+ms});return id;};
 const success=config=>[{result:{ok:true,source:'getData-live',sample:[Object.fromEntries(config.keys.map(key=>[key,'SYNTHETIC-PRIVATE-KEY']))],summary:{count:1,fields:[...config.columns],valid:true},keyChecks:[],fieldChecks:[]}}];
 const chrome={runtime:{id:'fixture',getURL:file=>'chrome-extension://fixture/'+file,onMessage:{addListener:fn=>listener=fn}},storage:{local:{get:async()=>({gdhGetDataValidationEnabled:enabled})}},tabs:{query:async()=>[{id:1}],onRemoved:{addListener:fn=>removed=fn}},scripting:{executeScript:options=>{
  if(options.func.name==='cancelGdhRead'){cancels.push(options.args[0]);return Promise.resolve([]);}
  if(options.func.name!=='readGdhContractPage')return hangProbe?new Promise(()=>{}):Promise.resolve([{result:{table:'ZGDDTB_CONTRACT_INFO'}}]);
  const config=options.args[0];reads.push(config);
  if(hangRead===reads.length)return new Promise(resolve=>{lateResolve=()=>resolve(success(config));});
  if(delayRead)return new Promise(resolve=>setTimer(()=>resolve(success(config)),delayRead));
  return Promise.resolve(success(config));
 }}};
 class ClockDate extends Date{static now(){return now;}}
 ctx=vm.createContext({chrome,crypto:{randomUUID:()=>String(nextId++)},Date:ClockDate,setTimeout:setTimer,clearTimeout:id=>timers.delete(id),console,importScripts:(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync('extension/'+file,'utf8'),ctx))});
 vm.runInContext(fs.readFileSync('extension/background.js','utf8'),ctx);
 const flush=async()=>{for(let i=0;i<2000;i++)await Promise.resolve();};
 const send=message=>new Promise(resolve=>{assert.equal(listener(message,{id:'fixture',url:'chrome-extension://fixture/validation.html',tab:{id:77}},resolve),true);});
 const tick=async ms=>{await flush();const until=now+ms;for(;;){let chosen;for(const [id,timer] of timers)if(timer.due<=until&&(!chosen||timer.due<chosen[1].due))chosen=[id,timer];if(!chosen)break;now=chosen[1].due;timers.delete(chosen[0]);chosen[1].fn();await flush();}now=until;await flush();};
 return {send,flush,tick,reads,cancels,removed:id=>removed(id),late:()=>lateResolve?.(),off:()=>{enabled=false;},status:()=>send({type:'GDH_GETDATA_BATCH_STATUS'}),start:()=>send({type:'GDH_GETDATA_BATCH',confirmed:true})};
}
(async()=>{
 const normal=harness();await normal.start();await normal.flush();let state=await normal.status();assert.equal(state.status,'completed',JSON.stringify({reads:normal.reads.length,phase:state.phase,table:state.table}));assert.equal(normal.reads.length,10);assert(!JSON.stringify(state).includes('SYNTHETIC-PRIVATE-KEY'));
 const blocked=harness({hangRead:2});const ack=await blocked.start();assert.equal(ack.ok,true);await blocked.flush();state=await blocked.status();assert.equal(state.status,'running');assert.equal(state.result.tables.length,1);assert.equal(state.table,'ZGDDTB_NC_INFO_RS');
 await blocked.tick(18001);state=await blocked.status();assert.equal(state.status,'timeout');assert.equal(state.reason,'READ_TIMEOUT');assert.equal(state.result.tables.filter(row=>row.ok).length,1);assert.equal(blocked.reads.length,2);assert(blocked.cancels.length>0);
 blocked.late();await blocked.flush();await blocked.tick(60000);assert.equal(blocked.reads.length,2);assert.equal((await blocked.status()).status,'timeout');
 const stop=harness({hangRead:2});const started=await stop.start();await stop.flush();await stop.send({type:'GDH_GETDATA_BATCH_CANCEL',jobId:started.jobId});await stop.flush();state=await stop.status();assert.equal(state.status,'cancelled');assert.equal(state.result.tables.filter(row=>row.ok).length,1);assert.equal(stop.reads.length,2);assert(stop.cancels.length>0);
 const discovery=harness({hangProbe:true});await discovery.start();await discovery.tick(2001);state=await discovery.status();assert.equal(state.status,'completed');assert(state.result.tables.every(row=>row.code==='DISCOVERY_TIMEOUT'));assert.equal(discovery.reads.length,0);
 const overall=harness({delayRead:13000});await overall.start();await overall.tick(61000);state=await overall.status();assert.equal(state.status,'timeout');assert.equal(state.reason,'BATCH_TIMEOUT');assert.equal(overall.reads.length,5);assert.equal(state.result.tables.filter(row=>row.ok).length,4);await overall.tick(30000);assert.equal(overall.reads.length,5);
 const closed=harness({hangRead:2});await closed.start();await closed.flush();closed.removed(77);await closed.flush();assert.equal((await closed.status()).status,'cancelled');assert.equal(closed.reads.length,2);
 const off=harness({hangRead:2});await off.start();await off.flush();off.off();off.late();await off.flush();assert.equal((await off.status()).status,'cancelled');assert.equal(off.reads.length,2);
 console.log('PASS: immediate batch acknowledgement, progress and partial results, frozen injection deadline, late result rejection, stop, frozen discovery, whole-batch deadline, tab close, OFF, zero subsequent requests, metadata only');
})().catch(error=>{console.error(error);process.exitCode=1;});

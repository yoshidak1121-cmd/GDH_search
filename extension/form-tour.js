/* One bounded, allowlisted UI action per invocation. No input, selection, submit or API replay. */
function stepGdhFormTour(command, sessionId, options) {
 'use strict';
 options ??= {};
 const origin='https://global-service.fa-cnc.idc-t.melco.co.jp',key='__gdhFormTourV1';
 if(location.origin!==origin||!location.pathname.startsWith('/cncservice/'))return {ok:false,code:'WRONG_PAGE'};
 const old=window[key];
 if(command==='stop'){if(old?.sessionId===sessionId)old.stop('stopped');return {ok:true};}
 if(command==='step'){
  if(!old||old.sessionId!==sessionId)return {ok:false,code:'SESSION_LOST'};
  if(!Number.isFinite(options.expiresAt)||Date.now()>options.expiresAt){old.stop('expired');return {ok:false,code:'EXPIRED'};}
  return old.step(options.childDone===true,options.childPending===true);
 }
 if(command!=='start'||typeof sessionId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(sessionId))return {ok:false,code:'INVALID_COMMAND'};
 if(old?.active)return {ok:false,code:'ALREADY_RUNNING'};
 const observer=window.__gdhRegistrationObservationV1;
 if(!observer?.active||observer.sessionId!==sessionId)return {ok:false,code:'NO_OBSERVER'};
 const sections=['契約情報','販売情報','出荷情報','設置先情報'];
 const scope=options.scope==='machine'?'machine':sections.includes(options.scope)?options.scope:null;
 if(!scope)return {ok:false,code:'WRONG_SCREEN'};
 const norm=x=>String(x||'').normalize('NFKC').replace(/[\s＊*：:]/g,'');
 const names={machine:['NCシステム型名','工作機械モデル番号','サービスセンター'],契約情報:['契約ID','契約元拠点','契約者'],販売情報:['販売ID','販売会社','機械代理店','機械代理店住所'],出荷情報:['出荷ID','輸出国','輸入国'],設置先情報:['設置ID','エンドユーザー','設置先住所']};
 const visible=e=>e?.isConnected&&e.getClientRects().length&&e.ownerDocument.defaultView.getComputedStyle(e).visibility!=='hidden';
 function docs(){const result=[];function visit(d){if(!d||result.includes(d)||result.length>=16)return;result.push(d);for(const f of d.querySelectorAll('iframe,frame'))if(visible(f))try{if(f.contentWindow.location.origin===origin||['about:blank','about:srcdoc'].includes(f.contentWindow.location.href))visit(f.contentDocument);}catch{}}visit(document);return result;}
 function inside(root,element){for(let e=element;e;){if(root.contains(e))return true;try{e=e.ownerDocument.defaultView.frameElement;}catch{return false;}}return false;}
 const all=(selector,root)=>docs().flatMap(d=>Array.from(d.querySelectorAll(selector))).filter(e=>!root||inside(root,e));
 const exact=(text,root)=>all('h1,h2,h3,div,span,td,legend,a,button',root).filter(e=>visible(e)&&norm(e.textContent)===norm(text)&&!Array.from(e.children).some(c=>norm(c.textContent)===norm(text)));
 function dialogs(){return all('[role="dialog"],.ui-dialog').filter(e=>visible(e)&&!e.parentElement?.closest('[role="dialog"],.ui-dialog'));}
 const value=e=>e.type==='checkbox'||e.type==='radio'?String(e.checked):String(e.value||'');
 function fields(region){
  const report=observer.snapshot(),result=[];
  for(const screen of report.current.screens)for(const field of screen.fields){
   let element;try{element=observer.resolve(screen.screen,field.locator);}catch{continue;}
   if(element&&(region?inside(region,element):!element.closest('[role="dialog"],.ui-dialog')))result.push({field,element});
  }
  return result;
 }
 // Do not act on an already-open dialog or another task's active recorder.
 if(dialogs().length)return {ok:false,code:'CLOSE_DIALOG_FIRST'};
 let active=true,reason='running',waiting=null,actions=0,lastCall=Date.now();
 const started=Date.now(),log=[],guards=new Map(),stack=[];
 function add(kind,label,status){log.push({ms:Date.now()-started,kind,label,status});}
 function stop(why){active=false;reason=why;clearInterval(watchdog);for(const [d,h] of guards){d.removeEventListener('click',h,true);d.removeEventListener('keydown',h,true);d.removeEventListener('input',h,true);d.removeEventListener('submit',blockSubmit,true);}guards.clear();for(const f of stack)f.values.clear();}
 function blockSubmit(event){event.preventDefault();event.stopImmediatePropagation();stop('submit-blocked');}
 function protect(){for(const d of docs())if(!guards.has(d)){const h=e=>{if(e.isTrusted)stop('user-interaction');};guards.set(d,h);for(const type of ['click','keydown','input'])d.addEventListener(type,h,true);d.addEventListener('submit',blockSubmit,true);}}
 function frame(region,label){const own=fields(region);return {region,label,queue:[...names[label].map(name=>({kind:'lookup',label:name})),...(label==='machine'?sections.map(name=>({kind:'form',label:name})):[])],values:new Map(own.map(x=>[x.element,value(x.element)]))};}
 function changed(f){return Array.from(f.values).some(([e,v])=>!e.isConnected||value(e)!==v);}
 function safe(e,kind){
  if(!visible(e)||e.disabled||e.getAttribute('aria-disabled')==='true')return false;
  const button=e.closest('button,input');
  if(button&&(['submit','reset','image'].includes(button.type)||button.disabled))return false;
  const text=norm(e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent||e.value);
  if(/削除|更新|保存|仮採番|決定|選択/.test(text))return false;
  if(/登録/.test(text)&&!(kind==='form'&&text==='新規登録'))return false;
  return true;
 }
 function click(e,kind){if(!safe(e,kind))return false;if(++actions>60){stop('action-limit');return false;}e.click();return true;}
 function lookup(f,label){
  const candidates=fields(f.region).filter(x=>!x.field.hidden&&x.field.label===label&&x.field.type==='text');
  const buttons=[];
  for(const {element} of candidates){
   const cell=element.closest('td')||element.parentElement;
   if(!cell)continue;
   for(const icon of cell.querySelectorAll('img,[class*="icon-search"],[aria-label],[title]')){
    const hint=[icon.getAttribute('aria-label'),icon.getAttribute('title'),icon.getAttribute('alt'),icon.getAttribute('class'),(icon.getAttribute('src')||'').split('/').pop()?.split('?')[0]].filter(Boolean).join(' ');
    if(!/search|lookup|magnif|参照|検索|虫眼鏡/i.test(hint)||/clear|delete|remove|クリア|削除/i.test(hint))continue;
    const target=icon.closest('a,button,[role="button"]')||icon;
    if(cell.contains(target)&&safe(target,'lookup')&&!buttons.includes(target))buttons.push(target);
   }
  }
  return buttons.length===1?buttons[0]:null;
 }
 function openForm(label){
  const heads=exact(label),buttons=all('button,input[type="button"],a,[role="button"]').filter(e=>visible(e)&&norm(e.value||e.textContent)==='新規登録'&&safe(e,'form'));
  if(heads.length!==1)return null;
  for(let p=heads[0].parentElement;p&&p.tagName!=='BODY';p=p.parentElement){
   if(sections.filter(name=>exact(name,p).length).length!==1)break;
   const matches=buttons.filter(b=>p.contains(b));if(matches.length===1)return matches[0];
  }
  // Flat IM-BIS layouts: associate the nearest section heading above each button
  // in the same column; never rely on a fixed coordinate or global button index.
  const headings=sections.flatMap(name=>exact(name).map(e=>({name,r:e.getBoundingClientRect()})));
  const matches=buttons.filter(b=>{const r=b.getBoundingClientRect();const above=headings.filter(h=>h.r.bottom<=r.top+4&&Math.abs(h.r.left-r.left)<100).sort((a,c)=>c.r.bottom-a.r.bottom);return above.length&&above[0].name===label&&(!above[1]||above[0].r.bottom-above[1].r.bottom>10);});
  return matches.length===1?matches[0]:null;
 }
 function closeButton(dialog){const list=all('button,a,[role="button"],.ui-dialog-titlebar-close',dialog).filter(e=>visible(e)&&(e.matches('.ui-dialog-titlebar-close')||['閉じる','Close','close'].includes((e.getAttribute('aria-label')||e.getAttribute('title')||e.textContent).trim()))&&safe(e,'close'));const unique=list.filter(e=>!list.some(p=>p!==e&&p.contains(e)));return unique.length===1?unique[0]:null;}
 function detail(dialog){
  const found=exact('詳細検索',dialog);if(found.length!==1)return null;
  const e=found[0].closest('a,button,[role="button"]')||found[0];
  if(e.getAttribute('aria-expanded')==='true')return null;
  if(e.getAttribute('aria-expanded')==='false')return e;
  // Only expand if a nearby details container has controls that are all hidden.
  for(let p=e.parentElement;p&&p!==dialog;p=p.parentElement){const inputs=all('input:not([type="hidden"]),select,textarea',p);if(inputs.length)return inputs.some(visible)?null:e;}
  return null;
 }
 function response(extra={}){return {ok:true,status:reason,log:log.slice(),actions,...extra};}
 function step(childDone,childPending){
  lastCall=Date.now();if(!active)return response();
  if(Date.now()-started>600000){stop('time-limit');return response();}
  protect();const f=stack.at(-1);
  if(changed(f)){stop('form-changed');return response();}
  if(waiting){
   if(childPending&&waiting.kind==='form'){waiting.at=Date.now();return response();}
   if(waiting.kind==='close'){
    if(visible(waiting.dialog)){if(Date.now()-waiting.at>8000)stop('close-timeout');return response();}
    waiting=null;return response();
   }
   if(waiting.kind==='form'&&childDone){add('form',waiting.label,'collected-window');waiting=null;return response();}
   const open=dialogs().filter(d=>!stack.some(x=>x.region===d));
   if(open.length>1){stop('ambiguous-dialog');return response();}
   if(!open.length){if(Date.now()-waiting.at>8000)stop('open-timeout');return response({awaiting:waiting.kind,label:waiting.label});}
   const dialog=open[0];
   if(waiting.kind==='form'){
    if(!exact(waiting.label,dialog).length||!fields(dialog).some(x=>x.field.label==='NCシリアル番号')){stop('unexpected-dialog');return response();}
    stack.push(frame(dialog,waiting.label));add('form',waiting.label,'opened');waiting=null;return response();
   }
   if(!exact('一覧選択画面',dialog).length){stop('unexpected-dialog');return response();}
   if(!waiting.expanded){waiting.expanded=true;const control=detail(dialog);if(control){if(!click(control,'detail'))stop('detail-unrecognized');waiting.captureAt=Date.now()+1200;return response();}waiting.captureAt=Date.now()+1200;}
   if(Date.now()<waiting.captureAt)return response();
   if(!waiting.sourceCaptured){waiting.sourceCaptured=true;return response({captureSource:true,label:waiting.label});}
   const count=fields(dialog).filter(x=>!x.field.hidden).length;
   add('lookup',waiting.label,count?'collected':'no-recognized-fields');
   const close=closeButton(dialog);if(!close||!click(close,'close')){stop('close-unrecognized');return response();}
   waiting={kind:'close',dialog,at:Date.now()};return response();
  }
  const action=f.queue.shift();
  if(!action){
   if(stack.length>1){const close=closeButton(f.region);if(!close||!click(close,'close')){stop('close-unrecognized');return response();}f.values.clear();stack.pop();waiting={kind:'close',dialog:f.region,at:Date.now()};return response();}
   stop(log.some(x=>x.status==='unrecognized'||x.status==='no-recognized-fields')?'partial':'completed');return response();
  }
  const button=action.kind==='form'?openForm(action.label):lookup(f,action.label);
  if(!button){add(action.kind,action.label,'unrecognized');return response();}
  waiting={...action,at:Date.now()};add(action.kind,action.label,'opening');
  if(!click(button,action.kind)){stop('control-unrecognized');return response();}
  return response({awaiting:action.kind,label:action.label});
 }
 const watchdog=setInterval(()=>{if(Date.now()-lastCall>15000)stop('controller-lost');},1000);
 stack.push(frame(null,scope));protect();
 window[key]={sessionId,get active(){return active;},step,stop};
 return response();
}

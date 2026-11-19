/* MAIN-world reader. Only the supplied table-list -> table_edit view and getData
 * routes are allowed. Downloaded HTML/scripts are parsed, never executed. */
async function inspectGdhTables(command, config) {
 'use strict';
 config ??= {};
 const origin='https://global-service.fa-cnc.idc-t.melco.co.jp',base='/cncservice/',key='__gdhTableTourV1';
 let evidence={};
 const fail=code=>({ok:false,code,...evidence});
 const isList=location.pathname===base+'tablemaintenance/table_list';
 const isAnchor=location.pathname===base+'tablemaintenance/table_edit/ZALS/ZGDDTB_CONTRACT_INFO';
 if(location.origin!==origin||(!isList&&!isAnchor))return fail('WRONG_PAGE');
 const previous=window[key];
 if(command==='stop'){if(previous?.session===config.session){previous.cancelled=true;clearTimeout(previous.timer);previous.xhr?.abort();}return {ok:true};}
 if(command==='open'){
  if(!isList)return fail('WRONG_PAGE');
  const form=document.createElement('form');form.method='POST';form.action=origin+base+'tablemaintenance/table_edit/ZALS/ZGDDTB_CONTRACT_INFO';
  for(const [name,value] of Object.entries({keyword:'',page:'1',rowNum:'50',sortOrder:'asc',sortName:'table_name',fromlist:'true'})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.append(input);}
  document.body.append(form);const pending={session:config.session,cancelled:false,expires:0};window[key]=pending;pending.timer=setTimeout(()=>{if(!pending.cancelled)HTMLFormElement.prototype.submit.call(form);},50);return {ok:true};
 }
 if(command==='start'||command==='start-anchor'){
  if(previous&&!previous.cancelled&&previous.expires>Date.now())return fail('BUSY');
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(config.session||''))return fail('INVALID_REQUEST');
  if(command==='start'){
   if(!isList)return fail('WRONG_PAGE');
   if(document.querySelector('#sources')?.value!=='ZALS')return fail('SELECT_ZALS');
   if(document.querySelector('#keyword')?.value.trim())return fail('CLEAR_FILTER');
  }else{
   if(!isAnchor||document.querySelector('input[name="db_source"]')?.value!=='ZALS'||document.querySelector('input[name="tablename"]')?.value!=='ZGDDTB_CONTRACT_INFO')return fail('WRONG_TABLE');
   if(typeof window.ImJson?.toJSONString!=='function'||typeof window.ImAjax?.setContentTypeAndReqHeaders!=='function'||typeof window.ImJsspRpc?.receive!=='function')return fail('PAGE_NOT_READY');
  }
  const allowed=config.catalog;
  if(!Array.isArray(allowed)||allowed.length!==16||allowed.some(t=>!/^Z[A-Z0-9_]+$/.test(t.table)||!Array.isArray(t.columns)||t.columns.some(c=>!/^[a-z][a-z0-9_]*$/.test(c))))return fail('INVALID_REQUEST');
  const links=Array.from(document.querySelectorAll('#table-list a'));
  const tables=command==='start-anchor'?allowed:allowed.filter(t=>links.some(a=>a.textContent.trim()===t.table&&/^javascript:tableEdit\('\d+',\s*'table-list'\);?$/.test(a.getAttribute('href')||'')));
  if(tables.length!==16)return fail('LIST_MISMATCH');
  window[key]={session:config.session,tables,cancelled:false,expires:Date.now()+600000,done:new Set(),xhr:null};
  return {ok:true,tables:tables.map(t=>t.table)};
 }
 const state=window[key];
 if(!state||state.session!==config.session||state.cancelled)return fail('STOPPED');
 if(command!=='read'||state.expires<Date.now()||!Number.isFinite(config.deadline)||config.deadline<Date.now())return fail('EXPIRED');
 if(state.xhr)return fail('BUSY');
 if(!isAnchor||document.querySelector('input[name="db_source"]')?.value!=='ZALS'||document.querySelector('input[name="tablename"]')?.value!=='ZGDDTB_CONTRACT_INFO')return fail('WRONG_TABLE');
 const table=state.tables.find(t=>t.table===config.table);
 if(!table||state.done.has(table.table))return fail('INVALID_REQUEST');
 state.done.add(table.table);
 const deadline=Math.min(config.deadline,Date.now()+20000);
 function check(){if(state.cancelled)throw Error('STOPPED');if(Date.now()>deadline)throw Error('TIMEOUT');}
 async function request(url,body,rpc){
  check();return new Promise((resolve,reject)=>{
   let xhr=new XMLHttpRequest();state.xhr=xhr;
   const finish=(error,value)=>{state.xhr=null;error?reject(Error(error)):resolve(value);};
   xhr.open('POST',url,true);xhr.timeout=Math.max(1,deadline-Date.now());
   if(rpc)xhr=window.ImAjax.setContentTypeAndReqHeaders(xhr,'application/json; charset=utf-8');
   else xhr.setRequestHeader('Content-Type','application/x-www-form-urlencoded;charset=UTF-8');
   state.xhr=xhr;
   xhr.onerror=()=>finish('NETWORK_ERROR');xhr.onabort=()=>finish('STOPPED');xhr.ontimeout=()=>finish('TIMEOUT');
   xhr.onload=()=>{if(state.cancelled)return finish('STOPPED');if(xhr.status===401||xhr.status===403||xhr.responseURL!==url)return finish('AUTH_REQUIRED');if(xhr.status!==200)return finish('HTTP_ERROR');if(xhr.responseText.length>8000000)return finish('RESPONSE_LIMIT');finish(null,xhr);};
   check();xhr.send(body);
  });
 }
 try{
  const view=origin+base+'tablemaintenance/table_edit/ZALS/'+table.table;
  const html=(await request(view,'keyword=&page=1&rowNum=50&sortOrder=asc&sortName=table_name&fromlist=true',false)).responseText;
  check();
  const doc=new DOMParser().parseFromString(html,'text/html');
  if(doc.querySelector('input[name="db_source"]')?.value!=='ZALS'||doc.querySelector('input[name="tablename"]')?.value!==table.table)return fail('WRONG_TABLE');
  const scripts=Array.from(doc.scripts).map(s=>s.textContent).join('\n');
  const sourceReview=analyzeGdhSource(Array.from(doc.scripts).map(s=>s.textContent),table.columns);
  evidence={sourceReview,table:table.table};
  const fieldsMatch=scripts.match(/var\s+fieldNames\s*=\s*(\[[^;]+\])\s*;/);
  if(!fieldsMatch)return fail('SCHEMA_MISMATCH');
  const fieldNames=JSON.parse(fieldsMatch[1]);
  if(!Array.isArray(fieldNames)||fieldNames.length!==table.columns.length||fieldNames.some(f=>!table.columns.includes(f.replace(/^fieldname__/,''))))return fail('SCHEMA_MISMATCH');
  const columns=fieldNames.map(f=>f.slice('fieldname__'.length));
  if(new Set(columns).size!==columns.length||fieldNames.some(f=>!f.startsWith('fieldname__')))return fail('SCHEMA_MISMATCH');
  evidence.columns=columns;
  const rpcMatch=scripts.match(/server\["getData"\]\s*=\s*function\(\)\{[^\n]*?ImJsspRpc\.sendJsspRpcRequest\("([^"\n]+)"\s*,\s*argsArray\s*,\s*null\s*,\s*null\s*,\s*"post"\s*\)/);
  if(!rpcMatch)return fail('RPC_UNCONFIRMED');
  const url=new URL(rpcMatch[1],view),keys=[...url.searchParams.keys()];
  if(url.origin!==origin||url.pathname!==base+'tablemaintenance(2f)views(2f)table(5f)edit.jssprpc'||url.username||url.password||url.hash||keys.length!==3||new Set(keys).size!==3||!keys.every(k=>['im_mark','im_func','im_from'].includes(k))||!url.searchParams.get('im_mark')||url.searchParams.get('im_func')!=='getData'||url.searchParams.get('im_from')!=='tablemaintenance(2f)views(2f)table(5f)edit')return fail('RPC_UNCONFIRMED');
  if(typeof window.ImJson?.toJSONString!=='function'||typeof window.ImAjax?.setContentTypeAndReqHeaders!=='function'||typeof window.ImJsspRpc?.receive!=='function')return fail('PAGE_NOT_READY');
  const req={db_source:'ZALS',tablename:table.table,keyword:'',rowNum:'50',page:'1',sortOrder:'asc',sortName:'table_name',isphysicalname:undefined,initselected:'',selecteddata:undefined,pagenumber:'1',pageline:'100',order:'',orderbyfield:'',registmodeflg:'false',searches:Object.fromEntries(fieldNames.map(f=>['tm_seach_'+f,'']))};
  for(const name of ['searchtype','searchpattern']){const e=doc.querySelector('input[name="'+name+'"]:checked');if(!e)return fail('SCHEMA_MISMATCH');req[name]=e.value;}
  const xhr=await request(url.href,window.ImJson.toJSONString([req]),true);check();
  const normalized=xhr.responseText.replace(/"(?:[^"\\]|\\.)*"|\bundefined\b/g,t=>t==='undefined'?'null':t);
  const envelope=JSON.parse(normalized);if(!envelope||typeof envelope!=='object'||Array.isArray(envelope))return fail('INVALID_RESPONSE');
  const response=window.ImJsspRpc.receive(xhr);
  if(response?.error!==false||!Array.isArray(response.data)||response.data.length>100||response.data.some(r=>!r||typeof r!=='object'||Array.isArray(r)))return fail('INVALID_RESPONSE');
  const rows=response.data,missing=columns.filter(c=>rows.some(r=>!Object.hasOwn(r,c))),extra=rows.some(r=>Object.keys(r).some(c=>!columns.includes(c)));
  const stats=columns.map(column=>{const out={column,missing:0,blank:0,string:0,number:0,boolean:0,other:0,maxStringLength:0};for(const r of rows){if(!Object.hasOwn(r,column)){out.missing++;continue;}const v=r[column];if(v==null||v===''){out.blank++;continue;}const type=typeof v;if(['string','number','boolean'].includes(type))out[type]++;else out.other++;if(type==='string')out.maxStringLength=Math.max(out.maxStringLength,v.length);}return out;});
  return {ok:true,sourceReview,table:table.table,count:rows.length,columns,stats,missingColumns:missing,unexpectedColumns:extra,schemaMatches:!missing.length&&!extra,source:{view:'table_edit',read:'getData'},limitations:['先頭100件のみ。実値は出力しません。','JavaScriptの値の型であり、DB型・主キー・NULL制約の確定ではありません。']};
 }catch(error){return fail(['STOPPED','TIMEOUT','AUTH_REQUIRED','HTTP_ERROR','NETWORK_ERROR','RESPONSE_LIMIT'].includes(error.message)?error.message:'INVALID_RESPONSE');}
 finally{state.xhr=null;}
}

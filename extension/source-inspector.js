/* Static inspection only. Never eval/import/call the inspected page's code.
 * Literal values and comments are removed before snippets leave page memory. */
function analyzeGdhSource(sources, fields) {
 'use strict';
 const allowed=new Set((fields||[]).filter(x=>/^[A-Za-z_][A-Za-z0-9_]{0,79}$/.test(x)&&!/token|password|cookie|im_mark|secret/i.test(x)));
 const requestKeys=['db_source','tablename','keyword','rowNum','page','sortOrder','sortName','isphysicalname','initselected','searchtype','searchpattern','selecteddata','pagenumber','pageline','order','orderbyfield','registmodeflg','searches','olddata','newdata'];
 requestKeys.forEach(x=>allowed.add(x));
 function scrub(raw){
  let out='',i=0;
  while(i<raw.length){
   const c=raw[i],n=raw[i+1];
   if(c==='/'&&n==='/'){while(i<raw.length&&raw[i]!=='\n')i++;out+='\n';continue;}
   if(c==='/'&&n==='*'){const end=raw.indexOf('*/',i+2);if(end<0)throw Error();out+=' ';i=end+2;continue;}
   if(c==='`')throw Error('UNSUPPORTED_TEMPLATE');
   if(c==='"'||c==="'"){
    const quote=c;let value='',escaped=false;i++;let closed=false;
    while(i<raw.length){const ch=raw[i++];if(ch==='\\'){escaped=true;i++;continue;}if(ch===quote){closed=true;break;}value+=ch;}
    if(!closed)throw Error();
    out+=JSON.stringify(!escaped&&allowed.has(value)?value:'[literal]');continue;
   }
   // Regex literals are not parsed by this small scanner: do not export a source
   // containing them or ambiguous division. Metadata remains available.
   if(c==='/')throw Error('UNSUPPORTED_SLASH');
   if(/[0-9]/.test(c)&&!/[\w$]/.test(raw[i-1]||'')){while(i<raw.length&&/[\w.+-]/.test(raw[i]))i++;out+='0';continue;}
   out+=c;i++;
  }
  return out;
 }
 const functions=[],seen=new Set();let skipped=0,truncated=false,total=0;
 for(const original of sources.slice(0,80)){
  if(original.length>1000000){skipped++;continue;}
  // Extract each named routine separately so an unrelated library regex does
  // not discard all application routines. Scanner handles strings/comments.
  const pattern=/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]{0,400})\)\s*\{/g;let m;
  while((m=pattern.exec(original))){
   const name=m[1];if(!/save|submit|regist|update|insert|create|number|serial|sequence|allocate|remove|request|edit|select/i.test(name))continue;
   if(functions.length>=30){truncated=true;break;}
   let i=pattern.lastIndex,depth=1,quote=null,line=false,block=false;
   for(;i<original.length&&depth;i++){const c=original[i],n=original[i+1];if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;i++;}continue;}if(quote){if(c==='\\')i++;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='/'&&n==='/'){line=true;i++;continue;}if(c==='/'&&n==='*'){block=true;i++;continue;}if(c==='{')depth++;if(c==='}')depth--;}
   if(depth||i-m.index>16000){skipped++;continue;}
   let code;try{code=scrub(original.slice(m.index,i));}catch{skipped++;continue;}
   if(seen.has(code))continue;seen.add(code);if(total+code.length>60000){truncated=true;continue;}total+=code.length;
   const calls=[...code.matchAll(/\bserver\.([A-Za-z_$][\w$]*)\s*\(([^;{}]{0,500})\)/g)].map(x=>({method:x[1],arguments:x[2]}));
   const keys=[...new Set([...code.matchAll(/\b(?:req|request|params|data)\.([A-Za-z_$][\w$]*)\s*=/g)].map(x=>x[1]))].filter(x=>!/token|password|cookie|secret|im_mark/i.test(x));
   functions.push({name,parameters:m[2].split(',').map(x=>x.trim()).filter(x=>/^[A-Za-z_$][\w$]*$/.test(x)),code,calls,assignedRequestKeys:keys});
  }
 }
 const calls=functions.flatMap(f=>f.calls);
 return {method:'static-source-review',functions,skippedSourcesOrFunctions:skipped,truncated,transmission:{observedCalls:calls,status:calls.length?'client-code-found':'unconfirmed'},numbering:{status:'unconfirmed',candidates:functions.filter(f=>/number|serial|sequence|allocate/i.test(f.name)).map(f=>f.name),note:'候補関数が存在しても採番方式・一意性は未確定。処理は実行していません。'},updateIdentity:{status:'unconfirmed',oldDataArgumentObserved:calls.some(c=>/\bolddata\b/.test(c.arguments)),note:'更新前データの送信と主キー・WHERE条件の確定は別です。'},limitations:['文字列・数値リテラルとコメントを除いた検討用ソースです。実行用ではありません。','関数名による候補抽出です。匿名関数・動的生成・未対応構文・サーバー側処理は網羅しません。','実際の送信内容・採番・更新条件・保存成功は未検証です。']};
}
async function inspectGdhSource() {
 'use strict';
 if(location.origin!=='https://global-service.fa-cnc.idc-t.melco.co.jp'||!location.pathname.startsWith('/cncservice/'))return {ok:false,code:'WRONG_PAGE'};
 const docs=[document];for(let i=0;i<docs.length&&i<16;i++)for(const frame of docs[i].querySelectorAll('iframe'))try{if(frame.contentDocument&&frame.contentWindow.location.origin===location.origin&&!docs.includes(frame.contentDocument))docs.push(frame.contentDocument);}catch{}
 const sources=[],fields=[];let external=0;
 for(const doc of docs.slice(0,16)){for(const s of doc.scripts){if(s.src)external++;else sources.push(s.textContent);}for(const e of doc.querySelectorAll('input[name],select[name],textarea[name]'))fields.push(e.name);}
 return {ok:true,report:{...analyzeGdhSource(sources,fields),externalScriptsNotRead:external,scope:'inline-browser-code',notes:['外部スクリプトの取得・サーバー処理の呼び出しは行っていません。']}};
}

/* Self-contained, injected into the selected GDH tab's ISOLATED world.
 * Observes DOM only: never clicks, changes inputs, submits, or calls GDH APIs.
 * Input values remain in temporary comparison memory and never enter reports. */
function observeGdhRegistration(command, sessionId) {
 'use strict';
 const origin='https://global-service.fa-cnc.idc-t.melco.co.jp';
 const key='__gdhRegistrationObservationV1';
 if(location.origin!==origin||!location.pathname.startsWith('/cncservice/'))return {ok:false,code:'WRONG_PAGE'};
 const prior=window[key];
 if(command!=='start'){
  if(!prior||prior.sessionId!==sessionId)return {ok:false,code:'SESSION_LOST'};
  if(command==='stop'){prior.snapshot();prior.stop('stopped');}
  else if(command!=='snapshot')return {ok:false,code:'INVALID_COMMAND'};
  return {ok:true,report:prior.snapshot()};
 }
 if(prior?.active)return {ok:false,code:'ALREADY_RUNNING'};
 if(typeof sessionId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(sessionId))return {ok:false,code:'INVALID_SESSION'};
 const normalize=value=>String(value||'').normalize('NFKC').replace(/[\s＊*：:]/g,'');
 const labels=['NCシリアル番号','NCシステム型名','工作機械モデル番号','NC構成品番号','NC納入仕様書番号','販売会社','サービスセンター','機械メモ','工作機械ID','工作機械シリアル番号','機械メーカー','機械メーカーID','NCシリーズ名','機種名','制御ユニット','表示ユニット','NCモデルID','サービスセンター名','国コード','契約ID','契約番号','契約タイプ','契約期間','契約期間（月）','契約開始日','契約終了日','契約元拠点','契約者','契約メモ','販売ID','販売日','機械代理店','機械代理店住所','販売メモ','出荷ID','輸出国','輸入国','機械出荷日','出荷メモ','設置ID','設置日','エンドユーザー','設置先住所','エンドユーザーメモ'];
 const known=new Map(labels.map(label=>[normalize(label),label]));
 const canonical=text=>known.get(normalize(text))||null;
 const actions=new Set(['検索','クリア','登録','更新','削除','新規登録','仮採番','戻る','閉じる','キャンセル','取消','取り消し','決定','選択','詳細検索']);
 const operators=new Set(['を含む','と一致する','から始まる','で終わる']);
 const internalKeys=['nc_serial_no','nc_model_id','machinery_tool_id','machinery_vendor_id','customer_id','service_location_code','sales_company_location_code','customer_address_id','installation_address_id','machinery_dealer_address_id','contractor_id','enduser_id'];
 const secret=/password|passwd|token|csrf|xsrf|im_mark|auth|session|credential|cookie|saml|assertion|secret|nonce|api.?key/i;
 const started=Date.now(),duration=10*60*1000;
 const maxFields=250,maxDocuments=16,maxEvents=200,maxTransitions=100,maxSchemas=80;
 let active=true,reason='recording',revision=0,docSequence=0,fieldSequence=0,actionSequence=0,timer=null,lastAction=null;
 let current=[],lastValues=new Map();
 const schemas=[],events=[],transitions=[],documents=new Map(),docIds=new WeakMap(),fieldIds=new Map(),schemaKeys=new Set();
 const limits={fields:false,documents:false,events:false,transitions:false,schemas:false};
 const registrationText=normalize(collectDocuments().list.map(doc=>doc.title+' '+Array.from(doc.querySelectorAll('h1,h2,h3')).map(e=>e.textContent).join(' ')+' '+(doc.body?.innerText||'').slice(0,5000)).join(' '));
 if(!/機械情報登録[\/／]?更新/.test(registrationText))return {ok:false,code:'WRONG_SCREEN'};
 function visible(element){
  if(!element.isConnected||!element.getClientRects().length)return false;
  const style=element.ownerDocument.defaultView.getComputedStyle(element);
  return style.visibility!=='hidden'&&style.display!=='none';
 }
 function fieldLabel(element){
  for(const label of Array.from(element.labels||[])){const name=canonical(label.textContent);if(name)return name;}
  const aria=canonical(element.getAttribute('aria-label'));if(aria)return aria;
  const ids=(element.getAttribute('aria-labelledby')||'').split(/\s+/);
  for(const id of ids){const name=canonical(element.ownerDocument.getElementById(id)?.textContent);if(name)return name;}
  // The label is often the preceding table cell in an IM-BIS form.
  let node=element;
  for(let depth=0;node&&depth<5;depth++,node=node.parentElement){
   let previous=node.previousElementSibling;
   for(let count=0;previous&&count<3;count++,previous=previous.previousElementSibling){
    const name=canonical(previous.textContent);if(name)return name;
    if(previous.querySelector('input,select,textarea')&&element.tagName!=='SELECT')break;
   }
   if(node.tagName==='TR')break;
  }
  return null;
 }
 function structuralPath(element){
  const parts=[];let depth=0;
  while(element&&element.nodeType===1&&depth++<18){
   const rawTag=element.tagName.toLowerCase(),tag=/^(html|body|div|main|section|form|table|thead|tbody|tfoot|tr|td|th|span|p|ul|li|dl|dt|dd|fieldset|legend|input|select|textarea|label|aside|article)$/.test(rawTag)?rawTag:'*';let index=1;
   for(let p=element.previousElementSibling;p;p=p.previousElementSibling)index++;
   parts.unshift(tag+':nth-child('+index+')');element=element.parentElement;
  }
  return parts.join(' > ');
 }
 function push(list,item,limit,limitName){
  if(list.length>=limit){if(!limits[limitName])revision++;limits[limitName]=true;return;}
  list.push(item);revision++;
 }
 function listen(doc,id){
  const handler=event=>{
   if(!active)return;
   const target=event.target?.closest?.('button,a,input,select,textarea,img,[role="button"],td,th');
   if(!target)return;
   const isSecret=target.type==='password'||secret.test((target.name||'')+' '+(target.id||''));
   if(isSecret)return;
   const label=fieldLabel(target),raw=normalize(target.tagName==='INPUT'?target.type==='button'||target.type==='submit'?target.value:'':target.textContent);
   const action=actions.has(raw)?raw:target.closest('tbody tr')&&!label?'候補行の操作':label?'項目の操作':'その他の操作';
   const item={sequence:++actionSequence,ms:Date.now()-started,screen:id,event:event.type,action,field:label};
   lastAction=item;push(events,item,maxEvents,'events');
  };
  doc.addEventListener('click',handler,true);doc.addEventListener('change',handler,true);
  documents.set(doc,{id,handler});
 }
 function collectDocuments(){
  const list=[],seen=new Set();let inaccessible=0;
  function visit(doc){
   if(!doc||seen.has(doc))return;
   if(list.length>=maxDocuments){limits.documents=true;return;}
   seen.add(doc);list.push(doc);
   for(const frame of Array.from(doc.querySelectorAll('iframe,frame')).slice(0,maxDocuments)){
    if(!visible(frame))continue;
    try{const url=frame.contentWindow.location;if(frame.contentDocument&&(url.origin===origin||url.href==='about:blank'||url.href==='about:srcdoc'))visit(frame.contentDocument);else inaccessible++;}catch{inaccessible++;}
   }
  }
  visit(document);
  for(const [doc,entry] of documents)if(!seen.has(doc)){doc.removeEventListener('click',entry.handler,true);doc.removeEventListener('change',entry.handler,true);documents.delete(doc);}
  return {list,inaccessible};
 }
 function scan(){
  if(!active)return;
  if(Date.now()-started>=duration){stop('time-limit');return;}
  const {list,inaccessible}=collectDocuments(),nextValues=new Map(),screens=[];
  let count=0;
  for(const doc of list){
   let id=docIds.get(doc);if(!id){id='screen-'+(++docSequence);docIds.set(doc,id);}
   if(!documents.has(doc))listen(doc,id);
   const fields=[];
   for(const element of Array.from(doc.querySelectorAll('input,select,textarea')).slice(0,1000)){
    if(count>=maxFields){limits.fields=true;break;}
    if(['password','file','submit','button','reset','image'].includes(element.type)||secret.test((element.name||'')+' '+(element.id||'')))continue;
    const hidden=element.type==='hidden',nameText=(element.name||'')+' '+(element.id||'');
    const internal=hidden?internalKeys.find(name=>new RegExp('(?:^|[^a-zA-Z0-9])'+name+'(?:$|[^a-zA-Z0-9])').test(nameText)):null;
    if(hidden&&!internal||!hidden&&!visible(element))continue;
    const label=hidden?'内部項目（候補）：'+internal:fieldLabel(element);
    if(!label)continue;
    count++;
    const path=structuralPath(element),identity=id+'|'+path+'|'+label;
    if(!fieldIds.has(identity)){if(fieldIds.size>=1000){limits.fields=true;continue;}fieldIds.set(identity,'field-'+(++fieldSequence));}
    const fieldId=fieldIds.get(identity),value=element.type==='checkbox'||element.type==='radio'?String(element.checked):String(element.value||'');
    const filled=element.type==='checkbox'||element.type==='radio'?element.checked:value!=='';
    const field={id:fieldId,label,locator:path,type:element.tagName==='SELECT'?'select':element.tagName==='TEXTAREA'?'textarea':element.type||'text',hidden,required:!!element.required,disabled:!!element.disabled,readOnly:!!element.readOnly,filled};
    if(element.maxLength>=0)field.maxLength=element.maxLength;
    if(element.tagName==='SELECT'){
     field.optionCount=element.options.length;
     field.searchOperators=Array.from(element.options).map(o=>o.textContent.trim()).filter(text=>operators.has(text));
    }
    fields.push(field);nextValues.set(identity,{value,filled,id:fieldId,label,screen:id});
    const before=lastValues.get(identity);
    if(before&&before.value!==value){
     const after=lastAction&&Date.now()-started-lastAction.ms<=10000?lastAction.sequence:null;
     push(transitions,{ms:Date.now()-started,screen:id,field:fieldId,label,change:before.filled&&!filled?'cleared':!before.filled&&filled?'filled':'changed',afterAction:after},maxTransitions,'transitions');
    }
   }
   const signature=JSON.stringify(fields.map(({filled,...field})=>field));
   const schemaKey=id+'|'+signature;
   if(fields.length&&!schemaKeys.has(schemaKey)&&schemas.length<maxSchemas){schemaKeys.add(schemaKey);push(schemas,{screen:id,ms:Date.now()-started,fields:fields.map(({filled,...field})=>field)},maxSchemas,'schemas');}
   else if(fields.length&&!schemaKeys.has(schemaKey))limits.schemas=true;
   screens.push({screen:id,fields});
  }
  const next={screens,inaccessibleFrames:inaccessible};
  if(JSON.stringify(next)!==JSON.stringify(current)){current=next;revision++;}
  lastValues.clear();lastValues=nextValues;
 }
 function snapshot(){
  scan();
  return {format:'gdh-registration-observation-v1',sessionId,status:reason,revision,elapsedMs:Date.now()-started,limits:{...limits},current:JSON.parse(JSON.stringify(current)),schemas:JSON.parse(JSON.stringify(schemas)),events:JSON.parse(JSON.stringify(events)),transitions:JSON.parse(JSON.stringify(transitions)),notes:['入力値・選択肢の実値・ID実値・URL・認証情報は記録しません。','操作と変化の時系列であり、原因や保存成功を断定しません。','プログラムはクリック・入力・送信・GDH API呼び出しを行いません。']};
 }
 function stop(why){
  if(!active)return;
  active=false;reason=why;revision++;clearInterval(timer);
  for(const [doc,entry] of documents){doc.removeEventListener('click',entry.handler,true);doc.removeEventListener('change',entry.handler,true);}
  documents.clear();lastValues.clear();
 }
 window[key]={sessionId,get active(){return active;},snapshot,stop};
 scan();timer=setInterval(scan,250);
 return {ok:true,report:snapshot()};
}

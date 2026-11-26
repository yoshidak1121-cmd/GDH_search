/* Small bounded messages carry CSV chunks only inside this installed extension. */
'use strict';
{
 const tr=(ja,en)=>document.documentElement.lang==='en'?en:ja;
 const send=message=>chrome.runtime.sendMessage(message);
 const failure=result=>Error(result?.error||tr('元のGDH画面との接続を確認してください。GDH画面を開き直し、拡張ツールのボタンから起動してください。','Check the original GDH tab. Reopen GDH and launch the tools from its button.')+' ('+(result?.code||'SOURCE_UNAVAILABLE')+')');
 let busy=false;
 window.GDH_CSV_EXPORT_ADAPTER=async()=>{
  if(busy)throw Error(tr('CSV取得中です。','CSV retrieval is in progress.'));
  if(!window.confirm(tr('CSVファイルを出力します。よろしいですか？','Export a CSV file?')))throw Error(tr('CSV出力を取り消しました。','CSV export cancelled.'));
  busy=true;let started=false;
  try{
   const start=await send({type:'GDH_VIEWER_EXPORT_START',confirmed:true,language:document.documentElement.lang});
   if(!start?.ok)throw failure(start);started=true;
   const deadline=Date.now()+180000;let status;
   do{
    if(Date.now()>deadline)throw Error(tr('GDHとの接続がタイムアウトしました。','GDH connection timed out.'));
    status=await send({type:'GDH_VIEWER_EXPORT_STATUS'});if(!status?.ok)throw failure(status);
    if(status.status==='error')throw failure(status);
    if(status.status!=='ready')await new Promise(resolve=>setTimeout(resolve,250));
   }while(status.status!=='ready');
   if(!Number.isSafeInteger(status.size)||status.size<=0)throw Error('INVALID_CSV_SIZE');
   const chunks=[];let offset=0;
   while(offset<status.size){
    if(Date.now()>deadline)throw Error('CSV_TRANSFER_TIMEOUT');
    const chunk=await send({type:'GDH_VIEWER_EXPORT_CHUNK',offset});if(!chunk?.ok)throw failure(chunk);
    if(typeof chunk.data!=='string'||chunk.data.length>710000)throw Error('INVALID_CHUNK');
    const binary=atob(chunk.data),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
    if(!bytes.length||chunk.nextOffset!==offset+bytes.length||chunk.nextOffset>status.size)throw Error('INVALID_CHUNK');
    chunks.push(bytes);offset=chunk.nextOffset;
   }
   return {blob:new Blob(chunks,{type:'text/csv'}),fileName:status.fileName||'GDH_machine_export.csv'};
  }finally{if(started)await send({type:'GDH_VIEWER_EXPORT_END'}).catch(()=>{});busy=false;}
 };
}

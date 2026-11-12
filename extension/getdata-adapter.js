/* Mock-only getData boundary. No URL, credentials or network transport. */
(function(root){
 'use strict';
 const columns=Object.freeze(['contract_id','contract_no','contract_type','contract_period','contract_start_date','contract_end_date','contract_from_location_code','contractor_id','contract_notes','nc_serial_no','del_flg','ins_user_id','upd_user_id','ins_date','ins_id','ins_pgmid','upd_date','upd_id','upd_pgmid']);
 function fail(code){const error=new Error(code);error.code=code;return error;}
 function create({isEnabled,timeoutMs=5000}={}){
  if(typeof isEnabled!=='function'||!Number.isFinite(timeoutMs)||timeoutMs<=0)throw fail('INVALID_OPTIONS');
  let busy=false;
  return async function({source='mock',scenario='success',pagenumber=1}={}){
   if(busy)throw fail('BUSY');
   busy=true;let timer;
   try{
    if(!await isEnabled())throw fail('MODE_OFF');
    if(source!=='mock')throw fail('PRODUCTION_DISABLED');
    if(!Number.isSafeInteger(pagenumber)||pagenumber<1)throw fail('INVALID_PAGE');
    const request={db_source:'ZALS',tablename:'ZGDDTB_CONTRACT_INFO',pagenumber,pageline:100};
    const operation=async()=>{
     // Only synthetic fixtures; never evaluate non-JSON RPC text.
     let status=200,body;
     switch(scenario){
      case 'success':body=JSON.stringify({error:false,data:Array.from({length:100},()=>Object.fromEntries(columns.map(c=>[c,null])))});break;
      case 'empty':body='{"error":false,"data":[]}';break;
      case 'http-error':status=500;break;
      case 'auth-error':status=401;break;
      case 'forbidden':status=403;break;
      case 'error':body='{"error":true,"data":[]}';break;
      case 'invalid-json':body='{"data":undefined}';break;
      case 'invalid-data':body='{"error":false,"data":{}}';break;
      case 'timeout':return new Promise(()=>{});
      default:throw fail('INVALID_SCENARIO');
     }
     if(status===401||status===403)throw fail('AUTH_REQUIRED');
     if(status!==200)throw fail('HTTP_ERROR');
     let response;try{response=JSON.parse(body);}catch{throw fail('INVALID_JSON');}
     if(!response||typeof response!=='object'||response.error!==false||!Array.isArray(response.data))throw fail('INVALID_RESPONSE');
     const data=response.data;
     if(data.length>request.pageline||data.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw fail('INVALID_DATA');
     const fields=[...new Set(data.flatMap(row=>Object.keys(row)))];
     const missingColumns=data.length?columns.filter(c=>data.some(row=>!Object.hasOwn(row,c))):[];
     const unexpectedColumns=fields.filter(c=>!columns.includes(c));
     return {source:'getData-mock',request,data,summary:{count:data.length,fields,missingColumns,unexpectedColumns,valid:!missingColumns.length&&!unexpectedColumns.length}};
    };
    const result=await Promise.race([operation(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('TIMEOUT')),timeoutMs);})]);
    if(!await isEnabled())throw fail('MODE_OFF');
    return result;
   }finally{clearTimeout(timer);busy=false;}
  };
 }
 root.GdhGetData=Object.freeze({create});
})(globalThis);

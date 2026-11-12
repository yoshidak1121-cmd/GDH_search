/* Available only in the popup extension context, never via host-page messages. */
(function(){
 'use strict';
 const key='gdhGetDataValidationEnabled';
 const enabled=async()=> (await chrome.storage.local.get(key))[key]===true;
 const run=GdhGetData.create({isEnabled:enabled});
 globalThis.GDH_GETDATA_VALIDATION=Object.freeze({
  enabled,
  async setEnabled(value){
   if(typeof value!=='boolean')throw new TypeError('Expected boolean');
   await chrome.storage.local.set({[key]:value});
   return value;
  },
  async run(options){
   const result=await run(options);
   console.table(result.summary); // Metadata only; never print records.
   return result;
  }
 });
})();

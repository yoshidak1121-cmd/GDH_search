/* Navigate to the machine search URL explicitly selected by the user. */
(function(){
 'use strict';
 window.GDH_CSV_SEARCH_PATH='/cncservice/viewcreator/dataview/list/ZGDS0130vBASE';
 window.createGdhHomeCsvExportAdapter=function({language=()=>'ja'}){
  let busy=false;
  return async function(){
   if(busy)throw Error('CSV取得を実行中です。');
   busy=true;
   try{
    const result=await chrome.runtime.sendMessage({type:'GDH_CSV_NAVIGATE',language:language()});
    if(!result?.ok)throw Error('機械情報検索画面への移動を開始できませんでした。再度お試しください。');
    return {navigating:true};
   }finally{busy=false;}
  };
 };
})();

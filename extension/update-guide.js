'use strict';
{
 const edge=/\bEdg\//.test(navigator.userAgent)||navigator.userAgentData?.brands?.some(item=>item.brand==='Microsoft Edge');
 const browser=edge?'Edge':'Chrome',english=new URLSearchParams(location.search).get('lang')==='en';
 const tr=(ja,en)=>english?en:ja;
 const $=id=>document.getElementById(id);
 $('browserBadge').textContent=browser;
 if(english){
  document.documentElement.lang='en';document.title='GDH Update';document.querySelector('h1').textContent='Update GDH Search';
  const steps=['Download and verify the latest release','Replace the application folder and remove obsolete application files','Automatically reload the extension and the original GDH page'];
  [...$('automaticSteps').children].forEach((element,index)=>element.textContent=steps[index]);
  $('helperSetup').querySelector('h2').textContent='One-time setup';
  $('helperSetup').querySelector('p').textContent='Register the Windows update helper once. Future updates need only Yes. No desktop files are created.';
  const items=$('helperSetup').querySelectorAll('li'),download=items[0].querySelector('a');download.textContent='Download the latest Setup ZIP';items[0].replaceChildren(download,document.createTextNode(' and extract all files.'));items[1].textContent='Run Install.bat.';
  $('openManager').textContent='Open extension management';$('testHelper').textContent='Test helper connection';$('browserHelp').textContent='Official browser setup instructions';
  document.querySelector('main>p:last-child').textContent='CSV features remain available. No GDH records or credentials are sent to GitHub or the update helper.';
 }

 $('browserHelp').href=edge?'https://support.microsoft.com/ja-jp/edge/add-turn-off-or-remove-extensions-in-microsoft-edge':'https://support.google.com/chrome_webstore/answer/2664769?hl=ja';
 $('registrationStep').textContent=english?(browser+': keep Developer mode enabled and reload this extension. For a first installation, choose Load unpacked.'):edge?'Edgeの「開発者モード」をオンにし、本ツールの ↻ を押します。初回は「展開して読み込み」です。':'Chromeの「デベロッパーモード」をオンにし、本ツールの ↻ を押します。初回は「パッケージ化されていない拡張機能を読み込む」です。';
 $('openManager').addEventListener('click',()=>chrome.runtime.sendMessage({type:'GDH_UPDATE_MANAGER',browser}));
 $('testHelper').addEventListener('click',async()=>{
  $('testHelper').disabled=true;
  try{const result=await chrome.runtime.sendMessage({type:'GDH_UPDATE_PING'});$('helperStatus').textContent=result?.ok?tr('接続できました。次回から自動更新できます。','Connected. Future updates can run automatically.'):tr('まだ接続できません。Install.batと本ツールの再読み込みを確認してください。','Not connected. Run Install.bat and reload this extension.');}
  catch{$('helperStatus').textContent=tr('拡張機能を再読み込みし、この画面を開き直してください。','Reload the extension and reopen this page.');}
  finally{$('testHelper').disabled=false;}
 });
 async function poll(){
  const params=new URLSearchParams(location.search);
  if(params.get('done')==='1'){$('updateStatus').textContent=english?(Number(params.get('reloaded'))>0?'Update complete. The original GDH page has reloaded.':Number(params.get('skipped'))>0?'Update complete. The original page changed or could not be confirmed; reload GDH manually if needed.':'Update complete. No GDH page was selected for reloading.'):Number(params.get('reloaded'))>0?'更新完了。起動元のGDH画面も再読み込みしました。':Number(params.get('skipped'))>0?'更新完了。起動元の状態を確認できなかったため、必要ならGDH画面を再読み込みしてください。':'更新完了。再読み込み対象のGDH画面はありませんでした。';return;}
  try{
   const state=await chrome.runtime.sendMessage({type:'GDH_UPDATE_STATUS'});
   const phases={preparing:'更新の準備中です…',installing:'最新版を取得・確認して入れ替えています…',reloading:'更新完了。拡張機能とGDH画面を再読み込みしています…',done:'更新が完了しました。',idle:'初回設定または更新手順を確認できます。','helper-required':'Windows更新ヘルパーの初回設定が必要です。',failed:'自動更新を完了できませんでした。下の手順で更新できます。'};
   const englishPhases={preparing:'Preparing the update…',installing:'Downloading, verifying and replacing files…',reloading:'Reloading the extension and GDH page…',done:'Update complete.',idle:'Review setup and update instructions.',
    'helper-required':'The Windows update helper needs one-time setup.',failed:'Automatic update did not finish. Use the steps below.'};
   $('updateStatus').textContent=(english?englishPhases:phases)[state.phase]||tr('更新状況を確認しています…','Checking update status…');
   $('helperSetup').hidden=!['idle','helper-required','failed'].includes(state.phase);
   if(['preparing','installing','reloading'].includes(state.phase))setTimeout(poll,1000);
  }catch{$('updateStatus').textContent=tr('拡張機能を再読み込みしています。少し待って、この画面を開き直してください。','The extension is reloading. Wait a moment and reopen this page.');}
 }
 poll();
}

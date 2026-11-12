/* Extension-only validation controls. Opening this panel never enables or runs retrieval. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const panel=$('validationPanel'),toggle=$('validationEnabled'),run=$('validationRun'),scenario=$('validationScenario'),result=$('validationResult');
 let busy=false,ready=false;
 const errors={MODE_OFF:'検証モードはOFFです。ONにしてから実行してください。',PRODUCTION_DISABLED:'本番通信は無効です。',AUTH_REQUIRED:'認証エラーを安全に検出しました。',HTTP_ERROR:'通信エラーを安全に検出しました。',INVALID_JSON:'不正なJSONを安全に拒否しました。',INVALID_RESPONSE:'不正な応答を安全に拒否しました。',TIMEOUT:'タイムアウトを安全に検出しました。',BUSY:'検証中です。完了までお待ちください。'};
 function show(text,state=''){result.textContent=text;result.dataset.state=state;}
 function controls(){
  run.disabled=!ready||busy||!toggle.checked;toggle.disabled=!ready||busy;scenario.disabled=busy;
  $('validationClose').disabled=busy;
  run.textContent=busy?'検証中…':scenario.value==='success'?'モック100件を検証':'選んだ内容で検証';
 }
 async function open(){
  panel.hidden=false;ready=false;controls();
  try{toggle.checked=await GDH_GETDATA_VALIDATION.enabled();ready=true;show(toggle.checked?'検証モードはONです。内容を選んで検証してください。':'検証モードはOFFです。ONにしてから実行してください。');}
  catch{show('設定を読み込めませんでした。検証タブを開き直してください。','error');}
  controls();toggle.focus();
 }
 toggle.addEventListener('change',async()=>{
  const value=toggle.checked;ready=false;controls();
  try{await GDH_GETDATA_VALIDATION.setEnabled(value);show(value?'検証モードはONです。「検証」ボタンを押してください。':'検証モードはOFFです。');}
  catch{toggle.checked=!value;show('設定を保存できませんでした。再度お試しください。','error');}
  finally{ready=true;controls();}
 });
 scenario.addEventListener('change',controls);
 run.addEventListener('click',async()=>{
  if(busy||run.disabled)return;
  busy=true;controls();$('validationFields').hidden=true;$('validationFieldList').replaceChildren();show('架空データを検証しています…');
  try{
   const {summary}=await GDH_GETDATA_VALIDATION.run({scenario:scenario.value});
   show(`${summary.valid?'検証成功':'項目を確認してください'}：${summary.count}件・${summary.fields.length}項目\n${summary.count===0?'空データを正常に処理しました。':'件数と項目名を確認しました。'}\nGDHへの通信は行っていません。`,summary.valid?'success':'error');
   for(const field of summary.fields){const li=document.createElement('li');li.textContent=field;$('validationFieldList').append(li);}
   $('validationFields').hidden=!summary.fields.length;
  }catch(error){show((errors[error.code]||'検証に失敗しました。設定を確認してください。')+'\nGDHへの通信は行っていません。','error');}
  finally{busy=false;controls();}
 });
 $('validationClose').addEventListener('click',async()=>{
  if(busy)return;
  ready=false;controls();
  try{await GDH_GETDATA_VALIDATION.setEnabled(false);toggle.checked=false;show('検証モードをOFFにしました。タブを閉じて検索画面に戻れます。');$('validationFields').hidden=true;document.querySelector('h1').focus();}
  catch{show('OFFにできませんでした。再度お試しください。','error');}
  finally{ready=true;controls();}
 });
 open();
})();

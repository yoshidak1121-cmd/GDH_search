/* CSV export contract verified against the supplied GDH ViewCreator page.
 * Read parameters from the live, authenticated form; never embed reference values.
 */
(function () {
 'use strict';
 const endpoint = 'viewcreator/dataview/list_csv';
 const prompt = 'CSVファイルを出力します。よろしいですか？';
 function confirmExport() {
  if (typeof window.imuiConfirm === 'function') {
   return new Promise(resolve => window.imuiConfirm(prompt, '確認', () => resolve(true), () => resolve(false)));
  }
  return window.confirm(prompt);
 }
 function fileNameFromHeader(header) {
  let name='';
  const utf=header.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if(utf){try{name=decodeURIComponent(utf[1].trim());}catch{}}
  if(!name){const plain=header.match(/filename\s*=\s*(?:"([^"]*)"|([^;]*))/i);name=plain?(plain[1]||plain[2]||'').trim():'';}
  name=name.split(/[\\/]/).pop().replace(/[\x00-\x1f\x7f]/g,'');
  return /\.csv$/i.test(name)?name:'GDH_machine_export.csv';
 }
 window.createGdhCsvExportAdapter = function (options={}) {
  const form=options.form || document.getElementById('frmmain');
  if(!(form instanceof HTMLFormElement))throw new Error('GDHの機械情報検索フォームが見つかりません。');
  const timeoutMs=options.timeoutMs ?? 120000;
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('CSV取得のタイムアウト値が不正です。');
  const confirm=options.confirmExport || confirmExport;
  if(typeof confirm!=='function')throw new Error('出力確認には関数を指定してください。');
  let busy=false;
  return async function () {
   if(busy)throw new Error('CSV取得を実行中です。完了までお待ちください。');
   busy=true;let timer;
   try {
    if(!form.isConnected)throw new Error('GDHの検索画面が閉じられました。画面を開き直してください。');
    const url=new URL(endpoint,form.ownerDocument.baseURI);
    if(!/^https?:$/.test(url.protocol)||url.origin!==location.origin)throw new Error('CSV出力先はGDHと同一オリジンである必要があります。');
    if(form.method.toLowerCase()!=='post')throw new Error('GDH検索フォームの送信方式が想定と異なります。');
    if(!await confirm())throw new Error('CSV出力を取り消しました。');
    // FormData retains repeated search fields, current conditions and dynamic security fields.
    const fields=new FormData(form);
    for(const name of ['dataview_cd','iszip','pdf','downloadToken','form_submit']) {
     if(!fields.has(name))throw new Error('GDH検索フォームの必須項目がありません：'+name);
    }
    fields.set('iszip','false');fields.set('pdf','false');fields.set('downloadToken',String(Date.now()));
    const body=new URLSearchParams();
    for(const [name,value] of fields){if(typeof value!=='string')throw new Error('CSV出力フォームに予期しないファイル項目があります。');body.append(name,value);}
    const controller=new AbortController();timer=setTimeout(()=>controller.abort(),timeoutMs);
    const response=await fetch(url.href,{method:'POST',credentials:'same-origin',redirect:'error',body,signal:controller.signal});
    if(!response.ok)throw new Error('GDH CSV出力エラー（HTTP '+response.status+'）');
    const type=(response.headers.get('Content-Type')||'').toLowerCase();
    if(/html|json|zip/.test(type))throw new Error('CSV以外の応答が返されました。ログイン状態・出力権限・圧縮設定を確認してください。');
    const blob=await response.blob();
    if(!blob.size)throw new Error('空のCSVファイルが返されました。');
    const head=await blob.slice(0,2048).text();
    if(/^\s*(?:<!doctype|<html|<form|<head|<body)/i.test(head)||head.startsWith('PK\x03\x04'))throw new Error('CSV以外のファイルが返されました。');
    return {blob,fileName:fileNameFromHeader(response.headers.get('Content-Disposition')||'')};
   } catch(error) {
    if(error.name==='AbortError')throw new Error('GDHのCSV出力がタイムアウトしました。再実行する前に出力状況を確認してください。');
    throw error;
   } finally {clearTimeout(timer);busy=false;}
  };
 };
})();

(function(root,factory){const m=factory();if(typeof module==='object'&&module.exports)module.exports=m;else root.GDHModel=m;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const isMazak=v=>String(v||'').trim().toUpperCase()==='MAZAK';
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;}
function addMonths(s,n){if(!validDate(s))return '';const [y,m,d]=s.split('-').map(Number);const end=new Date(Date.UTC(y,m-1+n+1,0)).getUTCDate();return new Date(Date.UTC(y,m-1+n,Math.min(d,end),12)).toISOString().slice(0,10);}
function derive(input,coverage){const s={...input};if(!isMazak(s.maker)&&s.customerMode==='mazak'){s.customerMode='maker';s.mazakCompany='';}
if(s.installMode==='same'){for(const [to,from] of [['installCompany','shipCompany'],['installSite','shipSite'],['installCountry','shipCountry'],['installPref','shipPref'],['installCity','shipCity']])s[to]=s[from]||'';}
const cov=(coverage||[]).find(x=>x.code===s.installCountry);
if(s.serviceMode==='auto')s.serviceCenter=cov?.service||'';
if(s.startMode==='same')s.contractStart=s.handover||'';
if(s.customerMode==='maker')s.customer=s.maker||'';else if(s.customerMode==='mazak')s.customer=s.mazakCompany||'';else s.customer=s.customerInput||'';
if(s.contractCompanyMode==='sales')s.contractCompany=s.seller||'';else if(s.contractCompanyMode==='service')s.contractCompany=s.serviceCenter||'';else s.contractCompany=s.contractCompanyInput||'';
s.outsourcer=s.serviceCenter||'';
return {state:s,isMazak:isMazak(s.maker),coverage:cov||null,warning:validDate(s.ncDate)&&validDate(s.contractStart)&&s.contractStart>=addMonths(s.ncDate,6)};}
function parseCsv(text){const rows=[];let row=[],value='',quoted=false,afterQuote=false;const t=String(text).replace(/^\uFEFF/,'');for(let i=0;i<t.length;i++){const c=t[i];if(quoted){if(c==='"'){if(t[i+1]==='"'){value+='"';i++;}else{quoted=false;afterQuote=true;}}else value+=c;}else if(c==='"'){if(value||afterQuote)throw Error('引用符の位置が正しくありません');quoted=true;}else if(c===','){row.push(value);value='';afterQuote=false;}else if(c==='\n'||c==='\r'){if(c==='\r'&&t[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';afterQuote=false;}else{if(afterQuote&&!/\s/.test(c))throw Error('引用符の後に不正な文字があります');if(!afterQuote)value+=c;}}
if(quoted)throw Error('引用符が閉じられていません');if(value||row.length||afterQuote){row.push(value);rows.push(row);}return rows.filter(r=>r.some(x=>x.trim()!==''));}
function toCsv(rows){return '\uFEFF'+rows.map(r=>r.map(v=>{const s=String(v??'');return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}).join(',')).join('\r\n');}
return {isMazak,validDate,addMonths,derive,parseCsv,toCsv};});

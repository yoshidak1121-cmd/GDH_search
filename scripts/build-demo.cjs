'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist','GDH_Search_Demo');fs.mkdirSync(out,{recursive:true});
const headings=fs.readFileSync(path.join(root,'tests/synthetic.csv'),'utf8').split(/\r?\n/)[0].replace(/^\ufeff/,'').split(',');
const rows=[];const types=['標準（架空）','プレミアム（架空）',''],services=['東日本（架空）','西日本（架空）'],makers=['青空工作（架空）','みどり機械（架空）','星海工機（架空）',''];
for(let t=0;t<types.length;t++)for(let s=0;s<services.length;s++)for(let m=0;m<makers.length;m++){
 const n=rows.length+1,row=Array(33).fill('');
 const values={'NCシリアル番号':'DEMO-NC-'+String(n).padStart(4,'0'),'NCシステム型名':['DEMO-100','DEMO-200'][m%2],'工作機械シリアル番号':'DEMO-MC-'+n,'工作機械モデル番号':'DEMO-MODEL-'+(m+1),'機械メーカー':makers[m],'サービス拠点':services[s],'契約番号':'DEMO-CT-'+n,'契約タイプ':types[t],'契約期間（月）':String([12,24,36][t]),'契約開始日':`202${t+3}/0${s+1}/01`,'契約終了日':`202${t+4}/0${s+1}/01`,'契約元拠点':services[s],'契約者名':'デモ契約者'+(m+1)+'（架空）','販売日':`202${t+3}/01/15`,'販売会社':['デモ販売A（架空）','デモ販売B（架空）'][s],'機械代理店':'デモ代理店（架空）','輸出国':'日本（架空）','輸入国':['日本（架空）','米国（架空）'][s],'機械出荷日':`202${t+3}/01/20`,'設置日':`202${t+3}/02/01`,'エンドユーザー':m===0?['株式会社あおぞら（架空）','(株)あおぞら（架空）','㈱アオゾラ（架空）'][(t*2+s)%3]:'デモ利用者'+(n%8+1)+'（架空）'};
 for(const [h,v] of Object.entries(values))row[headings.indexOf(h)]=v;rows.push(row);
}
const cell=v=>/[",\r\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;
const csv='\ufeff'+[headings,...rows].map(r=>r.map(cell).join(',')).join('\r\n');
const demoCode=`
'use strict';
{
 const demoCsv=${JSON.stringify(csv)},demoTypes=${JSON.stringify(types.slice(0,2))},demoCountry=${JSON.stringify('日本（架空）')},demoMaker=${JSON.stringify(makers[0])};
 document.documentElement.classList.add('embedded');
 document.title='GDH 拡張検索 操作デモ';
 const banner=document.createElement('section');banner.style.cssText='background:#fff5d8;border-bottom:1px solid #e6c76e;padding:15px 22px;color:#59451b;font:13px Meiryo,sans-serif;line-height:1.8';
 banner.innerHTML='<strong style="font-size:17px">GDH 拡張検索の操作デモ</strong><div>全24件の架空データで確認できます。本番への接続・拡張機能のインストールは不要です。</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button class="btn sm" id="demoExample">① 契約タイプOR × 輸入国（8件）</button><button class="btn sm" id="demoNarrow">② メーカーも指定（2件）</button><button class="btn sm" id="demoName">③ エンドユーザー表記揺れ（6件）</button><button class="btn sm" id="demoClear">すべての条件を解除（24件）</button></div><div>例：契約タイプが「標準 または プレミアム」かつ輸入国が「日本」。選択肢を変更して「検索」を押すと、自分でも試せます。</div>';
 document.body.prepend(banner);
 $('fileBtn').style.display='none';$('csvFile').disabled=true;$('fetchBtn').textContent='デモデータを再取得';$('fetchBtn').title='架空データ24件を再取得します';
 window.GDH_CSV_EXPORT_ADAPTER=async()=>({blob:new Blob([demoCsv],{type:'text/csv'}),fileName:'DEMO_架空機械情報.csv'});
 const field=name=>facetDefinitions.find(d=>d.name===name)?.index;
 function example(maker){
  clearFacetValues();$('keyword').value='';$('columnSelect').value='all';$('queryJoin').value='AND';
  const contracts=facetStates.get(field('契約タイプ')),country=facetStates.get(field('輸入国'));
  for(const value of demoTypes)contracts.values.add(value);country.values.add(demoCountry);
  for(const f of [contracts,country]){renderFacetValues(f);requestCandidates(f);}
  if(maker){const f=facetStates.get(field('機械メーカー'));f.values.add(demoMaker);renderFacetValues(f);requestCandidates(f);}
  requestSearch();
 }
 $('demoName').onclick=()=>{clearFacetValues();const f=facetStates.get(field('エンドユーザー'));f.input.value='株式会社あおぞら';addQuery(f);requestSearch();};
 $('demoExample').onclick=()=>example(false);$('demoNarrow').onclick=()=>example(true);$('demoClear').onclick=()=>$('resetBtn').click();
 for(const id of ['demoExample','demoNarrow','demoName','demoClear'])$(id).disabled=true;
 worker.addEventListener('message',event=>{if(event.data.type==='loaded'){for(const id of ['demoExample','demoNarrow','demoName','demoClear'])$(id).disabled=false;}});
 loadFile(new File([demoCsv],'DEMO_架空機械情報.csv',{type:'text/csv'}));
}
`;
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');html=html.replace('</body>','<script>'+demoCode+'</script>\n</body>');
fs.writeFileSync(path.join(out,'GDH_Search_Demo.html'),html);console.log(path.join(out,'GDH_Search_Demo.html'));

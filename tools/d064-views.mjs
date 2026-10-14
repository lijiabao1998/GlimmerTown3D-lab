// D064 擷取共用：seed516 本身有八棟合併塔（33 ×3、34 ×3、105 ×1、106 ×1），鏡頭直接對準真實的塔；
// 十四個形各一張單棟近景用畫廊樣張城（每種建築一棟）加 __gt.towerV 強制變體——seed516 裡沒有的形（105／106 的 v1、v2、33／34 缺的變體）靠這個補。
// 這個檔只算「看哪裡」；tools/d064-capture.mjs 用，不用瀏覽器、不寫世界。
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './cdp.mjs';
import {d058City} from './unit-d058.mjs';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {galleryLayout} from '../src/content/gallery.ts';
import {TOWER_KIND_LIST} from './d064-baseline.mjs';
import {settle} from './d061-views.mjs';

export {settle,TOWER_KIND_LIST};
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
export const KT=kindTableFrom(read('src/content/lab-kinds.json'));
// 畫面（桌機 1440×1000、手機 360×740 與 412×860）。
export const D064_VIEWPORTS=[{W:1440,H:1000,mobile:false},{W:360,H:740,mobile:true},{W:412,H:860,mobile:true}];
export const D064_VARIANTS={33:4,34:4,105:3,106:3};
export const D064_FORMS=TOWER_KIND_LIST.flatMap(k=>[...Array(D064_VARIANTS[k]).keys()].map(v=>({k,v,id:`k${k}-v${v}`})));
// 總覽：D061 的 seed516 遠景（桌機）、八棟塔的天際線（'towers'＝八棟塔的中心）、ai120（沒有合併塔，前後必須逐像素相同）。
export const D064_OVERVIEWS=[
  {id:'seed516-far',sample:'seed516',x:36,z:36,zoom:1.2},
  {id:'seed516-skyline',sample:'seed516',x:'towers',z:null,zoom:2.4},
  {id:'ai120-default',sample:'ai120',x:null,z:null,zoom:null},
];
export function d064City(sample='seed516'){return d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${sample}.code.txt`),'utf8'));}
export function d064Towers(city) {
  return city.buildings.filter(b=>TOWER_KIND_LIST.includes(b.k)&&b.goneDay===undefined).map(b=>({id:b.id,k:b.k,v:b.v,lv:b.lv,x:b.x,z:b.z,size:b.size,H:KT.height(b.k,b.lv,b.v)})).sort((a,b)=>a.id-b.id);
}
export const towersCentre=towers=>({x:towers.reduce((s,t)=>s+t.x+t.size/2,0)/towers.length,z:towers.reduce((s,t)=>s+t.z+t.size/2,0)/towers.length});
// 畫廊樣張城裡每個種類的位置（跟頁面用同一個 galleryLayout）
export function galleryPlot(k) {
  const plot=galleryLayout(KT.data.kinds.map(r=>({k:r.k,size:r.size,cat:r.cat}))).find(p=>p.k===k);
  if(!plot)throw new Error('no gallery plot for kind '+k);
  return plot;
}
// 一棟塔的鏡頭：置中、縮放讓佔地與高度都進畫面（桌機最多 16 倍、手機最多 8 倍）
// 高度的權重 hk：城裡的塔旁邊有別的建築，要看得到整棟（1.1）；畫廊的單棟旁邊是空地，可以拉近一點（.8）
export function towerCamera(t,opt,hk=1.1) {
  const extent=Math.max(t.size*Math.SQRT2*.9,t.H*hk,1.6);
  return {x:t.x+t.size/2,z:t.z+t.size/2,zoom:Math.min(opt.mobile?8:16,(opt.mobile?opt.W*.70:650)/(opt.H/(72*.84)*extent))};
}

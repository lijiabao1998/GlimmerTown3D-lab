// D063 基線量測：在任何 D063 原始碼變動之前，量 D062 候選（c17da56）兩座基準城的商業（kind 2）街區實際三角形，以及舊畫法的商業「詞彙」。
// 只讀：用跟 unit-d060 同一套 Node 場景建構（buildCityScene），不開瀏覽器、不寫世界。
//   node tools/d063-baseline.mjs           印出量測結果
//   node tools/d063-baseline.mjs --write   寫入 fixtures/d063-baseline.json（寫入前要求 src/ 與基線提交完全相同）
// 「加權三角形」＝ 牆、其他兩個會投影的網格各算兩次（主畫面一趟＋影子一趟）、點綴網格算一次，跟 d060-baseline 的 weighted() 同一個式子。
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {facadePlan,trimPlan} from '../src/content/facades.ts';
import {dressing} from '../src/content/dressing.ts';
import {Geo} from '../src/render/scene.ts';
import {drawBlock,emptyCounts} from '../src/render/blockArt.ts';
import {recipe} from '../src/content/recipes.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';

export const D063_BASELINE_COMMIT='c17da566fe4870eb0ce38cf6f32a90b8f0672efe';
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};

// 一座城、一個畫法檔的商業量測。blocks 由呼叫端決定旗標（基線＝現行預設；D063 守衛用同一函式量「新」）。
export function measureCommerce(city,blocks) {
  const con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
  try {
    const meshes=sceneDigest(built).meshes,owner=(name,o)=>meshes[name]?.ownerTris?.[o]??0;
    const byArche={},cls={blocks:0,weighted:0};
    blocks.plan.forEach((b,bi)=>{
      if(b.k!==2)return;
      const r=blocks.recipe(b),o=-(bi+1);
      const w=owner('walls',o),t=owner('other',o),d=owner('dress',o),cost=2*(w+t)+d;
      const key=`lv${r.lv}:${r.arche}:${r.path}`,row=byArche[key]??={blocks:0,walls:0,other:0,dress:0,weighted:0,sizes:{},maxWeighted:0};
      row.blocks++;row.walls+=w;row.other+=t;row.dress+=d;row.weighted+=cost;row.maxWeighted=Math.max(row.maxWeighted,cost);
      const size=b.w+'x'+b.h;(row.sizes[size]??={blocks:0,weighted:0,max:0});row.sizes[size].blocks++;row.sizes[size].weighted+=cost;row.sizes[size].max=Math.max(row.sizes[size].max,cost);
      cls.blocks++;cls.weighted+=cost;
    });
    return {weighted:weighted(built),signature:signature(built),commerce:{...cls,byArche:Object.fromEntries(Object.entries(byArche).sort(([a],[b])=>a<b?-1:1))}};
  } finally {built.dispose();con.dispose();}
}

// 舊畫法的商業「詞彙」：商業 14 個原型 × 24 個變體 × 四種街區尺寸，recipe 實際給出的屋頂種類、窗型、牆色。
export function oldCommerceVocabulary() {
  const arche=read('src/content/lab-arche.json').arche;
  const combos={},walls={};
  for(const lv of [1,2,3])for(let v=0;v<24;v++)for(const [w,h] of [[1,1],[1,2],[2,1],[2,2]]) {
    const r=recipe(arche,2,lv,w,h,v),key=`lv${lv}:${r.arche}:${r.path}`;
    (combos[key]??=new Set()).add(`${r.roof.kind}/${r.win}/${r.upper?'upper':'flat'}`);
    (walls[key]??=new Set()).add(r.pal.light);
  }
  return Object.fromEntries(Object.keys(combos).sort().map(k=>[k,{formCombos:[...combos[k]].sort(),wallColors:walls[k].size}]));
}


// 舊畫法的逐尺寸成本：畫廊直接呼叫 drawBlock（不經過城市與 restyle），十一個核心原型 × 16 種街區尺寸 × 24 個變體中屬於該原型的幾個；
// 上限＝⌊0.95 × 平均⌋（卡面「預算決定」）。成本＝牆與其他各算兩次、點綴算一次。
export const CORE=['market','modernShop','dept','modernOffice','stoneHotel','podTower','setback','slabC','stoneTower','modernNeedle','courtC'];
export const SIZES=[[1,1],[1,2],[2,1],[2,2],[1,3],[3,1],[1,4],[4,1],[2,3],[3,2],[2,4],[4,2],[3,3],[3,4],[4,3],[4,4]];
export function oldCostBySize() {
  const arche=read('src/content/lab-arche.json').arche,acc={},tri=g=>g.pos.length/9;
  for(const lv of [1,2,3])for(let v=0;v<24;v++)for(const [w,h] of SIZES) {
    const r=recipe(arche,2,lv,w,h,v);if(!r.arche||r.path!=='core'||!CORE.includes(r.arche))continue;
    const b={x:0,z:0,k:2,lv,v,w,h,cells:Array.from({length:w*h},(_,i)=>i),from:'lab'};
    const G=[new Geo({ext:true}),new Geo(),new Geo()];for(const g of G)g.owner=-1;
    drawBlock(...G,b,r,dressing(r),0,[],emptyCounts(),facadePlan(r),trimPlan(r),null);
    ((acc[r.arche]??={lv})[w+'x'+h]??=[]).push(2*(tri(G[0])+tri(G[1]))+tri(G[2]));
  }
  const out={};
  for(const [name,row] of Object.entries(acc)) {
    out[name]={lv:row.lv,sizes:{}};
    for(const [size,a] of Object.entries(row)) {
      if(size==='lv')continue;
      const mean=a.reduce((x,y)=>x+y,0)/a.length;
      out[name].sizes[size]={variants:a.length,mean:+mean.toFixed(2),min:Math.min(...a),max:Math.max(...a),cap:Math.floor(0.95*mean)};
    }
  }
  return out;
}

export function measureBaseline(options={}) {
  const out={};
  for(const id of ['seed516','ai120']) {
    const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
    out[id]={n:city.n,modes:{}};
    for(const mode of ['a','b','c'])out[id].modes[mode]=measureCommerce(city,{...d058Blocks(city,mode),...options});
  }
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  // 基線＝現行預設：D058 街景、D059 村落、D060 工業都開（cityView 預設）；地景檔位在 Node 場景裡不存在＝legacy 地面。D063 的旗標在基線提交裡根本不存在。
  const result={baseline:D063_BASELINE_COMMIT,tool:'tools/d063-baseline.mjs',flags:{streetArt:true,villageArt:true,industryArt:true},vocabulary:oldCommerceVocabulary(),oldCost:oldCostBySize(),cities:measureBaseline({villageArt:true,industryArt:true})};
  if(process.argv.includes('--write')) {
    const changed=execFileSync('git',['diff','--name-only',D063_BASELINE_COMMIT,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim();
    if(changed){console.error('refusing to write: src/ differs from the baseline commit:\n'+changed);process.exit(2);}
    fs.writeFileSync(path.join(ROOT,'fixtures/d063-baseline.json'),JSON.stringify(result,null,1)+'\n');
    console.log('wrote fixtures/d063-baseline.json');
  }
  for(const [id,c] of Object.entries(result.cities))for(const [mode,m] of Object.entries(c.modes))
    console.log(id,mode,'weighted',m.weighted,'commerce blocks',m.commerce.blocks,'weighted',m.commerce.weighted);
  for(const [key,row] of Object.entries(result.cities.seed516.modes.c.commerce.byArche))console.log('  seed516 C',key.padEnd(26),'blocks',String(row.blocks).padStart(3),'weighted',String(row.weighted).padStart(5),'avg',(row.weighted/row.blocks).toFixed(0).padStart(4),'max',row.maxWeighted,JSON.stringify(row.sizes));
}

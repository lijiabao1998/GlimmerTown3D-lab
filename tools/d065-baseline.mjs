// D065 基線量測：在任何 D065 原始碼變動之前，量 D064 候選（f4a1a4e）兩座基準城 × A／B／C 三檔的整城簽章、加權三角形，以及 villa／modern 街區（k=1、lv=1、核心路徑）舊畫法的逐塊成本。
// 只讀：用跟 unit-d060／d063 同一套 Node 場景建構（buildCityScene），不開瀏覽器、不寫世界。
//   node tools/d065-baseline.mjs           印出量測結果
//   node tools/d065-baseline.mjs --write   寫入 fixtures/d065-baseline.json（寫入前要求 src/ 與基線提交完全相同）
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

export const D065_BASELINE_COMMIT='f4a1a4eb5d991c6856aacccfd51e51ee9d0b8c80';
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
// D064 起合併塔用新畫法（shapeOf 的塔旗標預設是關的，由呼叫端明講）：基線＝D064 候選的預設畫面
export const civicOf=()=>({shape:k=>shapeOf(k,true,true),colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))});
export const HOUSE_ARCHES=['villa','modern'];
export const isHouse=r=>r.k===1&&r.lv===1&&r.path==='core'&&HOUSE_ARCHES.includes(r.arche);
export const BASE_FLAGS={villageArt:true,industryArt:true,commerceArt:true};

// 一座城、一個畫法檔：villa／modern 街區的逐塊成本（依原型與尺寸）。blocks 由呼叫端決定旗標（基線＝D064 預設；D065 守衛用同一函式量「新」）。
export function measureHouses(city,blocks) {
  const con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civicOf(),con,true);
  try {
    const meshes=sceneDigest(built).meshes,owner=(name,o)=>meshes[name]?.ownerTris?.[o]??0;
    const byShape={},cls={blocks:0,weighted:0};
    blocks.plan.forEach((b,bi)=>{
      const r=blocks.recipe(b);if(!isHouse(r))return;
      const o=-(bi+1),w=owner('walls',o),t=owner('other',o),d=owner('dress',o),cost=2*(w+t)+d;
      const key=`${r.arche}:${b.w}x${b.h}`,row=byShape[key]??={blocks:0,weighted:0,min:1e9,max:0};
      row.blocks++;row.weighted+=cost;row.min=Math.min(row.min,cost);row.max=Math.max(row.max,cost);
      cls.blocks++;cls.weighted+=cost;
    });
    return {weighted:weighted(built),signature:signature(built),houses:{...cls,byShape:Object.fromEntries(Object.entries(byShape).sort(([a],[b])=>a<b?-1:1))}};
  } finally {built.dispose();con.dispose();}
}

// 舊畫法的逐尺寸成本：直接呼叫 drawBlock（不經過城市與 restyle），villa／modern × 16 種街區尺寸 × 24 個變體中屬於該原型的幾個；
// 上限＝⌊0.95 × 平均⌋（卡面「預算決定」）。成本＝牆與其他各算兩次、點綴算一次。
export const SIZES=[[1,1],[1,2],[2,1],[2,2],[1,3],[3,1],[1,4],[4,1],[2,3],[3,2],[2,4],[4,2],[3,3],[3,4],[4,3],[4,4]];
export function oldCostBySize() {
  const arche=read('src/content/lab-arche.json').arche,acc={},tri=g=>g.pos.length/9;
  for(let v=0;v<24;v++)for(const [w,h] of SIZES) {
    const r=recipe(arche,1,1,w,h,v);if(!isHouse(r))continue;
    const b={x:0,z:0,k:1,lv:1,v,w,h,cells:Array.from({length:w*h},(_,i)=>i),from:'lab'};
    const G=[new Geo({ext:true}),new Geo(),new Geo()];for(const g of G)g.owner=-1;
    drawBlock(...G,b,r,dressing(r),0,[],emptyCounts(),facadePlan(r),trimPlan(r),null);
    ((acc[r.arche]??={})[w+'x'+h]??=[]).push(2*(tri(G[0])+tri(G[1]))+tri(G[2]));
  }
  const out={};
  for(const [name,row] of Object.entries(acc)) {
    out[name]={sizes:{}};
    for(const [size,a] of Object.entries(row)) {
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
    for(const mode of ['a','b','c'])out[id].modes[mode]=measureHouses(city,{...d058Blocks(city,mode),...options});
  }
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const result={baseline:D065_BASELINE_COMMIT,tool:'tools/d065-baseline.mjs',flags:BASE_FLAGS,oldCost:oldCostBySize(),cities:measureBaseline(BASE_FLAGS)};
  if(process.argv.includes('--write')) {
    const changed=execFileSync('git',['diff','--name-only',D065_BASELINE_COMMIT,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim();
    if(changed){console.error('refusing to write: src/ differs from the baseline commit:\n'+changed);process.exit(2);}
    fs.writeFileSync(path.join(ROOT,'fixtures/d065-baseline.json'),JSON.stringify(result,null,1)+'\n');
    console.log('wrote fixtures/d065-baseline.json');
  }
  for(const [id,c] of Object.entries(result.cities))for(const [mode,m] of Object.entries(c.modes))
    console.log(id,mode,'weighted',m.weighted,'house blocks',m.houses.blocks,'weighted',m.houses.weighted,JSON.stringify(Object.fromEntries(Object.entries(m.houses.byShape).map(([k,v])=>[k,[v.blocks,v.min,v.max]]))));
  for(const [name,row] of Object.entries(result.oldCost))console.log('  old',name,JSON.stringify(Object.fromEntries(Object.entries(row.sizes).map(([s,x])=>[s,x.cap]))));
}

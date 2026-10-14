// 美術線盤點（只讀）：哪些畫面還是通用美術、通用類的「詞彙」有多窄。給下一波挑對象用，不改任何東西。
//   node tools/art-coverage.mjs            印出兩座基準城（seed516、ai120）C 檔的覆蓋，以及住宅、商業原型的詞彙
//   node tools/art-coverage.mjs --json     只印 JSON（存證用：docs/evidence/art-coverage-*.json）
// 覆蓋＝照 D058（英式街屋）／D059（村莊）／D060（工業）的選擇器把每個街區分類，沒被任何一波接手的算「通用」；
//       非住商工的市政／特殊建築另算（D056 市政、D057 遺產、D059 村莊 vs 通用）。
// 權重＝街區自己的加權三角形（牆與其他兩個會投影的網格各算兩次，點綴算一次），跟 d060-baseline 同一個式子。
// 詞彙＝24 個變體 × 四種街區尺寸，recipe 實際給出的屋頂種類、窗型、牆色、屋色；「形式組合」＝（屋頂／窗型／有無上層量體）的相異數，
//       1 代表同一原型的變體只差顏色、沒有結構差異（實驗線的規矩是變體要結構不同）。
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {ROOT} from './cdp.mjs';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {recipe} from '../src/content/recipes.ts';
import {isBritishStreet} from '../src/content/britishStreets.ts';
import {villageBlock,villageKind} from '../src/content/britishVillage.ts';
import {industryBlock} from '../src/content/britishIndustry.ts';
import {commerceBlock} from '../src/content/britishCommerce.ts';
import {BRITISH_KINDS} from '../src/content/britishCivic.ts';
import {BRITISH_HERITAGE_KINDS} from '../src/content/britishHeritage.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';

const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const ARCHE=read('src/content/lab-arche.json').arche;
const KIND_NAME=new Map(read('src/content/lab-kinds.json').kinds.map(r=>[r.k,r.name??r.n??`k${r.k}`]));
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
const LAND_USE={1:'住宅',2:'商業',3:'工業'};
const SIZES=[[1,1],[1,2],[2,1],[2,2]];

const classify=r=>isBritishStreet(r)?'D058 英式街屋':villageBlock(r)?'D059 村莊':industryBlock(r)?'D060 工業':commerceBlock(r)?'D063 商業':'通用';   // 順序＝cityScene 的選擇順序；D063 之前的存證（art-coverage-2026-10-14.json）沒有這一列

export function coverage(id) {
  const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
  const blocks={...d058Blocks(city,'c'),villageArt:true,industryArt:true,commerceArt:true,detail:true};
  const con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
  try {
    const meshes=sceneDigest(built).meshes,owner=(name,o)=>meshes[name]?.ownerTris?.[o]??0;
    const byUse={},generic={};
    let blockWeighted=0;
    blocks.plan.forEach((b,bi)=>{
      const r=blocks.recipe(b),o=-(bi+1),cost=2*(owner('walls',o)+owner('other',o))+owner('dress',o),cat=classify(r);
      const use=(byUse[b.k]??={});(use[cat]??={blocks:0,cells:0,weighted:0});use[cat].blocks++;use[cat].cells+=b.cells.length;use[cat].weighted+=cost;blockWeighted+=cost;
      if(cat==='通用'){const key=`k${b.k} lv${r.lv} ${r.arche??''}/${r.path??''}`;(generic[key]??={blocks:0,cells:0,weighted:0});generic[key].blocks++;generic[key].cells+=b.cells.length;generic[key].weighted+=cost;}
    });
    const special={},genericKinds={};
    for(const b of city.buildings) {
      if(b.goneDay!==undefined||b.k<=3||!civic.shape(b.k))continue;
      const cat=BRITISH_KINDS.has(b.k)?'D056 市政':BRITISH_HERITAGE_KINDS.has(b.k)?'D057 遺產':villageKind(b.k)?'D059 村莊':'通用';
      special[cat]=(special[cat]??0)+1;
      if(cat==='通用'){const key=`${b.k} ${KIND_NAME.get(b.k)??''}`.trim();genericKinds[key]=(genericKinds[key]??0)+1;}
    }
    const sorted=o=>Object.fromEntries(Object.entries(o).sort((a,b)=>(b[1].blocks??b[1])-(a[1].blocks??a[1])));
    return {blocks:blocks.plan.length,blockWeighted,sceneWeighted:built.meshStats().reduce((n,m)=>n+m.tris*(m.shadow?2:1),0),
      byLandUse:Object.fromEntries(Object.entries(byUse).map(([k,v])=>[`${k} ${LAND_USE[k]}`,v])),genericBlockTypes:sorted(generic),civicSpecial:special,genericCivicKinds:sorted(genericKinds)};
  } finally {built.dispose();con.dispose();}
}

export function vocabulary(k) {
  const per={};
  for(const lv of [1,2,3])for(let v=0;v<24;v++)for(const [w,h] of SIZES) {
    const r=recipe(ARCHE,k,lv,w,h,v),key=`lv${lv} ${r.arche}/${r.path}`;
    const p=per[key]??={covered:classify(r),roofs:new Set(),windows:new Set(),walls:new Set(),roofColors:new Set(),combos:new Set()};
    p.roofs.add(r.roof.kind);p.windows.add(r.win);p.walls.add(r.pal.light);p.roofColors.add(r.pal.roof);p.combos.add(`${r.roof.kind}/${r.win}/${r.upper?'upper':'flat'}`);
  }
  const all={roofs:new Set(),windows:new Set(),walls:new Set()};
  const rows=Object.fromEntries(Object.entries(per).map(([key,p])=>{
    for(const x of p.roofs)all.roofs.add(x);for(const x of p.windows)all.windows.add(x);for(const x of p.walls)all.walls.add(x);
    return [key,{covered:p.covered,roofs:[...p.roofs],windows:[...p.windows],wallColors:p.walls.size,roofColors:p.roofColors.size,formCombos:p.combos.size}];
  }));
  return {archetypes:rows,total:{roofKinds:[...all.roofs],windowStyles:[...all.windows],wallColors:all.walls.size}};
}

const out={head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),coverage:{},vocabulary:{}};
for(const id of ['seed516','ai120'])out.coverage[id]=coverage(id);
for(const k of [1,2])out.vocabulary[`k${k} ${LAND_USE[k]}`]=vocabulary(k);

if(process.argv.includes('--json')) console.log(JSON.stringify(out,null,1));
else {
  for(const [id,c] of Object.entries(out.coverage)) {
    console.log(`\n===== ${id} C 檔：${c.blocks} 個街區，街區加權 ${c.blockWeighted.toLocaleString()}／場景加權 ${c.sceneWeighted.toLocaleString()}`);
    for(const [use,v] of Object.entries(c.byLandUse)) {
      const n=Object.values(v).reduce((a,x)=>a+x.blocks,0);
      console.log(`  ${use}：${n} 塊 — `+Object.entries(v).map(([cat,x])=>`${cat} ${x.blocks}（${(100*x.blocks/n).toFixed(0)}%）`).join('、'));
    }
    console.log('  通用街區（前 8 類）：'+Object.entries(c.genericBlockTypes).slice(0,8).map(([k,v])=>`${k}×${v.blocks}`).join('、'));
    console.log('  非住商工建築：'+JSON.stringify(c.civicSpecial)+'；通用種類：'+Object.entries(c.genericCivicKinds).slice(0,8).map(([k,n])=>`${k}×${n}`).join('、'));
  }
  for(const [name,v] of Object.entries(out.vocabulary)) {
    console.log(`\n===== ${name}的詞彙`);
    for(const [key,p] of Object.entries(v.archetypes))console.log(`  ${key.padEnd(34)}[${p.covered}] 屋頂 ${p.roofs.join('+')}／窗 ${p.windows.join('+')}／牆色 ${p.wallColors}／屋色 ${p.roofColors}／形式組合 ${p.formCombos}`);
    console.log(`  合計：屋頂 ${v.total.roofKinds.length} 種、窗型 ${v.total.windowStyles.length} 種、牆色 ${v.total.wallColors} 種`);
  }
}

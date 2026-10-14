// D060 基線量測：在任何 D060 原始碼變動之前，量 D059 正式版（main 0bef78f）兩座基準城的實際三角形。
// 只讀：用跟 unit-d059 同一套 Node 場景建構（buildCityScene），不開瀏覽器、不寫世界。
//   node tools/d060-baseline.mjs           印出量測結果
//   node tools/d060-baseline.mjs --write   寫入 fixtures/d060-baseline.json（寫入前要求 src/ 與基線提交完全相同）
// 「加權三角形」＝ 牆、其他兩個會投影的網格各算兩次（主畫面一趟＋影子一趟）、點綴網格算一次，跟 unit-d059 的 total() 同一個式子。
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
import {recipe} from '../src/content/recipes.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';

export const D060_BASELINE_COMMIT='0bef78f76daa1edbbc7b2b8f80d49f0a13dc7f63';
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
export const weighted=b=>b.meshStats().reduce((n,m)=>n+m.tris*(m.shadow?2:1),0);

// 一座城、一個畫法檔的量測。blocks 由呼叫端決定旗標（基線＝現行預設；D060 守衛用同一函式量「新」）。
export function measure(city,blocks) {
  const con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
  try {
    const stats=built.meshStats().map(m=>({name:m.name,tris:m.tris,shadow:!!m.shadow}));
    const meshes=sceneDigest(built).meshes,owner=(name,o)=>meshes[name]?.ownerTris?.[o]??0;
    const byArche={},cls={blocks:0,weighted:0};
    blocks.plan.forEach((b,bi)=>{
      if(b.k!==3)return;
      const r=blocks.recipe(b),o=-(bi+1);
      const w=owner('walls',o),t=owner('other',o),d=owner('dress',o),cost=2*(w+t)+d;
      const key=`lv${r.lv}:${r.arche}`,row=byArche[key]??={blocks:0,walls:0,other:0,dress:0,weighted:0,sizes:{}};
      row.blocks++;row.walls+=w;row.other+=t;row.dress+=d;row.weighted+=cost;
      row.sizes[b.w+'x'+b.h]=(row.sizes[b.w+'x'+b.h]??0)+1;
      cls.blocks++;cls.weighted+=cost;
    });
    return {weighted:weighted(built),meshes:stats,industry:{...cls,byArche:Object.fromEntries(Object.entries(byArche).sort(([a],[b])=>a<b?-1:1))}};
  } finally {built.dispose();con.dispose();}
}

// 舊畫法的工業「詞彙」：十二個原型 × 24 個變體 × 四種街區尺寸，recipe 實際給出的屋頂種類、窗型、牆色。
// 目的是量化「看起來都一樣」：若十二個原型的形式組合完全相同，差別就只剩佔地與高度。
export function oldVocabulary() {
  const arche=read('src/content/lab-arche.json').arche;
  const sat=hex=>{const n=parseInt(hex.slice(1),16),r=(n>>16)/255,g=((n>>8)&255)/255,b=(n&255)/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;return mx===mn?0:(mx-mn)/(1-Math.abs(2*l-1));};
  const roofs=new Set(),wins=new Set(),walls=new Set(),roofColors=new Set(),tall=new Set(),combos={};
  for(const lv of [1,2,3])for(let v=0;v<24;v++)for(const [w,h] of [[1,1],[1,2],[2,1],[2,2]]) {
    const r=recipe(arche,3,lv,w,h,v);
    roofs.add(r.roof.kind);wins.add(r.win);walls.add(r.pal.light);roofColors.add(r.pal.roof);
    if(r.stacks.some(q=>q.tall))tall.add(r.arche);
    (combos[`lv${lv}:${r.arche}`]??=new Set()).add(`${r.roof.kind}/${r.win}/${r.upper?'upper':'flat'}`);
  }
  const sats=[...walls].map(sat);
  return {
    roofKinds:[...roofs].sort(),windowStyles:[...wins].sort(),wallColors:[...walls].sort(),roofColors:roofColors.size,
    wallSaturation:[Math.min(...sats),Math.max(...sats)].map(x=>+x.toFixed(2)),tallStackArchetypes:[...tall].sort(),
    formCombosPerArchetype:Object.fromEntries(Object.entries(combos).sort(([a],[b])=>a<b?-1:1).map(([k,v])=>[k,[...v].sort()])),
  };
}

export function measureBaseline(options={}) {
  const out={};
  for(const id of ['seed516','ai120']) {
    const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
    out[id]={n:city.n,modes:{}};
    for(const mode of ['a','b','c'])out[id].modes[mode]=measure(city,{...d058Blocks(city,mode),...options});
  }
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  // 基線＝正式站的預設畫法：D058 街景與 D059 村落都開（cityView 預設 villageArt:true）；D060 的旗標在基線提交裡根本不存在。
  const result={baseline:D060_BASELINE_COMMIT,tool:'tools/d060-baseline.mjs',flags:{streetArt:true,villageArt:true},vocabulary:oldVocabulary(),cities:measureBaseline({villageArt:true})};
  if(process.argv.includes('--write')) {
    const changed=execFileSync('git',['diff','--name-only',D060_BASELINE_COMMIT,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim();
    if(changed){console.error('refusing to write: src/ differs from the baseline commit:\n'+changed);process.exit(2);}
    fs.writeFileSync(path.join(ROOT,'fixtures/d060-baseline.json'),JSON.stringify(result,null,1)+'\n');
    console.log('wrote fixtures/d060-baseline.json');
  }
  for(const [id,c] of Object.entries(result.cities))for(const [mode,m] of Object.entries(c.modes))
    console.log(id,mode,'weighted',m.weighted,'industry blocks',m.industry.blocks,'weighted',m.industry.weighted);
}

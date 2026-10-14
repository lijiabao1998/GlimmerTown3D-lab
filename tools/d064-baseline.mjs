// D064 基線量測：在任何 D064 原始碼變動之前，量 D063 候選（c5fed2f；src/ 與 D063 施工提交 c59f24a 相同）兩座基準城的合併塔（種類 33、34、105、106）實際三角形。
// 只讀：用跟 unit-d063 同一套 Node 場景建構（buildCityScene），不開瀏覽器、不寫世界。
//   node tools/d064-baseline.mjs           印出量測結果
//   node tools/d064-baseline.mjs --write   寫入 fixtures/d064-baseline.json（寫入前要求 src/ 與基線提交完全相同）
// 「加權三角形」＝ 牆、其他兩個會投影的網格各算兩次（主畫面一趟＋影子一趟）、點綴網格算一次，跟 d060-baseline 的 weighted() 同一個式子。
// towerOn 是 D064 才有的第三個參數：基線提交的 shapeOf 只收兩個參數，多的會被忽略，所以同一支工具可以在基線樹與現行樹各跑一次。
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
import {d058Blocks,d058City} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';

export const D064_BASELINE_COMMIT='c5fed2fd5b600c9d68e0b90be119e64178b081c8';
export const TOWER_KIND_LIST=[33,34,105,106];
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const civicOf=towerOn=>({shape:k=>shapeOf(k,true,towerOn),colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))});

// 一座城、一個畫法檔的量測。blocks 由呼叫端決定旗標（基線＝現行預設；D064 守衛用同一函式量「新」）。
export function measureTowers(city,blocks,towerOn=false) {
  const con=new ConState(city.n),built=buildCityScene(city,KT,STYLES.A,blocks,'d',civicOf(towerOn),con,true);
  try {
    const meshes=sceneDigest(built).meshes,owner=(name,o)=>meshes[name]?.ownerTris?.[o]??0;
    const list=[],byKind={};
    for(const b of city.buildings) {
      if(!TOWER_KIND_LIST.includes(b.k)||b.goneDay!==undefined||b.x+b.size>city.n||b.z+b.size>city.n)continue;
      const w=owner('walls',b.id),t=owner('other',b.id),d=owner('dress',b.id),cost=2*(w+t)+d;
      list.push({id:b.id,k:b.k,v:b.v,lv:b.lv,x:b.x,z:b.z,walls:w,other:t,dress:d,cost});
      const row=byKind[b.k]??={count:0,weighted:0,min:Infinity,max:0};
      row.count++;row.weighted+=cost;row.min=Math.min(row.min,cost);row.max=Math.max(row.max,cost);
    }
    return {weighted:weighted(built),signature:signature(built),towers:{count:list.length,weighted:list.reduce((n,r)=>n+r.cost,0),byKind:Object.fromEntries(Object.entries(byKind).sort(([a],[b])=>a-b)),list}};
  } finally {built.dispose();con.dispose();}
}

export function measureBaseline(options={}) {
  const out={};
  for(const id of ['seed516','ai120']) {
    const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
    out[id]={n:city.n,modes:{}};
    for(const mode of ['a','b','c'])out[id].modes[mode]=measureTowers(city,{...d058Blocks(city,mode),...options},false);
  }
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  // 基線＝現行預設：D058 街景、D059 村落、D060 工業、D063 商業都開（cityView 預設）；D064 的旗標在基線提交裡根本不存在。
  const result={baseline:D064_BASELINE_COMMIT,tool:'tools/d064-baseline.mjs',flags:{streetArt:true,villageArt:true,industryArt:true,commerceArt:true},cities:measureBaseline({villageArt:true,industryArt:true,commerceArt:true})};
  if(process.argv.includes('--write')) {
    const changed=execFileSync('git',['diff','--name-only',D064_BASELINE_COMMIT,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim();
    if(changed){console.error('refusing to write: src/ differs from the baseline commit:\n'+changed);process.exit(2);}
    fs.writeFileSync(path.join(ROOT,'fixtures/d064-baseline.json'),JSON.stringify(result,null,1)+'\n');
    console.log('wrote fixtures/d064-baseline.json');
  }
  for(const [id,c] of Object.entries(result.cities))for(const [mode,m] of Object.entries(c.modes))
    console.log(id,mode,'weighted',m.weighted,'towers',m.towers.count,'weighted',m.towers.weighted,JSON.stringify(m.towers.byKind));
}

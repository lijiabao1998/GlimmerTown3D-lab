// D061 基線量測：在 D060 候選的提交（d4cef37，還沒有任何 D061 程式）上，量「舊畫法」的地面像素與整座場景的簽章；
// 之後 landArt＝0（legacy）的地面與場景必須與這份固定檔逐位元組相同（tools/unit-d061.mjs 核對）。
//   node tools/d061-baseline.mjs                    印出量測結果
//   node tools/d061-baseline.mjs --write --out=PATH  寫成 JSON（寫入前要求 HEAD＝基線提交、src/ 沒有未提交的變動；所以要在基線的 git worktree 裡跑）
// 這支檔案本身只依賴基線就有的程式（d061-grounds.mjs 不 import landArt.ts），所以可以複製進基線的 worktree 照跑：
//   git worktree add --detach ../d061-base d4cef37…; cp tools/d061-{baseline,grounds}.mjs ../d061-base/tools/; (cd ../d061-base && ln -s <repo>/node_modules node_modules && node --experimental-strip-types tools/d061-baseline.mjs --write --out=…)
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {D061_BASELINE,D061_CITIES,groundOf,zonedGround} from './d061-grounds.mjs';

const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const KT=kindTableFrom(read('src/content/lab-kinds.json')),LOOKS=read('src/content/lab-looks.json').looks;
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

// 地面像素：四座樣本城各兩種輸入（有街區地坪與非住商工地坪／只有自然地貌）＋劃區道路測試城
export function groundHashes(land=0) {
  const out={};
  for(const id of D061_CITIES) {
    for(const withLots of [true,false]) {
      const g=groundOf(id,land,{withLots});
      out[`${id}:${withLots?'lots':'plain'}`]={n:g.n,S:g.S,bytes:g.data.length,sha:sha(g.data)};
    }
  }
  const z=zonedGround(land);
  out.zoned={n:z.n,S:z.S,bytes:z.data.length,sha:sha(z.data)};
  return out;
}
// 整座場景：兩座基準城 × A／B／C 檔，旗標＝D060 的預設（villageArt、industryArt 開）；簽章含地面像素、全部網格、實例與查詢
export function sceneHashes(extra={}) {
  const out={};
  for(const id of ['seed516','ai120']) {
    const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
    out[id]={};
    for(const mode of ['a','b','c']) {
      const blocks={...d058Blocks(city,mode),villageArt:true,industryArt:true,...extra},con=new ConState(city.n);
      const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
      try {out[id][mode]={signature:signature(built),weighted:weighted(built),meshes:built.meshStats().length};}
      finally {built.dispose();con.dispose();}
    }
  }
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
  const result={baseline:D061_BASELINE,grounds:groundHashes(0),scenes:sceneHashes()};
  console.log(JSON.stringify(result,null,1));
  if(process.argv.includes('--write')) {
    const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
    assert.ok(out,'--out=PATH is required with --write');
    assert.equal(git('rev-parse','HEAD'),D061_BASELINE,'must run in the baseline commit');
    assert.equal(git('status','--porcelain','--','src'),'','src/ must be exactly the baseline commit');
    fs.writeFileSync(out,JSON.stringify(result,null,1)+'\n');
    console.error('wrote',out);
  }
}

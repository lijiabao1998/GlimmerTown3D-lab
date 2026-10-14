// D062 範圍鎖的產生器：由基線提交（git）與現行樹算出 fixtures/d062-source-before.json 與 fixtures/d062-art-scope.json。
// 每次改動 D062 的 src/ 檔案之後都要重跑，並且連同 src 一起提交；tools/d062-scope.mjs 會在載入時驗證這兩份清單。
//   node tools/d062-scope-build.mjs          只印出摘要（不寫檔）
//   node tools/d062-scope-build.mjs --write  寫入兩個 fixtures
// 做法同 D061（tools/d061-scope-build.mjs）：before＝基線提交（D061 候選 36e6935）裡 src/ 每個檔案的 SHA-256；after＝現行 src/ 每個檔案的 SHA-256；
// added／modified＝兩者的差；replacements＝每個 D062 具名區段在基線檔案裡取代的原文（逐位元組取自 git，不是手抄）；建完立刻倒轉重建基線 SHA 核對。
// D062 的區段可以在 D061 的區段裡面（最新一層在最裡面，跟 D058–D061 的疊法一樣）；D061 的 fixtures 從 D062 開始凍結，不要再 --write。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const BASELINE='36e6935f4b28a8d5af59c964b91428c10a6882ba';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
// D062 區段名 → 它在基線檔案裡取代的原文：null＝純新增；{at,lines}＝基線檔案裡以 at 開頭的那一行起算的 lines 行（at 必須恰好對到一行）
const ANCHORS={
  'src/cityView.ts':{
    'season-view-import':null,'season-option':null,'season-sync':null,
    'season-enabled':{at:'    return { mode: blockMode, streetArt:',lines:1},
  },
  'src/render/cityScene.ts':{
    'season-import':null,'season-iface':null,'season-trees-vars':null,'season-trees':null,'season-yard':null,'season-set':null,
    'season-option':{at:'export interface BlockRender {',lines:1},
    'season-city':{at:'  const gc: GroundCity = {',lines:1},
  },
  'src/render/ground.ts':{
    'season-import':null,'season-city':null,'season-key':null,'season-tile':null,
    'season-cache-type':{at:'export interface GroundCache {',lines:1},
    'season-keys-sig':{at:'export function keysAt(',lines:1},
    'season-keys':{at:'  return [k1, plates ? plates[i] : -2, landOf(c) ?',lines:1},
    'season-group-keys':{at:'export function groundKeys(',lines:5},
    'season-repaint':{at:'  for (const i of tiles) { const x = i % n',lines:1},
    'season-inc-keys':{at:'  const n = c.n, [k1, k2, k3] = groundKeys(',lines:1},
    'season-cache-full':{at:'  if (!prev || prev.n !== n || prev.S !== S || (prev.land',lines:1},
    'season-cache-cmp':{at:'    if (k1[i] === prev.k1[i] && k2[i] === prev.k2[i] && k3[i] === prev.k3[i]) continue;',lines:1},
    'season-cache-inc':{at:'  return { cache: { n, S, k1, k2, k3, data, land: landOf(c) }, painted: tiles.length',lines:1},
    'season-lot':{at:'        else { const L = GROUND.lot[lots[i]]; col = h < 0.09',lines:1},
    'season-zone':{at:'        if (zn) col = LT ? landZone(',lines:1},
  },
  'src/render/landArt.ts':{
    'season-tile-pal':null,
    'season-pal':{at:'const TEX = {',lines:6},
    'season-grass-sig':{at:'export function landGrass(',lines:1},
    'season-water-sig':{at:'export function landWater(',lines:1},
    'season-sand-sig':{at:'export function landSand(',lines:1},
    'season-zone-sig':{at:'export function landZone(',lines:1},
    'season-lot-sig':{at:'export function landLot(',lines:1},
  },
};
const pick=(old,anchor,where)=>{
  if(anchor===null)return '';
  const lines=old.split('\n').map((l,i)=>[l,i]).filter(([l])=>l.startsWith(anchor.at));
  assert.equal(lines.length,1,`${where}: anchor must match exactly one baseline line: ${anchor.at}`);
  const all=old.split('\n'),i=lines[0][1];
  return all.slice(i,i+anchor.lines).join('\n')+'\n';
};

const before={};
for(const file of git('ls-tree','-r','--name-only',BASELINE,'--','src').split('\n').filter(Boolean).sort())before[file]=sha(git('show',`${BASELINE}:${file}`));
const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile())
  .map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
const now=Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f),'utf8'))]));
const added=files.filter(f=>!(f in before)),modified=files.filter(f=>f in before&&now[f]!==before[f]);
for(const f of Object.keys(before))assert.ok(f in now,'baseline file still present: '+f);
assert.deepEqual(modified,Object.keys(ANCHORS).sort(),'modified files are exactly the files with D062 regions');

const replacements={};
for(const file of modified) {
  const current=fs.readFileSync(path.join(ROOT,file),'utf8'),old=git('show',`${BASELINE}:${file}`);
  const names=[...current.matchAll(/^[ \t]*\/\/ D062-BEGIN ([^\r\n]+)\n/gm)].map(m=>m[1]);
  assert.deepEqual([...names].sort(),Object.keys(ANCHORS[file]).sort(),file+': D062 regions in the file are exactly the anchored ones');
  replacements[file]=names.map(name=>({name,before:pick(old,ANCHORS[file][name],file+' '+name)}));
  // 倒轉重建：把每個區段換回原文，必須逐位元組等於基線檔案
  const markers=[...current.matchAll(/^[ \t]*\/\/ D062-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,names.length*2,file+': markers pair up');
  let rebuilt='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const b=markers[i],e=markers[i+1];
    assert.ok(b[1]==='BEGIN'&&e[1]==='END'&&b[2]===e[2],file+': marker pair '+b[2]);
    rebuilt+=current.slice(cursor,b.index)+replacements[file].find(r=>r.name===b[2]).before;
    cursor=e.index+e[0].length;
  }
  rebuilt+=current.slice(cursor);
  assert.equal(rebuilt,old,file+': reversing the D062 regions reproduces the baseline file byte for byte');
}
const baselineFile={baseline:BASELINE,before};
const scope={baseline:BASELINE,before,added,modified,replacements,after:now};
console.log('baseline files',Object.keys(before).length,'| added',added.join(', ')||'-','| modified',modified.join(', ')||'-');
for(const [file,list] of Object.entries(replacements))console.log(' ',file,list.map(r=>`${r.name}${r.before===''?'(+)':`(${r.before.split('\n').length-1}行)`}`).join(', '));
if(process.argv.includes('--write')) {
  fs.writeFileSync(path.join(ROOT,'fixtures/d062-source-before.json'),JSON.stringify(baselineFile,null,1)+'\n');
  fs.writeFileSync(path.join(ROOT,'fixtures/d062-art-scope.json'),JSON.stringify(scope,null,1)+'\n');
  console.log('wrote fixtures/d062-source-before.json and fixtures/d062-art-scope.json');
}

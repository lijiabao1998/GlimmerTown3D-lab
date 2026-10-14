// （D062 起這份產生器與 D061 的兩份 fixtures 凍結在 D061 候選 36e6935；之後不要再 --write，改動 src 要重跑的是 tools/d062-scope-build.mjs）
// D061 範圍鎖的產生器：由基線提交（git）與現行樹算出 fixtures/d061-source-before.json 與 fixtures/d061-art-scope.json。
// 每次改動 D061 的 src/ 檔案之後都要重跑，並且連同 src 一起提交；tools/d061-scope.mjs 會在載入時驗證這兩份清單。
//   node tools/d061-scope-build.mjs          只印出摘要（不寫檔）
//   node tools/d061-scope-build.mjs --write  寫入兩個 fixtures
// 做法：
//   before＝基線提交（D060 候選 d4cef37）裡 src/ 每個檔案的 SHA-256；after＝現行 src/ 每個檔案的 SHA-256；
//   added／modified＝兩者的差；replacements＝每個 D061 具名區段在基線檔案裡取代的原文（逐位元組取自 git，不是手抄）。
//   原文怎麼找：ANCHORS 給「基線檔案裡第一行的開頭」與行數；null＝純新增（原文是空字串）。建完立刻用倒轉重建基線 SHA 核對，抄錯一個字就會當場失敗。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const BASELINE='d4cef37ae05b1ab65c801e8f3b76a1a4d40a91e4';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
// D061 區段名 → 它在基線檔案裡取代的原文：null＝純新增；{at,lines}＝基線檔案裡以 at 開頭的那一行起算的 lines 行（at 必須恰好對到一行）
const ANCHORS={
  'src/cityView.ts':{
    'land-view-import':null,'land-level':null,'land-sky':null,
    'land-enabled':{at:'    return { mode: blockMode, streetArt:',lines:1},
  },
  'src/render/cityScene.ts':{
    'land-option':{at:'export interface BlockRender {',lines:1},
    'land-city':{at:'  const gc: GroundCity = {',lines:1},
  },
  'src/render/ground.ts':{
    'land-import':null,'land-city':null,'land-crosswalk':null,'land-tile':null,'land-road':null,
    'land-keys':{at:'  return [k1, plates ? plates[i] : -2, pipeMask(c, x, z)];',lines:1},
    'land-cache-type':{at:'export interface GroundCache {',lines:1},
    'land-cache-full':{at:'  if (!prev || prev.n !== n || prev.S !== S) {',lines:1},
    'land-cache-inc':{at:'  return { cache: { n, S, k1, k2, k3, data }, painted: tiles.length',lines:1},
    'land-lot':{at:'        if (lots[i] === 5) col =',lines:2},
    'land-water':{at:'      else if (c.ter[i] === 0) col =',lines:1},
    'land-sand':{at:'      else if (c.ter[i] === 1) col =',lines:1},
    'land-grass':{at:'        col = (u === 0 || v === 0) ? GROUND.grassLine : c.el[i]',lines:3},
  },
  'src/render/post.ts':{
    'land-sky-uniforms':null,'land-sky-mix':null,'land-sky-prop':null,'land-sky-init':null,'land-sky-set':null,
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
assert.deepEqual(modified,Object.keys(ANCHORS).sort(),'modified files are exactly the files with D061 regions');

const replacements={};
for(const file of modified) {
  const current=fs.readFileSync(path.join(ROOT,file),'utf8'),old=git('show',`${BASELINE}:${file}`);
  const names=[...current.matchAll(/^[ \t]*\/\/ D061-BEGIN ([^\r\n]+)\n/gm)].map(m=>m[1]);
  assert.deepEqual([...names].sort(),Object.keys(ANCHORS[file]).sort(),file+': D061 regions in the file are exactly the anchored ones');
  replacements[file]=names.map(name=>({name,before:pick(old,ANCHORS[file][name],file+' '+name)}));
  // 倒轉重建：把每個區段換回原文，必須逐位元組等於基線檔案
  const markers=[...current.matchAll(/^[ \t]*\/\/ D061-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,names.length*2,file+': markers pair up');
  let rebuilt='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const b=markers[i],e=markers[i+1];
    assert.ok(b[1]==='BEGIN'&&e[1]==='END'&&b[2]===e[2],file+': marker pair '+b[2]);
    rebuilt+=current.slice(cursor,b.index)+replacements[file].find(r=>r.name===b[2]).before;
    cursor=e.index+e[0].length;
  }
  rebuilt+=current.slice(cursor);
  assert.equal(rebuilt,old,file+': reversing the D061 regions reproduces the baseline file byte for byte');
}
const baselineFile={baseline:BASELINE,before};
const scope={baseline:BASELINE,before,added,modified,replacements,after:now};
console.log('baseline files',Object.keys(before).length,'| added',added.join(', ')||'-','| modified',modified.join(', ')||'-');
for(const [file,list] of Object.entries(replacements))console.log(' ',file,list.map(r=>`${r.name}${r.before===''?'(+)':`(${r.before.split('\n').length-1}行)`}`).join(', '));
if(process.argv.includes('--write')) {
  fs.writeFileSync(path.join(ROOT,'fixtures/d061-source-before.json'),JSON.stringify(baselineFile,null,1)+'\n');
  fs.writeFileSync(path.join(ROOT,'fixtures/d061-art-scope.json'),JSON.stringify(scope,null,1)+'\n');
  console.log('wrote fixtures/d061-source-before.json and fixtures/d061-art-scope.json');
}

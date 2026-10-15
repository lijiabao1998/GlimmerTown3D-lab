// D065 範圍鎖的產生器：由基線提交（git）與現行樹算出 fixtures/d065-source-before.json 與 fixtures/d065-art-scope.json。
// 每次改動 D065 的 src/ 檔案之後都要重跑，並且連同 src 一起提交；tools/d065-scope.mjs 會在載入時驗證這兩份清單。
//   node tools/d065-scope-build.mjs          只印出摘要（不寫檔）
//   node tools/d065-scope-build.mjs --write  寫入兩個 fixtures
// 做法同 D064（tools/d064-scope-build.mjs）：before＝基線提交（D064 候選 f4a1a4e；src/ 與施工提交 d7a66a2 相同）裡 src/ 每個檔案的 SHA-256；after＝現行 src/ 每個檔案的 SHA-256；
// added／modified＝兩者的差；replacements＝每個 D065 具名區段在基線檔案裡取代的原文（逐位元組取自 git，不是手抄）；建完立刻倒轉重建基線 SHA 核對。
// D065 的區段在 D063 的區段裡面（最新一層在最裡面，跟 D058–D064 的疊法一樣）；D064 的 fixtures 從 D065 開始凍結，不要再 --write。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const BASELINE='f4a1a4eb5d991c6856aacccfd51e51ee9d0b8c80';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
// D065 區段名 → 它在基線檔案裡取代的原文：null＝純新增；{at,lines}＝基線檔案裡以 at 開頭的那一行起算的 lines 行（at 必須恰好對到一行）
const ANCHORS={
  'src/render/cityScene.ts':{
    'house-imports':null,
    'house-option':{at:'export interface BlockRender {',lines:1},
    'house-mode-key':{at:'  const modeKey = ',lines:1},
    'house-select':{at:'    const frame = village || industry || commerce ? streetFrame(c, bk) : null;',lines:1},
    'house-key':{at:'    specs.push({ key: blockKey(bk, y0) + (street ?',lines:1},
    'house-draw':{at:'      if ((industry || commerce) && frame) {',lines:5},
  },
  'src/cityView.ts':{
    'house-enabled':{at:'    return { mode: blockMode, streetArt:',lines:1},
    'house-variant':null,
    'house-gt':null,
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
assert.deepEqual(modified,Object.keys(ANCHORS).sort(),'modified files are exactly the files with D065 regions');

const replacements={};
for(const file of modified) {
  const current=fs.readFileSync(path.join(ROOT,file),'utf8'),old=git('show',`${BASELINE}:${file}`);
  const names=[...current.matchAll(/^[ \t]*\/\/ D065-BEGIN ([^\r\n]+)\n/gm)].map(m=>m[1]);
  assert.deepEqual([...names].sort(),Object.keys(ANCHORS[file]).sort(),file+': D065 regions in the file are exactly the anchored ones');
  replacements[file]=names.map(name=>({name,before:pick(old,ANCHORS[file][name],file+' '+name)}));
  // 倒轉重建：把每個區段換回原文，必須逐位元組等於基線檔案
  const markers=[...current.matchAll(/^[ \t]*\/\/ D065-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,names.length*2,file+': markers pair up');
  let rebuilt='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const b=markers[i],e=markers[i+1];
    assert.ok(b[1]==='BEGIN'&&e[1]==='END'&&b[2]===e[2],file+': marker pair '+b[2]);
    rebuilt+=current.slice(cursor,b.index)+replacements[file].find(r=>r.name===b[2]).before;
    cursor=e.index+e[0].length;
  }
  rebuilt+=current.slice(cursor);
  assert.equal(rebuilt,old,file+': reversing the D065 regions reproduces the baseline file byte for byte');
}
const baselineFile={baseline:BASELINE,before};
const scope={baseline:BASELINE,before,added,modified,replacements,after:now};
console.log('baseline files',Object.keys(before).length,'| added',added.join(', ')||'-','| modified',modified.join(', ')||'-');
for(const [file,list] of Object.entries(replacements))console.log(' ',file,list.map(r=>`${r.name}${r.before===''?'(+)':`(${r.before.split('\n').length-1}行)`}`).join(', '));
if(process.argv.includes('--write')) {
  fs.writeFileSync(path.join(ROOT,'fixtures/d065-source-before.json'),JSON.stringify(baselineFile,null,1)+'\n');
  fs.writeFileSync(path.join(ROOT,'fixtures/d065-art-scope.json'),JSON.stringify(scope,null,1)+'\n');
  console.log('wrote fixtures/d065-source-before.json and fixtures/d065-art-scope.json');
}

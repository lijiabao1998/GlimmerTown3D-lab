// D066 scope builder: captures exact D065 release source and reversible D066 dispatch regions.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const BASELINE='e3cf7c3515602d5fe0dbeeaa91d8a27fc25f5e69';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
// D066 區段名 → 它在基線檔案裡取代的原文：null＝純新增；{at,lines}＝基線檔案裡以 at 開頭的那一行起算的 lines 行（at 必須恰好對到一行）
const ANCHORS={
  'src/content/kindShapes.ts':{
    'metropolis-import':null,
    'metropolis-shape':{at:'export const shapeOf =',lines:4},
  },
  'src/render/kindArt.ts':{
    'metropolis-import':null,
    'metropolis-dispatch':{at:'  try { const p = new Pen(a);',lines:1},
  },
  'src/cityView.ts':{
    'metropolis-enabled':{at:'  const civic: CivicRender =',lines:1},
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
assert.deepEqual(modified,Object.keys(ANCHORS).sort(),'modified files are exactly the files with D066 regions');

const replacements={};
for(const file of modified) {
  const current=fs.readFileSync(path.join(ROOT,file),'utf8'),old=git('show',`${BASELINE}:${file}`);
  const names=[...current.matchAll(/^[ \t]*\/\/ D066-BEGIN ([^\r\n]+)\n/gm)].map(m=>m[1]);
  assert.deepEqual([...names].sort(),Object.keys(ANCHORS[file]).sort(),file+': D066 regions in the file are exactly the anchored ones');
  replacements[file]=names.map(name=>({name,before:pick(old,ANCHORS[file][name],file+' '+name)}));
  // 倒轉重建：把每個區段換回原文，必須逐位元組等於基線檔案
  const markers=[...current.matchAll(/^[ \t]*\/\/ D066-(BEGIN|END) ([^\r\n]+)\r?\n/gm)];
  assert.equal(markers.length,names.length*2,file+': markers pair up');
  let rebuilt='',cursor=0;
  for(let i=0;i<markers.length;i+=2) {
    const b=markers[i],e=markers[i+1];
    assert.ok(b[1]==='BEGIN'&&e[1]==='END'&&b[2]===e[2],file+': marker pair '+b[2]);
    rebuilt+=current.slice(cursor,b.index)+replacements[file].find(r=>r.name===b[2]).before;
    cursor=e.index+e[0].length;
  }
  rebuilt+=current.slice(cursor);
  assert.equal(rebuilt,old,file+': reversing the D066 regions reproduces the baseline file byte for byte');
}
const baselineFile={baseline:BASELINE,before};
const scope={baseline:BASELINE,before,added,modified,replacements,after:now};
console.log('baseline files',Object.keys(before).length,'| added',added.join(', ')||'-','| modified',modified.join(', ')||'-');
for(const [file,list] of Object.entries(replacements))console.log(' ',file,list.map(r=>`${r.name}${r.before===''?'(+)':`(${r.before.split('\n').length-1}行)`}`).join(', '));
if(process.argv.includes('--write')) {
  fs.writeFileSync(path.join(ROOT,'fixtures/d066-source-before.json'),JSON.stringify(baselineFile,null,1)+'\n');
  fs.writeFileSync(path.join(ROOT,'fixtures/d066-art-scope.json'),JSON.stringify(scope,null,1)+'\n');
  console.log('wrote fixtures/d066-source-before.json and fixtures/d066-art-scope.json');
}

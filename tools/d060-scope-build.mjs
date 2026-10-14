// D060 範圍鎖的產生器：由基線提交（git）與現行樹算出 fixtures/d060-source-before.json 與 fixtures/d060-art-scope.json。
// 每次改動 D060 的 src/ 檔案之後都要重跑，並且連同 src 一起提交；tools/d060-scope.mjs 會在載入時驗證這兩份清單。
//   node tools/d060-scope-build.mjs          只印出摘要（不寫檔）
//   node tools/d060-scope-build.mjs --write  寫入兩個 fixtures
// 做法：
//   before＝基線提交裡 src/ 每個檔案的 SHA-256；after＝現行 src/ 每個檔案的 SHA-256；
//   added／modified＝兩者的差；replacements＝每個 D060 具名區段原本（D059）的位元組，取自基線檔案裡對應的 D059 區段。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';

const BASELINE='0bef78f76daa1edbbc7b2b8f80d49f0a13dc7f63';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8',maxBuffer:64*1024*1024});
// D060 區段名 → 它在基線檔案裡取代的 D059 區段名（null＝純新增，原本是空字串）。
const WRAPS={'industry-imports':null,'industry-option':'village-option','industry-mode-key':'village-mode-key','industry-blocks':'village-blocks','industry-enabled':'village-enabled'};

const before={};
for(const file of git('ls-tree','-r','--name-only',BASELINE,'--','src').split('\n').filter(Boolean).sort())before[file]=sha(git('show',`${BASELINE}:${file}`));
const files=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile())
  .map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();
const now=Object.fromEntries(files.map(f=>[f,sha(fs.readFileSync(path.join(ROOT,f),'utf8'))]));
const added=files.filter(f=>!(f in before)),modified=files.filter(f=>f in before&&now[f]!==before[f]);
for(const f of Object.keys(before))assert.ok(f in now,'baseline file still present: '+f);

const replacements={};
for(const file of modified) {
  const current=fs.readFileSync(path.join(ROOT,file),'utf8'),old=git('show',`${BASELINE}:${file}`);
  const names=[...current.matchAll(/^[ \t]*\/\/ D060-BEGIN ([^\r\n]+)\n/gm)].map(m=>m[1]);
  replacements[file]=names.map(name=>{
    assert.ok(name in WRAPS,'known D060 region: '+name);
    const wrapped=WRAPS[name];
    if(wrapped===null)return {name,before:''};
    const m=old.match(new RegExp(`^[ \\t]*// D059-BEGIN ${wrapped}\\n([\\s\\S]*?)^[ \\t]*// D059-END ${wrapped}\\n`,'m'));
    assert.ok(m,`baseline has the D059 region ${wrapped} that ${name} wraps`);
    return {name,before:m[1]};
  });
}
const baselineFile={baseline:BASELINE,before};
const scope={baseline:BASELINE,before,added,modified,replacements,after:now};
console.log('baseline files',Object.keys(before).length,'| added',added.join(', ')||'-','| modified',modified.join(', ')||'-');
for(const [file,list] of Object.entries(replacements))console.log(' ',file,list.map(r=>r.name).join(', '));
if(process.argv.includes('--write')) {
  fs.writeFileSync(path.join(ROOT,'fixtures/d060-source-before.json'),JSON.stringify(baselineFile,null,1)+'\n');
  fs.writeFileSync(path.join(ROOT,'fixtures/d060-art-scope.json'),JSON.stringify(scope,null,1)+'\n');
  console.log('wrote fixtures/d060-source-before.json and fixtures/d060-art-scope.json');
}

// Historical UI goldens keep their original background art. The complete current-art
// D049/D050 interaction suites run first and their evidence is preserved separately.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {ROOT,withBrowser} from './cdp.mjs';
import {pathToFileURL} from 'node:url';
import {d049Smoke} from './smoke-d049.mjs';
import {d050Smoke,d050CopyImageGuard} from './smoke-d050.mjs';
import {d051ImportImageGuard} from './smoke-d051.mjs';
const OUT=path.join(ROOT,'scratch/shots');
export async function d056DialogGoldens(browser,log){
 const preserved=[];
 for(const file of fs.readdirSync(OUT).filter(f=>/^D0(49|50)-.*\.(png|json)$/.test(f))){
  const target='D056-current-'+file;
  if(file.endsWith('.json')){
   const rename=v=>Array.isArray(v)?v.map(rename):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,rename(x)])):typeof v==='string'&&/^D0(49|50)-.*\.png$/.test(v)?'D056-current-'+v:v;
   fs.writeFileSync(path.join(OUT,target),JSON.stringify(rename(JSON.parse(fs.readFileSync(path.join(OUT,file),'utf8'))),null,2));
  }else fs.copyFileSync(path.join(OUT,file),path.join(OUT,target));
  preserved.push(target);
 }
 assert.ok(preserved.some(f=>f.endsWith('D049-evidence.json'))&&preserved.some(f=>f.endsWith('D050-evidence.json')),'current-art suites must run first');
 const legacyBrowser=(opt,fn)=>browser(opt,({page,open})=>fn({page,open:query=>open(query+(query?'&':'')+'britishArt=legacy')}));
 const legacyLog=(ok,name,detail)=>log(ok,'D056 historical-art '+name,detail);
 await d049Smoke(legacyBrowser,legacyLog);
 await d050Smoke(legacyBrowser,legacyLog);
 const pristine=[];const guardedLog=(ok,name,detail)=>{pristine.push(ok);log(ok,name,detail);};
 d050CopyImageGuard(guardedLog);d051ImportImageGuard(guardedLog);
 assert.deepEqual(pristine,[true,true],'both original pristine PNG guards must pass');
 const negative=[];
 for(const [file,guard] of [['D049-unsupported-after-360x740.png',d050CopyImageGuard],['D050-edited-empty-error-after-360x740.png',d051ImportImageGuard]]){
  const p=path.join(OUT,file),original=fs.readFileSync(p),mutated=Buffer.from(original);mutated[mutated.length-1]^=1;
  let rejected=false;
  try{fs.writeFileSync(p,mutated);guard(ok=>{if(!ok)rejected=true;});assert.equal(rejected,true,'original PNG guard rejects mutated bytes '+file);}
  finally{fs.writeFileSync(p,original);}
  negative.push({file,rejected});
 }
 fs.writeFileSync(path.join(OUT,'D056-dialog-goldens.json'),JSON.stringify({preservedCurrentArtEvidence:preserved,historicalArtQuery:'britishArt=legacy',originalGoldenHashesUnchanged:true,negativeControls:negative},null,2));
 log(true,'D056 current-art UI suites retained; historical dialog PNG guards reject mutations');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let bad=0;const log=(ok,n,d)=>{console.log(ok?'OK':'NG',n,d??'');if(!ok)bad++;};
 await d049Smoke(withBrowser,log);await d050Smoke(withBrowser,log);await d056DialogGoldens(withBrowser,log);process.exitCode=bad?1:0;
}

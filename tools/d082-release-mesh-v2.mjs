import {d084PriorInventory} from './d090-source.mjs';
// Mandatory independent current-mesh proofs, separate from immutable historical tests.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync}from'node:child_process';import{createHash}from'node:crypto';import{pathToFileURL}from'node:url';import{ROOT}from'./cdp.mjs';import{D083_CURRENT_PATHS}from'./d083-scope.mjs';import{releaseSourceManifest}from'./d082-release-source-v2.mjs';
const hash=f=>createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex');
export function d082ReleaseMeshV2(log=()=>{}){
 const directory=path.join(ROOT,'scratch/d082-release-mesh-v2');fs.mkdirSync(directory,{recursive:true});
 const sources=fs.readdirSync(path.join(ROOT,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(ROOT,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort();assert.deepEqual(d084PriorInventory(sources,f=>fs.readFileSync(path.join(ROOT,f),'utf8')),[...D083_CURRENT_PATHS,...Object.keys(releaseSourceManifest().added)].sort(),'exact outer current237 source inventory');const sourcePins=Object.fromEntries(sources.map(f=>[f,hash(f)])),commands=[];
 const guardNames=['build','triangulate','conform','provenance','verify','components','envelope','exterior','windows','join-contract','join-contract.test','join-reconstruct','join-envelope','join-uv','join-intersections'],guardPins=Object.fromEntries(guardNames.map(n=>{const f='tools/d082-remaining-geometry-'+n+'.mjs';return[f,hash(f)]}));
 const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('D082_'))delete env[key];
 for(const name of ['provenance','verify','components','envelope','exterior','windows','join-intersections']){
  const file=`tools/d082-remaining-geometry-${name}.mjs`,stdout=fs.openSync(path.join(directory,name+'.stdout.txt'),'w'),stderr=fs.openSync(path.join(directory,name+'.stderr.txt'),'w');let r;
  try{r=spawnSync(process.execPath,['--experimental-strip-types',file],{cwd:ROOT,env,stdio:['ignore',stdout,stderr]});}finally{fs.closeSync(stdout);fs.closeSync(stderr);}
  const row={name,file,toolSha256:hash(file),exitCode:r.status,signal:r.signal,error:r.error?.message??null,passed:r.status===0&&!r.signal&&!r.error};commands.push(row);log(row.passed,'D082 current mesh '+name,row);
 }
 for(const[f,pin]of Object.entries(sourcePins))assert.equal(hash(f),pin,'tested product sources remain unchanged');
 for(const[f,pin]of Object.entries(guardPins))assert.equal(hash(f),pin,'transitive qualification helper remains unchanged');
 for(const row of commands)assert.equal(hash(row.file),row.toolSha256,'qualification guard remains unchanged');
 const report={schema:2,passed:commands.every(r=>r.passed),sourceInventory:{actual: sources.length,historicalD083:D083_CURRENT_PATHS.length,finiteAdded:Object.keys(releaseSourceManifest().added)},sourcePins,guardPins,commands,qualification:'Current product geometry, immutable-source reproduction and U/V equivalence. Not real Chromium or release.'};fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2));return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=d082ReleaseMeshV2();console.log(JSON.stringify(r,null,2));process.exitCode=r.passed?0:1;}

// D076: independently measure the immutable published D074 tree in an isolated Git archive.
// Never import candidate source, rebuild a baseline from opt-out paths, or write older fixtures.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const D076_BASELINE='94024b6e2195f4d545de1f1af770dfbe98c1777a';
export const D076_BASELINE_SLOTS=[[131,0],[131,1],[131,2],[107,0],[107,1],[107,2],[149,0],[149,1],[149,2],[149,3]];
const sha=x=>createHash('sha256').update(x).digest('hex');
const jsonSha=x=>sha(JSON.stringify(x));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:128*1024*1024});
const sourceInventory=directory=>Object.fromEntries(fs.readdirSync(path.join(directory,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(directory,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort().map(f=>[f,sha(fs.readFileSync(path.join(directory,f)))]));
const isTarget=(k,v)=>D076_BASELINE_SLOTS.some(([a,b])=>k===a&&v===b);
async function capture(){
 const source=sourceInventory(root),expected=JSON.parse(fs.readFileSync(path.join(root,'baseline-source.json'),'utf8'));
 assert.deepEqual(source,expected,'isolated source is exactly the Git archive inventory before imports');
 assert.equal(source['src/ui/panelPress.ts'],'2e3011d22cb999a9a6d5366b229861ea6e73438259a369f82e66718a3eb4a422','immediate baseline includes exact published touch repair');
 const {drawFarmMemorialCase:draw,farmMemorialStructureSignature:structure,D074_PRIOR_MODELS,D074_SLOTS,D074_KT:KT,d074City:city,d074Blocks:blocks,d074Civic:civic}=await import('./unit-d074.mjs');
 const {signature,weighted}=await import('./d060-baseline.mjs');
 const {buildCityScene}=await import('../src/render/cityScene.ts');
 const {ConState}=await import('../src/render/construction.ts');
 const {STYLES}=await import('../src/render/styles.ts');
 const geoSig=r=>jsonSha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
 const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
 const record=r=>({cost:r.cost,sha256:geoSig(r),float64Sha256:geoBytes(r),structureSha256:structure(r)});
 const out={baseline:D076_BASELINE,provenance:'Independent isolated git archive of the immediate published D074 release; dependencies only are symlinked.',sourceSha256:sha(JSON.stringify(source)),slots:{},priorModels:{},preserved:{},treeCases:{},cities:{}};
 for(const[k,v]of D076_BASELINE_SLOTS)out.slots[k+':'+v]=record(draw(k,{v}));
 for(const key of [...Object.keys(D074_PRIOR_MODELS),...D074_SLOTS.map(([k,v])=>k+':'+v)]){const[k,v]=key.split(':').map(Number);out.priorModels[key]=record(draw(k,{v}));}
 assert.equal(Object.keys(out.priorModels).length,70,'seventy immediate prior models');
 assert.deepEqual(Object.fromEntries(D076_BASELINE_SLOTS.map(([k,v])=>[k+':'+v,out.slots[k+':'+v].cost])),Object.fromEntries(D076_BASELINE_SLOTS.map(([k,v])=>[k+':'+v,({131:100,107:94,149:60})[k]])),'published D074 measured slot ceilings');
 const preserved=createHash('sha256'),binary=createHash('sha256');let cases=0;
 for(const k of [0,...KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,KT.size(k)])){
  if(isTarget(k,v))continue;const r=draw(k,{lv,v,s});preserved.update(JSON.stringify([k,lv,v,s,geoSig(r)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(r)]));cases++;
 }
 out.preserved={cases,sha256:preserved.digest('hex'),float64Sha256:binary.digest('hex')};
 // Explicit ordered tree transforms of the previous wave span its height break and clamps.
 for(const [k,v]of D074_SLOTS.filter(([k])=>k===54||k===47))for(const s of [1,2,4])for(const H of [.12,.19,.349,.35,.7,1.7,3.7])for(const origin of [[0,0,0],[-3.125,7.375,.21]])for(let turn=0;turn<4;turn++){
  const [x0,z0,y0]=origin,r=draw(k,{v,s,H,x0,z0,y0,turn});out.treeCases[JSON.stringify([k,v,s,H,x0,z0,y0,turn])]=r.trees;
 }
 for(const v of [null,0,1,2,3]){
  const preview=v===null?'native':'v'+v;out.cities[preview]={};
  for(const sample of ['seed516','ai120','gallery']){
   const original=city(sample),world=v===null?original:{...original,buildings:original.buildings.map(b=>isTarget(b.k,v)?{...b,v}:b)};
   out.cities[preview][sample]={};
   for(const mode of ['a','b','c']){const con=new ConState(world.n),built=buildCityScene(world,KT,STYLES.A,blocks(world,mode),'d',civic(true),con,true);try{out.cities[preview][sample][mode]=[weighted(built),signature(built)];}finally{built.dispose();con.dispose();}}
  }
 }
 assert.deepEqual(sourceInventory(root),expected,'baseline source remains immutable after measurement');
 fs.writeFileSync(path.join(root,'baseline-geometry.json'),JSON.stringify(out,null,1)+'\n');
}
export async function captureD076Baseline({write=false}={}){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'glimmer-d076-baseline-'));
 try{
  const archive=path.join(temp,'archive.tar');git('archive','--output='+archive,D076_BASELINE,'src','tools','fixtures','package.json');execFileSync('tar',['-xf',archive,'-C',temp]);fs.unlinkSync(archive);
  const expected=Object.fromEntries(git('ls-tree','-r','--name-only',D076_BASELINE,'--','src').toString().trim().split('\n').sort().map(f=>[f,sha(git('show',D076_BASELINE+':'+f))]));
  assert.deepEqual(sourceInventory(temp),expected,'git archive bytes exactly equal immutable commit');
  fs.writeFileSync(path.join(temp,'baseline-source.json'),JSON.stringify(expected));
  fs.copyFileSync(fileURLToPath(import.meta.url),path.join(temp,'tools/d076-baseline.mjs'));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
  execFileSync(process.execPath,['--experimental-strip-types','tools/d076-baseline.mjs','--isolated-capture'],{cwd:temp,stdio:'inherit',maxBuffer:128*1024*1024});
  const bytes=fs.readFileSync(path.join(temp,'baseline-geometry.json')),out=JSON.parse(bytes),source={baseline:D076_BASELINE,before:expected};
  if(write){fs.writeFileSync(path.join(root,'fixtures/d076-geometry-before.json'),bytes);fs.writeFileSync(path.join(root,'fixtures/d076-source-before.json'),JSON.stringify(source,null,1)+'\n');}
  return {geometrySha256:sha(bytes),sourceFiles:Object.keys(expected).length,priorModels:Object.keys(out.priorModels).length,preservedCases:out.preserved.cases,treeCases:Object.keys(out.treeCases).length,slots:out.slots};
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.includes('--isolated-capture'))await capture();else console.log(JSON.stringify(await captureD076Baseline({write:process.argv.includes('--write')}),null,2));}

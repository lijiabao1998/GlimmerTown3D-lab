// D082: independently measure the immutable published D081 tree in an isolated Git archive.
// Never import candidate source, rebuild a baseline from opt-out paths, or write older fixtures.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const D082_BASELINE='2cd43c424dcc909dcfa6ac55275406d2bc527ce0';
export const D082_BASELINE_SLOTS=[[126,0],[126,1],[126,2],[179,0],[179,1],[179,2],[185,0],[185,1],[185,2],[154,0]];
const sha=x=>createHash('sha256').update(x).digest('hex');
const jsonSha=x=>sha(JSON.stringify(x));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:128*1024*1024});
const sourceInventory=directory=>Object.fromEntries(fs.readdirSync(path.join(directory,'src'),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(directory,path.join(e.parentPath,e.name)).replaceAll('\\','/')).sort().map(f=>[f,sha(fs.readFileSync(path.join(directory,f)))]));
const isTarget=(k,v)=>D082_BASELINE_SLOTS.some(([a,b])=>k===a&&v===b);
async function capture(){
 const source=sourceInventory(root),expected=JSON.parse(fs.readFileSync(path.join(root,'baseline-source.json'),'utf8'));
 assert.deepEqual(source,expected,'isolated source is exactly the Git archive inventory before imports');
 assert.equal(source['src/ui/panelPress.ts'],'a481a138c3a47cd1820301db30678f63bf993b6e128399e17ef0b7263a7b088b','immediate baseline includes exact published D081 touch repair');
 const {drawFieldStudyLodgeCase:draw,fieldStudyLodgeStructureSignature:structure,D081_PRIOR_MODELS,D081_SLOTS,D081_KT:KT,d081City:city,d081Blocks:blocks,d081Civic:civic}=await import('./unit-d081.mjs');
 const {signature,weighted}=await import('./d060-baseline.mjs');
 const {buildCityScene}=await import('../src/render/cityScene.ts');
 const {ConState}=await import('../src/render/construction.ts');
 const {STYLES}=await import('../src/render/styles.ts');
 const geoSig=r=>jsonSha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
 const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
 const record=r=>({cost:r.cost,sha256:geoSig(r),float64Sha256:geoBytes(r),structureSha256:structure(r)});
 const out={baseline:D082_BASELINE,provenance:'Independent isolated git archive of the immediate published D081 release; dependencies only are symlinked.',sourceSha256:sha(JSON.stringify(source)),slots:{},priorModels:{},preserved:{},treeCases:{},targetTreeCases:{},cities:{}};
 for(const[k,v]of D082_BASELINE_SLOTS)out.slots[k+':'+v]=record(draw(k,{v}));
 for(const key of [...Object.keys(D081_PRIOR_MODELS),...D081_SLOTS.map(([k,v])=>k+':'+v)]){const[k,v]=key.split(':').map(Number);out.priorModels[key]=record(draw(k,{v}));}
 assert.equal(Object.keys(out.priorModels).length,130,'one hundred thirty immediate prior models');
 assert.deepEqual(Object.fromEntries(D082_BASELINE_SLOTS.map(([k,v])=>[k+':'+v,out.slots[k+':'+v].cost])),{'126:0':56,'126:1':56,'126:2':56,'179:0':182,'179:1':182,'179:2':182,'185:0':120,'185:1':120,'185:2':120,'154:0':342},'published D081 measured slot ceilings');
 const preserved=createHash('sha256'),binary=createHash('sha256');let cases=0;
 for(const k of [0,...KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,KT.size(k)])){
  if(isTarget(k,v))continue;const r=draw(k,{lv,v,s});preserved.update(JSON.stringify([k,lv,v,s,geoSig(r)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(r)]));cases++;
 }
 out.preserved={cases,sha256:preserved.digest('hex'),float64Sha256:binary.digest('hex')};
 // Every earlier exact model is measured independently, including every ordered tree
 // transform across the original height break, clamps, sizes, origins and rotations.
 for(const [k,v]of Object.keys(out.priorModels).map(key=>key.split(':').map(Number)))for(const s of [1,2,4])for(const H of [.12,.19,.349,.35,.7,1.7,3.7])for(const origin of [[0,0,0],[-3.125,7.375,.21]])for(let turn=0;turn<4;turn++){
  const [x0,z0,y0]=origin,r=draw(k,{v,s,H,x0,z0,y0,turn});out.treeCases[JSON.stringify([k,v,s,H,x0,z0,y0,turn])]=r.trees;
 }
 // Exact target trees include the old operation ordering, signed arithmetic, sizes and rotations.
 for(const [k,v] of D082_BASELINE_SLOTS)for(const s of [1,1.5,2,3,4])for(const H of [.01,.12,.349,.35,3.7])for(const origin of [[0,0,0],[-3.125,7.375,.21],[3.125,7.375,.21],[100.125,-91.375,-.02]])for(let turn=0;turn<4;turn++){
  const [x0,z0,y0]=origin,r=draw(k,{v,s,H,x0,z0,y0,turn});out.targetTreeCases[JSON.stringify([k,v,s,H,x0,z0,y0,turn])]=r.trees;
 }
 assert.equal(Object.keys(out.targetTreeCases).length,4000,'4000 exact original target tree transforms');
 for(const v of [null,0,1,2,3,4]){
  const preview=v===null?'native':'v'+v;out.cities[preview]={};
  for(const sample of ['seed516','ai120','gallery']){
   const original=city(sample),world=v===null?original:{...original,buildings:original.buildings.map(b=>isTarget(b.k,v)?{...b,v}:b)};
   const originalBefore=jsonSha(original),worldBefore=jsonSha(world);
   out.cities[preview][sample]={};
   for(const mode of ['a','b','c']){const con=new ConState(world.n),built=buildCityScene(world,KT,STYLES.A,blocks(world,mode),'d',civic(true),con,true);try{out.cities[preview][sample][mode]=[weighted(built),signature(built)];}finally{built.dispose();con.dispose();}}
   assert.equal(jsonSha(original),originalBefore,'original world remains unchanged during every city measurement');
   assert.equal(jsonSha(world),worldBefore,'render-only preview world remains unchanged during every city measurement');
  }
 }
 assert.deepEqual(sourceInventory(root),expected,'baseline source remains immutable after measurement');
 fs.writeFileSync(path.join(root,'baseline-geometry.json'),JSON.stringify(out,null,1)+'\n');
}
export async function captureD082Baseline({write=false}={}){
 const scratch=path.join(root,'scratch/d082-baseline');fs.mkdirSync(scratch,{recursive:true});
 const temp=fs.mkdtempSync(path.join(scratch,'isolated-'));
 try{
  const archive=path.join(temp,'archive.tar');git('archive','--output='+archive,D082_BASELINE,'src','tools','fixtures','docs','package.json');execFileSync('tar',['-xf',archive,'-C',temp]);fs.unlinkSync(archive);
  const expected=Object.fromEntries(git('ls-tree','-r','--name-only',D082_BASELINE,'--','src').toString().trim().split('\n').sort().map(f=>[f,sha(git('show',D082_BASELINE+':'+f))]));
  assert.deepEqual(sourceInventory(temp),expected,'git archive bytes exactly equal immutable commit');
  const historical=Object.fromEntries(git('ls-tree','-r','--name-only',D082_BASELINE,'--','fixtures').toString().trim().split('\n').sort().map(f=>[f,sha(git('show',D082_BASELINE+':'+f))]));
  for(const [file,pin]of Object.entries(historical))assert.equal(sha(fs.readFileSync(path.join(temp,file))),pin,'all historical fixture bytes match isolated Git archive: '+file);
  fs.writeFileSync(path.join(temp,'baseline-source.json'),JSON.stringify(expected));
  fs.copyFileSync(fileURLToPath(import.meta.url),path.join(temp,'tools/d082-baseline.mjs'));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
  execFileSync(process.execPath,['--experimental-strip-types','tools/d082-baseline.mjs','--isolated-capture'],{cwd:temp,stdio:'inherit',maxBuffer:128*1024*1024});
  for(const [file,pin]of Object.entries(historical))assert.equal(sha(fs.readFileSync(path.join(temp,file))),pin,'historical fixture remains immutable after measurement: '+file);
  const bytes=fs.readFileSync(path.join(temp,'baseline-geometry.json')),out=JSON.parse(bytes),source={baseline:D082_BASELINE,before:expected};
  const sourceBytes=Buffer.from(JSON.stringify(source,null,1)+'\n'),historyBytes=Buffer.from(JSON.stringify({baseline:D082_BASELINE,fixtures:historical},null,1)+'\n');
  if(write)for(const [file,data]of [['fixtures/d082-geometry-before.json',bytes],['fixtures/d082-source-before.json',sourceBytes],['fixtures/d082-history-before.json',historyBytes]]){
   const dest=path.join(root,file);if(fs.existsSync(dest))assert.deepEqual(fs.readFileSync(dest),data,'refuse to replace an existing immutable fixture: '+file);else fs.writeFileSync(dest,data,{flag:'wx'});
  }
  return {geometrySha256:sha(bytes),sourceSha256:sha(sourceBytes),historySha256:sha(historyBytes),sourceFiles:Object.keys(expected).length,historicalFixtures:Object.keys(historical).length,priorModels:Object.keys(out.priorModels).length,preservedCases:out.preserved.cases,treeCases:Object.keys(out.treeCases).length,targetTreeCases:Object.keys(out.targetTreeCases).length,slots:out.slots};
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.includes('--isolated-capture'))await capture();else console.log(JSON.stringify(await captureD082Baseline({write:process.argv.includes('--write')}),null,2));}

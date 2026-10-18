// D066: actual production geometry, dispatch, budgets, picking and unchanged-world guards.
// Run: node tools/unit-d066.mjs. This is a Node geometry test, NOT evidence of a WebGL screenshot.
// The immutable D065 values below were measured before D066 dispatch changed (scratch/d066/D066-baseline.json).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {isD074TouchRepairAllowed} from './d074-touch-repair-scope.mjs';
import {Geo} from '../src/render/scene.ts';
import {drawKind} from '../src/render/kindArt.ts';
import {shapeOf,kindColors} from '../src/content/kindShapes.ts';
import {METROPOLIS_KINDS,METROPOLIS_BUILDINGS} from '../src/content/britishMetropolis.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058City,d058Blocks} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {assertD066Scope,d066HistoricalBytes} from './d066-scope.mjs';
import {D067_ADDED,d067HistoricalBytes} from './d067-scope.mjs';

const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const D066_BASELINE='e3cf7c3515602d5fe0dbeeaa91d8a27fc25f5e69';
export const D066_KINDS=[55,139,166,165,123,174,135,136];
export const D066_CAP={55:188,139:252,166:364,165:292,123:218,174:452,135:400,136:82};
export const D066_OLD={
 seed516:{a:[122708,'dfd2410cec37a4be160226915c252f806045079e3ea29a8873cfc25ea397267a'],b:[84712,'0fafbf8bc8a9c2b8d8954f2248abe0dc5f6edf1f8a87af9ed840ffa5f2cc7f6a'],c:[113658,'425c04d12034ccc8849839a51e6877ea1647b53e5fa8e9f932acfa5ce317b8a1']},
 ai120:{a:[92942,'4faa4fc49180f702c9dd31b1f9453fe8d94423296e7bac4b29fdd899cd1b73d3'],b:[86769,'b95138ad693df3af5fe5da4371bd566d03e6c81e335611da34d4808610426d9b'],c:[95571,'250bddeaaf0cbe99108c6ef8c39d9c23b604483ed63d36e30367ed43f85a09ad']},
 gallery:{a:[62270,'90260896bed1086e72ec304ca6d529110edab62cd2310940903e54b4c7c6a01e'],b:[63012,'e31ce641463c6cee82976cfdbcc88b9db86aa6f79465f62e4c29ec1539b3b068'],c:[63012,'e31ce641463c6cee82976cfdbcc88b9db86aa6f79465f62e4c29ec1539b3b068']},
};
export const D066_KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const d066City=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
export const d066Civic=on=>({shape:k=>shapeOf(k,true,true,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D066_KT.catColor(D066_KT.cat(k)))});
export const d066Blocks=(city,mode='c')=>({...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true,houseArt:true});
export const d066Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
export function drawMetropolisCase(k,{v=0,lv=1,s=D066_KT.size(k),x0=3.125,z0=7.375,y0=.21,owner=71,on=true}={}) {
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const H=Math.max(.12,D066_KT.height(k,lv,v)),C=kindColors(LOOKS,k,lv,D066_KT.catColor(D066_KT.cat(k)));
 const args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,true,true,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind does not mutate its input');
 return {G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,cost:d066Cost(G)};
}
export function validMetropolisGeometry(r) {
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 for(const g of r.G){
  assert.equal(g.pos.length%9,0,'complete triangles');assert.equal(g.nor.length,g.pos.length);assert.equal(g.col.length,g.pos.length);assert.equal(g.uv.length,g.pos.length/3*2);
  assert.equal(g.owners.length,g.pos.length/9);assert.equal(g.tags.length,g.owners.length);assert.ok(g.owners.every(o=>o===r.owner),'picking owner preserved');
  if(g.ext){assert.equal(g.wst.length,g.pos.length/3);assert.equal(g.wgl.length,g.pos.length);assert.equal(g.wbd.length,g.pos.length/3);}
  for(const key of ['pos','nor','col','uv','wst','wgl','wbd','tags'])assert.ok(g[key].every(Number.isFinite),key+' is finite');
  for(let t=0;t<g.pos.length;t+=9){
   const p=g.pos,ax=p[t+3]-p[t],ay=p[t+4]-p[t+1],az=p[t+5]-p[t+2],bx=p[t+6]-p[t],by=p[t+7]-p[t+1],bz=p[t+8]-p[t+2];
   const cr=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];assert.ok(Math.hypot(...cr)>1e-9,'nondegenerate triangle');
   assert.ok(cr.reduce((s,x,j)=>s+x*g.nor[t+j],0)>0,'winding agrees with normal');
  }
  for(let i=0;i<g.pos.length;i+=3){
   assert.ok(Math.abs(Math.hypot(...g.nor.slice(i,i+3))-1)<1e-6,'unit normal');
   const u=(g.pos[i]-r.x0)/r.s,v=(g.pos[i+2]-r.z0)/r.s,h=g.pos[i+1]-r.y0;
   lo[0]=Math.min(lo[0],u);hi[0]=Math.max(hi[0],u);lo[1]=Math.min(lo[1],v);hi[1]=Math.max(hi[1],v);top=Math.max(top,h);low=Math.min(low,h);
   assert.ok(u>=-1e-9&&u<=1+1e-9&&v>=-1e-9&&v<=1+1e-9,`kind ${r.k}: vertex stays in parcel (${u},${v})`);
   assert.ok(h>=-1e-9&&h<=r.H*1.05+.01,`kind ${r.k}: height ${h} within ground and table height ${r.H}`);
  }
 }
 assert.ok(top>=r.H*.85,'a real building silhouette reaches the intended height');
 for(const t of r.trees)assert.ok(Number.isFinite(t.x)&&Number.isFinite(t.z)&&t.x>=r.x0&&t.x<=r.x0+r.s&&t.z>=r.z0&&t.z<=r.z0+r.s,'tree within parcel');
 return {lo,hi,low,top};
}
// Hash each owner's real attributes, excluding only collapsed allocator holes (the same convention as sceneDigest).
function ownerContent(built){
 const owners=built.pickOwners();return built.buildingMeshes().map((mesh,mi)=>{
  const g=mesh.geometry,a=g.attributes,p=a.position.array,n=a.position.count,s=g.drawRange.start,e=Math.min(n,s+(Number.isFinite(g.drawRange.count)?g.drawRange.count:n-s)),acc=new Map();
  const keys=['position','normal','uv','color','wStyle','wGlass','wBand','aCon'].filter(k=>a[k]);
  for(let t=s/3;t<e/3;t++){
   const i=t*9,ax=p[i+3]-p[i],ay=p[i+4]-p[i+1],az=p[i+5]-p[i+2],bx=p[i+6]-p[i],by=p[i+7]-p[i+1],bz=p[i+8]-p[i+2];if(ay*bz-az*by===0&&az*bx-ax*bz===0&&ax*by-ay*bx===0)continue;
   const owner=String(owners[mi][t]??0),h=acc.get(owner)??createHash('sha256');
   for(const key of keys){const at=a[key],start=t*3*at.itemSize,arr=at.array;h.update(Buffer.from(arr.buffer,arr.byteOffset+start*arr.BYTES_PER_ELEMENT,3*at.itemSize*arr.BYTES_PER_ELEMENT));}acc.set(owner,h);
  }
  return Object.fromEntries([...acc].map(([k,h])=>[k,h.digest('hex')]));
 });
}
const ownerCost=(dg,id)=>2*((dg.meshes.walls.ownerTris[id]??0)+(dg.meshes.other.ownerTris[id]??0))+(dg.meshes.dress.ownerTris[id]??0);
function snapshot(city,mode,on){
 const con=new ConState(city.n),built=buildCityScene(city,D066_KT,STYLES.A,d066Blocks(city,mode),'d',d066Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,
  con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d066Expected(){const out={};for(const sample of ['seed516','ai120','gallery']){const city=d066City(sample),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[sample]={legacy:old.cost,metropolis:now.cost,delta:now.cost-old.cost};}return out;}
export async function d066Guards(log){
 let failed=0;const report={baseline:D066_BASELINE,qualification:'Node geometry tests only; browser captures are a separate result.',tests:[],geometryCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D066 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D066 '+name,e.stack??String(e));}};
 test('only the approved eight kinds opt in; legacy and non-target dispatch remain identical',()=>{
  assert.deepEqual([...METROPOLIS_KINDS].sort((a,b)=>a-b),[...D066_KINDS].sort((a,b)=>a-b));assert.equal(METROPOLIS_BUILDINGS.length,8);assert.equal(new Set(METROPOLIS_BUILDINGS.map(b=>b.id)).size,8);
  assert.deepEqual(METROPOLIS_BUILDINGS.map(b=>b.k),D066_KINDS);
  for(const k of [0,...D066_KT.data.kinds.map(r=>r.k),999]){const off=shapeOf(k,true,true,false),on=shapeOf(k,true,true,true);if(METROPOLIS_KINDS.has(k)){assert.notDeepEqual(on,off,`kind ${k} dispatch changes`);assert.equal(on.p.metropolis,true);}else assert.deepEqual(on,off,`kind ${k} unchanged`);assert.deepEqual(shapeOf(k,true,true),off,'fourth argument defaults off for historical guards');}
 });
 test('all kinds, variants, levels, sizes and translated origins: deterministic finite nondegenerate geometry within parcel and old budget',()=>{
  const unique=new Set();
  for(const k of D066_KINDS){let max=0,min=Infinity;const sizes=[...new Set([1,D066_KT.size(k)])];
   for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of sizes)for(const origin of [{x0:0,z0:0,y0:0},{x0:3.125,z0:7.375,y0:.21}]){
    const r=drawMetropolisCase(k,{lv,v,s,...origin}),again=drawMetropolisCase(k,{lv,v,s,...origin}),old=drawMetropolisCase(k,{lv,v,s,...origin,on:false});
    assert.equal(geoSig(r),geoSig(again),`kind ${k} v${v} exact repeat`);validMetropolisGeometry(r);assert.notEqual(geoSig(r),geoSig(old),`kind ${k} v${v} actual geometry changes`);
    assert.equal(old.cost,D066_CAP[k],'fixed legacy cost');assert.ok(r.cost>=50,`kind ${k} is not an empty/placeholder model`);assert.ok(r.cost<=old.cost,`kind ${k}: ${r.cost} <= ${old.cost} weighted triangles`);
    min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
   }
   report.costs[k]={name:D066_KT.name(k),min,max,cap:D066_CAP[k]};unique.add(sha(drawMetropolisCase(k,{s:1}).G.map(g=>g.pos)));
  }
  assert.equal(unique.size,8,'eight distinct actual silhouettes');
 });
 test('negative controls catch corrupt position, missing owner, collapsed triangle and parcel overflow',()=>{
  for(const mutation of [r=>r.G[0].pos[0]=NaN,r=>r.G[0].owners[0]=0,r=>r.G[0].pos.splice(3,3,...r.G[0].pos.slice(0,3)),r=>r.G[0].pos[0]=r.x0+r.s+1]){const r=drawMetropolisCase(55);mutation(r);assert.throws(()=>validMetropolisGeometry(r));}
 });
 test('three real cities × A/B/C: legacy signature, isolated owner changes, no world edits and zero total growth',()=>{
  let targets=0;
  for(const sample of ['seed516','ai120','gallery']){
   const city=d066City(sample),world=sha(city),wanted=city.buildings.filter(b=>METROPOLIS_KINDS.has(b.k)&&b.goneDay===undefined&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();
   for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   for(const mode of ['a','b','c']){
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=D066_OLD[sample][mode];
    assert.equal(off.cost,old[0],sample+' '+mode+' fixed old triangle count');assert.equal(off.sig,old[1],sample+' '+mode+' exact old scene signature');assert.equal(sha(city),world,'renderer did not mutate city/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground,'ground pixels unchanged');assert.deepEqual(on.dg.inst,off.dg.inst,'trees unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);
    assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${mode} mesh${mi} owner${id} byte-identical`);});
    for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile ${i}`);});
    let delta=0;for(const b of wanted){const a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.ok(n>0&&n<=a,`${sample} ${mode} kind ${b.k}: ${n} <= ${a}`);delta+=n-a;targets++;}
    assert.equal(on.cost-off.cost,delta,'whole-city difference is exactly target owners');assert.ok(on.cost<=off.cost,'zero whole-city growth');if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.equal(on.sig,off.sig,'ai120 negative control is byte-identical');
    report.cities.push({sample,mode,targets:wanted.length,before:off.cost,after:on.cost,delta:delta,worldSha256:world});
   }
  }
  assert.equal(targets,51,'nine seed buildings plus eight gallery buildings across three modes');
 });
 test('actual mesh faces pick the correct facility after production batching',()=>{
  let picks=0;const city=d066City('seed516'),con=new ConState(city.n),built=buildCityScene(city,D066_KT,STYLES.A,d066Blocks(city),'d',d066Civic(true),con,true);
  try{const ids=new Set(city.buildings.filter(b=>METROPOLIS_KINDS.has(b.k)&&b.goneDay===undefined).map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
   for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
   }for(const id of ids)assert.ok([...seen].some(s=>s.startsWith(id+':')),`facility ${id} has real pickable geometry`);assert.ok(picks>=18,'at least two arena hits per average building');
  }finally{built.dispose();con.dispose();}
 });
 test('pure procedural source and bounded source changes preserve simulation and save code',()=>{
  for(const f of ['src/content/britishMetropolis.ts','src/render/britishMetropolisArt.ts']){const s=fs.readFileSync(path.join(ROOT,f),'utf8').replace(/\/\/.*$/gm,'');for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b|\bwindow\b|\blocation\b/,/data:image|\.png|\.jpe?g|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])assert.doesNotMatch(s,re,f);}
  const allowed=new Set(['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishMetropolis.ts','src/render/britishMetropolisArt.ts']);
  const changed=execFileSync('git',['diff','--name-only',D066_BASELINE,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);
  for(const f of [...changed,...untracked])assert.ok(allowed.has(f)||D067_ADDED.has(f)||isD074TouchRepairAllowed(f),'only approved render-only source may change: '+f);
  const view=d067HistoricalBytes('src/cityView.ts');assert.match(view,/metropolisArt/,'production URL switch exists');assert.match(view,/shapeOf\([^\n]*metropolis/,'production passes fourth flag');
 });
 test('nine legacy switches each disable only this wave; SHA scope reverses to D065 and rejects source mutations',()=>{
  const view=d067HistoricalBytes('src/cityView.ts'),match=view.match(/const metropolisOn = ([^;]+);/);assert.ok(match,'exact production flag expression');
  const flags=['metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'];
  const evaluate=Function('q','return '+match[1]);assert.equal(evaluate(new URLSearchParams()),true,'default production art enabled');
  const listed=[...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]);assert.deepEqual(listed,flags,'complete legacy cascade');
  for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false,flag+' disables metropolis');assert.equal(evaluate(new URLSearchParams(flag+'=other')),true,flag+' ignores non-legacy values');}
  assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true,'unrelated rocket switch does not disable metropolis');
  for(const line of view.split('\n').filter(line=>/const towerOn|(?:village|industry|commerce|house)Art:/.test(line)))assert.ok(!line.includes('metropolisArt'),'this wave does not disable older art');
  assertD066Scope();const manifest=read('fixtures/d066-art-scope.json');
  for(const file of manifest.modified)assert.equal(createHash('sha256').update(d066HistoricalBytes(file)).digest('hex'),manifest.before[file],'exact D065 historical source');
  for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/recipes.ts','src/render/scene.ts','src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishMetropolis.ts','src/render/britishMetropolisArt.ts']){
   const mutated=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized mutation':'');
   assert.throws(()=>assertD066Scope(mutated),/exact allowed source/,'scope rejects '+target);assert.throws(()=>d066HistoricalBytes(target,mutated),/exact allowed source/,'history rejects '+target);
  }
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {failed,report}=await d066Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d066'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d066/D066-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

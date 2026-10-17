// D071: ten exact education slots, immediate published D070 budgets and read-only integration.
// Node geometry evidence only; actual WebGL captures and independent frame checks are separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {Geo} from '../src/render/scene.ts';
import {Pen,drawKind} from '../src/render/kindArt.ts';
import {shapeOf,kindColors} from '../src/content/kindShapes.ts';
import {EDUCATION_KINDS,EDUCATION_BUILDINGS} from '../src/content/britishEducation.ts';
import {drawBritishEducation} from '../src/render/britishEducationArt.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058City,d058Blocks} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {assertD071Scope,d071HistoricalBytes} from './d071-scope.mjs';
import {D072_ADDED,d072HistoricalBytes} from './d072-scope.mjs';
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const frozen=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(frozen);Object.freeze(o);}return o;};
export const D071_BASELINE='1c40e13a219adb90827acd3b60fb6b7623600b63';
export const D071_SLOTS=frozen([[32,0],[32,1],[32,2],[45,0],[45,1],[45,2],[108,0],[108,1],[108,2],[109,0]]);
export const D071_KINDS=Object.freeze([32,45,108,109]);
const isEducation=(k,v)=>D071_SLOTS.some(([a,b])=>a===k&&b===v);
const baselineBytes=fs.readFileSync(path.join(ROOT,'fixtures/d071-geometry-before.json'));
assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'e476e77842eeaa2268b68b474392c86ea1e38176deebbe11828ceab489dfd6d0','immutable isolated-D070 geometry fixture');
const BASE=frozen(JSON.parse(baselineBytes));assert.equal(BASE.baseline,D071_BASELINE);
export const D071_CAP=frozen(Object.fromEntries(Object.entries(BASE.slots).map(([slot,r])=>[slot,r.cost])));
export const D071_PRESERVED=BASE.preserved;
export const D071_OLD=BASE.cities;
export const D071_MODEL_OLD=BASE.slots;
export const D071_PRIOR_MODELS=BASE.priorModels;
export const D071_KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const d071City=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
// Match the production render-only preview. Original saves and records never change.
export function d071EducationCity(city,v=null){
 assert.ok(v===null||v===0||v===1||v===2,'supported copied education variant');
 return v===null?city:{...city,buildings:city.buildings.map(b=>EDUCATION_KINDS.has(b.k)?{...b,v:b.k===109?0:v}:b)};
}
export const d071Civic=on=>({shape:k=>shapeOf(k,true,true,true,true,true,true,true,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D071_KT.catColor(D071_KT.cat(k)))});
export const d071Blocks=(city,mode='c')=>({...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true,houseArt:true});
export const d071Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
// Binary preservation also distinguishes signed zero, which JSON signatures intentionally do not.
const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
export function drawEducationCase(k,{v=0,lv=1,s=D071_KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,D071_KT.height(k,lv,v)),owner=71,on=true,turn=0}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const C=kindColors(LOOKS,k,lv,D071_KT.catColor(D071_KT.cat(k))),args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,true,true,true,true,true,true,true,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind preserves every scalar/color input');
 const r={G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,cost:d071Cost(G)};
 // Civic kinds currently have no orientation field. These are explicit test-only quarter-turns,
 // applying the same rigid transform to positions and normals, never claiming new save semantics.
 for(let q=0;q<turn;q++)for(const g of G)for(let i=0;i<g.pos.length;i+=3){[g.pos[i],g.pos[i+2]]=[x0+s-(g.pos[i+2]-z0),z0+(g.pos[i]-x0)];[g.nor[i],g.nor[i+2]]=[-g.nor[i+2],g.nor[i]];}
 return r;
}
// Geometry identity ignores all batches/colors/normals/UVs and vertex/triangle ordering.
// Normalize actual model bounds, not parcel metadata: translating/scaling a copy inside a lot
// cannot evade this guard. Independent horizontal axes and height normalization also reject
// stretched copies; the minimum of four quarter-turn representations rejects rotated copies.
export function educationStructureSignature(r){
 const pts=r.G.flatMap(g=>g.pos),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<pts.length;i++)lo[i%3]=Math.min(lo[i%3],pts[i]),hi[i%3]=Math.max(hi[i%3],pts[i]);
 assert.ok(hi.every((n,j)=>Number.isFinite(n)&&n>lo[j]),'structure has positive finite width, depth and height');
 const encode=n=>Math.round(n*1e8),rotations=[];
 for(let turn=0;turn<4;turn++){
  const triangles=[];
  for(const g of r.G)for(let t=0;t<g.pos.length;t+=9){const vertices=[];
   for(let j=0;j<9;j+=3){let x=(g.pos[t+j]-lo[0])/(hi[0]-lo[0]),z=(g.pos[t+j+2]-lo[2])/(hi[2]-lo[2]);const h=(g.pos[t+j+1]-lo[1])/(hi[1]-lo[1]);
    for(let q=0;q<turn;q++)[x,z]=[1-z,x];vertices.push([encode(x),encode(h),encode(z)].join(','));
   }triangles.push(vertices.sort().join(';'));
  }rotations.push(triangles.sort().join('|'));
 }return sha(rotations.sort()[0]);
}
export function validEducationGeometry(r){
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 assert.equal(r.G.length,3,'exactly the existing three arenas');assert.deepEqual(r.trees,[],'these ten education slots have zero trees');
 for(const g of r.G){
  assert.equal(g.pos.length%9,0,'complete triangles');assert.equal(g.nor.length,g.pos.length,'one normal per vertex');assert.equal(g.col.length,g.pos.length,'one color per vertex');assert.equal(g.uv.length,g.pos.length/3*2,'two UV coordinates per vertex');
  assert.equal(g.owners.length,g.pos.length/9,'one owner per triangle');assert.equal(g.tags.length,g.owners.length,'one tag per triangle');assert.ok(g.owners.every(o=>o===r.owner),'picking owner preserved');
  if(g.ext){assert.equal(g.wst.length,g.pos.length/3);assert.equal(g.wgl.length,g.pos.length);assert.equal(g.wbd.length,g.pos.length/3);}else for(const key of ['wst','wgl','wbd'])assert.equal(g[key].length,0,key+' absent on non-window arena');
  for(const key of ['pos','nor','col','uv','wst','wgl','wbd','tags','owners'])assert.ok(g[key].every(Number.isFinite),key+' finite');
  for(let t=0;t<g.pos.length;t+=9){
   const p=g.pos,ax=p[t+3]-p[t],ay=p[t+4]-p[t+1],az=p[t+5]-p[t+2],bx=p[t+6]-p[t],by=p[t+7]-p[t+1],bz=p[t+8]-p[t+2],cr=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];
   const area=Math.hypot(...cr);assert.ok(area>1e-10,'nondegenerate triangle');
   for(let j=0;j<9;j+=3){const dot=cr.reduce((sum,n,i)=>sum+n*g.nor[t+j+i],0);assert.ok(dot>0,'winding agrees with every vertex normal');assert.ok(Math.abs(dot/area-1)<1e-6,'flat-production normal is perpendicular to its actual triangle');}
  }
  for(let i=0;i<g.pos.length;i+=3){
   assert.ok(Math.abs(Math.hypot(...g.nor.slice(i,i+3))-1)<1e-6,'unit normal');
   const u=(g.pos[i]-r.x0)/r.s,v=(g.pos[i+2]-r.z0)/r.s,h=g.pos[i+1]-r.y0;lo[0]=Math.min(lo[0],u);hi[0]=Math.max(hi[0],u);lo[1]=Math.min(lo[1],v);hi[1]=Math.max(hi[1],v);top=Math.max(top,h);low=Math.min(low,h);
   assert.ok(u>=-1e-9&&u<=1+1e-9&&v>=-1e-9&&v<=1+1e-9,`kind ${r.k}: vertex remains in parcel (${u},${v})`);
   assert.ok(h>=-1e-9&&h<=r.H+1e-9,`kind ${r.k}: height ${h} stays within ground and table height ${r.H}`);
  }
 }
 assert.ok(top>=r.H*.85,'real building silhouette reaches intended height');return {lo,hi,low,top};
}
// Exact typed-attribute bytes per real owner, excluding only collapsed allocator holes.
function ownerContent(built){
 const owners=built.pickOwners();return built.buildingMeshes().map((mesh,mi)=>{
  const g=mesh.geometry,a=g.attributes,p=a.position.array,n=a.position.count,s=g.drawRange.start,e=Math.min(n,s+(Number.isFinite(g.drawRange.count)?g.drawRange.count:n-s)),acc=new Map();
  const keys=['position','normal','uv','color','wStyle','wGlass','wBand','aCon'].filter(k=>a[k]);
  for(let t=s/3;t<e/3;t++){
   const i=t*9,ax=p[i+3]-p[i],ay=p[i+4]-p[i+1],az=p[i+5]-p[i+2],bx=p[i+6]-p[i],by=p[i+7]-p[i+1],bz=p[i+8]-p[i+2];if(ay*bz-az*by===0&&az*bx-ax*bz===0&&ax*by-ay*bx===0)continue;
   const owner=String(owners[mi][t]??0),h=acc.get(owner)??createHash('sha256');
   for(const key of keys){const at=a[key],start=t*3*at.itemSize,arr=at.array;h.update(Buffer.from(arr.buffer,arr.byteOffset+start*arr.BYTES_PER_ELEMENT,3*at.itemSize*arr.BYTES_PER_ELEMENT));}acc.set(owner,h);
  }return Object.fromEntries([...acc].map(([k,h])=>[k,h.digest('hex')]));
 });
}
const ownerCost=(dg,id)=>2*((dg.meshes.walls.ownerTris[id]??0)+(dg.meshes.other.ownerTris[id]??0))+(dg.meshes.dress.ownerTris[id]??0);
function snapshot(city,mode,on){
 const con=new ConState(city.n),built=buildCityScene(city,D071_KT,STYLES.A,d071Blocks(city,mode),'d',d071Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d071Expected(){const out={};for(const v of [null,0,1,2]){const key=v===null?'native':'v'+v;out[key]={};for(const sample of ['seed516','ai120','gallery']){const city=d071EducationCity(d071City(sample),v),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[key][sample]={legacy:old.cost,education:now.cost,delta:now.cost-old.cost};}}return out;}
export async function d071Guards(log=()=>{}){
 let failed=0;const report={baseline:D071_BASELINE,qualification:'Node geometry tests only; browser/WebGL captures are separate evidence.',tests:[],geometryCases:0,preservedCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D071 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D071 '+name,e.stack??String(e));}};
 test('ten exact slots on four existing kinds; ninth argument defaults off for every historical flag combination',()=>{
  assert.deepEqual([...EDUCATION_KINDS],D071_KINDS);assert.equal(EDUCATION_BUILDINGS.length,10);assert.equal(new Set(EDUCATION_BUILDINGS.map(b=>b.id)).size,10);assert.deepEqual(EDUCATION_BUILDINGS.map(b=>[b.k,b.v]),D071_SLOTS);
  for(const k of [0,...D071_KT.data.kinds.map(r=>r.k),999]){
   const off=shapeOf(k,true,true,true,true,true,true,true,false),on=shapeOf(k,true,true,true,true,true,true,true,true);
   assert.deepEqual(shapeOf(k,true,true,true,true,true,true,true),off,'ninth argument defaults off');
   if(EDUCATION_KINDS.has(k)){assert.notDeepEqual(on,off);assert.equal(on.p.education,true);assert.equal(on.p.commerceThird,true);assert.equal(on.p.commerceVariant,true);assert.equal(on.p.facility,true);}else assert.deepEqual(on,off,`non-target ${k} dispatch unchanged`);
   for(let mask=0;mask<128;mask++){const flags=Array.from({length:7},(_,i)=>Boolean(mask&(1<<i)));assert.deepEqual(shapeOf(k,...flags),shapeOf(k,...flags,false),'all 128 prior flag combinations preserve ninth-argument default');}
  }
 });
 test('strict numeric saved slots only; all rejected kinds and variants emit no direct geometry',()=>{
  for(const k of [0,...D071_KINDS,65,999,'32','45',null,undefined])for(const v of [undefined,null,-1,0,1,2,3,4,5,6,7,8,9,10,.5,1.5,2.5,'0','1','2',true,false,NaN,Infinity]){
   const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors(LOOKS,k,1,'#ffffff')},before=sha(a),accept=isEducation(k,v);
   assert.equal(drawBritishEducation(new Pen(a)),accept,`direct acceptance k${k} v${String(v)}`);if(accept)assert.ok(G.some(g=>g.pos.length));else assert.equal(sha(a),before,'rejected exact slot is a strict no-op');
  }
 });
 test('immutable immediate-D070 slot budgets, all thirty earlier models and exhaustive non-target binary attributes',()=>{
  for(const [k,v]of D071_SLOTS){const key=k+':'+v,old=drawEducationCase(k,{v,on:false}),pin=D071_MODEL_OLD[key];assert.equal(old.cost,D071_CAP[key],key+' exact preceding-wave cost');assert.equal(geoSig(old),pin.sha256,key+' exact preceding-wave arrays');assert.equal(geoBytes(old),pin.float64Sha256,key+' exact preceding-wave binary attributes');}
  for(const [key,pin]of Object.entries(D071_PRIOR_MODELS)){const [k,v]=key.split(':').map(Number),r=drawEducationCase(k,{v});assert.equal(r.cost,pin.cost,key+' exact old-model cost');assert.equal(geoSig(r),pin.sha256,key+' exact old-model arrays');assert.equal(geoBytes(r),pin.float64Sha256,key+' exact old-model binary bytes');}
  const preserved=createHash('sha256'),binary=createHash('sha256');
  for(const k of [0,...D071_KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,D071_KT.size(k)])){
   if(isEducation(k,v))continue;const off=drawEducationCase(k,{lv,v,s,on:false}),on=drawEducationCase(k,{lv,v,s});assert.equal(geoSig(on),geoSig(off),`k${k} lv${lv} v${v} s${s} exact preserved arrays`);assert.equal(geoBytes(on),geoBytes(off),`k${k} lv${lv} v${v} s${s} exact preserved binary attributes`);preserved.update(JSON.stringify([k,lv,v,s,geoSig(on)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(on)]));report.preservedCases++;
  }
  assert.equal(report.preservedCases,D071_PRESERVED.cases);assert.equal(preserved.digest('hex'),D071_PRESERVED.sha256,'all preserved cases match isolated D070');assert.equal(binary.digest('hex'),D071_PRESERVED.float64Sha256,'all preserved binary bytes, including signed zero, match isolated D070');
 });
 test('all forty models are unique after quarter-turn/translation/independent-scale/color/order normalization',()=>{
  const structures=new Map();
  for(const key of [...Object.keys(D071_PRIOR_MODELS),...D071_SLOTS.map(([k,v])=>k+':'+v)]){const [k,v]=key.split(':').map(Number),id=educationStructureSignature(drawEducationCase(k,{v,s:1}));assert.ok(!structures.has(id),`${key} cannot copy ${structures.get(id)}`);structures.set(id,key);}
  assert.equal(structures.size,40,'all thirty earlier models and ten new models are structurally distinct');
 });
 test('all exact-slot levels/heights/sizes/origins/quarter-turns preserve finite deterministic bounded geometry and strict budgets',()=>{
  for(const [k,v]of D071_SLOTS){let min=Infinity,max=0;const key=k+':'+v;for(const lv of [1,2,3])for(const s of new Set([1,D071_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D071_KT.height(k,lv,v)),Math.max(.24,D071_KT.height(k,lv,v)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={v,lv,s,H,...origin,turn},r=drawEducationCase(k,options),again=drawEducationCase(k,options),old=drawEducationCase(k,{...options,on:false});validEducationGeometry(r);assert.equal(geoBytes(r),geoBytes(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'each approved exact slot changes actual geometry');
   assert.deepEqual(r.trees,old.trees,'zero existing trees preserved');assert.equal(old.cost,D071_CAP[key],'strict immediate D070 weighted ceiling');
   // A low-budget research pavilion can be structurally substantial below fifty weighted triangles.
   assert.ok(r.cost>=12,'positive multi-face building floor within the tight 30-triangle research cap');assert.ok(r.cost<=old.cost,`${key}: ${r.cost} <= ${old.cost}`);assert.equal(educationStructureSignature(r),educationStructureSignature(drawEducationCase(k,{...options,turn:0})),'four rigid orientations preserve structural identity');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[key]={name:D071_KT.name(k),min,max,cap:D071_CAP[key]};}
 });
 test('identity rejects recolored/reordered/moved/rotated/stretched copies and detects real geometric edits',()=>{
  const original=drawEducationCase(32),expected=educationStructureSignature(original);
  for(let turn=0;turn<4;turn++){
   const copy={...original,G:original.G.slice().reverse().map(g=>({...g,pos:[],col:g.col.map(()=>.7)}))};
   original.G.slice().reverse().forEach((g,i)=>{const tris=[];for(let t=0;t<g.pos.length;t+=9){const points=[];for(let j=0;j<9;j+=3){let x=g.pos[t+j],z=g.pos[t+j+2];for(let q=0;q<turn;q++)[x,z]=[-z,x];points.push([12.3+x*2.7,-.9+g.pos[t+j+1]*.37,-8.2+z*.61]);}tris.push(points.reverse().flat());}copy.G[i].pos=tris.reverse().flat();});
   assert.equal(educationStructureSignature(copy),expected,'identity ignores parcel metadata, ordering and color');copy.G.find(g=>g.pos.length).pos[1]+=.01;assert.notEqual(educationStructureSignature(copy),expected,'real geometry edit detected');
  }
 });
 test('negative controls reject nonfinite/incomplete geometry, owner loss, collapse, overflow, wrong normals and trees',()=>{
  const arena=r=>r.G.find(g=>g.pos.length);
  for(const mutation of [r=>arena(r).pos[0]=NaN,r=>arena(r).owners[0]=0,r=>arena(r).owners.pop(),r=>arena(r).uv.pop(),r=>r.G[0].wst.push(1),r=>arena(r).tags.pop(),r=>arena(r).pos.splice(3,3,...arena(r).pos.slice(0,3)),r=>arena(r).pos[0]=r.x0+r.s+1,r=>arena(r).pos[1]=r.y0+r.H+.01,r=>arena(r).pos[1]=r.y0-.01,r=>arena(r).nor[0]=NaN,r=>arena(r).nor.splice(3,3,...arena(r).nor.slice(3,6).map(n=>-n)),r=>arena(r).nor.splice(0,3,0,0,0),r=>r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5})]){const r=drawEducationCase(32);mutation(r);assert.throws(()=>validEducationGeometry(r));}
  const tilted=drawEducationCase(32),g=arena(tilted),n=new THREE.Vector3(...g.nor.slice(0,3)),axis=Math.abs(n.y)<.8?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),tangent=axis.addScaledVector(n,-axis.dot(n)).normalize(),wrong=n.multiplyScalar(Math.SQRT1_2).addScaledVector(tangent,Math.SQRT1_2);g.nor.splice(0,3,...wrong.toArray());assert.throws(()=>validEducationGeometry(tilted),/perpendicular/,'unit normals must be perpendicular, not merely in the right hemisphere');
 });
 test('copied previews preserve original world and non-target object identity; k109 always uses supported v0',()=>{
  for(const sample of ['gallery','seed516','ai120']){const city=d071City(sample),before=sha(city);assert.equal(d071EducationCity(city,null),city,'native preview is the original object');for(const variant of [0,1,2]){const copy=d071EducationCity(city,variant);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history fields shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(EDUCATION_KINDS.has(b.k)){assert.notEqual(v,b);assert.equal(v.v,b.k===109?0:variant);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b);}}}
 });
 test('three real cities × three modes × native/v0/v1/v2 preserve all other owners with zero whole-scene growth',()=>{
  let targets=0;const covered=new Set();for(const variant of [null,0,1,2])for(const sample of ['seed516','ai120','gallery']){
   const preview=variant===null?'native':'v'+variant,source=d071City(sample),sourceHash=sha(source),city=d071EducationCity(source,variant),world=sha(city),wanted=city.buildings.filter(b=>isEducation(b.k,b.v)&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   for(const mode of ['a','b','c']){
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=D071_OLD[preview][sample][mode];assert.equal(off.cost,old[0]);assert.equal(off.sig,old[1],'immutable immediate-D070 same-world/view signature');assert.equal(sha(city),world,'renderer preserves copied city/history');assert.equal(sha(source),sourceHash,'renderer preserves original world/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground);assert.deepEqual(on.dg.inst,off.dg.inst,'tree instances unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${preview} ${mode} mesh${mi} owner${id} exact bytes`);});for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile${i} unchanged`);});
    let delta=0;for(const b of wanted){const key=b.k+':'+b.v,a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.equal(a,D071_CAP[key]);assert.ok(n>=12&&n<=a,`${key}: ${n} <= ${a}`);assert.ok(on.content.some((rows,mi)=>rows[b.id]!==off.content[mi][b.id]),'each exact target slot changes');delta+=n-a;targets++;covered.add(key);}
    assert.equal(on.cost-off.cost,delta,'whole-city delta consists of exact target owners only');assert.ok(on.cost<=off.cost);if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.deepEqual(on,off,'no-target cities exactly unchanged');report.cities.push({sample,preview,mode,targets:wanted.length,before:off.cost,after:on.cost,delta,worldSha256:sourceHash});
   }
  }assert.equal(targets,48,'four gallery owners × four previews × three modes; unchanged-city controls have no education targets');assert.equal(covered.size,10,'all ten actual kind/variant slots rendered in real copied galleries');
 });
 test('every exact-slot production-batched model has real faces that pick its owning building',()=>{
  const source=d071City('gallery'),before=sha(source),covered=new Set();let picks=0;
  for(const variant of [0,1,2])for(const mode of ['a','b','c']){const city=d071EducationCity(source,variant),con=new ConState(city.n),built=buildCityScene(city,D071_KT,STYLES.A,d071Blocks(city,mode),'d',d071Civic(true),con,true);
   try{const wanted=city.buildings.filter(b=>isEducation(b.k,b.v)&&b.goneDay===undefined),ids=new Set(wanted.map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const b of wanted){assert.ok([...seen].some(key=>key.startsWith(b.id+':')),`mode ${mode}: k${b.k} v${b.v} owner${b.id} is pickable`);covered.add(b.k+':'+b.v);}
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=36,'at least one actual hit for each four-owner forced gallery and mode');assert.equal(covered.size,10);assert.equal(sha(source),before);
 });
 test('procedural sources and reversible scope preserve simulation, saves, thirty earlier models and historical gates',()=>{
  for(const file of ['src/content/britishEducation.ts','src/render/britishEducationArt.ts']){const source=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\/\/.*$/gm,'');for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b|\bwindow\b|\blocation\b/,/data:image|\.png|\.jpe?g|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])assert.doesNotMatch(source,re,file);}
  const allowed=new Set(['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishEducation.ts','src/render/britishEducationArt.ts']),changed=execFileSync('git',['diff','--name-only',D071_BASELINE,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const file of [...changed,...untracked])assert.ok((allowed.has(file)||D072_ADDED.has(file)),'approved render-only source: '+file);
  assertD071Scope();const manifest=read('fixtures/d071-art-scope.json');for(const file of manifest.modified)assert.equal(createHash('sha256').update(d071HistoricalBytes(file)).digest('hex'),manifest.before[file],'exact published D070 historical bytes');
  for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/recipes.ts','src/render/scene.ts','src/render/cityScene.ts','src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceFacilities.ts','src/render/britishCommerceFacilityArt.ts','src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts','src/content/britishCommerceThird.ts','src/render/britishCommerceThirdArt.ts','src/content/britishEducation.ts','src/render/britishEducationArt.ts']){const mutated=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized mutation':'');assert.throws(()=>assertD071Scope(mutated),/exact allowed source/,'scope rejects '+target);assert.throws(()=>d071HistoricalBytes(target,mutated),/exact allowed source/,'historical restoration rejects '+target);}
 });
 test('fourteen legacy switches disable only this wave; copied v0/v1/v2 hook never writes saved worlds',()=>{
  const view=d072HistoricalBytes('src/cityView.ts'),match=view.match(/const educationOn = ([^;]+);/);assert.ok(match);const flags=['educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false,flag+' disables education');assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn|commerceVariantOn|commerceThirdOn)|(?:village|industry|commerce|house)Art:/.test(line)))assert.ok(!line.includes('educationArt'),'education switch never disables earlier art');assert.match(view,/shapeOf\([^\n]*facilityOn, commerceVariantOn, commerceThirdOn, educationOn\)/);assert.match(view,/educationV\(v: number \| null\)/);assert.match(view,/buildings: c\.buildings\.map\(/,'preview copies building records');assert.match(view,/educationView\(commerceThirdView\(commerceView\(towerView\(c\)\)\)\)/,'production renders explicitly copied education view');
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {failed,report}=await d071Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d071'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d071/D071-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

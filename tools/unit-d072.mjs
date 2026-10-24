import {isD082ReviewedExistingSource} from './d082-scope.mjs';
// D072: ten exact campus slots, immediate published D071 budgets and read-only integration.
// Node geometry evidence only; actual WebGL captures and independent frame checks are separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {stripTypeScriptTypes} from 'node:module';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {isD074TouchRepairAllowed} from './d074-touch-repair-scope.mjs';
import {Geo} from '../src/render/scene.ts';
import {Pen,drawKind} from '../src/render/kindArt.ts';
import {shapeOf,kindColors} from '../src/content/kindShapes.ts';
import {CAMPUS_KINDS,CAMPUS_BUILDINGS} from '../src/content/britishCampuses.ts';
import {drawBritishCampus} from '../src/render/britishCampusArt.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058City,d058Blocks} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {assertD072Scope,d072HistoricalBytes} from './d072-scope.mjs';
import {D073_ADDED,d073HistoricalBytes} from './d073-scope.mjs';
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const frozen=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(frozen);Object.freeze(o);}return o;};
export const D072_BASELINE='f689c35d8d061498779321149ccce4443f0ce6de';
export const D072_SLOTS=frozen([[109,1],[109,2],[48,0],[48,1],[48,2],[115,0],[115,1],[115,2],[31,0],[31,1]]);
export const D072_KINDS=Object.freeze([109,48,115,31]);
const isCampus=(k,v)=>D072_SLOTS.some(([a,b])=>a===k&&b===v);
const baselineBytes=fs.readFileSync(path.join(ROOT,'fixtures/d072-geometry-before.json'));
assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'f1846b2dadd3f03ab92ea430352cf4f1812acf2ab69cd4caee4ee4c57c5a58f7','immutable isolated-D071 geometry fixture');
const BASE=frozen(JSON.parse(baselineBytes));assert.equal(BASE.baseline,D072_BASELINE);
export const D072_CAP=frozen(Object.fromEntries(Object.entries(BASE.slots).map(([slot,r])=>[slot,r.cost])));
export const D072_PRESERVED=BASE.preserved;
export const D072_OLD=BASE.cities;
export const D072_MODEL_OLD=BASE.slots;
export const D072_PRIOR_MODELS=BASE.priorModels;
export const D072_KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const d072City=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
// Match the production render-only preview. Original saves and records never change.
export function d072CampusCity(city,v=null){
 assert.ok(v===null||v===0||v===1||v===2,'supported copied campus variant');
 return v===null?city:{...city,buildings:city.buildings.map(b=>isCampus(b.k,v)?{...b,v}:b)};
}
export const d072Civic=on=>({shape:k=>shapeOf(k,true,true,true,true,true,true,true,true,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D072_KT.catColor(D072_KT.cat(k)))});
export const d072Blocks=(city,mode='c')=>({...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true,houseArt:true});
export const d072Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
// Binary preservation also distinguishes signed zero, which JSON signatures intentionally do not.
const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
export function drawCampusCase(k,{v=0,lv=1,s=D072_KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,D072_KT.height(k,lv,v)),owner=71,on=true,turn=0}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const C=kindColors(LOOKS,k,lv,D072_KT.catColor(D072_KT.cat(k))),args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,true,true,true,true,true,true,true,true,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind preserves every scalar/color input');
 const r={G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,cost:d072Cost(G)};
 // Civic kinds currently have no orientation field. These are explicit test-only quarter-turns,
 // applying the same rigid transform to positions and normals, never claiming new save semantics.
 for(let q=0;q<turn;q++)for(const g of G)for(let i=0;i<g.pos.length;i+=3){[g.pos[i],g.pos[i+2]]=[x0+s-(g.pos[i+2]-z0),z0+(g.pos[i]-x0)];[g.nor[i],g.nor[i+2]]=[-g.nor[i+2],g.nor[i]];}
 return r;
}
// Geometry identity ignores all batches/colors/normals/UVs and vertex/triangle ordering.
// Normalize actual model bounds, not parcel metadata: translating/scaling a copy inside a lot
// cannot evade this guard. Independent horizontal axes and height normalization also reject
// stretched copies; the minimum of four quarter-turn representations rejects rotated copies.
export function campusStructureSignature(r){
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
export function validCampusGeometry(r){
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 assert.equal(r.G.length,3,'exactly the existing three arenas');assert.deepEqual(r.trees,[],'these ten campus slots have zero trees');
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
// Independent intended pitched volumes, including the civic portico. These pins
// describe roofs, not cameras: a low H or a screen-space occluder cannot excuse
// an absent surface. Bounds/rise remain relative to the existing parcel/table H.
export const D072_PITCHED_ROOFS=frozen([
 {k:48,v:0,id:'west-ward',roof:[.12,.28,.30,.86,.72,.18,'z']},
 {k:48,v:0,id:'middle-ward',roof:[.43,.59,.30,.92,.65,.18,'z']},
 {k:48,v:0,id:'east-ward',roof:[.74,.90,.30,.82,.80,.20,'z']},
 {k:48,v:1,id:'rear-hospital-hall',roof:[.10,.90,.10,.30,.74,.26,'x']},
 {k:48,v:2,id:'emergency-hall',roof:[.68,.92,.58,.87,.18,.06,'x']},
 {k:115,v:0,id:'civic-portico',roof:[.33,.67,.65,.811,.415,.115,'z']},
 {k:115,v:1,id:'meeting-hall',roof:[.18,.82,.39,.66,.72,.28,'x']},
 {k:115,v:2,id:'west-public-hall',roof:[.08,.31,.16,.67,.50,.22,'z']},
 {k:115,v:2,id:'rear-public-hall',roof:[.41,.81,.10,.32,.43,.18,'x']},
 {k:115,v:2,id:'east-public-hall',roof:[.69,.92,.45,.89,.67,.33,'z']},
 {k:31,v:0,id:'rear-cell-range',roof:[.15,.85,.18,.30,.72,.28,'x']},
 {k:31,v:0,id:'middle-cell-range',roof:[.15,.85,.44,.56,.66,.24,'x']},
 {k:31,v:0,id:'front-cell-range',roof:[.15,.85,.70,.82,.70,.22,'x']},
 {k:31,v:0,id:'low-gatehouse',roof:[.40,.60,.84,.94,.60,.15,'x']},
 {k:31,v:1,id:'radial-gatehouse',roof:[.40,.60,.85,.94,.50,.22,'x']},
]);
export function campusRoofTriangles(r,spec){
 const [a,b,c,d,h,rise]=spec.roof,indices=[],g=r.G[1];
 for(let t=0;t<g.pos.length/9;t++){let inside=true,raised=false;for(let j=0;j<9;j+=3){const u=(g.pos[t*9+j]-r.x0)/r.s,v=(g.pos[t*9+j+2]-r.z0)/r.s,y=(g.pos[t*9+j+1]-r.y0)/r.H;if(u<a-1e-8||u>b+1e-8||v<c-1e-8||v>d+1e-8||y<h-1e-8||y>h+rise+1e-8)inside=false;if(y>h+1e-8)raised=true;}if(inside&&raised)indices.push(t);}
 return indices;
}
export function assertCampusRoofClosure(r,spec){
 const [a,b,c,d,h,rise,axis]=spec.roof,pts=[[a,h,c],[b,h,c],[b,h,d],[a,h,d]],ridges=axis==='x'?[[a,h+rise,(c+d)/2],[b,h+rise,(c+d)/2]]:[[(a+b)/2,h+rise,c],[(a+b)/2,h+rise,d]],key=p=>p.map(n=>Math.round(n*1e8)).join(','),edge=(p,q)=>[key(p),key(q)].sort().join('|'),legal=new Set([...pts,...ridges].map(key)),boundary=new Set(pts.map((p,i)=>edge(p,pts[(i+1)%4]))),indices=campusRoofTriangles(r,spec),counts=new Map();
 assert.equal(indices.length,6,spec.id+' has four real pitched triangles and two end gables above its slab');
 for(const t of indices){const tri=[];for(let j=0;j<9;j+=3){const p=[(r.G[1].pos[t*9+j]-r.x0)/r.s,(r.G[1].pos[t*9+j+1]-r.y0)/r.H,(r.G[1].pos[t*9+j+2]-r.z0)/r.s];assert.ok(legal.has(key(p)),spec.id+' uses its actual eaves and ridge vertices');tri.push(p);}for(let j=0;j<3;j++){const e=edge(tri[j],tri[(j+1)%3]);counts.set(e,(counts.get(e)??0)+1);}}
 assert.equal(counts.size,11,spec.id+' closed triangle roof has seven joined edges and four open eaves');for(const[e,n]of counts)assert.equal(n,boundary.has(e)?1:2,spec.id+' roof has no unjoined slope or pediment edge');for(const e of boundary)assert.equal(counts.get(e),1,spec.id+' only the intended eave boundary is open');
 return indices;
}
// Quantize the independently pinned roof vertices exactly as the GPU upload does;
// otherwise steep tiny roofs at translated origins accrue avoidable float32 error.
export function assertCampusRoofCoverage(r,spec){
 const [a,b,c,d,h,rise,axis]=spec.roof,geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.G[1].pos,3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.FrontSide}));let probes=0;
 try{for(const u of [.15,.35,.65,.85])for(const v of [.2,.5,.8]){const x=a+(b-a)*u,z=c+(d-c)*v,q=axis==='x'?r.z0+r.s*z:r.x0+r.s*x,o=axis==='x'?r.z0:r.x0,lo=axis==='x'?c:a,hi=axis==='x'?d:b,ridge=Math.fround(o+r.s*(lo+hi)/2),eave=Math.fround(o+r.s*(q<ridge?lo:hi)),base=Math.fround(r.y0+r.H*h),top=Math.fround(r.y0+r.H*(h+rise)),expected=top+(base-top)*Math.abs((q-ridge)/(eave-ridge)),ray=new THREE.Raycaster(new THREE.Vector3(r.x0+r.s*x,r.y0+r.H+1,r.z0+r.s*z),new THREE.Vector3(0,-1,0)),hits=ray.intersectObject(mesh);assert.ok(hits.some(hit=>Math.abs(hit.point.y-expected)<1e-6*Math.max(1,r.H)&&hit.face.normal.y>0),spec.id+' actual front-sided roof covers its pitched volume at '+u+','+v+'; a flat cap or isolated pediment is insufficient');probes++;}return probes;}finally{geometry.dispose();mesh.material.dispose();}
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
 const con=new ConState(city.n),built=buildCityScene(city,D072_KT,STYLES.A,d072Blocks(city,mode),'d',d072Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d072Expected(){const out={};for(const v of [null,0,1,2]){const key=v===null?'native':'v'+v;out[key]={};for(const sample of ['seed516','ai120','gallery']){const city=d072CampusCity(d072City(sample),v),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[key][sample]={legacy:old.cost,campus:now.cost,delta:now.cost-old.cost};}}return out;}
export async function d072Guards(log=()=>{}){
 let failed=0;const report={baseline:D072_BASELINE,qualification:'Node geometry tests only; browser/WebGL captures are separate evidence.',tests:[],geometryCases:0,preservedCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D072 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D072 '+name,e.stack??String(e));}};
 test('ten exact slots on four existing kinds; tenth argument defaults off for every historical flag combination',()=>{
  assert.deepEqual([...CAMPUS_KINDS],D072_KINDS);assert.equal(CAMPUS_BUILDINGS.length,10);assert.equal(new Set(CAMPUS_BUILDINGS.map(b=>b.id)).size,10);assert.deepEqual(CAMPUS_BUILDINGS.map(b=>[b.k,b.v]),D072_SLOTS);
  for(const k of [0,...D072_KT.data.kinds.map(r=>r.k),999]){
   const off=shapeOf(k,true,true,true,true,true,true,true,true,false),on=shapeOf(k,true,true,true,true,true,true,true,true,true);
   assert.deepEqual(shapeOf(k,true,true,true,true,true,true,true,true),off,'tenth argument defaults off');
   if(CAMPUS_KINDS.has(k)){assert.notDeepEqual(on,off);assert.equal(on.p.campus,true);assert.equal(on.p.education,true);assert.equal(on.p.commerceThird,true);assert.equal(on.p.commerceVariant,true);assert.equal(on.p.facility,true);}else assert.deepEqual(on,off,`non-target ${k} dispatch unchanged`);
   for(let mask=0;mask<256;mask++){const flags=Array.from({length:8},(_,i)=>Boolean(mask&(1<<i)));assert.deepEqual(shapeOf(k,...flags),shapeOf(k,...flags,false),'all 256 prior flag combinations preserve tenth-argument default');}
  }
 });
 test('strict numeric saved slots only; all rejected kinds and variants emit no direct geometry',()=>{
  for(const k of [0,...D072_KINDS,65,999,'109','48','115','31',null,undefined])for(const v of [undefined,null,-1,0,1,2,3,4,5,6,7,8,9,10,.5,1.5,2.5,'0','1','2',true,false,NaN,Infinity]){
   const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors(LOOKS,k,1,'#ffffff')},before=sha(a),accept=isCampus(k,v);
   assert.equal(drawBritishCampus(new Pen(a)),accept,`direct acceptance k${k} v${String(v)}`);if(accept)assert.ok(G.some(g=>g.pos.length));else assert.equal(sha(a),before,'rejected exact slot is a strict no-op');
  }
 });
 test('immutable immediate-D071 slot budgets, all forty earlier models and exhaustive non-target binary attributes',()=>{
  for(const [k,v]of D072_SLOTS){const key=k+':'+v,old=drawCampusCase(k,{v,on:false}),pin=D072_MODEL_OLD[key];assert.equal(old.cost,D072_CAP[key],key+' exact preceding-wave cost');assert.equal(geoSig(old),pin.sha256,key+' exact preceding-wave arrays');assert.equal(geoBytes(old),pin.float64Sha256,key+' exact preceding-wave binary attributes');}
  for(const [key,pin]of Object.entries(D072_PRIOR_MODELS)){const [k,v]=key.split(':').map(Number),r=drawCampusCase(k,{v});assert.equal(r.cost,pin.cost,key+' exact old-model cost');assert.equal(geoSig(r),pin.sha256,key+' exact old-model arrays');assert.equal(geoBytes(r),pin.float64Sha256,key+' exact old-model binary bytes');}
  const preserved=createHash('sha256'),binary=createHash('sha256');
  for(const k of [0,...D072_KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,D072_KT.size(k)])){
   if(isCampus(k,v))continue;const off=drawCampusCase(k,{lv,v,s,on:false}),on=drawCampusCase(k,{lv,v,s});assert.equal(geoSig(on),geoSig(off),`k${k} lv${lv} v${v} s${s} exact preserved arrays`);assert.equal(geoBytes(on),geoBytes(off),`k${k} lv${lv} v${v} s${s} exact preserved binary attributes`);preserved.update(JSON.stringify([k,lv,v,s,geoSig(on)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(on)]));report.preservedCases++;
  }
  assert.equal(report.preservedCases,D072_PRESERVED.cases);assert.equal(preserved.digest('hex'),D072_PRESERVED.sha256,'all preserved cases match isolated D071');assert.equal(binary.digest('hex'),D072_PRESERVED.float64Sha256,'all preserved binary bytes, including signed zero, match isolated D071');
 });
 test('all fifty models are unique after quarter-turn/translation/independent-scale/color/order normalization',()=>{
  const structures=new Map();
  for(const key of [...Object.keys(D072_PRIOR_MODELS),...D072_SLOTS.map(([k,v])=>k+':'+v)]){const [k,v]=key.split(':').map(Number),id=campusStructureSignature(drawCampusCase(k,{v,s:1}));assert.ok(!structures.has(id),`${key} cannot copy ${structures.get(id)}`);structures.set(id,key);}
  assert.equal(structures.size,50,'all forty earlier models and ten new models are structurally distinct');
 });
 test('all exact-slot levels/heights/sizes/origins/quarter-turns preserve finite deterministic bounded geometry and strict budgets',()=>{
  for(const [k,v]of D072_SLOTS){let min=Infinity,max=0;const key=k+':'+v;for(const lv of [1,2,3])for(const s of new Set([1,D072_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D072_KT.height(k,lv,v)),Math.max(.24,D072_KT.height(k,lv,v)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={v,lv,s,H,...origin,turn},r=drawCampusCase(k,options),again=drawCampusCase(k,options),old=drawCampusCase(k,{...options,on:false});validCampusGeometry(r);assert.equal(geoBytes(r),geoBytes(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'each approved exact slot changes actual geometry');
   assert.deepEqual(r.trees,old.trees,'zero existing trees preserved');assert.equal(old.cost,D072_CAP[key],'strict immediate D071 weighted ceiling');
   assert.ok(r.cost>=12,'positive multi-face building floor within the immutable exact-slot cap');assert.ok(r.cost<=old.cost,`${key}: ${r.cost} <= ${old.cost}`);assert.equal(campusStructureSignature(r),campusStructureSignature(drawCampusCase(k,{...options,turn:0})),'four rigid orientations preserve structural identity');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[key]={name:D072_KT.name(k),min,max,cap:D072_CAP[key]};}
 });
 test('actual pitched-roof helper has planar slopes, true end gables and exactly the open eaves boundary',()=>{
  const source=fs.readFileSync(path.join(ROOT,'src/render/britishCampusArt.ts'),'utf8'),start=source.indexOf('function roof('),end=source.indexOf('\nfunction hall(',start);assert.ok(start>=0&&end>start,'real production roof helper is isolated');
  const at=(p,x,z,h)=>[p.X(x),p.a.y0+p.H*h,p.Z(z)],roof=Function('at','col','C','return ('+stripTypeScriptTypes(source.slice(start,end))+');')(at,x=>x,{slate:'#46545e',stone:'#d7c7a8'});
  const key=v=>v.map(n=>Math.round(n*1e10)).join(','),edgeKey=(a,b)=>[key(a),key(b)].sort().join('|');
  const validate=(faces,p,axis)=>{
   const [a,b,c,d,h,rise]=[.17,.83,.13,.77,.43,.37],A=at(p,a,c,h),B=at(p,b,c,h),D=at(p,b,d,h),E=at(p,a,d,h),ridge=axis==='x'?[at(p,a,(c+d)/2,h+rise),at(p,b,(c+d)/2,h+rise)]:[at(p,(a+b)/2,c,h+rise),at(p,(a+b)/2,d,h+rise)],corners=[A,B,D,E],legal=new Set([...corners,...ridge].map(key)),counts=new Map(),boundary=new Set(corners.map((v,i)=>edgeKey(v,corners[(i+1)%4])));
   assert.deepEqual(faces.map(f=>f.type),['slope','slope','triangle','triangle'],'two pitched slopes and two end gables');
   for(const face of faces){const pts=face.points;assert.equal(pts.length,face.type==='slope'?4:3);for(const v of pts){assert.ok(v.every(Number.isFinite));assert.ok(legal.has(key(v)),'roof uses only its four eaves and two intended ridge ends');}
    const p0=new THREE.Vector3(...pts[0]),normal=new THREE.Vector3(...pts[1]).sub(p0).cross(new THREE.Vector3(...pts[2]).sub(p0));assert.ok(normal.length()>1e-10,'nondegenerate roof face');normal.normalize();for(const v of pts)assert.ok(Math.abs(normal.dot(new THREE.Vector3(...v).sub(p0)))<1e-8,'every pitched slope is one plane');
    for(let i=0;i<pts.length;i++){const u=new THREE.Vector3(...pts[(i+1)%pts.length]).sub(new THREE.Vector3(...pts[i])),v=new THREE.Vector3(...pts[(i+2)%pts.length]).sub(new THREE.Vector3(...pts[(i+1)%pts.length]));assert.ok(u.cross(v).dot(normal)>1e-10,'ordered roof polygon is convex and never crosses a diagonal');const edge=edgeKey(pts[i],pts[(i+1)%pts.length]);counts.set(edge,(counts.get(edge)??0)+1);}
   }
   const axisIndex=axis==='x'?0:2;for(let i=0;i<2;i++){const gable=faces[2+i];assert.ok(gable.points.every(v=>Math.abs(v[axisIndex]-ridge[i][axisIndex])<1e-10),'gable is entirely on its actual end plane');assert.ok(gable.points.some(v=>key(v)===key(ridge[i])),'end gable reaches its own ridge end');assert.deepEqual(gable.away,axis==='x'?[i?1:-1,0,0]:[0,0,i?1:-1],'end-face outward hint points away from the roof');}
   assert.equal(counts.size,9,'four open eaves plus five joined roof edges');for(const [edge,n]of counts)assert.equal(n,boundary.has(edge)?1:2,'roof joins without a diagonal opening, overlap or missing end');for(const edge of boundary)assert.equal(counts.get(edge),1,'only the intended rectangular eaves remain open');
  };
  report.roofCases=0;let seed;
  for(const axis of ['x','z'])for(const s of [1,2,4])for(const H of [.12,1,3.7])for(const origin of [[0,0,0],[3.125,-7.375,.21]]){
   const faces=[],[x0,z0,y0]=origin,p={X:x=>x0+x*s,Z:z=>z0+z*s,H,a:{y0,O:{slope:(a,b,c,d,away)=>faces.push({type:'slope',points:[a,b,c,d],away}),triangle:(a,b,c,away)=>faces.push({type:'triangle',points:[a,b,c],away})}}};
   roof(p,.17,.83,.13,.77,.43,.37,undefined,undefined,axis);validate(faces,p,axis);report.roofCases++;seed??={faces,p,axis};
  }
  for(const mutate of [f=>f[2].points[1]=f[3].points[1].slice(),f=>f[0].points[3][1]+=.02,f=>[f[0].points[1],f[0].points[2]]=[f[0].points[2],f[0].points[1]],f=>f.pop(),f=>f[2].away=[0,0,1]]){const faces=structuredClone(seed.faces);mutate(faces);assert.throws(()=>validate(faces,seed.p,seed.axis),'roof-specific negative controls reject crossed/missing/wrong-end faces');}
  // These exact models consist of axis-aligned pitched halls/boxes; angled civic
  // wings, octagonal rotundas and radial prison wings are deliberately excluded.
  const axisAligned=r=>{const n=r.G[1].nor;for(let i=0;i<n.length;i+=3)assert.ok(Math.abs(n[i])<1e-8||Math.abs(n[i+2])<1e-8,'axis-aligned opaque hall faces cannot acquire diagonal horizontal normals');};
  report.productionRoofCases=0;for(const [k,v]of [[48,0],[48,1],[48,2],[115,1],[115,2],[31,0]])for(const s of [1,4])for(const H of [.12,3.7]){axisAligned(drawCampusCase(k,{v,s,H}));report.productionRoofCases++;}
  const diagonal=drawCampusCase(48),n=diagonal.G[1].nor;n.splice(0,3,Math.SQRT1_2,0,Math.SQRT1_2);assert.throws(()=>axisAligned(diagonal),/diagonal horizontal normals/,'production structural control catches a crossed-corner horizontal normal');
 });
 test('all fifteen actual pitched volumes have closed roof surfaces and front-sided coverage at every tested height',()=>{
  report.roofComponentCases=0;report.roofCoverageRays=0;
  for(const spec of D072_PITCHED_ROOFS)for(const size of [1,4])for(const H of new Set([.12,Math.max(.12,D072_KT.height(spec.k,1,spec.v)),3.7]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}]){const r=drawCampusCase(spec.k,{v:spec.v,s:size,H,...origin});assertCampusRoofClosure(r,spec);report.roofCoverageRays+=assertCampusRoofCoverage(r,spec);report.roofComponentCases++;}
  const spec=D072_PITCHED_ROOFS.find(s=>s.id==='civic-portico'),original=drawCampusCase(115,{v:0,s:1,H:1,x0:0,z0:0,y0:0}),indices=assertCampusRoofClosure(original,spec),front=indices.find(t=>[2,5,8].every(j=>Math.abs(original.G[1].pos[t*9+j]-.811)<1e-9));assert.ok(front!==undefined,'real front pediment is present');
  // Recreate the exact historical defect: retain the flat slab and one upright
  // pediment, remove only its connecting slopes and rear end. All remaining
  // triangles can still be finite/perpendicular/bounded, so topology and rays
  // must independently reject it.
  const legacy=structuredClone(original),remove=new Set(indices.filter(t=>t!==front));for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){const stride=key==='uv'?6:['owners','tags'].includes(key)?1:['wst','wbd'].includes(key)?3:9,arr=legacy.G[1][key];legacy.G[1][key]=arr.filter((_,i)=>!remove.has(Math.floor(i/stride)));}
  legacy.cost=d072Cost(legacy.G);assert.equal(legacy.cost,286,'negative control exactly recreates the pre-fix civic weighted cost');validCampusGeometry(legacy);assert.throws(()=>assertCampusRoofClosure(legacy,spec),/four real pitched triangles/,'historical lone-pediment defect fails independent closure');assert.throws(()=>assertCampusRoofCoverage(legacy,spec),/flat cap or isolated pediment/,'historical defect fails actual rays even though its flat slab exists');
  const reversed=structuredClone(original);for(const t of indices)for(let j=0;j<3;j++)[reversed.G[1].pos[t*9+3+j],reversed.G[1].pos[t*9+6+j]]=[reversed.G[1].pos[t*9+6+j],reversed.G[1].pos[t*9+3+j]];assertCampusRoofClosure(reversed,spec);assert.throws(()=>assertCampusRoofCoverage(reversed,spec),/flat cap or isolated pediment/,'closed but back-facing roof also fails actual front-sided rays');
 });
 test('identity rejects recolored/reordered/moved/rotated/stretched copies and detects real geometric edits',()=>{
  const original=drawCampusCase(48),expected=campusStructureSignature(original);
  for(let turn=0;turn<4;turn++){
   const copy={...original,G:original.G.slice().reverse().map(g=>({...g,pos:[],col:g.col.map(()=>.7)}))};
   original.G.slice().reverse().forEach((g,i)=>{const tris=[];for(let t=0;t<g.pos.length;t+=9){const points=[];for(let j=0;j<9;j+=3){let x=g.pos[t+j],z=g.pos[t+j+2];for(let q=0;q<turn;q++)[x,z]=[-z,x];points.push([12.3+x*2.7,-.9+g.pos[t+j+1]*.37,-8.2+z*.61]);}tris.push(points.reverse().flat());}copy.G[i].pos=tris.reverse().flat();});
   assert.equal(campusStructureSignature(copy),expected,'identity ignores parcel metadata, ordering and color');copy.G.find(g=>g.pos.length).pos[1]+=.01;assert.notEqual(campusStructureSignature(copy),expected,'real geometry edit detected');
  }
 });
 test('negative controls reject nonfinite/incomplete geometry, owner loss, collapse, overflow, wrong normals and trees',()=>{
  const arena=r=>r.G.find(g=>g.pos.length);
  for(const mutation of [r=>arena(r).pos[0]=NaN,r=>arena(r).owners[0]=0,r=>arena(r).owners.pop(),r=>arena(r).uv.pop(),r=>r.G[0].wst.push(1),r=>arena(r).tags.pop(),r=>arena(r).pos.splice(3,3,...arena(r).pos.slice(0,3)),r=>arena(r).pos[0]=r.x0+r.s+1,r=>arena(r).pos[1]=r.y0+r.H+.01,r=>arena(r).pos[1]=r.y0-.01,r=>arena(r).nor[0]=NaN,r=>arena(r).nor.splice(3,3,...arena(r).nor.slice(3,6).map(n=>-n)),r=>arena(r).nor.splice(0,3,0,0,0),r=>r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5})]){const r=drawCampusCase(48);mutation(r);assert.throws(()=>validCampusGeometry(r));}
  const tilted=drawCampusCase(48),g=arena(tilted),n=new THREE.Vector3(...g.nor.slice(0,3)),axis=Math.abs(n.y)<.8?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),tangent=axis.addScaledVector(n,-axis.dot(n)).normalize(),wrong=n.multiplyScalar(Math.SQRT1_2).addScaledVector(tangent,Math.SQRT1_2);g.nor.splice(0,3,...wrong.toArray());assert.throws(()=>validCampusGeometry(tilted),/perpendicular/,'unit normals must be perpendicular, not merely in the right hemisphere');
 });
 test('copied previews change only supported slots and preserve original world and unsupported records',()=>{
  for(const sample of ['gallery','seed516','ai120']){const city=d072City(sample),before=sha(city);assert.equal(d072CampusCity(city,null),city,'native preview is the original object');for(const variant of [0,1,2]){const copy=d072CampusCity(city,variant);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history fields shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(isCampus(b.k,variant)){assert.notEqual(v,b);assert.equal(v.v,variant);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b,'unsupported requested slots keep the original building record');}}}
 });
 test('actual production campus preview and hook retain unsupported slots and reject coercion',()=>{
  const view=d073HistoricalBytes('src/cityView.ts'),expression=view.match(/const campusView = \(c: City\): City => ([^\n]+);/);assert.ok(expression,'production copied-view expression is exposed');
  const preview=Function('c','campusForcedV','CAMPUS_BUILDINGS','return '+expression[1].replaceAll('campusForcedV!','campusForcedV'));
  const records=[];for(const k of [0,...D072_KINDS,32,65,999,'109','31'])for(const v of [0,1,2,7])records.push({id:records.length+1,k,v,size:2,x:4,z:6,history:[{day:3,kind:'placed'}]});
  const world=frozen({buildings:records,history:[{day:3,kind:'snapshot'}],day:9,seed:516}),before=sha(world);
  for(const v of [null,0,1,2]){const actual=preview(world,v,CAMPUS_BUILDINGS),expected=d072CampusCity(world,v);assert.deepEqual(actual,expected,'real production expression matches independent exact-slot selection');assert.equal(actual.history,world.history);assert.equal(sha(world),before);if(v===null){assert.equal(actual,world);continue;}assert.notEqual(actual,world);assert.notEqual(actual.buildings,world.buildings);for(let i=0;i<records.length;i++){const b=records[i],copy=actual.buildings[i];if(isCampus(b.k,v)){assert.notEqual(copy,b);assert.deepEqual(copy,{...b,v});assert.equal(copy.history,b.history);}else assert.equal(copy,b,'unsupported requested variant leaves the exact original record unchanged');}}
  const method=view.match(/campusV\(v: number \| null\) \{ ([^\n]+) \},/);assert.ok(method,'production public hook is exposed');
  const hook=Function('let campusForcedV=null,needsRender=false,rebuilds=0,draws=0;const rebuildScene=fresh=>{if(fresh!==true)throw new Error("preview must rebuild fresh");rebuilds++;};const draw=()=>draws++;return {call(v){'+method[1]+'},state(){return {campusForcedV,needsRender,rebuilds,draws};}};')();
  for(const v of [0,1,2,null]){const was=hook.state();assert.equal(hook.call(v),v);assert.deepEqual(hook.state(),{campusForcedV:v,needsRender:true,rebuilds:was.rebuilds+1,draws:was.draws+1});}
  for(const v of [undefined,-1,3,.5,'0','1','2',true,false,NaN,Infinity]){const was=hook.state();assert.throws(()=>hook.call(v),/supports saved variants/);assert.deepEqual(hook.state(),was,'invalid request cannot update preview state or rebuild');if(v===undefined)assert.equal(d072CampusCity(world,v),world,'omitted helper variant means native');else assert.throws(()=>d072CampusCity(world,v),'independent copied preview rejects invalid input');}
 });
 test('three real cities × three modes × native/v0/v1/v2 preserve all other owners with zero whole-scene growth',()=>{
  let targets=0;const covered=new Set();for(const variant of [null,0,1,2])for(const sample of ['seed516','ai120','gallery']){
   const preview=variant===null?'native':'v'+variant,source=d072City(sample),sourceHash=sha(source),city=d072CampusCity(source,variant),world=sha(city),wanted=city.buildings.filter(b=>isCampus(b.k,b.v)&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   for(const mode of ['a','b','c']){
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=D072_OLD[preview][sample][mode];assert.equal(off.cost,old[0]);assert.equal(off.sig,old[1],'immutable immediate-D071 same-world/view signature');assert.equal(sha(city),world,'renderer preserves copied city/history');assert.equal(sha(source),sourceHash,'renderer preserves original world/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground);assert.deepEqual(on.dg.inst,off.dg.inst,'tree instances unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${preview} ${mode} mesh${mi} owner${id} exact bytes`);});for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile${i} unchanged`);});
    let delta=0;for(const b of wanted){const key=b.k+':'+b.v,a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.equal(a,D072_CAP[key]);assert.ok(n>=12&&n<=a,`${key}: ${n} <= ${a}`);assert.ok(on.content.some((rows,mi)=>rows[b.id]!==off.content[mi][b.id]),'each exact target slot changes');delta+=n-a;targets++;covered.add(key);}
    assert.equal(on.cost-off.cost,delta,'whole-city delta consists of exact target owners only');assert.ok(on.cost<=off.cost);if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.deepEqual(on,off,'no-target cities exactly unchanged');report.cities.push({sample,preview,mode,targets:wanted.length,before:off.cost,after:on.cost,delta,worldSha256:sourceHash});
   }
  }assert.equal(targets,42,'native/v0 have three targets; v1/v2 have four targets; all three modes and both unchanged-city controls covered');assert.equal(covered.size,10,'all ten actual kind/variant slots rendered in real copied galleries');
 });
 test('every exact-slot production-batched model has real faces that pick its owning building',()=>{
  const source=d072City('gallery'),before=sha(source),covered=new Set();let picks=0;
  for(const variant of [0,1,2])for(const mode of ['a','b','c']){const city=d072CampusCity(source,variant),con=new ConState(city.n),built=buildCityScene(city,D072_KT,STYLES.A,d072Blocks(city,mode),'d',d072Civic(true),con,true);
   try{const wanted=city.buildings.filter(b=>isCampus(b.k,b.v)&&b.goneDay===undefined),ids=new Set(wanted.map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const b of wanted){assert.ok([...seen].some(key=>key.startsWith(b.id+':')),`mode ${mode}: k${b.k} v${b.v} owner${b.id} is pickable`);covered.add(b.k+':'+b.v);}
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=33,'at least one actual hit for each supported forced-gallery target in all three modes');assert.equal(covered.size,10);assert.equal(sha(source),before);
 });
 test('procedural sources and reversible scope preserve simulation, saves, forty earlier models and historical gates',()=>{
  for(const file of ['src/content/britishCampuses.ts','src/render/britishCampusArt.ts']){const source=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\/\/.*$/gm,'');for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b|\bwindow\b|\blocation\b/,/data:image|\.png|\.jpe?g|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])assert.doesNotMatch(source,re,file);}
  const allowed=new Set(['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCampuses.ts','src/render/britishCampusArt.ts']),changed=execFileSync('git',['diff','--name-only',D072_BASELINE,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const file of [...changed,...untracked])assert.ok((allowed.has(file)||D073_ADDED.has(file)||isD074TouchRepairAllowed(file)||isD082ReviewedExistingSource(file)),'approved render-only source: '+file);
  assertD072Scope();const manifest=read('fixtures/d072-art-scope.json');for(const file of manifest.modified)assert.equal(createHash('sha256').update(d072HistoricalBytes(file)).digest('hex'),manifest.before[file],'exact published D071 historical bytes');
  for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/recipes.ts','src/render/scene.ts','src/render/cityScene.ts','src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceFacilities.ts','src/render/britishCommerceFacilityArt.ts','src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts','src/content/britishCommerceThird.ts','src/render/britishCommerceThirdArt.ts','src/content/britishEducation.ts','src/render/britishEducationArt.ts','src/content/britishCampuses.ts','src/render/britishCampusArt.ts']){const mutated=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized mutation':'');assert.throws(()=>assertD072Scope(mutated),/exact allowed source/,'scope rejects '+target);assert.throws(()=>d072HistoricalBytes(target,mutated),/exact allowed source/,'historical restoration rejects '+target);}
 });
 test('fifteen legacy switches disable only this wave; copied v0/v1/v2 hook never writes saved worlds',()=>{
  const view=d073HistoricalBytes('src/cityView.ts'),match=view.match(/const campusOn = ([^;]+);/);assert.ok(match);const flags=['campusArt','educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false,flag+' disables campus');assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn|commerceVariantOn|commerceThirdOn|educationOn)|(?:village|industry|commerce|house)Art:/.test(line)))assert.ok(!line.includes('campusArt'),'campus switch never disables earlier art');assert.match(view,/shapeOf\([^\n]*facilityOn, commerceVariantOn, commerceThirdOn, educationOn, campusOn\)/);assert.match(view,/campusV\(v: number \| null\)/);assert.match(view,/buildings: c\.buildings\.map\(/,'preview copies building records');assert.match(view,/campusView\(educationView\(commerceThirdView\(commerceView\(towerView\(c\)\)\)\)\)/,'production renders explicitly copied campus view');
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {failed,report}=await d072Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d072'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d072/D072-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

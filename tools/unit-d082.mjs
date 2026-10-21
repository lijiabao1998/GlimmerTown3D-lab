// D082 production integration guards. Immutable release evidence is independent of candidate source.
// Detailed architectural topology is additionally qualified by tools/d082/geometry-test.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {runGeometryTests} from './d082/geometry-test.mjs';
import {d082ScopeGuards} from './unit-d082-scope.mjs';
import {Geo} from '../src/render/scene.ts';
import {Pen,drawKind} from '../src/render/kindArt.ts';
import {shapeOf,kindColors} from '../src/content/kindShapes.ts';
import {MODELS,COASTAL_RECREATION_KINDS} from '../src/content/britishCoastalRecreation.ts';
import {drawBritishCoastalRecreation} from '../src/render/britishCoastalRecreationArt.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {signature,weighted} from './d060-baseline.mjs';
import {D081_KT,d081City,d081Blocks,fieldStudyLodgeStructureSignature as structure} from './unit-d081.mjs';
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const frozen=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(frozen);Object.freeze(o);}return o;};
export const D082_BASELINE='2cd43c424dcc909dcfa6ac55275406d2bc527ce0';
export const D082_SLOTS=frozen([[126,0],[126,1],[126,2],[179,0],[179,1],[179,2],[185,0],[185,1],[185,2],[154,0]]);
export const D082_KINDS=Object.freeze([126,179,185,154]);
const isCoastalRecreation=(k,v)=>D082_SLOTS.some(([a,b])=>a===k&&b===v);
for(const [file,pin]of Object.entries({'geometry':'98f9d7d0bdb219fe4fe1ff2cfd1791f04b49fcc5e62da2833bef6dfeb228ae68','source':'d1397602beaa64bfc15397048ebd4444803179617a7d46df49766f9114a46213','history':'2c6228f59fcec71298c1badb81314f9db338532a8f0b728364d652994dd94878'}))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT,`fixtures/d082-${file}-before.json`))).digest('hex'),pin,'independent immutable D081 '+file);
const BASE=frozen(read('fixtures/d082-geometry-before.json'));assert.equal(BASE.baseline,D082_BASELINE);assert.equal(BASE.sourceSha256,sha(read('fixtures/d082-source-before.json').before));
export const D082_CAP=frozen(Object.fromEntries(Object.entries(BASE.slots).map(([k,v])=>[k,v.cost])));
assert.deepEqual(D082_CAP,{'126:0':56,'126:1':56,'126:2':56,'179:0':182,'179:1':182,'179:2':182,'185:0':120,'185:1':120,'185:2':120,'154:0':342});
export const D082_PRIOR_MODELS=BASE.priorModels;
export const D082_KT=D081_KT;
export const d082City=d081City;
export const d082Blocks=d081Blocks;
const LOOKS=read('src/content/lab-looks.json').looks;
const oldFlags=Array(17).fill(true);
export const d082Civic=on=>({shape:k=>shapeOf(k,...oldFlags,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D082_KT.catColor(D082_KT.cat(k)))});
export function d082CoastalCity(city,v=null){assert.ok(v===null||v===0||v===1||v===2,'supported copied coastalRecreation variant');return v===null?city:{...city,buildings:city.buildings.map(b=>isCoastalRecreation(b.k,v)?{...b,v}:b)};}
export const d082Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
export function drawCoastalRecreationCase(k,{v=0,lv=1,s=D082_KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,D082_KT.height(k,lv,v)),owner=71,on=true,turn=0}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const C=kindColors(LOOKS,k,lv,D082_KT.catColor(D082_KT.cat(k))),args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,...oldFlags,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind preserves every scalar/color input');
 const r={G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,turn,cost:d082Cost(G)};
 // Civic kinds currently have no orientation field. These are explicit test-only quarter-turns,
 // applying the same rigid transform to positions and normals, never claiming new save semantics.
 for(let q=0;q<turn;q++)for(const g of G)for(let i=0;i<g.pos.length;i+=3){[g.pos[i],g.pos[i+2]]=[x0+s-(g.pos[i+2]-z0),z0+(g.pos[i]-x0)];[g.nor[i],g.nor[i+2]]=[-g.nor[i+2],g.nor[i]];}
 for(let q=0;q<turn;q++)for(const tree of trees)[tree.x,tree.z]=[x0+s-(tree.z-z0),z0+(tree.x-x0)];
 return r;
}
export function validCoastalRecreationGeometry(r){
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 assert.equal(r.G.length,3,'exactly the existing three arenas');assert.equal(r.trees.length,0,'every new target is tree-free');
 const treePin=BASE.targetTreeCases[JSON.stringify([r.k,r.v,r.s,r.H,r.x0,r.z0,r.y0,r.turn??0])];if(treePin)assert.deepEqual(r.trees,treePin,'ordered tree transforms equal isolated published release');
 assert.deepEqual(r.trees,[],'all ordered trees equal independent legacy formula for current height, size and rigid transform');
 for(const tree of r.trees)assert.ok(Object.values(tree).every(Number.isFinite),'finite tree transform');
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
export function assertCoastalRecreationBudget(r){const cap=D082_CAP[r.k+':'+r.v];assert.equal(r.cost,d082Cost(r.G));assert.ok(r.cost>=12&&r.cost<=cap,`weighted geometry ${r.cost} exceeds immutable cap ${cap}`);return r.cost;}
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
 const con=new ConState(city.n),built=buildCityScene(city,D082_KT,STYLES.A,d082Blocks(city,mode),'d',d082Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d082Expected(){const out={};for(const v of [null,0,1,2]){const key=v===null?'native':'v'+v;out[key]={};for(const sample of ['seed516','ai120','gallery']){const city=d082CoastalCity(d082City(sample),v),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[key][sample]={legacy:old.cost,coastalRecreation:now.cost,delta:now.cost-old.cost};}}return out;}
export async function d082Guards(log=()=>{}){
 let failed=0;const sourceFiles=['src/content/britishCoastalRecreation.ts','src/render/britishCoastalRecreationArt.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/cityView.ts','tools/unit-d082.mjs'],sourcePins=Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex')]));
 const report={baseline:D082_BASELINE,qualification:'Production Node integration only; architectural topology and browser/WebGL evidence are separate gates.',sourcePins,tests:[],geometryCases:0,preservedCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D082 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D082 '+name,e.stack??String(e));}};
 test('complete independent architecture topology, partitions and missing/reversed controls',()=>{report.architecture=runGeometryTests();assert.equal(report.architecture.passed,true);});
 test('complete fail-closed historical source restoration and inventory',()=>{report.scope=d082ScopeGuards();assert.equal(report.scope.passed,true);});
 test('ten exact numeric slots and appended default-off dispatch',()=>{
  assert.deepEqual([...COASTAL_RECREATION_KINDS],D082_KINDS);assert.equal(MODELS.length,10);assert.deepEqual(MODELS.map(m=>[m.k,m.v]),D082_SLOTS);
  const dimensions=[[.94,1],[.47,1],[.42,1],[.78,1],[.66,1],[.56,1],[1.48,1],[.88,1],[.91,1],[.33,4]];for(const[m,i]of MODELS.map((m,i)=>[m,i])){assert.deepEqual([m.H,m.size],dimensions[i]);assert.deepEqual([D082_KT.height(m.k,1,m.v),D082_KT.size(m.k)],dimensions[i]);const r=drawCoastalRecreationCase(m.k,{v:m.v});assert.deepEqual([r.H,r.s],dimensions[i]);}report.actualInheritedDimensions=dimensions;
  for(const k of [0,...D082_KT.data.kinds.map(r=>r.k),999]){const off=shapeOf(k,...oldFlags,false),on=shapeOf(k,...oldFlags,true);assert.deepEqual(shapeOf(k,...oldFlags),off);if(D082_KINDS.includes(k)){assert.deepEqual(on,{...off,p:{...off.p,coastalRecreation:true}});}else assert.deepEqual(on,off);}
  for(let mask=0;mask<131072;mask++){const flags=Array.from({length:17},(_,i)=>Boolean(mask&(1<<i)));for(const k of D082_KINDS)assert.deepEqual(shapeOf(k,...flags),shapeOf(k,...flags,false),'every historical flag combination defaults new flag off');}
 });
 test('strict direct dispatch rejects unsupported or coerced saved values without mutation',()=>{
  for(const k of [0,...D082_KINDS,160,182,72,999,'126','179','185','154',null,undefined])for(const v of [undefined,null,-1,0,1,2,3,4,8,9,.5,'0','1','2',true,false,NaN,Infinity]){const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors(LOOKS,k,1,'#ffffff')},before=sha(a),accept=isCoastalRecreation(k,v);assert.equal(drawBritishCoastalRecreation(new Pen(a)),accept);if(accept)assert.ok(G.some(g=>g.pos.length));else assert.equal(sha(a),before,'rejected direct slot is strict no-op');}
 });
 test('direct rendering preserves caller-owned window style state and inputs',()=>{
  for(const[k,v]of D082_SLOTS){const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],C=kindColors(LOOKS,k,1,'#ffffff'),a={W:G[0],O:G[1],D:G[2],trees,x0:-3.125,z0:7.375,y0:.21,s:2,H:.71,k,v,C};G[0].style=7;G[0].glass=new THREE.Color('#315579');G[0].band=.31;const before=[G[0].style,G[0].glass,G[0].band],inputs=sha([a.x0,a.z0,a.y0,a.s,a.H,a.k,a.v,a.C]);assert.equal(drawBritishCoastalRecreation(new Pen(a)),true);assert.equal(sha([a.x0,a.z0,a.y0,a.s,a.H,a.k,a.v,a.C]),inputs);assert.equal(G[0].style,before[0]);assert.equal(G[0].glass,before[1]);assert.equal(G[0].band,before[2]);}
 });
 test('immutable immediate-D081 slot budgets, all one hundred thirty earlier models and exhaustive non-target binary attributes',()=>{
  for(const [k,v]of D082_SLOTS){const key=k+':'+v,old=drawCoastalRecreationCase(k,{v,on:false}),pin=BASE.slots[key];assert.equal(old.cost,D082_CAP[key],key+' exact preceding-wave cost');assert.equal(geoSig(old),pin.sha256,key+' exact preceding-wave arrays');assert.equal(geoBytes(old),pin.float64Sha256,key+' exact preceding-wave binary attributes');}
  for(const [key,pin]of Object.entries(D082_PRIOR_MODELS)){const [k,v]=key.split(':').map(Number),r=drawCoastalRecreationCase(k,{v});assert.equal(r.cost,pin.cost,key+' exact old-model cost');assert.equal(geoSig(r),pin.sha256,key+' exact old-model arrays');assert.equal(geoBytes(r),pin.float64Sha256,key+' exact old-model binary bytes');assert.equal(structure(r),pin.structureSha256,key+' exact prior normalized structure');}
  const preserved=createHash('sha256'),binary=createHash('sha256');
  for(const k of [0,...D082_KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,D082_KT.size(k)])){
   if(isCoastalRecreation(k,v))continue;const off=drawCoastalRecreationCase(k,{lv,v,s,on:false}),on=drawCoastalRecreationCase(k,{lv,v,s});assert.equal(geoSig(on),geoSig(off),`k${k} lv${lv} v${v} s${s} exact preserved arrays`);assert.equal(geoBytes(on),geoBytes(off),`k${k} lv${lv} v${v} s${s} exact preserved binary attributes`);preserved.update(JSON.stringify([k,lv,v,s,geoSig(on)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(on)]));report.preservedCases++;
  }
  assert.equal(report.preservedCases,BASE.preserved.cases);assert.equal(preserved.digest('hex'),BASE.preserved.sha256,'all preserved cases match isolated D081');assert.equal(binary.digest('hex'),BASE.preserved.float64Sha256,'all preserved binary bytes, including signed zero, match isolated D081');
 });
 test('all exact-slot levels/heights/sizes/origins/quarter-turns preserve finite deterministic bounded geometry and strict budgets',()=>{
  for(const [k,v]of D082_SLOTS){let min=Infinity,max=0;const key=k+':'+v;for(const lv of [1,2,3])for(const s of new Set([1,D082_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D082_KT.height(k,lv,v)),Math.max(.24,D082_KT.height(k,lv,v)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={v,lv,s,H,...origin,turn},r=drawCoastalRecreationCase(k,options),again=drawCoastalRecreationCase(k,options),old=drawCoastalRecreationCase(k,{...options,on:false});validCoastalRecreationGeometry(r);assertCoastalRecreationBudget(r);assert.equal(geoBytes(r),geoBytes(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'each approved exact slot changes actual geometry');
   assert.deepEqual(r.trees,old.trees,'all ordered existing trees preserved');assert.equal(old.cost,D082_CAP[key],'strict immediate D081 weighted ceiling');
   assert.ok(r.cost>=12,'positive multi-face building floor within the immutable exact-slot cap');assert.ok(r.cost<=old.cost,`${key}: ${r.cost} <= ${old.cost}`);assert.equal(structure(r),structure(drawCoastalRecreationCase(k,{...options,turn:0})),'four rigid orientations preserve structural identity');assert.equal(structure(r),structure(drawCoastalRecreationCase(k,{v,s:1,H:1,x0:0,z0:0,y0:0})),'origin, parcel and inherited height are pure independent transforms');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[key]={name:D082_KT.name(k),min,max,cap:D082_CAP[key]};}
 });
 test('all 130 prior models and ten new W/O architectures remain distinct',()=>{for(const architectureOnly of [false,true]){const signatures=new Map();for(const key of [...Object.keys(BASE.priorModels),...D082_SLOTS.map(s=>s.join(':'))]){const[k,v]=key.split(':').map(Number),id=structure(drawCoastalRecreationCase(k,{v,s:1}),{architectureOnly});assert.ok(!signatures.has(id),key+' duplicates '+signatures.get(id));signatures.set(id,key);}assert.equal(signatures.size,140);}});
 test('all 21840 prior ordered tree transforms and 4000 target transforms remain exact',()=>{
  for(const field of ['treeCases','targetTreeCases']){let count=0;for(const [key,expected]of Object.entries(BASE[field])){const[k,v,s,H,x0,z0,y0,turn]=JSON.parse(key);assert.deepEqual(drawCoastalRecreationCase(k,{v,s,H,x0,z0,y0,turn}).trees,expected,key);count++;}assert.equal(count,field==='treeCases'?21840:4000);report[field]=count;}
  for(const k of [54,47])for(const mutate of [r=>r.trees.reverse(),r=>r.trees.pop(),r=>r.trees.push({...r.trees[0]}),r=>r.trees[0].x+=.01,r=>r.trees[0].z+=.01,r=>r.trees[0].y+=.01,r=>r.trees[0].s+=.01]){const r=drawCoastalRecreationCase(k,{v:0,s:1,H:.35,x0:0,z0:0,y0:0});mutate(r);assert.throws(()=>assert.deepEqual(r.trees,BASE.treeCases[JSON.stringify([k,0,1,.35,0,0,0,0])])) ;}
 });
 test('new water is four upward D triangles only on 154v0 and never a replacement architecture',()=>{
  for(const[k,v]of D082_SLOTS){const r=drawCoastalRecreationCase(k,{v,s:1,H:1,x0:0,z0:0,y0:0});assert.equal(r.G[2].owners.length,k===154?4:0);for(let i=0;i<r.G[2].pos.length;i+=3){const[x,y,z]=r.G[2].pos.slice(i,i+3);assert.ok(Math.abs(y-.004)<1e-12);assert.ok(z>=.67-1e-12&&z<=.87+1e-12);assert.ok((x>=.12-1e-12&&x<=.31+1e-12)||(x>=.78-1e-12&&x<=.90+1e-12));assert.ok(Math.abs(r.G[2].nor[i])===0&&r.G[2].nor[i+1]===1&&Math.abs(r.G[2].nor[i+2])===0);}assert.ok(r.G[0].owners.length&&r.G[1].owners.length);}
 });
 test('copied previews change only supported slots and preserve original world and unsupported records',()=>{
  for(const invalid of [-1,3,4,.5,'0','1','2',true,false,NaN,Infinity])assert.throws(()=>d082CoastalCity({buildings:[]},invalid));
  for(const sample of ['gallery','seed516','ai120']){const city=d082City(sample),before=sha(city);assert.equal(d082CoastalCity(city,null),city,'native preview is the original object');for(const variant of [0,1,2]){const copy=d082CoastalCity(city,variant);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history fields shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(isCoastalRecreation(b.k,variant)){assert.notEqual(v,b);assert.equal(v.v,variant);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b,'unsupported requested slots keep the original building record');}}}
 });
 test('actual production coastalRecreation preview and hook retain unsupported slots and reject coercion',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),expression=view.match(/const coastalView = \(c: City\): City => ([^\n]+);/);assert.ok(expression,'production copied-view expression is exposed');
  const preview=Function('c','coastalForcedV','COASTAL_RECREATION_BUILDINGS','return '+expression[1].replaceAll('coastalForcedV!','coastalForcedV'));
  const records=[];for(const k of [0,...D082_KINDS,135,28,32,65,999,'164','119','116','149','81'])for(const v of [0,1,2,3,4,7])records.push({id:records.length+1,k,v,size:2,x:4,z:6,history:[{day:3,kind:'placed'}]});
  const world=frozen({buildings:records,history:[{day:3,kind:'snapshot'}],day:9,seed:516}),before=sha(world);
  for(const v of [null,0,1,2]){const actual=preview(world,v,MODELS),expected=d082CoastalCity(world,v);assert.deepEqual(actual,expected,'real production expression matches independent exact-slot selection');assert.equal(actual.history,world.history);assert.equal(sha(world),before);if(v===null){assert.equal(actual,world);continue;}assert.notEqual(actual,world);assert.notEqual(actual.buildings,world.buildings);for(let i=0;i<records.length;i++){const b=records[i],copy=actual.buildings[i];if(isCoastalRecreation(b.k,v)){assert.notEqual(copy,b);assert.deepEqual(copy,{...b,v});assert.equal(copy.history,b.history);}else assert.equal(copy,b,'unsupported requested variant leaves the exact original record unchanged');}}
  const method=view.match(/coastalV\(v: number \| null\) \{ ([^\n]+) \},/);assert.ok(method,'production public hook is exposed');
  const hook=Function('let coastalForcedV=null,needsRender=false,rebuilds=0,draws=0;const rebuildScene=fresh=>{if(fresh!==true)throw new Error("preview must rebuild fresh");rebuilds++;};const draw=()=>draws++;return {call(v){'+method[1]+'},state(){return {coastalForcedV,needsRender,rebuilds,draws};}};')();
  for(const v of [0,1,2,null]){const was=hook.state();assert.equal(hook.call(v),v);assert.deepEqual(hook.state(),{coastalForcedV:v,needsRender:true,rebuilds:was.rebuilds+1,draws:was.draws+1});}
  for(const v of [undefined,-1,3,4,5,.5,'0','1','2','3','4',true,false,NaN,Infinity]){const was=hook.state();assert.throws(()=>hook.call(v),/supports saved variants/);assert.deepEqual(hook.state(),was,'invalid request cannot update preview state or rebuild');if(v===undefined)assert.equal(d082CoastalCity(world,v),world,'omitted helper variant means native');else assert.throws(()=>d082CoastalCity(world,v),'independent copied preview rejects invalid input');}
 });
 test('three real cities × three modes × native/v0/v1/v2 preserve all other owners with zero whole-scene growth',()=>{
  let targets=0;const covered=new Set();for(const variant of [null,0,1,2])for(const sample of ['seed516','ai120','gallery']){
   const preview=variant===null?'native':'v'+variant,source=d082City(sample),sourceHash=sha(source),city=d082CoastalCity(source,variant),world=sha(city),wanted=city.buildings.filter(b=>isCoastalRecreation(b.k,b.v)&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   assert.deepEqual(wanted.map(b=>[b.id,b.k,b.v]),sample==='gallery'?[[94,154,0],[154,179,variant??0],[160,185,variant??0],[168,126,variant??0]]:[],'independently archived gallery exact owners and supported fallback variants');
   for(const mode of ['a','b','c']){
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=BASE.cities[preview][sample][mode];assert.equal(off.cost,old[0]);assert.equal(off.sig,old[1],'immutable immediate-D081 same-world/view signature');assert.equal(sha(city),world,'renderer preserves copied city/history');assert.equal(sha(source),sourceHash,'renderer preserves original world/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground);assert.deepEqual(on.dg.inst,off.dg.inst,'tree instances unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${preview} ${mode} mesh${mi} owner${id} exact bytes`);});for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile${i} unchanged`);});
    let delta=0;for(const b of wanted){const key=b.k+':'+b.v,a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.equal(a,D082_CAP[key]);assert.ok(n>=12&&n<=a,`${key}: ${n} <= ${a}`);assert.ok(on.content.some((rows,mi)=>rows[b.id]!==off.content[mi][b.id]),'each exact target slot changes');delta+=n-a;targets++;covered.add(key);}
    assert.equal(on.cost-off.cost,delta,'whole-city delta consists of exact target owners only');assert.ok(on.cost<=off.cost);if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.deepEqual(on,off,'no-target cities exactly unchanged');report.cities.push({sample,preview,mode,targets:wanted.length,before:off.cost,after:on.cost,delta,worldSha256:sourceHash});
   }
  }assert.equal(targets,48,'four target owners across native and three copied previews and three modes');assert.equal(covered.size,10,'all ten actual kind/variant slots rendered in real copied galleries');
 });
 test('every exact-slot production-batched model has real faces that pick its owning building',()=>{
  const source=d082City('gallery'),before=sha(source),covered=new Set();let picks=0;
  for(const variant of [0,1,2])for(const mode of ['a','b','c']){const city=d082CoastalCity(source,variant),con=new ConState(city.n),built=buildCityScene(city,D082_KT,STYLES.A,d082Blocks(city,mode),'d',d082Civic(true),con,true);
   try{const wanted=city.buildings.filter(b=>isCoastalRecreation(b.k,b.v)&&b.goneDay===undefined),ids=new Set(wanted.map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const b of wanted){assert.ok([...seen].some(key=>key.startsWith(b.id+':')),`mode ${mode}: k${b.k} v${b.v} owner${b.id} is pickable`);covered.add(b.k+':'+b.v);}
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=30,'at least one actual hit for each supported forced-gallery target in all three modes');assert.equal(covered.size,10);assert.equal(sha(source),before);
 });
 test('twenty-four legacy switches disable only coastal art and production applies the copied preview',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),match=view.match(/const coastalRecreationOn = ([^;]+);/);assert.ok(match);const flags=['coastalArt','fieldStudyArt','communityArt','transitUtilityArt','neighbourhoodArt','serviceLodgeArt','healthResponseArt','farmMemorialArt','emergencyHotelArt','campusArt','educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false);assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn|commerceVariantOn|commerceThirdOn|educationOn|campusOn|emergencyHotelOn|farmMemorialOn|healthResponseOn|serviceLodgeOn|fieldStudyLodgeOn|communityBuildingOn)/.test(line)))assert.ok(!line.includes('coastalArt'),'new switch does not disable previous art');assert.match(view,/fieldStudyLodgeOn, coastalRecreationOn\)/);assert.match(view,/buildCityScene\(coastalView\(fieldStudyView\(/);
 });
 test('negative controls detect corrupt geometry, budgets and preservation bytes',()=>{
  for(const[k,v]of D082_SLOTS){const r=drawCoastalRecreationCase(k,{v});while(d082Cost(r.G)<=D082_CAP[k+':'+v])for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags'])g[key].push(...g[key]);r.cost=d082Cost(r.G);assert.throws(()=>assertCoastalRecreationBudget(r));}
  for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){const r=drawCoastalRecreationCase(47,{v:0}),g=r.G.find(g=>g[key].length);g[key][0]+=.0001;assert.notEqual(geoBytes(r),BASE.priorModels['47:0'].float64Sha256);}
  for(const mutate of [r=>r.G[0].pos[0]=NaN,r=>r.G[0].owners[0]=0,r=>r.G[0].uv.pop(),r=>r.G[0].nor[0]=NaN,r=>r.G[0].pos[1]=r.y0+r.H+1,r=>r.trees.push({x:0,z:0,y:0,s:1})]){const r=drawCoastalRecreationCase(126,{v:0});mutate(r);assert.throws(()=>validCoastalRecreationGeometry(r));}
 });
 test('historical fixtures and tested source stay frozen through this run',()=>{for(const[f,pin]of Object.entries(read('fixtures/d082-history-before.json').fixtures))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex'),pin,f);for(const[f,pin]of Object.entries(sourcePins))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT,f))).digest('hex'),pin,f);});
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const{failed,report}=await d082Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d082'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d082/D082-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

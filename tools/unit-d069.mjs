// D069: saved-v1 production geometry, strict immediate-D068 budgets and read-only integration.
// Node geometry tests only. Browser/WebGL screenshots and independent frame oracles are separate evidence.
// Baseline pins were measured from published D068 ee07f108 before D069 dispatch was installed.
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
import {VARIANT_KINDS,VARIANT_BUILDINGS} from '../src/content/britishCommerceVariants.ts';
import {drawBritishCommerceVariant} from '../src/render/britishCommerceVariantArt.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058City,d058Blocks} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {assertD069Scope,d069HistoricalBytes} from './d069-scope.mjs';

const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const D069_BASELINE='ee07f108448c5a1068c0c7b1c0ca6ed7d4cad883';
export const D069_KINDS=[65,86,91,98,99,57,64,110,167,168];
// These are immediate D068 costs, not the looser D067 caps retained by historical D068 guards.
export const D069_CAP={65:92,86:284,91:118,98:80,99:116,57:346,64:194,110:76,167:80,168:80};
export const D069_OLD={
 seed516:{a:[121812,'f15038642bf07201652a62e6dc0de7ecdc2444fa91de26b8460c30b3775b4306'],b:[83816,'bdcd58183874b821baaafebcd2f5adf20571141422cad5c1726c6da83792005a'],c:[112762,'a187b425b6ff08d9a3a11c30a4fda5e070f9f099b2671597f1d74ab51541316c']},
 gallery:{a:[60570,'89f9e56bd75e19ff097d19785dafb6d9345c2d097acffa5f8d2eeaef21a1a5ab'],b:[61312,'f02e583449d0a27bf68fe589b47891ddbc1da9239c286c473dab109156e0b220'],c:[61312,'f02e583449d0a27bf68fe589b47891ddbc1da9239c286c473dab109156e0b220']},
 ai120:{a:[92942,'4faa4fc49180f702c9dd31b1f9453fe8d94423296e7bac4b29fdd899cd1b73d3'],b:[86769,'b95138ad693df3af5fe5da4371bd566d03e6c81e335611da34d4808610426d9b'],c:[95571,'250bddeaaf0cbe99108c6ef8c39d9c23b604483ed63d36e30367ed43f85a09ad']},
};
export const D069_V0_OLD={...D069_OLD,gallery:{a:[60570,'e6ac7282154105df1e40cd6adf4309f8142fa9411673d47eab9053aca2c0ea62'],b:[61312,'019bedf3ff246920c2d51dd48f9a0c564350f4ff6ced132fc18fd80ac8026235'],c:[61312,'019bedf3ff246920c2d51dd48f9a0c564350f4ff6ced132fc18fd80ac8026235']}};
export const D069_MODEL_OLD={65:'89079a93277ef6b87c705410f2733410ee285f6613ddc8b6570dc72bdb3f441c',86:'56e76678399fd98325d4eb6c76230a0c97c4ccd2a38ee65b5f91fce1c91e32d2',91:'2c3486f4b509dd23434838098ca579b7a637a193553f0834ba1e52cde6757574',98:'e15cf20110de0cfd28b95f94f7fd145be835b01f9b61af3785c9ddb3e28b3a6a',99:'30273cfdc76e6ff0c395c4f1f85136ea5ca86b01296112dccc6690fdb38f21ad',57:'667147e63c9f754bedc2211518da80f383e2ffc7a362a188289399f22948d585',64:'14074fb96427788ef22868d3264298980c91708378a240f6c7d85c479f89ef6b',110:'d88998c139770f83996b7a61695812452ee22c6708cac06213a6c5933d5744d3',167:'a310dc4d60923ece90059c7238f8f060e397a4ef5899876ad9f7ed9b3886c06d',168:'d83e6a999f410ba420a8103fb543d521a2328777ced791cf40cc8fd32c7b8f19'};
export const D069_KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const d069City=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
// Same copy-only preview as commerceView in production: do not change the decoded/saved world.
export const d069VariantCity=city=>({...city,buildings:city.buildings.map(b=>VARIANT_KINDS.has(b.k)?{...b,v:1}:b)});
export const d069Civic=on=>({shape:k=>shapeOf(k,true,true,true,true,true,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D069_KT.catColor(D069_KT.cat(k)))});
export const d069Blocks=(city,mode='c')=>({...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true,houseArt:true});
export const d069Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
export function drawVariantCase(k,{v=1,lv=1,s=D069_KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,D069_KT.height(k,lv,v)),owner=71,on=true,turn=0}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const C=kindColors(LOOKS,k,lv,D069_KT.catColor(D069_KT.cat(k))),args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,true,true,true,true,true,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind preserves every scalar/color input');
 const r={G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,cost:d069Cost(G)};
 // Civic kinds currently have no orientation field. These are explicit test-only quarter-turns,
 // applying the same rigid transform to positions and normals, never claiming new save semantics.
 for(let q=0;q<turn;q++)for(const g of G)for(let i=0;i<g.pos.length;i+=3){[g.pos[i],g.pos[i+2]]=[x0+s-(g.pos[i+2]-z0),z0+(g.pos[i]-x0)];[g.nor[i],g.nor[i+2]]=[-g.nor[i+2],g.nor[i]];}
 return r;
}
// Geometry identity ignores all batches/colors/normals/UVs and vertex/triangle ordering.
// Normalize actual model bounds, not parcel metadata: translating/scaling a copy inside a lot
// cannot evade this guard. Independent horizontal axes and height normalization also reject
// stretched copies; the minimum of four quarter-turn representations rejects rotated copies.
export function variantStructureSignature(r){
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
export function validVariantGeometry(r){
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 assert.equal(r.G.length,3,'exactly the existing three arenas');assert.deepEqual(r.trees,[],'these ten commerce slots have zero trees');
 for(const g of r.G){
  assert.equal(g.pos.length%9,0,'complete triangles');assert.equal(g.nor.length,g.pos.length,'one normal per vertex');assert.equal(g.col.length,g.pos.length,'one color per vertex');assert.equal(g.uv.length,g.pos.length/3*2,'two UV coordinates per vertex');
  assert.equal(g.owners.length,g.pos.length/9,'one owner per triangle');assert.equal(g.tags.length,g.owners.length,'one tag per triangle');assert.ok(g.owners.every(o=>o===r.owner),'picking owner preserved');
  if(g.ext){assert.equal(g.wst.length,g.pos.length/3);assert.equal(g.wgl.length,g.pos.length);assert.equal(g.wbd.length,g.pos.length/3);}else for(const key of ['wst','wgl','wbd'])assert.equal(g[key].length,0,key+' absent on non-window arena');
  for(const key of ['pos','nor','col','uv','wst','wgl','wbd','tags','owners'])assert.ok(g[key].every(Number.isFinite),key+' finite');
  for(let t=0;t<g.pos.length;t+=9){
   const p=g.pos,ax=p[t+3]-p[t],ay=p[t+4]-p[t+1],az=p[t+5]-p[t+2],bx=p[t+6]-p[t],by=p[t+7]-p[t+1],bz=p[t+8]-p[t+2],cr=[ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx];
   assert.ok(Math.hypot(...cr)>1e-10,'nondegenerate triangle');
   for(let j=0;j<9;j+=3)assert.ok(cr.reduce((sum,n,i)=>sum+n*g.nor[t+j+i],0)>0,'winding agrees with every vertex normal');
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
 const con=new ConState(city.n),built=buildCityScene(city,D069_KT,STYLES.A,d069Blocks(city,mode),'d',d069Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d069Expected(){const out={};for(const sample of ['seed516','ai120','gallery']){const city=d069VariantCity(d069City(sample)),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[sample]={legacy:old.cost,variant:now.cost,delta:now.cost-old.cost};}return out;}
export async function d069Guards(log=()=>{}){
 let failed=0;const report={baseline:D069_BASELINE,qualification:'Node geometry tests only; browser/WebGL captures are separate evidence.',tests:[],geometryCases:0,preservedCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D069 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D069 '+name,e.stack??String(e));}};
 test('only the approved ten kinds opt in; seventh argument defaults off for all historical guards',()=>{
  assert.deepEqual([...VARIANT_KINDS].sort((a,b)=>a-b),[...D069_KINDS].sort((a,b)=>a-b));assert.equal(VARIANT_BUILDINGS.length,10);assert.equal(new Set(VARIANT_BUILDINGS.map(b=>b.id)).size,10);assert.deepEqual(VARIANT_BUILDINGS.map(b=>b.k),D069_KINDS);
  for(const k of [0,...D069_KT.data.kinds.map(r=>r.k),999]){const off=shapeOf(k,true,true,true,true,true,false),on=shapeOf(k,true,true,true,true,true,true);assert.deepEqual(shapeOf(k,true,true,true,true,true),off,'seventh argument defaults off');if(VARIANT_KINDS.has(k)){assert.notDeepEqual(on,off);assert.equal(on.p.commerceVariant,true);assert.equal(on.p.facility,true,'fallback preserves D068 facility selection');}else assert.deepEqual(on,off,`non-target ${k} dispatch unchanged`);}
 });
 test('strict numeric saved v1 only; rejected kinds/variants emit no direct geometry',()=>{
  for(const k of [0,...D069_KINDS,51,999])for(const v of [undefined,null,-1,0,1,2,3,4,5,6,7,8,9,10,1.5,'1',true]){
   const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors(LOOKS,k,1,'#ffffff')},before=sha(a),accept=D069_KINDS.includes(k)&&v===1;
   assert.equal(drawBritishCommerceVariant(new Pen(a)),accept,`direct acceptance k${k} v${String(v)}`);if(accept)assert.ok(G.some(g=>g.pos.length));else assert.equal(sha(a),before,'rejected slot is a strict no-op');
  }
 });
 test('immediate D068 models are pinned; all v0/non-v1 slots and every non-target model remain byte-identical',()=>{
  for(const k of D069_KINDS){const old=drawVariantCase(k,{on:false});assert.equal(old.cost,D069_CAP[k],`kind ${k} exact preceding-wave cost`);assert.equal(geoSig(old),D069_MODEL_OLD[k],`kind ${k} exact preceding-wave attribute bytes`);}
  for(const k of [0,...D069_KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,D069_KT.size(k)])){
   if(VARIANT_KINDS.has(k)&&v===1)continue;const off=drawVariantCase(k,{lv,v,s,on:false}),on=drawVariantCase(k,{lv,v,s});assert.equal(geoSig(on),geoSig(off),`k${k} lv${lv} v${v} s${s} exact preserved bytes`);report.preservedCases++;
  }
 });
 test('ten v1 structures are unique across rotation/translation/stretch/color/order and distinct from every D068 model',()=>{
  const old=new Set(D069_KINDS.map(k=>variantStructureSignature(drawVariantCase(k,{s:1,on:false})))),now=new Set();assert.equal(old.size,10,'ten distinct immediate-D068 structures');
  for(const k of D069_KINDS){const id=variantStructureSignature(drawVariantCase(k,{s:1}));assert.ok(!old.has(id),`kind ${k} cannot copy any preceding D068 structure`);assert.ok(!now.has(id),`kind ${k} cannot copy another D069 structure`);now.add(id);}assert.equal(now.size,10);
 });
 test('every v1 level/height/size/origin and quarter-turn has finite bounded deterministic owner geometry and zero growth',()=>{
  for(const k of D069_KINDS){let min=Infinity,max=0;for(const lv of [1,2,3])for(const s of new Set([1,D069_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D069_KT.height(k,lv,1)),Math.max(.24,D069_KT.height(k,lv,1)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={lv,s,H,...origin,turn},r=drawVariantCase(k,options),again=drawVariantCase(k,options),old=drawVariantCase(k,{...options,on:false});validVariantGeometry(r);assert.equal(geoSig(r),geoSig(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'actual v1 geometry changes');
   assert.deepEqual(r.trees,old.trees,'zero existing trees preserved');assert.equal(old.cost,D069_CAP[k],'immediate D068 weighted triangle ceiling');assert.ok(r.cost>=50,'substantial production building');assert.ok(r.cost<=old.cost,`kind ${k}: ${r.cost} <= ${old.cost}`);assert.equal(variantStructureSignature(r),variantStructureSignature(drawVariantCase(k,{...options,turn:0})),'all four rigid rotations preserve structural identity');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[k]={name:D069_KT.name(k),min,max,cap:D069_CAP[k]};}
 });
 test('structural identity rejects recolored, reordered, moved, rotated and independently scaled copies; detects edits',()=>{
  const original=drawVariantCase(65),expected=variantStructureSignature(original);
  for(let turn=0;turn<4;turn++){
   const copy={...original,G:original.G.slice().reverse().map(g=>({...g,pos:[],col:g.col.map(()=>.7)}))};
   original.G.slice().reverse().forEach((g,i)=>{const tris=[];for(let t=0;t<g.pos.length;t+=9){const points=[];for(let j=0;j<9;j+=3){let x=g.pos[t+j],z=g.pos[t+j+2];for(let q=0;q<turn;q++)[x,z]=[-z,x];points.push([12.3+x*2.7,-.9+g.pos[t+j+1]*.37,-8.2+z*.61]);}tris.push(points.reverse().flat());}copy.G[i].pos=tris.reverse().flat();});
   assert.equal(variantStructureSignature(copy),expected,'copy normalization does not depend on parcel metadata or color');copy.G.find(g=>g.pos.length).pos[1]+=.01;assert.notEqual(variantStructureSignature(copy),expected,'real geometric edit detected');
  }
 });
 test('negative geometry controls reject NaN, missing attributes/owner, collapsed triangles, overflow, wrong normals and trees',()=>{
  for(const mutation of [r=>r.G[0].pos[0]=NaN,r=>r.G[0].owners[0]=0,r=>r.G[0].owners.pop(),r=>r.G[0].uv.pop(),r=>r.G[0].wst.pop(),r=>r.G[0].tags.pop(),r=>r.G[0].pos.splice(3,3,...r.G[0].pos.slice(0,3)),r=>r.G[0].pos[0]=r.x0+r.s+1,r=>r.G[0].pos[1]=r.y0+r.H+.01,r=>r.G[0].pos[1]=r.y0-.01,r=>r.G[0].nor[0]=NaN,r=>r.G[0].nor.splice(3,3,...r.G[0].nor.slice(3,6).map(n=>-n)),r=>r.G[0].nor.splice(0,3,0,0,0),r=>r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5})]){const r=drawVariantCase(65);mutation(r);assert.throws(()=>validVariantGeometry(r));}
 });
 test('render-only gallery copy preserves original world and non-target object identity',()=>{
  for(const sample of ['gallery','seed516','ai120']){const city=d069City(sample),before=sha(city),copy=d069VariantCity(city);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history values shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(VARIANT_KINDS.has(b.k)){assert.notEqual(v,b);assert.equal(v.v,1);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b);}}
 });
 test('three real cities × A/B/C preserve original v0 scenes exactly; copied-v1 changes only ten owners with zero growth',()=>{
  let targets=0;for(const sample of ['seed516','ai120','gallery']){
   const source=d069City(sample),sourceHash=sha(source),city=d069VariantCity(source),world=sha(city),wanted=city.buildings.filter(b=>VARIANT_KINDS.has(b.k)&&b.v===1&&b.goneDay===undefined&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   for(const mode of ['a','b','c']){
    const v0off=snapshot(source,mode,false),v0on=snapshot(source,mode,true);assert.equal(v0off.cost,D069_V0_OLD[sample][mode][0]);assert.equal(v0off.sig,D069_V0_OLD[sample][mode][1],'exact published D068 original-world signature');assert.deepEqual(v0on,v0off,'native v0 and every existing owner remain identical');
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=D069_OLD[sample][mode];assert.equal(off.cost,old[0]);assert.equal(off.sig,old[1],'fixed immediate-D068 v1-view signature');assert.equal(sha(city),world,'renderer preserves copied city/history');assert.equal(sha(source),sourceHash,'renderer preserves original world/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground);assert.deepEqual(on.dg.inst,off.dg.inst,'all tree instances unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${mode} mesh${mi} owner${id} exact bytes`);});for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile${i} unchanged`);});
    let delta=0;for(const b of wanted){const a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.equal(a,D069_CAP[b.k]);assert.ok(n>0&&n<=a,`kind ${b.k}: ${n} <= ${a}`);assert.ok(on.content.some((rows,mi)=>rows[b.id]!==off.content[mi][b.id]),'each v1 target actually changes');delta+=n-a;targets++;}
    assert.equal(on.cost-off.cost,delta,'entire city delta consists of target owners only');assert.ok(on.cost<=off.cost);if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.deepEqual(on,off,'no-target cities stay exactly unchanged');report.cities.push({sample,mode,targets:wanted.length,before:off.cost,after:on.cost,delta,worldSha256:sourceHash});
   }
  }assert.equal(targets,30,'ten gallery targets in three modes; zero targets in existing-city negative controls');
 });
 test('actual production-batched faces of every v1 model pick their owning building',()=>{
  const source=d069City('gallery'),city=d069VariantCity(source),before=sha(source);let picks=0;
  for(const mode of ['a','b','c']){const con=new ConState(city.n),built=buildCityScene(city,D069_KT,STYLES.A,d069Blocks(city,mode),'d',d069Civic(true),con,true);
   try{const ids=new Set(city.buildings.filter(b=>VARIANT_KINDS.has(b.k)&&b.v===1&&b.goneDay===undefined).map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const id of ids)assert.ok([...seen].some(key=>key.startsWith(id+':')),`mode ${mode}: v1 owner ${id} has real pickable geometry`);assert.ok(seen.size>=20,'at least two arena hits per average building');
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=60);assert.equal(sha(source),before);
 });
 test('procedural sources and exact reversible scope preserve simulation, saves, D068 art and all historical gates',()=>{
  for(const file of ['src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts']){const source=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\/\/.*$/gm,'');for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b|\bwindow\b|\blocation\b/,/data:image|\.png|\.jpe?g|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])assert.doesNotMatch(source,re,file);}
  const allowed=new Set(['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts']),changed=execFileSync('git',['diff','--name-only',D069_BASELINE,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const file of [...changed,...untracked])assert.ok(allowed.has(file),'approved render-only source: '+file);
  assertD069Scope();const manifest=read('fixtures/d069-art-scope.json');for(const file of manifest.modified)assert.equal(createHash('sha256').update(d069HistoricalBytes(file)).digest('hex'),manifest.before[file],'exact D068 historical bytes');
  for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/recipes.ts','src/render/scene.ts','src/render/cityScene.ts','src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceFacilities.ts','src/render/britishCommerceFacilityArt.ts','src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts']){const mutated=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized mutation':'');assert.throws(()=>assertD069Scope(mutated),/exact allowed source/,'scope rejects '+target);assert.throws(()=>d069HistoricalBytes(target,mutated),/exact allowed source/,'historical restoration rejects '+target);}
 });
 test('twelve legacy switches disable only this wave; explicit copied-v1 gallery preview cannot mutate saved world',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),match=view.match(/const commerceVariantOn = ([^;]+);/);assert.ok(match);const flags=['commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false,flag+' disables this wave');assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn)|(?:village|industry|commerce|house)Art:/.test(line)))assert.ok(!line.includes('commerceVariantArt'),'new switch never disables historical art');assert.match(view,/shapeOf\([^\n]*facilityOn, commerceVariantOn\)/);assert.match(view,/commerceV\(v: number \| null\)/);assert.match(view,/buildings: c\.buildings\.map\(/,'preview copies building records');assert.match(view,/commerceView\(towerView\(c\)\)/,'production rendering uses explicit copied view');
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {failed,report}=await d069Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d069'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d069/D069-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

// D070: saved-v2 production geometry, strict immediate-D069 budgets and read-only integration.
// Node geometry tests only. Browser/WebGL screenshots and independent frame oracles are separate evidence.
// Exact baseline pins were measured from isolated published D069 bece722 before D070 dispatch was installed.
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
import {THIRD_KINDS,THIRD_BUILDINGS} from '../src/content/britishCommerceThird.ts';
import {drawBritishCommerceThird} from '../src/render/britishCommerceThirdArt.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058City,d058Blocks} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {assertD070Scope,d070HistoricalBytes} from './d070-scope.mjs';

const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const D070_BASELINE='bece722ed2480a3728a274c90bd0170eb52cf389';
export const D070_KINDS=[65,86,91,98,99,57,64,110,167,168];
// These are immediate D069 costs, not the looser D067 caps retained by historical D068 guards.
export const D070_CAP={65:92,86:284,91:118,98:80,99:116,57:346,64:194,110:76,167:80,168:80};
// Exhaustive immediate-D069 digest of the 7,860 model cases outside these ten saved-v2 slots.
export const D070_PRESERVED={cases:7860,sha256:'553025eb545ead03016db298ecec3c91f6a71782eb736481c746e5cfe6c44f3d',float64Sha256:'32a3dcc8bd9840b5b8ad4a9899cf78bb4553ca1d0e39ddb8b3597c26a01fa8b9'};
export const D070_OLD={"seed516":{"a":[121812,"f15038642bf07201652a62e6dc0de7ecdc2444fa91de26b8460c30b3775b4306"],"b":[83816,"bdcd58183874b821baaafebcd2f5adf20571141422cad5c1726c6da83792005a"],"c":[112762,"a187b425b6ff08d9a3a11c30a4fda5e070f9f099b2671597f1d74ab51541316c"]},"gallery":{"a":[60570,"599cfaa085a66eb4b3b577cc36ee23c1b77cf9722de13934dbb417891de39ab6"],"b":[61312,"4e91bccb8838d600fe9fb99e48faf1d63bde4c56247b3b9e14a1b5038c1416ad"],"c":[61312,"4e91bccb8838d600fe9fb99e48faf1d63bde4c56247b3b9e14a1b5038c1416ad"]},"ai120":{"a":[92942,"4faa4fc49180f702c9dd31b1f9453fe8d94423296e7bac4b29fdd899cd1b73d3"],"b":[86769,"b95138ad693df3af5fe5da4371bd566d03e6c81e335611da34d4808610426d9b"],"c":[95571,"250bddeaaf0cbe99108c6ef8c39d9c23b604483ed63d36e30367ed43f85a09ad"]}};
export const D070_V0_OLD={"seed516":{"a":[121812,"f15038642bf07201652a62e6dc0de7ecdc2444fa91de26b8460c30b3775b4306"],"b":[83816,"bdcd58183874b821baaafebcd2f5adf20571141422cad5c1726c6da83792005a"],"c":[112762,"a187b425b6ff08d9a3a11c30a4fda5e070f9f099b2671597f1d74ab51541316c"]},"gallery":{"a":[60570,"e6ac7282154105df1e40cd6adf4309f8142fa9411673d47eab9053aca2c0ea62"],"b":[61312,"019bedf3ff246920c2d51dd48f9a0c564350f4ff6ced132fc18fd80ac8026235"],"c":[61312,"019bedf3ff246920c2d51dd48f9a0c564350f4ff6ced132fc18fd80ac8026235"]},"ai120":{"a":[92942,"4faa4fc49180f702c9dd31b1f9453fe8d94423296e7bac4b29fdd899cd1b73d3"],"b":[86769,"b95138ad693df3af5fe5da4371bd566d03e6c81e335611da34d4808610426d9b"],"c":[95571,"250bddeaaf0cbe99108c6ef8c39d9c23b604483ed63d36e30367ed43f85a09ad"]}};
export const D070_V1_OLD={"seed516":{"a":[121812,"f15038642bf07201652a62e6dc0de7ecdc2444fa91de26b8460c30b3775b4306"],"b":[83816,"bdcd58183874b821baaafebcd2f5adf20571141422cad5c1726c6da83792005a"],"c":[112762,"a187b425b6ff08d9a3a11c30a4fda5e070f9f099b2671597f1d74ab51541316c"]},"gallery":{"a":[60386,"8dc273292b78ad737ea02ecd713d50cef154b7f45a9247e9033e8d8269b0c1a9"],"b":[61128,"11229ad6854b5e039c706c33fb27f5801e17e183eff572791336fedfefcbf946"],"c":[61128,"11229ad6854b5e039c706c33fb27f5801e17e183eff572791336fedfefcbf946"]},"ai120":{"a":[92942,"4faa4fc49180f702c9dd31b1f9453fe8d94423296e7bac4b29fdd899cd1b73d3"],"b":[86769,"b95138ad693df3af5fe5da4371bd566d03e6c81e335611da34d4808610426d9b"],"c":[95571,"250bddeaaf0cbe99108c6ef8c39d9c23b604483ed63d36e30367ed43f85a09ad"]}};
export const D070_MODEL_OLD={"57":"f9d7877e55682b81f1447e4e276ae5351920e5faffaa163d77973c9a2dc3e93d","64":"3b598c052a0dc43b5cea976078ce87dc567c4350131b032fd5d75a2787bddec4","65":"3a026496119c2587283689b4e275ae01ecca6e0cd7faf79c01f37cfff53a50d1","86":"23b3592bed30ffc7ab1b81938d526e78674e5257622584e3513d7e894344cc29","91":"efb62bc28d7a1a8340bbfe5d6713f661e5c3f042d4c4d3730efa3e3164a81a12","98":"588cc0950cf0db2376b79f03b0fff32fecafb88e0e7a7fcfbacf240783c9a579","99":"5eb3600949dcc13de72ef684be8942cc628b10cd36da19dc31b653a7a158dfcc","110":"862acfe51a91e7d51321c45eeae2fb0f5246406ed90d0d9786dd0a62d8772e14","167":"6349e80328800946bd73dbd3665eed84e19ecd6adb67dfcc7b6769bec979baaf","168":"4b04f2520551209aff64dddcc2855843bac15585ecad2f3932a30253753e8d79"};
export const D070_PRIOR_MODELS={"57":[{"cost":346,"sig":"4956f19fe76a5024dc9630cb8e4cc521f506a7a966650a41f1a4baa69b12dcd2"},{"cost":250,"sig":"058a036d771d8fbeb700c8645af3d93029b4e5e2e2cf1cff645fccf56f6d1389"}],"64":[{"cost":194,"sig":"a4db8a70843acd927620fe84eaf8aab9f71471970b76fe4cd528cefce3bbf968"},{"cost":192,"sig":"e1a21343de2814a76725baa608fc5e015d9e7b4536806ed22ff7396c0beceacf"}],"65":[{"cost":92,"sig":"678eb956c99e74fd3528f7e29b4a0f326466416ed76842c67c07f967f9ebb95e"},{"cost":86,"sig":"bf576b114664d62f3325714ad1526641d76563e1b156e64eae8add8afd657cd9"}],"86":[{"cost":284,"sig":"4888692fbeca4d4408fc43c2173f772fb9f753fad9dc1284eff30ff7d58a725f"},{"cost":214,"sig":"8343f1bd04d6d9ab351218ef8265fd9d6f8f7a763b1207b05799847af8e82478"}],"91":[{"cost":118,"sig":"759eb329013f1a7017242ccc398f9103c58475b40241ecb06a96217af2ca14d6"},{"cost":114,"sig":"8286573501a4ebac117ce5632d4e7190ecee589ada8f74b706c1de862403e6dc"}],"98":[{"cost":80,"sig":"f043f4e6ad047144534f59444a6275abdf8e2f26fe85ca9fc4045c1cec10771a"},{"cost":80,"sig":"9cf1fe621656b89f938f80a99eed052c7b2e894e04bde409504e6065b9ea29b0"}],"99":[{"cost":116,"sig":"ec07f911301f040122cf113f016bc5c661f3f153fc5625076d3a8de96a49218a"},{"cost":110,"sig":"cef762723bdc74b078ebf28cd17e240b259007e41133acbe18684a722a424d2a"}],"110":[{"cost":76,"sig":"6ba9f92f7aa296780660fcd46845c3e90add0f3c763d4c5941de3a20d79131eb"},{"cost":76,"sig":"37863c809df668687649b65b580689bc54bfc7486acdd4711b7d6147b2b013d0"}],"167":[{"cost":80,"sig":"cbf704ff654e10766a32f3905c839bb7262cecf0b1433ba6da239a01ce16819a"},{"cost":80,"sig":"97693727ba48b89762d09945cc206e8d213feb12f11f2f6492fb072e3a7c783d"}],"168":[{"cost":80,"sig":"62e9c5c4b03a286c7642e8f6cd433e05863a55cc05b7a68ee169273612a1919b"},{"cost":80,"sig":"869405884b47a445b9aeef13effaa0a0b8b2e4d0529bf4689c934f06d3dce980"}]};
export const D070_KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const d070City=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
// Same copy-only preview as commerceThirdView in production: do not change the decoded/saved world.
export const d070ThirdCity=city=>({...city,buildings:city.buildings.map(b=>THIRD_KINDS.has(b.k)?{...b,v:2}:b)});
export const d070Civic=on=>({shape:k=>shapeOf(k,true,true,true,true,true,true,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D070_KT.catColor(D070_KT.cat(k)))});
export const d070Blocks=(city,mode='c')=>({...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true,houseArt:true});
export const d070Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
// Binary preservation also distinguishes signed zero, which JSON signatures intentionally do not.
const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
export function drawThirdCase(k,{v=2,lv=1,s=D070_KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,D070_KT.height(k,lv,v)),owner=71,on=true,turn=0}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const C=kindColors(LOOKS,k,lv,D070_KT.catColor(D070_KT.cat(k))),args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,true,true,true,true,true,true,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind preserves every scalar/color input');
 const r={G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,cost:d070Cost(G)};
 // Civic kinds currently have no orientation field. These are explicit test-only quarter-turns,
 // applying the same rigid transform to positions and normals, never claiming new save semantics.
 for(let q=0;q<turn;q++)for(const g of G)for(let i=0;i<g.pos.length;i+=3){[g.pos[i],g.pos[i+2]]=[x0+s-(g.pos[i+2]-z0),z0+(g.pos[i]-x0)];[g.nor[i],g.nor[i+2]]=[-g.nor[i+2],g.nor[i]];}
 return r;
}
// Geometry identity ignores all batches/colors/normals/UVs and vertex/triangle ordering.
// Normalize actual model bounds, not parcel metadata: translating/scaling a copy inside a lot
// cannot evade this guard. Independent horizontal axes and height normalization also reject
// stretched copies; the minimum of four quarter-turn representations rejects rotated copies.
export function thirdStructureSignature(r){
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
export function validThirdGeometry(r){
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 assert.equal(r.G.length,3,'exactly the existing three arenas');assert.deepEqual(r.trees,[],'these ten commerce slots have zero trees');
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
 const con=new ConState(city.n),built=buildCityScene(city,D070_KT,STYLES.A,d070Blocks(city,mode),'d',d070Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d070Expected(){const out={};for(const sample of ['seed516','ai120','gallery']){const city=d070ThirdCity(d070City(sample)),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[sample]={legacy:old.cost,third:now.cost,delta:now.cost-old.cost};}return out;}
export async function d070Guards(log=()=>{}){
 let failed=0;const report={baseline:D070_BASELINE,qualification:'Node geometry tests only; browser/WebGL captures are separate evidence.',tests:[],geometryCases:0,preservedCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D070 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D070 '+name,e.stack??String(e));}};
 test('only the approved ten kinds opt in; eighth argument defaults off for all historical guards',()=>{
  assert.deepEqual([...THIRD_KINDS].sort((a,b)=>a-b),[...D070_KINDS].sort((a,b)=>a-b));assert.equal(THIRD_BUILDINGS.length,10);assert.equal(new Set(THIRD_BUILDINGS.map(b=>b.id)).size,10);assert.deepEqual(THIRD_BUILDINGS.map(b=>b.k),D070_KINDS);assert.ok(THIRD_BUILDINGS.every(b=>b.v===2),'all descriptors occupy only exact numeric saved v2');
  for(const k of [0,...D070_KT.data.kinds.map(r=>r.k),999]){const off=shapeOf(k,true,true,true,true,true,true,false),on=shapeOf(k,true,true,true,true,true,true,true);assert.deepEqual(shapeOf(k,true,true,true,true,true,true),off,'eighth argument defaults off');if(THIRD_KINDS.has(k)){assert.notDeepEqual(on,off);assert.equal(on.p.commerceThird,true);assert.equal(on.p.commerceVariant,true,'fallback preserves D069 alternate selection');assert.equal(on.p.facility,true,'fallback preserves D068 facility selection');}else assert.deepEqual(on,off,`non-target ${k} dispatch unchanged`);}
  for(const k of [0,...D070_KT.data.kinds.map(r=>r.k),999])for(let mask=0;mask<64;mask++){const flags=Array.from({length:6},(_,i)=>Boolean(mask&(1<<i)));assert.deepEqual(shapeOf(k,...flags),shapeOf(k,...flags,false),'all combinations of the six prior optional flags preserve the eighth-argument default');}
 });
 test('strict numeric saved v2 only; rejected kinds/variants emit no direct geometry',()=>{
  for(const k of [0,...D070_KINDS,51,999,'65',null,undefined])for(const v of [undefined,null,-1,0,1,2,3,4,5,6,7,8,9,10,1.5,2.5,'1','2',true,false,NaN,Infinity]){
   const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors(LOOKS,k,1,'#ffffff')},before=sha(a),accept=D070_KINDS.includes(k)&&v===2;
   assert.equal(drawBritishCommerceThird(new Pen(a)),accept,`direct acceptance k${k} v${String(v)}`);if(accept)assert.ok(G.some(g=>g.pos.length));else assert.equal(sha(a),before,'rejected slot is a strict no-op');
  }
 });
 test('immediate D069 models are pinned; all v0/v1/non-v2 slots and every non-target model remain byte-identical',()=>{
  for(const k of D070_KINDS){const old=drawThirdCase(k,{on:false});assert.equal(old.cost,D070_CAP[k],`kind ${k} exact preceding-wave cost`);assert.equal(geoSig(old),D070_MODEL_OLD[k],`kind ${k} exact preceding-wave attribute bytes`);}
  for(const k of D070_KINDS)for(const v of [0,1]){const old=drawThirdCase(k,{v});assert.equal(old.cost,D070_PRIOR_MODELS[k][v].cost,`k${k} v${v} exact D069 cost`);assert.equal(geoSig(old),D070_PRIOR_MODELS[k][v].sig,`k${k} v${v} exact D069 bytes`);}
  const preserved=createHash('sha256'),binary=createHash('sha256');
  for(const k of [0,...D070_KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,D070_KT.size(k)])){
   if(THIRD_KINDS.has(k)&&v===2)continue;const off=drawThirdCase(k,{lv,v,s,on:false}),on=drawThirdCase(k,{lv,v,s});assert.equal(geoSig(on),geoSig(off),`k${k} lv${lv} v${v} s${s} exact preserved arrays`);assert.equal(geoBytes(on),geoBytes(off),`k${k} lv${lv} v${v} s${s} exact binary attributes`);preserved.update(JSON.stringify([k,lv,v,s,geoSig(on)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(on)]));report.preservedCases++;
  }assert.equal(report.preservedCases,D070_PRESERVED.cases);assert.equal(preserved.digest('hex'),D070_PRESERVED.sha256,'all preserved production geometry exactly matches isolated immediate-D069 inventory');assert.equal(binary.digest('hex'),D070_PRESERVED.float64Sha256,'every preserved binary attribute matches immediate D069, including signed zero');
 });
 test('all thirty D068/D069/D070 structures are unique across rotation/translation/stretch/color/order',()=>{
  const structures=new Map();
  for(const v of [0,1,2])for(const k of D070_KINDS){const id=thirdStructureSignature(drawThirdCase(k,{v,s:1})),label=`D${68+v} k${k} v${v}`;assert.ok(!structures.has(id),`${label} cannot copy ${structures.get(id)}`);structures.set(id,label);}assert.equal(structures.size,30,'all thirty production models are structurally distinct');
 });
 test('every v2 level/height/size/origin and quarter-turn has finite bounded deterministic owner geometry and zero growth',()=>{
  for(const k of D070_KINDS){let min=Infinity,max=0;for(const lv of [1,2,3])for(const s of new Set([1,D070_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D070_KT.height(k,lv,2)),Math.max(.24,D070_KT.height(k,lv,2)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={lv,s,H,...origin,turn},r=drawThirdCase(k,options),again=drawThirdCase(k,options),old=drawThirdCase(k,{...options,on:false});validThirdGeometry(r);assert.equal(geoBytes(r),geoBytes(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'actual v2 geometry changes');
   assert.deepEqual(r.trees,old.trees,'zero existing trees preserved');assert.equal(old.cost,D070_CAP[k],'immediate D069 weighted triangle ceiling');assert.ok(r.cost>=50,'substantial production building');assert.ok(r.cost<=old.cost,`kind ${k}: ${r.cost} <= ${old.cost}`);assert.equal(thirdStructureSignature(r),thirdStructureSignature(drawThirdCase(k,{...options,turn:0})),'all four rigid rotations preserve structural identity');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[k]={name:D070_KT.name(k),min,max,cap:D070_CAP[k]};}
 });
 test('structural identity rejects recolored, reordered, moved, rotated and independently scaled copies; detects edits',()=>{
  const original=drawThirdCase(65),expected=thirdStructureSignature(original);
  for(let turn=0;turn<4;turn++){
   const copy={...original,G:original.G.slice().reverse().map(g=>({...g,pos:[],col:g.col.map(()=>.7)}))};
   original.G.slice().reverse().forEach((g,i)=>{const tris=[];for(let t=0;t<g.pos.length;t+=9){const points=[];for(let j=0;j<9;j+=3){let x=g.pos[t+j],z=g.pos[t+j+2];for(let q=0;q<turn;q++)[x,z]=[-z,x];points.push([12.3+x*2.7,-.9+g.pos[t+j+1]*.37,-8.2+z*.61]);}tris.push(points.reverse().flat());}copy.G[i].pos=tris.reverse().flat();});
   assert.equal(thirdStructureSignature(copy),expected,'copy normalization does not depend on parcel metadata or color');copy.G.find(g=>g.pos.length).pos[1]+=.01;assert.notEqual(thirdStructureSignature(copy),expected,'real geometric edit detected');
  }
 });
 test('negative geometry controls reject NaN, missing attributes/owner, collapsed triangles, overflow, wrong normals and trees',()=>{
  for(const mutation of [r=>r.G[0].pos[0]=NaN,r=>r.G[0].owners[0]=0,r=>r.G[0].owners.pop(),r=>r.G[0].uv.pop(),r=>r.G[0].wst.pop(),r=>r.G[0].tags.pop(),r=>r.G[0].pos.splice(3,3,...r.G[0].pos.slice(0,3)),r=>r.G[0].pos[0]=r.x0+r.s+1,r=>r.G[0].pos[1]=r.y0+r.H+.01,r=>r.G[0].pos[1]=r.y0-.01,r=>r.G[0].nor[0]=NaN,r=>r.G[0].nor.splice(3,3,...r.G[0].nor.slice(3,6).map(n=>-n)),r=>r.G[0].nor.splice(0,3,0,0,0),r=>r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5})]){const r=drawThirdCase(65);mutation(r);assert.throws(()=>validThirdGeometry(r));}
  const tilted=drawThirdCase(65),normal=tilted.G[0].nor.slice(0,3);tilted.G[0].nor.splice(0,3,normal[0]*Math.SQRT1_2,Math.SQRT1_2,normal[2]*Math.SQRT1_2);assert.throws(()=>validThirdGeometry(tilted),/perpendicular/,'a unit normal in the correct hemisphere still must match its plane');
 });
 test('render-only gallery copy preserves original world and non-target object identity',()=>{
  for(const sample of ['gallery','seed516','ai120']){const city=d070City(sample),before=sha(city),copy=d070ThirdCity(city);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history values shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(THIRD_KINDS.has(b.k)){assert.notEqual(v,b);assert.equal(v.v,2);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b);}}
 });
 test('three real cities × A/B/C preserve original v0 and copied-v1 scenes exactly; copied-v2 changes only ten owners with zero growth',()=>{
  let targets=0;for(const sample of ['seed516','ai120','gallery']){
   const source=d070City(sample),sourceHash=sha(source),city=d070ThirdCity(source),world=sha(city),wanted=city.buildings.filter(b=>THIRD_KINDS.has(b.k)&&b.v===2&&b.goneDay===undefined&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   const prior={...source,buildings:source.buildings.map(b=>THIRD_KINDS.has(b.k)?{...b,v:1}:b)},priorHash=sha(prior);
   for(const mode of ['a','b','c']){
    const v0off=snapshot(source,mode,false),v0on=snapshot(source,mode,true);assert.equal(v0off.cost,D070_V0_OLD[sample][mode][0]);assert.equal(v0off.sig,D070_V0_OLD[sample][mode][1],'exact published D069 original-world signature');assert.deepEqual(v0on,v0off,'native v0 and every existing owner remain identical');
    const v1off=snapshot(prior,mode,false),v1on=snapshot(prior,mode,true);assert.equal(v1off.cost,D070_V1_OLD[sample][mode][0]);assert.equal(v1off.sig,D070_V1_OLD[sample][mode][1],'exact published D069 copied-v1 signature');assert.deepEqual(v1on,v1off,'all D069 v1 production geometry and every owner remain identical');assert.equal(sha(prior),priorHash,'renderer preserves copied-v1 world/history');
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=D070_OLD[sample][mode];assert.equal(off.cost,old[0]);assert.equal(off.sig,old[1],'fixed immediate-D069 v2-view signature');assert.equal(sha(city),world,'renderer preserves copied city/history');assert.equal(sha(source),sourceHash,'renderer preserves original world/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground);assert.deepEqual(on.dg.inst,off.dg.inst,'all tree instances unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${mode} mesh${mi} owner${id} exact bytes`);});for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile${i} unchanged`);});
    let delta=0;for(const b of wanted){const a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.equal(a,D070_CAP[b.k]);assert.ok(n>0&&n<=a,`kind ${b.k}: ${n} <= ${a}`);assert.ok(on.content.some((rows,mi)=>rows[b.id]!==off.content[mi][b.id]),'each v2 target actually changes');delta+=n-a;targets++;}
    assert.equal(on.cost-off.cost,delta,'entire city delta consists of target owners only');assert.ok(on.cost<=off.cost);if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.deepEqual(on,off,'no-target cities stay exactly unchanged');report.cities.push({sample,mode,targets:wanted.length,before:off.cost,after:on.cost,delta,worldSha256:sourceHash});
   }
  }assert.equal(targets,30,'ten gallery targets in three modes; zero targets in existing-city negative controls');
 });
 test('actual production-batched faces of every v2 model pick their owning building',()=>{
  const source=d070City('gallery'),city=d070ThirdCity(source),before=sha(source);let picks=0;
  for(const mode of ['a','b','c']){const con=new ConState(city.n),built=buildCityScene(city,D070_KT,STYLES.A,d070Blocks(city,mode),'d',d070Civic(true),con,true);
   try{const ids=new Set(city.buildings.filter(b=>THIRD_KINDS.has(b.k)&&b.v===2&&b.goneDay===undefined).map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const id of ids)assert.ok([...seen].some(key=>key.startsWith(id+':')),`mode ${mode}: v2 owner ${id} has real pickable geometry`);assert.ok(seen.size>=20,'at least two arena hits per average building');
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=60);assert.equal(sha(source),before);
 });
 test('procedural sources and exact reversible scope preserve simulation, saves, D069 art and all historical gates',()=>{
  for(const file of ['src/content/britishCommerceThird.ts','src/render/britishCommerceThirdArt.ts']){const source=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\/\/.*$/gm,'');for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b|\bwindow\b|\blocation\b/,/data:image|\.png|\.jpe?g|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])assert.doesNotMatch(source,re,file);}
  const allowed=new Set(['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceThird.ts','src/render/britishCommerceThirdArt.ts']),changed=execFileSync('git',['diff','--name-only',D070_BASELINE,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const file of [...changed,...untracked])assert.ok(allowed.has(file),'approved render-only source: '+file);
  assertD070Scope();const manifest=read('fixtures/d070-art-scope.json');for(const file of manifest.modified)assert.equal(createHash('sha256').update(d070HistoricalBytes(file)).digest('hex'),manifest.before[file],'exact D069 historical bytes');
  for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/recipes.ts','src/render/scene.ts','src/render/cityScene.ts','src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceFacilities.ts','src/render/britishCommerceFacilityArt.ts','src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts','src/content/britishCommerceThird.ts','src/render/britishCommerceThirdArt.ts']){const mutated=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized mutation':'');assert.throws(()=>assertD070Scope(mutated),/exact allowed source/,'scope rejects '+target);assert.throws(()=>d070HistoricalBytes(target,mutated),/exact allowed source/,'historical restoration rejects '+target);}
 });
 test('thirteen legacy switches disable only this wave; explicit copied-v2 gallery preview cannot mutate saved world',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),match=view.match(/const commerceThirdOn = ([^;]+);/);assert.ok(match);const flags=['commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false,flag+' disables this wave');assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn|commerceVariantOn)|(?:village|industry|commerce|house)Art:/.test(line)))assert.ok(!line.includes('commerceThirdArt'),'new switch never disables historical art');assert.match(view,/shapeOf\([^\n]*facilityOn, commerceVariantOn, commerceThirdOn\)/);assert.match(view,/commerceThirdV\(v: number \| null\)/);assert.match(view,/buildings: c\.buildings\.map\(/,'preview copies building records');assert.match(view,/commerceThirdView\(commerceView\(towerView\(c\)\)\)/,'production rendering uses explicit copied view');
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {failed,report}=await d070Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d070'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d070/D070-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

// D073: ten exact emergencyHotel slots, immediate published D072 budgets and read-only integration.
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
import {EMERGENCY_HOTEL_KINDS,EMERGENCY_HOTEL_BUILDINGS} from '../src/content/britishEmergencyHotels.ts';
import {drawBritishEmergencyHotel} from '../src/render/britishEmergencyHotelArt.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058City,d058Blocks} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {assertD073Scope,d073HistoricalBytes} from './d073-scope.mjs';
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const frozen=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(frozen);Object.freeze(o);}return o;};
export const D073_BASELINE='a69397ed0900b1f0a27bdc3be8e1616d2973fc43';
export const D073_SLOTS=frozen([[31,2],[61,0],[61,1],[61,2],[82,0],[82,1],[82,2],[83,0],[83,1],[83,2]]);
export const D073_KINDS=Object.freeze([31,61,82,83]);
const isEmergencyHotel=(k,v)=>D073_SLOTS.some(([a,b])=>a===k&&b===v);
const baselineBytes=fs.readFileSync(path.join(ROOT,'fixtures/d073-geometry-before.json'));
assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'41fb0ec99af5ee546443bc7def0565a4f5b6c402a5c207fa245d9fa6acb566a8','immutable isolated-D072 geometry fixture');
const BASE=frozen(JSON.parse(baselineBytes));assert.equal(BASE.baseline,D073_BASELINE);
export const D073_CAP=frozen(Object.fromEntries(Object.entries(BASE.slots).map(([slot,r])=>[slot,r.cost])));
export const D073_PRESERVED=BASE.preserved;
export const D073_OLD=BASE.cities;
export const D073_MODEL_OLD=BASE.slots;
export const D073_PRIOR_MODELS=BASE.priorModels;
export const D073_KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const d073City=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
// Match the production render-only preview. Original saves and records never change.
export function d073EmergencyHotelCity(city,v=null){
 assert.ok(v===null||v===0||v===1||v===2,'supported copied emergencyHotel variant');
 return v===null?city:{...city,buildings:city.buildings.map(b=>isEmergencyHotel(b.k,v)?{...b,v}:b)};
}
export const d073Civic=on=>({shape:k=>shapeOf(k,true,true,true,true,true,true,true,true,true,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D073_KT.catColor(D073_KT.cat(k)))});
export const d073Blocks=(city,mode='c')=>({...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true,houseArt:true});
export const d073Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
// Binary preservation also distinguishes signed zero, which JSON signatures intentionally do not.
const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
export function drawEmergencyHotelCase(k,{v=0,lv=1,s=D073_KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,D073_KT.height(k,lv,v)),owner=71,on=true,turn=0}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const C=kindColors(LOOKS,k,lv,D073_KT.catColor(D073_KT.cat(k))),args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,true,true,true,true,true,true,true,true,true,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind preserves every scalar/color input');
 const r={G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,turn,cost:d073Cost(G)};
 // Civic kinds currently have no orientation field. These are explicit test-only quarter-turns,
 // applying the same rigid transform to positions and normals, never claiming new save semantics.
 for(let q=0;q<turn;q++)for(const g of G)for(let i=0;i<g.pos.length;i+=3){[g.pos[i],g.pos[i+2]]=[x0+s-(g.pos[i+2]-z0),z0+(g.pos[i]-x0)];[g.nor[i],g.nor[i+2]]=[-g.nor[i+2],g.nor[i]];}
 for(let q=0;q<turn;q++)for(const tree of trees)[tree.x,tree.z]=[x0+s-(tree.z-z0),z0+(tree.x-x0)];
 return r;
}
// Geometry identity ignores all batches/colors/normals/UVs and vertex/triangle ordering.
// Normalize actual model bounds, not parcel metadata: translating/scaling a copy inside a lot
// cannot evade this guard. Independent horizontal axes and height normalization also reject
// stretched copies; the minimum of four quarter-turn representations rejects rotated copies.
export function emergencyHotelStructureSignature(r){
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
export function validEmergencyHotelGeometry(r){
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 assert.equal(r.G.length,3,'exactly the existing three arenas');assert.equal(r.trees.length,r.k===83?4:0,'exact existing tree count preserved');
 const treePin=BASE.treeCases[JSON.stringify([r.k,r.v,r.s,r.x0,r.z0,r.y0,r.turn??0])];if(treePin)assert.deepEqual(r.trees,treePin,'ordered tree transforms equal isolated published release');
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
// Independent architectural roof pins. These are desired normalized surfaces,
// never collected from emitted meshes, visible triangles, colors or cameras.
const roofRect=(k,v,id,a,b,c,d,h,extra={})=>({k,v,id,panels:[[[a,h,c],[b,h,c],[b,h,d],[a,h,d]]],...extra});
const roofPitch=(k,v,id,a,b,c,d,h,rise,axis='x',extra={})=>{
 const A=[a,h,c],B=[b,h,c],D=[b,h,d],E=[a,h,d],L=axis==='x'?[a,h+rise,(c+d)/2]:[(a+b)/2,h+rise,c],R=axis==='x'?[b,h+rise,(c+d)/2]:[(a+b)/2,h+rise,d];
 return {k,v,id,panels:axis==='x'?[[A,B,R,L],[E,D,R,L],[A,E,L],[B,D,R]]:[[A,E,R,L],[B,D,R,L],[A,B,L],[E,D,R]],...extra};
};
export const D073_ROOFS=frozen([
 ...[[.05,.95,.05,.071],[.05,.071,.071,.95],[.929,.95,.071,.95],[.071,.40,.929,.95],[.60,.929,.929,.95]].map(([a,b,c,d],i)=>roofRect(31,2,'perimeter-cap-'+i,a,b,c,d,.36,{nonRoof:true})),
 roofPitch(31,2,'west-cell-range',.15,.32,.15,.78,.69,.21,'z'),
 roofPitch(31,2,'east-cell-range',.66,.84,.15,.82,.78,.22,'z'),
 roofRect(31,2,'cross-corridor',.32,.66,.29,.43,.38),
 roofPitch(31,2,'service-range',.39,.59,.09,.29,.54,.18,'z'),
 roofPitch(31,2,'separate-gatehouse',.40,.60,.85,.96,.58,.21,'x'),
 roofPitch(61,0,'appliance-hall',.08,.74,.17,.48,.43,.19,'x'),
 roofRect(61,0,'hose-tower',.64,.80,.12,.29,1),
 roofRect(61,0,'administration-wing',.08,.27,.48,.88,.35),
 roofPitch(61,1,'west-vehicle-hall',.08,.29,.16,.83,.44,.12,'z'),
 roofPitch(61,1,'east-vehicle-hall',.71,.92,.16,.88,.50,.16,'z'),
 roofRect(61,1,'rear-command-block',.29,.71,.16,.37,.55),
 roofRect(61,1,'training-tower',.08,.22,.08,.23,1),
 roofPitch(61,2,'west-garage-fold',.08,.385,.35,.80,.37,.21,'z'),
 roofPitch(61,2,'east-garage-fold',.385,.69,.35,.80,.37,.16,'z'),
 roofRect(61,2,'command-lower-terrace',.08,.69,.10,.35,.74),
 roofRect(61,2,'command-upper-block',.16,.45,.10,.30,1),
 roofRect(61,2,'separate-workshop',.77,.93,.35,.75,.31),
 roofRect(82,0,'rear-L-roof',.09,.91,.12,.39,1),
 roofRect(82,0,'long-L-roof',.09,.40,.39,.88,1),
 roofRect(82,1,'upper-hotel-roof',.08,.52,.18,.82,1),
 roofRect(82,1,'open-hotel-terrace',.52,.92,.18,.82,.48),
 {k:82,v:2,id:'joined-V-roof',panels:[[[.10,1,.22],[.50,1,.08],[.50,1,.40]],[[.10,1,.22],[.50,1,.40],[.16,1,.78]],[[.50,1,.08],[.90,1,.22],[.50,1,.40]],[[.90,1,.22],[.84,1,.78],[.50,1,.40]]]},
 roofRect(83,0,'lowest-resort-terrace',.08,.90,.10,.77,.36),
 roofRect(83,0,'middle-resort-terrace',.08,.70,.10,.58,.68),
 roofRect(83,0,'highest-resort-roof',.08,.46,.10,.38,1),
 roofRect(83,1,'rear-spa-wing',.08,.92,.10,.32,.43),
 roofRect(83,1,'east-spa-wing',.71,.92,.32,.80,.43),
 {k:83,v:1,id:'pointed-west-spa-wing',panels:[[[.08,.43,.32],[.30,.43,.32],[.08,.43,.75]]]},
 roofRect(83,1,'corner-suite-block',.08,.30,.10,.32,1),
 roofPitch(83,2,'west-A-frame-lodge',.08,.39,.12,.70,0,1,'z'),
 roofPitch(83,2,'east-A-frame-lodge',.60,.92,.25,.82,0,.82,'z'),
 roofRect(83,2,'joined-dining-pavilion',.30,.68,.57,.70,.24),

]);
export const D073_OPEN_COURTS=frozen([
 {k:31,v:2,id:'open-secure-court',points:[[.40,.51],[.50,.62],[.60,.75]],ceiling:.01},
 {k:61,v:0,id:'open-appliance-turning-court',points:[[.40,.60],[.60,.75],[.84,.88]],ceiling:.01},
 {k:61,v:1,id:'open-command-drill-yard',points:[[.40,.48],[.50,.64],[.61,.82]],ceiling:.01},
 {k:61,v:2,id:'open-front-operations-court',points:[[.20,.88],[.50,.90],[.85,.92]],ceiling:.01},
 {k:82,v:0,id:'L-plan-reentrant-arrival-court',points:[[.50,.50],[.66,.66],[.80,.82]],ceiling:.01},
 {k:82,v:2,id:'V-plan-open-arrival-notch',points:[[.50,.49],[.45,.64],[.55,.73]],ceiling:.01},
 {k:83,v:0,id:'open-seaside-pool-terrace',points:[[.56,.82],[.70,.85],[.85,.84]],ceiling:.01},
 {k:83,v:1,id:'open-spa-pool-court',points:[[.40,.48],[.50,.57],[.60,.68]],ceiling:.01},
 {k:83,v:2,id:'open-lodge-arrival-court',points:[[.45,.78],[.50,.85],[.55,.89]],ceiling:.01},

]);
const roofKey=p=>p.map(n=>Math.round(n*1e8)).join(',');
const roofTriKey=t=>t.map(roofKey).sort().join(';');
const roofEdges=triangles=>{const edges=new Map();for(const tri of triangles)for(let j=0;j<3;j++){const key=[roofKey(tri[j]),roofKey(tri[(j+1)%3])].sort().join('|');edges.set(key,(edges.get(key)??0)+1);}return [...edges].sort(([a],[b])=>a.localeCompare(b));};
const roofTriangles=spec=>spec.panels.flatMap((p,pi)=>p.slice(1,-1).map((_,j)=>({panel:pi,points:[p[0],p[j+1],p[j+2]]})));
const roofUp=t=>Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]))>1e-10;
const roofWorld=(r,p,quantize=false)=>{let [x,h,z]=p;for(let q=0;q<(r.turn??0);q++)[x,z]=[1-z,x];const v=[r.x0+r.s*x,r.y0+r.H*h,r.z0+r.s*z];return quantize?v.map(Math.fround):v;};
const roofNormalized=(r,p)=>{let x=(p[0]-r.x0)/r.s,z=(p[2]-r.z0)/r.s;for(let q=0;q<(r.turn??0);q++)[x,z]=[z,1-x];return [x,(p[1]-r.y0)/r.H,z];};
// Dense interior barycentric samples avoid edges/diagonals and expose even narrow
// terraces. Both ray heights and visibility decisions derive only from the pins.
function roofInterior(tri){const out=[];for(let i=1;i<7;i++)for(let j=1;j<8-i;j++){const a=i/8,b=j/8,c=1-a-b;if(c<=0)continue;out.push(tri[0].map((v,k)=>a*v+b*tri[1][k]+c*tri[2][k]));}return out;}
function roofHeight(tri,x,z){const [[x0,h0,z0],[x1,h1,z1],[x2,h2,z2]]=tri,den=(z1-z2)*(x0-x2)+(x2-x1)*(z0-z2);if(Math.abs(den)<1e-12)return null;const a=((z1-z2)*(x-x2)+(x2-x1)*(z-z2))/den,b=((z2-z0)*(x-x2)+(x0-x2)*(z-z2))/den,c=1-a-b;return Math.min(a,b,c)>=-1e-8?a*h0+b*h1+c*h2:null;}
export function d073RoofSamples(k,v){
 const specs=D073_ROOFS.filter(s=>s.k===k&&s.v===v&&!s.nonRoof),all=specs.flatMap(roofTriangles).map(t=>t.points).filter(roofUp),samples=[];
 for(const spec of specs)for(const [panel]of spec.panels.entries()){
  const interior=roofTriangles(spec).filter(t=>t.panel===panel&&roofUp(t.points)).flatMap(t=>roofInterior(t.points)),exposed=interior.filter(([x,h,z])=>!all.some(t=>{const top=roofHeight(t,x,z);return top!==null&&top>h+1e-8;}));
  if(exposed.length===0)continue;assert.ok(exposed.length>=3,spec.id+' has three independently exposed interior roof samples');
  const selected=[exposed[0]],distance=(a,b)=>(a[0]-b[0])**2+(a[2]-b[2])**2;while(selected.length<3){const candidates=exposed.filter(p=>!selected.includes(p)).sort((a,b)=>Math.min(...selected.map(p=>distance(b,p)))-Math.min(...selected.map(p=>distance(a,p))));selected.push(candidates[0]);}
  for(const [sample,p]of selected.entries())samples.push({id:spec.id+':'+panel+':'+sample,component:spec.id,panel,x:p[0],z:p[2],h:p[1]});
 }return samples;
}
export function emergencyHotelRoofTriangles(r,spec){
 const expected=new Set(roofTriangles(spec).map(t=>roofTriKey(t.points))),out=[];
 for(const [gi,g]of r.G.entries())for(let ti=0;ti<g.pos.length/9;ti++){const points=[];for(let j=0;j<9;j+=3)points.push(roofNormalized(r,g.pos.slice(ti*9+j,ti*9+j+3)));if(expected.has(roofTriKey(points)))out.push({gi,ti,points});}
 return out;
}
export function assertEmergencyHotelRoofClosure(r,spec){
 const expected=roofTriangles(spec).map(t=>t.points),actual=emergencyHotelRoofTriangles(r,spec);
 assert.deepEqual(actual.map(t=>roofTriKey(t.points)).sort(),expected.map(roofTriKey).sort(),spec.id+' has every intended roof plane and closing end face exactly once');
 assert.deepEqual(roofEdges(actual.map(t=>t.points)),roofEdges(expected),spec.id+' has no missing slope, unjoined edge, duplicated cap or open gable');
 const counts=roofEdges(expected);assert.ok(counts.every(([,count])=>count===1||count===2),spec.id+' independent roof specification is manifold above its intended boundary');
 return actual;
}
export function assertEmergencyHotelRoofCoverage(r,spec){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.G.flatMap(g=>g.pos),3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.FrontSide}));let probes=0;
 try{for(const {points}of roofTriangles(spec)){if(!roofUp(points))continue;const gpu=points.map(p=>roofWorld(r,p,true));for(const p of roofInterior(points)){
   const world=roofWorld(r,p),expected=roofHeight(gpu,world[0],world[2]);assert.notEqual(expected,null,spec.id+' independent sample lies within its GPU-quantized plane');
   const hits=new THREE.Raycaster(new THREE.Vector3(world[0],r.y0+r.H+1,world[2]),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
   assert.ok(hits.some(hit=>Math.abs(hit.point.y-expected)<1e-6*Math.max(1,r.H)&&hit.face.normal.y>0),spec.id+' front-sided roof covers its independently intended height; lower caps or lone pediments cannot substitute');probes++;
  }}return probes;}finally{geometry.dispose();mesh.material.dispose();}
}
function assertEmergencyHotelRoofInventory(r){
 const assigned=new Set();for(const spec of D073_ROOFS.filter(s=>s.k===r.k&&s.v===r.v))for(const {gi,ti}of assertEmergencyHotelRoofClosure(r,spec)){const key=gi+':'+ti;assert.ok(!assigned.has(key),'a roof triangle belongs to exactly one independent component');assigned.add(key);}
 let upward=0;for(let gi=0;gi<2;gi++){const g=r.G[gi];for(let ti=0;ti<g.pos.length/9;ti++)if(g.nor[ti*9+1]>1e-8){assert.ok(assigned.has(gi+':'+ti),'every real upward shadow surface has an independent roof or wall-cap pin');upward++;}}
 assert.ok(upward>0,'real roofs exist');return upward;
}
function roofMutation(r,targets,reverse=false){
 const copy=structuredClone(r);for(let gi=0;gi<copy.G.length;gi++){const indices=new Set(targets.filter(t=>t.gi===gi).map(t=>t.ti)),g=copy.G[gi];if(reverse){for(const ti of indices)for(let j=0;j<3;j++)[g.pos[ti*9+3+j],g.pos[ti*9+6+j]]=[g.pos[ti*9+6+j],g.pos[ti*9+3+j]];}else for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){const stride=key==='uv'?6:['owners','tags'].includes(key)?1:['wst','wbd'].includes(key)?3:9;g[key]=g[key].filter((_,i)=>!indices.has(Math.floor(i/stride)));}}
 copy.cost=d073Cost(copy.G);return copy;
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
 const con=new ConState(city.n),built=buildCityScene(city,D073_KT,STYLES.A,d073Blocks(city,mode),'d',d073Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d073Expected(){const out={};for(const v of [null,0,1,2]){const key=v===null?'native':'v'+v;out[key]={};for(const sample of ['seed516','ai120','gallery']){const city=d073EmergencyHotelCity(d073City(sample),v),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[key][sample]={legacy:old.cost,emergencyHotel:now.cost,delta:now.cost-old.cost};}}return out;}
export async function d073Guards(log=()=>{}){
 let failed=0;const report={baseline:D073_BASELINE,qualification:'Node geometry tests only; browser/WebGL captures are separate evidence.',tests:[],geometryCases:0,preservedCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D073 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D073 '+name,e.stack??String(e));}};
 test('ten exact slots on four existing kinds; eleventh argument defaults off for every historical flag combination',()=>{
  assert.deepEqual([...EMERGENCY_HOTEL_KINDS],D073_KINDS);assert.equal(EMERGENCY_HOTEL_BUILDINGS.length,10);assert.equal(new Set(EMERGENCY_HOTEL_BUILDINGS.map(b=>b.id)).size,10);assert.deepEqual(EMERGENCY_HOTEL_BUILDINGS.map(b=>[b.k,b.v]),D073_SLOTS);
  for(const k of [0,...D073_KT.data.kinds.map(r=>r.k),999]){
   const off=shapeOf(k,true,true,true,true,true,true,true,true,true,false),on=shapeOf(k,true,true,true,true,true,true,true,true,true,true);
   assert.deepEqual(shapeOf(k,true,true,true,true,true,true,true,true,true),off,'eleventh argument defaults off');
   if(EMERGENCY_HOTEL_KINDS.has(k)){assert.notDeepEqual(on,off);assert.equal(on.p.emergencyHotel,true);assert.equal(on.p.campus,true);assert.equal(on.p.education,true);assert.equal(on.p.commerceThird,true);assert.equal(on.p.commerceVariant,true);assert.equal(on.p.facility,true);}else assert.deepEqual(on,off,`non-target ${k} dispatch unchanged`);
   for(let mask=0;mask<512;mask++){const flags=Array.from({length:9},(_,i)=>Boolean(mask&(1<<i)));assert.deepEqual(shapeOf(k,...flags),shapeOf(k,...flags,false),'all 512 prior flag combinations preserve eleventh-argument default');}
  }
 });
 test('strict numeric saved slots only; all rejected kinds and variants emit no direct geometry',()=>{
  for(const k of [0,...D073_KINDS,65,999,'31','61','82','83',null,undefined])for(const v of [undefined,null,-1,0,1,2,3,4,5,6,7,8,9,10,.5,1.5,2.5,'0','1','2',true,false,NaN,Infinity]){
   const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors(LOOKS,k,1,'#ffffff')},before=sha(a),accept=isEmergencyHotel(k,v);
   assert.equal(drawBritishEmergencyHotel(new Pen(a)),accept,`direct acceptance k${k} v${String(v)}`);if(accept)assert.ok(G.some(g=>g.pos.length));else assert.equal(sha(a),before,'rejected exact slot is a strict no-op');
  }
 });
 test('immutable immediate-D072 slot budgets, all fifty earlier models and exhaustive non-target binary attributes',()=>{
  for(const [k,v]of D073_SLOTS){const key=k+':'+v,old=drawEmergencyHotelCase(k,{v,on:false}),pin=D073_MODEL_OLD[key];assert.equal(old.cost,D073_CAP[key],key+' exact preceding-wave cost');assert.equal(geoSig(old),pin.sha256,key+' exact preceding-wave arrays');assert.equal(geoBytes(old),pin.float64Sha256,key+' exact preceding-wave binary attributes');}
  for(const [key,pin]of Object.entries(D073_PRIOR_MODELS)){const [k,v]=key.split(':').map(Number),r=drawEmergencyHotelCase(k,{v});assert.equal(r.cost,pin.cost,key+' exact old-model cost');assert.equal(geoSig(r),pin.sha256,key+' exact old-model arrays');assert.equal(geoBytes(r),pin.float64Sha256,key+' exact old-model binary bytes');assert.equal(emergencyHotelStructureSignature(r),pin.structureSha256,key+' exact prior normalized structure');}
  const preserved=createHash('sha256'),binary=createHash('sha256');
  for(const k of [0,...D073_KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,D073_KT.size(k)])){
   if(isEmergencyHotel(k,v))continue;const off=drawEmergencyHotelCase(k,{lv,v,s,on:false}),on=drawEmergencyHotelCase(k,{lv,v,s});assert.equal(geoSig(on),geoSig(off),`k${k} lv${lv} v${v} s${s} exact preserved arrays`);assert.equal(geoBytes(on),geoBytes(off),`k${k} lv${lv} v${v} s${s} exact preserved binary attributes`);preserved.update(JSON.stringify([k,lv,v,s,geoSig(on)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(on)]));report.preservedCases++;
  }
  assert.equal(report.preservedCases,D073_PRESERVED.cases);assert.equal(preserved.digest('hex'),D073_PRESERVED.sha256,'all preserved cases match isolated D072');assert.equal(binary.digest('hex'),D073_PRESERVED.float64Sha256,'all preserved binary bytes, including signed zero, match isolated D072');
 });
 test('all sixty models are unique after quarter-turn/translation/independent-scale/color/order normalization',()=>{
  const structures=new Map();
  for(const key of [...Object.keys(D073_PRIOR_MODELS),...D073_SLOTS.map(([k,v])=>k+':'+v)]){const [k,v]=key.split(':').map(Number),id=emergencyHotelStructureSignature(drawEmergencyHotelCase(k,{v,s:1}));assert.ok(!structures.has(id),`${key} cannot copy ${structures.get(id)}`);structures.set(id,key);}
  assert.equal(structures.size,60,'all fifty earlier models and ten new models are structurally distinct');
 });
 test('all exact-slot levels/heights/sizes/origins/quarter-turns preserve finite deterministic bounded geometry and strict budgets',()=>{
  for(const [k,v]of D073_SLOTS){let min=Infinity,max=0;const key=k+':'+v;for(const lv of [1,2,3])for(const s of new Set([1,D073_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D073_KT.height(k,lv,v)),Math.max(.24,D073_KT.height(k,lv,v)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={v,lv,s,H,...origin,turn},r=drawEmergencyHotelCase(k,options),again=drawEmergencyHotelCase(k,options),old=drawEmergencyHotelCase(k,{...options,on:false});validEmergencyHotelGeometry(r);assert.equal(geoBytes(r),geoBytes(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'each approved exact slot changes actual geometry');
   assert.deepEqual(r.trees,old.trees,'all ordered existing trees preserved');assert.equal(old.cost,D073_CAP[key],'strict immediate D072 weighted ceiling');
   assert.ok(r.cost>=12,'positive multi-face building floor within the immutable exact-slot cap');assert.ok(r.cost<=old.cost,`${key}: ${r.cost} <= ${old.cost}`);assert.equal(emergencyHotelStructureSignature(r),emergencyHotelStructureSignature(drawEmergencyHotelCase(k,{...options,turn:0})),'four rigid orientations preserve structural identity');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[key]={name:D073_KT.name(k),min,max,cap:D073_CAP[key]};}
 });
 test('every roof component has independent complete topology and front-sided intended-plan coverage',()=>{
  assert.equal(D073_ROOFS.length,37,'32 real roof components and five explicitly identified perimeter-wall caps');assert.equal(new Set(D073_ROOFS.map(s=>s.k+':'+s.v)).size,10,'roof contract covers all ten exact slots');assert.equal(new Set(D073_ROOFS.map(s=>s.k+':'+s.v+':'+s.id)).size,D073_ROOFS.length,'distinct independent component IDs');
  report.roofComponents=D073_ROOFS.length;report.roofComponentCases=0;report.roofCoverageRays=0;report.roofNegativeControls=0;
  for(const spec of D073_ROOFS)for(const size of [1,4])for(const H of new Set([.12,Math.max(.12,D073_KT.height(spec.k,1,spec.v)),3.7]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const r=drawEmergencyHotelCase(spec.k,{v:spec.v,s:size,H,...origin,turn});assertEmergencyHotelRoofClosure(r,spec);report.roofCoverageRays+=assertEmergencyHotelRoofCoverage(r,spec);report.roofComponentCases++;
  }
  for(const spec of D073_ROOFS){
   const original=drawEmergencyHotelCase(spec.k,{v:spec.v,s:1,H:1,x0:0,z0:0,y0:0}),targets=assertEmergencyHotelRoofClosure(original,spec);
   // Individually delete every real triangle, including each vertical end gable.
   // Generic geometry still accepts these holes: topology must reject them.
   for(const target of targets){const missing=roofMutation(original,[target]);validEmergencyHotelGeometry(missing);assert.throws(()=>assertEmergencyHotelRoofClosure(missing,spec),/every intended roof plane/,'missing individual plane/end triangle is detected for '+spec.id);report.roofNegativeControls++;}
   const missing=roofMutation(original,targets);assert.throws(()=>assertEmergencyHotelRoofCoverage(missing,spec),/front-sided roof covers/,'whole missing '+spec.id+' cannot hide behind other finite mesh faces');report.roofNegativeControls++;
   const reversed=roofMutation(original,targets,true);assertEmergencyHotelRoofClosure(reversed,spec);assert.throws(()=>assertEmergencyHotelRoofCoverage(reversed,spec),/front-sided roof covers/,'closed but back-facing '+spec.id+' fails physical front-sided coverage');report.roofNegativeControls++;
  }
  report.roofInventoryTriangles=0;for(const [k,v]of D073_SLOTS){const r=drawEmergencyHotelCase(k,{v,s:1,H:1});report.roofInventoryTriangles+=assertEmergencyHotelRoofInventory(r);const samples=d073RoofSamples(k,v);assert.ok(samples.length>=3,'every delivered building has independently exposed samples');assert.equal(new Set(samples.map(s=>s.id)).size,samples.length,'camera sample IDs are unique');for(const spec of D073_ROOFS.filter(s=>s.k===k&&s.v===v&&!s.nonRoof))assert.ok(samples.filter(s=>s.component===spec.id).length>=3,'each true roof component has at least three exposed independent points');assert.ok(samples.every(s=>Number.isFinite(s.h)&&s.h>0),'roof samples are real positive-height surfaces');}
 });
 test('independently pinned courtyards and arrival notches remain deliberately uncovered',()=>{
  assert.equal(D073_OPEN_COURTS.length,9,'explicit void contracts cover all nine courtyard/arrival/pool voids');report.openCourtRays=0;
  for(const spec of D073_OPEN_COURTS)for(const size of [1,4])for(const H of [.12,3.7])for(let turn=0;turn<4;turn++){
   const r=drawEmergencyHotelCase(spec.k,{v:spec.v,s:size,H,x0:-3.125,z0:7.375,y0:.21,turn}),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.G.flatMap(g=>g.pos),3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
   try{for(const [x,z]of spec.points){const p=roofWorld(r,[x,0,z]),hits=new THREE.Raycaster(new THREE.Vector3(p[0],r.y0+r.H+1,p[2]),new THREE.Vector3(0,-1,0)).intersectObject(mesh);assert.ok(hits.every(hit=>hit.point.y<=r.y0+r.H*(spec.ceiling??.04)+1e-6),spec.id+' open court cannot acquire a false spanning roof');report.openCourtRays++;}}finally{geometry.dispose();mesh.material.dispose();}
  }
 });
 test('all four ordered resort trees retain exact isolated-release transforms, with corruption controls',()=>{
  report.treeTransformCases=0;for(const [encoded,expected]of Object.entries(BASE.treeCases)){const[k,v,s,x0,z0,y0,turn]=JSON.parse(encoded),r=drawEmergencyHotelCase(k,{v,s,x0,z0,y0,turn});assert.deepEqual(r.trees,expected,'exact immutable tree transform '+encoded);report.treeTransformCases++;}
  for(const mutate of [r=>r.trees.reverse(),r=>r.trees.pop(),r=>r.trees.push({...r.trees[0]}),r=>r.trees[0].x+=.01,r=>r.trees[0].z+=.01,r=>r.trees[0].y+=.01,r=>r.trees[0].s+=.01,r=>r.trees[0].s=NaN]){const r=drawEmergencyHotelCase(83,{v:0,s:1,x0:0,z0:0,y0:0});mutate(r);assert.throws(()=>validEmergencyHotelGeometry(r),'ordered tree count/location/ground/scale is immutable');}
 });

 test('identity rejects recolored/reordered/moved/rotated/stretched copies and detects real geometric edits',()=>{
  const original=drawEmergencyHotelCase(61),expected=emergencyHotelStructureSignature(original);
  for(let turn=0;turn<4;turn++){
   const copy={...original,G:original.G.slice().reverse().map(g=>({...g,pos:[],col:g.col.map(()=>.7)}))};
   original.G.slice().reverse().forEach((g,i)=>{const tris=[];for(let t=0;t<g.pos.length;t+=9){const points=[];for(let j=0;j<9;j+=3){let x=g.pos[t+j],z=g.pos[t+j+2];for(let q=0;q<turn;q++)[x,z]=[-z,x];points.push([12.3+x*2.7,-.9+g.pos[t+j+1]*.37,-8.2+z*.61]);}tris.push(points.reverse().flat());}copy.G[i].pos=tris.reverse().flat();});
   assert.equal(emergencyHotelStructureSignature(copy),expected,'identity ignores parcel metadata, ordering and color');copy.G.find(g=>g.pos.length).pos[1]+=.01;assert.notEqual(emergencyHotelStructureSignature(copy),expected,'real geometry edit detected');
  }
 });
 test('negative controls reject nonfinite/incomplete geometry, owner loss, collapse, overflow, wrong normals and trees',()=>{
  const arena=r=>r.G.find(g=>g.pos.length);
  for(const mutation of [r=>arena(r).pos[0]=NaN,r=>arena(r).owners[0]=0,r=>arena(r).owners.pop(),r=>arena(r).uv.pop(),r=>r.G[0].wst.push(1),r=>arena(r).tags.pop(),r=>arena(r).pos.splice(3,3,...arena(r).pos.slice(0,3)),r=>arena(r).pos[0]=r.x0+r.s+1,r=>arena(r).pos[1]=r.y0+r.H+.01,r=>arena(r).pos[1]=r.y0-.01,r=>arena(r).nor[0]=NaN,r=>arena(r).nor.splice(3,3,...arena(r).nor.slice(3,6).map(n=>-n)),r=>arena(r).nor.splice(0,3,0,0,0),r=>r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5})]){const r=drawEmergencyHotelCase(61);mutation(r);assert.throws(()=>validEmergencyHotelGeometry(r));}
  const tilted=drawEmergencyHotelCase(61),g=arena(tilted),n=new THREE.Vector3(...g.nor.slice(0,3)),axis=Math.abs(n.y)<.8?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),tangent=axis.addScaledVector(n,-axis.dot(n)).normalize(),wrong=n.multiplyScalar(Math.SQRT1_2).addScaledVector(tangent,Math.SQRT1_2);g.nor.splice(0,3,...wrong.toArray());assert.throws(()=>validEmergencyHotelGeometry(tilted),/perpendicular/,'unit normals must be perpendicular, not merely in the right hemisphere');
 });
 test('copied previews change only supported slots and preserve original world and unsupported records',()=>{
  for(const sample of ['gallery','seed516','ai120']){const city=d073City(sample),before=sha(city);assert.equal(d073EmergencyHotelCity(city,null),city,'native preview is the original object');for(const variant of [0,1,2]){const copy=d073EmergencyHotelCity(city,variant);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history fields shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(isEmergencyHotel(b.k,variant)){assert.notEqual(v,b);assert.equal(v.v,variant);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b,'unsupported requested slots keep the original building record');}}}
 });
 test('actual production emergencyHotel preview and hook retain unsupported slots and reject coercion',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),expression=view.match(/const emergencyHotelView = \(c: City\): City => ([^\n]+);/);assert.ok(expression,'production copied-view expression is exposed');
  const preview=Function('c','emergencyHotelForcedV','EMERGENCY_HOTEL_BUILDINGS','return '+expression[1].replaceAll('emergencyHotelForcedV!','emergencyHotelForcedV'));
  const records=[];for(const k of [0,...D073_KINDS,32,65,999,'109','31'])for(const v of [0,1,2,7])records.push({id:records.length+1,k,v,size:2,x:4,z:6,history:[{day:3,kind:'placed'}]});
  const world=frozen({buildings:records,history:[{day:3,kind:'snapshot'}],day:9,seed:516}),before=sha(world);
  for(const v of [null,0,1,2]){const actual=preview(world,v,EMERGENCY_HOTEL_BUILDINGS),expected=d073EmergencyHotelCity(world,v);assert.deepEqual(actual,expected,'real production expression matches independent exact-slot selection');assert.equal(actual.history,world.history);assert.equal(sha(world),before);if(v===null){assert.equal(actual,world);continue;}assert.notEqual(actual,world);assert.notEqual(actual.buildings,world.buildings);for(let i=0;i<records.length;i++){const b=records[i],copy=actual.buildings[i];if(isEmergencyHotel(b.k,v)){assert.notEqual(copy,b);assert.deepEqual(copy,{...b,v});assert.equal(copy.history,b.history);}else assert.equal(copy,b,'unsupported requested variant leaves the exact original record unchanged');}}
  const method=view.match(/emergencyHotelV\(v: number \| null\) \{ ([^\n]+) \},/);assert.ok(method,'production public hook is exposed');
  const hook=Function('let emergencyHotelForcedV=null,needsRender=false,rebuilds=0,draws=0;const rebuildScene=fresh=>{if(fresh!==true)throw new Error("preview must rebuild fresh");rebuilds++;};const draw=()=>draws++;return {call(v){'+method[1]+'},state(){return {emergencyHotelForcedV,needsRender,rebuilds,draws};}};')();
  for(const v of [0,1,2,null]){const was=hook.state();assert.equal(hook.call(v),v);assert.deepEqual(hook.state(),{emergencyHotelForcedV:v,needsRender:true,rebuilds:was.rebuilds+1,draws:was.draws+1});}
  for(const v of [undefined,-1,3,.5,'0','1','2',true,false,NaN,Infinity]){const was=hook.state();assert.throws(()=>hook.call(v),/supports saved variants/);assert.deepEqual(hook.state(),was,'invalid request cannot update preview state or rebuild');if(v===undefined)assert.equal(d073EmergencyHotelCity(world,v),world,'omitted helper variant means native');else assert.throws(()=>d073EmergencyHotelCity(world,v),'independent copied preview rejects invalid input');}
 });
 test('three real cities × three modes × native/v0/v1/v2 preserve all other owners with zero whole-scene growth',()=>{
  let targets=0;const covered=new Set();for(const variant of [null,0,1,2])for(const sample of ['seed516','ai120','gallery']){
   const preview=variant===null?'native':'v'+variant,source=d073City(sample),sourceHash=sha(source),city=d073EmergencyHotelCity(source,variant),world=sha(city),wanted=city.buildings.filter(b=>isEmergencyHotel(b.k,b.v)&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   for(const mode of ['a','b','c']){
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=D073_OLD[preview][sample][mode];assert.equal(off.cost,old[0]);assert.equal(off.sig,old[1],'immutable immediate-D072 same-world/view signature');assert.equal(sha(city),world,'renderer preserves copied city/history');assert.equal(sha(source),sourceHash,'renderer preserves original world/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground);assert.deepEqual(on.dg.inst,off.dg.inst,'tree instances unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${preview} ${mode} mesh${mi} owner${id} exact bytes`);});for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile${i} unchanged`);});
    let delta=0;for(const b of wanted){const key=b.k+':'+b.v,a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.equal(a,D073_CAP[key]);assert.ok(n>=12&&n<=a,`${key}: ${n} <= ${a}`);assert.ok(on.content.some((rows,mi)=>rows[b.id]!==off.content[mi][b.id]),'each exact target slot changes');delta+=n-a;targets++;covered.add(key);}
    assert.equal(on.cost-off.cost,delta,'whole-city delta consists of exact target owners only');assert.ok(on.cost<=off.cost);if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.deepEqual(on,off,'no-target cities exactly unchanged');report.cities.push({sample,preview,mode,targets:wanted.length,before:off.cost,after:on.cost,delta,worldSha256:sourceHash});
   }
  }assert.equal(targets,39,'native/v0/v1 have three targets; v2 has four targets; all three modes and both unchanged-city controls covered');assert.equal(covered.size,10,'all ten actual kind/variant slots rendered in real copied galleries');
 });
 test('every exact-slot production-batched model has real faces that pick its owning building',()=>{
  const source=d073City('gallery'),before=sha(source),covered=new Set();let picks=0;
  for(const variant of [0,1,2])for(const mode of ['a','b','c']){const city=d073EmergencyHotelCity(source,variant),con=new ConState(city.n),built=buildCityScene(city,D073_KT,STYLES.A,d073Blocks(city,mode),'d',d073Civic(true),con,true);
   try{const wanted=city.buildings.filter(b=>isEmergencyHotel(b.k,b.v)&&b.goneDay===undefined),ids=new Set(wanted.map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const b of wanted){assert.ok([...seen].some(key=>key.startsWith(b.id+':')),`mode ${mode}: k${b.k} v${b.v} owner${b.id} is pickable`);covered.add(b.k+':'+b.v);}
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=30,'at least one actual hit for each supported forced-gallery target in all three modes');assert.equal(covered.size,10);assert.equal(sha(source),before);
 });
 test('procedural sources and reversible scope preserve simulation, saves, fifty earlier models and historical gates',()=>{
  for(const file of ['src/content/britishEmergencyHotels.ts','src/render/britishEmergencyHotelArt.ts']){const source=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\/\/.*$/gm,'');for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b|\bwindow\b|\blocation\b/,/data:image|\.png|\.jpe?g|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])assert.doesNotMatch(source,re,file);}
  const allowed=new Set(['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishEmergencyHotels.ts','src/render/britishEmergencyHotelArt.ts']),changed=execFileSync('git',['diff','--name-only',D073_BASELINE,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const file of [...changed,...untracked])assert.ok(allowed.has(file),'approved render-only source: '+file);
  assertD073Scope();const manifest=read('fixtures/d073-art-scope.json');for(const file of manifest.modified)assert.equal(createHash('sha256').update(d073HistoricalBytes(file)).digest('hex'),manifest.before[file],'exact published D072 historical bytes');
  for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/recipes.ts','src/render/scene.ts','src/render/cityScene.ts','src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceFacilities.ts','src/render/britishCommerceFacilityArt.ts','src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts','src/content/britishCommerceThird.ts','src/render/britishCommerceThirdArt.ts','src/content/britishEducation.ts','src/render/britishEducationArt.ts','src/content/britishCampuses.ts','src/render/britishCampusArt.ts','src/content/britishEmergencyHotels.ts','src/render/britishEmergencyHotelArt.ts']){const mutated=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized mutation':'');assert.throws(()=>assertD073Scope(mutated),/exact allowed source/,'scope rejects '+target);assert.throws(()=>d073HistoricalBytes(target,mutated),/exact allowed source/,'historical restoration rejects '+target);}
 });
 test('sixteen legacy switches disable only this wave; copied v0/v1/v2 hook never writes saved worlds',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),match=view.match(/const emergencyHotelOn = ([^;]+);/);assert.ok(match);const flags=['emergencyHotelArt','campusArt','educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false,flag+' disables emergencyHotel');assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn|commerceVariantOn|commerceThirdOn|educationOn|campusOn)|(?:village|industry|commerce|house)Art:/.test(line)))assert.ok(!line.includes('emergencyHotelArt'),'emergencyHotel switch never disables earlier art');assert.match(view,/shapeOf\([^\n]*facilityOn, commerceVariantOn, commerceThirdOn, educationOn, campusOn, emergencyHotelOn\)/);assert.match(view,/emergencyHotelV\(v: number \| null\)/);assert.match(view,/buildings: c\.buildings\.map\(/,'preview copies building records');assert.match(view,/emergencyHotelView\(campusView\(educationView\(commerceThirdView\(commerceView\(towerView\(c\)\)\)\)\)\)/,'production renders explicitly copied emergencyHotel view');
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {failed,report}=await d073Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d073'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d073/D073-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

// D077: ten exact serviceLodge slots, immediate published D076 budgets and read-only integration.
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
import {SERVICE_LODGE_KINDS,SERVICE_LODGE_BUILDINGS} from '../src/content/britishServiceLodges.ts';
import {drawBritishServiceLodges} from '../src/render/britishServiceLodgesArt.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058City,d058Blocks} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {assertD077Scope,d077HistoricalBytes} from './d077-scope.mjs';
import {FACILITY_TOOLS} from '../src/sim/edit.ts';
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const frozen=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(frozen);Object.freeze(o);}return o;};
export const D077_BASELINE='7d4df8a907368a25f1ff92958b8b70ae85b8ad1c';
const D077_CARD_SHA256='bb9794fefac1f716f0c64d068a817ea5c92ea7efa211bfd4099c96743a1ba26b';
assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT,'docs/D077-british-service-lodges-ten.md'))).digest('hex'),D077_CARD_SHA256,'immutable pre-code acceptance card');
export const D077_SLOTS=frozen([[164,0],[164,1],[164,2],[119,0],[119,1],[119,2],[116,0],[149,4],[81,0],[81,1]]);
export const D077_KINDS=Object.freeze([164,119,116,149,81]);
const isServiceLodge=(k,v)=>D077_SLOTS.some(([a,b])=>a===k&&b===v);
const baselineBytes=fs.readFileSync(path.join(ROOT,'fixtures/d077-geometry-before.json'));
assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'feb1fe0c212e0c1e5d06757e2d0ac4ba15a5571e03544d9c3141670f19eb0beb','immutable isolated-D076 geometry fixture');
const BASE=frozen(JSON.parse(baselineBytes));assert.equal(BASE.baseline,D077_BASELINE);
const sourceBeforeBytes=fs.readFileSync(path.join(ROOT,'fixtures/d077-source-before.json'));
assert.equal(createHash('sha256').update(sourceBeforeBytes).digest('hex'),'3a1ad1e18b04c404dbd6460d3c927d64f2a00654f45ddaaa7c3dcba57a71da92','immutable isolated-D076 source inventory');
assert.equal(BASE.sourceSha256,sha(JSON.parse(sourceBeforeBytes).before),'geometry fixture and independent source capture share the exact release source inventory');
export const D077_CAP=frozen(Object.fromEntries(Object.entries(BASE.slots).map(([slot,r])=>[slot,r.cost])));
assert.deepEqual(D077_CAP,{'164:0':56,'164:1':56,'164:2':56,'119:0':68,'119:1':68,'119:2':68,'116:0':60,'149:4':60,'81:0':28,'81:1':28},'independently declared exact-slot published weighted caps');
const historicalBytes=fs.readFileSync(path.join(ROOT,'fixtures/d077-history-before.json'));
assert.equal(createHash('sha256').update(historicalBytes).digest('hex'),'af929be27ccf7fa53bd5b572e8289530474871cd38e83abcb557afab16c6dd56','immutable independently archived historical fixture inventory');
const HISTORICAL=frozen(JSON.parse(historicalBytes));assert.equal(HISTORICAL.baseline,D077_BASELINE);
export const D077_PRESERVED=BASE.preserved;
export const D077_OLD=BASE.cities;
export const D077_MODEL_OLD=BASE.slots;
export const D077_PRIOR_MODELS=BASE.priorModels;
export const D077_KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const d077City=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
// Match the production render-only preview. Original saves and records never change.
export function d077ServiceLodgeCity(city,v=null){
 assert.ok(v===null||v===0||v===1||v===2||v===4,'supported copied serviceLodge variant');
 return v===null?city:{...city,buildings:city.buildings.map(b=>isServiceLodge(b.k,v)?{...b,v}:b)};
}
export const d077Civic=on=>({shape:k=>shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D077_KT.catColor(D077_KT.cat(k)))});
export const d077Blocks=(city,mode='c')=>({...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true,houseArt:true});
export const d077Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
// Binary preservation also distinguishes signed zero, which JSON signatures intentionally do not.
const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
export function drawServiceLodgeCase(k,{v=0,lv=1,s=D077_KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,D077_KT.height(k,lv,v)),owner=71,on=true,turn=0}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const C=kindColors(LOOKS,k,lv,D077_KT.catColor(D077_KT.cat(k))),args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind preserves every scalar/color input');
 const r={G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,turn,cost:d077Cost(G)};
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
export function serviceLodgeStructureSignature(r){
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
// New targets have no trees; previous-wave trees are pinned independently below.
export const d077ExpectedTrees=r=>[];
export function assertServiceLodgeBudget(r){const actual=d077Cost(r.G),cap=D077_CAP[r.k+':'+r.v];assert.ok(Number.isFinite(cap),'exact target budget exists');assert.equal(r.cost,actual,'reported weighted cost equals actual arenas');assert.ok(actual>=12&&actual<=cap,`weighted geometry budget ${actual} exceeds immutable cap ${cap}`);return actual;}
export function validServiceLodgeGeometry(r){
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 assert.equal(r.G.length,3,'exactly the existing three arenas');assert.equal(r.trees.length,0,'new service/lodge slots have no trees');
 const treePin=BASE.treeCases[JSON.stringify([r.k,r.v,r.s,r.H,r.x0,r.z0,r.y0,r.turn??0])];if(treePin)assert.deepEqual(r.trees,treePin,'ordered tree transforms equal isolated published release');
 assert.deepEqual(r.trees,d077ExpectedTrees(r),'all ordered trees equal independent legacy formula for current height, size and rigid transform');
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
// Independent architecture contracts. These numeric plans are requirements, never
// collected from production triangles, material colors, camera visibility or metadata.
const roofs=[],walls=[];
const wallPlan=(k,v,id,plan,h0,heights)=>{
 const hs=typeof heights==='number'?plan.map(()=>heights):heights,panels=[],shellDirections={};
 for(let i=0;i<plan.length;i++){const a=plan[i],b=plan[(i+1)%plan.length],ha=hs[i],hb=hs[(i+1)%plan.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);panels.push([[a[0],h0,a[1]],[b[0],h0,b[1]],[b[0],hb,b[1]],[a[0],ha,a[1]]]);shellDirections[i]=[dz/len,0,-dx/len];}
 walls.push({k,v,id:id+'-walls',panels,shellDirections,nonRoof:true});
};
const rectangle=(a,b,c,d)=>[[a,c],[b,c],[b,d],[a,d]];
const contractBox=(k,v,id,a,b,c,d,low,top,extra={})=>{wallPlan(k,v,id,rectangle(a,b,c,d),low,top);roofs.push({k,v,id,panels:[[[a,top,c],[b,top,c],[b,top,d],[a,top,d]]],...extra});};
// Z-axis quads traverse the clockwise D→A and C→B facades. Both legal
// diagonals were independently union/area checked; this fixes the exact one.
const contractPitch=(k,v,id,a,b,c,d,h,rise,axis='x')=>{
 wallPlan(k,v,id,rectangle(a,b,c,d),0,h);
 const A=[a,h,c],B=[b,h,c],D=[b,h,d],E=[a,h,d],L=axis==='x'?[a,h+rise,(c+d)/2]:[(a+b)/2,h+rise,c],R=axis==='x'?[b,h+rise,(c+d)/2]:[(a+b)/2,h+rise,d];
 roofs.push({k,v,id,panels:axis==='x'?[[A,B,R,L],[E,D,R,L],[A,E,L],[B,D,R]]:[[E,A,L,R],[D,B,L,R],[A,B,L],[E,D,R]],shellDirections:axis==='x'?{2:[-1,0,0],3:[1,0,0]}:{2:[0,0,-1],3:[0,0,1]}});
};
const contractHip=(k,v,id,a,b,c,d,h,rise)=>{
 wallPlan(k,v,id,rectangle(a,b,c,d),0,h);const A=[a,h,c],B=[b,h,c],D=[b,h,d],E=[a,h,d],L=[a+.23*(b-a),h+rise,(c+d)/2],R=[b-.23*(b-a),h+rise,(c+d)/2];
 roofs.push({k,v,id,panels:[[A,B,R,L],[E,D,R,L],[A,E,L],[B,D,R]]});
};
const contractMono=(k,v,id,a,b,c,d,ha,hb)=>{
 wallPlan(k,v,id,rectangle(a,b,c,d),0,[ha,hb,hb,ha]);roofs.push({k,v,id,panels:[[[a,ha,c],[b,hb,c],[b,hb,d],[a,ha,d]]]});
};
// Frozen numeric contracts supplied as architectural requirements before production
// implementation. No coordinate or direction is extracted from emitted geometry.
contractPitch(164,0,'utility-headhouse',.12,.70,.28,.66,.50,.28);
contractBox(164,0,'utility-ventilation-tower',.78,.90,.16,.36,0,1);
const contractL=(k,v,id,plan,h)=>{
 wallPlan(k,v,id,plan,0,h);roofs.push({k,v,id,panels:[[0,1,2],[0,2,3],[0,3,5],[3,4,5]].map(indices=>indices.map(i=>[plan[i][0],h,plan[i][1]]))});
};
const contractPyramid=(k,v,id,a,b,c,d,h,x,z,peak)=>{
 const plan=rectangle(a,b,c,d);wallPlan(k,v,id,plan,0,h);roofs.push({k,v,id,panels:plan.map((p,i)=>[[p[0],h,p[1]],[plan[(i+1)%4][0],h,plan[(i+1)%4][1]],[x,peak,z]])});
};
contractL(164,1,'conduit-l-plan',[[.12,.16],[.72,.16],[.72,.36],[.35,.36],[.35,.78],[.12,.78]],.64);
contractPyramid(164,1,'conduit-vent-pavilion',.54,.80,.52,.78,.57,.67,.65,1);
{
 const k=164,v=2,id='access-lantern-roof',plan=rectangle(.16,.80,.20,.76);wallPlan(k,v,id,plan,0,.54);
 const [A,B,C,D]=plan.map(([x,z])=>[x,.54,z]),[a,b,c,d]=rectangle(.35,.61,.37,.59).map(([x,z])=>[x,.75,z]);
 roofs.push({k,v,id,panels:[[A,B,b,a],[B,C,c,b],[C,D,d,c],[D,A,a,d]]});
}
contractBox(164,2,'access-raised-lantern',.35,.61,.37,.59,.75,1);
// Approved physical-clearance repair: widen the cooking court from .08 to .16
// parcel units; lower the loading contact eave to .34H. Complete surfaces,
// fixed sample policy, original H, main ridges and all historical pins remain.
contractMono(119,0,'cookhouse-high-hall',.12,.45,.18,.63,.65,.45);
contractMono(119,0,'cookhouse-low-hall',.61,.88,.34,.74,.36,.51);
contractBox(119,0,'cookhouse-square-chimney',.73,.82,.12,.21,0,1);
contractPitch(119,1,'production-gabled-hall',.12,.48,.16,.78,.57,.32,'z');
contractMono(119,1,'production-loading-range',.48,.86,.30,.63,.34,.25);
contractBox(119,1,'production-chimney',.70,.78,.14,.22,0,1);
contractPyramid(119,2,'service-kitchen-pyramid',.14,.58,.20,.64,.54,.36,.42,.88);
contractBox(119,2,'service-preparation-range',.58,.90,.34,.64,0,.30);
contractBox(119,2,'service-kitchen-chimney',.72,.79,.16,.23,0,1);
contractL(116,0,'exchange-machine-house',[[.12,.16],[.68,.16],[.68,.33],[.36,.33],[.36,.74],[.12,.74]],1);
contractMono(116,0,'exchange-equipment-wing',.52,.88,.49,.77,.53,.35);
{
 const k=149,v=4,id='dispatch-octagonal-hall',plan=[[.18,.28],[.30,.16],[.62,.16],[.76,.30],[.76,.62],[.62,.76],[.30,.76],[.18,.62]];
 wallPlan(k,v,id,plan,0,1);roofs.push({k,v,id,panels:[plan.map(([x,z])=>[x,1,z])]});
 const wing=[[.76,.36],[.92,.58],[.76,.62]];wallPlan(k,v,'dispatch-triangle-entry',wing,0,.30);roofs.push({k,v,id:'dispatch-triangle-entry',panels:[wing.map(([x,z])=>[x,.30,z])]});
}
{
 const k=81,v=0,id='guesthouse-single-hip',plan=rectangle(.12,.88,.22,.76);wallPlan(k,v,id,plan,0,.56);
 const [A,B,C,D]=plan.map(([x,z])=>[x,.56,z]),L=[.34,1,.49],R=[.88,1,.49];
 roofs.push({k,v,id,panels:[[A,B,R,L],[D,C,R,L],[A,D,L],[B,C,R]],shellDirections:{3:[1,0,0]}});
}
{
 const k=81,v=1,id='guesthouse-oblique-gables',plan=[[.12,.27],[.64,.13],[.90,.73],[.38,.87]];wallPlan(k,v,id,plan,0,.60);
 const [A,B,C,D]=plan.map(([x,z])=>[x,.60,z]),L=[.25,1,.57],R=[.77,1,.43],n=Math.hypot(.60,.26);
 roofs.push({k,v,id,panels:[[A,B,R,L],[D,C,R,L],[A,D,L],[B,C,R]],shellDirections:{2:[-.60/n,0,.26/n],3:[.60/n,0,-.26/n]}});
}
const D077_GROUND_DRESS_TRIS=frozen({'164:0':4,'164:1':0,'164:2':2,'119:0':2,'119:1':0,'119:2':2,'116:0':4,'149:4':0,'81:0':0,'81:1':0});
function assertServiceLodgeGroundDress(r){
 const g=r.G[2];assert.equal(g.owners.length,D077_GROUND_DRESS_TRIS[r.k+':'+r.v],'only independently allocated ground paving remains in D');
 for(let i=0;i<g.pos.length;i+=3){assert.ok(Math.abs(g.pos[i+1]-(r.y0+.004*r.H))<1e-9,'every D vertex stays at the declared ground paving level');assert.ok(g.nor[i]===0&&g.nor[i+1]===1&&g.nor[i+2]===0,'every D surface faces straight upward; facade covers are forbidden');}
}
const ROOF_COMPONENT_COUNT=21,OPEN_COURT_COUNT=10;
export const D077_ROOFS=frozen(roofs),D077_WALLS=frozen(walls);
export const D077_OPEN_COURTS=frozen([
 {k:164,v:0,id:'headhouse-arrival',points:[[.20,.80],[.50,.80],[.70,.10]],ceiling:.02},
 {k:164,v:1,id:'conduit-open-court',points:[[.46,.46],[.68,.43],[.88,.80]],ceiling:.02},
 {k:164,v:2,id:'lantern-arrival',points:[[.10,.50],[.90,.50],[.45,.90]],ceiling:.02},
 {k:119,v:0,id:'cookhouse-working-yard',points:[[.53,.30],[.40,.82],[.90,.90]],ceiling:.02},
 {k:119,v:1,id:'production-loading-yard',points:[[.60,.80],[.90,.20],[.30,.90]],ceiling:.02},
 {k:119,v:2,id:'service-kitchen-yard',points:[[.25,.80],[.65,.20],[.80,.80]],ceiling:.02},
 {k:116,v:0,id:'exchange-recessed-court',points:[[.44,.45],[.45,.70],[.80,.90]],ceiling:.02},
 {k:149,v:4,id:'dispatch-arrival-yard',points:[[.10,.80],[.90,.25],[.50,.90]],ceiling:.02},
 {k:81,v:0,id:'single-hip-arrival',points:[[.10,.10],[.50,.10],[.90,.90]],ceiling:.02},
 {k:81,v:1,id:'oblique-arrival',points:[[.10,.80],[.85,.12],[.93,.70]],ceiling:.02},
]);
export const D077_CONTACTS=frozen([
 {k:119,v:1,id:'production-main-loading-contact',x:.48,z0:.30,z1:.63,h:.34,left:'production-gabled-hall',right:'production-loading-range'},
 {k:119,v:2,id:'kitchen-preparation-contact',x:.58,z0:.34,z1:.64,h:.30,left:'service-kitchen-pyramid',right:'service-preparation-range'},
 {k:149,v:4,id:'dispatch-triangle-contact',x:.76,z0:.36,z1:.62,h:.30,left:'dispatch-octagonal-hall',right:'dispatch-triangle-entry'},
]);
// Distinct closed ground-mounted solids. The raised lantern's lower opening is
// joined to the ring's actual opening, so only their combined shell is a solid.
export const D077_SOLIDS=frozen(D077_ROOFS.filter(s=>s.id!=='access-raised-lantern').map(s=>({k:s.k,v:s.v,id:s.id,parts:s.id==='access-lantern-roof'?['access-lantern-roof','access-raised-lantern']:[s.id]})));
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
export function d077RoofSamples(k,v){
 const specs=D077_ROOFS.filter(s=>s.k===k&&s.v===v&&!s.nonRoof),all=specs.flatMap(s=>roofTriangles(s).filter(t=>!s.shellDirections?.[t.panel])).map(t=>t.points).filter(roofUp),samples=[];
 for(const spec of specs)for(const [panel]of spec.panels.entries()){
  if(spec.shellDirections?.[panel])continue;
  const interior=roofTriangles(spec).filter(t=>t.panel===panel&&roofUp(t.points)).flatMap(t=>roofInterior(t.points)),exposed=interior.filter(([x,h,z])=>!all.some(t=>{const top=roofHeight(t,x,z);return top!==null&&top>h+1e-8;}));
  if(exposed.length===0)continue;assert.ok(exposed.length>=3,spec.id+' has three independently exposed interior roof samples');
  const selected=[exposed[0]],distance=(a,b)=>(a[0]-b[0])**2+(a[2]-b[2])**2;while(selected.length<3){const candidates=exposed.filter(p=>!selected.includes(p)).sort((a,b)=>Math.min(...selected.map(p=>distance(b,p)))-Math.min(...selected.map(p=>distance(a,p))));selected.push(candidates[0]);}
  for(const [sample,p]of selected.entries())samples.push({id:spec.id+':'+panel+':'+sample,component:spec.id,panel,x:p[0],z:p[2],h:p[1]});
 }return samples;
}
export function serviceLodgeRoofTriangles(r,spec){
 const expected=new Set(roofTriangles(spec).map(t=>roofTriKey(t.points))),out=[];
 for(const [gi,g]of r.G.entries())for(let ti=0;ti<g.pos.length/9;ti++){const points=[];for(let j=0;j<9;j+=3)points.push(roofNormalized(r,g.pos.slice(ti*9+j,ti*9+j+3)));if(expected.has(roofTriKey(points)))out.push({gi,ti,points});}
 return out;
}
export function assertServiceLodgeRoofClosure(r,spec){
 const expected=roofTriangles(spec).map(t=>t.points),actual=serviceLodgeRoofTriangles(r,spec);
 assert.deepEqual(actual.map(t=>roofTriKey(t.points)).sort(),expected.map(roofTriKey).sort(),spec.id+' has every intended roof plane and closing end face exactly once');
 assert.ok(actual.every(t=>t.gi<2),spec.id+' every architectural shell face stays in shadow-casting W/O arenas');
 assert.deepEqual(roofEdges(actual.map(t=>t.points)),roofEdges(expected),spec.id+' has no missing slope, unjoined edge, duplicated cap or open gable');
 const counts=roofEdges(expected);assert.ok(counts.every(([,count])=>count===1||count===2),spec.id+' independent roof specification is manifold above its intended boundary');
 return actual;
}
export function assertServiceLodgeRoofCoverage(r,spec){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.G.flatMap(g=>g.pos),3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.FrontSide}));let probes=0;
 try{for(const {panel,points}of roofTriangles(spec)){
  const outward=spec.shellDirections?.[panel];
  if(outward){
   const normal=new THREE.Vector3(...outward);for(let q=0;q<(r.turn??0);q++)[normal.x,normal.z]=[-normal.z,normal.x];
   // Barycentric targets are built directly from the independently specified,
   // GPU-quantized face. Rays approach the soffit from below and the high wall
   // from outside; neither a wrong-facing face nor a nearby roof is acceptable.
   for(const p of roofInterior(points.map(p=>roofWorld(r,p,true)))){
    const point=new THREE.Vector3(...p),hits=new THREE.Raycaster(point.clone().addScaledVector(normal,.1),normal.clone().negate()).intersectObject(mesh);
    assert.ok(hits.some(hit=>hit.point.distanceTo(point)<1e-6*Math.max(1,r.s,r.H)&&hit.face.normal.dot(normal)>1-1e-6),spec.id+' front-sided roof shell covers its independently intended face and outward direction: panel '+panel);probes++;
   }continue;
  }
  if(!roofUp(points))continue;const gpu=points.map(p=>roofWorld(r,p,true));for(const p of roofInterior(points)){
   const world=roofWorld(r,p),expected=roofHeight(gpu,world[0],world[2]);assert.notEqual(expected,null,spec.id+' independent sample lies within its GPU-quantized plane');
   const hits=new THREE.Raycaster(new THREE.Vector3(world[0],r.y0+r.H+1,world[2]),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
   assert.ok(hits.some(hit=>Math.abs(hit.point.y-expected)<1e-6*Math.max(1,r.H)&&hit.face.normal.y>0),spec.id+' front-sided roof covers its independently intended height; lower caps or lone pediments cannot substitute');probes++;
  }}return probes;}finally{geometry.dispose();mesh.material.dispose();}
}
export function assertServiceLodgeClosedSolid(r,solid){
 const specs=solid.parts.flatMap(id=>[D077_ROOFS.find(s=>s.k===solid.k&&s.v===solid.v&&s.id===id),D077_WALLS.find(s=>s.k===solid.k&&s.v===solid.v&&s.id===id+'-walls')]);
 assert.ok(specs.every(Boolean),'every closed solid has independently specified roof and complete walls');
 const triangles=specs.flatMap(spec=>assertServiceLodgeRoofClosure(r,spec)),edges=roofEdges(triangles.map(t=>t.points)),boundaries=[];
 for(const [edge,count]of edges){assert.ok(count===1||count===2,solid.id+' complete solid has manifold edge incidence');if(count===1){const points=edge.split('|').map(v=>v.split(',').map(Number));assert.ok(points.every(v=>v[1]===0),solid.id+' only ground-contact boundary is permitted; no open elevated edge');boundaries.push(edge);}}
 assert.ok(boundaries.length>=3,solid.id+' ground-contact seal has its entire perimeter');
 return {id:solid.id,triangles:triangles.length,groundEdges:boundaries.length};
}
export function assertServiceLodgeContact(r,spec){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.G.flatMap(g=>g.pos),3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.FrontSide}));let probes=0;
 try{for(const side of [-1,1]){const normal=new THREE.Vector3(side,0,0);for(let q=0;q<(r.turn??0);q++)[normal.x,normal.z]=[-normal.z,normal.x];for(const z of [.23,.51,.77])for(const h of [.19,.43,.81]){
  const point=new THREE.Vector3(...roofWorld(r,[spec.x,h*spec.h,spec.z0+z*(spec.z1-spec.z0)],true)),hits=new THREE.Raycaster(point.clone().addScaledVector(normal,.01*r.s),normal.clone().negate()).intersectObject(mesh);
  assert.ok(hits.some(hit=>hit.point.distanceTo(point)<1e-6*Math.max(1,r.s,r.H)&&hit.face.normal.dot(normal)>1-1e-6),spec.id+' contact retains both complete opposite-facing wall partners');probes++;
 }}return probes;}finally{geometry.dispose();mesh.material.dispose();}
}
function assertServiceLodgeRoofInventory(r){
 const assigned=new Set();for(const spec of D077_ROOFS.filter(s=>s.k===r.k&&s.v===r.v))for(const {gi,ti}of assertServiceLodgeRoofClosure(r,spec)){const key=gi+':'+ti;assert.ok(!assigned.has(key),'a roof triangle belongs to exactly one independent component');assigned.add(key);}
 let upward=0;for(let gi=0;gi<2;gi++){const g=r.G[gi];for(let ti=0;ti<g.pos.length/9;ti++)if(g.nor[ti*9+1]>1e-8){assert.ok(assigned.has(gi+':'+ti),'every real upward shadow surface has an independent roof or wall-cap pin');upward++;}}
 assert.ok(upward>0,'real roofs exist');return upward;
}
function roofMutation(r,targets,reverse=false){
 const copy=structuredClone(r);for(let gi=0;gi<copy.G.length;gi++){const indices=new Set(targets.filter(t=>t.gi===gi).map(t=>t.ti)),g=copy.G[gi];if(reverse){for(const ti of indices)for(let j=0;j<3;j++)[g.pos[ti*9+3+j],g.pos[ti*9+6+j]]=[g.pos[ti*9+6+j],g.pos[ti*9+3+j]];}else for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){const stride=key==='uv'?6:['owners','tags'].includes(key)?1:['wst','wbd'].includes(key)?3:9;g[key]=g[key].filter((_,i)=>!indices.has(Math.floor(i/stride)));}}
 copy.cost=d077Cost(copy.G);return copy;
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
 const con=new ConState(city.n),built=buildCityScene(city,D077_KT,STYLES.A,d077Blocks(city,mode),'d',d077Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d077Expected(){const out={};for(const v of [null,0,1,2,4]){const key=v===null?'native':'v'+v;out[key]={};for(const sample of ['seed516','ai120','gallery']){const city=d077ServiceLodgeCity(d077City(sample),v),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[key][sample]={legacy:old.cost,serviceLodge:now.cost,delta:now.cost-old.cost};}}return out;}
export async function d077Guards(log=()=>{}){
 let failed=0;const guardSourceSha256=createHash('sha256').update(fs.readFileSync(path.join(ROOT,'tools/unit-d077.mjs'))).digest('hex'),sourceInventorySha256=sha(read('fixtures/d077-art-scope.json').after);const report={baseline:D077_BASELINE,cardSha256:D077_CARD_SHA256,guardSourceSha256,sourceInventorySha256,contractSha256:sha({roofs:D077_ROOFS,walls:D077_WALLS,solids:D077_SOLIDS,contacts:D077_CONTACTS,courts:D077_OPEN_COURTS,groundDress:D077_GROUND_DRESS_TRIS}),qualification:'Node geometry tests only; browser/WebGL captures are separate evidence.',tests:[],geometryCases:0,preservedCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D077 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D077 '+name,e.stack??String(e));}};
 test('ten exact slots on five existing kinds; fourteenth argument defaults off for every historical flag combination',()=>{
  assert.deepEqual([...SERVICE_LODGE_KINDS],D077_KINDS);assert.equal(SERVICE_LODGE_BUILDINGS.length,10);assert.equal(new Set(SERVICE_LODGE_BUILDINGS.map(b=>b.id)).size,10);assert.deepEqual(SERVICE_LODGE_BUILDINGS.map(b=>[b.k,b.v]),D077_SLOTS);
  for(const k of [0,...D077_KT.data.kinds.map(r=>r.k),999]){
   const off=shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true,false),on=shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true,true);
   assert.deepEqual(shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true),off,'fourteenth argument defaults off');
   if(SERVICE_LODGE_KINDS.has(k)){assert.notDeepEqual(on,off);assert.equal(on.p.serviceLodge,true);assert.deepEqual(on,{...off,p:{...off.p,serviceLodge:true}},'new flag preserves the exact prior shape and every applicable fallback flag');}else assert.deepEqual(on,off,`non-target ${k} dispatch unchanged`);
   for(let mask=0;mask<4096;mask++){const flags=Array.from({length:12},(_,i)=>Boolean(mask&(1<<i)));assert.deepEqual(shapeOf(k,...flags),shapeOf(k,...flags,false),'all 4096 prior flag combinations preserve fourteenth-argument default');}
  }
 });
 test('strict numeric saved slots only; all rejected kinds and variants emit no direct geometry',()=>{
  for(const k of [0,...D077_KINDS,135,28,65,999,'164','119','116','149','81',null,undefined])for(const v of [undefined,null,-1,0,1,2,3,4,5,6,7,8,9,10,.5,1.5,2.5,3.5,4.5,'0','1','2','3','4',true,false,NaN,Infinity]){
   const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors(LOOKS,k,1,'#ffffff')},before=sha(a),accept=isServiceLodge(k,v);
   assert.equal(drawBritishServiceLodges(new Pen(a)),accept,`direct acceptance k${k} v${String(v)}`);if(accept)assert.ok(G.some(g=>g.pos.length));else assert.equal(sha(a),before,'rejected exact slot is a strict no-op');
  }
 });
 test('all ten targets are saved/import-only; existing hospital tool remains ordinary k12',()=>{
  assert.ok(FACILITY_TOOLS.some(t=>t.id==='hospital'),'ordinary hospital tool remains available');
  const source=fs.readFileSync(path.join(ROOT,'src/sim/rules/build.ts'),'utf8');assert.match(source,/case 'hospital':[\s\S]*?t.bld = \{ k: 12/,'ordinary hospital tool keeps its saved ID');
  assert.doesNotMatch(source,/\bk: (?:164|119|116|149|81)\b/,'no native tool silently acquires a target save ID');
 });
 test('immutable immediate-D076 slot budgets, all eighty earlier models and exhaustive non-target binary attributes',()=>{
  for(const [k,v]of D077_SLOTS){const key=k+':'+v,old=drawServiceLodgeCase(k,{v,on:false}),pin=D077_MODEL_OLD[key];assert.equal(old.cost,D077_CAP[key],key+' exact preceding-wave cost');assert.equal(geoSig(old),pin.sha256,key+' exact preceding-wave arrays');assert.equal(geoBytes(old),pin.float64Sha256,key+' exact preceding-wave binary attributes');}
  for(const [key,pin]of Object.entries(D077_PRIOR_MODELS)){const [k,v]=key.split(':').map(Number),r=drawServiceLodgeCase(k,{v});assert.equal(r.cost,pin.cost,key+' exact old-model cost');assert.equal(geoSig(r),pin.sha256,key+' exact old-model arrays');assert.equal(geoBytes(r),pin.float64Sha256,key+' exact old-model binary bytes');assert.equal(serviceLodgeStructureSignature(r),pin.structureSha256,key+' exact prior normalized structure');}
  const preserved=createHash('sha256'),binary=createHash('sha256');
  for(const k of [0,...D077_KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,D077_KT.size(k)])){
   if(isServiceLodge(k,v))continue;const off=drawServiceLodgeCase(k,{lv,v,s,on:false}),on=drawServiceLodgeCase(k,{lv,v,s});assert.equal(geoSig(on),geoSig(off),`k${k} lv${lv} v${v} s${s} exact preserved arrays`);assert.equal(geoBytes(on),geoBytes(off),`k${k} lv${lv} v${v} s${s} exact preserved binary attributes`);preserved.update(JSON.stringify([k,lv,v,s,geoSig(on)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(on)]));report.preservedCases++;
  }
  assert.equal(report.preservedCases,D077_PRESERVED.cases);assert.equal(preserved.digest('hex'),D077_PRESERVED.sha256,'all preserved cases match isolated D076');assert.equal(binary.digest('hex'),D077_PRESERVED.float64Sha256,'all preserved binary bytes, including signed zero, match isolated D076');
 });
 test('all ninety models are unique after quarter-turn/translation/independent-scale/color/order normalization',()=>{
  const structures=new Map();
  for(const key of [...Object.keys(D077_PRIOR_MODELS),...D077_SLOTS.map(([k,v])=>k+':'+v)]){const [k,v]=key.split(':').map(Number),id=serviceLodgeStructureSignature(drawServiceLodgeCase(k,{v,s:1}));assert.ok(!structures.has(id),`${key} cannot copy ${structures.get(id)}`);structures.set(id,key);}
  assert.equal(structures.size,90,'all eighty earlier models and ten new models are structurally distinct');
 });
 test('all exact-slot levels/heights/sizes/origins/quarter-turns preserve finite deterministic bounded geometry and strict budgets',()=>{
  for(const [k,v]of D077_SLOTS){let min=Infinity,max=0;const key=k+':'+v;for(const lv of [1,2,3])for(const s of new Set([1,D077_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D077_KT.height(k,lv,v)),Math.max(.24,D077_KT.height(k,lv,v)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={v,lv,s,H,...origin,turn},r=drawServiceLodgeCase(k,options),again=drawServiceLodgeCase(k,options),old=drawServiceLodgeCase(k,{...options,on:false});validServiceLodgeGeometry(r);assertServiceLodgeBudget(r);assert.equal(geoBytes(r),geoBytes(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'each approved exact slot changes actual geometry');
   assert.deepEqual(r.trees,old.trees,'all ordered existing trees preserved');assert.equal(old.cost,D077_CAP[key],'strict immediate D076 weighted ceiling');
   assert.ok(r.cost>=12,'positive multi-face building floor within the immutable exact-slot cap');assert.ok(r.cost<=old.cost,`${key}: ${r.cost} <= ${old.cost}`);assert.equal(serviceLodgeStructureSignature(r),serviceLodgeStructureSignature(drawServiceLodgeCase(k,{...options,turn:0})),'four rigid orientations preserve structural identity');assert.equal(serviceLodgeStructureSignature(r),serviceLodgeStructureSignature(drawServiceLodgeCase(k,{v,s:1,H:1,x0:0,z0:0,y0:0})),'origin, parcel and inherited height are pure independent transforms');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[key]={name:D077_KT.name(k),min,max,cap:D077_CAP[key]};}
 });
 test('every roof component has independent complete topology and front-sided intended-plan coverage',()=>{
  assert.equal(D077_ROOFS.length,ROOF_COMPONENT_COUNT,'independently specified complete building roofs');assert.equal(D077_ROOFS.flatMap(roofTriangles).length,75,'complete independent roof/gable triangle inventory');assert.equal(D077_WALLS.flatMap(roofTriangles).length,182,'complete independent enclosed wall triangle inventory');assert.equal(new Set(D077_ROOFS.map(s=>s.k+':'+s.v)).size,10,'roof contract covers all ten exact slots');assert.equal(new Set(D077_ROOFS.map(s=>s.k+':'+s.v+':'+s.id)).size,D077_ROOFS.length,'distinct independent component IDs');
  report.roofComponents=D077_ROOFS.length;report.roofComponentCases=0;report.roofCoverageRays=0;report.roofNegativeControls=0;report.roofReversedTriangleControls=0;
  for(const spec of D077_ROOFS)for(const size of [1,4])for(const H of new Set([.12,Math.max(.12,D077_KT.height(spec.k,1,spec.v)),3.7]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const r=drawServiceLodgeCase(spec.k,{v:spec.v,s:size,H,...origin,turn});assertServiceLodgeRoofClosure(r,spec);report.roofCoverageRays+=assertServiceLodgeRoofCoverage(r,spec);report.roofComponentCases++;
  }
  for(const spec of D077_ROOFS){
   const original=drawServiceLodgeCase(spec.k,{v:spec.v,s:1,H:1,x0:0,z0:0,y0:0}),targets=assertServiceLodgeRoofClosure(original,spec);
   // Individually delete every real triangle, including each vertical end gable.
   // Generic geometry still accepts these holes: topology must reject them.
   for(const target of targets){const missing=roofMutation(original,[target]);validServiceLodgeGeometry(missing);assert.throws(()=>assertServiceLodgeRoofClosure(missing,spec),/every intended roof plane/,'missing individual plane/end triangle is detected for '+spec.id);report.roofNegativeControls++;const reversed=roofMutation(original,[target],true);assertServiceLodgeRoofClosure(reversed,spec);assert.throws(()=>assertServiceLodgeRoofCoverage(reversed,spec),/front-sided roof (?:covers|shell covers)/,'each individual reversed slope or gable triangle is detected for '+spec.id);report.roofNegativeControls++;report.roofReversedTriangleControls++;}
   const missing=roofMutation(original,targets);assert.throws(()=>assertServiceLodgeRoofCoverage(missing,spec),/front-sided roof (?:covers|shell covers)/,'whole missing '+spec.id+' cannot hide behind other finite mesh faces');report.roofNegativeControls++;
   const reversed=roofMutation(original,targets,true);assertServiceLodgeRoofClosure(reversed,spec);assert.throws(()=>assertServiceLodgeRoofCoverage(reversed,spec),/front-sided roof (?:covers|shell covers)/,'closed but back-facing '+spec.id+' fails physical front-sided coverage');report.roofNegativeControls++;
  }
  report.roofInventoryTriangles=0;for(const [k,v]of D077_SLOTS){const r=drawServiceLodgeCase(k,{v,s:1,H:1});report.roofInventoryTriangles+=assertServiceLodgeRoofInventory(r);const samples=d077RoofSamples(k,v);assert.ok(samples.length>=3,'every delivered building has independently exposed samples');assert.equal(new Set(samples.map(s=>s.id)).size,samples.length,'camera sample IDs are unique');for(const spec of D077_ROOFS.filter(s=>s.k===k&&s.v===v&&!s.nonRoof))assert.ok(samples.filter(s=>s.component===spec.id).length>=3,'each true roof component has at least three exposed independent points');assert.ok(samples.every(s=>Number.isFinite(s.h)&&s.h>0),'roof samples are real positive-height surfaces');}
 });
 test('every enclosed wall has complete independent panels and front-facing coverage with individual hole/backface controls',()=>{
  assert.equal(D077_WALLS.length,ROOF_COMPONENT_COUNT,'every enclosed mass, including lantern, thin chimney and dispatch annexes, has full walls');report.wallComponents=D077_WALLS.length;report.wallComponentCases=0;report.wallCoverageRays=0;report.wallNegativeControls=0;
  for(const spec of D077_WALLS)for(const size of [1,4])for(const H of [.12,3.7])for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const r=drawServiceLodgeCase(spec.k,{v:spec.v,s:size,H,...origin,turn});assertServiceLodgeRoofClosure(r,spec);report.wallCoverageRays+=assertServiceLodgeRoofCoverage(r,spec);report.wallComponentCases++;
  }
  for(const spec of D077_WALLS){const original=drawServiceLodgeCase(spec.k,{v:spec.v,s:1,H:1,x0:0,z0:0,y0:0}),targets=assertServiceLodgeRoofClosure(original,spec);
   for(const target of targets){const missing=roofMutation(original,[target]);validServiceLodgeGeometry(missing);assert.throws(()=>assertServiceLodgeRoofClosure(missing,spec),/every intended roof plane/,'an enclosed wall triangle cannot be omitted');assert.throws(()=>assertServiceLodgeRoofCoverage(missing,spec),/front-sided roof shell covers/,'rays independently detect each missing wall triangle');const reversed=roofMutation(original,[target],true);assertServiceLodgeRoofClosure(reversed,spec);assert.throws(()=>assertServiceLodgeRoofCoverage(reversed,spec),/front-sided roof shell covers/,'complete but back-facing enclosed walls are rejected');report.wallNegativeControls+=2;}
  }
 });
 test('independent budget and preservation controls reject finite duplication and every changed binary attribute',()=>{
  report.budgetNegativeControls=0;for(const[k,v]of D077_SLOTS){const r=drawServiceLodgeCase(k,{v});while(d077Cost(r.G)<=D077_CAP[k+':'+v])for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags'])g[key].push(...g[key]);r.cost=d077Cost(r.G);validServiceLodgeGeometry(r);assert.throws(()=>assertServiceLodgeBudget(r),/immutable cap/,'complete finite in-parcel duplicated geometry exceeds the independent published budget');report.budgetNegativeControls++;}
  report.preservationNegativeControls=0;for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){const r=drawServiceLodgeCase(47,{v:0}),g=r.G.find(g=>g[key].length);assert.ok(g,'earlier wave exposes attribute '+key);g[key][0]+=.0001;assert.throws(()=>assert.equal(geoBytes(r),D077_PRIOR_MODELS['47:0'].float64Sha256),'non-target byte mutation must be rejected: '+key);report.preservationNegativeControls++;}
  const original=drawServiceLodgeCase(164,{v:0}),duplicate=structuredClone(original);for(const g of duplicate.G){g.col=g.col.map(()=>.2);for(let i=0;i<g.pos.length;i+=3){g.pos[i]=9+g.pos[i]*2;g.pos[i+1]=-2+g.pos[i+1]*.3;g.pos[i+2]=5+g.pos[i+2]*.7;}}
  const identities=[original,duplicate].map(serviceLodgeStructureSignature);assert.throws(()=>assert.equal(new Set(identities).size,2),'colored, moved and independently scaled duplicate fails uniqueness');
 });
 test('each complete architectural solid has a sealed ground perimeter or a joined lantern opening, with missing-face controls',()=>{
  assert.equal(D077_SOLIDS.length,20);report.closedSolidCases=0;report.closedSolidNegativeControls=0;
  for(const solid of D077_SOLIDS){for(const s of [1,4])for(const H of [.12,3.7])for(let turn=0;turn<4;turn++){const r=drawServiceLodgeCase(solid.k,{v:solid.v,s,H,x0:-3.125,z0:7.375,y0:.21,turn});assertServiceLodgeClosedSolid(r,solid);report.closedSolidCases++;}
   const r=drawServiceLodgeCase(solid.k,{v:solid.v,s:1,H:1,x0:0,z0:0,y0:0});for(const collection of [D077_ROOFS,D077_WALLS]){const spec=collection.find(s=>s.k===solid.k&&s.v===solid.v&&s.id===solid.parts[0]+(collection===D077_WALLS?'-walls':'')),target=assertServiceLodgeRoofClosure(r,spec)[0];assert.throws(()=>assertServiceLodgeClosedSolid(roofMutation(r,[target]),solid),/every intended roof plane/,'a surface hole cannot remain a closed-solid witness');report.closedSolidNegativeControls++;}
  }
 });
 test('all three real contact interfaces retain both partners and reject missing or reversed contact walls',()=>{
  assert.equal(D077_CONTACTS.length,3);report.contactRays=0;report.contactNegativeControls=0;
  for(const spec of D077_CONTACTS){for(const s of [1,4])for(const H of [.12,3.7])for(let turn=0;turn<4;turn++)report.contactRays+=assertServiceLodgeContact(drawServiceLodgeCase(spec.k,{v:spec.v,s,H,x0:-3.125,z0:7.375,y0:.21,turn}),spec);
   const original=drawServiceLodgeCase(spec.k,{v:spec.v,s:1,H:1,x0:0,z0:0,y0:0});for(const part of [spec.left,spec.right]){const wall=D077_WALLS.find(s=>s.k===spec.k&&s.v===spec.v&&s.id===part+'-walls'),targets=assertServiceLodgeRoofClosure(original,wall).filter(t=>t.points.every(p=>Math.abs(p[0]-spec.x)<1e-8));assert.equal(targets.length,2,'each pinned interface has a complete two-triangle partner');for(const reverse of [false,true]){assert.throws(()=>assertServiceLodgeContact(roofMutation(original,targets,reverse),spec),/contact retains both/,'incomplete or reversed contact wall is not an enclosure witness');report.contactNegativeControls++;}}
  }
 });
 test('all architectural shells remain shadow-casting; decoration cannot buy a false budget reduction',()=>{
  report.arenaNegativeControls=0;
  for(const spec of [...D077_ROOFS,...D077_WALLS]){
   const original=drawServiceLodgeCase(spec.k,{v:spec.v,s:1,H:1,x0:0,z0:0,y0:0}),target=assertServiceLodgeRoofClosure(original,spec)[0],moved=roofMutation(original,[target]),source=original.G[target.gi],destination=moved.G[2];
   for(const key of ['pos','nor','col','uv','owners','tags']){const stride=key==='uv'?6:['owners','tags'].includes(key)?1:9;destination[key].push(...source[key].slice(target.ti*stride,(target.ti+1)*stride));}
   moved.cost=d077Cost(moved.G);validServiceLodgeGeometry(moved);assertServiceLodgeBudget(moved);assert.throws(()=>assertServiceLodgeRoofClosure(moved,spec),/shadow-casting W\/O/,'an unchanged complete face transferred to D must be rejected');report.arenaNegativeControls++;
  }
  for(const v of [0,1]){const r=drawServiceLodgeCase(81,{v});assert.equal(r.G[0].owners.length+r.G[1].owners.length,14,'guesthouse is exactly its complete fourteen-triangle shell');assert.equal(r.G[2].owners.length,0,'guesthouse has no decorative budget or hidden shell');assert.equal(r.cost,28);}
 });
 test('only original ground paving remains in D; raised facade or horizontal covers are rejected',()=>{
  report.groundDressCases=0;report.groundDressNegativeControls=0;
  for(const [k,v]of D077_SLOTS)for(const s of [1,4])for(const H of [.12,3.7])for(let turn=0;turn<4;turn++){
   const r=drawServiceLodgeCase(k,{v,s,H,x0:-3.125,z0:7.375,y0:.21,turn});assertServiceLodgeGroundDress(r);report.groundDressCases++;
   if(r.G[2].pos.length){const raised=structuredClone(r);for(let i=1;i<raised.G[2].pos.length;i+=3)raised.G[2].pos[i]+=.01*H;validServiceLodgeGeometry(raised);assertServiceLodgeBudget(raised);assert.throws(()=>assertServiceLodgeGroundDress(raised),/ground paving level/,'finite affordable raised cover cannot obscure the complete fixed wall contract');report.groundDressNegativeControls++;const vertical=structuredClone(r);vertical.G[2].nor.splice(0,3,1,0,0);assert.throws(()=>assertServiceLodgeGroundDress(vertical),/facade covers/,'vertical decorative planes may not return');report.groundDressNegativeControls++;}
  }
 });
 test('inherited low exchange height and its actual seed516 owner remain explicit',()=>{
  assert.equal(D077_KT.height(116,1,0),.05,'original raw data-centre table height is unchanged');const r=drawServiceLodgeCase(116,{v:0});assert.equal(r.H,.12,'inherited renderer clamps to .12 without artwork repair');assert.ok(r.G.flatMap(g=>g.pos.filter((_,i)=>i%3===1)).every(y=>y<=r.y0+.12+1e-9));
  const city=d077City('seed516'),owner=city.buildings.find(b=>b.id===201);assert.ok(owner,'real seed516 exchange owner exists');assert.equal(owner.k,116);assert.equal(owner.v,0);assert.deepEqual([owner.x,owner.z,owner.size],[43,8,2]);assert.equal(owner.goneDay,undefined);
 });
 test('all fifty-five historical fixtures remain byte-exact with independent mutation controls',()=>{
  const check=(read=file=>fs.readFileSync(path.join(ROOT,file)))=>{for(const [file,pin]of Object.entries(HISTORICAL.fixtures))assert.equal(createHash('sha256').update(read(file)).digest('hex'),pin,'exact immutable historical fixture '+file);};
  assert.equal(Object.keys(HISTORICAL.fixtures).length,55);check();report.historicalFixtureNegativeControls=0;
  for(const target of Object.keys(HISTORICAL.fixtures)){assert.throws(()=>check(file=>file===target?Buffer.concat([fs.readFileSync(path.join(ROOT,file)),Buffer.from(' ') ]):fs.readFileSync(path.join(ROOT,file))),/exact immutable historical fixture/,'a historical fixture may never be refreshed to candidate output');report.historicalFixtureNegativeControls++;}
 });
 test('independently pinned courtyards and arrival notches remain deliberately uncovered',()=>{
  assert.equal(D077_OPEN_COURTS.length,OPEN_COURT_COUNT,'explicit working and remembrance courts remain open');report.openCourtRays=0;
  for(const spec of D077_OPEN_COURTS)for(const size of [1,4])for(const H of [.12,3.7])for(let turn=0;turn<4;turn++){
   const r=drawServiceLodgeCase(spec.k,{v:spec.v,s:size,H,x0:-3.125,z0:7.375,y0:.21,turn}),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.G.flatMap(g=>g.pos),3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
   try{for(const [x,z]of spec.points){const p=roofWorld(r,[x,0,z]),hits=new THREE.Raycaster(new THREE.Vector3(p[0],r.y0+r.H+1,p[2]),new THREE.Vector3(0,-1,0)).intersectObject(mesh);assert.ok(hits.every(hit=>hit.point.y<=r.y0+r.H*(spec.ceiling??.04)+1e-6),spec.id+' open court cannot acquire a false spanning roof');report.openCourtRays++;}}finally{geometry.dispose();mesh.material.dispose();}
  }
 });
 test('all eighty prior models retain every ordered isolated-release tree transform, with corruption controls',()=>{
  report.treeTransformCases=0;for(const [encoded,expected]of Object.entries(BASE.treeCases)){const[k,v,s,H,x0,z0,y0,turn]=JSON.parse(encoded),r=drawServiceLodgeCase(k,{v,s,H,x0,z0,y0,turn});assert.deepEqual(r.trees,expected,'exact immutable tree transform '+encoded);report.treeTransformCases++;}
  assert.equal(report.treeTransformCases,13440,'all eighty prior models across sizes, height breaks, origins and rigid turns');
  for(const k of [54,47])for(const mutate of [r=>r.trees.reverse(),r=>r.trees.pop(),r=>r.trees.push({...r.trees[0]}),r=>r.trees[0].x+=.01,r=>r.trees[0].z+=.01,r=>r.trees[0].y+=.01,r=>r.trees[0].s+=.01]){const r=drawServiceLodgeCase(k,{v:0,s:1,H:.35,x0:0,z0:0,y0:0}),expected=BASE.treeCases[JSON.stringify([k,0,1,.35,0,0,0,0])];mutate(r);assert.throws(()=>assert.deepEqual(r.trees,expected),'original ordered tree transformations remain independently pinned');}
  for(const [k,v]of D077_SLOTS){const r=drawServiceLodgeCase(k,{v});r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5});assert.throws(()=>validServiceLodgeGeometry(r),'new tree insertion cannot change a tree-free target');}
 });

 test('identity rejects recolored/reordered/moved/rotated/stretched copies and detects real geometric edits',()=>{
  const original=drawServiceLodgeCase(164),expected=serviceLodgeStructureSignature(original);
  for(let turn=0;turn<4;turn++){
   const copy={...original,G:original.G.slice().reverse().map(g=>({...g,pos:[],col:g.col.map(()=>.7)}))};
   original.G.slice().reverse().forEach((g,i)=>{const tris=[];for(let t=0;t<g.pos.length;t+=9){const points=[];for(let j=0;j<9;j+=3){let x=g.pos[t+j],z=g.pos[t+j+2];for(let q=0;q<turn;q++)[x,z]=[-z,x];points.push([12.3+x*2.7,-.9+g.pos[t+j+1]*.37,-8.2+z*.61]);}tris.push(points.reverse().flat());}copy.G[i].pos=tris.reverse().flat();});
   assert.equal(serviceLodgeStructureSignature(copy),expected,'identity ignores parcel metadata, ordering and color');copy.G.find(g=>g.pos.length).pos[1]+=.01;assert.notEqual(serviceLodgeStructureSignature(copy),expected,'real geometry edit detected');
  }
 });
 test('negative controls reject nonfinite/incomplete geometry, owner loss, collapse, overflow, wrong normals and trees',()=>{
  const arena=r=>r.G.find(g=>g.pos.length);
  for(const mutation of [r=>arena(r).pos[0]=NaN,r=>arena(r).owners[0]=0,r=>arena(r).owners.pop(),r=>arena(r).uv.pop(),r=>r.G[0].wst.push(1),r=>arena(r).tags.pop(),r=>arena(r).pos.splice(3,3,...arena(r).pos.slice(0,3)),r=>arena(r).pos[0]=r.x0+r.s+1,r=>arena(r).pos[1]=r.y0+r.H+.01,r=>arena(r).pos[1]=r.y0-.01,r=>arena(r).nor[0]=NaN,r=>arena(r).nor.splice(3,3,...arena(r).nor.slice(3,6).map(n=>-n)),r=>arena(r).nor.splice(0,3,0,0,0),r=>r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5})]){const r=drawServiceLodgeCase(164);mutation(r);assert.throws(()=>validServiceLodgeGeometry(r));}
  const tilted=drawServiceLodgeCase(164),g=arena(tilted),n=new THREE.Vector3(...g.nor.slice(0,3)),axis=Math.abs(n.y)<.8?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),tangent=axis.addScaledVector(n,-axis.dot(n)).normalize(),wrong=n.multiplyScalar(Math.SQRT1_2).addScaledVector(tangent,Math.SQRT1_2);g.nor.splice(0,3,...wrong.toArray());assert.throws(()=>validServiceLodgeGeometry(tilted),/perpendicular/,'unit normals must be perpendicular, not merely in the right hemisphere');
 });
 test('copied previews change only supported slots and preserve original world and unsupported records',()=>{
  for(const sample of ['gallery','seed516','ai120']){const city=d077City(sample),before=sha(city);assert.equal(d077ServiceLodgeCity(city,null),city,'native preview is the original object');for(const variant of [0,1,2,4]){const copy=d077ServiceLodgeCity(city,variant);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history fields shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(isServiceLodge(b.k,variant)){assert.notEqual(v,b);assert.equal(v.v,variant);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b,'unsupported requested slots keep the original building record');}}}
 });
 test('actual production serviceLodge preview and hook retain unsupported slots and reject coercion',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),expression=view.match(/const serviceLodgeView = \(c: City\): City => ([^\n]+);/);assert.ok(expression,'production copied-view expression is exposed');
  const preview=Function('c','serviceLodgeForcedV','SERVICE_LODGE_BUILDINGS','return '+expression[1].replaceAll('serviceLodgeForcedV!','serviceLodgeForcedV'));
  const records=[];for(const k of [0,...D077_KINDS,135,28,32,65,999,'164','119','116','149','81'])for(const v of [0,1,2,3,4,7])records.push({id:records.length+1,k,v,size:2,x:4,z:6,history:[{day:3,kind:'placed'}]});
  const world=frozen({buildings:records,history:[{day:3,kind:'snapshot'}],day:9,seed:516}),before=sha(world);
  for(const v of [null,0,1,2,4]){const actual=preview(world,v,SERVICE_LODGE_BUILDINGS),expected=d077ServiceLodgeCity(world,v);assert.deepEqual(actual,expected,'real production expression matches independent exact-slot selection');assert.equal(actual.history,world.history);assert.equal(sha(world),before);if(v===null){assert.equal(actual,world);continue;}assert.notEqual(actual,world);assert.notEqual(actual.buildings,world.buildings);for(let i=0;i<records.length;i++){const b=records[i],copy=actual.buildings[i];if(isServiceLodge(b.k,v)){assert.notEqual(copy,b);assert.deepEqual(copy,{...b,v});assert.equal(copy.history,b.history);}else assert.equal(copy,b,'unsupported requested variant leaves the exact original record unchanged');}}
  const method=view.match(/serviceLodgeV\(v: number \| null\) \{ ([^\n]+) \},/);assert.ok(method,'production public hook is exposed');
  const hook=Function('let serviceLodgeForcedV=null,needsRender=false,rebuilds=0,draws=0;const rebuildScene=fresh=>{if(fresh!==true)throw new Error("preview must rebuild fresh");rebuilds++;};const draw=()=>draws++;return {call(v){'+method[1]+'},state(){return {serviceLodgeForcedV,needsRender,rebuilds,draws};}};')();
  for(const v of [0,1,2,4,null]){const was=hook.state();assert.equal(hook.call(v),v);assert.deepEqual(hook.state(),{serviceLodgeForcedV:v,needsRender:true,rebuilds:was.rebuilds+1,draws:was.draws+1});}
  for(const v of [undefined,-1,3,5,.5,'0','1','2','3','4',true,false,NaN,Infinity]){const was=hook.state();assert.throws(()=>hook.call(v),/supports saved variants/);assert.deepEqual(hook.state(),was,'invalid request cannot update preview state or rebuild');if(v===undefined)assert.equal(d077ServiceLodgeCity(world,v),world,'omitted helper variant means native');else assert.throws(()=>d077ServiceLodgeCity(world,v),'independent copied preview rejects invalid input');}
 });
 test('three real cities × three modes × native/v0/v1/v2/v4 preserve all other owners with zero whole-scene growth',()=>{
  let targets=0;const covered=new Set();for(const variant of [null,0,1,2,4])for(const sample of ['seed516','ai120','gallery']){
   const preview=variant===null?'native':'v'+variant,source=d077City(sample),sourceHash=sha(source),city=d077ServiceLodgeCity(source,variant),world=sha(city),wanted=city.buildings.filter(b=>isServiceLodge(b.k,b.v)&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   for(const mode of ['a','b','c']){
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=D077_OLD[preview][sample][mode];assert.equal(off.cost,old[0]);assert.equal(off.sig,old[1],'immutable immediate-D076 same-world/view signature');assert.equal(sha(city),world,'renderer preserves copied city/history');assert.equal(sha(source),sourceHash,'renderer preserves original world/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground);assert.deepEqual(on.dg.inst,off.dg.inst,'tree instances unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${preview} ${mode} mesh${mi} owner${id} exact bytes`);});for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile${i} unchanged`);});
    let delta=0;for(const b of wanted){const key=b.k+':'+b.v,a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.equal(a,D077_CAP[key]);assert.ok(n>=12&&n<=a,`${key}: ${n} <= ${a}`);assert.ok(on.content.some((rows,mi)=>rows[b.id]!==off.content[mi][b.id]),'each exact target slot changes');delta+=n-a;targets++;covered.add(key);}
    assert.equal(on.cost-off.cost,delta,'whole-city delta consists of exact target owners only');assert.ok(on.cost<=off.cost);if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.deepEqual(on,off,'no-target cities exactly unchanged');report.cities.push({sample,preview,mode,targets:wanted.length,before:off.cost,after:on.cost,delta,worldSha256:sourceHash});
   }
  }assert.equal(targets,78,'all supported target owners across native and four copied previews and three modes');assert.equal(covered.size,10,'all ten actual kind/variant slots rendered in real copied galleries');
 });
 test('every exact-slot production-batched model has real faces that pick its owning building',()=>{
  const source=d077City('gallery'),before=sha(source),covered=new Set();let picks=0;
  for(const variant of [0,1,2,4])for(const mode of ['a','b','c']){const city=d077ServiceLodgeCity(source,variant),con=new ConState(city.n),built=buildCityScene(city,D077_KT,STYLES.A,d077Blocks(city,mode),'d',d077Civic(true),con,true);
   try{const wanted=city.buildings.filter(b=>isServiceLodge(b.k,b.v)&&b.goneDay===undefined),ids=new Set(wanted.map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const b of wanted){assert.ok([...seen].some(key=>key.startsWith(b.id+':')),`mode ${mode}: k${b.k} v${b.v} owner${b.id} is pickable`);covered.add(b.k+':'+b.v);}
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=30,'at least one actual hit for each supported forced-gallery target in all three modes');assert.equal(covered.size,10);assert.equal(sha(source),before);
 });
 test('procedural sources and reversible scope preserve simulation, saves, eighty earlier models and historical gates',()=>{
  for(const file of ['src/content/britishServiceLodges.ts','src/render/britishServiceLodgesArt.ts']){const source=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\/\/.*$/gm,'');for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b|\bwindow\b|\blocation\b/,/data:image|\.png|\.jpe?g|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])assert.doesNotMatch(source,re,file);}
  const allowed=new Set(['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishServiceLodges.ts','src/render/britishServiceLodgesArt.ts']),changed=execFileSync('git',['diff','--name-only',D077_BASELINE,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const file of [...changed,...untracked])assert.ok(allowed.has(file),'approved render-only source: '+file);
  assertD077Scope();const manifest=read('fixtures/d077-art-scope.json');for(const file of Object.keys(manifest.before))assert.equal(createHash('sha256').update(d077HistoricalBytes(file)).digest('hex'),manifest.before[file],'exact published D076 historical bytes');
  for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/recipes.ts','src/render/scene.ts','src/render/cityScene.ts','src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceFacilities.ts','src/render/britishCommerceFacilityArt.ts','src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts','src/content/britishCommerceThird.ts','src/render/britishCommerceThirdArt.ts','src/content/britishEducation.ts','src/render/britishEducationArt.ts','src/content/britishCampuses.ts','src/render/britishCampusArt.ts','src/content/britishEmergencyHotels.ts','src/render/britishEmergencyHotelArt.ts','src/content/britishFarmMemorials.ts','src/render/britishFarmMemorialArt.ts','src/ui/panelPress.ts','src/content/britishHealthResponse.ts','src/render/britishHealthResponseArt.ts','src/content/britishServiceLodges.ts','src/render/britishServiceLodgesArt.ts']){const mutated=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized mutation':'');assert.throws(()=>assertD077Scope(mutated),/exact allowed source/,'scope rejects '+target);assert.throws(()=>d077HistoricalBytes(target,mutated),/exact allowed source/,'historical restoration rejects '+target);}
 });
 test('nineteen legacy switches disable only this wave; copied v0/v1/v2/v4 hook never writes saved worlds',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),match=view.match(/const serviceLodgeOn = ([^;]+);/);assert.ok(match);const flags=['serviceLodgeArt','healthResponseArt','farmMemorialArt','emergencyHotelArt','campusArt','educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false,flag+' disables serviceLodge');assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn|commerceVariantOn|commerceThirdOn|educationOn|campusOn|emergencyHotelOn|farmMemorialOn|healthResponseOn)|(?:village|industry|commerce|house)Art:/.test(line)))assert.ok(!line.includes('serviceLodgeArt'),'serviceLodge switch never disables earlier art');assert.match(view,/shapeOf\([^\n]*facilityOn, commerceVariantOn, commerceThirdOn, educationOn, campusOn, emergencyHotelOn, farmMemorialOn, healthResponseOn, serviceLodgeOn\)/);assert.match(view,/serviceLodgeV\(v: number \| null\)/);assert.match(view,/buildings: c\.buildings\.map\(/,'preview copies building records');assert.match(view,/serviceLodgeView\(healthResponseView\(farmMemorialView\(emergencyHotelView\(campusView\(educationView\(commerceThirdView\(commerceView\(towerView\(c\)\)\)\)\)\)\)\)\)/,'production renders explicitly copied serviceLodge view');
 });
 test('tested source and guard freeze remain exact through the entire focused run',()=>{assertD077Scope();assert.equal(sha(read('fixtures/d077-art-scope.json').after),sourceInventorySha256,'source manifest cannot change during the run');assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT,'tools/unit-d077.mjs'))).digest('hex'),guardSourceSha256,'tested guard bytes stay frozen');});
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {failed,report}=await d077Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d077'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d077/D077-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

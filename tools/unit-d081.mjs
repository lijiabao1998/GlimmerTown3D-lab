// D081: ten exact fieldStudyLodge slots, immediate published D080 budgets and read-only integration.
// Node geometry evidence only; actual WebGL captures and independent frame checks are separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {isD081TouchLeaseAllowed} from './d081-touch-lease-scope.mjs';
import {Geo} from '../src/render/scene.ts';
import {Pen,drawKind} from '../src/render/kindArt.ts';
import {shapeOf,kindColors} from '../src/content/kindShapes.ts';
import {FIELD_STUDY_KINDS,FIELD_STUDY_LODGES} from '../src/content/britishFieldStudyLodges.ts';
import {drawBritishFieldStudyLodge} from '../src/render/britishFieldStudyLodgeArt.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058City,d058Blocks} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {assertD081Scope,assertD081Inventory,d081HistoricalBytes} from './d081-scope.mjs';
import {FACILITY_TOOLS} from '../src/sim/edit.ts';
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const frozen=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(frozen);Object.freeze(o);}return o;};
export const D081_BASELINE='7ec70a96b01437ab4576b0962905be16b1591e79';
const D081_CARD_SHA256='c9ad13d3c72f1ac8007b8cb2a9cb39e622af2183ad523f7ca743b53bc3142950';
assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT,'docs/D081-british-field-study-buildings-ten.md'))).digest('hex'),D081_CARD_SHA256,'immutable pre-code acceptance card');
export const D081_SLOTS=frozen([[160,0],[160,1],[160,2],[160,3],[160,4],[182,0],[182,1],[182,2],[72,1],[72,2]]);
export const D081_KINDS=Object.freeze([160,182,72]);
const isFieldStudyLodge=(k,v)=>D081_SLOTS.some(([a,b])=>a===k&&b===v);
const baselineBytes=fs.readFileSync(path.join(ROOT,'fixtures/d081-geometry-before.json'));
assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'18966561d0e0b533f066e54921b37d85168c84e0e89a2c9480bb140ad8782c2d','immutable isolated-D080 geometry fixture');
const BASE=frozen(JSON.parse(baselineBytes));assert.equal(BASE.baseline,D081_BASELINE);
const sourceBeforeBytes=fs.readFileSync(path.join(ROOT,'fixtures/d081-source-before.json'));
assert.equal(createHash('sha256').update(sourceBeforeBytes).digest('hex'),'f65c12a63327d90ab865513ac628c71c60f0e2af15546d7cb82752b6c73bc16d','immutable isolated-D080 source inventory');
assert.equal(BASE.sourceSha256,sha(JSON.parse(sourceBeforeBytes).before),'geometry fixture and independent source capture share the exact release source inventory');
export const D081_CAP=frozen(Object.fromEntries(Object.entries(BASE.slots).map(([slot,r])=>[slot,r.cost])));
assert.deepEqual(D081_CAP,{'160:0':562,'160:1':562,'160:2':562,'160:3':562,'160:4':562,'182:0':128,'182:1':128,'182:2':128,'72:1':34,'72:2':34},'independently declared exact-slot published weighted caps');
const historicalBytes=fs.readFileSync(path.join(ROOT,'fixtures/d081-history-before.json'));
assert.equal(createHash('sha256').update(historicalBytes).digest('hex'),'858a415c15ee37304ff0eebf8b2e98f30e8339b25bade940ff001e1351d8bae4','immutable independently archived historical fixture inventory');
const HISTORICAL=frozen(JSON.parse(historicalBytes));assert.equal(HISTORICAL.baseline,D081_BASELINE);
export const D081_PRESERVED=BASE.preserved;
export const D081_OLD=BASE.cities;
export const D081_MODEL_OLD=BASE.slots;
export const D081_PRIOR_MODELS=BASE.priorModels;
export const D081_KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const d081City=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
// Match the production render-only preview. Original saves and records never change.
export function d081FieldStudyCity(city,v=null){
 assert.ok(v===null||v===0||v===1||v===2||v===3||v===4,'supported copied fieldStudyLodge variant');
 return v===null?city:{...city,buildings:city.buildings.map(b=>isFieldStudyLodge(b.k,v)?{...b,v}:b)};
}
export const d081Civic=on=>({shape:k=>shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D081_KT.catColor(D081_KT.cat(k)))});
export const d081Blocks=(city,mode='c')=>({...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true,houseArt:true});
export const d081Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
// Binary preservation also distinguishes signed zero, which JSON signatures intentionally do not.
const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
export function drawFieldStudyLodgeCase(k,{v=0,lv=1,s=D081_KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,D081_KT.height(k,lv,v)),owner=71,on=true,turn=0}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const C=kindColors(LOOKS,k,lv,D081_KT.catColor(D081_KT.cat(k))),args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind preserves every scalar/color input');
 const r={G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,turn,cost:d081Cost(G)};
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
function priorTriangleStructureSignature(r){
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
// Preserve the exact original operation ordering; .15 + 1*.7 is not literal .85.
export function d081ExpectedTrees(r){return [];}
export function assertFieldStudyLodgeBudget(r){const actual=d081Cost(r.G),cap=D081_CAP[r.k+':'+r.v];assert.ok(Number.isFinite(cap),'exact target budget exists');assert.equal(r.cost,actual,'reported weighted cost equals actual arenas');assert.ok(actual>=12&&actual<=cap,`weighted geometry budget ${actual} exceeds immutable cap ${cap}`);return actual;}
export function validFieldStudyLodgeGeometry(r){
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 assert.equal(r.G.length,3,'exactly the existing three arenas');assert.equal(r.trees.length,0,'every new target is tree-free');
 const treePin=BASE.targetTreeCases[JSON.stringify([r.k,r.v,r.s,r.H,r.x0,r.z0,r.y0,r.turn??0])];if(treePin)assert.deepEqual(r.trees,treePin,'ordered tree transforms equal isolated published release');
 assert.deepEqual(r.trees,d081ExpectedTrees(r),'all ordered trees equal independent legacy formula for current height, size and rigid transform');
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
// Numeric geometry is independently declared in the pre-code artifact, never harvested
// from production triangles. Keep the initial snapshot immutable even after approved repairs.
export const D081_INITIAL_CONTRACT_SHA256='2467cbd6189e8100a95869df3416a23d73f41ce248408a3ea36903216a65da11';
assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT,'docs/D081-initial-architecture.json'))).digest('hex'),D081_INITIAL_CONTRACT_SHA256,'immutable initial architectural design');
const contractBytes=fs.readFileSync(path.join(ROOT,'fixtures/d081-architecture-contract.json'));
export const D081_CONTRACT=frozen(JSON.parse(contractBytes));
export const D081_CONTRACT_SHA256=createHash('sha256').update(contractBytes).digest('hex');
assert.equal(D081_CONTRACT_SHA256,D081_INITIAL_CONTRACT_SHA256,'approved active independent architecture contract');
const roofs=[],walls=[],solids=[],contacts=[];
for(const model of D081_CONTRACT.models){
 for(const c of model.components){
  for(const [faces,into,nonRoof]of [[c.roofFaces,roofs,false],[c.wallFaces,walls,true]])into.push({k:model.k,v:model.v,id:c.id+(nonRoof?'-walls':''),panels:faces.map(f=>f.vertices),faces,shellDirections:Object.fromEntries(faces.map((f,i)=>[i,f.normalizedPlaneNormal])),nonRoof});
  solids.push({k:model.k,v:model.v,id:c.id,parts:[c.id],footprint:c.groundFootprint});
 }
 for(const contact of model.contacts??[])contacts.push({...contact,k:model.k,v:model.v});
}
export const D081_ROOFS=frozen(roofs),D081_WALLS=frozen(walls),D081_SOLIDS=frozen(solids),D081_CONTACTS=frozen(contacts);
const ROOF_COMPONENT_COUNT=17;
export const D081_GROUND_DRESS_TRIS=frozen(Object.fromEntries(D081_CONTRACT.models.map(m=>[m.k+':'+m.v,m.groundTriangles])));
// These independent outer parcel points lie beyond every frozen component footprint.
export const D081_OPEN_COURTS=frozen(D081_SLOTS.map(([k,v])=>({k,v,id:'outer-arrival-'+k+'-'+v,points:[[.04,.04],[.96,.04],[.96,.96],[.04,.96]],ceiling:.02})));
const OPEN_COURT_COUNT=10;
export function assertFieldStudyLodgeGroundDress(r){
 const model=D081_CONTRACT.models.find(m=>m.k===r.k&&m.v===r.v),g=r.G[2];assert.equal(g.owners.length,D081_GROUND_DRESS_TRIS[r.k+':'+r.v],'only independently allocated ground paving remains in D');
 if(r.k===160){assert.equal(model.groundDecoration.length,2,'each wetland preserves two independently declared water quads');assert.ok(model.groundDecoration.every(f=>f.role==='ground-water'&&f.vertices.length===4&&f.triangulation.length===2),'the two upward wetland water quads remain complete');assert.equal(g.owners.length,4);}
 const expected=model.groundDecoration.flatMap(f=>f.triangulation.map(ids=>ids.map(i=>f.vertices[i]))),actual=[];
 for(let i=0;i<g.pos.length;i+=9)actual.push([0,3,6].map(j=>roofNormalized(r,g.pos.slice(i+j,i+j+3))));
 assert.deepEqual(actual.map(roofTriKey).sort(),expected.map(roofTriKey).sort(),'D contains exactly the independent upward ground polygons');
 for(let i=0;i<g.pos.length;i+=3){assert.ok(Math.abs(g.pos[i+1]-(r.y0+.004*r.H))<1e-9,'every D vertex stays at the declared ground paving level');assert.ok(g.nor[i]===0&&g.nor[i+1]===1&&g.nor[i+2]===0,'every D surface faces straight upward; facade covers are forbidden');}
}
const roofKey=p=>p.map(n=>Math.round(n*1e8)).join(',');
const roofTriKey=t=>t.map(roofKey).sort().join(';');
const roofEdges=triangles=>{const edges=new Map();for(const tri of triangles)for(let j=0;j<3;j++){const key=[roofKey(tri[j]),roofKey(tri[(j+1)%3])].sort().join('|');edges.set(key,(edges.get(key)??0)+1);}return [...edges].sort(([a],[b])=>a.localeCompare(b));};
export const d081ContractTriangles=spec=>spec.faces.flatMap((f,panel)=>f.orientedTriangles.map(ids=>({panel,points:ids.map(i=>f.vertices[i])})));
const roofTriangles=d081ContractTriangles;
const roofUp=t=>Math.abs((t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]))>1e-10;
const roofWorld=(r,p,quantize=false)=>{let [x,h,z]=p;for(let q=0;q<(r.turn??0);q++)[x,z]=[1-z,x];const v=[r.x0+r.s*x,r.y0+r.H*h,r.z0+r.s*z];return quantize?v.map(Math.fround):v;};
const roofNormalized=(r,p)=>{let x=(p[0]-r.x0)/r.s,z=(p[2]-r.z0)/r.s;for(let q=0;q<(r.turn??0);q++)[x,z]=[z,1-x];return [x,(p[1]-r.y0)/r.H,z];};
// Dense interior barycentric samples avoid edges/diagonals and expose even narrow
// terraces. Both ray heights and visibility decisions derive only from the pins.
function roofInterior(tri){const out=[];for(let i=1;i<7;i++)for(let j=1;j<8-i;j++){const a=i/8,b=j/8,c=1-a-b;if(c<=0)continue;out.push(tri[0].map((v,k)=>a*v+b*tri[1][k]+c*tri[2][k]));}return out;}
function roofHeight(tri,x,z){const [[x0,h0,z0],[x1,h1,z1],[x2,h2,z2]]=tri,den=(z1-z2)*(x0-x2)+(x2-x1)*(z0-z2);if(Math.abs(den)<1e-12)return null;const a=((z1-z2)*(x-x2)+(x2-x1)*(z-z2))/den,b=((z2-z0)*(x-x2)+(x0-x2)*(z-z2))/den,c=1-a-b;return Math.min(a,b,c)>=-1e-8?a*h0+b*h1+c*h2:null;}
export function d081RoofSamples(k,v){
 const specs=D081_ROOFS.filter(s=>s.k===k&&s.v===v&&!s.nonRoof),all=specs.flatMap(s=>roofTriangles(s)).map(t=>t.points).filter(roofUp),samples=[];
 for(const spec of specs)for(const [panel]of spec.panels.entries()){
  if(!roofTriangles(spec).some(t=>t.panel===panel&&roofUp(t.points)))continue;
  const interior=roofTriangles(spec).filter(t=>t.panel===panel&&roofUp(t.points)).flatMap(t=>roofInterior(t.points)),exposed=interior.filter(([x,h,z])=>!all.some(t=>{const top=roofHeight(t,x,z);return top!==null&&top>h+1e-8;}));
  if(exposed.length===0)continue;assert.ok(exposed.length>=3,spec.id+' has three independently exposed interior roof samples');
  const selected=[exposed[0]],distance=(a,b)=>(a[0]-b[0])**2+(a[2]-b[2])**2;while(selected.length<3){const candidates=exposed.filter(p=>!selected.includes(p)).sort((a,b)=>Math.min(...selected.map(p=>distance(b,p)))-Math.min(...selected.map(p=>distance(a,p))));selected.push(candidates[0]);}
  for(const [sample,p]of selected.entries())samples.push({id:spec.id+':'+panel+':'+sample,component:spec.id,panel,x:p[0],z:p[2],h:p[1]});
 }return samples;
}
export function fieldStudyLodgeRoofTriangles(r,spec){
 const expected=new Set(roofTriangles(spec).map(t=>roofTriKey(t.points))),out=[];
 for(const [gi,g]of r.G.entries())for(let ti=0;ti<g.pos.length/9;ti++){const points=[];for(let j=0;j<9;j+=3)points.push(roofNormalized(r,g.pos.slice(ti*9+j,ti*9+j+3)));if(expected.has(roofTriKey(points)))out.push({gi,ti,points});}
 return out;
}
export function assertFieldStudyLodgeRoofClosure(r,spec){
 const expected=roofTriangles(spec).map(t=>t.points),actual=fieldStudyLodgeRoofTriangles(r,spec);
 assert.deepEqual(actual.map(t=>roofTriKey(t.points)).sort(),expected.map(roofTriKey).sort(),spec.id+' has every intended roof plane and closing end face exactly once');
 assert.ok(actual.every(t=>t.gi<2),spec.id+' every architectural shell face stays in shadow-casting W/O arenas');
 assert.deepEqual(roofEdges(actual.map(t=>t.points)),roofEdges(expected),spec.id+' has no missing slope, unjoined edge, duplicated cap or open gable');
 const counts=roofEdges(expected);assert.ok(counts.every(([,count])=>count===1||count===2),spec.id+' independent roof specification is manifold above its intended boundary');
 return actual;
}
export function assertFieldStudyLodgeRoofCoverage(r,spec){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.G.slice(0,2).flatMap(g=>g.pos),3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.FrontSide}));let probes=0;
 try{for(const {panel,points}of roofTriangles(spec)){
  const world=points.map(p=>roofWorld(r,p,true)),a=new THREE.Vector3(...world[0]),b=new THREE.Vector3(...world[1]),c=new THREE.Vector3(...world[2]),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  for(const p of roofInterior(world)){const point=new THREE.Vector3(...p),hits=new THREE.Raycaster(point.clone().addScaledVector(normal,.001*Math.min(r.s,r.H)),normal.clone().negate()).intersectObject(mesh);
   assert.ok(hits.some(hit=>hit.point.distanceTo(point)<1e-6*Math.max(1,r.s,r.H)&&hit.face.normal.dot(normal)>1-1e-6),spec.id+' front-sided roof shell covers its independently intended face and actual world normal: panel '+panel);probes++;
  }
 }return probes;}finally{geometry.dispose();mesh.material.dispose();}
}
export function assertFieldStudyLodgeClosedSolid(r,solid){
 const specs=solid.parts.flatMap(id=>[D081_ROOFS.find(s=>s.k===solid.k&&s.v===solid.v&&s.id===id),D081_WALLS.find(s=>s.k===solid.k&&s.v===solid.v&&s.id===id+'-walls')]);
 assert.ok(specs.every(Boolean),'every closed solid has independently specified roof and complete walls');
 const triangles=specs.flatMap(spec=>assertFieldStudyLodgeRoofClosure(r,spec)),edges=roofEdges(triangles.map(t=>t.points)),boundaries=[];
 for(const [edge,count]of edges){assert.ok(count===1||count===2,solid.id+' complete solid has manifold edge incidence');if(count===1){const points=edge.split('|').map(v=>v.split(',').map(Number));assert.ok(points.every(v=>v[1]===0),solid.id+' only ground-contact boundary is permitted; no open elevated edge');boundaries.push(edge);}}
 const expected=solid.footprint.map((p,i)=>[roofKey([p[0],0,p[1]]),roofKey([solid.footprint[(i+1)%solid.footprint.length][0],0,solid.footprint[(i+1)%solid.footprint.length][1]])].sort().join('|')).sort();
 assert.deepEqual(boundaries.sort(),expected,solid.id+' ground-contact seal has its exact complete independent footprint perimeter');
 // The explicitly declared ground interface lies at zero and contributes zero to
 // the divergence volume. Compute volume from the actual normalized shell, and
 // independently integrate the roof projection over its closed footprint.
 const actual=triangles.map(t=>[0,3,6].map(j=>roofNormalized(r,r.G[t.gi].pos.slice(t.ti*9+j,t.ti*9+j+3))));
 const directed=new Map();for(const tri of actual)for(let i=0;i<3;i++){const a=roofKey(tri[i]),b=roofKey(tri[(i+1)%3]),key=[a,b].sort().join('|'),entry=directed.get(key)??[];entry.push(a+'>'+b);directed.set(key,entry);}for(const [key,items]of directed)if(items.length===2){const[a,b]=key.split('|');assert.deepEqual(items.sort(),[a+'>'+b,b+'>'+a].sort(),solid.id+' shared shell edges have opposite directed incidence');}
 let volume=0;for(const points of actual){const[a,b,c]=points.map(p=>new THREE.Vector3(...p));volume+=a.dot(b.cross(c))/6;}
 const roof=specs.filter(s=>!s.nonRoof).flatMap(roofTriangles).map(t=>t.points);
 const integral=roof.reduce((sum,t)=>sum+Math.abs(polygonArea2(t.map(p=>[p[0],p[2]])))*(t[0][1]+t[1][1]+t[2][1])/3,0);
 assert.ok(volume>1e-8,solid.id+' encloses positive actual shell volume');
 assert.ok(Math.abs(volume-integral)<1e-8,solid.id+' outward shell volume equals independent complete roof integral');
 return {id:solid.id,triangles:triangles.length,groundEdges:boundaries.length,volume};
}
// All new components are detached. AABB separation is a conservative proof for
// these independently designed footprints; zero-gap contact is not permitted.
const horizontalBounds=points=>({lo:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[2]))],hi:[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[2]))]});
const clearance=(a,b)=>Math.max(...[0,1].flatMap(i=>[b.lo[i]-a.hi[i],a.lo[i]-b.hi[i]]));
export function assertD081PositiveSeparation(a,b){const gap=clearance(a,b);assert.ok(gap>1e-9,'independent footprints require strictly positive separation, without touching or overlap');return gap;}
export function assertFieldStudyLodgeSeparation(r){
 const model=D081_CONTRACT.models.find(m=>m.k===r.k&&m.v===r.v),boxes=model.components.map(c=>{
  const solid=D081_SOLIDS.find(s=>s.k===r.k&&s.v===r.v&&s.id===c.id);assertFieldStudyLodgeClosedSolid(r,solid);
  const points=[D081_ROOFS,D081_WALLS].flatMap(list=>fieldStudyLodgeRoofTriangles(r,list.find(s=>s.k===r.k&&s.v===r.v&&s.id===c.id+(list===D081_WALLS?'-walls':'')))).flatMap(t=>t.points),actual=horizontalBounds(points),expected=horizontalBounds(c.groundFootprint.map(p=>[p[0],0,p[1]]));
  for(const key of ['lo','hi'])for(let i=0;i<2;i++)assert.ok(Math.abs(actual[key][i]-expected[key][i])<1e-9,'actual component extent equals independent footprint');return actual;
 });
 assertFieldStudyLodgeGroundDress(r);let componentPairs=0,groundPairs=0;
 for(let i=0;i<boxes.length;i++)for(let j=0;j<i;j++){assertD081PositiveSeparation(boxes[i],boxes[j]);componentPairs++;}
 for(const ground of model.groundDecoration){const box=horizontalBounds(ground.vertices);for(const building of boxes){assertD081PositiveSeparation(box,building);groundPairs++;}}
 return {componentPairs,groundPairs};
}
// Coplanar boundary signatures deliberately discard internal triangulation diagonals.
// Each planar surface retains its signed multiplicity; unrelated arena/material assignment is ignored.
export function fieldStudyLodgeStructureSignature(r,{architectureOnly=false}={}){
 const groups=architectureOnly?r.G.slice(0,2):r.G,pts=groups.flatMap(g=>g.pos),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<pts.length;i++)lo[i%3]=Math.min(lo[i%3],pts[i]),hi[i%3]=Math.max(hi[i%3],pts[i]);
 assert.ok(hi.every((n,j)=>Number.isFinite(n)&&n>lo[j]),'structure has positive finite dimensions');
 const q=n=>Math.round(n*1e7),pointKey=p=>p.map(q).join(','),representations=[];
 for(let turn=0;turn<4;turn++){
  const planes=new Map();
  for(const g of groups)for(let ti=0;ti<g.pos.length;ti+=9){
   const tri=[0,3,6].map(j=>{let x=(g.pos[ti+j]-lo[0])/(hi[0]-lo[0]),z=(g.pos[ti+j+2]-lo[2])/(hi[2]-lo[2]);for(let q=0;q<turn;q++)[x,z]=[1-z,x];return [x,(g.pos[ti+j+1]-lo[1])/(hi[1]-lo[1]),z];});
   const [a,b,c]=tri.map(p=>new THREE.Vector3(...p)),normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();assert.ok(normal.lengthSq()>.99,'noncollapsed structure');
   const first=normal.toArray().find(n=>Math.abs(n)>1e-8);if(first<0){normal.negate();[tri[1],tri[2]]=[tri[2],tri[1]];}
   const key=[...normal.toArray(),normal.dot(a)].map(n=>Math.round(n*1e6)).join(','),edges=planes.get(key)??new Map();
   for(let j=0;j<3;j++){const u=pointKey(tri[j]),v=pointKey(tri[(j+1)%3]),edge=[u,v].sort().join('|'),dir=u<v?1:-1;edges.set(edge,(edges.get(edge)??0)+dir);}planes.set(key,edges);
  }
  const patches=[];
  for(const [plane,edges]of planes){
   // Adjacent collinear boundaries are merged, so inserting an edge vertex cannot create an identity.
   let seg=[...edges].filter(([,n])=>n).map(([edge,n])=>({p:edge.split('|').map(p=>p.split(',').map(Number)),n}));let changed=true;
   while(changed){changed=false;outer:for(let i=0;i<seg.length;i++)for(let j=i+1;j<seg.length;j++){
    const a=seg[i],b=seg[j];if(Math.abs(a.n)!==Math.abs(b.n))continue;const A=a.n>0?a.p:[...a.p].reverse(),B=b.n>0?b.p:[...b.p].reverse();let points=null;
    if(A[1].join()===B[0].join())points=[A[0],A[1],B[1]];else if(B[1].join()===A[0].join())points=[B[0],B[1],A[1]];if(!points)continue;
    const [u,v,w]=points.map(p=>new THREE.Vector3(...p)),ab=v.clone().sub(u),bc=w.clone().sub(v);if(ab.clone().cross(bc).length()>1e-6*ab.length()*bc.length()||ab.dot(bc)<=0)continue;
    const k0=points[0].join(','),k1=points[2].join(','),n=Math.abs(a.n)*(k0<k1?1:-1);seg=seg.filter((_,x)=>x!==i&&x!==j);seg.push({p:(k0<k1?[points[0],points[2]]:[points[2],points[0]]),n});changed=true;break outer;
   }}
   patches.push(plane+':'+seg.map(s=>s.p.map(p=>p.join(',')).join('|')+'@'+s.n).sort().join(';'));
  }representations.push(patches.sort().join('/'));
 }return sha(representations.sort()[0]);
}
export const fieldStudyLodgeArchitectureSignature=r=>fieldStudyLodgeStructureSignature(r,{architectureOnly:true});
function polygonArea2(p){let a=0;for(let i=0;i<p.length;i++)a+=p[i][0]*p[(i+1)%p.length][1]-p[(i+1)%p.length][0]*p[i][1];return a/2;}
const cross2=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function triangleOverlapArea(a,b){let poly=a.slice();const dir=Math.sign(polygonArea2(b));for(let i=0;i<3&&poly.length;i++){const u=b[i],v=b[(i+1)%3],next=[];for(let j=0;j<poly.length;j++){const p=poly[j],q=poly[(j+1)%poly.length],dp=dir*cross2(u,v,p),dq=dir*cross2(u,v,q),ip=dp>=-1e-12,iq=dq>=-1e-12;if(ip)next.push(p);if(ip!==iq){const t=dp/(dp-dq);next.push(p.map((n,k)=>n+t*(q[k]-n)));}}poly=next;}return Math.abs(polygonArea2(poly));}
export function assertD081FacePartition(face,indices=face.orientedTriangles){
 const normal=new THREE.Vector3(...face.normalizedPlaneNormal),drop=normal.toArray().map(Math.abs).indexOf(Math.max(...normal.toArray().map(Math.abs))),project=p=>p.filter((_,i)=>i!==drop),polygon=face.vertices.map(project),triangles=indices.map(ids=>ids.map(i=>face.vertices[i]));
 assert.ok(triangles.every(t=>t.length===3&&t.every(p=>Array.isArray(p)&&p.length===3)),'complete partition triangle vertices');
 let area=0;for(const t of triangles){const [a,b,c]=t.map(p=>new THREE.Vector3(...p)),n=b.clone().sub(a).cross(c.clone().sub(a));assert.ok(n.length()>1e-10&&n.dot(normal)>1e-10,face.id+' partition outward winding and nonzero area');area+=Math.abs(polygonArea2(t.map(project)));}
 assert.ok(Math.abs(area-Math.abs(polygonArea2(polygon)))<1e-10,face.id+' exact polygon partition area');
 const edges=roofEdges(triangles),boundary=edges.filter(([,n])=>n===1).map(([e])=>e),expected=face.vertices.map((p,i)=>[roofKey(p),roofKey(face.vertices[(i+1)%face.vertices.length])].sort().join('|')).sort();
 assert.ok(edges.every(([,n])=>n===1||n===2),face.id+' partition edge multiplicity');assert.deepEqual(boundary.sort(),expected,face.id+' exact polygon boundary');
 for(let i=0;i<triangles.length;i++)for(let j=0;j<i;j++)assert.ok(triangleOverlapArea(triangles[i].map(project),triangles[j].map(project))<1e-10,face.id+' triangle interiors do not overlap');return {triangles:triangles.length,area};
}
// A geometric witness accepts arbitrary horizontal normals, never assumes X-normal contacts.
export function assertD081ContactWitness(partners,points,normal,scale=1){
 const n=new THREE.Vector3(...normal).normalize();assert.ok(Math.abs(n.y)<1e-8&&n.lengthSq()>.99,'contact normal is horizontal and nonzero');let probes=0;
 for(const [side,triangles]of partners.entries()){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles.flat(2),3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.FrontSide})),out=n.clone().multiplyScalar(side===0?1:-1);
  try{for(const p of points){const point=new THREE.Vector3(...p),hits=new THREE.Raycaster(point.clone().addScaledVector(out,.001*scale),out.clone().negate()).intersectObject(mesh);assert.ok(hits.some(hit=>hit.point.distanceTo(point)<2e-7*Math.max(1,scale)&&hit.face.normal.dot(out)>1-1e-6),'contact retains both exact opposite-facing wall partners and actual normals');probes++;}}finally{geometry.dispose();mesh.material.dispose();}
 }return probes;
}
const contactTop=(spec,t)=>{if(Number.isFinite(spec.heightUpper))return spec.heightUpper;const p=spec.heightUpperProfile,axis=Math.abs(spec.tangent[0])>.5?0:1,q=spec.edge[0][axis]+t*(spec.edge[1][axis]-spec.edge[0][axis]);for(let i=1;i<p.length;i++)if(q<=p[i][0]+1e-9){const a=p[i-1],b=p[i];return a[1]+(q-a[0])/(b[0]-a[0])*(b[1]-a[1]);}assert.fail('contact profile covers complete edge');};
export function assertFieldStudyLodgeContact(r,spec){
 const components=[spec.componentA,spec.componentB].map(id=>D081_SOLIDS.find(c=>c.k===r.k&&c.v===r.v&&c.id===id));assert.ok(components.every(Boolean),'known contact partners');
 const partnerRecords=components.map(c=>[...D081_WALLS,...D081_ROOFS].filter(s=>s.k===r.k&&s.v===r.v&&(s.id===c.id||s.id===c.id+'-walls')).flatMap(s=>assertFieldStudyLodgeRoofClosure(r,s))),partners=partnerRecords.map(list=>list.map(t=>[0,3,6].map(j=>r.G[t.gi].pos.slice(t.ti*9+j,t.ti*9+j+3))));
 const n=spec.plane.normalFromAToB,edge=spec.edge,tangent=[edge[1][0]-edge[0][0],0,edge[1][1]-edge[0][1]],len=Math.hypot(...tangent);assert.ok(Math.abs(tangent.reduce((s,a,i)=>s+a*n[i],0))<1e-10&&len>0,'contact plane uses its actual normal perpendicular to edge');
 const points=[];for(const t of spec.edgeSampleFractions)for(const hf of spec.localHeightSampleFractions){const top=contactTop(spec,t),h=spec.heightLower+hf*(top-spec.heightLower);points.push(roofWorld(r,[edge[0][0]+t*tangent[0],h,edge[0][1]+t*tangent[2]],true));}
 // Piecewise extrema occur at endpoints or intersections with the independently fixed roof partition.
 const roofs=D081_ROOFS.find(s=>s.k===r.k&&s.v===r.v&&s.id===spec.componentA),roofTris=roofTriangles(roofs).map(t=>t.points),breaks=new Set([0,1,...spec.edgeSampleFractions]);
 for(const tri of roofTris)for(let i=0;i<3;i++){
  const a=[tri[i][0],tri[i][2]],b=[tri[(i+1)%3][0],tri[(i+1)%3][2]],dx=edge[1][0]-edge[0][0],dz=edge[1][1]-edge[0][1],ex=b[0]-a[0],ez=b[1]-a[1],den=dx*ez-dz*ex;
  if(Math.abs(den)>1e-12){const ax=a[0]-edge[0][0],az=a[1]-edge[0][1],t=(ax*ez-az*ex)/den,u=(ax*dz-az*dx)/den;if(t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9)breaks.add(Math.max(0,Math.min(1,t)));}
 }
 let minimumCeiling=Infinity;for(const t of breaks){const x=edge[0][0]+t*tangent[0],z=edge[0][1]+t*tangent[2],heights=roofTris.map(tri=>roofHeight(tri,x,z)).filter(h=>h!==null),ceiling=Math.max(...heights),top=contactTop(spec,t);minimumCeiling=Math.min(minimumCeiling,ceiling);assert.ok(Number.isFinite(ceiling)&&ceiling-top>=spec.minimumVerticalClearance-1e-8,spec.id+' contact top stays below adjacent solid with positive declared clearance');}
 assert.ok(Math.abs(minimumCeiling-spec.componentABoundaryCeiling.minimumOnContact)<1e-10,'exact piecewise host-ceiling minimum agrees with independent contact proof');
 const normal=new THREE.Vector3(...n);for(let q=0;q<(r.turn??0);q++)[normal.x,normal.z]=[-normal.z,normal.x];return assertD081ContactWitness(partners,points,normal.toArray(),Math.max(r.s,r.H));
}

export function assertFieldStudyLodgeRoofInventory(r){
 const assigned=new Set();for(const spec of [...D081_ROOFS,...D081_WALLS].filter(s=>s.k===r.k&&s.v===r.v))for(const {gi,ti}of assertFieldStudyLodgeRoofClosure(r,spec)){const key=gi+':'+ti;assert.ok(!assigned.has(key),'an architectural triangle belongs to exactly one independent component face');assigned.add(key);}
 let upward=0;for(let gi=0;gi<2;gi++){const g=r.G[gi];for(let ti=0;ti<g.pos.length/9;ti++){assert.ok(assigned.has(gi+':'+ti),'every W/O triangle has an independent architectural polygon pin; spare budget cannot add false walls or caps');if(g.nor[ti*9+1]>1e-8)upward++;}}
 const model=D081_CONTRACT.models.find(m=>m.k===r.k&&m.v===r.v);assert.equal(assigned.size,model.shellTriangles,'exact complete architectural inventory');assert.ok(upward>0,'real roofs exist');return upward;
}
function roofMutation(r,targets,reverse=false){
 const copy=structuredClone(r);for(let gi=0;gi<copy.G.length;gi++){const indices=new Set(targets.filter(t=>t.gi===gi).map(t=>t.ti)),g=copy.G[gi];if(reverse){for(const ti of indices)for(let j=0;j<3;j++)[g.pos[ti*9+3+j],g.pos[ti*9+6+j]]=[g.pos[ti*9+6+j],g.pos[ti*9+3+j]];}else for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){const stride=key==='uv'?6:['owners','tags'].includes(key)?1:['wst','wbd'].includes(key)?3:9;g[key]=g[key].filter((_,i)=>!indices.has(Math.floor(i/stride)));}}
 copy.cost=d081Cost(copy.G);return copy;
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
 const con=new ConState(city.n),built=buildCityScene(city,D081_KT,STYLES.A,d081Blocks(city,mode),'d',d081Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d081Expected(){const out={};for(const v of [null,0,1,2,3,4]){const key=v===null?'native':'v'+v;out[key]={};for(const sample of ['seed516','ai120','gallery']){const city=d081FieldStudyCity(d081City(sample),v),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[key][sample]={legacy:old.cost,fieldStudyLodge:now.cost,delta:now.cost-old.cost};}}return out;}
export async function d081Guards(log=()=>{}){
 let failed=0;const guardSourceSha256=createHash('sha256').update(fs.readFileSync(path.join(ROOT,'tools/unit-d081.mjs'))).digest('hex'),sourceInventorySha256=sha(read('fixtures/d081-art-scope.json').after);const report={baseline:D081_BASELINE,cardSha256:D081_CARD_SHA256,guardSourceSha256,sourceInventorySha256,contractSha256:sha({roofs:D081_ROOFS,walls:D081_WALLS,solids:D081_SOLIDS,contacts:D081_CONTACTS,courts:D081_OPEN_COURTS,groundDress:D081_GROUND_DRESS_TRIS}),initialContractSha256:D081_INITIAL_CONTRACT_SHA256,contractArtifactSha256:D081_CONTRACT_SHA256,qualification:'Node geometry tests only; browser/WebGL captures are separate evidence.',tests:[],geometryCases:0,preservedCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D081 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D081 '+name,e.stack??String(e));}};
 test('ten exact slots on three existing kinds; eighteenth argument defaults off for every historical flag combination',()=>{
  assert.deepEqual([...FIELD_STUDY_KINDS],D081_KINDS);assert.equal(FIELD_STUDY_LODGES.length,10);assert.equal(new Set(FIELD_STUDY_LODGES.map(b=>b.id)).size,10);assert.deepEqual(FIELD_STUDY_LODGES.map(b=>[b.k,b.v]),D081_SLOTS);
  for(const k of [0,...D081_KT.data.kinds.map(r=>r.k),999]){
   const off=shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,false),on=shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true);
   assert.deepEqual(shapeOf(k,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true,true),off,'eighteenth argument defaults off');
   if(FIELD_STUDY_KINDS.has(k)){assert.notDeepEqual(on,off);assert.equal(on.p.fieldStudyLodge,true);assert.deepEqual(on,{...off,p:{...off.p,fieldStudyLodge:true}},'new flag preserves the exact prior shape and every applicable fallback flag');}else assert.deepEqual(on,off,`non-target ${k} dispatch unchanged`);
   for(let mask=0;mask<65536;mask++){const flags=Array.from({length:16},(_,i)=>Boolean(mask&(1<<i)));assert.deepEqual(shapeOf(k,...flags),shapeOf(k,...flags,false),'all 65536 prior flag combinations preserve eighteenth-argument default');}
  }
 });
 test('strict numeric saved slots only; all rejected kinds and variants emit no direct geometry',()=>{
  for(const k of [0,...D081_KINDS,135,28,65,999,'21','29','37',null,undefined])for(const v of [undefined,null,-1,0,1,2,3,4,5,6,7,8,9,10,.5,1.5,2.5,3.5,4.5,'0','1','2','3','4',true,false,NaN,Infinity]){
   const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors(LOOKS,k,1,'#ffffff')},before=sha(a),accept=isFieldStudyLodge(k,v);
   assert.equal(drawBritishFieldStudyLodge(new Pen(a)),accept,`direct acceptance k${k} v${String(v)}`);if(accept)assert.ok(G.some(g=>g.pos.length));else assert.equal(sha(a),before,'rejected exact slot is a strict no-op');
  }
 });
 test('all ten targets are saved/import-only; existing hospital tool remains ordinary k12',()=>{
  assert.ok(FACILITY_TOOLS.some(t=>t.id==='hospital'),'ordinary hospital tool remains available');
  const source=fs.readFileSync(path.join(ROOT,'src/sim/rules/build.ts'),'utf8');assert.match(source,/case 'hospital':[\s\S]*?t.bld = \{ k: 12/,'ordinary hospital tool keeps its saved ID');
  assert.doesNotMatch(source,/\bk: (?:160|182|72)\b/,'no native tool silently acquires a target save ID');
 });
 test('immutable immediate-D080 slot budgets, all one hundred twenty earlier models and exhaustive non-target binary attributes',()=>{
  for(const [k,v]of D081_SLOTS){const key=k+':'+v,old=drawFieldStudyLodgeCase(k,{v,on:false}),pin=D081_MODEL_OLD[key];assert.equal(old.cost,D081_CAP[key],key+' exact preceding-wave cost');assert.equal(geoSig(old),pin.sha256,key+' exact preceding-wave arrays');assert.equal(geoBytes(old),pin.float64Sha256,key+' exact preceding-wave binary attributes');}
  for(const [key,pin]of Object.entries(D081_PRIOR_MODELS)){const [k,v]=key.split(':').map(Number),r=drawFieldStudyLodgeCase(k,{v});assert.equal(r.cost,pin.cost,key+' exact old-model cost');assert.equal(geoSig(r),pin.sha256,key+' exact old-model arrays');assert.equal(geoBytes(r),pin.float64Sha256,key+' exact old-model binary bytes');assert.equal(fieldStudyLodgeStructureSignature(r),pin.structureSha256,key+' exact prior normalized structure');}
  const preserved=createHash('sha256'),binary=createHash('sha256');
  for(const k of [0,...D081_KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,D081_KT.size(k)])){
   if(isFieldStudyLodge(k,v))continue;const off=drawFieldStudyLodgeCase(k,{lv,v,s,on:false}),on=drawFieldStudyLodgeCase(k,{lv,v,s});assert.equal(geoSig(on),geoSig(off),`k${k} lv${lv} v${v} s${s} exact preserved arrays`);assert.equal(geoBytes(on),geoBytes(off),`k${k} lv${lv} v${v} s${s} exact preserved binary attributes`);preserved.update(JSON.stringify([k,lv,v,s,geoSig(on)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(on)]));report.preservedCases++;
  }
  assert.equal(report.preservedCases,D081_PRESERVED.cases);assert.equal(preserved.digest('hex'),D081_PRESERVED.sha256,'all preserved cases match isolated D080');assert.equal(binary.digest('hex'),D081_PRESERVED.float64Sha256,'all preserved binary bytes, including signed zero, match isolated D080');
 });
 test('all 130 full models and 130 W/O architectures are independently unique',()=>{
  report.uniqueFullModels=0;report.uniqueArchitectures=0;
  for(const architectureOnly of [false,true]){const structures=new Map();for(const key of [...Object.keys(D081_PRIOR_MODELS),...D081_SLOTS.map(([k,v])=>k+':'+v)]){const [k,v]=key.split(':').map(Number),id=fieldStudyLodgeStructureSignature(drawFieldStudyLodgeCase(k,{v,s:1}),{architectureOnly});assert.ok(!structures.has(id),key+' cannot copy '+structures.get(id)+' architectureOnly='+architectureOnly);structures.set(id,key);}assert.equal(structures.size,130,'all one hundred twenty earlier models plus ten distinct structural designs');if(architectureOnly)report.uniqueArchitectures=structures.size;else report.uniqueFullModels=structures.size;}
 });
 test('all exact-slot levels/heights/sizes/origins/quarter-turns preserve finite deterministic bounded geometry and strict budgets',()=>{
  for(const [k,v]of D081_SLOTS){let min=Infinity,max=0;const key=k+':'+v;for(const lv of [1,2,3])for(const s of new Set([1,D081_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D081_KT.height(k,lv,v)),Math.max(.24,D081_KT.height(k,lv,v)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={v,lv,s,H,...origin,turn},r=drawFieldStudyLodgeCase(k,options),again=drawFieldStudyLodgeCase(k,options),old=drawFieldStudyLodgeCase(k,{...options,on:false});validFieldStudyLodgeGeometry(r);assertFieldStudyLodgeBudget(r);assert.equal(geoBytes(r),geoBytes(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'each approved exact slot changes actual geometry');
   assert.deepEqual(r.trees,old.trees,'all ordered existing trees preserved');assert.equal(old.cost,D081_CAP[key],'strict immediate D080 weighted ceiling');
   assert.ok(r.cost>=12,'positive multi-face building floor within the immutable exact-slot cap');assert.ok(r.cost<=old.cost,`${key}: ${r.cost} <= ${old.cost}`);assert.equal(fieldStudyLodgeStructureSignature(r),fieldStudyLodgeStructureSignature(drawFieldStudyLodgeCase(k,{...options,turn:0})),'four rigid orientations preserve structural identity');assert.equal(fieldStudyLodgeStructureSignature(r),fieldStudyLodgeStructureSignature(drawFieldStudyLodgeCase(k,{v,s:1,H:1,x0:0,z0:0,y0:0})),'origin, parcel and inherited height are pure independent transforms');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[key]={name:D081_KT.name(k),min,max,cap:D081_CAP[key]};}
 });
 test('every roof component has independent complete topology and front-sided intended-plan coverage',()=>{
  assert.equal(D081_ROOFS.length,ROOF_COMPONENT_COUNT,'independently specified complete building roofs');assert.equal(D081_ROOFS.flatMap(roofTriangles).length,82,'complete independent roof/gable triangle inventory');assert.equal(D081_WALLS.flatMap(roofTriangles).length,190,'complete independent enclosed wall triangle inventory');assert.equal(new Set(D081_ROOFS.map(s=>s.k+':'+s.v)).size,10,'roof contract covers all ten exact slots');assert.equal(new Set(D081_ROOFS.map(s=>s.k+':'+s.v+':'+s.id)).size,D081_ROOFS.length,'distinct independent component IDs');
  report.roofComponents=D081_ROOFS.length;report.roofComponentCases=0;report.roofCoverageRays=0;report.roofNegativeControls=0;report.roofReversedTriangleControls=0;
  for(const spec of D081_ROOFS)for(const size of [1,4])for(const H of new Set([.12,Math.max(.12,D081_KT.height(spec.k,1,spec.v)),3.7]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const r=drawFieldStudyLodgeCase(spec.k,{v:spec.v,s:size,H,...origin,turn});assertFieldStudyLodgeRoofClosure(r,spec);report.roofCoverageRays+=assertFieldStudyLodgeRoofCoverage(r,spec);report.roofComponentCases++;
  }
  for(const spec of D081_ROOFS){
   const original=drawFieldStudyLodgeCase(spec.k,{v:spec.v,s:1,H:1,x0:0,z0:0,y0:0}),targets=assertFieldStudyLodgeRoofClosure(original,spec);
   // Individually delete every real triangle, including each vertical end gable.
   // Generic geometry still accepts these holes: topology must reject them.
   for(const target of targets){const missing=roofMutation(original,[target]);validFieldStudyLodgeGeometry(missing);assert.throws(()=>assertFieldStudyLodgeRoofClosure(missing,spec),/every intended roof plane/,'missing individual plane/end triangle is detected for '+spec.id);report.roofNegativeControls++;const reversed=roofMutation(original,[target],true);assertFieldStudyLodgeRoofClosure(reversed,spec);assert.throws(()=>assertFieldStudyLodgeRoofCoverage(reversed,spec),/front-sided roof (?:covers|shell covers)/,'each individual reversed slope or gable triangle is detected for '+spec.id);report.roofNegativeControls++;report.roofReversedTriangleControls++;}
   const missing=roofMutation(original,targets);assert.throws(()=>assertFieldStudyLodgeRoofCoverage(missing,spec),/front-sided roof (?:covers|shell covers)/,'whole missing '+spec.id+' cannot hide behind other finite mesh faces');report.roofNegativeControls++;
   const reversed=roofMutation(original,targets,true);assertFieldStudyLodgeRoofClosure(reversed,spec);assert.throws(()=>assertFieldStudyLodgeRoofCoverage(reversed,spec),/front-sided roof (?:covers|shell covers)/,'closed but back-facing '+spec.id+' fails physical front-sided coverage');report.roofNegativeControls++;
  }
  report.roofInventoryTriangles=0;for(const [k,v]of D081_SLOTS){const r=drawFieldStudyLodgeCase(k,{v,s:1,H:1});report.roofInventoryTriangles+=assertFieldStudyLodgeRoofInventory(r);const samples=d081RoofSamples(k,v);assert.ok(samples.length>=3,'every delivered building has independently exposed samples');assert.equal(new Set(samples.map(s=>s.id)).size,samples.length,'camera sample IDs are unique');for(const spec of D081_ROOFS.filter(s=>s.k===k&&s.v===v&&!s.nonRoof))assert.ok(samples.filter(s=>s.component===spec.id).length>=3,'each true roof component has at least three exposed independent points');assert.ok(samples.every(s=>Number.isFinite(s.h)&&s.h>0),'roof samples are real positive-height surfaces');}
 });
 test('every enclosed wall has complete independent panels and front-facing coverage with individual hole/backface controls',()=>{
  assert.equal(D081_WALLS.length,ROOF_COMPONENT_COUNT,'every enclosed mass, including all faceted/profile ends and detached pavilions, has full walls');report.wallComponents=D081_WALLS.length;report.wallComponentCases=0;report.wallCoverageRays=0;report.wallNegativeControls=0;
  for(const spec of D081_WALLS)for(const size of [1,4])for(const H of [.12,3.7])for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const r=drawFieldStudyLodgeCase(spec.k,{v:spec.v,s:size,H,...origin,turn});assertFieldStudyLodgeRoofClosure(r,spec);report.wallCoverageRays+=assertFieldStudyLodgeRoofCoverage(r,spec);report.wallComponentCases++;
  }
  for(const spec of D081_WALLS){const original=drawFieldStudyLodgeCase(spec.k,{v:spec.v,s:1,H:1,x0:0,z0:0,y0:0}),targets=assertFieldStudyLodgeRoofClosure(original,spec);
   for(const target of targets){const missing=roofMutation(original,[target]);validFieldStudyLodgeGeometry(missing);assert.throws(()=>assertFieldStudyLodgeRoofClosure(missing,spec),/every intended roof plane/,'an enclosed wall triangle cannot be omitted');assert.throws(()=>assertFieldStudyLodgeRoofCoverage(missing,spec),/front-sided roof shell covers/,'rays independently detect each missing wall triangle');const reversed=roofMutation(original,[target],true);assertFieldStudyLodgeRoofClosure(reversed,spec);assert.throws(()=>assertFieldStudyLodgeRoofCoverage(reversed,spec),/front-sided roof shell covers/,'complete but back-facing enclosed walls are rejected');report.wallNegativeControls+=2;}
  }
 });
 test('independent budget and preservation controls reject finite duplication and every changed binary attribute',()=>{
  report.budgetNegativeControls=0;for(const[k,v]of D081_SLOTS){const r=drawFieldStudyLodgeCase(k,{v});while(d081Cost(r.G)<=D081_CAP[k+':'+v])for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags'])g[key].push(...g[key]);r.cost=d081Cost(r.G);validFieldStudyLodgeGeometry(r);assert.throws(()=>assertFieldStudyLodgeBudget(r),/immutable cap/,'complete finite in-parcel duplicated geometry exceeds the independent published budget');report.budgetNegativeControls++;}
  report.preservationNegativeControls=0;for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){const r=drawFieldStudyLodgeCase(47,{v:0}),g=r.G.find(g=>g[key].length);assert.ok(g,'earlier wave exposes attribute '+key);g[key][0]+=.0001;assert.throws(()=>assert.equal(geoBytes(r),D081_PRIOR_MODELS['47:0'].float64Sha256),'non-target byte mutation must be rejected: '+key);report.preservationNegativeControls++;}
  const original=drawFieldStudyLodgeCase(160,{v:0}),duplicate=structuredClone(original);for(const g of duplicate.G){g.col=g.col.map(()=>.2);for(let i=0;i<g.pos.length;i+=3){g.pos[i]=9+g.pos[i]*2;g.pos[i+1]=-2+g.pos[i+1]*.3;g.pos[i+2]=5+g.pos[i+2]*.7;}}
  const identities=[original,duplicate].map(fieldStudyLodgeStructureSignature);assert.throws(()=>assert.equal(new Set(identities).size,2),'colored, moved and independently scaled duplicate fails uniqueness');
 });
 test('each complete architectural solid has an exact independently declared ground perimeter, with missing-face controls',()=>{
  assert.equal(D081_SOLIDS.length,17);report.closedSolidCases=0;report.closedSolidNegativeControls=0;
  for(const solid of D081_SOLIDS){for(const s of [1,4])for(const H of [.12,3.7])for(let turn=0;turn<4;turn++){const r=drawFieldStudyLodgeCase(solid.k,{v:solid.v,s,H,x0:-3.125,z0:7.375,y0:.21,turn});assertFieldStudyLodgeClosedSolid(r,solid);report.closedSolidCases++;}
   const r=drawFieldStudyLodgeCase(solid.k,{v:solid.v,s:1,H:1,x0:0,z0:0,y0:0});for(const collection of [D081_ROOFS,D081_WALLS]){const spec=collection.find(s=>s.k===solid.k&&s.v===solid.v&&s.id===solid.parts[0]+(collection===D081_WALLS?'-walls':'')),target=assertFieldStudyLodgeRoofClosure(r,spec)[0];assert.throws(()=>assertFieldStudyLodgeClosedSolid(roofMutation(r,[target]),solid),/every intended roof plane/,'a surface hole cannot remain a closed-solid witness');report.closedSolidNegativeControls++;}
  }
 });
 test('seventeen detached buildings retain positive component and ground-water separation with touching and overlapping controls',()=>{
  assert.equal(D081_CONTACTS.length,0);report.componentSeparationPairs=0;report.groundSeparationPairs=0;report.separationNegativeControls=0;
  for(const [k,v]of D081_SLOTS){const r=drawFieldStudyLodgeCase(k,{v}),result=assertFieldStudyLodgeSeparation(r);report.componentSeparationPairs+=result.componentPairs;report.groundSeparationPairs+=result.groundPairs;
   const model=D081_CONTRACT.models.find(m=>m.k===k&&m.v===v),a=horizontalBounds(model.components[0].groundFootprint.map(p=>[p[0],0,p[1]]));
   for(const overlap of [0,.01]){const b={lo:[a.hi[0]-overlap,a.lo[1]],hi:[a.hi[0]+.1,a.hi[1]]};assert.throws(()=>assertD081PositiveSeparation(a,b),/strictly positive separation/);report.separationNegativeControls++;}
   const covered=structuredClone(r),g=covered.G[2];for(let i=0;i<g.pos.length;i+=3){const p=roofNormalized(r,g.pos.slice(i,i+3));p[0]=a.lo[0]+.5*(a.hi[0]-a.lo[0]);p[2]=a.lo[1]+.5*(a.hi[1]-a.lo[1]);g.pos.splice(i,3,...roofWorld(r,p));}assert.throws(()=>assertFieldStudyLodgeSeparation(covered),/independent upward ground polygons/);report.separationNegativeControls++;
  }assert.equal(report.componentSeparationPairs,7);assert.equal(report.groundSeparationPairs,34);assert.equal(report.separationNegativeControls,30);
 });
 test('all 3264 independently transformed face normals use inverse-transpose scale and the actual rigid orientation',()=>{
  report.inverseTransposeNormalCases=0;
  for(const [k,v]of D081_SLOTS)for(const [s,H]of [[1,.12],[4,3.7],[1,D081_KT.height(k,1,v)]])for(let turn=0;turn<4;turn++){
   const r=drawFieldStudyLodgeCase(k,{v,s,H,x0:-3.125,z0:7.375,y0:.21,turn});
   for(const spec of [...D081_ROOFS,...D081_WALLS].filter(s=>s.k===k&&s.v===v))for(const face of spec.faces){const expected=new THREE.Vector3(face.normalizedPlaneNormal[0]/s,face.normalizedPlaneNormal[1]/H,face.normalizedPlaneNormal[2]/s).normalize();for(let q=0;q<turn;q++)[expected.x,expected.z]=[-expected.z,expected.x];const keys=new Set(face.orientedTriangles.map(ids=>roofTriKey(ids.map(i=>face.vertices[i]))));for(const t of assertFieldStudyLodgeRoofClosure(r,spec).filter(t=>keys.has(roofTriKey(t.points)))){for(let j=0;j<3;j++)assert.ok(new THREE.Vector3(...r.G[t.gi].nor.slice(t.ti*9+j*3,t.ti*9+j*3+3)).distanceTo(expected)<1e-6,'actual normal equals independently transformed plane normal');report.inverseTransposeNormalCases++;}}
  }assert.equal(report.inverseTransposeNormalCases,3264);
 });
 test('all architectural shells remain shadow-casting; decoration cannot buy a false budget reduction',()=>{
  report.arenaNegativeControls=0;
  for(const spec of [...D081_ROOFS,...D081_WALLS]){
   const original=drawFieldStudyLodgeCase(spec.k,{v:spec.v,s:1,H:1,x0:0,z0:0,y0:0}),target=assertFieldStudyLodgeRoofClosure(original,spec)[0],moved=roofMutation(original,[target]),source=original.G[target.gi],destination=moved.G[2];
   for(const key of ['pos','nor','col','uv','owners','tags']){const stride=key==='uv'?6:['owners','tags'].includes(key)?1:9;destination[key].push(...source[key].slice(target.ti*stride,(target.ti+1)*stride));}
   moved.cost=d081Cost(moved.G);validFieldStudyLodgeGeometry(moved);assertFieldStudyLodgeBudget(moved);assert.throws(()=>assertFieldStudyLodgeRoofClosure(moved,spec),/shadow-casting W\/O/,'an unchanged complete face transferred to D must be rejected');report.arenaNegativeControls++;
  }
  for(const [k,v]of D081_SLOTS){const r=drawFieldStudyLodgeCase(k,{v,s:1,H:1,x0:0,z0:0,y0:0});assertFieldStudyLodgeRoofInventory(r);const extra=structuredClone(r),g=extra.G.find(g=>g.pos.length),n=g.pos.slice(0,9);for(let i=0;i<9;i+=3)n[i+1]*=.91;g.pos.push(...n);assert.throws(()=>assertFieldStudyLodgeRoofInventory(extra),'an unpinned extra wall is forbidden even if the budget has spare capacity');report.arenaNegativeControls++;}

 });
 test('only original ground paving remains in D; raised facade or horizontal covers are rejected',()=>{
  report.groundDressCases=0;report.groundDressNegativeControls=0;
  for(const [k,v]of D081_SLOTS)for(const s of [1,4])for(const H of [.12,3.7])for(let turn=0;turn<4;turn++){
   const r=drawFieldStudyLodgeCase(k,{v,s,H,x0:-3.125,z0:7.375,y0:.21,turn});assertFieldStudyLodgeGroundDress(r);report.groundDressCases++;
   if(r.G[2].pos.length){const raised=structuredClone(r);for(let i=1;i<raised.G[2].pos.length;i+=3)raised.G[2].pos[i]+=.01*H;validFieldStudyLodgeGeometry(raised);assertFieldStudyLodgeBudget(raised);assert.throws(()=>assertFieldStudyLodgeGroundDress(raised),/ground paving level|independent upward ground polygons/,'finite affordable raised cover cannot obscure the complete fixed wall contract');report.groundDressNegativeControls++;const vertical=structuredClone(r);vertical.G[2].nor.splice(0,3,1,0,0);assert.throws(()=>assertFieldStudyLodgeGroundDress(vertical),/facade covers/,'vertical decorative planes may not return');report.groundDressNegativeControls++;}
  }
 });
 test('inherited wetland, campsite and remembrance heights and original owners/construction states remain explicit',()=>{
  for(const model of D081_CONTRACT.models)assert.equal(D081_KT.height(model.k,1,model.v),model.actualLevelOneH,'inherited exact table height');
  const gallery=d081City('gallery');for(const [k,id,x,z]of [[160,172,30,43],[182,157,60,37],[72,133,3,37]]){const b=gallery.buildings.find(b=>b.id===id);assert.equal(b.k,k);assert.equal(b.x,x);assert.equal(b.z,z);assert.equal(b.age,400);assert.equal(b.lv,1);assert.equal(b.goneDay,undefined);}
  for(const name of ['seed516','ai120'])assert.ok(!d081City(name).buildings.some(b=>D081_KINDS.includes(b.k)),'no selected kind in '+name);
 });
 test('all 74 historical fixtures remain byte-exact with independent mutation controls',()=>{
  const check=(read=file=>fs.readFileSync(path.join(ROOT,file)))=>{for(const [file,pin]of Object.entries(HISTORICAL.fixtures))assert.equal(createHash('sha256').update(read(file)).digest('hex'),pin,'exact immutable historical fixture '+file);};
  assert.equal(Object.keys(HISTORICAL.fixtures).length,74);check();report.historicalFixtureNegativeControls=0;
  for(const target of Object.keys(HISTORICAL.fixtures)){assert.throws(()=>check(file=>file===target?Buffer.concat([fs.readFileSync(path.join(ROOT,file)),Buffer.from(' ') ]):fs.readFileSync(path.join(ROOT,file))),/exact immutable historical fixture/,'a historical fixture may never be refreshed to candidate output');report.historicalFixtureNegativeControls++;}
 });
 test('independently pinned courtyards and arrival notches remain deliberately uncovered',()=>{
  assert.equal(D081_OPEN_COURTS.length,OPEN_COURT_COUNT,'explicit outer arrival courts remain open');report.openCourtRays=0;
  for(const spec of D081_OPEN_COURTS)for(const size of [1,4])for(const H of [.12,3.7])for(let turn=0;turn<4;turn++){
   const r=drawFieldStudyLodgeCase(spec.k,{v:spec.v,s:size,H,x0:-3.125,z0:7.375,y0:.21,turn}),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.G.flatMap(g=>g.pos),3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
   try{for(const [x,z]of spec.points){const p=roofWorld(r,[x,0,z]),hits=new THREE.Raycaster(new THREE.Vector3(p[0],r.y0+r.H+1,p[2]),new THREE.Vector3(0,-1,0)).intersectObject(mesh);assert.ok(hits.every(hit=>hit.point.y<=r.y0+r.H*(spec.ceiling??.04)+1e-6),spec.id+' open court cannot acquire a false spanning roof');report.openCourtRays++;}}finally{geometry.dispose();mesh.material.dispose();}
  }
 });
 test('all one hundred twenty prior models retain every ordered isolated-release tree transform, with corruption controls',()=>{
  report.treeTransformCases=0;for(const [encoded,expected]of Object.entries(BASE.treeCases)){const[k,v,s,H,x0,z0,y0,turn]=JSON.parse(encoded),r=drawFieldStudyLodgeCase(k,{v,s,H,x0,z0,y0,turn});assert.deepEqual(r.trees,expected,'exact immutable tree transform '+encoded);report.treeTransformCases++;}
  assert.equal(report.treeTransformCases,20160,'all one hundred twenty prior models across sizes, height breaks, origins and rigid turns');
  for(const k of [54,47])for(const mutate of [r=>r.trees.reverse(),r=>r.trees.pop(),r=>r.trees.push({...r.trees[0]}),r=>r.trees[0].x+=.01,r=>r.trees[0].z+=.01,r=>r.trees[0].y+=.01,r=>r.trees[0].s+=.01]){const r=drawFieldStudyLodgeCase(k,{v:0,s:1,H:.35,x0:0,z0:0,y0:0}),expected=BASE.treeCases[JSON.stringify([k,0,1,.35,0,0,0,0])];mutate(r);assert.throws(()=>assert.deepEqual(r.trees,expected),'original ordered tree transformations remain independently pinned');}
  for(const [k,v]of D081_SLOTS){const r=drawFieldStudyLodgeCase(k,{v});r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5});assert.throws(()=>validFieldStudyLodgeGeometry(r),'new tree insertion cannot change a tree-free target');}
 });

 test('all 144 independent polygons have exact planar nonoverlapping partitions and complete projected roofs',()=>{
  report.partitionFaces=0;report.partitionTriangles=0;report.partitionNegativeControls=0;
  const faces=D081_CONTRACT.models.flatMap(m=>m.components.flatMap(c=>[...c.wallFaces,...c.roofFaces]));assert.equal(faces.length,144);
  for(const f of faces){const n=new THREE.Vector3(...f.normalizedPlaneNormal),p=new THREE.Vector3(...f.vertices[0]);for(const v of f.vertices)assert.ok(Math.abs(new THREE.Vector3(...v).sub(p).dot(n))<1e-10,'all face vertices are planar');const out=assertD081FacePartition(f);report.partitionFaces++;report.partitionTriangles+=out.triangles;
   for(const mutate of [t=>t.pop(),t=>t.push(t[0]),t=>{[t[0][1],t[0][2]]=[t[0][2],t[0][1]];}]){const indices=structuredClone(f.orientedTriangles);mutate(indices);assert.throws(()=>assertD081FacePartition(f,indices));report.partitionNegativeControls++;}
  }assert.equal(report.partitionTriangles,272);
  report.notchFillingNegativeControls=0;
  for(const f of faces){const drop=f.normalizedPlaneNormal.map(Math.abs).indexOf(Math.max(...f.normalizedPlaneNormal.map(Math.abs))),points=f.vertices.map((p,i)=>({p:p.filter((_,j)=>j!==drop),i})).sort((a,b)=>a.p[0]-b.p[0]||a.p[1]-b.p[1]),half=list=>{const out=[];for(const p of list){while(out.length>1&&cross2(out.at(-2).p,out.at(-1).p,p.p)<=1e-12)out.pop();out.push(p);}return out;},hull=[...half(points).slice(0,-1),...half([...points].reverse()).slice(0,-1)];if(Math.abs(polygonArea2(hull.map(p=>p.p)))-Math.abs(polygonArea2(f.vertices.map(p=>p.filter((_,j)=>j!==drop))))<1e-10)continue;
   const filled=hull.slice(1,-1).map((_,i)=>[hull[0].i,hull[i+1].i,hull[i+2].i]);for(const ids of filled){const[a,b,c]=ids.map(i=>new THREE.Vector3(...f.vertices[i]));if(b.sub(a).cross(c.sub(a)).dot(new THREE.Vector3(...f.normalizedPlaneNormal))<0)[ids[1],ids[2]]=[ids[2],ids[1]];}assert.throws(()=>assertD081FacePartition(f,filled),/exact polygon partition area/,'convex hull cannot fill independent plan notches');report.notchFillingNegativeControls++;
  }assert.equal(report.notchFillingNegativeControls,6,'cranked laboratory, double-gable and clerestory ends, and vigil notch have independently proved concavities');
  report.roofProjectionComponents=0;for(const m of D081_CONTRACT.models)for(const c of m.components){const tris=c.roofFaces.flatMap(f=>f.orientedTriangles.map(ids=>ids.map(i=>f.vertices[i]).map(p=>[p[0],p[2]]))).filter(t=>Math.abs(polygonArea2(t))>1e-12);assert.ok(Math.abs(tris.reduce((a,t)=>a+Math.abs(polygonArea2(t)),0)-Math.abs(polygonArea2(c.groundFootprint)))<1e-10,'roof projects over entire exact footprint');for(let i=0;i<tris.length;i++)for(let j=0;j<i;j++)assert.ok(triangleOverlapArea(tris[i],tris[j])<1e-10,'roof projection has no overlap');report.roofProjectionComponents++;}
  assert.equal(report.roofProjectionComponents,17);
 });
 test('all 4000 original target transforms remain exactly tree-free',()=>{
  report.targetTreeTransformCases=0;report.targetTreeNegativeControls=0;
  for(const [encoded,expected]of Object.entries(BASE.targetTreeCases)){const[k,v,s,H,x0,z0,y0,turn]=JSON.parse(encoded),r=drawFieldStudyLodgeCase(k,{v,s,H,x0,z0,y0,turn});assert.deepEqual(expected,[]);assert.deepEqual(r.trees,expected);report.targetTreeTransformCases++;}assert.equal(report.targetTreeTransformCases,4000);
  for(const [k,v]of D081_SLOTS){const r=drawFieldStudyLodgeCase(k,{v});r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5});assert.throws(()=>validFieldStudyLodgeGeometry(r));report.targetTreeNegativeControls++;}
 });
 test('D-only replacements and diagonal flips cannot manufacture architectural identity',()=>{
  report.architectureIdentityNegativeControls=0;
  for(const [k,v]of D081_SLOTS){const original=drawFieldStudyLodgeCase(k,{v,s:1,H:1,x0:0,z0:0,y0:0}),expected=fieldStudyLodgeArchitectureSignature(original);
   for(const mutate of [r=>{r.G[2].pos=[0,.004,0,1,.004,0,0,.004,1];},r=>{r.G[2].pos=[];},r=>{[r.G[0],r.G[1]]=[r.G[1],r.G[0]];},r=>{r.G.forEach(g=>{g.col=g.col.map(()=>.75);const tris=[];for(let i=0;i<g.pos.length;i+=9)tris.push(g.pos.slice(i,i+9));g.pos=tris.reverse().flat();});}]){const copy=structuredClone(original);mutate(copy);assert.equal(fieldStudyLodgeArchitectureSignature(copy),expected,'D/material/order edits preserve exact architecture');assert.throws(()=>assert.equal(new Set([expected,fieldStudyLodgeArchitectureSignature(copy)]).size,2),'same shell is rejected as a new model');report.architectureIdentityNegativeControls++;}
   const wall=D081_WALLS.find(s=>s.k===k&&s.v===v&&s.faces.some(f=>f.vertices.length===4));if(wall){const face=wall.faces.find(f=>f.vertices.length===4),expectedKeys=new Set(face.orientedTriangles.map(t=>roofTriKey(t.map(i=>face.vertices[i])))),targets=assertFieldStudyLodgeRoofClosure(original,wall).filter(t=>expectedKeys.has(roofTriKey(t.points)));assert.equal(targets.length,2);const copy=roofMutation(original,targets),gi=targets[0].gi;const alternative=face.orientedTriangles.some(t=>t.includes(0)&&t.includes(2))?[[0,1,3],[1,2,3]]:[[0,1,2],[0,2,3]];copy.G[gi].pos.push(...alternative.flatMap(t=>t.flatMap(i=>roofWorld(original,face.vertices[i]))));assert.equal(fieldStudyLodgeStructureSignature(copy),fieldStudyLodgeStructureSignature(original),'different diagonal alone preserves full structural signature');assert.equal(fieldStudyLodgeArchitectureSignature(copy),expected,'different diagonal alone preserves W/O signature');report.architectureIdentityNegativeControls++;}
  }
 });

 test('identity rejects recolored/reordered/moved/rotated/stretched copies and detects real geometric edits',()=>{
  const original=drawFieldStudyLodgeCase(160,{v:0}),expected=fieldStudyLodgeStructureSignature(original);
  for(let turn=0;turn<4;turn++){
   const copy={...original,G:original.G.slice().reverse().map(g=>({...g,pos:[],col:g.col.map(()=>.7)}))};
   original.G.slice().reverse().forEach((g,i)=>{const tris=[];for(let t=0;t<g.pos.length;t+=9){const points=[];for(let j=0;j<9;j+=3){let x=g.pos[t+j],z=g.pos[t+j+2];for(let q=0;q<turn;q++)[x,z]=[-z,x];points.push([12.3+x*2.7,-.9+g.pos[t+j+1]*.37,-8.2+z*.61]);}tris.push(points.reverse().flat());}copy.G[i].pos=tris.reverse().flat();});
   assert.equal(fieldStudyLodgeStructureSignature(copy),expected,'identity ignores parcel metadata, ordering and color');copy.G.find(g=>g.pos.length).pos[1]+=.01;assert.notEqual(fieldStudyLodgeStructureSignature(copy),expected,'real geometry edit detected');
  }
 });
 test('negative controls reject nonfinite/incomplete geometry, owner loss, collapse, overflow, wrong normals and trees',()=>{
  const arena=r=>r.G.find(g=>g.pos.length);
  for(const mutation of [r=>arena(r).pos[0]=NaN,r=>arena(r).owners[0]=0,r=>arena(r).owners.pop(),r=>arena(r).uv.pop(),r=>r.G[0].wst.push(1),r=>arena(r).tags.pop(),r=>arena(r).pos.splice(3,3,...arena(r).pos.slice(0,3)),r=>arena(r).pos[0]=r.x0+r.s+1,r=>arena(r).pos[1]=r.y0+r.H+.01,r=>arena(r).pos[1]=r.y0-.01,r=>arena(r).nor[0]=NaN,r=>arena(r).nor.splice(3,3,...arena(r).nor.slice(3,6).map(n=>-n)),r=>arena(r).nor.splice(0,3,0,0,0),r=>r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5})]){const r=drawFieldStudyLodgeCase(160,{v:0});mutation(r);assert.throws(()=>validFieldStudyLodgeGeometry(r));}
  const tilted=drawFieldStudyLodgeCase(160,{v:0}),g=arena(tilted),n=new THREE.Vector3(...g.nor.slice(0,3)),axis=Math.abs(n.y)<.8?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),tangent=axis.addScaledVector(n,-axis.dot(n)).normalize(),wrong=n.multiplyScalar(Math.SQRT1_2).addScaledVector(tangent,Math.SQRT1_2);g.nor.splice(0,3,...wrong.toArray());assert.throws(()=>validFieldStudyLodgeGeometry(tilted),/perpendicular/,'unit normals must be perpendicular, not merely in the right hemisphere');
 });
 test('copied previews change only supported slots and preserve original world and unsupported records',()=>{
  for(const sample of ['gallery','seed516','ai120']){const city=d081City(sample),before=sha(city);assert.equal(d081FieldStudyCity(city,null),city,'native preview is the original object');for(const variant of [0,1,2,3,4]){const copy=d081FieldStudyCity(city,variant);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history fields shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(isFieldStudyLodge(b.k,variant)){assert.notEqual(v,b);assert.equal(v.v,variant);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b,'unsupported requested slots keep the original building record');}}}
 });
 test('actual production fieldStudyLodge preview and hook retain unsupported slots and reject coercion',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),expression=view.match(/const fieldStudyView = \(c: City\): City => ([^\n]+);/);assert.ok(expression,'production copied-view expression is exposed');
  const preview=Function('c','fieldStudyForcedV','FIELD_STUDY_LODGES','return '+expression[1].replaceAll('fieldStudyForcedV!','fieldStudyForcedV'));
  const records=[];for(const k of [0,...D081_KINDS,135,28,32,65,999,'164','119','116','149','81'])for(const v of [0,1,2,3,4,7])records.push({id:records.length+1,k,v,size:2,x:4,z:6,history:[{day:3,kind:'placed'}]});
  const world=frozen({buildings:records,history:[{day:3,kind:'snapshot'}],day:9,seed:516}),before=sha(world);
  for(const v of [null,0,1,2,3,4]){const actual=preview(world,v,FIELD_STUDY_LODGES),expected=d081FieldStudyCity(world,v);assert.deepEqual(actual,expected,'real production expression matches independent exact-slot selection');assert.equal(actual.history,world.history);assert.equal(sha(world),before);if(v===null){assert.equal(actual,world);continue;}assert.notEqual(actual,world);assert.notEqual(actual.buildings,world.buildings);for(let i=0;i<records.length;i++){const b=records[i],copy=actual.buildings[i];if(isFieldStudyLodge(b.k,v)){assert.notEqual(copy,b);assert.deepEqual(copy,{...b,v});assert.equal(copy.history,b.history);}else assert.equal(copy,b,'unsupported requested variant leaves the exact original record unchanged');}}
  const method=view.match(/fieldStudyV\(v: number \| null\) \{ ([^\n]+) \},/);assert.ok(method,'production public hook is exposed');
  const hook=Function('let fieldStudyForcedV=null,needsRender=false,rebuilds=0,draws=0;const rebuildScene=fresh=>{if(fresh!==true)throw new Error("preview must rebuild fresh");rebuilds++;};const draw=()=>draws++;return {call(v){'+method[1]+'},state(){return {fieldStudyForcedV,needsRender,rebuilds,draws};}};')();
  for(const v of [0,1,2,3,4,null]){const was=hook.state();assert.equal(hook.call(v),v);assert.deepEqual(hook.state(),{fieldStudyForcedV:v,needsRender:true,rebuilds:was.rebuilds+1,draws:was.draws+1});}
  for(const v of [undefined,-1,5,.5,'0','1','2','3','4',true,false,NaN,Infinity]){const was=hook.state();assert.throws(()=>hook.call(v),/supports saved variants/);assert.deepEqual(hook.state(),was,'invalid request cannot update preview state or rebuild');if(v===undefined)assert.equal(d081FieldStudyCity(world,v),world,'omitted helper variant means native');else assert.throws(()=>d081FieldStudyCity(world,v),'independent copied preview rejects invalid input');}
 });
 test('three real cities × three modes × native/v0/v1/v2/v3/v4 preserve all other owners with zero whole-scene growth',()=>{
  // Independent saved-gallery pins: unsupported campsite v3/v4 retain saved v0.
  const expectedGallery={native:[[157,182,0],[172,160,0]],v0:[[157,182,0],[172,160,0]],v1:[[133,72,1],[157,182,1],[172,160,1]],v2:[[133,72,2],[157,182,2],[172,160,2]],v3:[[157,182,0],[172,160,3]],v4:[[157,182,0],[172,160,4]]};
  let targets=0;const covered=new Set();for(const variant of [null,0,1,2,3,4])for(const sample of ['seed516','ai120','gallery']){
   const preview=variant===null?'native':'v'+variant,source=d081City(sample),sourceHash=sha(source),city=d081FieldStudyCity(source,variant),world=sha(city),wanted=city.buildings.filter(b=>isFieldStudyLodge(b.k,b.v)&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   assert.deepEqual(wanted.map(b=>[b.id,b.k,b.v]),sample==='gallery'?expectedGallery[preview]:[],'independent unchanged gallery owner/variant inventory, including supported saved fallbacks');
   for(const mode of ['a','b','c']){
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=D081_OLD[preview][sample][mode];assert.equal(off.cost,old[0]);assert.equal(off.sig,old[1],'immutable immediate-D080 same-world/view signature');assert.equal(sha(city),world,'renderer preserves copied city/history');assert.equal(sha(source),sourceHash,'renderer preserves original world/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground);assert.deepEqual(on.dg.inst,off.dg.inst,'tree instances unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${preview} ${mode} mesh${mi} owner${id} exact bytes`);});for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile${i} unchanged`);});
    let delta=0;for(const b of wanted){const key=b.k+':'+b.v,a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.equal(a,D081_CAP[key]);assert.ok(n>=12&&n<=a,`${key}: ${n} <= ${a}`);assert.ok(on.content.some((rows,mi)=>rows[b.id]!==off.content[mi][b.id]),'each exact target slot changes');delta+=n-a;targets++;covered.add(key);}
    assert.equal(on.cost-off.cost,delta,'whole-city delta consists of exact target owners only');assert.ok(on.cost<=off.cost);if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.deepEqual(on,off,'no-target cities exactly unchanged');report.cities.push({sample,preview,mode,targets:wanted.length,before:off.cost,after:on.cost,delta,worldSha256:sourceHash});
   }
  }assert.equal(targets,42,'all supported target owners across native and five copied previews and three modes');assert.equal(covered.size,10,'all ten actual kind/variant slots rendered in real copied galleries');
 });
 test('every exact-slot production-batched model has real faces that pick its owning building',()=>{
  const source=d081City('gallery'),before=sha(source),covered=new Set();let picks=0;
  for(const variant of [0,1,2,3,4])for(const mode of ['a','b','c']){const city=d081FieldStudyCity(source,variant),con=new ConState(city.n),built=buildCityScene(city,D081_KT,STYLES.A,d081Blocks(city,mode),'d',d081Civic(true),con,true);
   try{const wanted=city.buildings.filter(b=>isFieldStudyLodge(b.k,b.v)&&b.goneDay===undefined),ids=new Set(wanted.map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const b of wanted){assert.ok([...seen].some(key=>key.startsWith(b.id+':')),`mode ${mode}: k${b.k} v${b.v} owner${b.id} is pickable`);covered.add(b.k+':'+b.v);}
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=30,'at least one actual hit for each supported forced-gallery target in all three modes');assert.equal(covered.size,10);assert.equal(sha(source),before);
 });
 test('procedural sources and reversible scope preserve simulation, saves, one hundred twenty earlier models and historical gates',()=>{
  for(const file of ['src/content/britishFieldStudyLodges.ts','src/render/britishFieldStudyLodgeArt.ts']){const source=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\/\/.*$/gm,'');for(const re of [/(?:from|import)[^;\n]*(?:fixtures|tools\/|unit-d0|d081-architecture|initial-architecture)/,/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b|\bwindow\b|\blocation\b/,/data:image|\.png|\.jpe?g|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])assert.doesNotMatch(source,re,file);}
  const allowed=new Set(['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishFieldStudyLodges.ts','src/render/britishFieldStudyLodgeArt.ts']),changed=execFileSync('git',['diff','--name-only',D081_BASELINE,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const file of [...changed,...untracked])assert.ok(allowed.has(file)||isD081TouchLeaseAllowed(file),'approved render-only source: '+file);
  assertD081Scope();const manifest=read('fixtures/d081-art-scope.json');const inventory=Object.keys(manifest.after);for(const bad of [[...inventory,'src/render/unauthorized.ts'],inventory.slice(1),[...inventory,inventory[0]]])assert.throws(()=>assertD081Inventory(bad),/exact source inventory/,'unknown, removed and duplicate paths are rejected');assert.throws(()=>d081HistoricalBytes('src/render/unauthorized.ts',()=>''),/belongs to D081 source inventory/,'unknown source path is rejected before restoration');for(const file of Object.keys(manifest.before))assert.equal(createHash('sha256').update(d081HistoricalBytes(file)).digest('hex'),manifest.before[file],'exact published D080 historical bytes');
  for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/recipes.ts','src/render/scene.ts','src/render/cityScene.ts','src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceFacilities.ts','src/render/britishCommerceFacilityArt.ts','src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts','src/content/britishCommerceThird.ts','src/render/britishCommerceThirdArt.ts','src/content/britishEducation.ts','src/render/britishEducationArt.ts','src/content/britishCampuses.ts','src/render/britishCampusArt.ts','src/content/britishEmergencyHotels.ts','src/render/britishEmergencyHotelArt.ts','src/content/britishFarmMemorials.ts','src/render/britishFarmMemorialArt.ts','src/ui/panelPress.ts','src/content/britishHealthResponse.ts','src/render/britishHealthResponseArt.ts','src/content/britishServiceLodges.ts','src/render/britishServiceLodgesArt.ts','src/content/britishTransitUtilityPavilions.ts','src/render/britishTransitUtilityPavilionsArt.ts','src/content/britishCommunityBuildings.ts','src/render/britishCommunityBuildingArt.ts','src/content/britishFieldStudyLodges.ts','src/render/britishFieldStudyLodgeArt.ts']){const mutated=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized mutation':'');assert.throws(()=>assertD081Scope(mutated),/exact allowed source/,'scope rejects '+target);assert.throws(()=>d081HistoricalBytes(target,mutated),/exact allowed source/,'historical restoration rejects '+target);}
 });
 test('twenty-three legacy switches disable only this wave; copied v0/v1/v2/v3/v4 hook never writes saved worlds',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),match=view.match(/const fieldStudyLodgeOn = ([^;]+);/);assert.ok(match);const flags=['fieldStudyArt','communityArt','transitUtilityArt','neighbourhoodArt','serviceLodgeArt','healthResponseArt','farmMemorialArt','emergencyHotelArt','campusArt','educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false,flag+' disables fieldStudyLodge');assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn|commerceVariantOn|commerceThirdOn|educationOn|campusOn|emergencyHotelOn|farmMemorialOn|healthResponseOn|serviceLodgeOn)|(?:village|industry|commerce|house)Art:/.test(line)))assert.ok(!line.includes('fieldStudyArt'),'fieldStudyLodge switch never disables earlier art');assert.match(view,/shapeOf\([^\n]*facilityOn, commerceVariantOn, commerceThirdOn, educationOn, campusOn, emergencyHotelOn, farmMemorialOn, healthResponseOn, serviceLodgeOn, neighbourhoodPavilionOn, transitUtilityPavilionOn, communityBuildingOn, fieldStudyLodgeOn\)/);assert.match(view,/fieldStudyV\(v: number \| null\)/);assert.match(view,/buildings: c\.buildings\.map\(/,'preview copies building records');assert.match(view,/fieldStudyView\(communityView\(transitUtilityView\(neighbourhoodView\(serviceLodgeView\(healthResponseView\(farmMemorialView\(emergencyHotelView\(campusView\(educationView\(commerceThirdView\(commerceView\(towerView\(c\)\)\)\)\)\)\)\)\)/,'production renders explicitly copied fieldStudyLodge view');
 });
 test('tested source and guard freeze remain exact through the entire focused run',()=>{assertD081Scope();assert.equal(sha(read('fixtures/d081-art-scope.json').after),sourceInventorySha256,'source manifest cannot change during the run');assert.equal(createHash('sha256').update(fs.readFileSync(path.join(ROOT,'tools/unit-d081.mjs'))).digest('hex'),guardSourceSha256,'tested guard bytes stay frozen');});
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {failed,report}=await d081Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d081'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d081/D081-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

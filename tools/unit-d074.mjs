// D074: ten exact farmMemorial slots, immediate published D073 budgets and read-only integration.
// Node geometry evidence only; actual WebGL captures and independent frame checks are separate.
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
import {Pen,drawKind} from '../src/render/kindArt.ts';
import {shapeOf,kindColors} from '../src/content/kindShapes.ts';
import {FARM_MEMORIAL_KINDS,FARM_MEMORIAL_BUILDINGS} from '../src/content/britishFarmMemorials.ts';
import {drawBritishFarmMemorial} from '../src/render/britishFarmMemorialArt.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {d058City,d058Blocks} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {assertD074Scope,d074HistoricalBytes} from './d074-scope.mjs';
import {FACILITY_TOOLS} from '../src/sim/edit.ts';
const read=f=>JSON.parse(fs.readFileSync(path.join(ROOT,f),'utf8'));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const frozen=o=>{if(o&&typeof o==='object'){Object.values(o).forEach(frozen);Object.freeze(o);}return o;};
export const D074_BASELINE='a5674d9bdbfbf439319b50e26c3f864864ab5363';
export const D074_SLOTS=frozen([[23,0],[23,1],[23,2],[23,3],[23,4],[54,0],[54,1],[54,2],[47,0],[47,1]]);
export const D074_KINDS=Object.freeze([23,54,47]);
const isFarmMemorial=(k,v)=>D074_SLOTS.some(([a,b])=>a===k&&b===v);
const baselineBytes=fs.readFileSync(path.join(ROOT,'fixtures/d074-geometry-before.json'));
assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'1462680a7f3955e289e952487af83f9365a2d1162be68e354956a626e3ad3701','immutable isolated-D073 geometry fixture');
const BASE=frozen(JSON.parse(baselineBytes));assert.equal(BASE.baseline,D074_BASELINE);
export const D074_CAP=frozen(Object.fromEntries(Object.entries(BASE.slots).map(([slot,r])=>[slot,r.cost])));
export const D074_PRESERVED=BASE.preserved;
export const D074_OLD=BASE.cities;
export const D074_MODEL_OLD=BASE.slots;
export const D074_PRIOR_MODELS=BASE.priorModels;
export const D074_KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
export const d074City=id=>d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
// Match the production render-only preview. Original saves and records never change.
export function d074FarmMemorialCity(city,v=null){
 assert.ok(v===null||v===0||v===1||v===2||v===3||v===4,'supported copied farmMemorial variant');
 return v===null?city:{...city,buildings:city.buildings.map(b=>isFarmMemorial(b.k,v)?{...b,v}:b)};
}
export const d074Civic=on=>({shape:k=>shapeOf(k,true,true,true,true,true,true,true,true,true,true,on),colors:(k,lv)=>kindColors(LOOKS,k,lv,D074_KT.catColor(D074_KT.cat(k)))});
export const d074Blocks=(city,mode='c')=>({...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true,houseArt:true});
export const d074Cost=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const geoSig=r=>sha([r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.wst,g.wgl,g.wbd,g.owners,g.tags]),r.trees,r.used]);
// Binary preservation also distinguishes signed zero, which JSON signatures intentionally do not.
const geoBytes=r=>{const h=createHash('sha256');for(const g of r.G)for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){h.update(key+':'+g[key].length+':');h.update(Buffer.from(Float64Array.from(g[key]).buffer));}h.update(JSON.stringify([r.trees,r.used]));return h.digest('hex');};
export function drawFarmMemorialCase(k,{v=0,lv=1,s=D074_KT.size(k),x0=3.125,z0=7.375,y0=.21,H=Math.max(.12,D074_KT.height(k,lv,v)),owner=71,on=true,turn=0}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[];for(const g of G)g.owner=owner;
 const C=kindColors(LOOKS,k,lv,D074_KT.catColor(D074_KT.cat(k))),args={W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k,v,C},input=sha([x0,z0,y0,s,H,k,v,C]);
 const used=[...drawKind(args,shapeOf(k,true,true,true,true,true,true,true,true,true,true,on))];
 assert.equal(sha([args.x0,args.z0,args.y0,args.s,args.H,args.k,args.v,args.C]),input,'drawKind preserves every scalar/color input');
 const r={G,trees,used,k,v,lv,s,x0,z0,y0,H,owner,turn,cost:d074Cost(G)};
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
export function farmMemorialStructureSignature(r){
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
// D074's botanical ring changes at H=.35 and clamps with parcel size. Keep the
// independent legacy arithmetic and insertion order, including floating-point tails.
export function d074ExpectedTrees(r){
 const out=[],add=(u,v,s)=>out.push({x:r.x0+u*r.s,z:r.z0+v*r.s,y:r.y0,s});
 if(r.k===54)for(let i=0;i<5;i++)add(.08+i/4*.84,.94,.65);
 if(r.k===47){const ts=r.H<.35?.5:Math.max(.6,Math.min(1.3,r.H/.7)),crown=.26*1.1*ts/r.s,ring=Math.max(.12,Math.min(.36,.48-crown));for(let i=0;i<4;i++){const a=i/4*Math.PI*2;add(.5+Math.cos(a)*ring,.5+Math.sin(a)*ring,ts);}}
 for(let q=0;q<(r.turn??0);q++)for(const t of out)[t.x,t.z]=[r.x0+r.s-(t.z-r.z0),r.z0+(t.x-r.x0)];
 return out;
}
export function validFarmMemorialGeometry(r){
 let top=-Infinity,low=Infinity;const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];
 assert.equal(r.G.length,3,'exactly the existing three arenas');assert.equal(r.trees.length,r.k===54?5:r.k===47?4:0,'exact existing tree count preserved');
 const treePin=BASE.treeCases[JSON.stringify([r.k,r.v,r.s,r.H,r.x0,r.z0,r.y0,r.turn??0])];if(treePin)assert.deepEqual(r.trees,treePin,'ordered tree transforms equal isolated published release');
 assert.deepEqual(r.trees,d074ExpectedTrees(r),'all ordered trees equal independent legacy formula for current height, size and rigid transform');
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
 const panels=axis==='x'?[[A,B,R,L],[E,D,R,L],[A,E,L],[B,D,R]]:[[A,E,R,L],[B,D,R,L],[A,B,L],[E,D,R]];
 if(extra.closedShell)panels.push([A,B,D,E]);
 return {k,v,id,panels,...extra,...(extra.closedShell?{shellDirections:{4:[0,-1,0]}}:{})};
};
// Closed mono-pitch end contracts cover the whole trapezoid to ground. An open
// byre has a complete roof prism above its lower eave: slope, two triangular
// ends, high wall and downward soffit. The last two panels need directed rays;
// upward-only roof rays cannot prove that either of those real faces exists.
const roofMono=(k,v,id,a,b,c,d,hl,hr,open=false)=>{
 const low=Math.min(hl,hr),top=[[[a,hl,c],[b,hr,c],[b,hr,d],[a,hl,d]]],x=hl>hr?a:b,high=Math.max(hl,hr);
 if(!open)return {k,v,id,panels:[...top,[[a,0,c],[b,0,c],[b,hr,c],[a,hl,c]],[[b,0,d],[a,0,d],[a,hl,d],[b,hr,d]]]};
 return {k,v,id,panels:[...top,[[a,low,c],[b,low,c],[x,high,c]],[[a,low,d],[b,low,d],[x,high,d]],[[x,low,c],[x,low,d],[x,high,d],[x,high,c]],[[a,low,c],[b,low,c],[b,low,d],[a,low,d]]],shellDirections:{3:[x===b?1:-1,0,0],4:[0,-1,0]}};
};
const roofTent=(k,v,id,plan,h,apex)=>({k,v,id,panels:plan.map((p,i)=>[[p[0],h,p[1]],[plan[(i+1)%plan.length][0],h,plan[(i+1)%plan.length][1]],apex])});
const ROOF_COMPONENT_COUNT=30,OPEN_COURT_COUNT=10;
export const D074_ROOFS=frozen([
 roofPitch(23,0,'courtyard-cattle-barn',.10,.88,.12,.35,.60,.40,'x'),
 roofPitch(23,0,'courtyard-feed-house',.10,.30,.35,.62,.40,.24,'z'),
 roofMono(23,0,'courtyard-open-byre',.69,.88,.35,.66,.38,.58,true),
 roofPitch(23,1,'aisled-central-barn',.28,.51,.12,.64,.66,.34,'z'),
 roofMono(23,1,'aisled-west-shelter',.12,.28,.12,.64,.35,.58),
 roofMono(23,1,'aisled-east-shelter',.51,.67,.12,.64,.58,.35),
 roofPitch(23,1,'aisled-separate-feed-store',.74,.92,.18,.46,.37,.18,'z'),
 roofPitch(23,2,'linear-milking-hall',.09,.32,.12,.67,.68,.32,'z'),
 roofPitch(23,2,'linear-cattle-shed',.66,.90,.23,.66,.39,.21,'z'),
 roofRect(23,2,'linear-milk-room',.32,.49,.12,.29,.43),
 roofPitch(23,3,'cross-main-barn',.10,.70,.12,.33,.65,.35,'x'),
 roofPitch(23,3,'cross-perpendicular-barn',.10,.33,.26,.65,.55,.30,'z'),
 roofMono(23,3,'cross-separate-shelter',.74,.92,.38,.65,.30,.48,true),
 roofMono(23,4,'modern-west-shed',.10,.30,.30,.67,.45,.29),
 roofMono(23,4,'modern-east-shed',.70,.90,.30,.67,.34,.51),
 roofPitch(23,4,'modern-feed-hall',.29,.72,.12,.30,.78,.22,'x'),
 roofPitch(54,0,'twin-west-chapel',.14,.38,.12,.44,.62,.38,'z'),
 roofPitch(54,0,'twin-east-chapel',.62,.84,.12,.44,.51,.28,'z'),
 roofRect(54,0,'twin-connecting-gate',.38,.62,.26,.34,.50),
 roofPitch(54,1,'cloister-long-chapel',.12,.36,.12,.72,.70,.30,'z'),
 roofPitch(54,1,'cloister-return-colonnade',.36,.88,.12,.30,.34,.16,'x',{closedShell:true}),
 roofPitch(54,2,'low-cruciform-nave',.40,.60,.18,.76,.65,.35,'z'),
 roofPitch(54,2,'low-cruciform-transept',.18,.82,.36,.54,.58,.24,'x'),
 roofRect(54,2,'low-recessed-porch',.44,.56,.76,.87,.42),
 roofPitch(47,0,'palm-court-glass-nave',.43,.57,.24,.76,.55,.45,'z'),
 roofTent(47,0,'palm-west-hex-house',[[.32,.27],[.43,.29],[.43,.49],[.32,.51],[.23,.43],[.23,.35]],.32,[.33,.70,.39]),
 roofTent(47,0,'palm-east-hex-house',[[.57,.49],[.68,.47],[.77,.55],[.77,.63],[.68,.71],[.57,.69]],.27,[.67,.56,.59]),
 roofMono(47,1,'alpine-west-glasshouse',.20,.40,.24,.48,.56,1),
 roofMono(47,1,'alpine-middle-glasshouse',.40,.63,.38,.60,.62,.35),
 roofMono(47,1,'alpine-east-glasshouse',.63,.81,.53,.76,.56,.24),
]);
export const D074_OPEN_COURTS=frozen([
 {k:23,v:0,id:'working-courtyard',points:[[.40,.45],[.50,.60],[.44,.67]],ceiling:.01},
 {k:23,v:1,id:'aisled-service-yard',points:[[.73,.55],[.80,.62],[.89,.68]],ceiling:.01},
 {k:23,v:2,id:'linear-service-lane',points:[[.42,.40],[.54,.61],[.50,.68]],ceiling:.01},
 {k:23,v:3,id:'cross-barn-yard',points:[[.45,.45],[.60,.60],[.64,.68]],ceiling:.01},
 {k:23,v:4,id:'modern-exercise-yard',points:[[.40,.40],[.60,.60],[.50,.67]],ceiling:.01},
 {k:54,v:0,id:'twin-chapel-remembrance-court',points:[[.45,.55],[.52,.68],[.60,.84]],ceiling:.01},
 {k:54,v:1,id:'cloister-remembrance-court',points:[[.42,.40],[.57,.58],[.78,.84]],ceiling:.01},
 {k:54,v:2,id:'low-chapel-garden',points:[[.80,.20],[.85,.62],[.85,.86]],ceiling:.01},
 {k:47,v:0,id:'palm-garden-paths',points:[[.33,.58],[.64,.39],[.60,.82]],ceiling:.01},
 {k:47,v:1,id:'alpine-garden-paths',points:[[.30,.55],[.55,.72],[.45,.82]],ceiling:.01},
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
export function d074RoofSamples(k,v){
 const specs=D074_ROOFS.filter(s=>s.k===k&&s.v===v&&!s.nonRoof),all=specs.flatMap(s=>roofTriangles(s).filter(t=>!s.shellDirections?.[t.panel])).map(t=>t.points).filter(roofUp),samples=[];
 for(const spec of specs)for(const [panel]of spec.panels.entries()){
  if(spec.shellDirections?.[panel])continue;
  const interior=roofTriangles(spec).filter(t=>t.panel===panel&&roofUp(t.points)).flatMap(t=>roofInterior(t.points)),exposed=interior.filter(([x,h,z])=>!all.some(t=>{const top=roofHeight(t,x,z);return top!==null&&top>h+1e-8;}));
  if(exposed.length===0)continue;assert.ok(exposed.length>=3,spec.id+' has three independently exposed interior roof samples');
  const selected=[exposed[0]],distance=(a,b)=>(a[0]-b[0])**2+(a[2]-b[2])**2;while(selected.length<3){const candidates=exposed.filter(p=>!selected.includes(p)).sort((a,b)=>Math.min(...selected.map(p=>distance(b,p)))-Math.min(...selected.map(p=>distance(a,p))));selected.push(candidates[0]);}
  for(const [sample,p]of selected.entries())samples.push({id:spec.id+':'+panel+':'+sample,component:spec.id,panel,x:p[0],z:p[2],h:p[1]});
 }return samples;
}
export function farmMemorialRoofTriangles(r,spec){
 const expected=new Set(roofTriangles(spec).map(t=>roofTriKey(t.points))),out=[];
 for(const [gi,g]of r.G.entries())for(let ti=0;ti<g.pos.length/9;ti++){const points=[];for(let j=0;j<9;j+=3)points.push(roofNormalized(r,g.pos.slice(ti*9+j,ti*9+j+3)));if(expected.has(roofTriKey(points)))out.push({gi,ti,points});}
 return out;
}
export function assertFarmMemorialRoofClosure(r,spec){
 const expected=roofTriangles(spec).map(t=>t.points),actual=farmMemorialRoofTriangles(r,spec);
 assert.deepEqual(actual.map(t=>roofTriKey(t.points)).sort(),expected.map(roofTriKey).sort(),spec.id+' has every intended roof plane and closing end face exactly once');
 assert.deepEqual(roofEdges(actual.map(t=>t.points)),roofEdges(expected),spec.id+' has no missing slope, unjoined edge, duplicated cap or open gable');
 const counts=roofEdges(expected);assert.ok(counts.every(([,count])=>count===1||count===2),spec.id+' independent roof specification is manifold above its intended boundary');
 if(spec.shellDirections)assert.ok(counts.every(([,count])=>count===2),spec.id+' open shelter roof prism is a completely closed manifold including high wall and soffit');
 return actual;
}
export function assertFarmMemorialRoofCoverage(r,spec){
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
function assertFarmMemorialRoofInventory(r){
 const assigned=new Set();for(const spec of D074_ROOFS.filter(s=>s.k===r.k&&s.v===r.v))for(const {gi,ti}of assertFarmMemorialRoofClosure(r,spec)){const key=gi+':'+ti;assert.ok(!assigned.has(key),'a roof triangle belongs to exactly one independent component');assigned.add(key);}
 let upward=0;for(let gi=0;gi<2;gi++){const g=r.G[gi];for(let ti=0;ti<g.pos.length/9;ti++)if(g.nor[ti*9+1]>1e-8){assert.ok(assigned.has(gi+':'+ti),'every real upward shadow surface has an independent roof or wall-cap pin');upward++;}}
 assert.ok(upward>0,'real roofs exist');return upward;
}
function roofMutation(r,targets,reverse=false){
 const copy=structuredClone(r);for(let gi=0;gi<copy.G.length;gi++){const indices=new Set(targets.filter(t=>t.gi===gi).map(t=>t.ti)),g=copy.G[gi];if(reverse){for(const ti of indices)for(let j=0;j<3;j++)[g.pos[ti*9+3+j],g.pos[ti*9+6+j]]=[g.pos[ti*9+6+j],g.pos[ti*9+3+j]];}else for(const key of ['pos','nor','col','uv','wst','wgl','wbd','owners','tags']){const stride=key==='uv'?6:['owners','tags'].includes(key)?1:['wst','wbd'].includes(key)?3:9;g[key]=g[key].filter((_,i)=>!indices.has(Math.floor(i/stride)));}}
 copy.cost=d074Cost(copy.G);return copy;
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
 const con=new ConState(city.n),built=buildCityScene(city,D074_KT,STYLES.A,d074Blocks(city,mode),'d',d074Civic(on),con,true);
 try{return {sig:signature(built),cost:weighted(built),dg:sceneDigest(built),content:ownerContent(built),boxes:built.ownerBoxes(),colors:built.kindColorsUsed(),meshes:built.meshStats(),batches:built.buildingMeshes().length,con:Object.fromEntries(['top','base','wallTop','blockOf'].map(k=>[k,Array.from(built.con[k])]))};}
 finally{built.dispose();con.dispose();}
}
export function d074Expected(){const out={};for(const v of [null,0,1,2,3,4]){const key=v===null?'native':'v'+v;out[key]={};for(const sample of ['seed516','ai120','gallery']){const city=d074FarmMemorialCity(d074City(sample),v),old=snapshot(city,'c',false),now=snapshot(city,'c',true);out[key][sample]={legacy:old.cost,farmMemorial:now.cost,delta:now.cost-old.cost};}}return out;}
export async function d074Guards(log=()=>{}){
 let failed=0;const report={baseline:D074_BASELINE,qualification:'Node geometry tests only; browser/WebGL captures are separate evidence.',tests:[],geometryCases:0,preservedCases:0,costs:{},cities:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D074 '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D074 '+name,e.stack??String(e));}};
 test('ten exact slots on three existing kinds; twelfth argument defaults off for every historical flag combination',()=>{
  assert.deepEqual([...FARM_MEMORIAL_KINDS],D074_KINDS);assert.equal(FARM_MEMORIAL_BUILDINGS.length,10);assert.equal(new Set(FARM_MEMORIAL_BUILDINGS.map(b=>b.id)).size,10);assert.deepEqual(FARM_MEMORIAL_BUILDINGS.map(b=>[b.k,b.v]),D074_SLOTS);
  for(const k of [0,...D074_KT.data.kinds.map(r=>r.k),999]){
   const off=shapeOf(k,true,true,true,true,true,true,true,true,true,true,false),on=shapeOf(k,true,true,true,true,true,true,true,true,true,true,true);
   assert.deepEqual(shapeOf(k,true,true,true,true,true,true,true,true,true,true),off,'twelfth argument defaults off');
   if(FARM_MEMORIAL_KINDS.has(k)){assert.notDeepEqual(on,off);assert.equal(on.p.farmMemorial,true);assert.equal(on.p.emergencyHotel,true);assert.equal(on.p.campus,true);assert.equal(on.p.education,true);assert.equal(on.p.commerceThird,true);assert.equal(on.p.commerceVariant,true);assert.equal(on.p.facility,true);}else assert.deepEqual(on,off,`non-target ${k} dispatch unchanged`);
   for(let mask=0;mask<1024;mask++){const flags=Array.from({length:10},(_,i)=>Boolean(mask&(1<<i)));assert.deepEqual(shapeOf(k,...flags),shapeOf(k,...flags,false),'all 1024 prior flag combinations preserve twelfth-argument default');}
  }
 });
 test('strict numeric saved slots only; all rejected kinds and variants emit no direct geometry',()=>{
  for(const k of [0,...D074_KINDS,65,999,'23','54','47',null,undefined])for(const v of [undefined,null,-1,0,1,2,3,4,5,6,7,8,9,10,.5,1.5,2.5,3.5,4.5,'0','1','2','3','4',true,false,NaN,Infinity]){
   const G=[new Geo({ext:true}),new Geo(),new Geo()],trees=[],a={W:G[0],O:G[1],D:G[2],trees,x0:0,z0:0,y0:0,s:1,H:1,k,v,C:kindColors(LOOKS,k,1,'#ffffff')},before=sha(a),accept=isFarmMemorial(k,v);
   assert.equal(drawBritishFarmMemorial(new Pen(a)),accept,`direct acceptance k${k} v${String(v)}`);if(accept)assert.ok(G.some(g=>g.pos.length));else assert.equal(sha(a),before,'rejected exact slot is a strict no-op');
  }
 });
 test('native ranch tool reaches all five variants; memorial and botanical slots remain saved/import-only and low chapel retains H=.19',()=>{
  assert.equal(D074_KT.height(54,1,2),.19,'inherited low chapel height is not raised');
  assert.ok(FACILITY_TOOLS.some(t=>t.id==='ranch'&&t.size===2),'existing native ranch tool remains');
  const source=fs.readFileSync(path.join(ROOT,'src/sim/rules/build.ts'),'utf8');assert.match(source,/ranch: 23/,'ranch native save ID');assert.match(source,/case 'cemetery':[\s\S]*?t.bld = \{ k: 16/,'ordinary cemetery tool remains k16');assert.doesNotMatch(source,/\bk: (?:47|54)\b/,'no native botanical or large-cemetery save ID is added');assert.match(source,/toolId === 'ranch' \? \(x \* 7 \+ y \* 5\) % 5/,'original coordinate-based ranch variant selection');
  assert.deepEqual([...new Set(Array.from({length:5},(_,x)=>(x*7+3*5)%5))].sort(),[0,1,2,3,4],'native coordinates reach every approved ranch variant');
 });
 test('immutable immediate-D073 slot budgets, all sixty earlier models and exhaustive non-target binary attributes',()=>{
  for(const [k,v]of D074_SLOTS){const key=k+':'+v,old=drawFarmMemorialCase(k,{v,on:false}),pin=D074_MODEL_OLD[key];assert.equal(old.cost,D074_CAP[key],key+' exact preceding-wave cost');assert.equal(geoSig(old),pin.sha256,key+' exact preceding-wave arrays');assert.equal(geoBytes(old),pin.float64Sha256,key+' exact preceding-wave binary attributes');}
  for(const [key,pin]of Object.entries(D074_PRIOR_MODELS)){const [k,v]=key.split(':').map(Number),r=drawFarmMemorialCase(k,{v});assert.equal(r.cost,pin.cost,key+' exact old-model cost');assert.equal(geoSig(r),pin.sha256,key+' exact old-model arrays');assert.equal(geoBytes(r),pin.float64Sha256,key+' exact old-model binary bytes');assert.equal(farmMemorialStructureSignature(r),pin.structureSha256,key+' exact prior normalized structure');}
  const preserved=createHash('sha256'),binary=createHash('sha256');
  for(const k of [0,...D074_KT.data.kinds.map(r=>r.k),999])for(const lv of [1,2,3])for(let v=0;v<9;v++)for(const s of new Set([1,D074_KT.size(k)])){
   if(isFarmMemorial(k,v))continue;const off=drawFarmMemorialCase(k,{lv,v,s,on:false}),on=drawFarmMemorialCase(k,{lv,v,s});assert.equal(geoSig(on),geoSig(off),`k${k} lv${lv} v${v} s${s} exact preserved arrays`);assert.equal(geoBytes(on),geoBytes(off),`k${k} lv${lv} v${v} s${s} exact preserved binary attributes`);preserved.update(JSON.stringify([k,lv,v,s,geoSig(on)]));binary.update(JSON.stringify([k,lv,v,s,geoBytes(on)]));report.preservedCases++;
  }
  assert.equal(report.preservedCases,D074_PRESERVED.cases);assert.equal(preserved.digest('hex'),D074_PRESERVED.sha256,'all preserved cases match isolated D073');assert.equal(binary.digest('hex'),D074_PRESERVED.float64Sha256,'all preserved binary bytes, including signed zero, match isolated D073');
 });
 test('all seventy models are unique after quarter-turn/translation/independent-scale/color/order normalization',()=>{
  const structures=new Map();
  for(const key of [...Object.keys(D074_PRIOR_MODELS),...D074_SLOTS.map(([k,v])=>k+':'+v)]){const [k,v]=key.split(':').map(Number),id=farmMemorialStructureSignature(drawFarmMemorialCase(k,{v,s:1}));assert.ok(!structures.has(id),`${key} cannot copy ${structures.get(id)}`);structures.set(id,key);}
  assert.equal(structures.size,70,'all sixty earlier models and ten new models are structurally distinct');
 });
 test('all exact-slot levels/heights/sizes/origins/quarter-turns preserve finite deterministic bounded geometry and strict budgets',()=>{
  for(const [k,v]of D074_SLOTS){let min=Infinity,max=0;const key=k+':'+v;for(const lv of [1,2,3])for(const s of new Set([1,D074_KT.size(k),4]))for(const H of new Set([.12,Math.max(.12,D074_KT.height(k,lv,v)),Math.max(.24,D074_KT.height(k,lv,v)*1.7)]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const options={v,lv,s,H,...origin,turn},r=drawFarmMemorialCase(k,options),again=drawFarmMemorialCase(k,options),old=drawFarmMemorialCase(k,{...options,on:false});validFarmMemorialGeometry(r);assert.equal(geoBytes(r),geoBytes(again),'byte-identical deterministic repeat');assert.notEqual(geoSig(r),geoSig(old),'each approved exact slot changes actual geometry');
   assert.deepEqual(r.trees,old.trees,'all ordered existing trees preserved');assert.equal(old.cost,D074_CAP[key],'strict immediate D073 weighted ceiling');
   assert.ok(r.cost>=12,'positive multi-face building floor within the immutable exact-slot cap');assert.ok(r.cost<=old.cost,`${key}: ${r.cost} <= ${old.cost}`);assert.equal(farmMemorialStructureSignature(r),farmMemorialStructureSignature(drawFarmMemorialCase(k,{...options,turn:0})),'four rigid orientations preserve structural identity');min=Math.min(min,r.cost);max=Math.max(max,r.cost);report.geometryCases++;
  }report.costs[key]={name:D074_KT.name(k),min,max,cap:D074_CAP[key]};}
 });
 test('every roof component has independent complete topology and front-sided intended-plan coverage',()=>{
  assert.equal(D074_ROOFS.length,ROOF_COMPONENT_COUNT,'independently specified complete building roofs');assert.equal(new Set(D074_ROOFS.map(s=>s.k+':'+s.v)).size,10,'roof contract covers all ten exact slots');assert.equal(new Set(D074_ROOFS.map(s=>s.k+':'+s.v+':'+s.id)).size,D074_ROOFS.length,'distinct independent component IDs');
  assert.deepEqual(D074_ROOFS.filter(s=>s.shellDirections).map(s=>[s.k,s.v,s.id]),[[23,0,'courtyard-open-byre'],[23,3,'cross-separate-shelter'],[54,1,'cloister-return-colonnade']],'every explicitly open-front roof includes its real closed underside shell');
  report.roofComponents=D074_ROOFS.length;report.roofComponentCases=0;report.roofCoverageRays=0;report.roofNegativeControls=0;report.roofShellNegativeControls=0;report.roofShellPanels=0;
  for(const spec of D074_ROOFS)for(const size of [1,4])for(const H of new Set([.12,Math.max(.12,D074_KT.height(spec.k,1,spec.v)),3.7]))for(const origin of [{x0:0,z0:0,y0:0},{x0:-3.125,z0:7.375,y0:.21}])for(let turn=0;turn<4;turn++){
   const r=drawFarmMemorialCase(spec.k,{v:spec.v,s:size,H,...origin,turn});assertFarmMemorialRoofClosure(r,spec);report.roofCoverageRays+=assertFarmMemorialRoofCoverage(r,spec);report.roofComponentCases++;
  }
  for(const spec of D074_ROOFS){
   const original=drawFarmMemorialCase(spec.k,{v:spec.v,s:1,H:1,x0:0,z0:0,y0:0}),targets=assertFarmMemorialRoofClosure(original,spec);
   // Individually delete every real triangle, including each vertical end gable.
   // Generic geometry still accepts these holes: topology must reject them.
   for(const target of targets){const missing=roofMutation(original,[target]);validFarmMemorialGeometry(missing);assert.throws(()=>assertFarmMemorialRoofClosure(missing,spec),/every intended roof plane/,'missing individual plane/end triangle is detected for '+spec.id);report.roofNegativeControls++;}
   const missing=roofMutation(original,targets);assert.throws(()=>assertFarmMemorialRoofCoverage(missing,spec),/front-sided roof covers/,'whole missing '+spec.id+' cannot hide behind other finite mesh faces');report.roofNegativeControls++;
   const reversed=roofMutation(original,targets,true);assertFarmMemorialRoofClosure(reversed,spec);assert.throws(()=>assertFarmMemorialRoofCoverage(reversed,spec),/front-sided roof covers/,'closed but back-facing '+spec.id+' fails physical front-sided coverage');report.roofNegativeControls++;
   for(const panel of Object.keys(spec.shellDirections??{}).map(Number)){
    const expected=new Set(roofTriangles(spec).filter(t=>t.panel===panel).map(t=>roofTriKey(t.points))),faces=targets.filter(t=>expected.has(roofTriKey(t.points)));
    assert.equal(faces.length,2,'each independently pinned high-wall/soffit panel has both triangles');report.roofShellPanels++;
    // Neither deleting a single triangle nor deleting/reversing an entire
    // high wall or soffit may be hidden by a still-correct upper roof slope.
    for(const group of [...faces.map(t=>[t]),faces]){
     const hole=roofMutation(original,group);validFarmMemorialGeometry(hole);assert.throws(()=>assertFarmMemorialRoofClosure(hole,spec),/every intended roof plane/,'missing roof-shell face is independently detected');assert.throws(()=>assertFarmMemorialRoofCoverage(hole,spec),/front-sided roof shell covers/,'directed rays reject missing high-wall/soffit faces');
     const backface=roofMutation(original,group,true);assertFarmMemorialRoofClosure(backface,spec);assert.throws(()=>assertFarmMemorialRoofCoverage(backface,spec),/front-sided roof shell covers/,'directed rays reject reversed high-wall/soffit faces despite complete topology');
     report.roofNegativeControls+=2;report.roofShellNegativeControls+=2;
    }
   }
  }
  assert.equal(report.roofShellPanels,5,'two byre high walls and all three open-front roof soffits');assert.equal(report.roofShellNegativeControls,30,'individual-triangle and whole-panel missing/backface controls cover all five shell panels');
  report.roofInventoryTriangles=0;for(const [k,v]of D074_SLOTS){const r=drawFarmMemorialCase(k,{v,s:1,H:1});report.roofInventoryTriangles+=assertFarmMemorialRoofInventory(r);const samples=d074RoofSamples(k,v);assert.ok(samples.length>=3,'every delivered building has independently exposed samples');assert.equal(new Set(samples.map(s=>s.id)).size,samples.length,'camera sample IDs are unique');for(const spec of D074_ROOFS.filter(s=>s.k===k&&s.v===v&&!s.nonRoof))assert.ok(samples.filter(s=>s.component===spec.id).length>=3,'each true roof component has at least three exposed independent points');assert.ok(samples.every(s=>Number.isFinite(s.h)&&s.h>0),'roof samples are real positive-height surfaces');}
 });
 test('independently pinned courtyards and arrival notches remain deliberately uncovered',()=>{
  assert.equal(D074_OPEN_COURTS.length,OPEN_COURT_COUNT,'explicit working and remembrance courts remain open');report.openCourtRays=0;
  for(const spec of D074_OPEN_COURTS)for(const size of [1,4])for(const H of [.12,3.7])for(let turn=0;turn<4;turn++){
   const r=drawFarmMemorialCase(spec.k,{v:spec.v,s:size,H,x0:-3.125,z0:7.375,y0:.21,turn}),geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.G.flatMap(g=>g.pos),3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
   try{for(const [x,z]of spec.points){const p=roofWorld(r,[x,0,z]),hits=new THREE.Raycaster(new THREE.Vector3(p[0],r.y0+r.H+1,p[2]),new THREE.Vector3(0,-1,0)).intersectObject(mesh);assert.ok(hits.every(hit=>hit.point.y<=r.y0+r.H*(spec.ceiling??.04)+1e-6),spec.id+' open court cannot acquire a false spanning roof');report.openCourtRays++;}}finally{geometry.dispose();mesh.material.dispose();}
  }
 });
 test('all five cemetery and four height-dependent botanical trees retain exact isolated-release transforms, with corruption controls',()=>{
  report.treeTransformCases=0;for(const [encoded,expected]of Object.entries(BASE.treeCases)){const[k,v,s,H,x0,z0,y0,turn]=JSON.parse(encoded),r=drawFarmMemorialCase(k,{v,s,H,x0,z0,y0,turn});assert.deepEqual(r.trees,expected,'exact immutable tree transform '+encoded);report.treeTransformCases++;}
  for(const k of [54,47])for(const mutate of [r=>r.trees.reverse(),r=>r.trees.pop(),r=>r.trees.push({...r.trees[0]}),r=>r.trees[0].x+=.01,r=>r.trees[0].z+=.01,r=>r.trees[0].y+=.01,r=>r.trees[0].s+=.01,r=>r.trees[0].s=NaN]){const r=drawFarmMemorialCase(k,{v:0,s:1,x0:0,z0:0,y0:0});mutate(r);assert.throws(()=>validFarmMemorialGeometry(r),'ordered tree count/location/ground/scale is immutable');}
 });

 test('identity rejects recolored/reordered/moved/rotated/stretched copies and detects real geometric edits',()=>{
  const original=drawFarmMemorialCase(23),expected=farmMemorialStructureSignature(original);
  for(let turn=0;turn<4;turn++){
   const copy={...original,G:original.G.slice().reverse().map(g=>({...g,pos:[],col:g.col.map(()=>.7)}))};
   original.G.slice().reverse().forEach((g,i)=>{const tris=[];for(let t=0;t<g.pos.length;t+=9){const points=[];for(let j=0;j<9;j+=3){let x=g.pos[t+j],z=g.pos[t+j+2];for(let q=0;q<turn;q++)[x,z]=[-z,x];points.push([12.3+x*2.7,-.9+g.pos[t+j+1]*.37,-8.2+z*.61]);}tris.push(points.reverse().flat());}copy.G[i].pos=tris.reverse().flat();});
   assert.equal(farmMemorialStructureSignature(copy),expected,'identity ignores parcel metadata, ordering and color');copy.G.find(g=>g.pos.length).pos[1]+=.01;assert.notEqual(farmMemorialStructureSignature(copy),expected,'real geometry edit detected');
  }
 });
 test('negative controls reject nonfinite/incomplete geometry, owner loss, collapse, overflow, wrong normals and trees',()=>{
  const arena=r=>r.G.find(g=>g.pos.length);
  for(const mutation of [r=>arena(r).pos[0]=NaN,r=>arena(r).owners[0]=0,r=>arena(r).owners.pop(),r=>arena(r).uv.pop(),r=>r.G[0].wst.push(1),r=>arena(r).tags.pop(),r=>arena(r).pos.splice(3,3,...arena(r).pos.slice(0,3)),r=>arena(r).pos[0]=r.x0+r.s+1,r=>arena(r).pos[1]=r.y0+r.H+.01,r=>arena(r).pos[1]=r.y0-.01,r=>arena(r).nor[0]=NaN,r=>arena(r).nor.splice(3,3,...arena(r).nor.slice(3,6).map(n=>-n)),r=>arena(r).nor.splice(0,3,0,0,0),r=>r.trees.push({x:r.x0,z:r.z0,y:r.y0,s:.5})]){const r=drawFarmMemorialCase(23);mutation(r);assert.throws(()=>validFarmMemorialGeometry(r));}
  const tilted=drawFarmMemorialCase(23),g=arena(tilted),n=new THREE.Vector3(...g.nor.slice(0,3)),axis=Math.abs(n.y)<.8?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),tangent=axis.addScaledVector(n,-axis.dot(n)).normalize(),wrong=n.multiplyScalar(Math.SQRT1_2).addScaledVector(tangent,Math.SQRT1_2);g.nor.splice(0,3,...wrong.toArray());assert.throws(()=>validFarmMemorialGeometry(tilted),/perpendicular/,'unit normals must be perpendicular, not merely in the right hemisphere');
 });
 test('copied previews change only supported slots and preserve original world and unsupported records',()=>{
  for(const sample of ['gallery','seed516','ai120']){const city=d074City(sample),before=sha(city);assert.equal(d074FarmMemorialCity(city,null),city,'native preview is the original object');for(const variant of [0,1,2,3,4]){const copy=d074FarmMemorialCity(city,variant);assert.notEqual(copy,city);assert.notEqual(copy.buildings,city.buildings);assert.equal(sha(city),before);for(const key of Object.keys(city))if(key!=='buildings')assert.equal(copy[key],city[key],'all other world/history fields shared unchanged');for(let i=0;i<city.buildings.length;i++){const b=city.buildings[i],v=copy.buildings[i];if(isFarmMemorial(b.k,variant)){assert.notEqual(v,b);assert.equal(v.v,variant);assert.deepEqual({...v,v:b.v},b);}else assert.equal(v,b,'unsupported requested slots keep the original building record');}}}
 });
 test('actual production farmMemorial preview and hook retain unsupported slots and reject coercion',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),expression=view.match(/const farmMemorialView = \(c: City\): City => ([^\n]+);/);assert.ok(expression,'production copied-view expression is exposed');
  const preview=Function('c','farmMemorialForcedV','FARM_MEMORIAL_BUILDINGS','return '+expression[1].replaceAll('farmMemorialForcedV!','farmMemorialForcedV'));
  const records=[];for(const k of [0,...D074_KINDS,32,65,999,'23','54','47'])for(const v of [0,1,2,3,4,7])records.push({id:records.length+1,k,v,size:2,x:4,z:6,history:[{day:3,kind:'placed'}]});
  const world=frozen({buildings:records,history:[{day:3,kind:'snapshot'}],day:9,seed:516}),before=sha(world);
  for(const v of [null,0,1,2,3,4]){const actual=preview(world,v,FARM_MEMORIAL_BUILDINGS),expected=d074FarmMemorialCity(world,v);assert.deepEqual(actual,expected,'real production expression matches independent exact-slot selection');assert.equal(actual.history,world.history);assert.equal(sha(world),before);if(v===null){assert.equal(actual,world);continue;}assert.notEqual(actual,world);assert.notEqual(actual.buildings,world.buildings);for(let i=0;i<records.length;i++){const b=records[i],copy=actual.buildings[i];if(isFarmMemorial(b.k,v)){assert.notEqual(copy,b);assert.deepEqual(copy,{...b,v});assert.equal(copy.history,b.history);}else assert.equal(copy,b,'unsupported requested variant leaves the exact original record unchanged');}}
  const method=view.match(/farmMemorialV\(v: number \| null\) \{ ([^\n]+) \},/);assert.ok(method,'production public hook is exposed');
  const hook=Function('let farmMemorialForcedV=null,needsRender=false,rebuilds=0,draws=0;const rebuildScene=fresh=>{if(fresh!==true)throw new Error("preview must rebuild fresh");rebuilds++;};const draw=()=>draws++;return {call(v){'+method[1]+'},state(){return {farmMemorialForcedV,needsRender,rebuilds,draws};}};')();
  for(const v of [0,1,2,3,4,null]){const was=hook.state();assert.equal(hook.call(v),v);assert.deepEqual(hook.state(),{farmMemorialForcedV:v,needsRender:true,rebuilds:was.rebuilds+1,draws:was.draws+1});}
  for(const v of [undefined,-1,5,.5,'0','1','2','3','4',true,false,NaN,Infinity]){const was=hook.state();assert.throws(()=>hook.call(v),/supports saved variants/);assert.deepEqual(hook.state(),was,'invalid request cannot update preview state or rebuild');if(v===undefined)assert.equal(d074FarmMemorialCity(world,v),world,'omitted helper variant means native');else assert.throws(()=>d074FarmMemorialCity(world,v),'independent copied preview rejects invalid input');}
 });
 test('three real cities × three modes × native/v0/v1/v2/v3/v4 preserve all other owners with zero whole-scene growth',()=>{
  let targets=0;const covered=new Set();for(const variant of [null,0,1,2,3,4])for(const sample of ['seed516','ai120','gallery']){
   const preview=variant===null?'native':'v'+variant,source=d074City(sample),sourceHash=sha(source),city=d074FarmMemorialCity(source,variant),world=sha(city),wanted=city.buildings.filter(b=>isFarmMemorial(b.k,b.v)&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=city.n&&b.z+b.size<=city.n),ids=new Set(wanted.map(b=>String(b.id))),foot=new Set();for(const b of wanted)for(let z=b.z;z<b.z+b.size;z++)for(let x=b.x;x<b.x+b.size;x++)foot.add(z*city.n+x);
   for(const mode of ['a','b','c']){
    const off=snapshot(city,mode,false),on=snapshot(city,mode,true),old=D074_OLD[preview][sample][mode];assert.equal(off.cost,old[0]);assert.equal(off.sig,old[1],'immutable immediate-D073 same-world/view signature');assert.equal(sha(city),world,'renderer preserves copied city/history');assert.equal(sha(source),sourceHash,'renderer preserves original world/history');
    assert.equal(on.batches,3);assert.equal(off.batches,3);assert.equal(on.dg.ground,off.dg.ground);assert.deepEqual(on.dg.inst,off.dg.inst,'tree instances unchanged');assert.deepEqual(on.dg.counts,off.dg.counts);assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
    on.content.forEach((rows,mi)=>{for(const id of new Set([...Object.keys(rows),...Object.keys(off.content[mi])]))if(!ids.has(id))assert.equal(rows[id],off.content[mi][id],`${sample} ${preview} ${mode} mesh${mi} owner${id} exact bytes`);});for(const id of new Set([...Object.keys(on.boxes),...Object.keys(off.boxes)]))if(!ids.has(id)){assert.deepEqual(on.boxes[id],off.boxes[id]);assert.deepEqual(on.colors[id],off.colors[id]);}
    for(const key of ['top','base','wallTop','blockOf'])on.con[key].forEach((v,i)=>{if(!foot.has(i))assert.equal(v,off.con[key][i],`construction ${key} tile${i} unchanged`);});
    let delta=0;for(const b of wanted){const key=b.k+':'+b.v,a=ownerCost(off.dg,b.id),n=ownerCost(on.dg,b.id);assert.equal(a,D074_CAP[key]);assert.ok(n>=12&&n<=a,`${key}: ${n} <= ${a}`);assert.ok(on.content.some((rows,mi)=>rows[b.id]!==off.content[mi][b.id]),'each exact target slot changes');delta+=n-a;targets++;covered.add(key);}
    assert.equal(on.cost-off.cost,delta,'whole-city delta consists of exact target owners only');assert.ok(on.cost<=off.cost);if(wanted.length)assert.notEqual(on.sig,off.sig);else assert.deepEqual(on,off,'no-target cities exactly unchanged');report.cities.push({sample,preview,mode,targets:wanted.length,before:off.cost,after:on.cost,delta,worldSha256:sourceHash});
   }
  }assert.equal(targets,72,'all supported target owners across native and five copied previews and three modes');assert.equal(covered.size,10,'all ten actual kind/variant slots rendered in real copied galleries');
 });
 test('every exact-slot production-batched model has real faces that pick its owning building',()=>{
  const source=d074City('gallery'),before=sha(source),covered=new Set();let picks=0;
  for(const variant of [0,1,2,3,4])for(const mode of ['a','b','c']){const city=d074FarmMemorialCity(source,variant),con=new ConState(city.n),built=buildCityScene(city,D074_KT,STYLES.A,d074Blocks(city,mode),'d',d074Civic(true),con,true);
   try{const wanted=city.buildings.filter(b=>isFarmMemorial(b.k,b.v)&&b.goneDay===undefined),ids=new Set(wanted.map(b=>b.id)),seen=new Set(),owners=built.pickOwners();
    for(const [mi,m] of built.buildingMeshes().entries()){const p=m.geometry.attributes.position,n=m.geometry.attributes.normal;for(let t=0;t<owners[mi].length;t++){const id=owners[mi][t],key=id+':'+mi;if(!ids.has(id)||seen.has(key))continue;const normal=new THREE.Vector3(n.getX(t*3),n.getY(t*3),n.getZ(t*3)),point=new THREE.Vector3();for(let j=0;j<3;j++)point.add(new THREE.Vector3(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j)));point.multiplyScalar(1/3);const hit=built.pick(new THREE.Raycaster(point.addScaledVector(normal,.0001),normal.clone().negate()));if(hit?.id===id){seen.add(key);picks++;}}
    }for(const b of wanted){assert.ok([...seen].some(key=>key.startsWith(b.id+':')),`mode ${mode}: k${b.k} v${b.v} owner${b.id} is pickable`);covered.add(b.k+':'+b.v);}
   }finally{built.dispose();con.dispose();}
  }assert.ok(picks>=45,'at least one actual hit for each supported forced-gallery target in all three modes');assert.equal(covered.size,10);assert.equal(sha(source),before);
 });
 test('procedural sources and reversible scope preserve simulation, saves, sixty earlier models and historical gates',()=>{
  for(const file of ['src/content/britishFarmMemorials.ts','src/render/britishFarmMemorialArt.ts']){const source=fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\/\/.*$/gm,'');for(const re of [/Math\.random/,/Date\.now|new Date|performance\.now/,/\bfetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB/,/\bdocument\b|\bwindow\b|\blocation\b/,/data:image|\.png|\.jpe?g|\.glb|TextureLoader|ImageLoader|new Image|OffscreenCanvas|createElement/i])assert.doesNotMatch(source,re,file);}
  const allowed=new Set(['src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishFarmMemorials.ts','src/render/britishFarmMemorialArt.ts']),changed=execFileSync('git',['diff','--name-only',D074_BASELINE,'--','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean),untracked=execFileSync('git',['ls-files','--others','--exclude-standard','src'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean);for(const file of [...changed,...untracked])assert.ok(allowed.has(file)||isD074TouchRepairAllowed(file),'approved render-only source: '+file);
  assertD074Scope();const manifest=read('fixtures/d074-art-scope.json');for(const file of manifest.modified)assert.equal(createHash('sha256').update(d074HistoricalBytes(file)).digest('hex'),manifest.before[file],'exact published D073 historical bytes');
  for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-looks.json','src/content/recipes.ts','src/render/scene.ts','src/render/cityScene.ts','src/cityView.ts','src/content/kindShapes.ts','src/render/kindArt.ts','src/content/britishCommerceFacilities.ts','src/render/britishCommerceFacilityArt.ts','src/content/britishCommerceVariants.ts','src/render/britishCommerceVariantArt.ts','src/content/britishCommerceThird.ts','src/render/britishCommerceThirdArt.ts','src/content/britishEducation.ts','src/render/britishEducationArt.ts','src/content/britishCampuses.ts','src/render/britishCampusArt.ts','src/content/britishEmergencyHotels.ts','src/render/britishEmergencyHotelArt.ts','src/content/britishFarmMemorials.ts','src/render/britishFarmMemorialArt.ts']){const mutated=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized mutation':'');assert.throws(()=>assertD074Scope(mutated),/exact allowed source/,'scope rejects '+target);assert.throws(()=>d074HistoricalBytes(target,mutated),/exact allowed source/,'historical restoration rejects '+target);}
 });
 test('seventeen legacy switches disable only this wave; copied v0/v1/v2/v3/v4 hook never writes saved worlds',()=>{
  const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8'),match=view.match(/const farmMemorialOn = ([^;]+);/);assert.ok(match);const flags=['farmMemorialArt','emergencyHotelArt','campusArt','educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'],evaluate=Function('q','return '+match[1]);assert.deepEqual([...match[1].matchAll(/'(\w+Art)'/g)].map(m=>m[1]),flags);assert.equal(evaluate(new URLSearchParams()),true);for(const flag of flags){assert.equal(evaluate(new URLSearchParams(flag+'=legacy')),false,flag+' disables farmMemorial');assert.equal(evaluate(new URLSearchParams(flag+'=other')),true);}assert.equal(evaluate(new URLSearchParams('spaceArt=legacy')),true);
  for(const line of view.split('\n').filter(line=>/const (?:towerOn|metropolisOn|landmarkOn|facilityOn|commerceVariantOn|commerceThirdOn|educationOn|campusOn|emergencyHotelOn)|(?:village|industry|commerce|house)Art:/.test(line)))assert.ok(!line.includes('farmMemorialArt'),'farmMemorial switch never disables earlier art');assert.match(view,/shapeOf\([^\n]*facilityOn, commerceVariantOn, commerceThirdOn, educationOn, campusOn, emergencyHotelOn, farmMemorialOn\)/);assert.match(view,/farmMemorialV\(v: number \| null\)/);assert.match(view,/buildings: c\.buildings\.map\(/,'preview copies building records');assert.match(view,/farmMemorialView\(emergencyHotelView\(campusView\(educationView\(commerceThirdView\(commerceView\(towerView\(c\)\)\)\)\)\)\)/,'production renders explicitly copied farmMemorial view');
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const {failed,report}=await d074Guards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));fs.mkdirSync(path.join(ROOT,'scratch/d074'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d074/D074-unit.json'),JSON.stringify(report,null,2)+'\n');process.exitCode=failed?1:0;}

// D063 tests actual procedural meshes and production scenes, without claiming browser rendering or Android hardware acceptance.
// Probes measure the vertices that were really generated (rays, radii, peaks), never the constants in the art file.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {Geo} from '../src/render/scene.ts';
import {WIN_STYLE} from '../src/render/windows.ts';
import {drawBritishCommerce} from '../src/render/britishCommerceArt.ts';
import {commerceBlock,COMMERCE_MODELS} from '../src/content/britishCommerce.ts';
import {recipe,PX_PER_CELL} from '../src/content/recipes.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {signature,weighted} from './d060-baseline.mjs';
import {measureCommerce,CORE,SIZES} from './d063-baseline.mjs';
import {dE} from './d061-scenes.mjs';
import {assertD063Scope,d063HistoricalBytes} from './d063-scope.mjs';

const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ARCHE=read('src/content/lab-arche.json').arche;
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const BASE=read('fixtures/d063-baseline.json');
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
// model -> the existing kind-2 core archetype it dresses (lab-arche.json names); levels are looked up, never typed twice
const ARCH_OF={marketHall:'market',shopParade:'modernShop',greatStore:'dept',slabDrum:'modernOffice',gothicHotel:'stoneHotel',pilotisTower:'podTower',steppedOffice:'setback',gridCourt:'slabC',domedTower:'stoneTower',telecomTower:'modernNeedle',bridgedCourt:'courtC'};
const LEVEL=Object.fromEntries(Object.entries(ARCH_OF).map(([model,name])=>[model,[1,2,3].find(lv=>(ARCHE['2_'+lv]??[]).some(a=>a.n===name))]));
const FLOOR=40;
const PSIZES=[[2,2],[1,1],[1,2],[3,3],[1,4]];
const PALS=[0,1,2,3,4,5];
const CITY_CAP={seed516:118884,ai120:106365};
const capOf=(model,w,d)=>BASE.oldCost[ARCH_OF[model]].sizes[w+'x'+d].cap;
// Height ceilings above the block's ground (cells): measured over every size and recipe variant, plus a small margin; towers keep absolute proportions.
const CEIL={marketHall:.52,shopParade:.57,greatStore:1.40,slabDrum:1.37,gothicHotel:2.03,pilotisTower:2.80,steppedOffice:2.43,gridCourt:1.85,domedTower:2.72,telecomTower:3.28,bridgedCourt:1.63};
const weightedOf=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const digest=b=>{const d=sceneDigest(b);return {meshes:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),ground:d.ground,inst:d.inst,queries:d.queries,counts:d.counts};};
const variantsOf=(model,w,d)=>{const out=[];for(let v=0;v<24;v++){const r=recipe(ARCHE,2,LEVEL[model],w,d,v);if(r.arche===ARCH_OF[model]&&r.path==='core')out.push(v);}return out;};

// Non-zero origin and ground level: absolute-vs-local coordinate mistakes cannot hide at (0,0,0).
export function drawCommerceCase(model,{w=2,d=2,v,pal=0,x0=3.125,z0=7.375,y0=.21,owner=71,weather=true}={}) {
  v??=variantsOf(model,w,d)[0];
  const r=recipe(ARCHE,2,LEVEL[model],w,d,v);
  assert.equal(commerceBlock(r),model,`${model} ${w}x${d} v${v} selects its own model`);
  const G=[new Geo({ext:true}),new Geo(),new Geo()];
  for(const g of G)g.owner=owner;
  const wall=r.wallPx/PX_PER_CELL,ctx={W:G[0],O:G[1],D:G[2],x0,z0,w,d,y0,wall,pal,weather};
  const input=JSON.stringify([x0,z0,w,d,y0,wall,pal,owner,weather]);
  const anchor=drawBritishCommerce(ctx,model);
  assert.equal(JSON.stringify([ctx.x0,ctx.z0,ctx.w,ctx.d,ctx.y0,ctx.wall,ctx.pal,G[0].owner,ctx.weather]),input,'read-only model coordinates, palette and owner');
  return {G,anchor,model,w,d,v,wall,x0,z0,y0,pal,owner};
}

function validGeometry(r) {
  let top=-Infinity;
  for(const g of r.G) {
    assert.equal(g.pos.length%9,0,'complete triangles');
    assert.equal(g.nor.length,g.pos.length,'normal length');
    assert.equal(g.col.length,g.pos.length,'color length');
    assert.equal(g.uv.length,g.pos.length/3*2,'UV length');
    assert.equal(g.owners.length,g.pos.length/9,'one owner per triangle');
    assert.equal(g.tags.length,g.owners.length,'one tag per triangle');
    assert.ok(g.owners.every(o=>o===r.owner),'actual picking ownership');
    if(g.ext) {
      assert.equal(g.wst.length,g.pos.length/3,'window style length');
      assert.equal(g.wgl.length,g.pos.length,'window glass length');
      assert.equal(g.wbd.length,g.pos.length/3,'window band length');
    }
    for(const key of ['pos','nor','col','uv','wst','wgl','wbd','tags'])assert.ok(g[key].every(Number.isFinite),key+' finite');
    for(let i=0;i<g.pos.length;i+=3) {
      assert.ok(g.pos[i]>=r.x0-1e-7&&g.pos[i]<=r.x0+r.w+1e-7,`${r.model} ${r.w}x${r.d} parcel x`);
      assert.ok(g.pos[i+2]>=r.z0-1e-7&&g.pos[i+2]<=r.z0+r.d+1e-7,`${r.model} ${r.w}x${r.d} parcel z`);
      assert.ok(g.pos[i+1]>=r.y0-1e-7&&g.pos[i+1]<=r.y0+CEIL[r.model],`${r.model} ${r.w}x${r.d} height ceiling ${g.pos[i+1]-r.y0}`);
      assert.ok(Math.abs(Math.hypot(...g.nor.slice(i,i+3))-1)<1e-6,'unit normal');
      top=Math.max(top,g.pos[i+1]);
    }
    for(let i=0;i<g.pos.length;i+=9) {
      const a=new THREE.Vector3(...g.pos.slice(i,i+3));
      const u=new THREE.Vector3(...g.pos.slice(i+3,i+6)).sub(a);
      const v=new THREE.Vector3(...g.pos.slice(i+6,i+9)).sub(a);
      const cross=u.cross(v);
      assert.ok(cross.length()>1e-10,'nondegenerate triangle');
      assert.ok(cross.dot(new THREE.Vector3(...g.nor.slice(i,i+3)))>0,'outward winding');
    }
  }
  const cost=weightedOf(r.G),cap=capOf(r.model,r.w,r.d);
  assert.ok(cost>=FLOOR&&cost<=cap,`${r.model} ${r.w}x${r.d} v${r.v} weighted triangles ${cost} outside ${FLOOR}..${cap}`);
  assert.ok(top>=r.y0+r.wall-1e-9,r.model+' never lower than the recipe wall ('+(top-r.y0)+' < '+r.wall+')');
  assert.ok(r.anchor instanceof THREE.Vector3&&r.anchor.toArray().every(Number.isFinite),'finite anchor');
  return cost;
}

// ---- ray helpers over the three real arenas (index 0 walls, 1 other, 2 dress) ----
const meshOf=g=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.pos,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(g.nor,3));return new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));};
function meshes(r){return r.meshes??=r.G.map(meshOf);}
function release(r){for(const m of r.meshes??[]){m.geometry.dispose();m.material.dispose();}r.meshes=undefined;}
const at=(r,u,v,h)=>new THREE.Vector3(r.x0+u*r.w,r.y0+h,r.z0+v*r.d);
function cast(r,from,dir,far,arenas=[0,1,2]) {
  const ray=new THREE.Raycaster(from,dir.clone().normalize(),0,far),out=[];
  for(const a of arenas)for(const h of ray.intersectObject(meshes(r)[a],false))out.push({...h,arena:a});
  return out.sort((p,q)=>p.distance-q.distance);
}
const down=new THREE.Vector3(0,-1,0);

// A box with its top missing shows its inside faces from the camera; camera-like rays must never reach a back face first.
function openContainers(r,n=21) {
  let bad=0;const sample=[];
  for(let i=0;i<n;i++)for(let j=0;j<n;j++) {
    const x=r.x0+r.w*(i+.5)/n,z=r.z0+r.d*(j+.5)/n;
    for(const [dx,dz] of [[.6,.6],[-.6,.6],[.6,-.6],[-.6,-.6]]) {
      const dir=new THREE.Vector3(dx,-1,dz).normalize(),from=new THREE.Vector3(x-dx*4,r.y0+4,z-dz*4);
      const hits=cast(r,from,dir,30),hit=hits[0];
      // a coincident pair drawn once each way (a double-sided dormer front) always shows its camera-facing copy: only an all-back-facing first hit is a hole
      if(hit&&hits.filter(h=>h.distance-hit.distance<1e-7).every(h=>h.face.normal.dot(dir)>1e-6)){bad++;if(sample.length<3)sample.push([+hit.point.x.toFixed(2),+hit.point.z.toFixed(2),+(hit.point.y-r.y0).toFixed(2)]);}
    }
  }
  return {bad,sample};
}

// ---- probe toolkit: parts are found by their geometry and their dress colour, never by constants of the art file's layout alone ----
const topAt=(r,u,v,arenas)=>{const h=cast(r,at(r,u,v,10),down,20,arenas)[0];return h?h.point.y-r.y0:-Infinity;};
const clear=(r,a,b)=>{const from=at(r,...a),to=at(r,...b);return cast(r,from,to.clone().sub(from),from.distanceTo(to)).length===0;};
const hexOf=(g,t)=>new THREE.Color(g.col[t*9],g.col[t*9+1],g.col[t*9+2]).getHexString();
const triPts=(g,t)=>[0,1,2].map(j=>[g.pos[t*9+j*3],g.pos[t*9+j*3+1],g.pos[t*9+j*3+2]]);
const triNormal=(g,t)=>{const [a,b,c]=triPts(g,t).map(p=>new THREE.Vector3(...p));return b.sub(a).cross(c.sub(a)).normalize();};
const trisWhere=(g,pred)=>{const out=[];for(let t=0;t<g.owners.length;t++)if(pred(t,triPts(g,t),hexOf(g,t),triNormal(g,t)))out.push(t);return out;};
function verts(g,pred) {const out=[];for(let i=0;i<g.pos.length;i+=3){const p=[g.pos[i],g.pos[i+1],g.pos[i+2]];if(pred(p))out.push(p);}return out;}
const wallTop=r=>Math.max(...r.G[0].tags)-r.y0;
const lodOf=r=>{const a=r.w*r.d;return a<=2?0:a<=4?1:2;};
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const uOf=(r,x)=>(x-r.x0)/r.w,vOf=(r,z)=>(z-r.z0)/r.d;
const distinct=(list,eps=1e-3)=>{const out=[];for(const q of list)if(!out.some(o=>Math.hypot(...o.map((x,i)=>x-q[i]))<eps))out.push(q);return out;};
const hexNum=h=>parseInt(String(h).replace('#',''),16);
// Dominant (area-weighted) colour of the weather-tagged main walls, as hex.
function wallColour(r) {
  const g=r.G[0],area=new Map();
  for(let t=0;t<g.tags.length;t++){
    if(!g.tags[t])continue;
    const [a,b,c]=triPts(g,t).map(p=>new THREE.Vector3(...p));
    area.set(hexOf(g,t),(area.get(hexOf(g,t))??0)+b.sub(a).cross(c.sub(a)).length()/2);
  }
  return [...area.entries()].sort((p,q)=>q[1]-p[1])[0][0];
}
// A part (a set of triangles of one arena) must stand on something: below the footprint samples, the first surface that is not the part
// itself lies at or above the part's lowest point (or there is nothing and the part stands on the block's ground).
function rests(r,label,arena,tris) {
  const g=r.G[arena],set=new Set(tris),pts=tris.flatMap(t=>triPts(g,t));
  assert.ok(pts.length>=9,label+' part has geometry');
  const base=Math.min(...pts.map(p=>p[1])),top=Math.max(...pts.map(p=>p[1])),low=pts.filter(p=>p[1]<base+1e-6);
  const cx=mean(low.map(p=>p[0])),cz=mean(low.map(p=>p[2])),samples=[[cx,cz],...low.map(p=>[cx+(p[0]-cx)*.5,cz+(p[2]-cz)*.5])];
  for(const [x,z] of samples) {
    const from=new THREE.Vector3(x,base+(top-base)*.5,z),hits=cast(r,from,down,20).filter(h=>!(h.arena===arena&&set.has(h.faceIndex)));
    const support=hits.length?hits[0].point.y:r.y0;
    assert.ok(support>=base-1e-6,`floating ${label}: base ${(base-r.y0).toFixed(4)}, nearest surface below ${(support-r.y0).toFixed(4)}`);
  }
  return {base:base-r.y0,top:top-r.y0};
}
// A roof (pyramid, cone) over open-topped walls: its lowest level equals the top of the walls under it, and it covers their whole footprint.
function capsWalls(r,label,arena,tris) {
  const g=r.G[arena],pts=tris.flatMap(t=>triPts(g,t)),base=Math.min(...pts.map(p=>p[1]));
  const minx=Math.min(...pts.map(p=>p[0])),maxx=Math.max(...pts.map(p=>p[0])),minz=Math.min(...pts.map(p=>p[2])),maxz=Math.max(...pts.map(p=>p[2]));
  const walls=trisWhere(r.G[0],(t,p)=>{const cx=mean(p.map(q=>q[0])),cz=mean(p.map(q=>q[2]));return cx>=minx&&cx<=maxx&&cz>=minz&&cz<=maxz&&Math.abs(triNormal(r.G[0],t).y)<1e-6;});
  assert.ok(walls.length>=8,label+' stands on walls of its own ('+walls.length+' triangles)');
  const wp=walls.flatMap(t=>triPts(r.G[0],t)),top=Math.max(...wp.map(p=>p[1]));
  assert.ok(Math.abs(base-top)<1e-6,`floating ${label}: base ${(base-r.y0).toFixed(4)}, wall top ${(top-r.y0).toFixed(4)}`);
  assert.ok(Math.min(...wp.map(p=>p[0]))>=minx-1e-9&&Math.max(...wp.map(p=>p[0]))<=maxx+1e-9&&Math.min(...wp.map(p=>p[2]))>=minz-1e-9&&Math.max(...wp.map(p=>p[2]))<=maxz+1e-9,label+' covers the whole wall footprint');
  return {base:base-r.y0,walls};
}
// Move a part's triangles up (a negative control: the part now floats).
function lift(r,arena,tris,dy) {const g=r.G[arena];for(const t of tris)for(let j=0;j<3;j++)g.pos[t*9+j*3+1]+=dy;release(r);}
function infill(r,arena,[u0,u1,v0,v1,h0,h1]) {
  const c=new THREE.Color('#986345');
  r.G[arena].box(r.x0+u0*r.w,r.z0+v0*r.d,r.x0+u1*r.w,r.z0+v1*r.d,r.y0+h0,r.y0+h1,c,c,null);
  release(r);
}
const pyramids=(g,pred)=>{   // apexes of pyramid/cone faces: the single highest vertex of triangles that are steep
  const found=new Map();
  for(let t=0;t<g.owners.length;t++) {
    if(!pred(t))continue;
    const p=triPts(g,t),hi=Math.max(...p.map(q=>q[1])),top=p.filter(q=>Math.abs(q[1]-hi)<1e-9);
    if(top.length!==1)continue;
    const key=top[0].map(x=>x.toFixed(5)).join(',');
    const e=found.get(key)??{apex:top[0],tris:[]};e.tris.push(t);found.set(key,e);
  }
  return [...found.values()];
};
const steep=(g,t)=>triNormal(g,t).y<=.6&&triNormal(g,t).y>0;
const windowStyles=r=>[...new Set(r.G[0].wst.filter(x=>x>0))];


// ---- the eleven defining-feature probes; each returns what it proved. Counts that depend on the parcel follow the card's size rule (lod: area <= 2, <= 4, larger) ----
export const PROBES={
  marketHall(r) {
    const L=lodOf(r),hw=topAt(r,.30,.40,[1])>0?0:0;void hw;
    const roofY=topAt(r,.5,.80,[1]),front=r.z0+.945*r.d;               // flat cap of the front range (the vault stands behind it)
    assert.ok(roofY>0.2,'front range roof exists');
    // pilasters: a horizontal ray just in front of the wall crosses each pilaster's two sides
    const hits=cast(r,new THREE.Vector3(r.x0+r.w+.5,r.y0+roofY*.5,front+.008),new THREE.Vector3(-1,0,0),r.w+1,[2]);
    assert.equal(hits.length%2,0,'pilasters are closed pairs of faces');
    const np=hits.length/2;
    assert.ok(np>=[2,3,4][L],`pilasters ${np} at lod ${L}`);
    const pil=verts(r.G[2],p=>p[1]<=r.y0+roofY+1e-5&&p[2]>front+1e-5);
    assert.ok(Math.max(...pil.map(p=>p[2]))-front>=.01,'pilasters stand proud of the wall by at least .01');
    assert.ok(Math.max(...pil.map(p=>p[1]))-r.y0>=.6*roofY,'pilasters run at least 60% of the wall height');
    // cornice and parapet band above the wall top
    assert.ok(topAt(r,.5,.944,[2])-roofY>=.025,'cornice band stands above the wall top');
    // central entrance: the first thing a ray from the street meets at u = .45 is a door-coloured decal
    const door=cast(r,at(r,.45,1.3,roofY*.3),new THREE.Vector3(0,0,-1),3)[0];
    assert.ok(door&&door.arena===2&&hexOf(r.G[2],door.faceIndex)==='34302b','central entrance decal');
    assert.ok(dE(hexNum('34302b'),hexNum(wallColour(r)))>=30,'entrance reads dark against the wall');
    // barrel vault: glazed facets across the depth, ridge above the cornice, glass unlike every wall palette
    const glass=trisWhere(r.G[1],(t,p,hex)=>hex==='6f98b4'||hex==='74a8c8');
    const facets=distinct(glass.map(t=>{const n=triNormal(r.G[1],t);return [n.x,n.y,n.z];}),1e-3).length;
    assert.ok(facets>=[4,5,6][L],`vault facets ${facets} at lod ${L}`);
    const ridge=topAt(r,.5,.40,[1]);
    assert.ok(ridge-(roofY+.03)>=.03,'vault ridge stands above the front cornice by at least .03 ('+(ridge-roofY-.03).toFixed(4)+')');
    for(const pal of PALS)for(const gl of ['6f98b4','74a8c8'])assert.ok(dE(hexNum(gl),hexNum(wallColour(drawCommerceCase('marketHall',{w:r.w,d:r.d,pal}))))>=20,'vault glass '+gl+' differs from the wall palette '+pal);
    return {forms:['barrel-vault'],landmark:false,expect:/vault ridge stands above the front cornice/,mutate(m){const g=m.G[1];for(let i=1;i<g.pos.length;i+=3)if(g.pos[i]>m.y0+roofY+.04)g.pos[i]=m.y0+roofY;release(m);},
      extra:[{expect:/pilasters/,mutate(m){const g=m.G[2],f=m.z0+.945*m.d;for(let i=0;i<g.pos.length;i+=3)if(g.pos[i+1]<=m.y0+roofY+1e-5&&g.pos[i+2]>f+1e-5)g.pos[i+2]=Math.min(g.pos[i+2],f+.004);release(m);}}]};
  },
  shopParade(r) {
    const g=r.G[0],hw=topAt(r,.30,.50,[1]);
    assert.ok(hw>.2,'shop roof exists');
    // curved front: distinct facet normals and a front line that bulges toward the street
    const fr=trisWhere(g,(t,p,hex,n)=>Math.abs(n.y)<1e-6&&n.z>.3);
    const normals=distinct(fr.map(t=>{const n=triNormal(g,t);return [n.x,n.z];}),1e-3);
    assert.ok(normals.length>=4,'curved front facets '+normals.length);
    const zs=fr.flatMap(t=>triPts(g,t).map(p=>p[2]));
    assert.ok(Math.max(...zs)-Math.min(...zs)>=.04*r.d,'front bulges by at least 4% of the block depth');
    // the parapet hides the roof from the street: an eye at the parapet's own top height meets the parapet before the roof
    const eye=at(r,.30,1.5,hw+.04),target=at(r,.30,.55,hw),hit=cast(r,eye,target.clone().sub(eye),eye.distanceTo(target))[0];
    assert.ok(hit&&hit.arena===2,'parapet hides the roof from the street (first hit arena '+hit?.arena+')');
    // end bays are fully glazed shop fronts, the rest ribbon windows
    const styles=windowStyles(r);
    assert.ok(styles.includes(WIN_STYLE.shop)&&styles.includes(WIN_STYLE.ribbon),'shop fronts at the ends, ribbon windows between');
    // cut-through passage on parcels of four cells or more
    const mid=at(r,.5,.6,hw*.5),left=cast(r,mid,new THREE.Vector3(-1,0,0),1)[0],right=cast(r,mid,new THREE.Vector3(1,0,0),1)[0];
    if(r.w*r.d>=4) {
      assert.ok(clear(r,[.5,1.3,hw*.5],[.5,-.3,hw*.5]),'passage lets a ray through the whole depth');
      assert.ok(left&&right&&right.point.x-left.point.x>=.06,'passage is at least .06 wide');
    } else assert.ok(!clear(r,[.5,1.3,hw*.5],[.5,-.3,hw*.5]),'small parcels keep the row unbroken');
    return {forms:['curved-front','hidden-roof'],landmark:false,expect:/parapet hides the roof/,mutate(m){const g2=m.G[2];for(let i=1;i<g2.pos.length;i+=3)if(g2.pos[i]>m.y0+hw+.02)g2.pos[i]=m.y0+hw;release(m);},
      extra:[{expect:/passage lets a ray through/,mutate(m){infill(m,1,[.44,.56,.25,1.0,0,hw]);}}]};
  },
  greatStore(r) {
    const g0=r.G[0],g1=r.G[1],hw=topAt(r,.30,.50,[1]),big=r.w*r.d>=12;
    // two window types: shop fronts in the lower storeys, small grid windows above
    const lower=trisWhere(g0,(t,p)=>Math.max(...p.map(q=>q[1]))<=r.y0+.35*hw&&g0.wst[t*3]>0),upper=trisWhere(g0,(t,p)=>Math.min(...p.map(q=>q[1]))>=r.y0+.33*hw&&g0.wst[t*3]>0);
    assert.ok(lower.length>0&&lower.every(t=>g0.wst[t*3]===WIN_STYLE.shop),'lower storeys carry shop windows');
    assert.ok(upper.length>0&&upper.every(t=>g0.wst[t*3]===WIN_STYLE.grid),'upper storeys carry grid windows');
    // mansard pavilions: steep copper pyramids, two on the front corners (four on large parcels), standing on the roof
    const copper=pyramids(g1,t=>steep(g1,t)&&hexOf(g1,t)==='5f9d86');
    assert.equal(copper.length,big?4:2,'corner pavilions');
    for(const pv of copper) {
      assert.equal(pv.tris.length,4,'four-faced mansard');
      assert.ok(pv.apex[1]-r.y0-(hw+.035)>=.05,'pavilion roof rises above the parapet');
      const walls=trisWhere(g0,(t,p)=>Math.min(...p.map(q=>q[1]))>=r.y0+hw-1e-5&&Math.hypot(mean(p.map(q=>q[0]))-pv.apex[0],mean(p.map(q=>q[2]))-pv.apex[2])<.3);
      assert.ok(walls.length>=8,'pavilion has its own walls ('+walls.length+' triangles)');
      rests(r,'pavilion',0,walls);
    }
    // central dome (parcels of four cells or more): an eight-faced cone above the parapet
    const dome=pyramids(g1,t=>steep(g1,t)&&hexOf(g1,t)==='6aa68f');
    if(r.w*r.d>=4){assert.equal(dome.length,1,'central dome');assert.equal(dome[0].tris.length,8,'eight-faced dome');assert.ok(dome[0].apex[1]-r.y0-(hw+.035)>=.05,'dome above the parapet');}
    else assert.equal(dome.length,0,'no dome on the smallest parcels');
    assert.ok(topAt(r,.5,.944,[2])-hw>=.03,'balustrade band');
    const ped=cast(r,at(r,.5,1.3,hw+.035+.03),new THREE.Vector3(0,0,-1),3)[0];
    assert.ok(ped&&ped.arena===2&&triNormal(r.G[2],ped.faceIndex).z>.9,'pediment faces the street');
    return {forms:['mansard-pavilion','dome'],landmark:true,expect:/floating pavilion/,mutate(m){const walls=trisWhere(m.G[0],(t,p)=>Math.min(...p.map(q=>q[1]))>=m.y0+hw-1e-5&&p[0][0]<m.x0+.3*m.w);lift(m,0,walls,.12);}};
  },
  slabDrum(r) {
    const hs=topAt(r,.30,.70,[1]),ht=topAt(r,.82,.42,[1]);
    assert.ok(hs>.3&&ht>=1.8*hs,`drum ${ht.toFixed(3)} at least 1.8 x slab ${hs.toFixed(3)}`);
    const ring=distinct(verts(r.G[1],p=>Math.abs(p[1]-(r.y0+ht))<1e-5),1e-5),seg=ring.length;
    assert.ok(seg>=(r.w*r.d>3?12:8),'drum sides '+seg);
    assert.ok(uOf(r,mean(ring.map(p=>p[0])))>=.8,'drum stands at the end of the long axis (within 20%)');
    // tapering piers under the slab: clusters of dress vertices, base ring wider than the top ring
    const dv=verts(r.G[2],()=>true),piers=[];
    for(const p of dv){const hit=piers.find(c=>Math.hypot(c.x-p[0],c.z-p[2])<.15);if(hit)hit.pts.push(p);else piers.push({x:p[0],z:p[2],pts:[p]});}
    assert.ok(piers.length>=(r.w*r.d<=3?4:6),'piers '+piers.length);
    for(const c of piers) {
      const lo=Math.min(...c.pts.map(p=>p[1])),hi=Math.max(...c.pts.map(p=>p[1])),cx=mean(c.pts.map(p=>p[0])),cz=mean(c.pts.map(p=>p[2]));
      const rad=y=>Math.max(...c.pts.filter(p=>Math.abs(p[1]-y)<1e-9).map(p=>Math.hypot(p[0]-cx,p[2]-cz)));
      assert.ok(rad(lo)>rad(hi)+.005,'pier is wider at its foot than at its head');
    }
    assert.ok(clear(r,[0,.70,.06],[.70,.70,.06]),'space under the raised slab is open');
    return {forms:['slab-on-pilotis','drum'],landmark:true,expect:/space under the raised slab is open/,mutate(m){infill(m,1,[.2,.5,.6,.8,0,.12]);}};
  },
  gothicHotel(r) {
    const g0=r.G[0],g1=r.G[1],g2=r.G[2];
    // steep roof: rise over the horizontal run of the front slope, measured on the main roof triangles (slate colour)
    const roof=trisWhere(g1,(t,p,hex)=>hex==='5d6a73'),rp=roof.flatMap(t=>triPts(g1,t));
    assert.equal(roof.length,4,'two roof planes');
    const eave=Math.min(...rp.map(p=>p[1])),ridge=Math.max(...rp.map(p=>p[1])),zEave=Math.max(...rp.map(p=>p[2])),zRidge=rp.find(p=>Math.abs(p[1]-ridge)<1e-9)[2];
    assert.ok((ridge-eave)/(zEave-zRidge)>=.5-1e-3,'roof rise over half depth '+((ridge-eave)/(zEave-zRidge)).toFixed(3));
    const roofAt=z=>eave+(ridge-eave)*(zEave-z)/(zEave-zRidge);
    // dormers: pale gable fronts that face the street, each standing on the slope
    const fronts=trisWhere(g2,(t,p,hex,n)=>n.z>.99&&Math.min(...p.map(q=>q[1]))>eave-1e-5);
    assert.ok(fronts.length>=[4,5,7][lodOf(r)],`dormers ${fronts.length}`);
    for(const t of fronts){const p=triPts(g2,t),base=Math.min(...p.map(q=>q[1])),z=p[0][2];assert.ok(Math.abs(base-roofAt(z))<=.02,'dormer stands on the slope (base '+(base-r.y0).toFixed(3)+' vs roof '+(roofAt(z)-r.y0).toFixed(3)+')');}
    // two flanking towers with pointed spires, each spire carried by its own walls
    const spires=pyramids(g1,t=>steep(g1,t)&&hexOf(g1,t)==='4a5560');
    assert.equal(spires.length,2,'two spires');
    for(const sp of spires){assert.equal(sp.tris.length,4,'four-faced spire');assert.ok(sp.apex[1]-ridge>=.1,'spire apex stands above the ridge');capsWalls(r,'spire',1,sp.tris);}
    // brick walls with a pale stone band, arched windows
    const band=cast(r,at(r,.5,.80,3),down,6,[2])[0];
    assert.ok(band,'stone string course exists');
    assert.ok(dE(hexNum(wallColour(r)),hexNum(hexOf(g2,band.faceIndex)))>=15,'stone band reads against the brick');
    assert.ok(windowStyles(r).includes(WIN_STYLE.arch),'arched windows');
    return {forms:['steep-gable','dormers','spires'],landmark:true,expect:/floating spire/,mutate(m){for(const sp of pyramids(m.G[1],t=>steep(m.G[1],t)&&hexOf(m.G[1],t)==='4a5560'))lift(m,1,sp.tris,.12);}};
  },
  pilotisTower(r) {
    const g0=r.G[0],top=Math.max(...verts(g0,()=>true).map(p=>p[1])),tower=trisWhere(g0,(t,p)=>Math.max(...p.map(q=>q[1]))>=top-1e-9);
    const plan=distinct(tower.flatMap(t=>triPts(g0,t).map(p=>[p[0],p[2]])),1e-6);
    assert.equal(plan.length,8,'tower plan is an octagon');
    assert.equal(distinct(tower.map(t=>{const n=triNormal(g0,t);return [n.x,n.z];}),1e-4).length,8,'eight faces');
    const cx=mean(plan.map(p=>p[0])),cz=mean(plan.map(p=>p[1])),ang=plan.map(p=>Math.atan2(p[1]-cz,p[0]-cx)),order=plan.map((p,i)=>i).sort((a,b)=>ang[a]-ang[b]);
    for(let i=0;i<8;i++){const a=plan[order[i]],b=plan[order[(i+1)%8]],c=plan[order[(i+2)%8]];assert.ok((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])>0,'plan is convex at every corner');}
    const xs=plan.map(p=>p[0]),zs=plan.map(p=>p[1]),aspect=(Math.max(...xs)-Math.min(...xs))/(Math.max(...zs)-Math.min(...zs));
    assert.ok(aspect>=1.25,'tower plan aspect '+aspect.toFixed(3));
    const lift_=Math.min(...tower.flatMap(t=>triPts(g0,t).map(p=>p[1])))-r.y0;
    assert.ok(lift_>=.1,'tower is raised on piers');
    // piers: clusters of dress vertices, all under the tower; rays pass under it
    const piers=[];for(const p of verts(r.G[2],()=>true)){const c=piers.find(q=>Math.hypot(q.x-p[0],q.z-p[2])<.1);if(c)c.n++;else piers.push({x:p[0],z:p[2],n:1});}
    assert.ok(piers.length>=(r.w*r.d<=2?4:8),'piers '+piers.length);
    assert.ok(clear(r,[.25,.5,lift_/2],[1.0,.5,lift_/2]),'rays pass under the tower between its piers');
    // the low block beside it stays under 40% of the tower
    const block=topAt(r,.10,.50,[1]);
    assert.ok(block>.2&&block<=.4*(top-r.y0),`low block ${block.toFixed(3)} within 40% of the tower ${(top-r.y0).toFixed(3)}`);
    assert.ok(windowStyles(r).includes(WIN_STYLE.grid)&&windowStyles(r).includes(WIN_STYLE.ribbon),'faces alternate grid and ribbon windows');
    return {forms:['convex-tower'],landmark:true,expect:/rays pass under the tower/,mutate(m){infill(m,2,[.45,.7,.35,.65,0,lift_]);}};
  },
  steppedOffice(r) {
    const g1=r.G[1],levels=new Map();
    for(let t=0;t<g1.owners.length;t++){const n=triNormal(g1,t);if(n.y<.99)continue;const ps=triPts(g1,t),key=(ps[0][1]-r.y0).toFixed(5),e=levels.get(key)??{y:ps[0][1]-r.y0,x0:1e9,x1:-1e9,z0:1e9,z1:-1e9};for(const p of ps){e.x0=Math.min(e.x0,p[0]);e.x1=Math.max(e.x1,p[0]);e.z0=Math.min(e.z0,p[2]);e.z1=Math.max(e.z1,p[2]);}levels.set(key,e);}
    const tiers=[...levels.values()].sort((a,b)=>a.y-b.y),area=e=>(e.x1-e.x0)*(e.z1-e.z0);
    assert.ok(tiers.length>=4,'three set-back tiers and the clock-tower cap are separate levels ('+tiers.length+')');
    for(let i=1;i<4;i++)assert.ok(area(tiers[i])<=.9*area(tiers[i-1]),`tier ${i} footprint is at least 10% smaller than tier ${i-1}`);
    const towerWalls=trisWhere(r.G[0],(t,p)=>Math.min(...p.map(q=>q[1]))>=r.y0+tiers[2].y-1e-5);
    rests(r,'clock tower',0,towerWalls);
    const towerCap=tiers[3],topY=Math.max(...verts(r.G[0],()=>true).concat(verts(g1,()=>true),verts(r.G[2],()=>true)).map(p=>p[1]))-r.y0;
    assert.ok(Math.abs(topY-towerCap.y)<1e-9&&tiers.length===4,'the clock tower is the highest point');
    assert.ok(Math.abs(uOf(r,(towerCap.x0+towerCap.x1)/2)-.5)<=.06,'clock tower stands on the centre line');
    // clock faces: dial-coloured decals on two different sides
    const dial=trisWhere(r.G[2],(t,p,hex)=>hex==='efe7c8');
    assert.ok(distinct(dial.map(t=>{const n=triNormal(r.G[2],t);return [n.x,n.z];}),1e-3).length>=2,'clock faces on at least two sides');
    // ground-floor arcade
    const door=trisWhere(r.G[2],(t,p,hex)=>hex==='34302b');
    assert.ok(door.length/2>=5,'arcade openings '+door.length/2);
    return {forms:['setback-tiers','clock-tower'],landmark:true,expect:/floating clock tower/,mutate(m){lift(m,0,trisWhere(m.G[0],(t,p)=>Math.min(...p.map(q=>q[1]))>=m.y0+tiers[2].y-1e-5),.12);}};
  },
  gridCourt(r) {
    const hN=topAt(r,.5,.16,[1]),hS=topAt(r,.5,.84,[1]),hW=topAt(r,.14,.5,[1]),hE=topAt(r,.86,.5,[1]);
    assert.ok(hS/hN>=.6&&hS/hN<=.733,'south block ratio '+(hS/hN).toFixed(3));
    assert.ok(hW/hN>=.45&&hW/hN<=.55&&Math.abs(hE-hW)<1e-6,'flank blocks are the lowest and equal');
    assert.equal(cast(r,at(r,.5,.5,10),down,20).length,0,'the courtyard stays open to the ground');
    const across=(a,b)=>cast(r,at(r,...a),at(r,...b).sub(at(r,...a)),at(r,...a).distanceTo(at(r,...b)),[0]).length;
    assert.equal(across([.5,-.2,hN*.2],[.5,1.2,hN*.2]),4,'two separate masses along the depth (north and south)');
    assert.equal(across([-.2,.5,hN*.2],[1.2,.5,hN*.2]),4,'two separate masses across the width (west and east)');
    // each block carries a free-standing beam with daylight under it
    for(const [u0,u1,vc,h] of [[.14,.86,.16,hN],[.14,.86,.84,hS],[.04,.24,.5,hW],[.76,.96,.5,hE]]) {
      assert.ok(topAt(r,(u0+u1)/2,vc,[2])-h>=.05,'beam stands above the roof');
      assert.ok(clear(r,[u0-.03,vc,h+.0125],[u1+.03,vc,h+.0125]),'daylight between roof and beam');
    }
    return {forms:['floating-beams'],landmark:false,expect:/courtyard stays open/,mutate(m){infill(m,1,[.4,.6,.4,.6,0,.3]);}};
  },
  domedTower(r) {
    const g0=r.G[0],g1=r.G[1],g2=r.G[2],area=r.w*r.d,L=area>=12?2:area>2?1:0;
    // receding stages: base block, recessed colonnaded storey, and on large parcels an attic stage
    const l1=topAt(r,.09,.55,[1]),l2=topAt(r,.20,.55,[1]),l3=L>1?topAt(r,.35,.55,[1]):l2;
    assert.ok(l1>.5&&l2>l1+.1&&(L<2||l3>l2+.05),`stages rise ${l1.toFixed(3)} ${l2.toFixed(3)} ${l3.toFixed(3)}`);
    // colonnade: closed three-sided posts in front of the recess, open spaces between them
    const colY=r.y0+(l1+l2)/2,line=cast(r,new THREE.Vector3(r.x0-.5,colY,r.z0+.845*r.d),new THREE.Vector3(1,0,0),r.w+1,[2]);
    assert.equal(line.length%2,0,'posts are closed solids');
    const cols=line.length/2;
    assert.ok(cols>=[3,4,8][L],`colonnade posts ${cols} at lod ${L}`);
    const gapU=.17+.66/(2*(cols-1)),gap=cast(r,at(r,gapU,1.3,(l1+l2)/2),new THREE.Vector3(0,0,-1),3)[0];
    assert.ok(gap&&gap.arena===0&&Math.abs(gap.point.z-(r.z0+.82*r.d))<1e-4,'a ray between two posts reaches the recess wall');
    // domes: the central one and the two corner towers' domes (eight faces from the medium lod up), all resting on their own walls
    const domes=pyramids(g1,t=>steep(g1,t)&&hexOf(g1,t)==='6aa68f');
    assert.equal(domes.length,3,'central dome and two corner domes');
    const central=domes.reduce((a,b)=>Math.abs(uOf(r,a.apex[0])-.5)<Math.abs(uOf(r,b.apex[0])-.5)?a:b),corners=domes.filter(d=>d!==central);
    for(const c of corners){assert.ok(c.tris.length>=(L>0?8:4),`corner dome faces ${c.tris.length} at lod ${L}`);capsWalls(r,'corner dome',1,c.tris);}
    assert.ok(central.tris.length>=(L>0?8:6),'central dome faces '+central.tris.length);
    rests(r,'central dome',1,central.tris);
    const topY=Math.max(...[g0,g1,g2].flatMap(g=>verts(g,()=>true)).map(p=>p[1]));
    assert.ok(Math.abs(topY-central.apex[1])<1e-9&&Math.abs(uOf(r,central.apex[0])-.5)<=.06,'the central dome is the highest point');
    assert.ok(windowStyles(r).includes(WIN_STYLE.arch)&&windowStyles(r).includes(WIN_STYLE.punch),'arched windows below, punched windows above');
    return {forms:['recessed-colonnade','domes'],landmark:true,expect:/floating corner dome/,mutate(m){for(const d of pyramids(m.G[1],t=>steep(m.G[1],t)&&hexOf(m.G[1],t)==='6aa68f').filter(q=>Math.abs(uOf(m,q.apex[0])-.5)>.2))lift(m,1,d.tris,.12);},
      extra:[{expect:/a ray between two posts reaches the recess wall/,mutate(m){infill(m,1,[.1,.9,.835,.855,l1,l2]);}}]};
  },
  telecomTower(r) {
    const g0=r.G[0],small=r.w*r.d<=3,hr=topAt(r,.5,.5,[1]);
    const cap=verts(r.G[1],p=>Math.abs(p[1]-(r.y0+hr))<1e-5),cx=mean(cap.map(p=>p[0])),cz=mean(cap.map(p=>p[2])),ringR=Math.max(...cap.map(p=>Math.hypot(p[0]-cx,p[2]-cz)));
    const radial=p=>Math.hypot(p[0]-cx,p[2]-cz);
    const shaft=trisWhere(g0,(t,p)=>p.every(q=>radial(q)<ringR*.85)&&Math.max(...p.map(q=>q[1]))<r.y0+hr-1e-5),sp=shaft.flatMap(t=>triPts(g0,t));
    const shaftR=Math.max(...sp.map(radial)),hb=Math.max(...sp.map(p=>p[1]))-r.y0;
    assert.equal(distinct(shaft.map(t=>{const n=triNormal(g0,t);return [n.x,n.z];}),1e-4).length,small?8:12,'shaft sides');
    assert.ok(hb/(2*shaftR)>=(r.w*r.d===1?6:4),'shaft slenderness '+(hb/(2*shaftR)).toFixed(2));
    assert.ok(ringR>=1.25*shaftR,'ring is at least 1.25 x the shaft width ('+(ringR/shaftR).toFixed(2)+')');
    const mast=trisWhere(r.G[2],(t,p)=>radial(p[0])<.05&&Math.min(...p.map(q=>q[1]))>=r.y0+hr-1e-5),mp=mast.flatMap(t=>triPts(r.G[2],t)),total=Math.max(...mp.map(p=>p[1]))-r.y0;
    assert.ok(hb>=.7*total,'ring sits in the top 30% of the height');
    assert.ok(total-hr>=.08*total,'mast rises at least 8% of the total height above the ring');
    rests(r,'mast',2,mast);
    const plant=trisWhere(g0,(t,p)=>p.some(q=>radial(q)>ringR*1.2)&&Math.max(...p.map(q=>q[1]))<r.y0+hb*.2);
    if(small)assert.equal(plant.length,0,'no plant base on the smallest parcels');else assert.ok(plant.length>=8,'wider plant base ('+plant.length+' triangles)');
    return {forms:['cylinder-ring','mast'],landmark:true,expect:/floating mast/,mutate(m){const q=trisWhere(m.G[2],(t,p)=>Math.hypot(p[0][0]-cx,p[0][2]-cz)<.05&&Math.min(...p.map(z=>z[1]))>=m.y0+hr-1e-5);lift(m,2,q,.12);}};
  },
  bridgedCourt(r) {
    for(const [u,v] of [[.46,.40],[.54,.40],[.46,.60],[.54,.60]])assert.equal(cast(r,at(r,u,v,10),down,20).length,0,`courtyard stays open at ${u},${v}`);
    // two iron bridges across the courtyard, wall to wall, at different heights
    const dec=cast(r,at(r,.5,.5,10),down,20).filter(h=>h.arena===2&&hexOf(r.G[2],h.faceIndex)==='7d868d').filter((h,i,all)=>i===0||h.point.y<all[i-1].point.y-1e-6);   // a ray down the diagonal of a quad hits both of its triangles at once
    assert.ok(dec.length>=2&&Math.abs(dec[0].point.y-dec[1].point.y)>.1,'two iron bridges at different heights ('+dec.length+')');
    for(const h of dec){
      const y=h.point.y-.01,left=cast(r,new THREE.Vector3(r.x0+.5*r.w,y,r.z0+.5*r.d),new THREE.Vector3(-1,0,0),r.w,[0,1,2]),right=cast(r,new THREE.Vector3(r.x0+.5*r.w,y,r.z0+.5*r.d),new THREE.Vector3(1,0,0),r.w,[0,1,2]);
      assert.ok(left[0]&&right[0]&&left[0].arena===0&&right[0].arena===0,'the bridge reaches the walls on both sides');
    }
    // spiral stair: a capped newel post and at least two treads
    const newel=cast(r,at(r,.43,.32,10),down,20)[0];
    assert.ok(newel&&newel.arena===2&&hexOf(r.G[2],newel.faceIndex)==='4b5158'&&newel.point.y-r.y0>=.5,'capped newel post');
    const treads=distinct(trisWhere(r.G[2],(t,p,hex)=>hex==='7d868d'&&Math.hypot(mean(p.map(q=>q[0]))-(r.x0+.43*r.w),mean(p.map(q=>q[2]))-(r.z0+.32*r.d))<.1).map(t=>[mean(triPts(r.G[2],t).map(q=>q[1]))]),.02);
    assert.ok(treads.length>=2,'stair treads at distinct heights '+treads.length);
    // heavy cornice projecting from the wing walls; the front range is lower so the courtyard shows from the street
    const wallFront=Math.max(...verts(r.G[0],()=>true).map(p=>p[2])),strips=trisWhere(r.G[2],(t,p,hex,n)=>n.z>.99&&Math.min(...p.map(q=>q[1]))>r.y0+.5);
    assert.ok(strips.length>0&&Math.max(...strips.flatMap(t=>triPts(r.G[2],t).map(p=>p[2])))-wallFront>=.015,'cornice projects at least .015 from the wall');
    assert.ok(topAt(r,.5,.86,[1])<topAt(r,.2,.5,[1])-.2,'front range is lower than the wings');
    return {forms:['iron-bridges','spiral-stair'],landmark:false,expect:/courtyard stays open/,mutate(m){infill(m,1,[.42,.58,.36,.64,0,.3]);},
      extra:[{expect:/two iron bridges at different heights/,mutate(m){const g=m.G[2];for(let t=0;t<g.owners.length;t++){const ps=triPts(g,t);if(hexOf(g,t)==='7d868d'&&Math.abs(mean(ps.map(q=>q[0]))-(m.x0+.5*m.w))<.15*m.w&&Math.abs(mean(ps.map(q=>q[2]))-(m.z0+.5*m.d))<.1)for(let j=0;j<3;j++)g.pos[t*9+j*3+1]=m.y0-5;}release(m);}}]};
  },
};

function commercePicks(built,city,blocks) {
  const targets=new Map(),tested=new Map();
  blocks.plan.forEach((b,bi)=>{if(commerceBlock(blocks.recipe(b)))targets.set(-bi-1,{block:bi});});
  const owners=built.pickOwners();
  for(const [arena,mesh] of built.buildingMeshes().entries()) {
    const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    for(let t=0;t<owners[arena].length;t++) {
      const owner=owners[arena][t],want=targets.get(owner);
      if(!want||(tested.get(owner)??0)>=6)continue;
      const i=t*3,a=new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));
      const b=new THREE.Vector3(p.getX(i+1),p.getY(i+1),p.getZ(i+1));
      const c=new THREE.Vector3(p.getX(i+2),p.getY(i+2),p.getZ(i+2));
      if(b.clone().sub(a).cross(c.clone().sub(a)).length()<1e-10)continue;
      const normal=new THREE.Vector3(n.getX(i),n.getY(i),n.getZ(i));
      const center=a.add(b).add(c).multiplyScalar(1/3);
      const hit=built.pick(new THREE.Raycaster(center.addScaledVector(normal,.002),normal.clone().negate(),0,.004));
      assert.ok(hit&&hit.id>0,'actual commercial triangle is pickable, owner '+owner);
      assert.equal(hit.block,want.block,'D063 commercial block triangle owner');
      assert.equal(hit.id,city.occ[hit.z*city.n+hit.x],'D063 commercial geometry maps back to the saved occupied tile');
      tested.set(owner,(tested.get(owner)??0)+1);
    }
  }
  for(const owner of targets.keys())assert.ok((tested.get(owner)??0)>0,'selected commercial owner was rendered and ray-tested '+owner);
  return [...tested.values()].reduce((a,b)=>a+b,0);
}
const hsl=hex=>{const c=new THREE.Color('#'+hex),o={};c.getHSL(o,THREE.SRGBColorSpace);return o;};

export async function d063Guards(log) {
  let failed=0;
  const test=(name,fn)=>{try{fn();log(true,'D063 '+name);}catch(e){failed++;log(false,'D063 '+name,e.stack??String(e));}};

  test('eleven existing core archetypes select exactly eleven models; every other kind, level, path and table is untouched',()=>{
    const expected={'1:market':'marketHall','1:modernShop':'shopParade','2:dept':'greatStore','2:modernOffice':'slabDrum','2:stoneHotel':'gothicHotel','3:podTower':'pilotisTower','3:setback':'steppedOffice','3:slabC':'gridCourt','3:stoneTower':'domedTower','3:modernNeedle':'telecomTower','3:courtC':'bridgedCourt'};
    const frozen=JSON.stringify(ARCHE),found=new Set(),outside=new Set();
    for(const lv of [1,2,3])for(let v=0;v<24;v++)for(const [w,h] of SIZES) {
      const r=recipe(ARCHE,2,lv,w,h,v),model=commerceBlock(r);
      if(r.path==='core'&&expected[lv+':'+r.arche]) {
        assert.equal(model,expected[lv+':'+r.arche],`2_${lv} v${v} ${r.arche} render-only selector`);
        found.add(model);
      } else {
        assert.equal(model,null,`2_${lv} v${v} ${r.arche}/${r.path} is outside this wave`);
        outside.add(`${lv}:${r.arche}:${r.path}`);
      }
    }
    assert.deepEqual([...found].sort(),[...COMMERCE_MODELS].sort());
    assert.equal(found.size,11);
    assert.ok(outside.has('1:townShop:core')&&outside.has('2:hotel:ukHighStreet')&&outside.has('2:office:usMainStreet'),'townShop, hotel and office stay with the old art');
    for(const k of [1,3])for(let lv=1;lv<=3;lv++)for(let v=0;v<24;v++)assert.equal(commerceBlock(recipe(ARCHE,k,lv,2,2,v)),null,'residential and industrial recipes never select commerce');
    assert.deepEqual(Object.values(ARCH_OF).sort(),[...CORE].sort(),'baseline tool and guard agree on the eleven core archetypes');
    assert.equal(JSON.stringify(ARCHE),frozen,'archetype data remains exact');
  });

  test('eleven deterministic geometries: finite attributes, parcel, height, owner, per-size weighted cap and floor at 16 sizes, every recipe variant and palette',()=>{
    const hashes=new Set();let cells=0,worst=Infinity;
    for(const model of COMMERCE_MODELS) {
      hashes.add(sha(drawCommerceCase(model).G.map(g=>g.pos)));
      for(const [w,d] of SIZES) {
        const vs=variantsOf(model,w,d);
        assert.ok(vs.length>=1,`${model} ${w}x${d} has a recipe variant`);
        for(const v of vs){const cost=validGeometry(drawCommerceCase(model,{w,d,v}));worst=Math.min(worst,capOf(model,w,d)-cost);cells++;}
        for(const pal of PALS) {
          const r=drawCommerceCase(model,{w,d,pal});validGeometry(r);
          const again=drawCommerceCase(model,{w,d,pal});
          assert.deepEqual(again.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.owners,g.tags,g.wst,g.wgl,g.wbd]),r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.owners,g.tags,g.wst,g.wgl,g.wbd]),`${model} ${w}x${d} deterministic actual geometry`);
        }
      }
    }
    assert.equal(hashes.size,11,'eleven structural geometries, not palette-only alternatives');
    assert.ok(cells>=11*16,'every one of the 176 model x size cells was measured ('+cells+' block builds)');
    assert.ok(worst>=0,'worst-case spare under the per-size cap: '+worst);
  });

  test('independent invisible-owner, NaN, parcel, height, normal, collapsed-triangle and budget mutations are rejected',()=>{
    for(const mutate of [
      r=>r.G[0].owners[0]=0,
      r=>r.G[0].pos[0]=NaN,
      r=>r.G[0].col[0]=NaN,
      r=>r.G[0].pos[0]=r.x0-1,
      r=>r.G[0].pos[1]=r.y0+CEIL[r.model]+1,
      r=>r.G[0].nor[0]=9,
      r=>r.G[0].pos.splice(3,3,...r.G[0].pos.slice(0,3)),
      r=>{for(let i=0;i<30;i++)r.G[2].box(r.x0,r.z0,r.x0+.1,r.z0+.1,r.y0,r.y0+.1,new THREE.Color('#fff'),new THREE.Color('#fff'),null);},
    ]) {const r=drawCommerceCase('gridCourt');mutate(r);assert.throws(()=>validGeometry(r));}
  });

  test('no open container is visible from camera-like directions at any model, size or recipe variant, and an opened box is detected',()=>{
    for(const model of COMMERCE_MODELS)for(const [w,d] of SIZES) {
      const r=drawCommerceCase(model,{w,d,pal:(w*3+d)%6}),o=openContainers(r);
      assert.equal(o.bad,0,`${model} ${w}x${d} has an open container (first back faces at ${JSON.stringify(o.sample)})`);
      release(r);
    }
    // Negative control: take the roof cap off one wing of the bridged court.
    const r=drawCommerceCase('bridgedCourt'),g=r.G[1],keep=[];
    for(let t=0;t<g.owners.length;t++){const ys=[1,4,7].map(o=>g.pos[t*9+o]),flat=Math.max(...ys)-Math.min(...ys)<1e-9&&g.nor[t*9+1]>.99;
      const inWing=[0,1,2].every(j=>g.pos[t*9+j*3]<=r.x0+.351*r.w&&g.pos[t*9+j*3]>=r.x0+.049*r.w);
      if(flat&&inWing&&Math.abs(ys[0]-(r.y0+r.wall))<5)continue;keep.push(t);}
    assert.ok(g.owners.length-keep.length>=2,'the opened wing lost its cap');
    const out=new Geo();out.owner=r.owner;
    for(const t of keep){out.pos.push(...g.pos.slice(t*9,t*9+9));out.nor.push(...g.nor.slice(t*9,t*9+9));out.col.push(...g.col.slice(t*9,t*9+9));out.uv.push(...g.uv.slice(t*9,t*9+6));out.owners.push(r.owner);out.tags.push(0);}
    r.G[1]=out;release(r);
    assert.ok(openContainers(r).bad>0,'the opened wing is reported');release(r);
  });

  test('every model proves its defining feature on real geometry at small, medium and large parcels; each probe has a failing negative control',()=>{
    const forms=new Set();let landmarks=0,controls=0;
    for(const model of COMMERCE_MODELS) {
      assert.ok(PROBES[model],model+' has a probe');
      for(const [w,d] of PSIZES) {
        const r=drawCommerceCase(model,{w,d}),proved=PROBES[model](r);
        if(w===2&&d===2){for(const f of proved.forms)forms.add(f);if(proved.landmark)landmarks++;}
        release(r);
        if(w===2&&d===2)for(const control of [proved,...(proved.extra??[])]) {
          assert.ok(control.mutate,model+' has a negative control');
          const broken=drawCommerceCase(model);control.mutate(broken);
          assert.throws(()=>PROBES[model](broken),control.expect??undefined,model+' negative control: a broken feature must fail its probe for the intended reason');
          release(broken);controls++;
        }
      }
    }
    assert.ok(forms.size>=9,'roof and top forms proved: '+[...forms]);
    assert.ok(landmarks>=7,'independent named top components proved: '+landmarks);
    assert.ok(controls>=14,'negative controls that fail for their intended reason: '+controls);
  });


  test('six distinct wall palettes per model; the six tall models give four or more clearly different walls; five window styles, six models mix two or more',()=>{
    const styles=new Set(),mixed=[];
    for(const model of COMMERCE_MODELS) {
      const colours=PALS.map(pal=>wallColour(drawCommerceCase(model,{pal})));
      assert.equal(new Set(colours).size,6,model+' six palettes give six distinct main-wall colours: '+colours);
      if(LEVEL[model]===3) {
        const picked=[];
        for(const c of colours)if(picked.every(q=>dE(hexNum(c),hexNum(q))>=12))picked.push(c);
        assert.ok(picked.length>=4,`${model} has ${picked.length} wall tones at least 12 CIE76 apart (need 4): ${colours}`);
        assert.ok(BASE.vocabulary[`lv3:${ARCH_OF[model]}:core`].wallColors===1,'the old art had a single wall colour here');
      }
      const r=drawCommerceCase(model),st=windowStyles(r);
      for(const x of st)styles.add(x);
      if(st.length>=2)mixed.push(model);
    }
    assert.ok(styles.size>=4,'window styles used: '+[...styles]);
    assert.ok(mixed.length>=6,'models that mix two or more window styles in one building: '+mixed);
    assert.ok(Object.values(BASE.vocabulary).every(v=>v.formCombos.length<=2),'baseline vocabulary is the recorded two form combinations at most');
    void hsl;
  });

  test('production whole-city geometry: three batches, exact A, legacy flag equals the D062 baseline bytes, zero budget growth, class and per-size ceilings',()=>{
    let changedModes=0;
    for(const id of ['seed516','ai120']) {
      const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
      for(const mode of ['a','b','c']) {
        const world=sha(city),base=BASE.cities[id].modes[mode],snapshots={};
        for(const enabled of [false,true]) {
          const blocks={...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:enabled},con=new ConState(city.n);
          const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
          try {
            assert.equal(built.buildingMeshes().length,3,'existing batch count');
            for(const mesh of built.meshStats().filter(m=>['walls','other','dress'].includes(m.name)))assert.equal(mesh.shadow,mesh.name!=='dress','existing shadow flags');
            if(enabled&&mode!=='a'&&id==='seed516')commercePicks(built,city,blocks);
            snapshots[enabled]={measured:measureCommerce(city,blocks),digest:digest(built),meshes:built.meshStats(),sig:signature(built),weighted:weighted(built)};
          } finally {built.dispose();con.dispose();}
        }
        assert.equal(sha(city),world,'art and comparison do not modify the world');
        const off=snapshots[false],on=snapshots[true];
        assert.equal(off.sig,base.signature,`${id} ${mode} commerceArt=false reproduces the D062 baseline scene byte for byte`);
        assert.equal(off.weighted,base.weighted,`${id} ${mode} legacy weighted triangles equal the baseline`);
        assert.equal(off.measured.commerce.weighted,base.commerce.weighted,`${id} ${mode} legacy commercial class equals the baseline`);
        assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
        assert.equal(on.digest.ground,off.digest.ground,'actual ground pixels unchanged');
        assert.deepEqual(on.digest.inst,off.digest.inst,'all existing trees keep exact transforms, colors and ages');
        if(mode==='a'||id==='ai120') {
          assert.equal(on.sig,off.sig,id==='ai120'?'ai120 has no commercial blocks: bytes unchanged':'A mode remains the exact density reference');
          assert.deepEqual(on.meshes,off.meshes,'submissions are unchanged');
        } else {
          assert.ok(on.weighted<=base.weighted,`${id} ${mode} zero growth: ${on.weighted} <= ${base.weighted}`);
          assert.ok(on.weighted<=CITY_CAP[id],`${id} ${mode} existing ceiling ${CITY_CAP[id]}`);
          assert.ok(on.measured.commerce.weighted<=base.commerce.weighted,`${id} ${mode} commercial class ${on.measured.commerce.weighted} <= ${base.commerce.weighted}`);
          const core=m=>Object.entries(m.commerce.byArche).filter(([k])=>k.endsWith(':core')&&CORE.includes(k.split(':')[1])).reduce((n,[,row])=>n+row.weighted,0);
          assert.ok(core(on.measured)<=core(base),`${id} ${mode} eleven core archetypes ${core(on.measured)} <= ${core(base)}`);
          for(const [key,row] of Object.entries(on.measured.commerce.byArche)) {
            const [,arche,pathName]=key.split(':'),model=Object.keys(ARCH_OF).find(m=>ARCH_OF[m]===arche);
            if(pathName!=='core'||!model)continue;
            for(const [size,cell] of Object.entries(row.sizes))assert.ok(cell.max<=BASE.oldCost[arche].sizes[size].cap,`${id} ${mode} ${key} ${size} block ${cell.max} <= per-size cap ${BASE.oldCost[arche].sizes[size].cap}`);
          }
          assert.notEqual(on.sig,off.sig,'selected commercial blocks really use D063 geometry');
          // Everything that is not a selected commercial block keeps its per-owner triangle counts.
          const blocks=d058Blocks(city,mode),selected=new Set();
          blocks.plan.forEach((b,bi)=>{if(commerceBlock(blocks.recipe(b)))selected.add(String(-bi-1));});
          for(const name of ['walls','other','dress']) {
            const a=off.digest.meshes[name][1],b=on.digest.meshes[name][1];
            for(const owner of new Set([...Object.keys(a),...Object.keys(b)]))if(!selected.has(owner))assert.equal(b[owner],a[owner],`${name} owner ${owner} unchanged`);
          }
          changedModes++;
        }
      }
    }
    assert.equal(changedModes,2,'B and C of the one decoded production city that has commercial core blocks exercise the new dispatch');
  });

  test('D063 mode changes invalidate cached production geometry and agree with fresh scene builds',()=>{
    const city=d058City(fs.readFileSync(path.join(ROOT,'src/content/samples/seed516.code.txt'),'utf8'));
    const world=sha(city),con=new ConState(city.n);let previous;
    try {
      for(const enabled of [false,true,false,true]) {
        const blocks={...d058Blocks(city),villageArt:true,industryArt:true,commerceArt:enabled};
        const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con);
        previous?.dispose();previous=built;
        const freshCon=new ConState(city.n),fresh=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,freshCon,true);
        try {assert.deepEqual(digest(built),digest(fresh),'fresh/incremental commerceArt='+enabled);}
        finally {fresh.dispose();freshCon.dispose();}
      }
      assert.equal(sha(city),world,'cache mode changes do not modify the world');
    } finally {previous?.dispose();con.dispose();}
  });

  test('production commerce: every model is present in seed516 B and C, rotated vertices stay inside their own block and ceiling, weather reaches aCon and ConState at actual wall tops, palettes vary, pictures map back to saved tiles',()=>{
    const city=d058City(fs.readFileSync(path.join(ROOT,'src/content/samples/seed516.code.txt'),'utf8')),world=sha(city);
    for(const mode of ['b','c']) {
      const con=new ConState(city.n),blocks={...d058Blocks(city,mode),villageArt:true,industryArt:true,commerceArt:true};
      const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
      try {
        assert.ok(built.con,'production construction metadata exists');
        con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(city,k=>KT.cat(k));
        assert.deepEqual(con.wallTop,built.con.wallTop,'ConState receives the actual generated wall heights');
        const wall=built.buildingMeshes()[0],p=wall.geometry.attributes.position,a=wall.geometry.attributes.aCon,owners=built.pickOwners()[0];
        assert.ok(a&&a.itemSize===3&&a.count===p.count,'real production vertices contain complete aCon attributes');
        const targets=new Map(),count=new Map(),tones=new Map();
        blocks.plan.forEach((b,bi)=>{const r=blocks.recipe(b),model=commerceBlock(r);if(model){assert.equal(r.path,'core');targets.set(-bi-1,{b,model});}});
        assert.equal(new Set([...targets.values()].map(t=>t.model)).size,11,`all eleven models are present in seed516 ${mode}`);
        for(let t=0;t<owners.length;t++) {
          const target=targets.get(owners[t]);if(!target)continue;
          const tag=a.getZ(t*3);if(tag===0)continue;
          count.set(target.model,(count.get(target.model)??0)+1);
          const maxY=Math.max(...[0,1,2].map(j=>p.getY(t*3+j)));
          assert.ok(Math.abs(tag-maxY)<1e-5,'aCon stores the real wall top, not a placeholder');
          for(let j=0;j<3;j++) {
            const x=a.getX(t*3+j),z=a.getY(t*3+j),b=target.b;
            assert.ok(x>=b.x&&x<b.x+b.w&&z>=b.z&&z<b.z+b.h,'rotated weather coordinates stay within their owner parcel');
            const tile=Math.floor(z)*city.n+Math.floor(x),id=city.occ[tile];assert.ok(id>0);
            assert.ok(con.wallTop[tile]>=tag-1e-5,'recorded tile wallTop includes this actual weather wall');
            assert.equal(con.data[tile*4],city.buildings[id-1].age,'shader age is the saved resident building age');
            assert.ok(con.data[tile*4+1]>=tag-1e-5,'shader construction height contains the weather wall');
          }
          const col=wall.geometry.attributes.color,hex=new THREE.Color(col.getX(t*3),col.getY(t*3),col.getZ(t*3)).getHexString(),byOwner=tones.get(owners[t])??new Map();
          byOwner.set(hex,(byOwner.get(hex)??0)+1);tones.set(owners[t],byOwner);
        }
        // the main-wall colour of every block (its most common tagged-wall colour); models with six or more blocks show three or more different walls
        const perModel=new Map(),owned=new Map();
        for(const [owner,byOwner] of tones){const model=targets.get(owner).model,dominant=[...byOwner.entries()].sort((x,y)=>y[1]-x[1])[0][0];(perModel.get(model)??perModel.set(model,new Set()).get(model)).add(dominant);owned.set(model,(owned.get(model)??0)+1);}
        for(const [model,n] of owned)if(n>=6)assert.ok(perModel.get(model).size>=3,`${mode} ${model}: ${n} blocks show only ${perModel.get(model).size} wall colours`);
        for(const model of COMMERCE_MODELS)assert.ok((count.get(model)??0)>0,`${mode} ${model} production weather is connected`);
        assert.ok(built.weatherInfo().core>=[...count.values()].reduce((x,y)=>x+y,0),'current weather statistic counts at least these tagged core triangles');
        commercePicks(built,city,blocks);
        // every vertex of a selected block stays inside that block's rectangle after the street rotation, and the block stays under its model's height ceiling
        const span=new Map(),bodies=built.buildingMeshes(),ownersAll=built.pickOwners();
        for(const [arena,mesh] of bodies.entries()) {
          const pos=mesh.geometry.attributes.position;
          for(let t=0;t<ownersAll[arena].length;t++) {
            const target=targets.get(ownersAll[arena][t]);if(!target)continue;
            const e=span.get(ownersAll[arena][t])??{minY:Infinity,maxY:-Infinity};
            for(let j=0;j<3;j++) {
              const x=pos.getX(t*3+j),y=pos.getY(t*3+j),z=pos.getZ(t*3+j),bk=target.b;
              assert.ok(x>=bk.x-1e-6&&x<=bk.x+bk.w+1e-6&&z>=bk.z-1e-6&&z<=bk.z+bk.h+1e-6,`${target.model} vertex stays inside its own rotated block`);
              e.minY=Math.min(e.minY,y);e.maxY=Math.max(e.maxY,y);
            }
            span.set(ownersAll[arena][t],e);
          }
        }
        assert.equal(span.size,targets.size,'every selected block has geometry');
        for(const [owner,e] of span)assert.ok(e.maxY-e.minY<=CEIL[targets.get(owner).model]+1e-6,`${targets.get(owner).model} block height ${(e.maxY-e.minY).toFixed(3)} within its ceiling ${CEIL[targets.get(owner).model]}`);
        const freshCon=new ConState(city.n),fresh=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,freshCon,true);
        try {assert.deepEqual(digest(built),digest(fresh),'weather metadata agrees with a fresh production build');}
        finally {fresh.dispose();freshCon.dispose();}
        assert.equal(sha(city),world,'weather rendering preserves all city state');
      } finally {built.dispose();con.dispose();}
    }
  });

  test('older legacy flags switch D063 off with them; window atlas, scene accumulator, old block art, recipes and archetype data are byte-identical to the baseline',()=>{
    const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8');
    assert.match(view,/commerceArt: !\['commerceArt', 'industryArt', 'villageArt', 'streetArt', 'britishArt', 'heritageArt'\]\.some\(key => q\.get\(key\) === 'legacy'\)/,'every older legacy flag disables D063');
    assert.match(view,/industryArt: !\['industryArt', 'villageArt', 'streetArt', 'britishArt', 'heritageArt'\]\.some\(key => q\.get\(key\) === 'legacy'\)/,'D060 flag chain is unchanged');
    assert.match(view,/villageArt: !\['villageArt', 'streetArt', 'britishArt', 'heritageArt'\]\.some\(key => q\.get\(key\) === 'legacy'\)/,'D059 flag chain is unchanged');
    const scope=read('fixtures/d063-art-scope.json');
    for(const file of ['src/render/windows.ts','src/render/scene.ts','src/render/blockArt.ts','src/content/recipes.ts','src/content/blocks.ts','src/content/lab-arche.json','src/render/pieces.ts','src/render/post.ts','src/render/britishIndustryArt.ts','src/content/britishIndustry.ts','src/render/britishVillageArt.ts','src/render/landArt.ts','src/render/seasonArt.ts'])
      assert.equal(scope.after[file],scope.before[file],file+' is byte-identical to the baseline');
  });

  test('exact source scope reconstructs D062 and rejects injected mutations before historical reversal',()=>{
    assertD063Scope();
    const manifest=read('fixtures/d063-art-scope.json');
    for(const file of manifest.modified)assert.equal(createHash('sha256').update(d063HistoricalBytes(file)).digest('hex'),manifest.before[file],'historical bytes '+file);
    for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-arche.json','src/content/recipes.ts','src/render/britishIndustryArt.ts','src/render/windows.ts','src/render/scene.ts','src/render/blockArt.ts','src/content/britishCommerce.ts','src/render/britishCommerceArt.ts','src/render/cityScene.ts','src/cityView.ts']) {
      const mutation=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized D063 mutation':'');
      assert.throws(()=>assertD063Scope(mutation),/exact allowed source/,target+' source mutation');
      assert.throws(()=>d063HistoricalBytes(target,mutation),/exact allowed source/,target+' historical-reader mutation');
    }
    // a region marker that is removed or renamed is caught even when every pinned file is otherwise untouched
    const scene=fs.readFileSync(path.join(ROOT,'src/render/cityScene.ts'),'utf8');
    assert.throws(()=>assertD063Scope(file=>file==='src/render/cityScene.ts'?scene.replace('// D063-END commerce-draw','// D063-END commerce-drow'):fs.readFileSync(path.join(ROOT,file),'utf8')),/exact allowed source|matching D063/);
  });

  return failed;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await d063Guards((ok,name,detail)=>console.log(ok?'PASS':'FAIL',name,detail??''))?1:0;

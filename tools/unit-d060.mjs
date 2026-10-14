// D060 tests actual procedural meshes and production scenes, without claiming browser rendering or Android hardware acceptance.
// Probes measure the vertices that were really generated (rays, radii, peaks), never the constants in the art file.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {Geo} from '../src/render/scene.ts';
import {drawBritishIndustry} from '../src/render/britishIndustryArt.ts';
import {industryBlock,INDUSTRY_MODELS} from '../src/content/britishIndustry.ts';
import {recipe,PX_PER_CELL} from '../src/content/recipes.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {measure,signature,weighted} from './d060-baseline.mjs';
import {D060_MODELS,d060ReviewCode,d060FixtureProof} from './d060-scenes.mjs';
import {assertD060Scope,d060HistoricalBytes} from './d060-scope.mjs';

const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ARCHE=read('src/content/lab-arche.json').arche;
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const BASE=read('fixtures/d060-baseline.json');
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
const CAP={goodsShed:100,loftWorkshop:85,northLight:100,timberYard:105,brickFactory:120,cottonMill:120,dockWarehouse:85,boilerHouse:150,engineWorks:220,steamMill:220,gasworks:220,bottleKilns:220};
const FLOOR=40;
const CEIL={goodsShed:.8,loftWorkshop:1,northLight:1.5,timberYard:.6,brickFactory:1.7,cottonMill:1.2,dockWarehouse:.8,boilerHouse:2.2,engineWorks:2.3,steamMill:2.6,gasworks:2.1,bottleKilns:2.0};
const SIZES=[[1,1],[1,2],[2,1],[2,2]];
const PALS=[0,1,2,3,4,5];
const CITY_CAP={seed516:118884,ai120:106365};
const GLASS=new THREE.Color('#6d8ca0');
const weightedOf=G=>2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length;
const digest=b=>{const d=sceneDigest(b);return {meshes:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),ground:d.ground,inst:d.inst,queries:d.queries,counts:d.counts};};

// Non-zero origin and ground level: absolute-vs-local coordinate mistakes cannot hide at (0,0,0).
export function drawIndustryCase(model,{w=2,d=2,pal=0,x0=3.125,z0=7.375,y0=.21,owner=71,weather=true}={}) {
  const [,lv,a]=D060_MODELS.find(m=>m[0]===model),r=recipe(ARCHE,3,lv,w,d,a);
  const G=[new Geo({ext:true}),new Geo(),new Geo()];
  for(const g of G)g.owner=owner;
  const wall=r.wallPx/PX_PER_CELL,ctx={W:G[0],O:G[1],D:G[2],x0,z0,w,d,y0,wall,pal,weather};
  const input=JSON.stringify([x0,z0,w,d,y0,wall,pal,owner,weather]);
  const anchor=drawBritishIndustry(ctx,model);
  assert.equal(JSON.stringify([ctx.x0,ctx.z0,ctx.w,ctx.d,ctx.y0,ctx.wall,ctx.pal,G[0].owner,ctx.weather]),input,'read-only model coordinates, palette and owner');
  return {G,anchor,model,w,d,wall,x0,z0,y0,pal,owner};
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
      assert.ok(g.pos[i]>=r.x0-1e-7&&g.pos[i]<=r.x0+r.w+1e-7,r.model+' parcel x');
      assert.ok(g.pos[i+2]>=r.z0-1e-7&&g.pos[i+2]<=r.z0+r.d+1e-7,r.model+' parcel z');
      assert.ok(g.pos[i+1]>=r.y0-1e-7&&g.pos[i+1]<=r.y0+CEIL[r.model],r.model+' height ceiling '+(g.pos[i+1]-r.y0));
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
  const cost=weightedOf(r.G);
  assert.ok(cost>=FLOOR&&cost<=CAP[r.model],`${r.model} ${r.w}x${r.d} weighted triangles ${cost} outside ${FLOOR}..${CAP[r.model]}`);
  assert.ok(top>r.y0+r.wall+.02,r.model+' recognizable silhouette above the recipe wall');
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
const topAt=(r,u,v,arenas)=>{const h=cast(r,at(r,u,v,10),down,20,arenas)[0];return h?h.point.y-r.y0:-Infinity;};
const clear=(r,a,b)=>{const from=at(r,...a),to=at(r,...b);return cast(r,from,to.clone().sub(from),from.distanceTo(to)).length===0;};
function verts(g,pred) {const out=[];for(let i=0;i<g.pos.length;i+=3){const p=[g.pos[i],g.pos[i+1],g.pos[i+2]];if(pred(p))out.push(p);}return out;}
const inPlan=(r,u0,u1,v0,v1)=>p=>p[0]>=r.x0+u0*r.w-1e-9&&p[0]<=r.x0+u1*r.w+1e-9&&p[2]>=r.z0+v0*r.d-1e-9&&p[2]<=r.z0+v1*r.d+1e-9;
function infill(r,arena,[u0,u1,v0,v1,h0,h1]) {
  const c=new THREE.Color('#986345');
  r.G[arena].box(r.x0+u0*r.w,r.z0+v0*r.d,r.x0+u1*r.w,r.z0+v1*r.d,r.y0+h0,r.y0+h1,c,c,null);
  release(r);
}
// Every footprint point must see a roof (O arena) at least as high as the part's base: no floating part.
function contact(r,label,u0,u1,v0,v1,base,top) {
  for(const u of [u0+.001,(u0+u1)/2,u1-.001])for(const v of [v0+.001,(v0+v1)/2,v1-.001]) {
    const h=cast(r,at(r,u,v,10),down,20,[1])[0];
    assert.ok(h,label+' footprint overlaps an actual roof');
    const y=h.point.y-r.y0;
    assert.ok(base<=y+1e-6,`floating ${label}: base ${base}, roof ${y} at ${u},${v}`);
    assert.ok(top>y,label+' emerges above the roof');
  }
}
// A shaft (frustum chimney) must start at or below the roof around it and end above it: no floating chimney.
function shaftOnRoof(r,label,u,v,reach,roofArenas=[1]) {
  const cx=r.x0+u*r.w,cz=r.z0+v*r.d,pts=verts(r.G[1],p=>Math.hypot(p[0]-cx,p[2]-cz)<=reach+1e-9);
  assert.ok(pts.length>=6,label+' shaft vertices found');
  const base=Math.min(...pts.map(p=>p[1]))-r.y0,top=Math.max(...pts.map(p=>p[1]))-r.y0;
  let seen=0;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const x=cx+dx*(reach+.04),z=cz+dz*(reach+.04),h=cast(r,new THREE.Vector3(x,r.y0+10,z),down,20,roofArenas)[0];
    if(!h)continue;                       // the shaft may stand near the roof edge: no roof on that side
    seen++;
    const y=h.point.y-r.y0;
    assert.ok(base<=y+1e-6,`floating ${label}: base ${base}, roof ${y}`);
    assert.ok(top>y+.2,label+' emerges above the roof');
  }
  assert.ok(seen>=2,label+' has a roof beside its shaft on at least two sides ('+seen+')');
  return {base,top,lift(m){const gg=m.G[1];for(let i=0;i<gg.pos.length;i+=3)if(Math.hypot(gg.pos[i]-cx,gg.pos[i+2]-cz)<=reach+1e-9&&Math.abs(gg.pos[i+1]-(r.y0+base))<1e-9)gg.pos[i+1]+=.4;release(m);}};
}
const peaks=(raw,prom)=>{const ys=raw.map(y=>Math.round(y*1e6)/1e6);let n=0;for(let i=1;i<ys.length-1;i++){if(!(ys[i]>=ys[i-1]&&ys[i]>ys[i+1]))continue;let l=i;while(l>0&&ys[l-1]<=ys[l])l--;let rr=i;while(rr<ys.length-1&&ys[rr+1]<=ys[rr])rr++;if(ys[i]-Math.max(ys[l],ys[rr])>=prom)n++;}return n;};

// ---- the twelve defining-feature probes; each returns what it proved ----
const PROBES={
  goodsShed(r) {
    const ridge=topAt(r,.15,.47),lantern=topAt(r,.5,.47);
    assert.ok(lantern-ridge>=.08,'lantern stands above the ridge');
    assert.ok(Math.abs(topAt(r,.20,.47)-ridge)<1e-6&&Math.abs(topAt(r,.80,.47)-ridge)<1e-6,'lantern is confined to the central span');
    assert.ok(Math.abs(topAt(r,.15,.30)-topAt(r,.15,.64))<.01&&topAt(r,.15,.14)<ridge,'two-pitch roof with a central ridge');
    const body=verts(r.G[2],inPlan(r,.26,.74,.38,.56)).filter(p=>p[1]>r.y0+ridge-.07&&p[1]<r.y0+ridge+.2);
    const base=Math.min(...body.map(p=>p[1]))-r.y0;
    contact(r,'lantern',.26,.74,.38,.56,base,lantern+.01);
    const stove=verts(r.G[2],inPlan(r,.12,.18,.22,.29)).filter(p=>p[1]>r.y0+ridge-.2);
    contact(r,'stove chimney',.12,.18,.22,.29,Math.min(...stove.map(p=>p[1]))-r.y0,Math.max(...stove.map(p=>p[1]))-r.y0);
    return {forms:['gable','lantern'],landmark:false,lanternBase:base,mutate(m){for(let i=0;i<m.G[2].pos.length;i+=3)if(inPlan(m,.26,.74,.38,.56)([m.G[2].pos[i],m.G[2].pos[i+1],m.G[2].pos[i+2]])&&m.G[2].pos[i+1]<m.y0+base+1e-9)m.G[2].pos[i+1]+=.12;release(m);}};
  },
  loftWorkshop(r) {
    const ridge=topAt(r,.2,.40),gablet=topAt(r,.5,.78);
    assert.ok(gablet-ridge>=.05,'hoist gablet breaks above the main roof');
    assert.ok(topAt(r,.5,.40)-topAt(r,.2,.40)<1e-6,'main ridge continues behind the gablet');
    const beam=verts(r.G[2],p=>p[0]>=r.x0+.46*r.w&&p[0]<=r.x0+.54*r.w&&p[1]>=r.y0+ridge+.02);
    assert.ok(beam.length>0&&Math.max(...beam.map(p=>p[2]))>=r.z0+.84*r.d+.04,'hoist beam projects beyond the front wall plane');
    const chim=verts(r.G[2],inPlan(r,.74,.83,.28,.37)).filter(p=>p[1]>r.y0+ridge-.2);
    const base=Math.min(...chim.map(p=>p[1]))-r.y0,top=Math.max(...chim.map(p=>p[1]))-r.y0;
    contact(r,'chimney',.74,.83,.28,.37,base,top);
    return {forms:['gable','gablet'],landmark:false};
  },
  northLight(r) {
    const glass=[];const g=r.G[1];
    for(let t=0;t<g.owners.length;t++)if(Math.abs(g.col[t*9]-GLASS.r)<1e-6&&Math.abs(g.col[t*9+1]-GLASS.g)<1e-6&&Math.abs(g.col[t*9+2]-GLASS.b)<1e-6)glass.push(g.nor.slice(t*9,t*9+3));
    assert.ok(glass.length>=4,'at least two glazed teeth ('+glass.length+' triangles)');
    for(const n of glass)assert.ok(Math.hypot(n[0]-glass[0][0],n[1]-glass[0][1],n[2]-glass[0][2])<1e-6,'every glazed face points the same way');
    const shaft=verts(r.G[1],inPlan(r,.10,.20,.78,.90)),bottom=Math.min(...shaft.map(p=>p[1]))-r.y0,top=Math.max(...shaft.map(p=>p[1]))-r.y0;
    const annex=topAt(r,.07,.80,[1]);
    assert.ok(bottom<=annex+1e-6&&top-annex>=.6,'slender chimney stands on the boiler house');
    return {forms:['saw'],landmark:true,teeth:glass.length/2};
  },
  timberYard(r) {
    assert.ok(clear(r,[.02,.34,.08],[.98,.34,.08]),'real covered space under the lean-to');
    const coal=topAt(r,.66,.64,[2]),sand=topAt(r,.84,.80,[2]);
    assert.ok(coal>.05&&sand>.04&&Math.abs(coal-sand)>.01,'heaps have different heights');
    return {forms:['lean-to','pyramid'],landmark:false,mutate(m){infill(m,1,[.40,.60,.30,.40,0,.2]);}};
  },
  brickFactory(r) {
    const ridge=topAt(r,.6,.35),tower=topAt(r,.17,.70);
    assert.ok(tower-ridge>=.1,'stair tower stands above the ridge');
    assert.ok(topAt(r,.72,.80)<ridge-.25,'boiler house is lower than the main block');
    const chim=topAt(r,.86,.80,[1,2]),roof=topAt(r,.72,.80,[1]);
    assert.ok(chim-roof>=.5,'boiler-house chimney');
    const shaft=shaftOnRoof(r,'boiler-house chimney',.86,.80,.05*(Math.min(r.w,r.d)>=2?1.3:1));
    return {forms:['gable','lean-to','flat-corbel'],landmark:true,mutate(m){shaft.lift(m);}};
  },
  cottonMill(r) {
    const ridge=topAt(r,.5,.30),us=Array.from({length:41},(_,i)=>.05+i*.0225),ys=us.map(u=>topAt(r,u,.66));
    const best=us[ys.indexOf(Math.max(...ys))];
    assert.ok(best>=.8,'stair tower sits at the long-axis end (u='+best+')');
    assert.ok(Math.max(...ys)-ridge>=.1,'pyramid apex above the ridge');
    const sc=Math.min(r.w,r.d)>=2?1.3:1,cup=verts(r.G[2],p=>Math.hypot(p[0]-(r.x0+.5*r.w),p[2]-(r.z0+.38*r.d))<=.055*sc*1.5);
    const base=Math.min(...cup.map(p=>p[1]))-r.y0,top=Math.max(...cup.map(p=>p[1]))-r.y0;
    const rf=h=>cast(r,at(r,.5,.38,10),down,20,[1])[0].point.y-r.y0;void rf;
    contact(r,'cupola',.5-.055*sc/r.w,.5+.055*sc/r.w,.38-.055*sc/r.d,.38+.055*sc/r.d,base,top);
    return {forms:['gable','pyramid','lean-to'],landmark:true};
  },
  dockWarehouse(r) {
    let hw=0;for(let t=0;t<r.G[0].tags.length;t++)hw=Math.max(hw,r.G[0].tags[t]);hw-=r.y0;
    const oak=new THREE.Color('#7a5a3c'),g=r.G[1],zs=[],ys=[];
    for(let t=0;t<g.owners.length;t++)if(Math.abs(g.col[t*9]-oak.r)<1e-6&&Math.abs(g.col[t*9+1]-oak.g)<1e-6&&Math.abs(g.col[t*9+2]-oak.b)<1e-6)for(let j=0;j<3;j++){zs.push(g.pos[t*9+j*3+2]);ys.push(g.pos[t*9+j*3+1]-r.y0);}
    assert.ok(zs.length>0,'hoist canopy exists');
    assert.ok(Math.max(...zs)-(r.z0+.80*r.d)>=.06,'canopy projects from the front wall');
    assert.ok(Math.max(...ys)>=.6*hw,'canopy hangs high on the wall');
    return {forms:['gable','canopy'],landmark:false};
  },
  boilerHouse(r) {
    const cx=r.x0+.80*r.w,cz=r.z0+.52*r.d,g=r.G[1],rad=p=>Math.hypot(p[0]-cx,p[2]-cz);
    const tris=[];
    for(let t=0;t<g.owners.length;t++){const p=[0,1,2].map(j=>g.pos.slice(t*9+j*3,t*9+j*3+3));if(p.every(q=>rad(q)<.13)&&Math.max(...p.map(q=>q[1]))-Math.min(...p.map(q=>q[1]))>.5)tris.push(p);}
    assert.equal(tris.length,16,'eight-sided shaft: 8 faces x 2 triangles');
    const all=tris.flat(),lo=Math.min(...all.map(q=>q[1])),hi=Math.max(...all.map(q=>q[1]));
    assert.ok(hi-r.y0>=1.2,'chimney reaches 1.2 cells ('+(hi-r.y0)+')');
    const rb=Math.max(...all.filter(q=>q[1]-lo<1e-9).map(rad)),rt=Math.max(...all.filter(q=>hi-q[1]<1e-9).map(rad));
    assert.ok(rb>rt+.02,'tapering shaft');
    assert.ok(lo-r.y0<=topAt(r,.80,.52,[0,1])+.001||lo<r.y0+.2,'shaft starts on its plinth');
    return {forms:['lean-to'],landmark:true,mutate(m){const gg=m.G[1];for(let i=1;i<gg.pos.length;i+=3)if(Math.abs(gg.pos[i]-lo)<1e-9&&rad([gg.pos[i-1],0,gg.pos[i+1]])<.13)gg.pos[i]+=.5;release(m);}};
  },
  engineWorks(r) {
    const ys=Array.from({length:91},(_,i)=>topAt(r,.05+i*.01,.36));
    assert.ok(peaks(ys,.08)>=3,'at least three parallel gables ('+peaks(ys,.08)+')');
    assert.ok(clear(r,[.34,.98,.20],[.34,.70,.20]),'open space under the gantry');
    shaftOnRoof(r,'works chimney',.12,.20,.05);
    return {forms:['multi-gable','lantern'],landmark:true,mutate(m){infill(m,2,[.30,.38,.78,.92,0,.30]);}};
  },
  steamMill(r) {
    const tower=topAt(r,.50,.66),chim=topAt(r,.88,.28);
    assert.ok(chim-tower>=.3,'square chimney stands above the tower cap');
    const g=r.G[1];let apex=-Infinity;
    for(let i=1;i<g.pos.length;i+=3)if(Math.abs(g.pos[i-1]-(r.x0+.5*r.w))<1e-9&&Math.abs(g.pos[i+1]-(r.z0+.66*r.d))<1e-9)apex=Math.max(apex,g.pos[i]);
    assert.ok(Number.isFinite(apex)&&apex-r.y0>=tower-1e-6,'pyramid apex over the tower centre');
    let faces=0;for(let t=0;t<g.owners.length;t++)for(let j=0;j<3;j++)if(Math.abs(g.pos[t*9+j*3+1]-apex)<1e-9&&Math.abs(g.pos[t*9+j*3]-(r.x0+.5*r.w))<1e-9)faces++;
    assert.equal(faces,4,'four-faced pyramid cap');
    return {forms:['gable','pyramid','lean-to'],landmark:true};
  },
  gasworks(r) {
    const cx=r.x0+.62*r.w,cz=r.z0+.46*r.d,g=r.G[2],sectors=new Set();
    for(let t=0;t<g.owners.length;t++){const p=[0,1,2].map(j=>g.pos.slice(t*9+j*3,t*9+j*3+3));if(Math.max(...p.map(q=>q[1]))-Math.min(...p.map(q=>q[1]))<.4)continue;const mx=p.reduce((s,q)=>s+q[0],0)/3-cx,mz=p.reduce((s,q)=>s+q[2],0)/3-cz;if(Math.hypot(mx,mz)<.25*Math.min(r.w,r.d)||Math.hypot(mx,mz)>.25*Math.min(r.w,r.d)+.12)continue;sectors.add(Math.floor(((Math.atan2(mz,mx)+Math.PI*2)%(Math.PI*2))/(Math.PI/4)));}
    assert.ok(sectors.size>=8,'guide-frame columns around the holder ('+sectors.size+' sectors)');
    const ring=.25*Math.min(r.w,r.d)+.055;
    const from=new THREE.Vector3(cx+ring+.12,r.y0+.25,cz),to=new THREE.Vector3(cx,r.y0+.25,cz),hit=cast(r,from,to.clone().sub(from),from.distanceTo(to));
    assert.ok(hit[0]&&hit[0].arena===1,'between two columns the first thing is the holder drum, not the frame');
    return {forms:['cylinder-frame','gable'],landmark:true,mutate(m){m.G[2].box(cx+ring-.03,cz-.05,cx+ring+.03,cz+.05,m.y0,m.y0+.5,new THREE.Color('#4b5158'),new THREE.Color('#4b5158'),null);release(m);}};
  },
  bottleKilns(r) {
    const cx=r.x0+.27*r.w,cz=r.z0+.27*r.d,g=r.G[1],near=[];
    const sc=Math.min(r.w,r.d)>=2?1.3:1,reach=.20*sc*1.3;
    for(let i=0;i<g.pos.length;i+=3)if(Math.hypot(g.pos[i]-cx,g.pos[i+2]-cz)<reach)near.push([g.pos[i],g.pos[i+1],g.pos[i+2]]);
    const levels=[...new Set(near.map(p=>+p[1].toFixed(6)))].sort((a,b)=>a-b);
    assert.ok(levels.length>=4,'stacked profile levels');
    const radius=y=>Math.max(...near.filter(p=>Math.abs(p[1]-y)<1e-5).map(p=>Math.hypot(p[0]-cx,p[2]-cz)));
    const rs=levels.slice(0,4).map(radius);
    assert.ok(rs[1]>rs[0]+.01&&rs[1]>rs[3]+.05,'belly wider than both base and neck: '+rs.map(x=>x.toFixed(3)));
    return {forms:['bottle','gable'],landmark:true,mutate(m){const gg=m.G[1];for(let i=0;i<gg.pos.length;i+=3)if(Math.hypot(gg.pos[i]-cx,gg.pos[i+2]-cz)<reach&&Math.abs(gg.pos[i+1]-(levels[1]))<1e-5){gg.pos[i]=cx+(gg.pos[i]-cx)*.5;gg.pos[i+2]=cz+(gg.pos[i+2]-cz)*.5;}release(m);}};
  },
};

// A box with its top missing shows its inside faces from the camera; camera-like rays must never reach a back face first.
function openContainers(r,n=21) {
  let bad=0;const sample=[];
  for(let i=0;i<n;i++)for(let j=0;j<n;j++) {
    const x=r.x0+r.w*(i+.5)/n,z=r.z0+r.d*(j+.5)/n;
    for(const [dx,dz] of [[.6,.6],[-.6,.6],[.6,-.6],[-.6,-.6]]) {
      const dir=new THREE.Vector3(dx,-1,dz).normalize(),from=new THREE.Vector3(x-dx*4,r.y0+4,z-dz*4);
      const hit=cast(r,from,dir,30)[0];
      if(hit&&hit.face.normal.dot(dir)>1e-6){bad++;if(sample.length<3)sample.push([+hit.point.x.toFixed(2),+hit.point.z.toFixed(2),+(hit.point.y-r.y0).toFixed(2)]);}
    }
  }
  return {bad,sample};
}

function wallTagsOk(r) {
  const g=r.G[0];let tagged=0,untagged=0;
  for(let t=0;t<g.tags.length;t++) {
    const tag=g.tags[t];
    if(tag===0){untagged++;continue;}
    tagged++;
    const s=t*9,top=Math.max(g.pos[s+1],g.pos[s+4],g.pos[s+7]);
    assert.ok(Math.abs(tag-top)<1e-7,'weather tag equals the actual wall top');
    for(let j=0;j<3;j++)assert.ok(Math.abs(g.nor[s+j*3+1])<1e-7,'only vertical walls receive weather tags');
  }
  assert.ok(tagged>0,r.model+' core walls retain actual age-weather tags');
  void untagged;
  assert.ok(r.G[1].tags.every(t=>t===0)&&r.G[2].tags.every(t=>t===0),'roof and dressing retain zero wall tags');
}
// Area-weighted dominant colour of the weather-tagged (main wall) triangles, as hex.
function wallColour(r) {
  const g=r.G[0],area=new Map();
  for(let t=0;t<g.tags.length;t++){
    if(!g.tags[t])continue;
    const s=t*9,a=new THREE.Vector3(...g.pos.slice(s,s+3)),b=new THREE.Vector3(...g.pos.slice(s+3,s+6)),c=new THREE.Vector3(...g.pos.slice(s+6,s+9));
    const k=new THREE.Color(g.col[s],g.col[s+1],g.col[s+2]).getHexString();
    area.set(k,(area.get(k)??0)+b.sub(a).cross(c.sub(a)).length()/2);
  }
  return [...area.entries()].sort((p,q)=>q[1]-p[1])[0][0];
}
const hsl=hex=>{const c=new THREE.Color('#'+hex),o={};c.getHSL(o,THREE.SRGBColorSpace);return o;};

function industryPicks(built,city,blocks) {
  const targets=new Map(),tested=new Map();
  blocks.plan.forEach((b,bi)=>{if(industryBlock(blocks.recipe(b)))targets.set(-bi-1,{block:bi});});
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
      assert.ok(hit&&hit.id>0,'actual industrial triangle is pickable, owner '+owner);
      assert.equal(hit.block,want.block,'D060 industrial block triangle owner');
      assert.equal(hit.id,city.occ[hit.z*city.n+hit.x],'D060 industrial geometry maps back to the saved occupied tile');
      tested.set(owner,(tested.get(owner)??0)+1);
    }
  }
  for(const owner of targets.keys())assert.ok((tested.get(owner)??0)>0,'selected industrial owner was rendered and ray-tested '+owner);
  return [...tested.values()].reduce((a,b)=>a+b,0);
}

export async function d060Guards(log) {
  let failed=0;
  const test=(name,fn)=>{try{fn();log(true,'D060 '+name);}catch(e){failed++;log(false,'D060 '+name,e.stack??String(e));}};

  test('twelve existing archetypes select exactly twelve models; other kinds, levels and tables untouched',()=>{
    const expected={'1:shed':'goodsShed','1:workshop':'loftWorkshop','1:sawShed':'northLight','1:yard':'timberYard','2:factory':'brickFactory','2:mill':'cottonMill','2:warehouse':'dockWarehouse','2:stack':'boilerHouse','3:heavy':'engineWorks','3:mill3':'steamMill','3:tankfarm':'gasworks','3:chimneyHall':'bottleKilns'};
    const frozen=JSON.stringify(ARCHE),found=new Set();
    for(const lv of [1,2,3])for(let v=0;v<24;v++)for(const [w,h] of SIZES) {
      const r=recipe(ARCHE,3,lv,w,h,v),model=industryBlock(r);
      assert.equal(model,expected[lv+':'+r.arche]??null,`3_${lv} v${v} ${r.arche} render-only selector`);
      assert.ok(model,'every kind-3 archetype has a model');
      found.add(model);
    }
    assert.deepEqual([...found].sort(),[...INDUSTRY_MODELS].sort());
    assert.equal(found.size,12);
    for(const k of [1,2])for(let lv=1;lv<=3;lv++)for(let v=0;v<24;v++)assert.equal(industryBlock(recipe(ARCHE,k,lv,2,2,v)),null,'residential and commercial recipes never select industry');
    assert.deepEqual(D060_MODELS.map(m=>m[0]),[...INDUSTRY_MODELS],'review-city model order equals the selector order');
    assert.equal(JSON.stringify(ARCHE),frozen,'archetype data remains exact');
  });

  test('twelve distinct deterministic geometries: finite attributes, parcel, height, owner, weighted ceiling and floor at every size and palette',()=>{
    const hashes=new Set();
    for(const model of INDUSTRY_MODELS) {
      hashes.add(sha(drawIndustryCase(model).G.map(g=>g.pos)));
      for(const [w,d] of SIZES)for(const pal of PALS) {
        const r=drawIndustryCase(model,{w,d,pal});validGeometry(r);
        const again=drawIndustryCase(model,{w,d,pal});
        assert.deepEqual(again.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.owners,g.tags,g.wst,g.wgl,g.wbd]),r.G.map(g=>[g.pos,g.nor,g.col,g.uv,g.owners,g.tags,g.wst,g.wgl,g.wbd]),model+' deterministic actual geometry');
      }
    }
    assert.equal(hashes.size,12,'twelve structural geometries, not palette-only alternatives');
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
    ]) {const r=drawIndustryCase('loftWorkshop');mutate(r);assert.throws(()=>validGeometry(r));}
  });

  test('no open container is visible from camera-like directions, and an opened box is detected',()=>{
    for(const model of INDUSTRY_MODELS)for(const [w,d,pal] of [[2,2,0],[1,1,3],[1,2,5],[2,1,1]]) {
      const r=drawIndustryCase(model,{w,d,pal}),o=openContainers(r);
      assert.equal(o.bad,0,`${model} ${w}x${d} has an open container (first back faces at ${JSON.stringify(o.sample)})`);
      release(r);
    }
    // Negative control: remove the roofless annex cap of the north-light shed.
    const r=drawIndustryCase('northLight'),g=r.G[1],keep=[];
    for(let t=0;t<g.owners.length;t++){const ys=[1,4,7].map(o=>g.pos[t*9+o]),flat=Math.max(...ys)-Math.min(...ys)<1e-9&&g.nor[t*9+1]>.99,inAnnex=inPlan(r,.04,.26,.74,.94);if(flat&&[0,1,2].every(j=>inAnnex([g.pos[t*9+j*3],0,g.pos[t*9+j*3+2]])))continue;keep.push(t);}
    assert.equal(g.owners.length-keep.length,2,'the annex cap is exactly two triangles');
    const out=new Geo();out.owner=r.owner;
    for(const t of keep){out.pos.push(...g.pos.slice(t*9,t*9+9));out.nor.push(...g.nor.slice(t*9,t*9+9));out.col.push(...g.col.slice(t*9,t*9+9));out.uv.push(...g.uv.slice(t*9,t*9+6));out.owners.push(r.owner);out.tags.push(0);}
    r.G[1]=out;release(r);
    assert.ok(openContainers(r).bad>0,'the opened annex is reported');release(r);
  });

  test('core walls keep aging tags at actual heights; roofs and dressing stay untagged; explicit no-weather stays untagged without distortion',()=>{
    for(const model of INDUSTRY_MODELS)for(const [w,d] of [[1,1],[2,2],[1,2]]) {
      const r=drawIndustryCase(model,{w,d,weather:true});validGeometry(r);wallTagsOk(r);
      const pristine=drawIndustryCase(model,{w,d,weather:false});
      assert.ok(pristine.G.every(g=>g.tags.every(t=>t===0)),model+' explicit no-weather path stays untagged');
      assert.deepEqual(r.G.map(g=>g.pos),pristine.G.map(g=>g.pos),model+' aging metadata does not distort geometry');
    }
    const lost=drawIndustryCase('steamMill');lost.G[0].tags.fill(0);
    assert.throws(()=>wallTagsOk(lost),/retain actual age-weather tags/,'dropping weather tags is detected');
    const roofed=drawIndustryCase('steamMill');roofed.G[1].tags[0]=1;
    assert.throws(()=>wallTagsOk(roofed),/retain zero wall tags/,'weather-tagged roof is detected');
  });

  test('six distinct wall palettes per model, five or more saturated wall tones overall, three or more window styles',()=>{
    const tones=new Set(),styles=new Set(),sat=[];
    for(const model of INDUSTRY_MODELS) {
      const colours=PALS.map(pal=>wallColour(drawIndustryCase(model,{pal})));
      assert.equal(new Set(colours).size,6,model+' six palettes give six distinct main-wall colours: '+colours);
      for(const c of colours){tones.add(c);sat.push(hsl(c).s);}
      for(const g of drawIndustryCase(model).G[0].wst)if(g>0)styles.add(g);
    }
    const saturated=[...tones].filter(c=>hsl(c).s>=.25);
    assert.ok(saturated.length>=5,'saturated wall tones '+saturated.length);
    assert.ok(Math.max(...sat)>BASE.vocabulary.wallSaturation[1],'new walls are more saturated than the old maximum '+BASE.vocabulary.wallSaturation[1]);
    assert.ok(styles.size>=3,'window styles used: '+[...styles]);
    assert.ok(BASE.vocabulary.windowStyles.length===1&&BASE.vocabulary.roofKinds.length===2,'baseline vocabulary is the recorded two roof forms and one window style');
  });

  test('every model proves its defining feature on real geometry; roof forms and landmarks reach the card floors; each probe has a failing negative control',()=>{
    const forms=new Set();let landmarks=0;
    for(const model of INDUSTRY_MODELS) {
      for(const [w,d] of [[2,2],[1,1],[1,2]]) {
        const r=drawIndustryCase(model,{w,d}),proved=PROBES[model](r);
        if(w===2&&d===2){for(const f of proved.forms)forms.add(f);if(proved.landmark)landmarks++;}
        release(r);
        if(w===2&&d===2&&proved.mutate) {
          const broken=drawIndustryCase(model);proved.mutate(broken);
          assert.throws(()=>PROBES[model](broken),undefined,model+' negative control: a broken feature must fail its probe');
          release(broken);
        }
      }
    }
    assert.ok(forms.size>=8,'roof forms proved: '+[...forms]);
    assert.ok(landmarks>=6,'independent vertical landmarks proved: '+landmarks);
    // Contact negative control: a floating lantern is rejected.
    const r=drawIndustryCase('goodsShed'),first=PROBES.goodsShed(r);release(r);
    const m=drawIndustryCase('goodsShed');first.mutate(m);
    assert.throws(()=>PROBES.goodsShed(m),/floating lantern/,'floating lantern detected');release(m);
    // Hollow-space negative controls: infill in the yard, the gantry and the gas-holder frame is rejected.
    for(const [model,arena,box] of [['timberYard',1,[.40,.60,.30,.40,0,.2]],['engineWorks',0,[.30,.38,.78,.92,0,.30]],['engineWorks',1,[.30,.38,.78,.92,0,.30]]]) {
      const b=drawIndustryCase(model);infill(b,arena,box);assert.throws(()=>PROBES[model](b),undefined,model+' infill in arena '+arena);release(b);
    }
  });

  test('production whole-city geometry: three batches, exact A, legacy flag equals the D059 baseline bytes, zero budget growth, existing phone ceilings',()=>{
    let changedModes=0;
    for(const id of ['seed516','ai120']) {
      const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
      for(const mode of ['a','b','c']) {
        const world=sha(city),base=BASE.cities[id].modes[mode],snapshots={};
        for(const enabled of [false,true]) {
          const blocks={...d058Blocks(city,mode),villageArt:true,industryArt:enabled},con=new ConState(city.n);
          const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
          try {
            assert.equal(built.buildingMeshes().length,3,'existing batch count');
            for(const mesh of built.meshStats().filter(m=>['walls','other','dress'].includes(m.name)))assert.equal(mesh.shadow,mesh.name!=='dress','existing shadow flags');
            if(enabled&&mode!=='a')industryPicks(built,city,blocks);
            snapshots[enabled]={measured:measure(city,blocks),digest:digest(built),meshes:built.meshStats(),sig:signature(built),weighted:weighted(built)};
          } finally {built.dispose();con.dispose();}
        }
        assert.equal(sha(city),world,'art and comparison do not modify the world');
        const off=snapshots[false],on=snapshots[true];
        assert.equal(off.sig,base.signature,`${id} ${mode} industryArt=false reproduces the D059 baseline scene byte for byte`);
        assert.equal(off.weighted,base.weighted,`${id} ${mode} legacy weighted triangles equal the baseline`);
        assert.deepEqual(on.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),off.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
        assert.equal(on.digest.ground,off.digest.ground,'actual ground pixels unchanged');
        assert.deepEqual(on.digest.inst,off.digest.inst,'all existing trees keep exact transforms, colors and ages');
        if(mode==='a') {
          assert.equal(on.sig,off.sig,'A mode remains the exact density reference');
          assert.deepEqual(on.meshes,off.meshes,'A mode submissions are unchanged');
        } else {
          assert.ok(on.weighted<=base.weighted,`${id} ${mode} zero growth: ${on.weighted} <= ${base.weighted}`);
          assert.ok(on.weighted<=CITY_CAP[id],`${id} ${mode} existing ceiling ${CITY_CAP[id]}`);
          assert.ok(on.measured.industry.weighted<=base.industry.weighted,`${id} ${mode} industrial class ${on.measured.industry.weighted} <= ${base.industry.weighted}`);
          for(const [key,row] of Object.entries(on.measured.industry.byArche)) {
            const model=INDUSTRY_MODELS[D060_MODELS.findIndex(m=>`lv${m[1]}:${ARCHE[`3_${m[1]}`][m[2]].n}`===key)];
            assert.ok(row.weighted<=row.blocks*CAP[model],`${id} ${mode} ${key} stays under its per-model ceiling`);
          }
          assert.notEqual(on.sig,off.sig,'selected industrial blocks really use D060 geometry');
          // Everything that is not an industrial block keeps its per-owner triangle counts.
          const blocks=d058Blocks(city,mode),industrial=new Set();
          blocks.plan.forEach((b,bi)=>{if(industryBlock(blocks.recipe(b)))industrial.add(String(-bi-1));});
          for(const name of ['walls','other','dress']) {
            const a=off.digest.meshes[name][1],b=on.digest.meshes[name][1];
            for(const owner of new Set([...Object.keys(a),...Object.keys(b)]))if(!industrial.has(owner))assert.equal(b[owner],a[owner],`${name} owner ${owner} unchanged`);
          }
          changedModes++;
        }
      }
    }
    assert.equal(changedModes,4,'B and C of both decoded production samples exercise the new dispatch');
  });

  test('D060 mode changes invalidate cached production geometry and agree with fresh scene builds',()=>{
    const city=d058City(fs.readFileSync(path.join(ROOT,'src/content/samples/ai120.code.txt'),'utf8'));
    const world=sha(city),con=new ConState(city.n);let previous;
    try {
      for(const enabled of [false,true,false,true]) {
        const blocks={...d058Blocks(city),villageArt:true,industryArt:enabled};
        const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con);
        previous?.dispose();previous=built;
        const freshCon=new ConState(city.n),fresh=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,freshCon,true);
        try {assert.deepEqual(digest(built),digest(fresh),'fresh/incremental industryArt='+enabled);}
        finally {fresh.dispose();freshCon.dispose();}
      }
      assert.equal(sha(city),world,'cache mode changes do not modify the world');
    } finally {previous?.dispose();con.dispose();}
  });

  test('authored review city: all twenty-four sites select their model in B and C; production weather reaches aCon, ConState wallTop and actual ages',()=>{
    const code=d060ReviewCode(),proof=d060FixtureProof(code);
    assert.equal(proof.selectors.c.length,24);assert.equal(new Set(proof.selectors.c.map(s=>s.model)).size,12);
    const city=d058City(code),world=sha(city),con=new ConState(city.n),blocks={...d058Blocks(city),villageArt:true,industryArt:true};
    const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
    try {
      assert.ok(built.con,'production construction metadata exists');
      con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(city,k=>KT.cat(k));
      assert.deepEqual(con.wallTop,built.con.wallTop,'ConState receives the actual generated wall heights');
      const wall=built.buildingMeshes()[0],p=wall.geometry.attributes.position,a=wall.geometry.attributes.aCon,owners=built.pickOwners()[0];
      assert.ok(a&&a.itemSize===3&&a.count===p.count,'real production vertices contain complete aCon attributes');
      const targets=new Map(),count=new Map();
      blocks.plan.forEach((b,bi)=>{const r=blocks.recipe(b);if(industryBlock(r)){assert.equal(r.path,'core');targets.set(-bi-1,{b,model:industryBlock(r)});}});
      assert.equal(targets.size,24);
      let tagged=0;
      for(let t=0;t<owners.length;t++) {
        const target=targets.get(owners[t]);if(!target)continue;
        const tag=a.getZ(t*3);if(tag===0)continue;
        tagged++;count.set(target.model,(count.get(target.model)??0)+1);
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
      }
      for(const model of INDUSTRY_MODELS)assert.ok((count.get(model)??0)>0,model+' production weather is connected');
      assert.equal(built.weatherInfo().core,tagged,'current weather statistic counts actual tagged core triangles');
      assert.equal(built.weatherInfo().facade,0,'no industrial block acquires invented facade weather');
      industryPicks(built,city,blocks);
      const freshCon=new ConState(city.n),fresh=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,freshCon,true);
      try {assert.deepEqual(digest(built),digest(fresh),'weather metadata agrees with a fresh production build');}
      finally {fresh.dispose();freshCon.dispose();}
      assert.equal(sha(city),world,'weather rendering preserves all city state');
    } finally {built.dispose();con.dispose();}
  });

  test('older legacy flags switch D060 off with them; window atlas, scene accumulator and old block art are byte-identical to the baseline',()=>{
    const view=fs.readFileSync(path.join(ROOT,'src/cityView.ts'),'utf8');
    assert.match(view,/industryArt: !\['industryArt', 'villageArt', 'streetArt', 'britishArt', 'heritageArt'\]\.some\(key => q\.get\(key\) === 'legacy'\)/,'every older legacy flag disables D060');
    assert.match(view,/villageArt: !\['villageArt', 'streetArt', 'britishArt', 'heritageArt'\]\.some\(key => q\.get\(key\) === 'legacy'\)/,'D059 flag chain is unchanged');
    const scope=read('fixtures/d060-art-scope.json');
    for(const file of ['src/render/windows.ts','src/render/scene.ts','src/render/blockArt.ts','src/content/recipes.ts','src/content/blocks.ts','src/content/lab-arche.json','src/render/pieces.ts'])
      assert.equal(scope.after[file],scope.before[file],file+' is byte-identical to the baseline');
  });

  test('exact source scope reconstructs D059 and rejects injected mutations before historical reversal',()=>{
    assertD060Scope();
    const manifest=read('fixtures/d060-art-scope.json');
    for(const file of manifest.modified)assert.equal(createHash('sha256').update(d060HistoricalBytes(file)).digest('hex'),manifest.before[file],'historical bytes '+file);
    for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-arche.json','src/render/britishVillageArt.ts','src/render/windows.ts','src/render/scene.ts','src/render/blockArt.ts','src/render/britishIndustryArt.ts','src/content/britishIndustry.ts','src/render/cityScene.ts','src/cityView.ts']) {
      const mutation=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized D060 mutation':'');
      assert.throws(()=>assertD060Scope(mutation),/exact allowed source/,target+' source mutation');
      assert.throws(()=>d060HistoricalBytes(target,mutation),/exact allowed source/,target+' historical-reader mutation');
    }
  });
  return failed;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await d060Guards((ok,name,detail)=>console.log(ok?'PASS':'FAIL',name,detail??''))?1:0;

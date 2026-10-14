// D059 tests actual procedural meshes and production scenes, without claiming
// browser rendering or Android hardware acceptance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ROOT} from './cdp.mjs';
import {Geo} from '../src/render/scene.ts';
import {drawBritishVillage} from '../src/render/britishVillageArt.ts';
import {villageBlock,villageKind} from '../src/content/britishVillage.ts';
import {recipe} from '../src/content/recipes.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {kindColors,shapeOf} from '../src/content/kindShapes.ts';
import {d058Blocks,d058City} from './unit-d058.mjs';
import {d059ReviewCode} from './d059-scenes.mjs';
import {assertD059Scope,d059HistoricalBytes} from './d059-scope.mjs';

const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const MODELS=['cottage','rows','inn','church','oast','manor'];
const ARCHE=read('src/content/lab-arche.json').arche;
const KT=kindTableFrom(read('src/content/lab-kinds.json'));
const LOOKS=read('src/content/lab-looks.json').looks;
const civic={shape:shapeOf,colors:(k,lv)=>kindColors(LOOKS,k,lv,KT.catColor(KT.cat(k)))};
const total=b=>b.meshStats().reduce((n,m)=>n+m.tris*(m.shadow?2:1),0);
const digest=b=>{const d=sceneDigest(b);return {meshes:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),ground:d.ground,inst:d.inst,queries:d.queries,counts:d.counts};};

export function drawVillageCase(model,{w=2,d=2,H=1.2,x0=3.125,z0=7.375,y0=.21,owner=71,weather=false}={}) {
  const G=[new Geo({ext:true}),new Geo(),new Geo()];
  for(const g of G)g.owner=owner;
  // Record actual chimney body vertices and the already-generated roof context.
  // This tests triangle intersections, not a duplicated roof-height formula.
  const chimneys=[],box=G[1].box;
  G[1].box=function(...args) {
    const chimney=['cottage','inn','manor'].includes(model)
      &&Math.abs((args[2]-args[0])/w-.07)<1e-8&&Math.abs((args[3]-args[1])/d-.06)<1e-8;
    const record=chimney?{footprint:args.slice(0,4),start:this.pos.length,end:0,roof:[...G[0].pos,...this.pos]}:null;
    const result=box.apply(this,args);
    if(record) {record.end=this.pos.length;chimneys.push(record);}
    return result;
  };
  const a={W:G[0],O:G[1],D:G[2],x0,z0,w,d,y0,H,weather};
  const input=JSON.stringify([x0,z0,w,d,y0,H,owner]);
  const anchor=drawBritishVillage(a,model);
  G[1].box=box;
  assert.equal(JSON.stringify([a.x0,a.z0,a.w,a.d,a.y0,a.H,...G.map(g=>g.owner).slice(0,1)]),input,'read-only model coordinates and owner');
  return {G,anchor,w,d,H,x0,z0,y0,owner,model,weather,chimneys};
}

function checkRoofContacts(r) {
  assert.equal(r.chimneys.length,2,r.model+' records both actual chimney bodies');
  for(const c of r.chimneys) {
    const [x0,z0,x1,z1]=c.footprint;
    const ys=[];for(let i=c.start+1;i<c.end;i+=3)ys.push(r.G[1].pos[i]);
    const bottom=Math.min(...ys),top=Math.max(...ys);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(c.roof,3));
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);
    mesh.updateMatrixWorld();
    try {
      for(const u of [.001,.5,.999])for(const v of [.001,.5,.999]) {
        const x=x0+(x1-x0)*u,z=z0+(z1-z0)*v;
        const ray=new THREE.Raycaster(new THREE.Vector3(x,r.y0+r.H+1,z),new THREE.Vector3(0,-1,0));
        const hit=ray.intersectObject(mesh)[0];
        assert.ok(hit,r.model+' chimney footprint overlaps an actual roof');
        assert.ok(bottom<=hit.point.y+1e-6,`${r.model} floating chimney: bottom ${bottom}, roof ${hit.point.y}, x ${x}, z ${z}`);
        assert.ok(top>hit.point.y,r.model+' chimney emerges above the roof');
      }
    } finally {geometry.dispose();material.dispose();}
  }
}

function checkWallTags(r) {
  const g=r.G[0];let tagged=0,untagged=0;
  for(let t=0;t<g.tags.length;t++) {
    const tag=g.tags[t];
    if(tag===0) {untagged++;continue;}
    tagged++;
    const start=t*9,top=Math.max(g.pos[start+1],g.pos[start+4],g.pos[start+7]);
    assert.ok(Math.abs(tag-top)<1e-7,'weather tag equals the actual wall top');
    for(let j=0;j<3;j++)assert.ok(Math.abs(g.nor[start+j*3+1])<1e-7,'only vertical walls receive weather tags');
  }
  assert.ok(tagged>0,r.model+' core walls retain actual age-weather tags');
  assert.ok(untagged>0,'roof-end triangles do not acquire wall-weather tags');
  assert.ok(r.G[1].tags.every(t=>t===0)&&r.G[2].tags.every(t=>t===0),'roof and dressing retain zero wall tags');
}

function validGeometry(r) {
  let triangles=0,top=-Infinity;
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
    triangles+=g.pos.length/9;
    for(let i=0;i<g.pos.length;i+=3) {
      assert.ok(g.pos[i]>=r.x0-1e-7&&g.pos[i]<=r.x0+r.w+1e-7,r.model+' parcel x');
      assert.ok(g.pos[i+2]>=r.z0-1e-7&&g.pos[i+2]<=r.z0+r.d+1e-7,r.model+' parcel z');
      assert.ok(g.pos[i+1]>=r.y0-1e-7&&g.pos[i+1]<=r.y0+r.H+1e-7,r.model+' unchanged height envelope');
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
  assert.ok(triangles>100&&triangles<=1300,r.model+' per-model triangle budget '+triangles);
  assert.ok(top>r.y0+r.H*.65,r.model+' recognizable vertical silhouette');
  assert.ok(r.anchor instanceof THREE.Vector3&&r.anchor.toArray().every(Number.isFinite),'finite anchor');
  return triangles;
}

const point=(r,u,v,y)=>new THREE.Vector3(r.x0+u*r.w,r.y0+y*r.H,r.z0+v*r.d);
function hits(r,from,to) {
  const delta=to.clone().sub(from),ray=new THREE.Raycaster(from,delta.clone().normalize(),0,delta.length());
  const result=[];
  for(let arena=0;arena<r.G.length;arena++) {
    const g=r.G[arena],geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(g.pos,3));
    const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);
    mesh.updateMatrixWorld();
    try {result.push(...ray.intersectObject(mesh).map(hit=>({...hit,arena})));}
    finally {geometry.dispose();material.dispose();}
  }
  return result.sort((a,b)=>a.distance-b.distance);
}
const clear=(r,a,b)=>hits(r,point(r,...a),point(r,...b)).length===0;
const sky=(r,u,v)=>clear(r,[u,v,.04],[u,v,1.1]);
function infill(r,arena,[u0,u1,v0,v1,h0,h1]) {
  const color=new THREE.Color('#986345');
  r.G[arena].box(r.x0+u0*r.w,r.z0+v0*r.d,r.x0+u1*r.w,r.z0+v1*r.d,r.y0+h0*r.H,r.y0+h1*r.H,color,color,null);
}

function villagePicks(built,city,blocks) {
  const targets=new Map(),tested=new Map();
  blocks.plan.forEach((b,bi)=>{if(villageBlock(blocks.recipe(b)))targets.set(-bi-1,{block:bi});});
  for(const b of city.buildings)if(b.goneDay===undefined&&villageKind(b.k))targets.set(b.id,{id:b.id});
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
      assert.ok(hit&&hit.id>0,'actual village triangle is pickable, owner '+owner);
      if(want.id)assert.equal(hit.id,want.id,'D059 facility triangle owner');
      else {
        assert.equal(hit.block,want.block,'D059 street block triangle owner');
        assert.equal(hit.id,city.occ[hit.z*city.n+hit.x],'D059 facade maps back to the saved occupied tile');
      }
      tested.set(owner,(tested.get(owner)??0)+1);
    }
  }
  for(const owner of targets.keys())assert.ok((tested.get(owner)??0)>0,'selected village owner was rendered and ray-tested '+owner);
  return [...tested.values()].reduce((a,b)=>a+b,0);
}

export async function d059Guards(log) {
  let failed=0;
  const test=(name,fn)=>{try{fn();log(true,'D059 '+name);}catch(e){failed++;log(false,'D059 '+name,e.stack??String(e));}};
  test('four existing archetypes and four existing kinds select exactly six models',()=>{
    const expected={'1_1:town':'cottage','2_1:townShop':'rows','2_2:hotel':'inn','1_2:courtyard':'manor'},found=new Set();
    const frozen=JSON.stringify(ARCHE);
    for(const [key,rows] of Object.entries(ARCHE)) {
      const [k,lv]=key.split('_').map(Number);
      for(let v=0;v<rows.length;v++) {
        const r=recipe(ARCHE,k,lv,3,2,v),model=villageBlock(r),want=expected[key+':'+rows[v].n]??null;
        assert.equal(model,want,key+':'+rows[v].n+' render-only selector');
        if(model)found.add(model);
      }
    }
    assert.deepEqual([...found].sort(),['cottage','rows','inn','manor'].sort());
    for(let k=0;k<=200;k++)assert.equal(villageKind(k),[16,66].includes(k)?'church':[22,100].includes(k)?'oast':null,'existing kind '+k);
    assert.equal(JSON.stringify(ARCHE),frozen,'archetype data remains exact');
  });
  test('six distinct deterministic geometries, finite attributes, parcel/height/owner and 1300-triangle ceiling',()=>{
    const silhouettes=new Set();
    for(const model of MODELS) {
      silhouettes.add(sha(drawVillageCase(model).G.map(g=>g.pos)));
      for(const [w,d] of [[1,1],[2,1],[1,2],[3,2],[2,3],[4,4]])for(const H of [.12,.35,.7,1.2,2.2]) {
        const r=drawVillageCase(model,{w,d,H});validGeometry(r);
        assert.deepEqual(drawVillageCase(model,{w,d,H}),r,model+' deterministic actual geometry');
      }
    }
    assert.equal(silhouettes.size,6,'six structural silhouettes, not palette-only alternatives');
  });
  test('independent invisible-owner, NaN, parcel, height, normal and collapsed-triangle mutations are rejected',()=>{
    for(const mutate of [
      r=>r.G[0].owners[0]=0,
      r=>r.G[0].pos[0]=NaN,
      r=>r.G[0].col[0]=NaN,
      r=>r.G[0].pos[0]=r.x0-1,
      r=>r.G[0].pos[1]=r.y0+r.H+1,
      r=>r.G[0].nor[0]=9,
      r=>r.G[0].pos.splice(3,3,...r.G[0].pos.slice(0,3)),
    ]) {const r=drawVillageCase('cottage');mutate(r);assert.throws(()=>validGeometry(r));}
  });
  test('each actual chimney footprint intersects the roof at all nine probes; floating body geometry is rejected',()=>{
    for(const model of ['cottage','inn','manor'])for(const [w,d] of [[1,1],[2,1],[1,2],[3,2],[2,3],[4,4]])for(const H of [.12,.35,.7,1.2,2.2])checkRoofContacts(drawVillageCase(model,{w,d,H}));
    for(const model of ['cottage','inn','manor'])for(let index=0;index<2;index++) {
      const r=drawVillageCase(model),c=r.chimneys[index],ys=[];
      for(let i=c.start+1;i<c.end;i+=3)ys.push(r.G[1].pos[i]);
      const bottom=Math.min(...ys),raised=Math.max(...ys)-r.H*.001;
      for(let i=c.start+1;i<c.end;i+=3)if(Math.abs(r.G[1].pos[i]-bottom)<1e-10)r.G[1].pos[i]=raised;
      assert.throws(()=>checkRoofContacts(r),/floating chimney/,model+' actual floating chimney '+index);
    }
  });
  test('core cottage/Rows/manor walls preserve aging tags at actual heights, while roofs and explicit no-weather stay untagged',()=>{
    for(const model of ['cottage','rows','manor'])for(const [w,d] of [[1,1],[3,1],[1,3],[3,2]])for(const H of [.12,1.2,2.2]) {
      const r=drawVillageCase(model,{w,d,H,weather:true});validGeometry(r);checkWallTags(r);
      const pristine=drawVillageCase(model,{w,d,H,weather:false});
      assert.ok(pristine.G.every(g=>g.tags.every(t=>t===0)),'explicit no-weather path stays untagged');
      assert.deepEqual(r.G.map(g=>g.pos),pristine.G.map(g=>g.pos),'aging metadata does not distort geometry');
    }
    const lost=drawVillageCase('cottage',{weather:true});lost.G[0].tags.fill(0);
    assert.throws(()=>checkWallTags(lost),/retain actual age-weather tags/,'dropping weather tags is detected');
    const roofed=drawVillageCase('manor',{weather:true});roofed.G[1].tags[0]=1;
    assert.throws(()=>checkWallTags(roofed),/retain zero wall tags/,'weather-tagged roof is detected');
  });
  test('Rows upper gallery is genuinely traversable with a continuous walk floor',()=>{
    for(const [w,d] of [[1,1],[3,1],[1,3],[3,2]]) {
      const r=drawVillageCase('rows',{w,d});
      for(const v of [.66,.70,.75])assert.ok(clear(r,[.12,v,.51],[.88,v,.51]),'lateral covered gallery');
      for(const u of [.2,.5,.8]) {
        const hit=hits(r,point(r,u,.70,.55),point(r,u,.70,.30))[0];
        assert.ok(hit,'gallery has an actual walking floor');
        const height=(hit.point.y-r.y0)/r.H;
        assert.ok(height>=.35&&height<=.41,'gallery floor, rather than a false empty facade');
      }
    }
    for(let arena=0;arena<3;arena++) {
      const r=drawVillageCase('rows');infill(r,arena,[.48,.52,.65,.75,.48,.54]);
      assert.equal(clear(r,[.12,.70,.51],[.88,.70,.51]),false,'gallery infill rejected in arena '+arena);
    }
  });
  test('inn and manor entrance passages and courtyards stay open across all geometry arenas',()=>{
    for(const model of ['inn','manor'])for(const [w,d] of [[1,1],[3,1],[1,3],[3,2]]) {
      const r=drawVillageCase(model,{w,d}),end=model==='inn'?.45:.55,y=model==='inn'?.22:.20;
      for(const u of [.48,.50,.52])assert.ok(clear(r,[u,.95,y],[u,end,y]),model+' entrance to court');
      for(const u of [.38,.5,.62])for(const v of [.46,.52,.62])assert.ok(sky(r,u,v),model+' real open sky');
    }
    for(const model of ['inn','manor'])for(let arena=0;arena<3;arena++) {
      const r=drawVillageCase(model),end=model==='inn'?.45:.55,y=model==='inn'?.22:.20;
      infill(r,arena,[.45,.55,.77,.81,.10,.35]);
      assert.equal(clear(r,[.5,.95,y],[.5,end,y]),false,model+' entrance infill rejected in arena '+arena);
      const roofed=drawVillageCase(model);infill(roofed,arena,[.45,.55,.47,.57,.5,.52]);
      assert.equal(sky(roofed,.5,.52),false,model+' false courtyard roof rejected in arena '+arena);
    }
  });
  test('production whole-city geometry keeps three batches, exact A, unchanged non-building meshes and existing phone ceilings',()=>{
    let revisedModes=0;
    for(const id of ['seed516','ai120']) {
      const city=d058City(fs.readFileSync(path.join(ROOT,`src/content/samples/${id}.code.txt`),'utf8'));
      for(const mode of ['a','b','c']) {
        const world=sha(city),snapshots=[];
        for(const enabled of [false,true]) {
          const blocks={...d058Blocks(city,mode),villageArt:enabled},con=new ConState(city.n);
          const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
          try {
            assert.equal(built.buildingMeshes().length,3,'existing batch count');
            for(const mesh of built.meshStats().filter(m=>['walls','other','dress'].includes(m.name)))assert.equal(mesh.shadow,mesh.name!=='dress','existing shadow flags');
            if(enabled&&mode!=='a')villagePicks(built,city,blocks);
            snapshots.push({triangles:total(built),meshes:built.meshStats(),digest:digest(built)});
          } finally {built.dispose();con.dispose();}
        }
        assert.equal(sha(city),world,'art and comparison do not modify the world');
        const [before,after]=snapshots;
        assert.deepEqual(after.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),before.meshes.filter(m=>!['walls','other','dress'].includes(m.name)),'non-building submissions unchanged');
        assert.equal(after.digest.ground,before.digest.ground,'actual ground pixels unchanged');
        assert.deepEqual(after.digest.inst,before.digest.inst,'all existing trees keep exact transforms, colors and ages');
        if(mode==='a')assert.deepEqual(after,before,'A mode remains the exact density reference');
        else {
          assert.ok(after.triangles<=(id==='seed516'?118884:106365),id+' '+mode+' submitted triangles '+after.triangles);
          const blocks=d058Blocks(city,mode);
          const affected=blocks.plan.some(b=>villageBlock(blocks.recipe(b)))
            ||city.buildings.some(b=>b.goneDay===undefined&&villageKind(b.k));
          if(affected) {
            assert.notDeepEqual(after.digest.meshes,before.digest.meshes,'selected existing buildings really use D059 geometry');
            revisedModes++;
          }
        }
      }
    }
    assert.ok(revisedModes>0,'at least one decoded production sample exercises the new dispatch');
  });
  test('D059 mode changes invalidate cached production geometry and agree with fresh scene builds',()=>{
    const city=d058City(fs.readFileSync(path.join(ROOT,'src/content/samples/ai120.code.txt'),'utf8'));
    const world=sha(city),con=new ConState(city.n);let previous;
    try {
      for(const enabled of [false,true,false,true]) {
        const blocks={...d058Blocks(city),villageArt:enabled};
        const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con);
        previous?.dispose();previous=built;
        const freshCon=new ConState(city.n),fresh=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,freshCon,true);
        try {assert.deepEqual(digest(built),digest(fresh),'fresh/incremental villageArt='+enabled);}
        finally {fresh.dispose();freshCon.dispose();}
      }
      assert.equal(sha(city),world,'cache mode changes do not modify the world');
    } finally {previous?.dispose();con.dispose();}
  });
  test('production core weather reaches aCon, ConState wallTop and actual ages; non-core inn and facilities remain untagged',()=>{
    const city=d058City(d059ReviewCode()),world=sha(city),con=new ConState(city.n),blocks={...d058Blocks(city),villageArt:true};
    const built=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,con,true);
    try {
      assert.ok(built.con,'production construction metadata exists');
      con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(city,k=>KT.cat(k));
      assert.deepEqual(con.wallTop,built.con.wallTop,'ConState receives the actual generated wall heights');
      const wall=built.buildingMeshes()[0],p=wall.geometry.attributes.position,a=wall.geometry.attributes.aCon,owners=built.pickOwners()[0];
      assert.ok(a&&a.itemSize===3&&a.count===p.count,'real production vertices contain complete aCon attributes');
      const targets=new Map(),count=new Map();
      blocks.plan.forEach((b,bi)=>{const r=blocks.recipe(b);if(villageBlock(r))targets.set(-bi-1,{b,core:r.path==='core',model:villageBlock(r)});});
      for(const b of city.buildings)if(b.goneDay===undefined&&villageKind(b.k))targets.set(b.id,{b,core:false,model:villageKind(b.k)});
      let actualCoreTriangles=0;
      for(let t=0;t<owners.length;t++) {
        const target=targets.get(owners[t]);if(!target)continue;
        const tag=a.getZ(t*3);
        if(!target.core) {assert.equal(tag,0,target.model+' non-core weather behavior is preserved');continue;}
        if(tag===0)continue;
        actualCoreTriangles++;count.set(target.model,(count.get(target.model)??0)+1);
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
      for(const model of ['cottage','rows','manor'])assert.ok((count.get(model)??0)>0,model+' production weather is connected');
      assert.equal(built.weatherInfo().core,actualCoreTriangles,'current weather statistic counts actual tagged core triangles');
      assert.equal(built.weatherInfo().facade,0,'inn facade does not acquire invented core weather');
      const freshCon=new ConState(city.n),fresh=buildCityScene(city,KT,STYLES.A,blocks,'d',civic,freshCon,true);
      try {assert.deepEqual(digest(built),digest(fresh),'weather metadata agrees with a fresh production build');}
      finally {fresh.dispose();freshCon.dispose();}
      assert.equal(sha(city),world,'weather rendering preserves all city state');
    } finally {built.dispose();con.dispose();}
  });
  test('exact source scope reconstructs D058 and rejects injected mutations before historical reversal',()=>{
    assertD059Scope();
    const manifest=read('fixtures/d059-art-scope.json');
    for(const file of manifest.modified)assert.equal(createHash('sha256').update(d059HistoricalBytes(file)).digest('hex'),manifest.before[file],'historical bytes '+file);
    for(const target of ['src/sim/day.ts','src/io/save.ts','src/content/lab-kinds.json','src/content/lab-arche.json','src/render/britishCivicArt.ts','src/render/britishHeritageArt.ts','src/render/britishStreetArt.ts','src/render/britishVillageArt.ts','src/content/britishVillage.ts','src/render/cityScene.ts','src/cityView.ts']) {
      const mutation=file=>fs.readFileSync(path.join(ROOT,file),'utf8')+(file===target?'\n// unauthorized D059 mutation':'');
      assert.throws(()=>assertD059Scope(mutation),/exact allowed source/,target+' source mutation');
      assert.throws(()=>d059HistoricalBytes(target,mutation),/exact allowed source/,target+' historical-reader mutation');
    }
  });
  return failed;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await d059Guards((ok,name,detail)=>console.log(ok?'PASS':'FAIL',name,detail??''))?1:0;

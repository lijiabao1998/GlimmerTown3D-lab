// D072 independent Node frame oracle. Counts submitted base-city geometry, including the sun's shadow pass.
// This is not a renderer, screenshot, or browser-counter baseline. It never reads WebGL renderInfo.
// Usage: const o=createD072FrameOracle('seed516',true); o.measure({pos,target,zoom},{W,H}); o.dispose();
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest,meshDigest,hashOf} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {streetFrame} from '../src/content/britishStreets.ts';
import {D072_OLD,D072_KT,d072City,d072CampusCity,d072Blocks,d072Civic} from './unit-d072.mjs';

// Existing approved whole-scene counts. Frustum culling cannot relax or replace these pins.
// Legacy values are also checked against the immutable D071 native and copied-variant fixtures in unit-d072.mjs.
// Exact before/after pins measured independently from the production D071/D072 scene, not browser counters.
export const D072_FRAME_WHOLE=Object.freeze({
 native:Object.freeze({seed516:Object.freeze({legacy:112762,campus:112762}),gallery:Object.freeze({legacy:61302,campus:61080}),ai120:Object.freeze({legacy:95571,campus:95571})}),
 v0:Object.freeze({seed516:Object.freeze({legacy:112762,campus:112762}),gallery:Object.freeze({legacy:61302,campus:61080}),ai120:Object.freeze({legacy:95571,campus:95571})}),
 v1:Object.freeze({seed516:Object.freeze({legacy:112762,campus:112762}),gallery:Object.freeze({legacy:61302,campus:61220}),ai120:Object.freeze({legacy:95571,campus:95571})}),
 v2:Object.freeze({seed516:Object.freeze({legacy:112762,campus:112762}),gallery:Object.freeze({legacy:61302,campus:61010}),ai120:Object.freeze({legacy:95571,campus:95571})}),
});
const sum=rows=>rows.reduce((n,r)=>n+r,0);
const frozen=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))frozen(v);Object.freeze(value);}return value;};

// Match WebGLRenderer's indexed/non-indexed draw-range and group intersections, including zero-count draws.
function elements(g,group=null){
 const capacity=g.index?.count??g.attributes.position?.count;
 assert.ok(Number.isFinite(capacity),'frame oracle requires finite triangle geometry');
 let start=Math.max(0,g.drawRange.start),end=Math.min(capacity,g.drawRange.start+g.drawRange.count);
 if(group){start=Math.max(start,group.start);end=Math.min(end,group.start+group.count);}
 const count=end-start;
 if(count<0)return null;
 assert.ok(Number.isInteger(count)&&count%3===0,'triangle-aligned geometry draw range');
 return count;
}
function instances(m){
 const g=m.geometry,n=m.isInstancedMesh?m.count:g.isInstancedBufferGeometry?Math.min(g.instanceCount,g._maxInstanceCount??Infinity):1;
 assert.ok(Number.isInteger(n)&&n>=0,'finite nonnegative instance count');return n;
}
function rawTriangles(m){const count=elements(m.geometry);return count===null?0:count/3*instances(m);}
function submissions(m,shadow=false){
 assert.ok(!m.isBatchedMesh,'batched multi-draw meshes are outside this three-batch production scene');
 const groups=Array.isArray(m.material)?m.geometry.groups.map(g=>[m.material[g.materialIndex],g]):[[m.material,null]];
 let triangles=0,calls=0;const n=instances(m);
 if(n===0)return {triangles,calls};
 for(const [material,group] of groups){
  if(!material?.visible)continue;
  assert.ok(!material.wireframe,'wireframe geometry is outside the production triangle oracle');
  const count=elements(m.geometry,group);if(count===null)continue;
  // WebGLRenderer draws transparent DoubleSide materials twice unless forceSinglePass is set.
  const passes=!shadow&&material.transparent&&material.side===THREE.DoubleSide&&!material.forceSinglePass?2:1;
  triangles+=count/3*n*passes;calls+=passes;
 }
 return {triangles,calls};
}
function visibleInHierarchy(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
function cameraFor(n,view,viewport){
 assert.ok(view&&Array.isArray(view.pos)&&view.pos.length===3&&view.pos.every(Number.isFinite),'finite camera pos');
 assert.ok(Array.isArray(view.target)&&view.target.length===3&&view.target.every(Number.isFinite),'finite camera target');
 assert.ok(Number.isFinite(view.zoom)&&view.zoom>0,'positive finite camera zoom');
 assert.ok(Number.isFinite(viewport?.W)&&viewport.W>0&&Number.isFinite(viewport?.H)&&viewport.H>0,'positive finite CSS viewport');
 assert.ok(view.pos.some((v,i)=>v!==view.target[i]),'camera position differs from its target');
 // Exact cityView.resize/frameCamera projection. Supplied zoom is already settled, not reclamped here.
 const half=n*.42,aspect=viewport.W/viewport.H;
 const camera=new THREE.OrthographicCamera(-half*aspect,half*aspect,half,-half,.1,n*6);
 camera.position.fromArray(view.pos);camera.zoom=view.zoom;camera.lookAt(new THREE.Vector3().fromArray(view.target));
 camera.updateProjectionMatrix();camera.updateMatrixWorld(true);return camera;
}

// Existing production spin rotates the initial southeast view; no direct camera edits.
// This checks exact placement only. Actual PNGs remain the evidence for visual acceptance.
export function assertD072CampusCamera(actual,baseline,angle){
 for(const c of [actual,baseline])assert.ok(c.pos.length===3&&c.target.length===3&&[...c.pos,...c.target,c.zoom].every(Number.isFinite),'finite campus camera');
 assert.ok(Number.isFinite(angle)&&Math.abs(angle)>1e-8,'nonzero finite audited spin angle');
 assert.deepEqual(actual.target,baseline.target,'campus rotation preserves exact target');assert.equal(actual.zoom,baseline.zoom,'campus rotation preserves exact zoom');
 const b=baseline.pos.map((v,i)=>v-baseline.target[i]),a=actual.pos.map((v,i)=>v-actual.target[i]),c=Math.cos(angle),s=Math.sin(angle);
 assert.ok(b[0]>0&&b[2]>0,'campus starting view is southeast');
 const expected=[b[0]*c-b[2]*s,b[1],b[0]*s+b[2]*c];
 assert.ok(Math.max(...a.map((v,i)=>Math.abs(v-b[i])))>1e-6,'alternate differs from the original camera');
 for(let i=0;i<3;i++)assert.ok(Math.abs(a[i]-expected[i])<1e-9,'exact audited spin within floating-point camera arithmetic');
}

export function assertD072Frame(actual,expected,label='D072 base frame'){
 assert.equal(actual.triangles,expected.triangles,label+' triangles agree with independent scene/frustum oracle');
 assert.equal(actual.calls,expected.calls,label+' calls agree with independent scene/frustum oracle');
}

// cityView appends exactly two empty UI InstancedMeshes: placement preview, then hazard markers.
// Their absence, an extra entry, or any nonempty UI/tree transform is a mismatch; nothing is filtered.
export function assertD072BrowserGeometry(actual,expected,label='D072 browser geometry'){
 assert.ok(Array.isArray(actual?.instTransforms)&&Array.isArray(expected?.instTransforms),label+' instance transform arrays');
 assert.equal(actual.instTransforms.length,expected.instTransforms.length+2,label+' exactly two trailing UI instances');
 const empty='0:'+hashOf(new Float32Array(0));
 assert.deepEqual(actual.instTransforms.slice(expected.instTransforms.length),[empty,empty],label+' preview and hazard instances are exactly empty');
 assert.deepEqual(actual.instTransforms.slice(0,expected.instTransforms.length),expected.instTransforms,label+' all tree instance counts and transforms match');
 assert.deepEqual(actual.meshes,expected.meshes,label+' all building owner attributes and triangle counts match');
}

// Geometry-only visibility audit, independent of WebGL pixels and submission counters.
// Every building, tree and other visible production mesh remains in the ray test.
// No meshes are removed, hidden, moved, clipped or replaced for these measurements.
export function d072OwnerRayAudit({scene,meshes,owners,n},view,viewport,owner,grid=32){
 assert.ok(Number.isInteger(grid)&&grid>=20,'at least 20×20 owner silhouette samples');
 const camera=cameraFor(n,view,viewport),lo=[Infinity,Infinity],hi=[-Infinity,-Infinity],point=new THREE.Vector3(),ray=new THREE.Raycaster(),meshIndex=new Map(meshes.map((m,i)=>[m,i]));
 scene.updateMatrixWorld(true);
 let targetTriangles=0;
 meshes.forEach((mesh,mi)=>{const attr=mesh.geometry.attributes.position;for(let t=0;t<owners[mi].length;t++)if(owners[mi][t]===owner){targetTriangles++;for(let j=0;j<3;j++){
  point.fromBufferAttribute(attr,t*3+j).applyMatrix4(mesh.matrixWorld).project(camera);for(let k=0;k<2;k++){const v=k?point.y:point.x;lo[k]=Math.min(lo[k],v);hi[k]=Math.max(hi[k],v);}
 }}});
 assert.ok(targetTriangles>0&&lo.every(Number.isFinite)&&hi.every(Number.isFinite),'requested owner has finite visible model bounds');
 const fitsViewport=lo.every(v=>v>=-1)&&hi.every(v=>v<=1);
 assert.ok(fitsViewport,'entire owner model fits the production camera viewport');
 const objects=[];scene.traverse(o=>{if(o.isMesh&&visibleInHierarchy(o)&&o.layers.test(camera.layers))objects.push(o);});
 let targetRays=0,visibleRays=0;const blockers={};
 const ownerOf=hit=>meshIndex.has(hit.object)?owners[meshIndex.get(hit.object)][hit.faceIndex]:'other:'+hit.object.type;
 for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){
  ray.setFromCamera(new THREE.Vector2(lo[0]+(x+.5)/grid*(hi[0]-lo[0]),lo[1]+(y+.5)/grid*(hi[1]-lo[1])),camera);
  const hits=ray.intersectObjects(objects,false),target=hits.find(hit=>ownerOf(hit)===owner);
  if(!target)continue;targetRays++;
  if(ownerOf(hits[0])===owner)visibleRays++;
  else {const key=ownerOf(hits[0]);blockers[key]=(blockers[key]??0)+1;}
 }
 assert.ok(targetRays>0,'owner silhouette has actual target intersections');
 return {owner,grid,targetTriangles,targetRays,visibleRays,blockedRays:targetRays-visibleRays,blockers,projectedBounds:{lo,hi},fitsViewport,unoccluded:targetRays===visibleRays};
}

// Inspect the four actual repaired k115:v0 portico roof triangles, independently
// of the whole-owner silhouette. Float32 coordinate tolerance selects the patch;
// it never changes a vertex, normal, owner or geometry-comparison threshold.
export function d072PorticoRayAudit({scene,meshes,owners,city},view,viewport){
 const b=city.buildings.find(b=>b.k===115&&b.v===0);assert.ok(b,'original k115:v0 owner exists');
 const H=Math.max(.12,D072_KT.height(b.k,b.lv,b.v)),epsilon=1e-5,roof=meshes[1],position=roof.geometry.attributes.position,normal=roof.geometry.attributes.normal;
 let y0=Infinity;meshes.forEach((m,i)=>{const p=m.geometry.attributes.position;for(let t=0;t<owners[i].length;t++)if(owners[i][t]===b.id)for(let j=0;j<3;j++)y0=Math.min(y0,p.getY(t*3+j));});
 const slopes={west:[],east:[]},vertices=new Map();
 for(let t=0;t<owners[1].length;t++)if(owners[1][t]===b.id&&normal.getY(t*3)>.1&&Math.abs(normal.getX(t*3))>.1){
  const vs=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(position,t*3+j));
  if(vs.every(p=>p.x>=b.x+b.size*.33-epsilon&&p.x<=b.x+b.size*.67+epsilon&&p.z>=b.z+b.size*.65-epsilon&&p.z<=b.z+b.size*.811+epsilon&&p.y>=y0+H*.415-epsilon&&p.y<=y0+H*.53+epsilon)){
   slopes[normal.getX(t*3)<0?'west':'east'].push(t);vertices.set(t,vs);
  }
 }
 assert.equal(slopes.west.length,2,'portico has exactly two actual west slope triangles');assert.equal(slopes.east.length,2,'portico has exactly two actual east slope triangles');
 const camera=cameraFor(city.n,view,viewport),ray=new THREE.Raycaster(),objects=[],samples=[];
 scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isMesh&&visibleInHierarchy(o)&&o.layers.test(camera.layers))objects.push(o);});
 for(const [side,triangles] of Object.entries(slopes))for(const triangle of triangles){
  const vs=vertices.get(triangle);let visibleSamples=0;
  for(const weights of [[.2,.3,.5],[.5,.2,.3],[.3,.5,.2]]){
   const p=new THREE.Vector3();vs.forEach((v,i)=>p.addScaledVector(v,weights[i]));p.applyMatrix4(roof.matrixWorld).project(camera);
   assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1,'each repaired roof sample fits the original viewport');
   ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);const first=ray.intersectObjects(objects,false)[0];
   if(first?.object===roof&&first.faceIndex===triangle)visibleSamples++;
  }
  samples.push({side,triangle,visibleSamples,totalSamples:3});
 }
 return {owner:b.id,slopes,samples,fullyVisibleTriangles:samples.filter(s=>s.visibleSamples===s.totalSamples).map(s=>s.triangle),qualification:'Independent actual-surface ray audit; original scene objects and camera clipping remain unchanged.'};
}

export function assertD072PausedRepeat(actual,initial){
 for(const key of ['sha256','canvasSha256','worldSha256']){assert.match(initial[key],/^[0-9a-f]{64}$/,'original '+key+' is recorded');assert.equal(actual[key],initial[key],'paused repeat exact '+key);}
 for(const key of ['camera','presentation','render','renderAll','width','height','bytes']){assert.notEqual(initial[key],undefined,'original '+key+' is recorded');assert.deepEqual(actual[key],initial[key],'paused repeat exact '+key);}
}

export function createD072FrameOracle(sample,on,force=null){
 assert.ok(['seed516','gallery','ai120'].includes(sample),'known immutable D072 sample');
 assert.ok(force===null||[0,1,2].includes(force),'native or supported copied campus preview');
 assert.equal(typeof on,'boolean','campus artwork phase must be boolean');
 const variant=force===null?'native':'v'+force,phase=on?'campus':'legacy',pin=D072_FRAME_WHOLE[variant][sample][phase];
 assert.equal(D072_FRAME_WHOLE[variant][sample].legacy,D072_OLD[variant][sample].c[0],'immutable whole-scene legacy baseline');
 // Match the forced saved-variant showcase: copy only target v fields, never mutate a saved world.
 const city=d072CampusCity(d072City(sample),force),blocks=d072Blocks(city),con=new ConState(city.n);
 let built,disposed=false;
 const dispose=()=>{if(!disposed){disposed=true;try{built?.dispose();}finally{con.dispose();}}};
 try{
  built=buildCityScene(city,D072_KT,STYLES.A,blocks,'d',d072Civic(on),con,true);
  const beforeSync=sceneDigest(built);
  // Match the static sample's construction setup. Uniform/age updates do not change model aCon attributes.
  if(built.con)con.setGeometry(built.con.top,built.con.base,built.con.wallTop);
  con.setCity(city,k=>D072_KT.cat(k));built.setTreeAges(i=>con.siteAge(i));
  con.uni.uDayFrac.value=0;con.uni.uTime.value=2.2;
  const scene=built.scene,initialMeshes=[],names=new Map();
  scene.traverse(o=>{if(o.isMesh)initialMeshes.push(o);});
  const stats=built.meshStats();initialMeshes.forEach((m,i)=>names.set(m,stats[i].name));
  const whole=()=>{
   const rows=[];scene.traverse(m=>{if(m.isMesh)rows.push(rawTriangles(m)*(m.castShadow?2:1));});
   const total=sum(rows);
   assert.equal(total,pin,`${sample} ${phase}: immutable whole-scene triangle budget (before culling)`);
   assert.equal(total,sum(built.meshStats().map(m=>m.tris*(m.shadow?2:1))),'raw geometry agrees with existing whole-scene metric');
   return total;
  };
  whole();
  const digest=sceneDigest(built);
  assert.deepEqual(digest.meshes,beforeSync.meshes,'static construction sync preserves every building vertex attribute, including aCon');
  assert.deepEqual(digest.inst.map(s=>s.split(':').slice(0,2).join(':')),beforeSync.inst.map(s=>s.split(':').slice(0,2).join(':')),'construction sync preserves instance counts and transforms');
  const geometry=frozen({
   meshes:Object.fromEntries(Object.entries(digest.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),
   instTransforms:digest.inst.map(s=>s.split(':').slice(0,2).join(':')),
  });
  const modelMeshes=built.buildingMeshes(),modelOwners=built.pickOwners(),meshNames=['walls','other','dress'];
  const normalSpecs=frozen(Object.fromEntries(meshNames.map((name,i)=>{
   const g=modelMeshes[i].geometry,a=g.attributes.normal,start=g.drawRange.start*a.itemSize;
   return [name,{capacity:a.array.length,start,length:Math.min(g.attributes.position.count-g.drawRange.start,g.drawRange.count)*a.itemSize,hash:digest.meshes[name].attrs.normal}];
  })));
  // D060 bottleKilns, hexagon face i=4: analytically zero local x becomes world z under turn 1.
  // This no-target city retains the exact diagnosed D067 owner span in every D072 phase/preview.
  const eligible=[];
  if(sample==='seed516'){
   const bk=blocks.plan[97];
   assert.deepEqual([bk.x,bk.z,bk.w,bk.h,bk.k,bk.lv,bk.v],[35,17,1,2,3,3,7],'exact diagnosed existing D060 kiln parcel');
   assert.equal(blocks.recipe(bk).arche,'chimneyHall','diagnosed D060 bottle-kiln archetype');
   assert.equal(streetFrame(city,bk).turn,1,'diagnosed local-x normal maps to world z');
   const ow=modelOwners[1],start=ow.findIndex(o=>o===-98),end=ow.lastIndexOf(-98);
   assert.equal(end-start+1,88,'exact diagnosed kiln other-mesh span');
   assert.ok(start>=0&&ow.subarray(start,end+1).every(o=>o===-98),'contiguous diagnosed owner span');
   for(const t of [12,13,24,25,54,55])for(let v=0;v<3;v++)eligible.push((start+t)*9+v*3+2);
  }
  const zeroBound=1e-15;
  const assertBrowserGeometry=(actual,normalBits={})=>{
   assert.ok(!disposed,'frame oracle has not been disposed');
   assert.deepEqual(sceneDigest(built).meshes,digest.meshes,'raw Node model still equals its immutable geometry snapshot');
   const clones=[],canonicalNode={},canonicalBrowser={},raw={},normalized=[];
   try{
    assert.deepEqual(Object.keys(actual.meshes),meshNames,'exact browser building mesh names');
    assert.ok(normalBits&&typeof normalBits==='object','uploaded normal words keyed by mesh');
    for(const name of Object.keys(normalBits))assert.ok(meshNames.includes(name),'known uploaded normal mesh');
    for(const [i,name] of meshNames.entries()){
     const nd=digest.meshes[name],bd=actual.meshes[name],spec=normalSpecs[name],source=modelMeshes[i].geometry,owners=modelOwners[i];
     assert.deepEqual(Object.keys(bd.attrs),Object.keys(nd.attrs),name+' exact attribute names');
     for(const key of ['tris','holes','owners','ownerTris'])assert.deepEqual(bd[key],nd[key],name+' exact '+key);
     for(const [key,hash] of Object.entries(nd.attrs))if(key!=='normal')assert.equal(bd.attrs[key],hash,name+' byte-exact '+key);
     const node=source.clone(),browser=source.clone();clones.push(node,browser);
     const na=node.attributes.normal.array,ba=browser.attributes.normal.array,words=normalBits[name];
     if(words===undefined)assert.equal(bd.attrs.normal,nd.attrs.normal,name+' changed normal hash requires actual uploaded words');
     else{
      assert.ok(Array.isArray(words)||words instanceof Uint32Array,name+' uploaded Uint32 words');
      assert.equal(words.length,spec.length,name+' complete live uploaded normal array');
      for(const word of words)assert.ok(Number.isInteger(word)&&word>=0&&word<=0xffffffff,name+' valid raw Uint32 word');
      new Uint32Array(ba.buffer,ba.byteOffset+spec.start*4,spec.length).set(words);
     }
     for(let j=spec.start;j<spec.start+spec.length;j++)assert.ok(Number.isFinite(na[j])&&Number.isFinite(ba[j]),name+' finite normal components');
     const rawBrowser=meshDigest({geometry:browser},owners);
     assert.deepEqual(rawBrowser,bd,name+' raw uploaded normals reconstruct full browser mesh/per-owner digest');
     raw[name]={node:nd.byOwner,browser:bd.byOwner,nodeNormal:nd.attrs.normal,browserNormal:bd.attrs.normal,equal:nd.byOwner===bd.byOwner};
     if(name==='other')for(const index of eligible){
      assert.ok(index>=spec.start&&index<spec.start+spec.length,'eligible normal is inside the live range');
      assert.equal(owners[Math.floor(index/9)],-98,'eligible normal belongs to the diagnosed kiln');
      assert.ok(Math.abs(na[index])<=zeroBound&&Math.abs(ba[index])<=zeroBound,'diagnosed normal residual stays within 1e-15');
      if(new Uint32Array(na.buffer,na.byteOffset+index*4,1)[0]!==new Uint32Array(ba.buffer,ba.byteOffset+index*4,1)[0])normalized.push({index,triangle:Math.floor(index/9),owner:-98,node:na[index],browser:ba[index]});
      na[index]=0;ba[index]=0;
     }
     canonicalNode[name]=meshDigest({geometry:node},owners);canonicalBrowser[name]=meshDigest({geometry:browser},owners);
     assert.deepEqual(canonicalBrowser[name],canonicalNode[name],name+' full canonical mesh/per-owner geometry equality');
    }
    const project=meshes=>Object.fromEntries(Object.entries(meshes).map(([name,m])=>[name,[m.byOwner,m.ownerTris]]));
    assertD072BrowserGeometry({meshes:project(canonicalBrowser),instTransforms:actual.inst.map(s=>s.split(':').slice(0,2).join(':'))},
     {meshes:project(canonicalNode),instTransforms:geometry.instTransforms},'D072 canonical browser geometry');
    return {raw,canonical:Object.fromEntries(meshNames.map(name=>[name,canonicalNode[name].byOwner])),
     canonicalization:{bound:zeroBound,sample,owner:sample==='seed516'?-98:null,eligibleComponents:eligible.length,changedComponents:normalized.length,changes:normalized},rawNodePreserved:true};
   }finally{
    for(const clone of clones)clone.dispose();
    assert.deepEqual(sceneDigest(built).meshes,digest.meshes,'comparison never mutates any raw Node geometry attribute or owner');
   }
  };
  const measure=(view,viewport)=>{
   assert.ok(!disposed,'frame oracle has not been disposed');
   const wholeTriangles=whole(),camera=cameraFor(city.n,view,viewport);
   scene.updateMatrixWorld(true);
   const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),camera.coordinateSystem,camera.reversedDepth);
   const suns=[];scene.traverseVisible(o=>{if(o.isLight&&o.castShadow&&o.layers.test(camera.layers))suns.push(o);});
   assert.equal(suns.length,1,'one existing production shadow light');
   const sun=suns[0];assert.ok(sun.isDirectionalLight,'existing directional sun');assert.equal(sun.shadow.getViewportCount(),1,'one shadow viewport');
   sun.shadow.camera.updateProjectionMatrix();sun.shadow.updateMatrices(sun,camera);
   const shadowFrustum=sun.shadow.getFrustum(),meshes=[];
   scene.traverse(m=>{
    if(!m.isMesh)return;
    const visible=visibleInHierarchy(m)&&m.layers.test(camera.layers),mainCost=submissions(m),shadowCost=submissions(m,true);
    const mainIn=visible&&(!m.frustumCulled||m.intersectsFrustum(frustum));
    const shadowIn=visible&&m.castShadow&&(!m.frustumCulled||m.intersectsFrustum(shadowFrustum));
    meshes.push({name:names.get(m)??m.name??'additional-mesh',geometryType:m.geometry.type,instances:instances(m),triangles:rawTriangles(m),castShadow:m.castShadow,
     main:{triangles:mainIn?mainCost.triangles:0,calls:mainIn?mainCost.calls:0,culled:visible&&!mainIn,reason:!visible?'hidden-or-layer':!mainIn?'frustum':null},
     shadow:{triangles:shadowIn?shadowCost.triangles:0,calls:shadowIn?shadowCost.calls:0,culled:visible&&m.castShadow&&!shadowIn,reason:!m.castShadow?'does-not-cast':!visible?'hidden-or-layer':!shadowIn?'frustum':null},
    });
   });
   const main={triangles:sum(meshes.map(m=>m.main.triangles)),calls:sum(meshes.map(m=>m.main.calls))};
   const shadow={triangles:sum(meshes.map(m=>m.shadow.triangles)),calls:sum(meshes.map(m=>m.shadow.calls))};
   const triangles=main.triangles+shadow.triangles,calls=main.calls+shadow.calls;
   assert.ok(triangles<=wholeTriangles,'frustum passes cannot exceed unchanged whole-scene budget');
   return {sample,variant,phase,triangles,calls,wholeTriangles,culledTriangles:wholeTriangles-triangles,main,shadow,
    culled:meshes.filter(m=>m.main.culled||m.shadow.culled),meshes};
  };
  // scene is diagnostic read-only in production; negative-control tests deliberately inject and restore a triangle.
  return {sample,on,force,variant,n:city.n,wholeTriangles:pin,geometry,normalSpecs,assertBrowserGeometry,scene,measure,
   ownerVisibility:(view,viewport,owner,grid=32)=>d072OwnerRayAudit({scene,meshes:modelMeshes,owners:modelOwners,n:city.n},view,viewport,owner,grid),
   porticoVisibility:(view,viewport)=>d072PorticoRayAudit({scene,meshes:modelMeshes,owners:modelOwners,city},view,viewport),dispose};
 }catch(error){dispose();throw error;}
}

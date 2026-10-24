// D082 independent Node scene/frustum oracle; never derives budgets from browser counters.
// Generic submission arithmetic preserves the D081 policy without modifying its classifier.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest,meshDigest} from '../src/render/digest.ts';
import {STYLES} from '../src/render/styles.ts';
import {streetFrame} from '../src/content/britishStreets.ts';
import {signature} from './d060-baseline.mjs';
import {D082_KT,D082_SLOTS,d082City,d082CoastalCity,d082Blocks,d082Civic} from './unit-d082.mjs';
import {d081ConstructionDiagnostic as d082ConstructionDiagnostic,d081OwnerConstruction as d082OwnerConstruction,d081OwnerBounds as d082OwnerBounds,assertD081BrowserGeometry as assertD082BrowserGeometry,d081PlannedConstructionCamera,d081DetailAlpha} from './d081-frame.mjs';
export {assertD081Frame as assertD082Frame,assertD081PausedRepeat as assertD082PausedRepeat,assertD081OwnerConstruction as assertD082OwnerConstruction,assertD081OwnerFits as assertD082OwnerFits} from './d081-frame.mjs';
const baselineBytes=fs.readFileSync(new URL('../fixtures/d082-geometry-before.json',import.meta.url));assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'98f9d7d0bdb219fe4fe1ff2cfd1791f04b49fcc5e62da2833bef6dfeb228ae68');
const D082_OLD=JSON.parse(baselineBytes).cities;
export const D082_FRAME_WHOLE=frozen({"native":{"seed516":{"legacy":112758,"coastalRecreation":112758},"ai120":{"legacy":95505,"coastalRecreation":95505},"gallery":{"legacy":60236,"coastalRecreation":59802}},"v0":{"seed516":{"legacy":112758,"coastalRecreation":112758},"ai120":{"legacy":95505,"coastalRecreation":95505},"gallery":{"legacy":60236,"coastalRecreation":59802}},"v1":{"seed516":{"legacy":112758,"coastalRecreation":112758},"ai120":{"legacy":95505,"coastalRecreation":95505},"gallery":{"legacy":60236,"coastalRecreation":59782}},"v2":{"seed516":{"legacy":112758,"coastalRecreation":112758},"ai120":{"legacy":95505,"coastalRecreation":95505},"gallery":{"legacy":60236,"coastalRecreation":59806}}});
const sum=rows=>rows.reduce((n,r)=>n+r,0);
function frozen(value){if(value&&typeof value==='object'){for(const v of Object.values(value))frozen(v);Object.freeze(value);}return value;}

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

export function createD082FrameOracle(sample,on,force=null){
 assert.ok(['seed516','gallery','ai120'].includes(sample),'known immutable D082 sample');
 assert.ok(force===null||[0,1,2].includes(force),'native or supported copied coastalRecreation preview');
 assert.equal(typeof on,'boolean','coastalRecreation artwork phase must be boolean');
 const variant=force===null?'native':'v'+force,phase=on?'coastalRecreation':'legacy',pin=D082_FRAME_WHOLE[variant][sample][phase];
 assert.equal(D082_FRAME_WHOLE[variant][sample].legacy,D082_OLD[variant][sample].c[0],'immutable whole-scene legacy baseline');
 // Match the forced saved-variant showcase: copy only target v fields, never mutate a saved world.
 const city=d082CoastalCity(d082City(sample),force),blocks=d082Blocks(city),con=new ConState(city.n);
 let built,disposed=false;
 const dispose=()=>{if(!disposed){disposed=true;try{built?.dispose();}finally{con.dispose();}}};
 try{
  built=buildCityScene(city,D082_KT,STYLES.A,blocks,'d',d082Civic(on),con,true);
  if(!on)assert.equal(signature(built),D082_OLD[variant][sample].c[1],"exact independent git-archive D081 scene signature, not an opt-out self-baseline");
  const beforeSync=sceneDigest(built);
  // Match the static sample's construction setup. Uniform/age updates do not change model aCon attributes.
  if(built.con)con.setGeometry(built.con.top,built.con.base,built.con.wallTop);
  con.setCity(city,k=>D082_KT.cat(k));built.setTreeAges(i=>con.siteAge(i));
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
  // This original city retains the exact diagnosed D067 owner span in every D082 phase/preview.
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
    assertD082BrowserGeometry({meshes:project(canonicalBrowser),instTransforms:actual.inst.map(s=>s.split(':').slice(0,2).join(':'))},
     {meshes:project(canonicalNode),instTransforms:geometry.instTransforms},'D082 canonical browser geometry');
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
   constructionDiagnostic:()=>d082ConstructionDiagnostic(scene,con),
   ownerConstruction:(owner,contract=null)=>d082OwnerConstruction(city,con,owner,contract),
   ownerBounds:(view,viewport,owner)=>d082OwnerBounds({scene,meshes:modelMeshes,owners:modelOwners,n:city.n},view,viewport,owner),
   dispose};
 }catch(error){dispose();throw error;}
}

export const D082_PAUSED_UNIFORMS=frozen({uDayFrac:0,uTime:2.2,uDetail:0,uProbe:[-1,-1],uNoClip:0});
export function d082CameraDetail(n,shot,viewport,actualCamera){
 assert.ok([[360,740],[412,860],[1440,1000]].some(([W,H])=>viewport.W===W&&viewport.H===H),'declared viewport');
 const plannedCamera=d081PlannedConstructionCamera(n,shot,viewport);
 assert.equal(actualCamera.zoom,plannedCamera.zoom,'unchanged independently planned zoom');
 for(const field of ['pos','target'])for(let i=0;i<3;i++)assert.ok(Number.isFinite(actualCamera[field][i])&&Math.abs(actualCamera[field][i]-plannedCamera[field][i])<1e-9,'settled original '+field+' agrees with independent camera arithmetic');
 const labZoom=Math.SQRT2*viewport.H*plannedCamera.zoom/(n*.84)/64;
 return {n,viewport,plannedCamera,observedCamera:actualCamera,labZoom,uDetail:d081DetailAlpha(labZoom)};
}
export function assertD082ConstructionDiagnostic(actual,expected,context){
 assert.ok(context,'independent camera context required');
 const cameraDetail=d082CameraDetail(context.n,context.shot,context.viewport,context.camera);
 assert.deepEqual(context.actualViewport,cameraDetail.viewport);assert.equal(context.labZoom,cameraDetail.labZoom);assert.equal(context.uDetail,cameraDetail.uDetail);
 assert.deepEqual(expected.uniforms,D082_PAUSED_UNIFORMS,'Node paused construction state');
 assert.deepEqual(actual.uniforms,{...D082_PAUSED_UNIFORMS,uDetail:cameraDetail.uDetail},'actual time, clipping, probe and camera-derived detail');
 assert.deepEqual(actual.trees,expected.trees,'all ordered actual live tree ages/transforms');
 return {cameraDetail,uniforms:actual.uniforms,treeBuffersExact:true};
}
export function assertD082FrameBudget(after,before,label='D082 paired frame'){
 for(const key of ['triangles','calls','wholeTriangles']){assert.ok(Number.isFinite(after[key])&&Number.isFinite(before[key]),'finite '+key);assert.ok(after[key]<=before[key],label+' '+key+' must not grow: '+after[key]+' <= '+before[key]);}
}

export function d082RuntimeFrameGuards(){
 const report={passed:false,scenePairs:0,viewPairs:0,negativeControls:0,scenes:[]};
 for(const sample of ['seed516','ai120','gallery'])for(const force of [null,0,1,2]){
  const before=createD082FrameOracle(sample,false,force),after=createD082FrameOracle(sample,true,force);
  try{
   const city=d082CoastalCity(d082City(sample),force),targets=city.buildings.filter(b=>D082_SLOTS.some(([k,v])=>k===b.k&&v===b.v)),shots=[{x:city.n/2,z:city.n/2,size:city.n},...targets.map(b=>({k:b.k,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size}))];
   assert.ok(after.wholeTriangles<=before.wholeTriangles,'immutable whole-scene cap remains strict');
   assert.deepEqual(after.constructionDiagnostic().uniforms,D082_PAUSED_UNIFORMS);assert.deepEqual(before.constructionDiagnostic().uniforms,D082_PAUSED_UNIFORMS);
   assert.deepEqual(after.constructionDiagnostic().trees,before.constructionDiagnostic().trees,'all live tree buffers stay unchanged across artwork phase');
   for(const viewport of [{W:360,H:740},{W:412,H:860},{W:1440,H:1000}])for(const shot of shots){
    const camera=d081PlannedConstructionCamera(city.n,shot,viewport),a=before.measure(camera,viewport),b=after.measure(camera,viewport);assertD082FrameBudget(b,a,sample+' '+force);assert.deepEqual(before.measure(camera,viewport),a,'repeat Node before frame');assert.deepEqual(after.measure(camera,viewport),b,'repeat Node after frame');
    const d=d082CameraDetail(city.n,shot,viewport,camera),diagnostic=after.constructionDiagnostic(),actual={...diagnostic,uniforms:{...diagnostic.uniforms,uDetail:d.uDetail}},context={n:city.n,shot,viewport,camera,actualViewport:viewport,labZoom:d.labZoom,uDetail:d.uDetail};assertD082ConstructionDiagnostic(actual,diagnostic,context);
    for(const field of ['uTime','uDayFrac','uDetail','uNoClip']){const corrupt=structuredClone(actual);corrupt.uniforms[field]+=.125;assert.throws(()=>assertD082ConstructionDiagnostic(corrupt,diagnostic,context),'changed '+field+' fails');report.negativeControls++;}
    const badCamera=structuredClone(camera);badCamera.target[0]+=.01;assert.throws(()=>d082CameraDetail(city.n,shot,viewport,badCamera),'changed original camera fails');report.negativeControls++;
    for(const key of ['triangles','calls','wholeTriangles']){assert.throws(()=>assertD082FrameBudget({...b,[key]:a[key]+1},a),'frame '+key+' growth fails');report.negativeControls++;}
    report.viewPairs++;
   }
   for(const b of targets){for(const oracle of [before,after]){const state=oracle.ownerConstruction(b.id);assert.equal(state.originalAge,400);assert.equal(state.complete,true);assert.equal(state.clippedCount,0);assert.equal(state.tiles.length,b.size*b.size);for(const tile of state.tiles)assert.equal(tile.age,400);}}
   const extra=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3)),new THREE.MeshBasicMaterial());after.scene.add(extra);
   try{assert.throws(()=>after.measure(d081PlannedConstructionCamera(city.n,shots[0],{W:360,H:740}),{W:360,H:740}),/whole-scene triangle budget/,'added geometry cannot hide behind camera culling');report.negativeControls++;}finally{after.scene.remove(extra);extra.geometry.dispose();extra.material.dispose();}
   report.scenes.push({sample,force,before:before.wholeTriangles,after:after.wholeTriangles,targets:targets.length});report.scenePairs++;
  }finally{before.dispose();after.dispose();}
 }
 assert.equal(report.scenePairs,12);assert.equal(report.viewPairs,84);report.passed=true;return report;
}

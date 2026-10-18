// D077 camera-specific draw oracle guards. Node only; no browser counters, renderer, network, or output files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {createD077FrameOracle,assertD077Frame,assertD077ServiceLodgeCamera,assertD077BrowserGeometry,d077OwnerRayAudit,d077RoofRayAudit,assertD077RoofCoverage,assertD077PausedRepeat,d077OwnerSurfaceContract,d077OwnerSurfaceRayAudit,assertD077SurfaceCoverage,D077_FRAME_WHOLE,D077_FRAME_VIEW_PINS,d077RayObjects,d077RayHits,d077OwnerBoxWitnesses,d077OwnerClosedComponents,d077OwnerBounds,assertD077OwnerFits,fitD077PairedOwnerView} from './d077-frame.mjs';
import {hashOf,sceneDigest,meshDigest} from '../src/render/digest.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';
import {FACILITY_TOOLS} from '../src/sim/edit.ts';
import {D077_OLD,D077_KT,d077City,d077ServiceLodgeCity,d077Blocks,d077Civic,d077Expected} from './unit-d077.mjs';

import {D077_CAPTURE_SOURCES,D077_SLOTS,D077_ALTERNATE_VIEWS,D077_REPEAT_SLOTS,d077CapturePlan,d077CaptureQuery,assertD077CaptureUrl,assertD077OriginalViewCount,d077CameraZoom} from './d077-capture.mjs';

const VIEWPORTS=[{W:1440,H:1000},{W:360,H:740},{W:412,H:860}];
const live=(c,b)=>b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=c.n&&b.z+b.size<=c.n;
function cameraFor(n,shot,v){
 const D=n*1.6,target=[shot.x,0,shot.z];
 // __gt.view sets this pose; OrbitControls subsequently clamps overview zoom to its actual .6 minimum.
 const requested=shot.additionalView?shot.zoomByWidth[v.W]:shot.k?Math.min(8,.70*.84*n*(v.W/v.H)/(shot.size*Math.SQRT2)):.54*v.W/v.H;
 const a=shot.spinRadians??0,c=Math.cos(a),s=Math.sin(a);
 if(!shot.tiltRadians)return {pos:[shot.x+D*(c-s),D*Math.SQRT2*Math.tan(Math.PI/6),shot.z+D*(s+c)],target,zoom:Math.max(.6,requested)};
 const radius=D*Math.sqrt(2+2*Math.tan(Math.PI/6)**2),elevation=Math.PI/6+(shot.tiltRadians??0),horizontal=radius*Math.cos(elevation)/Math.SQRT2;
 return {pos:[shot.x+horizontal*(c-s),radius*Math.sin(elevation),shot.z+horizontal*(s+c)],target,zoom:Math.max(.6,requested)};
}
// Independent production data for comparisons; mutations are confined to disposable test clones.
function browserFixture(sample,on,force=null){
 const source=d077City(sample),city=d077ServiceLodgeCity(source,force),con=new ConState(city.n),built=buildCityScene(city,D077_KT,STYLES.A,d077Blocks(city),'d',d077Civic(on),con,true);
 con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(city,k=>D077_KT.cat(k));built.setTreeAges(i=>con.siteAge(i));
 const digest=sceneDigest(built),empty='0:'+hashOf(new Float32Array(0));digest.inst.push(empty+':-:-',empty+':-:-');
 const names=['walls','other','dress'],meshes=built.buildingMeshes(),owners=built.pickOwners();
 const change=(name,fn)=>{
  const i=names.indexOf(name),g=meshes[i].geometry.clone(),ow=owners[i].slice();
  try{fn(g,ow);const actual=structuredClone(digest);actual.meshes[name]=meshDigest({geometry:g},ow);
   const a=g.attributes.normal.array,start=g.drawRange.start*3,end=Math.min(g.attributes.position.count,g.drawRange.start+g.drawRange.count)*3;
   return {actual,words:{[name]:Array.from(new Uint32Array(a.buffer,a.byteOffset+start*4,end-start))}};
  }finally{g.dispose();}
 };
 return {digest,change,meshes,owners,city,scene:built.scene,n:city.n,start:owners[1].findIndex(o=>o===-98),dispose:()=>{built.dispose();con.dispose();}};
}
export async function d077FrameGuards(log=()=>{}){
 let failed=0;const report={sourceRef:process.env.GITHUB_SHA??'local D077 candidate',baseline:'7d4df8a907368a25f1ff92958b8b70ae85b8ad1c',cardSha256:createHash('sha256').update(fs.readFileSync(new URL('../docs/D077-british-service-lodges-ten.md',import.meta.url))).digest('hex'),frameSourceSha256:createHash('sha256').update(fs.readFileSync(new URL('./d077-frame.mjs',import.meta.url))).digest('hex'),captureSourceSha256:createHash('sha256').update(fs.readFileSync(new URL('./d077-capture.mjs',import.meta.url))).digest('hex'),qualification:'Independent Node geometry/frustum oracle tests; not WebGL screenshot evidence.',tests:[],frames:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D077 frame '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D077 frame '+name,e.stack??String(e));}};
 test('complete surface classifier and geometric witnesses are exactly the unchanged D076 policy',()=>{
  const old=fs.readFileSync(new URL('./d076-frame.mjs',import.meta.url),'utf8'),now=fs.readFileSync(new URL('./d077-frame.mjs',import.meta.url),'utf8');
  const section=(code,prefix)=>code.slice(code.indexOf('export function '+prefix+'OwnerClosedComponents'),code.indexOf('export function assert'+prefix.toUpperCase()+'PausedRepeat'));
  assert.equal(section(now,'d077').replaceAll('D077','D076').replaceAll('d077','d076'),section(old,'d076'),'no altered classifier, failed-search exclusion, geometric proof or tolerance');
 });
 test('whole-scene pins equal immutable D076 native/copied baselines and d077Expected',()=>{
  const expected=d077Expected();
  for(const variant of ['native','v0','v1','v2','v4'])for(const sample of ['gallery','seed516','ai120']){
   assert.equal(expected[variant][sample].legacy,D077_OLD[variant][sample].c[0]);
   for(const phase of ['legacy','serviceLodge'])assert.equal(expected[variant][sample][phase],D077_FRAME_WHOLE[variant][sample][phase]);
   assert.ok(expected[variant][sample].serviceLodge<=expected[variant][sample].legacy);
  }
 });
 test('frame oracle permits only original samples, explicit phases and null or integer variants zero, one, two or four',()=>{
  for(const force of [-1,3,2.5,NaN,Infinity,'0'])assert.throws(()=>createD077FrameOracle('gallery',true,force),/supported copied serviceLodge/);
  for(const sample of ['manufactured','gallery-copy',''])assert.throws(()=>createD077FrameOracle(sample,true,0),/known immutable D077 sample/);
  for(const on of [null,undefined,0,1,'after'])assert.throws(()=>createD077FrameOracle('gallery',on,0),/phase must be boolean/);
 });
 test('actual capture path selects legacy BEFORE and default serviceLodge AFTER without inherited legacy flags',()=>{
  const capture=fs.readFileSync(new URL('./d077-capture.mjs',import.meta.url),'utf8'),cityView=fs.readFileSync(new URL('../src/cityView.ts',import.meta.url),'utf8');
  assert.match(capture,/query:d077CaptureQuery\(source\.sample,phase\)/,'actual capture metadata uses the tested query helper');
  assert.match(capture,/await p\.open\(item\.query\)/,'production browser opens that same tested query');
  assert.match(capture,/assertD077CaptureUrl\(await p\.ev\('location.href'\),source\.sample,phase\)/,'actual browser location is checked after navigation');
  const condition=cityView.match(/const serviceLodgeOn = ([^;]+);/);assert.ok(condition,'actual production serviceLodge dispatch condition');
  const artworkEnabled=Function('q','return ('+condition[1]+')');
  const flags=['serviceLodgeArt','healthResponseArt','farmMemorialArt','emergencyHotelArt','campusArt','educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'];
  assert.equal(flags.length,19,'all historical flag generations are explicitly retained');assert.equal(artworkEnabled(new URLSearchParams('sample=gallery&clean=1&spaceArt=legacy')),true,'rocket-only compatibility does not suppress service lodges');
  for(const flag of flags){assert.ok(condition[1].includes("'"+flag+"'"),'production condition includes '+flag);assert.equal(artworkEnabled(new URLSearchParams('sample=gallery&clean=1&'+flag+'=legacy')),false,'legacy '+flag+' suppresses D077');}
  for(const source of D077_CAPTURE_SOURCES){
   const before=d077CaptureQuery(source.sample,'before'),after=d077CaptureQuery(source.sample,'after');
   assert.equal(before,'sample='+source.sample+'&clean=1&serviceLodgeArt=legacy');
   assert.equal(after,'sample='+source.sample+'&clean=1');
   assert.notEqual(before,after,'D077 phases cannot both load legacy artwork');
   for(const [phase,query] of [['before',before],['after',after]])assertD077CaptureUrl('http://127.0.0.1:8370/?'+query,source.sample,phase);
   assert.throws(()=>assertD077CaptureUrl('http://127.0.0.1:8370/?'+before,source.sample,'after'),/actual browser URL/,'actual historical URL cannot masquerade as AFTER');
   for(const flag of flags)assert.throws(()=>assertD077CaptureUrl('http://127.0.0.1:8370/?'+after+'&'+flag+'=legacy',source.sample,'after'),/actual browser URL/,'actual inherited '+flag+' must reject');
   assert.equal(artworkEnabled(new URLSearchParams(before)),false,'BEFORE selects the exact D076 production phase');
   assert.equal(artworkEnabled(new URLSearchParams(after)),true,'AFTER selects the new D077 production phase');
   // Reproduce the failed CI URL: an after-phase legacy suffix must fail the same
   // dispatch check, rather than being excused as numerical normal drift.
   assert.throws(()=>assert.equal(artworkEnabled(new URLSearchParams(after+'&serviceLodgeArt=legacy')),true),{name:'AssertionError'});
  }
  for(const phase of [null,undefined,'legacy','serviceLodge','BEFORE'])assert.throws(()=>d077CaptureQuery('gallery',phase),/explicit D077/);
  assert.throws(()=>d077CaptureQuery('gallery&serviceLodgeArt=legacy','after'),/known D077/);
 });
 test('capture plan retains all 156 originals with bounded independently justified exterior/roof angles and stability checks',()=>{
  const plan=d077CapturePlan(),extraCount=Object.values(D077_ALTERNATE_VIEWS).reduce((n,a)=>n+a.length,0),repeatCount=D077_REPEAT_SLOTS.length;
  assert.deepEqual(plan.nativeReachability.kinds,[164,119,116,149,81]);assert.equal(plan.nativeReachability.nativeToolSlots,0);assert.equal(plan.nativeReachability.savedImportOnlySlots,10);assert.doesNotMatch(fs.readFileSync(new URL('../src/sim/edit.ts',import.meta.url),'utf8'),/k: (?:164|119|116|149|81)\b/,'no native placement dispatch acquires a target kind');
  assert.equal(plan.captured,false);for(const count of [1,2,3]){const originals=Array.from({length:52*count},()=>({}));assertD077OriginalViewCount([...originals,{additionalView:'extra'},{repeatOf:'first'}],count);assert.throws(()=>assertD077OriginalViewCount(originals.slice(1),count),/baseline views retained/);assert.throws(()=>assertD077OriginalViewCount([...originals,{}],count),/baseline views retained/);}assert.equal(plan.actualOriginalPngs,0,'a plan never claims actual files');assert.equal(plan.completeThreeViewportOriginalPngs,156+6*(extraCount+repeatCount));assert.equal(plan.pausedRepeatViews,6*repeatCount);assert.equal(plan.distinctBuildings,10);assert.equal(repeatCount,2);assert.deepEqual(D077_REPEAT_SLOTS,['164:2','149:4']);assert.equal(plan.preservedOriginalViews,156);assert.equal(plan.additionalRoofViews,6*extraCount);
  assert.deepEqual(D077_SLOTS.map(s=>[s.k,s.v]),[[164,0],[164,1],[164,2],[119,0],[119,1],[119,2],[116,0],[149,4],[81,0],[81,1]]);
  assert.equal(D077_CAPTURE_SOURCES.length,15);
  assert.deepEqual(D077_CAPTURE_SOURCES.filter(s=>s.sample==='gallery').flatMap(s=>s.sites.map(x=>x.k+':'+x.v)).sort(),D077_SLOTS.map(s=>s.k+':'+s.v).sort());
  for(const source of D077_CAPTURE_SOURCES){
   const extra=source.shots.filter(s=>s.additionalView),needed=source.sites.flatMap(site=>(D077_ALTERNATE_VIEWS[source.sample+':'+site.k+':'+site.v]??[]).map(angle=>({site,angle})));
   assert.equal(extra.length,needed.length);assert.equal(source.shots.filter(s=>!s.additionalView&&!s.repeatOf).length,source.sites.length+1);
   for(let i=0;i<needed.length;i++){const {site,angle}=needed[i];assert.deepEqual(extra[i],{...site,id:site.id+'-'+angle.name,name:site.name+' · '+angle.label+' / ADDITIONAL CAMERA VIEW',additionalView:angle.name,spinRadians:angle.spinRadians,tiltRadians:angle.tiltRadians,viewReason:angle.reason,zoomByWidth:angle.zoomByWidth});assert.ok(source.shots.indexOf(extra[i])>Math.max(...source.shots.map((s,j)=>s.additionalView?-1:j)),'alternates append after all original views');}
   const repeats=source.shots.filter(s=>s.repeatOf);assert.equal(repeats.length,source.sites.filter(s=>D077_REPEAT_SLOTS.includes(s.k+':'+s.v)).length);
   for(const shot of repeats){const initial=source.shots[source.shots.indexOf(shot)-1];assert.equal(initial.id,shot.repeatOf);assert.deepEqual(shot,{...initial,id:initial.id+'-paused-repeat',repeatOf:initial.id,pausedFrames:30});}
   if(source.force!==null)assert.match(source.label,/COPIED VARIANT .* SAVED-IMPORT ONLY/);
   for(const site of source.sites){assert.equal(site.sourceVariant,0);assert.equal(site.renderedVariant,source.force??site.sourceVariant);}
  }
 });
 test('original cities retain their exact native target owners and all four copied-variant states',()=>{
  assert.deepEqual(D077_CAPTURE_SOURCES.filter(s=>s.force===null).map(s=>[s.sample,s.targets.map(b=>[b.id,b.k,b.v])]),[
   ['gallery',[[11,116,0],[39,164,0],[78,149,0],[142,81,0],[180,119,0]]],['seed516',[[201,116,0]]],['ai120',[]],
  ],'seed516 actual target owner is retained; ai120 is the no-target control');
  for(const sample of ['gallery','seed516','ai120']){
   assert.deepEqual(D077_CAPTURE_SOURCES.filter(s=>s.sample===sample).map(s=>s.force),[null,0,1,2,4]);const source=d077City(sample),before=JSON.stringify(source);
   for(const force of [0,1,2,4]){const copy=d077ServiceLodgeCity(source,force);for(let i=0;i<source.buildings.length;i++){const b=source.buildings[i],c=copy.buildings[i];if(D077_SLOTS.some(s=>s.k===b.k&&s.v===force)){assert.notEqual(c,b);assert.deepEqual(c,{...b,v:force});}else assert.equal(c,b,'unsupported slots keep exact original object identity');}assert.equal(JSON.stringify(source),before);}
  }
 });
 test('all original and additional-angle views reproduce exact main/shadow submissions at three widths and two phases',()=>{
  for(const source of D077_CAPTURE_SOURCES){
   const {sample,n,shots,force,variant}=source;
   for(const on of [false,true]){const oracle=createD077FrameOracle(sample,on,force);
    try{for(const v of VIEWPORTS)for(const shot of shots){
     const camera=cameraFor(n,shot,v),frame=oracle.measure(camera,v);if(shot.k)assertD077OwnerFits(oracle.ownerBounds(camera,v,shot.buildingId),sample+' '+variant+' '+on+' '+shot.id+' '+v.W+'px');assert.equal(camera.zoom,d077CameraZoom(source,shot,v));
     assert.equal(frame.wholeTriangles,D077_FRAME_WHOLE[variant][sample][on?'serviceLodge':'legacy']);
     const pin=D077_FRAME_VIEW_PINS[variant][sample][on?'serviceLodge':'legacy'][v.W][shot.id];assert.deepEqual({triangles:frame.triangles,calls:frame.calls,culledTriangles:frame.culledTriangles,main:frame.main,shadow:frame.shadow},pin,'exact independently recorded main/shadow/frustum submissions for this declared view');
     assert.equal(frame.triangles,frame.main.triangles+frame.shadow.triangles);
     assert.equal(frame.calls,frame.main.calls+frame.shadow.calls);
     if(sample!=='seed516'||!shot.k){assert.equal(frame.culledTriangles,0);assert.deepEqual(frame.culled,[]);}
     assert.deepEqual(oracle.measure(camera,v),frame,'exact deterministic repeat');
     report.frames.push({sample,variant,on,width:v.W,shot:shot.id,triangles:frame.triangles,calls:frame.calls,wholeTriangles:frame.wholeTriangles,culledTriangles:frame.culledTriangles});
    }}finally{oracle.dispose();}
   }
  }
  assert.equal(report.frames.length,d077CapturePlan().completeThreeViewportOriginalPngs);
  for(const before of report.frames.filter(f=>!f.on)){const after=report.frames.find(f=>f.on&&f.sample===before.sample&&f.variant===before.variant&&f.width===before.width&&f.shot===before.shot);assert.equal(after.calls,before.calls);const pin=D077_FRAME_WHOLE[before.variant][before.sample];assert.equal(after.triangles-before.triangles,pin.serviceLodge-pin.legacy);}
 });
 test('production spin angles settle exactly and reject unchanged/wrong camera poses',()=>{
  const extras=D077_CAPTURE_SOURCES.flatMap(source=>source.shots.filter(s=>s.additionalView).map(shot=>({source,shot})));
  // Exercise the supported settlement path even when the audited source needs no extra views.
  if(!extras.length){const source=D077_CAPTURE_SOURCES.find(s=>s.sites.length);extras.push({source,shot:{...source.sites[0],spinRadians:Math.PI/2}});}
  for(const {source,shot} of extras)for(const viewport of VIEWPORTS){
   const initial=cameraFor(source.n,{...shot,spinRadians:0,tiltRadians:0},viewport),run=()=>{
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,source.n*6),controls=new OrbitControls(camera,null);
    controls.enableDamping=true;controls.minPolarAngle=Math.PI*.18;controls.maxPolarAngle=Math.PI*.42;controls.minZoom=.6;controls.maxZoom=8;
    controls.target.fromArray(initial.target);camera.position.fromArray(initial.pos);camera.zoom=initial.zoom;camera.lookAt(controls.target);for(let i=0;i<100;i++)controls.update();
    const state=()=>({pos:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom}),baseline=state();
    controls.rotateLeft(shot.spinRadians);if(shot.tiltRadians)controls.rotateUp(shot.tiltRadians);for(let i=0;i<900;i++)controls.rotateLeft(0);const rotated=state();
    assertD077ServiceLodgeCamera(rotated,baseline,shot.spinRadians,shot.tiltRadians??0);for(let i=0;i<1000;i++)controls.update();assert.deepEqual(state(),rotated,'future animation frames cannot change the settled pose');
    return {baseline,rotated};
   };
   const {baseline,rotated}=run();assert.deepEqual(run(),{baseline,rotated},'before/after camera sequence is deterministic');
   assert.throws(()=>assertD077ServiceLodgeCamera(baseline,baseline,shot.spinRadians,shot.tiltRadians??0),/alternate differs/);
   for(const key of ['target','pos','zoom']){const bad=structuredClone(rotated);if(key==='zoom')bad.zoom+=.01;else bad[key][0]+=.01;assert.throws(()=>assertD077ServiceLodgeCamera(bad,baseline,shot.spinRadians,shot.tiltRadians??0),{name:'AssertionError'},'changed '+key+' rejected');}
  }
 });
 test('zero-angle settlement preserves a production roof view and makes the thirty-frame repeat exact',()=>{
  const repeats=D077_CAPTURE_SOURCES.flatMap(source=>source.sites.filter(shot=>D077_REPEAT_SLOTS.includes(shot.k+':'+shot.v)).map(shot=>({source,shot})));assert.equal(repeats.length,2,'both planned thirty-frame model repeats');
  for(const {source,shot} of repeats)for(const viewport of VIEWPORTS){const initial=cameraFor(source.n,shot,viewport),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,source.n*6),controls=new OrbitControls(camera,null);
   controls.enableDamping=true;controls.minPolarAngle=Math.PI*.18;controls.maxPolarAngle=Math.PI*.42;controls.minZoom=.6;controls.maxZoom=8;
   controls.target.fromArray(initial.target);camera.position.fromArray(initial.pos);camera.zoom=initial.zoom;camera.lookAt(controls.target);
   const state=()=>({pos:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom});
   // Production settledCamera observes ordinary animation updates before draining damping.
   for(let i=0;i<100;i++)controls.update();const baseline=state();
   assert.ok(baseline.target.every((x,i)=>Math.abs(x-initial.target[i])<1e-9),'ordinary control warmup preserves requested target within floating-point arithmetic');
   for(let i=0;i<900;i++)controls.rotateLeft(0);const settled=state();assert.deepEqual(settled.target,baseline.target);assert.equal(settled.zoom,baseline.zoom);assert.ok(settled.pos.every((x,i)=>Math.abs(x-baseline.pos[i])<1e-9));
   for(let i=0;i<1030;i++)controls.update();assert.deepEqual(state(),settled,'thirty repeated frames and all future updates preserve exact camera bytes');
  }
 });
 test('all target owner silhouettes are retained with every original neighbor',()=>{
  report.visibility=[];
  for(const source of D077_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){
   const f=browserFixture(source.sample,on,source.force),before=JSON.stringify(f.digest);
   try{for(const site of source.sites){const audits=source.shots.filter(s=>s.k===site.k&&s.v===site.v&&!s.repeatOf).map(shot=>({shot:shot.id,...d077OwnerRayAudit(f,cameraFor(source.n,shot,VIEWPORTS[0]),VIEWPORTS[0],site.buildingId)}));assert.ok(audits.every(a=>a.targetRays>0&&a.visibleRays>0),'every unchanged-scene view intersects the intended owner');report.visibility.push({sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,on,audits});}assert.equal(JSON.stringify(f.digest),before);}finally{f.dispose();}
  }
  assert.equal(report.visibility.length,22);
 });
 test('paired supplementary zoom retains every owner vertex in both phases without changing original views',()=>{
  const material=new THREE.MeshBasicMaterial(),make=(w,h)=>{const g=new THREE.BoxGeometry(w,h,4).toNonIndexed();g.translate(0,h/2,0);const m=new THREE.Mesh(g,material),scene=new THREE.Scene();scene.add(m);return{scene,meshes:[m],owners:[new Int32Array(g.attributes.position.count/3).fill(11)],n:20};},before=make(4,4),after=make(8,8),states=[before,after],view={pos:[20,20,20],target:[0,0,0],zoom:8},original=structuredClone(view),viewport=VIEWPORTS[0],bytes=states.map(f=>Array.from(f.meshes[0].geometry.attributes.position.array));
  try{
   assert.throws(()=>assertD077OwnerFits(d077OwnerBounds(after,view,viewport,11)),/entire owner model fits/,'a clipped original view is reported, never silently reframed');
   const fit=fitD077PairedOwnerView(states,view,viewport,11);assert.ok(fit.zoom<view.zoom&&fit.zoom>=.6);assert.deepEqual(view,original,'original standard view stays unchanged');
   for(const [i,f]of states.entries()){const b=assertD077OwnerFits(d077OwnerBounds(f,fit.view,viewport,11));assert.equal(b.vertices,36);assert.equal(b.triangles,12);assert.deepEqual(Array.from(f.meshes[0].geometry.attributes.position.array),bytes[i]);assert.ok([...b.lo,...b.hi].every(x=>Math.abs(x)<=.94+1e-12));}
   assert.ok(fit.zoom<fitD077PairedOwnerView([before,before],view,viewport,11).zoom,'candidate larger bounds cannot be omitted from the paired fit');
   const p=after.meshes[0].geometry.attributes.position.array,saved=p[0];try{p[0]=1000;assert.throws(()=>assertD077OwnerFits(d077OwnerBounds(after,fit.view,viewport,11)),/entire owner model fits/,'a newly outlying vertex is included');assert.throws(()=>fitD077PairedOwnerView(states,view,viewport,11),/production zoom limits/,'impossible minimum zoom remains a failure');}finally{p[0]=saved;}
   assert.throws(()=>fitD077PairedOwnerView([before],view,viewport,11),/both fitted/);assert.throws(()=>fitD077PairedOwnerView(states,view,viewport,11,1),/fitting margin/);assert.throws(()=>d077OwnerBounds(before,view,viewport,99),/vertex inventory/);
  }finally{for(const f of states)f.meshes[0].geometry.dispose();material.dispose();}
 });
 test('owner-partition acceleration reproduces complete raw Three ray intersections and face identities',()=>{
  for(const source of D077_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){const f=browserFixture(source.sample,on,source.force),objects=[];f.scene.updateMatrixWorld(true);f.scene.traverse(o=>{if(o.isMesh&&o.visible)objects.push(o);});
   try{const acceleration=d077RayObjects(objects,f.meshes,f.owners),canonical=hits=>hits.map(h=>({mesh:objects.indexOf(h.object),face:h.faceIndex,instance:h.instanceId??null,distance:h.distance,point:h.point.toArray(),normal:h.face.normal.toArray()}));
    for(const slot of source.sites){const b=f.city.buildings.find(b=>b.id===slot.buildingId),target=new THREE.Vector3(b.x+b.size/2,0,b.z+b.size/2);
     for(const direction of [[1,1,1],[-1,1,-1],[1,2,-1],[-1,2,1]])for(const height of [.1,.7]){const end=target.clone().add(new THREE.Vector3(.03,height,.04)),origin=end.clone().add(new THREE.Vector3(...direction).multiplyScalar(20)),ray=new THREE.Raycaster(origin,end.clone().sub(origin).normalize());assert.deepEqual(canonical(d077RayHits(ray,acceleration)),canonical(ray.intersectObjects(objects,false)),'no original tree, neighbor, triangle, face or ordered hit is omitted');}
    }
    // Warm bounds, then mutate the live position array without needsUpdate.
    // This must invalidate the cache by content, preserving complete raw hits.
    const model=f.meshes[0],array=model.geometry.attributes.position.array,original=array[0];
    try{array[0]+=3.125;const changed=d077RayObjects(objects,f.meshes,f.owners);assert.notEqual(changed.find(o=>o.userData.d077RayOriginal===model).geometry,acceleration.find(o=>o.userData.d077RayOriginal===model).geometry,'direct typed-array mutation invalidates partition bounds');const point=new THREE.Vector3(array[0],array[1],array[2]),ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(4,4,4)),new THREE.Vector3(-1,-1,-1).normalize());assert.deepEqual(canonical(d077RayHits(ray,changed)),canonical(ray.intersectObjects(objects,false)));}finally{array[0]=original;}
   }finally{f.dispose();}
  }
 });
 test('all sixty-six accelerated surface contracts exactly equal raw Three contracts without sorting or tolerances',()=>{
  report.rawContractParity=[];let count=0;for(const source of D077_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){const f=browserFixture(source.sample,on,source.force);try{for(const site of source.sites)for(const viewport of VIEWPORTS){const view=cameraFor(source.n,site,viewport),actual=d077OwnerSurfaceContract(f,view,viewport,site.buildingId),raw=d077OwnerSurfaceContract(f,view,viewport,site.buildingId,{testOnlyRawSilhouetteRays:true});assert.deepEqual(actual,raw,site.k+':'+site.v+' '+on+' complete ordered samples, coordinates, normals, blockers, classifications and hashes');report.rawContractParity.push({sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,on,width:viewport.W,actualSha256:actual.sha256,rawSha256:raw.sha256,sourceGeometrySha256:actual.sourceGeometrySha256,completeRecords:actual.probes.length,requiredSamples:actual.requiredSamples.length,exact:true});count++;}}finally{f.dispose();}}
  report.rawContractCases=count;assert.equal(count,66,'eleven actual target owners in both phases and all three widths have raw complete-contract parity');
 });
 test('enclosure witnesses require complete correctly wound solids and reject open, elevated and non-manifold substitutes',()=>{
  const geometry=new THREE.BoxGeometry(2,2,2).toNonIndexed();geometry.translate(0,1,0);
  const triangles=g=>{const p=g.attributes.position;return Array.from({length:p.count/3},(_,t)=>{const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,t*3+j)),normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();return {mi:0,t,vertices,normal};});};
  try{const original=triangles(geometry),box=d077OwnerBoxWitnesses(original,0);assert.equal(box.length,1);assert.equal(d077OwnerClosedComponents(original,0).length,1);
   for(const face of box[0].faces.filter(f=>f.axis!==1||f.sign===1))for(const entry of face.triangles)for(const mode of ['missing','reversed']){const changed=original.map(t=>({...t,vertices:t.vertices.map(v=>v.clone()),normal:t.normal.clone()}));if(mode==='missing')changed.splice(changed.findIndex(t=>t.t===entry.triangle),1);else{const tri=changed.find(t=>t.t===entry.triangle);[tri.vertices[1],tri.vertices[2]]=[tri.vertices[2],tri.vertices[1]];tri.normal.negate();}assert.equal(d077OwnerBoxWitnesses(changed,0).length,0,mode+' actual box face rejects');assert.equal(d077OwnerClosedComponents(changed,0).length,0,mode+' actual component face rejects');}
   const duplicate=original.map(t=>({...t,vertices:t.vertices.map(v=>v.clone()),normal:t.normal.clone()}));duplicate[1]=duplicate[0];assert.equal(d077OwnerBoxWitnesses(duplicate,0).length,0,'duplicate half-rectangle cannot cover a complete face');
   const open=original.filter(t=>t.normal.y>0);assert.equal(d077OwnerBoxWitnesses(open,0).length,0);assert.equal(d077OwnerClosedComponents(open,0).length,0,'open screen has no enclosure witness');
   const elevated=original.filter(t=>t.normal.y>=0).map(t=>({...t,vertices:t.vertices.map(v=>v.clone().add(new THREE.Vector3(0,2,0)))}));assert.equal(d077OwnerBoxWitnesses(elevated,0).length,0);assert.equal(d077OwnerClosedComponents(elevated,0).length,0,'elevated open-bottom shell cannot use the ground exception');
   assert.equal(d077OwnerClosedComponents([...original,...original],0).length,0,'four cancelling edge incidents are non-manifold and reject');
   const reversed=original.map(t=>({...t,vertices:[t.vertices[0],t.vertices[2],t.vertices[1]],normal:t.normal.clone().negate()}));assert.equal(d077OwnerClosedComponents(reversed,0).length,0,'an inward shell has no positive oriented volume');
  }finally{geometry.dispose();}
 });
 test('upward contact cover needs the actual complete top and four sides and never excludes vertical or below-base points',()=>{
  const flat=y=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.2,y,-.2,0,y,.2,.2,y,-.2],3));g.computeVertexNormals();return g;},material=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),base=new THREE.Mesh(flat(0),material),target=new THREE.Mesh(flat(1),material),source=new THREE.BoxGeometry(2,1,2).toNonIndexed();source.translate(0,1.5,0);const p=source.attributes.position,keep=[];for(let t=0;t<p.count/3;t++)if(![0,1,2].every(j=>p.getY(t*3+j)===1))for(let j=0;j<3;j++)keep.push(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j));const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(keep,3));geometry.computeVertexNormals();source.dispose();const canopy=new THREE.Mesh(geometry,material),scene=new THREE.Scene();scene.add(base,target,canopy);const meshes=[base,target,canopy],owners=[new Int32Array([11]),new Int32Array([11]),new Int32Array(10).fill(11)],f={scene,meshes,owners,n:20},camera={pos:[10,15,10],target:[0,0,0],zoom:1},sample=()=>d077OwnerSurfaceContract(f,camera,VIEWPORTS[0],11).probes.find(p=>p.mesh===1&&p.source==='fixed-triangle');
  try{assert.equal(sample().reason,'upward contact covered by complete top and four sides');assert.equal(sample().blocker.contactCover.faces.length,5);
   for(let t=0;t<10;t++)for(const mode of ['missing','reversed']){const changed=geometry.clone(),a=changed.attributes.position.array,i=t*9;try{if(mode==='missing')for(let j=0;j<9;j++)a[i+j]=a[i+j%3];else for(let j=0;j<3;j++)[a[i+3+j],a[i+6+j]]=[a[i+6+j],a[i+3+j]];canopy.geometry=changed;assert.equal(sample().required,true,mode+' top/side triangle cannot provide a complete cover');}finally{canopy.geometry=geometry;changed.dispose();}}
   const original=target.geometry;for(const y of [.999,2.001]){const changed=flat(y);try{target.geometry=changed;assert.equal(sample().required,true,'below-base and above-top surfaces remain mandatory');}finally{target.geometry=original;changed.dispose();}}
   const tilted=flat(1);tilted.attributes.position.array[7]+=2**-23;try{target.geometry=tilted;const p=sample();assert.ok(p.normal[1]>1-1e-12&&p.normal[0]!==0,'negative control is almost horizontal but genuinely tilted');assert.equal(p.required,true,'a slightly tilted face admits downward front rays and cannot use contact cover');}finally{target.geometry=original;tilted.dispose();}
   const vertical=new THREE.BufferGeometry();vertical.setAttribute('position',new THREE.Float32BufferAttribute([0,1.1,-.2,0,1.5,-.2,0,1.5,.2],3));try{target.geometry=vertical;assert.equal(sample().required,true,'vertical surfaces never receive a contact-cover exemption');}finally{target.geometry=original;vertical.dispose();}
   owners[2].fill(22);assert.equal(sample().required,true,'another owner canopy cannot certify contact cover');owners[2].fill(11);assert.equal(sample().required,false);
  }finally{for(const m of meshes)m.geometry.dispose();material.dispose();}
 });
 test('open screens and separate-owner solids cannot hide a mandatory exterior point',()=>{
  const face=x=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x,.2,-.2,x,.8,-.2,x,.8,.2,x,.2,-.2,x,.8,.2,x,.2,.2],3));g.computeVertexNormals();return g;},material=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),target=new THREE.Mesh(face(0),material),screen=new THREE.Mesh(face(1),material),box=new THREE.Mesh(new THREE.BoxGeometry(2,2,2).toNonIndexed(),material);box.geometry.translate(3,1,0);const scene=new THREE.Scene();scene.add(target,screen,box);const meshes=[target,screen,box],owners=[new Int32Array(2).fill(11),new Int32Array(2).fill(11),new Int32Array(12).fill(11)],f={scene,meshes,owners,n:20},camera={pos:[10,15,10],target:[0,0,0],zoom:1};
  try{let contract=d077OwnerSurfaceContract(f,camera,VIEWPORTS[0],11);assert.ok(contract.probes.filter(p=>p.mesh===0&&p.source==='fixed-triangle').every(p=>p.required),'same-owner open screen and a separate closed solid do not establish enclosure');box.geometry.translate(-3,0,0);owners[2].fill(22);contract=d077OwnerSurfaceContract(f,camera,VIEWPORTS[0],11);assert.ok(contract.probes.filter(p=>p.mesh===0&&p.source==='fixed-triangle').every(p=>p.required),'another owner cannot establish a same-owner enclosure');owners[2].fill(11);contract=d077OwnerSurfaceContract(f,camera,VIEWPORTS[0],11);assert.ok(contract.probes.filter(p=>p.mesh===0&&p.source==='fixed-triangle').every(p=>!p.required&&p.blocker.enclosure),'a demonstrated complete containing owner box provides a retained witness');}finally{for(const m of meshes)m.geometry.dispose();material.dispose();}
 });
 test('coincident exterior equivalence requires exact owner, point, orientation and absence of a closer blocker',()=>{
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-2,1,-2,0,1,2,2,1,-2],3));g.computeVertexNormals();const material=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),mesh=new THREE.Mesh(g,material),scene=new THREE.Scene();scene.add(mesh);const owners=[new Int32Array([11])],f={scene,meshes:[mesh],owners,n:20},v=VIEWPORTS[0],camera={pos:[10,15,10],target:[0,0,0],zoom:1},contract={owner:11,sha256:'test',requiredSamples:['coincident'],probes:[{id:'coincident',required:true,mesh:0,triangle:1,point:[0,1,0],normal:[0,1,0]}]},audit=()=>d077OwnerSurfaceRayAudit(f,camera,v,contract).samples[0];
  try{
   const exact=audit();assert.equal(exact.visible,true);assert.equal(exact.surfaceWitness.sameTriangle,false);assert.equal(exact.surfaceWitness.owner,11);assert.ok(exact.surfaceWitness.distance<1e-5);
   owners[0][0]=12;assert.equal(audit().visible,false,'another owner at the same coordinate cannot substitute');owners[0][0]=11;
   const p=g.attributes.position.array;for(let i=1;i<p.length;i+=3)p[i]=1.001;assert.equal(audit().visible,false,'a displaced same-owner plane is not coincident');for(let i=1;i<p.length;i+=3)p[i]=1;
   for(let j=0;j<3;j++)[p[3+j],p[6+j]]=[p[6+j],p[3+j]];assert.equal(audit().visible,false,'a reversed FrontSide surface is not a valid witness');for(let j=0;j<3;j++)[p[3+j],p[6+j]]=[p[6+j],p[3+j]];
   contract.probes[0].normal=[1,0,0];assert.equal(audit().visible,false,'different facing cannot substitute');contract.probes[0].normal=[0,1,0];
   const obstacle=new THREE.Mesh(g.clone(),material);obstacle.position.y=.1;scene.add(obstacle);try{assert.equal(audit().visible,false,'a closer external blocker remains in the scene and rejects equivalence');}finally{scene.remove(obstacle);obstacle.geometry.dispose();}
   assert.equal(audit().visible,true,'all controls restore the unchanged equivalent exterior');
  }finally{g.dispose();material.dispose();}
 });
 test('every target fixed exterior sample and original blocked silhouette hit has complete actual-view union coverage',()=>{
  report.surfaceCoverage=[];
  for(const source of D077_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){
   const oracle=createD077FrameOracle(source.sample,on,source.force);
   try{for(const site of source.sites)for(const viewport of VIEWPORTS){
    const original=cameraFor(source.n,site,viewport),contract=oracle.surfaceContract(original,viewport,site.buildingId),owner=oracle.ownerVisibility(original,viewport,site.buildingId);
    assert.equal(contract.fixedTriangleSamples,contract.triangleCount*4);assert.equal(contract.originalHits,owner.targetRays);assert.equal(contract.originalBlockedHits,owner.blockedRays);
    assert.equal(contract.probes.filter(p=>p.source==='original-silhouette'&&p.required).length,owner.targetRays);assert.equal(contract.probes.filter(p=>p.source==='original-silhouette'&&p.externallyBlocked&&p.required).length,owner.blockedRays);assert.ok(Object.isFrozen(contract)&&contract.probes.every(Object.isFrozen));
    const views=source.shots.filter(s=>s.k===site.k&&s.v===site.v&&!s.repeatOf),audits=views.map(s=>oracle.surfaceVisibility(cameraFor(source.n,s,viewport),viewport,contract));
    const coverage=assertD077SurfaceCoverage(audits,contract,site.k+':'+site.v+' '+(on?'after':'before')+' '+viewport.W+'px');
    let archivedCoverage=null;if(!on){const archived=oracle.archivedSurfaceContract(viewport,site.buildingId),archivedAudits=views.map(s=>oracle.surfaceVisibility(cameraFor(source.n,s,viewport),viewport,archived));archivedCoverage=assertD077SurfaceCoverage(archivedAudits,archived,'every archived baseline fixed record and original silhouette hit also retained');assert.deepEqual(archived.probes.filter(p=>p.source==='fixed-triangle'),contract.probes.filter(p=>p.source==='fixed-triangle'),'camera arithmetic never changes fixed geometric records');}
    assert.throws(()=>assertD077SurfaceCoverage([audits[0]],contract),/every fixed exterior point/,'one view cannot silently omit rear surfaces');
    const removed=structuredClone(contract);removed.probes.pop();assert.throws(()=>assertD077SurfaceCoverage(audits,removed),/surface-contract digest/);
    const hidden=structuredClone(audits),required=contract.requiredSamples[0];for(const audit of hidden){audit.samples.find(s=>s.id===required).visible=false;audit.visibleSamples=audit.visibleSamples.filter(id=>id!==required);}assert.throws(()=>assertD077SurfaceCoverage(hidden,contract),/every fixed exterior point/);
    report.surfaceCoverage.push({sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,on,width:viewport.W,coverage,archivedCoverage,contract});
   }}finally{oracle.dispose();}
  }
  report.archivedSurfaceCases=report.surfaceCoverage.filter(r=>r.archivedCoverage).length;assert.equal(report.archivedSurfaceCases,33,'every archived owner-width is fully covered');assert.equal(report.surfaceCoverage.length,66,'all eleven owner cases in both phases at all three exact widths');
 });
 test('missing or reversed actual target wall and roof faces reject intact frozen surface contracts',()=>{
  let controls=0;
  for(const source of D077_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){const viewport=VIEWPORTS[0],f=browserFixture(source.sample,on,source.force);
   try{for(const site of source.sites){
    const contract=d077OwnerSurfaceContract(f,cameraFor(source.n,site,viewport),viewport,site.buildingId),views=source.shots.filter(s=>s.k===site.k&&s.v===site.v&&!s.repeatOf),originalAudits=views.map(s=>d077OwnerSurfaceRayAudit(f,cameraFor(source.n,s,viewport),viewport,contract));assertD077SurfaceCoverage(originalAudits,contract);
    for(const [name,predicate]of [['wall',p=>Math.abs(p.normal[1])<.1],['roof',p=>p.normal[1]>.1]])for(const mode of ['missing','reversed']){
     const probe=contract.probes.find(p=>p.required&&p.source==='fixed-triangle'&&predicate(p));assert.ok(probe,'required '+name+' point');const model=f.meshes[probe.mesh],original=model.geometry,changed=original.clone(),p=changed.attributes.position.array,t=probe.triangle*9;
     try{if(mode==='missing')for(let j=0;j<9;j++)p[t+j]=p[t+j%3];else for(let j=0;j<3;j++)[p[t+3+j],p[t+6+j]]=[p[t+6+j],p[t+3+j]];model.geometry=changed;const audits=views.map(s=>d077OwnerSurfaceRayAudit(f,cameraFor(source.n,s,viewport),viewport,contract));assert.throws(()=>assertD077SurfaceCoverage(audits,contract),/every fixed exterior point/,mode+' '+name+' must reject');controls++;}finally{model.geometry=original;changed.dispose();}
    }
    assert.deepEqual(views.map(s=>d077OwnerSurfaceRayAudit(f,cameraFor(source.n,s,viewport),viewport,contract)),originalAudits);
   }}finally{f.dispose();}
  }
  report.fixedSurfaceNegativeControls=controls;assert.equal(controls,88,'missing/reversed wall/roof controls for all eleven actual owners in BOTH phases');
 });
 test('reintroducing the original offset D077 utility door must fail the intact complete facade contract',()=>{
  const source=D077_CAPTURE_SOURCES.find(s=>s.sample==='gallery'&&s.force===0),site=source.sites.find(s=>s.k===164&&s.v===0),f=browserFixture(source.sample,true,source.force),b=f.city.buildings.find(b=>b.id===site.buildingId),H=Math.max(.12,D077_KT.height(b.k,b.lv,b.v)),model=f.meshes[2],original=model.geometry,originalOwners=f.owners[2];
  const views=source.shots.filter(s=>s.k===164&&s.v===0&&!s.repeatOf);report.offsetDecalRegression=[];
  try{for(const viewport of VIEWPORTS){const contract=d077OwnerSurfaceContract(f,cameraFor(source.n,site,viewport),viewport,b.id),originalAudits=views.map(s=>d077OwnerSurfaceRayAudit(f,cameraFor(source.n,s,viewport),viewport,contract));assertD077SurfaceCoverage(originalAudits,contract);
   let ground=Infinity;f.meshes.forEach((mesh,mi)=>{const p=mesh.geometry.attributes.position;for(let t=0;t<f.owners[mi].length;t++)if(f.owners[mi][t]===b.id)for(let j=0;j<3;j++)ground=Math.min(ground,p.getY(t*3+j));});assert.equal(ground,0,'exact original gallery owner ground datum');
   // Exact first-red input: front(.31,.45,.661,0,.32) in the existing D arena.
   // This adds a genuine same-owner occluder; it changes no frozen required point.
   const points=[[.31,0,.661],[.45,0,.661],[.45,.32,.661],[.31,0,.661],[.45,.32,.661],[.31,.32,.661]],changed=original.clone(),start=original.drawRange.start+original.drawRange.count,owners=originalOwners.slice();assert.equal(start%3,0,'append starts on a complete triangle');assert.ok(start/3+2<=owners.length,'existing arena owner capacity covers the appended faces');assert.equal(owners[start/3],0,'first spare triangle has no owner');assert.equal(owners[start/3+1],0,'second spare triangle has no owner');owners.fill(b.id,start/3,start/3+2);
   try{assert.ok(start+6<=changed.attributes.position.count,'existing decoration arena has six spare vertices');for(let i=0;i<6;i++){const [x,h,z]=points[i];changed.attributes.position.setXYZ(start+i,b.x+x*b.size,ground+h*H,b.z+z*b.size);changed.attributes.normal.setXYZ(start+i,0,0,1);}changed.setDrawRange(original.drawRange.start,original.drawRange.count+6);model.geometry=changed;f.owners[2]=owners;
    const blocked=views.map(s=>d077OwnerSurfaceRayAudit(f,cameraFor(source.n,s,viewport),viewport,contract));assert.throws(()=>assertD077SurfaceCoverage(blocked,contract),/every fixed exterior point/,'an open offset door cannot replace or cover a mandatory facade sample');
    const missing=contract.requiredSamples.filter(id=>!blocked.some(a=>a.visibleSamples.includes(id))),probe=contract.probes.find(p=>missing.includes(p.id)&&p.source==='fixed-triangle'&&p.normal[2]===1);assert.ok(probe,'the regression exposes the actual front wall');const changedContract=d077OwnerSurfaceContract(f,cameraFor(source.n,site,viewport),viewport,b.id);assert.equal(changedContract.probes.find(p=>p.id===probe.id).required,true,'an open decoration is never misclassified as a proven closed solid');report.offsetDecalRegression.push({width:viewport.W,contractSha256:contract.sha256,probe,missing,blocked:blocked.map(a=>a.samples.find(p=>p.id===probe.id)),rejected:true});
   }finally{model.geometry=original;f.owners[2]=originalOwners;changed.dispose();}
   assert.deepEqual(views.map(s=>d077OwnerSurfaceRayAudit(f,cameraFor(source.n,s,viewport),viewport,contract)),originalAudits,'restoration recovers every original required-surface result');
  }}finally{f.dispose();}assert.equal(report.offsetDecalRegression.length,3,'first-red door regression rejects at every required width');
 });
 test('independent intended roof points are closed and directly unoccluded across planned cameras at every width',()=>{
  report.roofVisibility=[];
  for(const source of D077_CAPTURE_SOURCES.filter(s=>s.sites.length)){
   const oracle=createD077FrameOracle(source.sample,true,source.force);
   try{for(const site of source.sites)for(const viewport of VIEWPORTS){
    const views=source.shots.filter(s=>s.k===site.k&&s.v===site.v&&!s.repeatOf),audits=views.map(s=>oracle.roofVisibility(cameraFor(source.n,s,viewport),viewport,site.buildingId));
    const coverage=assertD077RoofCoverage(audits,'k'+site.k+':v'+site.v+' '+viewport.W+'px roof');
    report.roofVisibility.push({sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,width:viewport.W,coverage,audits});
   }}finally{oracle.dispose();}
  }
  assert.equal(report.roofVisibility.length,33,'all eleven actual owner roofs at all three widths');
 });
 test('missing and back-facing actual roof surfaces cannot pass independent intended-plan ray probes',()=>{
  let firstAudit,negativeControls=0;
  for(const source of D077_CAPTURE_SOURCES.filter(s=>s.sites.length)){
   const viewport=VIEWPORTS[0],f=browserFixture(source.sample,true,source.force);
   try{for(const site of source.sites){
    const camera=cameraFor(source.n,site,viewport),audit=d077RoofRayAudit(f,camera,viewport,site.buildingId),sample=audit.samples[0],model=f.meshes[sample.mesh],original=model.geometry;
    firstAudit??=audit;
    for(const mode of ['missing','back-facing']){
     const changed=original.clone(),p=changed.attributes.position.array,t=sample.triangle*9;
     try{
      if(mode==='missing')for(let j=0;j<9;j++)p[t+j]=p[t+j%3];
      else for(let j=0;j<3;j++)[p[t+3+j],p[t+6+j]]=[p[t+6+j],p[t+3+j]];
      model.geometry=changed;
      assert.throws(()=>d077RoofRayAudit(f,camera,viewport,site.buildingId),{name:'AssertionError'},site.k+':'+site.v+' '+mode+' roof cannot prove the independent covered-plan point');negativeControls++;
     }finally{model.geometry=original;changed.dispose();}
    }
    assert.deepEqual(d077RoofRayAudit(f,camera,viewport,site.buildingId),audit,'negative controls restore every original surface');
   }}finally{f.dispose();}
  }
  report.roofNegativeControls=negativeControls;assert.equal(negativeControls,22,'missing and back-facing actual roof controls for all eleven owner cases');
  const fullyVisible=structuredClone(firstAudit);fullyVisible.visibleSamples=[...firstAudit.expectedSamples];fullyVisible.samples.forEach(s=>{s.visible=true;s.blocker=null;});assertD077RoofCoverage([fullyVisible]);
  const absent=structuredClone(fullyVisible);absent.visibleSamples.pop();absent.samples.at(-1).visible=false;assert.throws(()=>assertD077RoofCoverage([absent]),/every intended roof sample/,'a camera without one roof point cannot prove coverage');
  const incomplete=structuredClone(fullyVisible);incomplete.expectedSamples.pop();incomplete.samples.pop();incomplete.visibleSamples.pop();assert.throws(()=>assertD077RoofCoverage([incomplete]),/independently intended/,'removing an entire intended roof probe cannot weaken the coverage set');
  const invented=structuredClone(fullyVisible);invented.visibleSamples.push('invented-roof');assert.throws(()=>assertD077RoofCoverage([invented]),/invented/);
  const wrong=structuredClone(fullyVisible);wrong.owner++;assert.throws(()=>assertD077RoofCoverage([fullyVisible,wrong]),/same owner/);
 });
 test('paused repeat requires exact PNG, canvas, world, camera, presentation and submitted geometry',()=>{
  const initial={sha256:'a'.repeat(64),canvasSha256:'b'.repeat(64),worldSha256:'c'.repeat(64),camera:{pos:[1,2,3],target:[4,0,6],zoom:2},presentation:{visT:2.2,dayFrac:0},render:{calls:9,triangles:61064},renderAll:{calls:9,triangles:61064},width:1440,height:1000,bytes:5000};
  assertD077PausedRepeat(structuredClone(initial),initial);
  for(const key of Object.keys(initial)){const bad=structuredClone(initial);if(typeof bad[key]==='string')bad[key]='d'.repeat(64);else if(typeof bad[key]==='number')bad[key]++;else if(key==='camera')bad[key].pos[0]+=.001;else if(key==='presentation')bad[key].visT+=.01;else bad[key].triangles++;
   assert.throws(()=>assertD077PausedRepeat(bad,initial),{name:'AssertionError'},'changed '+key+' must reject');
   const missing=structuredClone(initial);delete missing[key];assert.throws(()=>assertD077PausedRepeat(missing,missing),{name:'AssertionError'},'missing '+key+' cannot prove stability');
  }
  const capture=fs.readFileSync(new URL('./d077-capture.mjs',import.meta.url),'utf8');
  assert.match(capture,/await p\.frames\(s\.pausedFrames\)/,'actual repeat waits thirty presentation frames');
  assert.match(capture,/if\(s\.repeatOf\)assertD077PausedRepeat\(/,'actual images use strict equality validator');
 });
 test('original D067 seed516 framing and exact culling remain, including the actual D077 target delta',()=>{
  const city=d077City('seed516'),b=city.buildings.find(b=>live(city,b)&&b.k===116);assert.equal(b.id,201);
  const shot={k:116,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size};
  for(const on of [false,true]){const oracle=createD077FrameOracle('seed516',on);
   try{for(const v of VIEWPORTS){const frame=oracle.measure(cameraFor(city.n,shot,v),v);
    const delta=D077_FRAME_WHOLE.native.seed516.serviceLodge-D077_FRAME_WHOLE.native.seed516.legacy;assert.equal(frame.wholeTriangles,112762+(on?delta:0));assert.equal(frame.triangles,108842+(on?delta:0));assert.equal(frame.calls,13);assert.equal(frame.culledTriangles,3920);
    assert.deepEqual(frame.culled.map(m=>[m.name,m.instances,m.triangles,m.main.reason,m.castShadow]),[['inst6',280,1680,'frustum',false],['inst8',280,2240,'frustum',false]]);
    const source=D077_CAPTURE_SOURCES.find(s=>s.sample==='seed516'&&s.force===null),id=source.sites[0].id,pin=D077_FRAME_VIEW_PINS.native.seed516[on?'serviceLodge':'legacy'][v.W][id];assert.deepEqual(frame.shadow,pin.shadow,'exact phase-specific sun submissions');assert.deepEqual(frame.main,pin.main,'exact phase-specific color submissions');if(!on){assert.deepEqual(frame.shadow,{triangles:28302,calls:5});assert.deepEqual(frame.main,{triangles:80540,calls:8});}
   }}finally{oracle.dispose();}
  }
 });
 test('wrong submitted triangle/call counts and substituting whole-scene count are rejected',()=>{
  const o=createD077FrameOracle('seed516',true),city=d077City('seed516'),n=city.n,b=city.buildings.find(b=>live(city,b)&&b.k===116),shots=[null,{k:116,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size}],v=VIEWPORTS[0];
  try{const frame=o.measure(cameraFor(n,shots[1],v),v);
   const exact=D077_FRAME_WHOLE.native.seed516.serviceLodge-3920;assertD077Frame({triangles:exact,calls:13},frame);
   assert.throws(()=>assertD077Frame({triangles:exact+1,calls:13},frame),/triangles agree/);
   assert.throws(()=>assertD077Frame({triangles:exact,calls:14},frame),/calls agree/);
   assert.throws(()=>assertD077Frame({triangles:D077_FRAME_WHOLE.native.seed516.serviceLodge,calls:13},frame),/triangles agree/);
  }finally{o.dispose();}
 });
 test('injected real model triangle is rejected by whole-scene cap before any frustum test',()=>{
  const o=createD077FrameOracle('seed516',true),city=d077City('seed516'),n=city.n,b=city.buildings.find(b=>live(city,b)&&b.k===116),shots=[null,{k:116,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size}],v=VIEWPORTS[0];
  let model; o.scene.traverse(m=>{if(!model&&m.isMesh&&!m.isInstancedMesh&&m.castShadow)model=m;});assert.ok(model);
  const original=model.geometry,extra=original.clone(),end=original.drawRange.start+original.drawRange.count;
  try{
   assert.ok(!extra.index&&end+3<=extra.attributes.position.count,'production arena has one spare triangle');
   for(const at of Object.values(extra.attributes))for(let j=0;j<3;j++)for(let k=0;k<at.itemSize;k++)at.array[(end+j)*at.itemSize+k]=at.array[(original.drawRange.start+j)*at.itemSize+k];
   extra.setDrawRange(original.drawRange.start,original.drawRange.count+3);model.geometry=extra;
   assert.throws(()=>o.measure(cameraFor(n,shots[1],v),v),/immutable whole-scene triangle budget/);
   model.geometry=original;assert.equal(o.measure(cameraFor(n,shots[1],v),v).wholeTriangles,D077_FRAME_WHOLE.native.seed516.serviceLodge);
  }finally{model.geometry=original;extra.dispose();o.dispose();}
 });
 test('geometry snapshot includes all building owner attributes and instance counts/transforms, independent of construction ages',()=>{
  for(const sample of ['gallery','seed516','ai120']){
   const a=createD077FrameOracle(sample,false),b=createD077FrameOracle(sample,true),again=createD077FrameOracle(sample,true);
   try{
    assert.deepEqual(Object.keys(b.geometry.meshes),['walls','other','dress']);
    assert.ok(b.geometry.instTransforms.length>=2);for(const token of b.geometry.instTransforms)assert.match(token,/^\d+:[0-9a-f]{8}$/);
    assert.deepEqual(a.geometry.instTransforms,b.geometry.instTransforms,'original trees and their order/transforms stay exact');
    if(sample==='gallery'||sample==='seed516')assert.notDeepEqual(a.geometry.meshes,b.geometry.meshes,'changed production owner attributes are not ignored');else assert.deepEqual(a.geometry.meshes,b.geometry.meshes,'native city without supported target slots remains byte-exact');
    assert.deepEqual(again.geometry,b.geometry,'fresh independent scenes have identical geometry snapshots');
   }finally{a.dispose();b.dispose();again.dispose();}
  }
 });
 test('render-only saved preview geometry is independently matched and native/copied world records are never mutated',()=>{
  const source=d077City('gallery'),before=JSON.stringify(source);
  assert.equal(d077ServiceLodgeCity(source,null),source,'native mode returns original world');
  for(const force of [0,1,2,4]){
   const copy=d077ServiceLodgeCity(source,force);assert.notEqual(copy,source);assert.notEqual(copy.buildings,source.buildings);
   for(let i=0;i<source.buildings.length;i++){const b=source.buildings[i],c=copy.buildings[i];
    if(D077_SLOTS.some(s=>s.k===b.k&&s.v===force)){assert.notEqual(c,b);assert.deepEqual(c,{...b,v:force});}else assert.equal(c,b,'every unsupported slot and unrelated building record is reused unchanged');
   }
   for(const [kind,unsupported] of [[164,4],[119,4],[116,1],[149,0],[81,2]])if(force===unsupported){const i=source.buildings.findIndex(b=>b.k===kind);assert.equal(copy.buildings[i],source.buildings[i],'unsupported request retains exact native object identity and variant');}
   for(const on of [false,true]){const o=createD077FrameOracle('gallery',on,force),f=browserFixture('gallery',on,force);
    try{assert.equal(o.assertBrowserGeometry(f.digest).canonicalization.eligibleComponents,0);}finally{o.dispose();f.dispose();}
   }
   assert.equal(JSON.stringify(source),before,'native world fields unchanged');
  }
  for(const force of [1,2]){const o=createD077FrameOracle('gallery',true,force);
   try{for(const wrong of [null,0,1,2,4].filter(v=>v!==force)){const f=browserFixture('gallery',true,wrong);
    try{assert.throws(()=>o.assertBrowserGeometry(f.digest),{name:'AssertionError'},'wrong copied saved variant cannot prove target geometry');}finally{f.dispose();}
   }}finally{o.dispose();}
  }
 });
 test('browser geometry admits only the two exact trailing empty UI instances and rejects all other mismatches',()=>{
  const o=createD077FrameOracle('seed516',true);
  try{
   const empty='0:'+hashOf(new Float32Array(0));
   const browser={meshes:structuredClone(o.geometry.meshes),instTransforms:[...o.geometry.instTransforms,empty,empty]};
   assertD077BrowserGeometry(browser,o.geometry);
   for(const [name,mutate] of [
    ['missing UI instance',a=>a.instTransforms.pop()],
    ['third extra UI instance',a=>a.instTransforms.push(empty)],
    ['nonzero UI count',a=>a.instTransforms[a.instTransforms.length-1]='1:'+hashOf(new Float32Array(16))],
    ['changed tree transform',a=>a.instTransforms[0]=a.instTransforms[0].split(':')[0]+':deadbeef'],
    ['changed owner mesh',a=>a.meshes.walls[0]='00000000'],
    ['changed owner triangle count',a=>{const owner=Object.keys(a.meshes.walls[1])[0];a.meshes.walls[1][owner]++;}],
   ]){
    const changed=structuredClone(browser);mutate(changed);
    assert.throws(()=>assertD077BrowserGeometry(changed,o.geometry),{name:'AssertionError'},name+' must reject');
   }
   assertD077BrowserGeometry(browser,o.geometry,'unaltered control');
  }finally{o.dispose();}
 });
 test('uploaded-word reconstruction admits only the 18 diagnosed D060 residuals and leaves source geometry exact',()=>{
  for(const on of [false,true]){
   const o=createD077FrameOracle('seed516',on),f=browserFixture('seed516',on);
   try{
    const before=JSON.stringify(o.geometry),exact=o.assertBrowserGeometry(f.digest);
    assert.equal(exact.canonicalization.changedComponents,0);assert.equal(exact.canonicalization.eligibleComponents,18);
    const pin=on?{start:2562,normal:'f567b736',owner:'1f9fee9e'}:{start:2576,normal:'89eb5daa',owner:'9220f12e'};
    assert.equal(f.start,pin.start,'exact phase-specific D067 owner span after preceding D077 geometry');
    for(const name of ['walls','other','dress']){const s=o.normalSpecs[name];assert.ok(s.capacity>=s.length);assert.equal(s.start,0);assert.equal(s.hash,f.digest.meshes[name].attrs.normal);}
    const observed=f.change('other',g=>{
     const words=new Uint32Array(g.attributes.normal.array.buffer);
     for(const [t,bits] of [[12,0x26474ff7],[24,0x26464a92],[54,0x263b968e]])for(let j=0;j<6;j++)words[(f.start+t)*9+j*3+2]=bits;
    });
    assert.equal(observed.actual.meshes.other.attrs.normal,pin.normal,'exact D067 recorded-residual pattern');assert.equal(observed.actual.meshes.other.byOwner,pin.owner,'all 18 diagnosed components reconstruct the exact D067 browser pattern');
    assert.throws(()=>assertD077BrowserGeometry({meshes:Object.fromEntries(Object.entries(observed.actual.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),instTransforms:observed.actual.inst.map(s=>s.split(':').slice(0,2).join(':'))},o.geometry),'original raw guard still rejects diagnostic mismatch');
    assert.throws(()=>o.assertBrowserGeometry(observed.actual),/requires actual uploaded words/);
    const result=o.assertBrowserGeometry(observed.actual,observed.words);
    assert.equal(result.canonicalization.bound,1e-15);assert.equal(result.canonicalization.changedComponents,18);assert.equal(result.raw.other.equal,false);assert.equal(result.rawNodePreserved,true);
    assert.equal(JSON.stringify(o.geometry),before,'snapshot unchanged');assert.deepEqual(o.assertBrowserGeometry(f.digest),exact,'raw model still compares exactly after canonical fallback');
    const wrong=structuredClone(observed.words);wrong.other[0]=(wrong.other[0]^1)>>>0;
    assert.throws(()=>o.assertBrowserGeometry(observed.actual,wrong),/reconstruct full browser/,'bad captured words cannot justify a hash exception');
    const truncated=structuredClone(observed.words);truncated.other.pop();assert.throws(()=>o.assertBrowserGeometry(observed.actual,truncated),/complete live/);
   }finally{o.dispose();f.dispose();}
  }
 });
 test('canonical normal boundary is exact; outside-face, meaningful, nonfinite and unproven changes reject',()=>{
  const o=createD077FrameOracle('seed516',false),f=browserFixture('seed516',false),index=(f.start+12)*9+2;
  try{
   const boundWords=new Uint32Array(new Float32Array([1e-15]).buffer);if(new Float32Array(boundWords.buffer)[0]>1e-15)boundWords[0]--;
   const atBound=new Float32Array(boundWords.buffer)[0],aboveWords=new Uint32Array([boundWords[0]+1]),above=new Float32Array(aboveWords.buffer)[0];
   assert.ok(atBound<=1e-15&&above>1e-15);
   for(const value of [0,-0,atBound,-atBound]){const x=f.change('other',g=>g.attributes.normal.array[index]=value);o.assertBrowserGeometry(x.actual,x.words);}
   for(const [name,idx,value] of [['above boundary',index,above],['below negative boundary',index,-above],['meaningful eligible normal',index,.001],['outside eligible face',index+1,1e-16],['other normal component',index-1,0],['NaN',index,NaN],['infinity',index,Infinity]]){
    const x=f.change('other',g=>g.attributes.normal.array[idx]=value);assert.throws(()=>o.assertBrowserGeometry(x.actual,x.words),{name:'AssertionError'},name+' rejects');
   }
   const tinyElsewhere=f.change('other',g=>{
    const allowed=new Set([12,13,24,25,54,55].flatMap(t=>[0,1,2].map(v=>(f.start+t)*9+v*3+2)));
    const a=g.attributes.normal.array,j=a.findIndex((v,j)=>v===0&&!allowed.has(j));assert.ok(j>=0);a[j]=1e-16;
   });
   assert.throws(()=>o.assertBrowserGeometry(tinyElsewhere.actual,tinyElsewhere.words),/canonical mesh/,'even sub-bound mutation of an unrelated zero normal rejects');
   const walls=f.change('walls',g=>g.attributes.normal.array[0]=1e-16);assert.throws(()=>o.assertBrowserGeometry(walls.actual,walls.words),/canonical mesh/,'no other mesh gets a near-zero allowance');
   const raw=f.change('other',g=>g.attributes.normal.array[index]=0);raw.actual.meshes.other.byOwner='00000000';assert.throws(()=>o.assertBrowserGeometry(raw.actual,raw.words),/reconstruct full browser/,'forged raw owner digest rejects');
   for(const [name,mutate] of [['position',g=>g.attributes.position.array[0]+=.01],['color',g=>g.attributes.color.array[0]+=.01],['owners',(g,ow)=>ow[0]++],['triangles',g=>g.setDrawRange(0,g.drawRange.count-3)]]){
    const x=f.change('other',mutate);assert.throws(()=>o.assertBrowserGeometry(x.actual,x.words),{name:'AssertionError'},name+' stays exact');
   }
   for(const [name,mutate] of [['holes',a=>a.meshes.other.holes++],['owner map',a=>a.meshes.other.ownerTris[-98]++],['normal attribute missing',a=>delete a.meshes.other.attrs.normal],['tree transform',a=>a.inst[0]='1:deadbeef:-:-'],['UI instance',a=>a.inst.pop()]]){
    const x=structuredClone(f.digest);mutate(x);assert.throws(()=>o.assertBrowserGeometry(x),{name:'AssertionError'},name+' rejects');
   }
   const wrong=browserFixture('gallery',true);try{assert.throws(()=>o.assertBrowserGeometry(wrong.digest),{name:'AssertionError'},'wrong sample model rejects');}finally{wrong.dispose();}
   assert.equal(o.assertBrowserGeometry(f.digest).rawNodePreserved,true,'all failed comparisons preserve original model');
  }finally{o.dispose();f.dispose();}
 });
 test('other samples have zero eligible normal components and source mutation cannot replace the oracle baseline',()=>{
  const o=createD077FrameOracle('gallery',true),f=browserFixture('gallery',true);
  try{
   assert.equal(o.assertBrowserGeometry(f.digest).canonicalization.eligibleComponents,0);
   const wrong=browserFixture('gallery',false);try{assert.throws(()=>o.assertBrowserGeometry(wrong.digest),{name:'AssertionError'},'wrong variant model phase rejects');}finally{wrong.dispose();}
   const x=f.change('other',g=>g.attributes.normal.array[2]=1e-16);assert.throws(()=>o.assertBrowserGeometry(x.actual,x.words),/canonical mesh/);
   let model;o.scene.traverse(m=>{if(!model&&m.isMesh&&!m.isInstancedMesh&&m.geometry.attributes.wStyle)model=m;});assert.ok(model);
   const a=model.geometry.attributes.position.array,word=new Uint32Array(a.buffer,a.byteOffset,1),saved=word[0];
   try{word[0]^=1;assert.throws(()=>o.assertBrowserGeometry(f.digest),/immutable geometry snapshot/);}finally{word[0]=saved;}
   o.assertBrowserGeometry(f.digest);
  }finally{o.dispose();f.dispose();}
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {failed,report}=await d077FrameGuards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));
 fs.mkdirSync(new URL('../scratch/d077/',import.meta.url),{recursive:true});const bytes=Buffer.from(JSON.stringify(report,null,2));fs.writeFileSync(new URL('../scratch/d077/D077-frame.json',import.meta.url),bytes);fs.writeFileSync(new URL('../scratch/d077/D077-frame.json.gz',import.meta.url),gzipSync(bytes));
 const summary={passed:report.passed,tests:report.tests.length,frames:report.frames.length,rawContractCases:report.rawContractCases??0,roofViewportCases:report.roofVisibility?.length??0,surfaceViewportCases:report.surfaceCoverage?.length??0,archivedSurfaceCases:report.archivedSurfaceCases??0,fixedSurfaceNegativeControls:report.fixedSurfaceNegativeControls??0,roofNegativeControls:report.roofNegativeControls??0,offsetDecalRegressionCases:report.offsetDecalRegression?.length??0,requiredSurfaceSamples:report.surfaceCoverage?.reduce((n,r)=>n+r.coverage.requiredSamples,0)??0,coveredSurfaceSamples:report.surfaceCoverage?.reduce((n,r)=>n+r.coverage.coveredSamples,0)??0,archivedRequiredSamples:report.surfaceCoverage?.reduce((n,r)=>n+(r.archivedCoverage?.requiredSamples??0),0)??0,fullReportSha256:createHash('sha256').update(bytes).digest('hex'),fullReportBytes:bytes.length};fs.writeFileSync(new URL('../scratch/d077/D077-frame-summary.json',import.meta.url),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));process.exitCode=failed?1:0;
}

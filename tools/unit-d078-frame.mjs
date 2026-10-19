// D078 camera-specific draw oracle guards. Node only; no browser counters, renderer, network, or output files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {createD078FrameOracle,assertD078Frame,assertD078NeighbourhoodPavilionCamera,assertD078BrowserGeometry,d078OwnerRayAudit,d078RoofRayAudit,assertD078RoofCoverage,assertD078PausedRepeat,d078OwnerSurfaceContract,d078OwnerSurfaceRayAudit,assertD078SurfaceCoverage,D078_FRAME_WHOLE,D078_FRAME_VIEW_PINS,d078RayObjects,d078RayHits,d078OwnerBoxWitnesses,d078OwnerClosedComponents,d078OwnerBounds,assertD078OwnerFits,fitD078PairedOwnerView,d078ConstructionDiagnostic,assertD078ConstructionDiagnostic,d078OwnerConstruction,assertD078OwnerConstruction,D078_PAUSED_UNIFORMS,D078_BASELINE_CONSTRUCTION,d078DetailAlpha,d078PlannedConstructionCamera,d078CameraDetail,D078_CAMERA_DETAIL_CARD_SHA256,D078_CAMERA_DETAIL_PLAN_SHA256,D078_CAMERA_DETAIL_SOURCES,D078_CAMERA_SETTLED_TARGETS,D078_CAMERA_DETAIL_DEPENDENCIES} from './d078-frame.mjs';
import {hashOf,sceneDigest,meshDigest} from '../src/render/digest.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';
import {FACILITY_TOOLS} from '../src/sim/edit.ts';
import {D078_OLD,D078_KT,d078City,d078NeighbourhoodPavilionCity,d078Blocks,d078Civic,d078Expected} from './unit-d078.mjs';

import {d078HistoricalBytes} from './d078-scope.mjs';
import {D078_CAPTURE_SOURCES,D078_SLOTS,D078_ALTERNATE_VIEWS,D078_REPEAT_SLOTS,d078CapturePlan,d078CaptureQuery,assertD078CaptureUrl,assertD078OriginalViewCount,d078CameraZoom} from './d078-capture.mjs';

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
 const source=d078City(sample),city=d078NeighbourhoodPavilionCity(source,force),con=new ConState(city.n),built=buildCityScene(city,D078_KT,STYLES.A,d078Blocks(city),'d',d078Civic(on),con,true);
 con.uni.uDayFrac.value=0;con.uni.uTime.value=2.2;con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(city,k=>D078_KT.cat(k));built.setTreeAges(i=>con.siteAge(i));
 const digest=sceneDigest(built),empty='0:'+hashOf(new Float32Array(0));digest.inst.push(empty+':-:-',empty+':-:-');
 const names=['walls','other','dress'],meshes=built.buildingMeshes(),owners=built.pickOwners();
 const change=(name,fn)=>{
  const i=names.indexOf(name),g=meshes[i].geometry.clone(),ow=owners[i].slice();
  try{fn(g,ow);const actual=structuredClone(digest);actual.meshes[name]=meshDigest({geometry:g},ow);
   const a=g.attributes.normal.array,start=g.drawRange.start*3,end=Math.min(g.attributes.position.count,g.drawRange.start+g.drawRange.count)*3;
   return {actual,words:{[name]:Array.from(new Uint32Array(a.buffer,a.byteOffset+start*4,end-start))}};
  }finally{g.dispose();}
 };
 return {digest,change,meshes,owners,city,con,scene:built.scene,n:city.n,start:owners[1].findIndex(o=>o===-98),dispose:()=>{built.dispose();con.dispose();}};
}
export async function d078FrameGuards(log=()=>{}){
 let failed=0;const report={sourceRef:process.env.GITHUB_SHA??'local D078 candidate',baseline:'22da5314145f96aaa83cfb739c382b86e1d5b0f3',cardSha256:createHash('sha256').update(fs.readFileSync(new URL('../docs/D078-british-neighbourhood-pavilions-ten.md',import.meta.url))).digest('hex'),frameSourceSha256:createHash('sha256').update(fs.readFileSync(new URL('./d078-frame.mjs',import.meta.url))).digest('hex'),captureSourceSha256:createHash('sha256').update(fs.readFileSync(new URL('./d078-capture.mjs',import.meta.url))).digest('hex'),qualification:'Independent Node geometry/frustum oracle tests; not WebGL screenshot evidence.',tests:[],frames:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D078 frame '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D078 frame '+name,e.stack??String(e));}};
 test('complete surface classifier and geometric witnesses are exactly the unchanged D077 policy',()=>{
  const old=fs.readFileSync(new URL('./d077-frame.mjs',import.meta.url),'utf8'),now=fs.readFileSync(new URL('./d078-frame.mjs',import.meta.url),'utf8');
  const section=(code,prefix)=>code.slice(code.indexOf('export function '+prefix+'OwnerClosedComponents'),code.indexOf('export function assert'+prefix.toUpperCase()+'PausedRepeat'));
  assert.equal(section(now,'d078').replaceAll('D078','D077').replaceAll('d078','d077'),section(old,'d077'),'no altered classifier, failed-search exclusion, geometric proof or tolerance');
 });
 test('whole-scene pins equal immutable D077 native/copied baselines and d078Expected',()=>{
  const expected=d078Expected();
  for(const variant of ['native','v0','v1','v2'])for(const sample of ['gallery','seed516','ai120']){
   assert.equal(expected[variant][sample].legacy,D078_OLD[variant][sample].c[0]);
   for(const phase of ['legacy','neighbourhoodPavilion'])assert.equal(expected[variant][sample][phase],D078_FRAME_WHOLE[variant][sample][phase]);
   assert.ok(expected[variant][sample].neighbourhoodPavilion<=expected[variant][sample].legacy);
  }
 });
 test('frame oracle permits only original samples, explicit phases and null or integer variants zero, one or two',()=>{
  for(const force of [-1,3,4,2.5,NaN,Infinity,'0'])assert.throws(()=>createD078FrameOracle('gallery',true,force),/supported copied neighbourhoodPavilion/);
  for(const sample of ['manufactured','gallery-copy',''])assert.throws(()=>createD078FrameOracle(sample,true,0),/known immutable D078 sample/);
  for(const on of [null,undefined,0,1,'after'])assert.throws(()=>createD078FrameOracle('gallery',on,0),/phase must be boolean/);
 });
 test('capture URLs isolate published D077 before and default D078 after without any inherited opt-out',()=>{
  const capture=fs.readFileSync(new URL('./d078-capture.mjs',import.meta.url),'utf8'),cityView=fs.readFileSync(new URL('../src/cityView.ts',import.meta.url),'utf8');
  assert.match(capture,/query:d078CaptureQuery\(source\.sample,phase\)/);assert.match(capture,/await p\.open\(item\.query\)/);assert.match(capture,/assertD078CaptureUrl\(await p\.ev\('location.href'\),source\.sample,phase\)/);
  const condition=cityView.match(/const neighbourhoodPavilionOn = ([^;]+);/);assert.ok(condition);const enabled=Function('q','return ('+condition[1]+')');
  const flags=['neighbourhoodArt','serviceLodgeArt','healthResponseArt','farmMemorialArt','emergencyHotelArt','campusArt','educationArt','commerceThirdArt','commerceVariantArt','facilityArt','landmarkArt','metropolisArt','houseArt','towerArt','commerceArt','industryArt','villageArt','streetArt','britishArt','heritageArt'];assert.equal(flags.length,20);
  for(const flag of flags){assert.ok(condition[1].includes("'"+flag+"'"));assert.equal(enabled(new URLSearchParams(flag+'=legacy')),false);}
  assert.equal(enabled(new URLSearchParams('spaceArt=legacy')),true);assert.equal(enabled(new URLSearchParams('transitUtilityArt=legacy')),true,'D079 isolation preserves the exact D078 phase');
  for(const source of D078_CAPTURE_SOURCES){const before=d078CaptureQuery(source.sample,'before'),after=d078CaptureQuery(source.sample,'after');assert.equal(before,'sample='+source.sample+'&clean=1&transitUtilityArt=legacy&neighbourhoodArt=legacy');assert.equal(after,'sample='+source.sample+'&clean=1&transitUtilityArt=legacy');assert.equal(enabled(new URLSearchParams(before)),false);assert.equal(enabled(new URLSearchParams(after)),true);for(const [phase,q] of [['before',before],['after',after]])assertD078CaptureUrl('http://127.0.0.1:8380/?'+q,source.sample,phase);assert.throws(()=>assertD078CaptureUrl('http://127.0.0.1:8380/?'+before,source.sample,'after'),/actual browser URL/);for(const flag of flags)assert.throws(()=>assertD078CaptureUrl('http://127.0.0.1:8380/?'+after+'&'+flag+'=legacy',source.sample,'after'),/actual browser URL/);}
  for(const phase of [null,undefined,'legacy','neighbourhoodPavilion','BEFORE'])assert.throws(()=>d078CaptureQuery('gallery',phase),/explicit D078/);assert.throws(()=>d078CaptureQuery('gallery&neighbourhoodArt=legacy','after'),/known D078/);
 });
 test('capture plan retains 168 standard originals and 510 total views with bounded exterior/roof angles and stability checks',()=>{
  const plan=d078CapturePlan(),extraCount=Object.values(D078_ALTERNATE_VIEWS).reduce((n,a)=>n+a.length,0),repeatCount=D078_REPEAT_SLOTS.length;
  assert.deepEqual(plan.nativeReachability.kinds,[81,84,85,130]);assert.equal(plan.nativeReachability.nativeToolSlots,0);assert.equal(plan.nativeReachability.savedImportOnlySlots,10);assert.doesNotMatch(fs.readFileSync(new URL('../src/sim/edit.ts',import.meta.url),'utf8'),/k: (?:81|84|85|130)\b/,'no native placement dispatch acquires a target kind');
  assert.equal(plan.captured,false);for(const count of [1,2,3]){const originals=Array.from({length:56*count},()=>({}));assertD078OriginalViewCount([...originals,{additionalView:'extra'},{repeatOf:'first'}],count);assert.throws(()=>assertD078OriginalViewCount(originals.slice(1),count),/baseline views retained/);assert.throws(()=>assertD078OriginalViewCount([...originals,{}],count),/baseline views retained/);}assert.equal(plan.actualOriginalPngs,0,'a plan never claims actual files');assert.equal(plan.completeThreeViewportOriginalPngs,168+6*(extraCount+repeatCount));assert.equal(plan.pausedRepeatViews,6*repeatCount);assert.equal(plan.distinctBuildings,10);assert.equal(repeatCount,2);assert.deepEqual(D078_REPEAT_SLOTS,['81:2','130:1']);assert.equal(plan.preservedOriginalViews,168);assert.equal(plan.additionalRoofViews,6*extraCount);
  assert.deepEqual(D078_SLOTS.map(s=>[s.k,s.v]),[[81,2],[84,0],[84,1],[84,2],[85,0],[85,1],[85,2],[130,0],[130,1],[130,2]]);
  assert.equal(D078_CAPTURE_SOURCES.length,12);
  assert.deepEqual(D078_CAPTURE_SOURCES.filter(s=>s.sample==='gallery').flatMap(s=>s.sites.map(x=>x.k+':'+x.v)).sort(),D078_SLOTS.map(s=>s.k+':'+s.v).sort());
  for(const source of D078_CAPTURE_SOURCES){
   const extra=source.shots.filter(s=>s.additionalView),needed=source.sites.flatMap(site=>(D078_ALTERNATE_VIEWS[source.sample+':'+site.k+':'+site.v]??[]).map(angle=>({site,angle})));
   assert.equal(extra.length,needed.length);assert.equal(source.shots.filter(s=>!s.additionalView&&!s.repeatOf).length,source.sites.length+1);
   for(let i=0;i<needed.length;i++){const {site,angle}=needed[i];assert.ok(Array.from({length:8},(_,q)=>q*Math.PI/4).includes(angle.spinRadians),'yaw is one of the frozen eight legal angles');assert.ok([Math.PI*.08,Math.PI/6,Math.PI*.32].map(e=>e-Math.PI/6).includes(angle.tiltRadians),'elevation is one of the frozen three legal values');assert.deepEqual(Object.keys(angle.zoomByWidth).sort(),['1440','360','412'].sort());for(const z of Object.values(angle.zoomByWidth))assert.ok(z>=.6&&z<=8);assert.deepEqual(extra[i],{...site,id:site.id+'-'+angle.name,name:site.name+' · '+angle.label+' / ADDITIONAL CAMERA VIEW',additionalView:angle.name,spinRadians:angle.spinRadians,tiltRadians:angle.tiltRadians,viewReason:angle.reason,zoomByWidth:angle.zoomByWidth});assert.ok(source.shots.indexOf(extra[i])>Math.max(...source.shots.map((s,j)=>s.additionalView?-1:j)),'alternates append after all original views');}
   const repeats=source.shots.filter(s=>s.repeatOf);assert.equal(repeats.length,source.sites.filter(s=>D078_REPEAT_SLOTS.includes(s.k+':'+s.v)).length);
   for(const shot of repeats){const initial=source.shots[source.shots.indexOf(shot)-1];assert.equal(initial.id,shot.repeatOf);assert.deepEqual(shot,{...initial,id:initial.id+'-paused-repeat',repeatOf:initial.id,pausedFrames:30});}
   if(source.force!==null)assert.match(source.label,/COPIED VARIANT .* SAVED-IMPORT ONLY/);
   for(const site of source.sites){assert.equal(site.sourceVariant,0);assert.equal(site.renderedVariant,source.force??site.sourceVariant);}
  }
 });
 test('original cities retain their exact native target owners and all three copied-variant states',()=>{
  assert.deepEqual(D078_CAPTURE_SOURCES.filter(s=>s.force===null).map(s=>[s.sample,s.targets.map(b=>[b.id,b.k,b.v])]),[
   ['gallery',[[45,84,0],[46,85,0],[90,130,0],[142,81,0]]],['seed516',[]],['ai120',[[15,85,0],[20,84,0]]],
  ],'actual ai120 owners retained; seed516 is the no-target control');
  for(const sample of ['gallery','seed516','ai120']){
   assert.deepEqual(D078_CAPTURE_SOURCES.filter(s=>s.sample===sample).map(s=>s.force),[null,0,1,2]);const source=d078City(sample),before=JSON.stringify(source);
   for(const force of [0,1,2]){const copy=d078NeighbourhoodPavilionCity(source,force);for(let i=0;i<source.buildings.length;i++){const b=source.buildings[i],c=copy.buildings[i];if(D078_SLOTS.some(s=>s.k===b.k&&s.v===force)){assert.notEqual(c,b);assert.deepEqual(c,{...b,v:force});}else assert.equal(c,b,'unsupported slots keep exact original object identity');}assert.equal(JSON.stringify(source),before);}
  }
 });
 test('all original and additional-angle views reproduce exact main/shadow submissions at three widths and two phases',()=>{
  for(const source of D078_CAPTURE_SOURCES){
   const {sample,n,shots,force,variant}=source;
   for(const on of [false,true]){const oracle=createD078FrameOracle(sample,on,force);
    try{for(const v of VIEWPORTS)for(const shot of shots){
     const camera=cameraFor(n,shot,v),frame=oracle.measure(camera,v);if(shot.k)assertD078OwnerFits(oracle.ownerBounds(camera,v,shot.buildingId),sample+' '+variant+' '+on+' '+shot.id+' '+v.W+'px');assert.equal(camera.zoom,d078CameraZoom(source,shot,v));
     assert.equal(frame.wholeTriangles,D078_FRAME_WHOLE[variant][sample][on?'neighbourhoodPavilion':'legacy']);
     const pin=D078_FRAME_VIEW_PINS[variant][sample][on?'neighbourhoodPavilion':'legacy'][v.W][shot.id];assert.deepEqual({triangles:frame.triangles,calls:frame.calls,culledTriangles:frame.culledTriangles,main:frame.main,shadow:frame.shadow},pin,'exact independently recorded main/shadow/frustum submissions for this declared view');
     assert.equal(frame.triangles,frame.main.triangles+frame.shadow.triangles);
     assert.equal(frame.calls,frame.main.calls+frame.shadow.calls);
     if(sample!=='seed516'||!shot.k){assert.equal(frame.culledTriangles,0);assert.deepEqual(frame.culled,[]);}
     assert.deepEqual(oracle.measure(camera,v),frame,'exact deterministic repeat');
     report.frames.push({sample,variant,on,width:v.W,shot:shot.id,triangles:frame.triangles,calls:frame.calls,wholeTriangles:frame.wholeTriangles,culledTriangles:frame.culledTriangles});
    }}finally{oracle.dispose();}
   }
  }
  assert.equal(report.frames.length,d078CapturePlan().completeThreeViewportOriginalPngs);
  for(const before of report.frames.filter(f=>!f.on)){const after=report.frames.find(f=>f.on&&f.sample===before.sample&&f.variant===before.variant&&f.width===before.width&&f.shot===before.shot);assert.equal(after.calls,before.calls);const pin=D078_FRAME_WHOLE[before.variant][before.sample];assert.equal(after.triangles-before.triangles,pin.neighbourhoodPavilion-pin.legacy);}
 });
 test('production spin angles settle exactly and reject unchanged/wrong camera poses',()=>{
  const extras=D078_CAPTURE_SOURCES.flatMap(source=>source.shots.filter(s=>s.additionalView).map(shot=>({source,shot})));
  // Exercise the supported settlement path even when the audited source needs no extra views.
  if(!extras.length){const source=D078_CAPTURE_SOURCES.find(s=>s.sites.length);extras.push({source,shot:{...source.sites[0],spinRadians:Math.PI/2}});}
  for(const {source,shot} of extras)for(const viewport of VIEWPORTS){
   const initial=cameraFor(source.n,{...shot,spinRadians:0,tiltRadians:0},viewport),run=()=>{
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,source.n*6),controls=new OrbitControls(camera,null);
    controls.enableDamping=true;controls.minPolarAngle=Math.PI*.18;controls.maxPolarAngle=Math.PI*.42;controls.minZoom=.6;controls.maxZoom=8;
    controls.target.fromArray(initial.target);camera.position.fromArray(initial.pos);camera.zoom=initial.zoom;camera.lookAt(controls.target);for(let i=0;i<100;i++)controls.update();
    const state=()=>({pos:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom}),baseline=state();
    controls.rotateLeft(shot.spinRadians);if(shot.tiltRadians)controls.rotateUp(shot.tiltRadians);for(let i=0;i<900;i++)controls.rotateLeft(0);const rotated=state();
    assertD078NeighbourhoodPavilionCamera(rotated,baseline,shot.spinRadians,shot.tiltRadians??0);d078CameraDetail(source.n,shot,viewport,rotated);for(let i=0;i<1000;i++)controls.update();assert.deepEqual(state(),rotated,'future animation frames cannot change the settled pose');
    return {baseline,rotated};
   };
   const {baseline,rotated}=run();assert.deepEqual(run(),{baseline,rotated},'before/after camera sequence is deterministic');
   assert.throws(()=>assertD078NeighbourhoodPavilionCamera(baseline,baseline,shot.spinRadians,shot.tiltRadians??0),/alternate differs/);
   for(const key of ['target','pos','zoom']){const bad=structuredClone(rotated);if(key==='zoom')bad.zoom+=.01;else bad[key][0]+=.01;assert.throws(()=>assertD078NeighbourhoodPavilionCamera(bad,baseline,shot.spinRadians,shot.tiltRadians??0),{name:'AssertionError'},'changed '+key+' rejected');}
  }
 });
 test('zero-angle settlement preserves a production roof view and makes the thirty-frame repeat exact',()=>{
  const repeats=D078_CAPTURE_SOURCES.flatMap(source=>source.sites.filter(shot=>D078_REPEAT_SLOTS.includes(shot.k+':'+shot.v)).map(shot=>({source,shot})));assert.equal(repeats.length,2,'both planned thirty-frame model repeats');
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
  for(const source of D078_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){
   const f=browserFixture(source.sample,on,source.force),before=JSON.stringify(f.digest);
   try{for(const site of source.sites){const audits=source.shots.filter(s=>s.k===site.k&&s.v===site.v&&!s.repeatOf).map(shot=>({shot:shot.id,...d078OwnerRayAudit(f,cameraFor(source.n,shot,VIEWPORTS[0]),VIEWPORTS[0],site.buildingId)}));assert.ok(audits.every(a=>a.targetRays>0&&a.visibleRays>0),'every unchanged-scene view intersects the intended owner');report.visibility.push({sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,on,audits});}assert.equal(JSON.stringify(f.digest),before);}finally{f.dispose();}
  }
  assert.equal(report.visibility.length,32);
 });
 test('paired supplementary zoom retains every owner vertex in both phases without changing original views',()=>{
  const material=new THREE.MeshBasicMaterial(),make=(w,h)=>{const g=new THREE.BoxGeometry(w,h,4).toNonIndexed();g.translate(0,h/2,0);const m=new THREE.Mesh(g,material),scene=new THREE.Scene();scene.add(m);return{scene,meshes:[m],owners:[new Int32Array(g.attributes.position.count/3).fill(11)],n:20};},before=make(4,4),after=make(8,8),states=[before,after],view={pos:[20,20,20],target:[0,0,0],zoom:8},original=structuredClone(view),viewport=VIEWPORTS[0],bytes=states.map(f=>Array.from(f.meshes[0].geometry.attributes.position.array));
  try{
   assert.throws(()=>assertD078OwnerFits(d078OwnerBounds(after,view,viewport,11)),/entire owner model fits/,'a clipped original view is reported, never silently reframed');
   const fit=fitD078PairedOwnerView(states,view,viewport,11);assert.ok(fit.zoom<view.zoom&&fit.zoom>=.6);assert.deepEqual(view,original,'original standard view stays unchanged');
   for(const [i,f]of states.entries()){const b=assertD078OwnerFits(d078OwnerBounds(f,fit.view,viewport,11));assert.equal(b.vertices,36);assert.equal(b.triangles,12);assert.deepEqual(Array.from(f.meshes[0].geometry.attributes.position.array),bytes[i]);assert.ok([...b.lo,...b.hi].every(x=>Math.abs(x)<=.94+1e-12));}
   assert.ok(fit.zoom<fitD078PairedOwnerView([before,before],view,viewport,11).zoom,'candidate larger bounds cannot be omitted from the paired fit');
   const p=after.meshes[0].geometry.attributes.position.array,saved=p[0];try{p[0]=1000;assert.throws(()=>assertD078OwnerFits(d078OwnerBounds(after,fit.view,viewport,11)),/entire owner model fits/,'a newly outlying vertex is included');assert.throws(()=>fitD078PairedOwnerView(states,view,viewport,11),/production zoom limits/,'impossible minimum zoom remains a failure');}finally{p[0]=saved;}
   assert.throws(()=>fitD078PairedOwnerView([before],view,viewport,11),/both fitted/);assert.throws(()=>fitD078PairedOwnerView(states,view,viewport,11,1),/fitting margin/);assert.throws(()=>d078OwnerBounds(before,view,viewport,99),/vertex inventory/);
  }finally{for(const f of states)f.meshes[0].geometry.dispose();material.dispose();}
 });
 test('owner-partition acceleration reproduces complete raw Three ray intersections and face identities',()=>{
  for(const source of D078_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){const f=browserFixture(source.sample,on,source.force),objects=[];f.scene.updateMatrixWorld(true);f.scene.traverse(o=>{if(o.isMesh&&o.visible)objects.push(o);});
   try{const acceleration=d078RayObjects(objects,f.meshes,f.owners),canonical=hits=>hits.map(h=>({mesh:objects.indexOf(h.object),face:h.faceIndex,instance:h.instanceId??null,distance:h.distance,point:h.point.toArray(),normal:h.face.normal.toArray()}));
    for(const slot of source.sites){const b=f.city.buildings.find(b=>b.id===slot.buildingId),target=new THREE.Vector3(b.x+b.size/2,0,b.z+b.size/2);
     for(const direction of [[1,1,1],[-1,1,-1],[1,2,-1],[-1,2,1]])for(const height of [.1,.7]){const end=target.clone().add(new THREE.Vector3(.03,height,.04)),origin=end.clone().add(new THREE.Vector3(...direction).multiplyScalar(20)),ray=new THREE.Raycaster(origin,end.clone().sub(origin).normalize());assert.deepEqual(canonical(d078RayHits(ray,acceleration)),canonical(ray.intersectObjects(objects,false)),'no original tree, neighbor, triangle, face or ordered hit is omitted');}
    }
    // Warm bounds, then mutate the live position array without needsUpdate.
    // This must invalidate the cache by content, preserving complete raw hits.
    const model=f.meshes[0],array=model.geometry.attributes.position.array,original=array[0];
    try{array[0]+=3.125;const changed=d078RayObjects(objects,f.meshes,f.owners);assert.notEqual(changed.find(o=>o.userData.d078RayOriginal===model).geometry,acceleration.find(o=>o.userData.d078RayOriginal===model).geometry,'direct typed-array mutation invalidates partition bounds');const point=new THREE.Vector3(array[0],array[1],array[2]),ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(4,4,4)),new THREE.Vector3(-1,-1,-1).normalize());assert.deepEqual(canonical(d078RayHits(ray,changed)),canonical(ray.intersectObjects(objects,false)));}finally{array[0]=original;}
   }finally{f.dispose();}
  }
 });
 test('all ninety-six accelerated surface contracts exactly equal raw Three contracts without sorting or tolerances',()=>{
  report.rawContractParity=[];let count=0;for(const source of D078_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){const f=browserFixture(source.sample,on,source.force);try{for(const site of source.sites)for(const viewport of VIEWPORTS){const view=cameraFor(source.n,site,viewport),actual=d078OwnerSurfaceContract(f,view,viewport,site.buildingId),raw=d078OwnerSurfaceContract(f,view,viewport,site.buildingId,{testOnlyRawSilhouetteRays:true});assert.deepEqual(actual,raw,site.k+':'+site.v+' '+on+' complete ordered samples, coordinates, normals, blockers, classifications and hashes');report.rawContractParity.push({sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,on,width:viewport.W,actualSha256:actual.sha256,rawSha256:raw.sha256,sourceGeometrySha256:actual.sourceGeometrySha256,completeRecords:actual.probes.length,requiredSamples:actual.requiredSamples.length,exact:true});count++;console.log('D078 frame progress raw-contract',JSON.stringify({case:count,sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,on,width:viewport.W}));}}finally{f.dispose();}}
  report.rawContractCases=count;assert.equal(count,96,'sixteen actual target owners in both phases and all three widths have raw complete-contract parity');
 });
 test('enclosure witnesses require complete correctly wound solids and reject open, elevated and non-manifold substitutes',()=>{
  const geometry=new THREE.BoxGeometry(2,2,2).toNonIndexed();geometry.translate(0,1,0);
  const triangles=g=>{const p=g.attributes.position;return Array.from({length:p.count/3},(_,t)=>{const vertices=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,t*3+j)),normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize();return {mi:0,t,vertices,normal};});};
  try{const original=triangles(geometry),box=d078OwnerBoxWitnesses(original,0);assert.equal(box.length,1);assert.equal(d078OwnerClosedComponents(original,0).length,1);
   for(const face of box[0].faces.filter(f=>f.axis!==1||f.sign===1))for(const entry of face.triangles)for(const mode of ['missing','reversed']){const changed=original.map(t=>({...t,vertices:t.vertices.map(v=>v.clone()),normal:t.normal.clone()}));if(mode==='missing')changed.splice(changed.findIndex(t=>t.t===entry.triangle),1);else{const tri=changed.find(t=>t.t===entry.triangle);[tri.vertices[1],tri.vertices[2]]=[tri.vertices[2],tri.vertices[1]];tri.normal.negate();}assert.equal(d078OwnerBoxWitnesses(changed,0).length,0,mode+' actual box face rejects');assert.equal(d078OwnerClosedComponents(changed,0).length,0,mode+' actual component face rejects');}
   const duplicate=original.map(t=>({...t,vertices:t.vertices.map(v=>v.clone()),normal:t.normal.clone()}));duplicate[1]=duplicate[0];assert.equal(d078OwnerBoxWitnesses(duplicate,0).length,0,'duplicate half-rectangle cannot cover a complete face');
   const open=original.filter(t=>t.normal.y>0);assert.equal(d078OwnerBoxWitnesses(open,0).length,0);assert.equal(d078OwnerClosedComponents(open,0).length,0,'open screen has no enclosure witness');
   const elevated=original.filter(t=>t.normal.y>=0).map(t=>({...t,vertices:t.vertices.map(v=>v.clone().add(new THREE.Vector3(0,2,0)))}));assert.equal(d078OwnerBoxWitnesses(elevated,0).length,0);assert.equal(d078OwnerClosedComponents(elevated,0).length,0,'elevated open-bottom shell cannot use the ground exception');
   assert.equal(d078OwnerClosedComponents([...original,...original],0).length,0,'four cancelling edge incidents are non-manifold and reject');
   const reversed=original.map(t=>({...t,vertices:[t.vertices[0],t.vertices[2],t.vertices[1]],normal:t.normal.clone().negate()}));assert.equal(d078OwnerClosedComponents(reversed,0).length,0,'an inward shell has no positive oriented volume');
  }finally{geometry.dispose();}
 });
 test('upward contact cover needs the actual complete top and four sides and never excludes vertical or below-base points',()=>{
  const flat=y=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-.2,y,-.2,0,y,.2,.2,y,-.2],3));g.computeVertexNormals();return g;},material=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),base=new THREE.Mesh(flat(0),material),target=new THREE.Mesh(flat(1),material),source=new THREE.BoxGeometry(2,1,2).toNonIndexed();source.translate(0,1.5,0);const p=source.attributes.position,keep=[];for(let t=0;t<p.count/3;t++)if(![0,1,2].every(j=>p.getY(t*3+j)===1))for(let j=0;j<3;j++)keep.push(p.getX(t*3+j),p.getY(t*3+j),p.getZ(t*3+j));const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(keep,3));geometry.computeVertexNormals();source.dispose();const canopy=new THREE.Mesh(geometry,material),scene=new THREE.Scene();scene.add(base,target,canopy);const meshes=[base,target,canopy],owners=[new Int32Array([11]),new Int32Array([11]),new Int32Array(10).fill(11)],f={scene,meshes,owners,n:20},camera={pos:[10,15,10],target:[0,0,0],zoom:1},sample=()=>d078OwnerSurfaceContract(f,camera,VIEWPORTS[0],11).probes.find(p=>p.mesh===1&&p.source==='fixed-triangle');
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
  try{let contract=d078OwnerSurfaceContract(f,camera,VIEWPORTS[0],11);assert.ok(contract.probes.filter(p=>p.mesh===0&&p.source==='fixed-triangle').every(p=>p.required),'same-owner open screen and a separate closed solid do not establish enclosure');box.geometry.translate(-3,0,0);owners[2].fill(22);contract=d078OwnerSurfaceContract(f,camera,VIEWPORTS[0],11);assert.ok(contract.probes.filter(p=>p.mesh===0&&p.source==='fixed-triangle').every(p=>p.required),'another owner cannot establish a same-owner enclosure');owners[2].fill(11);contract=d078OwnerSurfaceContract(f,camera,VIEWPORTS[0],11);assert.ok(contract.probes.filter(p=>p.mesh===0&&p.source==='fixed-triangle').every(p=>!p.required&&p.blocker.enclosure),'a demonstrated complete containing owner box provides a retained witness');}finally{for(const m of meshes)m.geometry.dispose();material.dispose();}
 });
 test('coincident exterior equivalence requires exact owner, point, orientation and absence of a closer blocker',()=>{
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([-2,1,-2,0,1,2,2,1,-2],3));g.computeVertexNormals();const material=new THREE.MeshBasicMaterial({side:THREE.FrontSide}),mesh=new THREE.Mesh(g,material),scene=new THREE.Scene();scene.add(mesh);const owners=[new Int32Array([11])],f={scene,meshes:[mesh],owners,n:20},v=VIEWPORTS[0],camera={pos:[10,15,10],target:[0,0,0],zoom:1},contract={owner:11,sha256:'test',requiredSamples:['coincident'],probes:[{id:'coincident',required:true,mesh:0,triangle:1,point:[0,1,0],normal:[0,1,0]}]},audit=()=>d078OwnerSurfaceRayAudit(f,camera,v,contract).samples[0];
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
  for(const source of D078_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){
   const oracle=createD078FrameOracle(source.sample,on,source.force);
   try{for(const site of source.sites)for(const viewport of VIEWPORTS){
    const original=cameraFor(source.n,site,viewport),contract=oracle.surfaceContract(original,viewport,site.buildingId),owner=oracle.ownerVisibility(original,viewport,site.buildingId);
    assert.equal(contract.fixedTriangleSamples,contract.triangleCount*4);assert.equal(contract.originalHits,owner.targetRays);assert.equal(contract.originalBlockedHits,owner.blockedRays);
    assert.equal(contract.probes.filter(p=>p.source==='original-silhouette'&&p.required).length,owner.targetRays);assert.equal(contract.probes.filter(p=>p.source==='original-silhouette'&&p.externallyBlocked&&p.required).length,owner.blockedRays);assert.ok(Object.isFrozen(contract)&&contract.probes.every(Object.isFrozen));
    const views=source.shots.filter(s=>s.k===site.k&&s.v===site.v&&!s.repeatOf),audits=views.map(s=>oracle.surfaceVisibility(cameraFor(source.n,s,viewport),viewport,contract));
    const coverage=assertD078SurfaceCoverage(audits,contract,site.k+':'+site.v+' '+(on?'after':'before')+' '+viewport.W+'px');
    let archivedCoverage=null;if(!on){const precode=oracle.productionSurfaceContract(viewport,site.buildingId);assert.deepEqual(precode,contract,'all exact production-camera pre-code records retained');const archived=oracle.archivedSurfaceContract(viewport,site.buildingId),archivedAudits=views.map(s=>oracle.surfaceVisibility(cameraFor(source.n,s,viewport),viewport,archived));archivedCoverage=assertD078SurfaceCoverage(archivedAudits,archived,'every archived baseline fixed record and original silhouette hit also retained');assert.deepEqual(archived.probes.filter(p=>p.source==='fixed-triangle'),contract.probes.filter(p=>p.source==='fixed-triangle'),'camera arithmetic never changes fixed geometric records');}
    assert.throws(()=>assertD078SurfaceCoverage([audits[0]],contract),/every fixed exterior point/,'one view cannot silently omit rear surfaces');
    const removed=structuredClone(contract);removed.probes.pop();assert.throws(()=>assertD078SurfaceCoverage(audits,removed),/surface-contract digest/);
    const hidden=structuredClone(audits),required=contract.requiredSamples[0];for(const audit of hidden){audit.samples.find(s=>s.id===required).visible=false;audit.visibleSamples=audit.visibleSamples.filter(id=>id!==required);}assert.throws(()=>assertD078SurfaceCoverage(hidden,contract),/every fixed exterior point/);
    report.surfaceCoverage.push({sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,on,width:viewport.W,coverage,archivedCoverage,contract});console.log('D078 frame progress full-surface',JSON.stringify({case:report.surfaceCoverage.length,sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,on,width:viewport.W,required:coverage.requiredSamples,covered:coverage.coveredSamples}));
   }}finally{oracle.dispose();}
  }
  report.archivedSurfaceCases=report.surfaceCoverage.filter(r=>r.archivedCoverage).length;assert.equal(report.archivedSurfaceCases,48,'every archived owner-width is fully covered');assert.equal(report.surfaceCoverage.length,96,'all sixteen owner cases in both phases at all three exact widths');assert.equal(report.surfaceCoverage.filter(r=>!r.on).reduce((n,r)=>n+r.coverage.requiredSamples,0),33558);assert.equal(report.surfaceCoverage.reduce((n,r)=>n+(r.archivedCoverage?.requiredSamples??0),0),33558);
 });
 test('missing or reversed actual target wall and roof faces reject intact frozen surface contracts',()=>{
  let controls=0;
  for(const source of D078_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true])for(const viewport of VIEWPORTS){const f=browserFixture(source.sample,on,source.force);
   try{for(const site of source.sites){
    const contract=d078OwnerSurfaceContract(f,cameraFor(source.n,site,viewport),viewport,site.buildingId),views=source.shots.filter(s=>s.k===site.k&&s.v===site.v&&!s.repeatOf),originalAudits=views.map(s=>d078OwnerSurfaceRayAudit(f,cameraFor(source.n,s,viewport),viewport,contract));assertD078SurfaceCoverage(originalAudits,contract);
    for(const [name,predicate]of [['wall',p=>Math.abs(p.normal[1])<.1],['roof',p=>p.normal[1]>.1]])for(const mode of ['missing','reversed']){
     const probe=contract.probes.find(p=>p.required&&p.source==='fixed-triangle'&&predicate(p));assert.ok(probe,'required '+name+' point');const model=f.meshes[probe.mesh],original=model.geometry,changed=original.clone(),p=changed.attributes.position.array,t=probe.triangle*9;
     try{if(mode==='missing')for(let j=0;j<9;j++)p[t+j]=p[t+j%3];else for(let j=0;j<3;j++)[p[t+3+j],p[t+6+j]]=[p[t+6+j],p[t+3+j]];model.geometry=changed;const audits=views.map(s=>d078OwnerSurfaceRayAudit(f,cameraFor(source.n,s,viewport),viewport,contract));assert.throws(()=>assertD078SurfaceCoverage(audits,contract),/every fixed exterior point/,mode+' '+name+' must reject');controls++;}finally{model.geometry=original;changed.dispose();}
    }
    assert.deepEqual(views.map(s=>d078OwnerSurfaceRayAudit(f,cameraFor(source.n,s,viewport),viewport,contract)),originalAudits);console.log('D078 frame progress mutation-controls',JSON.stringify({case:controls/4,sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,on,width:viewport.W,controls}));
   }}finally{f.dispose();}
  }
  report.fixedSurfaceNegativeControls=controls;assert.equal(controls,384,'missing/reversed wall/roof controls for all sixteen actual owners in BOTH phases');
 });
 test('camera-derived detail follows the independently frozen published law for all510 planned views and rejects wrong cameras or LOD',()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../docs/D078-camera-detail-correction.md',import.meta.url))).digest('hex'),D078_CAMERA_DETAIL_CARD_SHA256,'immutable supplemental pre-code correction');
  for(const [file,pin]of Object.entries(D078_CAMERA_DETAIL_SOURCES))assert.equal(createHash('sha256').update(d078HistoricalBytes(file)).digest('hex'),pin,'independent immutable published camera/detail source '+file);
  const old=d078HistoricalBytes('src/cityView.ts'),current=fs.readFileSync(new URL('../src/cityView.ts',import.meta.url),'utf8'),sections=[s=>s.slice(s.indexOf('  const labZoom ='),s.indexOf('// D062-BEGIN weather-draw')),s=>s.slice(s.indexOf('  function resize()'),s.indexOf("  addEventListener('resize'")),s=>s.slice(s.indexOf('    view(x: number'),s.indexOf('    // 只改畫面的屋齡'))];for(const section of sections)assert.equal(section(current),section(old),'actual published resize/view/detail/draw semantics remain byte-identical');
  const boundaries=[[0,0],[.7499999999999999,0],[.75,0],[.7500000000000001,0],[.8999999999999999,0],[.9,.58],[.9000000000000001,.58],[.9999999999999999,.58],[1,.78],[1.0000000000000002,.78],[1.2999999999999998,.78],[1.3,1],[1.3000000000000003,1]];for(const [z,value]of boundaries)assert.equal(d078DetailAlpha(z),value,'exact published threshold and adjacent representable values');for(const z of [-1,NaN,Infinity,'1',null])assert.throws(()=>d078DetailAlpha(z),/finite nonnegative/);
  const dependencyFiles={packageLockSha256:'../package-lock.json',orbitControlsSha256:'../node_modules/three/examples/jsm/controls/OrbitControls.js',vector3Sha256:'../node_modules/three/src/math/Vector3.js'};for(const [key,file]of Object.entries(dependencyFiles))assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,import.meta.url))).digest('hex'),D078_CAMERA_DETAIL_DEPENDENCIES[key],'exact locked production target-clamp dependency');
  assert.equal(D078_CAMERA_SETTLED_TARGETS.length,7);for(const pin of D078_CAMERA_SETTLED_TARGETS){const target=new THREE.Vector3(...pin.requested);target.clampLength(0,Infinity);target.clampLength(0,Infinity);assert.deepEqual(target.toArray(),pin.settled);for(let i=0;i<1000;i++){target.clampLength(0,Infinity);assert.deepEqual(target.toArray(),pin.settled,'exact target fixed point, not a tolerance');}const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,432),controls=new OrbitControls(camera,null);controls.enableDamping=true;controls.minPolarAngle=Math.PI*.18;controls.maxPolarAngle=Math.PI*.42;controls.minZoom=.6;controls.maxZoom=8;controls.screenSpacePanning=true;controls.target.fromArray(pin.requested);camera.position.set(pin.requested[0]+115.2,94.06040612287404,pin.requested[2]+115.2);camera.lookAt(controls.target);for(let i=0;i<1000;i++)controls.update();assert.deepEqual(controls.target.toArray(),pin.settled,'locked actual OrbitControls preserves exact independent target pin');}
  const overviewSource=D078_CAPTURE_SOURCES.find(s=>s.sample==='gallery'&&s.force===null),overview=overviewSource.shots[0];let recordedCameras=0;for(const viewport of VIEWPORTS)for(const label of ['native-before','native-after','v0-before']){const camera={pos:[151.19999999999996,94.06040612287404,151.2],target:[35.99999999999999,0,35.99999999999999],zoom:viewport.W===1440?0.7776000000000001:.6};assert.equal(d078CameraDetail(72,overview,viewport,camera).uDetail,0,label+' retained actual first-red overview');recordedCameras++;}assert.equal(recordedCameras,9);
  const nextUp=x=>{assert.ok(Number.isFinite(x)&&x>0);const value=new Float64Array([x]),bits=new BigUint64Array(value.buffer);bits[0]+=1n;return value[0];};
  const rows=[],counts={};let negativeControls=0;
  for(const source of D078_CAPTURE_SOURCES)for(const phase of ['before','after'])for(const viewport of VIEWPORTS)for(const shot of source.shots){
   const camera=cameraFor(source.n,shot,viewport);assert.deepEqual(d078PlannedConstructionCamera(source.n,shot,viewport),camera,'existing independent frame camera is unchanged');const settledCamera={...camera,target:[...D078_CAMERA_SETTLED_TARGETS.find(p=>p.requested.every((x,i)=>x===camera.target[i])).settled]},detail=d078CameraDetail(source.n,shot,viewport,settledCamera);assert.equal(detail.uDetail,shot.k?1:0);counts[detail.uDetail]=(counts[detail.uDetail]??0)+1;rows.push({source:source.id,phase,shot:shot.id,n:source.n,viewport,camera,labZoom:detail.labZoom,uDetail:detail.uDetail});
   const expected={uniforms:structuredClone(D078_PAUSED_UNIFORMS),trees:[]},actual={uniforms:{...structuredClone(D078_PAUSED_UNIFORMS),uDetail:detail.uDetail},trees:[]},context={n:source.n,shot,viewport,camera:settledCamera,actualViewport:{W:viewport.W,H:viewport.H},labZoom:detail.labZoom,uDetail:detail.uDetail};assertD078ConstructionDiagnostic(actual,expected,context);
   for(const value of [0,.58,.78,1].filter(v=>v!==detail.uDetail)){const wrong=structuredClone(actual);wrong.uniforms.uDetail=value;assert.throws(()=>assertD078ConstructionDiagnostic(wrong,expected,context),/uniforms/);negativeControls++;}
   for(const key of ['pos','target','zoom']){const wrong=structuredClone(context);if(key==='zoom')wrong.camera.zoom+=.01;else wrong.camera[key][0]+=.01;assert.throws(()=>assertD078ConstructionDiagnostic(actual,expected,wrong),/original planned/);negativeControls++;}
   for(const key of ['target','zoom']){const wrong=structuredClone(context);if(key==='zoom')wrong.camera.zoom=nextUp(wrong.camera.zoom);else wrong.camera.target[0]=nextUp(wrong.camera.target[0]);assert.throws(()=>assertD078ConstructionDiagnostic(actual,expected,wrong),/original planned/,'one-ULP '+key+' change cannot pass exact equality');negativeControls++;}
   for(const [key,value]of [['labZoom',detail.labZoom+.01],['uDetail',detail.uDetail===1?0:1],['actualViewport',{W:viewport.W+1,H:viewport.H}]]){const wrong={...context,[key]:value};assert.throws(()=>assertD078ConstructionDiagnostic(actual,expected,wrong),/actual (?:lab zoom|detail|viewport)/);negativeControls++;}
  }
  assert.equal(rows.length,510);assert.deepEqual(counts,{0:72,1:438});assert.equal(negativeControls,5610);assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),D078_CAMERA_DETAIL_PLAN_SHA256,'all510 independent pre-correction camera/detail rows remain exact');
  const capture=fs.readFileSync(new URL('./d078-capture.mjs',import.meta.url),'utf8');assert.match(capture,/verifyConstructionDiagnostic\(p,oracle,source,source.shots\[0\],v\)/);assert.match(capture,/verifyConstructionDiagnostic\(p,oracle,source,s,v\)/);assert.match(capture,/actualViewport:\{W:innerWidth,H:innerHeight\}/);assert.match(capture,/docs\/D078-camera-detail-correction\.md/);assert.doesNotMatch(capture,/uDetail\s*(?:=|\.value\s*=)/,'read-only detail comparison cannot force the renderer');
  report.cameraDetail={plannedViews:rows.length,counts,negativeControls,oneUlpControls:1020,boundaryCases:boundaries.length,settledTargets:7,retainedActualCameraWitnesses:recordedCameras,planSha256:D078_CAMERA_DETAIL_PLAN_SHA256,correctionCardSha256:D078_CAMERA_DETAIL_CARD_SHA256};
 });
 test('construction uniforms reject clipping bypass, probe isolation, time drift and every changed tree buffer',()=>{
  for(const sample of ['gallery','ai120'])for(const force of [0,1,2]){const f=browserFixture(sample,true,force);try{const expected=d078ConstructionDiagnostic(f.scene,f.con);assertD078ConstructionDiagnostic(expected,expected);for(const [key,value] of [['uDayFrac',1],['uTime',3],['uDetail',1],['uProbe',[0,0]],['uNoClip',1]]){const wrong=structuredClone(expected);wrong.uniforms[key]=value;assert.throws(()=>assertD078ConstructionDiagnostic(wrong,expected),/uniforms/);}for(const key of ['ages','matrices']){const wrong=structuredClone(expected),tree=wrong.trees.find(t=>t.count>0);assert.ok(tree);tree[key][0]+=.1;assert.throws(()=>assertD078ConstructionDiagnostic(wrong,expected),/tree age and transform/);}const missing=structuredClone(expected);missing.trees.pop();assert.throws(()=>assertD078ConstructionDiagnostic(missing,expected),/tree age and transform/);const source=D078_CAPTURE_SOURCES.find(s=>s.sample===sample&&s.force===force),shot=source.shots.find(s=>s.k),viewport=VIEWPORTS[0],requested=cameraFor(source.n,shot,viewport),camera={...requested,target:[...D078_CAMERA_SETTLED_TARGETS.find(p=>p.requested.every((x,i)=>x===requested.target[i])).settled]},detail=d078CameraDetail(source.n,shot,viewport,camera),context={n:source.n,shot,viewport,camera,actualViewport:{W:viewport.W,H:viewport.H},labZoom:detail.labZoom,uDetail:detail.uDetail},actual=structuredClone(expected);actual.uniforms.uDetail=detail.uDetail;assert.equal(detail.uDetail,1);assertD078ConstructionDiagnostic(actual,expected,context);for(const [key,value]of [['uDayFrac',1],['uTime',3],['uProbe',[0,0]],['uNoClip',1]]){const wrong=structuredClone(actual);wrong.uniforms[key]=value;assert.throws(()=>assertD078ConstructionDiagnostic(wrong,expected,context),/uniforms/);}for(const key of ['ages','matrices']){const wrong=structuredClone(actual);wrong.trees.find(t=>t.count>0)[key][0]+=.1;assert.throws(()=>assertD078ConstructionDiagnostic(wrong,expected,context),/tree age and transform/);}}finally{f.dispose();}}
 });
 test('independent intended roof points are closed and directly unoccluded across planned cameras at every width',()=>{
  report.roofVisibility=[];
  for(const source of D078_CAPTURE_SOURCES.filter(s=>s.sites.length)){
   const oracle=createD078FrameOracle(source.sample,true,source.force);
   try{for(const site of source.sites)for(const viewport of VIEWPORTS){
    const views=source.shots.filter(s=>s.k===site.k&&s.v===site.v&&!s.repeatOf),audits=views.map(s=>oracle.roofVisibility(cameraFor(source.n,s,viewport),viewport,site.buildingId));
    const coverage=assertD078RoofCoverage(audits,'k'+site.k+':v'+site.v+' '+viewport.W+'px roof');
    report.roofVisibility.push({sample:source.sample,owner:site.buildingId,slot:site.k+':'+site.v,width:viewport.W,coverage,audits});
   }}finally{oracle.dispose();}
  }
  assert.equal(report.roofVisibility.length,48,'all sixteen actual owner roofs at all three widths');
 });
 test('missing and back-facing actual roof surfaces cannot pass independent intended-plan ray probes',()=>{
  let firstAudit,negativeControls=0;
  for(const source of D078_CAPTURE_SOURCES.filter(s=>s.sites.length)){
   const viewport=VIEWPORTS[0],f=browserFixture(source.sample,true,source.force);
   try{for(const site of source.sites){
    const camera=cameraFor(source.n,site,viewport),audit=d078RoofRayAudit(f,camera,viewport,site.buildingId),sample=audit.samples[0],model=f.meshes[sample.mesh],original=model.geometry;
    firstAudit??=audit;
    for(const mode of ['missing','back-facing']){
     const changed=original.clone(),p=changed.attributes.position.array,t=sample.triangle*9;
     try{
      if(mode==='missing')for(let j=0;j<9;j++)p[t+j]=p[t+j%3];
      else for(let j=0;j<3;j++)[p[t+3+j],p[t+6+j]]=[p[t+6+j],p[t+3+j]];
      model.geometry=changed;
      assert.throws(()=>d078RoofRayAudit(f,camera,viewport,site.buildingId),{name:'AssertionError'},site.k+':'+site.v+' '+mode+' roof cannot prove the independent covered-plan point');negativeControls++;
     }finally{model.geometry=original;changed.dispose();}
    }
    assert.deepEqual(d078RoofRayAudit(f,camera,viewport,site.buildingId),audit,'negative controls restore every original surface');
   }}finally{f.dispose();}
  }
  report.roofNegativeControls=negativeControls;assert.equal(negativeControls,32,'missing and back-facing actual roof controls for all sixteen owner cases');
  const fullyVisible=structuredClone(firstAudit);fullyVisible.visibleSamples=[...firstAudit.expectedSamples];fullyVisible.samples.forEach(s=>{s.visible=true;s.blocker=null;});assertD078RoofCoverage([fullyVisible]);
  const absent=structuredClone(fullyVisible);absent.visibleSamples.pop();absent.samples.at(-1).visible=false;assert.throws(()=>assertD078RoofCoverage([absent]),/every intended roof sample/,'a camera without one roof point cannot prove coverage');
  const incomplete=structuredClone(fullyVisible);incomplete.expectedSamples.pop();incomplete.samples.pop();incomplete.visibleSamples.pop();assert.throws(()=>assertD078RoofCoverage([incomplete]),/independently intended/,'removing an entire intended roof probe cannot weaken the coverage set');
  const invented=structuredClone(fullyVisible);invented.visibleSamples.push('invented-roof');assert.throws(()=>assertD078RoofCoverage([invented]),/invented/);
  const wrong=structuredClone(fullyVisible);wrong.owner++;assert.throws(()=>assertD078RoofCoverage([fullyVisible,wrong]),/same owner/);
 });
 test('paused repeat requires exact PNG, canvas, world, camera, presentation and submitted geometry',()=>{
  const initial={sha256:'a'.repeat(64),canvasSha256:'b'.repeat(64),worldSha256:'c'.repeat(64),camera:{pos:[1,2,3],target:[4,0,6],zoom:2},presentation:{visT:2.2,dayFrac:0},constructionState:{originalAge:400,rise:1},constructionDiagnostic:{uNoClip:0,uTime:2.2},render:{calls:9,triangles:61064},renderAll:{calls:9,triangles:61064},width:1440,height:1000,bytes:5000};
  assertD078PausedRepeat(structuredClone(initial),initial);
  for(const key of Object.keys(initial)){const bad=structuredClone(initial);if(typeof bad[key]==='string')bad[key]='d'.repeat(64);else if(typeof bad[key]==='number')bad[key]++;else if(key==='camera')bad[key].pos[0]+=.001;else if(key==='presentation')bad[key].visT+=.01;else if(key==='constructionState')bad[key].originalAge++;else if(key==='constructionDiagnostic')bad[key].uNoClip=1;else bad[key].triangles++;
   assert.throws(()=>assertD078PausedRepeat(bad,initial),{name:'AssertionError'},'changed '+key+' must reject');
   const missing=structuredClone(initial);delete missing[key];assert.throws(()=>assertD078PausedRepeat(missing,missing),{name:'AssertionError'},'missing '+key+' cannot prove stability');
  }
  const capture=fs.readFileSync(new URL('./d078-capture.mjs',import.meta.url),'utf8');
  assert.match(capture,/await p\.frames\(s\.pausedFrames\)/,'actual repeat waits thirty presentation frames');
  assert.match(capture,/if\(s\.repeatOf\)assertD078PausedRepeat\(/,'actual images use strict equality validator');
 });
 test('original D067 seed516 owner201 framing and full culling remain exact in both D078 phases',()=>{
  const city=d078City('seed516'),b=city.buildings.find(b=>live(city,b)&&b.k===116);assert.equal(b.id,201);const shot={k:116,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size};
  for(const on of [false,true]){const oracle=createD078FrameOracle('seed516',on);try{for(const v of VIEWPORTS){const frame=oracle.measure(cameraFor(city.n,shot,v),v);assert.equal(frame.wholeTriangles,112758);assert.equal(frame.triangles,108838);assert.equal(frame.calls,13);assert.equal(frame.culledTriangles,3920);assert.deepEqual(frame.culled.map(m=>[m.name,m.instances,m.triangles,m.main.reason,m.castShadow]),[['inst6',280,1680,'frustum',false],['inst8',280,2240,'frustum',false]]);assert.deepEqual(frame.shadow,{triangles:28308,calls:5});assert.deepEqual(frame.main,{triangles:80530,calls:8});}}finally{oracle.dispose();}}
 });
 test('wrong submitted triangle/call counts and substituting whole-scene count are rejected',()=>{
  const o=createD078FrameOracle('seed516',true),city=d078City('seed516'),n=city.n,b=city.buildings.find(b=>live(city,b)&&b.k===116),shots=[null,{k:116,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size}],v=VIEWPORTS[0];
  try{const frame=o.measure(cameraFor(n,shots[1],v),v);
   const exact=D078_FRAME_WHOLE.native.seed516.neighbourhoodPavilion-3920;assertD078Frame({triangles:exact,calls:13},frame);
   assert.throws(()=>assertD078Frame({triangles:exact+1,calls:13},frame),/triangles agree/);
   assert.throws(()=>assertD078Frame({triangles:exact,calls:14},frame),/calls agree/);
   assert.throws(()=>assertD078Frame({triangles:D078_FRAME_WHOLE.native.seed516.neighbourhoodPavilion,calls:13},frame),/triangles agree/);
  }finally{o.dispose();}
 });
 test('injected real model triangle is rejected by whole-scene cap before any frustum test',()=>{
  const o=createD078FrameOracle('seed516',true),city=d078City('seed516'),n=city.n,b=city.buildings.find(b=>live(city,b)&&b.k===116),shots=[null,{k:116,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size}],v=VIEWPORTS[0];
  let model; o.scene.traverse(m=>{if(!model&&m.isMesh&&!m.isInstancedMesh&&m.castShadow)model=m;});assert.ok(model);
  const original=model.geometry,extra=original.clone(),end=original.drawRange.start+original.drawRange.count;
  try{
   assert.ok(!extra.index&&end+3<=extra.attributes.position.count,'production arena has one spare triangle');
   for(const at of Object.values(extra.attributes))for(let j=0;j<3;j++)for(let k=0;k<at.itemSize;k++)at.array[(end+j)*at.itemSize+k]=at.array[(original.drawRange.start+j)*at.itemSize+k];
   extra.setDrawRange(original.drawRange.start,original.drawRange.count+3);model.geometry=extra;
   assert.throws(()=>o.measure(cameraFor(n,shots[1],v),v),/immutable whole-scene triangle budget/);
   model.geometry=original;assert.equal(o.measure(cameraFor(n,shots[1],v),v).wholeTriangles,D078_FRAME_WHOLE.native.seed516.neighbourhoodPavilion);
  }finally{model.geometry=original;extra.dispose();o.dispose();}
 });
 test('geometry snapshot includes all building owner attributes and instance counts/transforms, independent of construction ages',()=>{
  for(const sample of ['gallery','seed516','ai120']){
   const a=createD078FrameOracle(sample,false),b=createD078FrameOracle(sample,true),again=createD078FrameOracle(sample,true);
   try{
    assert.deepEqual(Object.keys(b.geometry.meshes),['walls','other','dress']);
    assert.ok(b.geometry.instTransforms.length>=2);for(const token of b.geometry.instTransforms)assert.match(token,/^\d+:[0-9a-f]{8}$/);
    assert.deepEqual(a.geometry.instTransforms,b.geometry.instTransforms,'original trees and their order/transforms stay exact');
    if(sample==='gallery'||sample==='ai120')assert.notDeepEqual(a.geometry.meshes,b.geometry.meshes,'changed production owner attributes are not ignored');else assert.deepEqual(a.geometry.meshes,b.geometry.meshes,'native city without supported target slots remains byte-exact');
    assert.deepEqual(again.geometry,b.geometry,'fresh independent scenes have identical geometry snapshots');
   }finally{a.dispose();b.dispose();again.dispose();}
  }
 });
 test('render-only saved preview geometry is independently matched and native/copied world records are never mutated',()=>{
  const source=d078City('gallery'),before=JSON.stringify(source);
  assert.equal(d078NeighbourhoodPavilionCity(source,null),source,'native mode returns original world');
  for(const force of [0,1,2]){
   const copy=d078NeighbourhoodPavilionCity(source,force);assert.notEqual(copy,source);assert.notEqual(copy.buildings,source.buildings);
   for(let i=0;i<source.buildings.length;i++){const b=source.buildings[i],c=copy.buildings[i];
    if(D078_SLOTS.some(s=>s.k===b.k&&s.v===force)){assert.notEqual(c,b);assert.deepEqual(c,{...b,v:force});}else assert.equal(c,b,'every unsupported slot and unrelated building record is reused unchanged');
   }
   for(const [kind,unsupported] of [[81,0],[81,1]])if(force===unsupported){const i=source.buildings.findIndex(b=>b.k===kind);assert.equal(copy.buildings[i],source.buildings[i],'unsupported request retains exact native object identity and variant');}
   for(const on of [false,true]){const o=createD078FrameOracle('gallery',on,force),f=browserFixture('gallery',on,force);
    try{assert.equal(o.assertBrowserGeometry(f.digest).canonicalization.eligibleComponents,0);}finally{o.dispose();f.dispose();}
   }
   assert.equal(JSON.stringify(source),before,'native world fields unchanged');
  }
  for(const force of [1,2]){const o=createD078FrameOracle('gallery',true,force);
   try{for(const wrong of [null,0,1,2].filter(v=>v!==force)){const f=browserFixture('gallery',true,wrong);
    try{assert.throws(()=>o.assertBrowserGeometry(f.digest),{name:'AssertionError'},'wrong copied saved variant cannot prove target geometry');}finally{f.dispose();}
   }}finally{o.dispose();}
  }
 });
 test('browser geometry admits only the two exact trailing empty UI instances and rejects all other mismatches',()=>{
  const o=createD078FrameOracle('seed516',true);
  try{
   const empty='0:'+hashOf(new Float32Array(0));
   const browser={meshes:structuredClone(o.geometry.meshes),instTransforms:[...o.geometry.instTransforms,empty,empty]};
   assertD078BrowserGeometry(browser,o.geometry);
   for(const [name,mutate] of [
    ['missing UI instance',a=>a.instTransforms.pop()],
    ['third extra UI instance',a=>a.instTransforms.push(empty)],
    ['nonzero UI count',a=>a.instTransforms[a.instTransforms.length-1]='1:'+hashOf(new Float32Array(16))],
    ['changed tree transform',a=>a.instTransforms[0]=a.instTransforms[0].split(':')[0]+':deadbeef'],
    ['changed owner mesh',a=>a.meshes.walls[0]='00000000'],
    ['changed owner triangle count',a=>{const owner=Object.keys(a.meshes.walls[1])[0];a.meshes.walls[1][owner]++;}],
   ]){
    const changed=structuredClone(browser);mutate(changed);
    assert.throws(()=>assertD078BrowserGeometry(changed,o.geometry),{name:'AssertionError'},name+' must reject');
   }
   assertD078BrowserGeometry(browser,o.geometry,'unaltered control');
  }finally{o.dispose();}
 });
 test('uploaded-word reconstruction admits only the 18 diagnosed D060 residuals and leaves source geometry exact',()=>{
  for(const on of [false,true]){
   const o=createD078FrameOracle('seed516',on),f=browserFixture('seed516',on);
   try{
    const before=JSON.stringify(o.geometry),exact=o.assertBrowserGeometry(f.digest);
    assert.equal(exact.canonicalization.changedComponents,0);assert.equal(exact.canonicalization.eligibleComponents,18);
    const pin={start:2562,normal:'f567b736',owner:'1f9fee9e'};
    assert.equal(f.start,pin.start,'exact phase-specific D067 owner span after preceding D078 geometry');
    for(const name of ['walls','other','dress']){const s=o.normalSpecs[name];assert.ok(s.capacity>=s.length);assert.equal(s.start,0);assert.equal(s.hash,f.digest.meshes[name].attrs.normal);}
    const observed=f.change('other',g=>{
     const words=new Uint32Array(g.attributes.normal.array.buffer);
     for(const [t,bits] of [[12,0x26474ff7],[24,0x26464a92],[54,0x263b968e]])for(let j=0;j<6;j++)words[(f.start+t)*9+j*3+2]=bits;
    });
    assert.equal(observed.actual.meshes.other.attrs.normal,pin.normal,'exact D067 recorded-residual pattern');assert.equal(observed.actual.meshes.other.byOwner,pin.owner,'all 18 diagnosed components reconstruct the exact D067 browser pattern');
    assert.throws(()=>assertD078BrowserGeometry({meshes:Object.fromEntries(Object.entries(observed.actual.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),instTransforms:observed.actual.inst.map(s=>s.split(':').slice(0,2).join(':'))},o.geometry),'original raw guard still rejects diagnostic mismatch');
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
  const o=createD078FrameOracle('seed516',false),f=browserFixture('seed516',false),index=(f.start+12)*9+2;
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
  const o=createD078FrameOracle('gallery',true),f=browserFixture('gallery',true);
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
 test('construction color/depth clipping and tree growth source remain byte-exact published rules',()=>{
  for(const [file,sha]of [['../src/render/construction.ts','c8b9b3515c6781d41f414c7dcc4c41e0566e1878508bf86bd7695d43d7a6d8a7'],['../src/content/construction.ts','985b81b9e8c1042b82398256f3ddb16d3301e4139c07853ccb7823e1926c6217']])assert.equal(createHash('sha256').update(fs.readFileSync(new URL(file,import.meta.url))).digest('hex'),sha,'unaltered published construction source '+file);
  const capture=fs.readFileSync(new URL('./d078-capture.mjs',import.meta.url),'utf8');assert.doesNotMatch(capture,/__gt\.(?:noClip|conAgeShift|simStep|simPlay)\(/,'capture cannot bypass clipping, change age or advance the world');assert.match(capture,/__gt\.neighbourhoodConstruction\(\)/);assert.match(capture,/actual uploaded construction tiles/);assert.match(capture,/ORIGINAL CONSTRUCTION STATE/);
 });
 test('all sixteen original construction states retain ages and tree growth while candidate clipping is recomputed from every mandatory point',()=>{
  report.constructionStates=[];for(const source of D078_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){const f=browserFixture(source.sample,on,source.force);try{for(const site of source.sites){const viewport=VIEWPORTS[0],contract=d078OwnerSurfaceContract(f,cameraFor(source.n,site,viewport),viewport,site.buildingId),state=d078OwnerConstruction(f.city,f.con,site.buildingId,contract),pin=D078_BASELINE_CONSTRUCTION[source.sample+':'+site.k+':'+site.v],diag=d078ConstructionDiagnostic(f.scene,f.con);assertD078ConstructionDiagnostic(diag,diag);assert.equal(state.originalAge,pin.age);assert.equal(state.age,pin.age);assert.equal(state.rise,pin.rise);assert.equal(state.treeAge,pin.treeAge);assert.equal(state.treeShaderScale,pin.treeShaderScale);assert.equal(state.complete,pin.constructionComplete);assert.equal(state.requiredGeometrySamples,contract.requiredSamples.length);assert.equal(state.clippedCount,state.shaderClippedMandatorySamples.length);
    if(!on){const t=state.tiles[0];assert.deepEqual([t.age,t.top,t.base,t.a],pin.constructionDataRGBA);assert.equal(state.shaderClipThreshold,pin.shaderClipThreshold);if(source.sample==='ai120'&&site.k===85)assert.equal(state.clippedCount,[118,120,116][site.v],'independent exact pre-code baseline clipped samples');}
    if(source.sample==='gallery'){assert.equal(state.originalAge,400);assert.equal(state.complete,true);assert.equal(state.clippedCount,0);assert.equal(state.treeShaderScale,1);}else if(site.k===84){assert.equal(state.originalAge,83);assert.equal(state.clippedCount,0);}else{assert.equal(state.originalAge,7);assert.equal(state.rise,.84);assert.equal(state.treeShaderScale,0);assert.ok(state.clippedCount>0,'construction qualification cannot claim a finished upper roof');}
    if(site.k===85){let matches=0;for(const tree of diag.trees)for(let i=0;i<tree.count;i++){const x=tree.matrices[i*16+12],z=tree.matrices[i*16+14];if(x>site.parcel.x&&x<site.parcel.x+site.size&&z>site.parcel.z&&z<site.parcel.z+site.size){assert.equal(tree.ages[i],state.treeAge);matches++;}}assert.equal(matches,6,'three original trees each retain trunk and crown live shader ages');}
    const before=JSON.stringify(state),tile=state.tiles[0],i=(tile.z*f.city.n+tile.x)*4,saved=f.con.data[i];try{f.con.data[i]=400;const changed=d078OwnerConstruction(f.city,f.con,site.buildingId,contract);if(saved!==400)assert.throws(()=>assertD078OwnerConstruction(changed,state),/original owner construction/);}finally{f.con.data[i]=saved;}assert.equal(JSON.stringify(d078OwnerConstruction(f.city,f.con,site.buildingId,contract)),before,'age control restores exact state');
    for(const field of ['age','top','base','a','wallTop']){const bad=structuredClone(state);bad.tiles[0][field]+=.01;assert.throws(()=>assertD078OwnerConstruction(bad,state),/original owner construction/);}report.constructionStates.push({sample:source.sample,on,slot:site.k+':'+site.v,...state});
   }}finally{f.dispose();}}assert.equal(report.constructionStates.length,32);
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {failed,report}=await d078FrameGuards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));
 fs.mkdirSync(new URL('../scratch/d078/',import.meta.url),{recursive:true});const bytes=Buffer.from(JSON.stringify(report,null,2));fs.writeFileSync(new URL('../scratch/d078/D078-frame.json',import.meta.url),bytes);fs.writeFileSync(new URL('../scratch/d078/D078-frame.json.gz',import.meta.url),gzipSync(bytes));
 const summary={passed:report.passed,tests:report.tests.length,frames:report.frames.length,rawContractCases:report.rawContractCases??0,roofViewportCases:report.roofVisibility?.length??0,surfaceViewportCases:report.surfaceCoverage?.length??0,archivedSurfaceCases:report.archivedSurfaceCases??0,fixedSurfaceNegativeControls:report.fixedSurfaceNegativeControls??0,roofNegativeControls:report.roofNegativeControls??0,offsetDecalRegressionCases:report.offsetDecalRegression?.length??0,requiredSurfaceSamples:report.surfaceCoverage?.reduce((n,r)=>n+r.coverage.requiredSamples,0)??0,coveredSurfaceSamples:report.surfaceCoverage?.reduce((n,r)=>n+r.coverage.coveredSamples,0)??0,archivedRequiredSamples:report.surfaceCoverage?.reduce((n,r)=>n+(r.archivedCoverage?.requiredSamples??0),0)??0,fullReportSha256:createHash('sha256').update(bytes).digest('hex'),fullReportBytes:bytes.length};fs.writeFileSync(new URL('../scratch/d078/D078-frame-summary.json',import.meta.url),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));process.exitCode=failed?1:0;
}

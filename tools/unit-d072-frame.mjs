// D072 camera-specific draw oracle guards. Node only; no browser counters, renderer, network, or output files.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {createD072FrameOracle,assertD072Frame,assertD072CampusCamera,assertD072BrowserGeometry,d072OwnerRayAudit,D072_FRAME_WHOLE} from './d072-frame.mjs';
import {hashOf,sceneDigest,meshDigest} from '../src/render/digest.ts';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {STYLES} from '../src/render/styles.ts';
import {D072_OLD,D072_KT,d072City,d072CampusCity,d072Blocks,d072Civic,d072Expected} from './unit-d072.mjs';

import {D072_CAPTURE_SOURCES,D072_SLOTS,D072_ALTERNATE_VIEWS,d072CapturePlan,d072CaptureQuery} from './d072-capture.mjs';

const VIEWPORTS=[{W:1440,H:1000},{W:360,H:740},{W:412,H:860}];
const live=(c,b)=>b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=c.n&&b.z+b.size<=c.n;
function cameraFor(n,shot,v){
 const D=n*1.6,target=[shot.x,0,shot.z];
 // __gt.view sets this pose; OrbitControls subsequently clamps overview zoom to its actual .6 minimum.
 const requested=shot.k?Math.min(8,.70*.84*n*(v.W/v.H)/(shot.size*Math.SQRT2)):.54*v.W/v.H;
 const a=shot.spinRadians??0,c=Math.cos(a),s=Math.sin(a);
 return {pos:[shot.x+D*(c-s),D*Math.SQRT2*Math.tan(Math.PI/6),shot.z+D*(s+c)],target,zoom:Math.max(.6,requested)};
}
// Independent production data for comparisons; mutations are confined to disposable test clones.
function browserFixture(sample,on,force=null){
 const source=d072City(sample),city=d072CampusCity(source,force),con=new ConState(city.n),built=buildCityScene(city,D072_KT,STYLES.A,d072Blocks(city),'d',d072Civic(on),con,true);
 con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(city,k=>D072_KT.cat(k));built.setTreeAges(i=>con.siteAge(i));
 const digest=sceneDigest(built),empty='0:'+hashOf(new Float32Array(0));digest.inst.push(empty+':-:-',empty+':-:-');
 const names=['walls','other','dress'],meshes=built.buildingMeshes(),owners=built.pickOwners();
 const change=(name,fn)=>{
  const i=names.indexOf(name),g=meshes[i].geometry.clone(),ow=owners[i].slice();
  try{fn(g,ow);const actual=structuredClone(digest);actual.meshes[name]=meshDigest({geometry:g},ow);
   const a=g.attributes.normal.array,start=g.drawRange.start*3,end=Math.min(g.attributes.position.count,g.drawRange.start+g.drawRange.count)*3;
   return {actual,words:{[name]:Array.from(new Uint32Array(a.buffer,a.byteOffset+start*4,end-start))}};
  }finally{g.dispose();}
 };
 return {digest,change,meshes,owners,scene:built.scene,n:city.n,start:owners[1].findIndex(o=>o===-98),dispose:()=>{built.dispose();con.dispose();}};
}
export async function d072FrameGuards(log=()=>{}){
 let failed=0;const report={qualification:'Independent Node geometry/frustum oracle tests; not WebGL screenshot evidence.',tests:[],frames:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D072 frame '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D072 frame '+name,e.stack??String(e));}};
 test('whole-scene pins equal immutable D071 native/copied baselines and d072Expected',()=>{
  const expected=d072Expected();
  for(const variant of ['native','v0','v1','v2'])for(const sample of ['gallery','seed516','ai120']){
   assert.equal(expected[variant][sample].legacy,D072_OLD[variant][sample].c[0]);
   for(const phase of ['legacy','campus'])assert.equal(expected[variant][sample][phase],D072_FRAME_WHOLE[variant][sample][phase]);
   assert.ok(expected[variant][sample].campus<=expected[variant][sample].legacy);
  }
 });
 test('actual capture path selects legacy BEFORE and default campus AFTER without inherited legacy flags',()=>{
  const capture=fs.readFileSync(new URL('./d072-capture.mjs',import.meta.url),'utf8'),cityView=fs.readFileSync(new URL('../src/cityView.ts',import.meta.url),'utf8');
  assert.match(capture,/query:d072CaptureQuery\(source\.sample,phase\)/,'actual capture metadata uses the tested query helper');
  assert.match(capture,/await p\.open\(item\.query\)/,'production browser opens that same tested query');
  const condition=cityView.match(/const campusOn = ([^;]+);/);assert.ok(condition,'actual production campus dispatch condition');
  const artworkEnabled=Function('q','return ('+condition[1]+')');
  for(const source of D072_CAPTURE_SOURCES){
   const before=d072CaptureQuery(source.sample,'before'),after=d072CaptureQuery(source.sample,'after');
   assert.equal(before,'sample='+source.sample+'&clean=1&campusArt=legacy');
   assert.equal(after,'sample='+source.sample+'&clean=1');
   assert.notEqual(before,after,'D072 phases cannot both load legacy artwork');
   assert.equal(artworkEnabled(new URLSearchParams(before)),false,'BEFORE selects the exact D071 production phase');
   assert.equal(artworkEnabled(new URLSearchParams(after)),true,'AFTER selects the new D072 production phase');
   // Reproduce the failed CI URL: an after-phase legacy suffix must fail the same
   // dispatch check, rather than being excused as numerical normal drift.
   assert.throws(()=>assert.equal(artworkEnabled(new URLSearchParams(after+'&campusArt=legacy')),true),{name:'AssertionError'});
  }
  for(const phase of [null,undefined,'legacy','campus','BEFORE'])assert.throws(()=>d072CaptureQuery('gallery',phase),/explicit D072/);
  assert.throws(()=>d072CaptureQuery('gallery&campusArt=legacy','after'),/known D072/);
 });
 test('capture plan retains all 132 original views and appends only audited unoccluded campus angles',()=>{
  const plan=d072CapturePlan(),extraCount=Object.keys(D072_ALTERNATE_VIEWS).length;
  assert.equal(plan.captured,false);assert.equal(plan.completeThreeViewportOriginalPngs,132+6*extraCount);assert.equal(plan.preservedOriginalViews,132);assert.equal(plan.additionalCampusViews,6*extraCount);
  assert.deepEqual(D072_SLOTS.map(s=>[s.k,s.v]),[[109,1],[109,2],[48,0],[48,1],[48,2],[115,0],[115,1],[115,2],[31,0],[31,1]]);
  assert.equal(D072_CAPTURE_SOURCES.length,12);
  assert.deepEqual(D072_CAPTURE_SOURCES.flatMap(s=>s.sites.map(x=>x.k+':'+x.v)).sort(),D072_SLOTS.map(s=>s.k+':'+s.v).sort());
  for(const source of D072_CAPTURE_SOURCES){
   const extra=source.shots.filter(s=>s.additionalView),needed=source.sites.filter(s=>D072_ALTERNATE_VIEWS[s.k+':'+s.v]);
   assert.equal(extra.length,needed.length);assert.equal(source.shots.filter(s=>!s.additionalView).length,source.sites.length+1);
   for(let i=0;i<needed.length;i++){
    const site=needed[i],angle=D072_ALTERNATE_VIEWS[site.k+':'+site.v];
    assert.deepEqual(extra[i],{...site,id:site.id+'-'+angle.name,name:site.name+' · '+angle.label+' / ADDITIONAL CAMERA VIEW',additionalView:angle.name,spinRadians:angle.spinRadians});
    assert.equal(source.shots[source.sites.length+1+i],extra[i],'alternates append after every original shot');
   }
   if(source.force!==null)assert.match(source.label,/COPIED SAVED-VARIANT .* NOT TEN NATIVE TOOLS/);
   for(const site of source.sites){assert.equal(site.sourceVariant,0);assert.equal(site.renderedVariant,source.force);}
  }
 });
 test('all original and additional-angle views reproduce exact main/shadow submissions at three widths and two phases',()=>{
  for(const source of D072_CAPTURE_SOURCES){
   const {sample,n,shots,force,variant}=source;
   for(const on of [false,true]){const oracle=createD072FrameOracle(sample,on,force);
    try{for(const v of VIEWPORTS)for(const shot of shots){
     const camera=cameraFor(n,shot,v),frame=oracle.measure(camera,v);
     assert.equal(frame.wholeTriangles,D072_FRAME_WHOLE[variant][sample][on?'campus':'legacy']);
     assert.equal(frame.triangles,frame.wholeTriangles,'exact submitted triangles for all planned views');
     assert.equal(frame.calls,{gallery:9,seed516:15,ai120:15}[sample],'exact main+shadow calls');
     assert.equal(frame.triangles,frame.main.triangles+frame.shadow.triangles);
     assert.equal(frame.calls,frame.main.calls+frame.shadow.calls);
     assert.equal(frame.culledTriangles,0);assert.deepEqual(frame.culled,[]);
     assert.deepEqual(oracle.measure(camera,v),frame,'exact deterministic repeat');
     report.frames.push({sample,variant,on,width:v.W,shot:shot.id,triangles:frame.triangles,calls:frame.calls,wholeTriangles:frame.wholeTriangles,culledTriangles:frame.culledTriangles});
    }}finally{oracle.dispose();}
   }
  }
  assert.equal(report.frames.length,d072CapturePlan().completeThreeViewportOriginalPngs);
  for(const before of report.frames.filter(f=>!f.on)){const after=report.frames.find(f=>f.on&&f.sample===before.sample&&f.variant===before.variant&&f.width===before.width&&f.shot===before.shot);assert.equal(after.calls,before.calls);const pin=D072_FRAME_WHOLE[before.variant][before.sample];assert.equal(after.triangles-before.triangles,pin.campus-pin.legacy);}
 });
 test('production spin angles settle exactly and reject unchanged/wrong camera poses',()=>{
  const extras=D072_CAPTURE_SOURCES.flatMap(source=>source.shots.filter(s=>s.additionalView).map(shot=>({source,shot})));
  // Exercise the supported settlement path even when the audited source needs no extra views.
  if(!extras.length){const source=D072_CAPTURE_SOURCES.find(s=>s.sites.length);extras.push({source,shot:{...source.sites[0],spinRadians:Math.PI/2}});}
  for(const {source,shot} of extras)for(const viewport of VIEWPORTS){
   const initial=cameraFor(source.n,{...shot,spinRadians:0},viewport),run=()=>{
    const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,source.n*6),controls=new OrbitControls(camera,null);
    controls.enableDamping=true;controls.minPolarAngle=Math.PI*.18;controls.maxPolarAngle=Math.PI*.42;controls.minZoom=.6;controls.maxZoom=8;
    controls.target.fromArray(initial.target);camera.position.fromArray(initial.pos);camera.zoom=initial.zoom;camera.lookAt(controls.target);for(let i=0;i<100;i++)controls.update();
    const state=()=>({pos:camera.position.toArray(),target:controls.target.toArray(),zoom:camera.zoom}),baseline=state();
    controls.rotateLeft(shot.spinRadians);for(let i=0;i<900;i++)controls.rotateLeft(0);const rotated=state();
    assertD072CampusCamera(rotated,baseline,shot.spinRadians);for(let i=0;i<1000;i++)controls.update();assert.deepEqual(state(),rotated,'future animation frames cannot change the settled pose');
    return {baseline,rotated};
   };
   const {baseline,rotated}=run();assert.deepEqual(run(),{baseline,rotated},'before/after camera sequence is deterministic');
   assert.throws(()=>assertD072CampusCamera(baseline,baseline,shot.spinRadians),/alternate differs/);
   for(const key of ['target','pos','zoom']){const bad=structuredClone(rotated);if(key==='zoom')bad.zoom+=.01;else bad[key][0]+=.01;assert.throws(()=>assertD072CampusCamera(bad,baseline,shot.spinRadians),{name:'AssertionError'},'changed '+key+' rejected');}
  }
 });
 test('every campus slot has a fully unoccluded owner-ray view in both phases with all neighbors retained',()=>{
  // Geometry-only visibility is necessary, not a substitute for actual WebGL visual review.
  report.visibility=[];
  for(const source of D072_CAPTURE_SOURCES.filter(s=>s.sites.length))for(const on of [false,true]){
   const f=browserFixture(source.sample,on,source.force),before=JSON.stringify(f.digest);
   try{for(const site of source.sites){
    const views=source.shots.filter(s=>s.k===site.k&&s.v===site.v),audits=views.map(shot=>({shot:shot.id,additionalView:shot.additionalView??null,...d072OwnerRayAudit(f,cameraFor(source.n,shot,VIEWPORTS[0]),VIEWPORTS[0],site.buildingId)}));
    assert.ok(audits.some(a=>a.unoccluded),site.k+':'+site.v+' '+(on?'campus':'legacy')+' has a completely unoccluded planned view');
    if(audits.length>1)assert.equal(audits.at(-1).blockedRays,0,'appended view is completely unoccluded');
    report.visibility.push({slot:site.k+':'+site.v,on,audits});
   }
    assert.equal(JSON.stringify(f.digest),before,'ray audits leave all original scene geometry unchanged');
   }finally{f.dispose();}
  }
  assert.equal(report.visibility.length,20,'ten distinct saved slots, each independently checked before and after');
 });
 test('original D067 frustum-culling control remains exact despite zero D072 targets in seed516',()=>{
  const city=d072City('seed516'),b=city.buildings.find(b=>live(city,b)&&b.k===116);assert.equal(b.id,201);
  const shot={k:116,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size};
  for(const on of [false,true]){const oracle=createD072FrameOracle('seed516',on);
   try{for(const v of VIEWPORTS){const frame=oracle.measure(cameraFor(city.n,shot,v),v);
    assert.equal(frame.wholeTriangles,112762);assert.equal(frame.triangles,108842);assert.equal(frame.calls,13);assert.equal(frame.culledTriangles,3920);
    assert.deepEqual(frame.culled.map(m=>[m.name,m.instances,m.triangles,m.main.reason,m.castShadow]),[['inst6',280,1680,'frustum',false],['inst8',280,2240,'frustum',false]]);
    assert.equal(frame.shadow.triangles,28302,'exact D067 sun shadow submissions retained in both D072 phases');
   }}finally{oracle.dispose();}
  }
 });
 test('wrong submitted triangle/call counts and substituting whole-scene count are rejected',()=>{
  const o=createD072FrameOracle('seed516',true),city=d072City('seed516'),n=city.n,b=city.buildings.find(b=>live(city,b)&&b.k===116),shots=[null,{k:116,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size}],v=VIEWPORTS[0];
  try{const frame=o.measure(cameraFor(n,shots[1],v),v);
   assertD072Frame({triangles:108842,calls:13},frame);
   assert.throws(()=>assertD072Frame({triangles:108843,calls:13},frame),/triangles agree/);
   assert.throws(()=>assertD072Frame({triangles:108842,calls:14},frame),/calls agree/);
   assert.throws(()=>assertD072Frame({triangles:112762,calls:13},frame),/triangles agree/);
  }finally{o.dispose();}
 });
 test('injected real model triangle is rejected by whole-scene cap before any frustum test',()=>{
  const o=createD072FrameOracle('seed516',true),city=d072City('seed516'),n=city.n,b=city.buildings.find(b=>live(city,b)&&b.k===116),shots=[null,{k:116,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size}],v=VIEWPORTS[0];
  let model; o.scene.traverse(m=>{if(!model&&m.isMesh&&!m.isInstancedMesh&&m.castShadow)model=m;});assert.ok(model);
  const original=model.geometry,extra=original.clone(),end=original.drawRange.start+original.drawRange.count;
  try{
   assert.ok(!extra.index&&end+3<=extra.attributes.position.count,'production arena has one spare triangle');
   for(const at of Object.values(extra.attributes))for(let j=0;j<3;j++)for(let k=0;k<at.itemSize;k++)at.array[(end+j)*at.itemSize+k]=at.array[(original.drawRange.start+j)*at.itemSize+k];
   extra.setDrawRange(original.drawRange.start,original.drawRange.count+3);model.geometry=extra;
   assert.throws(()=>o.measure(cameraFor(n,shots[1],v),v),/immutable whole-scene triangle budget/);
   model.geometry=original;assert.equal(o.measure(cameraFor(n,shots[1],v),v).wholeTriangles,112762);
  }finally{model.geometry=original;extra.dispose();o.dispose();}
 });
 test('geometry snapshot includes all building owner attributes and instance counts/transforms, independent of construction ages',()=>{
  for(const sample of ['gallery','seed516','ai120']){
   const a=createD072FrameOracle(sample,false),b=createD072FrameOracle(sample,true),again=createD072FrameOracle(sample,true);
   try{
    assert.deepEqual(Object.keys(b.geometry.meshes),['walls','other','dress']);
    assert.ok(b.geometry.instTransforms.length>=2);for(const token of b.geometry.instTransforms)assert.match(token,/^\d+:[0-9a-f]{8}$/);
    assert.deepEqual(a.geometry.instTransforms,b.geometry.instTransforms,'original trees and their order/transforms stay exact');
    if(sample==='gallery')assert.notDeepEqual(a.geometry.meshes,b.geometry.meshes,'changed production owner attributes are not ignored');else assert.deepEqual(a.geometry.meshes,b.geometry.meshes,'zero-target existing cities remain byte-exact');
    assert.deepEqual(again.geometry,b.geometry,'fresh independent scenes have identical geometry snapshots');
   }finally{a.dispose();b.dispose();again.dispose();}
  }
 });
 test('render-only saved preview geometry is independently matched and native/copied world records are never mutated',()=>{
  const source=d072City('gallery'),before=JSON.stringify(source);
  assert.equal(d072CampusCity(source,null),source,'native mode returns original world');
  for(const force of [0,1,2]){
   const copy=d072CampusCity(source,force);assert.notEqual(copy,source);assert.notEqual(copy.buildings,source.buildings);
   for(let i=0;i<source.buildings.length;i++){const b=source.buildings[i],c=copy.buildings[i];
    if(D072_SLOTS.some(s=>s.k===b.k&&s.v===force)){assert.notEqual(c,b);assert.deepEqual(c,{...b,v:force});}else assert.equal(c,b,'every unsupported slot and unrelated building record is reused unchanged');
   }
   for(const [kind,unsupported] of [[109,0],[31,2]])if(force===unsupported){const i=source.buildings.findIndex(b=>b.k===kind);assert.equal(copy.buildings[i],source.buildings[i],'unsupported request retains exact native object identity and variant');}
   for(const on of [false,true]){const o=createD072FrameOracle('gallery',on,force),f=browserFixture('gallery',on,force);
    try{assert.equal(o.assertBrowserGeometry(f.digest).canonicalization.eligibleComponents,0);}finally{o.dispose();f.dispose();}
   }
   assert.equal(JSON.stringify(source),before,'native world fields unchanged');
  }
  for(const force of [1,2]){const o=createD072FrameOracle('gallery',true,force);
   try{for(const wrong of [null,0,force===1?2:1]){const f=browserFixture('gallery',true,wrong);
    try{assert.throws(()=>o.assertBrowserGeometry(f.digest),{name:'AssertionError'},'wrong copied saved variant cannot prove target geometry');}finally{f.dispose();}
   }}finally{o.dispose();}
  }
 });
 test('browser geometry admits only the two exact trailing empty UI instances and rejects all other mismatches',()=>{
  const o=createD072FrameOracle('seed516',true);
  try{
   const empty='0:'+hashOf(new Float32Array(0));
   const browser={meshes:structuredClone(o.geometry.meshes),instTransforms:[...o.geometry.instTransforms,empty,empty]};
   assertD072BrowserGeometry(browser,o.geometry);
   for(const [name,mutate] of [
    ['missing UI instance',a=>a.instTransforms.pop()],
    ['third extra UI instance',a=>a.instTransforms.push(empty)],
    ['nonzero UI count',a=>a.instTransforms[a.instTransforms.length-1]='1:'+hashOf(new Float32Array(16))],
    ['changed tree transform',a=>a.instTransforms[0]=a.instTransforms[0].split(':')[0]+':deadbeef'],
    ['changed owner mesh',a=>a.meshes.walls[0]='00000000'],
    ['changed owner triangle count',a=>{const owner=Object.keys(a.meshes.walls[1])[0];a.meshes.walls[1][owner]++;}],
   ]){
    const changed=structuredClone(browser);mutate(changed);
    assert.throws(()=>assertD072BrowserGeometry(changed,o.geometry),{name:'AssertionError'},name+' must reject');
   }
   assertD072BrowserGeometry(browser,o.geometry,'unaltered control');
  }finally{o.dispose();}
 });
 test('uploaded-word reconstruction admits only the 18 diagnosed D060 residuals and leaves source geometry exact',()=>{
  for(const on of [false,true]){
   const o=createD072FrameOracle('seed516',on),f=browserFixture('seed516',on);
   try{
    const before=JSON.stringify(o.geometry),exact=o.assertBrowserGeometry(f.digest);
    assert.equal(exact.canonicalization.changedComponents,0);assert.equal(exact.canonicalization.eligibleComponents,18);
    assert.equal(f.start,2576,'exact unchanged D067 owner span in both phases');
    for(const name of ['walls','other','dress']){const s=o.normalSpecs[name];assert.ok(s.capacity>=s.length);assert.equal(s.start,0);assert.equal(s.hash,f.digest.meshes[name].attrs.normal);}
    const observed=f.change('other',g=>{
     const words=new Uint32Array(g.attributes.normal.array.buffer);
     for(const [t,bits] of [[12,0x26474ff7],[24,0x26464a92],[54,0x263b968e]])for(let j=0;j<6;j++)words[(f.start+t)*9+j*3+2]=bits;
    });
    assert.equal(observed.actual.meshes.other.attrs.normal,'89eb5daa','exact D067 recorded-residual pattern');assert.equal(observed.actual.meshes.other.byOwner,'9220f12e','all 18 diagnosed components reconstruct the exact D067 browser pattern');
    assert.throws(()=>assertD072BrowserGeometry({meshes:Object.fromEntries(Object.entries(observed.actual.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),instTransforms:observed.actual.inst.map(s=>s.split(':').slice(0,2).join(':'))},o.geometry),'original raw guard still rejects diagnostic mismatch');
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
  const o=createD072FrameOracle('seed516',false),f=browserFixture('seed516',false),index=(f.start+12)*9+2;
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
  const o=createD072FrameOracle('gallery',true),f=browserFixture('gallery',true);
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
 const {failed,report}=await d072FrameGuards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));
 console.log(JSON.stringify({passed:report.passed,tests:report.tests.length,frames:report.frames.length,unoccludedOwnerCases:report.visibility?.filter(x=>x.audits.some(a=>a.unoccluded)).length??0}));process.exitCode=failed?1:0;
}

// D067 camera-specific draw oracle guards. Node only; no browser counters, renderer, network, or output files.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createD067FrameOracle,assertD067Frame,assertD067BrowserGeometry,D067_FRAME_WHOLE} from './d067-frame.mjs';
import {hashOf} from '../src/render/digest.ts';
import {D067_KINDS,D067_OLD,d067City,d067Expected} from './unit-d067.mjs';

const VIEWPORTS=[{W:1440,H:1000},{W:360,H:740},{W:412,H:860}];
const live=(c,b)=>b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=c.n&&b.z+b.size<=c.n;
function shotsFor(sample){
 const city=d067City(sample),kinds=sample==='gallery'?D067_KINDS:[116];
 const shots=[{name:'overview',x:city.n/2,z:city.n/2,size:city.n}];
 for(const k of kinds){const rows=city.buildings.filter(b=>live(city,b)&&b.k===k);assert.equal(rows.length,1,'one existing showcase/seed target');const b=rows[0];shots.push({name:'k'+k,k,x:b.x+b.size/2,z:b.z+b.size/2,size:b.size});}
 return {n:city.n,shots};
}
function cameraFor(n,shot,v){
 const D=n*1.6,target=[shot.x,0,shot.z];
 // __gt.view sets this pose; OrbitControls subsequently clamps overview zoom to its actual .6 minimum.
 const requested=shot.k?Math.min(8,.70*.84*n*(v.W/v.H)/(shot.size*Math.SQRT2)):.54*v.W/v.H;
 return {pos:[shot.x+D,D*Math.SQRT2*Math.tan(Math.PI/6),shot.z+D],target,zoom:Math.max(.6,requested)};
}
export async function d067FrameGuards(log=()=>{}){
 let failed=0;const report={qualification:'Independent Node geometry/frustum oracle tests; not WebGL screenshot evidence.',tests:[],frames:[],passed:false};
 const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D067 frame '+name);}catch(e){failed++;report.tests.push({name,passed:false,error:e.stack??String(e)});log(false,'D067 frame '+name,e.stack??String(e));}};
 test('whole-scene pins equal the existing immutable baseline and d067Expected',()=>{
  const expected=d067Expected();
  for(const sample of Object.keys(D067_FRAME_WHOLE)){
   assert.equal(expected[sample].legacy,D067_OLD[sample].c[0]);
   for(const phase of ['legacy','landmark'])assert.equal(expected[sample][phase],D067_FRAME_WHOLE[sample][phase]);
   assert.ok(expected[sample].landmark<=expected[sample].legacy);
  }
 });
 test('all 66 planned gallery and seed views reproduce exact main/shadow submissions at three widths and two phases',()=>{
  for(const sample of ['gallery','seed516']){
   const {n,shots}=shotsFor(sample);
   for(const on of [false,true]){
    const oracle=createD067FrameOracle(sample,on);
    try{for(const v of VIEWPORTS)for(const shot of shots){
     const camera=cameraFor(n,shot,v),frame=oracle.measure(camera,v);
     const seedClose=sample==='seed516'&&shot.k===116;
     assert.equal(frame.wholeTriangles,D067_FRAME_WHOLE[sample][on?'landmark':'legacy']);
     assert.equal(frame.triangles,seedClose?108842:frame.wholeTriangles,'exact submitted triangles');
     assert.equal(frame.calls,sample==='gallery'?9:seedClose?13:15,'exact main+shadow calls');
     assert.equal(frame.triangles,frame.main.triangles+frame.shadow.triangles);
     assert.equal(frame.calls,frame.main.calls+frame.shadow.calls);
     assert.equal(frame.culledTriangles,seedClose?3920:0);
     if(seedClose){
      assert.equal(frame.wholeTriangles,112762,'unchanged full-scene cap remains enforced');
      assert.deepEqual(frame.culled.map(m=>[m.name,m.instances,m.triangles,m.main.reason,m.castShadow]),[['inst6',280,1680,'frustum',false],['inst8',280,2240,'frustum',false]],'exact two yard-tree instance meshes culled only from main view');
      assert.equal(frame.shadow.triangles,on?28302:28292,'exact phase-specific sun shadow submissions');
     }else assert.deepEqual(frame.culled,[]);
     assert.deepEqual(oracle.measure(camera,v),frame,'exact deterministic repeat');
     report.frames.push({sample,on,width:v.W,shot:shot.name,triangles:frame.triangles,calls:frame.calls,wholeTriangles:frame.wholeTriangles,culledTriangles:frame.culledTriangles});
    }}finally{oracle.dispose();}
   }
  }
  assert.equal(report.frames.length,66);
  for(const before of report.frames.filter(f=>!f.on)){const after=report.frames.find(f=>f.on&&f.sample===before.sample&&f.width===before.width&&f.shot===before.shot);assert.equal(after.calls,before.calls);assert.equal(after.triangles-before.triangles,before.sample==='gallery'?-386:0);}
 });
 test('wrong submitted triangle/call counts and substituting whole-scene count are rejected',()=>{
  const o=createD067FrameOracle('seed516',true),{n,shots}=shotsFor('seed516'),v=VIEWPORTS[0];
  try{const frame=o.measure(cameraFor(n,shots[1],v),v);
   assertD067Frame({triangles:108842,calls:13},frame);
   assert.throws(()=>assertD067Frame({triangles:108843,calls:13},frame),/triangles agree/);
   assert.throws(()=>assertD067Frame({triangles:108842,calls:14},frame),/calls agree/);
   assert.throws(()=>assertD067Frame({triangles:112762,calls:13},frame),/triangles agree/);
  }finally{o.dispose();}
 });
 test('injected real model triangle is rejected by whole-scene cap before any frustum test',()=>{
  const o=createD067FrameOracle('seed516',true),{n,shots}=shotsFor('seed516'),v=VIEWPORTS[0];
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
  for(const sample of ['gallery','seed516']){
   const a=createD067FrameOracle(sample,false),b=createD067FrameOracle(sample,true),again=createD067FrameOracle(sample,true);
   try{
    assert.deepEqual(Object.keys(b.geometry.meshes),['walls','other','dress']);
    assert.ok(b.geometry.instTransforms.length>=2);for(const token of b.geometry.instTransforms)assert.match(token,/^\d+:[0-9a-f]{8}$/);
    assert.deepEqual(a.geometry.instTransforms,b.geometry.instTransforms,'original trees and their order/transforms stay exact');
    assert.notDeepEqual(a.geometry.meshes,b.geometry.meshes,'changed production owner attributes are not ignored');
    assert.deepEqual(again.geometry,b.geometry,'fresh independent scenes have identical geometry snapshots');
   }finally{a.dispose();b.dispose();again.dispose();}
  }
 });
 test('browser geometry admits only the two exact trailing empty UI instances and rejects all other mismatches',()=>{
  const o=createD067FrameOracle('seed516',true);
  try{
   const empty='0:'+hashOf(new Float32Array(0));
   const browser={meshes:structuredClone(o.geometry.meshes),instTransforms:[...o.geometry.instTransforms,empty,empty]};
   assertD067BrowserGeometry(browser,o.geometry);
   for(const [name,mutate] of [
    ['missing UI instance',a=>a.instTransforms.pop()],
    ['third extra UI instance',a=>a.instTransforms.push(empty)],
    ['nonzero UI count',a=>a.instTransforms[a.instTransforms.length-1]='1:'+hashOf(new Float32Array(16))],
    ['changed tree transform',a=>a.instTransforms[0]=a.instTransforms[0].split(':')[0]+':deadbeef'],
    ['changed owner mesh',a=>a.meshes.walls[0]='00000000'],
    ['changed owner triangle count',a=>{const owner=Object.keys(a.meshes.walls[1])[0];a.meshes.walls[1][owner]++;}],
   ]){
    const changed=structuredClone(browser);mutate(changed);
    assert.throws(()=>assertD067BrowserGeometry(changed,o.geometry),{name:'AssertionError'},name+' must reject');
   }
   assertD067BrowserGeometry(browser,o.geometry,'unaltered control');
  }finally{o.dispose();}
 });
 report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {failed,report}=await d067FrameGuards((ok,n,d)=>console.log(ok?'PASS':'FAIL',n,d??''));
 console.log(JSON.stringify({passed:report.passed,tests:report.tests.length,frames:report.frames.length}));process.exitCode=failed?1:0;
}

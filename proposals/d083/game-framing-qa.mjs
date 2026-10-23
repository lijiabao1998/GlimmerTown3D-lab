// Validate the recorded real screenshots against every actual model vertex.
// Original first capture remains intact, including its failed mobile framing.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Geo} from '../../src/render/scene.ts';
import {Pen} from '../../src/render/kindArt.ts';
import {emitD083Prototype} from './models.mjs';
const initial=JSON.parse(fs.readFileSync('../evidence/d083-game-webgl/manifest.json'));
const corrected=JSON.parse(fs.readFileSync('../evidence/d083-game-webgl-mobile-correction/manifest.json'));
assert.equal(initial.complete,true);assert.equal(corrected.complete,true);
assert.deepEqual(corrected.errors,[]);assert.equal(corrected.shots.length,1);
assert.equal(corrected.buildSha256,initial.buildSha256);
assert.deepEqual(corrected.originalScene,initial.originalScene);
const plots=initial.shots.filter(s=>s.plot).map(s=>s.plot);assert.equal(plots.length,8);
const rows=[],shots=[...initial.shots.filter(s=>s.width===1440),...corrected.shots];
for(const shot of shots){
 // Use the observed settled OrbitControls target, including its floating point
 // clamp drift (for example requested x=51 settles to 51.00000000000001).
 // Framing is checked strictly against the recorded actual camera, not an
 // idealized requested target or a relaxed screen boundary.
 assert.ok([...shot.camera.target,...shot.camera.pos].every(Number.isFinite));assert.equal(shot.camera.target[1],0);assert.equal(shot.camera.zoom,shot.zoom);
 assert.ok(shot.zoom>=.6&&shot.zoom<=8);assert.equal(shot.webgl.contextLost,false);
 const half=72*.42,asp=shot.width/shot.height,camera=new THREE.OrthographicCamera(-half*asp,half*asp,half,-half,.1,432);
 camera.position.fromArray(shot.camera.pos);camera.zoom=shot.camera.zoom;
 camera.lookAt(new THREE.Vector3(...shot.camera.target));camera.updateProjectionMatrix();camera.updateMatrixWorld();
 for(const p of shot.plot?[shot.plot]:plots){
  const W=new Geo({ext:true}),O=new Geo(),D=new Geo();
  emitD083Prototype(new Pen({W,O,D,trees:[],x0:p.x,z0:p.z,y0:p.y0,s:p.size,H:p.H,k:0,v:0,C:{}}),p.id);
  const geo=O.geometry();geo.computeBoundingBox();assert.deepEqual({min:geo.boundingBox.min.toArray(),max:geo.boundingBox.max.toArray()},p.bounds);
  const attr=geo.attributes.position;let maxNdc=0;
  for(let i=0;i<attr.count;i++){const v=new THREE.Vector3().fromBufferAttribute(attr,i).project(camera);maxNdc=Math.max(maxNdc,Math.abs(v.x),Math.abs(v.y));assert.ok(v.z>-1&&v.z<1,'actual vertex depth inside original camera');}
  rows.push({width:shot.width,shot:shot.id,model:p.id,vertices:attr.count,maxNdc,fullyInside:maxNdc<1});geo.dispose();
 }
}
const result={qualification:'Current real WebGL screenshots; original-camera projection of every actual unchanged model vertex. No occlusion/coverage or performance claim.',initialFailurePreserved:'../d083-game-webgl/actual-vertex-framing.json; mobile windmill maxNdc 1.0100347859067327 at zoom 1.35',correction:'Only original __gt.view mobile zoom 1.35 -> 1.2; same preview build, unchanged models. Desktop captures unchanged.',rows,allCurrentVerticesInside:rows.every(r=>r.fullyInside)};
fs.writeFileSync('../evidence/d083-game-webgl-mobile-correction/actual-vertex-framing.json',JSON.stringify(result,null,2));
assert.equal(rows.length,24);assert.ok(result.allCurrentVerticesInside);
console.log(JSON.stringify({realCurrentShots:shots.length,actualVertexFramingChecks:rows.length,mobileMaxNdc:Math.max(...rows.filter(r=>r.width===412).map(r=>r.maxNdc)),allCurrentVerticesInside:true}));

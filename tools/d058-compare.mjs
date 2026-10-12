// Verify the before/after review contract. Different hashes do not claim visual quality.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
const read=phase=>JSON.parse(fs.readFileSync(path.join(ROOT,`scratch/d058-${phase}/D058-capture.json`),'utf8'));
const before=read('before'),after=read('after');assert.equal(before.passed,true);assert.equal(after.passed,true);
assert.equal(before.phase,'before');assert.equal(after.phase,'after');assert.equal(before.sourceRef,'6f30f83faf4c4f4b02d1e3416d968a133f7da0b9');assert.notEqual(before.htmlSha256,after.htmlSha256);
const verify=(phase,shot,viewport)=>{assert.equal(path.basename(shot.file),shot.file);const bytes=fs.readFileSync(path.join(ROOT,`scratch/d058-${phase}`,shot.file));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),viewport.W);assert.equal(bytes.readUInt32BE(20),viewport.H);assert.equal(bytes.length,shot.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),shot.sha256,'actual PNG bytes match recorded evidence');};
assert.equal(before.cases.length,6);assert.equal(after.cases.length,6);const pairs=[];
for(let i=0;i<before.cases.length;i++){
 const a=before.cases[i],b=after.cases[i];assert.equal(a.scene,b.scene);assert.deepEqual(a.viewport,b.viewport);assert.equal(a.fixtureSha256,b.fixtureSha256);assert.equal(a.shots.length,b.shots.length);assert.equal(a.shots.length,5+(a.scene==='highstreet'?1:3)*(a.viewport.mobile?2:4));
 for(let j=0;j<a.shots.length;j++){
  const x=a.shots[j],y=b.shots[j];verify('before',x,a.viewport);verify('after',y,b.viewport);assert.equal(x.file.replace('-before-','-'),y.file.replace('-after-','-'));assert.equal(x.worldSha256,y.worldSha256,'exact same model/save/history for photograph');
  assert.equal(x.camera.zoom,y.camera.zoom);for(const field of['pos','target'])for(let n=0;n<3;n++)assert.ok(Math.abs(x.camera[field][n]-y.camera[field][n])<1e-7,'same settled camera '+field);
  assert.notEqual(x.sha256,y.sha256,'new art produces different actual screenshot');pairs.push({before:x.file,after:y.file,viewport:a.viewport,fixtureSha256:a.fixtureSha256,camera:y.camera});
 }
}
assert.equal(pairs.length,62);
fs.writeFileSync(path.join(ROOT,'scratch/d058-after/D058-pairs.json'),JSON.stringify({passed:true,qualification:'Same camera/save/fixture; visual acceptance still requires inspecting the actual screenshots.',pairs},null,2));
console.log('PASS D058',pairs.length,'same-camera same-world before/after image pairs');

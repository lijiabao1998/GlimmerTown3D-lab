// Verify actual same-camera/world image evidence. Hash inequality alone is not visual acceptance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT} from './cdp.mjs';
import {D059_BASELINE,D059_VIEWPORTS,D059_SITES,D059_BONUS} from './d059-scenes.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const read=phase=>JSON.parse(fs.readFileSync(path.join(ROOT,`scratch/d059-${phase}/D059-capture.json`),'utf8'));
const before=read('before'),after=read('after');assert.equal(before.passed,true);assert.equal(after.passed,true);
const defaultMode=file=>{
 const html=fs.readFileSync(file,'utf8'),m=html.match(/\.get\(([`"'])blocks\1\)\?\?([`"'])([abc])\2\)\.toLowerCase\(\)/);
 assert.ok(m,'production bundle declares blocks query fallback');return m[3];
};
const actualMode={before:defaultMode(path.join(ROOT,'scratch/d059-before/index.html')),after:defaultMode(path.join(ROOT,'dist/index.html')),evidence:'No blocks query override. Actual hashed production bundles declare blocks query fallback.'};
assert.equal(actualMode.before,'c');assert.equal(actualMode.after,'c');
assert.equal(before.phase,'before');assert.equal(after.phase,'after');assert.equal(before.sourceRef,D059_BASELINE);assert.notEqual(before.htmlSha256,after.htmlSha256);
assert.equal(sha(fs.readFileSync(path.join(ROOT,'scratch/d059-before/index.html'))),before.htmlSha256,'actual baseline HTML matches capture');
assert.equal(sha(fs.readFileSync(path.join(ROOT,'dist/index.html'))),after.htmlSha256,'actual candidate HTML matches capture');
assert.equal(before.fixtureSha256,after.fixtureSha256);assert.deepEqual(before.fixture,after.fixture);
for(const phase of ['before','after'])assert.equal(sha(fs.readFileSync(path.join(ROOT,`scratch/d059-${phase}/D059-fixture.code.txt`))),before.fixtureSha256,'actual authored input matches manifest');
const verify=(phase,s,v)=>{
 assert.equal(path.basename(s.file),s.file);const bytes=fs.readFileSync(path.join(ROOT,`scratch/d059-${phase}`,s.file));
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),v.W);assert.equal(bytes.readUInt32BE(20),v.H);
 assert.equal(bytes.length,s.bytes);assert.equal(sha(bytes),s.sha256);assert.ok(s.pixelVariance>50);
};
assert.equal(before.cases.length,3);assert.equal(after.cases.length,3);const pairs=[];
for(const v of D059_VIEWPORTS){
 const a=before.cases.find(c=>c.viewport.W===v.W),b=after.cases.find(c=>c.viewport.W===v.W);assert.ok(a&&b);
 assert.deepEqual(a.viewport,v);assert.deepEqual(b.viewport,v);assert.deepEqual(a.selectors,b.selectors);assert.equal(a.worldSha256,b.worldSha256);
 assert.equal(a.modes.a.digestSha256,b.modes.a.digestSha256,'A remains original geometry');
 for(const mode of ['b','c']){assert.notEqual(a.modes[mode].digestSha256,b.modes[mode].digestSha256,mode+' gains actual D059 geometry');assert.deepEqual(a.modes[mode].selectors,b.modes[mode].selectors);}
 assert.equal(a.shots.length,17);assert.equal(b.shots.length,17);assert.ok(b.native.saveReload&&b.native.modelCompared&&b.native.oneDayCompared);assert.equal(b.native.oneDay.to,b.native.oneDay.from+1);
 for(const t of ['cemetery','farm'])assert.ok(b.native.results.some(r=>r.tool===t&&r.placement&&r.undo&&r.picking&&(!v.mobile||r.touchCancel)));
 const expected=['overview',...[...D059_SITES,...D059_BONUS].flatMap(s=>[s.id+'-se',s.id+'-nw'])];
 for(const name of expected){
  const x=a.shots.find(s=>s.file===`D059-before-${name}-${v.W}.png`),y=b.shots.find(s=>s.file===`D059-after-${name}-${v.W}.png`);assert.ok(x&&y);verify('before',x,v);verify('after',y,v);
  assert.equal(x.worldSha256,y.worldSha256,'same production world');assert.equal(x.camera.zoom,y.camera.zoom);
  for(const key of ['pos','target'])for(let j=0;j<3;j++)assert.ok(Math.abs(x.camera[key][j]-y.camera[key][j])<1e-7,'same settled camera '+key);
  assert.notEqual(x.sha256,y.sha256,'new geometry changes actual PNG');pairs.push({name,before:x.file,after:y.file,viewport:v,worldSha256:y.worldSha256,camera:y.camera});
 }
}
assert.equal(pairs.length,51);
fs.writeFileSync(path.join(ROOT,'scratch/d059-after/D059-pairs.json'),JSON.stringify({passed:true,actualMode,qualification:'51 actual same-camera/same-world pairs. Default C photography, separate A/B/C geometry proofs. Human visual review remains separate from hash/geometry gates. Mobile emulation is not a real Android device.',pairs},null,2));
console.log('PASS D059',pairs.length,'same-camera same-world before/after pairs');

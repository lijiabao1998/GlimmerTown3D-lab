// Post-capture proof only. No renderer, scene mutation, missing-image waiver or
// invented pixel result. Actual observed cameras audit the unchanged D081 contract.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';
import{CIVIC_MARKET_BUILDINGS as MODELS}from'../../src/content/britishCivicMarkets.ts';
import{surfaceContract,auditSurface,assertSurfaceCoverage}from'./surface-contract.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function assertNativeSurfacePng(shot,manifest,directory){
 assert.equal(path.basename(shot.file),shot.file,'local unmodified PNG filename');const bytes=fs.readFileSync(path.join(directory,shot.file));assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[manifest.width,manifest.height]);assert.equal(bytes.length,shot.bytes);assert.equal(sha(bytes),shot.sha256);assert.equal(shot.webgl.lost,false);assert.deepEqual([shot.webgl.width,shot.webgl.height],[manifest.width,manifest.height]);assert.equal(shot.framing?.fullyInside,true,'actual entire owner fits this raw image');assert.ok(shot.framing.vertices>0&&shot.framing.maxNdc<1);
 assert.equal(shot.pausedRepeat?.passed,true);assert.equal(path.basename(shot.pausedRepeat.file),shot.pausedRepeat.file);const repeat=fs.readFileSync(path.join(directory,shot.pausedRepeat.file));assert.equal(repeat.length,shot.pausedRepeat.bytes);assert.equal(sha(repeat),shot.pausedRepeat.sha256);assert.equal(shot.pausedRepeat.sha256,shot.sha256);assert.ok(repeat.equals(bytes),'original captured paused pixels equal repeat');return true;
}
export function qualifyNativeSurfaceEvidence(manifest,directory,oracle,{requireComplete=true}={}){
 assert.equal(manifest.complete,true,'actual native browser capture completed');assert.ok([1440,412,360].includes(manifest.width));assert.equal(manifest.height,manifest.width===1440?1000:manifest.width===412?860:740);assert.equal(manifest.modelSourceSha256,sha(fs.readFileSync('src/render/britishCivicMarketModels.mjs')),'current source equals captured geometry');assert.deepEqual(manifest.sceneDigest,oracle.digest,'all current production mesh attributes/owners/instances equal actual captured scene');assert.equal(new Set(manifest.shots.map(s=>s.id)).size,manifest.shots.length,'one capture per declared view');
 const report={qualification:'Actual raw-PNG camera audits of complete unchanged native city under original D081 full-surface classifier. Missing mandatory samples are failures, never optional.',width:manifest.width,sourceCommit:manifest.sourceCommit,buildSha256:manifest.buildSha256,models:[],passed:false};
 for(const m of MODELS){const b=manifest.completedBuildings.find(b=>b.k===m.k&&b.v===m.v);assert.ok(b);const expected=oracle.city.buildings.find(x=>x.id===b.id);assert.deepEqual([b.k,b.v,b.x,b.z,b.size],[expected.k,expected.v,expected.x,expected.z,expected.size]);
  const front=manifest.shots.find(s=>s.id===m.id+'-front'),back=manifest.shots.find(s=>s.id===m.id+'-back');assert.ok(front&&back,'both original front and back images mandatory');
  const supplemental=manifest.shots.filter(s=>s.id.startsWith(m.id+'-surface-')),shots=[front,back,...supplemental],vp={W:manifest.width,H:manifest.height};for(const shot of shots)assertNativeSurfacePng(shot,manifest,directory);
  const contract=surfaceContract(oracle,front.camera,vp,b.id),audits=shots.map(shot=>({...auditSurface(oracle,shot.camera,vp,contract),capturedPng:shot.file,pngSha256:shot.sha256,camera:shot.camera})),visible=new Set(audits.flatMap(a=>a.visibleSamples)),missing=contract.probes.filter(p=>p.required&&!visible.has(p.id));let coverage=null;if(!missing.length)coverage=assertSurfaceCoverage(audits,contract,'D086 complete actual-PNG required surfaces');
  report.models.push({id:m.id,owner:b.id,contract,audits,missing,coverage,passed:missing.length===0});
 }
 report.passed=report.models.every(m=>m.passed);if(requireComplete)assert.ok(report.passed,'every unchanged mandatory surface must be visible in an actual captured product view');return report;
}

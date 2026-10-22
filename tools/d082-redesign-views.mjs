// Additive real-image evidence only. The unchanged D081 contract decides coverage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {sha,pairedCamera,assertCamera,VIEWS} from './d082-redesign-support.mjs';
import {surfaceContract,auditSurface} from './d082-redesign-surfaces.mjs';

export const STANDARD_VIEW_IDS=Object.freeze(['context','original','front','rear','side']);
export const SUPPLEMENTARY_VIEWS=Object.freeze([Math.PI*.08+1e-8,Math.PI/6,Math.PI*.32-1e-8].flatMap((elevation,e)=>
 Array.from({length:16},(_,yaw)=>Object.freeze({id:`surface-e${e}-y${yaw}`,spin:yaw*Math.PI/8,tilt:elevation-Math.PI/6}))
).filter(view=>!VIEWS.some(v=>Math.abs(Math.sin((v.spin-view.spin)/2))<1e-9&&Math.abs(v.tilt-view.tilt)<1e-9)));

export function planSupplementaryViews(before,after,shot,viewport,standardShots,{contracts:provided=null}={}){
 assert.deepEqual(standardShots.map(s=>s.view.id),STANDARD_VIEW_IDS,'all five original observed views retained in order');
 const original=standardShots.find(s=>s.view.id==='original'),states=[before,after];
 const contracts=provided??states.map(o=>surfaceContract(o,original,viewport,{rawParity:true,view:original.camera}));
 const required=contracts.map(c=>new Set(c.requiredSamples));
 const audits=states.map((o,i)=>standardShots.map(s=>auditSurface(o,s.camera,viewport,contracts[i])));
 const remove=(rows)=>rows.forEach((a,i)=>a.visibleSamples.forEach(id=>required[i].delete(id)));
 for(let j=0;j<standardShots.length;j++)remove(audits.map(rows=>rows[j]));
 const originalUncovered=required.map(s=>s.size);
 const candidates=SUPPLEMENTARY_VIEWS.map((view,index)=>{
  const camera=pairedCamera(before,after,{...shot,zoom:8,view},viewport,view);
  return {view,camera,index,rows:states.map((o,i)=>auditSurface(o,camera,viewport,contracts[i]))};
 });
 const selected=[];
 while(required.some(s=>s.size)){
  for(const r of candidates)r.gain=r.rows.map((a,i)=>a.visibleSamples.filter(id=>required[i].has(id)).length);
  candidates.sort((a,b)=>b.gain[0]+b.gain[1]-a.gain[0]-a.gain[1]||a.index-b.index);
  const best=candidates.shift();if(!best||best.gain[0]+best.gain[1]===0)break;
  remove(best.rows);best.rows.forEach((a,i)=>audits[i].push(a));
  selected.push({view:best.view,camera:best.camera,gain:best.gain,remaining:required.map(s=>s.size)});
 }
 const missing=contracts.map((c,i)=>c.probes.filter(p=>required[i].has(p.id)));
 const plan={slot:shot.k+':'+shot.v,width:viewport.W,owner:shot.owner,originalCamera:original.camera,
  standardViews:standardShots.map(s=>({view:s.view,camera:s.camera})),contractSha256:contracts.map(c=>c.sha256),
  required:contracts.map(c=>c.requiredSamples.length),originalUncovered,selected,
  remaining:missing.map(ps=>ps.length),passed:missing.every(ps=>ps.length===0),
  qualification:'Geometric planning only. Every selected view must be captured as paired production PNGs. Every original mandatory point remains required; residual probes still fail.'};
 return {plan,contracts,audits,missing};
}

export function assertPngEvidence(shot,directory){
 assert.equal(path.basename(shot.file),shot.file,'PNG is a local manifest filename');
 const bytes=fs.readFileSync(path.join(directory,shot.file));
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a','actual PNG signature');
 assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[shot.width,shot.height],'original PNG dimensions');
 assert.equal(bytes.length,shot.bytes,'original PNG byte count');assert.equal(sha(bytes),shot.sha256,'original PNG SHA256');
 assert.equal(shot.pausedRepeat?.passed,true,'exact paused repeat was captured');
 assert.equal(shot.pausedRepeat.sha256,shot.sha256);assert.equal(shot.pausedRepeat.canvasSha256,shot.canvasSha256);
 assert.equal(shot.geometryComparison?.allDigestFieldsExact,true,'complete production geometry was verified');
 return true;
}

export function assertCapturedSurfaceViews(manifest,target,width,{directory=null}={}){
 const relevant=manifest.shots.filter(s=>s.width===width&&s.k===target.k&&s.v===target.v&&['prototype','supplementary-surface'].includes(s.role));
 const plans=(manifest.supplementaryPlans??[]).filter(p=>p.slot===target.k+':'+target.v&&p.width===width);
 assert.equal(plans.length,1,'exactly one paired supplementary plan per owner and width');const plan=plans[0];
 assert.deepEqual(plan.standardViews.map(s=>s.view.id),STANDARD_VIEW_IDS);
 const phases=['before','after'].map(phase=>{
  const shots=relevant.filter(s=>s.phase===phase),standard=shots.filter(s=>s.role==='prototype'),extra=shots.filter(s=>s.role==='supplementary-surface');
  assert.deepEqual(standard.map(s=>s.view.id),STANDARD_VIEW_IDS,'the original five views cannot be dropped or duplicated');
  assert.equal(extra.length,plan.selected.length,'every planned supplementary view is actually captured');
  assert.equal(shots.length,STANDARD_VIEW_IDS.length+plan.selected.length,'exact expanded capture inventory');
  assert.equal(new Set(shots.map(s=>s.view.id)).size,shots.length,'no duplicate captured view IDs');
  standard.forEach((s,i)=>{assert.deepEqual(s.view,plan.standardViews[i].view);assert.deepEqual(s.camera,plan.standardViews[i].camera,'original observed camera is fixed');});
  extra.forEach((s,i)=>{
   const selected=plan.selected[i],legal=SUPPLEMENTARY_VIEWS.find(v=>v.id===selected.view.id);assert.ok(legal,'only existing legal orbit angles');assert.deepEqual(selected.view,legal);
   assert.deepEqual(s.view,selected.view,'captured supplementary view identity');assertCamera(s.camera,selected.camera);
  });
  for(const s of shots){assert.equal(s.owner,plan.owner);if(directory)assertPngEvidence(s,directory);}
  return shots;
 });
 assert.equal(relevant.length,phases.flat().length,'no unaccounted captured phases');
 phases[0].forEach((before,i)=>{
  const after=phases[1][i];assert.deepEqual(after.view,before.view);assert.deepEqual(after.camera,before.camera,'before/after exact paired observed cameras');
  assert.equal(after.worldSha256,before.worldSha256,'same unchanged saved world');assert.notEqual(after.file,before.file,'separate actual before/after PNGs');
 });
 assert.equal(new Set(phases.flat().map(s=>s.file)).size,phases.flat().length,'one original PNG per captured phase/view');
 assert.deepEqual(phases[0].find(s=>s.view.id==='original').camera,plan.originalCamera,'contract uses exact observed original camera');
 return {plan,phases};
}

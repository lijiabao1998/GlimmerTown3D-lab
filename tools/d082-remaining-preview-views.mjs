// Independent UNAPPROVED research. Original view catalog and every original gate stay unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {ROOT} from './cdp.mjs';
import {sha,pairedCamera,assertCamera,VIEWS} from './d082-remaining-preview-support.mjs';
import {d081OwnerSurfaceContract,d081OwnerSurfaceRayAudit,assertD081SurfaceCoverage} from './d081-frame.mjs';
export const surfaceContract=(o,s,vp)=>{const c=d081OwnerSurfaceContract(o,s.camera,vp,s.owner);assert.deepEqual(d081OwnerSurfaceContract(o,s.camera,vp,s.owner,{testOnlyRawSilhouetteRays:true}),c,'full unchanged D081 classifier equals raw Three rays');return c;};
export const auditSurface=d081OwnerSurfaceRayAudit,assertCoverage=assertD081SurfaceCoverage;
const STANDARD=['context','original','front','rear','side'];
export const RESEARCH_VIEWS=Object.freeze([
 ...[Math.PI*.08+1e-8,Math.PI/6,Math.PI*.32-1e-8].flatMap((e,i)=>Array.from({length:16},(_,j)=>({id:`surface-e${i}-y${j}`,spin:j*Math.PI/8,tilt:e-Math.PI/6}))),
 {id:'research-y123.75-e14.4',spin:11*Math.PI/16,tilt:Math.PI*.08+1e-8-Math.PI/6},
 {id:'research-y56.25-e14.4',spin:5*Math.PI/16,tilt:Math.PI*.08+1e-8-Math.PI/6},
 {id:'research-y67.5-e20',spin:3*Math.PI/8,tilt:Math.PI/9-Math.PI/6}
].filter(v=>!VIEWS.some(o=>Math.abs(Math.sin((o.spin-v.spin)/2))<1e-9&&Math.abs(o.tilt-v.tilt)<1e-9)));
export function planSupplementaryViews(before,after,shot,vp,standard,{quick=false}={}){
 assert.deepEqual(standard.map(s=>s.view.id),STANDARD);
 const plan={slot:shot.k+':'+shot.v,owner:shot.owner,width:vp.W,originalCamera:standard[1].camera,standardViews:standard.map(s=>({view:s.view,camera:s.camera})),selected:[],quick,qualification:'Unapproved research only. Every selected angle must have real paired PNGs. Original five views and complete D081 contracts are retained. Old frozen coordinates are separately audited and never waived.'};
 if(quick){plan.qualification+=' Quick image packet only; no surface coverage conclusion.';return {plan};}
 const folder=path.join(ROOT,'docs/evidence/D082-remaining-proposal'),receipt=JSON.parse(fs.readFileSync(path.join(folder,'frozen-actual-records.json')));
 for(const[file,hash]of Object.entries(receipt.files))assert.equal(sha(fs.readFileSync(path.join(folder,file))),hash,'unchanged actual ce33e3e record '+file);
 const frozen=JSON.parse(gunzipSync(fs.readFileSync(path.join(folder,`accepted-ce33-surface-${shot.k}-v${shot.v}-after-${vp.W}.json.gz`)))).contract;
 const prior=JSON.parse(fs.readFileSync(path.join(folder,`accepted-manifest-${vp.W}.json`))).shots.filter(s=>s.phase==='after'&&s.k===shot.k&&s.v===shot.v&&s.role==='supplementary-surface');
 const os=[before,after],contracts=os.map(o=>surfaceContract(o,standard[1],vp));assert.equal(sha(contracts[0]),sha(frozen),'every original frozen required point and flag is reproduced exactly in accepted ce33e3e');contracts[0]=frozen;
 if(shot.v===0)assert.equal(sha(contracts[1]),sha(frozen),'unchanged geometry camera research preserves the complete original contract');
 const missing=contracts.map(c=>new Set(c.requiredSamples));
 for(const s of standard)os.forEach((o,i)=>auditSurface(o,s.camera,vp,contracts[i]).visibleSamples.forEach(id=>missing[i].delete(id)));
 plan.contractSha256=contracts.map(c=>c.sha256);plan.required=contracts.map(c=>c.requiredSamples.length);plan.originalUncovered=missing.map(m=>m.size);
 for(const s of prior){const rows=os.map((o,i)=>auditSurface(o,s.camera,vp,contracts[i])),gain=rows.map((a,i)=>a.visibleSamples.filter(id=>missing[i].has(id)).length);rows.forEach((a,i)=>a.visibleSamples.forEach(id=>missing[i].delete(id)));plan.selected.push({view:s.view,camera:s.camera,gain,remaining:missing.map(m=>m.size),retainedPriorActualView:true});}
 plan.missingAfterRetainedPriorViews=missing.map(m=>m.size);
 const candidates=RESEARCH_VIEWS.map((view,index)=>{const camera=pairedCamera(before,after,{...shot,zoom:8,view},vp,view);return {view,camera,index,audits:os.map((o,i)=>auditSurface(o,camera,vp,contracts[i]))};});
 while(missing.some(m=>m.size)){
  for(const c of candidates)c.gain=c.audits.map((a,i)=>a.visibleSamples.filter(id=>missing[i].has(id)).length);
  candidates.sort((a,b)=>b.gain[0]+b.gain[1]-a.gain[0]-a.gain[1]||a.index-b.index);
  const best=candidates.shift();if(!best||!best.gain.some(Boolean))break;if(plan.selected.some(s=>s.view.id===best.view.id))continue;
  best.audits.forEach((a,i)=>a.visibleSamples.forEach(id=>missing[i].delete(id)));
  plan.selected.push({view:best.view,camera:best.camera,gain:best.gain,remaining:missing.map(m=>m.size)});
 }
 plan.remaining=missing.map(m=>m.size);plan.passed=missing.every(m=>m.size===0);return {plan,contracts};
}
export function assertPngEvidence(s,directory){
 assert.equal(path.basename(s.file),s.file);const b=fs.readFileSync(path.join(directory,s.file));assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.deepEqual([b.readUInt32BE(16),b.readUInt32BE(20)],[s.width,s.height]);assert.equal(b.length,s.bytes);assert.equal(sha(b),s.sha256);assert.equal(s.pausedRepeat?.passed,true);assert.equal(s.pausedRepeat.sha256,s.sha256);assert.equal(s.pausedRepeat.canvasSha256,s.canvasSha256);assert.equal(s.geometryComparison?.allDigestFieldsExact,true);return true;
}
export function assertCapturedSurfaceViews(m,t,width,{directory=null}={}){
 const plans=m.supplementaryPlans.filter(p=>p.slot===t.k+':'+t.v&&p.width===width);assert.equal(plans.length,1);const plan=plans[0];assert.deepEqual(plan.standardViews.map(s=>s.view.id),STANDARD);
 const relevant=m.shots.filter(s=>s.width===width&&s.k===t.k&&s.v===t.v&&['prototype','supplementary-surface'].includes(s.role));
 const phases=['before','after'].map(phase=>{const shots=relevant.filter(s=>s.phase===phase),standard=shots.filter(s=>s.role==='prototype'),extra=shots.filter(s=>s.role==='supplementary-surface');assert.deepEqual(standard.map(s=>s.view.id),STANDARD);assert.equal(extra.length,plan.selected.length);assert.equal(shots.length,5+plan.selected.length);assert.equal(new Set(shots.map(s=>s.view.id)).size,shots.length);
  standard.forEach((s,i)=>{assert.deepEqual(s.view,plan.standardViews[i].view);assertCamera(s.camera,plan.standardViews[i].camera);});
  extra.forEach((s,i)=>{const selected=plan.selected[i],legal=RESEARCH_VIEWS.find(v=>v.id===selected.view.id);assert.ok(legal);assert.deepEqual(selected.view,legal);assert.deepEqual(s.view,legal);assertCamera(s.camera,selected.camera);});
  for(const s of shots){assert.equal(s.owner,plan.owner);if(directory)assertPngEvidence(s,directory);}return shots;});
 phases[0].forEach((s,i)=>{assert.deepEqual(phases[1][i].view,s.view);assertCamera(phases[1][i].camera,s.camera);assert.equal(phases[1][i].worldSha256,s.worldSha256);assert.notEqual(phases[1][i].file,s.file);});assert.equal(new Set(relevant.map(s=>s.file)).size,relevant.length);assert.equal(relevant.length,phases.flat().length);return {plan,phases};
}

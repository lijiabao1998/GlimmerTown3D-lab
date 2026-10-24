// Deliberately separate from image capture: genuine coverage failures never prevent PNG delivery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {ROOT} from './cdp.mjs';
import {TARGETS,VIEWPORTS,QUALIFICATION,createOracle,sha} from './d082-redesign-support.mjs';
import {surfaceContract,auditSurface,assertCoverage} from './d082-redesign-surfaces.mjs';
import {assertCapturedSurfaceViews} from './d082-redesign-views.mjs';
import {currentLegalAngleObstructions,assertCapturedProductIdentity} from './d082-release-conflicts-v2.mjs';
import {retained185,assertRetained185Coverage} from './d082-185-retained.mjs';
const width=Number(process.env.D082_REDESIGN_WIDTHS??360),viewport=VIEWPORTS.find(v=>v.W===width);assert.ok(viewport);
const out=path.join(ROOT,'scratch/d082-redesign-coverage');fs.mkdirSync(out,{recursive:true});
const manifestPath=process.env.D082_CAPTURE_MANIFEST??path.join(ROOT,'scratch/d082-redesign/manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));assert.equal(manifest.complete,true);assert.equal(manifest.geometryPassed,true);
assertCapturedProductIdentity(manifest.provenance);
const report={qualification:QUALIFICATION,complete:false,passed:false,width,manifestSha256:sha(fs.readFileSync(manifestPath)),contracts:[],failures:[],policy:'Untouched D081 primary classifier and every mandatory probe. Exact raw Three parity. Only cameras actually captured in the paired production PNG manifest count. No analytic reclassification or downward-cap exemption.'};
const save=()=>fs.writeFileSync(path.join(out,`coverage-${width}.json`),JSON.stringify(report,null,2));save();
for(const target of TARGETS)for(const phase of ['before','after']){
 const {plan,phases}=assertCapturedSurfaceViews(manifest,target,width,{directory:path.dirname(manifestPath)}),phaseIndex=phase==='before'?0:1,shots=phases[phaseIndex];
 const original=shots.find(s=>s.view.id==='original'),o=createOracle('gallery',phase==='after',target.v);
 try{assert.equal(sha(o.digest),original.geometryComparison.fullProductionSceneSha256,'actual captured full geometry matches unchanged oracle');const contract=surfaceContract(o,original,viewport,{rawParity:true,view:original.camera});assert.equal(contract.sha256,plan.contractSha256[phaseIndex],'same full observed-original contract used for planning and actual capture');assert.equal(contract.requiredSamples.length,plan.required[phaseIndex]);
  const audits=shots.map(s=>({...auditSurface(o,s.camera,viewport,contract),capturedPng:s.file,pngSha256:s.sha256,camera:s.camera})),covered=new Set(audits.flatMap(a=>a.visibleSamples)),missing=contract.probes.filter(p=>p.required&&!covered.has(p.id)),obstructions=currentLegalAngleObstructions(o,target,contract,missing,{candidate:phase==='after'});let verdict=null,error=null;try{verdict=assertCoverage(audits,contract);}catch(e){error=e.message;}
  let retainedOld=null;const historical=phase==='after'?retained185(target,width):null;if(historical){const oldAudits=shots.map(s=>({...auditSurface(o,s.camera,viewport,historical.contract),capturedPng:s.file,pngSha256:s.sha256,camera:s.camera})),regression=assertRetained185Coverage(oldAudits,target,width);assert.equal(regression.oldFullCoordinatePassed,false,'complete superseded old185 coordinate contract stays an explicit historical failure');retainedOld={regression,contract:historical.contract,audits:oldAudits};}
  const record={slot:target.k+':'+target.v,phase,originalPng:original.file,required:contract.requiredSamples.length,covered:covered.size,missing:missing.length,originalHits:contract.originalHits,originalBlockedHits:contract.originalBlockedHits,rawThreeExact:true,capturedViews:shots.length,allLegalAngleBackFacing:obstructions.downward.length,passed:!error,verdict,error,...(retainedOld?{retainedOldCoordinates:retainedOld.regression}:{})};const file=`surface-${target.k}-v${target.v}-${phase}-${width}.json.gz`,bytes=gzipSync(JSON.stringify({record,contract,audits,missing,obstructions,...(retainedOld?{retainedOld}:{})}),{mtime:0});fs.writeFileSync(path.join(out,file),bytes);report.contracts.push({...record,file,sha256:sha(bytes)});if(error)report.failures.push({slot:record.slot,phase,missing:missing.length,file});console.log(JSON.stringify(record));save();
 }catch(error){report.failures.push({slot:target.k+':'+target.v,phase,error:error.stack??String(error)});save();}finally{o.dispose();}
}
assert.equal(report.contracts.length+report.failures.filter(f=>f.error).length,18);report.complete=true;report.passed=report.failures.length===0;save();if(!report.passed){console.error('Primary unchanged D081 surface coverage remains RED. All original images and complete per-probe failures are retained.');process.exitCode=1;}

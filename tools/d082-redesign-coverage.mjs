// Deliberately separate from image capture: genuine coverage failures never prevent PNG delivery.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {ROOT} from './cdp.mjs';
import {TARGETS,VIEWPORTS,QUALIFICATION,createOracle,sha} from './d082-redesign-support.mjs';
import {surfaceContract,auditSurface,assertCoverage} from './d082-redesign-surfaces.mjs';
const width=Number(process.env.D082_REDESIGN_WIDTHS??360),viewport=VIEWPORTS.find(v=>v.W===width);assert.ok(viewport);
const out=path.join(ROOT,'scratch/d082-redesign-coverage');fs.mkdirSync(out,{recursive:true});
const manifestPath=process.env.D082_CAPTURE_MANIFEST??path.join(ROOT,'scratch/d082-redesign/manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));assert.equal(manifest.complete,true);
const report={qualification:QUALIFICATION,complete:false,passed:false,width,manifestSha256:sha(fs.readFileSync(manifestPath)),contracts:[],failures:[],policy:'Untouched D081 primary classifier and every mandatory probe. Exact raw Three parity. Only cameras actually captured in the paired production PNG manifest count. No analytic reclassification or downward-cap exemption.'};
const save=()=>fs.writeFileSync(path.join(out,`coverage-${width}.json`),JSON.stringify(report,null,2));save();
for(const target of TARGETS)for(const phase of ['before','after']){
 const shots=manifest.shots.filter(s=>s.width===width&&s.phase===phase&&s.k===target.k&&s.v===target.v&&s.role==='prototype');assert.equal(shots.length,5);for(const id of ['original','context','front','rear','side'])assert.equal(shots.filter(s=>s.view.id===id).length,1);
 const original=shots.find(s=>s.view.id==='original'),o=createOracle('gallery',phase==='after',target.v);
 try{assert.equal(sha(o.digest),original.geometryComparison.fullProductionSceneSha256,'actual captured full geometry matches unchanged oracle');const contract=surfaceContract(o,original,viewport,{rawParity:true,view:original.camera}),audits=shots.map(s=>({...auditSurface(o,s.camera,viewport,contract),capturedPng:s.file,camera:s.camera})),covered=new Set(audits.flatMap(a=>a.visibleSamples)),missing=contract.probes.filter(p=>p.required&&!covered.has(p.id));let verdict=null,error=null;try{verdict=assertCoverage(audits,contract);}catch(e){error=e.message;}
  const record={slot:target.k+':'+target.v,phase,originalPng:original.file,required:contract.requiredSamples.length,covered:covered.size,missing:missing.length,originalHits:contract.originalHits,originalBlockedHits:contract.originalBlockedHits,rawThreeExact:true,passed:!error,verdict,error};const file=`surface-${target.k}-v${target.v}-${phase}-${width}.json.gz`,bytes=gzipSync(JSON.stringify({record,contract,audits,missing}),{mtime:0});fs.writeFileSync(path.join(out,file),bytes);report.contracts.push({...record,file,sha256:sha(bytes)});if(error)report.failures.push({slot:record.slot,phase,missing:missing.length,file});console.log(JSON.stringify(record));save();
 }catch(error){report.failures.push({slot:target.k+':'+target.v,phase,error:error.stack??String(error)});save();}finally{o.dispose();}
}
assert.equal(report.contracts.length+report.failures.filter(f=>f.error).length,18);report.complete=true;report.passed=report.failures.length===0;save();if(!report.passed){console.error('Primary unchanged D081 surface coverage remains RED. All original images and complete per-probe failures are retained.');process.exitCode=1;}

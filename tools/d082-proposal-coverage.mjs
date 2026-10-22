// Actual-PNG regression for the approved finite revision, retaining old failures.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {ROOT} from './cdp.mjs';
import {VIEWPORTS,createOracle,sha,caseBytes,drawCase,ACCEPTED,PREVIOUS_ACCEPTED,APPROVED_179_V1} from './d082-redesign-support.mjs';
import {surfaceContract,auditSurface,assertCoverage} from './d082-redesign-surfaces.mjs';
import {assertCapturedSurfaceViews} from './d082-redesign-views.mjs';
import {assertRetained179v1Coverage} from './d082-179v1-retained.mjs';
const width=Number(process.env.D082_REDESIGN_WIDTHS??412),viewport=VIEWPORTS.find(v=>v.W===width);assert.ok(viewport);
const manifestPath=process.env.D082_CAPTURE_MANIFEST??path.join(ROOT,'scratch/d082-redesign/manifest.json'),directory=path.dirname(manifestPath),manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));assert.equal(manifest.complete,true);assert.equal(manifest.geometryPassed,true);
for(const[file,hash]of Object.entries(manifest.provenance.sources))assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash,'actual captured product source remains exact: '+file);
const {phases}=assertCapturedSurfaceViews(manifest,{k:179,v:1},width,{directory}),shots=phases[1],original=shots.find(s=>s.view.id==='original'),o=createOracle('gallery',true,1);
const old=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,'docs/evidence/D082-redesign-first-red/supplementary-repair/surface-179-v1-after-412.json.gz')))).contract;
try{const contract=surfaceContract(o,original,viewport,{rawParity:true,view:original.camera}),audits=shots.map(s=>({...auditSurface(o,s.camera,viewport,contract),capturedPng:s.file,pngSha256:s.sha256,camera:s.camera})),coverage=assertCoverage(audits,contract),newIds=new Set(contract.requiredSamples),droppedOldIds=old.requiredSamples.filter(id=>!newIds.has(id));assert.deepEqual(droppedOldIds,[],'every old required ID remains required; none is made optional');
 const fixed=contract.probes.filter(p=>p.source==='fixed-triangle');assert.equal(fixed.length,352);assert.ok(fixed.every(p=>p.required),'all four probes of every actual exterior triangle remain mandatory');
 // The old coordinates are still tested and retained. This is an explicit geometry
 // revision proposal, not a claim that an old byte/coordinate pin has passed.
 const oldAudits=shots.map(s=>auditSurface(o,s.camera,viewport,old)),oldVisible=new Set(oldAudits.flatMap(a=>a.visibleSamples)),oldMissing=old.probes.filter(p=>p.required&&!oldVisible.has(p.id));let oldVerdict;try{assertCoverage(oldAudits,old);oldVerdict=true;}catch{oldVerdict=false;}
 const pin=caseBytes(drawCase(179,{v:1}));assert.notEqual(pin,PREVIOUS_ACCEPTED['179:1'].defaultGeometry);assert.equal(pin,ACCEPTED['179:1'].defaultGeometry);assert.equal(coverage.requiredSamples,1044);assert.equal(coverage.coveredSamples,1044);
 const retainedOldCoordinates=assertRetained179v1Coverage(oldAudits);
 const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/evidence/D082-179v1-proposal/487-coordinate-delta.json'),'utf8')),byId=new Map(contract.probes.map(p=>[p.id,p]));assert.equal(ledger.records.length,487);for(const r of ledger.records){const p=byId.get(r.id);assert.ok(p?.required);assert.deepEqual(p.point,r.newPoint,'same approved coordinate as the actual preview');/* JSON encodes -0 as 0; geometry byte pins still preserve the original float bits. */assert.deepEqual(p.normal.map(x=>x===0?0:x),r.newNormal,'same approved orientation as the actual preview');}
 if(width===412)for(const view of ['original','front']){const shot=shots.find(s=>s.view.id===view),file=`docs/evidence/D082-179v1-proposal/preview/proposal-90b80f4-179v1-${view}-412.png`;assert.equal(shot.sha256,sha(fs.readFileSync(path.join(ROOT,file))),'actual approved prototype PNG remains byte-identical to the reviewed preview');}
 const report={qualification:'Approved finite 179v1 geometry revision. Current exterior and all 524 non-superseded original coordinates require actual unchanged-classifier PNG coverage. Previous pins and the 487 reviewed physical differences remain historical failures. No complete D082 acceptance implied.',approval:APPROVED_179_V1.approval,complete:true,width,commit:manifest.provenance.commit,geometryPassed:manifest.geometryPassed,coverage,retainedOldCoordinates:{...retainedOldCoordinates,allActualCameras:true},droppedOldRequiredIds:droppedOldIds,addedRequiredIds:contract.requiredSamples.filter(id=>!old.requiredSamples.includes(id)),oldAcceptedPin:PREVIOUS_ACCEPTED['179:1'],approvedPin:ACCEPTED['179:1'],newGeometrySha256:pin,oldPinPassed:false,approvedPinPassed:true,oldFrozenCoordinateCoveragePassed:oldVerdict,oldRequiredCoordinateCount:old.requiredSamples.length,oldCoordinatesMissing:oldMissing.length,approvedDeltaRecordsVerified:487};
 const out=path.join(ROOT,'scratch/d082-proposal');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`coverage-${width}.json`),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,`coverage-${width}-full.json.gz`),gzipSync(JSON.stringify({report,contract,audits,oldContract:old,oldAudits,oldMissing})));console.log(JSON.stringify(report));
}finally{o.dispose();}

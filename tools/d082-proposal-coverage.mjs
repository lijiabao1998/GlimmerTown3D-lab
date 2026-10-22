// Preview evidence only. Does not replace or modify the frozen acceptance gates.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gunzipSync,gzipSync} from 'node:zlib';
import {ROOT} from './cdp.mjs';
import {VIEWPORTS,createOracle,sha,caseBytes,drawCase,ACCEPTED} from './d082-redesign-support.mjs';
import {surfaceContract,auditSurface,assertCoverage} from './d082-redesign-surfaces.mjs';
import {assertCapturedSurfaceViews} from './d082-redesign-views.mjs';
const width=Number(process.env.D082_REDESIGN_WIDTHS??412),viewport=VIEWPORTS.find(v=>v.W===width);assert.ok(viewport);
const directory=path.join(ROOT,'scratch/d082-redesign'),manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));assert.equal(manifest.complete,true);assert.equal(manifest.geometryPassed,true);
const {phases}=assertCapturedSurfaceViews(manifest,{k:179,v:1},width,{directory}),shots=phases[1],original=shots.find(s=>s.view.id==='original'),o=createOracle('gallery',true,1);
const old=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,'docs/evidence/D082-redesign-first-red/supplementary-repair/surface-179-v1-after-412.json.gz')))).contract;
try{const contract=surfaceContract(o,original,viewport,{rawParity:true,view:original.camera}),audits=shots.map(s=>({...auditSurface(o,s.camera,viewport,contract),capturedPng:s.file,pngSha256:s.sha256,camera:s.camera})),coverage=assertCoverage(audits,contract),newIds=new Set(contract.requiredSamples),droppedOldIds=old.requiredSamples.filter(id=>!newIds.has(id));assert.deepEqual(droppedOldIds,[],'every old required ID remains required; none is made optional');
 const fixed=contract.probes.filter(p=>p.source==='fixed-triangle');assert.equal(fixed.length,352);assert.ok(fixed.every(p=>p.required),'all four probes of every actual exterior triangle remain mandatory');
 // The old coordinates are still tested and retained. This is an explicit geometry
 // revision proposal, not a claim that an old byte/coordinate pin has passed.
 const oldAudits=shots.map(s=>auditSurface(o,s.camera,viewport,old)),oldVisible=new Set(oldAudits.flatMap(a=>a.visibleSamples)),oldMissing=old.probes.filter(p=>p.required&&!oldVisible.has(p.id));let oldVerdict;try{assertCoverage(oldAudits,old);oldVerdict=true;}catch{oldVerdict=false;}
 const pin=caseBytes(drawCase(179,{v:1}));assert.notEqual(pin,ACCEPTED['179:1'].defaultGeometry);
 const report={qualification:'UNAPPROVED geometry proposal. Actual new surfaces pass unchanged D081 coverage; old accepted byte/coordinate contracts remain rejecting baselines. No complete D082 acceptance implied.',complete:true,width,commit:manifest.provenance.commit,geometryPassed:manifest.geometryPassed,coverage,droppedOldRequiredIds:droppedOldIds,addedRequiredIds:contract.requiredSamples.filter(id=>!old.requiredSamples.includes(id)),oldAcceptedPin:ACCEPTED['179:1'],newGeometrySha256:pin,oldPinPassed:false,oldFrozenCoordinateCoveragePassed:oldVerdict,oldRequiredCoordinateCount:old.requiredSamples.length,oldCoordinatesMissing:oldMissing.length};
 const out=path.join(ROOT,'scratch/d082-proposal');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,`coverage-${width}.json`),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,`coverage-${width}-full.json.gz`),gzipSync(JSON.stringify({report,contract,audits,oldContract:old,oldAudits,oldMissing})));console.log(JSON.stringify(report));
}finally{o.dispose();}

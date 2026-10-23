// Actual paired PNG research with the UNCHANGED D081 classifier and every frozen old probe.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync,gunzipSync} from 'node:zlib';
import * as T from 'three';
import {ROOT} from './cdp.mjs';
import {VIEWPORTS,createOracle,drawCase,caseBytes,sha} from './d082-remaining-preview-support.mjs';
import {surfaceContract,auditSurface,assertCoverage,assertCapturedSurfaceViews} from './d082-remaining-preview-views.mjs';
const width=Number(process.env.D082_REDESIGN_WIDTHS??412),vp=VIEWPORTS.find(v=>v.W===width);assert.ok(vp);
const folder=path.join(ROOT,'scratch/d082-remaining-full'),m=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json')));assert.equal(m.complete,true);assert.equal(m.geometryPassed,true);assert.equal(m.quick,false);
const accepted=await import(pathToFileURL(path.join(process.env.D082_ACCEPTED_ROOT,'tools/d082-redesign-support.mjs')));
for(const[file,hash]of Object.entries(m.provenance.sources))assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),hash);
const out={qualification:'UNAPPROVED research only. New exterior, original frozen-coordinate regressions and unchanged-geometry camera gains are separately reported. No old probe is deleted or made optional; original guards remain unchanged. This is not D082 acceptance.',commit:m.provenance.commit,acceptedCommit:m.acceptedCommit,width,complete:false,cases:[],allCandidateExteriorPassed:false};
for(const [k,v]of [[185,0],[185,1],[185,2],[154,0]]){
 const {plan,phases}=assertCapturedSurfaceViews(m,{k,v},width,{directory:folder}),before=accepted.createOracle('gallery',true,v),after=createOracle('gallery',true,v);
 try{
  const original=phases[0].find(s=>s.view.id==='original'),frozenFile=path.join(ROOT,`docs/evidence/D082-remaining-proposal/accepted-ce33-surface-${k}-v${v}-after-${width}.json.gz`),prior=JSON.parse(gunzipSync(fs.readFileSync(frozenFile))),oldContract=prior.contract;
  assert.equal(sha(surfaceContract(before,original,vp)),sha(oldContract));
  const contract=surfaceContract(after,original,vp),audits=phases[1].map(s=>({...auditSurface(after,s.camera,vp,contract),capturedPng:s.file,pngSha256:s.sha256,camera:s.camera}));
  const oldBeforeAudits=phases[0].map(s=>auditSurface(before,s.camera,vp,oldContract)),oldAfterAudits=phases[1].map(s=>auditSurface(after,s.camera,vp,oldContract));
  for(const a of [...oldBeforeAudits,...oldAfterAudits]){assert.deepEqual(a.expectedSamples,oldContract.requiredSamples);assert.deepEqual(a.samples.map(s=>s.id),oldContract.requiredSamples);assert.equal(a.samples.length,oldContract.requiredSamples.length);}
  const visible=new Set(audits.flatMap(a=>a.visibleSamples)),oldVisible=new Set(oldAfterAudits.flatMap(a=>a.visibleSamples));let coverage=null,coverageError=null;try{coverage=assertCoverage(audits,contract,'unapproved candidate current exterior');}catch(e){coverageError=String(e);}
  const row={slot:k+':'+v,newRequired:contract.requiredSamples.length,newCovered:contract.requiredSamples.filter(id=>visible.has(id)).length,newMissing:contract.requiredSamples.filter(id=>!visible.has(id)).length,newExteriorPassed:coverageError===null,coverageError,oldFrozenRequired:oldContract.requiredSamples.length,oldFrozenMissing:oldContract.requiredSamples.filter(id=>!oldVisible.has(id)).length,oldFrozenCoordinateCoveragePassed:oldContract.requiredSamples.every(id=>oldVisible.has(id)),allOldRecordsPerView:oldContract.requiredSamples.length,allOldRequiredFlagsUnchanged:true,originalMissing:prior.missing.length,actualViews:phases[1].length,retainedPriorActualViews:plan.selected.filter(s=>s.retainedPriorActualView).length,addedResearchViews:plan.selected.filter(s=>!s.retainedPriorActualView).map(s=>({view:s.view,camera:s.camera,gain:s.gain})),geometryChanged:v!==0,acceptedPinsUpdated:false};
  let ledger=null;
  if(v===0){assert.equal(sha(contract),sha(oldContract));assert.equal(row.newMissing,row.oldFrozenMissing);row.recoveredByActualPairedNewViews=prior.missing.length-row.oldFrozenMissing;}
  else{
   const owner=after.city.buildings.find(b=>b.id===original.owner);assert.ok(owner);const meshTriangles=after.meshes.flatMap((mesh,mi)=>Array.from(after.owners[mi]).flatMap((id,t)=>{if(id!==owner.id)return[];const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,points=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,t*3+j).applyMatrix4(mesh.matrixWorld));return [{mi,t,triangle:new T.Triangle(...points),normal:new T.Vector3().fromBufferAttribute(n,t*3)}];}));
   const records=oldContract.probes.filter(p=>p.required).map(p=>{const point=new T.Vector3(...p.point),normal=new T.Vector3(...p.normal),match=meshTriangles.find(t=>t.normal.dot(normal)>1-1e-6&&t.triangle.closestPointToPoint(point,new T.Vector3()).distanceTo(point)<3e-6);return {...p,stillOnSameOrientedPhysicalSurface:Boolean(match),physicalMatch:match?{mesh:match.mi,triangle:match.t}:null,visibleInCandidateActualPngs:oldVisible.has(p.id)};});
   ledger={qualification:'Every frozen old required ID, position, normal and required flag retained unchanged. Superseded physical points remain explicit rejecting regressions, never current-surface equivalents.',slot:k+':'+v,width,originalContractSha256:oldContract.sha256,records,supersededOrientedPositions:records.filter(p=>!p.stillOnSameOrientedPhysicalSurface).length,survivingOrientedPositions:records.filter(p=>p.stillOnSameOrientedPhysicalSurface).length};
   row.physicalSupersededOldPoints=ledger.supersededOrientedPositions;row.survivingOldPoints=ledger.survivingOrientedPositions;
   const a=caseBytes(drawCase(k,{v})),b=accepted.caseBytes(accepted.drawCase(k,{v}));assert.notEqual(a,b);row.acceptedGeometrySha256=b;row.candidateGeometrySha256=a;row.oldAcceptedPinPassed=false;
  }
  const file=`surface-${k}-v${v}-${width}.json.gz`;fs.writeFileSync(path.join(folder,file),gzipSync(JSON.stringify({row,contract,audits,oldContract,oldBeforeAudits,oldAfterAudits,ledger}),{mtime:0}));if(ledger)fs.writeFileSync(path.join(folder,`old-coordinate-ledger-${k}-v${v}-${width}.json.gz`),gzipSync(JSON.stringify(ledger),{mtime:0}));row.fullEvidence=file;out.cases.push(row);console.log(JSON.stringify(row));
 }finally{before.dispose();after.dispose();}
}
out.allCandidateExteriorPassed=out.cases.filter(c=>c.geometryChanged).every(c=>c.newExteriorPassed);out.complete=true;fs.writeFileSync(path.join(folder,`coverage-${width}.json`),JSON.stringify(out,null,2));assert.equal(out.allCandidateExteriorPassed,true,'every proposed current exterior requires actual unchanged-classifier coverage; frozen old-coordinate failures stay explicit');

// Preserve the exact coordinates/normals of EVERY old point whose oriented surface
// was not superseded by the reviewed 487-position physical revision. No flags change.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {ROOT} from './cdp.mjs';
import {sha} from './d082-redesign-support.mjs';
let saved;
export function retained179v1(target){
 if(target.k!==179||target.v!==1)return null;
 if(!saved){const contract=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,'docs/evidence/D082-redesign-first-red/supplementary-repair/surface-179-v1-after-412.json.gz')))).contract,ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/evidence/D082-179v1-proposal/487-coordinate-delta.json'),'utf8')),superseded=new Set(ledger.records.map(r=>r.id));
  assert.equal(contract.requiredSamples.length,1011);assert.equal(superseded.size,487);assert.ok(contract.probes.filter(p=>contract.requiredSamples.includes(p.id)).every(p=>p.required));
  const retainedIds=contract.requiredSamples.filter(id=>!superseded.has(id));assert.equal(retainedIds.length,524);
  saved={contract,retainedIds,supersededIds:[...superseded],ledgerSha256:sha(fs.readFileSync(path.join(ROOT,'docs/evidence/D082-179v1-proposal/487-coordinate-delta.json')))};
 }
 return saved;
}
export function assertRetained179v1Coverage(audits){
 const old=retained179v1({k:179,v:1}),{sha256,...body}=old.contract;assert.equal(sha(body),sha256,'untouched complete old coordinate contract');assert.ok(audits.length);
 for(const a of audits){assert.equal(a.owner,old.contract.owner);assert.equal(a.contractSha256,sha256);assert.deepEqual(a.expectedSamples,old.contract.requiredSamples);assert.deepEqual(a.samples.map(p=>p.id),old.contract.requiredSamples,'all 1011 old required records remain in every view, including all 487 superseded positions');assert.deepEqual(a.visibleSamples,a.samples.filter(p=>p.visible).map(p=>p.id));}
 const visible=new Set(audits.flatMap(a=>a.visibleSamples)),missing=old.contract.requiredSamples.filter(id=>!visible.has(id));
 assert.deepEqual([...missing].sort(),[...old.supersededIds].sort(),'only the explicitly approved 487 oriented positions may differ; every other old coordinate is mandatory');
 return{required:524,covered:524,supersededOrientedPositions:487,oldRequiredRecordsPerView:1011,oldRequiredFlagsUnchanged:true,views:audits.length};
}

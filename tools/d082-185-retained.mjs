// Every old required record remains present. Only the explicitly approved409/443
// physical replacements are historical failures;418/354 surviving points stay mandatory.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {gunzipSync} from 'node:zlib';
import {ROOT} from './cdp.mjs';import {APPROVED_185,sha} from './d082-redesign-support.mjs';
const saved=new Map();
export function retained185(target,width=412){
 if(target.k!==185||![1,2].includes(target.v))return null;assert.ok([1440,360,412].includes(width));const slot=`185:${target.v}`,key=slot+':'+width;if(saved.has(key))return saved.get(key);
 const prefix='docs/evidence/D082-185-approved-adoption/',contractPath=prefix+`accepted-ce33-surface-185-v${target.v}-after-${width}.json.gz`,ledgerPath=prefix+`actual-${width}/old-coordinate-ledger-185-v${target.v}-${width}.json.gz`;
 for(const file of [contractPath,ledgerPath])assert.equal(sha(fs.readFileSync(path.join(ROOT,file))),APPROVED_185.evidence[file],'immutable approved185 old-coordinate evidence');
 const contract=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,contractPath)))).contract,ledger=JSON.parse(gunzipSync(fs.readFileSync(path.join(ROOT,ledgerPath)))),required=target.v===1?827:797,retainedCount=target.v===1?418:354,supersededCount=target.v===1?409:443;
 assert.equal(contract.requiredSamples.length,required);assert.equal(ledger.originalContractSha256,contract.sha256);assert.equal(ledger.records.length,required);assert.equal(ledger.supersededOrientedPositions,supersededCount);assert.equal(ledger.survivingOrientedPositions,retainedCount);
 const byId=new Map(contract.probes.map(p=>[p.id,p]));assert.deepEqual(ledger.records.map(r=>r.id),contract.requiredSamples);
 for(const r of ledger.records){assert.equal(r.required,true);const p=byId.get(r.id);assert.ok(p?.required);for(const k of Object.keys(p))assert.deepEqual(r[k],p[k],'every frozen original185 probe field retained');}
 const retainedIds=ledger.records.filter(r=>r.stillOnSameOrientedPhysicalSurface).map(r=>r.id),supersededIds=ledger.records.filter(r=>!r.stillOnSameOrientedPhysicalSurface).map(r=>r.id);assert.equal(retainedIds.length,retainedCount);assert.equal(supersededIds.length,supersededCount);
 const value={slot,width,contract,retainedIds,supersededIds,ledgerSha256:sha(fs.readFileSync(path.join(ROOT,ledgerPath)))};saved.set(key,value);return value;
}
export function assertRetained185Coverage(audits,target,width=412){
 const old=retained185(target,width);assert.ok(old);assert.ok(audits.length);for(const a of audits){assert.equal(a.owner,old.contract.owner);assert.equal(a.contractSha256,old.contract.sha256);assert.deepEqual(a.expectedSamples,old.contract.requiredSamples);assert.deepEqual(a.samples.map(s=>s.id),old.contract.requiredSamples,'all old185 required records, including replacements, remain in every actual-view audit');assert.deepEqual(a.visibleSamples,a.samples.filter(s=>s.visible).map(s=>s.id));}
 const visible=new Set(audits.flatMap(a=>a.visibleSamples)),missing=old.retainedIds.filter(id=>!visible.has(id));assert.deepEqual(missing,[],'every surviving old185 coordinate is visible in actual declared PNG views');
 return{slot:old.slot,width,required:old.retainedIds.length,covered:old.retainedIds.filter(id=>visible.has(id)).length,oldRequiredRecordsPerView:old.contract.requiredSamples.length,supersededOrientedPositions:old.supersededIds.length,allOldRequiredFlagsUnchanged:true,views:audits.length,oldFullCoordinateMissing:old.contract.requiredSamples.filter(id=>!visible.has(id)).length,oldFullCoordinatePassed:old.contract.requiredSamples.every(id=>visible.has(id)),ledgerSha256:old.ledgerSha256};
}

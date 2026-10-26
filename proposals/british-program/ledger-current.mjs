// Current publication ledger. The original147/D086-candidate ledger and every
// assertion remain an immutable historical snapshot, never a current count.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadBritishProgramLedger} from './ledger-check.mjs';
export const BASELINE='b4275bda73e72a9fb48343376fccaab52bbc8e84';
export const CURRENT_LEDGER='fixtures/british-program/ledger-157-d087-candidate.json';
export const CURRENT_LEDGER_SHA='4fa92b512b8c89ccf62eba463b7205146596a654561d6d8a0690df870588f559';
export const PUBLISHED_MODELS_SHA='063c0730c22aa4070e15fe42c277e1cee72ea2be73055d6ec4d812b66e883255';
export const RELEASE_RECEIPT_SHA='b0ddd51fc4bdd1c7bc8dd2a7afe218536fc4213443ea042dd27e4bc3904c4f67';
export const sha=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const historical=loadBritishProgramLedger();
export function assertCurrentLedger(m,receipt,scope,models){
 assert.equal(m.schema,2);assert.equal(m.publishedBaseline,BASELINE);
 assert.equal(m.publishedCount,157);assert.equal(m.publishedWaveCount,16);
 assert.equal(m.targetCount,200);assert.equal(m.targetWaveCount,20);
 assert.deepEqual(m.publishedWaves.slice(0,15),historical.publishedWaves,'all historical waves immutable');
 assert.equal(m.publishedWaves.length,16);assert.deepEqual(m.excluded,historical.excluded);
 const w=m.publishedWaves[15];assert.equal(w.wave,16);assert.equal(w.card,'D086');assert.equal(w.publishedCountBefore,147);assert.equal(w.publishedCountAfter,157);assert.equal(w.releasedCommit,BASELINE);assert.deepEqual(w.slots,historical.candidate.slots);assert.equal(w.publicationReceipt,'docs/evidence/D086-release/verified-publication.json');assert.equal(w.publicationReceiptSha256,RELEASE_RECEIPT_SHA);
 assert.equal(receipt.state,'accepted-and-published');assert.equal(receipt.main,BASELINE);assert.equal(receipt.gitTree,scope.baselineTree);assert.equal(receipt.mainCI.totalJobs,82);assert.equal(receipt.mainCI.success,82);assert.equal(receipt.mainCI.skipped,0);assert.equal(receipt.publicChecks.length,2);for(const p of receipt.publicChecks){assert.equal(p.sha256,receipt.mainEvidence.buildSha256);assert.equal(p.bytes,receipt.mainEvidence.buildBytes);}
 assert.equal(scope.baseline,BASELINE);assert.equal(scope.wave,17);assert.equal(scope.batch,'D087');assert.equal(scope.models.length,11);
 assert.equal(models.length,157);assert.equal(sha(models),m.publishedModelDigest);assert.deepEqual(m.publishedWaves.flatMap(w=>w.slots).sort(),models.map(x=>x.slot).sort());for(const key of ['slot','full','architecture'])assert.equal(new Set(models.map(x=>x[key])).size,157);
 const c=m.candidate;assert.equal(c.card,'D087');assert.equal(c.wave,17);assert.equal(c.state,'candidate-not-accepted');assert.equal(c.publishedCountBefore,157);assert.equal(c.candidateCount,11);assert.equal(c.verifiedPublishedCountAfter,null);assert.equal(c.remainingPublished,43);assert.equal(c.remainingOnlyAfterVerifiedPublication,32);assert.deepEqual(c.slots,scope.models.map(x=>x.k+':'+x.v));assert.equal(new Set([...models.map(x=>x.slot),...c.slots]).size,168);
 assert.deepEqual(m.prospective,[{wave:18,count:11},{wave:19,count:11},{wave:20,count:10}]);assert.equal(157+11+m.prospective.reduce((n,w)=>n+w.count,0),200);assert.equal(16+1+m.prospective.length,20);
 return {published:157,candidate:11,candidateTotal:168,remainingPublished:43,target:200};
}
export function loadCurrentLedger(){const read=f=>fs.readFileSync(f);assert.equal(sha(read(CURRENT_LEDGER)),CURRENT_LEDGER_SHA);assert.equal(sha(read('fixtures/d087/published-157-models.json')),PUBLISHED_MODELS_SHA);const rb=read('docs/evidence/D086-release/verified-publication.json');assert.equal(sha(rb),RELEASE_RECEIPT_SHA);const values=[CURRENT_LEDGER,'docs/evidence/D086-release/verified-publication.json','proposals/d087/scope.json','fixtures/d087/published-157-models.json'].map(f=>JSON.parse(read(f)));assertCurrentLedger(...values);return values;}
export function assertCurrentModelJoin(report,values=loadCurrentLedger()){
 const [ledger,receipt,scope,published]=values;assertCurrentLedger(...values);assert.equal(report.passed,true);assert.equal(report.baseline,ledger.publishedBaseline);assert.equal(report.mode,'current candidate');assert.equal(report.oldCount,157);assert.equal(report.newCount,11);assert.equal(report.models.length,168);assert.deepEqual(report.models.slice(0,157),published,'current actual old157 equals independently published identities');assert.deepEqual(report.models.slice(157).map(x=>x.slot),scope.models.map(x=>x.k+':'+x.v));for(const key of ['slot','full','architecture'])assert.equal(new Set(report.models.map(x=>x[key])).size,168,'all current168 native identities distinct '+key);return {published:157,actualDistinctCandidate:11,acceptedIncrement:0,remainingPublished:43};
}

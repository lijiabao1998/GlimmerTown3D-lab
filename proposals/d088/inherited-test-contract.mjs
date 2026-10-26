// Source-version contracts are finite and fail closed. Actual compatible tests
// are never moved to historical execution merely because a current test fails.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{assertInheritedDomains as assertD087DomainBytes}from'../d087/inherited-test-contract.mjs';
import{assertD088NativeCheckCopies}from'../../tools/d088-native-check-versions.mjs';
export const INHERITED_BASELINE='cdd541da74973dba2ca73b782936c012d315add9';
export const PRIOR_BASELINE='b4275bda73e72a9fb48343376fccaab52bbc8e84';
export const DOMAIN_MANIFEST='proposals/d088/inherited-test-domains.json';
export const DOMAIN_MANIFEST_SHA="428ab93b17fbf967b2f8b30bbddb864458277f3263da15d996332d8d83954ec1";
export const sha=x=>createHash('sha256').update(x).digest('hex');
const read=f=>fs.readFileSync(f,'utf8');
export function assertInheritedDomains(bytes=read(DOMAIN_MANIFEST),source=read){
 assert.equal(sha(bytes),DOMAIN_MANIFEST_SHA,'exact finite current/historical domain manifest');const m=JSON.parse(bytes);assert.equal(m.schema,1);assert.equal(m.baseline,INHERITED_BASELINE);assert.equal(m.priorBaseline,PRIOR_BASELINE);assert.equal(sha(source(m.priorManifest)),m.priorManifestSha256);const prior=assertD087DomainBytes(source(m.priorManifest),source);assertD088NativeCheckCopies(undefined,source);
 assert.equal(m.d086Originals.length,37);assert.equal(m.d087Originals.length,28);assert.equal(new Set(m.d087Originals.map(r=>r.file)).size,28);assert.equal(m.d086Originals.filter(r=>r.domain==='actual-current').length,30);assert.equal(m.d087Originals.filter(r=>r.domain==='actual-current').length,17);assert.equal(m.d087Originals.filter(r=>r.domain==='actual-immutable-cdd').length,11);
 assert.equal(m.originalCommands.d086,prior.originalCommand);assert.equal(m.originalCommands.d087,'node --test tools/d087-*.test.mjs proposals/d087/*.test.mjs proposals/british-program/ledger-check.test.mjs proposals/british-program/ledger-current.test.mjs');assert.deepEqual(m.b427ExtraHistorical,prior.extraHistorical);
 for(let i=0;i<37;i++){const r=m.d086Originals[i],p=prior.originalTests[i];assert.deepEqual({...r,current:p.current},p);assert.equal(r.current,p.current==='tools/d083-release-trigger-d087.test.mjs'?'tools/d083-release-trigger-d088.test.mjs':p.current);}
 for(const r of [...m.d086Originals,...m.d087Originals,...m.b427ExtraHistorical,...m.cddExtraHistorical])assert.equal(sha(source(r.file)),r.sha256,r.file+' original assertions immutable');
 for(const r of m.currentCopies){let expected=source(r.source);assert.equal(sha(expected),r.sourceSha256);for(const c of r.changes){assert.equal(expected.split(c.before).length-1,c.count);expected=expected.split(c.before).join(c.after);}assert.equal(source(r.target),expected,r.target+' every undeclared assertion retained');assert.equal(sha(expected),r.targetSha256);}
 assert.equal(m.currentAdditions.length,14);assert.equal(new Set(m.currentAdditions).size,14);assert.equal(m.cddExtraHistorical.length,3);for(const r of m.d087Originals){assert.ok(['actual-current','actual-immutable-cdd'].includes(r.domain));assert.ok(r.currentCoverage.length);for(const f of r.currentCoverage)assert.ok(f===r.file||m.currentAdditions.includes(f)||f==='proposals/d087/native-variant-d088.test.mjs','every historical contract has explicit current replacement');}
 return m;
}
export function domainPlan(m,suite='all'){
 assert.ok(['all','d086','d087'].includes(suite),'unknown suite is never an empty green run');const plan=[];
 if(suite!=='d087')plan.push({name:'actual-immutable-b427',source:PRIOR_BASELINE,files:[...m.d086Originals.filter(r=>r.domain==='actual-immutable-b427'),...m.b427ExtraHistorical].map(r=>r.file)});
 if(suite!=='d086')plan.push({name:'actual-immutable-cdd',source:INHERITED_BASELINE,files:[...m.d087Originals.filter(r=>r.domain==='actual-immutable-cdd'),...m.cddExtraHistorical].map(r=>r.file)});
 const current=[...(suite==='d087'?[]:m.d086Originals.filter(r=>r.domain==='actual-current').map(r=>r.current)),...(suite==='d086'?[]:m.d087Originals.flatMap(r=>r.currentCoverage)),...m.currentLedgerSnapshots,...m.currentAdditions];
 plan.push({name:'actual-current',source:'candidate',files:[...new Set(current)]});assert.ok(plan.every(p=>p.files.length));return plan;
}

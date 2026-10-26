// D090 finite pipe-selector validation successor; exact e4c original is retained and tested on its actual source.
// Finite outer source-version layer. Old compatible tests remain on actual current
// product; original source-version tests execute on their own immutable commits.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{assertInheritedDomains as assertPriorDomains,domainPlan as priorPlan}from'../d089/inherited-test-contract.mjs';
import{assertD090NativeCheckCopies}from'../../tools/d090-native-check-versions.mjs';
import{assertNativeFarmPrecedenceCopy}from'./native-farm-precedence-copy.mjs';
export const INHERITED_BASELINE='5b41bac165ba2b29146e6835490357bebc3cd549';
export const DOMAIN_MANIFEST='proposals/d090/inherited-test-domains-pipes-v2.json';
export const DOMAIN_MANIFEST_SHA="eab1ae895e76813de6ece4e198b101d532709320fd0707339627350cefef3579";
export const sha=x=>createHash('sha256').update(x).digest('hex');
const read=f=>fs.readFileSync(f,'utf8');
export function assertInheritedDomains(bytes=read(DOMAIN_MANIFEST),source=read){
 assert.equal(sha(bytes),DOMAIN_MANIFEST_SHA,'exact finite D090 current/historical manifest');const m=JSON.parse(bytes);assert.equal(m.schema,1);assert.equal(m.baseline,INHERITED_BASELINE);assert.equal(sha(source(m.priorManifest)),m.priorManifestSha256);const prior=assertPriorDomains(source(m.priorManifest),source);assertD090NativeCheckCopies(undefined,source);assertNativeFarmPrecedenceCopy(source);
 assert.equal(m.d089Originals.length,30);assert.equal(new Set(m.d089Originals.map(r=>r.file)).size,30);assert.equal(m.d089Originals.filter(r=>r.domain==='actual-current').length,16);assert.equal(m.d089Originals.filter(r=>r.domain==='actual-immutable-5b41').length,14);assert.equal(m.published5bExtraHistorical.length,7);assert.equal(m.currentAdditions.length,23);assert.equal(new Set(m.currentAdditions).size,23);
 for(const r of [...m.d089Originals,...m.published5bExtraHistorical])assert.equal(sha(source(r.file)),r.sha256,r.file+' original assertions remain immutable');
 for(const r of m.d089Originals){assert.ok(['actual-current','actual-immutable-5b41'].includes(r.domain));assert.deepEqual(r.currentCoverage,m.currentReplacements[r.file]??[r.file]);assert.equal(r.domain,Object.hasOwn(m.currentReplacements,r.file)?'actual-immutable-5b41':'actual-current');}
 for(const [f,coverage]of Object.entries(m.currentReplacements)){assert.ok([...m.d089Originals,...m.published5bExtraHistorical].some(r=>r.file===f));assert.ok(coverage.length);for(const target of coverage)assert.ok(source(target).length>0,'named current replacement exists '+target);}
 for(const r of m.currentCopies){let expected=source(r.source);assert.equal(sha(expected),r.sourceSha256);for(const c of r.changes){assert.equal(expected.split(c.before).length-1,c.count);expected=expected.split(c.before).join(c.after);}assert.equal(source(r.target),expected,'all undeclared current copy assertions retained');assert.equal(sha(expected),r.targetSha256);}
 assert.deepEqual(m.currentLedgerSnapshots,[...prior.currentLedgerSnapshots,'proposals/british-program/ledger-current-v4.test.mjs']);return m;
}
export function domainPlan(m,suite='all'){
 assert.ok(['all','d086','d087','d088','d089'].includes(suite),'unknown suite is never empty green');const prior=JSON.parse(read(m.priorManifest)),old=priorPlan(prior,suite==='d089'?'all':suite),plans=old.filter(p=>p.source!=='candidate');
 const current=old.find(p=>p.source==='candidate').files.flatMap(f=>m.currentReplacements[f]??[f]);
 plans.push({name:'actual-immutable-5b41',source:INHERITED_BASELINE,files:[...m.d089Originals.filter(r=>r.domain==='actual-immutable-5b41'),...m.published5bExtraHistorical].map(r=>r.file)});
 plans.push({name:'actual-current',source:'candidate',files:[...new Set([...current,...m.d089Originals.flatMap(r=>r.currentCoverage),...m.currentLedgerSnapshots,...m.currentAdditions])]});assert.ok(plans.every(p=>p.files.length));return plans;
}

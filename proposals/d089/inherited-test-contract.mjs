// Finite outer source-version layer. Old compatible tests remain on actual current
// product; original source-version tests execute on their own immutable commits.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{assertInheritedDomains as assertPriorDomains,domainPlan as priorPlan}from'../d088/inherited-test-contract.mjs';
import{assertD089NativeCheckCopies}from'../../tools/d089-native-check-versions.mjs';
import{assertNativeFarmPrecedenceCopy}from'./native-farm-precedence-copy.mjs';
export const INHERITED_BASELINE='c023a2da0e4999d43e3d4216e800c4c96d06a3c1';
export const DOMAIN_MANIFEST='proposals/d089/inherited-test-domains.json';
export const DOMAIN_MANIFEST_SHA='d4ff555a10cc7afc2cf15c88ff94272ca9071cc362acd8e5b17b62275cef6158';
export const sha=x=>createHash('sha256').update(x).digest('hex');
const read=f=>fs.readFileSync(f,'utf8');
export function assertInheritedDomains(bytes=read(DOMAIN_MANIFEST),source=read){
 assert.equal(sha(bytes),DOMAIN_MANIFEST_SHA,'exact finite D089 current/historical manifest');const m=JSON.parse(bytes);assert.equal(m.schema,1);assert.equal(m.baseline,INHERITED_BASELINE);assert.equal(sha(source(m.priorManifest)),m.priorManifestSha256);const prior=assertPriorDomains(source(m.priorManifest),source);assertD089NativeCheckCopies(undefined,source);assertNativeFarmPrecedenceCopy(source);
 assert.equal(m.d088Originals.length,28);assert.equal(new Set(m.d088Originals.map(r=>r.file)).size,28);assert.equal(m.d088Originals.filter(r=>r.domain==='actual-current').length,18);assert.equal(m.d088Originals.filter(r=>r.domain==='actual-immutable-c023').length,10);assert.equal(m.c023ExtraHistorical.length,5);assert.equal(m.currentAdditions.length,19);assert.equal(new Set(m.currentAdditions).size,19);
 for(const r of [...m.d088Originals,...m.c023ExtraHistorical])assert.equal(sha(source(r.file)),r.sha256,r.file+' original assertions remain immutable');
 for(const r of m.d088Originals){assert.ok(['actual-current','actual-immutable-c023'].includes(r.domain));assert.deepEqual(r.currentCoverage,m.currentReplacements[r.file]??[r.file]);assert.equal(r.domain,Object.hasOwn(m.currentReplacements,r.file)?'actual-immutable-c023':'actual-current');}
 for(const [f,coverage]of Object.entries(m.currentReplacements)){assert.ok([...m.d088Originals,...m.c023ExtraHistorical].some(r=>r.file===f));assert.ok(coverage.length);for(const target of coverage)assert.ok(source(target).length>0,'named current replacement exists '+target);}
 for(const r of m.currentCopies){let expected=source(r.source);assert.equal(sha(expected),r.sourceSha256);for(const c of r.changes){assert.equal(expected.split(c.before).length-1,c.count);expected=expected.split(c.before).join(c.after);}assert.equal(source(r.target),expected,'all undeclared current copy assertions retained');assert.equal(sha(expected),r.targetSha256);}
 assert.deepEqual(m.currentLedgerSnapshots,[...prior.currentLedgerSnapshots,'proposals/british-program/ledger-current-v3.test.mjs']);return m;
}
export function domainPlan(m,suite='all'){
 assert.ok(['all','d086','d087','d088'].includes(suite),'unknown suite is never empty green');const prior=JSON.parse(read(m.priorManifest)),old=priorPlan(prior,suite==='d088'?'all':suite),plans=old.filter(p=>p.source!=='candidate');
 const current=old.find(p=>p.source==='candidate').files.flatMap(f=>m.currentReplacements[f]??[f]);
 plans.push({name:'actual-immutable-c023',source:INHERITED_BASELINE,files:[...m.d088Originals.filter(r=>r.domain==='actual-immutable-c023'),...m.c023ExtraHistorical].map(r=>r.file)});
 plans.push({name:'actual-current',source:'candidate',files:[...new Set([...current,...m.d088Originals.flatMap(r=>r.currentCoverage),...m.currentLedgerSnapshots,...m.currentAdditions])]});assert.ok(plans.every(p=>p.files.length));return plans;
}

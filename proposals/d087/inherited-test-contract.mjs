// Finite migration of source-version tests, not a current-regression exemption.
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export const INHERITED_BASELINE='b4275bda73e72a9fb48343376fccaab52bbc8e84';
export const DOMAIN_MANIFEST_SHA='82a01078dc75cda3e0bf57c5e4e9ce13203459b28abfbe703280fa194bfac20a';
export const DOMAIN_MANIFEST='proposals/d087/inherited-test-domains.json';
export const sha=x=>createHash('sha256').update(x).digest('hex');
const read=f=>fs.readFileSync(f,'utf8');
export function assertInheritedDomains(bytes=read(DOMAIN_MANIFEST),source=read){
 assert.equal(sha(bytes),DOMAIN_MANIFEST_SHA,'exact finite current/historical test domains');const m=JSON.parse(bytes);assert.equal(m.schema,1);assert.equal(m.baseline,INHERITED_BASELINE);
 assert.equal(m.originalTests.length,37);assert.equal(new Set(m.originalTests.map(r=>r.file)).size,37);assert.equal(m.originalTests.filter(r=>r.domain==='actual-immutable-b427').length,7);assert.equal(m.originalTests.filter(r=>r.domain==='actual-current').length,30);
 assert.equal(m.originalCommand,'node --test '+m.originalTests.map(r=>r.file).join(' '));
 for(const r of [...m.originalTests,...m.extraHistorical])assert.equal(sha(source(r.file)),r.sha256,r.file+' original assertion bytes retained');
 for(const r of m.copies){const old=source(r.source);assert.equal(sha(old),r.sourceSha256);let expected=old;for(const c of r.changes){assert.equal(expected.split(c.before).length-1,c.count,'finite seam count '+r.target);expected=expected.split(c.before).join(c.after);}assert.equal(source(r.target),expected,'every non-declared assertion unchanged '+r.target);assert.equal(sha(expected),r.targetSha256);}
 for(const r of m.originalTests){assert.ok(['actual-immutable-b427','actual-current'].includes(r.domain));if(r.current!==r.file)assert.ok(m.copies.some(c=>c.source===r.file&&c.target===r.current),'every current replacement has exact assertion delta');}
 assert.deepEqual(m.currentAdditions,['tools/d087-source.test.mjs','tools/d087-current-guards.test.mjs','tools/d087-coastal-current-guard.test.mjs','tools/d087-kind-metadata-contract.test.mjs','tools/d087-native-check-versions.test.mjs','tools/d087-validation.test.mjs','proposals/d087/original-camera-restoration.test.mjs','proposals/british-program/ledger-current.test.mjs']);
 return m;
}

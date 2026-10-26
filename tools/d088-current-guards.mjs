// Finite routes. Historical copy-byte checks stay active; their superseded
// twenty-one-argument actual-call check is not misrepresented as current.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{assertD087GuardCopies,assertD087InheritedCopyBytes}from'./d087-current-guards.mjs';
import{assertD087NativeCheckCopies}from'./d087-native-check-versions.mjs';
import{assertD088CoastalShapeCall}from'./d088-coastal-current-guard.mjs';
import{assertD088NativeCheckCopies}from'./d088-native-check-versions.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
export const D088_GUARD_MANIFEST_SHA='889e9691e6af725bfc3faf0490237bc4cc6f660de3606e7bc0b319ea9629ac88';
export const D088_GUARD_ROUTES=Object.freeze({'./unit-d052.mjs':'./unit-d052-d088.mjs','./unit-d053.mjs':'./unit-d053-d088.mjs','./unit-d054-ui.mjs':'./unit-d054-ui-d088.mjs','./unit-d055-native.mjs':'./unit-d055-native-d088.mjs','./unit-d081-touch-lease.mjs':'./unit-d081-touch-lease-d088.mjs','./unit-d082-release-v2.mjs':'./unit-d082-release-d088.mjs'});
export function assertD088GuardCopies(bytes=read('proposals/d088/native-guard-versions.json'),source=read){assert.equal(sha(bytes),D088_GUARD_MANIFEST_SHA);const m=JSON.parse(bytes);assert.equal(m.schema,1);assert.equal(m.baseline,'cdd541da74973dba2ca73b782936c012d315add9');assert.equal(m.copies.length,7);for(const r of m.copies){let expected=source(r.source);assert.equal(sha(expected),r.sourceSha256,r.source+' immutable assertions');for(const c of r.changes){assert.equal(expected.split(c.before).length-1,c.count,r.target+' exact seam');expected=expected.split(c.before).join(c.after);}const actual=source(r.target);assert.equal(actual,r.header+expected,r.target+' all undeclared assertions retained');assert.equal(sha(actual),r.targetSha256);}return m.copies;}
export function assertD088InheritedCopyBytes(){return{prior:assertD087InheritedCopyBytes(),d087:assertD087GuardCopies().length,d087Native:assertD087NativeCheckCopies().length};}
export function assertD088CurrentGuardVersions(){return{prior:assertD088InheritedCopyBytes(),current:assertD088GuardCopies().length,nativeChecks:assertD088NativeCheckCopies().length,shapeCall:assertD088CoastalShapeCall()};}
export function d088GuardRoute(file){assertD088CurrentGuardVersions();return Object.hasOwn(D088_GUARD_ROUTES,file)?D088_GUARD_ROUTES[file]:file;}

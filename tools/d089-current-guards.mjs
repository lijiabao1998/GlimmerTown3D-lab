// Finite routes. Historical copy-byte checks stay active; their superseded
// twenty-two-argument actual-call check is not misrepresented as current.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{assertD088GuardCopies,assertD088InheritedCopyBytes}from'./d088-current-guards.mjs';
import{assertD088NativeCheckCopies}from'./d088-native-check-versions.mjs';
import{assertD089CoastalShapeCall}from'./d089-coastal-current-guard.mjs';
import{assertD089NativeCheckCopies}from'./d089-native-check-versions.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
export const D089_GUARD_MANIFEST_SHA='9414bff7a52792a42b313f90c76b907b01c3f0b1b408b68c722c1475932f4f3e';
export const D089_GUARD_ROUTES=Object.freeze({'./unit-d052.mjs':'./unit-d052-d089.mjs','./unit-d053.mjs':'./unit-d053-d089.mjs','./unit-d054-ui.mjs':'./unit-d054-ui-d089.mjs','./unit-d055-native.mjs':'./unit-d055-native-d089.mjs','./unit-d081-touch-lease.mjs':'./unit-d081-touch-lease-d089.mjs','./unit-d082-release-v2.mjs':'./unit-d082-release-d089.mjs'});
export function assertD089GuardCopies(bytes=read('proposals/d089/native-guard-versions.json'),source=read){assert.equal(sha(bytes),D089_GUARD_MANIFEST_SHA);const m=JSON.parse(bytes);assert.equal(m.schema,1);assert.equal(m.baseline,'c023a2da0e4999d43e3d4216e800c4c96d06a3c1');assert.equal(m.copies.length,7);for(const r of m.copies){let expected=source(r.source);assert.equal(sha(expected),r.sourceSha256,r.source+' immutable assertions');for(const c of r.changes){assert.equal(expected.split(c.before).length-1,c.count,r.target+' exact seam');expected=expected.split(c.before).join(c.after);}const actual=source(r.target);assert.equal(actual,r.header+expected,r.target+' all undeclared assertions retained');assert.equal(sha(actual),r.targetSha256);}return m.copies;}
export function assertD089InheritedCopyBytes(){return{prior:assertD088InheritedCopyBytes(),d088:assertD088GuardCopies().length,d088Native:assertD088NativeCheckCopies().length};}
export function assertD089CurrentGuardVersions(){return{prior:assertD089InheritedCopyBytes(),current:assertD089GuardCopies().length,nativeChecks:assertD089NativeCheckCopies().length,shapeCall:assertD089CoastalShapeCall()};}
export function d089GuardRoute(file){assertD089CurrentGuardVersions();return Object.hasOwn(D089_GUARD_ROUTES,file)?D089_GUARD_ROUTES[file]:file;}

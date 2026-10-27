// Finite routes. Historical copy-byte checks stay active; their superseded
// twenty-three-argument actual-call check is not misrepresented as current.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{assertD089GuardCopies,assertD089InheritedCopyBytes}from'./d089-current-guards.mjs';
import{assertD089NativeCheckCopies}from'./d089-native-check-versions.mjs';
import{assertD090CoastalShapeCall}from'./d090-coastal-current-guard.mjs';
import{assertD090NativeCheckCopies}from'./d090-native-check-versions.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
export const D090_GUARD_MANIFEST_SHA='5e5dba1c175c8507bb310f28e58d0816d6db41e10cebb4dbee68c63b4ae10fad';
export const D090_GUARD_ROUTES=Object.freeze({'./unit-d052.mjs':'./unit-d052-d090.mjs','./unit-d053.mjs':'./unit-d053-d090.mjs','./unit-d054-ui.mjs':'./unit-d054-ui-d090.mjs','./unit-d055-native.mjs':'./unit-d055-native-d090.mjs','./unit-d081-touch-lease.mjs':'./unit-d081-touch-lease-d090.mjs','./unit-d082-release-v2.mjs':'./unit-d082-release-d090.mjs'});
export function assertD090GuardCopies(bytes=read('proposals/d090/native-guard-versions.json'),source=read){assert.equal(sha(bytes),D090_GUARD_MANIFEST_SHA);const m=JSON.parse(bytes);assert.equal(m.schema,1);assert.equal(m.baseline,'5b41bac165ba2b29146e6835490357bebc3cd549');assert.equal(m.copies.length,7);for(const r of m.copies){let expected=source(r.source);assert.equal(sha(expected),r.sourceSha256,r.source+' immutable assertions');for(const c of r.changes){assert.equal(expected.split(c.before).length-1,c.count,r.target+' exact seam');expected=expected.split(c.before).join(c.after);}const actual=source(r.target);assert.equal(actual,r.header+expected,r.target+' all undeclared assertions retained');assert.equal(sha(actual),r.targetSha256);}return m.copies;}
export function assertD090InheritedCopyBytes(){return{prior:assertD089InheritedCopyBytes(),d089:assertD089GuardCopies().length,d089Native:assertD089NativeCheckCopies().length};}
export function assertD090CurrentGuardVersions(){return{prior:assertD090InheritedCopyBytes(),current:assertD090GuardCopies().length,nativeChecks:assertD090NativeCheckCopies().length,shapeCall:assertD090CoastalShapeCall()};}
export function d090GuardRoute(file){assertD090CurrentGuardVersions();return Object.hasOwn(D090_GUARD_ROUTES,file)?D090_GUARD_ROUTES[file]:file;}

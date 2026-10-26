// Direct finite D087 routing. Original D086 byte-copy assertions remain active,
// without calling their superseded actual-production twenty-argument validator.
import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';
import{assertD086CurrentGuardVersionsV4}from'./d086-current-guards-v4.mjs';
import{assertD086CoastalGuardCopies}from'./d086-coastal-current-guard.mjs';
import{assertD086V5GuardCopies}from'./d086-current-guards-v5.mjs';import{assertD086V6GuardCopies}from'./d086-current-guards-v6.mjs';
import{assertD087CoastalShapeCall}from'./d087-coastal-current-guard.mjs';
import{assertD087NativeCheckCopies}from'./d087-native-check-versions.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
export const D087_GUARD_MANIFEST_SHA='8a4729a937bfcfedd1a33cc81e3b2bb7ac7ea38193df1ee113bacf3d09136a1e';
export const D087_GUARD_ROUTES=Object.freeze({'./unit-d052.mjs':'./unit-d052-d087.mjs','./unit-d053.mjs':'./unit-d053-d087.mjs','./unit-d054-ui.mjs':'./unit-d054-ui-d087.mjs','./unit-d055-native.mjs':'./unit-d055-native-d087.mjs','./unit-d081-touch-lease.mjs':'./unit-d081-touch-lease-d087.mjs','./unit-d082-release-v2.mjs':'./unit-d082-release-d087.mjs'});
export function assertD087GuardCopies(bytes=read('proposals/d087/native-guard-versions.json'),source=read){assert.equal(sha(bytes),D087_GUARD_MANIFEST_SHA,'exact finite D087 copy manifest');const m=JSON.parse(bytes);assert.equal(m.schema,1);assert.equal(m.baseline,'b4275bda73e72a9fb48343376fccaab52bbc8e84');assert.equal(m.copies.length,7);for(const r of m.copies){let expected=source(r.source);assert.equal(sha(expected),r.sourceSha256,r.source+' immutable published assertions');for(const c of r.changes){assert.equal(expected.split(c.before).length-1,c.count,r.target+' exact finite seam count');expected=expected.split(c.before).join(c.after);}const actual=source(r.target);assert.equal(actual,r.header+expected,r.target+' all undeclared assertion bytes unchanged');assert.equal(sha(actual),r.targetSha256);}return m.copies;}
export function assertD087InheritedCopyBytes(){return{throughV4:assertD086CurrentGuardVersionsV4(),coastal:assertD086CoastalGuardCopies(read('fixtures/d086/coastal-current-guard.json')),v5:assertD086V5GuardCopies(read('fixtures/d086/current-guard-versions-v5.json')),v6:assertD086V6GuardCopies(read('fixtures/d086/current-guard-versions-v6.json'))};}
export function assertD087CurrentGuardVersions(){return{prior:assertD087InheritedCopyBytes(),current:assertD087GuardCopies().length,nativeChecks:assertD087NativeCheckCopies().length,shapeCall:assertD087CoastalShapeCall()};}
export function d087GuardRoute(file){assertD087CurrentGuardVersions();return Object.hasOwn(D087_GUARD_ROUTES,file)?D087_GUARD_ROUTES[file]:file;}

// Compose the unchanged v1 guard inventory with two exact source-lease import seams.
import fs from 'node:fs';import assert from 'node:assert/strict';import{createHash}from'node:crypto';
import{assertD086CurrentGuardVersions,d086GuardRoute as priorRoute}from'./d086-current-guards.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
export function assertD086CurrentGuardVersionsV2(){
 const old=assertD086CurrentGuardVersions();const bytes=fs.readFileSync(new URL('../fixtures/d086/current-guard-versions-v2.json',import.meta.url),'utf8');
 assert.equal(sha(bytes),'812b985a05edf1170f75fd8724c1d3683998a06feb6c89320029db5fa78bb212');const m=JSON.parse(bytes);assert.equal(m.schema,2);
 assert.deepEqual(m.copies.map(r=>[r.source,r.target]),[['tools/d086-source-v1.test.mjs','tools/d086-source-v2.test.mjs'],['tools/d085-source-d086.test.mjs','tools/d085-source-d086-v2.test.mjs']]);
 for(const r of m.copies){const before=fs.readFileSync(r.source,'utf8');assert.equal(sha(before),r.sourceSha256);assert.equal(r.before,"'./d086-source-v1.mjs'");assert.equal(r.after,"'./d086-source-v2.mjs'");assert.equal(before.split(r.before).length,2);const after=fs.readFileSync(r.target,'utf8');assert.equal(after,'// D086 geometry-v2 current contract. All prior assertion files remain immutable.\n'+before.replace(r.before,r.after));assert.equal(sha(after),r.targetSha256);}
 assert.deepEqual(m.dependencyCopies.map(r=>[r.from,r.to]),[['tools/unit-d052.mjs','tools/unit-d052-d086.mjs'],['tools/unit-d054-ui.mjs','tools/unit-d054-ui-d086.mjs'],['tools/unit-d081-touch-lease.mjs','tools/unit-d081-touch-lease-d086.mjs']]);
 for(const r of m.dependencyCopies){let s=fs.readFileSync(r.from,'utf8');assert.equal(sha(s),r.originalSha256);for(const c of r.changes){assert.ok(s.includes(c.before));s=s.split(c.before).join(c.after);}const actual=fs.readFileSync(r.to,'utf8');assert.equal(actual,'// D086 current-version contract. Original '+r.from+' remains unchanged and tested on77b8616.\n'+s);assert.equal(sha(actual),r.currentSha256);}
 return {prior:old.length,current:m.copies.length,dependencies:m.dependencyCopies.length};
}

const ROUTES=Object.freeze({'./unit-d052.mjs':'./unit-d052-d086.mjs','./unit-d054-ui.mjs':'./unit-d054-ui-d086.mjs','./unit-d081-touch-lease.mjs':'./unit-d081-touch-lease-d086.mjs'});
export function d086GuardRoute(file){assertD086CurrentGuardVersionsV2();return Object.hasOwn(ROUTES,file)?ROUTES[file]:priorRoute(file);}

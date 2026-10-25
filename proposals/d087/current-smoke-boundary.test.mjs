// D087's complete current native browser smoke is required at the existing root
// call site. This additive boundary does not execute a browser or replace any
// historical assertion with a historical-only result.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const BASE='b4275bda73e72a9fb48343376fccaab52bbc8e84';
const read=f=>fs.readFileSync(f,'utf8');
const old=f=>execFileSync('git',['show',BASE+':'+f],{encoding:'utf8',maxBuffer:8e6});
const BEFORE="import { d053Smoke } from './smoke-d053-d086.mjs';";
const AFTER="import { d053Smoke } from './smoke-d053-d087.mjs';";
const ORIGINALS=['tools/smoke-d053.mjs','tools/d053-capture.mjs','tools/smoke-d053-d086.mjs','tools/d053-capture-d086.mjs'];
function boundary(source=read){
 const baseline=old('tools/smoke.mjs');assert.equal(baseline.split(BEFORE).length,2,'one original route');
 assert.equal(source('tools/smoke.mjs'),baseline.replace(BEFORE,AFTER),'exact import-only current browser route; every other check and call unchanged');
 for(const f of ORIGINALS)assert.equal(source(f),old(f),'immutable original smoke/capture '+f);
 const ci=source('.github/workflows/ci.yml');assert.ok(ci.includes('run: node tools/smoke.mjs 2>&1 | tee smoke-run.txt; exit ${PIPESTATUS[0]}'),'full current browser stage remains fail closed');
 const current=source('.github/workflows/d087-native.yml');assert.ok(current.includes('node --test tools/d087-*.test.mjs proposals/d087/*.test.mjs'),'new bounded smoke/copy and negative tests remain automatically required');
 return {originalFiles:4,rootRoute:'./smoke-d053-d087.mjs',historicalOnly:false};
}
test('existing full smoke executes bounded D087 current copy; all old assertions retained',()=>assert.deepEqual(boundary(),{originalFiles:4,rootRoute:'./smoke-d053-d087.mjs',historicalOnly:false}));
for(const [label,mutate] of [
 ['old43 route',s=>s.replace(AFTER,BEFORE)],
 ['missing D053 route',s=>s.replace(AFTER,'')],
 ['unscoped D053 route',s=>s.replace(AFTER,AFTER.replace('d087','unknown'))],
 ['duplicate route',s=>s.replace(AFTER,AFTER+'\n'+AFTER)],
 ['removed smoke body',s=>s.slice(0,s.indexOf(AFTER))+AFTER],
 ['extra default behavior',s=>s+'\nprocess.exit(0);\n'],
 ['moved original import',s=>s.replace(AFTER,'')+'\n'+AFTER+'\n']
])test('root wiring mutation fails: '+label,()=>{const s=read('tools/smoke.mjs'),bad=mutate(s);assert.notEqual(bad,s);assert.throws(()=>boundary(f=>f==='tools/smoke.mjs'?bad:read(f)));});
for(const f of ORIGINALS)test('original assertion mutation fails: '+f,()=>assert.throws(()=>boundary(g=>read(g)+(g===f?'\n// mutation':''))));
for(const [f,needle] of [
 ['.github/workflows/ci.yml','exit ${PIPESTATUS[0]}'],
 ['.github/workflows/ci.yml','node tools/smoke.mjs'],
 ['.github/workflows/d087-native.yml','proposals/d087/*.test.mjs']
])test('current browser/test gate cannot disappear: '+needle,()=>assert.throws(()=>boundary(g=>g===f?read(g).replace(needle,'removed'):read(g))));

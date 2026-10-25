import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const base='b4275bda73e72a9fb48343376fccaab52bbc8e84',read=f=>fs.readFileSync(f,'utf8'),old=f=>execFileSync('git',['show',base+':'+f],{encoding:'utf8',maxBuffer:32e6});
for(const[f,a,b]of [
 ['tools/d083-scope.mjs',"'./d086-source-v6.mjs'","'./d087-source.mjs'"],
 ['tools/d082-release-source-v2.mjs',"'./d086-source-v6.mjs'","'./d087-source.mjs'"],
 ['tools/d082-release-mesh-v2.mjs',"'./d086-source-v6.mjs'","'./d087-source.mjs'"],
 ['tools/unit.mjs',"import {d086GuardRoute} from './d086-current-guards-v6.mjs';","import {d087GuardRoute as d086GuardRoute} from './d087-current-guards.mjs';"]
])test(f+' retains every prior assertion/call except one explicit version import',()=>{const s=old(f);assert.equal(s.split(a).length,2);assert.equal(read(f),s.replace(a,b));});
test('all original D086 source versions, assertion files, model and procedural authority remain byte-exact',()=>{const files=execFileSync('git',['ls-tree','-r','--name-only',base,'tools','proposals/d086','fixtures/d086','src/render/britishCivicMarketModels.mjs'],{encoding:'utf8'}).trim().split('\n').filter(f=>f.startsWith('proposals/d086/')||f.startsWith('fixtures/d086/')||/tools\/d086-/.test(f)||f==='src/render/britishCivicMarketModels.mjs');for(const f of files)assert.equal(read(f),old(f),'historical immutable '+f);});

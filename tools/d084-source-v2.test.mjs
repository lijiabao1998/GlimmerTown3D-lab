import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{execFileSync}from'node:child_process';
import{D084_CHANGED,D084_ADDED,d084PriorSource,d084PriorInventory}from'./d084-source-v2.mjs';
const read=f=>fs.readFileSync(f,'utf8');
test('D084 finite exact preimages match independent released Git, fail closed for every source mutation',()=>{
 for(const f of D084_CHANGED){const actual=read(f),expected=D084_ADDED.includes(f)?'':execFileSync('git',['show','e0508af:'+f],{maxBuffer:32*1024*1024}).toString();assert.equal(d084PriorSource(f,actual),expected);for(const bad of [undefined,null,'',actual+'\n',actual.slice(1),actual.replace(/./,'X')])assert.throws(()=>d084PriorSource(f,bad));}
 for(const f of D084_CHANGED)assert.throws(()=>d084PriorInventory(D084_CHANGED.filter(x=>x!==f),read));
 assert.equal(d084PriorSource('unrelated','untouched'),'untouched');
});
import{assertD083Inventory,D083_CURRENT_PATHS}from'./d083-scope.mjs';
test('D084 inventory composition rejects unknown and duplicate source paths without loosening D083',()=>{
 const files=[...D083_CURRENT_PATHS,...D084_ADDED];
 assert.equal(assertD083Inventory(d084PriorInventory(files,read)),236);
 for(const bad of [[...files,'src/unauthorized.ts'],[...files,'src/cityView.ts'],files.filter(f=>f!=='src/render/preview.ts')])assert.throws(()=>assertD083Inventory(d084PriorInventory(bad,read)));
});
import {releaseSourceManifest} from './d082-release-source-v2.mjs';
test('D084 outer mesh inventory validates every actual addition before unchanged historical exact list',()=>{
 const expected=[...D083_CURRENT_PATHS,...Object.keys(releaseSourceManifest().added)].sort();
 const actual=[...expected,...D084_ADDED].sort();
 const qualify=files=>assert.deepEqual(d084PriorInventory(files,read),expected);
 qualify(actual);
 for(const bad of [[...actual,'src/unauthorized.ts'],[...actual,D084_ADDED[0]],actual.filter(f=>f!==D084_ADDED[0]),actual.filter(f=>f!=='src/cityView.ts')])assert.throws(()=>qualify(bad));
 for(const f of D084_CHANGED)assert.throws(()=>d084PriorInventory(actual,g=>g===f?read(g)+'\n':read(g)));
});

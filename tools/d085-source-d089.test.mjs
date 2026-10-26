// D086 geometry-v2 current contract. All prior assertion files remain immutable.
// D086 current-version contract. Original tools/d085-source-v1.test.mjs remains unchanged and tested on77b8616.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import{execFileSync}from'node:child_process';
import{D085_CHANGED,d085PriorSource,d084PriorInventory,d084PriorSource}from'./d089-source.mjs';
import{assertD083Scope}from'./d083-scope.mjs';
const read=f=>fs.readFileSync(f,'utf8');
test('exact new source returns only independently fetched published preimages; no extra edit can pass',()=>{
 for(const f of D085_CHANGED){const actual=read(f),before=execFileSync('git',['show','1e7b43e:'+f],{maxBuffer:32*1024*1024}).toString();assert.equal(d085PriorSource(f,actual),before);assert.equal(d084PriorSource(f,actual),execFileSync('git',['show','e0508af:'+f],{maxBuffer:32*1024*1024}).toString());
 for(const bad of [undefined,null,'',actual+'\n',actual.slice(1),actual.replace('setFrontageEnabled','deletedControl')])assert.throws(()=>d085PriorSource(f,bad));}
});
test('current complete inventory qualified, unknown/missing/duplicate paths rejected by unchanged historical inventory',()=>{
 assert.equal(assertD083Scope(),236);
 const files=fs.readdirSync('src',{recursive:true,withFileTypes:true}).filter(x=>x.isFile()).map(x=>x.parentPath+'/'+x.name).sort();
 const prior=d084PriorInventory(files,read);assert.equal(prior.length,237);
 const qualify=xs=>assert.deepEqual(d084PriorInventory(xs,read),prior);
 for(const bad of [[...files,'src/unauthorized.ts'],[...files,files[0]],files.filter(f=>f!==D085_CHANGED[0])])assert.throws(()=>qualify(bad));
 for(const f of D085_CHANGED)assert.throws(()=>d084PriorInventory(files,g=>g===f?read(g)+'\n':read(g)));
});
test('historical D057-D081 unchanged source-mutation predicates still identify rejection',async()=>{
 for(const n of [57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,76,77,78,79,80,81]){
  const mod=await import(`./d0${n}-scope.mjs`),fn=mod[`assertD0${n}Scope`];
  for(const f of D085_CHANGED)assert.throws(()=>fn(g=>read(g)+(g===f?'\n// unauthorized mutation':'')),/exact allowed source/);
 }
});

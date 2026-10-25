// D086 geometry-v2 current contract. All prior assertion files remain immutable.
import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{execFileSync}from'node:child_process';import{D086_MODIFIED,D086_ADDED,D086_CURRENT_PATHS,d086PriorSource,d086PriorInventory,d084PriorInventory}from'./d086-source-v5.mjs';import{assertD083Scope}from'./d083-scope.mjs';
const read=f=>fs.readFileSync(f,'utf8');
test('D086 finite exact preimages equal independently fetched immediate main; every altered/missing source rejected',()=>{
 for(const f of [...D086_MODIFIED,...D086_ADDED]){const a=read(f),before=D086_ADDED.includes(f)?'':execFileSync('git',['show','77b8616382f6115711b2b8eb39735a769b859cde:'+f],{maxBuffer:32e6}).toString();assert.equal(d086PriorSource(f,a),before);for(const bad of [undefined,null,'',a+'\n',a.slice(1),a.replace(/./,'X')])assert.throws(()=>d086PriorSource(f,bad));}
});
test('current inventory missing/unknown/duplicate and stale source rejection; old236 exact contract retained',()=>{
 assert.equal(assertD083Scope(),236);const actual=fs.readdirSync('src',{recursive:true,withFileTypes:true}).filter(x=>x.isFile()).map(x=>x.parentPath+'/'+x.name).sort();assert.deepEqual(actual,D086_CURRENT_PATHS);assert.equal(d086PriorInventory(actual,read).length,238);assert.equal(d084PriorInventory(actual,read).length,237);
 for(const bad of [[...actual,'src/unauthorised.ts'],[...actual,actual[0]],...D086_ADDED.map(f=>actual.filter(a=>a!==f)),...D086_MODIFIED.map(f=>actual.filter(a=>a!==f))])assert.throws(()=>d086PriorInventory(bad,read));for(const f of [...D086_MODIFIED,...D086_ADDED])assert.throws(()=>d086PriorInventory(actual,g=>g===f?read(g)+'\n':read(g)));
});
test('every historical D057–D081 source-mutation predicate still rejects all D086 changes',async()=>{
 for(const n of [57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,76,77,78,79,80,81]){const mod=await import(`./d0${n}-scope.mjs`),fn=mod[`assertD0${n}Scope`];for(const f of D086_MODIFIED)assert.throws(()=>fn(g=>read(g)+(g===f?'\n// unauthorised':'')),/exact allowed source/);}
});

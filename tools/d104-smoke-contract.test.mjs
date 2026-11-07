// Lightweight scheduling/receipt controls only; these tests never launch Chrome or smoke.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {ROOT, SHARDS, UNITS, PLAN_SHA256, SMOKE_SHA256, PRELOAD, sha, validatePlan,
  validateSmokeSource, coreSource, executableCore, blankCheckSource, consumeSelection, selectReceipts} from './d104-smoke-contract.mjs';
import {verifyArtifacts} from './d104-smoke-verify.mjs';

const original = fs.readFileSync(path.join(ROOT,'tools/smoke.mjs'),'utf8');
const clone = value => structuredClone(value);
const identity = {sourceCommit:'a'.repeat(40),sourceTree:'b'.repeat(40),repository:'test/repo',runId:'1',attempt:2,event:'pull_request',
  htmlSha256:'c'.repeat(64),buildDigest:'d'.repeat(64),buildArtifactId:'123'};
const expected = {...identity,sourceHashes:{'fixture.mjs':'e'.repeat(64)}};
function receipt(shard,attempt=2) {
  return {schema:'d104-smoke-shard-v1',shard,status:'passed',complete:true,identity:{...identity,attempt},
    planSha256:PLAN_SHA256,smokeSha256:SMOKE_SHA256,sourceHashes:clone(expected.sourceHashes),
    expectedUnits:[...SHARDS[shard]],executedUnits:[...SHARDS[shard]],partialFlags:[],errors:[],
    units:SHARDS[shard].map(id=>({id,status:'passed',invocations:1,checks:1,failedChecks:0,exitCode:0,elapsedMs:1,
      postGuards:id==='d051Smoke'?['d051ImportImageGuard']:[],...(id==='core'?{coreSha256:sha(coreSource(original))}:{})})),
    artifacts:[{path:`scratch/d104-smoke/${shard}/sample.log`,bytes:1,sha256:'f'.repeat(64)}]};
}
const good = () => SHARDS.map((_,shard)=>receipt(shard));
test('fixed complete source and 37 exports + one core + one D058 form an exact eight-way partition',()=>{
  assert.equal(validateSmokeSource(original),original); assert.equal(validatePlan(),true); assert.equal(UNITS.length,39);
  assert.equal(SHARDS.flat().filter(id=>id==='core').length,1); assert.deepEqual(SHARDS[7],['d058Capture']);
  assert.deepEqual(UNITS.filter(unit=>unit.postGuard).map(unit=>[unit.id,unit.postGuard]),[['d051Smoke','d051ImportImageGuard']]);
});
for (const [name,mutate] of [
  ['missing unit',s=>s[0].pop()], ['duplicate unit',s=>s[0].push(s[0][0])],
  ['unknown unit',s=>s[0][0]='unknown'], ['reordered suite',s=>s[0].reverse()],
  ['separated PNG producer',s=>{s[0].push(s[6].shift());}],
  ['golden before producer',s=>{[s[6][0],s[6][2]]=[s[6][2],s[6][0]];}],
]) test('partition rejects '+name,()=>{const shards=clone(SHARDS);mutate(shards);assert.throws(()=>validatePlan(shards));});
for (const [name,before,after] of [
  ['assertion edit',"const HASH = '1750cc89'","const HASH = '00000000'"],
  ['d053 omitted','await d053Smoke(withBrowser, log);','void 0;'],
  ['post-image guard omitted','d051ImportImageGuard(log);','void 0;'],
  ['D058 omitted',"await import('./d058-capture.mjs')",'void 0'],
  ['legacy renderer bypass',"+'streetArt=legacy'","+''"],
]) test('source control rejects '+name,()=>{assert.ok(original.includes(before));assert.throws(()=>validateSmokeSource(original.replace(before,after)));});
test('core keeps its entire original browser block and all assertions; only ESM paths are reversible',()=>{
  const core=coreSource(original),result=executableCore(original);
  const start=original.indexOf('await withBrowser({ width: 960, height: 600 }'),end=original.indexOf('\n});\n\n// ===== D011：')+5;
  assert.ok(core.includes(original.slice(start,end))); assert.ok(!core.includes('await d054Smoke('));
  assert.ok(!core.includes('await d011Smoke(')); assert.ok(!core.includes("await import('./d058-capture.mjs')"));
  assert.ok(core.includes('if (fails.length)')); assert.ok(result.substitutions.length>20);
  assert.equal(result.canonicalSha256,sha(core));
  const restored=result.substitutions.toReversed().reduce((text,s)=>text.replace(s.after,()=>s.before),result.executable);
  assert.equal(restored,core); assert.ok(blankCheckSource(original).includes('x.drawImage(c,0,0,96,60)'));
});
test('generated core parses without executing any browser or source assertions',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d104-smoke-syntax-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'core.mjs');fs.writeFileSync(file,executableCore(original).executable);
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);
});
test('preload is inert by default and consumes selection exactly once before nested processes',()=>{
  const empty={NODE_OPTIONS:PRELOAD,OTHER:'kept'};assert.equal(consumeSelection(empty,undefined),null);assert.equal(empty.NODE_OPTIONS,PRELOAD);
  const env={D104_SMOKE_SHARD:'0',NODE_OPTIONS:PRELOAD,OTHER:'kept'};
  assert.equal(consumeSelection(env,path.join(ROOT,'tools/smoke.mjs')),0);assert.deepEqual(env,{OTHER:'kept'});
  assert.equal(consumeSelection(env,path.join(ROOT,'tools/smoke.mjs')),null);
});
test('real preload without selection leaves the requested main untouched',()=>{
  const env={...process.env};delete env.D104_SMOKE_SHARD;delete env.NODE_OPTIONS;
  const result=spawnSync(process.execPath,['--import','./tools/d104-smoke-entry.mjs','-e',"console.log('ordinary-main')"],
    {cwd:ROOT,env,encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'ordinary-main');
});
for (const [name,env,entry] of [
  ['unknown shard',{D104_SMOKE_SHARD:'8',NODE_OPTIONS:PRELOAD},'tools/smoke.mjs'],
  ['multiple shards',{D104_SMOKE_SHARD:'0,1',NODE_OPTIONS:PRELOAD},'tools/smoke.mjs'],
  ['wrong main',{D104_SMOKE_SHARD:'0',NODE_OPTIONS:PRELOAD},'tools/unit.mjs'],
  ['extra options',{D104_SMOKE_SHARD:'0',NODE_OPTIONS:PRELOAD+' --inspect'},'tools/smoke.mjs'],
  ['partial original suite',{D104_SMOKE_SHARD:'0',NODE_OPTIONS:PRELOAD,D048_SMOKE_ONLY:'save'},'tools/smoke.mjs'],
]) test('preload fails closed: '+name,()=>assert.throws(()=>consumeSelection(clone(env),entry,ROOT)));
test('aggregator accepts eight exact receipts, including prior-attempt success when no later receipt exists',()=>{
  const rows=good();rows[0]=receipt(0,1);assert.equal(selectReceipts(rows,expected).length,8);
  const old=receipt(1,1);old.status='failed';rows.push(old);assert.equal(selectReceipts(rows,expected)[1].identity.attempt,2);
});
for(const [name,mutate] of [
  ['missing shard',r=>r.pop()],['duplicate same attempt',r=>r.push(clone(r[0]))],
  ['unknown shard',r=>r[0].shard=8],['future attempt',r=>r[0].identity.attempt=3],
  ['wrong commit',r=>r[0].identity.sourceCommit='x'],['wrong tree',r=>r[0].identity.sourceTree='x'],
  ['wrong run',r=>r[0].identity.runId='x'],['wrong repository',r=>r[0].identity.repository='x'],
  ['wrong event',r=>r[0].identity.event='push'],
  ['wrong build bytes',r=>r[0].identity.htmlSha256='x'],['wrong build ID',r=>r[0].identity.buildArtifactId='x'],
  ['wrong build digest',r=>r[0].identity.buildDigest='x'],['wrong source',r=>r[0].sourceHashes={}],
  ['wrong plan',r=>r[0].planSha256='x'],['wrong smoke',r=>r[0].smokeSha256='x'],
  ['not complete',r=>r[0].complete=false],['failed shard',r=>r[0].status='failed'],
  ['missing invocation',r=>r[0].units.pop()],['duplicate invocation',r=>r[0].units.push(clone(r[0].units[0]))],
  ['unexecuted unit',r=>r[0].units[0].invocations=0],['hidden failed assertion',r=>r[0].units[0].failedChecks=1],
  ['empty checks',r=>r[0].units[0].checks=0],['exit error',r=>r[0].units[0].exitCode=1],
  ['throw ignored',r=>r[0].units[0].error='error'],['pending unit',r=>r[0].units[0].status='pending'],
  ['partial flags',r=>r[0].partialFlags=['D011_SMOKE_ONLY']],['lost execution list',r=>r[0].executedUnits=[]],
  ['PNG guard omitted',r=>r[6].units.find(u=>u.id==='d051Smoke').postGuards=[]],
  ['wrong core body',r=>r[0].units[0].coreSha256='x'],['escaped artifact',r=>r[0].artifacts[0].path='../escape'],
  ['Windows absolute artifact',r=>r[0].artifacts[0].path='C:/outside.log'],
  ['UNC artifact',r=>r[0].artifacts[0].path='\\\\server\\outside.log'],
  ['later failed retry',r=>{r[0]=receipt(0,1);const bad=receipt(0,2);bad.status='failed';r.push(bad);}],
])test('aggregate rejects '+name,()=>{const rows=good();mutate(rows);assert.throws(()=>selectReceipts(rows,expected));});
test('artifact verifier reads all eight independent roots and rejects changed bytes or symlinks',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d104-smoke-artifacts-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  for(let shard=0;shard<8;shard++){
    const row=receipt(shard),root=path.join(dir,'artifact-'+shard),folder=path.join(root,'scratch/d104-smoke',String(shard));
    fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'sample.log'),'x');
    row.artifacts[0].sha256=sha('x');fs.writeFileSync(path.join(folder,'receipt.json'),JSON.stringify(row));
  }
  assert.equal(verifyArtifacts(dir,expected).shards.length,8);
  const file=path.join(dir,'artifact-0/scratch/d104-smoke/0/sample.log');
  fs.writeFileSync(file,'y');assert.throws(()=>verifyArtifacts(dir,expected),/SHA256/);fs.writeFileSync(file,'x');
  const target=path.join(dir,'target');fs.mkdirSync(target);
  const link=path.join(dir,'artifact-0','link');
  fs.symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
  assert.throws(()=>verifyArtifacts(dir,expected),/symlink/);
});

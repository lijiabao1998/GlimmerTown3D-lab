// D074 release repair: one exact non-simulation source, independent of all art allowances.
// Historical source guards may reconstruct old bytes only after checking the actual
// reviewed repair. Runtime imports, Vite, smoke and behavior tests never use this reader.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {d081TouchLeaseHistoricalBytes} from './d081-touch-lease-scope.mjs';

export const D074_TOUCH_REPAIR_PATH = 'src/ui/panelPress.ts';
export const D074_TOUCH_REPAIR_BASELINE = 'beca506c224ad72f9a890ed20b5aa1fa7b2616f5';
export const D074_TOUCH_REPAIR_BEFORE_SHA = '108ed5b4b11f262728c0cddb4abe8a719f4b2ef6f673c1dd96a471c7cabc45c6';
// Frozen repair candidate: every historical read must match these exact bytes.
export const D074_TOUCH_REPAIR_AFTER_SHA = '2e3011d22cb999a9a6d5366b229861ea6e73438259a369f82e66718a3eb4a422';
const FIXTURE = 'fixtures/d074-touch-repair-scope.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const diskRead = file => fs.readFileSync(path.join(ROOT,file),'utf8');
const fixture = Object.freeze(JSON.parse(diskRead(FIXTURE)));
// The old D074 contract is checked on exact PR33 bytes, only after the new
// outer scope verifies actual candidate bytes. Raw negative-control readers
// below remain raw; neither runtime nor behavioral tests use this adapter.
const priorCandidateRead = file => d081TouchLeaseHistoricalBytes(file,diskRead);

function validateFixture(value) {
  const label = 'D074 touch repair fixture';
  assert.ok(value && typeof value === 'object' && !Array.isArray(value),label+' is an object');
  assert.deepEqual(Object.keys(value).sort(),['afterSha256','baseline','beforeBytes','beforeSha256','path','schema'],label+' exact fields');
  assert.equal(value.schema,1,label+' fixed schema');
  assert.equal(value.baseline,D074_TOUCH_REPAIR_BASELINE,label+' fixed failed-release baseline');
  assert.equal(value.path,D074_TOUCH_REPAIR_PATH,label+' exactly one approved source path');
  assert.equal(value.beforeSha256,D074_TOUCH_REPAIR_BEFORE_SHA,label+' immutable old SHA');
  assert.equal(typeof value.beforeBytes,'string',label+' exact old source bytes');
  assert.equal(sha(value.beforeBytes),D074_TOUCH_REPAIR_BEFORE_SHA,label+' old bytes match immutable SHA');
  assert.equal(typeof D074_TOUCH_REPAIR_AFTER_SHA,'string',label+' reviewed candidate SHA is frozen');
  assert.match(D074_TOUCH_REPAIR_AFTER_SHA,/^[0-9a-f]{64}$/,label+' reviewed candidate SHA is valid');
  assert.notEqual(D074_TOUCH_REPAIR_AFTER_SHA,D074_TOUCH_REPAIR_BEFORE_SHA,label+' old production source is not a repair');
  assert.equal(value.afterSha256,D074_TOUCH_REPAIR_AFTER_SHA,label+' exact reviewed candidate SHA');
  return value;
}

function historicalBytes(file,read,value) {
  // Keep the caller's injected reader, including its exceptions and mutations.
  const current = read(file);
  if(file !== D074_TOUCH_REPAIR_PATH)return current;
  validateFixture(value);
  assert.equal(typeof current,'string',file+' exact allowed source: required actual source bytes');
  assert.equal(sha(current),D074_TOUCH_REPAIR_AFTER_SHA,file+' exact allowed source: reviewed D074 touch repair');
  return value.beforeBytes;
}

export function d074TouchRepairHistoricalBytes(file,read=priorCandidateRead) {
  return historicalBytes(file,read,fixture);
}

// A predicate for the nine explicit historical Git-diff checks. This never adds
// the UI path to an art-added set, and a matching path alone is not permission.
export function isD074TouchRepairAllowed(file,read=priorCandidateRead) {
  if(file !== D074_TOUCH_REPAIR_PATH)return false;
  d074TouchRepairHistoricalBytes(file,read);
  return true;
}

export async function d074TouchRepairScopeGuards(log=()=>{}) {
  const report = {baseline:D074_TOUCH_REPAIR_BASELINE,path:D074_TOUCH_REPAIR_PATH,beforeSha256:D074_TOUCH_REPAIR_BEFORE_SHA,afterSha256:D074_TOUCH_REPAIR_AFTER_SHA,tests:[],passed:false};
  let failed=0;
  const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D074 touch repair scope '+name);}catch(error){failed++;const detail=error.stack??String(error);report.tests.push({name,passed:false,error:detail});log(false,'D074 touch repair scope '+name,detail);}};
  test('fixture captures exact baseline bytes and only a frozen reviewed repair',()=>{
    validateFixture(fixture);
    const original=execFileSync('git',['show',D074_TOUCH_REPAIR_BASELINE+':'+D074_TOUCH_REPAIR_PATH],{cwd:ROOT});
    assert.equal(sha(original),D074_TOUCH_REPAIR_BEFORE_SHA);
    assert.deepEqual(Buffer.from(fixture.beforeBytes,'utf8'),original);
    const manifest=JSON.parse(diskRead('fixtures/d074-art-scope.json'));
    assert.equal(manifest.before[D074_TOUCH_REPAIR_PATH],D074_TOUCH_REPAIR_BEFORE_SHA);
    assert.equal(manifest.after[D074_TOUCH_REPAIR_PATH],D074_TOUCH_REPAIR_BEFORE_SHA);
    assert.ok(!manifest.added.includes(D074_TOUCH_REPAIR_PATH));
    assert.ok(!manifest.modified.includes(D074_TOUCH_REPAIR_PATH));
  });
  test('exact PR33 D074 candidate bytes are checked after outer actual-source verification',()=>{
    const current=priorCandidateRead(D074_TOUCH_REPAIR_PATH),reads=[];
    assert.equal(sha(current),D074_TOUCH_REPAIR_AFTER_SHA);
    assert.notEqual(current,fixture.beforeBytes);
    const injected=file=>{reads.push(file);return current;};
    assert.equal(d074TouchRepairHistoricalBytes(D074_TOUCH_REPAIR_PATH,injected),fixture.beforeBytes);
    assert.deepEqual(reads,[D074_TOUCH_REPAIR_PATH]);
    assert.equal(isD074TouchRepairAllowed(D074_TOUCH_REPAIR_PATH,injected),true);
    assert.deepEqual(reads,[D074_TOUCH_REPAIR_PATH,D074_TOUCH_REPAIR_PATH]);
  });
  test('all other paths and injected mutations pass through raw without an allowance',()=>{
    const paths=['src/sim/day.ts','src/io/save.ts','src/cityView.ts','src/render/kindArt.ts','src/ui/growthGuide.ts','./src/ui/panelPress.ts','src/ui/../ui/panelPress.ts','src/ui/panelPress.ts/','src/ui/panelPress.ts.extra'];
    for(const file of paths){
      const raw=Buffer.from('raw injected mutation: '+file),reads=[];
      assert.equal(d074TouchRepairHistoricalBytes(file,name=>{reads.push(name);return raw;}),raw,file+' exact raw identity');
      assert.deepEqual(reads,[file]);
      assert.equal(isD074TouchRepairAllowed(file,()=>{assert.fail('unapproved path must not be read by allowance predicate');}),false,file+' no repair allowance');
    }
  });
  test('old production, one-byte changes, empty and missing source fail closed',()=>{
    const current=priorCandidateRead(D074_TOUCH_REPAIR_PATH);
    const variants=[fixture.beforeBytes,current+'\n',current.slice(0,-1),current.replace(/./,character=>character==='X'?'Y':'X'),''];
    for(const raw of variants){
      const injected=()=>raw;
      assert.throws(()=>d074TouchRepairHistoricalBytes(D074_TOUCH_REPAIR_PATH,injected),/exact allowed source/);
      assert.throws(()=>isD074TouchRepairAllowed(D074_TOUCH_REPAIR_PATH,injected),/exact allowed source/);
    }
    for(const missing of [undefined,null]){
      assert.throws(()=>d074TouchRepairHistoricalBytes(D074_TOUCH_REPAIR_PATH,()=>missing),/exact allowed source/);
      assert.throws(()=>isD074TouchRepairAllowed(D074_TOUCH_REPAIR_PATH,()=>missing),/exact allowed source/);
    }
    const missing=Object.assign(new Error('missing source'),{code:'ENOENT'}),readMissing=()=>{throw missing;};
    assert.throws(()=>d074TouchRepairHistoricalBytes(D074_TOUCH_REPAIR_PATH,readMissing),error=>error===missing);
    assert.throws(()=>isD074TouchRepairAllowed(D074_TOUCH_REPAIR_PATH,readMissing),error=>error===missing);
  });
  test('malformed or broadened fixtures cannot authorize or supply historical bytes',()=>{
    const mutations=[null,[],{},'fixture',{...fixture,schema:2},{...fixture,baseline:'0'.repeat(40)},{...fixture,path:'src/ui/growthGuide.ts'},{...fixture,path:[D074_TOUCH_REPAIR_PATH,'src/sim/day.ts']},{...fixture,beforeSha256:'0'.repeat(64)},{...fixture,beforeBytes:fixture.beforeBytes+'\n'},{...fixture,beforeBytes:null},{...fixture,afterSha256:null},{...fixture,afterSha256:D074_TOUCH_REPAIR_BEFORE_SHA},{...fixture,afterSha256:'0'.repeat(64)},{...fixture,added:['src/sim/day.ts']}];
    for(const key of Object.keys(fixture)){const missing={...fixture};delete missing[key];mutations.push(missing);}
    const current=priorCandidateRead(D074_TOUCH_REPAIR_PATH);
    for(const value of mutations)assert.throws(()=>historicalBytes(D074_TOUCH_REPAIR_PATH,()=>current,value),/D074 touch repair fixture/);
  });
  // Import only when running guards, avoiding a runtime adapter/scope import cycle.
  const outer=await import('./d074-scope.mjs'),earlier=await import('./d056-scope.mjs');
  test('historical guard chain preserves source inventories and injected mutation readers',()=>{
    assert.ok(outer.assertD074Scope()>0);
    assert.doesNotThrow(()=>earlier.assertD056Scope());
    assert.ok(!outer.D074_ADDED.has(D074_TOUCH_REPAIR_PATH));
    assert.ok(!earlier.D056_ADDED.has(D074_TOUCH_REPAIR_PATH));
    assert.equal(outer.d074HistoricalBytes(D074_TOUCH_REPAIR_PATH),fixture.beforeBytes);
    assert.equal(earlier.d056HistoricalBytes(D074_TOUCH_REPAIR_PATH),fixture.beforeBytes);
    for(const target of [D074_TOUCH_REPAIR_PATH,'src/sim/day.ts','src/io/save.ts','src/cityView.ts','src/render/kindArt.ts']){
      const mutated=file=>diskRead(file)+(file===target?'\n// unauthorized source mutation':'');
      assert.throws(()=>outer.assertD074Scope(mutated),/exact allowed source/);
      assert.throws(()=>outer.d074HistoricalBytes(target,mutated),/exact allowed source/);
      assert.throws(()=>earlier.assertD056Scope(mutated),/exact allowed source/);
      assert.throws(()=>earlier.d056HistoricalBytes(target,mutated),/exact allowed source/);
    }
    const old=file=>file===D074_TOUCH_REPAIR_PATH?fixture.beforeBytes:diskRead(file);
    assert.throws(()=>outer.assertD074Scope(old),/exact allowed source/);
    assert.throws(()=>earlier.assertD056Scope(old),/exact allowed source/);
    const missing=Object.assign(new Error('missing injected panel source'),{code:'ENOENT'});
    const absent=file=>{if(file===D074_TOUCH_REPAIR_PATH)throw missing;return diskRead(file);};
    assert.throws(()=>outer.assertD074Scope(absent),error=>error===missing);
    assert.throws(()=>earlier.assertD056Scope(absent),error=>error===missing);
  });
  report.passed=failed===0;
  return {failed,report};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  // Finish this module's evaluation before the lazy historical chain imports it.
  d074TouchRepairScopeGuards((ok,name,detail)=>console.log(ok?'PASS':'FAIL',name,detail??''))
    .then(({failed})=>{process.exitCode=failed?1:0;})
    .catch(error=>{console.error(error);process.exitCode=1;});
}

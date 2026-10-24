// Exact D081 touch-repair allowance, outside every immutable historical art scope.
// This reader is ONLY for source-scope/diff accounting. Runtime imports and touch
// behavior tests execute the real source, never the reconstructed PR33 snapshot.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {d082HistoricalBytes} from './d082-scope.mjs';

export const D081_TOUCH_LEASE_BASELINE='9e3452a438331feec4082f6821cfcb0b0e653c4b';
export const D081_TOUCH_LEASE_BEFORE=Object.freeze({
  'src/cityView.ts':'97f4920ebb467cfe3662dd3542ff8d9ff2fef33f440e12d917aae51ca234549f',
  'src/ui/panelPress.ts':'2e3011d22cb999a9a6d5366b229861ea6e73438259a369f82e66718a3eb4a422',
});
// Freeze these independently reviewed candidate hashes only after product edits finish.
export const D081_TOUCH_LEASE_AFTER=Object.freeze({
  'src/cityView.ts':'c88768b73180cbd33978daa262c205bdac9b14c6715fa1b973577ec4d6feca6d',
  'src/ui/panelPress.ts':'a481a138c3a47cd1820301db30678f63bf993b6e128399e17ef0b7263a7b088b',
});
const paths=Object.keys(D081_TOUCH_LEASE_BEFORE).sort();
const diskRead=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
// Source accounting only: remove the exact SHA-pinned D082 layer before testing the original touch contract.
const priorCandidateRead=file=>paths.includes(file)?d082HistoricalBytes(file,diskRead):diskRead(file);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const fixture=JSON.parse(diskRead('fixtures/d081-touch-lease-scope.json'));
function validate(value) {
  const label='D081 touch lease fixture';
  assert.ok(value&&typeof value==='object'&&!Array.isArray(value),label+' object');
  assert.deepEqual(Object.keys(value).sort(),['baseline','files','schema'],label+' exact fields');
  assert.equal(value.schema,1,label+' fixed schema');
  assert.equal(value.baseline,D081_TOUCH_LEASE_BASELINE,label+' fixed PR33 baseline');
  assert.ok(value.files&&typeof value.files==='object'&&!Array.isArray(value.files),label+' files object');
  assert.deepEqual(Object.keys(value.files).sort(),paths,label+' exactly two approved sources');
  for(const file of paths) {
    const entry=value.files[file];
    assert.ok(entry&&typeof entry==='object'&&!Array.isArray(entry),label+' source entry');
    assert.deepEqual(Object.keys(entry).sort(),['afterSha256','beforeBytes','beforeSha256'],label+' exact source fields');
    assert.equal(entry.beforeSha256,D081_TOUCH_LEASE_BEFORE[file],label+' immutable PR33 SHA');
    assert.equal(typeof entry.beforeBytes,'string',label+' exact historical text');
    assert.equal(sha(entry.beforeBytes),D081_TOUCH_LEASE_BEFORE[file],label+' historical text SHA');
    assert.equal(typeof D081_TOUCH_LEASE_AFTER[file],'string',label+' candidate freeze pending');
    assert.match(D081_TOUCH_LEASE_AFTER[file],/^[0-9a-f]{64}$/,label+' frozen reviewed candidate SHA');
    assert.notEqual(D081_TOUCH_LEASE_AFTER[file],D081_TOUCH_LEASE_BEFORE[file],label+' original is not a repair');
    assert.equal(entry.afterSha256,D081_TOUCH_LEASE_AFTER[file],label+' exact candidate SHA');
  }
}
function historical(file,read,value) {
  const current=read(file); // Never discard an injected reader or its exceptions.
  if(!paths.includes(file))return current;
  validate(value);
  assert.equal(typeof current,'string',file+' exact allowed source: actual text required');
  assert.equal(sha(current),D081_TOUCH_LEASE_AFTER[file],file+' exact allowed source: frozen D081 touch lease repair');
  return value.files[file].beforeBytes;
}
export function d081TouchLeaseHistoricalBytes(file,read=priorCandidateRead) { return historical(file,read,fixture); }
export function isD081TouchLeaseAllowed(file,read=priorCandidateRead) {
  if(!paths.includes(file))return false;
  d081TouchLeaseHistoricalBytes(file,read);return true;
}
export async function d081TouchLeaseScopeGuards(log=()=>{}) {
  let failed=0;
  const report={baseline:D081_TOUCH_LEASE_BASELINE,before:D081_TOUCH_LEASE_BEFORE,after:D081_TOUCH_LEASE_AFTER,qualification:'Exact source allowance and historical reconstruction only; not runtime behavior evidence.',tests:[],passed:false};
  const test=(name,fn)=>{try{fn();report.tests.push({name,passed:true});log(true,'D081 touch lease scope '+name);}catch(error){failed++;report.tests.push({name,passed:false,error:error.stack??String(error)});log(false,'D081 touch lease scope '+name,error.stack??String(error));}};
  test('frozen fixture equals exact PR33 Git bytes, not regenerated art expectations',()=>{
    validate(fixture);
    const art=JSON.parse(diskRead('fixtures/d081-art-scope.json'));
    for(const file of paths){
      const original=execFileSync('git',['show',D081_TOUCH_LEASE_BASELINE+':'+file],{cwd:ROOT});
      assert.equal(sha(original),D081_TOUCH_LEASE_BEFORE[file]);
      assert.deepEqual(Buffer.from(fixture.files[file].beforeBytes),original);
      assert.equal(art.after[file],D081_TOUCH_LEASE_BEFORE[file]);
    }
  });
  test('original historical fixtures and behavioral assertions remain byte-identical',()=>{
    const immutable={
      'fixtures/d074-touch-repair-scope.json':'395e8726de13315ed2140453e44f4e1dc30e150cd4d442e063ed8388001a5f2f',
      'fixtures/d081-art-scope.json':'62c026d80e893195da2f9a0bd9daee59a5ed0a1557d82635a906f6656bd2cc57',
      'fixtures/d081-source-before.json':'f65c12a63327d90ab865513ac628c71c60f0e2af15546d7cb82752b6c73bc16d',
      'tools/unit-d074-touch-repair.mjs':'a4bf7934eabbe75a3a2c60e8cad7b520aaadac7aaf8f086919346416bed38938',
      'tools/smoke-d052.mjs':'1775d0302219894d998df34efe36f3dbcd884d056fe5ab2b5aaa5fc5865654ac',
    };
    for(const [file,pin] of Object.entries(immutable))assert.equal(sha(diskRead(file)),pin,'immutable original fixture or behavior test '+file);
  });
  test('D051 boundary adds only unleased gate API compatibility with every assertion unchanged',()=>{
    const file='tools/unit-d051.mjs';
    const original=execFileSync('git',['show',D081_TOUCH_LEASE_BASELINE+':'+file],{cwd:ROOT,encoding:'utf8'});
    const before='const createPanelUpdateGate = () => ({ defer: () => false, cancel() {} }), tcGate = createPanelUpdateGate();';
    const after='const createPanelUpdateGate = () => ({ defer: () => false, cancel() {}, presentation: kids => kids, refreshGeometry() {} }), tcGate = createPanelUpdateGate();';
    assert.equal(original.split(before).length,2,'exact original boundary stub');
    assert.equal(diskRead(file),original.replace(before,after),'no D051 assertion, mutation or renderer substitution');
  });
  test('actual candidate checked once before exact restoration and diff allowance',()=>{
    for(const file of paths){
      const reads=[],read=name=>{reads.push(name);return priorCandidateRead(name);};
      assert.equal(d081TouchLeaseHistoricalBytes(file,read),fixture.files[file].beforeBytes);
      assert.deepEqual(reads,[file]);
      assert.equal(isD081TouchLeaseAllowed(file,read),true);assert.deepEqual(reads,[file,file]);
    }
  });
  test('unchanged, unknown, alias paths pass through without gaining permission',()=>{
    for(const file of ['src/sim/day.ts','src/io/save.ts','src/render/kindArt.ts','src/unauthorized.ts',...paths.flatMap(p=>['./'+p,p+'/',p+'.extra',p.replace('src/','src/../src/')])]){
      const raw=Buffer.from('injected mutation '+file),reads=[];
      assert.equal(d081TouchLeaseHistoricalBytes(file,name=>{reads.push(name);return raw;}),raw);
      assert.deepEqual(reads,[file]);assert.equal(isD081TouchLeaseAllowed(file,()=>assert.fail('unapproved predicate read')),false);
    }
  });
  test('old sources, one-byte mutations and missing sources fail closed',()=>{
    for(const file of paths){
      const current=priorCandidateRead(file);
      for(const raw of [fixture.files[file].beforeBytes,current+'\n',current.slice(0,-1),current.replace(/./,c=>c==='X'?'Y':'X'),'',null,undefined]){
        assert.throws(()=>d081TouchLeaseHistoricalBytes(file,()=>raw),/exact allowed source/);
        assert.throws(()=>isD081TouchLeaseAllowed(file,()=>raw),/exact allowed source/);
      }
      const error=Object.assign(new Error('missing exact source'),{code:'ENOENT'});
      for(const fn of [d081TouchLeaseHistoricalBytes,isD081TouchLeaseAllowed])assert.throws(()=>fn(file,()=>{throw error;}),e=>e===error);
    }
  });
  test('malformed broadened or repinned fixtures cannot authorize source',()=>{
    const variants=[null,[],{}, {...fixture,schema:2},{...fixture,baseline:'0'.repeat(40)},{...fixture,extra:true},{...fixture,files:{...fixture.files,'src/sim/day.ts':fixture.files[paths[0]]}}];
    for(const key of Object.keys(fixture)){const bad=structuredClone(fixture);delete bad[key];variants.push(bad);}
    for(const file of paths){
      for(const field of ['beforeBytes','beforeSha256','afterSha256'])for(const val of [null,'', '0'.repeat(64)]){const bad=structuredClone(fixture);bad.files[file][field]=val;variants.push(bad);}
      const bad=structuredClone(fixture);delete bad.files[file];variants.push(bad);
      for(const key of Object.keys(fixture.files[file])){const bad=structuredClone(fixture);delete bad.files[file][key];variants.push(bad);}
    }
    for(const value of variants)assert.throws(()=>historical(paths[0],priorCandidateRead,value),/D081 touch lease fixture/);
  });
  const outer=await import('./d081-scope.mjs'),older=await import('./d074-scope.mjs');
  test('outer and older scope chains preserve every injected negative control',()=>{
    assert.ok(outer.assertD081Scope()>0);assert.ok(older.assertD074Scope()>0);
    for(const target of [...paths,'src/sim/day.ts','src/io/save.ts','src/render/kindArt.ts']){
      const mutated=file=>diskRead(file)+(file===target?'\n// unauthorized mutation':'');
      for(const guard of [outer.assertD081Scope,older.assertD074Scope])assert.throws(()=>guard(mutated),/exact allowed source/);
      for(const reader of [outer.d081HistoricalBytes,older.d074HistoricalBytes])assert.throws(()=>reader(target,mutated),/exact allowed source/);
    }
    for(const target of paths){
      const old=file=>file===target?fixture.files[file].beforeBytes:diskRead(file);
      assert.throws(()=>outer.assertD081Scope(old),/exact allowed source/);
      const missing=new Error('missing injected '+target),absent=file=>{if(file===target)throw missing;return diskRead(file);};
      assert.throws(()=>outer.assertD081Scope(absent),error=>error===missing);
    }
  });
  report.passed=failed===0;return {failed,report};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  d081TouchLeaseScopeGuards((ok,name,detail)=>console.log(ok?'PASS':'FAIL',name,detail??'')).then(({failed})=>{process.exitCode=failed?1:0;}).catch(error=>{console.error(error);process.exitCode=1;});
}

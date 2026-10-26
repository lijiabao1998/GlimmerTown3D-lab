// Actual immutable test inventories plus finite domains; no historical checkout
// or browser launch is performed by this pure negative-control suite.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {assertInheritedDomains,domainPlan,DOMAIN_MANIFEST,INHERITED_BASELINE,PRIOR_BASELINE,sha} from './inherited-test-contract.mjs';
const read=f=>fs.readFileSync(f,'utf8'),bytes=read(DOMAIN_MANIFEST),m=JSON.parse(bytes);
test('actual cdd inventory is exactly all28 original D087 files; all37 D086 originals retain original domain and assertions',()=>{
 const actual=execFileSync('git',['ls-tree','-r','--name-only',INHERITED_BASELINE,'tools','proposals/d087'],{encoding:'utf8'}).trim().split('\n').filter(f=>/^tools\/d087-.*\.test\.mjs$|^proposals\/d087\/.*\.test\.mjs$/.test(f));
 assert.deepEqual(m.d087Originals.map(r=>r.file),actual);assert.equal(m.d086Originals.length,37);assertInheritedDomains();
 for(const r of [...m.d087Originals,...m.cddExtraHistorical])assert.equal(sha(execFileSync('git',['show',INHERITED_BASELINE+':'+r.file],{maxBuffer:32e6})),r.sha256);
});
test('each actual-current compatible file and each source-version replacement is scheduled, not blanket historical substitution',()=>{
 for(const suite of ['all','d086','d087']){
  const plan=domainPlan(m,suite),cur=plan.find(p=>p.name==='actual-current');assert.equal(cur.source,'candidate');assert.equal(cur.files.length,new Set(cur.files).size);
  for(const f of [...m.currentAdditions,...m.currentLedgerSnapshots])assert.ok(cur.files.includes(f));
  if(suite!=='d087'){assert.equal(plan.find(p=>p.name==='actual-immutable-b427').source,PRIOR_BASELINE);for(const r of m.d086Originals.filter(r=>r.domain==='actual-current'))assert.ok(cur.files.includes(r.current));}
  if(suite!=='d086'){assert.equal(plan.find(p=>p.name==='actual-immutable-cdd').source,INHERITED_BASELINE);for(const r of m.d087Originals)for(const f of r.currentCoverage)assert.ok(cur.files.includes(f));}
  for(const p of plan.filter(p=>p.source!=='candidate'))for(const f of p.files)assert.ok(!cur.files.includes(f),'no misleading dual-domain original '+f);
 }
});
for(const suite of ['', 'D087','d088','current','--skip','all,d087',null,undefined])test('unknown suite cannot become an empty passing domain '+String(suite),()=>{if(suite===undefined)assert.equal(domainPlan(m,suite).length,3);else assert.throws(()=>domainPlan(m,suite));});
for(const [label,mutate] of [
 ['drop D086',x=>x.d086Originals.pop()],['drop D087',x=>x.d087Originals.pop()],['duplicate D087',x=>x.d087Originals[1]=x.d087Originals[0]],
 ['compatible to historical',x=>x.d087Originals.find(r=>r.domain==='actual-current').domain='actual-immutable-cdd'],
 ['historical to current',x=>x.d087Originals.find(r=>r.domain==='actual-immutable-cdd').domain='actual-current'],
 ['omit current coverage',x=>x.d087Originals[0].currentCoverage=[]],['route wrong copy',x=>x.d087Originals[0].currentCoverage=['tools/d087-source.test.mjs']],
 ['alter baseline',x=>x.baseline=PRIOR_BASELINE],['omit old ledger',x=>x.currentLedgerSnapshots.pop()],['omit current assertion',x=>x.currentAdditions.pop()],
 ['omit old b427',x=>x.b427ExtraHistorical.pop()],['omit old cdd',x=>x.cddExtraHistorical.pop()],['relax finite copy',x=>x.currentCopies[0].changes.push(x.currentCopies[0].changes[0])],
 ['drop original command',x=>delete x.originalCommands.d087],['alter original hash',x=>x.d087Originals[0].sha256='0'.repeat(64)]
])test('manifest refuses '+label,()=>{const bad=structuredClone(m);mutate(bad);assert.throws(()=>assertInheritedDomains(JSON.stringify(bad)));});
for(const r of [...m.d086Originals,...m.d087Originals,...m.b427ExtraHistorical,...m.cddExtraHistorical])test('original assertion bytes cannot change '+r.file,()=>assert.throws(()=>assertInheritedDomains(bytes,f=>read(f)+(f===r.file?'\n':''))));
for(const r of m.currentCopies)for(const f of [r.source,r.target])test('finite current-copy source/target tampering rejected '+f,()=>assert.throws(()=>assertInheritedDomains(bytes,g=>read(g)+(g===f?'\n':''))));
test('each exact finite copy is independently reconstructed from actual cdd bytes',()=>{for(const r of m.currentCopies){let actual=execFileSync('git',['show',INHERITED_BASELINE+':'+r.source],{encoding:'utf8'});for(const c of r.changes){assert.equal(actual.split(c.before).length-1,c.count);actual=actual.split(c.before).join(c.after);}assert.equal(read(r.target),actual);}});

// Exercise the unchanged orchestration body with an in-memory filesystem and
// child-process boundary. These are failure controls, not historical execution
// evidence; no real worktree, extraction or subprocess is launched here.
import vm from 'node:vm';import path from 'node:path';
const runner=read('proposals/d088/inherited-test-runner.mjs').split('\n').filter(line=>!line.startsWith('import')).join('\n');
function mockRunner(options={}){
 const body=Buffer.from('immutable assertion\n'),row={file:'fixture.test.mjs',sha256:sha(body)},fixture={d086Originals:[row],b427ExtraHistorical:[],d087Originals:[row],cddExtraHistorical:[]},writes=new Map(),calls=[],directories=[];
 const plans=[{name:'actual-immutable-b427',source:PRIOR_BASELINE,files:[row.file]},{name:'actual-immutable-cdd',source:INHERITED_BASELINE,files:[row.file]},{name:'actual-current',source:'candidate',files:['current.test.mjs']}];
 const cwd='/candidate',resolve=(...args)=>path.resolve(cwd,...args),fakePath={...path,resolve},counts=new Map();
 const context={assert,sha,INHERITED_BASELINE,PRIOR_BASELINE,path:fakePath,console:{log(){}},Buffer,
  process:{argv:['node','runner',...(options.argv??[])],cwd:()=>cwd,execPath:'/node',env:{GITHUB_ACTIONS:'true'}},
  assertInheritedDomains:()=>fixture,domainPlan:()=>plans,assertInheritedWorkflowSet:()=>({workflows:[]}),
  fs:{existsSync:f=>f.includes('/scratch/')?!!options.overwrite:true,mkdirSync:f=>directories.push(f),symlinkSync:()=>assert.fail('no symlink expected in this fixture'),readFileSync:()=>options.tamper?Buffer.from('altered assertion'):body,writeFileSync:(f,b)=>writes.set(f,b)},
  execFileSync:(cmd,args,{cwd:dir})=>{assert.equal(cmd,'git');if(args[0]==='rev-parse')return (dir===cwd?'candidate-head':options.wrongHead?'wrong-head':dir.endsWith('-cdd')?INHERITED_BASELINE:PRIOR_BASELINE)+'\n';if(args[0]==='status'){const n=(counts.get(dir)??0)+1;counts.set(dir,n);return options.dirtyCandidate&&dir===cwd||options.dirtyHistorical&&dir!==cwd||options.dirtyAfter&&dir!==cwd&&n>1?' M source.mjs\n':'';}if(args[0]==='show')return body.toString();assert.fail('unexpected git action '+args);},
  spawnSync:(exe,args,{cwd:dir})=>{assert.equal(exe,'/node');calls.push({args,dir});const index=calls.length-1;return options.failIndex===index?options.result:{status:0,signal:null,stdout:'PASS\n',stderr:''};}
 };
 let error;try{vm.runInNewContext(runner,context);}catch(e){error=e;}const report=[...writes].find(([f])=>f.endsWith('/report.json'));return{error,calls,writes,directories,report:report?JSON.parse(report[1]):null};
}
test('runner actually invokes all three required domains with their exact separate cwd and current arguments',()=>{const r=mockRunner();assert.ifError(r.error);assert.equal(r.calls.length,3);assert.deepEqual(r.calls.map(x=>x.dir),['/GlimmerTown3D-lab-d088-inherited-b427','/GlimmerTown3D-lab-d088-inherited-cdd','/candidate']);assert.deepEqual(Array.from(r.calls[2].args),['--test','current.test.mjs']);assert.equal(r.report.passed,true);assert.equal(r.report.checks.length,3);assert.equal(r.report.workingTreeDirty,false);});
for(const index of[0,1,2])for(const [name,result]of[['exit one',{status:1,signal:null,stdout:'original failure\n',stderr:'failure detail\n'}],['signal',{status:null,signal:'SIGTERM'}],['spawn error',{status:null,error:new Error('spawn failure')}]])test('runner never turns '+name+' into green for domain '+index,()=>{const r=mockRunner({failIndex:index,result});assert.ok(r.error);assert.equal(r.calls.length,3,'other domain evidence is still gathered');assert.equal(r.report.passed,false);assert.equal(r.report.checks[index].status,result.status);assert.ok(r.writes.size>=4);});
for(const key of ['overwrite','wrongHead','dirtyCandidate','dirtyHistorical','dirtyAfter','tamper'])test('runner rejects '+key+' without changing immutable historical source',()=>{const r=mockRunner({[key]:true});assert.ok(r.error);assert.ok(!r.report?.passed);assert.equal([...r.writes.keys()].some(f=>!f.includes('/scratch/')),false);});
for(const argv of [['--suite=d088'],['--suite=d087','--suite=d086'],['--skip-history']])test('runner rejects unknown/extra CLI '+argv.join(' '),()=>{const r=mockRunner({argv});assert.ok(r.error);assert.equal(r.calls.length,0);assert.equal(r.writes.size,0);});

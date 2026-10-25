// Execute original obsolete-version tests on the actual immutable release tree,
// never by changing process readers. All compatible/current tests use candidate.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync,spawnSync} from 'node:child_process';
import {assertInheritedDomains,INHERITED_BASELINE,sha} from './inherited-test-contract.mjs';
import {assertInheritedWorkflowSet} from '../../tools/d087-validation.mjs';
const m=assertInheritedDomains(),root=process.cwd(),baseline=path.resolve('../GlimmerTown3D-lab-d087-inherited-baseline'),out=path.resolve('scratch/d087-inherited-tests');assert.ok(!fs.existsSync(out),'preserve every original run');fs.mkdirSync(out,{recursive:true});
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:32e6});
if(!fs.existsSync(baseline))git(root,'worktree','add','--detach',baseline,INHERITED_BASELINE);
assert.equal(git(baseline,'rev-parse','HEAD').trim(),INHERITED_BASELINE);assert.equal(git(baseline,'status','--porcelain','--untracked-files=no').trim(),'','historical tracked tree must be clean');
if(!fs.existsSync(path.join(baseline,'node_modules')))fs.symlinkSync(path.resolve('node_modules'),path.join(baseline,'node_modules'),'dir');
const report={qualification:'Actual immutable b427 version assertions plus actual-current compatible and new strict guards; neither domain substitutes for current native old157/new11 browser gates.',baseline:INHERITED_BASELINE,candidate:git(root,'rev-parse','HEAD').trim(),checks:[],passed:false};
const historical=[...m.originalTests.filter(r=>r.domain==='actual-immutable-b427'),...m.extraHistorical];
for(const r of [...m.originalTests,...m.extraHistorical]){const actual=fs.readFileSync(path.join(baseline,r.file));assert.equal(sha(actual),r.sha256);assert.equal(actual.toString(),git(baseline,'show',INHERITED_BASELINE+':'+r.file));}
for(const r of assertInheritedWorkflowSet().workflows){assert.equal(fs.readFileSync(path.join(baseline,r.file),'utf8'),r.before,'exact actual b427 workflow preimage');assert.equal(r.before,git(baseline,'show',INHERITED_BASELINE+':'+r.file));}
const commands=[['actual-immutable-b427',baseline,['--test',...historical.map(r=>r.file)]],['actual-current',root,['--test',...m.originalTests.filter(r=>r.domain==='actual-current').map(r=>r.current),...m.currentAdditions]]];
for(const [name,cwd,args]of commands){const r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:64e6});const log=(r.stdout??'')+(r.stderr??'');fs.writeFileSync(path.join(out,name+'.log'),log);report.checks.push({name,source:cwd===baseline?INHERITED_BASELINE:report.candidate,args,status:r.status,signal:r.signal,error:r.error?.message??null,logSha256:sha(log)});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(name,r.status,log);}
assert.equal(git(baseline,'status','--porcelain','--untracked-files=no').trim(),'','historical tracked source remains unchanged');assertInheritedDomains();report.passed=report.checks.every(r=>r.status===0&&!r.signal&&!r.error);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));assert.ok(report.passed,'both actual source domains must pass');

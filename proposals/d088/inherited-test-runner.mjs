// Execute explicit immutable source-version trees and actual current compatible
// assertions without intercepting reads or changing any original test source.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import{execFileSync,spawnSync}from'node:child_process';
import{assertInheritedDomains,domainPlan,sha,INHERITED_BASELINE,PRIOR_BASELINE}from'./inherited-test-contract.mjs';
import{assertInheritedWorkflowSet}from'../../tools/d088-validation.mjs';
const options=process.argv.slice(2);assert.ok(options.every(x=>/^--suite=(all|d086|d087)$/.test(x)));assert.ok(options.length<=1);const suite=options[0]?.slice(8)??'all',m=assertInheritedDomains(),root=process.cwd(),out=path.resolve('scratch/d088-inherited-tests-'+suite);assert.ok(!fs.existsSync(out),'preserve every attempt');fs.mkdirSync(out,{recursive:true});
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',maxBuffer:32e6});
const candidate=git(root,'rev-parse','HEAD').trim(),dirty=git(root,'status','--porcelain','--untracked-files=no').trim();if(process.env.GITHUB_ACTIONS==='true')assert.equal(dirty,'','official current candidate tracked sources must be clean');
const report={qualification:'Actual current compatible D086/D087 native assertions plus exact immutable b427/cdd obsolete-version contracts. Not browser/art/release acceptance.',suite,candidate,workingTreeDirty:!!dirty,checks:[],passed:false};
for(const item of domainPlan(m,suite)){
 let cwd=root;
 if(item.source!=='candidate'){
  cwd=path.resolve('../GlimmerTown3D-lab-d088-inherited-'+(item.source===INHERITED_BASELINE?'cdd':'b427'));
  if(!fs.existsSync(cwd))git(root,'worktree','add','--detach',cwd,item.source);
  assert.equal(git(cwd,'rev-parse','HEAD').trim(),item.source);assert.equal(git(cwd,'status','--porcelain','--untracked-files=no').trim(),'','historical tracked tree clean');
  if(!fs.existsSync(path.join(cwd,'node_modules')))fs.symlinkSync(path.resolve('node_modules'),path.join(cwd,'node_modules'),'dir');
  const records=item.source===PRIOR_BASELINE?[...m.d086Originals,...m.b427ExtraHistorical]:[...m.d087Originals,...m.cddExtraHistorical];
  for(const r of records){const bytes=fs.readFileSync(path.join(cwd,r.file));assert.equal(sha(bytes),r.sha256);assert.equal(bytes.toString(),git(cwd,'show',item.source+':'+r.file));}
  if(item.source===INHERITED_BASELINE)for(const row of assertInheritedWorkflowSet().workflows){assert.equal(fs.readFileSync(path.join(cwd,row.file),'utf8'),row.before);assert.equal(row.before,git(cwd,'show',item.source+':'+row.file));}
 }
 const args=['--test',...item.files],result=spawnSync(process.execPath,args,{cwd,encoding:'utf8',maxBuffer:64e6}),log=(result.stdout??'')+(result.stderr??'');fs.writeFileSync(path.join(out,item.name+'.log'),log);report.checks.push({name:item.name,source:item.source==='candidate'?candidate:item.source,args,status:result.status,signal:result.signal,error:result.error?.message??null,logSha256:sha(log)});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(item.name,result.status,log);
 if(cwd!==root)assert.equal(git(cwd,'status','--porcelain','--untracked-files=no').trim(),'','historical tracked source remained unchanged');
}
assertInheritedDomains();assertInheritedWorkflowSet();report.passed=report.checks.every(r=>r.status===0&&!r.signal&&!r.error);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));assert.ok(report.passed,'every required actual-source domain must pass');

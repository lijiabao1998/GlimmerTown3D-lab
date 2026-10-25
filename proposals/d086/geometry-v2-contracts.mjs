// Unchanged V2 assertions on the actual detached207404e tree. Never projected
// current geometry, never a substitute for final-head old147/new10/browser gates.
import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{spawnSync,execFileSync}from'node:child_process';import{createHash}from'node:crypto';
const BASELINE='207404e1479593cd748b6e71bbe9c2d7e3c1042a',root=path.resolve(process.argv.find(a=>a.startsWith('--baseline='))?.slice(11)??'../GlimmerTown3D-lab-d086-geometry-v2'),label=process.argv.find(a=>a.startsWith('--label='))?.slice(8)??'attempt-1',sha=b=>createHash('sha256').update(b).digest('hex');assert.match(label,/^[a-zA-Z0-9_-]+$/);const out=path.resolve('scratch/d086-geometry-v2-contracts/'+label);assert.ok(!fs.existsSync(out),'preserve historical first-red receipt');fs.mkdirSync(out,{recursive:true});
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32e6}),clean=()=>{assert.equal(git('rev-parse','HEAD').trim(),BASELINE);assert.equal(git('status','--porcelain','--untracked-files=no').trim(),'','detached historical tracked tree unchanged');assert.equal(sha(fs.readFileSync(path.join(root,'src/render/britishCivicMarketModels.mjs'))),'d74fd0c2bac005e39ded486067f83f7b922a64dd7ab20f3e82882709ea76a38e');};
const commands=[
 ['original-source-v2',['--test','tools/d086-source-v2.test.mjs','tools/d086-source-v2-lease.test.mjs','tools/d085-source-d086-v2.test.mjs']],
 ['original-facade-v2',['--test','proposals/d086/facade-imprint-clean-workspace.test.mjs','proposals/d086/facade-imprint-check.test.mjs']],
 ['original-facade-v2-receipt',['proposals/d086/facade-imprint-check.mjs','--label=historical-v2-'+label]],
 ['original-structural-v2',['--test','proposals/d086/structural-plan-v3.test.mjs']],
 ['original-structural-v2-receipt',['proposals/d086/structural-plan-v3-check.mjs','--label=historical-v2-'+label]],
 ['original-release-validation-v2',['--test','tools/d086-validation.test.mjs']],
 ['original-browser-geometry-v2',['--test','proposals/d086/browser-geometry-compare.test.mjs']]
];
const pinned=[...new Set([...commands.flatMap(([,args])=>args.filter(a=>/\.mjs$/.test(a))),'fixtures/d086/source-v1.json','fixtures/d086/source-v2.json','fixtures/d086/current-guard-versions.json','fixtures/d086/current-guard-versions-v2.json','tools/d086-source-v1.mjs','tools/d086-source-v2.mjs','tools/d086-current-guards.mjs','tools/d086-current-guards-v2.mjs','proposals/d086/structural-plan-v3.mjs'])];
const report={baseline:BASELINE,qualification:'Actual unchanged207404e V2 source/facade/structural assertions. Not current-source or Chrome acceptance.',passed:false,assertionPins:{},checks:[]};
try{clean();for(const f of pinned){const bytes=fs.readFileSync(path.join(root,f));assert.equal(bytes.toString(),git('show',BASELINE+':'+f),f+' actual historical assertion bytes');report.assertionPins[f]=sha(bytes);}
 for(const[name,args]of commands){const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',maxBuffer:32e6});fs.writeFileSync(path.join(out,name+'.log'),(r.stdout??'')+(r.stderr??''));report.checks.push({name,args,status:r.status,signal:r.signal,error:r.error?.message??null});fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 clean();for(const[f,pin]of Object.entries(report.assertionPins))assert.equal(sha(fs.readFileSync(path.join(root,f))),pin);assert.ok(report.checks.every(r=>r.status===0&&!r.signal&&!r.error),'all original historical categories must pass');report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,baseline:BASELINE,passed:report.passed,checks:report.checks,failure:report.failure}));}

import fs from 'node:fs';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
const m=JSON.parse(fs.readFileSync('proposals/d084/source-contract.json'));const sha=x=>createHash('sha256').update(x).digest('hex');
assert.deepEqual(Object.keys(m.files),['src/cityView.ts','src/render/preview.ts','src/render/streetFrontage.ts']);
for(const[f,r]of Object.entries(m.files)){assert.equal(sha(fs.readFileSync(f)),r.afterSha256);if(r.beforeSha256)assert.equal(sha(execFileSync('git',['show',m.baseline+':'+f],{maxBuffer:32*1024*1024})),r.beforeSha256);assert.notEqual(sha(fs.readFileSync(f)+'mutant'),r.afterSha256);}
const tracked=execFileSync('git',['ls-tree','-r','--name-only',m.baseline,'src']).toString().trim().split('\n');for(const f of tracked)if(!m.files[f])assert.equal(sha(fs.readFileSync(f)),sha(execFileSync('git',['show',m.baseline+':'+f],{maxBuffer:32*1024*1024})),f+' unchanged historical source');
console.log('D084 exact three-file allowance and all other original sources preserved; old D083 guard remains mandatory separately.');

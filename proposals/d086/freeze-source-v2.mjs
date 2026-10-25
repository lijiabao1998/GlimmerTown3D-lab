// Explicit authoring only. Preserve first-candidate v1 fixture and every old guard.
import fs from 'node:fs';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
const baseline='4b0bbcdafaa3b3df615633c7eb2fa236242f07fc',file='src/render/britishCivicMarketModels.mjs',sha=x=>createHash('sha256').update(x).digest('hex');
const changed=execFileSync('git',['diff','--name-only',baseline,'--','src'],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(changed,[file],'only explicitly scoped geometry file differs from first native candidate');
const before=execFileSync('git',['show',baseline+':'+file],{maxBuffer:32e6,encoding:'utf8'});assert.equal(sha(before),'bd588212b2c0cc61f91bc3dc234e3448869ffadddef9fd1d58fb64199b1925ab');
const m={schema:2,baseline,qualification:'Finite unaccepted-candidate geometry repair; original147/main/source-v1 contracts remain unchanged.',changes:[{file,before,beforeSha256:sha(before),afterSha256:sha(fs.readFileSync(file))}]};
const bytes=JSON.stringify(m,null,2)+'\n';fs.writeFileSync('fixtures/d086/source-v2.json',bytes);console.log(sha(bytes));

import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('current imprint proof reads pinned natural repo from fresh cwd and preserves first receipt bytes',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d086-imprint-clean-'));try{
 // No fake repository, copied model, source monkeypatch or preview adapter. The
 // absolute script resolves the natural read-only source and pinned git tree.
 assert.ok(!fs.existsSync(path.join(dir,'.git')));assert.ok(!fs.existsSync(path.join(dir,'src')));
 const run=()=>spawnSync(process.execPath,[path.join(root,'proposals/d086/facade-imprint-check.mjs')],{cwd:dir,encoding:'utf8'}),first=run();assert.equal(first.status,0,first.stderr+'\n'+first.stdout);
 const receipt=path.join(dir,'scratch/d086-facade-imprint/facade-check-current.json'),bytes=fs.readFileSync(receipt),r=JSON.parse(bytes);assert.equal(r.passed,true);assert.equal(r.models.length,10);assert.equal(r.samples,520);assert.equal(r.originalNegatives,27);assert.equal(r.additionalNegatives,54);assert.equal(r.negativeControls,81);assert.equal(r.models.reduce((s,m)=>s+m.intents,0),413);assert.equal(r.sourceSha256,createHash('sha256').update(fs.readFileSync(path.join(root,'src/render/britishCivicMarketModels.mjs'))).digest('hex'));
 const second=run();assert.notEqual(second.status,0);assert.match(second.stderr,/preserve first-red receipts/);assert.deepEqual(fs.readFileSync(receipt),bytes,'failed repeat preserves every byte of first receipt');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}});

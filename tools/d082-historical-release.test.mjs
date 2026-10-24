import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {HISTORICAL_FRAME_RECEIPT,assertHistoricalBlob,historicalVerifierControls} from './d082-historical-release.mjs';
const execute=(cwd,result)=>spawnSync(process.execPath,['--input-type=module','-e',`import fs from 'node:fs';const r=${JSON.stringify(result)};${HISTORICAL_FRAME_RECEIPT}`],{cwd,encoding:'utf8'});
test('actual frame receipt snippet works without integration-created scratch and preserves unrelated files',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d082-historical-frame-receipt-'));
 try{fs.writeFileSync(path.join(dir,'immutable-source.txt'),'unchanged\n');assert.equal(fs.existsSync(path.join(dir,'scratch')),false);const result={failed:0,runtime:{passed:true},surface:{pass:true}};const r=execute(dir,result);assert.equal(r.status,0,r.stderr);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir,'scratch/historical-frame-result.json'),'utf8')),result);assert.equal(fs.readFileSync(path.join(dir,'immutable-source.txt'),'utf8'),'unchanged\n');}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('frame receipt never overwrites existing evidence',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d082-historical-frame-existing-'));
 try{fs.mkdirSync(path.join(dir,'scratch'));const receipt=path.join(dir,'scratch/historical-frame-result.json'),before='original failed evidence\n';fs.writeFileSync(receipt,before);const r=execute(dir,{failed:0});assert.notEqual(r.status,0);assert.match(r.stderr,/EEXIST/);assert.equal(fs.readFileSync(receipt,'utf8'),before);}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('immutable historical geometry and architecture test sources retain original exact hashes',()=>{
 const pins={'tools/d082/geometry-test.mjs':'6044b5bb8204c7e9b008d05687e15bd4fd59bbc747a7bbdc7d22f9791b480dcd','tools/unit-d082.mjs':'2ae3eea1bb3ada5ec4349545299357365d6408a05f171e0fc8cc13e79ac6d260','tools/unit-d082-architecture-contract.mjs':'45377104d5a61d55be21d5f1770e34ce9836499ab5ce1affd39f22b622334498','tools/test-d082-historical-isolation.mjs':'8b9f6db905b87355d4cb3976fd1351c10783613ef19e23f76f26cd418e49b4b0'};
 for(const[file,pin]of Object.entries(pins))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),pin,file);
 assert.deepEqual(historicalVerifierControls(),{positive:1,negative:3});const b=Buffer.from('frozen'),oid=createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');assertHistoricalBlob(b,oid,'exact');assert.throws(()=>assertHistoricalBlob(Buffer.from('changed'),oid,'mutated'));
});
test('actual frame runner uses the tested receipt and propagates original failure count',()=>{
 const source=fs.readFileSync(new URL('./d082-historical-release.mjs',import.meta.url),'utf8');assert.ok(source.includes('${HISTORICAL_FRAME_RECEIPT}process.exitCode=r.failed?1:0;'));assert.ok(source.includes("import {d082FrameGuards} from './tools/unit-d082-frame.mjs'"));assert.ok(source.includes("phase==='frame'?id==='frame':id!=='frame'"));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
test('facade proof runs in a fresh workspace and refuses to overwrite its receipt',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'d086-facade-clean-'));
 try{
  fs.symlinkSync(path.join(root,'src'),path.join(dir,'src'),'dir');
  const run=()=>spawnSync(process.execPath,[path.join(root,'proposals/d086/facade-backing-check.mjs')],{cwd:dir,encoding:'utf8'});
  const first=run();assert.equal(first.status,0,first.stderr);
  const receipt=path.join(dir,'scratch/d086-native-variant/facade-backing-current.json'),bytes=fs.readFileSync(receipt),r=JSON.parse(bytes);
  assert.equal(r.passed,true);assert.equal(r.models.length,10);assert.ok(r.samples>=520);assert.equal(r.negativeControls.length,27);
  const second=run();assert.notEqual(second.status,0);assert.match(second.stderr,/preserve original review receipts/);
  assert.deepEqual(fs.readFileSync(receipt),bytes,'failed repeat preserves every original report byte');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

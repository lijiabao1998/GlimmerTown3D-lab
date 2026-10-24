import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {releaseSourceManifest,releaseHistoricalSource} from './d082-release-source-v2.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('finite new geometry revision maps only exact current bytes to immutable approved source',()=>{
 const m=releaseSourceManifest();
 for(const [file,r]of Object.entries(m.modified)){
  assert.equal(releaseHistoricalSource(file),r.before);
  assert.throws(()=>releaseHistoricalSource(file,()=>read(file)+'\n'));
  assert.throws(()=>releaseHistoricalSource(file,()=>r.before));
  assert.throws(()=>releaseHistoricalSource(file,()=>undefined));
  const failure=new Error('missing');assert.throws(()=>releaseHistoricalSource(file,()=>{throw failure}),e=>e===failure);
 }
 for(const file of Object.keys(m.added)){
  assert.equal(releaseHistoricalSource(file),'');
  assert.throws(()=>releaseHistoricalSource(file,()=>read(file)+'\n'));
  assert.throws(()=>releaseHistoricalSource(file,()=>''));
 }
 const unchanged='src/content/britishCoastalRecreation.ts';assert.equal(releaseHistoricalSource(unchanged),read(unchanged));
});

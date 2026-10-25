import test from 'node:test';import assert from 'node:assert/strict';
import {assertCurrentLedger,loadCurrentLedger} from './ledger-current.mjs';
const values=loadCurrentLedger();
test('verified D086 main/Pages/public advances only157, D087 remains eleven candidates',()=>assert.deepEqual(assertCurrentLedger(...values),{published:157,candidate:11,candidateTotal:168,remainingPublished:43,target:200}));
for(const[name,mutate]of [
 ['premature168',x=>x[0].publishedCount=168],['candidate accepted without publication',x=>x[0].candidate.state='accepted-and-published'],['aftercount from numericgreen',x=>x[0].candidate.verifiedPublishedCountAfter=168],['duplicate oldslot',x=>x[0].candidate.slots[0]=x[0].publishedWaves[0].slots[0]],['abandoned tenth',x=>x[0].publishedWaves[13].slots.push('185:3')],['functional D085',x=>x[0].excluded.D085='building'],['failed main job',x=>x[1].mainCI.success--],['stale public',x=>x[1].publicChecks[0].sha256='0'.repeat(64)],['unpublished main',x=>x[1].state='candidate'],['changed historical geometry',x=>x[3][0].bytes='0'.repeat(64)],['199',x=>x[0].prospective[2].count=9],['201',x=>x[0].prospective[2].count=11],['21waves',x=>x[0].prospective.push({wave:21,count:0})]
])test('current ledger rejects '+name,()=>{const x=structuredClone(values);mutate(x);assert.throws(()=>assertCurrentLedger(...x));});

import test from 'node:test';import assert from 'node:assert/strict';
import{awaitNaturalToastRemoval,awaitD086CaptureQuiet}from'./browser-capture-quiet.mjs';
test('waits for normal2700ms toast removal, including450ms fade, without discarding it',async()=>{
 let t=0,reads=0;const r=await awaitNaturalToastRemoval({now:()=>t,sleep:async ms=>{t+=ms;},read:async()=>{reads++;return t<2700?[{text:'−$400',opacity:t<2200?'1':'0.5'}]:[];}});
 assert.equal(t,2700);assert.equal(r.remaining,0);assert.equal(r.polls,108);assert.equal(reads,109);assert.equal(r.initial[0].text,'−$400');
});
test('already quiet captures do not incur an arbitrary delay',async()=>{const r=await awaitNaturalToastRemoval({now:()=>0,sleep:async()=>assert.fail('unnecessary wait'),read:async()=>[]});assert.equal(r.polls,0);});
test('never-removed toast remains a failure, not hidden UI',async()=>{let t=0;await assert.rejects(()=>awaitNaturalToastRemoval({now:()=>t,sleep:async ms=>{t+=ms;},read:async()=>[{text:'persistent'}]}),/did not finish/);assert.equal(t,5000);});
test('missing toast inventory is not interpreted as quiet',async()=>{await assert.rejects(()=>awaitNaturalToastRemoval({now:()=>0,sleep:async()=>{},read:async()=>null}),/inventory/);});
test('backward and nonfinite monotonic clocks rejected',async()=>{for(const v of[-1,NaN]){let i=0;await assert.rejects(()=>awaitNaturalToastRemoval({now:()=>i++?v:0,sleep:async()=>{},read:async()=>[]}));}});
test('actual-page adapter only reads DOM and preserves save/history',async()=>{const calls=[],page={evaluate:async s=>{calls.push(s);return s.includes('querySelector')?[]:'same world';}};const r=await awaitD086CaptureQuiet(page);assert.equal(r.worldUnchanged,true);assert.ok(calls.some(s=>s.includes('getComputedStyle')));assert.ok(calls.every(s=>!s.includes('.remove(')&&!s.includes('.style=')&&!s.includes('.style.')));});
test('world change while waiting remains failure',async()=>{let n=0;const page={evaluate:async s=>s.includes('querySelector')?[]:String(n++)};await assert.rejects(()=>awaitD086CaptureQuiet(page),/cannot mutate/);});

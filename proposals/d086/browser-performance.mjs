// CI integration hook only: accepts an existing actual CDP page, never launches Chrome.
// Exact D010/D012/D015 existing rebuild proxy: CPU6, three full rebuilds, median<=400ms.
import assert from'node:assert/strict';
export const REBUILD_POLICY=Object.freeze({cpuRate:6,samples:3,medianMs:400,physicalAndroid:false});
export function assertD086RebuildPerformance(r){assert.equal(r.cpuRate,6);assert.equal(r.rebuildMs.length,3);assert.ok(r.rebuildMs.every(x=>Number.isFinite(x)&&x>=0));assert.equal(r.worldUnchanged,true);const median=[...r.rebuildMs].sort((a,b)=>a-b)[1];assert.ok(median<=400,'unchanged CPU6 full-rebuild median400ms ceiling');return median;}
export async function collectD086RebuildPerformance(page,{record=()=>{}}={}){
 const snapshot='JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])',before=await page.evaluate(snapshot),r={qualification:'Actual Chrome CPU-throttled full-scene rebuild proxy, not physical Android or GPU timing.',cpuRate:6,rebuildMs:[],worldUnchanged:false,passed:false};
 await page.send('Emulation.setCPUThrottlingRate',{rate:6});
 try{for(let i=0;i<3;i++){r.rebuildMs.push(await page.evaluate('__gt.simRebuild(true)'));record(structuredClone(r));}}
 finally{await page.send('Emulation.setCPUThrottlingRate',{rate:1});}
 r.worldUnchanged=(await page.evaluate(snapshot))===before;r.medianMs=assertD086RebuildPerformance(r);r.passed=true;record(structuredClone(r));return r;
}

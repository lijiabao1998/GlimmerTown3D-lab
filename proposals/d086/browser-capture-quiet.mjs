// Observe normal UI timeout completion; never remove UI or disable transitions.
import assert from 'node:assert/strict';
export async function awaitNaturalToastRemoval({read,sleep,now,timeoutMs=5000}){
 const start=now(),initial=await read();let current=initial,polls=0;
 assert.ok(Number.isFinite(start));
 for(;;){
  assert.ok(Array.isArray(current),'real toast inventory required');
  const elapsedMs=now()-start;assert.ok(Number.isFinite(elapsedMs)&&elapsedMs>=0);
  if(!current.length)return{mode:'wait-for-natural-removal',initial,remaining:0,polls,elapsedMs,passed:true};
  assert.ok(elapsedMs<timeoutMs,'normal toast lifecycle did not finish before capture');
  await sleep(25);current=await read();polls++;
 }
}
export async function awaitD086CaptureQuiet(page){
 const snapshot='JSON.stringify([__gt.save(),__gt.history(),__gt.buildingList()])',before=await page.evaluate(snapshot);
 const result=await awaitNaturalToastRemoval({
  read:()=>page.evaluate(`(()=>{const root=document.querySelector('#toasts');if(!root)throw Error('native toast root missing');return [...root.children].map(e=>({text:e.textContent,opacity:getComputedStyle(e).opacity}));})()`),
  sleep:ms=>new Promise(r=>setTimeout(r,ms)),now:()=>performance.now()
 });
 result.worldUnchanged=(await page.evaluate(snapshot))===before;assert.equal(result.worldUnchanged,true,'waiting for native UI cannot mutate world/save/history');return result;
}

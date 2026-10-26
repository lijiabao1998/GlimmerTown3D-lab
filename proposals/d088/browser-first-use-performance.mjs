// Additive CI hook: no browser launch, source instrumentation, synthetic preview,
// model warmup or product mutation. Callbacks must send actual CDP UI input.
import assert from 'node:assert/strict';
export const FIRST_USE_POLICY=Object.freeze({cpuRate:6,previewMaxMs:16,commitMaxMs:400,rebuildMaxMs:400,originalMedianSamples:3,physicalAndroid:false});
export const FIRST_USE_SNAPSHOT=`(()=>({timeOrigin:performance.timeOrigin,now:performance.now(),url:location.href,navigationType:performance.getEntriesByType('navigation')[0]?.type??null,timing:__gt.timing(),ui:__gt.ui(),stroke:__gt.stroke(),sim:__gt.sim(),buildings:__gt.buildingList(),history:__gt.history(),save:__gt.save()}))()`;
const sessions=new WeakMap(),activePages=new WeakMap(),finite=(x,label)=>assert.ok(Number.isFinite(x)&&x>=0,label+' finite nonnegative');
const slot=(k,v)=>k+':'+v;
function snapshot(s,timeOrigin){assert.ok(s&&typeof s==='object');finite(s.now,'browser clock');finite(s.timeOrigin,'navigation origin');assert.ok(s.timeOrigin>0);if(timeOrigin!==undefined)assert.equal(s.timeOrigin,timeOrigin,'same document, no hidden reload');assert.ok(['navigate','reload'].includes(s.navigationType));assert.ok(Array.isArray(s.buildings)&&Array.isArray(s.history));assert.equal(s.sim?.playing,false,'pause before native performance input');assert.equal(typeof s.save,'string');assert.ok(s.save);assert.ok(s.timing&&s.ui);return s;}
function unchanged(a,b,label){assert.equal(b.save,a.save,label+' save unchanged');assert.deepEqual(b.history,a.history,label+' history unchanged');assert.deepEqual(b.buildings,a.buildings,label+' building list unchanged');assert.equal(b.sim.day,a.sim.day,label+' day unchanged');assert.equal(b.sim.money,a.sim.money,label+' funds unchanged');}
export async function beginD086FirstUseSession(page,{models}={}){
 assert.ok(page&&typeof page.send==='function'&&typeof page.evaluate==='function');assert.ok(Array.isArray(models)&&models.length===11,'explicit complete eleven-model scope');const copy=models.map(({id,k,v,size,tool})=>({id,k,v,size,tool}));assert.equal(new Set(copy.map(m=>m.id)).size,11);assert.equal(new Set(copy.map(m=>slot(m.k,m.v))).size,11);assert.equal(new Set(copy.map(m=>m.tool)).size,11);for(const m of copy){assert.equal(typeof m.id,'string');assert.equal(typeof m.tool,'string');assert.ok(Number.isInteger(m.k)&&Number.isInteger(m.v)&&m.size===1);}
 const initial=snapshot(await page.evaluate(FIRST_USE_SNAPSHOT));assert.equal(initial.stroke,null,'no previous held input');assert.ok(!copy.some(m=>m.tool===initial.ui.civicTool),'start session before selecting any target tool');const slots=new Set(copy.map(m=>slot(m.k,m.v)));assert.ok(!initial.buildings.some(b=>slots.has(slot(b[1],b[6]))),'no target model already present/rendered');assert.ok(!initial.history.some(e=>e.t==='place'&&slots.has(slot(e.k,e.v))),'no earlier target placement even if demolished/undone');const prior=activePages.get(page);assert.ok(!prior||prior.timeOrigin!==initial.timeOrigin,'cannot relabel used document as a new first-use session');
 const token=Object.freeze({timeOrigin:initial.timeOrigin,url:initial.url});const state={page,initial,models:copy,attempted:new Map(),records:[],inFlight:false,timeOrigin:initial.timeOrigin};sessions.set(token,state);activePages.set(page,state);return token;
}
export function assertD086FirstUsePerformance(r){assert.equal(r.cpuRate,6);assert.equal(r.physicalAndroid,false);assert.equal(r.cacheColdVerified,false,'private cache cannot be directly observed by existing hooks');assert.equal(r.actualPointer,true);assert.ok(Number.isInteger(r.operation)&&r.operation>=1);assert.equal(typeof r.firstNativeAttempt,'boolean');assert.equal(r.previewFresh,true);assert.equal(r.commitFresh,true);assert.equal(r.newMatchingPlacements,1);assert.equal(r.selectionExactTimingAvailable,false);assert.equal(r.originalThreeSampleMedianQualified,false,'one first-use record is never three samples');
 for(const [name,limit]of [['previewMs',16],['commitMs',400],['rebuildMs',400],['rebuildAllMs',400]]){finite(r[name],name);assert.ok(r[name]<=limit,'unchanged '+name+' ceiling '+limit+'ms');}finite(r.selectionObservedElapsedMs,'selection observation');return true;}
// A separate original-policy check, never a median over different model IDs or
// repeated reads of one operation. Caller must collect three real placements.
export function assertD086ThreeCommitMedian(records){assert.equal(records.length,3);const ids=new Set(records.map(r=>r.model.id));assert.equal(ids.size,1,'same-model three-operation series');assert.equal(new Set(records.map(r=>r.operation)).size,3,'three distinct actual operations');assert.equal(new Set(records.map(r=>r.timeOrigin)).size,1,'same observed document');for(const r of records){assert.equal(r.cpuRate,6);assert.equal(r.actualPointer,true);assert.equal(r.commitFresh,true);assert.equal(r.newMatchingPlacements,1);finite(r.commitMs,'commit');}const medianMs=records.map(r=>r.commitMs).sort((a,b)=>a-b)[1];assert.ok(medianMs<=400,'original CPU6 three-commit median400ms ceiling');return{samples:3,medianMs,limitMs:400,passed:true};}
export async function collectD086FirstUsePerformance(page,{session,model,site,select,pointerDown,pointerUp,pointerCancel,record=()=>{}}={}){
 const state=sessions.get(session);assert.ok(state&&state.page===page,'session belongs to actual page');assert.equal(state.inFlight,false,'serial native inputs only');const expected=state.models.find(m=>m.id===model?.id);assert.deepEqual(model&&Object.fromEntries(Object.keys(expected??{}).map(k=>[k,model[k]])),expected);assert.ok(expected,'known model descriptor');assert.ok(Array.isArray(site)&&site.length===2&&site.every(x=>Number.isInteger(x)&&x>=0));for(const f of[select,pointerDown,pointerUp,pointerCancel,record])assert.equal(typeof f,'function');state.inFlight=true;
 const attempt=(state.attempted.get(model.id)??0)+1;state.attempted.set(model.id,attempt);const r={qualification:'Actual CPU6 first native selection/held preview/placement observation. Existing hooks cannot inspect private normalized-model caches; no certified cold-cache or physical-Android claim. Selection elapsed includes CDP/observation/wait overhead; no dedicated selection CPU timer exists.',model:{...expected},site:[...site],operation:state.records.length+1,timeOrigin:state.timeOrigin,cpuRate:6,physicalAndroid:false,firstNativeAttempt:attempt===1,cacheColdVerified:false,selectionExactTimingAvailable:false,originalThreeSampleMedianQualified:false,actualPointer:false,previewFresh:false,commitFresh:false,newMatchingPlacements:0,passed:false,phase:'before'};state.records.push(r);let held=false,cpuRequested=false;
 const emit=()=>record(structuredClone(r));
 try{
  const before=snapshot(await page.evaluate(FIRST_USE_SNAPSHOT),state.timeOrigin);assert.equal(before.stroke,null);assert.ok(!before.buildings.some(b=>b[2]===site[0]&&b[3]===site[1]),'empty intended root cell');r.before=before;emit();
  cpuRequested=true;await page.send('Emulation.setCPUThrottlingRate',{rate:6});const start=snapshot(await page.evaluate(FIRST_USE_SNAPSHOT),state.timeOrigin);unchanged(before,start,'CPU setup');
  await select();const selected=snapshot(await page.evaluate(FIRST_USE_SNAPSHOT),state.timeOrigin);unchanged(start,selected,'actual selection');assert.equal(selected.ui.tool,'civic');assert.equal(selected.ui.civicTool,model.tool);assert.equal(selected.stroke,null);r.selectionObservedElapsedMs=selected.now-start.now;finite(r.selectionObservedElapsedMs,'selection elapsed');r.selected=selected;r.phase='selected';emit();
  held=true;await pointerDown();const preview=snapshot(await page.evaluate(FIRST_USE_SNAPSHOT),state.timeOrigin);unchanged(selected,preview,'held native preview');assert.deepEqual(preview.stroke?.a,site);assert.deepEqual(preview.stroke?.b,site);assert.equal(preview.stroke?.moved,false);assert.equal(preview.stroke?.preview?.count,1);assert.equal(preview.stroke?.preview?.cells,model.size*model.size);finite(preview.timing.preview,'actual held preview');r.previewMs=preview.timing.preview;r.previewFresh=true;r.preview=preview;r.phase='held-preview';emit();
  await pointerUp();held=false;const after=snapshot(await page.evaluate(FIRST_USE_SNAPSHOT),state.timeOrigin);assert.equal(after.stroke,null);assert.equal(after.sim.day,before.sim.day);assert.deepEqual(after.history.slice(0,before.history.length),before.history,'append-only old history');const added=after.history.slice(before.history.length),placed=added.filter(e=>e.t==='place'&&e.k===model.k&&e.v===model.v&&e.x===site[0]&&e.z===site[1]);assert.equal(placed.length,1,'actual pointer committed exactly one expected place event');assert.equal(added.filter(e=>e.t==='place').length,1,'no hidden extra placements');const oldIds=new Set(before.buildings.map(b=>b[0])),newBuildings=after.buildings.filter(b=>!oldIds.has(b[0]));assert.equal(newBuildings.length,1);assert.deepEqual(after.buildings.filter(b=>oldIds.has(b[0])),before.buildings,'old native owners unchanged');assert.deepEqual([newBuildings[0][1],newBuildings[0][2],newBuildings[0][3],newBuildings[0][4],newBuildings[0][6]],[model.k,...site,model.size,model.v]);assert.notEqual(after.save,before.save,'placement persisted in actual world');
  r.newMatchingPlacements=1;r.commitMs=after.timing.commit;r.rebuildMs=after.timing.rebuild;r.rebuildAllMs=after.timing.rebuildAll;r.commitFresh=true;r.actualPointer=true;r.after=after;r.phase='committed';emit();assertD086FirstUsePerformance(r);r.passed=true;
 }catch(error){r.error=error.stack??String(error);throw error;}
 finally{try{if(held){try{await pointerCancel();r.cancelledHeldPointer=true;}catch(error){r.cancelError=error.stack??String(error);}}}finally{try{if(cpuRequested){try{await page.send('Emulation.setCPUThrottlingRate',{rate:1});r.cpuRestored=true;}catch(error){r.passed=false;r.restoreError=error.stack??String(error);throw error;}}}finally{state.inFlight=false;emit();}}}
 return structuredClone(r);
}
/* Exact integration seam (parent applies, not this module):
  1. Import beginD086FirstUseSession/collectD086FirstUsePerformance.
  2. After loading paused six-control city and before any target tool selection:
       const firstUse = await beginD086FirstUseSession(page,{models:MODELS});
  3. In existing ten-model loop, position camera, compute cellScreen, and await
     natural capture quiet BEFORE measurement. Replace existing tool click,
     synthetic __gt.preview call and tapXY with this hook:
       await collectD086FirstUsePerformance(page,{session:firstUse,model:m,
         site:[x,z],select:()=>click(`#catalog button[data-tool="${m.tool}"]`),
         pointerDown:()=>actualCDPMousePressedOrTouchStart(p),
         pointerUp:()=>actualCDPMouseReleasedOrTouchEnd(),
         pointerCancel:()=>actualCDPMouseEscapeThenReleaseOrTouchCancel(),
         record:r=>{manifest.firstUsePerformance[i]=r;write();}});
     Mouse move may precede press; no post-press frames required. On touch use
     distinct held touchStart/touchEnd (not a combined tap callback). Mouse
     cancellation must send native Escape before release so cleanup cannot
     accidentally commit; touch cancellation uses touchCancel. Existing
     row/history/exact-placement checks remain after this measurement.
  4. The removed synthetic preview's count/cell assertions are replaced by the
     actual held __gt.stroke().preview assertions; do not invoke it beforehand.
     affordability is independently established by exact successful placement.
  5. Keep original final 3×CPU6 full-rebuild check and real raw PNG controls.
     One first-use observation per model is NOT the original3-sample commit
     median; extra same-model native placements on a separate fresh CI page are
     needed to invoke assertD086ThreeCommitMedian. Do not average ten models.
*/

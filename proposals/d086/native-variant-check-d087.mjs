// D087 finite current contract. Original proposals/d086/native-variant-check.mjs is unchanged at b4275bda73e72a9fb48343376fccaab52bbc8e84.
// D086 focused native-variant integration; not art acceptance or full CI.
import assert from 'node:assert/strict';
import {checkedD087Predecessor} from '../../tools/d087-kind-metadata-contract.mjs';
import fs from 'node:fs';
import {KINDS} from '../../src/content/kinds.ts';
import {kindTableFrom} from '../../src/content/kindTable.ts';
import {withRuralHeritageKinds} from '../../src/content/britishRuralHeritage.ts';
import {CIVIC_MARKET_BUILDINGS as MODELS,withCivicMarketVariants,withCivicMarketHeights} from '../../src/content/britishCivicMarkets.ts';
import {FACILITY_TOOLS,HERITAGE_TOOLS,NATIVE_ART_TOOLS,previewOp,commitOp,undoOp,toolSize} from '../../src/sim/edit.ts';
import {tapNativeArtVariant} from '../../src/sim/nativeArtVariant.ts';
import {COST,FOREIGN_LAYERS} from '../../src/sim/rules/build.ts';
import {saveCode,loadCode} from '../../src/io/save.ts';
import {encodeLabCode,decodeLabCode} from '../../src/io/labcode.ts';
import {stepDay} from '../../src/sim/day.ts';
import {FACILITY_NOTES,facilityPresentation} from '../../src/ui/growthGuide.ts';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const out='scratch/d087-native/d086-current';fs.mkdirSync(out,{recursive:true});
const report={qualification:'Focused native functionality and existing-base-tool equivalence only. Geometry, raw browser, full CI and publication not inferred.',passed:false,checks:[],comparisons:0,negativeControls:0,blockedCases:0};
const write=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
async function check(name,fn){try{await fn();report.checks.push({name,passed:true});console.log('OK',name);}catch(e){report.checks.push({name,passed:false,error:e.stack});console.error('FAIL',name,e);}write();}
const vrank=read('src/content/samples/d009-live.json').vrank,base=withRuralHeritageKinds(read('src/content/lab-kinds.json')),oldKT=kindTableFrom(base);
const d087PriorRows=checkedD087Predecessor(KINDS.data.kinds,withCivicMarketVariants(base).kinds);
const N=40,start=encodeLabCode({v:1,n:N,seed:20261086,day:0,money:20000,nm:'D086 native market and civic variants',df:1,ter:'2'.repeat(N*N),tre:'0'.repeat(N*N),bl:[]},{deflate:true});
function loaded(code=start){const l=loadCode(code,KINDS,vrank);assert.ok(l.ok,l.error);return l;}
const op=(tool,x=5,z=6,k='tap')=>({k,tool,x0:x,z0:z,x1:x,z1:z});
const coords=i=>[3+(i%5)*6,4+Math.floor(i/5)*8];
function state(s){return{w:s.w,g:s.g,budget:s.budget,rng:s.rng,resource:s.res.resource,money:s.money,diff:s.diff,tech:s.edu.tech,spec:s.edu.spec,landDirty:s.landDirty,landBox:s.landBox,txn:null,dozeArm:s.dozeArm,protect:true};}
const comparable=s=>JSON.parse(JSON.stringify({w:s.w,g:s.g,money:s.money,budget:s.budget,edu:s.edu,landDirty:s.landDirty,landBox:s.landBox,dozeArm:s.dozeArm,stale:s.stale,city:s.city,txns:s.txns,stroke:s.stroke}));
function normalizeVariant(q,m,v){for(const t of q.w.tiles)if(t.bld?.k===m.k&&!t.bld.ref&&t.bld.v===m.v)t.bld.v=v;for(const b of q.city.buildings)if(b.k===m.k&&b.v===m.v)b.v=v;for(const h of q.city.history)if(h.k===m.k&&h.v===m.v)h.v=v;for(const tx of q.txns)for(const sn of tx.txn.snaps)if(sn.a){const t=JSON.parse(sn.a);if(t.bld?.k===m.k&&!t.bld.ref&&t.bld.v===m.v)t.bld.v=v;sn.a=JSON.stringify(t);}return q;}
await check('ten exact append-only variants, original metadata/defaults and eight heritage tools retained',()=>{
 assert.equal(MODELS.length,10);assert.equal(NATIVE_ART_TOOLS.length,10);assert.equal(HERITAGE_TOOLS.length,8);assert.equal(new Set(FACILITY_TOOLS.map(t=>t.id)).size,FACILITY_TOOLS.length);assert.equal(KINDS.data.kinds.length,base.kinds.length);assert.deepEqual(KINDS.data.kinds.map(r=>r.k),base.kinds.map(r=>r.k));
 const scope=read('proposals/d086/scope.json').models;for(let i=0;i<MODELS.length;i++){const {short,...m}=MODELS[i];assert.deepEqual(m,scope[i]);}
 for(const old of base.kinds){const row=d087PriorRows.find(r=>r.k===old.k),clean=structuredClone(row),added=MODELS.filter(m=>m.k===old.k);for(const m of added)delete clean.hv[1][m.v];if(!Object.hasOwn(old.hv,'1'))delete clean.hv[1];clean.variants=old.variants;assert.deepEqual(clean,old,'only declared variant metadata '+old.k);for(const lv of [0,1,2,3]){assert.equal(KINDS.height(old.k,lv),oldKT.height(old.k,lv));for(let v=0;v<Math.max([6,7,11,12,13,14,15].includes(old.k)?5:1,old.variants[1]??0);v++)assert.equal(KINDS.height(old.k,lv,v),oldKT.height(old.k,lv,v),'old height '+old.k+':'+lv+':'+v);}}
 for(const m of MODELS){assert.equal(KINDS.height(m.k,1,m.v),m.H);assert.equal(KINDS.size(m.k),m.size);assert.equal(toolSize(m.tool),m.size);assert.equal(NATIVE_ART_TOOLS.find(t=>t.id===m.tool).cost,COST[m.baseTool]);const note=FACILITY_NOTES[m.tool];assert.equal(note.group,'heritage');assert.ok(!note.use.includes('不新增生產'));const p=facilityPresentation(NATIVE_ART_TOOLS.find(t=>t.id===m.tool),0,false);assert.equal(p.locked,false);assert.ok(p.price.includes(COST[m.baseTool].toLocaleString('en-US')));}
 assert.throws(()=>withCivicMarketVariants(KINDS.data));assert.throws(()=>withCivicMarketVariants({...base,kinds:base.kinds.filter(r=>r.k!==87)}));report.negativeControls+=2;
 const wrapped=withCivicMarketHeights(oldKT);assert.equal(wrapped.height(13,1,5),.85);assert.equal(wrapped.height(13,1,0),.8);for(const v of [-1,6,NaN,undefined,null,'5'])assert.equal(wrapped.height(13,1,v),oldKT.height(13,1,v));report.negativeControls+=6;
});
await check('all ten reuse exact native fiscal, RNG, world, service grids and transaction semantics',()=>{
 for(const m of MODELS)for(const mode of ['normal','tree-tech','sandbox']){
  const A=loaded(),B=loaded(),a=A.sim,b=B.sim;
  for(const s of [a,b]){if(mode==='tree-tech'){s.w.tiles[6*N+5].tree=1;s.city.tree[6*N+5]=1;s.edu.tech=['B5','C8','D4a'];s.edu.spec='hub';}if(mode==='sandbox'){s.diff=3;s.money=0;}}
  assert.deepEqual(previewOp(a,op(m.tool)),previewOp(b,op(m.baseTool)));
  const ra=commitOp(a,op(m.tool),0),rb=commitOp(b,op(m.baseTool),0);assert.ok(ra.ok,ra.reason);assert.ok(rb.ok,rb.reason);const bv=b.w.tiles[6*N+5].bld.v;
  assert.equal(a.w.tiles[6*N+5].bld.v,m.v);assert.equal(a.city.buildings[0].v,m.v);assert.equal(a.city.history.find(e=>e.t==='place').v,m.v);assert.equal(JSON.parse(a.txns[0].txn.snaps.find(s=>s.i===6*N+5).a).bld.v,m.v);
  assert.deepEqual({...ra,events:ra.events.map(e=>({...e,v:bv}))},rb);assert.deepEqual(normalizeVariant(comparable(a),m,bv),comparable(b),m.id+' '+mode);
  assert.deepEqual(Array.from({length:12},()=>a.rng.R()),Array.from({length:12},()=>b.rng.R()),'native RNG consumes exactly the original amount');
  const ua=undoOp(a),ub=undoOp(b);assert.deepEqual(ua,ub);assert.deepEqual(normalizeVariant(comparable(a),m,bv),comparable(b));report.comparisons++;
 }
});
await check('all inherited blocker outcomes and insufficient funds match base without partial placement',()=>{
 const blockers=[['t',0],['t',3],['road',1],['ruin',1],['crater',1],['bld',{k:4,lv:1,v:0,age:9}],...FOREIGN_LAYERS.map(k=>[k,1])];
 for(const m of MODELS)for(let dz=0;dz<m.size;dz++)for(let dx=0;dx<m.size;dx++)for(const [key,value]of blockers){const a=loaded().sim,b=loaded().sim,i=(6+dz)*N+5+dx;a.w.tiles[i][key]=structuredClone(value);b.w.tiles[i][key]=structuredClone(value);const pa=previewOp(a,op(m.tool)),pb=previewOp(b,op(m.baseTool));assert.deepEqual(pa,pb);const ra=commitOp(a,op(m.tool),0),rb=commitOp(b,op(m.baseTool),0);assert.equal(ra.ok,rb.ok);assert.equal(ra.spent,rb.spent);assert.equal(ra.reason,rb.reason);if(!ra.ok){assert.deepEqual(comparable(a),comparable(b));report.blockedCases++;}else{const bv=b.w.tiles[6*N+5].bld.v;assert.deepEqual(normalizeVariant(comparable(a),m,bv),comparable(b));}report.comparisons++;}
 for(const m of MODELS){const s=loaded().sim;s.money=COST[m.baseTool]-1;const before=JSON.stringify(s.w.tiles),r=commitOp(s,op(m.tool),0);assert.equal(r.ok,false);assert.equal(r.spent,0);assert.equal(JSON.stringify(s.w.tiles),before);report.negativeControls++;for(const k of ['line','rect']){const q=loaded().sim,before=JSON.stringify(comparable(q));assert.equal(commitOp(q,op(m.tool,5,6,k),0).ok,false);assert.equal(JSON.stringify(comparable(q)),before);report.negativeControls++;}for(const [x,z]of [[-1,0],[N,0],[0,N],[1.5,2],[NaN,2]]){const q=loaded().sim,before=JSON.stringify(q.w.tiles);assert.equal(commitOp(q,op(m.tool,x,z),0).ok,false);assert.equal(JSON.stringify(q.w.tiles),before);report.negativeControls++;}}
 assert.throws(()=>tapNativeArtVariant(state(loaded().sim),'nonexistent',5,6));const busy=state(loaded().sim);busy.txn={snaps:[],seen:{},spent:0};assert.throws(()=>tapNativeArtVariant(busy,MODELS[0].tool,5,6));report.negativeControls+=2;
});
let builtCode,finishedCode;
await check('ten native owners retain exact explicit variants through save/load and journal replay',()=>{
 const L=loaded(),s=L.sim;fs.writeFileSync(out+'/initial.code.txt',start);
 for(const [i,m]of MODELS.entries()){const [x,z]=coords(i),r=commitOp(s,op(m.tool,x,z),i*1000);assert.ok(r.ok,r.reason);assert.equal(r.spent,COST[m.baseTool]);assert.equal(r.events[0].v,m.v);const b=s.city.buildings.at(-1);assert.deepEqual([b.k,b.v,b.size,b.x,b.z],[m.k,m.v,m.size,x,z]);for(let dz=0;dz<m.size;dz++)for(let dx=0;dx<m.size;dx++)assert.equal(s.city.occ[(z+dz)*N+x+dx],b.id);}
 builtCode=saveCode(s,L.template,L.start);fs.writeFileSync(out+'/built-day0.code.txt',builtCode);const R=loaded(builtCode);assert.equal(R.replayed,true);assert.deepEqual(R.sim.city.buildings,s.city.buildings);assert.deepEqual(R.sim.city.history,s.city.history);assert.equal(loaded(saveCode(R.sim,R.template,R.start)).replayed,true);const raw=decodeLabCode(builtCode);assert.ok(raw);report.owners=s.city.buildings;report.placeEvents=s.city.history.filter(e=>e.t==='place').length;
});
await check('native root/child demolition and refund undo restore each explicit variant and footprint',()=>{
 assert.ok(builtCode);for(const [i,m]of MODELS.entries()){const L=loaded(builtCode),s=L.sim,[x,z]=coords(i),money=s.money,owner=s.city.buildings[i].id,r=commitOp(s,op('doze',x+m.size-1,z+m.size-1),0);assert.ok(r.ok);for(let dz=0;dz<m.size;dz++)for(let dx=0;dx<m.size;dx++)assert.equal(s.city.occ[(z+dz)*N+x+dx],0);assert.ok(undoOp(s).ok);assert.equal(s.money,money);assert.equal(s.w.tiles[z*N+x].bld.v,m.v);for(let dz=0;dz<m.size;dz++)for(let dx=0;dx<m.size;dx++)assert.equal(s.city.occ[(z+dz)*N+x+dx],owner);const R=loaded(saveCode(s,L.template,L.start));assert.equal(R.replayed,true);assert.equal(R.sim.w.tiles[z*N+x].bld.v,m.v);report.comparisons++;}
});
await check('nine real simulation days retain native construction, service/fiscal parity and saves',()=>{
 for(const m of MODELS){const A=loaded(),B=loaded(),a=A.sim,b=B.sim;commitOp(a,op(m.tool),0);commitOp(b,op(m.baseTool),0);const bv=b.w.tiles[6*N+5].bld.v;for(let d=0;d<9;d++){stepDay(a);stepDay(b);assert.deepEqual(normalizeVariant(comparable(a),m,bv),comparable(b),m.id+' daily parity '+d);}assert.ok(a.city.buildings[0].age>=9);assert.equal(a.city.buildings[0].v,m.v);report.comparisons++;}
 const L=loaded(builtCode);for(let d=0;d<9;d++)stepDay(L.sim);assert.ok(L.sim.city.buildings.every(b=>b.age>=9));finishedCode=saveCode(L.sim,L.template,L.start);fs.writeFileSync(out+'/finished-day9.code.txt',finishedCode);const R=loaded(finishedCode);assert.equal(R.replayed,true);assert.deepEqual(R.sim.city.buildings.map(b=>[b.k,b.v]),MODELS.map(m=>[m.k,m.v]));report.finishedOwners=R.sim.city.buildings;
});
report.passed=report.checks.every(t=>t.passed);write();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,comparisons:report.comparisons,negativeControls:report.negativeControls,blockedCases:report.blockedCases}));if(!report.passed)process.exitCode=1;

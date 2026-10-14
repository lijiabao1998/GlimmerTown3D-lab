// Fresh D055 recovery tests for the native editor, replay, persistence and seasonal
// simulation. These are new evidence, not the unrecovered previous D055 suite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mk, zoneRect } from './d034-cities.mjs';
import { loadCode, saveCode } from '../src/io/save.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { replayCity } from '../src/sim/replay.ts';
import { stepDay } from '../src/sim/day.ts';
import { season } from '../src/sim/rules/weather.ts';
import * as E from '../src/sim/edit.ts';
import { COST } from '../src/sim/rules/build.ts';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KT = kindTableFrom(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/lab-kinds.json'), 'utf8')));
const vrank = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/samples/d009-live.json'), 'utf8')).vrank;
const DEFS = [
  ['farm', 22, 2], ['ranch', 23, 2], ['bigFarm', 53, 5], ['greenhouse', 63, 2],
  ['foodPlant', 57, 3], ['market', 87, 2], ['tradepost', 91, 2],
].map(([tool, kind, size], i) => ({ tool, kind, size, x: 8 + i*8, z: 31 }));
const tap = (tool, x, z) => ({ k: 'tap', tool, x0: x, z0: z, x1: x, z1: z });
const foot = d => Array.from({ length: d.size*d.size }, (_, i) => [d.x+i%d.size, d.z+Math.floor(i/d.size)]);
const variant = d => d.tool === 'farm' ? (d.x*5+d.z*11)%16 : d.tool === 'ranch' ? (d.x*7+d.z*5)%5 : 0;
const digest = c => JSON.stringify({ road: [...c.road], rclass: [...c.rclass], zone: [...c.zone], tree: [...c.tree], occ: [...c.occ], wp: [...c.wp], ruin: [...c.ruin],
  buildings: c.buildings.map(b => [b.id,b.k,b.lv,b.v,b.x,b.z,b.size,b.goneDay??null,b.abandoned]) });
const tileSnapshot = t => { const v = structuredClone(t); delete v.wr; return JSON.stringify(v); }; // water recomputation runtime field
const shape = tiles => tiles.map(t => t.bld ? [t.bld.k,t.bld.sz??null,t.bld.ref??null] : null);
function codeFor(day = 150, imported = false, decorated = false) {
  return mk(5166055, day, 'D055 fresh native tests', b => {
    b.road(4,30,66,30,3).put(3,30,5).put(67,30,5);
    b.row(8,19,29,1,2).row(25,34,29,2,2);
    b.put(40,29,6).put(42,29,12).put(44,29,11).put(46,29,7).put(48,29,8);
    b.put(4,28,10); for (let x=4;x<=66;x++) b.pipeAt(x,30);
    for (const d of DEFS) {
      if (decorated) { zoneRect(b,d.x,d.z,d.x+d.size-1,d.z+d.size-1,1); for (const [x,z] of foot(d)) b.flag('tre',x,z,1); }
      if (imported) b.put(d.x,d.z,d.kind,1,{age:20,v:variant(d)});
    }
  });
}
function load(code) { const L=loadCode(code,KT,vrank); assert.ok(L.ok,L.error); L.sim.money=1e6; return {...L,code}; }
function buildAll(L) { for (const d of DEFS) { const r=E.commitOp(L.sim,tap(d.tool,d.x,d.z),0); assert.ok(r.ok,`${d.tool}: ${r.reason}`); } return L; }
const stripHistory = h => h.filter(e => e.t !== 'restyle');
export async function d055NativeGuards(log) {
  const check = async (label,fn) => { try { const detail=await fn(); log(true,label,detail||''); } catch(e) { log(false,label,e.stack||String(e)); } };
  await check('D055 native catalogue: seven food tools, 18 unchanged civic tools, 25 unique facilities and original sizes/prices', () => {
    assert.equal(E.CIVIC_TOOLS.length,18); assert.deepEqual(E.FOOD_TOOLS.map(t=>t.id),DEFS.map(d=>d.tool));
    assert.equal(E.FACILITY_TOOLS.length,25); assert.equal(new Set(E.FACILITY_TOOLS.map(t=>t.id)).size,25);
    for(const d of DEFS) { const t=E.FOOD_TOOLS.find(t=>t.id===d.tool); assert.equal(t.cost,COST[d.tool]); assert.equal(E.toolSize(d.tool),d.size); assert.equal(E.gestureOf(d.tool),'tap'); }
  });
  await check('D055 preview and rejection: complete footprint, one charged root, no history/money changes, blocked last square and clipped map edge', () => {
    const L=load(codeFor()),s=L.sim,N=s.w.N;
    for(const d of DEFS) {
      const before=digest(s.city), money=s.money, history=JSON.stringify(s.city.history), tiles=JSON.stringify(s.w.tiles);
      const pv=E.previewOp(s,tap(d.tool,d.x,d.z));
      assert.equal(pv.cells.length,d.size*d.size,d.tool); assert.equal(pv.count,1); assert.equal(pv.total,COST[d.tool]);
      assert.ok(pv.cells.every(c=>c.ok)); assert.equal(pv.cells.filter(c=>c.foot).length,d.size*d.size-1);
      assert.ok(pv.cells.filter(c=>c.foot).every(c=>c.cost===0));
      assert.deepEqual(pv.cells.map(c=>[c.x,c.z]),foot(d));
      assert.equal(digest(s.city),before); assert.equal(s.money,money); assert.equal(JSON.stringify(s.city.history),history); assert.equal(JSON.stringify(s.w.tiles),tiles);
      const [x,z]=foot(d).at(-1),t=s.w.tiles[z*N+x]; t.road=1;
      const rejected=E.commitOp(s,tap(d.tool,d.x,d.z),0); assert.equal(rejected.ok,false); assert.equal(rejected.reason,'交通線擋住');
      assert.equal(s.money,money); assert.equal(JSON.stringify(s.city.history),history); t.road=0;
      const edge=E.previewOp(s,tap(d.tool,N-1,10)); assert.equal(edge.count,0); assert.equal(edge.cells.length,d.size); assert.ok(edge.cells.every(c=>!c.ok));
    }
  });
  await check('D055 all seven native builds: one event, complete occupancy and tree/zone clearing, replay, full undo, reference demolition', () => {
    for(const d of DEFS) {
      const L=load(codeFor(150,false,true)),s=L.sim,N=s.w.N, money=s.money;
      const before=foot(d).map(([x,z])=>tileSnapshot(s.w.tiles[z*N+x]));
      const r=E.commitOp(s,tap(d.tool,d.x,d.z),0); assert.ok(r.ok,d.tool); assert.equal(r.placed,1);
      const events=s.city.history.filter(e=>e.g===r.g); assert.equal(events.length,1); const e=events[0];
      assert.equal(e.t,'place'); assert.equal(e.k,d.kind); assert.equal(e.cost,COST[d.tool]+2); assert.equal(money-s.money,e.cost);
      assert.equal(s.city.buildings[e.id-1].size,d.size);
      for(const [x,z] of foot(d)) {
        const i=z*N+x,t=s.w.tiles[i]; assert.equal(s.city.occ[i],e.id); assert.equal(s.city.tree[i],0); assert.equal(s.city.zone[i],0);
        assert.equal(t.tree,0); assert.equal(t.zone,0); assert.equal(t.deco,0);
        if(x===d.x&&z===d.z) { assert.equal(t.bld.k,d.kind); assert.equal(t.bld.sz,d.size); }
        else assert.deepEqual(t.bld,{k:d.kind,ref:[d.x,d.z]});
      }
      assert.equal(digest(replayCity(L.code,s.city.history,KT)),digest(s.city));
      const u=E.undoOp(s); assert.ok(u.ok); assert.equal(u.refund,e.cost); assert.equal(s.money,money);
      assert.deepEqual(foot(d).map(([x,z])=>tileSnapshot(s.w.tiles[z*N+x])),before);
      assert.equal(s.city.history.at(-1).t,'undo'); assert.equal(digest(replayCity(L.code,s.city.history,KT)),digest(s.city));
      assert.ok(E.commitOp(s,tap(d.tool,d.x,d.z),0).ok);
      const [x,z]=foot(d).at(-1), dz=E.commitOp(s,tap('doze',x,z),0); assert.ok(dz.ok);
      assert.equal(s.city.history.filter(e=>e.g===dz.g).length,1); assert.equal(s.city.history.at(-1).t,'doze');
      for(const [x,z] of foot(d)) { assert.equal(s.w.tiles[z*N+x].bld,null); assert.equal(s.city.occ[z*N+x],0); }
      assert.equal(digest(replayCity(L.code,s.city.history,KT)),digest(s.city));
      assert.ok(E.undoOp(s).ok); for(const [x,z] of foot(d)) assert.equal(s.w.tiles[z*N+x].bld.k,d.kind);
    }
  });
  await check('D055 save/load/save/load: all seven root sizes/reference tiles and append-only history survive', () => {
    const L=buildAll(load(codeFor())), original=L.sim, expected=shape(original.w.tiles), history=JSON.stringify(stripHistory(original.city.history));
    let current=L;
    for(let i=0;i<2;i++) {
      const next=loadCode(saveCode(current.sim,current.template,current.start),KT,vrank); assert.ok(next.ok,next.error); assert.ok(next.replayed);
      assert.deepEqual(shape(next.sim.w.tiles),expected); assert.equal(JSON.stringify(stripHistory(next.sim.city.history)),history); current=next;
    }
  });
  await check('D055 seasonal parity: 24 days per season, player-built seven facilities vs identical initially imported facilities', () => {
    const summaries=[];
    for(const day of [40,140,240,320]) {
      const P=buildAll(load(codeFor(day))), I=load(codeFor(day,true)), a=P.sim,b=I.sim;
      b.money=a.money; a.econ.supplies=b.econ.supplies=2000;
      let total=0; const seasons=new Set();
      for(let n=0;n<24;n++) {
        const ra=JSON.parse(JSON.stringify(stepDay(a))),rb=JSON.parse(JSON.stringify(stepDay(b)));
        if(n===0) { assert.equal(ra.econ.ec.activeConstruction482,7); assert.equal(rb.econ.ec.activeConstruction482,0); }
        delete ra.econ.ec.activeConstruction482; delete rb.econ.ec.activeConstruction482;
        for(const r of [ra,rb]) for(const e of r.hazard?.events??[]) delete e.id;
        assert.deepEqual(ra,rb,`season ${season(day)} day ${a.day}`); assert.equal(a.money,b.money); total+=ra.food.points; seasons.add(season(a.day));
      }
      assert.equal(seasons.size,1); assert.ok(total>0); summaries.push(`season ${season(day)}: ${total} food / 24 days`);
    }
    return summaries.join('; ');
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let failures=0; await d055NativeGuards((ok,label,detail='')=>{console.log(`${ok?'PASS':'FAIL'} ${label}${detail?'\n'+detail:''}`); if(!ok) failures++;});
  if(failures) process.exitCode=1;
}

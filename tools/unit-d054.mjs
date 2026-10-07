// D054: pure UI diagnostics against the unchanged simulation, with real commits,
// undo, saves, history, traced RNG and uninterrupted paired daily trajectories.
// This Node suite is boundary evidence; it does not claim native browser proof.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { d044Load, BLOCKS } from './d044-cities.mjs';
import { d045Load } from './d045-cities.mjs';
import { stepDay } from '../src/sim/day.ts';
import { saveCode, loadCode } from '../src/io/save.ts';
import { CIVIC_TOOLS, ROAD_TOOLS, gestureOf, toolSize, previewOp, commitOp, undoOp } from '../src/sim/edit.ts';
import { FOREIGN_LAYERS, DOZE_ARM_MS } from '../src/sim/rules/build.ts';
import { RESOURCE_STOCK, RES_OIL, RES_ORE } from '../src/sim/rules/resource.ts';
import { pipeComponents, facilityComps, WATER_HOPS472 } from '../src/sim/rules/sewer.ts';
import { FACILITY_NOTES } from '../src/ui/growthGuide.ts';

// Dynamic loading permits the explicit --baseline mode to establish untouched
// authoritative behavior while product edits are still waiting for before shots.
const helperPath = path.join(ROOT, 'src/ui/siteDiagnostics.ts');
const Site = fs.existsSync(helperPath) ? await import(pathToFileURL(helperPath).href) : null;
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const strip = source => stripTypeScriptTypes(source).replace(/^import .*?;\s*$/gm, '').replace(/\bexport (?=(?:function|const)\b)/g, '');
const change = (source, from, to) => {
  assert.equal(source.split(from).length, 2, 'unique mutation target: ' + from);
  return source.replace(from, () => to);
};
const stateBytes = value => JSON.stringify(value, (_key, v) => {
  if (v instanceof Map) return { map: [...v] };
  if (v instanceof Set) return { set: [...v] };
  if (ArrayBuffer.isView(v)) return { type: v.constructor.name, bytes: [...new Uint8Array(v.buffer, v.byteOffset, v.byteLength)] };
  if (v instanceof ArrayBuffer) return { bytes: [...new Uint8Array(v)] };
  if (typeof v === 'function') return { function: String(v) };
  if (typeof v === 'number' && !Number.isFinite(v)) return { number: String(v) };
  return v;
});
const raw = f => stateBytes(f.sim);
const saved = f => saveCode(f.sim, f.template, f.start);
const op = (tool, x, z, x1 = x, z1 = z) => ({ k: gestureOf(tool), tool, x0: x, z0: z, x1, z1 });
const [X, Z] = BLOCKS.C;
const at = (s, x = X, z = Z) => s.w.tiles[z * s.w.N + x];
function clean(s) {
  for (let z = Z - 1; z < Z + 5; z++) for (let x = X - 1; x < X + 8; x++) {
    const i = z * s.w.N + x;
    Object.assign(s.w.tiles[i], { t: 2, road: 0, rc: 0, bridge: 0, hw: 0, bld: null, zone: 0, tree: 0, wp: 0, ruin: 0, crater: 0, dock: 0, levee: 0, flood: 0, ...Object.fromEntries(FOREIGN_LAYERS.map(k => [k, 0])) });
    for (const key of ['road', 'rclass', 'zone', 'tree', 'wp', 'ruin', 'occ']) s.city[key][i] = 0;
    s.city.ter[i] = 2; s.res.resource[i] = 0; s.res.rdep[i] = 0;
  }
  s.diff = 1; s.money = 1e6; s.edu.tech = []; s.edu.spec = null; s.rankIdx = 25;
}
const fixture = () => { const f = d044Load(); clean(f.sim); return f; };
const instrumentRng = sim => {
  const calls = [];
  for (const key of ['R', 'ri']) {
    const original = sim.rng[key];
    sim.rng[key] = (...args) => { const result = original(...args); calls.push([key, args, result]); return result; };
  }
  return calls;
};
function same(a, b, ar, br, why) {
  assert.equal(raw(a), raw(b), why + ': entire state/typed arrays/Map/Set/history/transactions');
  assert.equal(saved(a), saved(b), why + ': exact save bytes');
  assert.deepEqual(ar, br, why + ': RNG invocation arguments/results');
}
function originalScope() {
  const expected = {
    'src/sim': [42, '925eff90599c4e58e4d966d33a6462af52526d7e726b8fa64fc67c0b72b7c6de'],
    'src/io': [3, '3fc04802b3cb5b65f738239db7b355e13432901fa65c02db3c7648c2cd00a4fb'],
    'src/render': [15, '2adb379c0a1a309fc1de97c249af9bd98d994ec2408d9c6677a6bae57896542f'],
    'src/content': [96, '85f9d524f33f91a96d8c23bda36e358f8e7d21c14f40ece4ceaf77cf1de4618e'],
  };
  for (const [dir, [count, sha]] of Object.entries(expected)) {
    const files = fs.readdirSync(path.join(ROOT, dir), { recursive: true, withFileTypes: true }).filter(d => d.isFile()).map(d => path.relative(ROOT, path.join(d.parentPath, d.name)).replaceAll('\\', '/')).sort(), hash = createHash('sha256');
    for (const file of files) hash.update(file + '\0').update(fs.readFileSync(path.join(ROOT, file))).update('\0');
    assert.equal(files.length, count, dir + ' original file count'); assert.equal(hash.digest('hex'), sha, dir + ' byte fingerprint');
  }
  return 'all 156 original simulation/save/render/content files remain byte-identical';
}
function originalSemantics() {
  const a = fixture(), s = a.sim;
  s.money = 16; at(s, X + 1).t = 0;
  const line = op('alley', X, Z, X + 2, Z), p = previewOp(s, line), r = commitOp(s, line, 0);
  assert.deepEqual(p.cells.map(c => c.cost), [8, 68, 8]); assert.equal(p.count, 3); assert.equal(p.total, 84);
  assert.equal(r.placed, 2); assert.equal(r.spent, 16); assert.deepEqual([at(s).road, at(s, X + 1).road, at(s, X + 2).road], [1, 0, 1]);
  clean(s); s.money = 60;
  const rect = op('park', X, Z, X + 1, Z); assert.equal(previewOp(s, rect).total, 120); assert.equal(commitOp(s, rect, 0).placed, 0); assert.equal(s.money, 60);
  clean(s); s.money = -.25; s.diff = 3;
  for (const id of ['alley', 'park', 'police']) { const q = op(id, X, Z); const p = previewOp(s, q); assert.equal(p.total, 0); assert.equal(p.affordable, true); assert.equal(commitOp(s, q, 0).placed, 0); }
  return 'original low-funds line builds cheap cell after refused bridge; rectangle all-or-nothing; negative-money sandbox refuses $0 despite original preview flag';
}
function toolGuides(api = Site) {
  const main = [['zr', '住宅分區', 'rect'], ['zc', '商業分區', 'rect'], ['zi', '工業分區', 'rect'], ['plant', '發電廠', 'tap'], ['doze', '拆除', 'rect']];
  for (const [id, name, gesture] of [...ROAD_TOOLS.map(t => [t.id, t.name, 'line']), ...CIVIC_TOOLS.map(t => [t.id, t.name, gestureOf(t.id)]), ...main]) {
    const g = api.selectedToolGuide(id);
    assert.equal(g.tool, id); assert.equal(g.name, name); assert.equal(g.gesture, gesture); assert.match(g.gestureLabel, gesture === 'line' ? /拉線/ : gesture === 'rect' ? /框選/ : /點放/);
    assert.ok(g.placement.length > 5); assert.ok(g.unit.length > 0);
    if (FACILITY_NOTES[id]) { assert.equal(g.placement, FACILITY_NOTES[id].placement); assert.equal(g.use, FACILITY_NOTES[id].use); }
  }
  assert.match(api.selectedToolGuide('megaproject').unit, /3×3/);
  return 'all 28 tools retain authoritative names and gestures; civic placement/use comes from D053 notes';
}
function selections(api = Site) {
  const f = fixture(), s = f.sim;
  at(s, X + 1).wp = 1; at(s, X + 2).t = 0; at(s, X + 3).ruin = 1; at(s, X + 4).crater = 1;
  at(s, X + 5).bld = { k: 3, lv: 1, v: 0, age: 0, pw: true, h: 1 };
  const operation = op('wpipe', X, Z, X + 5, Z), pv = previewOp(s, operation), p = api.diagnoseSite(s, operation, pv);
  assert.equal(p.day, s.day); assert.equal(p.name, '配水管'); assert.equal(p.selected, 6); assert.equal(p.eligible, 2); assert.equal(p.skipped, 4); assert.equal(p.footprint, 6); assert.equal(p.total, 20);
  assert.deepEqual(p.reasons, [{ reason: '已有水管', count: 1 }, { reason: '只能鋪在陸地上', count: 1 }, { reason: '焦土需先清理', count: 1 }, { reason: '隕石坑需先剷除', count: 1 }]);
  assert.deepEqual(p.cells.map(c => [c.x, c.z, c.ok, c.cost, c.foot]), pv.cells.map(c => [c.x, c.z, c.ok, c.cost, c.foot]));
  assert.notEqual(p.cells, pv.cells); assert.notEqual(p.cells[0], pv.cells[0], 'snapshot does not alias provided preview cells');
  const none = api.diagnoseSite(s, op('wpipe', X + 1, Z, X + 4, Z)); assert.equal(none.eligible, 0); assert.equal(none.skipped, 4); assert.equal(none.total, 0); assert.equal(none.reasons.length, 4);
  clean(s); at(s).zone = 1; const sameZone = api.diagnoseSite(s, op('zr', X, Z, X + 1, Z)); assert.equal(sameZone.eligible, 1); assert.equal(sameZone.total, 8); assert.deepEqual(sameZone.reasons, [{ reason: '已經是這一區', count: 1 }]);
  at(s).tree = 1; const treeZone = api.diagnoseSite(s, op('zr', X, Z)); assert.equal(treeZone.eligible, 1); assert.equal(treeZone.total, 2);
  clean(s); at(s).bld = { k: 1, lv: 2, v: 0, age: 0, pw: true, h: 1 }; at(s, X + 1).tree = 1;
  const protectedRect = api.diagnoseSite(s, op('doze', X, Z, X + 1, Z)); assert.equal(protectedRect.eligible, 1); assert.equal(protectedRect.total, 2); assert.deepEqual(protectedRect.reasons, [{ reason: '二級以上的建築要單獨拆', count: 1 }]);
  const single = api.diagnoseSite(s, op('doze', X, Z)); assert.equal(single.eligible, 1); assert.deepEqual(single.reasons, []);
  clean(s); const mega = api.diagnoseSite(s, op('megaproject', X, Z)); assert.equal(mega.selected, 1); assert.equal(mega.eligible, 1); assert.equal(mega.skipped, 0); assert.equal(mega.footprint, 9); assert.equal(mega.total, 4500); assert.equal(mega.cells.filter(c => c.foot).length, 8);
  at(s, X + 2, Z + 2).road = 1; const badMega = api.diagnoseSite(s, op('megaproject', X, Z)); assert.equal(badMega.selected, 1); assert.equal(badMega.eligible, 0); assert.equal(badMega.skipped, 1); assert.deepEqual(badMega.reasons, [{ reason: '交通線擋住', count: 1 }]);
  clean(s); const empty = api.diagnoseSite(s, op('wpipe', -3, -3)); assert.equal(empty.selected, 0); assert.equal(empty.eligible, 0); assert.equal(empty.total, 0);
  return 'mixed/none/same pipe/same zone/tree zone/protected Lv2 doze/outside; 3×3 footprint stays one job; provided preview is not mutated or aliased';
}
function finances(api = Site) {
  const f = fixture(), s = f.sim; at(s).tree = 1; s.edu.tech = ['B5', 'C8', 'D4a']; s.edu.spec = 'hub';
  const operation = op('park', X, Z), cost = 62 * .95 * .95 * .9 * 1.05;
  for (const funds of [cost, cost - .000001, cost + .000001, 0, -.25, 99999.1234567]) {
    s.money = funds; const d = api.diagnoseSite(s, operation);
    assert.equal(d.total, cost); assert.equal(d.funds, funds); assert.equal(d.shortfall, Math.max(0, cost - funds)); assert.equal(d.affordable, previewOp(s, operation).affordable); assert.equal(d.sandbox, false);
    for (const amount of [d.total, d.funds, d.shortfall]) assert.equal(Number(api.formatSiteMoney(amount).replace(/[^\d.eE+\-]/g, '')), amount, 'money display must round-trip exact represented amount');
  }
  s.diff = 3;
  for (const funds of [30, 0, -.25]) {
    s.money = funds; const d = api.diagnoseSite(s, operation); assert.equal(d.total, 0); assert.equal(d.funds, funds); assert.equal(d.shortfall, Math.max(0, -funds)); assert.equal(d.affordable, true); assert.equal(d.sandbox, true);
    if (funds < 0) assert.match(d.fundingNote, /負.*0/);
  }
  assert.match(api.diagnoseSite(s, op('park', X, Z, X + 1, Z)).policy, /整批/);
  const policy = api.diagnoseSite(s, op('alley', X, Z, X + 1, Z)).policy; assert.match(policy, /逐格/); assert.match(policy, /後.*便宜/); assert.doesNotMatch(policy, /連續前綴/);
  clean(s); at(s).zone = 1;
  for (const funds of [0, -.25]) { s.money = funds; const d = api.diagnoseSite(s, op('zc', X, Z)); assert.equal(d.total, 0, 'rezoning existing other zone is free'); assert.equal(d.eligible, 1); assert.equal(d.shortfall, Math.max(0, -funds)); assert.equal(d.affordable, funds >= 0); }
  return 'exact fractional discounts/tree cost/funds/shortfall and round-trip display; equality/$0/negative/sandbox truth; actual gesture policy';
}
function resourceStocks(api = Site) {
  const f = fixture(), s = f.sim, i = Z * s.w.N + X;
  for (const [id, kind] of [['oilwell', 1], ['mine', 2]]) for (const used of [0, 1, 237, 239, 240]) {
    clean(s); s.res.resource[i] = kind; s.res.rdep[i] = used;
    const operation = op(id, X, Z), d = api.diagnoseSite(s, operation); assert.equal(d.eligible, 1, 'depleted matching empty site remains legally buildable'); assert.equal(d.resources.length, 1);
    const r = d.resources[0]; assert.equal(r.remaining, 240 - used); assert.equal(r.capacity, 240); assert.equal(r.exhausted, used === 240); assert.equal(r.legal, true); assert.equal(r.kind, kind);
    if (used === 240) assert.match(r.warning, /仍可建.*不再產出/); else assert.equal(r.warning, '');
    const built = commitOp(s, operation, 0); assert.equal(built.placed, 1); assert.equal(s.res.rdep[i], used, 'placing never refills reserves');
    const dozed = commitOp(s, op('doze', X, Z), 100); assert.equal(dozed.placed, 1); const rebuilt = api.diagnoseSite(s, operation); assert.equal(rebuilt.resources[0].remaining, 240 - used); assert.equal(rebuilt.eligible, 1);
    assert.equal(commitOp(s, operation, 200).placed, 1); assert.equal(s.res.rdep[i], used);
  }
  clean(s); s.res.resource[i] = 2; s.res.rdep[i] = 240;
  assert.equal(api.diagnoseSite(s, op('oilwell', X, Z)).resources.length, 0, 'wrong resource cannot acquire exhaustion warning');
  for (const [id, wrong] of [['oilwell', 0], ['oilwell', 2], ['mine', 0], ['mine', 1]]) { s.res.resource[i] = wrong; const d = api.diagnoseSite(s, op(id, X, Z)); assert.equal(d.eligible, 0); assert.equal(d.resources.length, 0); }
  s.res.resource[i] = 1; const gas = api.diagnoseSite(s, op('gaswell', X, Z)); assert.equal(gas.eligible, 1); assert.equal(gas.resources.length, 0, 'gas does not consume RDEP');
  clean(s); s.res.resource[i] = 1; s.res.rdep[i] = 240; at(s).road = 1;
  const blocked = api.diagnoseSite(s, op('oilwell', X, Z)); assert.equal(blocked.eligible, 0); if (blocked.resources.length) { assert.equal(blocked.resources[0].legal, false); assert.doesNotMatch(blocked.resources[0].warning, /仍可建/); }
  return 'oil/ore fresh, partial, 1-unit and exhausted stocks; legal remove/rebuild never replenishes; wrong resource and gas excluded';
}
function results(api = Site) {
  const f = fixture(), s = f.sim; s.money = 16; at(s, X + 1).t = 0;
  const operation = op('alley', X, Z, X + 2, Z), before = api.diagnoseSite(s, operation), actual = commitOp(s, operation, 0), snapshot = stateBytes(before), result = api.diagnoseSiteResult(before, actual);
  assert.equal(result.day, before.day); assert.equal(result.completed, 2); assert.equal(result.unfinished, 1); assert.equal(result.spent, 16); assert.equal(result.selected, 3); assert.equal(result.eligible, 3); assert.equal(result.armed, false); assert.deepEqual(result.reasons, []); assert.match(result.summary, /完成.*2/); assert.match(result.summary, /未完成.*1/); assert.equal(stateBytes(before), snapshot);
  // Authoritative result values are deliberately distinct from the estimate.
  // No post-operation money is passed to, or may be inferred by, this function.
  const distinct = { ...actual, placed: 1, spent: .125, reason: '測試實際拒絕原因' }, d = api.diagnoseSiteResult(before, distinct); assert.equal(d.completed, 1); assert.equal(d.unfinished, 2); assert.equal(d.spent, .125); assert.equal(d.reason, distinct.reason);
  s.day++; s.money = 987654.125; assert.deepEqual(api.diagnoseSiteResult(before, actual), result, 'captured result is independent of later daily income and current funds');
  clean(s); s.money = 60; const rect = op('park', X, Z, X + 1, Z), p = api.diagnoseSite(s, rect), r = api.diagnoseSiteResult(p, commitOp(s, rect, 0)); assert.equal(r.completed, 0); assert.equal(r.unfinished, 2); assert.equal(r.spent, 0); assert.match(r.reason, /資金不足/);
  clean(s); at(s, X + 1).wp = 1; at(s, X + 2).t = 0; const mix = op('wpipe', X, Z, X + 2, Z), m = api.diagnoseSite(s, mix), mr = api.diagnoseSiteResult(m, commitOp(s, mix, 0)); assert.equal(mr.completed, 1); assert.equal(mr.unfinished, 2); assert.deepEqual(mr.reasons, m.reasons); assert.equal(mr.reason, undefined); assert.notEqual(mr.reasons, m.reasons);
  clean(s); at(s).bld = { k: 1, lv: 2, v: 0, age: 0, pw: true, h: 1 }; const doze = op('doze', X, Z), pre = api.diagnoseSite(s, doze), armed = api.diagnoseSiteResult(pre, commitOp(s, doze, 100)); assert.equal(armed.armed, true); assert.equal(armed.completed, 0); assert.equal(armed.spent, 0); assert.match(armed.summary, /確認/);
  const done = api.diagnoseSiteResult(api.diagnoseSite(s, doze), commitOp(s, doze, 200)); assert.equal(done.armed, false); assert.equal(done.completed, 1);
  clean(s); at(s).bld = { k: 1, lv: 2, v: 0, age: 0, pw: true, h: 1 };
  const firstArm = api.diagnoseSiteResult(api.diagnoseSite(s, doze), commitOp(s, doze, 0)); assert.match(firstArm.summary, /當次.*3秒內.*同格.*逾時重新確認/);
  const expired = api.diagnoseSiteResult(api.diagnoseSite(s, doze), commitOp(s, doze, 4000)); assert.equal(expired.armed, true); assert.equal(expired.completed, 0); assert.match(expired.summary, /當次.*逾時重新確認/);
  clean(s); assert.equal(commitOp(s, op('megaproject', X, Z), 0).placed, 1);
  const footprintDoze = op('doze', X, Z, X + 2, Z + 2), footprintBefore = api.diagnoseSite(s, footprintDoze); assert.equal(footprintBefore.groupedDemolition, true); assert.equal(footprintBefore.selected, 9); assert.equal(footprintBefore.eligible, 9); assert.equal(footprintBefore.total, 18);
  const footprintActual = commitOp(s, footprintDoze, 100), footprintResult = api.diagnoseSiteResult(footprintBefore, footprintActual); assert.equal(footprintActual.placed, 1); assert.equal(footprintActual.spent, 2); assert.equal(footprintResult.completed, 1); assert.equal(footprintResult.unfinished, null); assert.match(footprintResult.summary, /實際拆除 1 次.*\$2.*原選區 9 格.*同棟佔地/); assert.doesNotMatch(footprintResult.summary, /未完成/);
  clean(s); at(s).bld = { k: 1, lv: 2, v: 0, age: 0, pw: true, h: 1 }; at(s, X + 1).tree = 1; const protectedOp = op('doze', X, Z, X + 1, Z), bp = api.diagnoseSite(s, protectedOp), br = api.diagnoseSiteResult(bp, commitOp(s, protectedOp, 300)); assert.equal(br.protectedSkipped, 1); assert.deepEqual(br.reasons, bp.reasons);
  return 'result reports actual placed/spent/reason/armed/protected skip; preserves original mixed reasons and captured day; no total-money inference';
}
function sewerNetworks(api = Site) {
  const f = fixture(), s = f.sim, operation = op('sewage', X, Z);
  at(s, X - 1, Z - 1).t = 0; at(s, X + 1, Z - 1).t = 0;
  const empty = api.diagnoseSite(s, operation); assert.equal(empty.eligible, 1); assert.equal(empty.network.touching, 0);
  assert.match(empty.network.note, /未.*管網/); assert.match(empty.network.note, /鄰水/);
  at(s, X - 1, Z).wp = 1;
  const pipe = api.diagnoseSite(s, operation); assert.equal(pipe.eligible, 1); assert.equal(pipe.network.touching, 1); assert.match(pipe.network.note, /貼.*管網/); assert.match(pipe.network.note, /不.*保證|仍需/); assert.match(pipe.network.note, /90/);
  assert.doesNotMatch(pipe.network.note, /已供應|已供水|已處理|當日已/);
  at(s, X + 1, Z).sm472 = 1;
  const two = api.diagnoseSite(s, operation); assert.equal(two.network.touching, 2, 'separate sewage-main component counts too');
  at(s).wp = 1; const linked = api.diagnoseSite(s, operation); assert.equal(linked.network.touching, 1, 'same connected component is not counted three times');
  const components = pipeComponents(s.w); assert.equal(linked.network.components, components.n); assert.equal(linked.network.touching, facilityComps(s.w, components.comp, Z * s.w.N + X, 1).length);
  at(s).wp = 0; at(s, X - 1, Z).wp = 0; at(s, X + 1, Z).sm472 = 0; at(s, X + 1, Z + 1).wp = 1;
  assert.equal(api.diagnoseSite(s, operation).network.touching, 0, 'corner contact alone is not authoritative facility contact');
  assert.equal(api.diagnoseSite(s, op('water', X, Z)).network, undefined, 'water does not silently claim sewage network service');
  return 'same legal shoreline with disconnected, touching, two networks, connected identity, sewer-main and corner-only cases; no service/past-day promise';
}
function compile(source = read('src/ui/siteDiagnostics.ts'), override = {}) {
  const dependencies = { CIVIC_TOOLS, ROAD_TOOLS, gestureOf, toolSize, previewOp, DOZE_ARM_MS, RESOURCE_STOCK, RES_OIL, RES_ORE, FACILITY_NOTES, pipeComponents, facilityComps, WATER_HOPS472, ...override };
  return new Function(...Object.keys(dependencies), strip(source) + ';return {selectedToolGuide,diagnoseSite,diagnoseSiteResult,formatSiteMoney};')(...Object.values(dependencies));
}
function authoritativeQueries() {
  const f = fixture(), s = f.sim; at(s, X + 1).wp = 1; at(s, X + 2).t = 0;
  const operation = op('wpipe', X, Z, X + 3, Z), p = previewOp(s, operation), calls = [], networks = [];
  const api = compile(undefined, { previewOp: (sim, q) => { calls.push(q); return previewOp(sim, q); }, pipeComponents: w => { networks.push(w); return pipeComponents(w); } });
  api.diagnoseSite(s, operation, p); assert.equal(calls.length, 2, 'provided preview used directly; only omitted failed reasons need extra reads');
  assert.ok(calls.every(q => q.x0 === q.x1 && q.z0 === q.z1)); assert.deepEqual(calls.map(q => q.x0), [X + 1, X + 2]); assert.equal(networks.length, 0);
  calls.length = 0; api.diagnoseSite(s, operation); assert.equal(calls.length, 3, 'one original preview plus only rejected cell reason lookups');
  clean(s); at(s, X - 1, Z - 1).t = at(s, X + 1, Z - 1).t = 0;
  api.diagnoseSite(s, op('sewage', X, Z)); assert.equal(networks.length, 1, 'one pure current-network computation for sewage site');
  return 'original count/ok/cost consumed directly; only rejected roots re-previewed for reason; one current sewer-component query only for sewage';
}
function inspect(f, api = Site) {
  for (const id of [...ROAD_TOOLS.map(t => t.id), ...CIVIC_TOOLS.map(t => t.id), 'zr', 'zc', 'zi', 'plant', 'doze']) {
    api.selectedToolGuide(id);
    const operation = op(id, X, Z, X + (gestureOf(id) === 'tap' ? 0 : 3), Z), p = previewOp(f.sim, operation);
    const a = api.diagnoseSite(f.sim, operation), b = api.diagnoseSite(f.sim, operation, p); assert.deepEqual(a, b, 'optional authoritative preview equivalent');
    api.diagnoseSiteResult(a, { ok: false, placed: 0, spent: 0, events: [], reason: '尚未施工' });
    api.formatSiteMoney(a.total); api.formatSiteMoney(a.funds); api.formatSiteMoney(a.shortfall);
  }
}
function purity(api = Site) {
  const f = fixture(), s = f.sim, calls = instrumentRng(s), defs = stateBytes({ CIVIC_TOOLS, ROAD_TOOLS, FACILITY_NOTES });
  for (const [money, diff] of [[10000, 1], [0, 1], [-.25, 1], [0, 3], [-.25, 3]]) {
    s.money = money; s.diff = diff; const model = raw(f), code = saved(f), rng = stateBytes(calls);
    inspect(f, api); inspect(f, api); assert.equal(raw(f), model, 'queries cannot mutate any nested simulation value'); assert.equal(saved(f), code, 'queries cannot alter exact save bytes'); assert.equal(stateBytes(calls), rng, 'queries cannot call either RNG API');
  }
  assert.equal(stateBytes({ CIVIC_TOOLS, ROAD_TOOLS, FACILITY_NOTES }), defs, 'queries cannot mutate imported metadata');
  const operation = op('wpipe', X, Z, X + 3, Z), p = previewOp(s, operation), code = stateBytes(p);
  p.cells.forEach(Object.freeze); Object.freeze(p.cells); Object.freeze(p); Object.freeze(operation);
  const d = api.diagnoseSite(s, operation, p); assert.equal(stateBytes(p), code); d.cells[0].cost = -123; assert.equal(stateBytes(p), code, 'result does not retain mutable preview cell aliases');
  return 'five finances/modes × 28 tool queries twice; full model/typed arrays/Map/Set/save/RNG/metadata unchanged; frozen inputs and returned snapshot isolation';
}
function pairedCommits(api = Site) {
  const scenarios = [
    ['mixed pipe', 'wpipe', (s) => { at(s, X + 1).wp = 1; at(s, X + 2).t = 0; }, X + 3],
    ['none eligible', 'wpipe', (s) => { for (let x = X; x <= X + 3; x++) at(s, x).wp = 1; }, X + 3],
    ['same zone', 'zr', s => { at(s).zone = 1; }, X + 2],
    ['protected Lv2 demolition', 'doze', s => { at(s).bld = { k: 1, lv: 2, v: 0, age: 0, pw: true, h: 1 }; at(s, X + 1).tree = 1; }, X + 1],
    ['cheap after bridge', 'alley', s => { at(s, X + 1).t = 0; s.money = 16; }, X + 2],
    ['poor rectangle', 'park', s => { s.money = 60; }, X + 1],
    ['exact discounted money', 'park', s => { at(s).tree = 1; s.edu.tech = ['B5', 'C8', 'D4a']; s.edu.spec = 'hub'; s.money = 62 * .95 * .95 * .9 * 1.05; }, X],
    ['negative normal', 'wpipe', s => { s.money = -.25; }, X + 1],
    ['negative sandbox', 'park', s => { s.money = -.25; s.diff = 3; }, X + 1],
    ['free sandbox', 'park', s => { s.money = 0; s.diff = 3; }, X + 1],
    ['exhausted oil', 'oilwell', s => { const i = Z * s.w.N + X; s.res.resource[i] = 1; s.res.rdep[i] = 240; }, X],
    ['exhausted ore', 'mine', s => { const i = Z * s.w.N + X; s.res.resource[i] = 2; s.res.rdep[i] = 240; }, X],
    ['one-project footprint', 'megaproject', () => {}, X],
    ['grouped footprint demolition', 'doze', s => { assert.equal(commitOp(s, op('megaproject', X, Z), 0).placed, 1); }, X + 2, Z + 2],
  ];
  for (const [name, id, setup, end, endZ = Z] of scenarios) {
    const a = fixture(), b = fixture(); setup(a.sim); setup(b.sim); const ar = instrumentRng(a.sim), br = instrumentRng(b.sim), operation = op(id, X, Z, end, endZ);
    same(a, b, ar, br, name + ' start'); const pre = api.diagnoseSite(a.sim, operation); inspect(a, api); same(a, b, ar, br, name + ' after candidate-only queries');
    const actual = commitOp(a.sim, operation, 123), original = commitOp(b.sim, operation, 123); assert.deepEqual(actual, original); same(a, b, ar, br, name + ' commit');
    api.diagnoseSiteResult(pre, actual); inspect(a, api); same(a, b, ar, br, name + ' result queries');
    assert.deepEqual(undoOp(a.sim), undoOp(b.sim)); same(a, b, ar, br, name + ' undo');
  }
  return scenarios.length + ' original/no-query versus candidate/query real commit + result + undo pairs with exact cost/state/history/save/RNG';
}
function trajectories(api = Site) {
  const factories = [() => d044Load(), () => d045Load({ rk: 25, tech343: { act: 'A1', prog: { A1: 5 }, done: [] } }, 10000), () => d045Load({ rk: 20, df: 3 }, 10000)];
  let days = 0;
  for (const make of factories) {
    const a = make(), b = make(), ar = instrumentRng(a.sim), br = instrumentRng(b.sim); same(a, b, ar, br, 'trajectory origin');
    for (let day = 0; day < 12; day++) {
      inspect(a, api); same(a, b, ar, br, 'candidate-only queries before day ' + day);
      if (day % 3 === 0) {
        const operation = op(day % 6 === 0 ? 'wpipe' : 'zr', X, Z + (day / 3), X + 2, Z + (day / 3));
        const before = api.diagnoseSite(a.sim, operation), candidate = commitOp(a.sim, operation, day * 1000), original = commitOp(b.sim, operation, day * 1000);
        assert.deepEqual(candidate, original, 'trajectory actual commit ' + day); api.diagnoseSiteResult(before, candidate); same(a, b, ar, br, 'trajectory committed history ' + day);
        if (day === 3) { assert.deepEqual(undoOp(a.sim), undoOp(b.sim)); same(a, b, ar, br, 'trajectory same-day undo'); }
      }
      assert.deepEqual(stepDay(a.sim), stepDay(b.sim), 'uninterrupted exact report day ' + day); same(a, b, ar, br, 'end day ' + day); days++;
    }
    const code = saved(a), loaded = loadCode(code, a.KT, a.vrank); assert.ok(loaded.ok, 'terminal save remains loadable'); assert.equal(loaded.sim.day, a.sim.day); assert.equal(loaded.sim.rankIdx, a.sim.rankIdx);
  }
  return days + ' uninterrupted original/candidate paired days across ordinary, active-research and sandbox cities with interleaved commits/undo; all reports/state/history/save/RNG equal';
}
// Every mutant must fail an assertion after the unmodified checker succeeds;
// parse errors, runtime errors and missing dependencies do not count as kills.
function mutations() {
  toolGuides(); selections(); finances(); resourceStocks(); results(); sewerNetworks(); purity();
  const source = read('src/ui/siteDiagnostics.ts');
  const cases = [
    ['civic placement text detached from D053', 'placement: note?.placement ??', "placement: (tool === 'sewage' ? '任何陸地都可以' : note?.placement) ??", toolGuides],
    ['nine-cell megaproject counted as nine jobs', 'selected = roots.length', 'selected = cells.length', selections],
    ['eligible count changes original preview', 'eligible: pv.count', 'eligible: pv.count + 1', selections],
    ['mixed rejected reasons discarded', 'if (c.ok || c.foot) return { ...c };', 'if (true) return { ...c };', selections],
    ['single-cell authoritative reason ignored', 'const reason = single.reason ??', 'const reason = undefined ??', selections],
    ['protected doze context misrepresented', "? '二級以上的建築要單獨拆'", "? '資金不足'", selections],
    ['precision rounded out of preview total', 'total: pv.total, funds:', 'total: Math.round(pv.total), funds:', finances],
    ['negative funds clamped away', 'Math.max(0, pv.total - s.money)', 'Math.max(0, pv.total - Math.max(0, s.money))', finances],
    ['money display rounds exact fractions', 'const text = String(value);', 'const text = String(Math.round(value));', finances],
    ['original sandbox affordable flag overridden', 'affordable: pv.affordable', 'affordable: pv.total <= s.money', finances],
    ['exhaustion reset to initial stock', 'Math.max(0, RESOURCE_STOCK - s.res.rdep[i])', 'RESOURCE_STOCK', resourceStocks],
    ['gas falsely consumes finite oil reserves', "op.tool === 'oilwell' ? RES_OIL", "(op.tool === 'oilwell' || op.tool === 'gaswell') ? RES_OIL", resourceStocks],
    ['blocked exhausted site falsely called legal', "warning: exhausted ? (c.ok ?", "warning: exhausted ? (true ?", resourceStocks],
    ['current sewage contact always zero', 'const touching = facilityComps', 'const touching = 0 * facilityComps', sewerNetworks],
    ['completed count inferred from preview', 'const completed = result.placed,', 'const completed = before.eligible,', results],
    ['actual expense replaced by estimate', 'spent = result.spent;', 'spent = before.total;', results],
    ['actual result erases mixed reasons', 'reasons: before.reasons.map(r => ({ ...r })),', 'reasons: [],', results],
    ['result loses protected demolition count', 'protectedSkipped: result.skipped ?? 0', 'protectedSkipped: 0', results],
    ['multi-cell demolition invents unfinished cells', 'unfinished = before.groupedDemolition ? null :', 'unfinished = false ? null :', results],
    ['expired demolition record implies live confirmation', '當次進入拆除準備；須在${DOZE_ARM_MS / 1000}秒內再次點同格，逾時重新確認', '請再次點選確認', results],
    ['captured result day changed', 'day: before.day, tool:', 'day: before.day + 1, tool:', results],
    ['diagnostic charges funds', 'const pv = providedPreview ??', 's.money--; const pv = providedPreview ??', purity],
    ['diagnostic consumes simulation RNG', 'const pv = providedPreview ??', 's.rng.R(); const pv = providedPreview ??', purity],
  ];
  for (const [name, from, to, check] of cases) {
    const api = compile(change(source, from, to));
    assert.throws(() => check(api), error => error?.code === 'ERR_ASSERTION', name + ' must fail a behavioral assertion');
  }
  return cases.length + ' executable guidance/count/reason/finance/resource/network/result/state/RNG mutations rejected by behavior';
}
export function d054Guards(log, match = '') {
  const tests = [['original 156-file byte scope', originalScope], ['original authoritative baseline semantics', originalSemantics], ['selected tool names and D053 guidance', toolGuides], ['mixed selection reasons and megaproject counting', selections], ['exact finances and operation policy', finances], ['finite oil/ore reserves and legal exhausted rebuild', resourceStocks], ['actual result diagnostics preserve captured reasons', results], ['current sewage contact distinct from water placement', sewerNetworks], ['authoritative preview and pure query call boundaries', authoritativeQueries], ['deep query purity and snapshot isolation', purity], ['real paired commit undo history save RNG', pairedCommits], ['36 uninterrupted paired day trajectories', trajectories], ['behavior mutation sensitivity', mutations]];
  if (match && !tests.some(([name]) => name.includes(match))) { log(false, 'D054 test selection', 'No test matched: ' + match); return; }
  for (const [name, fn] of tests) if (!match || name.includes(match)) try { assert.ok(Site || name.startsWith('original'), 'before-image gate has not released product implementation'); log(true, 'D054 ' + name, fn()); } catch (error) { log(false, 'D054 ' + name, error.stack); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let bad = 0; d054Guards((ok, name, detail) => { console.log(ok ? 'OK' : 'NG', name, detail ?? ''); if (!ok) bad++; }, process.argv[2] === '--baseline' ? 'original' : process.argv[2] ?? ''); process.exitCode = bad ? 1 : 0;
}

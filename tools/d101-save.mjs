// D101 第二步守衛：運輸施工的世界歷史、存檔與重播（卡 docs/D101-transit-save-and-ui.md；transit.yml 會跑）。
// 涵蓋凍結的驗收 1、2、3、7、13、15、16（模擬部分）、17，加上碼 26 的黃金列、每個切點的 packMore、hv1／hv2／hv3 的續寫、
// 重播與逐筆呼叫 network.ts 的隨機差分（含軌道上限 8192 的邊界），以及突變控制（突變都載入 /dev/shm 底下改過的 src 副本，不動倉庫的檔）。
// 施工（edit.ts）是第三步，這裡的運輸事件全部由真的 network.ts 呼叫產生（tx() 照第三步的規格：資金取整、沙盒費用 0、拆除 0、
// 先 g＝stroke++ 再記恰好一筆事件；復原＝restoreTransit＋退費＋一列 undo），再交給 history.ts／journal.ts／save.ts。
// 驗收 1 的黃金樣本 fixtures/d101/no-transit-saves.json：同一套情境在 main 76e074f 的 src（git archive 解到暫存目錄）上跑出來的存檔雜湊；
// 每次執行都拿現行 src 比，也從 git 重算一次 76e074f 比（transit.yml 是 fetch-depth 0）。
// 用法：node tools/d101-save.mjs（全部）｜node tools/d101-save.mjs --freeze（從 76e074f 產生黃金樣本；已存在且不同就拒絕）
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = '76e074ff66f01e5e0ced8c946b13584226f0d6b6';
const FIXTURE = 'fixtures/d101/no-transit-saves.json';
const MAX = Number.MAX_SAFE_INTEGER;
const sha = s => createHash('sha256').update(s).digest('hex');
const J = v => JSON.stringify(v);
const copy = v => JSON.parse(JSON.stringify(v));
const SCRATCH = (() => { try { fs.accessSync('/dev/shm', fs.constants.W_OK); return '/dev/shm'; } catch { return os.tmpdir(); } })();
const scratchDir = tag => fs.mkdtempSync(path.join(SCRATCH, `d101-save-${tag}-`));
const mulberry = seed => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---- 模組組：同一個根目錄底下的 src（現行、突變副本）一起載入，彼此接在一起 ----
async function api(root) {
  const im = rel => import(pathToFileURL(path.join(root, rel)).href);
  const [save, labcode, journal, replay, city, registry, day, edit, network, format, history, kt] = await Promise.all([
    'src/io/save.ts', 'src/io/labcode.ts', 'src/io/journal.ts', 'src/sim/replay.ts', 'src/sim/city.ts', 'src/sim/eventRegistry.ts', 'src/sim/day.ts',
    'src/sim/edit.ts', 'src/sim/transit/network.ts', 'src/sim/transit/format.ts', 'src/sim/transit/history.ts', 'src/content/kindTable.ts'].map(im));
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  const KT = kt.kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  return { root, save, labcode, journal, replay, city, registry, day, edit, network, format, history, KT, vrank, sample: name => read(`src/content/samples/${name}.code.txt`).trim() };
}
const loadOk = (A, code, j) => { const L = A.save.loadCode(code, A.KT, A.vrank, j); if (!L.ok) throw new Error('讀檔失敗：' + L.error); return L; };
const rawOf = (A, code) => { const r = A.labcode.decodeLabCode(code); assert.ok(r.ok, r.error); return r.save.raw; };
const recode = (A, raw) => { const o = copy(raw); delete o.z; return A.labcode.encodeLabCode(o, { deflate: true }); };
const netJ = (A, net) => J(A.format.serializeNetwork(net));

// ---- 照第三步規格的施工（只用 network.ts 與 history.ts；不碰 edit.ts）----
function tx(A, s, op, a, { sandbox = false } = {}) {
  const N = A.network, c = s.city, before = c.transit, net = before ?? N.createNetwork(), terrain = A.history.transitTerrain(c, true);
  const funds = sandbox ? MAX : Math.min(Math.floor(s.money), MAX);
  let r, item;
  if (op === 'edge') { r = N.buildTrack(net, terrain, a.mode, { x: a.x, z: a.z, height: a.h }, { x: a.x2, z: a.z2, height: a.h2 }, funds); item = r.ok && r.network.edges.at(-1); }
  else if (op === 'station') { r = N.buildStation(net, terrain, a.mode, a.x, a.z, a.h, funds); item = r.ok && r.network.stations.at(-1); }
  else if (op === 'depot') { r = N.buildDepot(net, terrain, a.mode, a.x, a.z, a.h, funds); item = r.ok && r.network.depots.at(-1); }
  else {
    const list = op === 'del-edge' ? net.edges : op === 'del-station' ? net.stations : net.depots;
    item = list.find(q => q.id === a.id);
    r = (op === 'del-edge' ? N.removeEdge : op === 'del-station' ? N.removeStation : N.removeDepot)(net, a.id, funds);
  }
  if (!r.ok) return { ok: false, reason: r.reason };
  const cost = sandbox ? 0 : funds - r.money;
  s.money -= cost;
  const g = s.stroke++;
  c.history.push(A.history.transitEventOf(s.day, op, item, cost, g));
  c.transit = r.network;
  return { ok: true, g, before, cost, id: item.id };
}
function txUndo(A, s, t) {
  s.money += t.cost;
  s.city.history.push({ day: s.day, t: 'undo', g: t.g, refund: t.cost });
  s.city.transit = A.history.restoreTransit(s.city.transit, t.before);
}
// 第一個成功的施工（候選照格索引順序，決定性）
function first(A, s, op, cands, opts) {
  for (const a of cands) { const r = tx(A, s, op, a, opts); if (r.ok) return { ...r, a }; }
  throw new Error(`找不到可以施工的 ${op}`);
}
function edgeCands(A, c, want) {
  const T = A.history.transitTerrain(c, true), n = c.n, out = [];
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) for (const [dx, dz] of [[1, 0], [0, 1]]) {
    const x2 = x + dx, z2 = z + dz; if (x2 >= n || z2 >= n) continue;
    const p = T.cell(x, z), q = T.cell(x2, z2);
    if (want(p, q, x, z)) out.push({ x, z, h: p.elevation, x2, z2, h2: q.elevation });
  }
  return out;
}
function boxCands(A, c, w, d) {
  const T = A.history.transitTerrain(c, true), n = c.n, out = [];
  for (let z = 0; z + d <= n; z++) for (let x = 0; x + w <= n; x++) {
    const e = T.cell(x, z).elevation; let ok = true;
    for (let dz = 0; dz < d && ok; dz++) for (let dx = 0; dx < w; dx++) { const q = T.cell(x + dx, z + dz); if (q.occupied || q.water || q.elevation !== e) { ok = false; break; } }
    if (ok) out.push({ x, z, h: e });
  }
  return out;
}

// 一座蓋了運輸的城：newcity＋各種施工（陸上、坡、水上、地鐵、站、廠、沙盒、拆、復原），中間跨日、夾格子的施工與復原
function transitCity(A, { days = true } = {}) {
  const L = loadOk(A, A.sample('newcity')), s = L.sim, c = s.city; s.money = 50000.75;   // 帶小數的資金：費用照 floor 後的差扣
  const land = (p, q) => !p.occupied && !q.occupied && !p.water && !q.water;
  const flat = edgeCands(A, c, (p, q) => land(p, q) && p.elevation === q.elevation);
  const slope = edgeCands(A, c, (p, q) => land(p, q) && p.elevation !== q.elevation);
  const wet = edgeCands(A, c, (p, q) => !p.occupied && !q.occupied && p.water !== q.water);
  const T = [];
  T.push(first(A, s, 'edge', flat.map(a => ({ ...a, mode: 'rail' }))));
  T.push(first(A, s, 'edge', slope.map(a => ({ ...a, mode: 'rail' }))));
  T.push(first(A, s, 'edge', flat.slice(40).map(a => ({ ...a, mode: 'tram' }))));
  T.push(first(A, s, 'edge', wet.map(a => ({ ...a, mode: 'rail' }))));
  T.push(first(A, s, 'edge', [{ x: 40, z: 40, h: -1, x2: 41, z2: 40, h2: -1, mode: 'metro' }]));
  T.push(first(A, s, 'station', boxCands(A, c, 2, 1).slice(10).map(a => ({ ...a, mode: 'rail' }))));
  T.push(first(A, s, 'depot', boxCands(A, c, 3, 2).slice(5).map(a => ({ ...a, mode: 'tram' }))));
  T.push(first(A, s, 'station', [{ x: 30, z: 50, h: -1, mode: 'metro' }]));
  T.push(first(A, s, 'edge', flat.slice(200).map(a => ({ ...a, mode: 'rail' })), { sandbox: true }));
  if (days) { A.day.stepDay(s); A.day.stepDay(s); }
  const road = A.edit.commitOp(s, { k: 'line', tool: 'road', x0: 10, z0: 60, x1: 14, z1: 60 }, 1000);
  T.push(first(A, s, 'edge', [{ x: 41, z: 40, h: -1, x2: 42, z2: 40, h2: -1, mode: 'metro' }]));
  if (road.ok) A.edit.undoOp(s);                                       // 格子的復原夾在運輸施工之後
  T.push(first(A, s, 'del-edge', [{ id: T[4].id }]));                  // 拆地鐵軌道
  T.push(first(A, s, 'del-depot', [{ id: T[6].id }]));                 // 拆車廠（沒有軌道連著）
  const tmp = first(A, s, 'edge', flat.slice(300).map(a => ({ ...a, mode: 'tram' })));
  txUndo(A, s, tmp);                                                    // 復原蓋（退費、nextId 不倒退）
  const del = first(A, s, 'del-station', [{ id: T[7].id }]);
  txUndo(A, s, del);                                                    // 復原拆（車站回到原位）
  T.push(first(A, s, 'depot', boxCands(A, c, 3, 2).slice(30).map(a => ({ ...a, mode: 'rail' }))));
  if (days) A.day.stepDay(s);
  return { L, s, T };
}

// ---- 黃金列（碼 26／格式 12）：事件的 h 是高度、車站物件的 h 是深度，挑高度≠深度的例子 ----
const GOLDEN_EVENTS = [
  { day: 3, t: 'transit', op: 'edge', id: 1, mode: 'rail', x: 10, z: 4, h: 0, x2: 11, z2: 4, h2: 1, cost: 10, g: 5 },
  { day: 3, t: 'transit', op: 'station', id: 2, mode: 'tram', x: 20, z: 7, h: 0, x2: 21, z2: 7, h2: 0, cost: 120, g: 6 },
  { day: 4, t: 'transit', op: 'depot', id: 3, mode: 'metro', x: 30, z: 9, h: -1, x2: 32, z2: 10, h2: -1, cost: 300, g: 8 },
  { day: 4, t: 'undo', g: 8, refund: 300 },
  { day: 4, t: 'transit', op: 'edge', id: 4, mode: 'metro', x: 5, z: 5, h: -1, x2: 5, z2: 6, h2: -1, cost: 0, g: 9 },
  { day: 9, t: 'transit', op: 'del-edge', id: 1, mode: 'rail', x: 10, z: 4, h: 0, x2: 11, z2: 4, h2: 1, cost: 0, g: 10 },
  { day: 9, t: 'transit', op: 'del-station', id: 2, mode: 'tram', x: 20, z: 7, h: 0, x2: 21, z2: 7, h2: 0, cost: 0, g: 11 },
  { day: 12, t: 'transit', op: 'del-depot', id: 3, mode: 'metro', x: 30, z: 9, h: -1, x2: 32, z2: 10, h2: -1, cost: 0, g: 11 },
];
const GOLDEN_ROWS = [
  [26, 3, 0, 1, 0, 10, 4, 0, 11, 4, 1, 10, 5],
  [26, 0, 1, 2, 1, 20, 7, 0, 21, 7, 0, 120, 1],
  [26, 1, 2, 3, 2, 30, 9, -1, 32, 10, -1, 300, 2],
  [7, 0, 0, 300],
  [26, 0, 0, 4, 2, 5, 5, -1, 5, 6, -1, 0, 1],
  [26, 5, 3, 1, 0, 10, 4, 0, 11, 4, 1, 0, 1],
  [26, 0, 4, 2, 1, 20, 7, 0, 21, 7, 0, 0, 1],
  [26, 3, 5, 3, 2, 30, 9, -1, 32, 10, -1, 0, 0],
];
// 解不開的列（n＝72）：每一種都要丟例外
const T0 = [26, 0, 0, 1, 0, 10, 4, 0, 11, 4, 0, 10, 1];
const BAD_ROWS = [
  ['操作碼 6（碼表外）', r => { r[2] = 6; }], ['操作碼 −1', r => { r[2] = -1; }], ['模式碼 3', r => { r[4] = 3; }], ['模式碼字串', r => { r[4] = 'rail'; }],
  ['編號 0', r => { r[3] = 0; }], ['編號 2^31', r => { r[3] = 2 ** 31; }], ['編號 1.5', r => { r[3] = 1.5; }],
  ['x＝n', r => { r[5] = 72; r[8] = 73; }], ['z 負的', r => { r[6] = -1; r[9] = -1; }], ['h −2', r => { r[7] = -2; }], ['h2 256', r => { r[7] = 255; r[10] = 256; }],
  ['費用 −1', r => { r[11] = -1; }], ['費用 1.5', r => { r[11] = 1.5; }], ['拆除費用 10', r => { r[2] = 3; r[11] = 10; }],
  ['軌道不相鄰', r => { r[8] = 12; }], ['軌道沒排序', r => { r[5] = 11; r[8] = 10; }], ['軌道高度差 2', r => { r[7] = 0; r[10] = 2; }], ['地鐵在地面', r => { r[4] = 2; }],
  ['車站 3×1', r => { r[2] = 1; r[8] = 12; r[10] = 0; }], ['車站 h≠h2', r => { r[2] = 1; r[8] = 11; r[9] = 4; r[10] = 1; }], ['車廠 2×2', r => { r[2] = 2; r[8] = 11; r[9] = 5; r[10] = 0; }],
  ['地下車站在地面層', r => { r[2] = 1; r[4] = 2; r[10] = 0; }], ['欄位太多', r => { r.push(0); }], ['欄位太少', r => { r.pop(); }],
];

// ---- 共用檢查（現行 src 要全過；每一種突變副本至少有一項要紅）----
function coreChecks(A) {
  const out = [];
  const check = (name, fn) => { try { out.push([true, name, fn()]); } catch (e) { out.push([false, name, `${e.name}: ${e.message}`.slice(0, 400)]); } };
  const { save: S, registry: R, city: C, journal: JR, history: H, format: F } = A;

  check('登記：CITY_FORMAT 12、碼 26＝transit（格式 12、11 欄）、碼 27 未登記；兩張碼表的字面量只往後加', () => {
    assert.equal(R.CITY_FORMAT, 12); assert.equal(Object.keys(R.EVENT_REGISTRY).length, 27);
    assert.equal(J([R.EVENT_REGISTRY.transit.code, R.EVENT_REGISTRY.transit.format, R.EVENT_REGISTRY.transit.fields]), J([26, 12, ['op', 'id', 'mode', 'x', 'z', 'h', 'x2', 'z2', 'h2', 'cost', 'g']]));
    assert.equal(R.EVENT_BY_CODE[25], 'hasten'); assert.equal(R.EVENT_BY_CODE[26], 'transit'); assert.equal(R.EVENT_BY_CODE[27], undefined);
    assert.equal(J(C.TRANSIT_OPS), J(['edge', 'station', 'depot', 'del-edge', 'del-station', 'del-depot'])); assert.equal(J(C.TRANSIT_MODES), J(['rail', 'tram', 'metro']));
    assert.equal(C.CITY_MODEL_FORMAT, 10, '城市模型版本不動');
    for (const e of GOLDEN_EVENTS.filter(q => q.t === 'transit')) { assert.equal(R.minimumEventFormat(e), 12); assert.equal(R.eventFormat(e), 12); }
    return '27 種；碼 26／格式 12；碼表 6＋3 個';
  });

  check('碼 26 的黃金列：packHistory 逐列相同、unpackHistory／checkHistory 解回原事件、每個切點接續編碼相同、historyFormat 12', () => {
    assert.equal(J(S.packHistory(GOLDEN_EVENTS)), J(GOLDEN_ROWS));
    assert.equal(J(S.unpackHistory(copy(GOLDEN_ROWS), 72)), J(GOLDEN_EVENTS));
    assert.equal(J(S.checkHistory(copy(GOLDEN_EVENTS), 72)), J(GOLDEN_EVENTS));
    for (let k = 0; k <= GOLDEN_EVENTS.length; k++) { const a = JR.packMore(GOLDEN_EVENTS.slice(0, k), JR.PACK0); assert.equal(J([...a.rows, ...JR.packMore(GOLDEN_EVENTS, a.st).rows]), J(GOLDEN_ROWS), `切點 ${k}`); }
    const seen = []; assert.equal(S.historyFormat(seen), 4); seen.push(GOLDEN_EVENTS[3]); assert.equal(S.historyFormat(seen), 4); seen.push(GOLDEN_EVENTS[0]); assert.equal(S.historyFormat(seen), 12);
    return `${GOLDEN_ROWS.length} 列、${GOLDEN_EVENTS.length + 1} 個切點`;
  });

  check('解不開的運輸列：碼表外、編號、座標、高度、費用、形狀、欄數都擋下（照樣講是第幾筆）', () => {
    assert.equal(J(S.unpackHistory([T0], 72)), J([{ day: 0, t: 'transit', op: 'edge', id: 1, mode: 'rail', x: 10, z: 4, h: 0, x2: 11, z2: 4, h2: 0, cost: 10, g: 1 }]));
    const missed = [];
    for (const [name, edit] of BAD_ROWS) { const r = [...T0]; edit(r); try { S.unpackHistory([r], 72); missed.push(name); } catch (e) { if (!/歷史第 1 筆/.test(e.message)) missed.push(`${name}（${e.message}）`); } }
    assert.deepEqual(missed, []);
    return `${BAD_ROWS.length} 種壞列`;
  });

  check('history.ts 的純函式：地形的佔用一律布林（地圖外算佔用）、高度 0／1、水面布林；restoreTransit 鍵序同 createNetwork、nextId 不倒退；地面運輸格不含地鐵；事件鍵序＝讀檔組回的順序', () => {
    const P = loadOk(A, A.sample('newcity')), c = P.sim.city, n = c.n, live = H.transitTerrain(c, true), dead = H.transitTerrain(c, false);
    let occ = 0;
    for (let z = -1; z <= n; z++) for (let x = -1; x <= n; x++) for (const T of [live, dead]) {
      const q = T.cell(x, z), inside = x >= 0 && z >= 0 && x < n && z < n;
      assert.equal(typeof q.occupied, 'boolean'); assert.equal(typeof q.water, 'boolean'); assert.ok(q.elevation === 0 || q.elevation === 1);
      if (!inside) assert.equal(q.occupied, true, `地圖外 (${x},${z}) 算佔用`);
      else if (T === dead) assert.equal(q.occupied, false); else if (q.occupied) occ++;
    }
    assert.ok(occ > 0 && live.size === n && dead.size === n);
    const net0 = A.network.createNetwork(), b = A.network.buildTrack(net0, dead, 'metro', { x: 1, z: 1, height: -1 }, { x: 2, z: 1, height: -1 }, 100).network;
    const r0 = H.restoreTransit(b, undefined), r1 = H.restoreTransit(b, net0);
    assert.equal(J(Object.keys(r0)), J(Object.keys(net0))); assert.equal(J(r0), J(r1));
    assert.equal(J(r0), J({ edges: [], stations: [], depots: [], nextId: 2, revision: 2 }));
    const surf = H.surfaceTransitCells({ edges: [{ id: 1, mode: 'rail', a: { x: 1, z: 1, height: 0 }, b: { x: 2, z: 1, height: 0 } }, { id: 2, mode: 'metro', a: { x: 5, z: 5, height: -1 }, b: { x: 5, z: 6, height: -1 } }], stations: [{ id: 3, mode: 'tram', x: 8, z: 8, height: 0, w: 2, h: 1 }], depots: [{ id: 4, mode: 'metro', x: 20, z: 20, height: -1, w: 3, h: 2 }], nextId: 5, revision: 4 }, n);
    assert.equal(J([...surf].sort((p, q) => p - q)), J([1 * n + 1, 1 * n + 2, 8 * n + 8, 8 * n + 9]));
    assert.equal(H.surfaceTransitCells(undefined, n).size, 0);
    for (const e of GOLDEN_EVENTS.filter(q => q.t === 'transit')) assert.equal(J(Object.keys(e)), J(Object.keys(S.unpackHistory(S.packHistory([e]), 72)[0])));
    return `佔用格 ${occ}；restoreTransit 鍵序 ${Object.keys(r0).join(',')}`;
  });

  check('重播的手勢規則：同一筆手勢不能同時是格子與運輸、復原只能是最後一筆運輸手勢、同一筆手勢多個運輸操作整筆復原、編號要接 nextId、拆不存在的設施要報錯', () => {
    const code0 = A.sample('newcity'), imp = rawOfSave(A, code0), c0 = C.cityFromLab(imp, A.KT, code0), d = c0.day, first0 = c0.history[0];
    const m = (id, x, g, op = 'edge') => ({ day: d, t: 'transit', op, id, mode: 'metro', x, z: 40, h: -1, x2: x + 1, z2: 40, h2: -1, cost: op === 'edge' ? 30 : 0, g });
    const road = g => ({ day: d, t: 'road', x: 10, z: 60, rc: 2, cost: 10, g });
    const rp = ev => A.replay.replayCity(code0, [first0, ...ev], A.KT, d);
    const cases = [
      ['運輸之後同一個 g 改格子', [m(1, 40, 5), road(5)], /已經是運輸施工/], ['格子之後同一個 g 蓋運輸', [road(5), m(1, 40, 5)], /已經改過格子/],
      ['復原不是最後一筆運輸手勢', [m(1, 40, 5), m(2, 42, 6), { day: d, t: 'undo', g: 5, refund: 30 }], /不是最後一筆運輸手勢/],
      ['同一筆手勢復原兩次', [m(1, 40, 5), { day: d, t: 'undo', g: 5, refund: 30 }, { day: d, t: 'undo', g: 5, refund: 30 }], /手勢不存在/],
      ['編號沒接 nextId', [m(2, 40, 5)], /編號要是 1/], ['拆不存在的軌道', [m(1, 40, 5), m(7, 40, 6, 'del-edge')], /找不到要拆的設施/],
      ['拆的幾何不對', [m(1, 40, 5), m(1, 41, 6, 'del-edge')], /跟事件記的不同/], ['費用不對', [{ ...m(1, 40, 5), cost: 31 }], /費用要是 0（沙盒）或 30/],
    ];
    for (const [name, ev, re] of cases) assert.throws(() => rp(ev), re, name);
    const ok = rp([m(1, 40, 5), road(6), m(2, 42, 7), m(3, 44, 7), m(1, 40, 7, 'del-edge'), { day: d, t: 'undo', g: 7, refund: 60 }, { day: d, t: 'undo', g: 6, refund: 10 }]);
    assert.equal(J(ok.transit), J({ edges: [{ id: 1, mode: 'metro', a: { x: 40, z: 40, height: -1 }, b: { x: 41, z: 40, height: -1 } }], stations: [], depots: [], nextId: 4, revision: 5 }));
    const back = rp([m(1, 40, 5), { day: d, t: 'undo', g: 5, refund: 30 }]);
    assert.equal(J(back.transit), J({ edges: [], stations: [], depots: [], nextId: 2, revision: 2 }), '第一筆就復原：路網鍵留著、nextId 不倒退');
    return `${cases.length} 種壞歷史都丟例外；同手勢三筆整筆復原、第一筆就復原都對`;
  });

  let city;
  try { city = transitCity(A); } catch (e) { out.push([false, '運輸城的施工（後面各項都靠它）', `${e.name}: ${e.message}`.slice(0, 400)]); return out; }
  const { L, s } = city;
  const code = S.saveCode(s, L.template, L.start), raw = rawOf(A, code);

  check('驗收 2、7：有運輸的存檔 f＝12、rt.v＝1、rt＝serializeNetwork(city.transit)；讀回重播成功，city.transit 序列化跟 rt 逐位元組相同，再存一次 rt 不變', () => {
    assert.equal(raw.d3.f, 12); assert.equal(raw.d3.rt.v, 1); assert.equal(raw.d3.rt.rules, 1);
    assert.equal(Object.keys(raw.d3).at(-1), 'rt', 'rt 排在 d3 最後');
    assert.equal(J(raw.d3.rt), netJ(A, s.city.transit));
    const net = s.city.transit;
    assert.ok(net.edges.length >= 6 && net.stations.length === 2 && net.depots.length === 1, `路網 ${net.edges.length}／${net.stations.length}／${net.depots.length}`);
    const B = loadOk(A, code);
    assert.ok(B.replayed, B.note);
    assert.equal(netJ(A, B.sim.city.transit), J(raw.d3.rt));
    assert.equal(J(B.sim.city.transit), J(net), '重播的路網物件（鍵序、陣列順序）跟施工的相同');
    assert.equal(J(B.sim.city.history.slice(0, s.city.history.length)), J(s.city.history));
    const again = rawOf(A, S.saveCode(B.sim, B.template, B.start));
    assert.equal(J(again.d3.rt), J(raw.d3.rt)); assert.equal(again.d3.f, 12);
    const ev = s.city.history.filter(e => e.t === 'transit');
    assert.ok(ev.some(e => e.cost === 0 && e.op === 'edge'), '沙盒施工記 0'); assert.ok(ev.some(e => e.cost === 25), '水上軌道 25'); assert.ok(ev.some(e => e.cost === 30), '地鐵 30');
    assert.ok(s.city.history.some(e => e.t === 'undo' && e.refund > 0) && s.city.history.some(e => e.t === 'undo' && e.refund === 0), '復原蓋（退費）與復原拆（0）都有');
    return `路網 ${net.edges.length} 條軌道、${net.stations.length} 站、${net.depots.length} 廠，nextId ${net.nextId}、revision ${net.revision}；運輸事件 ${ev.length} 筆；存檔 ${code.length} 字元`;
  });

  const bad = (mut, why) => {
    const r = copy(raw); mut(r);
    const B = S.loadCode(recode(A, r), A.KT, A.vrank);
    if (B.ok) throw new Error(`${why}：應該讀不進來，卻 ok（${B.note}）`);
    if (!/^有運輸的存檔讀不進來/.test(B.error)) throw new Error(`${why}：錯誤訊息 ${B.error}`);
    return B.error;
  };
  const rows = raw.d3.r, tk = rows.findIndex(q => q[0] === 26), tl = rows.findLastIndex(q => q[0] === 26);

  check('驗收 2：rt 未知版本／缺欄位／多欄位／非整數／越界／重複編號／nextId／佔地，全部 fail closed（ok:false，不退回快照）', () => {
    const cases = [
      ['版本 2', r => { r.d3.rt.v = 2; }], ['規則 2', r => { r.d3.rt.rules = 2; }], ['rt＝null', r => { r.d3.rt = null; }], ['rt 是字串', r => { r.d3.rt = 'x'; }],
      ['缺 nextId', r => { delete r.d3.rt.state.nextId; }], ['state 多一欄', r => { r.d3.rt.state.extra = 1; }], ['軌道多一欄', r => { r.d3.rt.state.edges[0].extra = 1; }],
      ['軌道座標 1.5', r => { r.d3.rt.state.edges[0].a.x += 0.5; }], ['軌道座標 5000', r => { r.d3.rt.state.edges[0].b.x = 5000; }], ['編號 0', r => { r.d3.rt.state.edges[0].id = 0; }],
      ['重複編號', r => { r.d3.rt.state.stations[0].id = r.d3.rt.state.edges[0].id; }], ['nextId 不大於編號', r => { r.d3.rt.state.nextId = 1; }],
      ['車站 3 寬', r => { r.d3.rt.state.stations[0].w = 3; }], ['edges 不是陣列', r => { r.d3.rt.state.edges = {}; }], ['revision −1', r => { r.d3.rt.state.revision = -1; }],
      ['車站搬到地圖外（座標 ≤ 4095 解得開，靠重播擋）', r => { r.d3.rt.state.stations[0].x = 100; }],
    ];
    for (const [name, mut] of cases) bad(mut, name);
    return `${cases.length} 種竄改都回 ok:false`;
  });

  check('驗收 2：運輸事件列竄改（碼表外、編號不接 nextId、費用不符、欄位太多、座標出圖、拆的模式不對）也 fail closed', () => {
    assert.ok(tk > 0 && tl > tk, '要有運輸列');
    const cases = [
      ['操作碼 9', r => { r.d3.r[tk][2] = 9; }], ['模式碼 5', r => { r.d3.r[tk][4] = 5; }], ['編號不是 nextId', r => { r.d3.r[tk][3] = 7; }],
      ['費用不符（11）', r => { r.d3.r[tk][11] = 11; }], ['欄位太多', r => { r.d3.r[tk].push(0); }], ['x＝n', r => { r.d3.r[tk][5] = 72; }],
      ['拆的模式不對', r => { const q = r.d3.r[tl]; q[4] = (q[4] + 1) % 3; }],
    ];
    for (const [name, mut] of cases) bad(mut, name);
    return `${cases.length} 種竄改都回 ok:false`;
  });

  check('驗收 3：有事件沒 rt、有 rt 沒事件、rt 與重播不一致，三種都明確報錯', () => {
    const e1 = bad(r => { delete r.d3.rt; }, '有事件沒 rt'); assert.match(e1, /歷史有運輸事件，存檔卻沒有路網/);
    const plain = loadOk(A, A.sample('newcity')), praw = rawOf(A, S.saveCode(plain.sim, plain.template, plain.start));
    praw.d3.rt = copy(raw.d3.rt);
    const B = S.loadCode(recode(A, praw), A.KT, A.vrank);
    assert.equal(B.ok, false); assert.match(B.error, /存檔有路網（d3\.rt），歷史卻沒有運輸事件/);
    const e3 = bad(r => { r.d3.rt.state.revision += 1; }, 'revision 不同'); assert.match(e3, /重播出來的路網跟存檔的 d3\.rt 不同/);
    const e4 = bad(r => { r.d3.rt.state.nextId += 5; }, 'nextId 不同'); assert.match(e4, /路網跟存檔的 d3\.rt 不同/);
    const e5 = bad(r => { const s1 = r.d3.rt.state; s1.edges = [...s1.edges.slice(1), s1.edges[0]]; }, '軌道順序不同'); assert.match(e5, /路網跟存檔的 d3\.rt 不同/);
    const e6 = bad(r => { const s1 = r.d3.rt.state; s1.edges.pop(); }, '少一條軌道'); assert.match(e6, /路網跟存檔的 d3\.rt 不同/);
    return [e1, B.error, e3].map(q => q.replace(/^有運輸的存檔讀不進來（[^）]*）：/, '')).join('｜');
  });

  check('驗收 17：沒有 rt 的 f＝13（CITY_FORMAT＋1）照舊退回只用存檔、訊息逐字不變；有 rt 時 f＝13、hv、起始碼、f 型別、冒用舊格式、重播、對帳失敗全部 ok:false', () => {
    const plain = loadOk(A, A.sample('newcity')); A.day.stepDay(plain.sim);
    const praw = rawOf(A, S.saveCode(plain.sim, plain.template, plain.start));
    for (const f of [13, R.CITY_FORMAT + 1]) {
      const r = copy(praw); r.d3.f = f;
      const B = loadOk(A, recode(A, r));
      assert.equal(B.replayed, false); assert.equal(B.note, `城市格式 ${f} 比這一版（12）新：只用存檔`);
      assert.ok(!('transit' in B.sim.city));
    }
    const cases = [
      ['f＝13', r => { r.d3.f = 13; }, /城市格式 13 比這一版（12）新/], ['hv＝9', r => { r.d3.hv = 9; }, /不認得的歷史存法/], ['沒有起始碼', r => { delete r.d3.s; }, /缺起始碼/],
      ['f 是字串', r => { r.d3.f = '12'; }, /不認得的城市格式/], ['冒用格式 11', r => { r.d3.f = 11; }, /需要城市格式 12/],
      ['重播失敗（匯入雜湊）', r => { r.d3.r[0][5] = 'x'; }, /歷史重播失敗/], ['對帳不同（砍掉一棵樹）', r => { const i = r.tre.search(/[^0]/); assert.ok(i >= 0, '要有樹'); r.tre = r.tre.slice(0, i) + '0' + r.tre.slice(i + 1); }, /歷史跟存檔對不上/],
    ];
    for (const [name, mut, re] of cases) assert.match(bad(mut, name), re, name);
    return `沒有 rt：f 13 照舊退回（訊息不變）；有 rt：${cases.length} 種失敗都 ok:false`;
  });

  check('hv1／hv2／hv3 都讀得回運輸城，讀回之後接著蓋、再存再讀，路網跟施工的相同；hv3 讀不到日誌時 ok:false', () => {
    const out = [];
    // hv1：事件物件
    const r1 = copy(raw); r1.d3.h = S.unpackHistory(r1.d3.r, r1.n); delete r1.d3.r; delete r1.d3.hv;
    const B1 = loadOk(A, recode(A, r1)); assert.ok(B1.replayed, B1.note); assert.equal(J(B1.sim.city.transit), J(s.city.transit));
    // hv2：上面已讀；這裡從 hv1 讀回的城接著蓋
    const more = (X, tag) => {
      const c = X.sim.city, cand = edgeCands(A, c, (p, q) => !p.occupied && !q.occupied && !p.water && !q.water && p.elevation === q.elevation).slice(500);
      first(A, X.sim, 'edge', cand.map(a => ({ ...a, mode: 'rail' })));
      first(A, X.sim, 'station', [{ x: 60, z: 60, h: -1, mode: 'metro' }, { x: 62, z: 62, h: -1, mode: 'metro' }]);
      const back = loadOk(A, S.saveCode(X.sim, X.template, X.start));
      assert.ok(back.replayed, `${tag}：${back.note}`); assert.equal(J(back.sim.city.transit), J(X.sim.city.transit), tag);
      out.push(`${tag} 接著蓋 → nextId ${X.sim.city.transit.nextId}`);
    };
    more(B1, 'hv1');
    // hv3：日誌＋尾巴
    const store = new JR.MemoryJournal(), id = 'd101-hv3', hist = s.city.history, half = JR.packMore(hist.slice(0, hist.length - 3), JR.PACK0);
    store.append(id, 0, half.rows);
    const code3 = S.saveCode(s, L.template, L.start, { journal: { id, st: half.st } }), raw3 = rawOf(A, code3);
    assert.equal(raw3.d3.hv, 3); assert.equal(raw3.d3.t.length, 3); assert.equal(J(raw3.d3.rt), J(raw.d3.rt));
    const rowsNow = store.data.get(id).map(q => copy(q));
    const B3 = loadOk(A, code3, { id, rows: rowsNow }); assert.ok(B3.replayed, B3.note); assert.equal(J(B3.sim.city.transit), J(s.city.transit));
    assert.equal(B3.journal.st.n, half.st.n);
    const more3 = loadOk(A, code3, { id, rows: rowsNow });
    first(A, more3.sim, 'station', [{ x: 64, z: 2, h: -1, mode: 'metro' }, { x: 66, z: 4, h: -1, mode: 'metro' }]);
    const tail = JR.packMore(more3.sim.city.history, more3.journal.st); store.append(id, more3.journal.st.n, tail.rows);
    const code3b = S.saveCode(more3.sim, more3.template, more3.start, { journal: { id, st: tail.st } });
    const B3b = loadOk(A, code3b, { id, rows: store.data.get(id).map(q => copy(q)) }); assert.ok(B3b.replayed, B3b.note);
    assert.equal(J(B3b.sim.city.transit), J(more3.sim.city.transit));
    out.push(`hv3 日誌 ${half.st.n} 列＋尾巴 3 列；接著蓋、日誌 ${tail.st.n} 列`);
    const miss = S.loadCode(code3, A.KT, A.vrank, { id, rows: null, why: '測試：日誌讀不到' });
    assert.equal(miss.ok, false); assert.match(miss.error, /有運輸的存檔讀不進來.*讀不到歷史的日誌/);
    const wrong = S.loadCode(code3, A.KT, A.vrank, { id, rows: rowsNow.map((q, k) => k === 1 ? [...q.slice(0, -1), 999] : q) });
    assert.equal(wrong.ok, false); assert.match(wrong.error, /雜湊/);
    out.push('讀不到日誌、雜湊不對都 ok:false');
    return out.join('；');
  });

  check('驗收 16（模擬部分）：沒有運輸的城沒有 transit 鍵、存檔沒有 rt——匯入、讀檔、過日子、重播、再讀', () => {
    const code0 = A.sample('newcity'), c0 = C.cityFromLab(rawOfSave(A, code0), A.KT, code0);
    assert.ok(!('transit' in c0));
    const P = loadOk(A, code0); assert.ok(!('transit' in P.sim.city));
    for (let d = 0; d < 3; d++) A.day.stepDay(P.sim);
    assert.ok(!('transit' in P.sim.city));
    const pc = S.saveCode(P.sim, P.template, P.start), pr = rawOf(A, pc);
    assert.ok(!('rt' in pr.d3)); assert.ok(pr.d3.f <= 11);
    const Q = loadOk(A, pc); assert.ok(Q.replayed && !('transit' in Q.sim.city));
    const rc = A.replay.replayCity(code0, [c0.history[0]], A.KT); assert.ok(!('transit' in rc));
    return `f ${pr.d3.f}、d3 鍵 ${Object.keys(pr.d3).join(',')}`;
  });
  return out;
}
function rawOfSave(A, code) { const r = A.labcode.decodeLabCode(code); assert.ok(r.ok); return r.save; }

// ---- 驗收 1：沒有運輸的存檔跟 main 76e074f 逐位元組相同（同一套情境，兩邊各自的 src 跑）----
const SAMPLES = ['newcity', 'starter', 'seed516', 'ai120', 'gallery', 'd011-prebuilt'];
async function noTransitRun(root) {
  const im = rel => import(pathToFileURL(path.join(root, rel)).href);
  const [save, lab, jr, day, edit, ktm, w] = await Promise.all(['src/io/save.ts', 'src/io/labcode.ts', 'src/io/journal.ts', 'src/sim/day.ts', 'src/sim/edit.ts', 'src/content/kindTable.ts', 'tools/d036-cities.mjs'].map(im));
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  const KT = ktm.kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const rows = [];
  const rec = (id, code) => { const d3 = lab.decodeLabCode(code).save.raw.d3; rows.push([id, d3?.f ?? 0, d3?.hv ?? 0, d3 && 'rt' in d3 ? 1 : 0, code.length, sha(code)]); return code; };
  const load = (code, j) => { const L = save.loadCode(code, KT, vrank, j); if (!L.ok) throw new Error('讀檔失敗：' + L.error); return L; };
  for (const name of SAMPLES) {
    const L = load(read(`src/content/samples/${name}.code.txt`).trim()), c1 = rec(name, save.saveCode(L.sim, L.template, L.start));
    const L2 = load(c1); rec(name + '/again', save.saveCode(L2.sim, L2.template, L2.start));
  }
  {   // newcity：每三天施工（路、分區、警局、水管、拆、復原、政策、預算、研究），每五天存 hv2、hv3（日誌確認到底／留尾巴）並讀回再存
    const L = load(read('src/content/samples/newcity.code.txt').trim()), s = L.sim, N = s.w.N; s.money = 200000;
    const store = new jr.MemoryJournal(), id = 'd101-a1'; let st = jr.PACK0, t = 0, row = 8;
    const freeRow = (len) => {
      for (; row < N - 3; row++) for (let x = 2; x + len < N - 2; x++) {
        let ok = true;
        for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = 0; dx < len; dx++) { const tl = s.w.tiles[(row + dz) * N + x + dx]; if (tl.t === 0 || tl.bld || tl.road || tl.zone) { ok = false; break; } }
        if (ok) { const r = row; row += 4; return [x, r]; }
      }
      return null;
    };
    const op = o => { t += 5000; return edit.commitOp(s, o, t); };
    for (let d = 1; d <= 30; d++) {
      if (d % 3 === 1) {
        const at = freeRow(8);
        if (at) {
          const [x, z] = at;
          op({ k: 'line', tool: 'road', x0: x, z0: z, x1: x + 7, z1: z });
          op({ k: 'rect', tool: ['zr', 'zc', 'zi'][d % 3], x0: x, z0: z - 1, x1: x + 5, z1: z - 1 });
          op({ k: 'rect', tool: 'zr', x0: x, z0: z + 1, x1: x + 5, z1: z + 1 });
          op({ k: 'tap', tool: 'police', x0: x + 7, z0: z + 1, x1: x + 7, z1: z + 1 });
          op({ k: 'line', tool: 'wpipe', x0: x, z0: z + 1, x1: x + 6, z1: z + 1 });
          op({ k: 'rect', tool: 'doze', x0: x + 5, z0: z - 1, x1: x + 5, z1: z - 1 });
          op({ k: 'rect', tool: 'zc', x0: x + 6, z0: z - 1, x1: x + 6, z1: z - 1 }); edit.undoOp(s);
        }
        if (d === 4) { edit.setPolicy(s, 'curfew', true); edit.setBudget(s, 'edu', 0.1); edit.startResearch(s, 'A1'); }
      }
      day.stepDay(s);
      if (d % 5 === 0) {
        rec(`newcity/day${s.day}/hv2`, save.saveCode(s, L.template, L.start));
        const prev = st, r = jr.packMore(s.city.history, st); await store.append(id, st.n, r.rows); st = r.st;
        const c3 = rec(`newcity/day${s.day}/hv3`, save.saveCode(s, L.template, L.start, { journal: { id, st } }));
        rec(`newcity/day${s.day}/hv3-tail`, save.saveCode(s, L.template, L.start, { journal: { id, st: prev } }));
        const L3 = load(c3, { id, rows: await store.read(id, 1e9) });
        if (!L3.replayed) throw new Error('hv3 讀回沒有重播：' + L3.note);
        rec(`newcity/day${s.day}/hv3-again`, save.saveCode(L3.sim, L3.template, L3.start));
      }
    }
  }
  {   // 只有水管的城（f 5）
    const L = load(read('src/content/samples/newcity.code.txt').trim()), s = L.sim; s.money = 200000;
    edit.commitOp(s, { k: 'line', tool: 'wpipe', x0: 20, z0: 40, x1: 30, z1: 40 }, 5000); day.stepDay(s);
    load(rec('newcity/pipe', save.saveCode(s, L.template, L.start)));
  }
  for (const r of w.d036Runs()) {   // W1–W5：鋼鐵（加速施工 f 11）、油井礦場（耗盡 f 9）、合併、災禍；W5 第一天接委託（f 10）
    let L = load(r.code);
    if (r.id === 'W5' && !edit.acceptCommission(L.sim, 0)) throw new Error('W5 接不到委託');
    for (let d = 1; d <= 12; d++) { day.stepDay(L.sim); if (d % 4 === 0) L = load(rec(`${r.id}/day${L.sim.day}`, save.saveCode(L.sim, L.template, L.start))); }
  }
  return rows;
}
function extractBaseline() {
  const dir = scratchDir('base');
  execFileSync('bash', ['-c', `git -C "${ROOT}" archive --format=tar ${BASELINE} src tools | tar -x -C "${dir}"`], { stdio: ['ignore', 'ignore', 'inherit'] });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  return dir;
}

// ---- 突變副本：整個 src 複製到暫存目錄，改一處（錨點恰好一處），整組重新載入 ----
const MUTANTS = [
  { name: '拿掉 rt 與重播的比對', file: 'src/io/save.ts', from: /^  if \(rtSave && \(!c\.transit \|\| JSON\.stringify[^\n]*\n/m, to: '', expect: ['驗收 3：'] },
  { name: '拿掉重播的 transit case', file: 'src/sim/replay.ts', from: /^      case 'transit': \{\n[\s\S]*?\n      \}\n/m, to: '', expect: ['驗收 2、7：'] },
  { name: '運輸列的 x、z 兩欄對調', file: 'src/io/journal.ts', from: 'TRANSIT_MODES.indexOf(e.mode), e.x, e.z, e.h,', to: 'TRANSIT_MODES.indexOf(e.mode), e.z, e.x, e.h,', expect: ['碼 26 的黃金列'] },
  { name: '有 rt 也退回快照（only 不回 ok:false）', file: 'src/io/save.ts', from: /^    if \(rtSave\) return \{ ok: false as const[^\n]*\n/m, to: '', expect: ['驗收 17：', '驗收 2：rt'] },
  { name: '用 f ≥ 12 判斷運輸存檔', file: 'src/io/save.ts', from: "  rtSave = Object.hasOwn(d3, 'rt');", to: "  rtSave = Object.hasOwn(d3, 'rt') || (isInt(d3.f) && d3.f >= 12);", expect: ['驗收 17：'] },
];
async function mutantRun(m) {
  const dir = scratchDir('mut');
  try {
    fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
    const file = path.join(dir, m.file), src = fs.readFileSync(file, 'utf8');
    const hits = typeof m.from === 'string' ? src.split(m.from).length - 1 : (src.match(new RegExp(m.from.source, m.from.flags + 'g')) ?? []).length;
    if (hits !== 1) throw new Error(`突變錨點要剛好一處（${hits} 處）`);
    fs.writeFileSync(file, src.replace(m.from, () => m.to));
    const res = coreChecks(await api(dir)), red = res.filter(r => !r[0]).map(r => r[1]);
    return { red, missing: m.expect.filter(p => !red.some(n => n.startsWith(p))) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// ---- 隨機差分：history.ts 的線性重播＝逐筆呼叫 network.ts（加 restoreTransit 復原）----
function window14(A, c) {
  const T = A.history.transitTerrain(c, false), n = c.n;
  for (let z0 = 0; z0 + 14 <= n; z0 += 2) for (let x0 = 0; x0 + 14 <= n; x0 += 2) {
    let wet = 0, hi = 0, lo = 0;
    for (let z = z0; z < z0 + 14; z++) for (let x = x0; x < x0 + 14; x++) { const q = T.cell(x, z); if (q.water) wet++; else if (q.elevation) hi++; else lo++; }
    if (wet >= 20 && hi >= 15 && lo >= 40) return [x0, z0];
  }
  throw new Error('找不到有水、有高地的 14×14 區');
}
function differential(A, seeds, steps) {
  const N = A.network, H = A.history, L = loadOk(A, A.sample('newcity')), c = L.sim.city, T = H.transitTerrain(c, false);
  const [x0, z0] = window14(A, c), modes = ['rail', 'tram', 'metro'];
  let builds = 0, fails = 0, undos = 0, multi = 0, dels = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const rnd = mulberry(seed * 7919), pick = a => a[Math.floor(rnd() * a.length)], ri = k => Math.floor(rnd() * k);
    let net = N.createNetwork(); const rp = H.transitReplay(), stack = [], events = [c.history[0]]; let g = 1, used = false;
    for (let i = 0; i < steps; i++) {
      if (stack.length && rnd() < 0.1) {
        const top = stack.pop(); net = H.restoreTransit(net, top.before);
        assert.equal(H.undoTransitStroke(rp, top.g, c.day), true); events.push({ day: c.day, t: 'undo', g: top.g, refund: 0 }); undos++;
      } else {
        const same = stack.length > 0 && rnd() < 0.15, gg = same ? stack.at(-1).g : g, k = rnd(), mode = pick(modes);
        let op, rr, ev;
        const x = x0 + ri(14), z = z0 + ri(14), elev = (xx, zz) => T.cell(xx, zz).elevation;
        if (k < 0.45) {
          op = 'edge'; const [dx, dz] = pick([[1, 0], [0, 1], [-1, 0], [0, -1], [2, 0]]), x2 = x + dx, z2 = z + dz;
          const hh = (xx, zz) => mode === 'metro' ? (rnd() < 0.95 ? -1 : 0) : (rnd() < 0.92 ? elev(xx, zz) : ri(3) - 1);
          const ha = hh(x, z), hb = hh(x2, z2), from = { x, z, height: ha }, to = { x: x2, z: z2, height: hb };
          rr = N.buildTrack(net, T, mode, from, to, MAX);
          const [a, b] = z < z2 || (z === z2 && x < x2) ? [from, to] : [to, from];
          ev = { day: c.day, t: 'transit', op, id: net.nextId, mode, x: a.x, z: a.z, h: a.height, x2: b.x, z2: b.z, h2: b.height, cost: 0, g: gg };
        } else if (k < 0.65) {
          op = k < 0.57 ? 'station' : 'depot'; const [w, d] = op === 'station' ? [2, 1] : [3, 2];
          const h = mode === 'metro' ? (rnd() < 0.95 ? -1 : 0) : (rnd() < 0.9 ? elev(x, z) : ri(3) - 1);
          rr = (op === 'station' ? N.buildStation : N.buildDepot)(net, T, mode, x, z, h, MAX);
          ev = { day: c.day, t: 'transit', op, id: net.nextId, mode, x, z, h, x2: x + w - 1, z2: z + d - 1, h2: h, cost: 0, g: gg };
        } else {
          op = pick(['del-edge', 'del-edge', 'del-station', 'del-depot']);
          const list = op === 'del-edge' ? net.edges : op === 'del-station' ? net.stations : net.depots;
          const item = list.length && rnd() < 0.9 ? pick(list) : pick([...net.edges, ...net.stations, ...net.depots, null]);
          const id = item ? item.id : 1 + ri(net.nextId + 2), target = list.find(q => q.id === id);
          rr = (op === 'del-edge' ? N.removeEdge : op === 'del-station' ? N.removeStation : N.removeDepot)(net, id, MAX);
          ev = target ? H.transitEventOf(c.day, op, target, 0, gg) : { day: c.day, t: 'transit', op, id, mode, x, z, h: 0, x2: x + 1, z2: z, h2: 0, cost: 0, g: gg };
        }
        if (rr.ok && !op.startsWith('del-')) ev.cost = rnd() < 0.3 ? 0 : MAX - rr.money;
        let ok = true, why = '';
        try { H.applyTransitEvent(rp, c, ev); } catch (e) { ok = false; why = e.message; }
        assert.equal(ok, rr.ok, `seed ${seed} 第 ${i} 步 ${op}：network.ts ${rr.ok ? '成功' : '失敗（' + rr.reason + '）'}，重播 ${ok ? '成功' : '失敗（' + why + '）'}`);
        if (rr.ok) {
          if (!same) { stack.push({ g: gg, before: used ? net : undefined }); g++; } else multi++;
          net = rr.network; used = true; events.push(ev); if (op.startsWith('del-')) dels++; else builds++;
        } else fails++;
      }
      assert.equal(J(H.replayedNetwork(rp) ?? null), J(used ? net : null), `seed ${seed} 第 ${i} 步之後的路網`);
    }
    if (used) {
      const rc = A.replay.replayCity(A.sample('newcity'), events, A.KT, c.day);
      assert.equal(J(rc.transit), J(net), `seed ${seed}：replayCity 的路網`);
    }
  }
  return { builds, fails, undos, multi, dels, x0, z0 };
}
// 軌道上限 8192（graph.ts 沒有匯出）：直接寫出 8192 條地鐵的網，network.ts 第 8192 條成功、第 8193 條「網路已滿」；重播一樣
function capBoundary(A) {
  const N = A.network, H = A.history, L = loadOk(A, A.sample('newcity')), c = L.sim.city, n = c.n, T = H.transitTerrain(c, false), pairs = [];
  for (let z = 0; z < n; z++) for (let x = 0; x + 1 < n; x++) pairs.push([{ x, z, height: -1 }, { x: x + 1, z, height: -1 }]);
  for (let z = 0; z + 1 < n; z++) for (let x = 0; x < n; x++) pairs.push([{ x, z, height: -1 }, { x, z: z + 1, height: -1 }]);
  const mk = k => ({ edges: pairs.slice(0, k).map(([a, b], i) => ({ id: i + 1, mode: 'metro', a, b })), stations: [], depots: [], nextId: k + 1, revision: k });
  const full = mk(8192), r1 = N.buildTrack(mk(8191), T, 'metro', pairs[8191][0], pairs[8191][1], MAX), r2 = N.buildTrack(full, T, 'metro', pairs[8192][0], pairs[8192][1], MAX);
  assert.ok(r1.ok); assert.equal(J(r1.network), J(full)); assert.equal(r2.ok, false); assert.equal(r2.reason, '網路已滿');
  const rp = H.transitReplay(), evOf = (k, [a, b]) => ({ day: c.day, t: 'transit', op: 'edge', id: k + 1, mode: 'metro', x: a.x, z: a.z, h: -1, x2: b.x, z2: b.z, h2: -1, cost: 30, g: k + 1 });
  for (let k = 0; k < 8192; k++) H.applyTransitEvent(rp, c, evOf(k, pairs[k]));
  assert.equal(J(H.replayedNetwork(rp)), J(full));
  assert.throws(() => H.applyTransitEvent(rp, c, evOf(8192, pairs[8192])), /網路已滿/);
  return '8192 條相同、第 8193 條兩邊都拒絕';
}

// ---- 驗收 13：4000 筆運輸事件的存檔讀檔 ≤ 1500 ms、t(4000)／t(1000) ≤ 6；saveCode ≤ 100 ms ----
function perfEvents(A, c, count, startG, day) {
  const H = A.history, rp = H.transitReplay(), n = c.n, ev = [], hz = [];
  for (let z = 0; z < n; z++) for (let x = 0; x + 1 < n; x++) hz.push([x, z, x + 1, z]);   // 地鐵軌道：先橫的、再直的（地鐵不看地形；站廠只跟站廠比重疊）
  for (let z = 0; z + 1 < n; z++) for (let x = 0; x < n; x++) hz.push([x, z, x, z + 1]);
  let g = startG, e = 0, s = 0;
  const add = q => { H.applyTransitEvent(rp, c, q); ev.push(q); };
  while (ev.length < count) {
    const k = ev.length;
    if (k % 50 === 49) { const z = 2 + 3 * (s % Math.floor(n / 3 - 1)), x = 2 * Math.floor(s / Math.floor(n / 3 - 1)); s++; add({ day, t: 'transit', op: 'station', id: rp.nextId, mode: 'metro', x, z, h: -1, x2: x + 1, z2: z, h2: -1, cost: 120, g: g++ }); continue; }
    if (k % 97 === 96 && ev.length) { const q = ev.findLast(p => p.t === 'transit' && p.op === 'edge' && rp.byId.get(p.id)?.live); add({ ...q, op: 'del-edge', cost: 0, g: g++ }); continue; }
    if (k % 131 === 130) { const q = ev.at(-1); if (q.t === 'transit') { H.undoTransitStroke(rp, q.g, day); ev.push({ day, t: 'undo', g: q.g, refund: q.cost }); continue; } }
    const [x, z, x2, z2] = hz[e++]; add({ day, t: 'transit', op: 'edge', id: rp.nextId, mode: 'metro', x, z, h: -1, x2, z2, h2: -1, cost: 30, g: g++ });
  }
  return { ev, net: H.replayedNetwork(rp), g };
}
function perfCity(A, count) {
  const L = loadOk(A, A.sample('newcity')), s = L.sim, c = s.city, p = perfEvents(A, c, count, s.stroke, s.day);
  c.history.push(...p.ev); c.transit = p.net; s.stroke = p.g;
  return { L, s, p };
}
const median = a => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
// 斷言用最快的一次（同 unit-d012「取三次最快」：排除 GC 與共用機器的雜訊），中位數一起印出來
function timeIt(fn, k) { const t = []; let r; for (let i = 0; i < k; i++) { const t0 = performance.now(); r = fn(); t.push(performance.now() - t0); } return { ms: Math.min(...t), med: median(t), r }; }

// ---- 主程式 ----
async function main() {
  const freeze = process.argv.includes('--freeze');
  let bad = 0;
  const log = (ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}：${detail}`); if (!ok) bad++; };
  const step = async (name, fn) => { try { log(true, name, await fn()); } catch (e) { log(false, name, `${e.name}: ${e.message}`.slice(0, 600)); } };

  // 驗收 1 的黃金樣本
  let base = null;
  const baseRows = async () => {
    if (base) return base;
    const dir = extractBaseline();
    try { base = await noTransitRun(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
    return base;
  };
  if (freeze) {
    const rows = await baseRows(), head = { card: 'D101', commit: BASELINE, note: 'tools/d101-save.mjs noTransitRun() on the main 76e074f src (git archive); each row [id, f, hv, rt?, length, sha256]' };
    const text = JSON.stringify(head, null, 1).replace(/\n\}$/, ',\n "rows": [\n') + rows.map(r => '  ' + JSON.stringify(r)).join(',\n') + '\n ]\n}\n';
    assert.equal(J(JSON.parse(text)), J({ ...head, rows }));
    const file = path.join(ROOT, FIXTURE);
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') !== text) throw new Error(`${FIXTURE} 已存在且內容不同，不覆寫`);
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text);
    console.log(`wrote ${FIXTURE}（${rows.length} 份存檔，${text.length} bytes）`);
    return;
  }
  const A = await api(ROOT);

  await step('驗收 1、16：沒有運輸的存檔（6 個樣本、newcity 30 天施工 hv2／hv3、W1–W5 各 12 天）跟 main 76e074f 逐位元組相同、沒有 rt；黃金樣本也從 git 重算核對', async () => {
    const fx = JSON.parse(fs.readFileSync(path.join(ROOT, FIXTURE), 'utf8'));
    assert.equal(fx.commit, BASELINE);
    const now = await noTransitRun(ROOT);
    const diff = now.map((r, k) => J(r) === J(fx.rows[k]) ? null : `${r[0]}：現行 f${r[1]} ${r[4]} 字元、main f${fx.rows[k]?.[1]} ${fx.rows[k]?.[4]} 字元`).filter(Boolean);
    assert.equal(now.length, fx.rows.length, '存檔份數'); assert.deepEqual(diff, []);
    assert.ok(now.every(r => r[3] === 0), '都沒有 rt');
    const b = await baseRows(); assert.equal(J(b), J(fx.rows), '黃金樣本跟 76e074f 重算的不同');
    const fs1 = [...new Set(now.map(r => r[1]))].sort((x, y) => x - y);
    return `${now.length} 份存檔逐位元組相同（f ${fs1.join('、')}；hv ${[...new Set(now.map(r => r[2]))].join('、')}）；黃金樣本＝${BASELINE.slice(0, 7)} 重算`;
  });

  for (const [ok, name, detail] of coreChecks(A)) log(ok, name, detail);

  await step('隨機差分：40 個種子各 300 步（蓋、拆、同一手勢多筆、後進先出復原、注定失敗的施工）——重播每一步的路網跟逐筆呼叫 network.ts 逐位元組相同、成敗一致；replayCity 收尾相同', () => {
    const r = differential(A, 40, 300);
    assert.ok(r.builds > 2000 && r.fails > 2000 && r.undos > 500 && r.multi > 300 && r.dels > 300, J(r));
    return `蓋 ${r.builds}、拆 ${r.dels}、失敗 ${r.fails}、復原 ${r.undos}、同手勢多筆 ${r.multi}（區塊 ${r.x0},${r.z0} 起 14×14）`;
  });
  await step('軌道上限：network.ts 與重播在 8192／8193 條的邊界一致', () => capBoundary(A));
  await step('perf 事件的來源：1000 筆的序列逐筆交給 network.ts（完整的網）重做，路網逐位元組相同', () => {
    const L = loadOk(A, A.sample('newcity')), c = L.sim.city, { ev, net } = perfEvents(A, c, 1000, 1, c.day), T = A.history.transitTerrain(c, false), N = A.network;
    let ref = N.createNetwork(); const before = new Map();
    for (const e of ev) {
      if (e.t === 'undo') { ref = A.history.restoreTransit(ref, before.get(e.g)); continue; }
      before.set(e.g, ref);
      const r = e.op === 'edge' ? N.buildTrack(ref, T, e.mode, { x: e.x, z: e.z, height: e.h }, { x: e.x2, z: e.z2, height: e.h2 }, MAX)
        : e.op === 'station' ? N.buildStation(ref, T, e.mode, e.x, e.z, e.h, MAX) : N.removeEdge(ref, e.id, MAX);
      assert.ok(r.ok, `${e.op} #${e.id}：${r.reason}`); ref = r.network;
    }
    assert.equal(J(ref), J(net));
    return `${ev.length} 筆（${net.edges.length} 條軌道、${net.stations.length} 站）`;
  });

  await step('驗收 13（規則 5）：4000 筆運輸事件的存檔 loadCode ≤ 1500 ms、t(4000)／t(1000) ≤ 6；同一座城 saveCode（hv2、hv3）≤ 100 ms（各取最快一次）', () => {
    const P1 = perfCity(A, 1000), P4 = perfCity(A, 4000);
    const c1 = A.save.saveCode(P1.s, P1.L.template, P1.L.start), c4 = A.save.saveCode(P4.s, P4.L.template, P4.L.start);
    loadOk(A, c1); loadOk(A, c4);   // 暖機
    const t1 = timeIt(() => loadOk(A, c1), 5), t4 = timeIt(() => loadOk(A, c4), 5);
    assert.ok(t4.r.replayed, t4.r.note); assert.equal(netJ(A, t4.r.sim.city.transit), netJ(A, P4.p.net));
    const store = new A.journal.MemoryJournal(), half = A.journal.packMore(P4.s.city.history, A.journal.PACK0); store.append('perf', 0, half.rows);
    const s2 = timeIt(() => A.save.saveCode(P4.s, P4.L.template, P4.L.start), 7), s3 = timeIt(() => A.save.saveCode(P4.s, P4.L.template, P4.L.start, { journal: { id: 'perf', st: half.st } }), 7);
    const ratio = t4.ms / t1.ms, ev4 = P4.p.ev.length, net4 = P4.p.net;
    const f = q => `${q.ms.toFixed(1)} ms（中位 ${q.med.toFixed(1)}）`;
    const detail = `loadCode 最快：1000 筆 ${f(t1)}、4000 筆 ${f(t4)}，${ratio.toFixed(2)} 倍；saveCode 最快 hv2 ${f(s2)}、hv3 ${f(s3)}；存檔 ${c4.length} 字元；路網 ${net4.edges.length} 條軌道、${net4.stations.length} 站（${ev4} 筆事件）`;
    console.log('  perf ' + detail);
    assert.ok(t4.ms <= 1500, detail); assert.ok(ratio <= 6, detail); assert.ok(s2.ms <= 100 && s3.ms <= 100, detail);
    return detail;
  });

  await step('驗收 15（規則 9）：同一串操作（施工、過日子）分別有蓋、沒蓋運輸，存檔裡實驗線看得到的欄位除了 money 逐位元組相同；rl、rb、tr 三層跟範本相同', () => {
    const run = withTransit => {
      const L = loadOk(A, A.sample('newcity')), s = L.sim; s.money = 1e6; let t = 0;
      for (let d = 1; d <= 12; d++) {
        if (d % 4 === 1) { t += 5000; A.edit.commitOp(s, { k: 'line', tool: 'road', x0: 8, z0: 8 + d, x1: 16, z1: 8 + d }, t); t += 5000; A.edit.commitOp(s, { k: 'rect', tool: 'zr', x0: 8, z0: 9 + d, x1: 14, z1: 9 + d }, t); }
        if (withTransit && d % 3 === 0) {
          const c = s.city;
          first(A, s, 'edge', edgeCands(A, c, (p, q) => !p.occupied && !q.occupied && !p.water && !q.water && p.elevation === q.elevation).slice(100 * d).map(a => ({ ...a, mode: d % 2 ? 'rail' : 'tram' })));
          first(A, s, 'station', boxCands(A, c, 2, 1).slice(50 * d).map(a => ({ ...a, mode: 'rail' })));
          first(A, s, 'edge', [{ x: d, z: 66, h: -1, x2: d + 1, z2: 66, h2: -1, mode: 'metro' }]);
        }
        A.day.stepDay(s);
      }
      return { raw: rawOf(A, A.save.saveCode(s, L.template, L.start)), template: L.template, money: s.money };
    };
    const a = run(true), b = run(false), lab = r => { const o = copy(r); delete o.d3; delete o.z; delete o.money; return o; };
    assert.ok(a.raw.d3.rt && !('rt' in b.raw.d3), '一邊有 rt、一邊沒有');
    assert.ok(a.money < b.money, '蓋運輸要花錢');
    assert.equal(J(lab(a.raw)), J(lab(b.raw)), '實驗線看得到的欄位（money 以外）');
    for (const k of ['rl', 'rb', 'tr']) { assert.equal(a.raw[k], a.template[k], k); assert.equal(b.raw[k], b.template[k], k); }
    return `實驗線欄位 ${Object.keys(lab(a.raw)).length} 個逐位元組相同；money ${a.raw.money} vs ${b.raw.money}；rl／rb／tr ${['rl', 'rb', 'tr'].map(k => typeof a.raw[k]).join('／')}，跟範本相同；運輸只在 d3（f ${a.raw.d3.f} vs ${b.raw.d3.f}）`;
  });

  await step(`突變控制（${MUTANTS.length} 種，副本放在 ${SCRATCH}）：每一種都讓守衛轉紅，而且紅在預期的那一項`, async () => {
    const out = [];
    for (const m of MUTANTS) {
      const r = await mutantRun(m);
      assert.ok(r.red.length > 0, `「${m.name}」沒有讓任何一項轉紅`);
      assert.deepEqual(r.missing, [], `「${m.name}」紅了 ${J(r.red)}，預期的沒紅`);
      out.push(`「${m.name}」→ ${r.red.length} 項紅`);
    }
    return out.join('；');
  });

  console.log(bad ? `D101 save: ${bad} failed` : 'D101 save: all passed');
  if (bad) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

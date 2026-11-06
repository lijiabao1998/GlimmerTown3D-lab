// D101 第三步守衛：運輸施工的交易、復原、反向守衛與巨型合併的地面遮罩（卡 docs/D101-transit-save-and-ui.md；transit.yml 會跑）。
// 涵蓋凍結的驗收 5（每一種失敗都原子：路網鍵、資金、歷史、手勢編號、復原堆疊、格子逐位元組不變；拆除不退費；帶小數的資金；沙盒費用 0；編號與 revision 上限）、
// 6（復原後跟施工前 deep equal、跟建築混合的同日後進先出、恰好多一列 undo、nextId 不倒退、revision +1、過一天不能復原、堆疊上限 40）、
// 14（沙盒）、反向守衛（地面軌道與站廠擋非拆除的施工，地鐵不擋，拆除照常，沒有運輸的城不擋）、真的 saveCode／loadCode 存讀之後接著蓋（重播逐位元組相同）、
// 8（沒有運輸的城跑 120 天：每天的 sim hash、亂數呼叫次數、最後的存檔碼都等於 main 76e074f；76e074f 的 src 由 git archive 解到 /dev/shm）、
// 21（地面軌道格四周 8 棟 lv3 住宅：有運輸 0 格被巨型合併吸收、路網與存檔不變；同一局面沒運輸照舊吸收；存讀之後照樣擋）、
// 15b（照卡面「對驗收 15b 的更正」的兩條：會觸發的局面裡，拿掉遮罩的運輸城跟沒蓋運輸的城每天逐位元組相同；有遮罩與沒運輸兩邊第一個不同的地方，是沒被擋的那一邊擲了一個含軌道格的 3×3 窗。
// 原文「第一個不同的日子有一筆碰到軌道格的巨型合併」不成立——被擋的窗骰沒擲中也少抽一次 R()，反過來被擋的窗不設 mgDone，本來被跳過的重疊窗會多抽——所以原文只印出成立的種子數，不斷言）。
// 第 2 輪核對 R2-1 補的（業主 11-06 規則的另外三部分在合併這條路上也要跑到）：驗收 21 的車站、車廠、地鐵、軌道旁四種變體；守衛建的每一張路網都核 transitSurface＝surfaceTransitCells；
// 世界在施工後、讀檔後真的登記了遮罩（merge.ts 沒有讀取的介面，用假格子逐格探 mergeDay 的行為）。R2-2：build.ts 不認得的工具在地面運輸格上照舊丟「未搬」。
// 突變控制都載入 /dev/shm 底下改過的 src 副本（錨點恰好一處），不動倉庫的檔；每一種都要紅在預期的那一項。
// 用法：node tools/d101-construction.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = '76e074ff66f01e5e0ced8c946b13584226f0d6b6';
const BLOCKED = '運輸設施擋住';
const sha = s => createHash('sha256').update(s).digest('hex');
const J = v => JSON.stringify(v);
const copy = v => JSON.parse(JSON.stringify(v));
const SCRATCH = (() => { try { fs.accessSync('/dev/shm', fs.constants.W_OK); return '/dev/shm'; } catch { return os.tmpdir(); } })();
const scratchDir = tag => fs.mkdtempSync(path.join(SCRATCH, `d101-construction-${tag}-`));
const imRoot = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
// 局面產生器（只產生存檔碼；同一份碼交給現行、76e074f、突變副本各自的 src）
const D034 = await imRoot('tools/d034-cities.mjs'), D021 = await imRoot('tools/d021-cities.mjs');

// ---- 模組組：同一個根目錄底下的 src 一起載入 ----
async function api(root) {
  const im = rel => import(pathToFileURL(path.join(root, rel)).href);
  const [save, labcode, journal, replay, day, editMod, network, format, history, merge, kt] = await Promise.all([
    'src/io/save.ts', 'src/io/labcode.ts', 'src/io/journal.ts', 'src/sim/replay.ts', 'src/sim/day.ts', 'src/sim/edit.ts',
    'src/sim/transit/network.ts', 'src/sim/transit/format.ts', 'src/sim/transit/history.ts', 'src/sim/rules/merge.ts', 'src/content/kindTable.ts'].map(im));
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  const KT = kt.kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  // 第 2 輪核對 R2-1(5)：守衛建的每一張路網都核 transitSurface（交給 merge.ts 的遮罩來源）跟 surfaceTransitCells（反向守衛的地面格）逐格相同。
  // 包住施工、拆除、復原：每一次呼叫之後（不論成敗）核一次；讀檔在 loadOk 裡核。不同的記下來，由「遮罩＝地面格」那一項與最後一項斷言（各項自己的斷言不受影響）
  const surfaceLog = { n: 0, bad: [] };
  const surfaceSame = (s, tag) => { surfaceLog.n++; const d = surfaceDiff(history, s.city); if (d) surfaceLog.bad.push(`${tag}：${d}`); };
  const edit = { ...editMod };
  for (const k of ['commitTransit', 'removeTransit', 'undoOp']) edit[k] = (s, ...a) => { const r = editMod[k](s, ...a); surfaceSame(s, k); return r; };
  return { root, save, labcode, journal, replay, day, edit, network, format, history, merge, KT, vrank, surfaceLog, surfaceSame, sample: name => read(`src/content/samples/${name}.code.txt`).trim() };
}
// transitSurface 跟 surfaceTransitCells 逐格比（城裡沒有路網：遮罩要是 null）；相同回 null，不同回第一個不同的地方
function surfaceDiff(H, c) {
  const n = c.n, m = H.transitSurface(() => c)(), want = H.surfaceTransitCells(c.transit, n);
  if (!c.transit) return m === null ? null : '沒有路網卻有遮罩';
  if (!(m instanceof Uint8Array) || m.length !== n * n) return `遮罩的形狀不對（${m?.constructor?.name}、${m?.length}）`;
  for (let i = 0; i < n * n; i++) if (m[i] !== (want.has(i) ? 1 : 0)) return `格 (${i % n},${(i / n) | 0})：遮罩 ${m[i]}、地面格 ${want.has(i) ? 1 : 0}`;
  return null;
}
// 世界真的登記了遮罩嗎（merge.ts 沒有讀取的介面，只能看行為）：把這個 World 的格子暫時換成「只有一個 3×3 窗合格」的假格子——窗裡 8 棟通電有水的 lv2 住宅、
// 被探的那一格是沒分區的草地、窗外全是水（不可吸收）——用同一個 World 物件叫一次 mergeDay（需求只開巨廈那一段；亂數一律回 1，合格也擲不中，什麼都不改）。
// 擲了一次＝那一格沒被擋，沒擲＝被擋。期望：被擋 ⇔ 那一格在 surfaceTransitCells 裡（地面軌道端點、地面站廠）。探的格：地面格、地鐵件的格、這兩種格的四鄰，
// sample > 0 時另外每 sample 格探一格。格子用完原樣放回（同一個陣列物件）
function maskMatch(A, s, sample = 0) {
  const w = s.w, N = w.N, c = s.city, t = c.transit, want = A.history.surfaceTransitCells(t, N), probe = new Set(want);
  if (t) {
    for (const e of t.edges) { probe.add(e.a.z * N + e.a.x); probe.add(e.b.z * N + e.b.x); }
    for (const q of [...t.stations, ...t.depots]) for (let dz = 0; dz < q.h; dz++) for (let dx = 0; dx < q.w; dx++) probe.add((q.z + dz) * N + q.x + dx);
  }
  for (const i of [...probe]) { const x = i % N, z = (i / N) | 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (x + dx >= 0 && z + dz >= 0 && x + dx < N && z + dz < N) probe.add((z + dz) * N + x + dx); }
  if (sample > 0) for (let i = 0; i < N * N; i += sample) probe.add(i);
  const keep = w.tiles, fake = Array.from({ length: N * N }, () => ({ t: 0 })), bad = [];
  let blocked = 0;
  try {
    w.tiles = fake;
    for (const i of probe) {
      const x = i % N, z = (i / N) | 0, x0 = Math.min(Math.max(x - 1, 0), N - 3), z0 = Math.min(Math.max(z - 1, 0), N - 3), win = [];
      for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) { const j = (z0 + dz) * N + x0 + dx; win.push(j); fake[j] = j === i ? { t: 2 } : { t: 2, zone: 1, bld: { k: 1, lv: 2, v: 0, age: 0, pw: true, wa: true } }; }
      let rolls = 0;
      const recs = A.merge.mergeDay(w, { cityHappy: 1, dem: { 1: 0.28, 2: 0 }, sewNeed: false, sewOk: [], rng: { R() { rolls++; return 1; }, ri() { rolls++; return 0; } }, pickV: () => 0, unstampPark() {}, markLand() {} });
      for (const j of win) fake[j] = { t: 0 };
      if (recs.length || rolls > 1) throw new Error(`探針的假格子不該合併、也只該有一個合格的窗（${recs.length} 筆、擲 ${rolls} 次）`);
      if (rolls === 0) blocked++;
      if ((rolls === 0) !== want.has(i)) bad.push(`(${x},${z}) ${rolls === 0 ? '被擋' : '沒擋'}，但${want.has(i) ? '是' : '不是'}地面格`);
    }
  } finally { w.tiles = keep; }
  return { probed: probe.size, blocked, surface: want.size, bad };
}
// 登記的遮罩逐格對：沒有一格不對；有地面格時每一格都擋到
const regOk = (reg, tag) => { assert.deepEqual(reg.bad, [], `${tag}：世界登記的遮罩跟地面格不同`); assert.equal(reg.blocked, reg.surface, `${tag}：擋到 ${reg.blocked} 格、地面格 ${reg.surface} 格`); };
// 76e074f 沒有運輸的模組：驗收 8 只用得到讀檔、過日子、施工
async function apiNoTransit(root) {
  const im = rel => import(pathToFileURL(path.join(root, rel)).href);
  const [save, day, edit, kt] = await Promise.all(['src/io/save.ts', 'src/sim/day.ts', 'src/sim/edit.ts', 'src/content/kindTable.ts'].map(im));
  const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
  const KT = kt.kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  return { root, save, day, edit, KT, vrank, sample: name => read(`src/content/samples/${name}.code.txt`).trim() };
}
const loadOk = (A, code, j) => { const L = A.save.loadCode(code, A.KT, A.vrank, j); if (!L.ok) throw new Error('讀檔失敗：' + L.error); A.surfaceSame?.(L.sim, '讀檔'); return L; };
const rawOf = (A, code) => { const r = A.labcode.decodeLabCode(code); assert.ok(r.ok, r.error); return r.save.raw; };
const labFields = raw => { const o = copy(raw); delete o.d3; delete o.z; return o; };
const countRng = s => { const r = s.rng, c = { n: 0 }; s.rng = { R() { c.n++; return r.R(); }, ri(k) { c.n++; return r.ri(k); }, log: r.log }; return c; };
// 「整個狀態」：路網鍵與路網、資金、歷史、手勢編號、復原堆疊（逐個物件）、拆除預備、格子、城市圖層、建築、地價標記
const stateJ = s => { const c = s.city; return J({ key: Object.hasOwn(c, 'transit'), net: c.transit ?? null, money: s.money, neg0: Object.is(s.money, -0), history: c.history, stroke: s.stroke, txns: s.txns.length, dozeArm: s.dozeArm,
  tiles: s.w.tiles, layers: [c.road, c.rclass, c.zone, c.tree, c.wp, c.ruin, c.occ].map(a => Array.from(a)), buildings: c.buildings, land: [s.landDirty, s.landBox], stale: sha(Buffer.from(s.stale)) }); };
// 復原要回到的狀態（驗收 6 的 deep equal：軌道／車站／車廠三個陣列、資金、Lab 圖層與城市圖層；建築的復原照舊留墓碑，所以建築清單另外看根格）。
// Lab 圖層去掉 wr：那是供水網的衍生快取（computeWaterLegacy449 每天開頭與建築的復原 undoTxn 都整張重寫，D019 起的既有行為），不是施工的結果；
// 運輸的復原本身另外要求格子連 wr 都逐位元組不動（見驗收 6）
const tilesNoWr = s => s.w.tiles.map(t => { const { wr, ...rest } = t; void wr; return rest; });
const undoJ = s => { const c = s.city, t = c.transit; return J({ edges: t?.edges ?? [], stations: t?.stations ?? [], depots: t?.depots ?? [], money: s.money, tiles: tilesNoWr(s),
  layers: [c.road, c.rclass, c.zone, c.tree, c.wp, c.ruin, c.occ].map(a => Array.from(a)), roots: [...s.root.keys()].sort((a, b) => a - b) }); };

// ---- 候選格（照格索引順序，決定性）----
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
const land = (p, q) => !p.occupied && !q.occupied && !p.water && !q.water;
// 站廠的候選再避開路網裡每一件的格子（軌道兩端不分模式、站廠佔地）：拆站廠的測試不會被「請先拆連接的軌道」攔下，地鐵格也不會跟地面格重疊
function itemCells(c) {
  const n = c.n, out = new Set(), t = c.transit;
  if (!t) return out;
  for (const e of t.edges) { out.add(e.a.z * n + e.a.x); out.add(e.b.z * n + e.b.x); }
  for (const q of [...t.stations, ...t.depots]) for (let dz = 0; dz < q.h; dz++) for (let dx = 0; dx < q.w; dx++) out.add((q.z + dz) * n + q.x + dx);
  return out;
}
const freeBoxes = (A, c, w, d, extra = new Set()) => { const used = itemCells(c), n = c.n; return boxCands(A, c, w, d).filter(b => { for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) { const i = (b.z + dz) * n + b.x + dx; if (used.has(i) || extra.has(i)) return false; } return true; }); };
const freeEdges = (A, c, cands, extra = new Set()) => { const used = itemCells(c), n = c.n; return cands.filter(e => ![e.z * n + e.x, e.z2 * n + e.x2].some(i => used.has(i) || extra.has(i))); };
const flatOf = (A, c) => edgeCands(A, c, (p, q) => land(p, q) && p.elevation === q.elevation);
function build(A, s, op, mode, cands, skip = 0) {
  for (const a of cands.slice(skip)) { const r = A.edit.commitTransit(s, { op, mode, ...a }); if (r.ok) return { ...r, a }; }
  throw new Error(`找不到可以施工的 ${op}/${mode}`);
}
function newcity(A, money = 50000.75) { const L = loadOk(A, A.sample('newcity')); L.sim.money = money; return L; }

// ---- 驗收 21 的局面：D034 M2 的版型，六個 3×3 住宅窗（x0＝8…28，z＝31–33）；每窗左中格 (x0,32) 是沒分區的草地，地面軌道 (x0−1,32)–(x0,32)，其餘 8 格 lv3 住宅 ----
const X0 = [8, 12, 16, 20, 24, 28], SEEDS21 = [5164200, 5164201, 5164202, 5164203, 5164204, 5164205, 5164206, 5164207], DAYS21 = 60;
function t21(b) {
  const { base, pipes, services, cluster, zoneRect, house, tryPut, parksAt, range } = D034;
  base(b); b.road(4, 34, 66, 34, 3); b.road(4, 31, 4, 33, 3); b.road(66, 31, 66, 33, 3);
  pipes(b, 5, 50); range(5, 50).forEach(x => b.pipeAt(x, 33)); range(31, 33).forEach(z => b.pipeAt(5, z)); services(b);
  tryPut(b, 4, 28, 10); tryPut(b, 4, 29, 10); tryPut(b, 3, 32, 5); tryPut(b, 67, 32, 5);
  range(8, 52, 2).forEach(x => cluster(b, x, 28, { kind: 2, lv: 3 }));
  for (const x0 of X0) {
    zoneRect(b, x0, 31, x0 + 2, 33, 1); zoneRect(b, x0, 32, x0, 32, 0);
    for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) if (!(dx === 0 && dz === 1)) house(b, x0 + dx, 31 + dz, dx + dz * 3, 3);
  }
  parksAt(b, range(8, 36, 4), 36); parksAt(b, range(10, 34, 8), 26);
}
const N21 = D021.N21, idx21 = (x, z) => z * N21 + x, TRACK21 = new Set(X0.flatMap(x0 => [idx21(x0 - 1, 32), idx21(x0, 32)]));
const covers21 = (x, z) => [0, 1, 2].some(dz => [0, 1, 2].some(dx => TRACK21.has(idx21(x + dx, z + dz))));
// 車廠變體的版型（第 2 輪核對 R2-1）：底跟 t21 相同；六個 3×3 住宅窗改成每 5 格一個（x0＝8…33，z＝31–33），每窗左欄上兩格 (x0,31)、(x0,32) 是沒分區的草地，其餘 7 棟 lv3 住宅。
// 車廠 3×2 放在 (x0−2,31)–(x0,32)：右邊一欄的兩格在窗裡，左兩欄落在窗間空出來的兩欄（沒分區、沒建築，蓋得下去）
const X0D = [8, 13, 18, 23, 28, 33];
function t21d(b) {
  const { base, pipes, services, cluster, zoneRect, house, tryPut, parksAt, range } = D034;
  base(b); b.road(4, 34, 66, 34, 3); b.road(4, 31, 4, 33, 3); b.road(66, 31, 66, 33, 3);
  pipes(b, 5, 50); range(5, 50).forEach(x => b.pipeAt(x, 33)); range(31, 33).forEach(z => b.pipeAt(5, z)); services(b);
  tryPut(b, 4, 28, 10); tryPut(b, 4, 29, 10); tryPut(b, 3, 32, 5); tryPut(b, 67, 32, 5);
  range(8, 52, 2).forEach(x => cluster(b, x, 28, { kind: 2, lv: 3 }));
  for (const x0 of X0D) {
    zoneRect(b, x0, 31, x0 + 2, 33, 1); zoneRect(b, x0, 31, x0, 32, 0);
    for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) if (!(dx === 0 && dz < 2)) house(b, x0 + dx, 31 + dz, dx + dz * 3, 3);
  }
  parksAt(b, range(8, 36, 4), 36); parksAt(b, range(10, 34, 8), 26);
}
const codes21 = new Map();
const code21 = (seed, lay = 'win') => { const k = `${lay}:${seed}`; if (!codes21.has(k)) codes21.set(k, lay === 'depot' ? D034.mk(seed, 150, '驗收21車廠', t21d) : D034.mk(seed, 150, '驗收21', t21)); return codes21.get(k); };
// 驗收 21 的變體：同一個版型蓋的東西不同。q＝每個窗要蓋的那一件；cost＝它的費用（none 照樣扣 cost×件數，資金跟蓋了的那一份相同）；
// cells＝要數「有沒有被巨型合併吸收」的格；block＝有運輸時一格都不能被吸收的格（地面運輸格；地鐵沒有）
const V21 = {
  track: { lay: 'win', xs: X0, cost: 10, q: (T, x0) => ({ op: 'edge', mode: 'rail', x: x0 - 1, z: 32, h: T.cell(x0 - 1, 32).elevation, x2: x0, z2: 32, h2: T.cell(x0, 32).elevation }), cells: x0 => [idx21(x0 - 1, 32), idx21(x0, 32)] },
  // 鐵路車站 2×1 在 (x0−1,32)–(x0,32)：車站格就是 track 那 12 格
  station: { lay: 'win', xs: X0, cost: 120, q: (T, x0) => ({ op: 'station', mode: 'rail', x: x0 - 1, z: 32, h: T.cell(x0 - 1, 32).elevation }), cells: x0 => [idx21(x0 - 1, 32), idx21(x0, 32)] },
  depot: { lay: 'depot', xs: X0D, cost: 300, q: (T, x0) => ({ op: 'depot', mode: 'rail', x: x0 - 2, z: 31, h: T.cell(x0 - 2, 31).elevation }), cells: x0 => [0, 1, 2].flatMap(dx => [idx21(x0 - 2 + dx, 31), idx21(x0 - 2 + dx, 32)]) },
  // 地鐵在窗底下（同 track 的兩格，h＝−1）：不擋
  metro: { lay: 'win', xs: X0, cost: 30, q: (T, x0) => ({ op: 'edge', mode: 'metro', x: x0 - 1, z: 32, h: -1, x2: x0, z2: 32, h2: -1 }), cells: x0 => [idx21(x0 - 1, 32), idx21(x0, 32)], block: () => [] },
  // 軌道在窗外那一欄 (x0−1,31)–(x0−1,32)：軌道格要擋，緊鄰的窗內空地 (x0,32) 不擋
  beside: { lay: 'win', xs: X0, cost: 10, q: (T, x0) => ({ op: 'edge', mode: 'rail', x: x0 - 1, z: 31, h: T.cell(x0 - 1, 31).elevation, x2: x0 - 1, z2: 32, h2: T.cell(x0 - 1, 32).elevation }), cells: x0 => [idx21(x0, 32)], block: x0 => [idx21(x0 - 1, 31), idx21(x0 - 1, 32)] },
};
const cellsOf21 = (variant, key = 'cells') => { const v = V21[variant]; return new Set(v.xs.flatMap(v[key] ?? v.cells)); };
const hitOf = (R, cells) => [...cells].reduce((a, i) => a + R.hit[i], 0);   // 跑的那 60 天，巨型合併蓋到這些格的次數（一格被蓋一次算一次）
const bldOf = (R, cells) => [...cells].filter(i => R.bld[i]).length;      // 跑完那一天，這些格上有建築的格數
// mode：transit＝真的 commitTransit（遮罩登記）；reload＝蓋完存檔再讀回（遮罩由 loadSim 登記）；none＝不蓋，資金照樣扣；nomask＝蓋了但拿掉遮罩。
// reg／regLoaded＝施工後／讀檔後逐格探世界登記的遮罩（maskMatch）。同一個 A、同樣的參數只跑一次（決定性；記錄擲骰的那種不記）
const memo21 = new WeakMap();
function run21(A, seed, mode, rolls = false, variant = 'track') {
  const v = V21[variant], key = `${variant}|${mode}|${seed}`;
  let memo = memo21.get(A);
  if (!memo) memo21.set(A, memo = new Map());
  if (!rolls && memo.has(key)) return memo.get(key);
  let L = loadOk(A, code21(seed, v.lay)), s = L.sim, spent = 0;
  if (mode === 'none') s.money -= v.cost * v.xs.length;
  else for (const x0 of v.xs) {
    const q = v.q(A.history.transitTerrain(s.city, true), x0), r = A.edit.commitTransit(s, q);
    if (!r.ok) throw new Error(`種子 ${seed}：${J(q)} 蓋不了：${r.reason}`);
    if (r.spent !== v.cost) throw new Error(`種子 ${seed}：${J(q)} 的費用 ${r.spent}，不是 ${v.cost}`);
    spent += r.spent;
  }
  const netBuilt = J(s.city.transit ?? null), reg = rolls ? null : maskMatch(A, s);   // 記錄擲骰的副本不探（探針自己會叫 mergeDay）
  let regLoaded = null;
  if (mode === 'nomask') A.merge.setMergeSurface(s.w, null);
  if (mode === 'reload') { L = loadOk(A, A.save.saveCode(s, L.template, L.start)); s = L.sim; if (!L.replayed) throw new Error('讀回沒有重播：' + L.note); regLoaded = rolls ? null : maskMatch(A, s); }
  const cells = cellsOf21(variant), cnt = countRng(s), fp = [[A.day.simHash(s), 0]], roll = [], merges = [], hit = new Uint16Array(N21 * N21);
  let absorbed = 0, megas = 0, literal = [];
  for (let d = 0; d < DAYS21; d++) {
    if (rolls) globalThis.__d101Rolls = [];
    const rep = A.day.stepDay(s), today = [];
    if (rolls) roll.push(globalThis.__d101Rolls);
    for (const m of rep.merges) {
      merges.push([d + 1, m.x, m.z, m.k, m.size]);
      if (m.size !== 3) continue;
      megas++; let t = 0;
      for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) { const i = idx21(m.x + dx, m.z + dz); hit[i]++; if (cells.has(i)) t++; }
      absorbed += t; if (t) today.push([m.x, m.z]);
    }
    literal.push(today);
    fp.push([A.day.simHash(s), cnt.n]);
  }
  const code = A.save.saveCode(s, L.template, L.start), raw = rawOf(A, code), bld = Uint8Array.from(s.w.tiles, t => t.bld ? 1 : 0);
  const out = { fp, roll, merges, hit, bld, absorbed, megas, literal, spent, netBuilt, netEnd: J(s.city.transit ?? null), rt: raw.d3?.rt, raw, code, covered: bldOf({ bld }, cells), reg, regLoaded, happy: s.cityHappy };
  if (!rolls) memo.set(key, out);
  return out;
}

// ---- 共用檢查（現行 src 要全過；突變副本要紅在預期的那一項）----
function coreChecks(A, only = null) {
  const out = [];
  const check = (name, fn) => { if (only && !only.some(p => name.startsWith(p))) return; try { out.push([true, name, fn()]); } catch (e) { out.push([false, name, `${e.name}: ${e.message}`.slice(0, 500)]); } };
  const { edit: E, history: H, network: N } = A;

  check('工具群：運輸工具另成一組（TRANSIT_TOOLS），不進 CIVIC／FOOD／FACILITY（18／7／86 不變）、id 不撞任何工具；交給 commitOp 會丟「未搬」（介面只能走 commitTransit）。第 2 輪核對 R2-2：城裡有運輸、手勢落在地面運輸格上，build.ts 不認得的工具（6 種運輸工具的 id、打錯的 polic）在 previewOp、commitOp 照樣丟「未搬」，訊息跟沒有運輸的城逐字相同、狀態不動；認得的工具（設施 86 種、路 5 種、分區、電廠、警察局）點在地面格上照樣「運輸設施擋住」', () => {
    assert.equal(E.CIVIC_TOOLS.length, 18); assert.equal(E.FOOD_TOOLS.length, 7); assert.equal(E.FACILITY_TOOLS.length, 86);
    assert.equal(J(E.TRANSIT_TOOLS.map(t => [t.op, t.mode ?? null])), J([['edge', 'rail'], ['edge', 'tram'], ['edge', 'metro'], ['station', null], ['depot', null], ['del', null]]));
    const others = new Set([...E.FACILITY_TOOLS.map(t => t.id), ...E.ROAD_TOOLS.map(t => t.id), ...Object.keys(E.TOOL_PRICE)]);
    for (const t of E.TRANSIT_TOOLS) assert.ok(!others.has(t.id), t.id);
    assert.equal(new Set(E.TRANSIT_TOOLS.map(t => t.id)).size, 6);
    const L = newcity(A), s = L.sim, before = stateJ(s);
    assert.throws(() => E.commitOp(s, { k: 'tap', tool: E.TRANSIT_TOOLS[0].id, x0: 10, z0: 10, x1: 10, z1: 10 }, 1), /未搬/);
    assert.equal(stateJ(s), before);
    // R2-2：有運輸的城 P（一段鐵路、一座鐵路車站），沒有運輸的城 Q；手勢（點、線、框）都碰到地面格——同一個手勢換成警察局會被擋，證明真的碰到了
    const P = newcity(A, 1e6).sim, pe = build(A, P, 'edge', 'rail', flatOf(A, P.city), 30), ps = build(A, P, 'station', 'rail', freeBoxes(A, P.city, 2, 1), 25), Q = newcity(A, 1e6).sim;
    const surf = [[pe.a.x, pe.a.z], [ps.a.x + 1, ps.a.z]], gest = (x, z) => [{ k: 'tap', x0: x, z0: z, x1: x, z1: z }, { k: 'line', x0: x - 1, z0: z, x1: x + 1, z1: z }, { k: 'rect', x0: x - 1, z0: z - 1, x1: x + 1, z1: z + 1 }];
    const thrown = fn => { try { fn(); } catch (e) { return e.message; } return '（沒有丟例外）'; };
    const p0 = stateJ(P), q0 = stateJ(Q);
    let calls = 0;
    for (const tool of [...E.TRANSIT_TOOLS.map(t => t.id), 'polic']) for (const [x, z] of surf) for (const g of gest(x, z)) {
      const op = { ...g, tool };
      assert.equal(E.previewOp(P, { ...op, tool: 'police' }).reason, BLOCKED, `${J(op)}：手勢沒碰到地面格`);
      const want = thrown(() => E.previewOp(Q, op)), wantC = thrown(() => E.commitOp(Q, op, 9e9));
      assert.equal(want, `未搬：${tool}`, `沒有運輸的城：預覽 ${J(op)}`); assert.equal(wantC, `未搬：${tool}`, `沒有運輸的城：提交 ${J(op)}`);
      assert.equal(thrown(() => E.previewOp(P, op)), want, `有運輸的城：預覽 ${J(op)}`); assert.equal(stateJ(P), p0, `預覽 ${J(op)} 之後狀態變了`);
      assert.equal(thrown(() => E.commitOp(P, op, 9e9)), wantC, `有運輸的城：提交 ${J(op)}`); assert.equal(stateJ(P), p0, `提交 ${J(op)} 之後狀態變了`);
      calls += 2;
    }
    assert.equal(stateJ(Q), q0);
    const known = [...E.FACILITY_TOOLS.map(t => t.id), ...E.ROAD_TOOLS.map(t => t.id), ...Object.keys(E.TOOL_PRICE).filter(k => k !== 'doze')];
    for (const tool of known) for (const [x, z] of surf) {
      const op = { k: 'tap', tool, x0: x, z0: z, x1: x, z1: z };
      assert.equal(E.previewOp(P, op).reason, BLOCKED, `預覽 ${tool}@${x},${z}`); assert.equal(E.commitOp(P, op, 9e9).reason, BLOCKED, `提交 ${tool}@${x},${z}`);
    }
    assert.equal(stateJ(P), p0);
    return `6 種：${E.TRANSIT_TOOLS.map(t => t.id).join('、')}；有運輸的城在地面格上 7 種不認得的工具 × 2 格 × 3 種手勢，預覽與提交 ${calls} 次都丟「未搬：…」（跟沒有運輸的城逐字相同）、狀態不動；認得的 ${known.length} 種工具點在地面格上預覽、提交都擋下`;
  });

  check('驗收 5：每一種失敗的施工都原子——預覽與提交都不動路網鍵、資金、歷史、手勢編號、復原堆疊、格子；理由就是 network.ts（或上限）給的那一句', () => {
    const L = newcity(A), s = L.sim, c = s.city, n = c.n, flat = flatOf(A, c);
    const e1 = build(A, s, 'edge', 'rail', flat), st = build(A, s, 'station', 'rail', freeBoxes(A, c, 2, 1), 10), dp = build(A, s, 'depot', 'tram', freeBoxes(A, c, 3, 2), 5);
    const T = H.transitTerrain(c, true);
    const ties = edgeCands(A, c, (p, q, x, z) => land(p, q) && p.elevation === q.elevation && x >= st.a.x && x <= st.a.x + 1 && z === st.a.z);
    assert.ok(ties.some(tie => E.commitTransit(s, { op: 'edge', mode: 'rail', ...tie }).ok), '蓋得了連到車站的軌道');
    let occ = null, wet = null;
    for (let i = 0; i < n * n && !(occ && wet); i++) { const x = i % n, z = (i / n) | 0, q = T.cell(x, z); if (!occ && x + 1 < n && q.occupied && !q.water) occ = { x, z, h: q.elevation }; if (!wet && x + 1 < n && q.water && !q.occupied && T.cell(x + 1, z).water && !T.cell(x + 1, z).occupied) wet = { x, z }; }
    assert.ok(occ && wet);
    const hi = flat.find(a => a.h === 1) ?? flat[0];
    const cases = [
      ['軌道壓在佔用的格上', () => E.commitTransit(s, { op: 'edge', mode: 'rail', x: occ.x, z: occ.z, h: occ.h, x2: occ.x + 1, z2: occ.z, h2: T.cell(occ.x + 1, occ.z).elevation }), '建築擋住軌道'],
      ['軌道兩端不相鄰', () => E.commitTransit(s, { op: 'edge', mode: 'rail', ...flat[300], x2: flat[300].x + 2 }), '軌道必須連接相鄰格'],
      ['軌道高度跟地形不符', () => E.commitTransit(s, { op: 'edge', mode: 'tram', ...hi, h: 1 - hi.h, h2: 1 - hi.h }), '坡度或高度無效'],
      ['軌道出圖', () => E.commitTransit(s, { op: 'edge', mode: 'rail', x: n - 1, z: 5, h: 0, x2: n, z2: 5, h2: 0 }), '座標無效'],
      ['軌道座標不是整數', () => E.commitTransit(s, { op: 'edge', mode: 'rail', x: 1.5, z: 5, h: 0, x2: 2.5, z2: 5, h2: 0 }), '座標無效'],
      ['重複的軌道', () => E.commitTransit(s, { op: 'edge', mode: 'rail', ...e1.a }), '軌道已存在'],
      ['地鐵在地面', () => E.commitTransit(s, { op: 'edge', mode: 'metro', x: 3, z: 3, h: 0, x2: 4, z2: 3, h2: 0 }), '地鐵必須在地下'],
      ['車站在水上', () => E.commitTransit(s, { op: 'station', mode: 'rail', x: wet.x, z: wet.z, h: 0 }), '水面不能建造'],
      ['車站跟車站重疊', () => E.commitTransit(s, { op: 'station', mode: 'tram', x: st.a.x, z: st.a.z, h: st.a.h }), '與既有站點重疊'],
      ['車站壓在佔用的格上', () => E.commitTransit(s, { op: 'station', mode: 'rail', x: occ.x, z: occ.z, h: occ.h }), '建築占位'],
      ['車站高度跟地形不符', () => E.commitTransit(s, { op: 'station', mode: 'rail', ...freeBoxes(A, c, 2, 1)[40], h: 1 - freeBoxes(A, c, 2, 1)[40].h }), '高度與地形不符'],
      ['車站座標不是整數', () => E.commitTransit(s, { op: 'station', mode: 'rail', x: 2.5, z: 2, h: 0 }), '座標或資金無效'],
      ['地下車站在地面層', () => E.commitTransit(s, { op: 'station', mode: 'metro', x: 3, z: 9, h: 0 }), '地下或地面層不合法'],
      ['車廠出圖', () => E.commitTransit(s, { op: 'depot', mode: 'metro', x: n - 2, z: 0, h: -1 }), '越界'],
      ['碼表外的模式', () => E.commitTransit(s, { op: 'station', mode: 'bus', ...boxCands(A, c, 2, 1)[60] }), '模式無效'],
      ['不認得的操作', () => E.commitTransit(s, { op: 'teleport', mode: 'rail', x: 1, z: 1, h: 0 }), '不認得的運輸施工'],
      ['沒有施工物件', () => E.commitTransit(s, null), '不認得的運輸施工'],
      ['拆除交給 commitTransit', () => E.commitTransit(s, { op: 'del-edge', id: e1.id }), '不認得的運輸施工'],
      ['施工交給 removeTransit', () => E.removeTransit(s, { op: 'edge', mode: 'rail', ...flat[400] }), '不認得的運輸施工'],
      ['拆不存在的軌道', () => E.removeTransit(s, { op: 'del-edge', id: 999 }), '找不到軌道'],
      ['拿車廠的編號拆車站', () => E.removeTransit(s, { op: 'del-station', id: dp.id }), '找不到車站'],
      ['拆還連著軌道的車站', () => E.removeTransit(s, { op: 'del-station', id: st.id }), '請先拆連接的軌道'],
      ['錢不夠（9.99 蓋 10 的軌道）', () => E.commitTransit(s, { op: 'edge', mode: 'rail', ...flat[500] }), '資金不足', () => { s.money = 9.99; }],
      ['錢不夠（119.99 蓋 120 的車站：取整後 119）', () => E.commitTransit(s, { op: 'station', mode: 'rail', ...freeBoxes(A, c, 2, 1)[70] }), '資金不足', () => { s.money = 119.99; }],
      ['錢不夠（299.5 蓋 300 的車廠）', () => E.commitTransit(s, { op: 'depot', mode: 'rail', ...freeBoxes(A, c, 3, 2)[30] }), '資金不足', () => { s.money = 299.5; }],
      ['負債', () => E.commitTransit(s, { op: 'edge', mode: 'metro', x: 3, z: 3, h: -1, x2: 4, z2: 3, h2: -1 }), '資金不足', () => { s.money = -5.25; }],
      ['資金是 NaN', () => E.commitTransit(s, { op: 'edge', mode: 'metro', x: 3, z: 3, h: -1, x2: 4, z2: 3, h2: -1 }), '資金不足', () => { s.money = NaN; }],
      ['編號已滿（nextId 2^31−1）', () => E.commitTransit(s, { op: 'edge', mode: 'metro', x: 3, z: 3, h: -1, x2: 4, z2: 3, h2: -1 }), '識別碼已滿', () => { s.money = 1e6; s.txns.length = 0; c.transit = { ...c.transit, nextId: 2147483647 }; }],
      ['revision 2^31−2：蓋', () => E.commitTransit(s, { op: 'edge', mode: 'metro', x: 3, z: 3, h: -1, x2: 4, z2: 3, h2: -1 }), '路網的修改次數已滿', () => { c.transit = { ...c.transit, nextId: 100, revision: 2147483646 }; }],
      ['revision 2^31−2：拆', () => E.removeTransit(s, { op: 'del-depot', id: dp.id }), '路網的修改次數已滿'],
      ['revision 2^31−3 且今天還有一筆運輸可以復原', () => E.commitTransit(s, { op: 'edge', mode: 'metro', x: 3, z: 3, h: -1, x2: 4, z2: 3, h2: -1 }), '路網的修改次數已滿', () => { c.transit = { ...c.transit, revision: 2147483645 }; s.txns.length = 0; s.txns.push({ g: 0, transit: true, before: undefined, refund: 0 }); }],
    ];
    const done = [];
    for (const [name, call, why, setup] of cases) {
      if (setup) setup();                                                // 前提（資金、上限、待復原的運輸）先套上，再量「之前」
      const before = stateJ(s), refs = [...s.txns];
      const r = call();
      assert.equal(r.ok, false, name); assert.equal(r.spent, 0, name);
      if (why) assert.equal(r.reason, why, `${name}：理由`); else assert.ok(typeof r.reason === 'string' && r.reason.length > 0, name);
      assert.equal(stateJ(s), before, `${name}：提交失敗之後狀態變了`);
      assert.ok(refs.length === s.txns.length && refs.every((t, i) => t === s.txns[i]), `${name}：復原堆疊換了物件`);
      done.push(name);
    }
    // 預覽：同樣的失敗、同樣的理由，什麼都不動
    s.txns.length = 0; c.transit = { ...c.transit, nextId: 100, revision: 50 }; s.money = 9.99;
    const before = stateJ(s), pv = E.previewTransit(s, { op: 'edge', mode: 'rail', ...flat[500] });
    assert.equal(J(pv), J({ ok: false, cost: 0, reason: '資金不足' })); assert.equal(stateJ(s), before);
    // 沒有運輸的城：失敗之後連 transit 鍵都不會出現
    const Q = newcity(A).sim, q0 = stateJ(Q);
    for (const r of [E.removeTransit(Q, { op: 'del-edge', id: 1 }), E.commitTransit(Q, { op: 'edge', mode: 'rail', x: occ.x, z: occ.z, h: occ.h, x2: occ.x + 1, z2: occ.z, h2: T.cell(occ.x + 1, occ.z).elevation }), E.previewTransit(Q, { op: 'station', mode: 'rail', x: wet.x, z: wet.z, h: 0 })]) assert.equal(r.ok, false);
    assert.equal(stateJ(Q), q0); assert.ok(!Object.hasOwn(Q.city, 'transit'));
    return `${done.length} 種失敗（含資金 9.99／119.99／299.5／負債／NaN、nextId 2^31−1、revision 2^31−2、revision 2^31−3＋一筆待復原），預覽與提交都原子；沒有運輸的城失敗後沒有 transit 鍵`;
  });

  check('驗收 5、14：成功的施工——費用照 network.ts（陸 10、水 25、地鐵 30、站 120、廠 300），資金取整後的差用 −= 扣（小數留著）；恰好一筆事件（＝transitEventOf、g＝施工前的 stroke）、一筆可復原；拆除費用 0 不退費；沙盒資金逐位元組不變、費用 0；上限邊界剛好放行', () => {
    const L = newcity(A), s = L.sim, c = s.city, flat = flatOf(A, c), wetE = edgeCands(A, c, (p, q) => !p.occupied && !q.occupied && p.water !== q.water);
    const got = [];
    const one = (q, cost, money0, remove = false) => {
      s.money = money0;
      const pv = E.previewTransit(s, q), h0 = c.history.length, g0 = s.stroke, t0 = s.txns.length, prev = c.transit;
      const r = remove ? E.removeTransit(s, q) : E.commitTransit(s, q);
      assert.equal(r.ok, true, `${q.op}/${q.mode ?? ''}：${r.reason}`);
      assert.equal(J(pv), J({ ok: true, cost }), '預覽的費用'); assert.equal(r.spent, cost);
      assert.ok(Object.is(s.money, money0 - cost), `資金 ${money0} − ${cost} 要剛好等於 ${s.money}`);
      assert.equal(c.history.length, h0 + 1, '恰好一筆事件'); assert.equal(s.stroke, g0 + 1); assert.equal(r.g, g0); assert.equal(s.txns.length, Math.min(t0 + 1, 40));
      const list = q.op.endsWith('edge') ? (remove ? prev.edges : c.transit.edges) : q.op.endsWith('station') ? (remove ? prev.stations : c.transit.stations) : (remove ? prev.depots : c.transit.depots);
      const item = remove ? list.find(e => e.id === q.id) : list.at(-1);
      assert.equal(J(c.history.at(-1)), J(H.transitEventOf(s.day, q.op, item, cost, g0)), '事件＝transitEventOf');
      assert.equal(J(r.event), J(c.history.at(-1)));
      got.push(`${q.op}${q.mode ? '/' + q.mode : ''} ${cost}`);
      return r;
    };
    const a = one({ op: 'edge', mode: 'rail', ...flat[0] }, 10, 50000.75);
    one({ op: 'edge', mode: 'rail', ...wetE[0] }, 25, 50000.75);
    one({ op: 'edge', mode: 'metro', x: 3, z: 3, h: -1, x2: 4, z2: 3, h2: -1 }, 30, 0.3 + 30);
    const st = one({ op: 'station', mode: 'tram', ...freeBoxes(A, c, 2, 1)[20] }, 120, 129.99);
    one({ op: 'station', mode: 'metro', x: 30, z: 50, h: -1 }, 120, 120.5);
    const dp = one({ op: 'depot', mode: 'rail', ...freeBoxes(A, c, 3, 2)[10] }, 300, 1234.5678);
    one({ op: 'del-depot', id: dp.id }, 0, 7.77, true);
    one({ op: 'del-edge', id: a.id }, 0, 0.01, true);
    one({ op: 'del-station', id: st.id }, 0, 999.999, true);
    // 沙盒：資金逐位元組不變、費用 0（同 build.ts 沙盒）；沒錢也蓋得了
    s.diff = 3;
    for (const [q, m0] of [[{ op: 'edge', mode: 'rail', ...flat[600] }, 777.25], [{ op: 'depot', mode: 'tram', ...freeBoxes(A, c, 3, 2)[50] }, 0], [{ op: 'edge', mode: 'metro', x: 9, z: 9, h: -1, x2: 9, z2: 10, h2: -1 }, -12.5]]) {
      s.money = m0; const pv = E.previewTransit(s, q), r = E.commitTransit(s, q);
      assert.ok(r.ok && r.spent === 0 && pv.cost === 0 && Object.is(s.money, m0) && c.history.at(-1).cost === 0, `沙盒 ${q.op}`);
    }
    s.diff = 1; s.money = 1e6;
    // 上限邊界：nextId 2^31−2 還能蓋（蓋完 2^31−1）；revision 2^31−3、沒有待復原的運輸還能蓋，復原後 2^31−1 存檔讀得回來；再蓋就拒絕
    s.txns.length = 0;
    c.transit = { ...c.transit, nextId: 2147483646, revision: 2147483645 };
    const r1 = E.commitTransit(s, { op: 'edge', mode: 'metro', x: 20, z: 60, h: -1, x2: 21, z2: 60, h2: -1 });
    assert.ok(r1.ok && r1.id === 2147483646 && c.transit.nextId === 2147483647 && c.transit.revision === 2147483646, J(r1));
    assert.equal(E.commitTransit(s, { op: 'edge', mode: 'metro', x: 22, z: 60, h: -1, x2: 23, z2: 60, h2: -1 }).ok, false);
    assert.ok(E.undoOp(s).ok); assert.equal(c.transit.revision, 2147483647); assert.equal(c.transit.nextId, 2147483647);
    assert.ok(A.format.parseNetwork(A.format.serializeNetwork(c.transit)).ok, '上限上的路網讀得回來');
    // 拆除不吃編號：nextId 滿了照樣拆得掉
    c.transit = { ...c.transit, revision: 10 };
    const any = c.transit.edges[0]; assert.ok(any); assert.ok(E.removeTransit(s, { op: 'del-edge', id: any.id }).ok, 'nextId 滿了照樣能拆');
    return `${got.join('、')}；沙盒 3 筆資金逐位元組不變；nextId 2^31−2、revision 2^31−3 的邊界放行一次、復原後 parseNetwork 讀得回來`;
  });

  check('驗收 6：同一天跟建築混合的施工，一筆一筆復原（後進先出）——每一步都回到那一筆施工前（三個陣列、資金、Lab 圖層、城市圖層、根格逐位元組相同），恰好多一列 undo（g、退費），歷史只增不改，nextId 不倒退、運輸的復原 revision +1；堆疊上限 40；過一天不能復原', () => {
    const L = newcity(A), s = L.sim, c = s.city; s.money = 50000.75;
    const flat = flatOf(A, c), road = flat[800], t = { n: 5000 };
    const ops = [
      ['路', () => E.commitOp(s, { k: 'line', tool: 'road', x0: road.x, z0: road.z, x1: road.x + 4, z1: road.z }, t.n += 5000)],
      ['鐵路', () => E.commitTransit(s, { op: 'edge', mode: 'rail', ...flatOf(A, c)[0] })],
      ['分區', () => E.commitOp(s, { k: 'rect', tool: 'zr', x0: road.x, z0: road.z + 1, x1: road.x + 3, z1: road.z + 1 }, t.n += 5000)],
      ['車站', () => E.commitTransit(s, { op: 'station', mode: 'rail', ...freeBoxes(A, c, 2, 1)[15] })],
      ['車廠', () => E.commitTransit(s, { op: 'depot', mode: 'tram', ...freeBoxes(A, c, 3, 2)[8] })],
      ['拆車廠', () => E.removeTransit(s, { op: 'del-depot', id: c.transit.depots[0].id })],
      ['地鐵', () => E.commitTransit(s, { op: 'edge', mode: 'metro', x: 30, z: 30, h: -1, x2: 30, z2: 31, h2: -1 })],
      ['警察局', () => E.commitOp(s, { k: 'tap', tool: 'police', x0: road.x + 1, z0: road.z - 1, x1: road.x + 1, z1: road.z - 1 }, t.n += 5000)],
      ['拆鐵路', () => E.removeTransit(s, { op: 'del-edge', id: c.transit.edges[0].id })],
      ['電車', () => E.commitTransit(s, { op: 'edge', mode: 'tram', ...flatOf(A, c)[50] })],
    ];
    const snaps = [], meta = [];
    for (const [name, op] of ops) {
      snaps.push(undoJ(s));
      const r = op();
      assert.ok(r.ok, `${name}：${r.reason}`);
      meta.push({ name, g: r.g, spent: r.spent, transit: !('placed' in r) });
    }
    let maxId = c.transit.nextId, undone = 0;
    for (let k = ops.length - 1; k >= 0; k--) {
      const h0 = c.history.length, prefix = J(c.history), rev = c.transit.revision, tiles0 = J(s.w.tiles);
      const u = E.undoOp(s);
      assert.ok(u.ok, `復原「${meta[k].name}」`);
      assert.equal(undoJ(s), snaps[k], `復原「${meta[k].name}」之後跟施工前不同`);
      assert.equal(c.history.length, h0 + 1, '恰好多一列'); assert.equal(J(c.history.slice(0, h0)), prefix.slice(0), '歷史只增不改');
      const row = c.history.at(-1); assert.equal(row.t, 'undo'); assert.equal(row.g, meta[k].g);
      if (meta[k].transit) { assert.equal(row.refund, meta[k].spent, '退這一筆扣的錢（拆除 0）'); assert.equal(u.refund, meta[k].spent); assert.equal(c.transit.revision, rev + 1, 'revision +1'); assert.equal(J(s.w.tiles), tiles0, '運輸的復原不碰格子（連 wr 都不動）'); }
      else assert.equal(c.transit.revision, rev, '格子的復原不動路網');
      assert.ok(c.transit.nextId >= maxId, 'nextId 不倒退'); maxId = c.transit.nextId; undone++;
    }
    assert.equal(E.canUndo(s), false);
    const s0 = stateJ(s); assert.equal(J(E.undoOp(s)), J({ ok: false, refund: 0 })); assert.equal(stateJ(s), s0);
    // 混合的歷史照樣讀得回來（重播的復原：運輸先查、格子後查）
    const back = loadOk(A, A.save.saveCode(s, L.template, L.start)); assert.ok(back.replayed, back.note); assert.equal(J(back.sim.city.transit), J(c.transit));
    // 堆疊上限 40：45 筆地鐵，只能復原最後 40 筆
    for (let i = 0; i < 45; i++) assert.ok(E.commitTransit(s, { op: 'edge', mode: 'metro', x: i, z: 70, h: -1, x2: i + 1, z2: 70, h2: -1 }).ok);
    let k40 = 0; while (E.undoOp(s).ok) k40++;
    assert.equal(k40, 40); assert.equal(J(c.transit.edges.filter(e => e.a.z === 70).map(e => e.a.x)), J([0, 1, 2, 3, 4]));
    // 過一天：之前的施工不能再復原
    assert.ok(E.commitTransit(s, { op: 'edge', mode: 'metro', x: 50, z: 71, h: -1, x2: 51, z2: 71, h2: -1 }).ok);
    A.day.stepDay(s);
    const d0 = J([c.transit, s.money, c.history.length]); assert.equal(E.canUndo(s), false); assert.equal(E.undoOp(s).ok, false); assert.equal(J([c.transit, s.money, c.history.length]), d0);
    return `${ops.length} 筆（${meta.filter(m => m.transit).length} 筆運輸、${meta.filter(m => !m.transit).length} 筆格子）逐筆復原都回到施工前；上限 40；過一天不能復原；混合歷史讀回重播成功`;
  });

  check('反向守衛：城裡有運輸時，非拆除的施工（路、水管、分區、點放；多格建築不論點、線、框，每一格都算整塊占地）碰到地面軌道端點或地面站廠就整筆拒絕（「運輸設施擋住」、什麼都不動）；地鐵不擋；拆除照常；沒有運輸的城、拆掉之後、第一次蓋又復原之後都不擋', () => {
    const L = newcity(A, 1e6), s = L.sim, c = s.city, n = c.n;
    // 地面件離地圖邊至少 5 格：每個地面格的 5×5 占地手勢（根格在左上 4 格）都在圖內，每一種手勢都真的會產生
    const inner = a => a.x >= 5 && a.z >= 5 && (a.x2 ?? a.x) + 6 <= n && (a.z2 ?? a.z) + 6 <= n;
    const e = build(A, s, 'edge', 'rail', flatOf(A, c).filter(inner), 30), st = build(A, s, 'station', 'rail', freeBoxes(A, c, 2, 1).filter(inner), 25), dp = build(A, s, 'depot', 'tram', freeBoxes(A, c, 3, 2).filter(inner), 12);
    const me = build(A, s, 'edge', 'metro', freeEdges(A, c, flatOf(A, c)).slice(200).map(a => ({ ...a, h: -1, h2: -1 }))), ms = build(A, s, 'station', 'metro', freeBoxes(A, c, 2, 1).slice(90).map(a => ({ ...a, h: -1 })));
    const surface = [[e.a.x, e.a.z], [e.a.x2, e.a.z2], [st.a.x, st.a.z], [st.a.x + 1, st.a.z], ...[0, 1].flatMap(dz => [0, 1, 2].map(dx => [dp.a.x + dx, dp.a.z + dz]))];
    const surfaceSet = new Set(surface.map(([x, z]) => z * n + x));
    assert.equal(J([...surfaceSet].sort((p, q) => p - q)), J([...A.history.surfaceTransitCells(c.transit, n)].sort((p, q) => p - q)), '測試列的地面格＝history.ts 算的地面格');
    const metro = [[me.a.x, me.a.z], [me.a.x2, me.a.z2], [ms.a.x, ms.a.z], [ms.a.x + 1, ms.a.z]];
    // 多格建築的根格都不在那一格上，只有占地蓋到：點（3×3）、框（2×2、3×3）、線（2×2、5×5）
    const opsAt = (x, z) => [
      { k: 'line', tool: 'road', x0: x, z0: z, x1: x, z1: z }, { k: 'line', tool: 'wpipe', x0: x - 1, z0: z, x1: x + 1, z1: z },
      { k: 'rect', tool: 'zr', x0: x, z0: z, x1: x, z1: z }, { k: 'rect', tool: 'zi', x0: x - 1, z0: z - 1, x1: x + 1, z1: z + 1 },
      { k: 'tap', tool: 'police', x0: x, z0: z, x1: x, z1: z }, { k: 'tap', tool: 'park', x0: x, z0: z, x1: x, z1: z },
      { k: 'tap', tool: 'megaproject', x0: x - 2, z0: z - 2, x1: x - 2, z1: z - 2 },
      { k: 'rect', tool: 'farm', x0: x - 1, z0: z - 1, x1: x - 1, z1: z - 1 }, { k: 'rect', tool: 'megaproject', x0: x - 2, z0: z - 1, x1: x - 2, z1: z - 1 },
      { k: 'line', tool: 'market', x0: x - 1, z0: z, x1: x - 1, z1: z }, { k: 'line', tool: 'bigFarm', x0: x - 4, z0: z - 4, x1: x - 4, z1: z - 4 },
    ];
    const G = opsAt(0, 0).length, multi = op => E.toolSize(op.tool) > 1, rootOff = op => !surfaceSet.has(op.z0 * n + op.x0);
    const footOnly = { tap: 0, line: 0, rect: 0 };   // 根格不在地面格上、只靠占地擋下的次數（span 只算點放或不展開的寫法在這裡漏）
    let blocked = 0;
    for (const [x, z] of surface) for (const op of opsAt(x, z)) {
      const before = stateJ(s), pv = E.previewOp(s, op);
      assert.equal(pv.reason, BLOCKED, `預覽 ${op.k} ${op.tool}@${op.x0},${op.z0}（地面格 ${x},${z}）`); assert.equal(pv.count, 0);
      const r = E.commitOp(s, op, 9e9);
      assert.equal(J([r.ok, r.placed, r.spent, r.events.length, r.reason]), J([false, 0, 0, 0, BLOCKED]), `提交 ${op.k} ${op.tool}@${op.x0},${op.z0}（地面格 ${x},${z}）`);
      assert.equal(stateJ(s), before, `${op.k} ${op.tool}@${op.x0},${op.z0}：被擋了狀態還是變了`);
      if (multi(op) && rootOff(op)) footOnly[op.k]++;
      blocked++;
    }
    assert.equal(blocked, surface.length * G, `每個地面格的 ${G} 種手勢都要測到`);
    for (const k of ['tap', 'line', 'rect']) assert.ok(footOnly[k] > 0, `多格建築用 ${k} 而且根格不在地面格上的情況沒測到`);
    // 對照：沒有運輸的城，同樣的手勢、同樣的格子不會被這一條擋（多半蓋得成；每一筆蓋完就復原，彼此不互擋）；
    // 線、框的多格建築真的會把整塊占地蓋到那些格上（根格不在那一格、那一格卻多了指向根格的建築）——反向守衛不擋，就會蓋到軌道上
    const Q = newcity(A, 1e6).sim; let free = 0, placed = 0;
    const onTrack = { line: 0, rect: 0 };
    for (const [x, z] of surface) for (const op of opsAt(x, z)) {
      const t0 = Q.txns.length, r = E.commitOp(Q, op, 9e9); assert.notEqual(r.reason, BLOCKED); free++; if (r.ok) placed++;
      const b = Q.w.tiles[z * n + x].bld;
      if (r.ok && multi(op) && op.k !== 'tap' && rootOff(op) && b && J(b.ref) === J([op.x0, op.z0])) onTrack[op.k]++;
      while (Q.txns.length > t0) assert.ok(E.undoOp(Q).ok);
    }
    assert.ok(placed > surface.length, `沒有運輸的城應該蓋得成大半（${placed}／${free}）`);
    assert.ok(onTrack.line > 0 && onTrack.rect > 0, `沒有運輸的城裡，線與框的多格建築應該蓋得到那些格（線 ${onTrack.line}、框 ${onTrack.rect}）`);
    // 地鐵不擋：路蓋得上去
    for (const [x, z] of metro) { const r = E.commitOp(s, { k: 'line', tool: 'road', x0: x, z0: z, x1: x, z1: z }, 9e9); assert.notEqual(r.reason, BLOCKED, `地鐵格 ${x},${z}`); assert.ok(r.ok, `地鐵格上鋪路：${r.reason}`); }
    // 拆除照常（不被擋；路網不動）；軌道旁邊一格不擋
    const net0 = J(c.transit);
    for (const [x, z] of surface) { const pv = E.previewOp(s, { k: 'rect', tool: 'doze', x0: x, z0: z, x1: x, z1: z }); assert.notEqual(pv.reason, BLOCKED); const r = E.commitOp(s, { k: 'rect', tool: 'doze', x0: x - 1, z0: z, x1: x + 1, z1: z }, 9e9); assert.notEqual(r.reason, BLOCKED); }
    assert.equal(J(c.transit), net0, '拆除不動路網');
    // 拆掉軌道之後，那兩格就不擋了（車站、車廠的格照擋）
    assert.ok(E.removeTransit(s, { op: 'del-edge', id: e.id }).ok);
    for (const [x, z] of surface.slice(0, 2)) if (!surface.slice(2).some(([a, b]) => a === x && b === z)) assert.notEqual(E.previewOp(s, { k: 'rect', tool: 'zr', x0: x, z0: z, x1: x, z1: z }).reason, BLOCKED);
    assert.equal(E.previewOp(s, { k: 'rect', tool: 'zr', x0: st.a.x, z0: st.a.z, x1: st.a.x, z1: st.a.z }).reason, BLOCKED);
    // 第一次蓋又復原：路網是空的三個陣列（鍵還在），什麼都不擋
    const P = newcity(A, 1e6).sim, pe = build(A, P, 'edge', 'rail', flatOf(A, P.city), 30);
    assert.ok(E.undoOp(P).ok); assert.ok(Object.hasOwn(P.city, 'transit') && P.city.transit.edges.length === 0);
    assert.notEqual(E.previewOp(P, { k: 'line', tool: 'road', x0: pe.a.x, z0: pe.a.z, x1: pe.a.x2, z1: pe.a.z2 }).reason, BLOCKED);
    return `${surface.length} 個地面格 × ${G} 種手勢＝${blocked} 次都擋下且狀態不變（多格建築根格不在地面格上、只靠占地擋下：點 ${footOnly.tap}、線 ${footOnly.line}、框 ${footOnly.rect}）；沒有運輸的城同樣手勢 ${placed}／${free} 蓋得成，線與框的多格建築把占地蓋到那些格 ${onTrack.line}／${onTrack.rect} 次；地鐵 ${metro.length} 格鋪得了路；拆除不擋`;
  });

  check('存讀：真的 saveCode／loadCode（hv2、hv3）讀回施工、復原、拆除、跨日、沙盒的城——重播逐位元組相同（路網、歷史、資金、手勢編號），讀回之後接著蓋、復原、拆，跟沒存讀的那一份一樣，再存再讀照樣相同', () => {
    const mkCity = sandbox => {
      const L = newcity(A, 80000.5), s = L.sim, c = s.city; if (sandbox) s.diff = 3;
      const flat = () => flatOf(A, c);
      const e1 = build(A, s, 'edge', 'rail', flat()), slope = edgeCands(A, c, (p, q) => land(p, q) && p.elevation !== q.elevation);
      build(A, s, 'edge', 'rail', slope); build(A, s, 'edge', 'rail', edgeCands(A, c, (p, q) => !p.occupied && !q.occupied && p.water !== q.water));
      build(A, s, 'station', 'tram', freeBoxes(A, c, 2, 1), 30); build(A, s, 'depot', 'rail', freeBoxes(A, c, 3, 2), 7);
      A.day.stepDay(s);
      E.commitOp(s, { k: 'line', tool: 'road', x0: 10, z0: 60, x1: 14, z1: 60 }, 1000);
      build(A, s, 'edge', 'metro', [{ x: 40, z: 40, h: -1, x2: 41, z2: 40, h2: -1 }]);
      assert.ok(E.undoOp(s).ok); assert.ok(E.undoOp(s).ok);   // 先復原地鐵、再復原路
      assert.ok(E.removeTransit(s, { op: 'del-edge', id: e1.id }).ok);
      build(A, s, 'station', 'metro', [{ x: 30, z: 50, h: -1 }]);
      A.day.stepDay(s); A.day.stepDay(s);
      assert.ok(E.removeTransit(s, { op: 'del-station', id: c.transit.stations.find(q => q.mode === 'metro').id }).ok); assert.ok(E.undoOp(s).ok);   // 復原拆（站回到原位）
      s.money = Math.round(s.money);   // 存檔的 money 是 Math.round（save.ts，實驗線格式）：先取整，讀回來的才跟原本的逐位元組相同（帶小數的資金在驗收 5 驗）
      return { L, s };
    };
    const out = [];
    for (const sandbox of [false, true]) {
      const { L, s } = mkCity(sandbox), c = s.city;
      const id = 'd101-construction', half = A.journal.packMore(c.history.slice(0, 4), A.journal.PACK0);   // hv3：前 4 列在日誌、其餘在存檔的尾巴
      const codes = [['hv2', A.save.saveCode(s, L.template, L.start), undefined], ['hv3', A.save.saveCode(s, L.template, L.start, { journal: { id, st: half.st } }), { id, rows: half.rows }]];
      const replayed = A.replay.replayCity(L.start, c.history, A.KT, s.day);
      assert.equal(J(replayed.transit), J(c.transit), 'replayCity 的路網');
      const sims = [s];
      for (const [hv, code, j] of codes) {
        const raw = rawOf(A, code); assert.equal(raw.d3.f, 12); assert.equal(J(raw.d3.rt), J(A.format.serializeNetwork(c.transit)));
        const R = loadOk(A, code, j);
        assert.ok(R.replayed, `${hv}：${R.note}`);
        assert.equal(J(R.sim.city.transit), J(c.transit), hv + '：路網'); assert.equal(J(R.sim.city.history), J(c.history), hv + '：歷史');
        assert.ok(Object.is(R.sim.money, s.money), hv + '：資金'); assert.equal(R.sim.stroke, s.stroke, hv + '：手勢編號');
        sims.push(R.sim);
      }
      // 接著蓋：三份同樣的操作，結果逐位元組相同
      const cont = q => {
        const c0 = q.city, flat = flatOf(A, c0);
        const r1 = E.commitTransit(q, { op: 'edge', mode: 'tram', ...flat[100] }), r2 = E.commitTransit(q, { op: 'station', mode: 'rail', ...freeBoxes(A, c0, 2, 1)[44] });
        const u = E.undoOp(q), r3 = E.removeTransit(q, { op: 'del-edge', id: r1.id });
        assert.ok(r1.ok && r2.ok && u.ok && r3.ok, J([r1.reason, r2.reason, r3.reason]));
        return J([r1, r2, u, r3, c0.transit, q.money, c0.history, q.stroke]);
      };
      const results = sims.map(cont);
      assert.equal(results[1], results[0], 'hv2 讀回之後接著蓋'); assert.equal(results[2], results[0], 'hv3 讀回之後接著蓋');
      const again = loadOk(A, A.save.saveCode(sims[1], L.template, L.start));
      assert.ok(again.replayed, again.note); assert.equal(J(again.sim.city.transit), J(s.city.transit));
      out.push(`${sandbox ? '沙盒' : '一般'}：路網 ${c.transit.edges.length} 條、${c.transit.stations.length} 站、${c.transit.depots.length} 廠，歷史 ${c.history.length} 筆`);
    }
    return out.join('；') + '；hv2／hv3 讀回、接著蓋、再存再讀都相同';
  });

  check('驗收 21：地面軌道格四周 8 棟 lv3 住宅的 3×3 窗（6 窗 12 格、種子 8 個、各 60 天）——有運輸：0 格被巨型合併吸收、軌道格沒有建築、路網與存檔的 rt 不變、讀回正常；蓋完存檔讀回再跑（遮罩由 loadSim 登記）照樣 0 格；同一局面不蓋運輸：每個種子都有軌道格被吸收', () => {
    const rows = [];
    for (const seed of SEEDS21) {
      const T = run21(A, seed, 'transit'), R = run21(A, seed, 'reload'), B = run21(A, seed, 'none');
      regOk(T.reg, `種子 ${seed}：施工後`); regOk(R.regLoaded, `種子 ${seed}：讀檔後`); regOk(B.reg, `種子 ${seed}：沒有運輸`);
      assert.equal(T.absorbed, 0, `種子 ${seed}：有運輸還是吸收了 ${T.absorbed} 格`); assert.equal(T.covered, 0, `種子 ${seed}：軌道格上有建築`);
      assert.equal(R.absorbed, 0, `種子 ${seed}：存讀之後吸收了 ${R.absorbed} 格（loadSim 沒登記遮罩？）`); assert.equal(R.covered, 0);
      assert.equal(T.netEnd, T.netBuilt, '路網不變'); assert.equal(J(T.rt), J(A.format.serializeNetwork(JSON.parse(T.netBuilt))), '存檔的 rt＝蓋完的路網');
      const back = loadOk(A, T.code); assert.ok(back.replayed, back.note);
      assert.ok(B.absorbed > 0, `種子 ${seed}：不蓋運輸卻沒有軌道格被吸收（局面沒觸發）`);
      rows.push(`${seed % 100}:${B.absorbed}/${B.megas}`);
    }
    return `有運輸（直接、存讀後）各 ${SEEDS21.length} 個種子 0 格；不蓋運輸被吸收的格／巨型合併數 ${rows.join(' ')}`;
  });

  // ---- 驗收 21 的四種變體（第 2 輪核對 R2-1）：業主 11-06 規則的另外三部分——車站、車廠的格子要擋，地鐵不擋，遮罩剛好等於地面格（不多擋旁邊的格）----
  // 站廠兩種：有運輸（直接跑、存讀後再跑）每個種子 0 次吸收、跑完站廠格上沒有建築；世界在施工後／讀檔後逐格探，登記的遮罩就是地面格；同一個版型沒有運輸，每個種子都有站廠格被吸收（不是空測）
  const surfaceVariant = (variant, base) => {
    const cells = cellsOf21(variant), rows = [];
    for (const seed of SEEDS21) {
      const T = run21(A, seed, 'transit', false, variant);
      regOk(T.reg, `種子 ${seed}：施工後`);
      assert.equal(T.absorbed, 0, `種子 ${seed}：有運輸還是吸收了 ${T.absorbed} 次`); assert.equal(T.covered, 0, `種子 ${seed}：跑完 ${T.covered} 格上有建築`);
      const R = run21(A, seed, 'reload', false, variant);
      regOk(R.regLoaded, `種子 ${seed}：讀檔後`);
      assert.equal(R.absorbed, 0, `種子 ${seed}：存讀之後吸收了 ${R.absorbed} 次`); assert.equal(R.covered, 0, `種子 ${seed}：存讀之後跑完 ${R.covered} 格上有建築`);
      assert.equal(T.netEnd, T.netBuilt, `種子 ${seed}：路網變了`);
      const B = run21(A, seed, 'none', false, base);
      regOk(B.reg, `種子 ${seed}：沒有運輸`);
      const bh = hitOf(B, cells), bb = bldOf(B, cells);
      assert.ok(bh > 0 && bb > 0, `種子 ${seed}：沒有運輸卻沒有一格被吸收（${bh} 次、${bb} 格）——局面沒觸發，這一項是空測`);
      rows.push(`${seed % 100}:${bh}/${bb}`);
    }
    return `有運輸（直接、存讀後）各 ${SEEDS21.length} 個種子 0 次吸收、0 格有建築，施工後與讀檔後登記的遮罩逐格＝地面格（${cells.size} 格）；沒有運輸時被吸收的次數／跑完有建築的格數 ${rows.join(' ')}`;
  };
  check('驗收 21（車站變體）：同一個 M2 局面，六個窗旁各蓋一座鐵路車站（2×1，(x0−1,32)–(x0,32)，右邊那格在窗裡）——有運輸：直接跑、存讀後再跑，車站格都不被巨型合併吸收；施工後、讀檔後世界登記的遮罩逐格就是地面格；沒有運輸的對照（就是驗收 21 那一份：車站格＝那 12 格軌道格，資金不參與這個對照）每個種子都吸收得到', () =>
    surfaceVariant('station', 'track'));
  check('驗收 21（車廠變體）：車廠版型（六個窗每 5 格一個，左欄上兩格是空地），每窗左邊蓋一座鐵路車廠（3×2，(x0−2,31)–(x0,32)，右欄兩格在窗裡）——有運輸：直接跑、存讀後再跑，車廠格都不被吸收；施工後、讀檔後登記的遮罩逐格就是地面格；同一版型沒有運輸（資金照樣扣 1800）每個種子都吸收得到', () =>
    surfaceVariant('depot', 'depot'));
  check('驗收 21（地鐵變體）：同一個 M2 局面，六段地鐵在窗底下（(x0−1,32)–(x0,32)，h＝−1）——地鐵不擋：每個種子 60 天的 sim hash、亂數呼叫次數、合併清單都跟沒有運輸（資金照樣扣 180）逐一相同；登記的遮罩一格都不擋；沒有運輸時那 12 格每個種子都被吸收（相同＝地鐵格照樣被吸收）', () => {
    const cells = cellsOf21('metro'), rows = [];
    for (const seed of SEEDS21) {
      const M = run21(A, seed, 'transit', false, 'metro'), B = run21(A, seed, 'none', false, 'metro');
      regOk(M.reg, `種子 ${seed}：施工後`); assert.equal(M.reg.surface, 0); assert.ok(M.reg.probed >= cells.size, '地鐵格都要探到');
      assert.equal(J(M.merges), J(B.merges), `種子 ${seed}：合併清單跟沒有運輸不同`);
      assert.equal(J(M.fp), J(B.fp), `種子 ${seed}：每天的 hash／亂數次數跟沒有運輸不同`);
      assert.equal(hitOf(M, cells), hitOf(B, cells));
      assert.ok(hitOf(B, cells) > 0, `種子 ${seed}：沒有運輸時地鐵那幾格沒被吸收——這一項是空測`);
      rows.push(`${seed % 100}:${hitOf(M, cells)}`);
    }
    return `${SEEDS21.length} 個種子 × ${DAYS21} 天逐一相同；地鐵格被吸收的次數（兩邊相同）${rows.join(' ')}`;
  });
  check('驗收 21（軌道旁變體）：同一個 M2 局面，軌道蓋在窗外那一欄 (x0−1,31)–(x0−1,32)——軌道格一次都不被吸收；緊鄰的窗內空地 (x0,32) 不擋（施工後登記的遮罩逐格就是地面格，四鄰不在裡面），每個種子都照樣被巨型合併吸收，跟沒有運輸（驗收 21 的對照，資金同樣扣 60）一樣吸收得到', () => {
    const next = cellsOf21('beside'), track = cellsOf21('beside', 'block'), rows = [];
    for (const seed of SEEDS21) {
      const T = run21(A, seed, 'transit', false, 'beside'), B = run21(A, seed, 'none');
      regOk(T.reg, `種子 ${seed}：施工後`);   // (x0,32) 是軌道格 (x0−1,32) 的四鄰，探過了：沒擋
      const surf = A.history.surfaceTransitCells(JSON.parse(T.netBuilt), N21);
      assert.equal(J([...surf].sort((p, q) => p - q)), J([...track].sort((p, q) => p - q)), '地面格就是那 12 格軌道格'); assert.ok(![...next].some(i => surf.has(i)));
      assert.equal(hitOf(T, track), 0, `種子 ${seed}：軌道格被吸收了 ${hitOf(T, track)} 次`); assert.equal(bldOf(T, track), 0, `種子 ${seed}：軌道格上有建築`);
      assert.ok(hitOf(T, next) > 0, `種子 ${seed}：有運輸時軌道旁的 (x0,32) 一次都沒被吸收（遮罩太寬？）`);
      assert.ok(hitOf(B, next) > 0, `種子 ${seed}：沒有運輸時 (x0,32) 沒被吸收——這一項是空測`);
      rows.push(`${seed % 100}:${hitOf(T, next)}/${hitOf(B, next)}`);
    }
    return `軌道格 ${SEEDS21.length} 個種子都 0 次；軌道旁 (x0,32) 被吸收的次數（有運輸／沒有運輸）${rows.join(' ')}`;
  });

  check('驗收 15b（更正後第一條）：會觸發的局面裡，蓋了運輸但拿掉遮罩的城，跟沒蓋運輸（資金照樣扣）的城每天的 sim hash、亂數呼叫次數逐一相同，存檔裡實驗線看得到的欄位逐位元組相同——運輸只經由巨型合併的遮罩影響模擬', () => {
    const rows = [];
    for (const seed of SEEDS21) {
      const B = run21(A, seed, 'none'), C = run21(A, seed, 'nomask');
      assert.equal(J(C.fp), J(B.fp), `種子 ${seed}：每天的 hash／亂數次數`);
      assert.equal(J(labFields(C.raw)), J(labFields(B.raw)), `種子 ${seed}：實驗線欄位`);
      assert.ok(C.rt && !B.rt);
      rows.push(seed % 100);
    }
    return `${rows.length} 個種子 × ${DAYS21} 天逐一相同（含沒遮罩時被吸收的軌道格）`;
  });

  check('遮罩＝地面格（第 2 輪核對 R2-1）：一座城依序蓋鐵路車站（第一筆就是車站）、電車車廠、地鐵車站、地鐵車廠、地鐵軌道、鐵路與電車軌道，再拆站、復原拆站、存讀——每一步 transitSurface 跟 surfaceTransitCells 逐格相同，世界登記的遮罩逐格探（地面格、地鐵件的格、兩種格的四鄰、每 97 格一格）：被擋 ⇔ 地面格；沒有運輸的城一格都不擋；第一筆是車廠也登記；第一次蓋又復原（空路網）一格都不擋；守衛到這裡建過的每一張路網都核過', () => {
    const L = newcity(A, 1e6), s = L.sim, c = s.city, n = c.n, rows = [];
    const look = (q, tag) => { assert.equal(surfaceDiff(H, q.city), null, `${tag}：transitSurface ≠ surfaceTransitCells`); const m = maskMatch(A, q, 97); regOk(m, tag); rows.push(`${tag} ${m.blocked}/${m.probed}`); return m; };
    look(s, '沒有運輸');
    const inner = a => a.x >= 3 && a.z >= 3 && (a.x2 ?? a.x) + 5 <= n && (a.z2 ?? a.z) + 5 <= n;
    build(A, s, 'station', 'rail', freeBoxes(A, c, 2, 1).filter(inner), 25); look(s, '第一筆＝鐵路車站');
    build(A, s, 'depot', 'tram', freeBoxes(A, c, 3, 2).filter(inner), 12); look(s, '電車車廠');
    build(A, s, 'station', 'metro', freeBoxes(A, c, 2, 1).filter(inner).slice(60).map(a => ({ ...a, h: -1 }))); look(s, '地鐵車站');
    build(A, s, 'depot', 'metro', freeBoxes(A, c, 3, 2).filter(inner).slice(40).map(a => ({ ...a, h: -1 }))); look(s, '地鐵車廠');
    build(A, s, 'edge', 'metro', freeEdges(A, c, flatOf(A, c)).filter(inner).slice(200).map(a => ({ ...a, h: -1, h2: -1 }))); look(s, '地鐵軌道');
    build(A, s, 'edge', 'rail', freeEdges(A, c, flatOf(A, c)).filter(inner), 30); build(A, s, 'edge', 'tram', freeEdges(A, c, flatOf(A, c)).filter(inner), 300); look(s, '鐵路、電車軌道');
    const t = c.transit;
    assert.equal(J([t.edges.map(e => e.mode), t.stations.map(q => q.mode), t.depots.map(q => q.mode)]), J([['metro', 'rail', 'tram'], ['rail', 'metro'], ['tram', 'metro']]));
    assert.ok(E.removeTransit(s, { op: 'del-station', id: t.stations[0].id }).ok); look(s, '拆掉鐵路車站');
    assert.ok(E.undoOp(s).ok); look(s, '復原拆站');
    const back = loadOk(A, A.save.saveCode(s, L.template, L.start)); assert.ok(back.replayed, back.note); assert.equal(J(back.sim.city.transit), J(c.transit)); look(back.sim, '讀檔後');
    const P = newcity(A, 1e6).sim;
    build(A, P, 'depot', 'rail', freeBoxes(A, P.city, 3, 2), 9); look(P, '另一座城第一筆＝車廠');
    assert.ok(E.undoOp(P).ok); assert.equal(look(P, '第一次蓋又復原（空路網）').surface, 0);
    assert.deepEqual(A.surfaceLog.bad, [], '守衛建過的路網裡有 transitSurface ≠ surfaceTransitCells');
    return `${rows.join('；')}（擋到的格／探的格）；守衛到這裡核過 ${A.surfaceLog.n} 次 transitSurface＝surfaceTransitCells（每一次施工、拆除、復原之後與每一次讀檔之後），0 次不同`;
  });
  return out;
}

// ---- 驗收 8：沒有運輸的城跑 120 天（現行 vs 76e074f）——每天的 sim hash 與亂數呼叫次數、最後的存檔碼 ----
async function noTransit120(A, codes) {
  const out = {};
  const day120 = (id, L, act) => {
    const s = L.sim, cnt = countRng(s), fp = [];
    for (let d = 1; d <= 120; d++) { if (act) act(s, d); A.day.stepDay(s); fp.push([A.day.simHash(s), cnt.n]); }
    out[id] = { fp, code: A.save.saveCode(s, L.template, L.start), key: Object.hasOwn(s.city, 'transit') };
  };
  {   // newcity：每三天施工（路、分區、警局、水管、拆、復原），第 4 天政策、預算、研究
    const L = loadOk(A, A.sample('newcity')), N = L.sim.w.N; L.sim.money = 200000; let t = 0, row = 8;
    const freeRow = (s, len) => {
      for (; row < N - 3; row++) for (let x = 2; x + len < N - 2; x++) {
        let ok = true;
        for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = 0; dx < len; dx++) { const tl = s.w.tiles[(row + dz) * N + x + dx]; if (tl.t === 0 || tl.bld || tl.road || tl.zone) { ok = false; break; } }
        if (ok) { const r = row; row += 4; return [x, r]; }
      }
      return null;
    };
    day120('newcity-施工', L, (s, d) => {
      const op = o => { t += 5000; return A.edit.commitOp(s, o, t); };
      if (d % 3 === 1) {
        const at = freeRow(s, 8);
        if (at) {
          const [x, z] = at;
          op({ k: 'line', tool: 'road', x0: x, z0: z, x1: x + 7, z1: z }); op({ k: 'rect', tool: ['zr', 'zc', 'zi'][d % 3], x0: x, z0: z - 1, x1: x + 5, z1: z - 1 });
          op({ k: 'rect', tool: 'zr', x0: x, z0: z + 1, x1: x + 5, z1: z + 1 }); op({ k: 'tap', tool: 'police', x0: x + 7, z0: z + 1, x1: x + 7, z1: z + 1 });
          op({ k: 'line', tool: 'wpipe', x0: x, z0: z + 1, x1: x + 6, z1: z + 1 }); op({ k: 'rect', tool: 'doze', x0: x + 5, z0: z - 1, x1: x + 5, z1: z - 1 });
          op({ k: 'rect', tool: 'zc', x0: x + 6, z0: z - 1, x1: x + 6, z1: z - 1 }); A.edit.undoOp(s);
        }
        if (d === 4) { A.edit.setPolicy(s, 'curfew', true); A.edit.setBudget(s, 'edu', 0.1); A.edit.startResearch(s, 'A1'); }
      }
    });
  }
  for (const [id, code] of codes) day120(id, loadOk(A, code));
  return out;
}

// ---- 突變副本：整個 src 複製到暫存目錄，改一處（錨點恰好一處），只跑預期會紅的那幾項 ----
const MUTANTS = [
  { name: '巨型合併拿掉遮罩判斷', file: 'src/sim/rules/merge.ts', from: '!(blocked && blocked[qi]) && ', to: '', expect: ['驗收 21：'] },
  { name: '讀檔不登記遮罩', file: 'src/io/save.ts', from: /^  if \(c\.transit\) setMergeSurface\([^\n]*\n/m, to: '', expect: ['驗收 21：'] },
  { name: '施工不登記遮罩', file: 'src/sim/edit.ts', from: /^  setMergeSurface\(s\.w, transitSurface\(\(\) => s\.city\)\);[^\n]*\n/m, to: '', expect: ['驗收 21：'] },
  { name: '遮罩連地鐵也算（地面格多了地下的）', file: 'src/sim/transit/history.ts', from: "for (const e of net.edges) if (e.mode !== 'metro')", to: 'for (const e of net.edges) if (e.mode)', expect: ['反向守衛：'] },
  { name: 'commitOp 拿掉反向守衛', file: 'src/sim/edit.ts', from: /^  if \(transitBlocks\(s, op\)\) return \{ ok: false[^\n]*\n/m, to: '', expect: ['反向守衛：'] },
  { name: 'previewOp 拿掉反向守衛', file: 'src/sim/edit.ts', from: /^  if \(transitBlocks\(s, op\)\) return \{ cells: \[\][^\n]*\n/m, to: '', expect: ['反向守衛：'] },
  { name: '拆除也被擋', file: 'src/sim/edit.ts', from: "if (!net || op.tool === 'doze') return false;", to: 'if (!net) return false;', expect: ['反向守衛：'] },
  { name: '反向守衛只在點放時展開占地（線、框的多格建築漏擋）', file: 'src/sim/edit.ts', from: 'const span = toolSize(op.tool), n = s.w.N;', to: "const span = op.k === 'tap' ? toolSize(op.tool) : 1, n = s.w.N;", expect: ['反向守衛：'] },
  { name: '反向守衛不展開占地', file: 'src/sim/edit.ts', from: 'const span = toolSize(op.tool), n = s.w.N;', to: 'const span = 1, n = s.w.N;', expect: ['反向守衛：'] },
  { name: '復原不退費', file: 'src/sim/edit.ts', from: '  s.money += t.refund;\n', to: '', expect: ['驗收 6：'] },
  { name: '施工不推復原堆疊', file: 'src/sim/edit.ts', from: /^  pushTxn\(s\.txns as TransitTxn\[\][^\n]*\n/m, to: '', expect: ['驗收 6：'] },
  { name: '復原讓 nextId 倒退', file: 'src/sim/transit/history.ts', from: 'nextId: Math.max(cur.nextId, b.nextId)', to: 'nextId: b.nextId', expect: ['驗收 6：'] },
  { name: '資金不取整', file: 'src/sim/edit.ts', from: 'Math.min(Math.floor(s.money), Number.MAX_SAFE_INTEGER)', to: 'Math.min(s.money, Number.MAX_SAFE_INTEGER)', expect: ['驗收 5、14：', '驗收 5：'] },
  { name: '扣錢丟掉小數', file: 'src/sim/edit.ts', from: '  s.money -= r.cost;\n', to: '  s.money = Math.floor(s.money) - r.cost;\n', expect: ['驗收 5、14：'] },
  { name: '沙盒照扣', file: 'src/sim/edit.ts', from: 'cost: sandbox ? 0 : funds - r.money', to: 'cost: funds - r.money', expect: ['驗收 5、14：'] },
  { name: '事件的費用記 0', file: 'src/sim/edit.ts', from: 'transitEventOf(s.day, q.op, r.item, r.cost, g)', to: 'transitEventOf(s.day, q.op, r.item, 0, g)', expect: ['驗收 5、14：'] },
  { name: '失敗也吃一個手勢編號', file: 'src/sim/edit.ts', from: '  if (!r.ok) return { ok: false, spent: 0, reason: r.reason };\n  const before', to: '  if (!r.ok) { s.stroke++; return { ok: false, spent: 0, reason: r.reason }; }\n  const before', expect: ['驗收 5：'] },
  { name: 'nextId 沒有上限', file: 'src/sim/edit.ts', from: /^    if \(net\.nextId >= TRANSIT_ID_CAP\)[^\n]*\n/m, to: '', expect: ['驗收 5：'] },
  { name: 'revision 上限不算今天待復原的運輸', file: 'src/sim/edit.ts', from: 'TRANSIT_ID_CAP - 1 - pending', to: 'TRANSIT_ID_CAP - 1', expect: ['驗收 5：'] },
  // 第 2 輪核對 R2-1 的四個突變（核對代理做的，原本整支守衛照樣全過）：每一種都要紅在新的那幾項
  { name: '(a) 只在鋪軌道之後登記遮罩（只蓋站廠的城沒有遮罩）', file: 'src/sim/edit.ts', from: '\n  setMergeSurface(s.w, transitSurface(() => s.city));', to: "\n  if (q.op === 'edge') setMergeSurface(s.w, transitSurface(() => s.city));", expect: ['驗收 21（車站變體）', '驗收 21（車廠變體）', '遮罩＝地面格'] },
  { name: '(b) 遮罩只標地面軌道端點、不標站廠', file: 'src/sim/transit/history.ts', from: '      if (net) { mask = new Uint8Array(n * n); for (const i of surfaceTransitCells(net, n)) mask[i] = 1; }', to: "      if (net) { mask = new Uint8Array(n * n); for (const e of net.edges) if (e.mode !== 'metro') { mask[e.a.z * n + e.a.x] = 1; mask[e.b.z * n + e.b.x] = 1; } }", expect: ['驗收 21（車站變體）', '驗收 21（車廠變體）', '遮罩＝地面格'] },
  { name: '(c) 遮罩連地鐵的軌道與車站也標', file: 'src/sim/transit/history.ts', from: '      if (net) { mask = new Uint8Array(n * n); for (const i of surfaceTransitCells(net, n)) mask[i] = 1; }', to: '      if (net) { mask = new Uint8Array(n * n); for (const i of surfaceTransitCells(net, n)) mask[i] = 1; for (const e of net.edges) { mask[e.a.z * n + e.a.x] = 1; mask[e.b.z * n + e.b.x] = 1; } for (const q of net.stations) for (let dx = 0; dx < q.w; dx++) mask[q.z * n + q.x + dx] = 1; }', expect: ['驗收 21（地鐵變體）', '遮罩＝地面格'] },
  { name: '(d) 遮罩多標地面格的四鄰', file: 'src/sim/transit/history.ts', from: '      if (net) { mask = new Uint8Array(n * n); for (const i of surfaceTransitCells(net, n)) mask[i] = 1; }', to: '      if (net) { mask = new Uint8Array(n * n); for (const i of surfaceTransitCells(net, n)) { mask[i] = 1; if (i % n) mask[i - 1] = 1; if (i % n < n - 1) mask[i + 1] = 1; if (i >= n) mask[i - n] = 1; if (i + n < n * n) mask[i + n] = 1; } }', expect: ['驗收 21（軌道旁變體）', '遮罩＝地面格'] },
  // 第 2 輪核對 R2-2：反向守衛把 build.ts 不認得的工具也說成「運輸設施擋住」（改回修正前）；以及「認得」不照 previewOp 換算英式建築（英式建築會從反向守衛漏過去）
  { name: 'R2-2 改回：反向守衛擋下 build.ts 不認得的工具', file: 'src/sim/edit.ts', from: 'return buildKnows(s, op.tool);', to: 'return true;', expect: ['工具群：'] },
  { name: 'R2-2：認得的工具不換算英式建築', file: 'src/sim/edit.ts', from: 'const nativeTool = utilityHeritage?.baseTool ?? marketEstateTool(tool)?.baseTool ?? publicServiceTool(tool)?.baseTool ?? workingRuralTool(tool)?.baseTool ?? civicMarketTool(tool)?.baseTool ?? tool;', to: 'const nativeTool = tool;', expect: ['工具群：'] },
];
async function mutantRun(m) {
  const dir = scratchDir('mut');
  try {
    fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
    const file = path.join(dir, m.file), src = fs.readFileSync(file, 'utf8');
    const hits = typeof m.from === 'string' ? src.split(m.from).length - 1 : (src.match(new RegExp(m.from.source, m.from.flags + 'g')) ?? []).length;
    if (hits !== 1) throw new Error(`突變錨點要剛好一處（${hits} 處）`);
    fs.writeFileSync(file, src.replace(m.from, () => m.to));
    const res = coreChecks(await api(dir), m.expect), red = res.filter(r => !r[0]).map(r => r[1]);
    return { red, missing: m.expect.filter(p => !red.some(n => n.startsWith(p))) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
function extract(rev) {
  const dir = scratchDir('base');
  execFileSync('bash', ['-c', `git -C "${ROOT}" archive --format=tar ${rev} src | tar -x -C "${dir}"`], { stdio: ['ignore', 'ignore', 'inherit'] });
  return dir;
}

// ---- 原始碼的寫法（edit.ts 被歷史守衛逐字抽出、vm 載入、型別剝除；計畫第三步列的錨點）----
function sourceShape() {
  const src = fs.readFileSync(path.join(ROOT, 'src/sim/edit.ts'), 'utf8'), base = execFileSync('git', ['show', `${BASELINE}:src/sim/edit.ts`], { cwd: ROOT, encoding: 'utf8' });
  const anchors = ['protect: true, ', "const sz = op.k === 'tap' ? toolSize(op.tool) : 1;", '    if (!hasRoot && b.bld?.ref && !a.bld) continue;', 'return t?.unlockRank && s.rankIdx + 1 < t.unlockRank ?',
    'export const toolSize = (id: string) => FACILITY_TOOLS.find(c => c.id === id)?.size ?? 1;', 's.polLast = r.last;', 'if (r.effects.coverage) { s.edu.schoolLunch = !!r.pol.schoolLunch; recoverCov(s); }',
    's.budget = b; recoverCov(s);', 'if (b === s.budget) return false;', "if (c) s.city.history.push({ day: s.day, t: 'cms', ev: 'accept', id: c.id });", "if (c) s.city.history.push({ day: s.day, t: 'cms', ev: 'drop', id: c.id });",
    'seed: s.seed, day: s.day });\n  if (c) s.city', 'playableCmsOffers(s.seed, s.rankIdx, s.cms)'];
  for (const a of anchors) { assert.equal(base.split(a).length, 2, '76e074f 上就該恰好一處：' + a); assert.equal(src.split(a).length, 2, '錨點要恰好一處：' + a); }
  const buildImport = base.split('\n').find(l => l.includes("from './rules/build.ts';"));
  assert.ok(buildImport && src.split('\n').filter(l => l === buildImport).length === 1, "'./rules/build.ts' 的 import 一字不改");
  assert.doesNotMatch(src, /k: (131|107|149|164|119|116|81|84|85|130|21|29|37|127|120|72|160|182)\b/, 'frame 守衛的 k: 字樣');
  assert.doesNotMatch(src, /structuredClone|performance|TextEncoder/, 'vm 載入沒有的全域');
  for (const l of src.split('\n').filter(q => /^import\b/.test(q))) assert.match(l, /^import (type )?\{[^}]*\} from '\.{1,2}\/[^']+\.ts';$/, '單行具名 import、明寫 .ts：' + l);
  const exported = [...src.matchAll(/^export (?:const|function|interface|type) ([A-Za-z0-9_]+)/gm)].map(m => m[1]);
  for (const bad of ['citySource', 'section', 'strip']) assert.ok(!exported.includes(bad), '匯出名撞到 ui-actions 測試的 Function 參數：' + bad);
  return `${anchors.length} 個錨點各一處；build.ts 的 import 不動；沒有 frame 字樣與 vm 沒有的全域；import 全是單行；${exported.length} 個匯出不撞名`;
}

async function main() {
  let bad = 0;
  const log = (ok, name, detail) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}：${detail}`); if (!ok) bad++; };
  const step = async (name, fn) => { try { log(true, name, await fn()); } catch (e) { log(false, name, `${e.name}: ${e.message}`.slice(0, 700)); } };
  const A = await api(ROOT);

  await step('edit.ts 的寫法：計畫第三步的錨點恰好一處、build.ts 的 import 不動、單行 import、沒有 frame 守衛的 k: 字樣、vm 載入得了（unit-d024 的 loadMod）', async () => {
    const r = sourceShape();
    const { loadMod } = await imRoot('tools/unit-d024.mjs'), M = await loadMod('src/sim/edit.ts');
    for (const k of ['previewTransit', 'commitTransit', 'removeTransit', 'TRANSIT_TOOLS', 'undoOp', 'commitOp']) assert.equal(typeof M[k] === 'function' || Array.isArray(M[k]), true, 'loadMod 匯出 ' + k);
    return r + '；loadMod 載得到 commitTransit 等';
  });

  for (const [ok, name, detail] of coreChecks(A)) log(ok, name, detail);

  await step('驗收 8：沒有運輸的城跑 120 天（newcity 每三天施工＋復原＋政策；D034 M 系列 15 座，含巨型合併）——每天的 sim hash 與亂數呼叫次數、最後的存檔碼都等於 main 76e074f（git archive 解到暫存目錄）', async () => {
    const codes = D034.d034Runs().map(r => [r.id, r.code]);
    const dir = extract(BASELINE);
    try {
      const now = await noTransit120(await apiNoTransit(ROOT), codes), base = await noTransit120(await apiNoTransit(dir), codes);
      const ids = Object.keys(now), diff = [];
      for (const id of ids) {
        const a = now[id], b = base[id];
        const d = a.fp.findIndex((q, i) => J(q) !== J(b.fp[i]));
        if (d >= 0) diff.push(`${id} 第 ${d + 1} 天`); else if (a.code !== b.code) diff.push(`${id} 存檔碼`);
        assert.equal(a.key, false, id + '：沒有運輸的城出現了 transit 鍵');
      }
      assert.deepEqual(diff, []);
      assert.equal(ids.length, 16);
      return `${ids.length} 座城 × 120 天逐日相同（最後一天亂數 ${ids.map(id => now[id].fp.at(-1)[1]).reduce((x, y) => x + y, 0)} 次合計），存檔碼 ${ids.length}／${ids.length} 逐位元組相同`;
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  await step('驗收 15b（更正後第二條）：同一個局面有遮罩與沒運輸兩邊——第一個不同的地方是沒被擋的那一邊擲了一個含軌道格的 3×3 窗（有遮罩的那一邊一次都沒擲過含軌道格的窗）；在那之前每天擲過的窗、hash、亂數次數都相同（記錄擲骰的副本跟現行 src 每天逐一相同）', async () => {
    const dir = scratchDir('roll');
    try {
      fs.cpSync(path.join(ROOT, 'src'), path.join(dir, 'src'), { recursive: true });
      const f = path.join(dir, 'src/sim/rules/merge.ts'), src = fs.readFileSync(f, 'utf8'), anchor = '      if (c.rng.R() < P_MEGA) {\n';
      assert.equal(src.split(anchor).length, 2, '擲骰的錨點恰好一處');
      fs.writeFileSync(f, src.replace(anchor, () => '      ((globalThis as unknown as { __d101Rolls: number[][] }).__d101Rolls).push([x, y]);\n' + anchor));
      const P = await api(dir), rows = [];
      let literal = 0, literalHash = 0;
      for (const seed of SEEDS21) {
        const a = run21(P, seed, 'transit', true), b = run21(P, seed, 'none', true), ra = run21(A, seed, 'transit'), rb = run21(A, seed, 'none');
        assert.equal(J(a.fp), J(ra.fp), `種子 ${seed}：記錄擲骰的副本（有遮罩）跟現行不同`); assert.equal(J(b.fp), J(rb.fp), `種子 ${seed}：記錄擲骰的副本（沒運輸）跟現行不同`);
        assert.ok(!a.roll.flat().some(([x, z]) => covers21(x, z)), `種子 ${seed}：有遮罩卻擲了含軌道格的窗`);
        const dRoll = a.roll.findIndex((r, i) => J(r) !== J(b.roll[i])), dFp = a.fp.findIndex((q, i) => J(q) !== J(b.fp[i]));
        assert.ok(dRoll >= 0, `種子 ${seed}：兩邊擲的窗一直相同`);
        assert.ok(dFp < 0 || dFp >= dRoll + 1, `種子 ${seed}：第 ${dFp} 天 hash／亂數次數就不同，早於第 ${dRoll + 1} 天擲窗不同（還有別的管道）`);
        const ka = a.roll[dRoll], kb = b.roll[dRoll]; let k = 0;
        while (k < ka.length && k < kb.length && J(ka[k]) === J(kb[k])) k++;
        assert.ok(k < kb.length && covers21(kb[k][0], kb[k][1]), `種子 ${seed}：第 ${dRoll + 1} 天第一個不同的擲骰不是沒被擋那邊的含軌道格窗：${J(kb[k])} vs ${J(ka[k])}`);
        if (dFp >= 0 && b.literal[dFp - 1].length) literal++;
        const dHash = a.fp.findIndex((q, i) => q[0] !== b.fp[i][0]);   // 只看 hash（不看亂數次數）第一個不同的那一天
        if (dHash >= 0 && b.literal[dHash - 1].length) literalHash++;
        rows.push(`${seed % 100}:第${dRoll + 1}天窗(${kb[k]})${dFp >= 0 ? `→hash／亂數次數第${dFp}天不同` : ''}`);
      }
      assert.deepEqual(P.surfaceLog.bad, [], '記錄擲骰的副本建的路網裡 transitSurface ≠ surfaceTransitCells');
      return `${rows.join(' ')}；卡面 15b 原文（第一個不同的日子，沒被擋那邊有一筆碰到軌道格的巨型合併）只印不斷言：以 hash＋亂數次數算 ${literal}／${SEEDS21.length} 個種子成立、只看 hash ${literalHash}／${SEEDS21.length}（其餘那一天沒有合併碰到軌道格：沒被擋那邊合格的含軌道格窗骰沒擲中，有遮罩那邊被 mgDone 放出來的重疊窗多擲，亂數照樣偏）`;
    } finally { fs.rmSync(dir, { recursive: true, force: true }); delete globalThis.__d101Rolls; }
  });

  await step(`突變控制（${MUTANTS.length} 種，副本放在 ${SCRATCH}）：每一種都讓守衛轉紅，而且紅在預期的那一項`, async () => {
    const out = [], miss = [];
    for (const m of MUTANTS) {
      const r = await mutantRun(m);
      if (!r.red.length || r.missing.length) miss.push(`「${m.name}」紅了 ${J(r.red)}，預期 ${J(m.expect)}`);
      else out.push(`「${m.name}」→ ${r.red.length} 項紅`);
    }
    assert.deepEqual(miss, []);
    return out.join('；');
  });

  console.log(bad ? `D101 construction: ${bad} failed` : 'D101 construction: all passed');
  if (bad) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

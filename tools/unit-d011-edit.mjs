// D011 Node 守衛（整合層）：手勢 → 實驗線放置規則 → 事件 → 城市模型 → 重播 → 存檔讀檔 → 地價狀態機。由 tools/unit.mjs 呼叫。
// 規則本身（canPlace／placeCost／doPlace／commitRect……、稅與維護費）另有黃金樣本守衛（unit-d011-build.mjs、unit-d011-money.mjs）；
// 這裡驗的是本線自己接的線：帳對不對、城市模型跟格子同不同步、歷史能不能重播、存檔讀回來是不是同一座城（驗收 5、6，驗收 7 的 Node 半邊）。
// 守衛那一跑（runScript 的 deep）每一筆操作之後、每一天前後另驗：地價基準的不變式（每一格要嘛標了待重算、要嘛＝現算）、
// 照實驗線另抄的地價那一步（每一天）、歷史重播＝模擬（每一筆、每一天）、存檔再讀檔（每一段結尾、頭 3 天）。
// 劇本第 E 段、預建城的拆除、釘住結果的操作、存檔取整、竄改的歷史：tools/d011-edit-cases.mjs
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, encodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { roadCode, cityFromLab, cityStats, CITY_FORMAT } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { stepDay, simHash, simFromSave } from '../src/sim/day.ts';
import { commitOp, undoOp, previewOp, canUndo, EDIT_STALE_R } from '../src/sim/edit.ts';
import { replayCity } from '../src/sim/replay.ts';
import { saveCode, loadCode } from '../src/io/save.ts';
import { fieldsOf } from '../src/sim/rules/fields.ts';
import { landStaticAt } from '../src/sim/rules/land.ts';
import { roadDraftTiles, UNDO_MAX } from '../src/sim/rules/build.ts';
import * as OPS from './d011-ops.mjs';
import { segE, prebuiltCase, pinCase, MONEY_ROUND, tamperCases, rcTamper } from './d011-edit-cases.mjs';

const { d011Ops, run3d } = OPS;
const GAP = OPS.DEFAULT_GAP ?? 10000;   // 操作沒寫 gap：跟上一筆隔 10 秒（契約同 tools/d011-ops.mjs；拆除確認不會跨筆生效）
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const NEWCITY = 'src/content/samples/newcity.code.txt';

// ---- 劇本：新城上五段施工，中間推進，共 120 天 ----
// A、B＝對拍劇本（tools/d011-ops.mjs，開跑前、第 1 天後）；C（第 31 天）、D（第 61 天）＝擴建、升級、降級、樹、橋、拆除、復原；
// E（第 91 天，tools/d011-edit-cases.mjs segE）＝施工的每一種寫法各留一筆跨過一天（蓋在分區上、路穿過分區、拆分區、拆路、分區劃在樹上、快速路過河）。
// 只用 tools/d011-ops.mjs 契約裡的操作種類：劇本也在瀏覽器重演（tools/smoke-d011.mjs、tools/shoot.mjs）。
// pins：釘住結果的操作（E 段，runScript 逐項比）；hwyWet：E 段快速路過河經過的水面格
export function scriptOf(code) {
  const S = decodeLabCode(code).save, n = S.n, lay = k => Uint8Array.from(S.layers[k] ?? '', ch => ch.charCodeAt(0) - 48);
  const ter = lay('ter'), tre = lay('tre'), { A, B, site, tree, tree2 } = d011Ops(n, ter, lay('el'), tre);
  const X = site.x0, Z = site.z0;
  const C = [
    { k: 'line', tool: 'road', x0: X, z0: Z + 15, x1: X + 20, z1: Z + 15 },
    { k: 'line', tool: 'road', x0: X + 10, z0: Z + 10, x1: X + 10, z1: Z + 20 },
    { k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 11, x1: X + 9, z1: Z + 14 },
    { k: 'rect', tool: 'zc', x0: X + 11, z0: Z + 11, x1: X + 19, z1: Z + 14 },
    { k: 'rect', tool: 'zi', x0: X + 11, z0: Z + 16, x1: X + 19, z1: Z + 19 },
    { k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 16, x1: X + 9, z1: Z + 19 },
    { k: 'line', tool: 'art', x0: X, z0: Z + 5, x1: X + 20, z1: Z + 5 },              // 主街升主幹道：付差價
    { k: 'line', tool: 'alley', x0: X, z0: Z + 5, x1: X + 3, z1: Z + 5, nop: 1 },     // 降級：拒絕
    { k: 'line', tool: 'road', x0: X + 20, z0: Z + 10, x1: tree2[0], z1: tree2[1] },  // 往第二棵樹拉過去：樹上 +2
    { k: 'tap', tool: 'police', x: X + 20, z: Z + 16 },
    { k: 'rect', tool: 'doze', x0: X + 1, z0: Z + 1, x1: X + 9, z1: Z + 4 },          // 框選拆除：一級照拆、二級以上略過
    { k: 'undo' },
  ];
  const D = [
    { k: 'tap', tool: 'plant', x: X + 20, z: Z + 20 },
    { k: 'line', tool: 'coll', x0: X, z0: Z + 20, x1: X + 20, z1: Z + 20 },
    { k: 'line', tool: 'road', x0: X, z0: Z + 10, x1: X, z1: Z + 20 },
    { k: 'rect', tool: 'doze', x0: X + 5, z0: Z + 5, x1: X + 7, z1: Z + 5 },          // 拆路
    { k: 'undo' },
    { k: 'rect', tool: 'doze', x0: X + 20, z0: Z + 16, x1: X + 20, z1: Z + 16 },      // 拆第 31 天蓋的警察局（單格拆除＝框，玩家的路）
  ];
  // E 段避開其他段碰到的格：起步城、兩棵樹、每一筆線／框／點的格（{at} 的在起步城裡）
  const avoid = new Set(), mark = (x, z) => { if (x >= 0 && z >= 0 && x < n && z < n) avoid.add(z * n + x); };
  for (let z = Z; z <= Z + 20; z++) for (let x = X; x <= X + 20; x++) mark(x, z);
  mark(...tree); mark(...tree2);
  for (const o of [...A, ...B, ...C, ...D]) {
    if (o.at) continue;
    if (o.k === 'line') for (const [x, z] of roadDraftTiles(o.x0, o.z0, o.x1, o.z1)) mark(x, z);
    else if (o.k === 'rect') for (let z = Math.min(o.z0, o.z1); z <= Math.max(o.z0, o.z1); z++) for (let x = Math.min(o.x0, o.x1); x <= Math.max(o.x0, o.x1); x++) mark(x, z);
    else if (o.k === 'tap') mark(o.x, o.z);
  }
  const E = segE(n, ter, tre, X, Z, avoid);
  return Object.assign([['ops', A], ['days', 1], ['ops', B], ['days', 29], ['ops', C], ['days', 30], ['ops', D], ['days', 30], ['ops', E.ops], ['days', 30]],
    { site: { x0: X, z0: Z }, pins: E.pins, hwyWet: E.hwyWet });
}

// 城市模型（畫面、歷史用）跟實驗線形狀的格子要逐格同步：路碼、等級、分區、樹、occ、根格對照、每棟還在的建築
export function syncMismatch(s) {
  const c = s.city, n = c.n, w = s.w, occ = new Uint32Array(n * n);
  for (const [i, cb] of s.root) {
    const b = w.tiles[i].bld;
    if (!b || b.ref || cb.goneDay !== undefined || b.k !== cb.k || b.lv !== cb.lv || b.v !== cb.v || cb.z * n + cb.x !== i) return `根格 ${i}：建築不同步`;
    for (let dz = 0; dz < cb.size; dz++) for (let dx = 0; dx < cb.size; dx++) if (cb.x + dx < n && cb.z + dz < n) occ[(cb.z + dz) * n + cb.x + dx] = cb.id;
  }
  for (let i = 0; i < n * n; i++) {
    const t = w.tiles[i];
    if (t.bld && !t.bld.ref && !s.root.has(i)) return `第 ${i} 格有建築、根格表沒有`;
    if (c.road[i] !== roadCode(t.road, t.hw, t.bridge) || c.rclass[i] !== (t.road ? (t.rc || 0) : 0) || c.zone[i] !== (t.zone || 0) || c.tree[i] !== (t.tree || 0)) return `第 ${i} 格地面不同步`;
    if (c.occ[i] !== occ[i]) return `第 ${i} 格 occ ${c.occ[i]} ≠ ${occ[i]}`;
  }
  const badId = c.buildings.findIndex((b, k) => b.id !== k + 1);
  return badId >= 0 ? `建築編號 ${badId}` : null;
}

// 事件欄位（卡面第 6 節）
const SHAPE = {
  road: ['day', 't', 'x', 'z', 'rc', 'cost', 'g'], zone: ['day', 't', 'x', 'z', 'zone', 'cost', 'g'],
  place: ['day', 't', 'x', 'z', 'k', 'lv', 'v', 'id', 'cost', 'g'], doze: ['day', 't', 'x', 'z', 'layer', 'cost', 'g'], undo: ['day', 't', 'g', 'refund'],
  grow: ['day', 't', 'x', 'z', 'k', 'lv', 'v'], upgrade: ['day', 't', 'x', 'z', 'k', 'lv', 'v'],
};
const shapeBad = e => { const need = SHAPE[e.t]; if (!need) return `不認得的事件 ${e.t}`; const miss = need.filter(k => e[k] === undefined || (k !== 't' && k !== 'layer' && typeof e[k] !== 'number')); return miss.length ? `${e.t} 缺 ${miss.join(',')}` : null; };
const evKind = e => e.t === 'doze' ? 'doze ' + e.layer : e.t;

// ---- 地價（驗收 6）----
// 不變式（src/sim/edit.ts markStaleAround 上面那段註解）：每一格要嘛標了待重算（stale），要嘛地價基準＝現在的輸入算出來的值。
// 故意不看 landBox：實驗線 doPlace 的框（51627）一定蓋得到施工改過的格，看框就量不到本線自己的標記有沒有做
const u8 = new Uint8Array(1), asByte = v => { u8[0] = v; return u8[0]; };   // LANDBASE 是 Uint8Array：存進去＝截尾
export function landStale(s) {
  const N = s.w.N, f = fieldsOf(s.g), L = s.g.LANDBASE;
  for (let i = 0; i < N * N; i++) if (!s.stale[i] && L[i] !== asByte(landStaticAt(s.w, f, i % N, (i / N) | 0))) return i;
  return -1;
}
// 實驗線 tick() 的地價那一步（index.html 54996–55001 @d23c18d）另抄一份，不走 stepDay 的分支：
//   if(landDirty){ if(landBox){框裡逐格 LANDBASE=landStaticAt} else 整張逐格; landDirty=false; landBox=null }（rebuildNoise：本線沒有噪音源）
// 推進前用推進前的狀態算；這一步之前 tick() 只動了天數與天氣，之後到隔天都不再寫 LANDBASE，所以推進完的 LANDBASE 要逐位元組等於它
export function labLandStep(s) {
  const N = s.w.N, f = fieldsOf(s.g), out = Uint8Array.from(s.g.LANDBASE);
  if (s.landDirty) {
    if (s.landBox) { const [x0, y0, x1, y1] = s.landBox; for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) out[yy * N + xx] = landStaticAt(s.w, f, xx, yy); }
    else for (let i = 0; i < N * N; i++) out[i] = landStaticAt(s.w, f, i % N, (i / N) | 0);
  }
  return out;
}

// ---- 重播與存讀檔（驗收 5）----
const BLD = b => [b.id, b.k, b.lv, b.v, b.age, b.x, b.z, b.size, b.abandoned, b.builtDay, b.goneDay ?? -1];
const CITY_LAYERS = ['road', 'rclass', 'zone', 'tree', 'occ'];
const cityDiff = (a, b, what) => {
  for (let k = 0; k < Math.max(a.buildings.length, b.buildings.length); k++) {
    const p = a.buildings[k] && J(BLD(a.buildings[k])), q = b.buildings[k] && J(BLD(b.buildings[k]));
    if (p !== q) return `#${k + 1}：模擬 ${p} ≠ ${what} ${q}`;
  }
  for (const f of CITY_LAYERS) { const p = a[f], q = b[f]; for (let i = 0; i < p.length; i++) if (p[i] !== q[i]) return `${f} 第 ${i} 格：模擬 ${p[i]} ≠ ${what} ${q[i]}`; }
  return null;
};
// 匯入那張碼＋到目前為止的全部事件重播出來的城＝模擬的城：每棟每欄（含墓碑、屋齡、蓋起日）與路、等級、分區、樹、occ
export function replayDiff(s, start, KT) {
  let rp;
  try { rp = replayCity(start, s.city.history, KT, s.day); } catch (e) { return '重播丟例外：' + e.message; }
  return cityDiff(s.city, rp, '重播');
}
// 路圖層照實驗線 save 另抄一份（index.html 66717 @d23c18d：0 無 1 路 2 橋 3 高速 4 高速橋），不經 roadCode
const labRd = t => t.road ? (t.hw ? (t.bridge ? 4 : 3) : (t.bridge ? 2 : 1)) : 0;
const TILE = t => [t.t, t.road, t.hw, t.bridge, t.road ? t.rc : 0, t.zone || 0, t.tree || 0, t.bld ? [t.bld.k, t.bld.lv, t.bld.v, t.bld.age, t.bld.ref ?? 0, t.bld.k === 1 ? [t.bld.den ?? 3, t.bld.we ?? 1] : 0, +(t.bld.fire || 0)] : 0];
// 存檔再讀檔：存的路圖層、資金（實驗線 66747 money:Math.round(money)）、難度、天數照實驗線；讀回來一定要重播成功（src/io/save.ts mismatch 為 null）、
// 逐格（路、快速路、橋、等級、分區、樹、建築）、建築清單（含墓碑）、歷史、資金、天數、難度、里程碑、星等、手勢編號都相同，讀回的城也同步
export function roundTrip(s, L, KT, vrank) {
  const code = saveCode(s, L.template, L.start), d = decodeLabCode(code);
  if (!d.ok) return { bad: '存檔解不開：' + d.error };
  const raw = d.save.raw, rd = d.save.layers.rd ?? '', n = s.w.N, q = loadCode(code, KT, vrank), out = { code, raw, q, bad: null }, fail = why => ({ ...out, bad: why });
  for (let i = 0; i < n * n; i++) if (rd.charCodeAt(i) - 48 !== labRd(s.w.tiles[i])) return fail(`存檔的路圖層第 ${i} 格「${rd[i]}」≠ 實驗線寫法 ${labRd(s.w.tiles[i])}`);
  if (raw.money !== Math.round(s.money) || raw.df !== s.diff || raw.day !== s.day) return fail(`存檔的資金／難度／天數 ${J([raw.money, raw.df, raw.day])} ≠ ${J([Math.round(s.money), s.diff, s.day])}`);
  if (!q.ok) return fail('讀不回來：' + q.error);
  if (!q.replayed) return fail('沒有重播：' + q.note);
  const p = q.sim, a = [p.money, p.day, p.diff, p.msIdx, p.bestStar, p.stroke], b = [raw.money, s.day, s.diff, s.msIdx, s.bestStar, s.stroke];
  if (J(a) !== J(b)) return fail(`資金／天數／難度／里程碑／星等／手勢編號：讀回 ${J(a)} ≠ ${J(b)}`);
  if (J(p.city.history) !== J(s.city.history)) return fail('歷史不同');
  const c = cityDiff(s.city, p.city, '讀回'); if (c) return fail(c);
  const ti = s.w.tiles.findIndex((t, i) => J(TILE(t)) !== J(TILE(p.w.tiles[i])));
  if (ti >= 0) return fail(`第 ${ti} 格：${J(TILE(s.w.tiles[ti]))} ≠ 讀回 ${J(TILE(p.w.tiles[ti]))}`);
  const m = syncMismatch(p); if (m) return fail('讀回的城不同步：' + m);
  return out;
}

// ---- 跑劇本 ----
// 每一筆操作與每一天：帳（資金逐位）、同步、歷史只增不改；預覽＝實際（錢夠、又不是單格拆二級以上的第一次按：蓋成的格數＝預覽能蓋的、扣的錢＝預覽總價，一筆都不跳過）；
// 錢不夠（框、點整筆不蓋，線只蓋得出前段）；復原把那一筆放的建築變墓碑、拆掉的回來、全額退錢；釘住的操作逐項比（script.pins）。
// stepOpts 給地價雙胞胎用；onStep(s, o, r)：每一筆操作（o）、每一天（o＝null、r＝當天的報告）之後叫一次（瀏覽器重演、截圖用）。
// opts.deep：另外逐筆、逐日驗地價不變式、照實驗線另抄的地價那一步、重播＝模擬、存讀檔往返（慢，給守衛那一跑）。
// 回傳 bad（帳、同步、預覽、復原、釘住）、land、replay、trip 分開報；tally＝發生過什麼（涵蓋面）；n＝深查次數
export function runScript(code, KT, vrank, script, stepOpts = {}, onStep, opts = {}) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('劇本的起點碼讀不進來：' + L.error);
  const s = L.sim, N = s.w.N, deep = !!opts.deep, pins = script.pins;
  const picks = {}, tally = {}, days = [], stack = [], bad = [], land = [], replay = [], trip = [], cnt = { land: 0, replay: 0, trip: 0, segEnds: 0, dayTrips: 0, undoTrips: 0 };
  const hit = k => { tally[k] = (tally[k] || 0) + 1; };
  const live = () => { let c = 0; for (const b of s.city.buildings) if (b.goneDay === undefined) c++; return c; };
  let clock = 0, hist = J(s.city.history), tripped = false;
  const landCheck = what => { cnt.land++; const i = landStale(s); if (i >= 0) land.push(`${what}：第 ${i} 格地價基準 ${s.g.LANDBASE[i]} ≠ 現算 ${asByte(landStaticAt(s.w, fieldsOf(s.g), i % N, (i / N) | 0))}，也沒標待重算`); };
  const check = what => {
    const m = syncMismatch(s); if (m) bad.push(`${what}：${m}`);
    const h = J(s.city.history); if (!h.startsWith(hist.slice(0, -1))) bad.push(`${what}：歷史被改了`); hist = h;
    tripped = false;
    if (!deep) return;
    landCheck(what);
    cnt.replay++; const r = replayDiff(s, L.start, KT); if (r) replay.push(`${what}：${r}`);
  };
  const roundTripAt = what => { cnt.trip++; tripped = true; const t = roundTrip(s, L, KT, vrank); if (t.bad) trip.push(`${what}：${t.bad}`); else hit('存讀檔往返'); };
  // 一筆施工的效果到換日時還在（跨過一天就不能復原了，重播、存讀檔都要照它）
  const persists = e => {
    const t = s.w.tiles[e.z * N + e.x];
    if (e.t === 'road') return !!t.road && t.rc === e.rc;
    if (e.t === 'zone') return t.zone === e.zone;
    if (e.t === 'place') return s.city.buildings[e.id - 1].goneDay === undefined;
    if (e.t !== 'doze') return false;
    return e.layer === 'bld' ? s.city.buildings[e.id - 1]?.goneDay !== undefined : e.layer === 'road' ? !t.road : e.layer === 'zone' ? !t.zone : !t.tree;
  };
  const pinCheck = (o, r, pv, ev, where) => {
    const w = pins?.get(o); if (!w) return;
    hit('釘住');
    const got = { placed: r.placed, spent: r.spent, armed: !!r.armed, skipped: r.skipped ?? 0, reason: r.reason, refund: r.refund, count: pv?.count, total: pv?.total, affordable: pv?.affordable, pvReason: pv?.reason, events: ev.map(evKind) };
    const miss = Object.entries(w).filter(([k, v]) => k !== 'check' && k !== 'tag' && J(got[k]) !== J(v)).map(([k, v]) => `${k} ${J(got[k])}（要 ${J(v)}）`);
    const c = w.check?.(s, r, pv, ev);
    if (miss.length || c) bad.push(`${where}：${[...miss, c].filter(Boolean).join('、')}`);
    else if (w.tag) hit(w.tag);
  };
  if (deep) check('開局');
  for (const [seg, [kind, arg]] of script.entries()) {
    if (kind === 'days') {
      for (let d = 0; d < arg; d++) {
        let exp = null;
        const how = s.landDirty ? (s.landBox ? '框' : '整張') : '不用算';
        if (deep) { landCheck(`第 ${s.day} 天推進前`); exp = labLandStep(s); }
        for (const t of stack) for (const e of t.events) if (persists(e)) hit(`跨日留著：${evKind(e)}`);
        stack.length = 0;                                                // 過了一天：之前的施工不能再復原（day.ts s.txns 清空）
        const m0 = s.money, t = performance.now(), rep = stepDay(s, stepOpts), ms = performance.now() - t;
        // 當天的帳：結算（56053，沙盒不入帳）→ 里程碑 → 星等獎金 → 紓困，依序加，要逐位等於模擬的資金
        let m = m0; const st = rep.settle;
        if (s.diff !== 3) m += st.income - st.upkeep;
        if (st.milestone) { m += st.milestone.reward; hit('里程碑'); }
        if (st.star) { m += st.star.bonus; hit('星等獎金'); }
        if (st.bailout) { m += st.bailout; hit('紓困'); }
        if (!Object.is(m, s.money)) bad.push(`第 ${s.day} 天資金 ${s.money} ≠ 帳 ${m}`);
        if (canUndo(s)) bad.push(`第 ${s.day} 天：過了一天還能復原`);
        if (deep) {
          const k = exp.findIndex((v, i) => v !== s.g.LANDBASE[i]);
          if (k >= 0) land.push(`第 ${s.day} 天：地價基準第 ${k} 格 ${s.g.LANDBASE[k]} ≠ 照實驗線 54996–55001 另算的 ${exp[k]}（推進前：${how}）`);
          else hit(`地價另算相同：${how}`);
        }
        days.push({ day: s.day, ms, land: Buffer.from(s.g.LANDBASE).toString('base64'), money: s.money, pop: s.pop, settle: st });
        check(`第 ${s.day} 天`);
        if (deep && days.length <= 3) { roundTripAt(`第 ${s.day} 天`); cnt.dayTrips++; }
        onStep?.(s, null, rep);
      }
      if (deep) { if (!tripped) roundTripAt(`第 ${seg + 1} 段（${arg} 天）結束、第 ${s.day} 天`); cnt.segEnds++; }
      continue;
    }
    for (const [k, o] of arg.entries()) {
      clock += o.gap ?? GAP;
      const where = `第 ${seg + 1} 段第 ${k + 1} 筆（第 ${s.day} 天）${o.k}${o.tool ? ' ' + o.tool : ''}`;
      const m0 = s.money, n0 = s.city.history.length, live0 = live();
      let tripNow = false;                                                // 復原掉放置之後：當場存讀檔一次（墓碑要存得進去、讀得回來）
      // 先照 pick 解出 {at} 的座標再預覽（預覽跟提交的是同一筆）
      const p = o.at ? picks[o.at] : null;
      const op = !['line', 'rect', 'tap'].includes(o.k) || (o.at && !p) ? null : p ? { k: o.k, tool: o.tool, x0: p[0], z0: p[1], x1: p[0], z1: p[1] }
        : o.k === 'tap' ? { k: 'tap', tool: o.tool, x0: o.x, z0: o.z, x1: o.x, z1: o.z } : { k: o.k, tool: o.tool, x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z1 };
      const pv = op ? previewOp(s, op) : null, cells = (pv?.cells ?? []).map(c => c.z * N + c.x);
      const trees = new Set(cells.filter(i => s.w.tiles[i].tree)), zoned = new Set(cells.filter(i => s.w.tiles[i].zone));
      const r = run3d(s, o, picks, clock);
      const ev = s.city.history.slice(n0);
      ev.forEach(e => { const b = shapeBad(e); if (b) bad.push(`${where}：${b}`); });
      if (op && r.op && J(r.op) !== J(op)) bad.push(`${where}：提交的 ${J(r.op)} ≠ 預覽的 ${J(op)}`);
      if (o.k === 'money' || o.k === 'seed' || o.k === 'pick') {        // 不是施工：沒有事件、沒有預覽、不動錢（money 只把錢設成 v）
        hit(o.k === 'money' ? '設定資金' : o.k === 'seed' ? '設定亂數' : r.found ? 'pick 找到' : 'pick 沒找到');
        if (ev.length || !Object.is(s.money, o.k === 'money' ? o.v : m0)) bad.push(`${where}：多了 ${ev.length} 筆事件或資金 ${s.money} 不對`);
      } else if (o.k === 'undo') {
        if (r.ok) {
          hit('復原');
          const top = stack.pop();
          if (!Object.is(s.money, m0 + r.refund) || ev.length !== 1 || ev[0].t !== 'undo' || ev[0].refund !== r.refund) bad.push(`${where}：資金 ${m0}+${r.refund}≠${s.money} 或事件不對`);
          if (!top || ev[0]?.g !== top.g) bad.push(`${where}：復原的是第 ${ev[0]?.g} 筆手勢，劇本最後一筆是 ${top?.g}`);
          else {
            if (!Object.is(r.refund, top.spent)) bad.push(`${where}：退 ${r.refund} ≠ 當初花的 ${top.spent}`);
            for (const id of top.created) {                               // 放的建築：墓碑、根格表沒有、occ 清空、格子上沒建築
              const cb = s.city.buildings[id - 1], i = cb.z * N + cb.x;
              let occ = 0; for (let dz = 0; dz < cb.size; dz++) for (let dx = 0; dx < cb.size; dx++) if (cb.x + dx < N && cb.z + dz < N && s.city.occ[(cb.z + dz) * N + cb.x + dx] === id) occ++;
              if (cb.goneDay !== s.day || s.root.has(i) || s.w.tiles[i].bld || occ) bad.push(`${where}：放的 #${id} 墓碑 ${cb.goneDay}、根格表 ${s.root.has(i)}、格子上 ${J(s.w.tiles[i].bld)}、occ ${occ} 格`);
              else { hit(`復原放置 k${cb.k}`); tripNow = true; }
            }
            for (const id of top.removed) {                               // 拆的建築：回來
              const cb = s.city.buildings[id - 1], i = cb.z * N + cb.x;
              if (cb.goneDay !== undefined || s.root.get(i) !== cb || s.city.occ[i] !== id) bad.push(`${where}：拆的 #${id} 沒回來`);
            }
            if (live() !== top.live) bad.push(`${where}：還在的建築 ${live()} 棟 ≠ 那一筆之前 ${top.live} 棟`);
          }
        } else { hit('復原（沒東西）'); if (stack.length) bad.push(`${where}：這一天還有 ${stack.length} 筆施工，復原卻說沒東西`); }
      } else if (!op) {                                                   // {at} 找不到：不做
        hit(`拒絕：${r.reason}`);
        if (ev.length || !Object.is(s.money, m0)) bad.push(`${where}：pick 沒找到卻動了東西`);
      } else {
        // 扣的錢＝事件記的造價，依施工順序逐筆減（實驗線 money-=cost 逐格，52399）
        let m = m0; for (const e of ev) m -= e.cost;
        if (!Object.is(m, s.money)) bad.push(`${where}：資金 ${s.money} ≠ 起始 ${m0} 減事件造價 ${m}`);
        if (!Object.is(r.spent, m0 - s.money)) bad.push(`${where}：回報的花費 ${r.spent} ≠ ${m0 - s.money}`);
        // 預覽＝實際：錢夠、又不是「單格拆二級以上的第一次按」（只預備，62985），蓋成的格數＝預覽能蓋的格數、扣的錢＝預覽總價
        if (pv.affordable && !r.armed) {
          if (r.placed !== pv.count || r.spent !== pv.total) bad.push(`${where}：蓋 ${r.placed} 格、扣 ${r.spent} ≠ 預覽 ${pv.count} 格、${pv.total}`);
          else if (r.placed) hit('扣款＝預覽總價');
        }
        // 錢不夠：框整塊不蓋（62996）、點不蓋（51631）；線逐格比資金，只蓋得出前段（62779）
        if (!pv.affordable && (o.k === 'line' ? r.placed >= pv.count : r.placed > 0)) bad.push(`${where}：預覽說錢不夠（總價 ${pv.total} > ${m0}）卻蓋了 ${r.placed}／${pv.count} 格`);
        if (r.g !== undefined) {                                          // 有交易：復原堆疊跟著推（上限 40，62731）
          if (ev.some(e => e.g !== r.g)) bad.push(`${where}：事件的手勢編號不是 ${r.g}`);
          stack.push({ g: r.g, spent: r.spent, live: live0, events: ev, created: ev.filter(e => e.t === 'place').map(e => e.id), removed: ev.filter(e => e.t === 'doze' && e.layer === 'bld').map(e => e.id) });
          if (stack.length > UNDO_MAX) stack.shift();
        } else if (ev.length) bad.push(`${where}：有事件卻沒有手勢編號`);
        // 涵蓋面：記下這一筆發生了什麼（守衛要求每一種都真的發生過）
        if (!r.placed) hit(`拒絕：${r.reason ?? (r.armed ? '拆除待確認' : '?')}`);
        if (r.skipped) hit('框選略過二級以上');
        for (const e of ev) {
          const i = e.z * N + e.x, t = s.w.tiles[i];
          if (e.t === 'road') hit(t.bridge ? (e.rc === 5 ? '快速路橋' : '橋') : 'road');
          if (e.t === 'zone') hit(e.cost === 0 ? '改劃免費' : 'zone');
          if (e.t === 'place') hit(`place k${e.k}`);
          if (e.t === 'doze') hit(`doze ${e.layer}`);
          if (o.tool !== 'doze' && trees.has(i)) { hit('蓋在樹上'); hit(`${e.t} 蓋在樹上`); }
          if (o.tool !== 'doze' && zoned.has(i) && e.t !== 'zone') hit(e.t === 'place' ? `place k${e.k} 蓋在分區上` : `${e.t} 蓋在分區上`);
        }
        if (o.k === 'line' && r.placed > 0 && !pv.affordable) hit('錢不夠蓋前段');
        if (o.k === 'rect' && !r.placed && !pv.affordable && pv.count) hit('框選整塊不蓋');
        if (ev.some(e => e.t === 'road' && e.cost > 0 && e.cost < 15 && o.tool === 'road')) hit('升級付差價');
      }
      // 劇本註明 nop 的（拒絕、同類重劃、拆除只預備）什麼都不能改；沒註明的施工與復原一定要改到東西（契約同 tools/d011-ops.mjs：劇本不會默默空跑）
      if (!['money', 'seed', 'pick'].includes(o.k) && (ev.length > 0 || !Object.is(s.money, m0)) === !!o.nop) bad.push(`${where}：${o.nop ? '註明不改卻改了' : '什麼都沒改到（劇本空跑）'}`);
      pinCheck(o, r, pv, ev, where);
      check(where);
      if (deep && tripNow) { roundTripAt(`${where}（復原放置之後）`); cnt.undoTrips++; }
      onStep?.(s, o, r);
    }
    if (deep) { if (!tripped) roundTripAt(`第 ${seg + 1} 段（${arg.length} 筆）結束、第 ${s.day} 天`); cnt.segEnds++; }
  }
  return { s, L, bad, land, replay, trip, tally, days, n: cnt };
}

// 驗收 2 開局的兩張碼（tools/lab-extract.mjs --part=d011 產生，實驗線讀回對帳）：新城、預建城（對拍的拆除劇本用）
function sampleGuards(log, KT, vrank) {
  for (const id of ['newcity', 'd011-prebuilt']) {
    const f = `src/content/samples/${id}.code.txt`;
    if (!fs.existsSync(path.join(ROOT, f))) { log(false, `${id} 碼存在`, f + ' 不存在'); continue; }
    const code = read(f).trim(), meta = JSON.parse(read(`src/content/samples/${id}.json`)), r = decodeLabCode(code);
    if (!r.ok) { log(false, `${id} 解碼`, r.error); continue; }
    const S = r.save, c = cityFromLab(S, KT, code), st = cityStats(c), rc = {};
    for (let i = 0; i < c.n * c.n; i++) if (c.road[i]) rc[c.rclass[i]] = (rc[c.rclass[i]] || 0) + 1;
    // 住宅的密度、財富、火災：本線讀檔（day.ts simFromSave，實驗線 load 66905 起的補值）＝實驗線讀回
    const sim = simFromSave(S, code, KT, vrank), houses = meta.houses.filter(([i, den, we, fire]) => { const b = sim.w.tiles[i].bld; return !b || b.den !== den || b.we !== we || +(b.fire || 0) !== fire; });
    const same = ['money', 'day', 'df', 'star', 'msIdx', 'seed'].filter(k => S[k] !== meta[k]);
    log(J(st) === J(meta.expect) && meta.sameAsThisLine === true && J(rc) === J(meta.rc) && meta.rcSameAsThisLine === true && !houses.length && !same.length && S.raw.nm === meta.nm
      && meta.extensionIgnored === true && meta.injectedCopySameAsOriginal === true && meta.asSpecified === true && meta.source.commit.startsWith('d23c18d'),
      `${meta.label}：實驗線 GV.importCode 讀回的對帳數字、道路等級、資金／天數／難度／星等／里程碑／種子／城名＝本線解碼；住宅密度與財富＝本線讀檔；帶附加欄位 d3 的同一張碼實驗線讀回完全一樣`,
      houses.length ? '住宅不同 ' + J(houses) : same.length ? '不同：' + same.join(',') : `路 ${st.road.slice(1).join('／')}、分區 ${st.zone.slice(1).join('／')}、建築 ${st.buildings}、$${S.money}、df ${S.df}、星 ${S.star}、實驗線 ${meta.source.commit.slice(0, 7)}`);
  }
}

const tallyText = t => Object.entries(t).map(([k, v]) => `${k}×${v}`).join('、');
// 狀態雜湊；城市模型壞到算不出雜湊（例如根格表指到空格）就回 null，守衛照樣記紅燈、不整支崩掉
const hashOf = s => { try { return simHash(s); } catch { return null; } };

// 守衛跑到一半丟例外（劇本、重播、存讀檔的程式壞掉）也要記成紅燈，不是整支崩掉、後面的守衛不跑
export async function d011EditGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D011 施工整合守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
  const vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  sampleGuards(log, KT, vrank);
  let code;
  if (fs.existsSync(path.join(ROOT, NEWCITY))) {
    code = read(NEWCITY).trim();
    const S = decodeLabCode(code).save;
    log(S.df === 1 && S.money === 3000 && S.day === 1 && S.star === 0 && S.msIdx === 0 && S.bl.length === 0, '新城碼：標準難度 df 1、$3000、第 1 天、星等 0、里程碑 0、沒有建築', `df ${S.df}、$${S.money}、第 ${S.day} 天、種子 ${S.seed}`);
  } else {
    log(false, '新城碼存在（tools/lab-extract.mjs --part=d011 產生）', NEWCITY + ' 不存在；以下改用起步城清空的臨時碼');
    const raw = decodeLabCode(read('src/content/samples/starter.code.txt')).save.raw, nn = raw.n * raw.n, g = { ...raw };
    delete g.z; Object.assign(g, { df: 1, money: 3000, rd: '0'.repeat(nn), zn: '0'.repeat(nn), rcl: '0'.repeat(nn), bl: [] });
    code = encodeLabCode(g, { deflate: true });
  }
  const script = scriptOf(code);

  // 驗收 5：劇本跑兩次雜湊相同、換種子不同（A 是深查的那一跑、B 不深查：深查不能動到模擬）；每一筆的帳、同步、歷史只增不改
  const t0 = performance.now(), A = runScript(code, KT, vrank, script, {}, undefined, { deep: true }), tA = performance.now() - t0;
  const B = runScript(code, KT, vrank, script);
  const hA = hashOf(A.s), hB = hashOf(B.s), hC = hashOf(runScript(codeWithSeed(code, 777), KT, vrank, script).s);
  log(!!hA && !!hC && hA === hB && hA !== hC, `決定性：新城＋五段施工＋120 天，兩次雜湊相同（一次帶深查、一次不帶）、換種子不同`, `${hA}＝${hB}；種子 777：${hC}`);
  log(A.bad.length === 0 && B.bad.length === 0,
    '每一筆施工：扣的錢＝事件造價逐筆減（逐位）、回報的花費相同；錢夠就「蓋成的格數＝預覽、扣款＝預覽總價」（不跳過）、錢不夠框與點不蓋、線只蓋前段；復原：放的建築變墓碑（根格表、occ、格子都清掉）、拆的回來、全額退錢；E 段釘住的結果逐項相同；每一天：資金＝結算＋里程碑＋星等＋紓困逐筆加；城市模型與格子逐格同步；歷史只增不改；過一天不能復原',
    [...A.bad, ...B.bad].slice(0, 3).join('；') || `${A.s.city.history.length - 1} 筆事件、${A.days.length} 天、資金 ${A.s.money.toFixed(3)}、人口 ${A.s.pop}、釘住 ${A.tally['釘住'] ?? 0} 筆`);
  // 驗收 6：地價（本線的逐格標記＋實驗線的框）
  log(!A.land.length && A.tally['地價另算相同：框'] > 0 && A.tally['地價另算相同：整張'] > 0,
    `地價：劇本每一筆操作之後、每一天推進前後，每一格要嘛標了待重算、要嘛地價基準＝現算（不看實驗線的框，施工標記半徑 ${EDIT_STALE_R}）；每一天推進完的 LANDBASE 逐位元組＝照實驗線 54996–55001 另抄的那一步（有框只算框、沒框整張）`,
    A.land.slice(0, 2).join('；') || `逐格驗 ${A.n.land} 次；另算 ${A.days.length} 天（${['框', '整張', '不用算'].map(k => `${k} ${A.tally['地價另算相同：' + k] ?? 0}`).join('、')}）`);
  log(!A.replay.length && A.n.replay > A.days.length,
    '歷史重播（每一筆操作之後、每一天之後）：匯入那張碼＋到目前的全部事件重播出的城＝模擬，逐棟逐欄（含墓碑、屋齡、蓋起日）與路、等級、分區、樹、occ',
    A.replay.slice(0, 2).join('；') || `${A.n.replay} 次都相同`);
  log(!A.trip.length && A.n.segEnds === script.length && A.n.dayTrips === 3 && A.n.undoTrips === (A.tally['復原放置 k5'] ?? 0) + (A.tally['復原放置 k11'] ?? 0) && A.n.undoTrips >= 2,
    '存檔再讀檔（每一段結尾、頭 3 天每一天、每次復原掉放置之後）：存的路圖層（照實驗線 66717 另抄：快速路橋＝4）、資金取整、難度、天數照實驗線；讀回來重播成功（歷史跟存檔對得上）、逐格、建築（含墓碑）、歷史、資金、天數、難度、里程碑、星等、手勢編號都相同',
    A.trip.slice(0, 2).join('；') || `${A.n.trip} 次都相同（${A.n.segEnds} 段結尾、頭 ${A.n.dayTrips} 天、復原掉放置 ${A.n.undoTrips} 次）`);

  // 驗收 6、8 的另外幾種情況：預建城的拆除（df 1）、釘住結果的操作、紓困（都帶深查；紓困的帳走 runScript 的逐日帳）
  const pcode = read('src/content/samples/d011-prebuilt.code.txt').trim(), PS = prebuiltCase(decodeLabCode(pcode).save), QS = pinCase(script.site.x0, script.site.z0);
  const P = runScript(pcode, KT, vrank, PS, {}, undefined, { deep: true });
  const Q = runScript(code, KT, vrank, QS, {}, undefined, { deep: true });
  const BO = runScript(code, KT, vrank, [['ops', [{ k: 'money', v: 10 }]], ['days', 1], ['ops', [{ k: 'money', v: 10 }]], ['days', 1]], {}, undefined, { deep: true });
  const allBad = X => [...X.bad, ...X.land, ...X.replay, ...X.trip];
  log(!allBad(P).length && P.tally['釘住'] === PS.pins.size && ['點附屬格拆整棟', '拆除待確認', '3 秒內再按：拆', '滿 3 秒：重新待確認', '框選一級＋二級：只拆一級'].every(k => P.tally[k] === 1),
    '預建城（df 1、$3000）的拆除：點體育場的附屬格＝整棟 2×2 拆掉、事件記在根格、造價＝真的扣的錢；單格拆二級第一次只預備、2999 毫秒內再按才拆（分區留著）；三級過了剛好 3000 毫秒再按＝重新預備；框選一級＋二級只拆一級、預覽格數與總價＝扣款；每一筆之後帳、同步、地價、重播、存讀檔都對，推進一天照樣對',
    allBad(P).slice(0, 3).join('；') || tallyText(P.tally));
  log(!allBad(Q).length && Q.tally['釘住'] === QS.pins.size && ['同一區再劃：已經是這一區', '錢剛好：點', '差一塊：點', '差一塊：框', '錢剛好：框'].every(k => Q.tally[k] === 1),
    '釘住的操作（新城）：同一區再劃＝預覽 0 格、理由「已經是這一區」、不動；錢剛好＝預覽說夠、蓋成、資金歸 0；差一塊＝預覽說不夠、不蓋（點：錢不夠；框：資金不足！需要 $32）',
    allBad(Q).slice(0, 3).join('；') || tallyText(Q.tally));
  {
    const L0 = loadCode(code, KT, vrank), [d1, d2] = BO.days, st = d1?.settle;
    log(L0.ok && L0.sim.bailoutDay === -999 && !allBad(BO).length && BO.tally['紓困'] === 1 && st?.bailout === 250 && st.net <= 0 && Object.is(d1.money, 10 + st.income - st.upkeep + 250) && !d2.settle.bailout && d2.money === 10 && BO.s.bailoutDay === d1.day,
      '紓困（實驗線 56142：資金 <20、當天淨額 ≤0、離上次紓困 >60 天就送 $250）：新城讀檔後 bailoutDay＝−999（新圖 51113；存檔不存它），資金設 $10 推進一天就紓困；隔天再設 $10 不再送（離上次才 1 天）',
      allBad(BO).slice(0, 2).join('；') || `讀檔後 bailoutDay ${L0.ok && L0.sim.bailoutDay}；第 ${d1?.day} 天淨額 ${st?.net}、紓困 ${st?.bailout}、$${d1?.money}；第 ${d2?.day} 天紓困 ${d2?.settle.bailout ?? 0}、$${d2?.money}`);
  }

  // 涵蓋面：每一種都真的發生過（主劇本、預建城、釘住、紓困合起來；新加的都在清單上，不會悄悄不發生）
  {
    const all = {};
    for (const t of [A.tally, P.tally, Q.tally, BO.tally]) for (const [k, v] of Object.entries(t)) all[k] = (all[k] || 0) + v;
    const need = ['road', '橋', '快速路橋', 'zone', '改劃免費', 'place k5', 'place k11', 'doze bld', 'doze road', 'doze zone', 'doze tree', '復原', '錢不夠蓋前段', '框選整塊不蓋', '升級付差價', '蓋在樹上',
      '扣款＝預覽總價', 'pick 找到', '設定亂數', '框選略過二級以上', '拆除待確認', '復原放置 k5', '復原放置 k11', 'place k5 蓋在分區上', 'place k11 蓋在分區上', 'road 蓋在分區上', 'zone 蓋在樹上',
      '跨日留著：doze road', '跨日留著：doze zone', '跨日留著：place', '跨日留著：road', '存讀檔往返', '地價另算相同：框', '地價另算相同：整張', '紓困',
      '警察局蓋在分區上', '復原警察局', '電廠蓋在分區上', '復原電廠', '路穿過分區', '拆分區留著', '拆路留著', '分區劃在樹上', '快速路過河留著',
      '點附屬格拆整棟', '3 秒內再按：拆', '滿 3 秒：重新待確認', '框選一級＋二級：只拆一級', '同一區再劃：已經是這一區', '錢剛好：點', '差一塊：點', '差一塊：框', '錢剛好：框'];
    const miss = need.filter(k => !all[k]), refusals = Object.keys(all).filter(k => k.startsWith('拒絕'));
    log(miss.length === 0 && refusals.length >= 4 && (A.tally['釘住'] ?? 0) === script.pins.size,
      '劇本涵蓋：鋪路、橋、快速路橋、升級付差價、劃區、改劃免費、分區劃在樹上、電廠與警察局（蓋在分區上、復原）、路穿過分區、拆建築／路／分區／樹（拆路、拆分區留著跨日）、框選略過二級、單格拆除確認與逾時、點附屬格拆整棟、復原、錢不夠蓋前段、框選整塊不蓋、錢剛好與差一塊、同一區再劃、亂數對齊、紓困、地價框與整張、存讀檔往返、多種拒絕',
      miss.length ? '沒發生：' + miss.join('、') : tallyText(all));
  }

  // 驗收 5：重播（匯入＋全部事件，含拆除、復原）＝模擬結束時的城市，逐欄（墓碑、路、分區、樹、occ）
  {
    const s = A.s, rp = replayCity(A.L.start, s.city.history, KT, s.day), d = cityDiff(s.city, rp, '重播');
    const tomb = s.city.buildings.filter(q => q.goneDay !== undefined).length, kinds = new Set(s.city.history.map(e => e.t));
    log(!d && tomb > 0 && ['road', 'zone', 'place', 'doze', 'undo', 'grow'].every(t => kinds.has(t)),
      '歷史重播：匯入＋全部事件（生長、升級、鋪路、劃區、放置、拆除、復原）重播出的城＝模擬結束時，逐棟逐欄（含墓碑、屋齡）與路、等級、分區、樹、occ',
      d || `${s.city.buildings.length} 棟（墓碑 ${tomb}）、${s.city.history.length} 筆事件、種類 ${[...kinds].join('/')}`);
    let broke = '';
    try { replayCity(A.L.start, [...s.city.history, { day: s.day, t: 'bogus' }], KT); broke = '竟然成功'; } catch (e) { broke = e.message; }
    log(broke.includes('不認得'), '重播：不認得的事件直接丟例外，不猜', broke);
  }

  // 驗收 5：存檔再讀檔——城市、資金（照實驗線取整）、天數、難度、歷史都相同；同一份存檔讀兩次，之後推進的雜湊相同
  const s = A.s, T = roundTrip(s, A.L, KT, vrank), raw = T.raw;
  {
    log(!T.bad && raw.d3?.f === CITY_FORMAT && raw.d3?.hv === 2 && raw.d3.r?.length === s.city.history.length,
      '存檔（實驗線分享碼格式＋附加欄位 d3，歷史存法 hv 2）再讀檔：逐格、建築（含墓碑）、資金取整、天數、難度、里程碑、星等、歷史、手勢編號都相同，歷史重播成功',
      T.bad || `碼 ${T.code.length} 字、d3 格式 ${raw.d3?.f}、hv ${raw.d3?.hv}、歷史 ${raw.d3?.r?.length} 筆、$${raw.money}`);
    // 快速路橋：E 段那條快速路過河留到最後，存檔的路圖層在水上那幾格是 4（實驗線 66717），讀回來還是快速路、橋、等級 5（66879：rv 4 → bridge 1、hw 1）
    const rd = T.code ? decodeLabCode(T.code).save.layers.rd ?? '' : '', wet = script.hwyWet, n = s.w.N;
    const hb = wet.map(([x, z]) => { const i = z * n + x, t = T.q?.ok ? T.q.sim.w.tiles[i] : null; return rd[i] === '4' && t?.road && t.hw && t.bridge && t.rc === 5 ? null : `(${x},${z}) 存 ${rd[i]}、讀回 ${J(t && [t.road, t.hw, t.bridge, t.rc])}`; }).filter(Boolean);
    log(wet.length > 0 && !hb.length, '快速路橋：E 段快速路過河（留著），存檔的路圖層在水上那幾格＝4（實驗線 66717），讀回來還是快速路、橋、等級 5', hb.slice(0, 3).join('；') || `${wet.length} 格水面：${wet.map(c => c.join(',')).join(' ')}`);
    const L2 = T.q, L3 = loadCode(T.code, KT, vrank);
    if (L2?.ok && L3.ok) {
      for (let d = 0; d < 30; d++) { stepDay(L2.sim); stepDay(L3.sim); }
      const h2 = hashOf(L2.sim), h3 = hashOf(L3.sim);
      log(!!h2 && h2 === h3, '同一份存檔讀兩次，各推進 30 天，雜湊相同（讀檔照實驗線 load：亂數 seed^day、天氣重設）', `${h2}＝${h3}`);
      // 讀回來接著蓋：手勢編號接續、再存再讀照樣重播
      const s2 = L2.sim, n2 = s2.city.history.length, site = script.site;
      const r = commitOp(s2, { k: 'line', tool: 'road', x0: site.x0, z0: site.z0 + 1, x1: site.x0, z1: site.z0 + 3 }, 0);
      const T4 = roundTrip(s2, L2, KT, vrank);
      log(r.ok && r.g === s.stroke && !T4.bad && s2.city.history.length > n2,
        '讀檔後接著蓋：手勢編號接續，再存再讀照樣重播', T4.bad || `g ${r.g}、${T4.q.note}`);
    } else log(false, '同一份存檔讀兩次', '讀不回來');
  }

  // 讀檔的退路與驗型別（d3 是別人也能改的輸入）：丟例外的歷史 → 「重播失敗」；重播得出來卻跟存檔對不上 → 「對不上」（逐格比到那一格）；
  // 竄改的欄位 → 驗型別擋下、講出哪一項不對；都退回只用存檔、歷史從這張碼重新起算，城照樣能用。沒有 d3 的一般分享碼 → 從這張碼開始記
  {
    const n = s.w.N, site = script.site, enc = d3 => { const o = { ...raw }; delete o.z; o.d3 = d3; return encodeLabCode(o, { deflate: true }); };
    const usable = Lx => {
      const u = Lx.sim;
      if (u.city.history.length !== 1 || u.city.history[0].t !== 'import') return `歷史沒有從這張碼重新起算（${u.city.history.length} 筆）`;
      const m = syncMismatch(u); if (m) return '不同步：' + m;
      try { stepDay(u); } catch (e) { return '推進一天丟例外：' + e.message; }
      const r = commitOp(u, { k: 'line', tool: 'road', x0: site.x0 - 3, z0: site.z0, x1: site.x0 - 3, z1: site.z0 + 3 }, 0);
      if (r.placed !== 4) return `鋪不了路（${r.placed} 格，${r.reason}）`;
      const t = roundTrip(u, Lx, KT, vrank);
      return t.bad ? '再存再讀：' + t.bad : null;
    };
    const L5 = loadCode(enc({ f: raw.d3.f, s: raw.d3.s, g: raw.d3.g, h: s.city.history.filter((e, i) => !(i > 0 && e.t === 'place')) }), KT, vrank);   // 舊存法 hv 1、拿掉放置 → 重播丟例外
    const u5 = L5.ok ? usable(L5) : L5.error;
    log(L5.ok && !L5.replayed && /失敗/.test(L5.note) && !/對不上/.test(L5.note) && !u5, '讀檔的退路：歷史重播丟例外 → 只用存檔、講「重播失敗」與原因；城照樣能推進、施工、再存再讀', L5.ok && L5.replayed ? '竟然重播成功' : u5 || L5.note);
    const R = rcTamper(raw, s.city.history, s.w.tiles, n), L7 = loadCode(enc(R.d3), KT, vrank), u7 = L7.ok ? usable(L7) : L7.error;
    log(L7.ok && !L7.replayed && /對不上/.test(L7.note) && L7.note.includes(`第 ${R.i} 格`) && !/失敗/.test(L7.note) && !u7,
      '讀檔的退路：歷史重播得出來、卻跟存檔對不上（hv 2 第 ' + (R.row + 1) + ' 列的路等級 2 改成 4）→ 只用存檔、講「對不上」與哪一格；城照樣能用', L7.ok && L7.replayed ? '竟然重播成功（存檔的路等級跟歷史對不上，沒被發現）' : u7 || L7.note);
    const cases = tamperCases(raw, s.city.history, n), res = cases.map(([name, make, want]) => {
      const Lx = loadCode(enc(make()), KT, vrank);
      if (!Lx.ok) return `${name}：讀不進來 ${Lx.error}`;
      if (!want) return Lx.replayed && J(Lx.sim.city.history) === J(s.city.history) ? null : `${name}：${Lx.replayed ? '多的欄位帶進城市了' : Lx.note}`;
      if (Lx.replayed || !want.test(Lx.note)) return `${name}：${Lx.replayed ? '竟然重播成功' : Lx.note}`;
      const u = usable(Lx);
      return u ? `${name}：${u}` : null;
    }).filter(Boolean);
    log(!res.length, `竄改過的 d3（${cases.length} 種：hv 1 事件物件、hv 2 緊湊列；日子是 HTML、座標超出地圖、不認得的拆除圖層、列比種類長、不認得的種類、不認得的 hv）都被驗型別擋下、講出哪一項不對，退回只用存檔，城照樣能推進、施工、再存再讀；多出來的欄位照讀但不帶進城市`,
      res.slice(0, 3).join('；') || cases.map(c => c[0]).join('、'));
    const L6 = loadCode(read('src/content/samples/starter.code.txt'), KT, vrank);
    log(L6.ok && !L6.replayed && L6.sim.city.history.length === 1 && /沒有本線的歷史/.test(L6.note), '讀檔：沒有 d3 的一般分享碼從這張碼開始記', L6.ok ? L6.note : L6.error);
  }

  // 存檔的資金取整＝實驗線 save（index.html 66747 @d23c18d：money:Math.round(money)）
  {
    const L = loadCode(code, KT, vrank), bad = [];
    for (const [m, want] of MONEY_ROUND) {
      L.sim.money = m;
      const c2 = saveCode(L.sim, L.template, L.start), q = loadCode(c2, KT, vrank), got = decodeLabCode(c2).save.raw.money;
      if (got !== want || !q.ok || q.sim.money !== want) bad.push(`${m}：存 ${got}、讀回 ${q.ok && q.sim.money} ≠ ${want}`);
    }
    log(!bad.length, '存檔的資金取整＝實驗線 save 的 Math.round（66747，半數往 +∞）', bad.join('；') || MONEY_ROUND.map(([m, w]) => `${m}→${w}`).join('、'));
  }

  // 驗收 6：地價髒框。慢速版（opts.fullLand＝照實驗線逐字：整張就整張重算、有框只算框）跟本線的狀態機（整張＝只算標記過的格）在帶施工的劇本上逐日逐格相同
  {
    const S = runScript(code, KT, vrank, script, { fullLand: true });
    const d = A.days.findIndex((r, i) => r.land !== S.days[i]?.land);
    log(d < 0 && !!hA && hashOf(S.s) === hA && S.bad.length === 0, `地價狀態機＝照實驗線逐字的慢速版：帶施工的劇本 ${A.days.length} 天，LANDBASE 逐日逐格相同、結束雜湊相同`, d < 0 ? `${A.days.length} 天相同` : `第 ${A.days[d].day} 天不同`);
  }

  // 沙盒（起步城 df 3）：蓋東西不花錢（51505）、不做每日結算（56053）；單格拆二級以上要 3 秒內再按一次（62983）、框選拆除略過二級以上；存檔難度照存 3
  {
    const L = loadCode(read('src/content/samples/starter.code.txt'), KT, vrank);
    const s = L.sim, bad = [];
    let m = s.money, net = 0;
    for (let d = 0; d < 60; d++) { const st = stepDay(s).settle; net += st.income - st.upkeep; m += (st.milestone?.reward ?? 0) + (st.star?.bonus ?? 0) + (st.bailout ?? 0); }
    if (s.money !== m || !net) bad.push(`60 天後資金 ${s.money} ≠ 只加里程碑、星等、紓困的 ${m}（收支 ${net} 照算不入帳）`);
    const m0 = s.money;
    const lv2 = [...s.root.values()].filter(b => b.k <= 3 && b.lv >= 2), lv1 = [...s.root.values()].filter(b => b.k <= 3 && b.lv === 1);
    const h = lv2[0], rect = (x, z, t) => commitOp(s, { k: 'rect', tool: 'doze', x0: x, z0: z, x1: x, z1: z }, t);
    const r1 = rect(h.x, h.z, 100000), r2 = rect(h.x, h.z, 102999);
    const h2 = lv2[1], r3 = rect(h2.x, h2.z, 200000), r4 = rect(h2.x, h2.z, 203001);
    const zoneKept = s.w.tiles[h.z * s.w.N + h.x].zone === h.k;
    if (!(r1.armed && !r1.placed && r2.placed === 1 && h.goneDay === s.day && zoneKept)) bad.push(`單格拆二級：第一次 ${J({ armed: r1.armed, placed: r1.placed })}、第二次 ${J({ placed: r2.placed })}、墓碑 ${h.goneDay}、分區留著 ${zoneKept}`);
    if (!(r3.armed && r4.armed && !r4.placed && h2.goneDay === undefined)) bad.push('超過 3 秒：應該重新待確認');
    // 框選：一格二級、一格一級都在框裡 → 只拆一級
    const pair = lv1.find(b => lv2.some(q => q !== h && q.goneDay === undefined && Math.abs(q.x - b.x) + Math.abs(q.z - b.z) === 1));
    let rectNote = '找不到相鄰的一級與二級';
    if (pair) {
      const q = lv2.find(q => q !== h && q.goneDay === undefined && Math.abs(q.x - pair.x) + Math.abs(q.z - pair.z) === 1);
      const r = commitOp(s, { k: 'rect', tool: 'doze', x0: Math.min(q.x, pair.x), z0: Math.min(q.z, pair.z), x1: Math.max(q.x, pair.x), z1: Math.max(q.z, pair.z) }, 300000);
      rectNote = `框選拆 ${r.placed} 格；一級 ${pair.goneDay !== undefined ? '拆了' : '還在'}、二級 ${q.goneDay !== undefined ? '拆了' : '還在'}`;
      if (!(pair.goneDay !== undefined && q.goneDay === undefined)) bad.push(rectNote);
    } else bad.push(rectNote);
    const u = undoOp(s);
    if (!(u.ok && pair && pair.goneDay === undefined && syncMismatch(s) === null)) bad.push('復原框選拆除：建築沒回來或不同步');
    const site = starterSite(s);
    const r5 = commitOp(s, { k: 'line', tool: 'hwy', x0: site[0], z0: site[1], x1: site[0] + 6, z1: site[1] }, 400000);
    if (!(r5.placed > 0 && r5.spent === 0 && s.money === m0 && r5.events.every(e => e.cost === 0))) bad.push(`沙盒施工扣了錢：${r5.spent}、資金 ${s.money} ≠ ${m0}`);
    const rp = replayDiff(s, L.start, KT); if (rp) bad.push('沙盒劇本重播：' + rp);
    const T = roundTrip(s, L, KT, vrank);                                  // 存檔 df:diff（66753），讀檔 diff＝d.df（66987）：讀回來還是沙盒
    if (T.bad || T.raw?.df !== 3 || T.q?.sim?.diff !== 3) bad.push(`沙盒存讀檔：${T.bad ?? `存 df ${T.raw.df}、讀回難度 ${T.q.sim.diff}`}`);
    log(!bad.length && lv2.length >= 2, '沙盒（起步城 df 3）：每日收支照算不入帳（60 天資金只多了里程碑與星等獎金，同實驗線）；蓋東西不扣錢；單格拆二級要 3 秒內再按一次、超時重新待確認；拆掉建築分區留著；框選拆除略過二級；復原與重播都對；存檔 df 3、讀回來還是沙盒、重播成功',
      bad.slice(0, 3).join('；') || `二級 ${lv2.length} 棟、${rectNote}、快速路 ${r5.placed} 格 $0、存 df ${T.raw?.df}`);
  }

  // 驗收 8：推進一天（含結算）≤ 5 ms——劇本城第 61–120 天的平均（三次劇本取平均最低的一次，同 D010 的做法）。
  // 桌機 Node、沒降速量的；手機預算（CPU 降速）另由瀏覽器煙霧測試量
  {
    const runs = [A, B, runScript(code, KT, vrank, script)].map(R => { const ms = R.days.slice(60).map(d => d.ms).sort((a, b) => a - b); return { mean: ms.reduce((a, b) => a + b, 0) / ms.length, p95: ms[Math.floor(ms.length * .95)], max: ms.at(-1) }; });
    const best = runs.reduce((a, b) => (b.mean < a.mean ? b : a));
    log(best.mean <= 5, '推進一天（含結算）≤ 5 ms（桌機 Node，未降速）：劇本城第 61–120 天（三輪取平均最低）', `平均 ${best.mean.toFixed(2)} ms、P95 ${best.p95.toFixed(2)} ms、最大 ${best.max.toFixed(2)} ms；人口 ${A.s.pop}；深查那一跑整段 ${(tA / 1000).toFixed(1)} s`);
  }
  return { hash: hA, tally: A.tally, money: A.s.money, pop: A.s.pop };
}

// 起步城左上角外面、往北兩格那一排（沒有東西的平地）：沙盒鋪路用
function starterSite(s) {
  const n = s.w.N;
  for (let z = 2; z < n; z++) for (let x = 2; x < n - 8; x++) {
    let ok = true;
    for (let d = 0; d < 7 && ok; d++) { const t = s.w.tiles[z * n + x + d]; if (t.t !== 2 || t.road || t.bld || t.zone) ok = false; }
    if (ok) return [x, z];
  }
  throw new Error('沙盒：找不到空地');
}

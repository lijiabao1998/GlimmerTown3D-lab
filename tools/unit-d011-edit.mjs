// D011 Node 守衛（整合層）：手勢 → 實驗線放置規則 → 事件 → 城市模型 → 重播 → 存檔讀檔 → 地價狀態機。由 tools/unit.mjs 呼叫。
// 規則本身（canPlace／placeCost／doPlace／commitRect……、稅與維護費）另有黃金樣本守衛（unit-d011-build.mjs、unit-d011-money.mjs）；
// 這裡驗的是本線自己接的線：帳對不對、城市模型跟格子同不同步、歷史能不能重播、存檔讀回來是不是同一座城（驗收 5、6，驗收 7 的 Node 半邊）。
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
import { COVR, POL_SRC } from '../src/sim/rules/fields.ts';
import { d011Ops, run3d } from './d011-ops.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const NEWCITY = 'src/content/samples/newcity.code.txt';

// ---- 劇本：新城上四段施工，中間推進，共 120 天 ----
// A、B＝對拍劇本（tools/d011-ops.mjs，開跑前、第 1 天後）；C（第 30 天）、D（第 60 天）＝擴建、升級、降級、樹、橋、拆除、復原
export function scriptOf(code) {
  const S = decodeLabCode(code).save, n = S.n, lay = k => Uint8Array.from(S.layers[k] ?? '', ch => ch.charCodeAt(0) - 48);
  const { A, B, site, tree2 } = d011Ops(n, lay('ter'), lay('el'), lay('tre'));
  const X = site.x0, Z = site.z0;
  const C = [
    { k: 'line', tool: 'road', x0: X, z0: Z + 15, x1: X + 20, z1: Z + 15 },
    { k: 'line', tool: 'road', x0: X + 10, z0: Z + 10, x1: X + 10, z1: Z + 20 },
    { k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 11, x1: X + 9, z1: Z + 14 },
    { k: 'rect', tool: 'zc', x0: X + 11, z0: Z + 11, x1: X + 19, z1: Z + 14 },
    { k: 'rect', tool: 'zi', x0: X + 11, z0: Z + 16, x1: X + 19, z1: Z + 19 },
    { k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 16, x1: X + 9, z1: Z + 19 },
    { k: 'line', tool: 'art', x0: X, z0: Z + 5, x1: X + 20, z1: Z + 5 },              // 主街升主幹道：付差價
    { k: 'line', tool: 'alley', x0: X, z0: Z + 5, x1: X + 3, z1: Z + 5 },             // 降級：拒絕
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
    { k: 'tap', tool: 'doze', x: X + 20, z: Z + 16 },                                 // 拆第 30 天蓋的警察局
  ];
  return Object.assign([['ops', A], ['days', 1], ['ops', B], ['days', 29], ['ops', C], ['days', 30], ['ops', D], ['days', 60]], { site: { x0: X, z0: Z } });
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

// 跑劇本：每一筆操作與每一天都核帳（資金逐位）、核同步、核歷史只增不改。stepOpts 給地價雙胞胎用
export function runScript(code, KT, vrank, script, stepOpts = {}, onStep) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('新城碼讀不進來：' + L.error);
  const s = L.sim, picks = {}, bad = [], tally = {}, days = [];
  const hit = k => { tally[k] = (tally[k] || 0) + 1; };
  let clock = 0, hist = J(s.city.history);
  const after = what => {
    const m = syncMismatch(s); if (m) bad.push(`${what}：${m}`);
    const h = J(s.city.history); if (!h.startsWith(hist.slice(0, -1))) bad.push(`${what}：歷史被改了`); hist = h;
  };
  for (const [kind, arg] of script) {
    if (kind === 'days') {
      for (let d = 0; d < arg; d++) {
        const m0 = s.money, t = performance.now(), rep = stepDay(s, stepOpts), ms = performance.now() - t;
        // 當天的帳：結算（56053，沙盒不入帳）→ 里程碑 → 星等獎金 → 紓困，依序加，要逐位等於模擬的資金
        let m = m0; const st = rep.settle;
        if (s.diff !== 3) m += st.income - st.upkeep;
        if (st.milestone) { m += st.milestone.reward; hit('里程碑'); }
        if (st.star) { m += st.star.bonus; hit('星等獎金'); }
        if (st.bailout) { m += st.bailout; hit('紓困'); }
        if (!Object.is(m, s.money)) bad.push(`第 ${s.day} 天資金 ${s.money} ≠ 帳 ${m}`);
        if (canUndo(s)) bad.push(`第 ${s.day} 天：過了一天還能復原`);
        days.push({ day: s.day, ms, land: Buffer.from(s.g.LANDBASE).toString('base64'), money: s.money, pop: s.pop });
        after(`第 ${s.day} 天`);
        onStep?.(s, null, rep);
      }
      continue;
    }
    for (const o of arg) {
      clock += 10000;                                                   // 每筆隔 10 秒：拆除確認不會跨筆生效
      const m0 = s.money, n0 = s.city.history.length;
      const pv = o.k === 'line' || o.k === 'rect' || (o.k === 'tap' && !o.at) ? previewOp(s, { k: o.k, tool: o.tool, x0: o.x0 ?? o.x, z0: o.z0 ?? o.z, x1: o.x1 ?? o.x, z1: o.z1 ?? o.z }) : null;
      const trees = new Set((pv?.cells ?? []).map(c => c.z * s.w.N + c.x).filter(i => s.w.tiles[i].tree));
      const r = run3d(s, o, picks, clock);
      const ev = s.city.history.slice(n0);
      ev.forEach(e => { const b = shapeBad(e); if (b) bad.push(b); });
      if (o.k === 'money') { hit('設定資金'); after('設定資金'); onStep?.(s, o, r); continue; }
      if (o.k === 'pick') { hit(r.found ? 'pick 找到' : 'pick 沒找到'); continue; }
      if (o.k === 'undo') {
        if (r.ok) { hit('復原'); if (!Object.is(s.money, m0 + r.refund) || ev.length !== 1 || ev[0].t !== 'undo' || ev[0].refund !== r.refund) bad.push(`復原：資金 ${m0}+${r.refund}≠${s.money} 或事件不對`); }
        else hit('復原（沒東西）');
        after('復原'); onStep?.(s, o, r); continue;
      }
      // 扣的錢＝事件記的造價，依施工順序逐筆減（實驗線 money-=cost 逐格，52399）
      let m = m0; for (const e of ev) m -= e.cost;
      if (!Object.is(m, s.money)) bad.push(`${o.k} ${o.tool}：資金 ${s.money} ≠ 起始 ${m0} 減事件造價 ${m}`);
      if (!Object.is(r.spent, m0 - s.money)) bad.push(`${o.k} ${o.tool}：回報的花費 ${r.spent} ≠ ${m0 - s.money}`);
      if (pv && pv.affordable && r.placed > 0 && r.placed === pv.count && r.spent !== pv.total) bad.push(`${o.k} ${o.tool}：扣 ${r.spent} ≠ 預覽總價 ${pv.total}`);
      if (pv && pv.affordable && r.placed > 0 && r.placed === pv.count) hit('扣款＝預覽總價');
      // 涵蓋面：記下這一筆發生了什麼（守衛要求每一種都真的發生過）
      if (!r.placed) hit(`拒絕：${r.reason ?? (r.armed ? '拆除待確認' : '?')}`);
      for (const e of ev) {
        const t = s.w.tiles[e.z * s.w.N + e.x];
        if (e.t === 'road') hit(t.bridge ? '橋' : 'road');
        if (e.t === 'zone') hit(e.cost === 0 ? '改劃免費' : 'zone');
        if (e.t === 'place') hit(`place k${e.k}`);
        if (e.t === 'doze') hit(`doze ${e.layer}`);
      }
      if (o.k === 'line' && r.placed > 0 && pv && !pv.affordable) hit('錢不夠蓋前段');
      if (o.k === 'rect' && !r.placed && pv && !pv.affordable && pv.count) hit('框選整塊不蓋');
      if (ev.some(e => e.t === 'road' && e.cost > 0 && e.cost < 15 && o.tool === 'road')) hit('升級付差價');
      if (o.tool !== 'doze' && ev.some(e => trees.has(e.z * s.w.N + e.x))) hit('蓋在樹上');
      after(`${o.k} ${o.tool}`);
      onStep?.(s, o, r);
    }
  }
  return { s, L, bad, tally, days };
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

export async function d011EditGuards(log) {
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

  // 驗收 5：劇本跑兩次雜湊相同、換種子不同；每一筆的帳、同步、歷史只增不改
  const A = runScript(code, KT, vrank, script), B = runScript(code, KT, vrank, script);
  const hA = simHash(A.s), hB = simHash(B.s), hC = simHash(runScript(codeWithSeed(code, 777), KT, vrank, script).s);
  log(hA === hB && hA !== hC, `決定性：新城＋四段施工＋120 天，兩次雜湊相同、換種子不同`, `${hA}＝${hB}；種子 777：${hC}`);
  log(A.bad.length === 0, '每一筆施工：扣的錢＝事件造價逐筆減（逐位）、回報的花費相同、全部蓋成時＝預覽總價；每一天：資金＝結算＋里程碑＋星等＋紓困逐筆加；城市模型與格子逐格同步；歷史只增不改；過一天不能復原',
    A.bad.slice(0, 3).join('；') || `${A.s.city.history.length - 1} 筆事件、${A.days.length} 天、資金 ${A.s.money.toFixed(3)}、人口 ${A.s.pop}`);
  const need = ['road', '橋', 'zone', '改劃免費', 'place k5', 'place k11', 'doze bld', 'doze road', 'doze zone', 'doze tree', '復原', '錢不夠蓋前段', '框選整塊不蓋', '升級付差價', '蓋在樹上', '扣款＝預覽總價'];
  const miss = need.filter(k => !A.tally[k]), refusals = Object.keys(A.tally).filter(k => k.startsWith('拒絕'));
  log(miss.length === 0 && refusals.length >= 4, '劇本涵蓋：鋪路、橋、升級付差價、劃區、改劃免費、電廠、警察局、拆建築／路／分區／樹、復原、錢不夠蓋前段、框選整塊不蓋、多種拒絕',
    miss.length ? '沒發生：' + miss.join('、') : Object.entries(A.tally).map(([k, v]) => `${k}×${v}`).join('、'));

  // 驗收 5：重播（匯入＋全部事件，含拆除、復原）＝模擬結束時的城市，逐欄（墓碑、路、分區、樹、occ）
  {
    const s = A.s, rp = replayCity(A.L.start, s.city.history, KT, s.day);
    const F = b => [b.id, b.k, b.lv, b.v, b.age, b.x, b.z, b.size, b.abandoned, b.builtDay, b.goneDay ?? -1];
    const a = s.city.buildings.map(F), b = rp.buildings.map(F);
    const rows = a.map((r, i) => J(r) === J(b[i]) ? null : `#${i + 1}: 模擬 ${J(r)} ≠ 重播 ${J(b[i])}`).filter(Boolean);
    const lay = ['road', 'rclass', 'zone', 'tree', 'occ'].filter(k => Buffer.compare(Buffer.from(rp[k].buffer), Buffer.from(s.city[k].buffer)) !== 0);
    const tomb = s.city.buildings.filter(q => q.goneDay !== undefined).length, kinds = new Set(s.city.history.map(e => e.t));
    log(a.length === b.length && !rows.length && !lay.length && tomb > 0 && ['road', 'zone', 'place', 'doze', 'undo', 'grow'].every(t => kinds.has(t)),
      '歷史重播：匯入＋全部事件（生長、升級、鋪路、劃區、放置、拆除、復原）重播出的城＝模擬結束時，逐棟逐欄（含墓碑、屋齡）與路、等級、分區、樹、occ',
      rows.slice(0, 2).join('；') || (lay.length ? '圖層不同：' + lay.join(',') : `${a.length} 棟（墓碑 ${tomb}）、${s.city.history.length} 筆事件、種類 ${[...kinds].join('/')}`));
    let broke = '';
    try { replayCity(A.L.start, [...s.city.history, { day: s.day, t: 'bogus' }], KT); broke = '竟然成功'; } catch (e) { broke = e.message; }
    log(broke.includes('不認得'), '重播：不認得的事件直接丟例外，不猜', broke);
  }

  // 驗收 5：存檔再讀檔——城市、資金（照實驗線取整）、天數、難度、歷史都相同；同一份存檔讀兩次，之後推進的雜湊相同
  {
    const s = A.s, code2 = saveCode(s, A.L.template, A.L.start), L2 = loadCode(code2, KT, vrank), L3 = loadCode(code2, KT, vrank);
    const raw = decodeLabCode(code2).save.raw;
    const T = t => [t.t, t.road, t.hw, t.bridge, t.road ? t.rc : 0, t.zone || 0, t.tree || 0, t.bld ? [t.bld.k, t.bld.lv, t.bld.v, t.bld.age, t.bld.ref ?? 0, t.bld.k === 1 ? [t.bld.den ?? 3, t.bld.we ?? 1] : 0, +(t.bld.fire || 0)] : 0];
    const F = b => [b.id, b.k, b.lv, b.v, b.age, b.x, b.z, b.size, b.builtDay, b.goneDay ?? -1];
    const bad = [];
    if (!L2.ok || !L2.replayed) bad.push('讀檔沒有重播：' + (L2.ok ? L2.note : L2.error));
    else {
      const q = L2.sim;
      if (q.money !== Math.round(s.money)) bad.push(`資金 ${q.money} ≠ round(${s.money})`);
      if (q.day !== s.day || q.diff !== s.diff || q.msIdx !== s.msIdx || q.bestStar !== s.bestStar || q.stroke !== s.stroke) bad.push('天數／難度／里程碑／星等／手勢編號不同');
      if (J(q.city.history) !== J(s.city.history)) bad.push('歷史不同');
      if (J(q.city.buildings.map(F)) !== J(s.city.buildings.map(F))) bad.push('建築清單（含墓碑）不同');
      const lay = ['road', 'rclass', 'zone', 'tree', 'occ'].filter(k => Buffer.compare(Buffer.from(q.city[k].buffer), Buffer.from(s.city[k].buffer)) !== 0);
      if (lay.length) bad.push('圖層不同 ' + lay.join(','));
      const ti = s.w.tiles.findIndex((t, i) => J(T(t)) !== J(T(q.w.tiles[i])));
      if (ti >= 0) bad.push(`第 ${ti} 格：${J(T(s.w.tiles[ti]))} ≠ ${J(T(q.w.tiles[ti]))}`);
      const m = syncMismatch(q); if (m) bad.push('讀回的城不同步：' + m);
    }
    log(!bad.length && raw.d3?.f === CITY_FORMAT && raw.money === Math.round(s.money) && raw.df === s.diff && !Object.keys(raw).some(k => k.startsWith('glimmerville')),
      '存檔（實驗線分享碼格式＋附加欄位 d3）再讀檔：逐格、建築（含墓碑）、資金取整、天數、難度、里程碑、星等、歷史、手勢編號都相同，歷史重播成功',
      bad.slice(0, 3).join('；') || `碼 ${code2.length} 字、d3 格式 ${raw.d3?.f}、歷史 ${raw.d3?.h.length} 筆、$${raw.money}`);
    if (L2.ok && L3.ok) {
      for (let d = 0; d < 30; d++) { stepDay(L2.sim); stepDay(L3.sim); }
      const h2 = simHash(L2.sim), h3 = simHash(L3.sim);
      log(h2 === h3, '同一份存檔讀兩次，各推進 30 天，雜湊相同（讀檔照實驗線 load：亂數 seed^day、天氣重設）', `${h2}＝${h3}`);
      // 讀回來接著蓋：手勢編號接續、再存再讀照樣重播
      const s2 = L2.sim, n2 = s2.city.history.length, site = script.site;
      const r = commitOp(s2, { k: 'line', tool: 'road', x0: site.x0, z0: site.z0 + 1, x1: site.x0, z1: site.z0 + 3 }, 0);
      const L4 = loadCode(saveCode(s2, L2.template, L2.start), KT, vrank);
      log(r.ok && r.g === s.stroke && L4.ok && L4.replayed && L4.sim.city.history.length === s2.city.history.length && s2.city.history.length > n2,
        '讀檔後接著蓋：手勢編號接續，再存再讀照樣重播', L4.ok ? `g ${r.g}、${L4.note}` : L4.error);
    }
    // 歷史對不上（被改過）→ 退回只用存檔，講得出原因；沒有 d3 的一般分享碼 → 從這張碼開始記
    const o = { ...raw }; delete o.z; o.d3 = { ...raw.d3, h: raw.d3.h.filter((e, i) => !(i > 0 && e.t === 'place')) };
    const L5 = loadCode(encodeLabCode(o, { deflate: true }), KT, vrank);
    const L6 = loadCode(read('src/content/samples/starter.code.txt'), KT, vrank);
    log(L5.ok && !L5.replayed && /對不上|失敗/.test(L5.note) && L6.ok && !L6.replayed && L6.sim.city.history.length === 1,
      '讀檔的退路：歷史跟存檔對不上就只用存檔並講原因；沒有 d3 的分享碼從這張碼開始記', `${L5.ok && L5.note}；${L6.ok && L6.note}`);
  }

  // 驗收 6：地價髒框。慢速版（opts.fullLand＝照實驗線逐字：整張就整張重算、有框只算框）跟本線的狀態機（整張＝只算標記過的格）在帶施工的劇本上逐日逐格相同
  {
    const S = runScript(code, KT, vrank, script, { fullLand: true });
    const d = A.days.findIndex((r, i) => r.land !== S.days[i]?.land);
    log(d < 0 && simHash(S.s) === hA && S.bad.length === 0, `地價狀態機＝照實驗線逐字的慢速版：帶施工的劇本 ${A.days.length} 天，LANDBASE 逐日逐格相同、結束雜湊相同`, d < 0 ? `${A.days.length} 天相同` : `第 ${A.days[d].day} 天不同`);
    const radii = { police: COVR.police, plantCov: COVR.plant, plantPol: POL_SRC[5].r, tree: 2 };
    log(Object.values(radii).every(r => r <= EDIT_STALE_R), `施工的地價標記半徑 ${EDIT_STALE_R} ≥ 本卡工具會改到的地價輸入半徑（實驗線 doPlace 自己的髒框也是 20）`, J(radii));
  }

  // 沙盒（起步城 df 3）：蓋東西不花錢（51505）、不做每日結算（56053）；單格拆二級以上要 3 秒內再按一次（62983）、框選拆除略過二級以上
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
    const rp = replayCity(L.start, s.city.history, KT, s.day), F = b => [b.id, b.k, b.lv, b.v, b.age, b.x, b.z, b.goneDay ?? -1];
    if (J(rp.buildings.map(F)) !== J(s.city.buildings.map(F)) || Buffer.compare(Buffer.from(rp.occ.buffer), Buffer.from(s.city.occ.buffer))) bad.push('沙盒劇本重播不等');
    log(!bad.length && lv2.length >= 2, '沙盒（起步城 df 3）：每日收支照算不入帳（60 天資金只多了里程碑與星等獎金，同實驗線）；蓋東西不扣錢；單格拆二級要 3 秒內再按一次、超時重新待確認；拆掉建築分區留著；框選拆除略過二級；復原與重播都對',
      bad.slice(0, 3).join('；') || `二級 ${lv2.length} 棟、${rectNote}、快速路 ${r5.placed} 格 $0`);
  }

  // 驗收 8：推進一天（含結算）≤ 5 ms——劇本城第 61–120 天的平均（三次劇本取平均最低的一次，同 D010 的做法）
  {
    const runs = [A, B, runScript(code, KT, vrank, script)].map(R => { const ms = R.days.slice(60).map(d => d.ms).sort((a, b) => a - b); return { mean: ms.reduce((a, b) => a + b, 0) / ms.length, p95: ms[Math.floor(ms.length * .95)], max: ms.at(-1) }; });
    const best = runs.reduce((a, b) => (b.mean < a.mean ? b : a));
    log(best.mean <= 5, '推進一天（含結算）≤ 5 ms：劇本城第 61–120 天（三輪取平均最低）', `平均 ${best.mean.toFixed(2)} ms、P95 ${best.p95.toFixed(2)} ms、最大 ${best.max.toFixed(2)} ms；人口 ${A.s.pop}`);
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

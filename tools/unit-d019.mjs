// D019 Node 守衛：供水（驗收 2，及驗收 5 的歷史半邊）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d019-water.json（tools/lab-water.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；
//   2. 供水網逐格＝實驗線：實驗線原文（T、idx、inMap、WATER_TOWER_CAP、DESAL_CAP、computeWaterLegacy449、hasWaterNear，
//      computeWater 舊式分支取容量那一行、tick() 的容量 55010、逐棟 55157、計數 55160 四行原文）在 vm 裡跑，
//      跟本線 src/sim/rules/water.ts（computeWaterLegacy449、assignWater、hasWaterNear）吃同一批隨機小圖：
//      水塔、淡化廠（2×2 含 ref 格）、水管疏密不同、住商工與社宅有電沒電、其他建築；長水管（超過 90 步）、密集城（超過容量 80）；
//      同一張圖連續多次（中間加減水管、水塔、換電）：每一格 wr、每一棟 wa、容量、有水棟數，另抽查 hasWaterNear（半徑 0–3），每一次都相等；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一處（90 步、容量、淡化廠算每一格、不先清 wr、半徑、容量比較、沒電也給水、看 wp 不看 wr）；
//   4. 接線：day.ts 每天算 wCap＝floor(computeWaterLegacy449)，給電之後照建築索引給水（assignWater）；
//   5. 歷史：新城鋪水管、拆水管、復原：事件、重播＝模擬（水管圖層逐格）、存檔讀回；沒有水管事件的存檔照寫格式 4，有才寫 5；
//      格式 5 的列 [9,…] 與拆除圖層碼 4 讀得回來；竄改（座標出界、造價不是數字）擋下；
//   6. 讀進來的城：存檔的 wp 圖層進到模擬的格子（D019 以前讀檔丟掉了）；有水塔、水管的城推進一天，接得到水的住商工真的有水。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as labHelpers from '../src/sim/rules/lab.ts';
import { computeWaterLegacy449, assignWater, hasWaterNear, WATER_TOWER_CAP, DESAL_CAP } from '../src/sim/rules/water.ts';
import { loadCode, saveCode, unpackHistory, packHistory } from '../src/io/save.ts';
import { decodeLabCode, encodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { replayCity } from '../src/sim/replay.ts';
import { stepDay } from '../src/sim/day.ts';
import { commitOp, undoOp } from '../src/sim/edit.ts';
import { CITY_FORMAT } from '../src/sim/city.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const PIECES = ['T', 'idx', 'inMap', 'WATER_TOWER_CAP', 'DESAL_CAP', 'computeWaterLegacy449', 'hasWaterNear', '舊式分支取容量', '每天的容量', '逐棟有沒有水', '數有水的棟數'];
const KEY = { 舊式分支取容量: 'callLegacy', 每天的容量: 'callWCap', 逐棟有沒有水: 'callWa', 數有水的棟數: 'callWatered' };

export async function d019Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D019 守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 實驗線那一邊：原文在 vm 裡（strict）。computeWater 只接舊式分支（對拍設定 __legacyWater449）：取容量那一行原文＋return cap（53304、53309）；
// 那一行後面清的 T449 觀測陣列換成空樁。tick：容量那一行原文，接著照 55050–55054、55150 的過濾走建築索引，逐棟那兩行原文
function makeLab(t) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';let N=1,tiles=[];const drought=false,DROUGHT_WATER_MULT=.5,waterLegacy449=()=>true;
const WATER_COMP449={fill(){}},WATER_DIST449={fill(){}},WATER_DIST_INF449=0;
${t.T}\n${t.idx}\n${t.inMap}\n${t.WATER_TOWER_CAP}\n${t.DESAL_CAP}\n${t.computeWaterLegacy449}\n${t.hasWaterNear}
function computeWater(){\n${t.callLegacy}\nreturn cap;}
globalThis.__api={set:(n,ts)=>{N=n;tiles=ts;},near:(x,y,r)=>hasWaterNear(x,y,r),
  tick:order=>{\n${t.callWCap}\nlet watered=0;for(const i of order){const b=tiles[i].bld;if(!b||b.ref)continue;if(b.k>3&&b.k!==127)continue;const x=i%N,y=(i/N)|0;\n${t.callWa}\n${t.callWatered}\n}return {wCap,watered};}};`,
  ctx, { filename: 'lab:water' });
  return ctx.__api;
}
// 本線那一邊（water.ts；突變時傳型別剝除後在 vm 裡載入的那一份）。day.ts 同樣是 Math.floor(computeWaterLegacy449(w)) 再 assignWater
const makeMine = (m = { computeWaterLegacy449, assignWater, hasWaterNear }) => {
  let w = null;
  return { set: (n, ts) => { w = { N: n, tiles: ts }; }, near: (x, y, r) => m.hasWaterNear(w, x, y, r),
    tick: order => { const wCap = Math.floor(m.computeWaterLegacy449(w)); return { wCap, watered: m.assignWater(w, order, wCap) }; } };
};

// 隨機小圖。家族：一般、密集（住商工超過容量 80）、長水管（蛇形超過 90 步）、淡化廠多
function cases() {
  const out = [], R = mulberry32(20261019), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  const other = [4, 5, 6, 7, 9, 11, 12, 52, 100];
  for (let m = 0; m < 360; m++) {
    const fam = m % 12 === 0 ? 'dense' : m % 12 === 1 ? 'snake' : m % 12 === 2 ? 'desal' : 'random';
    const N = fam === 'dense' ? int(30, 44) : fam === 'snake' ? int(12, 20) : m < 24 ? int(2, 5) : int(4, 32);
    const tiles = Array.from({ length: N * N }, () => ({ t: ch(.1) ? 0 : ch(.2) ? 1 : 2, bld: null }));
    const at = (x, y) => tiles[y * N + x];
    const put = (x, y, k, sz = 1, extra = {}) => {
      for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (x + dx >= N || y + dy >= N || at(x + dx, y + dy).bld) return false;
      at(x, y).bld = { k, lv: 1, v: 0, ...(sz > 1 ? { sz } : {}), ...extra };
      for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (dx || dy) at(x + dx, y + dy).bld = { k, lv: 0, v: 0, ref: [x, y] };
      return true;
    };
    const pw = () => ch(fam === 'dense' ? .95 : .7);
    const pipeP = fam === 'dense' ? .85 : pick([0, .05, .15, .35, .6, .9]);
    if (fam === 'snake') {   // 一條蛇形水管鋪滿整張（長度 N² 左右），水塔在起點旁
      for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x++) at(x, y).wp = 1;
      for (let y = 1; y < N; y += 2) at(((y >> 1) % 2) ? 0 : N - 1, y).wp = 1;
    } else for (const t of tiles) if (ch(pipeP)) t.wp = 1;
    const towers = fam === 'dense' ? int(1, 2) : fam === 'snake' ? 1 : int(0, 5), desal = fam === 'desal' ? int(1, 3) : ch(.1) ? 1 : 0;
    for (let q = 0; q < towers; q++) { const x = fam === 'snake' ? 0 : int(0, N - 1), y = fam === 'snake' ? 1 : int(0, N - 1); at(x, y).bld = null; put(x, y, 10); }
    for (let q = 0; q < desal; q++) put(int(0, N - 1), int(0, N - 1), 129, 2);
    const nb = fam === 'dense' ? Math.floor(N * N * .6) : int(0, Math.min(60, N * N));
    for (let q = 0; q < nb; q++) {
      const x = int(0, N - 1), y = int(0, N - 1), r = R();
      if (r < .75) put(x, y, pick([1, 2, 3]), 1, { pw: pw() }); else if (r < .82) put(x, y, 127, 1, { pw: pw() }); else put(x, y, pick(other), ch(.3) ? 2 : 1);
    }
    const steps = [];
    for (let s = 0, n = int(2, 5); s < n; s++) steps.push({ edit: s ? int(0, 3) : 0, probes: int(3, 8) });
    out.push({ fam, N, tiles, steps });
  }
  return { list: out, R };
}
// 兩邊各一份格子（深拷貝），每一步先照同一串亂數改圖（加減水管、水塔、換電），再各自算
function runCase(c, lab, mine, seed) {
  const R = mulberry32(seed), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p;
  const A = JSON.parse(J(c.tiles)), B = JSON.parse(J(c.tiles)), N = c.N;
  lab.set(N, A); mine.set(N, B);
  const recs = [];
  for (const st of c.steps) {
    for (let e = 0; e < st.edit; e++) {
      const i = int(0, N * N - 1), kind = R();
      for (const T of [A, B]) {
        if (kind < .5) T[i].wp = T[i].wp ? 0 : 1;
        else if (kind < .65) { if (!T[i].bld) T[i].bld = { k: 10, lv: 1, v: 0 }; else if (T[i].bld.k === 10) T[i].bld = null; }
        else for (const t of T) if (t.bld && !t.bld.ref && ((t.bld.k | 0) <= 3 || t.bld.k === 127)) { t.bld.pw = !t.bld.pw; break; }
      }
      void ch;
    }
    const order = []; for (let i = 0; i < N * N; i++) if (A[i].bld) order.push(i);
    const a = lab.tick(order), b = mine.tick(order);
    const probe = [];
    for (let p = 0; p < st.probes; p++) { const x = int(-1, N), y = int(-1, N), r = int(0, 3); probe.push([lab.near(x, y, r), mine.near(x, y, r)]); }
    recs.push([J(a), J(b), J(A.map(t => [t.wr, t.bld?.wa])), J(B.map(t => [t.wr, t.bld?.wa])), J(probe.map(q => q[0])), J(probe.map(q => q[1])), a.watered, a.wCap]);
  }
  return recs;
}

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d019-water.json')), T = { ...S.text };
  for (const [k, v] of Object.entries(KEY)) T[k] = S.text[v];

  // ---- 1. 出處 ----
  {
    const bad = [];
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    const got = (S.pieces ?? []).map(p => p.name);
    if (J(got) !== J(PIECES)) bad.push(`段落 ${got.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[KEY[p.name] ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    if (+S.text.WATER_TOWER_CAP.match(/=(\d+);/)[1] !== WATER_TOWER_CAP || +S.text.DESAL_CAP.match(/=(\d+);/)[1] !== DESAL_CAP) bad.push('容量常數跟本線不同');
    log(!bad.length, `D019 供水原文：實驗線 ${PINNED.slice(0, 7)} 的 ${PIECES.length} 段（舊式供水網 53267–53299、hasWaterNear 53581、tick 55010／55157／55160 等）sha256 逐段＝錨點記錄；容量常數水塔 ${WATER_TOWER_CAP}、淡化廠 ${DESAL_CAP}＝本線`,
      bad.join('；') || (S.pieces ?? []).map(p => `${p.name} ${p.line}`).join('、'));
  }

  // ---- 2. 供水網逐格＝實驗線 ----
  const C = cases();
  const compare = (lab, mine, stopAtFirst = false) => {
    let steps = 0, diffs = 0, first = '', capHit = 0, longPipe = 0, watered = 0;
    for (let m = 0; m < C.list.length; m++) {
      const recs = runCase(C.list[m], lab, mine, 1000 + m);
      for (const [a, b, ta, tb, pa, pb, wd, cap] of recs) {
        steps++; watered += wd; if (wd === cap && cap > 0) capHit++;
        if (a !== b || ta !== tb || pa !== pb) { diffs++; if (!first) first = `第 ${m} 張（${C.list[m].fam}）${a !== b ? `容量／有水 ${a}≠${b}` : ta !== tb ? '逐格 wr／wa 不同' : 'hasWaterNear 不同'}`; if (stopAtFirst) return { steps, diffs, first }; }
      }
      if (C.list[m].fam === 'snake') longPipe++;
    }
    return { steps, diffs, first, capHit, longPipe, watered };
  };
  const base = compare(makeLab(T), makeMine());
  log(base.diffs === 0 && base.capHit > 0 && base.longPipe > 0, `D019 驗收 2：供水網逐格＝實驗線——實驗線原文在 vm 裡跟本線 water.ts 吃 ${C.list.length} 張隨機小圖 ${base.steps} 步（水塔、淡化廠 2×2、疏密水管、蛇形長水管、密集城超過容量、中途加減水管水塔與換電）：每一格 wr、每一棟 wa、容量、有水棟數、hasWaterNear 抽查每一步都相等`,
    base.first || `有水 ${base.watered.toLocaleString()} 棟次；容量用滿 ${base.capHit} 步；蛇形長水管 ${base.longPipe} 張`);

  // ---- 3. 注入錯誤要紅 ----
  {
    const LAB_MUT = [
      ['90 步→89', 'computeWaterLegacy449', 'if(d>=90)continue;', 'if(d>=89)continue;'],
      ['水塔容量 80→79', 'WATER_TOWER_CAP', 'const WATER_TOWER_CAP=80;', 'const WATER_TOWER_CAP=79;'],
      ['淡化廠容量算每一格', 'computeWaterLegacy449', 'if(b&&!b.ref){if(b.k===10)towers++;else if(b.k===129)desalRoots++;}', 'if(b){if(b.k===10)towers++;else if(b.k===129)desalRoots++;}'],
      ['不先清 wr', 'computeWaterLegacy449', 'const b=tiles[i].bld;tiles[i].wr=false;', 'const b=tiles[i].bld;'],
      ['逐棟半徑 2→1', 'callWa', 'hasWaterNear(x,y,2)', 'hasWaterNear(x,y,1)'],
      ['容量 < 改成 <=', 'callWa', 'watered<wCap', 'watered<=wCap'],
      ['沒電也給水', 'callWa', 'b.wa=b.pw&&', 'b.wa='],
      ['看水管不看接通', 'hasWaterNear', 'if(T(idx(nx,ny)).wr)return true;', 'if(T(idx(nx,ny)).wp)return true;'],
    ];
    const MINE_MUT = [
      ['90 步→89', 'if (d >= 90) continue;', 'if (d >= 89) continue;'],
      ['水塔容量 80→79', 'export const WATER_TOWER_CAP = 80;', 'export const WATER_TOWER_CAP = 79;'],
      ['淡化廠容量算每一格', 'if (b && !b.ref) { if (b.k === 10) towers++;', 'if (b) { if (b.k === 10) towers++;'],
      ['不先清 wr', 'const b = T[i].bld; T[i].wr = false;', 'const b = T[i].bld;'],
      ['逐棟半徑 2→1', 'hasWaterNear(w, i % w.N, (i / w.N) | 0, 2)', 'hasWaterNear(w, i % w.N, (i / w.N) | 0, 1)'],
      ['容量 < 改成 <=', 'watered < wCap', 'watered <= wCap'],
      ['沒電也給水', 'b.wa = !!(b.pw && hasWaterNear', 'b.wa = !!(hasWaterNear'],
      ['看水管不看接通', 'if (w.tiles[idx(w, nx, ny)].wr) return true;', 'if (w.tiles[idx(w, nx, ny)].wp) return true;'],
    ];
    const missed = [];
    for (const [name, key, from, to] of LAB_MUT) {
      const t2 = { ...T };
      if (t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一`); continue; }
      t2[key] = t2[key].replace(from, to);
      if (!compare(makeLab(t2), makeMine(), true).diffs) missed.push(`實驗線「${name}」`);
    }
    const src = read('src/sim/rules/water.ts');
    const load = s => { const js = stripTypeScriptTypes(s).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''); const ctx = vm.createContext({ ...labHelpers });
      vm.runInContext(js + '\nglobalThis.__m={computeWaterLegacy449,assignWater,hasWaterNear};', ctx); return ctx.__m; };
    const baseOk = !compare(makeLab(T), makeMine(load(src)), true).diffs;
    for (const [name, from, to] of MINE_MUT) {
      if (src.split(from).length !== 2) { missed.push(`本線「${name}」錨點不唯一`); continue; }
      if (!compare(makeLab(T), makeMine(load(src.replace(from, to))), true).diffs) missed.push(`本線「${name}」`);
    }
    log(baseOk && !missed.length, `D019 驗收 2：注入錯誤要紅——實驗線原文 ${LAB_MUT.length} 個、本線原碼 ${MINE_MUT.length} 個（90 步、容量、淡化廠算每一格、不先清 wr、半徑、容量比較、沒電也給水、看水管不看接通）都比出差異（沒改的本線原碼在 vm 裡載入先核過相等）`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }

  // ---- 4. 接線 ----
  {
    const day = read('src/sim/day.ts'), bad = [];
    const cap = day.indexOf('const wCap = Math.floor(computeWaterLegacy449(w));'), pwr = day.indexOf('const powered = assignPower(w, tickBld, cap);'), wa = day.indexOf('assignWater(w, tickBld, wCap);');
    if (cap < 0 || pwr < 0 || wa < 0) bad.push('找不到 wCap／assignPower／assignWater 那幾行');
    else if (!(cap < pwr && pwr < wa)) bad.push('順序不是 容量 → 給電 → 給水');
    if (/b\.wa = false/.test(day)) bad.push('還有 b.wa = false');
    log(!bad.length, 'D019 接線：day.ts 每天算容量（floor(computeWaterLegacy449)，55010），給電之後照建築索引給水（assignWater，55157／55160）；沒有殘留的 b.wa＝false',
      bad.join('；') || '容量 → 給電 → 給水');
  }

  // ---- 5. 歷史：鋪水管、拆水管、復原 ----
  {
    const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
    const newcity = codeWithSeed(read('src/content/samples/newcity.code.txt').trim(), 5162026);
    const L = loadCode(newcity, KT, vrank), s = L.sim, N = s.w.N, bad = [];
    const code0 = saveCode(s, L.template, L.start), f0 = decodeLabCode(code0).save.raw.d3.f;
    // 找一段陸地：一條橫的水管（10 格）、旁邊一座水塔
    let row = -1, col = -1;
    for (let y = 2; y < N - 2 && row < 0; y++) for (let x = 2; x < N - 14 && row < 0; x++) {
      let ok = true; for (let d = -1; d <= 11 && ok; d++) { const t = s.w.tiles[y * N + x + d]; if (t.t === 0 || t.bld || t.road || t.tree) ok = false; }
      if (ok) { row = y; col = x; }
    }
    if (row < 0) bad.push('新城找不到一段 13 格的陸地');
    else {
      const ev = [];
      let now = 0;
      const r1 = commitOp(s, { k: 'line', tool: 'wpipe', x0: col, z0: row, x1: col + 9, z1: row }, now += 10000); ev.push(r1);
      const r2 = commitOp(s, { k: 'tap', tool: 'water', x0: col - 1, z0: row, x1: col - 1, z1: row }, now += 10000); ev.push(r2);
      const r3 = commitOp(s, { k: 'rect', tool: 'doze', x0: col + 9, z0: row, x1: col + 9, z1: row }, now += 10000); ev.push(r3);
      const r4 = commitOp(s, { k: 'line', tool: 'wpipe', x0: col + 9, z0: row, x1: col + 10, z1: row }, now += 10000); ev.push(r4);
      const u = undoOp(s);
      const h = s.city.history, pipes = h.filter(e => e.t === 'pipe').length, dozeWp = h.filter(e => e.t === 'doze' && e.layer === 'wp').length;
      if (r1.placed !== 10 || r1.spent !== 10 * 10 || r1.events.some(e => e.t !== 'pipe')) bad.push(`拉 10 格水管：${r1.placed} 格、$${r1.spent}`);
      if (!r2.ok || r2.spent !== 400 || r2.events[0]?.t !== 'place' || r2.events[0]?.k !== 10) bad.push(`水塔：${J(r2.events[0])}`);
      if (r3.events[0]?.t !== 'doze' || r3.events[0]?.layer !== 'wp') bad.push(`拆水管：${J(r3.events[0])}`);
      if (!u.ok || u.refund !== r4.spent) bad.push(`復原退 ${u.refund}（花了 ${r4.spent}）`);
      const wp = s.w.tiles.map(t => t.wp ? 1 : 0), cwp = [...s.city.wp];
      if (J(wp) !== J(cwp)) bad.push('城市模型的水管圖層 ≠ 模擬的格子');
      const rep = replayCity(L.start, h, KT);
      if (J([...rep.wp]) !== J(cwp)) bad.push('重播的水管圖層 ≠ 模擬');
      for (let d = 0; d < 3; d++) stepDay(s);
      const code = saveCode(s, L.template, L.start), raw = decodeLabCode(code).save.raw, back = loadCode(code, KT, vrank);
      if (raw.d3.f !== 5) bad.push(`有水管事件的存檔格式 ${raw.d3.f}`);
      if (raw.wp !== wp.join('') && raw.wp !== s.w.tiles.map(t => t.wp ? 1 : 0).join('')) bad.push('存檔的 wp 圖層 ≠ 格子');
      if (!back.ok || !back.replayed) bad.push(`讀回：${back.note ?? back.error}`);
      else {
        if (J(back.sim.w.tiles.map(t => t.wp ? 1 : 0)) !== J(s.w.tiles.map(t => t.wp ? 1 : 0))) bad.push('讀回的水管 ≠ 存的');
        const hb = back.sim.city.history.filter(e => e.t !== 'restyle'), ha = s.city.history.filter(e => e.t !== 'restyle');
        if (J(hb) !== J(ha)) bad.push('讀回的歷史 ≠ 存的');
      }
      // 列：pipe [9,…]、拆除圖層碼 4
      const rows = packHistory(h), prow = rows.find(r => r[0] === 9), drow = rows.find(r => r[0] === 6 && r[4] === 4);
      if (!prow || prow.length !== 6 || !drow) bad.push(`緊湊列：pipe ${J(prow)}、拆水管 ${J(drow)}`);
      if (J(unpackHistory(rows, N)) !== J(h)) bad.push('緊湊列解回來 ≠ 歷史');
      // 竄改：水管的座標出界、造價不是數字 → 擋下（整份退回只用存檔）
      for (const [name, f, want] of [['水管座標出界', r => { r[2] = N + 3; }, /座標不對/], ['水管造價是字串', r => { r[4] = 'x'; }, /cost不對/]]) {
        const rr = JSON.parse(J(rows)); f(rr.find(r => r[0] === 9));
        let msg = ''; try { unpackHistory(rr, N); msg = '竟然讀得進去'; } catch (e) { msg = e.message; }
        if (!want.test(msg)) bad.push(`${name}：${msg}`);
      }
      log(!bad.length && f0 === 4 && CITY_FORMAT === 7,   // 現行格式 D034 起是 7（合併事件；D026 起 6 是災禍事件）；只有水管事件的存檔仍寫 5、都沒有寫 4
        'D019 驗收 5：歷史——新城拉 10 格水管（$10／格）、放水塔（$400）、拆一格水管、再拉、復原：事件是 pipe／place／doze wp／undo，城市模型與重播的水管圖層＝模擬；存檔（格式 5、wp 圖層）讀回逐格、逐筆相同；緊湊列 [9,…] 與拆除圖層碼 4 解得回來、竄改擋下；沒有水管事件的存檔照寫格式 4',
        bad.join('；') || `水管事件 ${pipes} 筆、拆水管 ${dozeWp} 筆；沒水管時格式 ${f0}、有水管 5`);
    }
    if (row < 0) log(false, 'D019 驗收 5：歷史', bad.join('；'));
  }

  // ---- 6. 讀進來的城：wp 圖層進到模擬；有水的城推進一天真的有水 ----
  {
    const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank, bad = [], notes = [];
    for (const id of ['seed516', 'ai120']) {
      const code = read(`src/content/samples/${id}.code.txt`).trim(), raw = decodeLabCode(code).save.raw, L = loadCode(code, KT, vrank), s = L.sim;
      const want = (raw.wp ?? '').split('').filter(c => c === '1').length, got = s.w.tiles.filter(t => t.wp).length;
      if (want !== got) bad.push(`${id}：存檔 ${want} 格水管、模擬 ${got} 格`);
      const towers = s.w.tiles.filter(t => t.bld && !t.bld.ref && t.bld.k === 10).length;
      stepDay(s);
      const rci = s.w.tiles.filter(t => t.bld && !t.bld.ref && t.bld.k >= 1 && t.bld.k <= 3), wa = rci.filter(t => t.bld.wa).length;
      notes.push(`${id} 水管 ${got} 格、水塔 ${towers} 座、推進一天住商工有水 ${wa}／${rci.length}`);
      if (towers && got && !wa) bad.push(`${id}：有水塔、有水管，推進一天卻沒有一棟有水`);
    }
    log(!bad.length, 'D019 驗收 4（Node 半邊）：讀進來的城——存檔的 wp 圖層進到模擬的格子（D019 以前讀檔丟掉了）；有水塔、水管的城推進一天，接得到水的住商工有水（棟數跟實驗線逐棟比在實驗線頁面實跑那一項）',
      bad.join('；') || notes.join('；'));
  }
}

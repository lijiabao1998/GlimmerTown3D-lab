// D027 Node 守衛：通勤與壅堵——通勤叢集、道路負載、動態地價、壅堵統計（驗收 1、2 的公式半邊，含突變）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d027-commute.json（tools/lab-commute.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；常數跟本線相同；
//      本線 happy.ts 的 HAPPY_NAMES（幸福 57 項的名稱與順序）＝實驗線 happyParts 的名稱與順序；
//   2. 逐項＝實驗線：實驗線原文（computeCommuteLegacyT141、roadCap475、congestNear、landCongestAt、recomputeLandDynamic、tick 54991–54995、logisticsEfficiency481 的統計半邊）在 vm 裡，
//      跟本線 src/sim/rules/commute.ts 與 fields.ts recomputeLandDynamic 吃同一批隨機小圖、連跑 12 天（跨三次重算；中途施工：拆路、鋪路、蓋建築、拆建築，快取不更新）：
//      每天 commutePenalty 整張（32 位元逐位）、叢集路徑（逐條逐格）、roadLoad（32 位元逐位）、roadPass（歸零）、每格 jam、LAND 整張、roadStats 的平均與過載比例，逐項相等；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一批（每個常數、每個比較符號、掃描與回溯的順序、600 步上限、T468 公式、容量倍率、地價扣分……），沒改的先核過全等。
//   接線、存檔、實驗線頁面實跑：見 tools/unit-d027-live.mjs。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as CM from '../src/sim/rules/commute.ts';
import * as FLD from '../src/sim/rules/fields.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const PIECES = ['clamp', 'ROAD_CAP', 'COMMUTE_PERIOD', 'COMMUTE_CELL', 'COMMUTE_FAR', 'COMMUTE_PEN_STEP', 'COMMUTE_PEN_MAX', 'COMMUTE_PEN_UNREACH', 'COMMUTE_TRIP_W', 'DIRV',
  'logisticsEfficiency481', 'roadCap475', 'congestNear', 'landCongestAt', 'recomputeLandDynamic', 'computeCommuteLegacyT141', 'computeCommute', 'tick', 'jam', 'happyTerms', 'commuteTerm', 'happyParts'];
const KEY = { tick: 'tick 通勤與道路負載', jam: '住宅幸福 jam', happyTerms: '住宅幸福 交通壅堵與通勤', commuteTerm: '財富判斷 通勤項', happyParts: '住宅幸福 happyParts' };   // 樣本 pieces 的名字 → text 的鍵

export async function d027Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D027 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 實驗線那一邊：原文在 vm 裡（strict）。回退設定關 T491（__noMobility491），computeCommute 只有舊式那一支 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';
let N=1,tiles=[],day=1,ACCESS468=null,commutePenalty=null,commuteUnreach=null,commuteClusters=[],roadLoad=null,roadPass=null,commuteLoad=null,commutePass=null,LAND=null,LANDBASE=null,tickBld=[];
const window={__noMobility491:true},mobility491={ready:false},OPPORTUNITY_ACCESS491={job:[]};
const idx=(x,y)=>y*N+x,inMap=(x,y)=>x>=0&&y>=0&&x<N&&y<N,T=i=>tiles[i];
${T.clamp}
${T.ROAD_CAP}
${T.COMMUTE_PERIOD}
${T.COMMUTE_CELL}
${T.COMMUTE_FAR}
${T.COMMUTE_PEN_STEP}
${T.COMMUTE_PEN_MAX}
${T.COMMUTE_PEN_UNREACH}
${T.COMMUTE_TRIP_W}
${T.DIRV}
${T.roadCap475}
${T.congestNear}
${T.landCongestAt}
${T.recomputeLandDynamic}
${T.computeCommuteLegacyT141}
${T.computeCommute}
${T.logisticsEfficiency481}
function __tick(){
${T.tick}
}
globalThis.__api={
  init:(n,ts,access,load0)=>{N=n;tiles=ts;ACCESS468=access;const nn=n*n;commutePenalty=new Float32Array(nn);commuteUnreach=new Uint8Array(nn);commuteClusters=[];roadLoad=new Float32Array(nn);roadPass=new Uint16Array(nn);commuteLoad=new Float32Array(nn);commutePass=new Uint16Array(nn);LAND=new Uint8Array(nn);LANDBASE=new Uint8Array(nn);roadLoad.set(load0);},
  day:(d,landbase)=>{day=d;LANDBASE.set(landbase);__tick();recomputeLandDynamic();
    const roads=[];for(let i=0;i<N*N;i++)if(tiles[i].road)roads.push(i);const st=logisticsEfficiency481(roads,0,0,0,0,1);
    return {pen:Array.from(commutePenalty),clusters:commuteClusters.map(c=>c.path),load:Array.from(roadLoad),pass:Array.from(roadPass),jam:Array.from({length:N*N},(_,i)=>congestNear(i%N,(i/N)|0,2)),land:Array.from(LAND),stats:[st.avgRoadLoad,st.overloadedShare],unreach:Array.from(commuteUnreach)};},
  staticEval:(load,landbase)=>{roadLoad.set(load);LANDBASE.set(landbase);recomputeLandDynamic();
    const roads=[];for(let i=0;i<N*N;i++)if(tiles[i].road)roads.push(i);const st=logisticsEfficiency481(roads,0,0,0,0,1);
    return {jam:Array.from({length:N*N},(_,i)=>congestNear(i%N,(i/N)|0,2)),land:Array.from(LAND),stats:[st.avgRoadLoad,st.overloadedShare]};},
  tiles:()=>tiles,
};`, ctx, { filename: 'lab:commute' });
  return ctx.__api;
}

// ---- 本線那一邊（commute.ts、fields.ts recomputeLandDynamic；突變時傳改壞的一份）----
// useIdx：照 stepDay 的做法把「有建築的格」索引（tickBld，含 ref 格、升序）交給通勤重算（只掃建築格）；false＝不給、整圖掃（兩支都要跟實驗線逐位相同）
function makeMine(M, F, useIdx = true) {
  let w, g, clusters = [], N = 1;
  return {
    init(n, ts, access, load0) {
      N = n; w = { N, tiles: ts }; g = FLD.allocGrids(N); g.ACCESS468.set(access); g.roadLoad.set(load0); clusters = [];
    },
    day(d, landbase) {
      g.LANDBASE.set(landbase);
      let idx; if (useIdx) { idx = []; for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i].bld) idx.push(i); }
      clusters = M.trafficStep(d, w, g, clusters, idx);
      M.jamCounts(w, g.roadLoad, g.jam);
      F.recomputeLandDynamic(g);
      const roads = []; for (let i = 0; i < N * N; i++) if (w.tiles[i].road) roads.push(i);
      const st = M.roadStatsOf(w, roads, g.roadLoad);
      return { pen: Array.from(g.commutePenalty), clusters, load: Array.from(g.roadLoad), pass: Array.from(g.roadPass), jam: Array.from(g.jam), land: Array.from(g.LAND), stats: [+st.avg.toFixed(4), +st.over.toFixed(4)] };
    },
    staticEval(load, landbase) {
      g.roadLoad.set(load); g.LANDBASE.set(landbase);
      M.jamCounts(w, g.roadLoad, g.jam);
      F.recomputeLandDynamic(g);
      const roads = []; for (let i = 0; i < N * N; i++) if (w.tiles[i].road) roads.push(i);
      const st = M.roadStatsOf(w, roads, g.roadLoad);
      return { jam: Array.from(g.jam), land: Array.from(g.LAND), stats: [+st.avg.toFixed(4), +st.over.toFixed(4)] };
    },
    tiles: () => w.tiles,
  };
}

// ---- 隨機輸入 ----
const FAMS = ['grid', 'grid', 'tree', 'islands', 'sparse', 'grid', 'hubs', 'serp', 'grid', 'tree'];
function cases27(count = 320) {
  const R = mulberry32(20261301), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)], out = [];
  for (let m = 0; m < count; m++) {
    const fam = FAMS[m % FAMS.length], big = fam === 'serp';
    const N = big ? int(40, 44) : int(8, 18), tiles = Array.from({ length: N * N }, () => ({ t: 2, bld: null })), at = (x, y) => tiles[y * N + x], inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
    const road = (x, y, rc) => { if (!inb(x, y)) return; const t = at(x, y); if (t.bld) return; t.road = 1; if (ch(.05)) { if (ch(.5)) t.rc = 0; } else t.rc = rc;   // 有的路沒有等級（或 0）：實驗線當 2 級
      if (ch(.06)) t.bridge = 1; if (ch(.08)) t.fly475 = 1; if (ch(.06)) t.ix475 = 1; };
    // 道路：每個家族一種長法；等級照一段路一個等級、偶爾跳級（1–5）
    if (fam === 'grid' || fam === 'islands' || fam === 'hubs') {
      const sp = int(3, 6), rcH = pick([1, 2, 2, 3, 4, 5]), rcV = pick([1, 2, 3, 3, 5]);
      for (let y = int(0, 2); y < N; y += sp) for (let x = 0; x < N; x++) { if (fam === 'islands' && x >= (N >> 1) - 1 && x <= (N >> 1)) continue; road(x, y, ch(.15) ? int(1, 5) : rcH); }
      for (let x = int(0, 2); x < N; x += sp) for (let y = 0; y < N; y++) { if (fam === 'islands' && y >= (N >> 1) - 1 && y <= (N >> 1)) continue; road(x, y, ch(.15) ? int(1, 5) : rcV); }
    } else if (fam === 'tree') {
      let x = int(0, N - 1), y = int(0, N - 1); const rc = pick([1, 2, 3]);
      for (let s = 0; s < N * N * .45; s++) { road(x, y, ch(.1) ? int(1, 5) : rc); const d = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]); x = Math.max(0, Math.min(N - 1, x + d[0])); y = Math.max(0, Math.min(N - 1, y + d[1])); if (ch(.03)) { x = int(0, N - 1); y = int(0, N - 1); } }
    } else if (fam === 'sparse') {
      for (let k = 0; k < int(1, 3); k++) { const y = int(0, N - 1); for (let x = 0; x < N; x++) road(x, y, pick([1, 2, 3])); }
    } else {   // serp：一條蛇行的長路（隔一列一條橫路、用直路連起來），路徑能超過 600 步
      for (let y = 0; y < N; y += 2) for (let x = 0; x < N; x++) road(x, y, 2);
      for (let y = 0; y + 2 < N; y += 2) road((y / 2) % 2 ? 0 : N - 1, y + 1, 2);
    }
    // 建築：住宅類（1、127、33 是 2×2、105 是 3×3）、就業區（2、3；有的圖沒有）、其他
    const put = (k, sz, near) => {
      for (let a = 0; a < 60; a++) {
        const x = int(0, N - sz), y = int(0, N - sz); let free = true;
        for (let dy = 0; dy < sz && free; dy++) for (let dx = 0; dx < sz; dx++) { const t = at(x + dx, y + dy); if (t.bld || t.road) { free = false; break; } }
        if (!free) continue;
        if (near) { let adj = false; for (let dy = -1; dy <= sz && !adj; dy++) for (let dx = -1; dx <= sz; dx++) { if ((dx >= 0 && dx < sz && dy >= 0 && dy < sz) || !inb(x + dx, y + dy)) continue; if (at(x + dx, y + dy).road) { adj = true; break; } } if (!adj) continue; }
        at(x, y).bld = { k, lv: int(1, 3), v: 0, age: int(0, 40), pw: true, h: .6, ...(sz > 1 ? { sz } : {}) };
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (dx || dy) at(x + dx, y + dy).bld = { k, ref: [x, y] };
        return true;
      }
      return false;
    };
    const houses = big ? int(6, 14) : int(3, Math.max(4, Math.floor(N * N / 7))), jobs = fam === 'sparse' && ch(.3) ? 0 : big ? int(1, 2) : int(0, 7);
    for (let q = 0; q < houses; q++) { const r = R(); const k = r < .7 ? 1 : r < .8 ? 127 : r < .9 ? 33 : 105; put(k, k === 33 ? 2 : k === 105 ? 3 : 1, ch(.75)); }
    for (let q = 0; q < jobs; q++) put(pick([2, 3, 3, 2, 2]), 1, ch(.85));
    for (let q = 0; q < int(0, 6); q++) put(pick([4, 5, 7, 12, 13, 16]), 1, false);
    if (big) { // 蛇行路的兩端各放住宅與就業區，路徑長度要在 600 上下
      for (let x = 0; x < N; x++) { const t = at(x, 1); if (!t.road && !t.bld) { t.bld = { k: 1, lv: 1, v: 0, age: 1, pw: true, h: .6 }; break; } }
      for (let x = N - 1; x >= 0; x--) { const t = at(x, N - 1 - (N % 2)); if (t && !t.road && !t.bld) { t.bld = { k: 3, lv: 1, v: 0, age: 1, pw: true, h: .6 }; break; } }
    }
    const nn = N * N, access = new Uint8Array(nn);
    if (ch(.3)) for (let i = 0; i < nn; i++) if (ch(.5)) access[i] = pick([1, 20, 79, 80, 120, 200, 255]);
    const load0 = new Float32Array(nn);
    if (ch(.4)) for (let i = 0; i < nn; i++) if (tiles[i].road && ch(.08)) load0[i] = Math.fround(R() * 2.6 * (CM.roadCap475(tiles[i]) || 1));   // 起始負載：實驗線的 recomputeLandDynamic 對每個過載格要算 25 個鄰格 × 25 次容量，過載格多了 vm 會慢，所以只給少數格
    const day0 = int(0, 400), landbase = Uint8Array.from({ length: nn }, () => int(0, 255)), steps = [], edits = [];
    for (let s = 0; s < 12; s++) {
      const ed = [];
      if (s >= 2 && ch(.3)) for (let e = 0; e < int(1, 3); e++) ed.push(pick(['unroad', 'road', 'road', 'house', 'job', 'demolish']) + ':' + int(0, nn - 1) + ':' + int(1, 5) + ':' + pick([1, 1, 127, 2, 3]));
      edits.push(ed);
      steps.push({ day: day0 + s + 1, landbase: ch(.2) ? Uint8Array.from({ length: nn }, () => int(0, 255)) : landbase });
    }
    // 靜態負載（推完 12 天之後直接設進去、不經過每天的更新）：剛好等於容量、差一個 32 位元、兩倍、隨機，非道路格也塞值——量「> 還是 ≥」這種只有剛好相等才分得出來的地方
    const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer), up = x => { f32[0] = x; u32[0]++; return f32[0]; }, down = x => { f32[0] = x; u32[0]--; return f32[0]; };
    const staticLoads = [0, 1].map(v => Float32Array.from({ length: nn }, (_, i) => {
      const t = tiles[i], cap = CM.roadCap475(t) || 1;
      if (!t.road) return ch(.2) ? 5 : 0;
      if (v === 1) return ch(.5) ? Math.fround(cap) : 0;
      const r = R(); return r < .15 ? 0 : r < .35 ? Math.fround(cap) : r < .5 ? up(Math.fround(cap)) : r < .65 ? down(Math.fround(cap)) : r < .8 ? Math.fround(2 * cap) : Math.fround(R() * 3 * cap);
    }));
    out.push({ fam, N, tiles, access, load0, steps, edits, staticLoads });
  }
  return out;
}
const cloneTiles = tiles => tiles.map(t => ({ ...t, bld: t.bld ? { ...t.bld, ...(t.bld.ref ? { ref: [...t.bld.ref] } : {}) } : null }));
// 中途施工：兩邊的格子用同一個編輯（路、拆路、蓋住宅或就業區、拆建築）；叢集快取不更新（實驗線一樣每 4 天才重算）
function applyEdits(tiles, N, eds) {
  for (const e of eds) {
    const [op, is, rcs, ks] = e.split(':'), i = +is, t = tiles[i], k = +ks, rc = +rcs;
    if (op === 'unroad') { if (t.road) { delete t.road; delete t.rc; delete t.bridge; delete t.fly475; delete t.ix475; } }
    else if (op === 'road') { if (!t.bld) { t.road = 1; t.rc = rc; } }
    else if (op === 'house' || op === 'job') { if (!t.bld && !t.road) t.bld = { k: op === 'house' ? (k === 2 || k === 3 ? 1 : k === 127 ? 127 : 1) : (k === 3 ? 3 : 2), lv: 1, v: 0, age: 1, pw: true, h: .6 }; }
    else if (op === 'demolish') { if (t.bld && !t.bld.ref && !t.bld.sz) t.bld = null; }
  }
}
const asJ = r => J(r);

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d027-commute.json')), T = S.text;

  // ---- 1. 出處、常數、幸福項名稱 ----
  {
    const bad = [], names = (S.pieces ?? []).map(p => p.name), want = PIECES.map(n => KEY[n] ?? n);
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    if (J(names) !== J(want)) bad.push(`段落 ${names.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[Object.keys(KEY).find(k => KEY[k] === p.name) ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    const lab = vm.runInNewContext(`${T.ROAD_CAP}\n${T.COMMUTE_PERIOD}\n${T.COMMUTE_CELL}\n${T.COMMUTE_FAR}\n${T.COMMUTE_PEN_STEP}\n${T.COMMUTE_PEN_MAX}\n${T.COMMUTE_PEN_UNREACH}\n${T.COMMUTE_TRIP_W}\n${T.DIRV}\n[ROAD_CAP,COMMUTE_PERIOD,COMMUTE_CELL,COMMUTE_FAR,COMMUTE_PEN_STEP,COMMUTE_PEN_MAX,COMMUTE_PEN_UNREACH,COMMUTE_TRIP_W,DIRV]`);
    const mine = [CM.ROAD_CAP, CM.COMMUTE_PERIOD, CM.COMMUTE_CELL, CM.COMMUTE_FAR, CM.COMMUTE_PEN_STEP, CM.COMMUTE_PEN_MAX, CM.COMMUTE_PEN_UNREACH, CM.COMMUTE_TRIP_W, CM.DIRV];
    if (J(lab) !== J(mine)) bad.push(`常數：實驗線 ${J(lab)}≠本線 ${J(mine)}`);
    const labNames = [...T.happyParts.matchAll(/name:'([^']+)'/g)].map(m => m[1]);
    if (J(labNames) !== J(HAPPY_NAMES)) bad.push(`幸福項名稱與順序：實驗線 ${labNames.length} 項≠本線 ${HAPPY_NAMES.length} 項${labNames.findIndex((n, i) => n !== HAPPY_NAMES[i]) >= 0 ? `，第 ${labNames.findIndex((n, i) => n !== HAPPY_NAMES[i])} 項不同` : ''}`);
    log(!bad.length, `D027 通勤與壅堵原文：實驗線 ${PINNED.slice(0, 7)} 的 ${PIECES.length} 段（常數 37431–37441、DIRV 56955、roadCap475 50948、congestNear 52946、landCongestAt 與 recomputeLandDynamic 53096–53120、computeCommuteLegacyT141 57733–57791、computeCommute 64255、tick 54991–54995、logisticsEfficiency481 38269、幸福 jam 與兩項與 happyParts 55175–55234、財富判斷通勤項 53209）逐段 sha256＝錨點記錄；常數與 DIRV 跟本線相同；本線 HAPPY_NAMES（${HAPPY_NAMES.length} 項）的名稱與順序＝實驗線 happyParts`,
      bad.join('；') || `${S.pieces.length} 段；道路容量 ${J(CM.ROAD_CAP)}、每 ${CM.COMMUTE_PERIOD} 天重算、叢集 ${CM.COMMUTE_CELL}×${CM.COMMUTE_CELL}、路距門檻 ${CM.COMMUTE_FAR}、每格 ${CM.COMMUTE_PEN_STEP}、封頂 ${CM.COMMUTE_PEN_MAX}、不可達 ${CM.COMMUTE_PEN_UNREACH}`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const C = cases27();
  const runCase = (c, lab, mine, days = c.steps.length) => {
    const A = cloneTiles(c.tiles), B = cloneTiles(c.tiles), recs = [];
    lab.init(c.N, A, c.access, c.load0); mine.init(c.N, B, c.access, c.load0);
    for (let s = 0; s < days; s++) {
      applyEdits(A, c.N, c.edits[s]); applyEdits(B, c.N, c.edits[s]);
      const d = c.steps[s], a = lab.day(d.day, d.landbase), b = mine.day(d.day, d.landbase);
      recs.push({ a, b, s });
    }
    const lb = c.steps.at(-1).landbase;
    if (days === c.steps.length) for (const L of c.staticLoads) recs.push({ st: true, a: lab.staticEval(L, lb), b: mine.staticEval(L, lb), s: c.steps.length });
    return recs;
  };
  // opt（突變才給）：fam＝只跑這個家族的圖、days＝只推前幾天（回溯 600 步的上限只有蛇行長路才碰得到、第一次重算就看得出來，不必把 320 張圖每張推滿 12 天才發現）
  const compare = (lab, mine, stopAtFirst = false, opt = {}) => {
    const st = { steps: 0, diffs: 0, first: '', cnt: {} };
    const bump = (k, v = 1) => { if (v) st.cnt[k] = (st.cnt[k] ?? 0) + v; };
    for (let m = 0; m < C.length; m++) {
      const c = C[m];
      if (opt.fam && c.fam !== opt.fam) continue;
      for (const q of runCase(c, lab, mine, opt.days)) {
        st.steps++;
        const { a, b } = q, keys = q.st ? ['jam', 'land', 'stats'] : ['pen', 'clusters', 'load', 'pass', 'jam', 'land', 'stats'], bad = keys.filter(k => asJ(a[k]) !== asJ(b[k]));
        if (bad.length) {
          st.diffs++;
          if (!st.first) {
            const k = bad[0], x = a[k], y = b[k], at = Array.isArray(x) ? x.findIndex((v, i) => J(v) !== J(y[i])) : -1;
            st.first = `第 ${m} 張（${c.fam}，N=${c.N}）${q.st ? '靜態負載' : `第 ${q.s + 1} 天`}：${bad.join('、')} 不同${at >= 0 ? `（${k}[${at}] 實驗線 ${String(J(x[at])).slice(0, 60)}≠本線 ${String(J(y[at])).slice(0, 60)}）` : `（實驗線 ${String(J(x)).slice(0, 80)}≠本線 ${String(J(y)).slice(0, 80)}）`}`;
          }
          if (stopAtFirst) return st;
        }
        if (q.st) { bump('static'); bump('staticEq', c.staticLoads.length ? 1 : 0); continue; }
        // 覆蓋計數：只看實驗線那邊的結果（不靠本線）
        const tl = c.tiles;
        bump('clusters', a.clusters.length); bump('refresh', (c.steps[q.s].day % 4 === 0) ? 1 : 0);
        bump('unreach', a.unreach.filter(Boolean).length > 0 ? 1 : 0);
        bump('farPen', a.pen.some(v => v > 0 && v < .29 && Math.abs(v - Math.fround(.18)) > 1e-9) ? 1 : 0);
        bump('farCap', a.pen.some(v => Math.abs(v - Math.fround(.18)) < 1e-9) ? 1 : 0);
        bump('path600', a.clusters.some(p => p.length === 600) ? 1 : 0);
        bump('jamSteps', a.jam.some(v => v > 0) ? 1 : 0); bump('jamCells', a.jam.filter(v => v > 0).length);
        bump('landCut', a.land.some((v, i) => v !== c.steps[q.s].landbase[i]) ? 1 : 0);
        bump('landFloor', a.land.some((v, i) => v === 0 && c.steps[q.s].landbase[i] > 0) ? 1 : 0);
        bump('loadZero', a.load.every(v => v === 0) ? 1 : 0);
        bump('stats', a.stats[1] > 0 ? 1 : 0);
        if (q.s === 0) {
          for (const kk of [33, 105, 127]) if (tl.some(t => t.bld && t.bld.k === kk && !t.bld.ref)) bump('kind' + kk);
          bump('noJobs', tl.some(t => t.bld && (t.bld.k === 2 || t.bld.k === 3)) ? 0 : 1);
          bump('access80', c.access.some(v => v >= 80) ? 1 : 0); bump('accessLow', c.access.some(v => v > 0 && v < 80) ? 1 : 0);
          for (let cl = 1; cl <= 5; cl++) if (tl.some((t, i) => t.road && t.rc === cl && c.load0[i] > (CM.roadCap475(t) || 1))) bump('jamClass' + cl);
          if (tl.some((t, i) => t.road && (t.fly475 || t.ix475) && c.load0[i] > (CM.ROAD_CAP[(t.rc || 2) - 1] || 1) && c.load0[i] <= CM.roadCap475(t))) bump('capMul');
        }
        // 代表不可達但同一塊別的住宅走得到（整塊沒有路徑）：用實驗線的不可達旗標與當下的格子另算一次，不靠本線
        if (c.steps[q.s].day % 4 === 0) {
          const N = c.N, per = Math.ceil(N / 6), lt = lab.tiles(), first = new Map(), other = new Map();
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const bb = lt[y * N + x].bld; if (!bb || bb.ref || ![1, 127, 33, 105].includes(bb.k)) continue;
            const key = ((x / 6) | 0) * per + ((y / 6) | 0), i = y * N + x;
            if (!first.has(key)) first.set(key, i); else if (!a.unreach[i]) other.set(key, true);
          }
          for (const [key, i] of first) if (a.unreach[i] && other.get(key)) bump('repUnreach');
        }
      }
    }
    return st;
  };
  const NEED = { static: 500, clusters: 2000, refresh: 400, unreach: 300, repUnreach: 20, farPen: 150, farCap: 20, path600: 5, jamSteps: 500, jamCells: 2000, landCut: 800, landFloor: 30, loadZero: 100, stats: 800, kind33: 30, kind105: 30, kind127: 30, noJobs: 15, access80: 20, accessLow: 20, jamClass1: 15, jamClass2: 15, jamClass3: 15, jamClass4: 10, jamClass5: 8, capMul: 5 };
  const base = compare(makeLab(T), makeMine(CM, FLD));
  const scanOnly = compare(makeLab(T), makeMine(CM, FLD, false), true);   // 不給建築索引（整圖掃）那一支：工具與守衛用，跟實驗線也要逐位相同
  const lacking = Object.entries(NEED).filter(([k, v]) => (base.cnt[k] ?? 0) < v).map(([k, v]) => `${k} ${(base.cnt[k] ?? 0)}<${v}`);
  log(base.diffs === 0 && scanOnly.diffs === 0 && !lacking.length,
    `D027 驗收 2：通勤與壅堵逐項＝實驗線——實驗線原文在 vm 裡跟本線 commute.ts、fields.ts 吃 ${C.length} 張隨機小圖、每張連 12 天共 ${base.steps} 步（本線照 stepDay 給建築格索引；不給索引的整圖掃描另跑一遍；道路五級與橋與高架與立交、住宅類四種、就業區有沒有、蛇行長路、T468 可達性、起始負載隨機；中途拆路鋪路蓋房子、快取不更新）：`
      + `每天 commutePenalty 整張（32 位元逐位）、叢集路徑逐條逐格、roadLoad（32 位元逐位）、roadPass 歸零、每格 jam、LAND 整張、roadStats 的平均與過載比例逐項相等`,
    base.first || (scanOnly.diffs ? `整圖掃描那一支：${scanOnly.first}` : '') || (lacking.length ? `覆蓋不夠：${lacking.join('、')}｜${J(base.cnt)}` : `${base.steps} 步全等（建築索引那一支＝stepDay 用的；整圖掃描那一支另跑一遍也全等）；` + Object.keys(NEED).map(k => `${k} ${base.cnt[k]}`).join('、')));

  if (process.env.D027_BASE_ONLY) return;
  // ---- 3. 注入錯誤要紅 ----
  {
    const missed = [];
    for (const [name, key, from, to, opt] of LAB_MUTANTS) {
      const t2 = { ...T };
      if (typeof t2[key] !== 'string' || t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一（${t2[key] === undefined ? '沒有這段' : t2[key].split(from).length - 1}）`); continue; }
      t2[key] = t2[key].replace(from, to);
      let d; try { d = compare(makeLab(t2), makeMine(CM, FLD), true, opt).diffs; } catch (e) { missed.push(`實驗線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`實驗線「${name}」`);
    }
    for (const [name, file, from, to, opt] of MINE_MUTANTS) {
      let M = CM, F = FLD;
      try {
        if (file === 'commute') M = await loadMod('src/sim/rules/commute.ts', [[from, to]]);
        else { const cm = await loadMod('src/sim/rules/commute.ts', []); F = await loadMod('src/sim/rules/fields.ts', [[from, to]], { './commute.ts': cm }); }
      } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = compare(makeLab(T), makeMine(M, F), true, opt).diffs; } catch (e) { missed.push(`本線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      if (!d) missed.push(`本線「${name}」`);
    }
    const cm0 = await loadMod('src/sim/rules/commute.ts', []), fl0 = await loadMod('src/sim/rules/fields.ts', [], { './commute.ts': cm0 });
    const baseOk = !compare(makeLab(T), makeMine(cm0, fl0), true).diffs;
    log(baseOk && !missed.length, `D027 驗收 2（突變）：注入錯誤要紅——實驗線原文 ${LAB_MUTANTS.length} 個、本線原碼 ${MINE_MUTANTS.length} 個（每個常數、每個比較符號、掃描與回溯的順序、600 步上限、T468 公式、容量倍率、地價扣分、負載衰減……）；沒改的先核過全等`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }
}

// ---- 突變表：[名字, 段落鍵, 原文, 改成]（實驗線）／[名字, 檔案, 原文, 改成]（本線）。原文要在那一段裡剛好出現一次 ----
const SERP = { fam: 'serp', days: 4 };   // 回溯 600 步的上限：只有蛇行長路（serp 家族）的路徑夠長，第一次重算（前 4 天內一定有一次）就看得出來
const LAB_MUTANTS = [
  ['道路容量表 16→17', 'ROAD_CAP', '[1,2,4,8,16]', '[1,2,4,8,17]'], ['道路容量表 1→2', 'ROAD_CAP', '[1,2,4,8,16]', '[2,2,4,8,16]'],
  ['重算週期 4→5', 'COMMUTE_PERIOD', '=4;', '=5;'], ['叢集分塊 6→7', 'COMMUTE_CELL', '=6;', '=7;'], ['路距門檻 20→21', 'COMMUTE_FAR', '=20;', '=21;'],
  ['每格懲罰 .012→.013', 'COMMUTE_PEN_STEP', '=.012;', '=.013;'], ['過長封頂 .18→.19', 'COMMUTE_PEN_MAX', '=.18;', '=.19;'], ['不可達 .30→.31', 'COMMUTE_PEN_UNREACH', '=.30;', '=.31;'],
  ['每叢集車流 1→2', 'COMMUTE_TRIP_W', '=1;', '=2;'], ['鄰格順序 上右→右上', 'DIRV', '[[0,-1],[1,0]', '[[1,0],[0,-1]'], ['鄰格順序 下左→左下', 'DIRV', '[0,1],[-1,0]]', '[-1,0],[0,1]]'],
  ['高架容量 1.28→1.29', 'roadCap475', '1.28', '1.29'], ['立交容量 1.55→1.56', 'roadCap475', '1.55', '1.56'], ['容量取兩位小數→三位', 'roadCap475', 'Math.round(base*m*100)/100', 'Math.round(base*m*1000)/1000'],
  ['容量下限 1→2', 'roadCap475', 'Math.max(1,Math.round', 'Math.max(2,Math.round'], ['沒有等級當 2→3', 'roadCap475', '(t.rc||2)-1', '(t.rc||3)-1'], ['等級上限 4→3', 'roadCap475', 'Math.min(4,', 'Math.min(3,'],
  ['過載 > 改 ≥', 'congestNear', 'roadLoad[j]>roadCap475(tt)', 'roadLoad[j]>=roadCap475(tt)'], ['過載不看是不是道路', 'congestNear', 'if(tt.road&&roadLoad[j]>roadCap475(tt))n++;', 'if(roadLoad[j]>roadCap475(tt))n++;'],
  ['鄰域下界少一格', 'congestNear', 'for(let dx=-r;dx<=r;dx++)', 'for(let dx=-r+1;dx<=r;dx++)'], ['鄰域上界少一格', 'congestNear', 'for(let dy=-r;dy<=r;dy++)', 'for(let dy=-r;dy<r;dy++)'],
  ['地價扣分每格 12→13', 'landCongestAt', '*12', '*13'], ['地價扣分上限 50→51', 'landCongestAt', 'Math.min(50,', 'Math.min(51,'], ['壅堵半徑 2→3', 'landCongestAt', 'congestNear(x,y,2)', 'congestNear(x,y,3)'],
  // 「地價過載 > 改 ≥」（recomputeLandDynamic 的 jam.push）是等價突變：那一串只決定「哪些格子要重算」，重算的值仍由 landCongestAt（congestNear 的 >）決定，多重算幾格的扣分是 0＝LANDBASE，跟不重算一樣，所以不放
  ['地價鄰域少一列', 'recomputeLandDynamic', 'for(let dy=-2;dy<=2;dy++)', 'for(let dy=-2;dy<=1;dy++)'],
  ['地價扣兩倍', 'recomputeLandDynamic', 'LANDBASE[i]-landCongestAt(x,y)', 'LANDBASE[i]-landCongestAt(x,y)*2'],
  ['就業區只算商業', 'computeCommuteLegacyT141', '(b.k===2||b.k===3)', '(b.k===2)'], ['就業區只算工業', 'computeCommuteLegacyT141', '(b.k===2||b.k===3)', '(b.k===3)'],
  ['BFS 只走 40 步（長路的路距變成不可達）', 'computeCommuteLegacyT141', 'dist[j]>d+1', 'dist[j]>d+1&&d<40'], ['入口取距離最小 < 改 ≤', 'computeCommuteLegacyT141', 'dist[j]<bd', 'dist[j]<=bd'],
['超額少扣門檻', 'computeCommuteLegacyT141', '(bd-COMMUTE_FAR)*COMMUTE_PEN_STEP', 'bd*COMMUTE_PEN_STEP'],
  ['封頂 min→max', 'computeCommuteLegacyT141', 'Math.min(COMMUTE_PEN_MAX,', 'Math.max(COMMUTE_PEN_MAX,'], ['回溯上限 600→599', 'computeCommuteLegacyT141', 'steps<600', 'steps<599', SERP], ['回溯上限 600→601', 'computeCommuteLegacyT141', 'steps<600', 'steps<601', SERP],
  ['每塊每棟都當代表', 'computeCommuteLegacyT141', 'if(blkSeen[blk])continue;\n    blkSeen[blk]=1;', 'blkSeen[blk]=1;'], ['分塊鍵 y 換成 x', 'computeCommuteLegacyT141', '((x/COMMUTE_CELL)|0)*blkPerRow+((y/COMMUTE_CELL)|0)', '((x/COMMUTE_CELL)|0)*blkPerRow+((x/COMMUTE_CELL)|0)'],
['住宅類不含巨廈（掃住宅）', 'computeCommuteLegacyT141', 'if(!b||b.ref||![1,127,33,105].includes(b.k))continue;\n    let bd=9999', 'if(!b||b.ref||![1,127,33].includes(b.k))continue;\n    let bd=9999'],
  ['住宅類不含社宅（T468）', 'computeCommuteLegacyT141', 'if(!b||b.ref||![1,127,33,105].includes(b.k))continue;\n    const a=ACCESS468', 'if(!b||b.ref||![1,33,105].includes(b.k))continue;\n    const a=ACCESS468'],
  ['T468 折扣下限 .35→.36', 'computeCommuteLegacyT141', 'clamp(1-a/220,.35,.88)', 'clamp(1-a/220,.36,.88)'], ['T468 折扣上限 .88→.87', 'computeCommuteLegacyT141', 'clamp(1-a/220,.35,.88)', 'clamp(1-a/220,.35,.87)'],
  ['T468 解除門檻 80→81', 'computeCommuteLegacyT141', 'a>=80', 'a>=81'], ['T468 解除後上限 .12→.13', 'computeCommuteLegacyT141', 'Math.min(.12,', 'Math.min(.13,'], ['T468 沒解除的不打折', 'computeCommuteLegacyT141', 'else commutePenalty[i]*=mul;', ''],
  ['負載衰減 .85→.86', 'tick', 'roadLoad[i]*.85', 'roadLoad[i]*.86'], ['負載新增 .15→.16', 'tick', 'roadPass[i]*.15', 'roadPass[i]*.16'], ['重算日 ===0 改 ===1', 'tick', 'day%COMMUTE_PERIOD===0', 'day%COMMUTE_PERIOD===1'],
  ['路徑累加改成指定', 'tick', 'roadPass[j]+=COMMUTE_TRIP_W;', 'roadPass[j]=COMMUTE_TRIP_W;'], ['累加器不歸零', 'tick', 'roadPass[i]=0;}', '}'],
  ['統計每格封頂 2→3', 'logisticsEfficiency481', 'Math.min(2,r)', 'Math.min(3,r)'], ['過載比例 > 改 ≥', 'logisticsEfficiency481', 'if(r>1)over++', 'if(r>=1)over++']
];
const MINE_MUTANTS = [
  ['道路容量表 16→17', 'commute', 'ROAD_CAP = [1, 2, 4, 8, 16]', 'ROAD_CAP = [1, 2, 4, 8, 17]'], ['重算週期 4→5', 'commute', 'COMMUTE_PERIOD = 4,', 'COMMUTE_PERIOD = 5,'], ['叢集分塊 6→7', 'commute', 'COMMUTE_CELL = 6,', 'COMMUTE_CELL = 7,'],
  ['路距門檻 20→21', 'commute', 'COMMUTE_FAR = 20,', 'COMMUTE_FAR = 21,'], ['每格懲罰 .012→.013', 'commute', 'COMMUTE_PEN_STEP = .012,', 'COMMUTE_PEN_STEP = .013,'], ['過長封頂 .18→.19', 'commute', 'COMMUTE_PEN_MAX = .18,', 'COMMUTE_PEN_MAX = .19,'],
  ['不可達 .30→.31', 'commute', 'COMMUTE_PEN_UNREACH = .30,', 'COMMUTE_PEN_UNREACH = .31,'], ['每叢集車流 1→2', 'commute', 'COMMUTE_TRIP_W = 1;', 'COMMUTE_TRIP_W = 2;'],
  ['鄰格順序 上右→右上', 'commute', '[[0, -1], [1, 0], [0, 1], [-1, 0]]', '[[1, 0], [0, -1], [0, 1], [-1, 0]]'], ['鄰格順序 下左→左下', 'commute', '[[0, -1], [1, 0], [0, 1], [-1, 0]]', '[[0, -1], [1, 0], [-1, 0], [0, 1]]'],
  ['高架容量 1.28→1.29', 'commute', '(t.fly475 ? 1.28 : 1)', '(t.fly475 ? 1.29 : 1)'], ['立交容量 1.55→1.56', 'commute', '(t.ix475 ? 1.55 : 1)', '(t.ix475 ? 1.56 : 1)'], ['容量取兩位小數→三位', 'commute', 'Math.round(base * m * 100) / 100', 'Math.round(base * m * 1000) / 1000'],
  ['容量下限 1→2', 'commute', 'return Math.max(1, Math.round', 'return Math.max(2, Math.round'], ['沒有等級當 2→3', 'commute', '(t.rc || 2) - 1', '(t.rc || 3) - 1'], ['等級上限 4→3', 'commute', 'Math.min(4, (t.rc', 'Math.min(3, (t.rc'],
  ['就業區只算商業', 'commute', '(b.k === 2 || b.k === 3)) dsrc.push', '(b.k === 2)) dsrc.push'], ['就業區只算工業', 'commute', '(b.k === 2 || b.k === 3)) dsrc.push', '(b.k === 3)) dsrc.push'],
  ['BFS 只走 40 步（長路的路距變成不可達）', 'commute', 'dist[j] > d + 1', 'dist[j] > d + 1 && d < 40'], ['入口取距離最小 < 改 ≤', 'commute', 'dist[j] < bd', 'dist[j] <= bd'],
  ['超額少扣門檻', 'commute', '(bd - COMMUTE_FAR) * COMMUTE_PEN_STEP', 'bd * COMMUTE_PEN_STEP'], ['封頂 min→max', 'commute', 'Math.min(COMMUTE_PEN_MAX,', 'Math.max(COMMUTE_PEN_MAX,'], ['回溯上限 600→599', 'commute', 'steps < 600', 'steps < 599', SERP], ['回溯上限 600→601', 'commute', 'steps < 600', 'steps < 601', SERP],
  ['每塊每棟都當代表', 'commute', '    if (blkSeen[blk]) continue;\n    blkSeen[blk] = 1;', '    blkSeen[blk] = 1;'], ['分塊鍵 y 換成 x', 'commute', '((x / COMMUTE_CELL) | 0) * blkPerRow + ((y / COMMUTE_CELL) | 0)', '((x / COMMUTE_CELL) | 0) * blkPerRow + ((x / COMMUTE_CELL) | 0)'],
  ['住宅類不含巨廈（掃住宅）', 'commute', 'if (!b || b.ref || !HOUSE_KINDS.includes(b.k)) continue;\n    let bd', 'if (!b || b.ref || ![1, 127, 33].includes(b.k)) continue;\n    let bd'],
  ['住宅類不含社宅（T468）', 'commute', 'if (!b || b.ref || !HOUSE_KINDS.includes(b.k)) continue;\n    const a', 'if (!b || b.ref || ![1, 33, 105].includes(b.k)) continue;\n    const a'],
  ['T468 折扣下限 .35→.36', 'commute', 'clamp(1 - a / 220, .35, .88)', 'clamp(1 - a / 220, .36, .88)'], ['T468 折扣上限 .88→.87', 'commute', 'clamp(1 - a / 220, .35, .88)', 'clamp(1 - a / 220, .35, .87)'],
  ['T468 解除門檻 80→81', 'commute', 'a >= 80', 'a >= 81'], ['T468 解除後上限 .12→.13', 'commute', 'Math.min(.12,', 'Math.min(.13,'], ['T468 沒解除的不打折', 'commute', 'else commutePenalty[i] *= mul;', ''],
  ['重算日 ===0 改 ===1', 'commute', 'day % COMMUTE_PERIOD === 0', 'day % COMMUTE_PERIOD === 1'], ['路徑累加改成指定', 'commute', 'g.roadPass[j] += COMMUTE_TRIP_W', 'g.roadPass[j] = COMMUTE_TRIP_W'],
  ['負載衰減 .85→.86', 'commute', 'g.roadLoad[i] * .85', 'g.roadLoad[i] * .86'], ['負載新增 .15→.16', 'commute', 'g.roadPass[i] * .15', 'g.roadPass[i] * .16'], ['累加器不歸零', 'commute', 'g.roadPass[i] = 0; }', ' }'],
  ['過載 > 改 ≥', 'commute', 'roadLoad[i] > roadCap475(t)', 'roadLoad[i] >= roadCap475(t)'], ['過載不看是不是道路', 'commute', 't.road && roadLoad[i] > roadCap475(t)', 'roadLoad[i] > roadCap475(t)'],
  ['jam 鄰域少一列', 'commute', 'for (let dy = -2; dy <= 2; dy++) {\n      const y = jy + dy;', 'for (let dy = -2; dy <= 1; dy++) {\n      const y = jy + dy;'], ['jam 只記有沒有', 'commute', 'jam[y * N + x]++;', 'jam[y * N + x] = 1;'],
  ['統計每格封頂 2→3', 'commute', 'Math.min(2, r)', 'Math.min(3, r)'], ['過載比例 > 改 ≥', 'commute', 'if (r > 1) over++', 'if (r >= 1) over++'],
  ['地價扣分每格 12→13', 'fields', 'n * 12', 'n * 13'], ['地價扣分上限 50→51', 'fields', 'Math.min(50, n * 12)', 'Math.min(51, n * 12)'], ['地價下限 0→1', 'fields', 'g.LAND[i] = v <= 0 ? 0 : v >= 255 ? 255 : v;', 'g.LAND[i] = v <= 0 ? 1 : v >= 255 ? 255 : v;'],
];

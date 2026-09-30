// D031 Node 守衛：城市等級（T133）——等級表、城市點數、晉升、讀檔逐項＝實驗線原文（驗收 1、2 的公式半邊，含突變）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d031-rank.json（tools/lab-rank.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；表 26 條、rank.ts 沒有 three／DOM／亂數／現實時間／外部網址；
//   2. 逐項＝實驗線：實驗線原文（RANKS 表 38476–38503、computeCityPoints 53636–53656、晉升 56133–56140、讀檔 66969–66971、住宅幸福項 55217）在 vm 裡，跟本線 src/sim/rules/rank.ts 吃同一批輸入——
//      表 26 條逐欄 Object.is；城市點數：隨機小城（住宅區與非住宅區、覆蓋場五種各種組合含缺、四種住宅類建築與別的種類與 ref 格、幸福 0–1 含剛好 .6、科技清單四種組合、零住宅區）逐位相等；
//      晉升：隨機的起始等級與點數（含一天連升好幾級、剛好等於門檻、超過最高門檻、點數低於目前門檻不降級）等級與提示字逐位相等；讀檔：rk 的各種形狀與缺 rk 從點數往上爬逐個相等；「微光之巔」項＝等級 ≥ 25 才 +.02；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一批（表裡每個門檻與名稱與預告、四個係數、五種覆蓋各自不算、四種建築各自不算、住宅區才算、跳過 ref、每個比較符號、夾限、迴圈上限、讀檔的 |0 與爬升），沒改的先核過全等。
//   接線、存檔、實驗線頁面實跑：見 tools/unit-d031-live.mjs。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as RK from '../src/sim/rules/rank.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const KEY = {
  clamp: 'clamp', RANKS: 'RANKS', rankDecl: '等級與點數的宣告', tq: 'tq', computeCityPoints: 'computeCityPoints', promote: '每天的晉升（結算之後）', happyItem: '住宅幸福的微光之巔項（昨天的等級）',
  saveRk: '存檔的 rk', loadRk: '讀檔的 rk', reset: '新圖歸零',
};   // text 的鍵 → 樣本 pieces 的名字（照樣本裡的順序）
export const rankToast = (townName, q) => `🏙️ ${townName}升至 Lv.${q + 1} ${RK.RANKS[q].name}！` + (RK.RANKS[q].unlock ? `　${RK.RANKS[q].unlock}` : '');   // 跟 src/cityView.ts simDay 的提示同一個字串（煙霧測試另外核對介面上真的長這樣）

export async function d031Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D031 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 實驗線那一邊：原文在 vm 裡 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  const realFn = T.computeCityPoints.replace('function computeCityPoints()', 'function computeCityPointsReal()');   // 點數要用真的；晉升與讀檔那兩段呼叫的 computeCityPoints 換成回傳指定值的樁（才能單獨測迴圈）
  vm.runInContext(`let N=1,tiles=[],COV={},cityHappy=.6,tech343={done:[]},__pts=0,townName='測試城';const toasts=[];const toast=(m,k)=>{toasts.push(m)};const sFanfare=()=>{};const buildToolbar=()=>{};
const residentPopulation488=(i,b)=>b.rp;
${T.clamp}
${T.RANKS}
${T.rankDecl}
${T.tq}
${realFn}
function computeCityPoints(){return __pts;}
globalThis.__set=o=>{N=o.N;tiles=o.tiles;COV=o.COV;cityHappy=o.cityHappy;tech343={done:o.tech};};
globalThis.__points=()=>computeCityPointsReal();
globalThis.__promote=(r,p)=>{rankIdx=r;__pts=p;toasts.length=0;
${T.promote}
return {rankIdx,cityPoints,toasts:[...toasts]};};
globalThis.__load=(d,p)=>{__pts=p;
${T.loadRk}
return {rankIdx,cityPoints};};
globalThis.__happy=r=>{rankIdx=r;return (${T.happyItem.trim().replace(/,$/, '')}).val;};
globalThis.__table=()=>RANKS.map(e=>({...e}));`, ctx, { filename: 'lab:rank' });
  return { set: c => ctx.__set(c), points: () => ctx.__points(), promote: (r, p) => ctx.__promote(r, p), load: (d, p) => ctx.__load(d, p), happy: r => ctx.__happy(r), table: () => ctx.__table() };
}
const plain = o => JSON.parse(J(o, (k, v) => (v === undefined ? '__undefined' : Number.isNaN(v) ? '__NaN' : v === Infinity ? '__Inf' : v === -Infinity ? '__-Inf' : v)));   // 跨 realm 比較用
const deepDiff = (a, b, p = '') => {
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) ? null : `${p} 實驗線 ${a}≠本線 ${b}`;
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const r = deepDiff(a[k], b[k], `${p}.${k}`); if (r) return r; } return null; }
  return Object.is(a, b) ? null : `${p} 實驗線 ${J(a)}≠本線 ${J(b)}`;
};
function compareTable(T, M) {
  const lab = makeLab(T).table(), mine = M.RANKS;
  if (lab.length !== mine.length) return `條數 實驗線 ${lab.length}≠本線 ${mine.length}`;
  for (let i = 0; i < lab.length; i++) {
    if (J(Object.keys(lab[i])) !== J(Object.keys(mine[i]))) return `第 ${i} 條欄位 ${J(Object.keys(lab[i]))}≠${J(Object.keys(mine[i]))}`;
    const d = deepDiff(lab[i], mine[i], `[${i}]`); if (d) return d;
  }
  return '';
}

// ---- 輸入：邊界都要碰到 ----
const COVKEYS = ['police', 'police2', 'fire', 'fire2', 'fireHQ', 'school', 'hospital', 'clinic', 'park'];
function makeInputs() {
  const R = mulberry32(20263101), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  const cities = [], HK = [.6, .6, .6, 0, 1, .3, .55, .65, () => R(), () => R(), () => R() * 2 - .5, .2, .9], TECH = [[], [], ['D1'], ['D4b'], ['D1', 'D4b'], ['X'], ['D4b', 'X']];
  for (let n = 0; n < 4000; n++) {
    const mode = pick(['normal', 'normal', 'normal', 'big', 'nozone', 'allcov', 'nocov']), N = int(3, 13), nn = N * N;
    const tiles = Array.from({ length: nn }, () => ({ zone: mode === 'nozone' ? pick([0, 2, 3, undefined]) : mode === 'big' ? 1 : pick([0, 1, 1, 1, 2, 3, undefined]), bld: null }));
    const bp = mode === 'big' ? .85 : pick([0, .2, .5, .8]);
    for (let i = 0; i < nn; i++) if (ch(bp)) {
      const k = pick([1, 1, 1, 127, 33, 105, 2, 3, 4, 9, 64, 250, 0]), b = { k, lv: 1, rp: mode === 'big' ? R() * 900 : pick([0, int(0, 40), R() * 40, int(0, 12) + .5, R() * 30]) };
      if (ch(.1)) b.ref = [0, 0];
      tiles[i].bld = b;
    }
    const COV = {}, pc = mode === 'allcov' ? 1 : mode === 'nocov' ? 0 : pick([0, .2, .5, .8, 1]);
    for (const k of COVKEYS) { if (mode !== 'allcov' && (k === 'fire2' || k === 'fireHQ' || k === 'clinic') && ch(.25)) continue; COV[k] = Uint8Array.from({ length: nn }, () => (ch(pc) ? int(1, 3) : 0)); }
    const hp = pick(HK), cityHappy = typeof hp === 'function' ? hp() : hp;
    cities.push({ N, tiles, COV, cityHappy, tech: pick(TECH) });
  }
  const proms = [];
  const TH = RK.RANKS.map(r => r.threshold);
  for (let n = 0; n < 9000; n++) {
    const start = pick([0, 0, int(0, 25), int(0, 25), 25, 24, int(0, 5)]), th = pick(TH), pts = pick([0, 1, th, th - 1, th + 1, int(0, 32000), R() * 32000, int(0, 500), 29750, 29749, 30000, 99999, 4000, -5, 1e9]);
    proms.push({ start, pts });
  }
  const shapes = [undefined, null, 0, 1, 3, 25, 26, 100, -1, -5, 2.9, 25.9, -0.5, '5', '25', '26', '', 'x', true, false, [], [7], {}, NaN, Infinity, -Infinity, 2 ** 31, 2 ** 32 + 3, -(2 ** 31) - 2, '0x10', ' 4 '];
  const pts4 = [0, 5, 30, 280, 449, 450, 3080, 29749, 29750, 99999];
  return { cities, proms, shapes, pts4 };
}

function compareAll(T, M, IN, stopAtFirst = false) {
  const st = { steps: 0, diffs: 0, first: '', cnt: {} };
  const bump = (k, v = 1) => { if (v) st.cnt[k] = (st.cnt[k] ?? 0) + v; };
  const miss = what => { st.diffs++; if (!st.first) st.first = what; return stopAtFirst; };
  const lab = makeLab(T);
  { const d = compareTable(T, M); if (d && miss(`表 ${d}`)) return st; bump('tableChecked'); }
  // 點數
  for (const [n, c] of IN.cities.entries()) {
    st.steps++;
    lab.set({ N: c.N, tiles: c.tiles, COV: c.COV, cityHappy: c.cityHappy, tech: c.tech });
    const a = lab.points(), b = M.cityPoints({ N: c.N, tiles: c.tiles }, c.COV, c.cityHappy, c.tech, x => x.rp);
    if (!Object.is(a, b) && miss(`第 ${n} 座城 點數 實驗線 ${a}≠本線 ${b}`)) return st;
    // 覆蓋
    let zoned = 0, covAny = 0, houses = 0, refs = 0, others = 0;
    for (let i = 0; i < c.N * c.N; i++) {
      const t = c.tiles[i], bl = t.bld;
      if (t.zone === 1) { zoned++; let cc = 0; for (const [k, ks] of [['p', ['police', 'police2']], ['f', ['fire', 'fire2', 'fireHQ']], ['s', ['school']], ['h', ['hospital', 'clinic']], ['k', ['park']]]) if (ks.some(q => c.COV[q] && c.COV[q][i] > 0)) { cc++; bump('term_' + k); } covAny += cc > 0 ? 1 : 0; if (cc === 5) bump('cov5'); }
      if (bl) { if (bl.ref) refs++; else if ([1, 127, 33, 105].includes(bl.k)) { houses++; bump('house' + bl.k); } else others++; }
    }
    for (const q of COVKEYS) if (c.COV[q]) { let s = 0; for (let i = 0; i < c.N * c.N; i++) if (c.tiles[i].zone === 1 && c.COV[q][i] > 0) s++; if (s) bump('only_' + q); }
    bump(zoned === 0 ? 'zoned0' : 'zonedSome'); bump(covAny === 0 && zoned > 0 ? 'covNone' : 'covSome'); bump(houses ? 'housesSome' : 'houses0'); bump(refs ? 'refSome' : 'refNone'); bump(others ? 'othersSome' : 'othersNone');
    bump(c.cityHappy === .6 ? 'happy06' : c.cityHappy > .6 ? 'happyHi' : 'happyLo'); bump('tech_' + c.tech.filter(x => x === 'D1' || x === 'D4b').join('+'));
    bump(a === 0 ? 'pts0' : 'ptsPos'); bump(a > 450 ? 'ptsGt450' : 'ptsLe450'); if (a > 29750) bump('ptsTop');
    // 沒有 clamp 的話會是負數：算出來的原始值 < 0 的城
    { let popN = 0; for (const t of c.tiles) if (t.bld && !t.bld.ref && [1, 127, 33, 105].includes(t.bld.k)) popN += t.bld.rp; if (popN + (c.cityHappy - .6) * 400 < 0) bump('rawNeg'); }
  }
  // 晉升與讀檔（點數由樁給）
  for (const [n, p] of IN.proms.entries()) {
    st.steps++;
    const L = plain(lab.promote(p.start, p.pts)), P = M.rankStep(p.start, p.pts);
    if (L.rankIdx !== P.rankIdx && miss(`晉升 ${n}（起 ${p.start}、點 ${p.pts}）等級 實驗線 ${L.rankIdx}≠本線 ${P.rankIdx}`)) return st;
    const want = P.promoted.map(q => rankToast('測試城', q));
    if (J(L.toasts) !== J(want) && miss(`晉升 ${n}（起 ${p.start}、點 ${p.pts}）提示字 實驗線 ${J(L.toasts)}≠本線 ${J(want)}`)) return st;
    if (!Object.is(L.cityPoints, p.pts) && miss('樁的點數沒進 cityPoints')) return st;
    const up = P.rankIdx - p.start;
    bump(up === 0 ? 'promote0' : up === 1 ? 'promote1' : 'promoteMulti'); if (up > 3) bump('promote4plus'); if (P.rankIdx === 25) bump('atTop'); if (p.start === 25) bump('startTop');
    if (p.pts < RK.RANKS[p.start].threshold) bump('belowCurrent'); if (p.pts === RK.RANKS[Math.min(25, p.start + 1)].threshold && p.start < 25) bump('exactNext'); if (p.pts === RK.RANKS[Math.min(25, p.start + 1)].threshold - 1 && p.start < 25) bump('oneBelowNext');
    if (p.pts >= 29750) bump('ptsOverTop'); if (p.pts < 0) bump('ptsNeg'); if (P.promoted.some(q => RK.RANKS[q].unlock)) bump('promoUnlock'); if (P.promoted.some(q => !RK.RANKS[q].unlock)) bump('promoNoUnlock');
  }
  for (const r of [0, 1, 24, 25]) { st.steps++; const a = lab.happy(r), b = r >= M.TOP_RANK ? .02 : 0; if (!Object.is(a, b) && miss(`微光之巔項 等級 ${r} 實驗線 ${a}≠本線 ${b}`)) return st; bump(r >= 25 ? 'topBonus' : 'noBonus'); }
  for (const [n, s] of IN.shapes.entries()) for (const p of IN.pts4) {
    st.steps++;
    const d = s === undefined ? {} : { rk: s };
    let L; try { L = plain(lab.load(d, p)); } catch (e) { if (miss(`讀檔形狀 ${n}（${J(plain(s))}）實驗線丟例外 ${e.message}`)) return st; continue; }
    let P; try { P = M.rankOfSave(s, p); } catch (e) { if (miss(`讀檔形狀 ${n}（${J(plain(s))}）本線丟例外 ${e.message}`)) return st; continue; }
    if (!Object.is(L.rankIdx, P) && miss(`讀檔 rk=${J(plain(s))}、點 ${p}：實驗線 ${L.rankIdx}≠本線 ${P}`)) return st;
    bump(s === undefined ? 'loadClimb' : 'loadRk'); if (s === 0 && p >= 450) bump('loadRk0HighPts'); if (typeof s === 'number' && s > 25) bump('loadClampHi'); if (typeof s === 'number' && s < 0) bump('loadClampLo'); if (typeof s === 'string') bump('loadString');
    if (typeof s === 'number' && !Number.isInteger(s)) bump('loadFraction'); if (s === null) bump('loadNull'); if (s !== undefined && Number.isNaN(s)) bump('loadNaN'); if (s === undefined && p >= 30) bump('loadClimbPositive');
    if (typeof s === 'number' && s >= 0 && s <= 25 && p < RK.RANKS[Math.floor(s)].threshold) bump('loadRkAbovePoints');
  }
  return st;
}

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d031-rank.json')), T = S.text;
  const IN = makeInputs();

  // ---- 1. 出處 ----
  {
    const bad = [], names = (S.pieces ?? []).map(p => p.name), want = Object.values(KEY);
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    if (J(names) !== J(want)) bad.push(`段落 ${names.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[Object.keys(KEY).find(k => KEY[k] === p.name) ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    const wantLines = { clamp: [37219, 37219], RANKS: [38476, 38503], '等級與點數的宣告': [38504, 38505], tq: [38549, 38549], computeCityPoints: [53636, 53656], '每天的晉升（結算之後）': [56133, 56140],
      '住宅幸福的微光之巔項（昨天的等級）': [55217, 55217], '存檔的 rk': [66762, 66762], '讀檔的 rk': [66969, 66971], '新圖歸零': [51128, 51128] };
    for (const p of S.pieces ?? []) { const w = wantLines[p.name]; if (!w || p.line !== w[0] || p.endLine !== w[1]) bad.push(`${p.name} 行號 ${p.line}–${p.endLine}（要 ${w?.join('–')}）`); }
    const nEntries = (T.RANKS.match(/^ {2}\{name:/gm) ?? []).length;
    if (nEntries !== 26 || RK.RANKS.length !== 26) bad.push(`表的條數 實驗線 ${nEntries}／本線 ${RK.RANKS.length}（要 26）`);
    if (RK.TOP_RANK !== 25) bad.push(`頂級 ${RK.TOP_RANK}（要 25）`);
    const src = read('src/sim/rules/rank.ts');
    if (/https?:\/\//.test(src)) bad.push('rank.ts 有外部網址');
    if (/Math\.random|Date\.now|performance\.now|from 'three'|document\.|window\./.test(src.replace(/\/\/.*$/gm, ''))) bad.push('rank.ts 碰了亂數／現實時間／three／DOM（規則 2、3）');
    if (!/rk:rankIdx,/.test(T.saveRk)) bad.push('存檔那一段不是 rk:rankIdx,');
    if (!/rankIdx>=25\?\.02:0/.test(T.happyItem)) bad.push('幸福項不是 rankIdx>=25?.02:0');
    log(!bad.length, `D031 城市等級原文：實驗線 ${PINNED.slice(0, 7)} 的 ${S.pieces?.length} 段（clamp 37219、等級表 38476–38503、宣告 38504–38505、tq 38549、城市點數 53636–53656、晉升 56133–56140、幸福項 55217、存檔 66762、讀檔 66969–66971、歸零 51128）逐段 sha256＝錨點記錄；表 26 條；rank.ts 純函式（沒有 three、DOM、亂數、現實時間、外部網址）`,
      bad.join('；') || `${S.pieces.length} 段、行號對得上；表 ${RK.RANKS.length} 條`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const BASE = { ...RK };
  const base = compareAll(T, BASE, IN);
  const NEED = {
    tableChecked: 1, zoned0: 200, zonedSome: 2000, covNone: 100, covSome: 2000, housesSome: 2500, houses0: 100, refSome: 500, refNone: 100, othersSome: 2000, othersNone: 20, happy06: 800, happyHi: 300, happyLo: 500,
    term_p: 1500, term_f: 1500, term_s: 1500, term_h: 1500, term_k: 1500, cov5: 300, only_police: 500, only_police2: 500, only_fire: 500, only_fire2: 300, only_fireHQ: 300, only_school: 500, only_hospital: 500, only_clinic: 300, only_park: 500,
    house1: 1500, house127: 800, house33: 800, house105: 800, 'tech_': 1000, 'tech_D1': 300, 'tech_D4b': 300, 'tech_D1+D4b': 300, pts0: 100, ptsPos: 2000, ptsGt450: 500, ptsTop: 20, rawNeg: 30,
    promote0: 2000, promote1: 400, promoteMulti: 2000, promote4plus: 500, atTop: 500, startTop: 500, belowCurrent: 500, exactNext: 100, oneBelowNext: 100, ptsOverTop: 300, ptsNeg: 100, promoUnlock: 500, promoNoUnlock: 500, topBonus: 1, noBonus: 3,
    loadClimb: 10, loadRk: 300, loadRk0HighPts: 5, loadClampHi: 50, loadClampLo: 50, loadString: 60, loadFraction: 50, loadNull: 10, loadNaN: 10, loadClimbPositive: 8, loadRkAbovePoints: 10,
  };
  const lacking = Object.entries(NEED).filter(([k, v]) => (base.cnt[k] ?? 0) < v).map(([k, v]) => `${k} ${(base.cnt[k] ?? 0)}<${v}`);
  log(base.diffs === 0 && !lacking.length,
    `D031 驗收 2：城市等級逐項＝實驗線——實驗線原文在 vm 裡跟本線 rank.ts 吃同一批輸入（表 26 條逐欄；城市點數 ${IN.cities.length.toLocaleString()} 座隨機小城〔住宅區與非住宅區、覆蓋場五種各種組合含缺、四種住宅類建築與別的種類與 ref 格、幸福 −.5…1.5 含剛好 .6、科技清單、零住宅區〕；晉升 ${IN.proms.length.toLocaleString()} 組〔起始等級 × 點數：含連升好幾級、剛好在門檻與差 1、超過最高門檻、負數〕；讀檔 ${IN.shapes.length} 種 rk 形狀 × ${IN.pts4.length} 種點數）：`
      + `點數逐位相等、等級與提示字逐位相等、讀檔（有 rk 夾限還原、缺 rk 從點數往上爬）逐個相等、微光之巔項只有等級 ≥ 25 才 +.02；每一支分支都發生過`,
    base.first || (lacking.length ? `覆蓋不夠：${lacking.join('、')}｜${J(base.cnt)}` : `${base.steps.toLocaleString()} 步全等；點數為正 ${base.cnt.ptsPos} 座、頂級以上 ${base.cnt.ptsTop} 座、算出負數被夾成 0 的 ${base.cnt.rawNeg} 座；連升好幾級 ${base.cnt.promoteMulti} 組、連升 4 級以上 ${base.cnt.promote4plus} 組；讀檔 rk 高於點數所指等級 ${base.cnt.loadRkAbovePoints} 組`));

  if (process.env.D031_BASE_ONLY) return;
  // ---- 3. 注入錯誤要紅 ----
  {
    const missed = [];
    const labLines = T.RANKS.split('\n'), mineSrc = read('src/sim/rules/rank.ts'), mineLines = mineSrc.split('\n').filter(l => /^ {2}\{ name: "/.test(l));
    let tblLab = 0, tblMine = 0;
    for (const [j, line] of labLines.entries()) {
      if (!/^ {2}\{name:/.test(line)) continue;
      const muts = [['threshold', line.replace(/(threshold:)(\d+)/, (_, a, v) => a + (+v + 1))], ['name', line.replace(/name:'/, "name:'x")]];
      if (/unlock:'/.test(line)) muts.push(['unlock', line.replace(/unlock:'/, "unlock:'x")]); else muts.push(['unlock（多一個）', line.replace(/\},?\s*$/, ",unlock:'x'},")]);
      for (const [f, to] of muts) {
        if (to === line) { missed.push(`實驗線表第 ${j} 行 ${f} 沒改成`); continue; }
        const t2 = { ...T, RANKS: labLines.map((l, q) => (q === j ? to : l)).join('\n') };
        tblLab++; if (!compareTable(t2, BASE)) missed.push(`實驗線表第 ${j} 行 ${f}`);
      }
    }
    for (const line of mineLines) {
      const nm = /name: "([^"]+)"/.exec(line)[1], muts = [['threshold', line.replace(/(threshold: )(\d+)/, (_, a, v) => a + (+v + 1))], ['name', line.replace(/name: "/, 'name: "x')]];
      if (/unlock: "/.test(line)) muts.push(['unlock', line.replace(/unlock: "/, 'unlock: "x')]); else muts.push(['unlock（多一個）', line.replace(/ \},$/, ', unlock: "x" },')]);
      for (const [f, to] of muts) {
        if (to === line) { missed.push(`本線表 ${nm} ${f} 沒改成`); continue; }
        let M; try { M = await loadMod('src/sim/rules/rank.ts', [[line, to]]); } catch (e) { missed.push(`本線表 ${nm} ${f} 載入失敗 ${e.message}`); continue; }
        tblMine++; if (!compareTable(T, M)) missed.push(`本線表 ${nm} ${f}`);
      }
    }
    for (const [name, edits] of [['少最後一條', [[mineLines[mineLines.length - 1] + '\n', '']]], ['第 0、1 條對調', [[mineLines[0] + '\n' + mineLines[1], mineLines[1] + '\n' + mineLines[0]]]]]) {
      let M; try { M = await loadMod('src/sim/rules/rank.ts', edits); } catch (e) { missed.push(`本線表「${name}」載入失敗 ${e.message}`); continue; }
      tblMine++; if (!compareTable(T, M)) missed.push(`本線表「${name}」`);
    }
    let n = 0, m = 0;
    for (const [name, key, from, to] of LAB_MUTANTS) {
      const t2 = { ...T };
      if (typeof t2[key] !== 'string' || t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一（${t2[key] === undefined ? '沒有這段' : t2[key].split(from).length - 1}）`); continue; }
      t2[key] = t2[key].replace(from, to);
      let d; try { d = compareAll(t2, BASE, IN, true).diffs; } catch (e) { missed.push(`實驗線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      n++; if (!d) missed.push(`實驗線「${name}」`);
    }
    for (const [name, from, to] of MINE_MUTANTS) {
      let M;
      try { M = await loadMod('src/sim/rules/rank.ts', [[from, to]]); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = compareAll(T, M, IN, true).diffs; } catch (e) { missed.push(`本線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      m++; if (!d) missed.push(`本線「${name}」`);
    }
    const cm0 = await loadMod('src/sim/rules/rank.ts', []);
    const baseOk = !compareAll(T, cm0, IN, true).diffs;
    log(baseOk && !missed.length, `D031 驗收 2（突變）：注入錯誤要紅——表：實驗線原文 ${tblLab} 個、本線原碼 ${tblMine} 個（每條的名稱、門檻、預告各改一下；少一條、對調兩條）；點數、晉升、讀檔：實驗線原文 ${n} 個、本線原碼 ${m} 個（四個係數、五種覆蓋各自不算與各自的另一條路、四種建築各自不算與多算、住宅區才算、跳過 ref、比較符號、夾限、迴圈上限、讀檔的 |0 與爬升、tq 的兩個科技與倍率）；沒改的先核過全等（vm 載入的本線原碼＝import 的）`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }
}

// ---- 突變表：[名字, 段落鍵, 原文, 改成]（實驗線）／[名字, 原文, 改成]（本線 rank.ts）。原文要在那一段（那個檔）裡剛好出現一次 ----
// 等價突變不列：`t.zone===1` 改成 `t.zone>=1`——不等價（zone 2、3 也算），列在下面；`COV.police2` 等「後面的 &&」在缺 COV 時的短路是同一個結果，只是寫法；
// `rankIdx<RANKS.length-1` 改成 `<RANKS.length` 會讀 RANKS[26]（丟例外），改成語法正確的錯誤不可能，不列
const LAB_MUTANTS = [
  // 點數 53636–53656
  ['住宅區 ===1 → >=1', 'computeCityPoints', 't.zone===1', 't.zone>=1'], ['住宅區 ===1 → ===2', 'computeCityPoints', 't.zone===1', 't.zone===2'],
  ['警察局不算', 'computeCityPoints', 'if(COV.police[i]>0||COV.police2[i]>0)c++;', 'if(COV.police2[i]>0)c++;'], ['派出所不算', 'computeCityPoints', 'if(COV.police[i]>0||COV.police2[i]>0)c++;', 'if(COV.police[i]>0)c++;'],
  ['警察覆蓋 >0 → >=0', 'computeCityPoints', 'if(COV.police[i]>0||COV.police2[i]>0)c++;', 'if(COV.police[i]>=0||COV.police2[i]>0)c++;'],
  ['消防局不算', 'computeCityPoints', 'if(COV.fire[i]>0||(COV.fire2&&COV.fire2[i]>0)||(COV.fireHQ&&COV.fireHQ[i]>0))c++;', 'if((COV.fire2&&COV.fire2[i]>0)||(COV.fireHQ&&COV.fireHQ[i]>0))c++;'],
  ['二號消防站不算', 'computeCityPoints', 'if(COV.fire[i]>0||(COV.fire2&&COV.fire2[i]>0)||(COV.fireHQ&&COV.fireHQ[i]>0))c++;', 'if(COV.fire[i]>0||(COV.fireHQ&&COV.fireHQ[i]>0))c++;'],
  ['消防總部不算', 'computeCityPoints', 'if(COV.fire[i]>0||(COV.fire2&&COV.fire2[i]>0)||(COV.fireHQ&&COV.fireHQ[i]>0))c++;', 'if(COV.fire[i]>0||(COV.fire2&&COV.fire2[i]>0))c++;'],
  ['學校不算', 'computeCityPoints', 'if(COV.school[i]>0)c++;', ''], ['學校 >0 → >1', 'computeCityPoints', 'COV.school[i]>0', 'COV.school[i]>1'],
  ['醫院不算', 'computeCityPoints', 'if(COV.hospital[i]>0||(COV.clinic&&COV.clinic[i]>0))c++;', 'if((COV.clinic&&COV.clinic[i]>0))c++;'], ['診所不算', 'computeCityPoints', 'if(COV.hospital[i]>0||(COV.clinic&&COV.clinic[i]>0))c++;', 'if(COV.hospital[i]>0)c++;'],
  ['公園不算', 'computeCityPoints', 'if(COV.park[i]>0)c++;', ''], ['覆蓋項的除數 5→4', 'computeCityPoints', 'covSum+=c/5;', 'covSum+=c/4;'], ['覆蓋項的除數 5→6', 'computeCityPoints', 'covSum+=c/5;', 'covSum+=c/6;'],
  ['ref 格不跳過', 'computeCityPoints', 'if(b&&!b.ref){', 'if(b){'], ['住宅不算', 'computeCityPoints', '[1,127,33,105]', '[127,33,105]'], ['社宅不算', 'computeCityPoints', '[1,127,33,105]', '[1,33,105]'], ['住宅摩天樓 33 不算', 'computeCityPoints', '[1,127,33,105]', '[1,127,105]'],
  ['住宅摩天樓 105 不算', 'computeCityPoints', '[1,127,33,105]', '[1,127,33]'], ['商業也算人口', 'computeCityPoints', '[1,127,33,105]', '[1,127,33,105,2]'],
  ['沒有住宅區補 0→1', 'computeCityPoints', 'const svcCov=zoned?covSum/zoned:0;', 'const svcCov=zoned?covSum/zoned:1;'],
  ['幸福基準 .6→.61', 'computeCityPoints', '(cityHappy-.6)*400', '(cityHappy-.61)*400'], ['幸福係數 400→401', 'computeCityPoints', '(cityHappy-.6)*400', '(cityHappy-.6)*401'], ['覆蓋係數 800→801', 'computeCityPoints', 'svcCov*800', 'svcCov*801'],
  ['下限 0→−1', 'computeCityPoints', 'Math.max(0,Math.round(', 'Math.max(-1,Math.round('], ['四捨五入→無條件捨去', 'computeCityPoints', 'Math.round(', 'Math.floor('],
  ['科技 D1 的倍率 1.05→1.06', 'computeCityPoints', "tq('D1',1.05,1)", "tq('D1',1.06,1)"], ['科技 D4b 的倍率 1.10→1.11', 'computeCityPoints', "tq('D4b',1.10,1)", "tq('D4b',1.11,1)"],
  ['科技 D1 不乘', 'computeCityPoints', "*tq('D1',1.05,1)", ''], ['科技 D4b 不乘', 'computeCityPoints', "*tq('D4b',1.10,1)", ''], ['科技 D1 改看 D4b', 'computeCityPoints', "tq('D1',1.05,1)", "tq('D4b',1.05,1)"],
  ['科技沒做完的預設 1→0', 'computeCityPoints', "tq('D1',1.05,1)", "tq('D1',1.05,0)"],
  // 晉升 56133–56140
  ['晉升 >= → >', 'promote', 'cityPoints>=RANKS[rankIdx+1].threshold', 'cityPoints>RANKS[rankIdx+1].threshold'], ['晉升只升一級（while→if）', 'promote', 'while(rankIdx<RANKS.length-1', 'if(rankIdx<RANKS.length-1'],
  ['晉升的上限 −1→−2', 'promote', 'rankIdx<RANKS.length-1&&', 'rankIdx<RANKS.length-2&&'], ['晉升讀本級門檻', 'promote', 'cityPoints>=RANKS[rankIdx+1].threshold', 'cityPoints>=RANKS[rankIdx].threshold'],
  ['提示字 升至→升到', 'promote', '升至 Lv.', '升到 Lv.'], ['提示字 Lv.+1→Lv.', 'promote', '升至 Lv.${rankIdx+1}', '升至 Lv.${rankIdx}'], ['提示沒有預告', 'promote', "+(rk.unlock?`　${rk.unlock}`:'')", ''],
  ['提示的預告分隔（全形空白→半形）', 'promote', '`　${rk.unlock}`', '` ${rk.unlock}`'],
  // 讀檔 66969–66971
  ['讀檔 rk 判斷 !==undefined → 真值', 'loadRk', 'if(d.rk!==undefined)', 'if(d.rk)'], ['讀檔不取整 |0', 'loadRk', 'clamp(d.rk|0,0,RANKS.length-1)', 'clamp(d.rk,0,RANKS.length-1)'], ['讀檔下限 0→1', 'loadRk', 'clamp(d.rk|0,0,RANKS.length-1)', 'clamp(d.rk|0,1,RANKS.length-1)'],
  ['讀檔上限 −1→−2', 'loadRk', 'clamp(d.rk|0,0,RANKS.length-1)', 'clamp(d.rk|0,0,RANKS.length-2)'], ['讀檔缺 rk 不往上爬', 'loadRk', 'else{rankIdx=0;while(', 'else{rankIdx=0;if('], ['讀檔缺 rk 爬升 >= → >', 'loadRk', 'cityPoints>=RANKS[rankIdx+1].threshold)rankIdx++;', 'cityPoints>RANKS[rankIdx+1].threshold)rankIdx++;'],
  ['讀檔缺 rk 爬升的上限 −1→−2', 'loadRk', 'while(rankIdx<RANKS.length-1&&cityPoints>=RANKS[rankIdx+1].threshold)rankIdx++;}', 'while(rankIdx<RANKS.length-2&&cityPoints>=RANKS[rankIdx+1].threshold)rankIdx++;}'],
  // 幸福項 55217
  ['幸福項門檻 25→24', 'happyItem', 'rankIdx>=25', 'rankIdx>=24'], ['幸福項門檻 25→26', 'happyItem', 'rankIdx>=25', 'rankIdx>=26'], ['幸福項 .02→.03', 'happyItem', '?.02:0', '?.03:0'], ['幸福項 >= → >', 'happyItem', 'rankIdx>=25', 'rankIdx>25'],
];
const MINE_MUTANTS = [
  ['住宅區 ===1 → >=1', 't.zone === 1', 't.zone >= 1'], ['住宅區 ===1 → ===2', 't.zone === 1', 't.zone === 2'],
  ['警察局不算', '(police && police[i] > 0) || (police2 && police2[i] > 0)', '(police2 && police2[i] > 0)'], ['派出所不算', '(police && police[i] > 0) || (police2 && police2[i] > 0)', '(police && police[i] > 0)'],
  ['警察覆蓋 >0 → >=0', '(police && police[i] > 0) || (police2', '(police && police[i] >= 0) || (police2'],
  ['消防局不算', '(fire && fire[i] > 0) || (fire2 && fire2[i] > 0) || (fireHQ && fireHQ[i] > 0)', '(fire2 && fire2[i] > 0) || (fireHQ && fireHQ[i] > 0)'],
  ['二號消防站不算', '(fire && fire[i] > 0) || (fire2 && fire2[i] > 0) || (fireHQ && fireHQ[i] > 0)', '(fire && fire[i] > 0) || (fireHQ && fireHQ[i] > 0)'],
  ['消防總部不算', '(fire && fire[i] > 0) || (fire2 && fire2[i] > 0) || (fireHQ && fireHQ[i] > 0)', '(fire && fire[i] > 0) || (fire2 && fire2[i] > 0)'],
  ['學校不算', 'if (school && school[i] > 0) c++;', ''], ['學校 >0 → >1', 'school[i] > 0', 'school[i] > 1'],
  ['醫院不算', '(hospital && hospital[i] > 0) || (clinic && clinic[i] > 0)', '(clinic && clinic[i] > 0)'], ['診所不算', '(hospital && hospital[i] > 0) || (clinic && clinic[i] > 0)', '(hospital && hospital[i] > 0)'],
  ['公園不算', 'if (park && park[i] > 0) c++;', ''], ['覆蓋項的除數 5→4', 'covSum += c / 5;', 'covSum += c / 4;'], ['覆蓋項的除數 5→6', 'covSum += c / 5;', 'covSum += c / 6;'],
  ['ref 格不跳過', 'if (b && !b.ref) {', 'if (b) {'], ['住宅不算', 'b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105', 'b.k === 127 || b.k === 33 || b.k === 105'], ['社宅不算', 'b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105', 'b.k === 1 || b.k === 33 || b.k === 105'],
  ['住宅摩天樓 33 不算', 'b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105', 'b.k === 1 || b.k === 127 || b.k === 105'], ['住宅摩天樓 105 不算', 'b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105', 'b.k === 1 || b.k === 127 || b.k === 33'],
  ['商業也算人口', 'b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105', 'b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105 || b.k === 2'],
  ['沒有住宅區補 0→1', 'zoned ? covSum / zoned : 0', 'zoned ? covSum / zoned : 1'],
  ['幸福基準 .6→.61', '(cityHappy - .6) * 400', '(cityHappy - .61) * 400'], ['幸福係數 400→401', '(cityHappy - .6) * 400', '(cityHappy - .6) * 401'], ['覆蓋係數 800→801', 'svcCov * 800', 'svcCov * 801'],
  ['下限 0→−1', 'Math.max(0, Math.round(', 'Math.max(-1, Math.round('], ['四捨五入→無條件捨去', 'Math.max(0, Math.round(', 'Math.max(0, Math.floor('],
  ['科技 D1 的倍率 1.05→1.06', "tech.includes('D1') ? 1.05 : 1", "tech.includes('D1') ? 1.06 : 1"], ['科技 D4b 的倍率 1.10→1.11', "tech.includes('D4b') ? 1.10 : 1", "tech.includes('D4b') ? 1.11 : 1"],
  ['科技 D1 不乘', " * (tech.includes('D1') ? 1.05 : 1)", ''], ['科技 D4b 不乘', " * (tech.includes('D4b') ? 1.10 : 1)", ''], ['科技 D1 改看 D4b', "tech.includes('D1') ? 1.05 : 1", "tech.includes('D4b') ? 1.05 : 1"],
  ['科技沒做完的預設 1→0', "tech.includes('D1') ? 1.05 : 1", "tech.includes('D1') ? 1.05 : 0"],
  ['晉升 >= → >', 'points >= RANKS[rankIdx + 1].threshold) { rankIdx++; promoted.push(rankIdx); }', 'points > RANKS[rankIdx + 1].threshold) { rankIdx++; promoted.push(rankIdx); }'],
  ['晉升只升一級（while→if）', 'while (rankIdx < RANKS.length - 1 && points >= RANKS[rankIdx + 1].threshold) { rankIdx++;', 'if (rankIdx < RANKS.length - 1 && points >= RANKS[rankIdx + 1].threshold) { rankIdx++;'],
  ['晉升的上限 −1→−2', 'while (rankIdx < RANKS.length - 1 && points', 'while (rankIdx < RANKS.length - 2 && points'], ['晉升讀本級門檻', 'points >= RANKS[rankIdx + 1].threshold) { rankIdx++; promoted.push', 'points >= RANKS[rankIdx].threshold) { rankIdx++; promoted.push'],
  ['晉升不回報升到哪幾級', 'rankIdx++; promoted.push(rankIdx); }', 'rankIdx++; }'], ['晉升回報的是升之前的級', 'rankIdx++; promoted.push(rankIdx); }', 'promoted.push(rankIdx); rankIdx++; }'],
  ['讀檔 rk 判斷 !==undefined → 真值', 'if (rk !== undefined) return', 'if (rk) return'], ['讀檔不取整 |0', 'clamp((rk as number) | 0, 0, RANKS.length - 1)', 'clamp((rk as number), 0, RANKS.length - 1)'], ['讀檔下限 0→1', 'clamp((rk as number) | 0, 0, RANKS.length - 1)', 'clamp((rk as number) | 0, 1, RANKS.length - 1)'],
  ['讀檔上限 −1→−2', 'clamp((rk as number) | 0, 0, RANKS.length - 1)', 'clamp((rk as number) | 0, 0, RANKS.length - 2)'], ['讀檔缺 rk 不往上爬', 'return rankStep(0, points).rankIdx;', 'return 0;'], ['讀檔缺 rk 從 1 級起爬', 'return rankStep(0, points).rankIdx;', 'return rankStep(1, points).rankIdx;'],
  ['頂級索引 25→24', 'export const TOP_RANK = RANKS.length - 1;', 'export const TOP_RANK = RANKS.length - 2;'],
];

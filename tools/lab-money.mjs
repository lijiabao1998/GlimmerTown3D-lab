// D011 資金公式的黃金樣本：照 D009／D010 的做法（tools/lab-rules.mjs、tools/lab-fields.mjs），從 2D 實驗線 index.html 摘出 tick() 的
// 收稅（55868–55968）、維護費（55969–55977、55987–55990）、其他收入與進口（56025）、地面運輸（56026–56027）、城市活動取整（56028）、
// 結算後段（56053–56145：結算、挑戰與場景（關）、貸款、里程碑、成就、評分與升星、城市等級、紓困）的原始碼文字，在 Node vm 裡對隨機輸入求值。
// 片段文字一個字都不改，包成函式跑；片段以外的東西（第 2 類系統給的乘數、進口費、其他收入、第一個計數迴圈數的設施數、畫面、音效）換成樁，由案例給。
// 55978–55986 地鐵逐線迴圈沒摘：逐線加總（取整前）當輸入，55987 起照原文取整。
// 本檔也是案例產生器：tools/unit-d011-money.mjs import 同一個 moneyCase()，兩邊各自產生案例、互不共用。
// 另外把實驗線片段做單點突變（LAB_MUTANTS），找出每個突變第一個對不上的案例，連同突變後的輸出存進樣本：
// 本線守衛拿來核對「實驗線原碼若是這樣，本線就對不上（守衛會紅）」。
// 用法：node tools/lab-money.mjs --lab=<實驗線工作目錄>   → src/content/samples/d011-money.json
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { labSource } from './labsrc.mjs';
import { canon } from './d009-cases.mjs';
import { mulberry32 } from '../src/sim/rng.ts';

export { canon };
export const D011_MONEY_SEED = 20261011;
export const D011_MONEY_COMMIT = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
// 家族：day 隨機城一天（結算接當天收支）、free 結算門檻（收支自由給：紓困、淨額 0、錢剛好 20）、
// sweep 每一種建築種類 0–200（65 除外）都輪到、neutral 本線 D011 模擬的呼叫方式（第 2 類乘數 1、沒有進口、沒有城市活動）、
// big 大城（浮點加總順序）：路幾百格（等級 1–5 混）、公園電廠消防警察醫院都有、設施數多半不是 0、服務預算四類都不是 1、收入與進口帶兩位小數，
//   55970 逐格、55973、55990、56025 的加總順序一改就看得出來。前四族：地圖 4–12 格見方、公園電廠少，55973 前三項的部分和跨不出要的 2 的冪；
//   其他收入與進口的小數是 32 位元亂數乘範圍（有效位數不到 40 位），十幾項相加是精確的——roadUpkeep 挪到第三項、56025 各項換順序，2,200 組一組都看不出來
export const FAMILIES = [['day', 1000], ['free', 700], ['sweep', 300], ['neutral', 200], ['big', 500]];
export const D011_MONEY_COUNT = FAMILIES.reduce((n, [, c]) => n + c, 0);

// ---- 名單（照實驗線 @ d23c18d 抄；tools/lab-money.mjs 產樣本時拿實驗線自己的表核對）----
// tick 第一個計數迴圈（55040 起）數的、維護費 55973–55976／55990 讀的設施數（稅收迴圈自己數的 parks 等六個不在這裡）
export const FIRST_LOOP_KEYS = ['clinics', 'schools', 'libraries', 'posts', 'cemeteries', 'bigCemN', 'dumps', 'stadiums', 'waterTowers', 'st', 'gstN', 'scN', 'fpN', 'nkN',
  'hyN', 'geN', 'fhqN', 'wteN', 'ghN', 'whN284', 'mallN', 'po', 'ai', 'pa', 'tr', 'fa', 'bigFa', 'ra', 'la', 'so', 'wi', 'se', 'am', 'rc', 'fs2', 'pr', 'un', 'faN', 'ctN307',
  'obN307', 'upLm309', 'mu', 'th', 'aq', 'zo', 'ap', 'ci', 'gl', 'chN', 'crtN', 'cvN', 'inN', 'wsN', 'bgN', 'mhN', 'owN', 'mnN', 'mgN', 'gh330', 'ht330', 'rs330', 'kg330',
  'sn330', 'bk330', 'mk330', 'cp330', 'tv330', 'mr330', 'tp336', 'dg336', 'ir336', 'sk336', 'fw340', 'pl340', 'fp340', 'hs340', 'ch340', 'br340', 'wp340', 'vt340', 'sr340',
  'cg340', 'cr342', 'hsc342', 'tpk342', 'frt342', 'upc342', 'cpk342', 'gpk465', 'gmc466', 'art466', 'adm466', 'res466', 'cam342', 'mpt342', 'cvc342', 'dtc342', 'gw346',
  'fp346', 'kt346', 'ff346', 'refineryN', 'steelMillN', 'shipyardN', 'cl485', 'im485', 'dc485', 'cold485', 'silo485', 'fuelDep485', 'gasDep485', 'steelY485', 'bulk485',
  'cport485', 'court364', 'tennis364', 'play364', 'socialHousing364', 'substation364', 'desal364', 'pump364', 'center364', 'shelter364', 'radar364'];
// 56025 稅以外的收入、進口費
export const OTHER_INCOME_KEYS = ['farmGold', 'ranchGold', 'procGold', 'ghGold', 'lodgeRev', 'mktGold', 'tradeGold', 'brewGold', 'techGold', 'dcGold', 'gasGold', 'cookGold',
  'bankInt', 'parkingRevenue491', 'shipPortGold', 'shipDailyGold418', 'fuelExportGold418', 'steelExportGold482', 'goodsExportGold481'];
export const IMPORT_KEYS = ['goodsImportCost481', 'foodImportCost482', 'gasImportCost482', 'fuelImportCost482', 'steelImportCost482', 'suppliesImportCost482'];
// pol 的開關：55972 法規費、55963／55965 稅收、55987／56027 票務
export const POL_FLAGS = ['recycle', 'tourPromo', 'schoolLunch', 'smokeDetect', 'parkNight', 'insurance', 'waterConserve', 'reclaimPriority', 'industrialPretreat', 'spongeCity',
  'housingSubsidy', 'inclusionaryHousing', 'stationHousing', 'infrastructureStimulus', 'consumptionSupport', 'industrialRelief', 'completeStreets', 'parkingManagement',
  'criticalReserve492', 'emergencyStockpile492', 'nightMarket', 'ecoReg', 'indSubsidy', 'freeTransit', 'integratedTransit'];
export const TECH = ['A1', 'A3', 'A4a', 'A4b', 'A6', 'A8', 'B4a', 'B4b', 'C3', 'C4a', 'D3', 'C1'];
export const SPECS = ['', '', 'hub', 'ind', 'green', 'edu', 'tour'];
// 38131–38193 CITY_EVENTS 的稅率（全部不重複的值；產樣本時核對跟實驗線的表一樣）
export const EVENT_TAX = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 0.97, 1, 1.05, 1.08, 1.1, 1.12, 1.15, 1.18, 1.2, 1.25, 1.3, 1.35, 1.4];
export const MILE_POPS = [50, 150, 400, 900, 1600, 2600, 4000, 7000];   // 37861 MILES 的門檻（產樣本時核對）
// 建築種類：0–200 全輪（k65 大型購物中心本線沒搬，不放）；稅收迴圈數的設施；有專屬稅分支的
export const ALL_K = Array.from({ length: 201 }, (_, k) => k).filter(k => k !== 65);
const COUNTED_K = [4, 5, 6, 11, 52, 12, 30];
const SPECIAL_K = [33, 105, 106, 34, 127];
const HAZARDS = [['fire', .05], ['sick', .05], ['death', .03], ['abandoned', .04], ['riot', .03], ['plague', .03]];

// 種子：家族名逐字元混進去（同 tools/d010-cases.mjs）
export function seedOf(name, k) {
  let h = (D011_MONEY_SEED ^ 0x9e3779b9) >>> 0;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h = Math.imul(h ^ (k + 1), 2654435761) >>> 0;
  h ^= h >>> 15;
  return Math.imul(h, 2246822519) >>> 0;
}
function gen(seed) {
  const R = mulberry32(seed);
  const int = (a, b) => a + Math.floor(R() * (b - a + 1)), f = (a, b) => a + R() * (b - a), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  return { R, int, f, ch, pick };
}
const insertSorted = (a, v) => { let j = 0; while (j < a.length && a[j] < v) j++; a.splice(j, 0, v); };

function genBld(g, k, lvMax) {
  const b = { k, lv: g.int(1, k <= 3 ? 3 : lvMax), v: g.int(0, 11), age: g.int(0, 40), pw: g.ch(.82) };
  if (g.ch(.75)) b.wa = true;
  if (k === 1 || k === 127 || k === 33 || k === 105 || g.ch(.05)) { if (g.ch(.85)) b.den = g.int(1, 5); if (g.ch(.85)) b.we = g.int(0, 2); }
  for (const [flag, p] of HAZARDS) if (g.ch(p)) b[flag] = g.ch(.7) ? 1 : true;
  if (g.ch(.1)) b.crime = 1;
  return b;
}
function pickKind(g) {
  const r = g.R();
  return r < .55 ? g.pick([1, 1, 2, 2, 3, 3]) : r < .7 ? g.pick(COUNTED_K) : r < .8 ? g.pick(SPECIAL_K) : g.pick(ALL_K);
}
// big 家族：稅收迴圈數的六種設施（55885–55890 公園、電廠、消防、警察局、派出所、醫院），每個案例比例不同。
// aim（一半）：公園、電廠不隨機放，改成瞄準 2 的冪（見 genCity）；其餘設施少（每種仍至少一座），55973 前三項的捨入差才不會被後面的大數吃掉
const SVC_K = [4, 5, 6, 11, 52, 12];
function bigParams(g) {
  const aim = g.ch(.5), w = SVC_K.map(k => aim && k <= 5 ? 0 : .2 + g.R()), sw = w.reduce((a, b) => a + b, 0);
  const pickSvc = () => { let r = g.R() * sw, s = 0; while (s < w.length - 1 && r >= w[s]) r -= w[s++]; return SVC_K[s]; };
  // rc5：路格直接給 5 級的比例（其餘 1–5 均勻）；aim 偏貴，roadUpkeep 大、瞄準的 2 的冪高，後面各項加起來比較不會再跨過下一個 2 的冪
  const p = { aim, pRoad: g.f(.15, .45), rc5: aim ? g.f(.3, .7) : g.f(0, .3), pBld: g.f(.35, .7), pSvc: aim ? g.f(.005, .02) : g.f(.03, .25) };
  p.kind = () => { if (g.ch(p.pSvc)) return pickSvc(); const k = pickKind(g); return aim && (k === 4 || k === 5) ? 1 : k; };   // aim：隨機的不放公園、電廠
  return p;
}
// 37429 ROAD_UPKEEP 的抄本：只拿來算 aim 案例要放幾座公園、電廠（抄錯只會瞄不準；產樣本時跟實驗線的表核對）
const ROAD_UPKEEP_AIM = [0.01, 0.02, 0.05, 0.12, 0.35];
// 一張小城：路（等級 1–5，偶爾 0 或缺＝照 2 級維護）、建築（旗標、附屬格）、tickBld／tickRoad 索引、覆蓋、地價、教育
// big：N 24–40、路幾百格全是等級 1–5（roadUpkeep 是幾百個 .01／.02／.05／.12／.35 的浮點和）、六種設施每種至少一座
function genCity(g, fam, j) {
  const neutral = fam === 'neutral', N = neutral ? g.int(6, 12) : fam === 'big' ? g.int(24, 40) : g.int(4, 10), tiles = [], big = fam === 'big' ? bigParams(g) : null;
  for (let i = 0; i < N * N; i++) {
    const t = { bld: null };
    if (g.ch(big ? big.pRoad : .25)) { t.road = 1; if (neutral || big) t.rc = big && g.ch(big.rc5) ? 5 : g.int(1, 5); else { const r = g.R(); if (r < .08) t.rc = 0; else if (r >= .12) t.rc = g.int(1, 5); } }
    else if (g.ch(fam === 'sweep' ? .55 : big ? big.pBld : .45)) {
      if (neutral) {   // D011 蓋得出來的：住商工一、二級、電廠、警察局；沒有災害旗標
        const k = g.pick([1, 1, 1, 2, 2, 3, 3, 5, 11]), b = { k, lv: k <= 3 ? g.int(1, 2) : 1, v: g.int(0, 11), age: g.int(0, 40), pw: g.ch(.8) };
        if (k === 1) { b.den = g.int(1, 5); b.we = g.int(0, 2); }
        t.bld = b;
      } else { t.bld = genBld(g, big ? big.kind() : pickKind(g), fam === 'sweep' ? 5 : 3); if (g.ch(big ? .02 : .04)) t.bld.ref = [0, 0]; }
    }
    tiles.push(t);
  }
  if (fam === 'sweep') {   // 第 j 個案例輪到 ALL_K 的一段：每一種都當過根格
    for (let s = 0; s < 6; s++) {
      const k = ALL_K[(j * 6 + s) % ALL_K.length], i = g.int(0, N * N - 1), t = tiles[i];
      t.road = 0; delete t.rc; t.bld = genBld(g, k, 5);
    }
  }
  if (big) {   // 六種設施每種至少一座（蓋在沒有路、還沒放過的格子上，路格數不變）
    const pool = tiles.flatMap((t, i) => t.road ? [] : [i]), put = k => { tiles[pool.splice(g.int(0, pool.length - 1), 1)[0]].bld = genBld(g, k, 3); };
    for (const k of SVC_K) if (!(big.aim && k <= 5)) put(k);
    if (big.aim) {
      // 55973 前三項 roadUpkeep+parks*.5+plants*4 的部分和跨 2 的冪：r < P ≤ r+公園×.5 < 2P，4P ≤ r+公園×.5+電廠×4 < 8P（r 照 tickRoad 升序加，同 55970）。
      // r 的尾數在 r 的格距上；.5、4 的倍數只在跨 2 的冪時才捨入。第一次捨入掉一位、第二次再掉兩位，前三項換順序（roadUpkeep 挪到第三項）
      // 才可能差一個 ulp（約 1/8 的案例）；只各跨一個 2 的冪（2P ≤ … < 4P）時兩種順序逐位元相同（捨入到偶數，窮舉四種餘數可證），不用瞄那裡
      let r = 0;
      for (const t of tiles) if (t.road) r += ROAD_UPKEEP_AIM[t.rc - 1];
      const P = 2 ** (Math.floor(Math.log2(r)) + 1), parks = Math.ceil(2 * (P - r)) + g.int(0, 3), plants = Math.ceil((4 * P - (r + parks * .5)) / 4) + g.int(0, 1);
      if (parks + plants <= pool.length) { for (let n = 0; n < parks; n++) put(4); for (let n = 0; n < plants; n++) put(5); }
      else { put(4); put(5); }
    }
  }
  const bld = [], road = [];
  tiles.forEach((t, i) => { if (t.bld) bld.push(i); if (t.road) road.push(i); });
  const spawned = [];   // 當天新長的：從升序裡拿掉、接在最後（55623 tickBld.push）
  for (let s = 0, m = Math.min(bld.length, neutral ? g.int(0, 3) : g.pick([0, 0, 1, 2, 3])); s < m; s++) spawned.push(bld.splice(g.int(0, bld.length - 1), 1)[0]);
  if (!neutral && g.ch(.1)) { const e = tiles.flatMap((t, i) => !t.bld && !t.road ? [i] : []); if (e.length) insertSorted(bld, g.pick(e)); }   // 當天被清掉的（55879）
  if (!neutral && g.ch(.1)) { const e = tiles.flatMap((t, i) => !t.road ? [i] : []); if (e.length) insertSorted(road, g.pick(e)); }            // 路被拆掉的（55970 if(t.road)）
  const cov = () => Array.from({ length: N * N }, () => g.ch(.3) ? g.int(1, 3) : 0);
  const COV = { bus: cov(), post: cov(), fire: cov(), school: cov() };
  for (const f of ['parking', 'bank', 'freight', 'fire2', 'fireHQ']) if (g.ch(.6)) COV[f] = cov();
  const LAND = Array.from({ length: N * N }, () => g.ch(.2) ? 128 : g.int(0, 255)), EDU = Array.from({ length: N * N }, () => g.ch(.3) ? 0 : g.int(0, 255));
  return { N, tiles, tickBld: [...bld, ...spawned], tickRoad: road, COV, LAND, EDU, ...(big ? { aim: big.aim } : {}) };
}
function genPol(g) {
  if (g.ch(.3)) return null;
  const rate = () => g.pick([1, 1, 0, undefined, .5, 2, 1.5, .8, g.f(.5, 2)]);
  const p = { taxR: rate(), taxC: rate(), taxI: rate() };
  for (const k of POL_FLAGS) if (g.ch(.25)) p[k] = g.ch(.8) ? true : 1;
  return p;
}
// 其他收入、進口費：一半 0，其餘整數或帶小數。
// 注意：g.f 是 32 位元亂數乘上範圍，有效位數不到 40 位，十幾項相加仍是精確的，加總順序改了看不出來；big 家族改用兩位小數（money2）
const money3 = (g, a, b) => { const r = g.R(); return r < .5 ? 0 : r < .75 ? g.int(1, b) : g.f(a, b); };
// big：三成 0、兩成半整數、其餘兩位小數（二進位除不盡，53 位元都用上；實驗線 parkingRevenue491、powerUpkeep471 本來就是 toFixed(2)）
const money2 = (g, b) => { const r = g.R(); return r < .3 ? 0 : r < .55 ? g.int(1, b) : +g.f(0, b).toFixed(2); };
// 55990 服務預算四組讀的設施數（稅收迴圈數的消防、警察局、派出所、醫院之外）：big 家族一律不是 0
const BUDGET_KEYS = ['fs2', 'fhqN', 'crtN', 'clinics', 'am', 'mhN', 'schools', 'libraries', 'un', 'inN'];
// aim：都小（四組每種 1–2 座、其餘設施每種只有 1–5% 的機會有）；其他：四組每種 1 到 2–20 座（上限對數均勻），其餘設施的密度 0–3 成
// （四組占維護費大頭時，55990 四組換順序的差才留得到最後）
function bigCounts(g, aim) {
  const pc = aim ? g.f(.01, .05) : g.f(0, .3), n = aim ? 2 : Math.round(2 * 10 ** g.R()), m = aim ? 2 : 4;
  return Object.fromEntries(FIRST_LOOP_KEYS.map(k => [k, BUDGET_KEYS.includes(k) ? g.int(1, n) : g.ch(pc) ? g.int(1, m) : 0]));
}
// big 的服務預算：.50–1.50 但不取 1（52968 toFixed(2) 的格點）；side ±1＝四類同一邊（都加碼或都減碼，四組不互相抵銷），0＝各自隨機
const budgetNot1 = (g, side) => { if (side) return (100 + side * g.int(1, 50)) / 100; const v = g.int(0, 99); return (50 + v + (v >= 50 ? 1 : 0)) / 100; };
function genDay(g, fam, j) {
  const c = { family: fam, j, ...genCity(g, fam, j) }, neutral = fam === 'neutral', big = fam === 'big';
  c.tech = TECH.filter(() => g.ch(.3));
  c.spec = g.pick(SPECS);
  c.pol = neutral ? null : genPol(g);
  c.mul = neutral ? { goodsMul284: 1, commerceSalesMul481: 1, industrialMarketMul481: 1, indSupplyMul: 1, fuelTaxMul: 1, steelTaxMul: 1, freightTaxMul: 1, tourists: 0 } : {
    goodsMul284: g.ch(.4) ? 1 : g.f(.75, 1.25), commerceSalesMul481: g.ch(.3) ? 1 : g.f(.6, 1.1), industrialMarketMul481: g.pick([1, .78, g.f(.6, 1.2)]),
    indSupplyMul: g.ch(.5) ? 1 : g.f(.4, 1), fuelTaxMul: g.ch(.6) ? 1 : 1.1, steelTaxMul: g.ch(.5) ? 1 : 1.12, freightTaxMul: g.ch(.5) ? 1 : 1 + g.f(0, .08),
    tourists: g.ch(.5) ? 0 : g.int(1, 900) };
  // 夜間城市：沒就緒時 finance 照樣有值（驗「沒就緒就不讀」）
  c.night = { ready: !neutral && g.ch(.4), taxMul: g.f(1, 1.25), commerceGold: g.ch(.05) ? -g.f(0, 5) : g.ch(.5) ? 0 : g.f(0, 30), transitRevenue: g.ch(.5) ? 0 : g.f(0, 20), operatingCost: g.ch(.5) ? 0 : g.f(0, 15) };
  c.ent = [];   // 企業稅率係數（enterpriseTaxFactor489，0–1）：沒列的＝1
  if (!neutral && g.ch(.5)) for (const i of c.tickBld) if (g.ch(.3)) c.ent.push([i, g.pick([0, 1, g.R(), g.R()])]);
  const occv = () => g.pick([undefined, NaN, 1, .35, g.f(.2, 1.3), g.f(.2, 1.3)]);
  c.housing = neutral ? { off: true, occ: undefined } : { off: g.ch(.5), occ: g.ch(.15) ? null : g.ch(.15) ? undefined : { low: occv(), mid: occv(), high: occv(), social: occv() } };
  c.counts = big ? bigCounts(g, c.aim) : Object.fromEntries(FIRST_LOOP_KEYS.map(k => [k, neutral || g.ch(.6) ? 0 : g.int(1, 6)]));
  c.other = Object.fromEntries(OTHER_INCOME_KEYS.map(k => [k, neutral ? 0 : big ? money2(g, 200) : money3(g, 0, 200)]));
  // big 的進口費上限 10–5000（對數均勻；aim 固定 30）：進口合計跟維護費同一個量級以上時，56025 進口換順序的差才留得到最後
  const impMax = big ? (c.aim ? 30 : Math.round(10 * 500 ** g.R())) : 30;
  c.imports = Object.fromEntries(IMPORT_KEYS.map(k => [k, neutral ? 0 : big ? money2(g, impMax) : money3(g, 0, 30)]));
  c.metroRaw = neutral || g.ch(.6) ? [0, 0, 0] : [g.f(0, 300), g.f(0, 30), g.f(0, 100)];
  c.fees = neutral ? { policyDailyCost504: 0, powerUpkeep471: 0, waterUpkeep472: 0, infraUpkeep475: 0, transitDepotUpkeep501: 0, railOpsCost463: 0, busOpsCost468: 0 } : big ? {
    policyDailyCost504: g.ch(.5) ? 0 : g.int(1, 60), powerUpkeep471: g.ch(.3) ? 0 : +g.f(0, 80).toFixed(2), waterUpkeep472: g.ch(.3) ? 0 : g.int(1, 40),
    infraUpkeep475: g.ch(.3) ? 0 : +g.f(0, 20).toFixed(2), transitDepotUpkeep501: g.ch(.5) ? 0 : +g.f(0, 30).toFixed(2), railOpsCost463: g.ch(.5) ? 0 : +g.f(0, 40).toFixed(2),
    busOpsCost468: g.ch(.5) ? 0 : +g.f(0, 25).toFixed(2) } : {
    policyDailyCost504: g.ch(.7) ? 0 : g.int(1, 60), powerUpkeep471: g.ch(.6) ? 0 : +g.f(0, 80).toFixed(2), waterUpkeep472: g.ch(.6) ? 0 : g.int(1, 40),
    infraUpkeep475: g.ch(.6) ? 0 : +g.f(0, 20).toFixed(2), transitDepotUpkeep501: g.ch(.7) ? 0 : g.f(0, 30), railOpsCost463: g.ch(.7) ? 0 : g.f(0, 40), busOpsCost468: g.ch(.7) ? 0 : g.f(0, 25) };
  c.svcFleet = neutral || g.ch(.6) ? { fire: 3, police: 2, amb: 2 } : { fire: g.int(1, 12), police: g.int(1, 12), amb: g.int(1, 12) };
  const side = big ? g.pick([0, 0, 1, -1]) : 0, bud = () => big ? budgetNot1(g, side) : g.ch(.4) ? 1 : (50 + g.int(0, 100)) / 100;   // 52968：夾 .5–1.5、toFixed(2)
  c.svcBudget = { police: bud(), fire: bud(), health: bud(), edu: bud() };
  c.modeShare = {};
  if (!neutral) for (const k of ['bus', 'tram', 'rail', 'multimodal']) if (g.ch(.4)) c.modeShare[k] = g.ch(.2) ? 0 : g.f(0, 500);
  c.eventTax = neutral || g.ch(.45) ? null : g.pick(EVENT_TAX);
  c.emergencyLegacy = g.ch(.5);
  return c;
}
// 結算：錢、難度、貸款、里程碑與星等進度、日子與上次紓困；free 另給當天收支（結算不接收稅與維護費的結果）
function genSettle(g, c, free) {
  const s = { diff: g.pick([1, 1, 1, 1, 3, 3, 3, 0, 2]), msIdx: g.int(0, 8), bestStar: g.pick([-1, 0, 0, 1, 2, 3, 4, 5]) };
  const r = g.R();
  c.pop = r < .35 && s.msIdx < 8 ? MILE_POPS[s.msIdx] + g.pick([-1, 0, 0, 1, 2]) : r < .5 ? g.pick([49, 50, 51, 0, 10]) : r < .6 ? MILE_POPS[g.int(0, 7)] + g.pick([-1, 0]) : g.int(0, 9000);
  s.cityHappy = g.ch(.1) ? g.pick([0, 1, .5]) : g.f(0, 1.1);
  s.jobs = g.int(0, Math.max(1, Math.round(c.pop * 1.2)));
  s.day = g.int(2, 4000);
  s.bailoutDay = g.pick([-999, -999, s.day - 59, s.day - 60, s.day - 61, s.day - 62, s.day - 1]);
  s.loan = g.ch(.4) ? { remain: g.pick([1, 1, 2, 3, 5, 20, 40]), daily: g.pick([120, 150, g.int(1, 300)]) } : null;
  s.garbRatio = g.pick([2, 2, 1, null, .5, 1.25, 1.5, g.f(0, 3), 1.01]);
  if (c.family === 'neutral') s.garbRatio = 2;   // src/sim/day.ts：沒有垃圾場，垃圾比例 2（55260）
  if (free) {
    const net = g.pick([0, 0, 0, -0.01, 0.01, -5, 5, -g.f(0, 50), g.f(0, 50)]);
    s.upkeep = g.f(0, 200); s.income = net === 0 ? s.upkeep : s.upkeep + net;
    // 錢落在紓困門檻 20 附近（結算、還款之後；里程碑、星等獎金會再往上推）
    const target = 20 + g.pick([-0.01, 0, 0, 0.01, -1, 1, -30, 30, -5, -12]);
    s.money = target - (s.diff !== 3 ? s.income - s.upkeep : 0) + (s.loan ? s.loan.daily : 0);
    if (g.ch(.25)) { s.money = 20; s.income = s.upkeep; s.loan = null; c.pop = g.int(0, 49); s.bailoutDay = g.pick([-999, s.day - 61, s.day - 60]); }   // 錢剛好 20、淨額剛好 0
  } else s.money = g.pick([3000, g.f(-2000, 20000), 20, 19.5, 0, -100, g.f(-50, 60)]);
  c.settle = s;
}

// 第 k 個案例（0 ≤ k < D011_MONEY_COUNT）：每次呼叫都回新的物件
export function moneyCase(k) {
  let base = 0;
  for (const [name, count] of FAMILIES) {
    if (k < base + count) {
      const j = k - base, g = gen(seedOf(name, j)), c = genDay(g, name, j);
      genSettle(gen(seedOf(name + '#settle', j)), c, name === 'free' || name === 'sweep');
      return c;
    }
    base += count;
  }
  throw new Error(`D011 資金案例 ${k} 超出 ${D011_MONEY_COUNT}`);
}

// ---- 實驗線片段的單點突變：[名稱, 片段, 原文, 改成]。產樣本時每一個都要在某個案例對不上（不然就要列進等價清單並證明）----
// 浮點順序的幾個（數學上相等、捨入不同）：55973 roadUpkeep 挪到第三項、56025 兩個挪到最前只有 big 家族抓得到（前四族 2,200 組一組都沒有），
// 55990 消防組挪到最後前四族只有 1 組。原文由名單組出來，名單跟實驗線對不上＝錨點找不到，產樣本時就停
const G55990 = ['(fireStations*3+fs2*6+fhqN*10)*(svcBudget.fire-1)', '(policeStations*4+policeBoxes*1.5+crtN*6)*(svcBudget.police-1)',
  '(hospitals*5+clinics*2.5+am*4+mhN*16)*(svcBudget.health-1)', '(schools*2.5+libraries*2+un*8+inN*10)*(svcBudget.edu-1)'];
const lastFirst = a => [a[a.length - 1], ...a.slice(0, -1)], firstLast = a => [...a.slice(1), a[0]];
export const FLOAT_ORDER_MUTANTS = [
  ['維護 55973 roadUpkeep 第一項→第三項', 'tick 維護費', 'upkeep=roadUpkeep+parks*.5+plants*4+fireStations*3+', 'upkeep=parks*.5+plants*4+roadUpkeep+fireStations*3+'],
  ['維護 55973 roadUpkeep 先入帳、其餘另加', 'tick 維護費', 'upkeep=roadUpkeep+parks*.5+', 'upkeep=roadUpkeep;upkeep+=parks*.5+'],
  ['道路維護 55970 逐格反序', 'tick 維護費', 'for(const i of tickRoad){const t=tiles[i];if(t.road)roadUpkeep+=', 'for(const i of [...tickRoad].reverse()){const t=tiles[i];if(t.road)roadUpkeep+='],
  ['服務預算 55990 消防組挪到最後', 'tick 地鐵取整與服務費', `upkeep+=${G55990.join('+')};`, `upkeep+=${firstLast(G55990).join('+')};`],
  ['其他收入 56025 goodsExportGold481 挪到最前', 'tick 其他收入與進口', `income+=${OTHER_INCOME_KEYS.join('+')};`, `income+=${lastFirst(OTHER_INCOME_KEYS).join('+')};`],
  ['進口 56025 suppliesImportCost482 挪到最前', 'tick 其他收入與進口', `upkeep+=${IMPORT_KEYS.join('+')};`, `upkeep+=${lastFirst(IMPORT_KEYS).join('+')};`],
];
export const LAB_MUTANTS = [
  ['住宅稅 .12→.13', 'tick 稅收', 'residentPopulation488(i,b)*.12*(pm.taxR||1)*WEALTH_TAX[we]', 'residentPopulation488(i,b)*.13*(pm.taxR||1)*WEALTH_TAX[we]'],
  ['地價稅槓桿 .15→.16', 'tick 稅收', '(LAND[i]-128)/128*.15', '(LAND[i]-128)/128*.16'],
  ['商業 銀行 1.08→1.09', 'tick 稅收', '((COV.bank&&COV.bank[i]>0)?1.08:1)', '((COV.bank&&COV.bank[i]>0)?1.09:1)'],
  ['商業 遊客 /500→/400', 'tick 稅收', 'Math.min(.2,tourists/500)', 'Math.min(.2,tourists/400)'],
  ['商業 夜市 1.06→1.07', 'tick 稅收', 'nightCity487.commerce.taxMul:1.06;const v2=', 'nightCity487.commerce.taxMul:1.07;const v2='],
  ['商業 .18→.19', 'tick 稅收', 'JOBSC[b.lv]*.18*mult', 'JOBSC[b.lv]*.19*mult'],
  ['工業 .15→.16', 'tick 稅收', 'JOBSI[b.lv]*.15*(pm.taxI||1)', 'JOBSI[b.lv]*.16*(pm.taxI||1)'],
  ['工業 教育 .4→.5', 'tick 稅收', '(EDU[i]/255)*.4', '(EDU[i]/255)*.5'],
  ['稅收條件 漏 !b.riot', 'tick 稅收', 'else if(b.pw&&!b.fire&&!b.sick&&!b.death&&!b.abandoned&&!b.riot&&!b.plague){', 'else if(b.pw&&!b.fire&&!b.sick&&!b.death&&!b.abandoned&&!b.plague){'],
  ['社宅 .08→.09', 'tick 稅收', '*.08*(pm.taxR||1)*WEALTH_TAX[SOCIAL_HOUSING_WE]', '*.09*(pm.taxR||1)*WEALTH_TAX[SOCIAL_HOUSING_WE]'],
  ['市政廳 1.03→1.04', 'tick 稅收', 'const civicMul=chN>0?1.03:1;', 'const civicMul=chN>0?1.04:1;'],
  ['電廠計數 plants→parks', 'tick 稅收', 'else if(b.k===5)plants++;', 'else if(b.k===5)parks++;'],
  ['nI 計數 k3→k2', 'tick 稅收', 'if(b.k===3)nI++;', 'if(b.k===2)nI++;'],
  ['分支鏈 k57 不再排除（幽靈工業稅）', 'tick 稅收', 'else if(b.k===57);', 'else if(b.k===-57);'],
  ['分支鏈 81–120 → 82–120', 'tick 稅收', 'else if(b.k>=81&&b.k<=120&&b.k!==105&&b.k!==106);', 'else if(b.k>=82&&b.k<=120&&b.k!==105&&b.k!==106);'],
  ['夜市稅收鏡像 不加 taxC', 'tick 稅收', 'income+=nightCommerceGold487;taxC+=nightCommerceGold487;', 'income+=nightCommerceGold487;'],
  ['道路維護 預設等級 2→1', 'tick 維護費', 'ROAD_UPKEEP[(t.rc||2)-1]', 'ROAD_UPKEEP[(t.rc||1)-1]'],
  ['edu 專精費 /100→/90', 'tick 維護費', 'Math.round(pop/100)', 'Math.round(pop/90)'],
  ['法規費 保險 18→17', 'tick 維護費', '(pol&&pol.insurance?18:0)', '(pol&&pol.insurance?17:0)'],
  ['維護 派出所 1.5→1.4', 'tick 維護費', '+policeStations*4+policeBoxes*1.5+hospitals*5', '+policeStations*4+policeBoxes*1.4+hospitals*5'],
  ['維護 綜合醫院 16→15', 'tick 維護費', '+mhN*16+', '+mhN*15+'],
  ['維護 鋼鐵廠 13→14', 'tick 維護費', 'steelMillN*13', 'steelMillN*14'],
  ['維護 遊樂場 .8→.9', 'tick 維護費', 'play364*.8', 'play364*.9'],
  ['地鐵整合票價 .92→.93', 'tick 地鐵取整與服務費', 'metroRev=Math.round(metroRev*(pol&&pol.integratedTransit?.92:1))', 'metroRev=Math.round(metroRev*(pol&&pol.integratedTransit?.93:1))'],
  ['地鐵廣告不取整', 'tick 地鐵取整與服務費', 'metroAds=Math.round(metroAds);', 'metroAds=metroAds;'],
  ['車隊 −7→−6', 'tick 地鐵取整與服務費', 'svcFleet.amb-7)*.8', 'svcFleet.amb-6)*.8'],
  ['服務預算 研究院 10→11', 'tick 地鐵取整與服務費', 'un*8+inN*10)*(svcBudget.edu-1)', 'un*8+inN*11)*(svcBudget.edu-1)'],
  ['進口 漏 suppliesImportCost482', 'tick 其他收入與進口', '+steelImportCost482+suppliesImportCost482;', '+steelImportCost482;'],
  ['其他收入 漏 bankInt', 'tick 其他收入與進口', '+cookGold+bankInt+parkingRevenue491', '+cookGold+parkingRevenue491'],
  ['票務 .03→.04', 'tick 地面運輸', 'surfaceFareTrips468*.03', 'surfaceFareTrips468*.04'],
  ['多式聯運 .5→.6', 'tick 地面運輸', '(transit468.modeShare.multimodal||0)*.5', '(transit468.modeShare.multimodal||0)*.6'],
  ['城市活動 round→floor', 'tick 城市活動', 'income=Math.round(income*CITY_EVENTS[cityEvent.i].tax)', 'income=Math.floor(income*CITY_EVENTS[cityEvent.i].tax)'],
  ...FLOAT_ORDER_MUTANTS,
  ['沙盒 diff!==3→!==2', 'tick 結算後段', 'if(diff!==3)money+=income-upkeep;', 'if(diff!==2)money+=income-upkeep;'],
  ['貸款 <=0→<0', 'tick 結算後段', 'if(--loan.remain<=0)', 'if(--loan.remain<0)'],
  ['里程碑 >=→>', 'tick 結算後段', 'pop>=MILES[msIdx][0]', 'pop>MILES[msIdx][0]'],
  ['里程碑 一天最多一個（if→while）', 'tick 結算後段', 'if(msIdx<MILES.length&&pop>=MILES[msIdx][0]){', 'while(msIdx<MILES.length&&pop>=MILES[msIdx][0]){'],
  ['評分門檻 pop<50→<49', 'tick 結算後段', 'if(pop<50){', 'if(pop<49){'],
  ['就業分數 .6→.7', 'tick 結算後段', 'Math.max(1,pop*.6)', 'Math.max(1,pop*.7)'],
  ['消防分數 15→14', 'tick 結算後段', '(fireCoverN/fireTotalN)*15:15', '(fireCoverN/fireTotalN)*14:15'],
  ['垃圾分數 ×20→×25', 'tick 結算後段', '(garbScoreRatio452-1)*20', '(garbScoreRatio452-1)*25'],
  ['星等 /18→/20', 'tick 結算後段', 'Math.floor(score/18)', 'Math.floor(score/20)'],
  ['升星獎金 500→400', 'tick 結算後段', 'const bonus=cityStar*500;', 'const bonus=cityStar*400;'],
  ['紓困 >60→>=60', 'tick 結算後段', 'day-bailoutDay>60', 'day-bailoutDay>=60'],
  ['紓困 money<20→<=20', 'tick 結算後段', 'if(money<20&&', 'if(money<=20&&'],
  ['紓困 淨額<=0→<0', 'tick 結算後段', 'income-upkeep<=0&&day', 'income-upkeep<0&&day'],
];
// 等價突變：[名稱, 理由]（目前沒有；有的話產樣本時照列，守衛核對理由存在）
export const LAB_EQUIVALENT = [];

// ---- 以下只在直接執行本檔時跑（守衛 import 本檔只拿案例與名單）----
const PIECE_ORDER = ['clamp', 'sq', 'tq', 'POPS', 'JOBSC', 'JOBSI', 'DEN_POP', 'TOWER_MULT', 'TOWER_POP', 'MEGA_POP', 'MEGA_JOBS', 'TOWER_JOBS', 'WEALTH_TAX', 'ROAD_UPKEEP',
  'MILES', 'LMCFG309', 'SOCIAL_HOUSING_POP', 'housingBand488', 'residentCapacity488', 'residentEligible488', 'housingOccupancy488', 'residentPopulation488', 'T', 'idx', 'inMap',
  'getMaxRoadClass'];
// tick 的五段收支接在一個函式裡跑（片段之間只插記錄用的 const 與地鐵加總的 let）；結算後段另一個函式
const W1_SRC = P => `(function(tickBld,tickRoad,__metro){
${P['tick 稅收']}
const __tax=[income,taxR,taxC,taxI,parks,plants,fireStations,policeStations,policeBoxes,hospitals,nI,fs2n409,nightCommerceGold487];
${P['tick 維護費']}
let metroRev=__metro[0],metroAds=__metro[1],metroCost=__metro[2]; // 55978–55986 地鐵逐線迴圈沒摘：逐線加總（取整前）當輸入
${P['tick 地鐵取整與服務費']}
${P['tick 其他收入與進口']}
${P['tick 地面運輸']}
const __incomePre=income;
${P['tick 城市活動']}
return {tax:__tax,roadUpkeep,eduFee394,upReg,metro:[metroRev,metroAds,metroCost],transitRev,nightTransitRev487,nightOpsCost487,incomePre:__incomePre,income,upkeep};
})`;
const W2_SRC = P => `(function(income,upkeep,tickBld){
${P['tick 結算後段']}
})`;
function labEnv(P) {
  const ctx = vm.createContext({ window: {}, console });
  for (const name of PIECE_ORDER) vm.runInContext(P[name], ctx, { filename: 'lab:' + name });
  return { ctx, W1: vm.runInContext(W1_SRC(P), ctx, { filename: 'lab:W1' }), W2: vm.runInContext(W2_SRC(P), ctx, { filename: 'lab:W2' }) };
}
// 案例 → 實驗線全域值（tick 的區域變數也放在全域：片段自己宣告的 let／const 會蓋過去）
function globalsOf(c) {
  const s = c.settle, ent = new Map(c.ent), noop = () => {};
  return {
    N: c.N, tiles: c.tiles, COV: c.COV, LAND: c.LAND, EDU: c.EDU, pol: c.pol, tech343: { done: c.tech }, spec386: c.spec,
    window: { __noHousing488: c.housing.off }, housing488: c.housing.occ === null ? null : c.housing.occ === undefined ? {} : { occ: c.housing.occ },
    nightCity487: { ready: c.night.ready, commerce: { taxMul: c.night.taxMul }, finance: { commerceGold: c.night.commerceGold, transitRevenue: c.night.transitRevenue, operatingCost: c.night.operatingCost } },
    ...c.mul, enterpriseTaxFactor489: i => ent.has(i) ? ent.get(i) : 1,
    emergencyLegacy455: () => c.emergencyLegacy, emergencyCaseStatus455: (kind, i) => ({ ok: (i + kind.length) % 3 === 0 }),
    ...c.counts, tickRoadsN: c.tickRoad.length, tickBridgesN: 0, pop: c.pop,
    policyDailyCost504: () => c.fees.policyDailyCost504, powerUpkeep471: () => c.fees.powerUpkeep471, waterUpkeep472: () => c.fees.waterUpkeep472,
    infraUpkeep475: () => c.fees.infraUpkeep475, transitDepotUpkeep501: () => c.fees.transitDepotUpkeep501, railOpsCost463: c.fees.railOpsCost463, busOpsCost468: c.fees.busOpsCost468,
    svcFleet: { ...c.svcFleet }, svcBudget: { ...c.svcBudget }, ...c.other, ...c.imports, transit468: { modeShare: { ...c.modeShare } },
    cityEvent: c.eventTax === null ? null : { i: 0, daysLeft: 3 }, CITY_EVENTS: [{ tax: c.eventTax }],
    // 結算後段
    diff: s.diff, money: s.money, loan: s.loan ? { ...s.loan } : null, msIdx: s.msIdx, bestStar: s.bestStar, bailoutDay: s.bailoutDay, day: s.day, jobs: s.jobs, cityHappy: s.cityHappy,
    garbDecisionRatio452: () => s.garbRatio, region: null, computePower: () => 0, foodPoints: 0, GAME_VER: 'd011', syncWaterCap364: noop, wCap: 0,
    challenge: null, scenario: null, toast: noop, sFanfare: noop, spawnConfetti: noop, ACHS: [], ach: {}, achStats: null, trR: 0, trC: 0,
    parks: 0, plants: 0, fireStations: 0, policeStations: 0, policeBoxes: 0, hospitals: 0, nI: 0, bridges: 0, roads: 0,
    score: 77, cityStar: 77, scoreParts: null, townName: 'd011', cityPoints: 0, computeCityPoints: () => 0, rankIdx: 0, RANKS: [{ threshold: 0 }], buildToolbar: noop,
  };
}
function labRun(env, c) {
  Object.assign(env.ctx, globalsOf(c));
  const d = env.W1(c.tickBld, c.tickRoad, c.metroRaw), s = c.settle;
  env.W2(s.income ?? d.income, s.upkeep ?? d.upkeep, c.tickBld);
  const x = env.ctx, t = d.tax;
  return {
    day: { taxIncome: t[0], taxR: t[1], taxC: t[2], taxI: t[3], counts: t.slice(4, 12), nightCommerceGold487: t[12], roadUpkeep: d.roadUpkeep, eduFee394: d.eduFee394, upReg: d.upReg,
      metro: [...d.metro], transitRev: d.transitRev, nightTransitRev487: d.nightTransitRev487, nightOpsCost487: d.nightOpsCost487, incomePre: d.incomePre, income: d.income, upkeep: d.upkeep },
    settle: { money: x.money, loan: x.loan ? [x.loan.remain, x.loan.daily] : null, msIdx: x.msIdx, bestStar: x.bestStar, bailoutDay: x.bailoutDay, score: x.score, cityStar: x.cityStar },
  };
}

function main() {
  const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const LAB = path.resolve(arg('lab', path.join(ROOT, 'scratch/lab-src')));
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
  if (commit !== D011_MONEY_COMMIT) throw new Error(`D011 實驗線版本錯誤：要求 ${D011_MONEY_COMMIT}，目前 ${commit}`);
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
  const L = labSource(html);
  const t0 = Date.now();

  // ---- 片段 ----
  const P = {
    clamp: L.exact('clamp', 'const clamp=(v,a,b)=>v<a?a:(v>b?b:v);'),                                  // 37219
    sq: L.exact('sq', 'const sq=(id,on,off)=>spec386===id?on:off;'),                                    // 37851
    tq: L.decl('tq'),                                                                                     // 38549
    POPS: L.decl('POPS'), JOBSC: L.decl('JOBSC'), JOBSI: L.decl('JOBSI'), DEN_POP: L.decl('DEN_POP'),     // 37409–37412
    TOWER_MULT: L.decl('TOWER_MULT'), TOWER_POP: L.decl('TOWER_POP'), MEGA_POP: L.decl('MEGA_POP'), MEGA_JOBS: L.decl('MEGA_JOBS'), TOWER_JOBS: L.decl('TOWER_JOBS'),   // 37418–37422
    WEALTH_TAX: L.decl('WEALTH_TAX'), ROAD_UPKEEP: L.decl('ROAD_UPKEEP'), MILES: L.decl('MILES'), LMCFG309: L.decl('LMCFG309'),   // 37416、37429、37861、38129
    SOCIAL_HOUSING_POP: L.decl('SOCIAL_HOUSING_POP'),                                                     // 39460（連 SOCIAL_HOUSING_WE）
    housingBand488: L.fn('housingBand488'), residentCapacity488: L.fn('residentCapacity488'), residentEligible488: L.fn('residentEligible488'),
    housingOccupancy488: L.fn('housingOccupancy488'), residentPopulation488: L.fn('residentPopulation488'),   // 39476–39480
    T: L.exact('T', 'const T=i=>tiles[i];'), idx: L.exact('idx', 'const idx=(x,y)=>y*N+x;'), inMap: L.decl('inMap'),   // 39730–39732
    getMaxRoadClass: L.fn('getMaxRoadClass'),                                                             // 51181
    'tick 稅收': L.span('tick 稅收', '  let income=0,upkeep=0,roads=0,parks=0,plants=0,bridges=0,', '  const nightCommerceGold487=nightCity487.ready?nightCity487.finance.commerceGold:0;'),   // 55868–55968
    'tick 維護費': L.span('tick 維護費', '  let roadUpkeep=0;', '  upkeep+=transitDepotUpkeep501(); // T501'),   // 55969–55977
    'tick 地鐵取整與服務費': L.span('tick 地鐵取整與服務費', '  metroRev=Math.round(metroRev*(pol&&pol.integratedTransit?.92:1));', '  upkeep+=(fireStations*3+fs2*6+fhqN*10)*(svcBudget.fire-1)'),   // 55987–55990
    'tick 其他收入與進口': L.span('tick 其他收入與進口', '  income+=farmGold+ranchGold+procGold+ghGold+lodgeRev+mktGold',
      'upkeep+=goodsImportCost481+foodImportCost482+gasImportCost482+fuelImportCost482+steelImportCost482+suppliesImportCost482;'),   // 56025
    'tick 地面運輸': L.span('tick 地面運輸', '  const surfaceFareTrips468=(transit468.modeShare.bus||0)', 'income+=transitRev+nightTransitRev487;upkeep+=busOpsCost468+nightOpsCost487;'),   // 56026–56027
    'tick 城市活動': L.exact('tick 城市活動', '  if(cityEvent){income=Math.round(income*CITY_EVENTS[cityEvent.i].tax);} // T299：城市事件稅收加成（旅遊/繁榮 +25~30%；無事件 ×1）'),   // 56028
    'tick 結算後段': L.spanUntil('tick 結算後段', '  if(diff!==3)money+=income-upkeep; // T115', '  checkHints(plants,roads);'),   // 56053–56145
  };
  // 只拿來核對表的片段（放進另一個環境：這些名字在主環境裡是樁）
  const TP = { CITY_EVENTS: L.spanUntil('CITY_EVENTS', 'const CITY_EVENTS=[', 'let cityEvent=null; // T299'), DIFF_MONEY: L.decl('DIFF_MONEY'), svcFleet: L.decl('svcFleet') };
  const tctx = vm.createContext({});
  for (const [name, src] of Object.entries(TP)) vm.runInContext(src, tctx, { filename: 'lab:' + name });
  const env = labEnv(P), labTables = vm.runInContext('({CITY_EVENTS,DIFF_MONEY,svcFleet})', tctx), mainTables = vm.runInContext('({WEALTH_TAX,ROAD_UPKEEP,MILES,LMCFG309,SOCIAL_HOUSING_WE,MEGA_JOBS,TOWER_JOBS})', env.ctx);
  const tables = {
    roadUpkeep: [...mainTables.ROAD_UPKEEP], wealthTax: [...mainTables.WEALTH_TAX], miles: mainTables.MILES.map(m => [...m]), lmcfg309: Object.keys(mainTables.LMCFG309).map(Number),
    socialHousingWe: mainTables.SOCIAL_HOUSING_WE, megaJobs: mainTables.MEGA_JOBS, towerJobs: mainTables.TOWER_JOBS,
    diffMoney: [...labTables.DIFF_MONEY], svcFleet: { ...labTables.svcFleet },
    cityEventTax: [...new Set(labTables.CITY_EVENTS.map(e => e.tax))].sort((a, b) => a - b),
  };
  // 案例的名單要跟實驗線的表一致：抄錯就不產樣本
  if (canon(tables.cityEventTax) !== canon([...EVENT_TAX].sort((a, b) => a - b))) throw new Error(`EVENT_TAX 與實驗線 CITY_EVENTS 的稅率不一致：${tables.cityEventTax.join(',')}`);
  if (canon(tables.miles.map(m => m[0])) !== canon(MILE_POPS)) throw new Error('MILE_POPS 與實驗線 MILES 不一致');
  if (canon(tables.roadUpkeep) !== canon(ROAD_UPKEEP_AIM)) throw new Error('ROAD_UPKEEP_AIM 與實驗線 ROAD_UPKEEP 不一致');

  // ---- 逐案例求值＋覆蓋率統計 ----
  const exact = { day: [], settle: [] };
  const cov = { rci: {}, den: {}, we: {}, hazard: {}, unpowered: 0, special: {}, social127Blocked: 0, kinds: new Set(), refRoots: 0, staleBld: 0, spawned: 0,
    nightMarketReady: 0, nightMarketNotReady: 0, tourists: 0, freightMul: 0, noParking: 0, entFactor: 0, housingOcc: 0, eventOn: 0, eventOff: 0, eventRounded: 0,
    roadRc: {}, budgetNot1: 0, fleetNot1: 0, polFlags: {}, tech: {}, spec: {}, nightGold: 0, metro: 0, transit: 0, importsFloat: 0,
    diff: {}, loanPaid: 0, loanClosed: 0, milestone: 0, milestoneAtThreshold: 0, milestoneJustBelow: 0, noScore: 0, starBonus: 0, starEqual: 0,
    bailout: 0, bailoutGap60: 0, bailoutNetPos: 0, money20: 0, netZero: 0, nanIncome: 0, neutral: 0,
    big: 0, bigRoadsMin: 0, bigSvcAll: 0, bigBudgetAll: 0, bigStraddle: 0, bigFrac: 0 };
  const inc = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
  const lg2 = x => Math.floor(Math.log2(x));
  for (let k = 0; k < D011_MONEY_COUNT; k++) {
    const c = moneyCase(k), s = c.settle, before = { money: s.money, msIdx: s.msIdx, bestStar: s.bestStar, bailoutDay: s.bailoutDay, loan: s.loan && { ...s.loan } };
    const o = labRun(env, c);
    exact.day.push(canon(o.day)); exact.settle.push(canon(o.settle));
    // 統計（只統計，不影響輸出）
    if (c.family === 'neutral') cov.neutral++;
    if (c.family === 'big') {   // 大城：路格數、六種設施都有、55990 四組都有且預算不是 1、55973 前三項跨 2 的冪（位元差可能出現的型態）、收入與進口的兩位小數
      const roads = c.tickRoad.filter(i => c.tiles[i].road).length, [r, p, q] = [o.day.roadUpkeep, o.day.counts[0] * .5, o.day.counts[1] * 4];
      const a = lg2(r + p) - lg2(r), b = lg2(r + p + q) - lg2(r);
      cov.bigRoadsMin = cov.big++ ? Math.min(cov.bigRoadsMin, roads) : roads;
      if (o.day.counts.slice(0, 6).every(v => v > 0)) cov.bigSvcAll++;
      if (Object.values(c.svcBudget).every(v => v !== 1) && BUDGET_KEYS.every(k => c.counts[k] > 0)) cov.bigBudgetAll++;
      if (a >= 1 && b > a && !(a === 1 && b === 2)) cov.bigStraddle++;
      if (OTHER_INCOME_KEYS.filter(k => c.other[k] % 1).length >= 3 && IMPORT_KEYS.filter(k => c.imports[k] % 1).length >= 2) cov.bigFrac++;
    }
    const seen = new Set();
    for (const i of c.tickBld) {
      const b = c.tiles[i].bld;
      if (!b) { cov.staleBld++; continue; }
      if (b.ref) { cov.refRoots++; continue; }
      if (seen.has(i)) continue; seen.add(i);
      cov.kinds.add(b.k);
      const clean = b.pw && !HAZARDS.some(([h]) => b[h]);
      if (b.k <= 3 && b.k >= 1) {
        if (!b.pw) cov.unpowered++;
        for (const [h] of HAZARDS) if (b.pw && b[h]) inc(cov.hazard, h);
        if (clean) { inc(cov.rci, `${b.k}.${b.lv}`); if (b.k === 1) { inc(cov.den, String(b.den)); inc(cov.we, String(b.we)); }
          if (b.k === 2 && c.pol?.nightMarket) c.night.ready ? cov.nightMarketReady++ : cov.nightMarketNotReady++;
          if (b.k === 2 && c.mul.tourists > 0) cov.tourists++;
          if (b.k === 2 && c.COV.freight?.[i] > 0 && c.mul.freightTaxMul !== 1) cov.freightMul++;
          if (b.k === 2 && !c.COV.parking) cov.noParking++;
          if (b.k === 1 && !c.housing.off && c.housing.occ) cov.housingOcc++; }
      }
      if (SPECIAL_K.includes(b.k)) { if (b.k !== 127 || (clean && b.wa)) inc(cov.special, b.k); else cov.social127Blocked++; }
      if (c.ent.some(([e, f]) => e === i && f !== 1)) cov.entFactor++;
    }
    if (c.tickBld.some((v, j) => j > 0 && c.tickBld[j - 1] > v)) cov.spawned++;   // 有當天新長的接在最後（不再是升序）
    for (const i of c.tickRoad) { const t = c.tiles[i]; if (t.road) inc(cov.roadRc, String(t.rc)); }
    if (c.eventTax === null) cov.eventOff++; else { cov.eventOn++; if (o.day.income !== o.day.incomePre) cov.eventRounded++; }
    if (Object.values(c.svcBudget).some(v => v !== 1)) cov.budgetNot1++;
    if (c.svcFleet.fire + c.svcFleet.police + c.svcFleet.amb !== 7) cov.fleetNot1++;
    for (const f of POL_FLAGS) if (c.pol?.[f]) inc(cov.polFlags, f);
    for (const t of c.tech) inc(cov.tech, t);
    inc(cov.spec, c.spec || '(none)');
    if (o.day.nightCommerceGold487 > 0) cov.nightGold++;
    if (o.day.metro.some(v => v !== 0)) cov.metro++;
    if (o.day.transitRev !== 0) cov.transit++;
    if (IMPORT_KEYS.some(k => c.imports[k] % 1 !== 0)) cov.importsFloat++;
    if (Number.isNaN(o.day.income)) cov.nanIncome++;
    const st = o.settle, net = (s.income ?? o.day.income) - (s.upkeep ?? o.day.upkeep);
    inc(cov.diff, String(s.diff));
    if (net === 0) cov.netZero++;
    if (before.loan) { cov.loanPaid++; if (st.loan === null) cov.loanClosed++; }
    if (st.msIdx !== before.msIdx) { cov.milestone++; if (c.pop === MILE_POPS[before.msIdx]) cov.milestoneAtThreshold++; }
    else if (before.msIdx < 8 && c.pop === MILE_POPS[before.msIdx] - 1) cov.milestoneJustBelow++;
    if (c.pop < 50) cov.noScore++;
    else if (st.bestStar !== before.bestStar) cov.starBonus++;
    else if (st.cityStar === before.bestStar) cov.starEqual++;
    const bailed = st.bailoutDay !== before.bailoutDay, pre = bailed ? st.money - 250 : st.money;
    if (bailed) cov.bailout++;
    else if (pre < 20 && net <= 0 && s.day - before.bailoutDay === 60) cov.bailoutGap60++;
    else if (pre < 20 && net > 0 && s.day - before.bailoutDay > 60) cov.bailoutNetPos++;
    if (pre === 20 && net <= 0 && s.day - before.bailoutDay > 60) cov.money20++;
  }
  // 覆蓋率門檻：住商工每一級、密度 1–5、財富 0–2、沒電與每一種災害旗標、專屬稅分支、0–200 每一種都當過根格、結算的每一個門檻都碰過
  const need = [];
  for (const k of [1, 2, 3]) for (const lv of [1, 2, 3]) if ((cov.rci[`${k}.${lv}`] || 0) < 100) need.push(`k${k} lv${lv} 課稅 ${cov.rci[`${k}.${lv}`] || 0}`);
  for (const d of ['1', '2', '3', '4', '5', 'undefined']) if ((cov.den[d] || 0) < 30) need.push(`den ${d}`);
  for (const w of ['0', '1', '2', 'undefined']) if ((cov.we[w] || 0) < 30) need.push(`we ${w}`);
  for (const [h] of HAZARDS) if ((cov.hazard[h] || 0) < 30) need.push(`災害 ${h} ${cov.hazard[h] || 0}`);
  for (const k of SPECIAL_K) if ((cov.special[k] || 0) < 20) need.push(`專屬稅 k${k} ${cov.special[k] || 0}`);
  const missK = ALL_K.filter(k => !cov.kinds.has(k));
  if (missK.length) need.push(`種類沒當過根格：${missK.join(',')}`);
  for (const r of ['0', '1', '2', '3', '4', '5', 'undefined']) if ((cov.roadRc[r] || 0) < 50) need.push(`路 rc ${r}`);
  for (const f of POL_FLAGS) if ((cov.polFlags[f] || 0) < 50) need.push(`pol.${f}`);
  for (const t of TECH) if ((cov.tech[t] || 0) < 50) need.push(`tech ${t}`);
  for (const d of ['0', '1', '2', '3']) if ((cov.diff[d] || 0) < 100) need.push(`diff ${d}`);
  const floor = { unpowered: 300, social127Blocked: 20, refRoots: 50, staleBld: 50, spawned: 300, nightMarketReady: 30, nightMarketNotReady: 30, tourists: 200, freightMul: 50,
    noParking: 200, entFactor: 200, housingOcc: 200, eventOn: 500, eventOff: 500, eventRounded: 400, budgetNot1: 1000, fleetNot1: 300, nightGold: 300, metro: 300, transit: 300,
    importsFloat: 300, loanPaid: 500, loanClosed: 100, milestone: 300, milestoneAtThreshold: 100, milestoneJustBelow: 50, noScore: 300, starBonus: 200, starEqual: 50,
    bailout: 100, bailoutGap60: 20, bailoutNetPos: 20, money20: 30, netZero: 300, neutral: 200,
    big: 500, bigRoadsMin: 80, bigSvcAll: 500, bigBudgetAll: 500, bigStraddle: 200, bigFrac: 300 };
  for (const [key, n] of Object.entries(floor)) if (cov[key] < n) need.push(`${key} ${cov[key]}＜${n}`);
  if (need.length) throw new Error(`案例覆蓋不足：${need.join('；')}`);

  // ---- 實驗線片段單點突變：每一個都要在某個案例對不上 ----
  const labMutants = [];
  for (const [name, piece, from, to] of LAB_MUTANTS) {
    if (!P[piece]) throw new Error(`突變片段不存在：${piece}`);
    if (P[piece].split(from).length !== 2) throw new Error(`突變錨點不是剛好一處：${name}「${from}」`);
    const envM = labEnv({ ...P, [piece]: P[piece].replace(from, to) });
    let hit = null;
    for (let k = 0; k < D011_MONEY_COUNT && !hit; k++) {
      const o = labRun(envM, moneyCase(k));
      for (const part of ['day', 'settle']) if (!hit && canon(o[part]) !== exact[part][k]) hit = { case: k, part, out: canon(o[part]) };
    }
    if (!hit && !LAB_EQUIVALENT.some(([n]) => n === name)) throw new Error(`實驗線突變沒有案例抓得到：${name}`);
    labMutants.push({ name, piece, from, to, ...(hit ?? { equivalent: true }) });
  }

  const pack = a => gzipSync(Buffer.from(JSON.stringify(a)), { level: 9, mtime: 0 }).toString('base64');
  const coverage = { ...cov, kinds: cov.kinds.size };
  const out = {
    source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, tool: 'tools/lab-money.mjs',
      how: '實驗線 index.html 摘出的原始碼片段在 Node vm 裡求值：tick() 的收稅（55868–55968）、維護費（55969–55977、55987–55990）、其他收入與進口（56025）、地面運輸（56026–56027）、城市活動取整（56028）接成一個函式；結算後段（56053–56145）另一個函式。片段一個字都不改；地鐵逐線迴圈（55978–55986）沒摘，逐線加總當輸入；第 2 類系統的乘數、進口費、其他收入、第一個計數迴圈的設施數、挑戰／場景（null）、成就（空）、畫面與音效換成樁。案例由本檔 moneyCase()（D011_MONEY_SEED）產生；big 家族（大城：路幾百格、設施數多、收入與進口帶兩位小數、公園電廠數瞄準 2 的冪）讓 55970／55973／55990／56025 的浮點加總順序看得出來；每個案例的收支（day）與結算（settle）各用 canon() 存成字串，gzip 壓縮後放 exact.outputs。labMutants：實驗線片段的單點突變與它第一個對不上的案例、突變後的輸出',
      casesSha256: crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
      pieces: L.pieces },
    seed: D011_MONEY_SEED, families: FAMILIES, count: D011_MONEY_COUNT, tables, coverage, labMutants,
    exact: { codec: 'gzip+base64+json-canon-array', outputs: { day: pack(exact.day), settle: pack(exact.settle) } },
  };
  const json = JSON.stringify(out);
  if (/https?:\/\//.test(json)) throw new Error('樣本裡不能有外部網址（零外部素材守衛）');
  fs.writeFileSync(path.join(ROOT, 'src/content/samples/d011-money.json'), json);
  console.log(`D011 資金樣本：${D011_MONEY_COUNT} 組（${FAMILIES.map(([n, c]) => `${n} ${c}`).join('、')}）；片段 ${L.pieces.length} 段；實驗線突變 ${labMutants.length} 個（等價 ${labMutants.filter(m => m.equivalent).length}）；${(json.length / 1024).toFixed(0)} KB；${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('覆蓋：' + JSON.stringify(coverage));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

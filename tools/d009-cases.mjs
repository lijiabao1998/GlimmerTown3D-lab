// D009 對拍的隨機輸入（實驗線那邊 tools/lab-rules.mjs 與本線 tools/unit.mjs 共用）：同一個種子產生同一批案例。
// 每個案例都是新建的物件（公式會改格子：長出建築、帶電、升級），兩邊各自產生、互不共用。
// 輸出一律過 canon() 轉成字串再雜湊：-0、NaN、Infinity、undefined 都保留（逐項相等＝Object.is）。
import crypto from 'node:crypto';
import { mulberry32 } from '../src/sim/rng.ts';
import { JOB_KEYS } from '../src/sim/rules/jobs.ts';

export const D009_SEED = 20260925;
export const COUNTS = { F1: 2000, F2: 2000, F3: 2000, F4: 2000, F5: 300, F6: 300, F7: 2000, F8: 2000, F9: 200, F10: 50, F11: 200 };

export function canon(v) {
  if (v === undefined) return '~u';
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : Number.isNaN(v) ? 'NaN' : v === Infinity ? 'Inf' : v === -Infinity ? '-Inf' : String(v);
  if (typeof v === 'boolean' || v === null) return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
export const hashOf = v => crypto.createHash('sha256').update(canon(v)).digest('hex').slice(0, 16);

function gen(seed) {
  const R = mulberry32(seed);
  const int = (a, b) => a + Math.floor(R() * (b - a + 1)), f = (a, b) => a + R() * (b - a), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  // 邊界值混進來：剛好在門檻上的值最容易抓到 < 與 <= 的差別
  const edge = (vals, a, b) => ch(.2) ? pick(vals) : f(a, b);
  return { R, int, f, ch, pick, edge };
}

// 實驗線直接存取（沒有 && 保護）的覆蓋場一定要有；其餘隨機缺整張
export const COV_ALWAYS = ['police', 'police2', 'fire', 'fire2', 'fireHQ', 'school', 'hospital', 'clinic', 'library', 'post', 'park', 'cpark', 'gpark', 'play', 'botanical', 'rdec', 'bus', 'stadium', 'museum', 'faith', 'theater', 'cinema', 'plant'];
export const COV_MAYBE = ['stadium2', 'kindergarten', 'senior', 'market', 'dogpark', 'icerink', 'skate', 'pool', 'chapel', 'vet', 'cgarden', 'artcamp', 'admincamp', 'researchcamp', 'civicc', 'kitchen', 'university', 'grandlib', 'institute'];
const TECH = ['A5', 'A7', 'C2', 'B1', 'B4a', 'B6', 'B8', 'C4b', 'C7', 'D6', 'D8', 'X9'];
const BLD_K = [1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 5, 7, 9, 33, 34, 105, 106, 127, 58, 25];

// 隨機小城：格子＋逐格場
export function genWorld(g, N = g.int(6, 16)) {
  const { int, f, ch, pick } = g, n = N * N, tiles = [];
  for (let i = 0; i < n; i++) {
    const t = {};
    if (ch(.35)) { t.road = 1; if (ch(.15)) t.hw = 1; if (ch(.6)) t.rp = true; t.rc = int(1, 5); }
    if (ch(.5)) t.zone = int(1, 3);
    if (!t.road && ch(.35)) {
      const b = { k: pick(BLD_K), lv: int(1, 3), v: int(0, 11), age: int(0, 40), pw: ch(.8), wa: ch(.7), h: ch(.2) ? pick([.45, .44, .46]) : f(0, 1) };
      if (ch(.5)) b.den = int(1, 5);
      if (ch(.6)) b.we = int(0, 2);
      if (ch(.05)) b.fire = 1;
      if (ch(.12)) b.crime = 1;
      if (ch(.05)) b.sick = 1;
      if (ch(.03)) b.death = 1;
      if (ch(.05)) b.ref = [0, 0];
      t.bld = b;
    } else t.bld = null;
    if (ch(.05)) t.ruin = 1;
    if (ch(.1)) t.office = 1;
    tiles.push(t);
  }
  const arr = (fn) => Array.from({ length: n }, fn);
  const COV = {};
  for (const k of COV_ALWAYS) COV[k] = arr(() => ch(.3) ? int(1, 3) : 0);
  for (const k of COV_MAYBE) if (ch(.6)) COV[k] = arr(() => ch(.3) ? int(1, 3) : 0);
  const fields = {
    COV,
    LAND: arr(() => ch(.2) ? 128 : int(40, 230)), POL: arr(() => ch(.5) ? 0 : ch(.2) ? 15 : int(0, 40)), NOISE: arr(() => ch(.5) ? 0 : int(0, 60)),
    EDU: arr(() => ch(.4) ? 0 : int(0, 255)), commutePenalty: arr(() => ch(.7) ? 0 : f(0, .2)),
    METRO_TOD467B: arr(() => ch(.85) ? 0 : int(1, 20)), ACCESS468: arr(() => ch(.85) ? 0 : int(1, 20)),
  };
  return { N, tiles, fields };
}
export const tickIndex = w => ({ tickBld: w.tiles.flatMap((t, i) => t.bld ? [i] : []), tickZone: w.tiles.flatMap((t, i) => t.zone ? [i] : []) });

// ---- 各公式的案例（第 k 個案例由 D009_SEED 與公式、序號決定）----
const sub = (name, k) => (D009_SEED ^ (name.charCodeAt(1) * 7919 + k * 104729)) >>> 0;
export const cases = {
  F1: k => { const g = gen(sub('F1', k)), { int, f, ch, pick, edge } = g;
    return { pop: ch(.5) ? int(0, 5000) : f(0, 5000), jobs: ch(.5) ? int(0, 5000) : f(0, 5000), cityHappy: edge([.6, .4, .68, 1, 0], 0, 1), czone: int(0, 300),
      jobsC: int(0, 3000) + (ch(.3) ? .5 : 0), jobsI: int(0, 3000), indSubsidy: ch(.3), tech: TECH.filter(() => ch(.3)) }; },
  F2: k => { const g = gen(sub('F2', k)), { int, f, ch } = g, day = int(1, 900);
    return { p: ch(.5) ? int(0, 6000) : f(0, 6000), j: ch(.1) ? -int(0, 50) : ch(.5) ? int(0, 6000) : f(0, 6000), day,
      ent: ch(.4) ? null : { ready: ch(.7), day: ch(.7) ? day : day - 1, rollback: ch(.2), cityEmployed: ch(.1) ? undefined : f(0, 5000) } }; },
  F3: k => { const g = gen(sub('F3', k)), { f, ch, edge } = g;
    return { lr: f(-1.2, 1.2), lc: f(-1.2, 1.2), li: f(-1.2, 1.2), labor: { employmentRate: edge([.9, 1, .8], 0, 1.1), wageIndex: edge([1, 1.4, .6], .5, 1.6) },
      econ: ch(.3) ? null : { ready: ch(.8), consumption: { purchasingPower: edge([1, 1.35], .4, 1.5) }, commerce: { utilization: edge([.72, 1.17], 0, 1.5) },
        goods: { stockRatio: edge([.62, 1], 0, 2), shortageRatio: f(0, 1) }, trade: { exportSignal: f(-1, 1) }, production: { marketMul: f(.6, 1.4) } } }; },
  F4: k => { const g = gen(sub('F4', k)), { int, f, ch, edge } = g;
    return { legacy: f(-1.2, 1.2), housing: ch(.3) ? null : { ready: ch(.8), aggregateDemand: f(-1, 1) }, immWave: ch(.5) ? 0 : int(1, 6),
      pop: ch(.3) ? 151 : int(0, 2000), day: ch(.4) ? 45 * int(1, 20) : int(1, 900), cityHappy: edge([.68, .69, .62], .3, 1), demR: edge([.2, .21], -1, 1), mob: ch(.5) ? null : f(-.3, .3) }; },
  F5: k => { const g = gen(sub('F5', k)), w = genWorld(g), { f, ch, int, edge } = g;
    return { w, dem: { 1: edge([-.5, -.51, .15], -1, 1), 2: edge([-.5, -.51], -1, 1), 3: edge([-.5, -.51], -1, 1) }, cityHappy: edge([.4, .39, .6], 0, 1), demoMul: f(.6, 1.6), seed: int(1, 1e9) }; },
  F6: k => { const g = gen(sub('F6', k)), w = genWorld(g), { f, ch, int, edge, pick } = g;
    const ageBoost = ch(.7) ? int(10, 30) : 0;   // 多數建築推過屋齡 14 的門檻，升級那串 && 才會走到擲骰
    for (const t of w.tiles) if (t.bld) t.bld.age += ageBoost;
    return { w, dem: { 1: edge([.15, .16], -1, 1), 2: edge([.15, .16], -1, 1), 3: edge([.15, .16], -1, 1) }, sewNeed: ch(.3), sewOk: Array.from({ length: w.N * w.N }, () => ch(.5) ? 1 : 0),
      tech: TECH.filter(() => ch(.3)), seed: int(1, 1e9) }; },
  F7: k => { const g = gen(sub('F7', k)), { int, f, ch, pick, edge } = g, c = {};
    for (const n of COV_ALWAYS) c[n] = ch(.3) ? int(1, 3) : 0;
    for (const n of COV_MAYBE) c[n] = ch(.6) ? (ch(.3) ? int(1, 3) : 0) : undefined;
    return { c, POL: ch(.5) ? 0 : f(0, 60), NOISE: ch(.3) ? undefined : f(0, 80), commutePenalty: ch(.3) ? undefined : ch(.5) ? 0 : f(0, .3),
      we: ch(.3) ? undefined : int(0, 2), k: pick([1, 1, 1, 127]), lv: int(1, 3), pw: ch(.8), sick: ch(.1) ? 1 : 0, death: ch(.05) ? 1 : 0,
      ind: ch(.5) ? 0 : int(0, 12), crime: ch(.6) ? 0 : int(0, 8), rc: int(0, 5), jam: ch(.6) ? 0 : int(0, 10), drainPen: ch(.7) ? 0 : f(0, .1),
      waterLegacy: ch(.5), waterPen: ch(.5) ? 0 : f(0, .1), deathPenalty: ch(.1), sewNeed: ch(.3), sewOk: ch(.5), weather: int(0, 2), day: int(1, 1500),
      nightCity: { ready: ch(.5), happinessDelta: f(-.05, .05) }, housingPen: ch(.5) ? 0 : f(0, .065), eventHappy: ch(.8) ? null : f(-.1, .1), cookedReady: ch(.5),
      pol: ch(.4) ? null : { freeTransit: ch(.5), parkNight: ch(.5), curfew: ch(.5) }, rankIdx: int(0, 30), tvSignal: ch(.3), tech: TECH.filter(() => ch(.3)) }; },
  F8: k => { const g = gen(sub('F8', k)), { int, f, ch, pick } = g;
    const b = ch(.05) ? null : { k: pick([1, 1, 1, 2, 3, 33, 105, 127, 5]), lv: int(0, 3), v: 0, age: 0, pw: ch(.8), wa: ch(.7), sick: ch(.1) ? 1 : 0, death: ch(.05) ? 1 : 0 };
    if (b && ch(.6)) b.den = int(1, 5); if (b && ch(.05)) b.ref = [0, 0];
    const counts = Object.fromEntries(JOB_KEYS.map(n => [n, ch(.7) ? 0 : int(0, 20) + (n === 'jobsC' && ch(.3) ? .5 : 0)]));
    return { b, occ: ch(.3) ? null : { low: f(.2, 1.1), mid: ch(.1) ? NaN : f(.2, 1.1), high: f(.2, 1.1), social: f(.2, 1.1) }, office: ch(.2), counts }; },
  F9: k => { const g = gen(sub('F9', k)); return { w: genWorld(g), picks: Array.from({ length: 40 }, () => [g.int(1, 3), g.int(1, 3), g.int(0, 11)]) }; },
  F10: k => { const g = gen(sub('F10', k)); return { weather: g.int(0, 2), wxT: g.int(1, 8), day0: g.int(1, 720), days: 400, seed: g.int(1, 1e9) }; },
  F11: k => { const g = gen(sub('F11', k)), snake = g.ch(.3), w = genWorld(g, snake ? g.int(30, 40) : g.int(8, 24)), { ch, pick, int } = g;
    if (snake) {   // 蛇形長路（幾百格）＋起點旁一座燃煤電廠：帶電距離 90 格的上限要真的碰得到
      const N = w.N; let turn = 0;
      for (let y = 1; y < N - 1; y += 3) { for (let x = 1; x < N - 1; x++) w.tiles[y * N + x] = { road: 1, rc: 1, bld: null };
        const ex = turn++ % 2 ? 1 : N - 2; for (let d = 1; d < 3 && y + d < N - 1; d++) w.tiles[(y + d) * N + ex] = { road: 1, rc: 1, bld: null }; }
      w.tiles[1 * N + 0] = { bld: { k: 5, lv: 1, v: 0, age: 0 } };
    }
    // 供電：再撒一些電源（含 3×3 核電與不能啟網的太陽能、風力）、少數手工配電線
    for (let i = 0; i < w.tiles.length; i++) { const t = w.tiles[i]; if (!t.road && !t.bld && ch(.02)) t.lv475 = 1; if (!t.road && !t.bld && ch(.01)) t.ud475 = 1; }
    const nSrc = int(0, 4);
    for (let s = 0; s < nSrc; s++) { const i = int(0, w.tiles.length - 1), t = w.tiles[i]; if (t.road) continue; t.bld = { k: pick([5, 5, 5, 58, 60, 62, 25, 26, 150]), lv: int(1, 3), v: 0, age: 0 }; if (t.bld.k === 58 && ch(.7)) t.bld.sz = 3; }
    return { w, season: int(0, 3), ecoReg: ch(.3) }; },
};

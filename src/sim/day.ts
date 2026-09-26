// 逐日推進（D010）：把 D009 的生長核心公式（src/sim/rules/）照實驗線 tick() 的順序接起來。這裡只接線，不寫公式。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號（每一步都註明；tick() 是 54945–56192）。
// 沒搬的上層系統分三類（名單與理由見 docs/D010-starter-city.md「上層系統」一節）：
//   1. 實驗線有開關：本線接它關掉時的回退值（對照的 fallback 設定也用實驗線自己的開關關掉）——住房市場 T488、企業 T489、
//      T471 分時調度（舊版供電 __legacyPower450／__legacyPower471）、行動力 T491／T509、財政回饋 T510／T515、事故 T493、水（舊式 __legacyWater449）、災害。
//   2. 實驗線沒有開關、照跑：本線沒搬，是跟實驗線的差距來源——經濟閉環 T481／T482（第 2 天起就緒）、通勤 T141、道路負載與壅堵 T129、
//      垃圾清運、糧食供應、夜間城市 T487、城市活動 T299、火災、犯罪、廢棄、疾病、死亡。
//   3. 起步城用不到：噪音（沒有噪音源）、污水處理廠（沒有；500 人以上兩邊都不合格）、摩天樓合併（要有水）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；世界歷史只增不改（規則 4）。
import type { LabSave } from '../io/labcode.ts';
import { cityFromLab, type City, type CityBuilding, type KindTable } from './city.ts';
import { fnv1a } from './rng.ts';
import { labRng, type Bld, type Rng, type Tile, type World } from './rules/lab.ts';
import { weatherStep, season, type WeatherState } from './rules/weather.ts';
import { allocGrids, fieldsOf, rebuildCov, rebuildLandBase, recomputeLandDynamic, stampPolSrc, POL_SRC, SVC_BUDGET_DEFAULT, type EduCtx, type Grids, type SvcBudget } from './rules/fields.ts';
import { assignPower, computePower, powerCap } from './rules/power.ts';
import { residentialHappy } from './rules/happy.ts';
import { jobCounts, nominalJobs, rciJobs, residentPopulation488 } from './rules/jobs.ts';
import { demoMul, economyDemands481, housingRciDemand488, immigration, laborMarket481, legacyDemand, type Labor } from './rules/demand.ts';
import { spawnStep, upgradeStep, type GrowCtx } from './rules/growth.ts';
import { countNear, getMaxRoadClass } from './rules/grid.ts';
import { judgeWealth, landStaticAt } from './rules/land.ts';

export interface Sim {
  city: City;                       // 給畫面與歷史用（建築清單、occ 跟 w 同步）
  w: World;                         // 實驗線形狀的格子（規則直接讀寫）
  g: Grids;                         // 覆蓋、污染、地價、教育等逐格場
  rng: Rng; seed: number; day: number;
  weather: WeatherState; vrank: Record<string, number[]>;
  budget: SvcBudget; edu: EduCtx;
  // 跨日的全域值（實驗線 tick() 讀昨天的、今天覆寫）
  pop: number; jobs: number; jobsC: number; jobsI: number; cityHappy: number;
  dem: Record<number, number>; immWave: number; labor: Labor | null;
  root: Map<number, CityBuilding>;  // 根格 → 城市建築（同步 lv、v、age）
  kinds: KindTable;
  // 地價髒框（D011）：實驗線 landDirty／landBox（53067／53073）照抄。landDirty＝true 時隔天開頭重算：有框只算框裡、沒框整張（54996–55001）。
  // 每天 55279 把它設成「整張」；doPlace 第一行 markLandDirty（51627）會把「整張」換成框——實驗線的 bug，照抄（D011 卡第 8 節）。
  // stale＝本線自己的逐格標記：地價基準的輸入（覆蓋、污染）變過、還沒重算的格。實驗線「整張重算」＝重算這些格（其餘格輸入沒變，算出來逐位相同）
  landDirty: boolean; landBox: [number, number, number, number] | null; stale: Uint8Array;
  // 資金（D011）：實驗線全域 money、diff、loan、msIdx、bestStar、bailoutDay；讀檔還原照 load（66923–66987），bailoutDay 不存檔（新圖 −999，51113）
  money: number; diff: number; loan: { remain: number; daily: number } | null; msIdx: number; bestStar: number; bailoutDay: number;
  // 施工（D011，src/sim/edit.ts）：stroke＝下一筆手勢的編號（事件的 g）；txns＝同一天的交易（復原用，過一天清空）
  stroke: number; txns: unknown[];
}

export interface DayReport {
  day: number; pop: number; jobs: number; jobsC: number; jobsI: number; cityHappy: number;
  dem: [number, number, number]; employed: number; workers: number; weather: number; cap: number; powered: number;
  grown: number; upgraded: number;
  money: number; settle: SettleReport | null;   // D011：結算後的資金；沙盒（diff 3）不結算＝null
}
// 一天的結算（D011，src/sim/rules/money.ts）：收入、維護費、淨額，以及當天發生的里程碑、星等獎金、紓困
export interface SettleReport { income: number; upkeep: number; net: number; milestone?: { pop: number; reward: number }; star?: { star: number; bonus: number }; bailout?: number; loanPaid?: number }

// ---- 讀檔（實驗線 load() 66863 起，只搬模擬會讀到的部分）----
// 地面：路（rd 1–4 → road／hw／bridge，66879–66880）；無等級的路補 2（高速 5）（66896）；分區、樹。
// 建築：每筆 [i,k,lv,v,age,…]；住宅缺欄位補 den 3、we 1（66905 起）；一律 pw true、h .6；多格建築補 sz、h 1，ref 格指回根格（66900 起、FIX-J）。
// 亂數：R＝mulberry32(seed^day)（66876），接著天氣重設 wxT＝3＋ri(5)（66931）——讀檔就抽掉一個亂數，這裡照抽。
// 全域值：實驗線 load() 不重設 pop／jobs／cityHappy／dem，對照跑法會先開新圖（newWorld 51110：pop 0、jobs 0、cityHappy .6、dem {1:.5,2:0,3:0}、immWave 0）。
export function simFromSave(save: LabSave, code: string, kinds: KindTable, vrank: Record<string, number[]>, msz: (k: number) => number = k => kinds.size(k)): Sim {
  const city = cityFromLab(save, kinds, code), n = save.n, nn = n * n;
  const tiles: Tile[] = new Array(nn);
  for (let i = 0; i < nn; i++) {
    const rd = city.road[i], road = rd ? 1 : 0, hw = rd >= 3 ? 1 : 0;
    let rc = city.rclass[i];
    if (road && !rc) rc = hw ? 5 : 2;
    tiles[i] = { t: city.ter[i], road, hw, bridge: rd === 2 || rd === 4 ? 1 : 0, rc, zone: city.zone[i], tree: city.tree[i], bld: null };
  }
  const root = new Map<number, CityBuilding>();
  for (const r of save.bl) {
    const [i, k, lv, v, age] = r, b = city.buildings[city.occ[i] - 1];
    if (!b || b.z * n + b.x !== i) continue;                     // 重疊、出界的那筆城市模型已計數略過，這裡同樣不建
    const sz = k === 9 ? (r[5] || 2) : msz(k);
    const bld: Bld = k === 9 ? { k, lv: lv || 1, v, age, pw: true, h: 1, sz }           // 體育場：第 6 位是 sz（66900）
      : k === 1 ? { k, lv, v, age, pw: true, h: .6, fire: r.length >= 7 ? r[5] : (r.length === 6 ? r[5] : 0), den: r.length >= 7 ? r[6] : 3, we: r.length >= 8 ? r[7] : 1 }
      : { k, lv, v, age, pw: true, h: .6, fire: r[5] || 0 };
    if (k !== 9 && sz > 1) { bld.sz = sz; bld.h = 1; }
    tiles[i].bld = bld;
    for (let dz = 0; dz < sz; dz++) for (let dx = 0; dx < sz; dx++) if (dx || dz) {
      const x = b.x + dx, z = b.z + dz;
      if (x < n && z < n) tiles[z * n + x].bld = { k, lv: 0, v: 0, age: 0, ref: [b.x, b.z] };
    }
    if (k <= 3 && b.abandoned) (bld as Bld & { abandoned?: number }).abandoned = 1;
    root.set(i, b);
  }
  const w: World = { N: n, tiles };
  const g = allocGrids(n), budget = { ...SVC_BUDGET_DEFAULT }, edu: EduCtx = { tech: [], spec: null, schoolLunch: false };
  rebuildCov(w, g, budget, edu);                                 // 66940／66965
  const rng = labRng(save.seed ^ save.day);
  const weather: WeatherState = { weather: 0, wxT: 3 + rng.ri(5) };
  return {
    city, w, g, rng, seed: save.seed, day: save.day, weather, vrank, budget, edu,
    pop: 0, jobs: 0, jobsC: 0, jobsI: 0, cityHappy: .6, dem: { 1: .5, 2: 0, 3: 0 }, immWave: 0, labor: null,
    root, kinds,
    landDirty: false, landBox: null, stale: new Uint8Array(nn),          // rebuildCov 剛整張算過（53154 清框）
    money: save.money, diff: save.df, loan: save.ln ? { remain: save.ln[0], daily: save.ln[1] } : null, msIdx: save.msIdx, bestStar: save.star, bailoutDay: -999,
    stroke: 1, txns: [],
  };
}

// 地價基準的輸入在 (x,y) 半徑 r 的方框裡變了（本線的逐格標記；實驗線沒有，它整張重算）
export function markStale(s: Sim, x: number, y: number, r: number) {
  const N = s.w.N, x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(N - 1, x + r), y1 = Math.min(N - 1, y + r);
  for (let yy = y0; yy <= y1; yy++) s.stale.fill(1, yy * N + x0, yy * N + x1 + 1);
}

// ---- 一天（tick() 54945–56192 的順序）----
// fullLand：每天整張重算地價基準（實驗線的做法），給守衛比對「只重算變動那一框」的結果逐位相同
export function stepDay(s: Sim, opts: { fullLand?: boolean } = {}): DayReport {
  const { w, g } = s, N = w.N, nn = N * N, f = fieldsOf(g);
  // 54948 buildTickIndex：有建築的格（含 ref）、分區格、商業分區格數，都升序
  const tickBld: number[] = [], tickZone: number[] = [];
  let czone = 0;
  for (let i = 0; i < nn; i++) {
    const t = w.tiles[i];
    if (t.bld) tickBld.push(i);
    if (t.zone) { tickZone.push(i); if (t.zone === 2) czone++; }
  }
  // 54949 噪音：沒搬（起步城的 k1／2／3／5／11 都不是噪音源，實驗線也是 0）
  s.day++;                                                               // 54950
  // 54952 事故 T493：關（第 1 類，沒有事故）；54953 城市活動 T299：沒搬（第 2 類，實驗線照跑、每 37 天可能一場）
  // 54956 乾旱只由災害設定；災害關（第 1 類）
  const wx = weatherStep(s.weather, s.day, s.rng);                        // 54964–54975（F10，唯一在生長前抽亂數的一步）
  s.weather = { weather: wx.weather, wxT: wx.wxT };
  // 54991 通勤（T141，每 4 天）、54995 道路負載（T129）：沒搬，實驗線沒有開關、照跑（第 2 類）；本線 commutePenalty、roadLoad 都是 0
  // 54996–55001 地價基準髒重建：landDirty 時，有框只重算框裡，沒框整張（前一天 55279 設成整張；玩家施工把它換成框，見 Sim.landDirty）。
  // 54997 rebuildNoise：本線沒有噪音源（D011 能蓋的路、分區、電廠 k5、警察局 k11 都不在 NOISE_SRC 53021），NOISE 一直是 0，不會觸發整張重算。
  // 整張＝重算 stale 格（地價基準只取決於該格的覆蓋、污染、噪音與半徑 4 的犯罪（landStaticAt）；輸入沒變的格算出來一樣）；
  // opts.fullLand＝逐字照實驗線把整張算一遍（守衛的慢速版，結果要逐位相同）
  if (s.landDirty) {
    if (s.landBox) { const [x0, y0, x1, y1] = s.landBox; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; g.LANDBASE[i] = landStaticAt(w, f, x, y); s.stale[i] = 0; } }
    else if (opts.fullLand) { rebuildLandBase(w, g); s.stale.fill(0); }
    else { for (let i = 0; i < nn; i++) if (s.stale[i]) g.LANDBASE[i] = landStaticAt(w, f, i % N, (i / N) | 0); s.stale.fill(0); }
    s.landDirty = false; s.landBox = null;                              // 55000
  }
  recomputeLandDynamic(g);                                                // 55002：沒有壅堵，LAND＝LANDBASE
  // 55006 住房市場 T488：關（第 1 類；沒就緒：入住率 1、住房懲罰 0、新住宅密度＝道路等級、升級係數 1）
  const sea = season(s.day);
  const nominal = computePower(w).cap, cap = powerCap(nominal, sea);   // 55008（F11，舊版供電）；55009 T471 調度略過
  // 55010 水：舊版供水 wa＝pw && 附近有水設施 && 容量——起步城沒有水設施，一律 false；水壓／水質懲罰走舊式＝0（第 1 類，__legacyWater449）
  const sewNeed = s.pop >= 500;                                           // 55011 sewerRequired442：昨天的人口 ≥500
  const sewOkArr = new Uint8Array(nn);                                    // 沒有污水處理廠：需要時全城都不合格（兩種模式相同）
  // 55015 死亡前置、55046 每日計數歸零：疾病、死亡沒搬（第 2 類，實驗線照跑），本線沒有生病、死亡
  const powered = assignPower(w, tickBld, cap);                           // 55154–55156（F11）：按建築索引、兩格內有帶電道路且容量未用完
  let popN = 0, jobsC = 0, jobsI = 0, happySum = 0, happyN = 0;
  const covAt = (i: number) => { const c: Record<string, number> = {}; for (const k in g.COV) c[k] = g.COV[k][i]; return c; };
  for (const i of tickBld) {                                              // 55050／55150 主迴圈
    const t = w.tiles[i], b = t.bld;
    if (!b || b.ref) continue;
    if (b.k > 3 && b.k !== 127) continue;
    const x = i % N, y = (i / N) | 0;
    b.wa = false;                                                         // 55157
    if (b.k === 1 || b.k === 127) {
      const residentPop = residentPopulation488(b, () => undefined);      // 55163：住房沒就緒＝入住率 1
      const hp = residentialHappy({                                       // 55164–55236（F7）
        c: covAt(i), POL: g.POL[i], NOISE: g.NOISE[i], commutePenalty: g.commutePenalty[i],
        we: b.we, k: b.k, lv: b.lv, pw: b.pw, sick: b.sick, death: b.death,
        ind: countNear(w, x, y, 3, tt => tt.bld && tt.bld.k === 3),
        crime: countNear(w, x, y, 4, tt => tt.bld && tt.bld.k <= 3 && tt.bld.crime),
        rc: getMaxRoadClass(w, x, y, 1), jam: 0,
        drainPen: 0, waterLegacy: true, waterPen: 0, deathPenalty: false, sewNeed, sewOk: !sewNeed,
        weather: s.weather.weather, day: s.day, nightCity: { ready: false, happinessDelta: 0 }, housingPen: 0,
        eventHappy: null, cookedReady: false, pol: null, rankIdx: 0, tvSignal: false, tech: s.edu.tech,
      });
      b.h = hp.h;
      happySum += b.h; happyN++;                                          // 55239
      if ((b.k === 127 ? b.pw && b.wa : b.pw) && !b.sick && !b.death) popN += residentPop;   // 55240
    } else if (b.pw) {                                                    // 55241–55242（F8）
      if (b.k === 2) jobsC += rciJobs(b, !!t.office); else jobsI += rciJobs(b, false);
    }
  }
  // 55246–55250（F8）：名目就業＝商工＋各設施固定就業；設施計數（55055–55140）沒搬——起步城的電廠、警察局 lv1 都是 0
  const jc = jobCounts(); jc.jobsC = jobsC; jc.jobsI = jobsI;
  let pop = popN, jobs = nominalJobs(jc);
  // 55251 企業 T489：關（第 1 類；enterpriseRollback489 39560）＝四捨五入的名目值
  jobs = Math.max(0, Math.round(jobs)); jobsC = Math.max(0, Math.round(jobsC)); jobsI = Math.max(0, Math.round(jobsI));
  let cityHappy = happyN ? happySum / happyN : .6;                        // 55254（住宅 k1 與社宅 k127）
  // 55256–55277 垃圾清運：沒搬（第 2 類，實驗線照跑）
  s.landDirty = true; s.landBox = null;                                   // 55279 rebuildAccess468（64146 → 64129）每天把地價設成「隔天整張重算」
  { let s1 = 0, n1 = 0; for (const i of tickBld) { const b = w.tiles[i].bld; if (!b || b.k !== 1) continue; s1 += b.h as number; n1++; } if (n1) cityHappy = s1 / n1; }   // 55282–55284：只用住宅 k1 重算
  // 55414 糧食供應：沒搬（第 2 類）；55426 災害：關（第 1 類）
  const labor = laborMarket481(pop, jobs, null, s.day);                   // 55329（F2，企業沒就緒那一支）
  const L = legacyDemand({ pop, jobs, cityHappy, czone, jobsC, jobsI, indSubsidy: false, tech: s.edu.tech });   // 55578–55584（F1）
  const E = economyDemands481(L.legacyR481, L.legacyC481, L.legacyI481, labor, null);                          // 55585（F3，經濟沒就緒）
  const dem = { 1: housingRciDemand488(E.r, null), 2: E.c, 3: E.i };      // 55586–55587（F4，住房沒就緒）
  const im = immigration(s.immWave, pop, s.day, cityHappy, dem[1]);       // 55594–55595（F4）
  const dMul = demoMul(cityHappy, im.immWave, 0);                         // 55596：交通層 T509、財政 T510 沒就緒＝0
  s.pop = pop; s.jobs = jobs; s.jobsC = jobsC; s.jobsI = jobsI; s.cityHappy = cityHappy; s.dem = dem; s.immWave = im.immWave; s.labor = labor;
  const ctx: GrowCtx = {
    w, f, vrank: s.vrank, rng: s.rng, dem, cityHappy, demoMul: dMul, tech: s.edu.tech, tickZone, tickBld,
    sewNeed, sewOk: sewOkArr, onIndustry: (x, y) => { stampPolSrc(g, x, y, 3, 1); markStale(s, x, y, POL_SRC[3].r); },   // 55624：工業一長出來就是污染源（同一天的 judgeWealth 就讀得到）；實驗線這裡不標地價髒框
  };
  const { spawned } = spawnStep(ctx);                                     // 55597–55627（F5）
  const ups = upgradeStep(ctx);                                           // 55628–55652（F6）
  if (s.day % 30 === 0) {                                                 // 55676–55686：每 30 天住宅財富往判定值移一級（F9 judgeWealth）
    for (const i of tickBld) {
      const b = w.tiles[i].bld;
      if (!b || b.k !== 1) continue;
      const cur = b.we !== undefined ? b.we : 1, tgt = judgeWealth(w, f, i % N, (i / N) | 0);
      if (tgt > cur) b.we = cur + 1; else if (tgt < cur) b.we = cur - 1;
    }
  }
  // 55691 摩天樓合併：起步城用不到（要有水，第 3 類）
  // 55757 火災、55810 犯罪、55824 廢棄、55835 疾病、55856 死亡、55866 夜間城市、56030 經濟快照：沒搬（第 2 類，實驗線照跑；本線不發生、不就緒）
  const settle = settleToday(s, tickBld);                                 // 55868–56145（D011）：收稅、維護費、結算、里程碑、星等、紓困
  syncCity(s, spawned.map(p => ({ i: p.y * N + p.x, b: p.b })), ups);
  s.txns.length = 0;                                                      // 過了一天：之前的施工不能再復原（D011 卡第 4 節）
  return {
    day: s.day, pop, jobs, jobsC, jobsI, cityHappy, dem: [dem[1], dem[2], dem[3]], employed: labor.employed, workers: labor.workers,
    weather: s.weather.weather, cap, powered, grown: spawned.length, upgraded: ups.length, money: s.money, settle,
  };
}

// 一天的資金結算（D011）：等 src/sim/rules/money.ts 接上
function settleToday(_s: Sim, _tickBld: number[]): SettleReport | null {
  return null;
}

// 城市模型跟著格子走：新建築、升級記成事件（只增不改），所有建築的屋齡同步
function syncCity(s: Sim, grown: { i: number; b: Bld }[], ups: { i: number; lv: number; v: number }[]) {
  const c = s.city, n = c.n;
  for (const { i, b } of grown) {
    const x = i % n, z = (i / n) | 0, size = s.kinds.size(b.k);
    const cb: CityBuilding = { id: c.buildings.length + 1, k: b.k, lv: b.lv, v: b.v, age: b.age, x, z, size, abandoned: false, builtDay: s.day };
    c.buildings.push(cb);
    c.occ[i] = cb.id;
    s.root.set(i, cb);
    c.history.push({ day: s.day, t: 'grow', x, z, k: b.k, lv: b.lv, v: b.v });
  }
  for (const u of ups) {
    const cb = s.root.get(u.i)!;
    cb.lv = u.lv; cb.v = u.v;
    c.history.push({ day: s.day, t: 'upgrade', x: cb.x, z: cb.z, k: cb.k, lv: u.lv, v: u.v });
  }
  for (const [i, cb] of s.root) { const b = s.w.tiles[i].bld; if (b) { cb.age = b.age; cb.lv = b.lv; cb.v = b.v; } }
  c.day = s.day;
}

// 狀態雜湊（決定性守衛）：日子、全域值、天氣、每棟建築（位置、種類、等級、變體、屋齡、拆除日、通電、幸福、財富、密度）、污染與地價基準；
// D011 起加上路、分區、樹、資金狀態、地價髒框
export function simHash(s: Sim) {
  const blds = s.city.buildings.map(b => [b.x, b.z, b.k, b.lv, b.v, b.age, b.goneDay ?? -1]);
  const bl = [...s.root.keys()].map(i => { const b = s.w.tiles[i].bld!; return [i, b.pw ? 1 : 0, b.h, b.we ?? -1, b.den ?? -1]; });
  const ground = s.w.tiles.map(t => `${t.road ? t.rc : 0}${t.zone || 0}${t.tree ? 1 : 0}`).join('');
  return fnv1a(JSON.stringify([s.day, s.pop, s.jobs, s.jobsC, s.jobsI, s.cityHappy, s.dem, s.immWave, s.weather, blds, bl, Array.from(s.g.POL), Array.from(s.g.LANDBASE),
    ground, s.money, s.diff, s.loan, s.msIdx, s.bestStar, s.bailoutDay, s.landDirty, s.landBox]));
}

export function simCounts(s: Sim) {
  const rci = { 1: [0, 0, 0, 0], 2: [0, 0, 0, 0], 3: [0, 0, 0, 0] } as Record<number, number[]>;
  for (const b of s.city.buildings) if (b.goneDay === undefined && b.k >= 1 && b.k <= 3) { rci[b.k][0]++; rci[b.k][b.lv]++; }
  return rci;
}

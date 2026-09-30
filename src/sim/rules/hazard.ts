// 每日災禍（D026）：死亡前置、火災、犯罪、廢棄、疾病、死亡。出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號。
//   55014–55036 死亡前置（deathPre）→ …生長、升級、合併… → 55757–55797 火災（fireStep）→ 55810–55823 犯罪（crimeStep）→ 55824–55834 廢棄（abandonStep）
//   → 55835–55855 疾病（diseaseStep）→ 55856–55865 死亡（deathStep）→ 55868 起收稅（旗標讓建築停稅，money.ts 已有）。
// 這一串不受災害開關 disastersOn 管（回退設定照跑）；工業洩漏 55798（disastersOn 才跑）、龍捲風、隕石坑點火（55478）本線沒有災害，不搬。
// 逐行照搬，包括亂數被抽的順序與次數（每一段都是 for (const i of tickBld)，順序＝建築格索引升序、新長的接在後面）與浮點乘法的結合順序。
// 沒搬的輸入（第 1、2 類，見 docs/D026-hazards.md）：政策 pol（煙霧偵測、宵禁、夜市、公園夜間開放，55766、55817）D032 起 day.ts 用 Sim.pol 餵進來（沒給＝null，給了就蓋過去，守衛用）；夜間治安 nightCrimeMul487（T487）：D029 起 day.ts 用前一天的夜間城市餵進來（沒給＝1，給了就蓋過去，守衛用）；
// 乾旱起火率（災害）不搬；T495 民生服務關（醫療覆蓋只看 COV）；T472 水質病風險舊式供水＝0；保險理賠 insPayout（53047）在 day.ts 照燒毀的棟數加（D032，policy.ts INSURANCE_PAYOUT）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；不寫世界歷史（day.ts 拿回傳的事件去記）。
import { idx, inMap, streetHash, tq, type Bld, type Fields, type Rng, type World } from './lab.ts';
import { stampPolSrc, type Grids } from './fields.ts';

// 39657、39658：災害應變中心與避難公園的係數（韌性讀取層 resilience364At 53568）
export const DISASTER_CENTER_DAMAGE_MUL = .60, DISASTER_CENTER_RECOVERY_CHANCE = .55, SHELTER_CASUALTY_MUL = .55;

// 政策（K，D032）：災禍段讀 smokeDetect、curfew、nightMarket、parkNight；住宅幸福讀 freeTransit、parkNight、curfew（happy.ts）。同一個物件兩邊共用（Sim.pol）
export type HazardPol = import('./policy.ts').PolState;   // D032：災禍段讀 smokeDetect、curfew、nightMarket（抽籤）；同一個政策物件（Sim.pol）。不另開 import 行：亂數抽取的呼叫行號（D011 錨點、SITE_MAP）不能位移
// 本線沒有來源、只有守衛注入的輸入（生產路徑全部不給＝實驗線回退設定的值）
// D027 起同一個物件也帶住宅幸福讀的兩個輸入：夜間城市（J，T487：前一天結算的 ready 與 happinessDelta；D029 起 day.ts 自己給，這裡給了就蓋過去）、城市活動（D，T299：這一天的 happy 加成，沒有活動＝null，還沒搬）
export interface HazardX { pol?: HazardPol | null; nightCrimeMul?: (i: number, b: Bld) => number; spec?: string | null; nightCity?: { ready: boolean; happinessDelta: number }; eventHappy?: number | null }

const sq = (spec: string | null | undefined, id: string, on: number, off: number) => spec === id ? on : off;   // 37851：sq(id,on,off)＝spec386===id?on:off

// 53568 resilience364At：只搬火災用得到的三項（damageMul、casualtyMul、recovery）；洪水那幾項（floodMul、floodClear，讀 drainageLegacy454）是災害的事
export function resilience364At(w: World, f: Fields, x: number, y: number, b?: Bld | null) {
  if (!inMap(w, x, y)) return { damageMul: 1, casualtyMul: 1, recovery: 0 };
  const i = idx(w, x, y), center = (f.COV.resilience![i] as number) > 0, shelter = (f.COV.shelter![i] as number) > 0;
  const resident = !!(b && b.k === 1);                        // T364c：避難傷亡倍率只覆蓋既有隨機住宅池
  const casualtyMul = shelter && resident ? SHELTER_CASUALTY_MUL : 1;
  return { damageMul: center ? DISASTER_CENTER_DAMAGE_MUL : 1, casualtyMul, recovery: center ? DISASTER_CENTER_RECOVERY_CHANCE : 0 };
}
// 53580 disasterBlocked364：韌性擋下（不抽亂數，用 streetHash）
export function disasterBlocked364(w: World, f: Fields, x: number, y: number, b: Bld, salt: number): boolean {
  const r = resilience364At(w, f, x, y, b), mul = r.damageMul * r.casualtyMul;
  return mul < 1 && streetHash(x, y, salt) > mul;
}

// 55014–55036 死亡前置：死亡中的住宅 deathAge++，滿 10 天恢復；還沒恢復的有墓園覆蓋且容量夠就安撫，否則半徑 6 內沒死亡的住宅記「喪事未安撫」
export interface DeathPre { penalty: Uint8Array; ended: number[]; cemCap: number; soothed: number }
export function deathPre(w: World, f: Fields, tickBld: readonly number[]): DeathPre {
  const N = w.N, penalty = new Uint8Array(N * N), COV = f.COV, ended: number[] = [];
  let cemCount = 0, bigCem = 0;
  for (const i of tickBld) { const b = w.tiles[i].bld; if (b && b.k === 16) cemCount++; if (b && b.k === 54 && !b.ref) bigCem++; }   // 55017 T233：大墓園 root 計數
  let cremPre342 = 0; for (const i2 of tickBld) { const b2 = w.tiles[i2].bld; if (b2 && b2.k === 107) cremPre342++; }                 // 55018
  const cemCap = cemCount * 3 + bigCem * 24 + cremPre342 * 40;                                                                        // 55019
  let soothed = 0;
  for (const i of tickBld) {
    const b = w.tiles[i].bld;
    if (!b || b.k !== 1 || !b.death) continue;
    b.deathAge = (b.deathAge || 0) + 1;
    if (b.deathAge >= 10) { b.death = 0; b.deathAge = 0; b.sick = 0; ended.push(i); continue; }
    const x = i % N, y = (i / N) | 0;
    const covered = (COV.cemetery![i] as number) > 0 || (COV.cem2![i] as number) > 0 || (COV.crem && (COV.crem[i] as number) > 0);   // 55027
    if (covered && soothed < cemCap) { soothed++; continue; }
    for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {                                                              // 55030：未安撫，半徑 6 內其他住宅幸福 −0.1
      const nx = x + dx, ny = y + dy;
      if (!inMap(w, nx, ny)) continue;
      const j = idx(w, nx, ny), nb = w.tiles[j].bld;
      if (nb && nb.k === 1 && !nb.death) penalty[j] = 1;
    }
  }
  return { penalty, ended, cemCap, soothed };
}

// 55757–55797 火災：起火 → 蔓延 → 燃燒與燒毀成焦土。burned 記燒毀的那一棟燒毀當時的樣子（給城市模型與歷史）
export interface FireResult { ignited: number[]; spread: number[]; burned: { i: number; k: number; lv: number; age: number }[]; first: number }
export function fireStep(w: World, g: Grids, f: Fields, rng: Rng, tickBld: readonly number[], day: number, tech: readonly string[], x?: HazardX): FireResult {
  const N = w.N, COV = f.COV, pol = x?.pol ?? null, spec = x?.spec ?? null, ignited: number[] = [], spread: number[] = [], burned: FireResult['burned'] = [];
  const burning: number[] = [];
  for (const i of tickBld) { const b = w.tiles[i].bld; if (b && b.k <= 3 && b.fire) burning.push(i); }                                  // 55759
  let first = -1;
  for (const i of tickBld) {                                                                                                          // 55762 起火擲骰（未燃 k≤3）
    const b = w.tiles[i].bld;
    if (!b || b.k > 3 || b.fire) continue;
    let p = .0005 * (b.k === 3 ? 3 : 1) * b.lv;
    if (pol && pol.smokeDetect) p *= .6;                                                                                              // 55766 T327
    const bx = i % N, by = (i / N) | 0;
    if ((COV.fire![i] as number) > 0 || (COV.fire2 && (COV.fire2[i] as number) > 0) || (COV.fireHQ && (COV.fireHQ[i] as number) > 0)) p *= .15;   // 消防局半徑 9 覆蓋 → 起火率 −85%
    else if (COV.firewatch && (COV.firewatch[i] as number) > 0) p *= .45;                                                             // T340：瞭望塔＝弱火險
    { const r364 = resilience364At(w, f, bx, by, b); p *= r364.damageMul * r364.casualtyMul; }
    p *= tq(tech, 'A4a', 1.10, 1) * tq(tech, 'A4b', .85, 1) * tq(tech, 'B3', .90, 1) * sq(spec, 'ind', 1.08, 1) * sq(spec, 'green', .90, 1);
    /*@55772*/ if (rng.R() < p) { b.fire = 1; ignited.push(i); if (first < 0) first = i; }
  }
  for (const i of burning) {                                                                                                          // 55777 蔓延：20% 點燃 Chebyshev 1 內未燃建築
    /*@55778*/ if (rng.R() < .20) {
      const bx = i % N, by = (i / N) | 0, opts: [number, Bld][] = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = bx + dx, ny = by + dy;
        if (!inMap(w, nx, ny)) continue;
        const ni = idx(w, nx, ny), nb = w.tiles[ni].bld;
        if (nb && nb.k <= 3 && !nb.fire) opts.push([ni, nb]);
      }
      /*@55787*/ if (opts.length) { const [ni, nb] = opts[rng.ri(opts.length)]; if (!disasterBlocked364(w, f, ni % N, (ni / N) | 0, nb, 36484)) { nb.fire = 1; spread.push(ni); } }
    }
  }
  for (const i of burning) {                                                                                                          // 55790 推進燃燒天數；fire≥5 燒毀成焦土
    const t = w.tiles[i], b = t.bld;
    if (!b || !b.fire) continue;
    const bx = i % N, by = (i / N) | 0;
    const r364 = resilience364At(w, f, bx, by, b);
    if (r364.recovery && streetHash(bx, by, day + 36485) < r364.recovery) b.fire = Math.max(0, (b.fire as number) - 1); else b.fire = (b.fire as number) + 1;
    if ((b.fire as number) >= 5) {
      if (b.k === 3) stampPolSrc(g, bx, by, 3, -1);                                                                                   // T110：工業燒毀→撤銷污染源
      burned.push({ i, k: b.k, lv: b.lv, age: b.age });
      t.bld = null; t.ruin = 1;                                                                                                       // zone 保留；insPayout（保險政策）沒有
    }
  }
  return { ignited, spread, burned, first };
}

// 55810–55823 犯罪：沒被警察局或派出所覆蓋、也沒被監獄覆蓋的 k≤3 建築每天小機率發生犯罪（呼叫端替每一件標地價髒框 markLandDirty(x,y,4)）
export interface CrimeResult { crimes: number[]; first: number }
export function crimeStep(w: World, f: Fields, rng: Rng, tickBld: readonly number[], tech: readonly string[], x?: HazardX): CrimeResult {
  const COV = f.COV, pol = x?.pol ?? null, crimes: number[] = []; let first = -1;
  for (const i of tickBld) {
    const b = w.tiles[i].bld;
    if (!b || b.k > 3 || b.crime) continue;
    if ((COV.police![i] as number) > 0 || (COV.police2![i] as number) > 0) continue;                                                 // T61／T222
    /*@55817*/ if (!(COV.prison && (COV.prison[i] as number) > 0) && rng.R() < .001 * (b.k === 2 ? 2 : 1) * b.lv * (pol && pol.curfew ? .6 : 1) * (pol && pol.nightMarket ? 1.15 : 1) * (pol && pol.parkNight ? 1.05 : 1)
      * ((COV.court && (COV.court[i] as number) > 0) ? .5 : 1) * tq(tech, 'B2', .92, 1) * tq(tech, 'B4b', 1.05, 1) * tq(tech, 'B7', .90, 1) * (x?.nightCrimeMul ? x.nightCrimeMul(i, b) : 1)) {
      b.crime = 1; crimes.push(i); if (first < 0) first = i;
    }
  }
  return { crimes, first };
}

// 55824–55834 廢棄：犯罪持續（玩家沒處理）滿 15 天後每天 5% 轉成廢棄（停稅）
export interface AbandonResult { abandons: number[]; first: number }
export function abandonStep(w: World, rng: Rng, tickBld: readonly number[]): AbandonResult {
  const abandons: number[] = []; let first = -1;
  for (const i of tickBld) {
    const b = w.tiles[i].bld;
    if (!b || b.k > 3 || !b.crime || b.abandoned) continue;
    b.crimeDays = (b.crimeDays || 0) + 1;
    /*@55829*/ if (b.crimeDays >= 15 && rng.R() < .05) { b.abandoned = 1; abandons.push(i); if (first < 0) first = i; }
  }
  return { abandons, first };
}

// 55835–55855 疾病（只有住宅 k1）：醫院覆蓋的病患次日康復（有床位），診所覆蓋的病患每天 50%（有床位）；沒有任何醫療覆蓋的健康住宅每天 .001×lv 生病。
// medCap＝昨天結算寫的床位（flowStat384.med.cap）；讀檔與新圖之後第一天沒有＝無限
export interface DiseaseResult { sicks: number[]; cures: number[]; cured: number; queued: number; first: number }
export function diseaseStep(w: World, f: Fields, rng: Rng, tickBld: readonly number[], medCap: number): DiseaseResult {
  const COV = f.COV, sicks: number[] = [], cures: number[] = []; let cured = 0, queued = 0, first = -1;
  for (const i of tickBld) {
    const b = w.tiles[i].bld;
    if (!b || b.k !== 1) continue;
    const hospital = (COV.hospital![i] as number) > 0 || (COV.ambulance && (COV.ambulance[i] as number) > 0) || (COV.megahosp && (COV.megahosp[i] as number) > 0) || (COV.medcamp && (COV.medcamp[i] as number) > 0);
    const clinic = (COV.clinic![i] as number) > 0;
    const covered = hospital || clinic;
    if (b.sick) {
      if (hospital) { if (cured < medCap) { b.sick = 0; cured++; cures.push(i); } else queued++; }                                    // T387b：床位門檻（這一支沒有亂數）
      /*@55847*/ else if (clinic && rng.R() < .5) { if (cured < medCap) { b.sick = 0; cured++; cures.push(i); } else queued++; }                 // 亂數照擲、結果被床位遮蔽
      continue;
    }
    /*@55850*/ if (!covered && rng.R() < .001 * (b.lv as number)) { b.sick = 1; sicks.push(i); if (first < 0) first = i; }                     // T472 水質病風險：舊式供水＝0
  }
  return { sicks, cures, cured, queued, first };
}

// 55856–55865 生病→死亡：病滿 3 天未康復每天 10% 轉死亡。sickDays 治癒時不歸零（實驗線的行為，下一次生病從舊值接著數）
export interface DeathResult { deaths: number[]; sickN: number; first: number }
export function deathStep(w: World, rng: Rng, tickBld: readonly number[]): DeathResult {
  const deaths: number[] = []; let sickN = 0, first = -1;
  for (const i of tickBld) {
    const b = w.tiles[i].bld;
    if (!b || b.k !== 1 || !b.sick || b.death) continue;
    sickN++; b.sickDays = (b.sickDays || 0) + 1;
    /*@55861*/ if (b.sickDays >= 3 && rng.R() < .10) { b.death = 1; b.deathAge = 0; b.sick = 0; b.sickDays = 0; deaths.push(i); if (first < 0) first = i; }
  }
  return { deaths, sickN, first };
}

// 56163 flowStat384.med.cap（回退設定 civic495 不就緒的那一支）：診所×4＋醫院×10＋救護站×6＋綜合醫院×30＋大型醫學中心×90，明天的疾病段讀它
export const medCapOf = (c: { clinics: number; hospitals: number; am: number; mhN: number; gmc466: number }) => c.clinics * 4 + c.hospitals * 10 + c.am * 6 + c.mhN * 30 + c.gmc466 * 90;

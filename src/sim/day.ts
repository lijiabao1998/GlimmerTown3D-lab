// 逐日推進（D010）：把 D009 的生長核心公式（src/sim/rules/）照實驗線 tick() 的順序接起來。這裡只接線，不寫公式。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號（每一步都註明；tick() 是 54945–56192）。
// 沒搬的上層系統分三類（名單與理由見 docs/D010-starter-city.md「上層系統」一節）：
//   1. 實驗線有開關：本線接它關掉時的回退值（對照的 fallback 設定也用實驗線自己的開關關掉）——住房市場 T488、企業 T489、
//      T471 分時調度（舊版供電 __legacyPower450／__legacyPower471）、行動力 T491／T509、財政回饋 T510／T515、事故 T493、水（舊式 __legacyWater449）、災害。
//   2. 實驗線沒有開關、照跑：本線沒搬，是跟實驗線的差距來源——資源開採 T140（另有污水、合併、政策等，見 docs/city-systems-backlog.md）。
//      已搬的：經濟閉環 T481／T482（D025，rules/economy.ts；D022 起糧食那一段在 rules/food.ts）、火災與犯罪與廢棄與疾病與死亡（D026）、通勤 T141 與道路負載與壅堵 T129（D027）、
//      天然氣化肥與熟食與其餘收入加成 T346（D028）、夜間城市 T487（D029，rules/nightcity.ts）、城市活動 T299（D030，rules/events.ts）。
//   3. 起步城用不到：污水處理廠（沒有；500 人以上兩邊都不合格）、摩天樓合併（要有水）。噪音 D017 搬了（讀進來的城有噪音源）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；世界歷史只增不改（規則 4）。
import type { LabSave } from '../io/labcode.ts';
import { cityFromLab, stadiumSize, type City, type CityBuilding, type CityEvent, type KindTable } from './city.ts';
import { fnv1a } from './rng.ts';
import { clamp, labRng, type Bld, type Fields, type Rng, type Tile, type World } from './rules/lab.ts';
import { weatherStep, season, type WeatherState } from './rules/weather.ts';
import { allocGrids, fieldsOf, rebuildCov, rebuildLandBase, rebuildNoise, recomputeLandDynamic, stampPolSrc, POL_SRC, SVC_BUDGET_DEFAULT, type EduCtx, type Grids, type SvcBudget } from './rules/fields.ts';
import { assignPower, computePower, powerCap } from './rules/power.ts';
import { assignWater, computeWaterLegacy449 } from './rules/water.ts';
import { garbageDay, garbDecisionRatio452 } from './rules/garbage.ts';
import { applyFoodHappy, type FoodReport } from './rules/food.ts';
import type { RoadStats } from './rules/logistics.ts';
import { activeConstruction482, economyLate, economyMain, economySnapshots, emptyEconState, recycleGoods, steelConstruction, wealthPower481, type EconCtx, type EconLate, type EconState } from './rules/economy.ts';
import { residentialHappy } from './rules/happy.ts';
import { nominalJobs, rciJobs, residentPopulation488 } from './rules/jobs.ts';
import { jobCountsOf, tallyBuildings } from './rules/count.ts';
import { demoMul, economyDemands481, housingRciDemand488, immigration, laborMarket481, legacyDemand, type Labor } from './rules/demand.ts';
import { spawnStep, upgradeStep, type GrowCtx } from './rules/growth.ts';
import { nearCounter, getMaxRoadClass } from './rules/grid.ts';
import { crimeFlag, judgeWealth, landStaticAt } from './rules/land.ts';
import { abandonStep, crimeStep, deathPre, deathStep, diseaseStep, fireStep, medCapOf, type DeathPre, type HazardX } from './rules/hazard.ts';
import { markLandDirty } from './rules/build.ts';
import { hashBytes, isCommuteDay, jamCounts, roadStatsOf, trafficStep } from './rules/commute.ts';
import { chainDay, incomeExtras, type ExtrasOut } from './rules/income2.ts';
import { CITY_EVENTS, eventOfSave, eventStep, type CityEventState, type EventStep } from './rules/events.ts';
import { emptyNightCity, finalizeNightCity, nightCrimeMul, nightPoliceCoverage, prepareNightInputs, type NightCity } from './rules/nightcity.ts';
import { addOtherIncome, cityEventIncome, dailyIncome, dailyUpkeep, neutralTaxMul, scoreCounts, settleDay, upkeepIn, OTHER_INCOME_KEYS, ZERO_IMPORTS, ROAD_UPKEEP, INFRA_UPKEEP475, type ImportCosts, type OtherIncome, type TaxMul, type UpkeepIn } from './rules/money.ts';

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
  commuteClusters: number[][];      // D027：通勤叢集的快取路徑（每 4 天重算，其餘天沿用，實驗線 commuteClusters 56928；不存檔，讀檔與新圖是空的）
  tvSignal: boolean;                // D027：T330 電視訊號＝前一天算出來的電視台數（tv330）>0（實驗線 let tvSignal 38251、55252 在住宅幸福迴圈後更新、下一天的幸福讀它＝一天的延遲）；不存檔，讀檔與新圖是 false
  fertReady: boolean; cookedReady: boolean;   // D028：T346 天然氣鏈昨天的結果（fertOut>0、cookedOut>0；實驗線 let fertReady、cookedReady 38257，56008 結算、隔天的農場計數 55089 與住宅幸福 55206 讀它）；不存檔，讀檔與新圖是 false（51110、66972）
  cityEvent: CityEventState | null; // D030：T299 城市活動（實驗線 let cityEvent 38194：{i, daysLeft}；54953 每天倒數與觸發，當天的幸福項 55179、食物 55293、收入 56028 讀它）；入存檔（實驗線既有的可選欄位 cev 66764、讀檔 66963），新圖是 null（51111）
  night: NightCity;                 // D029：T487 夜間城市昨天的結算（實驗線 let nightCity487 37319，55866 每天算一次；隔天的住宅幸福 55233 與犯罪抽籤 55817 讀它）；執行期狀態、不存檔，讀檔與新圖是 ready:false（51110、66972 resetNightCity487）
  commuteDay: number;               // D027：最近一次重算通勤是哪一天（−1＝讀檔之後還沒算過：卡片要分得出「還沒算」跟「算過、沒有懲罰」；只給介面看，不進雜湊）
  medCap: number | null;            // D026：昨天結算寫的醫療床位（實驗線 flowStat384.med.cap 56163，明天的疾病段 55835 讀它）；讀檔、開新圖之後第一天沒有＝null＝無限
  econ: EconState;                  // D025：商品庫存（goods、supplies、fuel、steel）、船、昨天的倉容量與經濟快照（隔天的商工需求讀它）；存檔欄位 sup、gds、fuel364、steel364、shipCount、shipProgress
  root: Map<number, CityBuilding>;  // 根格 → 城市建築（同步 lv、v、age）
  kinds: KindTable;
  // 地價髒框（D011）：實驗線 landDirty／landBox（53067／53073）照抄。landDirty＝true 時隔天開頭重算：有框只算框裡、沒框整張（54996–55001）。
  // 每天 55279 把它設成「整張」；doPlace 第一行 markLandDirty（51627）會把「整張」換成框——實驗線的 bug，照抄（D011 卡第 8 節）。
  // stale＝本線自己的逐格標記：地價基準的輸入（覆蓋、污染）變過、還沒重算的格。實驗線「整張重算」＝重算這些格（其餘格輸入沒變，算出來逐位相同）
  landDirty: boolean; landBox: [number, number, number, number] | null; stale: Uint8Array;
  noiseSig: number;                 // D017：噪音來源簽名（實驗線 noiseSig 53022；讀檔、開新圖 −1，56934）。不存檔
  // 資金（D011）：實驗線全域 money、diff、loan、msIdx、bestStar、bailoutDay；讀檔還原照 load（66923–66987），bailoutDay 不存檔（新圖 −999，51113）
  money: number; diff: number; loan: { remain: number; daily: number } | null; msIdx: number; bestStar: number; bailoutDay: number;
  // 施工（D011，src/sim/edit.ts）：stroke＝下一筆手勢的編號（事件的 g）；txns＝同一天的交易（復原用，過一天清空）
  stroke: number; txns: unknown[];
  dozeArm: { i: number; t: number } | null;   // 單格拆二級以上的建築：第一次只「預備」，3 秒內再拆一次才拆（實驗線 62983–62992）
}

export interface DayReport {
  day: number; pop: number; jobs: number; jobsC: number; jobsI: number; cityHappy: number;
  dem: [number, number, number]; employed: number; workers: number; weather: number; cap: number; powered: number;
  grown: number; upgraded: number;
  money: number; settle: SettleReport;          // D011：結算後的資金與當天的結算（沙盒照算，只是不入帳）
  garb: GarbReport;                             // D020：當天的垃圾（產量、容量、全城比例、正式清運、清運區數、局部扣分的棟數）
  food: FoodReport;                             // D022：當天的糧食（產量、遊客、需求、進口、供糧率、每棟住宅的加減、貿易額度）
  econ: EconReport;                             // D025：當天的經濟（實驗線經濟段的每一個區域變數、出口與快照、施工耗鋼）
  hazard: HazardReport;                         // D026：當天的災禍（起火、蔓延、燒毀、犯罪、廢棄、生病、治癒、死亡、恢復）
  happyAgg: number[];                           // D027：城市平均每一項住宅幸福（實驗線 happyAgg 55255；項的順序＝rules/happy.ts HAPPY_NAMES）；沒有住宅是空的
  chain346: Chain346;                           // D028：T346 天然氣鏈當天的結果（實驗線 GV.chain346 鉤子的那幾欄）與旅宿床位、入住
  cityEvent: EventStep;                         // D030：T299 城市活動這一天的樣子（活動狀態、剛開始的事件編號、剛結束的事件編號；沒有＝−1）
  night: NightCity;                             // D029：T487 夜間城市當天的結算（實驗線 nightCity487 的那份；隔天的幸福與犯罪讀它，當天的晚間消費金、夜間運輸與營運費進了 settle）
}
// 實驗線 chain346（68749）：gasSup、gasDem、gasRatio（economy.ts 算）、fertOut、cookedOut、fertReady、cookedReady（income2.ts chainDay）、wageIdx（勞動市場的工資指數，只是鏡像）、mortPop、bankInt；hotelBeds、hotelOcc 是 55992 的旅宿
export interface Chain346 { gasSup: number; gasDem: number; gasRatio: number; fertOut: number; cookedOut: number; fertReady: boolean; cookedReady: boolean; wageIdx: number; mortPop: number; bankInt: number; hotelBeds: number; hotelOcc: number }
// 經濟一天的全部輸出：ec＝55305–55413 那一段的區域變數（同名）、late＝55996–56021 的出口、sn＝56030–56046 的快照三份與價格、cons＝55664–55671 煉鋼廠加速施工耗掉的鋼
export interface EconReport { ec: EconCtx; late: EconLate; sn: ReturnType<typeof economySnapshots>; cons: number }
// 當天的災禍（D026，src/sim/rules/hazard.ts）：每一項是格索引（y*N+x），照 tick() 的順序；burned 記燒毀當時的種類；alerts＝每一類第一件事的位置（實驗線每一類每天只跳一次提示）
export interface HazardReport {
  ignited: number[]; spread: number[]; burned: { i: number; k: number }[]; crimes: number[]; abandons: number[]; sicks: number[]; cures: number[]; deaths: number[]; ended: number[];
  cured: number; queued: number; sickN: number;   // 55836 medCured387、medQueued387、55856 sickN387
  penalty: number[];                                // 55014–55036 死亡前置：今天「喪事未安撫」被記幸福 −0.1 的住宅（格索引升序）；cemCap＝墓園容量、soothed＝今天安撫了幾個
  cemCap: number; soothed: number;
  events: CityEvent[]; burnedAge: number[];         // 要記進歷史的事件（fire、burn、crime、abandon、sick、death）；burned 每一棟燒毀當時的屋齡
  alerts: { kind: 'fire' | 'crime' | 'abandon' | 'sick' | 'death'; x: number; z: number }[];
}
export interface GarbReport { amount: number; cap: number; ratio: number; formal: boolean; districts: number; pen: number; far: number; unserved: number; dec: number }   // pen＝實驗線 garbPen409（探針讀得到）；dec＝評分用的比例
// 一天的結算（D011，src/sim/rules/money.ts）：收入、維護費、淨額，以及當天發生的里程碑、星等獎金、紓困
export interface SettleReport { income: number; upkeep: number; net: number; hospitals: number; tax: { R: number; C: number; I: number }; other: OtherIncome; imports: ImportCosts; milestone?: { pop: number; reward: number }; star?: { star: number; bonus: number }; bailout?: number; loanPaid?: number }   // tax＝實驗線的 taxR、taxC、taxI（住宅、商業、工業的稅，D025 拿來分項對拍）；other＝稅以外的收入逐項（沒有的是 0，D028 起給介面的「收支明細」）；imports＝六種進口費
// 第 2 類系統當天的值（農牧與旅宿的收入加成……本線沒搬；D025 起經濟閉環、D029 起夜間城市、D030 起城市活動搬了，稅乘數、進口費、出口金與活動的加成本線自己算，這裡給的會蓋過去）。
// 只給對拍用：把實驗線那一天探針讀出的值代進本線公式，收入、維護費、結算後資金要跟實驗線逐位相等（D011 驗收 3）。平常不傳＝沒有其他收入（D011 卡第 5 節）。
// D025：economy 是經濟段的輸入裡本線沒有的五樣——幸福（本線的城市幸福有已知的差，例如存檔裡的政策）、道路負載統計（T129，backlog C）、火車線數（T463）、天然氣發電調度（T471）、城市活動的食物加成（T299）
export interface Class2In {
  mul?: Partial<TaxMul>; nightCommerceGold487?: number; other?: Partial<OtherIncome>; eventTax?: number | null;
  economy?: { happy?: number; roadStats?: RoadStats; railLines?: number; gasPowerDispatch?: number; eventFood?: number };
  upkeep?: Partial<Omit<UpkeepIn, 'roadUpkeep' | 'counts' | 'pop' | 'tech' | 'spec' | 'svcBudget'>>;
}

// ---- 讀檔（實驗線 load() 66863 起，只搬模擬會讀到的部分）----
// 地面：路（rd 1–4 → road／hw／bridge，66879–66880）；無等級的路補 2（高速 5）（66896）；分區、樹。
// 建築：每筆 [i,k,lv,v,age,…]；住宅缺欄位補 den 3、we 1（66905 起）；一律 pw true、h .6；多格建築補 sz、h 1，ref 格指回根格（66900 起、FIX-J）。
// 亂數：R＝mulberry32(seed^day)（66876），接著天氣重設 wxT＝3＋ri(5)（66931）——讀檔就抽掉一個亂數，這裡照抽。
// 全域值：實驗線 load() 不重設 jobs／cityHappy／dem，對照跑法會先開新圖（newWorld 51110：pop 0、jobs 0、cityHappy .6、dem {1:.5,2:0,3:0}、immWave 0）。
// 例外是 pop（D021）：T510 把 load() 包了一層（68519），讀檔後 pop 就是住宅人口總和（loadPop488）；jobs 也被設成名目就業（68455–68457），本線還沒搬，第一天才算。
// forRestyle：只拿來讀檔重挑外觀（D012 只能看的城）——地價只算住商工根格（rebuildCov landAt），這個模擬不能拿來推進
export function simFromSave(save: LabSave, code: string, kinds: KindTable, vrank: Record<string, number[]>, msz: (k: number) => number = k => kinds.size(k), forRestyle = false): Sim {
  const city = cityFromLab(save, kinds, code), n = save.n, nn = n * n;
  const tiles: Tile[] = new Array(nn);
  const layerOf = (k: string) => { const v = save.raw[k]; return typeof v === 'string' ? v : undefined; };
  const office = save.layers.of, railL = save.layers.rl, lvl475 = layerOf('lvl475'), udl475 = layerOf('udl475'), ix475 = layerOf('ix475');
  for (let i = 0; i < nn; i++) {
    const rd = city.road[i], road = rd ? 1 : 0, hw = rd >= 3 ? 1 : 0;
    let rc = city.rclass[i];
    if (road && !rc) rc = hw ? 5 : 2;
    tiles[i] = { t: city.ter[i], road, hw, bridge: rd === 2 || rd === 4 ? 1 : 0, rc, zone: city.zone[i], tree: city.tree[i], bld: null };
    if (city.wp[i]) tiles[i].wp = 1;                                // D019：配水管（實驗線 load 66881 wp:+d.wp[i]）
    if (city.ruin[i]) tiles[i].ruin = 1;                            // D026：焦土（66881 ruin:d.rn?+d.rn[i]:0；存檔寫 t.ruin?1:0，66716）
    // D024：辦公區（of：商業就業 ×1.5，55242）、鐵路格（rl）與 T475 的四個格子旗標（手工配電線 lvl475、地下線 udl475、高架 fly475、立交 ix475：維護費 52913、電力載體 50950）
    if (office && office.charCodeAt(i) === 49) tiles[i].office = 1;
    if (railL && railL.charCodeAt(i) === 49) tiles[i].rail = 1;               // 鐵路格（rl）：聯運樞紐 k166 的「運作中」要鄰近 ≥2 格（51250）
    if (lvl475 && lvl475.charCodeAt(i) === 49) tiles[i].lv475 = 1;
    if (udl475 && udl475.charCodeAt(i) === 49) tiles[i].ud475 = 1;
    if (city.fly[i]) tiles[i].fly475 = 1;
    if (ix475) { const q = ix475.charCodeAt(i) - 48; if (q > 0) tiles[i].ix475 = q; }
  }
  const root = new Map<number, CityBuilding>();
  for (const r of save.bl) {
    const [i, k, lv, v, age] = r, b = city.buildings[city.occ[i] - 1];
    if (!b || b.z * n + b.x !== i) continue;                     // 重疊、出界的那筆城市模型已計數略過，這裡同樣不建
    const sz = k === 9 ? stadiumSize(r[5]) : msz(k);
    const bld: Bld = k === 9 ? { k, lv: lv || 1, v, age, pw: true, h: 1, sz }           // 體育場：第 6 位是 sz（66900）
      : k === 1 ? { k, lv, v, age, pw: true, h: .6, fire: r.length >= 7 ? r[5] : (r.length === 6 ? r[5] : 0), den: r.length >= 7 ? r[6] : 3, we: r.length >= 8 ? r[7] : 1 }
      : { k, lv, v, age, pw: true, h: .6, fire: r[5] || 0 };
    if (k !== 9 && sz > 1) { bld.sz = sz; bld.h = 1; }
    if (k === 127) bld.we = 0;                                   // D027：社宅的財富級由建築種類固定恢復（實驗線 load 66913：lv＝1、we＝SOCIAL_HOUSING_WE＝0〔39460〕，不存檔）；沒補之前社宅的 we 是空的，空氣污染等乘 WEALTH_PEN 的幸福項照中級算（差 1.2–1.9 倍）。lv＝1 沒搬：實驗線自己存的社宅本來就是 1 級，城市模型顯示存檔的等級，兩邊要一致
    tiles[i].bld = bld;
    for (let dz = 0; dz < sz; dz++) for (let dx = 0; dx < sz; dx++) if (dx || dz) {
      const x = b.x + dx, z = b.z + dz;
      if (x < n && z < n) tiles[z * n + x].bld = { k, lv: 0, v: 0, age: 0, ref: [b.x, b.z] };
    }
    if (k <= 3 && b.abandoned) (bld as Bld & { abandoned?: number }).abandoned = 1;
    root.set(i, b);
  }
  // D026：犯罪、生病、死亡與各自的天數（實驗線 load 66914–66925）：住商工（k≤3）才有犯罪，只有住宅（k1）有生病與死亡；天數只還原病中／死亡中／犯罪中的格。
  // 廢棄 ab 上面（cityFromLab → bld.abandoned）與火災（bl 第 6 位）已經讀了。字元一個一個讀（+s[i]：缺、不是數字＝NaN＝假），跟實驗線的 +d.cm[i] 一樣
  const cm = layerOf('cm'), sk = layerOf('sk'), dt = layerOf('dt'), skd = layerOf('skd'), cmd = layerOf('cmd'), dtd = layerOf('dtd');
  if (cm || sk || dt) for (let i = 0; i < nn; i++) {
    const b = tiles[i].bld; if (!b) continue;
    if (cm && b.k <= 3 && +cm[i]) b.crime = 1;
    if (sk && b.k === 1 && +sk[i]) b.sick = 1;
    if (dt && b.k === 1 && +dt[i]) b.death = 1;
  }
  if (skd) for (let i = 0; i < nn; i++) { const b = tiles[i].bld; if (b && b.k === 1 && b.sick) { const v = +skd[i]; if (v) b.sickDays = v; } }
  if (cmd) for (let i = 0; i < nn; i++) { const b = tiles[i].bld; if (b && b.k <= 3 && b.crime) { const v = cmd.charCodeAt(i) - 48; if (v > 0) b.crimeDays = v; } }
  if (dtd) for (let i = 0; i < nn; i++) { const b = tiles[i].bld; if (b && b.k === 1 && b.death) { const v = +dtd[i]; if (v) b.deathAge = v; } }
  const w: World = { N: n, tiles };
  const econ = econOfSave(save);
  const g = allocGrids(n), budget = budgetOfSave(save.raw.sb), edu: EduCtx = { tech: [], spec: null, schoolLunch: false };   // D023：sb（四類服務預算）66964
  const landAt = forRestyle ? [...root.keys()].filter(i => { const k = (tiles[i].bld!.k | 0); return k >= 1 && k <= 3; }) : undefined;
  rebuildCov(w, g, budget, edu, landAt);                         // 66940／66965
  const rng = labRng(save.seed ^ save.day);
  const weather: WeatherState = { weather: 0, wxT: 3 + rng.ri(5) };
  return {
    city, w, g, rng, seed: save.seed, day: save.day, weather, vrank, budget, edu,
    pop: loadPop488(tiles), jobs: 0, jobsC: 0, jobsI: 0, cityHappy: .6, dem: { 1: .5, 2: 0, 3: 0 }, immWave: 0, labor: null, medCap: null, commuteClusters: [], commuteDay: -1, tvSignal: false, fertReady: false, cookedReady: false, cityEvent: eventOfSave(save.raw.cev), night: emptyNightCity(), econ,
    root, kinds,
    landDirty: false, landBox: null, stale: new Uint8Array(nn),          // rebuildCov 剛整張算過（53154 清框）
    noiseSig: -1,                                                         // 56934：讀檔時 NOISE 清 0、簽名 −1（rebuildCov 不算噪音，第一天開頭才補上）
    money: save.money, diff: save.df, loan: save.ln ? { remain: save.ln[0], daily: save.ln[1] } : null, msIdx: save.msIdx, bestStar: save.star, bailoutDay: -999,
    stroke: 1, txns: [], dozeArm: null,
  };
}

// 存檔的服務預算 sb（D023，實驗線 load() 66964）：有 sb 就逐鍵看，是數字才收、夾在 .5–1.5，不是數字的鍵保留預設 1（新開的世界原值就是 1）；沒有 sb 就全 1。
// 覆蓋場的半徑（stampCov 52977）與每天的維護費（settleToday 傳的 s.budget）都讀它
export function budgetOfSave(sb: unknown): SvcBudget {
  const b: SvcBudget = { ...SVC_BUDGET_DEFAULT };
  if (sb && typeof sb === 'object') for (const k of Object.keys(b) as (keyof SvcBudget)[]) { const v = (sb as Record<string, unknown>)[k]; if (typeof v === 'number') b[k] = clamp(v, .5, 1.5); }
  return b;
}

// 存檔的商品庫存與船（D025，實驗線 load() 66952–66959）：sup（供應品）、gds（貨物）、fuel364、steel364、shipCount、shipProgress，數字才收（`(+d.x)||0`：缺、非數字、NaN 都是 0）；
// 快照不存＝讀檔第一天商工需求走舊式；gWhCap284（昨天的倉容量）不入存檔，由存檔裡的倉儲物流中心（k64，每座 120＋(等級−1)×60）重算（66959）
export function econOfSave(save: LabSave): EconState {
  const num = (v: unknown) => (+(v as number)) || 0, r = save.raw, e = emptyEconState();
  e.supplies = num(r.sup); e.fuel = num(r.fuel364); e.steel = num(r.steel364); e.shipCount = num(r.shipCount); e.shipProgress = num(r.shipProgress); e.goods = num(r.gds);
  for (const rec of save.bl) if (rec && rec[1] === 64) e.gWhCap += 120 + ((+rec[2] || 1) - 1) * 60;
  return e;
}

// 讀檔後、第一天之前的 pop（D021）：實驗線 load() 被 T510 包了一層（68519 只多呼叫 balancePrepareAuthorities510），
// 68443–68448 pop＝round(Σ 每棟 residentPopulation488)（64188 一帶；住房沒就緒＝入住率 1）。讀檔蓋出來的建築只有 pw:true（66898–66925），
// 沒有 wa、沒病沒死，所以住宅 k1、塔、巨廈照算，社宅 k127（要 pw 且 wa）讀檔時是 0——本線 simFromSave 蓋的建築一樣，直接用。
// （68507 那行 pw／wa 全設 true 在 QA 治具函式裡，不是讀檔。）第一天開頭的 sewNeed（55011：pop ≥ 500）讀的就是它
function loadPop488(tiles: Tile[]): number {
  let p = 0;
  for (const t of tiles) { const b = t.bld; if (b && !b.ref && (b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105)) p += residentPopulation488(b, () => undefined); }
  return Math.round(p);
}

// 地價基準的輸入在 (x,y) 半徑 r 的方框裡變了（本線的逐格標記；實驗線沒有，它整張重算）
export function markStale(s: Sim, x: number, y: number, r: number) {
  const N = s.w.N, x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(N - 1, x + r), y1 = Math.min(N - 1, y + r);
  for (let yy = y0; yy <= y1; yy++) s.stale.fill(1, yy * N + x0, yy * N + x1 + 1);
}

// ---- 一天（tick() 54945–56192 的順序）----
// fullLand：每天整張重算地價基準（實驗線的做法），給守衛比對「只重算變動那一框」的結果逐位相同
export function stepDay(s: Sim, opts: { fullLand?: boolean; class2?: Class2In; hazard?: HazardX } = {}): DayReport {
  const { w, g } = s, N = w.N, nn = N * N, f = fieldsOf(g);
  const hzx = nightHazardIn(s, f, opts.hazard);                              // D029：隔天讀的夜間城市（前一天的 s.night：住宅幸福項 55233、犯罪乘數 55817）；守衛注入的（hazard.nightCity／nightCrimeMul）蓋過去
  // 54948 buildTickIndex：有建築的格（含 ref）、分區格、商業分區格數，都升序
  const tickBld: number[] = [], tickZone: number[] = [];
  const tickRoad: number[] = [];                                             // 54940 tickRoad：所有道路格，升序
  let czone = 0;
  // 每天本來就要走過每一格一次：順手把三個「整圖掃描」的結果一起算（同一個由小到大的順序，浮點加總逐位相同；不必各掃一趟）——
  // 道路維護費 roadUpkeep（money.ts）、基建維護費 infraUpkeep475（同）、第一個高壓線格 hvFirst（power.ts hvEnergizedSubstations471；沒有＝nn）。守衛核對跟原函式逐位相同
  let roadUp = 0, infraUp = 0, hvFirst = nn;
  for (let i = 0; i < nn; i++) {
    const t = w.tiles[i], b = t.bld;
    if (b) tickBld.push(i);
    if (t.zone) { tickZone.push(i); if (t.zone === 2) czone++; }
    if (t.road) { tickRoad.push(i); roadUp += ROAD_UPKEEP[((t.rc as number) || 2) - 1]; }
    if (t.lv475) infraUp += .035; if (t.ud475) infraUp += .018; if (t.fly475) infraUp += .11; if (t.ix475) infraUp += .24;
    if (b && !b.ref) infraUp += INFRA_UPKEEP475[b.k] || 0;
    if (hvFirst === nn && (t.hv471 || t.ug471)) hvFirst = i;
  }
  const scan = { roadUpkeep: roadUp, infraUpkeep475: +infraUp.toFixed(2) };
  const roads = tickRoad.length;                                            // roads＝tickRoad.length：貿易額度的底（55334）
  // 55050–55149 主計數迴圈（建築索引、跳過 ref 格）：D016 數學校、垃圾場、體育場、水塔、診所、圖書館、郵局、墓園（fac）；D022 數食物來源、觀光建築、貿易設施（rules/food.ts countFood）；
  // D024 補齊剩下的（rules/count.ts countMore：升級加成就業、電廠以外的發電、產業鏈、物流與運作中判斷、旅宿配套、科技園區、公共設施……）。三份計數合起來就是實驗線的 157 個計數
  // （資源開採量 suppliesGain／oilGain／oreGain 除外，給 0）；給固定就業（55246–55250）與維護費（55973–55977）
  const fert = { ready: s.fertReady, fertco: f.COV.fertco };                // 55089：昨天的化肥與化肥廠覆蓋場（T346，D028）
  const tally = tallyBuildings(w, tickBld, fert), { fc, cnt, towerPop, megaPop } = tally;   // 55040 towerPop488、megaPop488（D021）：住宅塔、巨廈的居民，不看有沒有電；cnt＝三份計數合成一份
  // 54949 噪音（D017，rebuildNoise 53023）：照建築索引算；來源簽名變了（讀檔後第一天一定變）就把地價設成整張重算。
  // 本線的「整張重算」只算 stale 格，所以噪音變了的格要標 stale（其餘格的噪音沒變、地價基準的輸入沒變，算出來逐位相同）
  {
    const prev = g.NOISE.slice();
    rebuildNoise(w, g, s, tickBld);
    for (let i = 0; i < nn; i++) if (prev[i] !== g.NOISE[i]) s.stale[i] = 1;
  }
  s.day++;                                                               // 54950
  // 54952 事故 T493：關（第 1 類，沒有事故）
  // 54953–54954 城市活動 T299（D030，rules/events.ts）：倒數與觸發，沒有亂數；pop 是前一天的人口（這時還沒重算）。今天的加成——住宅幸福項 55179、食物點數 55293、收入 56028——都讀這一天的活動。
  // 守衛注入的（hazard.eventHappy、class2.economy.eventFood、class2.eventTax）蓋過去
  const evs = eventStep(s.cityEvent, s.day, s.pop); s.cityEvent = evs.state;
  const evd = s.cityEvent ? CITY_EVENTS[s.cityEvent.i] : null;
  // 54956 乾旱只由災害設定；災害關（第 1 類）
  const wx = weatherStep(s.weather, s.day, s.rng);                        // 54964–54975（F10，唯一在生長前抽亂數的一步）
  s.weather = { weather: wx.weather, wxT: wx.wxT };
  // 54991 通勤（T141，每 4 天）、54992 路徑累加、54995 道路負載（T129；D027，rules/commute.ts）：叢集路徑每天走過的格子 +1，負載＝昨天 ×.85＋今天 ×.15。
  // jam＝每格半徑 2 內過載道路格數（congestNear 52946，一次算好給住宅幸福與動態地價用）
  s.commuteClusters = trafficStep(s.day, w, g, s.commuteClusters, tickBld);
  if (isCommuteDay(s.day)) s.commuteDay = s.day;
  jamCounts(w, g.roadLoad, g.jam);
  // 54996–55001 地價基準髒重建：landDirty 時，有框只重算框裡，沒框整張（前一天 55279 設成整張；玩家施工把它換成框，見 Sim.landDirty）。
  // 54997 rebuildNoise(null)：跟 54949 那一次之間建築沒變（天氣、通勤、道路負載都不動建築），噪音與簽名都一樣，不重算（D017）。
  // 整張＝重算 stale 格（地價基準只取決於該格的覆蓋、污染、噪音與半徑 4 的犯罪（landStaticAt）；輸入沒變的格算出來一樣）；
  // opts.fullLand＝逐字照實驗線把整張算一遍（守衛的慢速版，結果要逐位相同）
  // 半徑 4 的犯罪累加表：這一天用兩次——地價基準重算（每個待重算的格數一次，編輯之後的那幾天是幾千格）與下面的住宅幸福（52934 countNear，結果同逐格數，守衛核對）。
  // 兩處之間沒有東西改犯罪旗標與建築種類（旗標只有 crimeStep 與玩家的「處理犯罪」會動，都在別的時間點）
  const crimeNear = nearCounter(w, crimeFlag, tickBld);
  if (s.landDirty) {
    if (s.landBox) { const [x0, y0, x1, y1] = s.landBox; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * N + x; g.LANDBASE[i] = landStaticAt(w, f, x, y, crimeNear); s.stale[i] = 0; } }
    else if (opts.fullLand) { rebuildLandBase(w, g); s.stale.fill(0); }
    else { for (let i = 0; i < nn; i++) if (s.stale[i]) g.LANDBASE[i] = landStaticAt(w, f, i % N, (i / N) | 0, crimeNear); s.stale.fill(0); }
    s.landDirty = false; s.landBox = null;                              // 55000
  }
  recomputeLandDynamic(g);                                                // 55002：LAND＝LANDBASE 扣壅堵（過載道路半徑 2 內每格 −12、上限 −50）
  // 55006 住房市場 T488：關（第 1 類；沒就緒：入住率 1、住房懲罰 0、新住宅密度＝道路等級、升級係數 1）
  const sea = season(s.day);
  // 55007 夜間城市 T487 的輸入（prepareNightInputs487）：今天生長之前的道路與建築（tickRoad、tickBld 此刻還沒有新長的）；55866 才結算。政策（K）生產路徑沒有＝null
  const nightPol = hzx?.pol ?? null, catOf = (k: number) => { const c = s.kinds.cat(k); return c === '?' ? 'S' : c; };   // 實驗線 kcatOf＝KCB[k]||'S'（37275）：內容表沒有的種類（新版實驗線的存檔）算市政 S
  const nightIn = prepareNightInputs(w, tickRoad, tickBld, catOf, s.day, nightPol);
  const nominal = computePower(w, false, false, hvFirst).cap, cap = powerCap(nominal, sea);   // 55008（F11，舊版供電）；55009 T471 調度略過
  // 55010 水（D019）：舊式供水網（第 1 類，__legacyWater449；src/sim/rules/water.ts），重算每一格的 wr、容量＝水塔×80＋淡化廠×80。
  // 乾旱（×DROUGHT_WATER_MULT）只由災害設定，災害關：恆 ×1。水壓／水質懲罰走舊式＝0
  const wCap = Math.floor(computeWaterLegacy449(w));
  const sewNeed = s.pop >= 500;                                           // 55011 sewerRequired442：昨天的人口 ≥500
  const sewOkArr = new Uint8Array(nn);                                    // 沒有污水處理廠：需要時全城都不合格（兩種模式相同）
  // 55014–55036 死亡前置（D026，rules/hazard.ts）：死亡中的住宅 deathAge++、滿 10 天恢復，未安撫的鄰居記 deathPenalty（住宅幸福 −.1）；55046 每日計數歸零（本線每天重新數）
  const dp = deathPre(w, f, tickBld);
  const powered = assignPower(w, tickBld, cap);                           // 55154–55156（F11）：按建築索引、兩格內有帶電道路且容量未用完
  assignWater(w, tickBld, wCap);                                          // 55157–55160（D019）：有電、兩格內有接得到水源的水管、容量還沒用完
  let popN = 0, jobsC = 0, jobsI = 0, happySum = 0, happyN = 0;
  const aggSum: number[] = [];                                           // 55237–55238 happyAggSum：每一項幸福逐棟加總（跟實驗線同一個加總順序）
  let eduSum = 0, eduCnt = 0, mortPop = 0;                              // 55165–55166（D028）：住宅與社宅的教育總和與棟數（科技園產值的教育均值）、房貸人口（銀行覆蓋且有電的住宅 k1 的居民數，銀行利息）
  // 這一格各服務的覆蓋（HappyIn.c）：一天建一個鍵齊全的物件，每棟只覆寫值（residentialHappy 讀完就丟、不留參照）。
  // 以前每棟新建一個約 60 個鍵的物件，佔推進一天三成的時間（D011 效能；鍵與值都跟以前一樣）
  const covKeys = Object.keys(g.COV), covArrs = covKeys.map(k => g.COV[k]), cov: Record<string, number> = {};
  for (const k of covKeys) cov[k] = 0;
  const covAt = (i: number) => { for (let j = 0; j < covKeys.length; j++) cov[covKeys[j]] = covArrs[j][i]; return cov; };
  // 半徑 3 的工業、半徑 4 的犯罪（countNear 52934）：主迴圈裡建築的種類與犯罪旗標不變，先做累加表（結果同逐格數，守衛核對）
  const indNear = nearCounter(w, tt => tt.bld && tt.bld.k === 3, tickBld);
  for (const i of tickBld) {                                              // 55050／55150 主迴圈
    const t = w.tiles[i], b = t.bld;
    if (!b || b.ref) continue;
    if (b.k > 3 && b.k !== 127) continue;
    const x = i % N, y = (i / N) | 0;
    if (b.k === 1 || b.k === 127) {
      const residentPop = residentPopulation488(b, () => undefined);      // 55163：住房沒就緒＝入住率 1
      eduSum += f.EDU[i]; eduCnt++;                                       // 55165
      if (b.k === 1 && f.COV.bank && f.COV.bank[i] > 0 && b.pw) mortPop += residentPop;   // 55166（__noMort 回退設定沒有開）
      const hp = residentialHappy({                                       // 55164–55236（F7）
        c: covAt(i), POL: g.POL[i], NOISE: g.NOISE[i], commutePenalty: g.commutePenalty[i],
        we: b.we, k: b.k, lv: b.lv, pw: b.pw, sick: b.sick, death: b.death,
        ind: indNear(x, y, 3),
        crime: crimeNear(x, y, 4),
        rc: getMaxRoadClass(w, x, y, 1), jam: g.jam[i],
        drainPen: 0, waterLegacy: true, waterPen: 0, deathPenalty: dp.penalty[i] === 1, sewNeed, sewOk: !sewNeed,
        weather: s.weather.weather, day: s.day, nightCity: hzx?.nightCity ?? NIGHT_OFF, housingPen: 0,
        eventHappy: opts.hazard?.eventHappy ?? (evd ? evd.happy : null), cookedReady: s.cookedReady, pol: opts.hazard?.pol ?? null, rankIdx: 0, tvSignal: s.tvSignal, tech: s.edu.tech,   // 政策（K）沒搬：只有守衛注入（免費公交、公園夜間開放、宵禁；政策同一個物件也給災禍段）；夜間城市 D029、城市活動 D030 起本線自己算（nightCity＝前一天的 s.night、eventHappy＝今天的活動；守衛還能蓋過去）
      });
      b.h = hp.h;
      for (let k = 0; k < hp.parts.length; k++) aggSum[k] = (aggSum[k] ?? 0) + hp.parts[k];   // 55237–55238
      happySum += b.h; happyN++;                                          // 55239
      if ((b.k === 127 ? b.pw && b.wa : b.pw) && !b.sick && !b.death) popN += residentPop;   // 55240
    } else if (b.pw) {                                                    // 55241–55242（F8）
      if (b.k === 2) jobsC += rciJobs(b, !!t.office); else jobsI += rciJobs(b, false);
    }
  }
  // 55246–55250（F8）：名目就業＝商工＋各設施固定就業（D024 起全部的種類；電廠、警察局、公園、消防、醫院、派出所沒有固定就業）
  const jc = jobCountsOf(tally, w, tickBld, jobsC, jobsI);                // 每一個固定就業的計數＋四個掃圖函式（電力、水務、基建、車庫）
  let pop = popN + towerPop + megaPop, jobs = nominalJobs(jc);            // 55246 pop=popN+towerPop488+megaPop488（D021：塔、巨廈的居民不看有沒有電）
  // 55251 企業 T489：關（第 1 類；enterpriseRollback489 39560）＝四捨五入的名目值
  jobs = Math.max(0, Math.round(jobs)); jobsC = Math.max(0, Math.round(jobsC)); jobsI = Math.max(0, Math.round(jobsI));
  let cityHappy = happyN ? happySum / happyN : .6;                        // 55254（住宅 k1 與社宅 k127）
  s.tvSignal = fc.tv330 > 0;                                              // 55252：今天的電視台數，明天的住宅幸福讀它
  const happyAgg = happyN ? aggSum.map(v => v / happyN) : [];             // 55255：城市平均每一項幸福（實驗線 happyAgg，showStats 讀）
  // 55256–55278 垃圾（D020，src/sim/rules/garbage.ts）：產量、清運網、全城比例；500 人以上分清運區算負載。
  // 回收政策沒搬：係數 1（55257）；企業關：工業用四捨五入後的 jobsI（55258）
  const recycleMul = 1;
  const gd = garbageDay(w, tickBld, pop, jobsI, cityHappy, recycleMul);
  const { garbage, garbCap, garbRatio, garbPen409, san, loc: garbLoc } = gd; cityHappy = gd.cityHappy;
  // 55262–55266 資源回收廠（k111）產貨物（D025，rules/economy.ts recycleGoods）：清運區算好之後、用昨天的倉容量（今天的在經濟段才算）
  recycleGoods(s.econ, { formal: san.formal, activeByK: san.activeByK, districts: san.districts }, garbage, cnt.upc342 ?? 0);
  s.landDirty = true; s.landBox = null;                                   // 55279 rebuildAccess468（64146 → 64129）每天把地價設成「隔天整張重算」
  { let s1 = 0, n1 = 0; for (const i of tickBld) { const b = w.tiles[i].bld; if (!b || b.k !== 1) continue; s1 += b.h as number; n1++; } if (n1) cityHappy = s1 / n1; }   // 55282–55284：只用住宅 k1 重算
  // 55286–55413 經濟（D025，src/sim/rules/economy.ts）：T485 物流單位、食物與遊客（D022 food.ts）、T364b／T418 深加工鏈、共享貿易額度與六種商品的進出口、貨物與零售、價格、四個稅乘數、太空研究中心。
  // 錢：太空研究中心的獎金在 55408 直接加進 money（在當天結算之前）。整段沒有亂數。道路負載、火車線、天然氣發電調度沒搬＝0
  const labor = laborMarket481(pop, jobs, null, s.day);                   // 55329（F2，企業沒就緒那一支）
  const x2 = opts.class2?.economy;
  const ec = economyMain(s.econ, { day: s.day, sea, pop, jobs, cityHappy: x2?.happy ?? cityHappy, money: s.money, spec: s.edu.spec, roads, roadStats: x2?.roadStats ?? roadStatsOf(w, tickRoad, g.roadLoad), railLines: x2?.railLines, gasPowerDispatch: x2?.gasPowerDispatch, eventFood: x2?.eventFood ?? (evd ? evd.food : undefined), c: cnt, fc, labor, wealth: wealthPower481(w, tickBld, pop), activeConstruction: activeConstruction482(w, tickBld) });
  s.money += ec.mgReward;
  // 55414–55424 糧食的每日加減（D022）：每棟住宅（k1）的幸福加 clamp((供糧率−.5)×.11, −.06, .05)、用住宅重算城市幸福。在經濟之後、災害與生長之前。55426 災害：關（第 1 類）
  const fd = ec.fd;
  cityHappy = applyFoodHappy(w, tickBld, fd.need, fd.delta, cityHappy);
  const L = legacyDemand({ pop, jobs, cityHappy, czone, jobsC, jobsI, indSubsidy: false, tech: s.edu.tech });   // 55578–55584（F1）
  const E = economyDemands481(L.legacyR481, L.legacyC481, L.legacyI481, labor, s.econ.snap);                    // 55585（F3）：讀昨天的經濟快照（讀檔與新圖第一天沒就緒＝舊式）
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
  const cons = steelConstruction(s.econ, cnt.steelMillN ?? 0, w, tickBld, s.day);   // 55655–55672 煉鋼廠加速施工（D025）：用鋼庫存讓施工中的房屋多長一天
  if (s.day % 30 === 0) {                                                 // 55676–55686：每 30 天住宅財富往判定值移一級（F9 judgeWealth）
    for (const i of tickBld) {
      const b = w.tiles[i].bld;
      if (!b || b.k !== 1) continue;
      const cur = b.we !== undefined ? b.we : 1, tgt = judgeWealth(w, f, i % N, (i / N) | 0);
      if (tgt > cur) b.we = cur + 1; else if (tgt < cur) b.we = cur - 1;
    }
  }
  // 55691 摩天樓合併：起步城用不到（要有水，第 3 類）
  // 55757–55865 每天的災禍（D026，rules/hazard.ts）：火災 → 犯罪 → 廢棄 → 疾病 → 死亡，共用同一條亂數流
  const hz = hazardDay(s, tickBld, f, dp, hzx);
  // 55866 夜間城市 T487（D029，rules/nightcity.ts）：災禍之後、收稅之前結算一次。購買力、貨物供給率、遊客、失業率是經濟段今天算好的；公交乘客（T463／T468）本線沒有＝0。
  // 隔天的幸福與犯罪讀它（s.night）；當天的晚間消費金 55968、夜間運輸收入與營運費 56027 進下面的稅與收支。沒有亂數
  const night = finalizeNightCity(nightIn, { purchasingPower: ec.purchasingPowerNow481, goodsSupply: ec.supplyRate481, transitRidership: 0, tourists: ec.tourists, unemployment: ec.laborNow481.unemploymentRate },
    nightPoliceCoverage(w, tickBld, catOf, f.COV), roads, s.day, nightPol);
  s.night = night;
  const garbDec = garbDecisionRatio452(san, w, garbRatio, recycleMul);   // 56117：評分讀的垃圾比例（清運區在 55261 算好，生長不動它）
  // 55996–56021 出口的金幣與燃料、鋼材出口（在貨物出口之後才抽貿易池）、56030–56046 快照（隔天的商工需求讀 economy481）：D025
  const late = economyLate(s.econ, ec, cnt), sn = economySnapshots(s.econ, ec, late, cnt, s.day, cons);
  // 55992–56024（D028）：T346 鏈條結算（化肥、熟食、工資指數）與其餘收入。鏈條的旗標留到明天（農場計數與住宅幸福讀昨天的）
  const chain = chainDay({ fp346: cnt.fp346 ?? 0, kitchenFoodUse482: ec.kitchenFoodUse482, gasRatio: ec.gasRatio });
  s.fertReady = chain.fertReady; s.cookedReady = chain.cookedReady;
  const extras = incomeExtras({
    sea, foodPrice: ec.foodPrice481, tourists: ec.tourists, farmGoldU: cnt.farmGoldU ?? 0, ranchGoldU: cnt.ranchGoldU ?? 0, ghGoldU: cnt.ghGoldU ?? 0,
    foodPlantUse482: ec.foodPlantUse482, marketFoodUse482: ec.marketFoodUse482, brewFoodUse482: ec.brewFoodUse482,
    gh330: cnt.gh330 ?? 0, ht330: cnt.ht330 ?? 0, rs330: cnt.rs330 ?? 0, hs340: cnt.hs340 ?? 0, mk330: cnt.mk330 ?? 0, br340: cnt.br340 ?? 0, tpk342: cnt.tpk342 ?? 0, dtc342: cnt.dtc342 ?? 0,
    cookedOut: chain.cookedOut, mortPop, eduSum, eduCnt,
  });
  const chain346: Chain346 = { gasSup: ec.gasSup, gasDem: ec.gasDem, gasRatio: ec.gasRatio, fertOut: chain.fertOut, cookedOut: chain.cookedOut, fertReady: chain.fertReady, cookedReady: chain.cookedReady,
    wageIdx: ec.laborNow481.wageIndex, mortPop, bankInt: extras.bankInt, hotelBeds: extras.hotelBeds, hotelOcc: extras.hotelOcc };
  s.econ.snap = sn.economy481;
  const settle = settleToday(s, tickBld, cnt, garbDec, scan, opts.class2, econToday(ec, late, extras), night, evd ? evd.tax : null);   // 55868–56145（D011）：收稅、維護費、結算、里程碑、星等、紓困
  s.medCap = medCapOf({ clinics: cnt.clinics ?? 0, hospitals: settle.hospitals, am: cnt.am ?? 0, mhN: cnt.mhN ?? 0, gmc466: cnt.gmc466 ?? 0 });   // 56151–56163 flowStat384：明天的疾病段讀它（讀檔後第一天沒有＝無限）
  syncCity(s, spawned.map(p => ({ i: p.y * N + p.x, b: p.b })), ups);
  syncHazards(s, hz);                                                     // 燒毀＝墓碑與焦土、廢棄＝abandoned、災禍事件記進歷史（在生長、升級的事件之後，同 tick 順序）
  s.txns.length = 0;                                                      // 過了一天：之前的施工不能再復原（D011 卡第 4 節）
  return {
    day: s.day, pop, jobs, jobsC, jobsI, cityHappy, dem: [dem[1], dem[2], dem[3]], employed: labor.employed, workers: labor.workers,
    weather: s.weather.weather, cap, powered, grown: spawned.length, upgraded: ups.length, money: s.money, settle,
    garb: { amount: garbage, cap: garbCap, ratio: garbRatio, formal: san.formal, districts: san.districts.length, pen: garbPen409, far: garbLoc.far, unserved: garbLoc.unserved, dec: garbDec },
    food: fd, econ: { ec, late, sn, cons }, hazard: hz, happyAgg, chain346, cityEvent: evs, night,
  };
}

// 隔天讀的夜間城市（D029）：前一天結算的 s.night 餵住宅幸福項（55233：ready ? happinessDelta : 0）與犯罪抽籤的乘數（55817 nightCrimeMul487：有警察覆蓋的格 sLocal＝1；犯罪抽籤只抽沒有警察覆蓋的格，實際永遠是 0）。
// 沒算過（讀檔、新圖之後第 1 天）＝什麼都不給：幸福項 0、犯罪乘數 1。守衛注入的（x.nightCity、x.nightCrimeMul）蓋過去；其餘欄位（政策、活動加成）原樣帶著
const NIGHT_OFF = { ready: false, happinessDelta: 0 };
export function nightHazardIn(s: Sim, f: Fields, x?: HazardX): HazardX | undefined {   // 匯出給守衛直接測
  const n = s.night;
  if (!n.ready) return x;
  const pol = x?.pol ?? null, p1 = f.COV.police, p2 = f.COV.police2;
  return { ...x, nightCity: x?.nightCity ?? { ready: true, happinessDelta: n.happinessDelta },
    nightCrimeMul: x?.nightCrimeMul ?? ((i, b) => nightCrimeMul(n, !!((p1 && p1[i] > 0) || (p2 && p2[i] > 0)), b, pol)) };
}

// 55757–55865：火災 → 犯罪 → 廢棄 → 疾病 → 死亡（rules/hazard.ts），在生長、升級、合併之後、稅收之前；一樣照實驗線：犯罪標地價髒框（55818 markLandDirty(x,y,4)），
// 燒毀的格子與工業污染源的範圍標 stale（本線的「整張重算」只算 stale 格，見 markStale）。回報裡 events 是要記進歷史的事件（syncHazards 才寫，順序在當天的生長、升級之後）
function hazardDay(s: Sim, tickBld: number[], f: Fields, dp: DeathPre, x?: HazardX): HazardReport {
  const { w, g } = s, N = w.N, tech = s.edu.tech, day = s.day, ev: CityEvent[] = [];
  const at = (i: number) => ({ x: i % N, z: (i / N) | 0 }), kindAt = (i: number) => w.tiles[i].bld?.k ?? 0;
  const fr = fireStep(w, g, f, s.rng, tickBld, day, tech, x);
  for (const i of fr.ignited) ev.push({ day, t: 'fire', ...at(i), k: kindAt(i) });
  for (const i of fr.spread) ev.push({ day, t: 'fire', ...at(i), k: kindAt(i) });
  for (const b of fr.burned) {
    const { x: bx, z: bz } = at(b.i);
    ev.push({ day, t: 'burn', x: bx, z: bz, k: b.k, id: s.root.get(b.i)?.id ?? 0 });
    markStale(s, bx, bz, 4); if (b.k === 3) markStale(s, bx, bz, POL_SRC[3].r);     // 燒毀的犯罪旗標跟著沒了（地價的犯罪項）；工業燒毀撤污染源
  }
  const cr = crimeStep(w, f, s.rng, tickBld, tech, x);
  for (const i of cr.crimes) { const c = at(i); markLandDirty(s, c.x, c.z, 4); markStale(s, c.x, c.z, 4); ev.push({ day, t: 'crime', ...c, k: kindAt(i) }); }
  const ab = abandonStep(w, s.rng, tickBld);
  for (const i of ab.abandons) ev.push({ day, t: 'abandon', ...at(i), k: kindAt(i), id: s.root.get(i)?.id ?? 0 });
  const ds = diseaseStep(w, f, s.rng, tickBld, s.medCap ?? Infinity);
  for (const i of ds.sicks) ev.push({ day, t: 'sick', ...at(i) });
  const dh = deathStep(w, s.rng, tickBld);
  for (const i of dh.deaths) ev.push({ day, t: 'death', ...at(i) });
  const alerts: HazardReport['alerts'] = [];
  for (const [kind, i] of [['fire', fr.first], ['crime', cr.first], ['abandon', ab.first], ['sick', ds.first], ['death', dh.first]] as const) if (i >= 0) alerts.push({ kind, ...at(i) });
  return { ignited: fr.ignited, spread: fr.spread, burned: fr.burned.map(b => ({ i: b.i, k: b.k })), crimes: cr.crimes, abandons: ab.abandons, sicks: ds.sicks, cures: ds.cures, deaths: dh.deaths, ended: dp.ended,
    cured: ds.cured, queued: ds.queued, sickN: dh.sickN, penalty: penaltyList(dp.penalty), cemCap: dp.cemCap, soothed: dp.soothed, alerts, events: ev, burnedAge: fr.burned.map(b => b.age) };
}
const penaltyList = (p: Uint8Array) => { const o: number[] = []; for (let i = 0; i < p.length; i++) if (p[i]) o.push(i); return o; };
// 災禍寫進城市模型與歷史：燒毀的建築成了墓碑（屋齡停在燒毀那一天）、佔的格子空了、焦土圖層記上；廢棄的建築 abandoned；事件照 tick 順序接在當天的生長、升級後面
function syncHazards(s: Sim, hz: HazardReport) {
  const c = s.city, n = c.n;
  hz.burned.forEach((b, k) => {
    const cb = s.root.get(b.i);
    if (cb) { cb.goneDay = s.day; cb.age = hz.burnedAge[k]; s.root.delete(b.i); for (let dz = 0; dz < cb.size; dz++) for (let dx = 0; dx < cb.size; dx++) { const j = (cb.z + dz) * n + cb.x + dx; if (cb.x + dx < n && cb.z + dz < n && c.occ[j] === cb.id) c.occ[j] = 0; } }
    c.ruin[b.i] = 1;
  });
  for (const i of hz.abandons) { const cb = s.root.get(i); if (cb) cb.abandoned = true; }
  c.history.push(...hz.events);
}

// 經濟給結算的三樣（D025）：稅率乘數（55322–55323、55316、55397–55406，遊客數 55294 進商業稅）、稅以外的收入（貿易金、天然氣金、燃料與鋼材與貨物出口金、船的每日金與港口金，56025）、六種商品的進口費（56025 進維護費）
function econToday(ec: EconCtx, late: EconLate, x: ExtrasOut): { mul: Partial<TaxMul>; other: Partial<OtherIncome>; imports: ImportCosts } {
  return {
    mul: { goodsMul284: ec.goodsMul284, commerceSalesMul481: ec.commerceSalesMul481, industrialMarketMul481: ec.industrialMarketMul481, indSupplyMul: ec.indSupplyMul, fuelTaxMul: ec.fuelTaxMul, steelTaxMul: ec.steelTaxMul, freightTaxMul: ec.freightTaxMul, tourists: ec.tourists },
    other: { tradeGold: late.tradeGold, gasGold: late.gasGold, shipPortGold: ec.shipPortGold, shipDailyGold418: ec.shipDailyGold418, fuelExportGold418: late.fuelExportGold418, steelExportGold482: late.steelExportGold482, goodsExportGold481: ec.goodsExportGold481,
      farmGold: x.farmGold, ranchGold: x.ranchGold, procGold: x.procGold, ghGold: x.ghGold, lodgeRev: x.lodgeRev, mktGold: x.mktGold, brewGold: x.brewGold, techGold: x.techGold, dcGold: x.dcGold, cookGold: x.cookGold, bankInt: x.bankInt },   // D028 起農牧、旅宿、市場、釀酒、科技、數據中心、熟食、銀行利息本線自己算
    imports: { goodsImportCost481: ec.goodsImportCost481, foodImportCost482: ec.foodImportCost482, gasImportCost482: ec.gasImportCost482, fuelImportCost482: ec.fuelImportCost482, steelImportCost482: ec.steelImportCost482, suppliesImportCost482: ec.suppliesImportCost482 },
  };
}

// 一天的資金結算（D011，src/sim/rules/money.ts，逐項對拍）：55868–55968 收稅（照 tickBld 順序，當天新長的接在後面）、
// 55969–56027 維護費、56028 城市活動、56053 結算、56079 貸款、56081 里程碑、56098–56131 星等、56142 紓困。
// 經濟快照與進口 D025、夜間城市 D029、城市活動 D030 起本線自己算（D011 卡第 5 節寫的乘數 1、進口費 0、沒有城市活動是當時的樣子）。
// 沙盒（diff 3）照算收支、只是不入帳（56053），里程碑與星等照給（實驗線也是）。
function settleToday(s: Sim, tickBld: number[], cnt: Record<string, number>, garbScoreRatio: number, scan: { roadUpkeep: number; infraUpkeep475: number }, c2: Class2In | undefined, e: { mul: Partial<TaxMul>; other: Partial<OtherIncome>; imports: ImportCosts } | undefined, night: NightCity, evTax: number | null): SettleReport {
  const w = s.w, f = fieldsOf(s.g);
  let chN = 0; for (const i of tickBld) { const b = w.tiles[i].bld; if (b && !b.ref && b.k === 42) chN++; }   // 55874 civicMul：市政廳數（第一個迴圈 55055 起數的）
  // D029：夜間城市今天的結算——晚間消費金同時進收入與商業稅（55968）、夜市政策的商業稅乘數讀它的 taxMul（55963）；c2 是對拍時蓋過去的
  const inc = dailyIncome(w, f, tickBld, { ...neutralTaxMul(s.edu.tech, s.edu.spec, chN), ...e?.mul, nightCityReady: night.ready, nightCityTaxMul: night.commerce.taxMul, ...c2?.mul }, { nightCommerceGold487: c2?.nightCommerceGold487 ?? night.finance.commerceGold });   // D025：稅乘數與遊客數來自經濟
  // 55988、56025、56027 其他收入：D025 起有貿易與船的金幣（農牧、旅宿、市場、釀酒、科技、數據中心、銀行利息 D026 才搬，對拍時照實驗線那天的值加）；56028 城市活動：D030 起本線自己算（evTax；c2 是對拍時蓋過去的）
  const other = { ...Object.fromEntries([...OTHER_INCOME_KEYS, 'metroRev', 'metroAds', 'transitRev', 'nightTransitRev487'].map(k => [k, 0])), ...e?.other, nightTransitRev487: night.finance.transitRevenue, ...c2?.other } as OtherIncome;   // 夜間運輸收入 56027（D029）
  const pre = e || c2?.other ? addOtherIncome(inc.income, other) : inc.income;
  const income = cityEventIncome(pre, c2?.eventTax ?? evTax);   // 56028 城市活動的稅倍率（D030：今天的活動；c2 是對拍時蓋過去的）
  const c = inc.counts;
  const upkeep = dailyUpkeep({ ...upkeepIn(w, tickBld, cnt, c, { pop: s.pop, svcBudget: s.budget, tech: s.edu.tech, spec: s.edu.spec }, scan), ...(e ? { imports: e.imports } : {}), nightOpsCost487: night.finance.operatingCost, ...c2?.upkeep });   // 夜間營運費 56027（D029）；主計數迴圈的全部計數（D016、D022、D024）＋稅收迴圈順手數的六種＋掃整張圖的四個函式＋六種商品的進口費（D025）
  const sc = scoreCounts(w, f, tickBld);
  const r = settleDay(s, { income, upkeep, day: s.day, pop: s.pop, jobs: s.jobs, cityHappy: s.cityHappy, ...sc, garbRatio: garbScoreRatio });   // 56117（D020）：garbDecisionRatio452
  return { income, upkeep, net: r.net, hospitals: c.hospitals, tax: { R: inc.taxR, C: inc.taxC, I: inc.taxI }, other, imports: { ...ZERO_IMPORTS, ...e?.imports, ...c2?.upkeep?.imports }, milestone: r.milestone, star: r.star, bailout: r.bailout, loanPaid: r.loanPaid };
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
  const bl = [...s.root.keys()].map(i => { const b = s.w.tiles[i].bld!; return [i, b.pw ? 1 : 0, b.h, b.we ?? -1, b.den ?? -1, +(b.fire || 0), +(b.crime || 0), b.crimeDays ?? -1, +(b.sick || 0), b.sickDays ?? -1, +(b.death || 0), b.deathAge ?? -1, +(b.abandoned || 0)]; });
  const ruin = s.w.tiles.flatMap((t, i) => t.ruin ? [i] : []);   // D026：焦土
  const ground = s.w.tiles.map(t => `${t.road ? t.rc : 0}${t.zone || 0}${t.tree ? 1 : 0}`).join('');
  return fnv1a(JSON.stringify([s.day, s.pop, s.jobs, s.jobsC, s.jobsI, s.cityHappy, s.dem, s.immWave, s.weather, blds, bl, Array.from(s.g.POL), Array.from(s.g.LANDBASE),
    ground, s.money, s.diff, s.loan, s.msIdx, s.bestStar, s.bailoutDay, s.landDirty, s.landBox, s.econ, ruin, s.medCap,
    hashBytes(s.g.roadLoad), hashBytes(s.g.commutePenalty), s.commuteClusters, s.tvSignal,   // D027：道路負載、通勤懲罰（32 位元逐位）、叢集路徑、電視訊號（跨天狀態）
    ...(s.fertReady || s.cookedReady ? [s.fertReady, s.cookedReady] : []),   // D028：T346 的昨天旗標（跨天狀態）；兩個都是 false 就不多吃，沒有這些建築的城雜湊逐位元組不變
    ...(s.night.ready ? [s.night.safety.score, s.night.happinessDelta] : []),   // D029：夜間城市昨天的結算（隔天的犯罪乘數讀 score、住宅幸福讀 happinessDelta；跨天狀態）；沒算過（讀檔、新圖）就不多吃
    ...(s.cityEvent ? [s.cityEvent.i, s.cityEvent.daysLeft] : [])]));   // D030：進行中的城市活動（第幾號、剩幾天；入存檔的跨天狀態）；沒有活動就不多吃，沒有活動的城雜湊逐位元組不變
}

export function simCounts(s: Sim) {
  const rci = { 1: [0, 0, 0, 0], 2: [0, 0, 0, 0], 3: [0, 0, 0, 0] } as Record<number, number[]>;
  for (const b of s.city.buildings) if (b.goneDay === undefined && b.k >= 1 && b.k <= 3) { rci[b.k][0]++; rci[b.k][b.lv]++; }
  return rci;
}

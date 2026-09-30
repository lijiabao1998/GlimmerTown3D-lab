// D025 Node 守衛（二）：實驗線頁面實跑（驗收 3）、接線（驗收 4）、存檔（驗收 5）。由 tools/unit.mjs 呼叫；vm 逐項對拍與突變（驗收 1、2、6）在 tools/unit-d025.mjs。
//   1. 樣本 src/content/samples/d025-lab.json（tools/d025-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀；
//   2. 讀進來推進一天：103 座（D022、D023、D024 的）＋自造 14 座＋資源回收 2 座，本線自己讀檔、自己算人口、職位、計數、財富、施工中房屋數、錢、遊客，只把本線沒有的五樣輸入
//      （幸福、道路負載統計、火車線、發電調度）用實驗線探針讀到的值蓋過去（Class2In.economy），輸出 economy481／economy482／logistics485、庫存與船與倉容量、稅乘數、進口費、出口金、施工耗鋼、
//      收入（扣掉沒搬的收入項）逐座相等；
//   3. 連續推進：起步城 8 個種子 × 120 天、AI 城與種子城與六座自造城 × 30 天——每天把實驗線那天經濟段的輸入代進本線的經濟函式，本線從自己的昨天庫存與快照接著算，輸出（含隔天的商工需求）逐天相等；
//   4. 接線：day.ts 的副本改壞一處（資源回收、太空研究中心的獎金入帳、路格數、煉鋼廠加速、施工耗鋼進快照、稅乘數、遊客、出口金、隔天的需求讀快照、存快照），這批要紅；
//   5. 存檔：sup、gds 每次寫，fuel364、steel364、shipCount、shipProgress 非零才寫（範本裡的舊值要拿掉）；讀了再存逐欄不變、倉容量從倉儲重算、快照不存；同一座城存檔再讀，之後每一天的雜湊相同。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import * as realDay from '../src/sim/day.ts';
import * as ECON from '../src/sim/rules/economy.ts';
import * as FOOD from '../src/sim/rules/food.ts';
import * as CNT from '../src/sim/rules/count.ts';
import { laborMarket481 as portLabor, legacyDemand, economyDemands481, housingRciDemand488 } from '../src/sim/rules/demand.ts';
import { saveCode, loadCode } from '../src/io/save.ts';
import { dayVariant } from './unit-d021.mjs';
import { d025Codes, MUL, IMP, EXP, MULTI_DAYS, MULTI_OTHER, canonOut, scalarsOf } from './d025-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
// D028 起農牧、溫室、食品加工、旅宿、農貿市場、釀酒、科技園、數據中心、中央廚房、銀行利息本線自己算（rules/income2.ts），大型購物中心的稅也搬了（money.ts）；只剩地鐵、地面運輸、夜間運輸與停車（政策與行動力）沒搬
const UNPORTED_INC = ['metroRev', 'metroAds', 'transitRev', 'nightTransitRev487', 'parkingRevenue491'];
const ZERO_CNT = Object.fromEntries(Object.keys(CNT.tallyBuildings({ N: 1, tiles: [{ t: 2, bld: null }] }, []).cnt).map(k => [k, 0]));
const FOOD_KEYS = Object.keys(FOOD.emptyFoodCount());
const same = (a, b) => J(a) === J(b);
// 兩個物件第一個不同的路徑（說明用）
function firstDiff(a, b, p = '') {
  if (Object.is(a, b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const r = firstDiff(a[k], b[k], p + '.' + k); if (r) return r; } return null; }
  return `${p.slice(1)} 本線 ${J(a)} ≠ 實驗線 ${J(b)}`;
}

export const LIVE = {};   // 除錯用：守衛跑完之後留下 day1、replay、樣本與城（tools 的一次性診斷腳本讀它）
export async function d025LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D025 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 一天的輸出跟實驗線探針 B 逐項比：P＝{ sn（economySnapshots 的回傳）, ec, late, st（庫存與船）, cons }
function outDiffs(P, B) {
  const d = [], cmp = (name, mine, theirs) => { if (!Object.is(mine, theirs)) d.push(`${name} 本線 ${mine} ≠ 實驗線 ${theirs}`); };
  for (const [name, mine, theirs] of [['economy481', P.sn.economy481, B.e481], ['economy482', P.sn.economy482, B.e482], ['logistics485', P.sn.logistics485, B.l485]]) if (!same(mine, theirs)) d.push(`${name} 不同：${firstDiff(mine, theirs)}`);
  for (const k of ['goods', 'supplies', 'fuel', 'steel', 'shipCount', 'shipProgress']) cmp(k, P.st[k], B[k]);
  cmp('gWhCap284', P.st.gWhCap, B.gWhCap284); cmp('constrSteelUse418', P.cons, B.constrSteelUse418); cmp('tourists', P.ec.tourists, B.tourists);
  for (const k of MUL) cmp(k, P.ec[k], B[k]);
  for (const k of IMP) cmp(k, k === 'totalImportCost482' ? P.sn.totalImportCost482 : P.ec[k], B[k]);
  const ex = { tradeGold: P.late.tradeGold, gasGold: P.late.gasGold, fuelExportGold418: P.late.fuelExportGold418, steelExportGold482: P.late.steelExportGold482, goodsExportGold481: P.ec.goodsExportGold481, shipPortGold: P.ec.shipPortGold, shipDailyGold418: P.ec.shipDailyGold418 };
  for (const [k, v] of Object.entries(ex)) if (B[k] !== null && B[k] !== undefined) cmp(k, v, B[k]);
  return d;
}

async function guards(log) {
  const lab = JSON.parse(read('src/content/samples/d025-lab.json')), codes = d025Codes();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (J(lab.order) !== J(codes.map(c => c.id))) bad.push('樣本裡城的順序 ≠ tools/d025-lab.mjs d025Codes() 現在的順序（重跑 tools/d025-lab.mjs）');
    for (const c of codes) { const L = lab.cities[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d025-lab.mjs）`); }
    for (const seed of STARTER_SEEDS) if (lab.multi?.starter?.[seed]?.length !== MULTI_DAYS.starter) bad.push(`起步城 ${seed} 沒有 ${MULTI_DAYS.starter} 天`);
    for (const id of MULTI_OTHER) if (lab.multi?.others?.[id]?.length !== MULTI_DAYS.other) bad.push(`${id} 沒有 ${MULTI_DAYS.other} 天`);
    log(!bad.length, `D025 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；${codes.length} 座城讀進來推進一天（碼雜湊＝本線現在產生的）、起步城 8 個種子 × ${MULTI_DAYS.starter} 天、AI 城與種子城與六座自造城 × ${MULTI_DAYS.other} 天`,
      bad.slice(0, 4).join('；') || `${Object.keys(lab.cities).length} 座、multi ${STARTER_SEEDS.length}＋${MULTI_OTHER.length}`);
    if (bad.length) return;
  }

  // ---- 2. 讀進來推進一天 ----
  // 一份 day.ts（真的或改壞的）逐座比。override＝把本線沒有的四樣輸入用實驗線探針的值蓋過去（幸福、道路負載、火車線、發電調度）；沒蓋＝本線自己的（幸福有已知的差）
  const day1 = (mod, { override = true, only = null } = {}) => {
    const rows = [];
    for (const c of codes) {
      if (only && !only.has(c.id)) continue;
      const L = lab.cities[c.id], A = L.A, B = L.B, r = decodeLabCode(c.code), d = [], inp = [];
      const s = mod.simFromSave(r.save, c.code, KT, vrank), order = [];
      for (let i = 0; i < s.w.tiles.length; i++) if (s.w.tiles[i].bld) order.push(i);
      const cnt = CNT.tallyBuildings(s.w, order).cnt, roads = s.w.tiles.filter(t => t.road).length;
      // 蓋過去的：經濟段本線沒有的四樣輸入（幸福、道路負載、火車線、發電調度）、夜間城市當天的商業稅鏡像（T487）、城市活動的稅率（T299，整筆收入乘它再取整）
      const rep = mod.stepDay(s, override ? { class2: { economy: { happy: A.happy, roadStats: A.rs, railLines: A.rail, gasPowerDispatch: A.gas, eventFood: A.evFood }, nightCommerceGold487: B.nightGold ?? 0, eventTax: B.evTax ?? null } } : {});
      const ec = rep.econ.ec, cmpIn = (name, mine, theirs) => { if (!Object.is(mine, theirs)) inp.push(`${name} 本線 ${mine} ≠ 實驗線 ${theirs}`); };
      cmpIn('日', rep.day, A.day); cmpIn('人口', rep.pop, A.pop); cmpIn('職位', rep.jobs, A.jobs); cmpIn('財富力', ec.wealthNow481, A.wealth); cmpIn('施工中的房屋', ec.activeConstruction482, A.act); cmpIn('路格', roads, A.roads);
      for (const k of Object.keys(cnt)) if ((A.c[k] ?? 0) !== cnt[k]) inp.push(`${k} 本線 ${cnt[k]} ≠ 實驗線 ${A.c[k] ?? 0}`);
      d.push(...outDiffs({ sn: rep.econ.sn, ec, late: rep.econ.late, st: s.econ, cons: rep.econ.cons }, B));
      if (!Object.is(A.money + ec.mgReward, B.money)) d.push(`結算前的錢 本線 ${A.money + ec.mgReward} ≠ 實驗線 ${B.money}`);
      // 收入：稅（住宅、商業、工業）分項＋合計。實驗線這一天有本線沒搬的東西時，那一項只量不判：火災／疾病／死亡／廢棄的房屋（55757–55856，不繳稅；D028 起本線也有，但這一批城的旗標是實驗線那天的，先只量不判）、
      // 存檔裡的政策與科技與專精（稅率、tq、sq）。沒搬的收入項（地鐵、運輸、夜間運輸、停車）照實驗線探針的值扣掉
      const raw = r.save.raw, pol = raw.pol, polOn = !!(pol && (Object.values(pol).some(v => v === true) || pol.taxR !== 1 || pol.taxC !== 1 || pol.taxI !== 1));
      const causes = [];
      if (B.flagged > 0) causes.push(`火災／疾病／死亡／廢棄 ${B.flagged} 棟`); if (polOn) causes.push('政策'); if (Array.isArray(raw.tech343) ? raw.tech343.length : raw.tech343) causes.push('科技'); if (raw.spec386) causes.push('專精');
      const unp = UNPORTED_INC.reduce((a, k) => a + (B[k] ?? 0), 0), tax = rep.settle.tax, tdiff = [];
      for (const [k, key, skip] of [['R', 'R', B.flagged > 0 || polOn], ['C', 'C', B.flagged > 0 || polOn], ['I', 'I', B.flagged > 0 || polOn]]) if (!skip && !Object.is(tax[k], B.tax[key])) tdiff.push(`tax${k} 本線 ${tax[k]} ≠ 實驗線 ${B.tax[key]}`);
      // 維護費（含六種商品的進口費，D025 起本線自己算）：實驗線的維護費扣掉本線沒搬的（地鐵、鐵路、公車、夜間城市的營運費、車隊超出預設 7 輛的保養、法規與科技與專精的日費，同 D024）
      const fl = B.up.fleet[0] + B.up.fleet[1] + B.up.fleet[2], unpUp = B.up.metroCost + B.up.railOps + B.up.busOps + B.up.nightOps + (fl - 7) * .8 + B.up.upReg;
      if (Math.abs(rep.settle.upkeep - (B.upkeep - unpUp)) > 1e-9) d.push(`維護費 本線 ${rep.settle.upkeep} ≠ 實驗線 ${B.upkeep}－沒搬的 ${unpUp}`);
      const incOff = Math.abs(rep.settle.income - (B.income - unp)) > 1e-6;
      if (!causes.length) { d.push(...tdiff); if (incOff) d.push(`收入 本線 ${rep.settle.income} ≠ 實驗線 ${B.income}－沒搬的 ${unp}`); }
      else d.push(...tdiff);   // 有本線沒搬的東西：合計不判，但沒被它影響的那一項稅照判
      rows.push({ id: c.id, d, inp, unp, causes, incOff, incGap: rep.settle.income - (B.income - unp), rs: A.rs.avg > 0 || A.rs.over > 0, rail: A.rail > 0, gas: A.gas > 0 });
    }
    return rows;
  };
  const base = day1(realDay);
  Object.assign(LIVE, { day1, lab, codes, KT, vrank });
  {
    const bad = [];
    for (const x of base) { if (x.inp.length) bad.push(`${x.id} 輸入：${x.inp.slice(0, 3).join('；')}`); if (x.d.length) bad.push(`${x.id}：${x.d.slice(0, 3).join('；')}`); }
    const cov = (f) => base.filter(f).length;
    const stats = {
      有進口: cov(x => lab.cities[x.id].B.totalImportCost482 > 0), 有出口金: cov(x => (lab.cities[x.id].B.goodsExportGold481 ?? 0) + (lab.cities[x.id].B.gasGold ?? 0) + (lab.cities[x.id].B.fuelExportGold418 ?? 0) + (lab.cities[x.id].B.steelExportGold482 ?? 0) > 0),
      有貨物庫存: cov(x => lab.cities[x.id].B.goods > 0), 有燃料: cov(x => lab.cities[x.id].B.fuel > 0), 有鋼: cov(x => lab.cities[x.id].B.steel > 0), 有船: cov(x => lab.cities[x.id].B.shipCount > 0), 有供應品: cov(x => lab.cities[x.id].B.supplies > 0),
      太空研究中心: cov(x => lab.cities[x.id].B.money !== lab.cities[x.id].A.money), 施工耗鋼: cov(x => lab.cities[x.id].B.constrSteelUse418 > 0), 額度大於六: cov(x => lab.cities[x.id].B.e482.trade.capacity > 6), 遊客: cov(x => lab.cities[x.id].B.tourists > 0),
      收入判的: cov(x => !x.causes.length), 收入只量不判: cov(x => x.causes.length > 0), 沒搬的收入: cov(x => x.unp > 0), 有壅堵: cov(x => x.rs), 有火車線: cov(x => x.rail), 有發電調度: cov(x => x.gas),
    };
    const NEED = { 有進口: 90, 有出口金: 3, 有貨物庫存: 9, 有燃料: 4, 有鋼: 10, 有船: 1, 有供應品: 3, 太空研究中心: 1, 施工耗鋼: 1, 額度大於六: 10, 遊客: 3, 收入判的: 70 };
    const lack = Object.entries(NEED).filter(([k, v]) => stats[k] < v).map(([k, v]) => `${k} ${stats[k]}<${v}`);
    if (lack.length) bad.push(`覆蓋不夠：${lack.join('、')}`);
    log(!bad.length, `D025 驗收 3：實驗線頁面實跑（讀進來推進一天）——${codes.length} 座城（D022 的 80 座、D023 的 9 座、D024 的自造城 14 座、D025 的經濟自造城 ${codes.filter(c => c.from === 'D025').length} 座）：本線自己讀檔、算人口、職位、計數、財富力、施工中的房屋數、錢、遊客，`
      + '只把本線沒有的五樣輸入（幸福、道路負載統計、火車線、發電調度、城市活動的食物加成）用實驗線探針的值蓋過去；economy481、economy482、logistics485 三份快照、庫存與船與倉容量、四個稅乘數與其他乘數、六種進口費、各項出口金、施工耗鋼、結算前的錢、收入（扣掉沒搬的收入項）逐座相等',
      bad.slice(0, 4).join('｜') || `${base.length} 座全等；` + Object.entries(stats).map(([k, v]) => `${k} ${v}`).join('、')
        + `｜收入只量不判（本線沒搬的東西）：` + base.filter(x => x.causes.length).map(x => `${x.id}（${x.causes.join('、')}；本線−實驗線 ${x.incGap.toFixed(2)}）`).join('；'));
  }

  // ---- 3. 連續推進：實驗線每天的輸入代進本線的經濟函式 ----
  const replay = (rows, code) => {
    const r = decodeLabCode(code), st = realDay.econOfSave(r.save), bad = [];
    let prev = null;
    for (let i = 0; i < rows.length; i++) {
      const { A, B } = rows[i], c = { ...ZERO_CNT, ...A.c }, fc = Object.fromEntries(FOOD_KEYS.map(k => [k, c[k] ?? 0])), labor = portLabor(A.pop, A.jobs, null, A.day), d = [];
      const ec = ECON.economyMain(st, { day: A.day, sea: A.sea, pop: A.pop, jobs: A.jobs, cityHappy: A.happy, money: A.money, spec: A.spec || null, roads: A.roads, roadStats: A.rs, railLines: A.rail, gasPowerDispatch: A.gas, eventFood: A.evFood, c, fc, labor, wealth: A.wealth, activeConstruction: A.act });
      st.steel -= B.constrSteelUse418;   // 煉鋼廠加速施工是整城的事（哪幾棟房屋、屋齡都在實驗線那邊）：照它記的耗量扣鋼（steelConstruction 本身在 vm 對拍與實跑第一天驗過）
      const late = ECON.economyLate(st, ec, c), sn = ECON.economySnapshots(st, ec, late, c, A.day, B.constrSteelUse418);
      const exps = { tradeGold: late.tradeGold, gasGold: late.gasGold, fuelExportGold418: late.fuelExportGold418, steelExportGold482: late.steelExportGold482, goodsExportGold481: ec.goodsExportGold481, shipPortGold: ec.shipPortGold, shipDailyGold418: ec.shipDailyGold418 };
      const P = canonOut({ e481: sn.economy481, e482: sn.economy482, l485: sn.logistics485, goods: st.goods, supplies: st.supplies, fuel: st.fuel, steel: st.steel, shipCount: st.shipCount, shipProgress: st.shipProgress, gWhCap284: st.gWhCap, constrSteelUse418: B.constrSteelUse418, tourists: ec.tourists,
        mul: Object.fromEntries(MUL.map(k => [k, ec[k]])), imp: Object.fromEntries(IMP.map(k => [k, k === 'totalImportCost482' ? sn.totalImportCost482 : ec[k]])), exp: Object.fromEntries(EXP.map(k => [k, exps[k]])) });
      if (fnv1a(J(P)) !== B.h) d.push(`輸出（三份快照、庫存、乘數、進口費、出口金）的雜湊不同：本線 ${J(scalarsOf(P))} ≠ 實驗線 ${J(B.s)}`);
      if (!Object.is(A.money + ec.mgReward, B.money)) d.push(`結算前的錢 本線 ${A.money + ec.mgReward} ≠ 實驗線 ${B.money}`);
      // 隔天的商工需求讀昨天的快照（55585）：用實驗線這一天需求段的輸入（demWhy：食物加減之後的幸福、商業分區格數、商工職位）
      const w = B.dw, L = legacyDemand({ pop: w.pop, jobs: w.jobs, cityHappy: w.cityHappy, czone: w.czone, jobsC: w.jobsC, jobsI: w.jobsI, indSubsidy: false, tech: [] });
      const E = economyDemands481(L.legacyR481, L.legacyC481, L.legacyI481, labor, prev), dem = [housingRciDemand488(E.r, null), E.c, E.i];
      if (!same(dem, B.dem)) d.push(`需求 本線 ${J(dem)} ≠ 實驗線 ${J(B.dem)}`);
      prev = st.snap = sn.economy481;   // 昨天的快照：隔天的生活成本（purchaseBase481 的 prevCost481）與商工需求都讀它
      if (d.length) { bad.push(`第 ${i + 1} 天：${d.slice(0, 3).join('；')}`); break; }
    }
    return { bad, days: rows.length };
  };
  {
    const bad = [], seen = { imp: 0, exp: 0, ship: 0, fuel: 0, steel: 0, constr: 0, demReady: 0, retail: 0 };
    let days = 0;
    const startCode = read('src/content/samples/starter.code.txt').trim();
    const runs = [...STARTER_SEEDS.map(seed => ({ id: `起步城 ${seed}`, rows: lab.multi.starter[seed], code: codeWithSeed(startCode, seed) })), ...MULTI_OTHER.map(id => ({ id, rows: lab.multi.others[id], code: codes.find(c => c.id === id).code }))];
    for (const run of runs) {
      const R = replay(run.rows, run.code); days += R.days;
      if (R.bad.length) bad.push(`${run.id} ${R.bad[0]}`);
      for (const { B } of run.rows) {
        if (B.s.imp > 0) seen.imp++; if (B.s.exp > 0) seen.exp++;   // 純量：貿易的進口量、出口量（六種商品加總）
        if (B.s.st[4] > 0) seen.ship++; if (B.s.st[2] > 0) seen.fuel++; if (B.s.st[3] > 0) seen.steel++; if (B.constrSteelUse418 > 0) seen.constr++; if (B.s.util > 0) seen.retail++;
      }
    }
    const NEED = { imp: 300, exp: 3, ship: 5, fuel: 10, steel: 300, constr: 5 }, lack = Object.entries(NEED).filter(([k, v]) => seen[k] < v).map(([k, v]) => `${k} ${seen[k]}<${v}`);
    if (lack.length) bad.push(`覆蓋不夠：${lack.join('、')}`);
    log(!bad.length, `D025 驗收 3（連續）：起步城 8 個種子 × ${MULTI_DAYS.starter} 天、AI 城與種子城與六座自造城（G2 貨物出口、G4 物流、G5 船、G7 太空研究中心、G8 加速施工、G9 糧食加工與出口）× ${MULTI_DAYS.other} 天，共 ${days} 個城日：`
      + '每天把實驗線那天經濟段的輸入（人口、職位、幸福、錢、路格與道路負載、財富力、施工中的房屋、計數）代進本線的經濟函式，本線從自己的昨天庫存與快照接著算；三份快照、庫存、稅乘數、進口費、出口金、結算前的錢與隔天的商工需求（讀昨天的快照）逐天相等',
      bad.slice(0, 3).join('｜') || `${days} 個城日全等；有進口 ${seen.imp}、有出口金 ${seen.exp}、有船 ${seen.ship}、有燃料 ${seen.fuel}、有鋼 ${seen.steel}、施工耗鋼 ${seen.constr}、零售利用率 > 0 ${seen.retail}`);
  }

  // ---- 4. 接線：day.ts 的副本改壞一處，這批要紅 ----
  {
    // 兩種比法：蓋（override，四樣輸入與夜市、城市活動用實驗線的值——全部的城）；不蓋（本線自己的幸福：只挑「什麼都不蓋、本線自己算就跟實驗線相等」的城，才看得出幸福的來源接歪）
    const subset = new Set(day1(realDay, { override: false }).filter(x => !x.d.length && !x.inp.length).map(x => x.id));
    const bad0 = (mod, o) => day1(mod, o).filter(x => x.d.length || x.inp.length).length, red = mod => bad0(mod, {}), redNo = mod => bad0(mod, { override: false, only: subset });
    const V0 = await dayVariant([]), MUT = [
      ['資源回收廠產貨物拿掉', 'recycleGoods(s.econ, { formal: san.formal, activeByK: san.activeByK, districts: san.districts }, garbage, cnt.upc342 ?? 0);', ''],
      ['貿易額度的路格數給 0', 'spec: s.edu.spec, roads, roadStats:', 'spec: s.edu.spec, roads: 0, roadStats:'],
      ['煉鋼廠加速施工拿掉', 'const cons = steelConstruction(s.econ, cnt.steelMillN ?? 0, w, tickBld, s.day);', 'const cons = 0;'],
      ['快照的施工耗鋼給 0', 'economySnapshots(s.econ, ec, late, cnt, s.day, cons)', 'economySnapshots(s.econ, ec, late, cnt, s.day, 0)'],
      ['稅乘數不傳給結算', '...neutralTaxMul(s.edu.tech, s.edu.spec, chN), ...e?.mul, ...c2?.mul }', '...neutralTaxMul(s.edu.tech, s.edu.spec, chN), ...c2?.mul }'],
      ['遊客數不進商業稅', 'freightTaxMul: ec.freightTaxMul, tourists: ec.tourists },', 'freightTaxMul: ec.freightTaxMul },'],
      ['出口金不進收入', '...e?.other, ...c2?.other }', '...c2?.other }'],
      ['進口費不進維護費', "...(e ? { imports: e.imports } : {}), ...c2?.upkeep", '...c2?.upkeep'],
      ['經濟讀的幸福差一點（幸福的來源接歪）', 'cityHappy: x2?.happy ?? cityHappy, money: s.money', 'cityHappy: x2?.happy ?? (cityHappy - .01), money: s.money', 'no'],
    ];
    const bad = [], out = [];
    const r0 = red(V0) + redNo(V0); if (r0) bad.push(`沒改的副本就有 ${r0} 座不等`);
    for (const [name, from, to, mode] of MUT) {
      let V; try { V = await dayVariant([[from, to]]); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
      const n = mode === 'no' ? redNo(V) : red(V); out.push(`${name}：${n} 座`); if (!n) bad.push(`「${name}」沒抓到`);
    }
    // 太空研究中心的獎金當天進錢（55408）：G7（第 24 天、供應品 400、兩座）——拿掉那一行，資金少剛好 7,000
    {
      const g7 = codes.find(c => c.id === 'G7'), run = mod => { const s = mod.simFromSave(decodeLabCode(g7.code).save, g7.code, KT, vrank), rep = mod.stepDay(s); return { m: s.money, mg: rep.econ.ec.mgReward }; };
      const a = run(realDay), b = run(await dayVariant([['s.money += ec.mgReward;', '']]));
      out.push(`獎金入帳：少 ${a.m - b.m}（獎金 ${a.mg}）`); if (!(a.mg === 7000 && a.m - b.m === 7000)) bad.push(`太空研究中心獎金沒進錢：獎金 ${a.mg}、拿掉那一行少 ${a.m - b.m}（要 7000）`);
    }
    // 隔天的商工需求讀昨天的快照（55585）、快照在需求之後才寫（56030）：G3（缺貨、商業多）連推兩天，第二天的需求要＝用第一天的快照算的；沒有快照的算法（讀檔第一天那一支）要不一樣，測才有意義
    {
      const g3 = codes.find(c => c.id === 'G3'), two = mod => { const s = mod.simFromSave(decodeLabCode(g3.code).save, g3.code, KT, vrank), r1 = mod.stepDay(s), r2 = mod.stepDay(s); return { s, r1, r2 }; };
      const R = two(realDay), czone = R.s.w.tiles.filter(t => t.zone === 2).length;
      const L = legacyDemand({ pop: R.r2.pop, jobs: R.r2.jobs, cityHappy: R.r2.cityHappy, czone, jobsC: R.r2.jobsC, jobsI: R.r2.jobsI, indSubsidy: false, tech: R.s.edu.tech });
      const want = snap => { const E = economyDemands481(L.legacyR481, L.legacyC481, L.legacyI481, R.s.labor, snap); return [housingRciDemand488(E.r, null), E.c, E.i]; };
      const w1 = want(R.r1.econ.sn.economy481), w0 = want(null);
      if (!same(R.r2.dem, w1)) bad.push(`第二天的需求 ${J(R.r2.dem)} ≠ 用第一天的快照算的 ${J(w1)}`);
      if (same(w1, w0)) bad.push('第一天的快照沒有改變需求（守衛沒有鑑別力）');
      for (const [name, from, to] of [['隔天的需求不讀快照', 'labor, s.econ.snap);', 'labor, null);'], ['快照不存', 's.econ.snap = sn.economy481;', '']]) {
        const V = await dayVariant([[from, to]]), M = two(V);
        out.push(`${name}：第二天的需求${same(M.r2.dem, R.r2.dem) ? '沒變' : '變了'}`); if (same(M.r2.dem, R.r2.dem)) bad.push(`「${name}」沒抓到`);
      }
    }
    log(!bad.length, `D025 驗收 4：接線——day.ts 的副本改壞一處（${MUT.length + 3} 個：資源回收廠、路格數、煉鋼廠加速施工、施工耗鋼進快照、稅乘數、遊客、出口金、進口費、幸福的來源、獎金入帳、隔天的需求讀快照、存快照）要紅；沒改的先核過全等；第二天的需求＝用第一天的快照算的`,
      bad.join('；') || `子集 ${subset.size} 座（本線自己算就跟實驗線相等）；${out.join('；')}`);
  }

  // ---- 5. 存檔 ----
  {
    const bad = [], seen = { out: [], gw: 0 };
    const FIELDS = [['fuel364', 'fuel'], ['steel364', 'steel'], ['shipCount', 'shipCount'], ['shipProgress', 'shipProgress']];
    const wh = sim => { let n = 0; for (const b of sim.root.values()) if (b.goneDay === undefined && b.k === 64) n += 120 + ((b.lv || 1) - 1) * 60; return n; };
    for (const id of ['G2', 'G4', 'G5', 'G6', 'G7', 'G8', 'G13', 'G14']) {
      const c = codes.find(x => x.id === id), L1 = loadCode(c.code, KT, vrank);
      if (!L1.ok) { bad.push(`${id}：讀不進 ${L1.error}`); continue; }
      const s = L1.sim, raw0 = decodeLabCode(c.code).save.raw;
      // 讀進來的庫存（存檔欄位缺＝0）
      for (const [k, f] of [['sup', 'supplies'], ['gds', 'goods'], ...FIELDS]) if (!Object.is((+raw0[k]) || 0, s.econ[f])) bad.push(`${id} 讀檔後 ${f} 本線 ${s.econ[f]} ≠ 存檔的 ${k} ${raw0[k]}`);
      if (s.econ.gWhCap !== wh(s)) bad.push(`${id} 讀檔後倉容量 ${s.econ.gWhCap} ≠ 倉儲重算的 ${wh(s)}`);
      if (s.econ.snap !== null) bad.push(`${id} 讀檔後快照不是 null`);
      for (let d = 0; d < 3; d++) realDay.stepDay(s);
      const code2 = saveCode(s, L1.template, L1.start), raw2 = decodeLabCode(code2).save.raw;
      if (!Object.is(raw2.sup, s.econ.supplies) || !Object.is(raw2.gds, s.econ.goods)) bad.push(`${id} 存檔的 sup／gds ${raw2.sup}／${raw2.gds} ≠ ${s.econ.supplies}／${s.econ.goods}`);
      for (const [k, f] of FIELDS) { const v = s.econ[f]; if (v > 0 ? !Object.is(raw2[k], v) : k in raw2) bad.push(`${id} 存檔的 ${k}：${J(raw2[k])}（庫存 ${v}）`); }
      const L2 = loadCode(code2, KT, vrank);
      if (!L2.ok) { bad.push(`${id}：存了讀不回 ${L2.error}`); continue; }
      for (const f of ['goods', 'supplies', 'fuel', 'steel', 'shipCount', 'shipProgress']) if (!Object.is(L2.sim.econ[f], s.econ[f])) bad.push(`${id} 存了再讀 ${f} ${L2.sim.econ[f]} ≠ ${s.econ[f]}`);
      const code3 = saveCode(L2.sim, L2.template, L2.start), raw3 = decodeLabCode(code3).save.raw;
      for (const k of ['sup', 'gds', ...FIELDS.map(q => q[0])]) if (!Object.is(raw3[k], raw2[k])) bad.push(`${id} 讀了再存 ${k} ${J(raw3[k])} ≠ ${J(raw2[k])}`);
      // 同一張碼讀兩次、各推三天，雜湊相同（庫存、快照都進雜湊）；再推一天，庫存有在動
      const A1 = loadCode(code2, KT, vrank).sim, A2 = loadCode(code2, KT, vrank).sim;
      for (let d = 0; d < 3; d++) { realDay.stepDay(A1); realDay.stepDay(A2); }
      if (realDay.simHash(A1) !== realDay.simHash(A2)) bad.push(`${id} 同一張碼讀兩次、各推三天，雜湊不同`);
      if (wh(s) > 0) seen.gw++;
      seen.out.push(`${id}：貨物 ${s.econ.goods}、鋼 ${s.econ.steel}、船 ${s.econ.shipCount}`);
    }
    // 存檔的舊值要拿掉：G5 的範本有 shipCount／shipProgress／steel364，庫存用完（0）之後存，欄位不能留著
    {
      const c = codes.find(x => x.id === 'G5'), L1 = loadCode(c.code, KT, vrank), s = L1.sim;
      s.econ.shipCount = 0; s.econ.shipProgress = 0; s.econ.steel = 0; s.econ.fuel = 0; s.econ.goods = 0; s.econ.supplies = 0;
      const raw = decodeLabCode(saveCode(s, L1.template, L1.start)).save.raw;
      if (!('shipCount' in decodeLabCode(c.code).save.raw)) bad.push('G5 的範本沒有 shipCount（測試沒有鑑別力）');
      if (['shipCount', 'shipProgress', 'steel364', 'fuel364'].some(k => k in raw) || raw.sup !== 0 || raw.gds !== 0) bad.push(`庫存歸零後存檔還留著舊欄位：${J(Object.fromEntries(['shipCount', 'shipProgress', 'steel364', 'fuel364', 'sup', 'gds'].map(k => [k, raw[k]])))}`);
    }
    log(!bad.length && seen.gw >= 1, 'D025 驗收 5：存檔——sup、gds 每次寫，fuel364、steel364、shipCount、shipProgress 非零才寫（庫存用完，範本裡讀進來的舊值要拿掉）；讀進來的庫存與船＝存檔欄位（缺＝0）、倉容量從倉儲物流中心重算、快照 null；存了再讀、讀了再存逐欄不變；同一張碼讀兩次、各推三天，雜湊相同（庫存與快照進雜湊）',
      bad.slice(0, 4).join('；') || `8 座城：${seen.out.join('、')}`);
  }
}

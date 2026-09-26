// D011 驗收 2：資金公式（稅、維護費、其他收入與進口、城市活動取整、結算後段：里程碑、星等、紓困）跟實驗線對拍。照 D009／D010 的做法：
//   1. 黃金樣本 src/content/samples/d011-money.json 由 tools/lab-money.mjs 從實驗線原始碼求值產生（commit 釘死、片段錨點、行號與雜湊存證）；
//   2. 本線 src/sim/rules/money.ts 跑同一批案例（tools/lab-money.mjs 的 moneyCase），當天收支（day）與結算後狀態（settle）逐項 Object.is 相等；
//      neutral 家族照 src/sim/day.ts 的呼叫方式（neutralTaxMul、neutralUpkeepIn、不加其他收入），證明 D011 模擬實際走的那條路也相等；
//   3. 實驗線片段單點突變：樣本裡存了每個突變第一個對不上的案例與突變後的輸出；本線在那個案例上必須跟它不同（實驗線原碼若是那樣，守衛會紅）；
//   4. 本線單點突變：把 money.ts 改一個常數／符號／刪一項，型別剝除後在 vm 裡重跑，守衛必須轉紅；
//   5. 浮點加總順序（D011 審查：實驗線 55973 把 roadUpkeep 挪到第三項，舊的四族 2,200 組一組都抓不到）：big 家族（大城）要在，
//      55970 逐格、55973、55990、56025 換順序的六個突變，實驗線那邊（樣本）與本線那邊（money.ts）都要轉紅。
// 用法：import { d011MoneyGuards } from './unit-d011-money.mjs'; await d011MoneyGuards(log)　log(ok, 名稱, 細節) 同 tools/unit.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as money from '../src/sim/rules/money.ts';
import * as labHelpers from '../src/sim/rules/lab.ts';
import * as jobs from '../src/sim/rules/jobs.ts';
import { getMaxRoadClass } from '../src/sim/rules/grid.ts';
import { moneyCase, canon, D011_MONEY_SEED, D011_MONEY_COUNT, D011_MONEY_COMMIT, FAMILIES, LAB_MUTANTS, EVENT_TAX, OTHER_INCOME_KEYS, IMPORT_KEYS } from './lab-money.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
// 黃金樣本必須摘到的實驗線片段；tick() 裡的幾段釘行號（money.ts 的註解引用的就是這些行）
const REQUIRED_PIECES = ['clamp', 'sq', 'tq', 'POPS', 'JOBSC', 'JOBSI', 'DEN_POP', 'TOWER_MULT', 'TOWER_POP', 'MEGA_POP', 'MEGA_JOBS', 'TOWER_JOBS', 'WEALTH_TAX', 'ROAD_UPKEEP',
  'MILES', 'LMCFG309', 'SOCIAL_HOUSING_POP', 'housingBand488', 'residentCapacity488', 'residentEligible488', 'housingOccupancy488', 'residentPopulation488', 'T', 'idx', 'inMap',
  'getMaxRoadClass', 'tick 稅收', 'tick 維護費', 'tick 地鐵取整與服務費', 'tick 其他收入與進口', 'tick 地面運輸', 'tick 城市活動', 'tick 結算後段', 'CITY_EVENTS', 'DIFF_MONEY', 'svcFleet'];
const SPAN_LINES = { 'tick 稅收': [55868, 55968], 'tick 維護費': [55969, 55977], 'tick 地鐵取整與服務費': [55987, 55990], 'tick 其他收入與進口': [56025, 56025],
  'tick 地面運輸': [56026, 56027], 'tick 城市活動': [56028, 56028], 'tick 結算後段': [56053, 56145] };
// tick 片段原文的 sha256 前 16 字（d23c18d）：樣本必須是從這幾段原文求值的
const PINNED_SHA = { 'tick 稅收': '896d6f6d03081bd1', 'tick 維護費': 'd96463042719f95c', 'tick 地鐵取整與服務費': 'ec875e0b4676eea4', 'tick 其他收入與進口': 'a92cfe76c6503e94',
  'tick 地面運輸': '61a02127e8d33594', 'tick 城市活動': '05a5f7388369c66b', 'tick 結算後段': 'a79bddfb4d9d65b5' };
const COUNT_NAMES = ['parks', 'plants', 'fireStations', 'policeStations', 'policeBoxes', 'hospitals', 'nI', 'fs2n409'];

// 本線跑一個案例：收稅 → 地鐵取整、票務 → 其他收入 → 城市活動取整；維護費；結算後段。輸出的形狀跟 tools/lab-money.mjs 的 labRun 一樣
export function runMoney3D(m, c) {
  const w = { N: c.N, tiles: c.tiles }, f = { COV: c.COV, LAND: c.LAND, EDU: c.EDU }, spec = c.spec || null, neutral = c.family === 'neutral';
  const nf = m.nightFinance487({ ready: c.night.ready, commerce: { taxMul: c.night.taxMul },
    finance: { commerceGold: c.night.commerceGold, transitRevenue: c.night.transitRevenue, operatingCost: c.night.operatingCost } });
  const ent = new Map(c.ent), occObj = c.housing.occ;
  const mul = neutral ? m.neutralTaxMul(c.tech, spec, c.counts.chN) : {
    civicMul: m.civicMulOf(c.counts.chN), pm: c.pol, ...c.mul, nightCityReady: c.night.ready, nightCityTaxMul: c.night.taxMul, tech: c.tech, spec,
    enterpriseTaxFactor: i => ent.has(i) ? ent.get(i) : 1, occ: c.housing.off ? undefined : band => occObj ? occObj[band] : undefined };
  const inc = m.dailyIncome(w, f, c.tickBld, mul, { nightCommerceGold487: nf.nightCommerceGold487 });
  const metro = m.metroRound467({ metroRev: c.metroRaw[0], metroAds: c.metroRaw[1], metroCost: c.metroRaw[2] }, c.pol);
  const transitRev = m.transitRev468(c.modeShare, c.pol);
  // neutral：src/sim/day.ts 不加其他收入（D011 的城都是 0），直接進城市活動
  const incomePre = neutral ? inc.income : m.addOtherIncome(inc.income, { ...c.other, metroRev: metro.metroRev, metroAds: metro.metroAds, transitRev, nightTransitRev487: nf.nightTransitRev487 });
  const income = m.cityEventIncome(incomePre, c.eventTax);
  const ru = m.roadUpkeep(w), six = Object.fromEntries(COUNT_NAMES.slice(0, 6).map(k => [k, inc.counts[k]]));
  const upIn = neutral ? m.neutralUpkeepIn({ roadUpkeep: ru, counts: six, pop: c.pop, svcBudget: c.svcBudget, tech: c.tech, spec })
    : { roadUpkeep: ru, counts: { ...c.counts, ...six }, pop: c.pop, pol: c.pol, tech: c.tech, spec, ...c.fees, metroCost: metro.metroCost,
      svcFleet: c.svcFleet, svcBudget: c.svcBudget, imports: c.imports, nightOpsCost487: nf.nightOpsCost487 };
  const upkeep = m.dailyUpkeep(upIn);
  const day = { taxIncome: inc.income, taxR: inc.taxR, taxC: inc.taxC, taxI: inc.taxI, counts: COUNT_NAMES.map(k => inc.counts[k]), nightCommerceGold487: nf.nightCommerceGold487,
    roadUpkeep: ru, eduFee394: m.eduFee394Of(c.pop), upReg: m.upRegOf(upIn.pol, c.tech, spec, c.pop, upIn.policyDailyCost504),
    metro: [metro.metroRev, metro.metroAds, metro.metroCost], transitRev, nightTransitRev487: nf.nightTransitRev487, nightOpsCost487: nf.nightOpsCost487, incomePre, income, upkeep };
  const s = c.settle, st = { money: s.money, diff: s.diff, loan: s.loan ? { ...s.loan } : null, msIdx: s.msIdx, bestStar: s.bestStar, bailoutDay: s.bailoutDay };
  const q = { income: s.income ?? income, upkeep: s.upkeep ?? upkeep, day: s.day, pop: c.pop, jobs: s.jobs, cityHappy: s.cityHappy, ...m.scoreCounts(w, f, c.tickBld), garbRatio: s.garbRatio };
  const rep = m.settleDay(st, q);
  return { day, settle: { money: st.money, loan: st.loan ? [st.loan.remain, st.loan.daily] : null, msIdx: st.msIdx, bestStar: st.bestStar, bailoutDay: st.bailoutDay, score: rep.score, cityStar: rep.cityStar }, rep, q };
}
// 結算報告（本線自己的，給畫面與歷史用）跟狀態變化一致：有扣貸款才有 loanPaid、msIdx 動了才有 milestone……
export function reportBad(c, r) {
  const s = c.settle, o = r.settle, rep = r.rep, bad = [];
  if (!Object.is(rep.net, r.q.income - r.q.upkeep)) bad.push('net');
  if ((rep.loanPaid !== undefined) !== !!s.loan || (s.loan && rep.loanPaid !== s.loan.daily)) bad.push('loanPaid');
  const mi = s.msIdx < money.MILES.length ? money.MILES[s.msIdx] : null;
  if ((rep.milestone !== undefined) !== (o.msIdx !== s.msIdx) || (rep.milestone && (rep.milestone.pop !== mi[0] || rep.milestone.reward !== mi[1]))) bad.push('milestone');
  if ((rep.star !== undefined) !== (o.bestStar !== s.bestStar) || (rep.star && (rep.star.star !== o.bestStar || rep.star.bonus !== o.bestStar * 500))) bad.push('star');
  if ((rep.bailout !== undefined) !== (o.bailoutDay !== s.bailoutDay) || (rep.bailout !== undefined && rep.bailout !== 250)) bad.push('bailout');
  return bad;
}
const where = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return `@${i} 本線「${a.slice(Math.max(0, i - 50), i + 40)}」≠ 實驗線「${String(b).slice(Math.max(0, i - 50), i + 40)}」`; };

// 浮點加總順序（數學上相等、捨入不同）：跟 tools/lab-money.mjs 的 FLOAT_ORDER_MUTANTS 同名、一一對應；原文由名單組出來（money.ts 的項序跟名單不同＝錨點找不到＝紅）
const G55990 = ['(c.fireStations * 3 + c.fs2 * 6 + c.fhqN * 10) * (u.svcBudget.fire - 1)', '(c.policeStations * 4 + c.policeBoxes * 1.5 + c.crtN * 6) * (u.svcBudget.police - 1)',
  '(c.hospitals * 5 + c.clinics * 2.5 + c.am * 4 + c.mhN * 16) * (u.svcBudget.health - 1)', '(c.schools * 2.5 + c.libraries * 2 + c.un * 8 + c.inN * 10) * (u.svcBudget.edu - 1)'];
const sumOf = (p, keys) => keys.map(k => p + k).join(' + '), lastFirst = a => [a[a.length - 1], ...a.slice(0, -1)];
const FLOAT_MUTANTS = [
  ['維護 55973 roadUpkeep 第一項→第三項', 'let upkeep = u.roadUpkeep + c.parks * .5 + c.plants * 4 + c.fireStations * 3', 'let upkeep = c.parks * .5 + c.plants * 4 + u.roadUpkeep + c.fireStations * 3'],
  ['維護 55973 roadUpkeep 先入帳、其餘另加', 'let upkeep = u.roadUpkeep + c.parks * .5', 'let upkeep = u.roadUpkeep; upkeep += c.parks * .5'],
  ['道路維護 55970 逐格反序', 'for (let i = 0; i < w.N * w.N; i++) { const t = w.tiles[i]; if (t.road) roadUpkeep +=', 'for (let i = w.N * w.N - 1; i >= 0; i--) { const t = w.tiles[i]; if (t.road) roadUpkeep +='],
  ['服務預算 55990 消防組挪到最後', `upkeep += ${G55990[0]} + ${G55990[1]}\n    + ${G55990[2]} + ${G55990[3]};`, `upkeep += ${[...G55990.slice(1), G55990[0]].join(' + ')};`],
  ['其他收入 56025 goodsExportGold481 挪到最前', `income += ${sumOf('o.', OTHER_INCOME_KEYS)};`, `income += ${sumOf('o.', lastFirst(OTHER_INCOME_KEYS))};`],
  ['進口 56025 suppliesImportCost482 挪到最前', `upkeep += ${sumOf('m.', IMPORT_KEYS)};`, `upkeep += ${sumOf('m.', lastFirst(IMPORT_KEYS))};`],
];
// 本線單點突變：[名稱, 原文, 改成]
const MUTANTS = [
  ['ROAD_UPKEEP .05→.06', '0.01, 0.02, 0.05, 0.12', '0.01, 0.02, 0.06, 0.12'],
  ['WEALTH_TAX 1.5→1.4', '[0.6, 1, 1.5]', '[0.6, 1, 1.4]'],
  ['NO_TAX_K 漏 57（幽靈工業稅）', ' 56, 57, 58,', ' 56, 58,'],
  ['LMCFG309_KINDS 漏 185', '184, 185, 186', '184, 186'],
  ['住宅稅 .12→.13', '* .12 * (pm.taxR || 1) * WEALTH_TAX[we]', '* .13 * (pm.taxR || 1) * WEALTH_TAX[we]'],
  ['地價槓桿 .15→.16', '/ 128 * .15', '/ 128 * .16'],
  ['商業 郵局 1.15→1.16', '(COV.post![i] > 0 ? 1.15 : 1)', '(COV.post![i] > 0 ? 1.16 : 1)'],
  ['商業 遊客 /500→/400', 'mul.tourists / 500', 'mul.tourists / 400'],
  ['工業 .15→.16', 'JOBSI[b.lv] * .15', 'JOBSI[b.lv] * .16'],
  ['稅收條件 漏 !b.plague', '!b.abandoned && !b.riot && !b.plague)) return null;', '!b.abandoned && !b.riot)) return null;'],
  ['社宅 .08→.09', '* .08 * (pmOf().taxR || 1)', '* .09 * (pmOf().taxR || 1)'],
  ['市政廳 1.03→1.04', 'chN > 0 ? 1.03 : 1', 'chN > 0 ? 1.04 : 1'],
  ['nI 計數 k3→k2', 'if (b.k === 3) counts.nI++;', 'if (b.k === 2) counts.nI++;'],
  ['夜市稅收鏡像 不加 taxC', 'if (g > 0) { income += g; taxC += g; }', 'if (g > 0) { income += g; }'],
  ['道路維護 預設等級 2→1', '((t.rc as number) || 2) - 1', '((t.rc as number) || 1) - 1'],
  ['edu 專精費 /100→/90', 'Math.round(pop / 100)', 'Math.round(pop / 90)'],
  ['法規費 保險 18→17', 'pol.insurance ? 18 : 0', 'pol.insurance ? 17 : 0'],
  ['維護 派出所 1.5→1.4', 'c.policeStations * 4 + c.policeBoxes * 1.5 + c.hospitals * 5', 'c.policeStations * 4 + c.policeBoxes * 1.4 + c.hospitals * 5'],
  ['維護 貨櫃港 36→35', 'c.cport485 * 36', 'c.cport485 * 35'],
  ['車隊 .8→.9', 'u.svcFleet.amb - 7) * .8', 'u.svcFleet.amb - 7) * .9'],
  ['服務預算 研究院 10→11', 'c.un * 8 + c.inN * 10) * (u.svcBudget.edu - 1)', 'c.un * 8 + c.inN * 11) * (u.svcBudget.edu - 1)'],
  ['進口 漏 supplies', ' + m.suppliesImportCost482', ''],
  ['其他收入 漏 bankInt', ' + o.bankInt', ''],
  ['地鐵整合票價 .92→.93', 'raw.metroRev * (pol && pol.integratedTransit ? .92 : 1)', 'raw.metroRev * (pol && pol.integratedTransit ? .93 : 1)'],
  ['票務 .03→.04', 'surfaceFareTrips468 * .03', 'surfaceFareTrips468 * .04'],
  ['城市活動 round→floor', 'Math.round(income * eventTax)', 'Math.floor(income * eventTax)'],
  ['沙盒 diff!==3→!==2', 'if (st.diff !== 3)', 'if (st.diff !== 2)'],
  ['貸款 <=0→<0', '--st.loan.remain <= 0', '--st.loan.remain < 0'],
  ['里程碑 >=→>', 'pop >= MILES[st.msIdx][0]', 'pop > MILES[st.msIdx][0]'],
  ['評分門檻 50→49', 'if (pop < 50)', 'if (pop < 49)'],
  ['scoreCounts 漏 fireHQ', ' || (COV.fireHQ && COV.fireHQ[i] > 0)', ''],
  ['星等 /18→/20', 'Math.floor(score / 18)', 'Math.floor(score / 20)'],
  ['升星獎金 500→400', 'const bonus = cityStar * 500;', 'const bonus = cityStar * 400;'],
  ['紓困 >60→>=60', 'q.day - st.bailoutDay > 60', 'q.day - st.bailoutDay >= 60'],
  ['紓困 money<20→<=20', 'st.money < 20 &&', 'st.money <= 20 &&'],
  ...FLOAT_MUTANTS,
];
const EXPORTS = ['civicMulOf', 'neutralTaxMul', 'dailyIncome', 'nightFinance487', 'metroRound467', 'transitRev468', 'addOtherIncome', 'cityEventIncome', 'roadUpkeep',
  'eduFee394Of', 'upRegOf', 'neutralUpkeepIn', 'dailyUpkeep', 'scoreCounts', 'settleDay'];
function mutantModule(source) {
  let js = stripTypeScriptTypes(source);
  js = js.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const ctx = vm.createContext({ ...labHelpers, ...jobs, getMaxRoadClass });
  vm.runInContext(`${js}\n;globalThis.__m = { ${EXPORTS.join(', ')} };`, ctx, { filename: 'mutant:money.ts' });
  return ctx.__m;
}

export async function d011MoneyGuards(log) {
  const gold = JSON.parse(read('src/content/samples/d011-money.json'));
  const casesSha = crypto.createHash('sha256').update(read('tools/lab-money.mjs')).digest('hex');
  const want = {};
  for (const part of ['day', 'settle']) {
    try { want[part] = JSON.parse(gunzipSync(Buffer.from(gold.exact?.outputs?.[part] ?? '', 'base64')).toString('utf8')); } catch { want[part] = []; }
  }
  const pieces = gold.source?.pieces ?? [], byName = new Map(pieces.map(p => [p.name, p]));
  const missing = REQUIRED_PIECES.filter(n => !byName.has(n));
  const badLines = Object.entries(SPAN_LINES).filter(([n, [a, b]]) => byName.get(n)?.line !== a || byName.get(n)?.endLine !== b).map(([n]) => n);
  const badSha = Object.entries(PINNED_SHA).filter(([n, h]) => !byName.get(n)?.sha?.startsWith(h)).map(([n]) => n);
  // 跟 D009、D010 樣本同名的片段（clamp、tq、POPS、residentPopulation488、getMaxRoadClass……）原文雜湊要一樣：同一個 commit、同一段原文
  const shared = [];
  for (const f of ['d009-formulas.json', 'd010-fields.json']) {
    let other = [];
    try { other = JSON.parse(read(`src/content/samples/${f}`)).source.pieces; } catch { shared.push(`${f} 讀不到`); }
    for (const p of other) if (byName.has(p.name) && byName.get(p.name).sha !== p.sha) shared.push(`${f}:${p.name}`);
  }
  const metaOk = gold.source?.commit === D011_MONEY_COMMIT && gold.source?.repo === 'lijiabao1998/GlimmerTown-lab' && gold.seed === D011_MONEY_SEED
    && gold.source?.casesSha256 === casesSha && canon(gold.families) === canon(FAMILIES) && gold.count === D011_MONEY_COUNT && D011_MONEY_COUNT >= 2000
    && want.day.length === D011_MONEY_COUNT && want.settle.length === D011_MONEY_COUNT && gold.exact?.codec === 'gzip+base64+json-canon-array'
    && missing.length === 0 && badLines.length === 0 && badSha.length === 0 && shared.length === 0
    && pieces.every(p => p.name && p.line > 0 && p.endLine >= p.line && /^[0-9a-f]{64}$/.test(p.sha)
      && typeof p.anchors?.start === 'string' && p.anchors.start.length > 0
      && (p.kind !== 'span' || typeof p.anchors.end === 'string' && p.anchors.end.length > 0)
      && (p.kind !== 'fn' || p.anchors.closure === 'balanced-brace'));
  log(metaOk, 'D011 資金黃金樣本：實驗線 commit、案例檔雜湊、原碼錨點與雜湊（tick 片段釘行號與雜湊、同名片段跟 D009／D010 樣本一致）、≥2,000 組',
    `${gold.source?.commit?.slice(0, 7)}；${pieces.length} 段${missing.length ? `（缺 ${missing.join(',')}）` : ''}${badLines.length ? `（行號不符 ${badLines.join(',')}）` : ''}`
    + `${badSha.length ? `（雜湊不符 ${badSha.join(',')}）` : ''}${shared.length ? `（跟舊樣本不一致 ${shared.join(',')}）` : ''}；${gold.count} 組；案例檔 ${casesSha === gold.source?.casesSha256 ? '相符' : '不符'}`);

  // 常數表：本線 money.ts ＝ 實驗線自己的表
  {
    const t = gold.tables ?? {}, bad = [];
    const sorted = a => [...a].sort((x, y) => x - y);
    if (canon(money.ROAD_UPKEEP) !== canon(t.roadUpkeep)) bad.push('ROAD_UPKEEP');
    if (canon(money.WEALTH_TAX) !== canon(t.wealthTax)) bad.push('WEALTH_TAX');
    if (canon(money.MILES) !== canon(t.miles)) bad.push('MILES');
    if (canon(money.DIFF_MONEY) !== canon(t.diffMoney)) bad.push('DIFF_MONEY');
    if (money.SOCIAL_HOUSING_WE !== t.socialHousingWe) bad.push('SOCIAL_HOUSING_WE');
    if (canon(money.SVC_FLEET_DEFAULT) !== canon(t.svcFleet)) bad.push('SVC_FLEET_DEFAULT');
    if (canon(sorted(money.LMCFG309_KINDS)) !== canon(sorted(t.lmcfg309 ?? []))) bad.push('LMCFG309_KINDS');
    if (jobs.MEGA_JOBS !== t.megaJobs || jobs.TOWER_JOBS !== t.towerJobs) bad.push('MEGA_JOBS／TOWER_JOBS（jobs.ts）');
    if (canon(sorted(EVENT_TAX)) !== canon(t.cityEventTax)) bad.push('EVENT_TAX（案例）');
    log(bad.length === 0, 'D011 資金常數表與實驗線逐項相等：道路維護、財富稅率、里程碑、起始資金、社宅財富、車隊預設、觀光地標種類、城市活動稅率',
      bad.length ? `不一致：${bad.join('、')}` : `里程碑 ${t.miles?.length} 級、觀光地標 ${t.lmcfg309?.length} 種、城市活動稅率 ${t.cityEventTax?.length} 種`);
  }

  // 逐案例：收支、結算
  const bad = { day: [], settle: [], report: [] }, neutralBad = [];
  let neutralN = 0;
  for (let k = 0; k < D011_MONEY_COUNT; k++) {
    try {
      const c = moneyCase(k), r = runMoney3D(money, c), dd = canon(r.day), ss = canon(r.settle);
      if (dd !== want.day[k]) bad.day.push(`${k}(${c.family}) ${where(dd, want.day[k] ?? '')}`);
      if (ss !== want.settle[k]) bad.settle.push(`${k}(${c.family}) ${where(ss, want.settle[k] ?? '')}`);
      const rb = reportBad(c, r); if (rb.length) bad.report.push(`${k}: ${rb.join(',')}`);
      if (c.family === 'neutral') { neutralN++; if (dd !== want.day[k] || ss !== want.settle[k]) neutralBad.push(k); }
    } catch (e) { bad.day.push(`${k}: ${e.stack || e}`); }
  }
  const cv = gold.coverage ?? {};
  log(bad.day.length === 0 && want.day.length === D011_MONEY_COUNT,
    'D011 當天收支逐項與實驗線相等：逐棟稅（住商工交錯累加、專屬稅分支、0–200 種類分支鏈）、設施數、道路維護、法規費、維護費、地鐵取整、其他收入、票務、城市活動取整',
    bad.day.length ? `${bad.day.length}/${D011_MONEY_COUNT} 差異：${bad.day.slice(0, 2).join('｜')}`
      : `${D011_MONEY_COUNT} 組相等；課稅住商工 ${Object.values(cv.rci ?? {}).reduce((a, b) => a + b, 0)} 棟、災害擋稅 ${Object.values(cv.hazard ?? {}).reduce((a, b) => a + b, 0)} 棟、種類 ${cv.kinds}、城市活動 ${cv.eventOn} 組、NaN 收入 ${cv.nanIncome} 組`);
  log(bad.settle.length === 0 && want.settle.length === D011_MONEY_COUNT,
    'D011 結算後段逐項與實驗線相等：結算（沙盒不結算）、貸款、里程碑（一天最多一個）、評分與升星、紓困；錢完全相等',
    bad.settle.length ? `${bad.settle.length}/${D011_MONEY_COUNT} 差異：${bad.settle.slice(0, 2).join('｜')}`
      : `${D011_MONEY_COUNT} 組相等；還款 ${cv.loanPaid}（還清 ${cv.loanClosed}）、里程碑 ${cv.milestone}（剛好門檻 ${cv.milestoneAtThreshold}）、升星 ${cv.starBonus}、紓困 ${cv.bailout}（差 60 天擋下 ${cv.bailoutGap60}、錢剛好 20 ${cv.money20}）、淨額 0 ${cv.netZero}`);
  log(neutralBad.length === 0 && neutralN >= 200, 'D011 模擬的呼叫方式（src/sim/day.ts：neutralTaxMul、neutralUpkeepIn、不加其他收入）在第 2 類乘數 1、沒有進口與城市活動時與實驗線相等',
    neutralBad.length ? `${neutralBad.length}/${neutralN} 差異：${neutralBad.slice(0, 5).join(',')}` : `${neutralN} 組相等`);
  log(bad.report.length === 0, 'D011 結算報告跟狀態變化一致（淨額、還款、里程碑、升星、紓困）', bad.report.length ? bad.report.slice(0, 4).join('；') : `${D011_MONEY_COUNT} 組一致`);

  // 實驗線片段單點突變：實驗線原碼若是那樣，本線在存下來的案例上就對不上
  {
    const muts = gold.labMutants ?? [], miss = [], hit = [];
    const namesOk = canon(muts.map(x => x.name)) === canon(LAB_MUTANTS.map(x => x[0]));
    for (const x of muts) {
      if (x.equivalent) { miss.push(`${x.name} 標成等價`); continue; }
      try {
        const r = runMoney3D(money, moneyCase(x.case)), got = canon(r[x.part]), base = want[x.part]?.[x.case];
        if (got === x.out) miss.push(`${x.name}：本線跟突變後的實驗線一樣`);
        else if (got !== base) miss.push(`${x.name}：本線在第 ${x.case} 組跟原實驗線就不同`);
        else hit.push(`${x.name} 第 ${x.case} 組`);
      } catch (e) { miss.push(`${x.name}: ${e.message}`); }
    }
    log(namesOk && muts.length >= 15 && miss.length === 0 && hit.length === muts.length,
      `D011 實驗線資金原碼單點突變：${muts.length} 個都使守衛轉紅（每個都有對不上的案例）`, miss.length ? miss.join('；') : hit.join('、'));
  }

  // 本線單點突變
  const portFirst = new Map();   // 名稱 → 第一個對不上的案例（浮點順序那一段再用）
  {
    const source = read('src/sim/rules/money.ts'), detected = [], missed = [];
    for (const [name, from, to] of MUTANTS) {
      try {
        if (source.split(from).length !== 2) throw new Error(`突變錨點不是剛好一處：${from}`);
        const m = mutantModule(source.replace(from, to));
        let first = -1;
        for (let k = 0; k < D011_MONEY_COUNT && first === -1; k++) {
          const r = runMoney3D(m, moneyCase(k));
          if (canon(r.day) !== want.day[k] || canon(r.settle) !== want.settle[k]) first = k;
        }
        if (first === -1) missed.push(`${name} 未抓到`); else { detected.push(`${name} 第 ${first} 組`); portFirst.set(name, first); }
      } catch (e) { missed.push(`${name}: ${e.message}`); }
    }
    log(missed.length === 0 && detected.length === MUTANTS.length && MUTANTS.length >= 15,
      `D011 本線資金原碼（money.ts）單點突變：${MUTANTS.length} 個都使守衛轉紅`, missed.length ? missed.join('；') : detected.join('、'));
  }

  // 浮點加總順序：big 家族在、覆蓋夠（每組都有六種設施、55990 四組都有且預算不是 1、55973 前三項跨 2 的冪、收入與進口帶兩位小數）；
  // 六個浮點順序突變在實驗線那邊（樣本 labMutants：本線在那組＝原實驗線、≠突變後）與本線那邊（money.ts）都有對不上的案例
  {
    const cv = gold.coverage ?? {}, fi = FAMILIES.findIndex(([n]) => n === 'big'), bigN = fi < 0 ? 0 : FAMILIES[fi][1];
    const bigStart = FAMILIES.slice(0, Math.max(0, fi)).reduce((a, [, n]) => a + n, 0), byName = new Map((gold.labMutants ?? []).map(x => [x.name, x])), bad = [], ok = [];
    if (!(bigN >= 500 && cv.big === bigN && cv.bigRoadsMin >= 80 && cv.bigSvcAll === bigN && cv.bigBudgetAll === bigN && cv.bigStraddle >= 200 && cv.bigFrac >= 300))
      bad.push(`big 家族不足：${canon({ bigN, big: cv.big, bigRoadsMin: cv.bigRoadsMin, bigSvcAll: cv.bigSvcAll, bigBudgetAll: cv.bigBudgetAll, bigStraddle: cv.bigStraddle, bigFrac: cv.bigFrac })}`);
    const tag = k => k >= bigStart && k < bigStart + bigN ? '（big）' : '';
    for (const [name] of FLOAT_MUTANTS) {
      const x = byName.get(name), p = portFirst.get(name);
      if (!x || x.equivalent || !(x.case >= 0 && x.case < D011_MONEY_COUNT)) { bad.push(`實驗線「${name}」不在樣本或沒有對不上的案例`); continue; }
      try {
        const got = canon(runMoney3D(money, moneyCase(x.case))[x.part]);
        if (got !== want[x.part]?.[x.case] || got === x.out) bad.push(`實驗線「${name}」第 ${x.case} 組：本線不等於原實驗線或等於突變後`);
        else if (p === undefined) bad.push(`本線「${name}」沒轉紅`);
        else ok.push(`${name}：實驗線第 ${x.case} 組${tag(x.case)}、本線第 ${p} 組${tag(p)}`);
      } catch (e) { bad.push(`${name}: ${e.message}`); }
    }
    log(bad.length === 0, `D011 浮點加總順序（55970 逐格、55973、55990、56025）換了守衛會紅：big 家族 ${bigN} 組（路最少 ${cv.bigRoadsMin} 格、前三項跨 2 的冪 ${cv.bigStraddle} 組）、${FLOAT_MUTANTS.length} 個突變兩邊都轉紅`,
      bad.length ? bad.join('；') : ok.join('、'));
  }
}

// D020 驗收 3、4 的 Node 守衛：實驗線頁面實跑錨點（src/content/samples/d020-lab.json，tools/d016-parity.mjs --set=d020 錄，要無頭 Chrome）跟本線逐項比。
// 實驗線那一半離線錄好；本線那一半每次在這裡重算（tools/d020-ops.mjs prebuilt20／city20／lite20），碼在 Node 重新產生、雜湊要＝樣本記的（同 D012／D019）。由 tools/unit.mjs 呼叫。
//   預建城（8 個種子，500 人前的舊分支）：劇本（接長一條路、蓋接路與不接路的垃圾場、蓋了再復原、蓋了再拆、兩個拒絕）每一筆的資金、亂數抽取數、格子、污染場與地價；
//     推進一天：推進前就在的每一棟住宅幸福——**直接相等、只套糧食那一項**（本線自己扣垃圾，不再「扣回垃圾」）；局部垃圾係數；清運狀態全部
//     （每一格路的距離／來源／分區、設施、各區容量／需求／負載，取雜湊與逐項）；垃圾比例、容量、清運區數；評分（幸福、垃圾、就業……）。
//   自己造的城（tools/d020-cities.mjs，人口 500 以上的正式清運與 500 人以下的舊分支、超載區、死路網、斷開的路網、貼兩段路的多格設施、接不到路的住宅、離線的設施、
//     五種處理設施、平手、長距離、剛好 500 人與 499 人；沒有政策、沒有分區＝不會長新房子）：讀進來推進一天，分兩條——清運狀態全部、局部垃圾係數、垃圾量、容量、比例、人口＝實驗線；
//     住宅幸福（套糧食）、城市幸福、評分＝實驗線。
//   讀進來的城（AI 城 120 天、種子城）：清運狀態全部、垃圾量、容量、比例、清運區數、人口、局部垃圾係數＝實驗線。它們的住宅幸福不能跟實驗線「只套糧食」直接比：真實的城有本線沒搬的幸福項
//     （AI 城的政策 parkNight +.02、種子城名望 25 級的「微光之巔」+.02、種子城推進那天是通勤重算日）；所以垃圾那一步另用「代入」比——把實驗線垃圾之前的 h（探針 h0）塞進本線垃圾那一步的入口，
//     出來的 h 要＝實驗線垃圾之後的 h（h1，糧食之前），每一棟住宅逐位相等；這一步對所有的城（預建城、造的城、樣本城）都比，垃圾的扣分算式就在真實的城上驗到了。
//     另外再比端到端：把本線讀檔沒還原的政策 pol 與名望 rk 代進住宅幸福公式（守衛的暫存副本 day.ts；本線公式本來就有 parkNight、rankIdx ≥ 25 這兩項，只是 stepDay 寫死 null、0），
//     AI 城與種子城（不是通勤日的那一張）每一棟住宅幸福（套糧食）、城市幸福、評分就逐位＝實驗線——證明除了這兩項與通勤（T141／T129）之外，真實的城跟實驗線就是垃圾加糧食的差。
//   讀檔後 pop 的初值：實驗線讀檔把全域 pop 設成住宅人口總和（T510 包了 load，68519 → 68443–68448；讀檔時每棟只有 pw:true、沒有 wa，所以社宅 k127 不算），第一天的 sewNeed442（pop ≥ 500）
//     讀它，「高密度污水」−.04 跟著它走。本線 simFromSave 起頭原本是 0（D020 對拍抓到，src 已改成自己設 loadPop488）；守衛逐座核對「讀檔後本線的 pop＝實驗線讀檔後的 pop」（完全相等），
//     不補、不墊（有兩座造的城有社宅，一座有水一座沒水：讀檔時 432、推進時 432／660）。
//   本線 → 實驗線：本線的預建城碼（帶垃圾場、推進一天）匯入實驗線，設施清單（k8 的位置、變體）與對帳數字＝本線；實驗線匯出的碼本線解碼，設施清單＝實驗線自己量的。
//   覆蓋：兩個分支各被幾個案例蓋到、每一種情況（超載區、死路網、沒路的住宅、離線設施、合併的區、太遠與黃色距離、比例夾在 2……）都有案例真的走到；沒走到＝紅（比了等於沒比）。
//   突變：把本線 src/sim/rules/garbage.ts 的副本（複製到暫存目錄再載入）改壞一處、整套（清運狀態＋代入 h0 的垃圾那一步）重跑，守衛要紅（每一個都要抓到；沒改的副本先核過全等）。
// 實驗線多的、本線沒搬的（只量不判、逐項講明白）：糧食（55414–55424，幸福再加一個逐日常數；探針讀 foodSupplyRate482）；固定就業（焚化廠 k62 +12、回收中心 k29 +4、商業塔 k34、
// 商業綜合體 k106，本線 jobs 沒加，評分的就業項用實驗線的 jobs 代入再比）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { PRE_GROWTH_LINES, hsOf } from './d011-parity-lib.mjs';
import { batchDiff, effectOf, sharedOff } from './unit-d011-parity.mjs';
import { civvOfCode } from './d016-ops.mjs';
import { CORE, prebuilt20, prebuilt20Ops, city20, lite20, score3d, scoreParts } from './d020-ops.mjs';
import { cities20 } from './d020-cities.mjs';
import { loadCode } from '../src/io/save.ts';

const J = JSON.stringify, isObj = v => !!v && typeof v === 'object' && !Array.isArray(v), arr = Array.isArray;
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);   // 實驗線 37219
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

// 巢狀 JSON 的第一個差異（a＝本線、b＝實驗線；數字用 Object.is）：路徑與兩邊的值。keys＝指定物件的鍵順序（先講最有意義的）
export function firstDiff(a, b, at = '', keys = null) {
  if (Object.is(a, b)) return null;
  if (arr(a) && arr(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) { const d = firstDiff(a[i], b[i], `${at}[${i}]`); if (d) return d; }
    return a.length !== b.length ? `${at} 長度 本線 ${a.length} ≠ 實驗線 ${b.length}` : null;
  }
  if (isObj(a) && isObj(b)) {
    for (const k of keys ?? [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) { const d = firstDiff(a[k], b[k], `${at}.${k}`); if (d) return d; }
    return null;
  }
  return `${at}：本線 ${J(a)} ≠ 實驗線 ${J(b)}`;
}
const SAN_KEYS = ['g', 'stat', 'alloc', 'districts', 'fac', 'allRoots', 'activeRoots', 'alloc452', 'roads', 'hash'];

// 糧食：實驗線 55414–55424，foodCoreNeed482 > 0 時每一棟住宅（k1、tickBld 裡）h＝clamp(h＋clamp((供糧率−.5)×.11, −.06, .05), .05, 1)。本線沒搬，所以只套這一項
export const foodOf = pk => pk.foodCoreNeed482 > 0 ? clamp((pk.foodSupplyRate482 - .50) * .11, -.06, .05) : null;

// ---- 一座城（本線 m、實驗線 L）逐項比 ----
// 1. 清運與垃圾（跟幸福無關）：清運狀態全部、垃圾量／容量／比例、人口、工業就業、逐棟的局部垃圾係數、生長之前的抽取。m 要有 san、res、hsBefore、pop、jobsI；有 mig、tickSites、tickLand 才比那幾項
export function stateOff(m, L) {
  const bad = [], put = s => bad.push(s), pk = L.pk;
  const ds = firstDiff(m.san, L.san, '', SAN_KEYS);
  if (ds) put(`清運狀態${ds}`);
  if (m.mig !== undefined && L.mig !== undefined && m.mig !== L.mig) put(`讀檔重挑外觀 本線 ${m.mig} 棟 ≠ 實驗線 ${L.mig} 棟`);
  if (m.pop !== pk.popT) put(`人口 本線 ${m.pop} ≠ 實驗線 ${pk.popT}（垃圾量、正式清運都從它來）`);
  if (m.jobsI !== pk.jobsI) put(`工業就業 本線 ${m.jobsI} ≠ 實驗線 ${pk.jobsI}`);
  if (!Object.is(m.san.g.dec, pk.garbRatio)) put(`評分用的垃圾比例（garbDecisionRatio452）本線 ${m.san.g.dec} ≠ 實驗線 ${pk.garbRatio}`);
  const before = new Set(m.hsBefore), lab = new Map(L.res.map(r => [r[0], r]));
  let homes = 0;
  for (const [i, , gl] of m.res) {
    if (!before.has(i)) continue;
    homes++;
    const q = lab.get(i);
    if (!q) put(`第 ${i} 格住宅：實驗線沒有這一棟`); else if (!Object.is(q[2], gl)) put(`第 ${i} 格住宅：局部垃圾係數 本線 ${gl} ≠ 實驗線 ${q[2]}`);
  }
  if (m.tickSites) { const d = sharedOff(L.tickSites, m.tickSites, PRE_GROWTH_LINES.map(String)); if (d) put(`推進那一天生長之前的抽取：${d}`); }
  if (m.tickLand !== undefined && m.tickLand !== L.tickLand) put(`推進開頭地價框改了 本線 ${m.tickLand} 格 ≠ 實驗線 ${L.tickLand} 格`);
  return { bad, homes };
}
// 2. 住宅幸福與評分（端到端，只給沒有政策、沒有名望、不是通勤日的城：預建城、造的城）：推進前就在的每一棟住宅 h＝本線 h 只套糧食；城市平均幸福；評分各項與總分。
//    評分：垃圾、幸福一定比；就業項與總分用實驗線的 jobs 代入（本線 jobs 沒加焚化廠、回收中心、商業塔、綜合體的固定就業）；消防、學校的覆蓋計數兩邊一樣才比 fire、edu、總分
export function hOff(m, L, mods = CORE) {
  const bad = [], put = s => bad.push(s), pk = L.pk, sc = L.sc, note = {};
  if ((sc.commuteN ?? 0) > 0 || (sc.loadN ?? 0) > 0) put(`實驗線這一天有通勤懲罰 ${sc.commuteN} 格、壅堵 ${sc.loadN} 格：幸福比不了`);
  const before = new Set(m.hsBefore), lab = new Map(L.res.map(r => [r[0], r])), food = foodOf(pk), want = h => food === null ? h : clamp(h + food, .05, 1);
  let sum = 0, n = 0;
  for (const [i, h, gl] of m.res) {
    if (!before.has(i)) continue;
    const q = lab.get(i), w = want(h);
    if (!q) continue;   // stateOff 已經講過
    if (!Object.is(q[1], w)) put(`第 ${i} 格住宅：實驗線 h ${q[1]} ≠ 本線 h ${h}${food === null ? '' : ` 套糧食（${food >= 0 ? '+' : ''}${food}）＝ ${w}`}（局部垃圾係數 本線 ${gl}／實驗線 ${q[2]}）`);
    sum += w; n++;
  }
  note.homes = n;
  const happy = n ? sum / n : m.cityHappy;
  if (!Object.is(sc.cityHappy, happy)) put(`城市平均幸福 本線（推進前就在的住宅套糧食）${happy} ≠ 實驗線 ${sc.cityHappy}`);
  note.jobsDiff = m.jobs !== sc.jobs;
  if (m.pop < 50) {
    if (sc.score !== -1 || sc.cityStar !== -1 || sc.pop !== m.pop) put(`人口 ${m.pop} < 50 不評分：實驗線 score ${sc.score}、星等 ${sc.cityStar}`);
    note.scored = 0;
  } else {
    const P3 = scoreParts(happy, m.pop, sc.jobs, m.scnt, m.san.g.dec), Pl = sc.parts ?? {}, cntSame = J(m.scnt) === J(L.scnt);
    for (const k of ['happy', 'garb', 'job', ...(cntSame ? ['fire', 'edu'] : [])]) if (!Object.is(P3[k], Pl[k])) put(`評分的「${k}」項 本線 ${P3[k]} ≠ 實驗線 ${Pl[k]}`);
    if (cntSame) {
      const t = score3d(m.sim, happy, mods, sc.jobs);
      if (!Object.is(t.score, sc.score) || t.cityStar !== sc.cityStar) put(`評分 本線 ${t.score}（${t.cityStar} 星）≠ 實驗線 ${sc.score}（${sc.cityStar} 星）`);
    }
    note.scored = cntSame ? 1 : 0;
  }
  return { bad, note };
}
// 3. 代入（垃圾那一步吃實驗線自己的 h0）：出來的 h（推進前就在的每一棟住宅）＝實驗線垃圾之後的 h1；城市平均幸福（垃圾之後、糧食之前，本線 s.cityHappy）＝ h1 的平均。
//    m 是 lite20(…, h0) 的結果
export function isoOff(m, L) {
  const bad = [], put = s => bad.push(s), h1 = new Map(L.h1), h0 = new Map(L.h0), got = new Map(hsOf(m.sim.w.tiles));
  let sum = 0, n = 0;
  for (const i of m.hsBefore) {
    const q = h1.get(i), g = got.get(i);
    if (q === undefined) { put(`第 ${i} 格住宅：實驗線沒有垃圾之後的 h`); continue; }
    if (!Object.is(g, q)) put(`第 ${i} 格住宅：垃圾之後 h 本線 ${g} ≠ 實驗線 ${q}（垃圾之前 h0 ${h0.get(i)}、局部垃圾係數 ${m.sim.san.garbLocal[i]}）`);
    sum += q; n++;
  }
  const mean = n ? sum / n : .6;
  if (!Object.is(m.cityHappy, mean)) put(`垃圾之後的城市平均幸福 本線 ${m.cityHappy} ≠ 實驗線各棟 h1 的平均 ${mean}`);
  return { bad, homes: n };
}
// 4. 接線（結算用的垃圾比例）：stepDay 給結算的星等（DayReport.settle.star，升星才有）＝拿同一份推進後的狀態（本線自己的幸福、jobs、覆蓋計數、評分用的垃圾比例）另外算一次的星等——
//    stepDay 結算時要是沒用 garbDecisionRatio452（例如寫死 2），垃圾那一項就差 10 分，星等就對不上（評分不在 DayReport 裡，只看得到升星）
export function starOff(m, mods = CORE) {
  const t = score3d(m.sim, m.sim.cityHappy, mods), want = t.cityStar > m.bestStar0 ? t.cityStar : null, got = m.settle.star ? m.settle.star.star : null;
  return Object.is(want, got) ? null : `結算的星等 stepDay ${got} ≠ 同一份狀態另外算的 ${want}（分數 ${t.score}）`;
}
// 真實的城（樣本城）的幸福：實驗線 h 跟「本線 h 套糧食」的差，湊成分布（只量不判；差的來源見檔頭）
export function deltaText(m, L) {
  const before = new Set(m.hsBefore), lab = new Map(L.res.map(r => [r[0], r])), food = foodOf(L.pk), d = {};
  for (const [i, h] of m.res) { if (!before.has(i)) continue; const q = lab.get(i); if (!q) continue; const k = (q[1] - (food === null ? h : clamp(h + food, .05, 1))).toFixed(4); d[k] = (d[k] || 0) + 1; }
  const top = Object.entries(d).sort((a, b) => b[1] - a[1]);
  return top.slice(0, 3).map(([k, n]) => `${+k >= 0 ? '+' : ''}${k}×${n}`).join('、') + (top.length > 3 ? `、其他 ${top.slice(3).reduce((a, [, n]) => a + n, 0)} 棟` : '');
}

// ---- 覆蓋：實驗線那邊量到的（兩邊相等時就是本線走到的）每一種情況各有幾座城。min＝守衛要求「至少有這麼多座城真的走到」----
const COVER = [
  ['formal', '正式清運（人口 ≥ 500，T452 清運分區）', r => r.stat.formal === 1, 12],
  ['small', '500 人前（舊 T119 分支）', r => r.stat.formal === 0, 8],
  ['over', '有超載的區（負載 > 1，住宅扣 (負載−1)×.15）', r => r.alloc.overloadedDistricts > 0, 5],
  ['dead', '死路網（有人住、沒有處理設施：deadDemand > 0，評分的比例 2）', r => r.alloc.deadDemand > 0, 3],
  ['noroad', '接不到路的住宅（沒有路的垃圾量 noRoadDemand > 0）', r => r.alloc.noRoadDemand > 0, 3],
  ['offline', '離線的處理設施（沒接路）', r => r.stat.offlineFacilities > 0, 4],
  ['multi', '斷開的路網有各自的設施（清運區 ≥ 2 且各區都有容量）', r => r.districts.filter(q => q[4] > 0).length >= 2, 2],
  ['far', '正式清運裡離設施太遠（> 18 格）的住宅', r => r.stat.formal === 1 && r.g.far > 0, 3],
  ['warn', '正式清運裡黃色距離（13–18 格）的住宅', r => r.stat.formal === 1 && r.g.warn > 0, 3],
  ['farSmall', '500 人前離垃圾場道路距離 > 18 的住宅（−.045）', r => r.stat.formal === 0 && r.g.far > 0, 4],
  ['pool', '500 人前全城池扣分（比例 > 1，garbPen409 > 0）', r => r.stat.formal === 0 && r.g.garbPen409 > 0, 2],
  ['clamp2', '垃圾比例夾在 2（垃圾量 > 2×容量，容量 > 0）', r => r.g.garbCap > 0 && r.g.garbage > 2 * r.g.garbCap && r.g.garbRatio === 2, 2],
  ['worse', '評分用的比例＝最壞那一區的負載（> 全城比例）', r => r.alloc.worstDistrict >= 0 && r.g.dec > r.g.garbRatio, 2],
  ['deadDec', '評分用的比例因為死路網夾到 2（全城比例 < 2）', r => r.stat.formal === 1 && r.alloc.deadDemand > 0 && r.g.garbRatio < 2 && r.g.dec === 2, 1],
  ['inf', '負載無限大的區（有需求、沒有容量：負載 Infinity）', r => r.districts.some(q => q[8] === 'Infinity'), 2],
  ['nofac', '完全沒有處理設施', r => r.stat.totalFacilities === 0, 3],
  ['kinds', '五種處理設施（8、29、62、88、111）都有上線的（全部城合起來）', null, 1],
];
export const coverOf = recs => COVER.map(([id, name, f, min]) => ({ id, name, min, n: f ? recs.filter(f).length : [8, 29, 62, 88, 111].every(k => recs.some(r => r.stat.activeByK.some(([kk]) => kk === k))) ? 1 : 0 }));

// ---- 守衛用的 src 副本：把 src/sim、src/io 複製到暫存目錄（src 原檔不動），garbage.ts 先套突變、再把 garbageStep 包一層——globalThis.__d020iso 有值時，
//      進垃圾那一步之前把每一棟住宅（k1）的 h 換成實驗線垃圾之前的 h0（沒值＝原樣），其餘一字不改；從那一份載入 loadCode、stepDay 等 ----
const WRAP = `
// ---- 守衛（tools/unit-d020-parity.mjs）加在暫存副本上的包裝，src 原檔沒有：代入實驗線垃圾之前的 h ----
export function garbageStep(w: World, san: SanState, pop: number, jobsI: number, tickBld: readonly number[]): number {
  const iso = (globalThis as { __d020iso?: { h0: Map<number, number> } }).__d020iso;
  if (iso) for (const i of tickBld) { const b = w.tiles[i].bld; if (b && !b.ref && b.k === 1) { const h = iso.h0.get(i); if (h !== undefined) b.h = h; } }
  return garbageStep0(w, san, pop, jobsI, tickBld);
}
`;
const HAPPY_ARGS = 'eventHappy: null, cookedReady: false, pol: null, rankIdx: 0, tvSignal: false, tech: s.edu.tech,';
const HAPPY_SUB = 'eventHappy: null, cookedReady: false, pol: (globalThis as { __d020happy?: { pol: unknown; rankIdx: number } }).__d020happy?.pol as never ?? null, rankIdx: (globalThis as { __d020happy?: { pol: unknown; rankIdx: number } }).__d020happy?.rankIdx ?? 0, tvSignal: false, tech: s.edu.tech,';
const HEAD = 'export function garbageStep(w: World, san: SanState, pop: number, jobsI: number, tickBld: readonly number[]): number {';
async function loadVariant(edit, tag) {
  let src = edit(fs.readFileSync(path.join(ROOT, 'src/sim/rules/garbage.ts'), 'utf8'));
  if (src.split(HEAD).length !== 2) throw new Error('garbageStep 的宣告要剛好一處（包裝要接在它前面）');
  src = src.replace(HEAD, HEAD.replace('export function garbageStep(', 'function garbageStep0(')) + WRAP;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `gt3d-d020-${tag}-`));
  try {
    for (const d of ['sim', 'io']) fs.cpSync(path.join(ROOT, 'src', d), path.join(dir, 'src', d), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, 'src/sim/rules/garbage.ts'), src);
    const dayFile = path.join(dir, 'src/sim/day.ts'), dayTxt = fs.readFileSync(dayFile, 'utf8');   // 住宅幸福公式的 pol、rankIdx 可以從 globalThis.__d020happy 代入（沒值＝原樣 null、0）
    if (dayTxt.split(HAPPY_ARGS).length !== 2) throw new Error('day.ts 的 residentialHappy 呼叫（pol: null, rankIdx: 0 那一行）要剛好一處');
    fs.writeFileSync(dayFile, dayTxt.replace(HAPPY_ARGS, HAPPY_SUB));
    const at = f => import(pathToFileURL(path.join(dir, f)).href);
    const [day, save, gar, money] = await Promise.all([at('src/sim/day.ts'), at('src/io/save.ts'), at('src/sim/rules/garbage.ts'), at('src/sim/rules/money.ts')]);
    return { loadCode: save.loadCode, stepDay: day.stepDay, garbDecisionRatio452: gar.garbDecisionRatio452, settleDay: money.settleDay, scoreCounts: money.scoreCounts };
  } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }   // import() 回來時整張模組圖都載入完了，檔案用不到了
}
const mutate = (from, to) => src => { const parts = src.split(from); if (parts.length !== 2) throw new Error(`錨點要剛好一處（找到 ${parts.length - 1}）：${from.slice(0, 50)}`); return parts.join(to); };
const MUTANTS = [
  ['垃圾場容量 40→41', 'export const DUMP_CAP = 40;', 'export const DUMP_CAP = 41;'],
  ['回收中心容量 ×.75→×.7', '29: DUMP_CAP * .75', '29: DUMP_CAP * .7'],
  ['焚化廠容量 100→90', '62: 100,', '62: 90,'],
  ['正式清運門檻 500→501', 'SAN_FORMAL_POP = 500,', 'SAN_FORMAL_POP = 501,'],
  ['太遠距離 18→19', 'SAN_LONG_DIST = 18,', 'SAN_LONG_DIST = 19,'],
  ['黃色距離 12→13', 'SAN_WARN_DIST = 12,', 'SAN_WARN_DIST = 13,'],
  ['多源 BFS：距離 0 的種子被後來的設施蓋掉', 'for (const j of seeds) if (san.dist[j] !== 0) {', 'for (const j of seeds) {'],
  ['清運區：貼多段路的設施不合併', 'for (let k = 1; k < f.length; k++) sanUnion(san, f[0], f[k]);', ''],
  ['住宅挑區：平手不看區號、改看路格號', 'a.dist - b.dist || a.district - b.district || a.road - b.road', 'a.dist - b.dist || a.road - b.road'],
  ['垃圾量：住宅 ×.05→×.06', 'residentPopulation488(b, () => undefined) * .05;', 'residentPopulation488(b, () => undefined) * .06;'],
  ['垃圾量：工業 ×.08→×.09', 'x = (JOBSI[b.lv] || 0) * .08;', 'x = (JOBSI[b.lv] || 0) * .09;'],
  ['沒有容量的區負載 Infinity→9', '(q.demand > 0 ? Infinity : 0)', '(q.demand > 0 ? 9 : 0)'],
  ['區的超載扣分 ×.15→×.14', 'capPen = q.load > 1 ? (q.load - 1) * .15 : 0;', 'capPen = q.load > 1 ? (q.load - 1) * .14 : 0;'],
  ['沒路、死路網 −.06→−.05', 'gl[i] = 2; b.h = clamp((b.h as number) - .06, .05, 1); unserved445++;', 'gl[i] = 2; b.h = clamp((b.h as number) - .05, .05, 1); unserved445++;'],
  ['正式清運太遠 −.045→−.04', 'gl[i] = clamp(localRatio + .3, 0, 2); b.h = clamp((b.h as number) - .045, .05, 1);', 'gl[i] = clamp(localRatio + .3, 0, 2); b.h = clamp((b.h as number) - .04, .05, 1);'],
  ['舊分支太遠 −.045→−.05', 'gl[i] = clamp(garbRatio + .3, 0, 2); b.h = clamp((b.h as number) - .045, .05, 1);', 'gl[i] = clamp(garbRatio + .3, 0, 2); b.h = clamp((b.h as number) - .05, .05, 1);'],
  ['舊分支太遠 > 18 改成 ≥ 18', 'if (bd > 18) {', 'if (bd >= 18) {'],
  ['舊分支：焚化廠不當距離的來源', 'if (b && ((!b.ref && b.k === 8) || b.k === 62)) dsrc.push(i);', 'if (b && (!b.ref && b.k === 8)) dsrc.push(i);'],
  ['舊分支全城池 ×.15→×.14', 'const pen = (san.garbRatio - 1) * .15;', 'const pen = (san.garbRatio - 1) * .14;'],
  ['垃圾比例沒有容量時 2→1.5', 'san.garbCap > 0 ? clamp(san.garbage / san.garbCap, 0, 2) : 2;', 'san.garbCap > 0 ? clamp(san.garbage / san.garbCap, 0, 2) : 1.5;'],
  ['500 人前也只算上線的容量', 'const formal = pop >= SAN_FORMAL_POP, effectiveCap = formal ? activeCap : totalCap;', 'const formal = pop >= SAN_FORMAL_POP, effectiveCap = activeCap;'],
  ['評分比例：死路網不夾 2', 'if (san.stat.formal && san.alloc.deadDemand > 0) return Math.max(garbRatio, 2);', ''],
  ['評分比例：不看最壞那一區', 'if (w) return Math.max(garbRatio, w.load);', 'if (w) return garbRatio;'],
  ['正式清運的 garbPen409 不記區的平均', 'if (local) san.garbPen409 = gl.penAvg || 0;', ''],
];

// 推進那一天（存檔的 day＋1）是不是第 4 的倍數：實驗線每 4 天重算通勤（T141 computeCommute，54991）、壅堵（T129 roadLoad），本線沒搬
const commuteDayOf = code => (decodeLabCode(code).save.day + 1) % 4 === 0;
const isHex = v => typeof v === 'string' && /^[0-9a-f]{1,8}$/.test(v);
const isNum = v => typeof v === 'number' && Number.isFinite(v);
const sanOk = s => isObj(s) && isObj(s.hash) && ['dist', 'src', 'active', 'net', 'rootAlloc', 'rootDemand', 'garbLocal'].every(k => isHex(s.hash[k])) && isObj(s.stat) && isObj(s.alloc) && isObj(s.g) && arr(s.districts) && arr(s.fac) && arr(s.allRoots) && arr(s.activeRoots) && arr(s.alloc452) && Number.isInteger(s.roads)
  && ['garbage', 'garbCap', 'garbRatio', 'garbPen409', 'far', 'unserved', 'warn', 'penAvg', 'dec'].every(k => isNum(s.g[k]));
const pkOk = p => isObj(p) && ['garbage', 'garbCap', 'garbPen409', 'garbFar409', 'garbUnserved445', 'garbWarn445', 'garbPenAvg', 'garbRatio', 'foodCoreNeed482', 'foodSupplyRate482', 'jobsI', 'popT'].every(k => isNum(p[k]));
const scOk = c => isObj(c) && isNum(c.score) && isNum(c.cityStar) && isNum(c.cityHappy) && isNum(c.pop) && isNum(c.jobs) && Number.isInteger(c.commuteN) && Number.isInteger(c.loadN) && (c.parts === null || isObj(c.parts));
const rowsOk = (r, w) => arr(r) && r.length > 0 && r.every(e => arr(e) && e.length === w && Number.isInteger(e[0]) && e.slice(1).every(isNum));   // res：[格, h, 局部垃圾係數]（w＝3）；h0／h1：[格, h]（w＝2）

export async function d020ParityGuards(log) {
  const read = p => fs.readFileSync(path.resolve(ROOT, p), 'utf8'), file = 'src/content/samples/d020-lab.json';
  if (!fs.existsSync(path.join(ROOT, file))) { log(false, 'D020 實驗線實跑錨點', `${file} 不存在：跑 tools/d016-parity.mjs --set=d020`); return; }
  const lab = JSON.parse(read(file)), seeds = lab.seeds ?? [];
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const prebuilt = read('src/content/samples/d011-prebuilt.code.txt').trim(), newcity = read('src/content/samples/newcity.code.txt').trim();
  const src = `實驗線 ${String(lab.source?.commit).slice(0, 7)} v${lab.source?.version}`;
  const P = prebuilt20Ops(loadCode(codeWithSeed(prebuilt, seeds[0] ?? 5162026), KT, vrank).sim);
  const list = arr(lab.cityList) ? lab.cityList : [];

  // ---- 欄位齊全 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED) bad.push('source.commit');
    if (lab.source?.tool !== 'tools/d016-parity.mjs --set=d020') bad.push('source.tool');
    if (!(arr(seeds) && seeds.length >= 8 && seeds.every(Number.isInteger))) bad.push('seeds（要 ≥ 8 個）');
    for (const seed of seeds) {
      const q = lab.prebuilt?.[seed], b = lab.readback?.[seed], put = m => bad.push(`種子 ${seed} ${m}`);
      if (!isObj(q)) { put('prebuilt'); continue; }
      if (!arr(q.ops) || q.ops.length !== P.ops.length || !q.ops.every((r, i) => isObj(r) && r.k === P.ops[i].k && isNum(r.money) && Number.isInteger(r.draws) && isHex(r.tileHash) && isHex(r.fieldHash))) put('prebuilt.ops（筆數＝劇本）');
      if (!isObj(q.snap0) || !isObj(q.snapOps) || !isHex(q.snapOps.tileHash) || !isObj(q.inv) || !arr(q.pw) || !arr(q.hs) || !isObj(q.tickSites)) put('prebuilt 的快照／INV／有電／幸福／抽取');
      if (!sanOk(q.san) || !pkOk(q.pk) || !scOk(q.sc) || !rowsOk(q.res, 3) || !rowsOk(q.h0, 2) || !rowsOk(q.h1, 2) || !(arr(q.scnt) && q.scnt.length === 4) || !arr(q.civv) || typeof q.codeD !== 'string' || !Number.isInteger(q.popImport)) put('prebuilt 的清運狀態／探針／評分／逐棟／垃圾前後的 h／設施清單／匯出的碼');
      if (!isObj(b) || typeof b.ok !== 'boolean' || !arr(b.civv) || !isObj(b.measure) || !/^[0-9a-f]{8}$/.test(b.codeHash ?? '')) put('readback');
    }
    if (!(list.length >= 20 && list.every(c => isObj(c) && typeof c.id === 'string' && /^[0-9a-f]{8}$/.test(c.codeHash ?? '')))) bad.push('cityList（要 ≥ 20 座）');
    for (const c of list) {
      const x = lab.cities?.[c.id];
      if (!isObj(x) || !sanOk(x.san) || !pkOk(x.pk) || !scOk(x.sc) || !rowsOk(x.res, 3) || !rowsOk(x.h0, 2) || !rowsOk(x.h1, 2) || !arr(x.scnt) || x.scnt.length !== 4 || !arr(x.hs) || !isObj(x.tickSites) || !Number.isInteger(x.mig) || !Number.isInteger(x.popImport)) bad.push(`城 ${c.id}`);
    }
    log(!bad.length, `D020 對拍樣本欄位齊全（預建城 ${seeds.length} 個種子、讀進來的城 ${list.length} 座）：逐筆、清運狀態（逐格雜湊與各區、設施）、探針、評分、逐棟幸福與局部垃圾係數、垃圾前後的幸福 h0／h1、讀檔時的 pop、設施清單、匯出的碼；讀回`,
      bad.slice(0, 4).join('；') || `${src}；${seeds.length} 個種子＋${list.length} 座城`);
    if (bad.length) { log(false, 'D020 對拍：欄位不齊，後面的逐項比對都不跑', '先重跑 tools/d016-parity.mjs --set=d020'); return; }
  }

  // ---- 樣本的碼：Node 重新產生，雜湊要＝樣本記的（本線的碼變了、樣本沒重錄＝紅）----
  const codes = cities20(newcity, { ai120: read('src/content/samples/ai120.code.txt'), seed516: read('src/content/samples/seed516.code.txt') });
  {
    const bad = [];
    if (J(codes.map(c => c.id)) !== J(list.map(c => c.id))) bad.push(`城的清單 本線 ${codes.map(c => c.id).join(',')} ≠ 樣本 ${list.map(c => c.id).join(',')}`);
    else for (const [i, c] of codes.entries()) if (fnv1a(c.code) !== list[i].codeHash) bad.push(`城 ${c.id} 的碼跟錄樣本時不同`);
    log(!bad.length, 'D020 樣本的碼：樣本城（含改存檔日的種子城）與自己造的城，碼在 Node 重新產生、雜湊＝樣本記的（造城的程式或新城碼變了，就要重錄）', bad.slice(0, 3).join('；') || `${codes.length} 座`);
    if (bad.length) { log(false, 'D020 對拍：樣本的碼過期，後面的逐項比對都不跑', '先重跑 tools/d016-parity.mjs --set=d020'); return; }
  }
  const samples = codes.filter(c => c.kind === 'sample'), customs = codes.filter(c => c.kind !== 'sample');

  // ---- 本線這一邊重算 ----
  const pre = {}, city = {};
  for (const seed of seeds) pre[seed] = prebuilt20(codeWithSeed(prebuilt, seed), KT, vrank);
  for (const c of codes) city[c.id] = city20(c.code, KT, vrank);
  const recs = [...seeds.map(s => lab.prebuilt[s].san), ...codes.map(c => lab.cities[c.id].san)];
  const sanBrief = id => { const s = lab.cities[id].san, p = lab.cities[id].pk; return `人口 ${p.popT}（${s.stat.formal ? '正式清運' : '500 人前'}）、垃圾 ${+p.garbage.toFixed(2)}／容量 ${s.g.garbCap}、比例 ${+s.g.garbRatio.toFixed(3)}、評分用 ${+s.g.dec.toFixed(3)}、清運區 ${s.districts.length}、超載 ${s.alloc.overloadedDistricts}、局部扣分 ${s.g.far} 棟、沒路／死路網 ${s.g.unserved} 棟`; };

  // ---- 代入：垃圾那一步吃實驗線的 h0，出來的 h ＝ 實驗線的 h1（所有的城）；沒改的副本先在這裡整套跑一遍（也是突變的底）----
  const base = await loadVariant(s => s, 'base');
  const runIso = (mods, first) => {
    const out = [];
    const one = (name, code, ops, L) => {
      const m = lite20(mods, KT, vrank, code, ops, L.h0), bad = [...stateOff(m, L).bad, ...isoOff(m, L).bad];
      for (const x of bad) { out.push(`${name}：${x}`); if (first) return true; }
      return false;
    };
    for (const seed of seeds) if (one(`預建城 ${seed}`, codeWithSeed(prebuilt, seed), P.ops, lab.prebuilt[seed]) && first) return out;
    for (const c of codes) if (one(c.id, c.code, null, lab.cities[c.id]) && first) return out;
    return out;
  };
  const isoBad = runIso(base, false);

  // ---- 預建城（8 個種子；500 人前的舊分支）----
  {
    const bad = [], tallies = [], sc = [];
    for (const seed of seeds) {
      const m = pre[seed], L = lab.prebuilt[seed];
      for (const [name, a, b] of [['開跑前', m.snap0, L.snap0], ['劇本後', m.snapOps, L.snapOps]]) if (J(a) !== J(b)) bad.push(`種子 ${seed} ${name}：本線 ${J(a)} ≠ 實驗線 ${J(b)}`);
      const d = batchDiff(m.ops, L.ops, true); if (d) bad.push(`種子 ${seed} 劇本${d}`);
      for (const q of effectOf(P.ops, m.ops, 3000)) if (q.eff !== q.want) bad.push(`種子 ${seed} 劇本第 ${q.i + 1} 筆 ${J(P.ops[q.i])}：${q.want ? '應該改到東西卻沒有' : '應該什麼都不改卻改了'}`);
      if (J(m.inv) !== J(L.inv)) bad.push(`種子 ${seed} 推進後（住商工以外、覆蓋、地價）：本線 ${J(m.inv)} ≠ 實驗線 ${J(L.inv)}`);
      const old = new Set(m.pwBefore), pwOld = x => J(x.filter(([i]) => old.has(i)));
      if (pwOld(m.pw) !== pwOld(L.pw)) bad.push(`種子 ${seed} 推進前就在的住商工有電不同`);
      if (J(m.civv) !== J(L.civv)) bad.push(`種子 ${seed} 推進後的設施清單：本線 ${J(m.civv)} ≠ 實驗線 ${J(L.civv)}`);
      const a = stateOff(m, L), h = hOff(m, L), st = starOff(m);
      for (const x of [...a.bad, ...h.bad, ...(st ? [st] : [])]) bad.push(`種子 ${seed} ${x}`);
      // 實驗線匯出的碼：本線解碼，設施清單＝實驗線自己量的（垃圾場 k8 的位置與變體）
      if (!decodeLabCode(L.codeD).ok) bad.push(`種子 ${seed} 實驗線匯出的碼本線解不開`);
      else if (J(civvOfCode(L.codeD)) !== J(L.civv)) bad.push(`種子 ${seed} 實驗線匯出的碼解出來的設施 ≠ 實驗線自己量的`);
      tallies.push(`${seed}：垃圾 ${m.san.g.garbage.toFixed(2)}／容量 ${m.san.g.garbCap}（${m.san.stat.activeFacilities}/${m.san.stat.totalFacilities} 座上線）、局部扣分 ${m.san.g.far}/${a.homes} 棟、評分 ${L.sc.score.toFixed(3)}`);
      sc.push(h.note.scored);
      // 劇本不空跑：兩座垃圾場（一座接路、一座不接）、500 人前、局部扣分有的棟有、有的棟沒有（比了才有意義）
      const s = m.san;
      if (!(s.stat.totalFacilities === 2 && s.stat.activeFacilities === 1 && s.stat.formal === 0 && s.g.far > 0 && s.g.far < a.homes)) bad.push(`種子 ${seed}：設施 ${s.stat.activeFacilities}/${s.stat.totalFacilities} 座上線、局部扣分 ${s.g.far}/${a.homes} 棟（要 2 座、1 座上線、500 人前、有的住宅扣有的不扣）`);
    }
    log(!bad.length, `D020 驗收 3：實驗線頁面實跑預建城（${seeds.length} 個種子，${P.ops.length} 筆）——接長一條路、蓋一座接路的垃圾場、一座不接路的、蓋了再復原、蓋了再拆、蓋在路上與住宅上都拒絕（實驗線自己的拉線與點）：每一筆的資金、亂數抽取數、格子、污染場與地價相等；推進一天：推進前就在的每一棟住宅幸福**直接相等、只套糧食**（本線自己扣垃圾）；局部垃圾係數；清運狀態全部（每一格路的距離、來源、分區、設施、各區容量、需求、負載，取雜湊與逐項）、垃圾量、容量、比例、清運區數；評分的幸福、垃圾等各項；結算用的垃圾比例接線（stepDay 給結算的星等＝同一份狀態另外算的）；實驗線匯出的碼的設施清單＝實驗線自己量的`,
      bad.slice(0, 3).join('；') || `${tallies.slice(0, 2).join('；')}……；評分總分也比了的種子 ${sc.filter(Boolean).length}/${sc.length}（消防、學校覆蓋計數兩邊一樣才比總分）；預建城人口 ${pre[seeds[0]].pop}（500 人前）`);
  }

  // ---- 自己造的城：清運與垃圾（跟幸福無關）；住宅幸福與評分；垃圾那一步代入 h0 ----
  {
    const bad = [], per = [];
    for (const c of customs) { const r = stateOff(city[c.id], lab.cities[c.id]); for (const x of r.bad) bad.push(`${c.id}：${x}`); per.push(`${c.id} ${r.homes}`); }
    const nf = customs.filter(c => lab.cities[c.id].san.stat.formal).length, ns = customs.length - nf;
    log(!bad.length, `D020 驗收 3：自己造的城（${customs.length} 座；用本線的 encodeLabCode 生碼匯入實驗線、推進一天）的清運與垃圾：正式清運 ${nf} 座、500 人前 ${ns} 座——超載區、死路網、斷開的路網各有設施、貼兩段路的焚化廠合併成一區、接不到路的住宅、離線的設施、五種處理設施、多源 BFS 的平手、區號的平手、長距離的 12／13 與 18／19、剛好 500 人與 499 人、人口 < 50：每一座的清運狀態全部（每一格路的距離、來源、分區、設施、各區容量、需求、負載）、垃圾量、容量、比例、清運區數、人口、逐棟局部垃圾係數、生長之前的抽取都相等`,
      bad.slice(0, 3).join('；') || per.join('、'));
    const kindBad = customs.filter(c => (c.kind === 'formal' && !lab.cities[c.id].san.stat.formal) || (c.kind === 'small' && lab.cities[c.id].san.stat.formal)).map(c => `${c.id} 標 ${c.kind}、實驗線 ${lab.cities[c.id].san.stat.formal ? '正式' : '小城'}`);
    log(!kindBad.length, 'D020：造的城的設計＝實驗線量到的分支（標正式清運的人口 ≥ 500、標 500 人前的 < 500；B500 剛好 500 是正式、B499 是舊分支）', kindBad.join('；') || `${nf} 座正式、${ns} 座舊分支`);
    const bad2 = [], notes = [];
    let starN = 0;
    for (const c of customs) { const r = hOff(city[c.id], lab.cities[c.id]), st = starOff(city[c.id]); for (const x of [...r.bad, ...(st ? [st] : [])]) bad2.push(`${c.id}：${x}`); notes.push(r.note); if (city[c.id].settle.star) starN++; }
    const jd = notes.filter(n => n.jobsDiff).length, sc = notes.filter(n => n.scored).length;
    log(!bad2.length, `D020 驗收 3：自己造的城的住宅幸福與評分——推進前就在的每一棟住宅，實驗線的 h＝本線的 h 只套糧食（逐位；本線自己扣垃圾）、城市平均幸福、評分的幸福／垃圾／就業／消防／學校各項與總分＝實驗線（讀檔後 pop 是 src 自己設的，不補；見下面「讀檔後 pop」那兩條）`,
      bad2.slice(0, 3).join('；') || `${customs.length} 座、住宅 ${notes.reduce((a, n) => a + n.homes, 0)} 棟逐位相等；評分總分也比了 ${sc} 座（其餘消防或學校覆蓋計數兩邊不同）；就業本線≠實驗線的 ${jd} 座（焚化廠、回收中心的固定就業本線沒加；就業項用實驗線的 jobs 代入再比）；stepDay 結算升星的 ${starN} 座，星等＝同一份狀態另外算的`);
    const bad3 = customs.flatMap(c => isoBad.filter(x => x.startsWith(`${c.id}：`)).slice(0, 1)), bad4 = seeds.flatMap(s => isoBad.filter(x => x.startsWith(`預建城 ${s}：`)).slice(0, 1));
    log(!bad3.length && !bad4.length, `D020 驗收 3：垃圾那一步代入實驗線的 h0（預建城 ${seeds.length} 個種子、自己造的城 ${customs.length} 座）——出來的每一棟住宅 h＝實驗線垃圾之後的 h1、垃圾之後的城市平均幸福相等（逐位）`, [...bad4, ...bad3].slice(0, 3).join('；') || `${seeds.length + customs.length} 座`);
  }

  // ---- 讀進來的城：AI 城、種子城（各一條，出事看得出是哪一座）----
  for (const [id, name] of [['ai120', 'AI 城（120 天，存檔第 121 天；政策 parkNight）'], ['seed516', '種子城 seed516（945 棟，有住宅塔與巨廈，名望 25 級；存檔日 210963、推進那天 210964 是通勤重算日）'],
    ['seed516d', '種子城 seed516（存檔日改 210961、推進那天不是通勤重算日）']]) {
    const m = city[id], L = lab.cities[id], a = stateOff(m, L), st = starOff(m), bad = [...a.bad, ...(st ? [st] : [])];
    const iso = isoBad.filter(x => x.startsWith(`${id}：`));
    // 端到端（代入本線讀檔沒還原的政策與名望）：不是通勤日才比
    const raw = decodeLabCode(codes.find(c => c.id === id).code).save.raw, e2e = commuteDayOf(codes.find(c => c.id === id).code) ? null : lite20(base, KT, vrank, codes.find(c => c.id === id).code, null, null, { happy: { pol: raw.pol ?? null, rankIdx: raw.rk ?? 0 } });
    const eb = e2e ? [...stateOff(e2e, L).bad, ...hOff(e2e, L, base).bad] : [];
    log(!bad.length && !iso.length && !eb.length, `D020 驗收 4：${name}讀進來推進一天——清運狀態全部、垃圾量、容量、比例、清運區數、人口、逐棟局部垃圾係數＝實驗線；垃圾那一步吃實驗線垃圾之前的 h0、出來的每一棟住宅 h＝實驗線垃圾之後的 h1（逐位）`,
      [...bad, ...iso, ...eb.map(x => `端到端：${x}`)].slice(0, 3).join('；') || `${sanBrief(id)}；住宅 ${a.homes} 棟局部垃圾係數與垃圾之後的 h 逐位相等；不代入政策與名望時，實驗線的幸福跟「本線 h 套糧食」差：${deltaText(m, L)}${L.sc.commuteN ? `（這天實驗線重算通勤：${L.sc.commuteN} 格通勤懲罰、${L.sc.loadN} 格壅堵，本線沒搬，端到端不比）` : ''}；${e2e ? `代入 pol（parkNight ${raw.pol?.parkNight ?? '—'}）與 rk ${raw.rk ?? 0} 之後，${hOff(e2e, L, base).note.homes} 棟幸福（套糧食）、城市幸福、評分逐位相等` : '通勤重算日，端到端幸福與評分不比'}`);
  }

  // ---- 讀檔後 pop 的初值（src 自己設；不補）----
  {
    const bad = [], fact = [], exact = [];
    const all = [...seeds.map(s => ({ id: `預建城 ${s}`, m: pre[s], L: lab.prebuilt[s] })), ...codes.map(c => ({ id: c.id, m: city[c.id], L: lab.cities[c.id] }))];
    for (const { id, m, L } of all) {
      if (m.popImport !== L.popImport) fact.push(`${id}：照實驗線的算法（讀檔時 pw:true、沒有 wa：住宅、塔、巨廈算，社宅不算）${m.popImport} ≠ 實驗線讀檔後的 pop ${L.popImport}`);
      if (m.popLoaded !== L.popImport) bad.push(`${id}：讀檔後本線 pop ${m.popLoaded} ≠ 實驗線 ${L.popImport}`); else exact.push(id);
    }
    const k127 = all.filter(({ m }) => m.sim.w.tiles.some(t => t.bld && !t.bld.ref && t.bld.k === 127)).map(({ id }) => id);
    log(!fact.length, `實驗線讀檔後的 pop（T510 包 load：balancePrepareAuthorities510 68519／68443–68448，＝Σ 住宅人口 64188；讀檔時每棟只有 pw:true）＝照那個算法算出來的（預建城與所有的城，其中有社宅 k127 的 ${k127.length} 座：${k127.join('、') || '沒有'}——社宅讀檔時沒有 wa，不算人口）`, fact.slice(0, 3).join('；') || `${all.length} 座`);
    log(!bad.length, `D020 讀檔後 pop 的初值：讀檔（loadCode）之後、推進之前，本線 pop＝實驗線讀檔後的 pop（第一天的 sewNeed442 讀 pop ≥ 500，「高密度污水」−.04 Lv3 以上沒接管的住宅；src/sim/day.ts simFromSave 的 loadPop488）`,
      bad.slice(0, 3).join('；') || `${exact.length}／${all.length} 座完全相等（預建城 ${seeds.length}、樣本城 ${samples.length}、造的城 ${customs.length}）；有社宅 k127 的 ${k127.length} 座：${k127.join('、')}`);
  }

  // ---- 本線 → 實驗線：本線預建城碼匯入實驗線，設施清單與對帳數字＝本線 ----
  {
    const bad = [];
    for (const seed of seeds) {
      const m = pre[seed], b = lab.readback[seed], S = decodeLabCode(m.code).save;
      if (b.codeHash !== fnv1a(m.code)) { bad.push(`種子 ${seed}：本線的碼跟錄樣本時不同（重跑 tools/d016-parity.mjs --set=d020）`); continue; }
      if (!b.ok) bad.push(`種子 ${seed}：實驗線讀不進本線的碼`);
      if (J(b.civv) !== J(civvOfCode(m.code)) || J(b.civv) !== J(m.civv)) bad.push(`種子 ${seed}：實驗線讀回的設施（種類、等級、變體）≠ 本線`);
      if (J(b.measure) !== J(cityStats(cityFromLab(S, KT, m.code)))) bad.push(`種子 ${seed}：實驗線讀回的對帳數字 ≠ 本線`);
      if (!m.civv.some(r => r[1] === 8)) bad.push(`種子 ${seed}：本線的碼裡沒有垃圾場（k8）`);
    }
    log(!bad.length, 'D020 本線 → 實驗線：本線預建城（蓋了垃圾場、推進一天）匯出的碼實驗線讀得進來，每一座垃圾場（k8）的位置、等級、變體與對帳數字＝本線', bad.slice(0, 3).join('；') || `${seeds.length} 張`);
  }

  // ---- 錄製時的事實（實驗線自己的兩個時刻：結算探針在 tick 裡、匯出在推進之後；垃圾前後的 h）----
  {
    const bad = [], all = [...seeds.map(s => [`預建城 ${s}`, lab.prebuilt[s]]), ...list.map(c => [c.id, lab.cities[c.id]])];
    for (const [name, x] of all) {
      const g = x.san.g, p = x.pk;
      if (!Object.is(g.garbage, p.garbage) || !Object.is(g.garbCap, p.garbCap)) bad.push(`${name}：垃圾量／容量 推進後讀 ${g.garbage}／${g.garbCap} ≠ tick 裡讀 ${p.garbage}／${p.garbCap}`);
      if (!Object.is(g.dec, p.garbRatio)) bad.push(`${name}：評分用的比例 推進後 ${g.dec} ≠ tick 裡 ${p.garbRatio}`);
      if (!Object.is(x.sc.pop, p.popT)) bad.push(`${name}：人口 評分那一刻 ${x.sc.pop} ≠ 探針 ${p.popT}`);
      if (x.sc.score !== -1 && x.sc.parts && !Object.is(x.sc.parts.happy, x.sc.cityHappy * 40)) bad.push(`${name}：評分的幸福項 ${x.sc.parts.happy} ≠ 城市幸福×40`);   // 人口 < 50 不評分（score −1），scoreParts 不更新
      if (x.san.stat.formal !== (p.popT >= 500 ? 1 : 0)) bad.push(`${name}：正式清運 ${x.san.stat.formal}、人口 ${p.popT}`);
      // 垃圾前後的 h：同一批住宅（格索引）；垃圾之後、糧食之後的最終 h（res）＝ h1 套糧食（實驗線那一段之間沒有別的東西改 h）
      if (J(x.h0.map(r => r[0])) !== J(x.h1.map(r => r[0]))) bad.push(`${name}：垃圾前後的住宅清單不同`);
      const food = foodOf(p), fin = new Map(x.res.map(r => [r[0], r[1]]));
      for (const [i, h1] of x.h1) { const w = food === null ? h1 : clamp(h1 + food, .05, 1); if (fin.has(i) && !Object.is(fin.get(i), w)) { bad.push(`${name}：第 ${i} 格住宅 垃圾之後 h ${h1} 套糧食 ${w} ≠ 推進後 ${fin.get(i)}（垃圾之後、糧食之後有別的東西改了 h）`); break; } }
    }
    log(!bad.length, `錄製時的事實（實驗線；兩邊都是實驗線錄的值，CI 不重算）：推進後讀的垃圾量、容量、評分用的比例＝結算探針在 tick 裡讀的；評分的幸福項＝城市幸福×40；人口 ≥ 500 ⇔ 正式清運；垃圾之後（h1）的每一棟住宅套糧食＝推進後的 h（垃圾前後的 h 探針沒漏東西）（${all.length} 座）`, bad.slice(0, 3).join('；') || `${all.length} 座`);
  }

  // ---- 覆蓋：兩個分支各被幾個案例蓋到、每一種情況都有案例真的走到 ----
  {
    const cov = coverOf(recs), miss = cov.filter(c => c.n < c.min);
    const nf = recs.filter(r => r.stat.formal).length, ns = recs.length - nf;
    log(!miss.length, `D020 覆蓋（預建城 ${seeds.length}＋樣本城 ${samples.length}＋造的城 ${customs.length}＝${recs.length} 個案例）：正式清運（T452 清運分區）${nf} 個、500 人前（舊 T119 口徑）${ns} 個；每一種情況都要有案例真的走到`,
      miss.length ? `不夠：${miss.map(c => `${c.name} ${c.n}／至少 ${c.min}`).join('；')}` : cov.map(c => `${c.id} ${c.n}`).join('、'));
  }

  // ---- 突變：本線 garbage.ts 的副本改壞一處，整套（清運狀態＋代入 h0 的垃圾那一步）重跑，要紅 ----
  {
    const caught = [], missed = [];
    for (const [name, from, to] of MUTANTS) {
      let d;
      try { d = runIso(await loadVariant(mutate(from, to), 'mut'), true); } catch (e) { missed.push(`${name}：${String(e.message).slice(0, 80)}`); continue; }
      (d.length ? caught : missed).push(d.length ? `${name}［${d[0].split('：')[0]}］` : `${name}（沒抓到）`);
    }
    log(!isoBad.length && !missed.length, `D020 突變：本線 garbage.ts 的副本（複製到暫存目錄再載入）改壞 ${MUTANTS.length} 處（容量、人口門檻、距離門檻、BFS 種子、區的合併、住宅挑區的平手、垃圾量係數、負載無限大、各種扣分、評分用的比例……），整套（預建城 ${seeds.length} 個種子、樣本城、造的城；清運狀態與代入實驗線 h0 的垃圾那一步）重跑，每一個都要紅（沒改的副本先核過全等）`,
      isoBad.length ? `沒改的副本就不同：${isoBad.slice(0, 2).join('；')}` : missed.length ? `沒抓到：${missed.join('；')}` : `抓到 ${caught.length}/${MUTANTS.length}：${caught.join('、')}`);
  }
}

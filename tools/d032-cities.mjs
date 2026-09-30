// D032 對拍用的城：政策與預算（K）——底城 × 政策組，政策寫在存檔的 pol 欄位（實驗線 66750 寫、66975 讀 `if(d.pol)pol=d.pol`：整個物件換掉），
// 所以實驗線頁面讀這張碼＝玩家讀一張有政策的存檔：先 rebuildCov、後設 pol（營養午餐的讀檔怪癖也在裡面）；本線 simFromSave 讀同一張碼、自己算，不代入任何政策。
// 底城：D028 的 K 系列（經濟：農場、旅宿、購物中心、科技園、銀行）、自造的 P1–P5（電力吃緊、火災與保險、分區生長與工業、公園與夜間與教育與垃圾、天然氣出口）、D022–D025 的老城（預建城、AI 城、種子城、展示城、經濟 G 系列）。
// 政策組：廣泛組（all＝本線給開的 11 個開關全開＋稅率 1.3／0.8／1.2；hi＝三條稅率 2.0；lo＝0.5）跑所有底城；單項組（每個有效果的開關單獨一組、稅率單獨一條各取 0.5／0.7／1.5／2.0）跑有對應設施的底城；
// stk＝緊急物資儲備（出口的城才看得到）；hid＝沒有消費者的 15 個開關全開（只多日費）。
// play：玩家在遊戲中按按鈕（政策、稅率＋／−、服務預算）——實驗線頁面用自己的 policyApply504／setSvcBudget 按、本線用 setPolicy／setBudget 按，每一天逐欄比。
// 全部用座標算出來，沒有 Math.random、現實時間。
import fs from 'node:fs';
import path from 'node:path';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { defaultPol, POLICY_SHOWN, POLICY_CATALOG } from '../src/sim/rules/policy.ts';
import { ROOT } from './cdp.mjs';
import { builder } from './d021-cities.mjs';
import { cities28 } from './d028-cities.mjs';
import { oldList } from './d026-lab.mjs';
import { oldzList } from './d027-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const range = (a, c, s = 1) => { const o = []; for (let x = a; x <= c; x += s) o.push(x); return o; };
export const CRAFTED_DAYS = 13, OLD_DAYS = 10;

// ---- 政策組 ----
export const SHOWN11 = [...POLICY_SHOWN.law, ...POLICY_SHOWN.policy];
export const HIDDEN15 = Object.keys(POLICY_CATALOG).filter(k => POLICY_CATALOG[k].type === 'toggle' && !SHOWN11.includes(k));
const P = o => ({ ...defaultPol(), ...o });
const on = ks => Object.fromEntries(ks.map(k => [k, true]));
export const GROUPS = {
  all: P({ ...on(SHOWN11), taxR: 1.3, taxC: .8, taxI: 1.2 }), hi: P({ taxR: 2, taxC: 2, taxI: 2 }), lo: P({ taxR: .5, taxC: .5, taxI: .5 }),
  stk: P(on(['emergencyStockpile492'])), hid: P(on(HIDDEN15)),
  ...Object.fromEntries(SHOWN11.map(k => [`s-${k}`, P(on([k]))])),
  ...Object.fromEntries(['R', 'C', 'I'].flatMap(t => [.5, .7, 1.5, 2].map(v => [`t${t}-${v}`, P({ [`tax${t}`]: v })]))),
};

// 把政策寫進一張碼（decode → 換 pol → encode，跟 tools/d026-lab.mjs noZone 同一套；d3 拿掉）。pol＝null：不動（存檔原本的 pol 照舊，AI 城有自己的五項）
export function withPol(code, pol) {
  if (pol === null) return code;
  const S = decodeLabCode(code).save, raw = { ...S.raw };
  raw.pol = pol; delete raw.z; delete raw.d3;
  return encodeLabCode(raw, { deflate: true });
}

// ---- 自造的底城 P1–P5 ----
function spine(b, rc = 3, x0 = 4, x1 = 66, z = 30) { b.road(x0, z, x1, z, rc); b.put(x0 - 1, z, 5); return b; }
function houses(b, xs, z, k = 1, o = () => ({})) { let n = 0; for (const x of xs) if (b.isFree(x, z, 1)) { b.put(x, z, k, 1 + (n % 3), { den: 1 + (n % 5), we: n % 3, ...o(n, x) }); n++; } return n; }
const PDEFS = [
  { id: 'P1', day: 100, note: '電力吃緊：一座 1 級電廠（容量 75）供 138 棟住商工（住宅 122、商業 10、工業 6）——容量用完、後面的沒電不繳稅；節能條例 +5 容量多通 5 棟', build: b => {
    spine(b);
    range(6, 15).forEach((x, n) => b.put(x, 28, 2, 1 + (n % 3)));
    range(52, 57).forEach((x, n) => b.put(x, 32, 3, 1 + (n % 2)));
    houses(b, range(5, 65), 29); houses(b, range(5, 65), 31);
  } },
  { id: 'P2', day: 200, note: '火災與保險：沒有消防局；三十棟住宅、五家商店、四座工廠各帶不同的燃燒天數（4 第 1 天燒毀、3 第 2 天、2 第 3 天、1 第 4 天），之後還會蔓延與新起火', build: b => {
    spine(b); b.put(20, 32, 11, 1);
    houses(b, range(5, 63, 2), 31, 1, n => ({ fire: [4, 3, 2, 1, 0][n % 5] }));
    [8, 12, 16, 20, 24].forEach((x, n) => b.put(x, 28, 2, 1 + (n % 2), { fire: [4, 0, 3, 0, 2][n] }));
    [40, 44, 48, 52].forEach((x, n) => b.put(x, 33, 3, 1 + (n % 2), { fire: [4, 2, 0, 1][n] }));
    houses(b, range(6, 62, 4), 29);
  } },
  { id: 'P3', day: 300, note: '分區生長與工業：主街兩側住宅區、商業區、工業區，已有一些建築；13 天內會長新房子（工業補貼的需求 +.15、稅率）', build: b => {
    spine(b); b.put(14, 32, 6, 1).put(18, 32, 11, 1);
    for (const z of [28, 29, 31, 32]) { b.flagRect('zn', 8, z, 44, z, 1); b.flagRect('zn', 45, z, 52, z, 2); b.flagRect('zn', 53, z, 64, z, 3); }
    houses(b, range(8, 40, 3), 29); houses(b, range(9, 41, 4), 31);
    [46, 49].forEach(x => b.put(x, 29, 2, 1 + (x % 2))); [54, 57, 60].forEach(x => b.put(x, 31, 3, 1));
  } },
  { id: 'P4', day: 95, note: '公園、夜間、教育、垃圾、犯罪：住宅 40 棟（高密度）＋商店 12＋公園 6＋學校 3＋垃圾場 1（超載）＋警察局 1（覆蓋不到東半）＋醫院；公園夜間開放、宵禁、夜市、營養午餐、回收宣導都看得到', build: b => {
    spine(b);
    b.put(30, 32, 8, 1).put(14, 32, 11, 1).put(36, 32, 12, 1);
    [10, 22, 34, 46, 58, 64].forEach(x => b.put(x, 28, 4, 1));
    [12, 28, 52].forEach(x => b.put(x, 33, 7, 1));
    range(6, 62, 5).forEach((x, n) => b.put(x, 27, 2, 1 + (n % 3)));
    houses(b, range(5, 65, 2), 29, 1, n => ({ den: 4 + (n % 2) }));
    houses(b, range(5, 65, 3), 31, 1, n => ({ den: 3 + (n % 3) }));
  } },
  { id: 'P5', day: 195, note: '天然氣出口：一座天然氣井（供 8）、一座化肥廠（需 3）、四座貿易站（額度 13：鋼材進口先吃 6、糧食 1，剩 6）、一棟小屋（人口少，糧食進口才少）——緊急物資儲備先留需求的 75%，出口從 5 壓到 2；糧食、商品、燃料的儲備在別的城看得到', build: b => {
    spine(b); b.put(14, 32, 6, 1).put(18, 32, 11, 1);
    b.put(30, 28, 118, 1).put(33, 32, 117, 1).put(40, 28, 91, 1).put(46, 28, 91, 1).put(52, 28, 91, 1).put(58, 28, 91, 1);
    houses(b, [6], 31);
  } },
];
// 只在這裡用：D028 的 K 系列與 D022–D025 的老城都是現成的碼
export function pCities(newcityCode, KT) {
  const template = decodeLabCode(newcityCode.trim()).save.raw, sizeOf = k => KT.size(k);
  return PDEFS.map((c, i) => { const b = builder(template, sizeOf); c.build(b); return { id: c.id, note: c.note, code: b.code(5162032 + 17 * i, c.day, '政策', {}), days: CRAFTED_DAYS }; });
}

// ---- 底城清單 ----
let cache = null;
export function baseCities() {
  if (cache) return cache;
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), newcity = read('src/content/samples/newcity.code.txt');
  const k28 = Object.fromEntries(cities28(newcity, KT).map(c => [c.id, c])), old = Object.fromEntries(oldList().map(c => [c.id, c])), oldz = Object.fromEntries(oldzList().map(c => [c.id, c]));
  const out = [];
  for (const id of ['K1', 'K3', 'K4', 'K5', 'K7', 'K9', 'K10', 'K11']) out.push({ id, kind: 'K', code: k28[id].code, days: CRAFTED_DAYS });
  for (const c of pCities(newcity, KT)) out.push({ id: c.id, kind: 'P', code: c.code, days: CRAFTED_DAYS, note: c.note });
  for (const id of ['pre5162026', 'ai120', 'seed516', 'gallery', 'F2', 'G2', 'G4', 'G9', 'G13', 'G14']) out.push({ id, kind: 'old', code: old[id].code, days: OLD_DAYS });
  for (const id of ['pre5162026', 'gallery']) out.push({ id: `${id}+z`, kind: 'oldz', code: oldz[id].code, days: OLD_DAYS });   // 分區不清：會長新房子（整條 tick 鏈）
  return cache = out;
}

// ---- 跑法清單：每一筆＝一頁實驗線（讀一張帶 pol 的碼、連推 days 天）----
export function d032Runs() {
  const bases = Object.fromEntries(baseCities().map(c => [c.id, c])), runs = [];
  const add = (base, group) => { const b = bases[base]; if (!b) throw new Error(`沒有底城 ${base}`); runs.push({ id: `${base}/${group}`, base, group, days: b.days, code: withPol(b.code, group === 'none' ? null : GROUPS[group]) }); };
  for (const b of baseCities()) for (const g of ['all', 'hi', 'lo']) add(b.id, g);                                        // 廣泛組：每座底城
  for (const base of ['K1', 'K3', 'K4', 'P5', 'G2', 'G4', 'G9', 'G13', 'G14', 'gallery', 'seed516']) add(base, 'stk');           // 緊急物資儲備：有出口的城
  for (const base of ['gallery', 'P1', 'K1']) add(base, 'hid');                                                           // 沒有消費者的 15 個開關：只多日費
  add('ai120', 'none');                                                                                                   // AI 城用自己存檔裡的五項
  for (const base of ['P1', 'P2', 'P3', 'P4', 'P5', 'K10', 'K7', 'gallery', 'K1', 'K3', 'K4', 'G2', 'G4', 'G9', 'G13', 'G14', 'seed516']) add(base, 'none');   // 對照組：沒有 pol 的存檔（政策的效果＝跟它的差；實驗線讀進來之後自己補出預設物件）
  for (const base of ['P1', 'P2', 'P3', 'P4']) for (const k of SHOWN11) add(base, `s-${k}`);                              // 單項：每個有效果的開關單獨一組
  for (const base of ['K10', 'gallery']) for (const k of ['tourPromo', 'nightMarket', 'ecoReg']) add(base, `s-${k}`);     // 觀光與商業的城再補三項
  add('K7', 's-schoolLunch');
  for (const base of ['P3', 'gallery']) for (const t of ['R', 'C', 'I']) for (const v of [.5, .7, 1.5, 2]) add(base, `t${t}-${v}`);   // 單條稅率
  return runs;
}

// ---- play：玩家在遊戲中按按鈕（每個動作在「推進第 day 天之前」按）----
// 動作：{ day, pol: [鍵, 值] }（政策面板的勾選、稅率框：policyApply504 的玩家路徑）、{ day, tax: [鍵, ±1] }（稅率 −／＋：polStep 算好下一個值再進 policyApply504）、{ day, bud: [類別, ±.1] }（服務預算 −／＋：setSvcBudget）
const ALL_ACTS = [...SHOWN11.map((k, i) => ({ day: 2 + (i % 3), pol: [k, true] })), { day: 3, tax: ['taxR', 1] }, { day: 4, tax: ['taxC', -1] }, { day: 5, tax: ['taxI', 1] },
  { day: 6, bud: ['police', .1] }, { day: 6, bud: ['fire', -.1] }, { day: 7, bud: ['health', .1] }, { day: 7, bud: ['edu', -.1] }];
export const PLAY = [
  { id: 'P4/play1', base: 'P4', acts: [{ day: 2, pol: ['schoolLunch', true] }, { day: 3, bud: ['edu', .1] }, { day: 4, tax: ['taxR', 1] }, { day: 5, tax: ['taxR', 1] }, { day: 6, pol: ['recycle', true] }, { day: 6, bud: ['police', -.1] },
    { day: 8, pol: ['parkNight', true] }, { day: 9, pol: ['schoolLunch', false] }, { day: 10, pol: ['nightMarket', true] }, { day: 10, pol: ['curfew', true] }, { day: 11, tax: ['taxC', -1] }, { day: 12, tax: ['taxC', -1] }] },
  { id: 'P1/play1', base: 'P1', acts: [{ day: 2, pol: ['ecoReg', true] }, { day: 3, pol: ['taxI', 1.5] }, { day: 4, pol: ['indSubsidy', true] }, { day: 6, pol: ['ecoReg', false] }, { day: 7, pol: ['taxR', 0.74] }, { day: 8, pol: ['tourPromo', true] }, { day: 9, bud: ['fire', .1] }] },
  { id: 'P2/play1', base: 'P2', acts: [{ day: 2, pol: ['insurance', true] }, { day: 3, pol: ['smokeDetect', true] }, { day: 3, bud: ['fire', -.1] }, { day: 5, bud: ['health', .1] }, { day: 6, pol: ['insurance', false] }, { day: 6, pol: ['insurance', true] }] },   // 第 6 天再按保險：冷卻（60 天）擋下來
  { id: 'K7/play1', base: 'K7', acts: [{ day: 2, pol: ['schoolLunch', true] }, { day: 2, bud: ['edu', .1] }, { day: 3, bud: ['edu', .1] }, { day: 4, bud: ['edu', -.1] }, { day: 5, pol: ['schoolLunch', false] }, { day: 6, pol: ['schoolLunch', true] }, { day: 7, bud: ['edu', 5] }, { day: 8, bud: ['nope', .1] }] },
  { id: 'gallery/play1', base: 'gallery', acts: ALL_ACTS },   // 展示城：一次按十一個開關、三條稅率、四條預算
  // 存檔本來就開著營養午餐：讀進來的教育場沒加午餐（實驗線的讀檔怪癖），之後改預算（rebuildCov）才補上、關掉再還原——本線 edu.schoolLunch 要在讀檔時就跟著設
  { id: 'K7/play2', base: 'K7', group: 's-schoolLunch', acts: [{ day: 2, bud: ['edu', .1] }, { day: 3, pol: ['schoolLunch', false] }, { day: 4, bud: ['edu', -.1] }, { day: 5, pol: ['schoolLunch', true] }] },
  { id: 'P4/play2', base: 'P4', group: 'all', acts: [{ day: 2, pol: ['curfew', false] }, { day: 3, pol: ['nightMarket', false] }, { day: 4, tax: ['taxR', -1] }, { day: 4, tax: ['taxR', -1] }, { day: 5, pol: ['schoolLunch', false] }, { day: 6, bud: ['police', .1] }, { day: 7, pol: ['recycle', false] }] },
];
export const PLAY_DAYS = 13;
export function d032Play() {
  const bases = Object.fromEntries(baseCities().map(c => [c.id, c]));
  return PLAY.map(p => ({ id: p.id, base: p.base, group: p.group ?? 'none', code: withPol(bases[p.base].code, p.group ? GROUPS[p.group] : null), days: bases[p.base].kind === 'old' ? OLD_DAYS : PLAY_DAYS, acts: p.acts }));
}

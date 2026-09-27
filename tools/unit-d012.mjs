// D012 Node 守衛（驗收 1、2）：讀檔照實驗線重挑外觀（T531）逐棟對拍、讀檔之後的切分對拍。由 tools/unit.mjs 呼叫；不開瀏覽器（CI 跑）。
// 黃金樣本 src/content/samples/d012-lab.json 是 tools/d012-parity.mjs 在實驗線實跑錄的（index.html @d23c18d；每座城開新頁、存檔槽 3、匯入前核對噪音場全 0）：
//   每座城 GV.importCode 之後 __t531mig 的增量（ensureVariety531 66848–66862 重挑了幾棟）、每一棟住商工根格
//   [格索引, k, lv, 存檔的 v, 讀檔之後的 v, 讀檔時的地價]；GV.save 之後再匯入一次的增量與每棟 v 有沒有變；
//   種子城、AI 城讀檔（不還原 v）之後，實驗線自己的 rciBlockOrigin547（70457）／rciAbsorbed555（71878）逐格切分。
// 這裡在 Node 重算本線那一半：
//   1. 每座城的碼照同一套做法重新產生（d012Cities，錄黃金樣本的工具也用它），fnv1a 雜湊要＝黃金樣本記的；不相等＝黃金樣本過期，要重跑工具。
//   2. 本線讀檔（有模擬的城 loadCode、只能看的城 viewCode，同 src/cityView.ts）之後，每一棟住商工根格的 v（格子與城市兩邊）＝實驗線讀檔之後的 v；
//      restyle 筆數＝實驗線 __t531mig 增量；這一次讀檔記的 restyle 事件逐筆對到換了的那幾棟。
//   3. 有模擬的城存檔再讀一次：第二次 0 棟、兩次存檔逐位元組相同（實驗線那邊第二次也是 0 棟，黃金樣本記的）。
//   4. 讀檔之後的切分：種子城、AI 城本線 B 檔（labPartition、drawPlan 'b'）逐格＝實驗線。
//   5. 突變要轉紅：src/sim/restyle.ts、src/sim/rules/land.ts 在記憶體裡另載一份、改一處（不改 src；做法同 tools/unit-d011-edit.mjs stepDayWith），
//      接進另載的 src/io/save.ts 讀檔，跑同一套比對，每一種都要比出差異；另載一份不改的要 0 差異（證明差異是突變造成的）。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, encodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { loadCode, viewCode, saveCode } from '../src/io/save.ts';
import { simFromSave } from '../src/sim/day.ts';
import { fieldsOf } from '../src/sim/rules/fields.ts';
import { gridOf, labPartition, partRow, partitionStats, drawPlan } from '../src/content/blocks.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const isRciRoot = b => !!b && !b.ref && b.k >= 1 && b.k <= 3;

export const D012_GOLDEN = 'src/content/samples/d012-lab.json';
export const SCRIPT_DAYS = [30, 60, 120];                                 // D011 劇本城：經過幾天存檔（存檔的 day＝1＋經過天數；120 天＝卡面的「第 121 天」）
export const PARITY_SEED = STARTER_SEEDS[0], PARITY_DAYS = 120;           // D011 對照那一跑（tools/d011-parity.mjs 第一個種子 5162026）：推進 120 次之後存檔
export const PART_CITIES = ['seed516', 'ai120'];                          // 驗收 2：讀檔之後的切分
export const ROW_FIELDS = '[格索引 z*n+x, k, lv（實驗線讀進來的 b.lv）, 存檔的 v（碼裡 bl 那一筆）, 讀檔之後的 v（ensureVariety531 重挑後）, 讀檔時的地價 LAND（ensureVariety531 讀的那一份）]';
export const PART_FIELDS = '[格索引, 是不是起點, 街區寬, 街區高, k, 街區 lv（區內最高）, 街區 v, 起點那格 lv, 起點那格 v, rciAbsorbed555]；非起點的寬高 k lv v 記 0（同 d004-partition-*.json）';

// 突變探針（卡面城市清單以外，驗收 1「lv 預設改 0」用）：種子城的碼，住商工每 4 棟把 1 棟的 lv 改成 0（碼裡 bl 的順序）。
// 實驗線讀檔照收 lv 0，重挑時用 lv||1（66855）；其他城的住商工沒有 lv 0，「lv 預設改 0」在它們上面等於沒改，比不出來
export function lv0Probe(code) {
  const raw = decodeLabCode(code).save.raw, o = { ...raw };
  delete o.z;                                                              // encodeLabCode 會重新壓、重新標
  let j = 0;
  o.bl = raw.bl.map(r => (r[1] >= 1 && r[1] <= 3 && j++ % 4 === 0 ? [r[0], r[1], 0, ...r.slice(3)] : r));
  return encodeLabCode(o, { deflate: true });
}

// 合成世界（沒有實驗線對應，只驗「ref 格不重挑」）：新城的地形上擺 36 棟住宅，種類表把住宅改成 2×2（refKinds），每棟另外 3 格是 ref 格。
// 實驗線的住商工都是 1×1（MSZ 沒有 k1–3），任何實驗線的城都沒有住商工的 ref 格，所以「不跳過 ref」在實驗線的城上等於沒改，只能在這裡比出來
export function refWorld(newcity) {
  const raw = decodeLabCode(newcity).save.raw, o = { ...raw }, n = raw.n ?? 72, bl = [];
  delete o.z;
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) bl.push([(8 + b * 3) * n + 8 + a * 3, 1, 1 + ((a + b) % 3), 0, 5]);
  o.bl = bl;
  return encodeLabCode(o, { deflate: true });
}
export const refKinds = KT => ({ ...KT, size: k => (k === 1 ? 2 : KT.size(k)) });

// 要對拍的城（黃金樣本的鍵照這個順序）。via：本線怎麼讀——'sim' 有模擬（loadCode）、'view' 只能看（viewCode），同 src/cityView.ts 的 SIM_SAMPLES。
// 碼一律在 Node 重新產生（決定性）：樣本碼照檔案；預建城照 tools/d011-parity.mjs 換種子；劇本城照 tools/unit-d011-edit.mjs scriptOf／runScript 在新城上跑，
// 經過 30／60／120 天各 saveCode 一次；對照那一跑照 tools/d011-parity-lib.mjs parity3d（同 tools/d011-ops.mjs 的劇本）推進 120 次之後 saveCode
export async function d012Cities(KT, vrank) {
  const out = [], S = id => `src/content/samples/${id}.code.txt`, code = id => read(S(id)).trim();
  const add = (id, label, via, c, how) => out.push({ id, label, via, code: c, how });
  add('seed516', '種子城', 'view', code('seed516'), S('seed516'));
  add('ai120', 'AI 城 120 天', 'view', code('ai120'), S('ai120'));
  add('gallery', '全種類', 'view', code('gallery'), S('gallery'));
  add('starter', '起步城', 'sim', code('starter'), S('starter'));
  const newcity = code('newcity'), pre = code('d011-prebuilt');
  add('newcity', 'D011 新城', 'sim', newcity, S('newcity'));
  for (const seed of STARTER_SEEDS) add(`prebuilt-${seed}`, `D011 預建城（種子 ${seed}）`, 'sim', codeWithSeed(pre, seed), `codeWithSeed(${S('d011-prebuilt')}, ${seed})，同 tools/d011-parity.mjs`);
  // D011 劇本城：runScript 每推進一天叫一次 onStep(s, null)；經過 30／60／120 天那一刻存檔（樣板與起始碼＝讀新城那一次，同 src/cityView.ts 的存檔）
  const { scriptOf, runScript } = await import('./unit-d011-edit.mjs');
  const L0 = loadCode(newcity, KT, vrank);
  if (!L0.ok) throw new Error('D011 新城讀不進來：' + L0.error);
  const day0 = L0.sim.day, saves = {};
  runScript(newcity, KT, vrank, scriptOf(newcity), {}, (s, o) => {
    const el = s.day - day0;
    if (!o && SCRIPT_DAYS.includes(el) && !saves[el]) saves[el] = saveCode(s, L0.template, L0.start);
  });
  for (const d of SCRIPT_DAYS) {
    if (!saves[d]) throw new Error(`D011 劇本城沒有跑到經過 ${d} 天`);
    add(`script-${d}`, `D011 劇本城經過 ${d} 天（第 ${day0 + d} 天）`, 'sim', saves[d], `tools/unit-d011-edit.mjs scriptOf／runScript（新城），經過 ${d} 天 saveCode`);
  }
  // D011 對照那一跑（種子 5162026）：本線那一半，推進 120 次之後 saveCode（樣板與起始碼＝讀那張換了種子的新城碼）
  const { parity3d } = await import('./d011-parity-lib.mjs');
  const pc = codeWithSeed(newcity, PARITY_SEED), P = parity3d(pc, KT, vrank, PARITY_DAYS), PL = loadCode(pc, KT, vrank);
  if (!PL.ok) throw new Error('D011 對照那一跑的起點碼讀不進來：' + PL.error);
  add(`parity-${PARITY_SEED}`, `D011 對照那一跑（種子 ${PARITY_SEED}，推進 ${PARITY_DAYS} 天）`, 'sim', saveCode(P.sim, PL.template, PL.start),
    `tools/d011-parity-lib.mjs parity3d(codeWithSeed(新城, ${PARITY_SEED}), ${PARITY_DAYS})，saveCode`);
  add('probe-lv0', '突變探針：種子城 1／4 住商工 lv 0', 'sim', lv0Probe(code('seed516')), 'lv0Probe(種子城)：住商工每 4 棟 1 棟 lv 改 0（卡面城市清單以外）');
  return out;
}

// 黃金樣本的形狀（錄製工具寫之前、守衛比之前各核一次）：比到的每一欄都要在、型別對。回傳問題清單
export function goldenShapeOff(G, ids) {
  const bad = [], isInt = Number.isInteger, isCnt = v => isInt(v) && v >= 0;
  if (!/^[0-9a-f]{40}$/.test(G?.source?.commit ?? '') || typeof G?.source?.version !== 'string') bad.push('source.commit／version');
  if (G?.vrankSameAsD009 !== true) bad.push('vrankSameAsD009（實驗線這一頁的 VRANK406 要＝d009-live.json）');
  for (const id of ids) {
    const c = G?.cities?.[id];
    if (!c || typeof c !== 'object') { bad.push(`cities.${id}`); continue; }
    if (!/^[0-9a-f]{8}$/.test(c.hash ?? '')) bad.push(`${id}.hash`);
    if (!Array.isArray(c.rows) || !c.rows.every(r => Array.isArray(r) && r.length === 6 && r.every(isInt))) bad.push(`${id}.rows`);
    for (const f of ['mig', 'mig2', 'scan', 'scan2', 'day', 'day2', 'changed']) if (!isCnt(c[f])) bad.push(`${id}.${f}`);
    if (typeof c.same2 !== 'boolean' || typeof c.vrankReady !== 'boolean') bad.push(`${id}.same2／vrankReady`);
    if (!Array.isArray(c.noise) || c.noise.length !== 2 || !c.noise.every(isCnt)) bad.push(`${id}.noise`);
    if (PART_CITIES.includes(id)) {
      const p = c.part;
      if (!p || !isCnt(p.n) || !Array.isArray(p.cells) || !p.cells.every(r => Array.isArray(r) && r.length === 10 && r.every(isInt)) || !p.stats || typeof p.stats !== 'object') bad.push(`${id}.part`);
    }
  }
  return bad;
}

// src 的一個模組在記憶體裡另載一份（不改 src；做法同 tools/unit-d011-edit.mjs stepDayWith）：import 的名字照原檔一個個從真的模組拿（同一個網址＝同一份模組），
// swap 蓋掉其中幾個；mutate＝[原文, 改成]，原文在檔案裡要剛好出現 1 次（src 改了找不到錨點就丟例外＝紅燈，守衛要跟著改）。回傳 names 列的那幾個名字
async function variantOf(rel, names, { swap = {}, mutate = null } = {}) {
  const file = path.join(ROOT, rel);
  let src = fs.readFileSync(file, 'utf8');
  if (mutate) {
    const [from, to] = mutate, hits = src.split(from).length - 1;
    if (hits !== 1) throw new Error(`${rel}：突變錨點「${from}」出現 ${hits} 次（要剛好 1 次）`);
    src = src.replace(from, () => to);
  }
  const ctx = {};
  for (const [, list, spec] of src.matchAll(/^import \{([^}]*)\} from '([^']+)';$/gm)) {
    const ns = await import(new URL(spec, pathToFileURL(file)).href);
    for (const k of list.split(',').map(q => q.trim()).filter(q => q && !q.startsWith('type '))) {
      if (!(k in ns)) throw new Error(`${spec} 沒有匯出 ${k}`);
      ctx[k] = ns[k];
    }
  }
  for (const k of Object.keys(swap)) if (!(k in ctx)) throw new Error(`${rel} 沒有 import ${k}`);
  Object.assign(ctx, swap);
  const js = stripTypeScriptTypes(src).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  vm.runInContext(`${js}\n;globalThis.__m = { ${names.join(', ')} };`, vm.createContext(ctx), { filename: `variant:${rel}` });
  return ctx.__m;
}
// 驗收 1 的五種突變（卡面「突變要轉紅」）：每一種改 src 的一處原文
export const MUTANTS = [
  { name: '拿掉地價項', file: 'src/sim/rules/land.ts', from: 'const tend = dens * .58 + lnd * .20;', to: 'const tend = dens * .58;' },
  { name: '不跳過 ref', file: 'src/sim/restyle.ts', from: 'if (!b || b.ref) continue;', to: 'if (!b) continue;' },
  { name: 'lv 預設改 0', file: 'src/sim/restyle.ts', from: 'b.lv || 1', to: 'b.lv || 0' },
  // 錨點（D012 審查後 restyle.ts 改成先改格子、城市那一棟對得上才改）：格子那一行是換行＋四格縮排開頭（'cb.v = v;' 裡也含 'b.v = v;'，不能只找它）
  { name: '只改城市不改格子', file: 'src/sim/restyle.ts', from: '\n    b.v = v;', to: '\n    void 0;' },
  { name: '只改格子不改城市', file: 'src/sim/restyle.ts', from: 'cb.v = v;', to: 'void cb;' },
];
// 另載的讀檔：restyle.ts（與 land.ts 的 pickV406）照突變改一處，接進另載的 save.ts。m＝null：都不改（對照組）
async function apiWith(m) {
  const onLand = m?.file === 'src/sim/rules/land.ts', onRestyle = m?.file === 'src/sim/restyle.ts';
  const swap = onLand ? { pickV406: (await variantOf(m.file, ['pickV406'], { mutate: [m.from, m.to] })).pickV406 } : {};
  const { restyle531 } = await variantOf('src/sim/restyle.ts', ['restyle531'], { swap, mutate: onRestyle ? [m.from, m.to] : null });
  return variantOf('src/io/save.ts', ['loadCode', 'viewCode', 'saveCode'], { swap: { restyle531 } });
}

const fmtV = xs => xs.slice(0, 3).map(([i, a, b]) => `格 ${i}：本線 ${a}、實驗線 ${b}`).join('；') + (xs.length > 3 ? '…' : '');

// 一座城：本線讀檔（api 的 loadCode／viewCode）之後跟黃金樣本 g 逐棟比。回傳問題清單 bad（空＝相等）與量到的東西。
// opt.trip：有模擬的城另外存檔再讀一次（第二次 0 棟、兩次存檔逐位元組相同）
export function checkCity(api, c, g, KT, vrank, opt = {}) {
  const out = { bad: [], cityV: [], tileV: [], roots: g.rows.length, restyled: null, events: 0, trip: null, city: null, sim: null };
  const S = decodeLabCode(c.code).save, n = S.n;
  let L = null;
  if (c.via === 'sim') {
    L = api.loadCode(c.code, KT, vrank);
    if (!L.ok) { out.bad.push('本線讀不進來：' + L.error); return out; }
    out.city = L.sim.city; out.sim = L.sim; out.restyled = L.restyled;
  } else {
    const V = api.viewCode(c.code, KT, vrank);
    if (!V.ok) { out.bad.push('本線讀不進來：' + V.error); return out; }
    out.city = V.city; out.restyled = V.restyled;
  }
  const city = out.city, want = new Map(g.rows.map(r => [r[0], r])), got = new Map(), setBad = [];
  for (const b of city.buildings) if (b.goneDay === undefined && b.k >= 1 && b.k <= 3) got.set(b.z * n + b.x, b);
  for (const [i, k, lv, , va] of g.rows) {
    const b = got.get(i);
    if (!b || b.k !== k || b.lv !== lv) setBad.push(`城市第 ${i} 格 ${b ? `k${b.k} lv${b.lv}` : '沒有住商工'}（實驗線 k${k} lv${lv}）`);
    else if (b.v !== va) out.cityV.push([i, b.v, va]);
    if (L) {
      const t = L.sim.w.tiles[i].bld;
      if (!isRciRoot(t) || t.k !== k || t.lv !== lv) setBad.push(`格子第 ${i} 格 ${t ? `k${t.k} lv${t.lv}${t.ref ? ' ref' : ''}` : '沒有建築'}（實驗線 k${k} lv${lv}）`);
      else if (t.v !== va) out.tileV.push([i, t.v, va]);
    }
  }
  for (const i of got.keys()) if (!want.has(i)) setBad.push(`城市第 ${i} 格多一棟住商工`);
  if (L) L.sim.w.tiles.forEach((t, i) => { if (isRciRoot(t.bld) && !want.has(i)) setBad.push(`格子第 ${i} 格多一棟住商工`); });
  if (setBad.length) out.bad.push(`住商工根格跟實驗線不同 ${setBad.length} 處：${setBad.slice(0, 3).join('；')}`);
  if (out.cityV.length) out.bad.push(`城市建築的 v ${out.cityV.length} 棟不同（${fmtV(out.cityV)}）`);
  if (out.tileV.length) out.bad.push(`格子的 v ${out.tileV.length} 棟不同（${fmtV(out.tileV)}）`);
  if (out.restyled !== g.mig) out.bad.push(`本線重挑 ${out.restyled} 棟 ≠ 實驗線 __t531mig 增量 ${g.mig}`);
  // 這一次讀檔的 restyle 事件：歷史最後 restyled 筆，日子＝讀檔那一天，逐筆對到「存檔的 v ≠ 讀檔之後的 v」的那一棟、v＝實驗線讀檔之後的 v
  const tail = out.restyled > 0 ? city.history.slice(-out.restyled) : [], changed = new Set(g.rows.filter(r => r[3] !== r[4]).map(r => r[0]));
  const evBad = tail.filter(e => e.t !== 'restyle' || e.day !== S.day || want.get(e.z * n + e.x)?.[4] !== e.v || !changed.has(e.z * n + e.x));
  const evAt = new Set(tail.map(e => e.z * n + e.x));
  out.events = tail.filter(e => e.t === 'restyle').length;
  if (evBad.length || tail.length !== changed.size || [...changed].some(i => !evAt.has(i)))
    out.bad.push(`restyle 事件 ${tail.length} 筆、實驗線換了 ${changed.size} 棟，對不上 ${evBad.length} 筆${evBad.length ? '（' + J(evBad[0]) + '）' : ''}`);
  // 存檔再讀一次：只能看的城本線介面不存，這裡照樣用 loadCode 讀一次再存（viewCode 跟 loadCode 沒有 d3 的那條路是同一套：simFromSave＋restyle531）
  if (opt.trip) {
    const L1 = L ?? api.loadCode(c.code, KT, vrank);
    if (!L1.ok) { out.bad.push('存檔再讀：loadCode 讀不進來：' + L1.error); return out; }
    const code1 = api.saveCode(L1.sim, L1.template, L1.start), L2 = api.loadCode(code1, KT, vrank), code2 = L2.ok ? api.saveCode(L2.sim, L2.template, L2.start) : '';
    out.trip = { first: L1.restyled, second: L2.ok ? L2.restyled : null, same: code1 === code2, replayed: L2.ok && L2.replayed, h1: L1.sim.city.history.length, h2: L2.ok ? L2.sim.city.history.length : null, len: code1.length };
    if (L1.restyled !== g.mig || !L2.ok || L2.restyled !== 0 || code1 !== code2 || !L2.replayed)
      out.bad.push(`存檔再讀：${L2.ok ? `第一次重挑 ${L1.restyled} 棟、第二次 ${L2.restyled} 棟、兩次存檔${code1 === code2 ? '' : '不'}相同、${L2.replayed ? '重播成功' : '沒有重播（' + L2.note + '）'}` : '讀不回來：' + L2.error}`);
  }
  return out;
}

// 合成世界（refWorld）：ref 格的 v、lv 都要留 0，restyle 事件只落在根格、筆數＝重挑棟數
export function checkRefWorld(api, code, KT, vrank) {
  const L = api.loadCode(code, refKinds(KT), vrank);
  if (!L.ok) return { bad: ['讀不進來：' + L.error] };
  const t = L.sim.w.tiles, n = L.sim.w.N, bad = [];
  let refs = 0, roots = 0;
  t.forEach((q, i) => { const b = q.bld; if (!b || b.k !== 1) return; if (b.ref) { refs++; if (b.v !== 0 || b.lv !== 0) bad.push(`ref 格 ${i} 的 lv／v 變成 ${b.lv}／${b.v}`); } else roots++; });
  const ev = L.sim.city.history.filter(e => e.t === 'restyle'), onRef = ev.filter(e => { const b = t[e.z * n + e.x].bld; return !b || b.ref; });
  if (onRef.length) bad.push(`restyle 事件落在 ref 格 ${onRef.length} 筆`);
  if (ev.length !== L.restyled) bad.push(`restyle 事件 ${ev.length} 筆 ≠ 重挑 ${L.restyled} 棟`);
  if (refs !== roots * 3) bad.push(`ref 格 ${refs} 格 ≠ 住宅 ${roots} 棟 × 3`);
  return { bad, refs, roots, restyled: L.restyled };
}

// 守衛跑到一半丟例外也要記成紅燈，不是整支崩掉（同 tools/unit-d011-edit.mjs）
export async function d012LookGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D012 外觀對拍守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const kindsCommit = JSON.parse(read('src/content/lab-kinds.json')).source.commit, ARCHE = JSON.parse(read('src/content/lab-arche.json')).arche;
  if (!fs.existsSync(path.join(ROOT, D012_GOLDEN))) { log(false, 'D012 黃金樣本存在', `${D012_GOLDEN} 不存在（先跑 tools/d012-parity.mjs）`); return; }
  const G = JSON.parse(read(D012_GOLDEN));
  const cities = await d012Cities(KT, vrank), ids = cities.map(c => c.id);

  // ---- 黃金樣本：出處、形狀、實驗線那一邊的前提 ----
  const shape = goldenShapeOff(G, ids), extra = Object.keys(G.cities ?? {}).filter(id => !ids.includes(id));
  log(!shape.length && !extra.length && G.source.commit === kindsCommit && G.source.tool === 'tools/d012-parity.mjs',
    'D012 黃金樣本：實驗線實跑錄的（出處 commit＝內容表 lab-kinds.json 那一個）、每座城的欄位齊全、實驗線這一頁的 VRANK406＝d009-live.json 的變體排名',
    shape.length || extra.length ? `形狀不對：${[...shape, ...extra.map(id => `多了 ${id}`)].slice(0, 6).join('、')}` : G.source.commit !== kindsCommit ? `出處 ${G.source.commit} ≠ 內容表 ${kindsCommit}`
      : `${G.source.commit.slice(0, 7)} v${G.source.version}、設定 ${G.config}、${ids.length} 座城（含 lv 0 探針）`);
  if (shape.length) return;
  const stale = cities.filter(c => fnv1a(c.code) !== G.cities[c.id].hash);
  log(!stale.length, 'D012 黃金樣本的碼＝這一版重算的碼（fnv1a；樣本碼、預建城換種子、劇本城與對照那一跑的存檔都在 Node 重新產生）',
    stale.length ? `黃金樣本過期（要重跑 tools/d012-parity.mjs）：${stale.map(c => `${c.id} ${fnv1a(c.code)}≠${G.cities[c.id].hash}`).join('、')}` : `${cities.length} 座城的雜湊全等`);
  const live = cities.filter(c => !stale.includes(c));
  const labOff = ids.filter(id => { const g = G.cities[id]; return g.noise[0] || g.noise[1] || !g.vrankReady || g.mig2 || !g.same2 || g.scan !== g.rows.length || g.scan2 !== g.rows.length || g.day2 !== g.day; });
  const migOff = ids.filter(id => G.cities[id].changed !== G.cities[id].mig);
  log(!labOff.length && !migOff.length, 'D012 實驗線那一邊：每次匯入前噪音場 NOISE 全 0、VRANK406 已成表、匯入之後沒有推進；存檔再匯入第二次 __t531mig 增量 0、每棟 v 不變；增量＝存檔 v 與讀檔之後 v 不同的棟數',
    labOff.length || migOff.length ? `不對：${[...labOff, ...migOff.map(id => id + '（增量≠換了的棟數）')].join('、')}`
      : `${ids.length} 座城 × 2 次匯入，噪音 0 格；第一次重挑合計 ${ids.reduce((a, id) => a + G.cities[id].mig, 0)} 棟、第二次 0 棟`);

  // ---- 驗收 1：逐棟對拍（照城分組，一組一行）----
  const real = { loadCode, viewCode, saveCode }, results = new Map();
  for (const c of live) {
    try { results.set(c.id, checkCity(real, c, G.cities[c.id], KT, vrank, { trip: true })); }
    catch (e) { results.set(c.id, { bad: ['丟例外：' + e.message], roots: 0, restyled: null, events: 0 }); }
  }
  const groups = [['種子城', ['seed516']], ['AI 城 120 天', ['ai120']], ['全種類', ['gallery']], ['起步城', ['starter']], ['D011 新城', ['newcity']],
    [`D011 預建城 ${STARTER_SEEDS.length} 個種子`, ids.filter(id => id.startsWith('prebuilt-'))], [`D011 劇本城經過 ${SCRIPT_DAYS.join('／')} 天的存檔`, ids.filter(id => id.startsWith('script-'))],
    [`D011 對照那一跑（種子 ${PARITY_SEED}）推進 ${PARITY_DAYS} 天的存檔`, [`parity-${PARITY_SEED}`]], ['突變探針（種子城 1／4 住商工 lv 0）', ['probe-lv0']]];
  for (const [name, grp] of groups) {
    const rs = grp.filter(id => results.has(id)).map(id => [id, results.get(id)]), via = cities.find(c => c.id === grp[0]).via;
    if (!rs.length) continue;
    const bad = rs.filter(([, r]) => r.bad.length);
    // 地價（資訊，不判）：本線讀檔時的地價跟實驗線不同的住商工根格數（本線讀檔的地價用預設預算、沒有犯罪旗標與噪音，D012 卡「沒做成的事」）
    const facts = bad.length ? [] : rs.map(([id, r]) => {
      const g = G.cities[id], cc = cities.find(c => c.id === id);
      const L = r.sim ? fieldsOf(r.sim.g).LAND : fieldsOf(simFromSave(decodeLabCode(cc.code).save, cc.code, KT, vrank).g).LAND;
      return `住商工 ${r.roots} 棟全等、重挑 ${r.restyled} 棟＝實驗線${r.trip ? `、存檔再讀第二次 ${r.trip.second} 棟` : ''}、讀檔地價跟實驗線不同 ${g.rows.filter(q => L[q[0]] !== q[5]).length} 格（資訊）`;
    });
    const same = facts.every(f => f === facts[0]);
    log(!bad.length, `D012 T531 逐棟對拍：${name}（${via === 'sim' ? '有模擬，loadCode' : '只能看，viewCode'}）讀檔之後每一棟住商工根格的 v（${via === 'sim' ? '格子與城市兩邊' : '城市'}）＝實驗線；重挑棟數＝__t531mig 增量；restyle 事件逐筆對到`,
      bad.length ? bad.map(([id, r]) => `${id}：${r.bad.join('；')}`).join(' ｜ ')
        : rs.length > 1 && same ? `${rs.length} 座各：${facts[0]}` : rs.map(([id], j) => `${rs.length > 1 ? id.split('-').pop() + '：' : ''}${facts[j]}`).join('；'));
  }
  // 讀檔時的地價（重挑讀的那一份）也逐格判：每一座城的每一棟住商工根格＝實驗線。上面各組只印不判；核對卡面時發現卡面把它寫成對拍結果，改成判的。
  // 本線讀檔的地價用預設預算、沒有犯罪旗標與噪音（D012 卡「沒做成的事」2）：樣本城都相同，任意分享碼不保證；哪天加的樣本不同，就在這裡紅
  {
    const off = [];
    let roots = 0;
    for (const c of live) {
      const r = results.get(c.id), g = G.cities[c.id];
      if (!r || r.bad.length) { off.push(`${c.id}：沒有讀檔結果`); continue; }
      const L = r.sim ? fieldsOf(r.sim.g).LAND : fieldsOf(simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank).g).LAND;
      const d = g.rows.filter(q => L[q[0]] !== q[5]);
      roots += g.rows.length;
      if (d.length) off.push(`${c.id}：${d.length} 格不同，例 格 ${d[0][0]} 本線 ${L[d[0][0]]}／實驗線 ${d[0][5]}`);
    }
    log(!off.length && roots > 0, 'D012 讀檔時的地價（重挑讀的那一份）：每一座城每一棟住商工根格＝實驗線讀檔時的 LAND（逐格）',
      off.length ? off.slice(0, 4).join('；') : `${live.length} 座城、住商工根格 ${roots} 格全相同`);
  }
  const trips = [...results].filter(([, r]) => r.trip);
  const tripBad = trips.filter(([id, r]) => r.trip.first !== G.cities[id].mig || r.trip.second !== 0 || !r.trip.same || !r.trip.replayed);
  const noTrip = cities.filter(c => !results.get(c.id)?.trip).map(c => c.id), s120 = results.get('script-120');
  log(!noTrip.length && !tripBad.length, 'D012 本線讀檔、存檔、再讀一次（每一座；只能看的 3 座本線介面不存，照樣用 loadCode 存讀）：第一次重挑棟數＝實驗線、第二次 0 棟、重播成功、兩次存檔逐位元組相同（實驗線第二次也是 0 棟）',
    noTrip.length ? `沒有跑到存檔再讀（黃金樣本過期或讀檔失敗）：${noTrip.join('、')}`
      : tripBad.length ? tripBad.map(([id, r]) => `${id}：第一次 ${r.trip.first} 棟（實驗線 ${G.cities[id].mig}）、第二次 ${r.trip.second} 棟、${r.trip.same ? '相同' : '不同'}、${r.trip.replayed ? '重播' : '沒重播'}`).join('；')
      : `${trips.length} 座；劇本城經過 120 天：歷史 ${s120?.trip ? s120.trip.h1 - s120.restyled : '?'} 筆 → 讀檔後 ${s120?.trip?.h1 ?? '?'} 筆（重挑 ${s120?.restyled ?? '?'} 筆）→ 再讀 ${s120?.trip?.h2 ?? '?'} 筆`);

  // ---- 驗收 2：讀檔之後的切分（本線 B 檔）＝實驗線讀檔（不還原 v）之後自己切的 ----
  for (const id of PART_CITIES) {
    const r = results.get(id), g = G.cities[id];
    if (!r?.city) { log(false, `D012 讀檔之後的切分：${id}`, '沒有讀檔結果（黃金樣本過期或讀檔失敗）'); continue; }
    const grid = gridOf(r.city), part = labPartition(grid, ARCHE), rows = part.map(partRow), want = new Map(g.part.cells.map(q => [q[0], J(q)])), d = [];
    if (rows.length !== want.size) d.push(`住商工格數 ${rows.length}≠${want.size}`);
    for (const q of rows) if (want.get(q[0]) !== J(q)) d.push(`格 ${q[0]}：本線 ${J(q.slice(1))} ≠ 實驗線 ${want.get(q[0])}`);
    const st = partitionStats(part, r.city.n), before = JSON.parse(read(`src/content/samples/d004-partition-${id}.json`)).stats;
    // B 檔要畫的街區＝實驗線畫的：起點且（多格或沒被吸收），lv／v 取起點那格（61581；同 tools/unit.mjs D004 drawDiff）
    const n = g.part.n, W = new Set(g.part.cells.filter(q => q[1] && (q[2] * q[3] > 1 || !q[9])).map(q => [q[0] % n, (q[0] / n) | 0, q[2], q[3], q[4], q[7], q[8]].join()));
    const Gd = new Set(drawPlan(grid, ARCHE, 'b').map(b => [b.x, b.z, b.w, b.h, b.k, b.lv, b.v].join()));
    const dd = [...[...W].filter(x => !Gd.has(x)).map(x => `少畫 ${x}`), ...[...Gd].filter(x => !W.has(x)).map(x => `多畫 ${x}`)];
    log(!d.length && !dd.length && J(st) === J(g.part.stats) && st.overlap === 0,
      `D012 讀檔之後的切分：${cities.find(c => c.id === id).label}本線 B 檔 labPartition 逐格＝實驗線讀檔（不還原 v）之後的 rciBlockOrigin547＋rciAbsorbed555；drawPlan 'b' 要畫的街區＝實驗線畫的；統計相同、重疊 0`,
      d.length || dd.length ? `${d.length} 格不同、畫法 ${dd.length} 筆不同：${[...d, ...dd].slice(0, 3).join('；')}` : J(st) !== J(g.part.stats) ? `統計 ${J(st)} ≠ 實驗線 ${J(g.part.stats)}`
        : `${rows.length} 格 0 差異；街區 ${st.blocks}（多格 ${st.multi}），D0 ${st.cells.d0}、被吸收 ${st.cells.absorbed}（讀檔前存檔 v：D0 ${before.cells.d0}、被吸收 ${before.cells.absorbed}）`);
  }

  // ---- 比對的量法自己會紅：黃金樣本（記憶體裡的複本）故意改壞一處，checkCity 要剛好比出那一處 ----
  {
    const pick = ids.filter(id => live.some(c => c.id === id) && G.cities[id].rows.length).slice(0, 1)[0] ?? null;
    const c = cities.find(q => q.id === pick), sim = cities.find(q => q.via === 'sim' && live.includes(q) && G.cities[q.id].rows.length && G.cities[q.id].mig);
    const tries = [];
    if (c && sim) {
      const g = G.cities[c.id], gs = G.cities[sim.id], row = gs.rows.find(r => r[3] !== r[4]);
      const alt = r => (r[4] + 1) % 12;
      const t1 = checkCity(real, c, { ...g, rows: g.rows.map((r, j) => (j === 0 ? [...r.slice(0, 4), alt(r), r[5]] : r)) }, KT, vrank);
      tries.push(['改一棟讀檔之後的 v', t1.cityV.length === 1 && t1.bad.length >= 1, `城市 ${t1.cityV.length} 棟不同`]);
      const t2 = checkCity(real, sim, { ...gs, rows: gs.rows.map(r => (r === row ? [...r.slice(0, 4), alt(r), r[5]] : r)) }, KT, vrank);
      tries.push(['有模擬的城改一棟', t2.cityV.length === 1 && t2.tileV.length === 1 && t2.bad.some(b => b.startsWith('restyle 事件')), `城市 ${t2.cityV.length}／格子 ${t2.tileV.length} 棟、事件${t2.bad.some(b => b.startsWith('restyle 事件')) ? '對不上' : '照對'}`]);
      const t3 = checkCity(real, c, { ...g, mig: g.mig + 1 }, KT, vrank);
      tries.push(['增量 +1', t3.bad.some(b => b.startsWith('本線重挑')), t3.bad[0] ?? '沒比出來']);
      const t4 = checkCity(real, c, { ...g, rows: g.rows.slice(1) }, KT, vrank);
      tries.push(['少一棟', t4.bad.some(b => b.startsWith('住商工根格')), t4.bad[0]?.slice(0, 40) ?? '沒比出來']);
    }
    const miss = tries.filter(t => !t[1]);
    log(tries.length === 4 && !miss.length, 'D012 比對的量法自己會紅：黃金樣本的複本故意改壞一處（改一棟的 v、增量 +1、少一棟），逐棟比對剛好比出那一處',
      tries.length !== 4 ? '找不到可以拿來改的城' : miss.length ? miss.map(t => `${t[0]}：${t[2]}`).join('；') : tries.map(t => `${t[0]}→${t[2]}`).join('；') + `（${c.id}、${sim.id}）`);
  }

  // ---- 驗收 1：突變要轉紅 ----
  const refCode = refWorld(read('src/content/samples/newcity.code.txt').trim());
  const rw = checkRefWorld(real, refCode, KT, vrank);
  log(!rw.bad.length && rw.restyled > 0, 'D012 合成世界（住宅改成 2×2，實驗線沒有對應）：ref 格不重挑、lv／v 留 0，restyle 事件只落在根格',
    rw.bad.length ? rw.bad.join('；') : `住宅 ${rw.roots} 棟、ref 格 ${rw.refs} 格；重挑 ${rw.restyled} 棟都在根格`);
  // 每一種突變（與不改的對照組）另載一份讀檔、所有城跑同一套比對（不含存檔再讀；切分只看 v），再加合成世界
  const sweep = async m => {
    const api = await apiWith(m), hit = [];
    for (const c of live) {
      let r;
      try { r = checkCity(api, c, G.cities[c.id], KT, vrank); } catch (e) { r = { bad: ['丟例外：' + e.message.slice(0, 60)] }; }
      if (r.bad.length) hit.push(`${c.id}：${r.cityV?.length || r.tileV?.length ? `v 不同 城市 ${r.cityV.length}／格子 ${r.tileV.length} 棟、重挑 ${r.restyled}（實驗線 ${G.cities[c.id].mig}）` : r.bad[0]}`);
    }
    let w;
    try { w = checkRefWorld(api, refCode, KT, vrank); } catch (e) { w = { bad: ['丟例外：' + e.message.slice(0, 60)] }; }
    if (w.bad.length) hit.push(`合成世界：${w.bad[0]}`);
    return hit;
  };
  const ctl = await sweep(null);
  log(!ctl.length, 'D012 突變的對照組：restyle.ts、save.ts 另載一份不改，所有城、合成世界都 0 差異（突變比出的差異是突變造成的，不是另載造成的）', ctl.length ? ctl.slice(0, 3).join('；') : `${live.length} 座城＋合成世界 0 差異`);
  for (const m of MUTANTS) {
    let hit;
    try { hit = await sweep(m); } catch (e) { log(false, `D012 突變要轉紅：${m.name}`, `另載失敗（src 改了、錨點要跟著改）：${e.message}`); continue; }
    log(hit.length > 0, `D012 突變要轉紅：${m.name}（${m.file}「${m.from}」→「${m.to}」）`, hit.length ? `${hit.length} 處比出差異：${hit.slice(0, 3).join('；')}${hit.length > 3 ? '…' : ''}` : '沒有一座城比出差異');
  }

  // ---- D012 審查補的三項（src/io/save.ts viewCode、src/sim/rules/fields.ts rebuildCov landAt、src/sim/city.ts stadiumSize）----
  // 1) 只能看的城讀檔時地價只算住商工根格：那些格的 LAND 跟整張算的逐位元組相同（重挑只讀根格的地價；覆蓋、污染照樣整張蓋）
  {
    const off = [];
    let cells = 0;
    for (const c of live) {
      const S = decodeLabCode(c.code).save, full = simFromSave(S, c.code, KT, vrank), lite = simFromSave(S, c.code, KT, vrank, undefined, true);
      const Lf = fieldsOf(full.g).LAND, Ll = fieldsOf(lite.g).LAND;
      for (const [i] of full.root) { const k = full.w.tiles[i].bld.k | 0; if (k < 1 || k > 3) continue; cells++; if (Lf[i] !== Ll[i]) off.push(`${c.id} 第 ${i} 格 ${Lf[i]}≠${Ll[i]}`); }
    }
    log(!off.length && cells > 0, 'D012 只能看的城讀檔只算住商工根格的地價（審查：大圖整張算太慢）：那些格的 LAND＝整張算的，逐格相同',
      off.length ? off.slice(0, 4).join('；') : `${live.length} 座城、住商工根格 ${cells} 格全相同`);
  }
  // 2) 大圖：1000×1000 的空圖（實驗線新圖有 432／648／1000）只能看的城讀檔（decode＋viewCode），取三次最快 < 1,500 ms
  // 3) 手改的碼：一串互相重疊的大體育場（350×350、對角 350 座、第 6 位寫 350）讀檔不爆：viewCode、loadCode（帶 d3）各 < 1,000 ms，體育場夾成 ≤ 4×4
  {
    const base = decodeLabCode(read('src/content/samples/newcity.code.txt').trim()).save.raw, nn0 = base.n * base.n;
    const mk = (n, bl, extra = {}) => { const o = JSON.parse(JSON.stringify(base)); delete o.z; delete o.d3; o.n = n;
      for (const k of Object.keys(o)) if (typeof o[k] === 'string' && o[k].length === nn0) o[k] = (k === 'ter' ? '2' : '0').repeat(n * n);
      o.bl = bl; Object.assign(o, extra); return encodeLabCode(o, { deflate: true }); };
    const best = f => { let t = Infinity, r; for (let k = 0; k < 3; k++) { const t0 = performance.now(); r = f(); t = Math.min(t, performance.now() - t0); } return [t, r]; };
    const big = mk(1000, []);
    const [tBig, rBig] = best(() => viewCode(big, KT, vrank));
    log(rBig.ok && tBig < 1500, 'D012 大圖只能看的城讀檔：1000×1000 空圖 viewCode（含解碼）取三次最快 < 1,500 ms（審查量到改之前約 1 秒；舊路徑不算地價：解碼約 0.1 秒、建城市模型幾毫秒）',
      rBig.ok ? `${tBig.toFixed(0)} ms` : rBig.error);
    const N = 350, bl = []; for (let p = N - 1; p >= 0; p--) bl.push([p * N + p, 9, 1, 0, 0, N]);
    const vcode = mk(N, bl), lcode = mk(N, bl, { d3: 1 });
    const [tV, rV] = best(() => viewCode(vcode, KT, vrank)), [tL, rL] = best(() => loadCode(lcode, KT, vrank));
    const sizes = rV.ok ? [...new Set(rV.city.buildings.map(b => b.size))] : [];
    log(rV.ok && rL.ok && tV < 1000 && tL < 1000 && sizes.every(s => s >= 1 && s <= 4), 'D012 手改的碼：350 座互相重疊、第 6 位寫 350 的體育場，讀檔不爆（體育場大小夾在 1–4，同 src/sim/city.ts stadiumSize）',
      `viewCode ${tV.toFixed(0)} ms、loadCode（帶 d3）${tL.toFixed(0)} ms（審查量到改之前 1,723／1,534 ms，500 座 6.5 秒）；體育場大小 ${sizes.join('、')}`);
  }
  // ---- D012 審查修的另外兩條（src/sim/restyle.ts、src/sim/replay.ts），核對卡面時發現沒有守衛，補上 ----
  // 種子城一棟會被重挑的住商工（黃金樣本：存檔的 v ≠ 讀檔之後的 v），拿它改出兩張手改的碼：
  // 4) 同一格兩筆建築：它前面插一筆同一格的公園（k 4、1×1、v 7）。城市模型留前一筆（公園）、格子留後一筆（住商工，同實驗線 load 後寫蓋前寫）：
  //    格子照樣重挑（棟數＝實驗線），城市那一棟是公園，v 不能被改、不記事件（審查：之前住宅的新變體會寫進同一格的學校）
  // 5) 它的 k 改成 2^32＋k（k|0 才是原本的 k）：重挑、重播都用 k|0，事件照記；存檔再讀接得上歷史、第二次 0 棟（審查：之前重挑算、重播不算，第二次讀檔重播失敗）
  {
    const raw0 = decodeLabCode(read('src/content/samples/seed516.code.txt').trim()).save.raw, n = raw0.n, gold = G.cities.seed516;
    const [ci, ck, , , cv1] = gold.rows.find(r => r[3] !== r[4]), cx = ci % n, cz = (ci / n) | 0;
    const reenc = raw => { const o = structuredClone(raw); delete o.z; return encodeLabCode(o, { deflate: true }); };
    const two = structuredClone(raw0);
    two.bl.splice(two.bl.findIndex(r => r[0] === ci), 0, [ci, 4, 1, 7, 0]);
    const V2 = viewCode(reenc(two), KT, vrank), L2 = loadCode(reenc(two), KT, vrank);
    const look = (r, c) => { if (!r.ok) return { err: r.error }; const b = c.buildings[c.occ[ci] - 1], ev = c.history.filter(e => e.t === 'restyle');
      return { k: b?.k, v: b?.v, restyled: r.restyled, events: ev.length, here: ev.some(e => e.x === cx && e.z === cz) }; };
    const a = look(V2, V2.city), b = L2.ok ? look(L2, L2.sim.city) : { err: L2.error }, tileV = L2.ok ? L2.sim.w.tiles[ci].bld?.v : null;
    const okTwo = [a, b].every(o => o.k === 4 && o.v === 7 && o.restyled === gold.mig && o.events === gold.mig - 1 && !o.here) && tileV === cv1;
    log(okTwo, 'D012 手改的碼：同一格兩筆建築（公園在前、會被重挑的住商工在後），格子照實驗線重挑（棟數＝實驗線），城市那一棟（公園）的 v 不動、不記事件',
      `(${cx},${cz})：只能看 ${J(a)}；有模擬 ${J(b)}、格子的 v ${tileV}（實驗線讀檔之後 ${cv1}）；實驗線重挑 ${gold.mig} 棟`);
    const big = structuredClone(raw0), bj = big.bl.findIndex(r => r[0] === ci);
    big.bl[bj] = [...big.bl[bj]]; big.bl[bj][1] = 2 ** 32 + ck;
    const B1 = loadCode(reenc(big), KT, vrank), B2 = B1.ok ? loadCode(saveCode(B1.sim, B1.template, B1.start), KT, vrank) : B1;
    const ev1 = B1.ok ? B1.sim.city.history.filter(e => e.t === 'restyle') : [];
    const okBig = B1.ok && B1.restyled === gold.mig && ev1.length === gold.mig && ev1.some(e => e.x === cx && e.z === cz && e.v === cv1)
      && B2.ok && B2.replayed === true && B2.restyled === 0;
    log(okBig, 'D012 手改的碼：k 是 2^32＋k（k|0 才是住商工），重挑與重播都用 k|0：事件照記，存檔再讀接得上歷史、第二次 0 棟',
      `(${cx},${cz}) k ${2 ** 32 + ck}：第一次重挑 ${B1.restyled ?? '—'}、restyle ${ev1.length} 筆（實驗線 ${gold.mig}）；再讀：${B2.ok ? `接上歷史 ${B2.replayed}、重挑 ${B2.restyled}${B2.replayed ? '' : '，' + B2.note}` : B2.error}`);
  }
}

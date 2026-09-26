// Node 端守衛（D003）：不開瀏覽器，直接跑模擬層與解碼器。用法：node tools/unit.mjs　退出碼 0＝綠、1＝紅
// 模擬層 import 寫明 .ts，Node 22.18+ 可以直接跑（型別剝除）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { createScanner, SyntaxKind } from 'typescript/unstable/ast';
import { ROOT } from './cdp.mjs';
import { decodeLabCode, encodeLabCode, rleEncode, rleDecode, MAX_CODE } from '../src/io/labcode.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { kindTableFrom, NO_SPRITE_HEIGHT } from '../src/content/kindTable.ts';
import { mulberry32 } from '../src/sim/rng.ts';
import { gridOf, labPartition, partRow, partitionStats, drawPlan } from '../src/content/blocks.ts';
import { recipe, labCalls, PAL_KEYS, kitCount } from '../src/content/recipes.ts';
import { dressing, PROP_CAPS, solidBoxes, inBox } from '../src/content/dressing.ts';
import { KIND_SHAPES } from '../src/content/kindShapes.ts';
import { facadePlan, trimPlan } from '../src/content/facades.ts';
import { cases as d009Cases, COUNTS as D009_COUNTS, D009_SEED, canon as d009Canon, tickIndex } from './d009-cases.mjs';
import * as d009LabHelpers from '../src/sim/rules/lab.ts';
import { labRng } from '../src/sim/rules/lab.ts';
import { legacyDemand, laborMarket481, economyDemands481, housingRciDemand488, immigration, demoMul as demographicMultiplier } from '../src/sim/rules/demand.ts';
import { spawnStep, upgradeStep } from '../src/sim/rules/growth.ts';
import { residentialHappy } from '../src/sim/rules/happy.ts';
import { residentCapacity488, residentPopulation488, rciJobs, nominalJobs } from '../src/sim/rules/jobs.ts';
import { landStaticAt, judgeWealth, pickV406 } from '../src/sim/rules/land.ts';
import { countNear, getMaxRoadClass, hasRoadNear, urbanDens406 } from '../src/sim/rules/grid.ts';
import { season as d009Season, inWinter as d009Winter, weatherStep } from '../src/sim/rules/weather.ts';
import { computePower, powerCap, assignPower } from '../src/sim/rules/power.ts';

const t0 = Date.now();
const fails = [], log = (ok, name, detail) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${detail !== undefined ? '：' + detail : ''}`); if (!ok) fails.push(name); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
console.log('\n=== 微光小鎮 3D 單元守衛（Node）===');

// ---- 內容表 ----
const data = JSON.parse(read('src/content/lab-kinds.json'));
const K = kindTableFrom(data);
const ks = data.kinds.map(r => r.k);
log(ks.length === 186 && ks.every((k, i) => k === i + 1), '內容表 186 種、編號 1–186 連續', `${ks.length} 種`);
const badRows = data.kinds.filter(r => !r.name || !data.cats[r.cat] || !(r.size >= 1 && Number.isInteger(r.size)));
log(badRows.length === 0, '每種都有名稱、分類、佔地', badRows.map(r => r.k).join(',') || '全部齊全');
const catDiff = data.kinds.filter(r => r.catStatic !== null && r.catStatic !== r.cat).map(r => r.k);
log(catDiff.length === 0, '分類：實驗線執行期 kcat345 與靜態 KCB 逐種一致', catDiff.join(',') || '0 不一致');
const noSpr = data.kinds.filter(r => !r.sprites).map(r => r.k);
log(noSpr.every(k => k in NO_SPRITE_HEIGHT), '沒有精靈的種類都有本線預設高度', noSpr.join(','));
log(/^[0-9a-f]{40}$/.test(data.source.commit) && !!data.source.version, '內容表寫明出處（實驗線 commit、版本）', `${data.source.commit.slice(0, 7)} v${data.source.version}`);
const hs = data.kinds.flatMap(r => Object.values(r.h));
log(hs.every(h => h >= 0 && h < 20), '量到的高度都在 0–20 格', `${hs.length} 個、最高 ${Math.max(...hs)}`);

// ---- 解碼對帳：兩個樣本碼 → 城市 → 對帳數字，跟實驗線執行期當場量的逐項比 ----
const diff = (a, b, p = '') => {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object') return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => diff(a[k], b[k], p + '.' + k));
  return [`${p}: 3D ${JSON.stringify(a)?.slice(0, 60)} ≠ 實驗線 ${JSON.stringify(b)?.slice(0, 60)}`];
};
for (const id of ['seed516', 'ai120']) {
  const code = read(`src/content/samples/${id}.code.txt`), meta = JSON.parse(read(`src/content/samples/${id}.json`));
  const r = decodeLabCode(code);
  if (!r.ok) { log(false, `${id} 解碼`, r.error); continue; }
  const c = cityFromLab(r.save, K, code), s = cityStats(c);
  const d = diff(s, meta.expect);
  log(d.length === 0, `${id} 對帳：地形、道路、分區、樹、高地、鐵路、各種類根格數、每棟佔地`, d.length ? d.slice(0, 4).join('；') : `建築 ${s.buildings}、${Object.keys(s.kinds).length} 種、${s.roots.length} 筆逐棟全對`);
  log(c.issues.overlap === 0 && c.issues.outOfMap === 0 && c.issues.unknownKinds.length === 0, `${id} 沒有重疊、出界、未知種類`, JSON.stringify(c.issues));
  log(meta.roundTripSameAsBefore === true, `${id} 樣本碼經實驗線自己的匯入讀回，與匯出前相同`);
  const ev = c.history[0];
  log(c.history.length === 1 && ev.t === 'import' && ev.gameVer === r.save.gameVer && ev.codeHash.length === 8 && ev.day === r.save.day, `${id} 匯入記成世界歷史第一筆事件`, JSON.stringify(ev));
}

// ---- RLE 與實驗線 rleEnc 等價：1,000 條隨機字串往返 ----
{
  const R = mulberry32(20260925), alpha = '0123456789:;<=>?AB';
  let bad = 0;
  for (let t = 0; t < 1000; t++) {
    let s = '';
    const len = Math.floor(R() * 400);
    while (s.length < len) { const ch = alpha[Math.floor(R() * alpha.length)]; s += ch.repeat(1 + Math.floor(R() ** 3 * 40)); }
    if (rleDecode(rleEncode(s)) !== s) bad++;
  }
  log(bad === 0 && rleEncode('0000011') === '*5,011' && rleEncode('000') === '000', 'RLE 往返 1,000 條 0 錯；格式與實驗線相同（*n,c，連續 >3 才壓）', `錯 ${bad}`);
}

// ---- 壞碼：不崩、講得出原因 ----
{
  const good = read('src/content/samples/ai120.code.txt');
  const raw = JSON.parse(Buffer.from(good, 'base64').toString('utf8'));
  const enc = o => encodeLabCode(o);
  const cases = [
    ['空字串', ''],
    ['非 base64', '這不是分享碼!!'],
    ['base64 但不是 JSON', Buffer.from('hello').toString('base64')],
    ['截斷', good.slice(0, 1200)],
    ['v=2', enc({ ...raw, v: 2 })],
    ['圖層長度不符', enc({ ...raw, z: undefined, ter: '2'.repeat(100) })],
    ['超過 2,000,000 字元', 'A'.repeat(MAX_CODE + 4)],
    ['建築出界', enc({ ...raw, z: undefined, ter: '2'.repeat(72 * 72), bl: [[72 * 72 + 5, 1, 1, 0, 0]] })],
    ['RLE 截斷', enc({ v: 1, n: 72, z: 1, ter: '*5,' })],
    ['RLE 惡意展開', enc({ v: 1, n: 72, z: 1, ter: '*99999999,2' })],
  ];
  const res = cases.map(([name, code]) => { try { const r = decodeLabCode(code); return [name, r.ok ? '竟然成功' : r.error]; } catch (e) { return [name, '丟例外：' + e.message]; } });
  const bad = res.filter(([, m]) => m === '竟然成功' || m.startsWith('丟例外'));
  log(bad.length === 0, `壞碼 ${cases.length} 種都回傳原因、沒有例外`, bad.length ? bad.map(x => x.join('→')).join('；') : res.map(x => x[0]).join('、'));
  const pref = decodeLabCode('GVX1:' + good);
  log(pref.ok, '帶 GVX1: 前綴的碼也能解');
}

// ---- 非 72 的地圖（108）與未知種類 ----
{
  const n = 108, nn = n * n, ter = ('2'.repeat(n * 30) + '0'.repeat(n * 10)).padEnd(nn, '2');
  const bl = [[50 * n + 50, 1, 2, 3, 10], [5 * n + 5, 9, 1, 0, 5, 2], [20 * n + 20, 139, 1, 0, 3], [70 * n + 70, 999, 1, 0, 1]];
  const code = encodeLabCode({ v: 1, n, gameVer: 'test', seed: 1, day: 100, money: 0, nm: '測試城', ter, tre: '0'.repeat(nn), rd: '0'.repeat(nn), zn: '0'.repeat(nn), bl }, { deflate: true, prefix: true });
  const r = decodeLabCode(code);
  const c = r.ok ? cityFromLab(r.save, K, code) : null;
  const sizes = c ? c.buildings.map(b => b.size).join(',') : '';
  log(!!c && c.n === 108 && sizes === '1,2,5,1' && c.issues.unknownKinds.join() === '999', '108×108 能匯入；體育場 2×2、高鐵站 5×5；未知種類 999 照樣匯入並計數', r.ok ? `n=${c.n}、佔地 ${sizes}、未知 ${c.issues.unknownKinds}` : r.error);
}

// ===== D004：原型表、超街區切分、量體，跟實驗線逐項對拍（CLAUDE.md 規則 8）=====
const arche = JSON.parse(read('src/content/lab-arche.json'));
{
  const A = arche.arche, n = Object.values(A).flat().length;
  log(arche.source.runtimeDeepEqual === true && arche.source.commit === data.source.commit && Object.keys(A).length === 9 && n === 44,
    'D004 原型表：抽自實驗線 ARCHE568，靜態字面量＝執行期（抽取時深度比對）、出處與內容表同一個 commit', `${Object.keys(A).length} 組、${n} 個原型、${arche.source.commit.slice(0, 7)}`);
}
const partGold = {}, cities = {};
for (const id of ['seed516', 'ai120']) {
  const code = read(`src/content/samples/${id}.code.txt`);
  cities[id] = cityFromLab(decodeLabCode(code).save, K, code);
  partGold[id] = JSON.parse(read(`src/content/samples/d004-partition-${id}.json`));
}
// 逐格比切分：回傳差幾格（兩座城合計）與前幾筆
const partDiff = (faults = {}) => {
  const out = [];
  for (const id of ['seed516', 'ai120']) {
    const g = new Map(partGold[id].cells.map(r => [r[0], JSON.stringify(r)]));
    const mine = labPartition(gridOf(cities[id]), arche.arche, faults).map(partRow);
    if (mine.length !== g.size) out.push(`${id} 住商工格數 ${mine.length}≠${g.size}`);
    for (const r of mine) if (g.get(r[0]) !== JSON.stringify(r)) out.push(`${id} 格 ${r[0]}：3D ${JSON.stringify(r.slice(1))} ≠ 實驗線 ${g.get(r[0])}`);
  }
  return out;
};
// B 檔畫的街區（起點、寬高、k、繪製用 lv／v）要等於實驗線畫的：起點且（多格或沒被吸收），lv／v 取起點那格（61581）
const drawDiff = (faults = {}) => {
  const out = [];
  for (const id of ['seed516', 'ai120']) {
    const n = partGold[id].n, want = partGold[id].cells.filter(r => r[1] && (r[2] * r[3] > 1 || !r[9])).map(r => [r[0] % n, (r[0] / n) | 0, r[2], r[3], r[4], r[7], r[8]]);
    const got = drawPlan(gridOf(cities[id]), arche.arche, 'b', faults).map(b => [b.x, b.z, b.w, b.h, b.k, b.lv, b.v]);
    const W = new Set(want.map(r => r.join())), G = new Set(got.map(r => r.join()));
    for (const r of W) if (!G.has(r)) out.push(`${id} 少畫 ${r}`);
    for (const r of G) if (!W.has(r)) out.push(`${id} 多畫 ${r}`);
  }
  return out;
};
{
  const d = partDiff();
  log(d.length === 0, 'D004 切分對拍：兩座樣本城逐格（起點、寬、高、k、lv、v、起點那格 lv／v、是否被吸收）＝實驗線 rciBlockOrigin547＋rciAbsorbed555', d.length ? `${d.length} 格不同：${d.slice(0, 3).join('；')}` : '0 差異');
  for (const id of ['seed516', 'ai120']) {
    const s = partitionStats(labPartition(gridOf(cities[id]), arche.arche), cities[id].n), g = partGold[id].stats;
    log(JSON.stringify(s) === JSON.stringify(g) && s.overlap === 0, `D004 ${id} 切分統計＝實驗線、重疊 0`,
      `街區 ${s.blocks}（多格 ${s.multi}）；住商工 ${s.rci} 格＝多格 ${s.cells.inMulti}＋單格 ${s.cells.single}＋吸收 ${s.cells.absorbed}＋D0 ${s.cells.d0}；重疊 ${s.overlap}`
      + (JSON.stringify(s) === JSON.stringify(g) ? '' : `；實驗線 ${JSON.stringify(g)}`));
  }
  const dd = drawDiff();
  log(dd.length === 0, 'D004 B 檔要畫的街區＝實驗線畫的（起點、寬高、k、起點那格的 lv／v）', dd.length ? `${dd.length} 筆：${dd.slice(0, 3).join('；')}` : '0 差異');
  // A、C 兩檔：每一格住商工剛好屬於一個街區，沒有空格也沒有重疊；A 全是 1×1
  for (const id of ['seed516', 'ai120']) {
    const c = cities[id], grid = gridOf(c), rci = labPartition(grid, arche.arche).length;
    for (const mode of ['a', 'c']) {
      const plan = drawPlan(grid, arche.arche, mode), cnt = new Map();
      for (const b of plan) for (const i of b.cells) cnt.set(i, (cnt.get(i) || 0) + 1);
      const over = [...cnt.values()].filter(v => v > 1).length, ok = cnt.size === rci && over === 0 && (mode !== 'a' || plan.every(b => b.w * b.h === 1));
      log(ok, `D004 ${id} ${mode.toUpperCase()} 檔：住商工 ${rci} 格每格剛好屬於一個街區`, `街區 ${plan.length}、蓋到 ${cnt.size} 格、重疊 ${over}` + (mode === 'c' ? `、補切 ${plan.filter(b => b.from === 'fill').length}` : ''));
    }
  }
}
// 量體：1,728 組逐項比
const massGold = JSON.parse(read('src/content/samples/d004-massing.json'));
const MASS_FIELDS = ['原型名', '路徑', '坡頂旗標', '牆高', '主體與第二量體的框', '第二量體高', '鋸齒', '內縮（女兒牆、上層量體）', '一戶一尖', '調色盤', '屋頂設備 area（D005）', 'sty565（D008）'];
const massDiff = (faults = {}) => {
  const out = [];
  for (const r of massGold.rows) {
    const [k, lv, bw, bh, v] = r[0].split('_').map(Number), q = recipe(arche.arche, k, lv, bw, bh, v, faults), L = labCalls(q);
    const mine = [q.arche, q.path, q.pitch, q.wallPx, L.sub, L.mass, L.saw, L.shr, L.pp, PAL_KEYS.map(p => q.pal[p]), L.kit, q.sty];
    const bad = mine.map((m, j) => JSON.stringify(m) === JSON.stringify(r[j + 1]) ? null : `${MASS_FIELDS[j]} 3D ${JSON.stringify(m)} ≠ 實驗線 ${JSON.stringify(r[j + 1])}`).filter(Boolean);
    if (bad.length) out.push(`${r[0]}：${bad.join('；')}`);
  }
  return out;
};
{
  const d = massDiff(), paths = massGold.byPath;
  log(massGold.rows.length === 1728 && massGold.source.commit === data.source.commit && d.length === 0,
    'D004 量體對拍：1,728 組（k1–3 × lv1–3 × 寬 1–4 × 高 1–4 × v0–11）原型、路徑、坡頂、牆高、框（位元相等）、第二量體、屋頂分支、七色、屋頂設備 area（D005）、sty565（D008）＝實驗線',
    d.length ? `${d.length} 組不同：${d.slice(0, 2).join('｜')}` : `0 差異；路徑 ${Object.entries(paths).map(([p, n]) => `${p} ${n}`).join('、')}`);
}
// 守衛有效：注入錯誤，對應的守衛要變紅（卡面驗收 4）
{
  const inj = [
    ['聯排進深 1→2', () => partDiff({ terraceDeep1: 2 })],
    ['拿掉「villa 不併」', () => partDiff({ noVillaRule: true })],
    ['拿掉掃描序認領', () => partDiff({ noScanClaim: true })],
    ['T582 門檻 6→7', () => massDiff({ parcelMin: 7 })],
    ['T582 門檻 6→4', () => massDiff({ parcelMin: 4 })],
    ['T602 裙樓上限 0.40→0.45', () => massDiff({ podiumCap: .45 })],
    ['繪製改用街區的 maxLv', () => drawDiff({ drawMaxLv: true })],
    ['D005 平頂屋頂設備係數 0.8→0.9', () => massDiff({ flatKit: .9 })],
    ['D005 工業 ≥4 格屋頂設備係數 0.6→0.5', () => massDiff({ indKit: .5 })],
    ['D008 sty565 改用 (v＋k) mod 3', () => massDiff({ styNoBw: true })],
  ].map(([name, f]) => [name, f().length]);
  log(inj.every(([, n]) => n > 0), `D004 注入 ${inj.length} 種錯誤，對應守衛都變紅`, inj.map(([name, n]) => `${name}→${n} 筆差異`).join('、'));
  // 卡面原本寫的「T582 門檻 6→5」是等價突變：街區寬高都在 1–4（blockMax602），面積只有 1,2,3,4,6,8,9,12,16，沒有 5；
  // 所以 ≥5 跟 ≥6 在實驗線、在本線都分不出來，守衛不可能變紅。這裡改成斷言「它確實等價」，另用 6→7、6→4 驗守衛（D004 施工紀錄）
  const areas = new Set(); for (let w = 1; w <= 4; w++) for (let h = 1; h <= 4; h++) areas.add(w * h);
  log(!areas.has(5) && massDiff({ parcelMin: 5 }).length === 0, 'D004「T582 門檻 6→5」是等價突變（面積沒有 5），改用 6→7、6→4 驗', `面積 ${[...areas].sort((a, b) => a - b).join(',')}`);
}

// ===== D005：街區點綴的擺放計畫（1,728 組配方全跑）=====
{
  const bad = [], tot = { props: 0, edges: 0, kits: 0, awnings: 0, doors: 0, docks: 0 };
  for (const r0 of massGold.rows) {
    const [k, lv, bw, bh, v] = r0[0].split('_').map(Number), r = recipe(arche.arche, k, lv, bw, bh, v), d = dressing(r), d2 = dressing(r);
    const core = r.path === 'core', nBay = Math.max(2, Math.min(8, Math.max(bw, bh))), why = [];
    if (JSON.stringify(d) !== JSON.stringify(d2)) why.push('同一組配方兩次擺得不一樣');
    for (const p of d.props) {
      if (!(p.u >= 0 && p.u <= 1 && p.v >= 0 && p.v <= 1)) why.push(`道具 ${p.kind} 出了地界 (${p.u.toFixed(2)},${p.v.toFixed(2)})`);
      if (!r.villa && solidBoxes(r).some(b => inBox(b, p.u, p.v))) why.push(`道具 ${p.kind} 插進量體`);
    }
    if (r.villa) { if (d.props.length !== 6 || d.edges.length !== 4) why.push(`villa 道具 ${d.props.length}／圍籬 ${d.edges.length}（應為 6／4）`); }
    else for (const [kind, cap] of PROP_CAPS[k]) { const c = d.props.filter(p => p.kind === kind).length; if (c > cap) why.push(`${kind} ${c} 件超過上限 ${cap}`); }
    if (!r.lotFill && !r.villa && d.props.length) why.push('原型佔滿地界卻放了前庭道具');
    const kitWant = r.kits.reduce((a, q) => a + kitCount(q.area), 0);
    if (d.kits.length !== kitWant) why.push(`屋頂設備 ${d.kits.length}≠${kitWant}`);
    if (d.kits.some(q => q.u < .18 || q.u > .82 || q.v < .18 || q.v > .82)) why.push('屋頂設備落在屋頂 18%–82% 之外');
    if (d.awnings.length !== (core && k === 2 ? nBay : 0)) why.push(`雨遮 ${d.awnings.length}`);
    if (d.doors.length !== (core && k === 1 ? nBay : 0)) why.push(`門 ${d.doors.length}`);
    if ((d.dock !== null) !== (core && k === 3)) why.push('裝卸口');
    if (why.length) bad.push(`${r0[0]}：${why.join('、')}`);
    tot.props += d.props.length; tot.edges += d.edges.length; tot.kits += d.kits.length; tot.awnings += d.awnings.length; tot.doors += d.doors.length; tot.docks += d.dock === null ? 0 : 1;
  }
  log(bad.length === 0, 'D005 點綴擺放計畫：1,728 組都在地界內、不插進量體、件數照實驗線的上限與公式、同一組配方擺法固定',
    bad.length ? `${bad.length} 組不對：${bad.slice(0, 2).join('｜')}` : Object.entries(tot).map(([a, b]) => `${a} ${b}`).join('、'));
}

// ===== D008：英美立面逐戶計畫、核心飾條（1,728 組配方全跑）=====
{
  const bad = [], tot = { facade: 0, units: 0, rows: 0, parts: 0, trim: 0, rings: 0 }, byPath = {}, EPS = 1e-9;
  const FRONT = new Set(['bay', 'bay2', 'porch', 'stoop', 'pier', 'escape', 'canopy', 'sign']);   // 貼正面的小件
  for (const r0 of massGold.rows) {
    const [k, lv, bw, bh, v] = r0[0].split('_').map(Number), r = recipe(arche.arche, k, lv, bw, bh, v), f = facadePlan(r), t = trimPlan(r), why = [];
    if (JSON.stringify(f) !== JSON.stringify(facadePlan(r)) || JSON.stringify(t) !== JSON.stringify(trimPlan(r))) why.push('同一組配方兩次不一樣');
    if ((f === null) !== (r.path === 'core')) why.push(`路徑 ${r.path} 立面計畫 ${f ? '有' : '無'}`);
    if ((t === null) !== (r.trim === null) || (t && t.kind !== r.trim)) why.push(`飾條 ${r.trim}→${t && t.kind}`);
    if (f) {
      const U = f.units, lot = u => r.box[0] + u * (r.box[1] - r.box[0]);   // 主體框分數 → 地界分數
      if (U.length < 1) why.push('戶數 0');
      if (Math.abs(U[0].u0) > EPS || Math.abs(U[U.length - 1].u1 - 1) > EPS) why.push(`戶沒從 0 蓋到 1（${U[0].u0}–${U[U.length - 1].u1}）`);
      let gaps = 0;
      U.forEach((u, i) => {
        if (!(u.u1 - u.u0 > EPS)) why.push(`第 ${i} 戶寬 ≤0`);
        if (i) { const d = u.u0 - U[i - 1].u1; if (Math.abs(d) <= EPS) return; if (f.gap > 0 && Math.abs(d - f.gap) <= EPS) { gaps++; return; } why.push(`第 ${i - 1}、${i} 戶${d < 0 ? '重疊' : '中間空'} ${d.toFixed(4)}`); }
      });
      const cover = U.reduce((a, u) => a + u.u1 - u.u0, 0) + gaps * f.gap;
      if (Math.abs(cover - 1) > 1e-6) why.push(`戶＋車道縫合計 ${cover.toFixed(6)}≠1`);
      if (f.rows.length < 1 || Math.abs(f.rows[0].v0) > EPS || Math.abs(f.rows[f.rows.length - 1].v1 - 1) > EPS || f.rows.some((q, i) => i && Math.abs(q.v0 - f.rows[i - 1].v1) > EPS)) why.push('排沒有剛好蓋滿深度');
      if ((f.roof === 'gable' || f.roof === 'hip-pairs') && f.rows.some(q => q.risePx <= 0)) why.push('坡頂的坡高 ≤0');
      for (const q of f.parts) {
        if (!(lot(q.u - q.w / 2) >= -EPS && lot(q.u + q.w / 2) <= 1 + EPS && q.w > 0)) why.push(`${q.kind} 出了地界（u ${q.u.toFixed(3)} 寬 ${q.w.toFixed(3)}）`);
        if (!U.some(u => q.u >= u.u0 - EPS && q.u <= u.u1 + EPS)) why.push(`${q.kind} 落在車道縫裡`);
        if (q.row !== undefined && !(q.row >= 0 && q.row < f.rows.length)) why.push(`${q.kind} 排號 ${q.row}`);
        if (FRONT.has(q.kind) && q.row !== undefined) why.push(`${q.kind} 是正面小件卻掛在屋脊上`);
      }
      tot.facade++; tot.units += U.length; tot.rows += f.rows.length; tot.parts += f.parts.length;
      byPath[r.path] = (byPath[r.path] || 0) + 1;
    }
    if (t) {
      tot.trim++; tot.rings += t.rings.length;
      const want = t.kind === 'modern' ? ['lobby', 'coping'] : ['base', ...(r.wallPx > 14 ? ['belt'] : []), 'cornice', 'quoin'];
      if (t.rings.map(q => q.ring).join() !== want.join()) why.push(`飾條圈 ${t.rings.map(q => q.ring).join()}（應為 ${want.join()}）`);
      if (t.rings.some(q => !/^#[0-9a-f]{6}$/.test(q.color))) why.push('飾條色不是 #rrggbb');
    }
    if (why.length) bad.push(`${r0[0]}：${why.join('、')}`);
  }
  log(bad.length === 0 && tot.facade > 0 && tot.trim > 0, 'D008 立面逐戶計畫與飾條：1,728 組立面路徑都有計畫、戶 ≥1、戶與戶不重疊且加上車道縫剛好蓋滿正面、排蓋滿深度、小件不出地界不落在縫裡、飾條圈照選法、同一組配方固定',
    bad.length ? `${bad.length} 組不對：${bad.slice(0, 2).join('｜')}` : `${Object.entries(tot).map(([a, b]) => `${a} ${b}`).join('、')}；${Object.entries(byPath).map(([a, b]) => `${a} ${b}`).join('、')}`);
}

// ===== D007：非住商工的顏色、全種類樣張城、造型表 =====
{
  const LK = JSON.parse(read('src/content/lab-looks.json')), hex = c => c === null || /^#[0-9a-f]{6}$/.test(c);
  const withSpr = data.kinds.filter(r => r.k > 3 && r.sprites), miss = withSpr.filter(r => !LK.looks[`${r.k}_1`]).map(r => r.k);
  const badHex = Object.entries(LK.looks).filter(([, l]) => ![l.plate, l.roof, l.wallL, l.wallR, l.accent].every(hex)).map(([k]) => k);
  log(LK.source.commit === data.source.commit && miss.length === 0 && badHex.length === 0,
    'D007 顏色：有精靈的非住商工每一種都有實驗線讀出的五色、格式正確、出處同一個 commit', `${withSpr.length} 種；缺 ${miss.join(',') || 0}；格式錯 ${badHex.join(',') || 0}`);
  const G = JSON.parse(read('src/content/samples/gallery.json')), gcode = read('src/content/samples/gallery.code.txt'), gr = decodeLabCode(gcode);
  const gc = gr.ok ? cityFromLab(gr.save, K, gcode) : null, gs = gc ? cityStats(gc) : null;
  const ks = G.place.map(p => p.k).sort((a, b) => a - b), all = data.kinds.filter(r => r.k > 3).map(r => r.k);
  log(!!gc && G.sameAsThisLine === true && JSON.stringify(gs) === JSON.stringify(G.expect) && JSON.stringify(ks) === JSON.stringify(all)
    && gc.issues.overlap === 0 && gc.issues.outOfMap === 0 && gc.issues.unknownKinds.length === 0,
    'D007 全種類樣張城：183 種各一棟、沒有重疊出界；實驗線匯入讀回的對帳數字＝本線解碼', gc ? `${gc.buildings.length} 棟、${new Set(ks).size} 種` : '解不開');
  const { BUILDER_TYPES, LANDMARK_KINDS } = await import('../src/render/kindArt.ts');
  const RIDES = ['ferris', 'carousel', 'balloon', 'coaster', 'waterpark', 'dolphin', 'zoo', 'aquarium'];
  const noShape = all.filter(k => !KIND_SHAPES[k]), badType = all.filter(k => KIND_SHAPES[k] && !BUILDER_TYPES.includes(KIND_SHAPES[k].type));
  const badWhich = all.filter(k => { const s = KIND_SHAPES[k]; return s && ((s.type === 'landmark' && !LANDMARK_KINDS.includes(String(s.p?.which))) || (s.type === 'ride' && !RIDES.includes(String(s.p?.which)))); });
  log(noShape.length + badType.length + badWhich.length === 0, 'D007 造型表：183 種都有造型、類型都有畫法（沒有落到預設盒子）',
    `${new Set(all.map(k => KIND_SHAPES[k]?.type)).size} 種類型、${all.filter(k => KIND_SHAPES[k]?.type === 'landmark').length} 個地標；缺 ${noShape.join(',') || 0}、類型錯 ${badType.join(',') || 0}、地標／遊樂錯 ${badWhich.join(',') || 0}`);
}

// ===== D009：實驗線原始碼求值的完整輸出（canon 保留 Object.is 的 -0／NaN／undefined）=====
const D009_LAB_COMMIT = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const d009Gold = JSON.parse(read('src/content/samples/d009-formulas.json'));
const d009Live = JSON.parse(read('src/content/samples/d009-live.json'));
const d009Fns = {
  legacyDemand, laborMarket481, economyDemands481, housingRciDemand488, immigration, demographicMultiplier,
  spawnStep, upgradeStep, residentialHappy, residentCapacity488, residentPopulation488, rciJobs, nominalJobs,
  landStaticAt, judgeWealth, pickV406, countNear, getMaxRoadClass, hasRoadNear, urbanDens406,
  d009Season, d009Winter, weatherStep, computePower, powerCap, assignPower,
};
const d009Buildings = (w, keys) => w.tiles.map(t => t.bld ? keys.map(k => t.bld[k]) : null);
function d009Result(name, c, f = d009Fns) {
  if (name === 'F1') {
    const q = f.legacyDemand(c);
    return [q.workers, q.jobSurplus, q.happyAdj, q.legacyR481, q.czone, q.legacyC481, q.legacyI481];
  }
  if (name === 'F2') return f.laborMarket481(c.p, c.j, c.ent, c.day);
  if (name === 'F3') {
    const q = f.economyDemands481(c.lr, c.lc, c.li, c.labor, c.econ);
    return [q.r, q.c, q.i];
  }
  if (name === 'F4') {
    const wave = f.immigration(c.immWave, c.pop, c.day, c.cityHappy, c.demR).immWave;
    return [f.housingRciDemand488(c.legacy, c.housing), wave, f.demographicMultiplier(c.cityHappy, wave, c.mob === null ? 0 : c.mob)];
  }
  if (name === 'F5' || name === 'F6') {
    const { tickBld, tickZone } = tickIndex(c.w), rng = labRng(c.seed, true);
    const g = { w: c.w, f: c.w.fields, vrank: d009Live.vrank, rng, dem: c.dem, cityHappy: c.cityHappy, demoMul: c.demoMul,
      tech: c.tech || [], tickZone, tickBld, sewNeed: c.sewNeed, sewOk: c.sewOk };
    if (name === 'F5') {
      const { cands } = f.spawnStep(g);
      return { cands, tickBld, blds: d009Buildings(c.w, ['k', 'lv', 'v', 'age', 'pw', 'h', 'den', 'we']), log: rng.log };
    }
    f.upgradeStep(g);
    return { blds: d009Buildings(c.w, ['k', 'lv', 'v', 'age', 'den', 'we']), log: rng.log };
  }
  if (name === 'F7') {
    const q = f.residentialHappy(c);
    return [q.h, q.parts];
  }
  if (name === 'F8') {
    const jobs = c.b && c.b.lv ? f.rciJobs(c.b, c.office) : null;
    return [f.residentCapacity488(c.b), f.residentPopulation488(c.b, band => c.occ?.[band]),
      jobs === null ? null : c.b.k === 2 ? [jobs, 0] : [0, jobs], f.nominalJobs(c.counts)];
  }
  if (name === 'F9') {
    const { w } = c, N = w.N, out = [];
    for (let i = 0; i < N * N; i++) {
      const x = i % N, y = (i / N) | 0, [pk, plv, pfb] = c.picks[i % c.picks.length];
      out.push([f.landStaticAt(w, w.fields, x, y), f.judgeWealth(w, w.fields, x, y), f.getMaxRoadClass(w, x, y), f.getMaxRoadClass(w, x, y, 3),
        f.hasRoadNear(w, x, y, 2), f.hasRoadNear(w, x, y, 2, true), f.hasRoadNear(w, x, y, 2, true, true), f.hasRoadNear(w, x, y, 2, false, true),
        f.urbanDens406(w, x, y), f.pickV406(w, w.fields, d009Live.vrank, pk, plv, x, y, pfb),
        f.countNear(w, x, y, 4, tt => tt.bld && tt.bld.k <= 3 && tt.bld.crime)]);
    }
    return out;
  }
  if (name === 'F10') {
    const rng = labRng(c.seed, true), out = [];
    let s = { weather: c.weather, wxT: c.wxT };
    for (let d = 0; d < c.days; d++) {
      const day = c.day0 + d, v = f.weatherStep(s, day, rng);
      out.push([v.weather, v.wxT, v.rainbow, v.lightning, f.d009Season(day), f.d009Winter(day)]);
      s = v;
    }
    return { o: out, log: rng.log };
  }
  if (name === 'F11') {
    const { w } = c, p = f.computePower(w, c.ecoReg, c.legacySubstation), cap = f.powerCap(p.cap, c.season), { tickBld } = tickIndex(w);
    const powered = f.assignPower(w, tickBld, cap);
    return { nom: p.cap, cap, rp: w.tiles.flatMap((t, i) => t.rp ? [i] : []), pw: tickBld.map(i => w.tiles[i].bld.pw), powered };
  }
  throw new Error(`未知 D009 公式 ${name}`);
}
const d009Exact = {};
let d009MetaOk = d009Gold.seed === D009_SEED && d009Gold.source.commit === D009_LAB_COMMIT && d009Live.source.commit === D009_LAB_COMMIT
  && Array.isArray(d009Gold.source.pieces)
  && d009Gold.source.pieces.length >= 20 && d009Gold.source.pieces.every(p => p.name && p.line > 0 && /^[0-9a-f]{64}$/.test(p.sha)
    && typeof p.anchors?.start === 'string' && p.anchors.start.length > 0
    && (p.kind !== 'span' || typeof p.anchors.end === 'string' && p.anchors.end.length > 0)
    && (p.kind !== 'fn' || p.anchors.closure === 'balanced-brace'))
  && d009Gold.source.casesSha256 === crypto.createHash('sha256').update(read('tools/d009-cases.mjs')).digest('hex')
  && d009Gold.exact?.codec === 'gzip+base64+json-canon-array';
for (const [name, count] of Object.entries(D009_COUNTS)) {
  d009MetaOk &&= d009Gold.counts[name] === count && count >= (['F5', 'F9', 'F11'].includes(name) ? 200 : 2000);
  const packed = d009Gold.exact?.outputs?.[name];
  try { d009Exact[name] = JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString('utf8')); }
  catch { d009Exact[name] = []; }
  d009MetaOk &&= d009Exact[name].length === count;
}
log(d009MetaOk, 'D009 黃金樣本：實驗線 commit、原碼錨點與雜湊、案例數、完整 canonical 輸出',
  `${d009Gold.source.commit?.slice(0, 7)}；${d009Gold.source.pieces?.length} 段；${Object.entries(d009Gold.counts).map(([k, v]) => `${k} ${v}`).join('、')}`);
const d009Mismatches = {};
for (const [name, count] of Object.entries(D009_COUNTS)) {
  const bad = [], want = d009Exact[name];
  for (let k = 0; k < count; k++) {
    try {
      const observed = d009Canon(d009Result(name, d009Cases[name](k)));
      const expected = want[k];
      if (observed !== expected) bad.push(`${k}: ${observed.slice(0, 100)} ≠ ${String(expected).slice(0, 100)}`);
    } catch (e) { bad.push(`${k}: ${e.stack || e}`); }
  }
  d009Mismatches[name] = bad;
  log(bad.length === 0 && want.length === count, `D009 ${name} 逐案例完整輸出與實驗線 Object.is 等價${['F5', 'F6', 'F10'].includes(name) ? '（含 R／ri 呼叫序列）' : ''}`,
    bad.length ? `${bad.length}/${count} 差異：${bad.slice(0, 2).join('｜')}` : `${count} 組相等`);
}
{
  const golden = d009Gold.exact?.mulberry32, seeds = [1, 516, 2026, 0xdeadbeef], bad = [];
  let want = [];
  try { want = JSON.parse(gunzipSync(Buffer.from(golden.values, 'base64')).toString('utf8')); } catch { /* 缺樣本會紅燈 */ }
  for (let si = 0; si < seeds.length; si++) {
    const r = mulberry32(seeds[si]);
    for (let i = 0; i < 10000; i++) if (d009Canon(r()) !== want[si]?.[i]) { bad.push(`${si}:${i}`); break; }
  }
  log(d009Canon(golden?.seeds) === d009Canon(seeds) && golden?.countPerSeed === 10000 && want.length === 4 && bad.length === 0,
    'D009 mulberry32 四種種子各前 10,000 個值逐個 Object.is 等價', bad.join('、') || `種子 ${seeds.join(',')}`);
}
{
  const layouts = d009Live.power.layouts, bad = [];
  let liveOn = 0, liveOff = 0, liveWithCapacity = 0;
  for (let n = 0; n < layouts.length; n++) {
    const a = layouts[n], w = { N: a.N, tiles: Array.from({ length: a.N * a.N }, () => ({ bld: null })) };
    for (const i of a.roads) w.tiles[i].road = 1;
    for (const i of a.hw) w.tiles[i].hw = 1;
    for (const i of a.lv475) w.tiles[i].lv475 = 1;
    for (const i of a.ud475) w.tiles[i].ud475 = 1;
    for (const [i, k, lv, sz, ref] of a.blds) w.tiles[i].bld = { k, lv, ...(sz ? { sz } : {}), ...(ref ? { ref: [0, 0] } : {}) };
    const localOrder = tickIndex(w).tickBld;
    if (!Array.isArray(a.order) || d009Canon(a.order) !== d009Canon(localOrder) || d009Canon(a.order) !== d009Canon(a.blds.map(row => row[0]))
      || d009Canon(a.order) !== d009Canon([...a.order].sort((x, y) => x - y))) bad.push(`${n}: 建築掃描順序與實驗線不一致`);
    if (!Number.isInteger(a.dayBefore) || !Number.isInteger(a.dayAfter) || a.dayAfter !== a.dayBefore + 1
      || a.topologyUnchanged !== true || a.capBefore !== a.cap) bad.push(`${n}: tick 前後天數／拓樸／名目容量存證不一致`);
    if (a.cap > 0) liveWithCapacity++;
    const p = computePower(w), rp = w.tiles.flatMap((t, i) => t.rp ? [i] : []);
    if (p.cap !== a.cap || d009Canon(rp) !== d009Canon(a.rp)) bad.push(`${n}: cap ${p.cap}/${a.cap}, rp ${rp.length}/${a.rp.length}`);
    if (!Number.isInteger(a.season) || a.season < 0 || a.season > 3 || !Array.isArray(a.rci) || a.rci.length < 1) { bad.push(`${n}: 缺實跑 RCI pw／季節`); continue; }
    assignPower(w, localOrder, powerCap(p.cap, a.season));
    for (const [i, pw] of a.rci) {
      if (!localOrder.includes(i) || ![0, 1].includes(pw)) bad.push(`${n}: 住宅 ${i} 的索引／pw 樣本無效`);
      if (pw) liveOn++; else liveOff++;
      if (Number(!!w.tiles[i]?.bld?.pw) !== pw) bad.push(`${n}: 建築 ${i} pw ${Number(!!w.tiles[i]?.bld?.pw)}/${pw}`);
    }
  }
  log(layouts.length === 24 && liveWithCapacity >= 20 && liveOn > 0 && liveOff > 0 && bad.length === 0,
    'D009 實驗線 GV.place／tick 實跑供電：容量、逐格帶電路與住宅通電相等；前後拓樸、時間、掃描順序存證一致',
    bad.length ? bad.slice(0, 8).join('；') : `${layouts.length} 張（有容量 ${liveWithCapacity}）、${layouts.reduce((n, a) => n + a.rp.length, 0)} 個帶電道路格、住宅有電 ${liveOn}／沒電 ${liveOff}`);
}
// 真正改一個原始碼常數／比較符號，再用同一份黃金樣本對拍；每條公式的守衛都必須轉紅。
{
  const mutants = [
    ['F1', 'demand.ts', 'legacyDemand', 'jobSurplus * .7 + happyAdj * .3', 'jobSurplus * .8 + happyAdj * .3'],
    ['F2', 'demand.ts', 'laborMarket481', 'Math.round(p * .60)', 'Math.round(p * .61)'],
    ['F3', 'demand.ts', 'economyDemands481', 'legacyC * .18 + ppSig * .34', 'legacyC * .19 + ppSig * .34'],
    ['F4', 'demand.ts', 'housingRciDemand488', 'legacy * .42 + housing.aggregateDemand * .58', 'legacy * .43 + housing.aggregateDemand * .58'],
    ['F5', 'growth.ts', 'spawnStep', '.10 * (1 + dem[z] * .6 * hf)', '.11 * (1 + dem[z] * .6 * hf)'],
    ['F6', 'growth.ts', 'upgradeStep', 'b.age > 14 && dem[b.k]', 'b.age > 13 && dem[b.k]'],
    ['F7', 'happy.ts', 'residentialHappy', '    .62,', '    .63,'],
    ['F8', 'jobs.ts', 'residentCapacity488', 'SOCIAL_HOUSING_POP = 76', 'SOCIAL_HOUSING_POP = 77'],
    ['F9', 'land.ts', 'landStaticAt', '128 + svc * 8 + land * 8', '129 + svc * 8 + land * 8'],
    ['F10', 'weather.ts', 'weatherStep', 'rng.R() < .12', 'rng.R() < .22'],
    ['F11', 'power.ts', 'computePower', 'POWER_HOPS444 = 90', 'POWER_HOPS444 = 89'],
    ['F11', 'power.ts', 'computePower', 'seedAround(si, POWER_HOPS444)', 'seedAround(si, 0)'],
  ];
  const detected = [], missed = [];
  for (const [name, file, fn, from, to] of mutants) {
    try {
      const source = read(`src/sim/rules/${file}`);
      if (source.split(from).length !== 2) throw new Error(`突變錨點不是唯一：${from}`);
      let js = stripTypeScriptTypes(source.replace(from, to));
      js = js.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
      const ctx = vm.createContext({ ...d009LabHelpers, ...d009Fns, season: d009Season, inWinter: d009Winter });
      vm.runInContext(`${js}\n;globalThis.__mutated = ${fn};`, ctx, { filename: `mutant:${file}` });
      let first = -1;
      for (let k = 0; k < D009_COUNTS[name]; k++) {
        const got = d009Canon(d009Result(name, d009Cases[name](k), { ...d009Fns, [fn]: ctx.__mutated }));
        if (got !== d009Exact[name][k]) { first = k; break; }
      }
      if (first < 0) missed.push(`${name} ${from}→${to} 未抓到`);
      else detected.push(`${name} 第 ${first} 組`);
    } catch (e) { missed.push(`${name}: ${e.message}`); }
  }
  log(detected.length === mutants.length, 'D009 F1–F11 原碼單點突變（含 F11 接力）都使對應守衛轉紅',
    missed.length ? missed.join('；') : detected.join('、'));
}

// ---- D010：服務覆蓋、污染、地價、教育場照實驗線原始碼對拍（tools/unit-d010-fields.mjs）；起步城逐日模擬（tools/unit-d010-sim.mjs）----
{
  const { d010FieldGuards } = await import('./unit-d010-fields.mjs');
  await d010FieldGuards(log);
  const { d010SimGuards } = await import('./unit-d010-sim.mjs');
  await d010SimGuards(log);
}

// ---- D011：建造規則黃金樣本（unit-d011-build.mjs）、資金公式黃金樣本（unit-d011-money.mjs）、施工整合層（unit-d011-edit.mjs：
//      開局碼、帳、同步、重播、存讀檔、地價狀態機、沙盒、推進一天耗時）、實驗線實跑錨點與分享碼互通（unit-d011-parity.mjs）----
{
  const { d011BuildGuards } = await import('./unit-d011-build.mjs');
  await d011BuildGuards(log);
  const { d011MoneyGuards } = await import('./unit-d011-money.mjs');
  await d011MoneyGuards(log);
  const { d011EditGuards } = await import('./unit-d011-edit.mjs');
  await d011EditGuards(log);
  const { d011ParityGuards } = await import('./unit-d011-parity.mjs');
  await d011ParityGuards(log);
}

// ---- 模擬層純度（規則 2、3）：sim／io 不碰 three、DOM、現實時間、Math.random ----
{
  const bad = [];
  // TypeScript 詞法掃描器會跳過註解，字串只拿來檢查模組名稱；樣板字串的 ${} 另行重掃，避免漏掉其中的程式碼。
  const purityViolations = source => {
    const scanner = createScanner(true, undefined, source), tokens = [], templateDepth = [];
    while (true) {
      let k = scanner.scan();
      if (k === SyntaxKind.EndOfFile) break;
      if (k === SyntaxKind.TemplateHead) templateDepth.push(0);
      else if (k === SyntaxKind.OpenBraceToken && templateDepth.length) templateDepth[templateDepth.length - 1]++;
      else if (k === SyntaxKind.CloseBraceToken && templateDepth.length) {
        const top = templateDepth.length - 1;
        if (templateDepth[top]) templateDepth[top]--;
        else { k = scanner.reScanTemplateToken(false); if (k === SyntaxKind.TemplateTail) templateDepth.pop(); }
      }
      tokens.push({ k, text: scanner.getTokenText(), value: scanner.getTokenValue(), pos: scanner.getTokenStart() });
    }
    const violations = [], at = (t, why) => violations.push(`${source.slice(0, t.pos).split('\n').length}:${why}`);
    const specIsRender = spec => /(^three(?:\/|$)|(^|\/)render(?:\/|$))/.test(spec);
    const moduleToken = t => t?.k === SyntaxKind.StringLiteral || t?.k === SyntaxKind.NoSubstitutionTemplateLiteral;
    const moduleValue = t => t.k === SyntaxKind.StringLiteral ? t.value : t.text.slice(1, -1);
    const dot = t => t?.k === SyntaxKind.DotToken || t?.k === SyntaxKind.QuestionDotToken;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i], a = tokens[i + 1], b = tokens[i + 2];
      if (t.k === SyntaxKind.ImportKeyword) {
        if (a?.k === SyntaxKind.OpenParenToken) {
          if (moduleToken(b) && specIsRender(moduleValue(b))) at(t, `dynamic import ${moduleValue(b)}`);
        } else if (moduleToken(a)) { if (specIsRender(moduleValue(a))) at(t, `import ${moduleValue(a)}`); }
        else {
          for (let j = i + 1; j < tokens.length && j < i + 80 && tokens[j].k !== SyntaxKind.SemicolonToken; j++) {
            if (tokens[j].k === SyntaxKind.FromKeyword && moduleToken(tokens[j + 1])) { if (specIsRender(moduleValue(tokens[j + 1]))) at(t, `import ${moduleValue(tokens[j + 1])}`); break; }
          }
        }
      }
      if (t.k === SyntaxKind.ExportKeyword) {
        for (let j = i + 1; j < tokens.length && j < i + 80 && tokens[j].k !== SyntaxKind.SemicolonToken; j++) {
          if (tokens[j].k === SyntaxKind.FromKeyword && moduleToken(tokens[j + 1])) { if (specIsRender(moduleValue(tokens[j + 1]))) at(t, `export from ${moduleValue(tokens[j + 1])}`); break; }
        }
      }
      if (t.text === 'require' && a?.k === SyntaxKind.OpenParenToken && moduleToken(b) && specIsRender(moduleValue(b))) at(t, `require ${moduleValue(b)}`);
      if (['document', 'window', 'HTMLElement', 'localStorage', 'sessionStorage'].includes(t.text) && t.k === SyntaxKind.Identifier) at(t, t.text);
      if (t.text === 'globalThis' && a?.k === SyntaxKind.OpenBracketToken && moduleToken(b) && ['document', 'window', 'HTMLElement', 'localStorage', 'sessionStorage'].includes(moduleValue(b))) at(t, `globalThis[${moduleValue(b)}]`);
      if (t.text === 'Math' && ((dot(a) && b?.text === 'random') || (a?.k === SyntaxKind.OpenBracketToken && moduleToken(b) && moduleValue(b) === 'random'))) at(t, 'Math.random');
      if (t.text === 'Date' && ((dot(a) && b?.text === 'now') || (a?.k === SyntaxKind.OpenBracketToken && moduleToken(b) && moduleValue(b) === 'now') || a?.k === SyntaxKind.OpenParenToken || tokens[i - 1]?.k === SyntaxKind.NewKeyword)) at(t, 'Date／Date.now');
      if (t.text === 'performance' && ((dot(a) && ['now', 'timeOrigin'].includes(b?.text)) || (a?.k === SyntaxKind.OpenBracketToken && moduleToken(b) && ['now', 'timeOrigin'].includes(moduleValue(b))))) at(t, 'performance.now');
    }
    return violations;
  };
  const check = dir => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) { check(p); continue; }
    if (!e.isFile() || !/\.(ts|js|mjs)$/.test(e.name)) continue;
    bad.push(...purityViolations(read(p)).map(v => `${p}:${v}`));
  } };
  for (const dir of ['src/sim', 'src/io']) check(dir);
  log(bad.length === 0, '模擬層與解碼器不碰 three／DOM／Math.random／現實時間', bad.join(' ') || 'src/sim、src/io 全乾淨');
  const forbidden = ["import 'three'", "import x from 'three'", "await import('three')", "require('three')", 'window.alert(1)', 'globalThis.document.title', "globalThis['window']", 'Math.random()', "Math['random']()", 'Date.now()', 'new Date()', 'new Date', 'performance.now()', 'const q = `x ${1} and ${window.innerWidth}`'];
  const harmless = ["// Math.random() and import 'three'", "const s = 'window and Date.now()'", 'const q = `document ${1} and Math.random`'];
  log(forbidden.every(s => purityViolations(s).length > 0) && harmless.every(s => purityViolations(s).length === 0),
    '純度掃描辨識 bare／dynamic import、DOM、亂數、現實時間；註解與字串不誤報');
  // D004 驗收 9：內容層（切分、配方、種類表）也不碰 three 與 DOM
  const badC = [];
  for (const f of fs.readdirSync(path.join(ROOT, 'src/content')).filter(f => f.endsWith('.ts')))
    read(`src/content/${f}`).split('\n').forEach((l, i) => { if (/from ['"]three|\bdocument\.|\bwindow\.|\bHTMLElement\b|Math\.random/.test(l.replace(/\/\/.*$/, ''))) badC.push(`src/content/${f}:${i + 1}`); });
  log(badC.length === 0, '內容層 src/content/*.ts 不 import three、不碰 DOM', badC.join(' ') || 'src/content 全乾淨');
}

// ---- 零外部素材（規則 7）：src 裡沒有圖片、字型、模型、音效檔；程式與 index.html 不引用外部網址 ----
{
  const assets = [], urls = [];
  const walk = d => { for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) { const p = `${d}/${e.name}`; if (e.isDirectory()) walk(p); else if (/\.(png|jpe?g|gif|webp|svg|glb|gltf|obj|fbx|ttf|otf|woff2?|mp3|ogg|wav|m4a)$/i.test(e.name)) assets.push(p); else if (/\.(ts|html|css|json)$/.test(e.name)) read(p).split('\n').forEach((l, i) => { if (/https?:\/\//.test(l.replace(/\/\/ .*$|^\s*\*.*$/, ''))) urls.push(`${p}:${i + 1}`); }); } };
  walk('src');
  read('index.html').split('\n').forEach((l, i) => { if (/(src|href)\s*=\s*["']https?:/.test(l)) urls.push(`index.html:${i + 1}`); });
  log(assets.length === 0 && urls.length === 0, '零外部素材：src 沒有圖片／字型／模型／音效檔，也不引用外部網址', [...assets, ...urls].join(' ') || '乾淨');
}

const sec = ((Date.now() - t0) / 1000).toFixed(1);
if (fails.length) { console.log(`\nNG 紅燈（${sec}s）：${fails.join('、')}`); process.exit(1); }
console.log(`\nOK 綠燈（${sec}s）`);

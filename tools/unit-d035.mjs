// D035 Node 守衛：讀檔圖層補齊（L）——讀進格子、實驗線頁面實跑（L 系列連推 13 天、污水幹管佈局、本線拆路與蓋東西之後存的碼給實驗線讀）、拆除與寫回、存讀、接線突變。
// 由 tools/unit.mjs 呼叫；污水原文的 vm 逐項與突變在 tools/unit-d033.mjs（D035 加了 sm472）。
//   1. 樣本 src/content/samples/d035-lab.json（tools/d035-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀：版本、回退設定、探針原文、每一筆的碼雜湊（＝本線現在產生的）、城／佈局／rt 的清單；
//   2. 讀進格子（驗收 1）：十一層（FLAG_LAYERS）的格數與位置＝存檔字串裡非 0 的字元；所有現有樣本碼都對（ai120 有 dc 138 格）；沒有這些層的城這些欄位全是 undefined；
//   3. runs（驗收 2）：L 系列連推 13 天，每天跟實驗線逐欄比（D034 的全部欄位）加三欄：十一層的統計、有電的道路格、公車站與路旁裝飾的覆蓋場；「沒讀這些層」的那一版必須跟實驗線不同（有牙）；
//   4. layouts（驗收 3 的實跑半邊）：污水幹管佈局不推進，實驗線的 SEWER_ROOT_OK472 逐棟＝本線 sewerServed；有幹管的佈局拿掉幹管之後要有一批棟數不同（有牙）；
//   5. 拆除與寫回（驗收 4）：本線的 doze／蓋／劃區／鋪路之後格子、覆蓋場、存檔字串；protect 一次拆路＝實驗線的逐層多次拆；實驗線讀回本線存的碼（rt）；
//   6. 存→讀→再存（驗收 5）；
//   7. 接線突變（驗收 6）：simFromSave 少讀一層、saveCode 不寫回、FOREIGN_LAYERS 少一層、拆路不撤覆蓋印、sewer.ts 的幹管成本與元件欄位、power.ts 的高壓線接力。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import * as SW from '../src/sim/rules/sewer.ts';
import { FLAG_LAYERS } from '../src/sim/rules/lab.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { commitOp, previewOp } from '../src/sim/edit.ts';
import { loadMod } from './unit-d024.mjs';
import { dayVariant } from './unit-d021.mjs';
import { compareCity33 } from './unit-d033-live.mjs';
import { PROBE, LAYER_NAMES, RT_PLANS, RT_DAYS, d035Rt } from './d035-lab.mjs';
import { d035Runs, d035Layouts, L_DAYS, strippedCode } from './d035-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城
export async function d035Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D035 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 統計：字串的格式跟 tools/d035-lab.mjs 的探針逐字相同 ----
const fnvAdd = (h, s) => { for (let q = 0; q < s.length; q++) { h ^= s.charCodeAt(q); h = Math.imul(h, 16777619) >>> 0; } return h; };
const hashOf = f => { let c = 0, h = 2166136261 >>> 0; f((i, v) => { c++; h = fnvAdd(h, i + ':' + v + ';'); }); return [c, h]; };
export const layerStats = w => LAYER_NAMES.map(f => hashOf(e => { for (let i = 0; i < w.tiles.length; i++) { const v = +(w.tiles[i][f] || 0); if (v) e(i, v); } }));
export const rpStats = w => hashOf(e => { for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i].rp) e(i, 1); });
export const covStats = g => ['bus', 'rdec'].map(f => { const a = g.COV[f]; let sum = 0; const q = hashOf(e => { if (a) for (let i = 0; i < a.length; i++) { const v = a[i] | 0; if (v) { sum += v; e(i, v); } } }); return [sum, q[1]]; });

const stripped = strippedCode;

async function guards(log) {
  const lab = JSON.parse(read(process.env.D035_SAMPLE ?? 'src/content/samples/d035-lab.json')), runs = d035Runs(), layouts = d035Layouts(), rts = d035Rt();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, runs, layouts, rts, KT, vrank });
  const simOf = (c, mod = realDay) => mod.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank);

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (lab.source?.probe !== PROBE) bad.push('探針原文跟 tools/d035-lab.mjs 現在的不同（重錄）');
    if (J(lab.order) !== J(runs.map(r => r.id))) bad.push('樣本的 L 城清單 ≠ tools/d035-cities.mjs d035Runs() 現在的（重跑 tools/d035-lab.mjs --part=runs）');
    if (J(lab.layoutOrder) !== J(layouts.map(l => l.id))) bad.push('樣本的佈局清單 ≠ d035Layouts() 現在的（重跑 tools/d035-lab.mjs --part=layouts）');
    if (J(lab.rtOrder) !== J(rts.map(r => r.id))) bad.push('樣本的 rt 清單 ≠ d035Rt() 現在的（重跑 tools/d035-lab.mjs --part=rt）');
    for (const c of runs) { const L = lab.runs[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code) || L.rows.length !== c.days) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同或天數不對（重跑 tools/d035-lab.mjs --part=runs）`); }
    for (const l of layouts) { const L = lab.layouts[l.id]; if (!L) bad.push(`${l.id}：沒有記錄`); else if (L.codeHash !== fnv1a(l.code)) bad.push(`${l.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d035-lab.mjs --part=layouts）`); }
    for (const c of rts) { const L = lab.rt?.[c.id]; if (!L) bad.push(`rt ${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code) || L.rows.length !== c.days) bad.push(`rt ${c.id}：本線拆路蓋東西之後存出來的碼跟錄樣本時不同或天數不對（重跑 tools/d035-lab.mjs --part=rt）`); }
    log(!bad.length, `D035 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；L 城 ${runs.length} 座連推 ${L_DAYS} 天、污水幹管佈局 ${layouts.length} 個（不推進）、rt ${rts.length} 筆（本線拆路蓋東西之後存的碼給實驗線讀、再推 ${RT_DAYS} 天）；探針原文與碼雜湊＝本線現在的`,
      bad.slice(0, 4).join('；') || `runs ${Object.keys(lab.runs).length}、layouts ${Object.keys(lab.layouts).length}、rt ${Object.keys(lab.rt ?? {}).length}，錄了 ${lab.seconds} 秒`);
    if (bad.length) return;
  }

  // ---- 2. 讀進格子（驗收 1）----
  {
    const bad = [], info = [];
    const checkCode = (id, code) => {
      const d = decodeLabCode(code); if (!d.ok) { bad.push(`${id}：碼解不開`); return null; }
      const s = realDay.simFromSave(d.save, code, KT, vrank), tiles = s.w.tiles, got = {};
      for (const [raw, field] of FLAG_LAYERS) {
        const str = d.save.raw[raw], want = [];
        if (typeof str === 'string') for (let i = 0; i < str.length; i++) if (str[i] !== '0') want.push(i + ':' + +str[i]);
        const have = []; for (let i = 0; i < tiles.length; i++) { const v = tiles[i][field]; if (v) have.push(i + ':' + v); else if (v !== undefined) bad.push(`${id} ${field} 第 ${i} 格是 ${v}（沒有的層要 undefined）`); }
        if (J(want) !== J(have)) bad.push(`${id}：${field}（${raw}）存檔 ${want.length} 格、格子 ${have.length} 格${J(want.slice(0, 3))}${J(have.slice(0, 3))}`);
        got[field] = have.length;
      }
      return { s, got };
    };
    const gots = [];
    for (const c of runs) { const r = checkCode(c.id, c.code); if (r) { gots.push(r.got); info.push(`${c.id} ${J(Object.fromEntries(Object.entries(r.got).filter(([, v]) => v)))}`); } }
    const missing = LAYER_NAMES.filter(f => !gots.some(g => g[f] > 0));
    if (missing.length) bad.push(`L 系列沒有涵蓋這幾層：${missing.join('、')}`);
    for (const f of fs.readdirSync(path.join(ROOT, 'src/content/samples')).filter(f => f.endsWith('.code.txt'))) checkCode(f, read('src/content/samples/' + f).trim());
    const ai = checkCode('ai120', read('src/content/samples/ai120.code.txt').trim());
    if (ai && ai.got.deco !== 138) bad.push(`ai120 的 dc 進了格子 ${ai?.got.deco} 格（要 138）`);
    if (ai) for (const f of LAYER_NAMES) if (f !== 'deco' && ai.got[f]) bad.push(`ai120 不該有 ${f}（${ai.got[f]} 格）`);
    // 沒有這些層的城：D034 的 M 系列（人口 ≥ 500 的自造城）也都沒有
    log(!bad.length, 'D035 驗收 1：讀進格子——十一層（rdec、bus、tram、busLane、oneway、light、deco、hv471、ug471、wm472、sm472）的格數與位置＝存檔字串裡非 0 的字元（逐格、含值）；沒有的層格子上是 undefined；所有現有樣本碼都對；ai120 的 dc 138 格進了格子；L 系列把十一層都涵蓋',
      bad.slice(0, 4).join('；') || `${runs.length} 座 L 城、${fs.readdirSync(path.join(ROOT, 'src/content/samples')).filter(f => f.endsWith('.code.txt')).length} 個樣本碼都對：${info.join('｜')}；ai120 deco ${ai?.got.deco}`);
  }

  // ---- 3. L 城連推 13 天（驗收 2）----
  const compare35 = (mod, code, rec, opt = {}) => {
    const extra = [];   // opt.rowsOnly＝只比 D034 的那些欄（不比圖層統計、有電的道路格、覆蓋場）：拿掉十一層的那一版要靠「推進的數字」跟實驗線不同，不能靠圖層統計當然不同
    if (!opt.rowsOnly) { const s0 = mod.simFromSave(decodeLabCode(code).save, code, KT, vrank), a = layerStats(s0.w); if (J(a) !== J(rec.start.lh)) extra.push(`讀進來那一刻的圖層 本線 ${J(a.map(q => q[0]))} ≠ 實驗線 ${J(rec.start.lh.map(q => q[0]))}`); }
    const r = compareCity33(mod, code, rec, KT, vrank, { stopAtFirst: !!opt.stopAtFirst, onDay: (day, mine, row, rep, s) => {
      if (!opt.rowsOnly) {
      const lh = layerStats(s.w), rp = rpStats(s.w), cv = covStats(s.g);
      if (J(lh) !== J(row.lh)) extra.push(`第 ${day} 天 圖層格數 本線 ${J(lh.map(q => q[0]))} ≠ 實驗線 ${J(row.lh.map(q => q[0]))}（或位置不同）`);
      if (J(rp) !== J(row.rp)) extra.push(`第 ${day} 天 有電的道路格 本線 ${J(rp)} ≠ 實驗線 ${J(row.rp)}`);
      if (J(cv) !== J(row.cv)) extra.push(`第 ${day} 天 公車站／路旁裝飾的覆蓋場 本線 ${J(cv)} ≠ 實驗線 ${J(row.cv)}`);
      }
      opt.onDay?.(day, mine, row, rep, s);
    } });
    for (const x of extra) { r.d.push(x); if (!r.first) { r.first = 1; r.firstFields = ['lh']; } }
    return r;
  };
  const EXPECT = { L1: 'differs', L2: 'differs', L3a: 'differs', L3b: 'same', L3c: 'differs', L4a: 'differs', L4b: 'differs', L5: 'differs' };   // 拿掉十一層之後跟實驗線不同嗎（L3b 的高壓線斷開，沒有效果＝對照）
  const seen = { days: 0, power: {}, sew: {}, lv3: {}, happy: {}, tx: {} };
  {
    const bad = [], info = [];
    for (const c of runs) {
      const rec = lab.runs[c.id];
      const r = compare35(realDay, c.code, rec, { onDay: (day, mine, row, rep, s) => {
        seen.days++;
        if (day === 1) { seen.power[c.id] = rep.powered; seen.sew[c.id] = rep.sewer.served; seen.happy[c.id] = +row.happy.toFixed(4); }
        if (day === L_DAYS) seen.lv3[c.id] = row.lv[1];
      } });
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 220)}（共 ${r.d.length} 天不同）`);
      // 有牙：沒讀這些層的那一版要跟實驗線不同
      const strip = compare35(realDay, stripped(c.code), rec, { stopAtFirst: true, rowsOnly: true });
      const differs = strip.d.length > 0;
      if (EXPECT[c.id] === 'differs' && !differs) bad.push(`${c.id}：拿掉十一層之後居然跟實驗線一樣（這一座沒有量到任何東西）`);
      if (EXPECT[c.id] === 'same' && differs) bad.push(`${c.id}：拿掉十一層之後不該有差（斷開的高壓線沒有效果）：${strip.d[0].slice(0, 100)}`);
      info.push(`${c.id}：${differs ? '沒讀就不同（' + (strip.firstFields ?? []).slice(0, 3).join('、') + '）' : '沒讀也一樣（對照）'}`);
    }
    // 看得到的差別
    const expect = (cond, msg) => { if (!cond) bad.push(msg); };
    expect(seen.power.L3a > seen.power.L3b + 10 && seen.power.L3c > seen.power.L3b + 10, `高壓線接力：有電棟數 L3a ${seen.power.L3a}、L3c ${seen.power.L3c}、斷開的 L3b ${seen.power.L3b}（接得上的要多 ≥ 10 棟）`);
    expect(seen.sew.L4a > seen.sew.L4b + 5, `污水幹管橋接：接管棟數 L4a ${seen.sew.L4a}、差一格的 L4b ${seen.sew.L4b}（要多 ≥ 5）`);
    expect(seen.lv3.L4a > seen.lv3.L4b, `污水幹管橋接：第 ${L_DAYS} 天 lv3 住宅 L4a ${seen.lv3.L4a}、L4b ${seen.lv3.L4b}（橋接的要多）`);
    expect(runs.every(c => c.id === 'L3b' || lab.runs[c.id].rows.at(-1).pop >= 500), '每座 L 城（斷開高壓線的 L3b 除外：第二條路全黑、人口只剩 330）第 13 天人口都要 ≥ 500（污水接管才有意義）');
    log(!bad.length, `D035 驗收 2：實驗線頁面實跑（L 系列 ${runs.length} 座自造城，連推 ${L_DAYS} 天）——每天逐欄跟實驗線比（D034 的全部欄位）加十一層的格數與位置、有電的道路格、公車站與路旁裝飾的覆蓋場；錢也判；沒讀這些層的那一版必須不同（L3b 斷開的高壓線除外）；覆蓋：高壓線接力讓第二條路有電、斷開沒有、污水幹管橋接多接管`,
      bad.slice(0, 4).join('｜') || `${runs.length} 座、${seen.days} 個城日每一欄全等；${info.join('；')}；有電棟數 L3a ${seen.power.L3a}／L3b ${seen.power.L3b}／L3c ${seen.power.L3c}；接管 L4a ${seen.sew.L4a}／L4b ${seen.sew.L4b}、lv3 ${seen.lv3.L4a}／${seen.lv3.L4b}`);
  }

  // ---- 4. 污水幹管佈局（驗收 3 的實跑半邊）----
  const layoutDiffs = (M, { dropMains = false } = {}) => {
    const bad = [], cover = { roots: 0, ok: 0, withMain: 0, changedLayouts: 0, changedRoots: 0, mainTiles: 0 };
    for (const l of layouts) {
      const L = lab.layouts[l.id], s = simOf(l), w = s.w;
      let sm = 0; for (let i = 0; i < w.tiles.length; i++) if (w.tiles[i].sm472) sm++;
      if (!dropMains && sm !== L.sm) { bad.push(`${l.id}：幹管 本線 ${sm} 格、實驗線 ${L.sm} 格`); continue; }
      if (dropMains) for (let i = 0; i < w.tiles.length; i++) w.tiles[i].sm472 = undefined;
      const res = M.sewerServed(w), roots = [];
      for (let i = 0; i < w.tiles.length; i++) { const b = w.tiles[i].bld; if (b && !b.ref) roots.push([i, b.k, b.sz || 1]); }
      if (J(roots) !== J(L.roots)) { bad.push(`${l.id}：根格清單不同（本線 ${roots.length}、實驗線 ${L.roots.length}）`); continue; }
      const mine = []; for (let i = 0; i < res.ok.length; i++) if (res.ok[i]) mine.push(i);
      const a = new Set(mine), b = new Set(L.ok), only = [...mine.filter(x => !b.has(x)), ...L.ok.filter(x => !a.has(x))];
      if (only.length) { bad.push(`${l.id}：接管不同——只有本線 ${mine.filter(x => !b.has(x)).slice(0, 4).join(',') || '無'}、只有實驗線 ${L.ok.filter(x => !a.has(x)).slice(0, 4).join(',') || '無'}`); if (dropMains) { cover.changedLayouts++; cover.changedRoots += only.length; } }
      cover.roots += roots.length; cover.ok += mine.length; cover.mainTiles += L.sm; if (L.sm) cover.withMain++;
    }
    return { bad, cover };
  };
  {
    const { bad, cover } = layoutDiffs(SW);
    // 有牙：拿掉幹管之後，跟實驗線不同的佈局要有一批
    const strip = layoutDiffs(SW, { dropMains: true });
    if (cover.withMain < 100) bad.push(`有幹管的佈局只有 ${cover.withMain} 個（要 ≥ 100）`);
    if (strip.cover.changedLayouts < 25 || strip.cover.changedRoots < 50) bad.push(`拿掉幹管之後跟實驗線不同的佈局只有 ${strip.cover.changedLayouts} 個、棟數 ${strip.cover.changedRoots}（要 ≥ 25 個、≥ 50 棟：這批佈局要量得到幹管）`);
    if (cover.ok < 300) bad.push(`接管的根格只有 ${cover.ok}（要 ≥ 300）`);
    LIVE.layCover = { cover, strip: strip.cover };
    log(!bad.length, `D035 驗收 3（實跑半邊）：污水幹管佈局 ${layouts.length} 個（10 個手排：橋接、差一格、蛇形旁的直幹管、起點在幹管上、幹管環、距離剛好 90／91／122／123、只有幹管、廠夾兩個元件、幹管在建築底下、地圖邊緣；${layouts.length - 10} 個隨機）不推進——實驗線強制算 ensureWaterCycle472 的 SEWER_ROOT_OK472 逐棟＝本線 sewerServed；根格清單與幹管格數相同；拿掉幹管之後要有一批不同`,
      bad.slice(0, 4).join('｜') || `${layouts.length} 個佈局、${cover.roots} 個根格、接管 ${cover.ok}、有幹管的 ${cover.withMain} 個（幹管 ${cover.mainTiles} 格）逐棟全等；拿掉幹管之後 ${strip.cover.changedLayouts} 個佈局、${strip.cover.changedRoots} 棟不同`);
  }

  // ---- 5. 拆除與寫回（驗收 4）----
  const editNoProtect = await loadMod('src/sim/edit.ts', [['protect: true, ', '']]);
  const opOf = o => o[0] === 'doze' ? { k: 'tap', tool: 'doze', x0: o[1], z0: o[2], x1: o[1], z1: o[2] }
    : o[0] === 'place' ? { k: 'tap', tool: o[1], x0: o[2], z0: o[3], x1: o[2], z1: o[3] }
    : o[0] === 'rect' ? { k: 'rect', tool: o[1], x0: o[2], z0: o[3], x1: o[4], z1: o[5] } : { k: 'line', tool: o[1], x0: o[2], z0: o[3], x1: o[4], z1: o[5] };
  // 一個劇本在本線跑一遍：{ rs, L, s, code, orig }；mods＝{ edit（commitOp 那份）、save（saveCode 那份） }
  const play = (id, mods = {}) => {
    const [from, ops] = RT_PLANS[id], c = runs.find(q => q.id === from), L = loadCode(c.code, KT, vrank), co = mods.edit?.commitOp ?? commitOp, sv = mods.save?.saveCode ?? saveCode;
    const rs = ops.map(o => co(L.sim, opOf(o), 0));
    return { id, from, ops, rs, L, s: L.sim, code: sv(L.sim, L.template, L.start), orig: decodeLabCode(c.code).save.raw };
  };
  // 一個劇本的問題清單：操作都成功、格子上那幾層清掉、覆蓋場＝讀回來重算的、存檔字串只動「格子上沒了而範本不是 0」的格
  const rtFacts = p => {
    const bad = [], w = p.s.w, N = w.N, cleared = new Set();
    if (!p.rs.every(r => r.ok)) bad.push(`${p.id}：有操作被擋下 ${J(p.rs.map(r => [r.ok, r.reason]))}`);
    const at = (x, z) => w.tiles[z * N + x];
    for (const o of p.ops) {
      if (o[0] === 'doze') { const t = at(o[1], o[2]); for (const f of ['road', 'bus', 'rdec', 'tram', 'oneway', 'light', 'busLane']) if (t[f]) bad.push(`${p.id}：拆 (${o[1]},${o[2]}) 之後 ${f} 還在`); }
      if (o[0] === 'place' && at(o[2], o[3]).deco) bad.push(`${p.id}：在 (${o[2]},${o[3]}) 蓋建築之後 deco 還在`);
      if (o[0] === 'rect' || o[0] === 'line') for (let z = o[3]; z <= o[5]; z++) for (let x = o[2]; x <= o[4]; x++) if (at(x, z).deco) bad.push(`${p.id}：${o[0] === 'rect' ? '劃區' : '鋪路'} (${x},${z}) 之後 deco 還在`);
    }
    const d = decodeLabCode(p.code); if (!d.ok) return { bad: [...bad, `${p.id}：存檔解不開 ${d.error}`], cleared: 0 };
    const raw = d.save.raw;
    for (const [rawKey, field] of FLAG_LAYERS) {
      const a = p.orig[rawKey], b = raw[rawKey]; if (typeof a !== 'string') continue;
      if (typeof b !== 'string' || a.length !== b.length) { bad.push(`${p.id}：${rawKey} 存出來長度不對`); continue; }
      for (let i = 0; i < a.length; i++) {
        const now = w.tiles[i][field];
        if (a[i] !== '0' && !now) { if (b[i] !== '0') bad.push(`${p.id}：${rawKey} 第 ${i} 格（${i % N},${(i / N) | 0}）格子上沒有了、存檔還是 ${b[i]}`); else cleared.add(rawKey + ':' + i); }
        else if (b[i] !== a[i]) bad.push(`${p.id}：${rawKey} 第 ${i} 格不該動（格子 ${now}）：${a[i]}→${b[i]}`);
      }
    }
    const L2 = loadCode(p.code, KT, vrank); if (!L2.ok) return { bad: [...bad, `${p.id}：存的碼讀不回 ${L2.error}`], cleared: cleared.size };
    if (J(layerStats(L2.sim.w)) !== J(layerStats(w))) bad.push(`${p.id}：存→讀之後十一層的統計跟模擬的格子不同`);
    if (J(covStats(L2.sim.g)) !== J(covStats(p.s.g))) bad.push(`${p.id}：覆蓋場（公車站、路旁裝飾）跟讀回來重算的不同（拆除沒有撤覆蓋印）：${J(covStats(p.s.g).map(q => q[0]))} ≠ ${J(covStats(L2.sim.g).map(q => q[0]))}`);
    return { bad, cleared: cleared.size };
  };
  {
    const bad = [], info = [];
    for (const id of Object.keys(RT_PLANS)) {
      const p = play(id);
      if (p.code !== rts.find(r => r.id === id).code) bad.push(`${id}：劇本存出來的碼跟 d035Rt() 不同`);
      const f = rtFacts(p); bad.push(...f.bad); info.push(`${id}：清掉 ${f.cleared} 格`);
      if (id === 'L5-doze' && f.cleared < 10) bad.push(`${id}：清掉的圖層格只有 ${f.cleared}（要 ≥ 10）`);
    }
    // protect 一次拆路＝實驗線一層一層拆（先輕軌、再路旁裝飾、再公車站……最後才是路）：只做 doze，兩邊逐格相同
    for (const [id, ops] of [['L5-doze', RT_PLANS['L5-doze'][1].filter(o => o[0] === 'doze')], ['L1-doze', RT_PLANS['L1-doze'][1]]]) {
      const c = runs.find(q => q.id === RT_PLANS[id][0]), A = loadCode(c.code, KT, vrank).sim, B = loadCode(c.code, KT, vrank).sim;
      for (const o of ops) {
        commitOp(A, opOf(o), 0);
        let n = 0; for (; n < 5; n++) { if (!B.w.tiles[o[2] * B.w.N + o[1]].road) break; if (!editNoProtect.commitOp(B, opOf(o), 0).ok) break; }
        if (B.w.tiles[o[2] * B.w.N + o[1]].road) bad.push(`${id}：逐層拆 (${o[1]},${o[2]}) 拆不完`);
      }
      for (const [x, z] of ops.map(o => [o[1], o[2]])) for (const f of ['road', 'bus', 'rdec', 'tram', 'oneway', 'light', 'busLane']) if ((A.w.tiles[z * A.w.N + x][f] || 0) !== (B.w.tiles[z * B.w.N + x][f] || 0)) bad.push(`${id}：(${x},${z}) ${f} 一次拆 ${A.w.tiles[z * A.w.N + x][f]}、逐層拆 ${B.w.tiles[z * B.w.N + x][f]}`);
      if (J(covStats(A.g)) !== J(covStats(B.g))) bad.push(`${id}：覆蓋場 一次拆 ${J(covStats(A.g).map(q => q[0]))}、逐層拆 ${J(covStats(B.g).map(q => q[0]))}`);
      if (J(layerStats(A.w)) !== J(layerStats(B.w))) bad.push(`${id}：十一層 一次拆跟逐層拆不同（${J(layerStats(A.w).map(q => q[0]))} ≠ ${J(layerStats(B.w).map(q => q[0]))}）`);
    }
    log(!bad.length, 'D035 驗收 4：拆除與寫回——本線的 doze（有公車站、路旁裝飾、輕軌、單行道、紅綠燈、公車專用道的路格，一次直接拆路）、在有裝飾的格上蓋建築／劃區／鋪路之後：格子上那幾層清掉、覆蓋場＝讀回來重算的（拆路撤了公車站與路旁裝飾的覆蓋印）、存檔字串只有「格子上沒了而範本不是 0」的格寫成 0、其餘逐位元組不變；protect 一次拆＝實驗線一層一層拆到路（格子、覆蓋場、十一層統計都相同）',
      bad.slice(0, 4).join('｜') || info.join('；'));
  }

  // rt：實驗線讀本線拆路蓋東西之後存的碼
  {
    const bad = [], info = [];
    for (const c of rts) {
      const rec = lab.rt[c.id], r = compare35(realDay, c.code, rec);
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 200)}（共 ${r.d.length} 天不同）`);
      info.push(`${c.id} 讀進來十一層 ${J(rec.start.lh.map(q => q[0]))}`);
    }
    log(!bad.length, `D035 驗收 4：實驗線讀本線存的碼——本線拆路、蓋東西之後存出來的碼，實驗線用自己的 GV.importCode 讀回去：十一層的格數與位置＝本線格子，再推 ${RT_DAYS} 天每一欄（含有電的道路格與覆蓋場）跟本線一樣`,
      bad.slice(0, 3).join('｜') || `${rts.length} 筆全等：${info.join('；')}`);
  }

  // ---- 6. 存→讀→再存（驗收 5）----
  {
    const bad = [], info = [];
    for (const c of runs) {
      const L = loadCode(c.code, KT, vrank); if (!L.ok) { bad.push(`${c.id}：讀不進 ${L.error}`); continue; }
      const raw0 = decodeLabCode(c.code).save.raw;
      for (let d = 0; d < L_DAYS; d++) realDay.stepDay(L.sim);
      const code1 = saveCode(L.sim, L.template, L.start), L2 = loadCode(code1, KT, vrank);
      if (!L2.ok) { bad.push(`${c.id}：存的碼讀不回 ${L2.error}`); continue; }
      const code2 = saveCode(L2.sim, L2.template, L2.start), r1 = decodeLabCode(code1).save.raw, r2 = decodeLabCode(code2).save.raw;
      if (J(layerStats(L.sim.w)) !== J(layerStats(L2.sim.w))) bad.push(`${c.id}：存→讀之後十一層的統計不同`);
      // 十一層的字串：推進 13 天不拆不蓋，跟原碼逐位元組相同；存→讀→再存也一樣
      let same = 0;
      for (const [r] of FLAG_LAYERS) { if (typeof raw0[r] !== 'string') continue; if (raw0[r] !== r1[r]) bad.push(`${c.id}：${r} 推進 ${L_DAYS} 天後存出來跟原來不同`); else if (r1[r] !== r2[r]) bad.push(`${c.id}：${r} 存→讀→再存不同`); else same++; }
      // 其餘的鍵：再存一次跟第一次只差歷史（讀檔重挑外觀的事件）與它帶來的幾個欄位——十一層以外的格子欄位逐字相同
      for (const k of Object.keys(r1)) { if (FLAG_LAYERS.some(([r]) => r === k) || k === 'd3') continue; if (typeof r1[k] === 'string' && J(r1[k]) !== J(r2[k]) && !['bl'].includes(k)) bad.push(`${c.id}：${k} 存→讀→再存不同（${String(r1[k]).length}／${String(r2[k]).length}）`); }
      info.push(`${c.id} ${same} 層`);
    }
    log(!bad.length, `D035 驗收 5：存→讀→再存——L 城推進 ${L_DAYS} 天後存、讀、再存：十一層的統計一致；沒有拆路與蓋東西時十一層的字串跟原碼逐位元組相同，再存一次也相同；其餘字串欄位（地形、道路、分區……）再存一次逐字相同`,
      bad.slice(0, 4).join('｜') || `${runs.length} 座都過：${info.join('、')}`);
  }

  await wiringGuards(log, { lab, runs, layouts, KT, vrank, compare35, layoutDiffs, play, rtFacts, simOf });
  await timing(log, { runs, KT, vrank });
}

// ---- 7. 接線突變（驗收 6）----
const FOREIGN_LINE = "export const FOREIGN_LAYERS = ['rail', 'lv475', 'ud475', 'fly475', 'ix475', 'tram', 'rdec', 'bus', 'hv471', 'ug471', 'wm472', 'sm472', 'deco', 'oneway', 'light', 'busLane'] as const;";
async function wiringGuards(log, { lab, runs, layouts, KT, vrank, compare35, layoutDiffs, play, rtFacts, simOf }) {
  const bad = [], out = [];
  const L5 = runs.find(c => c.id === 'L5'), rec5 = lab.runs.L5;
  // 7a. simFromSave 少讀一層：L5 十一層都有，逐層一個
  const base = compare35(await dayVariant([]), L5.code, rec5, { stopAtFirst: true });
  if (base.d.length) bad.push(`沒改的副本就有不對：${base.d[0].slice(0, 100)}`);
  const miss = [];
  for (const [raw, field] of FLAG_LAYERS) {
    const V = await dayVariant([['const flagLayers = FLAG_LAYERS.map(', `const flagLayers = FLAG_LAYERS.filter(([r]) => r !== '${raw}').map(`]]);
    if (!compare35(V, L5.code, rec5, { stopAtFirst: true }).d.length) miss.push(`simFromSave 少讀 ${field}`);
  }
  out.push(`simFromSave 少讀一層 ${FLAG_LAYERS.length} 個`); bad.push(...miss.map(m => `沒抓到：${m}`));
  // 7b. 高壓線接力與幹管：L3a、L4a
  {
    const P = await loadMod('src/sim/rules/power.ts', [['if (POWER_STARTER_K471.has(b.k)) for (const c of cs) hasStarter[c] = 1;', 'if (false) for (const c of cs) hasStarter[c] = 1;']]);
    const V = await dayVariant([], { './rules/power.ts': P });
    if (!compare35(V, runs.find(c => c.id === 'L3a').code, lab.runs.L3a, { stopAtFirst: true }).d.length) bad.push('沒抓到：高壓線元件不算貼著發電廠');
    const P2 = await loadMod('src/sim/rules/power.ts', [['if (b.k === 148) subs.push([i, cs]);', 'if (false) subs.push([i, cs]);']]);
    const V2 = await dayVariant([], { './rules/power.ts': P2 });
    if (!compare35(V2, runs.find(c => c.id === 'L3a').code, lab.runs.L3a, { stopAtFirst: true }).d.length) bad.push('沒抓到：開關站 k148 不接力');
    out.push('高壓線接力 2 個');
  }
  {
    const SWM = [['幹管成本 0 變 1', 'const main = !!tiles[z].sm472, nd = d + (main ? 0 : 1);', 'const main = !!tiles[z].sm472, nd = d + 1;'],
      ['元件只認 wp', 'if (!(tiles[i].wp || tiles[i].sm472) || comp[i] >= 0) continue;', 'if (!tiles[i].wp || comp[i] >= 0) continue;'],
      ['元件往外走只認 wp', 'if (comp[z] < 0 && (tiles[z].wp || tiles[z].sm472)) { comp[z] = n; q[m++] = z; }', 'if (comp[z] < 0 && tiles[z].wp) { comp[z] = n; q[m++] = z; }']];
    const ok0 = layoutDiffs(SW).bad.length === 0;
    if (!ok0) bad.push('沒改的 sewer.ts 就有不對');
    for (const [name, a, b] of SWM) { const M = await loadMod('src/sim/rules/sewer.ts', [[a, b]]); if (!layoutDiffs(M).bad.length) bad.push(`沒抓到：sewer.ts ${name}（佈局）`); }
    // 另一半：接進 day.ts 之後 L4a 的逐日比（元件欄位兩處一起換成只認 wp：幹管橋接不起來，右半沒有廠；單獨換一處等價，只有佈局抓得到）
    { const M = await loadMod('src/sim/rules/sewer.ts', [[SWM[1][1], SWM[1][2]], [SWM[2][1], SWM[2][2]]]), V = await dayVariant([], { './rules/sewer.ts': M });
      if (!compare35(V, runs.find(c => c.id === 'L4a').code, lab.runs.L4a, { stopAtFirst: true }).d.length) bad.push('沒抓到：sewer.ts 元件只認 wp（兩處，L4a 逐日）'); }
    out.push(`sewer.ts 幹管 ${SWM.length} 個（佈局）＋元件只認 wp 的 L4a 逐日`);
  }
  // 7c. 拆除：FOREIGN_LAYERS 少一層、拆路不撤覆蓋印、saveCode 不寫回
  {
    const bFile = read('src/sim/rules/build.ts');
    if (!bFile.includes(FOREIGN_LINE)) bad.push('build.ts 的 FOREIGN_LAYERS 那一行跟守衛記的不同（守衛要跟著改）');
    // 一格只有某一層（沒路沒建築）：protect 擋著拆不到；沒擋就拆得到。rdec、bus 例外：實驗線 canPlace 的「沒東西可拆」不把它們當東西，
    // 單獨的它們本來就拆不了；它們的差別在路格上——有公車站的路格一下要拆到路（沒擋的話第一下只拆站牌）
    const probe = async mod => {
      const hit = [];
      for (const f of LAYER_NAMES.concat(['rail'])) {
        const s = simOf(runs[0]), w = s.w, N = w.N, road = f === 'rdec' || f === 'bus';
        let i = -1; for (let q = 0; q < N * N; q++) { const t = w.tiles[q]; if ((t.t === 1 || t.t === 2) && !t.road && !t.bld && !t.zone && !t.tree && !t.deco && !t.ruin && !t.wp && !t.rail && !t.tram && !t.hv471 && !t.sm472 && !t.wm472) { i = q; break; } }
        w.tiles[i][f] = 1; if (road) { w.tiles[i].road = 1; w.tiles[i].rc = 2; }
        const r = mod.commitOp(s, { k: 'tap', tool: 'doze', x0: i % N, z0: (i / N) | 0, x1: i % N, z1: (i / N) | 0 }, 0);
        if (road ? (w.tiles[i].road || !r.ok) : (r.ok || !w.tiles[i][f])) hit.push(f);
      }
      return hit;
    };
    const real = await probe({ commitOp });
    if (real.length) bad.push(`protect 沒擋住：${real.join('、')}`);
    for (const f of LAYER_NAMES) {
      const rest = FOREIGN_LINE.replace(`'${f}', `, '').replace(`, '${f}'`, '');
      if (rest === FOREIGN_LINE) { bad.push(`FOREIGN 突變的字串沒換到 ${f}`); continue; }
      const B = await loadMod('src/sim/rules/build.ts', [[FOREIGN_LINE, rest]]), E = await loadMod('src/sim/edit.ts', [], { './rules/build.ts': B });
      if (!(await probe(E)).includes(f)) bad.push(`沒抓到：FOREIGN_LAYERS 少 ${f}`);
    }
    out.push(`FOREIGN_LAYERS 少一層 ${LAYER_NAMES.length} 個`);
    // 拆路不撤覆蓋印
    const noUnstamp = "if (st.protect) { if (t.rdec) stampCov(g, b, 'rdec', x, y, COVR.rdec, -1); if (t.bus) stampCov(g, b, 'bus', x, y, COVR.bus, -1); t.tram = 0; t.tramBridge = 0; }";
    if (!bFile.includes(noUnstamp)) bad.push('build.ts 拆路那一行跟守衛記的不同（守衛要跟著改）');
    for (const [name, to] of [['拆路不撤覆蓋印', "if (st.protect) { t.tram = 0; t.tramBridge = 0; }"], ['拆路不清輕軌', "if (st.protect) { if (t.rdec) stampCov(g, b, 'rdec', x, y, COVR.rdec, -1); if (t.bus) stampCov(g, b, 'bus', x, y, COVR.bus, -1); }"], ['拆路撤兩次', "if (st.protect) { if (t.rdec) { stampCov(g, b, 'rdec', x, y, COVR.rdec, -1); stampCov(g, b, 'rdec', x, y, COVR.rdec, -1); } if (t.bus) stampCov(g, b, 'bus', x, y, COVR.bus, -1); t.tram = 0; t.tramBridge = 0; }"]]) {
      const B = await loadMod('src/sim/rules/build.ts', [[noUnstamp, to]]), E = await loadMod('src/sim/edit.ts', [], { './rules/build.ts': B });
      const p = play('L5-doze', { edit: E }), f = rtFacts(p);
      if (!f.bad.length) bad.push(`沒抓到：${name}`);
    }
    out.push('拆路 3 個');
    // saveCode 不寫回
    const S = await loadMod('src/io/save.ts', [['for (const [raw, field] of FLAG_LAYERS) {\n    const str = template[raw];', 'for (const [raw, field] of [] as unknown as typeof FLAG_LAYERS) {\n    const str = template[raw];']]).catch(e => { bad.push('saveCode 突變的錨點對不上：' + e.message.slice(0, 80)); return null; });
    if (S) { const p = play('L5-doze', { save: S }); if (!rtFacts(p).bad.length) bad.push('沒抓到：saveCode 不寫回'); out.push('saveCode 不寫回 1 個'); }
  }
  log(!bad.length, 'D035 驗收 6：接線突變——simFromSave 少讀一層（十一個）、高壓線元件不算貼著發電廠、開關站不接力、sewer.ts 的幹管成本與兩處元件欄位（佈局與 L4a 逐日）、FOREIGN_LAYERS 少一層（十一個）、拆路不撤覆蓋印／不清輕軌／撤兩次、saveCode 不寫回都要紅；沒改的先核過全等',
    bad.slice(0, 5).join('｜') || out.join('；'));
}

// ---- 8. 效能：推進一天 ≤ 5 ms（D011 驗收 8），量一座有十一層的城 ----
async function timing(log, { runs, KT, vrank }) {
  // 同 D010／D011 的做法：三輪、每輪 60 天的平均，取最低的一輪（排除同機其他行程搶 CPU 的雜訊）；再量拿掉十一層的同一座城當對照（記在細節裡，不判：差在雜訊裡）
  const c = runs.find(q => q.id === 'L5'), ctl = strippedCode(c.code), once = code => {
    const s = loadCode(code, KT, vrank).sim, ts = [];
    for (let d = 0; d < 5; d++) realDay.stepDay(s);
    for (let d = 0; d < 60; d++) { const t0 = performance.now(); realDay.stepDay(s); ts.push(performance.now() - t0); }
    return ts.reduce((x, y) => x + y, 0) / ts.length;
  };
  const a = [], b = [];
  for (let r = 0; r < 4; r++) { a.push(once(c.code)); b.push(once(ctl)); }   // 交錯量（同一刻的機器狀態），各取平均最低的一輪
  const fa = Math.min(...a), fb = Math.min(...b);
  // 判兩件事：十一層沒有讓推進一天變慢（跟同一座城拿掉十一層的對照比，≤ 1.5 倍＋0.5 ms：同一台機器同一刻交錯量，不怕機器忙；要抓的是「多掃了一整張圖」那種量級）；絕對值 ≤ 5 ms（D011 驗收 8）——
  // 對照組自己都超過 5 ms 的時候（機器忙、CI 跑得慢）絕對值不判，只判相對（這一座 L5 比 D010／D011 的劇本城密，空機器上 2–4 ms）
  const rel = fa <= 1.5 * fb + 0.5, abs = fa <= 5 || fb > 5;
  log(rel && abs, 'D035 驗收 8：推進一天 ≤ 5 ms（D011 驗收 8）——量一座有十一層的城（L5，交錯量四輪各 60 天取平均最低的一輪），不比拿掉十一層的同一座城慢過 1.5 倍',
    `有十一層：${a.map(x => x.toFixed(2)).join('／')} → 最低 ${fa.toFixed(2)} ms；拿掉十一層的同一座城：${b.map(x => x.toFixed(2)).join('／')} → 最低 ${fb.toFixed(2)} ms；比值 ${(fa / fb).toFixed(2)}${fb > 5 ? '（對照組超過 5 ms：機器忙，絕對值不判）' : ''}`);
}

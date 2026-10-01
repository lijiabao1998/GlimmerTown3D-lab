// D034 Node 守衛（二）：摩天樓與巨廈合併的實驗線頁面實跑（驗收 3、6）、接線（驗收 5）、歷史與存檔（驗收 6）。由 tools/unit.mjs 呼叫；vm 逐項與突變（驗收 1、2、5 的公式半邊）在 tools/unit-d034.mjs。
//   1. 樣本 src/content/samples/d034-lab.json（tools/d034-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀：實驗線版本、回退設定、探針原文、每一筆的碼雜湊（＝本線現在產生的）、M 城與 rt 的清單；
//   2. runs：M 系列（人口 ≥ 500、幸福自然 > .55／> .6 的自造城）連推 13 天，每天跟實驗線逐欄比——D033 的全部欄位（D032：資金不取整、淨額、三項稅、十二個收入項、食物、遊客、旅宿、每一棟住宅的幸福
//      64 位元浮點逐位、幸福構成 57 項、夜間城市、人口、就業、下一個亂數、焦土、有電、需求、垃圾、EDU；D033：接管棟數、lv2／lv3 住宅數）加這一張的兩欄：每一格建築的雜湊（種類、ref、等級與屋齡、塔與巨廈的變體、
//      通電、有水、幸福、邊長、分區）、塔與巨廈的根格數；錢也判；覆蓋：住宅塔、商業塔、住宅巨廈、商業綜合體都看得到；幸福 ≤ .55、.55–.6、> .6 各有足夠的天數；回報的合併筆數＝實驗線隔天塔與巨廈根格數的增量；
//   3. rt：本線推一段（塔與巨廈已長出來）再存檔，實驗線用自己的 GV.importCode 讀「本線存出來的碼」再推 3 天——讀得進本線存的塔與巨廈，讀進來之後的每一欄跟本線一樣；
//   4. 接線：day.ts 的副本改壞一處要紅（幸福閘門、需求、接管、公園覆蓋、報表、城市模型同步、屋齡、分區）；
//   5. 歷史與存檔：每座 M 城推 13 天之後，replayCity 重播＝模擬走出來的城市（建築清單含墓碑與屋齡、occ、分區）、城市模型跟格子一致、存→讀→再存歷史與格子一致、格式（有合併 7、沒有合併的城跟其餘事件的最大格式一樣）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { loadCode, saveCode, historyFormat, unpackHistory, checkHistory } from '../src/io/save.ts';
import { replayCity } from '../src/sim/replay.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { eventFormat, CITY_FORMAT } from '../src/sim/city.ts';
import { loadMod } from './unit-d024.mjs';
import { dayVariant } from './unit-d021.mjs';
import { compareCity33 } from './unit-d033-live.mjs';
import { PROBE, d034Rt, RT_DAYS } from './d034-lab.mjs';
import { d034Runs, MERGE_DAYS } from './d034-cities.mjs';
import { replayDiff } from './unit-d011-edit.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城
export async function d034LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D034 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 全部建築的雜湊與塔／巨廈的根格數：字串的格式跟 tools/d034-lab.mjs 的探針逐字相同（ref 格沒有等級與屋齡；住商工的變體讀檔被實驗線重挑過、純視覺，不比）
export function bldHash(w) {
  let h = 2166136261 >>> 0; const c = [0, 0, 0, 0], N = w.N;
  for (let i = 0; i < N * N; i++) {
    const t = w.tiles[i], b = t.bld; if (!b) continue;
    if (!b.ref) { if (b.k === 33) c[0]++; else if (b.k === 34) c[1]++; else if (b.k === 105) c[2]++; else if (b.k === 106) c[3]++; }
    const s = i + ',' + b.k + ',' + (b.ref ? b.ref[0] + ':' + b.ref[1] : '') + ',' + (b.ref ? '' : b.lv) + ',' + (!b.ref && (b.k === 33 || b.k === 34 || b.k === 105 || b.k === 106) ? b.v : '') + ',' + (b.ref ? '' : b.age) + ',' + (b.pw ? 1 : 0) + ',' + (b.wa ? 1 : 0) + ',' + (+(b.h || 0)) + ',' + (b.sz || 0) + ',' + (t.zone || 0) + ';';
    for (let q = 0; q < s.length; q++) { h ^= s.charCodeAt(q); h = Math.imul(h, 16777619) >>> 0; }
  }
  return { bh: h, tw: c };
}
// 結構雜湊（存→讀比對用：讀檔不帶逐日的通電、有水、幸福，所以不含它們）：種類、ref、等級、塔與巨廈根格的變體、邊長、分區
export function shapeHash(w) {
  let h = 2166136261 >>> 0; const N = w.N;
  for (let i = 0; i < N * N; i++) {
    const t = w.tiles[i], b = t.bld, s = i + ',' + (b ? b.k + ',' + (b.ref ? b.ref[0] + ':' + b.ref[1] : (b.lv + ',' + (b.sz || 0) + ',' + (b.k === 33 || b.k === 34 || b.k === 105 || b.k === 106 ? b.v : ''))) : '') + ',' + (t.zone || 0) + ';';
    for (let q = 0; q < s.length; q++) { h ^= s.charCodeAt(q); h = Math.imul(h, 16777619) >>> 0; }
  }
  return h;
}
// 城市模型跟格子一致：格子上每個非 ref 的建築根格都有一棟活著的城市建築、種類與邊長相同，反過來也一樣
export function cityVsWorld(s) {
  const w = s.w, N = w.N, bad = [], live = new Map();
  for (const b of s.city.buildings) if (b.goneDay === undefined) live.set(b.z * N + b.x, b);
  const roots = new Set();
  for (let i = 0; i < N * N; i++) { const b = w.tiles[i].bld; if (!b || b.ref) continue; roots.add(i); const cb = live.get(i); if (!cb) bad.push(`格子 (${i % N},${(i / N) | 0}) k${b.k} 沒有活著的城市建築`); else if (cb.k !== b.k) bad.push(`(${i % N},${(i / N) | 0}) 格子 k${b.k}、城市 k${cb.k}`); else if ((b.sz || 1) !== cb.size) bad.push(`(${i % N},${(i / N) | 0}) 邊長 格子 ${b.sz || 1}、城市 ${cb.size}`); }
  for (const [i, cb] of live) if (!roots.has(i)) bad.push(`城市建築 #${cb.id} k${cb.k} (${cb.x},${cb.z}) 格子上沒有`);
  if (s.root.size !== roots.size) bad.push(`s.root ${s.root.size} 筆、格子根格 ${roots.size} 個`);
  return bad;
}

async function guards(log) {
  const lab = JSON.parse(read(process.env.D034_SAMPLE ?? 'src/content/samples/d034-lab.json')), runs = d034Runs(), rts = d034Rt();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, runs, rts, KT, vrank });
  const simOf = c => realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank);

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (lab.source?.probe !== PROBE) bad.push('探針原文跟 tools/d034-lab.mjs 現在的不同（重錄）');
    if (J(lab.order) !== J(runs.map(r => r.id))) bad.push('樣本的 M 城清單 ≠ tools/d034-cities.mjs d034Runs() 現在的（重跑 tools/d034-lab.mjs）');
    if (J(lab.rtOrder) !== J(rts.map(r => r.id))) bad.push('樣本的 rt 清單 ≠ tools/d034-lab.mjs d034Rt() 現在的（重跑 tools/d034-lab.mjs --ids=…）');
    for (const c of runs) { const L = lab.runs[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code) || L.rows.length !== c.days) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同或天數不對（重跑 tools/d034-lab.mjs）`); }
    for (const c of rts) { const L = lab.rt?.[c.id]; if (!L) bad.push(`rt ${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code) || L.rows.length !== c.days) bad.push(`rt ${c.id}：本線存出來的碼跟錄樣本時不同或天數不對（重跑 tools/d034-lab.mjs --ids=…）`); }
    log(!bad.length, `D034 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；M 城 ${runs.length} 座連推 ${MERGE_DAYS} 天、rt ${rts.length} 筆（本線存的碼給實驗線讀、再推 ${RT_DAYS} 天）；探針原文與碼雜湊＝本線現在的`,
      bad.slice(0, 4).join('；') || `runs ${Object.keys(lab.runs).length}、rt ${Object.keys(lab.rt ?? {}).length}，錄了 ${lab.seconds} 秒`);
    if (bad.length) return;
  }

  // 一座城（碼＋樣本）逐天逐欄比（D033 的欄位＋bh／tw）；回傳每天的統計
  const compare34 = (mod, code, rec, { stopAtFirst = false, onDay } = {}) => {
    const extra = []; let prevTw = bldHash(realDay.simFromSave(decodeLabCode(code).save, code, KT, vrank).w).tw;   // 讀進來那一刻已經有的塔與巨廈（rt 的碼）不算今天合併的
    const r = compareCity33(mod, code, rec, KT, vrank, { stopAtFirst, onDay: (day, mine, row, rep, s) => {
      const q = bldHash(s.w);
      // 回報的合併筆數（本線自己的 DayReport.merges）＝實驗線這一天塔與巨廈根格數的增量
      const inc = [0, 0, 0, 0]; for (const m of rep.merges) inc[[33, 34, 105, 106].indexOf(m.k)]++;
      const want = row.tw.map((v, i) => v - prevTw[i]); prevTw = row.tw;
      if (J(inc) !== J(want)) extra.push(`第 ${day} 天 回報的合併 ${J(inc)} ≠ 實驗線的增量 ${J(want)}`);
      if (q.bh !== row.bh) extra.push(`第 ${day} 天 全部建築的雜湊 本線 ${q.bh} ≠ 實驗線 ${row.bh}`);
      if (J(q.tw) !== J(row.tw)) extra.push(`第 ${day} 天 塔與巨廈根格數 本線 ${J(q.tw)} ≠ 實驗線 ${J(row.tw)}`);
      onDay?.(day, mine, row, rep, s, q);
    } });
    for (const x of extra) { r.d.push(x); if (!r.first) { r.first = 1; r.firstFields = ['bh']; } }
    return r;
  };

  // ---- 2. M 城連推 13 天 ----
  {
    const bad = [], seen = { days: 0, kinds: [0, 0, 0, 0], band: [0, 0, 0], merges: [], ids: {} };
    for (const c of runs) {
      const rec = lab.runs[c.id];
      const r = compare34(realDay, c.code, rec, { onDay: (day, mine, row, rep, s, q) => {
        seen.days++;
        const hp = row.happy; seen.band[hp <= .55 ? 0 : hp <= .6 ? 1 : 2]++;
        const inc = [0, 0, 0, 0]; for (const m of rep.merges) inc[[33, 34, 105, 106].indexOf(m.k)]++;
        for (let i = 0; i < 4; i++) seen.kinds[i] += inc[i];
        if (rep.merges.length) { seen.merges.push(`${c.id}@${day}`); seen.ids[c.id] = (seen.ids[c.id] ?? 0) + rep.merges.length; }
      } });
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 220)}（共 ${r.d.length} 天不同）`);
    }
    const [t33, t34, m105, m106] = seen.kinds;
    if (!(t33 >= 3 && t34 >= 1 && m105 >= 2 && m106 >= 2)) bad.push(`合併的種類不夠：住宅塔 ${t33}（要 ≥ 3）、商業塔 ${t34}（≥ 1）、住宅巨廈 ${m105}（≥ 2）、商業綜合體 ${m106}（≥ 2）`);
    if (!(seen.band[0] >= 10 && seen.band[1] >= 10 && seen.band[2] >= 60)) bad.push(`幸福的天數：≤ .55 ${seen.band[0]}、.55–.6 ${seen.band[1]}、> .6 ${seen.band[2]}（要 ≥ 10、≥ 10、≥ 60）`);
    if (seen.ids.M4) bad.push(`幸福 ≤ .55 的 M4 不該有合併（${seen.ids.M4} 筆）`);
    LIVE.seen = seen;
    log(!bad.length, `D034 驗收 3：實驗線頁面實跑（M 系列 ${runs.length} 座自造城，人口 ≥ 500、幸福自然 > .55／> .6，不繞過閘門，連推 ${MERGE_DAYS} 天）——每天逐欄跟實驗線比（D033 的全部欄位：資金不取整、淨額、三項稅、十二個收入項、食物、遊客、旅宿、每一棟住宅的幸福 64 位元浮點逐位、幸福構成 57 項、夜間城市、人口、就業、下一個亂數、焦土、有電、三種需求、垃圾、EDU、接管棟數、lv2／lv3 住宅數）加每一格建築的雜湊與塔與巨廈的根格數；錢也判；覆蓋：四種合併都看得到、三段幸福各有足夠的天數、幸福 ≤ .55 的城零合併、回報的合併筆數＝實驗線的增量`,
      bad.slice(0, 4).join('｜') || `${runs.length} 座、${seen.days} 個城日每一欄全等（資金判了全部）；合併：住宅塔 ${t33}、商業塔 ${t34}、住宅巨廈 ${m105}、商業綜合體 ${m106}（${seen.merges.join('、')}）；幸福天數 ≤ .55 ${seen.band[0]}、.55–.6 ${seen.band[1]}、> .6 ${seen.band[2]}`);
  }

  // ---- 3. rt：本線存的碼，實驗線讀進來 ----
  {
    const bad = [], info = [];
    for (const c of rts) {
      const rec = lab.rt[c.id];
      const r = compare34(realDay, c.code, rec, { stopAtFirst: false });
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 200)}（共 ${r.d.length} 天不同）`);
      const tw = rec.rows[0].tw; info.push(`${c.id} 讀進來 ${J(tw)}`);
      if (!tw.some(v => v > 0)) bad.push(`${c.id}：存的碼裡沒有塔或巨廈（這一筆沒有意義）`);
    }
    log(!bad.length, `D034 驗收 6：實驗線讀本線存的碼——本線推一段（塔與巨廈已長出來）再存檔，實驗線用自己的 GV.importCode 讀「本線存出來的碼」再推 ${RT_DAYS} 天，讀進來之後的每一欄（含每一格建築的雜湊）跟本線一樣`,
      bad.slice(0, 3).join('｜') || `${rts.length} 筆全等：${info.join('；')}`);
  }

  await wiringGuards(log, { lab, runs, compare34, simOf, KT, vrank });
  await historyGuards(log, { runs, KT, vrank });
}

// ---- 4. 接線：day.ts 的副本改壞一處要紅（驗收 5）----
const WIRING = [   // [名字, day.ts 的編輯, 要被哪幾座 M 城抓到]
  ['幸福閘門永遠過（幸福給 1）', [['cityHappy, dem, sewNeed, sewOk: sewOkArr, rng: s.rng,', 'cityHappy: 1, dem, sewNeed, sewOk: sewOkArr, rng: s.rng,']], ['M3a', 'M4a', 'M5a']],
  ['幸福閘門永遠不過（幸福給 0）', [['cityHappy, dem, sewNeed, sewOk: sewOkArr, rng: s.rng,', 'cityHappy: 0, dem, sewNeed, sewOk: sewOkArr, rng: s.rng,']], ['M1b', 'M2a']],
  ['需求永遠夠（dem 全 1）', [['cityHappy, dem, sewNeed, sewOk: sewOkArr, rng: s.rng,', 'cityHappy, dem: { 1: 1, 2: 1, 3: 1 }, sewNeed, sewOk: sewOkArr, rng: s.rng,']], ['M1a', 'M1b', 'M2a']],
  ['合併不看接管（sewNeed 給 false）', [['cityHappy, dem, sewNeed, sewOk: sewOkArr, rng: s.rng,', 'cityHappy, dem, sewNeed: false, sewOk: sewOkArr, rng: s.rng,']], ['M1a', 'M1b', 'M1c']],
  ['合併拿全 0 的接管', [['cityHappy, dem, sewNeed, sewOk: sewOkArr, rng: s.rng,', 'cityHappy, dem, sewNeed, sewOk: new Uint8Array(nn), rng: s.rng,']], ['M1b', 'M2a']],
  ['吸收的公園不撤覆蓋印', [["unstampPark: (x, y) => stampCov(g, s.budget, 'park', x, y, COVR.park, -1),", 'unstampPark: () => {},']], ['M2a', 'M2b', 'M2c']],
  ['公園覆蓋印撤了兩次', [["unstampPark: (x, y) => stampCov(g, s.budget, 'park', x, y, COVR.park, -1),", "unstampPark: (x, y) => { stampCov(g, s.budget, 'park', x, y, COVR.park, -1); stampCov(g, s.budget, 'park', x, y, COVR.park, -1); },"]], ['M2a', 'M2b', 'M2c']],
  ['回報不帶合併', [['merges: mgs,', 'merges: [],']], ['M1b', 'M2a']],
  ['城市模型不同步合併', [['ups, mgs);', 'ups);']], ['M1b', 'M2a']],
  ['被吸收的建築屋齡不記', [['cb.age = m.ages[q]; cb.goneDay = s.day;', 'cb.goneDay = s.day;']], ['M1b', 'M2a']],
  ['巨廈不清城市模型的分區', [['if (m.clearedZone) c.zone[j] = 0;', '']], ['M2a', 'M2b']],
];
async function wiringGuards(log, { lab, runs, compare34, simOf, KT, vrank }) {
  const codeOf = id => runs.find(c => c.id === id).code, recOf = id => lab.runs[id];
  // 模擬那一半的突變用逐日逐欄比（會紅在欄位上）；城市模型那一半（同步、屋齡、分區）用歷史守衛的重播與格子一致檢查抓
  const diffOn = (mod, ids) => ids.map(id => ({ id, d: compare34(mod, codeOf(id), recOf(id), { stopAtFirst: true }).d })).filter(x => x.d.length);
  const modelSide = new Set(['城市模型不同步合併', '被吸收的建築屋齡不記', '巨廈不清城市模型的分區']);
  const bad = [], out = [];
  const simIds = [...new Set(WIRING.filter(m => !modelSide.has(m[0])).flatMap(m => m[2]))];
  const base = diffOn(await dayVariant([]), simIds);
  if (base.length) bad.push(`沒改的副本就有不對：${base.slice(0, 3).map(x => `${x.id} ${x.d[0].slice(0, 80)}`).join('｜')}`);
  for (const [name, edits, ids] of WIRING) {
    let V; try { V = await dayVariant(edits); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    if (modelSide.has(name)) {
      // 城市模型：重播與格子一致檢查要紅（在歷史守衛的函式上跑改壞的副本）
      const hit = ids.filter(id => historyProblems(V, runs.find(c => c.id === id).code, KT, vrank).length);
      out.push(`${name}：${hit.length ? hit.join('、') : '沒抓到'}`);
      if (!hit.length) bad.push(`「${name}」沒抓到（${ids.join('、')}）`);
    } else {
      const hit = diffOn(V, ids);
      out.push(`${name}：${hit.length ? hit.map(x => x.id).join('、') : '沒抓到'}`);
      if (!hit.length) bad.push(`「${name}」沒抓到（${ids.join('、')}）`);
    }
  }
  log(!bad.length, `D034 驗收 5：接線——day.ts 的副本改壞一處（${WIRING.length} 個：幸福閘門永遠過／永遠不過、需求永遠夠、不看接管、不撤公園覆蓋印、撤兩次、回報不帶合併、城市模型不同步／屋齡不記／不清分區）都要紅；沒改的先核過全等`,
    bad.slice(0, 4).join('｜') || out.join('；'));
}

// ---- 5. 歷史、重播與存檔 ----
// 一座城推 13 天之後的問題清單：重播＝模擬的城市、城市模型跟格子一致、存→讀→再存、格式
function historyProblems(mod, code, KT, vrank) {
  const bad = [], s = mod.simFromSave(decodeLabCode(code).save, code, KT, vrank);
  for (let d = 0; d < MERGE_DAYS; d++) mod.stepDay(s);
  const rd = replayDiff(s, code, KT); if (rd) bad.push(rd);
  for (const x of cityVsWorld(s).slice(0, 3)) bad.push('城市模型≠格子：' + x);
  return bad;
}
async function historyGuards(log, { runs, KT, vrank }) {
  const bad = [], info = [];
  let withMerge = 0, fmt7 = 0, noMergeFmtOk = 0, noMergeCities = 0, absorbed = 0;
  for (const c of runs) {
    const probs = historyProblems(realDay, c.code, KT, vrank);
    if (probs.length) { bad.push(`${c.id}：${probs[0].slice(0, 160)}`); continue; }
    const L = loadCode(c.code, KT, vrank), s = L.sim;
    for (let d = 0; d < MERGE_DAYS; d++) realDay.stepDay(s);
    const merges = s.city.history.filter(e => e.t === 'merge'), maxOther = Math.max(4, ...s.city.history.filter(e => e.t !== 'merge').map(eventFormat));
    const code1 = saveCode(s, L.template, L.start), d1 = decodeLabCode(code1);
    if (!d1.ok) { bad.push(`${c.id}：存檔解不開 ${d1.error}`); continue; }
    const f = d1.save.raw.d3?.f;
    if (merges.length) { withMerge++; absorbed += merges.reduce((a, m) => a + m.from.length, 0); if (f === 7) fmt7++; else bad.push(`${c.id}：有 ${merges.length} 筆合併、存檔格式是 ${f}（要 7）`); }
    else { noMergeCities++; if (f === maxOther) noMergeFmtOk++; else bad.push(`${c.id}：沒有合併、存檔格式 ${f}（要 ${maxOther}，跟其餘事件的最大格式一樣）`); }
    if (historyFormat(s.city.history) !== (merges.length ? 7 : maxOther)) bad.push(`${c.id}：historyFormat ${historyFormat(s.city.history)}`);
    // 存→讀→再存：歷史（不含讀檔重挑的 restyle）與格子一致
    const L2 = loadCode(code1, KT, vrank);
    if (!L2.ok) { bad.push(`${c.id}：存檔讀不回 ${L2.error}`); continue; }
    const h1 = s.city.history.filter(e => e.t !== 'restyle'), h2 = L2.sim.city.history.filter(e => e.t !== 'restyle');
    if (J(h1) !== J(h2)) bad.push(`${c.id}：存→讀之後歷史不同（${h1.length}／${h2.length} 筆）`);
    if (shapeHash(s.w) !== shapeHash(L2.sim.w)) bad.push(`${c.id}：存→讀之後格子上的建築（種類、等級、邊長、分區）不同`);
    const vw = cityVsWorld(L2.sim); if (vw.length) bad.push(`${c.id}：讀回來城市模型≠格子：${vw[0]}`);
    if (merges.length) info.push(`${c.id} ${merges.length} 筆`);
  }
  if (!(withMerge >= 6)) bad.push(`有合併的 M 城只有 ${withMerge} 座（要 ≥ 6）`);
  if (!noMergeCities) bad.push('沒有「沒合併」的 M 城（拿來核格式不變）');
  // 壞的合併事件要被擋：列（hv 2）與事件物件（hv 1）的欄位驗證，重播對不上也丟例外
  {
    const n = 72, ok = unpackHistory([[17, 3, 5, 6, 33, 2, 1, 2, 3, 4], [17, 0, 20, 21, 105, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]], n);
    if (!(ok[0].t === 'merge' && ok[0].size === 2 && J(ok[0].from) === '[1,2,3,4]' && ok[1].size === 3 && ok[1].from.length === 9 && ok[1].day === 3)) bad.push(`合法的合併列讀錯了：${J(ok)}`);
    const badRows = { '沒有吸收的建築': [17, 3, 5, 6, 33, 2], '種類不是塔或巨廈': [17, 3, 5, 6, 35, 2, 1, 2, 3, 4], '吸收的編號 0': [17, 3, 5, 6, 33, 2, 0, 2, 3, 4], '吸收超過 9 棟': [17, 3, 5, 6, 105, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], '編號不是整數': [17, 3, 5, 6, 33, 2, 1.5, 2, 3, 4], '座標出圖': [17, 3, 72, 6, 33, 2, 1, 2, 3, 4] };
    for (const [what, row] of Object.entries(badRows)) { let threw = false; try { unpackHistory([row], n); } catch { threw = true; } if (!threw) bad.push(`壞的合併列（${what}）沒被擋`); }
    let threw = false; try { checkHistory([{ day: 1, t: 'merge', x: 5, z: 6, k: 33, size: 3, v: 0, from: [1, 2, 3, 4] }], n); } catch { threw = true; } if (!threw) bad.push('hv 1 的合併事件邊長跟種類對不上沒被擋');
    const c = runs.find(q => q.id === 'M2b'), L = loadCode(c.code, KT, vrank), s2 = L.sim;
    for (let d = 0; d < MERGE_DAYS; d++) realDay.stepDay(s2);
    const hist = s2.city.history, mi = hist.findIndex(e => e.t === 'merge');
    const tampered = [
      ['吸收的建築編號不存在', hist.map((e, i) => i === mi ? { ...e, from: [9999, ...e.from.slice(1)] } : e)],
      ['合併的邊長不對', hist.map((e, i) => i === mi ? { ...e, size: e.size === 3 ? 2 : 3 } : e)],
      ['同一棟被吸收兩次', hist.map((e, i) => i === mi ? { ...e, from: [e.from[0], e.from[0], ...e.from.slice(2)] } : e)],
    ];
    for (const [what, h] of tampered) { let t2 = false; try { replayCity(c.code, h, KT, s2.day); } catch { t2 = true; } if (!t2) bad.push(`重播沒擋下：${what}`); }
  }
  // 舊格式與新格式：比 7 新的拒絕
  {
    const c = runs.find(q => q.id === 'M2b'), L = loadCode(c.code, KT, vrank), s = L.sim;
    for (let d = 0; d < MERGE_DAYS; d++) realDay.stepDay(s);
    const code = saveCode(s, L.template, L.start), d = decodeLabCode(code), raw = JSON.parse(J(d.save.raw));
    raw.d3 = { ...raw.d3, f: CITY_FORMAT + 1 };
    const tooNew = loadCode(encodeLab(raw), KT, vrank);
    if (tooNew.ok && tooNew.sim.city.history.some(e => e.t === 'merge')) bad.push('比這一版新的格式（8）還在用歷史');
  }
  log(!bad.length, 'D034 驗收 6：歷史與存檔——每座 M 城推 13 天之後，replayCity 重播＝模擬走出來的城市（建築清單含墓碑與屋齡、occ、分區）、城市模型跟格子一致；有合併的存檔格式是 7、沒有合併的城跟其餘事件的最大格式一樣；存→讀歷史與格子一致；壞的合併列與事件、對不上的重播都被擋；比 7 新的格式不猜',
    bad.slice(0, 4).join('｜') || `${runs.length} 座都過：有合併 ${withMerge} 座（格式 7：${fmt7}；吸收了 ${absorbed} 棟）、沒合併 ${noMergeCities} 座（格式不變：${noMergeFmtOk}）：${info.join('、')}`);
}
import { encodeLabCode } from '../src/io/labcode.ts';
const encodeLab = raw => encodeLabCode(raw, { deflate: true });

// D032 Node 守衛（二）：政策與預算的實驗線頁面實跑（驗收 3）、玩家按按鈕（驗收 3、6）、接線（驗收 5）、存檔與決定性（驗收 6）。由 tools/unit.mjs 呼叫；vm 逐項與突變（驗收 1、2）在 tools/unit-d032.mjs；瀏覽器半邊在 tools/smoke-d032.mjs。
//   1. 樣本 src/content/samples/d032-lab.json（tools/d032-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀：實驗線版本、回退設定、探針原文、每一筆的碼雜湊（＝本線現在產生的）、天數、動作；
//   2. runs：底城 × 政策組（政策寫在存檔的 pol，本線 simFromSave 自己讀、自己算，**不代入任何政策**），連推 10／13 天，每天跟實驗線逐欄比——D028 的全部欄位（資金不取整、淨額、三項稅、十二個收入項、食物、遊客、旅宿、
//      每一棟住宅的幸福 64 位元浮點逐位、幸福構成 57 項、夜間城市、人口、就業、下一個亂數）加這一張的五欄（焦土格數、有電的棟數、三種需求、垃圾量與容量與比例、教育場 EDU 雜湊）；**資金也判**；
//      讀檔那一刻：政策（補齊之後逐欄含順序）、教育場 EDU 雜湊（營養午餐的讀檔怪癖：存檔裡開著，讀進來的教育場是沒加午餐的）、服務預算；
//   3. play：玩家在遊戲中按按鈕（政策勾選、稅率＋／−、服務預算）——實驗線頁面用自己的 policyApply504（玩家路徑）、polStep、setSvcBudget 按，本線用 setPolicy／setBudget 按，每個動作的回傳值、按完的政策與 EDU 雜湊與預算、之後每一天逐欄比；
//   4. rt：本線自己玩一段、存檔，實驗線用 GV.importCode 讀本線存的碼再推 2 天——實驗線讀得進本線存的 pol，讀進來的政策與之後的數字跟本線一樣；
//   5. 效果要看得到：每個本線有效果的政策、每條稅率，在實驗線樣本裡至少有一座城「開」跟「關」（對照組）的差大於 0；
//   6. 接線：day.ts 的副本改壞一處要紅（讀檔不收 pol、讀檔順序反過來、edu.schoolLunch 不跟、幸福／災禍／夜間城市不讀政策、稅收乘數不讀、法規日費不讀、recycleMul、indSubsidy、ecoReg、taxR、緊急儲備、保險理賠、雜湊不看 pol……）；
//   7. 存檔與決定性：pol 寫得出來、讀得回來；沒動政策的城存檔位元組不變；套用政策後存、讀、再存逐位元組相同；讀檔擋非物件；沒有新欄位以外的改動、沒有新事件、城市格式不動；同一張碼讀兩次每天雜湊相同。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { hashBytes } from '../src/sim/rules/commute.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import { ensurePol } from '../src/sim/rules/policy.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { setPolicy, setBudget } from '../src/sim/edit.ts';
import { loadMod } from './unit-d024.mjs';
import { dayVariant } from './unit-d021.mjs';
import { injectInputs } from './unit-d027-live.mjs';
import { rowOf28 } from './unit-d028-live.mjs';
import { INC_KEYS } from './d028-lab.mjs';
import { PROBE, applyAct } from './d032-lab.mjs';
import { d032Runs, d032Play, GROUPS, SHOWN11 } from './d032-cities.mjs';
import { d032Rt } from './d032-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城
export async function d032LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D032 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 本線這一天結束時的樣子：D028 的 rowOf28 加這一張的五欄（跟樣本的 row 同名同形）
export function rowOf32(s, rep) {
  const r = rowOf28(s, rep);
  let rn = 0, np = 0;
  for (const t of s.w.tiles) { if (t.ruin) rn++; const b = t.bld; if (b && !b.ref && (b.k <= 3 || b.k === 127) && b.pw) np++; }
  r.rn = rn; r.np = np; r.dm = [rep.dem[0], rep.dem[1], rep.dem[2]]; r.gb = [rep.garb.amount, rep.garb.cap, rep.garb.ratio]; r.ed = hashBytes(s.g.EDU);
  return r;
}
const labNc = row => [row.night.ready, row.night.score, row.night.hd, row.ng, row.un[3], row.uu[3]];   // 樣本裡對應 nc 的六個值（同 D028）
const FIELDS = ['day', 'pop', 'jobs', 'happy', 'money', 'net', 'tx', 'inc', 'ch', 'fd', 'tr', 'ho', 'nc', 'nh', 'hh', 'ah', 'peek', 'rn', 'np', 'dm', 'gb', 'ed'];
const NAMES = { day: '日', pop: '人口', jobs: '就業', happy: '城市幸福', money: '資金', net: '淨額（收入−維護費）', tx: '稅 R／C／I', inc: '其餘收入十二項', ch: 'T346 鏈條九欄', fd: '食物點數', tr: '遊客', ho: '旅宿床位與入住', nc: '夜間城市六欄', nh: '住宅棟數', hh: '每一棟住宅的幸福',
  ah: '幸福構成 57 項的雜湊', peek: '下一個亂數（亂數次數或順序不同）', rn: '焦土格數', np: '有電的住商工棟數', dm: '三種需求', gb: '垃圾量、容量、比例', ed: '教育場 EDU 雜湊' };

// 一座城連推 rec.days 天，逐天跟實驗線比。mod＝day.ts（真的或改壞的）。玩家的動作（rec.acts：{d, a, r}）在「推進第 d 天之前」按。
// 回 { d: [不同處], days, first, fields, firstFields, parts, acts: 按了幾個動作, actsOk: 其中成功改了狀態的 }
// onDay(day, mine, row, rep, sim)：每天比完之後呼叫
export function compareCity32(mod, code, rec, KT, vrank, { stopAtFirst = true, onDay, fns } = {}) {
  const r = decodeLabCode(code), s = mod.simFromSave(r.save, code, KT, vrank), d = [], out = { d, days: 0, first: 0, fields: [], firstFields: [], parts: [], acts: 0, actsOk: 0 };
  // 讀檔那一刻：政策（兩邊都補齊再比——實驗線讀檔之後不久 pol 就是補齊的物件，本線留著讀進來的樣子，行為一樣）、教育場（營養午餐的讀檔怪癖）、服務預算
  const st0 = [];
  if (J(ensurePol(s.pol)) !== rec.start.pol) st0.push(`政策 本線 ${J(ensurePol(s.pol)).slice(0, 70)} ≠ 實驗線 ${String(rec.start.pol).slice(0, 70)}`);
  if (hashBytes(s.g.EDU) !== rec.start.ed) st0.push(`教育場 EDU 雜湊 本線 ${hashBytes(s.g.EDU)} ≠ 實驗線 ${rec.start.ed}（營養午餐的讀檔順序）`);
  if (J(s.budget) !== rec.start.sb) st0.push(`服務預算 本線 ${J(s.budget)} ≠ 實驗線 ${rec.start.sb}`);
  if (st0.length) return { ...out, d: [`讀檔：${st0.join('；')}`], first: 1 };
  let prev = rec.start;
  const st = { pol: rec.start.pol, tech: rec.start.tech, spec: rec.start.spec };   // 政策、科技、專精：樣本裡跟前一列一樣的不存（tools/d027-lab.mjs compactRows），往前找最近一次記的
  for (let day = 1; day <= rec.days; day++) {
    const row = rec.rows[day - 1], dd = [], ff = [];
    for (const x of (rec.acts ?? []).filter(q => q.d === day)) {   // 這一天推進之前的玩家動作
      const ok = applyAct(s, x.a, fns); out.acts++; if (ok === true) out.actsOk++;
      const bad = [];
      if (x.a.bud ? false : ok !== x.r.ok) bad.push(`回傳 本線 ${ok} ≠ 實驗線 ${x.r.ok}`);
      if (J(ensurePol(s.pol)) !== x.r.pol) bad.push(`按完的政策 本線 ${J(ensurePol(s.pol)).slice(0, 60)} ≠ 實驗線 ${String(x.r.pol).slice(0, 60)}`);
      if (hashBytes(s.g.EDU) !== x.r.ed) bad.push(`按完的 EDU 雜湊 本線 ${hashBytes(s.g.EDU)} ≠ 實驗線 ${x.r.ed}`);
      if (J(s.budget) !== x.r.sb) bad.push(`按完的預算 本線 ${J(s.budget)} ≠ 實驗線 ${x.r.sb}`);
      if (s.day !== x.r.day) bad.push(`按的時候是第 ${s.day} 天 ≠ 實驗線 ${x.r.day}`);
      if (bad.length) { d.push(`第 ${day} 天推進之前按 ${J(x.a)}：${bad.join('；')}`); if (!out.first) out.first = day; if (stopAtFirst) return out; }
    }
    const inj = injectInputs(s, st, prev, row, false);   // 只把科技寫進 s.edu.tech（全是 []）；政策不代（本線自己讀存檔裡的 pol）
    if (inj.err) return { ...out, d: [inj.err], days: day, first: day };
    const class2 = {   // 本線還沒搬的：地鐵、公車、停車的收入與營運費、三種車隊的維護費——樣本裡的值（跟 D028 同一份）
      other: { metroRev: row.un[0], metroAds: row.un[1], transitRev: row.un[2], parkingRevenue491: row.un[4] },
      upkeep: { metroCost: row.uu[0], railOpsCost463: row.uu[1], busOpsCost468: row.uu[2], svcFleet: { fire: row.uu[4], police: row.uu[5], amb: row.uu[6] } },
    };
    const rep = mod.stepDay(s, { class2 });
    const mine = rowOf32(s, rep);
    for (const k of FIELDS) {
      const lv = k === 'nc' ? labNc(row) : row[k];
      if (J(mine[k]) !== J(lv)) { dd.push(`${NAMES[k]} 本線 ${J(mine[k])} ≠ 實驗線 ${J(lv)}`); ff.push(k); }
    }
    for (const k of ['pol', 'tech', 'spec']) if (row[k] !== undefined) st[k] = row[k];
    if (J(ensurePol(s.pol)) !== st.pol) { dd.push(`政策 本線 ${J(ensurePol(s.pol)).slice(0, 60)} ≠ 實驗線 ${String(st.pol).slice(0, 60)}`); ff.push('pol'); }
    for (const k of ff) if (!out.fields.includes(k)) out.fields.push(k);
    onDay?.(day, mine, row, rep, s);
    prev = row; out.days = day;
    if (dd.length) { d.push(`第 ${day} 天：${dd.slice(0, 4).join('；')}`); if (!out.first) { out.first = day; out.firstFields = ff; } if (stopAtFirst) return out; }
  }
  return out;
}

async function guards(log) {
  const lab = JSON.parse(read(process.env.D032_SAMPLE ?? 'src/content/samples/d032-lab.json')), runs = d032Runs(), play = d032Play(), rt = d032Rt();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, runs, play, rt, KT, vrank });

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (lab.source?.probe !== PROBE) bad.push('樣本的探針原文 ≠ tools/d032-lab.mjs 現在的探針（重跑 tools/d032-lab.mjs）');
    for (const [key, list, ord] of [['runs', runs, 'order'], ['play', play, 'playOrder'], ['rt', rt, 'rtOrder']]) {
      if (J(lab[ord]) !== J(list.map(c => c.id))) bad.push(`樣本的 ${key} 順序 ≠ 現在的順序（重跑 tools/d032-lab.mjs --part=${key}）`);
      for (const c of list) {
        const L = lab[key]?.[c.id];
        if (!L) { bad.push(`${key} ${c.id}：沒有記錄`); continue; }
        if (L.codeHash !== fnv1a(c.code)) bad.push(`${key} ${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d032-lab.mjs --part=${key}）`);
        if (L.rows.length !== c.days || L.days !== c.days) bad.push(`${key} ${c.id}：記了 ${L.rows.length} 天，要 ${c.days} 天`);
        if (key === 'play' && J(L.acts?.map(x => x.a)) !== J(c.acts.slice().sort((p, q) => p.day - q.day))) bad.push(`play ${c.id}：動作跟樣本裡的不同（樣本記的是實際按的順序：日子由小到大、同一天照表的順序）`);
        if (!L.start || L.start.ed == null || L.start.sb == null) bad.push(`${key} ${c.id}：start 少了 EDU 雜湊或預算`);
      }
    }
    log(!bad.length, `D032 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；底城 × 政策組 ${runs.length} 筆（政策寫在存檔的 pol：實驗線讀檔＝玩家讀一張有政策的存檔）、玩家按按鈕 ${play.length} 筆、本線存的碼給實驗線讀 ${rt.length} 筆；探針原文與碼雜湊＝本線現在的`,
      bad.slice(0, 4).join('；') || `runs ${Object.keys(lab.runs).length}、play ${Object.keys(lab.play).length}、rt ${Object.keys(lab.rt).length}，錄了 ${lab.seconds} 秒`);
    if (bad.length) return;
  }

  // ---- 2. 逐天對拍：runs、play、rt（政策不代入、資金也判）----
  const runSet = (mod, list, key, opts) => list.map(c => ({ id: c.id, ...compareCity32(mod, c.code, lab[key][c.id], KT, vrank, opts) }));
  const R = runSet(realDay, runs, 'runs', { stopAtFirst: false }), PL = runSet(realDay, play, 'play', { stopAtFirst: false }), RT = runSet(realDay, rt, 'rt', { stopAtFirst: false });
  Object.assign(LIVE, { R, PL, RT });
  const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
  {
    const errs = R.filter(x => x.d.length).map(x => `${x.id} ${x.d[0]}`);
    log(!errs.length, `D032 驗收 3：底城 × 政策組 ${R.length} 筆連推 10／13 天，政策由存檔的 pol 讀進來、不代入，每天跟實驗線逐欄比——D028 的全部欄位（資金不取整、淨額、三項稅、十二個收入項、食物、遊客、旅宿、每一棟住宅的幸福 64 位元浮點逐位、幸福構成 57 項、夜間城市、人口、就業、下一個亂數）加焦土格數、有電棟數、三種需求、垃圾量與容量與比例、教育場 EDU 雜湊；讀檔那一刻的政策、EDU 雜湊、服務預算也比；資金也判`,
      errs.slice(0, 4).join('｜') || `${R.length} 筆、${sum(R, x => x.days).toLocaleString()} 個城日每一欄全等（資金判了全部）`);
    const pe = PL.filter(x => x.d.length).map(x => `${x.id} ${x.d[0]}`);
    log(!pe.length, `D032 驗收 3、6：玩家在遊戲中按按鈕 ${PL.length} 筆（政策勾選、稅率＋／−、服務預算；實驗線頁面用自己的 policyApply504 玩家路徑、polStep、setSvcBudget，本線用 setPolicy／setBudget）：每個動作的回傳值、按完的政策與 EDU 雜湊與預算、之後每一天逐欄比；冷卻擋下的、同值不動的、夾到頭的、不認得的類別都在裡面`,
      pe.slice(0, 4).join('｜') || `${PL.length} 筆、${sum(PL, x => x.acts)} 個動作（改了狀態的 ${sum(PL, x => x.actsOk)}）、${sum(PL, x => x.days)} 個城日全等`);
    const te = RT.filter(x => x.d.length).map(x => `${x.id} ${x.d[0]}`);
    log(!te.length, `D032 驗收 6（實驗線讀本線存的碼）：本線自己玩一段（${rt.map(c => c.id).join('、')}）、存檔，實驗線用它自己的 GV.importCode 讀、再推 2 天——讀進來的政策、EDU 雜湊、預算與之後每天的欄位跟本線逐位相等`,
      te.slice(0, 4).join('｜') || `${RT.length} 筆全等（碼雜湊＝樣本錄的；本線存檔決定性）`);
    if (errs.length || pe.length || te.length) return;
  }

  // ---- 3. 效果要看得到：每個本線有效果的開關、每條稅率，在實驗線樣本裡跟對照組（沒有 pol 的存檔）至少有一座城的差大於 0 ----
  const eff = effectMatrix(lab, runs); Object.assign(LIVE, { eff });
  {
    const lacking = [];
    for (const k of SHOWN11) if (!NO_EFFECT_OK[k] && k !== 'schoolLunch' && !(eff.toggle[k] && Object.keys(eff.toggle[k]).length)) lacking.push(`${k} 在所有城都看不到效果`);
    for (const [k, fields] of Object.entries(WANT_FIELDS)) for (const f of fields) if (!Object.keys(eff.toggle[k] ?? {}).some(x => x.endsWith(':' + f))) lacking.push(`${k} 看不到「${f}」的差`);
    // 營養午餐的教育場（EDU）：存檔裡開著的城，讀進來的教育場是沒加午餐的（實驗線的讀檔順序怪癖）、靜止的 13 天也不會重算——所以靜態的 s-schoolLunch 跟對照組的 EDU 逐天相同（這正是怪癖的證據）；
    // 效果只在玩家按下去（rebuildCov）的那一刻出現：play 裡按營養午餐的那些動作，按完的 EDU 雜湊跟按之前的不同
    const lunchStatic = runs.filter(r => /\/s-schoolLunch$/.test(r.id) && lab.runs[r.id.replace('s-schoolLunch', 'none')]);
    for (const r of lunchStatic) { const a = lab.runs[r.id], b = lab.runs[r.id.replace('s-schoolLunch', 'none')]; if (a.start.ed !== b.start.ed || a.rows.some((x, i) => x.ed !== b.rows[i].ed)) lacking.push(`${r.id} 的 EDU 跟對照組不同（存檔裡開著午餐、讀進來沒重算：本來要逐天相同）`); }
    let lunchPress = 0, lunchMoved = 0;
    for (const c of play) { const L = lab.play[c.id]; let prev = L.start.ed; for (const x of L.acts ?? []) { if (x.a.pol?.[0] === 'schoolLunch' && x.r.ok === true) { lunchPress++; if (x.r.ed !== prev) lunchMoved++; } prev = x.r.ed; } }
    if (!lunchStatic.length || lunchMoved < 3) lacking.push(`營養午餐按下去的 EDU 變化只看到 ${lunchMoved} 次（靜態對照 ${lunchStatic.length} 筆）`);
    for (const t of ['R', 'C', 'I']) for (const v of [.5, .7, 1.5, 2]) if (!eff.tax[`${t}${v}`]) lacking.push(`稅率 ${t}${v} 看不到稅的差`);
    log(!lacking.length, 'D032 驗收 3：效果要看得到——本線有效果的 11 個開關與三條稅率（各 0.5、0.7、1.5、2.0），在實驗線樣本裡至少有一座城「開」跟「關」（對照組）的差大於 0，而且差在它該出現的欄位（資金、稅、有電、焦土、垃圾、需求、EDU、幸福、夜間）',
      lacking.slice(0, 6).join('；') || `${SHOWN11.filter(k => eff.toggle[k] && Object.keys(eff.toggle[k]).length).length}／${SHOWN11.length} 個開關看得到（${Object.entries(eff.toggle).map(([k, v]) => `${k} ${Object.keys(v).length}`).join('、')}）；稅率 ${Object.keys(eff.tax).length}／12 組看得到`);
  }
  await wiringGuards(log, { lab, runs, play, KT, vrank });
  await persistGuards(log, { lab, runs, play, KT, vrank });
}

// 開關與稅率的效果矩陣（只看實驗線樣本）：toggle[k]＝{ '底城:欄位': 差了幾天 }、tax['R0.5']＝差了幾天（稅 R／C／I 那一項）
const FS = { 資金: r => r.money, 稅: r => r.tx, 有電: r => r.np, 焦土: r => r.rn, 垃圾: r => r.gb, 需求: r => r.dm, EDU: r => r.ed, 幸福: r => r.hh, 收入: r => r.inc, 人口: r => r.pop, 夜間: r => r.night };
function effectMatrix(lab, runs) {
  const toggle = {}, tax = {}, diffAt = (a, b, f) => { let n = 0; for (let i = 0; i < a.length; i++) if (J(f(a[i])) !== J(f(b[i]))) n++; return n; };
  for (const k of SHOWN11) toggle[k] = {};
  for (const r of runs) {
    let m = /^(.+)\/s-(.+)$/.exec(r.id);
    if (m && SHOWN11.includes(m[2]) && lab.runs[`${m[1]}/none`]) { const a = lab.runs[r.id].rows, b = lab.runs[`${m[1]}/none`].rows; for (const [fn, f] of Object.entries(FS)) { const n = diffAt(a, b, f); if (n) toggle[m[2]][`${m[1]}:${fn}`] = n; } continue; }
    m = /^(.+)\/stk$/.exec(r.id);
    if (m && lab.runs[`${m[1]}/none`]) { const a = lab.runs[r.id].rows, b = lab.runs[`${m[1]}/none`].rows; for (const [fn, f] of Object.entries(FS)) { const n = diffAt(a, b, f); if (n) toggle.emergencyStockpile492[`${m[1]}:${fn}`] = n; } continue; }
    m = /^(.+)\/t([RCI])-(.+)$/.exec(r.id);
    if (m && lab.runs[`${m[1]}/none`]) { const n = diffAt(lab.runs[r.id].rows, lab.runs[`${m[1]}/none`].rows, x => x.tx['RCI'.indexOf(m[2])]); if (n) tax[`${m[2]}${m[3]}`] = (tax[`${m[2]}${m[3]}`] ?? 0) + n; }
  }
  return { toggle, tax };
}
// 每個開關要在哪些輸出上看得到差（其餘欄位差不差都行）；NO_EFFECT_OK＝整個樣本裡看不到效果也可以的（原因寫在旁邊）
const WANT_FIELDS = { curfew: ['幸福'], recycle: ['垃圾'], ecoReg: ['有電'], indSubsidy: ['需求'], insurance: ['資金'], parkNight: ['幸福'], nightMarket: ['資金'], emergencyStockpile492: ['收入'] };
const NO_EFFECT_OK = {};   // 整個樣本裡看不到效果也可以的開關（目前沒有：11 個都看得到）


// ---- 4. 接線：day.ts／edit.ts 的副本改壞一處要紅（驗收 5）----
// 每個突變：[名字, day.ts 的編輯, 要被哪幾筆抓到（runs 的 id；play 的 id 前面加 play:）]。沒改的副本先核過全等
const WIRING = [
  ['讀檔不收存檔裡的 pol', [['const pol = polOfSave(save.raw.pol);', 'const pol = null;']], ['P4/all', 'P1/all']],
  ['讀檔先設 schoolLunch 再算教育場（怪癖順序反過來）', [['const pol = polOfSave(save.raw.pol);', 'const pol = polOfSave(save.raw.pol); edu.schoolLunch = !!(pol && pol.schoolLunch);']], ['P4/s-schoolLunch', 'K7/s-schoolLunch']],
  ['讀檔後 edu.schoolLunch 不跟 pol（之後重算教育場少了午餐）', [['edu.schoolLunch = !!(pol && pol.schoolLunch);', 'void pol;']], ['play:K7/play2']],
  ['今天的政策恆 null（電力、垃圾、經濟、需求、夜間、幸福都讀不到）', [['pol = hzx.pol ?? null;', 'pol = null;']], ['P4/all', 'P1/s-ecoReg']],
  ['夜間城市不讀政策', [['const nightPol = pol,', 'const nightPol = null,']], ['P4/s-nightMarket']],
  ['住宅幸福不讀政策', [['pol, rankIdx: s.rankIdx,', 'pol: null, rankIdx: s.rankIdx,']], ['P4/s-parkNight', 'P4/s-curfew']],
  ['災禍、夜間、幸福讀的政策只認守衛注入的（不認 Sim.pol）', [['pol = x && x.pol !== undefined ? x.pol : s.pol;', 'pol = x?.pol ?? null;']], ['P4/all']],
  ['電力不讀節能條例', [['computePower(w, !!(pol && pol.ecoReg), false, hvFirst)', 'computePower(w, false, false, hvFirst)']], ['P1/s-ecoReg']],
  ['垃圾不讀回收宣導', [['const recycleMul = recycleMulOf(pol);', 'const recycleMul = 1;']], ['P4/s-recycle']],
  ['經濟不讀政策（購買力的稅率、緊急儲備）', [['(evd ? evd.food : undefined), pol, c: cnt,', '(evd ? evd.food : undefined), c: cnt,']], ['P3/tR-2', 'P4/all']],
  ['需求不讀工業補貼', [['indSubsidy: !!(pol && pol.indSubsidy)', 'indSubsidy: false']], ['P3/s-indSubsidy']],
  ['稅收乘數不讀政策（稅率、觀光、節能、夜市、工業補貼）', [['pm: s.pol, ...e?.mul,', '...e?.mul,']], ['P3/tI-2', 'P3/tR-2', 'P3/tC-2']],
  ['維護費不讀法規日費', [['), pol: s.pol, ...(e ? { imports: e.imports } : {}),', '), ...(e ? { imports: e.imports } : {}),']], ['gallery/hid', 'P4/s-schoolLunch']],
  ['災害保險不理賠', [['for (let k = 0; k < hz.insured; k++) s.money += INSURANCE_PAYOUT;', '']], ['P2/s-insurance']],
  ['災害保險理賠金額錯（+$36）', [['hz.insured; k++) s.money += INSURANCE_PAYOUT;', 'hz.insured; k++) s.money += INSURANCE_PAYOUT + 1;']], ['P2/s-insurance']],
  ['災害保險的投保判斷恆不理賠', [['const insured = insuredOf(x?.pol ?? null) ? fr.burned.length : 0;', 'const insured = 0;']], ['P2/s-insurance']],
];
async function wiringGuards(log, { lab, runs, play, KT, vrank }) {
  const codeOf = id => id.startsWith('play:') ? play.find(c => c.id === id.slice(5)).code : runs.find(c => c.id === id).code, recOf = id => id.startsWith('play:') ? lab.play[id.slice(5)] : lab.runs[id];
  const diffOn = (mod, ids, fns) => ids.map(id => ({ id, d: compareCity32(mod, codeOf(id), recOf(id), KT, vrank, { stopAtFirst: true, fns }).d })).filter(x => x.d.length);
  const bad = [], out = [];
  const allIds = [...new Set(WIRING.flatMap(m => m[2]))];
  const base = diffOn(await dayVariant([]), allIds);
  if (base.length) bad.push(`沒改的副本就有不對：${base.slice(0, 3).map(x => `${x.id} ${x.d[0].slice(0, 80)}`).join('｜')}`);
  for (const [name, edits, ids] of WIRING) {
    let hit;
    try { hit = diffOn(await dayVariant(edits), ids); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    out.push(`${name}：${hit.length ? hit.map(x => x.id).join('、') : '沒抓到'}`);
    if (!hit.length) bad.push(`「${name}」沒抓到（${ids.join('、')}）`);
  }
  // 雜湊：Sim.pol 不同、雜湊要不同；沒有政策的雜湊不變（沒動過政策的城逐位元組不變由黃金樣本守著）
  const hashBad = async edits => {
    const V = await dayVariant(edits), code = runs.find(c => c.id === 'P1/none').code, r = decodeLabCode(code), fresh = () => V.simFromSave(r.save, code, KT, vrank), a = fresh(), b = fresh(), c = fresh();
    b.pol = { ...ensurePol(null), curfew: true }; c.pol = { ...ensurePol(null), taxR: 1.5 };
    const ha = V.simHash(a), hb = V.simHash(b), hc = V.simHash(c), blind = [];
    if (ha === hb) blind.push('有政策跟沒政策一樣'); if (hb === hc) blind.push('兩種政策一樣');
    return blind.length ? blind.join('、') : null;
  };
  const h0 = await hashBad([]); if (h0) bad.push(`沒改的副本雜湊就不對：${h0}`);
  const h1 = await hashBad([['...(s.pol ? [s.pol] : [])', '']]); if (!h1) bad.push('「雜湊不看政策」沒抓到'); else out.push(`雜湊不看政策：${h1}`);
  // economy.ts：政策進經濟的五處（購買力的稅率兩處、緊急物資儲備的糧食／天然氣／商品／燃料四處）——day.ts 用改壞的 economy.ts 副本
  const ECON = [
    ['緊急物資儲備整個讀不到（stock 恆 false）', [['const stock = !!i.pol?.emergencyStockpile492;', 'const stock = false;']], ['G14/stk', 'G9/stk', 'G2/stk', 'G13/stk']],
    ['糧食出口不留儲備', [['foodHold492 = foodHold492Of(stock, fd.need)', 'foodHold492 = 0']], ['G9/stk', 'K4/stk', 'K3/stk', 'K1/stk', 'gallery/stk', 'seed516/stk']],
    ['天然氣出口不留儲備', [['gasHold492Of(stock, gasDem)', '0']], ['P5/stk', 'G14/stk', 'G9/stk', 'K1/stk', 'K3/stk', 'K4/stk', 'G2/stk', 'G4/stk', 'G13/stk', 'gallery/stk', 'seed516/stk']],
    ['商品儲備不乘 1.35', [['* goodsReserveMul492(stock)', '* 1']], ['G2/stk', 'G13/stk', 'G14/stk', 'G9/stk', 'gallery/stk']],
    ['燃料出口不留儲備', [['fuelHoldMul492: fuelHoldMul492(stock)', 'fuelHoldMul492: 1']], ['G14/stk', 'G4/stk', 'G9/stk']],
    ['購買力不讀稅率（上一天的物價那一處）', [['prevCost481, i.pol?.taxR || 1)', 'prevCost481, 1)']], ['P4/all', 'P3/tR-2', 'P3/tR-1.5', 'gallery/tR-2']],
    ['購買力不讀稅率（今天的物價那一處）', [['costOfLiving481, i.pol?.taxR || 1)', 'costOfLiving481, 1)']], ['P4/all', 'P3/tR-2', 'P3/tR-1.5', 'gallery/tR-2']],
  ];
  const econBad = [];
  for (const [name, edits, ids] of ECON) {
    let E2, V; try { E2 = await loadMod('src/sim/rules/economy.ts', edits); V = await dayVariant([], { './rules/economy.ts': E2 }); } catch (e) { bad.push(`economy.ts「${name}」載入失敗 ${e.message.slice(0, 100)}`); continue; }
    const hit = diffOn(V, ids.filter(id => runs.some(c => c.id === id)));
    out.push(`${name}：${hit.length ? hit.map(x => x.id).join('、') : '沒抓到'}`);
    if (!hit.length) econBad.push(name);
  }
  if (econBad.length) bad.push(`economy.ts 的突變沒抓到：${econBad.join('、')}`);
  // edit.ts：玩家按鈕的路徑（setPolicy／setBudget）
  const EDIT = [
    ['按下去不記最後套用的日子（冷卻形同虛設）', [['s.polLast = r.last;', 'void r;']], ['play:P2/play1']],
    ['營養午餐不重算教育場', [['if (r.effects.coverage) { s.edu.schoolLunch = !!r.pol.schoolLunch; recoverCov(s); }', 'void r;']], ['play:K7/play1']],
    ['營養午餐重算了、但 edu.schoolLunch 沒跟著設', [['s.edu.schoolLunch = !!r.pol.schoolLunch; recoverCov(s);', 'recoverCov(s);']], ['play:K7/play1']],
    ['服務預算不換進去', [['s.budget = b; recoverCov(s);', 'recoverCov(s);']], ['play:K7/play1', 'play:P4/play1']],
    ['服務預算換了、覆蓋沒重算', [['s.budget = b; recoverCov(s);', 's.budget = b;']], ['play:K7/play1']],
    ['不認得的預算類別也算成功（回 true）', [['if (b === s.budget) return false;', 'if (b === s.budget) return true;']], []],
  ];
  const editIds = [...new Set(EDIT.flatMap(m => m[2]))];
  for (const [name, edits, ids] of EDIT) {
    let M; try { M = await loadMod('src/sim/edit.ts', edits); } catch (e) { bad.push(`edit.ts「${name}」載入失敗 ${e.message.slice(0, 100)}`); continue; }
    if (!ids.length) { // 不認得的類別的回傳值：直接測
      const V = await dayVariant([]), code = runs.find(c => c.id === 'P4/none').code, s = V.simFromSave(decodeLabCode(code).save, code, KT, vrank), real = await loadMod('src/sim/edit.ts', []);
      const a = M.setBudget(s, 'nope', .1), b = real.setBudget(s, 'nope', .1);
      if (a === b) bad.push(`edit.ts「${name}」沒抓到（不認得的類別回傳值 ${a}）`); else out.push(`${name}：直接測（${b}≠${a}）`);
      continue;
    }
    const hit = diffOn(realDay, ids, M);
    out.push(`${name}：${hit.length ? hit.map(x => x.id).join('、') : '沒抓到'}`);
    if (!hit.length) bad.push(`edit.ts「${name}」沒抓到（${ids.join('、')}）`);
  }
  void editIds;
  log(!bad.length, `D032 驗收 5：接線——day.ts 的副本改壞一處（${WIRING.length + 1} 個：讀檔不收 pol、讀檔順序反過來、edu.schoolLunch 不跟、今天的政策恆空、夜間城市／幸福／電力／垃圾／經濟／需求／稅收乘數／法規日費各自不讀政策、災禍只認注入的、保險三種、雜湊不看 pol）與 edit.ts 的玩家按鈕（${EDIT.length} 個：冷卻不記、教育場不重算、預算不換進去或不重算、不認得的類別回傳值）：每一個都要被實驗線對拍的那幾筆抓到；沒改的先核過全等`,
    bad.slice(0, 5).join('；') || out.join('；'));
}

// ---- 5. 存檔與決定性（驗收 6）----
async function persistGuards(log, { lab, runs, play, KT, vrank }) {
  const bad = [], seen = { loads: 0, trips: 0, days: 0, muts: 0 };
  const rawOf = (sm, L) => decodeLabCode(saveCode(sm, L.template, L.start)).save.raw, byId = id => runs.find(c => c.id === id).code;
  const ADDED = new Set(['pol', 'sb', 'rk', 'cev', 'fuel364', 'steel364', 'shipCount', 'shipProgress']);
  // 1. 有政策的城：讀進來的 pol 原樣寫得回去、存了再讀再存逐位元組相同
  for (const id of ['P4/all', 'P1/s-ecoReg', 'P2/s-insurance', 'ai120/none']) {
    const L = loadCode(byId(id), KT, vrank); if (!L.ok) { bad.push(`${id}：讀不進 ${L.error}`); continue; }
    seen.loads++; const sm = L.sim, raw0 = rawOf(sm, L), orig = decodeLabCode(byId(id)).save.raw.pol;
    if (J(raw0.pol) !== J(orig)) bad.push(`${id} 剛讀進來就存的 pol ≠ 存檔裡的（逐欄含順序）：${J(raw0.pol)?.slice(0, 60)}`);
    for (let d = 0; d < 3; d++) { realDay.stepDay(sm); seen.days++; }
    const code = saveCode(sm, L.template, L.start), raw = decodeLabCode(code).save.raw;
    if (J(raw.pol) !== J(orig)) bad.push(`${id} 推 3 天後存的 pol 變了`);
    const extra = Object.keys(raw).filter(k => !(k in raw0) && !ADDED.has(k)), gone = Object.keys(raw0).filter(k => !(k in raw));
    if (extra.length || gone.length) bad.push(`${id} 存檔欄位跟剛讀進來就存的不同：多 ${extra.join('、') || '無'}、少 ${gone.join('、') || '無'}`);
    const q = loadCode(code, KT, vrank); if (!q.ok) { bad.push(`${id} 存了再讀失敗：${q.error}`); continue; }
    if (J(q.sim.pol) !== J(sm.pol)) bad.push(`${id} 讀回來的 pol ≠ 存的`);
    const raw2 = decodeLabCode(saveCode(q.sim, q.template, q.start)).save.raw;   // 讀檔最後一步照實驗線重挑住商工的外觀（D012：每次讀檔都挑、記 restyle 事件），所以整張碼不會逐位元組相同；政策與預算與等級要原樣
    if (J(raw2.pol) !== J(raw.pol) || J(raw2.sb) !== J(raw.sb) || raw2.rk !== raw.rk) bad.push(`${id} 存→讀→再存的 pol／sb／rk 不同`);
    seen.trips++;
  }
  // 2. 沒有 pol 的城：範本有 pol:null 就寫 null、沒動政策不多欄位；玩家按了之後寫整個預設物件（29 欄、照目錄順序）並且讀得回來；預算寫成 sb
  {
    const L = loadCode(byId('P1/none'), KT, vrank); seen.loads++;
    const sm = L.sim, hadPol = 'pol' in L.template, raw0 = rawOf(sm, L);
    if (hadPol && raw0.pol !== null) bad.push(`範本有 pol:null、沒動政策，存的 pol 是 ${J(raw0.pol)}（要 null）`);
    if (!hadPol && 'pol' in raw0) bad.push('範本沒有 pol、沒動政策，不該多出 pol 欄位');
    if (J(raw0.sb) !== J(L.template.sb ?? raw0.sb)) bad.push(`沒動預算，存的 sb ${J(raw0.sb)} ≠ 範本 ${J(L.template.sb)}`);
    // 範本裡的怪 sb（字串、null、true、缺鍵）沒動預算就原樣留著（D023 驗收 3 的規矩）；動了預算才寫整組
    const oddSb = { police: '0.9', fire: null, health: true }, rawOdd = { ...decodeLabCode(byId('P1/none')).save.raw, sb: oddSb }, codeOdd = encodeLabCode(rawOdd, { deflate: true }), LO = loadCode(codeOdd, KT, vrank);
    if (!LO.ok) bad.push(`怪 sb 的城讀不進 ${LO.error}`); else if (J(rawOf(LO.sim, LO).sb) !== J(oddSb)) bad.push(`範本的怪 sb 沒動預算卻被改了：${J(rawOf(LO.sim, LO).sb)}（要原樣 ${J(oddSb)}）`);
    const s1 = loadCode(byId('P1/none'), KT, vrank).sim, h0 = s1.city.history.length;
    const r1 = setPolicy(s1, 'curfew', true), r2 = setPolicy(s1, 'curfew', false), r3 = setBudget(s1, 'edu', .1), r4 = setBudget(s1, 'nope', .1);
    if (!r1.ok || r2.ok || !r3 || r4) bad.push(`按鈕的回傳值不對：開宵禁 ${r1.ok}、馬上關（冷卻）${r2.ok}、預算＋${r3}、不認得的類別 ${r4}`);
    if (s1.city.history.length !== h0) bad.push('政策與預算不該寫世界歷史（不加事件種類）');
    realDay.stepDay(s1); seen.days++;
    const code = saveCode(s1, L.template, L.start), raw = decodeLabCode(code).save.raw;
    if (J(Object.keys(raw.pol ?? {})) !== J(Object.keys(ensurePol(null))) || raw.pol.curfew !== true) bad.push(`按了之後存的 pol 不是整個預設物件（curfew 開）：${J(raw.pol)?.slice(0, 80)}`);
    if (J(raw.sb) !== J({ police: 1, fire: 1, health: 1, edu: 1.1 })) bad.push(`預算 edu＋0.1 之後存的 sb ${J(raw.sb)}`);
    const q = loadCode(code, KT, vrank); if (!q.ok || J(q.sim.pol) !== J(s1.pol) || J(q.sim.budget) !== J(s1.budget)) bad.push('按了之後存→讀：政策或預算沒還原');
    else if (J(q.sim.polLast) !== '{}') bad.push(`冷卻不該存（讀回來的 polLast ${J(q.sim.polLast)}）`);
    seen.trips++;
  }
  // 3. 讀檔擋非物件（唯一跟實驗線不同）：字串、數字、陣列、true → 當沒有政策、存回去是 null；空物件照收
  {
    const r0 = decodeLabCode(byId('P1/none')).save.raw;
    for (const [what, v, isNull] of [['字串', 'x', true], ['數字', 7, true], ['陣列', [1], true], ['true', true, true], ['空陣列', [], true], ['空物件', {}, false]]) {
      const code = encodeLabCode({ ...r0, pol: v }, { deflate: true }), L = loadCode(code, KT, vrank); if (!L.ok) { bad.push(`pol＝${what}：讀不進 ${L.error}`); continue; }
      seen.loads++; if ((L.sim.pol === null) !== isNull) bad.push(`pol＝${what}：讀進來是 ${J(L.sim.pol)}（${isNull ? '要當沒有政策' : '要照收'}）`);
      realDay.stepDay(L.sim); seen.days++;   // 不丟例外（實驗線這裡下一天 pol.taxR.toFixed 會丟）
      const back = decodeLabCode(saveCode(L.sim, L.template, L.start)).save.raw.pol; if (isNull ? back !== null : J(back) !== J(v)) bad.push(`pol＝${what}：存回去是 ${J(back)}`);
    }
  }
  // 4. 決定性：同一張碼、同一串玩家動作，每天雜湊相同
  {
    const p = play.find(c => c.id === 'P4/play1'), hashes = () => { const s = loadCode(p.code, KT, vrank).sim, h = []; for (let d = 1; d <= p.days; d++) { for (const a of p.acts.filter(x => x.day === d)) applyAct(s, a); realDay.stepDay(s); h.push(realDay.simHash(s)); } return h; };
    const a = hashes(), b = hashes(); seen.days += a.length * 2; if (J(a) !== J(b)) bad.push('同一張碼、同一串動作，每天雜湊不同');
  }
  // 5. save.ts 改壞要紅
  const MUT = [
    ['有政策不寫 pol', [['if (s.pol) o.pol = s.pol; else if', 'if (false) o.pol = s.pol; else if']]], ['範本有 pol 欄位、現在沒有政策：不寫 null（範本裡的舊值留著）', [["else if ('pol' in template) o.pol = null;", '']]],
    ['預算不寫 sb', [['if (b1.police !== b0.police || b1.fire !== b0.fire || b1.health !== b0.health || b1.edu !== b0.edu) o.sb =', 'if (false) o.sb =']]], ['sb 的鍵順序不是 police、fire、health、edu', [['o.sb = { police: b1.police, fire: b1.fire, health: b1.health, edu: b1.edu };', 'o.sb = { edu: b1.edu, health: b1.health, fire: b1.fire, police: b1.police };']]],
    ['沒動預算也把範本的 sb 改寫成整組', [['const b0 = budgetOfSave(template.sb), b1 = s.budget;', 'const b0 = { police: -1, fire: -1, health: -1, edu: -1 }, b1 = s.budget;']]],
    ['pol 寫成複製（多了欄位）', [['if (s.pol) o.pol = s.pol;', 'if (s.pol) o.pol = { ...s.pol, extra: 1 };']]],
  ];
  const L0 = loadCode(byId('P1/none'), KT, vrank), s0 = L0.sim; setPolicy(s0, 'curfew', true); setBudget(s0, 'edu', .1);
  const good = saveCode(s0, L0.template, L0.start), sNoPol = loadCode(byId('P1/none'), KT, vrank).sim;
  const goodNo = saveCode(sNoPol, { ...L0.template, pol: 'x' }, L0.start);
  const LOdd = loadCode(encodeLabCode({ ...decodeLabCode(byId('P1/none')).save.raw, sb: { police: '0.9', fire: null, health: true } }, { deflate: true }), KT, vrank), sOdd = LOdd.sim, goodOdd = saveCode(sOdd, LOdd.template, LOdd.start);
  for (const [name, edits] of MUT) {
    let M; try { M = await loadMod('src/io/save.ts', edits); } catch (e) { bad.push(`save.ts「${name}」載入失敗 ${e.message.slice(0, 100)}`); continue; }
    const hit = M.saveCode(s0, L0.template, L0.start) !== good || M.saveCode(sNoPol, { ...L0.template, pol: 'x' }, L0.start) !== goodNo || M.saveCode(sOdd, LOdd.template, LOdd.start) !== goodOdd;
    seen.muts++; if (!hit) bad.push(`save.ts「${name}」沒抓到`);
  }
  log(!bad.length, `D032 驗收 6：存檔與決定性——有政策的城（${seen.loads} 次讀檔）pol 原樣寫回、存→讀→再存的 pol／sb／rk 原樣；沒動政策的城不多欄位（範本有 pol:null 就寫 null）；按了之後寫整個預設物件與 sb、讀得回來、冷卻不存；政策與預算不寫世界歷史；讀檔擋非物件（字串、數字、陣列、true 當沒有政策，空物件照收）且推進不丟例外；同一張碼同一串動作每天雜湊相同；save.ts 改壞 ${MUT.length} 個要紅`,
    bad.slice(0, 5).join('；') || `${seen.trips} 次存讀往返、${seen.days} 個城日、save.ts 突變 ${seen.muts} 個全紅`);
}

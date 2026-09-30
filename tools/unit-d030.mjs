// D030 Node 守衛：城市活動（T299）——事件表、觸發與倒數、讀檔驗證逐項＝實驗線原文（驗收 1、2 的公式半邊，含突變）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d030-events.json（tools/lab-events.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；表 61 條、本線 events.ts 沒有外部網址；
//   2. 逐項＝實驗線：實驗線原文（CITY_EVENTS 表 38131–38193、觸發與倒數 54953–54954、讀檔 66963）在 vm 裡，跟本線 src/sim/rules/events.ts 吃同一批輸入——
//      表 61 條逐欄 Object.is；觸發與倒數：單步隨機（起始狀態＝無／各種事件與剩餘天數、day 是 37 的倍數或旁邊、pop 含剛好 50、51 與半整數）＋整條鏈（每種事件都觸發過一次、逐日連推、
//      隨機人口）＋長鏈；每天的狀態（i、daysLeft）與「開始／結束」的提示字（實驗線 toast 的字）逐位相等；有加成的日子剛好 days 天；讀檔各種形狀逐個相等（實驗線不擋非整數的 i——本線擋掉，是唯一的差，守衛釘住）；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一批（每個門檻與比較符號、兩個鹽、%、倒數、else、表裡每條的每個欄位、讀檔的 || 1），沒改的先核過全等。
//      等價突變不列：day>15（37 的倍數裡只有 0 不大於 15，所以 >15、>=15、>=16、>0 沒差；>=0、>37 才有）、`%CITY_EVENTS.length`（floor(h×61) 永遠 ≤ 60，取餘是空的；改成 %60 才有差）、
//      `typeof c.i !== 'number'`（Number.isInteger 已經擋了字串）。
//   接線、存檔、實驗線頁面實跑：見 tools/unit-d030-live.mjs。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as EV from '../src/sim/rules/events.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const KEY = {
  CITY_EVENTS: 'CITY_EVENTS', cityEventDecl: 'cityEvent', streetHash: 'streetHash', eventTick: '每天的倒數與觸發（day++ 之後、天氣之前）', happyItem: '住宅幸福的城市活動項（當天）', foodMul: '食物點數的事件倍率（當天）',
  taxMul: '收入的事件倍率（當天）', saveCev: '存檔的 cev', loadCev: '讀檔的 cev', reset: '新圖歸零',
};   // text 的鍵 → 樣本 pieces 的名字（照樣本裡的順序）

export async function d030Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D030 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 實驗線那一邊：原文在 vm 裡 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`let day=0,pop=0;
const toasts=[];const toast=(m,k)=>{toasts.push(m)};const sFanfare=()=>{};
${T.CITY_EVENTS}
${T.cityEventDecl}
${T.streetHash}
globalThis.__step=(cur,d,p)=>{cityEvent=cur?{i:cur.i,daysLeft:cur.daysLeft}:null;day=d;pop=p;toasts.length=0;
${T.eventTick}
return {state:cityEvent?{i:cityEvent.i,daysLeft:cityEvent.daysLeft}:null,toasts:[...toasts]};};
globalThis.__load=d=>{
${T.loadCev}
return cityEvent?{i:cityEvent.i,daysLeft:cityEvent.daysLeft}:null;};
globalThis.__table=()=>CITY_EVENTS.map(e=>({...e}));`, ctx, { filename: 'lab:events' });
  return { step: (cur, d, p) => ctx.__step(cur, d, p), load: d => ctx.__load(d), table: () => ctx.__table() };
}
const nul = x => (x === null || x === undefined ? null : x);
const plain = o => JSON.parse(J(o, (k, v) => (v === undefined ? '__undefined' : Number.isNaN(v) ? '__NaN' : v === Infinity ? '__Inf' : v)));   // vm 內的物件跨 realm 比較用
// 兩個值第一個不同的路徑：數字用 Object.is（分得出 0 與 −0、NaN）
const deepDiff = (a, b, p = '') => {
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) ? null : `${p} 實驗線 ${a}≠本線 ${b}`;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const r = deepDiff(a[k], b[k], `${p}.${k}`); if (r) return r; }
    return null;
  }
  return Object.is(a, b) ? null : `${p} 實驗線 ${J(a)}≠本線 ${J(b)}`;
};

// 表：61 條逐欄（連欄位的順序）
function compareTable(T, M) {
  const lab = makeLab(T).table(), mine = M.CITY_EVENTS;
  if (lab.length !== mine.length) return `條數 實驗線 ${lab.length}≠本線 ${mine.length}`;
  for (let i = 0; i < lab.length; i++) {
    if (J(Object.keys(lab[i])) !== J(Object.keys(mine[i]))) return `第 ${i} 條欄位 ${J(Object.keys(lab[i]))}≠${J(Object.keys(mine[i]))}`;
    const d = deepDiff(lab[i], mine[i], `[${i}]`); if (d) return d;
  }
  return '';
}

// 「開始／結束」的提示字：實驗線 toast 的字（54953–54954）↔ 本線 EventStep 的 started／ended
const toastsOf = (M, r) => [...(r.ended >= 0 ? ['🎏 活動結束：' + M.CITY_EVENTS[r.ended].name] : []), ...(r.started >= 0 ? ['✨ ' + M.CITY_EVENTS[r.started].name + '！' + M.CITY_EVENTS[r.started].desc] : [])];

// ---- 輸入：邊界都要碰到 ----
const N_TRIG = 61;
function makeInputs() {
  const R = mulberry32(20263001), int = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[Math.floor(R() * a.length)];
  const single = [];
  const pops = () => pick([0, 1, 49, 50, 50, 50.5, 51, 51, 60, 200, 800, int(0, 800), int(45, 55), -3, 49.999, 50.001]);
  const starts = () => pick([null, null, null, { i: int(0, 60), daysLeft: 1 }, { i: int(0, 60), daysLeft: 2 }, { i: int(0, 60), daysLeft: int(1, 12) }, { i: int(0, 60), daysLeft: 10 }, { i: int(0, 60), daysLeft: 0 }, { i: int(0, 60), daysLeft: -2 }, { i: int(0, 60), daysLeft: 1.5 }]);
  for (let n = 0; n < 24000; n++) {
    const mult = pick([true, true, true, false]), k = int(0, 4000), day = mult ? 37 * k : pick([37 * k + int(-3, 3), int(0, 40), int(0, 3000), 15, 16, 0, 37, 36, 38, 74]);
    single.push({ cur: starts(), day: Math.max(0, day), pop: pops() });
  }
  // 逐日連推：每種事件第一次觸發那天前後各連推 24 天（事件最長 10 天，所以整場都在裡面、也看得到下一次觸發前的空檔）
  const firstDay = new Map();
  for (let k = 1; firstDay.size < N_TRIG && k < 200000; k++) { const i = Math.floor(labHash(37 * k, 7, 888) * N_TRIG) % N_TRIG; if (!firstDay.has(i)) firstDay.set(i, 37 * k); }
  const chains = [...firstDay.values()].sort((a, b) => a - b).map(d => ({ from: d - 5, to: d + 24, pops: () => 200 }));
  // 隨機人口的鏈：人口在 50 上下跳（觸發那天人口不夠就跳過那一場）；一條鏈 3,000 天
  for (let q = 0; q < 6; q++) { const seq = Array.from({ length: 3200 }, (_, d) => (q < 2 ? 200 : pick([0, 30, 49, 50, 51, 52, 60, 400]))); chains.push({ from: 1, to: 3000, pops: d => seq[d] }); }
  // 存檔讀進來的鏈：一開始就在活動裡（剩餘天數 1 到 10），連推 90 天
  for (let q = 0; q < 300; q++) chains.push({ from: int(1, 400), to: 0, len: 90, start: { i: int(0, 60), daysLeft: int(1, 10) }, pops: () => pick([200, 200, 51, 50]) });
  const shapes = [undefined, null, 0, 1, true, false, '', 'x', [], {}, { i: -1 }, { i: -0.5 }, { i: 0 }, { i: 0, d: 5 }, { i: 60, d: 3 }, { i: 61 }, { i: 61, d: 3 }, { i: 100, d: 3 }, { i: '3' }, { i: '3', d: 2 }, { i: 3 }, { i: 3, d: 0 }, { i: 3, d: -2 }, { i: 3, d: '4' },
    { i: 3, d: 2.5 }, { i: 3, d: null }, { i: 3, d: undefined }, { i: 3, d: NaN }, { i: 3, d: true }, { i: 3, d: [7] }, { i: 3, d: '' }, { i: 3, d: 'a' }, { i: 3, d: 9 }, { i: 30, d: 1 }, { i: NaN, d: 3 }, { i: Infinity, d: 3 }, { i: -Infinity, d: 3 }, { i: null, d: 3 }, { i: [3], d: 3 }, { d: 3 }, { i: 3, extra: 1 }];
  for (let i = 0; i < 61; i++) { shapes.push({ i, d: 1 }); shapes.push({ i, d: 10 }); }
  const nonInt = [{ i: 2.5, d: 2 }, { i: 0.5, d: 3 }, { i: 60.5, d: 3 }, { i: 60.999, d: 3 }, { i: 1e-9, d: 3 }];   // 實驗線不擋非整數的 i（下一天讀 CITY_EVENTS[2.5].name 會丟例外）；本線擋掉
  return { single, chains, shapes, nonInt };
}
// 實驗線的 streetHash（給連推的起點用）：從樣本原文取
let labHash = () => 0;

function compareAll(T, M, IN, stopAtFirst = false) {
  const st = { steps: 0, diffs: 0, first: '', cnt: {}, started: new Set() };
  const bump = (k, v = 1) => { if (v) st.cnt[k] = (st.cnt[k] ?? 0) + v; };
  const miss = what => { st.diffs++; if (!st.first) st.first = what; return stopAtFirst; };
  const lab = makeLab(T);
  { const d = compareTable(T, M); if (d && miss(`表 ${d}`)) return st; bump('tableChecked'); }
  const stepBoth = (cur, day, pop, what) => {
    st.steps++;
    const before = J(cur), L = lab.step(cur, day, pop), P = M.eventStep(cur, day, pop);
    if (J(cur) !== before && miss(`${what} 傳進去的狀態被改了 ${before}→${J(cur)}`)) return null;
    if (cur && P.state === cur && miss(`${what} 回傳的狀態跟傳進去的是同一個物件`)) return null;
    const dS = deepDiff(nul(plain(L.state)), nul(P.state), 'state');
    if (dS && miss(`${what}（day ${day}、pop ${pop}、起始 ${before}）${dS}`)) return null;
    const want = L.toasts, got = toastsOf(M, P);
    if (J(want) !== J(got) && miss(`${what}（day ${day}、pop ${pop}、起始 ${before}）提示字 實驗線 ${J(want)}≠本線 ${J(got)}`)) return null;
    if (P.started >= 0 && !(P.state && P.state.i === P.started && P.state.daysLeft === M.CITY_EVENTS[P.started].days) && miss(`${what} 開始那天的狀態不是 {i, days}`)) return null;
    if (P.ended >= 0 && !(cur && cur.i === P.ended && P.state === null) && miss(`${what} 結束的編號不是剛才那場`)) return null;
    // 覆蓋
    const trig = day % 37 === 0;
    if (!cur) {
      bump('noEvent'); bump(trig ? 'noEventTrigDay' : 'noEventOtherDay');
      if (trig && pop > 50 && day > 15) { bump('trigger'); st.started.add(P.started); }
      if (trig && pop > 50 && day <= 15) bump(day === 0 ? 'day0Blocked' : 'dayLe15Blocked');
      if (trig && day > 15 && pop === 50) bump('pop50Blocked'); if (trig && day > 15 && pop === 51) bump('pop51Fires'); if (trig && day > 15 && pop > 50 && pop < 51) bump('popHalfFires'); if (trig && day > 15 && pop < 50) bump('popLowBlocked');
      if (trig && day === 37 && pop > 50) bump('day37Fires'); if (day > 15 && !trig && pop > 50) bump('offDayNoFire'); if (day % 37 === 1 && pop > 50 && day > 15) bump('dayPlus1NoFire'); if (day % 37 === 36 && pop > 50 && day > 15) bump('dayMinus1NoFire');
      if (day === 74 && pop > 50) bump('day74Fires');
    } else {
      bump('active');
      if (P.ended >= 0) { bump('ends'); if (trig && pop > 50 && day > 15) bump('endOnTriggerDay'); }
      else { bump('counts'); if (trig && pop > 50 && day > 15) bump('activeOnTriggerDay'); }
      if (cur.daysLeft <= 0) bump('nonPositiveStart'); if (cur.daysLeft === 1) bump('daysLeft1'); if (cur.daysLeft === 2) bump('daysLeft2'); if (!Number.isInteger(cur.daysLeft)) bump('daysLeftFrac');
    }
    return P;
  };
  // 單步隨機
  for (const c of IN.single) { if (stepBoth(c.cur, c.day, c.pop, '單步') === null && stopAtFirst) return st; }
  // 逐日連推
  for (const [n, ch] of IN.chains.entries()) {
    let cL = ch.start ? { ...ch.start } : null, cP = cL && { ...cL }, curId, count = 0;
    const to = ch.len ? ch.from + ch.len : ch.to;
    for (let d = ch.from; d <= to; d++) {
      const pop = ch.pops(d), L = lab.step(cL, d, pop), P = stepBoth(cP, d, pop, `第 ${n} 條鏈`);
      if (P === null) { if (stopAtFirst) return st; continue; }
      // 兩條各自帶自己的狀態：實驗線從自己上一天的結果接、本線從自己的
      cL = nul(plain(L.state)); cP = P.state;
      if (J(cL) !== J(cP) && miss(`第 ${n} 條鏈 day ${d} 兩邊的狀態分開了`)) return st;
      if (cP) bump('chainActiveDays');
      if (P.started >= 0) { curId = P.started; count = 1; } else if (cP) count++;   // 觸發那天算第 1 天；之後每天還在就 +1
      if (P.ended >= 0) {
        if (curId !== undefined) { bump('lengthChecked'); if (count !== M.CITY_EVENTS[curId].days && miss(`事件 ${curId} 有加成的日子 ${count}≠days ${M.CITY_EVENTS[curId].days}`)) return st; }
        curId = undefined; count = 0;
      }
    }
  }
  // 讀檔各種形狀
  for (const [n, s] of IN.shapes.entries()) {
    st.steps++;
    let L; try { L = nul(plain(lab.load({ cev: s }))); } catch (e) { if (miss(`讀檔形狀 ${n}（${J(plain(s))}）實驗線丟例外 ${e.message}`)) return st; continue; }
    let P; try { P = nul(M.eventOfSave(s)); } catch (e) { if (miss(`讀檔形狀 ${n}（${J(s)}）本線丟例外 ${e.message}`)) return st; continue; }
    const d = deepDiff(L, P, `讀檔 ${J(plain(s))}`); if (d && miss(d)) return st;
    bump(P ? 'loadAccept' : 'loadReject');
    if (s && typeof s === 'object' && 'd' in s) { const dd = s.d; bump(!dd ? 'loadDFalsy' : typeof dd === 'string' ? 'loadDString' : Number.isInteger(dd) ? 'loadDInt' : 'loadDOther'); }
  }
  // 讀檔：整份存檔物件（實驗線讀 d.cev；沒有 cev 欄位）
  { let L; try { L = nul(plain(lab.load({}))); } catch (e) { if (miss(`沒有 cev 欄位：實驗線丟例外 ${e.message}`)) return st; } const P = nul(M.eventOfSave(undefined)); if (L !== undefined && deepDiff(L, P) && miss('沒有 cev 欄位')) return st; bump('loadNoField'); }
  // 非整數的 i：實驗線收、本線擋（唯一的差）
  for (const s of IN.nonInt) {
    const L = nul(plain(lab.load({ cev: s }))), P = nul(M.eventOfSave(s));
    if (!(L && L.i === s.i) && miss(`實驗線不收 i=${s.i}？（這一條是釘住「實驗線收非整數的 i」）`)) return st;
    if (P !== null && miss(`本線收了非整數的 i=${s.i}（要擋掉：下一天讀 CITY_EVENTS[${s.i}] 會炸）`)) return st;
    bump('nonIntRejected');
  }
  st.covered = st.started.size;
  return st;
}

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d030-events.json')), T = S.text;
  labHash = vm.runInNewContext(`${T.streetHash}\nstreetHash`);
  const IN = makeInputs();

  // ---- 1. 出處 ----
  {
    const bad = [], names = (S.pieces ?? []).map(p => p.name), want = Object.values(KEY);
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    if (J(names) !== J(want)) bad.push(`段落 ${names.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[Object.keys(KEY).find(k => KEY[k] === p.name) ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    const wantLines = { CITY_EVENTS: [38131, 38193], cityEvent: [38194, 38194], streetHash: [57805, 57811], '每天的倒數與觸發（day++ 之後、天氣之前）': [54953, 54954], '住宅幸福的城市活動項（當天）': [55179, 55179], '食物點數的事件倍率（當天）': [55293, 55293],
      '收入的事件倍率（當天）': [56028, 56028], '存檔的 cev': [66764, 66764], '讀檔的 cev': [66963, 66963], '新圖歸零': [51111, 51111] };
    for (const p of S.pieces ?? []) { const w = wantLines[p.name]; if (!w || p.line !== w[0] || p.endLine !== w[1]) bad.push(`${p.name} 行號 ${p.line}–${p.endLine}（卡面寫 ${w?.join('–')}）`); }
    const nEntries = (T.CITY_EVENTS.match(/^ {2}\{id:/gm) ?? []).length;
    if (nEntries !== 61 || EV.CITY_EVENTS.length !== 61) bad.push(`表的條數 實驗線 ${nEntries}／本線 ${EV.CITY_EVENTS.length}（要 61）`);
    const src = read('src/sim/rules/events.ts');
    if (/https?:\/\//.test(src)) bad.push('events.ts 有外部網址');
    if (/Math\.random|Date\.now|performance\.now|from 'three'|document\.|window\./.test(src.replace(/\/\/.*$/gm, ''))) bad.push('events.ts 碰了亂數／現實時間／three／DOM（規則 2、3）');
    log(!bad.length, `D030 城市活動原文：實驗線 ${PINNED.slice(0, 7)} 的 ${S.pieces?.length} 段（事件表 38131–38193、宣告 38194、streetHash 57805、觸發與倒數 54953–54954、住宅幸福項 55179、食物 55293、收入 56028、存檔 66764、讀檔 66963、歸零 51111）逐段 sha256＝錨點記錄；表 61 條；events.ts 純函式（沒有 three、DOM、亂數、現實時間、外部網址）`,
      bad.join('；') || `${S.pieces.length} 段、行號對得上；表 ${EV.CITY_EVENTS.length} 條`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const BASE = { ...EV };
  const base = compareAll(T, BASE, IN);
  const NEED = {
    tableChecked: 1, noEvent: 8000, noEventTrigDay: 4000, noEventOtherDay: 1000, trigger: 3000, day0Blocked: 30, pop50Blocked: 100, pop51Fires: 100, popHalfFires: 100, popLowBlocked: 500,
    day37Fires: 30, offDayNoFire: 500, dayPlus1NoFire: 30, dayMinus1NoFire: 30, day74Fires: 20, active: 3000, ends: 500, endOnTriggerDay: 30, counts: 1000, activeOnTriggerDay: 100,
    nonPositiveStart: 100, daysLeft1: 300, daysLeft2: 100, daysLeftFrac: 50, chainActiveDays: 2500, lengthChecked: 61,
    loadAccept: 60, loadReject: 20, loadDFalsy: 4, loadDString: 2, loadDInt: 60, loadDOther: 3, loadNoField: 1, nonIntRejected: 5,
  };
  const lacking = Object.entries(NEED).filter(([k, v]) => (base.cnt[k] ?? 0) < v).map(([k, v]) => `${k} ${(base.cnt[k] ?? 0)}<${v}`);
  const idxOk = base.covered === N_TRIG;
  log(base.diffs === 0 && !lacking.length && idxOk,
    `D030 驗收 2：城市活動逐項＝實驗線——實驗線原文在 vm 裡跟本線 events.ts 吃同一批輸入（表 61 條逐欄；單步隨機 ${IN.single.length.toLocaleString()} 組〔起始狀態＝無／各種事件與剩餘天數、day 是 37 的倍數與旁邊與 0、pop 含剛好 50、51、半整數、負數〕；${IN.chains.length} 條逐日連推〔每種事件第一次觸發那天前後各連推、六條 3,000 天的隨機人口、300 條從活動中讀進來〕；讀檔 ${IN.shapes.length} 種形狀＋非整數 i ${IN.nonInt.length} 種）：`
      + `每天的狀態、「開始／結束」的提示字逐位相等；61 種事件每一種都觸發過、有加成的日子剛好 days 天；活動結束那天不觸發新的；讀檔驗證逐個相等（實驗線收非整數的 i，本線擋掉，是唯一的差）`,
    base.first || (lacking.length ? `覆蓋不夠：${lacking.join('、')}｜${J(base.cnt)}` : !idxOk ? `觸發過的事件只有 ${base.covered}／${N_TRIG} 種` : `${base.steps.toLocaleString()} 步全等；觸發 ${base.cnt.trigger} 次、結束 ${base.cnt.ends} 次（其中 ${base.cnt.endOnTriggerDay} 次剛好在 37 的倍數）、活動中遇到觸發日 ${base.cnt.activeOnTriggerDay} 次、61 種事件 ${base.covered} 種觸發過、${base.cnt.lengthChecked} 場驗過長度`));

  if (process.env.D030_BASE_ONLY) return;
  // ---- 3. 注入錯誤要紅 ----
  {
    const missed = [];
    // 表：實驗線原文每一條每個欄位改一下（要在表的比對裡紅）、本線原碼每一條每個欄位改一下
    const labLines = T.CITY_EVENTS.split('\n'), mineSrc = read('src/sim/rules/events.ts'), mineLines = mineSrc.split('\n').filter(l => /^ {2}\{ id: "/.test(l));
    let tblLab = 0, tblMine = 0;
    for (const [j, line] of labLines.entries()) {
      if (!/^ {2}\{id:/.test(line)) continue;
      for (const f of ['days', 'tax', 'food', 'happy']) {
        const to = line.replace(new RegExp(`(${f}:)(-?[0-9.]+)`), (_, a, v) => a + (+v + (f === 'days' ? 1 : f === 'happy' ? .001 : .01)).toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
        if (to === line) { missed.push(`實驗線表第 ${j} 行 ${f} 沒改成`); continue; }
        const t2 = { ...T, CITY_EVENTS: labLines.map((l, q) => (q === j ? to : l)).join('\n') };
        tblLab++; if (!compareTable(t2, BASE)) missed.push(`實驗線表第 ${j} 行 ${f}`);
      }
      const nm = line.replace(/name:'/, "name:'x"), de = line.replace(/desc:'/, "desc:'x"), id = line.replace(/\{id:'/, "{id:'x");
      for (const [w, to] of [['name', nm], ['desc', de], ['id', id]]) { const t2 = { ...T, CITY_EVENTS: labLines.map((l, q) => (q === j ? to : l)).join('\n') }; tblLab++; if (!compareTable(t2, BASE)) missed.push(`實驗線表第 ${j} 行 ${w}`); }
    }
    for (const line of mineLines) {
      const id = /id: "([^"]+)"/.exec(line)[1], muts = [];
      for (const f of ['days', 'tax', 'food', 'happy']) muts.push([f, line.replace(new RegExp(`(${f}: )(-?[0-9.]+)`), (_, a, v) => a + (+v + (f === 'days' ? 1 : f === 'happy' ? .001 : .01)).toFixed(3).replace(/0+$/, '').replace(/\.$/, ''))]);
      muts.push(['name', line.replace(/name: "/, 'name: "x')], ['desc', line.replace(/desc: "/, 'desc: "x')], ['id', line.replace(/id: "/, 'id: "x')]);
      for (const [f, to] of muts) {
        if (to === line) { missed.push(`本線表 ${id} ${f} 沒改成`); continue; }
        let M; try { M = await loadMod('src/sim/rules/events.ts', [[line, to]]); } catch (e) { missed.push(`本線表 ${id} ${f} 載入失敗 ${e.message}`); continue; }
        tblMine++; if (!compareTable(T, M)) missed.push(`本線表 ${id} ${f}`);
      }
    }
    // 整表：少一條、多一條、對調兩條、換順序
    for (const [name, to] of [['少最後一條', s => s.replace(/(  \{ id: "[^"]+"[^\n]*\n)(\];)/, '$2')], ['第 0、1 條對調', s => { const a = mineLines[0], b = mineLines[1]; return s.replace(a, '@@A@@').replace(b, a).replace('@@A@@', b); }]]) {
      let src2 = to(mineSrc); if (src2 === mineSrc) { missed.push(`本線表「${name}」沒改成`); continue; }
      const edits = name === '少最後一條' ? [[mineLines[mineLines.length - 1] + '\n', '']] : [[mineLines[0] + '\n' + mineLines[1], mineLines[1] + '\n' + mineLines[0]]];
      let M; try { M = await loadMod('src/sim/rules/events.ts', edits); } catch (e) { missed.push(`本線表「${name}」載入失敗 ${e.message}`); continue; }
      tblMine++; if (!compareTable(T, M)) missed.push(`本線表「${name}」`);
    }
    // 觸發、倒數、讀檔
    let n = 0;
    for (const [name, key, from, to] of LAB_MUTANTS) {
      const t2 = { ...T };
      if (typeof t2[key] !== 'string' || t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一（${t2[key] === undefined ? '沒有這段' : t2[key].split(from).length - 1}）`); continue; }
      t2[key] = t2[key].replace(from, to);
      let d; try { d = compareAll(t2, BASE, IN, true).diffs; } catch (e) { missed.push(`實驗線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      n++; if (!d) missed.push(`實驗線「${name}」`);
    }
    let m = 0;
    for (const [name, from, to] of MINE_MUTANTS) {
      let M;
      try { M = await loadMod('src/sim/rules/events.ts', [[from, to]]); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = compareAll(T, M, IN, true).diffs; } catch (e) { missed.push(`本線「${name}」改壞之後跑不起來（要改成語法正確的錯誤）：${e.message}`); continue; }
      m++; if (!d) missed.push(`本線「${name}」`);
    }
    const cm0 = await loadMod('src/sim/rules/events.ts', []);
    const baseOk = !compareAll(T, cm0, IN, true).diffs;
    log(baseOk && !missed.length, `D030 驗收 2（突變）：注入錯誤要紅——表：實驗線原文 ${tblLab} 個、本線原碼 ${tblMine} 個（每條的 id、name、desc、days、tax、food、happy 各改一下；少一條、對調兩條）；觸發、倒數、讀檔：實驗線原文 ${n} 個、本線原碼 ${m} 個（37、15、50 三個門檻與比較符號、兩個鹽與參數順序、%、倒數與結束的比較、else 的結構、觸發時的天數、讀檔的範圍與 || 1）；沒改的先核過全等（vm 載入的本線原碼＝import 的）`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }
}

// ---- 突變表：[名字, 段落鍵, 原文, 改成]（實驗線）／[名字, 原文, 改成]（本線 events.ts）。原文要在那一段（那個檔）裡剛好出現一次 ----
const LAB_MUTANTS = [
  ['倒數 -- → -=2', 'eventTick', 'cityEvent.daysLeft--', 'cityEvent.daysLeft-=2'], ['倒數 -- → 不減', 'eventTick', 'cityEvent.daysLeft--;', ';'],
  ['結束 <=0 → <0', 'eventTick', 'daysLeft<=0', 'daysLeft<0'], ['結束 <=0 → <=1', 'eventTick', 'daysLeft<=0', 'daysLeft<=1'],
  ['結束後不清狀態', 'eventTick', 'cityEvent=null;}}', '}}'], ['else if → if（結束那天、進行中都能再觸發）', 'eventTick', 'else if(pop>50', 'if(pop>50'],
  ['人口 >50 → >=50', 'eventTick', 'pop>50', 'pop>=50'], ['人口 >50 → >51', 'eventTick', 'pop>50', 'pop>51'], ['人口 >50 → >49', 'eventTick', 'pop>50', 'pop>49'], ['人口 >50 → >500', 'eventTick', 'pop>50', 'pop>500'],
  ['天數 >15 → >=0', 'eventTick', 'day>15', 'day>=0'], ['天數 >15 → >37', 'eventTick', 'day>15', 'day>37'], ['天數 >15 → >75', 'eventTick', 'day>15', 'day>75'],
  ['週期 %37 → %36', 'eventTick', 'day%37===0', 'day%36===0'], ['週期 %37 → %38', 'eventTick', 'day%37===0', 'day%38===0'], ['週期 ===0 → ===1', 'eventTick', 'day%37===0', 'day%37===1'], ['週期 ===0 → !==0', 'eventTick', 'day%37===0', 'day%37!==0'],
  ['鹽 7 → 8', 'eventTick', 'streetHash(day,7,888)', 'streetHash(day,8,888)'], ['鹽 888 → 889', 'eventTick', 'streetHash(day,7,888)', 'streetHash(day,7,889)'], ['參數順序', 'eventTick', 'streetHash(day,7,888)', 'streetHash(7,day,888)'],
  ['乘 61 → 乘 60', 'eventTick', '*CITY_EVENTS.length)%CITY_EVENTS.length', '*60)%CITY_EVENTS.length'], ['取餘 61 → 60', 'eventTick', ')%CITY_EVENTS.length;cityEvent', ')%60;cityEvent'],
  ['觸發的天數 days → days+1', 'eventTick', 'daysLeft:CITY_EVENTS[ei].days', 'daysLeft:CITY_EVENTS[ei].days+1'], ['觸發的天數 days → days-1', 'eventTick', 'daysLeft:CITY_EVENTS[ei].days', 'daysLeft:CITY_EVENTS[ei].days-1'],
  ['提示字 結束 → 開始', 'eventTick', "toast('🎏 活動結束：'+", "toast('✨ 活動結束：'+"],
  ['讀檔 i>=0 → >0', 'loadCev', 'd.cev.i>=0', 'd.cev.i>0'], ['讀檔 i<61 → <=61', 'loadCev', 'd.cev.i<CITY_EVENTS.length', 'd.cev.i<=CITY_EVENTS.length'], ['讀檔 i<61 → <60', 'loadCev', 'd.cev.i<CITY_EVENTS.length', 'd.cev.i<60'],
  ['讀檔 || 1 → || 2', 'loadCev', '||1}:null', '||2}:null'], ['讀檔 (+d) → 不轉數字', 'loadCev', '(+d.cev.d)||1', '(d.cev.d)||1'], ['讀檔 不驗型別', 'loadCev', "typeof d.cev.i==='number'&&", ''], ['讀檔 不驗有沒有 cev', 'loadCev', '(d.cev&&typeof', '(typeof'],
];
const MINE_MUTANTS = [
  ['倒數 −1 → −2', 'const daysLeft = cur.daysLeft - 1;', 'const daysLeft = cur.daysLeft - 2;'], ['倒數 不減', 'const daysLeft = cur.daysLeft - 1;', 'const daysLeft = cur.daysLeft;'],
  ['結束 <=0 → <0', 'if (daysLeft <= 0)', 'if (daysLeft < 0)'], ['結束 <=0 → <=1', 'if (daysLeft <= 0)', 'if (daysLeft <= 1)'],
  ['結束 不回報結束的編號', 'ended: cur.i }', 'ended: -1 }'], ['結束 回報別的編號', 'ended: cur.i }', 'ended: cur.i + 1 }'],
  ['進行中的活動 不回傳', 'return { state: { i: cur.i, daysLeft }, started: -1, ended: -1 };', 'return { state: null, started: -1, ended: -1 };'], ['進行中的活動 回傳同一個物件', 'return { state: { i: cur.i, daysLeft }, started: -1, ended: -1 };', 'cur.daysLeft = daysLeft; return { state: cur, started: -1, ended: -1 };'],
  ['結束那天 順便觸發（else 拿掉）', 'if (daysLeft <= 0) return { state: null, started: -1, ended: cur.i };', 'if (daysLeft <= 0) { cur = null; } else'],
  ['進行中還能觸發（if (cur) → 不擋）', 'if (cur) {\n    const daysLeft', 'if (cur && false) {\n    const daysLeft'],
  ['人口 >50 → >=50', 'pop > 50', 'pop >= 50'], ['人口 >50 → >51', 'pop > 50', 'pop > 51'], ['人口 >50 → >49', 'pop > 50', 'pop > 49'], ['人口 >50 → >500', 'pop > 50', 'pop > 500'],
  ['天數 >15 → >=0', 'day > 15', 'day >= 0'], ['天數 >15 → >37', 'day > 15', 'day > 37'], ['天數 >15 → >75', 'day > 15', 'day > 75'],
  ['週期 %37 → %36', 'day > 15 && day % 37 === 0', 'day > 15 && day % 36 === 0'], ['週期 %37 → %38', 'day > 15 && day % 37 === 0', 'day > 15 && day % 38 === 0'], ['週期 ===0 → ===1', 'day > 15 && day % 37 === 0', 'day > 15 && day % 37 === 1'], ['週期 ===0 → !==0', 'day > 15 && day % 37 === 0', 'day > 15 && day % 37 !== 0'],
  ['鹽 7 → 8', 'Math.floor(streetHash(day, 7, 888)', 'Math.floor(streetHash(day, 8, 888)'], ['鹽 888 → 889', 'Math.floor(streetHash(day, 7, 888)', 'Math.floor(streetHash(day, 7, 889)'], ['參數順序', 'Math.floor(streetHash(day, 7, 888)', 'Math.floor(streetHash(7, day, 888)'],
  ['乘 61 → 乘 60', '* CITY_EVENTS.length) % CITY_EVENTS.length', '* 60) % CITY_EVENTS.length'], ['取餘 61 → 60', ') % CITY_EVENTS.length;\n    return { state', ') % 60;\n    return { state'],
  ['觸發的天數 days → days+1', 'daysLeft: CITY_EVENTS[i].days }, started: i', 'daysLeft: CITY_EVENTS[i].days + 1 }, started: i'], ['觸發的天數 days → days−1', 'daysLeft: CITY_EVENTS[i].days }, started: i', 'daysLeft: CITY_EVENTS[i].days - 1 }, started: i'],
  ['觸發 不回報開始的編號', 'started: i, ended: -1 }', 'started: -1, ended: -1 }'], ['觸發 回報別的編號', 'started: i, ended: -1 }', 'started: i + 1, ended: -1 }'],
  ['讀檔 i<0 → <=0', 'c.i < 0', 'c.i <= 0'], ['讀檔 i>=61 → >61', 'c.i >= CITY_EVENTS.length', 'c.i > CITY_EVENTS.length'], ['讀檔 i>=61 → >=60', 'c.i >= CITY_EVENTS.length', 'c.i >= 60'],
  ['讀檔 不擋非整數', '!Number.isInteger(c.i) || ', ''], ['讀檔 || 1 → || 2', '|| 1 }', '|| 2 }'], ['讀檔 (+d) → 不轉數字', '(+(c.d as number)) || 1', '((c.d as number)) || 1'], ['讀檔 不擋沒有 cev', 'if (!c || typeof', 'if (typeof'],
];

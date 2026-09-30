// D030 Node 守衛（二）：城市活動——實驗線頁面實跑（驗收 3）、接線（驗收 4）、存檔與決定性（驗收 5）。由 tools/unit.mjs 呼叫；vm 逐項與突變（驗收 1、2）在 tools/unit-d030.mjs；瀏覽器半邊在 tools/smoke-d030.mjs。
//   1. 樣本 src/content/samples/d027-lab.json、d028-lab.json（實驗線 d23c18d 的頁面錄的；每天一列有 ev〔i、left、happy、food、tax〕）：ev 的三個加成＝本線表、剩餘天數每天減 1 到 1 為止、覆蓋（起步城 8 種子各 16 個活動日、
//      長出來的存檔 24 份、讀進來就在活動中的城、自造城）；
//   2. **不代入城市活動的任何東西**（D027、D028 的守衛從這一張起也不再代）：本線自己讀檔、自己觸發與倒數，跟實驗線逐天逐欄比——起步城 8 種子 × 120 天（玩家實際玩到的本線，什麼都不代；另一批只代政策與科技）、長出來的存檔 24 份 × 12 天、
//      自造城 J1–J17（13 天）、K1–K16 與 D022–D025 的 120 座城兩批（10 天）：D027、D028 的全部欄位逐位全等；活動的狀態（i、剩餘天數）每天＝樣本的 ev、DayReport.cityEvent 的「開始／結束」＝狀態的變化；
//   3. 接線：day.ts 的副本改壞一處要紅（不觸發、不倒數、日子與人口讀錯、三個消費者各自不吃或吃錯欄、讀檔不還原、報表不回報、雜湊不看）——由實驗線對拍、時序直接測（昨天的人口、今天的日子、倒數與結束）或雜湊抓到；
//   4. 存檔與決定性：cev 有活動寫 {i, d}、沒活動範本有就寫 0、沒有就不加；讀回來同一場、同樣的剩餘天數，之後每天的狀態相同；缺與壞的 cev 讀成無活動；沒有新欄位、城市格式照舊、歷史沒有新事件；同一張碼讀兩次每天雜湊相同。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import * as realDay from '../src/sim/day.ts';
import { saveCode, loadCode, historyFormat } from '../src/io/save.ts';
import * as EV from '../src/sim/rules/events.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import { dayVariant } from './unit-d021.mjs';
import { compareCity27 } from './unit-d027-live.mjs';
import { compareCity28 } from './unit-d028-live.mjs';
import { d027Cities, evolvedIds } from './d027-lab.mjs';
import { d028Cities, oldList, oldzList } from './d028-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const HK = ['happy', 'hh', 'ah', 'agg'];
const KNOWN = { D3: 'T442 污水（管網讓近旁工業每座加 .025）' };   // seed516（T133 城市等級，微光之巔 +.02）由 D031 補上、從名單拿掉
const HAPPY_EVENT = HAPPY_NAMES.indexOf('城市活動');
const nz = (a, f) => a.filter(f).length, sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
export const LIVE = {};   // 除錯用

export async function d030LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D030 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 活動的狀態與報表：每天跟樣本的 ev 比。prev＝前一天的狀態（第一天＝存檔的 cev）；started／ended＝狀態的變化（沒有活動接著有＝開始，有活動接著沒有＝結束）
const evWant = row => (row.ev ? { i: row.ev.i, d: row.ev.left } : null);
const evHave = s => (s.cityEvent ? { i: s.cityEvent.i, d: s.cityEvent.daysLeft } : null);
function checker(code, cnt, bad) {
  const st = EV.eventOfSave(decodeLabCode(code).save.raw.cev);
  let prev = st ? { i: st.i, d: st.daysLeft } : null;
  if (prev) cnt.startMid = (cnt.startMid ?? 0) + 1;
  return (day, mine, row, rep, s) => {
    const want = evWant(row), have = evHave(s), wantStart = !prev && want ? want.i : -1, wantEnd = prev && !want ? prev.i : -1;
    cnt.days = (cnt.days ?? 0) + 1;
    if (want) cnt.eventDays = (cnt.eventDays ?? 0) + 1;
    if (J(want) !== J(have)) bad.push(`第 ${day} 天 活動狀態 本線 ${J(have)} ≠ 實驗線 ${J(want)}`);
    else if (rep.cityEvent.started !== wantStart || rep.cityEvent.ended !== wantEnd) bad.push(`第 ${day} 天 DayReport.cityEvent 開始／結束 本線 ${rep.cityEvent.started}／${rep.cityEvent.ended} ≠ 狀態的變化 ${wantStart}／${wantEnd}`);
    else { if (wantStart >= 0) cnt.started = (cnt.started ?? 0) + 1; if (wantEnd >= 0) cnt.ended = (cnt.ended ?? 0) + 1; }
    prev = want;
  };
}

async function guards(log) {
  const lab27 = JSON.parse(read('src/content/samples/d027-lab.json')), lab28 = JSON.parse(read('src/content/samples/d028-lab.json'));
  const cities27 = d027Cities(), cities28 = d028Cities(), olds = oldList(), oldzs = oldzList();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const d26 = JSON.parse(read('src/content/samples/d026-lab.json')), evolvedCode = id => { const [seed, dd] = id.split('@'); return d26.evolve[seed].codes[dd]; };
  const startCode = read('src/content/samples/starter.code.txt').trim();
  Object.assign(LIVE, { lab27, lab28, cities27, cities28, olds, oldzs, KT, vrank });

  // ---- 1. 樣本：ev 的三個加成＝本線表、剩餘天數每天減 1、覆蓋 ----
  const groups27 = { 起步城: Object.values(lab27.evolve), 存檔: Object.values(lab27.evolved), 自造城J: Object.values(lab27.crafted), 老城: Object.values(lab27.old), 老城分區不清: Object.values(lab27.oldz) };
  const groups28 = { 自造城K: Object.values(lab28.crafted), 老城: Object.values(lab28.old), 老城分區不清: Object.values(lab28.oldz) };
  {
    const bad = [], idx = new Set(), cov = {};
    if (lab27.source?.commit !== PINNED || lab28.source?.commit !== PINNED) bad.push(`出處不是 ${PINNED.slice(0, 7)}：${lab27.source?.commit}／${lab28.source?.commit}`);
    for (const [tag, groups] of [['d027', groups27], ['d028', groups28]]) for (const [g, recs] of Object.entries(groups)) for (const L of recs) {
      let prev = null;
      for (const r of L.rows) {
        const e = r.ev;
        if (e) {
          const def = EV.CITY_EVENTS[e.i];
          if (!def) { bad.push(`${tag} ${g} 第 ${r.day} 天 ev.i=${e.i} 不在表裡`); continue; }
          idx.add(e.i); cov[`${tag}:${g}`] = (cov[`${tag}:${g}`] ?? 0) + 1;
          if (!(Object.is(e.happy, def.happy) && Object.is(e.food, def.food) && Object.is(e.tax, def.tax))) bad.push(`${tag} ${g} 第 ${r.day} 天 ev 的加成 ${J([e.happy, e.food, e.tax])} ≠ 本線表 ${J([def.happy, def.food, def.tax])}`);
          if (!(e.left >= 1 && e.left <= def.days)) bad.push(`${tag} ${g} 第 ${r.day} 天 剩 ${e.left} 天不在 1..${def.days}`);
          if (prev && prev.i === e.i && e.left !== prev.left - 1) bad.push(`${tag} ${g} 第 ${r.day} 天 剩餘天數 ${prev.left}→${e.left}（要每天減 1）`);
          if (prev && prev.i !== e.i) bad.push(`${tag} ${g} 第 ${r.day} 天 前一天是別的事件`);
          if (!prev && e.left !== def.days && r.day === L.rows[0].day) cov.startMid = (cov.startMid ?? 0) + 1;
          if (!prev && e.left === def.days) { cov.trigger = (cov.trigger ?? 0) + 1; if (r.day % 37 !== 0) bad.push(`${tag} ${g} 第 ${r.day} 天觸發、但不是 37 的倍數`); }
        } else if (prev && prev.left !== 1) bad.push(`${tag} ${g} 第 ${r.day} 天 活動在剩 ${prev.left} 天時消失了`);
        prev = e ?? null;
      }
    }
    const starterDays = sum(groups27.起步城, L => nz(L.rows, r => r.ev)), each = groups27.起步城.map(L => nz(L.rows, r => r.ev));
    LIVE.cov = { ...cov, idx: [...idx].sort((a, b) => a - b) };
    const NEED = { 'd027:起步城': 128, 'd027:存檔': 100, 'd027:自造城J': 50, 'd027:老城': 10, 'd028:自造城K': 5, 'd028:老城': 10, trigger: 10, startMid: 8 };
    const lack = Object.entries(NEED).filter(([k, v]) => (cov[k] ?? 0) < v).map(([k, v]) => `${k} ${(cov[k] ?? 0)}<${v}`);
    if (lack.length) bad.push(`覆蓋不夠：${lack.join('、')}`);
    if (idx.size < 4) bad.push(`樣本裡的事件只有 ${idx.size} 種`);
    log(!bad.length, `D030 實跑樣本：實驗線 ${PINNED.slice(0, 7)} 回退設定（沿用 D027、D028 錄的：起步城 8 種子 × 120 天、長出來的存檔 24 份 × 12 天、自造城 J1–J17 與 K1–K16、D022–D025 的 120 座城兩批）；每天一列的 ev（事件編號、剩餘天數、幸福、食物、稅率）＝本線表、剩餘天數每天減 1、觸發都在 37 的倍數`,
      bad.slice(0, 4).join('；') || `${starterDays} 個起步城的活動日（每個種子 ${each.join('、')}）；` + Object.entries(cov).map(([k, v]) => `${k} ${v}`).join('、') + `；出現的事件編號 ${[...idx].sort((a, b) => a - b).join('、')}`);
    if (bad.length) return;
  }

  // ---- 2. 不代入城市活動的任何東西，逐天逐欄跟實驗線比（驗收 3、7）----
  {
    const errs = [], cnt = {}, per = [];
    for (const seed of STARTER_SEEDS) {
      const code = codeWithSeed(startCode, seed), rec = lab27.evolve[seed], b = [], c = {};
      const nat = compareCity27(realDay, code, rec, KT, vrank, { stopAtFirst: false, inject: false, onDay: checker(code, c, b) });
      const pol = compareCity27(realDay, code, rec, KT, vrank, { stopAtFirst: false, inject: true });
      per.push({ seed, nat, pol, c, firstEvent: rec.rows.find(r => r.ev).day });
      for (const k of Object.keys(c)) cnt[k] = (cnt[k] ?? 0) + c[k];
      if (nat.d.length) errs.push(`${seed} 什麼都不代：第 ${nat.first} 天 ${nat.d[0].slice(0, 160)}`);
      if (pol.d.length) errs.push(`${seed} 只代政策與科技：第 ${pol.first} 天 ${pol.d[0].slice(0, 160)}`);
      if (b.length) errs.push(`${seed} ${b[0]}`);
    }
    LIVE.starter = per;
    const eqAll = nz(per, p => !p.nat.first), days = sum(per, p => p.nat.days), ev0 = per.map(p => p.firstEvent);
    log(!errs.length && cnt.eventDays >= 128 && eqAll === STARTER_SEEDS.length, `D030 驗收 3、7：起步城 8 個種子 × 120 天，什麼都不代（玩家實際玩到的本線）——道路負載、通勤、地價、每一棟住宅的幸福、幸福構成 57 項、人口、就業、亂數位置每天逐位元全等，8／8 個種子逐日全程相等（D029 是 6／8）；活動的狀態每天＝實驗線的 ev、報表的「開始／結束」＝狀態的變化；另一批只代政策與科技也全等`,
      errs.slice(0, 4).join('｜') || `${per.length} 個種子 × 120 天＝${days} 個城日全等；實驗線第一場活動在第 ${ev0.join('、')} 天；活動日 ${cnt.eventDays} 個、開始 ${cnt.started} 次、結束 ${cnt.ended} 次；逐日全等到第 120 天的種子 ${eqAll}／${per.length}`);
    if (errs.length) return;
  }
  {
    const errs = [], cnt = {}; let mid = 0;
    for (const id of evolvedIds()) {
      const b = [], c = {};
      const r = compareCity27(realDay, evolvedCode(id), lab27.evolved[id], KT, vrank, { stopAtFirst: false, inject: true, onDay: checker(evolvedCode(id), c, b) });
      if (r.d.length) errs.push(`${id} ${r.d[0].slice(0, 140)}`); if (b.length) errs.push(`${id} ${b[0]}`);
      for (const k of Object.keys(c)) cnt[k] = (cnt[k] ?? 0) + c[k]; if (c.startMid) mid++;
    }
    const jb = [], jc = {}; let jdays = 0;
    for (const c of cities27) {
      const b = [], k = {}, r = compareCity27(realDay, c.code, lab27.crafted[c.id], KT, vrank, { stopAtFirst: false, inject: true, onDay: checker(c.code, k, b) });
      if (r.d.length) jb.push(`${c.id} ${r.d[0].slice(0, 140)}`); if (b.length) jb.push(`${c.id} ${b[0]}`); jdays += r.days;
      for (const q of Object.keys(k)) jc[q] = (jc[q] ?? 0) + k[q];
    }
    log(!errs.length && cnt.eventDays >= 100 && mid >= 8, `D030 驗收 3：實驗線頁面實跑（起步城第 30、70、110 天的實驗線存檔 24 份連推 12 天，其中讀進來就在活動中的至少 8 份；只代政策與科技，不代活動）——整條 tick 鏈逐天全等，活動狀態與報表逐天對得上`,
      errs.slice(0, 4).join('｜') || `${evolvedIds().length} 份、${sum(evolvedIds(), () => 12)} 個城日全等；活動日 ${cnt.eventDays}、讀進來就在活動中的 ${mid} 份、開始 ${cnt.started ?? 0} 次、結束 ${cnt.ended ?? 0} 次`);
    log(!jb.length && jc.eventDays >= 50, `D030 驗收 3：實驗線頁面實跑（自造城 J1–J17 讀進來連推 13 天，不代活動）——逐位全等，活動狀態與報表逐天對得上`,
      jb.slice(0, 4).join('｜') || `${cities27.length} 座、${jdays} 個城日全等；活動日 ${jc.eventDays}、讀進來就在活動中的 ${jc.startMid ?? 0} 座、開始 ${jc.started ?? 0} 次、結束 ${jc.ended ?? 0} 次`);
    if (errs.length || jb.length) return;
  }
  {
    const runSet = (list, get) => list.map(c => { const b = [], k = {}, r = compareCity28(realDay, c.code, get(c.id), KT, vrank, { stopAtFirst: false, onDay: checker(c.code, k, b) }); return { id: c.id, ...r, b, k }; });
    const crafted = runSet(cities28, id => lab28.crafted[id]), o1 = runSet(olds, id => lab28.old[id]), o2 = runSet(oldzs, id => lab28.oldz[id]), errs = [], line = [];
    for (const [tag, rows] of [['自造城 K1–K16', crafted], ['D022–D025 的 120 座城（分區清成 0）', o1], ['D022–D025 的 120 座城（分區不清）', o2]]) {
      const bad = rows.filter(x => x.d.length);
      for (const x of bad) {
        if (!KNOWN[x.id]) errs.push(`${tag} ${x.id} 不在已知名單：${x.d[0].slice(0, 200)}`);
        else if (x.fields.some(f => !HK.includes(f))) errs.push(`${tag} ${x.id} 除了幸福還有別的欄位不同：${x.fields.join('、')}（${x.d[0].slice(0, 120)}）`);
      }
      for (const id of Object.keys(KNOWN)) if (tag !== '自造城 K1–K16' && !bad.some(x => x.id === id)) errs.push(`${tag} ${id}：這一次沒有差了（本線補了這個系統？把它從已知名單拿掉）`);
      for (const x of rows) if (x.b.length) errs.push(`${tag} ${x.id} ${x.b[0]}`);
      const ed = sum(rows, x => x.k.eventDays ?? 0), mid = sum(rows, x => x.k.startMid ?? 0), cities = nz(rows, x => x.k.eventDays > 0);
      if (tag.startsWith('D022') && (cities < 5 || ed < 15)) errs.push(`${tag} 有活動的城 ${cities}（要 ≥ 5）、活動日 ${ed}（≥ 15）`);
      line.push(`${tag}：${rows.length} 座、${sum(rows, x => x.days)} 個城日，${rows.length - bad.length} 座全欄全等${bad.length ? `、${bad.length} 座只差幸福（${bad.map(x => `${x.id}：${KNOWN[x.id]}`).join('；')}）` : ''}；有活動的 ${cities} 座、活動日 ${ed}、讀進來就在活動中的 ${mid} 座`);
    }
    log(!errs.length, `D030 驗收 3：實驗線頁面實跑（D028 的全部欄位〔資金、稅、十二個收入項、鏈條、食物、遊客、旅宿、每棟住宅幸福、幸福構成 57 項、人口、就業、亂數位置〕，自造城 K1–K16、D022–D025 的 120 座城兩批連推 10 天，不代活動）——逐位全等（seed516、D3 兩座只差幸福，照舊），活動狀態與報表逐天對得上`,
      errs.slice(0, 4).join('｜') || line.join('｜'));
    if (errs.length) return;
  }

  await wiringGuards(log, { lab27, lab28, cities28, olds, oldzs, KT, vrank, evolvedCode, startCode });
  await persistGuards(log, { KT, vrank, startCode, evolvedCode });
}

// ---- 3. 接線（驗收 4）：day.ts 的副本改壞一處，這批要紅 ----
async function wiringGuards(log, { lab27, lab28, cities28, olds, oldzs, KT, vrank, evolvedCode, startCode }) {
  const SEEDS = [STARTER_SEEDS[0], STARTER_SEEDS[3], STARTER_SEEDS[6]];
  const MID = evolvedIds().filter(id => lab27.evolved[id].rows[0].ev), OTHER = [`${STARTER_SEEDS[1]}@70`];
  const C28 = [...cities28.filter(c => lab28.crafted[c.id].rows.some(r => r.ev)).map(c => ({ c, rec: lab28.crafted[c.id] })), ...olds.filter(c => lab28.old[c.id].rows.some(r => r.ev)).map(c => ({ c, rec: lab28.old[c.id] })), ...oldzs.filter(c => lab28.oldz[c.id].rows.some(r => r.ev) && !KNOWN[c.id]).slice(0, 2).map(c => ({ c, rec: lab28.oldz[c.id] }))];
  const dayBad = mod => {
    try {
      for (const seed of SEEDS) {
        const code = codeWithSeed(startCode, seed), b = [], r = compareCity27(mod, code, lab27.evolve[seed], KT, vrank, { inject: false, onDay: checker(code, {}, b) });
        if (r.d.length) return `${seed} ${r.d[0].slice(0, 80)}`; if (b.length) return `${seed} ${b[0].slice(0, 80)}`;
      }
      for (const id of [...MID, ...OTHER]) { const code = evolvedCode(id), b = [], r = compareCity27(mod, code, lab27.evolved[id], KT, vrank, { inject: true, onDay: checker(code, {}, b) }); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; if (b.length) return `${id} ${b[0].slice(0, 80)}`; }
      for (const { c, rec } of C28) { const b = [], r = compareCity28(mod, c.code, rec, KT, vrank, { onDay: checker(c.code, {}, b) }); if (r.d.length && !(KNOWN[c.id] && r.fields.every(f => HK.includes(f)))) return `${c.id} ${r.d[0].slice(0, 80)}`; if (b.length) return `${c.id} ${b[0].slice(0, 80)}`; }
    } catch (e) { return `丟例外 ${e.message.slice(0, 60)}`; }
    return null;
  };
  // 時序直接測：一座成熟的城（起步城第 70 天的存檔），把 day、人口、活動狀態擺好再推一天。
  // 正確：觸發讀「明天」的日子（day++ 之後）與「昨天」的人口（這時還沒重算）；有活動就倒數、剩 1 就結束、結束那天不觸發新的
  const timeCode = evolvedCode(`${STARTER_SEEDS[0]}@70`);
  // 食物點數要有農場、牧場、溫室或加工廠才不是 0：找一座第一天食物點數夠大的 D022–D025 的城
  const foodCity = (() => { for (const c of olds) { const s = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank); if (realDay.stepDay(s).food.points >= 20) return c; } return null; })();
  LIVE.foodCity = foodCity?.id;
  const timingBad = mod => {
    const run = (day0, pop0, cur0) => { const r = decodeLabCode(timeCode), s = mod.simFromSave(r.save, timeCode, KT, vrank); s.day = day0; s.pop = pop0; s.cityEvent = cur0; const rep = mod.stepDay(s); return { s, rep }; };
    try {
      const want = EV.eventStep(null, 37, 60), i37 = want.started;
      let x = run(36, 40, null); if (x.s.cityEvent !== null || x.rep.cityEvent.started !== -1) return `昨天的人口 40（今天長到 ${x.rep.pop}）也觸發了：人口門檻要讀昨天的`;
      x = run(36, 60, null); if (!x.s.cityEvent || x.s.cityEvent.i !== i37 || x.s.cityEvent.daysLeft !== EV.CITY_EVENTS[i37].days || x.rep.cityEvent.started !== i37) return `第 37 天、昨天人口 60 沒有觸發 ${i37}（得到 ${J(x.s.cityEvent)}／開始 ${x.rep.cityEvent.started}）`;
      x = run(35, 60, null); if (x.s.cityEvent !== null) return `第 36 天觸發了（要第 37 天）`;
      x = run(37, 60, null); if (x.s.cityEvent !== null) return `第 38 天觸發了（要第 37 天）`;
      x = run(73, 60, null); if (!x.s.cityEvent || x.s.cityEvent.i !== EV.eventStep(null, 74, 60).started) return `第 74 天沒有觸發成 ${EV.eventStep(null, 74, 60).started}`;
      x = run(20, 60, { i: 5, daysLeft: 3 }); if (J(evHave(x.s)) !== J({ i: 5, d: 2 }) || x.rep.cityEvent.started !== -1 || x.rep.cityEvent.ended !== -1) return `活動剩 3 天、推一天要剩 2（得到 ${J(evHave(x.s))}）`;
      x = run(20, 60, { i: 5, daysLeft: 1 }); if (x.s.cityEvent !== null || x.rep.cityEvent.ended !== 5) return `活動剩 1 天、推一天要結束（得到 ${J(evHave(x.s))}／結束 ${x.rep.cityEvent.ended}）`;
      x = run(36, 60, { i: 5, daysLeft: 1 }); if (x.s.cityEvent !== null || x.rep.cityEvent.started !== -1) return `結束的那天又觸發新的了（得到 ${J(evHave(x.s))}）`;
      x = run(36, 60, { i: 5, daysLeft: 4 }); if (J(evHave(x.s)) !== J({ i: 5, d: 3 })) return `活動進行中遇到觸發日、不該換成新的（得到 ${J(evHave(x.s))}）`;
      // 三個消費者：活動當天的收入 ＝ 沒活動的收入 × 稅率（取整）；幸福構成的「城市活動」項＝ happy；食物點數 ×food
      const ev = EV.CITY_EVENTS[i37], A = run(20, 60, null), B = run(20, 60, { i: i37, daysLeft: 3 });
      if (Math.abs(B.rep.happyAgg[HAPPY_EVENT] - ev.happy) > 1e-12 && B.rep.happyAgg.length) return `幸福構成的城市活動項 ${B.rep.happyAgg[HAPPY_EVENT]} ≠ ${ev.happy}`;
      if (A.rep.happyAgg.length && A.rep.happyAgg[HAPPY_EVENT] !== 0) return `沒活動時幸福構成的城市活動項 ${A.rep.happyAgg[HAPPY_EVENT]}（要 0）`;
      if (ev.tax !== 1 && B.rep.settle.income === A.rep.settle.income) return `活動的稅率 ${ev.tax} 沒有進收入`;
      if (!foodCity) return '沒有食物點數夠大的城可以測食物加成';
      const fr = (cur0) => { const r = decodeLabCode(foodCity.code), s = mod.simFromSave(r.save, foodCity.code, KT, vrank); s.cityEvent = cur0; s.day = 20; return mod.stepDay(s).food.points; };
      const f0 = fr(null), f1 = fr({ i: i37, daysLeft: 3 });
      if (!(ev.food > 1 ? f1 > f0 : ev.food < 1 ? f1 < f0 : true)) return `活動的食物 ×${ev.food}：食物點數 ${f0} → ${f1}`;
    } catch (e) { return `丟例外 ${e.message.slice(0, 80)}`; }
    return null;
  };
  const hashBad = mod => {
    const r = decodeLabCode(timeCode), fresh = () => mod.simFromSave(r.save, timeCode, KT, vrank), base = mod.simHash(fresh());
    const h = c => { const q = fresh(); q.cityEvent = c; return mod.simHash(q); }, blind = [];
    if (h({ i: 3, daysLeft: 4 }) === base) blind.push('有活動跟沒活動一樣');
    if (h({ i: 3, daysLeft: 4 }) === h({ i: 4, daysLeft: 4 })) blind.push('活動編號');
    if (h({ i: 3, daysLeft: 4 }) === h({ i: 3, daysLeft: 5 })) blind.push('剩餘天數');
    return blind.length ? `雜湊不看：${blind.join('、')}` : null;
  };
  const mk = async edits => ({ V: await dayVariant(edits) });
  const CHECK = [['對拍', ({ V }) => dayBad(V)], ['時序直接測', ({ V }) => timingBad(V)], ['雜湊', ({ V }) => hashBad(V)]];
  // 等價突變不列：觸發在天氣之後而不是之前——eventStep 沒有亂數，天氣也不讀活動，先後沒有差別；紀錄活動用的 `evs` 換成別的名字之類的純改寫
  const STEP = 'const evs = eventStep(s.cityEvent, s.day, s.pop); s.cityEvent = evs.state;';
  const MUT = [
    ['活動不觸發也不倒數（狀態恆無）', [['s.cityEvent = evs.state;', 's.cityEvent = null;']]],
    ['活動不倒數（一直留著）', [[STEP, 'const evs = eventStep(s.cityEvent, s.day, s.pop); s.cityEvent = s.cityEvent ?? evs.state;']]],
    ['觸發讀昨天的日子（day++ 之前）', [[STEP, 'const evs = eventStep(s.cityEvent, s.day - 1, s.pop); s.cityEvent = evs.state;']]],
    ['觸發讀後天的日子', [[STEP, 'const evs = eventStep(s.cityEvent, s.day + 1, s.pop); s.cityEvent = evs.state;']]],
    ['觸發的人口恆為大（不看昨天的人口）', [[STEP, 'const evs = eventStep(s.cityEvent, s.day, 1e6); s.cityEvent = evs.state;']]],
    ['觸發的人口恆為 0', [[STEP, 'const evs = eventStep(s.cityEvent, s.day, 0); s.cityEvent = evs.state;']]],
    ['活動狀態傳成上一天的（永遠沒有活動）', [[STEP, 'const evs = eventStep(null, s.day, s.pop); s.cityEvent = evs.state;']]],
    ['幸福項不餵活動', [['eventHappy: opts.hazard?.eventHappy ?? (evd ? evd.happy : null),', 'eventHappy: opts.hazard?.eventHappy ?? null,']]],
    ['幸福項餵成食物倍率', [['eventHappy: opts.hazard?.eventHappy ?? (evd ? evd.happy : null),', 'eventHappy: opts.hazard?.eventHappy ?? (evd ? evd.food : null),']]],
    ['食物不吃活動', [['eventFood: x2?.eventFood ?? (evd ? evd.food : undefined),', 'eventFood: x2?.eventFood ?? undefined,']]],
    ['食物餵成稅率', [['eventFood: x2?.eventFood ?? (evd ? evd.food : undefined),', 'eventFood: x2?.eventFood ?? (evd ? evd.tax : undefined),']]],
    ['收入不乘活動的稅率', [['econToday(ec, late, extras), night, evd ? evd.tax : null);', 'econToday(ec, late, extras), night, null);']]],
    ['收入乘成食物倍率', [['econToday(ec, late, extras), night, evd ? evd.tax : null);', 'econToday(ec, late, extras), night, evd ? evd.food : null);']]],
    ['收入乘成幸福', [['econToday(ec, late, extras), night, evd ? evd.tax : null);', 'econToday(ec, late, extras), night, evd ? evd.happy : null);']]],
    ['讀檔不還原活動', [['cityEvent: eventOfSave(save.raw.cev)', 'cityEvent: null']]],
    ['報表不回報活動', [['cityEvent: evs, rank:', 'cityEvent: { state: null, started: -1, ended: -1 }, rank:']]],
    ['報表不回報開始', [['cityEvent: evs, rank:', 'cityEvent: { ...evs, started: -1 }, rank:']]],
    ['報表不回報結束', [['cityEvent: evs, rank:', 'cityEvent: { ...evs, ended: -1 }, rank:']]],
    ['雜湊不看活動', [['...(s.cityEvent ? [s.cityEvent.i, s.cityEvent.daysLeft] : []),', '']]],
    ['雜湊不看活動的剩餘天數', [['[s.cityEvent.i, s.cityEvent.daysLeft]', '[s.cityEvent.i]']]],
    ['雜湊不看活動的編號', [['[s.cityEvent.i, s.cityEvent.daysLeft]', '[s.cityEvent.daysLeft]']]],
  ];
  const bad = [], out = [], M0 = await mk([]), base0 = CHECK.map(([tag, fn]) => { const w = fn(M0); return w ? `${tag}：${w}` : null; }).filter(Boolean);
  if (base0.length) bad.push(`沒改的副本就有不對：${base0.join('｜')}`);
  const tally = {};
  for (const [name, edits] of MUT) {
    let M; try { M = await mk(edits); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    let hit = null; for (const [tag, fn] of CHECK) { const w = fn(M); if (w) { hit = [tag, w]; break; } }
    out.push(`${name}：${hit ? hit[0] + '（' + hit[1].slice(0, 40) + '）' : '沒抓到'}`);
    if (!hit) bad.push(`「${name}」沒抓到`); else tally[hit[0]] = (tally[hit[0]] ?? 0) + 1;
  }
  log(!bad.length, `D030 驗收 4：接線——day.ts 的副本改壞一處（${MUT.length} 個：不觸發、不倒數、觸發讀錯日子與人口、三個消費者各自不吃或吃錯欄、讀檔不還原、報表不回報開始與結束、雜湊不看活動與兩個欄位）：每一個都要被實驗線對拍（起步城 ${SEEDS.length} 個種子 × 120 天、讀進來就在活動中的存檔 ${MID.length + OTHER.length} 份、有活動的 D028 城 ${C28.length} 座）、時序直接測或雜湊抓到；沒改的先核過全等`,
    bad.slice(0, 5).join('；') || `${Object.entries(tally).map(([k, v]) => `${k} ${v} 個`).join('、')}；` + out.join('；'));
}

// ---- 4. 存檔與決定性（驗收 5）----
async function persistGuards(log, { KT, vrank, startCode, evolvedCode }) {
  const bad = [], seen = { loads: 0, days: 0, trips: 0, keys: 0, det: 0, shapes: 0 };
  // 世界歷史目前有的事件種類（D029 收工時）：這一張不加新事件
  const KNOWN_EVENTS = new Set(['import', 'restyle', 'grow', 'upgrade', 'build', 'demolish', 'zone', 'road', 'place', 'pipe', 'park', 'tree', 'doze', 'clear', 'undo', 'decay', 'overgrow', 'roofless', 'collapse', 'police', 'fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act']);
  const ECON_OPT = new Set(['fuel364', 'steel364', 'shipCount', 'shipProgress']);
  assertQ(HAPPY_EVENT >= 0, '幸福構成裡沒有「城市活動」這一項');
  function assertQ(c, m) { if (!c) bad.push(m); }
  const rawOf = (sm, L) => decodeLabCode(saveCode(sm, L.template, L.start)).save.raw;
  for (const seed of [STARTER_SEEDS[0], STARTER_SEEDS[2], STARTER_SEEDS[5]]) {
    const code = codeWithSeed(startCode, seed), L = loadCode(code, KT, vrank);
    if (!L.ok) { bad.push(`${seed}：讀不進 ${L.error}`); continue; }
    const sm = L.sim; seen.loads++;
    if (sm.cityEvent !== null) bad.push(`${seed} 剛讀進來就有活動`);
    const raw0 = rawOf(sm, L);
    // 推到第一場活動的第 2 天（第 37 天觸發）；存檔的 cev＝這一場
    let started = -1;
    for (let d = 1; d <= 40; d++) { const rep = realDay.stepDay(sm); seen.days++; if (rep.cityEvent.started >= 0) started = rep.cityEvent.started; if (sm.day === 38) break; }
    if (started < 0 || !sm.cityEvent) { bad.push(`${seed} 推到第 ${sm.day} 天沒有活動（要在第 37 天觸發）`); continue; }
    const code1 = saveCode(sm, L.template, L.start), raw1 = decodeLabCode(code1).save.raw, want = { i: sm.cityEvent.i, d: sm.cityEvent.daysLeft };
    if (J(raw1.cev) !== J(want)) bad.push(`${seed} 存檔的 cev ${J(raw1.cev)} ≠ 活動 ${J(want)}`);
    const extra = Object.keys(raw1).filter(k => !(k in raw0) && !ECON_OPT.has(k) && k !== 'cev'), gone = Object.keys(raw0).filter(k => !(k in raw1));   // 唯一可以多的是 cev（範本沒有這個欄位時）
    if (extra.length || gone.length) bad.push(`${seed} 有活動的存檔欄位跟沒活動的不同：多 ${extra.join('、') || '無'}、少 ${gone.join('、') || '無'}`);
    seen.keys = Object.keys(raw1).length;
    const h = sm.city.history;
    if (h.some(e => !KNOWN_EVENTS.has(e.t))) bad.push(`${seed} 歷史裡有不認得的事件：${[...new Set(h.map(e => e.t))].join('、')}`);
    const hz = h.some(e => ['fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act'].includes(e.t));
    if (hz ? historyFormat(h) !== 6 || raw1.d3.f !== 6 : historyFormat(h) > 5 || raw1.d3.f > 5) bad.push(`${seed} 城市格式 ${raw1.d3.f}（有災禍事件要 6、沒有不能寫 6）`);
    // 存了再讀回來：同一場、同樣的剩餘天數；之後每天狀態與「一直推下去的」相同（直到結束）
    const q = loadCode(code1, KT, vrank);
    if (!q.ok || !q.replayed) { bad.push(`${seed} 存了再讀回失敗：${q.ok ? q.note : q.error}`); continue; }
    if (J(evHave(q.sim)) !== J(want)) bad.push(`${seed} 讀回來的活動 ${J(evHave(q.sim))} ≠ 存的 ${J(want)}`);
    seen.trips++;
    for (let d = 1; d <= 12; d++) {
      const a = realDay.stepDay(sm), b = realDay.stepDay(q.sim); seen.days += 2;
      if (J(evHave(sm)) !== J(evHave(q.sim)) || a.cityEvent.started !== b.cityEvent.started || a.cityEvent.ended !== b.cityEvent.ended) { bad.push(`${seed} 存檔再讀回來之後第 ${d} 天活動不同：${J(evHave(sm))}／${J(evHave(q.sim))}`); break; }
    }
    if (sm.cityEvent) bad.push(`${seed} 推了 12 天活動還沒結束（最長 10 天）`);
    // 活動結束後再存：範本有 cev 就寫 0；範本沒有就不加；範本裡是舊活動、現在沒有＝0
    const rawEnd = decodeLabCode(saveCode(sm, L.template, L.start)).save.raw;
    if (!('cev' in L.template)) { if ('cev' in rawEnd) bad.push(`${seed} 範本沒有 cev、沒活動卻寫了 cev=${J(rawEnd.cev)}`); } else if (rawEnd.cev !== 0) bad.push(`${seed} 範本有 cev、活動結束後存成 ${J(rawEnd.cev)}（要 0）`);
    const noKey = { ...L.template }; delete noKey.cev; const rawNo = decodeLabCode(saveCode(sm, noKey, L.start)).save.raw;
    if ('cev' in rawNo) bad.push(`${seed} 範本沒有 cev、沒活動：不該加 cev（存檔位元組不變）`);
    const stale = decodeLabCode(saveCode(sm, { ...L.template, cev: { i: 3, d: 4 } }, L.start)).save.raw;
    if (stale.cev !== 0) bad.push(`${seed} 範本裡是舊活動、現在沒有：要寫 0，得到 ${J(stale.cev)}`);
    seen.shapes += 3;
  }
  // 讀檔：缺、0、壞形狀＝無活動；好的接著算（第一天倒數）
  {
    const r0 = decodeLabCode(codeWithSeed(startCode, STARTER_SEEDS[0]));
    const shapes = [[undefined, null], [0, null], [null, null], ['x', null], [{}, null], [{ i: -1, d: 3 }, null], [{ i: 61, d: 3 }, null], [{ i: '3', d: 3 }, null], [{ i: 2.5, d: 3 }, null], [{ i: 3, d: 5 }, { i: 3, d: 4 }], [{ i: 3 }, { i: 3, d: 1 }], [{ i: 3, d: 0 }, { i: 3, d: 1 }]];
    for (const [cev, want] of shapes) {
      const save = { ...r0.save, raw: { ...r0.save.raw } }; if (cev === undefined) delete save.raw.cev; else save.raw.cev = cev;
      const s = realDay.simFromSave(save, 'x', KT, vrank), got = evHave(s);
      // 讀進來的狀態（還沒推）：好的 cev 原樣；d 缺或 0 補 1
      const wantLoaded = want ? { i: want.i, d: (cev && +cev.d) || 1 } : null;
      if (J(got) !== J(wantLoaded)) bad.push(`cev=${J(cev)} 讀成 ${J(got)}（要 ${J(wantLoaded)}）`);
      seen.shapes++;
    }
    // 舊碼（沒有 cev 欄位）＝無活動：起步城本身
    const s = realDay.simFromSave(r0.save, 'x', KT, vrank); if (s.cityEvent !== null) bad.push('起步城讀進來就有活動');
  }
  // 讀進來就在活動中的實驗線存檔：接著算（樣本的 ev 由 live 那組驗；這裡看存檔往返）
  for (const id of evolvedIds().filter(id => evolvedCode(id) && decodeLabCode(evolvedCode(id)).save.raw.cev)) {
    const L = loadCode(evolvedCode(id), KT, vrank); if (!L.ok) { bad.push(`${id}：讀不進`); continue; }
    const had = L.sim.cityEvent;
    if (!had) continue;
    const raw = rawOf(L.sim, L);
    if (J(raw.cev) !== J({ i: had.i, d: had.daysLeft })) bad.push(`${id} 讀進來就在活動中：立刻存的 cev ${J(raw.cev)} ≠ ${J({ i: had.i, d: had.daysLeft })}`);
    seen.loads++;
  }
  // 決定性：同一張（有活動的）碼讀兩次，各推 13 天，每天雜湊相同
  for (const seed of [STARTER_SEEDS[0], STARTER_SEEDS[4]]) {
    const L = loadCode(codeWithSeed(startCode, seed), KT, vrank), s = L.sim; for (let d = 0; d < 38; d++) realDay.stepDay(s);
    const code = saveCode(s, L.template, L.start), a = loadCode(code, KT, vrank).sim, b = loadCode(code, KT, vrank).sim;
    for (let d = 1; d <= 13; d++) { realDay.stepDay(a); realDay.stepDay(b); if (realDay.simHash(a) !== realDay.simHash(b)) { bad.push(`${seed} 活動中的存檔讀兩次、之後第 ${d} 天雜湊不同`); break; } }
    seen.det++;
  }
  void fnv1a;
  log(!bad.length, 'D030 驗收 5：存檔——cev 是實驗線既有欄位（有活動寫 {i, d}、沒活動範本有就寫 0、沒有就不加、範本裡的舊活動要蓋掉）；沒有新欄位、d3 欄位與城市格式照舊、歷史沒有新事件；存了再讀回來是同一場、同樣的剩餘天數、之後每天活動狀態與報表相同；缺與壞的 cev 讀成無活動；活動中的存檔讀兩次每天雜湊相同',
    bad.slice(0, 4).join('；') || `${seen.loads} 次讀檔、共推 ${seen.days} 個城日、存檔欄位 ${seen.keys} 個、存讀檔往返 ${seen.trips} 次、cev 形狀 ${seen.shapes} 種、決定性 ${seen.det} 座×13 天`);
}

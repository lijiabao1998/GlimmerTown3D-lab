// D028 Node 守衛（二）：實驗線頁面實跑（驗收 3、7）、接線（驗收 4）、存檔與決定性（驗收 5）。由 tools/unit.mjs 呼叫；vm 逐項與突變（驗收 1、2）在 tools/unit-d028.mjs；瀏覽器半邊在 tools/smoke-d028.mjs。
//   1. 樣本 src/content/samples/d028-lab.json（tools/d028-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀：實驗線版本、回退設定、探針原文、每座城的碼雜湊（＝本線現在產生的）、天數；
//   2. 本線自己讀檔、每天把實驗線那一天用到的、本線沒有的輸入代進去（政策、科技、專精、夜間城市、城市活動的幸福與食物與稅率——跟 D027 同一份 injectInputs；夜間城市的晚間消費金、地鐵與運輸與停車的收入、
//      營運費與車隊的維護費——D025 起就是輸入），推進一天之後跟實驗線逐欄比：資金（不取整）、淨額、稅 R／C／I、十二個其餘收入項、T346 鏈條九欄（供、需、供氣率、化肥、熟食、工資指數、昨天旗標兩個、房貸人口）、
//      食物點數、遊客、旅宿床位與入住、住宅棟數、每一棟住宅的幸福（64 位元浮點逐位）、幸福構成 57 項、城市幸福、人口與就業、下一個亂數（這一天用掉的亂數次數與順序）——
//      自造城 K1–K16 連推 13 天（化肥與熟食是「隔天」才生效）、D022–D025 的 120 座城連推 10 天（分區清成 0／分區不清各一批）；
//   3. 起步城 8 個種子 × 120 天：這一張的東西一項都沒有（旗標、金幣、旅宿全 0）；
//   4. 接線：day.ts 的副本改壞一處要紅（鏈條不結算、旗標沒留到明天、fb 沒餵計數與覆蓋、熟食沒餵幸福、教育與房貸人口的累加、每個收入項沒進 other、雜湊不看旗標……）；
//   5. 存檔與決定性：沒有新欄位、旗標不進存檔（讀檔與存了再讀之後是 false、第一天沒有化肥增產）、同一張碼讀兩次每天相同。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import * as realDay from '../src/sim/day.ts';
import { hashBytes } from '../src/sim/rules/commute.ts';
import { saveCode, loadCode, historyFormat } from '../src/io/save.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import * as MONEY from '../src/sim/rules/money.ts';
import { dayVariant } from './unit-d021.mjs';
import { injectInputs } from './unit-d027-live.mjs';
import { d028Cities, oldList, oldzList, CRAFTED_DAYS, OLD_DAYS, INC_KEYS, PROBE } from './d028-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城
export async function d028LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D028 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 本線這一天結束時的樣子，形狀跟樣本的 row 一樣（樣本另有的 ev、tech、pol、spec 是要代進去的輸入，un、uu 的地鐵、公車、停車、車隊也是；夜間城市 D029 起本線自己算：nc＝[ready, 安全分數, 幸福加減, 晚間消費金, 夜間運輸收入, 夜間營運費]，
// 對的是樣本的 night.ready、night.score、night.hd、ng、un[3]、uu[3]）
export function rowOf28(s, rep) {
  const N = s.w.N, hs = [], c = rep.chain346, t = rep.settle.tax, o = rep.settle.other, n = rep.night;
  for (let i = 0; i < N * N; i++) { const b = s.w.tiles[i].bld; if (b && !b.ref && (b.k === 1 || b.k === 127)) hs.push(i, b.h); }
  return {
    day: s.day, pop: rep.pop, jobs: rep.jobs, happy: rep.cityHappy, money: rep.money, net: rep.settle.income - rep.settle.upkeep,
    tx: [t.R, t.C, t.I], inc: INC_KEYS.map(k => o[k]),
    ch: [c.gasSup, c.gasDem, c.gasRatio, c.fertOut, c.cookedOut, c.wageIdx, c.fertReady, c.cookedReady, c.mortPop],
    fd: rep.food.points, tr: rep.econ.ec.tourists, ho: [c.hotelBeds, c.hotelOcc],
    nc: [n.ready, n.safety.score, n.happinessDelta, n.finance.commerceGold, n.finance.transitRevenue, n.finance.operatingCost],
    nh: hs.length / 2, hh: hashBytes(Float64Array.from(hs)), ah: hashBytes(Float64Array.from(rep.happyAgg)), agg: rep.happyAgg, peek: s.rng.R(),
  };
}
const labNc = row => [row.night.ready, row.night.score, row.night.hd, row.ng, row.un[3], row.uu[3]];   // 樣本裡對應 nc 的六個值
const FIELDS = ['day', 'pop', 'jobs', 'happy', 'money', 'net', 'tx', 'inc', 'ch', 'fd', 'tr', 'ho', 'nc', 'nh', 'hh', 'ah', 'peek'];
const NAMES = { day: '日', pop: '人口', jobs: '就業', happy: '城市幸福', money: '資金', net: '淨額（收入−維護費）', tx: '稅 R／C／I', inc: '其餘收入十二項', ch: 'T346 鏈條九欄', fd: '食物點數', tr: '遊客', ho: '旅宿床位與入住', nc: '夜間城市六欄（ready、安全分數、幸福加減、晚間消費金、夜間運輸收入、夜間營運費）', nh: '住宅棟數', hh: '每一棟住宅的幸福', ah: '幸福構成雜湊', agg: '幸福構成', peek: '下一個亂數（亂數次數或順序不同）' };
// 政策開著的城：本線沒有政策（K）的稅率、日費與收入加成，資金、淨額、稅不判（其餘欄位照判）
const MONEYF = ['money', 'net', 'tx'];
const polOn = p => Object.entries(JSON.parse(p)).some(([k, v]) => v === true || (/^tax[RCI]$/.test(k) && v !== 1));

// 一座城連推 rec.days 天，逐天跟實驗線比。mod＝day.ts（真的或改壞的）。
// 回 { d: [不同處], days, first: 第一個不同的日子（0＝沒有）, fields: 任何一天不同的欄位鍵, firstFields: 第一個不同的日子裡不同的欄位鍵, parts: 第一個不同的日子裡幸福構成不同的項, judgedMoney: 判了資金的天數 }
// onDay(day, mine, row, rep, sim)：每天比完之後呼叫
export function compareCity28(mod, code, rec, KT, vrank, { stopAtFirst = true, onDay } = {}) {
  const r = decodeLabCode(code), s = mod.simFromSave(r.save, code, KT, vrank), d = [], out = { d, days: 0, first: 0, fields: [], firstFields: [], parts: [], judgedMoney: 0 };
  let prev = rec.start;
  const st = { pol: rec.start.pol, tech: rec.start.tech, spec: rec.start.spec };   // 政策、科技、專精：樣本裡跟前一列一樣的不存（tools/d027-lab.mjs compactRows），往前找最近一次記的
  for (let day = 1; day <= rec.days; day++) {
    const row = rec.rows[day - 1], dd = [], ff = [];
    const inj = injectInputs(s, st, prev, row, true);
    if (inj.err) return { ...out, d: [inj.err], days: day, first: day };
    const ev = row.ev;
    const class2 = {   // 夜間城市（晚間消費金、夜間運輸收入、夜間營運費）D029 起不代，本線自己算
      economy: ev ? { eventFood: ev.food } : undefined, eventTax: ev ? ev.tax : null,
      other: { metroRev: row.un[0], metroAds: row.un[1], transitRev: row.un[2], parkingRevenue491: row.un[4] },
      upkeep: { metroCost: row.uu[0], railOpsCost463: row.uu[1], busOpsCost468: row.uu[2], svcFleet: { fire: row.uu[4], police: row.uu[5], amb: row.uu[6] } },
    };
    const rep = mod.stepDay(s, { hazard: inj.hazard, class2 });
    const mine = rowOf28(s, rep), skipMoney = polOn(st.pol);
    if (!skipMoney) out.judgedMoney++;
    for (const k of FIELDS) {
      if (skipMoney && MONEYF.includes(k)) continue;
      const lv = k === 'nc' ? labNc(row) : row[k];
      if (J(mine[k]) !== J(lv)) { dd.push(`${NAMES[k]} 本線 ${J(mine[k])} ≠ 實驗線 ${J(lv)}`); ff.push(k); }
    }
    if (row.agg && J(mine.agg) !== J(row.agg)) { const at = HAPPY_NAMES.filter((n, i) => J(mine.agg[i]) !== J(row.agg[i])); dd.push(`幸福構成的項不同：${at.join('、')}`); if (!out.first) out.parts = at; ff.push('agg'); }
    for (const k of ff) if (!out.fields.includes(k)) out.fields.push(k);
    onDay?.(day, mine, row, rep, s);
    prev = row; out.days = day; for (const k of ['pol', 'tech', 'spec']) if (row[k] !== undefined) st[k] = row[k];
    if (dd.length) { d.push(`第 ${day} 天：${dd.slice(0, 4).join('；')}`); if (!out.first) { out.first = day; out.firstFields = ff; } if (stopAtFirst) return out; }
  }
  return out;
}

// 已知只差幸福的城（D027 收工時是三座：seed516、G14、D3；D028 補了 G14 的熟食供應）：差的欄位只准是這幾個
const HK = ['happy', 'hh', 'ah', 'agg'];
const KNOWN = { seed516: 'T133 城市等級（微光之巔 +.02）', D3: 'T442 污水（管網讓近旁工業每座加 .025）' };

async function guards(log) {
  const lab = JSON.parse(read('src/content/samples/d028-lab.json')), cities = d028Cities(), olds = oldList(), oldzs = oldzList();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, cities, KT, vrank });

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (lab.source?.probe !== PROBE) bad.push('樣本的探針原文 ≠ tools/d028-lab.mjs 現在的探針（重跑 tools/d028-lab.mjs）');
    if (J(lab.order) !== J(cities.map(c => c.id))) bad.push('樣本裡自造城的順序 ≠ tools/d028-cities.mjs 現在的順序（重跑 tools/d028-lab.mjs）');
    for (const c of cities) { const L = lab.crafted[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else { if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d028-lab.mjs）`); if (L.rows.length !== CRAFTED_DAYS) bad.push(`${c.id}：記了 ${L.rows.length} 天，要 ${CRAFTED_DAYS} 天`); if (!L.rows[0].agg) bad.push(`${c.id}：沒有逐項幸福構成`); } }
    if (J(lab.oldOrder) !== J(olds.map(c => c.id))) bad.push('樣本裡 D022–D025 城的順序 ≠ 現在的順序（重跑 tools/d028-lab.mjs）');
    for (const c of olds) { const L = lab.old?.[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同`); else if (L.rows.length !== OLD_DAYS) bad.push(`${c.id}：記了 ${L.rows.length} 天，要 ${OLD_DAYS} 天`); }
    for (const c of oldzs) { const L = lab.oldz?.[c.id]; if (!L) bad.push(`${c.id}（分區不清）：沒有記錄`); else if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}（分區不清）：本線產生的碼跟錄樣本時不同`); else if (L.rows.length !== OLD_DAYS) bad.push(`${c.id}（分區不清）：記了 ${L.rows.length} 天，要 ${OLD_DAYS} 天`); }
    log(!bad.length, `D028 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；自造城 ${cities.length} 座連推 ${CRAFTED_DAYS} 天（逐項幸福構成）、D022–D025 的城 ${olds.length} 座連推 ${OLD_DAYS} 天（分區清成 0 與不清各一批）；探針原文與碼雜湊＝本線現在的`,
      bad.slice(0, 4).join('；') || `crafted ${Object.keys(lab.crafted).length}、old ${Object.keys(lab.old).length}、oldz ${Object.keys(lab.oldz).length}，錄了 ${lab.seconds} 秒`);
    if (bad.length) return;
  }

  // ---- 2. 逐天對拍（驗收 3）----
  const runSet = (mod, list, get, opts) => list.map(c => ({ id: c.id, ...compareCity28(mod, c.code, get(c.id), KT, vrank, opts) }));
  const crafted = runSet(realDay, cities, id => lab.crafted[id], { stopAtFirst: false });
  const olds1 = runSet(realDay, olds, id => lab.old[id], { stopAtFirst: false });
  const oldzs1 = runSet(realDay, oldzs, id => lab.oldz[id], { stopAtFirst: false });
  Object.assign(LIVE, { crafted, olds1, oldzs1 });
  const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);
  const nz = (rows, f) => rows.filter(f).length;
  {
    // 覆蓋（量實驗線那邊的樣本：這些情況真的發生過才有意義）
    const R = k => Object.values(lab.crafted).flatMap(L => L.rows.map(r => ({ id: k, r })));
    const all = Object.entries(lab.crafted).flatMap(([id, L]) => L.rows.map((r, i) => ({ id, i, r })));
    const IK = Object.fromEntries(INC_KEYS.map((k, q) => [k, q]));
    const cov = {
      化肥昨天有: nz(all, x => x.r.ch[6]), 熟食昨天有: nz(all, x => x.r.ch[7]), 部分供氣: nz(all, x => x.r.ch[2] > 0 && x.r.ch[2] < 1), 完全沒氣: nz(all, x => x.r.ch[2] === 0 && x.r.ch[1] > 0),
      農場金: nz(all, x => x.r.inc[IK.farmGold] > 0), 牧場金: nz(all, x => x.r.inc[IK.ranchGold] > 0), 食品加工: nz(all, x => x.r.inc[IK.procGold] > 0), 旅宿: nz(all, x => x.r.inc[IK.lodgeRev] > 0), 農貿市場: nz(all, x => x.r.inc[IK.mktGold] > 0),
      釀酒: nz(all, x => x.r.inc[IK.brewGold] > 0), 科技園: nz(all, x => x.r.inc[IK.techGold] > 0), 數據中心: nz(all, x => x.r.inc[IK.dcGold] > 0), 熟食金: nz(all, x => x.r.inc[IK.cookGold] > 0), 銀行利息: nz(all, x => x.r.inc[IK.bankInt] > 0),
      遊客多過床位: nz(all, x => x.r.tr > x.r.ho[0] && x.r.ho[0] > 0), 遊客少過床位: nz(all, x => x.r.tr < x.r.ho[0]),
    };
    void R;
    const errs = crafted.filter(x => x.d.length).map(x => `${x.id} ${x.d[0]}`);
    const NEED = { 化肥昨天有: 20, 熟食昨天有: 20, 部分供氣: 8, 完全沒氣: 4, 農場金: 60, 牧場金: 20, 食品加工: 10, 旅宿: 20, 農貿市場: 10, 釀酒: 4, 科技園: 20, 數據中心: 10, 熟食金: 20, 銀行利息: 6, 遊客多過床位: 10, 遊客少過床位: 10 };
    const lack = Object.entries(NEED).filter(([k, v]) => cov[k] < v).map(([k, v]) => `${k} ${cov[k]}<${v}`);
    if (lack.length) errs.push(`覆蓋不夠：${lack.join('、')}`);
    log(!errs.length, `D028 驗收 3：實驗線頁面實跑（自造城）——K1–K16 讀進來連推 ${CRAFTED_DAYS} 天（化肥廠有／沒有天然氣井、農場在化肥廠覆蓋內外、中央廚房與熟食、食物分配鏈、旅宿四種〔遊客多於與少於床位〕、科技園〔教育高與零〕、數據中心、銀行與房貸人口、大型購物中心 lv1–4 與沒電起火、四個季節）：`
      + '每天逐項相等——資金（不取整）、淨額、稅 R／C／I、十二個其餘收入項、T346 鏈條九欄、食物點數、遊客、旅宿床位與入住、住宅棟數、每一棟住宅的幸福、幸福構成 57 項、城市幸福、人口與就業、下一個亂數',
      errs.slice(0, 4).join('｜') || `${crafted.length} 座、${sum(crafted, x => x.days)} 個城日全等（資金判了 ${sum(crafted, x => x.judgedMoney)} 個城日）；實驗線這邊：` + Object.entries(cov).map(([k, v]) => `${k} ${v}`).join('、'));
  }
  {
    // D022–D025 的 120 座城，分區清成 0 與不清各一批，連推 10 天：全等的城每一欄每一天全等；已知只差幸福的城（seed516、D3）只准差在幸福的欄位
    for (const [tag, rows, labSet] of [['分區清成 0', olds1, lab.old], ['分區不清——會長新房子、升級、廢棄，亂數全在跑', oldzs1, lab.oldz]]) {
      const bad = rows.filter(x => x.d.length), errs = [];
      for (const x of bad) {
        if (!KNOWN[x.id]) errs.push(`${x.id} 不在已知名單：${x.d[0].slice(0, 200)}`);
        else if (x.fields.some(f => !HK.includes(f))) errs.push(`${x.id} 除了幸福還有別的欄位不同：${x.fields.join('、')}（${x.d[0].slice(0, 120)}）`);
      }
      for (const id of Object.keys(KNOWN)) if (!bad.some(x => x.id === id)) errs.push(`${id}：這一次沒有差了（本線補了這個系統？把它從已知名單拿掉）`);
      const inc = (L, q) => L.rows.some(r => r.inc[q] > 0), IK = Object.fromEntries(INC_KEYS.map((k, q) => [k, q]));
      const cov = Object.fromEntries(['farmGold', 'ranchGold', 'procGold', 'lodgeRev', 'mktGold', 'techGold', 'dcGold', 'cookGold'].map(k => [k, nz(Object.values(labSet), L => inc(L, IK[k]))]));
      const fertCities = nz(Object.values(labSet), L => L.rows.some(r => r.ch[6])), cookCities = nz(Object.values(labSet), L => L.rows.some(r => r.ch[7]));
      if (rows.length !== 120) errs.push(`只有 ${rows.length} 座`);
      const gWhole = rows.find(x => x.id === 'G14');
      log(!errs.length, `D028 驗收 3：實驗線頁面實跑（D022–D025 的 120 座城，${tag}）——連推 10 天，逐天逐欄跟實驗線比（資金、淨額、稅、十二個收入項、鏈條九欄、食物、遊客、旅宿、每一棟住宅的幸福、幸福構成、人口就業、下一個亂數）：全等的城每一欄每一天全等；`
        + `D027 收工時只差幸福的三座裡 G14（熟食供應）現在整條全等，seed516（T133 城市等級）與 D3（T442 污水）照舊只差幸福`,
        errs.slice(0, 4).join('｜') || `${rows.length} 座、${sum(rows, x => x.days)} 個城日：${rows.length - bad.length} 座每一欄全等（G14 ${gWhole?.d.length ? '有差' : '全等'}）、${bad.length} 座只差幸福（${bad.map(x => `${x.id}：${KNOWN[x.id]}，差在 ${x.fields.join('、')}，第 ${x.first} 天起`).join('；')}）；資金判了 ${sum(rows, x => x.judgedMoney)} 個城日；`
          + `有收入的城 ` + Object.entries(cov).map(([k, v]) => `${k} ${v}`).join('、') + `；有化肥的城 ${fertCities}、有熟食的城 ${cookCities}`);
    }
  }
  const ctx = { lab, cities, olds, KT, vrank };
  await starterGuards(log, ctx);
  await wiringGuards(log, ctx);
  await persistGuards(log, ctx);
  await foldGuards(log, ctx);
}

// ---- 3. 起步城 8 個種子 × 120 天（驗收 7）：這一張的東西一項都沒有 ----
async function starterGuards(log, { KT, vrank }) {
  const startCode = read('src/content/samples/starter.code.txt').trim(), bad = [];
  let days = 0, tradeDays = 0;
  for (const seed of STARTER_SEEDS) {
    const code = codeWithSeed(startCode, seed), s = realDay.simFromSave(decodeLabCode(code).save, code, KT, vrank);
    for (let d = 0; d < 120; d++) {
      const rep = realDay.stepDay(s), o = rep.settle.other, c = rep.chain346; days++;
      const any = ['farmGold', 'ranchGold', 'ghGold', 'procGold', 'lodgeRev', 'mktGold', 'brewGold', 'techGold', 'dcGold', 'cookGold', 'bankInt'].filter(k => o[k] !== 0);
      if (o.tradeGold > 0) tradeDays++;
      if (any.length || c.fertOut || c.cookedOut || c.fertReady || c.cookedReady || c.hotelBeds || c.hotelOcc || c.mortPop || s.fertReady || s.cookedReady) { bad.push(`${seed} 第 ${s.day} 天：${any.join('、') || '鏈條或旅宿'} 不是 0`); break; }
    }
  }
  log(!bad.length, '起步城沒有這一張碰到的建築（農場、牧場、溫室、天然氣井、化肥廠、中央廚房、食品加工、農貿市場、釀酒、旅宿、銀行、科技園、數據中心、購物中心）：8 個種子 × 120 天，十一個新收入項、化肥與熟食產出與旗標、旅宿床位、房貸人口每天全是 0（貿易與天然氣出口照 D025）',
    bad.slice(0, 3).join('；') || `${STARTER_SEEDS.length} 個種子 × 120 天＝${days} 個城日全 0（貿易金幣＞0 的城日 ${tradeDays}：D025 的東西照舊）`);
}

// ---- 4. 接線（驗收 4）：day.ts 的副本改壞一處，這批要紅 ----
// 一種是「實驗線頁面實跑對不上」（lab）：K1–K10 各連推 13 天，隨便一項不同就算抓到；
// 另一種是「雜湊不看」（hash）：化肥旗標、熟食旗標各設成 true，simHash 要變（決定性守衛靠它；兩個旗標都是 false 時雜湊不變，由 D010–D027 的黃金樣本擔保）。
export async function wiringGuards(log, { lab, cities, KT, vrank }) {
  const SUBC = ['K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8', 'K9', 'K10'];
  const codeOf = id => cities.find(c => c.id === id).code;
  const dayBad = mod => {
    try { for (const id of SUBC) { const r = compareCity28(mod, codeOf(id), lab.crafted[id], KT, vrank); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; } }
    catch (e) { return `丟例外 ${e.message.slice(0, 60)}`; }
    return null;
  };
  const hashBad = mod => {
    const c = codeOf('K1'), r = decodeLabCode(c), fresh = () => mod.simFromSave(r.save, c, KT, vrank), base = mod.simHash(fresh());
    const h = (f, k) => { const q = fresh(); q.fertReady = f; q.cookedReady = k; return mod.simHash(q); };
    // 兩個旗標各自要看得到：另一個固定成 true 時，這一個變了雜湊要變；只要有一個為真就不能跟兩個都 false 的一樣
    const blind = [];
    if (h(true, true) === h(false, true)) blind.push('化肥旗標');
    if (h(true, true) === h(true, false)) blind.push('熟食旗標');
    if (h(true, false) === base || h(false, true) === base) blind.push('單獨一個旗標為真');
    return blind.length ? `雜湊不看：${blind.join('、')}` : null;
  };
  const V0 = await dayVariant([]);
  const OTHER_ITEMS = ['farmGold', 'ranchGold', 'procGold', 'ghGold', 'lodgeRev', 'mktGold', 'brewGold', 'techGold', 'dcGold', 'cookGold', 'bankInt'];
  const MUT = [
    ['鏈條不結算（兩個旗標都不留）', [['s.fertReady = chain.fertReady; s.cookedReady = chain.cookedReady;', 's.fertReady = false; s.cookedReady = false;']], 'lab'],
    ['化肥旗標沒留到明天', [['s.fertReady = chain.fertReady; s.cookedReady', 's.fertReady = false; s.cookedReady']], 'lab'],
    ['熟食旗標沒留到明天', [['s.cookedReady = chain.cookedReady;', 's.cookedReady = false;']], 'lab'],
    ['fb 沒餵計數（農場不增產）', [['const fert = { ready: s.fertReady, fertco: f.COV.fertco };', 'const fert = { ready: false, fertco: f.COV.fertco };']], 'lab'],
    ['fb 不看化肥廠覆蓋（全城農場都增產）', [['const fert = { ready: s.fertReady, fertco: f.COV.fertco };', 'const fert = { ready: s.fertReady, fertco: f.COV.fertco.map(() => 1) };']], 'lab'],
    ['熟食旗標沒餵幸福', [['cookedReady: s.cookedReady,', 'cookedReady: false,']], 'lab'],
    ['化肥廠數不進鏈條', [['fp346: cnt.fp346 ?? 0, kitchenFoodUse482', 'fp346: 0, kitchenFoodUse482']], 'lab'],
    ['廚房食物用量不進鏈條', [['kitchenFoodUse482: ec.kitchenFoodUse482, gasRatio: ec.gasRatio });', 'kitchenFoodUse482: 0, gasRatio: ec.gasRatio });']], 'lab'],
    ['供氣率不進鏈條（恆 1）', [['kitchenFoodUse482: ec.kitchenFoodUse482, gasRatio: ec.gasRatio });', 'kitchenFoodUse482: ec.kitchenFoodUse482, gasRatio: 1 });']], 'lab'],
    ['季節不進收入項（恆春天）', [['sea, foodPrice: ec.foodPrice481, tourists: ec.tourists,', 'sea: 0, foodPrice: ec.foodPrice481, tourists: ec.tourists,']], 'lab'],
    ['食物價格不進收入項', [['sea, foodPrice: ec.foodPrice481, tourists: ec.tourists,', 'sea, foodPrice: 1, tourists: ec.tourists,']], 'lab'],
    ['遊客不進旅宿', [['sea, foodPrice: ec.foodPrice481, tourists: ec.tourists,', 'sea, foodPrice: ec.foodPrice481, tourists: 0,']], 'lab'],
    ['農場金的輸入不進', [['farmGoldU: cnt.farmGoldU ?? 0,', 'farmGoldU: 0,']], 'lab'],
    ['牧場金的輸入不進', [['ranchGoldU: cnt.ranchGoldU ?? 0,', 'ranchGoldU: 0,']], 'lab'],
    ['溫室金的輸入不進', [['ghGoldU: cnt.ghGoldU ?? 0,', 'ghGoldU: 0,']], 'lab'],
    ['食品加工用量不進', [['foodPlantUse482: ec.foodPlantUse482,', 'foodPlantUse482: 0,']], 'lab'],
    ['農貿市場用量不進', [['marketFoodUse482: ec.marketFoodUse482,', 'marketFoodUse482: 0,']], 'lab'],
    ['釀酒用量不進', [['brewFoodUse482: ec.brewFoodUse482,', 'brewFoodUse482: 0,']], 'lab'],
    ['民宿數不進', [['gh330: cnt.gh330 ?? 0,', 'gh330: 0,']], 'lab'],
    ['度假酒店數不進', [['rs330: cnt.rs330 ?? 0,', 'rs330: 0,']], 'lab'],
    ['青旅數不進', [['hs340: cnt.hs340 ?? 0,', 'hs340: 0,']], 'lab'],
    ['科技園數不進', [['tpk342: cnt.tpk342 ?? 0,', 'tpk342: 0,']], 'lab'],
    ['數據中心數不進', [['dtc342: cnt.dtc342 ?? 0,', 'dtc342: 0,']], 'lab'],
    ['教育總和不累加', [['eduSum += f.EDU[i]; eduCnt++;', 'eduCnt++;']], 'lab'],
    ['教育計數不累加', [['eduSum += f.EDU[i]; eduCnt++;', 'eduSum += f.EDU[i];']], 'lab'],
    ['房貸人口不算', [['if (b.k === 1 && f.COV.bank && f.COV.bank[i] > 0 && b.pw) mortPop += residentPop;', 'void 0;']], 'lab'],
    // 「房貸人口不看有電」是等價突變，不列：沒電的住宅 residentPopulation488 就是 0 個居民（K9 的四棟覆蓋內沒電的住宅 pop 0），加不加 b.pw 結果一樣
    ['房貸人口不看銀行覆蓋', [['b.k === 1 && f.COV.bank && f.COV.bank[i] > 0 && b.pw) mortPop', 'b.k === 1 && b.pw) mortPop']], 'lab'],
    ['工資指數不進報表', [['wageIdx: ec.laborNow481.wageIndex,', 'wageIdx: 0,']], 'lab'],
    ...OTHER_ITEMS.map(k => [`${k} 沒進 other（收入不入帳）`, [[`${k}: x.${k}`, `${k}: 0`]], 'lab']),
    ['雜湊不看化肥旗標', [['...(s.fertReady || s.cookedReady ? [s.fertReady, s.cookedReady] : []),', '...(s.fertReady || s.cookedReady ? [s.cookedReady] : []),']], 'hash'],
    ['雜湊不看熟食旗標', [['...(s.fertReady || s.cookedReady ? [s.fertReady, s.cookedReady] : []),', '...(s.fertReady || s.cookedReady ? [s.fertReady] : []),']], 'hash'],
  ];
  const bad = [], out = [], base0 = [dayBad(V0), hashBad(V0)].filter(Boolean);
  if (base0.length) bad.push(`沒改的副本就有不對：${base0.join('｜')}`);
  for (const [name, edits, who] of MUT) {
    let V; try { V = await dayVariant(edits); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    const why = who === 'lab' ? dayBad(V) : hashBad(V);
    out.push(`${name}：${why ? (who === 'lab' ? '對拍' : '雜湊') + '（' + why.slice(0, 44) + '）' : '沒抓到'}`);
    if (!why) bad.push(`「${name}」沒抓到（要由${who === 'lab' ? '實驗線對拍' : '雜湊'}抓）`);
  }
  log(!bad.length, `D028 驗收 4：接線——day.ts 的副本改壞一處（${MUT.length} 個：鏈條不結算、兩個旗標各自沒留到明天、化肥旗標同天生效、fb 沒餵計數與不看覆蓋、熟食沒餵幸福、化肥廠數與廚房用量與供氣率不進鏈條、季節與食物價格與遊客不進收入項、各種輸入計數不進、教育與房貸人口的累加、工資指數、十一個收入項各自沒進 other、雜湊不看兩個旗標）：每一個都要被實驗線對拍（K1–K10 連推 13 天）或雜湊抓到；沒改的先核過全等`,
    bad.slice(0, 5).join('；') || out.join('；'));
}

// ---- 5. 存檔與決定性（驗收 5）----
export async function persistGuards(log, { cities, KT, vrank }) {
  const bad = [], seen = { loads: 0, days: 0, trips: 0, keys: 0, fresh: 0 };
  const codeOf = id => cities.find(c => c.id === id).code;
  // 世界歷史目前有的事件種類（D027 收工時）：這一張不加新事件
  const KNOWN_EVENTS = new Set(['import', 'restyle', 'grow', 'upgrade', 'build', 'demolish', 'zone', 'road', 'place', 'pipe', 'park', 'tree', 'doze', 'clear', 'undo', 'decay', 'overgrow', 'roofless', 'collapse', 'police', 'fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act']);
  // 存檔裡推了幾天才會多出來的欄位（D025 的貨物庫存與船：非零才寫）；這一張的旗標與收入不准出現在存檔
  const ECON_OPT = new Set(['fuel364', 'steel364', 'shipCount', 'shipProgress']);
  // 旗標不進存檔：K1（化肥）、K3（熟食）、K4（鏈）讀進來是 false；推到旗標為真的那天存檔，欄位集合＝剛讀進來就存的；讀回來是 false；讀回來的第一天沒有增產（跟沒存檔一直推下去的那一份不同）
  for (const id of ['K1', 'K3', 'K4']) {
    const c = codeOf(id), L = loadCode(c, KT, vrank);
    if (!L.ok) { bad.push(`${id}：讀不進 ${L.error}`); continue; }
    const sm = L.sim; seen.loads++;
    if (sm.fertReady !== false || sm.cookedReady !== false) bad.push(`${id} 剛讀進來旗標不是 false（化肥 ${sm.fertReady}、熟食 ${sm.cookedReady}）`);
    let firstOn = 0;
    const want = id === 'K1' ? 'fertReady' : 'cookedReady';   // K1：化肥廠與農場；K3、K4：中央廚房
    for (let d = 1; d <= 6; d++) {
      const rep = realDay.stepDay(sm); seen.days++;
      if (sm.fertReady !== rep.chain346.fertReady || sm.cookedReady !== rep.chain346.cookedReady) bad.push(`${id} 第 ${sm.day} 天 Sim 的旗標跟當天的鏈條結果不同`);
      if (sm[want] && !firstOn) firstOn = sm.day;
    }
    if (!firstOn) { bad.push(`${id} 推 6 天旗標從沒變真（測試沒有意義）`); continue; }
    const L0 = loadCode(c, KT, vrank), raw0 = decodeLabCode(saveCode(L0.sim, L0.template, L0.start)).save.raw, code = saveCode(sm, L.template, L.start), raw1 = decodeLabCode(code).save.raw;
    const extra = Object.keys(raw1).filter(k => !(k in raw0) && !ECON_OPT.has(k)), gone = Object.keys(raw0).filter(k => !(k in raw1)), d3ok = Object.keys(raw1.d3 ?? {}).every(k => ['f', 's', 'g', 'hv', 'r', 'h', 'j', 't'].includes(k));
    if (extra.length || gone.length || !d3ok || Object.keys(raw1).some(k => /fert|cooked|chain|ready|mort|hotel/i.test(k))) bad.push(`${id} 存檔的欄位跟剛讀進來就存的不同：多 ${extra.join('、') || '無'}、少 ${gone.join('、') || '無'}｜d3 欄位 ${Object.keys(raw1.d3 ?? {}).join('、')}`);
    seen.keys = Object.keys(raw1).length;
    const h = sm.city.history, hz = h.some(e => ['fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act'].includes(e.t));
    if (h.some(e => !KNOWN_EVENTS.has(e.t))) bad.push(`${id} 歷史裡有不認得的事件：${[...new Set(h.map(e => e.t))].join('、')}`);
    if (hz ? historyFormat(h) !== 6 || raw1.d3.f !== 6 : historyFormat(h) > 5 || raw1.d3.f > 5) bad.push(`${id} 城市格式 ${raw1.d3.f}（有災禍事件要 6、沒有不能寫 6）`);
    const q = loadCode(code, KT, vrank);
    if (!q.ok || !q.replayed) { bad.push(`${id} 存了再讀回失敗：${q.ok ? q.note : q.error}`); continue; }
    if (q.sim.fertReady !== false || q.sim.cookedReady !== false) bad.push(`${id} 第 ${sm.day} 天存檔再讀回來旗標不是 false`);
    seen.trips++;
    // 讀回來的第一天沒有增產與熟食幸福；沒存檔一直推下去的那一份有
    const day0 = sm.day, a = realDay.stepDay(sm), b = realDay.stepDay(q.sim);   // a：一直推下去的（旗標 true）；b：讀回來的（旗標 false）
    if (want === 'fertReady' && !(a.food.points > b.food.points)) bad.push(`${id} 第 ${day0 + 1} 天：一直推下去的食物點數 ${a.food.points} 要比讀回來第一天的 ${b.food.points} 大（化肥增產只在昨天有化肥時才有，旗標不存檔）`);
    if (want === 'cookedReady') { const q0 = HAPPY_NAMES.indexOf('熟食供應'), ha = a.happyAgg[q0], hb = b.happyAgg[q0]; if (!(ha > 0) || hb !== 0) bad.push(`${id} 第 ${day0 + 1} 天：熟食供應項 一直推下去 ${ha}、讀回來第一天 ${hb}（要 > 0、且讀回來第一天是 0）`); }
    seen.days += 2;
  }
  // 決定性：同一座城讀兩次各推 13 天，每天雜湊與整列記錄相同（K1、K4、K10）；第 5 天的存檔讀兩次也一樣
  for (const id of ['K1', 'K4', 'K10']) {
    const a = loadCode(codeOf(id), KT, vrank).sim, b = loadCode(codeOf(id), KT, vrank).sim;
    for (let d = 1; d <= 13; d++) { const ra = realDay.stepDay(a), rb = realDay.stepDay(b); if (realDay.simHash(a) !== realDay.simHash(b) || J(rowOf28(a, ra)) !== J(rowOf28(b, rb))) { bad.push(`${id} 同一張碼讀兩次、第 ${d} 天不同`); break; } }
    const L = loadCode(codeOf(id), KT, vrank), s5 = L.sim; for (let d = 0; d < 5; d++) realDay.stepDay(s5);
    const code5 = saveCode(s5, L.template, L.start), a2 = loadCode(code5, KT, vrank).sim, b2 = loadCode(code5, KT, vrank).sim;
    for (let d = 1; d <= 8; d++) { realDay.stepDay(a2); realDay.stepDay(b2); if (realDay.simHash(a2) !== realDay.simHash(b2)) { bad.push(`${id} 第 5 天的存檔讀兩次、之後第 ${d} 天雜湊不同`); break; } }
    seen.fresh++;
  }
  log(!bad.length, 'D028 驗收 5：存檔——化肥與熟食的旗標不進存檔（沒有新欄位、d3 欄位照舊、歷史沒有新事件、城市格式照 D026 規則）；讀檔與存了再讀後旗標是 false，讀回來的第一天沒有化肥增產與熟食幸福（一直推下去的那一份有）；同一張碼讀兩次、存檔讀兩次，每天雜湊與整列記錄相同',
    bad.slice(0, 4).join('；') || `${seen.loads} 座城讀檔旗標 false、共推 ${seen.days} 個城日、存檔欄位 ${seen.keys} 個（旗標為真那天存也沒有新欄位）、存讀檔 ${seen.trips} 次、決定性 ${seen.fresh} 座×（13 天＋存檔後 8 天）`);
}

// ---- 6. 效能（D028 收工時的整理）：stepDay 的初始掃描順手算的三個值（道路維護費、基建維護費、第一個高壓線格）＝原函式的值 ----
// 每天本來就要走過每一格一次（建索引），把 roadUpkeep（money.ts）、infraUpkeep475（同）、hvEnergizedSubstations471 的「找第一個高壓線格」折進去，
// 省三趟整圖掃描（同一機器 A/B 每天 2.54 → 2.27 ms，見卡面）。折進去要跟原來逐位相同：拿 day.ts 的副本（不給 scan、不給 hvFirst＝各掃一趟的原版）跟真的比，
// D022–D025 的 120 座城各推 3 天，比每天的維護費、收入、資金、simHash；另外造一個有高壓線格的情境（本線蓋不出高壓線、樣本城也沒有）走 hvFirst < n 那一支。
// 折進去的每一行改壞一處，這批要紅（高壓線那一行例外：沒有可觀察的差，見卡面）。
export async function foldGuards(log, { olds, KT, vrank }) {
  const bad = [], stat = { cities: 0, days: 0, road: 0, infra: 0, hvCity: 0 };
  const V0 = await dayVariant([]), ORIG = await dayVariant([
    ['spec: s.edu.spec }, scan), ...(e ? { imports: e.imports } : {})', 'spec: s.edu.spec }), ...(e ? { imports: e.imports } : {})'],
    ['computePower(w, false, false, hvFirst).cap', 'computePower(w).cap'],
  ]);
  const run = (mod, code, days, prep) => {
    const r = decodeLabCode(code), s = mod.simFromSave(r.save, code, KT, vrank); prep?.(s);
    const out = []; for (let d = 0; d < days; d++) { const rep = mod.stepDay(s); out.push(J([rep.settle.upkeep, rep.settle.income, rep.money, mod.simHash(s)])); }
    return { out, w: s.w };
  };
  const differs = (mod, prep, list = olds) => { for (const c of list) { const a = run(mod, c.code, 3, prep), b = run(ORIG, c.code, 3, prep); if (J(a.out) !== J(b.out)) return c.id; } return null; };
  const infraIds = new Set();
  for (const c of olds) { const r = run(V0, c.code, 3); stat.cities++; stat.days += 3; if (MONEY.roadUpkeep(r.w) > 0) stat.road++; if (MONEY.infraUpkeep475(r.w) > 0) { stat.infra++; infraIds.add(c.id); } }
  const SUB = [...olds.filter(c => infraIds.has(c.id)), ...olds.filter(c => !infraIds.has(c.id)).slice(0, 8)];   // 突變只用有基建維護費的城加幾座別的（每次呼叫夠快；全部 120 座已經在上面跟原版比過）
  const roadPrep = s => { for (const t of s.w.tiles) if (t.road) { t.rc = 0; break; } };   // 路格沒有等級（rc 缺）＝預設 2 級：只有這樣造才看得到預設值那一支
  const w0 = differs(V0); if (w0) bad.push(`真的跟原版不同：${w0}`);
  const w2 = differs(V0, roadPrep, SUB); if (w2) bad.push(`有路格沒等級的情境跟原版不同：${w2}`);
  const hvPrep = s => { const n = s.w.N * s.w.N; for (const i of [n >> 1, (n >> 1) + 1, n - 3]) s.w.tiles[i].hv471 = 1; };
  const w1 = differs(V0, hvPrep); if (w1) bad.push(`有高壓線格的情境跟原版不同：${w1}`); else stat.hvCity = olds.length;
  const MUT = [
    ['道路維護費不加', [['roadUp += ROAD_UPKEEP[((t.rc as number) || 2) - 1];', 'roadUp += 0;']]],
    ['道路維護費用錯等級', [['roadUp += ROAD_UPKEEP[((t.rc as number) || 2) - 1];', 'roadUp += ROAD_UPKEEP[((t.rc as number) || 3) - 1];']]],
    ['手工配電線 .035→.036', [['if (t.lv475) infraUp += .035;', 'if (t.lv475) infraUp += .036;']]],
    ['地下線 .018→.019', [['if (t.ud475) infraUp += .018;', 'if (t.ud475) infraUp += .019;']]],
    ['高架 .11→.12', [['if (t.fly475) infraUp += .11;', 'if (t.fly475) infraUp += .12;']]],
    ['立交 .24→.25', [['if (t.ix475) infraUp += .24;', 'if (t.ix475) infraUp += .25;']]],
    ['基建建築不加', [['if (b && !b.ref) infraUp += INFRA_UPKEEP475[b.k] || 0;', 'if (b && !b.ref) infraUp += 0;']]],
    ['基建維護費不取兩位小數', [['infraUpkeep475: +infraUp.toFixed(2)', 'infraUpkeep475: infraUp']]],
  ], out = [];
  for (const [name, edits] of MUT) {
    let V; try { V = await dayVariant(edits); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    const why = differs(V, undefined, SUB) ?? differs(V, roadPrep, SUB.slice(0, 4));
    out.push(`${name}：${why ? '紅（' + why + '）' : '沒抓到'}`);
    if (!why) bad.push(`「${name}」沒抓到`);
  }
  if (stat.road < 100 || stat.infra < 8) bad.push(`覆蓋不夠：有道路的城 ${stat.road}（要 ≥ 100）、有基建維護費的城 ${stat.infra}（要 ≥ 8）`);
  log(!bad.length, `D028 效能整理：stepDay 的初始掃描順手算道路維護費、基建維護費與第一個高壓線格（省三趟整圖掃描）＝原函式的值——${olds.length} 座城 × 3 天（另有高壓線格的情境）逐位相同（每天的維護費、收入、資金、雜湊）；折進去的每一行改壞（${MUT.length} 個）要紅`,
    bad.slice(0, 4).join('；') || `${stat.cities} 座 ${stat.days} 個城日相同（有道路的城 ${stat.road}、有基建維護費的城 ${stat.infra}；有高壓線格的情境 ${stat.hvCity} 座）；${out.join('；')}`);
}

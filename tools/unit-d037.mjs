// D037 Node 守衛：公車路線（bus_rt／bop468，T463／T468）本線沒搬——量出缺口多大、把缺口鎖住。由 tools/unit.mjs 呼叫。
//   1. 樣本 src/content/samples/d037-lab.json（tools/d037-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀：版本、回退設定、探針原文、碼雜湊＝本線現在產生的、T1／T2／T3 各 13 天；
//   2. 對照 T3（有站牌、沒有路線）13 天每一欄逐位相等（D034 的全部欄位；錢也判）——站牌本線早就會讀（D035）、沒有路線時就是全等；
//   3. T1（一條路線）、T2（兩條路線＋營運設定）：不同的欄位只在 nc、happy、money、net、tx、hh、ah、dm 之內；殘差有上限（錢每天不到 0.005、幸福不到 0.0004、13 天累計不到 0.05）；
//      兩邊的殘差一樣大（「有沒有路線」才有差，「幾條、幾輛」沒差別——營運費本線已經由 D028 的輸入帶到了，差的只有路線讓夜間城市多出來的運力分）；
//   4. 實驗線量到的路線效應（樣本內，T1／T2 減 T3）：票收 un[2] 每天 1、營運費 uu[2] 每天 1.1／6.369（每天淨 −0.1／−5.369）、夜間城市分（第 13 天）+0.009／+0.011、第 13 天幸福 +0.0002；
//   5. 玩家實際玩到的（不代任何輸入）：本線 T1、T2、T3 推 13 天的資金與幸福逐位相同＝本線完全不看路線——這是「已知缺口」的鎖：哪天有人把路線搬進來，這一項會紅，要改成逐項對拍；
//   6. 存檔：T1、T2 讀進本線、推幾天、再存：bus_rt、bop468 原樣帶回（本線不看路線，但存檔不能弄丟——實驗線要能照樣讀）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { compareCity33 } from './unit-d033-live.mjs';
import { PROBE } from './d037-lab.mjs';
import { d037Runs, BUS_DAYS } from './d037-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const ALLOWED = ['nc', 'happy', 'money', 'net', 'tx', 'hh', 'ah', 'dm'];
export const BOUND = { moneyDay: 0.005, moneyCum: 0.05, happy: 0.0004 };

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城
export async function d037Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D037 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

async function guards(log) {
  const lab = JSON.parse(read(process.env.D037_SAMPLE ?? 'src/content/samples/d037-lab.json')), runs = d037Runs();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, runs, KT, vrank });
  const T = Object.fromEntries(runs.map(r => [r.id, r]));

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (lab.source?.probe !== PROBE) bad.push('探針原文跟 tools/d034-lab.mjs 現在的不同（重錄）');
    if (J(lab.order) !== J(runs.map(r => r.id))) bad.push('樣本的城清單 ≠ tools/d037-cities.mjs d037Runs() 現在的（重跑 tools/d037-lab.mjs）');
    for (const c of runs) { const L = lab.runs[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code) || L.rows.length !== c.days || c.days !== BUS_DAYS) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同或天數不對（重跑 tools/d037-lab.mjs）`); }
    log(!bad.length, `D037 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；T1 一條路線、T2 兩條路線＋營運設定、T3 沒有路線（對照），各連推 ${BUS_DAYS} 天；探針原文與碼雜湊＝本線現在的`,
      bad.slice(0, 4).join('；') || `runs ${Object.keys(lab.runs).length}，錄了 ${lab.seconds} 秒`);
    if (bad.length) return;
  }

  // ---- 2、3. 逐日對拍（D034 的全部欄位；錢也判）----
  const res = {};
  for (const c of runs) {
    const L = lab.runs[c.id], rec = { days: c.days, start: L.start, rows: L.rows }, dm = [], dh = [];
    const cmp = compareCity33(realDay, c.code, rec, KT, vrank, { stopAtFirst: false, onDay: (day, mine, row) => { dm.push(mine.money - row.money); dh.push(mine.happy - row.happy); } });
    res[c.id] = { cmp, dm, dh };
  }
  {
    const r = res.T3, bad = [];
    if (r.cmp.days !== BUS_DAYS) bad.push(`只比了 ${r.cmp.days} 天（要 ${BUS_DAYS}）`);
    if (r.cmp.d.length) bad.push(`有 ${r.cmp.d.length} 個不同的日子：${r.cmp.d.slice(0, 2).map(s => s.slice(0, 160)).join('｜')}`);
    log(!bad.length, 'D037 驗收 2：對照 T3（有站牌、沒有路線）——13 天、D034 的全部欄位逐位相等，錢也判', bad.join('；') || `${r.cmp.days} 個城日全等；站牌 6 個（本線 D035 起讀）`);
  }
  {
    const bad = [], info = [];
    for (const id of ['T1', 'T2']) {
      const { cmp, dm, dh } = res[id], out = cmp.fields.filter(f => !ALLOWED.includes(f));
      const cum = dm.at(-1), maxDay = Math.max(...dm.map((v, i) => Math.abs(v - (dm[i - 1] ?? 0)))), maxH = Math.max(...dh.map(Math.abs));
      if (cmp.days !== BUS_DAYS) bad.push(`${id}：只比了 ${cmp.days} 天`);
      if (cmp.first !== 1) bad.push(`${id}：差別沒有從第 1 天就出現（第一個不同的日子 ${cmp.first}）——比對可能空了`);
      if (!cmp.fields.length) bad.push(`${id}：跟實驗線全等了——本線是不是搬了路線？這張守衛要改成逐項對拍（見卡面）`);
      if (out.length) bad.push(`${id}：不同的欄位跑出了範圍：${out.join(',')}（允許 ${ALLOWED.join(',')}）`);
      if (maxDay >= BOUND.moneyDay) bad.push(`${id}：資金一天的殘差 ${maxDay.toFixed(4)} ≥ ${BOUND.moneyDay}`);
      if (Math.abs(cum) >= BOUND.moneyCum) bad.push(`${id}：資金 13 天累計殘差 ${cum.toFixed(4)} ≥ ${BOUND.moneyCum}`);
      if (maxH >= BOUND.happy) bad.push(`${id}：幸福殘差 ${maxH.toFixed(5)} ≥ ${BOUND.happy}`);
      info.push(`${id}：不同的欄位 ${cmp.fields.join(',')}、資金累計 ${cum.toFixed(4)}（一天最大 ${maxDay.toFixed(4)}）、幸福最大 ${maxH.toFixed(5)}`);
    }
    const a = res.T1, b = res.T2;
    if (J(a.dm.map(v => +v.toFixed(6))) !== J(b.dm.map(v => +v.toFixed(6))) || J(a.dh.map(v => +v.toFixed(6))) !== J(b.dh.map(v => +v.toFixed(6)))) bad.push('T1 與 T2 的殘差不一樣大（「幾條、幾輛」不該有差別）');
    log(!bad.length, `D037 驗收 3：T1、T2 的缺口有範圍——不同的欄位只在 ${ALLOWED.join('、')} 之內；資金每天 < ${BOUND.moneyDay}、13 天累計 < ${BOUND.moneyCum}、幸福 < ${BOUND.happy}；T1 與 T2 的殘差一樣大`, bad.join('；') || info.join('；'));
  }

  // ---- 4. 實驗線量到的路線效應（樣本內的減法：T1、T2 減 T3）----
  {
    const bad = [], info = [], L3 = lab.runs.T3;
    const rowsOf = id => { const L = lab.runs[id]; return L.rows.map(r => ({ ...r })); };
    void rowsOf;
    const day13 = id => lab.runs[id].rows.at(-1);
    for (const [id, ops] of [['T1', 1.1], ['T2', 6.369]]) {
      const L = lab.runs[id];
      const uu = L.rows.map(r => r.uu?.[2]), un = L.rows.map(r => r.un?.[2]), nights = L.rows.map(r => r.night?.score);
      if (uu.some(v => v !== ops)) bad.push(`${id}：實驗線的公車營運費不是每天 ${ops}：${J(uu)}`);
      if (un.some(v => v !== 1)) bad.push(`${id}：實驗線的公交票收不是每天 1：${J(un)}`);
      const d1 = L.rows[0].money - L3.rows[0].money;
      if (Math.abs(d1 - (1 - ops)) > 0.01) bad.push(`${id}：第 1 天資金比對照多出的量 ${d1.toFixed(4)} ≠ 票收 1 − 營運費 ${ops}`);
      const d = nights.at(-1) - L3.rows.at(-1).night.score;
      if (!(d > 0.008 && d < 0.013)) bad.push(`${id}：夜間城市分比對照多出的量不在 0.008–0.013：${d.toFixed(4)}`);
      const dh = day13(id).happy - day13('T3').happy;
      if (!(dh > 0.0001 && dh < 0.0003)) bad.push(`${id}：第 13 天幸福比對照多出的量不在 0.0001–0.0003：${dh.toFixed(5)}`);
      info.push(`${id}：票收每天 1、營運費每天 ${ops}（第 1 天資金差 ${d1.toFixed(2)}）、夜間城市分 +${d.toFixed(3)}、第 13 天幸福 +${dh.toFixed(4)}、第 13 天資金 ${day13(id).money.toFixed(2)}（對照 ${day13('T3').money.toFixed(2)}）`);
    }
    if (lab.runs.T3.rows.some(r => r.uu?.[2] !== 0 || r.un?.[2] !== 0)) bad.push('T3：對照也有公車營運費或票收');
    log(!bad.length, 'D037 驗收 4：實驗線量到的路線效應（樣本內 T1／T2 減 T3）——公車票收每天 1、營運費每天 1.1／6.369（資金每天少 0.1／5.369）、夜間城市分（第 13 天）+0.009／+0.011、第 13 天幸福 +0.0002', bad.join('；') || info.join('；'));
  }

  // ---- 5. 玩家實際玩到的：本線完全不看路線 ----
  {
    const bad = [], fin = {};
    for (const c of runs) {
      const s = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank); let r;
      for (let d = 0; d < c.days; d++) r = realDay.stepDay(s);
      fin[c.id] = [s.money, r.cityHappy ?? r.happy];
    }
    if (J(fin.T1) !== J(fin.T3) || J(fin.T2) !== J(fin.T3)) bad.push(`不代任何輸入時本線的 T1／T2／T3 不一樣——本線開始看路線了？${J(fin)}`);
    log(!bad.length, 'D037 驗收 5（已知缺口的鎖）：不代任何輸入，本線 T1、T2、T3 推 13 天的資金與幸福逐位相同＝本線完全不看路線；哪天路線搬進來，這項會紅、要改成逐項對拍', bad.join('；') || `三座城第 13 天資金 ${fin.T3[0].toFixed(3)}、幸福 ${fin.T3[1].toFixed(5)}`);
  }

  // ---- 6. 存檔：路線原樣帶回 ----
  {
    const bad = [], info = [];
    for (const id of ['T1', 'T2']) {
      const raw0 = decodeLabCode(T[id].code).save.raw, L = loadCode(T[id].code, KT, vrank);
      if (!L.ok) { bad.push(`${id}：本線讀不進 ${L.error}`); continue; }
      for (let d = 0; d < 3; d++) realDay.stepDay(L.sim);
      const raw1 = decodeLabCode(saveCode(L.sim, L.template, L.start)).save.raw;
      if (!raw0.bus_rt?.length) bad.push(`${id}：原碼沒有 bus_rt（城的造法壞了）`);
      if (J(raw0.bus_rt) !== J(raw1.bus_rt)) bad.push(`${id}：bus_rt 存回去不一樣`);
      if (J(raw0.bop468) !== J(raw1.bop468)) bad.push(`${id}：bop468 存回去不一樣`);
      info.push(`${id}：bus_rt ${raw1.bus_rt?.length ?? 0} 條${raw1.bop468 ? '、bop468 ' + J(raw1.bop468) : ''}`);
    }
    log(!bad.length, 'D037 驗收 6：存檔——T1、T2 讀進本線、推 3 天、再存：bus_rt、bop468 原樣帶回（本線不看路線，但存檔不弄丟，實驗線照樣讀得到）', bad.join('；') || info.join('；'));
  }
}

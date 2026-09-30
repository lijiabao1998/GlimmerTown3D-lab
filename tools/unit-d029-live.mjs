// D029 Node 守衛（二）：夜間城市——實驗線頁面實跑（驗收 3）、接線（驗收 4）、存檔與決定性（驗收 5）。由 tools/unit.mjs 呼叫；vm 逐項與突變（驗收 1、2）在 tools/unit-d029.mjs；瀏覽器半邊在 tools/smoke-d029.mjs。
//   1. 樣本 src/content/samples/d028-lab.json（tools/d028-lab.mjs 從實驗線 d23c18d 的頁面錄的；每天一列已經有 night〔ready、score、hd〕、ng〔晚間消費金〕、un[3]〔夜間運輸收入〕、uu[3]〔夜間營運費〕）的出處與覆蓋；
//   2. **不代入夜間城市的任何東西**：本線自己讀檔、自己算夜間城市，跟實驗線逐天逐欄比——自造城 K1–K16 連推 13 天、D022–D025 的 120 座城（分區清成 0 與不清各一批）連推 10 天：
//      夜間城市六欄（ready、安全分數、幸福加減、晚間消費金、夜間運輸收入、夜間營運費）逐位相等，而且 D028 的全部欄位（資金、稅、十二個收入項、鏈條、食物、遊客、旅宿、每棟住宅的幸福、幸福構成 57 項、人口、就業、亂數位置）
//      不需要注入夜間城市也逐位全等（seed516、D3 兩座只差幸福，照舊）；
//   3. 起步城 8 個種子 × 120 天、長出來的存檔 24 份：只代政策與科技（夜間城市不代；城市活動 D030 起本線自己算，不代）→ 夜間城市三欄每天逐位相等；什麼都不代（玩家實際玩到的本線）→ 第一個分歧日不早於實驗線的第一場城市活動（D029 收工時城市活動還沒搬，所以那時會分歧；D030 之後整條全等，見 unit-d030-live.mjs）；
//   4. 接線：day.ts 的副本改壞一處要紅（不結算、五個輸入、警察覆蓋、政策、輸入在生長之後才算、犯罪乘數不餵、隔天讀成當天讀、幸福項不餵、晚間消費金與夜間運輸收入與營運費不進收支、夜市稅乘數、雜湊……）；
//   5. 存檔與決定性：夜間城市不進存檔（沒有新欄位、沒有新事件、格式照舊），讀檔與新圖是 ready:false、第 1 天幸福項 0、犯罪乘數 1、第 2 天起有；同一張碼讀兩次每天雜湊與夜間城市相同。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import * as realDay from '../src/sim/day.ts';
import { saveCode, loadCode, historyFormat } from '../src/io/save.ts';
import { HAPPY_NAMES } from '../src/sim/rules/happy.ts';
import { fieldsOf } from '../src/sim/rules/fields.ts';
import * as NC from '../src/sim/rules/nightcity.ts';
import { dayVariant } from './unit-d021.mjs';
import { catFn } from './unit-d029.mjs';
import { compareCity27 } from './unit-d027-live.mjs';
import { compareCity28 } from './unit-d028-live.mjs';
import { evolvedIds } from './d027-lab.mjs';
import { d028Cities, oldList, oldzList, PROBE } from './d028-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const nz = (a, f) => a.filter(f).length;
const sum = (a, f) => a.reduce((x, y) => x + f(y), 0);

export const LIVE = {};   // 除錯用
export async function d029LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D029 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 已知只差幸福的城（跟 D027、D028 同一份：seed516＝T133 城市等級、D3＝T442 污水）；夜間城市六欄本身不准差
const HK = ['happy', 'hh', 'ah', 'agg'];
const KNOWN = { seed516: 'T133 城市等級（微光之巔 +.02）', D3: 'T442 污水（管網讓近旁工業每座加 .025）' };
const labNight = row => [row.night.ready, row.night.score, row.night.hd];   // 樣本 night 三欄
const mineNight = rep => [rep.night.ready, rep.night.safety.score, rep.night.happinessDelta];

async function guards(log) {
  const lab = JSON.parse(read('src/content/samples/d028-lab.json')), lab27 = JSON.parse(read('src/content/samples/d027-lab.json')), cities = d028Cities(), olds = oldList(), oldzs = oldzList();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const d26 = JSON.parse(read('src/content/samples/d026-lab.json')), evolvedCode = id => { const [seed, dd] = id.split('@'); return d26.evolve[seed].codes[dd]; };
  Object.assign(LIVE, { lab, lab27, cities, olds, oldzs, KT, vrank });

  // ---- 1. 樣本的出處、形狀、覆蓋 ----
  const all = [...Object.values(lab.crafted), ...Object.values(lab.old), ...Object.values(lab.oldz)].flatMap(L => L.rows);
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (lab.source?.probe !== PROBE) bad.push('樣本的探針原文 ≠ tools/d028-lab.mjs 現在的探針（重跑 tools/d028-lab.mjs）');
    for (const [i, r] of all.entries()) if (!r.night || typeof r.night.ready !== 'boolean' || typeof r.night.score !== 'number' || typeof r.night.hd !== 'number' || typeof r.ng !== 'number' || r.un?.length !== 5 || r.uu?.length !== 7) { bad.push(`第 ${i} 列沒有夜間城市的欄位（night、ng、un、uu）`); break; }
    const cov = {
      城日: all.length, 已結算: nz(all, r => r.night.ready), 安全分數種數: new Set(all.map(r => r.night.score)).size, 幸福加減種數: new Set(all.map(r => r.night.hd)).size,
      幸福加減為正: nz(all, r => r.night.hd > 0), 幸福加減為負: nz(all, r => r.night.hd < 0), 晚間消費金城日: nz(all, r => r.ng > 0), 夜間運輸收入城日: nz(all, r => r.un[3] > 0), 夜間營運費城日: nz(all, r => r.uu[3] > 0),
    };
    LIVE.cov = cov;
    const NEED = { 城日: 2600, 已結算: 2600, 安全分數種數: 20, 幸福加減種數: 8, 幸福加減為正: 10, 幸福加減為負: 1000, 晚間消費金城日: 200, 夜間運輸收入城日: 30, 夜間營運費城日: 20 };
    const lack = Object.entries(NEED).filter(([k, v]) => cov[k] < v).map(([k, v]) => `${k} ${cov[k]}<${v}`);
    if (lack.length) bad.push(`覆蓋不夠：${lack.join('、')}`);
    log(!bad.length, `D029 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；沿用 D028 錄的 ${lab.order.length} 座自造城 × ${13} 天與 ${lab.oldOrder.length} 座 D022–D025 的城 × ${10} 天 × 兩批，每天一列都有夜間城市的 ready、安全分數、幸福加減與晚間消費金、夜間運輸收入、夜間營運費`,
      bad.slice(0, 4).join('；') || Object.entries(cov).map(([k, v]) => `${k} ${v}`).join('、'));
    if (bad.length) return;
  }

  // ---- 2. 不代入夜間城市的任何東西，逐天逐欄跟實驗線比（驗收 3）----
  const runSet = (mod, list, get, opts) => list.map(c => ({ id: c.id, ...compareCity28(mod, c.code, get(c.id), KT, vrank, opts) }));
  const crafted = runSet(realDay, cities, id => lab.crafted[id], { stopAtFirst: false });
  const olds1 = runSet(realDay, olds, id => lab.old[id], { stopAtFirst: false });
  const oldzs1 = runSet(realDay, oldzs, id => lab.oldz[id], { stopAtFirst: false });
  Object.assign(LIVE, { crafted, olds1, oldzs1 });
  {
    const errs = crafted.filter(x => x.d.length).map(x => `${x.id} ${x.d[0]}`);
    // 夜間城市六欄的各種情況真的發生過（量實驗線那邊的樣本）：晚間消費金、夜間運輸收入、夜間營運費在自造城裡也有
    const L = Object.values(lab.crafted).flatMap(q => q.rows), cov = { 晚間消費金: nz(L, r => r.ng > 0), 夜間運輸收入: nz(L, r => r.un[3] > 0), 夜間營運費: nz(L, r => r.uu[3] > 0), 分數不同的城日: new Set(L.map(r => r.night.score)).size };
    const lack = Object.entries({ 晚間消費金: 30, 分數不同的城日: 6 }).filter(([k, v]) => cov[k] < v).map(([k, v]) => `${k} ${cov[k]}<${v}`);   // 自造城沒有公交站與鐵路，夜間運輸收入與營運費是 0（在 D022–D025 的城裡才有）
    if (lack.length) errs.push(`覆蓋不夠：${lack.join('、')}`);
    log(!errs.length, `D029 驗收 3：實驗線頁面實跑（自造城，不代入夜間城市）——K1–K16 讀進來連推 13 天：夜間城市六欄（ready、安全分數、幸福加減、晚間消費金、夜間運輸收入、夜間營運費）與 D028 的全部欄位（資金、稅、十二個收入項、鏈條、食物、遊客、旅宿、每一棟住宅的幸福、幸福構成 57 項、人口、就業、亂數位置）逐位全等`,
      errs.slice(0, 4).join('｜') || `${crafted.length} 座、${sum(crafted, x => x.days)} 個城日全等；實驗線這邊：` + Object.entries(cov).map(([k, v]) => `${k} ${v}`).join('、'));
  }
  for (const [tag, rows, labSet] of [['分區清成 0', olds1, lab.old], ['分區不清——會長新房子、升級、廢棄，亂數全在跑', oldzs1, lab.oldz]]) {
    const bad = rows.filter(x => x.d.length), errs = [];
    for (const x of bad) {
      if (!KNOWN[x.id]) errs.push(`${x.id} 不在已知名單：${x.d[0].slice(0, 200)}`);
      else if (x.fields.some(f => !HK.includes(f))) errs.push(`${x.id} 除了幸福還有別的欄位不同：${x.fields.join('、')}（${x.d[0].slice(0, 120)}）`);
    }
    for (const id of Object.keys(KNOWN)) if (!bad.some(x => x.id === id)) errs.push(`${id}：這一次沒有差了（本線補了這個系統？把它從已知名單拿掉）`);
    const nightOff = rows.filter(x => x.fields.includes('nc')).map(x => x.id);
    if (nightOff.length) errs.push(`夜間城市六欄不同的城：${nightOff.join('、')}`);
    const L = Object.values(labSet), ng = nz(L, q => q.rows.some(r => r.ng > 0)), nt = nz(L, q => q.rows.some(r => r.un[3] > 0)), no = nz(L, q => q.rows.some(r => r.uu[3] > 0));
    const pol = nz(L, q => JSON.stringify(q.start.pol).includes('true')), moved = nz(L, q => new Set(q.rows.map(r => r.night.score)).size > 1);
    if (rows.length !== 120) errs.push(`只有 ${rows.length} 座`);
    if (ng < 10 || nt < 3 || no < 3 || moved < 5) errs.push(`覆蓋不夠：有晚間消費金的城 ${ng}（要 ≥ 10）、有夜間運輸收入的城 ${nt}（≥ 3）、有夜間營運費的城 ${no}（≥ 3）、分數十天內有變的城 ${moved}（≥ 5）`);
    log(!errs.length, `D029 驗收 3：實驗線頁面實跑（D022–D025 的 120 座城，${tag}，不代入夜間城市）——連推 10 天：夜間城市六欄逐位相等（含有夜間運輸收入與營運費的城），D028 的全部欄位跟實驗線逐位全等，只有 seed516、D3 兩座照舊只差幸福`,
      errs.slice(0, 4).join('｜') || `${rows.length} 座、${sum(rows, x => x.days)} 個城日：${rows.length - bad.length} 座每一欄全等、${bad.length} 座只差幸福（${bad.map(x => `${x.id}：${KNOWN[x.id]}，第 ${x.first} 天起`).join('；')}）；夜間城市六欄 ${rows.length} 座全等；實驗線那邊有晚間消費金的城 ${ng}、有夜間運輸收入的城 ${nt}、有夜間營運費的城 ${no}、開著政策的城 ${pol}、分數十天內有變的城 ${moved}`);
  }

  // ---- 3. 起步城 8 個種子 × 120 天與長出來的存檔：夜間城市每天對得上（驗收 3、7）----
  {
    const startCode = read('src/content/samples/starter.code.txt').trim(), errs = [], per = [];
    for (const seed of STARTER_SEEDS) {
      const code = codeWithSeed(startCode, seed), rec = lab27.evolve[seed], firstEvent = rec.rows.findIndex(r => r.ev) + 1;   // 實驗線第一場城市活動的那一天（1 起算；沒有＝0）
      let nightBad = 0, nightFirst = 0;
      const inj = compareCity27(realDay, code, rec, KT, vrank, { stopAtFirst: false, inject: true, onDay: (day, mine, row, rep) => { if (J(mineNight(rep)) !== J(labNight(row))) { nightBad++; if (!nightFirst) nightFirst = day; } } });
      let natEq = 0, natFirstBad = 0;
      const nat = compareCity27(realDay, code, rec, KT, vrank, { stopAtFirst: false, inject: false, onDay: (day, mine, row, rep) => { if (J(mineNight(rep)) === J(labNight(row))) natEq++; else if (!natFirstBad) natFirstBad = day; } });
      per.push({ seed, inj, nightBad, nightFirst, nat, natEq, natFirstBad, firstEvent });
      if (inj.d.length) errs.push(`${seed} 代入活動與政策：第 ${inj.first} 天 ${inj.d[0].slice(0, 140)}`);
      if (nightBad) errs.push(`${seed} 代入活動與政策：夜間城市三欄第 ${nightFirst} 天起有 ${nightBad} 天不同`);
      if (nat.first && firstEvent && nat.first < firstEvent) errs.push(`${seed} 玩家實際玩到的本線：第 ${nat.first} 天就跟實驗線不同，比實驗線第一場城市活動（第 ${firstEvent} 天）還早：${nat.d[0].slice(0, 140)}`);
      if (natFirstBad && firstEvent && natFirstBad < firstEvent) errs.push(`${seed} 玩家實際玩到的本線：夜間城市第 ${natFirstBad} 天就不同，比第一場城市活動（第 ${firstEvent} 天）還早`);
    }
    LIVE.traj = per;
    const evolvedErr = []; let evolvedDays = 0, evolvedNightBad = 0;
    for (const id of evolvedIds()) {
      const rec = lab27.evolved[id], r = compareCity27(realDay, evolvedCode(id), rec, KT, vrank, { stopAtFirst: false, inject: true, onDay: (day, mine, row, rep) => { evolvedDays++; if (J(mineNight(rep)) !== J(labNight(row))) evolvedNightBad++; } });
      if (r.d.length) evolvedErr.push(`${id} ${r.d[0].slice(0, 120)}`);
    }
    if (evolvedNightBad) evolvedErr.push(`夜間城市三欄有 ${evolvedNightBad} 個城日不同`);
    const ev0 = per.map(p => p.firstEvent), eqAll = nz(per, p => !p.nat.first), evEq = per.map(p => p.natEq);
    log(!errs.length, `D029 驗收 3、7：起步城 8 個種子 × 120 天——(a) 只代政策與科技（夜間城市與城市活動 D030 起都是本線自己算）：道路負載、通勤、地價、每一棟住宅的幸福、幸福構成、人口、就業、亂數位置與夜間城市三欄（ready、分數、幸福加減）每天逐位全等；`
      + `(b) 什麼都不代（玩家實際玩到的本線）：第一個分歧日不早於實驗線的第一場城市活動（D030 起城市活動本線也自己算，整條軌跡逐位元全等）`,
      errs.slice(0, 4).join('｜') || `${per.length} 個種子 × 120 天＝${per.length * 120} 個城日全等（夜間城市三欄 ${per.length * 120} 個城日全等）；玩家實際玩到的本線：第一場城市活動在第 ${ev0.join('、')} 天，第一個分歧日 ${per.map(p => p.nat.first || '—').join('／')}，`
        + `逐日全等到第 120 天的種子 ${eqAll}／${per.length}，夜間城市三欄逐日相等的天數 ${evEq.join('、')}`);
    log(!evolvedErr.length, `D029 驗收 3：實驗線頁面實跑（起步城第 30、70、110 天的實驗線存檔 24 份，連推 12 天，代入城市活動與政策，夜間城市不代）——整條 tick 鏈與夜間城市三欄逐天全等`,
      evolvedErr.slice(0, 4).join('｜') || `${evolvedIds().length} 份、${evolvedDays} 個城日全等`);
    if (errs.length || evolvedErr.length) return;
  }

  const ctx = { lab, lab27, cities, olds, oldzs, KT, vrank, evolvedCode };
  await wiringGuards(log, ctx);
  await persistGuards(log, ctx);
}

// ---- 4. 接線（驗收 4）：day.ts 的副本改壞一處，這批要紅 ----
// 三種抓法：「實驗線頁面實跑對不上」（lab：K1–K16 連推 13 天＋分區不清會長新房子的 D022–D025 城＋起步城存檔 3 份連推 12 天）、
// 「犯罪乘數直接測」（crime：犯罪抽籤在實驗線樣本上被乘數改變的機率只有萬分之一，樣本抓不到，所以拿固定亂數直接測：昨天的分數擺好、亂數值落在正確與改壞的門檻之間）、
// 「夜市稅乘數直接測」（tax：有夜市政策的商業稅要等於明說用今天的稅乘數算的那一份）、「雜湊不看」（hash）。
export async function wiringGuards(log, { lab, lab27, cities, olds, oldzs, KT, vrank, evolvedCode }) {
  const SUBC = cities.map(c => c.id), SUBE = [`${STARTER_SEEDS[0]}@30`, `${STARTER_SEEDS[1]}@70`, `${STARTER_SEEDS[2]}@110`].filter(id => lab27.evolved?.[id]);
  const SUBO = oldzs.filter(c => { const L = lab.oldz[c.id].rows; return L.at(-1).nh > L[0].nh; }).slice(0, 6).map(c => c.id);   // 分區不清、真的長了新住宅的城：輸入要在生長之前算才對得上
  const NT = olds.filter(c => lab.old[c.id].rows.some(r => r.un[3] > 0 || r.uu[3] > 0)).map(c => c.id);   // 有夜間運輸收入或夜間營運費的城（公交站與鐵路的城）：這兩筆進不進收支只有它們看得到
  const codeOf = id => cities.find(c => c.id === id).code, oldzCode = id => oldzs.find(c => c.id === id).code, oldCodeOf = id => olds.find(c => c.id === id).code;
  const dayBad = mod => {
    try {
      for (const id of NT) { const r = compareCity28(mod, oldCodeOf(id), lab.old[id], KT, vrank); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; }
      for (const id of SUBC) { const r = compareCity28(mod, codeOf(id), lab.crafted[id], KT, vrank); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; }
      for (const id of SUBO) { const r = compareCity28(mod, oldzCode(id), lab.oldz[id], KT, vrank); if (r.d.length && !(KNOWN[id] && r.fields.every(f => HK.includes(f)))) return `${id} ${r.d[0].slice(0, 80)}`; }
      for (const id of SUBE) { const r = compareCity27(mod, evolvedCode(id), lab27.evolved[id], KT, vrank, { inject: true }); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; }
    } catch (e) { return `丟例外 ${e.message.slice(0, 60)}`; }
    return null;
  };
  // 犯罪乘數直接測：找一座有「沒被警察／監獄／法院覆蓋的一級商業」的城，昨天的夜間城市設成分數 1（乘數 .9292），亂數全部回傳 v：
  // 正確＝v 在門檻 .002×.9292 之上→沒有犯罪；沒餵乘數（1）、讀今天的（≈1.09）＝門檻 ≥ .002→有犯罪。另一頭：讀檔後沒算過（乘數 1）→ 有犯罪
  const crimeTarget = (() => {
    for (const c of olds) {
      const r = decodeLabCode(c.code), s = realDay.simFromSave(r.save, c.code, KT, vrank), f = fieldsOf(s.g), COV = f.COV;
      for (let i = 0; i < s.w.tiles.length; i++) {
        const b = s.w.tiles[i].bld;
        if (b && !b.ref && b.k === 2 && !b.crime && !b.fire && !b.sick && !(COV.police[i] > 0) && !(COV.police2[i] > 0) && !(COV.prison && COV.prison[i] > 0) && !(COV.court && COV.court[i] > 0)) {
          const dry = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank), rep = realDay.stepDay(dry), mulT = NC.nightCrimeMul(rep.night, false, { k: 2 }, null), mulY = NC.nightCrimeMul({ ...NC.emptyNightCity(), ready: true }, false, { k: 2 }, null);
          if (Math.min(1, mulT) - mulY > .03) return { code: c.code, i, id: c.id, mulY, mulT };
        }
      }
    }
    return null;
  })();
  LIVE.crimeTarget = crimeTarget;
  const crimeBad = mod => {
    if (!crimeTarget) return '沒有可測的城（沒有沒被覆蓋的一級商業）';
    const { code, i, mulY } = crimeTarget, r = decodeLabCode(code), v = .002 * (mulY + 1) / 2;
    const run = ready => {
      const s = mod.simFromSave(r.save, code, KT, vrank); s.w.tiles[i].bld.lv = 1;
      if (ready) s.night = { ...NC.emptyNightCity(), ready: true };   // 昨天算過：分數 1
      s.rng = { R: () => v, ri: n => Math.floor(v * n) };
      return mod.stepDay(s).hazard.crimes.includes(i);
    };
    try {
      if (run(true)) return `昨天分數 1（乘數 ${mulY.toFixed(4)}）、亂數 ${v.toFixed(6)} 卻發生了犯罪（乘數沒餵或讀成別天的）`;
      if (!run(false)) return `讀檔後沒算過（乘數 1）、亂數 ${v.toFixed(6)} 卻沒有犯罪（沒算過的夜間城市不該有乘數）`;
    } catch (e) { return `丟例外 ${e.message.slice(0, 60)}`; }
    return null;
  };
  // 夜市稅乘數直接測：夜市政策開著時（政策 K 本線還沒搬，稅率政策只有守衛用 class2.mul.pm 注入；夜間城市讀的是 hazard.pol），商業稅的乘數是今天夜間城市的 taxMul（不是 ready 為假時的 1.06）。
  // 造法：同一座城同一天兩次，一次讓 day.ts 自己接、一次用 class2.mul 明說今天的 taxMul，商業稅要一模一樣；再明說 ready:false（1.06）要不同（證明這個測試分得出來）
  const PM = { taxR: 1, taxC: 1, taxI: 1, nightMarket: true };
  const taxTarget = (() => {
    for (const c of olds) {
      const r = decodeLabCode(c.code), s = realDay.simFromSave(r.save, c.code, KT, vrank), rep = realDay.stepDay(s, { hazard: { pol: PM }, class2: { mul: { pm: PM } } });
      if (rep.settle.tax.C > 0 && rep.night.commerce.taxMul !== 1 && Math.abs(rep.night.commerce.taxMul - 1.06) > .002) {
        const s2 = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank), r2 = realDay.stepDay(s2, { hazard: { pol: PM }, class2: { mul: { pm: PM, nightCityReady: false } } });
        if (r2.settle.tax.C !== rep.settle.tax.C) return { code: c.code, id: c.id, taxMul: rep.night.commerce.taxMul, taxC: rep.settle.tax.C, taxC106: r2.settle.tax.C };
      }
    }
    return null;
  })();
  LIVE.taxTarget = taxTarget;
  const taxBad = mod => {
    if (!taxTarget) return '沒有可測的城（有商業稅、夜市開著、稅乘數不是 1.06、乘數對商業稅有影響）';
    const go = x => { const r = decodeLabCode(taxTarget.code), s = mod.simFromSave(r.save, taxTarget.code, KT, vrank); return mod.stepDay(s, { hazard: { pol: PM }, class2: { mul: { pm: PM, ...x } } }); };
    try {
      const a = go({}), b = go({ nightCityReady: true, nightCityTaxMul: a.night.commerce.taxMul });
      if (!Object.is(a.settle.tax.C, b.settle.tax.C)) return `夜市開著：商業稅 ${a.settle.tax.C} ≠ 明說今天的稅乘數 ${a.night.commerce.taxMul} 算的 ${b.settle.tax.C}`;
    } catch (e) { return `丟例外 ${e.message.slice(0, 60)}`; }
    return null;
  };
  const hashBad = mod => {
    const c = codeOf('K1'), r = decodeLabCode(c), fresh = () => mod.simFromSave(r.save, c, KT, vrank), base = mod.simHash(fresh());
    const h = (score, hd, ready = true) => { const q = fresh(); q.night = { ...NC.emptyNightCity(), ready, safety: { ...NC.emptyNightCity().safety, score }, happinessDelta: hd }; return mod.simHash(q); };
    const blind = [];
    if (h(.3, -.005) === base) blind.push('夜間城市算過了跟沒算過一樣');
    if (h(.3, -.005) === h(.4, -.005)) blind.push('安全分數');
    if (h(.3, -.005) === h(.3, -.004)) blind.push('幸福加減');
    return blind.length ? `雜湊不看：${blind.join('、')}` : null;
  };
  // 輸入接線直接測：day.ts 的副本 import 一份「間諜版」nightcity.ts（記下 finalizeNightCity 的引數、照舊算），每天核對——五個輸入＝當天經濟段的值、警察覆蓋＝當天結束時的建築、道路格數、日子、政策，
  // 而且第一個引數（輸入）＝生長之前（這一天開頭）算出來的那一份。實驗線樣本上「遊客」「貨物供給率」「政策」這幾項的影響太小或太少，抓不到，所以直接量引數
  const oldCode = id => olds.find(c => c.id === id).code;
  const spyBad = (V, calls) => {
    try {
      // 內容表沒有的種類（新版實驗線的存檔）：實驗線 kcatOf 回 'S'（市政），本線內容表回 '?'——day.ts 要照實驗線算成市政（造法：在空地放一棟 k250、邊長 2）
      const unknownK = s => { const i = s.w.tiles.findIndex(t => !t.road && !t.bld && !t.zone); s.w.tiles[i].bld = { k: 250, lv: 1, v: 0, age: 0, pw: true, h: 1, sz: 2 }; };
      const runs = [...SUBC.map(id => ({ code: codeOf(id), days: 2, pol: null })), ...SUBO.map(id => ({ code: oldzCode(id), days: 10, pol: null })), { code: oldCode('ai120'), days: 2, pol: { parkNight: true } }, { code: codeOf('K1'), days: 2, pol: { nightMarket: true, curfew: true, freeTransit: true } }, { code: codeOf('K1'), days: 1, pol: null, prep: unknownK }];
      for (const run of runs) {
        const r = decodeLabCode(run.code), s = V.simFromSave(r.save, run.code, KT, vrank), nn = s.w.tiles.length;
        run.prep?.(s);
        for (let d = 0; d < run.days; d++) {
          calls.length = 0;
          const ri = [], bi = []; for (let i = 0; i < nn; i++) { if (s.w.tiles[i].road) ri.push(i); if (s.w.tiles[i].bld) bi.push(i); }
          const want = NC.prepareNightInputs(s.w, ri, bi, catFn, s.day + 1, run.pol);
          const rep = V.stepDay(s, { hazard: run.pol ? { pol: run.pol } : undefined });
          if (calls.length !== 1) return `第 ${d + 1} 天呼叫了 ${calls.length} 次 finalizeNightCity`;
          const [I, o, pc, tr, day, pol] = calls[0], ec = rep.econ.ec, bi2 = []; for (let i = 0; i < nn; i++) if (s.w.tiles[i].bld) bi2.push(i);
          const wantPc = NC.nightPoliceCoverage(s.w, bi2, catFn, fieldsOf(s.g).COV);
          const chk = [['輸入', J(I) === J(want)], ['購買力', Object.is(o.purchasingPower, ec.purchasingPowerNow481)], ['貨物供給率', Object.is(o.goodsSupply, ec.supplyRate481)], ['公交乘客', Object.is(o.transitRidership, 0)],
            ['遊客', Object.is(o.tourists, ec.tourists)], ['失業率', Object.is(o.unemployment, ec.laborNow481.unemploymentRate)], ['警察覆蓋', Object.is(pc, wantPc)], ['道路格數', tr === ri.length], ['日子', day === s.day], ['政策', J(pol) === J(run.pol)]];
          const off = chk.filter(([, ok]) => !ok).map(([k]) => k);
          if (off.length) return `${run.pol ? '有政策' : '無政策'}的城第 ${d + 1} 天 ${off.join('、')} 不對`;
        }
      }
    } catch (e) { return `丟例外 ${e.message.slice(0, 60)}`; }
    return null;
  };
  const mk = async edits => { const calls = [], spy = { ...NC, finalizeNightCity: (...a) => { calls.push(a); return NC.finalizeNightCity(...a); } }; return { V: await dayVariant(edits, { './rules/nightcity.ts': spy }), calls }; };
  const CHECK = [['對拍', ({ V }) => dayBad(V)], ['輸入接線', ({ V, calls }) => spyBad(V, calls)], ['犯罪直接測', ({ V }) => crimeBad(V)], ['夜市稅直接測', ({ V }) => taxBad(V)], ['雜湊', ({ V }) => hashBad(V)]];
  const FIN = `{ purchasingPower: ec.purchasingPowerNow481, goodsSupply: ec.supplyRate481, transitRidership: 0, tourists: ec.tourists, unemployment: ec.laborNow481.unemploymentRate },\n    nightPoliceCoverage(w, tickBld, catOf, f.COV), roads, s.day, nightPol`;
  // 等價突變不列：nightHazardIn 裡「沒算過就什麼都不給」（if (!n.ready) return x）拿掉——沒算過時幸福加減是 0、犯罪乘數函式自己會回 1，結果一樣；
  // 犯罪乘數的「有警察覆蓋」引數——犯罪抽籤只抽沒被警察局與派出所覆蓋的格（覆蓋的先 continue 掉），引數永遠是 false；結算的道路格數只給介面看
  const MUT = [
    ['夜間城市不結算（狀態不留到明天）', [['  s.night = night;\n', '']]],
    ['結算的購買力不進（恆 1）', [['purchasingPower: ec.purchasingPowerNow481,', 'purchasingPower: 1,']]],
    ['結算的貨物供給率不進（恆 1）', [['goodsSupply: ec.supplyRate481,', 'goodsSupply: 1,']]],
    ['結算的遊客不進', [['transitRidership: 0, tourists: ec.tourists,', 'transitRidership: 0, tourists: 0,']]],
    ['結算的失業率不進', [['unemployment: ec.laborNow481.unemploymentRate }', 'unemployment: 0 }']]],
    ['結算的公交乘客不是 0', [['transitRidership: 0,', 'transitRidership: 100,']]],
    ['警察覆蓋不進（恆 1）', [['nightPoliceCoverage(w, tickBld, catOf, f.COV), roads,', '1, roads,']]],
    ['道路格數不進', [['nightPoliceCoverage(w, tickBld, catOf, f.COV), roads,', 'nightPoliceCoverage(w, tickBld, catOf, f.COV), 0,']]],
    ['政策不進夜間城市', [['const nightPol = hzx?.pol ?? null,', 'const nightPol = null,']]],
    ['輸入在生長之後才算（不是 55007 那一步）', [['  const nightIn = prepareNightInputs(w, tickRoad, tickBld, catOf, s.day, nightPol);\n', ''], ['const night = finalizeNightCity(nightIn,', 'const night = finalizeNightCity(prepareNightInputs(w, tickRoad, tickBld, catOf, s.day, nightPol),']]],
    ['不認得的種類不算市政（實驗線 kcatOf 的預設 S）', [["return c === '?' ? 'S' : c; };", 'return c; };']]],
    ['幸福項不餵夜間城市', [['nightCity: x?.nightCity ?? { ready: true, happinessDelta: n.happinessDelta },', 'nightCity: x?.nightCity ?? { ready: false, happinessDelta: 0 },']]],
    ['幸福項餵成安全分數', [['{ ready: true, happinessDelta: n.happinessDelta }', '{ ready: true, happinessDelta: n.safety.score }']]],
    ['犯罪乘數不餵犯罪', [['nightCrimeMul: x?.nightCrimeMul ?? ((i, b) => nightCrimeMul(n, !!((p1 && p1[i] > 0) || (p2 && p2[i] > 0)), b, pol)) };', 'nightCrimeMul: x?.nightCrimeMul };']]],
    ['犯罪乘數讀今天的（隔天讀成當天讀）', [['  const hz = hazardDay(s, tickBld, f, dp, hzx);\n', `  s.night = finalizeNightCity(nightIn, ${FIN});\n  const hz = hazardDay(s, tickBld, f, dp, nightHazardIn(s, f, opts.hazard));\n`]]],
    ['讀檔後夜間城市就是 ready（第 1 天就有乘數）', [['night: emptyNightCity(), econ,', 'night: { ...emptyNightCity(), ready: true }, econ,']]],
    ['晚間消費金不進商業稅與收入', [['c2?.nightCommerceGold487 ?? night.finance.commerceGold', 'c2?.nightCommerceGold487 ?? 0']]],
    ['夜間運輸收入不進收入', [['nightTransitRev487: night.finance.transitRevenue, ...c2?.other', 'nightTransitRev487: 0, ...c2?.other']]],
    ['夜間營運費不進維護費', [['nightOpsCost487: night.finance.operatingCost, ...c2?.upkeep', 'nightOpsCost487: 0, ...c2?.upkeep']]],
    ['夜市稅乘數不餵（ready 假、稅乘數 1）', [['nightCityReady: night.ready, nightCityTaxMul: night.commerce.taxMul,', 'nightCityReady: false, nightCityTaxMul: 1,']]],
    ['夜市稅乘數讀成活力', [['nightCityTaxMul: night.commerce.taxMul,', 'nightCityTaxMul: night.commerce.activity,']]],
    ['雜湊不看夜間城市', [['...(s.night.ready ? [s.night.safety.score, s.night.happinessDelta] : []),', '']]],
    ['雜湊不看安全分數', [['[s.night.safety.score, s.night.happinessDelta]', '[s.night.happinessDelta]']]],
    ['雜湊不看幸福加減', [['[s.night.safety.score, s.night.happinessDelta]', '[s.night.safety.score]']]],
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
  log(!bad.length, `D029 驗收 4：接線——day.ts 的副本改壞一處（${MUT.length} 個：夜間城市不結算、五個輸入各自不進、警察覆蓋與道路格數與政策不進、輸入在生長之後才算、幸福項不餵與餵成別的、犯罪乘數不餵與讀今天的與讀檔後就有、晚間消費金與夜間運輸收入與夜間營運費不進收支、夜市稅乘數、雜湊不看夜間城市與兩個欄位）：`
    + `每一個都要被實驗線對拍（K1–K16 連推 13 天、有夜間運輸的 ${NT.length} 座城、分區不清的 ${SUBO.length} 座城、起步城存檔 ${SUBE.length} 份）、輸入接線直接測、犯罪乘數直接測、夜市稅直接測或雜湊抓到；沒改的先核過全等`,
    bad.slice(0, 5).join('；') || `犯罪測試城 ${crimeTarget?.id}（昨天乘數 ${crimeTarget?.mulY.toFixed(4)}、今天 ${crimeTarget?.mulT.toFixed(4)}）、夜市稅測試城 ${taxTarget?.id}（稅乘數 ${taxTarget?.taxMul}）；${Object.entries(tally).map(([k, v]) => `${k} ${v} 個`).join('、')}；` + out.join('；'));
}

// ---- 5. 存檔與決定性（驗收 5）----
export async function persistGuards(log, { cities, olds, KT, vrank }) {
  const bad = [], seen = { loads: 0, days: 0, trips: 0, keys: 0, fresh: 0 };
  const codeOf = id => cities.find(c => c.id === id).code;
  // 世界歷史目前有的事件種類（D028 收工時）：這一張不加新事件
  const KNOWN_EVENTS = new Set(['import', 'restyle', 'grow', 'upgrade', 'build', 'demolish', 'zone', 'road', 'place', 'pipe', 'park', 'tree', 'doze', 'clear', 'undo', 'decay', 'overgrow', 'roofless', 'collapse', 'police', 'fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act']);
  const ECON_OPT = new Set(['fuel364', 'steel364', 'shipCount', 'shipProgress']);
  const q0 = HAPPY_NAMES.indexOf('夜間城市');
  if (q0 < 0) bad.push('幸福構成裡沒有「夜間城市」這一項');
  // 夜間城市不進存檔：讀進來是 ready:false；第 1 天幸福項 0、第 2 天起等於前一天的幸福加減；推幾天再存，欄位集合＝剛讀進來就存的；讀回來又是 ready:false，第 1 天幸福項 0
  for (const id of ['K1', 'K3', 'K4', 'K10']) {
    const c = codeOf(id), L = loadCode(c, KT, vrank);
    if (!L.ok) { bad.push(`${id}：讀不進 ${L.error}`); continue; }
    const sm = L.sim; seen.loads++;
    if (sm.night.ready !== false) bad.push(`${id} 剛讀進來夜間城市不是 ready:false`);
    const reps = [];
    for (let d = 1; d <= 5; d++) { const rep = realDay.stepDay(sm); reps.push(rep); seen.days++; if (rep.night !== sm.night) bad.push(`${id} 第 ${sm.day} 天 DayReport.night 不是 Sim.night`); if (!rep.night.ready || rep.night.day !== sm.day) bad.push(`${id} 第 ${sm.day} 天夜間城市沒有結算（ready ${rep.night.ready}、day ${rep.night.day}）`); }
    if (reps[0].happyAgg.length && reps[0].happyAgg[q0] !== 0) bad.push(`${id} 讀檔後第 1 天幸福構成的夜間城市項 ${reps[0].happyAgg[q0]}（要 0：前一天沒算過）`);
    for (let d = 1; d < 5; d++) if (reps[d].happyAgg.length && Math.abs(reps[d].happyAgg[q0] - reps[d - 1].night.happinessDelta) > 1e-12) bad.push(`${id} 第 ${d + 1} 天幸福構成的夜間城市項 ${reps[d].happyAgg[q0]} ≠ 前一天的幸福加減 ${reps[d - 1].night.happinessDelta}`);
    const L0 = loadCode(c, KT, vrank), raw0 = decodeLabCode(saveCode(L0.sim, L0.template, L0.start)).save.raw, code = saveCode(sm, L.template, L.start), raw1 = decodeLabCode(code).save.raw;
    const extra = Object.keys(raw1).filter(k => !(k in raw0) && !ECON_OPT.has(k)), gone = Object.keys(raw0).filter(k => !(k in raw1)), d3ok = Object.keys(raw1.d3 ?? {}).every(k => ['f', 's', 'g', 'hv', 'r', 'h', 'j', 't'].includes(k));
    if (extra.length || gone.length || !d3ok || Object.keys(raw1).some(k => /night|nightCity|safety|lighting/i.test(k))) bad.push(`${id} 存檔的欄位跟剛讀進來就存的不同：多 ${extra.join('、') || '無'}、少 ${gone.join('、') || '無'}｜d3 欄位 ${Object.keys(raw1.d3 ?? {}).join('、')}`);
    seen.keys = Object.keys(raw1).length;
    const h = sm.city.history, hz = h.some(e => ['fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act'].includes(e.t));
    if (h.some(e => !KNOWN_EVENTS.has(e.t))) bad.push(`${id} 歷史裡有不認得的事件：${[...new Set(h.map(e => e.t))].join('、')}`);
    if (hz ? historyFormat(h) !== 6 || raw1.d3.f !== 6 : historyFormat(h) > 5 || raw1.d3.f > 5) bad.push(`${id} 城市格式 ${raw1.d3.f}（有災禍事件要 6、沒有不能寫 6）`);
    const q = loadCode(code, KT, vrank);
    if (!q.ok || !q.replayed) { bad.push(`${id} 存了再讀回失敗：${q.ok ? q.note : q.error}`); continue; }
    if (q.sim.night.ready !== false) bad.push(`${id} 第 ${sm.day} 天存檔再讀回來夜間城市不是 ready:false`);
    seen.trips++;
    const a = realDay.stepDay(sm), b = realDay.stepDay(q.sim);   // a：一直推下去的（前一天有夜間城市）；b：讀回來的第一天（沒有）
    seen.days += 2;
    if (b.happyAgg.length && b.happyAgg[q0] !== 0) bad.push(`${id} 存檔再讀回來的第一天夜間城市項 ${b.happyAgg[q0]}（要 0）`);
    if (a.happyAgg.length && !(a.happyAgg[q0] !== 0)) bad.push(`${id} 一直推下去的那份夜間城市項是 0（要有值：前一天的幸福加減 ${reps[4].night.happinessDelta}）`);
  }
  // 決定性：同一座城讀兩次各推 13 天，每天雜湊與夜間城市相同（K1、K4、K10）；第 5 天的存檔讀兩次也一樣
  for (const id of ['K1', 'K4', 'K10']) {
    const a = loadCode(codeOf(id), KT, vrank).sim, b = loadCode(codeOf(id), KT, vrank).sim;
    for (let d = 1; d <= 13; d++) { const ra = realDay.stepDay(a), rb = realDay.stepDay(b); if (realDay.simHash(a) !== realDay.simHash(b) || J(ra.night) !== J(rb.night)) { bad.push(`${id} 同一張碼讀兩次、第 ${d} 天不同`); break; } }
    const L = loadCode(codeOf(id), KT, vrank), s5 = L.sim; for (let d = 0; d < 5; d++) realDay.stepDay(s5);
    const code5 = saveCode(s5, L.template, L.start), a2 = loadCode(code5, KT, vrank).sim, b2 = loadCode(code5, KT, vrank).sim;
    for (let d = 1; d <= 8; d++) { realDay.stepDay(a2); realDay.stepDay(b2); if (realDay.simHash(a2) !== realDay.simHash(b2)) { bad.push(`${id} 第 5 天的存檔讀兩次、之後第 ${d} 天雜湊不同`); break; } }
    seen.fresh++;
  }
  // 新圖（起步城）：ready:false，第 1 天算出來
  { const startCode = read('src/content/samples/starter.code.txt').trim(), s = realDay.simFromSave(decodeLabCode(startCode).save, startCode, KT, vrank); if (s.night.ready !== false) bad.push('起步城剛讀進來夜間城市不是 ready:false'); const rep = realDay.stepDay(s); if (!rep.night.ready) bad.push('起步城第 1 天夜間城市沒結算'); }
  void olds;
  log(!bad.length, 'D029 驗收 5：存檔——夜間城市是執行期狀態、不進存檔（沒有新欄位、d3 欄位照舊、歷史沒有新事件、城市格式照 D026 規則）；讀檔與存了再讀後是 ready:false，第 1 天幸福項 0、第 2 天起等於前一天的幸福加減；DayReport.night 就是 Sim.night；同一張碼讀兩次、存檔讀兩次，每天雜湊與夜間城市相同',
    bad.slice(0, 4).join('；') || `${seen.loads} 座城讀檔 ready:false、共推 ${seen.days} 個城日、存檔欄位 ${seen.keys} 個、存讀檔 ${seen.trips} 次、決定性 ${seen.fresh} 座×（13 天＋存檔後 8 天）`);
}

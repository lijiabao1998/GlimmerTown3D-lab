// D045 Node 守衛（實驗線頁面實跑那一半）：市長委託（T385）本線接進模擬之後，逐日跟實驗線頁面比。由 tools/unit.mjs 呼叫。
//   樣本 src/content/samples/d045-lab.json（tools/d045-lab.mjs 從實驗線 d23c18d 的頁面錄的，回退設定）：tools/d045-cities.mjs d045Scripts() 的 11 個劇本——底城（M1，人口 2,304）＋存檔欄位帶進行中的委託、科技、庫存、難度，
//   每個劇本分幾段（三選一、接單、推幾天）；加上 D043 的樣本 src/content/samples/d043-lab.json（起步城 8 個種子 × 接單 0／1／2／不接 × 200 天，另有 C6 先放進完成清單的兩座城各 ctlC6／accC6）。
//   1. 樣本的出處與形狀：實驗線 commit、探針原文、劇本清單與碼雜湊（＝本線現在產生的）、每個劇本的列數；
//   2. 實驗線頁面實跑 11 個劇本：每一段開頭的三選一（id 與順序）、接單的回傳，每天一列 [天、資金、人口、幸福、等級、進行中的委託、累計、連續天數、輪次、完成清單長度] 逐欄跟實驗線全等
//      （覆蓋：接單 × 三張、幸福連續天數累計與中斷、過期、科技型完成 +$1,800 與完成後換一批、期末驗收完成（鋼材 +$3,200、燃料 +$3,000）與不到而過期、運量委託一直是 0 到期才過期、沙盒原地不動、鋼材累計〔造船廠〕）；
//   3. D043 的樣本：起步城 8 個種子推 60 天、改一般難度、資金 5,000 之後，control／accept0／accept1／accept2 各 200 天、ctlC6／accC6：逐日逐欄＝本線（含過期、完成 +$1,800）；
//   4. 接線突變：day.ts 的副本改壞一處（不結算、獎金不加、日子少一天、鋼材用量給 0、出口金額給 0、幸福換成別的、庫存讀錯）都要紅；沒改的先核過全等。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import * as realDay from '../src/sim/day.ts';
import { acceptCommission, commissionOffers } from '../src/sim/edit.ts';
import { cmsOffers } from '../src/sim/rules/commission.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { PROBE, COLS } from './d045-lab.mjs';
import { d043Cities, CMS_DAYS, PROBE as PROBE43, CMS_COLS } from './d043-lab.mjs';
import { d045Scripts } from './d045-cities.mjs';
import { dayVariant } from './unit-d021.mjs';
import { D011_LAB_COMMIT } from './unit-d011-build.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
export const LIVE = {};
export async function d045LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D045 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}
const snap = (s, happy) => [s.day, Math.round(s.money * 100) / 100, s.pop, +happy.toFixed(4), s.rankIdx, s.cms.act, s.cms.acc, s.cms.hold, s.cms.n, s.cms.done.length];

// 本線這一邊：跟實驗線探針 __d045go 同一個流程（每段：記三選一、接單、推幾天；每天一列）
export function runScript(mod, KT, vrank, s0, accept = acceptCommission, offers = commissionOffers) {
  const r = decodeLabCode(s0.code); if (!r.ok) throw new Error(`${s0.id}：本線解不開碼 ${r.error}`);
  const s = mod.simFromSave(r.save, s0.code, KT, vrank);
  const rows = [snap(s, s.cityHappy)], out = [];
  let happy = s.cityHappy;
  for (const [idx, days] of s0.phases) {
    const off = offers(s).map(c => c.id);
    let acc = null; if (idx >= 0) acc = !!accept(s, idx);
    out.push({ offers: off, acc, at: rows.length - 1 });
    for (let d = 0; d < days; d++) { const rep = mod.stepDay(s); happy = rep.cityHappy; rows.push(snap(s, happy)); }
  }
  return { rows, out, sim: s };
}
const firstDiff = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (J(a[i]) !== J(b[i])) return `第 ${i} 列 本線 ${J(a[i])} ≠ 實驗線 ${J(b[i])}`;
  return null;
};

async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const S = JSON.parse(read('src/content/samples/d045-lab.json')), scripts = d045Scripts(), S43 = JSON.parse(read('src/content/samples/d043-lab.json'));
  LIVE.S = S; LIVE.scripts = scripts;

  // ---- 1. 出處與形狀 ----
  {
    const bad = [];
    if (S.source?.repo !== 'lijiabao1998/GlimmerTown-lab' || S.source?.commit !== D011_LAB_COMMIT || S.config !== 'fallback') bad.push(`出處 ${S.source?.repo}@${S.source?.commit} ${S.config}`);
    if (S.source?.probe !== PROBE) bad.push('探針原文跟 tools/d045-lab.mjs 現在的不同（改了探針要重錄）');
    if (J(S.order) !== J(scripts.map(x => x.id)) || J(S.cols) !== J(COLS)) bad.push('劇本清單或欄位跟 tools/d045-cities.mjs 現在的不同（重跑 tools/d045-lab.mjs）');
    for (const x of scripts) {
      const L = S.runs[x.id], days = x.phases.reduce((a, [, d]) => a + d, 0);
      if (!L) bad.push(`${x.id}：沒有記錄`);
      else if (L.codeHash !== fnv1a(x.code) || L.rows.length !== days + 1 || J(L.phases) !== J(x.phases) || L.out.length !== x.phases.length) bad.push(`${x.id}：本線產生的碼跟錄樣本時不同或列數不對（重跑 tools/d045-lab.mjs）`);
      else if (L.rows.some(row => row.length !== COLS.length)) bad.push(`${x.id}：欄數不對`);
    }
    if (S43.source?.probe !== PROBE43 || J(S43.cmsCols) !== J(CMS_COLS)) bad.push('D043 樣本的探針或欄位變了');
    log(!bad.length, `D045 實跑樣本：實驗線 ${D011_LAB_COMMIT.slice(0, 7)}（${S.source?.version}）回退設定；${scripts.length} 個劇本（碼雜湊＝本線現在產生的）、D043 的起步城 8 座；探針原文與欄位一致`,
      bad.slice(0, 4).join('；') || `劇本 ${Object.keys(S.runs).length} 個，錄了 ${S.seconds} 秒；${scripts.map(x => x.id).join('、')}`);
    if (bad.length) return;
  }

  // ---- 2. 實驗線頁面實跑：劇本逐列、逐段（三選一與接單）全等 ----
  const real = { simFromSave: realDay.simFromSave, stepDay: realDay.stepDay };
  {
    const bad = [], info = [], t0 = Date.now(), seen = {};
    for (const x of scripts) {
      const L = S.runs[x.id], r = runScript(real, KT, vrank, x);
      const d = firstDiff(r.rows, L.rows);
      if (d) bad.push(`${x.id}：${d}`);
      for (let i = 0; i < L.out.length; i++) {
        if (J(r.out[i].offers) !== J(L.out[i].offers)) bad.push(`${x.id} 第 ${i + 1} 段 三選一 本線 ${J(r.out[i].offers)} ≠ 實驗線 ${J(L.out[i].offers)}`);
        if (r.out[i].acc !== L.out[i].acc) bad.push(`${x.id} 第 ${i + 1} 段 接單 本線 ${r.out[i].acc} ≠ 實驗線 ${L.out[i].acc}`);
        if (r.out[i].at !== L.out[i].at) bad.push(`${x.id} 第 ${i + 1} 段 起點列 ${r.out[i].at} ≠ ${L.out[i].at}`);
      }
      const z = L.rows.at(-1), moneyJump = L.rows.some((row, i) => i && row[1] - L.rows[i - 1][1] >= 1000 && row[9] > L.rows[i - 1][9]);
      seen[x.id] = { done: z[9], n: z[8], act: z[5], moneyJump };
      info.push(`${x.id}（完成 ${z[9]}、輪次 ${z[8]}、進行中「${z[5]}」）`);
    }
    // 覆蓋：這一批真的走到過各種結局，不是全在原地
    const cov = [];
    if (!(seen.c6.done >= 1 && seen.c6.moneyJump)) cov.push('c6：科技型沒有完成（獎金沒跳）');
    if (!(seen.stockok.done >= 1 && seen.stockok.moneyJump)) cov.push('stockok：期末驗收沒有完成');
    if (!(seen.fuelok.done >= 1 && seen.fuelok.moneyJump)) cov.push('fuelok：燃料期末驗收沒有完成');
    if (!(seen.expire.n === 1 && seen.expire.act === '' && seen.expire.done === 0)) cov.push('expire：沒有過期');
    if (!(seen.stockfail.n === 1 && seen.stockfail.act === '' && seen.stockfail.done === 0)) cov.push('stockfail：不到標準沒有過期');
    if (!(seen.transit.n === 1 && seen.transit.done === 0)) cov.push('transit：運量委託沒有過期');
    if (!(seen.sandbox.act === 'steel40' && seen.sandbox.n === 0)) cov.push('sandbox：沙盒沒有原地不動');
    if (!['accept0', 'accept1', 'accept2'].every(id => S.runs[id].rows[1][5] !== '')) cov.push('accept：接單沒接上');
    if (new Set(['accept0', 'accept1', 'accept2'].map(id => S.runs[id].rows[1][5])).size !== 3) cov.push('accept：三張接到的不是三種');
    if (!S.runs.happy.rows.some(row => row[7] > 20)) cov.push('happy：連續天數沒有再累計');
    if (!S.runs.happy.rows.some((row, i) => i && row[7] < S.runs.happy.rows[i - 1][7])) cov.push('happy：連續天數沒有中斷過');
    if (!(S.runs.w2acc.rows.at(-1)[6] > 30 || S.runs.w2acc.rows.at(-1)[9] > 0)) cov.push('w2acc：鋼材沒有累計');
    log(!bad.length && !cov.length, `D045 驗收 5：實驗線頁面實跑——${scripts.length} 個劇本（接單三張、幸福累計與中斷、過期、科技型完成與換一批、期末驗收完成與不到、運量委託、沙盒、鋼材累計）：三選一、接單、每天的 [天、資金、人口、幸福、等級、進行中、累計、連續天數、輪次、完成清單] 逐列全等`,
      bad.slice(0, 3).join('｜') || cov.join('；') || `${info.join('；')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
    if (bad.length || cov.length) return;
  }

  // ---- 3. D043 的起步城 8 座 ----
  {
    const bad = [], t0 = Date.now(), startCode = read('src/content/samples/starter.code.txt').trim();
    let rows = 0, runs = 0;
    for (const c of d043Cities()) {
      const rec = S43.cms[c.id];
      for (const [key, L] of Object.entries(rec)) {
        const r = decodeLabCode(c.code); if (!r.ok) { bad.push(`${c.id}：解不開碼`); continue; }
        const s = real.simFromSave(r.save, c.code, KT, vrank);
        for (let d = 0; d < 60; d++) real.stepDay(s);
        s.diff = 1; s.money = 5000;   // 實驗線探針 __d043econ：難度改一般（委託沙盒不出）、資金 5,000
        const off = commissionOffers(s).map(q => q.id);
        if (J(off) !== J(L.offers)) bad.push(`${c.id} ${key} 三選一 本線 ${J(off)} ≠ 實驗線 ${J(L.offers)}`);
        const C6 = key === 'accC6' || key === 'ctlC6';
        if (C6 && !s.edu.tech.includes('C6')) s.edu.tech.push('C6');
        let acc = null;
        const idx = key.startsWith('accept') ? +key.slice(6) : key === 'accC6' ? L.offers.indexOf('techC6') : -1;
        if (idx >= 0) acc = !!acceptCommission(s, idx);
        if (L.acc !== acc) bad.push(`${c.id} ${key} 接單 本線 ${acc} ≠ 實驗線 ${L.acc}`);
        const mine = [snap(s, s.cityHappy)];
        for (let d = 0; d < CMS_DAYS; d++) { const rep = real.stepDay(s); mine.push(snap(s, rep.cityHappy)); }
        // 第一列：實驗線的探針在 __d043econ 之後、接單之前記的（天數 61、等級、完成清單長度…）；本線第一列在接單之前記，同一個時機
        const d1 = firstDiff(mine, L.rows);
        if (d1) bad.push(`${c.id} ${key}：${d1}`);
        rows += mine.length; runs++;
      }
    }
    void startCode; void STARTER_SEEDS;
    log(!bad.length, `D045 驗收 5：D043 的起步城 8 座（推 60 天、改一般難度、資金 5,000）接單 0／1／2、不接、C6 先放進完成清單的接與不接——${runs} 段 ${rows} 列：三選一、接單、逐日逐欄（資金、人口、幸福、等級、進行中、累計、連續天數、輪次、完成清單）＝實驗線，含 200 天內的過期與完成 +$1,800`,
      bad.slice(0, 3).join('｜') || `${runs} 段 ${rows} 列全等（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
    if (bad.length) return;
  }

  // ---- 4. 接線突變 ----
  {
    const bad = [], out = [], t0 = Date.now();
    const good = await dayVariant([]), cases = ['c6', 'stockok', 'fuelok', 'expire', 'happy', 'w2acc', 'sandbox'].map(id => scripts.find(x => x.id === id));
    const run = mod => { for (const x of cases) { const r = runScript(mod, KT, vrank, x); if (firstDiff(r.rows, S.runs[x.id].rows)) return x.id; } return null; };
    if (run(good)) bad.push(`沒改的 day.ts 副本在 ${run(good)} 就不同`);
    const CALL = 'const cmsOut = cmsDaily(s.cms, { diff: s.diff, day: s.day, steelUsed: ec.steelUsed, tradeGold: late.tradeGold, transitRidership: 0, cityHappy, steel: s.econ.steel, fuel: s.econ.fuel, tech: s.edu.tech });';
    const muts = [
      ['不結算（cmsDaily 不呼叫）', [[CALL, 'const cmsOut = null;']]],
      ['獎金不加進資金', [['if (cmsOut.t === \'done\') s.money += cmsOut.bonus;', '']]],
      ['獎金加兩次', [['s.money += cmsOut.bonus;', 's.money += cmsOut.bonus * 2;']]],
      ['日子少一天（day: s.day - 1）', [['cmsDaily(s.cms, { diff: s.diff, day: s.day,', 'cmsDaily(s.cms, { diff: s.diff, day: s.day - 1,']]],
      ['鋼材用量給 0', [['steelUsed: ec.steelUsed,', 'steelUsed: 0,']]],
      ['庫存讀成 0（鋼材）', [['steel: s.econ.steel, fuel: s.econ.fuel,', 'steel: 0, fuel: s.econ.fuel,']]],
      ['庫存讀成 0（燃料）', [['steel: s.econ.steel, fuel: s.econ.fuel,', 'steel: s.econ.steel, fuel: 0,']]],
      ['科技完成清單給空的', [['fuel: s.econ.fuel, tech: s.edu.tech });', 'fuel: s.econ.fuel, tech: [] });']]],
      ['幸福換成固定 .6', [['transitRidership: 0, cityHappy, steel:', 'transitRidership: 0, cityHappy: .6, steel:']]],
      ['沙盒也結算（diff 給 1）', [['cmsDaily(s.cms, { diff: s.diff,', 'cmsDaily(s.cms, { diff: 1,']]],
      ['完成不記歷史', [["s.city.history.push(cmsOut.t === 'done' ?", "void (cmsOut.t === 'done' ?"]]],
    ];
    for (const [name, edits] of muts) {
      try {
        const M = await dayVariant(edits);
        const hit = name === '完成不記歷史' ? (() => { const x = scripts.find(q => q.id === 'c6'), r = runScript(M, KT, vrank, x); return r.sim.city.history.some(e => e.t === 'cms' && e.ev === 'done') ? null : 'c6'; })() : run(M);
        if (hit) out.push(`${name}（${hit}）`); else bad.push(`突變「${name}」沒抓到`);
      } catch (e) { bad.push(`突變「${name}」：${String(e.message).slice(0, 120)}`); }
    }
    void cmsOffers;
    log(!bad.length, `D045 驗收 8：接線突變——day.ts 的副本改壞一處（不結算、獎金不加或加兩次、日子少一天、鋼材用量給 0、鋼材／燃料庫存讀成 0、科技清單給空、幸福給固定值、沙盒也結算、完成不記歷史）都要被實跑劇本抓到；沒改的先核過全等`,
      bad.slice(0, 3).join('；') || `${out.length} 個都抓到：${out.join('、')}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  }
}

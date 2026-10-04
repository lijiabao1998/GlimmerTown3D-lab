// D036 Node 守衛（二）：資源開採的實驗線頁面實跑（驗收 3）、讀檔與耗損存讀（驗收 2、4）、接線突變（驗收 5）、效能（驗收 7）。由 tools/unit.mjs 呼叫；公式半邊（vm 逐項與突變）在 tools/unit-d036.mjs。
//   1. 樣本 src/content/samples/d036-lab.json（tools/d036-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀：版本、回退設定、探針原文、每一筆的碼雜湊（＝本線現在產生的）、W 城／種子城／rt 的清單；
//   2. seeds：60 個種子的空城（含負的、接近 2^31）——實驗線讀進來之後 RESOURCE 的 [非零格數, 總和, 雜湊]＝本線 simFromSave 的資源圖；
//   3. runs：W 系列（油井與礦場擺在本線算出來的資源圖上；煉油廠、鋼鐵廠；耗盡；壞的 rdep；W4 連推 60 天）每天跟實驗線逐欄比——D034 的全部欄位加 RDEP 的 [格數, 總和, 雜湊]、供應品／燃料／鋼材與
//      fuelMade／steelMade、flowStat384.raw 的 [油, 礦, 供應品, 庫存]；讀進來那一刻的資源圖與耗損也比；錢也判；覆蓋：油井與礦場都抽、種類對不上與沒有資源的格子不抽、沒電的井照抽、耗盡（剩 1、2、0 的井）、
//      燃料與鋼材從當天的開採量分流（煉油廠與鋼鐵廠都有、庫存封頂）、壞的 rdep 的各種寫法；「沒接抽取」的那一版必須跟實驗線不同（有牙）；
//   4. rt：本線推一段（耗損是本線寫的）存檔，實驗線用自己的 GV.importCode 讀「本線存出來的碼」再推 3 天：讀回來的 RDEP＝本線的，之後每一欄跟本線一樣；
//   5. 接線：day.ts 的副本改壞一處要紅（不接抽取、用錯的種子、讀檔不還原耗損、雜湊不吃耗損）；saveCode 不寫 rdep 要紅；沒改的先核過全等；
//   6. 存檔：有井的城推進後 rdep＝模擬的耗損（稀疏、升序、只存非零）、存→讀→再存逐字相同；沒挖過的存檔、現有樣本碼的 rdep 欄位位元組不變；不認得的欄位原樣帶著；
//   7. 效能：推進一天 ≤ 5 ms（D011 驗收 8），量一座有井與煉油廠、鋼鐵廠的城。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { RESOURCE_STOCK, rdepOfSave, rdepPairs } from '../src/sim/rules/resource.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { loadMod } from './unit-d024.mjs';
import { dayVariant } from './unit-d021.mjs';
import { compareCity33 } from './unit-d033-live.mjs';
import { PROBE, RT_DAYS, d036Rt } from './d036-lab.mjs';
import { d036Runs, d036Seeds, W_DAYS, W_LONG } from './d036-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城
export async function d036LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D036 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 統計：字串的格式跟 tools/d036-lab.mjs 的探針逐字相同
const fnvAdd = (h, s) => { for (let q = 0; q < s.length; q++) { h ^= s.charCodeAt(q); h = Math.imul(h, 16777619) >>> 0; } return h; };
export const statsOf = a => { let c = 0, s = 0, h = 2166136261 >>> 0; for (let i = 0; i < a.length; i++) { const v = a[i] | 0; if (v) { c++; s += v; h = fnvAdd(h, i + ':' + v + ';'); } } return [c, s, h]; };

async function guards(log) {
  const lab = JSON.parse(read(process.env.D036_SAMPLE ?? 'src/content/samples/d036-lab.json')), runs = d036Runs(), seeds = d036Seeds(), rts = d036Rt();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, runs, seeds, rts, KT, vrank });
  const simOf = (c, mod = realDay) => mod.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank);

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (lab.source?.probe !== PROBE) bad.push('探針原文跟 tools/d036-lab.mjs 現在的不同（重錄）');
    if (J(lab.order) !== J(runs.map(r => r.id))) bad.push('樣本的 W 城清單 ≠ tools/d036-cities.mjs d036Runs() 現在的（重跑 tools/d036-lab.mjs --part=runs）');
    if (J(lab.seedOrder) !== J(seeds.map(r => r.id))) bad.push('樣本的種子城清單 ≠ d036Seeds() 現在的（重跑 tools/d036-lab.mjs --part=seeds）');
    if (J(lab.rtOrder) !== J(rts.map(r => r.id))) bad.push('樣本的 rt 清單 ≠ d036Rt() 現在的（重跑 tools/d036-lab.mjs --part=rt）');
    for (const c of runs) { const L = lab.runs[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code) || L.rows.length !== c.days) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同或天數不對（重跑 tools/d036-lab.mjs --part=runs）`); }
    for (const c of seeds) { const L = lab.seeds[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d036-lab.mjs --part=seeds）`); }
    for (const c of rts) { const L = lab.rt?.[c.id]; if (!L) bad.push(`rt ${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code) || L.rows.length !== c.days) bad.push(`rt ${c.id}：本線存出來的碼跟錄樣本時不同或天數不對（重跑 tools/d036-lab.mjs --part=rt）`); }
    log(!bad.length, `D036 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；W 城 ${runs.length} 座（連推 ${W_DAYS} 天、W4 連推 ${W_LONG} 天）、種子城 ${seeds.length} 個（只讀資源圖）、rt ${rts.length} 筆（本線存的碼給實驗線讀、再推 ${RT_DAYS} 天）；探針原文與碼雜湊＝本線現在的`,
      bad.slice(0, 4).join('；') || `runs ${Object.keys(lab.runs).length}、seeds ${Object.keys(lab.seeds).length}、rt ${Object.keys(lab.rt ?? {}).length}，錄了 ${lab.seconds} 秒`);
    if (bad.length) return;
  }

  // ---- 2. 種子城：資源圖 ----
  {
    const bad = []; let cells = 0, withBoth = 0;
    for (const c of seeds) { const L = lab.seeds[c.id], s = simOf(c), mine = statsOf(s.res.resource); if (J(mine) !== J(L.res)) bad.push(`${c.id}（種子 ${c.seed}）：資源圖 本線 ${J(mine)} ≠ 實驗線 ${J(L.res)}`); cells += L.res[0]; }
    for (const c of seeds) { const s = simOf(c); let o = 0, e = 0; for (const v of s.res.resource) { if (v === 1) o++; else if (v === 2) e++; } if (o && e) withBoth++; }
    if (cells < 3000 || withBoth < 40) bad.push(`資源格太少（${cells} 格、油礦都有的種子 ${withBoth}）：比對沒有意義`);
    log(!bad.length, `D036 驗收 1（實跑半邊）：實驗線頁面實跑的資源圖——${seeds.length} 個種子的空城（含負的、接近 2^31）讀進來，RESOURCE 的 [非零格數, 總和, 雜湊]＝本線 simFromSave 的資源圖`,
      bad.slice(0, 4).join('｜') || `${seeds.length} 個種子、${cells} 個資源格逐格全等（油礦都有的 ${withBoth} 個）`);
  }

  // ---- 3. W 城連推 ----
  const compare36 = (mod, code, rec, opt = {}) => {
    const extra = [];
    { const s0 = mod.simFromSave(decodeLabCode(code).save, code, KT, vrank), r = statsOf(s0.res.resource), d = statsOf(s0.res.rdep);
      if (J(r) !== J(rec.start.res)) extra.push(`讀進來那一刻的資源圖 本線 ${J(r)} ≠ 實驗線 ${J(rec.start.res)}`);
      if (J(d) !== J(rec.start.rd)) extra.push(`讀進來那一刻的耗損 本線 ${J(d)} ≠ 實驗線 ${J(rec.start.rd)}`); }
    const r = compareCity33(mod, code, rec, KT, vrank, { stopAtFirst: !!opt.stopAtFirst, onDay: (day, mine, row, rep, s) => {
      const rd = statsOf(s.res.rdep), ec = rep.econ.ec, st = [s.econ.supplies, s.econ.fuel, s.econ.steel, ec.fuelMade, ec.steelMade], fl = [rep.resource.oil, rep.resource.ore, rep.resource.made, Math.round(s.econ.supplies)];
      if (J(rd) !== J(row.rd)) extra.push(`第 ${day} 天 耗損 本線 ${J(rd)} ≠ 實驗線 ${J(row.rd)}`);
      if (J(st) !== J(row.st)) extra.push(`第 ${day} 天 庫存與分流 本線 ${J(st)} ≠ 實驗線 ${J(row.st)}`);
      if (J(fl) !== J(row.fl)) extra.push(`第 ${day} 天 開採量 本線 ${J(fl)} ≠ 實驗線 ${J(row.fl)}`);
      opt.onDay?.(day, mine, row, rep, s);
    } });
    for (const x of extra) { r.d.push(x); if (!r.first) { r.first = 1; r.firstFields = ['rd']; } }
    return r;
  };
  const seen = {};
  {
    const bad = [], info = [], noExtract = await dayVariant([['tallyBuildings(w, tickBld, fert, s.res)', 'tallyBuildings(w, tickBld, fert)']]);
    let days = 0;
    for (const c of runs) {
      const rec = lab.runs[c.id], k = seen[c.id] = { oil: 0, ore: 0, fuel: 0, steel: 0, exh: 0, capped: 0, wells: 0 };
      const r = compare36(realDay, c.code, rec, { onDay: (day, mine, row, rep, s) => {
        days++; k.oil += rep.resource.oil; k.ore += rep.resource.ore; k.wells = Math.max(k.wells, rep.resource.wells[0] + rep.resource.wells[1]);
        if (row.st[3] > 0) k.fuel++; if (row.st[4] > 0) k.steel++;
        if (rep.econ.ec.fuelMade < rep.resource.oil && rep.resource.oil > 0 && rep.econ.ec.fuelMade > 0) k.capped++;
      } });
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 220)}（共 ${r.d.length} 天不同）`);
      const strip = compare36(noExtract, c.code, rec, { stopAtFirst: true }).d.length > 0;
      if (!strip) bad.push(`${c.id}：不接抽取的那一版居然跟實驗線一樣（這一座沒有量到開採）`);
      const last = rec.rows.at(-1);
      info.push(`${c.id} 抽油 ${k.oil}、礦 ${k.ore}、耗損 ${J(last.rd.slice(0, 2))}`);
    }
    const ex = c => lab.runs[c].rows;
    // 覆蓋：耗盡、分流、封頂、長跑
    const w3 = ex('W3'), w2 = ex('W2'), w4 = ex('W4');
    const exhausted = w3.some((row, i) => i > 0 && row.fl[2] < w3[i - 1].fl[2]);   // 耗盡的井讓當天開採量往下掉
    if (!exhausted) bad.push('W3：耗盡沒有讓開採量下降（預先帶的 rdep 沒有生效）');
    if (!(seen.W2.fuel >= 10 && seen.W2.steel >= 10)) bad.push(`W2：燃料與鋼材分流的天數太少（燃料 ${seen.W2.fuel}、鋼材 ${seen.W2.steel}）`);
    if (!(seen.W1.oil > 100 && seen.W1.ore > 50)) bad.push(`W1：開採量太少（油 ${seen.W1.oil}、礦 ${seen.W1.ore}）`);
    const fuelTop = Math.max(...w4.map(r => r.st[1])), steelTop = Math.max(...w4.map(r => r.st[2]));
    LIVE.seen = seen; LIVE.top = { fuelTop, steelTop };
    log(!bad.length, `D036 驗收 3：實驗線頁面實跑（W 系列 ${runs.length} 座自造城：油井與礦場擺在資源圖上、煉油廠與鋼鐵廠、耗盡、壞的 rdep；連推 ${W_DAYS} 天，W4 連推 ${W_LONG} 天）——每天逐欄跟實驗線比（D034 的全部欄位）加耗損、供應品／燃料／鋼材與分流、開採量，讀進來那一刻的資源圖與耗損也比；錢也判；不接抽取的那一版必須不同`,
      bad.slice(0, 4).join('｜') || `${runs.length} 座、${days} 個城日每一欄全等（資金判了全部）；${info.join('；')}；W2 燃料分流 ${seen.W2.fuel} 天、鋼材 ${seen.W2.steel} 天；W4 燃料庫存最高 ${fuelTop}、鋼材 ${steelTop}`);
  }

  // ---- 4. rt：本線存的碼，實驗線讀進來 ----
  {
    const bad = [], info = [];
    for (const c of rts) {
      const rec = lab.rt[c.id], r = compare36(realDay, c.code, rec);
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 200)}（共 ${r.d.length} 天不同）`);
      if (!(rec.start.rd[0] > 0)) bad.push(`${c.id}：存的碼裡沒有耗損（這一筆沒有意義）`);
      info.push(`${c.id} 讀進來 耗損 ${J(rec.start.rd)}`);
    }
    log(!bad.length, `D036 驗收 4：實驗線讀本線存的碼——本線推一段（耗損是本線寫的）再存檔，實驗線用自己的 GV.importCode 讀「本線存出來的碼」再推 ${RT_DAYS} 天，讀回來的 RDEP＝本線的、之後的每一欄跟本線一樣`,
      bad.slice(0, 3).join('｜') || `${rts.length} 筆全等：${info.join('；')}`);
  }

  await wiringGuards(log, { lab, runs, compare36, KT, vrank, simOf });
  await persistGuards(log, { runs, KT, vrank });
  await timing(log, { runs, KT, vrank });
}

// ---- 5. 接線突變（驗收 5）----
const WIRING = [   // [名字, day.ts 的編輯]
  ['不接抽取（tallyBuildings 不給資源場）', [['tallyBuildings(w, tickBld, fert, s.res)', 'tallyBuildings(w, tickBld, fert)']], ['W1', 'W2', 'W3']],
  ['資源圖用錯的種子', [['forRestyle ? new Uint8Array(nn) : genResource(save.seed, w),', 'forRestyle ? new Uint8Array(nn) : genResource(save.seed + 1, w),']], ['W1', 'W2']],
  ['讀檔不還原耗損', [['rdep: rdepOfSave(save.raw.rdep, nn) }', 'rdep: rdepOfSave(null, nn) }']], ['W3', 'W5']],
  ['資源圖空的（全 0）', [['forRestyle ? new Uint8Array(nn) : genResource(save.seed, w),', 'new Uint8Array(nn),']], ['W1', 'W2', 'W3']],
];
async function wiringGuards(log, { lab, runs, compare36, KT, vrank, simOf }) {
  const bad = [], out = [];
  const base = ['W1', 'W3', 'W5'].map(id => compare36(realDay, runs.find(c => c.id === id).code, lab.runs[id], { stopAtFirst: true }).d.length).reduce((a, b) => a + b, 0);
  if (base) bad.push('沒改的副本就有不對');
  for (const [name, edits, ids] of WIRING) {
    let V; try { V = await dayVariant(edits); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
    const hit = ids.filter(id => compare36(V, runs.find(c => c.id === id).code, lab.runs[id], { stopAtFirst: true }).d.length);
    out.push(`${name}：${hit.length ? hit.join('、') : '沒抓到'}`);
    if (hit.length !== ids.length) bad.push(`「${name}」沒抓到（要 ${ids.join('、')}，抓到 ${hit.join('、') || '無'}）`);
  }
  // saveCode 不寫 rdep：本線推一段存檔，rdep 變了的存檔必須帶著新的耗損
  {
    const S = await loadMod('src/io/save.ts', [['if (!same) o.rdep = rdepPairs(now); }', 'if (!same) { /* 突變：不寫 */ } }']]).catch(e => { bad.push('saveCode 突變的錨點對不上：' + e.message.slice(0, 80)); return null; });
    if (S) {
      const c = runs.find(q => q.id === 'W1'), L = loadCode(c.code, KT, vrank); for (let d = 0; d < 3; d++) realDay.stepDay(L.sim);
      const good = decodeLabCode(saveCode(L.sim, L.template, L.start)).save.raw.rdep, mut = decodeLabCode(S.saveCode(L.sim, L.template, L.start)).save.raw.rdep;
      if (!(Array.isArray(good) && good.length) || (Array.isArray(mut) && mut.length)) bad.push('沒抓到：saveCode 不寫 rdep');
      out.push('saveCode 不寫 rdep');
    }
  }
  // 雜湊要吃耗損：兩座城只差一口井的耗損，雜湊要不同；沒挖過的城雜湊不多吃
  {
    const c = runs.find(q => q.id === 'W1'), a = simOf(c), b = simOf(c);
    const h0 = realDay.simHash(a); if (h0 !== realDay.simHash(b)) bad.push('同一張碼讀兩次雜湊不同');
    const k = [...b.res.resource].findIndex(v => v === 1); b.res.rdep[k] = 7;
    if (realDay.simHash(b) === h0) bad.push('耗損不同的兩座城雜湊相同');
    const V = await dayVariant([['    ...(s.res.rdep.some(v => v) ? [rdepPairs(s.res.rdep)] : []),\n', '']]).catch(e => { bad.push('simHash 突變的錨點對不上：' + e.message.slice(0, 80)); return null; });
    if (V && V.simHash(b) !== V.simHash(a)) bad.push('沒抓到：雜湊不吃耗損（突變的副本還分得出來？不該）');
    out.push('雜湊吃耗損');
  }
  log(!bad.length, `D036 驗收 5：接線——day.ts 的副本改壞一處（${WIRING.length} 個：不接抽取、資源圖用錯的種子、讀檔不還原耗損、資源圖全 0）都要紅；saveCode 不寫 rdep 要紅；耗損不同的兩座城雜湊要不同（沒挖過的不多吃）；沒改的先核過全等`,
    bad.slice(0, 4).join('｜') || out.join('；'));
}

// ---- 6. 存檔 ----
async function persistGuards(log, { runs, KT, vrank }) {
  const bad = [], info = [];
  for (const c of runs) {
    const L = loadCode(c.code, KT, vrank); if (!L.ok) { bad.push(`${c.id}：讀不進 ${L.error}`); continue; }
    const days = Math.min(c.days, 13);
    for (let d = 0; d < days; d++) realDay.stepDay(L.sim);
    const code1 = saveCode(L.sim, L.template, L.start), r1 = decodeLabCode(code1).save.raw, want = rdepPairs(L.sim.res.rdep);
    if (J(r1.rdep) !== J(want)) bad.push(`${c.id}：存出來的 rdep ${J(r1.rdep)?.slice(0, 80)} ≠ 模擬的耗損 ${J(want)?.slice(0, 80)}`);
    if (Array.isArray(r1.rdep)) for (let q = 0; q < r1.rdep.length; q++) { const [i, v] = r1.rdep[q]; if (!(v > 0 && v <= RESOURCE_STOCK) || (q && r1.rdep[q - 1][0] >= i)) { bad.push(`${c.id}：rdep 第 ${q} 筆不是升序的非零配對 ${J(r1.rdep[q])}`); break; } }
    const L2 = loadCode(code1, KT, vrank); if (!L2.ok) { bad.push(`${c.id}：存的碼讀不回 ${L2.error}`); continue; }
    if (J(Array.from(L2.sim.res.rdep)) !== J(Array.from(L.sim.res.rdep))) bad.push(`${c.id}：存→讀之後耗損不同`);
    const code2 = saveCode(L2.sim, L2.template, L2.start), r2 = decodeLabCode(code2).save.raw;
    if (J(r1.rdep) !== J(r2.rdep)) bad.push(`${c.id}：存→讀→再存的 rdep 不同`);
    info.push(`${c.id} ${Array.isArray(r1.rdep) ? r1.rdep.length : 0} 口`);
  }
  // 沒挖過的存檔：現有樣本碼的 rdep 欄位位元組不變（有 rdep:null 的、沒有欄位的都一樣）
  const samples = fs.readdirSync(path.join(ROOT, 'src/content/samples')).filter(f => f.endsWith('.code.txt'));
  for (const f of samples) {
    const code = read('src/content/samples/' + f).trim(), L = loadCode(code, KT, vrank); if (!L.ok) { bad.push(`${f}：讀不進`); continue; }
    const raw0 = decodeLabCode(code).save.raw, raw1 = decodeLabCode(saveCode(L.sim, L.template, L.start)).save.raw;
    if (J(raw0.rdep) !== J(raw1.rdep) || ('rdep' in raw0) !== ('rdep' in raw1)) bad.push(`${f}：沒挖過的存檔 rdep 欄位變了 ${J(raw0.rdep)} → ${J(raw1.rdep)}`);
  }
  // 壞的 rdep（W5）：沒推進、沒挖，存回去原樣（不改寫範本裡的寫法）
  { const c = runs.find(q => q.id === 'W5'), L = loadCode(c.code, KT, vrank), raw0 = decodeLabCode(c.code).save.raw, raw1 = decodeLabCode(saveCode(L.sim, L.template, L.start)).save.raw; if (J(raw0.rdep) !== J(raw1.rdep)) bad.push('W5：壞的 rdep 沒推進就存，範本裡的寫法被改了'); }
  log(!bad.length, `D036 驗收 2、4：存檔——W 城推進後存出來的 rdep＝模擬的耗損（稀疏、升序、非零、不超過 ${RESOURCE_STOCK}）、存→讀→再存逐字相同、讀回來的耗損一樣；沒挖過的存檔（現有 ${samples.length} 個樣本碼、沒推進的 W5 壞 rdep）rdep 欄位位元組不變`,
    bad.slice(0, 4).join('｜') || `${runs.length} 座都過：${info.join('、')}`);
}

// ---- 7. 效能 ----
async function timing(log, { runs, KT, vrank }) {
  // 同 D035 的做法：跟「同一座城、資源圖清成全 0（沒有地方可抽）」的對照組交錯量，各四輪每輪 60 天、取平均最低的一輪；判相對（≤ 1.5 倍＋0.5 ms）；絕對值 ≤ 5 ms（D011 驗收 8）只在對照組自己過了才判
  const c = runs.find(q => q.id === 'W2'), once = noRes => {
    const s = loadCode(c.code, KT, vrank).sim, ts = [];
    if (noRes) s.res.resource.fill(0);
    for (let d = 0; d < 5; d++) realDay.stepDay(s);
    for (let d = 0; d < 60; d++) { const t0 = performance.now(); realDay.stepDay(s); ts.push(performance.now() - t0); }
    return ts.reduce((x, y) => x + y, 0) / ts.length;
  };
  const a = [], b = [];
  for (let r = 0; r < 4; r++) { a.push(once(false)); b.push(once(true)); }
  const fa = Math.min(...a), fb = Math.min(...b), rel = fa <= 1.5 * fb + .5, abs = fa <= 5 || fb > 5;
  log(rel && abs, 'D036 驗收 7：推進一天 ≤ 5 ms（D011 驗收 8）——量一座有井與煉油廠、鋼鐵廠的城（W2，交錯量四輪各 60 天取平均最低的一輪），不比資源圖清空的同一座城慢過 1.5 倍',
    `有井：${a.map(x => x.toFixed(2)).join('／')} → 最低 ${fa.toFixed(2)} ms；資源圖清空：${b.map(x => x.toFixed(2)).join('／')} → 最低 ${fb.toFixed(2)} ms；比值 ${(fa / fb).toFixed(2)}${fb > 5 ? '（對照組超過 5 ms：機器忙，絕對值不判）' : ''}`);
}
void rdepOfSave;

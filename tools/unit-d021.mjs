// D021 Node 守衛：讀進來的城的人口（驗收 1、2、4；驗收 3 在 tools/unit-d020-parity.mjs）。由 tools/unit.mjs 呼叫。
//   樣本 src/content/samples/d021-lab.json（tools/d021-lab.mjs 在實驗線頁面錄，回退設定）：45 座城（預建城 8、AI 城、種子城、全種類樣張城、tools/d021-cities.mjs 的自造城 34 座）
//   每一座讀檔後（GV.importCode 之後、第一天之前）的人口、推進一天後的人口。這裡在 Node 重新產生同樣的碼（雜湊要＝樣本記的），本線讀檔與推進逐座比，完全相等。
//   覆蓋：500 上下、剛好 499／500、讀檔後在 500 下面推進後越過（社宅拿到水）、讀檔後在 500 上面推進後掉下來（種子城 5,436 → 1,400：讀檔算沒電、沒水的住宅，推進一天只算有電的）、
//   只有塔與巨廈沒有電也算人口（T2）、商業塔與商業綜合體不住人（T5）。
//   突變：把 src/sim/day.ts 的副本（型別剝除後在 vm 另載）改壞一處，整批要紅——塔與巨廈都不算、只不算巨廈、只不算塔、讀檔後 pop 起頭 0、讀檔後把社宅也算進去
//   （第一版的錯：68507 那行 pw／wa 全設 true 在 QA 治具裡，不是讀檔）、讀檔後不算塔與巨廈。沒改的副本先核過全等。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import * as realDay from '../src/sim/day.ts';
import { d021Codes } from './d021-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8'), J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

// src/sim/day.ts 在記憶體裡另載一份、改壞幾處（不改 src；同 tools/unit-d011-edit.mjs 的 stepDayWith，多回傳 simFromSave）
async function dayVariant(edits) {
  const file = path.join(ROOT, 'src/sim/day.ts');
  let src = fs.readFileSync(file, 'utf8');
  for (const [a, b] of edits) { if (src.split(a).length !== 2) throw new Error(`突變的錨點要剛好一處：${a.slice(0, 60)}`); src = src.replace(a, b); }
  const ctx = {};
  for (const [, names, from] of src.matchAll(/^import \{([^}]*)\} from '([^']+)';$/gm)) {
    const ns = await import(new URL(from, pathToFileURL(file)).href);
    for (const k of names.split(',').map(q => q.trim()).filter(q => q && !q.startsWith('type '))) { if (!(k in ns)) throw new Error(`${from} 沒有匯出 ${k}`); ctx[k] = ns[k]; }
  }
  const js = stripTypeScriptTypes(src).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  vm.runInContext(`${js}\n;globalThis.__m = { simFromSave, stepDay };`, vm.createContext(ctx), { filename: 'variant:day.ts' });
  return ctx.__m;
}

// 一批城（codes：[{id, code}]）在某一份 day.ts（simFromSave、stepDay）上逐座比：讀檔後的人口、推進一天後的人口與天數。回傳不相等的說明
function compare(mod, codes, lab, KT, vrank) {
  const bad = [];
  for (const c of codes) {
    const L = lab.cities[c.id], r = decodeLabCode(c.code);
    if (!r.ok) { bad.push(`${c.id}：本線解不開碼（${r.error}）`); continue; }
    const s = mod.simFromSave(r.save, c.code, KT, vrank), p0 = s.pop;
    if (p0 !== L.popImport) bad.push(`${c.id} 讀檔後 本線 ${p0} ≠ 實驗線 ${L.popImport}`);
    mod.stepDay(s);
    if (s.pop !== L.popTick) bad.push(`${c.id} 推進一天後 本線 ${s.pop} ≠ 實驗線 ${L.popTick}`);
    if (s.day !== L.dayTick) bad.push(`${c.id} 推進後的天數 本線 ${s.day} ≠ 實驗線 ${L.dayTick}`);
  }
  return bad;
}

export async function d021Guards(log) {
  const lab = JSON.parse(read('src/content/samples/d021-lab.json'));
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const codes = d021Codes();

  // 樣本形狀、出處、碼的雜湊
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source)} ${lab.config}`);
    if (J(lab.order) !== J(codes.map(c => c.id))) bad.push('樣本裡城的順序 ≠ tools/d021-lab.mjs d021Codes() 現在的順序（重跑 tools/d021-lab.mjs）');
    for (const c of codes) {
      const L = lab.cities[c.id];
      if (!L || !['popImport', 'popTick', 'dayImport', 'dayTick'].every(k => Number.isFinite(L[k]))) { bad.push(`${c.id}：樣本欄位不齊`); continue; }
      if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d021-lab.mjs）`);
    }
    log(!bad.length, `D021 對拍樣本：${codes.length} 座城（預建城 8、樣本城 3、自造城 ${codes.length - 11}）欄位齊全、碼在 Node 重新產生、雜湊＝樣本記的（fnv1a）；實驗線 d23c18d v${lab.source?.version}`,
      bad.slice(0, 3).join('；') || `${codes.length} 座，錄了 ${lab.seconds} 秒`);
  }

  // 覆蓋：樣本裡真的有這些情況（比了等於沒比就紅）
  {
    const C = lab.cities, v = Object.values(C), by = id => C[id];
    const cover = {
      '讀檔後在 500 下面（小城）': v.filter(c => c.popImport < 500).length,
      '讀檔後在 500 以上（正式清運）': v.filter(c => c.popImport >= 500).length,
      '讀檔後 499、500 各一座': +(by('B499')?.popImport === 499 && by('B500')?.popImport === 500),
      '讀檔後在 500 下面、推進後越過（社宅拿到水）': v.filter(c => c.popImport < 500 && c.popTick >= 500).length,
      '讀檔後在 500 以上、推進後掉下來（讀檔算沒電沒水的住宅）': v.filter(c => c.popImport >= 500 && c.popTick < c.popImport).length,
      '讀檔後與推進後不同的城': v.filter(c => c.popImport !== c.popTick).length,
      '只有塔與巨廈、沒有電：居民照算（T2）': +(by('T2')?.popImport > 0 && by('T2')?.popTick === by('T2')?.popImport),
      '種子城讀檔 5,436、推進 1,400（塔與巨廈）': +(by('seed516')?.popImport === 5436 && by('seed516')?.popTick === 1400),
      '商業塔與綜合體不住人（T5）': +(by('T5')?.popImport === by('T5')?.popTick && by('T5')?.popImport < 100),
    };
    const dead = Object.entries(cover).filter(([, n]) => !n).map(([k]) => k);
    log(!dead.length, 'D021 覆蓋：500 上下與剛好 499／500、越過與掉下來、社宅（有水、沒水）、只有塔與巨廈、商業塔不住人、種子城，樣本裡都有案例', dead.length ? `沒案例：${dead.join('、')}` : Object.entries(cover).map(([k, n]) => `${k.split('：')[0].slice(0, 12)} ${n}`).join('；'));
  }

  // 驗收 1、2：本線讀檔後、推進一天後的人口逐座＝實驗線
  {
    const bad = compare(realDay, codes, lab, KT, vrank);
    const nt = codes.filter(c => lab.cities[c.id].popImport !== lab.cities[c.id].popTick).length;
    log(!bad.length, 'D021 驗收 1、2：本線 simFromSave 讀檔後的人口、推進一天後的人口，逐座完全相等＝實驗線頁面（GV.importCode 後、GV.step(1) 後的 GV.stats().pop）；不只落在 500 的同一邊',
      bad.slice(0, 4).join('；') || `${codes.length} 座逐座相等（其中 ${nt} 座讀檔後與推進後不同：種子城 5,436 → 1,400、社宅 432 → 660、隨機城 2,517 → 2,161 與 2,143 → 1,281）`);
  }

  // 驗收 4：突變
  {
    const A = 'let pop = popN + towerPop + megaPop,', LP = 'pop: loadPop488(tiles),', LOOP = 'residentPopulation488(b, () => undefined); }\n  return Math.round(p);', COND = '|| b.k === 33 || b.k === 105)) p +=';
    const MUT = [
      ['推進的 pop 不算塔與巨廈', [[A, 'let pop = popN,']]],
      ['推進的 pop 只不算巨廈', [[A, 'let pop = popN + towerPop,']]],
      ['推進的 pop 只不算塔', [[A, 'let pop = popN + megaPop,']]],
      ['simFromSave 的 pop 起頭 0（D021 以前）', [[LP, 'pop: 0,']]],
      ['讀檔後把社宅也算進去（pw、wa 全設 true，第一版的錯）', [[LOOP, 'residentPopulation488({ ...b, pw: true, wa: true, sick: 0, death: 0 }, () => undefined); }\n  return Math.round(p);']]],
      ['讀檔後不算塔與巨廈', [[COND, ')) p +=']]],
    ];
    const base = await dayVariant([]);
    const ok0 = compare(base, codes, lab, KT, vrank);
    const alive = [], out = [];
    for (const [name, edits] of MUT) {
      const m = await dayVariant(edits), bad = compare(m, codes, lab, KT, vrank);
      out.push(`${name}：${bad.length} 條不等`);
      if (!bad.length) alive.push(name);
    }
    log(!ok0.length && !alive.length, 'D021 突變：把 day.ts 的副本改壞一處（塔與巨廈都不算、只不算巨廈、只不算塔、讀檔後 pop 起頭 0、讀檔後把社宅也算進去、讀檔後不算塔與巨廈），整批都要紅；沒改的副本先核過全等',
      alive.length ? `沒抓到：${alive.join('、')}` : ok0.length ? `沒改的副本就有 ${ok0.length} 條不等：${ok0[0]}` : out.join('；'));
  }
}

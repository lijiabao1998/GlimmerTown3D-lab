// D023 Node 守衛：讀檔還原服務預算 sb。由 tools/unit.mjs 呼叫。
//   樣本 src/content/samples/d023-lab.json（tools/d023-lab.mjs 在實驗線頁面錄，回退設定）：13 座城（AI 城、種子城、預建城、全種類樣張城、tools/d023-cities.mjs 的 9 座各種預算）
//   讀檔後的 svcBudget、60 個覆蓋場每一場的位元組雜湊（讀檔後、推進一天後）。這裡在 Node 重新產生同樣的碼（雜湊要＝樣本記的），本線讀檔與推進逐座比。
//   1. 樣本形狀、出處、碼的雜湊；覆蓋：預算不是全 1 的城要夠多、種類要齊（全 .5、.7、1.25、1.5、混合、超出範圍、非數字、缺鍵）；
//   2. 讀檔還原：sim.budget、60 個覆蓋場的雜湊（讀檔後、推進一天後）逐座＝實驗線頁面；
//   3. 把讀檔那一句拿掉的副本（day.ts 型別剝除後在 vm 另載），每一座預算不是全 1 的城都轉紅；預算改壞的 5 種也全紅；
//   4. 存檔不丟：loadCode → saveCode，sb 原樣（含字串、null、true 那些怪值）；
//   5. 維護費有傳進去：推進一天時傳給 dailyUpkeep 的 svcBudget＝讀進來的預算；AI 城（警 .9、醫療 .9）換成全 1，維護費不同。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import * as realDay from '../src/sim/day.ts';
import * as realMoney from '../src/sim/rules/money.ts';
import { SVC_BUDGET_DEFAULT } from '../src/sim/rules/fields.ts';
import { dayVariant } from './unit-d021.mjs';
import { d023Codes, fnvBytes } from './d023-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8'), J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0', KEYS = ['police', 'fire', 'health', 'edu'];
const covHashes = s => Object.fromEntries(Object.entries(s.g.COV).map(([k, a]) => [k, fnvBytes(a)]));
const isDefault = b => KEYS.every(k => b[k] === 1);

export async function d023Guards(log) {
  const lab = JSON.parse(read('src/content/samples/d023-lab.json')), codes = d023Codes();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;

  // 1. 樣本形狀、出處、碼的雜湊、覆蓋
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (J(lab.order) !== J(codes.map(c => c.id))) bad.push('樣本裡城的順序 ≠ tools/d023-lab.mjs d023Codes() 現在的順序（重跑 tools/d023-lab.mjs）');
    for (const c of codes) {
      const L = lab.cities[c.id];
      if (!L || !KEYS.every(k => Number.isFinite(L.budget?.[k])) || Object.keys(L.load ?? {}).length !== 60 || Object.keys(L.day1 ?? {}).length !== 60) { bad.push(`${c.id}：樣本欄位不齊`); continue; }
      if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d023-lab.mjs）`);
    }
    const B = id => lab.cities[id]?.budget, non = codes.filter(c => lab.cities[c.id] && !isDefault(lab.cities[c.id].budget));
    const cover = {
      '預算不是全 1 的城（含 AI 城）': [non.length, 8], '全 .5': [+(J(B('B1')) === J({ police: .5, fire: .5, health: .5, edu: .5 })), 1], '全 .7': [+(B('B2')?.police === .7), 1], '全 1.25（半徑變大）': [+(B('B3')?.fire === 1.25), 1],
      '全 1.5（上限）': [+(B('B4')?.edu === 1.5), 1], '混合各項不同': [+(new Set(KEYS.map(k => B('B5')?.[k])).size === 4), 1],
      '超出範圍夾住（.3→.5、2→1.5）': [+(B('B6')?.police === .5 && B('B6')?.fire === 1.5), 1], '非數字保留 1（只有教育收）': [+(J(B('B7')) === J({ police: 1, fire: 1, health: 1, edu: .8 })), 1],
      '只給一個鍵': [+(J(B('B8')) === J({ police: 1, fire: 1, health: .8, edu: 1 })), 1], '沒有 sb 全 1': [+isDefault(B('B9') ?? {}), 1], 'AI 城 警 .9、醫療 .9': [+(B('ai120')?.police === .9 && B('ai120')?.health === .9), 1],
    };
    const dead = Object.entries(cover).filter(([, [n, min]]) => n < min).map(([k]) => k);
    if (dead.length) bad.push(`覆蓋不夠：${dead.join('、')}`);
    log(!bad.length, `D023 對拍樣本：${codes.length} 座城（AI 城、種子城、預建城、全種類樣張城、自造城 9 座）欄位齊全、碼在 Node 重新產生、雜湊＝樣本記的（fnv1a）；預算的各種情況（全 .5／.7／1.25／1.5、混合、超出範圍、非數字、缺鍵、沒有 sb）樣本裡都有；實驗線 d23c18d v${lab.source?.version}`,
      bad.slice(0, 3).join('；') || `預算不是全 1 的 ${non.length} 座；錄了 ${lab.seconds} 秒`);
  }

  // 2. 讀檔還原（sim.budget、覆蓋場雜湊）逐座＝實驗線
  const compare = mod => {
    const bad = [];
    for (const c of codes) {
      const L = lab.cities[c.id], r = decodeLabCode(c.code);
      if (!r.ok) { bad.push(`${c.id}：本線解不開碼（${r.error}）`); continue; }
      const s = mod.simFromSave(r.save, c.code, KT, vrank), d = [];
      const bt = KEYS.filter(k => !Object.is(s.budget[k], L.budget[k])); if (bt.length) d.push(`預算 ${bt.map(k => `${k} 本線 ${s.budget[k]}≠實驗線 ${L.budget[k]}`).join('、')}`);
      const h0 = covHashes(s), f0 = Object.keys(L.load).filter(k => h0[k] !== L.load[k]); if (f0.length) d.push(`讀檔後 ${f0.length} 個覆蓋場不同（${f0.slice(0, 4).join('、')}）`);
      mod.stepDay(s);
      const h1 = covHashes(s), f1 = Object.keys(L.day1).filter(k => h1[k] !== L.day1[k]); if (f1.length) d.push(`推進一天後 ${f1.length} 個覆蓋場不同（${f1.slice(0, 4).join('、')}）`);
      if (d.length) bad.push(`${c.id}：${d.join('；')}`);
    }
    return bad;
  };
  {
    const bad = compare(realDay);
    log(!bad.length, 'D023 驗收 1、2：本線讀檔還原服務預算——sim.budget 與 60 個覆蓋場每一場的位元組雜湊（讀檔後、推進一天後）逐座＝實驗線頁面（13 座城：AI 城、種子城、預建城、全種類樣張城、自造城各種預算）',
      bad.slice(0, 3).join('｜') || `${codes.length} 座逐座相等，每座 60 個覆蓋場 × 2 個時間點`);
  }

  // 3. 拿掉讀檔那一句的副本、預算改壞的副本：都要紅
  {
    const READ = 'budget = budgetOfSave(save.raw.sb)';
    const MUT = [
      ['讀檔不還原預算（D023 以前）', [[READ, 'budget = { ...SVC_BUDGET_DEFAULT }']]],
      ['不夾範圍', [['b[k] = clamp(v, .5, 1.5);', 'b[k] = v;']]],
      ['上限 1.5 改 1.4', [['b[k] = clamp(v, .5, 1.5);', 'b[k] = clamp(v, .5, 1.4);']]],
      ['只讀警察', [['for (const k of Object.keys(b) as (keyof SvcBudget)[])', "for (const k of ['police'] as (keyof SvcBudget)[])"]]],
      ["非數字也收（typeof 'number' 改成不是 undefined）", [["if (typeof v === 'number')", 'if (v !== undefined)']]],
      ['預設改 0（沒給的鍵、沒有 sb 都變 0）', [['const b: SvcBudget = { ...SVC_BUDGET_DEFAULT };', 'const b: SvcBudget = { police: 0, fire: 0, health: 0, edu: 0 };']]],
    ];
    const base = await dayVariant([]), ok0 = compare(base);
    const alive = [], out = [], noRead = [];
    for (const [name, edits] of MUT) {
      const m = await dayVariant(edits), bad = compare(m);
      out.push(`${name}：${bad.length} 座不等`);
      if (!bad.length) alive.push(name);
      if (name.startsWith('讀檔不還原')) {   // 拿掉讀檔那一句：每一座預算不是全 1 的城都要各自轉紅（AI 城的診所 43 棟、醫院 5 棟就是那個差）
        const red = new Set(bad.map(q => q.split('：')[0])), want = codes.filter(c => !isDefault(lab.cities[c.id].budget)).map(c => c.id);
        for (const id of want) if (!red.has(id)) noRead.push(id);
      }
    }
    log(!ok0.length && !alive.length && !noRead.length, 'D023 突變：把 day.ts 的副本改壞一處（讀檔不還原、不夾範圍、上限 1.4、只讀警察、非數字也收、預設改 0），整批要紅；拿掉讀檔那一句時每一座預算不是全 1 的城都各自紅；沒改的副本先核過全等',
      alive.length ? `沒抓到：${alive.join('、')}` : noRead.length ? `拿掉讀檔那一句，這幾座沒紅：${noRead.join('、')}` : ok0.length ? `沒改的副本就有 ${ok0.length} 座不等：${ok0[0]}` : out.join('；'));
  }

  // 4. 存檔不丟 sb（loadCode → saveCode），含字串、null、true 那些怪值
  {
    const bad = [];
    let n = 0;
    for (const c of codes) {
      const r0 = decodeLabCode(c.code), L = loadCode(c.code, KT, vrank);
      if (!r0.ok || !L.ok) { bad.push(`${c.id}：讀不進來`); continue; }
      const back = decodeLabCode(saveCode(L.sim, L.template, L.start));
      if (!back.ok) { bad.push(`${c.id}：存出來的碼本線解不開`); continue; }
      if (J(back.save.raw.sb) !== J(r0.save.raw.sb)) bad.push(`${c.id}：sb 讀進來 ${J(r0.save.raw.sb)}、存出去 ${J(back.save.raw.sb)}`);
      if (r0.save.raw.sb !== undefined) n++;
    }
    log(!bad.length && n >= 10, 'D023 驗收 3：存檔不丟預算——loadCode → saveCode 之後 sb 逐鍵原樣（含字串 "0.9"、null、true、只有一個鍵、沒有 sb）', bad.slice(0, 3).join('；') || `${codes.length} 座，其中有 sb 的 ${n} 座原樣`);
  }

  // 5. 維護費有傳進去：推進一天時傳給 dailyUpkeep 的 svcBudget＝讀進來的預算；AI 城換成全 1，維護費不同
  {
    const bad = [], cap = [];
    const spy = { ...realMoney, dailyUpkeep: inp => { cap.push(inp); return realMoney.dailyUpkeep(inp); } };
    const V = await dayVariant([], { './rules/money.ts': spy });
    const ai = codes.find(c => c.id === 'ai120'), r = decodeLabCode(ai.code), s = V.simFromSave(r.save, ai.code, KT, vrank);
    const rep = V.stepDay(s), got = cap.at(-1), L = lab.cities.ai120;
    if (cap.length !== 1) bad.push(`一天叫了 ${cap.length} 次 dailyUpkeep`);
    else {
      if (!KEYS.every(k => Object.is(got.svcBudget?.[k], L.budget[k]))) bad.push(`傳進 dailyUpkeep 的預算 ${J(got.svcBudget)} ≠ 實驗線讀進來的 ${J(L.budget)}`);
      if (!Object.is(rep.settle.upkeep, realMoney.dailyUpkeep(got))) bad.push(`結算的維護費 ${rep.settle.upkeep} ≠ 用這份輸入算的 ${realMoney.dailyUpkeep(got)}`);
      const same = realMoney.dailyUpkeep({ ...got, svcBudget: { ...SVC_BUDGET_DEFAULT } });
      if (!(rep.settle.upkeep < same)) bad.push(`預算 .9 的維護費 ${rep.settle.upkeep} 沒有比預算 1 的 ${same} 少`);
      log(!bad.length, 'D023 驗收 4：維護費有傳進去——AI 城（警 .9、醫療 .9）推進一天，傳給 dailyUpkeep 的 svcBudget＝讀進來的預算、結算的維護費＝用這份輸入算的；同一份輸入把預算換成全 1，維護費比較多',
        bad.join('；') || `維護費 ${rep.settle.upkeep.toFixed(2)}（預算全 1 會是 ${same.toFixed(2)}，差 ${(same - rep.settle.upkeep).toFixed(2)}）`);
      return;
    }
    log(false, 'D023 驗收 4：維護費有傳進去', bad.join('；'));
  }
}

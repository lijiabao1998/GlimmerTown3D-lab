// D038 Node 守衛（二）：科技與專精的實驗線頁面實跑（驗收 3、4）、接線突變（驗收 6）、存讀（驗收 5）、效能（驗收 8）。由 tools/unit.mjs 呼叫；公式半邊（vm 逐項與突變）在 tools/unit-d038.mjs。
//   1. 樣本 src/content/samples/d038-lab.json（tools/d038-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀：版本、回退設定、探針原文、每一筆的碼雜湊（＝本線現在產生的）、T 城／P 劇本／rt 的清單；
//   2. runs：T 系列（存檔直接帶 tech343、spec386 的自造城）連推 13 天，每天跟實驗線逐欄比——D034 的全部欄位加科技狀態（進行中、進度、完成的清單）、城市方向、每天的研究速度；**不把實驗線的科技清單寫進本線**
//      （本線自己讀存檔、自己推研究）；讀進來那一刻的科技與資金也比；錢也判；「不讀科技」「不讀專精」的那一版對有效果的城必須跟實驗線不同（有牙）；覆蓋：商業稅、工業稅、幸福、犯罪、起火、升級、需求、教育場、法規費、城市點數、
//      研究速度各自有城量到、研究連推到完成、完成教育場科技當天重建覆蓋場、30 個之後 D8 完成、四個方向各一座、畸形欄位整欄棄用、專精白名單的怪癖；
//   3. plays：P 系列動作劇本——每一個「開始研究」「選方向」動作的回傳、按完的資金與科技狀態逐項＝實驗線的 startTech343、specPick386（前置沒做、互斥、錢不夠、已在做、已有進度免費、換著做、沙盒、Lv.9）；之後每天每一欄全等；
//   4. rt：本線推一段（研究進行到一半、剛完成、選了方向、玩家按過動作）存檔，實驗線用自己的 GV.importCode 讀「本線存出來的碼」再推 3 天：每一欄跟本線一樣；
//   5. 接線：day.ts 的副本改壞一處要紅（不推進研究、速度少一項、完成教育場科技不重建覆蓋場、讀檔不讀科技、讀檔不讀專精）；saveCode 不寫回要紅；沒改的先核過全等；觀光專精接線要紅；
//   6. 存檔：T 城推進後 tech343、spec386 逐字＝模擬的狀態；存→讀→再存相同；沒有科技與專精的存檔（所有現有樣本碼）不落欄位；畸形的 tech343 讀檔整欄棄用、存回去不再帶著；
//   7. 效能：推進一天 ≤ 5 ms（相對判法，同 D035）。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { loadMod } from './unit-d024.mjs';
import { dayVariant } from './unit-d021.mjs';
import { compareCity33 } from './unit-d033-live.mjs';
import { PROBE, RT_DAYS, applyAct, stateOf, d038Rt } from './d038-lab.mjs';
import { d038Runs, d038Plays, TECH_DAYS, PLAY_DAYS } from './d038-cities.mjs';
import { SPEC_IDS386, techSave } from '../src/sim/rules/tech.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城
export async function d038LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D038 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

async function guards(log) {
  const lab = JSON.parse(read(process.env.D038_SAMPLE ?? 'src/content/samples/d038-lab.json')), runs = d038Runs(), plays = d038Plays(), rts = d038Rt();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, runs, plays, rts, KT, vrank });

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (lab.source?.probe !== PROBE) bad.push('探針原文跟 tools/d038-lab.mjs 現在的不同（重錄）');
    for (const [key, list, ord] of [['runs', runs, 'order'], ['plays', plays, 'playOrder'], ['rt', rts, 'rtOrder']]) {
      if (J(lab[ord]) !== J(list.map(c => c.id))) bad.push(`樣本的 ${key} 清單 ≠ 現在的（重跑 tools/d038-lab.mjs --part=${key}）`);
      for (const c of list) { const L = lab[key]?.[c.id]; if (!L) bad.push(`${key} ${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code) || L.rows.length !== c.days) bad.push(`${key} ${c.id}：本線產生的碼跟錄樣本時不同或天數不對（重跑 tools/d038-lab.mjs --part=${key}）`); }
    }
    log(!bad.length, `D038 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；T 城 ${runs.length} 座連推 ${TECH_DAYS} 天、P 動作劇本 ${plays.length} 個連推 ${PLAY_DAYS} 天、rt ${rts.length} 筆（本線存的碼給實驗線讀、再推 ${RT_DAYS} 天）；探針原文與碼雜湊＝本線現在的`,
      bad.slice(0, 4).join('；') || `runs ${Object.keys(lab.runs).length}、plays ${Object.keys(lab.plays).length}、rt ${Object.keys(lab.rt ?? {}).length}，錄了 ${lab.seconds} 秒`);
    if (bad.length) return;
  }

  // 一座城（碼＋樣本）逐天逐欄比（D033 的全部欄位＋bh／tw 以外：這裡只比 D033 的）；不寫入實驗線的科技清單；加科技狀態、方向、速度；acts＝這一天推進之前的動作
  const compare38 = (mod, code, rec, opt = {}) => {
    const extra = [];
    if (!opt.rowsOnly) {
      const s0 = mod.simFromSave(decodeLabCode(code).save, code, KT, vrank), a = [J(techSave(s0.tech, s0.edu.tech)), s0.edu.spec ?? '', s0.money];
      if (J(a) !== J(rec.start.tc)) extra.push(`讀進來那一刻的科技、方向、資金 本線 ${J(a).slice(0, 120)} ≠ 實驗線 ${J(rec.start.tc).slice(0, 120)}`);
    }
    const acts = rec.acts ?? [];
    const r = compareCity33(mod, code, { ...rec, acts: [] }, KT, vrank, { stopAtFirst: !!opt.stopAtFirst, noInject: true,
      before: acts.length ? (day, s) => {
        const bad = [];
        for (const x of acts.filter(q => q.d === day)) {
          const m = applyAct(s, x.a); if (m.ok !== x.r.ok || J(m.st) !== J(x.r.st)) bad.push(`動作 ${J(x.a)}：本線 ${J(m)} ≠ 實驗線 ${J(x.r)}`);
          opt.onAct?.(x, m);
        }
        return bad;
      } : undefined,
      onDay: (day, mine, row, rep, s) => {
        if (!opt.rowsOnly) {
          const tc = J(techSave(s.tech, s.edu.tech)), sp = s.edu.spec ?? '';
          if (tc !== row.tc) extra.push(`第 ${day} 天 科技狀態 本線 ${tc.slice(0, 120)} ≠ 實驗線 ${String(row.tc).slice(0, 120)}`);
          if (sp !== row.sp) extra.push(`第 ${day} 天 城市方向 本線 ${J(sp)} ≠ 實驗線 ${J(row.sp)}`);
          if (rep.tech.speed !== row.sd) extra.push(`第 ${day} 天 研究速度 本線 ${rep.tech.speed} ≠ 實驗線 ${row.sd}`);
        }
        opt.onDay?.(day, mine, row, rep, s);
      } });
    for (const x of extra) { r.d.push(x); if (!r.first) { r.first = 1; r.firstFields = ['tc']; } }
    return r;
  };
  const noTech = await dayVariant([['const T = techLoad(save.raw.tech343), g =', 'const T = techLoad(undefined), g =']]);
  const noSpec = await dayVariant([['spec: specOfSave(save.raw.spec386) || null,', 'spec: null,']]);
  // 這座城的讀檔拿掉科技／專精之後跟實驗線不同嗎（只比推進的欄位）：科技有效果的城要不同；畸形的整欄棄用與沒有科技的城不該有差
  const TECH_SAME = new Set(['S1', 'S2', 'S4', 'S5']);   // 這幾座沒有（有效的）科技：不讀科技也一樣（S5 畸形整欄棄用；S3 有進行中的 C1，十幾天內會做完＝不同；T12 做完的 A1 工業稅 ×1.04 有東西可乘＝不同）
  const SPEC_SAME = (id, spec) => !SPEC_IDS386.includes(spec ?? '');   // 沒有專精，或專精不是四個方向之一（不認得的整欄棄用；'constructor' 是實驗線白名單的怪癖：收了但沒有效果）：不讀專精也一樣

  // ---- 2. T 城連推 13 天 ----
  const seen = { days: 0, finished: [], rebuilt: [], fields: new Set(), speeds: {} };
  {
    const bad = [], info = [];
    for (const c of runs) {
      const rec = lab.runs[c.id], hasSpec = decodeLabCode(c.code).save.raw.spec386;
      const r = compare38(realDay, c.code, rec, { onDay: (day, mine, row, rep) => { seen.days++; if (rep.tech.finished) seen.finished.push(`${c.id}:${rep.tech.finished}@${day}`); seen.speeds[c.id] = rep.tech.speed; } });
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 220)}（共 ${r.d.length} 天不同）`);
      const t = compare38(noTech, c.code, rec, { rowsOnly: true, stopAtFirst: true }), sp = compare38(noSpec, c.code, rec, { rowsOnly: true, stopAtFirst: true });
      const techDiff = t.d.length > 0, specDiff = sp.d.length > 0;
      for (const f of [...t.fields, ...sp.fields]) seen.fields.add(f);
      if (TECH_SAME.has(c.id) ? techDiff : !techDiff) bad.push(`${c.id}：不讀科技的那一版${TECH_SAME.has(c.id) ? '不該有差（沒有有效的科技）' : '居然跟實驗線一樣（這一座沒有量到科技的效果）'}`);
      if (SPEC_SAME(c.id, hasSpec) ? specDiff : !specDiff) bad.push(`${c.id}：不讀專精的那一版${SPEC_SAME(c.id, hasSpec) ? '不該有差' : '居然跟實驗線一樣（這一座沒有量到專精的效果）'}`);
      info.push(`${c.id}：${techDiff ? '不讀科技就不同（' + t.firstFields.slice(0, 3).join('、') + '）' : ''}${specDiff ? '不讀專精就不同（' + sp.firstFields.slice(0, 3).join('、') + '）' : ''}${!techDiff && !specDiff ? '（對照）' : ''}`);
    }
    const need = ['tx', 'happy', 'ed', 'dm'];
    const lack = need.filter(f => !seen.fields.has(f));
    if (lack.length) bad.push(`不讀科技／專精的差只落在 ${[...seen.fields].join('、')}，沒有量到 ${lack.join('、')}`);
    for (const id of ['C2@', 'C4a@', 'D8@']) if (!seen.finished.some(x => x.includes(':' + id.slice(0, -1) + '@'))) bad.push(`沒有看到 ${id.slice(0, -1)} 研究完成`);
    LIVE.seen = seen;
    log(!bad.length, `D038 驗收 3：實驗線頁面實跑（T 系列 ${runs.length} 座自造城：A／B／C／D 四條路線、研究進行到完成、做完 30 個之後的 D8、四個方向、畸形欄位與專精白名單的怪癖；連推 ${TECH_DAYS} 天）——每天逐欄跟實驗線比（D034 的全部欄位）加科技狀態、城市方向、每天的研究速度，讀進來那一刻的科技與資金也比；錢也判；**不把實驗線的科技清單寫進本線**；不讀科技、不讀專精的那一版必須不同`,
      bad.slice(0, 4).join('｜') || `${runs.length} 座、${seen.days} 個城日每一欄全等（資金判了全部）；研究完成 ${seen.finished.join('、')}；不讀科技／專精的差落在 ${[...seen.fields].join('、')}；${info.join('；')}`);
  }

  // ---- 3. P 動作劇本 ----
  {
    const bad = [], stat = { ok: 0, no: 0, spec: 0, free: 0 };
    for (const c of plays) {
      const rec = lab.plays[c.id];
      const r = compare38(realDay, c.code, rec, { onAct: (x, m) => { if (m.ok) { stat.ok++; if (x.a[0] === 'spec') stat.spec++; if (x.a[0] === 'tech' && x.r.st[2] === rec.start.tc[2] - 0 && false) stat.free++; } else stat.no++; } });
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 240)}（共 ${r.d.length} 處不同）`);
      for (const x of rec.acts) if (!c.acts.some(q => q.d === x.d && J(q.a) === J(x.a))) bad.push(`${c.id}：樣本記的動作 ${J(x.a)} 不在劇本裡`);
      if (rec.acts.length !== c.acts.length) bad.push(`${c.id}：樣本記了 ${rec.acts.length} 個動作、劇本 ${c.acts.length} 個`);
    }
    // 覆蓋：開始研究成功與失敗、選方向成功與失敗都有
    const allActs = plays.flatMap(c => lab.plays[c.id].acts), techOk = allActs.filter(x => x.a[0] === 'tech' && x.r.ok).length, techNo = allActs.filter(x => x.a[0] === 'tech' && !x.r.ok).length, specOk = allActs.filter(x => x.a[0] === 'spec' && x.r.ok).length, specNo = allActs.filter(x => x.a[0] === 'spec' && !x.r.ok).length;
    const freeStarts = allActs.filter(x => x.a[0] === 'tech' && x.r.ok).filter(x => { const i = allActs.indexOf(x); return i > 0; }).length;
    if (!(techOk >= 8 && techNo >= 5 && specOk >= 2 && specNo >= 3)) bad.push(`動作覆蓋太單薄：開始研究 成功 ${techOk}／失敗 ${techNo}、選方向 成功 ${specOk}／失敗 ${specNo}`);
    log(!bad.length, `D038 驗收 4：動作——實驗線頁面的 startTech343、specPick386（探針直接叫）跟本線 startResearch、chooseSpec 吃同一批劇本（${plays.length} 個：前置沒做、互斥、錢不夠、已在做、已有進度免費、換著做、沙盒、Lv.9 以前、已選過、教育科技城、30 個才開得了 D8）：每個動作的回傳、按完的資金與科技狀態逐項相等；之後連推 ${PLAY_DAYS} 天每一欄全等`,
      bad.slice(0, 4).join('｜') || `${plays.length} 個劇本、${allActs.length} 個動作：開始研究 成功 ${techOk}／被擋 ${techNo}、選方向 成功 ${specOk}／被擋 ${specNo}，全等${freeStarts ? '' : ''}`);
  }

  // ---- 4. rt：本線存的碼，實驗線讀進來 ----
  {
    const bad = [], info = [];
    for (const c of rts) {
      const rec = lab.rt[c.id], r = compare38(realDay, c.code, rec);
      if (r.d.length) bad.push(`${c.id}：${r.d[0].slice(0, 200)}（共 ${r.d.length} 天不同）`);
      info.push(`${c.id} 讀進來 ${J(rec.start.tc).slice(0, 70)}`);
    }
    log(!bad.length, `D038 驗收 5：實驗線讀本線存的碼——本線推一段（研究進行到一半、剛完成、選了方向、玩家按過動作）再存檔，實驗線用自己的 GV.importCode 讀「本線存出來的碼」再推 ${RT_DAYS} 天，讀回來的科技與方向＝本線的、之後的每一欄跟本線一樣`,
      bad.slice(0, 3).join('｜') || `${rts.length} 筆全等：${info.join('；')}`);
  }

  await wiringGuards(log, { lab, runs, rts, compare38, KT, vrank });
  await persistGuards(log, { runs, plays, KT, vrank });
  await timing(log, { runs, KT, vrank });
}

// ---- 5. 接線突變（驗收 6）----
const WIRING = [   // [名字, day.ts 的編輯, 要被哪幾座 T 城抓到]
  ['不推進研究', [["const rs = advanceTech(s.tech, s.edu.tech, cnt as unknown as ResearchIn, s.edu.spec), techRep = { speed: rs.speed, finished: rs.finished };", 'const rs = { speed: 1, finished: null }, techRep = { speed: rs.speed, finished: rs.finished };']], ['T9', 'T10', 'T11', 'S3']],
  ['研究速度少算研究院', [['cnt as unknown as ResearchIn', '{ ...cnt, inN: 0 } as unknown as ResearchIn']], ['T10', 'T11', 'S3']],
  ['完成教育場科技不重建覆蓋場', [['{ rebuildCov(w, g, s.budget, s.edu); s.landDirty = false; s.landBox = null; s.stale.fill(0); }', '{ }']], ['T11']],
  ['讀檔不讀科技', [['const T = techLoad(save.raw.tech343), g =', 'const T = techLoad(undefined), g =']], ['T1', 'T3', 'T9', 'T10']],
  ['讀檔不讀專精', [['spec: specOfSave(save.raw.spec386) || null,', 'spec: null,']], ['S1', 'S2', 'S3', 'S4']],
  ['專精給了但不進研究速度（S3 的 +1）', [['cnt as unknown as ResearchIn, s.edu.spec)', 'cnt as unknown as ResearchIn, null)']], ['S3']],
];
async function wiringGuards(log, { lab, runs, rts, compare38, KT, vrank }) {
  const codeOf = id => runs.find(c => c.id === id).code, recOf = id => lab.runs[id];
  const diffOn = (mod, ids) => ids.map(id => ({ id, d: compare38(mod, codeOf(id), recOf(id), { stopAtFirst: true }).d })).filter(x => x.d.length);
  const bad = [], out = [];
  const allIds = [...new Set(WIRING.flatMap(m => m[2]))];
  const base = diffOn(await dayVariant([]), allIds);
  if (base.length) bad.push(`沒改的副本就有不對：${base.slice(0, 3).map(x => `${x.id} ${x.d[0].slice(0, 80)}`).join('｜')}`);
  for (const [name, edits, ids] of WIRING) {
    let V; try { V = await dayVariant(edits); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message.slice(0, 120)}`); continue; }
    const hit = diffOn(V, ids).map(x => x.id);
    out.push(`${name}：${hit.length ? hit.join('、') : '沒抓到'}`);
    if (hit.length !== ids.length) bad.push(`「${name}」沒抓到（要 ${ids.join('、')}，抓到 ${hit.join('、') || '無'}）`);
  }
  // 觀光的專精接線（綠色城市 ×1.15）：food.ts 的副本不接 spec，S2 的觀光逐欄會差
  {
    const F = await loadMod('src/sim/rules/food.ts', [["(x.spec === 'green' ? 1.15 : 1)", '1']]).catch(e => { bad.push('food.ts 突變的錨點對不上：' + e.message.slice(0, 80)); return null; });
    if (F) { const E = await loadMod('src/sim/rules/economy.ts', [], { './food.ts': F }), V = await dayVariant([], { './rules/economy.ts': E }); if (!diffOn(V, ['S2']).length) bad.push('沒抓到：觀光不吃綠色城市的專精'); out.push('觀光專精'); }   // economy.ts 的 foodDay 接到改壞的 food.ts，再讓 day.ts 接到這份 economy.ts
  }
  // saveCode 不寫回：本線推一段存檔，科技狀態變了的存檔必須帶著新的
  {
    const S = await loadMod('src/io/save.ts', [['{ const tq = techSave(s.tech, s.edu.tech); if (tq) o.tech343 = tq; else delete o.tech343; if (s.edu.spec) o.spec386 = s.edu.spec; else delete o.spec386; }', '{ /* 突變：不寫 */ }']]).catch(e => { bad.push('saveCode 突變的錨點對不上：' + e.message.slice(0, 80)); return null; });
    if (S) {
      const c = runs.find(q => q.id === 'T10'), L = loadCode(c.code, KT, vrank); for (let d = 0; d < 3; d++) realDay.stepDay(L.sim);
      const good = decodeLabCode(saveCode(L.sim, L.template, L.start)).save.raw.tech343, mut = decodeLabCode(S.saveCode(L.sim, L.template, L.start)).save.raw.tech343;
      if (J(good?.done) !== J(['C1', 'C2']) || J(mut) === J(good)) bad.push(`沒抓到：saveCode 不寫回科技（好的 ${J(good)}、突變的 ${J(mut)}）`);
      out.push('saveCode 不寫回');
    }
  }
  log(!bad.length, `D038 驗收 6：接線——day.ts 的副本改壞一處（${WIRING.length} 個：不推進研究、速度少一項、完成教育場科技不重建覆蓋場、讀檔不讀科技、不讀專精、專精不進研究速度）都要紅；觀光不吃專精要紅；saveCode 不寫回要紅；沒改的先核過全等`,
    bad.slice(0, 4).join('｜') || out.join('；'));
}

// ---- 6. 存檔 ----
async function persistGuards(log, { runs, plays, KT, vrank }) {
  const bad = [], info = [];
  for (const c of [...runs, ...plays]) {
    const L = loadCode(c.code, KT, vrank); if (!L.ok) { bad.push(`${c.id}：讀不進 ${L.error}`); continue; }
    const raw0 = decodeLabCode(c.code).save.raw;
    for (let d = 0; d < 5; d++) realDay.stepDay(L.sim);
    const code1 = saveCode(L.sim, L.template, L.start), r1 = decodeLabCode(code1).save.raw, want = techSave(L.sim.tech, L.sim.edu.tech);
    if (J(r1.tech343 ?? null) !== J(want)) bad.push(`${c.id}：存出來的 tech343 ${J(r1.tech343)?.slice(0, 80)} ≠ 模擬的 ${J(want)?.slice(0, 80)}`);
    if ((r1.spec386 ?? '') !== (L.sim.edu.spec ?? '')) bad.push(`${c.id}：存出來的 spec386 ${J(r1.spec386)} ≠ 模擬的 ${J(L.sim.edu.spec)}`);
    const L2 = loadCode(code1, KT, vrank); if (!L2.ok) { bad.push(`${c.id}：存的碼讀不回 ${L2.error}`); continue; }
    if (J(techSave(L2.sim.tech, L2.sim.edu.tech)) !== J(want) || (L2.sim.edu.spec ?? '') !== (L.sim.edu.spec ?? '')) bad.push(`${c.id}：存→讀之後科技或方向不同`);
    const r2 = decodeLabCode(saveCode(L2.sim, L2.template, L2.start)).save.raw;
    if (J(r1.tech343) !== J(r2.tech343) || r1.spec386 !== r2.spec386) bad.push(`${c.id}：存→讀→再存的 tech343／spec386 不同`);
    info.push(`${c.id}${r1.tech343 ? ' tech' + r1.tech343.done.length : ''}${r1.spec386 ? ' ' + r1.spec386 : ''}${raw0.tech343 && !r1.tech343 ? ' 棄用' : ''}`);
  }
  // 沒有科技與專精的存檔：不落欄位（所有現有樣本碼）
  const samples = fs.readdirSync(path.join(ROOT, 'src/content/samples')).filter(f => f.endsWith('.code.txt'));
  for (const f of samples) {
    const code = read('src/content/samples/' + f).trim(), L = loadCode(code, KT, vrank); if (!L.ok) { bad.push(`${f}：讀不進`); continue; }
    const raw0 = decodeLabCode(code).save.raw, raw1 = decodeLabCode(saveCode(L.sim, L.template, L.start)).save.raw;
    if (J(raw0.tech343) !== J(raw1.tech343) || J(raw0.spec386) !== J(raw1.spec386) || ('tech343' in raw0) !== ('tech343' in raw1) || ('spec386' in raw0) !== ('spec386' in raw1)) bad.push(`${f}：沒有科技與專精的存檔多了或少了欄位`);
  }
  // 畸形的 tech343（S5）：讀檔整欄棄用、存回去不再帶著；專精 'constructor' 的怪癖照收、照存
  { const c = runs.find(q => q.id === 'S5'), L = loadCode(c.code, KT, vrank), raw1 = decodeLabCode(saveCode(L.sim, L.template, L.start)).save.raw; if ('tech343' in raw1 || raw1.spec386 !== 'constructor') bad.push(`S5：畸形欄位處理不對（tech343 ${'tech343' in raw1 ? '還在' : '沒了'}、spec386 ${J(raw1.spec386)}）`); }
  log(!bad.length, `D038 驗收 5：存檔——T 城與 P 劇本推進後存出來的 tech343、spec386＝模擬的狀態；存→讀→再存相同；沒有科技與專精的存檔（現有 ${samples.length} 個樣本碼）不落欄位；畸形的 tech343 讀檔整欄棄用、存回去不再帶著；專精 'constructor' 的怪癖照收照存`,
    bad.slice(0, 4).join('｜') || `${runs.length + plays.length} 座都過：${info.join('、')}`);
}

// ---- 7. 效能 ----
async function timing(log, { runs, KT, vrank }) {
  const c = runs.find(q => q.id === 'T9'), once = noTech => {
    const s = loadCode(c.code, KT, vrank).sim, ts = [];
    if (noTech) { s.edu.tech.length = 0; s.tech.act = ''; s.tech.prog = {}; }
    for (let d = 0; d < 5; d++) realDay.stepDay(s);
    for (let d = 0; d < 60; d++) { const t0 = performance.now(); realDay.stepDay(s); ts.push(performance.now() - t0); }
    return ts.reduce((x, y) => x + y, 0) / ts.length;
  };
  const a = [], b = [];
  for (let r = 0; r < 4; r++) { a.push(once(false)); b.push(once(true)); }
  const fa = Math.min(...a), fb = Math.min(...b), rel = fa <= 1.5 * fb + .5, abs = fa <= 5 || fb > 5;
  log(rel && abs, 'D038 驗收 8：推進一天 ≤ 5 ms（D011 驗收 8）——量一座做完 31 個科技的城（T9，交錯量四輪各 60 天取平均最低的一輪），不比沒有科技的同一座城慢過 1.5 倍',
    `有科技：${a.map(x => x.toFixed(2)).join('／')} → 最低 ${fa.toFixed(2)} ms；沒有科技：${b.map(x => x.toFixed(2)).join('／')} → 最低 ${fb.toFixed(2)} ms；比值 ${(fa / fb).toFixed(2)}${fb > 5 ? '（對照組超過 5 ms：機器忙，絕對值不判）' : ''}`);
}

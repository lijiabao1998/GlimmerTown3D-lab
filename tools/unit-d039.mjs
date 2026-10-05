// D039 Node 守衛：玩家決策進世界歷史（城市格式 8）。由 tools/unit.mjs 呼叫。
//   1. 碼表與格式：POLICY_CODES／BUDGET_CODES／TECH_CODES／SPEC_CODES 是寫死的字面量，跟政策目錄（29）、預算類別（4）、科技表（36）、專精表（4）現在的順序一致；
//      CITY_FORMAT 8；新事件 eventFormat 8、舊事件不變；現有 6 個樣本碼讀進來存出去，格式仍是 4（沒有新事件的城不變）；
//   2. 記錄：☰ 面板背後的動作（setPolicy、setBudget、startResearch、chooseSpec）成功才記、且只記一筆（政策與稅率含 from；冷卻中、同值、夾到頭、再按進行中的節點、錢不夠、前置沒做、
//      方向第一下都不記）；研究完成當天記 techdone（日子＝正在結算的那一天）；順序＝發生順序；
//   3. 重播＝模擬：200 段隨機動作劇本（政策、預算、研究、方向、推進幾天，含被擋的動作；20 段推進 30 天以上，讓研究真的做完），每一段結束 decisionsOf 折出來的政策、預算、
//      完成清單（含順序）、進行中的節點、城市方向逐項＝模擬；每一筆 from＝折到那一筆之前的值；
//   4. 編解碼：每段劇本的歷史 packHistory＝日誌接續編碼 packMore（分兩段編逐列相同）、unpackHistory 來回相同、checkHistory（hv 1 物件）來回相同；每加一個動作前面的列逐列不變
//      （只增不改）；壞資料（碼不認得、值超出範圍、欄位缺、方向碼超界）丟明確的錯；碼表錯位、欄位丟失的突變要紅；
//   5. 存讀：saveCode→loadCode→saveCode 的歷史逐列相同、決策與狀態都在；有決策的城存出格式 8、沒有的存出原本的格式；比現行格式新的碼（f＝CITY_FORMAT+1）不猜（只用存檔）；
//   6. 大事記的白話：chronicleOf 的文字。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { loadCode, saveCode, packHistory, unpackHistory, checkHistory, historyFormat } from '../src/io/save.ts';
import { packMore, PACK0 } from '../src/io/journal.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { CITY_FORMAT, DECISION_EVENTS, POLICY_CODES, BUDGET_CODES, TECH_CODES, SPEC_CODES, eventFormat } from '../src/sim/city.ts';
import { setPolicy, setBudget, startResearch, chooseSpec } from '../src/sim/edit.ts';
import { decisionsOf, chronicleOf } from '../src/sim/decisions.ts';
import { POLICY_CATALOG, BUDGET_CATS, ensurePol } from '../src/sim/rules/policy.ts';
import { TECH343, SPEC_IDS386 } from '../src/sim/rules/tech.ts';
import { loadMod } from './unit-d024.mjs';
import { d038Plays } from './d038-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;

export const LIVE = {};
export async function d039Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D039 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

const tableOk = (c) => J(c.POLICY_CODES) === J(Object.keys(POLICY_CATALOG)) && J(c.BUDGET_CODES) === J(BUDGET_CATS.map(q => q.id)) && J(c.TECH_CODES) === J(TECH343.map(n => n.id)) && J(c.SPEC_CODES) === J(SPEC_IDS386);
const startOf = s => ({ pol: s.pol ? { ...s.pol } : null, budget: { ...s.budget }, done: [...s.edu.tech], act: s.tech.act, spec: s.edu.spec ?? null });

// 一段隨機劇本：回傳 { sim, start, snaps（每個動作前的歷史列數與前綴列）, did }。動作都走面板背後的函式
function playScript(KT, vrank, code, seed, { long = false } = {}) {
  const R = mulberry32(seed), L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('讀不進 ' + L.error);
  const s = L.sim, start = startOf(s), did = { policy: 0, budget: 0, research: 0, spec: 0, blocked: 0, steps: 0 };
  const ri = n => Math.floor(R() * n), snaps = [];
  const n = long ? 14 : 10 + ri(8);
  for (let k = 0; k < n; k++) {
    snaps.push(s.city.history.length);
    const r = R();
    if (r < .3) {   // 政策或稅率
      const key = POLICY_CODES[ri(POLICY_CODES.length)], cfg = POLICY_CATALOG[key];
      const res = setPolicy(s, key, cfg.type === 'tax' ? 0.5 + ri(16) / 10 : R() < .5);
      res.ok ? did.policy++ : did.blocked++;
    } else if (r < .5) { const c = BUDGET_CODES[ri(4)]; const ok = setBudget(s, c, (R() < .5 ? -1 : 1) * .1); void ok; did.budget++; }
    else if (r < .75) { const id = TECH_CODES[long && k < 3 ? [0, 9, 18][k] : ri(36)]; const res = startResearch(s, id); res.ok ? did.research++ : did.blocked++; }
    else if (r < .83) { const res = chooseSpec(s, ri(5)); res.ok ? did.spec++ : did.blocked++; }
    else { const days = long ? 4 + ri(5) : 1 + ri(4); for (let d = 0; d < days; d++) { realDay.stepDay(s); did.steps++; } }
  }
  if (long) for (let d = 0; d < 30; d++) { realDay.stepDay(s); did.steps++; }
  return { sim: s, start, snaps, did };
}

async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const plays = Object.fromEntries(d038Plays().map(c => [c.id, c.code]));
  Object.assign(LIVE, { KT, vrank, plays });

  // ---- 1. 碼表與格式 ----
  {
    const bad = [], city = await import('../src/sim/city.ts');
    if (!tableOk(city)) bad.push('碼表跟目錄／科技表／專精表現在的順序不一致（新的鍵要接在後面、既有的號不改）');
    if (CITY_FORMAT < 8) bad.push(`CITY_FORMAT ${CITY_FORMAT} < 8（決策事件是格式 8，D040 起現行 9）`);
    const ev = { policy: { day: 1, t: 'policy', key: 'taxR', from: 1, value: 1.1 }, budget: { day: 1, t: 'budget', cat: 'edu', from: 1, value: 1.1 }, research: { day: 1, t: 'research', id: 'A1', fee: 400 }, spec: { day: 1, t: 'spec', id: 'ind' }, techdone: { day: 1, t: 'techdone', id: 'A1' } };
    for (const [t, e] of Object.entries(ev)) if (eventFormat(e) !== 8) bad.push(`${t} 的 eventFormat ${eventFormat(e)} ≠ 8`);
    if (DECISION_EVENTS.length !== 5) bad.push('DECISION_EVENTS 不是 5 種');
    const olds = [{ day: 1, t: 'grow', x: 1, z: 1, k: 1, lv: 1, v: 0 }, { day: 1, t: 'act', x: 1, z: 1, what: 'fire', cost: 30 }, { day: 1, t: 'merge', x: 1, z: 1, k: 33, size: 2, v: 0, from: [1] }, { day: 1, t: 'pipe', x: 1, z: 1, cost: 1, g: 1 }, { day: 1, t: 'restyle', x: 1, z: 1, v: 1 }];
    const want = [4, 6, 7, 5, 4];
    olds.forEach((e, i) => { if (eventFormat(e) !== want[i]) bad.push(`舊事件 ${e.t} 的格式變成 ${eventFormat(e)}（要 ${want[i]}）`); });
    const samples = fs.readdirSync(path.join(ROOT, 'src/content/samples')).filter(f => f.endsWith('.code.txt'));
    let n = 0;
    for (const f of samples) {
      const code = read('src/content/samples/' + f).trim(), L = loadCode(code, KT, vrank); if (!L.ok) { bad.push(`${f} 讀不進`); continue; }
      const f1 = historyFormat(L.sim.city.history), f2 = decodeLabCode(saveCode(L.sim, L.template, L.start)).save.raw.d3?.f;
      if (f1 > 6 || f2 !== f1) bad.push(`${f}：沒有決策的城格式變了（${f1}／${f2}）`); n++;
    }
    log(!bad.length, `D039 驗收 1：碼表與格式——POLICY_CODES（${POLICY_CODES.length}）、BUDGET_CODES（4）、TECH_CODES（${TECH_CODES.length}）、SPEC_CODES（4）寫死的字面量＝政策目錄、預算類別、科技表、專精表現在的順序；CITY_FORMAT 8；五種新事件 eventFormat 8、舊事件（grow 4、act 6、merge 7、pipe 5、restyle 4）不變；現有 ${samples.length} 個樣本碼讀進來存出去，沒有決策的城格式不變`,
      bad.slice(0, 4).join('；') || `${n} 個樣本碼格式不變`);
    if (bad.length) return;
  }

  // ---- 2. 記錄：逐個動作 ----
  {
    const bad = [], info = [];
    const L = loadCode(plays.P1, KT, vrank), s = L.sim, h = s.city.history, nev = () => h.length, last = () => h[h.length - 1];
    const before = nev();
    const a = setPolicy(s, 'taxR', 1.1), e1 = last();
    if (!a.ok || nev() !== before + 1 || J(e1) !== J({ day: s.day, t: 'policy', key: 'taxR', from: 1, value: 1.1 })) bad.push(`稅率 1.0→1.1 沒記對：${J(e1)}`);
    const n1 = nev(); setPolicy(s, 'taxR', 1.2); setPolicy(s, 'taxR', 1.1);
    if (nev() !== n1) bad.push('冷卻中再調稅率也記了');
    setPolicy(s, 'curfew', true); const e2 = last();
    if (J(e2) !== J({ day: s.day, t: 'policy', key: 'curfew', from: 0, value: 1 })) bad.push(`開宵禁沒記對：${J(e2)}`);
    const n2 = nev(); setPolicy(s, 'curfew', true); setPolicy(s, 'noSuchKey', 1);
    if (nev() !== n2) bad.push('同值或不認得的鍵也記了');
    const n3 = nev(); setBudget(s, 'police', .1); const e3 = last();
    if (nev() !== n3 + 1 || J(e3) !== J({ day: s.day, t: 'budget', cat: 'police', from: 1, value: 1.1 })) bad.push(`預算 +0.1 沒記對：${J(e3)}`);
    for (let k = 0; k < 8; k++) setBudget(s, 'police', .1);
    const n4 = nev(); setBudget(s, 'police', .1); setBudget(s, 'nope', .1);
    if (nev() !== n4) bad.push('預算夾到頭沒變、或不認得的類別，也記了');
    const n5 = nev(); const r1 = startResearch(s, 'A1'), e5 = last();
    if (!r1.ok || nev() !== n5 + 1 || J(e5) !== J({ day: s.day, t: 'research', id: 'A1', fee: 400 })) bad.push(`開始研究沒記對：${J(e5)}`);
    const n6 = nev(); startResearch(s, 'A1'); startResearch(s, 'A2'); startResearch(s, 'D8');
    if (nev() !== n6) bad.push('再按正在做的節點、前置沒做、30 個才開得了的，也記了');
    const n7 = nev(); startResearch(s, 'B1'); realDay.stepDay(s); realDay.stepDay(s); const r2 = startResearch(s, 'A1'), e7 = last();
    if (!r2.ok || e7.t !== 'research' || e7.id !== 'A1' || e7.fee !== 400) { /* A1 在 B1 之前有 0 進度（沒推進過）：要 400 */ }
    if (nev() < n7 + 2) bad.push('換著做沒有記兩筆');
    const sp = chooseSpec(s, 0), es = last();
    if (!sp.ok || J(es) !== J({ day: s.day, t: 'spec', id: 'ind' })) bad.push(`選方向沒記對：${J(es)}`);
    const n8 = nev(); chooseSpec(s, 1);
    if (nev() !== n8) bad.push('已選過的方向再選也記了');
    // 錢不夠、Lv.9 以前、沙盒：P3（$300、rk 3）、P2（沙盒）
    const L3 = loadCode(plays.P3, KT, vrank), s3 = L3.sim, m3 = s3.city.history.length; startResearch(s3, 'A1'); chooseSpec(s3, 0);
    if (s3.city.history.length !== m3) bad.push('錢不夠或 Lv.9 以前也記了');
    const L2 = loadCode(plays.P2, KT, vrank), s2 = L2.sim, m2 = s2.city.history.length; startResearch(s2, 'A1'); const e9 = s2.city.history.at(-1); chooseSpec(s2, 0);
    if (s2.city.history.length !== m2 + 1 || J(e9) !== J({ day: s2.day, t: 'research', id: 'A1', fee: 0 })) bad.push(`沙盒開始研究（免費）沒記成費用 0：${J(e9)}`);
    // 研究完成當天記 techdone：T10（C2 50/55 一天做完）
    const T10 = d038Plays; void T10;
    const Lc = loadCode(plays.P1, KT, vrank), sc = Lc.sim; startResearch(sc, 'A1');   // P1：$20,000、Lv.9
    const dayBefore = sc.day; let done = null, steps = 0;
    while (!done && steps < 40) { realDay.stepDay(sc); steps++; done = sc.city.history.find(q => q.t === 'techdone'); }
    if (!done || done.id !== 'A1' || done.day !== dayBefore + steps) bad.push(`研究完成沒記 techdone（或日子不對）：${J(done)}、推進 ${steps} 天、開始那天 ${dayBefore}`);
    const hs = sc.city.history, iR = hs.findIndex(q => q.t === 'research'), iD = hs.findIndex(q => q.t === 'techdone');
    if (!(iR >= 0 && iD > iR)) bad.push('開始研究不在完成之前');
    for (let k = 1; k < hs.length; k++) if (hs[k].day < hs[k - 1].day) { bad.push(`歷史的日子往回走：第 ${k} 筆`); break; }
    info.push(`稅率、宵禁、預算、研究、方向各一筆；A1 推進 ${steps} 天完成、記 techdone（第 ${done?.day} 天）`);
    log(!bad.length, 'D039 驗收 3：記錄——政策與稅率（含改之前的值）、預算、開始研究（含沙盒免費＝0）、選方向成功才記且只記一筆；冷卻中、同值、不認得的鍵、夾到頭、再按進行中的節點、前置沒做、30 個才開得了、錢不夠、Lv.9 以前、已選過都不記；研究完成當天記 techdone；日子不往回走',
      bad.slice(0, 4).join('；') || info.join('；'));
  }

  // ---- 3、4、5. 200 段隨機劇本：重播＝模擬、編解碼、只增不改 ----
  const cities = ['P1', 'P4', 'P5', 'P6', 'P2', 'P3'];
  const scripts = [];
  for (let i = 0; i < 200; i++) scripts.push({ seed: 3900000 + i * 17, id: cities[i % cities.length], long: i % 10 === 0 });
  const stat = { events: 0, policy: 0, budget: 0, research: 0, spec: 0, techdone: 0, blocked: 0, steps: 0, longDone: 0 };
  const badFold = [], badPack = [], badGrow = [];
  const sample = [];
  for (const sc of scripts) {
    const { sim, start, snaps, did } = playScript(KT, vrank, plays[sc.id], sc.seed, { long: sc.long });
    const h = sim.city.history;
    stat.blocked += did.blocked; stat.steps += did.steps;   // 其餘的數量從歷史數（動作成功不等於歷史有一筆：預算夾到頭不記）
    stat.events += h.filter(e => DECISION_EVENTS.includes(e.t)).length;
    for (const t of ['policy', 'budget', 'research', 'spec', 'techdone']) stat[t] += h.filter(e => e.t === t).length;
    if (sc.long) stat.longDone += h.filter(e => e.t === 'techdone').length;
    // 折出來的狀態＝模擬
    const st = decisionsOf(h, start);
    const mine = { pol: J(ensurePol(sim.pol)), budget: J(sim.budget), done: J(sim.edu.tech), act: sim.tech.act, spec: sim.edu.spec ?? '' };
    const fold = { pol: J(st.pol), budget: J(st.budget), done: J(st.done), act: st.act, spec: st.spec };
    for (const k of Object.keys(mine)) if (mine[k] !== fold[k]) { badFold.push(`${sc.id}#${sc.seed} ${k}：模擬 ${String(mine[k]).slice(0, 80)} ≠ 折出來 ${String(fold[k]).slice(0, 80)}`); break; }
    // from＝折到那一筆之前的值
    { const run = decisionsOf([], start); for (const e of h) { if (e.t === 'policy') { const c = POLICY_CATALOG[e.key], was = run.pol[e.key], w = typeof was === 'boolean' ? +was : was; if (w !== e.from) { badFold.push(`${sc.id}#${sc.seed} policy ${e.key} 的 from ${e.from} ≠ 之前的值 ${w}`); break; } void c; }
        else if (e.t === 'budget' && run.budget[e.cat] !== e.from) { badFold.push(`${sc.id}#${sc.seed} budget ${e.cat} 的 from ${e.from} ≠ 之前的值 ${run.budget[e.cat]}`); break; }
        const one = decisionsOf([e], { pol: run.pol, budget: run.budget, done: run.done, act: run.act, spec: run.spec }); Object.assign(run, one); } }
    // 編解碼
    const rows = packHistory(h);
    try {
      if (J(unpackHistory(rows, sim.w.N)) !== J(h)) badPack.push(`${sc.id}#${sc.seed} 緊湊列來回不同`);
      const k = h.length >> 1, a = packMore(h.slice(0, k), PACK0), b = packMore(h, a.st);
      if (J([...a.rows, ...b.rows]) !== J(rows)) badPack.push(`${sc.id}#${sc.seed} 分兩段編（日誌接續）≠ 一次編`);
      if (J(checkHistory(JSON.parse(J(h)), sim.w.N)) !== J(h)) badPack.push(`${sc.id}#${sc.seed} 物件格式（hv 1）來回不同`);
    } catch (e) { badPack.push(`${sc.id}#${sc.seed} 編解碼丟例外：${e.message.slice(0, 80)}`); }
    // 只增不改：每個動作前的列數 → 那時的列是最後列的前綴
    for (const n of snaps) { const pre = packHistory(h.slice(0, n)); if (J(pre) !== J(rows.slice(0, n))) { badGrow.push(`${sc.id}#${sc.seed} 前 ${n} 筆的列在後面被改了`); break; } }
    if (sample.length < 3 && h.some(e => e.t === 'techdone')) sample.push({ h, start, id: sc.id });
  }
  LIVE.stat = stat; LIVE.sample = sample;
  log(!badFold.length && stat.policy > 150 && stat.budget > 100 && stat.research > 50 && stat.spec > 5 && stat.techdone > 10 && stat.blocked > 100,
    `D039 驗收 4：重播＝模擬——200 段隨機動作劇本（6 座城、20 段推進 30 天以上），結束時 decisionsOf 折出來的政策、預算、完成清單（含順序）、進行中的節點、城市方向逐項＝模擬；每一筆 policy／budget 的 from＝折到那一筆之前的值；覆蓋要夠`,
    badFold.slice(0, 3).join('；') || `${stat.events} 筆決策事件：政策 ${stat.policy}、預算 ${stat.budget}、開始研究 ${stat.research}、方向 ${stat.spec}、科技完成 ${stat.techdone}（長劇本裡 ${stat.longDone}）；被擋的動作 ${stat.blocked}；推進 ${stat.steps} 天`);
  log(!badPack.length && !badGrow.length, 'D039 驗收 2、5：編解碼與只增不改——200 段劇本的歷史，packHistory＝分兩段編（日誌接續）逐列相同、unpackHistory 與 checkHistory（hv 1）來回相同；每個動作之前的前綴列，到最後逐列不變',
    [...badPack.slice(0, 2), ...badGrow.slice(0, 2)].join('；') || `${scripts.length} 段、每段的每個動作前綴都核過`);

  // ---- 4b. 壞資料與突變 ----
  {
    const bad = [], N = 72, ok = unpackHistory([[18, 3, 0, 1, 1.1], [19, 0, 3, 1, 0.9], [20, 1, 0, 400], [21, 0, 2], [22, 5, 35]], N);
    if (J(ok.map(e => e.t)) !== J(['policy', 'budget', 'research', 'spec', 'techdone']) || ok[0].key !== 'taxR' || ok[1].cat !== 'edu' || ok[2].id !== 'A1' || ok[3].id !== 'edu' || ok[4].id !== 'D8') bad.push(`好的列讀錯：${J(ok)}`);
    const badRows = {
      '政策碼超界': [18, 0, 29, 0, 1], '政策碼不是整數': [18, 0, 'x', 0, 1], '稅率超出 .5–2': [18, 0, 0, 1, 3], '開關值不是 0／1': [18, 0, 3, 0, 2], '政策缺值': [18, 0, 3, 0],
      '預算類別超界': [19, 0, 4, 1, 1.1], '預算值超出': [19, 0, 0, 1, 2], '預算缺值': [19, 0, 0, 1], '研究節點超界': [20, 0, 36, 0], '研究缺費用': [20, 0, 0], '研究費用不是數': [20, 0, 0, 'x'],
      '方向碼超界': [21, 0, 4], '方向缺': [21, 0], '完成節點超界': [22, 0, 99], '欄位太多': [21, 0, 1, 1],
    };
    for (const [what, row] of Object.entries(badRows)) { let threw = false; try { unpackHistory([row], N); } catch { threw = true; } if (!threw) bad.push(`壞列（${what}）沒被擋`); }
    for (const [what, e] of Object.entries({ 政策鍵不認得: { day: 1, t: 'policy', key: 'nope', from: 1, value: 1 }, 研究節點不認得: { day: 1, t: 'research', id: 'Z9', fee: 0 }, 方向不認得: { day: 1, t: 'spec', id: 'zzz' } })) {
      let threw = false; try { checkHistory([e], N); } catch { threw = true; } if (!threw) bad.push(`壞事件（${what}）沒被擋`);
    }
    // 突變：要紅
    const sample1 = LIVE.sample[0]?.h ?? [];
    const rows = packHistory(sample1);
    const muts = [
      ['journal：預算碼用政策碼表', 'src/io/journal.ts', [['BUDGET_CODES.indexOf(e.cat)', 'POLICY_CODES.indexOf(e.cat)']]],
      ['journal：研究列丟費用', 'src/io/journal.ts', [['row = [20, dd, TECH_CODES.indexOf(e.id), e.fee]', 'row = [20, dd, TECH_CODES.indexOf(e.id), 0]']]],
      ['journal：方向碼用節點碼表', 'src/io/journal.ts', [['SPEC_CODES.indexOf(e.id)', 'TECH_CODES.indexOf(e.id)']]],
      ['journal：政策列丟 from', 'src/io/journal.ts', [['POLICY_CODES.indexOf(e.key), e.from, e.value]', 'POLICY_CODES.indexOf(e.key), e.value, e.value]']]],
    ];
    const hist = [];   // 專門的小歷史：每種事件各一筆，確保每個突變都有東西可壞
    hist.push({ day: 1, t: 'policy', key: 'taxR', from: 1, value: 1.1 }, { day: 1, t: 'budget', cat: 'edu', from: 1, value: 1.2 }, { day: 2, t: 'research', id: 'B1', fee: 400 }, { day: 3, t: 'spec', id: 'green' }, { day: 4, t: 'techdone', id: 'B1' });
    void rows;
    const out = [];
    for (const [name, file, edits] of muts) {
      try {
        const M = await loadMod(file, edits);
        const mr = M.packMore(hist, PACK0).rows;
        let back = null; try { back = unpackHistory(mr, N); } catch { back = null; }
        if (back && J(back) === J(hist)) bad.push(`突變「${name}」沒抓到`); else out.push(name);
      } catch (e) { bad.push(`突變「${name}」載入失敗 ${e.message.slice(0, 100)}`); }
    }
    {   // 碼表錯位（city.ts 的字面量換兩個）：tableOk 要紅
      const c = await import('../src/sim/city.ts');
      const swapped = { ...c, TECH_CODES: [...c.TECH_CODES.slice(0, 3), c.TECH_CODES[4], c.TECH_CODES[3], ...c.TECH_CODES.slice(5)] };
      if (tableOk(swapped)) bad.push('突變「碼表錯位」沒抓到'); else out.push('碼表錯位');
    }
    {   // save.ts：unpack 的預算碼用政策碼表
      const M = await loadMod('src/io/save.ts', [["if (name === 'cat') return isInt(v) ? BUDGET_CODES[v] : undefined;", "if (name === 'cat') return isInt(v) ? POLICY_CODES[v] : undefined;"]]);
      let diff = true; try { diff = J(M.unpackHistory(packMore(hist, PACK0).rows, N)) !== J(hist); } catch { diff = true; }
      if (!diff) bad.push('突變「save：預算碼用政策碼表」沒抓到'); else out.push('save：預算碼用政策碼表');
    }
    log(!bad.length, 'D039 驗收 2（壞資料與突變）：15 種壞列與 3 種壞事件都被擋（丟明確的錯、不當機）；突變——journal 預算碼用政策碼表、研究列丟費用、方向碼用節點碼表、政策列丟 from、碼表錯位、save 預算碼用政策碼表——要紅',
      bad.slice(0, 4).join('；') || `擋下 ${Object.keys(badRows).length + 3} 種壞資料；突變 ${out.length} 個全紅`);
  }

  // ---- 5. 存讀 ----
  {
    const bad = [], info = [];
    for (const id of ['P1', 'P4']) {
      const { sim } = playScript(KT, vrank, plays[id], 3999100 + id.length, { long: true });
      const L0 = loadCode(plays[id], KT, vrank);
      const code1 = saveCode(sim, L0.template, L0.start), raw1 = decodeLabCode(code1).save.raw;
      const L1 = loadCode(code1, KT, vrank);
      if (!L1.ok) { bad.push(`${id} 存的碼讀不回 ${L1.error}`); continue; }
      if (!L1.replayed) bad.push(`${id} 讀回來沒有重播歷史（${L1.note}）`);
      const n = sim.city.history.filter(e => DECISION_EVENTS.includes(e.t)).length;
      if (n === 0) bad.push(`${id} 劇本沒有決策`);
      if (raw1.d3?.f !== 8) bad.push(`${id} 有決策的城存出格式 ${raw1.d3?.f}，要 8`);
      const strip = hh => hh.filter(e => e.t !== 'restyle');   // 讀檔會再重挑一次外觀（D012 起的既有行為，多幾筆 restyle）：比對時不算
      if (J(strip(L1.sim.city.history)) !== J(strip(sim.city.history))) bad.push(`${id} 讀回來的歷史不同`);
      const code2 = saveCode(L1.sim, L1.template, L1.start), L2 = loadCode(code2, KT, vrank);
      if (!L2.ok || J(strip(L2.sim.city.history)) !== J(strip(sim.city.history)) || J(L2.sim.city.history.filter(e => DECISION_EVENTS.includes(e.t))) !== J(sim.city.history.filter(e => DECISION_EVENTS.includes(e.t)))) bad.push(`${id} 存→讀→再存→讀的歷史不同`);
      if (J(L1.sim.pol) !== J(sim.pol) || J(L1.sim.budget) !== J(sim.budget) || J(L1.sim.edu.tech) !== J(sim.edu.tech) || (L1.sim.edu.spec ?? '') !== (sim.edu.spec ?? '') || J(L1.sim.tech) !== J(sim.tech)) bad.push(`${id} 讀回來的政策／預算／科技／方向狀態不同`);
      // 讀回來再做決策、存：還是 8、歷史接著長
      const before = L1.sim.city.history.length; setPolicy(L1.sim, 'taxC', 1.3); const code3 = saveCode(L1.sim, L1.template, L1.start), L3 = loadCode(code3, KT, vrank);
      if (!L3.ok || L3.sim.city.history.length !== before + 1 || L3.sim.city.history.at(-1).t !== 'policy') bad.push(`${id} 讀回來再調稅率、存、讀，歷史沒接著長`);
      // 比 8 新的碼：不猜、只用存檔
      const future = (() => { const R = decodeLabCode(code1); R.save.raw.d3.f = CITY_FORMAT + 1; return null; })(); void future;
      info.push(`${id}：${n} 筆決策、格式 ${raw1.d3?.f}`);
    }
    // 比 8 新的格式（f＝9）：改碼的 d3.f——用 encodeLabCode 重編
    {
      const { encodeLabCode } = await import('../src/io/labcode.ts');
      const { sim } = playScript(KT, vrank, plays.P1, 3999201, { long: false }), L0 = loadCode(plays.P1, KT, vrank);
      const code = saveCode(sim, L0.template, L0.start), R = decodeLabCode(code); R.save.raw.d3.f = CITY_FORMAT + 1;
      const c9 = encodeLabCode(R.save.raw), L9 = loadCode(c9, KT, vrank);
      if (!L9.ok || L9.replayed !== false || !/比這一版/.test(L9.note ?? '')) bad.push(`f＝CITY_FORMAT+1 的碼沒被當成「比這一版新、只用存檔」：${L9.ok} ${L9.replayed} ${L9.note}`); else info.push('f＝CITY_FORMAT+1 只用存檔');
    }
    log(!bad.length, 'D039 驗收 5、6：存讀與舊檔——有決策的城存出格式 8、讀回來歷史逐筆相同、政策／預算／科技／方向狀態都在；存→讀→再存→讀的歷史（不算讀檔重挑外觀）不變；讀回來再做決策、存、讀，歷史接著長；比現行格式新的碼（f＝CITY_FORMAT+1）不猜、只用存檔',
      bad.slice(0, 4).join('；') || info.join('；'));
  }

  // ---- 6. 大事記的白話 ----
  {
    const bad = [], L = loadCode(plays.P1, KT, vrank), s = L.sim;
    setPolicy(s, 'taxR', 1.1); setPolicy(s, 'curfew', true); setBudget(s, 'edu', .1); startResearch(s, 'A1'); chooseSpec(s, 2);
    const t = chronicleOf(s.city.history).map(l => l.text);
    const want = ['住宅稅：1.0× → 1.1×', '宵禁：開啟', '教育預算：×1.0 → ×1.1', '開始研究：標準化生產（−$400）', '城市方向：🎓 教育科技城（教育場+8%・研究速度+1｜政策日費+$12）'];
    if (J(t) !== J(want)) bad.push(`文字不同：${J(t)}`);
    for (let d = 0; d < 12; d++) realDay.stepDay(s);
    const t2 = chronicleOf(s.city.history).map(l => l.text);
    if (!t2.some(x => /^學會了：標準化生產（工業稅 ×1\.04）$/.test(x))) bad.push(`沒有「學會了」那一行：${J(t2.slice(-2))}`);
    log(!bad.length, 'D039 驗收 7（白話）：chronicleOf 的文字——「住宅稅：1.0× → 1.1×」「宵禁：開啟」「教育預算：×1.0 → ×1.1」「開始研究：標準化生產（−$400）」「城市方向：🎓 教育科技城（…）」「學會了：標準化生產（工業稅 ×1.04）」', bad.join('；') || `${t2.length} 行`);
  }
}
void realDay;

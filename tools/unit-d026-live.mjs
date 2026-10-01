// D026 Node 守衛（二）：實驗線頁面實跑（驗收 3）、接線（驗收 4）、存檔與歷史（驗收 5、6）。由 tools/unit.mjs 呼叫；vm 逐項對拍與突變（驗收 1、2）在 tools/unit-d026.mjs。
//   1. 樣本 src/content/samples/d026-lab.json（tools/d026-lab.mjs 從實驗線 d23c18d 的頁面錄的）的出處與形狀；
//   2. 自造城 15 座（H1–H15）連推五天（H6 六天）＋D022–D025 的 120 座城推一天＋實驗線自己長出來的存檔 24 份連推兩天（後兩批分區清成 0，見 tools/d026-lab.mjs noZone）：本線自己讀檔（旗標、焦土、覆蓋場與實驗線讀進來的逐格相同），
//      每一天把實驗線探針讀到的本線沒有的輸入（政策、科技與專精；夜間治安分數 D029 起本線自己算，只核對）代進災禍段，本線推進一天之後：所有帶旗標的建築（燃燒天數、犯罪與犯罪天數、病與病天數、死亡與死亡天數、廢棄）、焦土、
//      死亡前置的幸福標記、床位（容量、今日治癒、今日滯留）、同時病患數、污染場的雜湊逐格相等，而且「下一個亂數」相等——這一天災禍用掉的亂數次數與順序都一樣，之後的每一天從同一個位置接著走；
//   3. 起步城 8 個種子 × 120 天：實驗線自己的軌跡（每天各種旗標的個數）與本線的軌跡做統計比對（規則 8：整座城的軌跡先求多種子統計一致，第一個分歧日照實記錄）；
//   4. 接線：day.ts 的副本改壞一處（災禍段的呼叫順序、床位、燒毀的收尾、旗標寫進建築、事件進歷史……），這批要紅；
//   5. 存檔與歷史：災禍旗標的七個逐格圖層與 bl 第 6 位寫進存檔、讀回逐格不變；歷史事件（格式 6）與緊湊列來回一致、重播還原同一座城；舊格式（1–5）照讀。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { ensurePol } from '../src/sim/rules/policy.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import * as realDay from '../src/sim/day.ts';
import { fieldsOf } from '../src/sim/rules/fields.ts';
import { encodeLabCode } from '../src/io/labcode.ts';
import { saveCode, loadCode, packHistory, unpackHistory, historyFormat } from '../src/io/save.ts';
import { packMore, PACK0 } from '../src/io/journal.ts';
import { cityStats } from '../src/sim/city.ts';
import { actAt } from '../src/sim/act.ts';
import { commitOp, undoOp } from '../src/sim/edit.ts';
import { syncMismatch, replayDiff, roundTrip, landStale } from './unit-d011-edit.mjs';
import { dayVariant } from './unit-d021.mjs';
import { d026Cities, evolvedIds, oldList, rtList, RT_IDS, noZone, COV_NAMES, EVOLVE_MARKS, EVOLVE_DAYS } from './d026-lab.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export const LIVE = {};   // 除錯用：守衛跑完之後留下樣本與城（tools 的一次性診斷腳本讀它）
export async function d026LiveGuards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D026 實跑守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 逐位元組的 FNV-1a（跟 tools/d026-lab.mjs 頁面裡的 h 同一個）
export const hashBytes = a => { let x = 2166136261; for (let i = 0; i < a.length; i++) { x ^= a[i]; x = Math.imul(x, 16777619); } return x >>> 0; };
// 所有帶旗標的建築（依格子序；跟頁面探針 FL 同一個形狀）：[格, 種類, 燃燒, 犯罪, 犯罪天數, 病, 病天數, 死, 死亡天數, 廢棄]
export function flagRows(s) {
  const o = [];
  for (let i = 0; i < s.w.tiles.length; i++) {
    const b = s.w.tiles[i].bld;
    if (b && !b.ref && (b.fire || b.crime || b.sick || b.death || b.abandoned || b.crimeDays || b.sickDays || b.deathAge)) o.push([i, b.k, b.fire | 0, b.crime ? 1 : 0, b.crimeDays | 0, b.sick ? 1 : 0, b.sickDays | 0, b.death ? 1 : 0, b.deathAge | 0, b.abandoned ? 1 : 0]);
  }
  return o;
}
export const ruinRows = s => { const o = []; for (let i = 0; i < s.w.tiles.length; i++) if (s.w.tiles[i].ruin) o.push(i); return o; };
// 兩份清單第一個不同的地方（說明用）
function firstRowDiff(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (J(a[i]) !== J(b[i])) return `第 ${i} 筆：本線 ${J(a[i])} ≠ 實驗線 ${J(b[i])}（本線 ${a.length} 筆、實驗線 ${b.length} 筆）`;
  return null;
}
const finiteOrNull = v => Number.isFinite(v) ? v : null;

// 一座城連推 days 天，逐天跟實驗線的探針比。mod＝day.ts（真的或改壞的）；回 { d: [不同處], days, first: 第一個不同的日子, stat: 這座城各種事件的合計 }
export function compareCity(mod, code, rec, KT, vrank, { stopAtFirst = true, landDays = Infinity } = {}) {
  const r = decodeLabCode(code), s = mod.simFromSave(r.save, code, KT, vrank), d = [], stat = { ignited: 0, spread: 0, burned: 0, crimes: 0, abandons: 0, sicks: 0, cures: 0, deaths: 0, ended: 0, queued: 0, penalty: 0, night: 0, recovery: 0 };
  const f0 = fieldsOf(s.g), H0 = rec.rows[0].H0;
  // 讀進來的樣子（第 1 天 H0）：旗標、焦土、本線用到的覆蓋場
  { const fl = flagRows(s), rn = ruinRows(s); if (J(fl) !== J(H0.fl)) d.push(`讀檔後的旗標 ${firstRowDiff(fl, H0.fl)}`); if (J(rn) !== J(H0.rn)) d.push(`讀檔後的焦土 ${firstRowDiff(rn, H0.rn)}`);
    for (const n of COV_NAMES) if (hashBytes(f0.COV[n]) !== H0.cov[n]) d.push(`讀檔後覆蓋場 ${n} 雜湊不同`); }
  if (d.length) return { d, days: 0, first: 0, stat };
  for (let day = 1; day <= rec.days; day++) {
    const { H0: a, H2: b } = rec.rows[day - 1], dd = [];
    // 本線沒有的輸入：科技與專精——用實驗線這一天探針讀到的（政策 D032 起是存檔裡的 pol，本線自己讀：不代入，只核對讀進來的跟實驗線這一天的一樣）。夜間治安分數（夜間城市 T487，第 2 天起才有）D029 起本線自己算（前一天結算的 s.night），要跟實驗線這一天開頭讀到的一樣
    const tech = JSON.parse(a.tech);
    if (!Array.isArray(tech) || tech.some(t => typeof t !== 'string')) return { d: [`科技不是字串陣列：${a.tech}`], days: day, first: day, stat };
    s.edu.tech = tech;
    if (J(ensurePol(s.pol)) !== a.pol) dd.push(`政策 本線 ${J(ensurePol(s.pol)).slice(0, 60)} ≠ 實驗線 ${String(a.pol).slice(0, 60)}`);   // 實驗線讀檔之後 pol 已是補齊的物件（29 欄，讀檔後不久 mayorEnsurePolicy470A 就建了）；本線留著讀進來的樣子（沒有＝null，各消費者都容錯、行為一樣），所以兩邊都補齊再比
    if (s.night.ready !== a.night.ready || (a.night.ready && s.night.safety.score !== a.night.score)) dd.push(`夜間治安分數 本線 ${s.night.ready ? s.night.safety.score : '（沒算過）'} ≠ 實驗線 ${a.night.ready ? a.night.score : '（沒算過）'}`);
    if (a.night.ready) stat.night++;
    const capBefore = s.medCap, want = a.fs.ok ? a.fs.cap : null;
    if (finiteOrNull(capBefore ?? Infinity) !== want) dd.push(`昨天的床位容量 本線 ${capBefore} ≠ 實驗線 ${want}（null＝沒有上限）`);
    const rep = mod.stepDay(s, { hazard: { spec: a.spec || null } }), hz = rep.hazard;
    if (rep.day !== a.day) dd.push(`日子 本線 ${rep.day} ≠ 實驗線 ${a.day}`);
    const fl = flagRows(s), rn = ruinRows(s);
    if (J(fl) !== J(b.fl)) dd.push(`旗標 ${firstRowDiff(fl, b.fl)}`);
    if (J(rn) !== J(b.rn)) dd.push(`焦土 ${firstRowDiff(rn, b.rn)}`);
    if (J(hz.penalty) !== J(b.pen)) dd.push(`喪事未安撫的住宅 ${firstRowDiff(hz.penalty, b.pen)}`);
    const med = { cap: finiteOrNull(capBefore ?? Infinity), cured: hz.cured, queued: hz.queued };
    if (J(med) !== J(b.med)) dd.push(`床位 本線 ${J(med)} ≠ 實驗線 ${J(b.med)}`);
    if (hz.sickN !== b.sickN) dd.push(`同時病患 本線 ${hz.sickN} ≠ 實驗線 ${b.sickN}`);
    const ph = hashBytes(s.g.POL); if (ph !== b.pol) dd.push(`污染場雜湊 本線 ${ph} ≠ 實驗線 ${b.pol}`);
    // 地價：實驗線 H0（每天災禍段開頭）的 LANDBASE 是這一天開頭的地價步驟（54996–55001）算完的，用的是昨天的髒框（犯罪 markLandDirty）；本線推進完的 LANDBASE 也是這一天開頭算的
    const lb = hashBytes(s.g.LANDBASE); if (lb !== a.lb) dd.push(`地價基準雜湊 本線 ${lb} ≠ 實驗線 ${a.lb}`);
    // 動態地價（LAND）＝基準＋壅堵那一項；壅堵（道路負載 roadLoad，D027 才搬）在長出來的城裡第 2 天起就有，所以 landDays 讓那幾份只判第 1 天
    if (day <= landDays) { const ld = hashBytes(s.g.LAND); if (ld !== a.ld) dd.push(`動態地價雜湊 本線 ${ld} ≠ 實驗線 ${a.ld}`); }
    const peek = s.rng.R();                                              // 下一個亂數：實驗線也在 H2 多擲了一次
    if (peek !== b.peek) dd.push(`下一個亂數 本線 ${peek} ≠ 實驗線 ${b.peek}（這一天災禍用的亂數次數或順序不同）`);
    for (const k of ['ignited', 'spread', 'crimes', 'abandons', 'sicks', 'cures', 'deaths', 'ended', 'penalty']) stat[k] += hz[k].length;
    stat.burned += hz.burned.length; stat.queued += hz.queued;
    if (dd.length) { d.push(`第 ${day} 天：${dd.slice(0, 3).join('；')}`); if (stopAtFirst) return { d, days: day, first: day, stat }; }
  }
  return { d, days: rec.days, first: d.length ? 1 : 0, stat };
}

// 實驗線 save() 的七個旗標層（66716–66727 @d23c18d）逐格另抄一份（不經本線的 saveCode）：拿來核本線寫出去的
export function labLayersOf(s) {
  const o = { rn: '', cm: '', sk: '', dt: '', skd: '', dtd: '', cmd: '', ab: '' };
  for (const t of s.w.tiles) {
    o.rn += t.ruin ? 1 : 0; o.cm += t.bld && t.bld.crime ? 1 : 0; o.sk += t.bld && t.bld.sick ? 1 : 0; o.dt += t.bld && t.bld.death ? 1 : 0;
    o.skd += t.bld && t.bld.sick ? '' + Math.min(9, t.bld.sickDays || 0) : '0'; o.dtd += t.bld && t.bld.death ? '' + Math.min(9, t.bld.deathAge || 0) : '0';
    o.cmd += String.fromCharCode(48 + (t.bld && t.bld.crime ? Math.min(15, t.bld.crimeDays || 0) : 0));
    o.ab += t.bld && !t.bld.ref && t.bld.abandoned ? 1 : 0;
  }
  return o;
}
// 存出去的碼：七個層＋ab 逐格＝上面另抄的；bl 每筆第 6 位的燃燒天數（體育場 k9 那一位是 sz）
function layerBad(s, L) {
  const raw = decodeLabCode(saveCode(s, L.template, L.start)).save.raw, exp = labLayersOf(s), bad = [];
  for (const k of Object.keys(exp)) if (raw[k] !== exp[k]) { const i = [...exp[k]].findIndex((ch, q) => ch !== raw[k]?.[q]); bad.push(`${k} 第 ${i} 格 存檔「${raw[k]?.[i]}」≠ 實驗線寫法「${exp[k][i]}」`); }
  for (const r of raw.bl) { const b = s.w.tiles[r[0]].bld; if (b && b.k !== 9 && (r[5] ?? 0) !== +(b.fire || 0)) bad.push(`bl 第 ${r[0]} 格的燃燒天數 ${r[5]} ≠ ${b.fire}`); }
  return bad;
}
// 改存檔碼裡的 d3（歷史）再讀：拿來試「不認得」「壞資料」
function mutateD3(code, fn) { const S = decodeLabCode(code).save, raw = JSON.parse(J(S.raw)); fn(raw.d3); delete raw.z; return encodeLabCode(raw, { deflate: true }); }

async function guards(log) {
  const lab = JSON.parse(read('src/content/samples/d026-lab.json')), cities = d026Cities(), olds = oldList();
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  Object.assign(LIVE, { lab, cities, KT, vrank });

  // ---- 1. 樣本的出處與形狀 ----
  {
    const bad = [];
    if (lab.source?.commit !== PINNED || lab.config !== 'fallback') bad.push(`出處不是 ${PINNED.slice(0, 7)} 的回退設定：${J(lab.source?.commit)} ${lab.config}`);
    if (J(lab.order) !== J(cities.map(c => c.id))) bad.push('樣本裡城的順序 ≠ tools/d026-cities.mjs 現在的順序（重跑 tools/d026-lab.mjs）');
    for (const c of cities) { const L = lab.crafted[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else { if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d026-lab.mjs）`); if (L.rows.length !== c.days) bad.push(`${c.id}：記了 ${L.rows.length} 天，要 ${c.days} 天`); } }
    for (const seed of STARTER_SEEDS) { const e = lab.evolve?.[seed]; if (!e || e.series?.length !== EVOLVE_DAYS || EVOLVE_MARKS.some(d => typeof e.codes?.[d] !== 'string')) bad.push(`起步城 ${seed} 的 ${EVOLVE_DAYS} 天軌跡或存檔不齊`); }
    for (const id of evolvedIds()) { const [seed, d] = id.split('@'), L = lab.evolved?.[id]; if (!L) bad.push(`${id}：沒有記錄`); else if (L.codeHash !== fnv1a(noZone(lab.evolve[seed].codes[d]))) bad.push(`${id}：存檔碼的雜湊不對`); else if (L.rows.length !== 2) bad.push(`${id}：記了 ${L.rows.length} 天，要 2 天`); }
    if (J(lab.oldOrder) !== J(olds.map(c => c.id))) bad.push('樣本裡 D022–D025 城的順序 ≠ tools/d025-lab.mjs 現在的順序（重跑 tools/d026-lab.mjs）');
    for (const c of olds) { const L = lab.old?.[c.id]; if (!L) bad.push(`${c.id}：沒有記錄`); else if (L.codeHash !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d026-lab.mjs）`); else if (L.rows.length !== 1) bad.push(`${c.id}：記了 ${L.rows.length} 天，要 1 天`); }
    log(!bad.length, `D026 實跑樣本：實驗線 ${PINNED.slice(0, 7)}（${lab.source?.version}）回退設定；自造城 ${cities.length} 座（碼雜湊＝本線現在產生的）連推五天、D022–D025 的城 ${olds.length} 座推一天、起步城 8 個種子 × ${EVOLVE_DAYS} 天軌跡、長出來的存檔 ${evolvedIds().length} 份連推兩天`,
      bad.slice(0, 4).join('；') || `${Object.keys(lab.crafted).length} 座、old ${Object.keys(lab.old).length}、evolve ${Object.keys(lab.evolve).length}、evolved ${Object.keys(lab.evolved).length}`);
    if (bad.length) return;
  }

  // ---- 2. 逐天對拍 ----
  const runAll = (mod, opts) => {
    const rows = [];
    for (const c of cities) rows.push({ id: c.id, ...compareCity(mod, c.code, lab.crafted[c.id], KT, vrank, opts) });
    for (const c of olds) rows.push({ id: c.id, ...compareCity(mod, c.code, lab.old[c.id], KT, vrank, opts) });
    for (const id of evolvedIds()) { const [seed, d] = id.split('@'); rows.push({ id, ...compareCity(mod, noZone(lab.evolve[seed].codes[d]), lab.evolved[id], KT, vrank, { ...opts, landDays: 1 }) }); }
    return rows;
  };
  const base = runAll(realDay);
  LIVE.base = base;
  {
    const bad = base.filter(x => x.d.length).map(x => `${x.id} ${x.d[0]}`);
    const sum = k => base.reduce((a, x) => a + x.stat[k], 0);
    const NEED = { ignited: 40, spread: 20, burned: 60, crimes: 60, abandons: 3, sicks: 40, cures: 20, deaths: 3, ended: 5, queued: 5, penalty: 100, night: 50 };
    const lack = Object.entries(NEED).filter(([k, v]) => sum(k) < v).map(([k, v]) => `${k} ${sum(k)}<${v}`);
    if (lack.length) bad.push(`覆蓋不夠：${lack.join('、')}`);
    log(!bad.length, `D026 驗收 3：實驗線頁面實跑——自造城 ${cities.length} 座連推五天（H6 六天）＋長出來的存檔 ${evolvedIds().length} 份連推兩天：讀檔（旗標、焦土、覆蓋場）與每一天的旗標、焦土、喪事未安撫、床位、同時病患、污染場、下一個亂數逐項相等`,
      bad.slice(0, 4).join('｜') || `${base.length} 份全等，共 ${base.reduce((a, x) => a + x.days, 0)} 個城日；` + Object.keys(NEED).map(k => `${k} ${sum(k)}`).join('、'));
  }

  // ---- 2b. 實驗線讀本線存出來的碼（驗收 5）：本線讀進自造城、一天不推就存檔；實驗線用它自己的 GV.importCode 讀那張碼、再推一天 ----
  {
    const bad = [], rts = rtList();
    if (rts.length !== RT_IDS.length) bad.push(`rt 名單 ${rts.length} 座 ≠ ${RT_IDS.length}`);
    let days = 0, flags = 0;
    for (const c of rts) {
      const L = lab.rt?.[c.id], orig = lab.crafted?.[c.id];
      if (!L || !orig) { bad.push(`${c.id}：沒有記錄`); continue; }
      if (L.codeHash !== fnv1a(c.code)) { bad.push(`${c.id}：本線存出來的碼跟錄樣本時不同（存檔寫法變了；重跑 tools/d026-lab.mjs）`); continue; }
      // 實驗線讀本線存的碼看到的（旗標、焦土、覆蓋場）＝實驗線讀原本那張自造碼看到的
      const h = L.rows[0].H0, o = orig.rows[0].H0;
      if (J(h.fl) !== J(o.fl)) bad.push(`${c.id}：實驗線讀本線存的碼，旗標 ${firstRowDiff(h.fl, o.fl)}`);
      if (J(h.rn) !== J(o.rn)) bad.push(`${c.id}：實驗線讀本線存的碼，焦土 ${firstRowDiff(h.rn, o.rn)}`);
      for (const n of COV_NAMES) if (h.cov[n] !== o.cov[n]) bad.push(`${c.id}：實驗線讀本線存的碼，覆蓋場 ${n} 雜湊不同`);
      flags += h.fl.length;
      // 本線讀同一張碼、推一天＝實驗線讀它推一天
      const r = compareCity(realDay, c.code, L, KT, vrank);
      if (r.d.length) bad.push(`${c.id} ${r.d[0]}`); days += r.days;
    }
    log(!bad.length, `D026 驗收 5（實驗線讀本線存的碼）：本線讀自造城 ${RT_IDS.join('、')}、一天不推就存檔；實驗線用它自己的 GV.importCode 讀本線存的碼——旗標、焦土、覆蓋場＝它讀原本那張自造碼看到的，推一天之後跟本線逐項相等；本線存出來的碼＝錄樣本時的碼（雜湊）`,
      bad.slice(0, 4).join('｜') || `${rts.length} 座、${flags} 筆旗標建築、${days} 個城日`);
  }

  // ---- 3. 起步城 8 個種子 × 120 天：整城軌跡（規則 8：整座城先求多種子統計一致；逐日相等到第幾天照實記，不判）----
  {
    const startCode = read('src/content/samples/starter.code.txt').trim(), d25 = JSON.parse(read('src/content/samples/d025-lab.json'));   // d025-lab.json：實驗線每天的人口（探針 A），記「人口第幾天起不同」
    const mean = a => a.reduce((s, v) => s + v, 0) / a.length, sd = a => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
    const per = [];
    for (const seed of STARTER_SEEDS) {
      const code = codeWithSeed(startCode, seed), s = realDay.simFromSave(decodeLabCode(code).save, code, KT, vrank), L = lab.evolve[seed].series, P = d25.multi.starter[seed], series = [];
      let fd = 0, pd = 0;
      for (let d = 0; d < EVOLVE_DAYS; d++) {
        const rep = realDay.stepDay(s), fl = flagRows(s), rn = ruinRows(s);
        const c = { fire: fl.filter(r => r[2] && r[1] <= 3).length, crime: fl.filter(r => r[3]).length, sick: fl.filter(r => r[5]).length, death: fl.filter(r => r[7]).length, ab: fl.filter(r => r[9]).length, ruin: rn.length, sickN: rep.hazard.sickN, h: fnv1a(J([fl, rn])) };
        series.push(c);
        if (!fd && c.h !== L[d].h) fd = d + 1;                            // 旗標與焦土第一個不同的日子
        if (!pd && rep.pop !== P[d].A.pop) pd = d + 1;                    // 人口第一個不同的日子（D025 樣本）
      }
      per.push({ seed, series, L, fd, pd });
    }
    LIVE.traj = per;
    const rows = ['fire', 'sick', 'death', 'ruin'].map(k => {
      const pm = per.map(p => mean(p.series.map(x => x[k]))), lm = per.map(p => mean(p.L.map(x => x[k]))), diff = Math.abs(mean(pm) - mean(lm)), se = Math.sqrt((sd(pm) ** 2 + sd(lm) ** 2) / per.length);
      return { k, pm: mean(pm), lm: mean(lm), diff, se, ok: diff <= 3 * se + .05 };
    });
    const NEED = { fire: .2, sick: .3, death: .2, ruin: 3 }, thin = rows.filter(r => r.pm < NEED[r.k]).map(r => `${r.k} ${r.pm.toFixed(2)}<${NEED[r.k]}`);
    const bad = rows.filter(r => !r.ok).map(r => `${r.k}：本線日均 ${r.pm.toFixed(3)} ≠ 實驗線 ${r.lm.toFixed(3)}（差 ${r.diff.toFixed(3)} > 3 倍標準誤 ${(3 * r.se).toFixed(3)}）`);
    if (thin.length) bad.push(`本線的災禍太少（不是有意義的比對）：${thin.join('、')}`);
    const crimeAny = per.some(p => p.series.some(x => x.crime || x.ab) || p.L.some(x => x.crime || x.ab));
    log(!bad.length, `D026 驗收 9：起步城 8 個種子 × ${EVOLVE_DAYS} 天整城軌跡——起火、生病、死亡、焦土的「每天平均個數」跟實驗線同分布（8 個種子的平均差在 3 倍標準誤內）；旗標與焦土逐日相等到第幾天、人口第幾天起不同照實記（起步城有警察局，兩邊都沒有犯罪）`,
      bad.slice(0, 4).join('｜') || rows.map(r => `${r.k} 本線 ${r.pm.toFixed(3)}／實驗線 ${r.lm.toFixed(3)}`).join('、') + `；旗標第一個不同的日子 ${per.map(p => `${p.seed}：${p.fd || '沒有'}`).join('、')}；人口第一個不同的日子 ${per.map(p => `${p.seed}：${p.pd || '沒有'}`).join('、')}；犯罪${crimeAny ? '有' : '兩邊都沒有'}`);
  }

  // ---- 4. 接線：day.ts 的副本改壞一處，這批要紅 ----
  {
    const SUB = ['H1', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8', 'H9', 'H12', 'H16', 'H17'], codeOf = id => cities.find(c => c.id === id).code;
    const oldCode = id => olds.find(c => c.id === id).code, POLOLD = ['ai120'];   // ai120：AI 城，開著公園夜間開放（住宅幸福 +.02，升級的門檻 b.h>.45 跟著變）
    const dayBad = mod => {
      for (const id of SUB) { const r = compareCity(mod, codeOf(id), lab.crafted[id], KT, vrank); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; }
      for (const id of POLOLD) { const r = compareCity(mod, oldCode(id), lab.old[id], KT, vrank); if (r.d.length) return `${id} ${r.d[0].slice(0, 80)}`; }
      return null;
    };
    // 城市模型跟世界同步、歷史記得全、地價待重算標得夠（compareCity 看不到的）：H1（燒毀）、H3（犯罪、廢棄）、H4（生病、死亡）、H9（燒毀、焦土）連推三天
    const syncBad = mod => {
      for (const id of ['H1', 'H3', 'H4', 'H9']) {
        const r = decodeLabCode(codeOf(id)), sm = mod.simFromSave(r.save, codeOf(id), KT, vrank), tot = { fire: 0, burn: 0, crime: 0, abandon: 0, sick: 0, death: 0 };
        for (let d = 1; d <= 3; d++) {
          const rep = mod.stepDay(sm), hz = rep.hazard;
          tot.fire += hz.ignited.length + hz.spread.length; tot.burn += hz.burned.length; tot.crime += hz.crimes.length; tot.abandon += hz.abandons.length; tot.sick += hz.sicks.length; tot.death += hz.deaths.length;
          const m = syncMismatch(sm); if (m) return `${id} 第 ${d} 天不同步：${m}`;
          const ls = landStale(sm); if (ls >= 0) return `${id} 第 ${d} 天地價基準第 ${ls} 格沒標待重算`;
        }
        for (const [t, n] of Object.entries(tot)) { const got = sm.city.history.filter(e => e.t === t).length; if (got !== n) return `${id} 歷史的 ${t} 事件 ${got} 筆 ≠ 當天回報的 ${n} 件`; }
      }
      return null;
    };
    // 旗標、焦土、床位容量進不進雜湊：每一種各改一下，雜湊要變
    const hashBad = mod => {
      const c = codeOf('H4'), r = decodeLabCode(c), fresh = () => mod.simFromSave(r.save, c, KT, vrank), base = mod.simHash(fresh());
      const house = fresh(), pick = k => { for (const i of house.root.keys()) { const b = house.w.tiles[i].bld; if (b && b.k === k && !b.sick && !b.death && !b.crime && !b.fire && !b.abandoned) return i; } return -1; }, hi = pick(1), ci = pick(2) >= 0 ? pick(2) : hi;
      const tests = { 燃燒: q => { q.w.tiles[hi].bld.fire = 2; }, 犯罪: q => { q.w.tiles[ci].bld.crime = 1; }, 犯罪天數: q => { q.w.tiles[ci].bld.crimeDays = 5; }, 生病: q => { q.w.tiles[hi].bld.sick = 1; }, 病天數: q => { q.w.tiles[hi].bld.sickDays = 2; },
        死亡: q => { q.w.tiles[hi].bld.death = 1; }, 死亡天數: q => { q.w.tiles[hi].bld.deathAge = 3; }, 廢棄: q => { q.w.tiles[hi].bld.abandoned = 1; }, 焦土: q => { q.w.tiles[q.w.N * 5 + 5].ruin = 1; }, 床位容量: q => { q.medCap = 7; } };
      const blind = Object.entries(tests).filter(([, f]) => { const q = fresh(); f(q); return mod.simHash(q) === base; }).map(([k]) => k);
      return blind.length ? `雜湊不看：${blind.join('、')}` : null;
    };
    // 推進一天之後跟真的那份不同（喪事未安撫餵給幸福這種實驗線探針量不到的接線）
    const real1 = id => { const q = realDay.simFromSave(decodeLabCode(codeOf(id)).save, codeOf(id), KT, vrank); realDay.stepDay(q); return realDay.simHash(q); };
    const realH = { H5: real1('H5'), H4: real1('H4') };
    const differs = mod => { for (const id of ['H5', 'H4']) { const q = mod.simFromSave(decodeLabCode(codeOf(id)).save, codeOf(id), KT, vrank); mod.stepDay(q); if (mod.simHash(q) !== realH[id]) return `${id} 推進一天後跟真的不同`; } return null; };
    const V0 = await dayVariant([]), MUT = [
      ['死亡前置不跑（用空的）', [['const dp = deathPre(w, f, tickBld);', 'const dp = { penalty: new Uint8Array(w.N * w.N), ended: [], cemCap: 0, soothed: 0 };']]],
      ['喪事未安撫不餵給住宅幸福', [['deathPenalty: dp.penalty[i] === 1,', 'deathPenalty: false,']]],
      ['災禍五段整段不跑', [['const hz = hazardDay(s, tickBld, f, dp, hzx);', 'const hz = { ignited: [], spread: [], burned: [], crimes: [], abandons: [], sicks: [], cures: [], deaths: [], ended: [], cured: 0, queued: 0, sickN: 0, penalty: [], cemCap: 0, soothed: 0, alerts: [], events: [], burnedAge: [] };']]],
      ['政策、夜間治安、專精的輸入不傳進災禍段', [['hazardDay(s, tickBld, f, dp, hzx)', 'hazardDay(s, tickBld, f, dp)']]],
      ['床位容量不留到明天', [['s.medCap = medCapOf(', 's.medCap = null; void medCapOf(']]],
      ['政策不傳進住宅幸福', [['pol, rankIdx: s.rankIdx,', 'pol: null, rankIdx: s.rankIdx,']]],
      ['疾病段不讀昨天的床位容量', [['diseaseStep(w, f, s.rng, tickBld, s.medCap ?? Infinity)', 'diseaseStep(w, f, s.rng, tickBld, Infinity)']]],
      ['災禍不同步城市模型與歷史', [['syncHazards(s, hz);', '']]],
      ['燒毀不記焦土圖層', [['c.ruin[b.i] = 1;', '']]],
      ['廢棄不記在城市模型', [['if (cb) cb.abandoned = true;', '']]],
      ['災禍事件不進歷史', [['c.history.push(...hz.events);', '']]],
      ['犯罪不標地價髒框', [['markLandDirty(s, c.x, c.z, 4); ', '']]],
      ['燒毀不標地價待重算（含工業污染源那一圈）', [['markStale(s, bx, bz, 4); if (b.k === 3) markStale(s, bx, bz, POL_SRC[3].r);', '']]],
      ['讀檔：犯罪不分種類', [['if (cm && b.k <= 3 && +cm[i]) b.crime = 1;', 'if (cm && +cm[i]) b.crime = 1;']]],
      ['讀檔：生病不限住宅', [['if (sk && b.k === 1 && +sk[i]) b.sick = 1;', 'if (sk && +sk[i]) b.sick = 1;']]],
      ['讀檔：死亡不限住宅', [['if (dt && b.k === 1 && +dt[i]) b.death = 1;', 'if (dt && +dt[i]) b.death = 1;']]],
      ['讀檔：沒生病的格也還原病天數', [['if (b && b.k === 1 && b.sick) { const v = +skd[i];', 'if (b && b.k === 1) { const v = +skd[i];']]],
      ['讀檔：沒犯罪的格也還原犯罪天數', [['if (b && b.k <= 3 && b.crime) { const v = cmd.charCodeAt(i) - 48;', 'if (b && b.k <= 3) { const v = cmd.charCodeAt(i) - 48;']]],
      ['讀檔：沒死亡的格也還原死亡天數', [['if (b && b.k === 1 && b.death) { const v = +dtd[i];', 'if (b && b.k === 1) { const v = +dtd[i];']]],
      ['讀檔：不讀焦土', [['if (city.ruin[i]) tiles[i].ruin = 1;', '']]],
      ['讀檔：非住宅的燃燒天數丟掉', [[': { k, lv, v, age, pw: true, h: .6, fire: r[5] || 0 };', ': { k, lv, v, age, pw: true, h: .6, fire: 0 };']]],
      ['雜湊不看旗標', [['+(b.fire || 0), +(b.crime || 0), b.crimeDays ?? -1, +(b.sick || 0), b.sickDays ?? -1, +(b.death || 0), b.deathAge ?? -1, +(b.abandoned || 0)]', '0]']]],
      ['雜湊不看焦土', [['const ruin = s.w.tiles.flatMap((t, i) => t.ruin ? [i] : []);', 'const ruin: number[] = [];']]],
      ['雜湊不看床位容量', [['econ, ruin, s.medCap,\n', 'econ, ruin,\n']]],
    ];
    const bad = [], out = [], base0 = [dayBad(V0), syncBad(V0), hashBad(V0), differs(V0)].filter(Boolean);
    if (base0.length) bad.push(`沒改的副本就有不對：${base0.join('｜')}`);
    for (const [name, edits] of MUT) {
      let V; try { V = await dayVariant(edits); } catch (e) { bad.push(`「${name}」載入失敗 ${e.message}`); continue; }
      const why = [dayBad(V) && '對拍', syncBad(V) && '同步', hashBad(V) && '雜湊', differs(V) && '跟真的不同'].filter(Boolean);
      out.push(`${name}：${why.join('＋') || '沒抓到'}`); if (!why.length) bad.push(`「${name}」沒抓到`);
    }
    log(!bad.length, `D026 驗收 4：接線——day.ts 的副本改壞一處（${MUT.length} 個：死亡前置、喪事未安撫餵幸福、災禍段、政策與夜間治安與專精的輸入、床位跨日、疾病讀床位、城市與歷史同步、焦土、廢棄、事件進歷史、犯罪標髒框、燒毀標待重算、讀檔各旗標的種類與天數規則、焦土與非住宅燃燒的讀檔、雜湊看旗標與焦土與床位），這批要紅；沒改的先核過全等`,
      bad.slice(0, 5).join('；') || out.join('；'));
  }

  // ---- 5. 存檔與歷史（驗收 5、6、7）----
  {
    const bad = [], seen = { types: new Set(), layers: 0, trips: 0, days: 0, corrupt: 0, act: 0, doze: 0 }, HZ = ['H1', 'H3', 'H4', 'H5', 'H9', 'H12', 'H13'], N = 72;
    const codes = {};
    for (const id of HZ) {
      const c = cities.find(x => x.id === id), L = loadCode(c.code, KT, vrank);
      if (!L.ok) { bad.push(`${id}：讀不進 ${L.error}`); continue; }
      const sm = L.sim;
      for (const w of layerBad(sm, L)) bad.push(`${id} 第 0 天（剛讀進來）${w}`); seen.layers++;
      for (let d = 1; d <= 3; d++) {
        realDay.stepDay(sm); seen.days++;
        const m = syncMismatch(sm); if (m) bad.push(`${id} 第 ${d} 天 城市與世界不同步：${m}`);
        const r = replayDiff(sm, L.start, KT); if (r) bad.push(`${id} 第 ${d} 天 重播≠模擬：${r}`);
        const ls = landStale(sm); if (ls >= 0) bad.push(`${id} 第 ${d} 天 地價基準第 ${ls} 格不是現算的值（該標待重算沒標）`);
        for (const w of layerBad(sm, L)) bad.push(`${id} 第 ${d} 天 ${w}`); seen.layers++;
        if (d === 1 || d === 3) { const t = roundTrip(sm, L, KT, vrank); if (t.bad) bad.push(`${id} 第 ${d} 天存讀檔往返：${t.bad}`); else seen.trips++; }
      }
      // 歷史：緊湊列來回、接續編碼、格式
      const h = sm.city.history, rows = packHistory(h);
      for (const e of h) seen.types.add(e.t);
      if (J(unpackHistory(rows, N)) !== J(h)) bad.push(`${id} 歷史的緊湊列來回不一致`);
      { const k = h.length >> 1, a = packMore(h.slice(0, k), PACK0), b2 = packMore(h, a.st); if (J([...a.rows, ...b2.rows]) !== J(rows)) bad.push(`${id} 歷史分兩段編（日誌接續）≠ 一次編`); }
      const hz = h.some(e => ['fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act'].includes(e.t)), code = saveCode(sm, L.template, L.start), d3 = decodeLabCode(code).save.raw.d3;
      if (hz ? historyFormat(h) !== 6 || d3.f !== 6 : historyFormat(h) > 5 || d3.f > 5) bad.push(`${id} 城市格式 ${d3.f}（有災禍事件要 6、沒有不能寫 6）`);
      codes[id] = { code, L };
    }
    // 存檔壞資料、不認得的格式：只用存檔、講原因，不猜
    {
      const tryMut = (id, fn, want, what) => {
        const q = loadCode(mutateD3(codes[id].code, fn), KT, vrank); seen.corrupt++;
        if (!q.ok || q.replayed || !want.test(q.note)) bad.push(`${what}：要「只用存檔」且原因對（${want}），讀回 ok ${q.ok}、replayed ${q.replayed}、note「${q.note}」`);
      };
      if (codes.H1) tryMut('H1', d3 => { d3.f = 8; }, /比這一版（7）新/, '比 7 新的城市格式');
      for (const [id, tcode, name] of [['H1', 10, '起火'], ['H1', 11, '燒毀'], ['H3', 12, '犯罪'], ['H3', 13, '廢棄'], ['H4', 14, '生病'], ['H13', 15, '死亡']]) {
        if (!codes[id]) continue;
        const has = decodeLabCode(codes[id].code).save.raw.d3.r.some(r => r[0] === tcode);
        if (!has) { bad.push(`${id} 的歷史沒有${name}事件（壞資料測試沒有對象）`); continue; }
        tryMut(id, d3 => { const r = d3.r.find(q => q[0] === tcode); r[2] = 999; }, /座標/, `${name}事件的座標出界`);
      }
      if (codes.H1) tryMut('H1', d3 => { const r = d3.r.find(q => q[0] === 11); r[5] = 999999; }, /只用存檔/, '燒毀事件的建築編號不存在');
    }
    // 沒有災禍的城：存檔的七個層跟範本一樣（全 0）、格式不寫 6、讀得回來
    {
      const nc = loadCode(read('src/content/samples/newcity.code.txt').trim(), KT, vrank), sn = nc.sim;
      for (let d = 0; d < 3; d++) realDay.stepDay(sn);
      const code = saveCode(sn, nc.template, nc.start), raw = decodeLabCode(code).save.raw, same = ['rn', 'cm', 'sk', 'dt', 'skd', 'dtd', 'cmd', 'ab'].filter(k => raw[k] !== nc.template[k]), q = loadCode(code, KT, vrank);
      if (same.length || raw.d3.f > 5 || !q.ok || !q.replayed) bad.push(`沒有災禍的城：層跟範本不同 ${same.join('、')}、格式 ${raw.d3.f}、replayed ${q.replayed}`);
    }
    // 玩家的處置：條件、扣款、旗標、事件、地價、存讀檔
    const actCase = (id, what, cost, pick) => {
      const c = cities.find(x => x.id === id), L = loadCode(c.code, KT, vrank), sm = L.sim;
      realDay.stepDay(sm);
      const row = flagRows(sm).find(pick);
      if (!row) { bad.push(`${id} 推進一天後沒有可以${what}的對象`); return; }
      const i = row[0], x = i % N, z = (i / N) | 0, n0 = sm.city.history.length;
      sm.money = 100; const res = actAt(sm, x, z, what), b = sm.w.tiles[i].bld, e = sm.city.history.at(-1);
      const cleared = what === 'fire' ? !b.fire : what === 'crime' ? !b.crime && !b.crimeDays : !b.sick;
      if (!res.ok || sm.money !== 100 - cost || !cleared || sm.city.history.length !== n0 + 1 || e.t !== 'act' || e.what !== what || e.cost !== cost || e.x !== x || e.z !== z || e.day !== sm.day) bad.push(`${id} ${what}：ok ${res.ok}、錢 ${sm.money}、旗標${cleared ? '清了' : '沒清'}、事件 ${J(e)}`);
      else seen.act++;
      if (what === 'crime' && !(sm.landDirty && sm.landBox)) bad.push(`${id} 處理犯罪沒標地價髒框`);
      const ls = landStale(sm); if (ls >= 0) bad.push(`${id} ${what} 之後地價基準第 ${ls} 格沒標待重算`);
      const r = replayDiff(sm, L.start, KT); if (r) bad.push(`${id} ${what} 之後重播≠模擬：${r}`);
      const t = roundTrip(sm, L, KT, vrank); if (t.bad) bad.push(`${id} ${what} 之後存讀檔往返：${t.bad}`); else if (t.q.sim.city.history.filter(q => q.t === 'act').length !== 1) bad.push(`${id} ${what}：讀回的歷史沒有那筆 act`);
      // 錢不夠：什麼都不動；沒有東西可處置：什麼都不發生
      if (cost > 0) {
        const c2 = cities.find(q => q.id === id), L2 = loadCode(c2.code, KT, vrank), s2 = L2.sim; realDay.stepDay(s2);
        s2.money = cost - 1; const n1 = s2.city.history.length, r2 = actAt(s2, x, z, what);
        if (r2.ok || s2.money !== cost - 1 || s2.city.history.length !== n1 || !r2.reason?.startsWith('資金不足！')) bad.push(`${id} ${what} 錢不夠：ok ${r2.ok}、錢 ${s2.money}、原因「${r2.reason}」`);
      }
    };
    actCase('H1', 'fire', 30, r => r[2] && r[1] <= 3);
    actCase('H3', 'crime', 0, r => r[3]);
    actCase('H4', 'sick', 50, r => r[5] && !r[7]);
    { const c = cities.find(x => x.id === 'H4'), sm = loadCode(c.code, KT, vrank).sim, i = [...sm.root.keys()].find(k => { const b = sm.w.tiles[k].bld; return b && b.k === 1 && !b.sick; }), n0 = sm.city.history.length, m0 = sm.money, r = actAt(sm, i % N, (i / N) | 0, 'sick');
      if (r.ok || r.reason || sm.money !== m0 || sm.city.history.length !== n0) bad.push('沒有病的住宅按治療：什麼都不該發生'); }
    // 清焦土（拆除）：記成 doze ruin、焦土少一格、復原回來；城市與世界同步、重播對得上、存讀檔往返
    {
      const c = cities.find(x => x.id === 'H9'), L = loadCode(c.code, KT, vrank), sm = L.sim; realDay.stepDay(sm);
      const i = ruinRows(sm)[0], x = i % N, z = (i / N) | 0, m0 = sm.money, pvW = sm.w.tiles[i].ruin;
      const res = commitOp(sm, { k: 'tap', tool: 'doze', x0: x, z0: z, x1: x, z1: z }, 0), ev = res.events?.[0];
      if (!res.ok || ev?.t !== 'doze' || ev.layer !== 'ruin' || sm.w.tiles[i].ruin || sm.city.ruin[i] || !(res.spent >= 0) || m0 - sm.money !== res.spent) bad.push(`清焦土：ok ${res.ok}、事件 ${J(ev)}、焦土 ${sm.w.tiles[i].ruin}／${sm.city.ruin[i]}`);
      else seen.doze++;
      const m = syncMismatch(sm), r = replayDiff(sm, L.start, KT), t = roundTrip(sm, L, KT, vrank);
      if (m || r || t.bad) bad.push(`清焦土之後 同步 ${m}／重播 ${r}／往返 ${t.bad}`);
      const u = undoOp(sm); if (!u.ok || !sm.w.tiles[i].ruin || !sm.city.ruin[i] || sm.money !== m0 || pvW !== 1) bad.push(`清焦土復原：ok ${u.ok}、焦土 ${sm.w.tiles[i].ruin}／${sm.city.ruin[i]}、錢 ${sm.money}／${m0}`);
      const m2 = syncMismatch(sm), r2 = replayDiff(sm, L.start, KT); if (m2 || r2) bad.push(`復原之後 同步 ${m2}／重播 ${r2}`);
    }
    // 決定性：同一座城讀兩次、各推五天，每天雜湊相同
    for (const id of ['H1', 'H4']) {
      const a = loadCode(cities.find(x => x.id === id).code, KT, vrank).sim, b = loadCode(cities.find(x => x.id === id).code, KT, vrank).sim;
      for (let d = 1; d <= 5; d++) { realDay.stepDay(a); realDay.stepDay(b); if (realDay.simHash(a) !== realDay.simHash(b)) { bad.push(`${id} 同一張碼讀兩次、第 ${d} 天雜湊不同`); break; } }
    }
    const NEEDT = ['fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act'], lackT = NEEDT.filter(t => t === 'act' ? !seen.act : !seen.types.has(t));
    if (lackT.length) bad.push(`覆蓋不夠：沒出現過的事件 ${lackT.join('、')}`);
    log(!bad.length, `D026 驗收 5、6、7：存檔與歷史——災禍旗標七層與 ab、bl 第 6 位逐格＝實驗線 save() 寫法另抄的一份；連推三天每天：城市與世界同步、重播＝模擬、地價待重算標得夠；存讀檔往返（含 restyle 的處理）逐項相同；歷史緊湊列來回、日誌接續編碼、城市格式（有災禍事件才 6）；壞資料與比 7 新的只用存檔；處置（滅火 $30、處理犯罪、治療 $50）扣款、旗標、act 事件、地價髒框、錢不夠不動；清焦土記 doze ruin、復原、往返；決定性`,
      bad.slice(0, 5).join('；') || `${HZ.length} 座城 × 3 天（${seen.days} 個城日）、層核對 ${seen.layers} 次、往返 ${seen.trips} 次、壞資料 ${seen.corrupt} 種、處置 ${seen.act} 種、清焦土 ${seen.doze} 次；事件種類 ${[...seen.types].filter(t => NEEDT.includes(t)).join('、')}`);
  }
}

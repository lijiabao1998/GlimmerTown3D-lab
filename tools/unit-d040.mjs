// D040 Node 守衛：蓋油井與礦場、資源圖視圖、井枯竭事件（城市格式 9）。由 tools/unit.mjs 呼叫。建造規則逐筆對拍實驗線在 tools/unit-d040-build.mjs（黃金樣本 d040-build.json）；
// 實驗線頁面實跑（玩家蓋的井存成碼、實驗線讀進去推進，耗損與耗盡的日子逐欄全等）在 tools/unit-d036-live.mjs 的 rt（B@13、B@79、B@81）。這裡驗：
//   1. 工具：CIVIC_TOOLS 共 16 顆、最後兩顆是油井（$1,300）與礦場（$1,500）、都是點的手勢、造價＝COST；預覽與蓋下去的拒絕理由（不是對的資源格、水上、路上、有建築、錢不夠）
//      講的是實驗線的字、而且錢與歷史都不動；
//   2. 玩家蓋井：油井 4 口、礦場 3 口（commitOp，跟畫面上點下去同一條路）——歷史 7 筆 place（k 49／50、造價 1300／1500）、扣款＝造價總和、拿掉（undo）退全額、重蓋；
//   3. 枯竭事件的時間軸：連推 130 天，每口井的耗損第一次到 240 的那一天＝歷史裡那口井的 depleted 事件的日子（油井 80 天、礦場 120 天）、一口一筆、同一天內照格索引、座標與種類對；
//      當天開採量在耗盡的那天掉下來、井數照算；預先帶 rdep 的存檔（W3：239、238、240、一半）隔天耗盡的井記事件、本來就滿的不記；存→讀→再推，不重複記；
//   4. 編解碼與存讀：格式 9（只有真的有 depleted 事件才寫 9，沒有的城仍照原本的 4–8）、緊湊列 [23, dDay, x, z, k]、packHistory＝日誌接續 packMore、unpackHistory 來回相同、
//      checkHistory（hv 1）來回相同；壞列（座標出界、種類不是 49／50、欄位缺、太多）丟錯；重播（replayCity）遇到沒有井的格子丟錯；存→讀→再存→讀的歷史不變；
//   5. 等價：同一批井用 2D 存檔的寫法擺進去（不走玩家的工具）推 130 天，每天的開採量與庫存、耗損、耗盡事件跟玩家蓋的一模一樣；
//   6. 大事記：chronicleOf 多一種 depleted（資源耗盡：油井／礦場（x, z）停產），順序＝發生順序；
//   7. 資源圖視圖的圖層（src/render/resource.ts）：整張圖的格數、顏色、超過容量會長大、清掉就是 0；渲染不 import 模擬（規則 2）；
//   8. 接線突變：day.ts 的副本改壞一處（不記事件、日子少一天、不清當天名單、種類寫死 49、不重置名單）都要紅；resource.ts 耗盡不推名單、build.ts 資源格判定拿掉也要紅。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { loadCode, saveCode, packHistory, unpackHistory, checkHistory } from '../src/io/save.ts';
import { packMore, PACK0 } from '../src/io/journal.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { CITY_FORMAT, DECISION_EVENTS, eventFormat } from '../src/sim/city.ts';
import { replayCity } from '../src/sim/replay.ts';
import { commitOp, previewOp, undoOp, CIVIC_TOOLS, labToolOf, gestureOf } from '../src/sim/edit.ts';
import { COST } from '../src/sim/rules/build.ts';
import { RESOURCE_STOCK } from '../src/sim/rules/resource.ts';
import { chronicleOf, depletedToastText } from '../src/sim/decisions.ts';
import { ResourceHints, RES_COLORS } from '../src/render/resource.ts';
import { loadMod } from './unit-d024.mjs';
import { dayVariant } from './unit-d021.mjs';
import { builtWells, builtBase, builtAsBuilder, BUILT_OIL, BUILT_ORE, d036Runs } from './d036-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
export const LIVE = {};
export async function d040Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D040 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}
const strip = h => h.filter(e => e.t !== 'restyle');   // 讀檔會再重挑一次外觀（D012 起的既有行為，多幾筆 restyle）：比對時不算
const DAYS = 130;

// 連推 days 天（stepFn 預設是真的 stepDay；突變時換成副本的）。回傳：每口井耗損第一次到 240 的那天、每天的開採量
function timeline(stepFn, days = DAYS) {
  const L = builtWells(), s = L.sim, N = s.w.N, idxs = L.put.map(([, x, z]) => z * N + x), first = new Map(), res = [], deps = [];
  const d0 = s.day;
  for (let d = 1; d <= days; d++) {
    const rep = stepFn(s); res.push(rep.resource); deps.push(rep.depleted);
    for (const i of idxs) if (s.res.rdep[i] >= RESOURCE_STOCK && !first.has(i)) first.set(i, s.day);
  }
  const k = Object.fromEntries(L.put.map(([kind, x, z]) => [z * N + x, kind === 'oil' ? 49 : 50]));
  const expected = [...first].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(([i, day]) => ({ day, t: 'depleted', x: i % N, z: (i / N) | 0, k: k[i] }));
  return { L, s, d0, first, res, deps, expected, events: s.city.history.filter(e => e.t === 'depleted') };
}

async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const base = builtBase();

  // ---- 1. 工具與拒絕 ----
  {
    const bad = [], info = [];
    const ids = CIVIC_TOOLS.map(t => t.id);
    if (CIVIC_TOOLS.length !== 16 || new Set(ids).size !== 16) bad.push(`公共設施 ${CIVIC_TOOLS.length} 顆（要 16 顆、不重複）`);
    if (J(ids.slice(-2)) !== J(['oilwell', 'mine'])) bad.push(`最後兩顆 ${ids.slice(-2)}（要油井、礦場；既有的順序不動）`);
    for (const [id, nm, cost] of [['oilwell', '油井', 1300], ['mine', '礦場', 1500]]) {
      const t = CIVIC_TOOLS.find(q => q.id === id);
      if (!t || t.name !== nm || t.cost !== cost || COST[id] !== cost) bad.push(`${id}：${J(t)} COST ${COST[id]}（要 ${nm} $${cost}）`);
      if (gestureOf(id) !== 'tap' || labToolOf('civic', 'alley', id) !== id) bad.push(`${id}：手勢 ${gestureOf(id)}／工具代號 ${labToolOf('civic', 'alley', id)}`);
    }
    // 預覽與拒絕：用一座底城（還沒有井）
    const L = loadCode(base.code, KT, vrank); if (!L.ok) throw new Error('底城讀不進 ' + L.error);
    const s = L.sim, N = s.w.N; s.money = 1e6;
    const tile = i => s.w.tiles[i], isFree = i => { const t = tile(i); return (t.t === 1 || t.t === 2) && !t.road && !t.bld && !t.tree; };
    const pick = f => { for (let i = 0; i < N * N; i++) if (f(i)) return [i % N, (i / N) | 0]; return null; };
    const oil = pick(i => s.res.resource[i] === 1 && isFree(i)), ore = pick(i => s.res.resource[i] === 2 && isFree(i)), none = pick(i => s.res.resource[i] === 0 && isFree(i));
    const water = pick(i => tile(i).t === 0 && s.res.resource[i] === 0) ?? (() => { const q = pick(i => s.res.resource[i] === 0 && isFree(i) && i > (none[1] * N + none[0])); if (q) tile(q[1] * N + q[0]).t = 0; return q; })(), road = pick(i => tile(i).road && s.res.resource[i] === 0), bld = pick(i => tile(i).bld && s.res.resource[i] === 0);
    if (!oil || !ore || !none || !water || !road || !bld) throw new Error(`底城缺格子：${J({ oil, ore, none, water, road, bld })}`);
    const op = (tool, [x, z]) => ({ k: 'tap', tool, x0: x, z0: z, x1: x, z1: z });
    const cases = [
      ['油井在油田', 'oilwell', oil, true, 1300, null], ['礦場在礦藏', 'mine', ore, true, 1500, null],
      ['油井在礦藏', 'oilwell', ore, false, 0, '需油田資源格'], ['礦場在油田', 'mine', oil, false, 0, '需礦藏資源格'],
      ['油井在沒有資源的地', 'oilwell', none, false, 0, '需油田資源格'], ['礦場在沒有資源的地', 'mine', none, false, 0, '需礦藏資源格'],
      ['油井在水上', 'oilwell', water, false, 0, '只能蓋在陸地上'], ['礦場在路上', 'mine', road, false, 0, '交通線上不能建造'], ['油井在建築上', 'oilwell', bld, false, 0, '已有建築'],
    ];
    for (const [name, tool, at, ok, cost, why] of cases) {
      const pv = previewOp(s, op(tool, at)), h0 = s.city.history.length, m0 = s.money;
      const r = pv.cells[0];
      if (!!r?.ok !== ok || (ok && r.cost !== cost) || (!ok && pv.reason !== why)) bad.push(`預覽「${name}」：ok ${r?.ok}、造價 ${r?.cost}、理由 ${pv.reason}（要 ${ok ? `可以、$${cost}` : why}）`);
      if (!ok) {
        const c = commitOp(s, op(tool, at), 0);
        if (c.ok || c.placed || s.money !== m0 || s.city.history.length !== h0 || c.reason !== why) bad.push(`蓋「${name}」：ok ${c.ok}、理由 ${c.reason}、錢 ${m0}→${s.money}、歷史 ${h0}→${s.city.history.length}（要被擋、錢與歷史不動）`);
      }
    }
    { // 錢不夠：$1,299 蓋不了油井，$1,300 剛好
      const [x, z] = oil; s.money = 1299; const h0 = s.city.history.length, c0 = commitOp(s, op('oilwell', oil), 0);
      if (c0.ok || s.money !== 1299 || s.city.history.length !== h0) bad.push(`$1,299 蓋油井：ok ${c0.ok}、錢 ${s.money}、歷史 ${h0}→${s.city.history.length}（要被擋）`);
      s.money = 1300; const c1 = commitOp(s, op('oilwell', oil), 0);
      if (!c1.ok || s.money !== 0 || !s.w.tiles[z * N + x].bld || s.w.tiles[z * N + x].bld.k !== 49) bad.push(`$1,300 蓋油井：ok ${c1.ok}、錢 ${s.money}（要剛好蓋成、錢 0）`);
      info.push('錢差 $1 擋下、剛好蓋成');
    }
    log(!bad.length, 'D040 驗收 2：工具——「公共設施」16 顆、最後兩顆是油井（$1,300）與礦場（$1,500）、點的手勢、造價＝COST；預覽與蓋下去：對的資源格可以蓋；種類對調、沒有資源、水上、路上、有建築、錢差 $1 都被擋，講實驗線的字、錢與歷史不動',
      bad.slice(0, 4).join('；') || `${cases.length} 種情形＋錢的邊界都對：${info.join('；')}`);
  }

  // ---- 2. 玩家蓋井 ----
  let wells = null;
  {
    const bad = [];
    const L0 = loadCode(base.code, KT, vrank), m0 = Math.max(L0.sim.money, 1e6), L = builtWells(), s = L.sim;
    wells = L.put;
    const places = s.city.history.filter(e => e.t === 'place' && (e.k === 49 || e.k === 50));
    if (L.put.length !== BUILT_OIL + BUILT_ORE) bad.push(`蓋成 ${L.put.length} 口（要 ${BUILT_OIL + BUILT_ORE}）`);
    if (places.length !== L.put.length) bad.push(`歷史的 place 有 ${places.length} 筆（要 ${L.put.length}）`);
    const sum = places.reduce((a, e) => a + e.cost, 0);
    for (const e of places) { const want = e.k === 49 ? 1300 : 1500; if (e.cost !== want && e.cost !== want + 2) bad.push(`(${e.x},${e.z}) k${e.k} 造價 ${e.cost}（要 ${want}，樹上加 2）`); }
    if (m0 - s.money !== sum) bad.push(`扣款 ${m0 - s.money} ≠ 歷史造價總和 ${sum}`);
    for (const [kind, x, z] of L.put) { const t = s.w.tiles[z * s.w.N + x]; if (!t.bld || t.bld.k !== (kind === 'oil' ? 49 : 50) || t.bld.lv !== 1 || t.bld.v !== 0 || !t.bld.pw) bad.push(`(${x},${z}) 格子不對 ${J(t.bld)}`); if (s.res.resource[z * s.w.N + x] !== (kind === 'oil' ? 1 : 2)) bad.push(`(${x},${z}) 不在對的資源格上`); }
    // 拿掉（undo）退全額，再蓋一次
    const [kind, x, z] = L.put.at(-1), tool = kind === 'oil' ? 'oilwell' : 'mine', mm = s.money, h0 = s.city.history.length;
    const u = undoOp(s);
    if (!u.ok || s.w.tiles[z * s.w.N + x].bld || s.money - mm !== u.refund || u.refund < (tool === 'mine' ? 1500 : 1300)) bad.push(`拿掉最後一口：ok ${u.ok}、退 ${u.refund}、錢 ${mm}→${s.money}、格子 ${J(s.w.tiles[z * s.w.N + x].bld)}`);
    if (s.city.history.length <= h0) bad.push('拿掉沒有記 undo 事件');
    const again = commitOp(s, { k: 'tap', tool, x0: x, z0: z, x1: x, z1: z }, 0);
    if (!again.ok || s.w.tiles[z * s.w.N + x].bld?.k !== (tool === 'mine' ? 50 : 49)) bad.push(`再蓋一次：ok ${again.ok}`);
    log(!bad.length, `D040 驗收 2：玩家蓋井——油井 ${BUILT_OIL} 口、礦場 ${BUILT_ORE} 口（commitOp，跟畫面上點下去同一條路）：歷史 ${BUILT_OIL + BUILT_ORE} 筆 place（k 49／50、造價 $1,300／$1,500）、扣款＝造價總和、都站在對的資源格上；拿掉退全額、記 undo、能再蓋`,
      bad.slice(0, 4).join('；') || `${L.put.length} 口、扣 $${sum}（資金 $${m0}→$${m0 - sum}）；拿掉最後一口退 $${u.refund}、再蓋成功`);
  }

  // ---- 3. 枯竭事件的時間軸 ----
  const T = timeline(realDay.stepDay);
  {
    const bad = [], { s, d0, first, res, expected, events } = T;
    if (first.size !== 7) bad.push(`耗盡的井 ${first.size} 口（要 7 口：油井 4＋礦場 3；${DAYS} 天夠）`);
    if (J(events) !== J(expected)) bad.push(`歷史的 depleted 事件 ≠ 耗損第一次到 240 的日子：事件 ${J(events).slice(0, 220)}｜應有 ${J(expected).slice(0, 220)}`);
    for (const e of events) { const want = d0 + (e.k === 49 ? RESOURCE_STOCK / 3 : RESOURCE_STOCK / 2); if (e.day !== want) bad.push(`(${e.x},${e.z}) k${e.k} 在第 ${e.day} 天耗盡，要第 ${want} 天（蓋下去那天起算 ${RESOURCE_STOCK}／速率 天）`); }
    if (new Set(events.map(e => `${e.x},${e.z}`)).size !== events.length) bad.push('同一口井記了不只一筆');
    for (let i = 1; i < events.length; i++) { const a = events[i - 1], b = events[i]; if (b.day < a.day || (b.day === a.day && b.z * s.w.N + b.x <= a.z * s.w.N + a.x)) bad.push(`事件順序不對：${J(a)} → ${J(b)}`); }
    // 當天開採量：耗盡那天之後掉下來；井數照算（oilGain 3×4、oreGain 2×3）
    const at = n => res[n - 1];
    if (at(1).oil !== 12 || at(80).oil !== 12 || at(81).oil !== 0 || at(1).ore !== 6 || at(120).ore !== 6 || at(121).ore !== 0) bad.push(`開採量曲線不對：第 1／80／81 天油 ${at(1).oil}／${at(80).oil}／${at(81).oil}，第 1／120／121 天礦 ${at(1).ore}／${at(120).ore}／${at(121).ore}（要 12／12／0 與 6／6／0）`);
    if (at(DAYS).wells[0] !== 4 || at(DAYS).wells[1] !== 3) bad.push(`耗盡後井數 ${J(at(DAYS).wells)}（耗盡的井還在，要 [4,3]）`);
    // 當天報告 rep.depleted＝那一天的事件（一天一份、介面據此發一則通知）；通知文字
    {
      const byDay = new Map(); for (const e of events) { if (!byDay.has(e.day)) byDay.set(e.day, []); byDay.get(e.day).push({ x: e.x, z: e.z, k: e.k }); }
      T.deps.forEach((q, i) => { const want = byDay.get(d0 + 1 + i) ?? []; if (J(q ?? null) !== J(want)) bad.push(`第 ${d0 + 1 + i} 天的 rep.depleted ${J(q)} ≠ 那天的事件 ${J(want)}`); });
      const four = byDay.get(d0 + 80), three = byDay.get(d0 + 120);
      const texts = [depletedToastText([four[0]]), depletedToastText(four), depletedToastText(three), depletedToastText([...four.slice(0, 2), ...three.slice(0, 1)])];
      const want = [`資源耗盡：油井（${four[0].x}, ${four[0].z}）停產`, '資源耗盡：油井 4 口停產', '資源耗盡：礦場 3 口停產', '資源耗盡：油井 2 口、礦場 1 口停產'];
      if (J(texts) !== J(want)) bad.push(`通知文字 ${J(texts)} ≠ ${J(want)}`);
    }
    LIVE.timeline = { d0, days: DAYS, events: events.length };
    log(!bad.length, `D040 驗收 4：枯竭事件的時間軸——玩家蓋 7 口、連推 ${DAYS} 天：每口井的 depleted 事件日子＝耗損第一次到 ${RESOURCE_STOCK} 的那一天（油井蓋下去起 80 天、礦場 120 天）、一口一筆、同天照格索引、座標與種類對；當天開採量在耗盡那天掉下來、井數照算`,
      bad.slice(0, 4).join('；') || `${events.length} 筆：油井 ${events.filter(e => e.k === 49).length} 口在第 ${d0 + 80} 天、礦場 ${events.filter(e => e.k === 50).length} 口在第 ${d0 + 120} 天；開採量 12→0（油）、6→0（礦）`);
  }
  {   // 預先帶 rdep 的存檔（W3）：隔天耗盡的記事件、本來就滿的不記；存→讀→再推，不重複
    const bad = [], info = [], w3 = d036Runs().find(r => r.id === 'W3'), L = loadCode(w3.code, KT, vrank);
    if (!L.ok) throw new Error('W3 讀不進 ' + L.error);
    const s = L.sim, N = s.w.N, rd0 = Array.from(s.res.rdep), wellsAt = [];
    for (let i = 0; i < N * N; i++) { const b = s.w.tiles[i].bld; if (b && (b.k === 49 || b.k === 50) && s.res.resource[i] === (b.k === 49 ? 1 : 2)) wellsAt.push(i); }
    const pre = wellsAt.filter(i => rd0[i] >= RESOURCE_STOCK), will = wellsAt.filter(i => rd0[i] > 0 && rd0[i] < RESOURCE_STOCK);
    const h0 = s.city.history.length;
    for (let d = 0; d < 3; d++) realDay.stepDay(s);
    const ev = s.city.history.slice(h0).filter(e => e.t === 'depleted'), full = wellsAt.filter(i => s.res.rdep[i] >= RESOURCE_STOCK && rd0[i] < RESOURCE_STOCK);
    if (ev.length !== full.length || ev.length < 3) bad.push(`W3 三天內耗盡 ${full.length} 口、事件 ${ev.length} 筆（要一口一筆、至少 3 口）`);
    if (ev.some(e => pre.includes(e.z * N + e.x))) bad.push('本來就滿 240 的井被記了耗盡事件');
    if (!pre.length) bad.push('W3 沒有本來就滿的井（這一筆沒有量到「本來就滿不記」）');
    for (const e of ev) if (e.day !== s.city.history.find(q => q === e).day || e.day > 150 + 3 + (s.day - s.day)) bad.push('日子不對');
    // 存→讀→再推：不重複
    const code = saveCode(s, L.template, L.start), L2 = loadCode(code, KT, vrank);
    if (!L2.ok) bad.push('存的碼讀不回 ' + L2.error);
    else {
      const n0 = L2.sim.city.history.filter(e => e.t === 'depleted').length;
      for (let d = 0; d < 5; d++) realDay.stepDay(L2.sim);
      const n1 = L2.sim.city.history.filter(e => e.t === 'depleted').length;
      if (n0 !== ev.length || n1 !== n0) bad.push(`存→讀→再推 5 天：depleted 事件 ${ev.length}→${n0}→${n1}（要不變：滿的井不再記）`);
    }
    info.push(`W3：本來滿的 ${pre.length} 口、三天內耗盡 ${ev.length} 口（每口一筆）、存讀再推不重複`);
    void will;
    log(!bad.length, 'D040 驗收 4：預先帶耗損的存檔（W3：剩 1、2 的井隔天耗盡記事件、本來就滿 240 的不記、一半的不動）；存→讀→再推 5 天，不重複記', bad.slice(0, 4).join('；') || info.join('；'));
  }

  // ---- 4. 編解碼與存讀 ----
  {
    const bad = [], info = [], { s, L } = T, h = s.city.history, N = s.w.N;
    // 格式
    if (eventFormat({ day: 1, t: 'depleted', x: 0, z: 0, k: 49 }) !== 9 || CITY_FORMAT < 9) bad.push(`eventFormat(depleted) ${eventFormat({ day: 1, t: 'depleted', x: 0, z: 0, k: 49 })}、CITY_FORMAT ${CITY_FORMAT}（要 9）`);
    for (const t of DECISION_EVENTS) if (eventFormat({ day: 1, t }) !== 8) bad.push(`${t} 的格式不是 8（舊事件的格式不變）`);
    const code = saveCode(s, L.template, L.start), raw = decodeLabCode(code).save.raw;
    if (raw.d3?.f !== 9) bad.push(`有耗盡事件的城存出格式 ${raw.d3?.f}（要 9）`);
    {   // 還沒耗盡（推 13 天）存出來是 9 以下
      const L13 = builtWells(); for (let d = 0; d < 13; d++) realDay.stepDay(L13.sim);
      const f13 = decodeLabCode(saveCode(L13.sim, L13.template, L13.start)).save.raw.d3?.f;
      if (!(f13 >= 4 && f13 <= 8)) bad.push(`沒有耗盡事件的城存出格式 ${f13}（要 4–8，不為了沒有的事件升格式）`); else info.push(`未耗盡存 ${f13}`);
    }
    // 讀回來：歷史逐筆相同、重播成功
    const L1 = loadCode(code, KT, vrank);
    if (!L1.ok || !L1.replayed) bad.push(`讀回來 ok ${L1.ok} replayed ${L1.replayed}（${L1.note}）`);
    else {
      if (J(strip(L1.sim.city.history)) !== J(strip(h))) bad.push('讀回來的歷史跟存之前不同');
      const code2 = saveCode(L1.sim, L1.template, L1.start), L2 = loadCode(code2, KT, vrank);
      if (!L2.ok || J(strip(L2.sim.city.history)) !== J(strip(h))) bad.push('存→讀→再存→讀的歷史不同');
      if (J(Array.from(L1.sim.res.rdep)) !== J(Array.from(s.res.rdep))) bad.push('讀回來的耗損不同');
    }
    // 編解碼
    const rows = packHistory(h);
    const dep = rows.filter(r => r[0] === 23);
    if (dep.length !== 7 || dep.some(r => r.length !== 5)) bad.push(`緊湊列：depleted 列 ${dep.length} 筆、長度 ${dep.map(r => r.length)}（要 7 筆、[23, dDay, x, z, k]）`);
    try {
      if (J(unpackHistory(rows, N)) !== J(h)) bad.push('緊湊列來回不同');
      const k = h.length >> 1, a = packMore(h.slice(0, k), PACK0), b = packMore(h, a.st);
      if (J([...a.rows, ...b.rows]) !== J(rows)) bad.push('分兩段編（日誌接續）≠ 一次編');
      if (J(checkHistory(JSON.parse(J(h)), N)) !== J(h)) bad.push('物件格式（hv 1）來回不同');
      for (const n of [10, 50, h.length - 8]) if (J(packHistory(h.slice(0, n))) !== J(rows.slice(0, n))) bad.push(`前 ${n} 筆的列在後面被改了（只增不改）`);
    } catch (e) { bad.push('編解碼丟例外：' + e.message.slice(0, 100)); }
    // 壞列
    const ok = unpackHistory([[23, 3, 5, 6, 49], [23, 1, 7, 8, 50]], N);   // 第一欄之後是「跟上一筆差幾天」（dDay）
    if (J(ok) !== J([{ day: 3, t: 'depleted', x: 5, z: 6, k: 49 }, { day: 4, t: 'depleted', x: 7, z: 8, k: 50 }])) bad.push(`好的列讀錯 ${J(ok)}`);
    const badRows = { 'x 出界': [23, 0, N, 1, 49], 'z 出界': [23, 0, 1, N + 3, 49], 'x 負的': [23, 0, -1, 1, 49], '種類 48': [23, 0, 1, 1, 48], '種類 51': [23, 0, 1, 1, 51], '種類是字串': [23, 0, 1, 1, '49'], '缺種類': [23, 0, 1, 1], '欄位太多': [23, 0, 1, 1, 49, 0], '座標是小數': [23, 0, 1.5, 1, 49] };
    for (const [what, row] of Object.entries(badRows)) { let threw = false; try { unpackHistory([row], N); } catch { threw = true; } if (!threw) bad.push(`壞列（${what}）沒被擋`); }
    for (const [what, e] of Object.entries({ 種類不是井: { day: 1, t: 'depleted', x: 1, z: 1, k: 3 }, 座標出界: { day: 1, t: 'depleted', x: N, z: 0, k: 49 } })) { let threw = false; try { checkHistory([e], N); } catch { threw = true; } if (!threw) bad.push(`壞事件（${what}）沒被擋`); }
    // 重播：沒有井的格子丟錯
    const hist = JSON.parse(J(h)); hist.splice(hist.findIndex(e => e.t === 'depleted'), 1, { day: 999, t: 'depleted', x: 0, z: 0, k: 49 });
    let threw = false; try { replayCity(base.code, hist, KT); } catch { threw = true; }
    if (!threw) bad.push('重播：耗盡事件指的格子沒有井，居然沒丟錯');
    let okReplay = false; try { replayCity(base.code, h, KT); okReplay = true; } catch (e) { bad.push('重播：好的歷史丟錯 ' + e.message.slice(0, 80)); }
    void okReplay;
    log(!bad.length, 'D040 驗收 4、5：存讀與編解碼——有耗盡事件的城存格式 9、沒有的仍存 4–8；緊湊列 [23, dDay, x, z, k]；packHistory＝日誌接續 packMore、unpackHistory 與 checkHistory 來回相同、前綴不變；壞列（出界、種類不是 49／50、缺欄、太多、小數）被擋；重播遇到沒有井的格子丟錯；存→讀→再存→讀的歷史不變',
      bad.slice(0, 5).join('；') || `${dep.length} 筆 depleted 列；格式 9；${info.join('；')}；${Object.keys(badRows).length + 2} 種壞資料擋下；歷史 ${h.length} 筆`);
  }

  // ---- 5. 等價：玩家蓋的＝存檔裡本來就有的 ----
  {
    const bad = [], mine = timeline(realDay.stepDay), code = builtAsBuilder(wells), L = loadCode(code, KT, vrank);
    if (!L.ok) throw new Error('builder 城讀不進 ' + L.error);
    const s = L.sim, rows = [];
    for (let d = 1; d <= DAYS; d++) {
      const rep = realDay.stepDay(s), a = mine.res[d - 1], ec = rep.econ.ec;
      rows.push([rep.resource, Math.round(s.econ.supplies), s.econ.fuel, s.econ.steel, ec.fuelMade, ec.steelMade]);
      if (J(rep.resource) !== J(a)) { bad.push(`第 ${d} 天開採量 builder ${J(rep.resource)} ≠ 玩家蓋 ${J(a)}`); break; }
    }
    const wellIdx = wells.map(([, x, z]) => z * s.w.N + x);
    if (J(wellIdx.map(i => s.res.rdep[i])) !== J(wellIdx.map(i => mine.s.res.rdep[i]))) bad.push('結束時耗損不同');
    const evB = s.city.history.filter(e => e.t === 'depleted');
    if (J(evB) !== J(mine.events)) bad.push(`耗盡事件 builder ${J(evB).slice(0, 160)} ≠ 玩家蓋 ${J(mine.events).slice(0, 160)}`);
    if (Math.round(s.econ.supplies) !== Math.round(mine.s.econ.supplies)) bad.push(`供應品 builder ${s.econ.supplies} ≠ 玩家蓋 ${mine.s.econ.supplies}`);
    log(!bad.length, `D040 驗收 6：玩家蓋的＝存檔裡本來就有的——同一批 7 口井用 2D 存檔的寫法擺進去（不走玩家的工具）連推 ${DAYS} 天，每天的開採量（油、礦、供應品、井數）、結束的耗損與供應品、耗盡事件一模一樣`,
      bad.slice(0, 3).join('；') || `${DAYS} 天每天開採量全等；耗盡事件 ${evB.length} 筆全等；供應品 ${Math.round(s.econ.supplies)}`);
  }

  // ---- 6. 大事記 ----
  {
    const bad = [], { s, d0 } = T, lines = chronicleOf(s.city.history).filter(l => l.kind === 'depleted');
    if (lines.length !== 7) bad.push(`大事記有 ${lines.length} 行資源耗盡（要 7）`);
    const w = s.city.history.find(e => e.t === 'depleted' && e.k === 49), m = s.city.history.find(e => e.t === 'depleted' && e.k === 50);
    if (!lines.some(l => l.day === d0 + 80 && l.text === `資源耗盡：油井（${w.x}, ${w.z}）停產`)) bad.push(`缺油井那行：${J(lines[0])}`);
    if (!lines.some(l => l.day === d0 + 120 && l.text === `資源耗盡：礦場（${m.x}, ${m.z}）停產`)) bad.push(`缺礦場那行：${J(lines.at(-1))}`);
    for (let i = 1; i < lines.length; i++) if (lines[i].day < lines[i - 1].day) bad.push('順序不是發生順序');
    log(!bad.length, 'D040 驗收 4：大事記（☰）——chronicleOf 多一種 depleted：「資源耗盡：油井（x, y）停產」「資源耗盡：礦場（x, y）停產」，日子＝事件日子、順序＝發生順序', bad.slice(0, 3).join('；') || `${lines.length} 行：${lines[0].text}（第 ${lines[0].day} 天）…${lines.at(-1).text}（第 ${lines.at(-1).day} 天）`);
  }

  // ---- 7. 資源圖視圖的圖層 ----
  {
    const bad = [], H = new ResourceHints(4), THREE = await import('three');
    const cells = Array.from({ length: 11 }, (_, i) => ({ x: i, z: i + 1, y: 0.3, kind: i % 2 ? 2 : 1 }));
    H.set(cells);
    if (H.shown !== 11 || H.mesh.instanceMatrix.count < 11) bad.push(`11 格：shown ${H.shown}、容量 ${H.mesh.instanceMatrix.count}（超過容量要長大）`);
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    H.mesh.getMatrixAt(3, m); p.setFromMatrixPosition(m);
    if (Math.abs(p.x - 3.5) > 1e-6 || Math.abs(p.z - 4.5) > 1e-6 || p.y < 0.3) bad.push(`第 3 格位置 ${p.toArray()}（要在格中心 (3.5, 4.5)、貼在格頂上）`);
    const c1 = new THREE.Color(), c2 = new THREE.Color(), want1 = new THREE.Color(RES_COLORS[1]), want2 = new THREE.Color(RES_COLORS[2]);
    H.mesh.getColorAt(0, c1); H.mesh.getColorAt(1, c2);
    if (c1.getHexString() !== want1.getHexString() || c2.getHexString() !== want2.getHexString() || c1.getHexString() === c2.getHexString()) bad.push(`顏色 油 ${c1.getHexString()}／礦 ${c2.getHexString()}（要 ${want1.getHexString()}／${want2.getHexString()}、兩種不同）`);
    if (RES_COLORS[1] !== '#ffd36d' || RES_COLORS[2] !== '#9bd8ff') bad.push('顏色字面量不是實驗線 62594 的黃 #ffd36d／藍 #9bd8ff');
    H.set(Array.from({ length: 3000 }, (_, i) => ({ x: i % 70, z: (i / 70) | 0, y: 0, kind: 1 })));
    if (H.shown !== 3000) bad.push(`3000 格：shown ${H.shown}`);
    H.clear(); if (H.shown !== 0) bad.push('clear 之後 shown 不是 0');
    const src = read('src/render/resource.ts');
    if (/from\s+['"][^'"]*\/sim\//.test(src) || /Math\.random|Date\.now|performance\.now/.test(src)) bad.push('src/render/resource.ts 碰了模擬或隨機／時鐘（規則 2、3）');
    H.dispose();
    log(!bad.length, 'D040 驗收 3：資源圖視圖的圖層（src/render/resource.ts）——一個 InstancedMesh：格數、位置（格中心貼格頂）、顏色（油黃 #ffd36d、礦藍 #9bd8ff＝實驗線 62594）、超過容量會長大、clear 歸零；不 import 模擬、不碰隨機與時鐘', bad.slice(0, 3).join('；') || '11 格→3000 格→清掉：位置、顏色、長大都對');
  }

  // ---- 8. 接線突變 ----
  {
    const bad = [], out = [];
    const base0 = J(T.expected);
    const dayMuts = [
      ['不記事件（迴圈換成空陣列）', [['for (const i of s.res.depleted)', 'for (const i of [])']]],
      ['日子少一天（s.day 而不是 s.day + 1）', [["{ day: s.day + 1, t: 'depleted'", "{ day: s.day, t: 'depleted'"]]],
      ['不清當天名單（名單越積越長，一口井記很多筆）', [['s.res.depleted = [];', 's.res.depleted ??= [];']]],
      ['種類寫死 49（礦場記成油井）', [['const k = w.tiles[i].bld!.k;', 'const k = 49;']]],
      ['座標 x、z 對調（事件）', [["{ day: s.day + 1, t: 'depleted', x: i % w.N, z: (i / w.N) | 0, k }", "{ day: s.day + 1, t: 'depleted', z: i % w.N, x: (i / w.N) | 0, k }"]]],
      ['報告不給耗盡名單（rep.depleted 空）', [['merges: mgs, depleted, hazard: hz,', 'merges: mgs, depleted: [], hazard: hz,']]],
    ];
    for (const [name, edits] of dayMuts) {
      try {
        const M = await dayVariant(edits), r = timeline(M.stepDay);
        const byDay = new Map(); for (const e of r.events) { if (!byDay.has(e.day)) byDay.set(e.day, []); byDay.get(e.day).push({ x: e.x, z: e.z, k: e.k }); }
        const repOk = r.deps.every((q, i) => J(q ?? null) === J(byDay.get(r.d0 + 1 + i) ?? []));
        if (J(r.events) === J(r.expected) && J(r.events) === base0 && repOk) bad.push(`突變「${name}」沒抓到`); else out.push(name);
      } catch (e) { bad.push(`突變「${name}」：${String(e.message).slice(0, 120)}`); }
    }
    {   // resource.ts：耗盡不推名單（歷史沒有事件）
      try {
        const R = await loadMod('src/sim/rules/resource.ts', [['if (f.rdep[root] >= RESOURCE_STOCK) f.depleted?.push(root);', '']]);
        const C = await loadMod('src/sim/rules/count.ts', [], { './resource.ts': R });   // extractWell 在 count.ts 的 tallyBuildings 裡被叫
        const M = await dayVariant([], { './rules/count.ts': C }), r = timeline(M.stepDay);
        if (J(r.events) === J(r.expected)) bad.push('突變「extractWell 不推名單」沒抓到'); else out.push('extractWell 不推名單');
      } catch (e) { bad.push(`突變「extractWell 不推名單」：${String(e.message).slice(0, 120)}`); }
    }
    {   // build.ts：資源圖不讀（一律當 0）→ 蓋不了井
      try {
        const B = await loadMod('src/sim/rules/build.ts', [['r = st.resource ? st.resource[idx(w, x, y)] : 0;', 'r = 0;']]);
        const E = await loadMod('src/sim/edit.ts', [], { './rules/build.ts': B });
        const L = loadCode(base.code, KT, vrank), s = L.sim; s.money = 1e6;
        const N = s.w.N; let i = 0; while (s.res.resource[i] !== 1 || s.w.tiles[i].road || s.w.tiles[i].bld) i++;
        const r = E.commitOp(s, { k: 'tap', tool: 'oilwell', x0: i % N, z0: (i / N) | 0, x1: i % N, z1: (i / N) | 0 }, 0);
        if (r.ok) bad.push('突變「build 不讀資源圖」沒抓到（還是蓋成了）'); else out.push('build 不讀資源圖');
      } catch (e) { bad.push(`突變「build 不讀資源圖」：${String(e.message).slice(0, 120)}`); }
    }
    log(!bad.length, 'D040 驗收 8：接線突變——day.ts 的副本改壞一處（不記事件、日子少一天、不清當天名單、種類寫死 49、座標對調、報告不給名單）、extractWell 不推名單、build 不讀資源圖，都要被時間軸或蓋井的檢查抓到', bad.slice(0, 4).join('；') || `${out.length} 個突變全紅：${out.join('、')}`);
  }
}

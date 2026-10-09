// D044 Node 守衛：蓋天然氣井（k117）與太空研究中心（k51，3×3，工具列 Lv.22 解鎖）。由 tools/unit.mjs 呼叫。建造規則逐筆對拍實驗線在 tools/unit-d044-build.mjs（黃金樣本 d044-build.json）；
// 實驗線頁面實跑（玩家蓋的存成碼、實驗線讀進去推進）在 tools/unit-d044-live.mjs。這裡驗：
//   1. 工具：CIVIC_TOOLS 共 18 顆、最後兩顆是天然氣井（$1,400）與太空研究中心（$4,500，3×3、Lv.22 解鎖）、都是點的手勢、造價＝COST；拒絕理由（不是油田、水上、路上、有建築、整塊 3×3 裡有水／路／建築／焦土／出界、錢不夠）
//      講的是實驗線的字、而且錢與歷史都不動；規則不看城市等級（解鎖是介面的鎖，toolLock）；
//   2. 預覽：太空研究中心畫整塊 3×3（九格同一個 ok、造價只算根格、一件）；天然氣井一格；
//   3. 玩家蓋：天然氣井 3 口、太空研究中心 2 座（一座壓在分區與樹上）——歷史一筆 place 一座（沒有多餘的 zone／doze 事件）、造價、占地九格 occ、整塊清樹清分區、根格 sz 3 其餘格指向根；
//      重播（replayCity）＝模擬的城；復原整塊還原（含分區與樹）、退全額；拆（點根格、點附屬格）整棟拆掉、一筆 doze；存→讀→再存；
//   4. 污染源：天然氣井蓋下去污染場（POL）跟存檔裡本來就有的一樣（POLBASE／POL 逐格）、復原回到蓋之前；太空研究中心不是污染源；
//   5. 等價：同一批東西用 2D 存檔的寫法擺進去（不走玩家的工具）推 30 天，每天的報告逐欄相同（只有「施工中棟數」不同：新蓋的在施工）；太空研究中心每 24 天一輪（一座 $3,500、供應品 180）；
//   6. 接線突變：edit.ts 的副本改壞一處（附屬格也記事件、預覽不畫整塊、工具鎖拿掉、占地大小寫死 1）、replay.ts 只清根格，都要被抓到。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { loadCode, saveCode } from '../src/io/save.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import * as realDay from '../src/sim/day.ts';
import { replayCity } from '../src/sim/replay.ts';
import * as E from '../src/sim/edit.ts';
import { COST } from '../src/sim/rules/build.ts';
import { loadMod } from './unit-d024.mjs';
import { d044Base, d044Load, d044Built, d044AsBuilder, BLOCKS } from './d044-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
export async function d044Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D044 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}
const strip = h => h.filter(e => e.t !== 'restyle');   // 讀檔會再重挑一次外觀（D012 起的既有行為）：比對時不算
const tap = (tool, x, z) => ({ k: 'tap', tool, x0: x, z0: z, x1: x, z1: z });
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
// 城市模型的指紋：路、等級、分區、樹、占用、水管、焦土，加上每一棟（編號、種類、位置、大小、墓碑日）
const digest = c => J({ r: [...c.road], rc: [...c.rclass], z: [...c.zone], t: [...c.tree], o: [...c.occ], w: [...c.wp], u: [...c.ruin], b: c.buildings.map(b => [b.id, b.k, b.lv, b.v, b.x, b.z, b.size, b.goneDay ?? null, b.abandoned]) });

async function guards(log) {
  const { code: baseCode, KT, vrank } = d044Base();
  const cellsOf = (x, z, n = 3) => { const o = []; for (let dz = 0; dz < n; dz++) for (let dx = 0; dx < n; dx++) o.push([x + dx, z + dz]); return o; };

  // ---- 1. 工具與拒絕 ----
  {
    const bad = [], info = [];
    const ids = E.CIVIC_TOOLS.map(t => t.id);
    if (E.CIVIC_TOOLS.length !== 18 || new Set(ids).size !== 18) bad.push(`公共設施 ${E.CIVIC_TOOLS.length} 顆（要 18 顆、不重複）`);
    if (J(ids.slice(-4)) !== J(['oilwell', 'mine', 'gaswell', 'megaproject'])) bad.push(`最後四顆 ${ids.slice(-4)}（既有的順序不動，新的接在後面）`);
    for (const [id, nm, cost, size, rank] of [['gaswell', '天然氣井', 1400, 1, undefined], ['megaproject', '太空研究中心', 4500, 3, 22]]) {
      const t = E.CIVIC_TOOLS.find(q => q.id === id);
      if (!t || t.name !== nm || t.cost !== cost || COST[id] !== cost || E.toolSize(id) !== size || t.unlockRank !== rank) bad.push(`${id}：${J(t)} COST ${COST[id]} 大小 ${E.toolSize(id)}（要 ${nm} $${cost}、${size}×${size}、解鎖 ${rank}）`);
      if (E.gestureOf(id) !== 'tap' || E.labToolOf('civic', 'alley', id) !== id) bad.push(`${id}：手勢 ${E.gestureOf(id)}／工具代號 ${E.labToolOf('civic', 'alley', id)}`);
      if (!(t.label && [...t.label].length <= 2)) bad.push(`${id} 的小按鈕字「${t?.label}」要兩個字以內（一顆按鈕約 45 px）`);
    }
    for (const t of E.CIVIC_TOOLS) if (t.id !== 'megaproject' && E.toolSize(t.id) !== 1) bad.push(`${t.id} 的占地 ${E.toolSize(t.id)}（只有太空研究中心是 3×3）`);
    // 工具鎖（介面）：Lv.22＝rankIdx 21
    const s = d044Load().sim;
    const lk = r => { s.rankIdx = r; return [E.toolLock(s, 'megaproject'), E.toolLock(s, 'gaswell'), E.toolLock(s, 'oilwell')]; };
    if (J(lk(0)) !== J(['🔒 太空研究中心：城市 Lv.22 解鎖', null, null]) || lk(20)[0] === null || lk(21)[0] !== null || lk(30)[0] !== null) bad.push(`工具鎖：Lv.1 ${J(lk(0))}、Lv.21 ${J(lk(20))}、Lv.22 ${J(lk(21))}（要 Lv.22 起解鎖、字照實驗線「🔒 名稱：城市 Lv.22 解鎖」）`);
    s.rankIdx = 10;
    // 預覽與拒絕：在一座還沒蓋任何東西的城上，C 塊（56,40）當試驗田
    const N = s.w.N, T = (x, z) => s.w.tiles[z * N + x], [cx, cz] = BLOCKS.C;
    s.money = 1e6;
    const oil = (() => { for (let i = 0; i < N * N; i++) { const t = s.w.tiles[i]; if (s.res.resource[i] === 1 && !t.road && !t.bld && (t.t === 1 || t.t === 2)) return [i % N, (i / N) | 0]; } })();
    const ore = (() => { for (let i = 0; i < N * N; i++) { const t = s.w.tiles[i]; if (s.res.resource[i] === 2 && !t.road && !t.bld && (t.t === 1 || t.t === 2)) return [i % N, (i / N) | 0]; } })();
    const none = [cx + 8, cz + 8], road = (() => { for (let i = 0; i < N * N; i++) if (s.w.tiles[i].road) return [i % N, (i / N) | 0]; })(), bld = (() => { for (let i = 0; i < N * N; i++) if (s.w.tiles[i].bld) return [i % N, (i / N) | 0]; })();
    const mut = (x, z, f, back) => { const t = T(x, z), old = J(t); f(t); return () => { Object.keys(t).forEach(k => delete t[k]); Object.assign(t, JSON.parse(old)); void back; }; };
    const cases = [
      ['太空研究中心在乾淨的 3×3', 'megaproject', [cx, cz], null, true, 4500, null],
      ['太空研究中心壓在水上（附屬格）', 'megaproject', [cx, cz], () => mut(cx + 2, cz + 1, t => { t.t = 0; }), false, 0, '需 3×3 陸地'],
      ['太空研究中心壓在路上（附屬格）', 'megaproject', [cx, cz], () => mut(cx + 1, cz + 2, t => { t.road = 1; }), false, 0, '交通線擋住'],
      ['太空研究中心壓在別的建築上（附屬格）', 'megaproject', [cx, cz], () => mut(cx + 2, cz + 2, t => { t.bld = { k: 4, lv: 1, v: 0, age: 0, pw: true, h: 1 }; }), false, 0, '已有建築'],
      ['太空研究中心根格就有建築', 'megaproject', [cx, cz], () => mut(cx, cz, t => { t.bld = { k: 4, lv: 1, v: 0, age: 0, pw: true, h: 1 }; }), false, 0, '已有建築'],
      ['太空研究中心壓在焦土上（附屬格）', 'megaproject', [cx, cz], () => mut(cx + 1, cz + 1, t => { t.ruin = 1; }), false, 0, '焦土需先清理'],
      ['太空研究中心壓在高壓電力走廊上（附屬格）', 'megaproject', [cx, cz], () => mut(cx + 2, cz, t => { t.hv471 = 1; }), false, 0, '高壓電力走廊擋住'],
      ['太空研究中心擠出地圖邊界', 'megaproject', [N - 2, 10], null, false, 0, '需 3×3 陸地'],
      ['天然氣井在油田上', 'gaswell', oil, null, true, 1400, null], ['天然氣井在礦藏上', 'gaswell', ore, null, false, 0, '需油田資源格（天然氣伴生）'],
      ['天然氣井在沒有資源的地', 'gaswell', none, null, false, 0, '需油田資源格（天然氣伴生）'],
      ['天然氣井在路上', 'gaswell', road, null, false, 0, '交通線上不能建造'], ['天然氣井在建築上', 'gaswell', bld, null, false, 0, '已有建築'],
    ];
    for (const [name, tool, at, setup, ok, cost, why] of cases) {
      const undo = setup ? setup() : null, pv = E.previewOp(s, tap(tool, ...at)), h0 = s.city.history.length, m0 = s.money, r = pv.cells[0];
      if (!!r?.ok !== ok || (ok && (r.cost !== cost || pv.total !== cost)) || (!ok && pv.reason !== why)) bad.push(`預覽「${name}」：ok ${r?.ok}、造價 ${r?.cost}、理由 ${pv.reason}（要 ${ok ? `可以、$${cost}` : why}）`);
      if (!ok) {
        const c = E.commitOp(s, tap(tool, ...at), 0);
        if (c.ok || c.placed || s.money !== m0 || s.city.history.length !== h0 || c.reason !== why) bad.push(`蓋「${name}」：ok ${c.ok}、理由 ${c.reason}、錢 ${m0}→${s.money}、歷史 ${h0}→${s.city.history.length}（要被擋、錢與歷史不動）`);
      }
      undo?.();
    }
    {   // 錢的邊界：$4,499 蓋不了太空研究中心、$4,500 剛好；天然氣井 $1,399／$1,400
      s.money = 4499; const h0 = s.city.history.length, c0 = E.commitOp(s, tap('megaproject', cx, cz), 0);
      if (c0.ok || s.money !== 4499 || s.city.history.length !== h0) bad.push(`$4,499 蓋太空研究中心：ok ${c0.ok}、錢 ${s.money}（要被擋）`);
      s.money = 4500; const c1 = E.commitOp(s, tap('megaproject', cx, cz), 0);
      if (!c1.ok || s.money !== 0 || T(cx, cz).bld?.k !== 51) bad.push(`$4,500 蓋太空研究中心：ok ${c1.ok}、錢 ${s.money}（要剛好蓋成、錢 0）`);
      s.money = 1399; const c2 = E.commitOp(s, tap('gaswell', ...oil), 0);
      if (c2.ok || s.money !== 1399) bad.push(`$1,399 蓋天然氣井：ok ${c2.ok}（要被擋）`);
      s.money = 1400; const c3 = E.commitOp(s, tap('gaswell', ...oil), 0);
      if (!c3.ok || s.money !== 0 || T(...oil.map((v, i) => i ? v : v))?.bld?.k !== 117) bad.push(`$1,400 蓋天然氣井：ok ${c3.ok}、錢 ${s.money}（要剛好蓋成、錢 0）`);
      info.push('錢差 $1 擋下、剛好蓋成');
    }
    {   // 規則不看城市等級：Lv.11（rankIdx 10）照樣蓋得下去（解鎖是工具列的事）
      const s2 = d044Load().sim; s2.rankIdx = 0; const r = E.commitOp(s2, tap('megaproject', ...BLOCKS.B), 0);
      if (!r.ok) bad.push(`Lv.1 直接叫 commitOp 蓋太空研究中心被擋（${r.reason}）：規則不該看等級（實驗線 canPlace 沒有，解鎖只在工具列 63877）`);
    }
    log(!bad.length, 'D044 驗收 2：工具——「公共設施」18 顆、最後兩顆是天然氣井（$1,400）與太空研究中心（$4,500、3×3、城市 Lv.22 解鎖）、點的手勢、造價＝COST；拒絕理由講實驗線的字、錢與歷史不動；錢差 $1 的邊界；規則不看等級、工具鎖只在介面',
      bad.slice(0, 4).join('；') || `${cases.length} 種情形＋錢的邊界都對：${info.join('；')}；鎖：Lv.1–21 鎖、Lv.22 起開`);
  }

  // ---- 2. 預覽：3×3 ----
  {
    const bad = [], s = d044Load().sim, N = s.w.N, [x, z] = BLOCKS.B;
    const pv = E.previewOp(s, tap('megaproject', x, z));
    const foot = pv.cells.filter(c => c.foot);
    if (pv.cells.length !== 9 || foot.length !== 8 || pv.count !== 1 || pv.total !== 4500 || !pv.cells.every(c => c.ok) || pv.cells[0].x !== x || pv.cells[0].z !== z) bad.push(`3×3 預覽：${pv.cells.length} 格（附屬 ${foot.length}）、件數 ${pv.count}、總價 ${pv.total}（要 9 格、8 附屬、1 件、$4,500、全可）`);
    if (J(pv.cells.map(c => [c.x, c.z]).sort()) !== J(cellsOf(x, z).sort())) bad.push('預覽的九格不是根格往右下的 3×3');
    if (foot.some(c => c.cost !== 0)) bad.push('附屬格的造價不是 0（造價只算根格）');
    const w = E.previewOp(s, tap('gaswell', 0, 0));
    if (w.cells.length !== 1) bad.push(`天然氣井預覽 ${w.cells.length} 格（要 1）`);
    const edge = E.previewOp(s, tap('megaproject', N - 2, 5));
    if (edge.cells.length !== 6 || edge.cells.some(c => c.ok) || edge.count !== 0 || edge.reason !== '需 3×3 陸地') bad.push(`邊界預覽：${edge.cells.length} 格（要裁成 6 格、全不可）、理由 ${edge.reason}`);
    const h0 = s.city.history.length, m0 = s.money; E.previewOp(s, tap('megaproject', x, z));
    if (s.city.history.length !== h0 || s.money !== m0) bad.push('預覽改了歷史或資金');
    log(!bad.length, 'D044 驗收 3：太空研究中心預覽整塊 3×3（根格往右下、九格同一個 ok、造價只算根格、一件）、擠出地圖邊界的裁成範圍內的格子且全不可、預覽不改任何東西；天然氣井一格',
      bad.slice(0, 3).join('；') || `九格＝根格往右下的 3×3、總價 $4,500；邊界 (${N - 2},5) 裁成 6 格全不可`);
  }

  // ---- 3. 玩家蓋、重播、復原、拆、存讀 ----
  const P = d044Built(), s = P.sim, N = s.w.N, h = s.city.history;
  const T = (x, z) => s.w.tiles[z * N + x];
  {
    const bad = [], places = h.filter(e => e.t === 'place' && (e.k === 117 || e.k === 51)), gas = places.filter(e => e.k === 117), mega = places.filter(e => e.k === 51);
    if (gas.length !== 3 || mega.length !== 2) bad.push(`place 事件 天然氣井 ${gas.length}／太空研究中心 ${mega.length}（要 3／2）`);
    for (const e of gas) if (e.cost !== 1400 && e.cost !== 1402) bad.push(`天然氣井 (${e.x},${e.z}) 造價 ${e.cost}（要 1400，樹上加 2）`);
    for (const e of mega) { const want = e.x === 30 ? 4502 : 4500; if (e.cost !== want) bad.push(`太空研究中心 (${e.x},${e.z}) 造價 ${e.cost}（要 ${want}：A 塊根格上有樹加 2）`); }
    // 一次手勢一筆事件：每座太空研究中心那一筆手勢（g）只有一個 place，沒有附屬格的 zone／doze 事件
    for (const e of mega) { const same = h.filter(q => q.g === e.g); if (same.length !== 1) bad.push(`太空研究中心 (${e.x},${e.z}) 那筆手勢有 ${same.length} 個事件：${J(same.map(q => q.t + (q.layer ? ':' + q.layer : '')))}（要只有一個 place）`); }
    const spent = places.reduce((a, e) => a + e.cost, 0), m0 = 1e6;
    if (m0 - s.money !== spent) bad.push(`扣款 ${m0 - s.money} ≠ 歷史造價總和 ${spent}`);
    for (const e of mega) {
      const root = T(e.x, e.z).bld, cb = s.city.buildings[e.id - 1];
      if (!root || root.k !== 51 || root.sz !== 3 || !root.pw || root.lv !== 1 || root.v !== 0 || root.age !== 0) bad.push(`(${e.x},${e.z}) 根格 ${J(root)}`);
      if (cb.size !== 3 || cb.k !== 51) bad.push(`(${e.x},${e.z}) 城市模型的建築 ${J(cb)}（要 size 3、k 51）`);
      for (const [cx, cz] of cellsOf(e.x, e.z)) {
        const t = T(cx, cz), i = cz * N + cx, isRoot = cx === e.x && cz === e.z;
        if (!isRoot && J(t.bld) !== J({ k: 51, ref: [e.x, e.z] })) bad.push(`(${cx},${cz}) 附屬格 ${J(t.bld)}（要指向根 [${e.x},${e.z}]）`);
        if (t.zone || t.tree || t.deco) bad.push(`(${cx},${cz}) 還有分區／樹／裝飾 ${t.zone}/${t.tree}/${t.deco}`);
        if (s.city.zone[i] || s.city.tree[i]) bad.push(`(${cx},${cz}) 城市模型的分區／樹沒清：${s.city.zone[i]}/${s.city.tree[i]}`);
        if (s.city.occ[i] !== e.id) bad.push(`(${cx},${cz}) occ ${s.city.occ[i]}（要 ${e.id}）`);
      }
    }
    // 跟 A 塊本來有的比：分區 4 格、樹 4 棵都清掉了（驗證有東西可清）
    const base = loadCode(baseCode, KT, vrank).sim; let z0 = 0, t0 = 0; for (const [cx, cz] of cellsOf(...BLOCKS.A)) { const t = base.w.tiles[cz * N + cx]; if (t.zone) z0++; if (t.tree) t0++; }
    if (z0 < 3 || t0 < 3) bad.push(`A 塊本來的分區 ${z0} 格、樹 ${t0} 棵（試驗田要壓在分區與樹上）`);
    log(!bad.length, 'D044 驗收 4：玩家蓋——天然氣井 3 口、太空研究中心 2 座（A 塊壓在 3 格分區、4 棵樹上）：一座一筆 place（沒有附屬格的 zone／doze 事件）、造價（樹上加 2）、占地九格 occ＝這棟、整塊清樹清分區裝飾、根格 sz 3 其餘九格指向根、扣款＝造價總和',
      bad.slice(0, 4).join('；') || `place ${places.length} 筆（天然氣井 ${gas.length}、太空研究中心 ${mega.length}）、扣 $${spent}；A 塊本來的分區 ${z0} 格、樹 ${t0} 棵全清`);
  }
  {   // 重播＝模擬
    const bad = [], c0 = replayCity(baseCode, h, KT);
    if (digest(c0) !== digest(s.city)) {
      const a = JSON.parse(digest(c0)), b = JSON.parse(digest(s.city)), k = Object.keys(a).filter(q => J(a[q]) !== J(b[q]));
      bad.push(`重播出來的城 ≠ 模擬的城：${k.join('、')}`);
    }
    log(!bad.length, 'D044 驗收 4：重播（replayCity：匯入＋歷史 11 筆事件）＝模擬的城（路、分區、樹、占用、水管、焦土、每一棟的種類位置大小）——整塊 3×3 的清樹清分區在重播裡也成立',
      bad.join('；') || `${h.length} 筆事件重播相同（${s.city.buildings.length} 棟）`);
  }
  {   // 復原（整塊還原、退全額）、拆
    const bad = [], info = [], L = d044Load(), q = L.sim, m0 = q.money;
    const tj = i => { const t = JSON.parse(J(q.w.tiles[i])); delete t.wr; return J(t); };   // wr（有沒有水）是供水網每次重算寫的執行期欄位，不算格子的樣子
    const before = Array.from({ length: N * N }, (_, i) => tj(i));
    const [ax, az] = BLOCKS.A, r = E.commitOp(q, tap('megaproject', ax, az), 0);
    if (!r.ok) throw new Error('復原試驗：A 塊蓋不下 ' + r.reason);
    const cost = m0 - q.money, u = E.undoOp(q);
    if (!u.ok || q.money !== m0 || u.refund !== cost) bad.push(`復原：ok ${u.ok}、退 ${u.refund}（要 ${cost}）、錢 ${m0}→${q.money}`);
    for (const [cx, cz] of cellsOf(ax, az)) if (tj(cz * N + cx) !== before[cz * N + cx]) bad.push(`復原後 (${cx},${cz}) 沒回到蓋之前：${tj(cz * N + cx)}｜${before[cz * N + cx]}`);
    for (const [cx, cz] of cellsOf(ax, az)) { const i = cz * N + cx; if (q.city.occ[i] !== 0 || q.city.zone[i] !== (before[i].includes('"zone":1') ? 1 : 0)) bad.push(`復原後 (${cx},${cz}) 城市模型 occ ${q.city.occ[i]}、zone ${q.city.zone[i]}`); }
    if (q.city.history.at(-1).t !== 'undo') bad.push('復原沒記 undo 事件');
    if (digest(replayCity(baseCode, q.city.history, KT)) !== digest(q.city)) bad.push('復原後重播 ≠ 模擬');
    info.push(`復原退 $${u.refund}、九格逐格 JSON 回到蓋之前（含 ${[...cellsOf(ax, az)].filter(([cx, cz]) => before[cz * N + cx].includes('"tree"')).length} 格樹）`);
    // 再蓋一次，然後點「附屬格」拆：整棟拆掉（一筆 doze bld、九格清空）
    E.commitOp(q, tap('megaproject', ax, az), 0);
    const dz = E.commitOp(q, { k: 'tap', tool: 'doze', x0: ax + 2, z0: az + 1, x1: ax + 2, z1: az + 1 }, 0);
    const dozes = q.city.history.filter(e => e.t === 'doze' && e.layer === 'bld' && e.k === 51);
    if (!dz.ok || dozes.length !== 1) bad.push(`點附屬格拆：ok ${dz.ok}、doze 事件 ${dozes.length}（要 1）`);
    for (const [cx, cz] of cellsOf(ax, az)) if (q.w.tiles[cz * N + cx].bld) bad.push(`拆完 (${cx},${cz}) 還有建築 ${J(q.w.tiles[cz * N + cx].bld)}`);
    if (digest(replayCity(baseCode, q.city.history, KT)) !== digest(q.city)) bad.push('拆完重播 ≠ 模擬');
    info.push('點附屬格拆＝整棟拆、一筆 doze');
    log(!bad.length, 'D044 驗收 4：復原整塊還原（九格逐格 JSON、含分區與樹，退全額、記 undo、重播相同）；點附屬格拆＝整棟拆（一筆 doze bld k51、九格清空、重播相同）', bad.slice(0, 4).join('；') || info.join('；'));
  }
  {   // 存→讀→再存
    const bad = [], code = saveCode(s, P.template, P.start), raw = decodeLabCode(code).save.raw;
    if (!(raw.d3?.f >= 4 && raw.d3.f <= 8)) bad.push(`存出格式 ${raw.d3?.f}（蓋這兩種只是 place 事件，不該升格式）`);
    const L1 = loadCode(code, KT, vrank);
    if (!L1.ok || !L1.replayed) bad.push(`讀回來 ok ${L1.ok} replayed ${L1.replayed}（${L1.note}）`);
    else {
      const q = L1.sim;
      if (J(strip(q.city.history)) !== J(strip(h))) bad.push('讀回來的歷史跟存之前不同');
      const shape = b => b ? J({ k: b.k, sz: b.sz ?? null, ref: b.ref ?? null }) : 'null';   // 種類、占地大小、指向根的座標（h、fire 是每天的狀態，讀檔另有預設）
      for (let i = 0; i < N * N; i++) { const a = T(i % N, (i / N) | 0).bld, b = q.w.tiles[i].bld; if (shape(a) !== shape(b)) { bad.push(`(${i % N},${(i / N) | 0}) 格子 ${J(a)}｜${J(b)}`); break; } }
      if (!same(Array.from(s.g.POLBASE), Array.from(q.g.POLBASE)) || !same(Array.from(s.g.POL), Array.from(q.g.POL))) bad.push('讀回來的污染場 ≠ 存之前');
      const code2 = saveCode(q, L1.template, L1.start), L2 = loadCode(code2, KT, vrank);
      if (!L2.ok || J(strip(L2.sim.city.history)) !== J(strip(h))) bad.push('存→讀→再存→讀 的歷史不同');
    }
    log(!bad.length, 'D044 驗收 4：存→讀→再存→讀：歷史相同、每格的建築（含根格 sz 與附屬格 ref）相同、污染場相同、不升格式（place 事件本來就有）', bad.slice(0, 3).join('；') || `格式 ${raw.d3.f}、${h.length} 筆歷史相同`);
  }

  // ---- 4. 污染源 ----
  {
    const bad = [], info = [], L = d044Load(), q = L.sim, snap = () => [Array.from(q.g.POLBASE), Array.from(q.g.POL)];
    const [b0, p0] = snap(), oil = (() => { for (let i = 0; i < N * N; i++) { const t = q.w.tiles[i]; if (q.res.resource[i] === 1 && !t.road && !t.bld && !t.tree && (t.t === 1 || t.t === 2)) return [i % N, (i / N) | 0]; } })();
    E.commitOp(q, tap('gaswell', ...oil), 0);
    const [b1, p1] = snap(), at = oil[1] * N + oil[0], rise = b1[at] - b0[at];
    if (rise !== 22) bad.push(`天然氣井中心的污染 +${rise}（POL_SRC 117 的強度要 22）`);
    const changed = b1.reduce((a, v, i) => a + (v !== b0[i] ? 1 : 0), 0);
    if (changed < 9 || !p1.some((v, i) => v !== p0[i])) bad.push(`天然氣井只動了 ${changed} 格污染（半徑 4 的方框）`);
    E.undoOp(q); const [b2, p2] = snap();
    if (!same(b2, b0) || !same(p2, p0)) bad.push('復原後污染場沒回到蓋之前');
    E.commitOp(q, tap('megaproject', ...BLOCKS.B), 0); const [b3] = snap();
    if (!same(b3, b0)) bad.push('太空研究中心動了污染場（它不是污染源）');
    info.push(`天然氣井：中心 +${rise}、動 ${changed} 格；復原回原樣；太空研究中心不動污染`);
    log(!bad.length, 'D044 驗收 5：污染源——天然氣井蓋下去污染場中心 +22（POL_SRC 117）、復原回到蓋之前；太空研究中心不是污染源', bad.join('；') || info.join('；'));
  }

  // ---- 5. 等價與每 24 天一輪 ----
  {
    const bad = [], info = [], Pb = d044Built(1e6, ['B']), sp = Pb.sim, Bd = loadCode(d044AsBuilder(Pb.put), KT, vrank);
    if (!Bd.ok) throw new Error('builder 的城讀不進 ' + Bd.error);
    const sb = Bd.sim; sb.money = sp.money; sp.econ.supplies = 2000; sb.econ.supplies = 2000;
    if (!same(Array.from(sp.g.POLBASE), Array.from(sb.g.POLBASE)) || !same(Array.from(sp.g.POL), Array.from(sb.g.POL)) || !same(Array.from(sp.g.POLTREE), Array.from(sb.g.POLTREE))) bad.push('玩家蓋的污染場（POLBASE／POL／POLTREE）≠ 存檔裡本來就有的');
    const rewards = [], used = []; let cons0 = [0, 0];
    for (let d = 0; d < 30; d++) {
      const a = JSON.parse(J(realDay.stepDay(sp))), b = JSON.parse(J(realDay.stepDay(sb)));
      if (d === 0) cons0 = [a.econ.ec.activeConstruction482, b.econ.ec.activeConstruction482];
      delete a.econ.ec.activeConstruction482; delete b.econ.ec.activeConstruction482;
      for (const r of [a, b]) for (const e of r.hazard?.events ?? []) delete e.id;   // 建築編號：玩家蓋的排在最後、存檔裡的照座標排，編號不同，不是模擬的差別   // 新蓋的在施工（4 棟），存檔裡本來就有的是完工的：只有這一欄不同
      if (J(a) !== J(b)) { const k = Object.keys(a).filter(q => J(a[q]) !== J(b[q])); bad.push(`第 ${sp.day} 天報告不同：${k.join('、')}`); break; }
      if (a.econ.ec.mgReward) { rewards.push([sp.day, a.econ.ec.mgReward]); used.push(a.econ.ec.megaSupplyUsed482); }
    }
    if (cons0[0] !== 4 || cons0[1] !== 0) bad.push(`第 1 天施工中棟數 玩家蓋 ${cons0[0]}／存檔 ${cons0[1]}（要 4／0：3 口井＋1 座在施工）`);
    if (sp.money !== sb.money) bad.push(`30 天後資金 ${sp.money} ≠ ${sb.money}`);
    if (rewards.length !== 1 || rewards[0][1] !== 3500 || rewards[0][0] % 24 !== 0 || used[0] !== 180) bad.push(`太空研究中心的一輪：${J(rewards)}、供應品 ${J(used)}（30 天內要有 1 輪、日子是 24 的倍數、一座 $3,500、供應品 180）`);
    info.push(`30 天每天的報告逐欄相同（除施工中棟數 ${cons0[0]}／${cons0[1]}）、污染場相同、資金 ${Math.round(sp.money)}；第 ${rewards[0]?.[0]} 天一輪 $${rewards[0]?.[1]}、供應品 −${used[0]}`);
    log(!bad.length, 'D044 驗收 5：等價——同一批東西用 2D 存檔的寫法擺進去（不走玩家的工具）推 30 天，每天的報告逐欄相同（只有新蓋的「施工中棟數」不同）、污染場逐格相同；太空研究中心每 24 天一輪（一座 $3,500、花供應品 180，九格只算一座）', bad.slice(0, 3).join('；') || info.join('；'));
  }

  // ---- 6. 接線突變 ----
  {
    const bad = [], out = [];
    const probe = (EE, RR = null) => {   // 在一座新的城上蓋 A 塊：回傳這一筆手勢的事件、預覽的格數、工具鎖
      const L = d044Load(), q = L.sim, [ax, az] = BLOCKS.A, r = EE.commitOp(q, tap('megaproject', ax, az), 0);
      const ev = q.city.history.filter(e => e.g === r.g);
      const pv = EE.previewOp(q, tap('megaproject', ...BLOCKS.B));
      q.rankIdx = 0;
      const lock = EE.toolLock(q, 'megaproject');
      let rp = true; try { rp = digest((RR ?? { replayCity }).replayCity(baseCode, q.city.history, KT)) === digest(q.city); } catch { rp = false; }
      return { events: ev.length, cells: pv.cells.length, lock, size: EE.toolSize('megaproject'), replay: rp };
    };
    const good = probe(E);
    if (good.events !== 1 || good.cells !== 9 || !good.lock || good.size !== 3 || !good.replay) bad.push(`沒改的版本就不對：${J(good)}`);
    const edits = [
      ['附屬格也記事件（拿掉 syncEdit 的略過）', 'src/sim/edit.ts', [["    if (!hasRoot && b.bld?.ref && !a.bld) continue;", '']], r => r.events !== 1],
      ['預覽不畫整塊（sz 永遠 1）', 'src/sim/edit.ts', [["const sz = op.k === 'tap' ? toolSize(op.tool) : 1;", "const sz = 1;"]], r => r.cells !== 9],
      ['工具鎖拿掉', 'src/sim/edit.ts', [["return t?.unlockRank && s.rankIdx + 1 < t.unlockRank ?", "return false ?"]], r => !r.lock],
      ['占地大小寫死 1', 'src/sim/edit.ts', [["export const toolSize = (id: string) => FACILITY_TOOLS.find(c => c.id === id)?.size ?? 1;", "export const toolSize = (id: string) => 1;"]], r => r.size !== 3 || r.cells !== 9],
    ];
    for (const [name, file, ed, caught] of edits) {
      try { const M = await loadMod(file, ed, { './rules/build.ts': await import('../src/sim/rules/build.ts') }), r = probe(M); if (caught(r)) out.push(name); else bad.push(`突變「${name}」沒抓到：${J(r)}`); }
      catch (e) { bad.push(`突變「${name}」：${String(e.message).slice(0, 140)}`); }
    }
    try {   // replay.ts：只清根格的樹與分區
      const RM = await loadMod('src/sim/replay.ts', [["footprint(b, j => { c.tree[j] = 0; c.zone[j] = 0; });", "c.tree[i] = 0; c.zone[i] = 0;"]]), r = probe(E, RM);
      if (!r.replay) out.push('重播只清根格'); else bad.push('突變「重播只清根格」沒抓到');
    } catch (e) { bad.push(`突變「重播只清根格」：${String(e.message).slice(0, 140)}`); }
    log(!bad.length, 'D044 驗收 7：接線突變——edit.ts 的副本改壞一處（附屬格也記事件、預覽不畫整塊、工具鎖拿掉、占地大小寫死 1）、replay.ts 只清根格，都要被抓到（沒改的版本要全對）', bad.slice(0, 3).join('；') || `${out.length} 個突變都抓到：${out.join('、')}`);
  }
}

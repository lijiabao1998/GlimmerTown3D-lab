// 施工（D011）：把介面的手勢（點、拉線、框選）接到實驗線的放置規則（src/sim/rules/build.ts，逐項對拍），
// 施工完同步城市模型、記世界歷史（每一格一筆，規則 4），同一天之內可以一筆一筆復原（T460，實驗線可以隔天，本線不照搬）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；拆除確認的「3 秒內再按一次」用呼叫端給的 now。
import { canPlace, placeCost, roadDraftTiles, roadToolToRc, commitLine, commitRect, tap, undoTxn, pushTxn, ROAD_COST, COST, type BuildState, type Txn } from './rules/build.ts';
import { computePower, powerCap } from './rules/power.ts';
import { season } from './rules/weather.ts';
import { roadCode, type CityBuilding, type EditEvent } from './city.ts';
import type { Sim } from './day.ts';
import type { Tile } from './rules/lab.ts';

// 路的五級：名稱照實驗線工具列（TOOLS 37547–37552），造價 ROAD_COST（37428）
export const ROAD_TOOLS = [
  { id: 'alley', name: '小巷', cost: ROAD_COST[0] }, { id: 'road', name: '支路', cost: ROAD_COST[1] }, { id: 'coll', name: '次幹道', cost: ROAD_COST[2] },
  { id: 'art', name: '主幹道', cost: ROAD_COST[3] }, { id: 'hwy', name: '快速路', cost: ROAD_COST[4] },
];
export const TOOL_PRICE = { zr: COST.zone, zc: COST.zone, zi: COST.zone, plant: COST.plant, police: COST.police, doze: COST.doze };
const ZONE_OF: Record<string, number> = { zr: 1, zc: 2, zi: 3 };

// 介面的按鈕 → 實驗線的工具代號（規則 9：按鈕寫進資料的東西照實驗線）
export const labToolOf = (ui: string, roadTool: string) => ui === 'road' ? roadTool : ui;
// 實驗線觸控的手勢（T436）：路是線、分區與拆除是框、建築是點
export const gestureOf = (tool: string): 'line' | 'rect' | 'tap' => roadToolToRc(tool) ? 'line' : (tool in ZONE_OF || tool === 'doze') ? 'rect' : 'tap';

export interface EditOp { k: 'tap' | 'line' | 'rect'; tool: string; x0: number; z0: number; x1: number; z1: number }
export interface OpPreview { cells: { x: number; z: number; ok: boolean; cost: number }[]; count: number; total: number; affordable: boolean; reason?: string }
// armed＋arm：單格拆二級以上的第一次（只預備，實驗線提示「⚠️ 再點一次確認拆除 Lv2 住宅」62987）；skipped：框選拆除略過的二級以上棟數（實驗線 63004 另有提示）
export interface EditResult { ok: boolean; placed: number; spent: number; events: EditEvent[]; reason?: string; armed?: boolean; arm?: { k: number; lv: number }; skipped?: number; g?: number }
interface DayTxn { g: number; txn: Txn; created: number[]; removed: number[] }

function stateOf(s: Sim): BuildState {
  return { w: s.w, g: s.g, budget: s.budget, rng: s.rng, money: s.money, diff: s.diff, tech: s.edu.tech, spec: s.edu.spec,
    landDirty: s.landDirty, landBox: s.landBox, txn: null, dozeArm: s.dozeArm, onPower: () => { /* 供電每天開頭整張重算（day.ts 55008）；介面要看就叫 powerStatus */ } };
}
function writeBack(s: Sim, st: BuildState) { s.money = st.money; s.landDirty = st.landDirty; s.landBox = st.landBox; s.dozeArm = st.dozeArm; }

// 手勢會碰到的格（照實驗線的順序：線＝L 形先 x 後 y；框＝從左上角逐列；點＝那一格）
function cellsOf(op: EditOp): [number, number][] {
  if (op.k === 'tap') return [[op.x0, op.z0]];
  if (op.k === 'line') return roadDraftTiles(op.x0, op.z0, op.x1, op.z1);
  const out: [number, number][] = [], x0 = Math.min(op.x0, op.x1), x1 = Math.max(op.x0, op.x1), z0 = Math.min(op.z0, op.z1), z1 = Math.max(op.z0, op.z1);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) out.push([x, z]);
  return out;
}
const inMap = (s: Sim, x: number, z: number) => x >= 0 && z >= 0 && x < s.w.N && z < s.w.N;
const hiBld = (t: Tile) => !!(t.bld && !t.bld.ref && t.bld.k <= 3 && t.bld.lv >= 2);   // 二級以上的住商工（框選拆除略過、單格要確認，62983）

// 預覽：不改任何狀態，只問規則「這一格能不能蓋、要多少錢」
export function previewOp(s: Sim, op: EditOp): OpPreview {
  const st = stateOf(s), cells: OpPreview['cells'] = [], multi = op.k === 'rect' && (op.x0 !== op.x1 || op.z0 !== op.z1);
  let total = 0, count = 0, reason: string | undefined;
  for (const [x, z] of cellsOf(op)) {
    if (!inMap(s, x, z)) continue;
    const t = s.w.tiles[z * s.w.N + x];
    let r = canPlace(st, op.tool, x, z);
    if (!r && op.tool in ZONE_OF && t.zone === ZONE_OF[op.tool] && !t.tree) r = '已經是這一區';   // 51664：同類重劃不動
    if (!r && op.tool === 'doze' && multi && hiBld(t)) r = '二級以上的建築要單獨拆';
    const cost = r ? 0 : placeCost(st, op.tool, x, z);
    if (!r) { total += cost; count++; } else reason ??= r;
    cells.push({ x, z, ok: !r, cost });
  }
  return { cells, count, total, affordable: total <= s.money || s.diff === 3, reason: count ? undefined : reason };
}

// 提交：照實驗線的手勢函式蓋（build.ts），再把這一筆交易碰過的格子逐格比對前後，記事件、同步城市模型
export function commitOp(s: Sim, op: EditOp, now: number): EditResult {
  const pv = previewOp(s, op), st = stateOf(s), m0 = s.money, costs = new Map<number, number>();
  for (const c of pv.cells) if (c.ok) costs.set(c.z * s.w.N + c.x, c.cost);   // 每格的造價只看那一格（施工前先記；插入順序＝施工順序）
  let placed = 0, refused: string | undefined, txn: Txn | null = null, arm: { k: number; lv: number } | undefined, skipped = 0;
  if (op.k === 'tap') { const r = tap(st, op.tool, op.x0, op.z0); placed = r.ok ? 1 : 0; txn = r.txn; }
  else if (op.k === 'line') { const r = commitLine(st, op.tool, op.x0, op.z0, op.x1, op.z1); placed = r.built.filter(Boolean).length; txn = r.txn; }
  else { const r = commitRect(st, op.tool, op.x0, op.z0, op.x1, op.z1, now); placed = r.placed; txn = r.txn; refused = r.refused; arm = r.arm; skipped = r.skipped; }
  writeBack(s, st);
  // 這一筆就是「單格拆二級以上、第一次按」：實驗線只預備這一格（62983），3 秒內再按一次才拆
  const armed = !!arm;
  // 沒蓋成的理由：框選的總價不夠（實驗線自己的字）→ 每一格都不能蓋（第一個理由）→ 能蓋但錢不夠
  const reason = placed || armed ? undefined : refused ?? (pv.count ? '錢不夠' : pv.reason ?? '這裡不能蓋');
  if (!txn) return { ok: placed > 0, placed, spent: m0 - s.money, events: [], reason, armed, arm, skipped };
  const g = s.stroke++, dt: DayTxn = { g, txn, created: [], removed: [] };
  const events = syncEdit(s, txn, costs, g, dt);
  pushTxn(s.txns as DayTxn[], dt);                                     // 復原堆疊最多 40 筆，多了丟最舊的（實驗線 62731）
  markStaleAround(s, txn);
  return { ok: placed > 0, placed, spent: m0 - s.money, events, reason, armed, arm, skipped, g };
}

// 本線的逐格地價標記（day.ts Sim.stale）：施工改了覆蓋、污染的那一帶要標「待重算」。
// 範圍取實驗線 doPlace 自己標的髒框半徑 20（51627），涵蓋本卡工具的蓋印半徑（警察 10、電廠污染 6、樹 2；守衛核對）。
// 多標只是隔天多算幾格（輸入沒變的格算出來一樣），少標才會錯，所以取碰過的格的外框再往外 20。
export const EDIT_STALE_R = 20;
function markStaleAround(s: Sim, txn: Txn) {
  if (!txn.snaps.length) return;
  const n = s.w.N;
  let x0 = n, z0 = n, x1 = -1, z1 = -1;
  for (const { i } of txn.snaps) { const x = i % n, z = (i / n) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  const R = EDIT_STALE_R, a = Math.max(0, x0 - R), b = Math.min(n - 1, x1 + R);
  for (let z = Math.max(0, z0 - R); z <= Math.min(n - 1, z1 + R); z++) s.stale.fill(1, z * n + a, z * n + b + 1);
}

// 這一筆交易碰過的格子：前（快照）後（現在）比對 → 事件；同時把城市模型（路、等級、分區、樹、建築、occ）跟上
function syncEdit(s: Sim, txn: Txn, costs: Map<number, number>, g: number, dt: DayTxn): EditEvent[] {
  const c = s.city, n = c.n, day = s.day, out: EditEvent[] = [];
  for (const sn of txn.snaps) {
    const i = sn.i, x = i % n, z = (i / n) | 0, a = JSON.parse(sn.s) as Tile, b = s.w.tiles[i], cost = costs.get(i) ?? 0;
    const hadRoot = !!(a.bld && !a.bld.ref), hasRoot = !!(b.bld && !b.bld.ref);
    c.road[i] = roadCode(b.road, b.hw, b.bridge); c.rclass[i] = b.road ? (b.rc || 0) : 0; c.zone[i] = b.zone || 0; c.tree[i] = b.tree || 0;
    if (hasRoot && (!hadRoot || a.bld!.k !== b.bld!.k)) {             // 放了建築（51672／51687）
      const cb: CityBuilding = { id: c.buildings.length + 1, k: b.bld!.k, lv: b.bld!.lv, v: b.bld!.v, age: b.bld!.age, x, z, size: s.kinds.size(b.bld!.k), abandoned: false, builtDay: day };
      c.buildings.push(cb); s.root.set(i, cb); dt.created.push(cb.id);
      for (let dz = 0; dz < cb.size; dz++) for (let dx = 0; dx < cb.size; dx++) if (x + dx < n && z + dz < n) c.occ[(z + dz) * n + x + dx] = cb.id;
      out.push({ day, t: 'place', x, z, k: cb.k, lv: cb.lv, v: cb.v, id: cb.id, cost, g });
    } else if (hadRoot && !hasRoot) {                                  // 拆了建築（51779–51798；分區留著）
      const cb = s.root.get(i);
      if (cb) {
        cb.goneDay = day; s.root.delete(i); dt.removed.push(cb.id);
        for (let dz = 0; dz < cb.size; dz++) for (let dx = 0; dx < cb.size; dx++) { const j = (z + dz) * n + x + dx; if (x + dx < n && z + dz < n && c.occ[j] === cb.id) c.occ[j] = 0; }
        // 多格建築可能是點附屬格拆掉的：錢是手勢裡第一個碰到它的格付的（框選逐列，根格在左上角，碰得到就一定最先）
        let paid = cost;
        if (!costs.has(i)) for (const [j, v] of costs) { const jx = j % n, jz = (j / n) | 0; if (jx >= x && jx < x + cb.size && jz >= z && jz < z + cb.size) { paid = v; break; } }
        out.push({ day, t: 'doze', x, z, layer: 'bld', k: cb.k, id: cb.id, cost: paid, g });
      }
    } else if (b.road && (!a.road || a.rc !== b.rc)) out.push({ day, t: 'road', x, z, rc: b.rc || 0, cost, g });   // 鋪路、升級（51645）
    else if (a.road && !b.road) out.push({ day, t: 'doze', x, z, layer: 'road', cost, g });                          // 51808
    else if ((b.zone || 0) !== (a.zone || 0)) out.push(b.zone ? { day, t: 'zone', x, z, zone: b.zone, cost, g } : { day, t: 'doze', x, z, layer: 'zone', cost, g });   // 51665／51811
    else if (a.tree && !b.tree) out.push({ day, t: 'doze', x, z, layer: 'tree', cost, g });                         // 只砍了樹
  }
  c.history.push(...out);
  return out;
}

export const canUndo = (s: Sim) => s.txns.length > 0;

// 復原今天最後一筆（T460 undo 66594：整格還原、全額退錢、重算覆蓋；亂數不倒回）。歷史只增不改：記一筆 undo 事件
export function undoOp(s: Sim): { ok: boolean; refund: number } {
  const dt = s.txns.pop() as DayTxn | undefined;
  if (!dt) return { ok: false, refund: 0 };
  const st = stateOf(s), m0 = s.money;
  undoTxn(st, dt.txn, s.edu);
  writeBack(s, st);
  s.stale.fill(0);                                                     // rebuildCov 整張重算過地價基準（53154）
  const c = s.city, n = c.n;
  for (const id of dt.created) { const cb = c.buildings[id - 1]; cb.goneDay = s.day; s.root.delete(cb.z * n + cb.x); }
  for (const id of dt.removed) { const cb = c.buildings[id - 1]; delete cb.goneDay; s.root.set(cb.z * n + cb.x, cb); }
  for (const sn of dt.txn.snaps) {
    const i = sn.i, b = s.w.tiles[i];
    c.road[i] = roadCode(b.road, b.hw, b.bridge); c.rclass[i] = b.road ? (b.rc || 0) : 0; c.zone[i] = b.zone || 0; c.tree[i] = b.tree || 0; c.occ[i] = 0;
  }
  for (const [i, cb] of s.root) for (let dz = 0; dz < cb.size; dz++) for (let dx = 0; dx < cb.size; dx++) { const j = (cb.z + dz) * n + cb.x + dx; if (cb.x + dx < n && cb.z + dz < n && dt.txn.snaps.some(q => q.i === j)) c.occ[j] = cb.id; void i; }
  const refund = s.money - m0;
  c.history.push({ day: s.day, t: 'undo', g: dt.g, refund });
  return { ok: true, refund };
}

// 電：容量（燃煤電廠 75 棟起，52473；季節係數 55008）與有電、沒電的住商工棟數（昨天的分配，55154–55156）
export function powerStatus(s: Sim) {
  const cap = powerCap(computePower(s.w).cap, season(s.day));
  let powered = 0, unpowered = 0;
  for (const cb of s.root.values()) if (cb.k <= 3) { const b = s.w.tiles[cb.z * s.w.N + cb.x].bld; if (b?.pw) powered++; else unpowered++; }
  return { cap, powered, unpowered };
}

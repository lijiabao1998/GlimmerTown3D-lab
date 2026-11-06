// D101：運輸施工接進世界歷史（城市格式 12、事件 26；卡 docs/D101-transit-save-and-ui.md）。純函式與純資料：
// 不碰 DOM、儲存、現實時間、亂數，也不 import 任何繪製（CLAUDE.md 規則 2、3）。路網的規則、費用、佔地全在 network.ts（D100，釘住不改）。
//   transitTerrain：把城市的地形交給 network.ts——高度＝高地 el（布林，cityScene 也這樣畫）、水面＝ter 0、佔用一律是布林
//     （graph.ts 用 typeof 檢查，給數字會把每一條軌道都判成「地形無效」）。地圖外的格子算佔用。
//   transitEventOf：施工成功後要記的那一筆事件（鍵序＝讀檔 eventOf 組回來的順序，再存檔逐位元組相同）；transitShapeError 是讀檔的形狀檢查，兩邊共用同一份規則。
//   restoreTransit：復原（edit 的 undo）——三個陣列回到施工前、nextId 不倒退、revision +1、鍵序同 createNetwork。
//   transitReplay／applyTransitEvent／undoTransitStroke／replayedNetwork：重播。
//     逐筆呼叫 network.ts 會每一筆重驗、重抄整張網（4000 條約 8 秒，O(N²)，牴觸規則 5）。這裡每一筆照樣交給 network.ts 的同一支函式判斷，
//     但只給它「這一筆判斷時看得到的那幾件」：同一條軌道（重複）、壓在同一格的站廠（重疊）、端點落在站廠裡的軌道（拆站廠前要先拆）；
//     軌道總數上限（graph.ts 的 8192，沒有匯出）另外數。判斷通過的那一件直接接到有索引的陣列上，拆掉的只標記，最後照原順序收成路網。
//     每一筆 O(1)，整份 O(N)；跟逐筆呼叫 network.ts（加上 restoreTransit 復原）的結果逐位元組相同，由 tools/d101-save.mjs 的隨機差分驗。
//     復原只能是「最後一筆還沒復原的運輸手勢」：施工的復原堆疊是後進先出（edit 的 txns），別的順序只會來自改壞的歷史，照實丟例外。
import { buildDepot, buildStation, buildTrack, createNetwork, removeDepot, removeEdge, removeStation, DEPOT_H, DEPOT_W, STATION_H, STATION_W } from './network.ts';
import type { NetworkEdge, TransitDepot, TransitNetwork, TransitStation } from './network.ts';
import type { TransitCell, TransitMode, TransitTerrain } from './graph.ts';
import { TRANSIT_MODES, TRANSIT_OPS } from '../city.ts';
import type { City, TransitEvent, TransitOp } from '../city.ts';

const MAX_EDGES = 8192;   // graph.ts:10（沒有匯出）：previewTrack 在軌道數 ≥ 8192 時回「網路已滿」
const MAX_MONEY = Number.MAX_SAFE_INTEGER;
const OUTSIDE: TransitCell = Object.freeze({ elevation: 0, water: false, occupied: true });

// live＝true：佔用照城市現在的樣子算（施工用）；false：不看佔用（重播用：佔用是施工那一刻的條件，不是路網的結構）。高度與水面兩種都照算
export function transitTerrain(c: City, live: boolean): TransitTerrain {
  const n = c.n;
  return {
    size: n,
    cell(x: number, z: number): TransitCell {
      if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || z < 0 || x >= n || z >= n) return OUTSIDE;
      const i = z * n + x;
      const occupied = live && (c.occ[i] !== 0 || c.road[i] !== 0 || c.zone[i] !== 0 || c.ruin[i] !== 0 || c.tree[i] !== 0
        || c.rail[i] !== 0 || c.railBridge[i] !== 0 || c.tram[i] !== 0 || c.dock[i] !== 0 || c.fly[i] !== 0);
      return { elevation: c.el[i] ? 1 : 0, water: c.ter[i] === 0, occupied };
    },
  };
}

type Kind = 'edge' | 'station' | 'depot';
type Item = NetworkEdge | TransitStation | TransitDepot;
const kindOf = (op: TransitOp): Kind => op === 'edge' || op === 'del-edge' ? 'edge' : op === 'station' || op === 'del-station' ? 'station' : 'depot';
const spanOf = (kind: Kind): [number, number] => kind === 'station' ? [STATION_W, STATION_H] : kind === 'depot' ? [DEPOT_W, DEPOT_H] : [0, 0];

// 事件的形狀（讀檔先驗，重播再交給 network.ts 驗地形）：軌道兩端相鄰、依 z 再 x 排序；車站 2×1、車廠 3×2（對角＝起點＋寬高−1）、h＝h2；
// 地鐵高度 −1，地面 ≥ 0、兩端高度差 ≤ 1。回傳 null＝形狀對
export function transitShapeError(op: TransitOp, mode: TransitMode, x: number, z: number, h: number, x2: number, z2: number, h2: number): string | null {
  const kind = kindOf(op);
  if (kind === 'edge') {
    if (Math.abs(x - x2) + Math.abs(z - z2) !== 1) return '軌道兩端不相鄰';
    if (!(z < z2 || (z === z2 && x < x2))) return '軌道兩端沒有依 z 再 x 排序';
    if (mode === 'metro' ? h !== -1 || h2 !== -1 : h < 0 || h2 < 0 || Math.abs(h - h2) > 1) return '軌道高度';
    return null;
  }
  const [w, d] = spanOf(kind);
  if (x2 !== x + w - 1 || z2 !== z + d - 1 || h2 !== h) return kind === 'station' ? '車站佔地（2×1）' : '車廠佔地（3×2）';
  if (mode === 'metro' ? h !== -1 : h < 0) return '站廠的層';
  return null;
}

// 施工成功後記的事件：軌道記兩端（network.ts 已依 z 再 x 排好），站廠記起點與對角；拆除照抄被拆那一件的真實幾何、費用 0
export function transitEventOf(day: number, op: TransitOp, item: Item, cost: number, g: number): TransitEvent {
  if (kindOf(op) === 'edge') {
    const e = item as NetworkEdge;
    return { day, t: 'transit', op, id: e.id, mode: e.mode, x: e.a.x, z: e.a.z, h: e.a.height, x2: e.b.x, z2: e.b.z, h2: e.b.height, cost, g };
  }
  const s = item as TransitStation;
  return { day, t: 'transit', op, id: s.id, mode: s.mode, x: s.x, z: s.z, h: s.height, x2: s.x + s.w - 1, z2: s.z + s.h - 1, h2: s.height, cost, g };
}

// 復原：施工前沒有路網（這座城第一次蓋）就回到空的三個陣列，路網鍵照樣留著（歷史裡那一筆施工還在：有 transit 事件 ⇔ 有路網）
export function restoreTransit(cur: TransitNetwork, before: TransitNetwork | undefined): TransitNetwork {
  const b = before ?? createNetwork();
  return { edges: [...b.edges], stations: [...b.stations], depots: [...b.depots], nextId: Math.max(cur.nextId, b.nextId), revision: cur.revision + 1 };
}

// 地面上的運輸格（軌道兩端、站廠佔地；地鐵不算）：反向守衛與繪製用。格索引 z*n+x
export function surfaceTransitCells(net: TransitNetwork | undefined, n: number): Set<number> {
  const out = new Set<number>();
  if (!net) return out;
  for (const e of net.edges) if (e.mode !== 'metro') { out.add(e.a.z * n + e.a.x); out.add(e.b.z * n + e.b.x); }
  for (const s of [...net.stations, ...net.depots]) if (s.mode !== 'metro') {
    for (let dz = 0; dz < s.h; dz++) for (let dx = 0; dx < s.w; dx++) if (s.x + dx < n && s.z + dz < n) out.add((s.z + dz) * n + s.x + dx);
  }
  return out;
}

// ---- 重播 ----
interface Slot { readonly kind: Kind; readonly item: Item; live: boolean }
interface Inverse { readonly slot: Slot; readonly built: boolean }   // built：這一筆是蓋（復原＝拿掉）；否則是拆（復原＝放回原位）
export interface TransitReplay {
  n: number;                                   // 地圖邊長（格索引的步長；第一筆施工時記下）
  used: boolean;                               // 套過任何一筆運輸事件＝城裡有路網
  nextId: number;
  revision: number;
  liveEdges: number;
  readonly slots: Record<Kind, Slot[]>;         // 照施工順序；拆掉的標記 live＝false（network.ts 的 filter 保留其餘順序）
  readonly byId: Map<number, Slot>;
  readonly edgeKeys: Map<string, Slot>;         // 還在的軌道：mode:a:b（graph.ts edgeKey 的寫法）
  readonly foot: Map<number, Slot>;             // 還在的站廠佔的格（不分模式與高度，同 network.ts occupiedBy）
  readonly ends: Map<number, Set<Slot>>;        // 還在的軌道端點所在的格（不分高度，同 network.ts touchesEdges）
  readonly strokes: Map<number, Inverse[]>;     // 手勢 g → 這一筆手勢做過的事（復原用；等於記住施工前的路網）
  readonly stack: number[];                     // 還沒復原的運輸手勢，最後一筆在尾巴
}
export function transitReplay(): TransitReplay {
  return { n: 0, used: false, nextId: 1, revision: 0, liveEdges: 0, slots: { edge: [], station: [], depot: [] }, byId: new Map(), edgeKeys: new Map(), foot: new Map(), ends: new Map(), strokes: new Map(), stack: [] };
}

const pointKey = (x: number, z: number, h: number) => `${x},${z},${h}`;
const keyOfEdge = (e: NetworkEdge) => `${e.mode}:${pointKey(e.a.x, e.a.z, e.a.height)}:${pointKey(e.b.x, e.b.z, e.b.height)}`;
function cellsOf(rp: TransitReplay, s: TransitStation | TransitDepot): number[] {
  const out: number[] = [];
  for (let dz = 0; dz < s.h; dz++) for (let dx = 0; dx < s.w; dx++) out.push((s.z + dz) * rp.n + s.x + dx);
  return out;
}
function edgeEnds(rp: TransitReplay, e: NetworkEdge): number[] { return [e.a.z * rp.n + e.a.x, e.b.z * rp.n + e.b.x]; }
function index(rp: TransitReplay, slot: Slot, on: boolean) {
  if (slot.kind === 'edge') {
    const e = slot.item as NetworkEdge;
    if (on) rp.edgeKeys.set(keyOfEdge(e), slot); else rp.edgeKeys.delete(keyOfEdge(e));
    rp.liveEdges += on ? 1 : -1;
    for (const j of edgeEnds(rp, e)) {
      let set = rp.ends.get(j);
      if (on) { if (!set) { set = new Set(); rp.ends.set(j, set); } set.add(slot); }
      else if (set) { set.delete(slot); if (!set.size) rp.ends.delete(j); }
    }
  } else {
    for (const j of cellsOf(rp, slot.item as TransitStation)) {
      if (on) { if (rp.foot.has(j)) throw new Error('重播：運輸站廠的佔地重疊（內部狀態不一致）'); rp.foot.set(j, slot); }
      else rp.foot.delete(j);
    }
  }
}
function setLive(rp: TransitReplay, slot: Slot, on: boolean) {
  if (slot.live === on) throw new Error(`重播：運輸設施 #${slot.item.id} 已經${on ? '在' : '拆掉'}了（內部狀態不一致）`);
  slot.live = on;
  index(rp, slot, on);
}
const inMap = (rp: TransitReplay, x: number, z: number) => Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < rp.n && z < rp.n;

// 重播一筆運輸事件（照 network.ts 的規則；資金給最大安全整數，費用另外核）。不對就丟例外（歷史壞了不猜）
export function applyTransitEvent(rp: TransitReplay, c: City, e: TransitEvent, k = -1): void {
  const fail = (why: string) => new Error(`重播：第 ${e.day} 天的運輸施工（${e.op} #${e.id}）不對：${why}${k >= 0 ? `（歷史第 ${k + 1} 筆）` : ''}`);
  if (!rp.n) rp.n = c.n; else if (rp.n !== c.n) throw fail('地圖邊長變了');
  if (!TRANSIT_OPS.includes(e.op)) throw fail('不認得的操作');
  if (!TRANSIT_MODES.includes(e.mode)) throw fail('不認得的模式');
  const open = rp.strokes.get(e.g);
  if (open && rp.stack[rp.stack.length - 1] !== e.g) throw fail(`手勢 ${e.g} 不是最後一筆運輸手勢`);
  const kind = kindOf(e.op), head = { nextId: rp.nextId, revision: rp.revision };
  let slot: Slot, built: boolean, next: TransitNetwork;
  if (!e.op.startsWith('del-')) {
    if (e.id !== rp.nextId) throw fail(`新設施的編號要是 ${rp.nextId}`);
    const terrain = transitTerrain(c, false);
    let r;
    if (kind === 'edge') {
      if (rp.liveEdges >= MAX_EDGES) throw fail('網路已滿');
      const dup = rp.edgeKeys.get(`${e.mode}:${pointKey(e.x, e.z, e.h)}:${pointKey(e.x2, e.z2, e.h2)}`);
      r = buildTrack({ edges: dup ? [dup.item as NetworkEdge] : [], stations: [], depots: [], ...head }, terrain, e.mode, { x: e.x, z: e.z, height: e.h }, { x: e.x2, z: e.z2, height: e.h2 }, MAX_MONEY);
    } else {
      const [w, d] = spanOf(kind), near = new Set<Slot>();
      for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) { const x = e.x + dx, z = e.z + dz; const s = inMap(rp, x, z) ? rp.foot.get(z * rp.n + x) : undefined; if (s) near.add(s); }
      const mini = { edges: [], stations: [...near].filter(s => s.kind === 'station').map(s => s.item as TransitStation), depots: [...near].filter(s => s.kind === 'depot').map(s => s.item as TransitDepot), ...head };
      r = (kind === 'station' ? buildStation : buildDepot)(mini, terrain, e.mode, e.x, e.z, e.h, MAX_MONEY);
    }
    if (!r.ok) throw fail(r.reason);
    next = r.network;
    const list: readonly Item[] = kind === 'edge' ? next.edges : kind === 'station' ? next.stations : next.depots, item = list[list.length - 1];
    const back = transitEventOf(e.day, e.op, item, e.cost, e.g);
    if (back.id !== e.id || back.mode !== e.mode || back.x !== e.x || back.z !== e.z || back.h !== e.h || back.x2 !== e.x2 || back.z2 !== e.z2 || back.h2 !== e.h2) throw fail('施工的幾何跟事件記的不同');
    const cost = MAX_MONEY - r.money;
    if (e.cost !== 0 && e.cost !== cost) throw fail(`費用要是 0（沙盒）或 ${cost}`);
    slot = { kind, item, live: false };
    rp.slots[kind].push(slot); rp.byId.set(item.id, slot);
    built = true;
  } else {
    if (e.cost !== 0) throw fail('拆除的費用要是 0');
    const found = rp.byId.get(e.id);
    if (!found || !found.live || found.kind !== kind) throw fail('找不到要拆的設施');
    const back = transitEventOf(e.day, e.op, found.item, 0, e.g);
    if (back.mode !== e.mode || back.x !== e.x || back.z !== e.z || back.h !== e.h || back.x2 !== e.x2 || back.z2 !== e.z2 || back.h2 !== e.h2) throw fail('要拆的設施跟事件記的不同');
    let r;
    if (kind === 'edge') r = removeEdge({ edges: [found.item as NetworkEdge], stations: [], depots: [], ...head }, e.id, MAX_MONEY);
    else {
      const touching = new Set<Slot>();
      for (const j of cellsOf(rp, found.item as TransitStation)) for (const s of rp.ends.get(j) ?? []) touching.add(s);
      const mini = { edges: [...touching].map(s => s.item as NetworkEdge), stations: kind === 'station' ? [found.item as TransitStation] : [], depots: kind === 'depot' ? [found.item as TransitDepot] : [], ...head };
      r = (kind === 'station' ? removeStation : removeDepot)(mini, e.id, MAX_MONEY);
    }
    if (!r.ok) throw fail(r.reason);
    next = r.network; slot = found; built = false;
  }
  setLive(rp, slot, built);
  rp.nextId = next.nextId; rp.revision = next.revision; rp.used = true;
  if (open) open.push({ slot, built });
  else { rp.strokes.set(e.g, [{ slot, built }]); rp.stack.push(e.g); }
}

// 復原第 g 筆手勢：不是運輸手勢回 false（交給格子的復原）；是的話整筆反做（同 restoreTransit：nextId 不倒退、revision +1）
export function undoTransitStroke(rp: TransitReplay, g: number, day: number, k = -1): boolean {
  const done = rp.strokes.get(g);
  if (!done) return false;
  if (rp.stack[rp.stack.length - 1] !== g) throw new Error(`重播：第 ${day} 天要復原的運輸手勢 ${g} 不是最後一筆運輸手勢${k >= 0 ? `（歷史第 ${k + 1} 筆）` : ''}`);
  for (let j = done.length - 1; j >= 0; j--) setLive(rp, done[j].slot, !done[j].built);
  rp.revision += 1;
  rp.strokes.delete(g); rp.stack.pop();
  return true;
}

// 重播完的路網（沒套過運輸事件＝undefined，城市就不帶 transit 鍵）。鍵序同 createNetwork
export function replayedNetwork(rp: TransitReplay): TransitNetwork | undefined {
  if (!rp.used) return undefined;
  const pick = <T extends Item>(a: readonly Slot[]) => a.filter(s => s.live).map(s => s.item as T);
  return { edges: pick<NetworkEdge>(rp.slots.edge), stations: pick<TransitStation>(rp.slots.station), depots: pick<TransitDepot>(rp.slots.depot), nextId: rp.nextId, revision: rp.revision };
}

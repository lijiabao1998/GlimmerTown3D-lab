// 施工（D011）：把介面的手勢（點、拉線、框選）接到實驗線的放置規則（src/sim/rules/build.ts，逐項對拍），
// 施工完同步城市模型、記世界歷史（每一格一筆，規則 4），同一天之內可以一筆一筆復原（T460，實驗線可以隔天，本線不照搬）。
// 純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；拆除確認的「3 秒內再按一次」用呼叫端給的 now。
import { canPlace, placeCost, roadDraftTiles, roadToolToRc, commitLine, commitRect, tap, undoTxn, pushTxn, ROAD_COST, COST, type BuildState, type Txn } from './rules/build.ts';
import { computePower, powerCap } from './rules/power.ts';
import { rebuildCov, type SvcBudget } from './rules/fields.ts';
import { applyPolicy, ensurePol, stepBudget, type PolicyResult } from './rules/policy.ts';
import { SPEC_MIN_RANK, TECH343_BY_ID, pickSpec, startTech, techFee, techWhy } from './rules/tech.ts';
import { computeWaterLegacy449 } from './rules/water.ts';
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
// D016 公共設施：名稱與順序照實驗線工具列 svc 類（TOOLS 37584–37597；電廠有自己的按鈕、大墓園沒搬），造價 COST（37442）；short＝按鈕上的一個字。
// D019：水塔（svc 類，37586，實驗線排在電廠後面）、配水管（實驗線在 road 類 37554，本線放在水塔旁邊）；配水管是拉線、造價一格
// D044：天然氣井（k117，1×1）、太空研究中心（k51，3×3，工具列要城市 Lv.22 才解鎖）；unlockRank、size 是介面的欄位（實驗線 TOOLS 37656、37754；toolSize458 63879–63885），規則（canPlace）不看等級
export interface CivicTool { id: string; name: string; short: string; cost: number; label?: string; unlockRank?: number; size?: number }   // label：下面那排小按鈕上的字（名字太長放不下時用，一個按鈕約 45 px 寬）
export const CIVIC_TOOLS: CivicTool[] = [
  { id: 'park', name: '公園', short: '園', cost: COST.park }, { id: 'water', name: '水塔', short: '水', cost: COST.water },
  { id: 'wpipe', name: '配水管', short: '管', cost: COST.wpipe }, { id: 'fire', name: '消防局', short: '消', cost: COST.fire },
  { id: 'police', name: '警察局', short: '警', cost: COST.police }, { id: 'policeBox', name: '派出所', short: '派', cost: COST.policeBox },
  { id: 'hospital', name: '醫院', short: '醫', cost: COST.hospital }, { id: 'clinic', name: '診所', short: '診', cost: COST.clinic },
  { id: 'school', name: '學校', short: '學', cost: COST.school }, { id: 'library', name: '圖書館', short: '圖', cost: COST.library },
  { id: 'post', name: '郵局', short: '郵', cost: COST.post }, { id: 'cemetery', name: '墓園', short: '墓', cost: COST.cemetery },
  { id: 'dump', name: '垃圾場', short: '垃', cost: COST.dump },   // D020：實驗線排在大墓園後面（37597）
  { id: 'sewage', name: '污水廠', short: '污', cost: COST.sewage },   // D033：實驗線 svc 類（37695），排在最後；🚿；鄰水才蓋得下去
  { id: 'oilwell', name: '油井', short: '油', cost: COST.oilwell }, { id: 'mine', name: '礦場', short: '礦', cost: COST.mine },   // D040：實驗線 resource 類（37752、37753）；🛢️⛏️；要站在油田／礦藏格上才蓋得下去
  { id: 'gaswell', name: '天然氣井', short: '氣', label: '氣井', cost: COST.gaswell },   // D044：實驗線 resource 類（37656）；⛽；要站在油田格上（天然氣伴生）才蓋得下去
  { id: 'megaproject', name: '太空研究中心', short: '太', label: '太空', cost: COST.megaproject, unlockRank: 22, size: 3 },   // D044：實驗線 resource 類（37754）；🚀；3×3，城市 Lv.22 解鎖
];
export const toolSize = (id: string) => CIVIC_TOOLS.find(c => c.id === id)?.size ?? 1;
// 工具列的鎖（實驗線 toolUnlocked458 63877、selectCatalogTool458 63932）：城市等級不夠就選不起來、提示解鎖等級。這是介面的鎖，規則（canPlace）本來就不看等級
export function toolLock(s: Sim, id: string): string | null {
  const t = CIVIC_TOOLS.find(c => c.id === id);
  return t?.unlockRank && s.rankIdx + 1 < t.unlockRank ? `🔒 ${t.name}：城市 Lv.${t.unlockRank} 解鎖` : null;
}
const ZONE_OF: Record<string, number> = { zr: 1, zc: 2, zi: 3 };

// 介面的按鈕 → 實驗線的工具代號（規則 9：按鈕寫進資料的東西照實驗線）。路、公共設施是一組：按鈕下面那一排選的是哪一種
export const labToolOf = (ui: string, roadTool: string, civicTool = 'police') => ui === 'road' ? roadTool : ui === 'civic' ? civicTool : ui;
// 實驗線觸控的手勢（T436）：路與配水管是線（isLineTool436 62763）、分區與拆除與公園是框（isRectTool 62750：zr／zc／zi／doze／park，另有 tree、fill 還沒搬）、其他建築是點
export const gestureOf = (tool: string): 'line' | 'rect' | 'tap' => roadToolToRc(tool) || tool === 'wpipe' ? 'line' : (tool in ZONE_OF || tool === 'doze' || tool === 'park') ? 'rect' : 'tap';

export interface EditOp { k: 'tap' | 'line' | 'rect'; tool: string; x0: number; z0: number; x1: number; z1: number }
export interface OpPreview { cells: { x: number; z: number; ok: boolean; cost: number; foot?: boolean }[]; count: number; total: number; affordable: boolean; reason?: string }
// armed＋arm：單格拆二級以上的第一次（只預備，實驗線提示「⚠️ 再點一次確認拆除 Lv2 住宅」62987）；skipped：框選拆除略過的二級以上棟數（實驗線 63004 另有提示）
export interface EditResult { ok: boolean; placed: number; spent: number; events: EditEvent[]; reason?: string; armed?: boolean; arm?: { k: number; lv: number }; skipped?: number; g?: number }
interface DayTxn { g: number; txn: Txn; created: number[]; removed: number[] }

function stateOf(s: Sim): BuildState {
  return { w: s.w, g: s.g, budget: s.budget, rng: s.rng, resource: s.res.resource, money: s.money, diff: s.diff, tech: s.edu.tech, spec: s.edu.spec,
    landDirty: s.landDirty, landBox: s.landBox, txn: null, dozeArm: s.dozeArm, protect: true, onPower: () => { /* 供電每天開頭整張重算（day.ts 55008）；介面要看就叫 powerStatus */ },
    onWater: () => { computeWaterLegacy449(s.w); } };   // D019：當場重算接通的水管（實驗線 52405、66572），畫面與建築卡馬上看得到；每天開頭也重算
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
    const sz = op.k === 'tap' ? toolSize(op.tool) : 1;               // D044：多格建築（太空研究中心 3×3）預覽畫整塊占地，跟根格同一個 ok；造價只算根格
    if (sz > 1) for (let dz = 0; dz < sz; dz++) for (let dx = 0; dx < sz; dx++) if ((dx || dz) && inMap(s, x + dx, z + dz)) cells.push({ x: x + dx, z: z + dz, ok: !r, cost: 0, foot: true });
  }
  return { cells, count, total, affordable: total <= s.money || s.diff === 3, reason: count ? undefined : reason };
}

// 提交：照實驗線的手勢函式蓋（build.ts），再把這一筆交易碰過的格子逐格比對前後，記事件、同步城市模型
export function commitOp(s: Sim, op: EditOp, now: number): EditResult {
  const pv = previewOp(s, op), st = stateOf(s), m0 = s.money, costs = new Map<number, number>();
  for (const c of pv.cells) if (c.ok && !c.foot) costs.set(c.z * s.w.N + c.x, c.cost);   // 每格的造價只看那一格（施工前先記；插入順序＝施工順序）
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
// 為什麼要標：本線的「整張重算」只算 stale 格（實驗線真的整張算），這個省時做法成立的條件是「不是 stale 的格，地價基準都等於現算的值」。
// 目前實驗線 doPlace 的 markLandDirty（51627）會把當天的「整張」換成框（實驗線的 bug，照抄），框一定蓋得到施工改過的格，
// 所以現在少了這個標記也看不出差別（審查確認過）；實驗線哪天修掉那個 bug、本線跟著修時，就全靠這裡。
// 守衛直接核對上面那個條件（tools/unit-d011-edit.mjs：每一筆施工後、每一天開頭逐格驗），不靠框。
// 範圍取實驗線 doPlace 自己標的髒框半徑 20，涵蓋本卡工具的蓋印半徑（警察 10、電廠污染 6、樹 2）；多標只是隔天多算幾格，少標才會錯。
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
    c.road[i] = roadCode(b.road, b.hw, b.bridge); c.rclass[i] = b.road ? (b.rc || 0) : 0; c.zone[i] = b.zone || 0; c.tree[i] = b.tree || 0; c.wp[i] = b.wp ? 1 : 0; c.ruin[i] = b.ruin ? 1 : 0;   // D026：焦土
    if (!hasRoot && b.bld?.ref && !a.bld) continue;                    // D044：多格建築新蓋住的附屬格——樹、分區的清除算在根格那一筆「放了建築」裡（重播清整塊占地），不另記事件
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
    } else if (a.ruin && !b.ruin) out.push({ day, t: 'doze', x, z, layer: 'ruin', cost, g });                          // D026：清焦土（51777：ruin＝0、zone＝0；要排在分區那一行前面，不然被記成拆分區）
    else if (b.road && (!a.road || a.rc !== b.rc)) out.push({ day, t: 'road', x, z, rc: b.rc || 0, cost, g });   // 鋪路、升級（51645）
    else if (a.road && !b.road) out.push({ day, t: 'doze', x, z, layer: 'road', cost, g });                          // 51808
    else if ((b.zone || 0) !== (a.zone || 0)) out.push(b.zone ? { day, t: 'zone', x, z, zone: b.zone, cost, g } : { day, t: 'doze', x, z, layer: 'zone', cost, g });   // 51665／51811
    else if (a.tree && !b.tree) out.push({ day, t: 'doze', x, z, layer: 'tree', cost, g });                         // 只砍了樹
    else if (b.wp && !a.wp) out.push({ day, t: 'pipe', x, z, cost, g });                                            // D019：鋪水管（51679）
    else if (a.wp && !b.wp) out.push({ day, t: 'doze', x, z, layer: 'wp', cost, g });                               // D019：拆水管（51810）
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
    c.road[i] = roadCode(b.road, b.hw, b.bridge); c.rclass[i] = b.road ? (b.rc || 0) : 0; c.zone[i] = b.zone || 0; c.tree[i] = b.tree || 0; c.wp[i] = b.wp ? 1 : 0; c.ruin[i] = b.ruin ? 1 : 0; c.occ[i] = 0;
  }
  for (const [i, cb] of s.root) for (let dz = 0; dz < cb.size; dz++) for (let dx = 0; dx < cb.size; dx++) { const j = (cb.z + dz) * n + cb.x + dx; if (cb.x + dx < n && cb.z + dz < n && dt.txn.snaps.some(q => q.i === j)) c.occ[j] = cb.id; void i; }
  const refund = s.money - m0;
  c.history.push({ day: s.day, t: 'undo', g: dt.g, refund });
  return { ok: true, refund };
}

// ---- 政策與預算（D032）：玩家在面板調的旋鈕。立刻生效（回退設定：T504 治理關，policyApply504 67570 直接轉給 mayorPolicyApply470A 53750，保留冷卻）；
// 下一天的結算、幸福、災禍、電力……讀新的設定（stepDay 每天讀 s.pol、s.budget）。改教育場要重算的只有營養午餐與預算（rebuildCov：EDU 是快取、覆蓋半徑讀預算）。
// 實驗線 rebuildCov 最後清地價髒標記（53154），這裡跟 undoOp 一樣照做。不寫世界歷史（不加事件種類，要業主定的事 1）
function recoverCov(s: Sim) {
  rebuildCov(s.w, s.g, s.budget, s.edu);
  s.landDirty = false; s.landBox = null; s.stale.fill(0);
}
// 套用一項政策：回傳 applyPolicy 的結果（ok＝真的改了；冷卻沒到、同值、不認得的鍵都不動）。沒套用成功也會補出預設物件（53750 先補預設物件），所以 s.pol 一定換成回傳的新物件
export function setPolicy(s: Sim, k: string, value: unknown): PolicyResult {
  const was = (ensurePol(s.pol) as Record<string, unknown>)[k], r = applyPolicy(s.pol, s.polLast, s.day, k, value);
  s.pol = r.pol;
  if (!r.ok) return r;
  s.polLast = r.last;
  { const v = (r.pol as Record<string, unknown>)[k], num = (q: unknown) => typeof q === 'boolean' ? (q ? 1 : 0) : (q as number); s.city.history.push({ day: s.day, t: 'policy', key: k, from: num(was), value: num(v) }); }   // D039：真的改了才記（冷卻、同值、不認得的鍵在上面就回了）
  if (r.effects.coverage) { s.edu.schoolLunch = !!r.pol.schoolLunch; recoverCov(s); }   // 53754：營養午餐 → rebuildCov（教育場 ×1.25 或還原）；清運（回收）與電力（節能）本線每天開頭整張重算，不必當場動
  return r;
}
// 服務預算 ±（setSvcBudget 52968–52973）：不認得的類別不動（回 false）；認得的一律夾限、重算覆蓋（夾到頭數字沒變也算，實驗線照叫 rebuildCov）；沒有冷卻
export function setBudget(s: Sim, cat: keyof SvcBudget | string, delta: number): boolean {
  const b = stepBudget(s.budget, cat, delta);
  if (b === s.budget) return false;
  const was = (s.budget as unknown as Record<string, number>)[cat], now = (b as unknown as Record<string, number>)[cat];
  s.budget = b; recoverCov(s);
  if (now !== was) s.city.history.push({ day: s.day, t: 'budget', cat, from: was, value: now });   // D039：夾到頭、數字沒變不記
  return true;
}

// ---- 科技與專精（D038）：玩家在 ☰「科技與專精」面板按的。研究要付的錢現在扣、進度每天由 stepDay 推（主計數迴圈之後，55245）；開始研究、選方向記成世界歷史事件 research／spec（D039）----
export interface TechActResult { ok: boolean; fee: number; why?: string }
// 開始研究（startTech343 38557）：條件與費用照實驗線；回傳扣了多少（已經在做它＝成功、免費）。失敗講原因（canStartTech 的條件、錢不夠）
export function startResearch(s: Sim, id: string): TechActResult {
  const n = TECH343_BY_ID[id], why = techWhy(n, s.tech, s.edu.tech);
  if (why) return { ok: false, fee: 0, why };
  const was = s.tech.act, r = startTech(id, s.tech, s.edu.tech, s.money, s.diff);
  if (!r.ok) return { ok: false, fee: 0, why: `錢不夠：要 $${techFee(n, s.tech, s.diff).toLocaleString()}（現有 $${Math.floor(s.money).toLocaleString()}）` };
  s.money -= r.fee;
  if (was !== id) s.city.history.push({ day: s.day, t: 'research', id, fee: r.fee });   // D039：再按正在做的節點不記
  return { ok: true, fee: r.fee };
}
// 選城市方向（specPick386 37852）：永久；城市等級 ≥ Lv.9、不是沙盒、還沒選過；選教育科技城時重建覆蓋場（教育場 ×1.08）
export function chooseSpec(s: Sim, i: number): { ok: boolean; id: string | null; why?: string } {
  if (s.edu.spec) return { ok: false, id: null, why: '已經選過了（永久）' };
  if (s.diff === 3) return { ok: false, id: null, why: '沙盒不能選城市方向' };
  if (s.rankIdx + 1 < SPEC_MIN_RANK) return { ok: false, id: null, why: `要城市等級 Lv.${SPEC_MIN_RANK}（現在 Lv.${s.rankIdx + 1}）` };
  const id = pickSpec(i, s.edu.spec, s.diff, s.rankIdx);
  if (!id) return { ok: false, id: null, why: '沒有這個方向' };
  s.edu.spec = id;
  if (id === 'edu') recoverCov(s);
  s.city.history.push({ day: s.day, t: 'spec', id });   // D039
  return { ok: true, id };
}

// 電：容量（燃煤電廠 75 棟起，52473；季節係數 55008）與有電、沒電的住商工棟數（昨天的分配，55154–55156）
export function powerStatus(s: Sim) {
  const cap = powerCap(computePower(s.w, !!(s.pol && s.pol.ecoReg)).cap, season(s.day));   // D032：節能條例 ecoReg 發電廠容量 +5
  let powered = 0, unpowered = 0;
  for (const cb of s.root.values()) if (cb.k <= 3) { const b = s.w.tiles[cb.z * s.w.N + cb.x].bld; if (b?.pw) powered++; else unpowered++; }
  return { cap, powered, unpowered };
}

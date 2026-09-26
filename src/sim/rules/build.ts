// 建造規則（D011）：實驗線 canPlace／placeCost／doPlace 裡本卡工具的分支，加上觸控手勢（T436）與復原（T460）的語意。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d（index.html 行號）。對拍見 tools/lab-build.mjs、tools/unit-d011-build.mjs（規則 8）。
// 本卡的工具：路 alley／road／coll／art／hwy（等級 1–5）、分區 zr／zc／zi、電廠 plant（k5）、警察局 police（k11）、拆除 doze。其他工具一律丟例外。
// 資料形狀與欄位名照實驗線的 tiles[i]／bld（規則 9）。純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）；拆除確認的時間由呼叫端給。
//
// 實驗線的 doPlace 外面還包了五層（67216 T500 轉運站、67266 T501 主動運輸、67446 T502 路口、70198 T514 財政、72597 T516A 遙測），
// canPlace／placeCost 各包兩層（67211／67261、67213／67263），undo 包兩層（67267、67444）。對本卡的工具，在 D010 的回退設定下它們都不改模擬：
//   67216／67211／67213：只接手 4 種轉運站；拆除成功後設 railOpsDirty463、mobility491Dirty（交通沒搬）。
//   67266／67261／67263：只接手 *502 工具，和「格子上有 am502 時拆除先拆它」——本線沒有主動運輸圖層（am502 永遠沒有），不搬；其餘只設髒旗標。
//   67446／67444／67267：路、拆除、復原之後設 junctionMarkDirty503、activeMobilityMarkDirty502 髒旗標（回退設定 __noJunction503）。
//   70198：先算一次 placeCost（純函式），成功且是公共資產（k11 在 70143 的表上）就記一筆資本帳；回退設定 __noFiscal515 下不動資金。
//          它對圖外座標也先叫 placeCost，索引落到陣列外時實驗線會丟例外。介面的路徑（paintTo 62752、commitRect 62999）都先擋圖外，
//          本線照最裡層的 doPlace：圖外照樣先標地價框，再回「超出地圖」。
//   72597：遙測，不改模擬。
import { idx, inMap, tq, type Bld, type Rng, type Tile, type World } from './lab.ts';
import { COVR, POL_SRC, covFieldOfK, rebuildCov, stampCov, stampPolSrc, stampPolTree, type EduCtx, type Grids, type SvcBudget } from './fields.ts';

// 37428：五級道路造價（小巷、支路、次幹道、主幹道、快速路）
export const ROAD_COST = [8, 15, 28, 55, 120];
// 37442 COST 裡本卡用到的鍵（COST.road／hwy／hwyBridge 實驗線沒人讀，道路造價只看 ROAD_COST；樹上加價用的是 COST.doze，51623）
export const COST = { zone: 8, plant: 550, police: 500, doze: 2, bridge: 60 };
// 62731：復原堆疊上限（closeUndo 推進 undoStack 後超過 40 筆就丟最舊的）
export const UNDO_MAX = 40;
// 62985：單格拆除二級以上的住商工，要在 3000 毫秒內再按一次
export const DOZE_ARM_MS = 3000;

export const D011_TOOLS: readonly string[] = ['alley', 'road', 'coll', 'art', 'hwy', 'zr', 'zc', 'zi', 'plant', 'police', 'doze'];
const TOOL_SET = new Set(D011_TOOLS);
function need(tool: string): void { if (!TOOL_SET.has(tool)) throw new Error('D011 未搬：' + tool); }
const ZONE_OF: Record<string, number> = { zr: 1, zc: 2, zi: 3 };   // 51639

// 51161
export function roadToolToRc(id: string): number { return ({ alley: 1, road: 2, coll: 3, art: 4, hwy: 5 } as Record<string, number>)[id] || 0; }
// 51191：水上（t＝0）加橋的錢。實驗線的參數順序是 (x,y,rc)
export function roadCostAt(st: BuildState, rc: number, x: number, y: number): number {
  return st.w.tiles[idx(st.w, x, y)].t === 0 ? ROAD_COST[rc - 1] + COST.bridge : ROAD_COST[rc - 1];
}

// 一筆交易（實驗線 undoGroup，62725）：每一格第一次被碰到時存整格 JSON（s）；關閉時只留前後不同的格（a＝關閉時的 JSON）
export interface TxnSnap { i: number; s: string; a?: string }
export interface Txn { snaps: TxnSnap[]; seen: Record<number, number>; spent: number }

// 施工需要的狀態。欄位對應實驗線的全域：tiles／N（w）、COV／POL…（g）、svcBudget（budget）、R（rng）、money、diff、
// tech343.done（tech）、spec386（spec，沒有＝null）、landDirty／landBox（53067／53073，框寫成 [x0,y0,x1,y1]）、undoGroup（txn）、dozeArm（62709，格號 i＝y*N+x）
export interface BuildState {
  w: World; g: Grids; budget: SvcBudget; rng: Rng;
  money: number; diff: number; tech: readonly string[]; spec: string | null;
  landDirty: boolean; landBox: [number, number, number, number] | null;
  txn: Txn | null; dozeArm: { i: number; t: number } | null;
  onPower?: () => void;   // 實驗線當場重算供電（computePower）的時機；本線每天開頭整張重算（day.ts），這裡只通知
  onPlace?: (tool: string, x: number, y: number, ok: boolean, cost: number) => void;   // 每一次 doPlace 之後（成功或失敗；cost＝實付，失敗 0）。給對拍記錄用，不改模擬
}

// 53074–53084：地價基準的髒框。landDirty＝true、landBox＝null 在實驗線是「隔天整張重算」（每天收尾 55279 → 64129／67355 都是這個狀態），
// 但這裡 if(!landBox) 把它當成「還沒有框」，整張重算就被換成這一個框——實驗線的 bug（D011 卡第 8 節），照抄；實驗線修了本線跟著改。
// 框超出地圖照樣夾（圖外的座標可能夾出 x1<x0 的空框，照抄）；框是同一個陣列就地擴大（實驗線改 landBox 物件的欄位）。
export function markLandDirty(st: BuildState, x: number, y: number, r: number): void {
  st.landDirty = true;
  const N = st.w.N, x0 = Math.max(0, x - r), y0 = Math.max(0, y - r), x1 = Math.min(N - 1, x + r), y1 = Math.min(N - 1, y + r);
  const b = st.landBox;
  if (!b) st.landBox = [x0, y0, x1, y1];
  else {
    if (x0 < b[0]) b[0] = x0;
    if (y0 < b[1]) b[1] = y0;
    if (x1 > b[2]) b[2] = x1;
    if (y1 > b[3]) b[3] = y1;
  }
}

// 51262–51489：能不能蓋；回拒絕理由（原文），可以蓋回 null
export function canPlace(st: BuildState, toolId: string, x: number, y: number): string | null {
  need(toolId);
  const w = st.w;
  if (!inMap(w, x, y)) return '超出地圖';                                       // 51263
  const t = w.tiles[idx(w, x, y)];
  if (t.ruin && toolId !== 'doze') return '焦土需先清理';                       // 51265
  if (t.crater && toolId !== 'doze') return '隕石坑需先剷除';                   // 51266
  switch (toolId) {
    case 'alley': case 'road': case 'coll': case 'art': case 'hwy': {          // 51268–51272：不看地形，水上也可以（變成橋）
      const rcTarget = roadToolToRc(toolId);
      if (t.road && (t.rc as number) >= rcTarget) return '已為同級或更高級道路';
      if (t.bld) return '有建築擋住';
      return null; }
    case 'zr': case 'zc': case 'zi':                                            // 51273–51277
      if (t.t !== 2 && t.t !== 1) return '只能劃在陸地上';
      if (t.road) return '道路上不能分區';
      if (t.bld) return '已有建築';
      return null;
    case 'plant': case 'police':                                                // 51278–51282（公園、水塔等同一支，不在本卡）
      if (t.t !== 2 && t.t !== 1) return '只能蓋在陸地上';
      if (t.road) return '道路上不能建造';
      if (t.bld) return '已有建築';
      return null;
    case 'doze':                                                                // 51353–51355（rdec、bus 不在清單上：只有它們的格子拆不了）
      if (!t.road && !t.bld && !t.zone && !t.tree && !t.deco && !t.ruin && !t.rail && !t.tram && !t.dock && !t.oneway && !t.light && !t.busLane && !t.levee && !t.flood
        && !t.wp && !t.crater && !t.hv471 && !t.ug471 && !t.wm472 && !t.sm472 && !t.lv475 && !t.ud475 && !t.fly475 && !t.ix475) return '這裡沒東西';
      return null;
  }
  return '無法建造';                                                             // 51488（到不了：need() 已擋）
}

// 51504–51625：造價。沙盒 0；路付差價（同級以上 0，不加樹、不乘係數）；已劃區的格子改劃免費；樹上加 COST.doze；最後乘科技與特化係數。
// 51506 沒檢查圖外：索引照 y*N+x 落到哪一格就算哪一格（落到陣列外會丟例外），同實驗線
export function placeCost(st: BuildState, toolId: string, x: number, y: number): number {
  need(toolId);
  if (st.diff === 3) return 0;                                                  // 51505 沙盒
  const t = st.w.tiles[idx(st.w, x, y)];
  let c = 0;
  switch (toolId) {
    case 'alley': case 'road': case 'coll': case 'art': case 'hwy': {          // 51509–51513：橋上升級，兩項都含 +60，互相抵掉
      const rc = roadToolToRc(toolId);
      if (t.road && (t.rc as number) >= rc) return 0;
      c = roadCostAt(st, rc, x, y) - (t.road ? roadCostAt(st, t.rc as number, x, y) : 0);
      break; }
    case 'zr': case 'zc': case 'zi':                                            // 51514–51515
      c = COST.zone; if (t.zone) c = 0; break;
    case 'plant': c = COST.plant; break;                                        // 51517
    case 'police': c = COST.police; break;                                      // 51526
    case 'doze': c = t.crater ? 120 : COST.doze; break;                         // 51546：隕石坑 120
  }
  if (toolId !== 'doze' && t.tree) c += COST.doze;                              // 51623（stad、地形筆刷也不加，不在本卡）
  const sq = (id: string, on: number, off: number) => st.spec === id ? on : off;   // 37851
  return c * tq(st.tech, 'B5', .95, 1) * tq(st.tech, 'C8', .95, 1) * tq(st.tech, 'D4a', .90, 1) * sq('hub', 1.05, 1);   // 51624（乘的順序照抄）
}

// 拆除一次拆哪一層（51777–51818 的 if／else 鏈，順序照抄）。null＝沒東西可拆（canPlace 另有自己的清單，rdec、bus 不在上面）
export type DozeLayer = 'ruin' | 'crater' | 'bld' | 'rail' | 'tram' | 'dock' | 'rdec' | 'bus' | 'lv475' | 'fly475' | 'hv471' | 'wm472' | 'road' | 'wp' | 'zone' | 'tree'
  | 'deco' | 'oneway' | 'light' | 'busLane' | 'levee' | 'flood';
export function dozeLayer(t: Tile): DozeLayer | null {
  if (t.ruin) return 'ruin';
  if (t.crater) return 'crater';
  if (t.bld) return 'bld';
  if (t.rail) return 'rail';
  if (t.tram) return 'tram';
  if (t.dock) return 'dock';
  if (t.rdec) return 'rdec';
  if (t.bus) return 'bus';
  if (t.lv475 || t.ud475) return 'lv475';
  if (t.fly475 || t.ix475) return 'fly475';
  if (t.hv471 || t.ug471) return 'hv471';
  if (t.wm472 || t.sm472) return 'wm472';
  if (t.road) return 'road';
  if (t.wp) return 'wp';
  if (t.zone) return 'zone';
  if (t.tree) return 'tree';
  if (t.deco) return 'deco';
  if (t.oneway) return 'oneway';
  if (t.light) return 'light';
  if (t.busLane) return 'busLane';
  if (t.levee) return 'levee';
  if (t.flood) return 'flood';
  return null;
}

// 51776–51819：拆一層。遮罩（mask、railMask、tramMask、lvMask475、udMask475、hvMask471、wmMask472、smMask472、wpMask475）與
// 鄰格遮罩重算（recalcMask、recalcRailMask4、recalcInfraMask4_475、recalcPowerGridMask4_471、recalcWaterMainMask4_472）是畫面用，不搬。
function doze(st: BuildState, t: Tile, x: number, y: number): void {
  const w = st.w, g = st.g, b = st.budget, txn = st.txn;
  switch (dozeLayer(t)) {
    case 'ruin': t.ruin = 0; t.zone = 0; break;                                 // 51777（office 不清，照抄）
    case 'crater': t.crater = 0; break;                                         // 51778
    case 'bld': {                                                               // 51779–51798
      const bl = t.bld as Bld;
      const r = (bl.ref as [number, number] | undefined) || [x, y];             // 多格建築先找根格再讀 sz（ref 格只有 {k,ref}）
      const rb = inMap(w, r[0], r[1]) ? w.tiles[idx(w, r[0], r[1])].bld : null;
      const sz = (rb && rb.sz) || 1;
      if (sz > 1) {
        const root = rb as Bld;
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) {      // 占地逐格清掉（占地裡不是這棟的格也清，照抄）
          const sx = r[0] + dx, sy = r[1] + dy;
          if (!inMap(w, sx, sy)) continue;
          const j = idx(w, sx, sy), ct = w.tiles[j];
          if (txn && !txn.seen[j]) { txn.seen[j] = 1; txn.snaps.push({ i: j, s: JSON.stringify(ct) }); }   // 51789
          ct.bld = null;
          if (root.k === 9) stampCov(g, b, 'stadium', sx, sy, COVR.stadium, -1);   // 體育場四格都蓋過 stadium
        }
        if (root.k !== 9) { const cf = covFieldOfK(root.k); if (cf) stampCov(g, b, cf, r[0], r[1], COVR[cf], -1); if (root.k === 132) stampCov(g, b, 'shelter', r[0], r[1], COVR.shelter, -1); }
        // 51794 儲能／儲水的執行期狀態（powerStorageState471、waterStorageState472）本線沒有
        if (root.k === 126) stampCov(g, b, 'play', r[0], r[1], COVR.play, -1);    // 51795
        if (POL_SRC[root.k]) stampPolSrc(g, r[0], r[1], root.k, -1);             // 51796
      } else {                                                                  // 51797：單格（找不到根格的 ref 格也走這裡，照它自己的 k 撤印；單格不撤 shelter，照抄）
        const bk = bl.k; const cf = covFieldOfK(bk); t.bld = null;
        if (cf) stampCov(g, b, cf, x, y, COVR[cf], -1);
        if (bk === 126) stampCov(g, b, 'play', x, y, COVR.play, -1);
        if (POL_SRC[bk]) stampPolSrc(g, x, y, bk, -1);
      }
      break; }                                                                  // 分區不動：拆掉建築後這一格還是分區，會再長
    case 'rail': t.rail = 0; t.railBridge = 0; break;                           // 51799
    case 'tram': t.tram = 0; t.tramBridge = 0; break;                           // 51800
    case 'dock': t.dock = 0; break;                                             // 51801
    case 'rdec': t.rdec = 0; stampCov(g, b, 'rdec', x, y, COVR.rdec, -1); break;   // 51802
    case 'bus': t.bus = 0; stampCov(g, b, 'bus', x, y, COVR.bus, -1); break;    // 51803（公車路線本線沒有：removeBusStopFromRoutes 不搬）
    case 'lv475': t.lv475 = 0; t.ud475 = 0; break;                              // 51804
    case 'fly475': t.fly475 = 0; t.ix475 = 0; break;                            // 51805
    case 'hv471': t.hv471 = 0; t.ug471 = 0; break;                              // 51806
    case 'wm472': t.wm472 = 0; t.sm472 = 0; break;                              // 51807
    case 'road':                                                                // 51808–51809
      t.road = 0; t.rc = 0; t.hw = 0; t.bridge = 0; t.rdec = 0; t.bus = 0; t.busLane = 0; t.oneway = 0; t.light = 0; t.fly475 = 0; t.ix475 = 0; break;
    case 'wp': t.wp = 0; break;                                                 // 51810
    case 'zone': t.zone = 0; t.office = 0; break;                               // 51811
    case 'tree': t.tree = 0; break;                                             // 51812（撤樹的污染減免在 doPlace 尾端）
    case 'deco': t.deco = 0; break;                                             // 51813
    case 'oneway': t.oneway = 0; break;                                         // 51814–51818
    case 'light': t.light = 0; break;
    case 'busLane': t.busLane = 0; break;
    case 'levee': t.levee = 0; break;
    case 'flood': t.flood = 0; break;
  }
}

// 51626–52415：放一格。成功回 true。順序照抄：先標地價框（失敗也標），再判斷、算錢、存快照、改格子、蓋印、扣錢。
// 畫面與提示（toast、sErr、recalcMask、粒子 spawnDust／spawnDebris）不搬；「silent」只管提示，本線沒有。
export function doPlace(st: BuildState, toolId: string, x: number, y: number): boolean {
  need(toolId);
  markLandDirty(st, x, y, 20);                                                  // 51627
  const err = canPlace(st, toolId, x, y);
  if (err) { st.onPlace?.(toolId, x, y, false, 0); return false; }              // 51629
  const cost = placeCost(st, toolId, x, y);
  if (cost > st.money) { st.onPlace?.(toolId, x, y, false, 0); return false; } // 51631：相等可以蓋；錢是負的時候 0 元的也不行
  const w = st.w, i = idx(w, x, y), t = w.tiles[i], g = st.g, txn = st.txn;
  // 51633 syncWtePower：只影響尾端要不要重算供電；本卡工具裡只有 doze 會碰到，而 doze 本來就重算
  const hadTree = (t.tree as number) > 0;                                       // 51634
  if (txn && !txn.seen[i]) { txn.seen[i] = 1; txn.snaps.push({ i, s: JSON.stringify(t) }); }   // 51635–51638（快照在判斷與扣錢之後、改格子之前）
  switch (toolId) {
    case 'alley': case 'road': case 'coll': case 'art': case 'hwy': {          // 51641–51648
      const rc = roadToolToRc(toolId);
      if (t.road && (t.rc as number) >= rc) { st.onPlace?.(toolId, x, y, false, 0); return false; }   // canPlace 已擋，到不了
      const wasRoad = t.road;
      t.road = 1; t.rc = rc; t.hw = rc === 5 ? 1 : 0; t.bridge = t.t === 0 ? 1 : 0; t.tree = 0; t.zone = 0; t.deco = 0;   // office 不清，照抄
      if (wasRoad) st.onPower?.();                                              // 51647 升級也當場重算一次供電
      break; }
    case 'zr': case 'zc': case 'zi':                                            // 51663–51666
      if (t.zone === ZONE_OF[toolId] && !t.tree) { st.onPlace?.(toolId, x, y, false, 0); return false; }   // 同類重劃不動、不收錢（快照已存，關交易時會丟掉）
      t.zone = ZONE_OF[toolId]; t.tree = 0; t.deco = 0;                         // office 不清，照抄
      break;
    case 'plant':                                                               // 51671–51675：變體看座標，不抽亂數
      t.bld = { k: 5, lv: 1, v: (x * 7 + y * 13) % 3, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'plant', x, y, COVR.plant, 1);
      stampPolSrc(g, x, y, 5, 1);
      break;
    case 'police':                                                              // 51686–51689：變體抽一次亂數 ri(5)
      t.bld = { k: 11, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'police', x, y, COVR.police, 1);
      break;
    case 'doze':
      doze(st, t, x, y);
      break;
  }
  if (hadTree && !t.tree) stampPolTree(g, x, y, -1);                            // 52397 樹被清掉：撤掉鄰域的污染減免
  else if (!hadTree && t.tree) stampPolTree(g, x, y, 1);                        // 52398
  st.money -= cost;                                                             // 52399
  if (txn) txn.spent += cost;                                                   // 52400
  if (toolId === 'plant' || roadToolToRc(toolId) || toolId === 'doze') st.onPower?.();   // 52401–52404（分區、警察局不重算）
  // 52405–52412 水、污水、排水、清運、緊急出勤、韌性、地面重繪的髒旗標：本線沒有這些系統（或是畫面）
  st.onPlace?.(toolId, x, y, true, cost);
  return true;
}

// ---- 手勢（觸控 T436）與交易（T460）----
// 實驗線觸控：路是線（拖了才畫草稿，放開才蓋；只點一下＝一格），分區與拆除是框（點一下＝1×1 的框，走拆除確認），電廠、警察局是點（62806–62826、62912–62919）。

// 62725 openUndo
export function openTxn(st: BuildState): void { st.txn = { snaps: [], seen: {}, spent: 0 }; }
// 62726–62733 closeUndo：只留前後 JSON 不同的格；什麼都沒變也沒花錢就整筆丟掉（回 null）。
// 實驗線接著推進 undoStack（上限 40，62731）並清空重做堆疊；本線交給呼叫端（同一天之內可復原，見 edit.ts），要上限就用 pushTxn
export function closeTxn(st: BuildState): Txn | null {
  const g = st.txn; st.txn = null; if (!g) return null;
  const changed: TxnSnap[] = [];
  for (const sn of g.snaps) { const a = JSON.stringify(st.w.tiles[sn.i]); if (a !== sn.s) changed.push({ i: sn.i, s: sn.s, a }); }
  g.snaps = changed; if (!g.snaps.length && !g.spent) return null;
  return g;
}
// 62731：推進復原堆疊，超過 UNDO_MAX 就丟最舊的
export function pushTxn<T>(stack: T[], item: T): void { stack.push(item); if (stack.length > UNDO_MAX) stack.shift(); }

// 62597–62602 roadDraftTiles436：L 形路線，先走 x 再走 y（起點算一格）。座標要是整數（實驗線不是整數會卡死，這裡丟例外）
export function roadDraftTiles(x0: number, y0: number, x1: number, y1: number): [number, number][] {
  if (![x0, y0, x1, y1].every(Number.isInteger)) throw new Error('roadDraftTiles：座標要是整數');
  const out: [number, number][] = []; let x = x0, y = y0; out.push([x, y]);
  while (x !== x1) { x += Math.sign(x1 - x); out.push([x, y]); }
  while (y !== y1) { y += Math.sign(y1 - y); out.push([x, y]); }
  return out;
}

// 62779–62782 commitRoadDraft436：同一筆交易裡照路線順序一格一格蓋（paintTo 62751：圖外的格略過，不叫 doPlace、不標地價框）。
// 不先算總價，每一格各自比資金：錢中途不夠就從那一格起拒絕；後面若有更便宜的格（例如橋之後的陸地）照樣會蓋，同實驗線。
// built 跟 roadDraftTiles 一一對應（圖外＝false）。
// paintTo 的 L 形補間（62754–62757）在這裡等於逐格：L 形路線上圖內的格是連續一段、相鄰兩格只差一步
export function commitLine(st: BuildState, tool: string, x0: number, y0: number, x1: number, y1: number): { built: boolean[]; txn: Txn | null } {
  need(tool);
  const list = roadDraftTiles(x0, y0, x1, y1), built: boolean[] = [];
  openTxn(st);
  for (const [x, y] of list) built.push(inMap(st.w, x, y) ? doPlace(st, tool, x, y) : false);
  return { built, txn: closeTxn(st) };
}

// 62918 觸控點一下：一格一筆交易（openUndo → paintTo → closeUndo）。圖外不叫 doPlace
export function tap(st: BuildState, tool: string, x: number, y: number): { ok: boolean; txn: Txn | null } {
  need(tool);
  openTxn(st);
  const ok = inMap(st.w, x, y) ? doPlace(st, tool, x, y) : false;
  return { ok, txn: closeTxn(st) };
}

// 62974–63006 commitRect：框選（兩角任意順序）。
//   1. 先估總價：圖內、canPlace 通過的格才算；拆除遇到二級以上的住商工——多格的框略過不算，單格的要「再按一次」：
//      第一次（或距上次 3000 毫秒以上、或換了格子）只記下 dozeArm 就結束；3000 毫秒內在同一格再按才清掉 dozeArm 繼續（62983–62992）。
//   2. 總價大於資金就整塊不蓋（62996；相等可以）。確認拆除之後錢不夠，dozeArm 已經清掉，下次要重新確認（照抄）。
//   3. 同一筆交易裡從左上角逐列（y 外圈、x 內圈）蓋；圖內的格都叫 doPlace（不能蓋的也叫，照樣標地價框），多格拆除略過二級以上的住商工。
// 實驗線用瀏覽器的毫秒時鐘；這裡由呼叫端給 now（毫秒），dozeArm 存在 st 裡。
// refused：拒絕時實驗線提示的原文（確認拆除的提示少了種類名稱 KNAME，種類放在 arm）；skipped：略過的二級以上建築數（實驗線另有提示）
export function commitRect(st: BuildState, tool: string, ax: number, ay: number, bx: number, by: number, now: number):
  { placed: number; refused?: string; arm?: { k: number; lv: number }; cost: number; skipped: number; txn: Txn | null } {
  need(tool);
  const w = st.w;
  const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
  const single = x0 === x1 && y0 === y1;
  const hiBld = (x: number, y: number) => { const b = w.tiles[idx(w, x, y)].bld; return !!(b && b.k <= 3 && b.lv >= 2); };
  let done = 0, cost = 0, skippedHi = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inMap(w, x, y) || canPlace(st, tool, x, y)) continue;
    if (tool === 'doze' && hiBld(x, y)) {
      if (single) {
        const i = idx(w, x, y), arm = st.dozeArm;
        if (!(arm && arm.i === i && now - arm.t < DOZE_ARM_MS)) {
          st.dozeArm = { i, t: now };
          const b = w.tiles[i].bld as Bld;
          return { placed: 0, refused: `⚠️ 再點一次確認拆除 Lv${b.lv}`, arm: { k: b.k, lv: b.lv }, cost, skipped: 0, txn: null };
        }
        st.dozeArm = null;
      } else { skippedHi++; continue; }
    }
    cost += placeCost(st, tool, x, y);
  }
  if (cost > st.money) return { placed: 0, refused: '資金不足！需要 $' + Math.round(cost), cost, skipped: skippedHi, txn: null };
  openTxn(st);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inMap(w, x, y)) continue;
    if (tool === 'doze' && hiBld(x, y) && !single) continue;
    if (doPlace(st, tool, x, y)) done++;
  }
  return { placed: done, cost, skipped: skippedHi, txn: closeTxn(st) };
}

// 復原一筆（T460：undo 66594–66598 ＋ restoreTxn460 66581–66585 ＋ syncWorldAfterTransaction460 66570–66580）：
// 每一格換回存下的 JSON（深拷貝，整格物件換掉）、全額退錢、重算供電與覆蓋場。亂數不倒回，dozeArm 不動。
// syncWorld 裡的水、污水、清運、排水、緊急出勤、鐵路遮罩本線沒有；遮罩（recalcMask 等）是畫面。
// 實驗線 rebuildCov（53135–53157）最後把地價髒標記清掉（53154 landDirty=false、landBox=null），之後 syncWorld 沒有別的地方再改它，這裡照做。
// edu：教育場的輸入（實驗線 eduStaticAt 讀的 tech343／spec386／pol.schoolLunch），應該跟 st.tech／st.spec 同一份
export function undoTxn(st: BuildState, txn: Txn, edu: EduCtx): void {
  for (const sn of txn.snaps) st.w.tiles[sn.i] = JSON.parse(sn.s);              // 66583
  st.money += txn.spent || 0;                                                   // 66597
  st.onPower?.();                                                               // 66571
  rebuildCov(st.w, st.g, st.budget, edu);                                       // 66578
  st.landDirty = false; st.landBox = null;                                      // 53154
}

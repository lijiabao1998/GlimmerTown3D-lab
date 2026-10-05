// 建造規則（D011）：實驗線 canPlace／placeCost／doPlace 裡本卡工具的分支，加上觸控手勢（T436）與復原（T460）的語意。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d（index.html 行號）。對拍見 tools/lab-build.mjs、tools/unit-d011-build.mjs（規則 8）。
// 本卡的工具：路 alley／road／coll／art／hwy（等級 1–5）、分區 zr／zc／zi、電廠 plant（k5）、警察局 police（k11）、拆除 doze。
// D016 加公共設施：公園 park（k4）、消防局 fire（k6）、派出所 policeBox（k52）、醫院 hospital（k12）、診所 clinic（k13）、學校 school（k7）、
// 圖書館 library（k14）、郵局 post（k15）、墓園 cemetery（k16）。D019 加水塔 water（k10）、配水管 wpipe；D020 加垃圾場 dump（k8）；D033 加污水廠 sewage（k27）。其他工具一律丟例外。
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
import { countNear } from './grid.ts';
import { COVR, POL_SRC, covFieldOfK, rebuildCov, stampCov, stampPolSrc, stampPolTree, type EduCtx, type Grids, type SvcBudget } from './fields.ts';

// 37428：五級道路造價（小巷、支路、次幹道、主幹道、快速路）
export const ROAD_COST = [8, 15, 28, 55, 120];
// 37442 COST 裡本卡用到的鍵（COST.road／hwy／hwyBridge 實驗線沒人讀，道路造價只看 ROAD_COST；樹上加價用的是 COST.doze，51623）。
// D016 的九個鍵之後沒有被 Object.assign 改過（37536–37546、67110、67242），守衛在 vm 裡讀最終值核對
export const COST = { zone: 8, plant: 550, police: 500, doze: 2, bridge: 60,
  park: 60, fire: 400, policeBox: 250, hospital: 600, clinic: 250, school: 350, library: 280, post: 320, cemetery: 350,
  water: 400, wpipe: 10,     // D019：水塔、配水管（37442）
  dump: 300,                 // D020：垃圾場（37442）
  sewage: 500,               // D033：污水廠（37442）
  oilwell: 1300, mine: 1500 };   // D040：油井、礦場（37442）
// 62731：復原堆疊上限（closeUndo 推進 undoStack 後超過 40 筆就丟最舊的）
export const UNDO_MAX = 40;
// 62985：單格拆除二級以上的住商工，要在 3000 毫秒內再按一次
export const DOZE_ARM_MS = 3000;

export const D011_TOOLS: readonly string[] = ['alley', 'road', 'coll', 'art', 'hwy', 'zr', 'zc', 'zi', 'plant', 'police', 'doze'];
// D016：公共設施（實驗線 canPlace 51278 跟電廠、警察局同一支；水塔、垃圾場不在這批）
export const D016_TOOLS: readonly string[] = ['park', 'fire', 'policeBox', 'hospital', 'clinic', 'school', 'library', 'post', 'cemetery'];
// D019：水塔（點，canPlace 同公共設施）、配水管（拉線，isLineTool436 62763）
export const D019_TOOLS: readonly string[] = ['water', 'wpipe'];
// D020：垃圾場（點，canPlace 同公共設施 51278）
export const D020_TOOLS: readonly string[] = ['dump'];
// D033：污水廠（點；canPlace 在實驗線 51384–51389 那一支：交通線、架空配電線、高壓走廊都擋，還要鄰水）
export const D033_TOOLS: readonly string[] = ['sewage'];
// D040：油井、礦場（點；canPlace 在實驗線 51365 那一桶＋51385–51390 的通用判定＋51430／51431 的資源格判定：站在對的資源格上才行；1×1、沒有隨機、沒有覆蓋場）
export const D040_TOOLS: readonly string[] = ['oilwell', 'mine'];
const TOOL_SET = new Set([...D011_TOOLS, ...D016_TOOLS, ...D019_TOOLS, ...D020_TOOLS, ...D033_TOOLS, ...D040_TOOLS]);
function need(tool: string): void { if (!TOOL_SET.has(tool)) throw new Error('未搬：' + tool); }
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
  onPlace?: (tool: string, x: number, y: number, ok: boolean, cost: number) => void;
  onWater?: () => void;   // D019：實驗線放水塔、水管、拆除之後當場重算供水網（52405 computeWater）；本線每天開頭也重算（day.ts），這裡只通知   // 每一次 doPlace 之後（成功或失敗；cost＝實付，失敗 0）。給對拍記錄用，不改模擬
  resource?: ArrayLike<number>;   // D040：資源圖（0 沒有、1 油田、2 礦藏；Sim.res.resource，實驗線的 RESOURCE）；沒給＝全 0（油井、礦場一律蓋不下去）
  protect?: boolean;      // D024：本線的施工把讀進來的鐵路、手工配電線、地下線、高架與立交當成看不見的（見 FOREIGN_LAYERS）；對拍實驗線的守衛不開
}

// 53074–53084：地價基準的髒框。landDirty＝true、landBox＝null 在實驗線是「隔天整張重算」（每天收尾 55279 → 64129／67355 都是這個狀態），
// 但這裡 if(!landBox) 把它當成「還沒有框」，整張重算就被換成這一個框——實驗線的 bug（D011 卡第 8 節），照抄；實驗線修了本線跟著改。
// 框超出地圖照樣夾（圖外的座標可能夾出 x1<x0 的空框，照抄）；框是同一個陣列就地擴大（實驗線改 landBox 物件的欄位）。
export function markLandDirty(st: Pick<BuildState, 'w' | 'landDirty' | 'landBox'>, x: number, y: number, r: number): void {
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

// D024：讀檔會把鐵路（rl）、手工配電線（lvl475）、地下線（udl475）、高架（fly475）、立交（ix475）的旗標帶進格子（算就業、維護費、物流運作中、電力載體用）；
// 但本線不畫、不能蓋這幾層，歷史事件（src/sim/city.ts DozeEvent）也還沒有它們的拆除碼。本線的施工（BuildState.protect）因此把它們當成看不見的：
// 拆除不挑它們（拆的是下一層）、canPlace 的「這裡沒東西」不算它們，跟 D024 之前（格子上根本沒有這些旗標）一樣。拆路照實驗線一併清掉高架與立交旗標（51808–51809），那是路這一層的事。
// 對拍實驗線的守衛（tools/unit-d011-*.mjs）不開 protect，逐字照實驗線。
// D035：讀檔又多帶了輕軌、路旁裝飾、公車站、高壓線、地下高壓、水幹管、污水幹管、裝飾、單行道、紅綠燈、公車專用道（src/sim/rules/lab.ts FLAG_LAYERS）；一樣不畫、一樣看不見。
// 拆路照實驗線一併清掉其中的路旁裝飾、公車站、公車專用道、單行道、紅綠燈（51808，`doze` 的 road 分支）——不撤覆蓋印（51808 沒有 stampCov，實驗線的行為，照抄）。
export const FOREIGN_LAYERS = ['rail', 'lv475', 'ud475', 'fly475', 'ix475', 'tram', 'rdec', 'bus', 'hv471', 'ug471', 'wm472', 'sm472', 'deco', 'oneway', 'light', 'busLane'] as const;
const seen = (t: Tile, protect?: boolean): Tile => {
  if (!protect || !FOREIGN_LAYERS.some(k => t[k])) return t;
  const q: Tile = { ...t }; for (const k of FOREIGN_LAYERS) q[k] = 0;
  return q;
};

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
    case 'park': case 'plant': case 'water': case 'fire': case 'police': case 'policeBox': case 'hospital': case 'clinic': case 'school': case 'library': case 'post': case 'cemetery': case 'dump':   // 51278–51282
      if (t.t !== 2 && t.t !== 1) return '只能蓋在陸地上';
      if (t.road) return '道路上不能建造';
      if (t.bld) return '已有建築';
      return null;
    case 'sewage': {                                                            // 51384–51389、51446：1×1；鄰水（3×3 內水格 ≥ 2）
      const q = seen(t, st.protect);
      if (t.t !== 2 && t.t !== 1) return '只能蓋在陸地上';
      if (t.road || q.rail || t.tram) return '交通線上不能建造';
      if (q.lv475) return '架空配電線／電線桿擋住';
      if (t.hv471 || t.ug471) return '高壓電力走廊擋住';
      if (t.bld) return '已有建築';
      if (countNear(w, x, y, 1, (tt: Tile) => tt.t === 0) < 2) return '需鄰近水域(≥2格)';
      return null; }
    case 'oilwell': case 'mine': {                                              // 51365 桶＋51385–51390 通用判定＋51430／51431：1×1，站在對的資源格上
      const q = seen(t, st.protect), r = st.resource ? st.resource[idx(w, x, y)] : 0;
      if (t.t !== 2 && t.t !== 1) return '只能蓋在陸地上';
      if (t.road || q.rail || t.tram) return '交通線上不能建造';
      if (q.lv475) return '架空配電線／電線桿擋住';
      if (t.hv471 || t.ug471) return '高壓電力走廊擋住';
      if (t.bld) return '已有建築';
      if (toolId === 'oilwell' && r !== 1) return '需油田資源格';                // 51430
      if (toolId === 'mine' && r !== 2) return '需礦藏資源格';                    // 51431
      return null; }
    case 'wpipe':                                                               // 51312–51315：陸地、還沒有水管就行（路、分區、建築底下都可以鋪）
      if (t.t !== 2 && t.t !== 1) return '只能鋪在陸地上';
      if (t.wp) return '已有水管';
      return null;
    case 'doze': {                                                              // 51353–51355（rdec、bus 不在清單上：只有它們的格子拆不了）
      const q = seen(t, st.protect);
      if (!q.road && !q.bld && !q.zone && !q.tree && !q.deco && !q.ruin && !q.rail && !q.tram && !q.dock && !q.oneway && !q.light && !q.busLane && !q.levee && !q.flood
        && !q.wp && !q.crater && !q.hv471 && !q.ug471 && !q.wm472 && !q.sm472 && !q.lv475 && !q.ud475 && !q.fly475 && !q.ix475) return '這裡沒東西';
      return null; }
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
    case 'park': c = COST.park; break;                                          // 51516
    case 'plant': c = COST.plant; break;                                        // 51517
    case 'water': c = COST.water; break;                                        // 51518
    case 'wpipe': c = COST.wpipe; break;                                        // 51519（樹上照樣 +COST.doze，水管又不清樹：照抄）
    case 'fire': c = COST.fire; break;                                          // 51525
    case 'police': c = COST.police; break;                                      // 51526
    case 'policeBox': c = COST.policeBox; break;                                // 51527
    case 'hospital': c = COST.hospital; break;                                  // 51528
    case 'clinic': c = COST.clinic; break;                                      // 51529
    case 'school': c = COST.school; break;                                      // 51530
    case 'library': c = COST.library; break;                                    // 51531
    case 'post': c = COST.post; break;                                          // 51532
    case 'cemetery': c = COST.cemetery; break;                                  // 51533
    case 'dump': c = COST.dump; break;                                          // 51534
    case 'sewage': c = COST.sewage; break;                                      // 51578
    case 'oilwell': c = COST.oilwell; break;                                    // 51614（D040）
    case 'mine': c = COST.mine; break;                                          // 51615
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
  switch (dozeLayer(seen(t, st.protect))) {
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
      // 本線（protect）看不見輕軌、路旁裝飾、公車站，一下就拆到路；實驗線的拆除鏈先拆它們才輪到路（51800、51802、51803：輕軌清掉、裝飾與公車站撤覆蓋印），
      // 所以 51808 清 rdec／bus 在實驗線永遠是空動作。本線一次拆完要自己做那幾步，不然覆蓋場留著一個不存在的公車站，直到下一次重算
      if (st.protect) { if (t.rdec) stampCov(g, b, 'rdec', x, y, COVR.rdec, -1); if (t.bus) stampCov(g, b, 'bus', x, y, COVR.bus, -1); t.tram = 0; t.tramBridge = 0; }
      t.road = 0; t.rc = 0; t.hw = 0; t.bridge = 0; t.rdec = 0; t.bus = 0; t.busLane = 0; t.oneway = 0; t.light = 0; t.fly475 = 0; t.ix475 = 0;
      break;
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
    case 'park':                                                                // 51667–51670：變體抽一次亂數 ri(9)
      t.bld = { k: 4, lv: 1, v: st.rng.ri(9), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'park', x, y, COVR.park, 1);
      break;
    case 'plant':                                                               // 51671–51675：變體看座標，不抽亂數
      t.bld = { k: 5, lv: 1, v: (x * 7 + y * 13) % 3, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'plant', x, y, COVR.plant, 1);
      stampPolSrc(g, x, y, 5, 1);
      break;
    case 'water':                                                               // 51676–51678：變體抽一次亂數 ri(5)
      t.bld = { k: 10, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      break;
    case 'wpipe':                                                               // 51679–51681：只設 wp；接頭遮罩（recalcInfraMask4_475）是畫面的事，本線在畫面層算
      t.wp = 1;
      break;
    case 'fire':                                                                // 51682–51685
      t.bld = { k: 6, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'fire', x, y, COVR.fire, 1);
      break;
    case 'police':                                                              // 51686–51689：變體抽一次亂數 ri(5)
      t.bld = { k: 11, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'police', x, y, COVR.police, 1);
      break;
    case 'policeBox':                                                           // 51690–51693：變體固定 0，不抽亂數
      t.bld = { k: 52, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'police2', x, y, COVR.police2, 1);
      break;
    case 'hospital':                                                            // 51694–51697
      t.bld = { k: 12, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'hospital', x, y, COVR.hospital, 1);
      break;
    case 'clinic':                                                              // 51698–51701
      t.bld = { k: 13, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'clinic', x, y, COVR.clinic, 1);
      break;
    case 'school':                                                              // 51702–51705
      t.bld = { k: 7, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'school', x, y, COVR.school, 1);
      break;
    case 'library':                                                             // 51706–51709
      t.bld = { k: 14, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'library', x, y, COVR.library, 1);
      break;
    case 'post':                                                                // 51710–51713
      t.bld = { k: 15, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'post', x, y, COVR.post, 1);
      break;
    case 'cemetery':                                                            // 51714–51717
      t.bld = { k: 16, lv: 1, v: st.rng.ri(5), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampCov(g, st.budget, 'cemetery', x, y, COVR.cemetery, 1);
      break;
    case 'dump':                                                                // 51718–51721：變體抽一次亂數 ri(3)；垃圾場是污染源（T110）
      t.bld = { k: 8, lv: 1, v: st.rng.ri(3), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      stampPolSrc(g, x, y, 8, 1);
      break;
    case 'sewage':                                                              // 52180–52182：變體抽一次亂數 ri(3)；沒有覆蓋場、不是污染源
      t.bld = { k: 27, lv: 1, v: st.rng.ri(3), age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      break;
    case 'oilwell':                                                             // 52325：沒有隨機（v 固定 0）、沒有覆蓋場；抽取見 tick() 資源區塊（resource.ts）
      t.bld = { k: 49, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
      break;
    case 'mine':                                                                // 52328
      t.bld = { k: 50, lv: 1, v: 0, age: 0, pw: true, h: 1 }; t.tree = 0; t.zone = 0; t.deco = 0;
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
  if (toolId === 'water' || toolId === 'wpipe' || toolId === 'doze') st.onWater?.();      // 52405（D019）：當場重算供水網（舊式只更新每一格的 wr）
  // 52409 清運（sanDirty445）：本線每天在 tick 裡整張重算（day.ts 55259），建築卡要看時當場算（src/sim/rules/garbage.ts）。
  // 52406–52412 污水、排水、緊急出勤（消防局、派出所、警察局也會設，52410）、韌性、地面重繪的髒旗標：本線沒有這些系統（或是畫面）
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
  st.onWater?.();                                                               // 66572（D019）
  rebuildCov(st.w, st.g, st.budget, edu);                                       // 66578
  st.landDirty = false; st.landBox = null;                                      // 53154
}

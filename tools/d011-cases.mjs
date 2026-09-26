// D011 建造規則對拍的隨機輸入，以及兩邊共用的跑法（實驗線那邊 tools/lab-build.mjs 產黃金樣本、本線 tools/unit-d011-build.mjs 守衛共用）。
// 同一個種子產生同一批案例；每次呼叫 cases(k) 都回新的物件（操作會改格子），兩邊各自產生、互不共用。
// 每個案例＝一張隨機小圖（N 10–18，另有 14 張 N 24–34 的大圖量地價框的邊：水、沙、草、高地、樹、各級道路與橋、分區、住商工 lv1–3、電廠、警察局、多格建築、其他圖層）
// ＋起始資金、難度、科技／特化、服務預算、地價髒框的起始狀態、亂數種子＋一串操作（點、拉線、框選、復原、設定資金；每張 ≥20 筆）。
// 新增家族一律接在最後、分支只在自己的家族裡抽亂數：前面各家族的案例逐字不變。
// runMap(impl, c) 用同一套步驟跑一個案例、逐筆記錄（兩邊只差 impl：實驗線是 vm 裡的原始碼，本線是 src/sim/rules/build.ts）：
//   pre（點：施工前 canPlace 的理由與 placeCost）、res（點＝成敗；線＝路線與逐格成敗；框＝蓋成幾格與提示原文；復原＝有沒有東西可退）、
//   calls（每一次 doPlace 的 [x,y,成敗]，照呼叫順序）、txn（這一筆推進復原堆疊的交易：[spent, 快照格號…]）、depth（堆疊深度）、
//   money（完全相等）、log（亂數 R／ri 與當場重算供電 P 的呼叫順序）、tiles（變了的格：欄位 [名稱, 新值]，畫面用的遮罩不算）、
//   land（地價髒標記與框）、arm（拆除確認）、fh（覆蓋 60 場＋POLBASE／POLTREE／POL／LANDBASE／LAND／EDU 的雜湊）；
//   每張圖結束時再記全部場（D010 的 snapshot：非零格 [間隔,值]＋型別與長度）。每一筆 canon() 成字串，兩邊比字串。
import crypto from 'node:crypto';
import vm from 'node:vm';
import { mulberry32 } from '../src/sim/rng.ts';
import { canon, snapshot, COV_FIELDS } from './d010-cases.mjs';

export { canon };
export const D011_SEED = 20261011;
// 家族：random 隨機城、money 資金邊界（剛好夠／差一點／負數）、doze 拆除（二級以上、多格建築、各圖層、確認）、sandbox 沙盒、
// tech 科技與特化係數（造價有小數）、undo 長串復原（超過堆疊上限 40）、edge 貼邊與圖外（線與框伸出地圖、欄位稀疏的格子）、
// wide 大一點的圖（N 24–34；地價髒框半徑 20，N ≤ 21 時框一定蓋滿整張，量不到框的邊）、
// multi 多格建築的占地帶別的圖層（框選／拉線拆除：第一格整棟清掉、占地每格存快照並記 seen（51789），框裡後面的格再拆下一層時不能再存（51635）；
//   含從 ref 格起框、之後復原）
export const FAMILIES = [['random', 104], ['money', 24], ['doze', 28], ['sandbox', 12], ['tech', 18], ['undo', 16], ['edge', 24], ['wide', 14], ['multi', 16]];
export const D011_COUNT = FAMILIES.reduce((n, [, c]) => n + c, 0);

const ROADS = ['alley', 'road', 'coll', 'art', 'hwy'], ZONES = ['zr', 'zc', 'zi'];
const SVC1 = [5, 5, 11, 11, 4, 6, 7, 126, 52, 10, 12, 14];            // 單格服務：電廠、警察局、公園、消防、學校、遊樂場、派出所、水塔、醫院、圖書館
const MULTI = [[9, 2], [9, 2], [20, 2], [62, 2], [132, 2], [118, 2], [61, 3]];   // 多格（實驗線 MSZ 66803）：體育場、停車場、焚化發電、避難公園、肥料廠、消防總局
const MULTI_M = [...MULTI, [61, 3], [61, 3]];                          // multi 家族多放幾棟 3×3（占地 9 格，框裡的後段格多）
const ORPHAN_K = [9, 20, 62];                                          // 找不到根格的 ref 格（拆除走單格分支）
const NEXT_D = [0, 0, 0, -1, -1, -0.01, -0.5, 0.5, 1, -8, -30];        // 「下一筆的造價＋d」
const MONEY_V = [0, -1, -50, 7, 8, 14, 15, 27.5, 60, 120, 499, 500, 549, 550, 1234.56, 3000, 1e6];
const ARM_GAPS = [1, 500, 1500, 2999, 3000, 3001, 6000];               // 拆除確認的間隔（3000 毫秒內才算，62985）
const TECH_COST = ['B5', 'C8', 'D4a'], TECH_EDU = ['C1', 'C4a', 'C4b', 'D7'];
const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function seedOf(name, k) {
  let h = (D011_SEED ^ 0x9e3779b9) >>> 0;
  for (const c of name) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  h = Math.imul(h ^ (k + 1), 2654435761) >>> 0;
  h ^= h >>> 15;
  return Math.imul(h, 2246822519) >>> 0;
}
function gen(seed) {
  const R = mulberry32(seed);
  const int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  return { R, int, ch, pick };
}

// 格子的形狀照實驗線讀檔（load 66880–66890）；sparse＝只有用到的欄位（本線自己的格子可能這樣），拆除、鋪路時才長出欄位
function blankTile(i, t, el, sparse) {
  if (sparse) { const o = { t, bld: null }; if (el) o.el = 1; return o; }
  return { t, tree: 0, gv: i & 3, road: 0, bridge: 0, hw: 0, rc: 0, mask: 0, zone: 0, bld: null, rp: false, wp: 0, wr: false, wm: 0, deco: 0, ruin: 0, rdec: 0, el, em: 0, bus: 0,
    rail: 0, railBridge: 0, railMask: 0, dock: 0, oneway: 0, light: 0, parkMeter: 0, busLane: 0, tram: 0, tramBridge: 0, tramMask: 0, office: 0, flood: 0, levee: 0, abandoned: 0,
    crater: 0, hv471: 0, ug471: 0, hvMask471: 0, wm472: 0, sm472: 0, wmMask472: 0, smMask472: 0, lv475: 0, ud475: 0, lvMask475: 0, udMask475: 0, wpMask475: 0, fly475: 0, ix475: 0 };
}
const land = t => t.t === 1 || t.t === 2;
const free = t => land(t) && !t.road && !t.bld;
const clr = (t, k) => { if (t[k]) t[k] = 0; };
const pickRc = g => { const u = g.R(); return u < .2 ? 1 : u < .55 ? 2 : u < .75 ? 3 : u < .9 ? 4 : 5; };

function genTiles(g, N, fam) {
  const n = N * N, sparse = fam === 'edge' && g.ch(.35), ter = new Array(n).fill(2);
  if (g.ch(fam === 'edge' ? .6 : .85)) {                                 // 河：直或橫、寬 1–2、會彎
    const vert = g.ch(.5), wd = g.int(1, 2); let c = g.int(1, N - 3);
    for (let s = 0; s < N; s++) {
      for (let d = 0; d < wd; d++) { const a = c + d; if (a >= 0 && a < N) ter[vert ? s * N + a : a * N + s] = 0; }
      if (g.ch(.3)) c = Math.max(0, Math.min(N - 2, c + (g.ch(.5) ? 1 : -1)));
    }
  }
  if (g.ch(.35)) { const cx = g.int(0, N - 1), cy = g.int(0, N - 1), r = g.int(1, 2);   // 湖
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 1) ter[y * N + x] = 0; }
  const near = new Array(n).fill(false);
  for (let i = 0; i < n; i++) if (ter[i] === 0) for (const [dx, dy] of D4) { const x = i % N + dx, y = ((i / N) | 0) + dy; if (x >= 0 && y >= 0 && x < N && y < N) near[y * N + x] = true; }
  for (let i = 0; i < n; i++) if (ter[i] === 2 && (near[i] ? g.ch(.6) : g.ch(.04))) ter[i] = 1;   // 沙：水邊多
  const el = new Array(n).fill(0);
  if (g.ch(.5)) { const cx = g.int(0, N - 1), cy = g.int(0, N - 1), r = g.int(1, 3);   // 高地（只在草地上）
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (ter[y * N + x] === 2 && Math.max(Math.abs(x - cx), Math.abs(y - cy)) <= r) el[y * N + x] = 1; }
  return { tiles: ter.map((t, i) => blankTile(i, t, el[i], sparse)), sparse };
}

function setRoad(t, rc, sparse) {   // 照實驗線鋪路寫的欄位（51645）
  t.road = 1; t.rc = rc;
  if (!sparse || rc === 5) t.hw = rc === 5 ? 1 : 0;
  if (!sparse || t.t === 0) t.bridge = t.t === 0 ? 1 : 0;
  clr(t, 'tree'); clr(t, 'zone'); clr(t, 'deco');
}
function layRoads(g, tiles, N, lines, sparse) {
  for (let l = 0; l < lines; l++) {
    const horiz = g.ch(.5), at = g.int(0, N - 1), a = g.int(0, N - 2), b = Math.min(N - 1, a + g.int(2, N));
    let rc = pickRc(g);
    for (let s = a; s <= b; s++) {
      const t = tiles[horiz ? at * N + s : s * N + at];
      if (t.bld) continue;
      if (g.ch(.12)) rc = pickRc(g);
      setRoad(t, rc, sparse);
      if (!t.bridge) {   // 路上的附屬（拆除時比路先拆：rdec／bus 51802–51803；oneway／light／busLane／高架在路之後）
        if (g.ch(.07)) t.rdec = 1; if (g.ch(t.rdec ? .3 : .05)) t.bus = 1; if (g.ch(.02)) t.busLane = 1; if (g.ch(.02)) t.oneway = 1;
        if (g.ch(.015)) t.light = 1; if (g.ch(.015)) t.fly475 = 1; if (g.ch(.01)) t.ix475 = g.int(1, 3);
      }
    }
  }
}
function placeMulti(g, tiles, N, k, sz, edge, sparse) {
  for (let a = 0; a < 40; a++) {
    const x = edge && g.ch(.4) ? g.pick([N - 1, N - sz + 1, 0]) : g.int(0, N - sz), y = edge && g.ch(.4) ? g.pick([N - 1, 0]) : g.int(0, N - sz);
    const cells = []; let ok = true;
    for (let dy = 0; dy < sz && ok; dy++) for (let dx = 0; dx < sz; dx++) {
      const X = x + dx, Y = y + dy; if (X >= N || Y >= N) continue;          // 占地伸出地圖（實驗線讀檔 inMap 才寫 ref，拆除 inMap 才清）
      const t = tiles[Y * N + X]; if (!free(t)) { ok = false; break; } cells.push([X, Y, t]);
    }
    if (!ok) continue;
    for (const [X, Y, t] of cells) { clr(t, 'tree'); clr(t, 'zone'); clr(t, 'deco'); t.bld = X === x && Y === y ? { k, lv: 1, v: g.int(0, 2), age: g.int(0, 60), pw: true, h: 1, sz } : { k, ref: [x, y] }; }
    if (cells.length > 1 && g.ch(.12)) { const t = g.pick(cells.slice(1))[2]; if (sparse && g.ch(.5)) delete t.bld; else t.bld = null; }   // 占地裡的洞（拆除照樣清）
    return [x, y, sz, cells];   // 根格一定在圖內，cells[0] 就是根格
  }
  return null;
}
// multi 家族：占地的格子另外帶別的圖層（讀檔時各層獨立，66880–66890）。拆除鏈（51777–51818）裡排在建築後面的層，
// 要等建築整棟清掉之後、同一筆交易裡再拆到這一格才拆得到；rdec／bus 不在拆除清單上（51353），只剩它們時拆不動；
// ruin／crater 排在建築前面：這一格先拆它們，建築留給占地裡的下一格（整棟清掉時這一格已經存過快照）
const FOOT = [
  ['tree', (t, g) => { t.tree = g.int(1, 6); }], ['tree', (t, g) => { t.tree = g.int(1, 6); }], ['tree', (t, g) => { t.tree = g.int(1, 6); }],
  ['zone', (t, g) => { t.zone = g.int(1, 3); if (t.zone === 2 && g.ch(.4)) t.office = 1; }], ['zone', (t, g) => { t.zone = g.int(1, 3); }], ['zone', (t, g) => { t.zone = g.int(1, 3); }],
  ['wp', t => { t.wp = 1; }], ['wp', t => { t.wp = 1; }], ['flood', t => { t.flood = 1; }], ['flood', t => { t.flood = 1; }],
  ['deco', (t, g) => { t.deco = g.int(1, 3); }], ['levee', t => { if (t.t === 2) t.levee = 1; else t.flood = 1; }],
  ['road', (t, g) => { const rc = pickRc(g); t.road = 1; t.rc = rc; t.hw = rc === 5 ? 1 : 0; }], ['rail', t => { t.rail = 1; }], ['tram', t => { t.tram = 1; }],
  ['lv475', t => { t.lv475 = 1; }], ['ug471', t => { t.ug471 = 1; }], ['wm472', t => { t.wm472 = 1; }], ['oneway', t => { t.oneway = 1; }], ['light', t => { t.light = 1; }],
  ['busLane', t => { t.busLane = 1; }], ['rdec', t => { t.rdec = 1; }], ['bus', t => { t.bus = 1; }], ['ruin', t => { t.ruin = 1; }], ['crater', t => { t.crater = 1; }],
];
function dressFoot(g, cells) {   // 非根格七成五、根格五成帶 1–2 層
  cells.forEach(([, , t], q) => { if (g.ch(q ? .75 : .5)) for (let r = g.ch(.3) ? 2 : 1; r > 0; r--) g.pick(FOOT)[1](t, g); });
}
// 建築以外還有拆得到的層（canPlace 拆除清單 51353–51355 去掉 bld）
const extraLayer = t => !!(t.road || t.zone || t.tree || t.deco || t.ruin || t.rail || t.tram || t.dock || t.oneway || t.light || t.busLane || t.levee || t.flood || t.wp
  || t.crater || t.hv471 || t.ug471 || t.wm472 || t.sm472 || t.lv475 || t.ud475 || t.fly475 || t.ix475);
function placeFree(g, tiles, N, fn) {
  for (let a = 0; a < 40; a++) { const i = g.int(0, N * N - 1), t = tiles[i]; if (free(t)) { fn(t, i % N, (i / N) | 0); return; } }
}
const rci = (g, k, lvs) => {   // 讀檔的形狀（66906–66911）：k1 多 den、we
  const b = { k, lv: g.pick(lvs), v: g.int(0, 5), age: g.int(0, 80), pw: g.ch(.85), h: .6, fire: 0 };
  if (k === 1) { b.den = g.int(1, 5); b.we = g.int(0, 2); }
  if (g.ch(.15)) b.crime = 1;
  return b;
};
// 稀有圖層：拆除一次拆一層的順序靠它們驗（51777–51818）
const RARE = [
  // 焦土多半是燒掉的住商工，分區還在（拆焦土連分區一起清，51777）
  ['ruin', t => free(t), (t, g) => { t.ruin = 1; if (!t.zone && g.ch(.7)) t.zone = g.int(1, 3); }], ['crater', t => free(t), t => { t.crater = 1; }],
  ['rail', t => !t.bld, t => { t.rail = 1; t.railBridge = t.t === 0 ? 1 : 0; }], ['tram', t => !t.bld, t => { t.tram = 1; t.tramBridge = t.t === 0 ? 1 : 0; }],
  ['dock', t => t.t === 0, t => { t.dock = 1; }], ['lv475', t => t.t !== 0 && !t.bld, t => { t.lv475 = 1; }], ['ud475', t => land(t) && !t.bld, t => { t.ud475 = 1; }],
  ['wp', t => land(t), t => { t.wp = 1; }], ['hv471', t => !t.bld, t => { t.hv471 = 1; }], ['ug471', t => land(t) && !t.bld, t => { t.ug471 = 1; }],
  ['wm472', t => land(t) && !t.bld, t => { t.wm472 = 1; }], ['sm472', t => land(t) && !t.bld, t => { t.sm472 = 1; }],
  ['levee', t => t.t === 2 && !t.bld, t => { t.levee = 1; }], ['flood', t => land(t), t => { t.flood = 1; }],
  // 單行道、號誌、公車專用道通常在路上（拆路時一起清，51808）；讀檔時各層獨立（66885–66886），沒有路的格子也可能帶著，拆除鏈最後幾支靠它們
  ['oneway', t => land(t) && !t.road && !t.bld, t => { t.oneway = 1; }], ['light', t => land(t) && !t.road && !t.bld, t => { t.light = 1; }],
  ['busLane', t => land(t) && !t.road && !t.bld, t => { t.busLane = 1; }],
];

// 疊層格：同一格疊 2–5 層（讀檔時各層獨立，實驗線照樣一層一層拆），拆除鏈兩兩之間的先後靠它們驗
const STACK = [
  ['ruin', t => { t.ruin = 1; }], ['crater', t => { t.crater = 1; }], ['rail', t => { t.rail = 1; t.railBridge = t.t === 0 ? 1 : 0; }],
  ['tram', t => { t.tram = 1; t.tramBridge = t.t === 0 ? 1 : 0; }], ['dock', t => { t.dock = 1; }], ['rdec', t => { t.rdec = 1; }], ['bus', t => { t.bus = 1; }],
  ['lv475', t => { t.lv475 = 1; }], ['ud475', t => { t.ud475 = 1; }], ['fly475', t => { t.fly475 = 1; }], ['ix475', t => { t.ix475 = 2; }], ['hv471', t => { t.hv471 = 1; }],
  ['ug471', t => { t.ug471 = 1; }], ['wm472', t => { t.wm472 = 1; }], ['sm472', t => { t.sm472 = 1; }], ['road', t => { t.road = 1; t.rc = 2; t.hw = 0; t.bridge = t.t === 0 ? 1 : 0; }],
  ['wp', t => { t.wp = 1; }], ['zone', t => { t.zone = 2; t.office = 1; }], ['tree', t => { t.tree = 3; }], ['deco', t => { t.deco = 2; }], ['oneway', t => { t.oneway = 1; }],
  ['light', t => { t.light = 1; }], ['busLane', t => { t.busLane = 1; }], ['levee', t => { t.levee = 1; }], ['flood', t => { t.flood = 1; }],
];
// 拆除鏈（51777–51818）相鄰兩層：拆除家族第 j 張放其中 3 對（兩層疊在同一格），28 張輪完每一對都出現好幾次
const CHAIN = ['ruin', 'crater', 'bld', 'rail', 'tram', 'dock', 'rdec', 'bus', ['lv475', 'ud475'], ['fly475', 'ix475'], ['hv471', 'ug471'], ['wm472', 'sm472'],
  'road', 'wp', 'zone', 'tree', 'deco', 'oneway', 'light', 'busLane', 'levee', 'flood'];
const PUT = Object.fromEntries(STACK);
function putLayer(t, layer, g, alt) {
  const name = Array.isArray(layer) ? layer[alt & 1] : layer;
  if (name === 'bld') t.bld = rci(g, g.int(1, 3), [1, 2]);
  else PUT[name](t);
}
function genMap(g, fam, j) {
  const N = fam === 'edge' || fam === 'undo' ? g.int(10, 12) : fam === 'wide' ? g.int(24, 34) : g.int(10, 18), dense = fam === 'doze', multi = fam === 'multi';
  const { tiles, sparse } = genTiles(g, N, fam);
  layRoads(g, tiles, N, dense ? g.int(2, 4) : fam === 'wide' ? g.int(5, 9) : multi ? g.int(1, 3) : g.int(2, 5), sparse);
  const multis = [];   // [根格 x, y, sz, 占地格]
  for (let s = 0, m = dense ? g.int(1, 3) : multi ? g.int(4, 6) : g.int(0, 2); s < m; s++) {
    const [k, sz] = g.pick(multi ? MULTI_M : MULTI), p = placeMulti(g, tiles, N, k, sz, fam === 'edge' || (multi && g.ch(.2)), sparse);   // multi 兩成貼邊（占地伸出地圖）
    if (p) multis.push(p);
  }
  if (multi) for (const p of multis) dressFoot(g, p[3]);
  for (let s = 0, m = dense ? g.int(2, 5) : g.int(0, 3); s < m; s++) {
    const k = g.pick(SVC1);
    placeFree(g, tiles, N, (t, x, y) => { t.bld = { k, lv: 1, v: k === 5 ? (x * 7 + y * 13) % 3 : g.int(0, 4), age: g.int(0, 60), pw: true, h: 1 }; clr(t, 'zone'); clr(t, 'deco'); if (!g.ch(.1)) clr(t, 'tree'); });
  }
  const pz = dense ? .5 : fam === 'undo' ? .2 : .35, pb = dense ? .8 : .45, lvs = dense ? [1, 2, 2, 3, 3] : [1, 1, 2, 3];
  for (let i = 0; i < N * N; i++) {
    const t = tiles[i]; if (!free(t) || !g.ch(pz)) continue;
    const z = g.int(1, 3); t.zone = z; if (z === 2 && g.ch(.3)) t.office = 1;
    if (g.ch(pb)) { t.bld = rci(g, z, lvs); clr(t, 'deco'); }
  }
  for (const t of tiles) {
    if (!land(t) || t.road) continue;
    if (g.ch(t.bld ? .03 : t.zone ? .07 : dense ? .2 : .14)) t.tree = g.int(1, 6);   // 建築、分區底下偶爾也有樹（讀檔 tre 與 bl 各自獨立）
    else if (!t.bld && !t.zone && g.ch(.05)) t.deco = g.int(1, 3);
  }
  const rare = [...(dense ? RARE : [])];   // 拆除家族每一種稀有圖層至少放一個
  for (let s = 0, m = dense ? g.int(0, 4) : fam === 'edge' ? g.int(1, 6) : g.int(0, 4); s < m; s++) rare.push(g.pick(RARE));
  for (const [, ok, put] of rare) for (let a = 0; a < 30; a++) { const t = tiles[g.int(0, N * N - 1)]; if (ok(t)) { put(t, g); break; } }
  const stacks = [];
  if (dense) for (let q = 0; q < 3; q++) {
    const a = (3 * j + q) % (CHAIN.length - 1);
    placeFree(g, tiles, N, (t, x, y) => { putLayer(t, CHAIN[a], g, j); putLayer(t, CHAIN[a + 1], g, j >> 1); stacks.push(y * N + x); });
  }
  if (dense) for (let s = 0, m = g.int(3, 5); s < m; s++) placeFree(g, tiles, N, (t, x, y) => {
    const pool = STACK.slice();
    for (let q = 0, r = g.int(2, 5); q < r; q++) pool.splice(g.int(0, pool.length - 1), 1)[0][1](t);
    stacks.push(y * N + x);
  });
  if (g.ch(fam === 'random' || dense || fam === 'edge' ? .15 : 0)) placeFree(g, tiles, N, t => {
    const ref = g.ch(.5) ? [g.pick([-1, N]), g.int(0, N - 1)] : [g.int(0, N - 1), g.int(0, N - 1)];
    const inside = ref[0] >= 0 && ref[0] < N;
    t.bld = { k: g.pick(ORPHAN_K), ref: inside && tiles[ref[1] * N + ref[0]].bld ? [-1, 0] : ref };   // 根格位置有建築就改指圖外（指到自己也算孤兒：sz 讀不到＝單格）
  });
  return { N, tiles, sparse, stacks, multis: multis.map(([x, y, sz]) => [x, y, sz]) };
}

function paramsOf(g, fam) {
  const diff = fam === 'sandbox' ? 3 : g.ch(.08) ? g.pick([0, 2]) : g.ch(.06) ? 3 : 1;
  const money0 = fam === 'undo' ? 1e6 : fam === 'doze' || fam === 'multi' ? g.pick([3000, 3000, 1e6, 1234.56, 550]) : g.pick([3000, 3000, 3000, 1e6, 550, 100, 0, 1234.56, -20, g.int(0, 5000)]);
  const tech = fam === 'tech' ? [...TECH_COST, ...TECH_EDU].filter(() => g.ch(.5)) : TECH_EDU.filter(() => g.ch(.12));
  const spec = fam === 'tech' ? g.pick([null, 'hub', 'hub', 'edu']) : g.ch(.1) ? g.pick(['hub', 'edu', 'green']) : null;
  const one = () => g.ch(.6) ? 1 : (50 + g.int(0, 100)) / 100;
  const budget = { police: one(), fire: one(), health: one(), edu: one() };
  const schoolLunch = g.ch(.3), polNull = !schoolLunch && g.ch(.5);
  const seed = Math.floor(g.R() * 4294967296) >>> 0;
  return { diff, money0, tech, spec, budget, schoolLunch, polNull, seed };
}
// 地價髒標記的起始狀態：full＝每天收尾後（隔天整張重算，55279）、clean＝讀檔／復原後（rebuildCov 53154）、box＝已有框
function landOf(g, N) {
  const u = g.R();
  if (u < .5) return [true, null];
  if (u < .8) return [false, null];
  const x0 = g.int(0, N - 1), y0 = g.int(0, N - 1);
  return [true, [x0, y0, g.int(x0, N - 1), g.int(y0, N - 1)]];
}

function genOps(g, N, tiles, fam, stacks, multis) {
  const ops = [], outP = fam === 'edge' ? .3 : .05;
  let now = g.int(1000, 90000);
  const list = pred => tiles.flatMap((t, i) => pred(t) ? [i] : []);
  const cats = {
    bld: list(t => !!t.bld), road: list(t => !!t.road), water: list(t => t.t === 0), tree: list(t => !!t.tree), zone: list(t => !!t.zone), free: list(free),
    hi: list(t => !!(t.bld && !t.bld.ref && t.bld.k <= 3 && t.bld.lv >= 2)), multi: list(t => !!(t.bld && (t.bld.ref || t.bld.sz > 1))),
    stuff: list(t => !!(t.deco || t.ruin || t.crater || t.rail || t.tram || t.dock || t.rdec || t.bus || t.lv475 || t.ud475 || t.wp || t.hv471 || t.ug471
      || t.wm472 || t.sm472 || t.levee || t.flood || t.oneway || t.light || t.busLane || t.fly475 || t.ix475)),
  };
  const xy = i => [i % N, (i / N) | 0], any = () => [g.int(0, N - 1), g.int(0, N - 1)], from = l => l.length ? xy(g.pick(l)) : any();
  const target = tool => {
    if (g.ch(outP)) return [g.int(-3, N + 2), g.int(-3, N + 2)];
    const u = g.R();
    if (fam === 'undo') return tool === 'doze' ? (u < .5 ? from(cats.bld) : from(cats.zone)) : u < .8 ? from(cats.free) : any();
    if (tool === 'doze') return u < .3 ? from(cats.bld) : u < .45 ? from(cats.multi) : u < .6 ? from(cats.road) : u < .75 ? from(cats.stuff) : u < .88 ? from(cats.zone) : any();
    if (ROADS.includes(tool)) return u < .3 ? from(cats.road) : u < .5 ? from(cats.water) : u < .6 ? from(cats.tree) : u < .7 ? from(cats.bld) : any();
    if (ZONES.includes(tool)) return u < .35 ? from(cats.zone) : u < .5 ? from(cats.tree) : u < .6 ? from(cats.road) : u < .7 ? from(cats.water) : any();
    return u < .2 ? from(cats.tree) : u < .3 ? from(cats.bld) : u < .4 ? from(cats.water) : any();
  };
  const tapOp = () => { const u = g.R(), tool = u < .3 ? g.pick(ROADS) : u < .55 ? g.pick(ZONES) : u < .65 ? 'plant' : u < .8 ? 'police' : 'doze'; const [x, y] = target(tool); ops.push({ op: 'tap', tool, x, y }); };
  const lineOp = () => { const tool = g.ch(.88) ? g.pick(ROADS) : g.pick(['zr', 'zi', 'doze', 'police']); const [x0, y0] = target(tool); ops.push({ op: 'line', tool, x0, y0, x1: x0 + g.int(-7, 7), y1: y0 + g.int(-7, 7) }); };
  const rectAt = (tool, x0, y0, x1, y1, gap) => { now += gap ?? g.pick([200, 900, 2500, 4000, 12000]); ops.push({ op: 'rect', tool, x0, y0, x1, y1, now }); };
  const rectOp = () => {
    const u = g.R(), tool = u < .55 ? g.pick(ZONES) : u < .93 ? 'doze' : g.pick(['police', 'plant', 'road']); const [x, y] = target(tool);
    if (g.ch(.25)) rectAt(tool, x, y, x, y);
    else { const w = g.int(0, 4), h = g.int(0, 4), flip = g.ch(.3); rectAt(tool, flip ? x + w : x, flip ? y + h : y, flip ? x : x + w, flip ? y : y + h); }
  };
  const buildOp = () => { const u = g.R(); (u < .45 ? tapOp : u < .7 ? lineOp : rectOp)(); };
  // 單格拆二級以上：第一次只預備，隔 gap 毫秒再按同一格（中間偶爾夾別的操作）
  const armSeq = () => { const [x, y] = from(cats.hi); rectAt('doze', x, y, x, y); if (g.ch(.8)) { if (g.ch(.25)) (g.ch(.5) ? tapOp : rectOp)(); rectAt('doze', x, y, x, y, g.pick(ARM_GAPS)); } };
  const moneyOp = () => ops.push(g.ch(.65) ? { op: 'money', next: g.pick(NEXT_D) } : { op: 'money', v: g.pick(MONEY_V) });
  if (fam === 'undo') {   // 先蓋 56–62 筆（約八成成功，交易超過堆疊上限 40），再退 44–50 次（最後幾次沒東西可退）
    for (let s = 0, m = g.int(56, 62); s < m; s++) (g.ch(.6) ? tapOp : g.ch(.5) ? lineOp : rectOp)();
    for (let s = 0, m = g.int(44, 50); s < m; s++) { ops.push({ op: 'undo' }); if (g.ch(.1)) tapOp(); }
    return ops;
  }
  // 同一格連拆幾次：一次拆一層，照 51777–51818 的順序一層一層剝
  const peel = () => { const [x, y] = g.ch(.6) ? from(cats.stuff) : from(cats.bld); for (let s = 0, m = g.int(2, 5); s < m; s++) ops.push({ op: 'tap', tool: 'doze', x, y }); };
  const n = fam === 'doze' ? g.int(24, 40) : g.int(20, 36);
  if (fam === 'doze') {   // 先把焦土、隕石坑和幾格稀有圖層一層一層剝到底（每張放了每一種，見 genMap）；剝之前偶爾先試著在上面蓋（焦土、隕石坑擋，51265–51266）
    const pool = cats.stuff.filter(i => !tiles[i].ruin && !tiles[i].crater && !stacks.includes(i)), first = [...stacks, ...cats.stuff.filter(i => (tiles[i].ruin || tiles[i].crater) && !stacks.includes(i))];
    for (let s = 0, m = Math.min(pool.length, g.int(3, 6)); s < m; s++) first.push(pool.splice(g.int(0, pool.length - 1), 1)[0]);
    for (const i of first) {
      const [x, y] = xy(i);
      if (g.ch(.5)) ops.push({ op: 'tap', tool: g.pick([...ROADS, ...ZONES, 'plant', 'police']), x, y });
      for (let q = 0, r = g.int(3, 6); q < r; q++) ops.push({ op: 'tap', tool: 'doze', x, y });
    }
  }
  if (fam === 'multi' && multis.length) {
    // 多格建築占地上的拆除：六成從 ref 格起（根格不在框裡），其餘從根格或它的左上起；框到占地之外（可能伸出地圖），角的順序隨機；
    // 三成拉線：從 ref 格起的七成往回拉到根格一帶（L 形先走 x 再走 y，先拆 ref 格、後段才碰到根格）。之前兩成先把錢設成剛好夠／差一點；
    // 之後五成五馬上復原、兩成隔一筆再退兩次、一成五復原後同一框再拆一次（一半再退），一成不退
    const after = op => {
      const u = g.R();
      if (u < .55) ops.push({ op: 'undo' });
      else if (u < .75) { buildOp(); ops.push({ op: 'undo' }, { op: 'undo' }); }
      else if (u < .9) { ops.push({ op: 'undo' }, op.op === 'rect' ? { ...op, now: now += 900 } : { ...op }); if (g.ch(.5)) ops.push({ op: 'undo' }); }
    };
    const multiDoze = () => {
      const [rx, ry, sz] = g.pick(multis), fromRef = g.ch(.6);
      const dx = fromRef ? g.int(0, sz - 1) : -g.int(0, 1), dy = fromRef ? g.int(dx > 0 ? 0 : 1, sz - 1) : -g.int(0, 1);
      let op;
      if (g.ch(.3)) {
        const back = fromRef && g.ch(.7);
        op = { op: 'line', tool: 'doze', x0: rx + dx, y0: ry + dy, x1: back ? rx - g.int(0, 1) : rx + g.int(-1, sz), y1: back ? ry - g.int(0, 1) : ry + g.int(-1, sz) };
      } else {
        const x0 = rx + dx, y0 = ry + dy, x1 = rx + sz - 1 + g.int(0, 2), y1 = ry + sz - 1 + g.int(0, 2), fx = g.ch(.5), fy = g.ch(.5);
        now += g.pick([200, 900, 4000]);
        op = { op: 'rect', tool: 'doze', x0: fx ? x1 : x0, y0: fy ? y1 : y0, x1: fx ? x0 : x1, y1: fy ? y0 : y1, now };
      }
      if (g.ch(.2)) ops.push({ op: 'money', next: g.pick([0, 0, -1, 2]) });
      ops.push(op);
      after(op);
    };
    // 每張一條：從 ref 格（根格右邊）起、往左拉到根格那一欄再往上，先拆 ref 格（整棟清掉、根格存快照），後段才碰到帶著別層的根格
    const dressed = multis.filter(([x, y]) => extraLayer(tiles[y * N + x])), at = g.int(0, 3);
    for (let s = 0, m = g.int(6, 9); s < m; s++) {
      if (g.ch(.25)) buildOp();
      if (s === at && dressed.length) {
        const [rx, ry, sz] = g.pick(dressed), op = { op: 'line', tool: 'doze', x0: rx + g.int(1, sz - 1), y0: ry + g.int(0, sz - 1), x1: rx, y1: ry - g.int(0, 1) };
        ops.push(op); after(op);
      } else multiDoze();
    }
  }
  while (ops.length < n) {
    const u = g.R();
    if (u < (fam === 'money' ? .3 : .08)) { moneyOp(); buildOp(); }
    else if (u < .42) tapOp();
    else if (u < .6) lineOp();
    else if (u < .78) rectOp();
    else if (u < .88) ops.push({ op: 'undo' });
    else if (u < (fam === 'doze' ? .95 : .94) && cats.hi.length) armSeq();
    else if (u < (fam === 'doze' ? .99 : .95)) peel();
    else { moneyOp(); buildOp(); }
  }
  return ops;
}

// 第 k 個案例（0 ≤ k < D011_COUNT）
export function cases(k) {
  let base = 0;
  for (const [name, count] of FAMILIES) {
    if (k < base + count) {
      const j = k - base, g = gen(seedOf(name, j));
      const m = genMap(g, name, j), p = paramsOf(g, name);
      return { family: name, j, N: m.N, tiles: m.tiles, sparse: m.sparse, ...p, land: landOf(g, m.N), ops: genOps(g, m.N, m.tiles, name, m.stacks, m.multis) };
    }
    base += count;
  }
  throw new Error(`D011 案例 ${k} 超出 ${D011_COUNT}`);
}

// ---- 兩邊共用的跑法 ----
// 畫面用的遮罩：實驗線放置／拆除時會重算鄰格（recalcMask 51147 等），本線不搬，不列入格子比對
export const RENDER_KEYS = new Set(['mask', 'railMask', 'tramMask', 'hvMask471', 'wmMask472', 'smMask472', 'lvMask475', 'udMask475', 'wpMask475']);
// 變了的格：跟上一次記下的 JSON 比，變了就列出不同的欄位（兩邊從同一份格子出發，逐筆的差異就能重建整張圖）。
// 每一筆先做便宜的檢查（格子物件、bld 物件換了沒有，建造程式會寫的欄位值變了沒有），有動才比 JSON；
// 每張圖最後 full＝true 再把每一格的 JSON 整個比一次，便宜檢查漏掉的變化（例如改了清單外的欄位、改了 bld 物件裡面）會在那時現形。
const WATCH = ['t', 'tree', 'road', 'rc', 'hw', 'bridge', 'zone', 'office', 'deco', 'ruin', 'crater', 'rdec', 'bus', 'rail', 'railBridge', 'tram', 'tramBridge', 'dock',
  'lv475', 'ud475', 'fly475', 'ix475', 'hv471', 'ug471', 'wm472', 'sm472', 'wp', 'oneway', 'light', 'busLane', 'levee', 'flood', 'el'];
// 逐欄比較寫成固定欄位名的函式（每一格每一筆都要跑，動態鍵名慢）
const W = WATCH.length;
const keepVals = new Function('t', 'v', 'o', WATCH.map((k, q) => `v[o+${q}]=t.${k};`).join(''));
const sameVals = new Function('t', 'v', 'o', 'return ' + WATCH.map((k, q) => `Object.is(t.${k},v[o+${q}])`).join('&&') + ';');
function tracker(tiles) {
  const js = tiles.map(t => JSON.stringify(t)), ref = tiles.slice(), bref = tiles.map(t => t.bld), val = new Array(tiles.length * W);
  const keep = (i, t) => keepVals(t, val, i * W);
  const same = (i, t) => t === ref[i] && t.bld === bref[i] && sameVals(t, val, i * W);
  tiles.forEach((t, i) => keep(i, t));
  return (tiles2, full) => {
    const out = [];
    for (let i = 0; i < tiles2.length; i++) {
      const t = tiles2[i];
      if (!full && same(i, t)) continue;
      const s = JSON.stringify(t);
      ref[i] = t; bref[i] = t.bld; keep(i, t);
      if (s === js[i]) continue;
      const a = JSON.parse(js[i] ?? 'null') ?? {}, b = JSON.parse(s ?? 'null') ?? {}; js[i] = s;
      const d = [];
      for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(q => !RENDER_KEYS.has(q)).sort()) {
        const ca = canon(a[key]), cb = canon(b[key]); if (ca !== cb) d.push([key, cb]);
      }
      if (d.length) out.push([i, d]);
    }
    if (tiles2.length !== js.length) out.push(['len', tiles2.length]);
    return out;
  };
}
// 覆蓋 60 場（COVR 的順序）＋POLBASE／POLTREE／POL／LANDBASE／LAND／EDU：型別、長度、位元組
export function fieldsHash(s) {
  const h = crypto.createHash('sha256');
  const add = (name, a) => { h.update(`${name}|${a ? Object.prototype.toString.call(a) + a.length : String(a)}|`); if (a) h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); };
  h.update(Object.keys(s.COV).join(',') + '#');
  for (const f of COV_FIELDS) add(f, s.COV[f]);
  for (const n of ['POLBASE', 'POLTREE', 'POL', 'LANDBASE', 'LAND', 'EDU']) add(n, s[n]);
  return h.digest('hex').slice(0, 16);
}
// 「下一筆要花多少」：用受測那一邊自己的 canPlace／placeCost 估（點＝那一格；線＝路線上能蓋的格照順序加總；框＝commitRect 62982–62995 的估價，不含確認）
export function nextCost(op, impl) {
  if (!op || !['tap', 'line', 'rect'].includes(op.op)) return 0;
  const N = impl.N(), inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const one = (x, y) => inMap(x, y) && !impl.canPlace(op.tool, x, y) ? impl.placeCost(op.tool, x, y) : 0;
  if (op.op === 'tap') return one(op.x, op.y);
  let s = 0;
  if (op.op === 'line') { for (const [x, y] of impl.path(op)) s += one(x, y); return s; }
  const x0 = Math.min(op.x0, op.x1), x1 = Math.max(op.x0, op.x1), y0 = Math.min(op.y0, op.y1), y1 = Math.max(op.y0, op.y1), single = x0 === x1 && y0 === y1, tiles = impl.tiles();
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!inMap(x, y) || impl.canPlace(op.tool, x, y)) continue;
    const b = tiles[y * N + x].bld;
    if (op.tool === 'doze' && !single && b && b.k <= 3 && b.lv >= 2) continue;
    s += impl.placeCost(op.tool, x, y);
  }
  return s;
}
const costOf = (impl, tool, x, y) => { try { return impl.placeCost(tool, x, y); } catch { return 'throw'; } };   // 圖外：索引落到陣列外兩邊都丟例外

// 跑一個案例：impl 提供 init／tap／line／rect／undo 與讀狀態的方法（見 labImpl 與 tools/unit-d011-build.mjs 的 impl3d）
// opts.stopAt(j, rec)：每筆記完就問要不要停（突變守衛找到第一個不同就停）；opts.raw：另存每筆的物件（產生器統計覆蓋率用）
export function runMap(impl, c, opts = {}) {
  const { stopAt, raw } = opts;
  impl.init(c);
  const diff = tracker(impl.tiles()), ops = [];
  for (let j = 0; j < c.ops.length; j++) {
    const op = c.ops[j];
    impl.log().length = 0; impl.calls().length = 0;
    let pre = null, res = null, txn = null;
    if (op.op === 'tap') { pre = [impl.canPlace(op.tool, op.x, op.y), costOf(impl, op.tool, op.x, op.y)]; ({ res, txn } = impl.tap(op)); }
    else if (op.op === 'line') ({ res, txn } = impl.line(op));
    else if (op.op === 'rect') ({ res, txn } = impl.rect(op));
    else if (op.op === 'undo') res = impl.undo();
    else if (op.op === 'money') { res = op.next !== undefined ? nextCost(c.ops[j + 1], impl) + op.next : op.v; impl.setMoney(res); }
    else throw new Error('未知操作 ' + op.op);
    const obj = { pre, res, calls: impl.calls().slice(), txn, depth: impl.depth(), money: impl.money(), log: impl.log().slice(), tiles: diff(impl.tiles()),
      land: impl.land(), arm: impl.arm(), fh: fieldsHash(impl.state()) };
    const rec = canon(obj);
    ops.push(rec); raw?.push(obj);
    if (stopAt && stopAt(j, rec)) return { ops, end: null, stopped: j };
  }
  return { ops, end: canon({ late: diff(impl.tiles(), true), fields: snapshot(impl.state()) }) };
}

// ---- 實驗線那一邊：原始碼片段在 Node vm 裡跑（strict，同實驗線主程式 37214 'use strict'）----
// 片段以外的東西換成樁：畫面、提示、音效、粒子、其他系統的髒旗標與重建（水、污水、清運、排水、緊急出勤、韌性）一律空函式；
// computePower 只記一筆 P（供電不在本卡對拍範圍，記的是「當場重算」的時機）；R／ri 記錄每一次抽取（ri 同 37223：Math.floor(R()*n)）；
// performance.now 由案例給（commitRect 的拆除確認）；KNAME 換成「#k」（確認提示裡的種類名稱）。
// 實驗線的全域與樁寫成 vm 裡的頂層宣告（不放在 vm 的全域物件上：那樣每次讀 tiles、N、Math 都要經過沙箱攔截，慢十倍）。
// 宣告的名字＝實驗線的全域名（37769 tiles、37770 money／day、39433 diff、38547 tech343、37849 spec386、38460 region、pol……），
// 內建物件（Math、JSON、Uint8Array……）只是把 vm 自己的內建綁成頂層常數，語意不變。
const PRELUDE = `'use strict';
const Math=globalThis.Math,JSON=globalThis.JSON,Object=globalThis.Object,Array=globalThis.Array,Number=globalThis.Number,String=globalThis.String,
  Map=globalThis.Map,Set=globalThis.Set,Uint8Array=globalThis.Uint8Array,Uint16Array=globalThis.Uint16Array,Float32Array=globalThis.Float32Array,Error=globalThis.Error;
let N=1,tiles=[],money=0,day=1,diff=1,tech343={done:[]},spec386='',pol=null,region={};
let NOISE=null,noiseSig=-1,leakDays=null,METRO_TOD467B=null,metroTodSig467B='',ACCESS468=null,transit468=null,RESOURCE=null,RDEP=null,
  roadLoad=null,roadPass=null,commuteLoad=null,commutePass=null,commutePenalty=null,commuteUnreach=null,garbLocal=null,commuteClusters=null;
let waterDirty449=false,sanDirty445=false,groundDirty=false;
const window={},LOGISTICS_TOOL_IDS485=[],POWER_STORAGE_META471={},powerStorageState471=new Map(),waterStorageState472=new Map(),noop=()=>{};
const emptyTransit468=()=>({}),resetDrainage454=noop,rebuildNoise=noop,roadCap475=()=>{throw new Error('道路負載應為 0，不該走到壅堵分支');};
const markMobilityDirty462=noop,markPowerDirty450=noop,markPowerDirty471=noop,syncWaterCap364=noop,computeWater=()=>0,markSewerDirty451=noop,computeSewage442=noop,
  markDrainDirty454=noop,markWaterCycleDirty472=noop,markEmergencyDirty455=noop,markResilienceDirty492=noop,spawnDebris=noop,spawnDust=noop,removeBusStopFromRoutes=noop,
  recalcRailMask4=noop,recalcInfraMask4_475=noop,recalcPowerGridMask4_471=noop,recalcWaterMainMask4_472=noop,
  sErr=noop,sTick=noop,sBuild=noop,refreshTxnUi460=noop,txnToast460=noop,txnHistoryPush460=noop,
  recalcFoamNear=noop,recalcElMaskNear=noop,prepareSewerAllocation451=noop,computeSanitation445=noop,rebuildDrainage454=noop,rebuildEmergency455=noop,
  prepareDrainage454=noop,recalcAllRailMasks=noop,drawMini=noop,updHud=noop;
const computePower=()=>__h.power(),toast=m=>__h.toast(m),R=()=>__h.R(),ri=n=>__h.ri(n);
const performance={now:()=>__h.now()},KNAME=new Proxy({},{get:(_,k)=>'#'+String(k)});
`;
export function makeLab(pieces) {
  const log = [], calls = [], toasts = [], clock = { now: 0 };
  let rand = null;
  const host = {
    power: () => { log.push(['P']); return 0; }, toast: m => { toasts.push(String(m)); }, now: () => clock.now,
    R: () => { log.push(['R']); return rand(); }, ri: n => { log.push(['ri', n]); return Math.floor(rand() * n); },
  };
  const ctx = vm.createContext({ console, __h: host });
  vm.runInContext(PRELUDE, ctx, { filename: 'lab:樁' });
  for (const p of pieces) vm.runInContext(`'use strict';\n${p.src}`, ctx, { filename: `lab:${p.name}` });
  const run = s => vm.runInContext(`'use strict';\n(${s})`, ctx);
  const base = run('doPlace');
  // 記每一次 doPlace（paintTo、commitRect 叫的都是這個名字）；spy 只給黃金樣本產生器統計覆蓋率用，只讀不寫
  ctx.__rec = (t, x, y, s) => { const s0 = api.spy?.before(t, x, y); const ok = base(t, x, y, s); calls.push([x, y, ok ? 1 : 0]); api.spy?.after(s0, t, x, y, ok); return ok; };
  vm.runInContext("'use strict';\ndoPlace=__rec;", ctx);
  const api = {
    spy: null, ctx, log, calls, toasts, clock, seed: s => { rand = run('mulberry32')(s); }, run,
    canPlace: run('canPlace'), placeCost: run('placeCost'), openUndo: run('openUndo'), closeUndo: run('closeUndo'), paintTo: run('paintTo'),
    commitRoadDraft436: run('commitRoadDraft436'), roadDraftTiles436: run('roadDraftTiles436'), commitRect: run('commitRect'), undo: run('undo'),
    rebuildCov: run('rebuildCov'), allocGrids: run('allocGrids'), rect: run('rect'),
    setWorld: run('(n,t,m,d,tech,spec,p)=>{N=n;tiles=t;money=m;diff=d;day=1;region={};tech343={done:tech};spec386=spec;pol=p;}'),
    N: run('()=>N'), tiles: run('()=>tiles'), money: run('()=>money'), setMoney: run('v=>{money=v;}'), diff: run('()=>diff'),
    setTool: run('v=>{tool=v;}'), setDraft: run('v=>{roadDraft436=v;}'), setPaintLast: run('v=>{paintLast=v;}'), setLand: run('(d,b)=>{landDirty=d;landBox=b;}'),
    setBudget: run('b=>{svcBudget=b;}'), reset: run("()=>{undoStack=[];redoStack=[];undoGroup=null;txnHistory460=[];dozeArm=null;paintLast=null;roadDraft436=null;tool='pan';rect.on=false;}"),
    getLand: run('()=>[landDirty,landBox]'), getArm: run('()=>dozeArm'), getStack: run('()=>undoStack'),
    state: run('()=>({COV,POLBASE,POLTREE,POL,LANDBASE,LAND,EDU,NOISE,METRO_TOD467B,ACCESS468,commutePenalty})'),
  };
  return api;
}
// 實驗線的手勢照玩家的路徑叫（觸控）：點＝openUndo→paintTo→closeUndo（62918）；線＝roadDraft436＋commitRoadDraft436（62917）；
// 框＝rect＋commitRect，放開時再 closeUndo 一次（62915、62920，這時沒有開著的交易，是空動作）；復原＝undo（66594）
export function labImpl(lab) {
  let N = 1;
  const inMap = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const pushed = top0 => { const s = lab.getStack(), top = s[s.length - 1]; return top && top !== top0 ? [top.spent, top.snaps.map(q => q.i)] : null; };
  const top = () => { const s = lab.getStack(); return s[s.length - 1]; };
  const path = op => { lab.setDraft({ x0: op.x0, y0: op.y0, x1: op.x1, y1: op.y1, active: true }); const p = lab.roadDraftTiles436().map(([x, y]) => [x, y]); lab.setDraft(null); return p; };
  return {
    log: () => lab.log, calls: () => lab.calls, N: () => lab.N(), tiles: () => lab.tiles(), state: () => lab.state(),
    init(c) {
      N = c.N;
      lab.setWorld(c.N, c.tiles, c.money0, c.diff, [...c.tech], c.spec ?? '', c.schoolLunch ? { schoolLunch: true } : c.polNull ? null : { schoolLunch: false });
      lab.allocGrids(); lab.setBudget({ ...c.budget }); lab.reset(); lab.rebuildCov();
      lab.setLand(c.land[0], c.land[1] ? { x0: c.land[1][0], y0: c.land[1][1], x1: c.land[1][2], y1: c.land[1][3] } : null);
      lab.seed(c.seed);
    },
    canPlace: (t, x, y) => lab.canPlace(t, x, y), placeCost: (t, x, y) => lab.placeCost(t, x, y), path,
    money: () => lab.money(), setMoney: v => lab.setMoney(v), depth: () => lab.getStack().length,
    land: () => { const [d, b] = lab.getLand(); return [d, b ? [b.x0, b.y0, b.x1, b.y1] : null]; },
    arm: () => { const a = lab.getArm(); return a ? [a.y * N + a.x, a.t] : null; },
    tap(op) {
      const t0 = top();
      lab.setTool(op.tool); lab.openUndo(); lab.setPaintLast(null); lab.paintTo(op.x, op.y); lab.closeUndo(); lab.setPaintLast(null);
      return { res: lab.calls.length ? lab.calls[0][2] : 0, txn: pushed(t0) };
    },
    line(op) {
      const t0 = top(), p = path(op);
      lab.setTool(op.tool); lab.setDraft({ x0: op.x0, y0: op.y0, x1: op.x1, y1: op.y1, active: true }); lab.commitRoadDraft436(); lab.setDraft(null);
      let j = 0;
      const built = p.map(([x, y]) => inMap(x, y) ? (lab.calls[j++]?.[2] ?? -1) : 0);
      return { res: [p, built], txn: pushed(t0) };
    },
    rect(op) {
      const t0 = top(), r = lab.rect;
      lab.setTool(op.tool); r.on = true; r.x0 = op.x0; r.y0 = op.y0; r.x1 = op.x1; r.y1 = op.y1;
      lab.clock.now = op.now; lab.toasts.length = 0;
      lab.commitRect(); r.on = false; lab.closeUndo();
      return { res: [lab.calls.filter(q => q[2]).length, lab.toasts.slice()], txn: pushed(t0) };
    },
    undo: () => lab.undo() ? 1 : 0,
  };
}

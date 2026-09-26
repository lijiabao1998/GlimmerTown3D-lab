// D011 施工整合守衛（tools/unit-d011-edit.mjs）的劇本與案例：劇本第 E 段、預建城的拆除劇本、釘住結果的操作（理由、格數、錢夠不夠）、
// 存檔的資金取整、竄改過的歷史。這裡只產生資料，不跑模擬；座標都由開局的地形推出來（決定性，不用亂數），地形不合就丟例外（劇本不成立，不猜）。
// 釘住（pins）：Map（操作物件 → 要的結果）。欄位對 runScript 的結果（placed、spent、armed、skipped、reason、refund、events）
// 與預覽（count、total、affordable、pvReason）逐項比；check(s, r, pv, ev) 另驗事實，回傳錯誤字串或 null；tag 是涵蓋面的記號（守衛要求每一個都真的發生過）。
// 劇本裡的操作只用 tools/d011-ops.mjs 契約裡的種類（劇本也在瀏覽器重演）；gap（毫秒）、nop（照設計什麼都不改）同契約。
import { roadDraftTiles, COST } from '../src/sim/rules/build.ts';

const J = JSON.stringify;

// ---- 劇本第 E 段（第 91 天，接著推進 30 天）：施工的每一種寫法都要有「留著、跨過一天」的一筆，重播、存讀檔才量得到 ----
// 起步城西邊那片空地（x＝X−7…X−2）：新劃一塊住宅區（還沒長房子），電廠、警察局蓋在分區上（各復原一次，警察局再留一棟）、
// 路穿過分區、拆分區、拆路（都留著）；東邊找一塊樹林劃區（分區清掉樹）；西邊再拉一條快速路過河（路碼 4，留著）。
// avoid：劇本其他段碰到的格（起步城、兩棵樹、A–D 段每一筆線／框／點的格）：空地與快速路不能碰到；樹林離它們至少 3 格
// （生長要 2 格內有通電的普通路，55602 hasRoadNear(x,y,2,true,true)：劃在樹上的分區不會長房子，這一段不改變劇本城的規模）
export function segE(n, ter, tre, X, Z, avoid) {
  const at = (x, z) => z * n + x, inMap = (x, z) => x >= 0 && z >= 0 && x < n && z < n;
  const W = X - 6, zz = Z + 8;
  for (let z = zz; z <= zz + 1; z++) for (let x = W - 1; x <= W + 4; x++)
    if (!inMap(x, z) || ter[at(x, z)] === 0 || tre[at(x, z)] || avoid.has(at(x, z))) throw new Error(`D011 劇本 E 段：(${x},${z}) 不是空的陸地`);
  // 樹林：3×2 全是陸地、至少 3 棵樹，離起步城中心最近（格索引順序打破平手）
  const cx = X + 10, cz = Z + 10, near = (x, z) => { for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (avoid.has(at(x + dx, z + dz))) return true; return false; };
  let wood = null, bd = Infinity;
  for (let z = 3; z + 4 < n; z++) for (let x = 3; x + 5 < n; x++) {
    let trees = 0, ok = true;
    for (let dz = 0; dz < 2 && ok; dz++) for (let dx = 0; dx < 3 && ok; dx++) { const i = at(x + dx, z + dz); if (ter[i] === 0 || near(x + dx, z + dz)) ok = false; else if (tre[i]) trees++; }
    const d = Math.abs(x - cx) + Math.abs(z - cz);
    if (ok && trees >= 3 && d < bd) { bd = d; wood = [x, z, trees]; }
  }
  if (!wood) throw new Error('D011 劇本 E 段：找不到樹林');
  // 快速路過河：從 (W, Z+20) 往南直直拉，過了水面停在對岸第一格陸地
  let z1 = Z + 20;
  while (z1 < n && ter[at(W, z1)] !== 0) z1++;
  const wet0 = z1;
  while (z1 < n && ter[at(W, z1)] === 0) z1++;
  if (ter[at(W, Z + 20)] === 0 || wet0 >= n || z1 >= n || wet0 === z1) throw new Error(`D011 劇本 E 段：x＝${W} 往南拉不過河`);
  const hwyCells = roadDraftTiles(W, Z + 20, W, z1), hwyWet = hwyCells.filter(([x, z]) => ter[at(x, z)] === 0);
  if (hwyCells.some(([x, z]) => avoid.has(at(x, z)))) throw new Error(`D011 劇本 E 段：快速路 x＝${W} 碰到劇本其他段`);
  const tileOf = (s, x, z) => s.w.tiles[at(x, z)];
  const ops = [
    { k: 'money', v: 10000 },                                                          // 這一段的價錢照算：資金先設成定數
    { k: 'rect', tool: 'zr', x0: W, z0: zz, x1: W + 3, z1: zz + 1 },                   // 空地劃 4×2 住宅區（$8／格）
    { k: 'tap', tool: 'police', x: W, z: zz },                                         // 警察局蓋在分區上（分區清掉，51687）
    { k: 'undo' },                                                                     // 復原：警察局變墓碑、分區回來、退 $500
    { k: 'tap', tool: 'plant', x: W + 1, z: zz },                                      // 電廠蓋在分區上（51672）
    { k: 'undo' },                                                                     // 復原：退 $550、撤覆蓋與污染
    { k: 'tap', tool: 'police', x: W + 3, z: zz + 1 },                                 // 警察局蓋在分區上（留著）
    { k: 'line', tool: 'road', x0: W - 1, z0: zz, x1: W + 4, z1: zz },                 // 路穿過分區（分區清掉，51645）
    { k: 'rect', tool: 'doze', x0: W, z0: zz + 1, x1: W + 1, z1: zz + 1 },             // 拆分區（留著，51811）
    { k: 'rect', tool: 'doze', x0: W - 1, z0: zz, x1: W - 1, z1: zz },                 // 拆路（單格＝框，留著，51808）
    { k: 'rect', tool: 'zr', x0: wood[0], z0: wood[1], x1: wood[0] + 2, z1: wood[1] + 1 },   // 分區劃在樹上（清掉樹、+$2，51665／51623）
    { k: 'line', tool: 'hwy', x0: W, z0: Z + 20, x1: W, z1: z1 },                      // 快速路過河（留著）：路碼 4＝快速路橋
  ];
  const [, zoneA, police, undoP, plant, undoPl, police2, road, dozeZ, dozeR, woodZ, hwy] = ops;
  const pins = new Map([
    [zoneA, { placed: 8, spent: 8 * COST.zone, count: 8, affordable: true }],
    [police, { placed: 1, events: ['place'], tag: '警察局蓋在分區上', check: s => tileOf(s, W, zz).zone ? '分區沒清掉' : null }],
    [undoP, { refund: COST.police, tag: '復原警察局', check: s => tileOf(s, W, zz).zone !== 1 || tileOf(s, W, zz).bld ? '分區沒回來或建築還在' : null }],
    [plant, { placed: 1, events: ['place'], tag: '電廠蓋在分區上' }],
    [undoPl, { refund: COST.plant, tag: '復原電廠', check: s => tileOf(s, W + 1, zz).zone !== 1 || tileOf(s, W + 1, zz).bld ? '分區沒回來或建築還在' : null }],
    [police2, { placed: 1, events: ['place'] }],
    [road, { placed: 6, events: Array(6).fill('road'), tag: '路穿過分區', check: s => [0, 1, 2, 3].some(d => tileOf(s, W + d, zz).zone) ? '路上還有分區' : null }],
    [dozeZ, { placed: 2, spent: 2 * COST.doze, events: ['doze zone', 'doze zone'], tag: '拆分區留著' }],
    [dozeR, { placed: 1, spent: COST.doze, events: ['doze road'], tag: '拆路留著' }],
    [woodZ, { placed: 6, spent: 6 * COST.zone + wood[2] * COST.doze, tag: '分區劃在樹上', check: s => { for (let dz = 0; dz < 2; dz++) for (let dx = 0; dx < 3; dx++) if (tileOf(s, wood[0] + dx, wood[1] + dz).tree) return '樹還在'; return null; } }],
    [hwy, { placed: hwyCells.length, events: Array(hwyCells.length).fill('road'), tag: '快速路過河留著',
      check: s => hwyWet.some(([x, z]) => { const t = tileOf(s, x, z); return !(t.road && t.hw && t.bridge && t.rc === 5); }) ? '水上那幾格不是快速路橋' : null }],
  ]);
  return { ops, pins, wood, hwyWet };
}

// ---- 預建城（src/content/samples/d011-prebuilt.code.txt：df 1、$3000、2×2 體育場 k9、二級三級的住商工）的拆除劇本 ----
// 標準難度才量得到「預覽＝扣款」：沙盒一律 $0。操作都走玩家的路（單格拆除＝框，commitRect 62974；時間用 commitOp 的 now，gap 同契約）。
//   1. 點體育場的附屬格（右下角，不是根格）：整棟 2×2 拆掉（51779–51798），事件記在根格、造價＝真的扣的錢（edit.ts syncEdit 找手勢裡碰到它的那一格）
//   2. 單格拆二級：第一次只預備（62985–62988），2999 毫秒後再按一次才拆
//   3. 單格拆三級：預備，剛好 3000 毫秒後再按：重新預備，不拆（要 < 3000，62986）
//   4. 框選一級＋二級（相鄰）：一級拆、二級略過（62983 多格分支），預覽只算一級（edit.ts previewOp）
// 做完推進一天：拆掉的都跨過一天，重播、存讀檔照驗
export function prebuiltCase(save) {
  const n = save.n, bl = save.bl, xz = i => [i % n, (i / n) | 0], rci = r => r[1] >= 1 && r[1] <= 3, byI = new Map(bl.map(r => [r[0], r]));
  const big = bl.find(r => r[1] === 9);
  const pair = bl.find(r => { const q = byI.get(r[0] + 1); return rci(r) && r[2] === 1 && (r[0] + 1) % n && q && rci(q) && q[2] === 2; });
  const lv2 = bl.find(r => rci(r) && r[2] === 2 && r[0] !== pair?.[0] + 1), lv3 = bl.find(r => rci(r) && r[2] === 3);
  if (!big || !pair || !lv2 || !lv3) throw new Error('D011 預建城案例：找不到體育場、相鄰的一級＋二級、另一棟二級或三級');
  const [bx, bz] = xz(big[0]), sz = big[5] || 2, ax = bx + sz - 1, az = bz + sz - 1;
  const [x2, z2] = xz(lv2[0]), [x3, z3] = xz(lv3[0]), [px, pz] = xz(pair[0]), zn2 = +(save.layers.zn?.[lv2[0]] ?? 0);
  if (!zn2) throw new Error('D011 預建城案例：那棟二級底下沒有分區（量不到「拆建築分區留著」）');
  const one = (x, z, gap) => ({ k: 'rect', tool: 'doze', x0: x, z0: z, x1: x, z1: z, ...(gap !== undefined ? { gap } : {}) });
  const bldAt = (s, x, z) => s.w.tiles[z * n + x].bld;
  const ops = [
    { k: 'money', v: 3000 },
    one(ax, az),
    { ...one(x2, z2), nop: 1 }, one(x2, z2, 2999),
    { ...one(x3, z3), nop: 1 }, { ...one(x3, z3, 3000), nop: 1 },
    { k: 'rect', tool: 'doze', x0: px, z0: pz, x1: px + 1, z1: pz },
  ];
  const [, stad, arm2, go2, arm3, re3, mix] = ops;
  const pins = new Map([
    [stad, { placed: 1, spent: COST.doze, count: 1, total: COST.doze, events: ['doze bld'], tag: '點附屬格拆整棟',
      check: (s, r, pv, ev) => {
        const e = ev[0];
        if (e.x !== bx || e.z !== bz || e.k !== 9 || e.cost !== r.spent) return `事件 ${J(e)}：要記在根格 (${bx},${bz})、造價＝扣的 ${r.spent}`;
        for (let dz = 0; dz < sz; dz++) for (let dx = 0; dx < sz; dx++) if (bldAt(s, bx + dx, bz + dz)) return `(${bx + dx},${bz + dz}) 還有建築`;
        return null;
      } }],
    [arm2, { placed: 0, spent: 0, armed: true, tag: '拆除待確認', check: s => bldAt(s, x2, z2)?.lv === 2 ? null : '二級第一次按就拆了' }],
    [go2, { placed: 1, spent: COST.doze, armed: false, events: ['doze bld'], tag: '3 秒內再按：拆',
      check: s => bldAt(s, x2, z2) ? '二級還在' : s.w.tiles[z2 * n + x2].zone !== zn2 ? '分區沒留著（51779 拆建築不動分區）' : null }],
    [arm3, { placed: 0, armed: true }],
    [re3, { placed: 0, spent: 0, armed: true, tag: '滿 3 秒：重新待確認', check: s => bldAt(s, x3, z3)?.lv === 3 ? null : '三級被拆了' }],
    [mix, { placed: 1, spent: COST.doze, count: 1, total: COST.doze, skipped: 1, events: ['doze bld'], tag: '框選一級＋二級：只拆一級',
      check: s => bldAt(s, px, pz) ? '一級還在' : bldAt(s, px + 1, pz)?.lv !== 2 ? '二級被拆了' : null }],
  ]);
  return Object.assign([['ops', ops], ['days', 1]], { pins });
}

// ---- 釘住的操作（新城，第 1 天開跑前）：拒絕的理由、預覽的格數與總價、錢夠不夠，逐項寫死 ----
export function pinCase(X, Z) {
  const x = X + 2, z = Z + 2;
  const ops = [
    { k: 'money', v: 3000 },
    { k: 'rect', tool: 'zr', x0: x, z0: z, x1: x + 1, z1: z + 1 },                     // 劃 4 格
    { k: 'rect', tool: 'zr', x0: x, z0: z, x1: x + 1, z1: z + 1, nop: 1 },             // 同一區再劃：不動、不收錢（51664）
    { k: 'money', v: COST.plant },
    { k: 'tap', tool: 'plant', x: x + 4, z },                                          // 錢剛好：蓋（51631 是 cost>money 才拒絕）
    { k: 'money', v: COST.police - 1 },
    { k: 'tap', tool: 'police', x: x + 6, z, nop: 1 },                                 // 差一塊：不蓋
    { k: 'money', v: 4 * COST.zone - 1 },
    { k: 'rect', tool: 'zc', x0: x, z0: z + 3, x1: x + 1, z1: z + 4, nop: 1 },         // 框選 4 格總價比資金多一塊：整塊不蓋（62996）
    { k: 'money', v: 4 * COST.zone },
    { k: 'rect', tool: 'zc', x0: x, z0: z + 3, x1: x + 1, z1: z + 4 },                 // 剛好：蓋
  ];
  const [, zr, same, , plant, , police, , short, , exact] = ops;
  const broke = s => s.money === 0 ? null : `資金 ${s.money} ≠ 0`;
  const pins = new Map([
    [zr, { placed: 4, spent: 4 * COST.zone, count: 4, total: 4 * COST.zone, affordable: true }],
    [same, { placed: 0, spent: 0, count: 0, total: 0, affordable: true, reason: '已經是這一區', pvReason: '已經是這一區', tag: '同一區再劃：已經是這一區' }],
    [plant, { placed: 1, spent: COST.plant, count: 1, total: COST.plant, affordable: true, tag: '錢剛好：點', check: broke }],
    [police, { placed: 0, spent: 0, count: 1, total: COST.police, affordable: false, reason: '錢不夠', tag: '差一塊：點' }],
    [short, { placed: 0, spent: 0, count: 4, total: 4 * COST.zone, affordable: false, reason: `資金不足！需要 $${4 * COST.zone}`, tag: '差一塊：框' }],
    [exact, { placed: 4, spent: 4 * COST.zone, count: 4, total: 4 * COST.zone, affordable: true, tag: '錢剛好：框', check: broke }],
  ]);
  return Object.assign([['ops', ops]], { pins });
}

// ---- 存檔的資金取整：實驗線 save 的 money:Math.round(money)（index.html 66747 @d23c18d）----
// JavaScript 的 Math.round 半數一律往 +∞（1234.5→1235、−10.5→−10），不是「四捨五入到離 0 遠的那邊」。存檔一定要跟實驗線同一種取法
export const MONEY_ROUND = [[1234.4, 1234], [1234.5, 1235], [1234.6, 1235], [-10.4, -10], [-10.5, -10], [-10.6, -11]];

// ---- 竄改過的 d3（分享碼是別人也能改的輸入，src/io/save.ts eventOf／unpackHistory／checkHistory）----
// 每一種都要被驗型別擋下（replayed＝false）、講得出是哪一項不對，城照樣能用。want＝null：照讀，但多出來的欄位不能帶進城市。
// hist：存檔當時的歷史（跟 d3.r 一筆對一列）；n：地圖邊長
export function tamperCases(raw, hist, n) {
  const road = hist.findIndex((e, k) => k > 0 && e.t === 'road'), doze = hist.findIndex(e => e.t === 'doze');
  if (road < 0 || doze < 0) throw new Error('D011 竄改案例：歷史裡沒有鋪路或拆除');
  const XSS = '<img src=x onerror=alert(1)>';
  const h1 = () => ({ f: raw.d3.f, s: raw.d3.s, g: raw.d3.g, h: JSON.parse(J(hist)) });     // 舊存法 hv 1：事件物件（沒有 hv 欄位）
  const h2 = () => JSON.parse(J(raw.d3));                                                    // hv 2：緊湊列 [種類碼, 日子差, 欄位…]
  const with1 = f => () => { const d = h1(); f(d.h); return d; }, with2 = f => () => { const d = h2(); f(d.r); return d; };
  return [
    ['hv1 日子是一段 HTML', with1(h => { h[road].day = XSS; }), /日子不對/],
    ['hv1 x＝n＋5', with1(h => { h[road].x = n + 5; }), /座標不對/],
    ['hv1 不認得的拆除圖層', with1(h => { h[doze].layer = 'lava'; }), /圖層不對/],
    ['hv1 不認得的事件種類', with1(h => { h[road].t = XSS; }), /種類不對/],
    ['hv1 hv＝3', () => ({ ...h1(), hv: 3 }), /不認得的歷史存法 hv=3/],
    ['hv1 多一個欄位（照讀、不帶進城市）', with1(h => { h[road].html = XSS; }), null],
    ['hv2 日子差是一段 HTML', with2(r => { r[road][1] = XSS; }), /不是一列/],
    ['hv2 日子不是整數', with2(r => { r[road][1] += .5; }), /日子不對/],
    ['hv2 x＝n＋5', with2(r => { r[road][2] = n + 5; }), /座標不對/],
    ['hv2 x 是一段 HTML', with2(r => { r[road][2] = XSS; }), /座標不對/],
    ['hv2 不認得的拆除圖層', with2(r => { r[doze][4] = 9; }), /圖層不對/],
    ['hv2 列比種類長', with2(r => { r[road].push(0); }), /種類不對/],
    ['hv2 不認得的種類碼', with2(r => { r[road][0] = 99; }), /種類不對/],
    ['hv2 hv＝3', () => ({ ...h2(), hv: 3 }), /不認得的歷史存法 hv=3/],
  ];
}

// 格式對、重播得出來、卻跟存檔對不上：把一筆鋪路的等級 2 改成 4（hv 2 的路列 [3, 日子差, x, z, rc, cost, 手勢差]）。
// 挑「結束時那格還是等級 2 的路、之後沒有別的事件碰那格、那一筆手勢沒被復原」的那一筆，改了一定留到最後。tiles：存檔當時的格子
export function rcTamper(raw, hist, tiles, n) {
  const k = hist.findIndex((e, k) => e.t === 'road' && e.rc === 2 && tiles[e.z * n + e.x].road && tiles[e.z * n + e.x].rc === 2
    && !hist.slice(k + 1).some(q => (q.t === 'undo' && q.g === e.g) || (q.x === e.x && q.z === e.z)));
  if (k < 0) throw new Error('D011 竄改案例：找不到留到最後的等級 2 路');
  const d3 = JSON.parse(J(raw.d3)), row = d3.r[k], e = hist[k];
  if (row[0] !== 3 || row[2] !== e.x || row[3] !== e.z || row[4] !== 2) throw new Error(`D011 竄改案例：第 ${k + 1} 列 ${J(row)} 不是那一筆路`);
  row[4] = 4;
  return { d3, i: e.z * n + e.x, row: k };
}

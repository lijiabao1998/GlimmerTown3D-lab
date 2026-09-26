// D011 對拍的操作劇本（驗收 3、4）：實驗線和本線吃同一份，逐筆照做。座標由地形推出來（決定性，不用亂數）：
//   以起步城那塊平地（src/content/starter.ts）為基準蓋一座小鎮；另外找離它最近的水面（橋、「只能蓋在陸地上」）與樹（+$2、砍樹）。
// 操作種類：
//   { k:'line', tool, x0,z0,x1,z1 }   路：L 形先 x 後 y，逐格蓋（實驗線 commitRoadDraft436 62779）
//   { k:'rect', tool, x0,z0,x1,z1 }   分區、拆除：先算總價、逐列蓋（commitRect 62974）。拆除一律走框：玩家的路就是這條（實驗線 isRectTool 62750 → 放開時 commitRect 62915；
//                                      本線 gestureOf('doze')＝'rect'）。單格拆除＝x0＝x1、z0＝z1 的框，二級以上的住商工要 3 秒內在同一格再按一次（62983–62992）
//   { k:'tap', tool, x,z }             建築（paintTo 一格，一筆交易，62918）
//   { k:'money', v }                  兩邊資金設成同一個數（把建造規則跟每日結算分開驗）
//   { k:'seed', v }                   兩邊的全域亂數都換成 mulberry32(v)：實驗線 R＝mulberry32(v)（37221–37222，ri 讀的也是 R）；本線就地換掉 s.rng 的 R、ri（src/sim/rules/lab.ts labRng）
//   { k:'undo' }                      復原上一筆（T460 undo 66594）
//   { k:'pick', what, rect:[x0,z0,x1,z1], as }   在框裡照格索引順序找第一棟根格：what＝'k1'…（那一種）或 'rci'（住商工任一種，1≤k≤3），記成 as，後面的操作用 {at:as} 指它
//   gap（選填，毫秒）：這一筆跟上一筆隔多久，預設 10000。拆除確認的時鐘兩邊照同一串算：本線 commitOp 的 now；實驗線 commitRect 讀的 performance.now()（62985–62986）
//   nop（選填）：這一筆照設計什麼都不改（拒絕、同類重劃、拆除只預備）；守衛核對每個種子上「有沒有改到格子或資金」跟設計一樣，劇本不會默默變成空跑
// 段落：A＝第 1 天開跑前；接著推進第 1 天；B＝第 1 天之後、第 2 天開跑前。兩邊到這裡狀態都還一樣（D010：第 2 天起分岔），所以逐格比。
import { starterLayout } from '../src/content/starter.ts';
import { commitOp, undoOp } from '../src/sim/edit.ts';
import { roadDraftTiles } from '../src/sim/rules/build.ts';
import { labRng } from '../src/sim/rules/lab.ts';

// pick 的量法：實驗線頁面裡 eval、本線 new Function，同一段原始碼（tools/d011-parity-lib.mjs 也從這裡拿）
export const PICK_SRC = `((tiles,N,rect,what)=>{const [x0,z0,x1,z1]=rect,k=what==='rci'?0:+what.slice(1);
  for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const b=tiles[z*N+x].bld;if(b&&!b.ref&&(k?b.k===k:b.k>=1&&b.k<=3))return [x,z];}return null;})`;
export const pickOf = new Function(`return ${PICK_SRC}`)();
export const DEFAULT_GAP = 10000;                                        // 每筆隔 10 秒：沒寫 gap 的拆除確認不會跨筆生效
export const B_SEED = 20260926;                                          // B 段開頭兩邊亂數對齊用的種子（任一常數）

// 本線這一邊照做一筆（src/sim/edit.ts；介面按鈕走的也是同一組函式）。picks：pick 找到的建築座標，後面的 {at} 用
export function run3d(s, o, picks, now = 0) {
  if (o.k === 'money') { s.money = o.v; return { k: 'money' }; }
  if (o.k === 'seed') { const g = labRng(o.v); s.rng.R = g.R; s.rng.ri = g.ri; return { k: 'seed' }; }   // 就地換（__gt.simSeed 同一個做法）
  if (o.k === 'undo') return undoOp(s);
  if (o.k === 'pick') { const f = pickOf(s.w.tiles, s.w.N, o.rect, o.what); picks[o.as] = f; return { k: 'pick', found: f }; }
  const p = o.at ? picks[o.at] : null;
  if (o.at && !p) return { ok: false, placed: 0, spent: 0, events: [], reason: 'pick 沒找到' };
  const [x0, z0, x1, z1] = p ? [p[0], p[1], p[0], p[1]] : o.k === 'tap' ? [o.x, o.z, o.x, o.z] : [o.x0, o.z0, o.x1, o.z1];
  const op = { k: o.k, tool: o.tool, x0, z0, x1, z1 };
  return { ...commitOp(s, op, now), op };                               // op：實際提交的那一筆（瀏覽器重演劇本用）
}

// 單格拆除（框）
const doze1 = (x, z, gap) => ({ k: 'rect', tool: 'doze', x0: x, z0: z, x1: x, z1: z, ...(gap !== undefined ? { gap } : {}) });

export function d011Ops(n, ter, el, tre) {
  const L = starterLayout(n, ter, el), X = L.x0, Z = L.z0, zm = Z + 5, xa = X + 10;
  const at = (x, z) => z * n + x, cl = v => Math.max(0, Math.min(n - 1, v));
  // 離起步城中心最近的水面格、樹格（格索引順序打破平手）
  const near = pred => { let best = null, bd = Infinity; for (let i = 0; i < n * n; i++) { if (!pred(i)) continue; const x = i % n, z = (i / n) | 0, d = Math.abs(x - L.center[0]) + Math.abs(z - L.center[1]); if (d < bd) { bd = d; best = [x, z]; } } return best; };
  const offSite = i => !(i % n >= X && i % n <= X + 20 && ((i / n) | 0) >= Z && ((i / n) | 0) <= Z + 20);
  const water = near(i => ter[i] === 0), tree = near(i => tre[i] > 0 && ter[i] !== 0 && offSite(i));
  const tree2 = tree && near(i => tre[i] > 0 && ter[i] !== 0 && offSite(i) && i !== at(tree[0], tree[1]));   // 第二棵：第一棵在 A 段就砍了
  if (!water || !tree || !tree2) throw new Error('D011 劇本：找不到水面或樹');
  // 過河的線：從起步城最近的邊，朝水面那一格 (wx,wz) 直直拉過去，拉到對岸再多兩格
  const across = (wx, wz, tool) => {
    const sx = Math.max(X, Math.min(X + 20, wx)), sz = Math.max(Z, Math.min(Z + 20, wz));
    const dx = Math.sign(wx - sx), dz = Math.sign(wz - sz);
    if (dx && Math.abs(wx - sx) >= Math.abs(wz - sz)) { let x = wx; while (x >= 0 && x < n && ter[at(x, wz)] === 0) x += dx; return { k: 'line', tool, x0: sx, z0: wz, x1: cl(x + dx), z1: wz }; }
    let z = wz; while (z >= 0 && z < n && ter[at(wx, z)] === 0) z += dz; return { k: 'line', tool, x0: wx, z0: sz, x1: wx, z1: cl(z + dz) };
  };
  const bridge = across(water[0], water[1], 'road');
  // 快速路過河（路碼 4＝快速路橋，roadCode）：跟橋平行、往旁邊挪 4 格照樣拉過去（留著不復原）。這條線要真的經過水面、終點在陸地上，否則劇本不成立
  const side = bridge.x0 === bridge.x1 ? [water[0] + 4, water[1]] : [water[0], water[1] + 4];
  const hwyBridge = ter[at(side[0], side[1])] === 0 ? across(side[0], side[1], 'hwy') : null;
  const hwyCells = hwyBridge ? roadDraftTiles(hwyBridge.x0, hwyBridge.z0, hwyBridge.x1, hwyBridge.z1) : [];
  const hwyWater = hwyCells.filter(([x, z]) => ter[at(x, z)] === 0).length;
  if (!hwyBridge || !hwyWater || ter[at(...hwyCells.at(-1))] === 0) throw new Error('D011 劇本：快速路那條線沒有過河（' + JSON.stringify(hwyBridge) + '）');
  const A = [
    { k: 'money', v: 3000 },
    { k: 'line', tool: 'road', x0: X, z0: zm, x1: X + 20, z1: zm },                 // 主街（支路 rc2）
    { k: 'line', tool: 'alley', x0: xa, z0: Z, x1: xa, z1: Z + 10 },                  // 小巷：跟主街交叉那格已是 rc2 → 拒絕
    { k: 'line', tool: 'road', x0: xa, z0: Z, x1: xa, z1: Z + 10 },                   // 升級成支路：付差價 7／格
    { k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 1, x1: X + 9, z1: Z + 4 },
    { k: 'rect', tool: 'zc', x0: X + 11, z0: Z + 1, x1: X + 19, z1: Z + 4 },
    { k: 'rect', tool: 'zi', x0: X + 11, z0: Z + 6, x1: X + 19, z1: Z + 9 },
    { k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 6, x1: X + 9, z1: Z + 9 },
    { k: 'rect', tool: 'zc', x0: X + 1, z0: Z + 1, x1: X + 2, z1: Z + 2 },             // 住→商：改劃免費
    { k: 'rect', tool: 'zc', x0: X + 1, z0: Z + 1, x1: X + 2, z1: Z + 2, nop: 1 },     // 同類重劃：不動
    { k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 4, x1: X + 3, z1: Z + 6, nop: 1 },     // 跨過主街：路上那幾格拒絕、兩側已是住宅區不動
    { k: 'tap', tool: 'plant', x: X + 20, z: Z + 6 },                                  // 電廠貼著主街尾
    { k: 'tap', tool: 'police', x: X, z: Z + 6 },                                      // 警察局（抽一次亂數）
    { k: 'tap', tool: 'police', x: X, z: Z + 6, nop: 1 },                              // 同一格再放：有建築擋住
    { k: 'tap', tool: 'plant', x: water[0], z: water[1], nop: 1 },                     // 水上：只能蓋在陸地上
    doze1(tree[0], tree[1]),                                                           // 砍樹 $2（單格拆除＝框）
    { ...doze1(tree[0], tree[1]), nop: 1 },                                            // 再砍一次：這裡沒東西
    bridge,                                                                            // 過河：橋 +60／格
    { k: 'money', v: 40 },
    { k: 'line', tool: 'road', x0: X, z0: Z + 20, x1: X + 6, z1: Z + 20 },             // 錢只夠兩格：蓋前段
    { k: 'money', v: 100 },
    { k: 'rect', tool: 'zi', x0: X + 11, z0: Z + 11, x1: X + 14, z1: Z + 14, nop: 1 }, // 16 格 × 8 > 100：整塊不蓋
    { k: 'money', v: 549 },
    { k: 'tap', tool: 'plant', x: X + 20, z: Z + 4, nop: 1 },                          // 差一塊：拒絕
    { k: 'money', v: 550 },
    { k: 'tap', tool: 'plant', x: X + 20, z: Z + 4 },                                  // 剛好：蓋
    { k: 'money', v: 3000 },
    { k: 'line', tool: 'hwy', x0: X, z0: Z + 15, x1: X + 8, z1: Z + 15 },              // 快速路 rc5
    { k: 'undo' },                                                                     // 復原快速路：全額退錢、重算覆蓋
    { k: 'line', tool: 'coll', x0: X, z0: Z + 10, x1: X + 20, z1: Z + 10 },            // 次幹道 rc3
    { k: 'tap', tool: 'plant', x: X + 14, z: Z + 16 },                                 // 電廠再復原：建築拆掉、退 $550、撤覆蓋與污染
    { k: 'undo' },
    { k: 'tap', tool: 'police', x: X + 4, z: Z + 16 },                                 // 警察局再復原：抽的亂數不倒回
    { k: 'undo' },
    hwyBridge,                                                                         // 快速路過河（留著）：橋 +60／格
    { k: 'tap', tool: 'police', x: X + 20, z: Z + 18 },                                // 最後一筆、不復原：新的覆蓋讓第 1 天開頭的地價框真的重算到格子
  ];
  const B = [
    { k: 'money', v: 3000 },                                                           // 第 1 天的結算兩邊不同（第 2 類）：資金先設成同一個數，建造規則照樣逐位比
    { k: 'seed', v: B_SEED },                                                          // 亂數對齊：實驗線第 1 天比本線多抽（起火、犯罪、生病擲骰，第 2 類），B 段的警察局變體要比
    { k: 'pick', what: 'rci', rect: [X, Z, X + 20, Z + 20], as: 'h' },               // 第 1 天長出來的第一棟住商工（格索引順序）
    { k: 'rect', tool: 'doze', at: 'h' },                                              // 拆它：分區留著
    { k: 'rect', tool: 'doze', at: 'h' },                                              // 再拆一次：分區也拿掉
    { k: 'tap', tool: 'police', x: X + 20, z: Z + 14 },                                // 抽一次亂數 ri(5)
    { k: 'rect', tool: 'doze', x0: X + 11, z0: Z + 6, x1: X + 13, z1: Z + 7 },          // 框選拆除（一級照拆）
    { k: 'undo' },
    { k: 'rect', tool: 'zr', at: 'h' },                                                // 拆掉的地重劃（分區拆了，不是改劃：$8）
    doze1(X + 20, Z + 6),                                                              // 拆電廠（撤掉覆蓋與污染）
    { k: 'undo' },
  ];
  return { site: { x0: X, z0: Z }, water, tree, tree2, hwy: { op: hwyBridge, cells: hwyCells.length, water: hwyWater }, A, B };
}

// 預建城（d011-prebuilt.code.txt，tools/lab-extract.mjs 擺的）的拆除劇本：多格建築點附屬格、單格拆二級以上的確認（3 秒內再按一次；
// 過了 3 秒、剛好 3 秒都重新預備）、框選混一級與二級（二級略過）再復原，最後拆掉小巷接到支路的那一格（小巷那一段斷電）。
// 做完推進一天：推進前就在的住商工，推進後有沒有電是當天真的照容量與帶電道路分配的（當天新長的生出來就帶電 pw:true，55622）。
// n、bl（存檔建築列 [i,k,lv,v,age,…]）、rd／rcl（逐格路、等級）
export function prebuiltOps(n, bl, rd, rcl) {
  const xz = i => [i % n, (i / n) | 0], rci = r => r[1] >= 1 && r[1] <= 3, byI = new Map(bl.map(r => [r[0], r]));
  const lv2 = bl.find(r => rci(r) && r[2] === 2), lv3 = bl.find(r => rci(r) && r[2] === 3), big = bl.find(r => r[1] === 9);
  const used = new Set([lv2?.[0], lv3?.[0]]);
  // 框選：一棟一級住商工，東邊緊鄰一棟二級（前面拆過、預備過的不算）
  const pair = bl.find(r => { const q = byI.get(r[0] + 1); return rci(r) && r[2] === 1 && (r[0] + 1) % n && q && rci(q) && q[2] === 2 && !used.has(r[0]) && !used.has(q[0]); });
  // 斷電：格索引順序第一格「小巷（等級 1），上下左右有等級 2 以上的路」
  const cut = rd.findIndex((v, i) => v && rcl[i] === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => { const x = i % n + dx, z = ((i / n) | 0) + dz; return x >= 0 && z >= 0 && x < n && z < n && rd[z * n + x] && rcl[z * n + x] >= 2; }));
  if (!lv2 || !lv3 || !big || !pair || cut < 0) throw new Error('D011 預建城劇本：找不到二級、三級、體育場、一級＋二級相鄰或小巷接支路');
  const [bx, bz] = xz(big[0]), sz = big[5] || 2, ref = [bx + sz - 1, bz + sz - 1];
  const [a2, a3, pr, ct] = [xz(lv2[0]), xz(lv3[0]), xz(pair[0]), xz(cut)];
  const ops = [
    { k: 'money', v: 3000 },
    doze1(...ref),                                                                     // 體育場的附屬格（右下角）：整棟 2×2 拆掉、撤 stadium 覆蓋（51779–51796）
    { ...doze1(...a2), nop: 1 },                                                       // 二級：第一次只預備（62985–62988）
    doze1(...a2, 1000),                                                                // 1 秒後同一格再按：拆
    { ...doze1(...a3), nop: 1 },                                                       // 三級：預備
    { ...doze1(...a3, 3001), nop: 1 },                                                 // 過了 3 秒：重新預備，不拆
    { ...doze1(...a3, 3000), nop: 1 },                                                 // 剛好 3 秒：還是重新預備（要 < 3000）
    doze1(...a3, 2999),                                                                // 3 秒內：拆
    { k: 'rect', tool: 'doze', x0: pr[0], z0: pr[1], x1: pr[0] + 1, z1: pr[1] },        // 框選一級＋二級：一級拆、二級略過（62983 多格分支）
    { k: 'undo' },                                                                     // 復原框選拆除
    doze1(...ct),                                                                      // 拆小巷接支路那一格：小巷那一段不帶電
  ];
  return { ops, lv2: a2, lv3: a3, big: [bx, bz], ref, pair: pr, cut: ct };
}

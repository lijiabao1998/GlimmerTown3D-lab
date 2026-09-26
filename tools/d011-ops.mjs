// D011 對拍的操作劇本（驗收 3、4）：實驗線和本線吃同一份，逐筆照做。座標由地形推出來（決定性，不用亂數）：
//   以起步城那塊平地（src/content/starter.ts）為基準蓋一座小鎮；另外找離它最近的水面（橋、「只能蓋在陸地上」）與樹（+$2、砍樹）。
// 操作種類：
//   { k:'line', tool, x0,z0,x1,z1 }   路：L 形先 x 後 y，逐格蓋（實驗線 commitRoadDraft436 62779）
//   { k:'rect', tool, x0,z0,x1,z1 }   分區、拆除：先算總價、逐列蓋（commitRect 62974）
//   { k:'tap', tool, x,z }             建築、單格（paintTo 一格，一筆交易）
//   { k:'money', v }                  兩邊資金設成同一個數（把建造規則跟每日結算分開驗）
//   { k:'undo' }                      復原上一筆（T460 undo 66594）
//   { k:'pick', what, rect:[x0,z0,x1,z1], as }   B 段用：在框裡照格索引順序找第一棟 what（'k1'…），記成 as，後面的操作用 {at:as} 指它
// 段落：A＝第 1 天開跑前；接著推進第 1 天；B＝第 1 天之後、第 2 天開跑前。兩邊到這裡狀態都還一樣（D010：第 2 天起分岔），所以逐格比。
import { starterLayout } from '../src/content/starter.ts';
import { commitOp, undoOp } from '../src/sim/edit.ts';

// 本線這一邊照做一筆（src/sim/edit.ts；介面按鈕走的也是同一組函式）。picks：pick 找到的建築座標，後面的 {at} 用
export function run3d(s, o, picks, now = 0) {
  if (o.k === 'money') { s.money = o.v; return { k: 'money' }; }
  if (o.k === 'undo') return undoOp(s);
  if (o.k === 'pick') {
    const [x0, z0, x1, z1] = o.rect, k = +o.what.slice(1), n = s.w.N;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const b = s.w.tiles[z * n + x].bld; if (b && !b.ref && b.k === k) { picks[o.as] = [x, z]; return { k: 'pick', found: [x, z] }; } }
    picks[o.as] = null;
    return { k: 'pick', found: null };
  }
  const p = o.at ? picks[o.at] : null;
  if (o.at && !p) return { ok: false, placed: 0, spent: 0, events: [], reason: 'pick 沒找到' };
  const [x0, z0, x1, z1] = p ? [p[0], p[1], p[0], p[1]] : o.k === 'tap' ? [o.x, o.z, o.x, o.z] : [o.x0, o.z0, o.x1, o.z1];
  const op = { k: o.k, tool: o.tool, x0, z0, x1, z1 };
  return { ...commitOp(s, op, now), op };                               // op：實際提交的那一筆（瀏覽器重演劇本用）
}

export function d011Ops(n, ter, el, tre) {
  const L = starterLayout(n, ter, el), X = L.x0, Z = L.z0, zm = Z + 5, xa = X + 10;
  const at = (x, z) => z * n + x;
  // 離起步城中心最近的水面格、樹格（格索引順序打破平手）
  const near = pred => { let best = null, bd = Infinity; for (let i = 0; i < n * n; i++) { if (!pred(i)) continue; const x = i % n, z = (i / n) | 0, d = Math.abs(x - L.center[0]) + Math.abs(z - L.center[1]); if (d < bd) { bd = d; best = [x, z]; } } return best; };
  const offSite = i => !(i % n >= X && i % n <= X + 20 && ((i / n) | 0) >= Z && ((i / n) | 0) <= Z + 20);
  const water = near(i => ter[i] === 0), tree = near(i => tre[i] > 0 && ter[i] !== 0 && offSite(i));
  const tree2 = tree && near(i => tre[i] > 0 && ter[i] !== 0 && offSite(i) && i !== at(tree[0], tree[1]));   // 第二棵：第一棵在 A 段就砍了
  if (!water || !tree || !tree2) throw new Error('D011 劇本：找不到水面或樹');
  // 過河的橋：從起步城最近的邊，朝水面那一格直直拉過去，拉到對岸再多兩格
  const bridge = (() => {
    const [wx, wz] = water, sx = Math.max(X, Math.min(X + 20, wx)), sz = Math.max(Z, Math.min(Z + 20, wz));
    const dx = Math.sign(wx - sx), dz = Math.sign(wz - sz);
    if (dx && Math.abs(wx - sx) >= Math.abs(wz - sz)) { let x = wx; while (x >= 0 && x < n && ter[at(x, wz)] === 0) x += dx; x = Math.max(0, Math.min(n - 1, x + dx)); return { k: 'line', tool: 'road', x0: sx, z0: wz, x1: x, z1: wz }; }
    let z = wz; while (z >= 0 && z < n && ter[at(wx, z)] === 0) z += dz; z = Math.max(0, Math.min(n - 1, z + dz)); return { k: 'line', tool: 'road', x0: wx, z0: sz, x1: wx, z1: z };
  })();
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
    { k: 'rect', tool: 'zc', x0: X + 1, z0: Z + 1, x1: X + 2, z1: Z + 2 },             // 同類重劃：不動
    { k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 4, x1: X + 3, z1: Z + 6 },             // 跨過主街：路上那幾格拒絕
    { k: 'tap', tool: 'plant', x: X + 20, z: Z + 6 },                                  // 電廠貼著主街尾
    { k: 'tap', tool: 'police', x: X, z: Z + 6 },                                      // 警察局（抽一次亂數）
    { k: 'tap', tool: 'police', x: X, z: Z + 6 },                                      // 同一格再放：有建築擋住
    { k: 'tap', tool: 'plant', x: water[0], z: water[1] },                             // 水上：只能蓋在陸地上
    { k: 'tap', tool: 'doze', x: tree[0], z: tree[1] },                                // 砍樹 $2
    { k: 'tap', tool: 'doze', x: tree[0], z: tree[1] },                                // 再砍一次：這裡沒東西
    bridge,                                                                            // 過河：橋 +60／格
    { k: 'money', v: 40 },
    { k: 'line', tool: 'road', x0: X, z0: Z + 20, x1: X + 6, z1: Z + 20 },             // 錢只夠兩格：蓋前段
    { k: 'money', v: 100 },
    { k: 'rect', tool: 'zi', x0: X + 11, z0: Z + 11, x1: X + 14, z1: Z + 14 },         // 16 格 × 8 > 100：整塊不蓋
    { k: 'money', v: 549 },
    { k: 'tap', tool: 'plant', x: X + 20, z: Z + 4 },                                  // 差一塊：拒絕
    { k: 'money', v: 550 },
    { k: 'tap', tool: 'plant', x: X + 20, z: Z + 4 },                                  // 剛好：蓋
    { k: 'money', v: 3000 },
    { k: 'line', tool: 'hwy', x0: X, z0: Z + 15, x1: X + 8, z1: Z + 15 },              // 快速路 rc5
    { k: 'undo' },                                                                     // 復原快速路：全額退錢、重算覆蓋
    { k: 'line', tool: 'coll', x0: X, z0: Z + 10, x1: X + 20, z1: Z + 10 },            // 次幹道 rc3
  ];
  const B = [
    { k: 'money', v: 3000 },                                                           // 第 1 天的結算兩邊不同（第 2 類）：資金先設成同一個數，建造規則照樣逐位比
    { k: 'pick', what: 'k1', rect: [X, Z, X + 20, Z + 20], as: 'h' },                // 第 1 天長出來的第一棟房子（格索引順序）
    { k: 'tap', tool: 'doze', at: 'h' },                                               // 拆它：分區留著
    { k: 'tap', tool: 'doze', at: 'h' },                                               // 再拆一次：分區也拿掉
    { k: 'rect', tool: 'doze', x0: X + 11, z0: Z + 6, x1: X + 13, z1: Z + 7 },          // 框選拆除（一級照拆）
    { k: 'undo' },
    { k: 'rect', tool: 'zr', at: 'h' },                                                // 拆掉的地重劃（分區拆了，不是改劃：$8）
    { k: 'tap', tool: 'doze', x: X + 20, z: Z + 6 },                                   // 拆電廠（撤掉覆蓋與污染）
    { k: 'undo' },
  ];
  return { site: { x0: X, z0: Z }, water, tree, tree2, A, B };
}

// 預建城（d011-prebuilt.code.txt）的拆除劇本：開跑前做完就比（不推進，噪音源不影響）
export function prebuiltOps(bl) {
  const pick = (k, lv) => bl.find(r => r[1] === k && (lv === undefined || r[2] === lv));
  const ops = [{ k: 'money', v: 3000 }];
  const lv2 = pick(1, 2) || pick(2, 2) || pick(3, 2), lv3 = pick(1, 3) || pick(2, 3) || pick(3, 3), lv1 = pick(1, 1) || pick(2, 1) || pick(3, 1), big = bl.find(r => r[1] === 9);
  return { ops, lv1, lv2, lv3, big };
}

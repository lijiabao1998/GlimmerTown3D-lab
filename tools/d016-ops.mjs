// D016 對拍的操作劇本與本線那一半（驗收 2、3）：實驗線頁面（tools/d016-parity.mjs）和本線（這裡的 civic3d／prebuilt16）吃同一份劇本，
// 格式與逐筆的做法同 tools/d011-ops.mjs（run3d、頁面裡的 apply）；量法同 tools/d011-parity-lib.mjs（同一段原始碼）。
//   新城：D011 的 A 段（主街、分區、電廠、警察局、橋……）→ C 段（公共設施九支：在起步城南側蓋一排、公園走框；水上、路上、有建築、錢差一塊都拒絕；
//         樹上加價；錢剛好；蓋了再復原、蓋了再拆、拆了再復原）→ 推進第 1 天。比每一筆、推進之後的格子與場、第 1 天那一列、收入與維護費（逐項輸入）。
//   預建城：在已經有住宅的地方蓋九種設施（每一種找「格索引順序第一格：陸地、沒路、沒建築、兩格內有住宅」）→ 拆診所再復原 → 推進一天。
//         比推進前就在的每一棟住宅的幸福（新的覆蓋場進了幸福公式）、有電、住商工以外的格子與覆蓋與地價。
import { decodeLabCode } from '../src/io/labcode.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { d011Ops } from './d011-ops.mjs';
import { harness, row3d, invOf, pwOf, hsOf, diffOf } from './d011-parity-lib.mjs';

export const CIVIC16 = ['park', 'fire', 'policeBox', 'hospital', 'clinic', 'school', 'library', 'post', 'cemetery'];
export const CIVIC_K16 = { park: 4, fire: 6, policeBox: 52, hospital: 12, clinic: 13, school: 7, library: 14, post: 15, cemetery: 16 };
// 放一種設施：公園走框（實驗線 isRectTool 62750；本線 gestureOf('park')＝'rect'），其他點一下
const put = (tool, x, z, extra = {}) => tool === 'park' ? { k: 'rect', tool, x0: x, z0: z, x1: x, z1: z, ...extra } : { k: 'tap', tool, x, z, ...extra };
const doze1 = (x, z, gap) => ({ k: 'rect', tool: 'doze', x0: x, z0: z, x1: x, z1: z, ...(gap !== undefined ? { gap } : {}) });

// 設施的量法：每一棟非住商工根格 [格索引, k, lv, v]（實驗線頁面、本線同一段；本線 → 實驗線讀回、實驗線匯出 → 本線解碼都比這個）
export const CIVV_SRC = `(tiles=>{const o=[];for(let i=0;i<tiles.length;i++){const b=tiles[i].bld;if(b&&!b.ref&&b.k>3)o.push([i,b.k,b.lv|0,b.v|0]);}return o;})`;
export const civvOf = new Function(`return ${CIVV_SRC}`)();
// 存檔碼裡的非住商工（bl 列 [i,k,lv,v,age,…]，照格索引排序）
export const civvOfCode = code => decodeLabCode(code).save.bl.filter(r => r[1] > 3 && !r.ref).map(r => [r[0], r[1], r[2] | 0, r[3] | 0]).sort((a, b) => a[0] - b[0]);
// 實驗線探針多讀的：主計數迴圈（55050–55063）數的設施數（D011 的探針只讀收稅那一圈數的公園、電廠、消防、警察、派出所、醫院、診所、學校）
export const PROBE16_EXTRA = ['libraries', 'posts', 'cemeteries', 'stadiums', 'waterTowers', 'dumps'];

export function d016Ops(n, ter, el, tre) {
  const o = d011Ops(n, ter, el, tre), X = o.site.x0, Z = o.site.z0, r1 = Z + 11, r2 = Z + 12;   // 次幹道 Z+10 的南邊兩排（A 段那一框 zi 錢不夠沒劃）
  const C = [
    { k: 'money', v: 20000 },
    ...CIVIC16.map((t, j) => put(t, X + 1 + j, r1)),                                // 九種各一棟，排在次幹道南邊
    { k: 'rect', tool: 'park', x0: X + 11, z0: r1, x1: X + 13, z1: r2 },           // 框選公園 3×2：一筆交易，每格各抽一次 ri(9)
    { k: 'tap', tool: 'school', x: o.water[0], z: o.water[1], nop: 1, why: '只能蓋在陸地上' },
    { k: 'tap', tool: 'clinic', x: X, z: Z + 5, nop: 1, why: '道路上不能建造' },      // 主街（A 段第 2 筆）
    { k: 'tap', tool: 'post', x: X + 2, z: r1, nop: 1, why: '已有建築' },             // 消防局那一格
    { k: 'tap', tool: 'library', x: o.tree2[0], z: o.tree2[1] },                     // 樹上：+$2、撤樹的污染減免
    { k: 'money', v: 599 },
    { k: 'tap', tool: 'hospital', x: X + 15, z: r1, nop: 1, why: '錢不夠' },          // 差一塊
    { k: 'money', v: 600 },
    { k: 'tap', tool: 'hospital', x: X + 15, z: r1 },                                // 剛好
    { k: 'money', v: 20000 },
    { k: 'tap', tool: 'cemetery', x: X + 17, z: r1 },
    { k: 'undo' },                                                                   // 蓋了再復原：退錢、重建覆蓋
    { k: 'tap', tool: 'clinic', x: X + 17, z: r2 },
    doze1(X + 17, r2),                                                               // 蓋了再拆：撤覆蓋（一級服務設施不用確認）
    doze1(X + 2, r1),                                                                // 拆消防局
    { k: 'undo' },                                                                   // 再復原：建築與覆蓋回來
    { k: 'tap', tool: 'policeBox', x: X + 19, z: r2 },                               // 最後一棟留著（派出所不抽亂數）
  ];
  return { ...o, C };
}

// 實驗線的噪音源（NOISE_SRC 53021 的種類）：本線沒搬噪音（NOISE 恆 0，src/sim/day.ts 54997 的註），預建城的體育場（k9）就是一個。
// 噪音進住宅幸福（−NOISE×.004×WEALTH_PEN）與地價基準（landStaticAt −NOISE×.4），所以預建城先把噪音源拆掉，比的只是這一批設施（同 D011 預建城劇本第一筆拆體育場）。
// 留著體育場跑過一次（種子 5162026）：第 1976 格住宅實驗線的幸福少 .032＝噪音 4 × .004 × 富人 2，逐位對得上——噪音是另一件事，記在卡面「沒做成的事」
export const NOISE_KINDS = [19, 9, 56, 39, 65, 17, 55, 62, 76, 165, 166, 167, 170, 171, 172, 173, 174, 181, 184];
// 預建城：先拆噪音源；九種設施各找一格（格索引順序第一格：陸地、沒路、沒建築、兩格內有住宅根格），蓋完拆診所再復原
// keepNoise（D017）：不拆噪音源，體育場留著（噪音搬了之後，同一份劇本連噪音一起比）
export function prebuilt16Ops(s, keepNoise = false) {
  const n = s.w.N, T = s.w.tiles, taken = new Set(), at = [];
  const noisy = [];
  T.forEach((t, i) => { if (t.bld && !t.bld.ref && NOISE_KINDS.includes(t.bld.k)) { noisy.push([i % n, (i / n) | 0]); const sz = t.bld.sz || 1; for (let dz = 0; dz < sz; dz++) for (let dx = 0; dx < sz; dx++) taken.add(i + dz * n + dx); } });
  const free = i => { const t = T[i]; return (t.t === 1 || t.t === 2) && !t.road && !t.bld && !t.ruin && !t.crater && !taken.has(i); };
  const nearHome = i => { const x = i % n, z = (i / n) | 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const a = x + dx, b = z + dz; if (a < 0 || b < 0 || a >= n || b >= n) continue; const q = T[b * n + a].bld; if (q && !q.ref && q.k === 1) return true; } return false; };
  for (const tool of CIVIC16) {
    let i = 0; while (i < n * n && !(free(i) && nearHome(i))) i++;
    if (i >= n * n) throw new Error(`D016 預建城劇本：找不到放 ${tool} 的地方`);
    taken.add(i); at.push([tool, i % n, (i / n) | 0]);
  }
  const clinic = at.find(([t]) => t === 'clinic');
  const dz = keepNoise ? [] : noisy;
  return { at, noisy: dz, ops: [{ k: 'money', v: 20000 }, ...dz.map(([x, z]) => doze1(x, z)), ...at.map(([t, x, z]) => put(t, x, z)), doze1(clinic[1], clinic[2]), { k: 'undo' }] };
}

// ---- 本線那一半 ----
// 新城：A 段 → C 段 → 推進第 1 天。stepOpts 只用在推進（給「代入實驗線那一天的第 2 類乘數」用）
export function civic3d(code, KT, vrank, stepOpts = {}) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進劇本起點：' + L.error);
  const s = L.sim, S = decodeLabCode(code).save, lay = k => Uint8Array.from(S.layers[k] ?? '', ch => ch.charCodeAt(0) - 48);
  const ops = d016Ops(S.n, lay('ter'), lay('el'), lay('tre')), h = harness(s);
  const out = { snap0: h.head(h.snap()) };
  out.A = h.batch(ops.A); out.snapA = h.head(h.snap());
  out.C = h.batch(ops.C); out.snapC = h.head(h.snap()); out.civvC = civvOf(s.w.tiles);
  const t1 = h.tick(stepOpts);
  out.tick1Draws = t1.draws; out.tick1Sites = t1.sites; out.tick1Land = t1.land; out.tick1Extra = t1.extra; out.day1 = row3d(s); out.settle1 = t1.rep.settle;
  out.snap1 = h.head(h.snap(), false);
  out.civv1 = civvOf(s.w.tiles);
  out.codeC = saveOf(s, L);
  out.sim = s; out.load = L;
  return out;
}
// 預建城：拆噪音源 → 九種設施 → 拆診所再復原 → 推進一天。bare＝只拆噪音源、不蓋設施（守衛拿來證明這批設施真的改到了住宅的幸福）
export function prebuilt16(code, KT, vrank, stepOpts = {}, bare = false, keepNoise = false) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進預建城：' + L.error);
  const s = L.sim, P = prebuilt16Ops(s, keepNoise), h = harness(s);
  const out = { mig: L.restyled, snap0: h.head(h.snap()) };
  out.ops = h.batch(bare ? P.ops.slice(0, 1 + P.noisy.length) : P.ops);
  const a = h.snap();
  out.snapOps = h.head(a); out.pwBefore = pwOf(s.w.tiles).map(r => r[0]); out.hsBefore = hsOf(s.w.tiles).map(r => r[0]);
  const t = h.tick(stepOpts), b = h.snap();
  out.tickDraws = t.draws; out.tickSites = t.sites; out.tickLand = t.land; out.tickExtra = t.extra; out.day1 = row3d(s); out.settle = t.rep.settle;
  out.post = h.head(b, false); out.postChanged = diffOf(a.proj, b.proj);
  out.inv = invOf(s.w.tiles, s.g.COV, s.g.POLTREE, s.g.LANDBASE, s.g.LAND); out.pw = pwOf(s.w.tiles); out.hs = hsOf(s.w.tiles);
  out.at = P.at; out.noisy = P.noisy; out.sim = s; out.load = L;
  return out;
}
const saveOf = (s, L) => saveCode(s, L.template, L.start);

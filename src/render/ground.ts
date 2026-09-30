// 城市地面貼圖的逐像素顏色（D003 起；D006 改色、加草皮格線與道路標線）。純函式：不 import three、不碰 DOM，Node 守衛也能直接讀色族。
// D006 的顏色取自 2D 實驗線 @ d23c18d 的畫面逐色統計（tools/lab-extract.mjs --part=d004 拍的 scratch/lab/*_2d.png；遠景 24.8% 的像素是 #74b258）：
//   草 #74b258 一族、草皮格線（實驗線 #82c467／#7cae59，本線取淡一點的 #7cb95e）、高地草 #8aba58、水 #3f7ec0 一族、沙 #d9c689、柏油 #4e525b 一族。
import { hash2 } from '../sim/rng.ts';

export const GROUND = {
  grass: [0x74b258, 0x73a959, 0x78aa59, 0x74ae59, 0x75ab5a],
  grassLine: 0x7cb95e,   // 實驗線近景的格線有 #82c467、#7cae59 幾種；中景看整片像方格紙，取介於草色與格線之間的淡色
  grassHigh: [0x8aba58, 0x86b556, 0x8cbd5b],
  water: [0x3f7ec0, 0x407fc1, 0x3e7cbf, 0x3d7bbe], waterHi: 0x7fb4d8,
  sand: [0xd9c689, 0xd8c689, 0xd4c083],
  asphalt: [0x4e525b, 0x4d515a, 0x50545c, 0x4c5059],
  highway: [0x43464e, 0x44474f],
  sidewalk: 0xc6c0ac, rail: 0xa9a59a, hwEdge: 0xc9a646,
  laneWhite: 0xe6e6e0, laneYellow: 0xe8c34a,
  // D005 住商工地坪（lotFill570／villaYard559），1–4 各三色；5＝草坪（用草色）
  lot: { 1: [0x6f8a58, 0x7d9a62, 0x628050], 2: [0x87888c, 0x919296, 0x7c7d81], 3: [0x6d675d, 0x777166, 0x635d54], 4: [0x54833f, 0x659950, 0x48733a] } as Record<number, number[]>,
  zone: [0, 0x9fd28a, 0x8fb4e0, 0xe0c27a],
  tram: 0x2e2e2e,
  // D019 配水管：實驗線 localWater475 精靈（49616）的三色——外框 rgba(27,46,58,.68)、管身 #52bde0、中心亮點 #d7f7ff
  pipe: 0x52bde0, pipeEdge: 0x1b2e3a, pipeHi: 0xd7f7ff,
  // D026 焦土：燒毀的建築留下的炭黑空地——炭黑一族、零星餘燼與灰、邊緣更暗（程式生成，沒有外部素材；實驗線畫的是焦土精靈，這裡只求一眼認得出來）
  ruin: [0x3a322c, 0x352d28, 0x2f2823, 0x403730], ruinEmber: 0x9a4a24, ruinAsh: 0x5b544c, ruinEdge: 0x1f1a17,
};
// D027 過載道路的暖色（實驗線 60574 @ d23c18d：過載的路格疊 rgba(255, 210−170r, 40−40r, .16+.34r)，r＝過載比例夾在 0–1，黃到紅）；本線量化成 OVER_LEVELS 檔，貼圖才不會每天每格都重畫
export const OVER_LEVELS = 7;
// 負載超過容量才有等級：1（剛超過）… OVER_LEVELS（超過一倍以上）；0＝沒過載（不畫）
export const overLevel = (load: number, cap: number): number => !(load > cap) ? 0 : 1 + Math.min(OVER_LEVELS - 1, Math.floor(Math.min(1, (load - cap) / cap) * OVER_LEVELS));
export const overTint = (level: number): { color: number; alpha: number } => {
  const r = (level - 1) / (OVER_LEVELS - 1);
  return { color: (255 << 16) | (Math.round(210 - 170 * r) << 8) | Math.round(40 - 40 * r), alpha: .16 + .34 * r };
};

export interface GroundCity {
  n: number; road: Uint8Array; rclass: Uint8Array; ter: Uint8Array; el: Uint8Array; zone: Uint8Array;
  rail: Uint8Array; dock: Uint8Array; tram: Uint8Array; occ: Int32Array; buildings: { k: number }[];
  wp?: Uint8Array;   // D019 配水管（沒有＝不畫）
  ruin?: Uint8Array;   // D026 焦土（沒有＝不畫；建築、路、鐵路的格子不畫，那是不該同時出現的資料）
  over?: Uint8Array;   // D027 過載道路的等級（0＝沒過載，1–OVER_LEVELS；只在道路格上畫；渲染層的輸入：由介面從模擬的道路負載算出來，不是世界狀態）
}
// D019：配水管的接頭（實驗線 recalcLocalWaterMask475 50925：上 1、右 2、下 4、左 8）。建築、路、鐵路、電車底下的不畫：實驗線先畫水管再畫路（60562→60563），被蓋住；回 −1＝這一格不畫水管
const pipeMask = (c: GroundCity, x: number, z: number) => {
  const n = c.n, wp = c.wp, i = z * n + x;
  if (!wp || !wp[i] || c.occ[i] || c.road[i] || c.rail[i] || c.tram[i]) return -1;
  const at = (xx: number, zz: number) => xx >= 0 && zz >= 0 && xx < n && zz < n && wp[zz * n + xx] > 0;
  return (at(x, z - 1) ? 1 : 0) | (at(x + 1, z) ? 2 : 0) | (at(x, z + 1) ? 4 : 0) | (at(x - 1, z) ? 8 : 0);
};

const mix = (a: number, b: number, t: number) => {
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};
const pick = (list: number[], h: number) => list[Math.min(list.length - 1, Math.floor(h * list.length))];

// 地面每格邊長（像素）：地圖 ≤128 格時 8，貼圖邊長上限 1,024
export const groundCellPx = (n: number) => Math.max(1, Math.min(8, Math.floor(1024 / n)));

// 回傳 RGBA 陣列（第 r 列＝世界 z＝r/S）；cat(k)＝建築分類；lots＝D005 的街區地坪（沒有就是 D003 模式）
// plates＝D007 非住商工建築的地坪色（實驗線精靈圖的地坪，−1＝照舊）
export function paintGround(c: GroundCity, cat: (k: number) => string, S: number, lots?: Uint8Array, plates?: Int32Array): Uint8Array {
  const n = c.n, W = n * S, data = new Uint8Array(W * W * 4);
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) paintTile(c, cat, S, lots, plates, data, x, z);
  return data;
}

// D014 增量重畫：每一格的輸入（路、等級、鐵路、碼頭、電車、地形、高地、分區、建築分類、地坪、非住商工地坪、四鄰有沒有路）壓成兩個整數；
// 跟上一次一樣的格直接沿用上一次的像素，不一樣的才重畫（同一個 paintTile，結果跟整張重畫逐位元組相同，守衛核對）
export interface GroundCache { n: number; S: number; k1: Int32Array; k2: Int32Array; k3: Int8Array; data: Uint8Array }
const CATCODE = (ct: string) => ct === '' ? 0 : ct === 'R' || ct === 'C' || ct === 'I' ? 1 : ct === 'G' ? 2 : ct === 'F' ? 3 : 4;
// 一格的三個鍵（groundKeys 逐格呼叫它；D027 的就地更新也用它，只重算一格）
export function keysAt(c: GroundCity, cat: (k: number) => string, x: number, z: number, lots?: Uint8Array, plates?: Int32Array): [number, number, number] {
  const n = c.n, i = z * n + x, b = c.occ[i] ? c.buildings[c.occ[i] - 1] : null;
  const isRoad = (xx: number, zz: number) => xx >= 0 && zz >= 0 && xx < n && zz < n && c.road[zz * n + xx] > 0;
  const nb = (isRoad(x, z - 1) ? 1 : 0) | (isRoad(x, z + 1) ? 2 : 0) | (isRoad(x - 1, z) ? 4 : 0) | (isRoad(x + 1, z) ? 8 : 0);
  const k1 = c.road[i] | (c.rclass[i] << 3) | (c.rail[i] ? 1 << 6 : 0) | (c.dock[i] ? 1 << 7 : 0) | (c.tram[i] ? 1 << 8 : 0) | (c.ter[i] << 9) | (c.el[i] ? 1 << 11 : 0)
    | (c.zone[i] << 12) | (CATCODE(b ? cat(b.k) : '') << 14) | ((b ? 1 : 0) << 17) | ((lots ? lots[i] : 0) << 18) | (nb << 21) | (lots ? 1 << 25 : 0) | (plates ? 1 << 26 : 0) | (c.ruin && c.ruin[i] && !b && !c.road[i] ? 1 << 27 : 0) | ((c.over && c.road[i] ? c.over[i] & 7 : 0) << 28);
  return [k1, plates ? plates[i] : -2, pipeMask(c, x, z)];
}
export function groundKeys(c: GroundCity, cat: (k: number) => string, lots?: Uint8Array, plates?: Int32Array): [Int32Array, Int32Array, Int8Array] {
  const n = c.n, k1 = new Int32Array(n * n), k2 = new Int32Array(n * n), k3 = new Int8Array(n * n);   // k3（D019）：配水管的接頭，−1＝不畫
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) { const i = z * n + x, [a, b, q] = keysAt(c, cat, x, z, lots, plates); k1[i] = a; k2[i] = b; k3[i] = q; }
  return [k1, k2, k3];
}
// D027：就地重畫指定的幾格（過載暖色每天在變，只有等級變了的路格要重畫；不必把整張 72×72 的鍵重算一遍）。改的是 cache 裡的像素與鍵，跟 paintGroundInc 同一個 paintTile，結果逐位元組等於整張重畫（守衛核對）
export function repaintTiles(c: GroundCity, cat: (k: number) => string, S: number, lots: Uint8Array | undefined, plates: Int32Array | undefined, cache: GroundCache, tiles: readonly number[]): void {
  const n = c.n;
  for (const i of tiles) { const x = i % n, z = (i / n) | 0, [a, b, q] = keysAt(c, cat, x, z, lots, plates); cache.k1[i] = a; cache.k2[i] = b; cache.k3[i] = q; paintTile(c, cat, S, lots, plates, cache.data, x, z); }
}
// D015：inPlace＝直接改上一次的像素（地面貼圖常駐、只上傳變動的格；tiles＝重畫了哪幾格）；不給就照 D014 另存一份
export function paintGroundInc(c: GroundCity, cat: (k: number) => string, S: number, lots: Uint8Array | undefined, plates: Int32Array | undefined, prev: GroundCache | null, inPlace = false): { cache: GroundCache; painted: number; tiles: number[] | null } {
  const n = c.n, [k1, k2, k3] = groundKeys(c, cat, lots, plates);
  if (!prev || prev.n !== n || prev.S !== S) { const data = paintGround(c, cat, S, lots, plates); return { cache: { n, S, k1, k2, k3, data }, painted: n * n, tiles: null }; }
  const data = inPlace ? prev.data : prev.data.slice(), tiles: number[] = [];
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const i = z * n + x;
    if (k1[i] === prev.k1[i] && k2[i] === prev.k2[i] && k3[i] === prev.k3[i]) continue;
    paintTile(c, cat, S, lots, plates, data, x, z); tiles.push(i);
  }
  return { cache: { n, S, k1, k2, k3, data }, painted: tiles.length, tiles };
}

function paintTile(c: GroundCity, cat: (k: number) => string, S: number, lots: Uint8Array | undefined, plates: Int32Array | undefined, data: Uint8Array, x: number, z: number) {
  const n = c.n, W = n * S;
  const put = (px: number, py: number, col: number) => { const i = (py * W + px) * 4; data[i] = (col >> 16) & 255; data[i + 1] = (col >> 8) & 255; data[i + 2] = col & 255; data[i + 3] = 255; };
  const isRoad = (x: number, z: number) => x >= 0 && z >= 0 && x < n && z < n && c.road[z * n + x] > 0;
  const mid = S >> 1;
  {
    const i = z * n + x, r = c.road[i], b = c.occ[i] ? c.buildings[c.occ[i] - 1] : null, ct = b ? cat(b.k) : '';
    const rN = isRoad(x, z - 1), rS = isRoad(x, z + 1), rW = isRoad(x - 1, z), rE = isRoad(x + 1, z);
    const straightNS = rN && rS && !rW && !rE, straightEW = rW && rE && !rN && !rS;
    // D019 配水管：沿格子中線往有水管的鄰格畫——管身 1 像素（u 或 v＝mid−1），下方／右方 1 像素陰影（外框色），中心 1 像素亮點；沒有鄰格就只畫中心亮點。
    // 實驗線的管身約是格寬的 5%（線寬 3／64），本線一格 8 像素，1 像素（12.5%）已是最細
    const pm = pipeMask(c, x, z), a = mid - 1, ov = r && c.over ? c.over[i] & 7 : 0, tint = ov ? overTint(ov) : null;   // D027
    const onArm = (u: number, v: number, w: number) => (u === a + w && (((pm & 1) && v <= a + w) || ((pm & 4) && v >= a)))
      || (v === a + w && (((pm & 8) && u <= a + w) || ((pm & 2) && u >= a)));
    for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
      const h = hash2(x * S + u, z * S + v, 7), edge = u === 0 || v === 0 || u === S - 1 || v === S - 1;
      // 面向非道路那一側的邊（人行道、護欄、高速黃邊都畫在這裡）
      const outer = (!rN && v === 0) || (!rS && v === S - 1) || (!rW && u === 0) || (!rE && u === S - 1);
      let col: number;
      if (r) {
        const hw = r === 3 || r === 4;
        col = hw ? pick(GROUND.highway, h) : pick(GROUND.asphalt, h);
        if (outer) col = hw ? GROUND.hwEdge : r === 2 ? GROUND.rail : GROUND.sidewalk;
        else {
          // 直路中線：幹道黃實線、一般路白虛線（每格兩段）；路口不畫
          const onLine = (straightNS && (u === mid - 1 || u === mid)) || (straightEW && (v === mid - 1 || v === mid));
          const along = straightNS ? v : u;
          if (onLine && !hw && c.rclass[i] >= 4) col = GROUND.laneYellow;
          else if (onLine && (u === mid || v === mid) && (along % 4 === 1 || along % 4 === 2)) col = GROUND.laneWhite;
        }
      }
      else if (c.rail[i]) col = (u === 1 || u === S - 2) ? 0x3a3a3a : v % 2 ? 0x7a5a3c : 0x6a6258;
      else if (c.dock[i]) col = v % 2 ? 0x8a6a48 : 0x7a5c3e;
      else if (c.ruin && c.ruin[i] && !b) { col = h < 0.05 ? GROUND.ruinEmber : h > 0.93 ? GROUND.ruinAsh : pick(GROUND.ruin, h); if (edge) col = mix(col, GROUND.ruinEdge, 0.4); }   // D026 焦土：蓋過分區、地坪的顏色
      else if (lots && lots[i]) {
        if (lots[i] === 5) col = (u === 0 || v === 0) ? GROUND.grassLine : pick(GROUND.grass, h);
        else { const L = GROUND.lot[lots[i]]; col = h < 0.09 ? L[1] : h > 0.91 ? L[2] : L[0]; }
      }
      else if (plates && plates[i] >= 0) { const pc = plates[i]; col = h < 0.08 ? mix(pc, 0x000000, 0.08) : h > 0.92 ? mix(pc, 0xffffff, 0.08) : pc; }
      // 其他設施用地（D003 模式）：綠地更綠、農田條紋、住商工是草坪、其餘是鋪面
      else if (b) col = ct === 'G' ? mix(0x86bd5c, 0x9bcc6a, h) : ct === 'F' ? (v % 2 ? 0xb9c95a : 0x9fb24a)
        : (ct === 'R' || ct === 'C' || ct === 'I') ? (edge ? mix(0x9aa08c, 0x8f9582, h) : mix(0x7fb356, 0x74a64d, h)) : mix(0xc9c3b5, 0xb8b1a2, h);
      else if (c.ter[i] === 0) col = h < 0.07 ? GROUND.waterHi : pick(GROUND.water, h);
      else if (c.ter[i] === 1) col = pick(GROUND.sand, h);
      else {
        col = (u === 0 || v === 0) ? GROUND.grassLine : c.el[i] ? pick(GROUND.grassHigh, h) : pick(GROUND.grass, h);
        const zn = c.zone[i];
        if (zn) col = mix(col, GROUND.zone[zn], edge ? 0.45 : 0.22);   // 劃了區還沒蓋：淡淡帶一點分區色，邊框深一點（實驗線也只是淡淡的）
      }
      if (c.tram[i] && (u === 1 || u === S - 2)) col = GROUND.tram;
      if (pm >= 0) {
        if (u === a && v === a) col = GROUND.pipeHi;
        else if (onArm(u, v, 0)) col = GROUND.pipe;
        else if (onArm(u, v, 1)) col = mix(col, GROUND.pipeEdge, 0.45);
      }
      if (tint) col = mix(col, tint.color, tint.alpha);   // D027：過載的道路整格疊暖色（車道線、人行道也一起染，跟實驗線疊一整塊矩形一樣）
      put(x * S + u, z * S + v, col);
    }
  }
}

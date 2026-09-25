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
};

export interface GroundCity {
  n: number; road: Uint8Array; rclass: Uint8Array; ter: Uint8Array; el: Uint8Array; zone: Uint8Array;
  rail: Uint8Array; dock: Uint8Array; tram: Uint8Array; occ: Int32Array; buildings: { k: number }[];
}

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
  const put = (px: number, py: number, col: number) => { const i = (py * W + px) * 4; data[i] = (col >> 16) & 255; data[i + 1] = (col >> 8) & 255; data[i + 2] = col & 255; data[i + 3] = 255; };
  const isRoad = (x: number, z: number) => x >= 0 && z >= 0 && x < n && z < n && c.road[z * n + x] > 0;
  const mid = S >> 1;
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const i = z * n + x, r = c.road[i], b = c.occ[i] ? c.buildings[c.occ[i] - 1] : null, ct = b ? cat(b.k) : '';
    const rN = isRoad(x, z - 1), rS = isRoad(x, z + 1), rW = isRoad(x - 1, z), rE = isRoad(x + 1, z);
    const straightNS = rN && rS && !rW && !rE, straightEW = rW && rE && !rN && !rS;
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
      put(x * S + u, z * S + v, col);
    }
  }
  return data;
}

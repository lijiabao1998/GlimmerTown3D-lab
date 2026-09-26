// 起步城佈局（D010）：在實驗線種子城的地形上，擺一小片讓模擬自己長的起步城。
// - 棋盤路網：4×4 個街廓、每個 4×4 格，路寬 1 格，共 21×21 格；路是 2 級（實驗線預設的「道路」工具 roadToolToRc('road')=2，index.html 51161）
// - 住商工三區：住宅為主；商業兩塊在城心北側；工業兩塊在東南角
// - 一座燃煤電廠 k5（工業角最外側那格，貼著兩條外圍路）、一間警察局 k11（城心路口西北那格；覆蓋半徑 10 罩住整座城的分區）
// 位置：整塊 21×21 都是平坦草地（ter=2、el=0）的候選裡，中心離地圖中心最近的那一個；同距離取 z 小、再取 x 小。純函式、決定性。
// 變體：電廠照實驗線放置時的座標公式 (x*7+y*13)%3（51672 附近 doPlace）；警察局實驗線放置時抽 ri(5)，這裡直接寫 0，不經亂數。

export const STARTER_BLOCKS = 4;          // 每邊幾個街廓
export const STARTER_BLOCK = 4;           // 街廓邊長（格）
export const STARTER_RC = 2;              // 道路等級
export const STARTER_SIZE = STARTER_BLOCKS * (STARTER_BLOCK + 1) + 1;   // 21

// 街廓分區：列＝bz、行＝bx；1 住 2 商 3 工
const PLAN = [
  [1, 1, 1, 1],
  [1, 2, 2, 1],
  [1, 1, 1, 1],
  [1, 1, 3, 3],
];

export interface StarterLayout {
  x0: number; z0: number; size: number; center: [number, number];
  roads: number[];                              // 格索引（z*n+x），升序
  zones: [number, number][];                    // [格索引, 1|2|3]，升序
  buildings: { i: number; k: number; v: number }[];   // 電廠、警察局
}

export function starterLayout(n: number, ter: ArrayLike<number>, el: ArrayLike<number>): StarterLayout {
  const S = STARTER_SIZE, flat = (i: number) => ter[i] === 2 && !el[i];
  let best: [number, number] | null = null, bestD = Infinity;
  for (let z0 = 0; z0 + S <= n; z0++) for (let x0 = 0; x0 + S <= n; x0++) {
    const cx = x0 + (S - 1) / 2, cz = z0 + (S - 1) / 2, d = (cx - n / 2) ** 2 + (cz - n / 2) ** 2;
    if (d >= bestD) continue;
    let ok = true;
    for (let z = z0; z < z0 + S && ok; z++) for (let x = x0; x < x0 + S; x++) if (!flat(z * n + x)) { ok = false; break; }
    if (ok) { best = [x0, z0]; bestD = d; }
  }
  if (!best) throw new Error('起步城：地圖上找不到 21×21 的平坦草地');
  const [x0, z0] = best, step = STARTER_BLOCK + 1;
  const roads: number[] = [], zones: [number, number][] = [];
  const onLine = (d: number) => d % step === 0;
  // 電廠：工業角（bx=3、bz=3）最外側那格；警察局：城心路口西北那格（街廓 bx=1、bz=1 的東南角）
  const plant = (z0 + S - 2) * n + (x0 + S - 2), police = (z0 + 2 * step - 1) * n + (x0 + 2 * step - 1);
  for (let dz = 0; dz < S; dz++) for (let dx = 0; dx < S; dx++) {
    const i = (z0 + dz) * n + x0 + dx;
    if (onLine(dx) || onLine(dz)) { roads.push(i); continue; }
    if (i === plant || i === police) continue;
    zones.push([i, PLAN[Math.floor(dz / step)][Math.floor(dx / step)]]);
  }
  const px = plant % n, pz = (plant / n) | 0;
  return {
    x0, z0, size: S, center: [x0 + (S - 1) / 2, z0 + (S - 1) / 2], roads, zones,
    buildings: [{ i: plant, k: 5, v: (px * 7 + pz * 13) % 3 }, { i: police, k: 11, v: 0 }].sort((a, b) => a.i - b.i),
  };
}

// 起步城要換的 8 個種子（D010 卡：換存檔的 seed 欄位）。第一個沿用種子城的 5162026，其餘間隔一個大質數
export const STARTER_SEEDS = Array.from({ length: 8 }, (_, k) => 5162026 + k * 1000003);
export const STARTER_DAYS = 120;

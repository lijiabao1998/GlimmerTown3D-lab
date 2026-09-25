// 渲染：只讀某一年的 CityState，建出 three.js 場景；不回頭改模擬（CLAUDE.md 規則 2）。
import * as THREE from 'three';
import type { CityState, Bld } from '../sim/history.ts';
import { LANDMARKS } from '../sim/history.ts';
import { hash2 } from '../sim/rng.ts';
import type { Style } from './styles.ts';
import { windowTexture, groundTexture, toonRamp, PLAIN_UV } from './textures.ts';

type V3 = [number, number, number];

// 非索引幾何累積器：面的繞向依給定法線自動校正，不用手算（D003 的城市場景也用它）
export class Geo {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = [];
  owner = 0; owners: number[] = [];   // 每個三角形屬於哪棟建築（0＝無），點擊時用 faceIndex 反查
  // D005 窗樣式：ext＝true 才多記兩個頂點屬性（wStyle＝窗磚圖集第幾格、wGlass＝玻璃色）；300 年示範不開，幾何逐位不變
  // band：牆腳色帶的高（以窗磚的 V 計）；>0＝店面帶（D005 商業一樓）、<0＝不開窗（工業牆下 45%）、0＝沒有。只寫在牆面，頂面一律 0
  ext = false; style = 0; band = 0; glass: THREE.Color | null = null; wst: number[] = []; wgl: number[] = []; wbd: number[] = [];
  constructor(opt: { ext?: boolean } = {}) { this.ext = !!opt.ext; }
  private pushExt(n: number) {
    if (!this.ext) return;
    const g = this.glass;
    for (let i = 0; i < n; i++) { this.wst.push(this.style); this.wbd.push(this.band); this.wgl.push(g ? g.r : 0, g ? g.g : 0, g ? g.b : 0); }
  }
  private tri(a: V3, b: V3, c: V3, n: V3, ua: [number, number], ub: [number, number], uc: [number, number], col: THREE.Color) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; }
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]] as [V3, [number, number]][]) {
      this.pos.push(...p); this.nor.push(...n); this.uv.push(...u); this.col.push(col.r, col.g, col.b);
    }
    this.pushExt(3);
    this.owners.push(this.owner);
  }
  // 四邊形 a-b-c-d（順序沿邊），uv 對應四角
  quad(a: V3, b: V3, c: V3, d: V3, n: V3, col: THREE.Color, uvs: [number, number][] = [PLAIN_UV, PLAIN_UV, PLAIN_UV, PLAIN_UV]) {
    this.tri(a, b, c, n, uvs[0], uvs[1], uvs[2], col);
    this.tri(a, c, d, n, uvs[0], uvs[2], uvs[3], col);
  }
  // 三角面：法線用實際面算，並翻到 away 那一側（朝外）
  triangle(a: V3, b: V3, c: V3, away: V3, col: THREE.Color) {
    const e1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), e2 = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = e1.cross(e2).normalize();
    if (n.x * away[0] + n.y * away[1] + n.z * away[2] < 0) n.negate();
    this.tri(a, b, c, [n.x, n.y, n.z], PLAIN_UV, PLAIN_UV, PLAIN_UV, col);
  }
  // 斜面：法線用實際面算，並指向「遠離建築中心」的一側
  slope(a: V3, b: V3, c: V3, d: V3, away: V3, col: THREE.Color) {
    const e1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), e2 = new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const n = e1.cross(e2).normalize();
    if (n.x * away[0] + n.y * away[1] + n.z * away[2] < 0) n.negate();
    this.quad(a, b, c, d, [n.x, n.y, n.z], col);
  }
  // 直立箱：四面牆（可帶窗 UV）＋頂面
  box(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, wall: THREE.Color, top: THREE.Color | null, win: { floorH: number; style?: number; glass?: THREE.Color; perCell?: number; bandH?: number; bandShop?: boolean } | null) {
    const st0 = this.style, gl0 = this.glass;
    if (win && win.style !== undefined) { this.style = win.style; this.glass = win.glass ?? null; }
    if (win && win.bandH) this.band = (win.bandShop ? 1 : -1) * win.bandH / win.floorH;
    const faces: [V3, V3, V3, V3, V3, number][] = [
      [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], z1 - z0],
      [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], z1 - z0],
      [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, 1], x1 - x0],
      [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], x1 - x0],
    ];
    for (const [a, b, c, d, n, wlen] of faces) {
      if (win) {
        const U = Math.max(1, Math.round(wlen * (win.perCell ?? 2))), Vv = (y1 - y0) / win.floorH;
        this.quad(a, b, c, d, n, wall, [[0, 0], [U, 0], [U, Vv], [0, Vv]]);
      } else this.quad(a, b, c, d, n, wall);
    }
    this.band = 0;
    if (top) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], top);
    this.style = st0; this.glass = gl0;
  }
  // 山牆屋頂：屋脊沿長邊（D004 起可用 along 指定 'x'／'z'）；兩端山牆三角用牆色
  gable(x0: number, z0: number, x1: number, z1: number, yb: number, rise: number, roof: THREE.Color, wall: THREE.Color, along?: 'x' | 'z') {
    const oh = 0.05, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, yr = yb + rise;
    if (along ? along === 'x' : x1 - x0 >= z1 - z0) {
      this.slope([x0 - oh, yb, z1 + oh], [x1 + oh, yb, z1 + oh], [x1 + oh, yr, cz], [x0 - oh, yr, cz], [0, 1, 1], roof);
      this.slope([x0 - oh, yb, z0 - oh], [x1 + oh, yb, z0 - oh], [x1 + oh, yr, cz], [x0 - oh, yr, cz], [0, 1, -1], roof);
      this.triangle([x1, yb, z0], [x1, yb, z1], [x1, yr, cz], [1, 0, 0], wall);
      this.triangle([x0, yb, z1], [x0, yb, z0], [x0, yr, cz], [-1, 0, 0], wall);
    } else {
      this.slope([x1 + oh, yb, z0 - oh], [x1 + oh, yb, z1 + oh], [cx, yr, z1 + oh], [cx, yr, z0 - oh], [1, 1, 0], roof);
      this.slope([x0 - oh, yb, z0 - oh], [x0 - oh, yb, z1 + oh], [cx, yr, z1 + oh], [cx, yr, z0 - oh], [-1, 1, 0], roof);
      this.triangle([x0, yb, z1], [x1, yb, z1], [cx, yr, z1], [0, 0, 1], wall);
      this.triangle([x1, yb, z0], [x0, yb, z0], [cx, yr, z0], [0, 0, -1], wall);
    }
  }
  // 四坡屋頂（D004）：屋脊沿 x，兩端各收半個進深（45°）；太短就收成尖頂
  hip(x0: number, z0: number, x1: number, z1: number, yb: number, rise: number, roof: THREE.Color) {
    const cz = (z0 + z1) / 2, yr = yb + rise, t = Math.min((z1 - z0) / 2, (x1 - x0) / 2);
    const r0: V3 = [x0 + t, yr, cz], r1: V3 = [x1 - t, yr, cz];
    this.slope([x0, yb, z1], [x1, yb, z1], r1, r0, [0, 1, 1], roof);
    this.slope([x0, yb, z0], [x1, yb, z0], r1, r0, [0, 1, -1], roof);
    this.triangle([x0, yb, z0], [x0, yb, z1], r0, [-1, 0.5, 0], roof);
    this.triangle([x1, yb, z0], [x1, yb, z1], r1, [1, 0.5, 0], roof);
  }
  // 鋸齒屋頂（D004，實驗線 sawtoothRoof608）：沿 x（alongX）或沿 z 排 n 齒；每齒一片斜面往前升高，前緣是直立的採光面
  saw(x0: number, z0: number, x1: number, z1: number, yb: number, rise: number, n: number, alongX: boolean, roof: THREE.Color, glass: THREE.Color) {
    const yr = yb + rise;
    for (let i = 0; i < n; i++) {
      if (alongX) {
        const a0 = x0 + (x1 - x0) * i / n, a1 = x0 + (x1 - x0) * (i + 1) / n;
        this.slope([a0, yb, z0], [a0, yb, z1], [a1, yr, z1], [a1, yr, z0], [-1, 1, 0], roof);
        this.quad([a1, yb, z0], [a1, yb, z1], [a1, yr, z1], [a1, yr, z0], [1, 0, 0], glass);
        this.triangle([a0, yb, z1], [a1, yb, z1], [a1, yr, z1], [0, 0, 1], roof);
        this.triangle([a0, yb, z0], [a1, yb, z0], [a1, yr, z0], [0, 0, -1], roof);
      } else {
        const a0 = z0 + (z1 - z0) * i / n, a1 = z0 + (z1 - z0) * (i + 1) / n;
        this.slope([x0, yb, a0], [x1, yb, a0], [x1, yr, a1], [x0, yr, a1], [0, 1, -1], roof);
        this.quad([x0, yb, a1], [x1, yb, a1], [x1, yr, a1], [x0, yr, a1], [0, 0, 1], glass);
        this.triangle([x1, yb, a0], [x1, yb, a1], [x1, yr, a1], [1, 0, 0], roof);
        this.triangle([x0, yb, a0], [x0, yb, a1], [x0, yr, a1], [-1, 0, 0], roof);
      }
    }
  }
  pyramid(cx: number, cz: number, h: number, yb: number, rise: number, col: THREE.Color) {
    const a: V3 = [cx - h, yb, cz - h], b: V3 = [cx + h, yb, cz - h], c: V3 = [cx + h, yb, cz + h], d: V3 = [cx - h, yb, cz + h], t: V3 = [cx, yb + rise, cz];
    for (const [p, q] of [[a, b], [b, c], [c, d], [d, a]] as [V3, V3][])
      this.triangle(p, q, t, [(p[0] + q[0]) / 2 - cx, 0.5, (p[2] + q[2]) / 2 - cz], col);
  }
  cylinder(cx: number, cz: number, rb: number, rt: number, y0: number, h: number, col: THREE.Color, seg = 10) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, false).toNonIndexed();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i) + cx, p.getY(i) + y0 + h / 2, p.getZ(i) + cz);
      this.nor.push(n.getX(i), n.getY(i), n.getZ(i));
      this.uv.push(...PLAIN_UV); this.col.push(col.r, col.g, col.b);
      if (i % 3 === 2) { this.owners.push(this.owner); this.pushExt(3); }
    }
    g.dispose();
  }
  // 任意 three 幾何（非索引化後）套矩陣加進來：球、半球、圓環、旋轉的箱、旋轉體……（D007）。矩陣不能鏡射（行列式要 > 0，不然面會反）
  addGeometry(g: THREE.BufferGeometry, m: THREE.Matrix4, col: THREE.Color) {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.attributes.position, n = ng.attributes.normal, nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); this.nor.push(v.x, v.y, v.z);
      this.uv.push(...PLAIN_UV); this.col.push(col.r, col.g, col.b);
      if (i % 3 === 2) { this.owners.push(this.owner); this.pushExt(3); }
    }
    if (ng !== g) ng.dispose();
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.ext) {
      g.setAttribute('wStyle', new THREE.Float32BufferAttribute(this.wst, 1));
      g.setAttribute('wGlass', new THREE.Float32BufferAttribute(this.wgl, 3));
      g.setAttribute('wBand', new THREE.Float32BufferAttribute(this.wbd, 1));
    }
    return g;
  }
}

const C = (h: number, s: number, l: number) => new THREE.Color().setHSL(h / 360, s, l, THREE.SRGBColorSpace);

// 牆與屋頂的年代配色：老＝紅磚尖頂、中＝米色水泥平頂、新＝玻璃；商業更鮮、工業偏金屬灰
function palette(b: Bld) {
  const t = b.tone;
  let wall: THREE.Color, roof: THREE.Color;
  if (b.kind === 'I') { wall = C(205 + t * 20, 0.12, 0.62 + t * 0.08); roof = C(200, 0.1, 0.42); }
  else if (b.era === 'old') { wall = C(8 + t * 22, 0.42 + t * 0.15, 0.5 + t * 0.08); roof = t < 0.5 ? C(355 + t * 10, 0.35, 0.32) : C(215, 0.12, 0.3); }
  else if (b.era === 'mid') { wall = C(32 + t * 18, 0.22 + t * 0.12, 0.72 + t * 0.07); roof = C(30, 0.06, 0.52); }
  else { wall = C(198 + t * 22, 0.3, 0.6 + t * 0.08); roof = C(210, 0.08, 0.35); }
  if (b.kind === 'C' && b.era !== 'new') wall.offsetHSL(0, 0.08, -0.03);
  // 荒廢：褪色偏灰褐；損壞越重越綠（青苔）
  if (b.abandoned) { wall.lerp(C(35, 0.12, 0.42), 0.45); roof.lerp(C(35, 0.1, 0.3), 0.4); }
  if (b.dmg > 0) { wall.lerp(C(95, 0.25, 0.36), Math.min(0.5, b.dmg * 0.55)); }
  return { wall, roof };
}

// 點擊結果：id＝建築（0＝空地），x／z＝要查履歷的那一格
export interface Hit { id: number; x: number; z: number }
export interface Built {
  scene: THREE.Scene; center: THREE.Vector3; size: number;
  pick(ray: THREE.Raycaster): Hit | null;
  rubbleSpots(): { id: number; x: number; y: number; z: number }[];   // 給煙霧測試：瓦礫實例的位置
  timing: Record<string, number>;   // 建場景各段耗時（毫秒），追效能用
  dispose(): void;
}

export function buildScene(s: CityState, style: Style): Built {
  const N = s.size, scene = new THREE.Scene();
  const T: Record<string, number> = {}; let tp = performance.now(); const mark = (k: string) => { const n = performance.now(); T[k] = n - tp; tp = n; };
  scene.background = new THREE.Color().setHSL(0.58, 0.35, 0.82, THREE.SRGBColorSpace);
  const disposables: { dispose(): void }[] = [];
  const ramp = style.toon ? toonRamp() : null;
  if (ramp) disposables.push(ramp);
  const mat = (opts: { map?: THREE.Texture; vertexColors?: boolean; color?: THREE.ColorRepresentation }) => {
    const m = style.toon ? new THREE.MeshToonMaterial({ ...opts, gradientMap: ramp! }) : new THREE.MeshStandardMaterial({ ...opts, roughness: 0.92, metalness: 0 });
    disposables.push(m); return m;
  };

  // 地面
  const gtex = groundTexture(s); disposables.push(gtex);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(N, N), mat({ map: gtex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(N / 2, 0, N / 2); ground.receiveShadow = true;
  disposables.push(ground.geometry);
  scene.add(ground);

  // 建築：牆（帶窗）與其他（屋頂、塔、瓦礫）分兩個網格
  mark('ground');
  const W = new Geo(), O = new Geo();
  const rubble: [number, number, number, number][] = [], rubbleOwner: number[] = [];
  const byId = new Map(s.blds.map(b => [b.id, b]));
  for (const b of s.blds) {
    W.owner = O.owner = b.id;
    const { wall, roof } = palette(b);
    const m = 0.1, x0 = b.x + m, z0 = b.z + m, x1 = b.x + b.w - m, z1 = b.z + b.d - m;
    const keep = 1 - b.dmg * 0.72, roofless = b.dmg >= 0.3;
    if (b.dmg >= 1) {                                                 // 完全倒塌：瓦礫堆
      for (let k = 0; k < 5 + b.w * b.d * 2; k++) {
        const hx = hash2(b.id, k, 1), hz = hash2(b.id, k, 2);
        rubble.push([b.x + 0.15 + hx * (b.w - 0.3), b.z + 0.15 + hz * (b.d - 0.3), 0.08 + hash2(b.id, k, 3) * 0.12, hash2(b.id, k, 4)]);
        rubbleOwner.push(b.id);
      }
      continue;
    }
    if (LANDMARKS.includes(b.kind)) { landmark(b, W, O, wall, roof, keep, roofless); continue; }
    const floorH = b.kind === 'I' ? 0.4 : 0.3;
    const h = Math.max(0.12, (b.lv * floorH + (b.lv === 1 ? 0.08 : 0)) * keep);
    // 高樓稍微收窄，看起來像塔而不是方盒
    const inset = b.lv >= 4 ? 0.08 : 0;
    W.box(x0 + inset, z0 + inset, x1 - inset, z1 - inset, 0, h, wall, roofless ? C(30, 0.15, 0.22) : (b.era === 'old' && b.kind !== 'I' ? null : roof), { floorH });
    if (roofless) continue;
    if (b.kind === 'I') O.gable(x0, z0, x1, z1, h, 0.14, roof, wall);
    else if (b.era === 'old') O.gable(x0, z0, x1, z1, h, 0.22 + 0.08 * Math.min(b.w, b.d), roof, wall);
    else if (b.era === 'mid') O.box(x0 + inset - 0.02, z0 + inset - 0.02, x1 - inset + 0.02, z1 - inset + 0.02, h, h + 0.05, wall.clone().offsetHSL(0, 0, 0.06), roof, null);
    else {
      O.box(x0 + 0.2 + inset, z0 + 0.2 + inset, x1 - 0.25 - inset, z1 - 0.25 - inset, h, h + 0.12, C(210, 0.05, 0.7), C(210, 0.05, 0.78), null);
    }
  }

  function landmark(b: Bld, Wg: Geo, Og: Geo, wall: THREE.Color, roof: THREE.Color, keep: number, roofless: boolean) {
    const cx = b.x + b.w / 2, cz = b.z + b.d / 2;
    if (b.kind === 'clock') {
      const h = 1.7 * keep;
      Wg.box(cx - 0.28, cz - 0.28, cx + 0.28, cz + 0.28, 0, h, C(35, 0.3, 0.72), null, null);
      if (keep > 0.8) {
        for (const [dx, dz, nx, nz] of [[0.285, 0, 1, 0], [0, 0.285, 0, 1]]) {   // 兩面鐘
          const a: V3 = [cx + dx - nz * 0.14, h - 0.42, cz + dz - nx * 0.14], bb: V3 = [cx + dx + nz * 0.14, h - 0.42, cz + dz + nx * 0.14];
          Og.quad(a, bb, [bb[0], h - 0.16, bb[2]], [a[0], h - 0.16, a[2]], [nx, 0, nz], C(45, 0.3, 0.92));
        }
      }
      if (!roofless) Og.pyramid(cx, cz, 0.34, h, 0.55, C(160, 0.25, 0.35));
    } else if (b.kind === 'chapel') {
      const h = 0.7 * keep;
      Wg.box(cx - 0.36, cz - 0.3, cx + 0.36, cz + 0.3, 0, h, C(40, 0.2, 0.8), null, null);
      if (!roofless) { Og.gable(cx - 0.36, cz - 0.3, cx + 0.36, cz + 0.3, h, 0.42, C(10, 0.3, 0.32), C(40, 0.2, 0.8)); Og.box(cx + 0.2, cz - 0.1, cx + 0.36, cz + 0.06, h, h + 0.5, C(40, 0.2, 0.8), null, null); Og.pyramid(cx + 0.28, cz - 0.02, 0.1, h + 0.5, 0.4, C(10, 0.3, 0.32)); }
    } else if (b.kind === 'school') {
      const h = 0.75 * keep;
      Wg.box(b.x + 0.12, b.z + 0.14, b.x + b.w - 0.12, b.z + b.d - 0.14, 0, h, C(40, 0.55, 0.66), null, { floorH: 0.37 });
      if (!roofless) { Og.gable(b.x + 0.12, b.z + 0.14, b.x + b.w - 0.12, b.z + b.d - 0.14, h, 0.3, C(5, 0.4, 0.38), C(40, 0.55, 0.66)); Og.box(cx - 0.1, cz - 0.1, cx + 0.1, cz + 0.1, h + 0.2, h + 0.45, C(0, 0, 0.92), null, null); }
    } else if (b.kind === 'watertower') {
      for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) Og.box(cx + dx - 0.03, cz + dz - 0.03, cx + dx + 0.03, cz + dz + 0.03, 0, 0.9 * keep, C(0, 0, 0.45), null, null);
      if (keep > 0.6) { Og.cylinder(cx, cz, 0.3, 0.3, 0.9, 0.45, C(200, 0.25, 0.7)); if (!roofless) Og.pyramid(cx, cz, 0.3, 1.35, 0.18, C(200, 0.2, 0.45)); }
    } else if (b.kind === 'plant') {
      Wg.box(b.x + 0.15, b.z + 0.15, b.x + 1.2, b.z + b.d - 0.15, 0, 0.8 * keep, C(210, 0.08, 0.6), roofless ? null : C(210, 0.08, 0.45), { floorH: 0.4 });
      Og.cylinder(b.x + 1.55, b.z + 0.55, 0.38, 0.26, 0, 1.2 * keep, C(0, 0, 0.78));
      Og.cylinder(b.x + 1.55, b.z + 1.45, 0.38, 0.26, 0, 1.2 * keep, C(0, 0, 0.74));
      Og.cylinder(b.x + 0.4, b.z + 0.4, 0.07, 0.06, 0.8 * keep, 0.9 * keep, C(5, 0.5, 0.45), 8);
    }
  }

  mark('geo');
  W.owner = O.owner = 0;
  const texW = windowTexture(); disposables.push(texW);
  const wallsMesh = new THREE.Mesh(W.geometry(), mat({ map: texW, vertexColors: true }));
  const otherMesh = new THREE.Mesh(O.geometry(), mat({ vertexColors: true }));
  const owners = new Map<THREE.Object3D, Int32Array>([[wallsMesh, Int32Array.from(W.owners)], [otherMesh, Int32Array.from(O.owners)]]);
  for (const m of [wallsMesh, otherMesh]) { m.castShadow = m.receiveShadow = true; disposables.push(m.geometry); scene.add(m); }
  const pickables: THREE.Object3D[] = [wallsMesh, otherMesh, ground];

  mark('mesh');
  // 瓦礫
  let rubbleMesh: THREE.InstancedMesh | null = null;
  if (rubble.length) {
    const rg = new THREE.BoxGeometry(0.2, 1, 0.16); disposables.push(rg);
    const rm = new THREE.InstancedMesh(rg, mat({ color: 0xffffff }), rubble.length);
    const q = new THREE.Object3D(), c = new THREE.Color();
    rubble.forEach(([x, z, h, t], i) => {
      q.position.set(x, h / 2, z); q.rotation.set(0, t * 3, 0); q.scale.set(0.7 + t, h, 0.7 + t * 0.5); q.updateMatrix();
      rm.setMatrixAt(i, q.matrix); rm.setColorAt(i, c.setHSL(0.08, 0.12, 0.38 + t * 0.2, THREE.SRGBColorSpace));
    });
    rm.castShadow = rm.receiveShadow = true; scene.add(rm);
    rubbleMesh = rm; pickables.push(rm);
  }

  mark('rubble');
  // 樹：樹冠＋樹幹；廢墟年代偏深綠
  if (s.trees.length) {
    const cg = new THREE.IcosahedronGeometry(0.3, 0), tg = new THREE.CylinderGeometry(0.045, 0.06, 0.28, 5);
    disposables.push(cg, tg);
    const crowns = new THREE.InstancedMesh(cg, mat({ color: 0xffffff }), s.trees.length);
    const trunks = new THREE.InstancedMesh(tg, mat({ color: 0x6b4f35 }), s.trees.length);
    const q = new THREE.Object3D(), c = new THREE.Color(), late = s.year > 150;
    s.trees.forEach((t, i) => {
      const jx = (hash2(t.x, t.z, 11) - 0.5) * 0.4, jz = (hash2(t.x, t.z, 12) - 0.5) * 0.4, sc = t.s * (0.85 + hash2(t.x, t.z, 13) * 0.35);
      q.position.set(t.x + 0.5 + jx, 0.14 * sc, t.z + 0.5 + jz); q.rotation.set(0, 0, 0); q.scale.set(sc, sc, sc); q.updateMatrix(); trunks.setMatrixAt(i, q.matrix);
      q.position.y = 0.42 * sc; q.rotation.set(hash2(t.x, t.z, 14), hash2(t.x, t.z, 15) * 3, 0); q.scale.set(sc, sc * 1.15, sc); q.updateMatrix(); crowns.setMatrixAt(i, q.matrix);
      const h = hash2(t.x, t.z, 16);
      crowns.setColorAt(i, c.setHSL((late ? 0.3 : 0.27) + h * 0.06, late ? 0.42 : 0.45, (late ? 0.3 : 0.36) + h * 0.1, THREE.SRGBColorSpace));
    });
    for (const m of [crowns, trunks]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  }

  mark('trees');
  // 車：只在城市還活著的年份出現，決定性撒在路上
  if (s.year <= 100) {
    const cars: [number, number, boolean, number][] = [];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const r = s.road[z * N + x];
      if (r !== 1 || hash2(x, z, 21) > 0.1) continue;
      const alongX = (x > 0 && s.road[z * N + x - 1] === 1) || (x < N - 1 && s.road[z * N + x + 1] === 1);
      cars.push([x + 0.5, z + 0.5, alongX, hash2(x, z, 22)]);
    }
    if (cars.length) {
      const g = new THREE.BoxGeometry(0.3, 0.12, 0.16); disposables.push(g);
      const cm = new THREE.InstancedMesh(g, mat({ color: 0xffffff }), cars.length);
      const q = new THREE.Object3D(), c = new THREE.Color();
      const COLS = [0xc9362b, 0xe8e6df, 0x2f5a86, 0x2b2e33, 0xd8b43a, 0x5f8f5a];
      cars.forEach(([x, z, ax, h], i) => {
        const off = (h < 0.5 ? -1 : 1) * 0.14;
        q.position.set(x + (ax ? 0 : off), 0.07, z + (ax ? off : 0)); q.rotation.set(0, ax ? 0 : Math.PI / 2, 0); q.scale.set(1, 1, 1); q.updateMatrix();
        cm.setMatrixAt(i, q.matrix); cm.setColorAt(i, c.set(COLS[Math.floor(h * 97) % COLS.length]));
      });
      cm.castShadow = true; scene.add(cm);
    }
  }

  mark('cars');
  // 光：從畫面左上方來。正交鏡頭放在 (+x,+y,+z) 看向城心時，畫面左＝世界 (-1,0,+1)；+z 面在左、+x 面在右
  const center = new THREE.Vector3(N / 2, 0, N / 2);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x6b5a44, style.toon ? 1.1 : 1.35));
  const sun = new THREE.DirectionalLight(0xfff4e0, style.toon ? 2.2 : 2.4);
  sun.position.copy(center).add(new THREE.Vector3(-0.35, 1.25, 1.0).multiplyScalar(N));
  sun.target.position.copy(center);
  sun.castShadow = true;
  const sc = sun.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -N * 0.75; sc.right = sc.top = N * 0.75; sc.near = 1; sc.far = N * 4;
  sun.shadow.mapSize.set(style.softShadow ? 2048 : 1536, style.softShadow ? 2048 : 1536);
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  if (style.softShadow) sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  mark('lights');
  // 點擊：樹和車不擋（射線穿過去）；打到建築／瓦礫就回那棟建築的起始格，打到地面就回那一格
  const pick = (ray: THREE.Raycaster): Hit | null => {
    for (const h of ray.intersectObjects(pickables, false)) {
      let id = 0;
      if (h.object === rubbleMesh && h.instanceId != null) id = rubbleOwner[h.instanceId];
      else if (owners.has(h.object) && h.faceIndex != null) id = owners.get(h.object)![h.faceIndex];
      const b = id ? byId.get(id) : undefined;
      if (b) return { id, x: b.x, z: b.z };
      if (h.object === ground) {
        const x = Math.floor(h.point.x), z = Math.floor(h.point.z);
        if (x >= 0 && z >= 0 && x < N && z < N) return { id: 0, x, z };
      }
    }
    return null;
  };
  const rubbleSpots = () => rubble.map(([x, z, h], i) => ({ id: rubbleOwner[i], x, y: h / 2, z }));

  return { scene, center, size: N, pick, rubbleSpots, timing: T, dispose: () => { for (const d of disposables) d.dispose(); } };
}

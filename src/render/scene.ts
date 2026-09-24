// 渲染：只讀某一年的 CityState，建出 three.js 場景；不回頭改模擬（CLAUDE.md 規則 2）。
import * as THREE from 'three';
import type { CityState, Bld } from '../sim/history.ts';
import { LANDMARKS } from '../sim/history.ts';
import { hash2 } from '../sim/rng.ts';
import type { Style } from './styles.ts';
import { windowTexture, groundTexture, toonRamp, PLAIN_UV } from './textures.ts';

type V3 = [number, number, number];

// 非索引幾何累積器：面的繞向依給定法線自動校正，不用手算
class Geo {
  pos: number[] = []; nor: number[] = []; uv: number[] = []; col: number[] = [];
  private tri(a: V3, b: V3, c: V3, n: V3, ua: [number, number], ub: [number, number], uc: [number, number], col: THREE.Color) {
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; }
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]] as [V3, [number, number]][]) {
      this.pos.push(...p); this.nor.push(...n); this.uv.push(...u); this.col.push(col.r, col.g, col.b);
    }
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
  box(x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, wall: THREE.Color, top: THREE.Color | null, win: { floorH: number } | null) {
    const faces: [V3, V3, V3, V3, V3, number][] = [
      [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], z1 - z0],
      [[x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [-1, 0, 0], z1 - z0],
      [[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], [0, 0, 1], x1 - x0],
      [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], x1 - x0],
    ];
    for (const [a, b, c, d, n, wlen] of faces) {
      if (win) {
        const U = Math.max(1, Math.round(wlen * 2)), Vv = (y1 - y0) / win.floorH;
        this.quad(a, b, c, d, n, wall, [[0, 0], [U, 0], [U, Vv], [0, Vv]]);
      } else this.quad(a, b, c, d, n, wall);
    }
    if (top) this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], top);
  }
  // 山牆屋頂：屋脊沿長邊；兩端山牆三角用牆色
  gable(x0: number, z0: number, x1: number, z1: number, yb: number, rise: number, roof: THREE.Color, wall: THREE.Color) {
    const oh = 0.05, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, yr = yb + rise;
    if (x1 - x0 >= z1 - z0) {
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
    }
    g.dispose();
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
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

export interface Built { scene: THREE.Scene; center: THREE.Vector3; size: number; dispose(): void; }

export function buildScene(s: CityState, style: Style): Built {
  const N = s.size, scene = new THREE.Scene();
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
  const W = new Geo(), O = new Geo();
  const rubble: [number, number, number, number][] = [];
  for (const b of s.blds) {
    const { wall, roof } = palette(b);
    const m = 0.1, x0 = b.x + m, z0 = b.z + m, x1 = b.x + b.w - m, z1 = b.z + b.d - m;
    const keep = 1 - b.dmg * 0.72, roofless = b.dmg >= 0.3;
    if (b.dmg >= 1) {                                                 // 完全倒塌：瓦礫堆
      for (let k = 0; k < 5 + b.w * b.d * 2; k++) {
        const hx = hash2(b.id, k, 1), hz = hash2(b.id, k, 2);
        rubble.push([b.x + 0.15 + hx * (b.w - 0.3), b.z + 0.15 + hz * (b.d - 0.3), 0.08 + hash2(b.id, k, 3) * 0.12, hash2(b.id, k, 4)]);
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

  const texW = windowTexture(); disposables.push(texW);
  const wallsMesh = new THREE.Mesh(W.geometry(), mat({ map: texW, vertexColors: true }));
  const otherMesh = new THREE.Mesh(O.geometry(), mat({ vertexColors: true }));
  for (const m of [wallsMesh, otherMesh]) { m.castShadow = m.receiveShadow = true; disposables.push(m.geometry); scene.add(m); }

  // 瓦礫
  if (rubble.length) {
    const rg = new THREE.BoxGeometry(0.2, 1, 0.16); disposables.push(rg);
    const rm = new THREE.InstancedMesh(rg, mat({ color: 0xffffff }), rubble.length);
    const q = new THREE.Object3D(), c = new THREE.Color();
    rubble.forEach(([x, z, h, t], i) => {
      q.position.set(x, h / 2, z); q.rotation.set(0, t * 3, 0); q.scale.set(0.7 + t, h, 0.7 + t * 0.5); q.updateMatrix();
      rm.setMatrixAt(i, q.matrix); rm.setColorAt(i, c.setHSL(0.08, 0.12, 0.38 + t * 0.2, THREE.SRGBColorSpace));
    });
    rm.castShadow = rm.receiveShadow = true; scene.add(rm);
  }

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

  return { scene, center, size: N, dispose: () => { for (const d of disposables) d.dispose(); } };
}

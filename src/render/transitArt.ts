// D101：最小運輸繪製。只讀 City 與不可變的路網，不回寫世界、資金或歷史。
// 地面件合為一個網格；地下示意另為一個網格，只在運輸介面要求時顯示。
// 色票照抄本線 ground.ts:210 的鐵路（鋼、枕木、道床）與 GROUND 的電車、
// 人行道、黃線、工業地坪、配水管藍。GROUND.rail 是道路邊色，並非鐵軌。
import * as THREE from 'three';
import type { City } from '../sim/city.ts';
import type { NetworkEdge, TransitDepot, TransitNetwork, TransitStation } from '../sim/transit/network.ts';
import { Geo } from './scene.ts';

export type TransitArtVariant = 'a' | 'b' | 'c';
const INK = {
  steel: new THREE.Color(0x3a3a3a), sleeper: new THREE.Color(0x7a5a3c), ballast: new THREE.Color(0x6a6258),
  tram: new THREE.Color(0x2e2e2e), platform: new THREE.Color(0xc6c0ac), yellow: new THREE.Color(0xe8c34a),
  depot: new THREE.Color(0x6d675d), white: new THREE.Color(0xe6e6e0), metro: new THREE.Color(0x52bde0),
};
const DETAIL = {
  a: { bed: 0.48, rail: 0.045, sleepers: 0, platform: 0.045 },
  b: { bed: 0.64, rail: 0.06, sleepers: 3, platform: 0.075 },
  c: { bed: 0.76, rail: 0.075, sleepers: 5, platform: 0.11 },
};

// 與 cityScene.ts 的 tileTop 同一座格網：高地為 0.4，不把資料層的 h 當公尺。
// 這裡不 import cityScene，避免運輸小圖層牽入整個城市場景的相依。
function tileY(c: City, x: number, z: number): number {
  const i = z * c.n + x;
  if (c.road[i] === 2 || c.road[i] === 4) return 0.02;
  if (c.ter[i] === 0) return -0.06;
  return c.el[i] ? 0.4 : 0;
}

// 兩端可不同高；Geo.slope 依真正的斜面算 normal。offset 是軌道左右的偏移。
function strip(g: Geo, x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, width: number, color: THREE.Color, offset = 0): void {
  const dx = x1 - x0, dz = z1 - z0, length = Math.hypot(dx, dz);
  if (!length) return;
  const px = -dz / length, pz = dx / length, lo = offset - width / 2, hi = offset + width / 2;
  g.slope([x0 + px * lo, y0, z0 + pz * lo], [x1 + px * lo, y1, z1 + pz * lo],
    [x1 + px * hi, y1, z1 + pz * hi], [x0 + px * hi, y0, z0 + pz * hi], [0, 1, 0], color);
}

function track(g: Geo, c: City, e: NetworkEdge, variant: TransitArtVariant): void {
  const d = DETAIL[variant], ax = e.a.x + 0.5, az = e.a.z + 0.5, bx = e.b.x + 0.5, bz = e.b.z + 0.5;
  const ay = Math.max(0, tileY(c, e.a.x, e.a.z)) + 0.018, by = Math.max(0, tileY(c, e.b.x, e.b.z)) + 0.018;
  const dx = bx - ax, dz = bz - az, rail = e.mode === 'tram' ? INK.tram : INK.steel;
  // 電車是嵌地的雙軌；鐵路才畫道床與木枕。
  if (e.mode === 'rail') {
    strip(g, ax, az, ay, bx, bz, by, d.bed, INK.ballast);
    for (let k = 0; k < d.sleepers; k++) {
      const t = (k + 0.5) / d.sleepers, x = ax + dx * t, z = az + dz * t, y = ay + (by - ay) * t + 0.007;
      strip(g, x - dz * d.bed * 0.45, z + dx * d.bed * 0.45, y, x + dz * d.bed * 0.45, z - dx * d.bed * 0.45, y, 0.075, INK.sleeper);
    }
  }
  for (const side of [-1, 1]) strip(g, ax, az, ay + 0.013, bx, bz, by + 0.013, d.rail, rail, side * 0.18);
}

function padY(c: City, p: TransitStation | TransitDepot): number {
  let y = 0;
  for (let dz = 0; dz < p.h; dz++) for (let dx = 0; dx < p.w; dx++) y = Math.max(y, tileY(c, p.x + dx, p.z + dz));
  return y + 0.018;
}

function platform(g: Geo, c: City, p: TransitStation, variant: TransitArtVariant): void {
  const y = padY(c, p), top = y + DETAIL[variant].platform, inset = 0.07;
  g.box(p.x + inset, p.z + inset, p.x + p.w - inset, p.z + p.h - inset, y, top, INK.ballast, INK.platform, null);
  // v1 車站固定 2×1、不旋轉；中央雙軌與兩邊月台黃線區別於車廠地板。
  for (const side of [-1, 1]) {
    strip(g, p.x + 0.12, p.z + p.h / 2, top + 0.003, p.x + p.w - 0.12, p.z + p.h / 2, top + 0.003, DETAIL[variant].rail,
      p.mode === 'tram' ? INK.tram : INK.steel, side * 0.18);
    if (variant !== 'a') strip(g, p.x + 0.14, p.z + p.h / 2, top + 0.005, p.x + p.w - 0.14, p.z + p.h / 2, top + 0.005, 0.035, INK.yellow, side * 0.34);
  }
}

function depot(g: Geo, c: City, p: TransitDepot, variant: TransitArtVariant): void {
  const y = padY(c, p), top = y + (variant === 'c' ? 0.065 : 0.025), inset = 0.06;
  g.box(p.x + inset, p.z + inset, p.x + p.w - inset, p.z + p.h - inset, y, top, INK.ballast, INK.depot, null);
  for (let bay = 0; bay < p.w; bay++) {
    const x = p.x + bay + 0.5;
    for (const side of [-1, 1]) strip(g, x + side * 0.18, p.z + 0.15, top + 0.005, x + side * 0.18, p.z + p.h - 0.15, top + 0.005,
      DETAIL[variant].rail, p.mode === 'tram' ? INK.tram : INK.steel);
    if (variant !== 'a') strip(g, x - 0.3, p.z + 0.2, top + 0.008, x + 0.3, p.z + 0.2, top + 0.008, 0.045, INK.yellow);
  }
  if (variant === 'c') {
    for (const z of [p.z + 0.09, p.z + p.h - 0.09]) strip(g, p.x + 0.1, z, top + 0.006, p.x + p.w - 0.1, z, top + 0.006, 0.04, INK.white);
  }
}

function dashed(g: Geo, x0: number, z0: number, y0: number, x1: number, z1: number, y1: number, width: number): void {
  const count = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 4));
  for (let i = 0; i < count; i++) {
    const a = (i + 0.12) / count, b = (i + 0.7) / count;
    strip(g, x0 + (x1 - x0) * a, z0 + (z1 - z0) * a, y0 + (y1 - y0) * a,
      x0 + (x1 - x0) * b, z0 + (z1 - z0) * b, y0 + (y1 - y0) * b, width, INK.metro);
  }
}

function metroPad(g: Geo, c: City, p: TransitStation | TransitDepot): void {
  const y = padY(c, p) + 0.04, x0 = p.x + 0.09, z0 = p.z + 0.09, x1 = p.x + p.w - 0.09, z1 = p.z + p.h - 0.09;
  dashed(g, x0, z0, y, x1, z0, y, 0.075); dashed(g, x1, z0, y, x1, z1, y, 0.075);
  dashed(g, x1, z1, y, x0, z1, y, 0.075); dashed(g, x0, z1, y, x0, z0, y, 0.075);
}

export class TransitArt {
  readonly group = new THREE.Group();
  private meshes: THREE.Mesh[] = [];
  private city: City | null = null;
  private net: TransitNetwork | undefined;
  private revision = -1;
  private variant: TransitArtVariant = 'b';
  private showMetro = false;

  constructor() { this.group.name = 'd101-transit'; }

  sync(city: City | null, variant: TransitArtVariant = 'b', showMetro = false): void {
    const net = city?.transit, revision = net?.revision ?? -1;
    if (this.city === city && this.net === net && this.revision === revision && this.variant === variant && this.showMetro === showMetro) return;
    this.clear();
    this.city = city; this.net = net; this.revision = revision; this.variant = variant; this.showMetro = showMetro;
    if (!city || !net || !(net.edges.length + net.stations.length + net.depots.length)) return;
    const surface = new Geo(), metro = new Geo();
    for (const edge of net.edges) {
      if (edge.mode !== 'metro') track(surface, city, edge, variant);
      else if (showMetro) dashed(metro, edge.a.x + 0.5, edge.a.z + 0.5, Math.max(0, tileY(city, edge.a.x, edge.a.z)) + 0.065,
        edge.b.x + 0.5, edge.b.z + 0.5, Math.max(0, tileY(city, edge.b.x, edge.b.z)) + 0.065, 0.09);
    }
    for (const station of net.stations) {
      if (station.mode !== 'metro') platform(surface, city, station, variant);
      else if (showMetro) metroPad(metro, city, station);
    }
    for (const item of net.depots) {
      if (item.mode !== 'metro') depot(surface, city, item, variant);
      else if (showMetro) metroPad(metro, city, item);
    }
    this.add(surface, false); this.add(metro, true);
  }

  private add(g: Geo, underground: boolean): void {
    if (!g.pos.length) return;
    const material = underground
      ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.82, depthTest: false, depthWrite: false })
      : new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(g.geometry(), material);
    mesh.name = underground ? 'd101-transit-metro' : 'd101-transit-surface';
    mesh.receiveShadow = !underground;
    if (underground) mesh.renderOrder = 8;   // 地下是地表示意，仍在資源圖（9）與施工預覽（10）之下。
    this.meshes.push(mesh); this.group.add(mesh);
  }

  get shown(): boolean { return this.meshes.length > 0; }

  private clear(): void {
    for (const mesh of this.meshes) {
      mesh.removeFromParent(); mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) material.dispose();
    }
    this.meshes = [];
  }

  dispose(): void {
    this.clear(); this.group.removeFromParent();
    this.city = null; this.net = undefined; this.revision = -1;
  }
}

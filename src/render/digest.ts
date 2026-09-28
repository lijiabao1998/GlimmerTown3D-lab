// D015 守衛：場景摘要。只讀，不改場景。
// ordered＝照畫的順序逐位元組雜湊（首次建要跟 D015 之前的黃金樣本逐位元組相同）；
// byOwner＝不分三角形順序、照主人分組（增量建跟整張重建比：件的排列、空洞不同，內容要一樣）；退化三角形（空洞）另外數。
import * as THREE from 'three';
import type { BuiltCity } from './cityScene.ts';

export const DIGEST_ATTRS = ['position', 'normal', 'uv', 'color', 'wStyle', 'wGlass', 'wBand', 'aCon'] as const;

// 32 位元字組逐一混進去（FNV-1a 的乘數）；長度也混進去，免得尾端補零撞在一起
function words(a: ArrayBufferView, h = 0x811c9dc5): number {
  const u = new Uint32Array(a.buffer, a.byteOffset, a.byteLength >> 2);
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 0x01000193) >>> 0;
  return Math.imul(h ^ u.length, 0x01000193) >>> 0;
}
const hex = (h: number) => (h >>> 0).toString(16).padStart(8, '0');
export const hashOf = (a: ArrayBufferView) => hex(words(a));
const hashJson = (o: unknown) => { const e = new TextEncoder().encode(JSON.stringify(o)), p = new Uint8Array(Math.ceil(e.length / 4) * 4); p.set(e); return hex(words(p, e.length)); };

// 網格要畫的頂點範圍（非索引幾何）
function vrange(g: THREE.BufferGeometry): [number, number] {
  const n = g.attributes.position.count, s = g.drawRange.start, c = Number.isFinite(g.drawRange.count) ? g.drawRange.count : n - s;
  return [s, Math.min(n, s + c)];
}

export interface MeshDigest { tris: number; attrs: Record<string, string>; owners: string; holes: number; byOwner: string; ownerTris: Record<number, number> }

export function meshDigest(m: THREE.Mesh, owners: Int32Array): MeshDigest {
  const g = m.geometry, [v0, v1] = vrange(g), t0 = v0 / 3, t1 = v1 / 3;
  const attrs: Record<string, string> = {};
  const present = DIGEST_ATTRS.filter(k => g.attributes[k]).map(k => g.attributes[k] as THREE.BufferAttribute);
  DIGEST_ATTRS.forEach(k => { const a = g.attributes[k] as THREE.BufferAttribute | undefined; if (a) attrs[k] = hashOf((a.array as Float32Array).subarray(v0 * a.itemSize, v1 * a.itemSize)); });
  const pos = g.attributes.position.array as Float32Array;
  // 不分順序：每個三角形把三個頂點的全部屬性混成一個雜湊，照主人累加（和、互斥或、個數）
  const acc = new Map<number, [number, number, number]>(), ownerTris: Record<number, number> = {};
  let holes = 0;
  for (let t = t0; t < t1; t++) {
    const p = t * 9;
    const ax = pos[p + 3] - pos[p], ay = pos[p + 4] - pos[p + 1], az = pos[p + 5] - pos[p + 2], bx = pos[p + 6] - pos[p], by = pos[p + 7] - pos[p + 1], bz = pos[p + 8] - pos[p + 2];
    if (ay * bz - az * by === 0 && az * bx - ax * bz === 0 && ax * by - ay * bx === 0) { holes++; continue; }
    let h = 0x811c9dc5;
    for (const a of present) { const s = a.itemSize, arr = a.array as Float32Array; h = words(arr.subarray(t * 3 * s, (t + 1) * 3 * s), h); }
    const o = owners[t] ?? 0, e = acc.get(o) ?? [0, 0, 0];
    e[0] = (e[0] + h) >>> 0; e[1] = (e[1] ^ h) >>> 0; e[2]++;
    acc.set(o, e);
  }
  const rows = [...acc.entries()].sort((a, b) => a[0] - b[0]);
  for (const [o, e] of rows) ownerTris[o] = e[2];
  return { tris: t1 - t0, attrs, owners: hashOf(owners.subarray(t0, t1)), holes, byOwner: hashJson(rows), ownerTris };
}

// 實例網格（野樹、前庭樹）：矩陣、顏色、屋齡（前庭樹）
function instDigest(scene: THREE.Scene): string[] {
  const out: string[] = [];
  scene.traverse(o => {
    const m = o as THREE.InstancedMesh;
    if (!m.isInstancedMesh) return;
    const t = m.geometry.attributes.aTreeT as THREE.InstancedBufferAttribute | undefined;
    out.push([m.count, hashOf((m.instanceMatrix.array as Float32Array).subarray(0, m.count * 16)), m.instanceColor ? hashOf((m.instanceColor.array as Float32Array).subarray(0, m.count * 3)) : '-', t ? hashOf((t.array as Float32Array).subarray(0, m.count)) : '-'].join(':'));
  });
  return out;
}

export interface SceneDigest {
  meshes: Record<string, MeshDigest>;
  ground: string; inst: string[];
  queries: Record<string, string>;
  counts: { owners: number; blocks: number };
}

export function sceneDigest(b: BuiltCity): SceneDigest {
  const names = ['walls', 'other', 'dress'], ms = b.buildingMeshes(), ow = b.pickOwners(), meshes: Record<string, MeshDigest> = {};
  ms.forEach((m, i) => { meshes[names[i]] = meshDigest(m, ow[i]); });
  const con = b.con;
  const queries: Record<string, string> = {
    ownerBoxes: hashJson(Object.entries(b.ownerBoxes()).sort((x, y) => +x[0] - +y[0])),
    artCounts: hashJson(b.artCounts()), nearCounts: hashJson(b.nearCounts()), wallStyles: hashJson(b.wallStyles()),
    blocksDrawn: hashJson(b.blocksDrawn()), kindColors: hashJson(Object.entries(b.kindColorsUsed()).sort((x, y) => +x[0] - +y[0])),
    weather: hashJson(b.weatherInfo()),
    conTop: con ? hashOf(con.top) : '-', conBase: con ? hashOf(con.base) : '-', conWallTop: con ? hashOf(con.wallTop) : '-', conBlockOf: con ? hashOf(con.blockOf) : '-',
  };
  return { meshes, ground: hashOf(b.groundData().rgba), inst: instDigest(b.scene), queries, counts: { owners: b.owners(), blocks: b.blocksDrawn().length } };
}

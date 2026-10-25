// D084 opt-in, presentation only. A shared road edge is not a model entrance
// or a simulation connectivity claim. No world writes, cached state or RNG.
import * as THREE from 'three';
export interface FrontageCell { x: number; z: number; y: number; ok: boolean }
export interface FrontageEdge { x: number; z: number; y: number; axis: 'x' | 'z' }
export function frontageEdges(n: number, road: ArrayLike<number>, cells: readonly FrontageCell[]): FrontageEdge[] {
  if (!Number.isInteger(n) || n < 1 || road.length !== n * n || !cells.length || cells.length > 16 || cells.some(c => !c.ok || !Number.isInteger(c.x) || !Number.isInteger(c.z) || c.x < 0 || c.z < 0 || c.x >= n || c.z >= n || !Number.isFinite(c.y))) return [];
  const occupied = new Set(cells.map(c => c.z * n + c.x));
  if (occupied.size !== cells.length) return [];
  const edges: FrontageEdge[] = [];
  for (const c of cells) for (const [dx, dz] of [[0,-1],[1,0],[0,1],[-1,0]]) {
    const x = c.x + dx, z = c.z + dz, i = z * n + x;
    if (x < 0 || z < 0 || x >= n || z >= n || occupied.has(i) || ![1,2,3,4].includes(road[i])) continue;
    edges.push({ x: c.x + .5 + dx * .46, z: c.z + .5 + dz * .46, y: c.y + .055, axis: dx ? 'z' : 'x' });
  }
  // Never silently truncate an invalid oversize footprint into a plausible guide.
  return edges.length <= 16 ? edges : [];
}
export class StreetFrontage {
  readonly geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  readonly material = new THREE.MeshBasicMaterial({ color: 0xffe3a1, depthWrite: false });
  readonly mesh = new THREE.InstancedMesh(this.geometry, this.material, 16);
  private readonly matrix = new THREE.Matrix4();
  constructor() { this.mesh.name = 'd084-street-frontage'; this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 11; }
  set(edges: readonly FrontageEdge[]) {
    this.mesh.count = Math.min(edges.length, 16);
    for (let i = 0; i < this.mesh.count; i++) {
      const e = edges[i];
      this.matrix.makeScale(e.axis === 'x' ? .84 : .075, 1, e.axis === 'z' ? .84 : .075).setPosition(e.x, e.y, e.z);
      this.mesh.setMatrixAt(i, this.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.mesh.count = 0; }
  dispose() { this.mesh.dispose(); this.geometry.dispose(); this.material.dispose(); }
}

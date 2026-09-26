// 施工預覽（D011）：拖曳時每一格一片半透明方塊（能蓋＝工具色、不能蓋＝紅），貼在格頂上；只畫、不碰模擬（規則 2）。
// 一個 InstancedMesh（一次 draw call）；場景重建後要重新加回去（同建築卡的框）。
import * as THREE from 'three';

export interface PreviewCell { x: number; z: number; y: number; ok: boolean }

export class Preview {
  mesh: THREE.InstancedMesh;
  private readonly geo = new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
  private readonly mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
  private readonly okColor = new THREE.Color();
  private readonly badColor = new THREE.Color(0xff5a4a);
  private readonly m = new THREE.Matrix4();
  constructor(capacity = 4096) { this.mesh = this.make(capacity); }
  private make(capacity: number) {
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 10;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    return mesh;
  }
  // 格子比容量多（大地圖上框很大一塊）：換一個兩倍大的網格，接回原本的場景
  private grow(need: number) {
    let cap = this.mesh.instanceMatrix.count;
    while (cap < need) cap *= 2;
    const old = this.mesh, parent = old.parent;
    this.mesh = this.make(cap);
    parent?.remove(old); parent?.add(this.mesh);
    old.dispose();
  }
  set(cells: readonly PreviewCell[], color: string) {
    if (cells.length > this.mesh.instanceMatrix.count) this.grow(cells.length);
    this.okColor.set(color);
    const n = cells.length;
    for (let k = 0; k < n; k++) {
      const c = cells[k];
      this.m.makeTranslation(c.x + 0.5, c.y + 0.03, c.z + 0.5);
      this.mesh.setMatrixAt(k, this.m);
      this.mesh.setColorAt(k, c.ok ? this.okColor : this.badColor);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.mesh.count = 0; }
  dispose() { this.mesh.dispose(); this.geo.dispose(); this.mat.dispose(); }
}

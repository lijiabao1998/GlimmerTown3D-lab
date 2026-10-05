// 資源圖（D040）：油田（黃）與礦藏（藍）貼在格頂上的半透明方塊，選了油井、礦場工具或打開 ☰「顯示資源圖」時才畫；只畫、不碰模擬（規則 2）。
// 實驗線在游標周圍半徑 10 格畫黃／藍的格子外框（drawResourceHints459，62594：油井與天然氣井找油田、礦場找礦藏）；3D 的鏡頭看得到整張圖，所以整張畫（最多幾百格）。
// 一個 InstancedMesh（一次 draw call）；場景重建後要重新加回去（同施工預覽、災禍標記）。
import * as THREE from 'three';

export interface ResCell { x: number; z: number; y: number; kind: number }   // kind：1 油田、2 礦藏（實驗線 RESOURCE 的值）
export const RES_COLORS: Record<number, string> = { 1: '#ffd36d', 2: '#9bd8ff' };   // 實驗線 62594 的顏色

export class ResourceHints {
  mesh: THREE.InstancedMesh;
  private readonly geo = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
  private readonly mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false });
  private readonly c = new THREE.Color();
  private readonly m = new THREE.Matrix4();
  constructor(capacity = 1024) { this.mesh = this.make(capacity); }
  private make(capacity: number) {
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity);
    mesh.count = 0; mesh.frustumCulled = false; mesh.renderOrder = 9;   // 在施工預覽（10）下面：預覽蓋在資源圖上
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    return mesh;
  }
  private grow(need: number) {
    let cap = this.mesh.instanceMatrix.count;
    while (cap < need) cap *= 2;
    const old = this.mesh, parent = old.parent;
    this.mesh = this.make(cap);
    parent?.remove(old); parent?.add(this.mesh);
    old.dispose();
  }
  set(cells: readonly ResCell[]) {
    if (cells.length > this.mesh.instanceMatrix.count) this.grow(cells.length);
    for (let k = 0; k < cells.length; k++) {
      const q = cells[k];
      this.m.makeTranslation(q.x + 0.5, q.y + 0.02, q.z + 0.5);
      this.mesh.setMatrixAt(k, this.m); this.mesh.setColorAt(k, this.c.set(RES_COLORS[q.kind] ?? '#ffffff'));
    }
    this.mesh.count = cells.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.mesh.count = 0; }
  get shown() { return this.mesh.count; }
  dispose() { this.mesh.dispose(); this.geo.dispose(); this.mat.dispose(); }
}

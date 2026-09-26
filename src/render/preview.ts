// 施工預覽（D011）：拖曳時每一格一片半透明方塊（能蓋＝工具色、不能蓋＝紅），貼在格頂上；只畫、不碰模擬（規則 2）。
// 一個 InstancedMesh（一次 draw call）；場景重建後要重新加回去（同建築卡的框）。
import * as THREE from 'three';

export interface PreviewCell { x: number; z: number; y: number; ok: boolean }

export class Preview {
  readonly mesh: THREE.InstancedMesh;
  private readonly okColor = new THREE.Color();
  private readonly badColor = new THREE.Color(0xff5a4a);
  private readonly m = new THREE.Matrix4();
  constructor(capacity = 4096) {
    const geo = new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  }
  set(cells: readonly PreviewCell[], color: string) {
    this.okColor.set(color);
    const n = Math.min(cells.length, this.mesh.instanceMatrix.count);
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
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

// 災禍標記（D026）：燃燒、犯罪、生病、死亡、廢棄的建築頭上一顆小寶石（八面體）。
// 一個 InstancedMesh（一次 draw call，沒有標記時不畫＝不佔預算；D015 的手機預算 ≤ 18，tools/smoke-d026.mjs 量），全部程式生成、沒有外部素材（規則 7），只畫、不碰模擬（規則 2）。
// 焦土不在這裡：畫在地面貼圖上（src/render/ground.ts，同 D019 的配水管，零 draw call）。場景重建後要重新加回去（同 Preview、建築卡的框）。
// 寶石的顏色取實驗線建築卡上那幾行字的顏色（燃燒 #ff8a5f、犯罪 #ffd45f、生病 #e05252、死亡 #5a5a5a——太暗，放亮一點）。
import * as THREE from 'three';

export type MarkKind = 'fire' | 'crime' | 'sick' | 'death' | 'abandon';
export interface Mark { x: number; y: number; z: number; kind: MarkKind }
export const MARK_COLOR: Record<MarkKind, number> = { fire: 0xff6a2a, crime: 0xffd45f, sick: 0xe05252, death: 0x9a9a9a, abandon: 0x8a6d4d };
export const MARK_SIZE: Record<MarkKind, number> = { fire: .46, crime: .34, sick: .34, death: .38, abandon: .3 };

export class HazardMarks {
  mesh: THREE.InstancedMesh;
  private readonly geo = new THREE.OctahedronGeometry(1, 0);
  private readonly mat = new THREE.MeshBasicMaterial();
  private readonly m = new THREE.Matrix4();
  private readonly col = new THREE.Color();
  constructor(capacity = 1024) { this.mesh = this.make(capacity); }
  private make(capacity: number) {
    const mesh = new THREE.InstancedMesh(this.geo, this.mat, capacity);
    mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 9; mesh.name = 'hazardMarks';
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    return mesh;
  }
  private cap = 0;
  everShown = false;                                                                            // 畫過（有標記過）：寶石的幾何與著色器程式第一次畫才上傳，算 GPU 資源時要扣掉這一份（tools/smoke-d015.mjs）
  set(marks: readonly Mark[]) {
    const need = marks.length;
    if (!this.cap) this.cap = this.mesh.instanceMatrix.count;
    if (need > this.cap) return this.regrow(marks);
    const p = this.mesh;
    for (let k = 0; k < need; k++) {
      const q = marks[k], s = MARK_SIZE[q.kind];
      this.m.makeScale(s * .7, s, s * .7).setPosition(q.x, q.y, q.z);                           // 瘦長一點的八面體：遠看像一顆寶石
      p.setMatrixAt(k, this.m); p.setColorAt(k, this.col.setHex(MARK_COLOR[q.kind]));
    }
    p.count = need; p.visible = need > 0; if (need > 0) this.everShown = true;                  // 空的就不畫（不佔 draw call）
    p.instanceMatrix.needsUpdate = true; if (p.instanceColor) p.instanceColor.needsUpdate = true;
  }
  // 容量不夠：換一個兩倍大的網格，接回原本的場景（同 Preview.grow）
  private regrow(marks: readonly Mark[]) {
    let cap = this.cap; while (cap < marks.length) cap *= 2;
    const old = this.mesh, parent = old.parent, next = this.make(cap);
    this.mesh = next; this.cap = cap;
    parent?.remove(old); parent?.add(next); old.dispose();
    this.set(marks);
  }
  get count() { return this.mesh.count; }
  dispose() { this.mesh.dispose(); this.geo.dispose(); this.mat.dispose(); }
}

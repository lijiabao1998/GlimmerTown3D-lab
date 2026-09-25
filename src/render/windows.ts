// 窗磚圖集（D005）：一張 16×16 一格的橫條圖，每格一種窗型；牆面頂點帶 wStyle（第幾格）與 wGlass（玻璃色）。
// 第 0 格＝D003 的窗磚（textures.ts windowTexture），逐像素相同：沒帶樣式的面（屋頂、煙囪、非住商工）畫面不變。
// 其餘各格照實驗線 winShape570（70724）的窗型：arch 拱窗、punch 厚框、grid 小方窗、ribbon 帶狀玻璃、shop 店面。
// 每個像素的 alpha 是「類別」，不是透明度：
//   255＝牆（乘牆色）、170＝飾條（牆色往白拉 45%）、85＝玻璃反光（玻璃色往白拉 45%）、0＝玻璃（乘玻璃色）。
// 所以玻璃不再被牆色染色；飾條可以比牆亮（實驗線的窗楣、窗台是 shade(cL,+24)）。圖是 DataTexture，alpha 0 的像素 RGB 才不會被瀏覽器預乘吃掉。
import * as THREE from 'three';

export const WIN_STYLE: Record<string, number> = { d003: 0, arch: 1, punch: 2, grid: 3, ribbon: 4, shop: 5 };
const N = 6, T = 16;
const WALL = 255, TRIM = 170, HI = 85, GLASS = 0;

// 畫布座標（y 往下）寫進 DataTexture（第 0 列在下）
function atlasData(): Uint8Array {
  const d = new Uint8Array(N * T * T * 4);
  const px = (cell: number, x: number, y: number, rgb: number, a: number) => {
    const i = ((T - 1 - y) * N * T + cell * T + x) * 4;
    d[i] = (rgb >> 16) & 255; d[i + 1] = (rgb >> 8) & 255; d[i + 2] = rgb & 255; d[i + 3] = a;
  };
  const rect = (cell: number, x: number, y: number, w: number, h: number, rgb: number, a: number) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) px(cell, xx, yy, rgb, a);
  };
  for (let c = 0; c < N; c++) rect(c, 0, 0, T, T, 0xffffff, WALL);
  // 0：D003 窗磚（同 windowTexture 的四個 fillRect）
  rect(0, 4, 4, 8, 8, 0x2c3a4c, WALL); rect(0, 5, 5, 3, 2, 0x5d7590, WALL); rect(0, 3, 12, 10, 1, 0xf2eee4, WALL);
  // 1：arch 拱窗——窗楣、拱頂少兩格、玻璃、窗台
  rect(1, 4, 3, 8, 1, 0xffffff, TRIM); rect(1, 6, 4, 4, 1, 0xffffff, GLASS); rect(1, 5, 5, 6, 7, 0xffffff, GLASS);
  rect(1, 6, 5, 2, 2, 0xffffff, HI); rect(1, 4, 12, 8, 1, 0xffffff, TRIM);
  // 2：punch 厚框——一圈飾條包住玻璃
  rect(2, 4, 4, 8, 9, 0xffffff, TRIM); rect(2, 5, 5, 6, 7, 0xffffff, GLASS); rect(2, 5, 5, 2, 1, 0xffffff, HI);
  // 3：grid 小方窗——上緣一條飾條
  rect(3, 5, 5, 6, 1, 0xffffff, TRIM); rect(3, 5, 6, 6, 5, 0xffffff, GLASS); rect(3, 6, 7, 2, 1, 0xffffff, HI);
  // 4：ribbon 帶狀玻璃——整條玻璃帶＋下緣陰影線（牆色壓暗）
  rect(4, 0, 5, T, 4, 0xffffff, GLASS); for (let x = 1; x < T; x += 4) px(4, x, 5, 0xffffff, HI);
  rect(4, 0, 9, T, 1, 0x8a8a8a, WALL);
  // 5：shop 店面——大片亮玻璃、中挺、上框、踢腳板（第 0 欄與最下一列留白：PLAIN_UV 取樣點要是純牆色）
  rect(5, 1, 2, 14, 1, 0xffffff, TRIM); rect(5, 1, 3, 14, 11, 0xffffff, GLASS); rect(5, 2, 4, 3, 2, 0xffffff, HI);
  rect(5, 7, 3, 2, 11, 0xffffff, TRIM); rect(5, 1, 14, 14, 1, 0xb4b4b4, WALL);
  return d;
}

export function windowAtlas(): THREE.DataTexture {
  const t = new THREE.DataTexture(atlasData(), N * T, T, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// 讓城市場景的牆材質讀圖集：UV 的小數部分落在第 wStyle 格；再依 alpha 類別決定這個像素是牆、飾條、反光還是玻璃。
// 牆腳色帶（wBand，以窗磚的 V 計）：>0 店面帶——用 shop 格、每格一扇、一格高就是整條帶，牆色壓暗（實驗線 edgeWall shade(cL,−22)），
// 玻璃固定 #8ec4e0（71409）；<0 不開窗（工業牆下 45%，71396）——取純牆色。色帶畫在同一個牆盒裡，不另外多一圈牆
// （D005 手機預算：每條省 8 個三角形，影子那趟再省 8 個）。
export function patchWindowMaterial(m: THREE.Material) {
  m.onBeforeCompile = sh => {
    sh.uniforms.shopGlass = { value: new THREE.Color('#8ec4e0') };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float wStyle;\nattribute vec3 wGlass;\nattribute float wBand;\nvarying float vWStyle;\nvarying vec3 vWGlass;\nvarying float vWBand;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWStyle = wStyle;\nvWGlass = wGlass;\nvWBand = wBand;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 shopGlass;\nvarying float vWStyle;\nvarying vec3 vWGlass;\nvarying float vWBand;')
      .replace('#include <map_fragment>', `
        float wSt = floor(vWStyle + 0.5); vec2 wUv = vMapUv; vec3 wGl = vWGlass; float wDark = 1.0;
        if (vWBand > 0.0 && wUv.y < vWBand) { wSt = ${WIN_STYLE.shop.toFixed(1)}; wUv = vec2(wUv.x * 0.5, wUv.y / vWBand); wGl = shopGlass; wDark = 0.8; }
        else if (vWBand < 0.0 && wUv.y < -vWBand) { wSt = 0.0; wUv = vec2(0.03, 0.03); }
        vec4 wTex = texture2D(map, vec2((wSt + fract(wUv.x)) / ${N.toFixed(1)}, fract(wUv.y)));`)
      .replace('#include <color_fragment>', `
        vec3 wWall = vColor.rgb * wDark;
        vec3 wCol = wTex.a > 0.83 ? wWall : wTex.a > 0.5 ? mix(wWall, vec3(1.0), 0.45) : wTex.a > 0.17 ? mix(wGl, vec3(1.0), 0.45) : wGl;
        diffuseColor.rgb *= wCol * wTex.rgb;`);
  };
  m.customProgramCacheKey = () => 'gt3d-window-atlas-v2';
}

// 守衛：圖集第 0 格跟 D003 的窗磚逐像素相同（瀏覽器裡跑；canvas 的像素全不透明，讀回來是精確值）
export function atlasCell0MatchesD003(win: THREE.Texture, atlas: THREE.DataTexture): { same: boolean; diff: number } {
  const c = win.image as HTMLCanvasElement, g = c.getContext('2d')!, a = g.getImageData(0, 0, T, T).data, d = atlas.image.data as Uint8Array;
  let diff = 0;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = (y * T + x) * 4, j = ((T - 1 - y) * N * T + x) * 4;
    for (let k = 0; k < 4; k++) if (a[i + k] !== d[j + k]) { diff++; break; }
  }
  return { same: diff === 0, diff };
}

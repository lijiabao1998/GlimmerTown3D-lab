// 全種類樣張城（D007）：住商工（k1–3）以外的每一種各擺一棟（lv1、v0），擺在一片草地上，照分類排成一列一列，棟與棟之間空一格。
// 純函式：不 import three、不碰 DOM。tools/lab-extract.mjs --part=d007 用它編成實驗線的分享碼，讓實驗線自己匯入讀回。
export interface GalleryKind { k: number; size: number; cat: string }
export interface GalleryPlace { k: number; x: number; z: number; size: number; cat: string }

export const GALLERY_N = 72;
// 分類順序：住宅、商業、工業、市政治安、教育、醫療、能源、環衛、交通、文化觀光、綠地、農業
export const GALLERY_CATS = ['R', 'C', 'I', 'S', 'D', 'H', 'E', 'W', 'T', 'A', 'G', 'F'];

export function galleryLayout(kinds: GalleryKind[], n = GALLERY_N): GalleryPlace[] {
  const list = kinds.filter(q => q.k > 3).sort((a, b) => GALLERY_CATS.indexOf(a.cat) - GALLERY_CATS.indexOf(b.cat) || a.k - b.k);
  const out: GalleryPlace[] = [];
  let x = 1, z = 1, rowH = 0;
  for (const q of list) {
    const s = q.k === 9 ? 2 : q.size;
    if (x + s > n - 1) { z += rowH + 1; x = 1; rowH = 0; }
    if (z + s > n - 1) throw new Error(`樣張城放不下：k${q.k}`);
    out.push({ k: q.k, x, z, size: s, cat: q.cat });
    x += s + 1; rowH = Math.max(rowH, s);
  }
  return out;
}

// 逐種對照小圖的縮放（實驗線的 z；3D 用 3.42×z）：佔地越大、越高就拉越遠，讓整棟落在 300×300 裡
export function galleryZoom(size: number, h: number): number {
  const px = Math.max(64 * size, 32 * size + 39.2 * h + 24);
  return Math.max(0.5, Math.min(1.5, Math.round((260 / px) * 20) / 20));
}

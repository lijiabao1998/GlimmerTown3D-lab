// 最小 PNG 解碼器：8 位元、RGB／RGBA、非交錯（Chrome 的 Page.captureScreenshot 就是這種）。只讀；不是通用解碼器，遇到別的格式直接丟錯。
// 用途：把實拍的 PNG 讀回像素，量「整張圖有多少種輸出色」之類的事（tools/d061-capture.mjs）。
import zlib from 'node:zlib';

export function decodePng(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, ct = 0, bd = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12]) throw new Error('interlaced PNG is not supported'); }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error(`unsupported PNG (bit depth ${bd}, colour type ${ct})`);
  const bpp = ct === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(w * h * bpp);
  if (raw.length !== h * (stride + 1)) throw new Error('PNG data length does not match its header');
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[dst + x - bpp] : 0, up = y ? out[dst - stride + x] : 0, c = x >= bpp && y ? out[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      else if (f !== 0) throw new Error('bad PNG filter ' + f);
      out[dst + x] = v & 255;
    }
  }
  return { w, h, bpp, data: out };
}
// 每種顏色（0xRRGGBB）出現幾次
export function colourCounts(img) {
  const counts = new Map();
  for (let i = 0; i < img.w * img.h; i++) {
    const o = i * img.bpp, key = (img.data[o] << 16) | (img.data[o + 1] << 8) | img.data[o + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

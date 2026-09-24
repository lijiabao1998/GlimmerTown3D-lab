import * as THREE from 'three';
import type { CityState } from '../sim/history.ts';
import { hash2 } from '../sim/rng.ts';

// 窗戶磚：一格寬＝兩塊、一層樓＝一塊；白底讓頂點色染牆色，窗格暗色（相乘後仍帶牆色調）
export function windowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#2c3a4c'; g.fillRect(4, 4, 8, 8);          // 窗
  g.fillStyle = '#5d7590'; g.fillRect(5, 5, 3, 2);          // 窗上反光
  g.fillStyle = '#f2eee4'; g.fillRect(3, 12, 10, 1);        // 窗台
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 貼圖上一定是純白的點：不要窗戶的面（煙囪、塔、屋頂）把 UV 指到這裡
export const PLAIN_UV: [number, number] = [0.03, 0.03];

// 地面：每格 S×S 像素；草、水、路、橋、長草的路、公園、建築用地
export function groundTexture(s: CityState, S = 4): THREE.DataTexture {
  const N = s.size, W = N * S, data = new Uint8Array(W * W * 4);
  const lot = new Uint8Array(N * N);
  for (const b of s.blds) for (let a = 0; a < b.w; a++) for (let c = 0; c < b.d; c++) lot[(b.z + c) * N + b.x + a] = 1;
  const put = (px: number, py: number, hex: number) => {
    const i = (py * W + px) * 4;
    data[i] = (hex >> 16) & 255; data[i + 1] = (hex >> 8) & 255; data[i + 2] = hex & 255; data[i + 3] = 255;
  };
  const mix = (a: number, b: number, t: number) => {
    const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const i = z * N + x, r = s.road[i];
    for (let v = 0; v < S; v++) for (let u = 0; u < S; u++) {
      const h = hash2(x * S + u, z * S + v, 7);
      let col: number;
      if (r === 1 || r === 2) {
        const edge = u === 0 || v === 0 || u === S - 1 || v === S - 1;
        col = r === 2 ? (edge ? 0x6f5f4c : 0x8c7a62) : (edge ? 0x8a8780 : 0x6b6a66);
        if (h < 0.08) col = mix(col, 0x000000, 0.12);
      } else if (r === 3) {
        col = h < 0.55 ? mix(0x6b6a66, 0x6f8f4a, 0.5 + h * 0.5) : 0x5f8a3e;
      } else if (s.water[i]) {
        col = h < 0.07 ? 0x7fb4d8 : mix(0x3f78a8, 0x356a98, h);
      } else if (s.park[i]) {
        col = mix(0x86bd5c, 0x9bcc6a, h);
      } else if (lot[i]) {
        col = mix(0xc9c3b5, 0xb8b1a2, h);
      } else {
        col = mix(0x78a452, 0x6c9749, h);
        if (h > 0.93) col = 0x8fb862;
      }
      // DataTexture 第 0 列在畫面上是 v=0，平面轉平後 v=0 對到世界 z=N，所以列序反過來
      put(x * S + u, (N - 1 - z) * S + (S - 1 - v), col);
    }
  }
  const t = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

// 三階色塊受光用的漸層貼圖
export function toonRamp(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

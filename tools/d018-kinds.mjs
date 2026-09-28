// D018：全部非住商工種類的幾何雜湊表（照造型表畫、在原點、地基高 0）。每一種取樣張城裡的大小，變體 0–8 各畫一次，
// 幾何（三個累積器的頂點、法線、UV、顏色、窗與風化屬性、主人）＋前庭樹＋用到的色＋高度壓成一個雜湊。
// 用途：D018 改公園之前先錄一份（src/content/samples/d018-kinds-before.json），改完之後公園以外每一種、每一個變體都要逐位相同（tools/unit-d018.mjs）。
// 用法：node tools/d018-kinds.mjs --write   （只在畫法沒改之前錄一次；平常守衛只呼叫 kindHashes()）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { cityFromLab } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { shapeOf, kindColors } from '../src/content/kindShapes.ts';
import { Geo } from '../src/render/scene.ts';
import { drawKind } from '../src/render/kindArt.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const VARIANTS = 9;

// 每個值先取到 1e-6 再雜湊：Node 22 與 24 的 Math.pow 最後一位不一樣（three 的 Color 轉線性色用它），逐位元雜湊在 CI（Node 24）上九成種類都對不上（D018 收尾那一輪的 CI 紅燈）
const Q = 1e6;
function geoHash(G, extra) {
  const h = crypto.createHash('sha1');
  for (const g of G) for (const a of [g.pos, g.nor, g.uv, g.col, g.wst, g.wgl, g.wbd, g.tags]) { h.update(Buffer.from(Float64Array.from(a, x => Math.round(x * Q)).buffer)); h.update('|'); }
  h.update(JSON.stringify(extra, (k, v) => typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * Q) : v));
  return h.digest('hex').slice(0, 16);
}
// 畫一棟（KindCtx 多給 v：D018 起公園照變體畫；其他種類不讀它）
export function drawOne(KT, LOOKS, k, lv, v, s) {
  const shape = shapeOf(k); if (!shape) return null;
  const G = [new Geo({ ext: true }), new Geo(), new Geo()], trees = [];
  for (const g of G) g.owner = 1;
  const H = Math.max(0.12, KT.height(k, lv, v));
  const used = [...drawKind({ W: G[0], O: G[1], D: G[2], trees, x0: 0, z0: 0, s, y0: 0, H, k, v, C: kindColors(LOOKS, k, lv, KT.catColor(KT.cat(k))) }, shape)];
  return { G, trees, used, H };
}
// { k: { s, lv, h: [v0…v8 的雜湊] } }，k 照樣張城裡出現的非住商工種類
export function kindHashes() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), LOOKS = JSON.parse(read('src/content/lab-looks.json')).looks;
  const code = read('src/content/samples/gallery.code.txt').trim(), c = cityFromLab(decodeLabCode(code).save, KT, code);
  const out = {};
  for (const b of c.buildings) {
    if (b.goneDay !== undefined || b.k <= 3 || out[b.k] || !shapeOf(b.k)) continue;
    const h = [];
    for (let v = 0; v < VARIANTS; v++) { const r = drawOne(KT, LOOKS, b.k, b.lv, v, b.size); h.push(geoHash(r.G, [r.trees, r.used, r.H])); }
    out[b.k] = { s: b.size, lv: b.lv, h };
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t = kindHashes(), file = path.join(ROOT, 'src/content/samples/d018-kinds-before.json');
  if (process.argv.includes('--write')) {
    fs.writeFileSync(file, JSON.stringify({ note: 'D018 改公園之前錄的全部非住商工種類幾何雜湊（tools/d018-kinds.mjs）', kinds: t }) + '\n');
    console.log(`寫出 ${path.relative(ROOT, file)}：${Object.keys(t).length} 種 × ${VARIANTS} 個變體`);
  } else console.log(`${Object.keys(t).length} 種（加 --write 才寫檔）`);
}

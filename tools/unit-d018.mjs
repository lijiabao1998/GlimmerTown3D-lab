// D018 Node 守衛：公園照實驗線九種設計（驗收 1、2、3 的一半）。由 tools/unit.mjs 呼叫。
//   1. 實驗線原文的出處：src/content/samples/d018-lab.json（tools/lab-parks.mjs 摘 SPR.park 九種的三段）逐段 sha256＝錨點記錄；
//   2. D018 歷史配方守衛（D047 的 k51 用保留原配方；現行 k51 由 D047 另驗）：全部非住商工種類（樣張城裡的 183 種 × 變體 0–8）的幾何雜湊，公園以外逐位＝D018 動手前錄的表（d018-kinds-before.json）；公園九個變體都變了、而且彼此不同；
//   3. 九種各有自己的設計：每一種用到的色碼都逐字出現在實驗線那一個變體的原文裡（不是憑印象）；每一種都畫到自己的招牌件（招牌色），沒畫到別種的招牌件；
//   4. 預算：一座公園（不含樹，樹另外用實例畫）≤ 200 個三角形。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './cdp.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { PARK } from '../src/render/kindArt.ts';
import { kindColors, PARK_GRASS } from '../src/content/kindShapes.ts';
import { kindHashes, drawOne, VARIANTS } from './d018-kinds.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
// 招牌色：每一種獨有的那一件（石徑 v1 沒有獨有的件：只有石徑與樹，驗「沒畫到別種的招牌件」）
const SIG = [PARK.flowers[1], null, PARK.pondIn, PARK.jet, PARK.roses[0], PARK.slideTop, PARK.gazeboRoof, PARK.court, PARK.seatWood];
const NAMES = ['石徑長椅花', '石徑', '池塘', '噴泉廣場', '玫瑰園', '遊樂場', '涼亭', '球場', '野餐區'];

export async function d018Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D018 守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

async function guards(log) {
  const gold = JSON.parse(read('src/content/samples/d018-lab.json')), t = gold.text ?? {};
  // ---- 1. 出處 ----
  {
    const bad = [], KEY = { '公園 v0–v2': 'v012', '公園 v3–v5': 'v345', '公園 v6–v8': 'v678' };
    if (gold.source?.commit !== PINNED) bad.push('commit');
    for (const p of gold.pieces ?? []) if (crypto.createHash('sha256').update(t[KEY[p.name]] ?? '').digest('hex') !== p.sha) bad.push(`${p.name} 原文雜湊`);
    if ((gold.pieces ?? []).map(p => p.line).join() !== '40602,44563,46122') bad.push(`行號 ${(gold.pieces ?? []).map(p => p.line)}`);
    log(!bad.length, 'D018 公園原文：實驗線 d23c18d SPR.park 九種的三段（40602 v0–v2、44563 v3–v5、46122 v6–v8），sha256 逐段＝錨點記錄', bad.join('；') || (gold.pieces ?? []).map(p => `${p.name} ${p.line}–${p.endLine}`).join('、'));
  }
  // ---- 2. 只動了公園 ----
  const before = JSON.parse(read('src/content/samples/d018-kinds-before.json')).kinds, now = kindHashes({ 51: { type: 'landmark', p: { which: 'rocket' } } }); // D047 explicitly changes k51; this historical D018 guard still verifies the preserved legacy recipe, and D047 guards the new art.
  {
    const bad = [], ks = Object.keys(before);
    if (ks.length !== Object.keys(now).length || ks.length < 180) bad.push(`種類數 動手前 ${ks.length}、現在 ${Object.keys(now).length}`);
    const other = ks.filter(k => k !== '4' && JSON.stringify(now[k]?.h) !== JSON.stringify(before[k].h));
    if (other.length) bad.push(`公園以外變了：k ${other.slice(0, 8).join('、')}`);
    const park = now[4]?.h ?? [], same = park.filter((h, v) => h === before[4].h[v]).length;
    if (same) bad.push(`公園有 ${same} 個變體跟動手前一樣`);
    if (new Set(park).size !== VARIANTS) bad.push(`公園九個變體只有 ${new Set(park).size} 種幾何`);
    if (new Set(before[4].h).size !== 1) bad.push('動手前的表裡公園九個變體就不一樣（表不是動手前錄的？）');
    log(!bad.length, `D018 歷史配方驗收：${ks.length} 種 × 變體 0–8（k51 使用保留舊配方，現行造型由 D047 另驗），公園以外逐位＝D018 動手前；公園九種彼此不同`,
      bad.join('；') || `${ks.length - 1} 種 × ${VARIANTS} 相同；公園 ${VARIANTS} 種`);
  }
  // ---- 3. 九種各有自己的設計、色碼出自實驗線原文 ----
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), LOOKS = JSON.parse(read('src/content/lab-looks.json')).looks;
  const runs = Array.from({ length: VARIANTS }, (_, v) => drawOne(KT, LOOKS, 4, 1, v, 1));
  {
    const bad = [], srcOf = v => (v < 3 ? t.v012 : v < 6 ? t.v345 : t.v678 ?? '').toLowerCase();
    // v3–v8 各自那一小段（從「公園 vN」的註解到下一個變體）；v0–v2 是同一個迴圈，用整段
    const sub = v => {
      if (v < 3) return srcOf(v);
      const s = srcOf(v), a = s.indexOf(`// 公園 v${v} `), b = v % 3 === 2 ? s.length : s.indexOf(`// 公園 v${v + 1} `);
      return a >= 0 && b > a ? s.slice(a, b) : '';
    };
    for (let v = 0; v < VARIANTS; v++) {
      const used = [...runs[v].used].map(c => c.toLowerCase()), s = sub(v);
      if (!s) { bad.push(`v${v} 找不到實驗線那一段`); continue; }
      const foreign = used.filter(c => !s.includes(`'${c}'`));
      if (foreign.length) bad.push(`v${v} ${NAMES[v]} 用了實驗線那一段沒有的色：${foreign.join('、')}`);
      if (SIG[v] && !used.includes(SIG[v].toLowerCase())) bad.push(`v${v} ${NAMES[v]} 沒畫到招牌件（${SIG[v]}）`);
      const others = SIG.filter((c, j) => c && j !== v && used.includes(c.toLowerCase()));
      if (others.length) bad.push(`v${v} ${NAMES[v]} 畫到了別種的招牌件：${others.join('、')}`);
      if (!used.length) bad.push(`v${v} 什麼都沒畫`);
    }
    log(!bad.length, 'D018 驗收 1：九種各有自己的設計——每一種用到的色碼都逐字出現在實驗線那一個變體的原文裡；石徑長椅花、池塘、噴泉廣場、玫瑰園、遊樂場、涼亭、球場、野餐區都畫到自己的招牌件，沒畫到別種的',
      bad.join('；') || runs.map((r, v) => `v${v} ${NAMES[v]} ${r.used.length} 色`).join('、'));
  }
  // ---- 3b. 地坪：公園的地坪＝實驗線公園精靈的草地底色（lab-looks.json 沒有公園，缺省原本是沙色）----
  {
    const pc = kindColors(LOOKS, 4, 1, KT.catColor(KT.cat(4))).plate.toLowerCase(), other = kindColors(LOOKS, 999, 1, '#000000').plate;
    const ok = pc === PARK_GRASS && (t.v012 ?? '').includes(`dia(g,32,ay-32,32,'${PARK_GRASS}')`) && !LOOKS['4_1'] && other === '#c9c3b5';
    log(ok, `D018：公園的地坪＝實驗線公園精靈的草地底色 ${PARK_GRASS}（原文 40610 dia(g,32,ay-32,32,'${PARK_GRASS}')；lab-looks.json 沒有公園，其他沒有抽到色的種類照舊沙色）`, `公園 ${pc}、其他缺省 ${other}`);
  }
  // ---- 4. 預算 ----
  {
    const tris = runs.map(r => r.G.reduce((n, g) => n + g.pos.length / 9, 0)), trees = runs.map(r => r.trees.length);
    log(tris.every(n => n > 0 && n <= 200), 'D018 驗收 3：一座公園（不含樹，樹另外用實例畫）≤ 200 個三角形', tris.map((n, v) => `v${v} ${n}（樹 ${trees[v]}）`).join('、'));
  }
}

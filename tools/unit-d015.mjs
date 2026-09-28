// D015 Node 守衛：件的鍵夠不夠（驗收 2「鍵少了一項要紅」在 Node 直接證，不靠播放時剛好碰到）。由 tools/unit.mjs 呼叫；不開瀏覽器。
// 快取的前提：鍵一樣＝幾何一樣。所以拿真的街區、非住商工建築，一次只改一個輸入重畫一次：幾何（頂點、前庭樹、點綴件數、近看小物底稿）變了，鍵就一定要跟著變。
//   1. 街區（種子城 C 檔的計畫）：位置 x、z，寬、高，種類、等級、變體，地基高；每一項至少要有改了幾何會變的例子（不然這一項沒驗到）。
//   2. 非住商工（全種類樣張，照造型表畫）：變體、位置、大小、地基高、種類（等級：造型表目前不看，改了不變，只記不判）。
//   3. 注入錯誤要紅：鍵少了地基高、少了等級、少了變體（街區），少了變體、少了大小（非住商工）。
// 播放、劇本、畫面那幾項在瀏覽器（tools/smoke-d015.mjs）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from './cdp.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { cityFromLab } from '../src/sim/city.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { gridOf, drawPlan } from '../src/content/blocks.ts';
import { recipe } from '../src/content/recipes.ts';
import { dressing } from '../src/content/dressing.ts';
import { facadePlan, trimPlan } from '../src/content/facades.ts';
import { shapeOf, kindColors } from '../src/content/kindShapes.ts';
import { Geo } from '../src/render/scene.ts';
import { drawBlock, emptyCounts } from '../src/render/blockArt.ts';
import { drawKind } from '../src/render/kindArt.ts';
import { blockKey, civicKey } from '../src/render/pieces.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

export async function d015Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D015 守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 一件畫出來的全部結果壓成一個雜湊（三個累積器的每一種頂點資料與主人、牆頂、前庭樹、點綴件數、近看小物底稿）
function geoHash(G, extra) {
  const h = crypto.createHash('sha1');
  for (const g of G) for (const a of [g.pos, g.nor, g.uv, g.col, g.wst, g.wgl, g.wbd, g.tags]) { h.update(Buffer.from(Float64Array.from(a).buffer)); h.update('|'); }
  h.update(JSON.stringify(extra));
  return h.digest('hex');
}

async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), ARCHE = JSON.parse(read('src/content/lab-arche.json')).arche, LOOKS = JSON.parse(read('src/content/lab-looks.json')).looks;
  const cityOf = id => { const code = read(`src/content/samples/${id}.code.txt`).trim(); return cityFromLab(decodeLabCode(code).save, KT, code); };

  // ---- 1. 街區 ----
  const plan = drawPlan(gridOf(cityOf('seed516')), ARCHE, 'c');
  const drawB = (bk, y0) => {
    let r; try { r = recipe(ARCHE, bk.k, bk.lv, bk.w, bk.h, bk.v); } catch { return null; }
    if (!r) return null;
    const G = [new Geo({ ext: true }), new Geo(), new Geo()], yard = [], n = emptyCounts(), nj = [];
    for (const g of G) g.owner = -1;
    const anchor = drawBlock(G[0], G[1], G[2], bk, r, dressing(r), y0, yard, n, facadePlan(r), trimPlan(r), nj);
    return geoHash(G, [yard, n, nj.map(j => [j.x0, j.z0, j.x1, j.z1, j.y0]), anchor.toArray()]);
  };
  const BF = {   // 一次改一項（改不出合法配方的就跳過）
    x: bk => ({ ...bk, x: bk.x + 1 }), z: bk => ({ ...bk, z: bk.z + 1 }),
    w: bk => ({ ...bk, w: bk.w + 1 }), h: bk => ({ ...bk, h: bk.h + 1 }),
    k: bk => ({ ...bk, k: bk.k % 3 + 1 }), lv: bk => ({ ...bk, lv: bk.lv > 1 ? bk.lv - 1 : bk.lv + 1 }), v: bk => ({ ...bk, v: bk.v > 0 ? bk.v - 1 : bk.v + 1 }),
    y0: bk => bk,
  };
  const sample = plan.filter((_, i) => i % 3 === 0);   // 種子城 C 檔三塊取一塊
  const blockRuns = keyFn => {
    const viol = [], changed = Object.fromEntries(Object.keys(BF).map(f => [f, 0]));
    for (const bk of sample) {
      const a = drawB(bk, 0);
      if (!a) continue;
      for (const [f, mut] of Object.entries(BF)) {
        const bk2 = mut(bk), y2 = f === 'y0' ? 0.4 : 0, b = drawB(bk2, y2);
        if (!b || a === b) continue;
        changed[f]++;
        if (keyFn(bk, 0) === keyFn(bk2, y2)) viol.push(`${f}@${bk.x},${bk.z}`);
      }
    }
    return { viol, changed };
  };
  const B0 = blockRuns(blockKey);
  const vacuous = Object.entries(B0.changed).filter(([, c]) => c === 0).map(([f]) => f);
  log(B0.viol.length === 0 && vacuous.length === 0, 'D015：街區的鍵夠——種子城 C 檔計畫三塊取一塊，一次改一個輸入（位置、寬高、種類、等級、變體、地基高）重畫：幾何、前庭樹、點綴件數、近看小物底稿變了，鍵一定跟著變；每一項都有改了會變的例子',
    B0.viol.length ? `鍵沒變：${B0.viol.slice(0, 5).join('、')}` : vacuous.length ? `這幾項改了幾何都沒變（沒驗到）：${vacuous.join('、')}` : `${sample.length} 塊；幾何變了的次數 ${Object.entries(B0.changed).map(([f, c]) => `${f} ${c}`).join('、')}`);

  // ---- 2. 非住商工（照造型表）----
  const gal = cityOf('gallery');
  const civics = gal.buildings.filter(b => b.goneDay === undefined && b.k > 3 && shapeOf(b.k) && b.x + b.size <= gal.n && b.z + b.size <= gal.n);
  const drawK = (b, s, y0) => {
    const shape = shapeOf(b.k); if (!shape) return null;
    const G = [new Geo({ ext: true }), new Geo(), new Geo()], trees = [];
    for (const g of G) g.owner = b.id;
    const H = Math.max(0.12, KT.height(b.k, b.lv, b.v)), used = [...drawKind({ W: G[0], O: G[1], D: G[2], trees, x0: b.x, z0: b.z, s, y0, H, k: b.k, v: b.v, C: kindColors(LOOKS, b.k, b.lv, KT.catColor(KT.cat(b.k))) }, shape)];
    return geoHash(G, [trees, used, H]);
  };
  const others = [...new Set(civics.map(b => b.k))];
  const KF = {
    lv: b => ({ ...b, lv: b.lv > 1 ? b.lv - 1 : b.lv + 1 }), v: b => ({ ...b, v: b.v > 0 ? b.v - 1 : b.v + 1 }),
    x: b => ({ ...b, x: b.x + 1 }), z: b => ({ ...b, z: b.z + 1 }), s: b => b, y0: b => b,
    k: b => ({ ...b, k: others[(others.indexOf(b.k) + 1) % others.length] }),
  };
  const civicRuns = keyFn => {
    const viol = [], changed = Object.fromEntries(Object.keys(KF).map(f => [f, 0]));
    for (const b of civics) {
      const a = drawK(b, b.size, 0);
      if (!a) continue;
      for (const [f, mut] of Object.entries(KF)) {
        const b2 = mut(b), s2 = f === 's' ? b.size + 1 : b.size, y2 = f === 'y0' ? 0.4 : 0, c = drawK(b2, s2, y2);
        if (!c || a === c) continue;
        changed[f]++;
        if (keyFn(b, b.size, 0) === keyFn(b2, s2, y2)) viol.push(`${f}@k${b.k}`);
      }
    }
    return { viol, changed };
  };
  const K0 = civicRuns(civicKey);
  // 等級：造型表畫的非住商工目前不看等級（高度、五色都只看種類與變體），改了幾何不會變；鍵照樣帶著（將來造型表看等級也不會錯），這一項只記不判
  const vacK = Object.entries(K0.changed).filter(([f, c]) => c === 0 && f !== 'lv').map(([f]) => f);
  log(K0.viol.length === 0 && vacK.length === 0, 'D015：非住商工的鍵夠——全種類樣張照造型表畫的每一棟，一次改一個輸入（等級、變體、位置、大小、地基高、種類）重畫：幾何、前庭樹、用色變了，鍵一定跟著變；每一項都有改了會變的例子',
    K0.viol.length ? `鍵沒變：${K0.viol.slice(0, 5).join('、')}` : vacK.length ? `這幾項改了幾何都沒變（沒驗到）：${vacK.join('、')}` : `${civics.length} 棟；幾何變了的次數 ${Object.entries(K0.changed).map(([f, c]) => `${f} ${c}`).join('、')}${K0.changed.lv ? '' : '（等級改了都不變：造型表不看等級，只記不判）'}`);

  // ---- 3. 注入錯誤要紅 ----
  const muts = [
    ['街區鍵少了地基高', () => blockRuns((bk, _y0) => blockKey(bk, 0)).viol.length],
    ['街區鍵少了等級', () => blockRuns((bk, y0) => blockKey({ ...bk, lv: 0 }, y0)).viol.length],
    ['街區鍵少了變體', () => blockRuns((bk, y0) => blockKey({ ...bk, v: 0 }, y0)).viol.length],
    ['非住商工鍵少了變體', () => civicRuns((b, s, y0) => civicKey({ ...b, v: 0 }, s, y0)).viol.length],
    ['非住商工鍵少了大小', () => civicRuns((b, _s, y0) => civicKey(b, 0, y0)).viol.length],
  ].map(([name, f]) => [name, f()]);
  log(muts.every(([, v]) => v > 0), 'D015：注入錯誤要紅——鍵少了一項（街區：地基高、等級、變體；非住商工：變體、大小），上面兩項就抓得到',
    muts.map(([n, v]) => `${n} ${v ? `抓到 ${v} 例` : '沒抓到'}`).join('、'));
}

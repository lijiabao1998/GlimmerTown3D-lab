// 拍樣張，存到 scratch/（不進版本庫）。
// 用法：node tools/shoot.mjs [--set=d001|timeline|bio|d003|d004|d005|d006|d007|d008|d010|d011|d012|d014|d016|d018|d019|d020|d020-traj|d022|d022-traj|d026|d027|d028|d028-gap|all] [--seed=5162026] [--out=scratch/shots] [--before=D010 版的 dist 目錄]
//   d001      三畫風 × 三年份 × 全景／近景（D001 對照）
//   timeline  畫風 A、對焦城心，第 0→300 年十格（D002）
//   bio       手機尺寸，第 300 年打開 (26,21) 的地塊履歷（D002）
//   d003      2D 城市模式：種子城全景／中景／遠景、AI 城中景、手機直式＋建築卡；
//             scratch/lab/ 有實驗線的 2D 樣張（tools/lab-extract.mjs 拍的）就再拼成 2D｜3D 並排對照
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser, ROOT } from './cdp.mjs';
const PORT = +(process.env.GT_PORT ?? 0) || 8311;   // 跟 withBrowser 同一個埠（tools/cdp.mjs）
import { codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { simHash } from '../src/sim/day.ts';
import { opsOf, parity3d } from './d011-parity-lib.mjs';
import { scriptOf, runScript } from './unit-d011-edit.mjs';
import { rciCover } from './smoke-d011.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const seed = arg('seed', '5162026'), set = arg('set', 'all'), out = path.resolve(ROOT, arg('out', 'scratch/shots'));
fs.mkdirSync(out, { recursive: true });
const want = s => set === 'all' || set === s;
const save = async (page, name) => {
  const shot = await page.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(out, name + '.png');
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('OK', path.relative(ROOT, file));
};
let errors = 0;

if (want('d001') || want('timeline')) await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
  if (want('d001')) for (const [vn, vq] of [['full', ''], ['near', '&at=center&zoom=3.2']])
    for (const style of ['A', 'B', 'C']) for (const year of [0, 80, 300]) {
      await open(`mode=history&seed=${seed}&style=${style}&year=${year}&clean=1${vq}`);
      await save(page, `${vn}_${style}_y${year}`);
    }
  if (want('timeline')) {
    await open(`mode=history&seed=${seed}&style=A&year=0&clean=1&at=center&zoom=2.6`);
    for (const y of [0, 15, 30, 45, 60, 80, 130, 180, 240, 300]) { await page.evaluate(`__gt.setYear(${y})`); await save(page, `timeline_y${String(y).padStart(3, '0')}`); }
  }
  errors += page.errors.length;
  if (page.errors.length) console.log('console 錯誤：\n  ' + page.errors.join('\n  '));
});

if (want('bio')) await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
  await open(`mode=history&seed=${seed}&year=300&at=26,21&zoom=3.4`);
  const lot = await page.evaluate('__gt.openLot(26, 21)');   // 回傳 {title, rows, future}（之前當成筆數印，印出 [object Object]）
  await new Promise(r => setTimeout(r, 400));
  console.log(`   (26,21) 履歷 ${lot.rows.length} 筆（灰 ${lot.future}）`);
  await save(page, 'bio_mobile_y300');
  await page.evaluate('__gt.setYear(60)');
  await new Promise(r => setTimeout(r, 400));
  await save(page, 'bio_mobile_y60');
  errors += page.errors.length;
  if (page.errors.length) console.log('console 錯誤：\n  ' + page.errors.join('\n  '));
});

// D003：視角對到實驗線樣張頁（gallery.js）的「中景・白天」z .75 @36,36 與「遠景・白天」z .45 @22,44；3D 縮放＝3.42×z
const D003 = [
  ['d003_seed_full', 'sample=seed516'],
  ['d003_seed_mid', 'sample=seed516&at=36,36&zoom=2.57', 'seed516_mid_2d.png', '種子城・中景'],
  ['d003_seed_far', 'sample=seed516&at=22,44&zoom=1.54', 'seed516_far_2d.png', '種子城・遠景'],
  ['d003_ai_mid', 'sample=ai120&at=36,36&zoom=2.57', 'ai120_mid_2d.png', 'AI 城 120 天・中景'],
];
if (want('d003')) {
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    for (const [name, q] of D003) { await open(`${q}&clean=1`); await save(page, name); }
    errors += page.errors.length;
    if (page.errors.length) console.log('console 錯誤：\n  ' + page.errors.join('\n  '));
  });
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await open('sample=seed516');
    await page.evaluate('(()=>{const p=__gt.pickTest(__gt.bigOne());return __gt.openTile(p.want[0],p.want[1]);})()');
    await new Promise(r => setTimeout(r, 400));
    await save(page, 'd003_mobile_card');
    errors += page.errors.length;
  });
  // 2D｜3D 並排：2D 圖由 tools/lab-extract.mjs 拍在 scratch/lab/（實驗線不在 CI 上，沒有就跳過）
  const lab = path.join(ROOT, 'scratch/lab'), pairs = D003.filter(d => d[2] && fs.existsSync(path.join(lab, d[2])));
  if (pairs.length) {
    for (const [name, , two, label] of pairs) {
      fs.copyFileSync(path.join(lab, two), path.join(out, `${name}_2d.png`));
      fs.writeFileSync(path.join(out, `${name}_pair.html`), `<!doctype html><meta charset="utf-8"><style>
        body{margin:0;background:#0d1226;color:#eef1f7;font:15px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 0}
        .row{display:flex;gap:10px;padding:8px 12px 12px}figure{margin:0}figcaption{padding:4px 2px 6px;font-weight:600}img{display:block;width:1280px;height:800px}</style>
        <h1>${label}：同一座城、同一個視角</h1><div class="row">
        <figure><figcaption>2D 實驗線 v13.43（d23c18d）</figcaption><img src="${name}_2d.png"></figure>
        <figure><figcaption>3D（D003：量體佔位，高度量自實驗線的精靈圖）</figcaption><img src="${name}.png"></figure></div>`);
    }
    await withBrowser({ root: out, entry: `${pairs[0][0]}_pair.html`, width: 2594, height: 880, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
      for (const [name] of pairs) {
        await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${name}_pair.html` });
        for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length===2&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
        await save(page, `${name}_compare`);
      }
    });
  } else console.log('（scratch/lab/ 沒有實驗線的 2D 樣張，跳過並排圖；先跑 npm run extract）');
}

// D004：住商工街區三檔對照（業主挑）。三個視角 × 五格：實驗線 2D、D003 現況、A、B、C；另拍手機直式。
// 每格取畫面中央 800×500、1:1 不縮放（像素風縮了會糊）；3D 與 2D 都對準同一格，所以中央對得上。
// 2D 圖由 tools/lab-extract.mjs --part=d004 拍在 scratch/lab/（匯入樣本碼、v 還原成存檔值之後的實驗線畫面）。
const D004 = [
  ['seed_mid', 'sample=seed516&at=36,36&zoom=2.57', 'd004_seed516_mid_2d.png', '種子城・中景'],
  ['seed_far', 'sample=seed516&at=22,44&zoom=1.71', 'd004_seed516_far_2d.png', '種子城・遠景'],   // 2D 用 z .5（z<.5 實驗線不畫建築），3D＝3.42×.5
  ['ai_mid', 'sample=ai120&at=36,36&zoom=2.57', 'd004_ai120_mid_2d.png', 'AI 城 120 天・中景'],
];
const MODES = [['', 'D003 現況（每格一棟、量體佔位）'], ['a', 'A 一格一棟（配方，1×1）'], ['b', 'B 照實驗線（切分、吸收、D0 空格全照抄）'], ['c', 'C 超街區補滿（B 的塊狀＋D0 補切、吸收的照畫）']];
if (want('d004')) {
  const stats = {};
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    for (const [view, q] of D004) for (const [m] of MODES) {
      await open(`${q}&clean=1&blocks=${m || 'off'}`);   // D005 起不帶參數是 B，D003 現況要明寫 off
      const s = await page.evaluate('({info: __gt.renderInfo(), owners: __gt.owners(), n: __gt.buildingCount(), bi: __gt.blockInfo(), t: __gt.timing()})');
      stats[`${view}_${m || 'd003'}`] = { tris: s.info.triangles, calls: s.info.calls, owners: s.owners, n: s.n, blocks: s.bi ? s.bi.plan.length : null,
        multi: s.bi ? s.bi.plan.filter(p => p[2] * p[3] > 1).length : null, sceneMs: +s.t.scene.toFixed(0) };
      await save(page, `d004_${view}_${m || 'd003'}`);
    }
    errors += page.errors.length;
    if (page.errors.length) console.log('console 錯誤：\n  ' + page.errors.join('\n  '));
  });
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await open('sample=seed516&blocks=b&at=36,36&zoom=2.4');
    // 點離畫面中心 (36,36) 最近的 ≥4 格街區
    await page.evaluate(`(()=>{const i=__gt.blockInfo(),dist=p=>Math.hypot(p[0]+p[2]/2-36.5,p[1]+p[3]/2-36.5);
      const d=i.drawn.filter(bi=>i.plan[bi][2]*i.plan[bi][3]>=4).sort((a,b)=>dist(i.plan[a])-dist(i.plan[b]))[0],p=i.plan[d];return __gt.openTile(p[0],p[1]);})()`);
    await new Promise(r => setTimeout(r, 400));
    await save(page, 'd004_mobile');
    errors += page.errors.length;
  });
  fs.writeFileSync(path.join(out, 'd004_stats.json'), JSON.stringify(stats, null, 1));
  const lab = path.join(ROOT, 'scratch/lab');
  for (const [view, , two, label] of D004) {
    const has2d = fs.existsSync(path.join(lab, two));
    if (has2d) fs.copyFileSync(path.join(lab, two), path.join(out, `d004_${view}_2d.png`));
    const cell = (src, cap) => `<figure><figcaption>${cap}</figcaption>${src ? `<img src="${src}">` : '<div class="none">（沒有 2D 圖：先跑 node tools/lab-extract.mjs --part=d004）</div>'}</figure>`;
    const st = m => { const s = stats[`${view}_${m || 'd003'}`]; return `${s.tris.toLocaleString()} 三角形・${s.calls} 次繪製・畫到 ${s.owners}／${s.n} 棟` + (s.blocks !== null ? `・街區 ${s.blocks}（多格 ${s.multi}）` : ''); };
    fs.writeFileSync(path.join(out, `d004_${view}_compare.html`), `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}
      .g{display:grid;grid-template-columns:repeat(3,800px);gap:10px;padding:8px 12px 12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}
      figcaption small{display:block;font-weight:400;color:#aab3c5;font-size:12px}img,.none{display:block;width:800px;height:500px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
      <h1>住商工街區各檔・${label}：同一座城、同一個視角（畫面中央 800×500，1:1；D005 起 A／B／C 都帶點綴）</h1>
      <p class="s">2D 是實驗線 v13.43（d23c18d）匯入同一個樣本碼後的畫面；匯入後實驗線暫停中、供電還沒重算，所以有停電閃電圖示（不推進模擬日，城市才是同一座）。</p>
      <div class="g">${cell(has2d ? `d004_${view}_2d.png` : '', '2D 實驗線 v13.43<small>住商工照超街區切分畫，D0 格留草坪</small>')}
      ${MODES.map(([m, cap]) => cell(`d004_${view}_${m || 'd003'}.png`, `${cap}<small>${st(m)}</small>`)).join('')}</div>`);
  }
  await withBrowser({ root: out, entry: `d004_${D004[0][0]}_compare.html`, width: 2444, height: 1150, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    for (const [view] of D004) {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d004_${view}_compare.html` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>=4&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      await save(page, `D004-${view.replace('_', '-')}-compare`);
    }
  });
}

// D005：街區特寫三格——實驗線 2D、D004 的 B、D005 的 B（現在的預設）。z 1.5 對準實驗線同一格（實驗線對的是格子北角，本線 at 減半格）。
// 2D 圖由 tools/lab-extract.mjs --part=d004 拍在 scratch/lab/d005_*；D004 的 B 要先把 850a963 建置到 scratch/d004-dist/（沒有就留白）。
const D005 = [
  ['seed_res', 'seed516', 'res', 9, 9, '種子城・住宅區'], ['seed_down', 'seed516', 'down', 24, 12, '種子城・市中心'],
  ['seed_ind', 'seed516', 'ind', 41, 12, '種子城・工業區'], ['ai_res', 'ai120', 'res', 33, 33, 'AI 城 120 天・住宅區'],
];
if (want('d005')) {
  const Z = 1.5, q = (id, x, y) => `sample=${id}&at=${x - 0.5},${y - 0.5}&zoom=${(3.42 * Z).toFixed(3)}&clean=1`;
  const old = path.join(ROOT, 'scratch/d004-dist'), hasOld = fs.existsSync(path.join(old, 'index.html'));
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    for (const [name, id, , x, y] of D005) { await open(q(id, x, y)); await save(page, `d005_${name}_now`); }
    errors += page.errors.length;
    if (page.errors.length) console.log('console 錯誤：\n  ' + page.errors.join('\n  '));
  });
  if (hasOld) await withBrowser({ root: old, width: 1280, height: 800 }, async ({ open, page }) => {
    for (const [name, id, , x, y] of D005) { await open(q(id, x, y) + '&blocks=b'); await save(page, `d005_${name}_d004`); }
  });
  else console.log('（scratch/d004-dist/ 沒有 D004 的建置，對照圖的中間那格留白）');
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await open('sample=seed516&at=9,8&zoom=3.2');
    await page.evaluate('__gt.openTile(5, 4)');   // villa（實驗線切分：1×1 起點，不併）
    await new Promise(r => setTimeout(r, 400));
    await save(page, 'D005-mobile');
    errors += page.errors.length;
  });
  const lab = path.join(ROOT, 'scratch/lab');
  for (const [name, id, lname, , , label] of D005) {
    const two = path.join(lab, `d005_${id}_${lname}_2d.png`), has2d = fs.existsSync(two);
    if (has2d) fs.copyFileSync(two, path.join(out, `d005_${name}_2d.png`));
    const cell = (src, cap) => `<figure><figcaption>${cap}</figcaption>${src ? `<img src="${src}">` : '<div class="none">（沒有這一格的圖）</div>'}</figure>`;
    fs.writeFileSync(path.join(out, `d005_${name}_compare.html`), `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}
      .g{display:grid;grid-template-columns:repeat(3,800px);gap:10px;padding:8px 12px 12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}
      figcaption small{display:block;font-weight:400;color:#aab3c5;font-size:12px}img,.none{display:block;width:800px;height:500px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
      <h1>D005 住商工美術・${label}：同一座城、同一格、同一個縮放（畫面中央 800×500，1:1）</h1>
      <p class="s">2D 是實驗線 v13.43（d23c18d）匯入同一個樣本碼、v 還原成存檔值之後的畫面；匯入後暫停中、供電還沒重算，所以有停電閃電圖示。</p>
      <div class="g">${cell(has2d ? `d005_${name}_2d.png` : '', '2D 實驗線 v13.43<small>地坪、前庭、屋頂設備都畫在街區精靈裡</small>')}
      ${cell(hasOld ? `d005_${name}_d004.png` : '', 'D004 的 B<small>只有量體：D0 是灰邊鋪面、窗是同一張暗色窗磚、平屋頂素面</small>')}
      ${cell(`d005_${name}_now.png`, 'D005 的 B（現在的預設）<small>地坪依類別、D0 是草坪；前庭道具、屋頂設備、店面帶與雨遮、門、裝卸口；窗依原型</small>')}</div>`);
  }
  await withBrowser({ root: out, entry: `d005_${D005[0][0]}_compare.html`, width: 2444, height: 620, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    for (const [name] of D005) {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d005_${name}_compare.html` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>=1&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      await save(page, `D005-${name.replace('_', '-')}-compare`);
    }
  });
}

// D006：地面與明暗對照——實驗線 2D、D005、D006 的明暗 a／b／c／d（d 是預設）。D005 要先把 f9e5add 建置到 scratch/d005-dist/（沒有就留白）
const D006 = [
  ['mid', 'sample=seed516&at=36,36&zoom=2.57', 'd004_seed516_mid_2d.png', '種子城・中景'],
  ['res', 'sample=seed516&at=8.5,8.5&zoom=5.13', 'd005_seed516_res_2d.png', '種子城・住宅區特寫'],
  ['ai', 'sample=ai120&at=32.5,32.5&zoom=5.13', 'd005_ai120_res_2d.png', 'AI 城・住宅區特寫'],
];
const TONE_CAP = { a: 'D006 明暗 a（D005 的光）', b: 'D006 明暗 b（背光面壓暗、天光減弱）', c: 'D006 明暗 c（b＋太陽加強）', d: 'D006 明暗 d（只壓暗背光面）＝預設' };
if (want('d006')) {
  const old = path.join(ROOT, 'scratch/d005-dist'), hasOld = fs.existsSync(path.join(old, 'index.html'));
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    for (const [name, q] of D006) for (const t of ['a', 'b', 'c', 'd']) { await open(`${q}&clean=1&tone=${t}`); await save(page, `d006_${name}_${t}`); }
    errors += page.errors.length;
  });
  if (hasOld) await withBrowser({ root: old, width: 1280, height: 800 }, async ({ open, page }) => { for (const [name, q] of D006) { await open(`${q}&clean=1`); await save(page, `d006_${name}_d005`); } });
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await open('sample=seed516&at=30,30&zoom=2.2');
    await save(page, 'D006-mobile');
    errors += page.errors.length;
  });
  const lab = path.join(ROOT, 'scratch/lab');
  for (const [name, , two, label] of D006) {
    const has2d = fs.existsSync(path.join(lab, two));
    if (has2d) fs.copyFileSync(path.join(lab, two), path.join(out, `d006_${name}_2d.png`));
    const cell = (src, cap) => `<figure><figcaption>${cap}</figcaption>${src ? `<img src="${src}">` : '<div class="none">（沒有這一格的圖）</div>'}</figure>`;
    fs.writeFileSync(path.join(out, `d006_${name}_compare.html`), `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}
      .g{display:grid;grid-template-columns:repeat(3,800px);gap:10px;padding:8px 12px 12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}
      img,.none{display:block;width:800px;height:500px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
      <h1>D006 地面與明暗・${label}（畫面中央 800×500，1:1）</h1><p class="s">地面色取自實驗線畫面的逐色統計；明暗四檔只差光，幾何完全相同。2D 的停電閃電理由同 D004。</p>
      <div class="g">${cell(has2d ? `d006_${name}_2d.png` : '', '2D 實驗線 v13.43')}${cell(hasOld ? `d006_${name}_d005.png` : '', 'D005（改之前）')}
      ${['a', 'b', 'c', 'd'].map(t => cell(`d006_${name}_${t}.png`, TONE_CAP[t])).join('')}</div>`);
  }
  await withBrowser({ root: out, entry: `d006_${D006[0][0]}_compare.html`, width: 2444, height: 1150, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    for (const [name] of D006) {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d006_${name}_compare.html` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>=4&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      await save(page, `D006-${name}-compare`);
    }
  });
}

// D007：逐種對照——全種類樣張城每一棟，實驗線 2D（tools/lab-extract.mjs --part=d007 拍的 scratch/lab/gallery/k*.png）｜3D，
// 同一個中心（佔地中心、建築半高）、同一個縮放（3D＝3.42×實驗線 z）。依分類拼成幾張型錄
if (want('d007')) {
  const { galleryZoom } = await import('../src/content/gallery.ts');
  const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/samples/gallery.json'), 'utf8'));
  const KD = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/lab-kinds.json'), 'utf8')), byK = Object.fromEntries(KD.kinds.map(r => [r.k, r]));
  const heightOf = (k) => { const r = byK[k]; if (!r || !r.sprites) return { 4: 0.08, 5: 1.6, 10: 1.8, 11: 1.0, 12: 1.8, 13: 0.8, 52: 0.6 }[k] ?? 1; return r.h[1] ?? Object.values(r.h)[0] ?? 1; };
  const thumbs = path.join(out, 'd007'); fs.mkdirSync(thumbs, { recursive: true });
  await withBrowser({ width: 900, height: 700 }, async ({ open, page }) => {
    await open('sample=gallery&clean=1');
    for (const p of G.place) {
      const bid = await page.evaluate(`(()=>{const L=__gt.layers();return L.occ[${p.z}*L.n+${p.x}];})()`);
      const z = galleryZoom(p.size, heightOf(p.k)) * 3.42;
      const at = await page.evaluate(`__gt.focusBuilding(${bid}, ${z})`);
      await new Promise(r => setTimeout(r, 60));
      const shot = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: at[0] - 150, y: at[1] - 150, width: 300, height: 300, scale: 1 } });
      fs.writeFileSync(path.join(thumbs, `k${p.k}.png`), Buffer.from(shot.data, 'base64'));
    }
    errors += page.errors.length;
    if (page.errors.length) console.log('console 錯誤：\n  ' + page.errors.join('\n  '));
  });
  const lab2d = path.join(ROOT, 'scratch/lab/gallery');
  if (fs.existsSync(lab2d)) for (const f of fs.readdirSync(lab2d).filter(f => /^k\d+\.png$/.test(f))) fs.copyFileSync(path.join(lab2d, f), path.join(thumbs, '2d_' + f));   // 2D 小圖要先跑 lab-extract --part=d007（CI 沒有實驗線，就只有 3D）
  const CATS = [['R', '住宅'], ['C', '商業'], ['I', '工業'], ['S', '市政治安'], ['D', '教育'], ['H', '醫療'], ['E', '能源'], ['W', '環衛'], ['T', '交通'], ['A', '文化觀光'], ['G', '綠地'], ['F', '農業']];
  const sheets = [['RCI', ['R', 'C', 'I']], ['SDH', ['S', 'D', 'H']], ['E', ['E']], ['WT', ['W', 'T']], ['A1', ['A']], ['GF', ['G', 'F']]];
  for (const [name, cats] of sheets) {
    let list = G.place.filter(p => cats.includes(p.cat));
    if (name === 'A1') { fs.writeFileSync(path.join(thumbs, `sheet_A2.json`), JSON.stringify(list.slice(24).map(p => p.k))); list = list.slice(0, 24); }
    const make = (nm, arr) => fs.writeFileSync(path.join(thumbs, `sheet_${nm}.html`), `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#0d1226;color:#eef1f7;font:13px system-ui,"Noto Sans CJK TC",sans-serif;width:2440px}h1{font-size:16px;margin:8px 10px}
      .g{display:flex;flex-wrap:wrap;gap:8px;padding:0 10px 10px}.c{width:396px;background:#161d36;border-radius:6px;padding:4px}.c div{display:flex;gap:4px}img{width:194px;height:194px;display:block}
      .c p{margin:2px 2px 4px;font-weight:600}</style><h1>D007 非住商工逐種對照（每格左：實驗線 2D；右：3D）・${cats.map(c => CATS.find(x => x[0] === c)[1]).join('、')}</h1>
      <div class="g">${arr.map(p => `<div class="c"><p>k${p.k} ${byK[p.k].name}（${p.size}×${p.size}）</p><div><img src="2d_k${p.k}.png"><img src="k${p.k}.png"></div></div>`).join('')}</div>`);
    make(name, list);
    if (name === 'A1') make('A2', G.place.filter(p => p.cat === 'A').slice(24));
  }
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {            // 手機直式：全種類樣張城、點一棟看卡
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await open('sample=gallery&at=9,39&zoom=2.2');   // 貨櫃碼頭 (1,31) 5×5，鏡頭往前挪讓它落在卡片上方
    await page.evaluate(`(()=>{const b=__gt.buildingList().find(r=>r[1]===174);return __gt.openTile(b[2],b[3]);})()`);
    await new Promise(r => setTimeout(r, 400));
    await save(page, 'D007-mobile');
    errors += page.errors.length;
  });
  const names = sheets.map(s => s[0]).concat(['A2']);
  await withBrowser({ root: thumbs, entry: `sheet_${names[0]}.html`, width: 2440, height: 1300, ready: '[...document.images].every(i=>i.complete)', settle: 300 }, async ({ page }) => {
    for (const nm of names) {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/sheet_${nm}.html` });
      await new Promise(r => setTimeout(r, 1500));
      const h = await page.evaluate('document.body.scrollHeight');
      // 型錄是 183 對小圖，存 PNG 一張 2–3 MB；改存 JPEG（品質 88，一張 0.5 MB 上下），版本庫才不會一輪長 15 MB
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, captureBeyondViewport: true, clip: { x: 0, y: 0, width: 2440, height: h, scale: 1 } });
      fs.writeFileSync(path.join(out, `D007-kinds-${nm}.jpg`), Buffer.from(shot.data, 'base64'));
      console.log('OK', `D007-kinds-${nm}.jpg`);
    }
  });
}

// D008：立面最密的三處特寫（實驗線 2D｜D007｜D008｜D008 放大兩倍），2×2 拼一張；手機直式點一個立面街區。
// 2D 由 tools/lab-extract.mjs --part=d004 拍在 scratch/lab/d008_*（以 6 格內的立面街區數挑點）；D007 要先把 8999376 建置到 scratch/d007-dist/（沒有就留白）
const D008 = [
  ['seed_fa', 'seed516', 'fa', 7, 14, '種子城・連棟與半獨立屋'], ['seed_fb', 'seed516', 'fb', 8, 30, '種子城・維多利亞排屋、大宅、高街'], ['ai_fa', 'ai120', 'fa', 30, 42, 'AI 城 120 天・連棟屋'],
];
if (want('d008')) {
  const Z = 1.5, q = (id, x, y, k = 1) => `sample=${id}&at=${x - 0.5},${y - 0.5}&zoom=${(3.42 * Z * k).toFixed(3)}&clean=1`;
  const old = path.join(ROOT, 'scratch/d007-dist'), hasOld = fs.existsSync(path.join(old, 'index.html'));
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    for (const [name, id, , x, y] of D008) { await open(q(id, x, y)); await save(page, `d008_${name}_now`); await open(q(id, x, y, 2)); await save(page, `d008_${name}_x2`); }
    errors += page.errors.length;
  });
  if (hasOld) await withBrowser({ root: old, width: 1280, height: 800 }, async ({ open, page }) => {
    for (const [name, id, , x, y] of D008) { await open(q(id, x, y)); await save(page, `d008_${name}_d007`); }
  });
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {            // 手機直式：連棟與半獨立屋一帶，點離中心最近的立面街區看卡
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await open('sample=seed516&at=7,12&zoom=3.4');
    await page.evaluate(`(()=>{const b=__gt.facadeBlocks().filter(b=>b.path!=='core').sort((a,c)=>Math.hypot(a.x-7,a.z-14)-Math.hypot(c.x-7,c.z-14))[0];return __gt.openTile(b.x,b.z);})()`);
    await new Promise(r => setTimeout(r, 400));
    await save(page, 'D008-mobile');
    errors += page.errors.length;
  });
  const lab = path.join(ROOT, 'scratch/lab');
  for (const [name, id, lname, , , label] of D008) {
    const two = path.join(lab, `d008_${id}_${lname}_2d.png`), has2d = fs.existsSync(two);
    if (has2d) fs.copyFileSync(two, path.join(out, `d008_${name}_2d.png`));
    const cell = (src, cap) => `<figure><figcaption>${cap}</figcaption>${src ? `<img src="${src}">` : '<div class="none">（沒有這一格的圖）</div>'}</figure>`;
    fs.writeFileSync(path.join(out, `d008_${name}_compare.html`), `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}
      .g{display:grid;grid-template-columns:repeat(2,800px);gap:10px;padding:8px 12px 12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}figcaption small{font-weight:400;color:#aab3c5;margin-left:8px}
      img,.none{display:block;width:800px;height:500px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
      <h1>D008 英美立面・${label}（畫面中央 800×500，1:1）</h1><p class="s">2D 的停電閃電理由同 D004（匯入後暫停、供電還沒重算）。</p>
      <div class="g">${cell(has2d ? `d008_${name}_2d.png` : '', '2D 實驗線 v13.43')}
      ${cell(hasOld ? `d008_${name}_d007.png` : '', 'D007（改之前）<small>立面街區只有一個量體加屋頂</small>')}
      ${cell(`d008_${name}_now.png`, 'D008 的 B（現在的預設）<small>逐戶牆色、凸窗、煙囪、門廊、石階；深街區背靠背多排；核心飾條</small>')}
      ${cell(`d008_${name}_x2.png`, 'D008 放大兩倍<small>同一個中心</small>')}</div>`);
  }
  await withBrowser({ root: out, entry: `d008_${D008[0][0]}_compare.html`, width: 1644, height: 1130, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    for (const [name] of D008) {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d008_${name}_compare.html` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>=3&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      // 對照圖存 JPEG（品質 88）：四格 PNG 一張 3 MB 上下
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
      fs.writeFileSync(path.join(out, `D008-${name.replace('_', '-')}-compare.jpg`), Buffer.from(shot.data, 'base64'));
      console.log('OK', `D008-${name.replace('_', '-')}-compare.jpg`);
    }
  });
}

// D010：起步城第 0、30、60、120 天（逐日模擬 seed 5162026，B 檔）｜實驗線同一天的 2D（回退設定、第一個種子，tools/lab-compare.mjs --shots 拍在 scratch/lab/）；手機直式一張。
// 視角同實驗線 GV.lookAt(36,32)＋zoom .75（3D 縮放＝3.42×z，D003 卡）
if (want('d010')) {
  const DAYS = [0, 30, 60, 120], q = 'sample=starter&at=36,32&zoom=2.565&clean=1';
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    await open(q);
    let at = 0;
    for (const d of DAYS) { if (d > at) { await page.evaluate(`__gt.simStep(${d - at})`); at = d; } await new Promise(r => setTimeout(r, 300)); await save(page, `d010_day${d}_3d`); }
    errors += page.errors.length;
  });
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await open('sample=starter');
    await page.evaluate('__gt.simStep(60)');
    await new Promise(r => setTimeout(r, 400));
    await save(page, 'D010-mobile');
    errors += page.errors.length;
  });
  const lab = path.join(ROOT, 'scratch/lab');
  const cells = DAYS.map(d => { const two = path.join(lab, `d010_day${d}_2d.png`), has = fs.existsSync(two); if (has) fs.copyFileSync(two, path.join(out, `d010_day${d}_2d.png`)); return [d, has]; });
  const cell = (src, cap) => `<figure><figcaption>${cap}</figcaption>${src ? `<img src="${src}">` : '<div class="none">（沒有這一格的圖：先跑 tools/lab-compare.mjs --shots）</div>'}</figure>`;
  fs.writeFileSync(path.join(out, 'd010_compare.html'), `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}
    .g{display:grid;grid-template-columns:repeat(2,800px);gap:10px;padding:8px 12px 12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}
    img,.none{display:block;width:800px;height:500px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
    <h1>D010 起步城逐日模擬：同一個起點、同一個種子（5162026）</h1><p class="s">左：2D 實驗線 v13.43（d23c18d），上層系統用它自己的開關關成回退值；右：3D（D009 公式照 tick() 順序接線）。畫面中央 800×500，1:1。</p>
    <div class="g">${cells.map(([d, has]) => cell(has ? `d010_day${d}_2d.png` : '', `第 ${d} 天・2D 實驗線`) + cell(`d010_day${d}_3d.png`, `第 ${d} 天・3D`)).join('')}</div>`);
  await withBrowser({ root: out, entry: 'd010_compare.html', width: 1644, height: 2200, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d010_compare.html` });
    for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>=4&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(out, 'D010-compare.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK', 'D010-compare.jpg');
  });
}

// ---- D011 建造 MVP ----
//   D011-compare.jpg：對拍那一串操作（tools/d011-ops.mjs A、推進一天、B），2D 實驗線與 3D 在經過第 0、30、60、120 天的畫面（2D 那一欄先跑 tools/d011-parity.mjs --shots）
//   D011-ui-compare.jpg：介面前後（--before＝D010 版建出的 dist；起步城、手機直式與桌機）
//   D011-build-mobile.jpg：手機上從空地到第 120 天（Node 守衛那一份劇本，同一串操作、資金設定照做）
// D011、D012 共用：乾淨開局（先到只能看的樣本城清存檔，再開指定網址）；劇本一筆 → 瀏覽器（tools/d011-ops.mjs 的操作）：資金、亂數對齊（兩邊 mulberry32(v)）、
// 復原走測試出口；施工走 __gt.edit（跟手勢同一條路）。單格拆除是 x0＝x1、z0＝z1 的框
const fresh = async (open, page, q) => { await open('sample=seed516&clean=1'); await page.evaluate('__gt.clearSave()'); await open(q); };
const js = o => o.k === 'money' ? `__gt.simMoney(${o.v})` : o.k === 'seed' ? `__gt.simSeed(${o.v})` : o.k === 'undo' ? '__gt.undo()' : `__gt.edit(${JSON.stringify(o)})`;
const toOp = (o, found) => o.k === 'money' || o.k === 'seed' || o.k === 'undo' ? o : o.at ? { k: o.k, tool: o.tool, x0: found[0], z0: found[1], x1: found[0], z1: found[1] }
  : o.k === 'tap' ? { k: 'tap', tool: o.tool, x0: o.x, z0: o.z, x1: o.x, z1: o.z } : { k: o.k, tool: o.tool, x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z1 };
// 框裡照格索引順序第一棟根格：what＝'kN'（那一種）或 'rci'（住商工任一種），同 tools/d011-ops.mjs PICK_SRC
const pickJs = o => { const kOk = o.what === 'rci' ? 'b[1]>=1&&b[1]<=3' : `b[1]===${+o.what.slice(1)}`;
  return `(()=>{const L=__gt.layers(),n=L.n,[x0,z0,x1,z1]=${JSON.stringify(o.rect)};for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const id=L.occ[z*n+x];if(id){const b=__gt.buildingList().find(r=>r[0]===id);if(b&&(${kOk})&&b[2]===x&&b[3]===z)return [x,z];}}return null;})()`; };

if (want('d011')) {
  const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), KT = kindTableFrom(JSON.parse(R('src/content/lab-kinds.json'))), vrank = JSON.parse(R('src/content/samples/d009-live.json')).vrank;
  const code = R('src/content/samples/newcity.code.txt').trim(), ops = opsOf(code), X = ops.site.x0, Z = ops.site.z0;
  // 1) 3D 照對拍那一串做，拍第 0、30、60、120 天；結束時的雜湊要等於 Node 跑的
  const P = parity3d(codeWithSeed(code, 5162026), KT, vrank, 120), found = P.B.find(o => o.k === 'pick').found;
  const plan = [...ops.A.map(o => toOp(o)), 'shot0', 'step1', ...ops.B.filter(o => o.k !== 'pick').map(o => toOp(o, found))];
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    await fresh(open, page, `at=${X + 10},${Z + 10}&zoom=2.565&clean=1`);
    let at = 0;
    for (const p of plan) {
      if (p === 'shot0') { await new Promise(r => setTimeout(r, 300)); await save(page, 'd011_day0_3d'); }
      else if (p === 'step1') { await page.evaluate('__gt.simStep(1)'); at = 1; }
      else await page.evaluate(js(p));
    }
    for (const d of [30, 60, 120]) { await page.evaluate(`__gt.simStep(${d - at})`); at = d; await new Promise(r => setTimeout(r, 300)); await save(page, `d011_day${d}_3d`); }
    const h = (await page.evaluate('__gt.sim()')).hash;
    console.log(h === simHash(P.sim) ? 'OK' : 'NG', `3D 對照那一跑經過 120 天的雜湊 ${h}＝Node ${simHash(P.sim)}`);
    if (h !== simHash(P.sim)) errors++;
    errors += page.errors.length;
  });
  const lab = path.join(ROOT, 'scratch/lab'), DAYS = [0, 30, 60, 120];
  const cells = DAYS.map(d => { const two = path.join(lab, `d011_day${d}_2d.png`), has = fs.existsSync(two); if (has) fs.copyFileSync(two, path.join(out, `d011_day${d}_2d.png`)); return [d, has]; });
  const cell = (src, cap) => `<figure><figcaption>${cap}</figcaption>${src ? `<img src="${src}">` : '<div class="none">（沒有這一格的圖：先跑 tools/d011-parity.mjs --shots）</div>'}</figure>`;
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}`;
  fs.writeFileSync(path.join(out, 'd011_compare.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(2,800px);gap:10px;padding:8px 12px 12px}img,.none{display:block;width:800px;height:500px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
    <h1>D011 建造 MVP：同一個起點（新城碼、種子 5162026）、同一串操作</h1><p class="s">開跑前一批（鋪路、升級、劃區、電廠、警察局、橋、快速路橋、拆除、復原，${ops.A.length} 筆）→ 推進一天 → 一批（亂數對齊、拆、警察局、重劃、復原，${ops.B.length} 筆）→ 之後只推進。左：2D 實驗線 v13.43（d23c18d），回退設定、用它自己的手勢函式；右：3D。第 0 天＝第一批做完、還沒推進。畫面中央 800×500，1:1。</p>
    <div class="g">${cells.map(([d, has]) => cell(has ? `d011_day${d}_2d.png` : '', `第 ${d} 天・2D 實驗線`) + cell(`d011_day${d}_3d.png`, `第 ${d} 天・3D`)).join('')}</div>`);
  // 2) 介面前後：起步城、手機直式與桌機
  const before = arg('before', '');
  const uiShots = async (root, tag) => {
    await withBrowser({ ...(root ? { root } : {}), width: 412, height: 860 }, async ({ open, page }) => {
      await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
      await open('sample=starter'); await new Promise(r => setTimeout(r, 400)); await save(page, `d011_ui_${tag}_mobile`);
      errors += page.errors.length;
    });
    await withBrowser({ ...(root ? { root } : {}), width: 1280, height: 800 }, async ({ open, page }) => {
      await open('sample=starter'); await new Promise(r => setTimeout(r, 400)); await save(page, `d011_ui_${tag}_desktop`);
      errors += page.errors.length;
    });
  };
  if (before) await uiShots(path.resolve(before), 'before');
  await uiShots('', 'after');
  const hasBefore = fs.existsSync(path.join(out, 'd011_ui_before_mobile.png'));
  fs.writeFileSync(path.join(out, 'd011_ui.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:640px 640px;gap:12px;padding:8px 12px 12px;align-items:start;justify-items:center}img{display:block}.m{width:412px;height:860px}.d{width:640px;height:400px}</style>
    <h1>D011 介面前後（起步城、第 1 天）</h1><p class="s">前：D010（面板＋按鈕列）；後：D011（上方狀態列＋☰ 選單，下方播放列與工具列，圖示由程式畫）。上排手機 412×860、下排桌機 1280×800 縮一半。</p>
    <div class="g">${hasBefore ? '<figure><figcaption>前・手機</figcaption><img class="m" src="d011_ui_before_mobile.png"></figure>' : '<div></div>'}<figure><figcaption>後・手機</figcaption><img class="m" src="d011_ui_after_mobile.png"></figure>
    ${hasBefore ? '<figure><figcaption>前・桌機</figcaption><img class="d" src="d011_ui_before_desktop.png"></figure>' : '<div></div>'}<figure><figcaption>後・桌機</figcaption><img class="d" src="d011_ui_after_desktop.png"></figure></div>`);
  // 3) 手機上從空地到第 120 天：Node 守衛那一份劇本（scriptOf），資金設定照做；結束時的雜湊要等於 Node
  const script = scriptOf(code), frames = [];
  const N = runScript(code, KT, vrank, script);
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await fresh(open, page, '');
    const shot = async (name, cap) => { await page.evaluate('__gt.tool(null)'); await new Promise(r => setTimeout(r, 350)); await save(page, name); frames.push([name, cap]); };
    await shot('d011_build_0', '開局：新城，$3,000');
    const picks = {};
    let seg = 0, batch = 0;
    for (const [kind, arg] of script) {
      if (kind === 'days') { await page.evaluate(`__gt.simStep(${arg})`); const s = await page.evaluate('__gt.sim()'); if (arg > 1) await shot(`d011_build_${++seg}`, `第 ${s.day - 1} 天・人口 ${s.pop}・$${Math.round(s.money).toLocaleString()}`); continue; }
      const b = batch++;
      for (const o of arg) {
        if (o.k === 'pick') { picks[o.as] = await page.evaluate(pickJs(o)); continue; }
        await page.evaluate(js(toOp(o, o.at ? picks[o.at] : null)));
      }
      if (b === 0 || b === 2) { const s = await page.evaluate('__gt.sim()'); await shot(`d011_build_${++seg}`, `${b ? `第 ${s.day - 1} 天擴建後` : '第一批施工後'}・$${Math.round(s.money).toLocaleString()}`); }
    }
    const h = (await page.evaluate('__gt.sim()')).hash;
    console.log(h === simHash(N.s) ? 'OK' : 'NG', `手機建造過程那一跑的雜湊 ${h}＝Node 劇本 ${simHash(N.s)}`);
    if (h !== simHash(N.s)) errors++;
    errors += page.errors.length;
    await page.evaluate('__gt.clearSave()');
  });
  fs.writeFileSync(path.join(out, 'd011_build.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(3,309px);gap:12px;padding:8px 12px 12px}img{display:block;width:309px;height:645px}</style>
    <h1>D011 手機上從空地到第 120 天</h1><p class="s">Node 守衛那一份劇本（tools/unit-d011-edit.mjs）：開跑前、第 1、30、60 天各一批施工（含拆除、復原），其餘自己長。412×860 縮 75%。</p>
    <div class="g">${frames.map(([f, c]) => `<figure><figcaption>${c}</figcaption><img src="${f}.png"></figure>`).join('')}</div>`);
  for (const [page0, file, w, h] of [['d011_compare.html', 'D011-compare.jpg', 1644, 2240], ['d011_ui.html', 'D011-ui-compare.jpg', 1316, 1500], ['d011_build.html', 'D011-build-mobile.jpg', 990, 1500]]) {
    await withBrowser({ root: out, entry: page0, width: w, height: h, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page0}` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      // 視窗高度設成內容的高度再拍（視窗比內容高時，無頭 Chrome 會在下方再畫一次上面的內容；scrollHeight 在內容比視窗矮時回報視窗高，所以量格線的底邊）
      const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: ch, deviceScaleFactor: 1, mobile: false });
      await new Promise(r => setTimeout(r, 300));
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(out, file), Buffer.from(shot.data, 'base64'));
      console.log('OK', file, `${w}×${ch}`);
    });
  }
}

// ---- D012 讀檔照實驗線重挑外觀；看不見的建築畫出來 ----
//   D012-before-after.jpg：同一個畫面四欄：2D（實驗線讀檔之後：tools/d012-parity.mjs --shots 拍在 scratch/lab/d012_*）｜前＝D012 之前的建置
//     （--before，預設 scratch/d011-dist：線上 9f8124e 那一版，預設 B、讀檔不重挑）｜後・B（讀檔重挑之後、照實驗線的切分：跟 2D 同一套，跟「前」只差重挑）｜
//     後・C（現在的預設）。種子城、AI 城住宅區特寫，劇本城（Node 守衛那一份完整劇本）第 121 天、重新整理一次之後（手機；沒有 2D）。
//     劇本城那一跑另外量驗收 5 的手機預算（三角形、draw call、覆蓋；CPU 降速 6 倍的重建與施工），超出就記錯
//   D012-compare.jpg：D011 那一組（對照那一跑，種子 5162026，不重新整理）第 0／30／60／120 天：2D 實驗線｜3D 預設 C｜3D B（照實驗線的切分）
if (want('d012')) {
  const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), KT = kindTableFrom(JSON.parse(R('src/content/lab-kinds.json'))), vrank = JSON.parse(R('src/content/samples/d009-live.json')).vrank;
  const code = R('src/content/samples/newcity.code.txt').trim(), ops = opsOf(code), X = ops.site.x0, Z = ops.site.z0;
  const beforeDir = path.resolve(ROOT, arg('before', 'scratch/d011-dist')), hasBefore = fs.existsSync(path.join(beforeDir, 'index.html'));
  if (!hasBefore) console.log(`（${path.relative(ROOT, beforeDir)} 沒有 D012 之前的建置，「前」那一欄留白：git worktree 取 052ec22 建置後放進去）`);
  const VIEWS = [['seed', 'sample=seed516&at=8.5,8.5&zoom=5.13', '種子城・住宅區特寫'], ['ai', 'sample=ai120&at=32.5,32.5&zoom=5.13', 'AI 城・住宅區特寫']];
  const notes = {};
  // 1) 樣本城：前、後各開一次同一個網址（只能看的城，讀檔就是匯入）
  for (const [tag, root] of [['before', hasBefore ? beforeDir : null], ['after', '']]) {
    if (root === null) continue;
    await withBrowser({ ...(root ? { root } : {}), width: 1280, height: 800 }, async ({ open, page }) => {
      for (const [name, q] of VIEWS) {
        await open(q + '&clean=1'); await new Promise(r => setTimeout(r, 300));
        if (tag === 'after') notes[name] = await page.evaluate('({restyled: __gt.restyled(), mode: __gt.blockMode()})');
        await save(page, `d012_${name}_${tag}`);
        // 後另拍 B（讀檔重挑之後、照實驗線的切分）：跟 2D 同一套切分與外觀，是「拍照盡可能一樣」的那一張；跟「前」（也是 B）只差讀檔重挑
        if (tag === 'after') { await open(q + '&clean=1&blocks=b'); await new Promise(r => setTimeout(r, 300)); await save(page, `d012_${name}_afterb`); }
      }
      errors += page.errors.length;
    });
  }
  // 2) 劇本城第 121 天：照 Node 守衛那一份劇本在頁面裡做完，重新整理一次（讀檔：後＝照實驗線重挑）再拍；兩邊的劇本結果雜湊都要等於 Node
  const script = scriptOf(code), N = runScript(code, KT, vrank, script);
  for (const [tag, root] of [['before', hasBefore ? beforeDir : null], ['after', '']]) {
    if (root === null) continue;
    await withBrowser({ ...(root ? { root } : {}), width: 412, height: 860 }, async ({ open, page }) => {
      await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
      await fresh(open, page, '');
      const picks = {};
      for (const [kind, a] of script) {
        if (kind === 'days') { await page.evaluate(`__gt.simStep(${a})`); continue; }
        for (const o of a) { if (o.k === 'pick') picks[o.as] = await page.evaluate(pickJs(o)); else await page.evaluate(js(toOp(o, o.at ? picks[o.at] : null))); }
      }
      const h = (await page.evaluate('__gt.sim()')).hash;
      console.log(h === simHash(N.s) ? 'OK' : 'NG', `D012 ${tag} 劇本城那一跑的雜湊 ${h}＝Node 劇本 ${simHash(N.s)}`);
      if (h !== simHash(N.s)) errors++;
      // D012 驗收 5 點名的「D011 劇本城第 121 天」就是這一座（完整劇本，住商工 256 棟）；煙霧重演的那一份拿掉了資金設定（211 棟），所以這裡另量：
      // 預設 C、手機直式，重新整理前後各一次：三角形 ≤ 118,884、draw call ≤ 18、住商工每一格剛好一個街區畫（量法同煙霧 tools/smoke-d011.mjs rciCover）
      const budget = async when => {
        const d = await page.evaluate('({i: __gt.renderInfo(), mode: __gt.blockMode(), bi: __gt.blockInfo(), list: __gt.buildingList()})'), cov = rciCover(d.bi, d.list);
        const ok = d.mode === 'c' && d.i.triangles <= 118884 && d.i.calls <= 18 && cov.ok;
        console.log(ok ? 'OK' : 'NG', `D012 驗收 5：劇本城（完整劇本）第 121 天${when}，預設 C 三角形 ≤ 118,884、draw call ≤ 18、住商工每一格剛好一個街區畫：`
          + `${d.i.triangles.toLocaleString()} 個、${d.i.calls} 次；${String(d.mode).toUpperCase()} 檔 住商工 ${cov.rci} 格、沒畫 ${cov.undrawn}、重疊 ${cov.over}、街區 ${cov.blocks} 塊（補切 ${cov.fill}）`);
        if (!ok) errors++;
      };
      if (tag === 'after') await budget('（重新整理之前）');
      await page.evaluate('__gt.saveNow?.()');
      await open('');                                                    // 重新整理：接著我的城（後：讀檔照實驗線重挑）
      await page.evaluate('__gt.tool(null)'); await new Promise(r => setTimeout(r, 400));
      if (tag === 'after') notes.script = await page.evaluate('({restyled: __gt.restyled(), mode: __gt.blockMode(), day: __gt.sim().day})');
      if (tag === 'after') await budget(`（重新整理之後，重挑 ${notes.script.restyled} 棟）`);
      await save(page, `d012_script_${tag}`);
      if (tag === 'after') {
        await page.evaluate(`__gt.setBlocks('b')`); await new Promise(r => setTimeout(r, 300)); await save(page, 'd012_script_afterb'); await page.evaluate(`__gt.setBlocks('c')`);
        // 驗收 5 的另外兩項手機預算，在這座城（完整劇本、預設 C）量：CPU 降速 6 倍，重建一次場景、施工一次（規則＋事件＋重建＋存檔＋畫一幀，
        // 走 __gt.edit，跟手勢放開之後同一條路；煙霧在拿掉資金設定的那一座用真的觸控量），各三次取中位數 ≤ 400 ms。拍完照才量（施工會改城）
        const med = a => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)], rb = [], cm = [];
        await page.send('Emulation.setCPUThrottlingRate', { rate: 6 });
        try {
          for (let k = 0; k < 3; k++) rb.push(await page.evaluate('__gt.simRebuild(true)'));   // D015 起量整張重建
          const runs = await page.evaluate(`(()=>{const L=__gt.layers(),n=L.n,ok=i=>!L.road[i]&&!L.zone[i]&&!L.occ[i]&&!L.tree[i]&&L.ter[i]!==0,o=[];
            for(let z=1;z<n-1&&o.length<3;z+=2)for(let x=0;x+6<=n&&o.length<3;x++){let g=true;for(let d=0;d<6;d++)if(!ok(z*n+x+d)){g=false;break;}if(g){o.push([x,z]);x+=6;}}return o;})()`);
          for (const [x, z] of runs) {
            const r = await page.evaluate(`(()=>{const r=__gt.edit(${JSON.stringify({ k: 'line', tool: 'road', x0: x, z0: z, x1: x + 5, z1: z })});return {placed:r&&r.placed,t:__gt.timing().commit};})()`);
            if (r.placed) cm.push(r.t);
          }
        } finally { await page.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
        const okT = rb.length === 3 && med(rb) <= 400 && cm.length === 3 && med(cm) <= 400;
        console.log(okT ? 'OK' : 'NG', `D012 驗收 5：劇本城（完整劇本）第 121 天重新整理之後（C），CPU 降速 6 倍：重建一次場景、施工一次（__gt.edit）各三次中位數 ≤ 400 ms：`
          + `重建 ${rb.map(v => v.toFixed(0)).join('、')} ms（中位數 ${rb.length ? med(rb).toFixed(0) : '—'}）；施工 ${cm.map(v => v.toFixed(0)).join('、')} ms（中位數 ${cm.length ? med(cm).toFixed(0) : '—'}）`);
        if (!okT) errors++;
      }
      await page.evaluate('__gt.clearSave()');
      errors += page.errors.length;
    });
  }
  // 3) 2D｜3D C｜3D B：D011 對照那一跑（不重新整理，所以沒有讀檔重挑；差別只在 D0 補不補畫）
  const P = parity3d(codeWithSeed(code, 5162026), KT, vrank, 120), found = P.B.find(o => o.k === 'pick').found;
  const plan = [...ops.A.map(o => toOp(o)), 'shot0', 'step1', ...ops.B.filter(o => o.k !== 'pick').map(o => toOp(o, found))];
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    await fresh(open, page, `at=${X + 10},${Z + 10}&zoom=2.565&clean=1`);
    const both = async d => { await new Promise(r => setTimeout(r, 300)); await save(page, `d012_day${d}_c`); await page.evaluate(`__gt.setBlocks('b')`); await new Promise(r => setTimeout(r, 300)); await save(page, `d012_day${d}_b`); await page.evaluate(`__gt.setBlocks('c')`); };
    let at = 0;
    for (const p of plan) {
      if (p === 'shot0') await both(0);
      else if (p === 'step1') { await page.evaluate('__gt.simStep(1)'); at = 1; }
      else await page.evaluate(js(p));
    }
    for (const d of [30, 60, 120]) { await page.evaluate(`__gt.simStep(${d - at})`); at = d; await both(d); }
    const h = (await page.evaluate('__gt.sim()')).hash;
    console.log(h === simHash(P.sim) ? 'OK' : 'NG', `D012 對照那一跑經過 120 天的雜湊 ${h}＝Node ${simHash(P.sim)}`);
    if (h !== simHash(P.sim)) errors++;
    errors += page.errors.length;
  });
  // 拼圖
  const lab = path.join(ROOT, 'scratch/lab'), copy2d = f => { const src = path.join(lab, f), has = fs.existsSync(src); if (has) fs.copyFileSync(src, path.join(out, f)); return has ? f : ''; };
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}`;
  const cell = (src, cap, cls = '') => `<figure><figcaption>${cap}</figcaption>${src ? `<img class="${cls}" src="${src}">` : `<div class="none ${cls}">（沒有這一格的圖）</div>`}</figure>`;
  const nb = n => n ? `讀檔重挑 ${n.restyled} 棟・${String(n.mode).toUpperCase()} 檔` : '';
  fs.writeFileSync(path.join(out, 'd012_ba.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(4,640px);gap:10px;padding:8px 12px 12px;align-items:start}img,.none{display:block;width:640px;height:400px;object-fit:none;object-position:50% 50%}
    .none{background:#222a44;display:flex;align-items:center;justify-content:center}.m{width:412px;height:860px;object-fit:fill}</style>
    <h1>D012 前後：讀檔照實驗線重挑外觀（T531）＋看不見的建築畫出來（預設 C）</h1>
    <p class="s">2D＝實驗線 d23c18d 讀同一張碼之後（它讀檔也會重挑）；前＝D012 之前（線上 9f8124e：B，讀檔保留存檔的外觀）；後・B＝D012 讀檔重挑之後、照實驗線的切分（跟 2D 同一套切分與外觀，跟「前」只差重挑）；後・C＝D012 的預設（D0 與被吸收的 1×1 也畫）。樣本城畫面中央 640×400、1:1；劇本城是手機 412×860。</p>
    <div class="g">${VIEWS.map(([n, , cap]) => cell(copy2d(`d012_${n}_2d.png`), `${cap}・2D 實驗線（讀檔之後）`) + cell(hasBefore ? `d012_${n}_before.png` : '', `${cap}・前（B、存檔的外觀）`) + cell(`d012_${n}_afterb.png`, `${cap}・後・B（讀檔重挑 ${notes[n]?.restyled ?? '?'} 棟）`) + cell(`d012_${n}_after.png`, `${cap}・後・C（${nb(notes[n])}）`)).join('')}
    <div></div>${cell(hasBefore ? 'd012_script_before.png' : '', '劇本城第 121 天・重新整理之後・前', 'm')}${cell('d012_script_afterb.png', `劇本城第 121 天・重新整理之後・後・B（讀檔重挑 ${notes.script?.restyled ?? '?'} 棟）`, 'm')}${cell('d012_script_after.png', `劇本城第 121 天・重新整理之後・後・C（${nb(notes.script)}）`, 'm')}</div>`);
  const DAYS = [0, 30, 60, 120];
  fs.writeFileSync(path.join(out, 'd012_compare.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(3,640px);gap:10px;padding:8px 12px 12px}img,.none{display:block;width:640px;height:400px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
    <h1>D012：同一串操作（D011 對照那一跑，種子 5162026），2D 實驗線｜3D 預設 C｜3D B</h1><p class="s">不重新整理（沒有讀檔重挑）。3D 兩欄是同一座城，差別只在「沒被街區認領的格（D0）與被吸收的 1×1」補不補畫：B 照實驗線畫草坪，C 補成建築。2D 那一欄是實驗線自己跑同一串操作：兩邊整城軌跡第 2 天起分岔（D011「沒做成的事」2，本線長得比較多），所以 2D 與 3D 的棟數本來就不同。畫面中央 640×400、1:1。</p>
    <div class="g">${DAYS.map(d => cell(copy2d(`d011_day${d}_2d.png`), `第 ${d} 天・2D 實驗線`) + cell(`d012_day${d}_c.png`, `第 ${d} 天・3D 預設 C`) + cell(`d012_day${d}_b.png`, `第 ${d} 天・3D B`)).join('')}</div>`);
  for (const [page0, file, w, h] of [['d012_ba.html', 'D012-before-after.jpg', 2614, 2000], ['d012_compare.html', 'D012-compare.jpg', 1964, 2000]]) {
    await withBrowser({ root: out, entry: page0, width: w, height: h, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page0}` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);   // 同 D011：視窗設成內容高度再拍
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: ch, deviceScaleFactor: 1, mobile: false });
      await new Promise(r => setTimeout(r, 300));
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(out, file), Buffer.from(shot.data, 'base64'));
      console.log('OK', file, `${w}×${ch}`);
    });
  }
}

// D014：施工 9 天 2D｜3D（起步城的警察局，兩邊開局都是屋齡 0）、風化與近看小物、手機上一段施工。
// 2D 要實驗線（--lab=../GlimmerTown-lab，d23c18d），拍到 scratch/lab/d014_*_2d.png；沒有就只拍 3D、2D 那一格留白
if (want('d014')) {
  const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), LAB = path.resolve(ROOT, arg('lab', '../GlimmerTown-lab')), labDir = path.join(ROOT, 'scratch/lab');
  const starter = R('src/content/samples/starter.code.txt').trim(), seed = R('src/content/samples/seed516.code.txt').trim(), SITE = [35, 31], SPOT = [24, 24], NEAR = [44, 30];
  const ages2d = {}, ages3d = {};
  if (fs.existsSync(path.join(LAB, 'index.html'))) {
    const { CONFIGS, preloadOf } = await import('./lab-configs.mjs');
    fs.mkdirSync(labDir, { recursive: true });
    await withBrowser({ root: LAB, port: 8431, width: 1280, height: 800, gl: false, preload: preloadOf(CONFIGS.default), ready: '!!window.__bootDone453', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      await open('');
      // 一張圖一次 evaluate（整批十幾張 PNG 塞進同一個回傳會卡住 CDP）
      const shot = (x, y) => `(()=>{GV.lookAt(${x},${y});GV.art574.zoom574(2.3);GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();GV.forceDraw();return document.getElementById('game').toDataURL('image/png');})()`;
      const png = url => Buffer.from(url.split(',')[1], 'base64');
      await page.evaluate(`(()=>{GV.setMapSize(72);GV.newWorldSeeded(777);if(!GV.importCode(${JSON.stringify(starter)}))throw new Error('import');GV.setSpeed(0);GV.ai(false);return 1;})()`);
      for (let d = 0; d <= 10; d++) {
        const age = await page.evaluate(`(()=>{const t=GV.tile(${SITE[0]},${SITE[1]});return t&&t.bld?t.bld.age:null;})()`);
        if (age !== null && ages2d[age] === undefined) { ages2d[age] = d; fs.writeFileSync(path.join(labDir, `d014_age${age}_2d.png`), png(await page.evaluate(shot(SITE[0] + .5, SITE[1] + .5)))); }
        await page.evaluate('GV.step(1)');
      }
      await page.evaluate(`(()=>{GV.setMapSize(72);GV.newWorldSeeded(777);GV.importCode(${JSON.stringify(seed)});GV.setSpeed(0);GV.ai(false);return 1;})()`);
      fs.writeFileSync(path.join(labDir, 'd014_weather_2d.png'), png(await page.evaluate(shot(SPOT[0] + .5, SPOT[1] + .5))));
      console.log('實驗線 2D：警察局', Object.entries(ages2d).map(([a, d]) => `屋齡 ${a}（第 ${d} 次推進後）`).join('、'));
    });
  } else console.log(`（${path.relative(ROOT, LAB)} 沒有實驗線，2D 那一欄留白）`);
  // 3D：同一座起步城、同一棟警察局，每天一張（當天比例 0＝整數天；動畫時間固定）
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    await open('sample=starter&clean=1');
    for (let d = 0; d <= 10; d++) {
      const age = (await page.evaluate(`__gt.conBuildings().find(b=>b.x===${SITE[0]}&&b.z===${SITE[1]})`))?.age;
      await page.evaluate(`(__gt.view(${SITE[0] + .5}, ${SITE[1] + .5}, 8), __gt.setVisT(2.2), 1)`); await new Promise(r => setTimeout(r, 250));
      if (ages3d[age] === undefined) { ages3d[age] = d; await save(page, `d014_age${age}_3d`); }
      await page.evaluate('__gt.simStep(1)');
    }
    // 風化（種子城 (24,24)）與近看小物（工業區 (44,30)）：拉近（實驗線縮放約 2.3），畫面中央 320×200 放大 2 倍
    const clip2 = async (name, y = 300) => { const s = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 480, y, width: 320, height: 200, scale: 2 } }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(s.data, 'base64')); console.log('OK', name); };
    await open('sample=seed516&clean=1');
    await page.evaluate(`__gt.view(${SPOT[0] + .5}, ${SPOT[1] + .5}, 8)`);
    for (const a of [13, 120, 300]) { await page.evaluate(`__gt.conAgeShift(${-(a + 1)})`); await new Promise(r => setTimeout(r, 250)); await clip2(`d014_weather_${a}`, 420); }   // 往下對準大樓的牆（中央是屋頂）
    await page.evaluate('__gt.conAgeShift(null)');
    await page.evaluate(`__gt.view(${NEAR[0] + .5}, ${NEAR[1] + .5}, 8)`);
    for (const [tag, v] of [['off', false], ['on', true]]) { await page.evaluate(`__gt.forceNear(${v})`); await new Promise(r => setTimeout(r, 250)); await clip2(`d014_near_${tag}`); }
    errors += page.errors.length;
  });
  // 手機：同一棟警察局從開挖到完工。暫停中推整數天、再設當天已過的比例（__gt.setDayFrac：天與天之間樓體照樣連續長高；不播放，拍到的 t 才確定）
  const MOB = [0, 1.5, 2.6, 3.5, 4.4, 5.3, 6.5, 7.6, 9];
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 1, mobile: true });
    await open('sample=starter&clean=1');
    let day = 0;
    for (const t of MOB) {
      const d = Math.floor(t); if (d > day) { await page.evaluate(`__gt.simStep(${d - day})`); day = d; }
      await page.evaluate(`(__gt.setDayFrac(${(t - d).toFixed(2)}), __gt.view(${SITE[0] + .5}, ${SITE[1] + .5}, 8), __gt.setVisT(${(t * 1.7 + .4).toFixed(2)}), 1)`);
      await new Promise(r => setTimeout(r, 250)); await save(page, `d014_mob_${t}`);
    }
    errors += page.errors.length;
  });
  // 拼圖
  const copy2d = f => { const src = path.join(labDir, f), has = fs.existsSync(src); if (has) fs.copyFileSync(src, path.join(out, f)); return has ? f : ''; };
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}`;
  const cell = (src, cap, cls = '') => `<figure><figcaption>${cap}</figcaption>${src ? `<img class="${cls}" src="${src}">` : `<div class="none ${cls}">（沒有這一格的圖）</div>`}</figure>`;
  const STAGE = ['開挖、挖掘機、傾卸車', '地基：鋼筋、攪拌車', '鋼骨半高、塔吊', '鋼骨全高、焊接火花', '樓體 30%、鷹架', '樓體 50%', '樓體 68%（塔吊最後一天）', '樓體 84%', '樓體 96%', '完工'];
  fs.writeFileSync(path.join(out, 'd014_stages.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(4,640px);gap:10px;padding:8px 12px 12px}img,.none{display:block;width:640px;height:400px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
    <h1>D014 施工 9 天：起步城的警察局（35,31），2D 實驗線｜3D</h1><p class="s">兩邊都從起步城開局（屋齡 0），一天推一次；每一欄照屋齡對齊。2D＝實驗線 d23c18d（T259 分期、實驗線縮放 2.3）；3D＝本線（樓體由著色器照屋齡長高，工地是一個網格）。畫面中央 640×400、1:1。</p>
    <div class="g">${Array.from({ length: 10 }, (_, a) => cell(copy2d(`d014_age${a}_2d.png`), `屋齡 ${a}・2D・${STAGE[a]}`) + cell(ages3d[a] !== undefined ? `d014_age${a}_3d.png` : '', `屋齡 ${a}・3D`)).join('')}</div>`);
  fs.writeFileSync(path.join(out, 'd014_detail.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(3,640px);gap:10px;padding:8px 12px 12px}img,.none{display:block;width:640px;height:400px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
    <h1>D014 近看的細節：種子城拉近（實驗線縮放約 2.3），畫面中央放大 2 倍</h1><p class="s">風化（T591／T606，(24,24)）：同一個畫面把屋齡（只改畫面）換成 13／120／300 天；13 天還沒到門檻，120 天一級、300 天三級：牆上從簷口垂下的雨漬、簷下積灰、接地苔垢。分級、密度、長度、顏色照實驗線；3D 的像素密度只有實驗線三分之一、後製又量化成 12 階，雨漬寬度 ×2、透明度 ×2.5 才看得出來（D014 卡）。近看小物（T599／T606，工業區 (44,30)）：牆腳的工安斜紋、棧板與貨箱、側牆立管與冷氣機，實驗線縮放 ≥ 1.22 才畫。2D＝實驗線 (24,24)（它自己的屋齡）。</p>
    <div class="g">${cell(copy2d('d014_weather_2d.png'), '2D 實驗線 (24,24)（屋齡 18–59，畫面中央 640×400）')}${cell('d014_weather_13.png', '3D・屋齡 13（沒風化）')}${cell('d014_weather_120.png', '3D・屋齡 120')}${cell('d014_weather_300.png', '3D・屋齡 300')}${cell('d014_near_off.png', '3D・近看小物關')}${cell('d014_near_on.png', '3D・近看小物開')}</div>`);
  fs.writeFileSync(path.join(out, 'd014_mobile.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(9,412px);gap:10px;padding:8px 12px 12px}img{display:block;width:412px;height:860px}</style>
    <h1>D014 手機：起步城的警察局從開挖到完工</h1><p class="s">412×860。t＝屋齡＋當天已過的比例：播放時樓體每一幀都在長，不是一天跳一級（整數天 4–8 的高度＝實驗線 riseF）。</p>
    <div class="g">${MOB.map(t => cell(`d014_mob_${t}.png`, `t＝${t >= 9 ? '9（完工）' : t}`)).join('')}</div>`);
  for (const [page0, file, w, h] of [['d014_stages.html', 'D014-construction.jpg', 2614, 2400], ['d014_detail.html', 'D014-detail.jpg', 1964, 1000], ['d014_mobile.html', 'D014-mobile.jpg', 3830, 960]]) {
    await withBrowser({ root: out, entry: page0, width: w, height: h, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page0}` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: ch, deviceScaleFactor: 1, mobile: false });
      await new Promise(r => setTimeout(r, 300));
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(out, file), Buffer.from(shot.data, 'base64'));
      console.log('OK', file, `${w}×${ch}`);
    });
  }
}

// D016：公共設施九支。同一串操作（D011 的 A 段＋D016 的 C 段，種子 5162026）在實驗線 2D 與本線 3D 各跑一次，拍次幹道南邊那一排設施：
// 蓋下去那天（8 種是工地、公園不施工）與 9 天之後（完工）；手機 360×740：「公共設施」選單打開、蓋好的那一排。
// 2D 要實驗線（--lab=../GlimmerTown-lab，d23c18d）：記憶體副本插一段手勢出口（同 tools/d016-parity.mjs），拍到 scratch/lab/d016_*_2d.png；沒有就只拍 3D
if (want('d016')) {
  const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), LAB = path.resolve(ROOT, arg('lab', '../GlimmerTown-lab')), labDir = path.join(ROOT, 'scratch/lab');
  const { decodeLabCode } = await import('../src/io/labcode.ts'), { d016Ops } = await import('./d016-ops.mjs');
  const code = codeWithSeed(R('src/content/samples/newcity.code.txt').trim(), 5162026), S = decodeLabCode(code).save, lay = k => Uint8Array.from(S.layers[k] ?? '', ch => ch.charCodeAt(0) - 48);
  const ops = d016Ops(S.n, lay('ter'), lay('el'), lay('tre')), all = [...ops.A, ...ops.C], X = ops.site.x0, Z = ops.site.z0, CX = X + 10.5, CZ = Z + 12;
  if (fs.existsSync(path.join(LAB, 'index.html'))) {
    const { CONFIGS, preloadOf, injectLab } = await import('./lab-configs.mjs');
    const EX = `window.__d016s={tap:(id,x,y)=>{tool=id;openUndo();paintLast=null;paintTo(x,y);closeUndo();paintLast=null;},
  line:(id,x0,y0,x1,y1)=>{tool=id;roadDraft436={x0,y0,x1,y1,active:true};commitRoadDraft436();roadDraft436=null;},
  rect:(id,x0,y0,x1,y1,now)=>{tool=id;rect.x0=x0;rect.y0=y0;rect.x1=x1;rect.y1=y1;performance.now=()=>now;try{commitRect();}finally{delete performance.now;}},setMoney:v=>{money=v;}};`;
    const copy = injectLab(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), EX);
    fs.mkdirSync(labDir, { recursive: true });
    await withBrowser({ root: LAB, entry: 'd016s.html', overlay: { 'd016s.html': copy }, port: 8432, width: 1280, height: 800, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d016s', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      await open('');
      const shot = `(()=>{GV.lookAt(${CX},${CZ});GV.art574.zoom574(1.5);GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();GV.forceDraw();return document.getElementById('game').toDataURL('image/png');})()`;
      const png = url => Buffer.from(url.split(',')[1], 'base64');
      await page.evaluate(`(()=>{GV.setMapSize(72);GV.newWorldSeeded(777);if(!GV.importCode(${JSON.stringify(code)}))throw new Error('import');GV.setSpeed(0);GV.ai(false);let clock=0;
        for(const o of ${JSON.stringify(all)}){clock+=o.gap??10000;if(o.k==='money'){__d016s.setMoney(o.v);continue;}if(o.k==='undo'){GV.undo();continue;}
          const c=o.k==='tap'?[o.x,o.z,o.x,o.z]:[o.x0,o.z0,o.x1,o.z1];if(o.k==='tap')__d016s.tap(o.tool,c[0],c[1]);else if(o.k==='line')__d016s.line(o.tool,c[0],c[1],c[2],c[3]);else __d016s.rect(o.tool,c[0],c[1],c[2],c[3],clock);}return 1;})()`);
      fs.writeFileSync(path.join(labDir, 'd016_day0_2d.png'), png(await page.evaluate(shot)));
      for (let d = 0; d < 9; d++) await page.evaluate('GV.step(1)');
      fs.writeFileSync(path.join(labDir, 'd016_day9_2d.png'), png(await page.evaluate(shot)));
      console.log('實驗線 2D：d016_day0_2d.png、d016_day9_2d.png');
      errors += page.errors.filter(e => !/manifest|service ?worker|favicon/i.test(e)).length;
    });
  } else console.log(`（${path.relative(ROOT, LAB)} 沒有實驗線，2D 那一欄留白）`);
  // 3D：新城（開局種子＝5162026，同 D011 那一段）照同一串做
  const apply3d = async page => { for (const o of all) await page.evaluate(js(toOp(o))); const s = await page.evaluate('__gt.sim()'); if (s.seed !== 5162026) throw new Error(`新城種子 ${s.seed}`); };
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    await fresh(open, page, 'clean=1');
    await apply3d(page);
    await page.evaluate(`(__gt.view(${CX}, ${CZ}, 4.8), __gt.setVisT(2.2), 1)`); await new Promise(res => setTimeout(res, 300)); await save(page, 'd016_day0_3d');
    await page.evaluate('__gt.simStep(9)');
    await page.evaluate(`(__gt.view(${CX}, ${CZ}, 4.8), __gt.setVisT(2.2), 1)`); await new Promise(res => setTimeout(res, 300)); await save(page, 'd016_day9_3d');
    errors += page.errors.length;
  });
  // 手機：選單打開（選醫院）、蓋好的那一排（9 天之後）
  await withBrowser({ width: 360, height: 740 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
    await fresh(open, page, '');
    await apply3d(page);
    await page.evaluate(`(__gt.simStep(9), __gt.view(${CX}, ${CZ}, 4.2), __gt.setVisT(2.2), __gt.tool('civic','hospital'), 1)`);
    await new Promise(res => setTimeout(res, 3200)); await save(page, 'd016_mob_menu');   // 里程碑通知（2.7 秒散掉）不擋畫面
    await page.evaluate(`(__gt.tool(null), __gt.openTile(${X + 4}, ${Z + 11}), 1)`);
    await new Promise(res => setTimeout(res, 400)); await save(page, 'd016_mob_card');
    errors += page.errors.length;
  });
  // 拼圖
  const copy2d = f => { const src = path.join(labDir, f), has = fs.existsSync(src); if (has) fs.copyFileSync(src, path.join(out, f)); return has ? f : ''; };
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}`;
  const cell = (src, cap, cls = '') => `<figure><figcaption>${cap}</figcaption>${src ? `<img class="${cls}" src="${src}">` : `<div class="none ${cls}">（沒有這一格的圖）</div>`}</figure>`;
  fs.writeFileSync(path.join(out, 'd016_compare.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(2,800px);gap:10px;padding:8px 12px 12px}img,.none{display:block;width:800px;height:480px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
    <h1>D016 公共設施：同一串操作（D011 A 段＋D016 C 段，種子 5162026），2D 實驗線｜3D</h1><p class="s">次幹道南邊那一排，左起：公園、消防局、派出所、醫院、診所、學校、圖書館、郵局、墓園；再過去是框出來的 3×2 公園、錢剛好的醫院、拆了又復原、最後一棟派出所。蓋下去那天 8 種是工地（公園不施工），9 天之後完工。2D 那一欄是實驗線 d23c18d 自己跑同一串（兩邊整城第 2 天起分岔，住商工的棟數本來就不同）。畫面中央 800×480、1:1。</p>
    <div class="g">${cell(copy2d('d016_day0_2d.png'), '蓋下去那天・2D 實驗線')}${cell('d016_day0_3d.png', '蓋下去那天・3D')}${cell(copy2d('d016_day9_2d.png'), '9 天之後・2D 實驗線')}${cell('d016_day9_3d.png', '9 天之後・3D')}</div>`);
  fs.writeFileSync(path.join(out, 'd016_mobile.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(2,360px);gap:10px;padding:8px 12px 12px}img{display:block;width:360px;height:740px}</style>
    <h1>D016 手機 360×740</h1><p class="s">左：「公共設施」一組打開（選醫院：組按鈕寫「醫」、$600）；右：放下工具、點醫院看建築卡。</p>
    <div class="g">${cell('d016_mob_menu.png', '「公共設施」十種')}${cell('d016_mob_card.png', '建築卡')}</div>`);
  for (const [page0, file, w, h] of [['d016_compare.html', 'D016-compare.jpg', 1640, 1200], ['d016_mobile.html', 'D016-mobile.jpg', 760, 900]]) {
    await withBrowser({ root: out, entry: page0, width: w, height: h, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page0}` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: ch, deviceScaleFactor: 1, mobile: false });
      await new Promise(r => setTimeout(r, 300));
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(out, file), Buffer.from(shot.data, 'base64'));
      console.log('OK', file, `${w}×${ch}`);
    });
  }
}

// D019：供水。同一串操作（D011 的 A 段＋主街北邊那一排分區底下一條配水管、西端一座水塔，種子 5162026）在實驗線 2D 與本線 3D 各跑一次，拿著配水管拍（兩邊平常都不畫水管）：
// 蓋下去那天、20 天之後。手機：「公共設施」一組選配水管、有水的住宅建築卡。2D 要實驗線（--lab），沒有就只拍 3D
if (want('d019')) {
  const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), LAB = path.resolve(ROOT, arg('lab', '../GlimmerTown-lab')), labDir = path.join(ROOT, 'scratch/lab');
  const { decodeLabCode } = await import('../src/io/labcode.ts'), { d016Ops } = await import('./d016-ops.mjs');
  const code = codeWithSeed(R('src/content/samples/newcity.code.txt').trim(), 5162026), S = decodeLabCode(code).save, lay = k => Uint8Array.from(S.layers[k] ?? '', ch => ch.charCodeAt(0) - 48);
  const o16 = d016Ops(S.n, lay('ter'), lay('el'), lay('tre')), X = o16.site.x0, Z = o16.site.z0, n = S.n, ter = lay('ter');
  // 主街（Z+5）北邊那一排（Z+4，住宅區）從 X−2 拉到 X+20 的配水管（實驗線路底下的水管被路蓋住，拍不到）；水塔：西端那一格上下兩格裡第一格陸地
  const wx = X - 2, tz = [Z + 3, Z + 5, Z + 2, Z + 6].find(z => ter[z * n + wx] !== 0);
  const W = [{ k: 'money', v: 20000 }, { k: 'line', tool: 'wpipe', x0: wx, z0: Z + 4, x1: X + 20, z1: Z + 4 }, { k: 'tap', tool: 'water', x: wx, z: tz }];
  const all = [...o16.A, ...W], CX = X + 9, CZ = Z + 5.5;
  if (fs.existsSync(path.join(LAB, 'index.html'))) {
    const { CONFIGS, preloadOf, injectLab } = await import('./lab-configs.mjs');
    const EX = `window.__d019s={tap:(id,x,y)=>{tool=id;openUndo();paintLast=null;paintTo(x,y);closeUndo();paintLast=null;},
  line:(id,x0,y0,x1,y1)=>{tool=id;roadDraft436={x0,y0,x1,y1,active:true};commitRoadDraft436();roadDraft436=null;},
  rect:(id,x0,y0,x1,y1,now)=>{tool=id;rect.x0=x0;rect.y0=y0;rect.x1=x1;rect.y1=y1;performance.now=()=>now;try{commitRect();}finally{delete performance.now;}},setMoney:v=>{money=v;},setTool:v=>{tool=v;}};`;
    const copy = injectLab(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), EX);
    fs.mkdirSync(labDir, { recursive: true });
    await withBrowser({ root: LAB, entry: 'd019s.html', overlay: { 'd019s.html': copy }, port: 8433, width: 1280, height: 800, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d019s', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      await open('');
      const shot = `(()=>{__d019s.setTool('wpipe');GV.lookAt(${CX},${CZ});GV.art574.zoom574(1.5);GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();GV.forceDraw();return document.getElementById('game').toDataURL('image/png');})()`;
      const png = url => Buffer.from(url.split(',')[1], 'base64');
      await page.evaluate(`(()=>{GV.setMapSize(72);GV.newWorldSeeded(777);if(!GV.importCode(${JSON.stringify(code)}))throw new Error('import');GV.setSpeed(0);GV.ai(false);let clock=0;
        for(const o of ${JSON.stringify(all)}){clock+=o.gap??10000;if(o.k==='money'){__d019s.setMoney(o.v);continue;}if(o.k==='undo'){GV.undo();continue;}if(o.k==='seed'||o.k==='pick')continue;
          const c=o.k==='tap'?[o.x,o.z,o.x,o.z]:[o.x0,o.z0,o.x1,o.z1];if(o.k==='tap')__d019s.tap(o.tool,c[0],c[1]);else if(o.k==='line')__d019s.line(o.tool,c[0],c[1],c[2],c[3]);else __d019s.rect(o.tool,c[0],c[1],c[2],c[3],clock);}return 1;})()`);
      fs.writeFileSync(path.join(labDir, 'd019_day0_2d.png'), png(await page.evaluate(shot)));
      for (let d = 0; d < 20; d++) await page.evaluate('GV.step(1)');
      fs.writeFileSync(path.join(labDir, 'd019_day20_2d.png'), png(await page.evaluate(shot)));
      console.log('實驗線 2D：d019_day0_2d.png、d019_day20_2d.png');
      errors += page.errors.filter(e => !/manifest|service ?worker|favicon/i.test(e)).length;
    });
  } else console.log(`（${path.relative(ROOT, LAB)} 沒有實驗線，2D 那一欄留白）`);
  const apply3d = async page => { for (const o of all) { if (o.k === 'pick') continue; await page.evaluate(js(toOp(o))); } };
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    await fresh(open, page, 'clean=1');
    await apply3d(page);
    await page.evaluate(`(__gt.tool('civic','wpipe'), __gt.view(${CX}, ${CZ}, 4.8), __gt.setVisT(2.2), 1)`); await new Promise(res => setTimeout(res, 300)); await save(page, 'd019_day0_3d');
    await page.evaluate('(__gt.tool(null), __gt.simStep(20), 1)');
    await page.evaluate(`(__gt.tool('civic','wpipe'), __gt.view(${CX}, ${CZ}, 4.8), __gt.setVisT(2.2), 1)`); await new Promise(res => setTimeout(res, 300)); await save(page, 'd019_day20_3d');
    errors += page.errors.length;
  });
  // 手機：「公共設施」一組選配水管（地面畫出水管）；放下工具點一棟有水的住宅
  await withBrowser({ width: 360, height: 740 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
    await fresh(open, page, '');
    await apply3d(page);
    await page.evaluate(`(__gt.simStep(20), __gt.view(${CX}, ${CZ}, 4.2), __gt.setVisT(2.2), __gt.tool('civic','wpipe'), 1)`);
    await new Promise(res => setTimeout(res, 3200)); await save(page, 'd019_mob_menu');
    const wet = await page.evaluate(`(()=>{for(const b of __gt.conBuildings())if(!b.gone&&b.k===1&&__gt.tileWa(b.x,b.z))return [b.x,b.z];return null;})()`);
    if (wet) await page.evaluate(`(__gt.tool(null), __gt.openTile(${wet[0]}, ${wet[1]}), 1)`);
    await new Promise(res => setTimeout(res, 400)); await save(page, 'd019_mob_card');
    errors += page.errors.length;
  });
  const copy2d = f => { const src = path.join(labDir, f), has = fs.existsSync(src); if (has) fs.copyFileSync(src, path.join(out, f)); return has ? f : ''; };
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}`;
  const cell = (src, cap, cls = '') => `<figure><figcaption>${cap}</figcaption>${src ? `<img class="${cls}" src="${src}">` : `<div class="none ${cls}">（沒有這一格的圖）</div>`}</figure>`;
  fs.writeFileSync(path.join(out, 'd019_compare.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(2,800px);gap:10px;padding:8px 12px 12px}img,.none{display:block;width:800px;height:480px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
    <h1>D019 供水：同一串操作（D011 A 段＋主街北邊那一排分區底下一條配水管、西端一座水塔，種子 5162026），拿著配水管，2D 實驗線｜3D</h1><p class="s">兩邊平常都不畫水管（實驗線埋在地下，utilityLineMode485C 50907），拿著配水管才畫；路底下、建築底下的水管兩邊都被蓋住。3D 的水管畫在地面貼圖上（顏色取實驗線水管精靈：管身 #52bde0、外框、中心亮點），不加網格。2D 那一欄是實驗線 d23c18d 自己跑同一串（兩邊整城第 2 天起分岔，住商工的棟數本來就不同）。畫面中央 800×480、1:1。</p>
    <div class="g">${cell(copy2d('d019_day0_2d.png'), '蓋下去那天・2D 實驗線')}${cell('d019_day0_3d.png', '蓋下去那天・3D')}${cell(copy2d('d019_day20_2d.png'), '20 天之後・2D 實驗線')}${cell('d019_day20_3d.png', '20 天之後・3D')}</div>`);
  fs.writeFileSync(path.join(out, 'd019_mobile.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(2,360px);gap:10px;padding:8px 12px 12px}img{display:block;width:360px;height:740px}</style>
    <h1>D019 手機 360×740</h1><p class="s">左：「公共設施」一組（多了水塔、配水管）選配水管，地面畫出水管；右：放下工具、點一棟有水的住宅看建築卡。</p>
    <div class="g">${cell('d019_mob_menu.png', '選配水管')}${cell('d019_mob_card.png', '建築卡：有電・有水')}</div>`);
  for (const [page0, file, w, h] of [['d019_compare.html', 'D019-compare.jpg', 1640, 1200], ['d019_mobile.html', 'D019-mobile.jpg', 760, 900]]) {
    await withBrowser({ root: out, entry: page0, width: w, height: h, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page0}` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: ch, deviceScaleFactor: 1, mobile: false });
      await new Promise(r => setTimeout(r, 300));
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(out, file), Buffer.from(shot.data, 'base64'));
      console.log(`OK ${file}`);
    });
  }
}

// D018：公園九種。2D＝實驗線自己的精靈 SPR.park（記憶體副本插一行出口讀出 PNG，放大 4 倍、像素不糊）；
// 3D＝新城地形上擺一張 3×3 的測試城（九座公園，變體 0–8，屋齡 20），每一座拉近拍；另拍 AI 城 120 天公園最密的一帶。
if (want('d018')) {
  const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), LAB = path.resolve(ROOT, arg('lab', '../GlimmerTown-lab')), labDir = path.join(ROOT, 'scratch/lab');
  const { decodeLabCode, encodeLabCode } = await import('../src/io/labcode.ts'), { starterLayout } = await import('../src/content/starter.ts');
  const base = R('src/content/samples/newcity.code.txt').trim(), S = decodeLabCode(base).save, raw = { ...S.raw }, n = S.n;
  const lay = k => Uint8Array.from(S.layers[k] ?? '', ch => ch.charCodeAt(0) - 48), L = starterLayout(n, lay('ter'), lay('el'));
  const spots = Array.from({ length: 9 }, (_, v) => [L.x0 + 3 + 6 * (v % 3), L.z0 + 3 + 6 * Math.floor(v / 3)]);
  raw.bl = spots.map(([x, z], v) => [z * n + x, 4, 1, v, 20]);
  const code = encodeLabCode(raw, { deflate: true });
  if (fs.existsSync(path.join(LAB, 'index.html'))) {
    const { CONFIGS, preloadOf, injectLab } = await import('./lab-configs.mjs');
    const copy = injectLab(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), "window.__d018=()=>SPR.park.map(s=>s.img.toDataURL('image/png'));");
    fs.mkdirSync(labDir, { recursive: true });
    await withBrowser({ root: LAB, entry: 'd018s.html', overlay: { 'd018s.html': copy }, port: 8433, width: 800, height: 600, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d018', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      await open('');
      const urls = await page.evaluate('__d018()');
      urls.forEach((u, v) => fs.writeFileSync(path.join(labDir, `d018_v${v}_2d.png`), Buffer.from(u.split(',')[1], 'base64')));
      console.log(`實驗線 2D：SPR.park ${urls.length} 張`);
    });
  } else console.log(`（${path.relative(ROOT, LAB)} 沒有實驗線，2D 那一欄留白）`);
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    await open('sample=seed516&clean=1');
    const r = await page.evaluate(`__gt.loadCode(${JSON.stringify(code)})`);
    if (!r.ok) throw new Error('3D 讀不進測試城');
    for (const [v, [x, z]] of spots.entries()) {
      await page.evaluate(`(__gt.view(${x + .5}, ${z + .5}, 18), __gt.setVisT(2.2), 1)`); await new Promise(res => setTimeout(res, 250));
      const s = await page.send('Page.captureScreenshot', { format: 'png', clip: { x: 490, y: 250, width: 300, height: 300, scale: 1 } });
      fs.writeFileSync(path.join(out, `d018_v${v}_3d.png`), Buffer.from(s.data, 'base64'));
    }
    await open('sample=ai120&clean=1');
    const parks = await page.evaluate('__gt.conBuildings().filter(b=>b.k===4&&!b.gone)');
    let best = parks[0], bn = -1;
    for (const p of parks) { const c = parks.filter(q => Math.abs(q.x - p.x) <= 6 && Math.abs(q.z - p.z) <= 6).length; if (c > bn) { bn = c; best = p; } }
    await page.evaluate(`(__gt.view(${best.x + .5}, ${best.z + .5}, 3.4), __gt.setVisT(2.2), 1)`); await new Promise(res => setTimeout(res, 300));
    await save(page, 'd018_ai120');
    console.log(`AI 城 120 天：公園 ${parks.length} 座，畫面中央 (${best.x},${best.z}) 附近 ${bn} 座`);
    errors += page.errors.length;
  });
  const copy2d = f => { const src = path.join(labDir, f), has = fs.existsSync(src); if (has) fs.copyFileSync(src, path.join(out, f)); return has ? f : ''; };
  const NAMES = ['石徑、長椅、花', '石徑', '池塘', '噴泉廣場', '玫瑰園', '遊樂場', '涼亭', '球場', '野餐區'];
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}`;
  fs.writeFileSync(path.join(out, 'd018_compare.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(3,576px);gap:14px;padding:8px 12px 12px}.pair{display:flex;gap:8px;align-items:flex-end}
    .pair img.a{width:256px;height:224px;image-rendering:pixelated;background:#0b1020}.pair img.b{width:300px;height:300px}.big{grid-column:1/-1}.big img{width:1280px;height:800px}</style>
    <h1>D018 公園九種：左 2D 實驗線精靈（SPR.park，放大 4 倍）｜右 3D</h1><p class="s">實驗線 d23c18d 放公園時抽 ri(9) 決定變體（51667）；D018 之前 3D 九種都畫成同一個樣子（沙地十字路＋三棵樹）。3D 拉近到 18 倍、畫面中央 300×300。最後一張是 AI 城 120 天公園最密的一帶（3.4 倍）。</p>
    <div class="g">${NAMES.map((nm, v) => { const a = copy2d(`d018_v${v}_2d.png`); return `<figure><figcaption>v${v}・${nm}</figcaption><div class="pair">${a ? `<img class="a" src="${a}">` : '<div>（沒有 2D）</div>'}<img class="b" src="d018_v${v}_3d.png"></div></figure>`; }).join('')}
    <figure class="big"><figcaption>AI 城 120 天（3D）</figcaption><img src="d018_ai120.png"></figure></div>`);
  for (const [page0, file, w, h] of [['d018_compare.html', 'D018-parks.jpg', 1790, 2000]]) {
    await withBrowser({ root: out, entry: page0, width: w, height: h, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page0}` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: ch, deviceScaleFactor: 1, mobile: false });
      await new Promise(r => setTimeout(r, 300));
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(out, file), Buffer.from(shot.data, 'base64'));
      console.log('OK', file, `${w}×${ch}`);
    });
  }
}

// D020：垃圾。同一串操作（D011 的 A 段＋主街旁邊一格貼路的空地蓋一座垃圾場，種子 5162026）在實驗線 2D 與本線 3D 各跑一次：蓋下去那天、20 天之後。
// 手機：「公共設施」一組選垃圾場（兩排七個）、住宅建築卡的「清運」一列。2D 要實驗線（--lab），沒有就只拍 3D
if (want('d020')) {
  const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), LAB = path.resolve(ROOT, arg('lab', '../GlimmerTown-lab')), labDir = path.join(ROOT, 'scratch/lab');
  const { decodeLabCode } = await import('../src/io/labcode.ts'), { d016Ops } = await import('./d016-ops.mjs'), { loadCode } = await import('../src/io/save.ts');
  const { kindTableFrom } = await import('../src/content/kindTable.ts'), { harness } = await import('./d011-parity-lib.mjs');
  const code = codeWithSeed(R('src/content/samples/newcity.code.txt').trim(), 5162026), S = decodeLabCode(code).save, lay = k => Uint8Array.from(S.layers[k] ?? '', ch => ch.charCodeAt(0) - 48);
  const o16 = d016Ops(S.n, lay('ter'), lay('el'), lay('tre')), X = o16.site.x0, Z = o16.site.z0, n = S.n;
  // 垃圾場的位置：本線照 A 段做完之後，離主街西端 (X−1, Z+5) 最近、四鄰有路的空地（陸地、沒路、沒建築、沒分區）
  const KT = kindTableFrom(JSON.parse(R('src/content/lab-kinds.json'))), vrank = JSON.parse(R('src/content/samples/d009-live.json')).vrank;
  const s0 = loadCode(code, KT, vrank).sim; harness(s0).batch(o16.A);
  const T = s0.w.tiles; let spot = null, best = 1e9;
  for (let i = 0; i < n * n; i++) {
    const t = T[i], x = i % n, z = (i / n) | 0; if (!(t.t === 1 || t.t === 2) || t.road || t.bld || t.zone) continue;
    if (![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dz]) => T[(z + dz) * n + x + dx]?.road && x + dx >= 0 && x + dx < n)) continue;
    const d = Math.abs(x - (X - 1)) + Math.abs(z - (Z + 5)); if (d < best) { best = d; spot = [x, z]; }
  }
  if (!spot) throw new Error('D020 樣張：找不到貼路的空地');
  const G = [{ k: 'money', v: 20000 }, { k: 'tap', tool: 'dump', x: spot[0], z: spot[1] }];
  const all = [...o16.A, ...G], CX = spot[0] + 4.5, CZ = spot[1] + .5;   // 垃圾場在畫面左邊一點、主街的住宅在右邊
  if (fs.existsSync(path.join(LAB, 'index.html'))) {
    const { CONFIGS, preloadOf, injectLab } = await import('./lab-configs.mjs');
    const EX = `window.__d020s={tap:(id,x,y)=>{tool=id;openUndo();paintLast=null;paintTo(x,y);closeUndo();paintLast=null;},
  line:(id,x0,y0,x1,y1)=>{tool=id;roadDraft436={x0,y0,x1,y1,active:true};commitRoadDraft436();roadDraft436=null;},
  rect:(id,x0,y0,x1,y1,now)=>{tool=id;rect.x0=x0;rect.y0=y0;rect.x1=x1;rect.y1=y1;performance.now=()=>now;try{commitRect();}finally{delete performance.now;}},setMoney:v=>{money=v;},setTool:v=>{tool=v;}};`;
    const copy = injectLab(fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), EX);
    fs.mkdirSync(labDir, { recursive: true });
    await withBrowser({ root: LAB, entry: 'd020s.html', overlay: { 'd020s.html': copy }, port: 8433, width: 1280, height: 800, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d020s', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      await open('');
      const shot = `(()=>{__d020s.setTool('pan');GV.lookAt(${CX},${CZ});GV.art574.zoom574(1.5);GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();GV.forceDraw();return document.getElementById('game').toDataURL('image/png');})()`;
      const png = url => Buffer.from(url.split(',')[1], 'base64');
      await page.evaluate(`(()=>{GV.setMapSize(72);GV.newWorldSeeded(777);if(!GV.importCode(${JSON.stringify(code)}))throw new Error('import');GV.setSpeed(0);GV.ai(false);let clock=0;
        for(const o of ${JSON.stringify(all)}){clock+=o.gap??10000;if(o.k==='money'){__d020s.setMoney(o.v);continue;}if(o.k==='undo'){GV.undo();continue;}if(o.k==='seed'||o.k==='pick')continue;
          const c=o.k==='tap'?[o.x,o.z,o.x,o.z]:[o.x0,o.z0,o.x1,o.z1];if(o.k==='tap')__d020s.tap(o.tool,c[0],c[1]);else if(o.k==='line')__d020s.line(o.tool,c[0],c[1],c[2],c[3]);else __d020s.rect(o.tool,c[0],c[1],c[2],c[3],clock);}return 1;})()`);
      fs.writeFileSync(path.join(labDir, 'd020_day0_2d.png'), png(await page.evaluate(shot)));
      for (let d = 0; d < 20; d++) await page.evaluate('GV.step(1)');
      fs.writeFileSync(path.join(labDir, 'd020_day20_2d.png'), png(await page.evaluate(shot)));
      console.log('實驗線 2D：d020_day0_2d.png、d020_day20_2d.png');
      errors += page.errors.filter(e => !/manifest|service ?worker|favicon/i.test(e)).length;
    });
  } else console.log(`（${path.relative(ROOT, LAB)} 沒有實驗線，2D 那一欄留白）`);
  const apply3d = async page => { for (const o of all) { if (o.k === 'pick') continue; await page.evaluate(js(toOp(o))); } };
  await withBrowser({ width: 1280, height: 800 }, async ({ open, page }) => {
    await fresh(open, page, 'clean=1');
    await apply3d(page);
    await page.evaluate(`(__gt.view(${CX}, ${CZ}, 4.8), __gt.setVisT(2.2), 1)`); await new Promise(res => setTimeout(res, 300)); await save(page, 'd020_day0_3d');
    await page.evaluate('(__gt.simStep(20), 1)');
    await page.evaluate(`(__gt.view(${CX}, ${CZ}, 4.8), __gt.setVisT(2.2), 1)`); await new Promise(res => setTimeout(res, 300)); await save(page, 'd020_day20_3d');
    errors += page.errors.length;
  });
  // 手機：「公共設施」一組選垃圾場；放下工具點離垃圾場最近的一棟住宅
  await withBrowser({ width: 360, height: 740 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 2, mobile: true });
    await fresh(open, page, '');
    await apply3d(page);
    await page.evaluate(`(__gt.simStep(20), __gt.view(${spot[0] + .5}, ${spot[1] + .5}, 4.2), __gt.setVisT(2.2), __gt.tool('civic','dump'), 1)`);
    await new Promise(res => setTimeout(res, 3200)); await save(page, 'd020_mob_menu');
    const home = await page.evaluate(`(()=>{let b0=null,d0=1e9;for(const b of __gt.conBuildings()){if(b.gone||b.k!==1)continue;const d=Math.abs(b.x-${spot[0]})+Math.abs(b.z-${spot[1]});if(d<d0){d0=d;b0=[b.x,b.z];}}return b0;})()`);
    if (home) await page.evaluate(`(__gt.tool(null), __gt.openTile(${home[0]}, ${home[1]}), 1)`);
    await new Promise(res => setTimeout(res, 400)); await save(page, 'd020_mob_card');
    errors += page.errors.length;
  });
  const copy2d = f => { const src = path.join(labDir, f), has = fs.existsSync(src); if (has) fs.copyFileSync(src, path.join(out, f)); return has ? f : ''; };
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}`;
  const cell = (src, cap, cls = '') => `<figure><figcaption>${cap}</figcaption>${src ? `<img class="${cls}" src="${src}">` : `<div class="none ${cls}">（沒有這一格的圖）</div>`}</figure>`;
  fs.writeFileSync(path.join(out, 'd020_compare.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(2,800px);gap:10px;padding:8px 12px 12px}img,.none{display:block;width:800px;height:480px;object-fit:none;object-position:50% 50%}.none{background:#222a44;display:flex;align-items:center;justify-content:center}</style>
    <h1>D020 垃圾：同一串操作（D011 A 段＋主街西端旁邊 (${spot}) 一座貼路的垃圾場，種子 5162026），2D 實驗線｜3D</h1><p class="s">垃圾場 k 8 的造型是 D007 的（這一張卡不改造型）。沒有垃圾場時每一棟住宅都扣全城懲罰與「離垃圾場太遠」；蓋了之後住宅不再扣，兩邊的城市幸福都跟著變高。2D 那一欄是實驗線 d23c18d 自己跑同一串（兩邊整城第 2 天起分岔，住商工的棟數本來就不同）。畫面中央 800×480、1:1。</p>
    <div class="g">${cell(copy2d('d020_day0_2d.png'), '蓋下去那天・2D 實驗線')}${cell('d020_day0_3d.png', '蓋下去那天・3D')}${cell(copy2d('d020_day20_2d.png'), '20 天之後・2D 實驗線')}${cell('d020_day20_3d.png', '20 天之後・3D')}</div>`);
  fs.writeFileSync(path.join(out, 'd020_mobile.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}
    .g{display:grid;grid-template-columns:repeat(2,360px);gap:10px;padding:8px 12px 12px}img{display:block;width:360px;height:740px}</style>
    <h1>D020 手機 360×740</h1><p class="s">左：「公共設施」一組（13 種，兩排七個）選垃圾場；右：放下工具、點離垃圾場最近的住宅看建築卡的「清運」一列。</p>
    <div class="g">${cell('d020_mob_menu.png', '選垃圾場')}${cell('d020_mob_card.png', '建築卡：清運')}</div>`);
  for (const [page0, file, w, h] of [['d020_compare.html', 'D020-compare.jpg', 1640, 1200], ['d020_mobile.html', 'D020-mobile.jpg', 760, 900]]) {
    await withBrowser({ root: out, entry: page0, width: w, height: h, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
      await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page0}` });
      for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
      const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
      await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: ch, deviceScaleFactor: 1, mobile: false });
      await new Promise(r => setTimeout(r, 300));
      const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      fs.writeFileSync(path.join(out, file), Buffer.from(shot.data, 'base64'));
      console.log(`OK ${file}`);
    });
  }
}

// D020 補：起步城 8 種子 × 120 天的整城軌跡圖（實驗線｜D020 之前｜D020 之後；畫法與數字在 tools/chart-d020.mjs），存成 D020-trajectory.jpg。不需要實驗線（讀存下的 d010-lab.json）
if (set === 'd020-traj') {   // 只在明講要它時才跑（不進 all）：要用 git 裡的 D020 之前的樣本，CI 只拉最新一個提交拿不到
  const { d020Data, d020Svg } = await import('./chart-d020.mjs');
  const data = d020Data(arg('base', '63ebc81'));
  fs.writeFileSync(path.join(out, 'd020_traj.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a19}svg{display:block}</style>${d020Svg(data)}`);
  await withBrowser({ root: out, entry: 'd020_traj.html', width: 1600, height: 1300, ready: `!!document.querySelector('svg')`, settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d020_traj.html` });
    for (let i = 0; i < 60 && !(await page.evaluate(`!!document.querySelector('svg')`).catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.documentElement.getBoundingClientRect().height)`);
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1600, height: ch, scale: 1 } });   // 用 clip 截整頁：headless 改視窗大小後偶爾只重畫上半截
    fs.writeFileSync(path.join(out, 'D020-trajectory.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D020-trajectory.jpg', `1600×${ch}`);
  });
}

if (set === 'd022') {   // 只在明講要它時才跑（不進 all）：手機上住宅的建築卡多一列「糧食」——起步城（供糧率低、幸福減）與 AI 城 120 天當成「我的城」（供糧率 100%、幸福加）
  const ai = fs.readFileSync(path.join(ROOT, 'src/content/samples/ai120.code.txt'), 'utf8').trim();
  const homeOf = `(()=>{const h=__gt.conBuildings().filter(b=>!b.gone&&b.k===1);return h.length?[h[0].x,h[0].z]:null;})()`;
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 2, mobile: true });
    await open('sample=starter');
    await page.evaluate('(__gt.simStep(30), 1)');
    let h = await page.evaluate(homeOf);
    await page.evaluate(`(__gt.view(${h[0] + .5}, ${h[1] + .5}, 4.2), __gt.setVisT(2.2), __gt.openTile(${h[0]}, ${h[1]}), 1)`);
    await new Promise(res => setTimeout(res, 900)); await save(page, 'd022_mob_starter');
    await open('sample=seed516&clean=1'); await page.evaluate('__gt.clearSave()');   // clean=1 的頁面離開時不自動存檔，塞進去的存檔才不會被蓋掉（同 tools/smoke-d021.mjs）
    await page.evaluate(`localStorage.setItem('gt3d.v1.save', ${JSON.stringify(ai)})`);
    await open('');
    await page.evaluate('(__gt.simStep(1), 1)');
    h = await page.evaluate(homeOf);
    await page.evaluate(`(__gt.view(${h[0] + .5}, ${h[1] + .5}, 4.2), __gt.setVisT(2.2), __gt.openTile(${h[0]}, ${h[1]}), 1)`);
    await new Promise(res => setTimeout(res, 900)); await save(page, 'd022_mob_ai');
    errors += page.errors.length;
  });
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}.g{display:grid;grid-template-columns:repeat(2,412px);gap:10px;padding:8px 12px 12px}img{display:block;width:412px;height:860px}`;
  fs.writeFileSync(path.join(out, 'd022_mobile.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}</style><h1>D022 手機 412×860：住宅的建築卡多一列「糧食」</h1><p class="s">左：起步城推進 30 天（沒有農場、進口額度 3，供糧率低、每天幸福減）；右：AI 城 120 天當成「我的城」讀進來推進一天（食物 121 ≥ 需求 112，供糧率 100%、每天幸福 +5.0）。</p>
    <div class="g"><figure><figcaption>起步城・第 31 天</figcaption><img src="d022_mob_starter.png"></figure><figure><figcaption>AI 城 120 天・推進一天</figcaption><img src="d022_mob_ai.png"></figure></div>`);
  await withBrowser({ root: out, entry: 'd022_mobile.html', width: 880, height: 960, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d022_mobile.html` });
    for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 880, height: ch, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(out, 'D022-mobile.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D022-mobile.jpg');
  });
}

if (set === 'd022-traj') {   // 只在明講要它時才跑（不進 all）：D022 之前的樣本取自 git（D021 收尾 4f389ce），CI 只拉最新一個提交拿不到
  const { d020Data, d020Svg } = await import('./chart-d020.mjs');
  const data = d020Data(arg('base', '4f389ce'));
  const svg = d020Svg(data, { title: 'D022 糧食接上之後，起步城的整城軌跡離實驗線多近', before: '本線 D022 之前（D021 收尾）', after: '本線 D022 之後',
    beforeSrc: 'D022 之前＝git {base} 的 d010-3d.json', afterSrc: 'D022 之後＝現在的 src 現算', doc: 'docs/D022-food.md',
    foot: '前 60 天幸福的差縮小（糧食單日算式跟實驗線逐位相等）；第 121 天拉開：本線平均 59.5% 的住宅沒電（幸福 .065，有電的 .378），實驗線的城只長 54 棟、幾乎都有電。數字表見 {doc}。' });
  fs.writeFileSync(path.join(out, 'd022_traj.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a19}svg{display:block}</style>${svg}`);
  await withBrowser({ root: out, entry: 'd022_traj.html', width: 1600, height: 1300, ready: `!!document.querySelector('svg')`, settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d022_traj.html` });
    for (let i = 0; i < 60 && !(await page.evaluate(`!!document.querySelector('svg')`).catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.documentElement.getBoundingClientRect().height)`);
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1600, height: ch, scale: 1 } });   // 用 clip 截整頁：headless 改視窗大小後偶爾只重畫上半截
    fs.writeFileSync(path.join(out, 'D022-trajectory.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D022-trajectory.jpg', `1600×${ch}`);
  });
}

if (set === 'd025') {   // 只在明講要它時才跑（不進 all）：手機上商業與工業的建築卡多一列「市場」——種子城（商業卡：購買力、零售利用率、銷售乘數）與 D025 自造城 G2（工業卡：市場乘數、貨物庫存、原料）當成「我的城」讀進來推進一天
  const seedCity = fs.readFileSync(path.join(ROOT, 'src/content/samples/seed516.code.txt'), 'utf8').trim();   // AI 城沒有商業建築，商業卡用種子城（商業 377 棟）
  const { cities25 } = await import('./d025-cities.mjs'), { kindTableFrom } = await import('../src/content/kindTable.ts');
  const g2 = cities25(fs.readFileSync(path.join(ROOT, 'src/content/samples/newcity.code.txt'), 'utf8'), kindTableFrom(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/lab-kinds.json'), 'utf8')))).find(c => c.id === 'G2').code;
  const pickOf = k => `(()=>{const h=__gt.conBuildings().filter(b=>!b.gone&&b.k===${k});return h.length?[h[0].x,h[0].z]:null;})()`;
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 2, mobile: true });
    for (const [code, k, file] of [[seedCity, 2, 'd025_mob_com'], [g2, 3, 'd025_mob_ind']]) {
      await open('sample=seed516&clean=1'); await page.evaluate('__gt.clearSave()');   // clean=1 的頁面離開時不自動存檔，塞進去的存檔才不會被蓋掉（同 tools/smoke-d021.mjs）
      await page.evaluate(`localStorage.setItem('gt3d.v1.save', ${JSON.stringify(code)})`);
      await open('');
      await page.evaluate('(__gt.simStep(1), 1)');
      const h = await page.evaluate(pickOf(k));
      await page.evaluate(`(__gt.view(${h[0] + .5}, ${h[1] + .5}, 4.2), __gt.setVisT(2.2), __gt.openTile(${h[0]}, ${h[1]}), 1)`);
      await new Promise(res => setTimeout(res, 900)); await save(page, file);
    }
    errors += page.errors.length;
  });
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}.g{display:grid;grid-template-columns:repeat(2,412px);gap:10px;padding:8px 12px 12px}img{display:block;width:412px;height:860px}`;
  fs.writeFileSync(path.join(out, 'd025_mobile.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}</style><h1>D025 手機 412×860：商業與工業的建築卡多一列「市場」</h1><p class="s">左：種子城當成「我的城」讀進來推進一天，商業卡（購買力、零售利用率、貨物需求的本地與進口、銷售乘數）；右：D025 自造城 G2（貨物生產與出口），工業卡（市場乘數、缺貨、貨物庫存、原料）。</p>
    <div class="g"><figure><figcaption>種子城・商業建築</figcaption><img src="d025_mob_com.png"></figure><figure><figcaption>自造城 G2・工業建築</figcaption><img src="d025_mob_ind.png"></figure></div>`);
  await withBrowser({ root: out, entry: 'd025_mobile.html', width: 880, height: 960, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d025_mobile.html` });
    for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 880, height: ch, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(out, 'D025-mobile.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D025-mobile.jpg');
  });
}

if (set === 'd025-traj') {   // 只在明講要它時才跑（不進 all）：D025 之前的樣本取自 git（D024 施工 e7cc3fb），CI 只拉最新一個提交拿不到
  const { d020Data, d020Svg } = await import('./chart-d020.mjs');
  const data = d020Data(arg('base', 'e7cc3fb'));
  const svg = d020Svg(data, { title: 'D025 經濟接上之後，起步城的整城軌跡離實驗線多近', before: '本線 D025 之前（D024 施工）', after: '本線 D025 之後',
    beforeSrc: 'D025 之前＝git {base} 的 d010-3d.json', afterSrc: 'D025 之後＝現在的 src 現算', doc: 'docs/D025-economy.md',
    foot: '商業與工業需求從 +1.000 落到實驗線的停長帶（−0.78、−0.235），人口的差縮到 1 人；就業、工業棟數、幸福剩的差（幸福反而變大）推測來自本線沒搬的火災、疾病、死亡、廢棄、犯罪與壅堵，沒有逐項量過。數字表見 {doc}。' });
  fs.writeFileSync(path.join(out, 'd025_traj.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a19}svg{display:block}</style>${svg}`);
  await withBrowser({ root: out, entry: 'd025_traj.html', width: 1600, height: 1300, ready: `!!document.querySelector('svg')`, settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d025_traj.html` });
    for (let i = 0; i < 60 && !(await page.evaluate(`!!document.querySelector('svg')`).catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.documentElement.getBoundingClientRect().height)`);
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1600, height: ch, scale: 1 } });   // 用 clip 截整頁：headless 改視窗大小後偶爾只重畫上半截
    fs.writeFileSync(path.join(out, 'D025-trajectory.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D025-trajectory.jpg', `1600×${ch}`);
  });
}

if (set === 'd026') {   // 只在明講要它時才跑（不進 all）：手機上的災禍——燃燒的工業（卡：燃燒中＋滅火鈕、頭上有寶石）、焦土（地面炭黑、卡講原因）、生病與死亡的住宅（寶石＋治療鈕）
  const { smallCity } = await import('./smoke-d026.mjs'), { cities26 } = await import('./d026-cities.mjs'), { kindTableFrom } = await import('../src/content/kindTable.ts'), { decodeLabCode } = await import('../src/io/labcode.ts');
  const newcity = fs.readFileSync(path.join(ROOT, 'src/content/samples/newcity.code.txt'), 'utf8'), KT = kindTableFrom(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/lab-kinds.json'), 'utf8')));
  const small = smallCity(decodeLabCode(newcity.trim()).save.raw, k => KT.size(k)), h9 = cities26(newcity, KT).find(c => c.id === 'H9').code, h4 = cities26(newcity, KT).find(c => c.id === 'H4').code;
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 2, mobile: true });
    // [碼, 推進幾天, 鏡頭 x, z, 縮放, 卡開在哪一格, 檔名]：小城（第 0 天）看燃燒的工業與寶石；H9 推一天看焦土；H4 推一天看病與死亡
    for (const [code, days, vx, vz, zoom, tile, file] of [[small, 0, 13, 31, 5.2, [10, 29], 'd026_mob_fire'], [h9, 1, 50, 42, 3.4, [50, 40], 'd026_mob_ruin'], [h4, 1, 30, 46, 3.6, null, 'd026_mob_sick']]) {
      await open('sample=seed516&clean=1'); await page.evaluate('__gt.clearSave()');
      await page.evaluate(`localStorage.setItem('gt3d.v1.save', ${JSON.stringify(code)})`);
      await open('');
      if (days) await page.evaluate(`(__gt.simStep(${days}), 1)`);
      let t = tile;
      if (!t) { const f = await page.evaluate(`(()=>{const o=__gt.conBuildings().filter(b=>!b.gone&&b.k===1).map(b=>[b.x,b.z,__gt.flags(b.x,b.z)]).filter(q=>q[2]&&(q[2].sick||q[2].death));return o.length?o.find(q=>q[2].sick)||o[0]:null;})()`); t = f ? [f[0], f[1]] : [30, 46]; }
      await page.evaluate(`(__gt.view(${vx + .5}, ${vz + .5}, ${zoom}), __gt.setVisT(2.2), __gt.openTile(${t[0]}, ${t[1]}), 1)`);
      await new Promise(res => setTimeout(res, 900)); await save(page, file);
    }
    errors += page.errors.length;
  });
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}.g{display:grid;grid-template-columns:repeat(3,412px);gap:10px;padding:10px 12px}img{width:412px;display:block;border-radius:8px}`;
  fs.writeFileSync(path.join(out, 'd026_mobile.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}</style><h1>D026 手機 412×860：每日災禍</h1><p class="s">左：燃燒中的工業（第 2 天）——卡上有「🔥 燃燒中」與 [🧯 滅火 $30]，附近的建築頭上有寶石（橘＝火、黃＝犯罪、紅＝生病、灰＝死亡、褐＝廢棄）；中：H9 推進一天，燒毀的建築留下炭黑的焦土（地面貼圖，不佔 draw call），點焦土講原因；右：H4（住宅密集、只有幾座診所）推進一天，生病與死亡中的住宅。全部程式生成、沒有外部素材。</p>
    <div class="g"><figure><figcaption>燃燒中的工業</figcaption><img src="d026_mob_fire.png"></figure><figure><figcaption>焦土</figcaption><img src="d026_mob_ruin.png"></figure><figure><figcaption>生病與死亡的住宅</figcaption><img src="d026_mob_sick.png"></figure></div>`);
  await withBrowser({ root: out, entry: 'd026_mobile.html', width: 1300, height: 960, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d026_mobile.html` });
    for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 1300, height: ch, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(out, 'D026-mobile.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D026-mobile.jpg');
  });
}

if (set === 'd026-traj') {   // 只在明講要它時才跑（不進 all）：D026 之前的樣本取自 git（D025 收工 3ecba50），CI 只拉最新一個提交拿不到
  const { d020Data, d020Svg } = await import('./chart-d020.mjs');
  const data = d020Data(arg('base', '3ecba50'));
  const svg = d020Svg(data, { title: 'D026 每日災禍接上之後，起步城的整城軌跡離實驗線多近', before: '本線 D026 之前（D025 收工）', after: '本線 D026 之後',
    beforeSrc: 'D026 之前＝git {base} 的 d010-3d.json', afterSrc: 'D026 之後＝現在的 src 現算', doc: 'docs/D026-hazards.md',
    foot: '起火、燒毀、生病、死亡接上之後：工業棟數往實驗線靠（第 121 列 30.9→19.5，實驗線 22.1；全程平均差 3.4→1.9）、人口第 121 列差 0.9→0.0；就業第 121 列由高 8.8 變成低 7.0（實驗線 99.5，本線 92.5；全程平均差 7.1→4.3）。\n幸福沒有實質縮小（全程平均差 .072→.067，第 121 列 .071→.084，實驗線種子間 sd .022）——幸福還缺通勤與壅堵、夜間城市、政策等項，D027 起才搬。數字表見 {doc}。' });
  fs.writeFileSync(path.join(out, 'd026_traj.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a19}svg{display:block}</style>${svg}`);
  await withBrowser({ root: out, entry: 'd026_traj.html', width: 1600, height: 1300, ready: `!!document.querySelector('svg')`, settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d026_traj.html` });
    for (let i = 0; i < 60 && !(await page.evaluate(`!!document.querySelector('svg')`).catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.documentElement.getBoundingClientRect().height)`);
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1600, height: ch, scale: 1 } });
    fs.writeFileSync(path.join(out, 'D026-trajectory.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D026-trajectory.jpg', `1600×${ch}`);
  });
}

if (set === 'd027') {   // 只在明講要它時才跑（不進 all）：手機上的通勤與壅堵——過載道路的暖色（俯瞰）、過載路格的卡、住宅卡的通勤與壅堵、☰「幸福構成」
  const { cities27 } = await import('./d027-cities.mjs'), { kindTableFrom } = await import('../src/content/kindTable.ts');
  const newcity = fs.readFileSync(path.join(ROOT, 'src/content/samples/newcity.code.txt'), 'utf8'), KT = kindTableFrom(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/lab-kinds.json'), 'utf8')));
  const j1 = cities27(newcity, KT).find(c => c.id === 'J1').code;
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 2, mobile: true });
    const fresh = async code => { await open('sample=seed516&clean=1'); await page.evaluate('__gt.clearSave()'); await page.evaluate(`localStorage.setItem('gt3d.v1.save', ${JSON.stringify(code)})`); await open(''); };
    const pause = ms => new Promise(res => setTimeout(res, ms));
    // 1 俯瞰：J1 推 12 天，整條 2 級路上近工業那一段的暖色（黃到紅）；2 過載路格的卡（負載最大的那一格）；3 靠近工業的住宅卡（通勤不扣分、附近路格過載）；4 離工業最遠的住宅卡（通勤封頂）
    await fresh(j1);
    await page.evaluate('(__gt.simStep(12), 1)');
    const tr = await page.evaluate('__gt.traffic()'), worst = tr.cells.reduce((a, c) => c[1] / c[2] > a[1] / a[2] ? c : a), wx = worst[0] % 72, wz = (worst[0] / 72) | 0;
    await page.evaluate(`(__gt.view(40.5, 30.5, 2.4), __gt.setVisT(2.2), 1)`); await pause(900); await save(page, 'd027_mob_over');
    await page.evaluate(`(__gt.view(${wx + .5}, ${wz + .5}, 5.2), __gt.openTile(${wx}, ${wz}), 1)`); await pause(900); await save(page, 'd027_mob_road');
    await page.evaluate(`(__gt.view(58.5, 31.5, 5.2), __gt.openTile(58, 31), 1)`); await pause(900); await save(page, 'd027_mob_house');
    await page.evaluate(`(__gt.view(6.5, 31.5, 5.2), __gt.openTile(6, 31), 1)`); await pause(900); await save(page, 'd027_mob_far');
    // 5 ☰「幸福構成」：起步城推 40 天
    await open('sample=starter'); await page.evaluate('(__gt.simStep(40), 1)');
    await page.evaluate(`(__gt.menu('happy'), 1)`); await pause(900); await save(page, 'd027_mob_happy');
    errors += page.errors.length;
  });
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}.g{display:grid;grid-template-columns:repeat(5,412px);gap:10px;padding:10px 12px}img{width:412px;display:block;border-radius:8px}`;
  fs.writeFileSync(path.join(out, 'd027_mobile.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}</style><h1>D027 手機 412×860：通勤與壅堵</h1><p class="s">J1（一條 2 級路、十四個叢集的通勤路徑全擠在同一條路上）推進 12 天。①俯瞰：過載的路格疊暖色（黃到紅，實驗線 60574 的公式，地面貼圖上、不佔 draw call）；②負載最大的一格的卡：「交通 負載／容量（比例）——過載」；③靠近工業的住宅：通勤沒扣、「交通壅堵」半徑 2 格內 5 格過載道路、幸福 −15.0（上限）；④離工業最遠的住宅：「通勤」封頂 −18.0、附近的路沒過載；⑤☰「幸福構成」（起步城第 40 天）：城市平均每一項幸福，最負的一項標紅並附建議。全部程式生成、沒有外部素材。</p>
    <div class="g"><figure><figcaption>① 過載的道路</figcaption><img src="d027_mob_over.png"></figure><figure><figcaption>② 過載路格的卡</figcaption><img src="d027_mob_road.png"></figure><figure><figcaption>③ 靠近工業的住宅</figcaption><img src="d027_mob_house.png"></figure><figure><figcaption>④ 離工業最遠的住宅</figcaption><img src="d027_mob_far.png"></figure><figure><figcaption>⑤ 幸福構成</figcaption><img src="d027_mob_happy.png"></figure></div>`);
  await withBrowser({ root: out, entry: 'd027_mobile.html', width: 2200, height: 960, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d027_mobile.html` });
    for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 2200, height: ch, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(out, 'D027-mobile.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D027-mobile.jpg');
  });
}

if (set === 'd027-traj') {   // 只在明講要它時才跑（不進 all）：D027 之前的樣本取自 git（D026 收工 44e2e73），CI 只拉最新一個提交拿不到。foot 的數字由資料現算（不手打）
  const { d020Data, d020Svg } = await import('./chart-d020.mjs');
  const base = arg('base', '44e2e73'), data = d020Data(base), g = f => data.gap[f], n3 = v => v.toFixed(3), n1 = v => v.toFixed(1);
  const foot = `通勤與壅堵接上之後：幸福度第 121 列與實驗線的差 ${n3(g('happy').before.d121)}→${n3(g('happy').after.d121)}（全程平均差 ${n3(g('happy').before.all)}→${n3(g('happy').after.all)}，實驗線種子間 sd ${n3(data.labSd.happy)}）——D026 收工時最大的一項差（.084，t＝5.75）收進種子間的散布裡；\n人口 ${n1(g('pop').before.d121)}→${n1(g('pop').after.d121)}、就業 ${n1(g('jobs').before.d121)}→${n1(g('jobs').after.d121)}、住宅棟數 ${n1(g('R').before.d121)}→${n1(g('R').after.d121)}、工業棟數 ${n1(g('I').before.d121)}→${n1(g('I').after.d121)}（第 121 列的差）。剩下的幸福差是夜間城市（本線沒搬，實驗線每棟住宅平均 −.003）。數字表見 {doc}。`;
  const svg = d020Svg(data, { title: 'D027 通勤與壅堵接上之後，起步城的整城軌跡離實驗線多近', before: '本線 D027 之前（D026 收工）', after: '本線 D027 之後',
    beforeSrc: 'D027 之前＝git {base} 的 d010-3d.json', afterSrc: 'D027 之後＝現在的 src 現算', doc: 'docs/D027-traffic.md', foot });
  fs.writeFileSync(path.join(out, 'd027_traj.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a19}svg{display:block}</style>${svg}`);
  await withBrowser({ root: out, entry: 'd027_traj.html', width: 1600, height: 1300, ready: `!!document.querySelector('svg')`, settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d027_traj.html` });
    for (let i = 0; i < 60 && !(await page.evaluate(`!!document.querySelector('svg')`).catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.documentElement.getBoundingClientRect().height)`);
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1600, height: ch, scale: 1 } });
    fs.writeFileSync(path.join(out, 'D027-trajectory.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D027-trajectory.jpg', `1600×${ch}`);
  });
}

if (set === 'd028') {   // 只在明講要它時才跑（不進 all）：手機上的經濟（二）——農場卡的「化肥」（覆蓋內、覆蓋外、化肥廠沒有天然氣）、中央廚房卡的「天然氣」、☰「收支明細」
  const { cities28 } = await import('./d028-cities.mjs'), { kindTableFrom } = await import('../src/content/kindTable.ts');
  const newcity = fs.readFileSync(path.join(ROOT, 'src/content/samples/newcity.code.txt'), 'utf8'), KT = kindTableFrom(JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/lab-kinds.json'), 'utf8')));
  const cs = cities28(newcity, KT), code = id => cs.find(c => c.id === id).code;
  await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
    await page.send('Emulation.setDeviceMetricsOverride', { width: 412, height: 860, deviceScaleFactor: 2, mobile: true });
    const fresh = async c => { await open('sample=seed516&clean=1'); await page.evaluate('__gt.clearSave()'); await page.evaluate(`localStorage.setItem('gt3d.v1.save', ${JSON.stringify(c)})`); await open(''); };
    const pause = ms => new Promise(res => setTimeout(res, ms));
    // 1 K1 覆蓋內的農場 (24,28)；2 K1 覆蓋外的農場 (56,28)；3 K2 覆蓋內但化肥廠沒有天然氣 (22,32)；4 K3 中央廚房 (20,28)；5 K4 ☰「收支明細」
    await fresh(code('K1')); await page.evaluate('(__gt.simStep(2), 1)');
    await page.evaluate(`(__gt.view(26.5, 29.5, 4.6), __gt.openTile(24, 28), 1)`); await pause(900); await save(page, 'd028_mob_farm_in');
    await page.evaluate(`(__gt.view(56.5, 29.5, 4.6), __gt.openTile(56, 28), 1)`); await pause(900); await save(page, 'd028_mob_farm_out');
    await fresh(code('K2')); await page.evaluate('(__gt.simStep(2), 1)');
    await page.evaluate(`(__gt.view(20.5, 30.5, 4.0), __gt.openTile(22, 32), 1)`); await pause(900); await save(page, 'd028_mob_farm_nogas');
    await fresh(code('K3')); await page.evaluate('(__gt.simStep(2), 1)');
    await page.evaluate(`(__gt.view(22.5, 29.5, 4.6), __gt.openTile(20, 28), 1)`); await pause(900); await save(page, 'd028_mob_kitchen');
    await fresh(code('K4')); await page.evaluate('(__gt.simStep(2), 1)');
    await page.evaluate(`(__gt.menu('fin'), 1)`); await pause(900); await save(page, 'd028_mob_fin');
    errors += page.errors.length;
  });
  const CSS = `body{margin:0;background:#0d1226;color:#eef1f7;font:14px system-ui,"Noto Sans CJK TC",sans-serif}h1{font-size:17px;margin:10px 12px 2px}p.s{margin:0 12px;color:#aab3c5;font-size:12px}figure{margin:0}figcaption{padding:4px 2px 5px;font-weight:600}.g{display:grid;grid-template-columns:repeat(5,412px);gap:10px;padding:10px 12px}img{width:412px;display:block;border-radius:8px}`;
  fs.writeFileSync(path.join(out, 'd028_mobile.html'), `<!doctype html><meta charset="utf-8"><style>${CSS}</style><h1>D028 手機 412×860：經濟（二）</h1><p class="s">①K1（化肥廠＋天然氣井）第 97 天：化肥廠覆蓋（半徑 10 格）內的農場卡多一列「化肥」——最近一天化肥廠有產出，下一天食物與金幣 ×1.35；②同一座城覆蓋外的農場：照常 ×1；③K2（化肥廠沒有天然氣，供氣率 0%）：覆蓋內的農場也不增產，卡上講原因；④K3 的中央廚房：「天然氣」列講全城供需與供氣率、熟食產出、下一天覆蓋內的住宅幸福 +3%；⑤K4（食物分配鏈）☰「收支明細」：住商工稅、每個非零的收入項、收入合計、維護費（其中進口費）、淨額、工資指數，都是最近一天的結算。全部程式生成、沒有外部素材。</p>
    <div class="g"><figure><figcaption>① 覆蓋內的農場</figcaption><img src="d028_mob_farm_in.png"></figure><figure><figcaption>② 覆蓋外的農場</figcaption><img src="d028_mob_farm_out.png"></figure><figure><figcaption>③ 化肥廠沒有天然氣</figcaption><img src="d028_mob_farm_nogas.png"></figure><figure><figcaption>④ 中央廚房</figcaption><img src="d028_mob_kitchen.png"></figure><figure><figcaption>⑤ 收支明細</figcaption><img src="d028_mob_fin.png"></figure></div>`);
  await withBrowser({ root: out, entry: 'd028_mobile.html', width: 2200, height: 960, ready: '[...document.images].every(i=>i.complete&&i.naturalWidth)', settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d028_mobile.html` });
    for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>0&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.querySelector('.g').getBoundingClientRect().bottom)`);
    await page.send('Emulation.setDeviceMetricsOverride', { width: 2200, height: ch, deviceScaleFactor: 1, mobile: false });
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(out, 'D028-mobile.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D028-mobile.jpg');
  });
}

if (set === 'd028-gap') {   // 只在明講要它時才跑（不進 all）：D027 收工的那棵樹取自 git（8b90d7d，開暫時的 worktree），CI 只拉最新一個提交拿不到
  const { d028GapData, d028GapSvg } = await import('./chart-d028.mjs');
  const data = await d028GapData(arg('base', '8b90d7d'));
  fs.writeFileSync(path.join(out, 'd028_gap.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#1a1a19}svg{display:block}</style>${d028GapSvg(data)}`);
  await withBrowser({ root: out, entry: 'd028_gap.html', width: 1600, height: 1250, ready: `!!document.querySelector('svg')`, settle: 200 }, async ({ page }) => {
    await page.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/d028_gap.html` });
    for (let i = 0; i < 60 && !(await page.evaluate(`!!document.querySelector('svg')`).catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const ch = await page.evaluate(`Math.ceil(document.documentElement.getBoundingClientRect().height)`);
    await new Promise(r => setTimeout(r, 300));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1600, height: ch, scale: 1 } });
    fs.writeFileSync(path.join(out, 'D028-income-gap.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK D028-income-gap.jpg', `1600×${ch}`);
  });
}

if (errors) process.exitCode = 1;

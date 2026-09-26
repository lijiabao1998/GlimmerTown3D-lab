// 拍樣張，存到 scratch/（不進版本庫）。
// 用法：node tools/shoot.mjs [--set=d001|timeline|bio|d003|d004|d005|d006|d007|d008|d010|all] [--seed=5162026] [--out=scratch/shots]
//   d001      三畫風 × 三年份 × 全景／近景（D001 對照）
//   timeline  畫風 A、對焦城心，第 0→300 年十格（D002）
//   bio       手機尺寸，第 300 年打開 (26,21) 的地塊履歷（D002）
//   d003      2D 城市模式：種子城全景／中景／遠景、AI 城中景、手機直式＋建築卡；
//             scratch/lab/ 有實驗線的 2D 樣張（tools/lab-extract.mjs 拍的）就再拼成 2D｜3D 並排對照
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser, ROOT } from './cdp.mjs';

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
  const n = await page.evaluate('__gt.openLot(26, 21)');
  await new Promise(r => setTimeout(r, 400));
  console.log(`   (26,21) 履歷 ${n} 筆`);
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
        await page.send('Page.navigate', { url: `http://127.0.0.1:8311/${name}_pair.html` });
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
      await page.send('Page.navigate', { url: `http://127.0.0.1:8311/d004_${view}_compare.html` });
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
      await page.send('Page.navigate', { url: `http://127.0.0.1:8311/d005_${name}_compare.html` });
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
      await page.send('Page.navigate', { url: `http://127.0.0.1:8311/d006_${name}_compare.html` });
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
      await page.send('Page.navigate', { url: `http://127.0.0.1:8311/sheet_${nm}.html` });
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
      await page.send('Page.navigate', { url: `http://127.0.0.1:8311/d008_${name}_compare.html` });
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
    await page.send('Page.navigate', { url: 'http://127.0.0.1:8311/d010_compare.html' });
    for (let i = 0; i < 60 && !(await page.evaluate('[...document.images].length>=4&&[...document.images].every(i=>i.complete&&i.naturalWidth)').catch(() => false)); i++) await new Promise(r => setTimeout(r, 100));
    const shot = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
    fs.writeFileSync(path.join(out, 'D010-compare.jpg'), Buffer.from(shot.data, 'base64'));
    console.log('OK', 'D010-compare.jpg');
  });
}

if (errors) process.exitCode = 1;

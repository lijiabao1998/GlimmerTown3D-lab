// 拍樣張，存到 scratch/（不進版本庫）。
// 用法：node tools/shoot.mjs [--set=d001|timeline|bio|all] [--seed=5162026] [--out=scratch/shots]
//   d001      三畫風 × 三年份 × 全景／近景（D001 對照）
//   timeline  畫風 A、對焦城心，第 0→300 年十格（D002）
//   bio       手機尺寸，第 300 年打開 (26,21) 的地塊履歷（D002）
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
      await open(`seed=${seed}&style=${style}&year=${year}&clean=1${vq}`);
      await save(page, `${vn}_${style}_y${year}`);
    }
  if (want('timeline')) {
    await open(`seed=${seed}&style=A&year=0&clean=1&at=center&zoom=2.6`);
    for (const y of [0, 15, 30, 45, 60, 80, 130, 180, 240, 300]) { await page.evaluate(`__gt.setYear(${y})`); await save(page, `timeline_y${String(y).padStart(3, '0')}`); }
  }
  errors += page.errors.length;
  if (page.errors.length) console.log('console 錯誤：\n  ' + page.errors.join('\n  '));
});

if (want('bio')) await withBrowser({ width: 412, height: 860 }, async ({ open, page }) => {
  await open(`seed=${seed}&year=300&at=26,21&zoom=3.4`);
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

if (errors) process.exitCode = 1;

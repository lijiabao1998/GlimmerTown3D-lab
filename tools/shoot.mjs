// 拍樣張：三畫風 × 三年份＝九張，存到 scratch/D001/（不進版本庫）。
// 用法：node tools/shoot.mjs [--seed=5162026] [--out=scratch/D001] [--w=1280] [--h=800]
import fs from 'node:fs';
import path from 'node:path';
import { withBrowser, ROOT } from './cdp.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const seed = arg('seed', '5162026'), out = path.resolve(ROOT, arg('out', 'scratch/D001'));
const W = +arg('w', 1280), H = +arg('h', 800);
fs.mkdirSync(out, { recursive: true });

// 每張拍兩個距離：全景（整張地圖）＋近景（對焦老城核心，看得出畫風差異）
const VIEWS = [['full', ''], ['near', '&at=center&zoom=3.2']];
await withBrowser({ width: W, height: H }, async ({ open, page }) => {
  for (const [vn, vq] of VIEWS) for (const style of ['A', 'B', 'C']) for (const year of [0, 80, 300]) {
    await open(`seed=${seed}&style=${style}&year=${year}&clean=1${vq}`);
    const shot = await page.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(out, `${vn}_${style}_y${year}.png`);
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log('OK', path.relative(ROOT, file));
  }
  if (page.errors.length) { console.log('console 錯誤：\n  ' + page.errors.join('\n  ')); process.exitCode = 1; }
});

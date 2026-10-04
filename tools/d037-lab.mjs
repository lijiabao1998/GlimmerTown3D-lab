// D037：公車路線缺口的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d037-lab.json，tools/unit-d037.mjs 在 CI 上重算本線那一半）。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=9031 node tools/d037-lab.mjs --lab=../GlimmerTown-lab
// 回退設定（tools/lab-configs.mjs fallback；存檔槽固定 3，不碰業主的存檔），每座城一個全新頁面、核對上一頁留的記號不在，連推 13 天，每天一列（tools/d034-lab.mjs 的探針，不另加欄位）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { compactRows } from './d027-lab.mjs';
import { PROBE } from './d034-lab.mjs';
import { d037Runs } from './d037-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify;
export { PROBE };

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../GlimmerTown-lab');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE), runs = d037Runs(), t0 = Date.now();
  const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d037-lab.mjs', probe: PROBE }, config: 'fallback', order: runs.map(r => r.id), runs: {}, seconds: 0 };
  const RESET = `GV.setMapSize(72);GV.newWorldSeeded(777);`;
  const RUN = (code, days) => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;window.__d027full=0;window.__d027agg=0;${RESET}const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d032start();const rows=[];for(let d=1;d<=${days};d++){GV.step(1);rows.push(window.__d034read());}return {seen,ok,start,rows};})()`;
  await withBrowser({ root: LAB, entry: 'd037.html', overlay: { 'd037.html': copy }, port: +(process.env.GT_PORT ?? 9031), width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d027ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
    for (const t of runs) {
      await open('');
      const r = await page.evaluate(RUN(t.code, t.days));
      if (r.seen) throw new Error(`${t.id}：頁面上還留著上一座城的記號（不是新的文件）`);
      if (!r.ok) throw new Error(`${t.id}：實驗線讀不進這張碼`);
      if (r.rows.length !== t.days) throw new Error(`${t.id}：記了 ${r.rows.length} 列，要 ${t.days} 列`);
      out.runs[t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: compactRows(r.start, r.rows) };
      const z = r.rows.at(-1);
      console.log(`${t.id}  ${t.days} 天：第 ${t.days} 天 人口 ${z.pop} 資金 ${Math.round(z.money * 100) / 100} 幸福 ${z.happy}｜夜間城市 ${J(z.night)}`);
      if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
    }
  });
  out.seconds = Math.round((Date.now() - t0) / 1000);
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d037-lab.json');
  fs.writeFileSync(file, J(out));
  console.log(`寫出 ${path.relative(ROOT, file)}（runs ${Object.keys(out.runs).length}，${out.seconds} 秒）`);
}

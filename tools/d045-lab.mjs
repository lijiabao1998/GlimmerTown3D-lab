// D045 驗收 5：市長委託（T385）的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成 src/content/samples/d045-lab.json，tools/unit-d045-live.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d045-lab.mjs --lab=../GlimmerTown-lab [--jobs=3] [--ids=accept0,c6（只跑幾筆，併進現有樣本）]
// 回退設定（tools/lab-configs.mjs fallback），每頁一個全新頁面、核對上一頁留的記號不在。劇本在 tools/d045-cities.mjs d045Scripts()：底城（M1）＋存檔欄位帶進行中的委託、科技、庫存、難度；
// 每個劇本分幾段，每段開頭記三選一（cmsOffers385 的 id）、接單（cmsAccept385），再用 tick() 推幾天；每天一列 [day, 資金, 人口, 幸福, 等級, 進行中的委託, 累計, 連續天數, 輪次, 完成清單長度]（同 D043 的欄位）。
// 探針在主程式 IIFE 收尾前（tools/lab-configs.mjs injectLab；一行、不插進 tick）；只有 cmsAccept385 會動實驗線狀態（接單本來就是玩家的動作）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { d045Scripts } from './d045-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify;
export const COLS = ['day', 'money', 'pop', 'happy', 'rank', 'act', 'acc', 'hold', 'n', 'done'];
export const PROBE = 'window.__d045ok=1;'
  + 'window.__d045snap=()=>[day,Math.round(money*100)/100,pop,+cityHappy.toFixed(4),rankIdx,cms385.act,cms385.acc,cms385.hold,cms385.n,cms385.done.length];'
  + 'window.__d045go=phases=>{const out=[],rows=[window.__d045snap()];for(const [idx,days] of phases){const offers=cmsOffers385().map(c=>c.id);let acc=null;if(idx>=0)acc=cmsAccept385(idx);out.push({offers,acc,at:rows.length-1});for(let d=0;d<days;d++){tick();rows.push(window.__d045snap());}}return {out,rows};};';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../GlimmerTown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), IDS = arg('ids')?.split(',');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一行');
  const copy = injectLab(html, PROBE), scripts = d045Scripts(), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = path.join(ROOT, 'src/content/samples/d045-lab.json'), old = IDS && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.source?.probe !== PROBE)) throw new Error('--ids 要搭現有樣本，而且實驗線版本與探針都要一樣');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d045-lab.mjs', probe: PROBE }, config: 'fallback', cols: COLS, order: [], runs: {}, seconds: 0 };
  out.order = scripts.map(s => s.id);
  const jobs = scripts.filter(s => !IDS || IDS.includes(s.id));
  const RESET = 'GV.setMapSize(72);GV.newWorldSeeded(777);';
  const worker = async j => {
    const mine = jobs.filter((_, i) => i % JOBS === j);
    if (!mine.length) return;
    await withBrowser({ root: LAB, entry: 'd045.html', overlay: { 'd045.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d045ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const s of mine) {
        await open('');
        const r = await page.evaluate(`(()=>{const seen=!!window.__d045seen;window.__d045seen=1;${RESET}const ok=GV.importCode(${J(s.code)});GV.setSpeed(0);GV.ai(false);const res=window.__d045go(${J(s.phases)});return {seen,ok,...res};})()`);
        if (r.seen) throw new Error(`${s.id}：頁面上還留著上一座城的記號（不是新的文件）`);
        if (!r.ok) throw new Error(`${s.id}：實驗線讀不進這張碼`);
        const days = s.phases.reduce((a, [, d]) => a + d, 0);
        if (r.rows.length !== days + 1) throw new Error(`${s.id}：${r.rows.length} 列，要 ${days + 1} 列`);
        out.runs[s.id] = { codeHash: fnv1a(s.code), phases: s.phases, out: r.out, rows: r.rows };
        const a = r.rows[0], z = r.rows.at(-1);
        console.log(`${s.id.padEnd(9)} 三選一 ${J(r.out.map(q => q.offers))} 接單 ${J(r.out.map(q => q.acc))}｜第 ${a[0]} 天 資金 ${a[1]} 進行中「${a[5]}」累計 ${a[6]} 連續 ${a[7]}｜第 ${z[0]} 天 資金 ${z[1]} 進行中「${z[5]}」累計 ${z[6]} 連續 ${z[7]} 輪次 ${z[8]} 完成 ${z[9]}`);
        if (page.errors.length) page.errors.length = 0;
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  out.seconds = (old?.seconds ?? 0) + Math.round((Date.now() - t0) / 1000);
  const lack = scripts.filter(s => !out.runs[s.id]).map(s => s.id);
  if (lack.length) throw new Error(`缺：${lack.join('、')}`);
  fs.writeFileSync(file, J(out));
  console.log(`寫出 ${path.relative(ROOT, file)}（${Object.keys(out.runs).length} 個劇本，${out.seconds} 秒）`);
}

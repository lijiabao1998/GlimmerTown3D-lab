// D013 驗收 6：hv 3 的存檔（localStorage 那一份）給實驗線讀（離線工具，要無頭 Chrome；結果存成 src/content/samples/d013-lab.json，
// tools/unit-d013.mjs 在 CI 上重算本線那一半逐項比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 [GT_PORT=8731] node tools/d013-lab.mjs --lab=../GlimmerTown-lab
// 碼：tools/unit-d013.mjs d013Codes()——預建城跑拆除與九種設施、推進 5 天，存成 hv 3（尾巴不是空的）、同一刻的 hv 2、拿掉 d3 的同一張碼。
// 實驗線頁面用它自己的 GV.importCode 各讀一次（同 tools/d011-parity.mjs 的讀回：新開 72×72 的世界再匯入），讀回對帳數字（MEASURE_SRC）、
// 道路等級（RC_SRC）、資金、難度、星等、里程碑、天數。注入只在記憶體副本（cdp overlay），實驗線原檔不動；存檔槽固定 3（preloadOf），不碰業主的存檔。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { MEASURE_SRC, RC_SRC, measureRows } from './d011-parity-lib.mjs';
import { d013Codes } from './unit-d013.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const LAB = path.resolve(arg('lab') ?? '../GlimmerTown-lab'), J = JSON.stringify;
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const version = /const GAME_VER='([^']+)'/.exec(html)[1];
const EXPORT = `window.__d013={money:()=>money,diff:()=>diff,star:()=>bestStar,msIdx:()=>msIdx};`;
const READBACK = code => `(()=>{GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});
  return {ok,measure:${MEASURE_SRC},rc:${RC_SRC},money:__d013.money(),diff:__d013.diff(),star:__d013.star(),msIdx:__d013.msIdx(),day:GV.stats().day,n:GV.N()};})()`;

const C = d013Codes(), t0 = Date.now();
const opt = { root: LAB, entry: 'd013.html', overlay: { 'd013.html': injectLab(html, EXPORT) }, port: +(process.env.GT_PORT ?? 0) || 8431, width: 1024, height: 700, gl: false,
  preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d013', readyMs: 240000, settle: 300 };
const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d013-lab.mjs', codes: 'tools/unit-d013.mjs d013Codes()' }, config: 'fallback',
  events: C.events, half: C.half, hash: {}, readback: {} };
await withBrowser(opt, async ({ open, page }) => {
  await open('');
  for (const k of ['hv3', 'hv2', 'plain']) {
    const x = await page.evaluate(READBACK(C[k]));
    x.measure = measureRows(x.measure);
    out.readback[k] = x; out.hash[k] = fnv1a(C[k]);
    console.log(`${k}：${C[k].length.toLocaleString()} 字元，實驗線讀${x.ok ? '得進來' : '不進來'}、第 ${x.day} 天 $${x.money}、${x.n}×${x.n}`);
  }
});
out.seconds = Math.round((Date.now() - t0) / 1000);
if (!out.readback.hv3?.ok) throw new Error('實驗線讀不進 hv 3 的碼，不寫樣本');
fs.writeFileSync(path.join(ROOT, 'src/content/samples/d013-lab.json'), J(out));
console.log(`寫出 d013-lab.json（${out.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);

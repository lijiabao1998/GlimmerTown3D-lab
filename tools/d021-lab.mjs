// D021 驗收 1、2：讀進來的城的人口（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d021-lab.json，tools/unit-d021.mjs 在 CI 上重算本線那一半逐座比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8951 node tools/d021-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--cities=T1,T2（除錯：只跑幾座）] [--out=別的路徑]
// 流程：碼在 Node 產生（預建城 8 個種子、AI 城、種子城、全種類樣張城、tools/d021-cities.mjs 的自造城），每座城在實驗線頁面上：
//   新開頁面（一個 Chrome 裡每座城重新載入一次：新的文件與 JS 環境；核對上一座留的記號不在）→ GV.setMapSize(72)＋GV.newWorldSeeded(777) → GV.importCode →
//   讀 GV.stats().pop（讀檔後、第一天之前：T510 包了 load，68519 → 68443–68448）→ GV.setSpeed(0)、GV.ai(false)、GV.step(1) → 再讀 GV.stats().pop（第一天 tick 之後：55246）。
//   回退設定（tools/lab-configs.mjs fallback）、存檔槽固定 3（preloadOf），不碰業主的存檔。實驗線原檔不動，也不注入任何東西（GV.stats 是實驗線自己的出口）。
// --jobs=N：同時開 N 個 Chrome（埠 GT_PORT＋0…N−1），城輪流分給它們；沒給就 3。寫樣本之前先核形狀：欄位不齊或有城讀不進去就丟例外、不寫，舊樣本留著。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { codeWithSeed } from '../src/io/labcode.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { CONFIGS, preloadOf } from './lab-configs.mjs';
import { cities21 } from './d021-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// 這一批要比的城：預建城 8 個種子（500 人前）、三張樣本碼、自造城；守衛用同一個函式重新產生，碼的雜湊要＝樣本記的
export function d021Codes() {
  const prebuilt = read('src/content/samples/d011-prebuilt.code.txt').trim();
  const pre = STARTER_SEEDS.map(s => ({ id: `pre${s}`, kind: 'prebuilt', note: `預建城，種子 ${s}`, code: codeWithSeed(prebuilt, s) }));
  const own = cities21(read('src/content/samples/newcity.code.txt'), { ai120: read('src/content/samples/ai120.code.txt'), seed516: read('src/content/samples/seed516.code.txt'), gallery: read('src/content/samples/gallery.code.txt') });
  return [...pre, ...own];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), ONLY = arg('cities')?.split(',');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  const all = d021Codes(), list = ONLY ? all.filter(c => ONLY.includes(c.id)) : all, t0 = Date.now();
  const base = +(process.env.GT_PORT ?? 0) || 8951, out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d021-lab.mjs', codes: 'tools/d021-lab.mjs d021Codes()' }, config: 'fallback', order: all.map(c => c.id), cities: {}, seconds: 0 };
  const READ = code => `(()=>{const seen=!!window.__d021seen;window.__d021seen=1;GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});const a=GV.stats();
    const popImport=a.pop,dayImport=a.day;GV.setSpeed(0);GV.ai(false);GV.step(1);const b=GV.stats();return {seen,ok,popImport,dayImport,popTick:b.pop,dayTick:b.day};})()`;
  const worker = async (j) => {
    const mine = list.filter((_, i) => i % JOBS === j);
    await withBrowser({ root: LAB, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const c of mine) {
        await open('');   // 每座城新開一頁
        const r = await page.evaluate(READ(c.code));
        if (r.seen) throw new Error(`${c.id}：頁面上還留著上一座城的記號（不是新的文件）`);
        if (!r.ok) throw new Error(`${c.id}：實驗線讀不進這張碼`);
        out.cities[c.id] = { kind: c.kind, codeHash: fnv1a(c.code), popImport: r.popImport, dayImport: r.dayImport, popTick: r.popTick, dayTick: r.dayTick };
        console.log(`${c.id.padEnd(10)} 讀檔後 ${String(r.popImport).padStart(5)}、推進一天後 ${String(r.popTick).padStart(5)}（第 ${r.dayImport} → ${r.dayTick} 天）`);
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  out.seconds = Math.round((Date.now() - t0) / 1000);
  // 形狀：每座城的欄位齊全、數字有限
  const bad = list.filter(c => { const x = out.cities[c.id]; return !x || !['popImport', 'popTick', 'dayImport', 'dayTick'].every(k => Number.isFinite(x[k])) || typeof x.codeHash !== 'string'; });
  if (bad.length) throw new Error(`欄位不齊，不寫樣本：${bad.map(c => c.id).join('、')}`);
  const ordered = Object.fromEntries(all.filter(c => out.cities[c.id]).map(c => [c.id, out.cities[c.id]]));
  out.cities = ordered;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d021-lab.json');
  fs.writeFileSync(file, J(out));
  console.log(`寫出 ${path.relative(ROOT, file)}（${list.length} 座城，${out.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);
}

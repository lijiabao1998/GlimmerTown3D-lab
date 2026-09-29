// D023 驗收 1、2：讀檔還原服務預算 sb（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d023-lab.json，tools/unit-d023.mjs 在 CI 上重算本線那一半逐座比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8991 node tools/d023-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--out=別的路徑]
// 城（碼在 Node 產生，守衛用同一個函式重新產生、雜湊要＝樣本記的）：AI 城（sb＝警 .9、醫療 .9）、種子城（sb 全 1）、預建城、全種類樣張城（沒有 sb）、tools/d023-cities.mjs 的 9 座（各種預算）。
// 每座城：新開頁面（核對上一座留的記號不在）→ GV.setMapSize(72)＋GV.newWorldSeeded(777)＋GV.importCode → 讀 svcBudget 與 60 個覆蓋場每一場的位元組雜湊（FNV-1a 32 位元，
// 出口只在記憶體副本，實驗線原檔不動；同 tools/d022-lab.mjs 的做法）→ GV.setSpeed(0)、GV.ai(false)、GV.step(1) → 再讀一次。回退設定（tools/lab-configs.mjs fallback）、存檔槽固定 3。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { codeWithSeed } from '../src/io/labcode.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { cities23 } from './d023-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
// 位元組陣列的 FNV-1a 32 位元（實驗線出口與本線守衛各寫一份，同一個算法）
export const fnvBytes = a => { let x = 2166136261 >>> 0; for (let i = 0; i < a.length; i++) { x ^= a[i]; x = Math.imul(x, 16777619) >>> 0; } return x.toString(16).padStart(8, '0'); };
const EXPORT = `window.__d023=()=>{const h=a=>{let x=2166136261>>>0;for(let i=0;i<a.length;i++){x^=a[i];x=Math.imul(x,16777619)>>>0;}return x.toString(16).padStart(8,'0');};
  return {budget:{...svcBudget},cov:Object.fromEntries(Object.entries(COV).map(([k,a])=>[k,a?h(a):null]))};};`;

export function d023Codes() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
  const own = cities23(read('src/content/samples/newcity.code.txt'), KT).map(c => ({ id: c.id, kind: 'crafted', note: c.note, code: c.code }));
  return [
    { id: 'ai120', kind: 'sample', note: 'AI 城 120 天（sb＝警 .9、醫療 .9）', code: read('src/content/samples/ai120.code.txt').trim() },
    { id: 'seed516', kind: 'sample', note: '種子城（sb 全 1）', code: read('src/content/samples/seed516.code.txt').trim() },
    { id: 'pre5162026', kind: 'prebuilt', note: '預建城（沒有 sb）', code: codeWithSeed(read('src/content/samples/d011-prebuilt.code.txt').trim(), 5162026) },
    { id: 'gallery', kind: 'sample', note: '全種類樣張城（沒有 sb）', code: read('src/content/samples/gallery.code.txt').trim() },
    ...own,
  ];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3));
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  const copy = injectLab(html, EXPORT), all = d023Codes(), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8991;
  const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d023-lab.mjs', codes: 'tools/d023-lab.mjs d023Codes()', export: EXPORT }, config: 'fallback', order: all.map(c => c.id), cities: {}, seconds: 0 };
  const READ = code => `(()=>{const seen=!!window.__d023seen;window.__d023seen=1;GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});const a=__d023();
    GV.setSpeed(0);GV.ai(false);GV.step(1);const b=__d023();return {seen,ok,load:a,day1:b};})()`;
  const worker = async j => {
    const mine = all.filter((_, i) => i % JOBS === j);
    await withBrowser({ root: LAB, entry: 'd023.html', overlay: { 'd023.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d023', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const c of mine) {
        await open('');
        const r = await page.evaluate(READ(c.code));
        if (r.seen) throw new Error(`${c.id}：頁面上還留著上一座城的記號（不是新的文件）`);
        if (!r.ok) throw new Error(`${c.id}：實驗線讀不進這張碼`);
        out.cities[c.id] = { kind: c.kind, codeHash: fnv1a(c.code), budget: r.load.budget, load: r.load.cov, day1: r.day1.cov, budgetDay1: r.day1.budget };
        console.log(`${c.id.padEnd(10)} 預算 ${J(r.load.budget)}｜覆蓋場 ${Object.keys(r.load.cov).length} 個`);
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  out.seconds = Math.round((Date.now() - t0) / 1000);
  const bad = all.filter(c => { const x = out.cities[c.id]; return !x || typeof x.codeHash !== 'string' || Object.keys(x.load ?? {}).length !== 60 || Object.keys(x.day1 ?? {}).length !== 60 || !['police', 'fire', 'health', 'edu'].every(k => Number.isFinite(x.budget?.[k])); });
  if (bad.length) throw new Error(`欄位不齊，不寫樣本：${bad.map(c => c.id).join('、')}`);
  out.cities = Object.fromEntries(all.map(c => [c.id, out.cities[c.id]]));
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d023-lab.json');
  fs.writeFileSync(file, J(out));
  console.log(`寫出 ${path.relative(ROOT, file)}（${all.length} 座城，${out.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);
}

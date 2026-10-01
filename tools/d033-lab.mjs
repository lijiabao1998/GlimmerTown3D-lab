// D033 驗收 2、3：污水的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d033-lab.json，tools/unit-d033-live.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d033-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--part=layouts|runs（只跑一部分，結果併進現有樣本）] [--ids=Q1,R003（只跑幾筆）] [--out=別的路徑（除錯用）]
// 回退設定（tools/lab-configs.mjs fallback；存檔槽固定 3，不碰業主的存檔），每頁一個全新頁面、核對上一頁留的記號不在。兩種跑法：
//   layouts：tools/d033-cities.mjs d033Layouts（手排與隨機的管網、污水廠、建築）——實驗線讀進來、不推進，強制算一次 ensureWaterCycle472（T472 的 SEWER_ROOT_OK472，非舊式分支裡 SEW_OK442 的來源，55152）之後，
//     記下每一個建築根格（非 ref）的 [格索引, 種類, 邊長, SEWER_ROOT_OK472, sewerRootStatus472(...).served]。一頁裝 LAYOUT_CHUNK 個佈局（每個佈局之前 newWorldSeeded 重置）。
//   runs：Q 系列（tools/d033-cities.mjs d033Runs：人口 ≥ 500 的自造城）連推 13 天，每天一列 row＝D032 的（tools/d032-lab.mjs：D028 的全部欄位加焦土、有電、需求、垃圾、EDU）加這一張的兩欄：
//     sw＝SEW_OK442 的總和（這一圈指派的接管棟數；人口不到 500 時每一棟都是 1）、lv＝[lv2 住宅數, lv3 住宅數]。
// 探針是記憶體副本裡主程式收尾前的一段（tools/lab-configs.mjs injectLab；不用錨點、不插進 tick，行號不動）；讀的部分全是只讀；唯一會動實驗線狀態的是 peek（多擲一次 R()，本線同樣在每天結束時多擲一次）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { compactRows } from './d027-lab.mjs';
import { PROBE as PROBE32 } from './d032-lab.mjs';
import { d033Layouts, d033Runs } from './d033-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify;
export const LAYOUT_CHUNK = 24;

export const PROBE = PROBE32
  + `window.__d033lay=()=>{const roots=[];let err=null;try{ensureWaterCycle472(true);for(let i=0;i<N*N;i++){const b=tiles[i].bld;if(!b||b.ref)continue;roots.push([i,b.k,b.sz||1,SEWER_ROOT_OK472[i]|0,sewerRootStatus472(i)?.served?1:0]);}}catch(e){err=String(e&&e.stack||e).slice(0,300);}`
  + `let wp=0;for(let i=0;i<N*N;i++)if(tiles[i].wp)wp++;return {N,pop,wp,roots,err,legacy:sewerLegacy451(),wl:waterLegacy449()};};`
  + `window.__d033read=()=>{const r=window.__d032read();let ok=0;for(let i=0;i<SEW_OK442.length;i++)ok+=SEW_OK442[i];let l2=0,l3=0;for(let i=0;i<N*N;i++){const b=tiles[i].bld;if(b&&!b.ref&&b.k===1){if(b.lv===2)l2++;else if(b.lv===3)l3++;}}r.sw=ok;r.lv=[l2,l3];return r;};`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), IDS = arg('ids')?.split(','), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE);
  const layouts = d033Layouts(), runs = d033Runs(), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d033-lab.json'), old = (PART || IDS) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback' || old.source?.probe !== PROBE)) throw new Error('--part／--ids 要搭現有樣本，而且實驗線版本、設定與探針都要一樣（探針改過就整份重錄）');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d033-lab.mjs', probe: PROBE }, config: 'fallback', layoutOrder: [], order: [], layouts: {}, runs: {}, seconds: 0 };
  out.layoutOrder = layouts.map(l => l.id); out.order = runs.map(r => r.id);
  const partFile = file + '.part';
  let partSeconds = 0, lastSave = 0;
  if (fs.existsSync(partFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(partFile, 'utf8'));
      if (prev.source?.commit === commit && prev.source.probe === PROBE && prev.config === 'fallback') {
        for (const k of ['layouts', 'runs']) Object.assign(out[k], prev[k] ?? {});
        partSeconds = Math.max(0, (prev.seconds ?? 0) - (old?.seconds ?? 0));
        console.log(`續跑：${partFile} 已有 layouts ${Object.keys(prev.layouts ?? {}).length}、runs ${Object.keys(prev.runs ?? {}).length}`);
      }
    } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000); fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const keep = t => !IDS || IDS.includes(t.id);
  const RESET = `GV.setMapSize(72);GV.newWorldSeeded(777);`;
  const LAY = codes => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;const res=[];for(const code of ${J(codes)}){${RESET}const ok=GV.importCode(code);GV.setSpeed(0);GV.ai(false);res.push({ok,lay:window.__d033lay()});}return {seen,res};})()`;
  const RUN = (code, days) => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;window.__d027full=0;window.__d027agg=0;${RESET}const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d032start();const rows=[];`
    + `for(let d=1;d<=${days};d++){GV.step(1);rows.push(window.__d033read());}return {seen,ok,start,rows};})()`;
  const NEED = ['day', 'pop', 'jobs', 'happy', 'money', 'net', 'tx', 'inc', 'ng', 'un', 'uu', 'ch', 'fd', 'tr', 'ho', 'nh', 'hh', 'ah', 'night', 'tech', 'pol', 'peek', 'rn', 'np', 'dm', 'gb', 'ed', 'sw', 'lv'];
  const checkRun = (id, r, days) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (r.rows.length !== days) throw new Error(`${id}：記了 ${r.rows.length} 列，要 ${days} 列`);
    r.rows.forEach((a, i) => {
      for (const k of NEED) if (a[k] === null || a[k] === undefined) throw new Error(`${id} 第 ${i + 1} 天 ${k} 讀不到`);
      if (a.tx.some(v => typeof v !== 'number') || a.inc.some(v => typeof v !== 'number') || a.ch.some(v => v === undefined || v === null)) throw new Error(`${id} 第 ${i + 1} 天 收入或鏈條有讀不到的欄位：${J(a.inc)} ${J(a.ch)}`);
    });
  };
  const checkLay = (id, r) => {
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    const l = r.lay;
    if (l.err) throw new Error(`${id}：ensureWaterCycle472 丟例外 ${l.err}`);
    if (l.legacy || !l.wl) throw new Error(`${id}：旗標不對（sewerLegacy451 ${l.legacy}、waterLegacy449 ${l.wl}）：要非舊式污水、舊式供水`);
    if (!l.roots.length) throw new Error(`${id}：讀進來沒有建築`);
    for (const q of l.roots) if (q[3] !== q[4]) throw new Error(`${id}：SEWER_ROOT_OK472 與 sewerRootStatus472 不一致 ${J(q)}`);
  };
  const isDone = (kind, t) => out[kind]?.[t.id]?.codeHash === fnv1a(t.code);
  // layouts：一頁一批
  const layJobs = (!PART || PART === 'layouts') ? layouts.filter(keep).filter(t => !isDone('layouts', t)) : [];
  const chunks = []; for (let i = 0; i < layJobs.length; i += LAYOUT_CHUNK) chunks.push(layJobs.slice(i, i + LAYOUT_CHUNK));
  const runJobs = (!PART || PART === 'runs') ? runs.filter(keep).filter(t => !isDone('runs', t)) : [];
  const jobs = [...chunks.map(c => ({ kind: 'layouts', chunk: c })), ...runJobs.map(t => ({ kind: 'runs', t }))];
  const worker = async j => {
    const mine = jobs.filter((_, i) => i % JOBS === j);
    if (!mine.length) return;
    await withBrowser({ root: LAB, entry: 'd033.html', overlay: { 'd033.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d027ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const job of mine) {
        await open('');
        if (job.kind === 'layouts') {
          const r = await page.evaluate(LAY(job.chunk.map(t => t.code)));
          if (r.seen) throw new Error('layouts：頁面上還留著上一頁的記號');
          job.chunk.forEach((t, i) => {
            checkLay(t.id, r.res[i]);
            const l = r.res[i].lay;
            out.layouts[t.id] = { codeHash: fnv1a(t.code), pop: l.pop, wp: l.wp, roots: l.roots.map(q => [q[0], q[1], q[2]]), ok: l.roots.filter(q => q[3]).map(q => q[0]) };
          });
          const okN = job.chunk.reduce((a, t) => a + out.layouts[t.id].ok.length, 0), rootN = job.chunk.reduce((a, t) => a + out.layouts[t.id].roots.length, 0);
          console.log(`layouts ${job.chunk[0].id}…${job.chunk.at(-1).id}（${job.chunk.length} 個）：根格 ${rootN}、接管 ${okN}`);
        } else {
          const t = job.t, r = await page.evaluate(RUN(t.code, t.days));
          checkRun(t.id, r, t.days);
          out.runs[t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: compactRows(r.start, r.rows) };
          const a = r.rows[0], z = r.rows.at(-1);
          console.log(`runs ${t.id.padEnd(6)} ${String(t.days).padStart(3)} 天：第 1 天 人口 ${a.pop} 接管 ${a.sw} lv2/3 ${a.lv}｜第 ${t.days} 天 人口 ${z.pop} 接管 ${z.sw} lv2/3 ${z.lv} 幸福 ${z.happy.toFixed(4)}`);
        }
        if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
        savePart(false);
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  savePart(true);
  out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000);
  if (!IDS) {
    const lackL = (!PART || PART === 'layouts') ? layouts.filter(c => !out.layouts[c.id]).map(c => c.id) : [], lackR = (!PART || PART === 'runs') ? runs.filter(c => !out.runs[c.id]).map(c => c.id) : [];
    if (lackL.length || lackR.length) throw new Error(`缺：${[...lackL, ...lackR].join('、')}`);
  }
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（layouts ${Object.keys(out.layouts).length}、runs ${Object.keys(out.runs).length}，${out.seconds} 秒）`);
}

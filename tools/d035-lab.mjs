// D035 驗收 2、3、4：讀檔圖層補齊的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d035-lab.json，tools/unit-d035.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d035-lab.mjs --lab=../GlimmerTown-lab [--jobs=3] [--part=layouts|runs|rt（只跑一部分，結果併進現有樣本）] [--ids=L1,L3a（只跑幾筆）] [--out=別的路徑（除錯用）]
// 回退設定（tools/lab-configs.mjs fallback；存檔槽固定 3，不碰業主的存檔），每頁一個全新頁面、核對上一頁留的記號不在。三種跑法：
//   runs：L 系列（tools/d035-cities.mjs d035Runs：公車站與路旁裝飾、輕軌、高壓線接力、污水幹管橋接、全部混在一起）連推 13 天，每天一列 row＝D034 的（tools/d034-lab.mjs：D033 的全部欄位加建築雜湊與塔／巨廈根格數）
//     加這一張的三欄：lh＝十一個圖層（rdec、bus、tram、busLane、oneway、light、deco、hv471、ug471、wm472、sm472）各自的 [格數, 位置與值的雜湊]、rp＝有電的道路格 [格數, 雜湊]、
//     cv＝公車站與路旁裝飾兩個覆蓋場 [總和, 雜湊]；開頭那一列（start）另記讀進來那一刻（還沒推進）的 lh。
//   layouts：tools/d035-cities.mjs d035Layouts（手排與隨機的污水幹管佈局）——實驗線讀進來、不推進，強制算一次 ensureWaterCycle472，記下每一個建築根格的 SEWER_ROOT_OK472（D033 的 __d033lay，加幹管格數）。
//   rt：本線自己在自造城上拆路、蓋東西（拆有公車站、路旁裝飾、輕軌、單行道、紅綠燈、公車專用道的路；在有裝飾的格上蓋建築、劃區、鋪路）之後存出來的碼，實驗線用 GV.importCode 讀回去，再推 RT_DAYS 天：
//     那十一層讀回來要＝本線的格子，讀進來之後的每一欄跟本線一樣。
// 探針是記憶體副本裡主程式收尾前的一段（tools/lab-configs.mjs injectLab；不用錨點、不插進 tick，行號不動）；讀的部分全是只讀；唯一會動實驗線狀態的是 peek（多擲一次 R()，本線同樣在每天結束時多擲一次）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { compactRows } from './d027-lab.mjs';
import { PROBE as PROBE34 } from './d034-lab.mjs';
import { d035Runs, d035Layouts, L_DAYS } from './d035-cities.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { commitOp } from '../src/sim/edit.ts';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify;
export const LAYOUT_CHUNK = 24;
export const RT_DAYS = 3;   // rt：本線存出來的碼，實驗線讀進來再推幾天
export const LAYER_NAMES = ['rdec', 'bus', 'tram', 'busLane', 'oneway', 'light', 'deco', 'hv471', 'ug471', 'wm472', 'sm472'];

// rt 的劇本：[城, 操作們]（本線的 commitOp，一格一格；protect 開著＝玩家真的會走的那條路）
export const RT_PLANS = {
  'L5-doze': ['L5', [
    ['doze', 56, 30], ['doze', 44, 30], ['doze', 36, 30], ['doze', 52, 30], ['doze', 46, 30], ['doze', 60, 30], ['doze', 40, 30],      // 公車站、路旁裝飾、輕軌、紅綠燈、單行道、公車專用道、公車站（主街 z=30 東邊：兩座電廠各供一半，切開之後東西兩段、中間幾段沒有電，西邊的城照常）
    ['place', 'police', 8, 40], ['rect', 'zr', 16, 40, 17, 41], ['line', 'road', 20, 43, 20, 46],                                     // 蓋在有裝飾的格上：建築、分區、鋪路
  ]],
  'L1-doze': ['L1', [['doze', 18, 30], ['doze', 22, 30]]],
};
const opOf = o => o[0] === 'doze' ? { k: 'tap', tool: 'doze', x0: o[1], z0: o[2], x1: o[1], z1: o[2] }
  : o[0] === 'place' ? { k: 'tap', tool: o[1], x0: o[2], z0: o[3], x1: o[2], z1: o[3] }
  : o[0] === 'rect' ? { k: 'rect', tool: o[1], x0: o[2], z0: o[3], x1: o[4], z1: o[5] } : { k: 'line', tool: o[1], x0: o[2], z0: o[3], x1: o[4], z1: o[5] };
let rtCache = null;
export function d035Rt() {
  if (rtCache) return rtCache;
  const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank, all = d035Runs();
  return rtCache = Object.entries(RT_PLANS).map(([id, [from, ops]]) => {
    const r = all.find(q => q.id === from), L = loadCode(r.code, KT, vrank); if (!L.ok) throw new Error(`rt ${id}：本線讀不進 ${L.error}`);
    const res = ops.map(o => { const x = commitOp(L.sim, opOf(o), 0); if (!x.ok) throw new Error(`rt ${id}：${J(o)} 被擋下：${x.reason}`); return [x.placed, x.spent]; });
    return { id, from, ops, res, code: saveCode(L.sim, L.template, L.start), days: RT_DAYS };
  });
}

// 十一個圖層的統計與有電的道路格、覆蓋場：字串的格式本線 tools/unit-d035.mjs layerStats／rpStats／covStats 逐字相同
export const PROBE = PROBE34
  + `window.__d035h=(f)=>{let c=0,h=2166136261>>>0;f((i,v)=>{c+=1;const s=i+':'+v+';';for(let q=0;q<s.length;q++){h^=s.charCodeAt(q);h=Math.imul(h,16777619)>>>0;}});return [c,h];};`
  + `window.__d035lh=()=>{const F=${J(LAYER_NAMES)},o=[];for(const f of F)o.push(window.__d035h(e=>{for(let i=0;i<N*N;i++){const v=+(tiles[i][f]||0);if(v)e(i,v);}}));return o;};`
  + `window.__d035read=()=>{const r=window.__d034read();r.lh=window.__d035lh();r.rp=window.__d035h(e=>{for(let i=0;i<N*N;i++)if(tiles[i].rp)e(i,1);});`
  + `r.cv=['bus','rdec'].map(f=>{const a=COV[f];let sum=0;const q=window.__d035h(e=>{if(a)for(let i=0;i<a.length;i++){const v=a[i]|0;if(v){sum+=v;e(i,v);}}});return [sum,q[1]];});return r;};`
  + `window.__d035lay=()=>{const r=window.__d033lay();let sm=0;for(let i=0;i<N*N;i++)if(tiles[i].sm472)sm++;r.sm=sm;return r;};`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../GlimmerTown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), IDS = arg('ids')?.split(','), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE);
  const runs = d035Runs(), layouts = d035Layouts(), rts = d035Rt(), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d035-lab.json'), old = (PART || IDS) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback' || old.source?.probe !== PROBE)) throw new Error('--part／--ids 要搭現有樣本，而且實驗線版本、設定與探針都要一樣（探針改過就整份重錄）');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d035-lab.mjs', probe: PROBE }, config: 'fallback', order: [], layoutOrder: [], rtOrder: [], runs: {}, layouts: {}, rt: {}, seconds: 0 };
  out.order = runs.map(r => r.id); out.layoutOrder = layouts.map(l => l.id); out.rtOrder = rts.map(r => r.id); out.rt ??= {};
  const partFile = file + '.part';
  let partSeconds = 0, lastSave = 0;
  if (fs.existsSync(partFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(partFile, 'utf8'));
      if (prev.source?.commit === commit && prev.source.probe === PROBE && prev.config === 'fallback') {
        for (const k of ['runs', 'layouts', 'rt']) Object.assign(out[k], prev[k] ?? {});
        partSeconds = Math.max(0, (prev.seconds ?? 0) - (old?.seconds ?? 0));
        console.log(`續跑：${partFile} 已有 runs ${Object.keys(prev.runs ?? {}).length}、layouts ${Object.keys(prev.layouts ?? {}).length}、rt ${Object.keys(prev.rt ?? {}).length}`);
      }
    } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000); fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const keep = t => !IDS || IDS.includes(t.id);
  const RESET = `GV.setMapSize(72);GV.newWorldSeeded(777);`;
  const LAY = codes => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;const res=[];for(const code of ${J(codes)}){${RESET}const ok=GV.importCode(code);GV.setSpeed(0);GV.ai(false);res.push({ok,lay:window.__d035lay()});}return {seen,res};})()`;
  const RUN = (code, days) => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;window.__d027full=0;window.__d027agg=0;${RESET}const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d032start();start.lh=window.__d035lh();const rows=[];`
    + `for(let d=1;d<=${days};d++){GV.step(1);rows.push(window.__d035read());}return {seen,ok,start,rows};})()`;
  const NEED = ['day', 'pop', 'jobs', 'happy', 'money', 'net', 'tx', 'inc', 'ng', 'un', 'uu', 'ch', 'fd', 'tr', 'ho', 'nh', 'hh', 'ah', 'night', 'tech', 'pol', 'peek', 'rn', 'np', 'dm', 'gb', 'ed', 'sw', 'lv', 'bh', 'tw', 'lh', 'rp', 'cv'];
  const checkRun = (id, r, days) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (!Array.isArray(r.start.lh) || r.start.lh.length !== LAYER_NAMES.length) throw new Error(`${id}：讀進來那一刻的圖層統計讀不到`);
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
  const layJobs = (!PART || PART === 'layouts') ? layouts.filter(keep).filter(t => !isDone('layouts', t)) : [];
  const chunks = []; for (let i = 0; i < layJobs.length; i += LAYOUT_CHUNK) chunks.push(layJobs.slice(i, i + LAYOUT_CHUNK));
  const runJobs = (!PART || PART === 'runs') ? runs.filter(keep).filter(t => !isDone('runs', t)).map(t => ({ kind: 'runs', t })) : [];
  const rtJobs = (!PART || PART === 'rt') ? rts.filter(keep).filter(t => !isDone('rt', t)).map(t => ({ kind: 'rt', t })) : [];
  const jobs = [...chunks.map(c => ({ kind: 'layouts', chunk: c })), ...runJobs, ...rtJobs];
  const worker = async j => {
    const mine = jobs.filter((_, i) => i % JOBS === j);
    if (!mine.length) return;
    await withBrowser({ root: LAB, entry: 'd035.html', overlay: { 'd035.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d027ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const job of mine) {
        await open('');
        if (job.kind === 'layouts') {
          const r = await page.evaluate(LAY(job.chunk.map(t => t.code)));
          if (r.seen) throw new Error('layouts：頁面上還留著上一頁的記號');
          job.chunk.forEach((t, i) => {
            checkLay(t.id, r.res[i]);
            const l = r.res[i].lay;
            out.layouts[t.id] = { codeHash: fnv1a(t.code), pop: l.pop, wp: l.wp, sm: l.sm, roots: l.roots.map(q => [q[0], q[1], q[2]]), ok: l.roots.filter(q => q[3]).map(q => q[0]) };
          });
          const okN = job.chunk.reduce((a, t) => a + out.layouts[t.id].ok.length, 0), rootN = job.chunk.reduce((a, t) => a + out.layouts[t.id].roots.length, 0);
          console.log(`layouts ${job.chunk[0].id}…${job.chunk.at(-1).id}（${job.chunk.length} 個）：根格 ${rootN}、接管 ${okN}`);
        } else {
          const t = job.t, r = await page.evaluate(RUN(t.code, t.days));
          checkRun(t.id, r, t.days);
          out[job.kind][t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: compactRows(r.start, r.rows) };
          const a = r.rows[0], z = r.rows.at(-1);
          console.log(`${job.kind} ${t.id.padEnd(8)} ${String(t.days).padStart(3)} 天：讀進來 圖層 ${J(r.start.lh.map(q => q[0]))}｜第 1 天 人口 ${a.pop} 幸福 ${a.happy.toFixed(3)} 有電道路 ${a.rp[0]}｜第 ${t.days} 天 人口 ${z.pop} 幸福 ${z.happy.toFixed(3)} 接管 ${z.sw}`);
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
    const lack = [...((!PART || PART === 'runs') ? runs.filter(c => !out.runs[c.id]).map(c => c.id) : []), ...((!PART || PART === 'layouts') ? layouts.filter(c => !out.layouts[c.id]).map(c => c.id) : []), ...((!PART || PART === 'rt') ? rts.filter(c => !out.rt[c.id]).map(c => `rt ${c.id}`) : [])];
    if (lack.length) throw new Error(`缺：${lack.join('、')}`);
  }
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（runs ${Object.keys(out.runs).length}、layouts ${Object.keys(out.layouts).length}、rt ${Object.keys(out.rt).length}，${out.seconds} 秒）`);
}
void L_DAYS;

// D036 驗收 1、3、4：資源開採的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d036-lab.json，tools/unit-d036.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d036-lab.mjs --lab=../GlimmerTown-lab [--jobs=3] [--part=seeds|runs|rt（只跑一部分，結果併進現有樣本）] [--ids=W1,W3（只跑幾筆）] [--out=別的路徑（除錯用）]
// 回退設定（tools/lab-configs.mjs fallback；存檔槽固定 3，不碰業主的存檔），每頁一個全新頁面、核對上一頁留的記號不在。三種跑法：
//   seeds：tools/d036-cities.mjs d036Seeds（空城，種子含負的、接近 2^31 的）——實驗線讀進來、不推進，記下 RESOURCE 的 [非零格數, 總和, 雜湊]（genResource 在 load 裡重建，66895）。
//   runs：W 系列（tools/d036-cities.mjs d036Runs：油井與礦場擺在資源圖上、煉油廠與鋼鐵廠、耗盡、壞的 rdep）連推 13 天（W4 連推 60 天），每天一列 row＝D034 的（tools/d034-lab.mjs：D033 的全部欄位加建築雜湊與塔／巨廈根格數）
//     加這一張的三欄：rd＝RDEP 的 [非零格數, 總和, 雜湊]、st＝[供應品, 燃料, 鋼材, fuelMade, steelMade]、fl＝flowStat384.raw 的 [oil, ore, made, stock]；開頭那一列（start）另記讀進來那一刻的 RESOURCE 與 RDEP。
//   rt：本線自己推一段、存檔（rdep 是本線寫的），實驗線用 GV.importCode 讀「本線存出來的碼」再推 RT_DAYS 天：讀回來的 RDEP＝本線的，之後每一欄跟本線一樣。
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
import { d036Runs, d036Seeds, W_DAYS, builtWells } from './d036-cities.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify;
export const SEED_CHUNK = 30;
export const RT_DAYS = 3;   // rt：本線存出來的碼，實驗線讀進來再推幾天
export const RT_PLAYS = { W2: 13, W3: 2, W4: 30 };   // [城, 本線先推幾天再存]
// D040：玩家自己蓋的井（builtWells：W1 的底城、油井 4 口、礦場 3 口，走 commitOp）——本線推 [天數] 天再存：13 天（耗損剛開始）、79 天（油井剩 3，實驗線讀進來第 1 天抽完 240）、
// 81 天（油井已耗盡、碼裡有 depleted 事件，實驗線讀進來之後油井不再抽）
export const RT_BUILT = [13, 79, 81];
let rtCache = null;
export function d036Rt() {
  if (rtCache) return rtCache;
  const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank, all = d036Runs();
  const mine = Object.entries(RT_PLAYS).map(([id, days]) => {
    const r = all.find(q => q.id === id), L = loadCode(r.code, KT, vrank); if (!L.ok) throw new Error(`rt ${id}：本線讀不進 ${L.error}`);
    for (let d = 0; d < days; d++) stepDay(L.sim);
    return { id: `${id}@${days}`, code: saveCode(L.sim, L.template, L.start), days: RT_DAYS };
  });
  const built = RT_BUILT.map(days => {
    const L = builtWells();
    for (let d = 0; d < days; d++) stepDay(L.sim);
    return { id: `B@${days}`, code: saveCode(L.sim, L.template, L.start), days: RT_DAYS, put: L.put };
  });
  return rtCache = [...mine, ...built];
}

// RDEP、RESOURCE 的統計與庫存：字串的格式本線 tools/unit-d036.mjs statsOf 逐字相同
export const PROBE = PROBE34
  + `window.__d036h=a=>{let c=0,s=0,h=2166136261>>>0;for(let i=0;i<a.length;i++){const v=a[i]|0;if(v){c++;s+=v;const q=i+':'+v+';';for(let k=0;k<q.length;k++){h^=q.charCodeAt(k);h=Math.imul(h,16777619)>>>0;}}}return [c,s,h];};`
  + `window.__d036res=()=>window.__d036h(RESOURCE);window.__d036rd=()=>window.__d036h(RDEP);`
  + `window.__d036read=()=>{const r=window.__d034read();r.rd=window.__d036h(RDEP);const f=flowStat384&&flowStat384.raw;r.fl=f?[f.oil,f.ore,f.made,f.stock]:null;r.st=[supplies,fuel,steel,fuelMade,steelMade];return r;};`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../GlimmerTown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), IDS = arg('ids')?.split(','), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE);
  const runs = d036Runs(), seeds = d036Seeds(), rts = d036Rt(), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d036-lab.json'), old = (PART || IDS) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback' || old.source?.probe !== PROBE)) throw new Error('--part／--ids 要搭現有樣本，而且實驗線版本、設定與探針都要一樣（探針改過就整份重錄）');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d036-lab.mjs', probe: PROBE }, config: 'fallback', order: [], seedOrder: [], rtOrder: [], runs: {}, seeds: {}, rt: {}, seconds: 0 };
  out.order = runs.map(r => r.id); out.seedOrder = seeds.map(r => r.id); out.rtOrder = rts.map(r => r.id); out.rt ??= {};
  const partFile = file + '.part';
  let partSeconds = 0, lastSave = 0;
  if (fs.existsSync(partFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(partFile, 'utf8'));
      if (prev.source?.commit === commit && prev.source.probe === PROBE && prev.config === 'fallback') {
        for (const k of ['runs', 'seeds', 'rt']) Object.assign(out[k], prev[k] ?? {});
        partSeconds = Math.max(0, (prev.seconds ?? 0) - (old?.seconds ?? 0));
        console.log(`續跑：${partFile} 已有 runs ${Object.keys(prev.runs ?? {}).length}、seeds ${Object.keys(prev.seeds ?? {}).length}、rt ${Object.keys(prev.rt ?? {}).length}`);
      }
    } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000); fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const keep = t => !IDS || IDS.includes(t.id);
  const RESET = `GV.setMapSize(72);GV.newWorldSeeded(777);`;
  const SEEDS_JS = codes => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;const res=[];for(const code of ${J(codes)}){${RESET}const ok=GV.importCode(code);GV.setSpeed(0);GV.ai(false);res.push({ok,res:window.__d036res()});}return {seen,res};})()`;
  const RUN = (code, days) => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;window.__d027full=0;window.__d027agg=0;${RESET}const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d032start();start.res=window.__d036res();start.rd=window.__d036rd();const rows=[];`
    + `for(let d=1;d<=${days};d++){GV.step(1);rows.push(window.__d036read());}return {seen,ok,start,rows};})()`;
  const NEED = ['day', 'pop', 'jobs', 'happy', 'money', 'net', 'tx', 'inc', 'ng', 'un', 'uu', 'ch', 'fd', 'tr', 'ho', 'nh', 'hh', 'ah', 'night', 'tech', 'pol', 'peek', 'rn', 'np', 'dm', 'gb', 'ed', 'sw', 'lv', 'bh', 'tw', 'rd', 'st'];
  const checkRun = (id, r, days) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (!Array.isArray(r.start.res) || !Array.isArray(r.start.rd)) throw new Error(`${id}：讀進來那一刻的資源圖／耗損讀不到`);
    if (r.rows.length !== days) throw new Error(`${id}：記了 ${r.rows.length} 列，要 ${days} 列`);
    r.rows.forEach((a, i) => {
      for (const k of NEED) if (a[k] === null || a[k] === undefined) throw new Error(`${id} 第 ${i + 1} 天 ${k} 讀不到`);
      if (a.tx.some(v => typeof v !== 'number') || a.inc.some(v => typeof v !== 'number') || a.ch.some(v => v === undefined || v === null)) throw new Error(`${id} 第 ${i + 1} 天 收入或鏈條有讀不到的欄位：${J(a.inc)} ${J(a.ch)}`);
    });
  };
  const isDone = (kind, t) => out[kind]?.[t.id]?.codeHash === fnv1a(t.code);
  const seedJobs = (!PART || PART === 'seeds') ? seeds.filter(keep).filter(t => !isDone('seeds', t)) : [];
  const chunks = []; for (let i = 0; i < seedJobs.length; i += SEED_CHUNK) chunks.push(seedJobs.slice(i, i + SEED_CHUNK));
  const runJobs = (!PART || PART === 'runs') ? runs.filter(keep).filter(t => !isDone('runs', t)).map(t => ({ kind: 'runs', t })) : [];
  const rtJobs = (!PART || PART === 'rt') ? rts.filter(keep).filter(t => !isDone('rt', t)).map(t => ({ kind: 'rt', t })) : [];
  const jobs = [...runJobs, ...rtJobs, ...chunks.map(c => ({ kind: 'seeds', chunk: c }))];
  const worker = async j => {
    const mine = jobs.filter((_, i) => i % JOBS === j);
    if (!mine.length) return;
    await withBrowser({ root: LAB, entry: 'd036.html', overlay: { 'd036.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d027ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const job of mine) {
        await open('');
        if (job.kind === 'seeds') {
          const r = await page.evaluate(SEEDS_JS(job.chunk.map(t => t.code)));
          if (r.seen) throw new Error('seeds：頁面上還留著上一頁的記號');
          job.chunk.forEach((t, i) => { if (!r.res[i].ok) throw new Error(`${t.id}：實驗線讀不進這張碼`); out.seeds[t.id] = { codeHash: fnv1a(t.code), seed: t.seed, res: r.res[i].res }; });
          console.log(`seeds ${job.chunk[0].id}…${job.chunk.at(-1).id}（${job.chunk.length} 個）：資源格 ${job.chunk.reduce((a, t) => a + out.seeds[t.id].res[0], 0)}`);
        } else {
          const t = job.t, r = await page.evaluate(RUN(t.code, t.days));
          checkRun(t.id, r, t.days);
          out[job.kind][t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: compactRows(r.start, r.rows) };
          const a = r.rows[0], z = r.rows.at(-1);
          console.log(`${job.kind} ${t.id.padEnd(8)} ${String(t.days).padStart(3)} 天：讀進來 資源 ${J(r.start.res)} 耗損 ${J(r.start.rd)}｜第 1 天 耗損 ${J(a.rd)} 庫存 ${J(a.st)}｜第 ${t.days} 天 耗損 ${J(z.rd)} 庫存 ${J(z.st.map(v => +v.toFixed(2)))}`);
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
    const lack = [...((!PART || PART === 'runs') ? runs.filter(c => !out.runs[c.id]).map(c => c.id) : []), ...((!PART || PART === 'seeds') ? seeds.filter(c => !out.seeds[c.id]).map(c => c.id) : []), ...((!PART || PART === 'rt') ? rts.filter(c => !out.rt[c.id]).map(c => `rt ${c.id}`) : [])];
    if (lack.length) throw new Error(`缺：${lack.join('、')}`);
  }
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（runs ${Object.keys(out.runs).length}、seeds ${Object.keys(out.seeds).length}、rt ${Object.keys(out.rt).length}，${out.seconds} 秒）`);
}
void W_DAYS;

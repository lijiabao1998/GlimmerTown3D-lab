// D034 驗收 3、6：摩天樓與巨廈合併的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d034-lab.json，tools/unit-d034-live.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d034-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--ids=M1a,M2b（只跑幾筆）] [--out=別的路徑（除錯用）]
// 回退設定（tools/lab-configs.mjs fallback；存檔槽固定 3，不碰業主的存檔），每頁一個全新頁面、核對上一頁留的記號不在。
//   rt：本線自己推一段（塔與巨廈已經長出來）、存檔，實驗線用 GV.importCode 讀「本線存出來的碼」再推 RT_DAYS 天——實驗線讀得進本線存的塔與巨廈（根格一列、ref 格讀檔補），讀進來之後的數字要跟本線一樣。
//   runs：M 系列（tools/d034-cities.mjs d034Runs：人口 ≥ 500、幸福自然 > .55／> .6 的自造城）連推 13 天，每天一列 row＝D033 的（tools/d033-lab.mjs：D032 的全部欄位加接管棟數與 lv2／lv3 住宅數）
//     加這一張的兩欄：bh＝全部建築的雜湊（每一格的種類、ref、等級與屋齡〔ref 格沒有，不比〕、變體〔只有塔與巨廈的根格（ref 格沒有）：住商工的變體讀檔時被實驗線重挑過、純視覺，不比〕、屋齡、通電、有水、幸福、邊長、分區，FNV-1a）、tw＝[住宅塔 k33、商業塔 k34、住宅巨廈 k105、商業綜合體 k106] 的根格數。
// 探針是記憶體副本裡主程式收尾前的一段（tools/lab-configs.mjs injectLab；不用錨點、不插進 tick，行號不動）；讀的部分全是只讀；唯一會動實驗線狀態的是 peek（多擲一次 R()，本線同樣在每天結束時多擲一次）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { compactRows } from './d027-lab.mjs';
import { PROBE as PROBE33 } from './d033-lab.mjs';
import { d034Runs } from './d034-cities.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify;
export const RT_DAYS = 3;   // rt：本線存出來的碼，實驗線讀進來再推幾天
export const RT_PLAYS = { M1b: 13, M2b: 13, M2c: 13, M1c: 13 };
let rtCache = null;
export function d034Rt() {
  if (rtCache) return rtCache;
  const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank, all = d034Runs();
  return rtCache = Object.entries(RT_PLAYS).map(([id, days]) => {
    const r = all.find(q => q.id === id), L = loadCode(r.code, KT, vrank); if (!L.ok) throw new Error(`rt ${id}：本線讀不進 ${L.error}`);
    for (let d = 0; d < days; d++) stepDay(L.sim);
    return { id: `${id}@${days}`, code: saveCode(L.sim, L.template, L.start), days: RT_DAYS };
  });
}

// 全部建築的雜湊：字串的格式本線 tools/unit-d034-live.mjs bldHash 逐字相同
export const PROBE = PROBE33
  + `window.__d034read=()=>{const r=window.__d033read();let h=2166136261>>>0;const c=[0,0,0,0];`
  + `for(let i=0;i<N*N;i++){const t=tiles[i],b=t.bld;if(!b)continue;if(!b.ref){if(b.k===33)c[0]++;else if(b.k===34)c[1]++;else if(b.k===105)c[2]++;else if(b.k===106)c[3]++;}`
  + `const s=i+','+b.k+','+(b.ref?b.ref[0]+':'+b.ref[1]:'')+','+(b.ref?'':b.lv)+','+(!b.ref&&(b.k===33||b.k===34||b.k===105||b.k===106)?b.v:'')+','+(b.ref?'':b.age)+','+(b.pw?1:0)+','+(b.wa?1:0)+','+(+(b.h||0))+','+(b.sz||0)+','+(t.zone||0)+';';`
  + `for(let q=0;q<s.length;q++){h^=s.charCodeAt(q);h=Math.imul(h,16777619)>>>0;}}r.bh=h;r.tw=c;return r;};`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), IDS = arg('ids')?.split(',');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE);
  const runs = d034Runs(), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d034-lab.json'), old = IDS && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback' || old.source?.probe !== PROBE)) throw new Error('--ids 要搭現有樣本，而且實驗線版本、設定與探針都要一樣（探針改過就整份重錄）');
  const rts = d034Rt();
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d034-lab.mjs', probe: PROBE }, config: 'fallback', order: [], rtOrder: [], runs: {}, rt: {}, seconds: 0 };
  out.order = runs.map(r => r.id); out.rtOrder = rts.map(r => r.id); out.rt ??= {};
  const partFile = file + '.part';
  let partSeconds = 0, lastSave = 0;
  if (fs.existsSync(partFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(partFile, 'utf8'));
      if (prev.source?.commit === commit && prev.source.probe === PROBE && prev.config === 'fallback') {
        Object.assign(out.runs, prev.runs ?? {}); Object.assign(out.rt, prev.rt ?? {});
        partSeconds = Math.max(0, (prev.seconds ?? 0) - (old?.seconds ?? 0));
        console.log(`續跑：${partFile} 已有 runs ${Object.keys(prev.runs ?? {}).length}`);
      }
    } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000); fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const keep = t => !IDS || IDS.includes(t.id);
  const RESET = `GV.setMapSize(72);GV.newWorldSeeded(777);`;
  const RUN = (code, days) => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;window.__d027full=0;window.__d027agg=0;${RESET}const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d032start();const rows=[];`
    + `for(let d=1;d<=${days};d++){GV.step(1);rows.push(window.__d034read());}return {seen,ok,start,rows};})()`;
  const NEED = ['day', 'pop', 'jobs', 'happy', 'money', 'net', 'tx', 'inc', 'ng', 'un', 'uu', 'ch', 'fd', 'tr', 'ho', 'nh', 'hh', 'ah', 'night', 'tech', 'pol', 'peek', 'rn', 'np', 'dm', 'gb', 'ed', 'sw', 'lv', 'bh', 'tw'];
  const checkRun = (id, r, days) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (r.rows.length !== days) throw new Error(`${id}：記了 ${r.rows.length} 列，要 ${days} 列`);
    r.rows.forEach((a, i) => {
      for (const k of NEED) if (a[k] === null || a[k] === undefined) throw new Error(`${id} 第 ${i + 1} 天 ${k} 讀不到`);
      if (a.tx.some(v => typeof v !== 'number') || a.inc.some(v => typeof v !== 'number') || a.ch.some(v => v === undefined || v === null)) throw new Error(`${id} 第 ${i + 1} 天 收入或鏈條有讀不到的欄位：${J(a.inc)} ${J(a.ch)}`);
    });
  };
  const isDone = (kind, t) => out[kind]?.[t.id]?.codeHash === fnv1a(t.code);
  const jobs = [...runs.filter(keep).filter(t => !isDone('runs', t)).map(t => ({ kind: 'runs', t })), ...rts.filter(keep).filter(t => !isDone('rt', t)).map(t => ({ kind: 'rt', t }))];
  const worker = async j => {
    const mine = jobs.filter((_, i) => i % JOBS === j);
    if (!mine.length) return;
    await withBrowser({ root: LAB, entry: 'd034.html', overlay: { 'd034.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d027ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const { kind, t } of mine) {
        await open('');
        const r = await page.evaluate(RUN(t.code, t.days));
        checkRun(t.id, r, t.days);
        out[kind][t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: compactRows(r.start, r.rows) };
        const a = r.rows[0], z = r.rows.at(-1);
        console.log(`${kind} ${t.id.padEnd(7)} ${String(t.days).padStart(3)} 天：第 1 天 人口 ${a.pop} 幸福 ${a.happy.toFixed(3)} 塔 ${a.tw}｜第 ${t.days} 天 人口 ${z.pop} 幸福 ${z.happy.toFixed(3)} 塔 ${z.tw}`);
        if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
        savePart(false);
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  savePart(true);
  out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000);
  if (!IDS) { const lack = [...runs.filter(c => !out.runs[c.id]).map(c => c.id), ...rts.filter(c => !out.rt[c.id]).map(c => `rt ${c.id}`)]; if (lack.length) throw new Error(`缺：${lack.join('、')}`); }
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（runs ${Object.keys(out.runs).length}、rt ${Object.keys(out.rt).length}，${out.seconds} 秒）`);
}

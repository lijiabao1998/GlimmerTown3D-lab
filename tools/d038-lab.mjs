// D038 驗收 3、4、5：科技與專精的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d038-lab.json，tools/unit-d038-live.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d038-lab.mjs --lab=../GlimmerTown-lab [--jobs=3] [--part=runs|plays|rt（只跑一部分，結果併進現有樣本）] [--ids=T1,P1（只跑幾筆）] [--out=別的路徑（除錯用）]
// 回退設定（tools/lab-configs.mjs fallback；存檔槽固定 3，不碰業主的存檔），每頁一個全新頁面、核對上一頁留的記號不在。三種跑法：
//   runs：T 系列（tools/d038-cities.mjs d038Runs：存檔直接帶 tech343、spec386 的自造城）連推 13 天，每天一列 row＝D034 的（tools/d034-lab.mjs）加三欄：tc＝techSave343() 的 JSON（進行中、進度、完成的清單）、
//     sp＝spec386、sd＝techSpeed343（每天的研究速度）；開頭那一列（start）另記讀進來那一刻的 tc／sp／資金。
//   plays：P 系列動作劇本（開始研究、選方向）連推 8 天：每一天推進之前按 acts，記每一個動作的回傳、按完的資金與科技狀態（探針直接叫實驗線的 startTech343、specPick386；介面的兩擊確認不在這裡）。
//   rt：本線自己推一段（研究進行到一半、剛完成、選了方向、玩家按過動作）、存檔，實驗線用 GV.importCode 讀「本線存出來的碼」再推 RT_DAYS 天。
// 探針是記憶體副本裡主程式收尾前的一段（tools/lab-configs.mjs injectLab；不用錨點、不插進 tick，行號不動）；讀的部分全是只讀；唯一會動實驗線狀態的是 peek（多擲一次 R()，本線同樣在每天結束時多擲一次）與劇本的動作。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { compactRows } from './d027-lab.mjs';
import { PROBE as PROBE34 } from './d034-lab.mjs';
import { d038Runs, d038Plays, TECH_DAYS } from './d038-cities.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { startResearch, chooseSpec } from '../src/sim/edit.ts';
import { techSave } from '../src/sim/rules/tech.ts';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify;
export const RT_DAYS = 3;   // rt：本線存出來的碼，實驗線讀進來再推幾天
export const RT_PLAYS = [['T9', 2], ['T10', 1], ['T11', 1], ['S3', 3], ['P1', 4], ['P5', 3]];   // [城或劇本, 本線先推幾天（劇本照 acts 按到那一天）再存]

// 本線的動作：回傳跟實驗線探針同形的 { ok, st }（st＝[techSave 的 JSON, 專精, 資金]）
export const stateOf = s => [J(techSave(s.tech, s.edu.tech)), s.edu.spec ?? '', s.money];
export function applyAct(s, a) {
  if (a[0] === 'tech') { const r = startResearch(s, a[1]); return { ok: r.ok, st: stateOf(s) }; }
  if (a[0] === 'spec') { const r = chooseSpec(s, a[1]); return { ok: r.ok, st: stateOf(s) }; }
  throw new Error('不認得的動作 ' + J(a));
}
let rtCache = null;
export function d038Rt() {
  if (rtCache) return rtCache;
  const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank, all = [...d038Runs(), ...d038Plays()];
  return rtCache = RT_PLAYS.map(([id, days]) => {
    const r = all.find(q => q.id === id), L = loadCode(r.code, KT, vrank); if (!L.ok) throw new Error(`rt ${id}：本線讀不進 ${L.error}`);
    for (let d = 1; d <= days; d++) { for (const x of (r.acts ?? []).filter(q => q.d === d)) applyAct(L.sim, x.a); stepDay(L.sim); }
    return { id: `${id}@${days}`, code: saveCode(L.sim, L.template, L.start), days: RT_DAYS };
  });
}

// 科技與專精的狀態：字串的格式本線 tools/unit-d038-live.mjs 逐字相同（tc＝techSave343 的 JSON、sp＝spec386、sd＝techSpeed343）
export const PROBE = PROBE34
  + `window.__d038st=()=>[JSON.stringify(techSave343()),spec386,money];`
  + `window.__d038act=a=>{let ok=null;if(a[0]==='tech')ok=startTech343(a[1]);else if(a[0]==='spec')ok=specPick386(a[1]);return {ok,st:window.__d038st()};};`
  + `window.__d038read=()=>{const r=window.__d034read();r.tc=JSON.stringify(techSave343());r.sp=spec386;r.sd=techSpeed343;return r;};`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../GlimmerTown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), IDS = arg('ids')?.split(','), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE);
  const runs = d038Runs(), plays = d038Plays(), rts = d038Rt(), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d038-lab.json'), old = (PART || IDS) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback' || old.source?.probe !== PROBE)) throw new Error('--part／--ids 要搭現有樣本，而且實驗線版本、設定與探針都要一樣（探針改過就整份重錄）');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d038-lab.mjs', probe: PROBE }, config: 'fallback', order: [], playOrder: [], rtOrder: [], runs: {}, plays: {}, rt: {}, seconds: 0 };
  out.order = runs.map(r => r.id); out.playOrder = plays.map(r => r.id); out.rtOrder = rts.map(r => r.id); out.rt ??= {};
  const partFile = file + '.part';
  let partSeconds = 0, lastSave = 0;
  if (fs.existsSync(partFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(partFile, 'utf8'));
      if (prev.source?.commit === commit && prev.source.probe === PROBE && prev.config === 'fallback') {
        for (const k of ['runs', 'plays', 'rt']) Object.assign(out[k], prev[k] ?? {});
        partSeconds = Math.max(0, (prev.seconds ?? 0) - (old?.seconds ?? 0));
        console.log(`續跑：${partFile} 已有 runs ${Object.keys(prev.runs ?? {}).length}、plays ${Object.keys(prev.plays ?? {}).length}、rt ${Object.keys(prev.rt ?? {}).length}`);
      }
    } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000); fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const keep = t => !IDS || IDS.includes(t.id);
  const RESET = `GV.setMapSize(72);GV.newWorldSeeded(777);`;
  const RUN = (code, days, acts = []) => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;window.__d027full=0;window.__d027agg=0;${RESET}const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d032start();start.tc=window.__d038st();const ACTS=${J(acts)};const rows=[],done=[];`
    + `for(let d=1;d<=${days};d++){for(const x of ACTS.filter(q=>q.d===d))done.push({d,a:x.a,r:window.__d038act(x.a)});GV.step(1);rows.push(window.__d038read());}return {seen,ok,start,rows,acts:done};})()`;
  const NEED = ['day', 'pop', 'jobs', 'happy', 'money', 'net', 'tx', 'inc', 'ng', 'un', 'uu', 'ch', 'fd', 'tr', 'ho', 'nh', 'hh', 'ah', 'night', 'tech', 'pol', 'peek', 'rn', 'np', 'dm', 'gb', 'ed', 'sw', 'lv', 'bh', 'tw', 'tc', 'sd'];
  const checkRun = (id, r, days) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (!Array.isArray(r.start.tc)) throw new Error(`${id}：讀進來那一刻的科技狀態讀不到`);
    if (r.rows.length !== days) throw new Error(`${id}：記了 ${r.rows.length} 列，要 ${days} 列`);
    r.rows.forEach((a, i) => {
      for (const k of NEED) if (a[k] === null || a[k] === undefined) throw new Error(`${id} 第 ${i + 1} 天 ${k} 讀不到`);
      if (a.tx.some(v => typeof v !== 'number') || a.inc.some(v => typeof v !== 'number') || a.ch.some(v => v === undefined || v === null)) throw new Error(`${id} 第 ${i + 1} 天 收入或鏈條有讀不到的欄位：${J(a.inc)} ${J(a.ch)}`);
    });
  };
  const isDone = (kind, t) => out[kind]?.[t.id]?.codeHash === fnv1a(t.code);
  const jobs = [...((!PART || PART === 'runs') ? runs.filter(keep).filter(t => !isDone('runs', t)).map(t => ({ kind: 'runs', t })) : []),
    ...((!PART || PART === 'plays') ? plays.filter(keep).filter(t => !isDone('plays', t)).map(t => ({ kind: 'plays', t })) : []),
    ...((!PART || PART === 'rt') ? rts.filter(keep).filter(t => !isDone('rt', t)).map(t => ({ kind: 'rt', t })) : [])];
  const worker = async j => {
    const mine = jobs.filter((_, i) => i % JOBS === j);
    if (!mine.length) return;
    await withBrowser({ root: LAB, entry: 'd038.html', overlay: { 'd038.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d027ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const { kind, t } of mine) {
        await open('');
        const r = await page.evaluate(RUN(t.code, t.days, t.acts ?? []));
        checkRun(t.id, r, t.days);
        out[kind][t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: compactRows(r.start, r.rows), ...(kind === 'plays' ? { acts: r.acts } : {}) };
        const a = r.rows[0], z = r.rows.at(-1);
        console.log(`${kind} ${t.id.padEnd(8)} ${String(t.days).padStart(3)} 天：讀進來 ${J(r.start.tc).slice(0, 90)}｜第 1 天 幸福 ${a.happy.toFixed(3)} 研究速度 ${a.sd}｜第 ${t.days} 天 幸福 ${z.happy.toFixed(3)} 狀態 ${z.tc.slice(0, 80)}${r.acts.length ? `｜動作 ${r.acts.map(x => x.r.ok ? 'O' : 'X').join('')}` : ''}`);
        if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
        savePart(false);
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  savePart(true);
  out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000);
  if (!IDS) {
    const lack = [...((!PART || PART === 'runs') ? runs.filter(c => !out.runs[c.id]).map(c => c.id) : []), ...((!PART || PART === 'plays') ? plays.filter(c => !out.plays[c.id]).map(c => c.id) : []), ...((!PART || PART === 'rt') ? rts.filter(c => !out.rt[c.id]).map(c => `rt ${c.id}`) : [])];
    if (lack.length) throw new Error(`缺：${lack.join('、')}`);
  }
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（runs ${Object.keys(out.runs).length}、plays ${Object.keys(out.plays).length}、rt ${Object.keys(out.rt).length}，${out.seconds} 秒）`);
}
void TECH_DAYS;

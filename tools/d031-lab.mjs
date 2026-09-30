// D031 驗收 3：城市等級的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d031-lab.json，tools/unit-d031-live.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=9181 node tools/d031-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--part=evolve|evolved|crafted|craftedK|old|nork（只跑一部分，結果併進現有樣本）] [--out=檔案]
// 跑法（回退設定 tools/lab-configs.mjs fallback、存檔槽固定 3，不碰業主的存檔；每座城一個全新頁面，核對上一頁留的記號不在；跟 D027、D028 的樣本同一批城）：
//   evolve：起步城 8 個種子從實驗線自己的起點連推 120 天（等級 Lv.1 → Lv.5，點數每天都在動）；
//   evolved：起步城第 30、70、110 天的實驗線存檔 24 份各推 12 天；
//   crafted／craftedK：自造城 J1–J17（D027）、K1–K16（D028）連推 13 天；
//   old：D022–D025 的 120 座城連推 10 天（等級橫跨 Lv.1–Lv.26：seed516 讀進來就在 Lv.26，點數卻只有幾千）；
//   nork：拿掉存檔裡的 rk 的舊檔（old 裡點數夠大的一批、evolved 的 24 份）只讀檔、不推進——實驗線缺 rk 時從點數往上爬（66971）。
// 每一列（GV.step(1) 之後讀，全是只讀的記錄，實驗線原檔不動）：[day, rankIdx, cityPoints, pop, cityHappy]；start＝讀檔之後、推進之前的同一組（讀檔那一刻的等級與點數）。
// 探針是記憶體副本裡主程式收尾前的一段只讀出口（tools/lab-configs.mjs injectLab；不用錨點、不插進 tick，行號不動），沒有亂數、不動實驗線狀態。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { codeWithSeed, decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { d027Cities, oldList, evolvedIds } from './d027-lab.mjs';
import { d028Cities } from './d028-lab.mjs';
import * as realDay from '../src/sim/day.ts';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const DAYS = { evolve: 120, evolved: 12, crafted: 13, craftedK: 13, old: 10, nork: 0 };
export const PROBE = `window.__d031ok=1;window.__d031read=()=>[day,rankIdx,cityPoints,pop,cityHappy];`;
// 拿掉 rk 的存檔碼（其他欄位原樣）：舊檔的樣子
export function withoutRk(code) {
  const r = decodeLabCode(code); if (!r.ok) throw new Error('碼解不開：' + r.error);
  const o = { ...r.save.raw }; delete o.rk;
  return encodeLabCode(o, { deflate: true });
}
export const KT = () => kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
const vrankOf = () => JSON.parse(read('src/content/samples/d009-live.json')).vrank;
// 缺 rk 的那一批：old 裡本線讀檔點數 ≥ 100 的城（等級會爬到 Lv.3 以上）＋ evolved 的 24 份
export function norkList() {
  const kt = KT(), vr = vrankOf(), out = [], d26 = JSON.parse(read('src/content/samples/d026-lab.json'));
  for (const c of oldList()) { const s = realDay.simFromSave(decodeLabCode(c.code).save, c.code, kt, vr); if (s.cityPoints >= 100) out.push({ id: 'old:' + c.id, code: withoutRk(c.code) }); }
  for (const id of evolvedIds()) { const [seed, d] = id.split('@'); out.push({ id: 'evolved:' + id, code: withoutRk(d26.evolve[seed].codes[d]) }); }
  return out;
}
export function jobsList() {
  const d26 = JSON.parse(read('src/content/samples/d026-lab.json')), startCode = read('src/content/samples/starter.code.txt').trim(), jobs = [];
  for (const seed of STARTER_SEEDS) jobs.push({ kind: 'evolve', id: String(seed), code: codeWithSeed(startCode, seed) });
  for (const id of evolvedIds()) { const [seed, d] = id.split('@'); jobs.push({ kind: 'evolved', id, code: d26.evolve[seed].codes[d] }); }
  for (const c of d027Cities()) jobs.push({ kind: 'crafted', id: c.id, code: c.code });
  for (const c of d028Cities()) jobs.push({ kind: 'craftedK', id: c.id, code: c.code });
  for (const c of oldList()) jobs.push({ kind: 'old', id: c.id, code: c.code });
  for (const c of norkList()) jobs.push({ kind: 'nork', id: c.id, code: c.code });
  return jobs.map(j => ({ ...j, days: DAYS[j.kind] }));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 9181;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d031-lab.json'), old = PART && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback' || old.source?.probe !== PROBE)) throw new Error('--part 要搭現有樣本，而且實驗線版本、設定與探針都要一樣');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d031-lab.mjs', probe: PROBE }, config: 'fallback', evolve: {}, evolved: {}, crafted: {}, craftedK: {}, old: {}, nork: {}, seconds: 0 };
  const partFile = file + '.part';
  if (fs.existsSync(partFile)) {   // 可續跑：同一份實驗線＋同一組探針錄的 .part，已經錄好的頁（碼雜湊相同）不再跑
    try { const prev = JSON.parse(fs.readFileSync(partFile, 'utf8')); if (prev.source?.commit === commit && prev.source.probe === PROBE) for (const k of Object.keys(DAYS)) Object.assign(out[k], prev[k] ?? {}); console.log(`續跑：${partFile}`); } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  let lastSave = 0;
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const isDone = t => out[t.kind]?.[t.id]?.codeHash === fnv1a(t.code);
  const RUN = (code, days) => `(()=>{const seen=!!window.__d031seen;window.__d031seen=1;GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d031read();const rows=[];`
    + `for(let d=1;d<=${days};d++){GV.step(1);rows.push(window.__d031read());}return {seen,ok,start,rows};})()`;
  const jobs = jobsList().filter(j => !PART || j.kind === PART);
  const worker = async j => {
    const mine = jobs.filter(t => !isDone(t)).filter((_, i) => i % JOBS === j);
    await withBrowser({ root: LAB, entry: 'd031.html', overlay: { 'd031.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d031ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const t of mine) {
        await open('');
        const r = await page.evaluate(RUN(t.code, t.days));
        if (r.seen) throw new Error(`${t.kind} ${t.id}：頁面上還留著上一座城的記號（不是新的文件）`);
        if (!r.ok) throw new Error(`${t.kind} ${t.id}：實驗線讀不進這張碼`);
        if (r.rows.length !== t.days) throw new Error(`${t.kind} ${t.id}：記了 ${r.rows.length} 列，要 ${t.days} 列`);
        for (const a of [r.start, ...r.rows]) if (a.some(v => typeof v !== 'number')) throw new Error(`${t.kind} ${t.id}：探針讀到不是數字的東西 ${J(a)}`);
        out[t.kind][t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: r.rows };
        const z = r.rows.at(-1) ?? r.start;
        console.log(`${t.kind} ${t.id.padEnd(14)} ${String(t.days).padStart(3)} 天：讀檔 Lv.${r.start[1] + 1}（${r.start[2]} 點）｜第 ${z[0]} 天 Lv.${z[1] + 1}（${z[2]} 點）人口 ${z[3]}`);
        if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
        savePart(false);
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  savePart(true);
  out.seconds = (old?.seconds ?? 0) + Math.round((Date.now() - t0) / 1000);
  for (const t of jobsList().filter(t => !PART || t.kind === PART)) if (!out[t.kind][t.id]) throw new Error(`${t.kind} 缺 ${t.id}`);
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（${Object.entries(DAYS).map(([k]) => `${k} ${Object.keys(out[k]).length}`).join('、')}；${out.seconds} 秒）`);
}

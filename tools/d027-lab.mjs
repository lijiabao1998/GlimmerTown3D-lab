// D027 驗收 3：通勤與壅堵的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d027-lab.json，tools/unit-d027-live.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d027-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--part=crafted|old|oldz|oldx|evolve|evolved（只跑一部分，結果併進現有樣本）] [--cities=J1,J4（只跑幾座自造城）] [--out=別的路徑（除錯用）]
// 四種跑法（回退設定 tools/lab-configs.mjs fallback、存檔槽固定 3，不碰業主的存檔；每座城／每個種子一個全新頁面，核對上一頁留的記號不在）：
//   crafted：自造城 J1–J17（tools/d027-cities.mjs）讀進來連推 13 天（涵蓋三次重算、四種重算相位），每天記一列 row（見下）；另存每一棟住宅的幸福清單 hl、幸福構成 agg 的每一項。
//   old：D022–D025 的 120 座城（tools/d025-lab.mjs d025Codes；分區清成 0＝不會長新房子，跟 D026 同一批），連推 10 天。這批城的道路與建築是各式各樣實驗線自己排出來的。
//   oldz：同一批 120 座城，分區不清（會長新房子、升級、廢棄……整條 tick 鏈，D026 因幸福與需求的差沒法這樣比；D027 起是目標），連推 10 天。
//   evolve：起步城 8 個種子從實驗線自己的起點連推 120 天，每天記一列 row（整城軌跡、逐日相等到第幾天、幸福構成 agg 逐項）。
//   evolved：起步城第 30、70、110 天的實驗線存檔 24 份（沿用 d026-lab.json 錄下來的碼；分區沒清、會長新房子）各推 12 天。
// 每天一列 row（推完一天之後讀，全是只讀的記錄，實驗線原檔不動）：day、pop、jobs、cityHappy、lg＝物流快照 logistics485 的 [物流效率（三位小數）、貿易額度]（道路負載進經濟的那一條線：壅堵扣分 pen 讀 roadLoad，效率與貿易額度跟著變；logisticsNow481 是 tick() 的區域變數、頁面外讀不到）、ah＝happyAgg（城市平均每一項幸福，實驗線 55255 的那份，57 項）的 64 位元浮點逐位雜湊（crafted 與 evolve 另存 agg 逐項，好指出是哪一項不同；old 與 evolved 只存雜湊，樣本才不會太大）、
//   rl＝roadLoad 的 FNV-1a（逐位元組；Float32Array 看它的每個 32 位元）、cp＝commutePenalty 的、cl＝[叢集數, 叢集路徑的雜湊]、ld＝LAND 的、lb＝LANDBASE 的、jc＝過載道路格數、nh＝住宅（k1、127）根格數、hh＝那些住宅的 [格, 幸福] 的雜湊（64 位元浮點逐位）、
//   night＝夜間城市（ready、safety.score、happinessDelta：明天用）、ev＝城市活動（T299：happy、food、tax；這一天的幸福與食物讀它）、tech＝科技 tq 用的 done 清單、peek＝下一個亂數（兩邊在每天結束時各多擲一次，相等＝這一天用掉的亂數次數與順序一樣）。
//   start（讀檔後第一天之前）：pol、tech、spec、night、ev、day。
// 探針是記憶體副本裡主程式收尾前的一段只讀出口（tools/lab-configs.mjs injectLab；不用錨點、不插進 tick，行號不動）；唯一會動實驗線狀態的是 peek（多擲一次 R()，本線同樣在每天結束時多擲一次）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { cities27 } from './d027-cities.mjs';
import { oldList, EVOLVE_MARKS } from './d026-lab.mjs';
import { d025Codes } from './d025-lab.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const CRAFTED_DAYS = 13, OLD_DAYS = 10, EVOLVE_DAYS = 120, EVOLVED_DAYS = 12;
export function d027Cities() { const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))); return cities27(read('src/content/samples/newcity.code.txt'), KT); }
export const evolvedIds = () => STARTER_SEEDS.flatMap(seed => EVOLVE_MARKS.map(d => `${seed}@${d}`));
// 樣本瘦身：政策 pol（近 700 位元組）、科技 tech、專精 spec 一座城裡幾乎不變，跟前一列（第 1 列跟 start）一樣就不存（讀的一邊往前找最近一次記的值）。冪等
export function compactRows(start, rows) {
  const last = { pol: start.pol, tech: start.tech, spec: start.spec };
  return rows.map(r => { const o = { ...r }; for (const k of ['pol', 'tech', 'spec']) { if (o[k] === last[k]) delete o[k]; else if (o[k] !== undefined) last[k] = o[k]; } return o; });
}
export { oldList };
// oldx：old 裡本線跟實驗線有差的幾座城（只差幸福、每天各項；差在哪一項＝哪個系統沒搬，樣本要留著逐項才驗得出來），這幾座另存 agg 逐項
export const OLDX = ['seed516', 'G14', 'D3'];
export const oldzList = () => d025Codes().map(c => ({ id: c.id, code: c.code }));   // 同一批城、分區不清（會長新房子：整條 tick 鏈，不只通勤）

// 頁面裡的探針（寫成一段、放在主程式收尾前，跟其他全域同一個作用域）
export const PROBE = `window.__d027ok=1;window.__d027full=0;window.__d027agg=0;window.__d027Q=f=>{try{return f()}catch(e){return null}};`
  + `window.__d027h=a=>{if(!a)return null;const u=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);let x=2166136261;for(let i=0;i<u.length;i++){x^=u[i];x=Math.imul(x,16777619);}return x>>>0;};`
  + `window.__d027night=()=>window.__d027Q(()=>({ready:!!nightCity487.ready,score:nightCity487.safety?nightCity487.safety.score:null,hd:nightCity487.happinessDelta}));`
  + `window.__d027ev=()=>window.__d027Q(()=>cityEvent?{i:cityEvent.i,left:cityEvent.daysLeft,happy:CITY_EVENTS[cityEvent.i].happy,food:CITY_EVENTS[cityEvent.i].food,tax:CITY_EVENTS[cityEvent.i].tax}:null);`
  + `window.__d027start=()=>({day,pol:window.__d027Q(()=>JSON.stringify(pol)),tech:window.__d027Q(()=>JSON.stringify(tech343.done)),spec:spec386,night:window.__d027night(),ev:window.__d027ev()});`
  + `window.__d027read=()=>{const h=window.__d027h,hs=[];for(let i=0;i<N*N;i++){const b=tiles[i].bld;if(b&&!b.ref&&(b.k===1||b.k===127))hs.push(i,b.h);}`
  + `const cl=[];for(const c of commuteClusters){cl.push(c.path.length);for(const j of c.path)cl.push(j);}let jc=0;for(let i=0;i<N*N;i++){const t=tiles[i];if(t.road&&roadLoad[i]>roadCap475(t))jc++;}`
  + `const ag=(happyAgg||[]).map(p=>p.val);const r={day,pop,jobs,happy:cityHappy,ah:h(Float64Array.from(ag)),rl:h(roadLoad),cp:h(commutePenalty),cl:[commuteClusters.length,h(Int32Array.from(cl))],ld:h(LAND),lb:h(LANDBASE),jc,nh:hs.length/2,hh:h(new Float64Array(hs)),`
  + `lg:window.__d027Q(()=>[logistics485.logisticsEfficiency,logistics485.tradeCapacity]),night:window.__d027night(),ev:window.__d027ev(),tech:window.__d027Q(()=>JSON.stringify(tech343.done)),pol:window.__d027Q(()=>JSON.stringify(pol)),spec:spec386,peek:R()};if(window.__d027agg)r.agg=ag;if(window.__d027full)r.hl=hs;return r;};`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), ONLY = arg('cities')?.split(','), PART = arg('part');
  if (process.argv.includes('--compact')) {   // 只瘦身現有樣本（不開瀏覽器）：pol／tech／spec 跟前一列一樣的不存
    const f = path.join(ROOT, 'src/content/samples/d027-lab.json'), j = JSON.parse(fs.readFileSync(f, 'utf8')), before = fs.statSync(f).size;
    for (const k of ['crafted', 'old', 'oldz', 'oldx', 'evolve', 'evolved']) for (const c of Object.values(j[k] ?? {})) c.rows = compactRows(c.start, c.rows);
    fs.writeFileSync(f, JSON.stringify(j)); console.log(`瘦身 ${path.relative(ROOT, f)}：${before} → ${fs.statSync(f).size} 位元組`); process.exit(0);
  }
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE);
  const all = d027Cities(), crafted = ONLY ? all.filter(c => ONLY.includes(c.id)) : all, t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d027-lab.json'), old = (PART || ONLY) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old) { old.oldz ??= {}; old.oldx ??= {}; }
  if (old && (old.source?.commit !== commit || old.config !== 'fallback' || old.source?.probe !== PROBE)) throw new Error('--part／--cities 要搭現有樣本，而且實驗線版本、設定與探針都要一樣（探針改過就整份重錄）');
  const lab26 = JSON.parse(read('src/content/samples/d026-lab.json'));
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d027-lab.mjs', probe: PROBE }, config: 'fallback', order: all.map(c => c.id), oldOrder: oldList().map(c => c.id), crafted: {}, old: {}, oldz: {}, oldx: {}, evolve: {}, evolved: {}, seconds: 0 };
  // 可續跑（同 tools/d026-lab.mjs）：每完成一頁就（隔幾秒）寫一次 .part，開跑時如果有同一份實驗線＋同一組探針錄的 .part，已經錄好的頁（碼雜湊相同）不再跑
  const partFile = file + '.part';
  let partSeconds = 0, lastSave = 0;
  if (fs.existsSync(partFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(partFile, 'utf8'));
      if (prev.source?.commit === commit && prev.source.probe === PROBE && prev.config === 'fallback') {
        for (const k of ['crafted', 'old', 'oldz', 'oldx', 'evolve', 'evolved']) Object.assign(out[k], prev[k] ?? {});
        partSeconds = Math.max(0, (prev.seconds ?? 0) - (old?.seconds ?? 0));   // .part 裡的秒數已含 old 的，不重複加
        console.log(`續跑：${partFile} 已有 自造城 ${Object.keys(prev.crafted ?? {}).length}、舊城 ${Object.keys(prev.old ?? {}).length}＋${Object.keys(prev.oldz ?? {}).length}（分區不清）、起步城 ${Object.keys(prev.evolve ?? {}).length}、長出來的存檔 ${Object.keys(prev.evolved ?? {}).length}`);
      }
    } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000); fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const isDone = t => out[t.kind]?.[t.id]?.codeHash === fnv1a(t.code);
  const RUN = (code, days, full, agg) => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;window.__d027full=${full ? 1 : 0};window.__d027agg=${agg ? 1 : 0};GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d027start();const rows=[];`
    + `for(let d=1;d<=${days};d++){GV.step(1);rows.push(window.__d027read());}return {seen,ok,start,rows};})()`;
  const check = (id, r, days) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (r.rows.length !== days) throw new Error(`${id}：記了 ${r.rows.length} 列，要 ${days} 列`);
    r.rows.forEach((a, i) => { for (const k of ['day', 'pop', 'jobs', 'happy', 'ah', 'lg', 'rl', 'cp', 'cl', 'ld', 'lb', 'jc', 'nh', 'hh', 'night', 'tech', 'pol', 'peek']) if (a[k] === null || a[k] === undefined) throw new Error(`${id} 第 ${i + 1} 天 ${k} 讀不到`); });
  };
  const jobs = [];   // { kind, id, code, days, full }
  if (!PART || PART === 'crafted') for (const c of crafted) jobs.push({ kind: 'crafted', id: c.id, code: c.code, days: c.days, full: true, agg: true });
  if ((!PART || PART === 'old') && !ONLY) for (const c of oldList()) jobs.push({ kind: 'old', id: c.id, code: c.code, days: OLD_DAYS });
  if ((!PART || PART === 'oldx') && !ONLY) for (const c of oldList().filter(q => OLDX.includes(q.id))) jobs.push({ kind: 'oldx', id: c.id, code: c.code, days: OLD_DAYS, agg: true });
  if ((!PART || PART === 'oldz') && !ONLY) for (const c of oldzList()) jobs.push({ kind: 'oldz', id: c.id, code: c.code, days: OLD_DAYS });
  if ((!PART || PART === 'evolve') && !ONLY) { const startCode = read('src/content/samples/starter.code.txt').trim(); for (const seed of STARTER_SEEDS) jobs.push({ kind: 'evolve', id: String(seed), code: codeWithSeed(startCode, seed), days: EVOLVE_DAYS, agg: true }); }
  if ((!PART || PART === 'evolved') && !ONLY) for (const seed of STARTER_SEEDS) for (const d of EVOLVE_MARKS) { const c = lab26.evolve?.[seed]?.codes?.[d]; if (typeof c !== 'string') throw new Error(`d026-lab.json 沒有起步城 ${seed} 第 ${d} 天的存檔`); jobs.push({ kind: 'evolved', id: `${seed}@${d}`, code: c, days: EVOLVED_DAYS }); }
  const runJobs = async list => {
    const worker = async j => {
      const mine = list.filter(t => !isDone(t)).filter((_, i) => i % JOBS === j);
      await withBrowser({ root: LAB, entry: 'd027.html', overlay: { 'd027.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d027ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
        for (const t of mine) {
          await open('');
          const r = await page.evaluate(RUN(t.code, t.days, t.full, t.agg));
          check(`${t.kind} ${t.id}`, r, t.days);
          out[t.kind][t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: compactRows(r.start, r.rows) };
          const a = r.rows[0], z = r.rows.at(-1);
          console.log(`${t.kind} ${t.id.padEnd(10)} ${String(t.days).padStart(3)} 天：第 1 天 叢集 ${a.cl[0]} 過載 ${a.jc} 幸福 ${a.happy.toFixed(3)}｜第 ${t.days} 天 叢集 ${z.cl[0]} 過載 ${z.jc} 幸福 ${z.happy.toFixed(3)} 人口 ${z.pop} 職位 ${z.jobs}`);
          if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
          savePart(false);
        }
      });
    };
    await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
    savePart(true);
  };
  await runJobs(jobs);
  out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000);
  const lack = all.filter(c => !out.crafted[c.id]).map(c => c.id);
  if (!ONLY && (!PART || PART === 'crafted') && lack.length) throw new Error(`crafted 缺城：${lack.join('、')}`);
  if (!ONLY && (!PART || PART === 'old') && oldList().some(c => !out.old[c.id])) throw new Error('old 缺城');
  if (!ONLY && (!PART || PART === 'oldz') && oldzList().some(c => !out.oldz[c.id])) throw new Error('oldz 缺城');
  if (!ONLY && (!PART || PART === 'oldx') && OLDX.some(id => !out.oldx[id])) throw new Error('oldx 缺城');
  if (!ONLY && (!PART || PART === 'evolve') && Object.keys(out.evolve).length !== STARTER_SEEDS.length) throw new Error('evolve 缺種子');
  if (!ONLY && (!PART || PART === 'evolved') && evolvedIds().some(id => !out.evolved[id])) throw new Error('evolved 缺存檔');
  out.crafted = Object.fromEntries(all.filter(c => out.crafted[c.id]).map(c => [c.id, out.crafted[c.id]]));
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（自造城 ${Object.keys(out.crafted).length} 座、舊城 ${Object.keys(out.old).length}＋${Object.keys(out.oldz).length}（分區不清）座、起步城 ${Object.keys(out.evolve).length} 個種子的 ${EVOLVE_DAYS} 天、長出來的存檔 ${Object.keys(out.evolved).length} 份，${out.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);
}

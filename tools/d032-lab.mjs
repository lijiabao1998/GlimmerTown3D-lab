// D032 驗收 3、6：政策與預算的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d032-lab.json，tools/unit-d032-live.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=/opt/pw-browsers/chromium TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d032-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=4] [--part=runs|play|rt（只跑一部分，結果併進現有樣本）] [--ids=P1/all,K1/hi（只跑幾筆）] [--out=別的路徑（除錯用）]
// 回退設定（tools/lab-configs.mjs fallback，T504 政策治理關；存檔槽固定 3，不碰業主的存檔），每筆一個全新頁面、核對上一頁留的記號不在。三種跑法：
//   runs：底城 × 政策組（tools/d032-cities.mjs d032Runs：政策寫在存檔的 pol 欄位，實驗線讀檔時 `if(d.pol)pol=d.pol`＝玩家讀一張有政策的存檔；先 rebuildCov、後設 pol，營養午餐的讀檔怪癖也在裡面）連推 10／13 天；
//   play：玩家在遊戲中按按鈕（tools/d032-cities.mjs PLAY：政策勾選、稅率＋／−、服務預算）——實驗線頁面用自己的 policyApply504（玩家路徑）、polStep 的算式、setSvcBudget 按，每一天逐欄記；
//   rt：本線自己玩一段（同一份 PLAY 的動作）、存檔，實驗線用 GV.importCode 讀「本線存出來的碼」再推 2 天——實驗線讀得進本線存的 pol，讀進來的政策與之後的數字要跟本線一樣。
// 每天一列 row＝D028 的（tools/d028-lab.mjs：資金不取整、淨額、稅、十二個其餘收入、鏈條、食物、旅宿、每一棟住宅的幸福、幸福構成 57 項、夜間城市、下一個亂數…）加這一張的五欄：
//   rn＝焦土格數（燒毀的棟數看它的增量）、np＝有電的住商工棟數、dm＝住宅／商業／工業需求、gb＝[垃圾量, 容量, 比例]、ed＝教育場 EDU 的逐位元組雜湊（營養午餐與預算的重算、讀檔怪癖）；start 另有 ed（讀檔那一刻）與 sb（服務預算）。
// 探針是記憶體副本裡主程式收尾前的一段（tools/lab-configs.mjs injectLab；不用錨點、不插進 tick，行號不動）；讀的部分全是只讀；唯一會動實驗線狀態的是 peek（多擲一次 R()，本線同樣在每天結束時多擲一次）與
// play／rt 的按鈕（那正是要測的玩家動作）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { setPolicy, setBudget } from '../src/sim/edit.ts';
import { stepTax } from '../src/sim/rules/policy.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { PROBE as PROBE28 } from './d028-lab.mjs';
import { compactRows } from './d027-lab.mjs';
import { d032Runs, d032Play, PLAY_DAYS } from './d032-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const RT_DAYS = 2;   // rt：本線存出來的碼，實驗線讀進來再推幾天

// 玩家的動作（本線這一邊）：跟實驗線 __d032act 對應。bud 的回傳沒意義（setSvcBudget 不回真假），寫成 null，兩邊都不比
export function applyAct(s, a, fns = { setPolicy, setBudget }) {   // fns：守衛拿改壞的 edit.ts 來跑時換進去
  if (a.pol) return fns.setPolicy(s, a.pol[0], a.pol[1]).ok;
  if (a.tax) { const k = a.tax[0]; return fns.setPolicy(s, k, stepTax(s.pol ? s.pol[k] : 1, a.tax[1])).ok; }   // polStep：倍率 ± 0.1 取兩位，再進 policyApply504（沒有 pol 時面板先補預設物件＝稅率 1）
  if (a.bud) { fns.setBudget(s, a.bud[0], a.bud[1]); return null; }
  throw new Error(`不認得的動作 ${J(a)}`);
}
// rt：本線自己玩的一段（tools/d032-cities.mjs PLAY 的動作、玩到 days 天）再存檔——存出來的碼給實驗線讀
export const RT_PLAYS = { 'P4/play1': 7, 'K7/play1': 6, 'gallery/play1': 7, 'P1/play1': 5 };
let rtCache = null;
export function d032Rt() {
  if (rtCache) return rtCache;
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  return rtCache = d032Play().filter(p => RT_PLAYS[p.id]).map(p => {
    const L = loadCode(p.code, KT, vrank); if (!L.ok) throw new Error(`rt ${p.id}：本線讀不進 ${L.error}`);
    const s = L.sim, days = RT_PLAYS[p.id];
    for (let d = 1; d <= days; d++) { for (const a of p.acts.filter(x => x.day === d)) applyAct(s, a); stepDay(s); }
    return { id: `${p.id}@${days}`, code: saveCode(s, L.template, L.start), days: RT_DAYS };
  });
}

// 頁面裡的探針：D028 的（提供雜湊、夜間城市、城市活動、start、每日讀取）加上這一張的每日五欄、讀檔那一刻的 EDU 與預算、玩家的動作
export const PROBE = PROBE28
  + `window.__d032read=()=>{const Q=window.__d027Q,r=window.__d028read();let rn=0,np=0;for(let i=0;i<N*N;i++){const t=tiles[i];if(t.ruin)rn++;const b=t.bld;if(b&&!b.ref&&(b.k<=3||b.k===127)&&b.pw)np++;}`
  + `r.rn=rn;r.np=np;r.dm=[dem[1],dem[2],dem[3]];r.gb=[garbage,garbCap,garbRatio];r.ed=window.__d027h(EDU);return r;};`
  + `window.__d032start=()=>{const s=window.__d027start();s.ed=window.__d027h(EDU);s.sb=window.__d027Q(()=>JSON.stringify(svcBudget));return s;};`
  + `window.__d032act=a=>{const Q=window.__d027Q;let ok=null;if(a.pol){ok=Q(()=>policyApply504(a.pol[0],a.pol[1],{source:'player',reason:'玩家在市政統計面板調整'}));}`
  + `else if(a.tax){Q(()=>{if(!pol)mayorEnsurePolicy470A();});const k=a.tax[0],next=Math.max(.5,Math.min(2,Math.round((pol[k]+a.tax[1]*.1)*100)/100));ok=Q(()=>policyApply504(k,next,{source:'player',reason:'玩家在市政統計面板調整'}));}`
  + `else if(a.bud){Q(()=>setSvcBudget(a.bud[0],a.bud[1]));}return {ok,pol:Q(()=>JSON.stringify(pol)),ed:window.__d027h(EDU),sb:Q(()=>JSON.stringify(svcBudget)),day};};`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), IDS = arg('ids')?.split(','), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE);
  const runs = d032Runs(), play = d032Play(), rt = d032Rt(), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d032-lab.json'), old = (PART || IDS) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback' || old.source?.probe !== PROBE)) throw new Error('--part／--ids 要搭現有樣本，而且實驗線版本、設定與探針都要一樣（探針改過就整份重錄）');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d032-lab.mjs', probe: PROBE }, config: 'fallback', order: runs.map(r => r.id), playOrder: play.map(p => p.id), rtOrder: rt.map(r => r.id), runs: {}, play: {}, rt: {}, seconds: 0 };
  if (old) { out.order = runs.map(r => r.id); out.playOrder = play.map(p => p.id); out.rtOrder = rt.map(r => r.id); }   // 併進現有樣本時順序清單照現在的（新增的筆數用 --ids 補錄）
  // 可續跑（同 tools/d028-lab.mjs）：每完成一頁就（隔幾秒）寫一次 .part，開跑時如果有同一份實驗線＋同一組探針錄的 .part，已經錄好的頁（碼雜湊相同）不再跑
  const partFile = file + '.part';
  let partSeconds = 0, lastSave = 0;
  if (fs.existsSync(partFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(partFile, 'utf8'));
      if (prev.source?.commit === commit && prev.source.probe === PROBE && prev.config === 'fallback') {
        for (const k of ['runs', 'play', 'rt']) Object.assign(out[k], prev[k] ?? {});
        partSeconds = Math.max(0, (prev.seconds ?? 0) - (old?.seconds ?? 0));
        console.log(`續跑：${partFile} 已有 runs ${Object.keys(prev.runs ?? {}).length}、play ${Object.keys(prev.play ?? {}).length}、rt ${Object.keys(prev.rt ?? {}).length}`);
      }
    } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000); fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const isDone = t => out[t.kind]?.[t.id]?.codeHash === fnv1a(t.code);
  const RUN = (code, days, acts) => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;window.__d027full=0;window.__d027agg=0;GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d032start();const rows=[],ar=[],acts=${J(acts)};`
    + `for(let d=1;d<=${days};d++){for(const a of acts.filter(x=>x.day===d))ar.push({d,a,r:window.__d032act(a)});GV.step(1);rows.push(window.__d032read());}return {seen,ok,start,rows,ar};})()`;
  const NEED = ['day', 'pop', 'jobs', 'happy', 'money', 'net', 'tx', 'inc', 'ng', 'un', 'uu', 'ch', 'fd', 'tr', 'ho', 'nh', 'hh', 'ah', 'night', 'tech', 'pol', 'peek', 'rn', 'np', 'dm', 'gb', 'ed'];
  const check = (id, r, days, nActs) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (r.rows.length !== days) throw new Error(`${id}：記了 ${r.rows.length} 列，要 ${days} 列`);
    if (r.ar.length !== nActs) throw new Error(`${id}：按了 ${r.ar.length} 個動作，要 ${nActs} 個`);
    if (r.start.ed == null) throw new Error(`${id}：start 沒有 EDU 雜湊`);
    r.rows.forEach((a, i) => {
      for (const k of NEED) if (a[k] === null || a[k] === undefined) throw new Error(`${id} 第 ${i + 1} 天 ${k} 讀不到`);
      if (a.tx.some(v => typeof v !== 'number') || a.inc.some(v => typeof v !== 'number') || a.ch.some(v => v === undefined || v === null)) throw new Error(`${id} 第 ${i + 1} 天 收入或鏈條有讀不到的欄位：${J(a.inc)} ${J(a.ch)}`);
      if (a.un.some(v => typeof v !== 'number') || a.uu.some(v => typeof v !== 'number') || typeof a.ng !== 'number' || typeof a.net !== 'number') throw new Error(`${id} 第 ${i + 1} 天 沒搬的收入／維護費、晚間消費金或淨額讀不到`);
    });
    for (const x of r.ar) if (x.r.pol === null || x.r.ed === null) throw new Error(`${id} 第 ${x.d} 天的動作 ${J(x.a)} 之後讀不到政策或 EDU：${J(x.r)}`);
  };
  const jobs = [];   // { kind, id, code, days, acts }
  const keep = t => !IDS || IDS.includes(t.id);
  if (!PART || PART === 'runs') for (const c of runs) jobs.push({ kind: 'runs', id: c.id, code: c.code, days: c.days, acts: [] });
  if (!PART || PART === 'play') for (const c of play) jobs.push({ kind: 'play', id: c.id, code: c.code, days: c.days, acts: c.acts });
  if (!PART || PART === 'rt') for (const c of rt) jobs.push({ kind: 'rt', id: c.id, code: c.code, days: c.days, acts: [] });
  const todo = jobs.filter(keep);
  const runJobs = async list => {
    const worker = async j => {
      const mine = list.filter(t => !isDone(t)).filter((_, i) => i % JOBS === j);
      if (!mine.length) return;
      await withBrowser({ root: LAB, entry: 'd032.html', overlay: { 'd032.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d027ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
        for (const t of mine) {
          await open('');
          const r = await page.evaluate(RUN(t.code, t.days, t.acts));
          check(`${t.kind} ${t.id}`, r, t.days, t.acts.length);
          out[t.kind][t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: compactRows(r.start, r.rows), ...(t.acts.length ? { acts: r.ar } : {}) };
          const a = r.rows[0], z = r.rows.at(-1);
          console.log(`${t.kind} ${t.id.padEnd(22)} ${String(t.days).padStart(3)} 天：第 1 天 錢 ${a.money.toFixed(2)} 有電 ${a.np} 焦土 ${a.rn}｜第 ${t.days} 天 錢 ${z.money.toFixed(2)} 人口 ${z.pop} 有電 ${z.np} 焦土 ${z.rn}${t.acts.length ? `｜動作 ${t.acts.length} 個（成功 ${r.ar.filter(x => x.r.ok === true).length}）` : ''}`);
          if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
          savePart(false);
        }
      });
    };
    await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
    savePart(true);
  };
  await runJobs(todo);
  out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000);
  if (!IDS) {
    for (const [part, list, key] of [['runs', runs, 'runs'], ['play', play, 'play'], ['rt', rt, 'rt']]) if (!PART || PART === part) { const lack = list.filter(c => !out[key][c.id]).map(c => c.id); if (lack.length) throw new Error(`${key} 缺：${lack.join('、')}`); }
  }
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（runs ${Object.keys(out.runs).length}、play ${Object.keys(out.play).length}、rt ${Object.keys(out.rt).length}，${out.seconds} 秒）`);
}

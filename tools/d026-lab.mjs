// D026 驗收 3：每日災禍的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d026-lab.json，tools/unit-d026-live.mjs 在 CI 上重算本線那一半逐座比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d026-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--part=crafted|evolve|evolved|old|rt（只跑一部分，結果併進現有樣本）] [--cities=H1,H4（只跑幾座自造城）] [--out=別的路徑（除錯用）]
// 三種跑法（回退設定 tools/lab-configs.mjs fallback、存檔槽固定 3，不碰業主的存檔；每座城／每個種子一個全新頁面，核對上一頁留的記號不在）：
//   crafted：自造城 15 座（tools/d026-cities.mjs）讀進來連推幾天（H6 六天、其餘五天）。每天記兩個探針：H0（死亡前置之前）讀輸入——所有帶旗標的建築、焦土、政策與科技與專精、夜間城市的治安分數、上一天的醫療容量、
//     實驗線用到的覆蓋場（雜湊）；H2（疾病與死亡之後、夜間城市結算之前）讀輸出——所有帶旗標的建築、焦土、死亡前置的幸福標記、床位（容量、今日治癒、今日滯留）、同時病患數、污染場的雜湊。
//     另外在 H2 用實驗線的亂數多擲一次（peek）：本線在那一天結束後也多擲一次，兩邊下一個亂數相等＝這一天災禍用掉的亂數次數與順序都一樣；之後的每一天也從同一個位置接著走。
//   evolve：起步城 8 個種子從實驗線自己的起點連推 120 天，在第 30、70、110 天各存一份存檔（分享碼）；每天記 H2 的各種旗標「個數」與旗標清單＋焦土的雜湊（整城軌跡的統計比對、逐日相等到第幾天用）。存檔用本線的 encodeLabCode 重新壓縮才進樣本。
//   evolved：把上面存的 24 份存檔（分區清成 0，見 noZone）各自讀進一個全新頁面、連推兩天，同樣記 H0／H2／peek（這是「實驗線自己長出來的城」：有真的生長留下的建築、覆蓋與旗標分布）。
//   rt：本線存出來的碼給實驗線讀（RT_IDS 幾座自造城：本線讀進來、不推進、直接存檔）——實驗線讀到的旗標、焦土、覆蓋場與之後那一天，要跟原本那座自造城逐項相同（實驗線讀得懂本線寫的七個災禍圖層與 bl 第 6 位）。
//   old：D022–D025 的 120 座城（tools/d025-lab.mjs 的 d025Codes：預建城 8 座、AI 城、種子城、全種類城、自造的各種覆蓋與設施；分區清成 0）讀進來推一天，同樣記 H0／H2／peek——
//     這些城多半沒有旗標，看的是「災禍段加進去之後，每一種設施的覆蓋場、亂數位置都還跟實驗線一樣」。
// 探針是記憶體副本裡兩段只讀的記錄（同 tools/d024-lab.mjs、tools/d025-lab.mjs 的做法：寫成一行、不加換行，行號不動；實驗線原檔不動）。peek 是唯一會動到實驗線亂數流的地方，只有 crafted 與 evolved 開（evolve 不開，起步城的自然軌跡不受影響）。
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
import { cities26 } from './d026-cities.mjs';
import { d025Codes } from './d025-lab.mjs';
import { loadCode, saveCode } from '../src/io/save.ts';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const ANCHOR_H0 = '// 死亡與墓園前置處理（T38）：既有死亡事件的懲罰標記與自動消退', ANCHOR_H2 = 'nightCity487=finalizeNightCity487({';
export const COV_NAMES = ['fire', 'fire2', 'fireHQ', 'firewatch', 'police', 'police2', 'prison', 'court', 'hospital', 'ambulance', 'megahosp', 'medcamp', 'clinic', 'cemetery', 'cem2', 'crem', 'pump', 'resilience', 'shelter'];
// 頁面裡的小工具：Q＝讀不到就回 null；h＝FNV-1a（逐位元組，同 tools/unit-d026-live.mjs 的 hashBytes）；FL＝所有帶旗標的建築（依格子序）：[格, 種類, 燃燒, 犯罪, 犯罪天數, 病, 病天數, 死, 死亡天數, 廢棄]
const PRE = 'const Q=f=>{try{return f()}catch(e){return null}},h=a=>{if(!a)return null;let x=2166136261;for(let i=0;i<a.length;i++){x^=a[i];x=Math.imul(x,16777619);}return x>>>0;},'
  + 'FL=()=>{const o=[];for(const i of tickBld){const b=tiles[i].bld;if(b&&!b.ref&&(b.fire||b.crime||b.sick||b.death||b.abandoned||b.crimeDays||b.sickDays||b.deathAge))o.push([i,b.k,b.fire|0,b.crime?1:0,b.crimeDays|0,b.sick?1:0,b.sickDays|0,b.death?1:0,b.deathAge|0,b.abandoned?1:0]);}return o;},'
  + 'RN=()=>{const o=[];for(let i=0;i<N*N;i++)if(tiles[i].ruin)o.push(i);return o;};';
export const PROBE_H0 = `if(window.__d026H0)window.__d026H0.push((()=>{${PRE}return{day,n:tickBld.length,fl:FL(),rn:RN(),pol:Q(()=>JSON.stringify(pol)),tech:Q(()=>JSON.stringify(tech343.done)),spec:spec386,dis:Q(()=>!!disastersOn),drought:Q(()=>!!drought),`
  + `civic:Q(()=>({ready:!!civic495.ready,no:!!window.__noCivicServices495})),night:Q(()=>({ready:!!nightCity487.ready,score:nightCity487.safety?nightCity487.safety.score:null})),fs:Q(()=>({ok:!!(flowStat384&&flowStat384.ok),cap:flowStat384&&flowStat384.med?flowStat384.med.cap:null})),`
  + `lb:h(LANDBASE),ld:h(LAND),cov:Q(()=>{const c={};for(const n of ${J(COV_NAMES)})c[n]=h(COV[n]);return c;})};})());`;
export const PROBE_H2 = `if(window.__d026H2)window.__d026H2.push((()=>{${PRE}const pen=[];for(let i=0;i<deathPenalty.length;i++)if(deathPenalty[i])pen.push(i);`
  + `return{fl:FL(),rn:RN(),pen,med:Q(()=>({cap:medCap387,cured:medCured387,queued:medQueued387})),sickN:Q(()=>sickN387),pol:h(POL),peek:window.__d026peek?R():null};})());`;
const NEED_H0 = ['day', 'n', 'fl', 'rn', 'pol', 'tech', 'spec', 'dis', 'civic', 'night', 'fs', 'lb', 'ld', 'cov'], NEED_H2 = ['fl', 'rn', 'pen', 'med', 'sickN', 'pol'];

export const CRAFTED_DAYS = { default: 5, H6: 6 };
export const EVOLVE_DAYS = 120, EVOLVE_MARKS = [30, 70, 110], EVOLVED_DAYS = 2;

export function d026Cities() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), newcity = read('src/content/samples/newcity.code.txt');
  return cities26(newcity, KT).map(c => ({ ...c, days: CRAFTED_DAYS[c.id] ?? CRAFTED_DAYS.default }));
}
// 只留「沒有分區」的存檔：分區清成 0＝不會長新房子（兩邊推進之後建築只會因火災燒毀而變少）。
// 為什麼要清：實驗線的城市幸福與住宅需求本線還有已知的差（通勤與壅堵、夜間城市、政策等系統還沒搬，D027 起才補），讀進來的第 1 天，生長段每個候選的機率就有小差
//（實測 5162026 第 70 天的存檔：城市幸福 .230 對 .274、住宅需求 −0.5026 對 −0.4938，跨過 −0.5 的停長門檻），兩邊長在不同的格子，災禍段迴圈的建築就不一樣、亂數位置跟著錯開。
// 災禍本身跟生長無關，所以拿掉分區來對災禍；起步城帶分區的完整軌跡另外記（evolve），不判相等、只記逐日相等到第幾天。
export const noZone = code => {
  const S = decodeLabCode(code).save, raw = { ...S.raw };
  raw.zn = '0'.repeat(S.n * S.n); delete raw.z; delete raw.d3;
  return encodeLabCode(raw, { deflate: true });
};
let oldCache = null;   // 一百多座城的碼要生、要重壓，做一次就好
export const oldList = () => oldCache ??= d025Codes().map(c => ({ id: c.id, code: noZone(c.code) }));
export const evolvedIds = () => STARTER_SEEDS.flatMap(seed => EVOLVE_MARKS.map(d => `${seed}@${d}`));

// H0 存成樣本：第 1 天存全部，之後只留不含旗標清單的部分（清單靠昨天的 H2 推得）；H2 每天都留完整旗標清單（第一個對不上的建築要看得到）
export const packH0 = (a, first) => first ? a : (({ fl, rn, cov, ...r }) => ({ ...r, nfl: fl.length, hfl: fnv1a(J(fl)), nrn: rn.length }))(a);   // lb、ld（地價基準與動態地價的雜湊）每天都留

// rt：本線存出來的碼（讀進自造城、一天都不推、存檔）給實驗線讀：讀進來的旗標與焦土與覆蓋場、之後那一天，要跟原本那座自造城逐項相同（實驗線讀得懂我們寫的七個圖層與 bl 第 6 位）
export const RT_IDS = ['H1', 'H3', 'H4', 'H5', 'H8', 'H9'];
let rtCache = null;
export function rtList() {
  if (rtCache) return rtCache;
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  return rtCache = d026Cities().filter(c => RT_IDS.includes(c.id)).map(c => { const L = loadCode(c.code, KT, vrank); if (!L.ok) throw new Error(`rt ${c.id}：本線讀不進 ${L.error}`); return { id: c.id, code: saveCode(L.sim, L.template, L.start), days: 1 }; });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), ONLY = arg('cities')?.split(','), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  for (const [n, a, p] of [['H0', ANCHOR_H0, PROBE_H0], ['H2', ANCHOR_H2, PROBE_H2]]) if (html.split(a).length !== 2 || p.includes('\n')) throw new Error(`探針 ${n} 的錨點要剛好出現 1 次、探針寫成一行`);
  const probed = html.replace(ANCHOR_H0, () => PROBE_H0 + ANCHOR_H0).replace(ANCHOR_H2, () => PROBE_H2 + ANCHOR_H2);
  if (probed.split('\n').length !== html.split('\n').length) throw new Error('副本多出了換行：行號對不上原檔');
  const copy = injectLab(probed, 'window.__d026ok=1;');
  const all = d026Cities(), crafted = ONLY ? all.filter(c => ONLY.includes(c.id)) : all, t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d026-lab.json'), old = (PART || ONLY) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback')) throw new Error('--part／--cities 要搭現有樣本，而且實驗線版本與設定要一樣');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d026-lab.mjs', probeH0: PROBE_H0, probeH2: PROBE_H2 }, config: 'fallback', order: all.map(c => c.id), oldOrder: oldList().map(c => c.id), crafted: {}, evolve: {}, evolved: {}, old: {}, rt: {}, seconds: 0 };
  out.old ??= {}; out.rt ??= {}; out.oldOrder = oldList().map(c => c.id);   // 現有樣本可能是加 old、rt 之前錄的
  // 可續跑：錄一百多頁要二十幾分鐘，中途被打斷（容器重啟、手動停）就從 .part 接著錄——每完成一頁就（隔幾秒）寫一次 .part，
  // 開跑時如果有同一份實驗線＋同一組探針錄的 .part，已經錄好的頁（碼雜湊相同）不再跑；全部錄完寫正式樣本、刪 .part
  const partFile = file + '.part';
  let partSeconds = 0, lastSave = 0;
  if (fs.existsSync(partFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(partFile, 'utf8'));
      if (prev.source?.commit === commit && prev.source.probeH0 === PROBE_H0 && prev.source.probeH2 === PROBE_H2 && prev.config === 'fallback') {
        for (const k of ['crafted', 'evolve', 'evolved', 'old', 'rt']) Object.assign(out[k], prev[k] ?? {});
        partSeconds = prev.seconds ?? 0;
        console.log(`續跑：${partFile} 已有 自造城 ${Object.keys(prev.crafted ?? {}).length}、起步城 ${Object.keys(prev.evolve ?? {}).length}、D022–D025 的城 ${Object.keys(prev.old ?? {}).length}、本線存檔 ${Object.keys(prev.rt ?? {}).length}、長出來的存檔 ${Object.keys(prev.evolved ?? {}).length}`);
      }
    } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000); fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const isDone = t => t.kind === 'evolve' ? !!out.evolve[t.id] : out[t.kind]?.[t.id]?.codeHash === fnv1a(t.code);
  const RUN = (code, days, peek, marks = []) => `(()=>{const seen=!!window.__d026seen;window.__d026seen=1;window.__d026H0=[];window.__d026H2=[];window.__d026peek=${peek ? 1 : 0};GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const codes={};
    for(let d=1;d<=${days};d++){GV.step(1);if(${J(marks)}.includes(d)){GV.save();codes[d]=btoa(unescape(encodeURIComponent(GV.rawSave())));}}return {seen,ok,H0:window.__d026H0,H2:window.__d026H2,codes};})()`;
  const check = (id, r, days) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (r.H0.length !== days || r.H2.length !== days) throw new Error(`${id}：探針記了 H0 ${r.H0.length}、H2 ${r.H2.length} 筆，要 ${days} 筆（災禍段沒跑到收尾？）`);
    r.H0.forEach((a, i) => { const bad = NEED_H0.filter(k => a[k] === null || a[k] === undefined); if (bad.length) throw new Error(`${id} 第 ${i + 1} 天 H0 讀不到 ${bad.join('、')}`); });
    r.H2.forEach((b, i) => { const bad = NEED_H2.filter(k => b[k] === null || b[k] === undefined); if (bad.length) throw new Error(`${id} 第 ${i + 1} 天 H2 讀不到 ${bad.join('、')}`); });
  };
  const counts = h2 => ({ fire: h2.fl.filter(r => r[2] && r[1] <= 3).length, crime: h2.fl.filter(r => r[3]).length, sick: h2.fl.filter(r => r[5]).length, death: h2.fl.filter(r => r[7]).length, ab: h2.fl.filter(r => r[9]).length, ruin: h2.rn.length, sickN: h2.sickN });
  const jobs = [];   // { kind:'crafted'|'evolve'|'evolved', id, code, days, meta }
  if (!PART || PART === 'crafted') for (const c of crafted) jobs.push({ kind: 'crafted', id: c.id, code: c.code, days: c.days, meta: c });
  if ((!PART || PART === 'evolve') && !ONLY) { const startCode = read('src/content/samples/starter.code.txt').trim(); for (const seed of STARTER_SEEDS) jobs.push({ kind: 'evolve', id: String(seed), code: codeWithSeed(startCode, seed), days: EVOLVE_DAYS }); }
  if ((!PART || PART === 'old') && !ONLY) for (const c of oldList()) jobs.push({ kind: 'old', id: c.id, code: c.code, days: 1 });
  if ((!PART || PART === 'rt') && !ONLY) for (const c of rtList()) jobs.push({ kind: 'rt', id: c.id, code: c.code, days: 1 });
  // evolved 要等 evolve 做完才有存檔；先把前面幾批跑完，再排最後一批
  const runJobs = async list => {
    const worker = async j => {
      const mine = list.filter(t => !isDone(t)).filter((_, i) => i % JOBS === j);
      await withBrowser({ root: LAB, entry: 'd026.html', overlay: { 'd026.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d026ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
        for (const t of mine) {
          await open('');
          const r = await page.evaluate(RUN(t.code, t.days, t.kind !== 'evolve', t.kind === 'evolve' ? EVOLVE_MARKS : []));
          check(`${t.kind} ${t.id}`, r, t.days);
          if (t.kind === 'evolve') {
            const codes = {};
            for (const d of EVOLVE_MARKS) { const raw = decodeLabCode(r.codes[d]).save.raw; codes[d] = encodeLabCode(raw, { deflate: true }); }
            out.evolve[t.id] = { seed: +t.id, series: r.H2.map(x => ({ ...counts(x), h: fnv1a(J([x.fl, x.rn])) })), codes };
            const last = counts(r.H2.at(-1)), mx = k => Math.max(...r.H2.map(x => counts(x)[k]));
            console.log(`evolve ${t.id.padEnd(9)} ${t.days} 天：第 ${t.days} 天 焦土 ${last.ruin} 病 ${last.sick} 死 ${last.death} 犯罪 ${last.crime} 廢棄 ${last.ab}；同時燃燒最多 ${mx('fire')}、犯罪最多 ${mx('crime')}、病最多 ${mx('sick')}`);
          } else {
            const rows = r.H0.map((a, i) => ({ H0: packH0(a, i === 0), H2: r.H2[i] }));
            const rec = { codeHash: fnv1a(t.code), days: t.days, rows };
            if (t.kind === 'crafted') out.crafted[t.id] = rec; else if (t.kind === 'old') out.old[t.id] = rec; else if (t.kind === 'rt') out.rt[t.id] = rec; else out.evolved[t.id] = rec;
            const c0 = counts(r.H2[0]), c1 = counts(r.H2.at(-1));
            console.log(`${t.kind} ${t.id.padEnd(9)} 第 1 天後 燃燒 ${c0.fire} 犯罪 ${c0.crime} 病 ${c0.sick} 死 ${c0.death} 廢棄 ${c0.ab} 焦土 ${c0.ruin}｜第 ${t.days} 天後 燃燒 ${c1.fire} 犯罪 ${c1.crime} 病 ${c1.sick} 焦土 ${c1.ruin}｜peek ${r.H2.map(x => x.peek.toFixed(4)).join(' ')}`);
          }
          if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
          savePart(false);
        }
      });
    };
    await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
    savePart(true);
  };
  await runJobs(jobs);
  if ((!PART || PART === 'evolved') && !ONLY) {
    const list = [];
    for (const seed of STARTER_SEEDS) for (const d of EVOLVE_MARKS) { const e = out.evolve[seed]; if (!e) throw new Error(`evolved 要先有 evolve 的存檔（起步城 ${seed}）`); list.push({ kind: 'evolved', id: `${seed}@${d}`, code: noZone(e.codes[d]), days: EVOLVED_DAYS }); }
    await runJobs(list);
  }
  out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000);
  // 寫樣本之前先核形狀
  const lack = all.filter(c => !out.crafted[c.id]).map(c => c.id);
  if (!ONLY && (!PART || PART === 'crafted') && lack.length) throw new Error(`crafted 缺城：${lack.join('、')}`);
  if (!ONLY && (!PART || PART === 'evolve') && Object.keys(out.evolve).length !== STARTER_SEEDS.length) throw new Error('evolve 缺種子');
  if (!ONLY && (!PART || PART === 'old') && oldList().some(c => !out.old[c.id])) throw new Error('old 缺城');
  if (!ONLY && (!PART || PART === 'rt') && rtList().some(c => !out.rt[c.id])) throw new Error('rt 缺城');
  if (!ONLY && (!PART || PART === 'evolved') && evolvedIds().some(id => !out.evolved[id])) throw new Error('evolved 缺存檔');
  out.crafted = Object.fromEntries(all.filter(c => out.crafted[c.id]).map(c => [c.id, out.crafted[c.id]]));
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（自造城 ${Object.keys(out.crafted).length} 座、D022–D025 的城 ${Object.keys(out.old).length} 座、本線存檔給實驗線讀 ${Object.keys(out.rt).length} 座、起步城 ${Object.keys(out.evolve).length} 個種子的 ${EVOLVE_DAYS} 天、長出來的存檔 ${Object.keys(out.evolved).length} 份，${out.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);
}

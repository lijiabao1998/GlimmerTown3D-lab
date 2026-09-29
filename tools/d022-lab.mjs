// D022 驗收 2、3：糧食的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d022-lab.json，tools/unit-d022.mjs 在 CI 上重算本線那一半逐座比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8961 node tools/d022-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--cities=A1,A2（只跑幾座）] [--merge（只跑 --cities 的那幾座，結果併進現有的樣本；出處與設定要一樣）] [--out=別的路徑]
// 城（碼在 Node 產生，守衛用同一個函式重新產生、雜湊要＝樣本記的）：預建城 8 個種子、三張樣本碼（AI 城、種子城、全種類樣張城）、tools/d021-cities.mjs 的自造城 34 座（住宅、處理設施、塔與巨廈）、
//   tools/d022-cities.mjs 的糧食自造城 31 座（食物來源與季節、路格數與貿易設施、觀光與會展、沒電沒人、污水廠、物流）。
// 每座城：新開頁面（一個 Chrome 裡每座城重新載入一次：新的文件與 JS 環境；核對上一座留的記號不在）→ GV.setMapSize(72)＋GV.newWorldSeeded(777)＋GV.importCode → GV.setSpeed(0)、GV.ai(false)、GV.step(1)。
// 糧食那一段的輸入輸出用記憶體副本的探針讀（實驗線原檔不動；同 tools/d016-parity.mjs 的做法：在 tick() 收尾的 'if(diff!==3)money+=income-upkeep;'〔56053，全檔唯一〕前面插一行，
//   讀糧食那一段留下的區域變數：食物量、遊客、居民與遊客的需求、本地供給、缺口、進口、供糧率、貿易額度與路格底、有效效率、城市幸福，以及那一刻每一棟住宅的幸福）。
// 回退設定（tools/lab-configs.mjs fallback）、存檔槽固定 3（preloadOf），不碰業主的存檔。寫樣本之前先核形狀：欄位不齊或有城讀不進去就丟例外、不寫，舊樣本留著。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { d021Codes } from './d021-lab.mjs';
import { cities22 } from './d022-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const PROBE_ANCHOR = 'if(diff!==3)money+=income-upkeep;';
// 探針欄位（實驗線區域變數名 → 樣本欄位）。寫成一行插在錨點前面（不加換行）
export const PROBE_FIELDS = { pop: 'pop', day: 'day', sea: 'sea', points: 'foodPoints', tourists: 'tourists', resNeed: 'foodResidentNeed482', touNeed: 'foodTouristNeed482', need: 'foodCoreNeed482',
  domestic: 'foodDomesticCore482', short: 'foodShortCore482', imports: 'foodImport482', served: 'foodServedCore482', rate: 'foodSupplyRate482', cap: 'tradeCapacity481', base: 'roadTradeBase482',
  cityHappy: 'cityHappy', rail: 'railUnits485', freight: 'freightUnits485', ware: 'warehouseUnits485', port: 'portEquivalent485', preserve: 'foodPreserveMul485', se: 'se', shipCount: 'shipCount' };
export const PROBE22 = `if(window.__d022p){try{window.__d022p({${Object.entries(PROBE_FIELDS).map(([k, v]) => `${k}:${v}`).join(',')},eff:logisticsNow481.efficiency,`
  + 'hs:tickBld.filter(i=>tiles[i].bld&&!tiles[i].bld.ref&&tiles[i].bld.k===1).map(i=>[i,tiles[i].bld.h])});}catch(e){window.__d022err=String(e);}}';

// 這一批要比的城：預建城 8 個種子、樣本城 3 張、d021 的自造城、d022 的糧食自造城。順序固定；守衛用同一個函式重新產生
export function d022Codes() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
  const own22 = cities22(read('src/content/samples/newcity.code.txt'), KT, read('src/content/samples/ai120.code.txt')).map(c => ({ id: c.id, kind: c.kind, note: c.note, code: c.code }));
  return [...d021Codes().map(c => ({ ...c, kind: c.kind === 'prebuilt' || c.kind === 'sample' ? c.kind : 'judged', from: 'D021' })), ...own22.map(c => ({ ...c, from: 'D022' }))];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), ONLY = arg('cities')?.split(',');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (html.split(PROBE_ANCHOR).length !== 2 || PROBE22.includes('\n')) throw new Error('探針錨點要剛好出現 1 次、探針寫成一行');
  const copy = html.replace(PROBE_ANCHOR, PROBE22 + PROBE_ANCHOR);
  if (copy.split('\n').length !== html.split('\n').length) throw new Error('副本多出了換行：行號對不上原檔');
  const all = d022Codes(), list = ONLY ? all.filter(c => ONLY.includes(c.id)) : all, t0 = Date.now();
  const base = +(process.env.GT_PORT ?? 0) || 8961;
  const MERGE = process.argv.includes('--merge'), file = arg('out') ?? path.join(ROOT, 'src/content/samples/d022-lab.json');
  const old = MERGE ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (MERGE && (!ONLY || old.source?.commit !== commit || old.config !== 'fallback')) throw new Error('--merge 要搭 --cities，而且現有樣本的實驗線版本與設定要一樣');
  const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d022-lab.mjs', codes: 'tools/d022-lab.mjs d022Codes()', probe: PROBE22 }, config: 'fallback', order: all.map(c => c.id), cities: {}, seconds: 0 };
  const READ = code => `(()=>{const seen=!!window.__d022seen;window.__d022seen=1;window.__d022probe=null;window.__d022err=null;window.__d022p=o=>{window.__d022probe=o;};
    GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});const a=GV.stats();GV.setSpeed(0);GV.ai(false);GV.step(1);const b=GV.stats();
    return {seen,ok,dayImport:a.day,dayTick:b.day,popTick:b.pop,probe:window.__d022probe,err:window.__d022err};})()`;
  const worker = async j => {
    const mine = list.filter((_, i) => i % JOBS === j);
    await withBrowser({ root: LAB, entry: 'd022.html', overlay: { 'd022.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const c of mine) {
        await open('');   // 每座城新開一頁
        const r = await page.evaluate(READ(c.code));
        if (r.seen) throw new Error(`${c.id}：頁面上還留著上一座城的記號（不是新的文件）`);
        if (!r.ok) throw new Error(`${c.id}：實驗線讀不進這張碼`);
        if (r.err || !r.probe) throw new Error(`${c.id}：探針沒讀到（${r.err ?? '沒有回呼'}）`);
        out.cities[c.id] = { kind: c.kind, from: c.from, codeHash: fnv1a(c.code), dayImport: r.dayImport, dayTick: r.dayTick, popTick: r.popTick, probe: r.probe };
        const q = r.probe;
        console.log(`${c.id.padEnd(8)} 人口 ${String(q.pop).padStart(5)}｜食物 ${String(q.points).padStart(4)} 遊客 ${String(q.tourists).padStart(4)}｜需求 ${String(q.need).padStart(4)} 本地 ${String(q.domestic).padStart(4)} 進口 ${String(q.imports).padStart(3)}／額度 ${String(q.cap).padStart(2)}｜供糧率 ${q.rate.toFixed(4)}｜住宅 ${q.hs.length}`);
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  out.seconds = Math.round((Date.now() - t0) / 1000);
  // 形狀：每座城的欄位齊全、數字有限
  const KEYS = [...Object.keys(PROBE_FIELDS), 'eff'];
  const bad = list.filter(c => { const x = out.cities[c.id]; return !x || typeof x.codeHash !== 'string' || !KEYS.every(k => Number.isFinite(x.probe?.[k])) || !Array.isArray(x.probe.hs); });
  if (bad.length) throw new Error(`欄位不齊，不寫樣本：${bad.map(c => c.id).join('、')}`);
  if (MERGE) { out.cities = { ...old.cities, ...out.cities }; out.seconds += old.seconds ?? 0; }
  const missing = all.filter(c => !out.cities[c.id]); if (missing.length && !ONLY) throw new Error(`少了：${missing.map(c => c.id).join('、')}`);
  out.cities = Object.fromEntries(all.filter(c => out.cities[c.id]).map(c => [c.id, out.cities[c.id]]));
  fs.writeFileSync(file, J(out));
  console.log(`寫出 ${path.relative(ROOT, file)}（${list.length} 座城，${out.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);
}

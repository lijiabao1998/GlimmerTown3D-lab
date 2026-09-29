// D024 驗收 4：主計數迴圈補齊的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d024-lab.json，tools/unit-d024.mjs 在 CI 上重算本線那一半逐座比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8971 node tools/d024-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--cities=E1,E5（只跑幾座）] [--merge（只跑 --cities 的那幾座，結果併進現有樣本）] [--out=別的路徑]
// 城（碼在 Node 產生，守衛用同一個函式重新產生、雜湊要＝樣本記的）：D022 的 80 座（預建城 8 個種子、AI 城與拿掉政策的 AI 城、種子城、全種類樣張城、D021 與 D022 的自造城）、D023 的 9 座（各種服務預算）、
//   tools/d024-cities.mjs 的 14 座（電力、水務、基建、車庫、物流運作中與差一格、升級過的服務、地標與旅宿與產業鏈、辦公區與塔、每一種建築各一棟三座、亂數混排三座）。
// 每座城：新開頁面（核對上一座留的記號不在）→ GV.setMapSize(72)＋GV.newWorldSeeded(777)＋GV.importCode → 讀四個掃圖函式（電力、水務、基建、車庫的就業與維護費，在實驗線自己的閉包裡直接呼叫）
//   → GV.setSpeed(0)、GV.ai(false)、GV.step(1) → 讀 tick() 收尾留下的區域變數：名目就業、商工職位、人口、收入、維護費、六種商品的進口費、地鐵／鐵路／公車／夜間城市的營運費、車隊、法規費。
// 探針是記憶體副本裡一行只讀的記錄（同 tools/d022-lab.mjs：在 tick() 收尾的 'if(diff!==3)money+=income-upkeep;'〔56053，全檔唯一〕前面插一行），實驗線原檔不動。
// 回退設定（tools/lab-configs.mjs fallback）、存檔槽固定 3（preloadOf），不碰業主的存檔。寫樣本之前先核形狀：欄位不齊或有城讀不進去就丟例外、不寫，舊樣本留著。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { d022Codes } from './d022-lab.mjs';
import { cities23 } from './d023-cities.mjs';
import { cities24 } from './d024-cities.mjs';
import { tallyBuildings } from '../src/sim/rules/count.ts';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const PROBE_ANCHOR = 'if(diff!==3)money+=income-upkeep;';
// tick() 收尾的探針：寫成一行，插在錨點前面（不加換行，行號不動）
// 主計數迴圈的每一個計數（欄位名＝實驗線的區域變數名；本線 tallyBuildings 的全部欄位）也一起讀：住宅塔與巨廈的居民（towerPop488、megaPop488）另外讀
export const COUNT_NAMES = Object.keys(tallyBuildings({ N: 1, tiles: [{ t: 2, bld: null }] }, []).cnt);
export const PROBE24 = `window.__d024p={jobs,jobsC,jobsI,pop,income,upkeep,imports:totalImportCost482,metroCost,railOps:railOpsCost463,busOps:busOpsCost468,nightOps:nightOpsCost487,fleet:[svcFleet.fire,svcFleet.police,svcFleet.amb],upReg,tp:towerPop488,mp:megaPop488,cnt:{${COUNT_NAMES.join(',')}}};`;
// 實驗線自己的閉包裡的掃圖函式（IIFE 收尾前的出口）
export const EXPORT = 'window.__d024=()=>({pj:powerJobs471(),wj:waterJobs472(),ij:infraJobs475(),dj:transitDepotJobs501(),pu:powerUpkeep471(),wu:waterUpkeep472(),iu:infraUpkeep475(),du:transitDepotUpkeep501()});';

// 這一批要比的城：D022 的 80 座、D023 的 9 座、這一張的 14 座。順序固定；守衛用同一個函式重新產生
export function d024Codes() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), newcity = read('src/content/samples/newcity.code.txt');
  const own23 = cities23(newcity, KT).map(c => ({ id: 'S' + c.id, kind: 'crafted', note: c.note, code: c.code, from: 'D023' }));
  const own24 = cities24(newcity, KT).map(c => ({ id: c.id, kind: 'crafted', note: c.note, code: c.code, from: 'D024' }));
  return [...d022Codes(), ...own23, ...own24];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), ONLY = arg('cities')?.split(',');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (html.split(PROBE_ANCHOR).length !== 2 || PROBE24.includes('\n')) throw new Error('探針錨點要剛好出現 1 次、探針寫成一行');
  const probed = html.replace(PROBE_ANCHOR, PROBE24 + PROBE_ANCHOR);
  if (probed.split('\n').length !== html.split('\n').length) throw new Error('副本多出了換行：行號對不上原檔');
  const copy = injectLab(probed, EXPORT);
  const all = d024Codes(), list = ONLY ? all.filter(c => ONLY.includes(c.id)) : all, t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8971;
  const MERGE = process.argv.includes('--merge'), file = arg('out') ?? path.join(ROOT, 'src/content/samples/d024-lab.json');
  const old = MERGE ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (MERGE && (!ONLY || old.source?.commit !== commit || old.config !== 'fallback')) throw new Error('--merge 要搭 --cities，而且現有樣本的實驗線版本與設定要一樣');
  const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d024-lab.mjs', codes: 'tools/d024-lab.mjs d024Codes()', probe: PROBE24, export: EXPORT }, config: 'fallback', order: all.map(c => c.id), cities: {}, seconds: 0 };
  const READ = code => `(()=>{const seen=!!window.__d024seen;window.__d024seen=1;window.__d024p=null;GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});const a=__d024();
    GV.setSpeed(0);GV.ai(false);GV.step(1);return {seen,ok,load:a,probe:window.__d024p};})()`;
  const worker = async j => {
    const mine = list.filter((_, i) => i % JOBS === j);
    await withBrowser({ root: LAB, entry: 'd024.html', overlay: { 'd024.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d024', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const c of mine) {
        await open('');
        const r = await page.evaluate(READ(c.code));
        if (r.seen) throw new Error(`${c.id}：頁面上還留著上一座城的記號（不是新的文件）`);
        if (!r.ok) throw new Error(`${c.id}：實驗線讀不進這張碼`);
        if (!r.probe) throw new Error(`${c.id}：探針沒有留下東西（第一天沒跑到收尾？）`);
        const cnt = Object.fromEntries(Object.entries(r.probe.cnt).filter(([, v]) => v !== 0));   // 只留非零的計數（樣本小一點）
        out.cities[c.id] = { kind: c.kind, from: c.from, codeHash: fnv1a(c.code), scan: r.load, day1: { ...r.probe, cnt } };
        console.log(`${c.id.padEnd(10)} jobs ${String(r.probe.jobs).padStart(6)}（商 ${r.probe.jobsC}、工 ${r.probe.jobsI}）維護費 ${r.probe.upkeep.toFixed(2).padStart(9)}（進口費 ${r.probe.imports}）`);
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  out.seconds = Math.round((Date.now() - t0) / 1000);
  const FIELDS = ['jobs', 'jobsC', 'jobsI', 'pop', 'income', 'upkeep', 'imports', 'metroCost', 'railOps', 'busOps', 'nightOps', 'upReg', 'tp', 'mp'], SCAN = ['pj', 'wj', 'ij', 'dj', 'pu', 'wu', 'iu', 'du'];
  const lacking = c => { const x = out.cities[c.id]; if (!x) return ['整座城沒有結果']; return [...(typeof x.codeHash !== 'string' ? ['codeHash'] : []), ...FIELDS.filter(k => !Number.isFinite(x.day1?.[k])).map(k => `day1.${k}=${J(x.day1?.[k])}`),
    ...SCAN.filter(k => !Number.isFinite(x.scan?.[k])).map(k => `scan.${k}=${J(x.scan?.[k])}`), ...(x.day1?.fleet?.length !== 3 ? ['fleet'] : []), ...(!x.day1?.cnt ? ['cnt'] : [])]; };
  const bad = list.filter(c => lacking(c).length);
  if (bad.length) {   // 錄一輪要十幾分鐘：欄位不齊時樣本不寫，但整批結果先存到暫存資料夾，修好那幾座之後可以只重錄它們（--cities=… --merge）
    const part = path.join(process.env.TMPDIR ?? '/tmp', 'd024-lab.partial.json'); fs.writeFileSync(part, J(out));
    throw new Error(`欄位不齊，不寫樣本（整批結果留在 ${part}）：${bad.map(c => `${c.id}（${lacking(c).join('、')}）`).join('；')}`);
  }
  const merged = MERGE ? { ...old.cities, ...out.cities } : out.cities;
  out.cities = Object.fromEntries(all.filter(c => merged[c.id]).map(c => [c.id, merged[c.id]]));
  if (MERGE) out.seconds += old.seconds;
  fs.writeFileSync(file, J(out));
  console.log(`寫出 ${path.relative(ROOT, file)}（${Object.keys(out.cities).length} 座城，${out.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);
}

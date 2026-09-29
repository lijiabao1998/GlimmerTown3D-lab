// D025 驗收 3：經濟的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d025-lab.json，tools/unit-d025.mjs 在 CI 上重算本線那一半逐座比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d025-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--part=day1|multi（只跑一半，結果併進現有樣本）] [--cities=G4,G5（只跑幾座）] [--out=別的路徑（除錯用）]
// 兩種跑法（回退設定 tools/lab-configs.mjs fallback、存檔槽固定 3，不碰業主的存檔；每座城／每個種子一個全新頁面，核對上一頁留的記號不在）：
//   day1：讀進來推進一天——D024 的 103 座＋這一張的自造城 14 座（tools/d025-cities.mjs）。GV.setMapSize(72)＋GV.newWorldSeeded(777)＋GV.importCode → GV.setSpeed(0)、GV.ai(false)、GV.step(1)。
//   multi：連續推進——起步城 8 個種子 × 120 天、AI 城與種子城與六座自造城（G2 貨物出口、G4 物流、G5 船、G7 太空研究中心、G8 加速施工、G9 糧食加工與出口）× 30 天。
//     實驗線的亂數流第 2 天起跟本線錯位（讀檔重設 seed^day、生長抽亂數），所以不比整城；每天記實驗線經濟段的輸入與輸出，守衛把輸入代進本線的經濟函式、本線從自己的昨天庫存與快照接著算，逐天比輸出。
// 探針是記憶體副本裡兩行只讀的記錄（同 tools/d024-lab.mjs 的做法：寫成一行、不加換行，行號不動；實驗線原檔不動）：
//   A（經濟段開頭，55328 那一行前面）讀輸入：日子、季節、人口、職位（含商工職位、商業分區格數，給隔天的需求算式用）、城市幸福、城市活動（T299）的食物加成、錢、專業化、路格數、道路負載統計（用 logisticsEfficiency481 同一段迴圈算原值）、火車線、天然氣發電調度、
//     住宅財富力、施工中的房屋數、主計數迴圈的每一個計數；
//   B（tick() 收尾的 'if(diff!==3)money+=income-upkeep;' 56053 前面）讀輸出：三項需求（dem）與它們用的輸入（demWhy：食物加減之後的城市幸福、商業分區格數、商工職位）、economy481／economy482／logistics485、庫存與船與倉容量、四個稅乘數與其他乘數、六種進口費、各個出口金、收入與維護費與錢、
//     沒搬的收入項（地鐵、運輸、農牧、旅宿、市場、釀酒、科技、數據中心、銀行……，D026 才搬）。讀不到的（區塊裡的 const）記 null，工具檢查必要欄位都讀得到。
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
import { d024Codes, COUNT_NAMES } from './d024-lab.mjs';
import { cities25 } from './d025-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const ANCHOR_A = 'gWhCap284=whCap284+goodsCapBonus485;', ANCHOR_B = 'if(diff!==3)money+=income-upkeep;';
// 沒搬的收入項（56025 的其餘、55988、56027）與搬了的出口金；四個乘數與其他乘數；六種進口費；庫存與船
export const INC = ['metroRev', 'metroAds', 'transitRev', 'nightTransitRev487', 'farmGold', 'ranchGold', 'procGold', 'ghGold', 'lodgeRev', 'mktGold', 'tradeGold', 'brewGold', 'techGold', 'dcGold', 'gasGold', 'cookGold', 'bankInt',
  'parkingRevenue491', 'shipPortGold', 'shipDailyGold418', 'fuelExportGold418', 'steelExportGold482', 'goodsExportGold481'];
export const MUL = ['goodsMul284', 'commerceSalesMul481', 'industrialMarketMul481', 'indSupplyMul', 'fuelTaxMul', 'steelTaxMul', 'freightTaxMul', 'shipTradeTaxMul', 'steelDisc418'];
export const IMP = ['goodsImportCost481', 'foodImportCost482', 'gasImportCost482', 'fuelImportCost482', 'steelImportCost482', 'suppliesImportCost482', 'totalImportCost482'];
export const STK = ['goods', 'supplies', 'fuel', 'steel', 'shipCount', 'shipProgress', 'gWhCap284', 'constrSteelUse418', 'tourists'];
export const PROBE_A = `if(window.__d025A)window.__d025A.push({day,sea,pop,jobs,jobsC,jobsI,czone:tickCzoneN,happy:cityHappy,evFood:cityEvent?CITY_EVENTS[cityEvent.i].food:1,money,spec:spec386,roads:tickRoad.length,`
  + `rs:(()=>{let sum=0,n=0,over=0;for(const i of tickRoad){const t=tiles[i];if(!t?.road)continue;const cap=roadCap475(t)||1,r=(roadLoad[i]||0)/cap;sum+=Math.min(2,r);n++;if(r>1)over++;}return{avg:n?sum/n:0,over:n?over/n:0};})(),`
  + `rail:railLines463.length,gas:powerGasDispatch482(),wealth:wealthPower481(tickBld,pop),act:(()=>{let n=0;for(const i of tickBld){const b=tiles[i].bld;if(b&&!b.ref&&b.age<9)n++;}return n;})(),c:{${COUNT_NAMES.join(',')}}});`;
export const PROBE_B = `if(window.__d025B)window.__d025B.push((()=>{const R=f=>{try{return f()}catch(e){return null}};return{money,income,upkeep,up:R(()=>({metroCost,railOps:railOpsCost463,busOps:busOpsCost468,nightOps:nightOpsCost487,fleet:[svcFleet.fire,svcFleet.police,svcFleet.amb],upReg})),tax:{R:taxR,C:taxC,I:taxI},evTax:R(()=>cityEvent?CITY_EVENTS[cityEvent.i].tax:null),nightGold:R(()=>nightCommerceGold487),flagged:(()=>{let n=0;for(const i of tickBld){const b=tiles[i].bld;if(b&&!b.ref&&(b.fire||b.sick||b.death||b.abandoned||b.riot||b.plague))n++;}return n;})(),dem:[dem[1],dem[2],dem[3]],dw:R(()=>({cityHappy:demWhy.cityHappy,czone:demWhy.czone,jobsC:demWhy.jobsC,jobsI:demWhy.jobsI,pop:demWhy.pop,jobs:demWhy.jobs})),e481:R(()=>(({finance,...r})=>r)(economy481)),e482:R(()=>(({recipes,...r})=>r)(economy482)),l485:R(()=>logistics485),`
  + `${[...INC, ...MUL, ...IMP, ...STK].map(n => `${n}:R(()=>${n})`).join(',')}};})());`;
// 必要的欄位：讀不到（null）就是探針放錯位置
const NEED_B = ['money', 'income', 'upkeep', 'up', 'tax', 'nightGold', 'flagged', 'dem', 'dw', 'e481', 'e482', 'l485', ...MUL, ...IMP, ...STK, 'shipPortGold', 'shipDailyGold418', 'goodsExportGold481'];
const NEED_A = ['day', 'sea', 'pop', 'jobs', 'jobsC', 'jobsI', 'czone', 'happy', 'evFood', 'money', 'roads', 'rs', 'rail', 'gas', 'wealth', 'act', 'c'];
export const EXP = ['tradeGold', 'gasGold', 'fuelExportGold418', 'steelExportGold482', 'goodsExportGold481', 'shipPortGold', 'shipDailyGold418'];
// 一天的經濟輸出的正規形：實驗線（探針 B）與本線各組一份同樣形狀的物件，連續推進的樣本只存它的雜湊（fnv1a）與幾個純量，守衛重算本線那一份比雜湊
export function canonOut(x) {
  return { e481: x.e481, e482: x.e482, l485: x.l485, st: [x.goods, x.supplies, x.fuel, x.steel, x.shipCount, x.shipProgress, x.gWhCap284, x.constrSteelUse418, x.tourists], mul: x.mul, imp: x.imp, exp: x.exp };
}
export const labCanon = B => canonOut({ ...B, mul: Object.fromEntries(MUL.map(k => [k, B[k]])), imp: Object.fromEntries(IMP.map(k => [k, B[k]])), exp: Object.fromEntries(EXP.map(k => [k, B[k]])) });
// 說明用的純量（雜湊對不上時看它們哪一個先不同）
export const scalarsOf = c => ({ cap: c.e482.trade.capacity, used: c.e482.trade.used, imp: c.e482.trade.imports, exp: c.e482.trade.exports, pp: c.e481.consumption.purchasingPower, util: c.e481.commerce.utilization, mm: c.e481.production.marketMul, st: c.st });
// 連續推進的一天：輸入 A 照存、輸出 B 只留代進需求算式與結算前的錢要用的欄位＋正規形的雜湊與純量
const compactB = B => { const c = labCanon(B); return { money: B.money, constrSteelUse418: B.constrSteelUse418, dem: B.dem, dw: B.dw, h: fnv1a(J(c)), s: scalarsOf(c) }; };

export function d025Codes() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), newcity = read('src/content/samples/newcity.code.txt');
  const own = cities25(newcity, KT).map(c => ({ id: c.id, kind: 'crafted', note: c.note, code: c.code, from: 'D025' }));
  return [...d024Codes(), ...own];
}
// multi：起步城 8 個種子 × 120 天（起點碼換種子）、AI 城與種子城與六座自造城（G2 貨物出口、G4 物流、G5 船、G7 太空研究中心、G8 加速施工、G9 糧食加工與出口）× 30 天
export const MULTI_DAYS = { starter: 120, other: 30 }, MULTI_OTHER = ['ai120', 'seed516', 'G2', 'G4', 'G5', 'G7', 'G8', 'G9'];

// 一天一筆的紀錄壓成樣本：輸入 c 只留非零的計數
const packA = a => ({ ...a, c: Object.fromEntries(Object.entries(a.c).filter(([, v]) => v !== 0)) });

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), ONLY = arg('cities')?.split(','), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  for (const [n, a, p] of [['A', ANCHOR_A, PROBE_A], ['B', ANCHOR_B, PROBE_B]]) if (html.split(a).length !== 2 || p.includes('\n')) throw new Error(`探針 ${n} 的錨點要剛好出現 1 次、探針寫成一行`);
  const probed = html.replace(ANCHOR_A, PROBE_A + ANCHOR_A).replace(ANCHOR_B, PROBE_B + ANCHOR_B);
  if (probed.split('\n').length !== html.split('\n').length) throw new Error('副本多出了換行：行號對不上原檔');
  const copy = injectLab(probed, 'window.__d025ok=1;');
  const all = d025Codes(), list = (ONLY ? all.filter(c => ONLY.includes(c.id)) : all), t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d025-lab.json'), old = (PART || ONLY) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback')) throw new Error('--part／--cities 要搭現有樣本，而且實驗線版本與設定要一樣');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d025-lab.mjs', probeA: PROBE_A, probeB: PROBE_B }, config: 'fallback', order: all.map(c => c.id), cities: {}, multi: { starter: {}, others: {} }, seconds: 0 };
  const RUN = (code, days, seed) => `(()=>{const seen=!!window.__d025seen;window.__d025seen=1;window.__d025A=[];window.__d025B=[];GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);
    for(let d=0;d<${days};d++)GV.step(1);return {seen,ok,A:window.__d025A,B:window.__d025B};})()`;
  const jobs = [];   // { kind:'day1'|'starter'|'other', id, code, days, seed }
  if (PART !== 'multi') for (const c of list) jobs.push({ kind: 'day1', id: c.id, code: c.code, days: 1, meta: c });
  if (PART !== 'day1' && !ONLY) {
    const startCode = read('src/content/samples/starter.code.txt').trim();
    for (const seed of STARTER_SEEDS) jobs.push({ kind: 'starter', id: String(seed), code: codeWithSeed(startCode, seed), days: MULTI_DAYS.starter });
    for (const id of MULTI_OTHER) { const c = all.find(x => x.id === id); jobs.push({ kind: 'other', id, code: c.code, days: MULTI_DAYS.other }); }
  }
  const check = (id, r, days) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (r.A.length !== days || r.B.length !== days) throw new Error(`${id}：探針記了 A ${r.A.length}、B ${r.B.length} 筆，要 ${days} 筆（經濟段沒跑到收尾？）`);
    r.A.forEach((a, i) => { const bad = NEED_A.filter(k => a[k] === null || a[k] === undefined); if (bad.length) throw new Error(`${id} 第 ${i + 1} 天 A 缺 ${bad.join('、')}`); });
    r.B.forEach((b, i) => { const bad = NEED_B.filter(k => b[k] === null || b[k] === undefined); if (bad.length) throw new Error(`${id} 第 ${i + 1} 天 B 讀不到 ${bad.join('、')}（探針放在區塊外面讀不到的 const）`); });
  };
  const worker = async j => {
    const mine = jobs.filter((_, i) => i % JOBS === j);
    await withBrowser({ root: LAB, entry: 'd025.html', overlay: { 'd025.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d025ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      for (const t of mine) {
        await open('');
        const r = await page.evaluate(RUN(t.code, t.days));
        check(`${t.kind} ${t.id}`, r, t.days);
        if (t.kind === 'day1') {
          out.cities[t.id] = { kind: t.meta.kind, from: t.meta.from, codeHash: fnv1a(t.code), A: packA(r.A[0]), B: r.B[0] };
          console.log(`${t.id.padEnd(10)} 人口 ${String(r.A[0].pop).padStart(5)} 額度 ${String(r.B[0].e482?.trade?.capacity).padStart(4)} 進口費 ${String(r.B[0].totalImportCost482).padStart(4)} 收入 ${r.B[0].income.toFixed(1)} 庫存 貨物 ${r.B[0].goods} 鋼 ${r.B[0].steel} 燃料 ${r.B[0].fuel} 船 ${r.B[0].shipCount}`);
        } else {
          const rows = r.A.map((a, i) => ({ A: packA(a), B: compactB(r.B[i]) }));
          if (t.kind === 'starter') out.multi.starter[t.id] = rows; else out.multi.others[t.id] = rows;
          const last = r.B.at(-1);
          console.log(`${t.kind} ${t.id.padEnd(8)} ${t.days} 天：最後一天 人口 ${r.A.at(-1).pop} 額度 ${last.e482?.trade?.capacity} 庫存 貨物 ${last.goods} 鋼 ${last.steel} 燃料 ${last.fuel} 供應品 ${last.supplies} 船 ${last.shipCount}`);
        }
        if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
      }
    });
  };
  await Promise.all(Array.from({ length: JOBS }, (_, j) => worker(j)));
  out.seconds = (old?.seconds ?? 0) + Math.round((Date.now() - t0) / 1000);
  // 寫樣本之前先核形狀：城齊全、multi 的種子與天數齊全
  const lack = all.filter(c => !out.cities[c.id]).map(c => c.id);
  if (!ONLY && PART !== 'multi' && lack.length) throw new Error(`day1 缺城：${lack.join('、')}`);
  if (!ONLY && PART !== 'day1') {
    const miss = [...STARTER_SEEDS.filter(s => out.multi.starter[s]?.length !== MULTI_DAYS.starter).map(String), ...MULTI_OTHER.filter(id => out.multi.others[id]?.length !== MULTI_DAYS.other)];
    if (miss.length) throw new Error(`multi 缺：${miss.join('、')}`);
  }
  out.cities = Object.fromEntries(all.filter(c => out.cities[c.id]).map(c => [c.id, out.cities[c.id]]));
  fs.writeFileSync(file, J(out));
  console.log(`寫出 ${path.relative(ROOT, file)}（day1 ${Object.keys(out.cities).length} 座、multi 起步城 ${Object.keys(out.multi.starter).length} 個種子＋其他 ${Object.keys(out.multi.others).length} 座，${out.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);
}

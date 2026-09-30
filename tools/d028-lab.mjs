// D028 驗收 3：經濟（二）的實驗線頁面實跑（離線工具，要無頭 Chrome；結果存成黃金樣本 src/content/samples/d028-lab.json，tools/unit-d028-live.mjs 在 CI 上重算本線那一半，不用瀏覽器）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8981 node tools/d028-lab.mjs --lab=../lijiabao1998/glimmertown-lab [--jobs=3] [--part=crafted|old|oldz（只跑一部分，結果併進現有樣本）] [--cities=K1,K3（只跑幾座自造城）] [--out=別的路徑（除錯用）]
// 三種跑法（回退設定 tools/lab-configs.mjs fallback、存檔槽固定 3，不碰業主的存檔；每座城一個全新頁面，核對上一頁留的記號不在）：
//   crafted：自造城 K1–K16（tools/d028-cities.mjs）讀進來連推 13 天（化肥與熟食是「隔天」才生效，第 2 天起才看得到；日子選成讓四個季節與季節交界都出現），每天記一列 row（見下）。
//   old：D022–D025 的 120 座城（分區清成 0＝不會長新房子），連推 10 天（gallery、E12 有化肥廠與農場，E7、E10、E14、G9、G13、G14 有中央廚房，都是這一批）。
//   oldz：同一批 120 座城，分區不清（會長新房子、升級、廢棄……整條 tick 鏈），連推 10 天。
// 起步城 8 種子 × 120 天不再錄：起步城沒有這一張碰到的建築（d025-lab.json 的 960 個城日，計數全 0），D027 的樣本與守衛照舊，另有 D028 之前／之後的雜湊逐位元組相同。
// 每天一列 row（GV.step(1) 之後讀，全是只讀的記錄，實驗線原檔不動）：
//   day、pop、jobs、happy（城市幸福）、money（不取整）、net＝fin.net（收入−維護費）、tx＝[taxR, taxC, taxI]（taxC 含夜間城市的晚間消費金 ng）、inc＝其餘收入逐項（fin 那一份：農場、牧場、食品加工、旅宿、農貿市場、貿易、釀酒、科技園、數據中心、天然氣出口、熟食、銀行利息，
//   INC_KEYS 的順序；溫室 ghGold 不在 fin 裡，靠 money 逐日核）、ng＝夜間城市晚間消費金（T487，這一天用的；本線沒搬，要代進去）、un＝本線沒搬的收入 [地鐵票、地鐵廣告、地面運輸、夜間運輸、停車]（要代進去）、
//   uu＝本線沒搬的維護費 [地鐵、鐵路營運、公車營運、夜間營運、消防車隊、警車隊、救護車隊]（要代進去）、ah＝happyAgg（57 項）的 64 位元浮點逐位雜湊（自造城另存逐項 agg）、ch＝GV.chain346() 的 [gasSup, gasDem, gasRatio, fertOut, cookedOut, wageIdx, fertReady, cookedReady, mortPop]、fd＝region.food（食物點數）、tr＝region.tourists、
//   ho＝[hotelBeds, hotelOcc]、nh＝住宅（k1、127）根格棟數、hh＝每一棟住宅 [格, 幸福] 的雜湊（64 位元浮點逐位）、peek＝下一個亂數（兩邊在每天結束時多擲一次，等於這一天用掉的亂數次數與順序一樣）、
//   night、ev、tech、pol、spec＝本線沒有、要代進去的輸入（同 D027：夜間城市、城市活動〔含稅率 tax〕、科技、政策、專精；跟前一列一樣的不存，見 compactRows）。
//   start（讀檔後第一天之前）：pol、tech、spec、night、ev、day。
// 探針是記憶體副本裡主程式收尾前的一段只讀出口（tools/lab-configs.mjs injectLab；不用錨點、不插進 tick，行號不動）；唯一會動實驗線狀態的是 peek（多擲一次 R()，本線同樣在每天結束時多擲一次）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { withBrowser, ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { cities28 } from './d028-cities.mjs';
import { PROBE as PROBE27, compactRows, oldList, oldzList } from './d027-lab.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=').slice(1).join('=');
const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const CRAFTED_DAYS = 13, OLD_DAYS = 10;
export function d028Cities() { const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))); return cities28(read('src/content/samples/newcity.code.txt'), KT); }
export { oldList, oldzList };
// fin 裡有的其餘收入（溫室 ghGold 不在 fin）；本線 rep.settle.other 同名同順序
export const INC_KEYS = ['farmGold', 'ranchGold', 'procGold', 'lodgeRev', 'mktGold', 'tradeGold', 'brewGold', 'techGold', 'dcGold', 'gasGold', 'cookGold', 'bankInt'];

// 頁面裡的探針：D027 的（提供雜湊、夜間城市、城市活動、start）加上這一張的每日讀取
export const PROBE = PROBE27
  + `window.__d028read=()=>{const h=window.__d027h,Q=window.__d027Q,hs=[];for(let i=0;i<N*N;i++){const b=tiles[i].bld;if(b&&!b.ref&&(b.k===1||b.k===127))hs.push(i,b.h);}`
  + `const f=fin||{},c=GV.chain346(),ag=(happyAgg||[]).map(p=>p.val),fl=Q(()=>svcFleet);const r={day,pop,jobs,happy:cityHappy,money,net:f.net,tx:[f.taxR,f.taxC,f.taxI],inc:[${INC_KEYS.map(k => `f.${k}`).join(',')}],`
  + `ng:f.nightCommerceGold487,un:[f.metroRev,f.metroAds,f.transitRev,f.nightTransitRev487,f.parkingRevenue491],uu:[f.metroCost,f.railOpsCost463,f.busOpsCost468,f.nightOpsCost487,fl?fl.fire:null,fl?fl.police:null,fl?fl.amb:null],`
  + `ch:[c.gasSup,c.gasDem,c.gasRatio,c.fertOut,c.cookedOut,c.wageIdx,c.fertReady,c.cookedReady,c.mortPop],fd:region.food,tr:region.tourists,ho:[hotelBeds,hotelOcc],nh:hs.length/2,hh:h(new Float64Array(hs)),ah:h(Float64Array.from(ag)),`
  + `night:window.__d027night(),ev:window.__d027ev(),tech:Q(()=>JSON.stringify(tech343.done)),pol:Q(()=>JSON.stringify(pol)),spec:spec386,peek:R()};if(window.__d027agg)r.agg=ag;return r;};`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), JOBS = Math.max(1, +(arg('jobs') ?? 3)), ONLY = arg('cities')?.split(','), PART = arg('part');
  const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
  const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8'), version = /const GAME_VER='([^']+)'/.exec(html)[1];
  if (PROBE.includes('\n')) throw new Error('探針寫成一段、不換行');
  const copy = injectLab(html, PROBE);
  const all = d028Cities(), crafted = ONLY ? all.filter(c => ONLY.includes(c.id)) : all, t0 = Date.now(), base = +(process.env.GT_PORT ?? 0) || 8981;
  const file = arg('out') ?? path.join(ROOT, 'src/content/samples/d028-lab.json'), old = (PART || ONLY) && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (old && (old.source?.commit !== commit || old.config !== 'fallback' || old.source?.probe !== PROBE)) throw new Error('--part／--cities 要搭現有樣本，而且實驗線版本、設定與探針都要一樣（探針改過就整份重錄）');
  const out = old ?? { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: 'tools/d028-lab.mjs', probe: PROBE }, config: 'fallback', order: all.map(c => c.id), oldOrder: oldList().map(c => c.id), crafted: {}, old: {}, oldz: {}, seconds: 0 };
  // 可續跑（同 tools/d027-lab.mjs）：每完成一頁就（隔幾秒）寫一次 .part，開跑時如果有同一份實驗線＋同一組探針錄的 .part，已經錄好的頁（碼雜湊相同）不再跑
  const partFile = file + '.part';
  let partSeconds = 0, lastSave = 0;
  if (fs.existsSync(partFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(partFile, 'utf8'));
      if (prev.source?.commit === commit && prev.source.probe === PROBE && prev.config === 'fallback') {
        for (const k of ['crafted', 'old', 'oldz']) Object.assign(out[k], prev[k] ?? {});
        partSeconds = Math.max(0, (prev.seconds ?? 0) - (old?.seconds ?? 0));
        console.log(`續跑：${partFile} 已有 自造城 ${Object.keys(prev.crafted ?? {}).length}、舊城 ${Object.keys(prev.old ?? {}).length}＋${Object.keys(prev.oldz ?? {}).length}（分區不清）`);
      }
    } catch (e) { console.log('.part 讀不懂，重錄：' + e.message); }
  }
  const savePart = force => { if (force || Date.now() - lastSave > 15000) { out.seconds = (old?.seconds ?? 0) + partSeconds + Math.round((Date.now() - t0) / 1000); fs.writeFileSync(partFile, J(out)); lastSave = Date.now(); } };
  const isDone = t => out[t.kind]?.[t.id]?.codeHash === fnv1a(t.code);
  const RUN = (code, days, agg) => `(()=>{const seen=!!window.__d027seen;window.__d027seen=1;window.__d027full=0;window.__d027agg=${agg ? 1 : 0};GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});GV.setSpeed(0);GV.ai(false);const start=window.__d027start();const rows=[];`
    + `for(let d=1;d<=${days};d++){GV.step(1);rows.push(window.__d028read());}return {seen,ok,start,rows};})()`;
  const NEED = ['day', 'pop', 'jobs', 'happy', 'money', 'net', 'tx', 'inc', 'ng', 'un', 'uu', 'ch', 'fd', 'tr', 'ho', 'nh', 'hh', 'ah', 'night', 'tech', 'pol', 'peek'];
  const check = (id, r, days) => {
    if (r.seen) throw new Error(`${id}：頁面上還留著上一座城的記號（不是新的文件）`);
    if (!r.ok) throw new Error(`${id}：實驗線讀不進這張碼`);
    if (r.rows.length !== days) throw new Error(`${id}：記了 ${r.rows.length} 列，要 ${days} 列`);
    r.rows.forEach((a, i) => {
      for (const k of NEED) if (a[k] === null || a[k] === undefined) throw new Error(`${id} 第 ${i + 1} 天 ${k} 讀不到`);
      if (a.tx.some(v => typeof v !== 'number') || a.inc.some(v => typeof v !== 'number') || a.ch.some(v => v === undefined || v === null)) throw new Error(`${id} 第 ${i + 1} 天 收入或鏈條有讀不到的欄位：${J(a.inc)} ${J(a.ch)}`);
      if (a.un.some(v => typeof v !== 'number') || a.uu.some(v => typeof v !== 'number') || typeof a.ng !== 'number' || typeof a.net !== 'number') throw new Error(`${id} 第 ${i + 1} 天 沒搬的收入／維護費、晚間消費金或淨額讀不到：${J(a.un)} ${J(a.uu)} ${a.ng} ${a.net}`);
    });
  };
  const jobs = [];   // { kind, id, code, days }
  if (!PART || PART === 'crafted') for (const c of crafted) jobs.push({ kind: 'crafted', id: c.id, code: c.code, days: c.days });
  if ((!PART || PART === 'old') && !ONLY) for (const c of oldList()) jobs.push({ kind: 'old', id: c.id, code: c.code, days: OLD_DAYS });
  if ((!PART || PART === 'oldz') && !ONLY) for (const c of oldzList()) jobs.push({ kind: 'oldz', id: c.id, code: c.code, days: OLD_DAYS });
  const runJobs = async list => {
    const worker = async j => {
      const mine = list.filter(t => !isDone(t)).filter((_, i) => i % JOBS === j);
      await withBrowser({ root: LAB, entry: 'd028.html', overlay: { 'd028.html': copy }, port: base + j, width: 1024, height: 700, gl: false, preload: preloadOf(CONFIGS.fallback), ready: '!!window.__bootDone453&&!!window.__d027ok', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
        for (const t of mine) {
          await open('');
          const r = await page.evaluate(RUN(t.code, t.days, t.kind === 'crafted'));
          check(`${t.kind} ${t.id}`, r, t.days);
          out[t.kind][t.id] = { codeHash: fnv1a(t.code), days: t.days, start: r.start, rows: compactRows(r.start, r.rows) };
          const a = r.rows[0], z = r.rows.at(-1), nz = r.rows.filter(x => x.inc.some(v => v > 0)).length;
          console.log(`${t.kind} ${t.id.padEnd(10)} ${String(t.days).padStart(3)} 天：第 1 天 錢 ${a.money.toFixed(2)} 供氣率 ${a.ch[2]} 化肥 ${a.ch[3]}${a.ch[6] ? '✓' : '·'} 熟食 ${a.ch[4]}${a.ch[7] ? '✓' : '·'}｜第 ${t.days} 天 錢 ${z.money.toFixed(2)} 人口 ${z.pop} 收入項非零的天 ${nz}`);
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
  out.crafted = Object.fromEntries(all.filter(c => out.crafted[c.id]).map(c => [c.id, out.crafted[c.id]]));
  fs.writeFileSync(file, J(out));
  fs.rmSync(partFile, { force: true });
  console.log(`寫出 ${path.relative(ROOT, file)}（自造城 ${Object.keys(out.crafted).length} 座、舊城 ${Object.keys(out.old).length}＋${Object.keys(out.oldz).length}（分區不清）座，${out.seconds} 秒）`);
}

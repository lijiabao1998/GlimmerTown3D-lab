// D010 跟實驗線對照：起步城 × 8 個種子 × 120 天，兩邊逐日記同一組數字（CLAUDE.md 規則 8：整城軌跡先求多種子統計；這張只量不判）。
// 用法：CHROME_PATH=… node tools/lab-compare.mjs --lab=<實驗線目錄> [--days=120] [--seeds=8] [--shots] [--diag [--config=fallback|default]]
// 產出：
//   src/content/samples/d010-lab.json   實驗線兩種設定的逐日數字（記 commit）
//   src/content/samples/d010-3d.json    本線的逐日數字
//   scratch/lab/d010_day<N>_2d.png      實驗線第 0、30、60、120 天的 2D 畫面（--shots，獨立一跑；第一個種子、回退設定；不進版本庫）
//   scratch/lab/d010-diag.json          差距歸因（--diag：實驗線的幸福組成、需求組成、經濟快照）
// 實驗線的跑法（D010 卡）：
//   - 每個種子開一張全新的頁面（同一頁第二次匯入，實驗線的電力調度會走不同的分支，跟全新頁面不同）；不進遊戲，只用 GV API；
//   - GV.setMapSize(72)＋GV.newWorldSeeded（重設 pop／jobs／cityHappy／dem 成新城的值）→ GV.importCode（換過 seed 的起步城碼）→ GV.setSpeed(0)、GV.ai(false)；
//   - 之後只用 GV.step(1) 逐日推進；比較區間裡不讀檔（規則 8：實驗線讀檔會用 seed^day 重設亂數）。
// 兩種設定：
//   default：實驗線預設＋舊版供電（__legacyPower450 讓 tick 用舊式通電；__legacyPower471 讓每天收尾的財政等呼叫端也走舊式分支 52776，
//            只開 450 的話 T471 分時調度仍會把所有商工設成沒電，企業全數停擺、就業整段是 0——審查抓到，已補）。
//            補了之後就業前 60 天有數，之後照樣掉到 0：那是真的限電，不是設定壞掉——舊式供電 b.pw＝near&&powered<cap（55155），
//            一座燃煤電廠約供 75–78 棟，按索引（由北往南）分配；預設設定住宅一直長（種子 5162026 第 120 天 161 棟），北邊住宅先把容量用完，
//            南排的工業區第 70 天起 27 棟全沒電；實驗線又沒有商業（經濟快照讓 demC 恆負），就業就歸 0。本線同一條規則、同一個種子，
//            第 61 天工業也全沒電，但北邊的商業（第 2 排街區）通著電，所以就業還有；

//   fallback：再用實驗線自己的開關，把有開關的上層系統關成「沒就緒／舊式」（跟本線接的回退值一致），災害關掉；
//             沒有開關的（經濟快照、通勤 T141、道路負載與壅堵 T129、垃圾、糧食、夜間城市、城市活動、火災、犯罪、廢棄、疾病、死亡）照跑——它們就是差距的來源。
// 欄位定義見 tools/unit-d010-sim.mjs 的 TRAJ_FIELDS／trajectory（勞動力兩欄照實驗線 truthSnapshot496 的算法）。第 0 列是讀檔後的快照，
// 兩邊不可比（實驗線讀檔的 T510 包裝 68519 會先算一次 pop／jobs），卡面只比第 30、60、120 天。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { withBrowser, ROOT, sleep } from './cdp.mjs';
import { codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { STARTER_SEEDS, STARTER_DAYS } from '../src/content/starter.ts';
import { TRAJ_FIELDS, trajectory, r6 } from './unit-d010-sim.mjs';

const arg = (n, d) => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const LAB = path.resolve(arg('lab', process.env.LAB_DIR || path.join(ROOT, '..', 'GlimmerTown-lab')));
const DAYS = Number(arg('days', STARTER_DAYS)), NSEED = Number(arg('seeds', STARTER_SEEDS.length)), SHOTS = process.argv.includes('--shots'), DIAG = process.argv.includes('--diag');
const SEEDS = STARTER_SEEDS.slice(0, NSEED);
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD']).toString().trim();
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', '--', 'index.html']).toString().trim()) throw new Error('實驗線 index.html 有未提交的修改');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const ver = /const GAME_VER='([^']+)'/.exec(html)[1], anchor = /const GAME_ANCHOR='([^']+)'/.exec(html)[1];
const code = read('src/content/samples/starter.code.txt'), meta = JSON.parse(read('src/content/samples/starter.json'));
const J = JSON.stringify;

// 逐日數字（兩邊同一組欄位、同一個順序）
const FIELDS = TRAJ_FIELDS;

// 實驗線有開關的上層系統（行號 @ d23c18d，見 D010 卡「回退值」一節）
const FALLBACK_FLAGS = ['__legacyPower450', '__legacyPower471', '__noHousing488', '__noEnterprise489', '__noDevelopment512', '__noMobility509', '__noBalance510', '__noFinancialFeedback510',
  '__noMobility491', '__noIncident493', '__legacyWater449', '__noGpn508', '__noBusinessCycle490', '__noCivicServices495', '__noJunction503', '__noSocial505',
  '__noCapability506', '__noInnovation507', '__noFiscal515', '__noPolicy504'];
const CONFIGS = {
  default: { flags: ['__legacyPower450', '__legacyPower471'], disasters: true },
  fallback: { flags: FALLBACK_FLAGS, disasters: false },
};
const preloadOf = c => "try{localStorage.setItem('glimmerville.v1.slot','3');" + (c.disasters ? "localStorage.removeItem('glimmerville.v1.ds')" : "localStorage.setItem('glimmerville.v1.ds','0')") + '}catch(e){};'
  + c.flags.map(f => `window.${f}=true;`).join('');

const RUN = (seedCode, days, shotDays) => `(()=>{
  const rci=()=>{const C={1:[0,0,0,0],2:[0,0,0,0],3:[0,0,0,0]},N=GV.N();
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const b=GV.tile(x,y).bld;if(!b||b.ref||b.k<1||b.k>3)continue;C[b.k][0]++;C[b.k][b.lv||1]++;}return C;};
  const m=()=>{const s=GV.stats(),L=GV.truth496().labor,c=rci();
    return [s.day,s.pop,s.jobs,L.employed,L.workers,GV.skyline516B().happy,s.dem[1],s.dem[2],s.dem[3],...c[1],...c[2],...c[3]];};
  const shot=()=>{const st=document.getElementById('start');if(st)st.style.display='none';const ov=document.getElementById('startOverlay456');if(ov){ov.classList.remove('show');ov.style.display='none';}
    GV.lookAt(${meta.layout.center[0]},${meta.layout.center[1]});GV.art574.zoom574(.75);GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();GV.forceDraw();return document.getElementById('game').toDataURL('image/png');};
  GV.setMapSize(72);GV.newWorldSeeded(777);
  if(!GV.importCode(${J(seedCode)}))throw new Error('import rejected');
  GV.setSpeed(0);GV.ai(false);
  const rows=[m()],shots={};const want=${J(shotDays)};
  if(want.includes(0))shots[0]=shot();
  for(let d=1;d<=${days};d++){GV.step(1);rows.push(m());if(want.includes(d))shots[d]=shot();}
  return {rows,shots,disasters:GV.disasters?GV.disasters():null};})()`;

// --diag：差距歸因。實驗線的幸福組成（happyAgg，tick() 55255）、需求組成（demWhy 55591）與經濟快照只在統計面板裡讀，沒有 GV 出口；
// 照 D009 的做法開記憶體副本，在主程式 IIFE 收尾前插一行只讀出口 window.__d010（原檔不動）。跑回退設定、第一個種子，印出第 1、2、10、30、60、120 天的組成。
if (DIAG || SHOTS) {
  const exportAnchor = 'Object.assign(window.GV,{art574:', mark = html.indexOf(exportAnchor);
  if (mark < 0 || html.indexOf(exportAnchor, mark + 1) >= 0) throw new Error('實驗線 GV 出口錨點要剛好出現 1 次');
  const scriptEnd = html.indexOf('</script>', mark), closes = [...html.slice(mark, scriptEnd + 9).matchAll(/\n\s*\}\)\(\);\s*\n<\/script>/g)];
  if (closes.length !== 1) throw new Error('實驗線主程式 IIFE 收尾要剛好 1 處');
  const at = mark + closes[0].index, INJECT = '\n;window.__d010={happyAgg:()=>JSON.parse(JSON.stringify(happyAgg)),demWhy:()=>JSON.parse(JSON.stringify(demWhy)),happy:()=>cityHappy,eco:()=>({ready:economy481.ready,pp:economy481.ready?economy481.consumption.purchasingPower:null,retail:economy481.ready?economy481.commerce.utilization:null}),noFlash:()=>{flashT=0;},land:()=>({dirty:landDirty,box:landBox?[landBox.x0,landBox.y0,landBox.x1,landBox.y1]:null})};';
  const cfgName = arg('config', 'fallback'), cfg = CONFIGS[cfgName];
  if (!cfg) throw new Error('沒有這個設定：--config=' + cfgName);
  if (SHOTS && cfgName !== 'fallback') throw new Error('--shots 只拍回退設定（對照圖的 2D 那一欄標的是回退設定）');
  const copy = html.slice(0, at) + INJECT + html.slice(at), want = [1, 2, 10, 30, 60, 120];
  if (SHOTS) {
    // --shots：實驗線第 0、30、60、120 天的 2D 畫面（回退設定、第一個種子）。拍之前把閃電計時 flashT 歸零（純畫面、不進存檔；第 120 天剛好暴雨打閃電，畫面整片白）。
    // 用同一份副本、同一個跑法重跑一次；逐日數字要跟正式對照（原檔、沒有出口）那一列逐項相同，證明插出口沒改到模擬。
    const shotDays = [0, 30, 60, 120].filter(d => d <= DAYS);
    await withBrowser({ root: LAB, entry: 'd010.html', overlay: { 'd010.html': copy }, port: 8411, width: 1280, height: 800, gl: false, preload: preloadOf(cfg), ready: '!!window.__bootDone453&&!!window.__d010', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
      await open('');
      const RUNS = RUN(codeWithSeed(code, SEEDS[0]), DAYS, shotDays).replace('GV.lookAt(', '__d010.noFlash();GV.lookAt(');
      const r = await page.evaluate(RUNS);
      const ref = JSON.parse(read('src/content/samples/d010-lab.json')).configs.fallback.runs[SEEDS[0]];
      const same = !!ref && J(r.rows.map(row => row.map(r6))) === J(ref);
      if (!same) throw new Error('拍照那一次跑出來的數字跟正式對照不同（插出口改到模擬了？或 d010-lab.json 是舊的）；沒有寫出樣張');
      fs.mkdirSync(path.join(ROOT, 'scratch/lab'), { recursive: true });
      for (const [d, url] of Object.entries(r.shots)) fs.writeFileSync(path.join(ROOT, `scratch/lab/d010_day${d}_2d.png`), Buffer.from(url.split(',')[1], 'base64'));
      console.log(`實驗線 2D 樣張 ${Object.keys(r.shots).join('、')} 天（scratch/lab/d010_day*_2d.png）；這次的逐日數字＝正式對照那一列：${same}`);
    });
    if (!DIAG) process.exit(0);
  }
  await withBrowser({ root: LAB, entry: 'd010.html', overlay: { 'd010.html': copy }, port: 8411, width: 1280, height: 800, gl: false, preload: preloadOf(cfg), ready: '!!window.__bootDone453&&!!window.__d010', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
    await open('');
    const r = await page.evaluate(`(()=>{GV.setMapSize(72);GV.newWorldSeeded(777);if(!GV.importCode(${J(codeWithSeed(code, SEEDS[0]))}))throw new Error('import');GV.setSpeed(0);GV.ai(false);
      const rows=[],land={full:0,box:0,clean:0,boxes:[]};for(let d=1;d<=${DAYS};d++){GV.step(1);const L=__d010.land();if(L.dirty&&!L.box)land.full++;else if(L.dirty){land.box++;if(land.boxes.length<5)land.boxes.push([d,L.box]);}else land.clean++;if(${J(want)}.includes(d)){const a=__d010.happyAgg(),sum=a.reduce((s,p)=>s+p.val,0);
        rows.push({day:d,happy:__d010.happy(),aggSum:sum,terms:a.filter(p=>Math.abs(p.val)>1e-4).map(p=>[p.name,+p.val.toFixed(4)]),eco:__d010.eco(),why:__d010.demWhy(),dem:GV.stats().dem});}}return {rows,land};})()`);
    console.log('每天結束時的地價髒狀態（明天開頭依此重算）：' + J(r.land));
    for (const x of r.rows) {
      console.log(`第 ${x.day} 天：城市幸福 ${x.happy.toFixed(3)}（幸福組成平均總和 ${x.aggSum.toFixed(3)}，差 ${(x.happy - x.aggSum).toFixed(3)} 是組成之後才扣的垃圾／糧食／夾值）；經濟 ${J(x.eco)}；需求 ${J(x.dem)}`);
      console.log('  組成（非零）：' + x.terms.map(([n, v]) => n + ' ' + v).join('、'));
    }
    fs.mkdirSync(path.join(ROOT, 'scratch/lab'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'scratch/lab/d010-diag.json'), J({ commit, inject: INJECT.trim(), ...r }));
  });
  process.exit(0);
}

const out = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version: ver, anchor, tool: 'tools/lab-compare.mjs', code: 'src/content/samples/starter.code.txt' }, fields: FIELDS, days: DAYS, seeds: SEEDS, configs: {} };
const t0 = Date.now();
for (const [name, cfg] of Object.entries(CONFIGS)) {
  out.configs[name] = { flags: cfg.flags, disasters: cfg.disasters, runs: {} };
  await withBrowser({ root: LAB, port: 8411, width: 1280, height: 800, gl: false, preload: preloadOf(cfg), ready: '!!window.__bootDone453', readyMs: 240000, settle: 300 }, async ({ open, page }) => {
    for (const seed of SEEDS) {
      const t1 = Date.now();
      await open('');                                                   // 全新頁面
      const r = await page.evaluate(RUN(codeWithSeed(code, seed), DAYS, []));
      out.configs[name].runs[seed] = r.rows.map(row => row.map(r6));
      const last = r.rows.at(-1);
      console.log(`實驗線 ${name} 種子 ${seed}：第 ${last[0]} 天 人口 ${last[1]}、就業 ${last[2]}、住商工 ${last[9]}／${last[13]}／${last[17]}、幸福 ${last[5].toFixed(3)}、災害 ${J(r.disasters)}（${((Date.now() - t1) / 1000).toFixed(0)}s）`);
      if (page.errors.length) { console.log('  實驗線 console 錯誤（僅記錄）：' + page.errors.slice(0, 3).join(' | ')); page.errors.length = 0; }
    }
  });
  // 設定壞掉的警報：整組種子從第 10 天起就業都是 0（像只開 __legacyPower450 時那樣），就不是可以拿來對照的跑法
  const ji = FIELDS.indexOf('jobs'), dead = Object.values(out.configs[name].runs).every(rows => rows.slice(10).every(row => row[ji] === 0));
  if (dead) throw new Error(`實驗線 ${name} 設定：所有種子第 10 天起就業都是 0，設定有問題`);
}
fs.writeFileSync(path.join(ROOT, 'src/content/samples/d010-lab.json'), J(out));

// 本線：同 8 個種子，同一組欄位（第 0 天＝匯入後、還沒推進）
const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
const mine = { source: { tool: 'tools/lab-compare.mjs', code: 'src/content/samples/starter.code.txt', sim: 'src/sim/day.ts', how: 'tools/unit-d010-sim.mjs trajectory()' }, fields: FIELDS, days: DAYS, seeds: SEEDS, runs: {} };
for (const seed of SEEDS) {
  const rows = mine.runs[seed] = trajectory(code, KT, vrank, seed, DAYS), last = rows.at(-1);
  console.log(`本線 種子 ${seed}：第 ${last[0]} 天 人口 ${last[1]}、就業 ${last[2]}、住商工 ${last[9]}／${last[13]}／${last[17]}、幸福 ${last[5].toFixed(3)}`);
}
fs.writeFileSync(path.join(ROOT, 'src/content/samples/d010-3d.json'), J(mine));

// 卡面表：第 30、60、120 天，均值 ± 標準差（樣本標準差，n＝種子數）與差距
const stat = (runs, d, f) => { const i = FIELDS.indexOf(f), xs = Object.values(runs).map(rows => rows[d][i]); const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); return { m, sd }; };
const fmt = (x, f) => ['happy', 'demR', 'demC', 'demI'].includes(f) ? x.toFixed(3) : x.toFixed(1);
console.log('\n| 天 | 指標 | 本線 | 實驗線（回退設定） | 差距 | 實驗線（預設＋舊版供電） | 差距 |\n|---|---|---|---|---|---|---|');
for (const d of [30, 60, 120].filter(d => d <= DAYS)) for (const f of FIELDS.slice(1)) {
  const a = stat(mine.runs, d, f), b = stat(out.configs.fallback.runs, d, f), c = stat(out.configs.default.runs, d, f);
  console.log(`| ${d} | ${f} | ${fmt(a.m, f)} ± ${fmt(a.sd, f)} | ${fmt(b.m, f)} ± ${fmt(b.sd, f)} | ${fmt(a.m - b.m, f)} | ${fmt(c.m, f)} ± ${fmt(c.sd, f)} | ${fmt(a.m - c.m, f)} |`);
}
console.log(`\n完成（${((Date.now() - t0) / 1000).toFixed(0)}s）`);

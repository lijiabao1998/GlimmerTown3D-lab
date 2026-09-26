// D011 驗收 3、4：實驗線實跑錨點與分享碼互通（離線工具，要無頭 Chrome；結果存成樣本，tools/unit-d011-parity.mjs 在 CI 上重算本線那一半逐項比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 node tools/d011-parity.mjs --lab=../lijiabao1998/glimmertown-lab [--days=120] [--seeds=8] [--code=起點碼 --out=輸出目錄（除錯用）]
// 流程（每個種子兩頁新頁面、各開一個 Chrome，同 D010）：
//   新城：GV.setMapSize(72)＋GV.newWorldSeeded(777)＋GV.importCode(新城碼換種子)＋GV.setSpeed(0)＋GV.ai(false)（回退設定：tools/lab-configs.mjs）；
//     A 段（開跑前）→ GV.step(1)（推進後的快照 snap1）→ B 段 → GV.save()＋GV.rawSave() 匯出 → 之後每天 GV.step(1) 到第 days 天。
//   預建城（d011-prebuilt.code.txt 換種子，同一套開法）：拆除劇本（tools/d011-ops.mjs prebuiltOps）→ GV.step(1) → 推進後的快照、每一棟住商工有沒有電。
//   手勢用實驗線自己的函式：拉線 commitRoadDraft436（62779）；框選與拆除 commitRect（62974。拆除確認讀 performance.now()（62985–62986）：那一次 commitRect 裡
//   把 performance.now 換成劇本的時鐘，跟本線 commitOp 的 now 同一串數，同 tools/lab-build.mjs 的做法）；點 paintTo（62751，包在 openUndo／closeUndo 裡，
//   同觸控點一下 62918）；復原 GV.undo（66594）；亂數對齊 R＝mulberry32(v)（37221–37222）。量法跟本線同一段原始碼（tools/d011-parity-lib.mjs）。
//   結算探針：在 'if(diff!==3)money+=income-upkeep;'（56053，全檔唯一）前面插一段只讀的程式（一行，不多出換行），記下當天收入、維護費的每一項輸入。
//   亂數：R 包一層計數；推進第 1 天（兩座城）時另記每一次抽取的呼叫堆疊，取最內層的實驗線行號（跳過 ri 37223 與出口自己；副本在出口之前的行號＝原檔）。
// 另開一頁：把本線 B 段之後匯出的碼（帶 d3）與拿掉 d3 的同一張碼各匯入實驗線，讀回對帳數字、道路等級、資金、難度、星等、里程碑。
// 注入只在記憶體副本（cdp overlay），實驗線原檔不動；存檔槽固定 3（preloadOf），不碰業主的存檔。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { withBrowser, ROOT } from './cdp.mjs';
import { decodeLabCode, encodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { DEFAULT_GAP } from './d011-ops.mjs';
import { SNAP_SRC, PICK_SRC, POWERED_SRC, PW_SRC, DIFF_SRC, LANDDIFF_SRC, INV_SRC, HS_SRC, EXTRA_SRC, PROBE_SRC, MEASURE_SRC, RC_SRC, ROW_FIELDS, r6, opsOf, prebuiltOf, parity3d, prebuilt3d, measureRows } from './d011-parity-lib.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), DAYS = +(arg('days') ?? 120), NSEEDS = +(arg('seeds') ?? 8);
const SEEDS = STARTER_SEEDS.slice(0, NSEEDS), J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim();
if (dirty) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const version = /const GAME_VER='([^']+)'/.exec(html)[1], anchor = /const GAME_ANCHOR='([^']+)'/.exec(html)[1];

// ---- 記憶體副本：一段出口（手勢、資金、狀態讀取、亂數計數與對齊）＋結算探針 ----
const EXPORT = `window.__d011={
  tap:(id,x,y)=>{tool=id;openUndo();paintLast=null;paintTo(x,y);closeUndo();paintLast=null;},
  line:(id,x0,y0,x1,y1)=>{tool=id;roadDraft436={x0,y0,x1,y1,active:true};const r=commitRoadDraft436();roadDraft436=null;return r;},
  rect:(id,x0,y0,x1,y1,now)=>{tool=id;rect.x0=x0;rect.y0=y0;rect.x1=x1;rect.y1=y1;performance.now=()=>now;try{commitRect();}finally{delete performance.now;}},
  money:()=>money,setMoney:v=>{money=v;return money;},diff:()=>diff,star:()=>bestStar,msIdx:()=>msIdx,noFlash:()=>{flashT=0;},
  state:()=>({tiles,COV,POL,POLBASE,POLTREE,LANDBASE,LAND,landDirty,landBox}),happyAgg:()=>happyAgg,
  n:0,cap:null,wrap:g=>()=>{__d011.n++;if(__d011.cap)__d011.cap.push(new Error().stack);return g();},
  countR:()=>{__d011.n=0;R=__d011.wrap(R);},seed:v=>{R=__d011.wrap(mulberry32(v));}};`;
const PROBE_LINE = 'if(diff!==3)money+=income-upkeep;';
if (html.split(PROBE_LINE).length !== 2) throw new Error('結算那一行要剛好出現 1 次');
if (PROBE_SRC.includes('\n')) throw new Error('探針要寫成一行（副本的行號才對得上原檔）');
const copy = injectLab(html.replace(PROBE_LINE, PROBE_SRC + PROBE_LINE), EXPORT);
const INJ = copy.slice(0, copy.indexOf('window.__d011={')).split('\n').length, EXL = EXPORT.split('\n').length;   // 出口佔第 INJ 行起的 EXL 行；之前的行號＝原檔
if (copy.split('\n').length !== html.split('\n').length + 1 + EXPORT.split('\n').length - 1) throw new Error('副本多出了出口以外的換行：行號對不上原檔');
const HTML_LINES = html.split('\n');

// 頁面裡的共用段：量法、逐筆照做、推進一天（抽取數、每一次抽取的行號、LANDBASE 改了幾格）
const ROWJS = `()=>{const s=GV.stats(),L=GV.truth496().labor,N=GV.N(),C={1:[0,0,0,0],2:[0,0,0,0],3:[0,0,0,0]},T=__d011.state().tiles;
  for(let i=0;i<N*N;i++){const b=T[i].bld;if(!b||b.ref||b.k<1||b.k>3)continue;C[b.k][0]++;C[b.k][b.lv||1]++;}
  return [s.day,s.pop,s.jobs,L.employed,L.workers,GV.skyline516B().happy,s.dem[1],s.dem[2],s.dem[3],...C[1],...C[2],...C[3],__d011.money(),POWERED(T)];}`;
const PRELUDE = `const SNAP=${SNAP_SRC},PICK=${PICK_SRC},POWERED=${POWERED_SRC},PW=${PW_SRC},DIFF=${DIFF_SRC},LANDDIFF=${LANDDIFF_SRC},INV=${INV_SRC},HS=${HS_SRC},EXTRA=${EXTRA_SRC},INJ=${INJ},EXL=${EXL};
  let probe=null;window.__d011p=o=>{probe=o;};
  const draws=()=>__d011.n,snap=()=>{const x=__d011.state();return SNAP(x.tiles,x.COV,x.POL,x.POLBASE,x.POLTREE,x.LANDBASE,x.LAND,x.landDirty,x.landBox);};
  const head=(x,m=true)=>({tileHash:x.tileHash,fieldHash:x.fieldHash,land:x.land,...(m?{money:__d011.money()}:{})});
  const row=${ROWJS};const picks={};let clock=0;
  const apply=o=>{
    if(o.k==='money'){__d011.setMoney(o.v);return {};}
    if(o.k==='seed'){__d011.seed(o.v);return {};}
    if(o.k==='undo'){GV.undo();return {};}
    if(o.k==='pick'){const f=PICK(__d011.state().tiles,GV.N(),o.rect,o.what);picks[o.as]=f;return {found:f};}
    const p=o.at?picks[o.at]:null;if(o.at&&!p)return {};
    const c=p?[p[0],p[1],p[0],p[1]]:o.k==='tap'?[o.x,o.z,o.x,o.z]:[o.x0,o.z0,o.x1,o.z1];
    if(o.k==='tap')__d011.tap(o.tool,c[0],c[1]);else if(o.k==='line')__d011.line(o.tool,c[0],c[1],c[2],c[3]);else __d011.rect(o.tool,c[0],c[1],c[2],c[3],clock);
    return {};};
  const batch=list=>list.map(o=>{clock+=o.gap??${DEFAULT_GAP};const a=snap(),d0=draws(),r=apply(o),b=snap();
    return {k:o.k,money:__d011.money(),draws:draws()-d0,tileHash:b.tileHash,fieldHash:b.fieldHash,land:b.land,changed:DIFF(a.proj,b.proj),...(o.k==='pick'?{found:r.found}:{})};});
  const tick=()=>{const d0=draws(),lb0=Uint8Array.from(__d011.state().LANDBASE);__d011.cap=[];GV.step(1);const caps=__d011.cap;__d011.cap=null;const sites={};
    for(const s of caps){const ls=[...s.matchAll(/d011\\.html[^:\\s]*:(\\d+):\\d+/g)].map(m=>+m[1]).filter(l=>(l<INJ||l>=INJ+EXL)&&l!==37223);const k=ls.length?ls[0]:0;sites[k]=(sites[k]||0)+1;}
    const x=__d011.state();return {draws:draws()-d0,sites,land:LANDDIFF(lb0,x.LANDBASE),extra:EXTRA(x.tiles,x.COV)};};
  const start=code=>{GV.setMapSize(72);GV.newWorldSeeded(777);const m0=window.__t531mig|0;if(!GV.importCode(code))throw new Error('import rejected');const mig=(window.__t531mig|0)-m0;GV.setSpeed(0);GV.ai(false);__d011.countR();return mig;};`;   // mig：讀檔時 T531 視覺遷移改了幾棟的變體（66859）
// 新城一個種子的整段（一次同步 evaluate；比較區間裡不讀檔、不按開始，同 D010）。
// shots：拍實驗線畫面的天數（開跑前那一批做完＝第 0 天；之後照經過的天數）。拍之前把閃電計時 flashT 歸零（純畫面，同 D010 lab-compare --shots）
const RUN = (code, ops, days, shots = []) => `(()=>{${PRELUDE}const SHOTS=${J(shots)},pics={};
  const shot=e=>{if(!SHOTS.includes(e))return;__d011.noFlash();GV.lookAt(${ops.site.x0 + 10},${ops.site.z0 + 10});GV.art574.zoom574(.75);GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();GV.forceDraw();pics[e]=document.getElementById('game').toDataURL('image/png');};
  start(${J(code)});
  const out={snap0:head(snap()),diff:__d011.diff(),star:__d011.star(),msIdx:__d011.msIdx()};
  out.A=batch(${J(ops.A)});out.snapA=head(snap());shot(0);
  const t1=tick();out.tick1Draws=t1.draws;out.tick1Sites=t1.sites;out.tick1Land=t1.land;out.tick1Extra=t1.extra;out.day1=row();out.probe1=probe;out.snap1=head(snap(),false);
  out.B=batch(${J(ops.B)});out.snapB=head(snap());
  GV.save();const raw=GV.rawSave();out.codeB=btoa(unescape(encodeURIComponent(raw)));out.measureB=${MEASURE_SRC};out.rcB=${RC_SRC};
  out.rows=[];out.nets=[];for(let d=2;d<=${days};d++){GV.step(1);out.rows.push(row());out.nets.push(probe?[probe.income,probe.upkeep]:null);shot(d);}   // 第 d 圈推完是第 d+1 天＝經過 d 天
  out.pics=pics;return out;})()`;
// 預建城一個種子：拆除劇本 → 推進一天 → 推進後的快照、推進改了哪些格、跟第 2 類系統無關的部分（INV）、每一棟住商工有沒有電、每一棟住宅的幸福、當天的幸福構成（happyAgg 55255）
const PRE = (code, P) => `(()=>{${PRELUDE}const mig=start(${J(code)});
  const out={mig,snap0:head(snap())};
  out.ops=batch(${J(P.ops)});const a=snap();out.snapOps=head(a);out.pwBefore=PW(__d011.state().tiles).map(r=>r[0]);
  const t=tick();out.tickDraws=t.draws;out.tickSites=t.sites;out.tickLand=t.land;out.tickExtra=t.extra;out.day1=row();out.probe=probe;
  const b=snap(),x=__d011.state();out.post=head(b,false);out.postChanged=DIFF(a.proj,b.proj);out.inv=INV(x.tiles,x.COV,x.POLTREE,x.LANDBASE,x.LAND);out.pw=PW(x.tiles);out.hs=HS(x.tiles);
  out.happyAgg=__d011.happyAgg().map(p=>[p.name,p.val]);
  return out;})()`;
// 匯入一張碼、讀回（本線 → 實驗線）
const READBACK = code => `(()=>{GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});
  return {ok,measure:${MEASURE_SRC},rc:${RC_SRC},money:__d011.money(),diff:__d011.diff(),star:__d011.star(),msIdx:__d011.msIdx(),day:GV.stats().day};})()`;
// 錄到的抽取行號要真的是實驗線原檔裡抽亂數的那一行（R() 或 ri(）
const checkSites = (sites, what) => { for (const l of Object.keys(sites)) if (!/\bR\(\)|\bri\(/.test(HTML_LINES[+l - 1] ?? '')) throw new Error(`${what}：抽取行號 ${l} 在實驗線原檔不是抽亂數的那一行`); };

const newcity = (arg('code') ? fs.readFileSync(arg('code'), 'utf8') : read('src/content/samples/newcity.code.txt')).trim();   // --code＝除錯用的別張起點碼
const prebuilt = read('src/content/samples/d011-prebuilt.code.txt').trim();
const OUT = arg('out') ?? path.join(ROOT, 'src/content/samples');   // --out＝除錯時寫到別處，不動正式樣本
const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
const vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
const ops = opsOf(newcity), P = prebuiltOf(prebuilt);
const t0 = Date.now(), lab = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, anchor, tool: 'tools/d011-parity.mjs', code: 'src/content/samples/newcity.code.txt', prebuilt: 'src/content/samples/d011-prebuilt.code.txt' },
  config: 'fallback', days: DAYS, seeds: SEEDS, fields: ROW_FIELDS, runs: {}, prebuilt: {}, readback: {}, timing: {} };
const threeD = { days: DAYS, seeds: SEEDS, fields: ROW_FIELDS, runs: {}, prebuilt: {} };
const cfg = CONFIGS.fallback;
const opt = { root: LAB, entry: 'd011.html', overlay: { 'd011.html': copy }, port: 8421, width: 1024, height: 700, gl: false, preload: preloadOf(cfg),
  ready: '!!window.__bootDone453&&!!window.__d011', readyMs: 240000, settle: 300 };
const rowR6 = x => [...x.slice(0, 21).map(r6), ...x.slice(21)];

// --shots：只跑第一個種子、拍 2D 畫面（第 0、30、60、120 天，1280×800）存到 scratch/lab/；這一跑的逐日數字要等於 d011-lab.json（拍照沒改到模擬）
if (process.argv.includes('--shots')) {
  const SH = [0, 30, 60, 120], dir = path.join(ROOT, 'scratch/lab');
  fs.mkdirSync(dir, { recursive: true });
  await withBrowser({ ...opt, width: 1280, height: 800 }, async ({ open, page }) => {
    await open('');
    const r = await page.evaluate(RUN(codeWithSeed(newcity, SEEDS[0]), ops, Math.max(...SH), SH));
    for (const [d, url] of Object.entries(r.pics)) fs.writeFileSync(path.join(dir, `d011_day${d}_2d.png`), Buffer.from(url.split(',')[1], 'base64'));
    const ref = JSON.parse(read('src/content/samples/d011-lab.json')).runs[SEEDS[0]], rows = r.rows.map(rowR6);
    const n = Math.min(rows.length, ref.rows.length), same = n > 100 && rows.slice(0, n).every((x, i) => J(x) === J(ref.rows[i]));
    console.log(`實驗線 2D 樣張第 ${Object.keys(r.pics).join('、')} 天（scratch/lab/d011_day*_2d.png）；這一跑的逐日數字＝d011-lab.json：${same}`);
    if (!same) process.exitCode = 1;
  });
  process.exit();
}

// 本線那一半先跑（B 段之後的碼要拿去實驗線讀回）
const mine = {}, minePre = {};
for (const seed of SEEDS) { mine[seed] = parity3d(codeWithSeed(newcity, seed), KT, vrank, DAYS); minePre[seed] = prebuilt3d(codeWithSeed(prebuilt, seed), KT, vrank); }

for (const seed of SEEDS) {
  const tm = lab.timing[seed] = {};
  await withBrowser(opt, async ({ open, page }) => {
    let t = Date.now();
    await open('');
    tm.boot = (Date.now() - t) / 1000; t = Date.now();
    const r = await page.evaluate(RUN(codeWithSeed(newcity, seed), ops, DAYS));
    tm.run = (Date.now() - t) / 1000;
    checkSites(r.tick1Sites, `種子 ${seed} 新城第 1 天`);
    r.day1 = rowR6(r.day1);
    r.rows = r.rows.map(rowR6);
    r.measureB = measureRows(r.measureB);
    delete r.pics;
    if (seed !== SEEDS[0]) for (const o of [...r.A, ...r.B]) o.changed = o.changed.length;   // 逐格明細只留第一個種子（其餘留格數與雜湊）
    lab.runs[seed] = r;
    if (page.errors.length) console.log(`  實驗線 console 錯誤（僅記錄，同 D010：overlay 頁面固有的 manifest／service worker 404）：${page.errors.slice(0, 3).join(' | ')}`);
    console.log(`種子 ${seed} 新城：開機 ${tm.boot.toFixed(1)}s、跑 ${tm.run.toFixed(1)}s；第 1 天 ${J(r.day1)}；抽取 ${r.tick1Draws}（${J(r.tick1Sites)}）；地價框改 ${r.tick1Land} 格；B 段後 $${r.snapB.money}`);
  });
  await withBrowser(opt, async ({ open, page }) => {
    let t = Date.now();
    await open('');
    tm.bootPre = (Date.now() - t) / 1000; t = Date.now();
    const r = await page.evaluate(PRE(codeWithSeed(prebuilt, seed), P));
    tm.pre = (Date.now() - t) / 1000;
    checkSites(r.tickSites, `種子 ${seed} 預建城`);
    r.day1 = rowR6(r.day1);
    lab.prebuilt[seed] = r;
    console.log(`種子 ${seed} 預建城：開機 ${tm.bootPre.toFixed(1)}s、跑 ${tm.pre.toFixed(1)}s；推進後 ${J(r.post)}；抽取 ${r.tickDraws}（${J(r.tickSites)}）；有電 ${r.pw.filter(q => q[1]).length}/${r.pw.length}`);
  });
}
// 本線 → 實驗線：B 段之後的碼（帶 d3）與拿掉 d3 的同一張碼（兩張碼的雜湊都記下，守衛在 Node 重算本線的碼、核對讀回的是同一張）
await withBrowser(opt, async ({ open, page }) => {
  await open('');
  for (const seed of SEEDS) {
    const code = mine[seed].codeB, raw = decodeLabCode(code).save.raw, o = { ...raw };
    delete o.z; delete o.d3;
    const plain = encodeLabCode(o, { deflate: true });
    const rb = async c => { const x = await page.evaluate(READBACK(c)); x.measure = measureRows(x.measure); return x; };
    lab.readback[seed] = { withD3: await rb(code), plain: await rb(plain), codeHash: fnv1a(code), plainHash: fnv1a(plain) };
  }
});
for (const seed of SEEDS) {
  const m = mine[seed]; delete m.sim;
  if (seed !== SEEDS[0]) for (const o of [...m.A, ...m.B]) o.changed = o.changed.length;
  threeD.runs[seed] = m;
  const p = minePre[seed]; delete p.sim;
  threeD.prebuilt[seed] = p;
}
lab.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(OUT, 'd011-lab.json'), J(lab));
fs.writeFileSync(path.join(OUT, 'd011-3d.json'), J(threeD));
console.log(`寫出 d011-lab.json、d011-3d.json（${lab.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);

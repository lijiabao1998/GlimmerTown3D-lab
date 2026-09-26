// D011 驗收 3、4：實驗線實跑錨點與分享碼互通（離線工具，要無頭 Chrome；結果存成樣本，tools/unit-d011-parity.mjs 在 CI 上重算本線那一半逐項比）。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 node tools/d011-parity.mjs --lab=../lijiabao1998/glimmertown-lab [--days=120] [--seeds=8] [--code=起點碼 --out=輸出目錄（除錯用）]
// 流程（每個種子一頁新頁面，同 D010）：
//   GV.setMapSize(72)＋GV.newWorldSeeded(777)＋GV.importCode(新城碼換種子)＋GV.setSpeed(0)＋GV.ai(false)（回退設定：tools/lab-configs.mjs）；
//   A 段（開跑前）→ GV.step(1) → B 段 → GV.save()＋GV.rawSave() 匯出 → 之後每天 GV.step(1) 到第 days 天。
//   手勢用實驗線自己的函式：拉線 commitRoadDraft436（62779）、框選 commitRect（62974）、點 paintTo（62751，包在 openUndo／closeUndo 裡，同觸控點一下 62918）、
//   復原 GV.undo（66594）。量法跟本線同一段原始碼（tools/d011-parity-lib.mjs）。
//   結算探針：在 'if(diff!==3)money+=income-upkeep;'（56053，全檔唯一）前面插一段只讀的程式，記下當天收入、維護費的每一項輸入。
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
import { SNAP_SRC, PICK_SRC, POWERED_SRC, DIFF_SRC, PROBE_SRC, MEASURE_SRC, RC_SRC, ROW_FIELDS, r6, opsOf, parity3d, measureRows } from './d011-parity-lib.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), DAYS = +(arg('days') ?? 120), NSEEDS = +(arg('seeds') ?? 8);
const SEEDS = STARTER_SEEDS.slice(0, NSEEDS), J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const dirty = execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim();
if (dirty) throw new Error('實驗線 index.html 有未提交的改動，不能當對拍基準');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const version = /const GAME_VER='([^']+)'/.exec(html)[1], anchor = /const GAME_ANCHOR='([^']+)'/.exec(html)[1];

// ---- 記憶體副本：一段出口（手勢、資金、狀態讀取、亂數計數）＋結算探針 ----
const EXPORT = `window.__d011={
  tap:(id,x,y)=>{tool=id;openUndo();paintLast=null;paintTo(x,y);closeUndo();paintLast=null;},
  line:(id,x0,y0,x1,y1)=>{tool=id;roadDraft436={x0,y0,x1,y1,active:true};const r=commitRoadDraft436();roadDraft436=null;return r;},
  rect:(id,x0,y0,x1,y1)=>{tool=id;rect.x0=x0;rect.y0=y0;rect.x1=x1;rect.y1=y1;commitRect();},
  money:()=>money,setMoney:v=>{money=v;return money;},diff:()=>diff,star:()=>bestStar,msIdx:()=>msIdx,noFlash:()=>{flashT=0;},
  state:()=>({tiles,COV,POL,POLBASE,POLTREE,landDirty,landBox}),
  countR:()=>{const g=R;let n=0;R=()=>{n++;return g();};return ()=>n;}};`;
const PROBE_LINE = 'if(diff!==3)money+=income-upkeep;';
if (html.split(PROBE_LINE).length !== 2) throw new Error('結算那一行要剛好出現 1 次');
const copy = injectLab(html.replace(PROBE_LINE, PROBE_SRC + PROBE_LINE), EXPORT);

// 一個種子的整段（一次同步 evaluate；比較區間裡不讀檔、不按開始，同 D010）
const ROWJS = `()=>{const s=GV.stats(),L=GV.truth496().labor,N=GV.N(),C={1:[0,0,0,0],2:[0,0,0,0],3:[0,0,0,0]},T=__d011.state().tiles;
  for(let i=0;i<N*N;i++){const b=T[i].bld;if(!b||b.ref||b.k<1||b.k>3)continue;C[b.k][0]++;C[b.k][b.lv||1]++;}
  return [s.day,s.pop,s.jobs,L.employed,L.workers,GV.skyline516B().happy,s.dem[1],s.dem[2],s.dem[3],...C[1],...C[2],...C[3],__d011.money(),POWERED(T)];}`;
// shots：拍實驗線畫面的天數（開跑前那一批做完＝第 0 天；之後照經過的天數）。拍之前把閃電計時 flashT 歸零（純畫面，同 D010 lab-compare --shots）
const RUN = (code, ops, days, shots = []) => `(()=>{const SNAP=${SNAP_SRC},PICK=${PICK_SRC},POWERED=${POWERED_SRC},DIFF=${DIFF_SRC},SHOTS=${J(shots)},pics={};
  const shot=e=>{if(!SHOTS.includes(e))return;__d011.noFlash();GV.lookAt(${ops.site.x0 + 10},${ops.site.z0 + 10});GV.art574.zoom574(.75);GV.setVisT(GV.art574.cycle574()*0.5);GV.forceDraw();GV.forceDraw();pics[e]=document.getElementById('game').toDataURL('image/png');};
  GV.setMapSize(72);GV.newWorldSeeded(777);if(!GV.importCode(${J(code)}))throw new Error('import rejected');GV.setSpeed(0);GV.ai(false);
  const draws=__d011.countR();let probe=null;window.__d011p=o=>{probe=o;};
  const snap=()=>{const x=__d011.state();return SNAP(x.tiles,x.COV,x.POL,x.POLBASE,x.POLTREE,x.landDirty,x.landBox);};
  const head=x=>({tileHash:x.tileHash,fieldHash:x.fieldHash,land:x.land,money:__d011.money()});
  const row=${ROWJS};const picks={};
  const apply=o=>{
    if(o.k==='money'){__d011.setMoney(o.v);return {};}
    if(o.k==='undo'){GV.undo();return {};}
    if(o.k==='pick'){const f=PICK(__d011.state().tiles,GV.N(),o.rect,+o.what.slice(1));picks[o.as]=f;return {found:f};}
    const p=o.at?picks[o.at]:null;if(o.at&&!p)return {};
    const c=p?[p[0],p[1],p[0],p[1]]:o.k==='tap'?[o.x,o.z,o.x,o.z]:[o.x0,o.z0,o.x1,o.z1];
    if(o.k==='tap')__d011.tap(o.tool,c[0],c[1]);else if(o.k==='line')__d011.line(o.tool,c[0],c[1],c[2],c[3]);else __d011.rect(o.tool,c[0],c[1],c[2],c[3]);
    return {};};
  const batch=list=>list.map(o=>{const a=snap(),d0=draws(),r=apply(o),b=snap();
    return {k:o.k,money:__d011.money(),draws:draws()-d0,tileHash:b.tileHash,fieldHash:b.fieldHash,land:b.land,changed:DIFF(a.proj,b.proj),...(o.k==='pick'?{found:r.found}:{})};});
  const out={snap0:head(snap()),diff:__d011.diff(),star:__d011.star(),msIdx:__d011.msIdx()};
  out.A=batch(${J(ops.A)});out.snapA=head(snap());shot(0);
  const d1=draws();GV.step(1);out.tick1Draws=draws()-d1;out.day1=row();out.probe1=probe;
  out.B=batch(${J(ops.B)});out.snapB=head(snap());
  GV.save();const raw=GV.rawSave();out.codeB=btoa(unescape(encodeURIComponent(raw)));out.measureB=${MEASURE_SRC};out.rcB=${RC_SRC};
  out.rows=[];out.nets=[];for(let d=2;d<=${days};d++){GV.step(1);out.rows.push(row());out.nets.push(probe?[probe.income,probe.upkeep]:null);shot(d);}   // 第 d 圈推完是第 d+1 天＝經過 d 天
  out.pics=pics;return out;})()`;
// 匯入一張碼、讀回（本線 → 實驗線）
const READBACK = code => `(()=>{GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});
  return {ok,measure:${MEASURE_SRC},rc:${RC_SRC},money:__d011.money(),diff:__d011.diff(),star:__d011.star(),msIdx:__d011.msIdx(),day:GV.stats().day};})()`;

const newcity = (arg('code') ? fs.readFileSync(arg('code'), 'utf8') : read('src/content/samples/newcity.code.txt')).trim();   // --code＝除錯用的別張起點碼
const OUT = arg('out') ?? path.join(ROOT, 'src/content/samples');   // --out＝除錯時寫到別處，不動正式樣本
const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json')));
const vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
const ops = opsOf(newcity);
const t0 = Date.now(), lab = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, anchor, tool: 'tools/d011-parity.mjs', code: 'src/content/samples/newcity.code.txt' }, config: 'fallback', days: DAYS, seeds: SEEDS, fields: ROW_FIELDS, runs: {}, readback: {} };
const threeD = { days: DAYS, seeds: SEEDS, fields: ROW_FIELDS, runs: {} };
const cfg = CONFIGS.fallback;
const opt = { root: LAB, entry: 'd011.html', overlay: { 'd011.html': copy }, port: 8421, width: 1024, height: 700, gl: false, preload: preloadOf(cfg),
  ready: '!!window.__bootDone453&&!!window.__d011', readyMs: 240000, settle: 300 };

// --shots：只跑第一個種子、拍 2D 畫面（第 0、30、60、120 天，1280×800）存到 scratch/lab/；這一跑的逐日數字要等於 d011-lab.json（拍照沒改到模擬）
if (process.argv.includes('--shots')) {
  const SH = [0, 30, 60, 120], dir = path.join(ROOT, 'scratch/lab');
  fs.mkdirSync(dir, { recursive: true });
  await withBrowser({ ...opt, width: 1280, height: 800 }, async ({ open, page }) => {
    await open('');
    const r = await page.evaluate(RUN(codeWithSeed(newcity, SEEDS[0]), ops, Math.max(...SH), SH));
    for (const [d, url] of Object.entries(r.pics)) fs.writeFileSync(path.join(dir, `d011_day${d}_2d.png`), Buffer.from(url.split(',')[1], 'base64'));
    const ref = JSON.parse(read('src/content/samples/d011-lab.json')).runs[SEEDS[0]], rows = r.rows.map(x => [...x.slice(0, 21).map(r6), ...x.slice(21)]);
    const n = Math.min(rows.length, ref.rows.length), same = n > 100 && rows.slice(0, n).every((x, i) => J(x) === J(ref.rows[i]));
    console.log(`實驗線 2D 樣張第 ${Object.keys(r.pics).join('、')} 天（scratch/lab/d011_day*_2d.png）；這一跑的逐日數字＝d011-lab.json：${same}`);
    if (!same) process.exitCode = 1;
  });
  process.exit();
}

// 本線那一半先跑（B 段之後的碼要拿去實驗線讀回）
const mine = {};
for (const seed of SEEDS) mine[seed] = parity3d(codeWithSeed(newcity, seed), KT, vrank, DAYS);

for (const seed of SEEDS) {
  await withBrowser(opt, async ({ open, page }) => {
    await open('');
    const t = Date.now(), r = await page.evaluate(RUN(codeWithSeed(newcity, seed), ops, DAYS));
    r.day1 = [...r.day1.slice(0, 21).map(r6), ...r.day1.slice(21)];
    r.rows = r.rows.map(x => [...x.slice(0, 21).map(r6), ...x.slice(21)]);
    r.measureB = measureRows(r.measureB);
    if (seed !== SEEDS[0]) for (const o of [...r.A, ...r.B]) o.changed = o.changed.length;   // 逐格明細只留第一個種子（其餘留格數與雜湊）
    lab.runs[seed] = r;
    if (page.errors.length) console.log(`  實驗線 console 錯誤（僅記錄，同 D010：overlay 頁面固有的 manifest／service worker 404）：${page.errors.slice(0, 3).join(' | ')}`);
    console.log(`種子 ${seed}：${((Date.now() - t) / 1000).toFixed(1)}s；第 1 天 ${J(r.day1)}；B 段後 $${r.snapB.money}`);
  });
}
// 本線 → 實驗線：B 段之後的碼（帶 d3）與拿掉 d3 的同一張碼
await withBrowser(opt, async ({ open, page }) => {
  await open('');
  for (const seed of SEEDS) {
    const code = mine[seed].codeB, raw = decodeLabCode(code).save.raw, o = { ...raw };
    delete o.z; delete o.d3;
    const plain = encodeLabCode(o, { deflate: true });
    const rb = async c => { const x = await page.evaluate(READBACK(c)); x.measure = measureRows(x.measure); return x; };
    lab.readback[seed] = { withD3: await rb(code), plain: await rb(plain), codeHash: fnv1a(code) };
  }
});
for (const seed of SEEDS) {
  const m = mine[seed]; delete m.sim;
  if (seed !== SEEDS[0]) for (const o of [...m.A, ...m.B]) o.changed = o.changed.length;
  threeD.runs[seed] = m;
}
lab.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(OUT, 'd011-lab.json'), J(lab));
fs.writeFileSync(path.join(OUT, 'd011-3d.json'), J(threeD));
console.log(`寫出 d011-lab.json、d011-3d.json（${lab.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);


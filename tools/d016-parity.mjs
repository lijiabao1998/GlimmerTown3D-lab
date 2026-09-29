// D016 驗收 2：公共設施九支的實驗線實跑錨點與分享碼互通（離線工具，要無頭 Chrome；結果存成樣本 d016-lab.json，
// tools/unit-d016-parity.mjs 在 CI 上重算本線那一半逐項比）。做法與注入跟 tools/d011-parity.mjs 同一套（行號 index.html @ d23c18d）：
//   記憶體副本：同一段出口（window.__d011：點 paintTo、線 commitRoadDraft436、框 commitRect＋劇本時鐘、資金、狀態、亂數計數與對齊）＋結算探針
//   （'if(diff!==3)money+=income-upkeep;' 56053 前面插一行；探針另讀主計數迴圈 55050–55063 數的圖書館、郵局、墓園……，見 d016-ops.mjs PROBE16_EXTRA）。
//   每個種子兩頁新頁面：
//     新城（newcity.code.txt 換種子）：A 段（D011）→ C 段（D016，tools/d016-ops.mjs）→ GV.step(1) → 第 1 天那一列、探針、推進後的快照、設施清單 → GV.save()＋GV.rawSave() 匯出；
//     預建城（d011-prebuilt.code.txt 換種子）：九種設施 → 拆診所再復原 → GV.step(1) → 推進後的 INV、有電、每一棟住宅的幸福、探針。
//   另開一頁：本線匯出的碼（C 段＋第 1 天之後）匯入實驗線，讀回設施清單與對帳數字。
// 用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 [GT_PORT=8712] node tools/d016-parity.mjs --lab=/path/to/glimmertown-lab [--seeds=8]
//       --set=d017（D017 噪音）：只跑預建城、體育場留著（不拆噪音源），寫 src/content/samples/d017-lab.json
//       --set=d019（D019 供水）：預建城改跑供水劇本（tools/d019-ops.mjs：一條接水塔的配水管、一條沒接的），另外量水管、接通的水管、每一棟的水，匯出實驗線的碼；
//         樣本城（AI 城 120 天、種子城）讀進來推進一天；本線的預建城碼匯入實驗線讀回水管。寫 src/content/samples/d019-lab.json
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { withBrowser, ROOT } from './cdp.mjs';
import { decodeLabCode, codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { STARTER_SEEDS } from '../src/content/starter.ts';
import { CONFIGS, preloadOf, injectLab } from './lab-configs.mjs';
import { DEFAULT_GAP } from './d011-ops.mjs';
import { SNAP_SRC, PICK_SRC, POWERED_SRC, PW_SRC, DIFF_SRC, LANDDIFF_SRC, INV_SRC, HS_SRC, EXTRA_SRC, PROBE_SRC, MEASURE_SRC, r6, measureRows } from './d011-parity-lib.mjs';
import { d016Ops, prebuilt16Ops, civic3d, CIVV_SRC, PROBE16_EXTRA } from './d016-ops.mjs';
import { loadCode } from '../src/io/save.ts';
import { WA_SRC, WP_SRC, WR_SRC, prebuilt19Ops, prebuilt19 } from './d019-ops.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), NSEEDS = +(arg('seeds') ?? 8), SET = arg('set') ?? 'd016';
if (!['d016', 'd017', 'd019'].includes(SET)) throw new Error(`--set 只能是 d016、d017 或 d019：${SET}`);
const D17 = SET === 'd017', D19 = SET === 'd019';
const SEEDS = STARTER_SEEDS.slice(0, NSEEDS), J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const commit = execFileSync('git', ['-C', LAB, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (commit !== 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0') throw new Error(`D016 實驗線版本錯誤：${commit}`);
if (execFileSync('git', ['-C', LAB, 'status', '--porcelain', 'index.html'], { encoding: 'utf8' }).trim()) throw new Error('實驗線 index.html 有未提交的改動');
const html = fs.readFileSync(path.join(LAB, 'index.html'), 'utf8');
const version = /const GAME_VER='([^']+)'/.exec(html)[1];

// 出口：同 tools/d011-parity.mjs 的 EXPORT（一字不改）
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
const PROBE16 = PROBE_SRC.replace('const o={};', `const o={};${PROBE16_EXTRA.map(n => `try{o.${n}=${n};}catch(e){}`).join('')}`);
if (PROBE16 === PROBE_SRC || PROBE16.includes('\n')) throw new Error('探針要多讀設施數、而且寫成一行');
const copy = injectLab(html.replace(PROBE_LINE, PROBE16 + PROBE_LINE), EXPORT);
const INJ = copy.slice(0, copy.indexOf('window.__d011={')).split('\n').length, EXL = EXPORT.split('\n').length;
if (copy.split('\n').length !== html.split('\n').length + 1 + EXPORT.split('\n').length - 1) throw new Error('副本多出了出口以外的換行：行號對不上原檔');

// 頁面裡的共用段（同 d011-parity.mjs 的 PRELUDE；多一個 CIVV）
const ROWJS = `()=>{const s=GV.stats(),L=GV.truth496().labor,N=GV.N(),C={1:[0,0,0,0],2:[0,0,0,0],3:[0,0,0,0]},T=__d011.state().tiles;
  for(let i=0;i<N*N;i++){const b=T[i].bld;if(!b||b.ref||b.k<1||b.k>3)continue;C[b.k][0]++;C[b.k][b.lv||1]++;}
  return [s.day,s.pop,s.jobs,L.employed,L.workers,GV.skyline516B().happy,s.dem[1],s.dem[2],s.dem[3],...C[1],...C[2],...C[3],__d011.money(),POWERED(T)];}`;
const PRELUDE = `${D19 ? `const WA=${WA_SRC},WP=${WP_SRC},WR=${WR_SRC};` : ''}const SNAP=${SNAP_SRC},PICK=${PICK_SRC},POWERED=${POWERED_SRC},PW=${PW_SRC},DIFF=${DIFF_SRC},LANDDIFF=${LANDDIFF_SRC},INV=${INV_SRC},HS=${HS_SRC},EXTRA=${EXTRA_SRC},CIVV=${CIVV_SRC},INJ=${INJ},EXL=${EXL};
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
    for(const s of caps){const ls=[...s.matchAll(/d016\\.html[^:\\s]*:(\\d+):\\d+/g)].map(m=>+m[1]).filter(l=>(l<INJ||l>=INJ+EXL)&&l!==37223);const k=ls.length?ls[0]:0;sites[k]=(sites[k]||0)+1;}
    const x=__d011.state();return {draws:draws()-d0,sites,land:LANDDIFF(lb0,x.LANDBASE),extra:EXTRA(x.tiles,x.COV)};};
  const start=code=>{GV.setMapSize(72);GV.newWorldSeeded(777);const m0=window.__t531mig|0;if(!GV.importCode(code))throw new Error('import rejected');const mig=(window.__t531mig|0)-m0;GV.setSpeed(0);GV.ai(false);__d011.countR();return mig;};`;
const RUN = (code, ops) => `(()=>{${PRELUDE}
  start(${J(code)});
  const out={snap0:head(snap())};
  out.A=batch(${J(ops.A)});out.snapA=head(snap());
  out.C=batch(${J(ops.C)});out.snapC=head(snap());out.civvC=CIVV(__d011.state().tiles);
  const t1=tick();out.tick1Draws=t1.draws;out.tick1Sites=t1.sites;out.tick1Land=t1.land;out.tick1Extra=t1.extra;out.day1=row();out.probe1=probe;out.snap1=head(snap(),false);
  out.civv1=CIVV(__d011.state().tiles);
  GV.save();const raw=GV.rawSave();out.codeC=btoa(unescape(encodeURIComponent(raw)));out.measureC=${MEASURE_SRC};
  return out;})()`;
const PRE = (code, P) => `(()=>{${PRELUDE}const mig=start(${J(code)});
  const out={mig,snap0:head(snap())};
  out.ops=batch(${J(P.ops)});const a=snap();out.snapOps=head(a);
  const t=tick();out.tickDraws=t.draws;out.tickSites=t.sites;out.tickLand=t.land;out.tickExtra=t.extra;out.day1=row();out.probe=probe;
  const b=snap(),x=__d011.state();out.post=head(b,false);out.postChanged=DIFF(a.proj,b.proj);out.inv=INV(x.tiles,x.COV,x.POLTREE,x.LANDBASE,x.LAND);out.pw=PW(x.tiles);out.hs=HS(x.tiles);
  ${D19 ? 'out.wa=WA(x.tiles);out.wr=WR(x.tiles);GV.save();out.codeW=btoa(unescape(encodeURIComponent(GV.rawSave())));' : ''}
  return out;})()`;
// D019：劇本做完（推進之前）量水管與接通的水管——插在 batch 之後那一行
const PRE19 = (code, P) => PRE(code, P).replace('const a=snap();out.snapOps=head(a);', 'const a=snap();out.snapOps=head(a);out.wp=WP(__d011.state().tiles);out.wrOps=WR(__d011.state().tiles);');
// D019：樣本城讀進來推進一天
const SAMPLE19 = code => `(()=>{${PRELUDE}const mig=start(${J(code)});const t=tick();const x=__d011.state();
  return {mig,tickDraws:t.draws,tickSites:t.sites,wa:WA(x.tiles),pw:PW(x.tiles),wr:WR(x.tiles),wp:WP(x.tiles)};})()`;
// D019：本線的碼匯入實驗線，讀回水管與對帳數字
const READBACK19 = code => `(()=>{const WP=${WP_SRC};GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});
  return {ok,wp:WP(__d011.state().tiles),measure:${MEASURE_SRC},money:__d011.money(),day:GV.stats().day};})()`;
const READBACK = code => `(()=>{const CIVV=${CIVV_SRC};GV.setMapSize(72);GV.newWorldSeeded(777);const ok=GV.importCode(${J(code)});
  return {ok,civv:CIVV(__d011.state().tiles),measure:${MEASURE_SRC},money:__d011.money(),day:GV.stats().day};})()`;

const newcity = read('src/content/samples/newcity.code.txt').trim(), prebuilt = read('src/content/samples/d011-prebuilt.code.txt').trim();
const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
const S0 = decodeLabCode(newcity).save, lay = k => Uint8Array.from(S0.layers[k] ?? '', ch => ch.charCodeAt(0) - 48);
const ops = d016Ops(S0.n, lay('ter'), lay('el'), lay('tre'));
const P = D19 ? prebuilt19Ops(loadCode(codeWithSeed(prebuilt, SEEDS[0]), KT, vrank).sim) : prebuilt16Ops(loadCode(codeWithSeed(prebuilt, SEEDS[0]), KT, vrank).sim, D17);   // 劇本只看格子（讀檔重挑不動位置），每個種子同一份
const cfg = CONFIGS.fallback;
const opt = { root: LAB, entry: 'd016.html', overlay: { 'd016.html': copy }, port: +(process.env.GT_PORT ?? 0) || 8422, width: 1024, height: 700, gl: false, preload: preloadOf(cfg),
  ready: '!!window.__bootDone453&&!!window.__d011', readyMs: 240000, settle: 300 };
const rowR6 = x => [...x.slice(0, 21).map(r6), ...x.slice(21)];
const t0 = Date.now(), lab = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: D17 ? 'tools/d016-parity.mjs --set=d017' : D19 ? 'tools/d016-parity.mjs --set=d019' : 'tools/d016-parity.mjs', code: 'src/content/samples/newcity.code.txt', prebuilt: 'src/content/samples/d011-prebuilt.code.txt' },
  config: 'fallback', seeds: SEEDS, probeExtra: PROBE16_EXTRA, keepNoise: D17, runs: {}, prebuilt: {}, readback: {}, ...(D19 ? { samples: {} } : {}) };

for (const seed of SEEDS) {
  if (!D17 && !D19) await withBrowser(opt, async ({ open, page }) => {
    await open('');
    const r = await page.evaluate(RUN(codeWithSeed(newcity, seed), ops));
    r.day1 = rowR6(r.day1); r.measureC = measureRows(r.measureC);
    if (seed !== SEEDS[0]) for (const o of [...r.A, ...r.C]) o.changed = o.changed.length;   // 逐格明細只留第一個種子
    lab.runs[seed] = r;
    console.log(`種子 ${seed} 新城：第 1 天 ${J(r.day1)}；收入 ${r.probe1?.income} 維護費 ${r.probe1?.upkeep}；設施 ${r.civv1.length} 棟；抽取 ${r.tick1Draws}`);
  });
  await withBrowser(opt, async ({ open, page }) => {
    await open('');
    const r = await page.evaluate((D19 ? PRE19 : PRE)(codeWithSeed(prebuilt, seed), P));
    r.day1 = rowR6(r.day1);
    lab.prebuilt[seed] = r;
    console.log(`種子 ${seed} 預建城：推進後 ${J(r.post)}；住宅 ${r.hs.length} 棟；抽取 ${r.tickDraws}${D19 ? `；水管 ${r.wp.length} 格、接通 ${r.wrOps.length}、有水 ${r.wa.filter(q => q[1]).length}／${r.wa.length}` : ''}`);
  });
}
// D019：樣本城讀進來推進一天；本線預建城（劇本＋推進一天）匯出的碼給實驗線讀回
if (D19) await withBrowser(opt, async ({ open, page }) => {
  await open('');
  for (const id of ['ai120', 'seed516']) {
    const x = await page.evaluate(SAMPLE19(read(`src/content/samples/${id}.code.txt`).trim()));
    lab.samples[id] = x;
    console.log(`樣本城 ${id}：水管 ${x.wp.length} 格、接通 ${x.wr.length}、有水 ${x.wa.filter(q => q[1]).length}／${x.wa.length}；抽取 ${x.tickDraws}`);
  }
  for (const seed of SEEDS) {
    const code = prebuilt19(codeWithSeed(prebuilt, seed), KT, vrank).code;
    const x = await page.evaluate(READBACK19(code));
    x.measure = measureRows(x.measure);
    lab.readback[seed] = { ...x, codeHash: fnv1a(code) };
  }
});
// 本線 → 實驗線：本線 C 段＋第 1 天之後匯出的碼（D017、D019 不跑）
if (!D17 && !D19) await withBrowser(opt, async ({ open, page }) => {
  await open('');
  for (const seed of SEEDS) {
    const code = civic3d(codeWithSeed(newcity, seed), KT, vrank).codeC;
    const x = await page.evaluate(READBACK(code));
    x.measure = measureRows(x.measure);
    lab.readback[seed] = { ...x, codeHash: fnv1a(code) };
  }
});
lab.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(ROOT, `src/content/samples/${SET}-lab.json`), J(lab));
console.log(`寫出 ${SET}-lab.json（${lab.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);

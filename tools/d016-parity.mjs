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
//       --set=d020（D020 垃圾）：預建城改跑垃圾場劇本（tools/d020-ops.mjs：接長一條路、蓋一座接路的垃圾場、一座不接路的、蓋了再復原、蓋了再拆、兩個拒絕），
//         推進一天量每一棟住宅的幸福、局部垃圾係數、清運狀態全部（每一格路的距離／來源／分區、設施、各區容量／需求／負載，實驗線讀 SAN_DIST445 等全域）、垃圾比例、評分；
//         讀進來的城（AI 城 120 天、種子城）與自己造的城（tools/d020-cities.mjs：人口 500 以上與以下、超載區、死路網、斷開的路網、多格設施貼兩段路、接不到路的住宅……，
//         用本線的 encodeLabCode 生碼）讀進實驗線推進一天；本線的預建城碼（帶垃圾場）匯入實驗線讀回。每一座城開新頁（頁面存了上一個世界的噪音場就不對了），
//         匯入之前核對噪音場全 0。寫 src/content/samples/d020-lab.json（--jobs=N 同時開 N 個瀏覽器，預設 3，埠 GT_PORT＋0…N−1，約 10 分鐘；
//         除錯用：--out=別的路徑、--cities=F1,S2 只跑幾座城；預設寫進樣本目錄）。用法：CHROME_PATH=... TMPDIR=/tmp/claude-0 GT_PORT=8911 node tools/d016-parity.mjs --set=d020 --lab=/path/to/glimmertown-lab
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
import { SAN20_SRC, RES20_SRC, SCNT_SRC, prebuilt20Ops, prebuilt20 } from './d020-ops.mjs';
import { cities20 } from './d020-cities.mjs';

const arg = k => process.argv.find(a => a.startsWith(`--${k}=`))?.split('=')[1];
const LAB = path.resolve(arg('lab') ?? '../lijiabao1998/glimmertown-lab'), NSEEDS = +(arg('seeds') ?? 8), SET = arg('set') ?? 'd016';
if (!['d016', 'd017', 'd019', 'd020'].includes(SET)) throw new Error(`--set 只能是 d016、d017、d019 或 d020：${SET}`);
const D17 = SET === 'd017', D19 = SET === 'd019', D20 = SET === 'd020';
const SEEDS = STARTER_SEEDS.slice(0, NSEEDS), J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const OUT = arg('out') ?? path.join(ROOT, `src/content/samples/${SET}-lab.json`), ONLY = arg('cities')?.split(',');
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
// D020 另外的出口（只有 --set=d020 插）：清運狀態全部的原料（實驗線的全域 SAN_DIST445 等，格式見 tools/d020-ops.mjs SAN20_SRC）、評分、噪音場是不是全 0
const EXPORT20 = `window.__d011.noiseZero=()=>NOISE.every(v=>v===0);
window.__d020x=()=>({tiles,dist:SAN_DIST445,src:SAN_SRC445,active:SAN_ACTIVE445,net:SAN_NET452,allRoots:sanAllRoots445,activeRoots:sanActiveRoots445,stat:sanStat445,districts:sanDistricts452,fac:[...sanFacilityMap452],rootAlloc:[...sanRootAlloc452],alloc:sanAlloc452,garbLocal,g:{garbage,garbCap,garbRatio,dec:garbDecisionRatio452()}});
window.__d020h=k=>{const o=[];for(let i=0;i<tiles.length;i++){const b=tiles[i].bld;if(b&&!b.ref&&b.k===1)o.push([i,b.h]);}(window.__d020hh||(window.__d020hh={}))[k]=o;};
window.__d020s=()=>({score,cityStar,parts:scoreParts?{...scoreParts}:null,cityHappy,pop,jobs,commuteN:commutePenalty.reduce((a,v)=>a+(v>0?1:0),0),loadN:roadLoad.reduce((a,v)=>a+(v>0?1:0),0)});`;
const EXP = D20 ? EXPORT + '\n' + EXPORT20 : EXPORT;
const PROBE_LINE = 'if(diff!==3)money+=income-upkeep;';
if (html.split(PROBE_LINE).length !== 2) throw new Error('結算那一行要剛好出現 1 次');
const PROBE16 = PROBE_SRC.replace('const o={};', `const o={};${PROBE16_EXTRA.map(n => `try{o.${n}=${n};}catch(e){}`).join('')}`);
if (PROBE16 === PROBE_SRC || PROBE16.includes('\n')) throw new Error('探針要多讀設施數、而且寫成一行');
// D020：探針多讀垃圾的其餘幾項（garbWarn445、garbLoc445.penAvg 是 tick 裡的區域變數；jobsI 也是）；pop 是全域，這裡讀是為了跟結算同一個時刻
const PROBE20 = PROBE16.replace('const o={};', `const o={};try{o.jobsI=jobsI;}catch(e){}try{o.garbWarn445=garbWarn445;}catch(e){}try{o.garbPenAvg=garbLoc445.penAvg;}catch(e){}try{o.popT=pop;}catch(e){}`);
if (D20 && (PROBE20 === PROBE16 || PROBE20.includes('\n'))) throw new Error('D020 探針要多讀垃圾的其餘幾項、而且寫成一行');
// D020：垃圾那一段（55257 起到 55279 之前）前後各記一次每一棟住宅的幸福 h：h0＝垃圾之前（幸福公式的結果）、h1＝垃圾之後（糧食之前）。同一行前面插一句，行號不動
const H_A = 'const recycleMul452=(pol&&pol.recycle?.85:1);', H_B = 'computeBusRtCovPop();prepareCivicServices495(entNow489);';
if (D20) for (const a of [H_A, H_B]) if (html.split(a).length !== 2) throw new Error(`D020 探針錨點要剛好出現 1 次：${a}`);
const htmlP = D20 ? html.replace(H_A, `try{__d020h(0);}catch(e){}${H_A}`).replace(H_B, `try{__d020h(1);}catch(e){}${H_B}`) : html;
const copy = injectLab(htmlP.replace(PROBE_LINE, (D20 ? PROBE20 : PROBE16) + PROBE_LINE), EXP);
const INJ = copy.slice(0, copy.indexOf('window.__d011={')).split('\n').length, EXL = EXP.split('\n').length;
if (copy.split('\n').length !== html.split('\n').length + 1 + EXP.split('\n').length - 1) throw new Error('副本多出了出口以外的換行：行號對不上原檔');

// 頁面裡的共用段（同 d011-parity.mjs 的 PRELUDE；多一個 CIVV）
const ROWJS = `()=>{const s=GV.stats(),L=GV.truth496().labor,N=GV.N(),C={1:[0,0,0,0],2:[0,0,0,0],3:[0,0,0,0]},T=__d011.state().tiles;
  for(let i=0;i<N*N;i++){const b=T[i].bld;if(!b||b.ref||b.k<1||b.k>3)continue;C[b.k][0]++;C[b.k][b.lv||1]++;}
  return [s.day,s.pop,s.jobs,L.employed,L.workers,GV.skyline516B().happy,s.dem[1],s.dem[2],s.dem[3],...C[1],...C[2],...C[3],__d011.money(),POWERED(T)];}`;
const PRELUDE = `${D19 ? `const WA=${WA_SRC},WP=${WP_SRC},WR=${WR_SRC};` : ''}${D20 ? `const SAN20=${SAN20_SRC},RES20=${RES20_SRC},SCNT20=${SCNT_SRC};` : ''}const SNAP=${SNAP_SRC},PICK=${PICK_SRC},POWERED=${POWERED_SRC},PW=${PW_SRC},DIFF=${DIFF_SRC},LANDDIFF=${LANDDIFF_SRC},INV=${INV_SRC},HS=${HS_SRC},EXTRA=${EXTRA_SRC},CIVV=${CIVV_SRC},INJ=${INJ},EXL=${EXL};
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
  const start=code=>{GV.setMapSize(72);GV.newWorldSeeded(777);${D20 ? "if(!__d011.noiseZero())throw new Error('噪音場不是全 0：頁面留了上一個世界的狀態');" : ''}const m0=window.__t531mig|0;if(!GV.importCode(code))throw new Error('import rejected');const mig=(window.__t531mig|0)-m0;GV.setSpeed(0);GV.ai(false);__d011.countR();return mig;};${D20 ? `
  const SANX=()=>{const X=__d020x();Object.assign(X.g,{garbPen409:probe.garbPen409,far:probe.garbFar409,unserved:probe.garbUnserved445,warn:probe.garbWarn445,penAvg:probe.garbPenAvg});return SAN20(X);};
  const PK=['garbage','garbCap','garbPen409','garbFar409','garbUnserved445','garbWarn445','garbPenAvg','garbRatio','foodCoreNeed482','foodSupplyRate482','jobsI','popT'],pickP=()=>Object.fromEntries(PK.map(k=>[k,probe[k]]));` : ''}`;
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
// D020：預建城劇本 → 推進一天；量每一棟住宅、清運狀態全部、評分、設施清單，另外匯出實驗線的碼（設施清單本線解碼要一樣）
const PRE20 = (code, P) => `(()=>{${PRELUDE}const mig=start(${J(code)});const popImport=__d020s().pop;
  const out={mig,popImport,snap0:head(snap())};
  out.ops=batch(${J(P.ops)});const a=snap();out.snapOps=head(a);
  window.__d020hh={};const t=tick();out.tickDraws=t.draws;out.tickSites=t.sites;out.tickLand=t.land;out.tickExtra=t.extra;out.day1=row();out.pk=pickP();out.h0=__d020hh[0];out.h1=__d020hh[1];
  const b=snap(),x=__d011.state();out.post=head(b,false);out.postChanged=DIFF(a.proj,b.proj);out.inv=INV(x.tiles,x.COV,x.POLTREE,x.LANDBASE,x.LAND);out.pw=PW(x.tiles);out.hs=HS(x.tiles);
  out.san=SANX();out.res=RES20(x.tiles,__d020x().garbLocal);out.scnt=SCNT20(x.tiles,x.COV);out.sc=__d020s();out.civv=CIVV(x.tiles);
  GV.save();out.codeD=btoa(unescape(encodeURIComponent(GV.rawSave())));
  return out;})()`;
// D020：讀進來的城（樣本城、自己造的城）推進一天
const CITY20 = code => `(()=>{${PRELUDE}const mig=start(${J(code)});const popImport=__d020s().pop;window.__d020hh={};const t=tick();const x=__d011.state();
  return {mig,popImport,h0:__d020hh[0],h1:__d020hh[1],tickDraws:t.draws,tickSites:t.sites,tickLand:t.land,hs:HS(x.tiles),san:SANX(),res:RES20(x.tiles,__d020x().garbLocal),scnt:SCNT20(x.tiles,x.COV),sc:__d020s(),pk:pickP()};})()`;
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
const P = D20 ? prebuilt20Ops(loadCode(codeWithSeed(prebuilt, SEEDS[0]), KT, vrank).sim) : D19 ? prebuilt19Ops(loadCode(codeWithSeed(prebuilt, SEEDS[0]), KT, vrank).sim) : prebuilt16Ops(loadCode(codeWithSeed(prebuilt, SEEDS[0]), KT, vrank).sim, D17);   // 劇本只看格子（讀檔重挑不動位置），每個種子同一份
const cfg = CONFIGS.fallback;
const opt = { root: LAB, entry: 'd016.html', overlay: { 'd016.html': copy }, port: +(process.env.GT_PORT ?? 0) || 8422, width: 1024, height: 700, gl: false, preload: preloadOf(cfg),
  ready: '!!window.__bootDone453&&!!window.__d011', readyMs: 240000, settle: 300 };
const rowR6 = x => [...x.slice(0, 21).map(r6), ...x.slice(21)];
const t0 = Date.now(), lab = { source: { repo: 'lijiabao1998/GlimmerTown-lab', commit, version, tool: D17 ? 'tools/d016-parity.mjs --set=d017' : D19 ? 'tools/d016-parity.mjs --set=d019' : D20 ? 'tools/d016-parity.mjs --set=d020' : 'tools/d016-parity.mjs', code: 'src/content/samples/newcity.code.txt', prebuilt: 'src/content/samples/d011-prebuilt.code.txt' },
  config: 'fallback', seeds: SEEDS, probeExtra: PROBE16_EXTRA, keepNoise: D17, runs: {}, prebuilt: {}, readback: {}, ...(D19 ? { samples: {} } : {}), ...(D20 ? { cityList: [], cities: {} } : {}) };

for (const seed of SEEDS) {
  if (D20) continue;   // D020 在下面用一組同時開的瀏覽器（--jobs）跑
  if (!D17 && !D19 && !D20) await withBrowser(opt, async ({ open, page }) => {
    await open('');
    const r = await page.evaluate(RUN(codeWithSeed(newcity, seed), ops));
    r.day1 = rowR6(r.day1); r.measureC = measureRows(r.measureC);
    if (seed !== SEEDS[0]) for (const o of [...r.A, ...r.C]) o.changed = o.changed.length;   // 逐格明細只留第一個種子
    lab.runs[seed] = r;
    console.log(`種子 ${seed} 新城：第 1 天 ${J(r.day1)}；收入 ${r.probe1?.income} 維護費 ${r.probe1?.upkeep}；設施 ${r.civv1.length} 棟；抽取 ${r.tick1Draws}`);
  });
  await withBrowser(opt, async ({ open, page }) => {
    await open('');
    const r = await page.evaluate((D20 ? PRE20 : D19 ? PRE19 : PRE)(codeWithSeed(prebuilt, seed), P));
    r.day1 = rowR6(r.day1);
    lab.prebuilt[seed] = r;
    console.log(`種子 ${seed} 預建城：推進後 ${J(r.post)}；住宅 ${r.hs.length} 棟；抽取 ${r.tickDraws}${D19 ? `；水管 ${r.wp.length} 格、接通 ${r.wrOps.length}、有水 ${r.wa.filter(q => q[1]).length}／${r.wa.length}` : ''}${D20 ? `；垃圾 ${r.pk.garbage}／容量 ${r.pk.garbCap}、局部扣分 ${r.pk.garbFar409} 棟、評分 ${r.sc.score}` : ''}`);
  });
}
// D020：預建城 8 個種子、讀進來的城（AI 城 120 天、種子城、自己造的城）每一座都開新頁（頁面存了上一個世界的噪音場就不對了；匯入前核對噪音場全 0），
// 本線預建城（劇本＋推進一天）匯出的碼（帶垃圾場）給實驗線讀回。--jobs=N 同時開 N 個瀏覽器（埠 GT_PORT＋0…N−1；預設 3），輸出照固定順序寫（跟 jobs 數無關）
if (D20) {
  const CITIES = cities20(newcity, { ai120: read('src/content/samples/ai120.code.txt'), seed516: read('src/content/samples/seed516.code.txt') }).filter(c => !ONLY || ONLY.includes(c.id));
  lab.cityList = CITIES.map(c => ({ id: c.id, kind: c.kind, codeHash: fnv1a(c.code) }));
  const JOBS = Math.max(1, +(arg('jobs') ?? 3)), preOut = {}, cityOut = {};
  let readback = null;
  const on = (k, fn) => withBrowser({ ...opt, port: opt.port + k }, async ({ open, page }) => { await open(''); return fn(page); });
  const jobs = [
    ...SEEDS.map(seed => async k => {
      const r = await on(k, page => page.evaluate(PRE20(codeWithSeed(prebuilt, seed), P)));
      r.day1 = rowR6(r.day1); preOut[seed] = r;
      console.log(`種子 ${seed} 預建城：推進後 ${J(r.post)}；住宅 ${r.hs.length} 棟；抽取 ${r.tickDraws}；垃圾 ${r.pk.garbage}／容量 ${r.pk.garbCap}、局部扣分 ${r.pk.garbFar409} 棟、評分 ${r.sc.score}`);
    }),
    ...CITIES.map(c => async k => {
      const r = await on(k, page => page.evaluate(CITY20(c.code)));
      cityOut[c.id] = r;
      console.log(`${c.kind === 'sample' ? '樣本城' : '造的城'} ${c.id}：住宅 ${r.res.length} 棟；垃圾 ${+r.pk.garbage.toFixed(2)}／容量 ${r.pk.garbCap}、人口 ${r.pk.popT}（${r.san.stat.formal ? '正式清運' : '500 人前'}）、清運區 ${r.san.districts.length}、局部扣分 ${r.pk.garbFar409} 棟、沒路或死路網 ${r.pk.garbUnserved445} 棟、評分 ${r.sc.score}`);
    }),
    async k => {
      readback = await on(k, async page => {
        const out = {};
        for (const seed of SEEDS) {
          const code = prebuilt20(codeWithSeed(prebuilt, seed), KT, vrank).code;
          const x = await page.evaluate(READBACK(code));
          x.measure = measureRows(x.measure);
          out[seed] = { ...x, codeHash: fnv1a(code) };
        }
        return out;
      });
    },
  ];
  await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, async (_, k) => { for (let j; (j = jobs.shift());) await j(k); }));
  for (const seed of SEEDS) lab.prebuilt[seed] = preOut[seed];
  for (const c of CITIES) lab.cities[c.id] = cityOut[c.id];
  lab.readback = readback;
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
// 本線 → 實驗線：本線 C 段＋第 1 天之後匯出的碼（D017、D019、D020 不跑）
if (!D17 && !D19 && !D20) await withBrowser(opt, async ({ open, page }) => {
  await open('');
  for (const seed of SEEDS) {
    const code = civic3d(codeWithSeed(newcity, seed), KT, vrank).codeC;
    const x = await page.evaluate(READBACK(code));
    x.measure = measureRows(x.measure);
    lab.readback[seed] = { ...x, codeHash: fnv1a(code) };
  }
});
lab.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(OUT, J(lab));
console.log(`寫出 ${SET}-lab.json（${lab.seconds}s，實驗線 ${commit.slice(0, 7)} v${version}）`);

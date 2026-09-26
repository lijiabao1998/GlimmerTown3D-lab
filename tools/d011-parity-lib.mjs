// D011 對拍的量法（驗收 3、4）：實驗線頁面與本線 Node 用「同一段原始碼」量，保證比的是同一個量。
// 做法：量法寫成字串；實驗線那邊注入頁面、本線這邊用 new Function 變成函式。兩邊的格子形狀相同（實驗線 tiles[i]＝本線 w.tiles[i]，
// 欄位 t／tree／road／rc／hw／bridge／zone／deco／bld{k,lv,v,age,ref,sz,den,we}），場也相同（COV 各族、POL、POLBASE、POLTREE、LANDBASE、LAND）。
// 施工中不量的：pw／rp／h／wa（執行期欄位；實驗線放電廠、鋪路、拆除後立刻重算帶電道路，本線每天開頭才算）。
// 供電另外量：預建城推進一天之後，推進前就在的住商工每一棟有沒有電（PW_SRC；那一天兩邊都照容量與帶電道路重新分配過）。
// 推進一天的亂數：兩邊都記每一次抽取的呼叫行號（實驗線＝index.html 行號；本線＝src 行號，SITE_MAP 對到實驗線那一行）。
import { decodeLabCode } from '../src/io/labcode.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { stepDay, simCounts } from '../src/sim/day.ts';
import { fieldsOf } from '../src/sim/rules/fields.ts';
import { pickV406 } from '../src/sim/rules/land.ts';
import { d011Ops, prebuiltOps, run3d, PICK_SRC, DEFAULT_GAP } from './d011-ops.mjs';
import { OTHER_INCOME_KEYS, IMPORT_KEYS } from '../src/sim/rules/money.ts';

export { PICK_SRC };

// 一格的投影（16 個整數）
export const PROJ_SRC = `(t=>{const b=t.bld;return [t.t|0,t.tree|0,t.road|0,t.road?(t.rc|0):0,t.hw|0,t.bridge|0,t.zone|0,t.deco|0,
  b?b.k:0,b?(b.ref?1:0):0,b?(b.lv|0):0,b?(b.v|0):0,b?(b.age|0):0,b?(b.sz|0):0,b&&b.den!==undefined?b.den:-1,b&&b.we!==undefined?b.we:-1];})`;
export const PROJ_FIELDS = ['t', 'tree', 'road', 'rc', 'hw', 'bridge', 'zone', 'deco', 'k', 'ref', 'lv', 'v', 'age', 'sz', 'den', 'we'];

// 整張的快照：每格投影（給逐格比對）、格子雜湊、場雜湊、地價髒狀態。
// 場雜湊：覆蓋各族（全 0 的族不算，兩邊族的清單不必一樣）＋ POL、POLBASE、POLTREE＋地價 LANDBASE、LAND（實驗線 53066；施工後的地價框在隔天開頭才重算，
// 所以推進第 1 天之後的快照 snap1 量得到那一框算對沒有）
export const SNAP_SRC = `((tiles,COV,POL,POLBASE,POLTREE,LANDBASE,LAND,landDirty,landBox)=>{
  const P=${PROJ_SRC};let h=0x811c9dc5;const mix=v=>{h^=(v|0);h=Math.imul(h,16777619)>>>0;};
  const proj=[];for(let i=0;i<tiles.length;i++){const p=P(tiles[i]);proj.push(p);for(const v of p)mix(v);}
  const tileHash=h.toString(16);h=0x811c9dc5;
  for(const f of Object.keys(COV).sort()){const a=COV[f];let nz=false;for(let i=0;i<a.length;i++)if(a[i]){nz=true;break;}if(!nz)continue;
    for(let c=0;c<f.length;c++)mix(f.charCodeAt(c));for(let i=0;i<a.length;i++)mix(a[i]);mix(-1);}
  for(const a of [POL,POLBASE,POLTREE,LANDBASE,LAND]){for(let i=0;i<a.length;i++)mix(a[i]);mix(-1);}
  const fieldHash=h.toString(16);
  const lb=landBox?(Array.isArray(landBox)?landBox:[landBox.x0,landBox.y0,landBox.x1,landBox.y1]).join(','):null;
  return {proj,tileHash,fieldHash,land:landDirty?(lb||'full'):'clean'};
})`;

// 有電的住商工棟數（第 1 天那一列的第 22 欄）
export const POWERED_SRC = `(tiles=>{let n=0;for(const t of tiles){const b=t.bld;if(b&&!b.ref&&b.k>=1&&b.k<=3&&b.pw)n++;}return n;})`;
// 每一棟住商工（根格）有沒有電：[格索引, 0|1]，格索引升序
export const PW_SRC = `(tiles=>{const o=[];for(let i=0;i<tiles.length;i++){const b=tiles[i].bld;if(b&&!b.ref&&b.k>=1&&b.k<=3)o.push([i,b.pw?1:0]);}return o;})`;

// 一筆操作前後的差：變了的格（索引＋新投影）
export const DIFF_SRC = `((a,b)=>{const out=[];for(let i=0;i<a.length;i++){const p=a[i],q=b[i];for(let j=0;j<p.length;j++)if(p[j]!==q[j]){out.push([i,q]);break;}}return out;})`;
// 兩張 Uint8Array 有幾格不同（推進第 1 天前後的 LANDBASE：開頭那一框重算改了幾格）
export const LANDDIFF_SRC = `((a,b)=>{let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n;})`;
// 推進一天之後「跟第 2 類系統無關」的部分（預建城用）：格子投影裡住商工（k1–3）那幾欄換成空地的值（生長、升級受幸福與需求影響）、
// 場只取覆蓋各族、POLTREE、LANDBASE、LAND（POL、POLBASE 會被新長的工業蓋印）。地價框在開頭重算、供電在幸福之前分配，這些都在第 2 類系統起作用之前定案
export const INV_SRC = `((tiles,COV,POLTREE,LANDBASE,LAND)=>{
  const P=${PROJ_SRC},E=[0,0,0,0,0,0,-1,-1];let h=0x811c9dc5;const mix=v=>{h^=(v|0);h=Math.imul(h,16777619)>>>0;};
  for(let i=0;i<tiles.length;i++){const p=P(tiles[i]),rci=p[8]>=1&&p[8]<=3;for(let j=0;j<16;j++)mix(rci&&j>=8?E[j-8]:p[j]);}
  const tileInv=h.toString(16);h=0x811c9dc5;
  for(const f of Object.keys(COV).sort()){const a=COV[f];let nz=false;for(let i=0;i<a.length;i++)if(a[i]){nz=true;break;}if(!nz)continue;
    for(let c=0;c<f.length;c++)mix(f.charCodeAt(c));for(let i=0;i<a.length;i++)mix(a[i]);mix(-1);}
  for(const a of [POLTREE,LANDBASE,LAND]){for(let i=0;i<a.length;i++)mix(a[i]);mix(-1);}
  return {tileInv,fieldInv:h.toString(16)};})`;
// 每一棟住宅（根格）的幸福 h：[格索引, h]
export const HS_SRC = `(tiles=>{const o=[];for(let i=0;i<tiles.length;i++){const b=tiles[i].bld;if(b&&!b.ref&&b.k===1)o.push([i,b.h]);}return o;})`;

export const snapOf = new Function(`return ${SNAP_SRC}`)();
export const poweredOf = new Function(`return ${POWERED_SRC}`)();
export const pwOf = new Function(`return ${PW_SRC}`)();
export const diffOf = new Function(`return ${DIFF_SRC}`)();
export const landDiffOf = new Function(`return ${LANDDIFF_SRC}`)();
export const invOf = new Function(`return ${INV_SRC}`)();
export const hsOf = new Function(`return ${HS_SRC}`)();

// 實驗線 tick() 裡本線沒有的亂數抽取（第 2 類系統；行號 index.html @ d23c18d），都在生長（55597–55652）之後，所以生長兩邊逐位相同：
//   55772 起火擲骰：每一格 k≤3、還沒著火的建築抽一次 R()（55766–55776，機率 .0005×lv 起跳）
//   55817 犯罪擲骰：k≤3、還沒犯罪、沒有警察局／派出所覆蓋（55815）、也沒有監獄覆蓋的建築抽一次 R()
//   55850 生病擲骰：住宅 k1、沒生病、沒有醫療覆蓋（回退設定 __noCivicServices495 下 civicHealthAccess495 回 null，只看 COV 的 hospital／ambulance／megahosp／medcamp／clinic）抽一次 R()
// 其他會抽亂數的（55778 火勢蔓延、55829 廢棄、55847 診所治癒、55861 死亡）要先有著火、犯罪、生病的建築，D011 的城在比較區間裡都沒有，
// 災害（55430–55568）回退設定關掉。EXTRA_SRC 用「推進之後的格子與覆蓋」算這三行各抽幾次：本線的格子（推算實驗線應該多抽幾次）、實驗線自己的格子（核對記下的逐行次數）都算。
// 只適用讀檔後的第一天：推進前沒有著火、犯罪、生病的建築（存檔不存 crime／sick；fire 存了，兩張起點碼都是 0），所以符合條件的每一棟都擲了一次；
// 擲中的那一棟推進後帶著 fire／crime／sick，所以這裡不看這三個旗標（預建城種子 7162032 就有一棟住宅第 1 天生病）
export const EXTRA_LINES = { fire: 55772, crime: 55817, disease: 55850 };
export const EXTRA_SRC = `((tiles,COV)=>{const c=(f,i)=>!!(COV[f]&&COV[f][i]>0);let fire=0,crime=0,disease=0;
  for(let i=0;i<tiles.length;i++){const b=tiles[i].bld;if(!b||b.k>3)continue;fire++;
    if(!c('police',i)&&!c('police2',i)&&!c('prison',i))crime++;
    if(b.k===1&&!['hospital','ambulance','megahosp','medcamp','clinic'].some(f=>c(f,i)))disease++;}
  return {fire,crime,disease};})`;
export const labExtraRolls = new Function(`return ${EXTRA_SRC}`)();
// 本線 src 裡抽亂數的每一行 → 實驗線 tick() 對應的那一行（index.html @ d23c18d）：天氣 54965–54975（src/sim/rules/weather.ts 13–23）、
// 生長洗牌 55605／擲骰 55618／變體 55622（growth.ts 31／44／48–49）、升級擲骰 55648／變體 55649（growth.ts 81／83）。src 改了行號這張表要跟著改（對不到就紅）
export const SITE_MAP = { 'weather.ts:13': 54965, 'weather.ts:15': 54967, 'weather.ts:16': 54968, 'weather.ts:17': 54969, 'weather.ts:19': 54971, 'weather.ts:20': 54972, 'weather.ts:23': 54975,
  'growth.ts:31': 55605, 'growth.ts:44': 55618, 'growth.ts:48': 55622, 'growth.ts:49': 55622, 'growth.ts:81': 55648, 'growth.ts:83': 55649 };
// 生長擲骰之前的行（天氣、洗牌）：抽幾次只看推進前的格子與天氣，跟當天的幸福、需求無關
export const PRE_GROWTH_LINES = [54965, 54967, 54968, 54969, 54971, 54972, 54975, 55605];
// 本線記下的呼叫位置 → 實驗線行號的逐行次數；對不到的位置記在 '?檔名:行'（守衛會紅）
export const labSitesOf = sites3d => { const o = {}; for (const [k, v] of Object.entries(sites3d)) { const l = SITE_MAP[k] ?? `?${k}`; o[l] = (o[l] || 0) + v; } return o; };

// 結算探針讀的實驗線 tick() 區域變數（56053 之前，同一層作用域）：收入與維護費的每一項輸入。讀不到的（不在作用域）就不記
export const PROBE_NAMES = ['income', 'upkeep', 'taxR', 'taxC', 'taxI', 'civicMul', 'goodsMul284', 'commerceSalesMul481', 'industrialMarketMul481', 'indSupplyMul', 'fuelTaxMul', 'steelTaxMul',
  'freightTaxMul', 'tourists', 'nightCommerceGold487', 'roadUpkeep', 'upReg', 'eduFee394', 'parks', 'plants', 'fireStations', 'policeStations', 'policeBoxes', 'hospitals', 'clinics', 'schools',
  'goodsImportCost481', 'foodImportCost482', 'gasImportCost482', 'fuelImportCost482', 'steelImportCost482', 'suppliesImportCost482', 'busOpsCost468', 'nightOpsCost487',
  'metroRev', 'metroAds', 'metroCost', 'railOpsCost463', 'transitRev', 'nightTransitRev487', 'farmGold', 'ranchGold', 'procGold', 'ghGold', 'lodgeRev', 'mktGold', 'tradeGold', 'brewGold',
  'techGold', 'dcGold', 'gasGold', 'cookGold', 'bankInt', 'parkingRevenue491', 'shipPortGold', 'shipDailyGold418', 'fuelExportGold418', 'steelExportGold482', 'goodsExportGold481', 'chN',
  // 垃圾（第 2 類，55256–55277）：全城容量池的幸福懲罰 garbPen409（55270–55274）、離垃圾場太遠的住宅數 garbFar409（computeGarbLocal 57697，每棟 −.045）
  'garbage', 'garbCap', 'garbPen409', 'garbFar409', 'garbUnserved445',
  // 糧食（第 2 類，55340–55342、55414–55424）：住宅的幸福再加 clamp((foodSupplyRate482−.5)×.11,−.06,.05)
  'foodCoreNeed482', 'foodSupplyRate482'];
// 探針原始碼：插在實驗線 'if(diff!==3)money+=income-upkeep;'（全檔唯一）前面；只讀不寫模擬狀態。
// 寫成一行（插進去不多出換行）：頁面副本在插入點之後的行號跟原檔一樣，亂數抽取的呼叫堆疊可以直接對 index.html 的行號
export const PROBE_SRC = `if(window.__d011p){const o={};${PROBE_NAMES.map(n => `try{o.${n}=${n};}catch(e){}`).join('')}
  try{o.cityEvent=cityEvent?{i:cityEvent.i,tax:CITY_EVENTS[cityEvent.i].tax}:null;}catch(e){}try{o.pol=pol?JSON.parse(JSON.stringify(pol)):null;}catch(e){}
  try{o.tech=(tech343&&tech343.done)?[...tech343.done]:[];}catch(e){}try{o.spec=spec386||null;}catch(e){}
  try{o.nightCity={ready:!!nightCity487.ready,taxMul:nightCity487.commerce?nightCity487.commerce.taxMul:null};}catch(e){}
  try{o.svcBudget={...svcBudget};o.svcFleet={...svcFleet};}catch(e){}
  try{o.powerUpkeep471=powerUpkeep471();o.waterUpkeep472=waterUpkeep472();o.infraUpkeep475=infraUpkeep475();o.transitDepotUpkeep501=transitDepotUpkeep501();}catch(e){}
  try{o.policyDailyCost504=policyDailyCost504();}catch(e){}try{o.garbRatio=garbDecisionRatio452();}catch(e){}
  try{o.entFactor=tickBld.filter(i=>tiles[i].bld&&!tiles[i].bld.ref&&tiles[i].bld.k<=3).map(i=>enterpriseTaxFactor489(i)).filter(v=>v!==1).length;}catch(e){}
  try{o.moneyBefore=money;o.diff=diff;o.day=day;}catch(e){}
  window.__d011p(o);}`.replace(/\n\s*/g, '');

// 統計（第 2 天以後只量不判）
export const meanSd = xs => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return [m, Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length)]; };

// 實驗線執行期的對帳數字（原文同 tools/lab-extract.mjs 的 MEASURE；本線對應 cityStats）
export const MEASURE_SRC = `(()=>{const N=GV.N(),c={n:N,ter:[0,0,0,0],road:[0,0,0,0,0],zone:[0,0,0,0],trees:0,el:0,rail:0,tram:0,dock:0,abandoned:0};
  const roots=[],refs=new Map();
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const t=GV.tile(x,y);c.ter[t.t]=(c.ter[t.t]||0)+1;
    c.road[t.road?(t.hw?(t.bridge?4:3):(t.bridge?2:1)):0]++;c.zone[t.zone|0]=(c.zone[t.zone|0]||0)+1;
    if(t.tree)c.trees++;if(t.el)c.el++;if(t.rail)c.rail++;if(t.tram)c.tram++;if(t.dock)c.dock++;
    const b=t.bld;if(!b)continue;
    if(b.ref){const key=b.ref[0]+','+b.ref[1];refs.set(key,(refs.get(key)||0)+1);}
    else{roots.push({i:y*N+x,k:b.k,lv:b.lv,age:b.age});if(b.abandoned&&b.k<=3)c.abandoned++;}}
  for(const r of roots){r.size2=1+(refs.get((r.i%N)+','+((r.i/N)|0))||0);}
  c.kinds={};for(const r of roots)c.kinds[r.k]=(c.kinds[r.k]||0)+1;
  c.buildings=roots.length;c.roots=roots;return c;})()`;
// 實驗線的 roots 是物件，本線 cityStats 是陣列：照 lab-extract 的寫法轉成 [i,k,lv,age,size]
export const measureRows = m => ({ ...m, roots: m.roots.map(r => [r.i, r.k, r.lv, r.age, r.size2]) });
// 逐格道路等級分布（決定新住宅密度，D010 起就比）
export const RC_SRC = `(()=>{const N=GV.N(),rc={};for(let y=0;y<N;y++)for(let x=0;x<N;x++){const t=GV.tile(x,y);if(t.road)rc[t.rc||0]=(rc[t.rc||0]||0)+1;}return rc;})()`;

// ---- 本線那一半（對拍工具寫 d011-3d.json、單元守衛在 CI 上重算，兩處共用）----

export const r6 = x => Math.round(x * 1e6) / 1e6;
// 一列＝D010 的 21 欄（TRAJ_FIELDS，同 tools/unit-d010-sim.mjs）＋資金（不取整）＋有電的住商工棟數
export const ROW_FIELDS = ['day', 'pop', 'jobs', 'employed', 'workers', 'happy', 'demR', 'demC', 'demI', 'R', 'R1', 'R2', 'R3', 'C', 'C1', 'C2', 'C3', 'I', 'I1', 'I2', 'I3', 'money', 'powered'];
export function row3d(s) {
  const c = simCounts(s), w = Math.round(s.pop * .6);
  return [...[s.day, s.pop, s.jobs, Math.min(w, s.jobs), w, s.cityHappy, s.dem[1], s.dem[2], s.dem[3], ...c[1], ...c[2], ...c[3]].map(r6), s.money, poweredOf(s.w.tiles)];
}
const layersOf = code => { const S = decodeLabCode(code).save; return { S, lay: k => Uint8Array.from(S.layers[k] ?? '', ch => ch.charCodeAt(0) - 48) }; };
export function opsOf(code) { const { S, lay } = layersOf(code); return d011Ops(S.n, lay('ter'), lay('el'), lay('tre')); }
export function prebuiltOf(code) { const { S, lay } = layersOf(code); return prebuiltOps(S.n, S.bl, lay('rd'), lay('rcl')); }

// 本線一座城的量具：亂數抽取計數（{k:'seed'} 換掉 s.rng 的 R、ri 之後重新包）、拆除確認的時鐘（每筆 gap，預設 10 秒）、快照、一段操作逐筆記
function harness(s) {
  const h = { draws: 0, clock: 0, picks: {}, cap: null };
  // 推進一天時另記每一次抽取的呼叫位置（堆疊裡第一個 src/sim 的檔名:行，跳過亂數本身 lab.ts）
  const site = () => { const m = /src\/sim\/(?:rules\/)?(?!lab\.ts)([\w]+\.ts):(\d+):\d+/.exec(new Error().stack); const k = m ? `${m[1]}:${m[2]}` : '?'; h.cap[k] = (h.cap[k] || 0) + 1; };
  const count = () => { const R0 = s.rng.R, ri0 = s.rng.ri; s.rng.R = () => { h.draws++; if (h.cap) site(); return R0.call(s.rng); }; s.rng.ri = n => { h.draws++; if (h.cap) site(); return ri0.call(s.rng, n); }; };
  count();
  h.snap = () => snapOf(s.w.tiles, s.g.COV, s.g.POL, s.g.POLBASE, s.g.POLTREE, s.g.LANDBASE, s.g.LAND, s.landDirty, s.landBox);
  h.head = (x, money = true) => ({ tileHash: x.tileHash, fieldHash: x.fieldHash, land: x.land, ...(money ? { money: s.money } : {}) });
  h.batch = list => list.map(o => {
    const a = h.snap(), d0 = h.draws, r = run3d(s, o, h.picks, h.clock += o.gap ?? DEFAULT_GAP), b = h.snap();
    if (o.k === 'seed') count();
    return { k: o.k, money: s.money, draws: h.draws - d0, tileHash: b.tileHash, fieldHash: b.fieldHash, land: b.land, changed: diffOf(a.proj, b.proj), ...(o.k === 'pick' ? { found: r.found } : {}) };
  });
  // 推進一天：抽取數與逐位置次數、開頭那一框重算改了幾格 LANDBASE、照本線推進後的格子算實驗線當天多抽幾次（labExtraRolls）
  h.tick = opts => {
    const lb0 = Uint8Array.from(s.g.LANDBASE), d0 = h.draws;
    h.cap = {};
    const rep = stepDay(s, opts), sites = h.cap;
    h.cap = null;
    return { rep, draws: h.draws - d0, sites, land: landDiffOf(lb0, s.g.LANDBASE), extra: labExtraRolls(s.w.tiles, s.g.COV) };
  };
  return h;
}

// 同一份劇本在本線跑一遍：A 段（開跑前）→ 推進一天（snap1）→ B 段 → 存檔碼 → 再逐日推進到經過 days 天（天數照 D010：第 N 天＝推進 N 次之後，那時 s.day＝N＋1）。
// stepOpts 只用在第一次推進（給「代入實驗線乘數」用）
export function parity3d(code, KT, vrank, days, stepOpts = {}) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進劇本起點：' + L.error);
  const s = L.sim, ops = opsOf(code), h = harness(s);
  const out = { snap0: h.head(h.snap()) };
  out.A = h.batch(ops.A);
  const sA = h.snap();
  out.snapA = h.head(sA);
  out.hwyBridge = sA.proj.filter(p => p[2] && p[4] && p[5]).length;   // 路碼 4（快速路橋）的格數
  const t1 = h.tick(stepOpts);
  out.tick1Draws = t1.draws; out.tick1Sites = t1.sites; out.tick1Land = t1.land; out.tick1Extra = t1.extra; out.day1 = row3d(s); out.settle1 = t1.rep.settle;
  out.snap1 = h.head(h.snap(), false);                                   // 第 1 天的結算兩邊不同（第 2 類），資金不在這裡比
  out.B = h.batch(ops.B);
  out.snapB = h.head(h.snap());
  out.codeB = saveCode(s, L.template, L.start);
  out.rows = [];
  for (let d = 2; d <= days; d++) { stepDay(s); out.rows.push(row3d(s)); }
  out.sim = s;
  return out;
}

// 實驗線讀檔的最後一步是視覺遷移（load 67035 → ensureVariety531(true) 66848–66862，T531）：每一棟住商工（根格，格索引順序）的變體 v 用 pickV406 重挑
// （讀的地價是讀檔 rebuildCov 剛算好的；不抽亂數）。本線讀檔（src/sim/day.ts simFromSave）沒有這一步、照存檔的 v，所以帶現成住商工的碼讀進來兩邊的 v 不同
// （新城沒有建築，不受影響）。這是讀檔路徑的差、不是施工規則或推進的差：預建城對拍時本線這邊先照做一次（同一個 pickV406），守衛核對改了幾棟＝實驗線讀檔時改的棟數。回傳改了幾棟
export function variety531(s) {
  const w = s.w, f = fieldsOf(s.g), N = w.N;
  let n = 0;
  for (let i = 0; i < w.tiles.length; i++) {
    const b = w.tiles[i].bld;
    if (!b || b.ref || b.k < 1 || b.k > 3) continue;
    const nv = pickV406(w, f, s.vrank, b.k, b.lv || 1, i % N, (i / N) | 0, b.v | 0);
    if (nv !== (b.v | 0)) { b.v = nv; const cb = s.root.get(i); if (cb) cb.v = nv; n++; }
  }
  return n;
}

// 預建城的拆除劇本（prebuiltOps）＋推進一天：逐筆同 A、B 段；推進後的快照、每一棟住商工有沒有電、抽取數、推進改了哪些格
export function prebuilt3d(code, KT, vrank) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進預建城：' + L.error);
  const s = L.sim, P = prebuiltOf(code), h = harness(s);
  const load = h.head(h.snap()), mig = variety531(s);                    // load＝遷移前（本線讀檔的樣子）
  const out = { load, mig, snap0: h.head(h.snap()) };
  out.ops = h.batch(P.ops);
  const a = h.snap();
  out.snapOps = h.head(a);
  out.pwBefore = pwOf(s.w.tiles).map(r => r[0]);                        // 推進前就在的住商工（根格）
  const t = h.tick();
  const b = h.snap();
  out.tickDraws = t.draws; out.tickSites = t.sites; out.tickLand = t.land; out.tickExtra = t.extra; out.day1 = row3d(s); out.settle = t.rep.settle;
  out.post = h.head(b, false);
  out.postChanged = diffOf(a.proj, b.proj);                              // 推進那一天改了哪些格（屋齡、生長、升級）
  out.inv = invOf(s.w.tiles, s.g.COV, s.g.POLTREE, s.g.LANDBASE, s.g.LAND);
  out.pw = pwOf(s.w.tiles);
  out.hs = hsOf(s.w.tiles);
  out.sim = s;
  return out;
}

// 實驗線探針讀出的那一天 → 本線 stepDay 的 class2（src/sim/day.ts Class2In）：第 2 類乘數、夜間城市、其他收入、城市活動、進口費與運輸營運費
export function class2Of(p) {
  const pick = keys => Object.fromEntries(keys.map(k => [k, p[k] ?? 0]));
  return {
    mul: { pm: p.pol ?? null, goodsMul284: p.goodsMul284, commerceSalesMul481: p.commerceSalesMul481, industrialMarketMul481: p.industrialMarketMul481, indSupplyMul: p.indSupplyMul,
      fuelTaxMul: p.fuelTaxMul, steelTaxMul: p.steelTaxMul, freightTaxMul: p.freightTaxMul, tourists: p.tourists, nightCityReady: !!p.nightCity?.ready, nightCityTaxMul: p.nightCity?.taxMul ?? 1,
      tech: p.tech ?? [], spec: p.spec ?? null },
    nightCommerceGold487: p.nightCommerceGold487 ?? 0,
    other: pick([...OTHER_INCOME_KEYS, 'metroRev', 'metroAds', 'transitRev', 'nightTransitRev487']),
    eventTax: p.cityEvent ? p.cityEvent.tax : null,
    upkeep: { pol: p.pol ?? null, policyDailyCost504: p.policyDailyCost504 ?? 0, powerUpkeep471: p.powerUpkeep471 ?? 0, waterUpkeep472: p.waterUpkeep472 ?? 0, infraUpkeep475: p.infraUpkeep475 ?? 0,
      transitDepotUpkeep501: p.transitDepotUpkeep501 ?? 0, metroCost: p.metroCost ?? 0, railOpsCost463: p.railOpsCost463 ?? 0, svcFleet: p.svcFleet, imports: pick(IMPORT_KEYS),
      busOpsCost468: p.busOpsCost468 ?? 0, nightOpsCost487: p.nightOpsCost487 ?? 0 },
  };
}

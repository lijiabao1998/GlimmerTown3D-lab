// D011 對拍的量法（驗收 3、4）：實驗線頁面與本線 Node 用「同一段原始碼」量，保證比的是同一個量。
// 做法：量法寫成字串；實驗線那邊注入頁面、本線這邊用 new Function 變成函式。兩邊的格子形狀相同（實驗線 tiles[i]＝本線 w.tiles[i]，
// 欄位 t／tree／road／rc／hw／bridge／zone／deco／bld{k,lv,v,age,ref,sz,den,we}），場也相同（COV 各族、POL、POLBASE、POLTREE）。
// 不量的：pw／rp／h／wa（執行期欄位；實驗線放電廠後立刻重算供電，本線每天開頭才算，隔天兩邊一樣，由第 1 天那一列的有電棟數比）。
import { decodeLabCode } from '../src/io/labcode.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { stepDay, simCounts } from '../src/sim/day.ts';
import { d011Ops, run3d } from './d011-ops.mjs';
import { OTHER_INCOME_KEYS, IMPORT_KEYS } from '../src/sim/rules/money.ts';

// 一格的投影（16 個整數）
export const PROJ_SRC = `(t=>{const b=t.bld;return [t.t|0,t.tree|0,t.road|0,t.road?(t.rc|0):0,t.hw|0,t.bridge|0,t.zone|0,t.deco|0,
  b?b.k:0,b?(b.ref?1:0):0,b?(b.lv|0):0,b?(b.v|0):0,b?(b.age|0):0,b?(b.sz|0):0,b&&b.den!==undefined?b.den:-1,b&&b.we!==undefined?b.we:-1];})`;

// 整張的快照：每格投影（給逐格比對）、格子雜湊、場雜湊（全 0 的覆蓋族不算，兩邊族的清單不必一樣）、地價髒狀態
export const SNAP_SRC = `((tiles,COV,POL,POLBASE,POLTREE,landDirty,landBox)=>{
  const P=${PROJ_SRC};let h=0x811c9dc5;const mix=v=>{h^=(v|0);h=Math.imul(h,16777619)>>>0;};
  const proj=[];for(let i=0;i<tiles.length;i++){const p=P(tiles[i]);proj.push(p);for(const v of p)mix(v);}
  const tileHash=h.toString(16);h=0x811c9dc5;
  for(const f of Object.keys(COV).sort()){const a=COV[f];let nz=false;for(let i=0;i<a.length;i++)if(a[i]){nz=true;break;}if(!nz)continue;
    for(let c=0;c<f.length;c++)mix(f.charCodeAt(c));for(let i=0;i<a.length;i++)mix(a[i]);mix(-1);}
  for(const a of [POL,POLBASE,POLTREE]){for(let i=0;i<a.length;i++)mix(a[i]);mix(-1);}
  const fieldHash=h.toString(16);
  const lb=landBox?(Array.isArray(landBox)?landBox:[landBox.x0,landBox.y0,landBox.x1,landBox.y1]).join(','):null;
  return {proj,tileHash,fieldHash,land:landDirty?(lb||'full'):'clean'};
})`;

// B 段的 pick：框裡照格索引順序找第一棟 k 種建築（根格）
export const PICK_SRC = `((tiles,N,rect,k)=>{const [x0,z0,x1,z1]=rect;for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++){const b=tiles[z*N+x].bld;if(b&&!b.ref&&b.k===k)return [x,z];}return null;})`;

// 有電的住商工棟數（第 1 天那一列的第 22 欄）
export const POWERED_SRC = `(tiles=>{let n=0;for(const t of tiles){const b=t.bld;if(b&&!b.ref&&b.k>=1&&b.k<=3&&b.pw)n++;}return n;})`;

// 一筆操作前後的差：變了的格（索引＋新投影）
export const DIFF_SRC = `((a,b)=>{const out=[];for(let i=0;i<a.length;i++){const p=a[i],q=b[i];for(let j=0;j<p.length;j++)if(p[j]!==q[j]){out.push([i,q]);break;}}return out;})`;

export const snapOf = new Function(`return ${SNAP_SRC}`)();
export const pickOf = new Function(`return ${PICK_SRC}`)();
export const poweredOf = new Function(`return ${POWERED_SRC}`)();
export const diffOf = new Function(`return ${DIFF_SRC}`)();

// 結算探針讀的實驗線 tick() 區域變數（56053 之前，同一層作用域）：收入與維護費的每一項輸入。讀不到的（不在作用域）就不記
export const PROBE_NAMES = ['income', 'upkeep', 'taxR', 'taxC', 'taxI', 'civicMul', 'goodsMul284', 'commerceSalesMul481', 'industrialMarketMul481', 'indSupplyMul', 'fuelTaxMul', 'steelTaxMul',
  'freightTaxMul', 'tourists', 'nightCommerceGold487', 'roadUpkeep', 'upReg', 'eduFee394', 'parks', 'plants', 'fireStations', 'policeStations', 'policeBoxes', 'hospitals', 'clinics', 'schools',
  'goodsImportCost481', 'foodImportCost482', 'gasImportCost482', 'fuelImportCost482', 'steelImportCost482', 'suppliesImportCost482', 'busOpsCost468', 'nightOpsCost487',
  'metroRev', 'metroAds', 'metroCost', 'railOpsCost463', 'transitRev', 'nightTransitRev487', 'farmGold', 'ranchGold', 'procGold', 'ghGold', 'lodgeRev', 'mktGold', 'tradeGold', 'brewGold',
  'techGold', 'dcGold', 'gasGold', 'cookGold', 'bankInt', 'parkingRevenue491', 'shipPortGold', 'shipDailyGold418', 'fuelExportGold418', 'steelExportGold482', 'goodsExportGold481', 'chN'];
// 探針原始碼：插在實驗線 'if(diff!==3)money+=income-upkeep;'（全檔唯一）前面；只讀不寫模擬狀態
export const PROBE_SRC = `if(window.__d011p){const o={};${PROBE_NAMES.map(n => `try{o.${n}=${n};}catch(e){}`).join('')}
  try{o.cityEvent=cityEvent?{i:cityEvent.i,tax:CITY_EVENTS[cityEvent.i].tax}:null;}catch(e){}try{o.pol=pol?JSON.parse(JSON.stringify(pol)):null;}catch(e){}
  try{o.tech=(tech343&&tech343.done)?[...tech343.done]:[];}catch(e){}try{o.spec=spec386||null;}catch(e){}
  try{o.nightCity={ready:!!nightCity487.ready,taxMul:nightCity487.commerce?nightCity487.commerce.taxMul:null};}catch(e){}
  try{o.svcBudget={...svcBudget};o.svcFleet={...svcFleet};}catch(e){}
  try{o.powerUpkeep471=powerUpkeep471();o.waterUpkeep472=waterUpkeep472();o.infraUpkeep475=infraUpkeep475();o.transitDepotUpkeep501=transitDepotUpkeep501();}catch(e){}
  try{o.policyDailyCost504=policyDailyCost504();}catch(e){}try{o.garbRatio=garbDecisionRatio452();}catch(e){}
  try{o.entFactor=tickBld.filter(i=>tiles[i].bld&&!tiles[i].bld.ref&&tiles[i].bld.k<=3).map(i=>enterpriseTaxFactor489(i)).filter(v=>v!==1).length;}catch(e){}
  try{o.moneyBefore=money;o.diff=diff;o.day=day;}catch(e){}
  window.__d011p(o);}`;

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
export function opsOf(code) {
  const S = decodeLabCode(code).save, lay = k => Uint8Array.from(S.layers[k] ?? '', ch => ch.charCodeAt(0) - 48);
  return d011Ops(S.n, lay('ter'), lay('el'), lay('tre'));
}

// 同一份劇本在本線跑一遍：A 段（開跑前）→ 推進一天 → B 段 → 存檔碼 → 再逐日推進到經過 days 天（天數照 D010：第 N 天＝推進 N 次之後，那時 s.day＝N＋1）。
// stepOpts 只用在第一次推進（給「代入實驗線乘數」用）
export function parity3d(code, KT, vrank, days, stepOpts = {}) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進劇本起點：' + L.error);
  const s = L.sim, ops = opsOf(code), picks = {};
  let draws = 0; const R0 = s.rng.R, ri0 = s.rng.ri;
  s.rng.R = () => { draws++; return R0.call(s.rng); };
  s.rng.ri = n => { draws++; return ri0.call(s.rng, n); };
  const snap = () => snapOf(s.w.tiles, s.g.COV, s.g.POL, s.g.POLBASE, s.g.POLTREE, s.landDirty, s.landBox);
  const head = x => ({ tileHash: x.tileHash, fieldHash: x.fieldHash, land: x.land, money: s.money });
  let clock = 0;
  const batch = list => list.map(o => {
    const a = snap(), d0 = draws, r = run3d(s, o, picks, clock += 10000), b = snap();
    return { k: o.k, money: s.money, draws: draws - d0, tileHash: b.tileHash, fieldHash: b.fieldHash, land: b.land, changed: diffOf(a.proj, b.proj), ...(o.k === 'pick' ? { found: r.found } : {}) };
  });
  const out = { snap0: head(snap()) };
  out.A = batch(ops.A);
  out.snapA = head(snap());
  const d1 = draws, rep1 = stepDay(s, stepOpts);
  out.tick1Draws = draws - d1; out.day1 = row3d(s); out.settle1 = rep1.settle;
  out.B = batch(ops.B);
  out.snapB = head(snap());
  out.codeB = saveCode(s, L.template, L.start);
  out.rows = [];
  for (let d = 2; d <= days; d++) { stepDay(s); out.rows.push(row3d(s)); }
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

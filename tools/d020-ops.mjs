// D020 對拍的操作劇本與本線那一半（驗收 3、4）：實驗線頁面（tools/d016-parity.mjs --set=d020）和本線（這裡的 prebuilt20／city20）吃同一份劇本與同一批碼，
// 格式與逐筆的做法同 tools/d011-ops.mjs（run3d、頁面裡的 apply）；量法同 tools/d011-parity-lib.mjs（同一段原始碼）。
//   預建城（d011-prebuilt.code.txt 換種子）：錢設 20000；把住商工最東邊那條路往東接長 8 格，在路的北邊蓋一座垃圾場（接路）、在遠離任何路的空地蓋一座（不接路）；
//     再蓋一座復原、蓋一座再拆、蓋在路上、蓋在住宅上（拒絕）→ 推進一天。預建城人口 157（< 500），走舊 T119 分支（500 人前，全容量、離垃圾場道路距離 > 18 扣 .045）。
//     比每一筆（錢、格子、污染場、地價）、推進前就在的每一棟住宅幸福（實驗線只多了糧食那一項）、清運狀態全部（每一格路的距離、來源、分區，設施，各區容量、需求、負載）、垃圾比例、評分。
//   讀進來的城（AI 城 120 天、種子城）與自己造的城（tools/d020-cities.mjs，含人口 500 以上的正式清運）：讀進來推進一天，同上。
// 量法（實驗線頁面、本線同一段原始碼 SAN20_SRC）：清運狀態拿到的原料不同（實驗線讀 SAN_DIST445、SAN_NET452 這些全域；本線讀 s.san），
// 但整理成同一份 JSON 的那一段是同一份字串，所以比的是同一個量。
import { loadCode, saveCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { garbDecisionRatio452 } from '../src/sim/rules/garbage.ts';
import { settleDay, scoreCounts } from '../src/sim/rules/money.ts';
import { fieldsOf } from '../src/sim/rules/fields.ts';
import { residentPopulation488 } from '../src/sim/rules/jobs.ts';
import { harness, invOf, pwOf, hsOf, diffOf, row3d } from './d011-parity-lib.mjs';
import { run3d, DEFAULT_GAP } from './d011-ops.mjs';
import { civvOf } from './d016-ops.mjs';

// 本線這一邊用到的模組函式：預設是 src/ 的原碼；突變測試（tools/unit-d020-parity.mjs）把 src/sim、src/io 複製一份、改掉 garbage.ts 幾處之後，
// 從那一份載入同樣這幾個函式，丟給 lite20／sanOf3d／score3d 跑，看守衛會不會紅
export const CORE = { loadCode, stepDay, garbDecisionRatio452, settleDay, scoreCounts };

// ---- 量法 ----
// 清運狀態整理成一份 JSON：逐格陣列（距離、來源、上線、分區、每棟的分配、局部垃圾係數）取雜湊，其餘（統計、各區、設施、負載）逐項留著。
// X＝{ tiles, dist, src, active, net, allRoots, activeRoots, stat, districts, fac[[root,設施]], rootAlloc[[root,分配]], alloc, garbLocal, g:{garbage,garbCap,garbRatio,garbPen409,far,unserved,warn,penAvg,dec} }
// 沒有限制的數（Infinity：有需求、沒有容量的那一區的負載）記成字串 'Infinity'（JSON 存不了）
export const SAN20_SRC = `(X=>{
  const FN=v=>Number.isFinite(v)?v:String(v),byK=o=>Object.keys(o).map(Number).sort((a,b)=>a-b).map(k=>[k,o[k]]);
  const hash=a=>{let h=0x811c9dc5;for(let i=0;i<a.length;i++){h^=(a[i]|0);h=Math.imul(h,16777619)>>>0;}return h.toString(16);};
  const bits=a=>new Int32Array(a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength));
  const st=X.stat,al=X.alloc,g=X.g;let roads=0;for(let i=0;i<X.tiles.length;i++)if(X.tiles[i].road)roads++;
  const ra=[],rd=[],why={};for(const [root,p] of X.rootAlloc){ra.push(root,p.district,p.road,p.dist,p.src);rd.push(p.demand);why[p.reason]=(why[p.reason]||0)+1;}
  return {roads,
    hash:{dist:hash(X.dist),src:hash(X.src),active:hash(X.active),net:hash(X.net),rootAlloc:hash(ra),rootDemand:hash(bits(Float64Array.from(rd))),garbLocal:hash(bits(Float32Array.from(X.garbLocal)))},
    stat:{formal:st.formal?1:0,totalCap:st.totalCap,activeCap:st.activeCap,effectiveCap:st.effectiveCap,totalFacilities:st.totalFacilities,activeFacilities:st.activeFacilities,offlineFacilities:st.offlineFacilities,
      totalClients:st.totalClients,reachedClients:st.reachedClients,unservedClients:st.unservedClients,longClients:st.longClients,activeByK:byK(st.activeByK)},
    alloc:{prepared:al.prepared?1:0,totalDemand:al.totalDemand,assignedDemand:al.assignedDemand,noRoadDemand:al.noRoadDemand,deadDemand:al.deadDemand,overflow:al.overflow,overloadedDistricts:al.overloadedDistricts,worstDistrict:al.worstDistrict,worstLoad:al.worstLoad},
    g:{garbage:g.garbage,garbCap:g.garbCap,garbRatio:g.garbRatio,garbPen409:g.garbPen409,far:g.far,unserved:g.unserved,warn:g.warn,penAvg:g.penAvg,dec:g.dec},
    districts:X.districts.map(q=>[q.id,q.roads,q.anchor,q.facilities,q.capacity,q.demand,q.spare,q.overflow,FN(q.load),q.clients,byK(q.byK)]),
    fac:X.fac.map(([root,f])=>[root,f.k,f.capacity,f.nominalCapacity,f.online?1:0,f.district]),
    allRoots:[...X.allRoots],activeRoots:[...X.activeRoots],
    alloc452:Object.entries(why).sort((a,b)=>a[0]<b[0]?-1:1)};
})`;
export const san20 = new Function(`return ${SAN20_SRC}`)();
// 每一棟住宅（根格）的 [格索引, 幸福 h, 局部垃圾係數 garbLocal]（格索引升序）
export const RES20_SRC = `((tiles,gl)=>{const o=[];for(let i=0;i<tiles.length;i++){const b=tiles[i].bld;if(b&&!b.ref&&b.k===1)o.push([i,b.h,gl[i]]);}return o;})`;
export const res20 = new Function(`return ${RES20_SRC}`)();
// 評分讀的覆蓋計數（56102–56113）：[消防覆蓋的住商工, 住商工, 學校覆蓋的住宅, 住宅]
export const SCNT_SRC = `((tiles,COV)=>{let fc=0,ft=0,sc=0,st=0;for(let i=0;i<tiles.length;i++){const b=tiles[i].bld;if(!b||b.k>3||b.ref)continue;ft++;
  if(COV.fire[i]>0||(COV.fire2&&COV.fire2[i]>0)||(COV.fireHQ&&COV.fireHQ[i]>0))fc++;if(b.k===1){st++;if(COV.school[i]>0)sc++;}}return [fc,ft,sc,st];})`;
export const scnt20 = new Function(`return ${SCNT_SRC}`)();

// 評分（56098–56122）：本線照 settleDay 算一次（丟掉的資金狀態：沙盒之外的任一組都行，只看 score／cityStar），happy＝這一天住宅幸福的平均
// 實驗線的評分是推進之後的全域 score、cityStar、scoreParts；本線 stepDay 沒把評分放進回報，所以這裡用推進後的 s 與同一組輸入再算一次
export function score3d(s, cityHappy, mods = CORE, jobs = s.jobs) {
  const tickBld = []; s.w.tiles.forEach((t, i) => { if (t.bld) tickBld.push(i); });
  const cnt = mods.scoreCounts(s.w, fieldsOf(s.g), tickBld);
  const rep = mods.settleDay({ money: 0, diff: 1, loan: null, msIdx: 999, bestStar: 5, bailoutDay: 0 },
    { income: 0, upkeep: 0, day: s.day, pop: s.pop, jobs, cityHappy, ...cnt, garbRatio: mods.garbDecisionRatio452(s.san) });
  return { score: rep.score, cityStar: rep.cityStar };
}
// 評分的五項（實驗線 56114–56120；pop<50 不評分）
export function scoreParts(cityHappy, pop, jobs, cnt, ratio) {
  const [fc, ft, sc, st] = cnt;
  return { happy: cityHappy * 40, job: Math.min(jobs / Math.max(1, pop * .6), 1) * 25, fire: ft > 0 ? (fc / ft) * 15 : 15,
    garb: typeof ratio !== 'number' ? 10 : (ratio <= 1 ? 10 : Math.max(0, 10 - (ratio - 1) * 20)), edu: st > 0 ? (sc / st) * 10 : 10 };
}

// 本線一座城此刻的清運狀態（stepDay 之後）
export function sanOf3d(s, mods = CORE) {
  const S = s.san;
  return san20({ tiles: s.w.tiles, dist: S.dist, src: S.src, active: S.active, net: S.net, allRoots: S.allRoots, activeRoots: S.activeRoots, stat: S.stat, districts: S.districts,
    fac: [...S.facilityMap], rootAlloc: [...S.rootAlloc], alloc: S.alloc, garbLocal: S.garbLocal,
    g: { garbage: S.garbage, garbCap: S.garbCap, garbRatio: S.garbRatio, garbPen409: S.garbPen409, far: S.far, unserved: S.unserved, warn: S.warn, penAvg: S.penAvg, dec: mods.garbDecisionRatio452(S) } });
}

// 實驗線讀檔（importCode → load）之後、第一天推進之前，全域 pop 已經被設成住宅人口總和：T510 把 load 包了一層（68519：ok 之後 balancePrepareAuthorities510()），
// 裡面 pop＝Math.round(Σ mobilityBlocks491 的 q.pop)（68447–68448；64188：k1、k127、k33、k105 每一棟 residentPopulation488，讀檔時每棟 pw 都是 true）。
// 第一天的 sewNeed442＝sewerRequired442()＝pop >= 500 讀的就是它（55011），住宅幸福的「高密度污水」（Lv3 以上、沒接污水管 −.04，55164 起第 66 項）跟著它走。
// 本線 simFromSave 的 pop 起頭原本是 0（D010 假設實驗線 load 不動 pop）；D020 對拍抓到後 src 自己設（loadPop488）。這裡照實驗線的算法算出「讀檔時的 pop」，守衛拿它核對 src 設的值
// 讀檔時每棟只有 pw:true（實驗線 66898–66925 蓋建築的欄位；沒有 wa），所以社宅 k127（要 pw 也要 wa）不算，住宅、住宅塔、住宅巨廈算（68507 那個把 wa 也設 true 的迴圈在 QA 治具裡，不是 load 的包裝）
export function importPop3d(s) {
  let p = 0;
  for (const t of s.w.tiles) { const b = t.bld; if (b && !b.ref && (b.k === 1 || b.k === 127 || b.k === 33 || b.k === 105)) p += residentPopulation488(b, () => undefined); }
  return Math.round(p);
}
// 讀檔後、推進前本線的 pop（src 的 simFromSave 設的）跟照實驗線算法算出來的
const loadPops = s => ({ popLoaded: s.pop, popImport: importPop3d(s) });

// ---- 預建城劇本 ----
const doze1 = (x, z, gap) => ({ k: 'rect', tool: 'doze', x0: x, z0: z, x1: x, z1: z, ...(gap !== undefined ? { gap } : {}) });
export function prebuilt20Ops(s) {
  const n = s.w.N, T = s.w.tiles;
  const land = i => T[i].t === 1 || T[i].t === 2, open = i => land(i) && !T[i].road && !T[i].bld && !T[i].ruin && !T[i].crater, free = i => open(i) && !T[i].tree;
  const at = (x, z) => z * n + x, roads = [], homes = [];
  T.forEach((t, i) => { if (t.road) roads.push(i); if (t.bld && !t.bld.ref && t.bld.k === 1) homes.push(i); });
  if (!roads.length || !homes.length) throw new Error('D020 預建城劇本：沒有路或住宅');
  // 最東邊的路格（x 最大、同 x 取格索引小的）；往東接 8 格，同一列（拉線工具：路，支路）
  let xe = -1, ze = -1; for (const i of roads) { const x = i % n; if (x > xe) { xe = x; ze = (i / n) | 0; } }
  const x1 = Math.min(n - 1, xe + 8);
  for (let x = xe + 1; x <= x1; x++) if (!open(at(x, ze))) throw new Error(`D020 預建城劇本：(${x},${ze}) 不能鋪路`);   // 樹可以（鋪路順手清掉，+$2）
  const dumpA = [xe + 4, ze - 1], dumpC = [xe + 6, ze - 1], dumpD = [xe + 2, ze + 1];
  for (const [x, z] of [dumpA, dumpC, dumpD]) if (!open(at(x, z))) throw new Error(`D020 預建城劇本：(${x},${z}) 不是空地`);
  // 不接路的一座：格索引順序從最後幾列往前找，第一格「空地、八鄰沒有路也沒有建築」
  const bare = i => { const x = i % n, z = (i / n) | 0; if (x < 2 || z < 2 || x > n - 3 || z > n - 3) return false; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const j = at(x + dx, z + dz); if (T[j].road || T[j].bld) return false; } return free(i); };
  let lone = -1; for (let i = at(0, n - 12); i < n * n; i++) if (bare(i)) { lone = i; break; }
  if (lone < 0) throw new Error('D020 預建城劇本：找不到離路很遠的空地');
  const dumpB = [lone % n, (lone / n) | 0], home = homes[0], onRoad = [xe + 2, ze];
  const ops = [
    { k: 'money', v: 20000 },
    { k: 'line', tool: 'road', x0: xe + 1, z0: ze, x1, z1: ze },                      // 往東接長：15／格
    { k: 'tap', tool: 'dump', x: dumpA[0], z: dumpA[1] },                              // 接路的一座（k8，ri(3) 抽一次，蓋污染源）
    { k: 'tap', tool: 'dump', x: dumpB[0], z: dumpB[1] },                              // 不接路的一座：離線，小城照樣算容量
    { k: 'tap', tool: 'dump', x: onRoad[0], z: onRoad[1], nop: 1, why: '道路上不能建造' },
    { k: 'tap', tool: 'dump', x: home % n, z: (home / n) | 0, nop: 1, why: '已有建築' },
    { k: 'tap', tool: 'dump', x: dumpC[0], z: dumpC[1] },
    { k: 'undo' },                                                                     // 蓋了再復原：退錢、撤污染源；抽過的亂數不倒回
    { k: 'tap', tool: 'dump', x: dumpD[0], z: dumpD[1] },
    doze1(dumpD[0], dumpD[1]),                                                         // 蓋了再拆：撤污染源
  ];
  return { ops, dumps: [dumpA, dumpB], ext: [xe + 1, ze, x1, ze] };
}

// 預建城：劇本 → 推進一天（跟 tools/d019-ops.mjs prebuilt19 同一個樣子）
export function prebuilt20(code, KT, vrank) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進預建城：' + L.error);
  const s = L.sim, P = prebuilt20Ops(s), h = harness(s);
  const out = { mig: L.restyled, ...loadPops(s), snap0: h.head(h.snap()) };
  out.ops = h.batch(P.ops);
  const a = h.snap();
  out.snapOps = h.head(a);
  out.pwBefore = pwOf(s.w.tiles).map(r => r[0]); out.hsBefore = hsOf(s.w.tiles).map(r => r[0]); out.bestStar0 = s.bestStar;
  const t = h.tick(), b = h.snap();
  out.tickDraws = t.draws; out.tickSites = t.sites; out.tickLand = t.land; out.tickExtra = t.extra; out.day1 = row3d(s); out.settle = t.rep.settle;
  out.post = h.head(b, false); out.postChanged = diffOf(a.proj, b.proj);
  out.inv = invOf(s.w.tiles, s.g.COV, s.g.POLTREE, s.g.LANDBASE, s.g.LAND); out.pw = pwOf(s.w.tiles); out.hs = hsOf(s.w.tiles);
  out.san = sanOf3d(s); out.res = res20(s.w.tiles, s.san.garbLocal); out.scnt = scnt20(s.w.tiles, s.g.COV);
  out.pop = s.pop; out.jobs = s.jobs; out.jobsI = s.jobsI; out.cityHappy = s.cityHappy; out.civv = civvOf(s.w.tiles);
  out.code = saveCode(s, L.template, L.start);
  out.P = P; out.sim = s; out.load = L;
  return out;
}
// 讀進來的城（AI 城 120 天、種子城、自己造的城）：讀進來推進一天
export function city20(code, KT, vrank) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進這座城：' + L.error);
  const s = L.sim, h = harness(s);
  const out = { mig: L.restyled, ...loadPops(s), hsBefore: hsOf(s.w.tiles).map(r => r[0]), bestStar0: s.bestStar };
  const t = h.tick();
  out.settle = t.rep.settle;
  out.tickDraws = t.draws; out.tickSites = t.sites; out.tickLand = t.land;
  out.hs = hsOf(s.w.tiles);
  out.san = sanOf3d(s); out.res = res20(s.w.tiles, s.san.garbLocal); out.scnt = scnt20(s.w.tiles, s.g.COV);
  out.pop = s.pop; out.jobs = s.jobs; out.jobsI = s.jobsI; out.cityHappy = s.cityHappy;
  out.sim = s; out.load = L;
  return out;
}

// 突變測試用的輕量版：載入 → （預建城才有）劇本 → 推進一天，只留比對用得到的量（不記亂數抽取、快照）。mods＝CORE 或突變後那一份
// h0＝實驗線垃圾之前每一棟住宅的幸福 [[格索引, h]]：給了就把它塞進垃圾那一步的入口（守衛加在暫存副本 garbage.ts 上的包裝 globalThis.__d020iso 讀它），
// 這樣垃圾那一步吃的是實驗線自己算的 h（政策、名望、通勤、第一天污水……本線沒搬的幸福項都不用管），出來的 h 直接跟實驗線垃圾之後的 h1 比
// x.happy＝{ pol, rankIdx }：本線讀檔沒還原的政策與名望（存檔的 pol、rk），守衛的暫存副本 day.ts 把它們代進住宅幸福公式（globalThis.__d020happy；原本寫死 pol: null、rankIdx: 0）
export function lite20(mods, KT, vrank, code, ops = null, h0 = null, x = {}) {
  const L = mods.loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進這座城：' + L.error);
  const s = L.sim, pops = loadPops(s);
  if (ops) { const picks = {}; let clock = 0; for (const o of ops) run3d(s, o, picks, clock += o.gap ?? DEFAULT_GAP); }
  const hsBefore = hsOf(s.w.tiles).map(r => r[0]);
  if (h0) globalThis.__d020iso = { h0: new Map(h0) };
  if (x.happy) globalThis.__d020happy = x.happy;
  try { mods.stepDay(s); } finally { delete globalThis.__d020iso; delete globalThis.__d020happy; }
  return { hsBefore, ...pops, san: sanOf3d(s, mods), res: res20(s.w.tiles, s.san.garbLocal), scnt: scnt20(s.w.tiles, s.g.COV), pop: s.pop, jobs: s.jobs, jobsI: s.jobsI, cityHappy: s.cityHappy, sim: s };
}

// 舊樣本（D011、D016、D017、D019 的預建城，實驗線那一半是 D020 之前錄的）探針裡的垃圾欄位＝本線 s.san（D020 起本線自己算垃圾，所以那幾份守衛不再「扣回垃圾」，
// 改成直接比：垃圾量、容量、全城池懲罰、離垃圾場太遠與沒路的棟數、評分用的垃圾比例）。回傳不相等的欄位描述（null＝都相等）
export function garbFieldsOff(q, s, mods = CORE) {
  const S = s.san, want = { garbage: S.garbage, garbCap: S.garbCap, garbPen409: S.garbPen409, garbFar409: S.far, garbUnserved445: S.unserved, garbRatio: mods.garbDecisionRatio452(S) };
  const bad = Object.entries(want).filter(([k, v]) => !Object.is(q[k], v)).map(([k, v]) => `${k} 實驗線 ${q[k]} ≠ 本線 ${v}`);
  return bad.length ? bad.join('，') : null;
}

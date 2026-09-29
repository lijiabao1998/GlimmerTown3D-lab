// D020 Node 守衛：垃圾（驗收 2，及接線）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d020-garbage.json（tools/lab-garbage.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；
//   2. 清運逐格＝實驗線：實驗線原文（T445 清運網、T452 清運區、computeGarbLocal、garbDecisionRatio452、sanitationAt452，
//      它們讀的入住人口 T488、企業職位 T489、事故可用率 T493、常數，和 tick() 55257–55278 那一段原文）在 vm 裡跑，
//      跟本線 src/sim/rules/garbage.ts（garbageDay、garbDecisionRatio452、sanitationAtRoot452）吃同一批隨機小圖：
//      五種處理設施（焚化廠、資源回收廠 2×2 含 ref 格）、貼一段路／貼多段路／不貼路、斷開的路網、沒有設施的路網；
//      住宅（等級、密度、有電沒電、幸福貼著下限）、社宅、住宅塔、巨廈（多格）、工業有電沒電、商業與其他建築；人口 500 上下（含 499、500）；
//      同一張圖連續多次（中間加減路、設施、換電、改人口）：每一格路的距離與來源、上線與否、容量、清運區與每一區的路格數、設施數、容量、需求、餘量、
//      溢出、負載、客戶數、各種設施數；每一座設施的上線與區；每一棟的分派；垃圾量、容量、比例、全城懲罰、城市幸福、太遠／沒清運／偏遠的棟數、評分用的比例；
//      每一棟的幸福（逐位）；住宅、社宅、工業格的 sanitationAt452（建築卡用）——每一步都相等；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一處（正式門檻、容量、多格只看根格、來源、合併路段、選區、沒電的工業、各項扣分、比例上限、斷網、舊式距離的焚化廠）；
//   4. 接線：day.ts 在 55254 的城市幸福之後、55279 的地價之前叫 garbageDay；結算的評分讀 garbDecisionRatio452；沒有垃圾場、500 人以下的預建城
//      每一棟住宅都扣到（全城懲罰＋太遠）；蓋一座接路的垃圾場之後比例、懲罰、太遠的棟數都變少。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as labHelpers from '../src/sim/rules/lab.ts';
import * as jobsMod from '../src/sim/rules/jobs.ts';
import * as G from '../src/sim/rules/garbage.ts';
import { loadCode } from '../src/io/save.ts';
import { codeWithSeed } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { stepDay } from '../src/sim/day.ts';
import { commitOp } from '../src/sim/edit.ts';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
const PIECES = ['clamp', 'POPS', 'JOBSC', 'JOBSI', 'DEN_POP', 'TOWER_MULT', 'TOWER_POP', 'MEGA_POP', 'MEGA_JOBS', 'TOWER_JOBS', 'DUMP_CAP', 'garbage',
  'SAN_FORMAL_POP445', 'SAN_CAP445', 'sanQ445', 'sanActiveRoots445', 'emptySanStat445', 'sanStat445', 'ensureSan445', 'isSanFacility445', 'isSanClient445', 'sanRoadSeeds445',
  'sanAccessRoot445', 'sanitationSourceText445', 'computeSanitation445', 'SAN_NET452', 'sanDistricts452', 'sanAlloc452', 'sanitationLegacy452', 'ensureSan452', 'sanFind452',
  'sanUnion452', 'sanFacilityFrontage452', 'emptySanAlloc452', 'rebuildSanitationDistricts452', 'ensureSanitationDistricts452', 'sanRootDistrictChoice452', 'sanWasteOfRoot452',
  'prepareSanitationLoad452', 'sanWorstDistrict452', 'garbDecisionRatio452', 'sanitationAt452', 'SOCIAL_HOUSING_POP', 'housingBand488', 'residentCapacity488', 'residentEligible488',
  'housingOccupancy488', 'residentPopulation488', 'enterprisePotentialJobs489', 'enterpriseLegacyJobs489', 'enterpriseRootInfo489', 'enterpriseActualJobs489', 'T', 'idx', 'inMap', 'DIRV',
  'computeGarbLocal', 'UP_MAX', 'UP_JOB', 'incidents493', 'assetAvailability493', 'tick 垃圾'];
const KEY = { 'tick 垃圾': 'tick' };

export async function d020Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D020 守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 實驗線那一邊：原文照行號順序在 vm 裡（strict）。樁：window（住房關 __noHousing488，其餘開關都沒開＝實驗線預設的新式清運）、
// 回收政策 pol＝null、貨物與提示、企業沒就緒（enterprise489.ready false、enterpriseRoot489 空＝企業關）、KNAME（只給文字）。
// tick 那一段原文包進函式，回傳它算出的區域變數與評分用的比例（56117 garbDecisionRatio452）
function makeLab(t) {
  const ctx = vm.createContext({});
  const body = PIECES.filter(n => n !== 'tick 垃圾').map(n => t[n]).join('\n');
  vm.runInContext(`'use strict';let N=1,tiles=[];const window={__noHousing488:true};
let pop=0,jobsI=0,pol=null,goods=0,upc342=0,day=1,lastGarbT=-999,happySum=0,happyN=0,cityHappy=.6,tickBld=[],garbLocal=new Float32Array(0);
const enterprise489={ready:false},enterpriseRoot489=new Map(),housing488=null,goodsCap283=()=>0,toast=()=>{},KNAME={},LOGISTICS_META485={};
${body}
function __tick(){\n${t.tick}\nreturn {garbage,garbCap,garbRatio,garbPen409,cityHappy,far:garbFar409,unserved:garbUnserved445,warn:garbWarn445,dec:garbDecisionRatio452()};}
globalThis.__api={
  set:(n,ts,p,ji,ch)=>{N=n;tiles=ts;pop=p;jobsI=ji;cityHappy=ch;garbLocal=new Float32Array(n*n);tickBld=[];for(let i=0;i<n*n;i++)if(ts[i].bld)tickBld.push(i);},
  tick:()=>__tick(),
  dump:()=>({dist:Array.from(SAN_DIST445),src:Array.from(SAN_SRC445),active:Array.from(SAN_ACTIVE445),
    stat:[sanStat445.formal,sanStat445.totalCap,sanStat445.activeCap,sanStat445.effectiveCap,sanStat445.totalFacilities,sanStat445.activeFacilities,JSON.stringify(sanStat445.activeByK)],
    net:Array.from(SAN_NET452),d:sanDistricts452.map(q=>[q.id,q.roads,q.facilities,q.capacity,q.demand,q.spare,q.overflow,q.load,q.clients,JSON.stringify(q.byK)]),
    f:[...sanFacilityMap452.values()].map(f=>[f.root,f.k,f.capacity,f.nominalCapacity,f.online,f.district]),
    a:[sanAlloc452.prepared,sanAlloc452.totalDemand,sanAlloc452.assignedDemand,sanAlloc452.noRoadDemand,sanAlloc452.deadDemand,sanAlloc452.overflow,sanAlloc452.overloadedDistricts,sanAlloc452.worstDistrict,sanAlloc452.worstLoad],
    ra:[...sanRootAlloc452].map(([i,p])=>[i,p.district,p.road,p.dist,p.src,p.demand,p.reason])}),
  at:(x,y)=>{const s=sanitationAt452(x,y);return [s.district,s.capacity,s.demand,s.load,s.reachable,s.dist,s.src,s.reason];},
};`, ctx, { filename: 'lab:garbage' });
  return ctx.__api;
}
// 本線那一邊（garbage.ts；突變時傳型別剝除後在 vm 裡載入的那一份）。day.ts 同樣叫 garbageDay，結算叫 garbDecisionRatio452
const makeMine = (m = G) => {
  let w = null, pop = 0, jobsI = 0, ch = .6, order = [], san = null;
  return {
    set: (n, ts, p, ji, c) => { w = { N: n, tiles: ts }; pop = p; jobsI = ji; ch = c; order = []; for (let i = 0; i < n * n; i++) if (ts[i].bld) order.push(i); },
    tick: () => {
      const r = m.garbageDay(w, order, pop, jobsI, ch, 1); san = r.san;
      return { garbage: r.garbage, garbCap: r.garbCap, garbRatio: r.garbRatio, garbPen409: r.garbPen409, cityHappy: r.cityHappy, far: r.loc.far, unserved: r.loc.unserved, warn: r.loc.warn,
        dec: m.garbDecisionRatio452(san, w, r.garbRatio, 1) };
    },
    dump: () => ({ dist: Array.from(san.dist), src: Array.from(san.src), active: Array.from(san.active),
      stat: [san.formal, san.totalCap, san.activeCap, san.effectiveCap, san.totalFacilities, san.activeFacilities, J(san.activeByK)],
      net: Array.from(san.net), d: san.districts.map(q => [q.id, q.roads, q.facilities, q.capacity, q.demand, q.spare, q.overflow, q.load, q.clients, J(q.byK)]),
      f: [...san.facilities.values()].map(f => [f.root, f.k, f.capacity, f.nominalCapacity, f.online, f.district]),
      a: [san.alloc.prepared, san.alloc.totalDemand, san.alloc.assignedDemand, san.alloc.noRoadDemand, san.alloc.deadDemand, san.alloc.overflow, san.alloc.overloadedDistricts, san.alloc.worstDistrict, san.alloc.worstLoad],
      ra: [...san.rootAlloc].map(([i, p]) => [i, p.district, p.road, p.dist, p.src, p.demand, p.reason]) }),
    at: (x, y) => { let i = y * w.N + x; const b = w.tiles[i].bld; if (b && b.ref) i = b.ref[1] * w.N + b.ref[0]; const s = m.sanitationAtRoot452(san, w, i); return [s.district, s.capacity, s.demand, s.load, s.reachable, s.dist, s.src, s.reason]; },
  };
};

// 隨機小圖。家族：small（500 以下）、formal（500 以上）、edge（剛好 499／500）、multi（多格設施貼多段路）、dead（沒有設施的路網、不貼路的設施）、dense（超載）
const FAMS = ['small', 'formal', 'edge', 'multi', 'dead', 'dense'];
function cases() {
  const out = [], R = mulberry32(20261020), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  for (let m = 0; m < 420; m++) {
    const fam = FAMS[m % FAMS.length], N = m < 12 ? int(3, 6) : int(6, 26);
    const tiles = Array.from({ length: N * N }, () => ({ t: ch(.06) ? 0 : ch(.15) ? 1 : 2, bld: null }));
    const at = (x, y) => tiles[y * N + x];
    for (let s = 0, n = fam === 'dead' ? int(2, 5) : int(1, 6); s < n; s++) {   // 直線路段（有的會互相接上、有的斷開）
      const hz = ch(.5), a = int(0, N - 1), b0 = int(0, N - 1), len = int(2, N);
      for (let q = 0; q < len; q++) { const x = hz ? Math.min(N - 1, b0 + q) : a, y = hz ? a : Math.min(N - 1, b0 + q); at(x, y).road = 1; }
    }
    for (let q = 0, n = int(0, 4); q < n; q++) at(int(0, N - 1), int(0, N - 1)).road = 1;   // 零星的路格
    const free = (x, y, sz) => { for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) { if (x + dx >= N || y + dy >= N) return false; const t = at(x + dx, y + dy); if (t.road || t.bld) return false; } return true; };
    const put = (k, sz, extra, near) => {
      for (let a = 0; a < 40; a++) {
        const x = int(0, N - 1), y = int(0, N - 1);
        if (!free(x, y, sz)) continue;
        if (near !== undefined) { let touch = false; for (let dy = -1; dy <= sz; dy++) for (let dx = -1; dx <= sz; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < N && yy < N && at(xx, yy).road) touch = true; } if (touch !== near) continue; }
        at(x, y).bld = { k, lv: 1, v: 0, age: 0, h: 1, ...(sz > 1 ? { sz } : {}), ...extra };
        for (let dy = 0; dy < sz; dy++) for (let dx = 0; dx < sz; dx++) if (dx || dy) at(x + dx, y + dy).bld = { k, ref: [x, y] };
        return true;
      }
      return false;
    };
    const facK = fam === 'multi' ? [62, 111, 62, 111, 8] : [8, 8, 8, 29, 88, 62, 111];
    const nf = fam === 'dead' ? int(0, 2) : fam === 'dense' ? int(1, 2) : int(0, 5);
    for (let q = 0; q < nf; q++) { const k = pick(facK); put(k, k === 62 || k === 111 ? 2 : 1, { pw: true }, fam === 'dead' ? ch(.2) : ch(.8)); }
    const hv = () => ch(.08) ? .05 : ch(.05) ? 1 : Math.round((.05 + R() * .95) * 1000) / 1000;
    const nb = fam === 'dense' ? Math.floor(N * N * .5) : int(0, Math.floor(N * N * .35));
    for (let q = 0; q < nb; q++) {
      const r = R(), near = ch(.85);
      if (r < .55) put(1, 1, { lv: int(1, 3), ...(ch(.7) ? { den: int(1, 5) } : {}), pw: ch(.85), h: hv(), ...(ch(.03) ? { sick: 1 } : {}) }, near);
      else if (r < .6) put(127, 2, { pw: ch(.8), wa: ch(.6), h: hv() }, near);
      else if (r < .63) put(33, 2, { lv: 3, pw: ch(.8), h: hv() }, near);
      else if (r < .645) put(105, 3, { lv: 3, pw: true, h: hv() }, near);
      else if (r < .8) put(3, 1, { lv: int(1, 3), pw: ch(.7) }, near);
      else if (r < .92) put(2, 1, { lv: int(1, 3), pw: ch(.8) }, near);
      else put(pick([4, 5, 7, 12, 34, 106]), 1, { pw: true }, near);
    }
    const pop = fam === 'small' ? int(0, 499) : fam === 'formal' ? int(500, 3000) : fam === 'edge' ? pick([499, 500, 499, 500, 501, 498]) : fam === 'dense' ? int(600, 5000) : int(0, 1500);
    const steps = [];
    for (let s = 0, n = int(2, 4); s < n; s++) steps.push({ edit: s ? int(1, 4) : 0, pop: s && ch(.4) ? (ch(.5) ? pick([499, 500]) : int(0, 2000)) : null, jobsI: int(0, 400), happy: Math.round(R() * 1000) / 1000 });
    out.push({ fam, N, tiles, pop, steps });
  }
  return out;
}
// 兩邊各一份格子（深拷貝），每一步先照同一串亂數改圖（加減路、加減垃圾場、換電），再各自算
function runCase(c, lab, mine, seed) {
  const R = mulberry32(seed), int = (a, b) => a + Math.floor(R() * (b - a + 1));
  const A = JSON.parse(J(c.tiles)), B = JSON.parse(J(c.tiles)), N = c.N;
  let pop = c.pop;
  const recs = [];
  for (const st of c.steps) {
    for (let e = 0; e < st.edit; e++) {
      const i = int(0, N * N - 1), kind = R();
      for (const T of [A, B]) {
        if (kind < .45) { if (!T[i].bld) T[i].road = T[i].road ? 0 : 1; }
        else if (kind < .7) { if (!T[i].bld && !T[i].road) T[i].bld = { k: 8, lv: 1, v: 0, age: 0, pw: true, h: 1 }; else if (T[i].bld && T[i].bld.k === 8) T[i].bld = null; }
        else for (let q = 0; q < N * N; q++) { const t = T[(i + q) % (N * N)]; if (t.bld && !t.bld.ref && (t.bld.k === 1 || t.bld.k === 3 || t.bld.k === 127)) { t.bld.pw = !t.bld.pw; break; } }
      }
    }
    if (st.pop !== null) pop = st.pop;
    lab.set(N, A, pop, st.jobsI, st.happy); mine.set(N, B, pop, st.jobsI, st.happy);
    const a = lab.tick(), b = mine.tick(), da = lab.dump(), db = mine.dump();
    const pa = [], pb = [];
    for (let i = 0; i < N * N; i++) { const t = A[i]; if (t.bld && !t.road && [1, 3, 127, 33, 105, 2].includes(t.bld.k)) { pa.push(lab.at(i % N, (i / N) | 0)); pb.push(mine.at(i % N, (i / N) | 0)); } }
    recs.push({ a: J(a), b: J(b), da: J(da), db: J(db), ha: J(A.map(t => t.bld && !t.bld.ref ? t.bld.h ?? null : null)), hb: J(B.map(t => t.bld && !t.bld.ref ? t.bld.h ?? null : null)), pa: J(pa), pb: J(pb), r: a, d: da });
  }
  return recs;
}

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d020-garbage.json')), T = { ...S.text };
  for (const [k, v] of Object.entries(KEY)) T[k] = S.text[v];

  // ---- 1. 出處 ----
  {
    const bad = [];
    if (S.source?.commit !== PINNED) bad.push(`commit ${S.source?.commit}`);
    const got = (S.pieces ?? []).map(p => p.name);
    if (J(got) !== J(PIECES)) bad.push(`段落 ${got.join('、')}`);
    for (const p of S.pieces ?? []) {
      const txt = S.text[KEY[p.name] ?? p.name];
      if (typeof txt !== 'string' || crypto.createHash('sha256').update(txt).digest('hex') !== p.sha) bad.push(`${p.name} 的 sha256`);
    }
    const labCap = vm.runInNewContext(`${T.DUMP_CAP}\n${T.SAN_FORMAL_POP445}\n${T.SAN_CAP445}\n({cap:SAN_CAP445,f:SAN_FORMAL_POP445,w:SAN_WARN_DIST445,l:SAN_LONG_DIST445,i:SAN_INF445})`);
    if (J(labCap.cap) !== J(G.SAN_CAP445) || labCap.f !== G.SAN_FORMAL_POP445 || labCap.w !== G.SAN_WARN_DIST445 || labCap.l !== G.SAN_LONG_DIST445 || labCap.i !== G.SAN_INF445) bad.push(`常數：實驗線 ${J(labCap)}`);
    log(!bad.length, `D020 垃圾原文：實驗線 ${PINNED.slice(0, 7)} 的 ${PIECES.length} 段（清運網 37977–38028、清運區 38047–38101、computeGarbLocal 57697–57722、tick 55257–55278 等）sha256 逐段＝錨點記錄；容量表、正式門檻 500、距離 12／18 ＝本線`,
      bad.join('；') || `容量 ${J(G.SAN_CAP445)}`);
  }

  // ---- 2. 清運逐格＝實驗線 ----
  const C = cases();
  const compare = (lab, mine, stopAtFirst = false) => {
    const st = { steps: 0, diffs: 0, first: '', formal: 0, small: 0, districts: 0, multiRoad: 0, dead: 0, over: 0, pen: 0, far: 0, unserved: 0, hHit: 0, probes: 0, offline: 0 };
    for (let m = 0; m < C.length; m++) {
      const recs = runCase(C[m], lab, mine, 5000 + m);
      for (const q of recs) {
        st.steps++;
        const r = q.r, d = q.d;
        if (d.stat[0]) st.formal++; else st.small++;
        st.districts += d.d.length; st.over += d.a[6]; if (d.a[4] > 0) st.dead++; if (r.garbPen409 > 0) st.pen++; st.far += r.far; st.unserved += r.unserved; st.probes += JSON.parse(q.pa).length;
        st.offline += d.f.filter(f => !f[4]).length;
        if (d.d.some(x => x[2] > 0 && d.f.filter(f => f[5] === x[0]).length < x[2])) st.multiRoad++;
        if (q.ha !== q.hb || q.a !== q.b || q.da !== q.db || q.pa !== q.pb) {
          st.diffs++;
          if (!st.first) {
            const what = q.a !== q.b ? `結果 ${q.a} ≠ ${q.b}` : q.da !== q.db ? (() => { const x = JSON.parse(q.da), y = JSON.parse(q.db); return '狀態 ' + Object.keys(x).filter(k => J(x[k]) !== J(y[k])).join('、'); })() : q.ha !== q.hb ? '逐棟幸福' : 'sanitationAt452';
            st.first = `第 ${m} 張（${C[m].fam}，N=${C[m].N}）第 ${st.steps} 步：${what}`;
          }
          if (stopAtFirst) return st;
        }
      }
    }
    return st;
  };
  const base = compare(makeLab(T), makeMine());
  log(base.diffs === 0 && base.formal > 50 && base.small > 50 && base.over > 0 && base.dead > 0 && base.pen > 0 && base.offline > 0,
    `D020 驗收 2：清運逐格＝實驗線——實驗線原文在 vm 裡跟本線 garbage.ts 吃 ${C.length} 張隨機小圖 ${base.steps} 步（五種處理設施含 2×2、貼一段／多段／不貼路、斷開與沒有設施的路網、住宅社宅住宅塔巨廈工業、人口 500 上下、中途加減路與垃圾場、換電、改人口）：每一格路的距離與來源、上線、容量、清運區與負載、每一棟的分派、垃圾量與比例、懲罰、評分用的比例、逐棟幸福、sanitationAt452 每一步都相等`,
    base.first || `正式清運 ${base.formal} 步／小城 ${base.small} 步；清運區 ${base.districts}；超載區 ${base.over}；有斷網需求 ${base.dead} 步；小城全城懲罰 ${base.pen} 步；太遠 ${base.far}、沒清運 ${base.unserved} 棟次；不上線的設施 ${base.offline}；sanitationAt452 抽查 ${base.probes} 格`);

  // ---- 3. 注入錯誤要紅 ----
  {
    const LAB_MUT = [
      ['正式門檻 500→499', 'SAN_FORMAL_POP445', 'SAN_FORMAL_POP445=500', 'SAN_FORMAL_POP445=499'],
      ['垃圾場容量 40→41', 'DUMP_CAP', 'const DUMP_CAP=40;', 'const DUMP_CAP=41;'],
      ['焚化廠容量 100→99', 'SAN_CAP445', '62:100', '62:99'],
      ['多格設施只看根格', 'sanRoadSeeds445', 'sz=Math.max(1,b.sz||1)', 'sz=1'],
      ['BFS 不傳來源', 'computeSanitation445', 'SAN_DIST445[j]=nd;SAN_SRC445[j]=src;', 'SAN_DIST445[j]=nd;'],
      ['設施不合併路段', 'rebuildSanitationDistricts452', 'for(let k=1;k<f.length;k++)sanUnion452(f[0],f[k]);', ''],
      ['同距離取區號大', 'sanRootDistrictChoice452', 'a.dist-b.dist||a.district-b.district', 'a.dist-b.dist||b.district-a.district'],
      // 「沒電的工業也算垃圾」（b.k===3&&b.pw → b.k===3）在實驗線是等價突變：enterpriseLegacyJobs489（39527）沒電再回 0（反過來改 39527 也被這裡的 b.pw 擋住）；
      // 本線只查一次，本線那一邊的突變抓得到
      ['住宅垃圾 .05→.06', 'sanWasteOfRoot452', 'residentPopulation488(rootIdx,b)*.05', 'residentPopulation488(rootIdx,b)*.06'],
      ['超載扣分 .15→.14', 'computeGarbLocal', 'capPen=q.load>1?(q.load-1)*.15:0', 'capPen=q.load>1?(q.load-1)*.14:0'],
      ['舊式太遠 18→17', 'computeGarbLocal', 'if(bd>18)', 'if(bd>17)'],
      ['沒清運 −.06→−.05', 'computeGarbLocal', 'b.h=clamp(b.h-.06,.05,1);unserved445++;continue;', 'b.h=clamp(b.h-.05,.05,1);unserved445++;continue;'],
      ['舊式距離的焚化廠只看根格', 'computeGarbLocal', '(!b.ref&&b.k===8)||b.k===62', '!b.ref&&(b.k===8||b.k===62)'],
      ['小城懲罰 .15→.14', 'tick', 'const pen=(garbRatio-1)*.15;', 'const pen=(garbRatio-1)*.14;'],
      ['比例上限 2→3', 'tick', 'clamp(garbage/garbCap,0,2):2', 'clamp(garbage/garbCap,0,3):2'],
      ['斷網不當 2', 'garbDecisionRatio452', 'return Math.max(garbRatio,2);', 'return garbRatio;'],
    ];
    const MINE_MUT = [
      ['正式門檻 ≥→>', 'pop >= SAN_FORMAL_POP445', 'pop > SAN_FORMAL_POP445'],
      ['垃圾場容量 40→41', 'export const DUMP_CAP = 40;', 'export const DUMP_CAP = 41;'],
      ['焚化廠容量 100→99', '62: 100', '62: 99'],
      ['多格設施只看根格', 'sz = Math.max(1, b.sz || 1);', 'sz = 1;'],
      ['BFS 不傳來源', 'dist[j] = nd; src[j] = s0;', 'dist[j] = nd;'],
      ['設施不合併路段', 'for (let k = 1; k < f.length; k++) union(f[0], f[k]);', ''],
      ['同距離取區號大', 'a.dist - b.dist || a.district - b.district', 'a.dist - b.dist || b.district - a.district'],
      ['沒電的工業也算垃圾', 'b.k === 3 && b.pw', 'b.k === 3'],
      ['住宅垃圾 .05→.06', 'residentPopulation488(b, () => undefined) * .05', 'residentPopulation488(b, () => undefined) * .06'],
      ['超載扣分 .15→.14', '(q.load - 1) * .15 : 0', '(q.load - 1) * .14 : 0'],
      ['舊式太遠 18→17', 'garbLegacyAt(w, dist, i) > 18', 'garbLegacyAt(w, dist, i) > 17'],
      ['沒清運 −.06→−.05', "b.h = clamp((b.h as number) - .06, .05, 1); unserved++;", "b.h = clamp((b.h as number) - .05, .05, 1); unserved++;"],
      ['舊式距離的焚化廠只看根格', '(!b.ref && b.k === 8) || b.k === 62', '!b.ref && (b.k === 8 || b.k === 62)'],
      ['小城懲罰 .15→.14', 'const pen = (garbRatio - 1) * .15;', 'const pen = (garbRatio - 1) * .14;'],
      ['比例上限 2→3', 'clamp(garbage / garbCap, 0, 2) : 2', 'clamp(garbage / garbCap, 0, 3) : 2'],
      ['斷網不當 2', 'if (s.formal && s.alloc.deadDemand > 0) return Math.max(garbRatio, 2);', ''],
      ['清運區照 union-find 根編號', 'const r = find(i); let d = rootToDist.get(r);', 'const r = find(i); let d = rootToDist.get(r); if (d === undefined && s.districts.length) { d = s.districts.length; }'],
    ];
    const missed = [];
    for (const [name, key, from, to] of LAB_MUT) {
      const t2 = { ...T };
      if (t2[key].split(from).length !== 2) { missed.push(`實驗線「${name}」錨點不唯一（${t2[key].split(from).length - 1}）`); continue; }
      t2[key] = t2[key].replace(from, to);
      if (!compare(makeLab(t2), makeMine(), true).diffs) missed.push(`實驗線「${name}」`);
    }
    const src = read('src/sim/rules/garbage.ts');
    const load = s => { const js = stripTypeScriptTypes(s).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''); const ctx = vm.createContext({ ...labHelpers, ...jobsMod });
      vm.runInContext(js + '\nglobalThis.__m={garbageDay,garbDecisionRatio452,sanitationAtRoot452};', ctx); return ctx.__m; };
    const baseOk = !compare(makeLab(T), makeMine(load(src)), true).diffs;
    for (const [name, from, to] of MINE_MUT) {
      if (src.split(from).length !== 2) { missed.push(`本線「${name}」錨點不唯一（${src.split(from).length - 1}）`); continue; }
      let M; try { M = load(src.replace(from, to)); } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      let d; try { d = compare(makeLab(T), makeMine(M), true).diffs; } catch { d = 1; }
      if (!d) missed.push(`本線「${name}」`);
    }
    log(baseOk && !missed.length, `D020 驗收 2：注入錯誤要紅——實驗線原文 ${LAB_MUT.length} 個、本線原碼 ${MINE_MUT.length} 個（正式門檻、容量、多格只看根格、來源、合併路段、區號、選區、沒電的工業、各項扣分、比例上限、斷網、舊式距離的焚化廠）都比出差異（沒改的本線原碼在 vm 裡載入先核過相等）`,
      missed.join('、') || (baseOk ? '全紅' : 'vm 載入的本線原碼跟 import 的不一樣'));
  }

  // ---- 4. 接線 ----
  {
    const bad = [], day = read('src/sim/day.ts');
    const iH = day.indexOf('let cityHappy = happyN ? happySum / happyN : .6;'), iG = day.indexOf('garbageDay(w, tickBld, pop, jobsI, cityHappy, recycleMul)'), iL = day.indexOf('s.landDirty = true; s.landBox = null;');
    if (!(iH > 0 && iG > iH && iL > iG)) bad.push('day.ts 要在 55254 的城市幸福之後、55279 的地價之前叫 garbageDay');
    if (!day.includes('garbDecisionRatio452(san, w, garbRatio, recycleMul)') || !day.includes('garbRatio: garbScoreRatio')) bad.push('結算的評分要讀 garbDecisionRatio452');
    if (day.split('garbageDay(').length !== 2) bad.push('garbageDay 一天只叫一次');
    // 預建城（沒有垃圾場、500 人以下）：推進一天，每一棟住宅都被扣到；蓋一座接路的垃圾場再推進，比例、懲罰、太遠的棟數都變少
    const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
    const pre = codeWithSeed(read('src/content/samples/d011-prebuilt.code.txt').trim(), 5162026);
    const s1 = loadCode(pre, KT, vrank).sim, s2 = loadCode(pre, KT, vrank).sim;
    const homes = s1.w.tiles.filter(t => t.bld && t.bld.k === 1).length;   // 推進前就在的住宅（當天新長的在垃圾之後才長）
    const r1 = stepDay(s1);
    if (!(r1.garb.cap === 0 && r1.garb.ratio === 2 && r1.garb.pen > 0 && r1.garb.far === homes && !r1.garb.formal)) bad.push(`沒有垃圾場的預建城：${J(r1.garb)}（住宅 ${homes} 棟）`);
    // 在一條路旁的空地放垃圾場（找第一格：陸地、沒路沒建築、四鄰有路）
    const N = s2.w.N; let spot = -1;
    for (let i = 0; i < N * N && spot < 0; i++) { const t = s2.w.tiles[i], x = i % N, y = (i / N) | 0; if (t.road || t.bld || !(t.t === 1 || t.t === 2)) continue; if ([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => s2.w.tiles[(y + dy) * N + x + dx]?.road && x + dx >= 0 && x + dx < N)) spot = i; }
    s2.money = 1e6;
    const res = commitOp(s2, { k: 'tap', tool: 'dump', x0: spot % N, z0: (spot / N) | 0, x1: spot % N, z1: (spot / N) | 0 }, 0);
    const r2 = stepDay(s2);
    if (!(res.ok && r2.garb.cap === 40 && r2.garb.ratio < r1.garb.ratio && r2.garb.pen < r1.garb.pen && r2.garb.far < r1.garb.far)) bad.push(`蓋了垃圾場（${res.ok ? '成功' : res.reason}）之後：${J(r2.garb)}`);
    if (!(r2.cityHappy > r1.cityHappy)) bad.push(`蓋了垃圾場城市幸福沒有變高 ${r1.cityHappy} → ${r2.cityHappy}`);
    log(!bad.length, 'D020 接線：day.ts 在城市幸福（55254）之後、地價（55279）之前叫 garbageDay 一次，結算的評分讀 garbDecisionRatio452；沒有垃圾場的預建城（500 人以下）比例 2、每一棟住宅都扣全城懲罰與太遠；蓋一座貼路的垃圾場（$300）之後比例、懲罰、太遠的棟數都變少，城市幸福變高',
      bad.join('；') || `沒有垃圾場：垃圾 ${r1.garb.amount.toFixed(2)}／容量 0、懲罰 ${r1.garb.pen}、太遠 ${r1.garb.far}／${homes} 棟、幸福 ${r1.cityHappy.toFixed(4)}；蓋了之後：比例 ${r2.garb.ratio.toFixed(3)}、懲罰 ${r2.garb.pen.toFixed(4)}、太遠 ${r2.garb.far} 棟、幸福 ${r2.cityHappy.toFixed(4)}`);
  }
}

// D032 Node 守衛：政策與預算（K）——目錄、預設物件、冷卻與套用、稅率與預算按鈕、購買力的稅率項、災害保險、緊急物資儲備、回收乘數、讀檔逐項＝實驗線原文（驗收 1、2 的公式半邊，含突變）。由 tools/unit.mjs 呼叫。
//   1. 樣本的出處：src/content/samples/d032-policy.json（tools/lab-policy.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；目錄 29 條、policy.ts 沒有 three／DOM／亂數／現實時間／外部網址；接線要靠的事實（存檔欄位、歸零、火燒呼叫理賠、兩個按鈕的一格）在原文裡核對過；
//   2. 逐項＝實驗線：實驗線原文在 Node `vm` 裡（玩家按鈕的路徑：policyApply504 在 __noPolicy504 下轉給 mayorPolicyApply470A），跟本線 src/sim/rules/policy.ts／economy.ts 吃同一批輸入——
//      目錄與預設物件逐欄（含欄位順序）；補欄位；冷卻（含不認得的鍵）；套用：隨機起始物件（沒有／缺欄／多欄／已開／怪值）、隨機最後套用日、29 個鍵＋不認得的鍵（含 __proto__、constructor）、稅率值與開關值的各種型別、冷卻邊界——
//      每一步回傳值、物件逐欄、最後套用的日子、副作用（教育場重算、清運區、電力）逐位相等，傳進來的物件不被動到；實驗線多標的旗標（交通營運快取、水循環、韌性）只有那 10 個開關才有、名字照記錄；
//      稅率按鈕與服務預算按鈕隨機序列；購買力（稅率 0.5–2、0、缺、NaN）、災害保險理賠（每戶 +35 逐次加、提示字與同一天一次）、緊急物資儲備四處、回收乘數逐位相等；讀檔：pol 的各種形狀；法規日費表＝money.ts 的 upRegOf；
//   3. 注入錯誤要紅：實驗線原文、本線原碼各改一批（冷卻的比較與預設、取整的倍數、夾限、同值不動、每個副作用、預設值、目錄裡每一條的冷卻與種類與名字、預算的 toFixed 與夾限、購買力的係數、每個小消費者的係數……），
//      每個突變指定「哪一項比對要紅」、只跑那一項：沒紅＝那一項比對不管用。沒改的先核過全等。
//   接線、存檔、實驗線頁面實跑：見 tools/unit-d032-live.mjs。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as PO from '../src/sim/rules/policy.ts';
import * as EC from '../src/sim/rules/economy.ts';
import { upRegOf } from '../src/sim/rules/money.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const KEY = {
  clamp: 'clamp', polDecl: 'pol', purchasingPower481: 'purchasingPower481', catalog: '政策目錄 MAYOR_POLICY_CATALOG470A', ensure: 'mayorEnsurePolicy470A', cooldown: 'mayorPolicyCooldownReady470A', apply: 'mayorPolicyApply470A',
  policyApply504: 'policyApply504', polStep: '稅率按鈕 polStep', setSvcBudget: 'setSvcBudget', budStep: '預算按鈕 budStep', insPayout: 'insPayout', insBurn: '火燒毀呼叫 insPayout', recycleMul: '回收乘數 recycleMul452',
  indSub: '工業補貼 legacyI481', stockFood: '緊急儲備：糧食出口', stockGas: '緊急儲備：天然氣出口', stockGoods: '緊急儲備：商品儲備', stockFuel: '緊急儲備：燃料出口', saveField: '存檔的 pol', loadPol: '讀檔的 pol',
  loadReset: '讀檔先把 pol 歸零', newWorldReset: '新圖歸零', eduStatic: 'eduStaticAt',
};   // text 的鍵 → 樣本 pieces 的名字（照樣本裡的順序）
// 實驗線按下去多標的旗標（交通營運快取、水循環、韌性——這三個系統本線沒有，旗標不搬）：鍵 → 旗標名（排序後）。守衛核對實驗線原文仍是這個樣子；
// 10 個開關有旗標，其中 emergencyStockpile492 本線另有消費者（出口留存）所以介面給開，其餘 9 個整個沒有消費者（介面不給開、存讀照舊、日費照付）；免費公交沒有旗標但也沒有消費者（要公車站，本線沒有）
export const LAB_ONLY = {
  integratedTransit: ['mobility491', 'rail463'], freeTransit: ['mobility491', 'rail463'], completeStreets: ['mobility491', 'rail463'], parkingManagement: ['mobility491', 'rail463'],
  waterConserve: ['water472'], reclaimPriority: ['water472'], industrialPretreat: ['water472'], spongeCity: ['water472'],
  criticalReserve492: ['power471', 'resilience492'], emergencyStockpile492: ['resilience492'],
};

export async function d032Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D032 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

const plain = o => JSON.parse(J(o, (k, v) => (v === undefined ? '__undefined' : Number.isNaN(v) ? '__NaN' : v === Infinity ? '__Inf' : v === -Infinity ? '__-Inf' : v)));   // 跨 realm 比較用
const clone = o => (o === null ? null : JSON.parse(J(o)));   // 輸入只含 JSON 可表示的值（NaN 等只出現在按鍵的值，不在狀態裡）
const isErr = r => typeof r === 'string';

// ---- 實驗線那一邊：原文在 vm 裡 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';
const window={__noPolicy504:true};let pol=null,day=1,mayorPolicyLast470A={},mayorPolicyHistory470A=[],mayorHistory470=[],mayorSnapshotState470=null,mayorPolicyRollback470B=false,railOpsDirty463=false,mobility491Dirty=false,sanDirty445=false;
let svcBudget={police:1,fire:1,health:1,edu:1},money=0,insToastDay=-1;const calls=[],toasts=[];
const rebuildCov=()=>calls.push('rebuildCov'),markPowerDirty450=()=>calls.push('power450'),markPowerDirty471=()=>calls.push('power471'),markWaterCycleDirty472=()=>calls.push('water472'),markResilienceDirty492=()=>calls.push('resilience492');
const mayorDecisionLocked470B=()=>false,mayorSafe470=f=>f(),mayorBuildSnapshot470=()=>null,mayorStartPolicyTrial470B=()=>calls.push('trial'),toast=(m,c)=>toasts.push(m);
${T.clamp}
${T.catalog}
${T.ensure}
${T.cooldown}
${T.apply}
const __mayorPolicyApply470A503=mayorPolicyApply470A;
${T.policyApply504}
${T.setSvcBudget}
${T.insPayout}
${T.purchasingPower481}
globalThis.__catalog=()=>MAYOR_POLICY_CATALOG470A;
globalThis.__ensure=(p)=>{pol=p;mayorEnsurePolicy470A();return pol;};
globalThis.__cool=(last,d,k)=>{mayorPolicyLast470A=last;day=d;return mayorPolicyCooldownReady470A(k);};
globalThis.__press=(p0,last,d,k,v)=>{pol=p0;mayorPolicyLast470A=last;day=d;calls.length=0;sanDirty445=false;railOpsDirty463=false;mobility491Dirty=false;const r=policyApply504(k,v,{source:'player',reason:'玩家在市政統計面板調整'});
  if(railOpsDirty463)calls.push('rail463');if(mobility491Dirty)calls.push('mobility491');
  return {r,pol,last:mayorPolicyLast470A,coverage:calls.includes('rebuildCov'),sanitation:sanDirty445,power:calls.includes('power450'),trial:calls.includes('trial'),others:calls.filter(c=>!['rebuildCov','power450','trial'].includes(c)).sort()};};
globalThis.__step=(cur,dd,k)=>{const pol={[k]:cur};const d=dd;
${T.polStep.split('\n')[1].trim()}
return next;};
globalThis.__budget=(b,cat,delta)=>{svcBudget={...b};calls.length=0;const r=setSvcBudget(cat,delta);return {b:{...svcBudget},same:r===svcBudget,coverage:calls.includes('rebuildCov')};};
globalThis.__ins=(p,m0,d,n)=>{pol=p;money=m0;day=d;insToastDay=-1;toasts.length=0;for(let i=0;i<n;i++)insPayout(i,i);return {money,toasts:[...toasts]};};
globalThis.__pp=(labor,wealth,happy,cost,taxR)=>purchasingPower481(labor,wealth,happy,cost,taxR);
globalThis.__expr=(code,vars)=>{const f=new Function(...Object.keys(vars),'return ('+code+');');return f(...Object.values(vars));};`, ctx, { filename: 'lab:policy' });
  return { catalog: () => ctx.__catalog(), ensure: p => ctx.__ensure(p), cool: (last, d, k) => ctx.__cool(last, d, k), press: (p, last, d, k, v) => ctx.__press(p, last, d, k, v), step: (cur, d, k) => ctx.__step(cur, d, k),
    budget: (b, c, d) => ctx.__budget(b, c, d), ins: (p, m, d, n) => ctx.__ins(p, m, d, n), pp: (...a) => ctx.__pp(...a), expr: (c, v) => ctx.__expr(c, v) };
}
// 一行原文裡取一段算式（用錨點，找不到或不唯一就丟例外）
const grab = (text, re, what) => { const m = [...text.matchAll(re)]; if (m.length !== 1) throw new Error(`${what}：算式要剛好找到 1 處（${m.length}）`); return m[0][1]; };

// ---- 輸入：邊界都要碰到 ----
const KEYS = Object.keys(PO.POLICY_CATALOG), EXTRA_KEYS = ['foo', '__proto__', 'constructor', 'toString', '', 'taxr', 'Curfew'];
const TAXV = [0, -1, .3, .45, .5, .54, .55, .65, .94, 1, 1.04, 1.05, 1.06, 1.25, 1.5, 1.95, 2, 2.04, 2.05, 9, NaN, Infinity, -Infinity, '1.3', '', 'x', null, undefined, true, false, [], {}, [1.4], '0'];
const TOGV = [true, false, 0, 1, '', 'x', 'false', null, undefined, NaN, [], {}, -1];
function makeInputs() {
  const R = mulberry32(20263201), int = (a, b) => a + Math.floor(R() * (b - a + 1)), ch = p => R() < p, pick = a => a[Math.floor(R() * a.length)];
  const d0 = PO.defaultPol(), cases = [];
  for (let n = 0; n < 1600; n++) {
    const shape = pick(['null', 'null', 'default', 'partial', 'extra', 'odd', 'empty']);
    let pol = null;
    if (shape !== 'null') {
      pol = shape === 'default' ? { ...d0 } : {};
      if (shape === 'partial' || shape === 'extra' || shape === 'odd') for (const k of KEYS) if (ch(.5)) pol[k] = PO.POLICY_CATALOG[k].type === 'tax' ? pick([.5, .7, 1, 1.3, 2, 1.25, .55]) : (shape === 'odd' ? pick([true, false, 1, 0, 'x']) : ch(.4));
      if (shape === 'extra') { pol.foo = 7; pol.zzz = 'q'; }
      if (shape === 'default') for (const k of KEYS) if (ch(.15)) pol[k] = PO.POLICY_CATALOG[k].type === 'tax' ? pick([.5, 1.5, 2]) : true;
    }
    const last = {}; for (const k of KEYS) if (ch(.4)) last[k] = int(-5, 120);
    const steps = [], len = int(1, 14); let day = int(0, 120);
    for (let s = 0; s < len; s++) {
      day += pick([0, 0, 1, 5, 34, 35, 36, 39, 40, 41, 44, 45, 46, 59, 60, 61, 70]);
      const k = ch(.12) ? pick(EXTRA_KEYS) : pick(KEYS), tax = PO.POLICY_CATALOG[k]?.type === 'tax';
      steps.push({ day, k, v: ch(.85) ? pick(tax ? TAXV : TOGV) : pick(ch(.5) ? TAXV : TOGV) });
    }
    cases.push({ pol, last, steps });
  }
  return cases;
}

// 套用：每一步的結果都要逐位相等（回傳值、物件含欄位順序、最後套用的日子、副作用），傳進去的物件不被動到
function compareApply(lab, M, cases) {
  let steps = 0, okN = 0, noN = 0, cool = 0, same = 0, unknown = 0, labOnly = 0;
  for (const c of cases) {
    let pLab = clone(c.pol), lastLab = { ...c.last }, pMine = clone(c.pol), lastMine = { ...c.last };
    for (const s of c.steps) {
      const snapP = J(plain(pMine)), snapL = J(lastMine);
      const a = lab.press(pLab, lastLab, s.day, s.k, s.v), b = M.applyPolicy(pMine, lastMine, s.day, s.k, s.v); steps++;
      if (J(plain(pMine)) !== snapP || J(lastMine) !== snapL) return `第 ${steps} 步 ${s.k}：本線動到了傳進去的物件（要回傳新的）`;
      pLab = a.pol; lastLab = a.last; pMine = b.pol; lastMine = b.last;
      if (a.r !== b.ok) return `第 ${steps} 步 ${s.k}=${String(s.v)}：回傳 實驗線 ${a.r}≠本線 ${b.ok}`;
      if (J(plain(a.pol)) !== J(plain(b.pol))) return `第 ${steps} 步 ${s.k}=${String(s.v)}：物件 實驗線 ${J(plain(a.pol)).slice(0, 120)}≠本線 ${J(plain(b.pol)).slice(0, 120)}`;
      if (J(a.last) !== J(b.last)) return `第 ${steps} 步：最後套用的日子 實驗線 ${J(a.last)}≠本線 ${J(b.last)}`;
      if (a.coverage !== b.effects.coverage || a.sanitation !== b.effects.sanitation || a.power !== b.effects.power) return `第 ${steps} 步 ${s.k}：副作用 實驗線 ${a.coverage}／${a.sanitation}／${a.power}≠本線 ${b.effects.coverage}／${b.effects.sanitation}／${b.effects.power}`;
      if (a.trial) return `第 ${steps} 步：玩家的路徑不該啟動試行`;
      const want = a.r && Object.prototype.hasOwnProperty.call(LAB_ONLY, s.k) ? LAB_ONLY[s.k] : [];
      if (J(a.others) !== J(want)) return `第 ${steps} 步 ${s.k}：實驗線多標的旗標 ${J(a.others)}≠記錄 ${J(want)}`;
      if (want.length) labOnly++;
      if (a.r) okN++; else noN++;
      if (!Object.prototype.hasOwnProperty.call(PO.POLICY_CATALOG, s.k)) unknown++;
      else if (!M.cooldownReady(lastMine, s.day, s.k) && a.r === false) cool++; else if (!a.r) same++;
    }
  }
  return { steps, okN, noN, cool, same, unknown, labOnly };
}

// ---- 比對：同一套比對要能拿「改壞的實驗線」或「改壞的本線」來跑，所以工廠吃（實驗線實例、原文、輸入） ----
const ORDER = ['table', 'default', 'ensure', 'cooldown', 'apply', 'tax', 'budget', 'purchasing', 'insurance', 'recycle', 'stock', 'load', 'fees', 'shown'];
function makeCmp(lab, T, cases) {
  const cmp = {};
  cmp.table = M => {
    const a = lab.catalog(), b = M.POLICY_CATALOG; if (J(Object.keys(a)) !== J(Object.keys(b))) return `鍵的順序 ${J(Object.keys(a)).slice(0, 80)}≠${J(Object.keys(b)).slice(0, 80)}`;
    for (const k of Object.keys(a)) if (J(plain(a[k])) !== J(plain(b[k]))) return `${k}：實驗線 ${J(a[k])}≠本線 ${J(b[k])}`;
    return '';
  };
  cmp.default = M => { const a = lab.ensure(null), b = M.defaultPol(); return J(plain(a)) === J(plain(b)) ? '' : `預設物件 實驗線 ${J(plain(a)).slice(0, 100)}≠本線 ${J(plain(b)).slice(0, 100)}`; };
  cmp.ensure = M => {
    for (const c of cases.slice(0, 400)) {
      const inp = clone(c.pol), snap = J(plain(inp)), a = lab.ensure(clone(c.pol)), b = M.ensurePol(inp);
      if (J(plain(inp)) !== snap) return `補欄位 起始 ${J(c.pol)}：本線動到了傳進去的物件`;
      if (J(plain(a)) !== J(plain(b))) return `補欄位 起始 ${J(c.pol)}：實驗線 ${J(plain(a)).slice(0, 100)}≠本線 ${J(plain(b)).slice(0, 100)}`;
    }
    return '';
  };
  cmp.cooldown = M => {   // 53749：冷卻；不認得的鍵＝不行；介面的「還剩幾天」跟它一致（0＝可以按）
    const R = mulberry32(20263207);
    for (let n = 0; n < 4000; n++) {
      const last = {}, k = R() < .1 ? EXTRA_KEYS[Math.floor(R() * EXTRA_KEYS.length)] : KEYS[Math.floor(R() * KEYS.length)];
      if (R() < .7) last[k] = Math.floor(R() * 130) - 5;
      const cfg = PO.POLICY_CATALOG[k], edge = cfg && R() < .5 ? [-1, 0, 1][Math.floor(R() * 3)] : 0, d = cfg && last[k] !== undefined && R() < .5 ? last[k] + cfg.cooldown + edge : Math.floor(R() * 200);
      const a = lab.cool({ ...last }, d, k), b = M.cooldownReady(last, d, k); if (a !== b) return `冷卻 ${k} 最後 ${last[k]} 今天 ${d}：實驗線 ${a}≠本線 ${b}`;
      const left = M.cooldownLeft(last, d, k), want = PO.POLICY_CATALOG[k] && Object.prototype.hasOwnProperty.call(PO.POLICY_CATALOG, k) ? Math.max(0, PO.POLICY_CATALOG[k].cooldown - (d - (last[k] ?? -999))) : 0;
      if (left !== want) return `還剩幾天 ${k} 最後 ${last[k]} 今天 ${d}：${left}≠${want}`;
      if (Object.prototype.hasOwnProperty.call(PO.POLICY_CATALOG, k) && (left === 0) !== a) return `還剩幾天 ${k}：${left} 跟能不能按（${a}）不一致`;
    }
    return '';
  };
  cmp.apply = M => { const r = compareApply(lab, M, cases); return isErr(r) ? r : ''; };
  cmp.tax = M => {
    const R = mulberry32(20263202), step = grab(T.polStep, /pol\[k\]\+d\*([\d.]+)\)/g, '稅率按鈕的一格');
    if (!Object.is(M.TAX_STEP, +step)) return `稅率按鈕一格 實驗線 ${step}≠本線 ${M.TAX_STEP}`;
    for (let n = 0; n < 4000; n++) { const cur = n < 400 ? [.5, .6, 1, 1.9, 2, 1.25, 1.05, .95][n % 8] : Math.round((.5 + R() * 1.5) * 100) / 100, d = R() < .5 ? -1 : 1, a = lab.step(cur, d, 'taxR'), b = M.stepTax(cur, d); if (!Object.is(a, b)) return `稅率按鈕 ${cur}${d > 0 ? '＋' : '−'}：實驗線 ${a}≠本線 ${b}`; }
    return '';
  };
  cmp.budget = M => {
    const R = mulberry32(20263203), cats = ['police', 'fire', 'health', 'edu'], step = grab(T.budStep, /setSvcBudget\(cat,d\*([\d.]+)\)/g, '預算按鈕的一格');
    if (!Object.is(M.BUDGET_STEP, +step)) return `預算按鈕一格 實驗線 ${step}≠本線 ${M.BUDGET_STEP}`;
    for (let n = 0; n < 4000; n++) {
      const b = { police: 1, fire: 1, health: 1, edu: 1 }; for (const c of cats) b[c] = n % 3 === 0 ? [.5, 1, 1.5, 1.4, .6, 1.25][Math.floor(R() * 6)] : Math.round((.5 + R()) * 100) / 100;
      const cat = R() < .06 ? ['foo', 'constructor', '__proto__'][Math.floor(R() * 3)] : cats[Math.floor(R() * 4)], delta = [.1, -.1, .2, -.2, .05, 0, 1, -1, .3][Math.floor(R() * 9)];
      const a = lab.budget(b, cat, delta), m = M.stepBudget({ ...b }, cat, delta);
      if (J(plain(a.b)) !== J(plain(m))) return `預算 ${J(b)} ${cat}${delta >= 0 ? '＋' : ''}${delta}：實驗線 ${J(a.b)}≠本線 ${J(m)}`;
      const known = cats.includes(cat); if (a.coverage !== known) return `預算：實驗線 ${known ? '要' : '不會'}重算覆蓋卻 ${a.coverage}`;
    }
    return '';
  };
  cmp.purchasing = M => {
    const R = mulberry32(20263204), TAX = [.5, .7, 1, 1.04, 1.05, 1.06, 1.3, 1.5, 1.9, 2, 0, undefined, null, NaN, '1.5', 3];
    for (let n = 0; n < 6000; n++) {
      const labor = { employmentRate: R() * 1.3 - .1, wageIndex: .3 + R() * 1.5 }, wealth = R() * 2, happy = R() * 1.4 - .2, cost = R() < .1 ? undefined : .5 + R() * 1.5, tax = n < 3000 ? TAX[n % TAX.length] : 1 + (R() * 1.6 - .3);
      const a = lab.pp(labor, wealth, happy, cost, tax), b = M.EC.purchasingPower481(labor, wealth, happy, cost, tax);
      if (!Object.is(a, b)) return `購買力 taxR=${String(tax)}：實驗線 ${a}≠本線 ${b}`;
    }
    return '';
  };
  cmp.insurance = M => {
    const R = mulberry32(20263205);
    for (let n = 0; n < 1500; n++) {
      const pol = [null, {}, { insurance: true }, { insurance: false }, { insurance: 1 }, { insurance: 'x' }, { insurance: 0 }][n % 7], m0 = n % 3 === 0 ? Math.round(R() * 5000) : R() * 5000, cnt = Math.floor(R() * 9), d = Math.floor(R() * 200);
      const a = lab.ins(clone(pol), m0, d, cnt);
      let m = m0; if (M.insuredOf(pol)) for (let i = 0; i < cnt; i++) m += M.INSURANCE_PAYOUT;
      if (!Object.is(a.money, m)) return `保險 ${J(pol)} 資金 ${m0} ${cnt} 戶：實驗線 ${a.money}≠本線 ${m}`;
      const want = M.insuredOf(pol) && cnt > 0 ? 1 : 0; if (a.toasts.length !== want || (want && a.toasts[0] !== M.INSURANCE_TOAST)) return `保險的提示 ${J(a.toasts)}（要 ${want} 則「${M.INSURANCE_TOAST}」）`;
    }
    return '';
  };
  cmp.recycle = M => {
    const ex = grab(T.recycleMul, /const recycleMul452=(\(pol&&pol\.recycle\?[\d.]+:[\d.]+\));/g, '回收乘數');
    for (const pol of [null, {}, { recycle: false }, { recycle: true }, { recycle: 1 }, { recycle: 0 }, { recycle: 'x' }]) { const a = lab.expr(ex, { pol: clone(pol) }), b = M.recycleMulOf(clone(pol)); if (!Object.is(a, b)) return `回收乘數 ${J(pol)}：實驗線 ${a}≠本線 ${b}`; }
    return '';
  };
  cmp.stock = (M, E) => {
    const R = mulberry32(20263206), food = grab(T.stockFood, /foodHold492=(pol\?\.emergencyStockpile492\?Math\.ceil\(foodCoreNeed482\*[\d.]+\):\d+),foodExportCandidate482/g, '糧食'),
      gas = grab(T.stockGas, /gasSurplus482-(\(pol\?\.emergencyStockpile492\?Math\.ceil\(gasDem\*[\d.]+\):\d+\))\)/g, '天然氣'), goods = grab(T.stockGoods, /reserve481=Math\.max\(gNeed284\*2,gCap481\*\.28\)\*(\(pol\?\.emergencyStockpile492\?[\d.]+:[\d.]+\))/g, '商品'),
      fuel = grab(T.stockFuel, /(Math\.ceil\(fuelDemand482\*\(pol\?\.emergencyStockpile492\?[\d.]+:[\d.]+\)\))/g, '燃料');
    for (const pol of [null, {}, { emergencyStockpile492: false }, { emergencyStockpile492: true }, { emergencyStockpile492: 1 }, { emergencyStockpile492: 'x' }]) {
      const stock = !!(pol && pol.emergencyStockpile492);
      for (let n = 0; n < 120; n++) {
        const need = n % 4 === 0 ? Math.floor(R() * 400) : R() * 400, dem = n % 4 === 1 ? Math.floor(R() * 300) : R() * 300;
        const a1 = lab.expr(food, { pol: clone(pol), foodCoreNeed482: need }), b1 = E.foodHold492Of(stock, need); if (!Object.is(a1, b1)) return `糧食 ${J(pol)} ${need}：實驗線 ${a1}≠本線 ${b1}`;
        const a2 = lab.expr(gas, { pol: clone(pol), gasDem: dem }), b2 = E.gasHold492Of(stock, dem); if (!Object.is(a2, b2)) return `天然氣 ${J(pol)} ${dem}：實驗線 ${a2}≠本線 ${b2}`;
        const a4 = lab.expr(fuel, { pol: clone(pol), fuelDemand482: need }), b4 = Math.ceil(need * E.fuelHoldMul492(stock)); if (!Object.is(a4, b4)) return `燃料 ${J(pol)} ${need}：實驗線 ${a4}≠本線 ${b4}`;
      }
      const a3 = lab.expr(goods, { pol: clone(pol) }), b3 = E.goodsReserveMul492(stock); if (!Object.is(a3, b3)) return `商品儲備 ${J(pol)}：實驗線 ${a3}≠本線 ${b3}`;
    }
    return '';
  };
  cmp.load = M => {   // 讀檔：實驗線 `if(d.pol)pol=d.pol`（先歸零）——物件原樣收下；非物件的真值實驗線也收下、本線當沒有政策（唯一的差）；假值＝沒有政策
    const shapes = [undefined, null, 0, '', false, NaN, {}, { taxR: 1.5 }, { taxR: 1, curfew: true, foo: 1 }, PO.defaultPol(), [], [1], 'x', 7, true];
    for (const raw of shapes) {
      const lp = vm.runInNewContext(`let pol=null;const d={pol:__raw};${T.loadPol};pol`, { __raw: raw }), mine = M.polOfSave(raw), obj = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
      if (obj) { if (J(plain(lp)) !== J(plain(mine)) || lp === null) return `讀檔 ${J(raw)}：實驗線 ${J(plain(lp))}≠本線 ${J(plain(mine))}`; if (mine === raw) return `讀檔：本線要複製一份，不跟存檔物件共用`; }
      else if (!raw) { if (lp !== null || mine !== null) return `讀檔 ${String(raw)}：假值要是沒有政策（實驗線 ${J(lp)}、本線 ${J(mine)}）`; }
      else if (mine !== null) return `讀檔 ${J(raw)}：非物件本線要當沒有政策（唯一的差），卻是 ${J(mine)}`;
    }
    return '';
  };
  cmp.fees = M => {   // 介面給開的開關，它的法規日費＝money.ts 的 upRegOf（55972）；POLICY_FEE 沒列的日費是 0
    const shown = [...M.POLICY_SHOWN.law, ...M.POLICY_SHOWN.policy];
    for (const k of shown) { const fee = upRegOf({ [k]: true }, [], null, 0, 0), want = M.POLICY_FEE[k] ?? 0; if (fee !== want) return `${k} 的日費 money.ts ${fee}≠POLICY_FEE ${want}`; }
    for (const k of Object.keys(M.POLICY_FEE)) if (!shown.includes(k)) return `POLICY_FEE 有 ${k}，介面沒給開`;
    return '';
  };
  cmp.shown = M => {
    const shown = [...M.POLICY_SHOWN.law, ...M.POLICY_SHOWN.policy];
    if (shown.length !== 11 || new Set(shown).size !== 11) return `介面給開的要 11 個：${shown.length}`;
    for (const k of shown) if (!PO.POLICY_CATALOG[k] || PO.POLICY_CATALOG[k].type !== 'toggle') return `${k} 不是目錄裡的開關`;
    const hidden = Object.keys(PO.POLICY_CATALOG).filter(k => PO.POLICY_CATALOG[k].type === 'toggle' && !shown.includes(k)); if (hidden.length !== 15) return `介面沒給開的開關要 15 個（本線沒有消費者）：${hidden.length}`;
    return '';
  };
  return cmp;
}
// 只跑指定的比對（突變用：指定「哪一項要紅」）；沒指定就依序全跑。回傳第一個紅的 { k, msg }，全綠回 null。丟例外＝紅
function runCmp(cmp, M, E, only) {
  const M2 = { ...M, EC: E };
  for (const k of only ?? ORDER) {
    let r; try { r = cmp[k](M2, E); } catch (e) { r = `丟例外 ${e.name}: ${String(e.message).slice(0, 100)}`; }
    if (r) return { k, msg: r };
  }
  return null;
}

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d032-policy.json')), T = S.text, fails = [];
  // ---- 1. 出處 ----
  {
    const sha = s => crypto.createHash('sha256').update(s).digest('hex'), names = Object.values(KEY);
    if (S.source?.commit !== PINNED) fails.push(`出處不是 ${PINNED.slice(0, 7)}：${S.source?.commit}`);
    if (S.pieces.length !== names.length) fails.push(`段數 ${S.pieces.length}≠${names.length}`);
    for (const [i, p] of S.pieces.entries()) {
      const name = names[i], body = T[Object.keys(KEY)[i]];
      if (p.name !== name) fails.push(`第 ${i} 段名字 ${p.name}≠${name}`);
      if (typeof body !== 'string' || sha(body) !== p.sha) fails.push(`${p.name}：原文與錨點的 sha256 不符`);
      if (!(p.line >= 1 && p.endLine >= p.line)) fails.push(`${p.name}：行號不對`);
    }
    const src = read('src/sim/rules/policy.ts'), code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n').replace(/\/\/.*$/gm, '');
    if (/from ['"]three|document\.|window\.|Math\.random|Date\.now|performance\.now|https?:\/\//.test(code)) fails.push('policy.ts 不是純函式：碰到 three／DOM／亂數／現實時間／外部網址');
    const labCat = makeLab(T).catalog();
    if (Object.keys(labCat).length !== 29 || Object.keys(PO.POLICY_CATALOG).length !== 29) fails.push(`目錄條數 實驗線 ${Object.keys(labCat).length}、本線 ${Object.keys(PO.POLICY_CATALOG).length}（要 29）`);
    // 接線要靠的事實：原文裡真的是這個樣子
    const facts = [
      [/rl,rb,dk,ow,tl,pm,bln,tr,of,fl,le,ab,pol,region,/.test(T.saveField), '存檔的 pol 在 ab 之後、region 之前'], [/^let pol=null;/.test(T.polDecl), 'pol 宣告是 let pol=null'],
      [/pol=null;region=\{\};/.test(T.loadReset) && /pol=null;region=\{\};/.test(T.newWorldReset), '讀檔與新圖都先把 pol 歸零'], [/^\s*if\(d\.pol\)pol=d\.pol;\s*$/.test(T.loadPol), '讀檔是 if(d.pol)pol=d.pol'],
      [/t\.bld=null;t\.ruin=1;insPayout\(x,y\);/.test(T.insBurn) && /if\(b\.fire>=5\)/.test(T.insBurn), '火燒毀（fire≥5）清建築、記廢墟之後理賠'], [/setSvcBudget\(cat,d\*\.1\)/.test(T.budStep), '預算按鈕的一格是 d*.1'],
      [/policyApply504\(k,next,\{source:'player'/.test(T.polStep), '稅率按鈕走 policyApply504 的玩家路徑'], [/pol&&pol\.indSubsidy\?\.15:0/.test(T.indSub), '工業補貼 +.15'],
      [/Math\.round\(EDU_W_SCHOOL\*\(pol&&pol\.schoolLunch\?1\.25:1\)\)/.test(T.eduStatic), '營養午餐 ×1.25 在教育場的學校項'], [/^function policyApply504\(k,value,opts=\{\}\)\{if\(window\.__noPolicy504\)\{/.test(T.policyApply504), 'policyApply504 開頭是 __noPolicy504 的直接路徑'],
    ];
    for (const [ok, what] of facts) if (!ok) fails.push(`原文事實不成立：${what}`);
    log(!fails.length, 'D032 政策原文：實驗線 d23c18d 的 24 段（政策目錄 53719–53725、預設物件 53748、冷卻 53749、套用 53750–53755、policyApply504 67570、稅率按鈕 65791–65793、setSvcBudget 52968–52973、購買力 38270、保險 53047–53051 與火燒呼叫 55796、回收 55257、工業補貼 55584、緊急儲備四處、存檔 66750、讀檔 66972／66975、新圖 51118、eduStaticAt 53129）逐段 sha256＝錨點記錄；policy.ts 是純函式；目錄 29 條；接線要靠的 10 個事實在原文裡成立',
      fails.join('；') || `${S.pieces.length} 段、行號對得上；目錄 29 條（稅率 3＋開關 26）；10 個事實成立`);
    if (fails.length) return;
  }
  const lab = makeLab(T), cases = makeInputs(), cmp = makeCmp(lab, T, cases);
  // ---- 2. 逐項相等 ----
  const first = runCmp(cmp, PO, EC);
  const stat = compareApply(lab, PO, cases);
  log(!first && !isErr(stat) && stat.okN > 2500 && stat.cool > 400 && stat.same > 400 && stat.unknown > 100 && stat.labOnly > 150, 'D032 驗收 2：政策逐項＝實驗線——實驗線原文在 vm 裡（玩家按鈕的路徑）跟本線 policy.ts／economy.ts 吃同一批輸入：目錄 29 條與預設物件逐欄（含順序）、補欄位、冷卻、套用、稅率按鈕、服務預算按鈕、購買力的稅率項、災害保險、緊急物資儲備四處、回收乘數、讀檔、法規日費表',
    first ? `${first.k}：${first.msg}` : (isErr(stat) ? stat : `套用 ${stat.steps} 步（成功 ${stat.okN}、沒動 ${stat.noN}：冷卻中 ${stat.cool}、同值 ${stat.same}、不認得的鍵 ${stat.unknown}；其中實驗線多標旗標的 ${stat.labOnly} 步）每一步回傳值、物件、最後套用的日子、副作用逐位相等；冷卻 4,000 組、稅率按鈕 4,000 步、預算按鈕 4,000 步、購買力 6,000 組、保險 1,500 組、緊急儲備 6 種物件 × 120 組、讀檔 15 種形狀全等`));
  if (first || process.env.D032_BASE_ONLY) return;

  // ---- 3. 突變：每個指定「哪一項比對要紅」，只跑那一項 ----
  const missed = [], bad = [], live = {};
  const note = (who, name, res, want) => { live[want] = (live[want] ?? 0) + (res ? 1 : 0); if (!res) missed.push(`${who}「${name}」（${want} 沒紅）`); };
  // 3a. 實驗線原文改壞
  const labMuts = LAB_MUTS.concat(autoLabMuts(T));
  let nLab = 0;
  for (const [name, piece, a, b, want] of labMuts) {
    if (typeof T[piece] !== 'string' || T[piece].split(a).length !== 2) { bad.push(`實驗線「${name}」錨點要剛好一處：${T[piece] === undefined ? '沒有這段' : T[piece].split(a).length - 1}（${a.slice(0, 40)}）`); continue; }
    const T2 = { ...T, [piece]: T[piece].replace(a, b) };
    let lab2; try { lab2 = makeLab(T2); } catch (e) { bad.push(`實驗線「${name}」改壞之後載不進來（要改成語法正確的錯誤）：${String(e.message).slice(0, 60)}`); continue; }
    nLab++; note('實驗線', name, runCmp(makeCmp(lab2, T2, cases), PO, EC, [want]), want);
  }
  // 3b. 本線原碼改壞
  const polSrc = read('src/sim/rules/policy.ts'), ecoSrc = read('src/sim/rules/economy.ts');
  const portMuts = PORT_MUTS.concat(autoPortMuts(polSrc));
  let nMine = 0;
  for (const [name, file, a, b, want] of portMuts) {
    const rel = file === 'economy' ? 'src/sim/rules/economy.ts' : 'src/sim/rules/policy.ts', src = file === 'economy' ? ecoSrc : polSrc;
    if (src.split(a).length !== 2) { bad.push(`本線「${name}」錨點要剛好一處：${src.split(a).length - 1}（${a.slice(0, 40)}）`); continue; }
    let M2; try { M2 = await loadMod(rel, [[a, b]]); } catch (e) { bad.push(`本線「${name}」改壞之後載不進來：${String(e.message).slice(0, 80)}`); continue; }
    nMine++; note('本線', name, file === 'economy' ? runCmp(cmp, PO, M2, [want]) : runCmp(cmp, { ...PO, ...M2 }, EC, [want]), want);
  }
  const base = await loadMod('src/sim/rules/policy.ts', []), baseEco = await loadMod('src/sim/rules/economy.ts', []);
  const baseOk = !runCmp(cmp, { ...PO, ...base }, { ...EC, ...baseEco });
  const deadCmp = ORDER.filter(k => !live[k]);
  log(baseOk && !bad.length && !missed.length && !deadCmp.length, `D032 驗收 2（突變）：注入錯誤要紅——實驗線原文 ${nLab} 個、本線原碼 ${nMine} 個（冷卻的比較與預設、取整的倍數、稅率與預算的夾限、同值不動、每個副作用、預設值、目錄每一條的冷卻與種類與名字、購買力的係數、保險金額與提示、回收與緊急儲備的係數、讀檔、日費表、介面清單）；每個突變只跑它該紅的那一項比對，14 項比對每一項都至少抓到過一個`,
    [...bad, ...missed, ...deadCmp.map(k => `比對 ${k} 沒抓到任何突變`), baseOk ? '' : '載入的原碼（沒改）跟 import 的不一樣'].filter(Boolean).join('；') || `全紅（${ORDER.map(k => `${k} ${live[k]}`).join('、')}）`);
}

// ---- 自動產生的突變：目錄每一條的冷卻、種類、名字；預設物件每一欄 ----
function autoLabMuts(T) {
  const out = [], re = /(\w+):\{nm:'([^']*)',type:'(tax|toggle)',cooldown:(\d+)\}/g;
  for (const m of T.catalog.matchAll(re)) {
    const [whole, k, nm, ty, cd] = m;
    out.push([`目錄 ${k} 冷卻 +1`, 'catalog', whole, whole.replace(`cooldown:${cd}`, `cooldown:${+cd + 1}`), 'table'], [`目錄 ${k} 種類翻面`, 'catalog', whole, whole.replace(`type:'${ty}'`, `type:'${ty === 'tax' ? 'toggle' : 'tax'}'`), 'table'],
      [`目錄 ${k} 名字`, 'catalog', whole, whole.replace(`nm:'${nm}'`, `nm:'${nm}x'`), 'table']);
  }
  const lit = /pol=\{taxR:1,taxC:1,taxI:1,[^}]*\}/.exec(T.ensure)?.[0] ?? '';
  for (const k of Object.keys(PO.POLICY_CATALOG)) {
    const tax = PO.POLICY_CATALOG[k].type === 'tax', from = `${k}:${tax ? '1' : 'false'}`, to = `${k}:${tax ? '2' : 'true'}`, idx = lit.indexOf(from);
    if (idx < 0) continue;
    out.push([`預設物件 ${k} 翻面`, 'ensure', lit, lit.slice(0, idx) + to + lit.slice(idx + from.length), 'default']);
  }
  return out;
}
function autoPortMuts(src) {
  const out = [], re = /(\w+): \{ nm: '([^']*)', type: '(tax|toggle)', cooldown: (\d+) \}/g;
  for (const m of src.matchAll(re)) {
    const [whole, k, nm, ty, cd] = m;
    out.push([`目錄 ${k} 冷卻 +1`, 'policy', whole, whole.replace(`cooldown: ${cd}`, `cooldown: ${+cd + 1}`), 'table'], [`目錄 ${k} 種類翻面`, 'policy', whole, whole.replace(`type: '${ty}'`, `type: '${ty === 'tax' ? 'toggle' : 'tax'}'`), 'table'],
      [`目錄 ${k} 名字`, 'policy', whole, whole.replace(`nm: '${nm}'`, `nm: '${nm}x'`), 'table']);
  }
  const body = /export function defaultPol\(\): Pol \{\n([\s\S]*?)\n\}/.exec(src)?.[1] ?? '';
  for (const k of Object.keys(PO.POLICY_CATALOG)) {
    const tax = PO.POLICY_CATALOG[k].type === 'tax', from = `${k}: ${tax ? '1' : 'false'}`, to = `${k}: ${tax ? '2' : 'true'}`, idx = body.indexOf(from);
    if (idx < 0) continue;
    out.push([`預設物件 ${k} 翻面`, 'policy', body, body.slice(0, idx) + to + body.slice(idx + from.length), 'default']);
  }
  const t = body.indexOf('taxC: 1, taxI: 1'); if (t >= 0) out.push(['預設物件 taxC／taxI 對調', 'policy', body, body.replace('taxC: 1, taxI: 1', 'taxI: 1, taxC: 1'), 'default']);
  return out;
}

// ---- 突變表：[名字, 段落鍵, 原文, 改成, 要紅的比對]（實驗線）／[名字, 檔, 原文, 改成, 要紅的比對]（本線）。原文要在那一段（那個檔）裡剛好出現一次 ----
// 等價突變不列（改了也看不出差別，不是比對太鬆）：
//   · 購買力的稅率因子 tax = clamp(1 − max(0, (taxR||1) − 1) × .18, .82, 1.06) 最大就是 1，所以上限 1.06 夠不到（改成 1.07 一樣）；`(taxR||1)` 的預設也無所謂——taxR 是假值時 `(0)−1` 與 `(1)−1` 進 max(0, ·) 都是 0；
//   · 本線 ensurePol 的「沒有物件 → 先用 defaultPol()」跟「空物件再照目錄補欄位」補出同一個物件（目錄與預設物件同一個欄位順序，由 table／default 兩項比對守著）；
//   · 套用裡「不認得的鍵」的檢查跟冷卻裡的檢查重複（冷卻對不認得的鍵回 false），改掉其中一個看不出差別（冷卻裡那個靠「還剩幾天」與空字串鍵抓）；
// 讀檔的 polOfSave 只收物件，是跟實驗線唯一的差，有專門的比對（load）
const LAB_MUTS = [
  ['冷卻改成 >', 'cooldown', '>=cfg.cooldown', '>cfg.cooldown', 'cooldown'], ['冷卻預設改成 0', 'cooldown', '??-999', '??0', 'cooldown'], ['冷卻不擋不認得的鍵', 'cooldown', 'if(!cfg)return false;', '', 'cooldown'],
  ['稅率取整改成 .05', 'apply', 'Math.round((+value||1)*10)/10', 'Math.round((+value||1)*20)/20', 'apply'], ['稅率上限 2→1.9', 'apply', '*10)/10,.5,2)', '*10)/10,.5,1.9)', 'apply'], ['稅率下限 .5→.4', 'apply', '*10)/10,.5,2)', '*10)/10,.4,2)', 'apply'],
  ['稅率 0 不當 1', 'apply', '(+value||1)', '(+value||0)', 'apply'], ['開關不轉布林', 'apply', 'else value=!!value;', 'else value=value;', 'apply'], ['同值也套用', 'apply', 'if(old===value)return false;', '', 'apply'],
  ['同值比較改成 ==', 'apply', 'if(old===value)return false;', 'if(old==value)return false;', 'apply'], ['不記最後套用的日子', 'apply', 'mayorPolicyLast470A[k]=day;', '', 'apply'],
  ['營養午餐不重算覆蓋', 'apply', "if(k==='schoolLunch')rebuildCov();", '', 'apply'], ['回收不標清運髒', 'apply', "if(k==='recycle')sanDirty445=true;", '', 'apply'], ['節能不標電力髒', 'apply', "if(k==='ecoReg')markPowerDirty450();", '', 'apply'],
  ['關鍵備轉不標電力髒', 'apply', "if(k==='criticalReserve492')markPowerDirty471();", '', 'apply'], ['水循環四項不標髒', 'apply', 'markWaterCycleDirty472();', '', 'apply'], ['不先補預設物件', 'apply', 'mayorEnsurePolicy470A();const cfg', 'const cfg', 'apply'],
  ['補欄位：開關預設 true', 'ensure', "type==='tax'?1:false", "type==='tax'?1:true", 'ensure'], ['補欄位：稅率預設 2', 'ensure', "type==='tax'?1:false", "type==='tax'?2:false", 'ensure'], ['補欄位：全蓋掉', 'ensure', 'if(pol[k]===undefined)pol[k]=', 'pol[k]=', 'ensure'],
  ['稅率按鈕取整 .01→.1', 'polStep', '*100)/100)', '*10)/10)', 'tax'], ['稅率按鈕上限', 'polStep', 'Math.min(2,', 'Math.min(3,', 'tax'], ['稅率按鈕下限', 'polStep', 'Math.max(.5,', 'Math.max(.4,', 'tax'], ['稅率按鈕步進', 'polStep', 'd*.1', 'd*.2', 'tax'],
  ['預算 toFixed', 'setSvcBudget', 'toFixed(2)', 'toFixed(1)', 'budget'], ['預算上限', 'setSvcBudget', '.5,1.5)', '.5,1.6)', 'budget'], ['預算下限', 'setSvcBudget', '.5,1.5)', '.4,1.5)', 'budget'],
  ['預算不查類別', 'setSvcBudget', 'if(!Object.prototype.hasOwnProperty.call(svcBudget,cat))return svcBudget;', '', 'budget'], ['預算不重算覆蓋', 'setSvcBudget', 'rebuildCov();', '', 'budget'], ['預算按鈕步進', 'budStep', 'd*.1', 'd*.2', 'budget'],
  ['購買力稅率係數', 'purchasingPower481', '*.18,', '*.19,', 'purchasing'], ['購買力稅率下限', 'purchasingPower481', '.82,1.06)', '.81,1.06)', 'purchasing'],
  ['保險金額', 'insPayout', 'money+=35;', 'money+=36;', 'insurance'], ['保險不看政策', 'insPayout', 'if(!(pol&&pol.insurance))return;', '', 'insurance'], ['保險提示不分日節流', 'insPayout', 'if(insToastDay!==day){', 'if(true){', 'insurance'],
  ['保險提示字', 'insPayout', '+$35／戶', '+$36／戶', 'insurance'],
  ['回收係數', 'recycleMul', '.85:1', '.86:1', 'recycle'], ['糧食留存', 'stockFood', '*.75', '*.76', 'stock'], ['天然氣留存', 'stockGas', '*.75', '*.76', 'stock'], ['商品儲備倍數', 'stockGoods', '1.35:1', '1.36:1', 'stock'], ['燃料留存倍數', 'stockFuel', '2.5:1', '2.6:1', 'stock'],
  ['讀檔：沒有也設成空物件', 'loadPol', 'if(d.pol)pol=d.pol;', 'pol=d.pol||{};', 'load'],
];
const PORT_MUTS = [
  // 冷卻與剩餘天數
  ['冷卻 >= → >', 'policy', 'return day - (last[k] ?? -999) >= POLICY_CATALOG[k].cooldown;', 'return day - (last[k] ?? -999) > POLICY_CATALOG[k].cooldown;', 'cooldown'],
  ['冷卻預設 -999 → 0', 'policy', 'return day - (last[k] ?? -999) >= POLICY_CATALOG[k].cooldown;', 'return day - (last[k] ?? 0) >= POLICY_CATALOG[k].cooldown;', 'cooldown'],
  ['冷卻不擋不認得的鍵', 'policy', 'if (!has(POLICY_CATALOG, k)) return false;', '', 'cooldown'],
  ['還剩天數少算 1', 'policy', 'return Math.max(0, POLICY_CATALOG[k].cooldown - (day - (last[k] ?? -999)));', 'return Math.max(0, POLICY_CATALOG[k].cooldown - (day - (last[k] ?? -999)) - 1);', 'cooldown'],
  ['還剩天數不夾 0', 'policy', 'return Math.max(0, POLICY_CATALOG[k].cooldown - (day - (last[k] ?? -999)));', 'return POLICY_CATALOG[k].cooldown - (day - (last[k] ?? -999));', 'cooldown'],
  ['還剩天數不擋不認得的鍵', 'policy', 'if (!has(POLICY_CATALOG, k)) return 0;', '', 'cooldown'],
  // 補欄位
  ['補欄位：全蓋掉（!o[k]）', 'policy', 'if (o[k] === undefined) o[k]', 'if (!o[k]) o[k]', 'ensure'], ['補欄位：稅率預設 2', 'policy', "POLICY_CATALOG[k].type === 'tax' ? 1 : false", "POLICY_CATALOG[k].type === 'tax' ? 2 : false", 'ensure'],
  ['補欄位：開關預設 true', 'policy', "POLICY_CATALOG[k].type === 'tax' ? 1 : false", "POLICY_CATALOG[k].type === 'tax' ? 1 : true", 'ensure'], ['補欄位：就地改傳進來的物件', 'policy', ': { ...(pol as Record<string, unknown>) };', ': (pol as Record<string, unknown>);', 'ensure'],
  ['補欄位：不補', 'policy', "for (const k of Object.keys(POLICY_CATALOG)) if (o[k] === undefined) o[k] = POLICY_CATALOG[k].type === 'tax' ? 1 : false;", '', 'ensure'],
  // 套用
  ['套用：不先補預設物件', 'policy', 'const pol = ensurePol(pol0);', 'const pol = (pol0 ?? {}) as PolState;', 'apply'], ['套用：不查冷卻', 'policy', '!has(POLICY_CATALOG, k) || !cooldownReady(last0, day, k)', '!has(POLICY_CATALOG, k)', 'apply'],
  ['套用：稅率取整 .1 → .05', 'policy', 'Math.round((+(value as number) || 1) * 10) / 10', 'Math.round((+(value as number) || 1) * 20) / 20', 'apply'], ['套用：稅率 0 不當 1', 'policy', '(+(value as number) || 1)', '(+(value as number) || 0)', 'apply'],
  ['套用：稅率上限 2 → 1.9', 'policy', ', .5, 2) : !!value', ', .5, 1.9) : !!value', 'apply'], ['套用：稅率下限 .5 → .4', 'policy', ', .5, 2) : !!value', ', .4, 2) : !!value', 'apply'],
  ['套用：開關不轉布林', 'policy', ': !!value;', ': (value as boolean);', 'apply'], ['套用：同值也套用', 'policy', 'if (old === v) return { ok: false, pol, last: { ...last0 }, effects: NO_EFFECT };', '', 'apply'],
  ['套用：同值用 ==', 'policy', 'if (old === v) return', 'if (old == v) return', 'apply'], ['套用：不記日子', 'policy', 'last: { ...last0, [k]: day }', 'last: { ...last0 }', 'apply'], ['套用：記錯日子', 'policy', 'last: { ...last0, [k]: day }', 'last: { ...last0, [k]: day + 1 }', 'apply'],
  ['套用：營養午餐不重算覆蓋', 'policy', "coverage: k === 'schoolLunch'", 'coverage: false', 'apply'], ['套用：覆蓋重算掛錯鍵', 'policy', "coverage: k === 'schoolLunch'", "coverage: k === 'smokeDetect'", 'apply'],
  ['套用：回收不標清運', 'policy', "sanitation: k === 'recycle'", 'sanitation: false', 'apply'], ['套用：節能不標電力', 'policy', "power: k === 'ecoReg'", 'power: false', 'apply'],
  ['套用：沒套用也標覆蓋重算', 'policy', 'const NO_EFFECT: PolicyEffects = { coverage: false,', 'const NO_EFFECT: PolicyEffects = { coverage: true,', 'apply'], ['套用：失敗時把最後套用的日子清掉', 'policy', 'if (old === v) return { ok: false, pol, last: { ...last0 }, effects: NO_EFFECT };', 'if (old === v) return { ok: false, pol, last: {}, effects: NO_EFFECT };', 'apply'],
  // 按鈕
  ['稅率按鈕一格 .1 → .2', 'policy', 'TAX_STEP = .1', 'TAX_STEP = .2', 'tax'], ['稅率按鈕取整 .01 → .1', 'policy', '* 100) / 100))', '* 10) / 10))', 'tax'], ['稅率按鈕上限', 'policy', 'Math.min(2, Math.round', 'Math.min(3, Math.round', 'tax'],
  ['稅率按鈕下限', 'policy', 'Math.max(.5, Math.min(2,', 'Math.max(.4, Math.min(2,', 'tax'], ['預算按鈕一格 .1 → .2', 'policy', 'BUDGET_STEP = .1', 'BUDGET_STEP = .2', 'budget'],
  ['預算 toFixed(2) → (1)', 'policy', '.toFixed(2)', '.toFixed(1)', 'budget'], ['預算上限 1.5 → 1.6', 'policy', '.toFixed(2), .5, 1.5)', '.toFixed(2), .5, 1.6)', 'budget'], ['預算下限 .5 → .4', 'policy', '.toFixed(2), .5, 1.5)', '.toFixed(2), .4, 1.5)', 'budget'],
  ['預算不查類別', 'policy', 'if (!has(b, cat)) return b;', '', 'budget'],
  // 回收、保險、日費、介面
  ['回收係數 .85 → .86', 'policy', '(pol && pol.recycle ? .85 : 1)', '(pol && pol.recycle ? .86 : 1)', 'recycle'], ['回收不看沒有政策', 'policy', '(pol && pol.recycle ? .85 : 1)', '(pol.recycle ? .85 : 1)', 'recycle'],
  ['保險金額 35 → 36', 'policy', 'INSURANCE_PAYOUT = 35', 'INSURANCE_PAYOUT = 36', 'insurance'], ['保險不看開關', 'policy', '!!(pol && pol.insurance)', 'true', 'insurance'], ['保險提示字', 'policy', '+$35／戶', '+$36／戶', 'insurance'],
  ['日費 recycle 8 → 9', 'policy', 'recycle: 8,', 'recycle: 9,', 'fees'], ['日費 tourPromo 10 → 11', 'policy', 'tourPromo: 10,', 'tourPromo: 11,', 'fees'], ['日費 schoolLunch 12 → 13', 'policy', 'schoolLunch: 12,', 'schoolLunch: 13,', 'fees'],
  ['日費 smokeDetect 6 → 7', 'policy', 'smokeDetect: 6,', 'smokeDetect: 7,', 'fees'], ['日費 parkNight 5 → 6', 'policy', 'parkNight: 5,', 'parkNight: 6,', 'fees'], ['日費 insurance 18 → 19', 'policy', 'insurance: 18,', 'insurance: 19,', 'fees'],
  ['日費 emergencyStockpile492 8 → 9', 'policy', 'emergencyStockpile492: 8 }', 'emergencyStockpile492: 9 }', 'fees'], ['日費表多一個沒給開的', 'policy', 'recycle: 8,', 'curfew: 1, recycle: 8,', 'fees'],
  ['介面少一個', 'policy', "law: ['curfew', ", "law: [", 'shown'], ['介面多給一個稅率', 'policy', "law: ['curfew', ", "law: ['taxR', 'curfew', ", 'shown'], ['介面重複一個', 'policy', "law: ['curfew', 'recycle',", "law: ['curfew', 'curfew',", 'shown'],
  ['介面給了沒有對應系統的開關', 'policy', "'parkNight', 'insurance', 'emergencyStockpile492']", "'parkNight', 'insurance', 'emergencyStockpile492', 'spongeCity']", 'shown'],
  // 讀檔
  ['讀檔：陣列當物件', 'policy', " && !Array.isArray(raw) ? ", ' ? ', 'load'], ['讀檔：null 當物件', 'policy', 'raw !== null && typeof raw', 'typeof raw', 'load'], ['讀檔：非物件也收', 'policy', "raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? ", '!!raw ? ', 'load'],
  ['讀檔：不複製', 'policy', '{ ...(raw as Record<string, unknown>) } as PolState', '(raw as PolState)', 'load'],
  // economy.ts：購買力與緊急物資儲備
  ['購買力稅率係數 .18 → .19', 'economy', '(taxR || 1) - 1) * .18', '(taxR || 1) - 1) * .19', 'purchasing'], ['購買力稅率下限', 'economy', '* .18, .82, 1.06)', '* .18, .81, 1.06)', 'purchasing'],
  ['糧食留存 .75 → .76', 'economy', 'Math.ceil(foodCoreNeed482 * .75)', 'Math.ceil(foodCoreNeed482 * .76)', 'stock'], ['糧食留存 ceil → floor', 'economy', 'Math.ceil(foodCoreNeed482 * .75)', 'Math.floor(foodCoreNeed482 * .75)', 'stock'],
  ['糧食留存反了', 'economy', '(stock ? Math.ceil(foodCoreNeed482 * .75) : 0)', '(!stock ? Math.ceil(foodCoreNeed482 * .75) : 0)', 'stock'], ['天然氣留存 .75 → .76', 'economy', 'Math.ceil(gasDem * .75)', 'Math.ceil(gasDem * .76)', 'stock'],
  ['天然氣留存 ceil → round', 'economy', 'Math.ceil(gasDem * .75)', 'Math.round(gasDem * .75)', 'stock'], ['商品儲備 1.35 → 1.36', 'economy', '(stock ? 1.35 : 1)', '(stock ? 1.36 : 1)', 'stock'], ['燃料留存 2.5 → 2.6', 'economy', '(stock ? 2.5 : 1)', '(stock ? 2.6 : 1)', 'stock'],
  ['燃料留存反了', 'economy', '(stock ? 2.5 : 1)', '(!stock ? 2.5 : 1)', 'stock'],
];

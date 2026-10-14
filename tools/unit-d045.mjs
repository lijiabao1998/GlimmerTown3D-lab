// D045 Node 守衛：市長委託（T385）——委託表、決定性三選一、接單、放棄、每天的結算、存與讀逐項＝實驗線原文（驗收 1 的公式半邊與突變）。實驗線頁面實跑、接線、存檔、介面：見 tools/unit-d045-live.mjs。
//   1. 出處：src/content/samples/d045-cms.json（tools/lab-cms.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；接線要靠的事實在原文裡成立（每天的結算只讀當天已算的值、沒有亂數與現實時間、獎金是一次性的 money+=、
//      存檔欄位 cms385 零狀態不落欄位、讀檔整欄驗型、☰ 面板的狀態文字）；commission.ts 沒有 three／DOM／亂數／現實時間／外部網址；
//   2. 逐項＝實驗線：實驗線原文在 Node `vm` 裡跟本線 commission.ts 吃同一批輸入——
//      表：11 條逐欄相等（id、名稱、圖示、型別、來源、目標、連續天數、期限、獎金、最低等級）；
//      雜湊與三選一：cmsHash 吃 20,000 組（種子含負的、≥ 2^31、大到浮點吃掉低位的）、cmsOffers 吃 6,000 個狀態（等級 0–30、輪次、完成清單）逐項相等；
//      存與讀：cmsSave 的零狀態與 cmsLoad 吃 ≥ 700 個欄位（合法的、各種畸形、單一破壞）逐項相等（含整個棄用回零）；
//      接單與放棄：狀態 × 難度 × 城市等級 × 人口 × 有沒有進行中 × 第幾張，回傳與狀態逐項相等；
//      每天的結算：隨機狀態 × 隨機輸入（鋼材用量、出口金額、運量、幸福、庫存、科技）連推 40 天，逐天狀態、資金、完成／過期逐項相等（含幸福的 2 位小數判定、期末驗收、完成清單只收不重複）。
//   3. 注入錯誤要紅：實驗線原文與本線原碼各改壞一批（表的獎金／期限／等級、雜湊的常數、三選一的取模與重抽次數、讀檔的每一種驗型、接單的各個門檻、放棄的輪次、結算的各個判定與邊界）；沒改的先核過全等。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as CM from '../src/sim/rules/commission.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';

export async function d045Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D045 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 實驗線那一邊：原文在 vm 裡 ----
export function makeLab(T) {
  const ctx = vm.createContext({});
  return vm.runInContext(`'use strict';let money=0,diff=1,rankIdx=0,pop=0,seed=0,day=1,steelUsed=0,tradeGold=0,transitRidership=0,cityHappy=.6,steel=0,fuel=0,techDone=[];const toasts=[];
const toast=(s,t)=>{toasts.push(String(s)+'|'+(t||''));},sFanfare=()=>{},spawnConfetti=()=>{},hasTech343=id=>techDone.includes(id);
${T.table}
${T.byId}
${T.empty}
${T.state}
${T.hash}
${T.offers}
${T.save}
${T.load}
${T.accept}
${T.drop}
function dailyCms(){
${T.daily}
}
({
  table:()=>CMS385.map(c=>JSON.parse(JSON.stringify(c))), hash:cmsHash385, offers:(s,r,n,done)=>{seed=s;rankIdx=r;cms385={act:'',st:0,acc:0,hold:0,n,done:done.slice()};return cmsOffers385().map(c=>c.id);},
  save:o=>{cms385=o;return cmsSave385();}, load:cmsLoad385, empty:emptyCms385,
  accept:(st,i,c)=>{cms385=JSON.parse(JSON.stringify(st));diff=c.diff;rankIdx=c.rankIdx;pop=c.pop;seed=c.seed;day=c.day;toasts.length=0;const ok=cmsAccept385(i);return {ok,cms:JSON.parse(JSON.stringify(cms385)),toasts:toasts.slice()};},
  drop:st=>{cms385=JSON.parse(JSON.stringify(st));toasts.length=0;const ok=cmsDrop385();return {ok,cms:JSON.parse(JSON.stringify(cms385)),toasts:toasts.slice()};},
  daily:(st,x)=>{cms385=JSON.parse(JSON.stringify(st));diff=x.diff;day=x.day;steelUsed=x.steelUsed;tradeGold=x.tradeGold;transitRidership=x.transitRidership;cityHappy=x.cityHappy;steel=x.steel;fuel=x.fuel;techDone=x.tech.slice();money=0;toasts.length=0;dailyCms();return {cms:JSON.parse(JSON.stringify(cms385)),money,toasts:toasts.slice()};},
})`, ctx, { filename: 'lab:委託' });
}
// 本線那一邊：同一組介面
export function makeImpl(M) {
  return {
    table: () => M.CMS385.map(c => JSON.parse(JSON.stringify(c))), hash: M.cmsHash, offers: (s, r, n, done) => M.cmsOffers(s, r, { ...M.emptyCms(), n, done: done.slice() }).map(c => c.id),
    save: o => M.cmsSave(o), load: M.cmsLoad, empty: M.emptyCms,
    accept: (st, i, c) => { const cms = JSON.parse(J(st)), r = M.cmsAccept(cms, i, c), t = r && M.cmsToast('accept', r); return { ok: !!r, cms, toasts: r ? [t.text + '|' + t.tone] : [] }; },
    drop: st => { const cms = JSON.parse(J(st)), r = M.cmsDrop(cms), t = r && M.cmsToast('drop', r); return { ok: !!r, cms, toasts: r ? [t.text + '|' + t.tone] : [] }; },
    daily: (st, x) => {
      const cms = JSON.parse(J(st)), o = M.cmsDaily(cms, x), toasts = [];
      let money = 0;
      if (o?.t === 'done') { money += o.bonus; const t = M.cmsToast('done', M.CMS_BY_ID385[o.id], o.bonus); toasts.push(t.text + '|' + t.tone); } else if (o?.t === 'expired') { const t = M.cmsToast('expire', M.CMS_BY_ID385[o.id]); toasts.push(t.text + '|' + t.tone); }
      return { cms, money, toasts };
    },
  };
}

// ---- 隨機輸入 ----
const SEEDS = [0, 1, -1, 5162026, 777, 2147483647, -2147483648, 2147483648, 4294967295, 123456789012, 9007199254740991, 31337, 20261045];
const seedOf = r => r() < .4 ? SEEDS[(r() * SEEDS.length) | 0] : ((r() * 4294967296) | 0) - (r() < .5 ? 0 : 2147483648);
const pick = (r, a) => a[(r() * a.length) | 0];
const ids = CM.CMS385.map(c => c.id);
function randDone(r) { const a = ids.filter(() => r() < .25); for (let i = a.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function randState(r, withAct = true) {
  const done = randDone(r);
  const act = withAct && r() < .8 ? pick(r, r() < .3 ? ids : ids.filter(i => !done.includes(i))) : '';   // 三成的狀態讓進行中的委託已經在完成清單裡（非科技型可以重複接；結算要「照發獎、不重記」）
  const c = CM.CMS_BY_ID385[act], tgt = c?.target ?? 0;
  return { act, st: act ? 1 + ((r() * 400) | 0) : 0, acc: act && c.type === 'acc' ? Math.round(r() * tgt * 1.1 * 10) / 10 : (r() < .1 ? 3 : 0), hold: act && c.type === 'hold' ? (r() * (c.holdN + 1)) | 0 : 0, n: (r() * 30) | 0, done };
}
function randDaily(r, st) {
  const c = CM.CMS_BY_ID385[st.act], el = r() < .35 ? (c ? c.days - (r() < .5 ? 1 : 0) : 5) : (r() * 200) | 0;
  const happyVals = [.6, .69, .695, .6949, .6951, .7, .7049, .75, .775, .7749, .78, .7801, .8, .55, .9];
  return {
    diff: r() < .12 ? 3 : pick(r, [0, 1, 2]), day: st.st + el, steelUsed: r() < .4 ? 0 : pick(r, [1, 2.5, 5, 10.3, 40, 80, 100]), tradeGold: r() < .4 ? 0 : pick(r, [10, 55, 200, 599.5, 1200, 3000]),
    transitRidership: r() < .5 ? 0 : pick(r, [100, 149, 150, 151, 1199, 1200, 1935]), cityHappy: r() < .6 ? pick(r, happyVals) : r(),
    steel: pick(r, [0, 30, 59, 60, 61, 120, 59.99]), fuel: pick(r, [0, 79, 80, 81, 120, 79.5]), tech: r() < .3 ? ['C6'] : r() < .3 ? ['A1', 'C5'] : [],
  };
}
const randRaw = r => {   // 合法的與各種畸形的存檔欄位
  const v = randState(r), done = v.done.slice(), base = { act: v.act, st: v.st, acc: v.acc, hold: v.hold, n: v.n, done };
  const roll = r();
  if (roll < .22) return { ...base, acc: Math.floor(base.acc) };
  const bad = [undefined, null, 'x', 1.5, -1, -0, NaN, Infinity, '7', [], {}, true, 1e21, 2 ** 31, 0];
  const keys = ['act', 'st', 'acc', 'hold', 'n', 'done'];
  const k = pick(r, keys), o = { ...base, acc: Math.floor(base.acc) };
  if (roll < .6) { o[k] = pick(r, bad); if (r() < .3) delete o[k]; }
  else if (roll < .7) { o.act = pick(r, [...ids, 'nope', 'steel40 ', '', 'constructor', '__proto__', 'toString']); o.st = pick(r, [0, 1, 5, -1]); }
  else if (roll < .8) { o.done = [...done, pick(r, [...ids, 'zzz', 5, null])]; }
  else if (roll < .86) { o.act = pick(r, ids); o.done = [o.act, ...done.filter(i => i !== o.act)]; o.st = 3; }
  else if (roll < .9) { for (const q of keys) if (r() < .4) delete o[q]; }
  else if (roll < .95) { return pick(r, [undefined, null, 0, 1, 'x', [], [1, 2], true, () => 1, { done: 'x' }, { act: 7 }, { n: -2 }]); }
  else { o.extra = pick(r, [1, 'a', {}]); o.done = [...new Set(done)]; }
  return o;
};

// ---- 全套比對：回傳第一個不同（沒有＝null）；quick＝突變測試用的輕量版 ----
export function compareAll(lab, M, { quick = false } = {}) {
  const I = makeImpl(M), r = mulberry32(20261045), f = quick ? .15 : 1;
  const tb = J(lab.table()), ti = J(I.table());
  if (tb !== ti) return `表 ≠：${tb.slice(0, 120)}｜${ti.slice(0, 120)}`;
  if (J(lab.empty()) !== J(I.empty())) return 'emptyCms ≠';
  for (let k = 0, n = (20000 * f) | 0; k < n; k++) {
    const a = seedOf(r), b = k % 3 ? (r() * 4000) | 0 : -((r() * 1e6) | 0), c = r() < .8 ? 3850 : (r() * 1e9) | 0, x = lab.hash(a, b, c), y = I.hash(a, b, c);
    if (!Object.is(x, y)) return `cmsHash(${a},${b},${c}) 實驗線 ${x}｜本線 ${y}`;
  }
  for (let k = 0, n = (6000 * f) | 0; k < n; k++) {
    const s = seedOf(r), rk = (r() * 31) | 0, nn = (r() * 60) | 0, done = randDone(r), x = J(lab.offers(s, rk, nn, done)), y = J(I.offers(s, rk, nn, done));
    if (x !== y) return `cmsOffers(seed ${s}、等級 ${rk}、輪次 ${nn}、完成 ${done}) 實驗線 ${x}｜本線 ${y}`;
  }
  for (let k = 0, n = (1500 * f) | 0; k < n; k++) {
    const raw = randRaw(r), a = J(lab.load(raw)), b = J(I.load(raw));
    if (a !== b) return `cmsLoad(${J(raw)}) 實驗線 ${a}｜本線 ${b}`;
    const st = randState(r, r() < .6), x = J(lab.save(JSON.parse(J(st)))), y = J(I.save(JSON.parse(J(st))));
    if (x !== y) return `cmsSave(${J(st)}) 實驗線 ${x}｜本線 ${y}`;
  }
  for (let k = 0, n = (4000 * f) | 0; k < n; k++) {
    const st = randState(r, r() < .4), c = { diff: pick(r, [0, 1, 2, 3]), rankIdx: (r() * 12) | 0, pop: pick(r, [0, 50, 51, 300, 2000, (r() * 500) | 0]), seed: seedOf(r), day: 1 + ((r() * 800) | 0) }, i = pick(r, [0, 1, 2, 3, -1, 5]);
    const x = J(lab.accept(st, i, c)), y = J(I.accept(st, i, c));
    if (x !== y) return `cmsAccept(${J(st)}、第 ${i} 張、${J(c)}) 實驗線 ${x}｜本線 ${y}`;
    const d1 = J(lab.drop(st)), d2 = J(I.drop(st));
    if (d1 !== d2) return `cmsDrop(${J(st)}) 實驗線 ${d1}｜本線 ${d2}`;
  }
  for (let k = 0, n = (500 * f) | 0; k < n; k++) {   // 連推 40 天：逐天比狀態、資金、完成／過期
    let sb = randState(r, true), si = JSON.parse(J(sb)), money = 0, moneyI = 0;
    const base = randDaily(r, sb);
    for (let d = 0; d < 40; d++) {
      const x = { ...randDaily(r, sb), diff: base.diff }; x.day = sb.st + d * (r() < .2 ? 7 : 1) + (r() < .3 ? 60 : 0);
      if (r() < .5) { x.steelUsed = 4; x.tradeGold = 50; x.cityHappy = .72; }
      if (r() < .25) { const c = CM.CMS_BY_ID385[sb.act]; if (c) x.day = sb.st + c.days - (r() < .5 ? 1 : 0); }   // 剛好到期（期末驗收、過期的 >= 與 > 邊界）
      if (r() < .2) { const c = CM.CMS_BY_ID385[sb.act]; if (c?.type === 'acc') { sb.acc = c.target - (c.src === 'steel' ? x.steelUsed : x.tradeGold); si.acc = sb.acc; } }   // 累計剛好加到目標（>= 與 > 的邊界）
      const a = lab.daily(sb, x), b = I.daily(si, x);
      if (J(a) !== J(b)) return `cmsDaily 第 ${d} 天（${J(sb)}、${J(x)}）實驗線 ${J(a)}｜本線 ${J(b)}`;
      sb = a.cms; si = b.cms; money += a.money; moneyI += b.money;
      if (!sb.act && r() < .5) { sb = randState(r, true); si = JSON.parse(J(sb)); }
    }
    if (money !== moneyI) return `連推 40 天的獎金合計 ${money}｜${moneyI}`;
  }
  return null;
}

// ---- 突變 ----
const LAB_MUTANTS = [
  ['表：steel40 的獎金 1500→1501', 'table', 'bonus:1500, minRank:4', 'bonus:1501, minRank:4'],
  ['表：happy70 的期限 90→89', 'table', "type:'hold', src:'happy', target:.70, holdN:30, days:90", "type:'hold', src:'happy', target:.70, holdN:30, days:89"],
  ['表：ct_fuel80 的最低等級 5→4', 'table', 'target:80, days:120, bonus:3000, minRank:5', 'target:80, days:120, bonus:3000, minRank:4'],
  ['表：trade1200 的目標 1200→1201', 'table', "target:1200, days:90", "target:1201, days:90"],
  ['雜湊：常數 374761393→374761394', 'hash', '374761393', '374761394'],
  ['雜湊：最後的位移 h>>>16→h>>>15', 'hash', 'h^=h>>>16;', 'h^=h>>>15;'],
  ['三選一：鹽 3850→3851', 'offers', ',3850)', ',3851)'],
  ['三選一：輪次係數 31→32', 'offers', 'cms385.n*31+t', 'cms385.n*32+t'],
  ['三選一：重抽上限 60→3', 'offers', 't<60', 't<3'],
  ['三選一：不排除完成過的科技型', 'offers', "&&!(c.type==='tech'&&cms385.done.includes(c.id))", ''],
  ['三選一：不夠三條就全給 ≤3→<3', 'offers', 'if(elig.length<=3)', 'if(elig.length<3)'],
  ['三選一：等級門檻 +1 少一級', 'offers', 'rankIdx+1>=c.minRank', 'rankIdx>=c.minRank'],
  ['存檔：零狀態也落欄位', 'save', 'if(!c.act&&!c.n&&!c.done.length&&!c.acc&&!c.hold&&!c.st)return null;', ''],
  ['存檔：漏存輪次', 'save', ',n:c.n,done', ',done'],
  ['讀檔：不擋進行中已在完成清單', 'load', 'if(act!==\'\'&&seen[act])return emptyCms385();', ''],
  ['讀檔：不擋完成清單重複', 'load', '||seen[d2])return', ')return'],
  ['讀檔：進行中的開始日可以是 0', 'load', 'if(act!==\'\'&&o.st<1)return emptyCms385();', ''],
  ['讀檔：小數也算整數', 'load', '!Number.isInteger(v)||v<0', 'v<0'],
  ['讀檔：負數也收', 'load', '||v<0)return', ')return'],
  ['讀檔：未知的進行中 id 不棄用', 'load', "(act!==''&&!CMS_BY_ID385[act])", 'false'],
  ['接單：人口門檻 <=50→<50', 'accept', 'pop<=50', 'pop<50'],
  ['接單：等級門檻 <3→<2', 'accept', 'rankIdx+1<3', 'rankIdx+1<2'],
  ['接單：沙盒也能接', 'accept', 'diff===3||cms385.act', 'cms385.act'],
  ['接單：已有進行中也能接', 'accept', 'diff===3||cms385.act||', 'diff===3||'],
  ['接單：不歸零累計', 'accept', 'cms385.acc=0;cms385.hold=0;', 'cms385.hold=0;'],
  ['接單：開始日不是今天', 'accept', 'cms385.st=day;', 'cms385.st=day+1;'],
  ['放棄：輪次不 +1', 'drop', 'cms385.n++;', ''],
  ['放棄：不歸零連續天數', 'drop', 'cms385.acc=0;cms385.hold=0;cms385.n++;', 'cms385.acc=0;cms385.n++;'],
  ['結算：沙盒也結算', 'daily', 'if(diff!==3&&cms385.act){', 'if(cms385.act){'],
  ['結算：累計鋼材改成不加', 'daily', "cAct385.src==='steel'?steelUsed:", "cAct385.src==='steel'?0:"],
  ['結算：糧食出口改讀運量', 'daily', "cAct385.src==='trade'?tradeGold:0", "cAct385.src==='trade'?transitRidership:0"],
  ['結算：連續天數沒中斷（不歸零）', 'daily', 'cms385.hold+1:0;}', 'cms385.hold+1:cms385.hold;}'],
  ['結算：幸福不取 2 位小數', 'daily', 'Math.round(cityHappy*100)/100', 'cityHappy'],
  ['結算：連續判定 >=→>', 'daily', 'v385>=cAct385.target', 'v385>cAct385.target'],
  ['結算：累計判定 >=→>', 'daily', 'cms385.acc>=cAct385.target', 'cms385.acc>cAct385.target'],
  ['結算：連續天數判定 >=→>', 'daily', 'cms385.hold>=cAct385.holdN', 'cms385.hold>cAct385.holdN'],
  ['結算：期末驗收提早一天', 'daily', 'el385>=cAct385.days&&stockV385', 'el385>=cAct385.days-1&&stockV385'],
  ['結算：庫存判定 >=→>', 'daily', 'stockV385>=cAct385.target', 'stockV385>cAct385.target'],
  ['結算：科技型不看完成清單', 'daily', "cAct385.type==='tech'?hasTech343(cAct385.src)", "cAct385.type==='tech'?false"],
  ['結算：獎金加倍', 'daily', 'money+=cAct385.bonus;', 'money+=cAct385.bonus*2;'],
  ['結算：過期判定 >=→>', 'daily', 'el385>=cAct385.days){', 'el385>cAct385.days){'],
  ['結算：完成不 +1 輪次', 'daily', 'cms385.done.push(cAct385.id);cms385.act=\'\';cms385.st=0;cms385.acc=0;cms385.hold=0;cms385.n++;', 'cms385.done.push(cAct385.id);cms385.act=\'\';cms385.st=0;cms385.acc=0;cms385.hold=0;'],
  ['結算：完成清單重複照記', 'daily', 'if(cms385.done.indexOf(cAct385.id)<0)cms385.done.push', 'cms385.done.push'],
  ['結算：過期不 +1 輪次', 'daily', "toast('📋 委託過期：'+cAct385.nm,'bad'); // 失敗不毀城：零城市副作用（場景 lose 先例）\n        cms385.act='';cms385.st=0;cms385.acc=0;cms385.hold=0;cms385.n++;", "toast('📋 委託過期：'+cAct385.nm,'bad'); // 失敗不毀城：零城市副作用（場景 lose 先例）\n        cms385.act='';cms385.st=0;cms385.acc=0;cms385.hold=0;"],
  ['結算：過期的通知顏色 bad→gold', 'daily', "toast('📋 委託過期：'+cAct385.nm,'bad');", "toast('📋 委託過期：'+cAct385.nm,'gold');"],
  ['接單：通知的字改了', 'accept', "toast('📋 接受委託：'+c.nm)", "toast('📋 接受了委託：'+c.nm)"],
];
const MUTANTS_3D = [
  ['表：steel40 的獎金 1500→1501', "target: 40, days: 90, bonus: 1500", "target: 40, days: 90, bonus: 1501"],
  ['表：happy70 的期限 90→89', "target: .70, holdN: 30, days: 90", "target: .70, holdN: 30, days: 89"],
  ['表：ct_fuel80 的最低等級 5→4', "target: 80, days: 120, bonus: 3000, minRank: 5", "target: 80, days: 120, bonus: 3000, minRank: 4"],
  ['表：trade1200 的目標 1200→1201', "target: 1200, days: 90", "target: 1201, days: 90"],
  ['雜湊：改成 Math.imul（浮點吃低位的行為不見）', 'let h = (a * 374761393 + b * 668265263 + c * 2246822519) | 0;', 'let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 2246822519)) | 0;'],
  ['雜湊：常數 668265263→668265264', '668265263', '668265264'],
  ['雜湊：最後的位移 h>>>16→h>>>15', 'h ^= h >>> 16;', 'h ^= h >>> 15;'],
  ['三選一：鹽 3850→3851', 'cms.n * 31 + t, 3850)', 'cms.n * 31 + t, 3851)'],
  ['三選一：輪次係數 31→32', 'cms.n * 31 + t', 'cms.n * 32 + t'],
  ['三選一：重抽上限 60→3', 't < 60', 't < 3'],
  ['三選一：不排除完成過的科技型', " && !(c.type === 'tech' && cms.done.includes(c.id))", ''],
  ['三選一：不夠三條就全給 ≤3→<3', 'if (elig.length <= 3)', 'if (elig.length < 3)'],
  ['三選一：等級門檻少一級', 'rankIdx + 1 >= c.minRank', 'rankIdx >= c.minRank'],
  ['存檔：零狀態也落欄位', 'if (!c.act && !c.n && !c.done.length && !c.acc && !c.hold && !c.st) return null;', ''],
  ['存檔：漏存輪次', ', n: c.n, done: c.done.slice() };\n}\n// 37811', ', done: c.done.slice() } as never;\n}\n// 37811'],
  ['讀檔：不擋進行中已在完成清單', "if (act !== '' && seen[act]) return emptyCms();", ''],
  ['讀檔：不擋完成清單重複', '|| seen[d2]) return emptyCms();', ') return emptyCms();'],
  ['讀檔：進行中的開始日可以是 0', "if (act !== '' && o.st < 1) return emptyCms();", ''],
  ['讀檔：小數也算整數', '!Number.isInteger(v) || (v as number) < 0', '(v as number) < 0'],
  ['讀檔：負數也收', '|| (v as number) < 0) return emptyCms();', ') return emptyCms();'],
  ['讀檔：未知的進行中 id 不棄用', "(act !== '' && !CMS_BY_ID385[act])", 'false'],
  ['接單：人口門檻 <=50→<50', 'x.pop <= 50', 'x.pop < 50'],
  ['接單：等級門檻 <3→<2', 'x.rankIdx + 1 < 3', 'x.rankIdx + 1 < 2'],
  ['接單：沙盒也能接', 'x.diff === 3 || cms.act', 'cms.act'],
  ['接單：已有進行中也能接', 'x.diff === 3 || cms.act ||', 'x.diff === 3 ||'],
  ['接單：不歸零累計', 'cms.st = x.day; cms.acc = 0; cms.hold = 0;', 'cms.st = x.day; cms.hold = 0;'],
  ['接單：開始日不是今天', 'cms.st = x.day;', 'cms.st = x.day + 1;'],
  ['放棄：輪次不 +1', "cms.act = ''; cms.st = 0; cms.acc = 0; cms.hold = 0; cms.n++;\n  return c ?? null;", "cms.act = ''; cms.st = 0; cms.acc = 0; cms.hold = 0;\n  return c ?? null;"],
  ['放棄：不歸零連續天數', "cms.act = ''; cms.st = 0; cms.acc = 0; cms.hold = 0; cms.n++;\n  return c ?? null;", "cms.act = ''; cms.st = 0; cms.acc = 0; cms.n++;\n  return c ?? null;"],
  ['結算：沙盒也結算', 'if (x.diff === 3 || !cms.act) return null;', 'if (!cms.act) return null;'],
  ['結算：累計鋼材改成不加', "c.src === 'steel' ? x.steelUsed : c.src === 'trade'", "c.src === 'steel' ? 0 : c.src === 'trade'"],
  ['結算：糧食出口改讀運量', "c.src === 'trade' ? x.tradeGold : 0", "c.src === 'trade' ? x.transitRidership : 0"],
  ['結算：連續天數沒中斷（不歸零）', ': 0; }   // T394b', ': cms.hold; }   // T394b'],
  ['結算：幸福不取 2 位小數', 'Math.round(x.cityHappy * 100) / 100', 'x.cityHappy'],
  ['結算：連續判定 >=→>', 'v >= (c.target as number) ? cms.hold + 1', 'v > (c.target as number) ? cms.hold + 1'],
  ['結算：累計判定 >=→>', 'cms.acc >= (c.target as number)', 'cms.acc > (c.target as number)'],
  ['結算：連續天數判定 >=→>', 'cms.hold >= (c.holdN as number)', 'cms.hold > (c.holdN as number)'],
  ['結算：期末驗收提早一天', 'el >= c.days && stockV', 'el >= c.days - 1 && stockV'],
  ['結算：庫存判定 >=→>', 'stockV >= (c.target as number)', 'stockV > (c.target as number)'],
  ['結算：科技型不看完成清單', 'x.tech.includes(c.src)', 'false'],
  ['結算：獎金加倍', 'return { t: \'done\', id: c.id, bonus: c.bonus };', 'return { t: \'done\', id: c.id, bonus: c.bonus * 2 };'],
  ['結算：過期判定 >=→>', 'if (el >= c.days) {', 'if (el > c.days) {'],
  ['結算：完成不 +1 輪次', "cms.act = ''; cms.st = 0; cms.acc = 0; cms.hold = 0; cms.n++;\n    return { t: 'done'", "cms.act = ''; cms.st = 0; cms.acc = 0; cms.hold = 0;\n    return { t: 'done'"],
  ['結算：完成清單重複照記', 'if (cms.done.indexOf(c.id) < 0) cms.done.push(c.id);', 'cms.done.push(c.id);'],
  ['結算：過期不 +1 輪次', "cms.n++; return { t: 'expired'", "return { t: 'expired'"],
  ['通知：放棄的顏色改成金色', "case 'drop': return { text: '📋 放棄委託：' + c.nm, tone: 'bad' };", "case 'drop': return { text: '📋 放棄委託：' + c.nm, tone: 'gold' };"],
  ['通知：完成的字少了獎金', "'　+$' + bonus", "''"],
];

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d045-cms.json')), T = S.text, sha = s => crypto.createHash('sha256').update(s).digest('hex');
  const KEYS = ['table', 'byId', 'empty', 'state', 'hash', 'offers', 'save', 'load', 'accept', 'drop', 'daily', 'saveLine', 'loadLine', 'panel'];

  // ---- 1. 出處與接線要靠的事實 ----
  {
    const bad = [];
    if (S.source?.commit !== PINNED || S.source?.repo !== 'lijiabao1998/GlimmerTown-lab') bad.push('commit／repo');
    if (S.pieces?.length !== KEYS.length) bad.push(`片段 ${S.pieces?.length} 段（要 ${KEYS.length}）`);
    for (const k of KEYS) if (typeof T[k] !== 'string' || !T[k]) bad.push(`缺原文 ${k}`);
    const hashes = new Set(S.pieces.map(p => p.sha));
    for (const k of KEYS) if (T[k] && !hashes.has(sha(T[k]))) bad.push(`原文 ${k} 的 sha256 不在錨點記錄裡（被改過）`);
    // 接線要靠的事實：每天的結算沒有亂數、沒有現實時間、獎金是一次性的 money+=、沙盒不結算、只在有進行中的委託時動
    const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    const nocom = k => strip(T[k]);
    for (const k of ['hash', 'offers', 'daily', 'accept']) if (/Math\.random|\bR\(|Date\.now|performance\.now|new Date/.test(nocom(k))) bad.push(`${k} 碰了亂數或時鐘（實驗線註解說零亂數）`);
    if (!/if\(diff!==3&&cms385\.act\)\{/.test(nocom('daily')) || (nocom('daily').match(/money\+=/g) ?? []).length !== 1 || !/money\+=cAct385\.bonus;/.test(nocom('daily'))) bad.push('每天的結算：沙盒略過、只有一處 money+= 且是 bonus');
    if (/income|upkeep|fin\.|hist\./.test(nocom('daily'))) bad.push('每天的結算動到收入、維護費或歷史（實驗線說獎金不進當天收入）');
    if (!/steelUsed/.test(T.daily) || !/tradeGold/.test(T.daily) || !/transitRidership/.test(T.daily) || !/cityHappy/.test(T.daily) || !/hasTech343/.test(T.daily)) bad.push('每天的結算讀的輸入不是 steelUsed、tradeGold、transitRidership、cityHappy、科技完成清單');
    if (nocom('saveLine').trim() !== '{const c385=cmsSave385();if(c385)data.cms385=c385;}' || nocom('loadLine').trim() !== 'cms385=cmsLoad385(d.cms385);') bad.push('存檔、讀檔那兩行');
    for (const s of ['沙盒模式無委託', '城市等級 3 解鎖', '人口 50 解鎖', '三選一（第 ', '進行中', '放棄委託', '已完成委託', '剩餘天數', '接受 ']) if (!T.panel.includes(s)) bad.push(`面板原文缺「${s}」`);
    const src = read('src/sim/rules/commission.ts');
    if (/from\s+['"]three['"]|document\.|window\.|Math\.random|Date\.now|performance\.now|https?:\/\//.test(src.replace(/\/\/[^\n]*/g, ''))) bad.push('commission.ts 碰了 three／DOM／亂數／現實時間／外部網址');
    log(!bad.length, `D045 驗收 1：委託原文樣本——實驗線 ${PINNED.slice(0, 7)} 的 ${KEYS.length} 段原文逐段 sha256＝錨點記錄；每天的結算沒有亂數與時鐘、只有一處一次性的 money+=（bonus）、沙盒略過；存檔讀檔那兩行；面板的狀態文字；commission.ts 是純邏輯`,
      bad.join('；') || `${KEYS.length} 段（${S.pieces.map(p => p.name + ' ' + p.line).join('、')}）`);
    if (bad.length) return;
  }

  // ---- 2. 逐項＝實驗線 ----
  const lab = makeLab(T);
  {
    const t0 = Date.now(), d = compareAll(lab, CM);
    log(d === null, 'D045 驗收 1：委託逐項＝實驗線原文——11 條表逐欄、cmsHash 20,000 組（含負種子、≥ 2^31、浮點吃低位的大種子）、cmsOffers 6,000 個狀態、cmsLoad／cmsSave 1,500 組（≥ 700 個欄位：合法、各種畸形、單一破壞）、接單與放棄 4,000 組（難度 × 等級 × 人口 × 進行中 × 第幾張）、每天的結算 500 段 × 40 天（逐天狀態、資金、完成／過期；幸福 2 位小數、期末驗收、完成清單只收不重複）',
      d ?? `全等（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
    // 三選一確實會出到每一條、也有「不夠三條就全給」的區段（量得到的覆蓋）
    const seen = new Set(), r = mulberry32(7);
    for (let k = 0; k < 3000; k++) for (const id of lab.offers(seedOf(r), 6 + ((r() * 6) | 0), (r() * 40) | 0, [])) seen.add(id);
    const n = rk => lab.offers(1, rk, 0, []).length, lv3 = lab.offers(1, 2, 0, []).map(c => c).sort();
    log(seen.size === 11 && n(0) === 0 && n(1) === 1 && n(2) === 3 && n(5) === 3 && J(lv3) === J(['happy70', 'trade1200', 'transit150'].sort()),
      'D045 驗收 1：三選一的覆蓋——高等級的城 3,000 個種子×輪次把 11 條都出到過；Lv.1 沒有、Lv.2 只有 1 條（幸福 70%）、Lv.3 剛好三條全給（符合等級的不到四條就全給）、Lv.6 起從一批裡抽三條', `出到 ${seen.size}/11 條；Lv.1／2／3／6 ${n(0)}／${n(1)}／${n(2)}／${n(5)} 條；Lv.3 ${J(lv3)}`);
  }

  // ---- 3. 注入錯誤要紅 ----
  {
    const detected = [], missed = [];
    for (const [name, key, from, to] of LAB_MUTANTS) {
      try {
        const parts = T[key].split(from);
        if (parts.length !== 2) throw new Error(`突變錨點在 ${key} 裡不是剛好一處（${parts.length - 1} 處）`);
        let L2; try { L2 = makeLab({ ...T, [key]: parts.join(to) }); } catch (e) { throw new Error(`突變後載入失敗：${e.message}`); }
        const d = compareAll(L2, CM, { quick: true });
        if (d) detected.push(name); else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${e.message}`); }
    }
    log(!missed.length && detected.length === LAB_MUTANTS.length, `D045 驗收 8：實驗線原文單點突變 ${LAB_MUTANTS.length} 個（表的獎金／期限／等級、雜湊的常數、三選一的鹽與取模與重抽、存讀的每一種驗型、接單的門檻、放棄的輪次、結算的判定與邊界）都跟本線不同`,
      missed.length ? missed.slice(0, 4).join('；') : `${detected.length} 個都抓到`);
  }
  {
    const source = read('src/sim/rules/commission.ts'), detected = [], missed = [];
    for (const [name, from, to] of MUTANTS_3D) {
      try {
        const parts = source.split(from);
        if (parts.length !== 2) throw new Error(`突變錨點不是剛好一處（${parts.length - 1} 處）`);
        const M = await loadMod('src/sim/rules/commission.ts', [[from, to]]);
        const d = compareAll(lab, M, { quick: true });
        if (d) detected.push(name); else missed.push(`${name} 未抓到`);
      } catch (e) { missed.push(`${name}：${String(e.message).slice(0, 140)}`); }
    }
    log(!missed.length && detected.length === MUTANTS_3D.length, `D045 驗收 8：本線 commission.ts 原碼單點突變 ${MUTANTS_3D.length} 個（同上，加雜湊改 Math.imul）都使守衛轉紅`,
      missed.length ? missed.slice(0, 4).join('；') : `${detected.length} 個都抓到`);
  }
}

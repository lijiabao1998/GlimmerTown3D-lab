// D036 Node 守衛：資源開採（M）——資源圖、每天的抽取、耗損的存讀逐項＝實驗線原文（驗收 1、2 的公式半邊與突變）。實驗線頁面實跑、接線、存檔、介面：見 tools/unit-d036-live.mjs。
//   1. 出處：src/content/samples/d036-resource.json（tools/lab-resource.mjs 從實驗線 d23c18d 摘的原文）逐段 sha256＝錨點記錄；常數（240、3、2）跟本線相同；接線要靠的事實在原文裡成立
//      （讀檔以存檔的種子重建資源圖、油井只抽 RESOURCE＝1 的格、礦場只抽 ＝2 的格、抽取不看電、燃料與鋼材從當天的開採量分流、canPlace 要資源格）；resource.ts 沒有 three／DOM／亂數／現實時間／外部網址；
//   2. 逐項＝實驗線：實驗線原文在 Node `vm` 裡跟本線 resource.ts、count.ts 吃同一批輸入——
//      值噪聲：隨機種子 × 隨機點，makeNoise 的值逐位相等（Object.is，連 Float32 的捨入都比）；
//      資源圖：400 個種子（含負的、接近 2^31、很大的）× 72／108 兩種邊長 × 隨機地形（水、沙、草），genResource 的陣列逐格相等，油田與礦藏的格數記下來；
//      抽取：隨機小圖（邊長 6–24）、隨機資源、隨機耗損（0、剛好 240、239、238、超過 240）、隨機的建築（油井、礦場、其他種類）連推 3 天，逐天 owN、mnN、suppliesGain、oilGain、oreGain 與整張 RDEP 逐格相等；
//      讀檔還原：隨機亂寫的 rdep 欄位（缺、不是陣列、配對長度不夠、索引出界、負的、小數、字串、物件、NaN、超過 240……）還原出的 RDEP 逐格相等；
//      存檔：隨機的 RDEP，稀疏配對（依格索引、只存非零）與全空的 null 逐項相等。
//   3. 注入錯誤要紅：實驗線原文與本線原碼各改壞一批（兩個門檻、噪聲頻率與位移與格點數、種子的 xor、只鋪草地、礦先於油、噪聲權重、Float32、油礦速率與上限、不夾剩餘量、種類對不上也抽、耗盡的判斷差一、
//      供應品／油／礦各自不加或加錯、讀檔不夾 240、讀檔收 0、出界不擋、存檔連零也存）；每個突變指定「哪一項比對要紅」、只跑那一項：沒紅＝那一項比對沒管用；沒改的先核過全等。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { ROOT } from './cdp.mjs';
import { mulberry32 } from '../src/sim/rng.ts';
import * as RS from '../src/sim/rules/resource.ts';
import * as CT from '../src/sim/rules/count.ts';
import { loadMod } from './unit-d024.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;
const PINNED = 'd23c18d8e24ecb1f7b9223907484729eebe9b3a0';
export const KEY = {
  lerp: 'lerp', mulberry: 'mulberry32', noise: 'makeNoise', gen: 'genResource', stock: 'RESOURCE_STOCK', rates: 'OIL_RATE、ORE_RATE', extract: '主計數迴圈的開採', restore: '讀檔還原耗損',
  pair: '存檔的耗損配對', field: '存檔的 rdep 欄位', callLoad: '讀檔重建資源圖', callNew: '新圖重建資源圖', canOil: 'canPlace 油井', canMine: 'canPlace 礦場', fuelMade: '燃料', steelMade: '鋼材', supplies: '供應品',
};   // text 的鍵 → 樣本 pieces 的名字

export async function d036Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D036 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// ---- 實驗線那一邊：原文在 vm 裡 ----
function makeLab(T) {
  const ctx = vm.createContext({});
  vm.runInContext(`'use strict';let N=72,tiles=[],RESOURCE=new Uint8Array(0),RDEP=new Uint16Array(0),owN=0,mnN=0,suppliesGain=0,oilGain=0,oreGain=0;const idx=(x,y)=>y*N+x;
${T.lerp}
${T.mulberry}
${T.noise}
${T.stock}
${T.rates}
${T.gen}
const __ext=(b,x,y)=>{
${T.extract}
};
globalThis.__api={
  init:(n,ts)=>{N=n;tiles=ts;RESOURCE=new Uint8Array(n*n);RDEP=new Uint16Array(n*n);},
  noise:(sd,x,y)=>makeNoise(mulberry32(sd),64)(x,y),
  gen:sd=>{RESOURCE.fill(0);genResource(sd);return Array.from(RESOURCE);},
  setRes:(r,d)=>{RESOURCE=Uint8Array.from(r);RDEP=Uint16Array.from(d);},
  day:list=>{owN=0;mnN=0;suppliesGain=0;oilGain=0;oreGain=0;for(const [i,k] of list){__ext({k},i%N,(i/N)|0);}return {owN,mnN,suppliesGain,oilGain,oreGain,rdep:Array.from(RDEP)};},
  restore:d=>{${T.restore}
    return Array.from(RDEP);},
  pairs:rd=>{RDEP=Uint16Array.from(rd);const rdepArr=[];for(let i=0;i<N*N;i++){${T.pair}
}return rdepArr.length?rdepArr:null;},
};`, ctx, { filename: 'lab:resource' });
  const A = ctx.__api;
  return { init: (n, ts) => A.init(n, ts), noise: (sd, x, y) => A.noise(sd, x, y), gen: sd => A.gen(sd), setRes: (r, d) => A.setRes(r, d), day: list => JSON.parse(J(A.day(list))), restore: raw => A.restore({ rdep: raw }), pairs: rd => JSON.parse(J(A.pairs(rd))) };
}
// 本線那一邊：resource.ts、count.ts（突變時傳改壞的那份）
const portSide = (R, C) => ({
  noise: (sd, x, y) => R.makeNoise(mulberry32(sd), 64)(x, y),
  gen: (sd, n, ts) => Array.from(R.genResource(sd, { N: n, tiles: ts })),
  day: (n, ts, res, list) => { const w = { N: n, tiles: ts }, c = CT.emptyMoreCount(); for (const [i, k] of list) C.countMore(c, w, i, { k, lv: 1 }, 1, res); return { owN: c.owN, mnN: c.mnN, suppliesGain: c.suppliesGain, oilGain: c.oilGain, oreGain: c.oreGain, rdep: Array.from(res.rdep) }; },
  restore: (raw, nn) => Array.from(R.rdepOfSave(raw, nn)),
  pairs: rd => R.rdepPairs(Uint16Array.from(rd)),
});

// ---- 隨機輸入 ----
const SEEDS = (() => { const g = mulberry32(0x36a), o = [0, 1, -1, 5162026, 2147483647, -2147483648, 4294967295, 1e9, 3.7e9]; for (let i = 0; i < 391; i++) o.push(Math.floor((g() - .5) * (i % 3 ? 4e9 : 2e4))); return o; })();
const terrain = (n, k) => { const g = mulberry32(0x36b + k * 131); return Array.from({ length: n * n }, () => ({ t: g() < .25 ? 0 : g() < .5 ? 1 : 2 })); };
const POINTS = (() => { const g = mulberry32(0x36c), o = []; for (let i = 0; i < 600; i++) o.push([g() * 80 - 4, g() * 80 - 4]); return o; })();
function dayCase(k) {
  const g = mulberry32(0x36d + k * 977), ri = n => Math.floor(g() * n), r = () => g();
  const n = 6 + ri(19), nn = n * n, tiles = Array.from({ length: nn }, () => ({ t: 2 })), resource = new Uint8Array(nn), rdep = new Uint16Array(nn);
  for (let i = 0; i < nn; i++) { const q = r(); resource[i] = q < .3 ? 1 : q < .55 ? 2 : 0; const p = r(); rdep[i] = p < .5 ? 0 : p < .6 ? 240 : p < .7 ? 239 : p < .8 ? 238 : p < .85 ? 241 + ri(50) : ri(240); }
  const list = [];
  for (let i = 0; i < nn; i++) { const q = r(); if (q < .35) list.push([i, 49]); else if (q < .7) list.push([i, 50]); else if (q < .8) list.push([i, 3]); else if (q < .85) list.push([i, 117]); }
  for (let i = list.length - 1; i > 0; i--) { const j = ri(i + 1); [list[i], list[j]] = [list[j], list[i]]; }   // 迴圈的順序不影響結果（每格只被自己的井動）：洗亂了也要一樣
  return { n, tiles, resource, rdep, list, days: 3 };
}
const GARBAGE = [undefined, null, 5, 'x', {}, [], [[]], [[1]], [[1, 2]], [[0, 5], [3, 7]], [['5', '7']], [[1.9, 2.9]], [[-1, 5]], [[3, -4]], [[3, 0]], [[1e9, 5]], [[3, 1e9]], [[3, 241]], [[3, 65536]], ['57'], [{ 0: 5, 1: 7, length: 2 }], [[NaN, 5]], [[3, NaN]],
  [[true, 4]], [[{}, 4]], [[[1], 4]], [['a', 'b']], [null, [4, 6]], [[4, 6, 99]], [[4]], [[4, 6], [4, 9]], [[4, 9], [4, 3]], [[0, 1], [143, 239], [144, 240], [145, 241]], 'abc', 12, true];
function restoreCases() {
  const g = mulberry32(0x36e), ri = n => Math.floor(g() * n), out = GARBAGE.map(v => [v, 12]);
  for (let k = 0; k < 300; k++) {
    const nn = 6 + ri(40), arr = [];
    for (let q = 0, m = ri(12); q < m; q++) { const t = ri(9); arr.push(t === 0 ? [ri(nn), ri(300)] : t === 1 ? [ri(nn + 5) - 2, ri(300) - 20] : t === 2 ? [ri(nn) + .5, ri(300) + .5] : t === 3 ? [String(ri(nn)), String(ri(300))] : t === 4 ? [ri(nn)] : t === 5 ? null : t === 6 ? 'x' : t === 7 ? [ri(nn), 1e6] : [ri(nn), ri(240), 7]); }
    out.push([arr, nn]);
  }
  return out;
}
const RESTORE = restoreCases();
const PAIRS = (() => { const g = mulberry32(0x36f), ri = n => Math.floor(g() * n), o = [[0, 0, 0, 0], [0, 240, 0, 1]]; for (let k = 0; k < 120; k++) { const n = 4 + ri(30), a = Array.from({ length: n * n }, () => ri(5) ? 0 : ri(241)); o.push(a); } return o; })();

// 一份實驗線＋一份本線，逐項比。回傳第一個不同（沒有＝null）。only＝只比哪一項（突變用）
function compare(lab, port, only = null) {
  if (!only || only === 'noise') for (let i = 0; i < SEEDS.length; i += 4) for (const [x, y] of POINTS.slice(0, 40)) { const a = lab.noise(SEEDS[i], x, y), b = port.noise(SEEDS[i], x, y); if (!Object.is(a, b)) return `噪聲 種子 ${SEEDS[i]} (${x},${y})：實驗線 ${a} 本線 ${b}`; }
  if (!only || only === 'gen') for (const [n, k] of [[72, 0], [72, 1], [108, 2]]) {
    const ts = terrain(n, k); lab.init(n, ts);
    for (let i = 0; i < SEEDS.length; i++) { if (n === 108 && i % 3) continue; const a = lab.gen(SEEDS[i]), b = port.gen(SEEDS[i], n, ts); for (let q = 0; q < a.length; q++) if (a[q] !== b[q]) return `資源圖 種子 ${SEEDS[i]} 邊長 ${n} 第 ${q} 格：實驗線 ${a[q]} 本線 ${b[q]}`; }
  }
  if (!only || only === 'ext') for (let c = 0; c < 400; c++) {
    const { n, tiles, resource, rdep, list, days } = dayCase(c);
    lab.init(n, tiles); lab.setRes(resource, rdep);
    const res = { resource, rdep: Uint16Array.from(rdep) };
    for (let d = 0; d < days; d++) { const a = lab.day(list), b = port.day(n, tiles, res, list); if (J(a) !== J(b)) return `抽取 案例 ${c} 第 ${d + 1} 天：實驗線 ${J(a).slice(0, 120)} 本線 ${J(b).slice(0, 120)}`; }
  }
  if (!only || only === 'rest') for (let c = 0; c < RESTORE.length; c++) { const [raw, nn] = RESTORE[c], N2 = Math.max(1, Math.round(Math.sqrt(nn))); lab.init(N2, []); const a = lab.restore(raw), b = port.restore(raw, N2 * N2); if (J(a) !== J(b)) return `讀檔還原 案例 ${c}（${J(raw)?.slice(0, 80)}）：實驗線 ${J(a).slice(0, 80)} 本線 ${J(b).slice(0, 80)}`; }
  if (!only || only === 'pairs') for (let c = 0; c < PAIRS.length; c++) { const rd = PAIRS[c], N2 = Math.round(Math.sqrt(rd.length)); lab.init(N2, []); const a = lab.pairs(rd), b = port.pairs(rd); if (J(a) !== J(b)) return `存檔配對 案例 ${c}：實驗線 ${J(a)?.slice(0, 80)} 本線 ${J(b)?.slice(0, 80)}`; }
  return null;
}
const edit = (t, a, b) => { if (t.split(a).length !== 2) throw new Error(`錨點要剛好一處：${a.slice(0, 50)}（${t.split(a).length - 1} 處）`); return t.replace(a, b); };

async function guards(log) {
  const S = JSON.parse(read('src/content/samples/d036-resource.json')), T = S.text;
  const sha = s => crypto.createHash('sha256').update(s).digest('hex');
  const src = read('src/sim/rules/resource.ts');

  // ---- 1. 出處與接線要靠的事實 ----
  {
    const bad = [];
    if (S.source?.commit !== PINNED) bad.push(`出處不是 ${PINNED.slice(0, 7)}：${S.source?.commit}`);
    const byName = Object.fromEntries(S.pieces.map(p => [p.name, p]));
    for (const [k, name] of Object.entries(KEY)) { const p = byName[name]; if (!p) bad.push(`缺 ${name}`); else if (sha(T[k]) !== p.sha) bad.push(`${name} 的 sha256 跟錨點記錄不同`); }
    if (S.pieces.length !== Object.keys(KEY).length) bad.push(`樣本 ${S.pieces.length} 段、守衛認得 ${Object.keys(KEY).length} 段`);
    const has = (k, s) => { if (!T[k].includes(s)) bad.push(`${KEY[k]} 裡沒有「${s.slice(0, 60)}」`); };
    has('gen', 'makeNoise(mulberry32(sd^0x7c2f19),64)'); has('gen', 'makeNoise(mulberry32(sd^0x1a4d63),64)');
    has('gen', 'if(t===1||t===2){'); has('gen', 'if(noiOil(x*.045,y*.045)>.74)r=1;'); has('gen', 'else if(noiOre(x*.05+50,y*.05+50)>.74)r=2;');
    has('extract', 'if(RESOURCE[oi]===1&&RDEP[oi]<RESOURCE_STOCK){'); has('extract', 'const ext=Math.min(OIL_RATE,RESOURCE_STOCK-RDEP[oi]);'); has('extract', 'RDEP[oi]+=ext;suppliesGain+=ext;oilGain+=ext;');
    has('extract', 'if(RESOURCE[mi]===2&&RDEP[mi]<RESOURCE_STOCK){'); has('extract', 'const ext=Math.min(ORE_RATE,RESOURCE_STOCK-RDEP[mi]);'); has('extract', 'RDEP[mi]+=ext;suppliesGain+=ext;oreGain+=ext;');
    if (/\bb\.pw\b/.test(T.extract)) bad.push('抽取讀了 b.pw（本線的抽取不看電：接線的前提變了）');
    if (/\bR\(\)|\bri\(/.test((T.extract + T.gen).replace(/\/\/.*$/gm, ''))) bad.push('資源圖或抽取用了全域亂數 R()／ri()（接線的前提變了）');
    has('restore', 'if(ri140>=0&&ri140<N*N&&amt>0)RDEP[ri140]=Math.min(amt,RESOURCE_STOCK);'); has('restore', 'const ri140=pair[0]|0,amt=pair[1]|0;'); has('restore', 'if(!Array.isArray(pair)||pair.length<2)continue;');
    has('pair', 'rdepArr.push([i,RDEP[i]])'); has('callLoad', 'genResource(seed);');
    has('canOil', 'RESOURCE[idx(x,y)]!==1'); has('canMine', 'RESOURCE[idx(x,y)]!==2');
    has('fuelMade', 'Math.min(oilGain,'); has('steelMade', 'Math.min(oreGain,'); has('supplies', 'suppliesGain-fuelMade-steelMade');
    const num = (s, re) => { const m = re.exec(s); return m ? +m[1] : NaN; };
    if (RS.RESOURCE_STOCK !== num(T.stock, /RESOURCE_STOCK=(\d+)/)) bad.push('RESOURCE_STOCK 不同');
    if (RS.OIL_RATE !== num(T.rates, /OIL_RATE=(\d+)/) || RS.ORE_RATE !== num(T.rates, /ORE_RATE=(\d+)/)) bad.push('OIL_RATE／ORE_RATE 不同');
    const code = src.replace(/\/\/.*$/gm, '');
    for (const bannedRe of [/from 'three'/, /document\./, /window\./, /Math\.random/, /Date\.now/, /performance\.now/, /https?:\/\//]) if (bannedRe.test(code)) bad.push(`resource.ts 有 ${bannedRe}`);
    log(!bad.length, `D036 資源原文：實驗線 ${PINNED.slice(0, 7)} 的 ${S.pieces.length} 段（lerp、mulberry32、makeNoise、genResource、三個常數、主計數迴圈的抽取、讀檔還原耗損、存檔的配對與欄位、genResource 的兩個呼叫處、canPlace 的資源格、燃料／鋼材／供應品三行）逐段 sha256＝錨點記錄；常數跟本線相同；接線要靠的事實在原文裡成立；resource.ts 是純函式`,
      bad.slice(0, 6).join('；') || `${S.pieces.length} 段、行號 ${S.pieces.map(p => p.line).sort((a, b) => a - b)[0]}–${S.pieces.map(p => p.endLine).sort((a, b) => b - a)[0]}；RESOURCE_STOCK＝${RS.RESOURCE_STOCK}、油 ${RS.OIL_RATE}／天、礦 ${RS.ORE_RATE}／天`);
  }

  // ---- 2. 逐項＝實驗線 ----
  const lab0 = makeLab(T), port0 = portSide(RS, CT);
  {
    const d = compare(lab0, port0);
    let oil = 0, ore = 0, maps = 0;
    for (const [n, k] of [[72, 0], [72, 1]]) { const ts = terrain(n, k); for (const sd of SEEDS) { const r = port0.gen(sd, n, ts); maps++; for (const v of r) { if (v === 1) oil++; else if (v === 2) ore++; } } }
    let wellDays = 0, extracted = 0, exhausted = 0;
    for (let c = 0; c < 400; c++) { const { n, tiles, resource, rdep, list } = dayCase(c), res = { resource, rdep: Uint16Array.from(rdep) }; for (let dd = 0; dd < 3; dd++) { const b = port0.day(n, tiles, res, list); wellDays += b.owN + b.mnN; extracted += b.suppliesGain; } for (const [i, k] of list) if ((k === 49 || k === 50) && res.rdep[i] >= 240) exhausted++; }
    const bad = [];
    if (oil < 1000 || ore < 1000) bad.push(`資源格太少（油 ${oil}、礦 ${ore}）：比對沒有意義`);
    if (extracted < 5000 || exhausted < 50) bad.push(`抽取案例太單薄（抽了 ${extracted}、耗盡的井 ${exhausted}）`);
    log(d === null && !bad.length, `D036 驗收 1、2（公式半邊）：資源圖、抽取、讀檔還原、存檔配對逐項＝實驗線——實驗線原文在 vm 裡跟本線 resource.ts、count.ts 吃 ${SEEDS.length} 個種子（含負的、接近 2^31）× 72／108 邊長 × 隨機地形的 genResource、400 張隨機小圖連推 3 天的抽取（耗損 0、238、239、剛好 240、超過 240）、${RESTORE.length} 個亂寫的 rdep 欄位、${PAIRS.length} 張隨機耗損的存檔配對：噪聲值（Object.is）、資源陣列、逐天的計數與整張 RDEP、還原的陣列、配對逐項相等`,
      d ?? (bad.join('；') || `噪聲 ${SEEDS.length / 4 * 40} 點、資源圖 ${maps} 張（油田 ${oil} 格、礦藏 ${ore} 格）、抽取 ${wellDays} 口井日（抽了 ${extracted}、耗盡的井 ${exhausted} 口次）、還原 ${RESTORE.length}、配對 ${PAIRS.length}，全等`));
  }

  // ---- 3. 注入錯誤要紅 ----
  {
    const ok0 = compare(lab0, port0) === null;
    const lm = [   // [名稱, 鍵, from, to, 哪一項要紅]
      ['油的門檻 .74 變 .73', 'gen', 'noiOil(x*.045,y*.045)>.74', 'noiOil(x*.045,y*.045)>.73', 'gen'], ['礦的門檻 .74 變 .73', 'gen', 'noiOre(x*.05+50,y*.05+50)>.74', 'noiOre(x*.05+50,y*.05+50)>.73', 'gen'],
      ['油的頻率 .045 變 .046', 'gen', 'noiOil(x*.045,y*.045)', 'noiOil(x*.046,y*.045)', 'gen'], ['礦的頻率 .05 變 .051', 'gen', 'noiOre(x*.05+50,y*.05+50)', 'noiOre(x*.051+50,y*.05+50)', 'gen'],
      ['礦的位移 50 變 51', 'gen', 'noiOre(x*.05+50,y*.05+50)', 'noiOre(x*.05+51,y*.05+50)', 'gen'], ['油的種子 xor 差一位', 'gen', '0x7c2f19', '0x7c2f18', 'gen'], ['礦的種子 xor 差一位', 'gen', '0x1a4d63', '0x1a4d62', 'gen'],
      ['只鋪草地', 'gen', 'if(t===1||t===2){', 'if(t===2){', 'gen'], ['礦先於油', 'gen', 'if(noiOil(x*.045,y*.045)>.74)r=1;', 'if(noiOil(x*.045,y*.045)>.74&&!(noiOre(x*.05+50,y*.05+50)>.74))r=1;', 'gen'],
      ['噪聲權重 .1 變 .2', 'noise', '+.1*at(x*4.7+13,y*4.7+11)', '+.2*at(x*4.7+13,y*4.7+11)', 'noise'], ['平滑曲線 3−2t 變 2−t', 'noise', 'sx=xf*xf*(3-2*xf)', 'sx=xf*xf*(2-xf)', 'noise'],
      ['Float32 換普通陣列', 'noise', 'new Float32Array(G*G)', 'new Array(G*G)', 'noise'],
      ['油速率 3 變 4', 'rates', 'OIL_RATE=3', 'OIL_RATE=4', 'ext'], ['礦速率 2 變 3', 'rates', 'ORE_RATE=2', 'ORE_RATE=3', 'ext'], ['上限 240 變 239', 'stock', 'RESOURCE_STOCK=240', 'RESOURCE_STOCK=239', 'ext'],
      ['油井不夾剩餘量', 'extract', 'const ext=Math.min(OIL_RATE,RESOURCE_STOCK-RDEP[oi]);', 'const ext=OIL_RATE;', 'ext'], ['礦場不夾剩餘量', 'extract', 'const ext=Math.min(ORE_RATE,RESOURCE_STOCK-RDEP[mi]);', 'const ext=ORE_RATE;', 'ext'],
      ['油井在礦藏上也抽', 'extract', 'if(RESOURCE[oi]===1&&RDEP[oi]<RESOURCE_STOCK){', 'if(RESOURCE[oi]!==0&&RDEP[oi]<RESOURCE_STOCK){', 'ext'], ['礦場在油田上也抽', 'extract', 'if(RESOURCE[mi]===2&&RDEP[mi]<RESOURCE_STOCK){', 'if(RESOURCE[mi]!==0&&RDEP[mi]<RESOURCE_STOCK){', 'ext'],
      ['耗盡的判斷差一（≥ 239 就停）', 'extract', 'RDEP[oi]<RESOURCE_STOCK){', 'RDEP[oi]<RESOURCE_STOCK-1){', 'ext'], ['油井不加供應品', 'extract', 'RDEP[oi]+=ext;suppliesGain+=ext;oilGain+=ext;', 'RDEP[oi]+=ext;oilGain+=ext;', 'ext'],
      ['油井不加油', 'extract', 'RDEP[oi]+=ext;suppliesGain+=ext;oilGain+=ext;', 'RDEP[oi]+=ext;suppliesGain+=ext;', 'ext'], ['礦場加進油', 'extract', 'RDEP[mi]+=ext;suppliesGain+=ext;oreGain+=ext;', 'RDEP[mi]+=ext;suppliesGain+=ext;oilGain+=ext;', 'ext'],
      ['礦場不記耗損', 'extract', 'RDEP[mi]+=ext;suppliesGain+=ext;oreGain+=ext;', 'suppliesGain+=ext;oreGain+=ext;', 'ext'],
      ['讀檔不夾 240', 'restore', 'RDEP[ri140]=Math.min(amt,RESOURCE_STOCK);', 'RDEP[ri140]=amt;', 'rest'], ['讀檔收負的量', 'restore', 'amt>0)RDEP', 'amt>-5)RDEP', 'rest'],
      ['讀檔不檢查是不是陣列', 'restore', 'if(!Array.isArray(pair)||pair.length<2)continue;', 'if(!pair||pair.length<2)continue;', 'rest'], ['讀檔索引不取整', 'restore', 'const ri140=pair[0]|0', 'const ri140=+pair[0]', 'rest'], ['存檔連零也存', 'pair', 'if(RDEP[i])rdepArr', 'if(RDEP[i]>=0)rdepArr', 'pairs'],
    ];
    const pm = [
      ['油的門檻 .74 變 .73', RS_FILE('resource'), 'noiOil(x * .045, y * .045) > .74', 'noiOil(x * .045, y * .045) > .73', 'gen'], ['礦的門檻 .74 變 .73', RS_FILE('resource'), 'noiOre(x * .05 + 50, y * .05 + 50) > .74', 'noiOre(x * .05 + 50, y * .05 + 50) > .73', 'gen'],
      ['油的頻率 .045 變 .046', RS_FILE('resource'), 'noiOil(x * .045, y * .045)', 'noiOil(x * .046, y * .045)', 'gen'], ['礦的頻率 .05 變 .051', RS_FILE('resource'), 'noiOre(x * .05 + 50, y * .05 + 50)', 'noiOre(x * .051 + 50, y * .05 + 50)', 'gen'],
      ['礦的位移 50 變 51', RS_FILE('resource'), 'noiOre(x * .05 + 50, y * .05 + 50)', 'noiOre(x * .05 + 51, y * .05 + 50)', 'gen'], ['油的種子 xor 差一位', RS_FILE('resource'), '0x7c2f19', '0x7c2f18', 'gen'], ['礦的種子 xor 差一位', RS_FILE('resource'), '0x1a4d63', '0x1a4d62', 'gen'],
      ['只鋪草地', RS_FILE('resource'), 'if (t === 1 || t === 2) {', 'if (t === 2) {', 'gen'], ['礦先於油', RS_FILE('resource'), 'if (noiOil(x * .045, y * .045) > .74) r = RES_OIL;', 'if (noiOil(x * .045, y * .045) > .74 && !(noiOre(x * .05 + 50, y * .05 + 50) > .74)) r = RES_OIL;', 'gen'],
      ['噪聲權重 .1 變 .2', RS_FILE('resource'), '+ .1 * at(x * 4.7 + 13, y * 4.7 + 11)', '+ .2 * at(x * 4.7 + 13, y * 4.7 + 11)', 'noise'], ['平滑曲線 3−2t 變 2−t', RS_FILE('resource'), 'sx = xf * xf * (3 - 2 * xf)', 'sx = xf * xf * (2 - xf)', 'noise'],
      ['Float32 換普通陣列', RS_FILE('resource'), 'new Float32Array(G * G)', 'new Array(G * G)', 'noise'],
      ['油速率 3 變 4', RS_FILE('resource'), 'export const OIL_RATE = 3;', 'export const OIL_RATE = 4;', 'ext'], ['礦速率 2 變 3', RS_FILE('resource'), 'export const ORE_RATE = 2;', 'export const ORE_RATE = 3;', 'ext'], ['上限 240 變 239', RS_FILE('resource'), 'RESOURCE_STOCK = 240;', 'RESOURCE_STOCK = 239;', 'ext'],
      ['不夾剩餘量', RS_FILE('resource'), 'const ext = Math.min(kind === RES_OIL ? OIL_RATE : ORE_RATE, RESOURCE_STOCK - f.rdep[root]);', 'const ext = kind === RES_OIL ? OIL_RATE : ORE_RATE;', 'ext'],
      ['種類對不上也抽', RS_FILE('resource'), 'if (f.resource[root] !== kind || f.rdep[root] >= RESOURCE_STOCK) return 0;', 'if (f.resource[root] === 0 || f.rdep[root] >= RESOURCE_STOCK) return 0;', 'ext'],
      ['耗盡的判斷差一（≥ 239 就停）', RS_FILE('resource'), 'f.rdep[root] >= RESOURCE_STOCK) return 0;', 'f.rdep[root] >= RESOURCE_STOCK - 1) return 0;', 'ext'],
      ['油井不加供應品', RS_FILE('count'), 'c.suppliesGain += e; c.oilGain += e; } break; }', 'c.oilGain += e; } break; }', 'ext'], ['油井不加油', RS_FILE('count'), 'c.suppliesGain += e; c.oilGain += e; } break; }', 'c.suppliesGain += e; } break; }', 'ext'],
      ['礦場加進油', RS_FILE('count'), 'c.suppliesGain += e; c.oreGain += e; } break; }', 'c.suppliesGain += e; c.oilGain += e; } break; }', 'ext'], ['礦場抽油', RS_FILE('count'), 'extractWell(res, root, RES_ORE)', 'extractWell(res, root, RES_OIL)', 'ext'],
      ['讀檔不夾 240', RS_FILE('resource'), 'out[i] = Math.min(amt, RESOURCE_STOCK);', 'out[i] = amt;', 'rest'], ['讀檔收負的量', RS_FILE('resource'), 'amt > 0) out[i]', 'amt > -5) out[i]', 'rest'],
      ['讀檔不檢查是不是陣列', RS_FILE('resource'), 'if (!Array.isArray(pair) || pair.length < 2) continue;', 'if (!pair || pair.length < 2) continue;', 'rest'], ['讀檔索引不取整', RS_FILE('resource'), 'const i = pair[0] | 0,', 'const i = +pair[0],', 'rest'], ['存檔連零也存', RS_FILE('resource'), 'if (rdep[i]) out.push', 'if (rdep[i] >= 0) out.push', 'pairs'],
    ];
    const missed = [], names = [];
    for (const [name, key, from, to, only] of lm) {
      const T2 = { ...T, [key]: edit(T[key], from, to) }, lab = makeLab(T2);
      if (compare(lab, port0, only) === null) missed.push(`實驗線 ${name}`); names.push(`實驗線：${name}`);
    }
    for (const [name, file, from, to, only] of pm) {
      let R2 = RS, C2 = CT;
      try {
        if (file === 'resource') { R2 = await loadMod('src/sim/rules/resource.ts', [[from, to]]); C2 = await loadMod('src/sim/rules/count.ts', [], { './resource.ts': R2 }); }
        else C2 = await loadMod('src/sim/rules/count.ts', [[from, to]]);
      } catch (e) { missed.push(`本線「${name}」載入失敗 ${e.message}`); continue; }
      if (compare(lab0, portSide(R2, C2), only) === null) missed.push(`本線 ${name}`); names.push(`本線：${name}`);
    }
    log(ok0 && !missed.length, `D036 驗收 1、2（突變）：注入錯誤要紅——實驗線原文 ${lm.length} 個、本線原碼 ${pm.length} 個（兩個門檻、噪聲頻率與位移與權重與平滑曲線與 Float32、種子的 xor、只鋪草地、礦先於油、油礦速率與上限、不夾剩餘量、種類對不上也抽、耗盡判斷差一、供應品／油／礦各自不加或加錯、讀檔不夾 240／收 0／出界不擋／取整、存檔連零也存）；每個突變指定哪一項比對要紅、只跑那一項；沒改的先核過全等`,
      ok0 ? (missed.join('；') || `${names.length} 個全紅`) : '沒改的就不等（上一項已紅）');
  }
}
function RS_FILE(n) { return n; }

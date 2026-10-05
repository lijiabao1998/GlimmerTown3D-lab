// D043 Node 守衛：市長委託（T385）與政策實驗室（T504）——量缺口、鎖住、不搬。由 tools/unit.mjs 呼叫。
// 樣本 src/content/samples/d043-lab.json（tools/d043-lab.mjs 從實驗線 d23c18d 的頁面錄的）：
//   cms（回退設定）：起步城 8 個種子推 60 天、難度改一般、資金 5,000，control／accept0／accept1／accept2 各 200 天，另有 techC6 的兩座城各跑 ctlC6／accC6（把 C6 放進完成清單、接或不接）；
//   pol（T504）：同一批城核准六項政策（住宅稅 1.3×、宵禁、煙霧偵測、回收宣導、觀光推廣、夜市）120 天，off＝回退設定（政策立即生效，本線 D032 的做法）、on＝只把 T504 打開（政策生命週期）。
// 這裡驗：
//   1. 樣本的出處與形狀：實驗線 commit、探針原文、8 座城的碼雜湊、每筆的列數與欄數、原文摘錄 sha256；
//   2. T385 的原文事實：11 條委託的表（獎金 $1,000–3,200）、接單條件（非沙盒、沒有進行中的、城市等級 ≥ 3、人口 > 50）、三選一是 seed＋輪次的純函式雜湊（零亂數）、每天結算只讀已算好的值、
//      完成才一次性 money += bonus、過期只發提示（沒有罰款）、沒接單＝零模擬副作用；
//   3. T385 量到的：起步城 8 個種子 × 三張委託 × 200 天，24 次接單**一張都沒完成**（幸福 70％×30 天、糧食出口、公共運量、鋼材、燃料庫存都不是起步城做得到的）、全部過期；
//      接單／過期對 資金、人口、幸福 逐日**零差別**（24 × 201 列）；完成的那一次（C6 先放進完成清單、接「學術網絡」）：隔天資金恰好 +$1,800、之後每天差別恆為 $1,800、人口與幸福零差別、完成清單 +1；
//   4. T504 的原文事實：本線的「立即生效」＝T504 關著的路徑（__noPolicy504 → 舊的立即套用）；打開時每天累計「行政量能」、除以執行天數、滿了才改 pol；六項政策的執行天數（3、4、14、10、8、5）；
//   5. T504 量到的：off 的六項在核准當天就生效；on 的生效日＝ceil(執行天數／行政量能)＝第 5、6、20、14、11、7 天（8 座城全一樣）；生效之後的值＝off 的、一路沒有被取消或回滾（120 天裡每項只改一次）；
//      資金差：8 座裡 5 座在第 30 天之後恆差 $278–286（延遲期間少付的政策費）、3 座因為延遲改變了起火與犯罪的亂數流、之後軌跡分岔（資金 ＋$68…＋$470、人口 ＋14…＋21）；
//   6. 本線的做法：setPolicy 立即生效、不記生命週期（跟 off 一樣）；src 沒有委託與政策生命週期的程式（註解不算）；
//   7. 摘要。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { loadCode } from '../src/io/save.ts';
import { setPolicy } from '../src/sim/edit.ts';
import { PROBE, CMS_COLS, POL_COLS, POLICIES, LAB_FNS, CMS_DAYS, POL_DAYS, d043Cities } from './d043-lab.mjs';
import { D011_LAB_COMMIT } from './unit-d011-build.mjs';
import { d038Plays } from './d038-cities.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify, sha = s => crypto.createHash('sha256').update(s).digest('hex');
const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');   // 註解不算
export const LIVE = {};
export async function d043Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D043 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}
const C = Object.fromEntries(CMS_COLS.map((c, i) => [c, i]));
const KEYS = POLICIES.map(([k]) => k);
// 鎖住的量（重錄樣本之後要連卡面一起改）
const LOCK = {
  bonuses: { steel40: 1500, steel80: 2500, trade1200: 1200, trade3000: 2200, transit150: 1000, transit400: 2000, happy70: 1000, happy80: 2000, techC6: 1800, ct_steel60: 3200, ct_fuel80: 3000 },
  implementationDays: { taxR: 3, curfew: 4, smokeDetect: 14, recycle: 10, tourPromo: 8, nightMarket: 5 },
  delays: [5, 6, 20, 14, 11, 7],
  capacity: 0.728,
  constantSeeds: ['5162026', '6162029', '7162032', '9162038', '12162047'],
  c6Seeds: ['5162026', '12162047'],
};
async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const S = JSON.parse(read('src/content/samples/d043-lab.json')), cities = d043Cities();
  const pieces = (() => { try { return JSON.parse(gunzipSync(Buffer.from(S.lab?.pieces ?? '', 'base64')).toString('utf8')); } catch { return []; } })();
  const P = Object.fromEntries(pieces.map(p => [p.name, p.src]));
  LIVE.S = S;

  // ---- 1. 出處與形狀 ----
  {
    const bad = [];
    if (S.source?.repo !== 'lijiabao1998/GlimmerTown-lab' || S.source?.commit !== D011_LAB_COMMIT) bad.push(`出處 ${S.source?.repo}@${S.source?.commit}`);
    if (S.source?.probe !== PROBE) bad.push('探針原文跟 tools/d043-lab.mjs 現在的不同（改了探針要重錄）');
    if (J(S.order) !== J(cities.map(c => c.id)) || J(S.cmsCols) !== J(CMS_COLS) || J(S.polCols) !== J(POL_COLS) || J(S.policies) !== J(POLICIES)) bad.push('城、欄位或政策清單跟現在的不同');
    for (const c of cities) {
      if (S.codeHash?.[c.id] !== fnv1a(c.code)) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同（重跑 tools/d043-lab.mjs）`);
      const m = S.cms?.[c.id];
      for (const k of ['control', 'accept0', 'accept1', 'accept2']) if (m?.[k]?.rows?.length !== CMS_DAYS + 1 || m[k].rows.some(r => r.length !== CMS_COLS.length)) bad.push(`cms ${c.id} ${k}：列數或欄數不對`);
      for (const k of ['off', 'on']) if (S.pol?.[c.id]?.[k]?.rows?.length !== POL_DAYS + 1 || S.pol[c.id][k].rows.some(r => r.length !== POL_COLS.length)) bad.push(`pol ${c.id} ${k}：列數或欄數不對`);
    }
    const names = [...LAB_FNS, 'CMS385', 'POLICY_OVERRIDES504', 'T385 daily'], meta = S.source?.pieces ?? [];
    for (const n of names) if (!P[n]) bad.push(`原文摘錄缺 ${n}`);
    for (const n of LAB_FNS) { const i = meta.findIndex(m => m.name === n); if (i < 0 || sha(P[n] ?? '') !== meta[i].sha) bad.push(`原文摘錄 ${n} 的 sha256 不符`); }
    log(!bad.length, `D043 驗收 1：樣本——實驗線 ${S.source?.commit?.slice(0, 7)}（${S.source?.version}）；起步城 8 個種子（碼雜湊＝本線現在產生的）；cms 每座 4 種接單方式 × ${CMS_DAYS + 1} 列、pol 每座 off／on × ${POL_DAYS + 1} 列；原文摘錄 ${pieces.length} 段`, bad.slice(0, 4).join('；') || `錄了 ${S.seconds} 秒`);
  }

  // ---- 2. T385 原文事實 ----
  {
    const bad = [], has = (name, re, what) => { if (!re.test(P[name] ?? '')) bad.push(`${name}：${what}`); };
    const tbl = [...(P.CMS385 ?? '').matchAll(/\{id:'([A-Za-z0-9_]+)',[^}]*?bonus:(\d+)/g)].map(m => [m[1], +m[2]]);
    if (J(Object.fromEntries(tbl)) !== J(LOCK.bonuses)) bad.push(`委託表 ${J(Object.fromEntries(tbl))} ≠ 鎖住的 ${J(LOCK.bonuses)}`);
    has('cmsAccept385', /if\(diff===3\|\|cms385\.act\|\|rankIdx\+1<3\|\|pop<=50\)return false;/, '接單條件（沙盒、已有進行中的、城市等級 < 3、人口 ≤ 50 都不行）');
    has('cmsOffers385', /cmsHash385\(seed\|0,cms385\.n\*31\+t,3850\)/, '三選一＝seed 與輪次的純函式雜湊');
    if (/\bR\(\)|\bri\(/.test(P.cmsOffers385 ?? '')) bad.push('cmsOffers385 用了亂數');
    const raw = P['T385 daily'] ?? '', d = strip(raw);
    if (!/未接單=零模擬副作用/.test(raw)) bad.push('每日結算：註解沒有「未接單=零模擬副作用」');
    if ((d.match(/money\s*[+\-]?=/g) ?? []).length !== 1 || !/money\+=cAct385\.bonus;/.test(d)) bad.push('每日結算：資金只應有一處 money+=bonus（註解不算）');
    if (!/委託過期：/.test(d) || /else if\(el385>=cAct385\.days\)\{[^}]*money/.test(d)) bad.push('每日結算：過期只該發提示、不動資金');
    if (/\bR\(\)|\bri\(/.test(d)) bad.push('每日結算用了亂數');
    log(!bad.length, 'D043 驗收 2：T385 原文事實——11 條委託的表（獎金＝$1,500／2,500／1,200／2,200／1,000／2,000／1,000／2,000／1,800／3,200／3,000）、接單條件、三選一是純函式雜湊（零亂數）、每天結算只讀已算好的值、完成才一次性 money += bonus、過期只發提示、沒接單零副作用', bad.join('；') || `${tbl.length} 條委託；資金只在完成時加一次`);
  }

  // ---- 3. T385 量到的 ----
  {
    const bad = [], info = [];
    let rowsN = 0;
    for (const id of S.order) {
      const m = S.cms[id], ctl = m.control.rows;
      for (const k of ['accept0', 'accept1', 'accept2']) {
        const r = m[k];
        if (r.acc !== true) bad.push(`${id} ${k}：沒接成（${r.acc}）`);
        if (J(r.offers) !== J(m.control.offers)) bad.push(`${id} ${k}：三選一跟 control 不同（應是純函式）`);
        const last = r.rows.at(-1);
        if (last[C.done] !== 0 || last[C.act] !== '' || last[C.n] !== 1) bad.push(`${id} ${k}（${r.offers[+k.slice(-1)]}）：200 天後完成清單 ${last[C.done]}、進行中「${last[C.act]}」、輪次 ${last[C.n]}（要：一張都沒完成、已過期、輪次 1）`);
        r.rows.forEach((row, i) => { rowsN++; if (row[C.money] !== ctl[i][C.money] || row[C.pop] !== ctl[i][C.pop] || row[C.happy] !== ctl[i][C.happy]) bad.push(`${id} ${k} 第 ${i} 天：資金／人口／幸福跟 control 不同`); });
      }
    }
    // 完成那一次：C6 先放進完成清單
    for (const id of LOCK.c6Seeds) {
      const a = S.cms[id].accC6, b = S.cms[id].ctlC6;
      if (!a || !b) { bad.push(`${id}：沒有 ctlC6／accC6`); continue; }
      if (a.acc !== true) bad.push(`${id} accC6 沒接成`);
      a.rows.forEach((row, i) => {
        const dm = Math.round((row[C.money] - b.rows[i][C.money]) * 100) / 100;
        if (i === 0) { if (dm !== 0) bad.push(`${id} 第 0 天資金差 ${dm}`); }
        else if (dm !== 1800) bad.push(`${id} 第 ${i} 天資金差 ${dm}（要恆為 1,800：完成的那一次一次性加獎金）`);
        if (row[C.pop] !== b.rows[i][C.pop] || row[C.happy] !== b.rows[i][C.happy]) bad.push(`${id} 第 ${i} 天人口或幸福不同`);
      });
      const z = a.rows.at(-1), y = b.rows.at(-1);
      if (z[C.done] !== 1 || y[C.done] !== 0 || z[C.n] !== 1) bad.push(`${id}：完成清單 ${z[C.done]}／${y[C.done]}、輪次 ${z[C.n]}`);
    }
    for (const id of S.order) if (!!S.cms[id].accC6 !== LOCK.c6Seeds.includes(id)) bad.push(`${id}：有沒有 techC6 的三選一跟鎖住的不同`);
    const offers = [...new Set(S.order.flatMap(id => S.cms[id].control.offers))].sort();
    LIVE.offers = offers;
    log(!bad.length, '【量到的缺口】D043 驗收 3：T385 量到的——起步城 8 種子 × 三張委託 × 200 天，24 次接單一張都沒完成（全過期）、接單與過期對資金、人口、幸福逐日零差別（24 × 201 列）；完成的那一次（C6 先放進完成清單、接「學術網絡」）：隔天資金恰好 ＋$1,800、之後每天差別恆為 $1,800、人口與幸福零差別、完成清單 ＋1',
      bad.slice(0, 4).join('；') || `${rowsN} 列對照零差別；出現過的委託 ${offers.join('、')}；C6 完成 ${LOCK.c6Seeds.join('、')}：＋$1,800 一次`);
  }

  // ---- 4. T504 原文事實 ----
  {
    const bad = [], has = (name, re, what) => { if (!re.test(P[name] ?? '')) bad.push(`${name}：${what}`); };
    has('policyApply504', /if\(window\.__noPolicy504\)\{[^}]*__mayorPolicyApply470A503\(k,value,opts\.reason\|\|''\)/, 'T504 關著＝走舊的立即套用（__mayorPolicyApply470A503）');
    has('policyApply504', /policyCreateProgram504\(\{kind:'policy'[^}]*implementationDays:meta\.implementationDays/, 'T504 打開＝建立執行計畫、帶執行天數');
    has('policyStep504', /p\.work=\(p\.work\|\|0\)\+admin\.capacity;p\.progress=p\.implementationDays\?clamp\(p\.work\/p\.implementationDays,0,1\):1;/, '每天累計行政量能、進度＝累計／執行天數');
    has('policyStep504', /if\(p\.progress>=\.999\)\{[^}]*policySetActual504\(p\.key,p\.target,'執行完成',p\.source\)/, '進度滿了才改 pol（policySetActual504）');
    has('policyAdminCapacity504', /clamp\(\.34\+staff\*\.42\+Math\.min\(\.18,admin\*\.045\)\+fiscal\*\.06,\.28,1\.12\)/, '行政量能的公式');
    const ovr = P.POLICY_OVERRIDES504 ?? '';
    for (const [k, n] of Object.entries(LOCK.implementationDays)) if (!new RegExp(`\\b${k}:\\{family:'[a-z]+',implementationDays:${n},`).test(ovr)) bad.push(`${k} 的 implementationDays 不是 ${n}`);
    log(!bad.length, 'D043 驗收 4：T504 原文事實——T504 關著（回退設定）時 policyApply504 走舊的立即套用（本線 D032 的做法）；打開時建立執行計畫，每天累計行政量能（.34＋人員 .42＋行政建築 ＋財政，.28–1.12）、除以執行天數，滿了才改 pol；六項政策的執行天數 3、4、14、10、8、5', bad.join('；') || '5 條原文事實＋6 個執行天數都在');
  }

  // ---- 5. T504 量到的 ----
  {
    const bad = [], info = [], K0 = 4;
    const constant = [], divergent = [];
    for (const id of S.order) {
      const on = S.pol[id].on.rows, off = S.pol[id].off.rows, cap = on[0][K0 + KEYS.length];
      if (cap !== LOCK.capacity) bad.push(`${id} 行政量能 ${cap}≠${LOCK.capacity}`);
      if (!S.pol[id].on.ok.every(Boolean) || !S.pol[id].off.ok.every(Boolean)) bad.push(`${id}：核准沒全成功`);
      // off：核准當天就生效（第 0 列的值＝核准後的值）
      KEYS.forEach((k, i) => { if (off[0][K0 + i] !== POLICIES[i][1]) bad.push(`${id} off ${k} 第 0 列 ${off[0][K0 + i]}（要立即生效＝${POLICIES[i][1]}）`); });
      // on：第 0 列還是舊值；生效日＝ceil(執行天數／量能)；之後一路不變、只改一次
      const delays = KEYS.map((k, i) => on.findIndex(r => r[K0 + i] === POLICIES[i][1])), expect = KEYS.map(k => Math.ceil(LOCK.implementationDays[k] / cap - 1e-9));
      if (J(delays) !== J(LOCK.delays) || J(delays) !== J(expect)) bad.push(`${id} 生效日 ${J(delays)}（鎖住 ${J(LOCK.delays)}；ceil(天數／量能)＝${J(expect)}）`);
      KEYS.forEach((k, i) => { const changes = on.filter((r, j) => j && r[K0 + i] !== on[j - 1][K0 + i]).length; if (changes !== 1) bad.push(`${id} on ${k} 在 120 天裡改了 ${changes} 次（要 1 次：一路沒有取消或回滾）`); if (on.at(-1)[K0 + i] !== off.at(-1)[K0 + i]) bad.push(`${id} ${k} 最後的值 on≠off`); });
      const d30 = on[30][1] - off[30][1], d120 = on[120][1] - off[120][1];
      (Math.abs(d120 - d30) < 0.02 && on[120][3] === off[120][3] && on[120][2] === off[120][2] ? constant : divergent).push([id, +d30.toFixed(2), +d120.toFixed(2), on[120][2] - off[120][2]]);
    }
    if (J(constant.map(q => q[0])) !== J(LOCK.constantSeeds)) bad.push(`第 30 天之後資金差恆定的城 ${J(constant.map(q => q[0]))}（鎖住 ${J(LOCK.constantSeeds)}）`);
    if (constant.some(q => q[2] < 277 || q[2] > 287)) bad.push(`恆定的資金差不在 $277–287：${J(constant)}`);
    if (divergent.length !== 3 || divergent.some(q => q[3] < 14 || q[3] > 21 || q[2] < 60 || q[2] > 480)) bad.push(`分岔的城 ${J(divergent)}（要 3 座、人口 ＋14…＋21、資金 ＋$60…＋$480）`);
    LIVE.t504 = { constant, divergent };
    log(!bad.length, '【量到的缺口】D043 驗收 5：T504 量到的——off（回退設定）六項政策核准當天生效；on 的生效日＝ceil(執行天數／行政量能 .728)＝第 5、6、20、14、11、7 天（8 座全一樣），生效後的值＝off 的、120 天裡每項只改一次（沒有取消、回滾、調整）；資金差：5 座第 30 天之後恆差 $278–286（延遲期間少付的政策費）、3 座因為延遲改變了起火與犯罪的亂數流、軌跡分岔（資金 ＋$68…＋$470、人口 ＋14…＋21）',
      bad.slice(0, 4).join('；') || `生效日 ${J(LOCK.delays)}；恆定 ${constant.map(q => `${q[0]} ${q[2]}`).join('、')}；分岔 ${divergent.map(q => `${q[0]} 資金 ${q[2]} 人口 ${q[3]}`).join('、')}`);
  }

  // ---- 6. 本線的做法 ----
  {
    const bad = [];
    const L = loadCode(d038Plays()[0].code, KT, vrank); if (!L.ok) throw new Error('讀不進 ' + L.error);
    const s = L.sim, before = JSON.stringify(Object.keys(s)), r = setPolicy(s, 'curfew', true);
    if (!r.ok || s.pol?.curfew !== true) bad.push(`setPolicy 宵禁：ok ${r.ok}、pol.curfew ${s.pol?.curfew}（本線要立即生效）`);
    if (JSON.stringify(Object.keys(s)) !== before) bad.push('setPolicy 多出了欄位（本線不記生命週期）');
    const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.ts$/.test(e.name) ? [path.join(d, e.name)] : []);
    const files = [...walk('src/sim'), ...walk('src/io'), ...walk('src/render')], re = /cms385|cmsAccept|CMS385|policyState504|implementationDays|policyLedger|policyAdminCapacity|policyStep504|p504\b/;
    for (const f of files) { const m = strip(read(f)).match(re); if (m) bad.push(`${f}：「${m[0]}」`); }
    log(!bad.length, `D043 驗收 6：本線的做法——setPolicy 立即生效（跟 T504 關著的路徑一樣）、不記生命週期；src/sim、src/io、src/render 的 ${files.length} 個檔裡沒有委託與政策生命週期的程式（註解不算；要做的時候這一條跟驗收 3、5 要一起改）`, bad.slice(0, 3).join('；') || `宵禁核准當天生效；${files.length} 個檔乾淨`);
  }

  // ---- 7. 摘要 ----
  {
    const t = LIVE.t504;
    log(true, 'D043 摘要（卡面引用）：委託（T385）與政策實驗室（T504）本線沒搬——', `委託：獎金 $1,000–3,200、完成才一次性入帳、其餘零模擬副作用；起步城 24 次接單 0 次完成；有的話差別就是一筆 $1,800 這樣的獎金。政策實驗室：政策生效晚 5–20 天（量能 .728）、生效後的值一樣；${t.constant.length}／${S.order.length} 座只剩一次性 $${Math.min(...t.constant.map(q => q[2]))}–${Math.max(...t.constant.map(q => q[2]))}`);
  }
}

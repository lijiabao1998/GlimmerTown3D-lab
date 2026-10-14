// D041 Node 守衛：緊急車輛（消防車、警車、救護車）——量缺口、鎖住、不搬。由 tools/unit.mjs 呼叫。
// 樣本 src/content/samples/d041-lab.json（tools/d041-lab.mjs 從實驗線 d23c18d 的頁面錄的；回退設定）：同一張碼讀進實驗線，用四種跑法各推一遍——
//   step＝GV.step（tick() 逐日，D026 對拍的基準）、noveh＝逐幀 advance（車隊配額 0）、veh＝逐幀 advance（預設車隊）、veh2＝veh 在全新頁面再跑一次。
// 這裡驗：
//   1. 樣本的出處與形狀：實驗線 commit、回退設定、探針原文、13 座城（V 系列 5 座有路網的城 × 30 天、起步城 8 個種子 × 120 天）的碼雜湊＝本線現在產生的、每組每天一列；實驗線原文摘錄（7 個函式＋GV.step 那一行）sha256 與樣本記的相同；
//   2. 實驗線的原文事實（摘錄文字）：車輛抵達就把旗標清掉（b.fire＝0、b.crime＝0、b.sick＝0）、車輛只在 advance（畫面幀）裡動、GV.step 只叫 tick()、每個遊戲日 DAYLEN＝0.9 車輛秒——
//      所以「車輛會改變模擬」是原文上的事實，不是猜的；
//   3. 本線＝實驗線逐日推進：V 系列 5 座城連推 30 天，每天的燃燒、犯罪、生病、廢棄、焦土的個數逐日逐座＝樣本的 step 組（本線沒有車，這一條證明差的只有車）；改壞本線災禍規則的副本要紅；
//   4. 逐幀迴圈本身不改模擬：noveh＝step（旗標、資金、人口逐日逐欄），只有起步城種子 12162047 例外（逐幀跑法在 120 天長跑偶爾分岔、有車沒車都會；原因沒查，卡面記）；veh2＝veh（V 系列逐位重現）；
//   5. 車輛的量（鎖）：V 系列的站（消防 4、警 3、救護 3，貼路才算 online）、車的上限（消防 3、警 2、救護 2）、30 天裡車處理的件數（V1 滅火 5、V1h 滅火 14、V2 處理犯罪 11、V3 治病 5、V4 犯罪 8＋治病 2）、
//      焦土 V1h 399→372（−6.8％，在雜訊裡：沒有消防車的 V2、V3 也差 −11％、＋14％）；起步城 8 個種子 × 120 天一輛車都沒出過（只有警察局、沒有罪案）；
//   6. 本線沒有車：src/sim 與 src/render 沒有車隊、派遣的程式（註解不算）；
//   7. 摘要：把量到的缺口寫成一行（卡面引用）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { ROOT } from './cdp.mjs';
import { fnv1a } from '../src/sim/rng.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { loadMod } from './unit-d024.mjs';
import { dayVariant } from './unit-d021.mjs';
import { PROBE, MODES, COLS, LAB_FNS, d041Cities } from './d041-lab.mjs';
import { vCities } from './d041-cities.mjs';
import { D011_LAB_COMMIT } from './unit-d011-build.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify, sha = s => crypto.createHash('sha256').update(s).digest('hex');
export const LIVE = {};
export async function d041Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D041 守衛跑到一半丟例外（沒跑完＝紅燈）', `${e.name}: ${e.message}｜` + (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}
const COL = Object.fromEntries(COLS.map((c, i) => [c, i]));
const FLAGS = [1, 2, 3, 4, 5];   // fire、crime、sick、ab、ruin
// 鎖住的量（重錄樣本之後要連卡面一起改）
const LOCK = {
  online: { V1: [4, 0, 0], V1h: [4, 0, 0], V2: [0, 3, 0], V3: [0, 0, 3], V4: [2, 2, 2] },
  maxVeh: { V1: [3, 0, 0], V1h: [3, 0, 0], V2: [0, 2, 0], V3: [0, 0, 2], V4: [2, 2, 2] },
  cures: { V1: [5, 0, 0], V1h: [14, 0, 0], V2: [0, 11, 0], V3: [0, 0, 5], V4: [0, 8, 2] },
  ruin: { V1h: [399, 372] },
  stepNotNoveh: ['evolve:12162047'],
};
async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const S = JSON.parse(read('src/content/samples/d041-lab.json')), cities = d041Cities();
  const pieces = (() => { try { return JSON.parse(gunzipSync(Buffer.from(S.lab?.pieces ?? '', 'base64')).toString('utf8')); } catch { return []; } })();
  const P = Object.fromEntries(pieces.map(p => [p.name, p.src]));
  LIVE.S = S;

  // ---- 1. 出處與形狀 ----
  {
    const bad = [];
    if (S.source?.repo !== 'lijiabao1998/GlimmerTown-lab' || S.source?.commit !== D011_LAB_COMMIT) bad.push(`出處 ${S.source?.repo}@${S.source?.commit}`);
    if (S.config !== 'fallback') bad.push(`設定 ${S.config}（要回退設定）`);
    if (S.source?.probe !== PROBE) bad.push('探針原文跟 tools/d041-lab.mjs 現在的不同（改了探針要重錄）');
    if (J(S.order) !== J(cities.map(c => `${c.kind}:${c.id}`))) bad.push('城的清單跟 d041Cities() 現在的不同');
    if (J(S.cols) !== J(COLS)) bad.push('欄位清單不同');
    for (const c of cities) {
      const r = S.runs?.[`${c.kind}:${c.id}`];
      if (!r) { bad.push(`${c.id}：沒有記錄`); continue; }
      if (r.codeHash !== fnv1a(c.code) || r.days !== c.days) bad.push(`${c.id}：本線產生的碼跟錄樣本時不同或天數不對（重跑 tools/d041-lab.mjs）`);
      for (const m of MODES) if (!Array.isArray(r[m]) || r[m].length !== c.days + 1 || r[m].some(row => row.length !== COLS.length)) bad.push(`${c.id} ${m}：列數或欄數不對`);
    }
    const meta = S.source?.pieces ?? [];
    if (!pieces.length || meta.length !== LAB_FNS.length || LAB_FNS.some((n, i) => meta[i]?.name !== n)) bad.push('原文摘錄的函式清單不對');
    for (const n of LAB_FNS) { const i = meta.findIndex(m => m.name === n); if (i < 0 || sha(P[n] ?? '') !== meta[i].sha) bad.push(`原文摘錄 ${n} 的 sha256 不符`); }
    if (!P['GV.step']) bad.push('沒有 GV.step 那一行');
    log(!bad.length, `D041 驗收 1：樣本——實驗線 ${S.source?.commit?.slice(0, 7)}（${S.source?.version}）回退設定；${cities.length} 座城（V 系列 5 座有路網 × 30 天、起步城 8 種子 × 120 天）四種跑法（${MODES.join('、')}）每天一列；碼雜湊＝本線現在產生的；原文摘錄 ${pieces.length} 段 sha256 相符`,
      bad.slice(0, 4).join('；') || `錄了 ${S.seconds} 秒、${Object.keys(S.runs).length} 座`);
  }

  // ---- 2. 原文事實 ----
  {
    const bad = [], has = (name, re, what) => { if (!re.test(P[name] ?? '')) bad.push(`${name}：${what}`); };
    has('updFireTrucks', /if\(b&&b\.k<=3&&b\.fire\)\{b\.fire=0;/, '車到了現場把 b.fire 清成 0');
    has('updPoliceCars', /if\(b&&b\.k<=3&&b\.crime\)\{b\.crime=0;b\.crimeDays=0;/, '車到了現場把 b.crime 清成 0');
    has('updAmbulances', /if\(b&&b\.k===1\)\{b\.sick=0;b\.sickDays=0;\}/, '車到了現場把 b.sick 清成 0');
    has('advance', /simAcc\+=dtReal\*speed;[\s\S]*tick\(\);/, '逐幀累計時間、滿 DAYLEN 才 tick()');
    has('advance', /updAmbulances\(dtSvc411\);updFireTrucks\(dtSvc411\);[\s\S]*updPoliceCars\(dtSvc411\);/, '三種車每一幀更新（吃 dtSvc411）');
    has('advance', /const dtSvc411=dtA\*speed;/, '車輛的時間＝幀時間 × 速度');
    has('advance', /每遊戲日恆為 DAYLEN=0\.9 車輛秒/, '註解：每個遊戲日恆為 0.9 車輛秒');
    has('updEmergencyDispatch455', /emergencyReplan455/, '車輛沿道路走、路斷了重新規劃');
    has('civicDispatchCap495', /Math\.max\(0,fleet\|0\)/, '回退設定下車輛上限＝車隊配額');
    if (/advance|updFireTrucks|updPoliceCars|updAmbulances/.test(P['GV.step'] ?? '')) bad.push('GV.step 那一行碰到了 advance 或車輛');
    if (!/for\(let i=0;i<n;i\+\+\)tick\(\);/.test(P['GV.step'] ?? '')) bad.push('GV.step 不是只叫 tick()');
    log(!bad.length, 'D041 驗收 2：實驗線原文上的事實——車輛抵達現場就把旗標清成 0（消防車清 b.fire、警車清 b.crime、救護車清 b.sick）、車只在 advance（畫面幀）裡動且吃遊戲時間（每個遊戲日 0.9 車輛秒）、GV.step 只叫 tick()（沒有車）；所以「車輛會改變模擬」是原文事實，D026 對拍的 GV.step 基準沒有車',
      bad.join('；') || '9 條原文事實都在');
  }

  // ---- 3. 本線＝實驗線逐日推進（V 系列） ----
  const ours = {};
  {
    const bad = [], info = [];
    for (const c of vCities()) {
      const s = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank), N = s.w.N;
      const snap = () => { let f = 0, cr = 0, sk = 0, ab = 0, r = 0; for (let i = 0; i < N * N; i++) { const t = s.w.tiles[i], b = t.bld; if (b && !b.ref) { if (b.fire && b.k <= 3) f++; if (b.crime) cr++; if (b.sick) sk++; if (b.abandoned) ab++; } if (t.ruin) r++; } return [f, cr, sk, ab, r]; };
      const rows = [snap()];
      for (let d = 0; d < c.days; d++) { realDay.stepDay(s); rows.push(snap()); }
      ours[c.id] = rows;
      const want = S.runs[`crafted:${c.id}`].step.map(r => FLAGS.map(i => r[i]));
      const first = rows.findIndex((r, i) => J(r) !== J(want[i]));
      if (first >= 0) bad.push(`${c.id} 第 ${first} 天：本線 ${J(rows[first])} ≠ 實驗線 step ${J(want[first])}`);
      info.push(`${c.id} ${rows.at(-1).join('/')}`);
    }
    log(!bad.length, 'D041 驗收 3：本線＝實驗線逐日推進——V 系列 5 座有路網的城連推 30 天，每天的燃燒、犯罪、生病、廢棄、焦土個數逐日逐座＝樣本的 step 組（本線沒有車：這一條證明本線跟 GV.step 之間差的只有車）',
      bad.slice(0, 3).join('；') || `5 座 × 31 列全等；末日 燃燒/犯罪/病/廢棄/焦土：${info.join('；')}`);
    // 突變：災禍規則改壞的副本要跟 step 不同
    const out = [], bad2 = [];
    for (const [name, file, from, to, over] of [['犯罪機率 .001→.0011', 'src/sim/rules/hazard.ts', '.001 * (b.k === 2 ? 2 : 1) * b.lv', '.0011 * (b.k === 2 ? 2 : 1) * b.lv', './rules/hazard.ts']]) {
      try {
        const H = await loadMod(file, [[from, to]]), M = await dayVariant([], { [over]: H });
        let diff = false;
        for (const c of vCities().filter(q => q.id === 'V2' || q.id === 'V4')) {
          const s = M.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank), N = s.w.N, want = S.runs[`crafted:${c.id}`].step;
          for (let d = 0; d < c.days && !diff; d++) { M.stepDay(s); let cr = 0; for (let i = 0; i < N * N; i++) { const b = s.w.tiles[i].bld; if (b && !b.ref && b.crime) cr++; } if (cr !== want[d + 1][COL.crime]) diff = true; }
        }
        diff ? out.push(name) : bad2.push(`突變「${name}」沒抓到`);
      } catch (e) { bad2.push(`突變「${name}」：${String(e.message).slice(0, 120)}`); }
    }
    log(!bad2.length, 'D041 驗收 3：突變——本線災禍規則的副本改壞一處（犯罪機率 .001→.0011），V2／V4 的犯罪個數要跟實驗線 step 組不同（守衛看得出來）', bad2.join('；') || `${out.length} 個全紅：${out.join('、')}`);
  }

  // ---- 4. 逐幀迴圈本身不改模擬；逐幀跑法的重現性 ----
  {
    const bad = [], odd = [], rep = [];
    for (const [key, r] of Object.entries(S.runs)) {
      const cmp = (a, b, cols) => a.some((row, i) => cols.some(c => row[c] !== b[i][c]));
      if (cmp(r.step, r.noveh, [...FLAGS, COL.pop])) odd.push(key);   // 旗標與人口逐日逐欄；資金另算（沒有車隊就沒有車隊保養費）
      if (cmp(r.veh, r.veh2, [...FLAGS, COL.money, COL.pop])) rep.push(key);
      // 資金：V 系列 noveh 比 step 每天多 7 輛 × $0.8＝$5.6（T304：每輛每日保養 $0.8，入 upkeep；D024 起本線把車隊保養當輸入給中性值）；起步城資金封頂 99999999 沒差
      if (key.startsWith('crafted:') && !odd.includes(key)) r.step.forEach((row, i) => { const d = r.noveh[i][COL.money] - row[COL.money]; if (Math.abs(d - 5.6 * i) > 0.03 * Math.max(1, i)) bad.push(`${key} 第 ${i} 天資金差 ${d.toFixed(2)}（要 ${(5.6 * i).toFixed(2)}＝7 輛 × $0.8 × ${i} 天）`); });
    }
    if (J(odd) !== J(LOCK.stepNotNoveh)) bad.push(`step≠noveh 的城 ${J(odd)}（鎖住的是 ${J(LOCK.stepNotNoveh)}）`);
    if (rep.length) bad.push(`veh≠veh2 的城 ${J(rep)}（這一份樣本裡都該逐位重現）`);
    for (const k of Object.keys(S.runs).filter(k => k.startsWith('crafted:'))) if (odd.includes(k)) bad.push(`${k}：V 系列的逐幀跑法（沒有車）應該逐位＝逐日跑法`);
    log(!bad.length, `D041 驗收 4：逐幀迴圈本身不改模擬——沒有車（車隊配額 0）的逐幀跑法＝逐日跑法（旗標、人口逐日逐欄；資金每天差的恰好是 7 輛車的保養費 $5.6）：13 座裡 12 座逐位相等；唯一例外 ${J(LOCK.stepNotNoveh)}（起步城 120 天，逐幀跑法偶爾分岔：這份樣本 noveh 分岔、veh 跟 step 一樣，第一次試錄是 veh 分岔——有車沒車都會，原因沒查）；同一個跑法在全新頁面重跑（veh2）逐位＝veh`,
      bad.join('；') || `step＝noveh：${Object.keys(S.runs).length - odd.length}／${Object.keys(S.runs).length}；veh＝veh2：${Object.keys(S.runs).length - rep.length}／${Object.keys(S.runs).length}`);
  }

  // ---- 5. 車輛的量（鎖） ----
  const gap = {};
  {
    const bad = [];
    for (const id of Object.keys(LOCK.online)) {
      const r = S.runs[`crafted:${id}`], last = r.veh.at(-1), mx = c => Math.max(...r.veh.map(row => row[c]));
      const online = r.veh[0][COL.online], max = [mx(COL.trucks), mx(COL.cars), mx(COL.ambs)], cures = [last[COL.cureFire], last[COL.cureCrime], last[COL.cureSick]];
      if (J(online) !== J(LOCK.online[id])) bad.push(`${id} 站 ${J(online)}≠${J(LOCK.online[id])}`);
      if (J(max) !== J(LOCK.maxVeh[id])) bad.push(`${id} 車最多 ${J(max)}≠${J(LOCK.maxVeh[id])}`);
      if (J(cures) !== J(LOCK.cures[id])) bad.push(`${id} 車處理 ${J(cures)}≠${J(LOCK.cures[id])}`);
      if (r.noveh.at(-1)[COL.cureFire] || r.noveh.at(-1)[COL.cureCrime] || r.noveh.at(-1)[COL.cureSick]) bad.push(`${id} noveh 不該有車處理`);
      gap[id] = { cures, ruin: [r.noveh.at(-1)[COL.ruin], last[COL.ruin]], burnDays: [r.noveh.reduce((t, row) => t + row[COL.fire], 0), r.veh.reduce((t, row) => t + row[COL.fire], 0)], crimeDays: [r.noveh.reduce((t, row) => t + row[COL.crime], 0), r.veh.reduce((t, row) => t + row[COL.crime], 0)] };
    }
    const g = gap.V1h.ruin; if (J(g) !== J(LOCK.ruin.V1h)) bad.push(`V1h 焦土 ${J(g)}≠${J(LOCK.ruin.V1h)}`);
    // 雜訊：沒有對應車種的城（V2 沒消防局、V3 沒消防局）焦土也差
    const noise = ['V2', 'V3'].map(id => { const [a, b] = gap[id].ruin; return `${id} ${a}→${b}（${((b - a) / a * 100).toFixed(0)}％）`; });
    // 起步城：一輛車都沒出過
    for (const k of Object.keys(S.runs).filter(k => k.startsWith('evolve:'))) {
      const r = S.runs[k], mx = c => Math.max(...r.veh.map(row => row[c]));
      if (mx(COL.trucks) || mx(COL.cars) || mx(COL.ambs) || r.veh.at(-1)[COL.cureFire] || r.veh.at(-1)[COL.cureCrime] || r.veh.at(-1)[COL.cureSick]) bad.push(`${k} 出過車`);
      if (J(r.veh[0][COL.online]) !== '[0,1,0]') bad.push(`${k} 站 ${J(r.veh[0][COL.online])}（起步城只有警察局）`);
    }
    LIVE.gap = gap; LIVE.noise = noise;
    log(!bad.length, '【量到的缺口】D041 驗收 5：車輛的量（鎖）——V 系列貼路的站（消防 4、警察 3、救護 3 才算 online）、車的上限（消防 3、警 2、救護 2）、30 天裡車處理的件數（V1 滅火 5、V1h 滅火 14、V2 處理犯罪 11、V3 治病 5、V4 犯罪 8＋治病 2）、焦土 V1h 399→372；起步城 8 個種子 × 120 天一輛車都沒出過（只有警察局、沒有罪案）',
      bad.slice(0, 4).join('；') || `處理件數 ${Object.entries(gap).map(([id, g]) => `${id} ${g.cures.join('／')}`).join('、')}；焦土 V1h ${gap.V1h.ruin.join('→')}；雜訊對照（沒有對應車種）${noise.join('、')}；起步城 0 輛`);
  }

  // ---- 6. 本線沒有車 ----
  {
    const bad = [], re = /ladderTrucks?\b|policeCars?\b|ambulances\b|updFireTrucks|updPoliceCars|updAmbulances|updEmergencyDispatch|emergencyReplan|EM_FIELD|emergencyStation/i;   // svcFleet 只在 money.ts 當保養費的輸入（D024），不算
    const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    const walk = d => fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : /\.ts$/.test(e.name) ? [path.join(d, e.name)] : []);
    const files = [...walk('src/sim'), ...walk('src/render')];
    for (const f of files) { const m = strip(read(f)).match(re); if (m) bad.push(`${f}：「${m[0]}」`); }
    log(!bad.length, `D041 驗收 6：本線沒有車——src/sim、src/render 的 ${files.length} 個檔裡沒有車隊、派遣、車輛更新的程式（註解不算）；要做的時候，這一條跟驗收 3、5 要一起改`, bad.slice(0, 4).join('；') || `${files.length} 個檔乾淨`);
  }

  // ---- 7. 摘要 ----
  {
    const g = LIVE.gap, tot = Object.values(g).reduce((a, x) => a + x.cures.reduce((p, q) => p + q, 0), 0);
    log(true, 'D041 摘要（卡面引用）：實驗線實際玩的時候，車輛抵達就把旗標清掉；本線逐日推進＝實驗線 GV.step，沒有車。差距的大小——', `V 系列 30 天、預設車隊：5 座城共處理 ${tot} 件（V1h 滅火 ${g.V1h.cures[0]}、V2 犯罪 ${g.V2.cures[1]}、V3 治病 ${g.V3.cures[2]}）；燃燒日加總 V1h ${g.V1h.burnDays.join('→')}（${((g.V1h.burnDays[1] - g.V1h.burnDays[0]) / g.V1h.burnDays[0] * 100).toFixed(1)}％）；起步城 120 天 0 輛`);
  }
}

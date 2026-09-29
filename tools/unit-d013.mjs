// D013 Node 守衛：世界歷史改存日誌（驗收 1–5）。存放用記憶體版（src/io/journal.ts MemoryJournal），存檔的流程照 src/cityView.ts saveNow／kickJournal：
// 每一次存：先照「已確定寫進日誌的編碼狀態」產生 hv 3 的存檔碼（d3 只帶尾巴），再把尾巴附加進日誌；附加完成才前進確定狀態。
// 這裡用一個亂數決定每一次存檔之後附加有沒有馬上完成，存檔裡的尾巴才會真的有長有短（跟瀏覽器一樣：附加是非同步的）。
//   1. 日誌逐列＝整份編碼：新城（D011 A＋D016 C 段、推進 30 天）與預建城（拆除、九種設施、推進 20 天），每一筆、每一天都存：
//      日誌裡的列串起來＝packHistory(整份歷史)；每一次附加的列數＝那一次的尾巴；任何時候讀回來（日誌＋存檔的尾巴）＝同一刻存 hv 2 讀回來（歷史、格子、資金逐欄）。
//   2. 超過分享碼上限：歷史灌到 hv 2 的存檔超過 2,000,000 字元，hv 3 的存檔照樣在上限內、讀回來歷史逐筆相同。
//   3. 存檔的時間不跟歷史長度成正比：1 萬筆與 12 萬筆以上，再加一筆之後存一次（hv 3）同一個量級；hv 2 整份重編另外量、照列。
//   4. 壞掉的情形：日誌少列、多列、某一列被改、雜湊不符、編號對不上、讀不到日誌（null）、指標欄位型別不對——多的列不用、其他退回只用存檔並講原因，不丟例外。
//   5. 舊檔：hv 1、hv 2 照讀、歷史接得上；存一次 hv 3 再讀回來歷史逐筆不變。
//   6. 實驗線照樣讀（Node 半邊）：d013-lab.json（tools/d013-lab.mjs 在實驗線頁面錄的讀回）的三張碼＝本線現在算出來的（雜湊）；
//      實驗線讀 hv 3、hv 2、拿掉 d3 的讀回一模一樣，也＝本線（對帳數字、資金、難度、星等、里程碑、天數）；本線自己讀 hv 3（日誌＋尾巴）＝讀 hv 2。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './cdp.mjs';
import { mulberry32, fnv1a } from '../src/sim/rng.ts';
import { cityFromLab, cityStats } from '../src/sim/city.ts';
import { decodeLabCode, encodeLabCode, codeWithSeed, MAX_CODE } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { loadCode, saveCode, packHistory, JOURNAL_VER } from '../src/io/save.ts';
import { MemoryJournal, packMore, hashRows, PACK0 } from '../src/io/journal.ts';
import { stepDay } from '../src/sim/day.ts';
import { commitOp } from '../src/sim/edit.ts';
import { run3d } from './d011-ops.mjs';
import { d016Ops, prebuilt16Ops } from './d016-ops.mjs';

const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const J = JSON.stringify;

export async function d013Guards(log) {
  try { return await guards(log); }
  catch (e) { log(false, 'D013 守衛跑到一半丟例外（沒跑完＝紅燈）', (e.stack ?? String(e)).split('\n').slice(0, 4).join(' ｜ ')); }
}

// 存檔器：照 cityView 的 saveNow（同步產生存檔碼）＋kickJournal（非同步附加尾巴，完成才前進確定狀態）
function saver(store, id, L) {
  let conf = PACK0, pending = null;
  const out = { appends: [], saves: 0, maxTail: 0, tails: 0 };
  return {
    out, get conf() { return conf; },
    save(s) {
      const code = saveCode(s, L.template, L.start, { journal: { id, st: conf } });
      const { rows, st } = packMore(s.city.history, conf);
      out.saves++; out.maxTail = Math.max(out.maxTail, rows.length); if (rows.length) out.tails++;
      if (rows.length && !pending) pending = { from: conf.n, rows, st };
      return code;
    },
    async settle() { if (!pending) return; const p = pending; pending = null; await store.append(id, p.from, p.rows); out.appends.push(p.rows.length); conf = p.st; },
  };
}
// 讀回：hv 3（日誌的列＋存檔的尾巴）跟同一刻存的 hv 2 讀回來逐欄比
const TILE = t => [t.t, t.road, t.hw, t.bridge, t.road ? t.rc : 0, t.zone || 0, t.tree || 0, t.bld ? [t.bld.k, t.bld.lv, t.bld.v, t.bld.age, t.bld.ref ?? 0] : 0];
const same = (a, b) => J(a.sim.city.history) === J(b.sim.city.history) && J(a.sim.w.tiles.map(TILE)) === J(b.sim.w.tiles.map(TILE)) && a.sim.money === b.sim.money && a.sim.day === b.sim.day && a.sim.stroke === b.sim.stroke;

// 驗收 6 的三張碼（tools/d013-lab.mjs 拿去給實驗線讀；守衛在 Node 重算、核對雜湊＝錄樣本時那三張）：
// 預建城（種子 5162026）跑 D016 的拆除與九種設施、推進 5 天；hv 3＝日誌只確定前一半（尾巴不是空的，跟瀏覽器存檔時附加還在跑一樣），hv 2＝同一刻整份，plain＝拿掉 d3
export function d013Codes() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const prebuilt = codeWithSeed(read('src/content/samples/d011-prebuilt.code.txt').trim(), 5162026);
  const L = loadCode(prebuilt, KT, vrank), s = L.sim, picks = {};
  let now = 0;
  for (const o of prebuilt16Ops(s).ops) run3d(s, o, picks, now += 10000);
  for (let d = 0; d < 5; d++) stepDay(s);
  const half = Math.floor(s.city.history.length / 2), st = packMore(s.city.history.slice(0, half), PACK0).st;
  const hv3 = saveCode(s, L.template, L.start, { journal: { id: 'd013-lab', st } }), hv2 = saveCode(s, L.template, L.start);
  const raw = JSON.parse(J(decodeLabCode(hv3).save.raw)); delete raw.z; delete raw.d3;
  return { hv3, hv2, plain: encodeLabCode(raw, { deflate: true }), events: s.city.history.length, half, KT };
}

async function guards(log) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const newcity = codeWithSeed(read('src/content/samples/newcity.code.txt').trim(), 5162026), prebuilt = codeWithSeed(read('src/content/samples/d011-prebuilt.code.txt').trim(), 5162026);

  // ---- 1. 日誌逐列＝整份編碼、隨時讀得回來 ----
  {
    const bad = [], R = mulberry32(20261013), tally = { saves: 0, loads: 0, tailLoads: 0, appends: 0, rows: 0 };
    const S0 = decodeLabCode(newcity).save, lay = k => Uint8Array.from(S0.layers[k] ?? '', ch => ch.charCodeAt(0) - 48), ops = d016Ops(S0.n, lay('ter'), lay('el'), lay('tre'));
    const runs = [
      ['新城', newcity, s => [...ops.A, ...ops.C], 30],
      ['預建城', prebuilt, s => prebuilt16Ops(s).ops, 20],
    ];
    for (const [name, code, opsOf, days] of runs) {
      const L = loadCode(code, KT, vrank), s = L.sim, store = new MemoryJournal(), id = 'j-' + name, sv = saver(store, id, L), picks = {};
      let now = 0;
      const check = async (what, code3) => {
        tally.loads++;
        const rows = await store.read(id, 1e9), d3 = decodeLabCode(code3).save.raw.d3;
        if (d3?.hv !== JOURNAL_VER || d3.r !== undefined || !Array.isArray(d3.t)) { bad.push(`${name} ${what}：存檔不是 hv 3（${J(Object.keys(d3 ?? {}))}）`); return; }
        if (d3.t.length) tally.tailLoads++;
        const q3 = loadCode(code3, KT, vrank, { id, rows }), q2 = loadCode(saveCode(s, L.template, L.start), KT, vrank);
        if (!q3.ok || !q3.replayed) { bad.push(`${name} ${what}：hv 3 讀不回來（${q3.ok ? q3.note : q3.error}）`); return; }
        if (!same(q3, q2)) bad.push(`${name} ${what}：hv 3 讀回來≠hv 2 讀回來`);
        if (q3.journal?.id !== id || q3.journal.st.n !== d3.j.n || q3.journal.st.h !== d3.j.h) bad.push(`${name} ${what}：讀回來接著寫的狀態不對 ${J(q3.journal)}`);
      };
      const step = async (what, code3) => {
        tally.saves++;
        if (R() < .3) await check(what, code3);                              // 附加還沒完成就讀（存檔裡有尾巴）
        if (R() < .75) await sv.settle();                                    // 七成五的存檔之後附加馬上完成
      };
      for (const o of opsOf(s)) { run3d(s, o, picks, now += 10000); await step(`${o.k} ${o.tool ?? ''}`, sv.save(s)); }
      for (let d = 0; d < days; d++) { stepDay(s); await step(`第 ${s.day} 天`, sv.save(s)); }
      await sv.settle(); const last = sv.save(s); await sv.settle(); await check('最後', last);
      const rows = await store.read(id, 1e9), whole = packHistory(s.city.history);
      if (J(rows) !== J(whole)) bad.push(`${name}：日誌的列（${rows.length}）≠ 整份編碼（${whole.length}）`);
      if (store.writes !== whole.length) bad.push(`${name}：日誌總共寫了 ${store.writes} 列，歷史 ${whole.length} 筆（每一列只該寫一次）`);
      if (hashRows(rows) !== sv.conf.h) bad.push(`${name}：日誌的雜湊≠存檔記的`);
      tally.appends += sv.out.appends.length; tally.rows += whole.length;
    }
    log(!bad.length && tally.tailLoads > 5, 'D013 驗收 1：日誌逐列＝整份編碼——新城（D011 A＋D016 C 段、推進 30 天）與預建城（拆除、九種設施、推進 20 天）每一筆、每一天都存（附加七成五馬上完成、其餘拖到下一次）：日誌的列串起來＝packHistory(整份歷史)，每一列只寫一次；任何時候讀回來（日誌＋存檔的尾巴）＝同一刻存 hv 2 讀回來（歷史、格子、資金、天數、手勢編號）；接著寫的狀態＝存檔的指標',
      bad.slice(0, 3).join('；') || `存 ${tally.saves} 次、附加 ${tally.appends} 次、共 ${tally.rows} 列；中途讀回 ${tally.loads} 次（其中存檔有尾巴 ${tally.tailLoads} 次）`);
  }

  // ---- 2、3. 超過分享碼上限；存檔時間不跟歷史長度成正比 ----
  {
    const bad = [], L = loadCode(newcity, KT, vrank), s = L.sim, store = new MemoryJournal(), sv = saver(store, 'long', L);
    const S0 = decodeLabCode(newcity).save, lay = k => Uint8Array.from(S0.layers[k] ?? '', ch => ch.charCodeAt(0) - 48), ops = d016Ops(S0.n, lay('ter'), lay('el'), lay('tre'));
    const X = ops.site.x0, Z = ops.site.z0;
    s.money = 1e9;
    // 同一塊地住宅區↔商業區來回改劃（改劃免費、每一次一筆 zone 事件）
    const flip = n => { for (let k = 0; k < n; k++) commitOp(s, { k: 'rect', tool: k % 2 ? 'zc' : 'zr', x0: X + 1, z0: Z + 1, x1: X + 1, z1: Z + 1 }, 0); };
    const timeSave = mode => { const t0 = performance.now(); for (let k = 0; k < 5; k++) { flip(1); if (mode === 3) { sv.save(s); } else saveCode(s, L.template, L.start); } return (performance.now() - t0) / 5; };
    flip(10000); sv.save(s); await sv.settle();
    const small = { n: s.city.history.length, t3: timeSave(3) }; await sv.settle(); small.t2 = timeSave(2);
    let hv2len = 0;
    while (hv2len <= MAX_CODE) { flip(20000); hv2len = saveCode(s, L.template, L.start).length; }
    sv.save(s); await sv.settle();
    const big = { n: s.city.history.length, t3: timeSave(3) }; await sv.settle(); big.t2 = timeSave(2);
    const code3 = sv.save(s); await sv.settle();
    const q = loadCode(code3, KT, vrank, { id: 'long', rows: await store.read('long', 1e9) });
    if (code3.length > MAX_CODE) bad.push(`hv 3 的存檔 ${code3.length} 字元，超過上限`);
    if (!q.ok || !q.replayed || J(q.sim.city.history.slice(0, s.city.history.length)) !== J(s.city.history)) bad.push(`讀回來的歷史不對（${q.ok ? q.note : q.error}）`);
    log(!bad.length && hv2len > MAX_CODE, `D013 驗收 2：超過分享碼上限照樣存得了——歷史 ${big.n.toLocaleString()} 筆：hv 2 的存檔 ${hv2len.toLocaleString()} 字元（上限 ${MAX_CODE.toLocaleString()}，D011 以前這時就存不下了），hv 3 的存檔 ${code3.length.toLocaleString()} 字元，讀回來歷史逐筆相同`, bad.join('；') || `日誌 ${(await store.count('long')).toLocaleString()} 列`);
    const ratio = big.t3 / Math.max(small.t3, .01);
    log(ratio < 3, `D013 驗收 3：存檔的時間不再跟歷史長度成正比——加一筆之後存一次（hv 3）：歷史 ${small.n.toLocaleString()} 筆 ${small.t3.toFixed(2)} ms、${big.n.toLocaleString()} 筆 ${big.t3.toFixed(2)} ms（${ratio.toFixed(2)} 倍）；hv 2 整份重編同兩點 ${small.t2.toFixed(2)}／${big.t2.toFixed(2)} ms（只量）`,
      `歷史長 ${(big.n / small.n).toFixed(1)} 倍`);
  }

  // ---- 滾動雜湊：跟另外寫的一份 FNV-1a（32 位、照 JSON 字串的 UTF-16 碼元逐個）逐值相同；標準測試值 FNV-1a("a")＝0xe40c292c；中文、負數、小數也照算 ----
  {
    const fnv = (h, str) => { for (const ch of str) for (let i = 0; i < ch.length; i++) { h = (h ^ ch.charCodeAt(i)) >>> 0; h = Number((BigInt(h) * 16777619n) % 4294967296n); } return h; };
    const rowsK = [[0, 0, '樣本城·微光', 13.43, 5162026, 'ab12', 120], [3, 1, 4, 5, 2, -7, 1], [8, 0, 1.5, 2, 3], [], [7, 2, 1, 1200]];
    const want = rowsK.reduce((h, r) => fnv(h, JSON.stringify(r)), 0x811c9dc5);
    const kat = fnv(0x811c9dc5, 'a');
    log(hashRows(rowsK) === want && kat === 0xe40c292c && PACK0.h === 0x811c9dc5,
      'D013 滾動雜湊：本線 hashRows＝另外寫的 FNV-1a（UTF-16 碼元、BigInt 乘法），含中文、負數、小數；標準測試值 FNV-1a("a")＝0xe40c292c',
      `本線 ${hashRows(rowsK).toString(16)}、另算 ${want.toString(16)}、"a" ${kat.toString(16)}`);
  }

  // ---- 4. 壞掉的情形 ----
  {
    const L = loadCode(newcity, KT, vrank), s = L.sim, store = new MemoryJournal(), sv = saver(store, 'x', L), picks = {};
    const S0 = decodeLabCode(newcity).save, lay = k => Uint8Array.from(S0.layers[k] ?? '', ch => ch.charCodeAt(0) - 48), ops = d016Ops(S0.n, lay('ter'), lay('el'), lay('tre'));
    let now = 0;
    for (const o of ops.A) run3d(s, o, picks, now += 10000);
    sv.save(s); await sv.settle();
    for (const o of ops.C.slice(0, 6)) run3d(s, o, picks, now += 10000);
    const code = sv.save(s), rows = await store.read('x', 1e9), n = decodeLabCode(code).save.raw.d3.j.n;
    const good = loadCode(code, KT, vrank, { id: 'x', rows });
    const mod = (f) => { const r = JSON.parse(JSON.stringify(rows)); f(r); return r; };
    const edit = f => { const raw = JSON.parse(JSON.stringify(decodeLabCode(code).save.raw)); delete raw.z; f(raw.d3); return encodeLabCode(raw, { deflate: true }); };
    // 第五欄：退回只用存檔時，講的原因要是這一種（不是剛好被別的檢查擋下）
    const cases = [
      ['日誌多了列（寫進日誌、存檔還沒跟上就關頁）', code, { id: 'x', rows: [...rows, [4, 0, 1, 1, 1, 0, 1]] }, true],
      ['日誌少了一列', code, { id: 'x', rows: rows.slice(0, n - 1) }, false, /日誌只有 \d+ 列、存檔要 \d+ 列/],
      ['日誌某一列被改', code, { id: 'x', rows: mod(r => { r[Math.floor(n / 2)][1] += 1; }) }, false, /雜湊跟存檔對不上/],
      ['雜湊不符', edit(d => { d.j.h = (d.j.h + 1) >>> 0; }), { id: 'x', rows }, false, /雜湊跟存檔對不上/],
      ['編號對不上', code, { id: 'y', rows }, false, /編號對不上/],
      ['讀不到日誌', code, { id: 'x', rows: null, why: 'IndexedDB 打不開' }, false, /IndexedDB 打不開/],
      ['沒給日誌', code, undefined, false, /沒有日誌/],
      ['指標欄位型別不對', edit(d => { d.j.n = '3'; }), { id: 'x', rows }, false, /指標不對/],
      ['尾巴不是陣列', edit(d => { d.t = 5; }), { id: 'x', rows }, false, /尾巴不對/],
    ];
    const bad = [], notes = [];
    if (!good.ok || !good.replayed) bad.push('好的那一份就讀不回來');
    for (const [name, c, jin, want, why] of cases) {
      let r;
      try { r = loadCode(c, KT, vrank, jin); } catch (e) { bad.push(`${name}：丟例外 ${e.message}`); continue; }
      if (!r.ok) { bad.push(`${name}：整張讀不進來 ${r.error}`); continue; }
      if (r.replayed !== want) bad.push(`${name}：replayed ${r.replayed}（應該 ${want}）`);
      if (want && J(r.sim.city.history) !== J(good.sim.city.history)) bad.push(`${name}：歷史跟好的那一份不同`);
      if (!want && (r.journal || r.sim.city.history.length > 3 || !/只用存檔/.test(r.note))) bad.push(`${name}：沒有退回只用存檔（${r.note}）`);
      if (!want && why && !why.test(r.note)) bad.push(`${name}：原因不對（${r.note}）`);
      if (!want && J(r.sim.w.tiles.map(TILE)) !== J(good.sim.w.tiles.map(TILE))) bad.push(`${name}：退回只用存檔，格子卻不是存檔的格子`);
      notes.push(`${name}→${want ? '接得上' : r.note.replace(/：只用存檔.*/, '')}`);
    }
    log(!bad.length, 'D013 驗收 4：壞掉的情形——日誌多了列照樣接得上（多的不用）；少列、改列、雜湊不符、編號對不上、讀不到日誌、沒給日誌、指標或尾巴型別不對：退回只用存檔（城照存檔開、歷史從這張碼重新起算）並講原因，不丟例外',
      bad.slice(0, 3).join('；') || notes.join('、'));
  }

  // ---- 5. 舊檔 ----
  {
    const bad = [], L = loadCode(prebuilt, KT, vrank), s = L.sim, picks = {};
    let now = 0;
    for (const o of prebuilt16Ops(s).ops) run3d(s, o, picks, now += 10000);
    for (let d = 0; d < 5; d++) stepDay(s);
    const hv2 = saveCode(s, L.template, L.start), raw = JSON.parse(JSON.stringify(decodeLabCode(hv2).save.raw)); delete raw.z;
    raw.d3 = { f: raw.d3.f, s: raw.d3.s, g: raw.d3.g, h: s.city.history };   // hv 1：事件物件、沒有 hv 欄位
    const hv1 = encodeLabCode(raw, { deflate: true });
    for (const [name, code] of [['hv 1', hv1], ['hv 2', hv2]]) {
      const q = loadCode(code, KT, vrank);
      if (!q.ok || !q.replayed) { bad.push(`${name} 讀不回來`); continue; }
      const store = new MemoryJournal(), id = 'old-' + name, code3 = saveCode(q.sim, q.template, q.start, { journal: { id, st: PACK0 } });
      const d3 = decodeLabCode(code3).save.raw.d3;
      if (d3.hv !== JOURNAL_VER || d3.j.n !== 0 || d3.t.length !== q.sim.city.history.length) bad.push(`${name} 存一次之後不是 hv 3、尾巴＝整份`);
      await store.append(id, 0, d3.t);
      const code3b = saveCode(q.sim, q.template, q.start, { journal: { id, st: packMore(q.sim.city.history, PACK0).st } }), q3 = loadCode(code3b, KT, vrank, { id, rows: await store.read(id, 1e9) });
      if (!q3.ok || !q3.replayed || J(q3.sim.city.history.slice(0, q.sim.city.history.length)) !== J(q.sim.city.history)) bad.push(`${name} → hv 3 讀回來歷史不同`);
    }
    log(!bad.length, 'D013 驗收 5：舊檔——hv 1（事件物件）、hv 2（緊湊列）的存檔照讀、歷史接得上；存一次變 hv 3（尾巴＝整份，附加進日誌之後尾巴縮回 0），再讀回來歷史逐筆不變', bad.join('；') || 'hv 1、hv 2 都對');
  }
  // ---- 6. 實驗線照樣讀（Node 半邊；瀏覽器半邊是錄樣本時在實驗線頁面讀的）----
  {
    const lab = JSON.parse(read('src/content/samples/d013-lab.json')), C = d013Codes(), bad = [], stale = [];
    if (!/^d23c18d/.test(lab.source?.commit ?? '')) bad.push(`樣本的實驗線 commit ${lab.source?.commit}`);
    for (const k of ['hv3', 'hv2', 'plain']) if (lab.hash?.[k] !== fnv1a(C[k])) stale.push(k);
    const S = decodeLabCode(C.hv3).save, my = cityStats(cityFromLab(S, C.KT, C.hv3)), rb = lab.readback ?? {};
    const strip = x => { const { ok, ...rest } = x ?? {}; void ok; return J(rest); };
    if (!rb.hv3?.ok || !rb.hv2?.ok || !rb.plain?.ok) bad.push('實驗線有一張讀不進來');
    if (strip(rb.hv3) !== strip(rb.hv2) || strip(rb.hv3) !== strip(rb.plain)) bad.push('實驗線讀 hv 3、hv 2、拿掉 d3 的讀回不一樣');
    if (J(rb.hv3?.measure) !== J(my)) bad.push('實驗線讀回的對帳數字 ≠ 本線');
    const want = [S.money, S.df, S.star, S.msIdx, S.day, S.n], got = [rb.hv3?.money, rb.hv3?.diff, rb.hv3?.star, rb.hv3?.msIdx, rb.hv3?.day, rb.hv3?.n];
    if (J(want) !== J(got)) bad.push(`資金／難度／星等／里程碑／天數／邊長 ${J(got)} ≠ 本線 ${J(want)}`);
    const vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank, h2 = loadCode(C.hv2, C.KT, vrank);
    const h3 = loadCode(C.hv3, C.KT, vrank, { id: 'd013-lab', rows: packHistory(h2.sim.city.history).slice(0, C.half) });
    if (!h3.ok || !h3.replayed || !same(h3, h2)) bad.push(`本線讀 hv 3 ≠ 讀 hv 2（${h3.note}）`);
    if (stale.length) bad.push(`${stale.join('、')} 跟錄樣本時的碼不同（重跑 tools/d013-lab.mjs）`);
    log(!bad.length, `D013 驗收 6：實驗線照樣讀——hv 3 的存檔給實驗線 ${lab.source?.commit?.slice(0, 7)} 讀（它自己的 GV.importCode）：讀得進來，跟同一刻的 hv 2、拿掉 d3 的碼讀回一模一樣，對帳數字、資金、難度、星等、里程碑、天數＝本線；三張碼＝本線現在算的（雜湊）；本線讀 hv 3＝讀 hv 2`,
      bad.join('；') || `歷史 ${C.events} 筆（日誌 ${C.half} 列＋尾巴 ${C.events - C.half} 列）；hv 3 ${C.hv3.length.toLocaleString()} 字元、hv 2 ${C.hv2.length.toLocaleString()}、拿掉 d3 ${C.plain.length.toLocaleString()}；實驗線讀回第 ${rb.hv3.day} 天 $${rb.hv3.money}、建築 ${my.buildings} 棟`);
  }

}

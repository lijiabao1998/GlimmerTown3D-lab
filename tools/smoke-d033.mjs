// D033 煙霧測試：污水的瀏覽器半邊（驗收 8）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d033.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome。
//   ui      手機直式 360×740、真的觸控：「公共設施」（D033 時 14 種兩排、污水廠排最後；D040 起 16 種三排、污水廠倒數第三，每一顆 ≥ 44×44、都在畫面裡）；選污水廠，點內陸的空地被擋下來（講「需鄰近水域(≥2格)」、錢與歷史不動），
//           點水邊的空地蓋成（扣 $500、歷史 place k 27）；放下工具點它，建築卡寫「污水網」
//   card    煙霧城（tools/d033-cities.mjs d033SmokeCity：人口 1176、四種接管狀態的住宅都有）：每一棟住宅的「污水」列＝Node 端用 sewerServed 重算的結果與原因（已接管：沿管幾格；沒貼管線；
//           管網裡沒有污水廠；超過 90 格），四種都看得到；二級與三級住宅的後果字（升三級的關、二級升不到三級、高密度污水 −4%）；建築卡真的把那一列印出來。
//           起步城（人口 < 500）的住宅卡講「還不要求集中污水」
//   effect  煙霧城：右網沒有污水廠；在水塘邊 (66,28) 蓋一座（扣 $500）、推進一天，全城接管棟數增加、右網的住宅卡從「沒接管」變「已接管」、當天維護費多 $3；
//           再推進十二天，右網 lv2 住宅升上三級（對照組不蓋廠：右網的 lv3 數不變）
//   budget  手機 draw call ≤ 18、三角形 ≤ 118,884（煙霧城蓋了污水廠、推進之後）
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession, free } from './smoke-d011.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { sewerServed, SEWAGE_THRESHOLD442, WATER_HOPS472 } from '../src/sim/rules/sewer.ts';
import { d033SmokeCity, SMOKE_POND } from './d033-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['ui', 'card', 'effect', 'budget'];
const ONLY = (process.env.D033_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
const waterAround = (L, i) => { const n = L.n, x = i % n, z = (i / n) | 0; let c = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, zz = z + dz; if (xx >= 0 && zz >= 0 && xx < n && zz < n && L.ter[zz * n + xx] === 0) c++; } return c; };

// Node 端：把煙霧城讀成 Sim、用 sewerServed 重算每一棟住宅的接管與原因，拼成介面應該寫的字（跟 src/cityView.ts 的 sewerRows 各寫各的）
export function expectedRows() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const code = d033SmokeCity(), s = realDay.simFromSave(decodeLabCode(code).save, code, KT, vrank), w = s.w, N = w.N, res = sewerServed(w), out = [];
  for (let i = 0; i < w.tiles.length; i++) {
    const b = w.tiles[i].bld; if (!b || b.ref || b.k !== 1) continue;
    const why = res.why[i], h = res.hops[i], lv = b.lv;
    let text;
    if (why === 0) text = `已接管：沿水管離污水廠 ${h} 格（上限 ${WATER_HOPS472}）${lv === 2 ? '；升三級的污水這一關過了（還要學校、污染夠低）' : ''}`;
    else {
      const reason = why === 1 ? '沒有貼著水管（腳印與四邊外一圈要碰到水管）' : why === 2 ? '貼著的水管網裡沒有污水廠'
        : (h < 65535 ? `離污水廠太遠：沿水管 ${h} 格，超過 ${WATER_HOPS472}` : `離污水廠太遠：沿水管超過 ${WATER_HOPS472 + 32} 格（上限 ${WATER_HOPS472}）`);
      const eff = [lv === 2 ? '二級升不到三級' : '', lv >= 3 ? '高密度污水：幸福 −4%' : ''].filter(Boolean);
      text = `沒接管：${reason}${eff.length ? `；${eff.join('；')}` : ''}`;
    }
    out.push({ x: i % N, z: (i / N) | 0, why, lv, text });
  }
  return { code, pop: s.pop, rows: out };
}

export async function d033Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D033_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D033 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D033 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const exp = expectedRows();
  const loadCity = async (open, ev) => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(exp.code)})`); await open(''); };

  await run('ui', '手機介面（360×740）', async ({ ev, tapBtn, tapAt, cell, sim, findBox, freshStart, waitFor, toasts }) => {
    await freshStart();
    await ev('__gt.simMoney(1e6)');
    await tapBtn('.tool[data-t="civic"]');
    const btns = await ev(`[...document.querySelectorAll('#civicSub button')].map(b=>{const r=b.getBoundingClientRect();return [b.dataset.c,Math.round(r.width),Math.round(r.height),r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,Math.round(r.top),b.textContent];})`);
    const rows = new Set(btns.map(b => b[4])).size;
    log(btns.length === 18 && btns.every(b => b[1] >= 44 && b[2] >= 44 && b[3]) && rows === 3 && btns.at(-5)[0] === 'sewage' && /污水廠/.test(btns.at(-5)[5]) && /500/.test(btns.at(-5)[5]),
      'D033 驗收 8：手機 360×740「公共設施」污水廠是 D033 加的一顆（$500）；D040 起 16 種、D044 起 18 種三排、污水廠退到倒數第五顆，每一顆 ≥ 44×44 且在畫面裡',
      `按鈕 ${btns.length} 顆 ${rows} 排、最小 ${Math.min(...btns.map(b => b[1]))}×${Math.min(...btns.map(b => b[2]))}；污水廠 ${J(btns.at(-5))}`);
    await tapBtn('#civicSub button[data-c="sewage"]');
    const L0 = await ev('__gt.layers()'); let near = null;                  // 新城的水不在預設的畫面裡：先把鏡頭移到第一個水邊空地
    for (let i = 0; i < L0.n * L0.n && !near; i++) if (free(i, L0) && waterAround(L0, i) >= 2) near = [i % L0.n, (i / L0.n) | 0];
    if (near) await ev(`__gt.focusTile(${near[0]},${near[1]})`);
    const inland = (await findBox(1, 1, (i, L) => free(i, L) && waterAround(L, i) === 0))[0], shore = (await findBox(1, 1, (i, L) => free(i, L) && waterAround(L, i) >= 2))[0];
    if (!inland || !shore) { log(false, 'D033 驗收 8：畫面裡找得到內陸空地與水邊空地', `內陸 ${J(inland?.[0])}、水邊 ${J(shore?.[0])}`); return; }
    // 內陸：被擋下來
    await waitFor(async () => (await toasts()).length === 0, 4000);
    const s0 = await sim(), n0 = (await ev('__gt.history()')).length;
    await tapAt(inland[1]);
    const t1 = await toasts(), s1 = await sim(), n1 = (await ev('__gt.history()')).length;
    log(t1.some(t => /需鄰近水域\(≥2格\)/.test(t)) && s1.money === s0.money && n1 === n0,
      'D033 驗收 8：污水廠點內陸的空地被擋下來——講「需鄰近水域(≥2格)」、資金與歷史都不動', `(${inland[0]})：提示 ${J(t1)}；$${s0.money}→$${s1.money}；歷史 ${n0}→${n1}`);
    // 水邊：蓋成
    await waitFor(async () => (await toasts()).length === 0, 4000);
    const s2 = await sim();
    await tapAt(shore[1]);
    const s3 = await sim(), h = await ev('__gt.history()'), last = h.at(-1);
    log(s3.money === s2.money - 500 && last?.t === 'place' && last.k === 27 && last.x === shore[0][0] && last.z === shore[0][1] && last.cost === 500 && h.length === n1 + 1,
      'D033 驗收 8：點水邊的空地蓋成——資金 −$500、歷史多一筆 place（k 27、那一格、$500）', `(${shore[0]})：$${s2.money}→$${s3.money}；事件 ${J(last)}`);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    await tapBtn('.tool[data-t="civic"]');                                   // 再按一次＝放下工具
    await tapAt(await cell(...shore[0]));
    const card = await ev(CARD), row = card.rows.find(r => r.startsWith('污水網')) ?? '';
    log(card.open && /污水廠/.test(card.title) && /沿水管 90 格內/.test(row) && /容量不限/.test(row) && /推進一天之後才有/.test(row), 'D033 驗收 8：放下工具點污水廠，建築卡有「污水網」一列（沿水管 90 格內、容量不限；還沒推進過就說統計要推進一天之後才有）', `卡片「${card.title}」：${row}`);
    await ev('__gt.simStep(1), 1');
    await tapAt(await cell(...shore[0]));
    const card2 = await ev(CARD), row2 = card2.rows.find(r => r.startsWith('污水網')) ?? '', rep = await ev('__gt.sewerRep()');
    log(!!rep && card2.open && row2.includes(`最近一天全城 ${rep.served} 棟接管、${rep.unserved} 棟沒接管（污水廠 ${rep.plants} 座`) && rep.plants === 1 && rep.need === false && /還不要求集中污水/.test(row2),
      'D033 驗收 8：推進一天之後，污水廠的卡講全城接管與沒接管的棟數與污水廠座數（＝模擬回報），人口不到 500 時註明還不要求集中污水', `回報 ${J(rep)}；卡片：${row2}`);
  }, { W: 360, H: 740 });

  await run('card', '建築卡講污水', async ({ ev, open }) => {
    await loadCity(open, ev);
    const pop = await ev('__gt.sim()'), blds = (await ev('__gt.conBuildings()')).filter(b => b.k === 1 && !b.gone);
    const got = new Map(); for (const b of blds) got.set(`${b.x},${b.z}`, await ev(`__gt.sewerRows(${b.x},${b.z})`));
    const bad = [], seen = new Set();
    for (const e of exp.rows) {
      const r = got.get(`${e.x},${e.z}`);
      if (!r || r.length !== 1 || r[0][0] !== '污水' || r[0][1] !== e.text) bad.push(`(${e.x},${e.z}) lv${e.lv}：頁面「${J(r)}」≠ 重算「${e.text}」`); else seen.add(e.why);
    }
    log(!bad.length && exp.rows.length === blds.length && exp.pop >= SEWAGE_THRESHOLD442 && [0, 1, 2, 3].every(w => seen.has(w)),
      'D033 驗收 8：煙霧城每一棟住宅的「污水」列＝Node 端用 sewerServed 重算的結果與原因，已接管、沒貼管線、管網裡沒有污水廠、超過 90 格四種都看得到',
      bad.slice(0, 3).join('；') || `人口 ${exp.pop}（≥ ${SEWAGE_THRESHOLD442}）、${blds.length} 棟住宅（頁面）／${exp.rows.length} 棟（重算）；原因碼 ${[...seen].sort().join('、')}`);
    const eff = exp.rows.map(e => e.text);
    log(eff.some(t => /升三級的污水這一關過了/.test(t)) && eff.some(t => /二級升不到三級/.test(t)) && eff.some(t => /高密度污水：幸福 −4%/.test(t)) && eff.some(t => /超過 \d+/.test(t)),
      'D033 驗收 8：後果字都出現——升三級的污水關過了、二級升不到三級、三級住宅高密度污水 −4%', `${exp.rows.length} 列裡各出現過`);
    // 卡片真的印出那一列：每種原因挑一棟
    const cardBad = [];
    for (const why of [0, 1, 2, 3]) {
      const e = exp.rows.find(r => r.why === why); if (!e) continue;
      await ev(`__gt.openTile(${e.x},${e.z})`);
      const card = await ev(CARD), row = card.rows.find(r => r.startsWith('污水')) ?? '';
      if (!card.open || !row.includes(e.text)) cardBad.push(`why ${why} (${e.x},${e.z})：卡上「${row}」`);
    }
    log(!cardBad.length, 'D033 驗收 8：建築卡真的把那一列印出來（四種原因各點一棟）', cardBad.join('；') || '四棟的卡都有');
    // 人口 < 500：起步城
    await open('sample=starter');
    await ev('__gt.simStep(3), 1');
    const h = (await ev('__gt.conBuildings()')).find(b => b.k === 1 && !b.gone), r = h ? await ev(`__gt.sewerRows(${h.x},${h.z})`) : null, p = await ev('__gt.sim()');
    log(!!h && r?.length === 1 && /未達 500：還不要求集中污水/.test(r[0][1]), 'D033 驗收 8：人口不到 500 的城，住宅卡寫「未達 500：還不要求集中污水」', `住宅 (${h?.x},${h?.z})：${J(r)}；人口 ${J(p?.pop ?? null)}`);
  }, { W: 412, H: 860 });

  await run('effect', '蓋污水廠之後', async ({ ev, open }) => {
    const [px, pz] = SMOKE_POND, right = b => b.x >= 37;
    const lv3Right = async () => (await ev('__gt.conBuildings()')).filter(b => b.k === 1 && !b.gone && right(b) && b.lv === 3).length;
    const rowsRight = async () => { const out = []; for (const b of (await ev('__gt.conBuildings()')).filter(b => b.k === 1 && !b.gone && right(b))) out.push((await ev(`__gt.sewerRows(${b.x},${b.z})`))?.[0]?.[1] ?? ''); return out; };
    // 對照組：不蓋廠，推進 13 天
    await loadCity(open, ev);
    await ev('__gt.simStep(1), 1');
    const rep0 = await ev('__gt.sewerRep()'), dr0 = await ev('__gt.dayRep()'), lv0 = await lv3Right(), txt0 = await rowsRight();
    await ev('__gt.simStep(12), 1');
    const lvCtl = await lv3Right();
    // 蓋廠組
    await loadCity(open, ev);
    await ev('__gt.simStep(1), 1');
    const m0 = (await ev('__gt.sim()')).money;
    const put = await ev(`__gt.edit(${J({ k: 'tap', tool: 'sewage', x0: px, z0: pz, x1: px, z1: pz })})`);
    const m1 = (await ev('__gt.sim()')).money;
    await ev('__gt.simStep(1), 1');
    const rep1 = await ev('__gt.sewerRep()'), dr1 = await ev('__gt.dayRep()'), txt1 = await rowsRight();
    log(put?.ok && m0 - m1 === 500 && rep0?.need && rep1?.need && rep1.plants === rep0.plants + 1 && rep1.served > rep0.served && rep1.unserved < rep0.unserved
      && txt0.some(t => /^沒接管：貼著的水管網裡沒有污水廠/.test(t)) && txt1.every(t => /^已接管/.test(t)) && Math.abs((dr1.upkeep - dr0.upkeep) - 3) < 1e-9,
      'D033 驗收 8：右網沒有污水廠；在水塘邊蓋一座（−$500）、推進一天——全城接管棟數增加、右網住宅卡從「沒接管」變「已接管」、當天維護費多 $3',
      `蓋 ${J(put)}、$${m0}→$${m1}；接管 ${rep0?.served}→${rep1?.served}、沒接管 ${rep0?.unserved}→${rep1?.unserved}、廠 ${rep0?.plants}→${rep1?.plants}；維護費 ${dr0?.upkeep}→${dr1?.upkeep}；右網卡 ${J([...new Set(txt0)].map(t => t.slice(0, 14)))}→${J([...new Set(txt1)].map(t => t.slice(0, 8)))}`);
    await ev('__gt.simStep(11), 1');
    const lv1 = await lv3Right();
    log(lvCtl === lv0 && lv1 > lv0, 'D033 驗收 8：再推進十二天，蓋了廠的右網 lv2 住宅升上三級（lv3 變多）；不蓋廠的對照組右網 lv3 數不變（lv2 卡在二級）', `右網 lv3：開始 ${lv0}、對照組第 13 天 ${lvCtl}、蓋廠組第 13 天 ${lv1}`);
  }, { W: 412, H: 860 });

  await run('budget', '手機預算', async ({ ev, open }) => {
    await loadCity(open, ev);
    await ev('__gt.simStep(2), 1');
    const [px, pz] = SMOKE_POND;
    const before = await ev('__gt.renderInfoAll()');
    const put = await ev(`__gt.edit(${J({ k: 'tap', tool: 'sewage', x0: px, z0: pz, x1: px, z1: pz })})`);
    await ev('__gt.simStep(3), 1');
    const after = await ev('__gt.renderInfoAll()');
    log(put?.ok && after.calls <= 18 && after.triangles <= 118884, 'D033 驗收 8：手機預算——蓋了污水廠、推進之後 draw call ≤ 18、三角形 ≤ 118,884', `draw call ${before.calls} → ${after.calls}、三角形 ${before.triangles.toLocaleString()} → ${after.triangles.toLocaleString()}`);
  }, { W: 412, H: 860 });
}
export const d033SkipNote = () => ONLY.length ? `  注意：D033_SMOKE_ONLY＝${ONLY.join(',')}，D033 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d033Smoke(withBrowser, log);
  const note = d033SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

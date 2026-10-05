// D040 煙霧測試：蓋油井與礦場、資源圖視圖、井枯竭事件的瀏覽器半邊（驗收 7）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d040.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome。
//   ui       手機直式 360×740、真的觸控：「公共設施」D040 起 16 顆（D044 起 18 顆）三排（每一顆 ≥ 44×44、都在畫面裡），油井 $1,300、礦場 $1,500 在倒數第四、第三顆；選油井，畫面上的資源圖＝Node 端算的油田空格（只有黃色）、
//            選礦場只有礦藏（藍色）、換別的工具就收掉；☰「顯示資源圖」兩種都顯示、再按一次收掉；點油田的空格蓋成油井（扣 $1,300、歷史 place k49、資源圖少一格）；
//            在礦藏上蓋油井、在沒有資源的空地蓋，都被擋下來（講「需油田資源格」、錢與歷史不動）
//   deplete  底城＋玩家蓋的 7 口井（Node 端推 78 天再存）：頁面再推 2 天，油井 4 口第 80 天耗盡——歷史多 4 筆 depleted（日子與座標＝Node 端同一串）、當天發一則通知「資源耗盡：油井 4 口停產」、
//            ☰「大事記」多 4 行、點井的建築卡「開採」那列講已耗盡；礦場還沒（第 120 天）
//   persist  重新整理：耗盡事件與大事記還在（存檔與日誌讀回來）、資源圖視圖的開關不留（每次開頁預設收掉）
//   budget   手機 draw call ≤ 18、三角形 ≤ 118,884：資源圖全開（☰「顯示資源圖」）、增量重建＝整張重建
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { loadCode, saveCode } from '../src/io/save.ts';
import { builtBase, builtWells } from './d036-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['ui', 'deplete', 'persist', 'budget'];
const ONLY = (process.env.D040_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const SAME = `(()=>{const P=${PICK},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;

// Node 端：底城（M1，沒有井）的資源空格——資源圖只畫「還能蓋井」的格子（陸地、沒路、沒建築）
export function expectedHints() {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const b = builtBase(), L = loadCode(b.code, KT, vrank), s = L.sim, N = s.w.N, oil = [], ore = [];
  for (let i = 0; i < N * N; i++) {
    const r = s.res.resource[i], t = s.w.tiles[i]; if (!r || t.t === 0 || t.road || t.bld) continue;
    (r === 1 ? oil : ore).push([i % N, (i / N) | 0]);
  }
  return { code: b.code, oil, ore, N };
}
// Node 端：玩家蓋 7 口井、推進 days 天之後存的碼，以及繼續推到第 80、120 天的事件
export function expectedDepletion(days = 78) {
  const L = builtWells();
  for (let d = 0; d < days; d++) realDay.stepDay(L.sim);
  const code = saveCode(L.sim, L.template, L.start), put = L.put, day0 = L.sim.day;
  const oilDay = L.sim.day - days + 80, events = [];
  for (let d = days; d < 80; d++) { const r = realDay.stepDay(L.sim); for (const e of r.depleted) events.push({ day: L.sim.day, ...e }); }
  return { code, put, day0, oilDay, events };
}

export async function d040Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D040_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D040 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D040 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const H = expectedHints(), D = expectedDepletion(78);
  const loadCity = async (open, ev, code) => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`); await open(''); };
  const kindsOf = hints => [...new Set(hints.cells.map(c => c[2]))].sort();
  const cellsOf = hints => hints.cells.map(c => `${c[0]},${c[1]}`).sort();
  const want = list => list.map(([x, z]) => `${x},${z}`).sort();

  const HINTS = `__gt.resourceHints()`;
  await run('ui', '手機 360×740 蓋井', async ({ ev, open, tapBtn, tapAt, cell, sim, waitFor, toasts, onScreen, findBox }) => {
    await loadCity(open, ev, H.code);
    await ev('__gt.simMoney(1e6)');
    await tapBtn('.tool[data-t="civic"]');
    const btns = await ev(`[...document.querySelectorAll('#civicSub button')].map(b=>{const r=b.getBoundingClientRect();return [b.dataset.c,Math.round(r.width),Math.round(r.height),r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,Math.round(r.top),b.textContent];})`);
    const rows = new Set(btns.map(b => b[4])).size;
    log(btns.length === 18 && btns.every(b => b[1] >= 44 && b[2] >= 44 && b[3]) && rows === 3 && btns.at(-4)[0] === 'oilwell' && btns.at(-3)[0] === 'mine' && /油井/.test(btns.at(-4)[5]) && /1,?300/.test(btns.at(-4)[5]) && /礦場/.test(btns.at(-3)[5]) && /1,?500/.test(btns.at(-3)[5]),
      'D040 驗收 7：手機 360×740「公共設施」D040 起 16 顆、D044 起 18 顆三排，油井（$1,300）與礦場（$1,500）在倒數第四、第三顆（後面接 D044 的天然氣井與太空研究中心），每一顆 ≥ 44×44 且在畫面裡',
      `按鈕 ${btns.length} 顆 ${rows} 排、最小 ${Math.min(...btns.map(b => b[1]))}×${Math.min(...btns.map(b => b[2]))}；倒數第四、第三顆 ${J(btns.slice(-4, -2).map(b => b[5]))}`);
    // 資源圖：選油井只有油田、選礦場只有礦藏、換別的工具收掉
    await tapBtn('#civicSub button[data-c="oilwell"]');
    const hOil = await ev(HINTS);
    await tapBtn('#civicSub button[data-c="mine"]');
    const hMine = await ev(HINTS);
    await tapBtn('#civicSub button[data-c="park"]');
    const hPark = await ev(HINTS);
    log(J(kindsOf(hOil)) === '[1]' && J(cellsOf(hOil)) === J(want(H.oil)) && J(kindsOf(hMine)) === '[2]' && J(cellsOf(hMine)) === J(want(H.ore)) && hPark.shown === 0 && H.oil.length > 20 && H.ore.length > 20,
      'D040 驗收 3、7：資源圖——選油井只畫油田（黃）、選礦場只畫礦藏（藍）、格子＝Node 端算的「還能蓋井的資源格」（陸地、沒路、沒建築）；換成公園就收掉',
      `油井 ${hOil.shown} 格（Node ${H.oil.length}）、礦場 ${hMine.shown} 格（Node ${H.ore.length}）、公園 ${hPark.shown} 格`);
    // ☰ 顯示資源圖
    const items = await ev('__gt.menuItems()');
    await ev(`__gt.menu('resview')`); const hAll = await ev(HINTS);
    await ev(`__gt.menu('resview')`); const hOff = await ev(HINTS);
    log(items.includes('resview') && hAll.shown === H.oil.length + H.ore.length && J(kindsOf(hAll)) === '[1,2]' && hOff.shown === 0 && hAll.toggle === true && hOff.toggle === false,
      'D040 驗收 3、7：☰「顯示資源圖」——兩種都畫（油黃礦藍）、再按一次收掉', `選單有 resview ${items.includes('resview')}；開 ${hAll.shown} 格（${J(kindsOf(hAll))}）、關 ${hOff.shown} 格`);
    // 蓋井：點油田的空格（沒有樹，造價剛好 $1,300）
    const lay = await ev('__gt.layers()');
    const target = H.oil.find(([x, z]) => !lay.tree[z * lay.n + x]);
    await tapBtn('#civicSub button[data-c="oilwell"]');
    await ev(`__gt.focusTile(${target[0]},${target[1]})`);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    const p = await cell(...target), s0 = await sim(), n0 = (await ev('__gt.history()')).length;
    if (!onScreen(p)) { log(false, 'D040 驗收 7：要蓋的油田格在畫面裡', `(${target}) 螢幕 ${J(p)}`); return; }
    await tapAt(p);
    const s1 = await sim(), h1 = await ev('__gt.history()'), last = h1.at(-1), hAfter = await ev(HINTS);
    log(s1.money === s0.money - 1300 && last?.t === 'place' && last.k === 49 && last.x === target[0] && last.z === target[1] && last.cost === 1300 && h1.length === n0 + 1 && hAfter.shown === H.oil.length - 1 && !cellsOf(hAfter).includes(`${target[0]},${target[1]}`),
      'D040 驗收 7：點油田的空格蓋成油井——資金 −$1,300、歷史多一筆 place（k 49、那一格、$1,300）、資源圖少那一格', `(${target})：$${s0.money}→$${s1.money}；事件 ${J(last)}；資源圖 ${H.oil.length}→${hAfter.shown} 格`);
    // 被擋：礦藏格上蓋油井、沒有資源的空地蓋油井
    const mineCell = H.ore.find(([x, z]) => !lay.tree[z * lay.n + x]), freeIdx = new Set([...H.oil, ...H.ore].map(([x, z]) => z * lay.n + x));
    await ev(`__gt.focusTile(${mineCell[0]},${mineCell[1]})`);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    const none = (await findBox(1, 1, (i, L) => !L.road[i] && !L.occ[i] && L.ter[i] !== 0 && !freeIdx.has(i)))[0];
    const tryAt = async (name, pt) => {
      await waitFor(async () => (await toasts()).length === 0, 4000);
      const a = await sim(), n = (await ev('__gt.history()')).length;
      await tapAt(pt);
      const t = await toasts(), b = await sim(), m = (await ev('__gt.history()')).length;
      return { name, toast: t.some(q => /需油田資源格/.test(q)), same: a.money === b.money && n === m, t, a: a.money, b: b.money, n, m };
    };
    const r1 = await tryAt('礦藏格', await cell(...mineCell)), r2 = none ? await tryAt('沒有資源的空地', none[1]) : null;
    log(r1.toast && r1.same && r2?.toast && r2.same, 'D040 驗收 7：油井點礦藏格、點沒有資源的空地——被擋下來，講「需油田資源格」，資金與歷史都不動',
      `礦藏格 (${mineCell})：提示 ${J(r1.t)}、$${r1.a}→$${r1.b}、歷史 ${r1.n}→${r1.m}；空地 ${none ? `(${none[0]})` : '找不到'}：提示 ${J(r2?.t)}、$${r2?.a}→$${r2?.b}、歷史 ${r2?.n}→${r2?.m}`);
  }, { W: 360, H: 740 });

  await run('deplete', '井枯竭', async ({ ev, open, tapAt, cell, waitFor, toasts, onScreen }) => {
    await loadCity(open, ev, D.code);
    const day = await ev('__gt.sim().day');
    const dep0 = (await ev('__gt.history()')).filter(e => e.t === 'depleted').length;
    await ev('__gt.simStep(1), 1');                                          // 第 79 天：還沒有
    const dep1 = (await ev('__gt.history()')).filter(e => e.t === 'depleted').length;
    await waitFor(async () => (await toasts()).length === 0, 6000);
    await ev('__gt.simStep(1), 1');                                          // 第 80 天：油井 4 口耗盡
    const h = await ev('__gt.history()'), dep = h.filter(e => e.t === 'depleted'), t = await toasts();
    const wantEv = D.events.map(({ day: d, x, z, k }) => ({ day: d, t: 'depleted', x, z, k }));
    log(dep0 === 0 && dep1 === 0 && J(dep) === J(wantEv) && dep.length === 4 && t.some(q => /^資源耗盡：油井 4 口停產$/.test(q)),
      'D040 驗收 4、7：井枯竭——Node 端推 78 天再存的城，頁面再推 2 天：第 79 天沒事、第 80 天油井 4 口耗盡，歷史多 4 筆 depleted（日子與座標＝Node 端同一串）、當天發一則「資源耗盡：油井 4 口停產」',
      `起點第 ${day} 天；depleted ${dep0}→${dep1}→${dep.length}；事件 ${J(dep.slice(0, 2))}；通知 ${J(t)}`);
    await ev(`__gt.menu('chronicle')`);
    const rows = await ev('__gt.chronicleRows()'), dr = rows.filter(r => r.kind === 'depleted');
    const wantTexts = D.events.map(e => `資源耗盡：油井（${e.x}, ${e.z}）停產`).sort();
    log(dr.length === 4 && J(dr.map(r => r.text).sort()) === J(wantTexts) && dr.every(r => r.day === `第 ${D.oilDay.toLocaleString()} 天`),
      'D040 驗收 4、7：☰「大事記」多 4 行「資源耗盡：油井（x, y）停產」（日子＝第 80 天那一天）', `${dr.length} 行：${J(dr.slice(0, 2))}`);
    await ev(`document.getElementById('chX').click()`);
    // 點一口耗盡的井：建築卡的「開採」列講已耗盡、建築歷史有「資源耗盡，停產」
    const w = D.events[0]; await ev(`__gt.focusTile(${w.x},${w.z})`);
    await waitFor(async () => (await toasts()).length === 0, 6000);
    const p = await cell(w.x, w.z);
    if (!onScreen(p)) { log(false, 'D040 驗收 7：耗盡的油井在畫面裡', `(${w.x},${w.z}) 螢幕 ${J(p)}`); return; }
    await tapAt(p);
    const card = await ev(CARD), row = card.rows.find(r => r.startsWith('開採')) ?? '';
    log(card.open && /油井/.test(card.title) && /已耗盡/.test(row) && card.rows.some(r => /資源耗盡，停產/.test(r)), 'D040 驗收 7：點耗盡的油井——建築卡的「開採」列講已耗盡、建築歷史有「資源耗盡，停產」', `標題「${card.title}」、開採列「${row}」、列 ${card.rows.length} 條`);
    // 礦場還沒耗盡（第 120 天）
    const m = D.put.find(q => q[0] === 'ore'); await ev(`__gt.focusTile(${m[1]},${m[2]})`);
    await waitFor(async () => (await toasts()).length === 0, 6000);
    await tapAt(await cell(m[1], m[2]));
    const card2 = await ev(CARD), row2 = card2.rows.find(r => r.startsWith('開採')) ?? '';
    log(card2.open && /礦場/.test(card2.title) && !/已耗盡/.test(row2) && /餘量/.test(row2), 'D040 驗收 7：點礦場——還沒耗盡（第 120 天才到），開採列講餘量', `標題「${card2.title}」、開採列「${row2}」`);
  });

  await run('persist', '重新整理', async ({ ev, open }) => {
    await loadCity(open, ev, D.code);
    await ev('__gt.simStep(2), 1');
    const before = (await ev('__gt.history()')).filter(e => e.t === 'depleted');
    await ev('__gt.saveNow(), 1');
    await open('');                                                           // 同一個網址重新載入：存檔與日誌讀回來
    const after = (await ev('__gt.history()')).filter(e => e.t === 'depleted');
    await ev(`__gt.menu('chronicle')`);
    const rows = (await ev('__gt.chronicleRows()')).filter(r => r.kind === 'depleted');
    const hv = await ev('__gt.resourceHints()');
    log(before.length === 4 && J(after) === J(before) && rows.length === 4 && hv.toggle === false && hv.shown === 0,
      'D040 驗收 7：重新整理——4 筆耗盡事件、大事記 4 行都還在（存檔與日誌讀回來）；資源圖視圖的開關不留（開頁預設收掉）', `存前 ${before.length} 筆、讀回 ${after.length} 筆、大事記 ${rows.length} 行、資源圖 ${hv.shown} 格（開關 ${hv.toggle}）`);
  });

  for (const [W, Hh] of [[412, 860], [360, 740]]) await run('budget', `手機 ${W}×${Hh} 預算`, async ({ ev, open }) => {
    await loadCity(open, ev, H.code);
    const before = await ev('__gt.renderInfoAll()');
    await ev(`__gt.menu('resview')`);
    const hv = await ev(HINTS), after = await ev('__gt.renderInfoAll()'), same = await ev(SAME);
    log(hv.shown === H.oil.length + H.ore.length && after.calls <= 18 && after.triangles <= 118884 && after.calls <= before.calls + 1 && same,
      `D040 驗收 7：手機 ${W}×${Hh}——資源圖全開（${H.oil.length + H.ore.length} 格）之後 draw call ≤ 18、三角形 ≤ 118,884；資源圖只多一個 draw call；增量重建＝整張重建`,
      `draw call ${before.calls}→${after.calls}、三角形 ${before.triangles}→${after.triangles}；資源圖 ${hv.shown} 格；${same ? '＝' : '≠'}`);
  }, { W, H: Hh });
}
export const d040SkipNote = () => ONLY.length ? `  注意：D040_SMOKE_ONLY＝${ONLY.join(',')}，D040 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d040Smoke(withBrowser, log);
  const note = d040SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

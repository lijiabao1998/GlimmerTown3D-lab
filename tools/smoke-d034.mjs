// D034 煙霧測試：摩天樓與巨廈合併的瀏覽器半邊（驗收 7）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d034.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome、手機尺寸（412×860）。
//   tower   M1b（北邊八組住宅簇與八組商業簇、幸福 .83）推進一天：Node 端跑同一座城同一天（本線 stepDay）合併的清單＝頁面回報的 mergeRep；金色提示出現住宅塔與商業塔各自的字（每筆一則）；
//           歷史多了 merge 事件（吸收的建築編號 4 個一筆）；被吸收的建築成了墓碑、新的塔活在根格；點提示鏡頭移到那一格
//   card    點住宅塔的根格：建築卡寫「住宅摩天樓」、佔地 2×2，歷史列「第 N 天：4 棟合併成住宅摩天樓（2×2）：吸收住宅 ×4」；不再冒出「由 2D 存檔推算的蓋起日」那一列（合併就是這棟的蓋起）
//   mega    M2b（九格窗）推進一天：住宅巨廈與商業綜合體各自的提示字（含 MEGA_POP、MEGA_JOBS）、佔地 3×3、卡的合併列有吸收的種類與數量；巨廈那九格的分區清掉
//   scene   合併之後增量重建＝整張重建（D015 的比法）、手機 draw call ≤ 18、三角形 ≤ 118,884；推進十二天之後（住宅塔與商業塔、巨廈都還在）仍然成立
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { MEGA_POP, MEGA_JOBS } from '../src/sim/rules/jobs.ts';
import { mergesToastText } from '../src/sim/rules/merge.ts';
import { d034Runs } from './d034-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['tower', 'card', 'mega', 'scene'];
const ONLY = (process.env.D034_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',sub:b.querySelector('.sub')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const SAME = `(()=>{const P=${PICK},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;

// Node 端：把一座 M 城讀成 Sim、推進 days 天，回傳每天的合併清單（本線 stepDay；頁面跟它吃同一張碼，要得到同樣的結果）
export function expectedMerges(id, days = 1) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const c = d034Runs().find(r => r.id === id), s = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank), out = [];
  for (let d = 0; d < days; d++) out.push(realDay.stepDay(s).merges.map(m => ({ x: m.x, z: m.z, k: m.k, size: m.size, absorbed: m.from.length })));
  return { code: c.code, days: out };
}

export async function d034Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D034_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D034 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D034 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const M1 = expectedMerges('M1b', 13), M2 = expectedMerges('M2b', 13);
  const loadCity = async (open, ev, code) => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`); await open(''); };
  const MERGE_TOAST = /落成！|拔地而起！|開幕！|今天 \d+ 處合併/;   // D042：合併提示（單筆的三種字＋多筆合成的字；別的提示像「合併發生犯罪」不算）
  const toasts = ev => ev(`[...document.querySelectorAll('#toasts .toast')].map(e => e.textContent)`);

  await run('tower', '塔的提示與歷史', async ({ ev, open, waitFor }) => {
    await loadCity(open, ev, M1.code);
    const n0 = (await ev('__gt.history()')).filter(e => e.t === 'merge').length, alive0 = (await ev('__gt.conBuildings()')).filter(b => !b.gone).length;
    await ev('__gt.simStep(1), 1');
    const rep = await ev('__gt.mergeRep()'), tx = await toasts(ev), h = (await ev('__gt.history()')).filter(e => e.t === 'merge'), blds = await ev('__gt.conBuildings()');
    const want = M1.days[0];
    const gone = h.flatMap(e => e.from).filter(id => blds.find(b => b.id === id)?.gone).length, born = h.filter(e => blds.some(b => b.x === e.x && b.z === e.z && b.k === e.k && !b.gone && b.s === e.size)).length;
    const text = mergesToastText(want, MEGA_POP, MEGA_JOBS), mergeToasts = tx.filter(t => MERGE_TOAST.test(t));   // D042：同一天多筆合成一則
    log(J(rep) === J(want) && want.length >= 3 && J(mergeToasts) === J([text]) && h.length === n0 + want.length && h.every(e => e.from.length === 4 && e.size === 2) && gone === 4 * want.length && born === want.length,
      'D034 驗收 7＋D042：M1b 推進一天——頁面回報的合併＝Node 端同一座城同一天本線 stepDay 的清單（住宅塔與商業塔共三筆）；同一天三筆合成一則金色提示（D042；一筆時字照實驗線，見下一項）；歷史多了 merge 事件（吸收的編號 4 個）；被吸收的建築成了墓碑、新的塔活在根格',
      `回報 ${J(rep)}；提示 ${J(tx)}；merge 事件 ${h.length - n0} 筆；墓碑 ${gone}／新建築 ${born}；建築 ${alive0}→${blds.filter(b => !b.gone).length}`);
    // 點提示：鏡頭移到那一格（focusTile）
    await ev('__gt.focusTile(0,0), 1');
    const clicked = await ev(`(()=>{const t=[...document.querySelectorAll('#toasts .toast')].find(e=>e.textContent.includes('住宅摩天樓'));if(!t)return null;t.click();return 1;})()`);
    log(clicked === 1, 'D034 驗收 7＋D042：點合併的提示不丟例外（鏡頭移過去，第一筆）', `點到 ${clicked}`);
    // D042：接著推到第 13 天，每天的合併提示＝Node 端那一天的清單合成的字（一筆＝實驗線的字、多筆＝「今天 N 處合併」；沒合併的日子沒有合併提示）
    const bad = [];
    for (let d = 1; d < M1.days.length; d++) {
      await ev(`document.querySelectorAll('#toasts .toast').forEach(e => e.remove()), 1`);
      await ev('__gt.simStep(1), 1');
      const got = (await toasts(ev)).filter(t => MERGE_TOAST.test(t)), list = M1.days[d], wantT = list.length ? [mergesToastText(list, MEGA_POP, MEGA_JOBS)] : [];
      if (J(got) !== J(wantT)) bad.push(`第 ${d + 1} 天 ${J(got)} ≠ ${J(wantT)}`);
    }
    log(!bad.length, 'D042 驗收：M1b 第 2–13 天每天的合併提示＝Node 端那一天清單合成的字（第 7、9 天各一筆＝實驗線的字「🏙️ 住宅摩天樓落成！」；沒合併的日子沒有提示）', bad.slice(0, 3).join('；') || `${M1.days.length - 1} 天全對（單筆日 ${M1.days.slice(1).filter(l => l.length === 1).length} 天）`);
  }, { W: 412, H: 860 });

  await run('card', '塔的建築卡', async ({ ev, open }) => {
    await loadCity(open, ev, M1.code);
    await ev('__gt.simStep(1), 1');
    const t = M1.days[0].find(m => m.k === 33);
    await ev(`__gt.openTile(${t.x + 1},${t.z + 1})`);                              // 點塔的任一格（右下的附屬格）＝整棟
    const card = await ev(CARD), row = card.rows.find(r => /合併成/.test(r)) ?? '';
    log(card.open && /住宅摩天樓/.test(card.title) && /2×2/.test(card.sub) && /4 棟合併成住宅摩天樓（2×2）：吸收住宅 ×4/.test(row) && !card.rows.some(r => /由 2D 存檔的 age/.test(r)),
      'D034 驗收 7：點住宅塔（附屬格也行）——建築卡寫「住宅摩天樓」、佔地 2×2，歷史列「4 棟合併成住宅摩天樓（2×2）：吸收住宅 ×4」', `卡片「${card.title}」${card.sub}；合併列「${row}」`);
  }, { W: 412, H: 860 });

  await run('mega', '巨廈的提示與卡', async ({ ev, open }) => {
    await loadCity(open, ev, M2.code);
    await ev('__gt.simStep(1), 1');
    const rep = await ev('__gt.mergeRep()'), tx = await toasts(ev), want = M2.days[0];
    const text = mergesToastText(want, MEGA_POP, MEGA_JOBS), mergeToasts = tx.filter(t => MERGE_TOAST.test(t));
    log(J(rep) === J(want) && want.some(m => m.k === 105) && want.some(m => m.k === 106) && want.every(m => m.size === 3) && J(mergeToasts) === J([text]) && text === '🏙️ 今天 2 處合併：住宅巨廈 ×1、商業綜合體 ×1',
      'D034 驗收 7＋D042：M2b 推進一天——巨廈與綜合體同一天合成一則「今天 2 處合併：住宅巨廈 ×1、商業綜合體 ×1」、回報＝Node 端的清單、邊長 3', `回報 ${J(rep)}；提示 ${J(tx)}`);
    // 第 4 天只有一座住宅巨廈：一筆＝實驗線的字（居民人數）
    await ev('__gt.simStep(2), 1'); await ev(`document.querySelectorAll('#toasts .toast').forEach(e => e.remove()), 1`);
    await ev('__gt.simStep(1), 1');
    const t4 = (await toasts(ev)).filter(t => MERGE_TOAST.test(t)), w4 = M2.days[3];
    log(w4.length === 1 && w4[0].k === 105 && J(t4) === J([`🌆 住宅巨廈拔地而起！（居民 ${MEGA_POP} 人）`]), `D042 驗收：M2b 第 4 天只有一座住宅巨廈——一筆＝實驗線的字「🌆 住宅巨廈拔地而起！（居民 ${MEGA_POP} 人）」`, `Node 端 ${J(w4.map(m => m.k))}；提示 ${J(t4)}`);
    const m = want.find(q => q.k === 105);
    await ev(`__gt.openTile(${m.x + 2},${m.z + 2})`);
    const card = await ev(CARD), row = card.rows.find(r => /合併成/.test(r)) ?? '';
    log(card.open && /住宅巨廈/.test(card.title) && /3×3/.test(card.sub) && /棟合併成住宅巨廈（3×3）：吸收/.test(row), 'D034 驗收 7：點住宅巨廈（右下角的附屬格）——建築卡寫「住宅巨廈」、佔地 3×3，合併列講吸收的種類與數量', `卡片「${card.title}」${card.sub}；合併列「${row}」`);
  }, { W: 412, H: 860 });

  await run('scene', '合併之後的場景與預算', async ({ ev, open }) => {
    await loadCity(open, ev, M2.code);
    const before = await ev('__gt.renderInfoAll()');
    await ev('__gt.simStep(1), 1');
    const same1 = await ev(SAME);
    await ev('__gt.simStep(12), 1');
    const same2 = await ev(SAME), after = await ev('__gt.renderInfoAll()'), tw = (await ev('__gt.conBuildings()')).filter(b => !b.gone && [33, 34, 105, 106].includes(b.k)).length;
    log(same1 && same2 && after.calls <= 18 && after.triangles <= 118884 && tw >= 3,
      'D034 驗收 7：合併之後（第 1 天、第 13 天）增量重建＝整張重建（D015 的比法）；手機 draw call ≤ 18、三角形 ≤ 118,884；塔與巨廈都活著',
      `${[same1, same2].map(v => v ? '＝' : '≠').join('')}；draw call ${before.calls} → ${after.calls}、三角形 ${before.triangles.toLocaleString()} → ${after.triangles.toLocaleString()}；塔與巨廈 ${tw} 棟`);
  }, { W: 412, H: 860 });
}
export const d034SkipNote = () => ONLY.length ? `  注意：D034_SMOKE_ONLY＝${ONLY.join(',')}，D034 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d034Smoke(withBrowser, log);
  const note = d034SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

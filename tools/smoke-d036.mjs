// D036 煙霧測試：資源開採的瀏覽器半邊（驗收 6）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d036.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome、手機尺寸（412×860）。
//   card    W1：點油井、礦場的建築卡有「開採」一列——站對資源格的講已開採／餘量／每天抽多少；推進一天之後已開採多了一天的量；站錯的（油井在礦藏上、礦場在油田上、井在沒有資源的格子上）照實講不產出
//   exhaust W3（存檔帶著 rdep）：剛好滿 240 的井講「已耗盡」；剩 1 的井推進一天之後也耗盡；頁面回報的開採量＝Node 端同一座城同一天本線 stepDay 的
//   scene   沒有改畫面：推進之後增量重建＝整張重建（D015 的比法）、手機 draw call ≤ 18、三角形 ≤ 118,884
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { d036Runs } from './d036-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['card', 'exhaust', 'scene'];
const ONLY = (process.env.D036_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',sub:b.querySelector('.sub')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const SAME = `(()=>{const P=${PICK},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;

// Node 端：把一座 W 城讀成 Sim、推進 days 天，回傳每天的開採（本線 stepDay；頁面跟它吃同一張碼，要得到同樣的結果）
export function expectedResource(id, days = 1) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const c = d036Runs().find(r => r.id === id), s = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank), out = [];
  for (let d = 0; d < days; d++) out.push(realDay.stepDay(s).resource);
  return { code: c.code, put: c.put, days: out, rdep: s.res.rdep };
}

export async function d036Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D036_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D036 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D036 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const W1 = expectedResource('W1', 2), W3 = expectedResource('W3', 1);
  const loadCity = async (open, ev, code) => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`); await open(''); };
  const row = async (ev, x, z) => { await ev(`__gt.openTile(${x},${z})`); const c = await ev(CARD); return { title: c.title, row: c.rows.find(r => r.startsWith('開採')) ?? '' }; };
  const at = (put, name, q = 0) => put.filter(p => p[0] === name)[q];

  await run('card', '井的建築卡', async ({ ev, open }) => {
    await loadCity(open, ev, W1.code);
    const oil = at(W1.put, 'oil'), ore = at(W1.put, 'ore'), badOil = at(W1.put, 'well-on-ore'), badMine = at(W1.put, 'mine-on-oil'), none = at(W1.put, 'oil-on-none');
    const a = await row(ev, oil[1], oil[2]), b = await row(ev, ore[1], ore[2]);
    log(/油井/.test(a.title) && /站在油田上，已開採 0／240（餘量 240），每天抽 3 供應品/.test(a.row) && /礦場/.test(b.title) && /站在礦藏上，已開採 0／240（餘量 240），每天抽 2 供應品/.test(b.row),
      'D036 驗收 6：點油井、礦場——建築卡有「開採」一列：站對資源格，講已開採 0／240、餘量、每天抽幾個（油 3、礦 2）、油與礦各自煉成什麼', `油井「${a.row}」；礦場「${b.row}」`);
    await ev('__gt.simStep(1), 1');
    const rep = await ev('__gt.lastDay()?.resource ?? null'), a1 = await row(ev, oil[1], oil[2]), b1 = await row(ev, ore[1], ore[2]);
    log(J(rep) === J(W1.days[0]) && /已開採 3／240（餘量 237），每天抽 3/.test(a1.row) && /已開採 2／240（餘量 238），每天抽 2/.test(b1.row) && /最近一天全城開採：油 \d+、礦 \d+/.test(a1.row),
      'D036 驗收 6：推進一天——頁面回報的開採＝Node 端同一座城同一天本線 stepDay 的；油井已開採 3、礦場已開採 2，卡片跟著變；卡片講最近一天全城的開採量', `回報 ${J(rep)}（Node ${J(W1.days[0])}）；油井「${a1.row}」；礦場「${b1.row}」`);
    const c = await row(ev, badOil[1], badOil[2]), d = await row(ev, badMine[1], badMine[2]), e = await row(ev, none[1], none[2]);
    log(/這一格是礦藏，油井要站在油田上才有產出/.test(c.row) && /這一格是油田，礦場要站在礦藏上才有產出/.test(d.row) && /這一格沒有資源，油井要站在油田上才有產出/.test(e.row),
      'D036 驗收 6：站錯的井照實講不產出（油井在礦藏上、礦場在油田上、油井在沒有資源的格子上）', `「${c.row}」「${d.row}」「${e.row}」`);
  }, { W: 412, H: 860 });

  await run('exhaust', '耗盡', async ({ ev, open }) => {
    await loadCity(open, ev, W3.code);
    const full = at(W3.put, 'oil', 2), last = at(W3.put, 'oil', 0);   // rdep 的 [oil 0, 239]、[oil 2, 240]
    const a = await row(ev, full[1], full[2]), b = await row(ev, last[1], last[2]);
    log(/已耗盡（開採 240／240），不再產出/.test(a.row) && /已開採 239／240（餘量 1），每天抽 1/.test(b.row),
      'D036 驗收 6：存檔帶著耗損——剛好滿 240 的井講「已耗盡」；只剩 1 的井講「每天抽 1」', `滿的「${a.row}」；剩 1 的「${b.row}」`);
    await ev('__gt.simStep(1), 1');
    const b1 = await row(ev, last[1], last[2]), rep = await ev('__gt.lastDay()?.resource ?? null');
    log(/已耗盡（開採 240／240）/.test(b1.row) && J(rep) === J(W3.days[0]), 'D036 驗收 6：推進一天——剩 1 的井抽完最後 1、隔天卡片講已耗盡；頁面回報的開採＝Node 端的', `「${b1.row}」；回報 ${J(rep)}（Node ${J(W3.days[0])}）`);
  }, { W: 412, H: 860 });

  await run('scene', '畫面沒有變', async ({ ev, open }) => {
    await loadCity(open, ev, W1.code);
    const before = await ev('__gt.renderInfoAll()');
    await ev('__gt.simStep(1), 1');
    const same = await ev(SAME), after = await ev('__gt.renderInfoAll()');
    log(same && after.calls <= 18 && after.triangles <= 118884, 'D036 驗收 6：沒有改畫面——推進一天之後增量重建＝整張重建（D015 的比法）；手機 draw call ≤ 18、三角形 ≤ 118,884',
      `${same ? '＝' : '≠'}；draw call ${before.calls} → ${after.calls}、三角形 ${before.triangles.toLocaleString()} → ${after.triangles.toLocaleString()}`);
  }, { W: 412, H: 860 });
}
export const d036SkipNote = () => ONLY.length ? `  注意：D036_SMOKE_ONLY＝${ONLY.join(',')}，D036 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d036Smoke(withBrowser, log);
  const note = d036SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

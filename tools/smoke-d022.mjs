// D022 煙霧測試：糧食（驗收 4 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d022.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。一個 Chrome。
//   card  起步城（沙盒）推進到有住宅：住宅的建築卡多一列「糧食」，連著三天卡上的數字（供糧率、需求、本地、進口、額度、每天幸福的加減）＝當天回報 __gt.lastDay().food（起步城沒有農場、額度 3：進口 min(3, 需求)，人口長大後供糧率掉到一半以下、幸福轉成減）；
//         AI 城 120 天當成「我的城」讀進來：推進之前（沒有當天的回報）卡上講「推進一天之後才算得出來」，推進一天之後講供糧率 100%（食物 121 ≥ 需求 112）、每天幸福 +5.0
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['card'];
const ONLY = (process.env.D022_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
// 卡上「糧食」一列的樣子（tools 這一邊獨立寫一次：src/cityView.ts 的 foodRow 是另一份）
const expected = f => {
  const d = f.delta * 100;
  return `糧食供糧率 ${Math.round(f.rate * 100)}%（需求 ${f.need}：本地 ${f.domestic}＋進口 ${f.imports}，進口額度 ${f.cap}）；每天幸福 ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`;
};

export async function d022Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D022_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  if (ONLY.length && !ONLY.includes('card')) return;
  const t0 = Date.now(), ai = read('src/content/samples/ai120.code.txt').trim();
  await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    try {
      const { ev } = await pageSession(page, open, { W: 412, H: 860 });
      // 起步城：推進到有住宅，連三天卡上的糧食一列＝當天回報
      await open('sample=starter');
      let homes = [];
      for (let d = 0; d < 12 && homes.length < 3; d++) { await ev('__gt.simStep(1), 1'); homes = (await ev('__gt.conBuildings()')).filter(b => !b.gone && b.k === 1); }
      const h0 = homes[0], days = [];
      for (let d = 0; d < 3 && h0; d++) {
        await ev('__gt.simStep(1), 1');
        const f = (await ev('__gt.lastDay()')).food;
        await ev(`__gt.openTile(${h0.x},${h0.z})`);
        const card = await ev(CARD), row = card.rows.find(r => r.startsWith('糧食')) ?? '';
        days.push({ f, row, ok: row === expected(f) });
      }
      // 起步城沒有農場、路格 < 80：額度 3、本地 0、進口 min(3, 需求)；供糧率＝進口／需求，每天幸福＝(供糧率 − .5)×.11 夾在 −.06～.05（這一邊獨立寫一次算式）
      const clampD = v => Math.max(-.06, Math.min(.05, v)), shape = days.every(x => x.f.cap === 3 && x.f.points === 0 && x.f.tourists === 0 && x.f.imports === Math.min(3, x.f.need) && x.f.rate === x.f.imports / x.f.need && x.f.delta === clampD((x.f.rate - .5) * .11));
      // 人口長大之後供糧率掉到一半以下、每天幸福轉成減：再推進到那一天，卡上寫「−」
      let neg = null;
      for (let d = 0; d < 20 && h0 && !neg; d++) {
        await ev('__gt.simStep(1), 1');
        const f = (await ev('__gt.lastDay()')).food;
        if (f.rate < .5) { await ev(`__gt.openTile(${h0.x},${h0.z})`); const row = ((await ev(CARD)).rows.find(r => r.startsWith('糧食')) ?? ''); neg = { f, row, ok: row === expected(f) && /每天幸福 −/.test(row) }; }
      }
      log(!!h0 && days.length === 3 && days.every(x => x.ok) && shape && !!neg?.ok,
        'D022 驗收 4：起步城（沙盒）推進到有住宅，住宅的建築卡多一列「糧食」，連著三天卡上的數字（供糧率、需求、本地、進口、額度、每天幸福的加減）＝當天回報 lastDay().food；起步城沒有農場、額度 3：進口 min(3, 需求)、每天幸福＝(供糧率−.5)×.11；人口長大、供糧率掉到一半以下時卡上寫「每天幸福 −」',
        `住宅 (${h0?.x},${h0?.z})：${days.map(x => `「${x.row}」${x.ok ? '＝' : '≠ ' + (x.f ? expected(x.f) : '')}`).join('；')}；算式 ${shape ? '＝' : '≠'}；供糧率掉到一半以下：${neg ? `「${neg.row}」${neg.ok ? '＝' : '≠'}` : '沒等到'}`);
      // AI 城 120 天當成「我的城」：推進之前沒有當天的回報
      await open('sample=seed516&clean=1'); await ev('__gt.clearSave()');
      await ev(`localStorage.setItem('gt3d.v1.save', ${J(ai)})`);
      await open('');
      const homes2 = (await ev('__gt.conBuildings()')).filter(b => !b.gone && b.k === 1), g0 = homes2[0];
      await ev(`__gt.openTile(${g0.x},${g0.z})`);
      const before = (await ev(CARD)).rows.find(r => r.startsWith('糧食')) ?? '';
      await ev('__gt.simStep(1), 1');
      const f1 = (await ev('__gt.lastDay()')).food;
      await ev(`__gt.openTile(${g0.x},${g0.z})`);
      const after = (await ev(CARD)).rows.find(r => r.startsWith('糧食')) ?? '';
      log(homes2.length > 50 && /推進一天之後才算得出來/.test(before) && after === expected(f1) && f1.rate === 1 && f1.points >= f1.need && f1.imports === 0 && Math.abs(f1.delta - .05) < 1e-12,
        'D022 驗收 4：AI 城 120 天當成「我的城」讀進來——推進之前卡上講「推進一天之後才算得出來」；推進一天之後講供糧率 100%（食物 ≥ 需求、不進口）、每天幸福 +5.0，數字＝當天回報',
        `住宅 (${g0?.x},${g0?.z})（共 ${homes2.length} 棟）：之前「${before}」；之後「${after}」；那一天 ${J(f1)}`);
    } catch (e) { log(false, 'D022 card：整段跑完', '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, 'D022 card：零外部請求、console 零錯誤',
      (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
export const d022SkipNote = () => ONLY.length ? `  注意：D022_SMOKE_ONLY＝${ONLY.join(',')}，D022 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d022Smoke(withBrowser, log);
  const note = d022SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

// D021 煙霧測試：讀進來的城的人口（驗收 1、2 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d021.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一座城一個 Chrome。
//   load  把 AI 城 120 天、種子城當成「我的城」（存檔）讀進來：第一天之前 __gt.sim().pop 就是實驗線讀檔後的人口（樣本 src/content/samples/d021-lab.json；種子城 5,436），
//         推進一天之後 sim.pop 與狀態列都是實驗線推進一天後的人口（種子城 1,400：讀檔算沒電、沒水的住宅，推進一天只算有電的，住宅塔與巨廈照算）。
//         讀檔後、第一天之前狀態列的人口照 D011 的決定顯示「—」（tools/smoke-d011.mjs 釘著），這裡不動它
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['load'];
const ONLY = (process.env.D021_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);

export async function d021Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D021_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  if (ONLY.length && !ONLY.includes('load')) return;
  const lab = JSON.parse(read('src/content/samples/d021-lab.json'));
  for (const id of ['ai120', 'seed516']) {
    const t0 = Date.now(), L = lab.cities[id], code = read(`src/content/samples/${id}.code.txt`).trim();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try {
        const { ev } = await pageSession(page, open, { W: 412, H: 860 });
        await open('sample=seed516&clean=1'); await ev('__gt.clearSave()');
        await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`);
        await open('');
        const a = await ev(`(()=>{const s=__gt.sim();return {sample:__gt.sample,pop:s?.pop,day:s?.day,chip:document.querySelector('#stats [data-k=pop]')?.textContent??null};})()`);
        await ev('(__gt.simStep(1), 1)');
        const b = await ev(`(()=>{const s=__gt.sim();return {pop:s?.pop,day:s?.day,chip:document.querySelector('#stats [data-k=pop]')?.textContent??null};})()`);
        const digits = t => String(t ?? '').replace(/[^\d]/g, '');
        log(a.sample === 'mine' && a.pop === L.popImport && a.day === L.dayImport && b.pop === L.popTick && b.day === L.dayTick && digits(b.chip).includes(String(L.popTick)),
          `D021 驗收 1、2：${id} 當成「我的城」讀進來——第一天之前 sim.pop＝實驗線讀檔後的人口（${L.popImport}），推進一天後 sim.pop 與狀態列＝實驗線推進一天後的人口（${L.popTick}）`,
          `讀檔後：第 ${a.day} 天、人口 ${a.pop}（狀態列「${a.chip}」，D011 的決定）；推進一天：第 ${b.day} 天、人口 ${b.pop}、狀態列「${b.chip}」`);
      } catch (e) { log(false, `D021 ${id}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D021 ${id}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  }
}
export const d021SkipNote = () => ONLY.length ? `  注意：D021_SMOKE_ONLY＝${ONLY.join(',')}，D021 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d021Smoke(withBrowser, log);
  const note = d021SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

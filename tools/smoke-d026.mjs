// D026 煙霧測試：每日災禍的瀏覽器半邊（驗收 8）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d026.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。一個 Chrome、手機尺寸（412×860）。
//   card    自己造的小城（燃燒的工業、犯罪的商業、生病的住宅、死亡中的住宅、犯罪＋廢棄、生病＋犯罪、兩格焦土；當成「我的城」讀進來）：每種旗標的建築卡多對的字、對的按鈕
//           （滅火 $30、處理犯罪、治療 $50；死亡中沒有按鈕）；按鈕真的按下去：扣錢、旗標清掉、講實驗線的字、卡片關掉、歷史多一筆 act；錢不夠講「資金不足！…」、卡片留著、旗標不動；
//           焦土格的卡；標記寶石數＝帶旗標的建築的旗標數、空的時候不畫（draw call 少 1）；清焦土記成 doze ruin、復原回來；地面貼圖上焦土是炭黑
//   alerts  H2（一千九百多棟的混排城）推進一天：當天發生的每一種災禍講一則實驗線的原句（火災、犯罪、廢棄、疾病、死亡），字裡帶城名
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { builder } from './d021-cities.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { cities26 } from './d026-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['card', 'alerts'];
const ONLY = (process.env.D026_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',sub:b.querySelector('.sub')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent),acts:[...b.querySelectorAll('.acts button')].map(x=>x.dataset.act+'｜'+x.textContent)};})()`;
const TOASTS = `[...document.querySelectorAll('#toasts .toast')].map(t=>t.textContent)`;

// 小城：z=30 一條路、發電廠；每個座標一種情境（字母見上面 card 的說明）
export function smallCity(template, sizeOf) {
  const b = builder(template, sizeOf);
  b.road(4, 30, 30, 30).put(3, 30, 5);
  b.put(10, 29, 3, 2, { fire: 2 });                                               // A 燃燒的工業（第 2 天）
  b.put(12, 29, 2, 2).flag('cm', 12, 29).flag('cmd', 12, 29, 3);                  // B 犯罪的商業（3 天）
  b.put(10, 31, 1, 2).flag('sk', 10, 31).flag('skd', 10, 31, 1);                  // C 生病的住宅（1 天）
  b.put(12, 31, 1, 2).flag('dt', 12, 31).flag('dtd', 12, 31, 2);                  // D 死亡中的住宅（第 2 天）
  b.put(14, 31, 1, 2).flag('cm', 14, 31).flag('cmd', 14, 31, 15).flag('ab', 14, 31);   // E 犯罪 15 天＋廢棄
  b.put(16, 31, 1, 2).flag('sk', 16, 31).flag('cm', 16, 31);                      // F 生病＋犯罪
  b.put(18, 31, 1, 2);                                                            // 乾淨的住宅
  b.put(11, 33, 3, 1, { fire: 1 });                                               // G 另一棟燃燒的工業（資金不足那次用）
  b.flag('rn', 20, 33).flag('rn', 21, 33);                                        // 兩格焦土
  return b.code(5162026, 40, '災禍煙霧', { money: 3000 });
}
// 各座標的預期：{ 座標: [卡上要有的列開頭, 按鈕] }
const CASES = {
  A: { at: [10, 29], rows: ['🔥 燃燒中'], acts: ['fire｜🧯 滅火 $30'] },
  B: { at: [12, 29], rows: ['🚓 發生犯罪！'], acts: ['crime｜✅ 處理犯罪'] },
  C: { at: [10, 31], rows: ['🏥 生病中！'], acts: ['sick｜💊 治療 $50'] },
  D: { at: [12, 31], rows: ['💀 發生憾事'], acts: [] },
  E: { at: [14, 31], rows: ['🚓 發生犯罪！'], acts: ['crime｜✅ 處理犯罪'] },
  F: { at: [16, 31], rows: ['🏥 生病中！', '🚓 發生犯罪！'], acts: ['crime｜✅ 處理犯罪', 'sick｜💊 治療 $50'] },
};

export async function d026Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D026_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const want = k => !ONLY.length || ONLY.includes(k);
  const t0 = Date.now(), KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), newcity = read('src/content/samples/newcity.code.txt'), template = decodeLabCode(newcity.trim()).save.raw;
  const small = smallCity(template, k => KT.size(k));
  await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    try {
      const { ev } = await pageSession(page, open, { W: 412, H: 860 });
      const load = async code => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`); await open(''); };
      if (want('card')) {
        await load(small);
        const flags0 = {}; for (const [k, c] of Object.entries(CASES)) flags0[k] = await ev(`__gt.flags(${c.at[0]},${c.at[1]})`);
        const hz0 = await ev('__gt.hazard()'), calls1 = (await ev('(__gt.renderInfoAll(), __gt.renderInfo())')).calls;
        // 每種旗標的卡
        const cards = {};
        for (const [k, c] of Object.entries(CASES)) { await ev(`__gt.openTile(${c.at[0]},${c.at[1]})`); cards[k] = await ev(CARD); }
        const cardBad = Object.entries(CASES).filter(([k, c]) => c.rows.some(r => !cards[k].rows.some(x => x.startsWith(r))) || J(cards[k].acts) !== J(c.acts) || !cards[k].open).map(([k]) => k);
        const clean = await (async () => { await ev('__gt.openTile(18,31)'); return ev(CARD); })(), aband = cards.E.sub.includes('已遭遺棄');
        log(!cardBad.length && clean.acts.length === 0 && !clean.rows.some(x => /^(🔥|🚓|🏥|💀)/.test(x)) && aband && Object.values(flags0).every(Boolean),
          'D026 驗收 8：建築卡——燃燒、犯罪、生病、死亡中各多對的一列（前半句照實驗線），按鈕對（滅火 $30、處理犯罪、治療 $50；死亡中沒有按鈕；生病＋犯罪兩顆）；乾淨的住宅沒有；廢棄的卡副標題講「已遭遺棄」',
          cardBad.length ? `不對：${cardBad.map(k => `${k}｜${J(cards[k].rows.slice(0, 3))}｜${J(cards[k].acts)}`).join('；')}` : `A「${cards.A.rows[0]}」${cards.A.acts}；F ${cards.F.acts.join('＋')}；D 無按鈕；E 副標題「${cards.E.sub}」`);
        // 標記：帶旗標的建築每種旗標一顆寶石（A 火 1、B 犯罪 1、C 病 1、D 死 1、E 犯罪＋廢棄 2、F 病＋犯罪 2、G 火 1＝9）；焦土 2 格
        const marks = hz0.marks, expectMarks = 9;
        log(marks === expectMarks && hz0.visible && hz0.ruins === 2 && calls1 <= 18, 'D026 驗收 8：標記——帶旗標的建築每種旗標一顆寶石（9 顆）、焦土 2 格；手機預算 draw call ≤ 18',
          `寶石 ${marks}（要 ${expectMarks}）、可見 ${hz0.visible}、焦土 ${hz0.ruins} 格、draw call ${calls1}`);
        // 焦土在地面貼圖上是炭黑；旁邊的草地是綠的；空的時候不畫寶石（draw call 少 1）
        const px = async (x, z) => { const g = await ev(`__gt.groundAt(${x},${z})`), n = g.length / 3, c = Math.floor(n / 2) * 3 + 3 * 0; return g.slice(c, c + 3); };
        const ruinPx = await px(20, 33), grassPx = await px(24, 36);
        const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
        const inkOk = avg(ruinPx) < 90 && grassPx[1] > grassPx[0] && grassPx[1] > grassPx[2];
        for (const c of Object.values(CASES)) await ev(`__gt.setFlags(${c.at[0]},${c.at[1]},{fire:0,crime:0,crimeDays:0,sick:0,sickDays:0,death:0,deathAge:0,abandoned:0})`);
        await ev('__gt.setFlags(11,33,{fire:0})');
        const hz1 = await ev('__gt.hazard()'), calls0 = (await ev('(__gt.renderInfoAll(), __gt.renderInfo())')).calls;
        log(inkOk && hz1.marks === 0 && !hz1.visible && calls0 === calls1 - 1, 'D026 驗收 8：焦土畫在地面貼圖上（炭黑，不佔 draw call）；沒有標記時寶石網格不畫（draw call 少 1）',
          `焦土格中心 RGB ${J(ruinPx)}（平均 ${avg(ruinPx).toFixed(0)}）、草地 ${J(grassPx)}；旗標清光後寶石 ${hz1.marks}、可見 ${hz1.visible}、draw call ${calls1} → ${calls0}`);
        // 按鈕真的按下去（重讀一次，旗標回來）
        await load(small);
        const m0 = (await ev('__gt.sim()')).money, ev0 = (await ev('__gt.sim()')).events, res = [];
        const press = async (k, what) => {
          const c = CASES[k]; await ev(`__gt.openTile(${c.at[0]},${c.at[1]})`);
          const before = { m: (await ev('__gt.sim()')).money, f: await ev(`__gt.flags(${c.at[0]},${c.at[1]})`), n: (await ev('__gt.sim()')).events };
          await ev(`document.querySelector('#bio .acts button[data-act="${what}"]').click()`);
          const after = { m: (await ev('__gt.sim()')).money, f: await ev(`__gt.flags(${c.at[0]},${c.at[1]})`), n: (await ev('__gt.sim()')).events, card: await ev(CARD), toasts: await ev(TOASTS) };
          return { k, what, before, after };
        };
        const a = await press('A', 'fire'), b = await press('B', 'crime'), c2 = await press('C', 'sick');
        res.push(a, b, c2);
        const okA = a.after.m === a.before.m - 30 && a.after.f.fire === 0 && a.after.n === a.before.n + 1 && !a.after.card.open && a.after.toasts.includes('🧯 火勢已撲滅！');
        const okB = b.after.m === b.before.m && b.after.f.crime === 0 && b.after.f.crimeDays === 0 && b.after.n === b.before.n + 1 && !b.after.card.open && b.after.toasts.includes('🚓 犯罪已處理');
        const okC = c2.after.m === c2.before.m - 50 && c2.after.f.sick === 0 && c2.after.n === c2.before.n + 1 && !c2.after.card.open && c2.after.toasts.includes('🏥 病情已控制');
        const hz2 = await ev('__gt.hazard()');
        log(okA && okB && okC && hz2.marks === 6, 'D026 驗收 8：按鈕——滅火扣 $30、處理犯罪免費（犯罪與天數歸零）、治療扣 $50；旗標清掉、講實驗線的字（🧯 火勢已撲滅！、🚓 犯罪已處理、🏥 病情已控制）、卡片關掉、歷史各多一筆 act；標記跟著少三顆',
          res.map(r => `${r.what}：錢 ${r.before.m}→${r.after.m}、事件 ${r.before.n}→${r.after.n}、卡片${r.after.card.open ? '開著' : '關了'}、「${r.after.toasts.at(-1)}」`).join('｜') + `；標記 ${hz2.marks}（要 6）`);
        // 錢不夠：資金 10——滅火講「資金不足！滅火需 $30」、卡片留著、旗標不動、錢不動、沒有事件
        await ev('__gt.simMoney(10)');
        const g0 = { f: await ev('__gt.flags(11,33)'), n: (await ev('__gt.sim()')).events }; await ev('__gt.openTile(11,33)');
        const acts0 = (await ev(CARD)).acts;
        await ev(`document.querySelector('#bio .acts button[data-act="fire"]').click()`);
        const g1 = { f: await ev('__gt.flags(11,33)'), n: (await ev('__gt.sim()')).events, m: (await ev('__gt.sim()')).money, card: await ev(CARD), toasts: await ev(TOASTS) };
        await ev('__gt.simMoney(40)'); await ev('__gt.openTile(12,31)');
        log(g0.f.fire === 1 && g1.f.fire === 1 && g1.m === 10 && g1.n === g0.n && g1.card.open && g1.toasts.includes('資金不足！滅火需 $30') && acts0.length === 1,
          'D026 驗收 8：錢不夠——講「資金不足！滅火需 $30」（實驗線原句）、卡片留著、旗標不動、錢不動、歷史不多',
          `火 ${g0.f.fire}→${g1.f.fire}、錢 ${g1.m}、事件 ${g0.n}→${g1.n}、卡片${g1.card.open ? '開著' : '關了'}、提示「${g1.toasts.at(-1)}」`);
        // 焦土格的卡；清焦土（拆除）記成 doze ruin、分區一起清掉、復原回來
        await load(small);
        await ev('__gt.openTile(20,33)'); const rc = await ev(CARD);
        const zone0 = (await ev('__gt.layers()')).zone[33 * 72 + 20], pv = await ev(`__gt.preview({k:'tap',tool:'plant',x0:20,z0:33,x1:20,z1:33})`);
        const ed = await ev(`__gt.edit({k:'tap',tool:'doze',x0:20,z0:33,x1:20,z1:33})`), hz3 = await ev('__gt.hazard()');
        const und = await ev('__gt.undo()'), hz4 = await ev('__gt.hazard()');
        log(rc.title.startsWith('焦土') && rc.sub.includes('燒毀的建築留下的空地') && pv.count === 0 && /焦土/.test(pv.reason ?? '') && ed.placed === 1 && ed.events.length === 1 && ed.events[0].t === 'doze' && ed.events[0].layer === 'ruin' && hz3.ruins === 1 && und.ok && hz4.ruins === 2,
          'D026 驗收 8：焦土——卡片講「焦土」與原因；焦土上不能蓋東西（「焦土需先清理」）；拆除清掉、事件記成 doze ruin（不是拆分區）、格子的焦土少一格；復原回來',
          `卡「${rc.title}」「${rc.sub}」；蓋電廠 ${pv.count ? '可以' : '不行：' + pv.reason}；清除事件 ${J(ed.events.map(e => [e.t, e.layer, e.cost]))}、焦土 ${hz3.ruins}；復原後 ${hz4.ruins}（分區 ${zone0}）`);
        await ev('__gt.clearSave(), 1');
      }
      if (want('alerts')) {
        const h2 = cities26(newcity, KT).find(c => c.id === 'H2');
        await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(h2.code)})`); await open('');
        await ev(`(()=>{window.__toastLog=[];new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.classList&&n.classList.contains('toast'))window.__toastLog.push(n.textContent);}).observe(document.getElementById('toasts'),{childList:true});return 1;})()`);
        await ev('__gt.simStep(1), 1');
        const hz = await ev('__gt.hazard()'), tl = await ev('window.__toastLog'), town = '災禍';
        const TEXT = { fire: `🔥 ${town}發生火災！點擊燃燒的建築滅火`, crime: `🚓 ${town}發生犯罪！點擊受害建築處理`, abandon: `🏚️ ${town}有建築因長期犯罪而廢棄，已停止繳稅`, sick: `🏥 ${town}爆發疾病！點擊生病住宅處理`, death: '💀 發生憾事！請增設健康設施或墓園' };
        const kinds = hz.alerts.map(x => x.kind), missing = kinds.filter(k => !tl.includes(TEXT[k])), extra = tl.filter(t => !Object.values(TEXT).includes(t) && !/^(人口到|城市評等|資金見底)/.test(t));
        log(kinds.length >= 2 && !missing.length && !extra.length, 'D026 驗收 8：每日警示——H2 推進一天，當天發生的每一種災禍講一則實驗線的原句（火災、犯罪、廢棄、疾病、死亡），字裡帶存檔的城名',
          `當天有 ${kinds.join('、')}；提示 ${tl.length} 則${missing.length ? '；少了 ' + missing.join('、') : ''}${extra.length ? '；多出 ' + extra.join('｜') : ''}｜${tl.slice(0, 3).join('｜')}`);
        // 點提示：鏡頭過去、開那一格的卡（實驗線的 toast 帶座標）
        const a0 = hz.alerts[0], clicked = a0 ? await ev(`(()=>{const t=[...document.querySelectorAll('#toasts .toast')].find(q=>q.textContent===${J(TEXT[a0.kind])});if(!t)return false;t.click();return true;})()`) : false, card = await ev('__gt.card()');
        log(clicked && card.open && card.at?.[0] === a0.x && card.at?.[1] === a0.z, 'D026 驗收 8：點一則災禍提示——鏡頭過去、開那一格的建築卡（跟實驗線的 toast 一樣帶座標）',
          `第一則（${a0?.kind}）在 (${a0?.x}, ${a0?.z})：點了${clicked ? '' : '——找不到那則提示'}、卡片${card.open ? '開在' + J(card.at) : '沒開'}、標題「${card.title}」`);
        await ev('__gt.clearSave(), 1');
      }
    } catch (e) { log(false, 'D026 card／alerts：整段跑完', '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, 'D026：零外部請求、console 零錯誤',
      (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  });
}
export const d026SkipNote = () => ONLY.length ? `  注意：D026_SMOKE_ONLY＝${ONLY.join(',')}，D026 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d026Smoke(withBrowser, log);
  const note = d026SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

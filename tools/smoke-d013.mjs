// D013 煙霧測試：世界歷史改存 IndexedDB（驗收 7 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d013.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome（新的使用者資料夾，IndexedDB 從空的開始）。
//   idb      桌機：開新城、照 D011 劇本 A 段施工、推進 10 天——日誌是 IndexedDB；存檔（localStorage）是 hv 3、沒有 d3.r、指標＝日誌；
//            IndexedDB 裡的列（另外用瀏覽器原生 API 數，不經本線的程式）＝歷史筆數，逐列＝Node 的 packHistory(整份歷史)；
//            施工那一下存檔先帶尾巴（附加還在跑）；附加完成不重寫存檔（D011 的存檔時機不變），下一次存檔尾巴縮回 0；
//            重新整理：城與歷史接得上（歷史＝重新整理前的逐筆＋讀檔重挑外觀）、讀檔講「日誌 n 列＋存檔 m 列」；接著施工，日誌照樣只增；
//            換到別的城再回來：同一條日誌接得上；開新城：舊的日誌刪掉、新城一條新的
//   blocked  手機 360×740：先有一座存成 hv 3 的城，再把 IndexedDB 封鎖（indexedDB.open 丟例外）開頁：
//            城照存檔開（天數、資金、格子）、講原因「讀不到歷史的日誌（IndexedDB 打不開…）」、狀態列亮「⚠ 歷史有上限」（在畫面內、不蓋住別的晶片）；
//            照樣存得了（hv 2，歷史整份在 d3.r）、重新整理接得上；解除封鎖再開：hv 2 照讀、改存 hv 3、新開一條日誌
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pageSession, grew } from './smoke-d011.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { packHistory } from '../src/io/save.ts';

const J = JSON.stringify;
const SECTIONS = ['idb', 'blocked'];
const ONLY = (process.env.D013_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
// 不經本線程式、直接用瀏覽器的 IndexedDB 數日誌裡的列：{ 編號: 列數 }
const RAW_COUNT = `new Promise((res, rej) => { const r = indexedDB.open('gt3d'); r.onerror = () => rej(r.error);
  r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains('journal')) { db.close(); return res({}); }
    const q = db.transaction('journal').objectStore('journal').getAllKeys(); q.onsuccess = () => { const o = {}; for (const [id] of q.result) o[id] = (o[id] || 0) + 1; db.close(); res(o); }; q.onerror = () => rej(q.error); }; })`;
const BLOCK = `IDBFactory.prototype.open = function () { throw new DOMException('煙霧測試封鎖 IndexedDB', 'SecurityError'); };`;
const d3Of = code => { const r = code ? decodeLabCode(code) : null; return r?.ok ? { d3: r.save.raw.d3 ?? null, day: r.save.day, money: r.save.money } : null; };
// D011 劇本（tools/unit-d011-edit.mjs scriptOf：[['ops', A], ['days', 1], ['ops', B], ['days', 29], ['ops', C], …]）的 A 段、C 段
// 只取手勢（線、框、點）；資金設定、亂數對齊、pick、復原是對拍用的，這裡不需要。點照 tools/d011-ops.mjs run3d 換成 x0..x1
const gest = o => o.k === 'tap' ? { k: 'tap', tool: o.tool, x0: o.x, z0: o.z, x1: o.x, z1: o.z } : { k: o.k, tool: o.tool, x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z1 };
const opsOf = script => { const o = script.filter(s => s[0] === 'ops').map(s => s[1].filter(q => ['line', 'rect', 'tap'].includes(q.k) && !q.at).map(gest)); return { A: o[0], C: o[2] }; };
const TOASTS = `[...document.querySelectorAll('.toast')].map(t=>t.textContent)`;

let skipped = [];
export const d013SkipNote = () => skipped.length ? `D013 煙霧只跑了一部分：${skipped.join('、')} 沒跑（D013_SMOKE_ONLY）` : '';

export async function d013Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D013_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  skipped = ONLY.length ? SECTIONS.filter(k => !ONLY.includes(k)) : [];
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D013 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D013 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  // 施工一串（每一筆走手勢同一條路），回傳事件增加幾筆
  const build = async (ev, ops) => { const n0 = (await ev('__gt.history().length')); for (const o of ops) await ev(`__gt.edit(${J(o)})`); return (await ev('__gt.history().length')) - n0; };
  // 附加都完成之後：頁面的日誌狀態、存檔、歷史、IndexedDB 原生數的列
  const settle = async ev => {
    const j = await ev('__gt.journalFlush()');
    return { j, saved: d3Of(await ev('__gt.saved()')), h: await ev('__gt.history()'), raw: await ev(RAW_COUNT), rows: j.kind ? await ev('__gt.journalRows()') : null };
  };
  // 日誌與歷史對得上：存檔 hv 3、沒有 d3.r、指標＝這一條、日誌前 n 列＋存檔尾巴＝整份歷史（尾巴要等下一次存檔才縮）；日誌已確定到最後一筆；
  // IndexedDB 原生數的列＝歷史筆數；日誌逐列＝packHistory(整份)
  const journalOk = st => {
    const d3 = st.saved?.d3, bad = [];
    if (st.j.kind !== 'indexeddb') bad.push(`日誌是 ${st.j.kind}（${st.j.why}）`);
    if (st.j.busy || st.j.tail !== 0) bad.push(`附加沒收完：busy ${st.j.busy}、尾巴 ${st.j.tail}`);
    if (d3?.hv !== 3) bad.push(`存檔 hv ${d3?.hv}`);
    if (d3 && 'r' in d3) bad.push('存檔還有 d3.r');
    if (d3?.j?.id !== st.j.id || d3?.j?.n + d3?.t?.length !== st.h.length) bad.push(`指標 ${J(d3?.j)}、尾巴 ${d3?.t?.length}，歷史 ${st.h.length} 筆、日誌 ${st.j.id}`);
    if (st.raw[st.j.id] !== st.h.length) bad.push(`IndexedDB 原生數 ${st.raw[st.j.id]} 列 ≠ 歷史 ${st.h.length} 筆`);
    if (J(st.rows) !== J(packHistory(st.h))) bad.push('日誌的列 ≠ packHistory(整份歷史)');
    return bad;
  };

  await run('idb', '日誌真的在 IndexedDB（桌機）', async ({ ev, open, freshStart, script: S }) => {
    const script = opsOf(S);
    await freshStart();
    await ev('__gt.simMoney(1e6)');                                    // 資金放寬：這裡驗的是存檔，不是造價（劇本 A 段花到剩 $1，後面的施工會被拒）
    const j0 = await ev('__gt.journal()');
    const nA = await build(ev, script.A);
    // 施工那一下（同一個同步區塊裡）：存檔已經寫了、帶著尾巴，附加還在跑
    const lastA = script.C[0];
    const mid = await ev(`(()=>{__gt.edit(${J(lastA)});return {saved:__gt.saved(),j:__gt.journal(),n:__gt.history().length};})()`);
    const midD3 = d3Of(mid.saved)?.d3;
    await ev('__gt.simStep(10)');
    const s1 = await settle(ev), bad1 = journalOk(s1), tail1 = s1.saved?.d3?.t?.length;
    await ev('__gt.saveNow()');                                        // 下一次存檔（附加完成不重寫存檔）：尾巴縮回 0
    const t2 = d3Of(await ev('__gt.saved()'))?.d3;
    log(t2?.t?.length === 0 && t2.j.n === s1.h.length && j0.kind === 'indexeddb' && !j0.why && nA > 0 && midD3?.hv === 3 && mid.j.busy && midD3.t.length >= 1 && midD3.j.n + midD3.t.length === mid.n && !bad1.length,
      'D013 驗收 7：瀏覽器真的用 IndexedDB——新城施工、推進 10 天：存檔（localStorage）是 hv 3、沒有 d3.r；IndexedDB 裡的列（瀏覽器原生 API 數）＝歷史筆數、逐列＝packHistory(整份歷史)；施工那一下存檔先帶尾巴、附加中；附加完成不重寫存檔，下一次存檔尾巴縮回 0',
      bad1.length ? bad1.join('；') : `日誌 ${s1.j.id}：${s1.h.length} 列；施工那一下存檔尾巴 ${midD3?.t?.length} 列（前 ${midD3?.j?.n} 列已在日誌、附加中 ${mid.j.busy}）；附加完成時存檔尾巴 ${tail1} 列、下一次存檔 ${t2?.t?.length} 列；存檔 ${(await ev('__gt.saved().length')).toLocaleString()} 字元`);

    // ---- 重新整理：城與歷史接得上 ----
    const sim1 = await ev('__gt.sim()');
    await open('');
    const r2 = await ev(`({sample:__gt.sample,note:__gt.loadNote(),restyled:__gt.restyled(),h:__gt.history(),sim:__gt.sim(),j:__gt.journal(),toasts:${TOASTS}})`);
    const g2 = grew(s1.h, r2.h, r2.restyled);
    log(r2.sample === 'mine' && g2.ok && r2.sim.day === sim1.day && r2.sim.money === Math.round(sim1.money) && r2.j.id === s1.j.id && r2.j.confirmed === s1.h.length
      && new RegExp(`歷史 ${r2.h.length - r2.restyled} 筆重播成功（日誌 ${s1.h.length} 列＋存檔 0 列）`).test(r2.note) && r2.toasts.includes('已接著上次的城繼續'),
      'D013 驗收 7：重新整理——城與歷史逐筆接得上（重新整理前的每一筆＋讀檔重挑外觀），同一條日誌、接著寫的位置＝日誌列數；讀檔講「日誌 n 列＋存檔 m 列」',
      `「${r2.note}」；歷史 ${g2.before} → ${g2.after}（重挑 ${g2.added}${g2.prefix ? '' : '，前綴不同'}）；第 ${r2.sim.day} 天 $${r2.sim.money}（前 ${sim1.day}／${Math.round(sim1.money)}；存檔的資金照實驗線是整數）；日誌 ${r2.j.id} 接在 ${r2.j.confirmed}`);

    // ---- 接著施工、推進：日誌照樣只增（前面的列一列都沒動）----
    const before = s1.rows;
    const nC = await build(ev, script.C.slice(1, 5));
    await ev('__gt.simStep(5)');                                       // 播放中每 5 天自動存一次（SAVE_DAYS）
    const s3 = await settle(ev), bad3 = journalOk(s3);
    const kept = J(s3.rows.slice(0, before.length)) === J(before);
    log(nC > 0 && !bad3.length && kept && s3.j.id === s1.j.id,
      'D013 驗收 7：重新整理之後接著施工、推進 5 天：同一條日誌只往後加（原本的列逐列不變），IndexedDB 列數＝歷史筆數',
      bad3.length ? bad3.join('；') : `日誌 ${before.length} → ${s3.rows.length} 列${kept ? '' : '（前面的列變了）'}`);

    // ---- 換到別的城再回來：同一條日誌接得上 ----
    await ev(`__gt.menu('city:seed516')`);
    const away = await ev(`({sample:__gt.sample,j:__gt.journal()})`);
    await ev(`__gt.menu('city:mine')`);
    const back = await ev(`({sample:__gt.sample,note:__gt.loadNote(),restyled:__gt.restyled(),h:__gt.history(),j:__gt.journal()})`);
    const gb = grew(s3.h, back.h, back.restyled);
    log(away.sample === 'seed516' && away.j.id === '' && back.sample === 'mine' && gb.ok && back.j.id === s3.j.id && /（日誌 \d+ 列＋存檔 \d+ 列）/.test(back.note),
      'D013：換到樣本城（只能看、沒有日誌）再回我的城：同一條日誌接得上、歷史逐筆接得上',
      `樣本城日誌「${away.j.id}」；回來「${back.note}」、歷史 ${gb.before} → ${gb.after}`);

    // ---- 匯出（☰ 匯出分享碼）：照舊是 hv 2、整份歷史；歷史長到超過分享碼上限時給不帶歷史的碼並講明（驗收 2 的最後一句）----
    // 在頁面的歷史後面塞 13 萬筆外觀事件只為了量長度：同一個同步區塊裡匯出、拿掉，中間不存檔、不推進
    {
      const EXP = `(()=>{const rd=()=>({hidden:document.getElementById('dlg').hidden,sub:document.getElementById('dlgSub').textContent,code:document.querySelector('#dlg textarea').value});
        __gt.menu('export');const a=rd();document.getElementById('dlgNo').click();
        const H=__gt.history(),n0=H.length,d=H.at(-1).day,s0=__gt.saved();for(let i=0;i<130000;i++)H.push({day:d,t:'restyle',x:i%50,z:(i/50|0)%50,v:i%7});
        __gt.menu('export');const b=rd();document.getElementById('dlgNo').click();H.length=n0;
        return {a,b:{...b,code:b.code.length<3e6?b.code:'太長'},bLen:b.code.length,n0,n1:__gt.history().length,savedSame:__gt.saved()===s0};})()`;
      const x = await ev(EXP), A = decodeLabCode(x.a.code), B = decodeLabCode(x.b.code);
      const aD3 = A.ok ? A.save.raw.d3 : null;
      log(!x.a.hidden && aD3?.hv === 2 && aD3.r?.length === x.n0 && /d3，實驗線不讀它/.test(x.a.sub)
        && !x.b.hidden && B.ok && !B.save.raw.d3 && x.bLen <= 2e6 && /歷史太長，整張碼有 [\d,]+ 字元、超過分享碼上限/.test(x.b.sub) && x.n1 === x.n0 && x.savedSame,
        'D013 驗收 2：匯出分享碼照舊——平常是 hv 2、整份歷史（實驗線與本線都讀得回來）；歷史長到超過上限時給不帶歷史的碼並講明（分享碼本身的上限）；存檔不受影響',
        `平常 hv ${aD3?.hv}、${aD3?.r?.length} 列＝歷史 ${x.n0} 筆、${x.a.code.length.toLocaleString()} 字元；歷史 ${(x.n0 + 130000).toLocaleString()} 筆時「${x.b.sub.slice(0, 40)}…」、碼 ${x.bLen.toLocaleString()} 字元${B.ok && !B.save.raw.d3 ? '、不帶 d3' : '、帶了 d3 或解不開'}；歷史還原 ${x.n1} 筆、存檔${x.savedSame ? '沒動' : '變了'}`);
    }

    // ---- 開新城：舊的日誌刪掉、新城一條新的 ----
    const oldId = s3.j.id;
    await ev(`(()=>{window.confirm=()=>true;__gt.menu('city:newcity');})()`);
    await build(ev, script.A.slice(0, 2));
    const s4 = await settle(ev), bad4 = journalOk(s4);
    log(s4.j.id && s4.j.id !== oldId && !(oldId in s4.raw) && !bad4.length && s4.h[0]?.t === 'import',
      'D013：開新城蓋掉我的城——舊的日誌整條刪掉（IndexedDB 原生數不到它），新城一條新的日誌、照樣對得上',
      bad4.length ? bad4.join('；') : `舊 ${oldId} → 新 ${s4.j.id}；IndexedDB 現有 ${J(s4.raw)}`);
  }, { mobile: false });

  await run('blocked', 'IndexedDB 被封鎖（手機 360×740）', async ({ ev, open, freshStart, script: S }, page) => {
    const script = opsOf(S);
    await freshStart();
    await ev('__gt.simMoney(1e6)');                                    // 資金放寬：這裡驗的是存檔，不是造價（劇本 A 段花到剩 $1，後面的施工會被拒）
    await build(ev, script.A);
    const s1 = await settle(ev), bad1 = journalOk(s1), sim1 = await ev('__gt.sim()');
    const blk = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: BLOCK });
    await open('');
    const r = await ev(`({sample:__gt.sample,note:__gt.loadNote(),j:__gt.journal(),h:__gt.history(),sim:__gt.sim(),toasts:${TOASTS},
      chip:(()=>{const c=document.querySelector('#stats [data-k=journal]'),b=c.getBoundingClientRect(),u=document.querySelector('#stats [data-k=unsaved]');
        const others=[...document.querySelectorAll('#stats .stat')].filter(e=>e!==c&&!e.hidden).map(e=>e.getBoundingClientRect());
        return {hidden:c.hidden,text:c.textContent,title:c.title,in:b.left>=0&&b.right<=innerWidth+.5&&b.top>=0&&b.bottom<=innerHeight+.5,w:b.width,h:b.height,
          overlap:others.some(o=>o.left<b.right-.5&&b.left<o.right-.5&&o.top<b.bottom-.5&&b.top<o.bottom-.5),unsavedHidden:u.hidden};})()})`);
    const why = /讀不到歷史的日誌（IndexedDB 打不開（.*煙霧測試封鎖 IndexedDB.*））：只用存檔/;
    log(!bad1.length && r.sample === 'mine' && r.j.kind === null && /IndexedDB 打不開/.test(r.j.why) && why.test(r.note) && r.toasts.some(t => why.test(t))
      && r.sim.day === sim1.day && r.sim.money === Math.round(sim1.money) && !r.chip.hidden && r.chip.text === '⚠ 歷史有上限' && /約 8 萬筆/.test(r.chip.title) && r.chip.in && !r.chip.overlap && r.chip.unsavedHidden,
      'D013 驗收 7：hv 3 的城、IndexedDB 被封鎖（indexedDB.open 丟例外）開頁：城照存檔開（天數、資金）、講原因「讀不到歷史的日誌（IndexedDB 打不開…）」；狀態列亮「⚠ 歷史有上限」，在畫面內、不蓋住別的晶片',
      (bad1.length ? '封鎖前就不對：' + bad1.join('；') + '；' : '') + `「${r.note}」；第 ${r.sim.day} 天 $${r.sim.money}；晶片「${r.chip.text}」${r.chip.hidden ? '藏著' : `${Math.round(r.chip.w)}×${Math.round(r.chip.h)}${r.chip.in ? '' : '（出界）'}${r.chip.overlap ? '（重疊）' : ''}`}；歷史 ${r.h.length} 筆（從這張碼重新起算）`);

    // ---- 封鎖中照樣存得了（hv 2，整份歷史在 d3.r），重新整理接得上 ----
    const nB = await build(ev, script.C.slice(1, 4));
    const sv = await ev(`({saved:__gt.saved(),h:__gt.history(),j:__gt.journal(),ui:__gt.ui()})`), d3 = d3Of(sv.saved)?.d3;
    await open('');
    const r2 = await ev(`({note:__gt.loadNote(),restyled:__gt.restyled(),h:__gt.history(),j:__gt.journal()})`), g2 = grew(sv.h, r2.h, r2.restyled);
    log(nB > 0 && d3?.hv === 2 && Array.isArray(d3.r) && d3.r.length === sv.h.length && !d3.j && sv.ui.saveError === '' && r2.j.kind === null && g2.ok && /重播成功/.test(r2.note),
      'D013 驗收 7：封鎖中照樣自動存檔——退回 hv 2（整份歷史在 d3.r、D011 的做法），重新整理接得上',
      `存檔 hv ${d3?.hv}、d3.r ${d3?.r?.length} 列＝歷史 ${sv.h.length} 筆；重新整理「${r2.note}」、歷史 ${g2.before} → ${g2.after}`);

    // ---- 解除封鎖：hv 2 照讀、改存 hv 3、新開一條日誌（封鎖前那一條留在 IndexedDB，沒有接回去）----
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: blk.identifier });
    await open('');
    const r3 = await ev(`({note:__gt.loadNote(),restyled:__gt.restyled(),h:__gt.history()})`), g3 = grew(r2.h, r3.h, r3.restyled);
    const hv0 = d3Of(await ev('__gt.saved()'))?.d3?.hv;                 // 讀檔不存檔：這時還是 hv 2
    await ev('__gt.saveNow()');                                        // 下一次存檔（暫停、切到背景、施工都走這一支）
    const s3 = await settle(ev), bad3 = journalOk(s3);
    log(hv0 === 2 && g3.ok && /重播成功/.test(r3.note) && !bad3.length && s3.j.id !== s1.j.id,
      'D013 驗收 7：解除封鎖再開：hv 2 照讀、歷史接得上；下一次存檔改成 hv 3、新開一條日誌，對得上',
      (bad3.length ? bad3.join('；') + '；' : '') + `讀檔後存檔 hv ${hv0}、存一次之後 hv ${s3.saved?.d3?.hv}；歷史 ${g3.before} → ${g3.after}；新日誌 ${s3.j.id} ${s3.h.length} 列；封鎖前那一條 ${s1.j.id} 還有 ${s3.raw[s1.j.id] ?? 0} 列（沒接回去、也沒刪）`);
  }, { W: 360, H: 740 });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], t0 = Date.now();
  const log = (ok, name, detail) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${detail === undefined || detail === '' ? '' : '：' + detail}`); if (!ok) fails.push(name); };
  await d013Smoke(withBrowser, log);
  if (d013SkipNote()) console.log(d013SkipNote());
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (fails.length) { console.log(`\nNG 紅燈（${sec}s）：${fails.join('、')}`); process.exit(1); }
  console.log(`\nOK 綠燈（${sec}s）`);
}

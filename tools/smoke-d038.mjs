// D038 煙霧測試：科技與專精的瀏覽器半邊（驗收 7）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d038.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome。
//   panel   ☰ 選單有「科技與專精」；面板講城市方向（Lv.9 以前鎖著）、研究進度、四條路線（9 個節點、已完成幾個）、節點的狀態（做完、可開始、開不了＋原因）；按關閉、Esc、點背景都會關
//   start   P4（A1–A3 做完、$20,000）：按 A4a 的「開始」＝扣 $2,400、狀態進行中、跳金色提示；推進兩天進度＝Node 端同一座城的 stepDay；A4b 的鈕是灰的、講「二選一」；
//           再按進行中的節點不再扣錢；錢不夠的（P3）按下去講「錢不夠」不動狀態；已有進度的節點換著做回來免費
//   spec    P1（Lv.9、$20,000）：城市方向第一下只是標起來（狀態不動、講「再按一次確定」）、換一個就換標、第二下對同一個才定；教育科技城＝EDU 重算、研究速度 +1；定了就只剩「已選定」；
//           Lv.9 以前（P3）、沙盒（P2）四顆都是灰的
//   persist 開始研究、選方向之後存檔、重新整理：進行中的節點、進度、做完的清單、城市方向都在
//   mobile  手機（412×860 與 360×740）：面板不超出螢幕、頁面沒有橫向捲動、每一顆按鈕 ≥ 44×44、四個路線鈕一列；沒有改畫面：draw call ≤ 18、三角形 ≤ 118,884
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import * as realDay from '../src/sim/day.ts';
import { decodeLabCode } from '../src/io/labcode.ts';
import { startResearch, chooseSpec } from '../src/sim/edit.ts';
import { d038Plays } from './d038-cities.mjs';

const J = JSON.stringify, read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SECTIONS = ['panel', 'start', 'spec', 'persist', 'mobile'];
const ONLY = (process.env.D038_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);

// Node 端：把一座 P 城讀成 Sim、照 acts 開始研究／選方向、推進 days 天，回傳狀態（本線 stepDay；頁面跟它吃同一張碼、同一串動作，要得到同樣的結果）
export function expectedTech(id, acts = [], days = 0) {
  const KT = kindTableFrom(JSON.parse(read('src/content/lab-kinds.json'))), vrank = JSON.parse(read('src/content/samples/d009-live.json')).vrank;
  const c = d038Plays().find(r => r.id === id), s = realDay.simFromSave(decodeLabCode(c.code).save, c.code, KT, vrank), res = [];
  for (const [k, v] of acts) res.push(k === 'tech' ? startResearch(s, v).ok : chooseSpec(s, v).ok);
  for (let d = 0; d < days; d++) realDay.stepDay(s);
  return { code: c.code, res, st: { act: s.tech.act, prog: { ...s.tech.prog }, done: [...s.edu.tech], spec: s.edu.spec ?? '', money: s.money, speed: s.techSpeed } };
}

export async function d038Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D038_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D038 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D038 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const plays = Object.fromEntries(d038Plays().map(c => [c.id, c.code]));
  const loadCity = async (open, ev, code) => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`); await open(''); };
  const toasts = ev => ev(`[...document.querySelectorAll('#toasts .toast')].map(e => [e.textContent, e.className])`);
  const rowOf = (rows, k) => rows.find(r => r.k === k && r.kind !== 'act') ?? null;
  const SAME = `(()=>{const P=d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts}),a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;

  await run('panel', '面板', async ({ ev, open }) => {
    await loadCity(open, ev, plays.P4);
    const SHOWN = `(()=>{const e=document.getElementById('tc'),r=e.getBoundingClientRect();return {hidden:e.hidden,display:getComputedStyle(e).display,w:Math.round(r.width),h:Math.round(r.height)};})()`;
    const closed0 = await ev(SHOWN);
    log(closed0.hidden && closed0.display === 'none' && closed0.w === 0 && closed0.h === 0, 'D038 驗收 7：面板沒開的時候真的不在畫面上（display none、沒有尺寸；全螢幕的遮罩一旦漏出來會擋住所有觸控——index.html 的 [hidden] 規則要有 #tc）', `hidden ${closed0.hidden}、display ${closed0.display}、${closed0.w}×${closed0.h}`);
    const items = await ev('__gt.menuItems()'); await ev(`__gt.menu('tech')`);
    const p = await ev('__gt.techPanel()'), rows = await ev('__gt.techRows()'), s = await ev('__gt.techState()');
    const specRows = rows.filter(r => r.kind === 'spec'), techRows = rows.filter(r => r.kind === 'tech'), act = rows.find(r => r.kind === 'act');
    const a4a = rowOf(rows, 'A4a'), a4b = rowOf(rows, 'A4b'), a1 = rowOf(rows, 'A1'), a5 = rowOf(rows, 'A5'), a8 = rowOf(rows, 'A8');
    const ok = items.includes('tech') && p.open && p.route === 'A' && p.tabs.length === 4 && specRows.length === 4 && specRows.every(r => r.st === 'can') && techRows.length === 9
      && a1.st === 'done' && a1.btn === '✔' && a4a.st === 'can' && /^開始 \$2,400/.test(a4a.btn) && a4b.st === 'can' && a5.st === 'lock' && /要先完成其中一個/.test(a5.note) && a8.st === 'lock' && /前置還沒完成/.test(a8.note)
      && act.st === 'idle' && /沒有進行中的研究/.test(act.name) && p.tabs[0].includes('3／9') && p.sub.includes(`第 ${s.day} 天`);
    log(ok, 'D038 驗收 7：☰ 選單有「科技與專精」；面板講城市方向（P4 是 Lv.9：四顆亮著）、研究（沒有進行中的）、四條路線的鈕（產業線 做完 3／9）、產業線 9 個節點：做完的打勾、可以開始的寫費用、開不了的講原因（二選一／要先完成其中一個／前置還沒完成）',
      ok ? `選單 ${items.length} 項；${rows.length} 列；${p.tabs.join('｜')}；A4a「${a4a.btn}」A5「${a5.note.slice(-24)}」` : `不同：選單 ${items.join('、')}｜open ${p.open}｜route ${p.route}｜tabs ${J(p.tabs)}｜spec ${J(specRows.map(r => r.st))}｜tech ${techRows.length}｜A1 ${J(a1)}｜A4a ${J(a4a)}｜A5 ${J(a5)}｜act ${J(act)}`);
    for (const r of ['B', 'C', 'D']) { await ev(`__gt.techRoute('${r}')`); const rr = (await ev('__gt.techRows()')).filter(x => x.kind === 'tech'); if (rr.length !== 9 || rr.some(x => !x.k.startsWith(r))) log(false, `D038 驗收 7：切到 ${r} 線`, J(rr.map(x => x.k))); }
    await ev(`__gt.techRoute('D')`); const d = (await ev('__gt.techRows()')).filter(x => x.kind === 'tech'), d8 = rowOf(d, 'D8');
    log(d.length === 9 && d8.st === 'lock' && /前置還沒完成：/.test(d8.note), 'D038 驗收 7：切到遠望線——9 個節點；最後一個（D8）開不了、講前置還沒完成', `D8「${d8.note.slice(-40)}」`);
    await ev(`document.getElementById('tcX').click()`); const c1 = (await ev('__gt.techPanel()')).open === false;
    await ev(`__gt.menu('tech')`); await ev(`dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))`); const c2 = (await ev('__gt.techPanel()')).open === false;
    await ev(`__gt.menu('tech')`); await ev(`document.getElementById('tc').dispatchEvent(new MouseEvent('click',{bubbles:true}))`); const c3 = (await ev('__gt.techPanel()')).open === false;
    const closed1 = await ev(SHOWN);
    log(c1 && c2 && c3 && closed1.display === 'none', 'D038 驗收 7：「科技與專精」按關閉、按 Esc、點背景都會關，關了之後 display 是 none', `關閉鈕 ${c1 ? '關了' : '沒關'}、Esc ${c2 ? '關了' : '沒關'}、背景 ${c3 ? '關了' : '沒關'}；display ${closed1.display}`);
  }, { W: 412, H: 860 });

  await run('start', '開始研究', async ({ ev, open }) => {
    const E = expectedTech('P4', [['tech', 'A4a']], 2), E1 = expectedTech('P4', [['tech', 'A4a']], 0);
    await loadCity(open, ev, plays.P4); await ev(`__gt.menu('tech')`);
    const s0 = await ev('__gt.techState()'), n0 = (await toasts(ev)).length;
    const clicked = await ev(`__gt.techClick('A4a')`), s1 = await ev('__gt.techState()'), t1 = await toasts(ev), rows = await ev('__gt.techRows()'), act = rows.find(r => r.kind === 'act'), a4a = rowOf(rows, 'A4a'), a4b = rowOf(rows, 'A4b');
    const hit = t1.find(x => x[0] === '🔬 開始研究：重工傾斜（−$2,400）');
    const ok = clicked && s1.act === 'A4a' && s1.money === s0.money - 2400 && s1.money === E1.st.money && !!hit && hit[1].includes('gold') && t1.length === n0 + 1 && act.st === 'act' && /A4a 重工傾斜/.test(act.name)
      && a4a.st === 'act' && a4a.btn === '研究中' && a4b.st === 'lock' && /二選一/.test(a4b.note);
    log(ok, 'D038 驗收 7：按重工傾斜的「開始」——扣 $2,400（資金＝Node 端同一座城同一個動作）、狀態進行中、金色提示「🔬 開始研究：重工傾斜（−$2,400）」；面板的「研究」那一列講它、它的鈕變「研究中」；互斥的綠色轉型變灰、講「二選一」',
      ok ? `資金 ${s0.money} → ${s1.money}；提示「${hit[0]}」；${a4b.note.slice(-28)}` : `不同：clicked ${clicked}｜act ${s1.act}｜資金 ${s0.money}→${s1.money}（Node ${E1.st.money}）｜提示 ${J(t1.map(x => x[0]))}｜act列 ${J(act)}｜A4a ${J(a4a)}｜A4b ${J(a4b)}`);
    const blocked = await ev(`__gt.techClick('A4b')`), again = await ev(`__gt.techClick('A4a')`), s2 = await ev('__gt.techState()');
    const apply = await ev(`__gt.techApply('A4b')`), p2 = await ev('__gt.techPanel()'), s3 = await ev('__gt.techState()');
    log(!blocked && !again && s2.money === s1.money && apply?.ok === false && /綠色轉型：與「重工傾斜」二選一（研究中）/.test(p2.tip) && J(s3) === J(s2), 'D038 驗收 7：灰的鈕按不下去（互斥的綠色轉型、進行中的重工傾斜）；硬叫（techApply）也被擋、面板下方講原因「與『重工傾斜』二選一（研究中）」、狀態不動', `blocked ${blocked}、again ${again}；tip「${p2.tip}」`);
    await ev('__gt.simStep(2), 1'); const s4 = await ev('__gt.techState()');
    log(s4.act === 'A4a' && J(s4.prog) === J(E.st.prog) && s4.speed === E.st.speed && s4.money === E.st.money, 'D038 驗收 7：推進兩天——進度、每天的研究速度與資金＝Node 端同一座城同一串動作的 stepDay', `頁面 進度 ${J(s4.prog)} 速度 ${s4.speed} 資金 ${s4.money}；Node ${J(E.st.prog)} 速度 ${E.st.speed} 資金 ${E.st.money}`);
    // 錢不夠：P3（$300、要 $400）
    await loadCity(open, ev, plays.P3); await ev(`__gt.menu('tech')`);
    const q0 = await ev('__gt.techState()'), r3 = await ev('__gt.techRows()'), a1 = rowOf(r3, 'A1');
    const got = await ev(`__gt.techApply('A1')`), q1 = await ev('__gt.techState()'), p3 = await ev('__gt.techPanel()');
    log(a1.st === 'can' && got?.ok === false && q1.act === '' && q1.money === q0.money && /標準化生產：錢不夠：要 \$400（現有 \$300）/.test(p3.tip), 'D038 驗收 7：錢不夠（$300 對 $400）：鈕還亮著（講費用）、按下去擋下來——狀態、資金不動、面板講「錢不夠：要 $400（現有 $300）」', `A1「${a1.btn}」；tip「${p3.tip}」`);
    // 換著做、回來免費：P4 開 A4a、推進兩天（有進度）、換 B1、再換回 A4a 免費
    await loadCity(open, ev, plays.P4); await ev(`__gt.menu('tech')`); await ev(`__gt.techClick('A4a')`); await ev('__gt.simStep(2), 1');
    const m0 = (await ev('__gt.techState()')).money; await ev(`__gt.techRoute('B')`); await ev(`__gt.techClick('B1')`);
    const m1 = (await ev('__gt.techState()')).money; await ev(`__gt.techRoute('A')`);
    const back = rowOf(await ev('__gt.techRows()'), 'A4a'); await ev(`__gt.techClick('A4a')`); const f = await ev('__gt.techState()');
    log(m1 === m0 - 400 && /繼續（免費）/.test(back.btn) && f.act === 'A4a' && f.money === m1 && f.prog.A4a > 0, 'D038 驗收 7：換著做——進行中的 A4a 有進度時換去 B1（扣 $400）、回頭按 A4a 寫「繼續（免費）」、不扣錢、進度還在', `B1 扣 ${m0 - m1}；A4a「${back.btn}」；進度 ${J(f.prog)}`);
  }, { W: 412, H: 860 });

  await run('spec', '城市方向', async ({ ev, open }) => {
    const E = expectedTech('P1', [['spec', 0]], 0), E0 = expectedTech('P1', [], 1);
    await loadCity(open, ev, plays.P1); await ev(`__gt.menu('tech')`);
    const s0 = await ev('__gt.techState()'), r0 = (await ev('__gt.techRows()')).filter(r => r.kind === 'spec');
    log(s0.rank >= 8 && r0.length === 4 && r0.every(r => r.st === 'can' && r.btn === '選這個'), 'D038 驗收 7：Lv.9 的城（P1）——四個方向的鈕都亮著、寫「選這個」', `${r0.map(r => `${r.name}「${r.btn}」`).join('｜')}；城市等級 Lv.${s0.rank + 1}`);
    await ev(`__gt.techClick('ind')`); const a = await ev('__gt.techState()'), pa = await ev('__gt.techPanel()'), ra = (await ev('__gt.techRows()')).find(r => r.k === 'ind');
    await ev(`__gt.techClick('green')`); const b = await ev('__gt.techState()'), rb = (await ev('__gt.techRows()')).filter(r => r.kind === 'spec'), pb = await ev('__gt.techPanel()');
    log(a.spec === '' && pa.pick === 0 && ra.st === 'armed' && ra.btn === '再按一次確定' && /工業港城：永久、選了不能改——再按一次確定/.test(pa.tip) && b.spec === '' && pb.pick === 1 && rb.find(r => r.k === 'ind').st === 'can' && rb.find(r => r.k === 'green').st === 'armed',
      'D038 驗收 7：城市方向第一下只是標起來（狀態不動、鈕變「再按一次確定」、面板講「永久、選了不能改」）；換按另一個就換標、前一個放掉', `第一下 spec「${a.spec}」pick ${pa.pick}「${ra.btn}」；換按 pick ${pb.pick}`);
    await ev(`__gt.techClick('edu')`); await ev(`__gt.techClick('edu')`);
    const c = await ev('__gt.techState()'), t = await toasts(ev), rc = (await ev('__gt.techRows()')).filter(r => r.kind === 'spec'), hit = t.find(x => x[0] === '🎓 城市方向：教育科技城');
    log(c.spec === 'edu' && !!hit && hit[1].includes('gold') && rc.length === 1 && rc[0].st === 'done' && rc[0].btn === '', 'D038 驗收 7：連按兩下同一個「教育科技城」才定——Sim.edu.spec＝edu、金色提示、方向那一段只剩「已選定」一列', `spec「${c.spec}」；提示 ${hit ? `「${hit[0]}」` : J(t.map(x => x[0]))}；${rc.length} 列「${rc[0]?.btn ?? ''}」`);
    await ev('__gt.simStep(1), 1'); const d = await ev('__gt.techState()'), E1 = expectedTech('P1', [['spec', 2]], 1);
    log(d.speed === E1.st.speed && d.speed === E0.st.speed + 1, 'D038 驗收 7：選了教育科技城——研究速度比沒選的多 1（頁面＝Node 端同一座城同一串動作）', `頁面 ${d.speed}；Node ${E1.st.speed}（沒選 ${E0.st.speed}）`); void E;
    await loadCity(open, ev, plays.P1); await ev(`__gt.menu('tech')`);
    const e0 = (await ev('__gt.policyState()')).edu; await ev(`__gt.techClick('edu')`); await ev(`__gt.techClick('edu')`); const e1 = (await ev('__gt.policyState()')).edu;
    log(e0 !== e1, 'D038 驗收 7：選教育科技城——教育場 EDU 整張重算（雜湊變了；教育場 ×1.08）', `EDU ${e0} → ${e1}`);
    await loadCity(open, ev, plays.P3); await ev(`__gt.menu('tech')`);
    const l = (await ev('__gt.techRows()')).filter(r => r.kind === 'spec'), tl = await ev(`__gt.techClick('ind')`);
    await loadCity(open, ev, plays.P2); await ev(`__gt.menu('tech')`);
    const sb = (await ev('__gt.techRows()')).filter(r => r.kind === 'spec'), tb = await ev(`__gt.techClick('ind')`);
    log(l.every(r => r.st === 'lock' && r.btn === '選這個' && /要城市等級 Lv\.9/.test(r.note)) && !tl && sb.every(r => r.st === 'lock' && /沙盒不能選/.test(r.note)) && !tb, 'D038 驗收 7：Lv.9 以前（P3）、沙盒（P2）四個方向的鈕都是灰的、按不下去（沙盒另外寫「沙盒不能選」）', `P3 ${l.map(r => r.st).join(',')}；P2 ${sb.map(r => r.st).join(',')}`);
  }, { W: 412, H: 860 });

  await run('persist', '存檔', async ({ ev, open }) => {
    await loadCity(open, ev, plays.P1); await ev(`__gt.menu('tech')`);
    await ev(`__gt.techClick('A1')`); await ev('__gt.simStep(2), 1'); await ev(`__gt.techClick('edu')`); await ev(`__gt.techClick('edu')`); await ev(`__gt.saveNow()`);
    const before = await ev('__gt.techState()'); await open('');
    const after = await ev('__gt.techState()');
    log(before.act === 'A1' && before.spec === 'edu' && after.act === before.act && J(after.prog) === J(before.prog) && J(after.done) === J(before.done) && after.spec === 'edu',
      'D038 驗收 7：開始研究、推進兩天、選教育科技城、存檔、重新整理——進行中的節點、進度、做完的清單、城市方向都在', `進行中 ${after.act}、進度 ${J(after.prog)}、方向 ${after.spec}`);
    await ev(`__gt.menu('tech')`); const rows = await ev('__gt.techRows()'), act = rows.find(r => r.kind === 'act'), sp = rows.filter(r => r.kind === 'spec');
    log(act.st === 'act' && /A1 標準化生產/.test(act.name) && sp.length === 1 && sp[0].st === 'done', 'D038 驗收 7：重新整理後面板接得上——研究那一列講 A1、方向那一段是「已選定」', `${act.name}｜${sp.map(r => r.name).join('')}`);
    await ev('__gt.clearSave(), 1');
  }, { W: 412, H: 860 });

  for (const [W, H] of [[412, 860], [360, 740]]) await run('mobile', `手機 ${W}×${H}`, async ({ ev, open }) => {
    await loadCity(open, ev, plays.P1); await ev(`__gt.menu('tech')`);
    const before = await ev('__gt.renderInfoAll()');
    const M = `(()=>{const c=document.querySelector('#tc .card').getBoundingClientRect(),bs=[...document.querySelectorAll('#tc button')].map(b=>{const r=b.getBoundingClientRect();return [b.textContent,Math.round(r.width),Math.round(r.height)];}),tabs=[...document.querySelectorAll('#tc .tabs button')].map(b=>Math.round(b.getBoundingClientRect().top));return {cl:Math.round(c.left),cr:Math.round(c.right),cb:Math.round(c.bottom),ct:Math.round(c.top),iw:innerWidth,ih:innerHeight,sw:document.documentElement.scrollWidth,cw:document.querySelector('#tc .card').scrollWidth,cwd:document.querySelector('#tc .card').clientWidth,small:bs.filter(b=>b[1]<44||b[2]<44),n:bs.length,tabsRow:new Set(tabs).size};})()`;
    const m = await ev(M);
    log(m.cl >= 0 && m.cr <= m.iw && m.ct >= 0 && m.cb <= m.ih && m.sw <= m.iw && m.cw <= m.cwd + 1 && m.small.length === 0 && m.tabsRow === 1 && m.n >= 15,
      `D038 驗收 7：手機 ${W}×${H}——面板不超出螢幕、頁面沒有橫向捲動、每一顆按鈕（${m.n} 顆）≥ 44×44、四個路線鈕在同一列`, `面板 ${m.cl}–${m.cr} × ${m.ct}–${m.cb}（螢幕 ${m.iw}×${m.ih}）；頁面寬 ${m.sw}；太小的 ${J(m.small.slice(0, 3))}；路線鈕 ${m.tabsRow} 列`);
    for (const r of ['B', 'C', 'D']) { await ev(`__gt.techRoute('${r}')`); const mm = await ev(M); if (mm.small.length || mm.sw > mm.iw || mm.cw > mm.cwd + 1) log(false, `D038 驗收 7：手機 ${W}×${H} 切到 ${r} 線版面`, J(mm.small.slice(0, 3)) + ` 頁面寬 ${mm.sw}`); }
    await ev(`document.getElementById('tcX').click()`);
    await ev('__gt.simStep(1), 1'); const same = await ev(SAME), after = await ev('__gt.renderInfoAll()');
    log(same && after.calls <= 18 && after.triangles <= 118884, `D038 驗收 7：手機 ${W}×${H}——沒有改畫面：增量重建＝整張重建；draw call ≤ 18、三角形 ≤ 118,884`, `${same ? '＝' : '≠'}；draw call ${before.calls} → ${after.calls}、三角形 ${before.triangles.toLocaleString()} → ${after.triangles.toLocaleString()}`);
  }, { W, H });
}
export const d038SkipNote = () => ONLY.length ? `  注意：D038_SMOKE_ONLY＝${ONLY.join(',')}，D038 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d038Smoke(withBrowser, log);
  const note = d038SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

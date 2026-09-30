// D016 煙霧測試：公共設施九支（驗收 4、5、6 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d016.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome（同 D011：兩指手勢之後換頁觸控會送不進去）。
//   ui      手機直式 360×740、真的觸控（CDP Input.dispatchTouchEvent）：
//           「公共設施」按下去有 10 種可選，名稱、造價＝實驗線工具列（CIVIC_TOOLS）；10 顆與 7 顆工具鈕都 ≥ 44×44、在畫面內、不蓋住播放列；
//           每一種點下去組按鈕的字與價錢跟著換；選醫院點地圖蓋一棟（事件、資金、建築卡的名稱）；選公園一指框出 2×2（實驗線公園走框，isRectTool 62750）；
//           沙盒（起步城）十種都寫「免費」
//   render  起步城（沙盒）在空地蓋九種各一棟（跟手勢同一條路 __gt.edit）：每一種場景裡都有它（主人三角形數 > 0）；公園不施工、其他 8 種走 9 天工期；
//           蓋完與往後每一天，增量重建＝整張重建（D015 的比法）；9 天之後工地都收掉、九棟都還在；
//           蓋了九種之後全部三角形 ≤ 118,884、draw call 跟蓋之前一樣（手機預算，D014 同一條）
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession, free } from './smoke-d011.mjs';
import { CIVIC_TOOLS, gestureOf } from '../src/sim/edit.ts';

const J = JSON.stringify;
const SECTIONS = ['ui', 'render'];
const ONLY = (process.env.D016_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const NEW = [['park', 4], ['fire', 6], ['policeBox', 52], ['hospital', 12], ['clinic', 13], ['school', 7], ['library', 14], ['post', 15], ['cemetery', 16]];
// 不分順序的比法（同 tools/smoke-d015.mjs）
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
// 回 []＝一樣；不一樣回不同的項（同 tools/smoke-d015.mjs 的 WHERE：網格、地面、樹、各個查詢）
const WHERE = `(a,b)=>{const o=[];for(const k of Object.keys(b.meshes)){if(!a.meshes[k]||a.meshes[k].byOwner!==b.meshes[k].byOwner)o.push(k);}if(a.ground!==b.ground)o.push('ground');if(JSON.stringify(a.inst)!==JSON.stringify(b.inst))o.push('trees');for(const k of Object.keys(b.queries))if(a.queries[k]!==b.queries[k])o.push(k);return o;}`;
const SAME = `(()=>{const P=${PICK},W=${WHERE},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b)?[]:W(a,b);})()`;

export async function d016Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D016_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D016 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D016 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };

  await run('ui', '手機介面（360×740）', async ({ ev, tapBtn, tapAt, drag, release, cell, sim, findBox, freshStart, open, waitFor, toasts }) => {
    await freshStart();
    // ---- 版面 ----
    await tapBtn('.tool[data-t="civic"]');
    const LAY = `(()=>{const inV=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth+.5&&r.top>=0&&r.bottom<=innerHeight+.5;};
      const box=b=>{const r=b.getBoundingClientRect();return [Math.round(r.width*10)/10,Math.round(r.height*10)/10];};
      const sub=[...document.querySelectorAll('#civicSub button')].map(b=>({c:b.dataset.c,name:b.firstChild.textContent,price:b.querySelector('small').textContent,wh:box(b),in:inV(b)}));
      const tools=[...document.querySelectorAll('.tool')].map(b=>({t:b.dataset.t,wh:box(b),in:inV(b)}));
      const cs=document.getElementById('civicSub'),bar=document.getElementById('playBar');
      const g=document.querySelector('.tool[data-t="civic"]');
      return {hidden:cs.hidden,sub,tools,subBottom:cs.getBoundingClientRect().bottom,barTop:bar.getBoundingClientRect().top,barIn:inV(bar),label:g.querySelector('span').textContent,price:g.querySelector('.price').textContent,vw:innerWidth,vh:innerHeight};})()`;
    const lay = await ev(LAY), ui0 = await ev('__gt.ui()');
    const small = [...lay.sub, ...lay.tools].filter(b => b.wh[0] < 44 - .5 || b.wh[1] < 44 - .5 || !b.in).map(b => `${b.c ?? b.t} ${b.wh.join('×')}${b.in ? '' : '（出界）'}`);
    const want = CIVIC_TOOLS.map(c => [c.id, c.name, '$' + c.cost]), got = lay.sub.map(b => [b.c, b.name, b.price]);
    log(ui0.tool === 'civic' && !lay.hidden && J(got) === J(want) && lay.tools.length === 7 && !small.length && lay.subBottom <= lay.barTop + .5 && lay.barIn && lay.label === '警' && lay.price === '$500' && lay.vw === 360,
      `D016 驗收 4：手機 360×740 按「公共設施」跳出 ${CIVIC_TOOLS.length} 種可選（D019 起多了水塔、配水管），名稱與造價照實驗線工具列（CIVIC_TOOLS）；${CIVIC_TOOLS.length} 顆設施鈕與 7 顆工具鈕都 ≥ 44×44、在畫面內；設施那一排在播放列上面、不蓋住它；組按鈕預設「警 $500」`,
      small.length ? `太小或出界：${small.join('、')}` : `${lay.vw}×${lay.vh}；${got.map(g => g.slice(1).join(' ')).join('、')}；設施那一排底 ${lay.subBottom.toFixed(1)} ≤ 播放列頂 ${lay.barTop.toFixed(1)}；工具鈕 ${lay.tools[0].wh.join('×')}、設施鈕 ${lay.sub[0].wh.join('×')}`);
    // ---- 每一種點下去：組按鈕的字與價錢跟著換 ----
    {
      const bad = [];
      for (const c of CIVIC_TOOLS) {
        await tapBtn(`#civicSub button[data-c="${c.id}"]`);
        const u = await ev('__gt.ui()'), g = await ev(`(()=>{const g=document.querySelector('.tool[data-t="civic"]');return [g.querySelector('span').textContent,g.querySelector('.price').textContent,document.querySelector('#civicSub button.on')?.dataset.c??null,g.getAttribute('aria-label')];})()`);
        if (u.tool !== 'civic' || u.civicTool !== c.id || g[0] !== c.short || g[1] !== '$' + c.cost || g[2] !== c.id || g[3] !== `公共設施：${c.name}`) bad.push(`${c.id}：${J([u.tool, u.civicTool, ...g])}`);
      }
      log(!bad.length, 'D016 驗收 4：十種每一種真的點一下（觸控），選到的就是那一種；組按鈕上的字（警、派、消、醫、診、學、圖、郵、墓、園）、價錢、亮起來的那一顆都跟著換', bad.join('；') || CIVIC_TOOLS.map(c => c.short).join(''));
    }
    // ---- 真的觸控走一遍：選醫院、點地圖蓋一棟；放下工具、點那一格看建築卡 ----
    {
      await tapBtn('#civicSub button[data-c="hospital"]');
      const spot = (await findBox(1, 1, free))[0], s0 = await sim(), n0 = (await ev('__gt.history()')).length;
      await tapAt(spot[1]);
      const s1 = await sim(), h = await ev('__gt.history()'), last = h.at(-1), b = (await ev('__gt.conBuildings()')).find(q => q.x === spot[0][0] && q.z === spot[0][1] && !q.gone);
      await waitFor(async () => (await toasts()).length === 0, 4000);   // 扣款通知散掉再點地圖
      await tapBtn('.tool[data-t="civic"]');                           // 再按一次＝放下工具
      const u = await ev('__gt.ui()');
      await tapAt(await cell(...spot[0]));
      const card = await ev(`(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',sub:b.querySelector('.sub')?.textContent??''};})()`);
      log(s1.money === s0.money - 600 && h.length === n0 + 1 && last?.t === 'place' && last.k === 12 && last.x === spot[0][0] && last.z === spot[0][1] && last.cost === 600 && b?.k === 12 && u.tool === null && card.open && card.title.startsWith('醫院'),
        'D016 驗收 4：真的觸控從按鈕到蓋好一種設施——選「醫院」、點一下空地：資金 −600、歷史多一筆 place（k 12、那一格、$600）；放下工具點那一格，建築卡寫「醫院」',
        `(${spot[0]})：$${s0.money}→$${s1.money}、事件 ${J(last)}；建築卡「${card.title}」${card.sub}`);
    }
    // ---- 公園一指框出 2×2 ----
    {
      await ev('__gt.tool(null)'); await tapBtn('.tool[data-t="civic"]'); await tapBtn('#civicSub button[data-c="park"]');
      await waitFor(async () => (await toasts()).length === 0, 4000);
      const box = await findBox(2, 2, free), s0 = await sim();
      if (box.length) { await drag(box[0][1], box[3][1], 6); await release(); }
      const s1 = await sim(), bs = await ev('__gt.conBuildings()'), parks = box.filter(([[x, z]]) => bs.some(q => q.x === x && q.z === z && q.k === 4 && !q.gone)).length;
      log(box.length === 4 && s1.money === s0.money - 240 && s1.events === s0.events + 4 && parks === 4,
        'D016 驗收 4：公園照實驗線走框（isRectTool 62750）——一指拖出 2×2，蓋 4 座、扣 $240', `${parks} 座公園、$${s0.money}→$${s1.money}、事件 +${s1.events - s0.events}`);
    }
    // ---- 沙盒：十種都寫「免費」----
    {
      await open('sample=starter');
      await tapBtn('.tool[data-t="civic"]');
      const r = await ev(`(()=>({sub:[...document.querySelectorAll('#civicSub button small')].map(s=>s.textContent),g:document.querySelector('.tool[data-t="civic"] .price').textContent}))()`);
      log(r.sub.length === CIVIC_TOOLS.length && r.sub.every(t => t === '免費') && r.g === '免費' && (await sim()).diff === 3, `D016 驗收 4：沙盒（起步城 df 3）${CIVIC_TOOLS.length} 種（D019 起多了水塔、配水管）都寫「免費」、組按鈕也寫「免費」`, J(r));
    }
  }, { W: 360, H: 740 });

  await run('render', '九種都畫得出來', async ({ ev, open }) => {
    await open('sample=starter');
    await ev('__gt.simStep(2), 1');                                     // 起步城推兩天：已經有住商工的工地（draw call 那一項比的是「加了設施的工地」有沒有多出 draw call）
    const before = await ev('({all:__gt.renderInfoAll(),con:__gt.con().sites.length})');
    // 九格：格索引順序的空地（沒有路、分區、建築、樹、不是水），彼此不相鄰
    const L = await ev('__gt.layers()'), n = L.n, spots = [];
    for (let i = 0; i < n * n && spots.length < NEW.length; i++) {
      const x = i % n, z = (i / n) | 0;
      if (!free(i, L) || spots.some(([a, b]) => Math.abs(a - x) <= 1 && Math.abs(b - z) <= 1)) continue;
      spots.push([x, z]);
    }
    const res = [];
    for (const [j, [tool]] of NEW.entries()) {
      const [x, z] = spots[j];
      res.push(await ev(`(()=>{const r=__gt.edit(${J({ k: gestureOf(tool), tool, x0: x, z0: z, x1: x, z1: z })});return r&&r.ok;})()`));
    }
    const bs = await ev('__gt.conBuildings()'), ids = NEW.map(([, k], j) => bs.find(b => b.x === spots[j][0] && b.z === spots[j][1] && b.k === k && !b.gone)?.id ?? null);
    const drawn = async () => { const d = await ev('__gt.sceneDigest()'); return ids.map(id => id === null ? 0 : Object.values(d.meshes).reduce((s, m) => s + (m.ownerTris[id] ?? 0), 0)); };
    const tris0 = await drawn(), con0 = await ev('__gt.con()'), onSite = ids.map(id => con0.sites.some(s => s.id === id)), same0 = await ev(SAME);
    const after = await ev('__gt.renderInfoAll()');
    log(res.every(Boolean) && ids.every(id => id !== null) && tris0.every(t => t > 0),
      'D016 驗收 5：起步城（沙盒）空地上蓋九種各一棟（跟手勢同一條路），每一種場景裡都有它（主人三角形數 > 0）',
      NEW.map(([t], j) => `${t}(${spots[j]}) ${tris0[j]}`).join('、'));
    const siteOk = NEW.every(([t], j) => onSite[j] === (t !== 'park'));
    // 往後 9 天：每一天增量＝整張；9 天之後工地收掉、九棟還在
    // 只在「這一天真的重建了」才比（D015 的重建只換變動的部分：沒有長、沒有升級的日子不重建；近看小物的屋齡門檻只在重建時看，過了門檻要等下一次重建才出現——D014 的取捨。
    // 沒重建的日子場景本來就沒動，拿它跟「現在的整張重建」比，比的是屋齡門檻有沒有剛好在那一天跨過，不是增量對不對；D026 起起步城多了起火、生病，每天長不長的節奏變了，才第一次遇到）
    const sames = [same0], rbs = async () => (await ev('__gt.sim().rebuilds')) ?? 0;
    let rb = await rbs();
    for (let d = 1; d <= 9; d++) { await ev('__gt.simStep(1), 1'); const now = await rbs(); sames.push(now === rb ? null : await ev(SAME)); rb = now; }
    const con9 = await ev('__gt.con()'), left = ids.filter(id => con9.sites.some(s => s.id === id)), tris9 = await drawn();
    log(siteOk && !left.length && tris9.every(t => t > 0), 'D016 驗收 5：公園不施工、其他 8 種蓋下去就是工地（D014 的 9 天工期）；推 9 天之後工地都收掉、九棟都還在場景裡',
      `蓋下去當天在工地上的：${NEW.filter((_, j) => onSite[j]).map(([t]) => t).join('、')}；9 天後還在工地的 ${left.length} 棟`);
    const cmp = sames.filter(v => v !== null);
    log(cmp.length >= 3 && cmp.every(v => Array.isArray(v) && v.length === 0), 'D016 驗收 5：蓋完那一次與往後 9 天每一次重建，增量重建的場景＝旁邊整張重建的（D015 的比法：照主人分組、查詢、地面、樹）；至少比 3 次',
      sames.map(v => v === null ? '·' : Array.isArray(v) && v.length === 0 ? '＝' : `≠（${Array.isArray(v) ? v.join('、') : v}）`).join('') + `（＝一樣、·這一天沒重建；比了 ${cmp.length} 次）`);
    log(after.triangles <= 118884 && after.calls === before.all.calls, 'D016 驗收 6：手機預算——蓋了九種之後全部三角形 ≤ 118,884、draw call 跟蓋之前一樣',
      `三角形 ${before.all.triangles.toLocaleString()} → ${after.triangles.toLocaleString()}、draw call ${before.all.calls} → ${after.calls}（蓋之前工地 ${before.con} 座）`);
  }, { W: 412, H: 860 });
}
export const d016SkipNote = () => ONLY.length ? `  注意：D016_SMOKE_ONLY＝${ONLY.join(',')}，D016 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

// 單獨跑
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d016Smoke(withBrowser, log);
  const note = d016SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

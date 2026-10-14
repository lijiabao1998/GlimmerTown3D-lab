// D044 煙霧測試：蓋天然氣井與太空研究中心的瀏覽器半邊。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d044.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome。
//   ui       手機直式 360×740、真的觸控：「公共設施」18 顆三排（每一顆 ≥ 44×44、都在畫面裡），最後兩顆是天然氣井 $1,400（小按鈕字「氣井」）與太空研究中心（字「太空」、城市 Lv.22 才解鎖：先寫「🔒Lv.22」、點了只跳提示）；
//            選天然氣井畫面上畫油田（跟油井同一批格子）、點油田空格蓋成（扣 $1,400、歷史 place k117）、點沒有油的地被擋（講「需油田資源格（天然氣伴生）」）；
//            城市升到 Lv.22 之後鎖打開（價錢 $4,500）、選了按住一格畫整塊 3×3（九個預覽格）、放開蓋成（扣 $4,500、一筆 place k51、九格 occ 同一棟、壓在分區與樹上的整塊清掉）、復原整塊還原
//   persist  重新整理：太空研究中心與天然氣井還在（存檔與日誌讀回來），九格 occ 與分區、樹跟重新整理之前一樣
//   budget   手機 draw call ≤ 18、三角形 ≤ 118,884：太空研究中心與三口天然氣井蓋好之後、增量重建＝整張重建（蓋、復原都一樣）
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { loadCode, saveCode } from '../src/io/save.ts';
import { d044Base, d044Built, BLOCKS } from './d044-cities.mjs';

const J = JSON.stringify;
const SECTIONS = ['ui', 'persist', 'budget'];
const ONLY = (process.env.D044_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const SAME = `(()=>{const P=${PICK},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;
void fs; void path; void ROOT;

// Node 端：底城的油田空格——資源圖只畫「還能蓋」的格子（陸地、沒路、沒建築）
export function expectedOil() {
  const { code, KT, vrank } = d044Base(), L = loadCode(code, KT, vrank), s = L.sim, N = s.w.N, oil = [], none = [];
  for (let i = 0; i < N * N; i++) {
    const t = s.w.tiles[i], r = s.res.resource[i];
    if (t.t === 0 || t.road || t.bld) continue;
    if (r === 1) oil.push([i % N, (i / N) | 0]); else if (r === 0 && !t.tree) none.push([i % N, (i / N) | 0]);   // none：陸地、空的、沒有資源、沒有樹（樹上加價，免得跟價錢混在一起）
  }
  return { code, oil, none, N };
}

// Node 端：玩家蓋好（天然氣井 3 口、太空研究中心 2 座）的城存成碼，給 persist、budget 讀
export function builtCity() {
  const L = d044Built();
  return { code: saveCode(L.sim, L.template, L.start), put: L.put, N: L.sim.w.N };
}

export async function d044Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D044_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D044 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D044 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  const H = expectedOil();
  const loadCity = async (open, ev, code) => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await ev(`localStorage.setItem('gt3d.v1.save', ${J(code)})`); await open(''); };
  const cellsOf = hints => hints.cells.map(c => `${c[0]},${c[1]}`).sort();
  const want = list => list.map(([x, z]) => `${x},${z}`).sort();
  const footprint = ([x, z]) => { const o = []; for (let dz = 0; dz < 3; dz++) for (let dx = 0; dx < 3; dx++) o.push([x + dx, z + dz]); return o; };
  const HINTS = `__gt.resourceHints()`;
  const [bx, bz] = BLOCKS.B, [ax, az] = BLOCKS.A;

  await run('ui', '手機 360×740 蓋天然氣井與太空研究中心', async ({ ev, open, tapBtn, tapAt, drag, release, cell, sim, waitFor, toasts, onScreen }) => {
    await loadCity(open, ev, H.code);
    await ev('__gt.simMoney(1e6)');
    await tapBtn('.tool[data-t="civic"]');
    const btns = await ev(`[...document.querySelectorAll('#civicSub button')].map(b=>{const r=b.getBoundingClientRect();return [b.dataset.c,Math.round(r.width),Math.round(r.height),r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,Math.round(r.top),b.firstChild.textContent,b.querySelector('small').textContent,b.classList.contains('locked'),b.getAttribute('aria-disabled'),b.getAttribute('aria-label')];})`);
    const rows = new Set(btns.map(b => b[4])).size, gas = btns.at(-2), mega = btns.at(-1);
    log(btns.length === 18 && btns.every(b => b[1] >= 44 && b[2] >= 44 && b[3]) && rows === 3 && gas[0] === 'gaswell' && gas[5] === '氣井' && /1,?400/.test(gas[6]) && !gas[7]
        && mega[0] === 'megaproject' && mega[5] === '太空' && mega[6] === '🔒Lv.22' && mega[7] && mega[8] === 'true' && /解鎖/.test(mega[9]),
      'D044 驗收 7：手機 360×740「公共設施」18 顆三排，每一顆 ≥ 44×44 且在畫面裡；最後兩顆是天然氣井（「氣井」$1,400）與太空研究中心（「太空」、🔒Lv.22、aria-disabled、讀屏的名字講解鎖等級）',
      `按鈕 ${btns.length} 顆 ${rows} 排、最小 ${Math.min(...btns.map(b => b[1]))}×${Math.min(...btns.map(b => b[2]))}；最後兩顆 ${J(btns.slice(-2).map(b => b.slice(5)))}`);
    // 鎖：點了不會選到、跳提示
    const before = (await ev('__gt.ui()')).civicTool;
    await waitFor(async () => (await toasts()).length === 0, 4000);
    await tapBtn('#civicSub button[data-c="megaproject"]');
    const u1 = await ev('__gt.ui()'), t1 = await toasts();
    log(u1.civicTool === before && t1.some(q => q === '🔒 太空研究中心：城市 Lv.22 解鎖'),
      'D044 驗收 7：城市還沒到 Lv.22 點太空研究中心——選不到（工具還是原來那一個）、跳提示「🔒 太空研究中心：城市 Lv.22 解鎖」（實驗線 selectCatalogTool458 的字）', `工具 ${before}→${u1.civicTool}；提示 ${J(t1)}`);
    // 天然氣井：資源圖＝油田、蓋成、被擋
    await tapBtn('#civicSub button[data-c="gaswell"]');
    const hGas = await ev(HINTS), lay = await ev('__gt.layers()');
    log(J([...new Set(hGas.cells.map(c => c[2]))]) === '[1]' && J(cellsOf(hGas)) === J(want(H.oil)) && H.oil.length > 20,
      'D044 驗收 7：選天然氣井畫油田（黃，跟油井同一批：站在油田格上才蓋得下去）', `${hGas.shown} 格（Node ${H.oil.length}）`);
    const target = H.oil.find(([x, z]) => !lay.tree[z * lay.n + x]);
    await ev(`__gt.focusTile(${target[0]},${target[1]})`);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    const p = await cell(...target), s0 = await sim(), n0 = (await ev('__gt.history()')).length;
    if (!onScreen(p)) { log(false, 'D044 驗收 7：要蓋的油田格在畫面裡', `(${target}) 螢幕 ${J(p)}`); return; }
    await tapAt(p);
    const s1 = await sim(), h1 = await ev('__gt.history()'), last = h1.at(-1), hAfter = await ev(HINTS);
    log(s1.money === s0.money - 1400 && last?.t === 'place' && last.k === 117 && last.x === target[0] && last.z === target[1] && last.cost === 1400 && h1.length === n0 + 1 && hAfter.shown === H.oil.length - 1,
      'D044 驗收 7：點油田空格蓋成天然氣井——資金 −$1,400、歷史多一筆 place（k 117、那一格、$1,400）、資源圖少那一格', `(${target})：$${s0.money}→$${s1.money}；事件 ${J(last)}；資源圖 ${H.oil.length}→${hAfter.shown} 格`);
    const none = H.none.reduce((b, q) => Math.abs(q[0] - target[0]) + Math.abs(q[1] - target[1]) < Math.abs(b[0] - target[0]) + Math.abs(b[1] - target[1]) ? q : b);   // 離剛蓋的那口最近的、沒有資源的空地
    await ev(`__gt.focusTile(${none[0]},${none[1]})`);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    const pn = await cell(...none), a = await sim(), na = (await ev('__gt.history()')).length;
    if (onScreen(pn)) {
      await tapAt(pn);
      const t = await toasts(), b = await sim(), nb = (await ev('__gt.history()')).length;
      log(t.some(q => /需油田資源格（天然氣伴生）/.test(q)) && a.money === b.money && na === nb, 'D044 驗收 7：天然氣井點沒有油的地——被擋下來，講「需油田資源格（天然氣伴生）」，資金與歷史都不動', `提示 ${J(t)}、$${a.money}→$${b.money}、歷史 ${na}→${nb}`);
    } else log(false, 'D044 驗收 7：沒有油的那一格在畫面裡', `(${none}) 螢幕 ${J(pn)}`);
    // 城市升到 Lv.22：鎖打開
    await ev('__gt.simRank(21)');
    await tapBtn('.tool[data-t="civic"]'); await tapBtn('.tool[data-t="civic"]');   // 收起再打開，確保下排是新畫的
    const unlocked = await ev(`(()=>{const b=document.querySelector('#civicSub button[data-c="megaproject"]');return b?[b.querySelector('small').textContent,b.classList.contains('locked'),b.getAttribute('aria-disabled'),b.getAttribute('aria-label')]:null;})()`);
    log(unlocked && /4,?500/.test(unlocked[0]) && !unlocked[1] && unlocked[2] !== 'true' && /4,?500/.test(unlocked[3]), 'D044 驗收 7：城市升到 Lv.22 之後太空研究中心的鎖打開（價錢 $4,500、不再是灰的）', J(unlocked));
    await tapBtn('#civicSub button[data-c="megaproject"]');
    const u2 = await ev('__gt.ui()'), hOff = await ev(HINTS);
    log(u2.civicTool === 'megaproject' && hOff.shown === 0, 'D044 驗收 7：解鎖後點太空研究中心選得到、資源圖收掉（它不看資源格）', `工具 ${u2.civicTool}、資源圖 ${hOff.shown} 格`);
    // 按住 B 塊的根格：預覽整塊 3×3；放開蓋成
    await ev(`__gt.focusTile(${bx + 1},${bz + 1})`);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    const pb = await cell(bx, bz);
    if (!onScreen(pb)) { log(false, 'D044 驗收 7：B 塊在畫面裡', `B ${J(pb)}`); return; }
    const m0 = await sim(), nh0 = (await ev('__gt.history()')).length;
    await drag(pb, pb, 2);
    const st = await ev('__gt.stroke()'), pc = await ev('__gt.previewCount()'), pvBad = await ev('__gt.preview({k:"tap",tool:"megaproject",x0:' + bx + ',z0:' + bz + ',x1:' + bx + ',z1:' + bz + '})');
    await release();
    log(st && st.preview && st.preview.cells === 9 && st.preview.count === 1 && st.preview.total === 4500 && pc === 9 && pvBad.cells.length === 9,
      'D044 驗收 7：按住太空研究中心的根格——畫面上預覽整塊 3×3（九個預覽格）、一件、總價 $4,500', `預覽 ${J(st?.preview)}、預覽網格 ${pc} 格`);
    const m1 = await sim(), h2 = await ev('__gt.history()'), lay2 = await ev('__gt.layers()'), n = lay2.n, ids = new Set(footprint([bx, bz]).map(([x, z]) => lay2.occ[z * n + x]));
    const last2 = h2.at(-1);
    log(m1.money === m0.money - 4500 && h2.length === nh0 + 1 && last2.t === 'place' && last2.k === 51 && last2.x === bx && last2.z === bz && last2.cost === 4500 && ids.size === 1 && [...ids][0] === last2.id,
      'D044 驗收 7：放開蓋成太空研究中心——資金 −$4,500、歷史只多一筆 place（k 51、根格、$4,500）、九格 occ 都是這一棟', `$${m0.money}→$${m1.money}；事件 ${J(last2)}；九格 occ ${J([...ids])}`);
    // A 塊：壓在分區與樹上——蓋下去整塊清掉；復原整塊還原
    await ev(`__gt.focusTile(${ax + 1},${az + 1})`);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    const pa = await cell(ax, az);
    if (!onScreen(pa)) { log(false, 'D044 驗收 7：A 塊在畫面裡', `A ${J(pa)}`); return; }
    const zonesBefore = footprint([ax, az]).filter(([x, z]) => lay2.zone[z * n + x]).length, treesBefore = footprint([ax, az]).filter(([x, z]) => lay2.tree[z * n + x]).length;
    await tapAt(pa);
    const lay3 = await ev('__gt.layers()'), zonesAfter = footprint([ax, az]).filter(([x, z]) => lay3.zone[z * n + x]).length, treesAfter = footprint([ax, az]).filter(([x, z]) => lay3.tree[z * n + x]).length;
    const h3 = await ev('__gt.history()'), a3 = h3.at(-1), ids3 = new Set(footprint([ax, az]).map(([x, z]) => lay3.occ[z * n + x]));
    log(zonesBefore >= 3 && treesBefore >= 3 && zonesAfter === 0 && treesAfter === 0 && a3.t === 'place' && a3.k === 51 && a3.x === ax && ids3.size === 1 && h3.length === nh0 + 2,
      'D044 驗收 7：太空研究中心壓在分區與樹上——蓋下去整塊的分區與樹都清掉、歷史只多一筆 place（沒有附屬格的 zone／doze 事件）', `A 塊分區 ${zonesBefore}→${zonesAfter}、樹 ${treesBefore}→${treesAfter}；歷史 ${nh0}→${h3.length}；占地 occ ${J([...ids3])}`);
    const same1 = await ev(SAME);
    await tapBtn('#undo');
    const lay4 = await ev('__gt.layers()'), zones4 = footprint([ax, az]).filter(([x, z]) => lay4.zone[z * n + x]).length, trees4 = footprint([ax, az]).filter(([x, z]) => lay4.tree[z * n + x]).length;
    const ids4 = footprint([ax, az]).map(([x, z]) => lay4.occ[z * n + x]), m4 = await sim(), same2 = await ev(SAME);
    log(zones4 === zonesBefore && trees4 === treesBefore && ids4.every(v => v === 0) && m4.money === m1.money && same1 && same2,
      'D044 驗收 7：復原整塊還原（A 塊的分區與樹回來、九格 occ 清空、退全額）；蓋與復原之後場景增量重建＝整張重建', `A 塊分區 ${zones4}（原 ${zonesBefore}）、樹 ${trees4}（原 ${treesBefore}）、occ ${J([...new Set(ids4)])}；增量＝整張：蓋後 ${same1}、復原後 ${same2}`);
    // 點附屬格拆（拆除工具）：整棟拆掉
    await tapBtn('.tool[data-t="doze"]');
    await ev(`__gt.focusTile(${bx + 1},${bz + 1})`);
    await waitFor(async () => (await toasts()).length === 0, 4000);
    const pr = await cell(bx + 2, bz + 1);
    if (onScreen(pr)) {
      await tapAt(pr);
      const lay5 = await ev('__gt.layers()'), h5 = await ev('__gt.history()'), d5 = h5.at(-1);
      log(footprint([bx, bz]).every(([x, z]) => lay5.occ[z * n + x] === 0) && d5.t === 'doze' && d5.layer === 'bld' && d5.k === 51, 'D044 驗收 7：拆除工具點太空研究中心的附屬格——整棟拆掉（九格 occ 清空、歷史一筆 doze bld k51）', `九格 occ ${J([...new Set(footprint([bx, bz]).map(([x, z]) => lay5.occ[z * n + x]))])}；事件 ${J(d5)}`);
    } else log(false, 'D044 驗收 7：附屬格在畫面裡', J(pr));
  }, { W: 360, H: 740 });

  const C = builtCity();
  await run('persist', '重新整理', async ({ ev, open }) => {
    await loadCity(open, ev, C.code);
    const read = () => ev(`(()=>{const h=__gt.history(),L=__gt.layers();return {gas:h.filter(e=>e.t==='place'&&e.k===117).length,mega:h.filter(e=>e.t==='place'&&e.k===51).length,n:h.length,occ:L.occ.join(','),zone:L.zone.join(','),tree:L.tree.join(',')};})()`);
    const a = await read();
    await ev('__gt.saveNow()');
    await open('');
    const b = await read(), roots = await ev(`(()=>{const h=__gt.history().filter(e=>e.t==='place'&&e.k===51);return h.map(e=>[e.x,e.z]);})()`);
    log(a.gas === 3 && a.mega === 2 && b.gas === 3 && b.mega === 2 && a.occ === b.occ && a.zone === b.zone && a.tree === b.tree && J(roots) === J([[ax, az], [bx, bz]]),
      'D044 驗收 7：重新整理——天然氣井 3 口、太空研究中心 2 座還在（歷史 place 筆數、兩座的根格座標）、全圖的 occ、分區、樹逐格跟重新整理之前一樣', `之前 井 ${a.gas}／太空 ${a.mega}、之後 井 ${b.gas}／太空 ${b.mega}；occ ${a.occ === b.occ ? '＝' : '≠'}、分區 ${a.zone === b.zone ? '＝' : '≠'}、樹 ${a.tree === b.tree ? '＝' : '≠'}；歷史 ${a.n}→${b.n} 筆`);
  });

  const W = 360, Hh = 740;
  await run('budget', '手機效能預算', async ({ ev, open }) => {
    await loadCity(open, ev, C.code);
    const info = await ev('__gt.renderInfoAll()'), same = await ev(SAME);
    log(info.calls <= 18 && info.triangles <= 118884 && same,
      `D044 驗收 7：手機 ${W}×${Hh}——太空研究中心 2 座與天然氣井 3 口蓋好之後 draw call ≤ 18、三角形 ≤ 118,884；增量重建＝整張重建`, `draw call ${info.calls}、三角形 ${info.triangles}；${same ? '＝' : '≠'}`);
  }, { W, H: Hh });
}
export const d044SkipNote = () => ONLY.length ? `  注意：D044_SMOKE_ONLY＝${ONLY.join(',')}，D044 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d044Smoke(withBrowser, log);
  const note = d044SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

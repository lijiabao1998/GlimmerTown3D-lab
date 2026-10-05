// D020 煙霧測試：垃圾（驗收 5、6 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d020.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome。
//   ui      手機直式 360×740、真的觸控：「公共設施」選垃圾場（兩排七個，每一顆 ≥ 44×44、都在畫面裡），新城點一格空地蓋一座（$300、歷史 place k 8）；
//           放下工具點它，建築卡的「清運」講處理容量 40
//   card    起步城（沙盒）推進到有住宅：沒有垃圾場時住宅的卡講「全城沒有垃圾場」「離垃圾場沿路太遠」；在住宅旁的路邊蓋一座垃圾場、推進一天，
//           同一棟的卡改講「全城垃圾 x／40」「垃圾場沿路 n 格」、不再講太遠，模擬回報的容量 40
//   render  起步城：蓋垃圾場（D007 有 k 8 的造型）之後增量重建＝整張重建（D015 的比法）；三角形 ≤ 118,884
import { pathToFileURL } from 'node:url';
import { pageSession, free } from './smoke-d011.mjs';

const J = JSON.stringify;
const SECTIONS = ['ui', 'card', 'render'];
const ONLY = (process.env.D020_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const SAME = `(()=>{const P=${PICK},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;
const CARD = `(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',rows:[...b.querySelectorAll('li')].map(li=>li.textContent)};})()`;
// 四鄰有路的空地（格索引順序第一格；ok 另外篩）
const roadSide = (L, ok = () => true) => {
  const n = L.n;
  for (let i = 0; i < n * n; i++) {
    if (!free(i, L) || !ok(i)) continue;
    const x = i % n, z = (i / n) | 0;
    if ([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dz]) => x + dx >= 0 && z + dz >= 0 && x + dx < n && z + dz < n && L.road[(z + dz) * n + x + dx])) return [x, z];
  }
  return null;
};

export async function d020Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D020_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D020 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D020 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };

  await run('ui', '手機介面（360×740）', async ({ ev, tapBtn, tapAt, cell, sim, findBox, freshStart, waitFor, toasts }) => {
    await freshStart();
    await ev('__gt.simMoney(1e6)');
    await tapBtn('.tool[data-t="civic"]');
    const btns = await ev(`[...document.querySelectorAll('#civicSub button')].map(b=>{const r=b.getBoundingClientRect();return [b.dataset.c,Math.round(r.width),Math.round(r.height),r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,Math.round(r.top)];})`);
    const rows = new Set(btns.map(b => b[4])).size;
    await tapBtn('#civicSub button[data-c="dump"]');
    const u = await ev('__gt.ui()');
    const box = await findBox(1, 1, free), spot = box.length ? box[0][0] : null;   // 新城還沒有路：隨便一格空地（貼不貼路放置規則都一樣）
    let spent = null, last = null;
    if (spot) { await waitFor(async () => (await toasts()).length === 0, 4000); const s0 = await sim(); await tapAt(await cell(...spot)); const s1 = await sim(); spent = s0.money - s1.money; last = (await ev('__gt.history()')).at(-1); }
    log(btns.length === 16 && btns.every(b => b[1] >= 44 && b[2] >= 44 && b[3]) && rows === 3 && btns.at(-4)[0] === 'dump' && btns.at(-3)[0] === 'sewage' && u.civicTool === 'dump' && spent === 300 && last?.t === 'place' && last.k === 8,
      'D020 驗收 5：手機 360×740「公共設施」16 種三排（D033 加了污水廠、D040 加了油井與礦場排最後：垃圾場倒數第四顆）、每一顆 ≥ 44×44 且在畫面裡；選垃圾場點一格空地蓋一座：扣 $300、歷史 place k 8',
      `按鈕 ${btns.length} 顆 ${rows} 排、最小 ${Math.min(...btns.map(b => b[1]))}×${Math.min(...btns.map(b => b[2]))}；垃圾場 (${spot})：花 $${spent}、${J(last)}`);
    if (!spot) return;
    await tapBtn('.tool[data-t="civic"]');                                   // 再按一次＝放下工具
    await tapAt(await cell(...spot));
    const card = await ev(CARD), row = card.rows.find(r => r.startsWith('清運')) ?? '';
    log(card.open && /垃圾場/.test(card.title) && /處理容量 40/.test(row), 'D020 驗收 5：放下工具點垃圾場，建築卡的「清運」一列講處理容量 40（人口未滿 500，全城設施一起算）',
      `卡片「${card.title}」：${row}`);
  }, { W: 360, H: 740 });

  await run('card', '建築卡講清運', async ({ ev, open }) => {
    await open('sample=starter');
    // 推進到有住宅（起步城第 1 天就開始長）
    let homes = [];
    for (let d = 0; d < 12 && homes.length < 3; d++) { await ev('__gt.simStep(1), 1'); homes = (await ev('__gt.conBuildings()')).filter(b => !b.gone && b.k === 1); }
    const h0 = homes[0], readCard = async (x, z) => { await ev(`__gt.openTile(${x},${z})`); return ev(CARD); };
    const c0 = h0 ? await readCard(h0.x, h0.z) : null, r0 = c0?.rows.find(r => r.startsWith('清運')) ?? '';
    // 住宅旁邊的路邊：離這一棟最近的貼路空地（沙盒不花錢）
    const L = await ev('__gt.layers()'), n = L.n;
    let spot = null, best = 1e9;
    for (let i = 0; i < n * n; i++) { if (!free(i, L)) continue; const x = i % n, z = (i / n) | 0; if (!roadSide({ ...L, n }, j => j === i)) continue; const d = Math.abs(x - h0.x) + Math.abs(z - h0.z); if (d < best) { best = d; spot = [x, z]; } }
    const put = spot ? await ev(`__gt.edit(${J({ k: 'tap', tool: 'dump', x0: spot[0], z0: spot[1], x1: spot[0], z1: spot[1] })})`) : null;
    await ev('__gt.simStep(1), 1');
    const g1 = await ev('__gt.lastDay()?.garb ?? null');
    const c1 = h0 ? await readCard(h0.x, h0.z) : null, r1 = c1?.rows.find(r => r.startsWith('清運')) ?? '';
    log(!!h0 && /全城沒有垃圾場/.test(r0) && /太遠/.test(r0) && put?.ok && /全城垃圾 [\d.]+／40/.test(r1) && /垃圾場沿路 \d+ 格/.test(r1) && !/太遠/.test(r1) && g1?.cap === 40,
      'D020 驗收 5：起步城的住宅卡——沒有垃圾場時講「全城沒有垃圾場」「太遠」；在它旁邊的路邊蓋一座、推進一天，改講「全城垃圾 x／40」「垃圾場沿路 n 格」、不再講太遠，模擬回報的容量 40',
      `住宅 (${h0?.x},${h0?.z})：之前「${r0}」；垃圾場 (${spot}) ${put?.ok}；之後「${r1}」；那一天 ${J(g1)}`);
  }, { W: 412, H: 860 });

  await run('render', '垃圾場的造型與預算', async ({ ev, open }) => {
    await open('sample=starter');
    await ev('__gt.simStep(2), 1');
    const before = await ev('__gt.renderInfoAll()');
    const L = await ev('__gt.layers()'), placed = [];
    for (let q = 0; q < 3; q++) {
      const spot = roadSide(L, i => !placed.some(([x, z]) => z * L.n + x === i));
      if (!spot) break;
      const r = await ev(`__gt.edit(${J({ k: 'tap', tool: 'dump', x0: spot[0], z0: spot[1], x1: spot[0], z1: spot[1] })})`);
      if (r?.ok) { placed.push(spot); L.occ[spot[1] * L.n + spot[0]] = 1; }
    }
    const same0 = await ev(SAME);
    await ev('__gt.simStep(1), 1');
    const same1 = await ev(SAME), after = await ev('__gt.renderInfoAll()');
    const kinds = (await ev('__gt.conBuildings()')).filter(b => !b.gone && b.k === 8).length;
    log(placed.length === 3 && kinds === 3 && same0 && same1, 'D020 驗收 6：起步城蓋 3 座垃圾場（D007 有 k 8 的造型）之後、再推進一天，增量重建＝整張重建（D015 的比法）',
      `垃圾場 ${placed.map(p => `(${p})`).join('')}；k 8 ${kinds} 棟；${[same0, same1].map(v => v ? '＝' : '≠').join('')}`);
    log(after.triangles <= 118884, 'D020 驗收 6：手機預算——三角形 ≤ 118,884', `三角形 ${before.triangles.toLocaleString()} → ${after.triangles.toLocaleString()}、draw call ${before.calls} → ${after.calls}`);
  }, { W: 412, H: 860 });
}
export const d020SkipNote = () => ONLY.length ? `  注意：D020_SMOKE_ONLY＝${ONLY.join(',')}，D020 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d020Smoke(withBrowser, log);
  const note = d020SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

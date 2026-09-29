// D019 煙霧測試：供水（驗收 6、7 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d019.mjs（先 npm run build；退出碼 0＝綠燈、1＝紅燈）。每一段一個 Chrome。
//   ui      手機直式 360×740、真的觸控：「公共設施」選配水管，一指拉出 5 格水管（$10／格、事件 5 筆 pipe）；
//           拿著配水管／水塔時地面畫出水管，換成別的設施就不畫（實驗線平常埋在地下，utilityLineMode485C 50907）；
//           選水塔點水管旁邊的空地蓋一座（$400）；放下工具點水管那一格，卡片講「配水管（接通水源）」
//   card    起步城（沙盒）：住商工旁邊拉水管、接水塔，推進一天：接得到水的住商工建築卡寫「有水」，接不到的寫「沒水」
//   render  起步城：拉水管、放水塔之後拿著配水管（地面畫水管）與放下工具，增量重建＝整張重建（D015 的比法）；
//           三角形 ≤ 118,884、draw call 跟拉之前一樣（水管畫在地面貼圖上，不加網格）
import { pathToFileURL } from 'node:url';
import { pageSession, free } from './smoke-d011.mjs';
import { GROUND } from '../src/render/ground.ts';

const J = JSON.stringify;
const SECTIONS = ['ui', 'card', 'render'];
const ONLY = (process.env.D019_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
const PICK = `d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts})`;
const SAME = `(()=>{const P=${PICK},a=__gt.sceneDigest(),b=__gt.freshDigest();return P(a)===P(b);})()`;
// 地面貼圖上某一格中心那一點的顏色（水管的中心亮點畫在 (mid−1, mid−1)）
const centerColor = (gd, x, z) => { const rgb = Buffer.from(gd.rgb, 'base64'), S = gd.S, W = gd.W, mid = (S >> 1) - 1, p = ((z * S + mid) * W + x * S + mid) * 3; return (rgb[p] << 16) | (rgb[p + 1] << 8) | rgb[p + 2]; };

export async function d019Smoke(withBrowser, log) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D019_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D019 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D019 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };
  // 在畫面上找一排 w 格連續的空地（D011 的 findBox 只認 free：陸地、沒路、沒分區、沒建築、沒樹）
  const pipeSpot = async (ev, findBox, w) => { const b = await findBox(w, 1, free); return b.length === w ? b : null; };

  await run('ui', '手機介面（360×740）', async ({ ev, tapBtn, tapAt, drag, release, cell, sim, findBox, freshStart, waitFor, toasts }) => {
    await freshStart();
    await ev('__gt.simMoney(1e6)');
    await tapBtn('.tool[data-t="civic"]');
    await tapBtn('#civicSub button[data-c="wpipe"]');
    const u0 = await ev('({ui:__gt.ui(),shown:__gt.pipesShown()})');
    const box = await pipeSpot(ev, findBox, 5), s0 = await sim();
    if (box) { await drag(box[0][1], box[4][1], 8); await release(); }
    const s1 = await sim(), h = await ev('__gt.history()'), added = h.slice(-5);
    const cells = box ? box.map(b => b[0]) : [];
    const gd1 = await ev('__gt.groundData()');
    log(!!box && u0.ui.civicTool === 'wpipe' && u0.shown && s1.money === s0.money - 50 && s1.events === s0.events + 5 && added.every(e => e.t === 'pipe' && e.cost === 10)
      && cells.every(([x, z], j) => added[j]?.x === x && added[j]?.z === z) && cells.every(([x, z]) => centerColor(gd1, x, z) === GROUND.pipeHi),
      'D019 驗收 6：手機 360×740 選「配水管」一指拉出 5 格（實驗線拉線，isLineTool436 62763）：扣 $50、歷史多 5 筆 pipe（每格 $10）；拿著配水管時地面畫出水管（中心亮點 #d7f7ff）',
      box ? `(${cells.map(c => c.join(',')).join(')(')})：$${s0.money}→$${s1.money}、事件 +${s1.events - s0.events}；拿著配水管 pipesShown＝${u0.shown}` : '找不到一排 5 格空地');
    if (!box) return;
    // 換成別的設施：水管埋回地下（不畫）；換回水塔：又畫出來
    await tapBtn('#civicSub button[data-c="fire"]');
    const hid = await ev('__gt.pipesShown()'), gd2 = await ev('__gt.groundData()');
    await tapBtn('#civicSub button[data-c="water"]');
    const shown2 = await ev('__gt.pipesShown()'), gd3 = await ev('__gt.groundData()');
    log(!hid && cells.every(([x, z]) => centerColor(gd2, x, z) !== GROUND.pipeHi) && shown2 && cells.every(([x, z]) => centerColor(gd3, x, z) === GROUND.pipeHi),
      'D019 驗收 7：地面的水管只在拿著配水管、水塔時畫（實驗線平常埋在地下，utilityLineMode485C 50907）：換成消防局就不畫，換成水塔又畫出來',
      `消防局 pipesShown＝${hid}、中心色 ${cells.map(([x, z]) => centerColor(gd2, x, z).toString(16)).join('/')}；水塔 pipesShown＝${shown2}`);
    // 水塔：水管起點旁邊（上、下、左）第一格空地
    const L = await ev('__gt.layers()'), n = L.n, [x0, z0] = cells[0];
    const spot = [[x0 - 1, z0], [x0, z0 - 1], [x0, z0 + 1]].find(([x, z]) => x >= 0 && z >= 0 && x < n && z < n && free(z * n + x, L));
    let tw = null;
    if (spot) { await waitFor(async () => (await toasts()).length === 0, 4000); const t0 = await sim(); await tapAt(await cell(...spot)); const t1 = await sim(); tw = { spent: t0.money - t1.money, last: (await ev('__gt.history()')).at(-1) }; }
    await tapBtn('.tool[data-t="civic"]');                                  // 再按一次＝放下工具
    await tapAt(await cell(...cells[2]));
    const card = await ev(`(()=>{const b=document.getElementById('bio');return {open:!b.hidden,title:b.querySelector('h2')?.textContent??'',sub:b.querySelector('.sub')?.textContent??''};})()`);
    log(!!spot && tw?.spent === 400 && tw.last?.t === 'place' && tw.last.k === 10 && card.open && /配水管（接通水源）/.test(card.sub),
      'D019 驗收 6：選「水塔」點水管旁邊的空地蓋一座（$400、歷史 place k 10）；放下工具點水管那一格，卡片講「配水管（接通水源）」',
      `水塔 (${spot})：${J(tw)}；卡片「${card.title}」${card.sub}`);
  }, { W: 360, H: 740 });

  await run('card', '建築卡講有沒有水', async ({ ev, open }) => {
    await open('sample=starter');
    // 住商工分區的外框：北邊那一排的上一列拉水管、左端接水塔（沙盒不花錢）
    const L = await ev('__gt.layers()'), n = L.n, zs = [], xs = [];
    for (let i = 0; i < n * n; i++) if (L.zone[i]) { zs.push((i / n) | 0); xs.push(i % n); }
    const z0 = Math.min(...zs), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const r1 = await ev(`__gt.edit(${J({ k: 'line', tool: 'wpipe', x0: x0 - 2, z0: z0 + 1, x1: x1 + 2, z1: z0 + 1 })})`);
    let tw = null;
    for (let z = z0 + 1; z < z0 + 8 && !tw?.ok; z++) tw = await ev(`__gt.edit(${J({ k: 'tap', tool: 'water', x0: x0 - 3, z0: z, x1: x0 - 3, z1: z })})`);
    await ev('__gt.simStep(3), 1');
    const bl = await ev('__gt.conBuildings()'), wa = await ev(`(()=>{const o=[];for(const b of __gt.conBuildings())if(!b.gone&&b.k>=1&&b.k<=3)o.push([b.x,b.z,__gt.tileWa(b.x,b.z)]);return o;})()`);
    const wet = wa.find(q => q[2] === true), dry = wa.find(q => q[2] === false);
    // 卡片走 __gt.openTile（同點一下那一格：showTile）；真的觸控點地圖開卡片 D016、上面 ui 段都驗過
    const readCard = async ([x, z]) => { await ev(`__gt.openTile(${x},${z})`); return ev(`(()=>{const b=document.getElementById('bio');return {open:!b.hidden,sub:b.querySelector('.sub')?.textContent??''};})()`); };
    const cw = wet ? await readCard(wet) : null, cd = dry ? await readCard(dry) : null;
    log(r1?.ok && tw?.ok && !!wet && !!dry && cw.open && /・有水/.test(cw.sub) && cd.open && /・沒水/.test(cd.sub),
      'D019 驗收 6：起步城拉水管、接水塔、推進 3 天：接得到水的住商工建築卡寫「有水」，接不到的寫「沒水」（電也一起講）',
      `水管 ${r1?.placed} 格、水塔 ${tw?.ok}；住商工 ${wa.length} 棟、有水 ${wa.filter(q => q[2]).length}；有水那棟「${cw?.sub}」、沒水那棟「${cd?.sub}」；建築 ${bl.length}`);
  }, { W: 412, H: 860 });

  await run('render', '水管畫在地面、不加網格', async ({ ev, open }) => {
    await open('sample=starter');
    await ev('__gt.simStep(2), 1');
    const before = await ev('__gt.renderInfoAll()');
    const L = await ev('__gt.layers()'), n = L.n, zs = [], xs = [];
    for (let i = 0; i < n * n; i++) if (L.zone[i]) { zs.push((i / n) | 0); xs.push(i % n); }
    const z0 = Math.min(...zs), z1 = Math.max(...zs), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const res = [];
    for (let z = z0; z <= z1; z += 4) res.push(await ev(`(__gt.edit(${J({ k: 'line', tool: 'wpipe', x0: x0 - 1, z0: z, x1: x1 + 1, z1: z })})||{}).placed`));
    res.push(await ev(`(__gt.edit(${J({ k: 'line', tool: 'wpipe', x0: x0 - 1, z0: z0, x1: x0 - 1, z1: z1 })})||{}).placed`));
    const same0 = await ev(SAME);
    await ev(`__gt.tool('civic','wpipe')`);
    const shown = await ev('__gt.pipesShown()'), same1 = await ev(SAME), during = await ev('__gt.renderInfoAll()');
    await ev('__gt.simStep(1), 1');
    const same2 = await ev(SAME);
    await ev('__gt.tool(null)');
    const same3 = await ev(SAME), after = await ev('__gt.renderInfoAll()');
    log(shown && same0 && same1 && same2 && same3, 'D019 驗收 7：拉了水管之後、拿著配水管（地面畫水管）、推進一天、放下工具（水管埋回去），每一次增量重建＝整張重建（D015 的比法）',
      `水管 ${res.join('+')} 格；${[same0, same1, same2, same3].map(v => v ? '＝' : '≠').join('')}`);
    log(during.triangles <= 118884 && during.calls === before.calls && after.calls === before.calls, 'D019 驗收 7：手機預算——水管畫在地面貼圖上：三角形 ≤ 118,884、draw call 跟拉水管之前一樣',
      `三角形 ${before.triangles.toLocaleString()} → ${during.triangles.toLocaleString()}（拿著配水管）→ ${after.triangles.toLocaleString()}、draw call ${before.calls} → ${during.calls} → ${after.calls}`);
  }, { W: 412, H: 860 });
}
export const d019SkipNote = () => ONLY.length ? `  注意：D019_SMOKE_ONLY＝${ONLY.join(',')}，D019 其他段沒跑（這一輪不是完整的煙霧測試）` : '';

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const fails = [], log = (ok, name, d) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${d !== undefined ? '：' + d : ''}`); if (!ok) fails.push(name); };
  const t0 = Date.now();
  await d019Smoke(withBrowser, log);
  const note = d019SkipNote(); if (note) console.log(note);
  console.log(fails.length ? `NG 紅燈（${((Date.now() - t0) / 1000).toFixed(1)}s）：${fails.join('、')}` : `OK 綠燈（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  process.exit(fails.length ? 1 : 0);
}

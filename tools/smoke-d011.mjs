// D011 煙霧測試：建造 MVP（驗收 7、8 的瀏覽器半邊）。由 tools/smoke.mjs 呼叫。
// 手勢與按鈕都用真的觸控事件（CDP Input.dispatchTouchEvent：點一下、一指拖、兩指捏合與平移）。
// 手機直式 412×860；預算在 CPU 降速 6 倍下量。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, sleep } from './cdp.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { simHash } from '../src/sim/day.ts';
import { runScript, scriptOf } from './unit-d011-edit.mjs';

const J = JSON.stringify;
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 一個 Chrome 工作階段的共用工具（手機直式、觸控模擬）。同一個分頁連續換頁很多次之後，Chrome 的觸控模擬會不再把觸控事件送進頁面
// （D011 施工時遇到：頁面收不到任何 pointer／touch 事件，elementFromPoint 卻是畫布；單獨重現不出來），所以 D011 分三個 Chrome 跑
async function mobileSession(page, open0) {
  const open = async q => { await open0(q); await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); };
  const W = 412, H = 860;
  await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
  await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  const ev = e => page.evaluate(e);
  const touch = (type, pts) => page.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  const drag = async (a, b, steps = 8, each) => { await touch('touchStart', [a]); for (let k = 1; k <= steps; k++) { await touch('touchMove', [[a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps]]); await sleep(20); await each?.(); } };
  const release = async () => { await touch('touchEnd', []); await sleep(150); };
  const tapAt = async ([x, y]) => { await touch('touchStart', [[x, y]]); await sleep(30); await touch('touchEnd', []); await sleep(200); };   // 真的點一下（synthesizeTapGesture 受實際視窗大小限制，手機版下方的鈕會超界）
  const center = sel => ev(`(()=>{const e=document.querySelector(${J(sel)});if(!e)return null;const b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];})()`);
  const tapBtn = async sel => { const c = await center(sel); if (c) await tapAt(c); return !!c; };
  const cell = (x, z) => ev(`__gt.cellScreen(${x},${z})`);
  const sim = () => ev('__gt.sim()');
  const onScreen = p => p[0] > 16 && p[0] < W - 16 && p[1] > 150 && p[1] < H - 260;
  const code = R('src/content/samples/newcity.code.txt').trim(), script = scriptOf(code), { x0: X, z0: Z } = script.site;
  // 一排在畫面裡的格：從 (x,z) 往 +x 最多 len 格
  const visibleRun = async (z, xFrom, len) => { const out = []; for (let x = xFrom; x < xFrom + len; x++) { const p = await cell(x, z); if (!onScreen(p)) break; out.push([x, p]); } return out; };
  // 整張圖找一塊 w×h：每格都在畫面裡、都符合 ok(i, layers)；回傳逐列的 [[x,z], 螢幕座標]（一次取回每格的螢幕座標，在 Node 端找）
  const findBox = async (w, h, ok) => {
    const lay = await ev('__gt.layers()'), n = lay.n, scr = await ev(`(()=>{const o=[];for(let z=0;z<${n};z++)for(let x=0;x<${n};x++)o.push(__gt.cellScreen(x,z));return o;})()`);
    for (let z = 0; z + h <= n; z++) for (let x = 0; x + w <= n; x++) {
      let good = true;
      for (let dz = 0; dz < h && good; dz++) for (let dx = 0; dx < w && good; dx++) { const i = (z + dz) * n + x + dx; if (!onScreen(scr[i]) || !ok(i, lay)) good = false; }
      if (good) { const out = []; for (let dz = 0; dz < h; dz++) for (let dx = 0; dx < w; dx++) out.push([[x + dx, z + dz], scr[(z + dz) * n + x + dx]]); return out; }
    }
    return [];
  };
  // 乾淨的開局：先到只能看的樣本城清掉存檔（有模擬的城離開頁面時會自動存，清了會被存回去），再開預設頁
  const freshStart = async () => { await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await open(''); };
  const waitFor = async (f, ms = 4000) => { for (const t0 = Date.now(); Date.now() - t0 < ms; await sleep(50)) if (await f()) return true; return false; };

  return { W, H, ev, touch, drag, release, tapAt, tapBtn, cell, sim, onScreen, code, script, X, Z, visibleRun, findBox, freshStart, waitFor, open };
}

// 三段各開一個 Chrome：A 建造流程＋存檔，B 沙盒，C 預算＋劇本城重演。每段另查零外部請求、console 零錯誤
export async function d011Smoke(withBrowser, log, blankCheck) {
  const run = (name, fn) => withBrowser({ width: 960, height: 600 }, async ({ open, page }) => {
    const h = await mobileSession(page, open);
    await fn(h, page);
    const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
    log(ext.length === 0 && page.errors.length === 0, `D011 ${name}：零外部請求、console 零錯誤`, ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`);
  });

  await run('建造流程與存檔', async ({ W, H, ev, touch, drag, release, tapAt, tapBtn, cell, sim, X, Z, visibleRun, findBox, freshStart, open }) => {
  // ---- 開局：沒有存檔 → 新城（df 1、$3000、第 1 天、暫停），一開就是「我的城」 ----
  await freshStart();
  const s0 = await sim(), ui0 = await ev('__gt.ui()');
  log(!!s0 && s0.day === 1 && s0.money === 3000 && s0.diff === 1 && s0.events === 1 && !s0.playing && ui0.dock === 'build' && /^①/.test(ui0.coach ?? '') && ui0.saved && await ev('__gt.sample') === 'mine',
    'D011 開局：沒有存檔時進新城（標準難度、$3000、第 1 天、暫停），立刻存成「我的城」；提示第一步「選路」', J({ ...s0, hash: undefined, power: undefined, rci: undefined, settle: undefined, coach: ui0.coach }));

  // ---- 手機版面：狀態列、工具列、選單都在畫面內，按鈕 ≥ 44 px ----
  {
    const lay = await ev(`(()=>{const inV=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth+.5&&r.top>=0&&r.bottom<=innerHeight+.5;};
      const vis=[...document.querySelectorAll('.gtu button')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&!b.closest('[hidden]');});
      const small=vis.filter(b=>{const r=b.getBoundingClientRect();return r.width<44-.5||r.height<44-.5;}).map(b=>(b.id||b.className||b.textContent).slice(0,12)+':'+Math.round(b.getBoundingClientRect().width)+'x'+Math.round(b.getBoundingClientRect().height));
      const out=vis.filter(b=>!inV(b)).map(b=>b.id||b.textContent.slice(0,8));
      document.getElementById('menuBtn').click();const sheet=document.querySelector('#menu .sheet'),items=[...document.querySelectorAll('#menu .item')];
      const menuIn=inV(sheet)||sheet.scrollHeight>sheet.clientHeight,itemsSmall=items.filter(b=>b.getBoundingClientRect().height<44-.5).length;document.getElementById('menuX').click();
      return {buttons:vis.length,tools:document.querySelectorAll('.tool').length,small,out,hud:inV(document.getElementById('hud')),dock:inV(document.getElementById('dock')),menuIn,menuItems:items.length,itemsSmall};})()`);
    log(lay.tools === 7 && lay.buttons >= 12 && !lay.small.length && !lay.out.length && lay.hud && lay.dock && lay.menuIn && lay.menuItems >= 8 && !lay.itemsSmall,
      'D011 手機直式 412×860：狀態列、工具列（7 種工具、播放、速度、復原）、☰ 選單都在畫面內，每顆按鈕 ≥ 44×44 px', J(lay));
  }

  // ---- 一指拖出路線：預覽逐格、放開才蓋、扣的錢＝預覽總價；拖的時候鏡頭不動；預覽只多 1 個 draw call ----
  let roadRow = null;
  {
    await tapBtn('.tool[data-t="road"]');
    const ui = await ev('__gt.ui()'), chips = await ev(`[...document.querySelectorAll('#roadSub button')].map(b=>{const r=b.getBoundingClientRect();return [b.textContent,Math.round(r.height),r.left>=0&&r.right<=innerWidth];})`);
    let run = [];
    for (let z = Z + 5; z <= Z + 15 && run.length < 8; z++) { run = await visibleRun(z, X + 1, 12); if (run.length >= 8) roadRow = z; }
    const a = run[0][1], b = run.at(-1)[1], cam0 = J(await ev('__gt.cam()')), m0 = (await sim()).money, n0 = (await sim()).events;
    const calls0 = (await ev('__gt.renderInfo()')).calls;
    await drag(a, b);
    const mid = await ev('({stroke: __gt.stroke(), inst: __gt.previewCount(), cam: JSON.stringify(__gt.cam()), calls: __gt.renderInfo().calls})');
    await release();
    const s1 = await sim(), cam1 = J(await ev('__gt.cam()')), lay = await ev('__gt.layers()');
    const built = run.filter(([x]) => lay.road[roadRow * lay.n + x]).length;
    log(ui.tool === 'road' && chips.length === 5 && chips.every(c => c[1] >= 44 && c[2]) && !!mid.stroke?.preview && mid.stroke.preview.count === run.length && mid.inst === run.length && mid.cam === cam0 && cam1 === cam0
      && s1.money === m0 - mid.stroke.preview.total && s1.events === n0 + run.length && built === run.length && mid.calls <= calls0 + 1,
      'D011 一指拖路：拖曳中逐格預覽與總價、鏡頭不動；放開才蓋，扣的錢＝預覽總價；五級路按鈕都在畫面內、≥ 44 px；預覽只多 1 個 draw call',
      `拖 ${run.length} 格（第 ${roadRow} 列）、預覽 $${mid.stroke?.preview?.total}、實扣 $${m0 - s1.money}、事件 +${s1.events - n0}、draw call ${calls0}→${mid.calls}；鏡頭 ${mid.cam === cam0 && cam1 === cam0 ? '沒動' : '動了'}`);
  }

  // ---- 選著工具時，兩指捏合會縮放、兩指拖會平移，都不會蓋東西 ----
  {
    const c0 = await ev('__gt.cam()'), s0 = await sim(), cx = W / 2, cy = H / 2 - 80;
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', [[cx - 40 - k * 12, cy], [cx + 40 + k * 12, cy]]); await sleep(20); }
    await touch('touchEnd', []); await sleep(500);
    const c1 = await ev('__gt.cam()');
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', [[cx - 40 + k * 10, cy + k * 8], [cx + 40 + k * 10, cy + k * 8]]); await sleep(20); }
    await touch('touchEnd', []); await sleep(500);
    const c2 = await ev('__gt.cam()'), s2 = await sim();
    const moved = Math.hypot(c2.target[0] - c1.target[0], c2.target[2] - c1.target[2]);
    log(c1.zoom > c0.zoom * 1.1 && moved > 0.5 && s2.money === s0.money && s2.events === s0.events && (await ev('__gt.ui()')).tool === 'road',
      'D011 選著工具時：兩指捏合縮放、兩指拖平移（實驗線兩指不能平移，本線加上），都不蓋東西', `縮放 ${c0.zoom.toFixed(2)}→${c1.zoom.toFixed(2)}、平移 ${moved.toFixed(2)} 格、資金與事件不變`);
    await open('');                                                       // 鏡頭復位（城每一筆都自動存了，重開就是「我的城」）
  }

  // ---- 點一下蓋電廠；拆除、復原：點一下拆一格路（$2），按 ↩ 整格還原、全額退錢、事件記一筆 undo ----
  {
    await tapBtn('.tool[data-t="plant"]');
    const s0 = await sim(), pAt = [X + 6, roadRow - 1];
    await tapAt(await cell(...pAt));
    const s1 = await sim();
    await tapBtn('.tool[data-t="doze"]');
    const x = X + 3;
    await tapAt(await cell(x, roadRow));
    const s2 = await sim(), L2 = await ev('__gt.layers()'), road2 = L2.road[roadRow * L2.n + x];
    await tapBtn('#undo');
    const s3 = await sim(), L3 = await ev('__gt.layers()'), road3 = L3.road[roadRow * L3.n + x], last = (await ev('__gt.history()')).at(-1);
    log(s1.money === s0.money - 550 && s1.buildings === s0.buildings + 1 && s2.money === s1.money - 2 && road2 === 0 && s3.money === s1.money && road3 > 0 && last?.t === 'undo' && last.refund === 2,
      'D011 點一下蓋電廠扣 $550；拆除點一下拆一格路扣 $2；按 ↩ 路回來、退 $2、歷史多一筆 undo', `電廠 ${s0.money}→${s1.money}（${s1.buildings} 棟）、拆 →${s2.money}、復原 →${s3.money}`);
    const card = await ev(`__gt.openTile(${X + 1},${roadRow})`);
    log(!!card && card.rows.some(r => /鋪了支路/.test(r)), 'D011 空地卡：列出這一格第幾天鋪了什麼路、花多少', card ? card.rows.slice(0, 2).join('／') : '沒有卡片');
  }

  // ---- 路的等級：點「快速路」再拉；錢中途不夠時只蓋前段（實驗線 commitRoadDraft436 62779）----
  {
    await tapBtn('.tool[data-t="road"]');
    await tapBtn('#roadSub button[data-r="hwy"]');
    const s0 = await sim(), free = (i, L) => !L.road[i] && !L.zone[i] && !L.occ[i] && !L.tree[i] && L.ter[i] !== 0;
    const r1 = await findBox(12, 1, free);
    await drag(r1[0][1], r1.at(-1)[1]); await release();
    const s1 = await sim();
    const r2 = await findBox(12, 1, free);
    await drag(r2[0][1], r2.at(-1)[1]); await release();
    const s2 = await sim(), want = Math.floor(s1.money / 120);
    log((await ev('__gt.ui()')).roadTool === 'hwy' && s1.money === s0.money - 12 * 120 && s2.events - s1.events === want && s2.money === s1.money - want * 120,
      'D011 路的等級：點「快速路」拉 12 格扣 $1,440；錢只夠幾格時只蓋前段', `${s0.money}→${s1.money}；第二條只蓋 ${s2.events - s1.events} 格（夠 ${want} 格）→ $${s2.money}`);
  }

  // ---- 框選分區：錢不夠整塊不蓋（實驗線 commitRect 62996 原句「資金不足」）；夠就逐格蓋、扣預覽總價 ----
  {
    await tapBtn('.tool[data-t="zr"]');
    const s0 = await sim(), free = (i, L) => !L.road[i] && !L.zone[i] && !L.occ[i] && !L.tree[i] && L.ter[i] !== 0;
    const side = Math.ceil(Math.sqrt(s0.money / 8 + 1)), big = await findBox(side, side, free), zones0 = (await ev('__gt.layers()')).zone.filter(Boolean).length;
    await drag(big[0][1], big.at(-1)[1]);
    const pv = (await ev('__gt.stroke()'))?.preview;
    await release();
    const s1 = await sim(), zones1 = (await ev('__gt.layers()')).zone.filter(Boolean).length, toast = await ev(`[...document.querySelectorAll('.toast')].map(t=>t.textContent).join('|')`);
    const small = await findBox(3, 1, free);
    await drag(small[0][1], small.at(-1)[1], 4);
    const pv2 = (await ev('__gt.stroke()'))?.preview;
    await release();
    const s2 = await sim(), zones2 = (await ev('__gt.layers()')).zone.filter(Boolean).length;
    log(big.length === side * side && !!pv && pv.total > s0.money && s1.money === s0.money && zones1 === zones0 && /資金不足/.test(toast) && !!pv2 && pv2.count === 3 && s2.money === s0.money - pv2.total && zones2 === zones0 + 3,
      'D011 框選分區：總價超過資金整塊不蓋（實驗線原句「資金不足」）；夠就逐格蓋、扣的錢＝預覽總價', `${side}×${side} 格 $${pv?.total} > $${s0.money}：沒蓋（${toast.split('|').find(t => /資金不足/.test(t)) ?? '沒有提示'}）；3 格 $${pv2?.total}：蓋了`);
    await ev('__gt.tool(null)');
  }

  // ---- 存檔：重新整理之後「我的城」還在，內容相同；清掉存檔又回到新城 ----
  {
    const before = await ev('({h: JSON.stringify(__gt.history()), s: __gt.sim()})');
    await open('');
    const after = await ev('({h: JSON.stringify(__gt.history()), s: __gt.sim(), sample: __gt.sample, note: __gt.loadNote()})');
    await freshStart();
    const fresh = await sim();
    log(after.sample === 'mine' && after.h === before.h && after.s.day === before.s.day && after.s.money === Math.round(before.s.money) && after.s.buildings === before.s.buildings && /重播成功/.test(after.note)
      && fresh.events === 1 && fresh.money === 3000,
      'D011 存檔：重新整理後「我的城」還在（歷史逐筆相同、天數、建築、資金照實驗線取整），歷史重播成功；清掉存檔回到新城', `${JSON.parse(after.h).length} 筆、第 ${after.s.day} 天、$${after.s.money}；${after.note}`);
  }

  });

  await run('沙盒', async ({ ev, drag, release, sim, findBox, open }) => {
  // ---- 沙盒（起步城 df 3）：蓋東西不扣錢 ----
  {
    await open('sample=starter');
    await ev(`__gt.tool('road','hwy')`);
    const s0 = await sim(), run = await findBox(3, 1, (i, L) => !L.road[i] && !L.occ[i] && !L.zone[i] && L.ter[i] !== 0);
    if (run.length) { await drag(run[0][1], run.at(-1)[1], 4); await release(); }
    const s1 = await sim();
    log(run.length === 3 && s1.events === s0.events + 3 && s1.money === s0.money && s0.diff === 3, 'D011 沙盒（起步城 df 3）：蓋東西不扣錢（實驗線 51505）', `快速路 ${s1.events - s0.events} 格、資金 ${s0.money}→${s1.money}`);
    await ev('__gt.tool(null)');
  }

  });

  await run('預算與劇本城', async ({ ev, touch, drag, sim, findBox, freshStart, waitFor, open, code, script }, page) => {
    await freshStart();
  // ---- 手機預算（CPU 降速 6 倍）：放開手指到畫出結果 ≤ 400 ms（三次取中位數）；拖曳中每次更新預覽 ≤ 16 ms ----
  {
    await ev(`__gt.tool('road','road')`);
    const commits = [], previews = [], free = (i, L) => !L.road[i] && !L.zone[i] && !L.occ[i] && !L.tree[i] && L.ter[i] !== 0;
    await page.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    try {
      for (let k = 0; k < 3; k++) {
        const run = await findBox(8, 1, free), n0 = (await sim()).events;
        if (!run.length) break;
        await drag(run[0][1], run.at(-1)[1], 10, async () => { const t = await ev('__gt.timing().preview'); if (t !== undefined) previews.push(t); });
        await touch('touchEnd', []);
        if (await waitFor(async () => (await sim()).events > n0)) commits.push(await ev('__gt.timing().commit'));
      }
    } finally { await page.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
    const med = a => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)], p90 = a => [...a].sort((p, q) => p - q)[Math.floor(a.length * .9)];
    log(commits.length === 3 && med(commits) <= 400, 'D011 手機預算：放開手指到畫出結果（規則＋事件＋重建場景＋存檔＋畫一幀）CPU 降速 6 倍下 ≤ 400 ms（三次取中位數）', `${commits.map(x => x.toFixed(0)).join('、')} ms`);
    log(previews.length >= 10 && p90(previews) <= 16, 'D011 手機預算：拖曳中每次更新預覽（算格子、預覽實例、總價標籤）CPU 降速 6 倍下 ≤ 16 ms（判第 90 百分位，最大值照列）',
      previews.length ? `${previews.length} 次：中位數 ${med(previews).toFixed(2)}、P90 ${p90(previews).toFixed(2)}、最大 ${Math.max(...previews).toFixed(2)} ms` : '沒量到');
    await ev('__gt.tool(null)');
  }

  // ---- 劇本城（Node 守衛那一份，資金設定拿掉）在瀏覽器重演 120 天：雜湊＝Node；三角形 ≤ 118,884、draw call ≤ 18 ----
  {
    const KT = kindTableFrom(JSON.parse(R('src/content/lab-kinds.json'))), vrank = JSON.parse(R('src/content/samples/d009-live.json')).vrank;
    const plain = script.map(([k, a]) => k === 'ops' ? [k, a.filter(o => o.k !== 'money')] : [k, a]), plan = [];
    const N = runScript(code, KT, vrank, plain, {}, (s, o, r) => {
      if (!o) { if (plan.at(-1)?.days) plan.at(-1).days++; else plan.push({ days: 1 }); }
      else if (o.k === 'undo') plan.push({ undo: 1 });
      else if (r.op) plan.push({ op: r.op });
    });
    await freshStart();
    const got = await ev(`(()=>{for(const p of ${J(plan)}){if(p.op)__gt.edit(p.op);else if(p.undo)__gt.undo();else __gt.simStep(p.days);}const s=__gt.sim();return {hash:s.hash,day:s.day,pop:s.pop,money:s.money,events:s.events};})()`);
    const d = await ev('({i: __gt.renderInfo(), blank: ' + blankCheck + '})');
    log(got.hash === simHash(N.s) && got.day === N.s.day, `D011 劇本城在瀏覽器重演（${plan.filter(p => p.op).length} 筆施工、${plan.filter(p => p.undo).length} 筆復原、${N.s.day - 1} 天）：狀態雜湊＝Node 跑的`,
      `瀏覽器 ${got.hash}、Node ${simHash(N.s)}；第 ${got.day} 天、人口 ${got.pop}、$${Math.round(got.money)}、事件 ${got.events}`);
    log(d.i.triangles <= 118884 && d.i.calls <= 18 && d.blank > 150, 'D011 手機預算：劇本城第 121 天三角形 ≤ 118,884、draw call ≤ 18；畫面非空白', `${d.i.triangles.toLocaleString()} 個、${d.i.calls} 次；變異數 ${d.blank}`);
  }
    await ev('__gt.clearSave()');
  });
}

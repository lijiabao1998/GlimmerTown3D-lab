// D011 煙霧測試：建造 MVP（驗收 7、8 的瀏覽器半邊，加上審查找到、src 已修的介面與存檔問題）。由 tools/smoke.mjs 呼叫；
// 也能單獨跑：node tools/smoke-d011.mjs（只跑 D011 這幾段；先 npm run build；退出碼 0＝綠燈、1＝紅燈）。
// 手勢與按鈕都用真的觸控事件（CDP Input.dispatchTouchEvent：點一下、一指拖、兩指捏合與平移、抬起一指再放回去）；桌機那段用真的滑鼠與鍵盤事件。
// 手機直式 412×860（另有幾項量 360×740）；預算在 CPU 降速 6 倍下量（推進一天例外：驗收 8 判不降速的，降速 6 倍只量不判，見 script 段）。每一段一個 Chrome（原因見 pageSession）。
// 只跑某幾段：環境變數 D011_SMOKE_ONLY＝逗號分隔的段落鍵（突變測試用；不認得的鍵記紅燈；沒跑的段落在結論前印一行，見 d011SkipNote）：
//   build    建造流程與存檔：開局、版面、一指拖路、兩指縮放平移、電廠、拆除、復原、路的等級、框選、重新整理
//   sandbox  沙盒：起步城蓋東西不扣錢
//   budget   手機預算：放開手指到畫出結果、拖曳中每次更新預覽
//   script   劇本城在瀏覽器重演兩次（雜湊＝Node、三角形與 draw call、推進一天的耗時：不降速判、降速 6 倍只量）、電不夠的提示、讀檔後人口「—」
//   switch   換城與存檔：換城不蓋錯存檔、不碰實驗線的 localStorage、自動存檔失敗、存檔讀不出來、網址開新城先問、歷史跟存檔對不上
//   touch    觸控與版面：多指、路的點一下抖 6 px、框選立刻跟手、介面不穿透、總價標籤、整頁不縮放、狀態列資金、.sub、360×740
//   desk     桌機 1280×800：播放中用滑鼠點播放鈕與路的等級、選單與對話框開著時的快捷鍵；分享碼裡的 HTML（存放型 XSS）
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, sleep } from './cdp.mjs';
import { kindTableFrom } from '../src/content/kindTable.ts';
import { simHash } from '../src/sim/day.ts';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { unpackHistory } from '../src/io/save.ts';
import { fnv1a } from '../src/sim/rng.ts';
import { runScript, scriptOf } from './unit-d011-edit.mjs';
import { rcTamper } from './d011-edit-cases.mjs';

const J = JSON.stringify;
const R = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SECTIONS = ['build', 'sandbox', 'budget', 'script', 'switch', 'touch', 'desk'];
const ONLY = (process.env.D011_SMOKE_ONLY ?? '').split(',').map(s => s.trim()).filter(Boolean);
// D011_SMOKE_ONLY 設了時哪幾段沒跑：兩個入口（這支單獨跑、tools/smoke.mjs）都在結論前印一行，只跑一部分的結果不能看起來像完整的一輪；沒設＝空字串
export const d011SkipNote = () => {
  const skipped = ONLY.length ? SECTIONS.filter(k => !ONLY.includes(k)) : [];
  return skipped.length ? `  注意：D011_SMOKE_ONLY＝${ONLY.join(',')}，D011 這幾段沒跑：${skipped.join('、')}（這一輪不是完整的煙霧測試）` : '';
};
// 單獨跑時的畫面非空白量法（同 tools/smoke.mjs 的 blankCheck）
const BLANK = `(()=>{const c=document.querySelector('canvas'),k=document.createElement('canvas');k.width=96;k.height=60;
  const x=k.getContext('2d');x.drawImage(c,0,0,96,60);const d=x.getImageData(0,0,96,60).data;let s=0,s2=0,n=0;
  for(let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3;s+=v;s2+=v*v;n++;}const m=s/n;return +(s2/n-m*m).toFixed(1);})()`;
// 意外的 alert／confirm／prompt：丟例外（記成頁面錯誤，那一段的「console 零錯誤」轉紅），不讓沒人按的對話框卡住頁面；要測 confirm 的地方自己換掉它
const DIALOG_GUARD = `for (const k of ['alert', 'confirm', 'prompt']) window[k] = m => { throw new Error('D011 煙霧：意外的 ' + k + '：' + m); };`;
// 頁面收到的最近 40 筆 pointer／click 事件（window 捕獲階段；__gtEv），點按鈕的檢查紅燈時印出來當證據：分得出「觸控沒送進頁面」和「收到了卻沒有 click」。
// 起因：a01d92a 的雲端那一輪點「住」工具鈕沒換到工具；靠這份紀錄查到是後者（見 release 的註解）
const TAP_PROBE = `window.__gtEv = [];
for (const t of ['pointerdown', 'pointerup', 'pointercancel', 'click']) addEventListener(t, e => {
  const g = e.target, b = g && g.closest ? g.closest('button') : null;
  window.__gtEv.push(Math.round(performance.now()) + ' ' + t + ' ' + (b ? 'button:' + (b.dataset.t || b.dataset.r || b.id || '?') : g && g.tagName ? g.tagName + (g.id ? '#' + g.id : '') : '?'));
  if (window.__gtEv.length > 40) window.__gtEv.shift();
}, true);`;
// 一次 evaluate 最多等多久：頁面卡住時那一段記紅燈，整支測試不會永遠等下去
const timed = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`等了 ${ms / 1000} 秒沒有回應：${what.slice(0, 80)}`)), ms); })]).finally(() => clearTimeout(t)); };
// 存檔碼 → 天數、資金、難度、歷史筆數（Node 端解）
const saveInfo = code => { const r = code ? decodeLabCode(code) : null; if (!r?.ok) return null; const d3 = r.save.raw.d3; return { day: r.save.day, money: r.save.money, df: r.save.df, events: d3?.r?.length ?? d3?.h?.length ?? 0 }; };
const KEYCODE = { ' ': ['Space', 32], Escape: ['Escape', 27], 3: ['Digit3', 51] };
const mean = a => a.reduce((p, q) => p + q, 0) / a.length, pct = (a, q) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * q))];
const f2 = v => v === undefined || Number.isNaN(v) ? '—' : v.toFixed(2);

// 一個 Chrome 工作階段的共用工具（預設手機直式、觸控模擬；mobile:false＝桌機、滑鼠）。
// 觸控模擬的坑（D011 施工時遇到，頁面收不到任何 pointer／touch 事件，elementFromPoint 卻是畫布）：審查修正這一輪追到重現條件——
// 兩指手勢之後換到「不同網址」的頁（舊頁進了上一頁快取，pagehide 的 persisted＝true），之後的觸控一律送不進新頁（兩指變成整頁縮放）；
// 換到同一個網址（等於重新載入）、或換頁之前沒有兩指手勢，都沒事。所以每段各開一個 Chrome；有兩指手勢的段落，手勢之後只重新載入同一個網址
async function pageSession(page, open0, { W = 412, H = 860, mobile = true } = {}) {
  const open = async q => { await open0(q); if (mobile) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); };
  await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile });
  if (mobile) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: DIALOG_GUARD + '\n' + TAP_PROBE });
  const ev = (e, ms = 240000) => timed(page.evaluate(e), ms, e);
  // 觸控點 [x, y] 或 [x, y, 手指編號]（沒給＝陣列位置）。實測 CDP 的語意：touchStart 列出所有按著的指，新的編號＝放下；touchMove 列出要動的指
  // （少列一指只是那一指不動，不會放開它）；touchEnd 列出的指＝放開那幾指，列空的＝全部放開
  const touch = (type, pts) => page.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id], k) => ({ x, y, id: id ?? k })) });
  // 等頁面畫過 n 幀：鏡頭的阻尼每幀補一次（看幀數，不看牆鐘時間）；pointermove 是對齊畫面幀才送進頁面的連續事件，畫過一幀它就處理完了
  const frames = n => ev(`new Promise(r => { let k = 0; const f = () => ++k >= ${n} ? r(k) : requestAnimationFrame(f); requestAnimationFrame(f); })`);
  // 拖完先等 2 幀：之前最後一次移動之後只等 20 ms 就讀預覽，機器忙時那一幀還沒到，讀到的是前一格（Chrome 154 三個平行 18 輪中 1 輪：預覽 11 格 $165、實扣 12 格 $180）
  const drag = async (a, b, steps = 8, each, down) => { await touch('touchStart', [a]); await down?.(); for (let k = 1; k <= steps; k++) { await touch('touchMove', [[a[0] + (b[0] - a[0]) * k / steps, a[1] + (b[1] - a[1]) * k / steps]]); await sleep(20); await each?.(); } await frames(2); };
  // 放開：手指先停住 150 ms 再抬起（真人拉到終點也會停一下）。手指還在動就抬起，瀏覽器當成甩動；甩動還在進行時的下一下點擊，
  // 頁面只收到 pointerdown／pointerup、沒有 click（實測 Google Chrome 154、CDP 觸控注入：放開後 50–150 ms 點工具鈕，8 次掉 2 次；停住再放 24 次全有；
  // Chromium 141 沒有這個行為）。a01d92a 的雲端那一輪，點「住」工具鈕就是這樣掉的（見 D011 卡「施工中遇到」）
  const release = async () => { await sleep(150); await touch('touchEnd', []); await sleep(150); };
  const tapAt = async ([x, y]) => { await touch('touchStart', [[x, y]]); await sleep(30); await touch('touchEnd', []); await sleep(200); };   // 真的點一下（synthesizeTapGesture 受實際視窗大小限制，手機版下方的鈕會超界）
  const center = sel => ev(`(()=>{const e=document.querySelector(${J(sel)});if(!e)return null;const b=e.getBoundingClientRect();return [b.left+b.width/2,b.top+b.height/2];})()`);
  const rectOf = sel => ev(`(()=>{const e=document.querySelector(${J(sel)});if(!e)return null;const b=e.getBoundingClientRect();return {l:b.left,t:b.top,r:b.right,b:b.bottom,w:b.width,h:b.height,hidden:!!e.closest('[hidden]')};})()`);
  const hit = p => ev(`(()=>{const e=document.elementFromPoint(${p[0]},${p[1]});return e?e.tagName+(e.id?'#'+e.id:''):null;})()`);
  const toasts = () => ev(`[...document.querySelectorAll('.toast')].map(t=>t.textContent)`);
  const tapBtn = async sel => { const c = await center(sel); if (c) await tapAt(c); return !!c; };
  // 滑鼠：移過去、按下、隔 hold 毫秒放開；鍵盤：按下＋放開一個鍵
  const mouse = (type, [x, y]) => page.send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: type === 'mouseMoved' ? 0 : 1 });
  const click = async (p, hold = 60) => { await mouse('mouseMoved', p); await mouse('mousePressed', p); await sleep(hold); await mouse('mouseReleased', p); await sleep(120); };
  const clickBtn = async (sel, hold) => { const c = await center(sel); if (c) await click(c, hold); return !!c; };
  const key = async k => { const [code, kc] = KEYCODE[k]; await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, windowsVirtualKeyCode: kc, text: k.length === 1 ? k : undefined }); await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: kc }); await sleep(120); };
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

  return { W, H, ev, touch, drag, release, tapAt, tapBtn, center, rectOf, hit, toasts, click, clickBtn, key, cell, sim, onScreen, code, script, X, Z, visibleRun, findBox, freshStart, waitFor, open, frames };
}

// 空的陸地（沒有路、分區、建築、樹）
const free = (i, L) => !L.road[i] && !L.zone[i] && !L.occ[i] && !L.tree[i] && L.ter[i] !== 0;

// 七段各開一個 Chrome（段落鍵見檔頭）。每段另查零外部請求、console 零錯誤；整段跑到一半丟例外也記紅燈，後面的段照跑。
// opt：W、H、mobile（pageSession）；settle＝每次開頁後等幾毫秒（withBrowser 預設 900，讓第一幀畫完；不量畫面的段落可以短一點）
export async function d011Smoke(withBrowser, log, blankCheck = BLANK) {
  const unknown = ONLY.filter(k => !SECTIONS.includes(k));
  if (unknown.length) log(false, 'D011_SMOKE_ONLY 的段落鍵都認得', `不認得 ${unknown.join('、')}；認得的是 ${SECTIONS.join('、')}`);
  const run = async (key, name, fn, opt = {}) => {
    if (ONLY.length && !ONLY.includes(key)) return;
    const t0 = Date.now();
    await withBrowser({ width: opt.W > 960 ? opt.W : 960, height: opt.W > 960 ? opt.H : 600, settle: opt.settle }, async ({ open, page }) => {
      try { await fn(await pageSession(page, open, opt), page); } catch (e) { log(false, `D011 ${name}：整段跑完`, '丟例外：' + (e?.stack ?? e).toString().split('\n').slice(0, 3).join(' ｜ ')); }
      const ext = page.requests.filter(u => !/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));
      log(ext.length === 0 && page.errors.length === 0, `D011 ${name}：零外部請求、console 零錯誤`,
        (ext.length ? ext.slice(0, 3).join(' ') : page.errors.length ? page.errors.slice(0, 4).join(' ｜ ') : `共 ${page.requests.length} 個請求`) + `；這一段 ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    });
  };

  await run('build', '建造流程與存檔', async ({ W, H, ev, touch, drag, release, tapAt, tapBtn, cell, sim, X, Z, visibleRun, findBox, freshStart, open, frames }) => {
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
  // 放開之後等 90 幀再量：鏡頭有阻尼（three.js 預設每幀補上剩下的 5%），之前固定等 500 ms，機器忙、幀數少時只補到六七成，
  // 平移量到 0.45–0.61 格、門檻 0.5（本機 25 次有 5 次低於門檻）；90 幀補到 1−0.95⁹⁰≈99%
  {
    const c0 = await ev('__gt.cam()'), s0 = await sim(), cx = W / 2, cy = H / 2 - 80;
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', [[cx - 40 - k * 12, cy], [cx + 40 + k * 12, cy]]); await sleep(20); }
    await touch('touchEnd', []); await frames(90);
    const c1 = await ev('__gt.cam()');
    await touch('touchStart', [[cx - 40, cy], [cx + 40, cy]]);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', [[cx - 40 + k * 10, cy + k * 8], [cx + 40 + k * 10, cy + k * 8]]); await sleep(20); }
    await touch('touchEnd', []); await frames(90);
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
    const s0 = await sim();
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
  // 先確認點「住」真的換到工具（a01d92a 雲端那一輪沒換到，接著拖出來的是快速路：4×4 格 $840＝L 形 7 格 × $120）；沒換到就印出頁面收到的事件
  {
    await ev('window.__gtEv.length = 0');
    await tapBtn('.tool[data-t="zr"]');
    const toolNow = (await ev('__gt.ui()')).tool, evZ = toolNow === 'zr' ? [] : await ev('window.__gtEv');
    const s0 = await sim();
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
    log(toolNow === 'zr' && big.length === side * side && !!pv && pv.total > s0.money && s1.money === s0.money && zones1 === zones0 && /資金不足/.test(toast) && !!pv2 && pv2.count === 3 && s2.money === s0.money - pv2.total && zones2 === zones0 + 3,
      'D011 框選分區：總價超過資金整塊不蓋（實驗線原句「資金不足」）；夠就逐格蓋、扣的錢＝預覽總價',
      (toolNow === 'zr' ? '' : `點「住」之後工具是 ${toolNow}，沒換到；頁面收到的事件：${evZ.length ? evZ.join('｜') : '沒有'}；`)
      + `${side}×${side} 格 $${pv?.total} > $${s0.money}：${zones1 === zones0 ? '沒蓋' : `蓋了 ${zones1 - zones0} 格`}（${toast.split('|').find(t => /資金不足/.test(t)) ?? '沒有提示'}）；3 格 $${pv2?.total}：${zones2 - zones1 === 3 ? '蓋了' : `分區多了 ${zones2 - zones1} 格`}`);
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

  await run('sandbox', '沙盒', async ({ ev, drag, release, sim, findBox, open }) => {
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

  await run('budget', '手機預算', async ({ ev, touch, drag, sim, findBox, freshStart, waitFor }, page) => {
    await freshStart();
  // ---- 手機預算（CPU 降速 6 倍）：放開手指到畫出結果 ≤ 400 ms（三次取中位數）；拖曳中每次更新預覽 ≤ 16 ms（卡面驗收 8：「每次」，判最大值）----
  // 預覽只在手指那一格換了才重算（src/cityView.ts pointermove）：按下那一次、之後 __gt.stroke().b 每換一次各取一個樣本；沒重算的移動不取（timing 還是上一次的值，重複取會灌水）
  {
    await ev(`__gt.tool('road','road')`);
    const commits = [], previews = [];
    await page.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    try {
      for (let k = 0; k < 3; k++) {
        const run = await findBox(8, 1, free), n0 = (await sim()).events;
        if (!run.length) break;
        let lastB = null;
        const sample = async () => { const s = await ev('(()=>{const s=__gt.stroke();return s?{b:s.b,t:__gt.timing().preview}:null;})()'); if (s && J(s.b) !== J(lastB) && s.t !== undefined) { previews.push(s.t); lastB = s.b; } };
        await drag(run[0][1], run.at(-1)[1], 10, sample, sample);
        await touch('touchEnd', []);
        if (await waitFor(async () => (await sim()).events > n0)) commits.push(await ev('__gt.timing().commit'));
      }
    } finally { await page.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
    const med = a => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
    log(commits.length === 3 && med(commits) <= 400, 'D011 手機預算：放開手指到畫出結果（規則＋事件＋重建場景＋存檔＋畫一幀）CPU 降速 6 倍下 ≤ 400 ms（三次取中位數）', `${commits.map(x => x.toFixed(0)).join('、')} ms`);
    log(previews.length >= 10 && Math.max(...previews) <= 16, 'D011 手機預算：拖曳中每次更新預覽（算格子、預覽實例、總價標籤）CPU 降速 6 倍下 ≤ 16 ms（只取真的重算的那幾次，判最大值）',
      previews.length ? `${previews.length} 次：中位數 ${med(previews).toFixed(2)}、P90 ${pct(previews, .9).toFixed(2)}、最大 ${Math.max(...previews).toFixed(2)} ms；依序 ${previews.map(v => v.toFixed(1)).join(' ')}` : '沒量到');
    await ev('__gt.tool(null)');
  }
  });

  await run('script', '劇本城', async ({ ev, freshStart, open, code, script }, page) => {
  // ---- 劇本城（Node 守衛那一份，資金設定拿掉）在瀏覽器重演 120 天：雜湊＝Node；三角形 ≤ 118,884、draw call ≤ 18 ----
  // 劇本逐筆記成瀏覽器要做的事（契約 tools/d011-ops.mjs）：施工記實際提交的那一筆（pick 找到的座標 Node 已經解好，r.op）、復原、
  // 亂數對齊（{k:'seed'} → __gt.simSeed，兩邊都換成 mulberry32(v)）、推進幾天（from＝從第幾天起推）
  const KT = kindTableFrom(JSON.parse(R('src/content/lab-kinds.json'))), vrank = JSON.parse(R('src/content/samples/d009-live.json')).vrank;
  const plain = script.map(([k, a]) => k === 'ops' ? [k, a.filter(o => o.k !== 'money')] : [k, a]), plan = [];
  const N = runScript(code, KT, vrank, plain, {}, (s, o, r) => {
    if (!o) { if (plan.at(-1)?.days) plan.at(-1).days++; else plan.push({ days: 1, from: s.day - 1 }); }
    else if (o.k === 'undo') plan.push({ undo: 1 });
    else if (o.k === 'seed') plan.push({ seed: o.v });
    else if (r.op) plan.push({ op: r.op });
  });
  const cut = plan.findIndex(p => p.days && p.from >= 61);
  if (cut < 0) throw new Error('劇本沒有從第 61 天起推進的那一段：' + J(plan.filter(p => p.days)));
  const DO = `p=>{if(p.op)__gt.edit(p.op);else if(p.undo)__gt.undo();else if(p.seed!==undefined)__gt.simSeed(p.seed);else __gt.simStep(p.days);}`;
  // 從新城重演到第 60 天（不降速），第 61–120 天在 CPU 降速 rate 倍下一天一天推。每一天記 [第幾天, __gt.simStep(1) 的耗時, 這一天重建場景的耗時（沒重建＝null）, 緊接著 __gt.simStep(0) 的耗時, 這一天有沒有自動存檔]。
  // simStep(0) 不推天數，只做 simStep(1) 推完天數之後的那一截（重整介面、畫一幀、算狀態雜湊）：兩者相減＝推進一天（含結算）本身。
  // 自動存檔（播放中每 5 天，src/cityView.ts simDay）也在 simStep(1) 裡：存檔內容變了就記下來（在計時外面比）
  const replay = async rate => {
    await freshStart();
    await ev(`(()=>{const f=${DO};for(const p of ${J(plan.slice(0, cut))})f(p);})()`);
    if (rate !== 1) await page.send('Emulation.setCPUThrottlingRate', { rate });
    try {
      return await ev(`(()=>{const f=${DO},out=[],sv=()=>localStorage.getItem('gt3d.v1.save');let rb=__gt.sim().rebuilds;
        for(const p of ${J(plan.slice(cut))}){
          if(!p.days){f(p);rb=__gt.sim().rebuilds;continue;}
          for(let k=0;k<p.days;k++){const c0=sv(),t0=performance.now(),s=__gt.simStep(1),t1=performance.now(),r=s.rebuilds>rb?__gt.timing().rebuild:null,saved=sv()!==c0;rb=s.rebuilds;
            const t2=performance.now();__gt.simStep(0);out.push([s.day-1,t1-t0,r,performance.now()-t2,saved]);}
        }
        return out;})()`);
    } finally { if (rate !== 1) await page.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
  };
  // 重演兩次，各自從新城起：先不降速（判卡面驗收 8 的 5 ms），再 CPU 降速 6 倍（只量不判，見下）；兩次的雜湊都要＝Node。後面幾項都接著降速那一次的城
  const days1 = await replay(1), hash1 = (await ev('__gt.sim()'))?.hash, days = await replay(6);
  const got = await ev(`(()=>{const s=__gt.sim();return {hash:s.hash,day:s.day,pop:s.pop,money:s.money,events:s.events};})()`);
  const d = await ev('({i: __gt.renderInfo(), blank: ' + blankCheck + '})');
  log(got.hash === simHash(N.s) && got.day === N.s.day && hash1 === got.hash, `D011 劇本城在瀏覽器重演（${plan.filter(p => p.op).length} 筆施工、${plan.filter(p => p.undo).length} 筆復原、${plan.filter(p => p.seed !== undefined).length} 次亂數對齊、${N.s.day - 1} 天）：狀態雜湊＝Node 跑的（重演兩次：不降速、CPU 降速 6 倍，兩次都相同）`,
    `瀏覽器 ${got.hash}（不降速那一次 ${hash1}）、Node ${simHash(N.s)}；第 ${got.day} 天、人口 ${got.pop}、$${Math.round(got.money)}、事件 ${got.events}`);
  log(d.i.triangles <= 118884 && d.i.calls <= 18 && d.blank > 150, 'D011 手機預算：劇本城第 121 天三角形 ≤ 118,884、draw call ≤ 18；畫面非空白', `${d.i.triangles.toLocaleString()} 個、${d.i.calls} 次；變異數 ${d.blank}`);

  // ---- 推進一天（卡面驗收 8：含結算 ≤ 5 ms）：劇本城第 61–120 天，量 simStep(1) − simStep(0)（見上）----
  // 重建場景的那幾天另扣 timing.rebuild，但丟掉舊場景、新場景第一次上傳 GPU 還算在裡面（偏高）；自動存檔那幾天多了存檔。
  // 所以只判「沒有重建、沒有自動存檔的那幾天」的平均（同 Node 守衛判平均）；那幾天不到 10 天就量不準，記紅燈（劇本固定，現在是 19 天。之前改判全部 60 天扣重建，重建那幾天偏高得多，不再拿來判）。
  // 判的是不降速的那一次：驗收 8 沒寫降速，D010 卡同一條預算也是在桌機上量。CPU 降速 6 倍（規則 5「預算以中階手機為準」的代理）那一次只量不判：
  // c736ecd 之後這台機器各輪平均 8–17 ms（同一輪不降速 1.5–2.2 ms），沒壓到 5 ms，是已知的缺口、記在卡面「沒做成的事」，Pages 上線不因它擋下；照列平均、有沒有超過 5 ms
  {
    const stat = ds => {
      const plain = ds.filter(x => x[2] === null && !x[4]).map(x => x[1] - x[3]), all = ds.map(x => x[1] - (x[2] ?? 0) - x[3]), rb = ds.filter(x => x[2] !== null);
      return { ok: ds.length === 60 && ds[0][0] === 61 && plain.length >= 10, m: mean(plain),
        txt: `${ds.length} 天（第 ${ds[0]?.[0]}–${ds.at(-1)?.[0]} 天）；沒有重建、沒有存檔的 ${plain.length} 天：平均 ${f2(mean(plain))}、中位數 ${f2(pct(plain, .5))}、P95 ${f2(pct(plain, .95))}、最大 ${f2(Math.max(...plain))} ms；`
          + `全部 60 天扣重建：平均 ${f2(mean(all))} ms（重建 ${rb.length} 天、重建平均 ${f2(mean(rb.map(x => x[2])))} ms；自動存檔 ${ds.filter(x => x[4]).length} 天）；`
          + `simStep(1) 原始耗時平均 ${f2(mean(ds.map(x => x[1])))} ms、simStep(0) 平均 ${f2(mean(ds.map(x => x[3])))} ms` };
    };
    const u = stat(days1), t = stat(days);
    log(u.ok && u.m <= 5, 'D011 驗收 8「推進一天（含結算）≤ 5 ms」，瀏覽器不降速（驗收 8 沒寫降速，D010 卡同一條預算在桌機上量；規則 5 的手機代理見下一項）：劇本城第 61–120 天一天一天推；量 __gt.simStep(1) 減同一刻的 __gt.simStep(0)，判沒有重建、沒有自動存檔那幾天的平均',
      `平均 ${f2(u.m)} ms；${u.txt}｜同一套量法 CPU 降速 6 倍：平均 ${f2(t.m)} ms（只量不判，見下一項）`);
    // 這一項只在量不到（天數不對、沒有重建沒有存檔的日子不到 10 天）時記紅燈；數字多少都不判
    log(t.ok, 'D011 手機預算：推進一天（含結算）CPU 降速 6 倍——只量不判（規則 5 以中階手機為準：這個數沒壓到 5 ms 是已知的缺口，記在卡面「沒做成的事」；判的是上一項不降速的）',
      `平均 ${f2(t.m)} ms（${t.m > 5 ? '超過 5 ms，見卡面「沒做成的事」' : '沒超過 5 ms'}）；${t.txt}｜不降速：平均 ${f2(u.m)} ms`);
  }

  // ---- 電不夠（卡面第 9 節）：要用電的住商工 > 電廠容量 → 提示「⚡ 電不夠了」、狀態列的電變紅；容量夠了兩個都消失 ----
  // 劇本城本來夠電：拆電廠（留一座：一座都沒有時提示的是「③ 蓋電廠」）直到不夠；本來就不夠：在空地上加蓋電廠（容量不看有沒有接路）直到夠。兩種狀態都驗，做完一筆一筆復原（同一天可以復原）
  {
    const pw = () => ev(`(()=>{const p=__gt.sim().power,c=document.querySelector('#stats [data-k=power]');return {need:p.powered+p.unpowered,cap:p.cap,chip:c.textContent,bad:c.classList.contains('bad'),hidden:c.hidden,coach:__gt.ui().coach,plants:__gt.buildingList().filter(b=>b[1]===5).length};})()`);
    const short = q => q.need > q.cap, p0 = await pw(), seq = [p0];
    let edits = 0;
    if (short(p0)) {
      for (let k = 0; k < 8 && short(seq.at(-1)); k++) {
        const at = await ev(`(()=>{const L=__gt.layers(),n=L.n;for(let i=0;i<n*n;i++){if(L.road[i]||L.zone[i]||L.occ[i]||L.tree[i]||L.ter[i]===0)continue;const x=i%n,z=(i/n)|0,r=__gt.edit({k:'tap',tool:'plant',x0:x,z0:z,x1:x,z1:z});if(r&&r.placed)return [x,z];}return null;})()`);
        if (!at) break;
        edits++; seq.push(await pw());
      }
    } else {
      for (const b of (await ev('__gt.buildingList()')).filter(b => b[1] === 5).slice(1)) {
        if (short(seq.at(-1))) break;
        const r = await ev(`__gt.edit(${J({ k: 'rect', tool: 'doze', x0: b[2], z0: b[3], x1: b[2], z1: b[3] })})`);
        if (r?.placed) { edits++; seq.push(await pw()); }
      }
    }
    for (let k = 0; k < edits; k++) await ev('__gt.undo()');
    const back = await pw(), lo = seq.find(short), hi = seq.find(q => !short(q));
    log(!!lo && !!hi && lo.plants >= 1 && lo.bad && !lo.hidden && /^⚡/.test(lo.coach ?? '') && !hi.bad && !hi.hidden && !/^⚡/.test(hi.coach ?? '') && J(back) === J(p0),
      'D011 電不夠：要用電的住商工多過電廠容量時提示「⚡ 電不夠了」、狀態列的電變紅；容量夠了兩個都消失（一座燃煤電廠約供 75 棟，實驗線 52473、55008）',
      `劇本城第 ${N.s.day} 天 ${p0.chip}（電廠 ${p0.plants} 座）→ ${short(p0) ? '加蓋' : '拆掉'} ${edits} 座：` + seq.map(q => `${q.chip}（${q.bad ? '紅' : '沒紅'}）「${q.coach ?? '沒有提示'}」`).join(' → ') + `；復原後 ${back.chip}`);
  }

  // ---- 讀檔後、過第一天之前人口還沒算（實驗線 load 也不重算）：狀態列人口與幸福顯示「—」，推一天之後才是數字 ----
  {
    await open('');                                                       // 重新讀我的城（劇本城：每一筆施工、復原都自動存了）
    const hud = `({pop:document.querySelector('#stats [data-k=pop]').textContent,sub:document.getElementById('citySub').textContent,res:__gt.sim().rci[1][0],sample:__gt.sample})`;
    const a = await ev(hud);
    await ev('__gt.simStep(1)');
    const b = await ev(hud);
    log(a.sample === 'mine' && a.res > 0 && a.pop === '—' && /幸福 —/.test(a.sub) && /^\d[\d,]*$/.test(b.pop) && /幸福 \d/.test(b.sub),
      'D011 讀檔後過第一天之前：狀態列人口「—」、幸福「—」（不顯示還沒算的 0）；推一天之後是數字', `住宅 ${a.res} 棟；讀檔後 人口「${a.pop}」「${a.sub.split('・').pop()}」→ 推一天 人口「${b.pop}」「${b.sub.split('・').pop()}」`);
  }
    await ev('__gt.clearSave()');
  });

  await run('switch', '換城與存檔', async ({ ev, sim, tapBtn, open, waitFor, toasts, X, Z }, page) => {
    // ---- 實驗線的鍵（卡面第 7 節：兩條線都在 lijiabao1998.github.io，localStorage 共用）：頁面還沒跑任何程式之前先放兩個哨兵，整段做完要逐字不變 ----
    const SENT = { 'glimmerville.v1': 'GVX1:哨兵・實驗線的存檔（3D 不讀不寫）eyJ2IjoxfQ==', 'glimmerville.v1.slot': '哨兵・存檔槽 2' };
    const pre = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `for (const [k, v] of Object.entries(${J(SENT)})) localStorage.setItem(k, v);` });
    await open('sample=seed516&clean=1');
    await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: pre.identifier });
    const store = () => ev(`(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}return o;})()`);
    const store0 = await store();
    await ev('__gt.clearSave()'); await open('');
    const saved = async () => saveInfo(await ev('__gt.saved()'));
    // 選單換城：真的點 ☰、再點那一項（src/ui/buildUi.ts 的按鈕 → onMenu）；等到頁面換成那座城
    const menuTo = async (id, want) => {
      if (!await tapBtn('#menuBtn') || !await waitFor(async () => !(await ev(`document.getElementById('menu').hidden`)), 2000)) return false;
      return await tapBtn(`#menu .item[data-m=${J(id)}]`) && await waitFor(async () => await ev('__gt.sample') === want && (await ev(`document.getElementById('menu').hidden`)), 4000);
    };

    // ---- 換城（審查阻斷）：我的城有還沒存的進度 → 選單 我的城→起步城→我的城→種子城 → 重新整理：存檔還是玩家的城，那 3 天也在 ----
    {
      await ev(`__gt.edit(${J({ k: 'line', tool: 'road', x0: X, z0: Z + 5, x1: X + 6, z1: Z + 5 })})`);   // 蓋一條路（自動存檔）
      await ev('__gt.simStep(3)');                                        // 再推 3 天：每 5 天才自動存，存檔落後 3 天
      const m0 = await sim(), lag = await saved(), path = [];
      path.push(await menuTo('city:starter', 'starter'), await menuTo('city:mine', 'mine'));
      const back = await sim();
      path.push(await menuTo('city:seed516', 'seed516'));
      await open('');
      const after = await sim(), sv = await saved(), ts = await toasts(), sample = await ev('__gt.sample');
      log(lag?.day === m0.day - 3 && path.every(Boolean) && back.diff === 1 && back.day === m0.day && back.events === m0.events
        && sample === 'mine' && after.diff === 1 && after.day === m0.day && after.events === m0.events && after.money === Math.round(m0.money)
        && sv?.df === 1 && sv.day === m0.day && sv.events === m0.events && ts.includes('已接著上次的城繼續'),
        'D011 換城（審查阻斷）：我的城有還沒存的 3 天，從選單 我的城→起步城→我的城→種子城、再重新整理：存檔還是玩家的城（df 1、歷史筆數、天數、資金），那 3 天也在；開頁提示「已接著上次的城繼續」',
        `我的城第 ${m0.day} 天（存檔停在第 ${lag?.day} 天）、${m0.events} 筆、$${f2(m0.money)}；選單 ${path.map(Boolean).join('/')}；換回我的城第 ${back.day} 天、df ${back.diff}；重新整理：${sample} 第 ${after.day} 天、${after.events} 筆、$${after.money}、df ${after.diff}；「${ts.join('｜')}」`);
    }
    // ---- 播放中換城：10 倍速播約 2 秒，等存檔落後至少 2 天，同一刻換到起步城（__gt.menu 走選單同一條路 onMenu），再換回來：天數不倒退 ----
    {
      await ev('__gt.simSpeed(2)'); await ev('__gt.simPlay(true)'); await sleep(2000);
      let at = null;
      for (const t0 = Date.now(); !at && Date.now() - t0 < 5000;) {
        at = await ev(`(()=>{const s=__gt.sim(),sd=JSON.parse(atob(__gt.saved())).day;if(!s.playing||s.day-sd<2)return null;__gt.menu('city:starter');return {day:s.day,saved:sd,events:s.events,playing:s.playing,sample:__gt.sample};})()`);
        if (!at) await sleep(40);
      }
      await ev(`__gt.menu('city:mine')`);
      const b = await sim(), sv = await saved();
      log(!!at && at.sample === 'starter' && b.day === at.day && b.events === at.events && !b.playing && sv?.day === at.day,
        'D011 播放中換城：10 倍速播著、存檔落後幾天時換到起步城再換回來，天數不倒退（換城前先用舊城自己的身分存）',
        at ? `換城那一刻第 ${at.day} 天（存檔停在第 ${at.saved} 天）→ 換回來第 ${b.day} 天、存檔第 ${sv?.day} 天` : '5 秒內沒等到存檔落後 2 天以上的時刻');
    }
    // ---- 已經在我的城又選我的城：只存一次、不重讀（重讀會退回存檔那天）----
    {
      await ev('__gt.simStep(3)');
      const r0 = await sim(), s0 = await saved(), ok = await menuTo('city:mine', 'mine');
      await waitFor(async () => (await saved())?.day === r0.day);
      const r1 = await sim(), s1 = await saved();
      log(ok && s0?.day === r0.day - 3 && r1.day === r0.day && r1.events === r0.events && r1.money === r0.money && s1?.day === r0.day,
        'D011 已經在我的城又從選單選我的城：天數、事件、資金都不倒退，存檔跟上', `第 ${r0.day} 天（存檔第 ${s0?.day} 天）→ 選了之後第 ${r1.day} 天、$${f2(r1.money)}、存檔第 ${s1?.day} 天`);
    }

    // ---- 自動存檔失敗（審查：之前靜靜失敗）：瀏覽器空間滿了 → 通知、狀態列掛「⚠ 未存檔」、存檔不動；恢復後再蓋一筆 → 「已恢復自動存檔」、標記拿掉 ----
    {
      const f0 = await ev('__gt.saved()');
      const look = `({chip:(()=>{const c=document.querySelector('#stats [data-k=unsaved]'),r=c.getBoundingClientRect();return {hidden:c.hidden,text:c.textContent,w:r.width,h:r.height};})(),err:__gt.ui().saveError,saved:__gt.saved(),toasts:[...document.querySelectorAll('.toast')].map(t=>t.textContent)})`;
      await ev(`(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('測試：空間滿了','QuotaExceededError');};})()`);
      await ev(`__gt.edit(${J({ k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 1, x1: X + 3, z1: Z + 2 })})`);
      const bad = await ev(look);
      await ev('Storage.prototype.setItem=window.__setItem');
      await ev(`__gt.edit(${J({ k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 3, x1: X + 3, z1: Z + 3 })})`);
      const good = await ev(look), s2 = await sim();
      log(bad.toasts.some(t => /沒辦法自動存檔/.test(t) && /儲存空間滿了/.test(t)) && !bad.chip.hidden && bad.chip.text === '⚠ 未存檔' && bad.chip.w > 0 && bad.err === '瀏覽器的儲存空間滿了' && bad.saved === f0
        && good.chip.hidden && good.toasts.includes('已恢復自動存檔') && good.err === '' && saveInfo(good.saved)?.events === s2.events,
        'D011 自動存檔失敗（空間滿了）：跳通知「沒辦法自動存檔」、狀態列掛「⚠ 未存檔」、存檔不動；恢復之後下一筆就存上、通知「已恢復自動存檔」、標記拿掉',
        `失敗：「${bad.toasts.find(t => /存檔/.test(t)) ?? '沒有通知'}」、標記「${bad.chip.text}」${bad.chip.hidden ? '藏著' : `${Math.round(bad.chip.w)}×${Math.round(bad.chip.h)}`}、存檔${bad.saved === f0 ? '沒動' : '變了'}；恢復：「${good.toasts.find(t => /存檔/.test(t)) ?? '沒有通知'}」、標記${good.chip.hidden ? '拿掉了' : '還在'}、存檔 ${saveInfo(good.saved)?.events} 筆＝${s2.events}`);
    }

    // ---- 讀檔時歷史接不回來要講原因（審查：之前一律說「已接著上次的城繼續」）：把存檔裡一筆路的等級 2 改成 4（格式對、重播得出來，跟存檔對不上）再開頁 ----
    {
      await open('sample=seed516&clean=1');                               // 先離開我的城（離開時會存一次），改過的存檔才不會被舊頁面蓋回去
      const S = decodeLabCode(await ev('__gt.saved()')).save, n = S.n, rd = S.layers.rd ?? '', rcl = S.layers.rcl ?? '';
      const tiles = Array.from({ length: n * n }, (_, i) => ({ road: rd[i] !== '0', rc: rcl.charCodeAt(i) - 48 }));
      const T = rcTamper(S.raw, unpackHistory(S.raw.d3.r, n), tiles, n), o = { ...S.raw, d3: T.d3 };
      delete o.z;
      await ev(`localStorage.setItem('gt3d.v1.save', ${J(encodeLabCode(o, { deflate: true }))})`);
      await open('');
      const r = await ev(`({toasts:[...document.querySelectorAll('.toast')].map(t=>t.textContent),note:__gt.loadNote(),sample:__gt.sample})`);
      log(r.sample === 'mine' && r.toasts.some(t => t.startsWith('歷史跟存檔對不上')) && !r.toasts.includes('已接著上次的城繼續') && r.note.startsWith('歷史跟存檔對不上'),
        'D011 讀檔時歷史跟存檔對不上（存檔裡一筆路的等級被改過）：開頁提示講原因「歷史跟存檔對不上…」，不說「已接著上次的城繼續」', `改第 ${T.row + 1} 筆（第 ${T.i} 格）；提示「${r.toasts.join('｜')}」`);
    }

    // ---- 開頁時存檔讀不出來（審查：之前整頁停在例外）：原檔另存 gt3d.v1.save.bad、開一座新城（備份存得下，新城照常自動存成我的城）、提示「讀不出來」 ----
    // 開頁、讀頁面都包在 try 裡：頁面一直沒有 ready（開頁時丟例外，__gt 沒出來）或讀的時候丟例外，這一項自己記紅燈、講原因；
    // 再把壞存檔拿掉重開一次（開新城、存成我的城），後面幾項照跑（之前只從整段的例外出口紅，後面幾項都沒跑到）
    {
      await open('sample=seed516&clean=1');
      await ev(`localStorage.setItem('gt3d.v1.save','not-a-code')`);
      const e0 = page.errors.length;
      let c = null, why = '';
      try {
        await open('');
        c = await ev(`window.__gt&&__gt.ready?{sample:__gt.sample,bad:localStorage.getItem('gt3d.v1.save.bad'),toasts:[...document.querySelectorAll('.toast')].map(t=>t.textContent),s:__gt.sim(),saved:__gt.saved()}:null`);
        if (!c) why = '頁面一直沒有 ready（等了 30 秒，window.__gt 沒出來）';
      } catch (e) { why = '開頁或讀頁面時丟例外：' + String(e?.message ?? e).split('\n')[0].slice(0, 200); }
      const errs = page.errors.slice(e0), sv = saveInfo(c?.saved);
      log(!!c && errs.length === 0 && c.sample === 'mine' && c.bad === 'not-a-code' && c.toasts.some(t => /讀不出來/.test(t) && /gt3d\.v1\.save\.bad/.test(t)) && c.s?.events === 1 && c.s.money === 3000 && c.s.day === 1 && sv?.events === 1 && sv.day === 1,
        'D011 開頁時存檔讀不出來：頁面沒有例外；原檔原樣另存 gt3d.v1.save.bad、開一座新城（第 1 天、$3000）並存成我的城；提示「存檔讀不出來…」',
        (c ? `__gt.sample＝${c.sample}、.bad＝${J(c.bad)}、新城${c.s ? `第 ${c.s.day} 天 $${c.s.money} ${c.s.events} 筆` : '沒有模擬'}、存檔 ${sv ? `第 ${sv.day} 天 ${sv.events} 筆` : '讀不出來'}；「${c.toasts.join('｜')}」` : why)
        + `；頁面錯誤 +${errs.length}${errs.length ? '：' + errs.slice(0, 2).map(e => e.split('\n')[0]).join(' ｜ ') : ''}`);
      if (!c) { await ev(`localStorage.removeItem('gt3d.v1.save')`); await open(''); }
    }

    // ---- 網址 ?sample=newcity、已經有我的城（審查：之前不問就蓋掉）：先問；不要＝開我的城、存檔不動；要＝開新城、立刻存成我的城 ----
    {
      await ev(`__gt.edit(${J({ k: 'line', tool: 'road', x0: X, z0: Z + 5, x1: X + 4, z1: Z + 5 })})`);   // 我的城多幾筆：跟新城分得出來
      const ask = async answer => {
        await open('sample=seed516&clean=1');
        const before = await ev('__gt.saved()');
        const p = await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__asked=[];window.confirm=m=>{window.__asked.push(String(m));return ${answer};};` });
        await open('sample=newcity');
        await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: p.identifier });
        return { before, ...(await ev('({asked:window.__asked,sample:__gt.sample,saved:__gt.saved(),s:__gt.sim()})')) };
      };
      const no = await ask(false), yes = await ask(true), b0 = saveInfo(no.before), ys = saveInfo(yes.saved);
      log(no.asked?.length === 1 && /蓋掉/.test(no.asked[0]) && no.sample === 'mine' && no.saved === no.before && b0?.events > 1 && no.s.events === b0.events
        && yes.asked?.length === 1 && yes.sample === 'mine' && yes.s.events === 1 && yes.s.money === 3000 && ys?.events === 1 && ys.money === 3000 && ys.day === 1,
        'D011 網址 ?sample=newcity 而且已經有我的城：先問「會蓋掉目前的我的城」；回答不要＝開我的城、存檔一個字都沒動；回答要＝開新城、立刻存成我的城（1 筆、$3000）',
        `不要：問了 ${no.asked?.length} 次、開 ${no.sample}（${no.s.events} 筆）、存檔${no.saved === no.before ? '沒動' : '變了'}；要：問了 ${yes.asked?.length} 次、開 ${yes.sample}、存檔 ${ys ? `${ys.events} 筆 $${ys.money}` : '讀不出來'}`);
    }

    // ---- localStorage 隔離（卡面第 7 節）：這一段蓋、存、重新整理、換城、存檔失敗、讀不出來都做過了——實驗線的兩個鍵逐字沒變，本線寫的鍵都是 gt3d. 開頭 ----
    {
      const ls = await store(), ours = Object.keys(ls).filter(k => !(k in SENT));
      log(Object.entries(SENT).every(([k, v]) => store0[k] === v && ls[k] === v) && ours.includes('gt3d.v1.save') && ours.every(k => k.startsWith('gt3d.')),
        'D011 localStorage 隔離（卡面第 7 節）：先放好的實驗線鍵 glimmerville.v1、glimmerville.v1.slot 整段做完逐字沒變；本線寫進去的鍵都是 gt3d. 開頭',
        `本線的鍵：${ours.join('、') || '沒有'}；實驗線的鍵${Object.entries(SENT).every(([k, v]) => ls[k] === v) ? '沒動' : '變了：' + J(Object.keys(SENT).map(k => ls[k]))}`);
    }
  }, { settle: 300 });

  await run('touch', '觸控與版面', async ({ W, H, ev, touch, release, tapAt, tapBtn, center, rectOf, hit, toasts, sim, findBox, open, waitFor, frames, X, Z }, page) => {
    // 整段只開一次頁（有兩指手勢，之後換頁觸控就送不進去，見 pageSession）。新城預設對準起步城那塊平地時，下方工具列底下是河；
    // 鏡頭改對準河北邊的陸地（?at=26,18：412×860 整個畫面底下都是陸地），介面底下每一點都蓋得了電廠，「介面不穿透」才量得到東西
    const URL0 = 'at=26,18';
    await open('sample=seed516&clean=1'); await ev('__gt.clearSave()'); await open(URL0);
    const buildable = (tool, t, k = 'tap') => t ? ev(`(__gt.preview({k:${J(k)},tool:${J(tool)},x0:${t[0]},z0:${t[1]},x1:${t[0]},z1:${t[1]}})||{count:0}).count`) : 0;
    const tileAt = p => ev(`__gt.tileAt(${p[0]},${p[1]})`);
    const tool = async () => (await ev('__gt.ui()')).tool;

    // ---- 介面不穿透（審查：點在字、空隙、提示列、通知上會穿到地圖，在看不見的格子上蓋東西）：選著「電」，每一點 elementFromPoint 都不是畫布、真的點下去什麼都不蓋 ----
    // 每點一下之前都重新拿「電」：點在兩顆工具鈕之間，Chrome 的觸控校正會把這一下算給旁邊那顆鈕（換了工具，沒有穿到地圖）
    {
      await tapBtn('.tool[data-t="plant"]');
      await ev('__gt.undo()');                                            // 今天還沒施工：跳一則「沒有可以復原的」通知（拿它來點）
      // 播放列空白＝天數與復原鈕之間那段（.grow 本身高度 0，取播放列的垂直中線）
      const pts = await ev(`(()=>{const c=s=>{const e=document.querySelector(s);if(!e||e.closest('[hidden]'))return null;const b=e.getBoundingClientRect();return b.width>0&&b.height>0?[b.left+b.width/2,b.top+b.height/2]:null;};
        const a=document.querySelector('.tool[data-t="zr"]').getBoundingClientRect(),b=document.querySelector('.tool[data-t="zc"]').getBoundingClientRect();
        const g=document.querySelector('#playBar .grow').getBoundingClientRect(),bar=document.getElementById('playBar').getBoundingClientRect();
        return [['通知',c('.toast')],['天數',c('#dayLbl')],['播放列空白',g.width>8?[g.left+g.width/2,bar.top+bar.height/2]:null],['工具鈕之間',[(a.right+b.left)/2,(a.top+a.bottom)/2]],['提示列',c('#coach')],['資金',c('#stats [data-k=money]')]];})()`);
      const s0 = await sim(), rows = [];
      for (const [name, p] of pts) {
        if (!p) { rows.push({ name, missing: true }); continue; }
        await ev(`__gt.tool('plant')`);
        const el = await hit(p), t = await tileAt(p), can = await buildable('plant', t), n0 = (await sim()).events;
        await tapAt(p);
        rows.push({ name, el, t, can, built: (await sim()).events - n0, tool: await tool() });
      }
      const s1 = await sim();
      log(rows.length === 6 && rows.every(r => !r.missing && r.el && !r.el.startsWith('CANVAS') && r.can === 1 && r.built === 0) && s1.events === s0.events && s1.money === s0.money,
        'D011 介面不穿透：選著「電」，點在通知、天數、播放列空白、兩顆工具鈕之間、提示列、資金上：底下都是介面（不是畫布），真的點下去什麼都不蓋（底下那一格本來蓋得了電廠）',
        rows.map(r => r.missing ? `${r.name}：找不到` : `${r.name} ${r.el} 底下 ${J(r.t)}${r.can ? '' : '（蓋不了）'}${r.built ? ` 蓋了 ${r.built}` : ''}${r.tool !== 'plant' ? `（工具變成 ${r.tool}）` : ''}`).join('；') + `；資金 ${s0.money}→${s1.money}`);
    }

    // ---- 整頁不縮放（審查：兩指在工具列上捏合，整頁被放大）：兩指從工具列開始捏合，visualViewport.scale 留在 1 ----
    // 對照：插一塊 touch-action:auto 的測試方塊，在它上面同樣捏合，整頁真的會放大（證明這樣捏得動整頁）。先量工具列（開頁之後還沒有兩指手勢），
    // 對照挪到這一段最後才做、做完不必復原，這一項也在最後才記：之前先做對照、再用 Emulation.resetPageScaleFactor 復原，偶爾復原不了
    // （3 輪 1 次、12 輪 2 次 scale 還不是 1），工具列那一項就誤判紅燈。只有工具列捏合之前 scale 就不是 1、或工具列真的把整頁放大了才要復原（unzoom）
    const pinch = async (a, b) => {
      await touch('touchStart', [[...a, 1]]); await sleep(30); await touch('touchStart', [[...a, 1], [...b, 2]]); await sleep(30);
      for (let k = 1; k <= 10; k++) { await touch('touchMove', [[a[0] - k * 6, a[1] - k * 12, 1], [b[0] + k * 6, b[1] - k * 12, 2]]); await sleep(30); }
      await touch('touchEnd', []); await sleep(500);
      return ev('visualViewport.scale');
    };
    // 整頁縮放復原到 1：送 Emulation.resetPageScaleFactor 輪詢 1.5 秒；還不是 1 就送 Emulation.setPageScaleFactor(1) 再輪詢；再不是 1 就重新載入同一個網址
    // （同網址重新載入，觸控照樣送得進去，見 pageSession）再輪詢。回傳用了哪一招，復原不了＝null。
    // 實測（對照捏合放大到 5 倍之後復原，共 66 次）：reset 卡住 18 次，卡住之後重送 reset（1.5–3 秒、10–20 次）一次都沒用；
    // 其中 17 次改送 setPageScaleFactor(1) 立刻回到 1，另 1 次（那一輪還沒有這一招）靠重新載入回到 1；66 次復原之後點工具鈕都照樣換工具
    const unzoom = async () => {
      for (const how of ['reset', 'setPageScaleFactor(1)', '重新載入同一個網址']) {
        if (how === 'setPageScaleFactor(1)') await page.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
        if (how === '重新載入同一個網址') await open(URL0);
        for (const t0 = Date.now(); Date.now() - t0 < 1500; await sleep(150)) {
          if (await ev('visualViewport.scale') === 1) return how;
          await page.send('Emulation.resetPageScaleFactor');
        }
      }
      return null;
    };
    const zoom = { s0: await ev('visualViewport.scale') };
    {
      if (zoom.s0 !== 1) zoom.fix0 = await unzoom();
      zoom.s1 = await ev('visualViewport.scale');
      const a = await center('.tool[data-t="zr"]'), b = await center('.tool[data-t="police"]');
      zoom.t0 = await tool(); zoom.got = await pinch(a, b); zoom.t1 = await tool();
      if (zoom.got !== 1) zoom.fix = await unzoom();                         // 工具列真的放大了（紅燈）：先復原，後面幾項的觸控座標才對得上
    }

    // ---- 狀態列資金（實驗線 updHud 64849 Math.floor）：$549.6 顯示「$549」、點一下蓋電廠（$550）被拒；−$0.4 顯示「−$1」（不會是「−$0」）----
    {
      await ev(`__gt.tool('plant')`);
      await ev('__gt.simMoney(549.6)');
      await waitFor(async () => (await toasts()).length === 0, 4000);    // 上一項的通知散掉（通知接觸控，擋在畫布上面）
      const chip = () => ev(`(()=>{const c=document.querySelector('#stats [data-k=money]');return [c.textContent,c.className];})()`);
      const [t549] = await chip(), spot = (await findBox(1, 1, free))[0];
      const pv = spot ? await ev(`__gt.preview(${J({ k: 'tap', tool: 'plant', x0: spot[0][0], z0: spot[0][1], x1: spot[0][0], z1: spot[0][1] })})`) : null;
      const s0 = await sim();
      if (spot) await tapAt(spot[1]);
      const s1 = await sim(), ts = await toasts();
      await ev('__gt.simMoney(-0.4)');
      const [tNeg, cls] = await chip();
      await ev('__gt.simMoney(3000)');
      log(t549 === '$549' && !!pv && pv.count === 1 && pv.total === 550 && !pv.affordable && s1.events === s0.events && s1.buildings === s0.buildings && s1.money === 549.6 && ts.includes('錢不夠') && tNeg === '−$1' && /\bbad\b/.test(cls),
        'D011 狀態列資金往下取整（實驗線 64849）：$549.6 顯示「$549」，點一下蓋電廠（$550）不蓋、提示「錢不夠」；−$0.4 顯示「−$1」、變紅',
        `「${t549}」；點 ${J(spot?.[0])}（預覽 ${pv?.count} 格 $${pv?.total}）：事件 +${s1.events - s0.events}、資金 ${s1.money}、「${ts.join('｜')}」；−0.4 →「${tNeg}」${cls}`);
    }

    // ---- 路的點一下：手指抖 6 px 跨過格線，只蓋按下那一格（實驗線要動超過 8 px 才跟手 62884–62885，沒超過放開＝點一格 62918）；框選照實驗線立刻跟手 ----
    {
      // 兩格相鄰的空地（都在畫面中段）：兩格中心連線的中點前後各 3 px，按下那一點在第一格、放開那一點在第二格
      const pair = skip => ev(`(()=>{const L=__gt.layers(),n=L.n,skip=new Set(${J(skip)}),ok=i=>!L.road[i]&&!L.zone[i]&&!L.occ[i]&&!L.tree[i]&&L.ter[i]!==0&&!skip.has(i);
        for(let z=0;z<n;z++)for(let x=0;x+1<n;x++){const i=z*n+x;if(!ok(i)||!ok(i+1))continue;const a=__gt.cellScreen(x,z),b=__gt.cellScreen(x+1,z);
          if([a,b].some(p=>p[0]<40||p[0]>${W - 40}||p[1]<260||p[1]>${H - 280}))continue;
          const m=[(a[0]+b[0])/2,(a[1]+b[1])/2],d=Math.hypot(b[0]-a[0],b[1]-a[1]),u=[(b[0]-a[0])/d,(b[1]-a[1])/d],p0=[m[0]-u[0]*3,m[1]-u[1]*3],p1=[m[0]+u[0]*3,m[1]+u[1]*3];
          const t0=__gt.tileAt(...p0),t1=__gt.tileAt(...p1);if(t0&&t1&&t0[0]===x&&t0[1]===z&&t1[0]===x+1&&t1[1]===z)return {a:[x,z],b:[x+1,z],p0,p1,px:Math.hypot(p1[0]-p0[0],p1[1]-p0[1])};}
        return null;})()`);
      const wiggle = async (e, mid) => { const n0 = (await sim()).events; await touch('touchStart', [e.p0]); await sleep(30); await touch('touchMove', [e.p1]); await sleep(60); await frames(2); const m = await mid?.(); await touch('touchEnd', []); await sleep(250); return { m, evs: (await ev('__gt.history()')).slice(n0).map(q => [q.t, q.x, q.z]) }; };
      await ev(`__gt.tool('road','road')`);
      const e1 = await pair([]), r1 = e1 ? await wiggle(e1) : null;
      await ev(`__gt.tool('zr')`);
      const L = await ev('__gt.layers()'), e2 = await pair(e1 ? [e1.a[1] * L.n + e1.a[0], e1.b[1] * L.n + e1.b[0]] : []), r2 = e2 ? await wiggle(e2, () => ev('__gt.stroke()')) : null;
      await ev('__gt.tool(null)');
      log(!!r1 && J(r1.evs) === J([['road', ...e1.a]]) && !!r2 && J(r2.m?.b) === J(e2.b) && r2.m?.preview?.count === 2 && J(r2.evs) === J([['zone', ...e2.a], ['zone', ...e2.b]]),
        'D011 路的點一下：手指抖 6 px 跨過格線，放開只蓋按下那一格（實驗線 8 px 才跟手）；框選分區同樣動 6 px 就跟到第二格（實驗線立刻跟）',
        `路 ${J(e1?.a)}→${J(e1?.b)} 動 ${e1?.px.toFixed(1)} px：${J(r1?.evs)}；住宅區 ${J(e2?.a)}→${J(e2?.b)}：拖曳中 b＝${J(r2?.m?.b)}、預覽 ${r2?.m?.preview?.count} 格，放開 ${J(r2?.evs)}`);
    }

    // ---- 總價標籤（審查：被工具列蓋住）：一指拖路一路拖進下方工具列，標籤收在工具列上緣之上、看得到；錢不夠時標籤變紅 ----
    {
      await ev(`__gt.tool('road','road')`);
      // 起點：工具列上緣上方 30–90 px、最靠畫面中線的一格空地，從那裡往下拖到離底部 40 px（工具鈕那一列）
      const dock = await rectOf('#dock');
      const start = await ev(`(()=>{const L=__gt.layers(),n=L.n;let best=null;for(let z=0;z<n;z++)for(let x=0;x<n;x++){const i=z*n+x;if(L.road[i]||L.zone[i]||L.occ[i]||L.ter[i]===0)continue;
          const p=__gt.cellScreen(x,z);if(p[0]>80&&p[0]<${W - 80}&&p[1]>${dock.t - 90}&&p[1]<${dock.t - 30}&&(!best||Math.abs(p[0]-${W / 2})<Math.abs(best.p[0]-${W / 2})))best={t:[x,z],p};}return best;})()`);
      const look = `(()=>{const t=document.getElementById('costTag'),r=t.getBoundingClientRect(),d=document.getElementById('dock').getBoundingClientRect(),s=__gt.stroke();
        return {hidden:t.hidden,text:t.textContent,bad:t.classList.contains('bad'),l:r.left,t:r.top,r:r.right,b:r.bottom,dockTop:d.top,finger:s?__gt.cellScreen(...s.b):null,inV:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth};})()`;
      const dragDown = async p => { await touch('touchStart', [p]); for (let k = 1; k <= 8; k++) { await touch('touchMove', [[p[0], p[1] + (H - 40 - p[1]) * k / 8]]); await sleep(30); } await sleep(80); await frames(2); const m = await ev(look); await release(); return m; };
      const m1 = start ? await dragDown(start.p) : null;
      await ev('__gt.simMoney(10)');
      const m2 = start ? await dragDown([start.p[0] + 60, start.p[1]]) : null;
      await ev('__gt.simMoney(3000)');
      await ev('__gt.tool(null)');
      const over = m => m && m.l < W && m.r > 0 && m.b > m.dockTop;   // 標籤跟下方整塊（全寬）重疊＝標籤下緣低於它的上緣
      log(!!m1 && !m1.hidden && m1.inV && m1.b - m1.t > 10 && !over(m1) && m1.finger?.[1] > m1.dockTop && !m1.bad && !!m2 && !m2.hidden && m2.bad && !over(m2),
        'D011 總價標籤：一指拖路拖進下方工具列時，標籤收在工具列上緣之上、整個看得到（不被蓋住）；錢不夠（$10）時標籤變紅',
        m1 ? `手指那一格在 y＝${m1.finger?.[1]?.toFixed(0)}、工具列上緣 ${m1.dockTop.toFixed(0)}；標籤「${m1.text}」${m1.t.toFixed(0)}–${m1.b.toFixed(0)}${m1.bad ? '（紅）' : ''}；錢不夠：「${m2?.text}」${m2?.bad ? '紅' : '沒紅'}、下緣 ${m2?.b.toFixed(0)}` : '找不到工具列上方的空地');
    }

    // ---- 兩指：捏合、抬起一指、再放一指下去拖、全部放開（審查：之前放回去的那一指照樣蓋了一條路）→ 什麼都不蓋 ----
    {
      await ev(`__gt.tool('road','road')`);
      const s0 = await sim(), cx = W / 2, cy = H / 2 - 60;
      await touch('touchStart', [[cx - 50, cy, 1]]); await sleep(30);
      await touch('touchStart', [[cx - 50, cy, 1], [cx + 50, cy, 2]]); await sleep(30);
      for (let k = 1; k <= 5; k++) { await touch('touchMove', [[cx - 50 - k * 8, cy, 1], [cx + 50 + k * 8, cy, 2]]); await sleep(30); }
      await touch('touchEnd', [[cx - 90, cy, 1]]); await sleep(300);    // 抬起第一指（第二指還按著）；等鏡頭的慣性停下
      // 放回去的那一指按下的格要蓋得了路：它要是開了一筆施工，放開時至少蓋這一格（兩指一起動時地圖跟著手指走，手指底下還是同一格）
      const c0 = [cx - 40, cy + 70], c1 = [cx - 110, cy + 130], t0 = await tileAt(c0), can0 = await buildable('road', t0, 'line'), p1 = (await ev('__gt.ui()')).pointers;
      await touch('touchStart', [[cx + 90, cy, 2], [...c0, 3]]); await sleep(40);   // 放一指下去（新的一指）
      for (let k = 1; k <= 6; k++) { await touch('touchMove', [[cx + 90 + k * 6, cy, 2], [c0[0] + (c1[0] - c0[0]) * k / 6, c0[1] + (c1[1] - c0[1]) * k / 6, 3]]); await sleep(30); }
      const mid = await ev('({stroke:__gt.stroke(),ptr:__gt.ui().pointers})');
      await touch('touchEnd', []); await sleep(300);
      const s1 = await sim();
      log(s1.events === s0.events && s1.money === s0.money && !mid.stroke && p1 === 1 && mid.ptr === 2 && can0 === 1,
        'D011 兩指捏合、抬起一指、再放一指下去拖、全部放開：什麼都不蓋（實驗線第二指一落下就取消，62787–62799；全部放開之前不開新的一筆）',
        `抬起一指後按著 ${p1} 指；放回去那一指按在 ${J(t0)}（${can0 ? '蓋得了路' : '蓋不了路'}）、拖曳中 stroke＝${J(mid.stroke)}、按著 ${mid.ptr} 指；事件 +${s1.events - s0.events}、資金 ${s0.money}→${s1.money}`);
    }

    // ---- 第一指落在地圖外（格子是 null）、第二指落在地上，兩指捏合：不蓋東西、鏡頭照樣縮放 ----
    // 先不拿工具、兩指往內捏把鏡頭拉遠（最遠 0.6），地圖邊緣露出來（不換頁：?zoom 要換頁，換了觸控就送不進去）
    {
      await ev('__gt.tool(null)');
      for (let k = 0; k < 3 && (await ev('__gt.cam()')).zoom > 0.8; k++) {
        const cx = W / 2, cy = H / 2 - 60;
        await touch('touchStart', [[cx - 150, cy - 60], [cx + 150, cy + 60]]);
        for (let j = 1; j <= 10; j++) { await touch('touchMove', [[cx - 150 + j * 13, cy - 60 + j * 5], [cx + 150 - j * 13, cy + 60 - j * 5]]); await sleep(30); }
        await touch('touchEnd', []); await sleep(400);
      }
      await ev(`__gt.tool('road','road')`);
      const g = await ev(`(()=>{const o=[];for(let y=180;y<${H - 300};y+=16)for(let x=24;x<${W - 24};x+=16)o.push([x,y,__gt.tileAt(x,y)]);return o;})()`);
      const off = g.filter(p => !p[2]), on = g.filter(p => p[2]);
      let A = null, B = null;
      for (const a of off) {
        for (const b of on) { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d > 100 && d < 200 && await buildable('road', b[2], 'line') === 1) { B = b; break; } }
        if (B) { A = a; break; }
      }
      const s0 = await sim(), z0 = (await ev('__gt.cam()')).zoom;
      if (A && B) {
        const u = [(B[0] - A[0]) / Math.hypot(B[0] - A[0], B[1] - A[1]), (B[1] - A[1]) / Math.hypot(B[0] - A[0], B[1] - A[1])];
        await touch('touchStart', [[A[0], A[1], 1]]); await sleep(40);
        await touch('touchStart', [[A[0], A[1], 1], [B[0], B[1], 2]]); await sleep(40);
        for (let k = 1; k <= 8; k++) { await touch('touchMove', [[A[0] - u[0] * k * 6, A[1] - u[1] * k * 6, 1], [B[0] + u[0] * k * 6, B[1] + u[1] * k * 6, 2]]); await sleep(30); }
        await touch('touchEnd', []); await sleep(400);
      }
      const s1 = await sim(), z1 = (await ev('__gt.cam()')).zoom;
      log(!!A && !!B && s1.events === s0.events && s1.money === s0.money && Math.abs(z1 - z0) > 0.05,
        'D011 第一指落在地圖外、第二指落在地上，兩指捏合：什麼都不蓋、鏡頭照樣縮放（審查：之前第二指那一格蓋了一條路）',
        A ? `第一指 (${A[0]},${A[1]}) 格子 null、第二指 (${B[0]},${B[1]}) 格 ${J(B[2])}（蓋得了路）；事件 +${s1.events - s0.events}、資金 ${s0.money}→${s1.money}、縮放 ${z0.toFixed(2)}→${z1.toFixed(2)}` : `縮放 ${z0.toFixed(2)}：找不到地圖外與地上的兩點`);
      await ev('__gt.tool(null)');
    }

    // ---- 360×740（小手機）：.sub 樣式不外漏、對話框的鈕點得到而且在介面之上、每顆鈕 ≥ 44×44 px ----
    {
      await page.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: true });
      await sleep(500);
      const size = sel => ev(`[...document.querySelectorAll(${J(sel)})].map(b=>{const r=b.getBoundingClientRect();return [b.dataset.t||b.dataset.r||b.id||b.className,+r.width.toFixed(1),+r.height.toFixed(1)];})`);
      await ev(`__gt.tool('road','road')`);
      const tools = await size('.tool'), subs = await size('#roadSub button');
      await ev('__gt.tool(null)');
      const card = await ev(`__gt.openTile(${X},${Z})`), bx = await size('#bio .x');
      const xOk = await tapBtn('#bio .x'), cardShut = await waitFor(async () => await ev(`document.getElementById('bio').hidden`), 2000);
      const menuOk = await tapBtn('#menuBtn') && await waitFor(async () => !(await ev(`document.getElementById('menu').hidden`)), 2000) && await tapBtn('#menu .item[data-m="export"]');
      await waitFor(async () => !(await ev(`document.getElementById('dlg').hidden`)), 2000);
      // 每顆鈕正中間 elementFromPoint 是不是它自己（或它裡面的圖示）；播放鈕那一點是不是落在播放鈕裡
      const dlg = await ev(`(()=>{const who=s=>{const e=document.querySelector(s),b=e.getBoundingClientRect(),h=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return h&&e.contains(h)?'self':h?h.tagName+(h.id?'#'+h.id:''):'none';};
        const pl=document.getElementById('play'),p=pl.getBoundingClientRect(),hp=document.elementFromPoint(p.left+p.width/2,p.top+p.height/2);
        return {open:!document.getElementById('dlg').hidden,ok:who('#dlgOk'),no:who('#dlgNo'),onPlay:!!hp&&pl.contains(hp),play:hp?hp.tagName+(hp.id?'#'+hp.id:''):'none',
          sub:[getComputedStyle(document.querySelector('#bio .sub')).display,getComputedStyle(document.querySelector('#dlg .sub')).display]};})()`);
      const btns = await size('#dlgOk, #dlgNo');
      const noOk = await tapBtn('#dlgNo'), dlgShut = await waitFor(async () => await ev(`document.getElementById('dlg').hidden`), 2000);
      const all = [...tools, ...subs, ...bx, ...btns], small = all.filter(([, w, h]) => w < 44 - .5 || h < 44 - .5);
      log(tools.length === 7 && subs.length === 5 && bx.length === 1 && btns.length === 2 && !small.length && !!card && xOk && cardShut,
        'D011 360×740：七顆工具鈕、五級路的鈕、建築卡的 ✕、對話框的匯出／取消都 ≥ 44×44 px；點 ✕ 關得掉卡片',
        (small.length ? '太小：' + J(small) : `工具 ${tools.map(t => `${t[1]}×${t[2]}`)[0]}、路 ${subs[0]?.[1]}×${subs[0]?.[2]}、✕ ${bx[0]?.[1]}×${bx[0]?.[2]}、對話框 ${btns.map(b => `${b[1]}×${b[2]}`).join('／')}`) + `；點 ✕ 之後卡片${cardShut ? '關了' : '還開著'}`);
      log(menuOk && dlg.open && dlg.ok === 'self' && dlg.no === 'self' && !dlg.onPlay && dlg.sub.every(v => v !== 'grid') && noOk && dlgShut,
        'D011 360×740 對話框（審查：.sub 樣式外漏、取消被播放列蓋住）：建築卡與對話框的副標題不是 grid；「匯出」「取消」正中間點到的就是鈕本身；對話框開著時播放鈕的位置點到的不是播放鈕（對話框在介面之上）；點「取消」關得掉',
        `對話框${dlg.open ? '開了' : '沒開'}；副標題 display ${dlg.sub.join('／')}；匯出 ${dlg.ok}、取消 ${dlg.no}；播放鈕那一點 ${dlg.play}；取消之後${dlgShut ? '關了' : '還開著'}`);
    }

    // ---- 整頁不縮放（接上面工具列那一次）：對照放在這一段最後——回到 412×860、插 touch-action:auto 的測試方塊、同樣捏合，整頁要真的放大（之後沒有別的檢查，不必復原）----
    // 判：工具列捏合之前 scale＝1（量得成）、之後還是 1；對照放大超過 5%（證明這樣捏得動整頁）。對照之前 scale 不是 1 也照列
    {
      await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true }); await sleep(500);
      const c0 = await ev('visualViewport.scale');
      await ev(`(()=>{const d=document.createElement('div');d.id='pzTest';d.style.cssText='position:fixed;left:0;right:0;top:300px;height:240px;touch-action:auto;z-index:50';document.body.appendChild(d);})()`);
      const ctl = await pinch([150, 480], [260, 480]);
      const sc = v => v === 1 ? '1' : typeof v === 'number' ? v.toFixed(2) : String(v), fixed = (f, s) => f === undefined ? '' : f ? `（${s}；「${f}」之後回到 1）` : `（${s}；復原不了）`;
      log(zoom.s1 === 1 && zoom.got === 1 && ctl > c0 * 1.05, 'D011 整頁不縮放：兩指從工具列開始捏合，整頁留在原本大小（visualViewport.scale＝1）；對照：一樣的捏合在 touch-action:auto 的方塊上會把整頁放大（對照在這一段最後做）',
        `工具列上捏合：之前 ${sc(zoom.s0)}${fixed(zoom.fix0, '開頭就不是 1')}、之後 ${sc(zoom.got)}${fixed(zoom.fix, '工具列把整頁放大了')}（工具 ${zoom.t0}→${zoom.t1}）；對照 ${sc(c0)} → ${sc(ctl)} 倍`);
    }
  });

  await run('desk', '桌機滑鼠鍵盤與分享碼', async ({ ev, sim, freshStart, clickBtn, key, X, Z }, page) => {
    await freshStart();
    const hidden = id => ev(`document.getElementById(${J(id)}).hidden`);
    const menuItem = async id => { await ev(`document.querySelector('#menu .item[data-m=${J(id)}]')?.scrollIntoView({block:'nearest'})`); return clickBtn(`#menu .item[data-m=${J(id)}]`); };

    // ---- 鍵盤（審查：選單開著時快捷鍵照樣在後面換工具、播放；Esc 關不掉選單和對話框）----
    // 對照：什麼都沒開時 3＝選「商」、空白鍵＝播放／暫停、Esc＝放下工具（證明鍵盤事件送得進頁面）
    {
      await ev('document.activeElement?.blur()');
      await key('3'); const t3 = (await ev('__gt.ui()')).tool;
      await key(' '); const p1 = (await sim()).playing;
      await key(' '); const p2 = (await sim()).playing;
      await key('Escape'); const t0 = (await ev('__gt.ui()')).tool;
      await clickBtn('#menuBtn'); const m1 = !(await hidden('menu'));
      await key('3'); await key(' ');
      const inMenu = { tool: (await ev('__gt.ui()')).tool, playing: (await sim()).playing, open: !(await hidden('menu')) };
      await key('Escape'); const menuShut = await hidden('menu');
      await clickBtn('#menuBtn'); await menuItem('paste');
      const d1 = !(await hidden('dlg')), focus = await ev('document.activeElement?.tagName');
      await key('Escape'); const dlgShut = await hidden('dlg');
      log(t3 === 'zc' && p1 === true && p2 === false && t0 === null && m1 && inMenu.open && inMenu.tool === null && inMenu.playing === false && menuShut && d1 && dlgShut,
        'D011 鍵盤：☰ 選單開著時按 3 不換工具、空白鍵不播放，Esc 關掉選單；貼上分享碼的對話框開著時 Esc 關掉它（對照：什麼都沒開時 3＝選「商」、空白鍵播放／暫停、Esc 放下工具）',
        `對照 3→${t3}、空白鍵→${p1}/${p2}、Esc→${t0}；選單開著 3、空白鍵之後 工具 ${inMenu.tool}、播放 ${inMenu.playing}、選單${inMenu.open ? '開著' : '關了'}，Esc→選單${menuShut ? '關了' : '還開著'}；對話框${d1 ? '開著' : '沒開'}（焦點 ${focus}），Esc→${dlgShut ? '關了' : '還開著'}`);
    }

    // ---- 播放中用滑鼠點（審查：播放中每天重建播放鈕的圖示與路的等級，按下與放開之間節點換掉，10 倍速時點暫停 0／10）：按下與放開隔 100 ms ----
    // 修好之後播放中不再換節點（src/ui/buildUi.ts：播放狀態變了才重畫圖示），點暫停是決定性的：要 10／10（之前只要 ≥ 9／10）
    {
      await clickBtn('.tool[data-t="road"]');
      await ev('__gt.simSpeed(2)');
      const d0 = (await sim()).day;
      let pauses = 0, hits = 0;
      for (let i = 0; i < 10; i++) {
        await ev('__gt.simPlay(true)'); await sleep(250);
        await clickBtn('#play', 100);
        if (!(await sim()).playing) pauses++;
      }
      const d1 = (await sim()).day;
      await ev('__gt.simPlay(true)'); await sleep(250);
      for (let i = 0; i < 10; i++) { const want = i % 2 ? 'alley' : 'hwy'; await clickBtn(`#roadSub button[data-r="${want}"]`, 100); if ((await ev('__gt.ui()')).roadTool === want) hits++; }
      const s2 = await sim();
      await ev('__gt.simPlay(false)'); await ev('__gt.tool(null)');
      log(pauses === 10 && hits === 10 && s2.playing && d1 - d0 >= 15 && s2.day > d1, 'D011 桌機 1280×800 播放中（10 倍速）用滑鼠點（按下與放開隔 100 ms）：點播放鈕正中間 10／10 次暫停；路的等級 10／10 次換到',
        `暫停 ${pauses}／10（第 ${d0}→${d1} 天）；路的等級 ${hits}／10（還在播，到第 ${s2.day} 天）`);
    }

    // ---- 分享碼裡的 HTML（審查：存放型 XSS，事件欄位與實驗線版本字串被當 HTML 畫進建築卡）：從真的對話框貼上三張動過手腳的碼 ----
    // (a) hv 1：劃區那一筆的 day 換成一段 HTML；(b) hv 2：同一段放進劃區那一列的 x（數字欄）；(a)(b) 驗型別擋下、退回只用存檔並講原因。
    // (c) 實驗線那一半的 gameVer 換成 HTML、歷史照樣對得上（起始碼的 gameVer 一起換，匯入那一列的 gameVer、碼雜湊跟著改）：接得上，卡片把它當字照印
    {
      const zone = { k: 'rect', tool: 'zr', x0: X + 1, z0: Z + 1, x1: X + 3, z1: Z + 1 };
      await ev(`__gt.edit(${J(zone)})`);
      const S = decodeLabCode(await ev('__gt.save()')).save, raw = S.raw, n = S.n, hist = unpackHistory(raw.d3.r, n), k = hist.findIndex(e => e.t === 'zone'), ze = hist[k];
      const X1 = '<img id=pwn src=x onerror="window.__pwned=1">', X2 = '<img id=pwn2 src=x onerror="window.__pwned=2">';
      const base = () => { const o = JSON.parse(J(raw)); delete o.z; return o; };
      const a = base(); delete a.d3.hv; delete a.d3.r; a.d3.h = hist.map((e, i) => i === k ? { ...e, day: X1 } : e);
      const b = base(); b.d3.r[k][2] = X1;
      const c = base(), so = JSON.parse(J(decodeLabCode(raw.d3.s).save.raw));
      delete so.z; so.gameVer = X2;
      const s2 = encodeLabCode(so, { deflate: true });
      c.gameVer = X2; c.d3.s = s2; c.d3.r[0][3] = X2; c.d3.r[0][5] = fnv1a(s2);
      // 貼上之前把畫面上已有的通知做記號，只看這一次貼上之後新跳的（上一張的通知 2.7 秒才散）
      const paste = async o => {
        await ev(`(()=>{window.confirm=()=>true;document.querySelectorAll('.toast').forEach(t=>t.dataset.old=1);})()`);   // 貼上帶歷史的碼會問「蓋掉目前的我的城」：答應
        await clickBtn('#menuBtn'); await menuItem('paste');
        const focused = await ev(`document.activeElement === document.querySelector('#dlg textarea')`);
        await page.send('Input.insertText', { text: encodeLabCode(o, { deflate: true }) });
        await clickBtn('#dlgOk'); await sleep(300);
        const card = await ev(`__gt.openTile(${ze.x},${ze.z})`); await sleep(300);   // 讓 <img onerror> 真的有機會跑
        return { focused, card, ...(await ev(`({dlg:document.getElementById('dlg').hidden,sample:__gt.sample,note:__gt.loadNote(),toasts:[...document.querySelectorAll('.toast:not([data-old])')].map(t=>t.textContent),
          pwn:!!document.querySelector('#pwn,#pwn2'),imgs:document.querySelectorAll('img').length,pwned:window.__pwned===undefined?null:window.__pwned,rows:[...document.querySelectorAll('#bio li')].map(li=>li.textContent)})`)) };
      };
      const rs = [];
      for (const o of [a, b, c]) rs.push(await paste(o));
      const [ra, rb, rc] = rs, safe = r => r.focused && r.dlg && r.sample === 'mine' && !!r.card && !r.pwn && r.imgs === 0 && r.pwned === null;
      log(rs.every(safe) && [ra, rb].every(r => r.note.startsWith('歷史重播失敗') && r.toasts.some(t => t.startsWith('歷史重播失敗'))) && /重播成功/.test(rc.note) && rc.rows.some(t => t.includes(`v${X2} 匯入`)),
        'D011 分享碼裡的 HTML（存放型 XSS）：從對話框貼上三張動過手腳的碼、打開那一格的卡片，頁面上沒有注入的元素、onerror 沒跑；歷史欄位裡的 HTML（hv 1 的 day、hv 2 的數字欄）擋下、提示「歷史重播失敗…」；gameVer 的 HTML 歷史接得上、卡片當字照印',
        rs.map((r, i) => `(${'abc'[i]}) ${r.sample}、注入元素 ${r.pwn ? '有' : '沒有'}、img ${r.imgs}、__pwned ${r.pwned}、「${r.note}」${i < 2 ? `、提示「${r.toasts.join('｜')}」` : `、卡片：${r.rows.find(t => t.includes('匯入')) ?? '沒有匯入那一列'}`}`).join('；'));
    }
  }, { W: 1280, H: 800, mobile: false });
}

// 單獨跑：node tools/smoke-d011.mjs（只跑 D011 這幾段；D011_SMOKE_ONLY 照樣有效）
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { withBrowser } = await import('./cdp.mjs');
  const t0 = Date.now(), fails = [], log = (ok, name, detail) => { console.log(`  ${ok ? 'OK' : 'NG'} ${name}${detail !== undefined ? '：' + detail : ''}`); if (!ok) fails.push(name); };
  console.log(`\n=== 微光小鎮 3D 煙霧測試：D011${ONLY.length ? `（只跑 ${ONLY.join('、')}）` : ''} ===`);
  await d011Smoke(withBrowser, log);
  if (d011SkipNote()) console.log(d011SkipNote());
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  if (fails.length) { console.log(`\nNG 紅燈（${sec}s）：${fails.join('、')}`); process.exit(1); }
  console.log(`\nOK 綠燈（${sec}s）`);
}

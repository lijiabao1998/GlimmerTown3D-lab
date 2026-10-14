// 建造介面（D011）：上方狀態列＋☰ 選單、下方播放列與工具列、路的等級、花費標籤、提示、通知。
// 只管畫面元素與樣式，狀態由 src/cityView.ts 餵進來、動作由它處理（介面不碰模擬，規則 2）。
// 介面本線自己設計（業主 2026-09-26：UI 可以更現代）；按下去寫進資料的東西照實驗線（規則 9，見 src/sim/rules/build.ts）。
// 每天都會更新的元素（播放鈕圖示、路的等級、狀態列數字）只改文字與樣式、不重建節點（審查：播放中每天重建，滑鼠按下與放開之間節點換掉，點擊就掉了）。
// 文字一律用 textContent 寫（選單的註記、城市名都可能來自分享碼）。
import { ICONS, type IconName } from './icons.ts';
import { costTagPosition } from './costTag.ts';
import { createPanelUpdateGate } from './panelPress.ts';

// civic＝公共設施一組（D016）：按下去跟「路」一樣跳出一排可選（警察局、派出所、消防局、醫院……），按鈕上的字跟著選到的那一種
export type ToolId = 'road' | 'zr' | 'zc' | 'zi' | 'plant' | 'civic' | 'food' | 'doze';
// 工具顏色：住商工跟地面的分區色一致（src/render/ground.ts GROUND.zone）
export const TOOLS: { id: ToolId; label: string; name: string; color: string }[] = [
  { id: 'road', label: '路', name: '道路', color: '#c9ced8' },
  { id: 'zr', label: '住', name: '住宅區', color: '#9fd28a' },
  { id: 'zc', label: '商', name: '商業區', color: '#8fb4e0' },
  { id: 'zi', label: '工', name: '工業區', color: '#e0c27a' },
  { id: 'plant', label: '電', name: '燃煤電廠', color: '#f5d451' },
  { id: 'civic', label: '警', name: '公共設施', color: '#9cc0ff' },
  { id: 'doze', label: '拆', name: '拆除', color: '#ff8a7a' },
];

// power：[要用電的住商工棟數, 電廠容量]。不用「有電棟數」：實驗線當天新長出來的房子一律帶電（55623），隔天才照容量分配，有電棟數會短暫超過容量
// pop：'—'＝讀檔後還沒過第一天、人口還沒算；unsaved：自動存檔失敗的原因（空字串＝沒事）；
// journal：世界歷史的日誌（IndexedDB）不能用的原因（D013；空字串＝沒事）——這時歷史整份塞在存檔裡，有上限
export interface HudState { name: string; sub: string; money: number | null; sandbox: boolean; day: number | null; pop: number | '—' | null; power: [number, number] | null; unsaved?: string; journal?: string }
export interface DockState {
  mode: 'build' | 'view'; tool: ToolId | null; roadTool: string; roadTools: { id: string; name: string; cost: number }[];
  civicTool: string; civicTools: { id: string; name: string; short: string; cost: number; label?: string; lock?: number }[];   // lock：還沒解鎖要的城市等級（D044）
  prices: Partial<Record<ToolId, number>>; playing: boolean; speed: number; speeds: number[]; canUndo: boolean; sandbox: boolean;
}
export interface MenuItem { id: string; label: string; note?: string; icon?: IconName; on?: boolean }
export interface MenuSection { title: string; items: MenuItem[] }
export interface BuildUiEvents {
  tool(t: ToolId | null): void; roadTool(id: string): void; civicTool(id: string): void; play(): void; speed(k: number): void; undo(): void; menu(id: string): void; startBuild(): void;
  menuOpen(): void;   // 打開選單前（清單內容由呼叫端重填，例如我的城的天數與資金）
}

// 圖層：.gtu 整層不接觸控（地圖在底下），狀態列、下方整塊、通知、選單自己接（審查：之前只有按鈕接，點在字、空隙、提示列上會穿到地圖、在看不見的格子上蓋東西）。
// 這幾塊也不讓瀏覽器拿去縮放整頁（touch-action: none；選單的清單要能上下捲）。
// 疊放：花費標籤在下方整塊之上；建築卡、分享碼對話框在整層之上（對話框是模態的，擋住後面的按鈕）
const CSS = `
.gtu { position: fixed; inset: 0; pointer-events: none; z-index: 5; }
.gtu button { pointer-events: auto; }
#hud, #dock, .toast { pointer-events: auto; touch-action: none; }
#bio { z-index: 6; }
#dlg { z-index: 20; }
#hud { position: absolute; left: 10px; right: 10px; top: calc(10px + env(safe-area-inset-top)); display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
#hud .menuBtn { width: 44px; height: 44px; padding: 0; display: grid; place-items: center; border-radius: 12px; }
#hud .menuBtn svg { width: 22px; height: 22px; }
#hud .name { display: flex; flex-direction: column; min-width: 0; flex: 1 1 150px; text-shadow: 0 1px 3px #000c; }
#hud .name b { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#hud .name small { font-size: 11.5px; color: #d6dbe6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#commissionHud { min-height: 44px; flex: 0 1 100%; max-width: 390px; min-width: 0; padding: 6px 10px; display: flex; flex-direction: column; align-items: stretch; gap: 3px; text-align: left; background: #141a30ed; border-color: #e8b74a66; border-radius: 12px; touch-action: none; }
#commissionHud[hidden] { display: none; }
#commissionHud .summary { display: flex; align-items: center; gap: 8px; justify-content: space-between; }
#commissionHud .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
#commissionHud .progressText { white-space: nowrap; font-size: 11px; color: #ffe7b0; }
#commissionHud .meter { height: 3px; background: #ffffff20; border-radius: 2px; overflow: hidden; }
#commissionHud .meter i { display: block; height: 100%; background: #e8b74a; }
#hud .stats { display: flex; gap: 6px; flex-wrap: wrap; }
.stat { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 10px; border-radius: 999px; background: #141a30e6; border: 1px solid #ffffff26; font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.stat[hidden] { display: none; }
.stat svg { width: 15px; height: 15px; opacity: .9; }
.stat.money { color: #ffd98a; }
.stat.bad { color: #ff9a9a; border-color: #ff8a8a77; }
.stat.warn { color: #ffd98a; border-color: #ffd98a66; }
.stat.saveWarning { min-width: 44px; min-height: 44px; height: auto; white-space: normal; text-align: left; }
.stat.saveWarning:focus-visible, #saveStatus :focus-visible, #dlg :focus-visible { outline: 2px solid #ffe7b0; outline-offset: 3px; }
#saveStatus { position: fixed; inset: 0; z-index: 20; background: #0008; display: flex; align-items: center; justify-content: center; padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)); touch-action: pan-y; }
#saveStatus[hidden] { display: none; }
#saveStatus .card { width: min(460px, 100%); min-width: 0; box-sizing: border-box; max-height: 100%; display: flex; flex-direction: column; background: #141a30f5; border: 1px solid #ffffff26; border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px #0008; overflow-wrap: anywhere; }
#saveStatus h2 { flex: none; margin: 0 0 10px; font-size: 17px; }
#saveStatus .saveBody { min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; }
#saveStatus section { padding: 10px 12px; margin-bottom: 10px; border: 1px solid #ffd98a66; border-radius: 10px; }
#saveStatus #saveStatusUnsaved { border-color: #ff8a8a77; }
#saveStatus h3 { margin: 0 0 6px; color: #ffd98a; font-size: 15px; }
#saveStatusUnsaved h3, #saveStatusError { color: #ff9a9a; }
#saveStatus p { margin: 6px 0; font-size: 14px; line-height: 1.55; }
#saveStatus .reason { font-weight: 600; }
#saveStatus .note { color: #aab3c6; font-size: 12.5px; }
#saveStatus .row { flex: none; margin-top: 14px; }
#saveStatus button { min-width: 72px; min-height: 44px; }
#saveStatusExport { background: #e8b74a; border-color: #e8b74a; color: #1c1a14; font-weight: 700; }
#dlg .card { box-sizing: border-box; max-height: 100%; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; overflow-wrap: anywhere; }
#copyStatus { margin: 10px 0; padding: 10px 12px; border: 1px solid #aab3c644; border-radius: 8px; color: #d5dcec; font-size: 13px; line-height: 1.55; }
#copyStatus[data-phase="success"] { color: #b4e8bc; border-color: #b4e8bc66; }
#copyStatus[data-phase="unsupported"], #copyStatus[data-phase="failed"] { color: #ffd98a; border-color: #ffd98a66; }
#dlgOk[aria-disabled="true"] { opacity: .65; cursor: wait; }
#dlg textarea[aria-invalid="true"] { border-color: #ff9a9a; box-shadow: 0 0 0 1px #ff9a9a66; }
#dock { position: absolute; left: 0; right: 0; bottom: 0; padding: 8px 10px calc(10px + env(safe-area-inset-bottom)); background: linear-gradient(#0d122600, #0d1226ee 30%); display: flex; flex-direction: column; gap: 8px; }
#dock[hidden] { display: none; }
#dock .bar { display: flex; align-items: center; gap: 6px; min-height: 44px; }
.icoBtn { width: 44px; height: 44px; flex: 0 0 auto; padding: 0; display: grid; place-items: center; border-radius: 12px; }
.icoBtn svg { width: 22px; height: 22px; }
.gtu #play { width: 44px; height: 44px; padding: 0; }   /* index.html 的 #play 是 300 年示範的時間軸鈕（40px），這裡要 44 */
.icoBtn:disabled { opacity: .35; }
.seg { display: inline-flex; border: 1px solid #ffffff33; border-radius: 12px; overflow: hidden; pointer-events: auto; }
.seg button { border: 0; border-radius: 0; background: #1c2440e6; padding: 0 12px; height: 44px; min-width: 44px; font-size: 13px; }
.seg button.on { background: #e8b74a; color: #1c1a14; font-weight: 700; }
#dayLbl { font-weight: 700; font-size: 15px; margin-left: 2px; white-space: nowrap; text-shadow: 0 1px 3px #000c; }
#dock .bar .grow { flex: 1; }
.tools { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.tool { height: 58px; padding: 4px 0 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; border-radius: 14px; font-size: 12.5px; background: #1c2440ee; }
.tool svg { width: 24px; height: 24px; color: var(--c); }
.tool .price { font-size: 10px; color: #aab3c6; line-height: 1.1; }
.tool.on { background: #2a3566; border-color: var(--c); box-shadow: inset 0 0 0 2px var(--c); }
#roadSub, #civicSub { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
#civicSub { grid-template-columns: repeat(7, minmax(0, 1fr)); }   /* D020：13 種，兩排（7＋6） */
#roadSub[hidden], #civicSub[hidden] { display: none; }
#roadSub button, #civicSub button { min-height: 44px; padding: 3px 0; font-size: 12.5px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.15; }
#roadSub button small, #civicSub button small { color: #aab3c6; font-size: 10.5px; }
#roadSub button.on small, #civicSub button.on small { color: #3a2e10; }
#civicSub button.locked { opacity: .55; }   /* D044：城市等級還沒到：看得到、點了只提示解鎖等級 */
.coach { align-self: center; max-width: min(560px, 100%); background: #141a30f2; border: 1px solid #e8b74a99; color: #ffe7b0; border-radius: 12px; padding: 7px 12px; font-size: 13px; text-align: center; }
.coach[hidden] { display: none; }
.viewNote { display: flex; align-items: center; gap: 10px; justify-content: center; flex-wrap: wrap; font-size: 13px; color: #d6dbe6; }
.viewNote[hidden] { display: none; }
.viewNote button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; min-height: 44px; border-radius: 12px; background: #e8b74a; color: #1c1a14; border-color: #e8b74a; font-weight: 700; }
.viewNote button svg { width: 18px; height: 18px; }
#costTag { position: absolute; transform: translateX(-50%); box-sizing: border-box; width: max-content; max-width: calc(100vw - 16px); padding: 4px 9px; border-radius: 999px; background: #141a30f2; border: 1px solid #ffffff55; font-weight: 700; font-size: 13px; line-height: 18px; text-align: center; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
#costTag[hidden] { display: none; }
#costTag.bad { color: #ff9a9a; border-color: #ff8a8a99; }
#toasts { position: absolute; top: calc(98px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; align-items: center; width: max-content; max-width: calc(100vw - 24px); }
.toast { background: #141a30f2; border: 1px solid #ffffff33; border-radius: 12px; padding: 7px 14px; font-size: 13px; transition: opacity .45s; text-align: center; }
.toast.good { border-color: #7fd08a99; color: #d6f5da; } .toast.bad { border-color: #ff8a8a99; color: #ffc6c6; } .toast.gold { border-color: #e8b74a; color: #ffe7b0; }
#menu { position: absolute; inset: 0; background: #0009; pointer-events: auto; display: flex; touch-action: none; }
#menu[hidden] { display: none; }
#menu .sheet { margin: auto 0 0 0; width: 100%; max-height: 86vh; overflow: auto; box-sizing: border-box; background: #141a30fa; border-top: 1px solid #ffffff26; border-radius: 18px 18px 0 0; padding: 10px 14px calc(16px + env(safe-area-inset-bottom)); touch-action: pan-y; }
#menu .head { display: flex; align-items: center; justify-content: space-between; }
#menu .head b { font-size: 16px; }
#menu h3 { margin: 12px 0 6px; font-size: 12px; color: #aab3c6; font-weight: 600; }
#menu .list { display: grid; gap: 6px; }
#menu .item { display: flex; align-items: center; gap: 10px; text-align: left; padding: 10px 12px; border-radius: 12px; min-height: 44px; }
#menu .item svg { width: 20px; height: 20px; flex: 0 0 auto; }
#menu .item span { display: flex; flex-direction: column; }
#menu .item small { color: #aab3c6; font-size: 11.5px; }
#menu .item.on { box-shadow: inset 0 0 0 2px #e8b74a; }
#dlg .row button { min-height: 44px; min-width: 72px; }
#bio .x { min-width: 44px; min-height: 44px; right: 4px; top: 4px; padding: 0; }
#bio h2 { margin-right: 48px; }
@media (max-width: 400px) {   /* 360 寬的手機：七個工具鈕也要 ≥ 44 px（(360 − 16 − 24) ÷ 7 ≈ 45.7） */
  #dock { padding-left: 8px; padding-right: 8px; }
  .tools, #civicSub { gap: 4px; }   /* D020：公共設施一排七個，(360 − 16 − 24) ÷ 7 ≈ 45.7 */
}
@media (min-width: 720px) {
  #menu .sheet { margin: 64px auto auto 10px; width: 380px; border-radius: 16px; border: 1px solid #ffffff26; }
  .tools { grid-template-columns: repeat(7, 64px); justify-content: center; }
  #roadSub, #civicSub { grid-template-columns: repeat(5, 76px); justify-content: center; }
  #civicSub { grid-template-columns: repeat(7, 76px); }
  #dock { align-items: stretch; }
}
@media (max-width: 640px) { #bio { bottom: 168px !important; max-height: 40vh !important; } }
`;

export function createBuildUi(on: BuildUiEvents) {
  const root = document.createElement('div');
  root.className = 'gtu';
  root.innerHTML = `
    <div id="hud"><button class="menuBtn" id="menuBtn" aria-label="選單">${ICONS.menu}</button>
      <div class="name"><b id="cityName"></b><small id="citySub"></small></div>
      <div class="stats" id="stats"></div><button id="commissionHud" type="button" hidden><span class="summary"><span class="label"></span><span class="progressText"></span></span><span class="meter"><i></i></span></button></div>
    <div id="toasts"></div>
    <div id="dock">
      <div class="coach" id="coach" hidden></div>
      <div class="viewNote" id="viewNote" hidden><span>這座城只能看。</span><button id="startBuild">${ICONS.build}開一座新城</button></div>
      <div id="roadSub" hidden></div>
      <div id="civicWrap" hidden><div id="civicSub" hidden></div><button id="civicGuide" type="button" aria-haspopup="dialog" aria-controls="catalog" hidden>設施導覽 ↗</button></div>
      <div class="bar" id="playBar"><button class="icoBtn" id="play" aria-label="播放">${ICONS.play}</button><div class="seg" id="spd"></div><span id="dayLbl"></span><span class="grow" id="dayGrow"></span><button id="siteGuide" type="button" aria-haspopup="dialog" aria-controls="sitePanel" hidden><span id="siteToolName">建造現場 ↗</span><span id="siteDay"></span></button>
        <button class="icoBtn" id="undo" aria-label="復原">${ICONS.undo}</button></div>
      <div class="tools" id="tools"></div>
    </div>
    <div id="costTag" hidden></div>
    <div id="menu" hidden><div class="sheet"><div class="head"><b>微光小鎮 3D</b><button class="icoBtn" id="menuX" aria-label="關閉">${ICONS.close}</button></div><div id="menuBody"></div></div></div>`;
  const style = document.createElement('style'); style.textContent = CSS;
  const $ = <T extends HTMLElement>(id: string) => root.querySelector('#' + id) as T;
  const toolsEl = $('tools'), roadSub = $('roadSub'), civicSub = $('civicSub'), spd = $('spd'), stats = $('stats'), menu = $('menu'), menuBody = $('menuBody'), costTag = $('costTag'), toasts = $('toasts'), dock = $('dock');
  const setText = (el: Element, s: string) => { if (el.textContent !== s) el.textContent = s; };
  for (const t of TOOLS) {
    const b = document.createElement('button');
    b.className = 'tool'; b.dataset.t = t.id; b.style.setProperty('--c', t.color); b.setAttribute('aria-label', t.name);
    b.innerHTML = `${ICONS[t.id === 'food' ? 'zi' : t.id]}<span>${t.label}</span><span class="price"></span>`;
    b.onclick = () => on.tool(b.classList.contains('on') ? null : t.id);   // 再按一次＝放下工具（回到看的模式）
    toolsEl.appendChild(b);
  }
  $<HTMLButtonElement>('play').onclick = () => on.play();
  $<HTMLButtonElement>('undo').onclick = () => on.undo();
  $<HTMLButtonElement>('menuBtn').onclick = () => { on.menuOpen(); menu.hidden = false; };
  $<HTMLButtonElement>('menuX').onclick = () => { menu.hidden = true; };
  $<HTMLButtonElement>('civicGuide').onclick = () => on.menu('catalog');
  $<HTMLButtonElement>('siteGuide').onclick = () => on.menu('site');
  const siteGate = createPanelUpdateGate($('siteGuide'));
  $<HTMLButtonElement>('startBuild').onclick = () => on.startBuild();
  $<HTMLButtonElement>('commissionHud').onclick = () => on.menu('commission');
  menu.onclick = e => { if (e.target === menu) menu.hidden = true; };

  // 狀態列的晶片：建一次，之後只改文字、樣式、藏不藏
  const chip = (icon: IconName | null, title: string, warning = false) => {
    const s = document.createElement(warning ? 'button' : 'span'), t = document.createElement('span');
    s.className = 'stat'; s.title = title; s.hidden = true;
    if (warning) { (s as HTMLButtonElement).type = 'button'; s.setAttribute('aria-haspopup', 'dialog'); s.setAttribute('aria-controls', 'saveStatus'); s.onclick = () => on.menu('save-status'); }
    if (icon) s.innerHTML = ICONS[icon];
    s.appendChild(t); stats.appendChild(s);
    return { s, t };
  };
  const chMoney = chip('coin', '資金'), chPop = chip('people', '人口'), chPower = chip('bolt', '要用電的住商工／電廠容量（一座燃煤電廠約供 75 棟）'), chSave = chip(null, '', true), chJ = chip(null, '', true);
  chMoney.s.dataset.k = 'money'; chPop.s.dataset.k = 'pop'; chPower.s.dataset.k = 'power'; chSave.s.dataset.k = 'unsaved'; chJ.s.dataset.k = 'journal';
  // 資金照實驗線 updHud 取整：往下取（64849 Math.floor；審查：之前四捨五入，會顯示一個其實花不起的數），負號跟著取整後的值
  const money = (v: number) => { const m = Math.floor(v); return (m < 0 ? '−$' : '$') + Math.abs(m).toLocaleString(); };
  let playShown: boolean | null = null, roadKey = '', civicKey = '', dockTop = innerHeight, hudBottom = 8, noticesBottom = 8;
  let cost: { x: number; y: number; text: string } | null = null;
  let measuredCost = { text: '', w: 0, h: 0, viewportWidth: 0 };
  const positionCost = () => {
    if (!cost) return;
    const lines = cost.text.split('\n'), widths = lines.map(line => { let width = 20; for (const ch of line) width += ch.charCodeAt(0) > 0x2e7f ? 13 : 8; return width; });
    const estimate = Math.max(...widths);
    const maxWidth = Math.max(1, innerWidth - 16), measured = measuredCost.text === cost.text && measuredCost.viewportWidth === innerWidth;
    const w = measured ? measuredCost.w : Math.min(estimate, maxWidth);
    const h = measured ? measuredCost.h : 12 + 18 * widths.reduce((rows, width) => rows + Math.ceil(width / maxWidth), 0);
    const p = costTagPosition(cost.x, cost.y, w, h, innerWidth, innerHeight, Math.max(hudBottom, noticesBottom) + 8, dockTop - 8);
    costTag.hidden = !p;   // A tiny viewport with no free strip must never cover an interactive control.
    if (p) { costTag.style.left = p.left + 'px'; costTag.style.top = p.top + 'px'; }
  };
  // ResizeObserver caches chrome geometry after layout. Pointer movement only reads
  // these numbers; HUD wrapping, live commission rows and expiring notices also
  // reposition an already-visible tag without waiting for another finger movement.
  const measureChrome = () => {
    hudBottom = $('hud').getBoundingClientRect().bottom;
    toasts.style.top = Math.ceil(hudBottom + 8) + 'px';
    noticesBottom = toasts.childElementCount ? toasts.getBoundingClientRect().bottom : hudBottom;
    dockTop = dock.hidden ? innerHeight : dock.getBoundingClientRect().top;
    positionCost();
  };
  if (typeof ResizeObserver !== 'undefined') {
    const chromeObserver = new ResizeObserver(measureChrome);
    for (const el of [$('hud'), dock, toasts]) chromeObserver.observe(el);
    new ResizeObserver(() => {
      if (!cost || costTag.hidden) return;
      const r = costTag.getBoundingClientRect();
      measuredCost = { text: cost.text, w: r.width, h: r.height, viewportWidth: innerWidth }; positionCost();
    }).observe(costTag);
  }
  addEventListener('resize', () => requestAnimationFrame(measureChrome));
  return {
    root, style,
    setHud(h: HudState) {
      setText($('cityName'), h.name); setText($('citySub'), h.sub);
      chMoney.s.hidden = h.money === null;
      if (h.money !== null) { setText(chMoney.t, h.sandbox ? '沙盒' : money(h.money)); chMoney.s.className = 'stat money' + (!h.sandbox && Math.floor(h.money) < 0 ? ' bad' : ''); }
      chPop.s.hidden = h.pop === null;
      if (h.pop !== null) { setText(chPop.t, typeof h.pop === 'number' ? h.pop.toLocaleString() : h.pop); chPop.s.title = h.pop === '—' ? '人口：讀檔後過一天才算得出來' : '人口'; }
      chPower.s.hidden = !h.power;
      if (h.power) { setText(chPower.t, `${h.power[0]}/${h.power[1]}`); chPower.s.className = 'stat' + (h.power[0] > h.power[1] ? ' bad' : ''); }
      chSave.s.hidden = !h.unsaved;
      if (h.unsaved) { setText(chSave.t, '⚠ 未存檔'); chSave.s.className = 'stat bad saveWarning'; chSave.s.title = `自動存檔失敗：${h.unsaved}。點擊查看原因與匯出分享碼`; chSave.s.setAttribute('aria-label', '未存檔：查看原因與匯出分享碼'); }
      chJ.s.hidden = !h.journal || !!h.unsaved;                          // 存不進去的那一顆比較要緊，同時只亮一顆
      if (h.journal && !h.unsaved) { setText(chJ.t, '⚠ 歷史有上限'); chJ.s.className = 'stat warn saveWarning'; chJ.s.title = `世界歷史的日誌不能用（${h.journal}）：歷史整份存在瀏覽器的存檔裡，約 8 萬筆之後就存不下。點擊查看原因與匯出分享碼`; chJ.s.setAttribute('aria-label', '歷史有上限：查看原因與匯出分享碼'); }
      stats.dataset.money = h.money === null ? '' : String(h.money);
    },
    setCommission(c: { label: string; progress: string; fraction: number; days: number } | null) {
      const b = $('commissionHud'); b.hidden = !c;
      if (!c) return;
      setText(b.querySelector('.label')!, c.label);
      setText(b.querySelector('.progressText')!, c.progress + ' · ' + c.days + '天');
      b.setAttribute('aria-label', '查看進行中的委託：' + c.label + '，' + c.progress + '，剩餘 ' + c.days + ' 天');
      b.title = '點擊查看委託詳情';
      (b.querySelector('.meter i') as HTMLElement).style.width = Math.floor(Math.max(0, Math.min(1, c.fraction)) * 100) + '%';
    },
    setDock(d: DockState) {
      const build = d.mode === 'build';
      $('viewNote').hidden = build;
      $('playBar').hidden = !build; toolsEl.hidden = !build;
      $('playBar').style.display = build ? '' : 'none'; toolsEl.style.display = build ? '' : 'none';
      if (playShown !== d.playing) { const pb = $<HTMLButtonElement>('play'); pb.innerHTML = d.playing ? ICONS.pause : ICONS.play; pb.setAttribute('aria-label', d.playing ? '暫停' : '播放'); playShown = d.playing; }
      if (spd.childElementCount !== d.speeds.length) {
        spd.innerHTML = '';
        d.speeds.forEach((v, k) => { const b = document.createElement('button'); b.textContent = `${v}×`; b.dataset.k = String(k); b.setAttribute('aria-label', `每秒 ${v} 天`); b.onclick = () => on.speed(k); spd.appendChild(b); });
      }
      spd.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.k === String(d.speed)));
      $<HTMLButtonElement>('undo').disabled = !d.canUndo;
      const civ = d.civicTools.find(c => c.id === d.civicTool);
      toolsEl.querySelectorAll<HTMLElement>('.tool').forEach(b => {
        const id = b.dataset.t as ToolId, p = id === 'road' ? d.roadTools.find(r => r.id === d.roadTool)?.cost : (id === 'civic' || id === 'food') ? civ?.cost : d.prices[id];
        b.classList.toggle('on', d.tool === id || (id === 'civic' && d.tool === 'food'));
        setText(b.querySelector('.price')!, d.sandbox ? '免費' : p !== undefined ? '$' + p : '');
        if (id === 'civic' && civ) { setText(b.querySelector('span')!, civ.short); b.setAttribute('aria-label', `${d.tool === 'food' ? '農業外貿' : '公共設施'}：${civ.name}`); }   // 組按鈕的字跟著選到的那一種
      });
      roadSub.hidden = d.tool !== 'road' || !build;
      const key = d.roadTools.map(r => `${r.id}:${r.name}:${r.cost}`).join() + (d.sandbox ? '|free' : '');
      if (key !== roadKey) {                                               // 路的五級：清單或沙盒變了才重建
        roadKey = key; roadSub.replaceChildren();
        for (const r of d.roadTools) {
          const b = document.createElement('button'), sm = document.createElement('small'); b.dataset.r = r.id;
          sm.textContent = d.sandbox ? '免費' : '$' + r.cost; b.append(r.name, sm); b.onclick = () => on.roadTool(r.id); roadSub.appendChild(b);
        }
      }
      roadSub.querySelectorAll<HTMLElement>('button').forEach(b => b.classList.toggle('on', b.dataset.r === d.roadTool));
      // 公共設施一組（D016）：十種，名稱與造價照實驗線；清單或沙盒變了才重建
      $('civicWrap').dataset.group = d.tool === 'food' ? 'food' : 'civic';
      $('civicWrap').hidden = d.mode !== 'build' || (d.tool !== 'civic' && d.tool !== 'food');
      $('civicGuide').hidden = d.mode !== 'build' || (d.tool !== 'civic' && d.tool !== 'food');
      civicSub.hidden = (d.tool !== 'civic' && d.tool !== 'food') || !build;
      const ck = d.civicTools.map(c => `${c.id}:${c.name}:${c.cost}:${c.lock ?? 0}`).join() + (d.sandbox ? '|free' : '');
      if (ck !== civicKey) {
        civicKey = ck; civicSub.replaceChildren();
        for (const c of d.civicTools) {
          const b = document.createElement('button'), sm = document.createElement('small'); b.dataset.c = c.id;
          sm.textContent = c.lock ? `🔒Lv.${c.lock}` : d.sandbox ? '免費' : '$' + c.cost; b.append(c.label ?? c.name, sm); b.onclick = () => on.civicTool(c.id);
          b.setAttribute('aria-label', c.lock ? `${c.name}（城市 Lv.${c.lock} 解鎖）` : `${c.name} ${d.sandbox ? '免費' : '$' + c.cost}`);   // D044：名字縮成按鈕放得下的字，完整的名字給讀屏
          if (c.lock) { b.classList.add('locked'); b.setAttribute('aria-disabled', 'true'); }
          civicSub.appendChild(b);
        }
      }
      civicSub.querySelectorAll<HTMLElement>('button').forEach(b => b.classList.toggle('on', b.dataset.c === d.civicTool));
    },
    setSiteGuide(name: string, result: string | null) {
      const render = () => { const b = $('siteGuide'), shown = !!name || !!result; b.hidden = !shown; $('dayLbl').hidden = shown; $('dayGrow').hidden = shown; setText($('siteToolName'), name ? name + '・現場' : '建造現場 ↗'); b.dataset.result = String(!!result); b.setAttribute('aria-label', (name ? name + '：操作與選址指引' : '建造現場指引') + (result ? '；' + result : '')); b.title = b.getAttribute('aria-label')!; };
      if (!siteGate.defer(render)) render();
    },
    setDay(text: string) { setText($('dayLbl'), text); setText($('siteDay'), text); },
    setCoach(text: string | null) { const c = $('coach'); c.hidden = !text; setText(c, text ?? ''); },
    // onTap（D026）：災禍的提示點一下跳到那棟建築（實驗線 toast 的 x、y，點了鏡頭過去），沒給就只是提示
    toast(text: string, tone: 'good' | 'bad' | 'gold' | '' = '', onTap?: () => void) {
      const t = document.createElement('div'); t.className = 'toast ' + tone; t.textContent = text; toasts.appendChild(t);
      if (onTap) { t.style.cursor = 'pointer'; t.onclick = () => { onTap(); t.remove(); }; }
      while (toasts.childElementCount > 3) toasts.firstElementChild!.remove();
      setTimeout(() => { t.style.opacity = '0'; }, 2200); setTimeout(() => t.remove(), 2700);
    },
    // D047: fit the complete tag between the HUD/notices and dock, using cached
    // measured size (a conservative text estimate until its first layout).
    showCost(x: number, y: number, text: string, bad: boolean) {
      costTag.hidden = false; setText(costTag, text); costTag.classList.toggle('bad', bad);
      cost = { x, y, text }; positionCost();
    },
    hideCost() { cost = null; costTag.hidden = true; },
    setMenu(sections: MenuSection[]) {
      menuBody.replaceChildren();
      for (const s of sections) {
        const h = document.createElement('h3'); h.textContent = s.title; menuBody.appendChild(h);
        const list = document.createElement('div'); list.className = 'list';
        for (const it of s.items) {
          const b = document.createElement('button'), sp = document.createElement('span'); b.className = 'item' + (it.on ? ' on' : ''); b.dataset.m = it.id;
          if (it.icon) b.innerHTML = ICONS[it.icon];
          sp.append(it.label);
          if (it.note) { const sm = document.createElement('small'); sm.textContent = it.note; sp.appendChild(sm); }
          b.appendChild(sp);
          b.onclick = () => { menu.hidden = true; on.menu(it.id); };
          list.appendChild(b);
        }
        menuBody.appendChild(list);
      }
    },
    menuOpen: (open: boolean) => { menu.hidden = !open; },
    isMenuOpen: () => !menu.hidden,
  };
}
export type BuildUi = ReturnType<typeof createBuildUi>;

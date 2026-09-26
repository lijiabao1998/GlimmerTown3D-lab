// 2D 城市模式（D003）：把 2D 實驗線的分享碼解碼成城市，畫成 3D。
// D011 起是建造模式：預設開「我的城」（有存檔時）或新城；種子城、AI 城、全種類照舊只能看。
// 網址參數：?mode=city（預設）&sample=mine|newcity|starter|seed516|ai120|gallery &style=A|B|C（對照用）&at=x,z|center &zoom= &clean=1（拍照，藏介面）
//           &blocks=a|b|c|off（D004 住商工街區三檔；D005 起不帶＝B 照實驗線，off＝D003 現況，只留給守衛用、面板上沒有這一鈕）
//           &sample=starter（D010 起步城：逐日模擬；D011 起可以蓋，照實驗線沙盒規則免費、不存檔）
//           &sample=newcity（D011 新城：種子城地形的空地、標準難度 $3,000；自動存成「我的城」）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { decodeLabCode } from './io/labcode.ts';
import { cityFromLab, cityStats, buildingAt, liveBuildings, type City, type CityEvent, type ImportEvent, type UndoEvent } from './sim/city.ts';
import { stepDay, simHash, simCounts, type Sim, type DayReport } from './sim/day.ts';
import { loadCode, saveCode } from './io/save.ts';
import { previewOp, commitOp, undoOp, canUndo, powerStatus, gestureOf, labToolOf, ROAD_TOOLS, TOOL_PRICE, type EditOp } from './sim/edit.ts';
import { createBuildUi, TOOLS, type ToolId, type MenuSection } from './ui/buildUi.ts';
import { Preview } from './render/preview.ts';
import { buildCityScene, tileTop, TONES, sortKeys, type BuiltCity, type BlockRender, type CivicRender, type Tone } from './render/cityScene.ts';
import { LOOKS } from './content/looks.ts';
import { shapeOf, kindColors } from './content/kindShapes.ts';
import { Pipeline } from './render/post.ts';
import { STYLES, type Style } from './render/styles.ts';
import { KINDS } from './content/kinds.ts';
import { ARCHE } from './content/arche.ts';
import { starterLayout } from './content/starter.ts';
import { gridOf, labPartition, partRow, drawPlan, BLOCK_MODES, type BlockMode, type DrawBlock } from './content/blocks.ts';
import { recipe, type Recipe } from './content/recipes.ts';
import { dressing, type Dressing } from './content/dressing.ts';
import { facadePlan, trimPlan, type FacadePlan, type TrimPlan } from './content/facades.ts';
import { windowTexture } from './render/textures.ts';
import { windowAtlas, atlasCell0MatchesD003 } from './render/windows.ts';
import seed516 from './content/samples/seed516.code.txt?raw';
import ai120 from './content/samples/ai120.code.txt?raw';
import gallery from './content/samples/gallery.code.txt?raw';
import starter from './content/samples/starter.code.txt?raw';
import newcity from './content/samples/newcity.code.txt?raw';
import { vrank as VRANK } from './content/samples/d009-live.json';   // 實驗線執行期的變體排名（D009 抽出，commit 記在同一個檔）

// 樣本碼都是 tools/lab-extract.mjs 從 2D 實驗線 d23c18d（v13.43）產生的，出處與對帳數字在 src/content/samples/*.json
const SAMPLES: Record<string, { label: string; code: string; note: string }> = {
  newcity: { label: '新城', code: newcity, note: '空地、$3,000，從一條路開始' },   // D011：種子城地形、標準難度（實驗線自己匯入讀回過）
  starter: { label: '起步城', code: starter, note: '沙盒：蓋東西免費，不存檔' },   // D010：種子城地形上的起步佈局，會自己長（實驗線自己匯入讀回過）
  seed516: { label: '種子城', code: seed516, note: '只能看' },
  ai120: { label: 'AI 城 120 天', code: ai120, note: '只能看' },
  gallery: { label: '全種類', code: gallery, note: '只能看' },   // D007：住商工以外 183 種各一棟（實驗線自己匯入讀回過）
};
const SIM_SAMPLES = new Set(['starter', 'newcity', 'mine']);
const SAVE_KEY = 'gt3d.v1.save';    // D011：本線自己的鍵；實驗線的 glimmerville.* 同在 lijiabao1998.github.io，不讀不寫
const SPEEDS = [1, 3, 10];          // 每秒幾天
const REBUILD_DAYS = 5;             // 播放中每隔幾天重建一次場景（有新建築或升級才重建；暫停時也重建）
const SAVE_DAYS = 5;                // D011：播放中每隔幾天自動存檔
const TER = ['水面', '沙地', '草地'], ROAD = ['', '道路', '橋', '高速公路', '高速公路橋'], ZONE = ['', '住宅區', '商業區', '工業區'];
const readSave = () => { try { return localStorage.getItem(SAVE_KEY); } catch { return null; } };

export function startCity() {
  const q = new URLSearchParams(location.search);
  const clean = q.get('clean') === '1';
  const style: Style = STYLES[(q.get('style') as Style['id']) ?? 'A'] ?? STYLES.A;
  // D011：網址指定就照指定；沒指定時有存檔開「我的城」、沒有就開新城
  const qs = q.get('sample') ?? '';
  let sampleId = SAMPLES[qs] || (qs === 'mine' && readSave()) ? qs : readSave() ? 'mine' : 'newcity';
  const tone: Tone = (q.get('tone') ?? 'd') in TONES ? (q.get('tone') ?? 'd') as Tone : 'd';   // D006 立面明暗：預設 d（只壓暗背光面），?tone=a|b|c 對照用
  // D005：預設 B（照實驗線；理由見 docs/D005-rci-art.md），?blocks=off 回 D003 現況
  const bq = (q.get('blocks') ?? 'b').toLowerCase();
  let blockMode: BlockMode | null = bq in BLOCK_MODES ? bq as BlockMode : bq === 'off' ? null : 'b';
  // 配方只跟 (k, lv, 寬, 高, v) 有關：同一組只算一次
  const recipes = new Map<string, Recipe>();
  const recipeOf = (b: DrawBlock) => {
    const key = `${b.k}_${b.lv}_${b.w}_${b.h}_${b.v}`;
    let r = recipes.get(key);
    if (!r) { r = recipe(ARCHE, b.k, b.lv, b.w, b.h, b.v); recipes.set(key, r); }
    return r;
  };
  const dressings = new Map<string, Dressing>();
  const dressOf = (b: DrawBlock) => {
    const key = `${b.k}_${b.lv}_${b.w}_${b.h}_${b.v}`;
    let d = dressings.get(key);
    if (!d) { d = dressing(recipeOf(b)); dressings.set(key, d); }
    return d;
  };
  const facades = new Map<string, FacadePlan | null>(), trims = new Map<string, TrimPlan | null>(), keyOf = (b: DrawBlock) => `${b.k}_${b.lv}_${b.w}_${b.h}_${b.v}`;
  const facadeOf = (b: DrawBlock) => { const k = keyOf(b); if (!facades.has(k)) facades.set(k, facadePlan(recipeOf(b))); return facades.get(k)!; };
  const trimOf = (b: DrawBlock) => { const k = keyOf(b); if (!trims.has(k)) trims.set(k, trimPlan(recipeOf(b))); return trims.get(k)!; };
  let plan: DrawBlock[] | null = null;
  // D007：非住商工照造型表畫（街區模式才用）
  const civic: CivicRender = { shape: shapeOf, colors: (k, lv) => kindColors(LOOKS, k, lv, KINDS.catColor(KINDS.cat(k))) };
  const blockRenderFor = (c: City): BlockRender | undefined => {
    if (!blockMode) { plan = null; return undefined; }
    plan = drawPlan(gridOf(c), ARCHE, blockMode);
    return { mode: blockMode, plan, recipe: recipeOf, dress: dressOf, detail: blockMode !== 'a', facade: facadeOf, trim: trimOf };   // A 檔是密度對照，不畫 D008 的逐戶立面與飾條（手機預算）
  };

  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = style.softShadow ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
  document.body.appendChild(renderer.domElement);
  const pipe = new Pipeline();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.minZoom = 0.6; controls.maxZoom = 8;
  controls.screenSpacePanning = true;

  let city: City | null = null, built: BuiltCity | null = null, label = '', needsRender = true, frames = 0;
  // D010 逐日模擬
  let sim: Sim | null = null, playing = false, speed = 0, simAcc = 0, lastT = 0, daysSinceBuild = 0, dirtyScene = false, rebuilds = 0;
  // D011 建造：存檔樣板（讀進來那份存檔 JSON）、起始碼、目前的工具、路的等級、最近一天的回報、存檔
  let template: Record<string, unknown> = {}, startCode = '', tool: ToolId | null = null, roadTool = 'road', lastRep: DayReport | null = null, daysSinceSave = 0;
  let loadNote = '';
  const preview = new Preview();
  const timing: Record<string, number> = {};
  const invalidate = () => { needsRender = true; };
  const autosaves = () => !!sim && (sampleId === 'mine' || sampleId === 'newcity');   // 起步城是沙盒：可以蓋、不存檔

  // 斜 45° 正交鏡頭、仰角 30°（同 300 年示範，也等於 2D 實驗線的 2:1 斜俯視，見 D003 卡）
  function frameCamera(n: number, first: boolean) {
    const at = (first ? q.get('at') ?? '' : '').split(',').map(Number);
    const focus = sim ? zoneCenter(city!) ?? siteCenter(city!) : null;   // D010：起步城對準分區中心；D011 新城還沒分區，對準起步城那塊平地
    const target = at.length === 2 && at.every(Number.isFinite) ? new THREE.Vector3(at[0] + 0.5, 0, at[1] + 0.5) : focus ? new THREE.Vector3(focus[0], 0, focus[1]) : new THREE.Vector3(n / 2, 0, n / 2);
    const D = n * 1.6;
    cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
    cam.far = n * 6;
    cam.zoom = first && q.get('zoom') ? Number(q.get('zoom')) || 1 : sim ? 2.2 : 1;
    cam.lookAt(target);
    controls.target.copy(target);
    resize();
  }
  function resize() {
    const w = innerWidth, h = innerHeight, n = city?.n ?? 72;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    const half = n * 0.42, asp = w / h;
    cam.left = -half * asp; cam.right = half * asp; cam.top = half; cam.bottom = -half;
    cam.updateProjectionMatrix();
    invalidate();
  }
  addEventListener('resize', resize);

  // 匯入一個碼：解碼 → 城市 → 場景。失敗就回傳原因，不動目前的城市
  // simulate：逐日模擬、可以蓋（D011：走 src/io/save.ts 的讀檔，帶 d3 的碼會把本線的歷史接回來）
  function load(code: string, name: string, first = false, simulate = false): { ok: true } | { ok: false; error: string } {
    const t0 = performance.now();
    const r = decodeLabCode(code);
    const t1 = performance.now();
    if (!r.ok) return r;
    dirtyScene = false;                                                   // 舊城的場景馬上要丟掉，不必先重建
    setPlaying(false);
    setTool(null, true);
    sim = null; lastRep = null; loadNote = '';
    if (simulate) {                                                       // D010：模擬的城市就是畫面的城市（同一個物件，逐日同步）
      const L = loadCode(code, KINDS, VRANK);
      if (!L.ok) return L;
      sim = L.sim; template = L.template; startCode = L.start; loadNote = L.note;
    }
    const c = sim ? sim.city : cityFromLab(r.save, KINDS, code);
    daysSinceBuild = 0; daysSinceSave = 0; dirtyScene = false; rebuilds = 0; simAcc = 0;
    const t2 = performance.now();
    const br = blockRenderFor(c);
    const tp = performance.now();
    const b = buildCityScene(c, KINDS, style, br, tone, br ? civic : undefined);
    const t3 = performance.now();
    built?.dispose();
    city = c; built = b; label = name; lastCode = code;
    built.scene.add(preview.mesh);
    delete timing.rebuild;
    Object.assign(timing, { decode: t1 - t0, city: t2 - t1, plan: tp - t2, scene: t3 - t2, total: t3 - t0 }, b.timing);
    frameCamera(c.n, first);
    closeCard();
    syncUi();
    return { ok: true };
  }
  function openSample(id: string, first = false) {
    const code = id === 'mine' ? readSave() : SAMPLES[id]?.code;
    if (!code) return { ok: false as const, error: '沒有這座城' };
    const prev = sampleId;
    sampleId = id;
    const r = load(code, id === 'mine' ? '我的城' : SAMPLES[id].label, first, SIM_SAMPLES.has(id));
    if (!r.ok) { sampleId = prev; return r; }
    if (id === 'newcity') saveNow();                                      // 新城一開就是「我的城」
    return r;
  }
  // D004：換街區檔位，只重建場景（鏡頭不動）
  function setBlocks(m: BlockMode | null) {
    if (!city) return;
    blockMode = m;
    const t0 = performance.now(), br = blockRenderFor(city), tp = performance.now(), b = buildCityScene(city, KINDS, style, br, tone, br ? civic : undefined), t1 = performance.now();
    built?.dispose();
    built = b;
    built.scene.add(preview.mesh);
    Object.assign(timing, { plan: tp - t0, scene: t1 - t0 }, b.timing);
    const u = new URL(location.href);
    if (m && m !== 'b') u.searchParams.set('blocks', m); else if (m) u.searchParams.delete('blocks'); else u.searchParams.set('blocks', 'off');
    history.replaceState(null, '', u);
    closeCard();
    syncUi();
  }

  // D010：逐日模擬的場景重建（鏡頭不動、建築卡的框留著）
  function rebuildScene() {
    if (!city) return;
    const t0 = performance.now(), br = blockRenderFor(city), tp = performance.now(), b = buildCityScene(city, KINDS, style, br, tone, br ? civic : undefined), t1 = performance.now();
    built?.dispose();
    built = b;
    built.scene.add(preview.mesh);                                       // D011：施工預覽跟著搬到新場景
    Object.assign(timing, { plan: tp - t0, scene: t1 - t0, rebuild: t1 - t0 }, b.timing);
    rebuilds++; daysSinceBuild = 0; dirtyScene = false;
    if (!bio.hidden && cardAt) showTile(cardAt[0], cardAt[1]);          // 卡片開著：用新的城市與街區重寫一次（等級、街區、框都可能變了）
    invalidate();
  }
  function simDay() {
    const rep = stepDay(sim!);
    lastRep = rep;
    if (rep.grown || rep.upgraded) dirtyScene = true;
    daysSinceBuild++; daysSinceSave++;
    const st = rep.settle;                                                // D011：當天的里程碑、星等獎金、紓困（實驗線 56081、56122、56142）
    if (st?.milestone) bui.toast(`人口到 ${st.milestone.pop}：獎勵 $${st.milestone.reward.toLocaleString()}`, 'gold');
    if (st?.star) bui.toast(`城市評等 ${st.star.star} 顆星：獎勵 $${st.star.bonus.toLocaleString()}`, 'gold');
    if (st?.bailout) bui.toast(`資金見底，市府紓困 $${st.bailout}`, 'bad');
    if (daysSinceSave >= SAVE_DAYS) saveNow();
    return rep;
  }
  function setPlaying(on: boolean) {
    playing = on && !!sim; lastT = 0; simAcc = 0;
    if (!playing && dirtyScene) rebuildScene();
    if (!playing) saveNow();
    syncSim();
  }
  // D011 自動存檔（實驗線分享碼格式＋附加欄位 d3，src/io/save.ts）；只有「我的城」存，起步城是沙盒
  function saveNow() {
    if (!autosaves() || !sim) return false;
    daysSinceSave = 0;
    try { localStorage.setItem(SAVE_KEY, saveCode(sim, template, startCode)); if (sampleId === 'newcity') sampleId = 'mine'; return true; }
    catch { return false; }
  }
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  // 推進（播放中才動）與作畫分開：測試出口、對焦只作畫，不會順手多推天數
  function advance() {
    if (sim && playing) {
      const t = performance.now(), dt = lastT ? Math.min(0.25, (t - lastT) / 1000) : 0;
      lastT = t; simAcc += dt * SPEEDS[speed];
      let steps = 0;
      while (simAcc >= 1 && steps < 3) { simAcc -= 1; steps++; simDay(); }   // 一幀最多推 3 天，慢機器不會卡死
      if (steps) { if (dirtyScene && daysSinceBuild >= REBUILD_DAYS) rebuildScene(); syncUi(); }
    }
  }
  function draw() {
    if (controls.update()) needsRender = true;
    if (!needsRender || !built) return;
    needsRender = false;
    frames++;
    pipe.render(renderer, built.scene, cam, style, innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
  }
  renderer.setAnimationLoop(() => { advance(); draw(); });

  // ---- 介面（D011：上方狀態列＋☰ 選單、下方播放列＋工具列，src/ui/buildUi.ts；建築卡與分享碼對話框沿用）----
  const ui = document.createElement('div');
  ui.innerHTML = `
    <div id="bio" hidden><button class="x" aria-label="關閉">✕</button><h2></h2><p class="sub"></p><ol></ol></div>
    <div id="dlg" hidden><div class="card"><h2 id="dlgTitle">貼上分享碼</h2><p class="sub" id="dlgSub"></p>
      <textarea spellcheck="false" autocomplete="off" placeholder="eyJ2IjoxLC…"></textarea><p class="err"></p>
      <div class="row"><button id="dlgOk">匯入</button><button id="dlgNo">取消</button></div></div></div>`;
  const bui = createBuildUi({
    tool: t => setTool(t), roadTool: id => { roadTool = id; syncDock(); updatePreview(); },
    play: () => setPlaying(!playing), speed: k => { speed = k; syncDock(); }, undo: () => doUndo(),
    menu: id => onMenu(id), menuOpen: () => bui.setMenu(menuSections()), startBuild: () => menuCity('newcity'),
  });
  if (!clean) { document.head.appendChild(bui.style); document.body.appendChild(bui.root); document.body.appendChild(ui); }
  const $ = <T extends Element>(s: string) => ui.querySelector(s) as T;
  const bio = $<HTMLElement>('#bio'), dlg = $<HTMLElement>('#dlg'), ta = $<HTMLTextAreaElement>('#dlg textarea'), err = $('#dlg .err'), dlgOk = $<HTMLButtonElement>('#dlgOk');
  let dlgMode: 'paste' | 'export' = 'paste', lastCode = '';
  function openDlg(mode: 'paste' | 'export', text = '') {
    dlgMode = mode;
    $('#dlgTitle').textContent = mode === 'paste' ? '貼上分享碼' : '匯出分享碼';
    $('#dlgSub').textContent = mode === 'paste' ? '2D 實驗線或本線匯出的整串分享碼（可以帶 GVX1: 前綴）。本線匯出、帶建造歷史的碼可以接著蓋；其他碼只能看。'
      : '實驗線的存檔格式：貼進 2D 實驗線的「匯入分享碼」就能開。本線的建造歷史在附加欄位 d3，實驗線不讀它。';
    ta.value = text; ta.readOnly = mode === 'export'; dlgOk.textContent = mode === 'paste' ? '匯入' : '複製'; err.textContent = '';
    dlg.hidden = false;
    if (mode === 'export') ta.select(); else ta.focus();
  }
  $<HTMLButtonElement>('#dlgNo').onclick = () => { dlg.hidden = true; };
  dlgOk.onclick = () => {
    if (dlgMode === 'export') { ta.select(); navigator.clipboard?.writeText(ta.value).then(() => bui.toast('已複製分享碼', 'good'), () => bui.toast('請手動複製')); return; }
    const code = ta.value, r = decodeLabCode(code);
    if (!r.ok) { err.textContent = r.error; return; }
    const mine = !!r.save.raw.d3;                                         // 本線匯出、帶歷史的碼：接著蓋，存成我的城
    if (mine && readSave() && !confirm('貼上的城會蓋掉目前的「我的城」，要繼續嗎？')) return;
    const prev = sampleId;
    sampleId = mine ? 'mine' : '';
    const res = load(code, mine ? '我的城' : '貼上的城市', false, mine);
    if (!res.ok) { sampleId = prev; err.textContent = res.error; return; }
    if (mine) saveNow();
    dlg.hidden = true; ta.value = '';
  };
  $<HTMLButtonElement>('#bio .x').onclick = () => closeCard();

  // ☰ 選單：城市、分享碼、住商工的畫法、300 年示範（「D003 現況」只留網址 ?blocks=off 給守衛）
  function menuSections(): MenuSection[] {
    const saved = readSave(), r = saved ? decodeLabCode(saved) : null;
    const mineNote = r ? (r.ok ? `第 ${r.save.day.toLocaleString()} 天・${r.save.df === 3 ? '沙盒' : '$' + Math.round(r.save.money).toLocaleString()}` : '存檔讀不出來') : '';
    return [
      { title: '城市', items: [
        ...(saved ? [{ id: 'city:mine', label: '我的城', note: mineNote, icon: 'build' as const, on: sampleId === 'mine' }] : []),
        ...Object.entries(SAMPLES).map(([id, s]) => ({ id: 'city:' + id, label: s.label, note: s.note, on: sampleId === id })),
      ] },
      { title: '分享碼', items: [
        { id: 'export', label: '匯出分享碼', note: '貼進 2D 實驗線就能開', icon: 'share' as const },
        { id: 'paste', label: '貼上分享碼', note: '實驗線或本線匯出的碼', icon: 'paste' as const },
      ] },
      { title: '住商工的畫法', items: Object.entries(BLOCK_MODES).map(([k, v]) => ({ id: 'blocks:' + k, label: `${k.toUpperCase()} ${v}`, on: blockMode === k })) },
      { title: '其他', items: [{ id: 'history', label: '300 年示範', note: '同一座城、300 年（D002）', icon: 'hourglass' as const }] },
    ];
  }
  function onMenu(id: string) {
    if (id.startsWith('city:')) menuCity(id.slice(5));
    else if (id === 'export') openDlg('export', sim ? saveCode(sim, template, startCode) : lastCode);
    else if (id === 'paste') openDlg('paste');
    else if (id.startsWith('blocks:')) setBlocks(id.slice(7) as BlockMode);
    else if (id === 'history') location.search = '?mode=history';
  }
  function menuCity(id: string) {
    if (id === 'newcity' && readSave() && !confirm('開新城會蓋掉目前的「我的城」，要繼續嗎？')) return;
    const r = openSample(id);
    if (!r.ok) bui.toast(r.error, 'bad');
  }

  function syncUi() {
    if (!city) return;
    const c = city, live = liveBuildings(c), kinds = new Set(live.map(b => b.k)).size, pw = sim ? powerStatus(sim) : null;
    const k = sim ? simCounts(sim) : null;
    bui.setHud({
      name: `${label}${label === c.name ? '' : `「${c.name}」`}`,
      sub: sim ? `第 ${sim.day.toLocaleString()} 天・住 ${k![1][0]}／商 ${k![2][0]}／工 ${k![3][0]}（二級 ${k![1][2] + k![2][2] + k![3][2]}）・幸福 ${sim.cityHappy.toFixed(2)}`
        : `實驗線 v${c.gameVer}・第 ${c.day.toLocaleString()} 天・建築 ${live.length}（${kinds} 種）・${c.n}×${c.n}`,
      money: sim ? sim.money : null, sandbox: sim?.diff === 3, day: sim ? sim.day : null, pop: sim ? sim.pop : null, power: pw ? [pw.powered + pw.unpowered, pw.cap] : null,
    });
    syncDock();
  }
  function syncDock() {
    bui.setDock({ mode: sim ? 'build' : 'view', tool, roadTool, roadTools: ROAD_TOOLS, prices: TOOL_PRICE, playing, speed, speeds: SPEEDS, canUndo: !!sim && canUndo(sim), sandbox: sim?.diff === 3 });
    bui.setDay(sim ? `第 ${sim.day} 天` : '');
    bui.setCoach(coachText());
  }
  const syncSim = syncUi;   // D010 的呼叫點（播放、速度）沿用
  // 開局提示：照實驗線教練列的順序（checkHints 66640–66645）：先鋪路 → 路邊劃住宅 → 蓋電廠；本線開局暫停，多一步「按 ▶」
  function coachText(): string | null {
    if (!sim || clean) return null;
    let roads = 0, zones = 0, ci = 0;
    for (const t of sim.w.tiles) { if (t.road) roads++; if (t.zone) { zones++; if (t.zone > 1) ci++; } }
    const plants = liveBuildings(sim.city).filter(b => b.k === 5).length, pw = powerStatus(sim);
    if (roads < 3) return '① 選「路」，在草地上按住拖出一條路';
    if (zones < 4) return '② 選「住」，在路邊拖出一塊住宅區';
    if (plants === 0) return '③ 選「電」，在路邊點一下蓋電廠：電會沿著路送到房子';
    if (!playing && sim.pop === 0 && sim.day <= 3) return '④ 按 ▶ 讓時間走，房子會自己長出來';
    if (pw.powered + pw.unpowered > pw.cap) return `⚡ 電不夠了：${pw.powered + pw.unpowered} 棟要用電、電廠只供 ${pw.cap} 棟，再蓋一座電廠（一座約供 75 棟）`;
    if (sim.pop > 0 && ci === 0) return '🎉 居民入住了！接著劃「商」「工」提供工作';
    return null;
  }
  // 分區格的中心（D010 起步城開場對準它）
  function zoneCenter(c: City): [number, number] | null {
    let sx = 0, sz = 0, k = 0;
    for (let i = 0; i < c.n * c.n; i++) if (c.zone[i]) { sx += i % c.n + .5; sz += ((i / c.n) | 0) + .5; k++; }
    return k ? [sx / k, sz / k] : null;
  }
  // 新城還沒分區：對準起步城那塊平地（src/content/starter.ts 挑的位置）
  function siteCenter(c: City): [number, number] | null {
    try { const L = starterLayout(c.n, c.ter, c.el); return [L.center[0], L.center[1]]; } catch { return null; }
  }

  // ---- D011 建造：選工具、拖曳預覽、放開提交、復原 ----
  function setTool(t: ToolId | null, silent = false) {
    if (t && !sim) t = null;
    tool = t; stroke = null; lastPreview = null; preview.clear(); bui.hideCost();
    // 拿著工具：一指（滑鼠左鍵）拿來蓋，兩指照舊縮放、平移；放下工具：一指照舊轉鏡頭
    (controls.touches as { ONE: THREE.TOUCH | null }).ONE = t ? null : THREE.TOUCH.ROTATE;
    (controls.mouseButtons as { LEFT: THREE.MOUSE | null }).LEFT = t ? null : THREE.MOUSE.ROTATE;
    if (t) closeCard();
    if (!silent) syncDock();
    invalidate();
  }
  const toolColor = () => TOOLS.find(x => x.id === tool)?.color ?? '#ffffff';
  let stroke: { pid: number; a: [number, number]; b: [number, number]; x: number; y: number; moved: boolean } | null = null;
  let lastPreview: ReturnType<typeof previewOp> | null = null;
  function opOf(s: NonNullable<typeof stroke>): EditOp {
    const lt = labToolOf(tool!, roadTool), g = gestureOf(lt);
    return g === 'tap' ? { k: 'tap', tool: lt, x0: s.a[0], z0: s.a[1], x1: s.a[0], z1: s.a[1] } : { k: g, tool: lt, x0: s.a[0], z0: s.a[1], x1: s.b[0], z1: s.b[1] };
  }
  function updatePreview() {
    if (!stroke || !sim || !city || !tool) return;
    const t0 = performance.now(), op = opOf(stroke), n = city.n;
    if (op.k === 'tap' && stroke.moved) { preview.clear(); bui.hideCost(); lastPreview = null; invalidate(); return; }   // 點的工具：拖了就取消（實驗線 T436）
    const pv = previewOp(sim, op);
    preview.set(pv.cells.map(q => ({ x: q.x, z: q.z, y: Math.max(0, tileTop(city!, q.z * n + q.x)), ok: q.ok })), toolColor());
    lastPreview = pv;
    placeCostTag();
    timing.preview = performance.now() - t0;
    invalidate();
  }
  function placeCostTag() {
    if (!stroke || !lastPreview || !city || !sim) return;
    const pv = lastPreview, [x, z] = opOf(stroke).k === 'tap' ? stroke.a : stroke.b, n = city.n;
    const [sx, sy] = screenOf(new THREE.Vector3(x + .5, Math.max(0, tileTop(city, z * n + x)), z + .5));
    const text = pv.count === 0 ? (pv.reason ?? '這裡不能蓋') : `${sim.diff === 3 ? '免費' : '$' + pv.total.toLocaleString()}${pv.count > 1 ? `・${pv.count} 格` : ''}`;
    bui.showCost(sx, sy, text, pv.count === 0 || !pv.affordable);
  }
  function cancelStroke() { stroke = null; lastPreview = null; preview.clear(); bui.hideCost(); invalidate(); }
  function commitStroke(s: NonNullable<typeof stroke>) {
    preview.clear(); bui.hideCost(); lastPreview = null;
    if (!sim || !tool) return null;
    const op = opOf(s);
    if (op.k === 'tap' && s.moved) { invalidate(); return null; }
    return runOp(op);
  }
  // 手勢和測試出口共用同一條路：規則照實驗線（src/sim/edit.ts → src/sim/rules/build.ts）、事件記進歷史、場景重建、自動存檔
  function runOp(op: EditOp) {
    const t0 = performance.now();
    const res = commitOp(sim!, op, performance.now());
    if (res.arm) bui.toast(`⚠️ 再點一次確認拆除 Lv${res.arm.lv} ${KINDS.name(res.arm.k)}`, 'gold');   // 實驗線原句（62987）
    else if (!res.placed && res.reason) bui.toast(res.reason, 'bad');
    if (res.skipped) bui.toast(`已跳過 ${res.skipped} 棟 Lv2+ 建築（單獨點兩次可拆）`);             // 實驗線原句（63004）
    if (res.placed || res.spent) {
      rebuildScene();
      saveNow();
      if (res.spent && sim!.diff !== 3) bui.toast(`−$${res.spent.toLocaleString()}${res.placed > 1 ? `（${res.placed} 格）` : ''}`);
    }
    syncUi();
    needsRender = true; draw();
    timing.commit = performance.now() - t0;
    return res;
  }
  function doUndo() {
    if (!sim) return null;
    const r = undoOp(sim);
    if (!r.ok) { bui.toast('沒有可以復原的：只能復原今天的施工'); return r; }
    rebuildScene(); saveNow();
    bui.toast(`↩ 已復原${r.refund ? `，退回 $${r.refund.toLocaleString()}` : ''}`, 'good');
    syncUi();
    return r;
  }
  addEventListener('keydown', e => {
    if (clean || !dlg.hidden || (e.target as HTMLElement | null)?.tagName === 'TEXTAREA') return;
    if (e.key === 'Escape') setTool(null);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo(); }
    else if (e.key === ' ' && sim) { e.preventDefault(); setPlaying(!playing); }
    else if (/^[1-7]$/.test(e.key) && sim) setTool(TOOLS[+e.key - 1].id);
  });
  // 這一格在目前檔位屬於哪個街區（plan 的索引；-1＝沒畫）
  const blockOfCell = (i: number) => {
    if (!plan || !built) return -1;
    const drawn = new Set(built.blocksDrawn());
    return plan.findIndex((b, bi) => drawn.has(bi) && b.cells.includes(i));
  };

  // ---- 點一格：有建築就看建築，沒有就看這一格是什麼 ----
  const marker = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.04, 1)), new THREE.LineBasicMaterial({ color: 0xffd34d }));
  let cardAt: [number, number] | null = null;   // 卡片開在哪一格（逐日重建後要重寫）
  function closeCard() { bio.hidden = true; cardAt = null; marker.removeFromParent(); invalidate(); }
  // D011：這一格（根格）上發生過的事，照歷史的順序；當天復原掉的那筆手勢照樣列、標明復原（歷史只增不改）
  function lotEvents(c: City, x: number, z: number) {
    return c.history.filter((e): e is Exclude<CityEvent, ImportEvent | UndoEvent> => e.t !== 'import' && e.t !== 'undo' && e.x === x && e.z === z);
  }
  function lotRow(c: City, e: Exclude<CityEvent, ImportEvent | UndoEvent>) {
    const undone = 'g' in e && c.history.some(u => u.t === 'undo' && u.g === e.g), tail = undone ? '（當天復原）' : '', d = `<b>第 ${e.day.toLocaleString()} 天</b>`;
    const RCN = ['', '小巷', '支路', '次幹道', '主幹道', '快速路'];
    switch (e.t) {
      case 'grow': return `${d}長出來（逐日模擬，${e.lv} 級）`;
      case 'upgrade': return `${d}升到 ${e.lv} 級`;
      case 'road': return `${d}鋪了${RCN[e.rc] ?? '路'}${e.cost ? `（$${e.cost}）` : ''}${tail}`;
      case 'zone': return `${d}劃成${ZONE[e.zone]}${e.cost ? `（$${e.cost}）` : ''}${tail}`;
      case 'place': return `${d}蓋了${KINDS.name(e.k)}${e.cost ? `（$${e.cost}）` : ''}${tail}`;
      case 'doze': return `${d}${e.layer === 'bld' ? '拆掉' + KINDS.name(e.k ?? 0) : e.layer === 'road' ? '拆掉道路' : e.layer === 'zone' ? '取消分區' : '砍掉樹'}${tail}`;
    }
  }
  function showTile(x: number, z: number) {
    if (!city || !built) return null;
    cardAt = [x, z];
    const c = city, i = z * c.n + x, b = buildingAt(c, x, z);
    const imp = c.history.find((e): e is ImportEvent => e.t === 'import'), impDay = imp ? imp.day : c.day;   // 匯入那天（c.day 會跟著逐日模擬走）
    const rows: string[] = [];
    let title: string;
    if (b) {
      const cat = KINDS.cat(b.k);
      title = `${KINDS.name(b.k)}（${b.x}, ${b.z}）`;
      $('#bio .sub').textContent = `${KINDS.catName(cat)}・${b.lv} 級・佔地 ${b.size}×${b.size}${b.abandoned ? '・已遭遺棄' : ''}`;
      // D010：逐日模擬記下的生長、升級；D011：這一塊地上的施工（劃區、鋪路、蓋、拆）照發生順序一起列。
      // 匯入的建築先列 2D 存檔推算的蓋起日（屋齡取匯入當時的，b.age 會跟著模擬長）
      const evs = lotEvents(c, b.x, b.z);
      if (!evs.some(e => (e.t === 'grow' || e.t === 'place') && e.day >= b.builtDay)) rows.push(`<b>約第 ${Math.max(0, b.builtDay).toLocaleString()} 天</b>蓋起（由 2D 存檔的 age=${impDay - b.builtDay} 推算，只是估計）`);
      for (const e of evs) rows.push(lotRow(c, e));
      if (!KINDS.known(b.k)) rows.push('<b>注意</b>本線的種類表沒有這一種，用預設量體畫');
      if (plan && blockMode && b.k >= 1 && b.k <= 3) {
        const bi = blockOfCell(i);
        if (bi >= 0) {
          const bk = plan[bi], r = recipeOf(bk);
          rows.push(`<b>街區 ${bk.w}×${bk.h}</b>${blockMode.toUpperCase()} 檔・原型 ${r.arche}${r.path === 'core' ? '' : `（${r.path} 立面）`}・起點 (${bk.x}, ${bk.z})・畫法用起點的 ${bk.lv} 級`);
        } else rows.push(`<b>這一格沒畫</b>實驗線的切分沒有街區蓋到這格（D0），或被旁邊的大街區吸收（T555）`);
      }
      rows.push(`<b>第 ${impDay.toLocaleString()} 天</b>從 2D 實驗線 v${c.gameVer} 匯入 3D（這之前的歷史 2D 存檔沒有記）`);
    } else {
      title = `${ROAD[c.road[i]] || ZONE[c.zone[i]] || TER[c.ter[i]] || '地塊'}（${x}, ${z}）`;
      const bits = [TER[c.ter[i]], c.el[i] ? '高地' : '', ZONE[c.zone[i]] ? ZONE[c.zone[i]] + '（還沒蓋）' : '', c.tree[i] ? '有樹' : '', c.rail[i] ? '鐵路' : '', c.fly[i] ? '高架' : ''].filter(Boolean);
      $('#bio .sub').textContent = bits.join('・');
      for (const e of lotEvents(c, x, z)) rows.push(lotRow(c, e));      // D011：這一格的施工與拆掉的建築
      rows.push(`<b>第 ${impDay.toLocaleString()} 天</b>從 2D 實驗線 v${c.gameVer} 匯入 3D`);
    }
    $('#bio h2').textContent = title;
    $('#bio ol').innerHTML = rows.map(r => `<li>${r}</li>`).join('');
    const bi = b ? blockOfCell(i) : -1, bk = bi >= 0 ? plan![bi] : null;   // D004：點到街區就框整個街區
    const sx = bk ? bk.w : b ? b.size : 1, sz = bk ? bk.h : b ? b.size : 1, x0 = bk ? bk.x : b ? b.x : x, z0 = bk ? bk.z : b ? b.z : z;
    marker.scale.set(sx, 1, sz); marker.position.set(x0 + sx / 2, Math.max(0, tileTop(c, z0 * c.n + x0)) + 0.03, z0 + sz / 2);
    built.scene.add(marker);
    bio.hidden = false;
    invalidate();
    return { title, rows: [...ui.querySelectorAll('#bio li')].map(li => li.textContent) };
  }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(cx: number, cy: number) {
    if (!built) return null;
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return built.pick(ray);
  }
  const screenOf = (v: THREE.Vector3) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
  // D011：螢幕上一點落在哪一格（施工用，打地面：先打 y=0，那格是高地再打一次格頂高度；水面、出界回 null 的只有出界）
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
  function tileAt(cx: number, cy: number): [number, number] | null {
    if (!city) return null;
    ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const n = city.n;
    let y = 0;
    for (let pass = 0; pass < 2; pass++) {
      plane.constant = -y;
      if (!ray.ray.intersectPlane(plane, hitP)) return null;
      const x = Math.floor(hitP.x), z = Math.floor(hitP.z);
      if (x < 0 || z < 0 || x >= n || z >= n) return null;
      const top = Math.max(0, tileTop(city, z * n + x));
      if (top === y || pass === 1) return [x, z];
      y = top;
    }
    return null;
  }
  let down: { x: number; y: number; t: number } | null = null;
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!tool || !sim) return;
    if (stroke) { cancelStroke(); return; }                                // 第二根手指：交給鏡頭（兩指縮放、平移）
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const t = tileAt(e.clientX, e.clientY);
    if (!t) return;
    stroke = { pid: e.pointerId, a: t, b: t, x: e.clientX, y: e.clientY, moved: false };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 沒有也行 */ }
    updatePreview();
  });
  canvas.addEventListener('pointermove', e => {
    if (!stroke || e.pointerId !== stroke.pid) return;
    if (Math.hypot(e.clientX - stroke.x, e.clientY - stroke.y) > 8) stroke.moved = true;
    const t = tileAt(e.clientX, e.clientY);
    if (t && (t[0] !== stroke.b[0] || t[1] !== stroke.b[1])) { stroke.b = t; updatePreview(); }
    else if (opOf(stroke).k === 'tap' && stroke.moved && lastPreview) updatePreview();
  });
  canvas.addEventListener('pointerup', e => {
    if (stroke && e.pointerId === stroke.pid) { const s0 = stroke; stroke = null; down = null; commitStroke(s0); return; }
    if (!down || tool) { down = null; return; }
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 400;
    down = null;
    if (!tap) return;
    const h = pickAt(e.clientX, e.clientY);
    if (h) showTile(h.x, h.z);
  });
  canvas.addEventListener('pointercancel', e => { if (stroke && e.pointerId === stroke.pid) cancelStroke(); });   // 實驗線取消時照蓋（62934），本線不照搬：取消就是取消

  const resumed = sampleId === 'mine';                                   // 開頁時就有存檔：接著上次的城（第一次開新城不提示）
  const first = openSample(sampleId, true);
  if (!first.ok) throw new Error('樣本碼解不開：' + first.error);
  if (loadNote && !clean && resumed) bui.toast(loadNote.startsWith('歷史') ? '已接著上次的城繼續' : loadNote);

  // ---- 給煙霧測試與拍照工具的出口（純讀取；D011 的施工出口走跟手勢同一條路）----
  (window as unknown as { __gt: unknown }).__gt = {
    ready: true, mode: 'city',
    get sample() { return sampleId; },
    webgl2: renderer.capabilities.isWebGL2,
    stats: () => cityStats(city!),
    issues: () => city!.issues,
    history: () => city!.history,
    timing: () => ({ ...timing }),
    owners: () => built!.owners(),
    buildingCount: () => liveBuildings(city!).length,
    kinds: () => ({ count: KINDS.data.kinds.length, source: KINDS.data.source.commit }),
    tryCode: (code: string) => { const r = decodeLabCode(code); return r.ok ? { ok: true, n: r.save.n, buildings: r.save.bl.length } : r; },
    loadCode: (code: string) => load(code, '貼上的城市'),
    loadSample: (id: string) => { sampleId = id; return load(SAMPLES[id].code, SAMPLES[id].label, false, SIM_SAMPLES.has(id)); },
    // ---- D010 逐日模擬 ----
    sim: () => sim ? { day: sim.day, seed: sim.seed, pop: sim.pop, jobs: sim.jobs, happy: sim.cityHappy, dem: [sim.dem[1], sim.dem[2], sim.dem[3]], rci: simCounts(sim), hash: simHash(sim),
      events: sim.city.history.length, rebuilds, playing, speed: SPEEDS[speed], buildings: liveBuildings(sim.city).length,
      money: sim.money, diff: sim.diff, msIdx: sim.msIdx, bestStar: sim.bestStar, power: powerStatus(sim), settle: lastRep?.settle ?? null } : null,
    // 同步推 n 天、最後重建一次並當場畫一幀（守衛與拍照用）；回傳推完的狀態
    simStep(n: number) { if (!sim) return null; for (let i = 0; i < n; i++) simDay(); if (dirtyScene) rebuildScene(); syncUi(); needsRender = true; draw(); lastT = 0; return (window as unknown as { __gt: { sim(): unknown } }).__gt.sim(); },
    simPlay: (on: boolean) => { setPlaying(on); return playing; },
    simSpeed: (k: number) => { speed = Math.max(0, Math.min(SPEEDS.length - 1, k | 0)); syncSim(); return SPEEDS[speed]; },
    // 重建一次場景（不推天數），回傳這次重建的耗時（ms）
    simRebuild() { rebuildScene(); needsRender = true; draw(); lastT = 0; return timing.rebuild; },
    // ---- D011 建造 ----
    ui: () => ({ tool, roadTool, coach: coachText(), dock: sim ? 'build' : 'view', saved: !!readSave(), autosaves: autosaves() }),
    tool: (t: ToolId | null, rc?: string) => { if (rc) roadTool = rc; setTool(t); return tool; },
    edit: (op: EditOp) => sim ? runOp(op) : null,                          // 跟手勢同一條路：規則、事件、重建、存檔
    preview: (op: EditOp) => sim ? previewOp(sim, op) : null,
    undo: () => doUndo(),
    // 對拍劇本的「資金設定」（兩邊設成同一個數，把建造規則跟每日結算分開；實驗線那邊是注入的 setMoney）：只給守衛與拍照用，介面沒有這個鈕
    simMoney: (v: number) => { if (!sim) return null; sim.money = v; syncUi(); return sim.money; },
    cellScreen: (x: number, z: number) => { const n = city!.n; return screenOf(new THREE.Vector3(x + .5, Math.max(0, tileTop(city!, z * n + x)), z + .5)); },
    tileAt: (sx: number, sy: number) => tileAt(sx, sy),
    cam: () => ({ pos: cam.position.toArray(), target: controls.target.toArray(), zoom: cam.zoom }),
    stroke: () => stroke ? { a: stroke.a, b: stroke.b, moved: stroke.moved, preview: lastPreview ? { count: lastPreview.count, total: lastPreview.total, cells: lastPreview.cells.length } : null } : null,
    previewCount: () => preview.mesh.count,
    save: () => sim ? saveCode(sim, template, startCode) : null,
    saved: () => readSave(),
    saveNow: () => saveNow(),
    clearSave: () => { try { localStorage.removeItem(SAVE_KEY); } catch { /* 無痕模式 */ } return !readSave(); },
    menuItems: () => menuSections().flatMap(s => s.items.map(i => i.id)),
    menu: (id: string) => onMenu(id),
    loadNote: () => loadNote,
    // 投影一棟建築量體的中心到螢幕，再模擬點擊：回報點到的格子與建築
    pickTest(id: number) {
      const b = city!.buildings[id - 1], a = built!.anchorOf(id);
      if (!b || !a) return null;
      const [sx, sy] = screenOf(a);
      const h = pickAt(sx, sy);
      return { want: [b.x, b.z, id], got: h, name: KINDS.name(b.k) };
    },
    openTile: (x: number, z: number) => showTile(x, z),
    // 目前卡片的樣子（clean=1 時介面沒掛進 document，測試從這裡讀）
    card: () => ({ open: !bio.hidden, at: cardAt, title: $('#bio h2').textContent, sub: $('#bio .sub').textContent }),
    // 挑一棟當點擊測試的目標：佔地最大、同佔地取最高、再取編號最小（決定性）
    bigOne: () => [...liveBuildings(city!)].sort((a, b) => b.size - a.size || KINDS.height(b.k, b.lv, b.v) - KINDS.height(a.k, a.lv, a.v) || a.id - b.id)[0].id,
    idOfKind: (k: number) => liveBuildings(city!).find(b => b.k === k)?.id ?? null,
    frames: () => frames,
    // ---- D005 ----
    artCounts: () => built!.artCounts(),
    // 擺放計畫的合計（畫出來的街區）：要等於 artCounts（每一件都真的畫了）
    dressTotals: () => {
      const t = { props: 0, edges: 0, kits: 0, awnings: 0, doors: 0, docks: 0, shopBands: 0, plainBands: 0, units: 0, rows: 0, parts: 0, trims: 0, partKinds: {} as Record<string, number> };
      if (!plan || !built) return t;
      for (const bi of built.blocksDrawn()) {
        const d = dressOf(plan[bi]);
        t.props += d.props.length; t.edges += d.edges.length; t.kits += d.kits.length; t.awnings += d.awnings.length;
        t.doors += d.doors.length; t.docks += d.dock === null ? 0 : 1; t.shopBands += d.shopPx > 0 ? 1 : 0;
        t.plainBands += d.dock === null ? 0 : 1;   // 工業核心街區（有裝卸口的）牆下 45% 不開窗
        if (blockMode !== 'a') {                     // D008：逐戶單元、小件、帶（立面）＋飾條環（核心）
          const f = facadeOf(plan[bi]), tp = trimOf(plan[bi]);
          if (f) { t.units += f.units.length; t.rows += f.rows.length; t.parts += f.parts.length; t.trims += f.bands.length; for (const q of f.parts) t.partKinds[q.kind] = (t.partKinds[q.kind] ?? 0) + 1; }
          else if (tp) t.trims += tp.rings.length;
        }
      }
      return { ...t, partKinds: sortKeys(t.partKinds) };
    },
    groundAt: (x: number, z: number) => built!.groundAt(x, z),
    wallStyles: () => built!.wallStyles(),
    meshStats: () => built!.meshStats(),
    ownerBoxes: () => built!.ownerBoxes(),
    kindColorsUsed: () => built!.kindColorsUsed(),
    // D007：從正上方點地圖上一點（格座標），回報點到的建築（不動目前的鏡頭）
    pickTopDown(x: number, z: number) {
      const saved = { pos: cam.position.clone(), up: cam.up.clone(), zoom: cam.zoom, target: controls.target.clone() };
      try {
        cam.up.set(0, 0, -1); cam.position.set(x, city!.n, z); cam.zoom = 1; cam.lookAt(x, 0, z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        const [sx, sy] = screenOf(new THREE.Vector3(x, 0, z)); return pickAt(sx, sy);
      } finally { cam.up.copy(saved.up); cam.position.copy(saved.pos); cam.zoom = saved.zoom; cam.lookAt(saved.target); controls.target.copy(saved.target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(); }
    },
    kindColorsOf: (k: number, lv: number) => civic.colors(k, lv),
    // [id, k, x, z, 佔地, lv, v, 地面高]；地面高＝佔地裡最高的格頂（高地 +0.4），高度守衛要扣掉
    buildingList: () => liveBuildings(city!).map(b => { let y0 = 0; for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) if (b.x + dx < city!.n && b.z + dz < city!.n) y0 = Math.max(y0, tileTop(city!, (b.z + dz) * city!.n + b.x + dx)); return [b.id, b.k, b.x, b.z, b.size, b.lv, b.v, y0]; }),
    heightOf: (k: number, lv: number, v: number) => KINDS.height(k, lv, v),
    // D006：地面貼圖（RGB，base64）與城市圖層，給煙霧測試在 Node 端逐像素驗
    groundData: () => { const g = built!.groundData(), rgb = new Uint8Array(g.W * g.W * 3); for (let i = 0, j = 0; i < g.rgba.length; i += 4, j += 3) { rgb[j] = g.rgba[i]; rgb[j + 1] = g.rgba[i + 1]; rgb[j + 2] = g.rgba[i + 2]; }
      let bin = ''; for (let i = 0; i < rgb.length; i += 0x8000) bin += String.fromCharCode(...rgb.subarray(i, i + 0x8000)); return { S: g.S, W: g.W, rgb: btoa(bin) }; },
    layers: () => { const c = city!, a = (x: ArrayLike<number>) => Array.from(x); return { n: c.n, road: a(c.road), rclass: a(c.rclass), ter: a(c.ter), el: a(c.el), zone: a(c.zone), tree: a(c.tree), rail: a(c.rail), dock: a(c.dock), tram: a(c.tram), occ: a(c.occ) }; },
    tone: () => tone,
    atlasCheck: () => { const w = windowTexture(), a = windowAtlas(), r = atlasCell0MatchesD003(w, a); w.dispose(); a.dispose(); return r; },
    // ---- D004 ----
    blockMode: () => blockMode,
    setBlocks: (m: string | null) => { setBlocks(m && m in BLOCK_MODES ? m as BlockMode : null); return blockMode; },
    partition: () => labPartition(gridOf(city!), ARCHE).map(partRow),        // 瀏覽器裡跑同一份切分（煙霧測試拿去跟黃金樣本比）
    blockInfo: () => plan && built ? { mode: blockMode, n: city!.n, drawn: built.blocksDrawn(),
      plan: plan.map(b => [b.x, b.z, b.w, b.h, b.k, b.lv, b.v, b.from === 'fill' ? 1 : 0]) } : null,
    // 點街區中心（主體頂面）：要點到這個街區裡的建築、建築卡打得開。挑多格街區（A 檔全是 1×1 就挑 1×1），面積大到小、均勻取 count 個（決定性）。
    // 判定用正上方俯視點：斜視角下街區中心可能被前面較高的建築擋住，那時點到前面那棟才是對的（D004 首跑 20 個裡擋掉 1–4 個）；
    // 俯視時射線直直落在街區中心，驗的正是「點到街區 → 回到街區裡那一格的建築」。斜視角直接點中幾個另外回報（oblique）。
    blockPickTest(count: number) {
      if (!plan || !built || !city) return null;
      const c = city, drawn = built.blocksDrawn(), multi = drawn.filter(bi => plan![bi].w * plan![bi].h > 1);
      const pool = (multi.length ? multi : drawn).sort((a, b) => plan![b].w * plan![b].h - plan![a].w * plan![a].h || a - b);
      const pickN = pool.length <= count ? pool : Array.from({ length: count }, (_, j) => pool[Math.floor(j * pool.length / count)]);
      const hitsBlock = (bi: number, h: ReturnType<typeof pickAt>) => !!h && h.id > 0 && plan![bi].cells.includes(h.z * c.n + h.x) && h.id === c.occ[h.z * c.n + h.x];
      let oblique = 0;
      for (const bi of pickN) { const [sx, sy] = screenOf(built.blockAnchor(bi)!); if (hitsBlock(bi, pickAt(sx, sy))) oblique++; }
      const saved = { pos: cam.position.clone(), up: cam.up.clone(), zoom: cam.zoom, target: controls.target.clone() };
      const bad: string[] = [];
      try {
        for (const bi of pickN) {
          const bk = plan[bi], a = built.blockAnchor(bi)!;
          cam.up.set(0, 0, -1); cam.position.set(a.x, a.y + c.n, a.z); cam.zoom = 1; cam.lookAt(a.x, 0, a.z);
          cam.updateProjectionMatrix(); cam.updateMatrixWorld();
          const [sx, sy] = screenOf(a), h = pickAt(sx, sy), ok = hitsBlock(bi, h);
          const card = ok ? showTile(h!.x, h!.z) : null, b = ok ? c.buildings[h!.id - 1] : null;
          if (!ok || !card || !b || !card.title.startsWith(KINDS.name(b.k))) bad.push(`${bk.w}×${bk.h}@${bk.x},${bk.z}→${JSON.stringify(h)}`);
        }
      } finally {
        cam.up.copy(saved.up); cam.position.copy(saved.pos); cam.zoom = saved.zoom; cam.lookAt(saved.target); controls.target.copy(saved.target);
        cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        closeCard();
      }
      return { pool: pool.length, tested: pickN.length, multi: multi.length > 0, oblique, bad };
    },
    // D005：從正上方點前庭道具與屋頂設備（樹不擋點擊、不算），要回到那個街區裡的建築。每個有道具／設備的街區各點一件，最多 count 個街區
    dressPickTest(count: number) {
      if (!plan || !built || !city) return null;
      const c = city, bad: string[] = [], tested = { props: 0, kits: 0 };
      const saved = { pos: cam.position.clone(), up: cam.up.clone(), zoom: cam.zoom, target: controls.target.clone() };
      const topDown = (x: number, z: number) => {
        cam.up.set(0, 0, -1); cam.position.set(x, c.n, z); cam.zoom = 1; cam.lookAt(x, 0, z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
        const [sx, sy] = screenOf(new THREE.Vector3(x, 0, z)); return pickAt(sx, sy);
      };
      try {
        for (const bi of built.blocksDrawn()) {
          if (tested.props >= count && tested.kits >= count) break;
          const bk = plan[bi], r = recipeOf(bk), d = dressOf(bk);
          const X = (u: number) => bk.x + u * bk.w, Z = (v: number) => bk.z + v * bk.h;
          const targets: [string, number, number][] = [];
          const p = d.props.find(q => q.kind !== 'tree' && q.kind !== 'drive');
          if (p && tested.props < count) { targets.push(['道具 ' + p.kind, X(p.u), Z(p.v)]); tested.props++; }
          const k = d.kits[0];
          if (k && tested.kits < count) {
            const du = (r.box[1] - r.box[0]) * .035, dv = (r.box[3] - r.box[2]) * .035;
            const rb = k.on === 'ex' ? r.ex!.box : k.on === 'upper' ? r.upper!.box : k.on === 'deck' ? [r.box[0] + du, r.box[1] - du, r.box[2] + dv, r.box[3] - dv] : r.box;
            targets.push(['設備 ' + k.kind, X(rb[0] + (rb[1] - rb[0]) * k.u), Z(rb[2] + (rb[3] - rb[2]) * k.v)]); tested.kits++;
          }
          for (const [what, x, z] of targets) {
            const h = topDown(x, z), ok = !!h && h.block === bi && h.id > 0 && bk.cells.includes(h.z * c.n + h.x) && h.id === c.occ[h.z * c.n + h.x];
            if (!ok) bad.push(`${what}@${x.toFixed(2)},${z.toFixed(2)}（街區 ${bk.x},${bk.z}）→${JSON.stringify(h)}`);
          }
        }
      } finally {
        cam.up.copy(saved.up); cam.position.copy(saved.pos); cam.zoom = saved.zoom; cam.lookAt(saved.target); controls.target.copy(saved.target);
        cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      }
      return { ...tested, bad };
    },
    // D008：畫了英美立面或飾條的街區（B、C 檔）；A 檔回空陣列
    facadeBlocks: () => !plan || !built || blockMode === 'a' ? [] : built.blocksDrawn().flatMap(bi => {
      const bk = plan![bi], r = recipeOf(bk), f = facadeOf(bk), t = trimOf(bk);
      return f || t ? [{ bi, x: bk.x, z: bk.z, w: bk.w, h: bk.h, path: r.path, trim: t ? t.kind : null, units: f ? f.units.length : 0, parts: f ? f.parts.map(q => q.kind) : [] }] : [];
    }),
    // D008：從正上方點正面突出的小件（凸窗、兩層凸窗、門廊、石階），要回到那個街區裡的建築。每個街區各點一件，最多 count 個
    facadePickTest(count: number) {
      if (!plan || !built || !city || blockMode === 'a') return null;
      const c = city, bad: string[] = [], kinds: Record<string, number> = {};
      const saved = { pos: cam.position.clone(), up: cam.up.clone(), zoom: cam.zoom, target: controls.target.clone() };
      let tested = 0;
      try {
        for (const bi of built.blocksDrawn()) {
          if (tested >= count) break;
          const bk = plan[bi], f = facadeOf(bk);
          const p = f && f.parts.find(q => q.kind === 'bay' || q.kind === 'bay2' || q.kind === 'porch' || q.kind === 'stoop');
          if (!f || !p) continue;
          const r = recipeOf(bk), x = bk.x + (r.box[0] + p.u * (r.box[1] - r.box[0])) * bk.w, z = bk.z + r.box[3] * bk.h + .035;   // 正面（主體框 +z）外 0.035 格
          cam.up.set(0, 0, -1); cam.position.set(x, c.n, z); cam.zoom = 1; cam.lookAt(x, 0, z); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
          const [sx, sy] = screenOf(new THREE.Vector3(x, 0, z)), h = pickAt(sx, sy);
          const ok = !!h && h.block === bi && h.id > 0 && bk.cells.includes(h.z * c.n + h.x) && h.id === c.occ[h.z * c.n + h.x];
          if (!ok) bad.push(`${p.kind}@${x.toFixed(2)},${z.toFixed(2)}（街區 ${bk.x},${bk.z}）→${JSON.stringify(h)}`);
          kinds[p.kind] = (kinds[p.kind] ?? 0) + 1; tested++;
        }
      } finally {
        cam.up.copy(saved.up); cam.position.copy(saved.pos); cam.zoom = saved.zoom; cam.lookAt(saved.target); controls.target.copy(saved.target);
        cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      }
      return { tested, kinds, bad };
    },
    spin: (rad: number) => { controls.rotateLeft?.(rad); invalidate(); },
    // D007 逐種對照：鏡頭對準某一棟（佔地中心），縮放照給的值，當場畫一幀；回傳建築半高那一點在螢幕上的位置（對照小圖以它為中心裁）
    focusBuilding(id: number, zoom: number) {
      const b = city!.buildings[id - 1], a = built!.anchorOf(id);
      if (!b || !a) return null;
      const n = city!.n, target = new THREE.Vector3(b.x + b.size / 2, 0, b.z + b.size / 2), D = n * 1.6;
      cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
      cam.zoom = zoom; cam.lookAt(target); controls.target.copy(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      needsRender = true; draw();
      return screenOf(a);
    },
    // D008 逐型對照：鏡頭對準某個街區（佔地中心），同 focusBuilding；回傳街區錨點（主體頂面中心）在螢幕上的位置
    // clip：只留目標前方 clip 格以內（把鏡頭前面擋住的高樓切掉，檢查立面用；不給就還原近平面）
    focusBlock(bi: number, zoom: number, clip = 0) {
      const bk = plan?.[bi], a = built?.blockAnchor(bi);
      if (!bk || !a) return null;
      const n = city!.n, target = new THREE.Vector3(bk.x + bk.w / 2, 0, bk.z + bk.h / 2), D = n * 1.6;
      cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
      cam.near = clip > 0 ? cam.position.distanceTo(target) - clip : 0.1;
      cam.zoom = zoom; cam.lookAt(target); controls.target.copy(target); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
      needsRender = true; draw();
      return screenOf(a);
    },
    renderInfo: () => ({ ...pipe.sceneInfo, rt: pipe.size }),
  };
}

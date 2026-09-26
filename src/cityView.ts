// 2D 城市模式（D003）：把 2D 實驗線的分享碼解碼成城市，畫成 3D。預設開種子城。
// 網址參數：?mode=city（預設）&sample=seed516|ai120 &style=A|B|C（對照用）&at=x,z|center &zoom= &clean=1（拍照，藏介面）
//           &blocks=a|b|c|off（D004 住商工街區三檔；D005 起不帶＝B 照實驗線，off＝D003 現況）
//           &sample=starter（D010 起步城：逐日模擬，播放／暫停、三檔速度；載入時不自動播放）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { decodeLabCode } from './io/labcode.ts';
import { cityFromLab, cityStats, buildingAt, type City, type GrowEvent, type ImportEvent } from './sim/city.ts';
import { simFromSave, stepDay, simHash, simCounts, type Sim } from './sim/day.ts';
import { buildCityScene, tileTop, TONES, sortKeys, type BuiltCity, type BlockRender, type CivicRender, type Tone } from './render/cityScene.ts';
import { LOOKS } from './content/looks.ts';
import { shapeOf, kindColors } from './content/kindShapes.ts';
import { Pipeline } from './render/post.ts';
import { STYLES, type Style } from './render/styles.ts';
import { KINDS } from './content/kinds.ts';
import { ARCHE } from './content/arche.ts';
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
import { vrank as VRANK } from './content/samples/d009-live.json';   // 實驗線執行期的變體排名（D009 抽出，commit 記在同一個檔）

// 兩個樣本碼都是 tools/lab-extract.mjs 從 2D 實驗線 d23c18d（v13.43）產生的，出處與對帳數字在 src/content/samples/*.json
const SAMPLES: Record<string, { label: string; code: string }> = {
  seed516: { label: '種子城', code: seed516 },
  ai120: { label: 'AI 城 120 天', code: ai120 },
  gallery: { label: '全種類', code: gallery },   // D007：住商工以外 183 種各一棟（實驗線自己匯入讀回過）
  starter: { label: '起步城', code: starter },   // D010：種子城地形上的起步佈局，會自己長（實驗線自己匯入讀回過）
};
const SIM_SAMPLES = new Set(['starter']);
const SPEEDS = [1, 3, 10];          // 每秒幾天
const REBUILD_DAYS = 5;             // 播放中每隔幾天重建一次場景（有新建築或升級才重建；暫停時也重建）
const TER = ['水面', '沙地', '草地'], ROAD = ['', '道路', '橋', '高速公路', '高速公路橋'], ZONE = ['', '住宅區', '商業區', '工業區'];

export function startCity() {
  const q = new URLSearchParams(location.search);
  const clean = q.get('clean') === '1';
  const style: Style = STYLES[(q.get('style') as Style['id']) ?? 'A'] ?? STYLES.A;
  let sampleId = SAMPLES[q.get('sample') ?? ''] ? q.get('sample')! : 'seed516';
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
  const timing: Record<string, number> = {};
  const invalidate = () => { needsRender = true; };

  // 斜 45° 正交鏡頭、仰角 30°（同 300 年示範，也等於 2D 實驗線的 2:1 斜俯視，見 D003 卡）
  function frameCamera(n: number, first: boolean) {
    const at = (first ? q.get('at') ?? '' : '').split(',').map(Number);
    const focus = sim ? zoneCenter(city!) : null;   // D010：起步城對準分區中心
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
  function load(code: string, name: string, first = false, simulate = false): { ok: true } | { ok: false; error: string } {
    const t0 = performance.now();
    const r = decodeLabCode(code);
    const t1 = performance.now();
    if (!r.ok) return r;
    dirtyScene = false;                                                   // 舊城的場景馬上要丟掉，不必先重建
    setPlaying(false);
    sim = simulate ? simFromSave(r.save, code, KINDS, VRANK) : null;   // D010：模擬的城市就是畫面的城市（同一個物件，逐日同步）
    const c = sim ? sim.city : cityFromLab(r.save, KINDS, code);
    daysSinceBuild = 0; dirtyScene = false; rebuilds = 0; simAcc = 0;
    const t2 = performance.now();
    const br = blockRenderFor(c);
    const tp = performance.now();
    const b = buildCityScene(c, KINDS, style, br, tone, br ? civic : undefined);
    const t3 = performance.now();
    built?.dispose();
    city = c; built = b; label = name;
    delete timing.rebuild;
    Object.assign(timing, { decode: t1 - t0, city: t2 - t1, plan: tp - t2, scene: t3 - t2, total: t3 - t0 }, b.timing);
    frameCamera(c.n, first);
    closeCard();
    syncUi();
    return { ok: true };
  }
  // D004：換街區檔位，只重建場景（鏡頭不動）
  function setBlocks(m: BlockMode | null) {
    if (!city) return;
    blockMode = m;
    const t0 = performance.now(), br = blockRenderFor(city), tp = performance.now(), b = buildCityScene(city, KINDS, style, br, tone, br ? civic : undefined), t1 = performance.now();
    built?.dispose();
    built = b;
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
    Object.assign(timing, { plan: tp - t0, scene: t1 - t0, rebuild: t1 - t0 }, b.timing);
    rebuilds++; daysSinceBuild = 0; dirtyScene = false;
    if (!bio.hidden && cardAt) showTile(cardAt[0], cardAt[1]);          // 卡片開著：用新的城市與街區重寫一次（等級、街區、框都可能變了）
    invalidate();
  }
  function simDay() {
    const rep = stepDay(sim!);
    if (rep.grown || rep.upgraded) dirtyScene = true;
    daysSinceBuild++;
    return rep;
  }
  function setPlaying(on: boolean) {
    playing = on && !!sim; lastT = 0; simAcc = 0;
    if (!playing && dirtyScene) rebuildScene();
    syncSim();
  }
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

  // ---- 介面 ----
  const ui = document.createElement('div');
  ui.innerHTML = `
    <div id="top"><h1>微光小鎮 3D・2D 實驗線的城市</h1><p class="meta"></p>
      <div class="row" id="picks"></div><div class="row chips" id="blk" style="margin-top:6px"></div></div>
    <div id="timeline" hidden><div class="row"><button id="play" aria-label="播放">▶</button><span id="ylabel"></span>
      <div class="row chips" id="spd"></div><span class="hint">逐日模擬：公式照 2D 實驗線（D009），上層系統先接回退值（D010）</span></div>
      <p class="meta" id="simstat" style="margin:4px 0 0;font-size:12px;color:#d6dbe6"></p></div>
    <div id="bio" hidden><button class="x" aria-label="關閉">✕</button><h2></h2><p class="sub"></p><ol></ol></div>
    <div id="dlg" hidden><div class="card"><h2>貼上 2D 實驗線的分享碼</h2>
      <p class="sub">在 2D 實驗線匯出的整串分享碼（可以帶 GVX1: 前綴）。只在這一頁看，不會寫回任何存檔。</p>
      <textarea spellcheck="false" autocomplete="off" placeholder="eyJ2IjoxLC…"></textarea><p class="err"></p>
      <div class="row"><button id="dlgOk">匯入</button><button id="dlgNo">取消</button></div></div></div>`;
  if (!clean) document.body.appendChild(ui);
  const $ = <T extends Element>(s: string) => ui.querySelector(s) as T;
  const metaEl = $('.meta'), picks = $('#picks'), bio = $<HTMLElement>('#bio'), dlg = $<HTMLElement>('#dlg'), ta = $<HTMLTextAreaElement>('#dlg textarea'), err = $('#dlg .err');
  for (const [id, s] of Object.entries(SAMPLES)) {
    const b = document.createElement('button'); b.textContent = s.label; b.dataset.s = id;
    b.onclick = () => { sampleId = id; load(s.code, s.label, false, SIM_SAMPLES.has(id)); }; picks.appendChild(b);
  }
  const paste = document.createElement('button'); paste.textContent = '📋 貼上分享碼';
  paste.onclick = () => { err.textContent = ''; dlg.hidden = false; ta.focus(); }; picks.appendChild(paste);
  const toHist = document.createElement('button'); toHist.textContent = '⏳ 300 年示範';
  toHist.onclick = () => { location.search = '?mode=history'; }; picks.appendChild(toHist);
  // D004 住商工街區三檔（業主挑）：現況＝D003
  const blk = $('#blk');
  for (const [m, name] of [['', 'D003 現況'], ...Object.entries(BLOCK_MODES).map(([k, v]) => [k, `${k.toUpperCase()} ${v}`])]) {
    const b = document.createElement('button'); b.textContent = name; b.dataset.m = m;
    b.onclick = () => setBlocks((m || null) as BlockMode | null); blk.appendChild(b);
  }
  $<HTMLButtonElement>('#dlgNo').onclick = () => { dlg.hidden = true; };
  $<HTMLButtonElement>('#dlgOk').onclick = () => {
    const r = load(ta.value, '貼上的城市');
    if (r.ok) { sampleId = ''; dlg.hidden = true; ta.value = ''; } else err.textContent = r.error;
  };
  $<HTMLButtonElement>('#bio .x').onclick = () => closeCard();
  // D010 播放列
  const bar = $<HTMLElement>('#timeline'), playBtn = $<HTMLButtonElement>('#play'), dayLbl = $('#ylabel'), spd = $('#spd'), simStat = $('#simstat');
  playBtn.onclick = () => setPlaying(!playing);
  SPEEDS.forEach((v, k) => { const b = document.createElement('button'); b.textContent = `${v} 天／秒`; b.dataset.k = String(k); b.onclick = () => { speed = k; syncSim(); }; spd.appendChild(b); });
  function syncSim() {
    bar.hidden = !sim;
    if (!sim) return;
    playBtn.textContent = playing ? '⏸' : '▶'; playBtn.setAttribute('aria-label', playing ? '暫停' : '播放');
    spd.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.k === String(speed)));
    const c = simCounts(sim);
    dayLbl.textContent = `第 ${sim.day} 天`;
    simStat.textContent = `人口 ${sim.pop}・就業 ${sim.jobs}・住 ${c[1][0]}／商 ${c[2][0]}／工 ${c[3][0]} 棟（二級 ${c[1][2] + c[2][2] + c[3][2]}）・幸福 ${sim.cityHappy.toFixed(2)}・需求 住 ${sim.dem[1].toFixed(2)} 商 ${sim.dem[2].toFixed(2)} 工 ${sim.dem[3].toFixed(2)}`;
  }

  function syncUi() {
    if (!city) return;
    const kinds = new Set(city.buildings.map(b => b.k)).size;
    metaEl.textContent = `${label}「${city.name}」・實驗線 v${city.gameVer}・第 ${city.day.toLocaleString()} 天・建築 ${city.buildings.length}（${kinds} 種）・${city.n}×${city.n}`;
    picks.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.s === sampleId));
    blk.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.m === (blockMode ?? '')));
    syncSim();
  }
  // 分區格的中心（D010 起步城開場對準它）
  function zoneCenter(c: City): [number, number] | null {
    let sx = 0, sz = 0, k = 0;
    for (let i = 0; i < c.n * c.n; i++) if (c.zone[i]) { sx += i % c.n + .5; sz += ((i / c.n) | 0) + .5; k++; }
    return k ? [sx / k, sz / k] : null;
  }
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
      // D010：逐日模擬記下的生長、升級；匯入的建築先列 2D 存檔推算的蓋起日（屋齡取匯入當時的，b.age 會跟著模擬長）
      const evs = c.history.filter((e): e is GrowEvent => e.t !== 'import' && e.x === b.x && e.z === b.z);
      if (!evs.some(e => e.t === 'grow')) rows.push(`<b>約第 ${Math.max(0, b.builtDay).toLocaleString()} 天</b>蓋起（由 2D 存檔的 age=${impDay - b.builtDay} 推算，只是估計）`);
      for (const e of evs) rows.push(e.t === 'grow' ? `<b>第 ${e.day} 天</b>長出來（逐日模擬，${e.lv} 級）` : `<b>第 ${e.day} 天</b>升到 ${e.lv} 級`);
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
  let down: { x: number; y: number; t: number } | null = null;
  renderer.domElement.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down) return;
    const tap = Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6 && performance.now() - down.t < 400;
    down = null;
    if (!tap) return;
    const h = pickAt(e.clientX, e.clientY);
    if (h) showTile(h.x, h.z);
  });

  const first = load(SAMPLES[sampleId].code, SAMPLES[sampleId].label, true, SIM_SAMPLES.has(sampleId));
  if (!first.ok) throw new Error('樣本碼解不開：' + first.error);

  // ---- 給煙霧測試與拍照工具的出口（純讀取；不改城市）----
  const screenOf = (v: THREE.Vector3) => { const p = v.clone().project(cam); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight]; };
  (window as unknown as { __gt: unknown }).__gt = {
    ready: true, mode: 'city',
    get sample() { return sampleId; },
    webgl2: renderer.capabilities.isWebGL2,
    stats: () => cityStats(city!),
    issues: () => city!.issues,
    history: () => city!.history,
    timing: () => ({ ...timing }),
    owners: () => built!.owners(),
    buildingCount: () => city!.buildings.length,
    kinds: () => ({ count: KINDS.data.kinds.length, source: KINDS.data.source.commit }),
    tryCode: (code: string) => { const r = decodeLabCode(code); return r.ok ? { ok: true, n: r.save.n, buildings: r.save.bl.length } : r; },
    loadCode: (code: string) => load(code, '貼上的城市'),
    loadSample: (id: string) => { sampleId = id; return load(SAMPLES[id].code, SAMPLES[id].label, false, SIM_SAMPLES.has(id)); },
    // ---- D010 逐日模擬 ----
    sim: () => sim ? { day: sim.day, seed: sim.seed, pop: sim.pop, jobs: sim.jobs, happy: sim.cityHappy, dem: [sim.dem[1], sim.dem[2], sim.dem[3]], rci: simCounts(sim), hash: simHash(sim),
      events: sim.city.history.length, rebuilds, playing, speed: SPEEDS[speed], buildings: sim.city.buildings.length } : null,
    // 同步推 n 天、最後重建一次並當場畫一幀（守衛與拍照用）；回傳推完的狀態
    simStep(n: number) { if (!sim) return null; for (let i = 0; i < n; i++) simDay(); if (dirtyScene) rebuildScene(); syncUi(); needsRender = true; draw(); lastT = 0; return (window as unknown as { __gt: { sim(): unknown } }).__gt.sim(); },
    simPlay: (on: boolean) => { setPlaying(on); return playing; },
    simSpeed: (k: number) => { speed = Math.max(0, Math.min(SPEEDS.length - 1, k | 0)); syncSim(); return SPEEDS[speed]; },
    // 重建一次場景（不推天數），回傳這次重建的耗時（ms）
    simRebuild() { rebuildScene(); needsRender = true; draw(); lastT = 0; return timing.rebuild; },
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
    bigOne: () => [...city!.buildings].sort((a, b) => b.size - a.size || KINDS.height(b.k, b.lv, b.v) - KINDS.height(a.k, a.lv, a.v) || a.id - b.id)[0].id,
    idOfKind: (k: number) => city!.buildings.find(b => b.k === k)?.id ?? null,
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
    buildingList: () => city!.buildings.map(b => { let y0 = 0; for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) if (b.x + dx < city!.n && b.z + dz < city!.n) y0 = Math.max(y0, tileTop(city!, (b.z + dz) * city!.n + b.x + dx)); return [b.id, b.k, b.x, b.z, b.size, b.lv, b.v, y0]; }),
    heightOf: (k: number, lv: number, v: number) => KINDS.height(k, lv, v),
    // D006：地面貼圖（RGB，base64）與城市圖層，給煙霧測試在 Node 端逐像素驗
    groundData: () => { const g = built!.groundData(), rgb = new Uint8Array(g.W * g.W * 3); for (let i = 0, j = 0; i < g.rgba.length; i += 4, j += 3) { rgb[j] = g.rgba[i]; rgb[j + 1] = g.rgba[i + 1]; rgb[j + 2] = g.rgba[i + 2]; }
      let bin = ''; for (let i = 0; i < rgb.length; i += 0x8000) bin += String.fromCharCode(...rgb.subarray(i, i + 0x8000)); return { S: g.S, W: g.W, rgb: btoa(bin) }; },
    layers: () => { const c = city!, a = (x: ArrayLike<number>) => Array.from(x); return { n: c.n, road: a(c.road), rclass: a(c.rclass), ter: a(c.ter), el: a(c.el), zone: a(c.zone), rail: a(c.rail), dock: a(c.dock), tram: a(c.tram), occ: a(c.occ) }; },
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

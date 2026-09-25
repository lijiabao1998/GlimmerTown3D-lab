// 2D 城市模式（D003）：把 2D 實驗線的分享碼解碼成城市，畫成 3D。預設開種子城。
// 網址參數：?mode=city（預設）&sample=seed516|ai120 &style=A|B|C（對照用）&at=x,z|center &zoom= &clean=1（拍照，藏介面）
//           &blocks=a|b|c|off（D004 住商工街區三檔；D005 起不帶＝B 照實驗線，off＝D003 現況）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { decodeLabCode } from './io/labcode.ts';
import { cityFromLab, cityStats, buildingAt, type City } from './sim/city.ts';
import { buildCityScene, tileTop, TONES, type BuiltCity, type BlockRender, type Tone } from './render/cityScene.ts';
import { Pipeline } from './render/post.ts';
import { STYLES, type Style } from './render/styles.ts';
import { KINDS } from './content/kinds.ts';
import { ARCHE } from './content/arche.ts';
import { gridOf, labPartition, partRow, drawPlan, BLOCK_MODES, type BlockMode, type DrawBlock } from './content/blocks.ts';
import { recipe, type Recipe } from './content/recipes.ts';
import { dressing, type Dressing } from './content/dressing.ts';
import { windowTexture } from './render/textures.ts';
import { windowAtlas, atlasCell0MatchesD003 } from './render/windows.ts';
import seed516 from './content/samples/seed516.code.txt?raw';
import ai120 from './content/samples/ai120.code.txt?raw';

// 兩個樣本碼都是 tools/lab-extract.mjs 從 2D 實驗線 d23c18d（v13.43）產生的，出處與對帳數字在 src/content/samples/*.json
const SAMPLES: Record<string, { label: string; code: string }> = {
  seed516: { label: '種子城', code: seed516 },
  ai120: { label: 'AI 城 120 天', code: ai120 },
};
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
  let plan: DrawBlock[] | null = null;
  const blockRenderFor = (c: City): BlockRender | undefined => {
    if (!blockMode) { plan = null; return undefined; }
    plan = drawPlan(gridOf(c), ARCHE, blockMode);
    return { mode: blockMode, plan, recipe: recipeOf, dress: dressOf };
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
  const timing: Record<string, number> = {};
  const invalidate = () => { needsRender = true; };

  // 斜 45° 正交鏡頭、仰角 30°（同 300 年示範，也等於 2D 實驗線的 2:1 斜俯視，見 D003 卡）
  function frameCamera(n: number, first: boolean) {
    const at = (first ? q.get('at') ?? '' : '').split(',').map(Number);
    const target = at.length === 2 && at.every(Number.isFinite) ? new THREE.Vector3(at[0] + 0.5, 0, at[1] + 0.5) : new THREE.Vector3(n / 2, 0, n / 2);
    const D = n * 1.6;
    cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
    cam.far = n * 6;
    cam.zoom = first ? Number(q.get('zoom') ?? 1) || 1 : 1;
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
  function load(code: string, name: string, first = false): { ok: true } | { ok: false; error: string } {
    const t0 = performance.now();
    const r = decodeLabCode(code);
    const t1 = performance.now();
    if (!r.ok) return r;
    const c = cityFromLab(r.save, KINDS, code);
    const t2 = performance.now();
    const br = blockRenderFor(c);
    const tp = performance.now();
    const b = buildCityScene(c, KINDS, style, br, tone);
    const t3 = performance.now();
    built?.dispose();
    city = c; built = b; label = name;
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
    const t0 = performance.now(), br = blockRenderFor(city), tp = performance.now(), b = buildCityScene(city, KINDS, style, br, tone), t1 = performance.now();
    built?.dispose();
    built = b;
    Object.assign(timing, { plan: tp - t0, scene: t1 - t0 }, b.timing);
    const u = new URL(location.href);
    if (m && m !== 'b') u.searchParams.set('blocks', m); else if (m) u.searchParams.delete('blocks'); else u.searchParams.set('blocks', 'off');
    history.replaceState(null, '', u);
    closeCard();
    syncUi();
  }

  function frame() {
    if (controls.update()) needsRender = true;
    if (!needsRender || !built) return;
    needsRender = false;
    frames++;
    pipe.render(renderer, built.scene, cam, style, innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
  }
  renderer.setAnimationLoop(frame);

  // ---- 介面 ----
  const ui = document.createElement('div');
  ui.innerHTML = `
    <div id="top"><h1>微光小鎮 3D・2D 實驗線的城市</h1><p class="meta"></p>
      <div class="row" id="picks"></div><div class="row chips" id="blk" style="margin-top:6px"></div></div>
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
    b.onclick = () => { sampleId = id; load(s.code, s.label); }; picks.appendChild(b);
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

  function syncUi() {
    if (!city) return;
    const kinds = new Set(city.buildings.map(b => b.k)).size;
    metaEl.textContent = `${label}「${city.name}」・實驗線 v${city.gameVer}・第 ${city.day.toLocaleString()} 天・建築 ${city.buildings.length}（${kinds} 種）・${city.n}×${city.n}`;
    picks.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.s === sampleId));
    blk.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.m === (blockMode ?? '')));
  }
  // 這一格在目前檔位屬於哪個街區（plan 的索引；-1＝沒畫）
  const blockOfCell = (i: number) => {
    if (!plan || !built) return -1;
    const drawn = new Set(built.blocksDrawn());
    return plan.findIndex((b, bi) => drawn.has(bi) && b.cells.includes(i));
  };

  // ---- 點一格：有建築就看建築，沒有就看這一格是什麼 ----
  const marker = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.04, 1)), new THREE.LineBasicMaterial({ color: 0xffd34d }));
  function closeCard() { bio.hidden = true; marker.removeFromParent(); invalidate(); }
  function showTile(x: number, z: number) {
    if (!city || !built) return null;
    const c = city, i = z * c.n + x, b = buildingAt(c, x, z);
    const rows: string[] = [];
    let title: string;
    if (b) {
      const cat = KINDS.cat(b.k);
      title = `${KINDS.name(b.k)}（${b.x}, ${b.z}）`;
      $('#bio .sub').textContent = `${KINDS.catName(cat)}・${b.lv} 級・佔地 ${b.size}×${b.size}${b.abandoned ? '・已遭遺棄' : ''}`;
      rows.push(`<b>約第 ${Math.max(0, b.builtDay).toLocaleString()} 天</b>蓋起（由 2D 存檔的 age=${b.age} 推算，只是估計）`);
      if (!KINDS.known(b.k)) rows.push('<b>注意</b>本線的種類表沒有這一種，用預設量體畫');
      if (plan && blockMode && b.k >= 1 && b.k <= 3) {
        const bi = blockOfCell(i);
        if (bi >= 0) {
          const bk = plan[bi], r = recipeOf(bk);
          rows.push(`<b>街區 ${bk.w}×${bk.h}</b>${blockMode.toUpperCase()} 檔・原型 ${r.arche}${r.path === 'core' ? '' : `（${r.path} 立面）`}・起點 (${bk.x}, ${bk.z})・畫法用起點的 ${bk.lv} 級`);
        } else rows.push(`<b>這一格沒畫</b>實驗線的切分沒有街區蓋到這格（D0），或被旁邊的大街區吸收（T555）`);
      }
      rows.push(`<b>第 ${c.day.toLocaleString()} 天</b>從 2D 實驗線 v${c.gameVer} 匯入 3D（這之前的歷史 2D 存檔沒有記）`);
    } else {
      title = `${ROAD[c.road[i]] || ZONE[c.zone[i]] || TER[c.ter[i]] || '地塊'}（${x}, ${z}）`;
      const bits = [TER[c.ter[i]], c.el[i] ? '高地' : '', ZONE[c.zone[i]] ? ZONE[c.zone[i]] + '（還沒蓋）' : '', c.tree[i] ? '有樹' : '', c.rail[i] ? '鐵路' : '', c.fly[i] ? '高架' : ''].filter(Boolean);
      $('#bio .sub').textContent = bits.join('・');
      rows.push(`<b>第 ${c.day.toLocaleString()} 天</b>從 2D 實驗線 v${c.gameVer} 匯入 3D`);
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

  const first = load(SAMPLES[sampleId].code, SAMPLES[sampleId].label, true);
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
    loadSample: (id: string) => { sampleId = id; return load(SAMPLES[id].code, SAMPLES[id].label); },
    // 投影一棟建築量體的中心到螢幕，再模擬點擊：回報點到的格子與建築
    pickTest(id: number) {
      const b = city!.buildings[id - 1], a = built!.anchorOf(id);
      if (!b || !a) return null;
      const [sx, sy] = screenOf(a);
      const h = pickAt(sx, sy);
      return { want: [b.x, b.z, id], got: h, name: KINDS.name(b.k) };
    },
    openTile: (x: number, z: number) => showTile(x, z),
    // 挑一棟當點擊測試的目標：佔地最大、同佔地取最高、再取編號最小（決定性）
    bigOne: () => [...city!.buildings].sort((a, b) => b.size - a.size || KINDS.height(b.k, b.lv, b.v) - KINDS.height(a.k, a.lv, a.v) || a.id - b.id)[0].id,
    idOfKind: (k: number) => city!.buildings.find(b => b.k === k)?.id ?? null,
    frames: () => frames,
    // ---- D005 ----
    artCounts: () => built!.artCounts(),
    // 擺放計畫的合計（畫出來的街區）：要等於 artCounts（每一件都真的畫了）
    dressTotals: () => {
      const t = { props: 0, edges: 0, kits: 0, awnings: 0, doors: 0, docks: 0, shopBands: 0, plainBands: 0 };
      if (!plan || !built) return t;
      for (const bi of built.blocksDrawn()) {
        const d = dressOf(plan[bi]);
        t.props += d.props.length; t.edges += d.edges.length; t.kits += d.kits.length; t.awnings += d.awnings.length;
        t.doors += d.doors.length; t.docks += d.dock === null ? 0 : 1; t.shopBands += d.shopPx > 0 ? 1 : 0;
        t.plainBands += d.dock === null ? 0 : 1;   // 工業核心街區（有裝卸口的）牆下 45% 不開窗
      }
      return t;
    },
    groundAt: (x: number, z: number) => built!.groundAt(x, z),
    wallStyles: () => built!.wallStyles(),
    meshStats: () => built!.meshStats(),
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
    spin: (rad: number) => { controls.rotateLeft?.(rad); invalidate(); },
    renderInfo: () => ({ ...pipe.sceneInfo, rt: pipe.size }),
  };
}

// 300 年示範（D001／D002）：同一座城 300 年。底部時間軸可播放／拖動；點任何一格看它的履歷。畫風定案 A（D002 業主決定）。
// D003 起改由 ?mode=history 進入（預設是 2D 城市模式）；本檔只是把原本的 main.ts 包進 startHistory()，程式本體沒改。
// 網址參數：?year=0..300 &seed=數字 &style=A|B|C（對照用）&styles=1（顯示畫風切換）&at=x,z|center &zoom= &clean=1（拍照，藏介面）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { generateWorld, stateAt, stats, historyHash, lotHistory, GROW_END, END, type LotEntry, type Kind, type Era, type CityState } from './sim/history.ts';
import { buildScene, type Built, type Hit } from './render/scene.ts';
import { Pipeline } from './render/post.ts';
import { STYLES, type Style } from './render/styles.ts';

export function startHistory() {

  const q = new URLSearchParams(location.search);
  // 預設種子 5162026 搬自 2D 實驗線（lijiabao1998/GlimmerTown-lab 的 gallery.js／probe-civic.js 用 metroArtSeedWorld516(5162026) 拍樣張）。
  // 只借了這個數字：本線的世界生成與 2D 無關，同一個種子在兩條線長出的城市不同。
  const seed = Number(q.get('seed') ?? 5162026) >>> 0;
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
  let year = clamp(Math.round(Number(q.get('year') ?? GROW_END)) || 0, 0, END);
  let style: Style = STYLES[(q.get('style') as Style['id']) ?? 'A'] ?? STYLES.A;
  const clean = q.get('clean') === '1', showStyles = q.get('styles') === '1';

  const world = generateWorld(seed);
  const hash = historyHash(world);
  const N = world.size;

  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);
  const pipe = new Pipeline();

  // 斜 45° 正交鏡頭；仰角 30°（接近 2D 版 2:1 等角）
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, N * 6);
  const at = (q.get('at') ?? '').split(',').map(Number);
  const target = at.length === 2 && at.every(Number.isFinite) ? new THREE.Vector3(at[0] + 0.5, 0, at[1] + 0.5)
    : q.get('at') === 'center' ? new THREE.Vector3(world.center[0] + 0.5, 0, world.center[1] + 0.5) : new THREE.Vector3(N / 2, 0, N / 2);
  const D = N * 1.6;
  cam.position.set(target.x + D, D * Math.SQRT2 * Math.tan(Math.PI / 6), target.z + D);
  cam.zoom = Number(q.get('zoom') ?? 1) || 1;
  cam.lookAt(target);
  const controls = new OrbitControls(cam, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.42;
  controls.minZoom = 0.6; controls.maxZoom = 6;
  controls.screenSpacePanning = true;

  // ---- 場景：年份一變就重建（同一幀內多次變動只建一次）----
  let built: Built | null = null, dirty = true;
  const rebuildMs: number[] = [];
  const marker = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.04, 1)), new THREE.LineBasicMaterial({ color: 0xffd34d }));
  marker.visible = false;
  // 同一年的城市狀態只推一次：重建、統計、履歷卡共用（曾每次重建推三次＋全表掃履歷，重建從 7ms 退到 57ms）
  let cur: { year: number; s: CityState } | null = null;
  const stateNow = () => (cur && cur.year === year ? cur.s : (cur = { year, s: stateAt(world, year) }).s);
  function rebuild() {
    const t0 = performance.now();
    built?.dispose();
    renderer.shadowMap.type = style.softShadow ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
    renderer.shadowMap.needsUpdate = true;
    const tS = performance.now();
    const s = stateNow();
    const tB = performance.now();
    built = buildScene(s, style);
    built.scene.add(marker);
    const tU = performance.now();
    dirty = false;
    syncUi();
    const tE = performance.now();
    rebuildMs.push(tE - t0);
    rebuildParts.push({ dispose: tS - t0, state: tB - tS, build: tU - tB, ui: tE - tU, ...built.timing });
  }
  const rebuildParts: Record<string, number>[] = [];
  const setYear = (y: number) => { year = clamp(Math.round(y), 0, END); dirty = true; };

  function resize() {
    const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h);
    const half = N * 0.42, asp = w / h;
    cam.left = -half * asp; cam.right = half * asp; cam.top = half; cam.bottom = -half;
    cam.updateProjectionMatrix();
  }
  addEventListener('resize', () => { resize(); invalidate(); });

  // ---- 播放：約每 0.11 秒一年，0→300 約 33 秒 ----
  let playing = false, acc = 0, last = performance.now();
  const PLAY_STEP = 110;
  // 只在需要時才重畫：鏡頭在動、年份變了、選取框變了、視窗變了。畫面靜止時不畫——手機省電不發燙（CLAUDE.md 規則 5）
  let needsRender = true;
  const invalidate = () => { needsRender = true; };
  function frame() {
    const now = performance.now(), dt = now - last; last = now;
    if (playing) {
      acc += dt;
      while (acc >= PLAY_STEP) { acc -= PLAY_STEP; if (year >= END) { playing = false; break; } setYear(year + 1); }
    }
    if (dirty) { rebuild(); needsRender = true; }
    if (controls.update()) needsRender = true;   // 有慣性的拖動結束前都會回 true
    if (!needsRender || !built) return;
    needsRender = false;
    frames++;
    pipe.render(renderer, built.scene, cam, style, innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
  }
  let frames = 0;
  renderer.setAnimationLoop(frame);

  // ---- 文字：地塊履歷由結構化條目組句（模擬層不管字串）----
  const KIND: Record<Kind, string> = { R: '住宅', C: '商店', I: '工廠', chapel: '教堂', clock: '鐘樓', school: '學校', watertower: '水塔', plant: '發電廠' };
  const ERA: Record<Era, string> = { old: '紅磚尖頂', mid: '米色平頂', new: '玻璃帷幕' };
  const LAND: Kind[] = ['chapel', 'clock', 'school', 'watertower', 'plant'];
  function sentence(e: LotEntry): string {
    switch (e.t) {
      case 'road': return '鋪了路';
      case 'bridge': return '架起一座橋';
      case 'park': return '闢成公園';
      case 'tree': return e.y === 0 ? '這裡原本是樹林' : '長出一棵樹';
      case 'clear': return '樹被砍掉，整地';
      case 'overgrow': return '路面長滿了草';
      case 'build':
        if (LAND.includes(e.kind)) return `蓋起${KIND[e.kind]}`;
        return `${e.replaces ? '改建成' : '蓋起'}一棟${ERA[e.era]}的${KIND[e.kind]}（${e.lv} 層）`;
      case 'upgrade': return `${KIND[e.kind]}加蓋到 ${e.lv} 層`;
      case 'demolish': return `舊${KIND[e.kind]}被拆除`;
      case 'abandon': return `${KIND[e.kind]}遭到遺棄`;
      case 'roofless': return '屋頂塌陷';
      case 'collapse': return '整棟倒塌，只剩瓦礫';
    }
  }
  const eraOfYear = (y: number) => y < 25 ? '開拓期' : y < 55 ? '成長期' : y <= GROW_END ? '繁盛期' : y < 115 ? '停滯期' : y < 200 ? '衰退期' : '廢墟';

  // ---- 介面 ----
  const ui = document.createElement('div');
  ui.innerHTML = `
    <div id="top"><h1>微光小鎮 3D・同一座城的 300 年</h1><p class="meta"></p><div class="row" id="styles"><button id="toCity">🏙 2D 城市</button></div></div>
    <div id="bio" hidden><button class="x" aria-label="關閉">✕</button><h2></h2><p class="sub"></p><ol></ol></div>
    <div id="timeline">
      <div class="row"><button id="play" aria-label="播放">▶</button><span id="ylabel"></span><span class="hint">點建築或空地看它的履歷</span></div>
      <input id="yr" type="range" min="0" max="${END}" step="1" aria-label="年份">
      <div class="row chips"></div>
    </div>`;
  if (!clean) document.body.appendChild(ui);
  const $ = <T extends Element>(s: string) => ui.querySelector(s) as T;
  $<HTMLButtonElement>('#toCity').onclick = () => { location.search = '?mode=city'; };   // D003：回到 2D 城市模式
  const metaEl = $('.meta'), stylesEl = $('#styles'), bio = $<HTMLElement>('#bio'), slider = $<HTMLInputElement>('#yr'), playBtn = $<HTMLButtonElement>('#play'), ylabel = $('#ylabel');
  if (showStyles) for (const s of Object.values(STYLES)) { const b = document.createElement('button'); b.textContent = s.label; b.dataset.s = s.id; b.onclick = () => { style = s; dirty = true; }; stylesEl.appendChild(b); }
  for (const [y, label] of [[0, '開拓・0'], [GROW_END, '一生盡頭・80'], [END, '廢墟・300']] as [number, string][]) {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => { playing = false; setYear(y); }; $('.chips').appendChild(b);
  }
  slider.oninput = () => { playing = false; setYear(Number(slider.value)); };
  playBtn.onclick = () => { if (!playing && year >= END) setYear(0); playing = !playing; acc = 0; syncUi(); };
  $<HTMLButtonElement>('#bio .x').onclick = () => { bio.hidden = true; marker.visible = false; lot = null; invalidate(); };

  // 同一年「拆掉舊的」緊接「改建成新的」併成一句，履歷才不會兩行一組地重複
  function lines(entries: LotEntry[]): { y: number; text: string }[] {
    const out: { y: number; text: string }[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i], n = entries[i + 1];
      if (e.t === 'demolish' && n && n.t === 'build' && n.replaces && n.y === e.y) { out.push({ y: e.y, text: `拆掉舊${KIND[e.kind]}，${sentence(n)}` }); i++; }
      else out.push({ y: e.y, text: sentence(e) });
    }
    return out;
  }

  // 選的是「格子」，不是某一棟：年份一變，要重新找當年蓋在這一格上的那一棟（改建過的格子，每個年代是不同的建築）
  // 歷史不會變，每一格的履歷只算一次；換年份只改標題與哪幾行變灰，不重建清單
  const lotRows = new Map<string, { y: number; text: string }[]>();
  let lot: { x: number; z: number } | null = null, lotKey = '', lastPastIdx = -1;
  function showLot(h: { x: number; z: number }) {
    const key = h.x + ',' + h.z, fresh = key !== lotKey || bio.hidden;
    lot = { x: h.x, z: h.z }; lotKey = key;
    let rows = lotRows.get(key);
    if (!rows) { rows = lines(lotHistory(world, h.x, h.z)); lotRows.set(key, rows); }
    const b = stateNow().blds.find(v => h.x >= v.x && h.x < v.x + v.w && h.z >= v.z && h.z < v.z + v.d);
    const title = b ? `${b.dmg >= 1 ? '瓦礫' : b.abandoned ? '廢棄的' + KIND[b.kind] : KIND[b.kind]}` : '空地';
    $('#bio h2').textContent = `${title}（${h.x}, ${h.z}）`;
    $('#bio .sub').textContent = rows.length ? `這一格有 ${rows.length} 件事；灰色的還沒發生（第 ${year} 年之後）` : '這一格什麼都沒發生過';
    const ol = $('#bio ol');
    if (fresh) {
      ol.innerHTML = '';
      for (const r of rows) { const li = document.createElement('li'); li.innerHTML = `<b>第 ${r.y} 年</b>${r.text}`; ol.appendChild(li); }
      lastPastIdx = -2;
    }
    let lp = -1;
    rows.forEach((r, i) => { (ol.children[i] as HTMLElement).classList.toggle('future', r.y > year); if (r.y <= year) lp = i; });
    const w = b ? b.w : 1, d = b ? b.d : 1, x0 = b ? b.x : h.x, z0 = b ? b.z : h.z;
    marker.scale.set(w, 1, d); marker.position.set(x0 + w / 2, 0.02, z0 + d / 2); marker.visible = true;
    bio.hidden = false;
    invalidate();
    if (lp !== lastPastIdx) { lastPastIdx = lp; (ol.children[lp] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' }); }   // 捲到最近發生的那一件
  }

  function syncUi() {
    slider.value = String(year);
    ylabel.textContent = `第 ${year} 年・${eraOfYear(year)}`;
    playBtn.textContent = playing ? '⏸' : '▶';
    stylesEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.s === style.id));
    const st = stats(stateNow());
    metaEl.textContent = `建築 ${st.buildings}・完好 ${Math.round(st.intact * 100)}%・樹 ${st.trees}・歷史 ${world.events.length} 筆`;
    if (lot && !bio.hidden) showLot(lot);
  }

  // ---- 點擊：短按（移動 < 6px、< 400ms）才算，拖動是轉鏡頭 ----
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(cx: number, cy: number): Hit | null {
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
    if (h) showLot(h);
  });

  resize();
  rebuild();

  // ---- 給煙霧測試與拍照工具的出口（純讀取；不改世界）----
  const screenOf = (x: number, y: number, z: number) => { const v = new THREE.Vector3(x, y, z).project(cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; };
  (window as unknown as { __gt: unknown }).__gt = {
    ready: true, seed, hash, format: world.format,
    get year() { return year; }, style: style.id,
    webgl2: renderer.capabilities.isWebGL2,
    stats: Object.fromEntries([0, GROW_END, END].map(y => [y, stats(stateAt(world, y))])),
    selfcheck() {
      const again = historyHash(generateWorld(seed));
      const other = historyHash(generateWorld(seed + 1));
      const short = generateWorld(seed, N, GROW_END).events;
      const prefix = world.events.filter(e => e.y <= GROW_END);
      return { deterministic: again === hash, seedMatters: other !== hash, appendOnly: JSON.stringify(short) === JSON.stringify(prefix) };
    },
    // 地塊履歷與事件逐條對帳：抽 30 棟第 80 年的建築
    lotCheck() {
      const s80 = stateAt(world, GROW_END), picks = s80.blds.filter((_, i) => i % Math.max(1, Math.floor(s80.blds.length / 30)) === 0).slice(0, 30);
      let bad = 0, rich = 0, entries = 0;
      for (const b of picks) {
        const h = lotHistory(world, b.x, b.z); entries += h.length;
        for (let i = 1; i < h.length; i++) if (h[i].y < h[i - 1].y) bad++;
        for (const e of h) {
          const eid = 'id' in e ? e.id : -1, cell = (ev: { x: number; z: number }) => ev.x === b.x && ev.z === b.z;
          const ok = world.events.some(ev => ev.y === e.y && (
            (e.t === 'road' || e.t === 'bridge') ? ev.t === 'road' && cell(ev) :
            (e.t === 'park' || e.t === 'overgrow' || e.t === 'tree' || e.t === 'clear') ? ev.t === e.t && cell(ev) :
            (e.t === 'roofless' || e.t === 'collapse') ? ev.t === 'decay' && ev.id === eid :
            ev.t === e.t && 'id' in ev && ev.id === eid));
          if (!ok) bad++;
        }
        const ts = new Set(h.map(e => e.t));
        if (ts.has('build') && ts.has('abandon') && ts.has('collapse')) rich++;
      }
      return { lots: picks.length, entries, bad, rich };
    },
    setYear: (y: number) => new Promise(res => { setYear(y); requestAnimationFrame(() => requestAnimationFrame(res)); }),
    // 投影一棟建築或一塊瓦礫到螢幕座標，再模擬點擊，回報點到的格子
    pickBuildingTest(which: 'tallest' | 'rubble') {
      if (!built) return null;
      const s = stateAt(world, year);
      if (which === 'tallest') {
        const b = [...s.blds].filter(v => v.dmg === 0 && !LAND.includes(v.kind)).sort((a, c) => c.lv - a.lv || (c.x + c.z) - (a.x + a.z))[0];
        const [sx, sy] = screenOf(b.x + b.w / 2, b.lv * 0.3 - 0.05, b.z + b.d / 2);
        return { want: [b.x, b.z], got: pickAt(sx, sy) };
      }
      const spots = built.rubbleSpots().sort((a, c) => (c.x + c.z) - (a.x + a.z));
      if (!spots.length) return null;
      const r = spots[0], b = s.blds.find(v => v.id === r.id)!;
      const [sx, sy] = screenOf(r.x, r.y, r.z);
      return { want: [b.x, b.z], got: pickAt(sx, sy) };
    },
    // 拍履歷卡樣張與測試用：打開某一格的履歷，回傳（格子、標題、每一行、灰掉幾行）
    openLot(x: number, z: number) {
      showLot({ x, z });
      return { title: $('#bio h2').textContent, rows: [...ui.querySelectorAll('#bio li')].map(li => li.textContent), future: ui.querySelectorAll('#bio li.future').length };
    },
    rebuildMs: () => [...rebuildMs],
    rebuildParts: () => [...rebuildParts],
    frames: () => frames,   // 實際畫了幾幀：靜止時不該再增加
    spin: (rad: number) => { controls.rotateLeft?.(rad); invalidate(); },
    renderInfo: () => ({ ...pipe.sceneInfo, rt: pipe.size }),
  };
}

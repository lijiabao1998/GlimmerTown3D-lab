// 2D 城市模式（D003）：把 2D 實驗線的分享碼解碼成城市，畫成 3D。預設開種子城。
// 網址參數：?mode=city（預設）&sample=seed516|ai120 &style=A|B|C（對照用）&at=x,z|center &zoom= &clean=1（拍照，藏介面）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { decodeLabCode } from './io/labcode.ts';
import { cityFromLab, cityStats, buildingAt, type City } from './sim/city.ts';
import { buildCityScene, tileTop, type BuiltCity } from './render/cityScene.ts';
import { Pipeline } from './render/post.ts';
import { STYLES, type Style } from './render/styles.ts';
import { KINDS } from './content/kinds.ts';
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
    const b = buildCityScene(c, KINDS, style);
    const t3 = performance.now();
    built?.dispose();
    city = c; built = b; label = name;
    Object.assign(timing, { decode: t1 - t0, city: t2 - t1, scene: t3 - t2, total: t3 - t0 }, b.timing);
    frameCamera(c.n, first);
    closeCard();
    syncUi();
    return { ok: true };
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
      <div class="row" id="picks"></div></div>
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
  }

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
      rows.push(`<b>第 ${c.day.toLocaleString()} 天</b>從 2D 實驗線 v${c.gameVer} 匯入 3D（這之前的歷史 2D 存檔沒有記）`);
    } else {
      title = `${ROAD[c.road[i]] || ZONE[c.zone[i]] || TER[c.ter[i]] || '地塊'}（${x}, ${z}）`;
      const bits = [TER[c.ter[i]], c.el[i] ? '高地' : '', ZONE[c.zone[i]] ? ZONE[c.zone[i]] + '（還沒蓋）' : '', c.tree[i] ? '有樹' : '', c.rail[i] ? '鐵路' : '', c.fly[i] ? '高架' : ''].filter(Boolean);
      $('#bio .sub').textContent = bits.join('・');
      rows.push(`<b>第 ${c.day.toLocaleString()} 天</b>從 2D 實驗線 v${c.gameVer} 匯入 3D`);
    }
    $('#bio h2').textContent = title;
    $('#bio ol').innerHTML = rows.map(r => `<li>${r}</li>`).join('');
    const s = b ? b.size : 1, x0 = b ? b.x : x, z0 = b ? b.z : z;
    marker.scale.set(s, 1, s); marker.position.set(x0 + s / 2, Math.max(0, tileTop(c, z0 * c.n + x0)) + 0.03, z0 + s / 2);
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
    spin: (rad: number) => { controls.rotateLeft?.(rad); invalidate(); },
    renderInfo: () => ({ ...pipe.sceneInfo, rt: pipe.size }),
  };
}

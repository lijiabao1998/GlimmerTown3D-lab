// D001 觀看頁：同一座城的三個時間（第 0／80／300 年）× 三種畫風。可旋轉縮放，手機可用。
// 網址參數：?year=0|80|300 &style=A|B|C &seed=數字 &clean=1（拍照用，藏介面）
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { generateWorld, stateAt, stats, historyHash, GROW_END, END } from './sim/history.ts';
import { buildScene, type Built } from './render/scene.ts';
import { Pipeline } from './render/post.ts';
import { STYLES, type Style } from './render/styles.ts';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? 5162026) >>> 0;
const YEARS = [0, GROW_END, END] as const;
const YEAR_LABEL: Record<number, string> = { 0: '開拓那年・第 0 年', [GROW_END]: '一生盡頭・第 80 年', [END]: '數百年後的廢墟・第 300 年' };
let year = YEARS.includes(Number(q.get('year')) as never) ? Number(q.get('year')) : GROW_END;
let style: Style = STYLES[(q.get('style') as Style['id']) ?? 'A'] ?? STYLES.A;
const clean = q.get('clean') === '1';

const world = generateWorld(seed);
const hash = historyHash(world);

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const pipe = new Pipeline();

// 斜 45° 正交鏡頭；仰角 30°（接近 2D 版 2:1 等角）
const N = world.size;
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, N * 6);
// ?at=x,z 對焦某一格（預設城心）、?zoom= 放大倍數（拍近景用）
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

let built: Built | null = null;
function rebuild() {
  built?.dispose();
  renderer.shadowMap.type = style.softShadow ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
  renderer.shadowMap.needsUpdate = true;
  built = buildScene(stateAt(world, year), style);
  syncUi();
}

function resize() {
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h);
  const half = N * 0.42, asp = w / h;
  cam.left = -half * asp; cam.right = half * asp; cam.top = half; cam.bottom = -half;
  cam.updateProjectionMatrix();
}
addEventListener('resize', resize);

function frame() {
  controls.update();
  if (built) pipe.render(renderer, built.scene, cam, style, innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
}
renderer.setAnimationLoop(frame);

// ---- 介面 ----
const ui = document.createElement('div');
ui.id = 'ui';
ui.innerHTML = `<h1>微光小鎮 3D・D001 視覺承諾</h1><div class="row" id="years"></div><div class="row" id="styles"></div><p class="meta"></p>`;
if (!clean) document.body.appendChild(ui);
const yearsEl = ui.querySelector('#years')!, stylesEl = ui.querySelector('#styles')!, metaEl = ui.querySelector('.meta')!;
for (const y of YEARS) { const b = document.createElement('button'); b.textContent = YEAR_LABEL[y]; b.dataset.y = String(y); b.onclick = () => { year = y; rebuild(); }; yearsEl.appendChild(b); }
for (const s of Object.values(STYLES)) { const b = document.createElement('button'); b.textContent = s.label; b.dataset.s = s.id; b.onclick = () => { style = s; rebuild(); }; stylesEl.appendChild(b); }
function syncUi() {
  yearsEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', Number((b as HTMLElement).dataset.y) === year));
  stylesEl.querySelectorAll('button').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.s === style.id));
  const st = stats(stateAt(world, year));
  metaEl.textContent = `種子 ${seed}・建築 ${st.buildings}・完好 ${Math.round(st.intact * 100)}%・樹 ${st.trees}・歷史 ${world.events.length} 筆（${hash}）`;
}

resize();
rebuild();

// ---- 給煙霧測試與拍照工具的出口（純讀取；不改世界）----
(window as unknown as { __gt: unknown }).__gt = {
  ready: true, seed, hash, year, style: style.id,
  webgl2: renderer.capabilities.isWebGL2,
  stats: Object.fromEntries(YEARS.map(y => [y, stats(stateAt(world, y))])),
  selfcheck() {
    const again = historyHash(generateWorld(seed));
    const other = historyHash(generateWorld(seed + 1));
    const short = generateWorld(seed, N, GROW_END).events;
    const prefix = world.events.filter(e => e.y <= GROW_END);
    return { deterministic: again === hash, seedMatters: other !== hash, appendOnly: JSON.stringify(short) === JSON.stringify(prefix) };
  },
  renderInfo: () => ({ ...pipe.sceneInfo, rt: pipe.size }),
};

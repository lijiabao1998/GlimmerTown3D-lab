// 施工的畫法（D014）：樓體照屋齡長出來（建築材質的片段裁切）、工地網格（一個網格、頂點動畫）、屋齡風化（牆面著色器）。
// 只讀城市（屋齡、位置），不改世界狀態（規則 2）。分期、公式在 src/content/construction.ts（純函式，Node 守衛直接核對）。
// 每格一筆施工資料（N×N 浮點貼圖）：R＝屋齡、G＝這一格建築幾何的最高點、B＝地基高、A＝分類×4＋區＋16×要不要施工＋32×有沒有建築。
// （屋齡可以超過 99，所以「沒有建築」另用一個位元，不拿屋齡當記號）
import * as THREE from 'three';
import type { City } from '../sim/city.ts';
import { RISE_GLSL, CON_DAYS, TRANS, WX, GRIME, MOSS, EAVE, WEATHER_TT, WEATHER_MIN_AGE, WEATHER_GAIN, WEATHER_PX, sitePlan, onSite, districtMood, type SitePart } from '../content/construction.ts';
import { PX_PER_CELL } from '../content/recipes.ts';
import type { GroundCache } from './ground.ts';
import { SceneCache } from './pieces.ts';

export const NO_AGE = 99;
const CAT: Record<string, number> = { R: 1, C: 2, I: 3 };

// ---- 共用的 uniform 與貼圖（一座城一份；場景重建沿用同一份，材質直接引用同一個物件）----
export class ConState {
  n: number; data: Float32Array; tex: THREE.DataTexture;
  top: Float32Array; base: Float32Array; wallTop: Float32Array;   // 目前場景的每格最高點、地基、牆頂（重建時更新）
  ground: GroundCache | null = null;                              // D014：地面增量重畫的上一次（src/render/ground.ts）
  terrain: { n: number; top: Float32Array; ground: THREE.BufferGeometry; cliff: THREE.BufferGeometry } | null = null;   // D014：地面、崖面幾何（高度沒變就沿用）
  cache = new SceneCache();                                     // D015：建築幾何照件快取、三個建築網格常駐、地面貼圖常駐、野樹（src/render/pieces.ts）
  // uProbe、uNoClip：守衛用（只畫某一格的建築、整個關掉裁切與風化比對）；平常 (−1,−1)、0
  uni = { uConTex: { value: null as unknown as THREE.DataTexture }, uConN: { value: 1 }, uDayFrac: { value: 0 }, uTime: { value: 0 }, uDetail: { value: 0 }, uProbe: { value: new THREE.Vector2(-1, -1) }, uNoClip: { value: 0 } };
  constructor(n: number) {
    this.n = n; this.data = new Float32Array(n * n * 4);
    this.top = new Float32Array(n * n); this.base = new Float32Array(n * n); this.wallTop = new Float32Array(n * n);
    this.tex = new THREE.DataTexture(this.data, n, n, THREE.RGBAFormat, THREE.FloatType);
    this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter; this.tex.generateMipmaps = false; this.tex.needsUpdate = true;
    this.uni.uConTex.value = this.tex; this.uni.uConN.value = n;
  }
  // 屋齡與分類（每天）；top／base 是目前場景量到的（setGeometry）
  setCity(c: City, cat: (k: number) => string) {
    const n = this.n, d = this.data;
    for (let i = 0; i < n * n; i++) { d[i * 4] = NO_AGE; d[i * 4 + 1] = this.top[i]; d[i * 4 + 2] = this.base[i]; d[i * 4 + 3] = 0; }
    for (const b of c.buildings) {
      if (b.goneDay !== undefined) continue;
      const el = (onSite(b.k, 0) ? 16 : 0) + 32, cc = (CAT[cat(b.k)] ?? 0) * 4 + districtMood(b.x, b.z);
      for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) {
        const x = b.x + dx, z = b.z + dz; if (x >= n || z >= n) continue;
        const i = z * n + x; d[i * 4] = b.age; d[i * 4 + 3] = cc + el;
      }
    }
    this.tex.needsUpdate = true;
  }
  setGeometry(top: Float32Array, base: Float32Array, wallTop: Float32Array) { this.top.set(top); this.base.set(base); this.wallTop.set(wallTop); }
  ageAt(i: number) { return this.data[i * 4]; }
  has(i: number) { return this.data[i * 4 + 3] >= 32; }
  siteAge(i: number) { return (this.data[i * 4 + 3] & 16) ? this.data[i * 4] : NO_AGE; }   // 要施工的格才回屋齡（公園、沒有建築＝99）
  dispose() { this.tex.dispose(); this.terrain?.ground.dispose(); this.terrain?.cliff.dispose(); this.terrain = null; this.cache.reset(''); }
}

// ---- 頂點的施工屬性 aCon＝(地界內的 x, 地界內的 z, 牆頂高)：片段屬於哪一格＝floor(xz)。沒有主人的三角形（高架路）＝(−1,−1,0) 不裁切 ----
// 位置先往面內收一點（法線反方向），再夾進主人的地界：外挑的屋簷、落在地界線上的牆都算自己那一格。同時量每格的最高點
const CON_E = .001, CON_IN = .01;
// 一個頂點的 aCon（寫進 out），回傳它落在哪一格
function conVertex(pos: ArrayLike<number>, nor: ArrayLike<number>, v: number, r: number[], n: number, out: Float32Array, tag: number): number {
  let x = pos[v * 3] - nor[v * 3] * CON_IN, z = pos[v * 3 + 2] - nor[v * 3 + 2] * CON_IN;
  x = x < r[0] + CON_E ? r[0] + CON_E : x > r[2] - CON_E ? r[2] - CON_E : x; z = z < r[1] + CON_E ? r[1] + CON_E : z > r[3] - CON_E ? r[3] - CON_E : z;
  out[v * 3] = x; out[v * 3 + 1] = z; out[v * 3 + 2] = tag;
  return Math.floor(z) * n + Math.floor(x);
}
export function conAttr(pos: number[], nor: number[], owners: number[], tags: number[], rectOf: (owner: number) => number[] | null, n: number, top: Float32Array, wallTop: Float32Array): Float32Array {
  const nt = owners.length, out = new Float32Array(nt * 9);
  const cache = new Map<number, number[] | null>();
  let lastO = NaN, r: number[] | null = null;
  for (let t = 0; t < nt; t++) {
    const o = owners[t];
    if (o !== lastO) { lastO = o; const c = cache.get(o); if (c !== undefined) r = c; else { r = o ? rectOf(o) : null; cache.set(o, r); } }
    const tag = tags[t] || 0;
    for (let j = 0; j < 3; j++) {
      const v = t * 3 + j;
      if (!r) { out[v * 3] = -1; out[v * 3 + 1] = -1; out[v * 3 + 2] = 0; continue; }
      const i = conVertex(pos, nor, v, r, n, out, tag), y = pos[v * 3 + 1];
      if (y > top[i]) top[i] = y;
      if (tag > 0 && y > wallTop[i]) wallTop[i] = y;
    }
  }
  return out;
}
// D015：一件（一個街區或一棟）的 aCon：地界 rect 固定（null＝沒有主人，不裁切）；每格最高點、牆頂的貢獻記在 touch（稀疏，不必每件一張 N×N）
export function conAttrRect(pos: number[], nor: number[], tags: number[], rect: number[] | null, n: number, top: Map<number, number>, wall: Map<number, number>): Float32Array {
  const nt = tags.length, out = new Float32Array(nt * 9);
  for (let t = 0; t < nt; t++) {
    const tag = tags[t] || 0;
    for (let j = 0; j < 3; j++) {
      const v = t * 3 + j;
      if (!rect) { out[v * 3] = -1; out[v * 3 + 1] = -1; out[v * 3 + 2] = 0; continue; }
      const i = conVertex(pos, nor, v, rect, n, out, tag), y = pos[v * 3 + 1];
      const a = top.get(i); if (a === undefined || y > a) top.set(i, y);
      if (tag > 0) { const w = wall.get(i) ?? 0; if (y > w) wall.set(i, y); }
    }
  }
  return out;
}

// ---- 建築材質：片段裁切（施工）＋牆面風化（T591／T606）----
const f3 = (c: number[]) => `vec3(${c.map(v => (v / 255).toFixed(4)).join(',')})`;
const WX_GLSL = `vec3 conWx(float cat, float mood){
  ${(['R', 'C', 'I'] as const).map((k, ci) => WX[k].map((c, mi) => `if (cat == ${ci + 1}.0 && mood == ${mi}.0) return ${f3(c)};`).join(' ')).join('\n  ')}
  return ${f3(WX.R[0])};
}`;
const HASH_GLSL = `float conHash(vec3 p){ p = fract(p * vec3(0.1031, 0.1030, 0.0973)); p += dot(p, p.yxz + 33.33); return fract((p.x + p.y) * p.z); }`;
export const CLIP_FRAG = `
uniform sampler2D uConTex; uniform float uConN; uniform float uDayFrac; uniform float uDetail; uniform vec2 uProbe; uniform float uNoClip;
varying vec3 vCon; varying float vConY; varying vec3 vConN;
${RISE_GLSL}
${WX_GLSL}
${HASH_GLSL}
vec4 conData(){ return texture2D(uConTex, (floor(vCon.xy) + 0.5) / uConN); }
void conClip(vec4 cd){
  if (uProbe.x >= 0.0 && (vCon.x < 0.0 || any(notEqual(floor(vCon.xy), uProbe)))) discard;   // 守衛：只畫這一格
  if (vCon.x < 0.0 || uNoClip > 0.5) return;
  float cel = mod(floor(cd.a / 16.0), 2.0), ctt = cd.r + uDayFrac;
  if (cel > 0.5 && ctt < ${CON_DAYS.toFixed(1)}) { float rv = conRise(ctt); if (rv < 0.0 || vConY > cd.b + rv * (cd.g - cd.b) + 0.0005) discard; }
}
float conWA(float a){ return min(0.8, a * ${WEATHER_GAIN.toFixed(2)}); }   // 3D 增益（量化 12 階會吃掉淡的；src/content/construction.ts WEATHER_GAIN）
vec3 conWeather(vec3 col, vec4 cd){
  if (vCon.z <= 0.0 || uDetail <= 0.0 || uNoClip > 0.5 || abs(vConN.y) > 0.5 || cd.a < 32.0 || cd.r < ${WEATHER_MIN_AGE.toFixed(1)}) return col;
  float tt = cd.r < 120.0 ? ${WEATHER_TT[1].toFixed(2)} : cd.r < 240.0 ? ${WEATHER_TT[2].toFixed(2)} : ${WEATHER_TT[3].toFixed(2)};
  float cm = mod(cd.a, 16.0), cat = floor(cm / 4.0), mood = mod(cm, 4.0);
  bool front = abs(vConN.z) > abs(vConN.x);
  float am = front ? 1.0 : 0.8, pitch = (front ? 8.0 : 11.0) / 32.0, along = front ? vCon.x : vCon.y;
  float hpx = (vCon.z - cd.b) * ${PX_PER_CELL.toFixed(1)}, below = (vCon.z - vConY) * ${PX_PER_CELL.toFixed(1)}, above = (vConY - cd.b) * ${PX_PER_CELL.toFixed(1)};
  vec2 ct = floor(vCon.xy);
  float slot = floor(along / pitch), hh = conHash(vec3(slot, ct.x * 7.0 + ct.y * 13.0, front ? 1.0 : 2.0));
  if (hh <= 0.46 + tt * 0.36) {
    float sx = (slot + 0.25 + 0.5 * conHash(vec3(slot, ct.y * 5.0 + ct.x * 11.0, front ? 3.0 : 4.0))) * pitch;
    float L = clamp(floor(hpx * (0.20 + 0.38 * hh) * (0.6 + tt * 0.7) + 0.5), 2.0, max(2.0, hpx - 3.0)), a = (0.10 + tt * 0.16) * (0.7 + 0.3 * hh) * am;
    float d = below - 2.0, up = max(1.0, floor(L * 0.45 + 0.5)), wx = along - sx;
    vec3 wc = conWx(cat, mood);
    if (wx >= 0.0 && wx < ${WEATHER_PX.toFixed(1)} / 32.0 && d >= 0.0 && d < L) col = mix(col, wc, conWA(d < up ? a * 0.55 : a) * uDetail);
    if (tt > 0.5 && hh < 0.2 && wx >= ${WEATHER_PX.toFixed(1)} / 32.0 && wx < ${(2 * 2).toFixed(1)} / 32.0 && d >= up && d < L - 2.0) col = mix(col, wc, conWA(a * 0.5) * uDetail);
  }
  if (above < (tt > 0.55 ? 2.0 : 1.0) * ${WEATHER_PX.toFixed(1)}) col = mix(col, (cat == 1.0 && mood == 2.0) ? ${f3(MOSS)} : ${f3(GRIME)}, conWA((0.10 + tt * 0.15) * am) * uDetail);
  if (tt > 0.25 && below >= ${WEATHER_PX.toFixed(1)} && below < ${(2 * 2).toFixed(1)}) col = mix(col, ${f3(EAVE)}, conWA((0.05 + tt * 0.07) * am) * uDetail);
  return col;
}
`;
const CLIP_VERT_DECL = `attribute vec3 aCon; varying vec3 vCon; varying float vConY; varying vec3 vConN;`;
const CLIP_VERT_BODY = `vCon = aCon; vConY = (modelMatrix * vec4(position, 1.0)).y; vConN = normal;`;

type Uni = ConState['uni'];
function chain(m: THREE.Material, key: string, f: (sh: THREE.WebGLProgramParametersWithUniforms) => void) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey.bind(m);
  m.onBeforeCompile = (sh, r) => { prev.call(m, sh, r); f(sh); };
  m.customProgramCacheKey = () => prevKey() + '|' + key;
}
// 牆、其他、點綴：裁切；weather＝牆面才疊風化
export function patchClip(m: THREE.Material, u: Uni, weather: boolean) {
  chain(m, weather ? 'gt3d-con-w1' : 'gt3d-con-1', sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + CLIP_VERT_DECL).replace('#include <begin_vertex>', '#include <begin_vertex>\n' + CLIP_VERT_BODY);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + CLIP_FRAG)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nvec4 conD = conData(); conClip(conD);')
      .replace('#include <alphamap_fragment>', (weather ? 'diffuseColor.rgb = conWeather(diffuseColor.rgb, conD);\n' : '') + '#include <alphamap_fragment>');
  });
}
// 影子那趟：同一段裁切（沒蓋的部分不投影子）
export function clipDepthMaterial(u: Uni): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  patchClip(m, u, false);
  return m;
}

// ---- 前庭的樹：等完工（t ≥ 8.6）才種下去；每棵一個實例屬性 aTreeT＝它那一格的屋齡（沒施工＝99）----
export function patchTree(m: THREE.Material, u: Uni) {
  chain(m, 'gt3d-con-tree1', sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTreeT; uniform float uDayFrac;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float tt = aTreeT + uDayFrac; if (tt < ${CON_DAYS.toFixed(1)}) transformed *= clamp((tt - 8.6) / 0.4, 0.0, 1.0); }`);
  });
}

// ---- 工地網格 ----
// 每個頂點：aSite＝(屋齡, 地基, 最高點, 牆頂)、aWin＝(出現 t, 消失 t)、aAnim＝(種類, 相位, a, b)、aPivot、aNb＝(鄰格屋齡, 鄰格地基, 鄰格最高點, 有沒有)
const SITE_VERT = `
attribute vec3 iC; attribute vec3 iH; attribute vec2 iRot; attribute vec3 iCol; attribute vec3 iTop;
attribute vec4 aSite; attribute vec2 aWin; attribute vec4 aAnim; attribute vec3 aPivot; attribute vec4 aNb;
uniform float uDayFrac; uniform float uTime;
${RISE_GLSL}
float conReveal(float age, float b, float top){ float r = conRise(age + uDayFrac); return r < 0.0 ? b : b + r * (top - b); }
vec3 conRotY(vec3 p, vec3 c, float a){ vec3 d = p - c; float s = sin(a), k = cos(a); return c + vec3(k * d.x + s * d.z, d.y, -s * d.x + k * d.z); }
vec3 conRotAxis(vec3 p, vec3 c, vec3 ax, float a){ vec3 d = p - c; return c + d * cos(a) + cross(ax, d) * sin(a) + ax * dot(ax, d) * (1.0 - cos(a)); }
// 實例盒子：本地 ±1 的角 × 半尺寸，先繞本地 x（pitch）再繞 y（yaw），再平移到中心（同 THREE.Euler 'YXZ'）
vec3 conPlace(vec3 v){ float cp = cos(iRot.y), sp = sin(iRot.y), cy = cos(iRot.x), sy = sin(iRot.x); float y1 = v.y * cp - v.z * sp, z1 = v.y * sp + v.z * cp; return vec3(v.x * cy + z1 * sy, y1, -v.x * sy + z1 * cy); }
void conSite(inout vec3 p, inout vec3 nrm){
  float t = aSite.x + uDayFrac, ty = aAnim.x, ph = aAnim.y * 6.2831, A = aAnim.z, Bb = aAnim.w;
  float vis = clamp(min((t - (aWin.x - ${TRANS.toFixed(2)})) / ${TRANS.toFixed(2)}, (aWin.y - t) / ${TRANS.toFixed(2)}), 0.0, 1.0);
  float rv = conReveal(aSite.x, aSite.y, aSite.z), wt = aSite.w > aSite.y ? aSite.w : aSite.z, deck = min(rv, wt);
  // 1. 絕對高度：吊鉤、吊索、鷹架頂、鋼骨長高、街區切口圍網
  if (ty == 3.0 || ty == 4.0) {
    float hook = t < 3.5 ? aSite.y + (aSite.z - aSite.y) * 0.9 * (0.55 + 0.22 * sin(uTime * 1.3 + ph)) : max(rv, aSite.y + 0.05) + 0.14 + 0.06 * sin(uTime * 1.3 + ph);
    if (ty == 3.0) p.y = hook + p.y;                                               // 吊鉤、吊料：幾何在 y＝0 附近
    else { float f = clamp(p.y + 0.5, 0.0, 1.0); p.y = mix(hook + 0.014, aPivot.y - 0.01, f); }   // 吊索：幾何 y 從 −.5 到 .5
  }
  if (ty == 10.0) p.y = min(p.y, rv + 0.1);                                        // 鷹架：頂端跟著樓板
  if (ty == 11.0) p.y = aPivot.y + (p.y - aPivot.y) * mix(A, 1.0, clamp(t - 2.0, 0.0, 1.0));   // 鋼骨半高→全高（61687）
  if (ty == 14.0) {                                                                // 街區切口：下緣＝這一格的露出高度、上緣＝鄰格現在的高度
    float lo = rv, hi = aNb.w > 0.5 ? min(aNb.z, conReveal(aNb.x, aNb.y, aNb.z)) : lo;
    p.y = position.y > 0.0 ? max(lo, hi) : lo;                                       // 盒子上半＝上緣、下半＝下緣
  }
  if (ty >= 2.0 && ty <= 4.0) p.xz += vec2(cos(Bb), sin(Bb)) * A * (0.25 + 0.3 * (sin(uTime * 0.9 + ph) + 1.0) * 0.5);   // 小車沿吊臂走
  // 2. 出場、退場：繞支點縮放
  p = aPivot + (p - aPivot) * vis;
  // 3. 跟著樓板、走動、轉動
  if (ty == 9.0 || ty == 13.0) p.y += deck - aSite.y;
  if (ty == 12.0 || ty == 13.0) { float g = fract(uTime * 0.12 + aAnim.y), tri = g < 0.5 ? g * 2.0 : 2.0 - g * 2.0; p += vec3(cos(Bb), 0.0, sin(Bb)) * (tri - 0.5) * A; p.y += abs(sin(uTime * 7.0 + ph)) * 0.006; }
  if (ty >= 1.0 && ty <= 4.0) { float slew = 0.5 * sin(uTime * 0.35 + ph); p = conRotY(p, aPivot, slew); nrm = conRotY(nrm, vec3(0.0), slew); }
  if (ty == 5.0) { vec3 ax = normalize(vec3(-sin(Bb), 0.0, cos(Bb))); float a = A * sin(uTime * 1.8 + ph); p = conRotAxis(p, aPivot, ax, a); nrm = conRotAxis(nrm, vec3(0.0), ax, a); }
  if (ty == 6.0) { vec3 ax = vec3(cos(Bb), 0.0, sin(Bb)); float a = uTime * 3.0; p = conRotAxis(p, aPivot, ax, a); nrm = conRotAxis(nrm, vec3(0.0), ax, a); }
  if (ty == 7.0 && fract(uTime * A + aAnim.y) >= Bb) p = aPivot;                  // 閃爍（61646、61701）
  if (ty == 8.0) { float g = fract(uTime * 0.5 + aAnim.y); p = aPivot + (p - aPivot) * (1.0 - g) + vec3(0.0, g * 0.25, 0.0); }   // 揚塵（61663）
}
`;
export function patchSite(m: THREE.Material, u: Uni) {
  chain(m, 'gt3d-site-1', sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SITE_VERT)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = conPlace(normal); vec3 conP = iC + conPlace(position * iH); conSite(conP, objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = conP;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.rgb = normal.y > 0.5 ? iTop : iCol;');
  });
}
export function siteDepthMaterial(u: Uni): THREE.MeshDepthMaterial {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  chain(m, 'gt3d-site-depth-1', sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + SITE_VERT)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n{ vec3 conN = vec3(0.0, 1.0, 0.0); vec3 conP = iC + conPlace(position * iH); conSite(conP, conN); transformed = conP; }');
  });
  return m;
}

// 一座工地的輸入（地界、樓高、屋齡）與街區切口（同一街區的鄰格）
export interface SiteSpec { id: number; k: number; lv: number; x0: number; z0: number; s: number; age: number; base: number; top: number; wallTop: number; cuts: { x0: number; z0: number; x1: number; z1: number; nb: number }[] }

const colCache = new Map<string, THREE.Color>();
const hexCol = (s: string) => { let c = colCache.get(s); if (!c) { c = new THREE.Color(s); colCache.set(s, c); } return c; };
// 單位盒子（本地 ±1）：四個側面＋頂面，逆時針朝外；每件東西是一個實例（中心、半尺寸、旋轉、側面色、頂面色、出現消失、動畫、支點、工地、鄰格）
let unitBox: THREE.BufferGeometry | null = null;
export function box5(): THREE.BufferGeometry {
  if (unitBox) return unitBox;
  const F = [[[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1], [1, 0, 0]], [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, 0, 0]],
    [[1, -1, 1], [-1, -1, 1], [-1, 1, 1], [1, 1, 1], [0, 0, 1]], [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [0, 0, -1]], [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1], [0, 1, 0]]];
  const P: number[] = [], N: number[] = [];
  for (const f of F) for (const k of [0, 2, 1, 0, 3, 2]) { P.push(...f[k]); N.push(...f[4]); }   // (b−a)×(c−a) 朝外（守衛核對）
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(P.length).fill(1), 3));
  return (unitBox = g);
}
export const BOX_TRIS = 10;
// 今天的工地合成一個實例幾何。live＝會推進的城（只留今天看得到、加上明天要出場的東西）；只能看的城只放 t＝屋齡那一刻看得到的東西
export function siteGeometry(specs: SiteSpec[], ageAt: (i: number) => number, st: { base: Float32Array; top: Float32Array; wallTop: Float32Array }, n: number, live = true) {
  const perSite = new Map<number, string[]>(), rows: { sp: SiteSpec; p: SitePart; nb: number[] }[] = [];
  const NO_NB = [0, 0, 0, 0];
  for (const sp of specs) {
    const parts = sitePlan({ x0: sp.x0, z0: sp.z0, s: sp.s, base: sp.base, top: sp.top, wallTop: sp.wallTop, age: sp.age, k: sp.k, lv: sp.lv, id: sp.id });
    const names: string[] = [];
    for (const p of parts) if (live ? (p.win[1] > sp.age && p.win[0] - TRANS < sp.age + 1) : (p.win[0] <= sp.age && sp.age < p.win[1])) { rows.push({ sp, p, nb: NO_NB }); if (!names.includes(p.what)) names.push(p.what); }
    // 街區切口圍網：地界上跟同一街區鄰格共用的邊，一片直立的網（下緣＝這一格的露出高度、上緣＝鄰格現在的高度，著色器 14 號）
    for (const cut of sp.cuts) {
      const wt = st.wallTop[cut.nb], nb = [ageAt(cut.nb), st.base[cut.nb], wt > st.base[cut.nb] + .05 ? wt : st.top[cut.nb], 1];   // 上緣切到鄰格的牆頂（屋頂設備不必擋）
      const alongX = cut.z0 === cut.z1, cx = (cut.x0 + cut.x1) / 2, cz = (cut.z0 + cut.z1) / 2;
      rows.push({ sp, nb, p: { what: 'cut', c: [cx, sp.base + .5, cz], h: alongX ? [(cut.x1 - cut.x0) / 2, .5, .004] : [.004, .5, (cut.z1 - cut.z0) / 2], col: '#4d7a5a', top: '#5d8a6a', win: [0, CON_DAYS], anim: 14, phase: 0, a: 0, b: 0, pivot: [cx, sp.base, cz] } });
    }
    if (sp.cuts.length) names.push('cut');
    perSite.set(sp.id, names);
  }
  const m = rows.length, f = (k: number) => new Float32Array(m * k);
  const iC = f(3), iH = f(3), iRot = f(2), iCol = f(3), iTop = f(3), W = f(2), A = f(4), V = f(3), S = f(4), NB = f(4);
  rows.forEach(({ sp, p, nb }, j) => {
    iC.set(p.c, j * 3); iH.set(p.h, j * 3); iRot[j * 2] = p.yaw ?? 0; iRot[j * 2 + 1] = p.pitch ?? 0;
    const cs = hexCol(p.col), ct = hexCol(p.top ?? p.col);
    iCol[j * 3] = cs.r; iCol[j * 3 + 1] = cs.g; iCol[j * 3 + 2] = cs.b; iTop[j * 3] = ct.r; iTop[j * 3 + 1] = ct.g; iTop[j * 3 + 2] = ct.b;
    W[j * 2] = p.win[0]; W[j * 2 + 1] = p.win[1]; A[j * 4] = p.anim; A[j * 4 + 1] = p.phase; A[j * 4 + 2] = p.a; A[j * 4 + 3] = p.b;
    V.set(p.pivot, j * 3); S[j * 4] = sp.age; S[j * 4 + 1] = sp.base; S[j * 4 + 2] = sp.top; S[j * 4 + 3] = sp.wallTop; NB.set(nb, j * 4);
  });
  const g = new THREE.InstancedBufferGeometry(), b = box5();
  g.index = null; for (const k of ['position', 'normal', 'color']) g.setAttribute(k, b.getAttribute(k));
  const ia = (k: string, a: Float32Array, sz: number) => g.setAttribute(k, new THREE.InstancedBufferAttribute(a, sz));
  ia('iC', iC, 3); ia('iH', iH, 3); ia('iRot', iRot, 2); ia('iCol', iCol, 3); ia('iTop', iTop, 3);
  ia('aWin', W, 2); ia('aAnim', A, 4); ia('aPivot', V, 3); ia('aSite', S, 4); ia('aNb', NB, 4);
  g.instanceCount = m;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(n / 2, 0, n / 2), n * 2);   // 頂點在著色器裡會動：包圍球放大，不讓視錐裁掉
  return { geometry: g, perSite, tris: m * BOX_TRIS, parts: m };
}

// 這座城今天的工地：屋齡 < 9、不是公園、沒拆（onSite）。場景還沒有它的幾何（startDay > builtDay）時，樓高用種類表估；
// 街區切口：地界上跟「同一個街區」鄰格共用的邊（只在場景裡已經有它時才有切口）
export function siteSpecs(c: City, st: ConState, blockOf: Int32Array, builtDay: number, est: (k: number, lv: number, v: number) => number): SiteSpec[] {
  const n = c.n, out: SiteSpec[] = [];
  for (const b of c.buildings) {
    if (!onSite(b.k, b.age, b.goneDay !== undefined) || b.x + b.size > n || b.z + b.size > n) continue;
    let base = 0, top = -Infinity, wallTop = 0;
    for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) { const i = (b.z + dz) * n + b.x + dx; base = Math.max(base, st.base[i]); top = Math.max(top, st.top[i]); wallTop = Math.max(wallTop, st.wallTop[i]); }
    const inMesh = c.day - b.age <= builtDay && top > base + .1;
    if (!inMesh) { top = base + Math.max(.3, est(b.k, b.lv, b.v)); wallTop = 0; }
    const cuts: SiteSpec['cuts'] = [];
    if (inMesh) for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) {
      const x = b.x + dx, z = b.z + dz, i = z * n + x, bo = blockOf[i];
      if (!bo) continue;
      const nbr: [number, number, number, number, number, number][] = [[x + 1, z, x + 1, z, x + 1, z + 1], [x - 1, z, x, z, x, z + 1], [x, z + 1, x, z + 1, x + 1, z + 1], [x, z - 1, x, z, x + 1, z]];
      for (const [nx, nz, ax, az, bx, bz] of nbr) {
        if (nx < b.x + b.size && nx >= b.x && nz < b.z + b.size && nz >= b.z) continue;   // 自己地界裡的格
        if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
        const j = nz * n + nx;
        if (blockOf[j] === bo) cuts.push({ x0: ax, z0: az, x1: bx, z1: bz, nb: j });
      }
    }
    out.push({ id: b.id, k: b.k, lv: b.lv, x0: b.x, z0: b.z, s: b.size, age: b.age, base, top, wallTop, cuts });
  }
  return out;
}

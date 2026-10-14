// D062 天氣：把模擬的天氣（src/sim/rules/weather.ts：weather 0 晴／1 雨／2 暴雨）畫成後製疊層。純函式與常數：不 import three、不碰 DOM、不用 Math.random／時間，同輸入同位元組。
// 出處（只讀）：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d `index.html`——天氣狀態機 54964–54975；雨雪粒子 57262–57295（螢幕空間池：雨 120、暴雨 240，雨 rgba(200,220,255,.5)、雪 2×2 rgba(255,255,255,.85)）；
// 天氣色調 62168–62171（雨 rgba(70,90,120,.18)、暴雨 .30、冬天任何降水 rgba(200,210,230,.14)，全畫面含天空）；閃電 62516–62541；彩虹 60351–60359。對拍黃金樣本 fixtures/d062-lab.json（tools/lab-seasons.mjs 摘），守衛 tools/unit-d062.mjs。
// 有意偏離的地方與理由寫在 docs/D062-seasons-weather.md（動畫上限 20 格／秒、降水只重跑後製、彩虹帶寬與地面疊色、閃電單閃且峰值 .5、不畫電光線形）。
import { hash2 } from '../sim/rng.ts';

// ---- 狀態映射 ----
export type WeatherLook = 0 | 1 | 2 | 3 | 4;   // 0 晴、1 雨、2 暴雨、3 雪（冬天的雨）、4 暴雪（冬天的暴雨）
export const weatherLook = (weather: number, winter: boolean): WeatherLook => weather >= 2 ? (winter ? 4 : 2) : weather === 1 ? (winter ? 3 : 1) : 0;

// ---- 常數（實驗線的數字；單位：色 0–255、α 0–1、秒）----
export const WX_TINT = { rain: { rgb: [70, 90, 120], a: 0.18 }, storm: { rgb: [70, 90, 120], a: 0.30 }, snow: { rgb: [200, 210, 230], a: 0.14 } } as const;   // 全畫面疊色（62168–62171）
export const tintOf = (look: WeatherLook) => look === 0 ? null : look >= 3 ? WX_TINT.snow : look === 2 ? WX_TINT.storm : WX_TINT.rain;
// 降水：count＝整個畫面的期望條數（實驗線 cap＝floor((暴雨?240:120)×效能檔)，效能檔取 1）；其餘是本線的畫法（單位：渲染像素，渲染目標是畫面的 1/3）
export const FALL = {
  1: { speed: 110, len: 3, lean: 0.35, sway: 0, count: 120 },
  2: { speed: 140, len: 3, lean: 0.45, sway: 0, count: 240 },
  3: { speed: 24, len: 1, lean: 0, sway: 2, count: 120 },
  4: { speed: 30, len: 1, lean: 0, sway: 2, count: 240 },
} as const;
export const RAIN_COLOR = { rgb: [200, 220, 255], a: 0.5 } as const;   // 雨絲（57285）
export const SNOW_COLOR = { rgb: [255, 255, 255], a: 0.85 } as const;  // 雪點（57279–57284）
// 彩虹（60351–60359）：七色、圓心 (.5W, 1.08H)、外半徑 .92H、弧 1.16π–1.84π、淡出 9 秒、α＝淡出比例×.46。本線：帶寬 .016H（實驗線 .011H，1/3 解析度下只有 3.7 個渲染像素）、天空像素吃滿 α、地面與建築上疊 α .32
export const RAINBOW = {
  colors: [[224, 80, 74], [232, 147, 74], [232, 210, 74], [84, 184, 88], [74, 144, 216], [90, 90, 200], [154, 84, 200]],
  seconds: 9, alphaSky: 0.46, alphaGround: 0.32, cx: 0.5, cy: 1.08, rOut: 0.92, band: 0.016, a0: 1.16, a1: 1.84,   // a0／a1 以 π 為單位
} as const;
// 閃電（62516–62541）：暴雨且非冬、每個模擬日 25%；閃光 .4 秒線性消退。本線：單閃、峰值混白 .5（實驗線 α min(.85, flashT×2)＝.8）、兩次之間至少 1 秒、不畫電光線形
export const FLASH = { seconds: 0.4, peak: 0.5, minGap: 1, rate: 0.25, salt: 1311 } as const;
export const ANIM_FPS = 20;   // 降水動畫上限（只重跑後製一趟）

// ---- 事件 ----
// 彩虹：前一天有降水、今天晴、非冬（＝weatherStep 的 rainbow 旗標；守衛對模擬逐日核對）
export const rainbowDay = (prev: number, weather: number, winter: boolean): boolean => prev >= 1 && weather === 0 && !winter;
// 閃電：暴雨、非冬、hash2(day) 抽 25%（模擬的 lightning 旗標在 stepDay 被丟掉，畫面端自己抽；同日同結果，不碰模擬的亂數流）
export const lightningDay = (day: number, weather: number, winter: boolean): boolean => weather === 2 && !winter && hash2(day, 0, FLASH.salt) < FLASH.rate;
export const rainbowStrength = (secondsLeft: number): number => Math.max(0, Math.min(1, secondsLeft / RAINBOW.seconds));   // 9 秒線性淡出
export const flashAlpha = (secondsLeft: number): number => FLASH.peak * Math.max(0, Math.min(1, secondsLeft / FLASH.seconds));   // 峰值 .5 線性消退

// 畫面端的彩虹與閃電計時（真實秒，不跟遊戲速度走）。day() 每個模擬日呼叫一次（一天一步，推進多天就呼叫多次）；step(dt) 每幀呼叫。沒有任何亂數、時間或 DOM：同一串呼叫同一串輸出
export class WeatherFx {
  prev = 0; rainbowT = 0; flashT = 0; gap: number = FLASH.minGap;   // gap＝距離上一次閃光幾秒（起始＝夠久）
  calm: boolean;                                                     // calm＝使用者要求減少動態：不放閃電
  constructor(calm = false) { this.calm = calm; }
  reset(weather = 0): void { this.prev = weather; this.rainbowT = 0; this.flashT = 0; this.gap = FLASH.minGap; }
  day(weather: number, day: number, winter: boolean): void {
    if (rainbowDay(this.prev, weather, winter)) this.rainbowT = RAINBOW.seconds;
    if (!this.calm && lightningDay(day, weather, winter) && this.gap >= FLASH.minGap) { this.flashT = FLASH.seconds; this.gap = 0; }
    this.prev = weather;
  }
  step(dt: number): void { this.rainbowT = Math.max(0, this.rainbowT - dt); this.flashT = Math.max(0, this.flashT - dt); this.gap += dt; }
  get busy(): boolean { return this.rainbowT > 0 || this.flashT > 0; }
}

// ---- 天空色階：套同一個色調再貼回輸出色格子（量化畫風 A 的天空是四階色帶；連續漸層量化時三個色版各自跳階，會出現偏紫、偏青的怪帶）----
const snap = (v: number, quant: number): number => Math.round(Math.max(0, Math.min(quant, Math.round(v / 255 * quant))) / quant * 255);
export function tintSky(sky: readonly number[], look: WeatherLook, quant: number): number[] {
  const t = tintOf(look);
  if (!t) return [...sky];
  return sky.map(hex => {
    const ch = (sh: number, k: number) => { const v = ((hex >> sh) & 255) * (1 - t.a) + t.rgb[k] * t.a; return quant > 0 ? snap(v, quant) : Math.round(v); };
    return (ch(16, 0) << 16) | (ch(8, 1) << 8) | ch(0, 2);
  });
}

// ---- 網址旗標：?weather=auto|off|clear|rain|storm（預設 auto）、拍照用 ?wxTime=秒、?wxRainbow=0..1、?wxFlash=0..1 ----
export interface WeatherOption { mode: 'auto' | 'clear' | 'rain' | 'storm'; time?: number; rainbow?: number; flash?: number }
const WX_MODE: Record<string, 'clear' | 'rain' | 'storm'> = { clear: 'clear', rain: 'rain', storm: 'storm' };
export const WX_PINNED: Record<'clear' | 'rain' | 'storm', number> = { clear: 0, rain: 1, storm: 2 };
// 天空與地景關閉（街區模式之外、landArt=0 或任何舊 legacy 旗標）時天氣一律關：沒有天空色階，畫面要與舊版逐位元組相同。只認白名單
export function weatherOptionOf(get: (key: string) => string | null, skyOn: boolean): WeatherOption | undefined {
  if (!skyOn) return undefined;
  const raw = get('weather') ?? '';
  if (raw === 'off') return undefined;
  const o: WeatherOption = { mode: Object.hasOwn(WX_MODE, raw) ? WX_MODE[raw] : 'auto' };
  const t = get('wxTime') ?? '', r = get('wxRainbow') ?? '', f = get('wxFlash') ?? '';
  if (/^\d{1,4}(?:\.\d{1,3})?$/.test(t)) o.time = +t;
  if (/^(?:0|1|0?\.\d{1,3})$/.test(r)) o.rainbow = +r;
  if (/^(?:0|1|0?\.\d{1,3})$/.test(f)) o.flash = +f;
  return o;
}

// ---- 後製著色器的 GLSL（常數全部取自上面，改常數就改著色器）；src/render/post.ts 把它們嵌進 FRAG ----
const g = (n: number): string => Number.isInteger(n) ? n.toFixed(1) : String(+n.toPrecision(6));
const v3 = (rgb: readonly number[]): string => `vec3(${rgb.map(g).join(', ')}) / 255.0`;
export const WEATHER_GLSL_UNIFORMS = `uniform float wx;      // 0 晴 1 雨 2 暴雨 3 雪 4 暴雪
uniform float wxT;     // 動畫時間（秒；JS 端量成 ${ANIM_FPS} 格／秒）
uniform float rainbow; // 0..1：彩虹強度（9 秒線性淡出）
uniform float flash;   // 閃光的混白量（0..${FLASH.peak}）
uniform float aspect;  // 後製畫布寬／高
uniform vec2 res;      // 後製畫布（渲染目標）的像素數`;
export const WEATHER_GLSL_FNS = `// 雜湊不用 sin（sin 版在 SwiftShader 的 float32 下密度是設定的近兩倍，各家 GPU 也不一致）：Dave Hoskins 的 hash without sine，只靠 fract 與乘加
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
// 一層斜落的雨絲／雪點：一欄一個隨機速度，欄內每隔 4×len 像素有機會出現一條 len 長的絲；N＝整個畫面的期望條數
float fall(vec2 pp, float t, float speed, float len, float N, float lean, float sway, float seed) {
  float x = pp.x + floor(pp.y * lean) + floor(sin(mod(t * 0.9, 6.2831853) + h11(pp.x + seed) * 6.2831) * sway);
  float col = h11(x + seed * 7.0);
  float y = pp.y + t * speed * (0.6 + 0.8 * col) + col * 97.0;
  float per = len * 4.0, cell = floor(y / per);
  float dens = clamp(N * per / (res.x * res.y), 0.0, 1.0);
  float r = h21(vec2(x * 1.7 + seed, cell * 3.1));
  return step(r, dens) * step(mod(y, per), len);
}`;
const fallCall = (look: 1 | 2 | 3 | 4): string => { const p = FALL[look]; return `fall(pp, wxT, ${g(p.speed)}, ${g(p.len)}, ${g(p.count)}, ${g(p.lean)}, ${g(p.sway)}, 1.0)`; };
const bandExpr = RAINBOW.colors.map((c, i) => { const v = `vec3(${c.map(g).join(', ')})`; return i < RAINBOW.colors.length - 1 ? `i == ${i} ? ${v} : ` : v; }).join('');   // 七色的巢狀三元式（紅在最外圈）
export const WEATHER_GLSL_APPLY = `bool isSky = sky > 0.5 && texture2D(tDepth, vUv).r > 0.99999;
  if (wx > 0.5) {   // 天氣色調（全畫面）；量化畫風的天空色階由 JS 事先套同一個色調再貼回輸出色格子，這裡不再混
    if (!(isSky && quant > 0.5)) { vec3 tc = wx > 2.5 ? ${v3(WX_TINT.snow.rgb)} : ${v3(WX_TINT.rain.rgb)}; float ta = wx > 2.5 ? ${g(WX_TINT.snow.a)} : wx > 1.5 ? ${g(WX_TINT.storm.a)} : ${g(WX_TINT.rain.a)}; gl_FragColor.rgb = mix(gl_FragColor.rgb, tc, ta); }
    vec2 pp = floor(vUv / texel);
    float hit = 0.0; vec3 pc = ${v3(RAIN_COLOR.rgb)}; float pa = ${g(RAIN_COLOR.a)};
    if (wx < 1.5) hit = ${fallCall(1)};
    else if (wx < 2.5) hit = ${fallCall(2)};
    else if (wx < 3.5) { hit = ${fallCall(3)}; pc = ${v3(SNOW_COLOR.rgb)}; pa = ${g(SNOW_COLOR.a)}; }
    else { hit = ${fallCall(4)}; pc = ${v3(SNOW_COLOR.rgb)}; pa = ${g(SNOW_COLOR.a)}; }
    gl_FragColor.rgb = mix(gl_FragColor.rgb, pc, hit * pa);
  }
  if (rainbow > 0.01) {   // 彩虹：圓心 (${g(RAINBOW.cx)}W, ${g(RAINBOW.cy)}H)、外半徑 ${g(RAINBOW.rOut)}H、七條帶各 ${g(RAINBOW.band)}H（以線寬中心對齊）、弧 ${g(RAINBOW.a0)}π–${g(RAINBOW.a1)}π
    vec2 q = vec2((vUv.x - ${g(RAINBOW.cx)}) * aspect, vUv.y - (1.0 - ${g(RAINBOW.cy)}));
    float r = length(q), bb = (${g(RAINBOW.rOut)} + ${g(RAINBOW.band / 2)} - r) / ${g(RAINBOW.band)};
    if (bb >= 0.0 && bb < 7.0 && q.y > ${g(Math.sin((RAINBOW.a0 - 1) * Math.PI))} * r) {
      int i = int(floor(bb));
      vec3 rc = ${bandExpr};
      gl_FragColor.rgb = mix(gl_FragColor.rgb, rc / 255.0, (isSky ? ${g(RAINBOW.alphaSky)} : ${g(RAINBOW.alphaGround)}) * rainbow);
    }
  }
  if (flash > 0.001) gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0), flash);   // 單閃、不頻閃`;

// ---- 降水的 CPU 副本（著色器那一段數學的逐步抄寫，每一步 Math.fround 成 float32）：守衛用它算期望像素數，也跟瀏覽器的真像素逐格比；不是畫面用的 ----
const f = Math.fround;
const fract = (x: number): number => f(x - Math.floor(x));
const h11 = (p0: number): number => { let p = fract(f(f(p0) * f(0.1031))); p = f(p * f(p + f(33.33))); p = f(p * f(p + p)); return fract(p); };
const h21 = (x: number, y: number): number => {
  let a = fract(f(f(x) * f(0.1031))), b = fract(f(f(y) * f(0.1031))), c = a;   // p3 = fract(vec3(p.xyx) * .1031)
  const d = f(f(f(a * f(b + f(33.33))) + f(b * f(c + f(33.33)))) + f(c * f(a + f(33.33))));   // dot(p3, p3.yzx + 33.33)
  a = f(a + d); b = f(b + d); c = f(c + d);
  return fract(f(f(a + b) * c));
};
export function fallHit(px: number, py: number, t0: number, look: 1 | 2 | 3 | 4, resX: number, resY: number): number {
  const p = FALL[look], seed = 1, t = f(t0);
  const x = f(px + Math.floor(f(py * f(p.lean))) + Math.floor(f(Math.sin(f(f((t * f(0.9)) % 6.2831853) + f(h11(f(px + seed)) * f(6.2831)))) * f(p.sway))));
  const col = h11(f(x + seed * 7));
  const y = f(f(py + f(f(t * f(p.speed)) * f(f(0.6) + f(f(0.8) * col)))) + f(col * 97));
  const per = p.len * 4, cell = Math.floor(f(y / per)), dens = Math.max(0, Math.min(1, f(f(p.count * per) / f(resX * resY))));
  const r = h21(f(f(x * f(1.7)) + seed), f(cell * f(3.1))), m = f(y - f(per * Math.floor(f(y / per))));
  return (r <= dens ? 1 : 0) * (m <= p.len ? 1 : 0);   // GLSL step(a, b)＝b < a ? 0 : 1：step(r, dens) 是 dens ≥ r；step(mod, len) 是 len ≥ mod
}

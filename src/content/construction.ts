// 施工與近看細節（D014）：純函式、決定性，不 import three、不碰 DOM（規則 2）。只讀建築的屋齡，不改城市。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d，index.html 行號（每一段都註明）。
//   施工分期 T220／T258／T259：61610–61727（前置期 age 0–3）、61785–61830（升起期 age 4–8）、62057（鷹架）；工期 9 天。
//   屋齡：每天 age++（55632）；住商工自然升級 age＝0（55649）＝重蓋一次。公園（k4）不施工。
//   風化 T591 落牆 T606：paintWeather606 58332、drawWallDetail606 58384、detailAlpha432 58783、districtMood424 58019。
//   近看小物 T599 落牆 T606：paintNear606 58356，閘門 58393。streetHash 57805。
// 分期表的「有哪些東西」在整數天逐項等於實驗線；天與天之間怎麼過場、3D 擺在哪裡，是本線自己定的（規則 1 補充，寫在 D014 卡）。

export const CON_DAYS = 9;                                  // T259：工期 5→9 天，age ≥ 9 完工
export const RISE_F = [.30, .50, .68, .84, .96];            // 61787 riseF＝[.30,.50,.68,.84,.96][age-4]
export const FRAME_HALF = .55;                              // 61687 age2 鋼骨半高、age3 全高
export const CRANE_UNTIL = 7;                               // 61811 吊車續留至 age6（age<7）
export const TRANS = .12;                                   // 本線：物件出場／退場的過場（天）

// 這一棟要不要畫工地（公園不施工、拆掉的不畫、完工的不畫）
export const onSite = (k: number, age: number, gone = false) => !gone && k !== 4 && age < CON_DAYS;

// 樓體露出的比例：t＝屋齡＋當天已過的比例。t<3 全藏（前置期）；整數天 4…8 逐項＝RISE_F；3→0、9→1，中間線性
const RISE_PTS = [0, ...RISE_F, 1];                         // t＝3,4,…,9
export function riseAt(t: number, rf: readonly number[] = RISE_F): number {   // rf：守衛注入錯誤用
  if (t < 3) return -1;                                     // 全藏（連地面高度的東西都藏）
  if (t >= CON_DAYS) return 1;
  const pts = rf === RISE_F ? RISE_PTS : [0, ...rf, 1], i = Math.floor(t - 3), f = t - 3 - i;
  return pts[i] + (pts[i + 1] - pts[i]) * f;
}
// 給著色器用的同一條曲線（守衛核對兩邊逐點相同）
export const RISE_GLSL = `float conRise(float t){
  if (t < 3.0) return -1.0;
  if (t >= ${CON_DAYS.toFixed(1)}) return 1.0;
  float p[7]; p[0]=0.0; ${RISE_F.map((r, i) => `p[${i + 1}]=${r.toFixed(2)};`).join(' ')} p[6]=1.0;
  int i = int(floor(t - 3.0)); float f = t - 3.0 - float(i);
  return mix(p[i], p[i + 1], f);
}`;

// ---- 實驗線的雜湊與區（57805、58019）----
export function streetHash(x: number, y: number, salt: number): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const districtMood = (x: number, y: number) => Math.floor(streetHash(Math.floor(x / 8), Math.floor(y / 8), 42400) * 4) % 4;

// ---- 風化（T591／T606）----
export const WEATHER_MIN_AGE = 14;                           // 58388 age>=14
export const weatherTier = (age: number) => age < WEATHER_MIN_AGE ? 0 : age < 120 ? 1 : age < 240 ? 2 : 3;   // 58389
export const WEATHER_TT = [0, .3, .6, .95];                  // 58390 [0,.3,.6,.95][ab]
// 58331 WX606[cat][mood]：雨漬色（rgb）；接地苔垢 58336（住宅 mood 2 是綠苔）
export const WX: Record<'R' | 'C' | 'I', [number, number, number][]> = {
  R: [[90, 74, 60], [80, 80, 78], [84, 76, 66], [92, 80, 58]],
  C: [[78, 74, 66], [70, 76, 84], [74, 80, 72], [84, 76, 62]],
  I: [[96, 74, 54], [104, 96, 72], [96, 74, 54], [88, 74, 58]],
};
export const GRIME = [58, 54, 48], MOSS = [74, 110, 64], EAVE = [40, 38, 36];
// 本線（規則 1 補充）：3D 畫風 A 的後製把顏色量化成 12 階，實驗線的透明度（最多約 .26）大多被量化吃掉、看不出來；
// 分級、密度、長度、位置、顏色照實驗線，透明度乘這個增益（上限 .8）。卡面「對照圖」記了前後
export const WEATHER_GAIN = 2.5;
// 同一個理由：畫風 A 一個渲染像素＝3 個 CSS 像素，3D 的像素密度只有實驗線的三分之一，實驗線 1px 寬的雨漬在 3D 不到 1 個渲染像素。
// 雨漬寬、接地帶與簷下帶的高度乘這個倍數（格距、密度、長度照實驗線）
export const WEATHER_PX = 2;
// 雨漬公式（58340–58348）：每面每 8px（受光面）／11px（側面）一格；hh ≤ .46+tt*.36 才畫；
// 長度 h*(.20+.38hh)*(.6+tt*.7)；透明度 (.10+tt*.16)*(.7+.3hh)*am；上面 45% 淡一半；tt>.5 且 hh<.2 旁邊多一條 a*.5
export const streakOn = (hh: number, tt: number) => hh <= .46 + tt * .36;
export const streakLen = (h: number, hh: number, tt: number) => Math.max(2, Math.min(h - 3, Math.round(h * (.20 + .38 * hh) * (.6 + tt * .7))));
export const streakAlpha = (hh: number, tt: number, am: number) => (.10 + tt * .16) * (.7 + .3 * hh) * am;
export const grimeAlpha = (tt: number, am: number) => (.10 + tt * .15) * am;   // 58349 接地帶：tt>.55 兩像素，否則一像素
export const eaveAlpha = (tt: number, am: number) => (.05 + tt * .07) * am;    // 58350 簷下積灰：tt>.25 才畫
// 58783 detailAlpha432：畫面縮放 z 的細節透明度
export const detailAlpha = (z: number) => z < .75 ? 0 : z < 1 ? .58 : z < 1.3 ? .78 : 1;
export const WEATHER_MIN_ZOOM = .9, NEAR_MIN_ZOOM = 1.22;   // 58388 z>=.9、58393 z>=1.22
export const LAB_TILE_PX = 64;                               // 實驗線 z＝1 時一格的水平寬度（像素）

// ---- 近看小物（paintNear606 58356）----
// 輸入照實驗線：face 的水平長度（像素）、牆高（像素）、街區的 v／bw／bh、hb（58394）。輸出每一件放在哪一面、沿面第幾像素、離牆腳幾像素
export interface NearItem { kind: 'planter' | 'flower' | 'bin' | 'sign' | 'ac' | 'stripe' | 'pallet' | 'crate' | 'pipe'; face: 'L' | 'D'; x: number; e: number; w: number; h: number }
export interface NearIn { cat: 'R' | 'C' | 'I'; v: number; bw: number; bh: number; hb: number; lenL: number; lenD: number; wallH: number }
// 街區畫不畫（58393）：z≥1.22、age≥9、streetHash(x,y,60630)<.72；hb＝floor(streetHash(x,y,60631)*3)
export const nearGate = (x: number, y: number, age: number) => age >= 9 && streetHash(x, y, 60630) < .72;
export const nearHb = (x: number, y: number) => Math.floor(streetHash(x, y, 60631) * 3);
// xAt／cols 照 faceKit606（58322）：面從 0 量到 len（像素，整數格）
export function nearPlan(q: NearIn): NearItem[] {
  const seed = (q.v | 0) * 131 + (q.bw | 0) * 17 + (q.bh | 0) * 7 + q.hb * 1013, out: NearItem[] = [];
  const xAtL = (t: number) => Math.floor(q.lenL * t), xAtD = (t: number) => Math.floor(q.lenD * t);
  if (q.cat === 'R' || q.cat === 'C') {
    const nb = Math.max(1, Math.round(q.lenL / 11));
    for (let i = 0; i < nb; i++) {
      const hh = streetHash(seed, i, 60620); if (hh < .30) continue;
      const x = xAtL((i + .3 + .4 * streetHash(seed, i, 60621)) / nb);
      if (hh < .62) { out.push({ kind: 'planter', face: 'L', x, e: 0, w: 3, h: 2 }); if (hh > .5) out.push({ kind: 'flower', face: 'L', x: x + 2, e: 2, w: 1, h: 1 }); }
      else if (q.cat === 'R') out.push({ kind: 'bin', face: 'L', x, e: 0, w: 2, h: 3 });
      else out.push({ kind: 'sign', face: 'L', x, e: 0, w: 2, h: 3 });
    }
    if (q.wallH >= 12 && q.lenD >= 8) {
      const nu = q.cat === 'C' ? 2 : 1;
      for (let i = 0; i < nu; i++) {
        const hh = streetHash(seed, i, 60625); if (hh < .25) continue;
        const x = xAtD(.25 + .5 * (i + hh * .5) / nu), e = Math.min(q.wallH - 5, Math.round(q.wallH * (.35 + .3 * hh)));
        out.push({ kind: 'ac', face: 'D', x, e, w: 3, h: 2 });
      }
    }
  } else {
    // 工業：牆腳工安斜紋（cols(.06,.94) 整段）、每 18px 一格棧板（hh>.7 疊一箱）、側牆立管
    const a = xAtL(.06), b = Math.min(xAtL(.94), Math.floor(q.lenL) - 1);
    if (b >= a) out.push({ kind: 'stripe', face: 'L', x: a, e: 0, w: b - a + 1, h: 2 });
    const np = Math.max(1, Math.round(q.lenL / 18));
    for (let i = 0; i < np; i++) {
      const hh = streetHash(seed, i, 60640); if (hh < .35) continue;
      const x = xAtL((i + .35) / np) + 1;
      out.push({ kind: 'pallet', face: 'L', x, e: 2, w: 4, h: 2 });
      if (hh > .7) out.push({ kind: 'crate', face: 'L', x: x + 1, e: 4, w: 2, h: 2 });
    }
    if (q.wallH >= 10 && q.lenD >= 6) out.push({ kind: 'pipe', face: 'D', x: xAtD(.3 + .4 * streetHash(seed, 1, 60641)), e: 1, w: 1, h: q.wallH - 2 });   // fillRect(x,row−h+2,1,h−2)：底在牆腳上 1px
  }
  return out;
}

// ---- 工地計畫（T259）----
export interface SiteIn { x0: number; z0: number; s: number; base: number; top: number; wallTop: number; age: number; k: number; lv: number; id: number }
// 一件東西：box＝中心 c、半尺寸 h，先繞自己中心 yaw（繞 y）再 pitch（繞本地 x），再平移；win＝出現、消失的 t；
// anim：0 靜止、1 塔吊迴轉、2 迴轉＋小車、3 迴轉＋小車＋吊鉤、4 吊索、5 挖掘機擺臂、6 攪拌車滾筒、7 閃爍、8 揚塵、
//       9 跟著樓板高度、10 鷹架（頂端跟著樓板）、11 鋼骨長高、12 走動、13 走動＋跟著樓板
export interface SitePart {
  what: string; c: [number, number, number]; h: [number, number, number]; yaw?: number; pitch?: number;
  col: string; top?: string; sides?: boolean;
  win: [number, number]; anim: number; phase: number; a: number; b: number; pivot: [number, number, number];
}
// 實驗線每一期有哪些東西（守衛逐項核對；名字是本線取的，意思照 61610–61830 的註解）
export const LAB_STAGES: Record<number, string[]> = {
  0: ['pad', 'pit', 'slab0', 'fence', 'timber', 'beams', 'bricks', 'hut', 'toilet', 'gen', 'cone', 'excavator', 'dust', 'dump'],
  1: ['pad', 'slab', 'fence', 'timber', 'beams', 'bricks', 'hut', 'toilet', 'gen', 'cone', 'rebar', 'mixer', 'worker', 'cart'],
  2: ['pad', 'slab', 'fence', 'timber', 'beams', 'bricks', 'hut', 'toilet', 'gen', 'cone', 'frame', 'crane', 'worker', 'cart'],
  3: ['pad', 'slab', 'fence', 'timber', 'beams', 'bricks', 'hut', 'toilet', 'gen', 'cone', 'frame', 'spark', 'crane', 'worker', 'cart'],
  4: ['deck', 'stub', 'crane', 'scaffold', 'deckWorker'],
  5: ['deck', 'stub', 'crane', 'scaffold', 'deckWorker'],
  6: ['deck', 'stub', 'crane', 'scaffold', 'deckWorker'],
  7: ['deck', 'stub', 'scaffold', 'deckWorker'],
  8: ['deck', 'stub', 'scaffold', 'deckWorker'],
};
export interface StageFaults { craneUntil?: number; parks?: boolean }

export function sitePlan(q: SiteIn, f: StageFaults = {}): SitePart[] {
  if (q.k === 4 && !f.parks) return [];                      // 公園不施工（61610 bd.k!==4）
  const out: SitePart[] = [], L = q.s, B = q.base, cx = q.x0 + L / 2, cz = q.z0 + L / 2, x1 = q.x0 + L, z1 = q.z0 + L;
  const h = Math.max(.3, q.top - B), hF = Math.max(.25, h * .9), ph = streetHash(q.x0, q.z0, 1980);
  const add = (what: string, c: [number, number, number], hs: [number, number, number], col: string, win: [number, number], o: Partial<SitePart> = {}) =>
    out.push({ what, c, h: hs, col, win, anim: 0, phase: ph, a: 0, b: 0, pivot: [c[0], c[1] - hs[1], c[2]], ...o });
  const at = (u: number, v: number): [number, number] => [cx + u * L, cz + v * L];   // u、v：以地界中心為原點、地界邊長為 1
  const box = (what: string, u: number, v: number, hw: number, hh: number, hd: number, y0: number, col: string, top: string | undefined, win: [number, number], o: Partial<SitePart> = {}) => {
    const [x, z] = at(u, v); add(what, [x, B + y0 + hh, z], [hw, hh, hd], col, win, { top, ...o });
  };
  const PRE: [number, number] = [0, 4];
  // 前置期的地面：開挖土面、深坑、混凝土板（61616–61618）
  add('pad', [cx, B + .004, cz], [L / 2 - .03, .004, L / 2 - .03], '#83694c', PRE);
  add('pit', [cx, B + .0095, cz], [L * .25, .0015, L * .25], '#6d5638', [0, 1]);
  add('slab0', [cx, B + .012, cz], [L * .17, .002, L * .17], '#b3ada1', [0, 1]);
  add('slab', [cx, B + .012, cz], [L * .34, .004, L * .34], '#b3ada1', [1, 4]);
  // 圍籬（61619–61628）：白、橙相間。實驗線每邊 4＋2×大小 段；本線每邊一條白色矮板、橙色板隔段疊上去、兩端各一根柱（手機預算）
  {
    const segs = 4 + 2 * L, e = .03, sides: [number, number, number, number][] = [[q.x0 + e, z1 - e, x1 - e, z1 - e], [x1 - e, z1 - e, x1 - e, q.z0 + e], [x1 - e, q.z0 + e, q.x0 + e, q.z0 + e], [q.x0 + e, q.z0 + e, q.x0 + e, z1 - e]];
    for (const [ax, az, bx, bz] of sides) {
      const alongX = az === bz, half = Math.hypot(bx - ax, bz - az) / 2, len = half * 2 / segs, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      add('fence', [ax, B + .055, az], [.013, .055, .013], '#8a7a5c', PRE, { sides: true });
      add('fence', [mx, B + .06, mz], alongX ? [half, .028, .005] : [.005, .028, half], '#e8e4da', PRE, { sides: true });
      for (let i = 0; i < segs; i += 2) {
        const t = (i + .5) / segs, cx2 = ax + (bx - ax) * t, cz2 = az + (bz - az) * t;
        add('fence', [cx2, B + .06, cz2], alongX ? [len * .5, .03, .007] : [.007, .03, len * .5], '#e0913a', PRE, { sides: true });
      }
    }
  }
  // 雜項（61629–61647）：木料堆、鋼樑堆、磚料棧板、工地小屋、流動廁所、發電機（閃燈）、交通錐
  box('timber', -.26, .22, .09, .025, .05, 0, '#a8763a', '#c9974e', PRE);
  box('beams', .25, -.05, .1, .02, .035, 0, '#6a7078', '#8a8f96', PRE);
  box('bricks', .05, .33, .05, .022, .04, 0, '#b06030', '#d07840', PRE);
  box('hut', .08, -.38, .075, .055, .05, 0, '#3a6aa0', '#5a8ac0', PRE);
  box('toilet', -.36, .36, .024, .05, .024, 0, '#d8d0c0', '#3a6aa0', PRE);
  box('gen', .37, -.25, .045, .028, .032, 0, '#2a6a38', '#3a8a48', PRE);
  box('gen', .37, -.25, .01, .01, .01, .066, '#c9a030', '#c9a030', PRE, { anim: 7, a: 4, b: .5 });      // T599 閃燈 floor(visT*8)%2
  for (let i = 0; i < 4; i++) box('cone', -.1 + i * .1, .43, .014, .028, .014, 0, '#e07030', '#f0ece4', PRE);
  // age0：挖掘機（擺臂）、揚塵、傾卸車（61649–61670）
  {
    const [ex, ez] = at(.06, .2), yaw = -Math.PI / 2, pv: [number, number, number] = [ex, B + .11, ez - .02];
    add('excavator', [ex, B + .02, ez], [.05, .02, .09], '#3a3f45', [0, 1], { top: '#4a5058' });
    add('excavator', [ex, B + .075, ez + .01], [.045, .035, .06], '#e0a83a', [0, 1], { top: '#f0c050' });
    add('excavator', [ex, B + .155, ez - .08], [.012, .07, .012], '#c9973a', [0, 1], { pitch: -.6, anim: 5, a: .25, b: yaw, pivot: pv });
    add('excavator', [ex, B + .17, ez - .17], [.01, .055, .01], '#c9973a', [0, 1], { pitch: .5, anim: 5, a: .25, b: yaw, pivot: pv });
    add('excavator', [ex, B + .12, ez - .21], [.03, .018, .022], '#6a7078', [0, 1], { anim: 5, a: .25, b: yaw, pivot: pv });
    for (let d = 0; d < 3; d++) add('dust', [ex + .03 * d - .03, B + .06, ez - .2], [.022, .022, .022], '#a09684', [0, 1], { anim: 8, phase: d / 3, pivot: [ex + .03 * d - .03, B + .06, ez - .2] });
    const [dx, dz] = at(.3, .24);
    add('dump', [dx, B + .025, dz], [.11, .015, .042], '#2a2f35', [0, 1]);
    add('dump', [dx + .03, B + .07, dz], [.065, .03, .04], '#c45a2a', [0, 1], { top: '#a84a22' });
    add('dump', [dx - .08, B + .065, dz], [.028, .028, .036], '#3a78b0', [0, 1], { top: '#4a88c0' });
  }
  // age1：鋼筋叢、水泥攪拌車（滾筒轉）（61671–61692）
  for (let r = 0; r < 5; r++) box('rebar', -.2 + r * .1, -.05, .012, .08, .006, .016, '#8a5a3a', '#8a5a3a', [1, 2], { sides: true });   // 鋼筋叢：每叢一束
  {
    const [mx, mz] = at(.26, .3), dp: [number, number, number] = [mx + .02, B + .085, mz];
    add('mixer', [mx, B + .022, mz], [.1, .012, .036], '#2a2f35', [1, 2]);
    add('mixer', [mx - .08, B + .06, mz], [.026, .028, .034], '#4a78b0', [1, 2], { top: '#5a88c0' });
    add('mixer', dp, [.06, .036, .036], '#dcd6c8', [1, 2], { anim: 6, b: 0, pivot: dp });
    for (let s = 0; s < 3; s++) add('mixer', [dp[0] - .03 + s * .03, dp[1] + .037, dp[2]], [.006, .003, .03], '#c05a3a', [1, 2], { anim: 6, b: 0, pivot: dp });
  }
  // age2–3：鋼骨框架（半高→全高）、焊接火花（61693–61705）
  {
    const m = L * .16, xs = [q.x0 + m, x1 - m], zs = [q.z0 + m, z1 - m], fg = { anim: 11, a: FRAME_HALF } as Partial<SitePart>;
    for (const x of xs) for (const z of zs) add('frame', [x, B + hF / 2, z], [.012, hF / 2, .012], '#9aa0a8', [2, 4], { ...fg, pivot: [x, B, z] });
    for (const lvl of [.45, .82]) {
      const y = B + hF * lvl, w: [number, number] = lvl > .5 ? [3, 4] : [2, 4];
      add('frame', [cx, y, zs[0]], [(xs[1] - xs[0]) / 2, .008, .008], '#7d838c', w, { ...fg, pivot: [cx, B, zs[0]] });
      add('frame', [cx, y, zs[1]], [(xs[1] - xs[0]) / 2, .008, .008], '#7d838c', w, { ...fg, pivot: [cx, B, zs[1]] });
      add('frame', [xs[0], y, cz], [.008, .008, (zs[1] - zs[0]) / 2], '#7d838c', w, { ...fg, pivot: [xs[0], B, cz] });
      add('frame', [xs[1], y, cz], [.008, .008, (zs[1] - zs[0]) / 2], '#7d838c', w, { ...fg, pivot: [xs[1], B, cz] });
    }
    add('spark', [xs[0] + .06, B + hF * .6, zs[1] + .01], [.014, .014, .014], '#fff6d0', [3, 4], { anim: 7, a: 1.4, b: .4, top: '#ffffff' });
    add('spark', [xs[1] - .02, B + hF * .8, zs[1] + .01], [.014, .014, .014], '#fff6d0', [3, 4], { anim: 7, a: 1.4, b: .4, phase: ph + .5, top: '#ffffff' });
  }
  // 塔吊 age2–6（61706–61722、61811–61820）：塔身在後角（−x、−z，不擋鏡頭），吊臂朝地界中心，迴轉；吊鉤跟著樓板高度
  {
    const until = f.craneUntil ?? CRANE_UNTIL, W: [number, number] = [2, until];
    const mx = q.x0 + .09, mz = q.z0 + .09, mh = Math.max(.9, h * 1.25) + .15, top = B + mh, beta = Math.atan2(cz - mz, cx - mx), jl = .55 * L + .35;
    const pv: [number, number, number] = [mx, top, mz], dir = [Math.cos(beta), Math.sin(beta)];
    add('crane', [mx, B + mh / 2, mz], [.032, mh / 2, .032], '#c9973a', W, { top: '#d9a74a' });
    add('crane', [mx + dir[0] * jl / 2, top + .02, mz + dir[1] * jl / 2], [jl / 2, .024, .026], '#c9973a', W, { yaw: -beta, anim: 1, pivot: pv });
    add('crane', [mx - dir[0] * .13, top + .02, mz - dir[1] * .13], [.13, .024, .026], '#c9973a', W, { yaw: -beta, anim: 1, pivot: pv });
    add('crane', [mx - dir[0] * .22, top - .01, mz - dir[1] * .22], [.05, .04, .04], '#8a5a2a', W, { yaw: -beta, anim: 1, pivot: pv });
    add('crane', [mx, top + .09, mz], [.014, .07, .014], '#c9973a', W, { anim: 1, pivot: pv });
    add('crane', [mx + dir[0] * .06, top - .045, mz + dir[1] * .06], [.038, .034, .038], '#c9973a', W, { yaw: -beta, top: '#7ec8e8', anim: 1, pivot: pv });
    add('crane', [mx, top - .01, mz], [.03, .014, .03], '#555a62', W, { anim: 2, a: jl, b: beta, pivot: pv });
    add('crane', [mx, 0, mz], [.004, .5, .004], '#555a62', W, { anim: 4, a: jl, b: beta, pivot: pv, sides: true });
    add('crane', [mx, 0, mz], [.024, .02, .024], '#e0b83a', W, { anim: 3, a: jl, b: beta, pivot: pv });
    add('crane', [mx, -.05, mz], [.07, .016, .024], '#8a8f96', W, { anim: 3, a: jl, b: beta, pivot: pv });
  }
  // 地面工人兩名＋手推車（61723–61738，age≥1 的前置期）
  const worker = (what: string, u: number, v: number, dirAng: number, amp: number, anim: number, win: [number, number], p: number) => {
    const [x, z] = at(u, v), o = { anim, a: amp, b: dirAng, phase: p, pivot: [x, B, z] as [number, number, number] };
    add(what, [x, B + .025, z], [.012, .025, .01], '#3a4250', win, o);                 // 腿
    add(what, [x, B + .066, z], [.017, .018, .012], '#f0a030', win, { ...o, top: '#f0a030' });   // 反光背心
    add(what, [x, B + .094, z], [.01, .01, .01], '#e0b090', win, o);                   // 頭
    add(what, [x, B + .108, z], [.013, .005, .013], '#f2d23a', win, { ...o, top: '#f5dc50' });   // 安全帽
  };
  worker('worker', -.1, .1, 0, .3, 12, [1, 4], ph);
  worker('worker', .15, -.1, Math.PI / 2, .25, 12, [1, 4], ph + .37);
  box('cart', -.05, .28, .03, .015, .02, .012, '#6a5040', '#7a6050', [1, 4], { anim: 12, a: .12, b: 0 });
  // 升起期（61785–61830、62057）：樓板線、鋼筋頭、鷹架、樓板上的工人；樓體本身由建築材質的裁切長出來（src/render/construction.ts）
  const RISE: [number, number] = [3.02, CON_DAYS], m2 = L * .1;
  add('deck', [cx, B + .008, cz], [L / 2 - m2, .008, L / 2 - m2], '#b2aca0', RISE, { anim: 9, top: '#bdb7aa' });
  for (let i = 0; i < 5; i++) add('stub', [q.x0 + m2 + (L - 2 * m2) * (.18 + i * .16), B + .045, cz], [.004, .03, .004], '#8a5a3a', RISE, { anim: 9, sides: true });
  {
    const e = .045, xs = [q.x0 + e, cx, x1 - e], zs = [q.z0 + e, cz, z1 - e], S: [number, number] = [3.3, CON_DAYS];
    for (const x of xs) for (const z of zs) if (x !== cx || z !== cz) add('scaffold', [x, B + h / 2, z], [.008, h / 2, .008], '#c4a860', S, { anim: 10, pivot: [x, B, z], sides: true });
    for (let y = .22; y < h; y += .3) {
      add('scaffold', [cx, B + y, z1 - e], [L / 2 - e, .005, .006], '#b89a58', S, { anim: 10, pivot: [cx, B, z1 - e] });
      add('scaffold', [cx, B + y, q.z0 + e], [L / 2 - e, .005, .006], '#b89a58', S, { anim: 10, pivot: [cx, B, q.z0 + e] });
      add('scaffold', [x1 - e, B + y, cz], [.006, .005, L / 2 - e], '#b89a58', S, { anim: 10, pivot: [x1 - e, B, cz] });
      add('scaffold', [q.x0 + e, B + y, cz], [.006, .005, L / 2 - e], '#b89a58', S, { anim: 10, pivot: [q.x0 + e, B, cz] });
    }
  }
  worker('deckWorker', 0, 0, 0, L * .35, 13, [4, CON_DAYS], ph + .21);
  return out;
}
// 某個 t 看得到的東西（整數天就是那一期；出場過場在 [t0−TRANS, t0)、退場在 [t1−TRANS, t1)，整數天都完整）
export const partScale = (p: SitePart, t: number) => Math.max(0, Math.min(1, (t - (p.win[0] - TRANS)) / TRANS, (p.win[1] - t) / TRANS));
export const partsAt = (parts: SitePart[], t: number) => [...new Set(parts.filter(p => t >= p.win[0] && t < p.win[1]).map(p => p.what))];

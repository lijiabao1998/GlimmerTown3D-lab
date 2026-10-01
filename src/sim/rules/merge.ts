// 摩天樓與巨廈合併（I，D034）：實驗線 tick() 的 55688–55756（升級段、財富移級之後，火災之前）。
// 出處：2D 實驗線 lijiabao1998/GlimmerTown-lab @ d23c18d（index.html 行號）。
// 外層閘門 cityHappy > .55（55691；devSkylineBypass516B 在 d23c18d 沒有定義，不搬）：不快樂的城整段不跑、亂數零消耗。
//   巨廈 3×3（k105 住宅、k106 商業）：cityHappy > .6（55697）、先於塔；列優先掃 y 0..N−3、x 0..N−3；左上角 mgDone 就略過；
//     定類＝窗內（dy 外圈、dx 內圈）第一個非 ref、k 1 或 2、lv ≥ 2 的建築（55701–55702）；dem[kk] ≤ .25 略過（55703）；
//     九格逐格判（55704–55714，先失敗先停）：mgDone 失敗；同類 lv ≥ 2 通電有水（sewNeed 時接管）沒起火＝實質 subst++；同類 lv 1 沒起火可吸收；公園（k4）記下可吸收；
//     沒有建築、不是路、不是焦土、而且（分區＝kk 或沒分區的草地）可以；其餘失敗；subst < 5 失敗。
//     合格就先把九格標 mgDone（55716，擲骰失敗也標），再 R() < .04（55717）；成功：公園成對撤覆蓋印、九格 zone＝0、根格 {k, lv:1, v:0, age:0, pw, wa, h:1, sz:3}、其餘 {k, ref}、markLandDirty(x+1, y+1, 8)（55725）。
//   塔 2×2（k33 住宅、k34 商業）：列優先掃 y 0..N−2、x 0..N−2（55730）；根是非 ref、k 1 或 2、lv ≥ 2、沒 mgDone（55731–55734）；dem[kk] ≤ .3 略過（55736）；四格都要沒 mgDone、非 ref、同類、lv ≥ 2、通電有水、（sewNeed 時接管）、沒起火；
//     合格就 R() < .02（55746）；成功：四格標 mgDone、根格 {k, lv:1, v:pickV406(tk,1,x,y,ri(4)), age:0, pw, wa, h:1, sz:2}、其餘 {k, ref}；分區不清。每座成功的塔抽一次 ri(4)（求值順序：根格先建）。
// 吸收的建築沒有任何清理或補償（格子上的 bld 直接被蓋掉）。純邏輯：不碰 three、DOM、Math.random、現實時間（規則 2、3）。
import { idx, type Bld, type Rng, type World } from './lab.ts';

export const HAPPY_TOWER = .55;          // 55691
export const HAPPY_MEGA = .6;            // 55697
export const DEM_MEGA = .25;             // 55703
export const DEM_TOWER = .3;             // 55736
export const P_MEGA = .04;               // 55717
export const P_TOWER = .02;              // 55746
export const MEGA_SUBST_MIN = 5;         // 55715
export const MEGA_LAND_R = 8;            // 55725 markLandDirty(x+1, y+1, 8)

export interface MergeCtx {
  cityHappy: number;
  dem: Record<number, number>;
  sewNeed: boolean;
  sewOk: ArrayLike<number>;
  rng: Rng;
  pickV: (k: number, lv: number, x: number, y: number, fallback: number) => number;   // pickV406（D014）；呼叫端接 land.ts 的版本
  unstampPark: (x: number, y: number) => void;                                         // stampCov('park', x, y, COVR.park, −1)
  markLand: (x: number, y: number, r: number) => void;                                 // markLandDirty
}
// 一筆合併：x、z＝根格（左上角）；k＝新建築種類（33、34、105、106）；size＝2 或 3；v＝變體；from＝被吸收的建築的根格索引（含公園；每一棟都是 1×1，順序＝九格或四格的掃描順序）
export interface MergeRec { x: number; z: number; k: number; size: number; v: number; from: number[]; ages: number[]; clearedZone: boolean }   // ages＝被吸收的建築在合併那一刻的屋齡（跟 from 同順序；城市模型的墓碑用）

export function mergeDay(w: World, c: MergeCtx): MergeRec[] {
  const out: MergeRec[] = [];
  if (!(c.cityHappy > HAPPY_TOWER)) return out;
  const N = w.N, tiles = w.tiles, mgDone = new Uint8Array(N * N);
  // 加速（結果同逐格掃）：k 只會是 1 或 2，兩邊的需求都 ≤ 門檻就整段不會有合格的窗；窗內沒有「非 ref、k 1 或 2、lv ≥ 2」的建築就定不了類（kk＝0）。
  // 先掃一遍標出這種建築、做成累加表，每個窗用四次查表判斷有沒有；沒有的窗跟原文一樣直接略過（原文那一步沒有任何副作用）。
  if (c.cityHappy > HAPPY_MEGA && (c.dem[1] > DEM_MEGA || c.dem[2] > DEM_MEGA)) {
    const W = N + 1, acc = new Int32Array(W * W);
    for (let y = 0; y < N; y++) {
      let row = 0;
      for (let x = 0; x < N; x++) { const b = tiles[y * N + x].bld; if (b && !b.ref && (b.k === 1 || b.k === 2) && b.lv >= 2) row++; acc[(y + 1) * W + x + 1] = acc[y * W + x + 1] + row; }
    }
    for (let y = 0; y < N - 2; y++) for (let x = 0; x < N - 2; x++) {
      const i0 = idx(w, x, y);
      if (mgDone[i0]) continue;
      if (acc[(y + 3) * W + x + 3] - acc[y * W + x + 3] - acc[(y + 3) * W + x] + acc[y * W + x] === 0) continue;
      let kk = 0;
      for (let dy = 0; dy < 3 && !kk; dy++) for (let dx = 0; dx < 3; dx++) {
        const qb0 = tiles[idx(w, x + dx, y + dy)].bld;
        if (qb0 && !qb0.ref && (qb0.k === 1 || qb0.k === 2) && qb0.lv >= 2) { kk = qb0.k; break; }
      }
      if (!kk || c.dem[kk] <= DEM_MEGA) continue;
      let ok2 = true, subst = 0;
      const parks: [number, number][] = [], from: number[] = [];
      for (let dy = 0; dy < 3 && ok2; dy++) for (let dx = 0; dx < 3; dx++) {
        const qi = idx(w, x + dx, y + dy);
        if (mgDone[qi]) { ok2 = false; break; }
        const qt = tiles[qi], qb = qt.bld;
        if (qb && !qb.ref && qb.k === kk && qb.lv >= 2 && qb.pw && qb.wa && (!c.sewNeed || c.sewOk[qi]) && !qb.fire) { subst++; from.push(qi); continue; }
        if (qb && !qb.ref && qb.k === kk && qb.lv === 1 && !qb.fire) { from.push(qi); continue; }
        if (qb && !qb.ref && qb.k === 4) { parks.push([x + dx, y + dy]); from.push(qi); continue; }
        if (!qb && !qt.road && !qt.ruin && (qt.zone === kk || (!qt.zone && qt.t === 2))) continue;
        ok2 = false; break;
      }
      if (!ok2 || subst < MEGA_SUBST_MIN) continue;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) mgDone[idx(w, x + dx, y + dy)] = 1;
      if (c.rng.R() < P_MEGA) {
        const mk2 = kk === 1 ? 105 : 106, ages = from.map(i => tiles[i].bld!.age);
        for (const [px, py] of parks) c.unstampPark(px, py);
        for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
          const j2 = idx(w, x + dx, y + dy);
          mgDone[j2] = 1;
          const jt = tiles[j2]; jt.zone = 0;
          jt.bld = (dx === 0 && dy === 0) ? { k: mk2, lv: 1, v: 0, age: 0, pw: true, wa: true, h: 1, sz: 3 } as Bld : { k: mk2, ref: [x, y] } as unknown as Bld;
        }
        c.markLand(x + 1, y + 1, MEGA_LAND_R);
        out.push({ x, z: y, k: mk2, size: 3, v: 0, from, ages, clearedZone: true });
      }
    }
  }
  if (c.dem[1] <= DEM_TOWER && c.dem[2] <= DEM_TOWER) return out;   // 同上：兩邊都擋，塔掃描也不會有合格的
  for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
    const i0 = idx(w, x, y);
    if (mgDone[i0]) continue;
    const b0 = tiles[i0].bld;
    if (!b0 || b0.ref || (b0.k !== 1 && b0.k !== 2) || b0.lv < 2) continue;
    const kk = b0.k;
    if (c.dem[kk] <= DEM_TOWER) continue;
    const quad = [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]];
    let ok = true;
    for (const [qx, qy] of quad) {
      const qi = idx(w, qx, qy);
      if (mgDone[qi]) { ok = false; break; }
      const qb = tiles[qi].bld;
      if (!qb || qb.ref || qb.k !== kk || qb.lv < 2 || !qb.pw || !qb.wa || (c.sewNeed && !c.sewOk[qi]) || qb.fire) { ok = false; break; }
    }
    if (!ok) continue;
    if (c.rng.R() < P_TOWER) {
      const from = quad.map(([qx, qy]) => idx(w, qx, qy)), ages = from.map(i => tiles[i].bld!.age);
      for (const i of from) mgDone[i] = 1;
      const tk = kk === 1 ? 33 : 34;
      let v = 0;
      for (const [qx, qy] of quad) {
        const qt = tiles[idx(w, qx, qy)];
        if (qx === x && qy === y) { v = c.pickV(tk, 1, x, y, c.rng.ri(4)); qt.bld = { k: tk, lv: 1, v, age: 0, pw: true, wa: true, h: 1, sz: 2 } as Bld; }
        else qt.bld = { k: tk, ref: [x, y] } as unknown as Bld;
      }
      out.push({ x, z: y, k: tk, size: 2, v, from, ages, clearedZone: false });
    }
  }
  return out;
}

// 提示的字（55726、55753；合併一筆一則，金色）：巨廈帶人口與就業（MEGA_POP、MEGA_JOBS，jobs.ts）
export const mergeToastText = (k: number, megaPop: number, megaJobs: number) =>
  k === 105 ? `🌆 住宅巨廈拔地而起！（居民 ${megaPop} 人）` : k === 106 ? `🌆 商業綜合體開幕！（就業 ${megaJobs}）` : k === 33 ? '🏙️ 住宅摩天樓落成！' : '🏙️ 商業摩天樓落成！';

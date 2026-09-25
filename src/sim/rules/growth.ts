// 住商工的生長與升級（D009）：實驗線 tick() 55598–55651 @ d23c18d，逐行照搬，包括亂數被抽的順序
// （JavaScript 由左到右求值：pickV406(k,1,x,y,ri(12)) 先抽 ri(12) 再挑變體；升級那串 && 前面的閘門不過就不抽 R()）。
// 住房市場（T488）沒搬：新建住宅的密度＝道路等級（實驗線 housing488 沒就緒時的回退），升級的住房係數＝1。
import { clamp, cov, idx, tq, type Bld, type Fields, type Rng, type World } from './lab.ts';
import { getMaxRoadClass, hasRoadNear } from './grid.ts';
import { judgeWealth, pickV406 } from './land.ts';

export const POL_LV3_MAX = 15;   // 52993：lv2→3 要求污染低於此值

export interface GrowCtx {
  w: World; f: Fields; vrank: Record<string, number[]>; rng: Rng;
  dem: Record<number, number>;          // 1 住 2 商 3 工
  cityHappy: number; demoMul: number;
  tech: readonly string[];
  tickZone: readonly number[];          // 分區格索引（升序）
  tickBld: number[];                    // 建築格索引（升序）；新長的建築會接在後面（升級迴圈看得到，實驗線同）
  sewNeed: boolean; sewOk: ArrayLike<number>;   // 污水（T442）：500 人以上 lv2→3 要接管；起步城 false
  onIndustry?: (x: number, y: number) => void;  // 工業新生長＝污染源（實驗線 stampPolSrc）；污染場沒搬，交給呼叫端
}
export interface Spawned { x: number; y: number; b: Bld }

// 55598–55626：收候選 → 洗牌 → 每天最多 3 棟
export function spawnStep(g: GrowCtx): { cands: number[][]; spawned: Spawned[] } {
  const { w, f, rng, dem, cityHappy, demoMul } = g, N = w.N;
  const cands: number[][] = [];
  for (const iz of g.tickZone) {
    const x = iz % N, y = (iz / N) | 0;
    const t = w.tiles[iz];
    if (t.zone && !t.bld && !t.ruin && hasRoadNear(w, x, y, 2, true, true)) cands.push([x, y, t.zone]);
  }
  for (let i = cands.length - 1; i > 0; i--) { const j = rng.ri(i + 1); const tmp = cands[i]; cands[i] = cands[j]; cands[j] = tmp; }
  const order = cands.map(c => c.slice());
  let spawns = 0;
  const spawned: Spawned[] = [];
  for (const [x, y, z] of cands) {
    if (spawns >= 3) break;
    const hf = z === 1 ? clamp(cityHappy + .25, .3, 1) : 1;
    const landMul = 1 + (f.LAND[idx(w, x, y)] - 128) / 128 * .4;
    let p = .10 * (1 + dem[z] * .6 * hf) * landMul * (z === 1 ? demoMul : 1);
    if (dem[z] < -.5) p = 0;
    const cell = w.tiles[idx(w, x, y)];
    if (z === 1 && cityHappy < .4) p *= .5;
    if (cell.office) p *= 1.35;
    if (rng.R() < p) {
      const den = z === 1 ? clamp(getMaxRoadClass(w, x, y, 3), 1, 5) : undefined;
      const kk = cell.office ? 2 : z;
      const we = kk === 1 ? judgeWealth(w, f, x, y) : undefined;
      const fb = (kk === 1 || kk === 2 || kk === 3) ? rng.ri(12) : -1;
      const v = (kk === 1 || kk === 2 || kk === 3) ? pickV406(w, f, g.vrank, kk, 1, x, y, fb) : rng.ri(4);
      cell.bld = { k: kk, lv: 1, v, age: 0, pw: true, h: .6, den, we };
      g.tickBld.push(idx(w, x, y));
      if (kk === 3) g.onIndustry?.(x, y);
      spawned.push({ x, y, b: cell.bld });
      spawns++;
    }
  }
  return { cands: order, spawned };
}

// 55628–55651：每棟 age+1；住商工過閘門後擲 R()，升一級、屋齡歸零、重挑變體
export function upgradeStep(g: GrowCtx): { i: number; lv: number; v: number }[] {
  const { w, f, rng, dem } = g, N = w.N, out: { i: number; lv: number; v: number }[] = [];
  const has = (name: string, i: number) => (cov(f, name, i) as number) > 0;
  for (const i of g.tickBld) {
    const b = w.tiles[i].bld;
    if (!b || b.ref) continue;
    b.age++;
    if (b.k > 3) continue;
    const x = i % N, y = (i / N) | 0;
    const schoolBoost = (b.k === 1 && has('school', i)) ? 1.6 : 1;
    const libraryBoost = (b.k === 1 && has('library', i)) ? 1.25 : 1;
    const uniBoost = (b.k === 1 && has('university', i)) ? 1.8 : 1;
    const glBoost = (b.k === 1 && has('grandlib', i)) ? 1.5 : 1;
    const eduBoost = uniBoost > 1 ? uniBoost : (glBoost > 1 ? glBoost : schoolBoost);
    const instituteBoost = has('institute', i) ? 1.4 : 1;
    const lv2Gate = b.lv !== 1 || has('police', i) || has('police2', i);
    const lv3Gate = b.lv !== 2 || (has('school', i) && f.POL[i] < POL_LV3_MAX && (!g.sewNeed || !!g.sewOk[i]));
    const landUpMul = clamp(1 + (f.LAND[i] - 128) / 128 * (b.lv === 2 ? .8 : .4), .2, 1.8);
    const housingUpgradeMul = 1;
    if (b.lv < 3 && b.pw && (b.lv !== 2 || b.wa) && lv2Gate && lv3Gate && !b.fire && b.age > 14 && dem[b.k] > .15 && (b.k !== 1 || (b.h as number) > .45)
      && rng.R() < .035 * eduBoost * libraryBoost * instituteBoost * landUpMul * housingUpgradeMul * tq(g.tech, 'A5', 1.10, 1) * tq(g.tech, 'C2', 1.08, 1)) {
      b.lv++; b.age = 0;
      const fb = rng.ri(12);
      b.v = pickV406(w, f, g.vrank, b.k, b.lv, x, y, fb);
      if (b.den === undefined) b.den = 3;
      if (b.k === 1) b.we = judgeWealth(w, f, x, y);
      out.push({ i, lv: b.lv, v: b.v });
    }
  }
  return out;
}

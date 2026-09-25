// 地價靜態基準、財富、變體（D009）：出處見各函式行號（實驗線 index.html @ d23c18d）
import { clamp, cov, hashLocal479, idx, streetHash, type Fields, type Tile, type World } from './lab.ts';
import { countNear, urbanDens406 } from './grid.ts';

const on = (f: Fields, name: string, i: number) => (cov(f, name, i) as number) > 0;
const crimeNear = (w: World, x: number, y: number) => countNear(w, x, y, 4, (tt: Tile) => tt.bld && tt.bld.k <= 3 && tt.bld.crime);

// 53087：服務每種 +8、景觀（公園）最多 2 分 ×8、地鐵／可達性取大者；污染 ×1.2、噪音 ×0.4、半徑 4 內每個犯罪 −10；夾在 0..255
export function landStaticAt(w: World, f: Fields, x: number, y: number) {
  const i = idx(w, x, y);
  const svc = ((on(f, 'police', i) || on(f, 'police2', i)) ? 1 : 0) + ((on(f, 'fire', i) || on(f, 'fire2', i) || on(f, 'fireHQ', i)) ? 1 : 0) + (on(f, 'school', i) ? 1 : 0)
    + ((on(f, 'hospital', i) || on(f, 'clinic', i)) ? 1 : 0) + (on(f, 'library', i) ? 1 : 0) + (on(f, 'post', i) ? 1 : 0);
  const land = Math.min(2, (on(f, 'park', i) ? 1 : 0) + (on(f, 'cpark', i) ? 1 : 0) + (on(f, 'gpark', i) ? 2 : 0));
  const crime = crimeNear(w, x, y);
  return clamp(128 + svc * 8 + land * 8 + Math.max(f.METRO_TOD467B[i] || 0, f.ACCESS468[i] || 0) - (f.POL[i] || 0) * 1.2 - (f.NOISE[i] || 0) * .4 - crime * 10, 0, 255);
}

// 53204：0 貧、1 中、2 富。住房市場（T488）沒搬：實驗線 housing488 沒就緒時 housingTerm＝0，這裡只有這一支
export function judgeWealth(w: World, f: Fields, x: number, y: number) {
  const i = idx(w, x, y);
  const c = ((on(f, 'police', i) || on(f, 'police2', i)) ? 1 : 0) + (on(f, 'school', i) ? 1 : 0) + (on(f, 'hospital', i) ? 1 : 0) + (on(f, 'park', i) ? 1 : 0);
  const crime = crimeNear(w, x, y);
  const landTerm = (f.LAND[i] - 128) / 128;
  const commuteTerm = -(f.commutePenalty[i] || 0) * 3;
  const eduTerm = (f.EDU[i] / 255) * .6;
  const housingTerm = 0;
  const score = c - (f.POL[i] || 0) * .05 - crime * .4 + landTerm * .5 + commuteTerm + eduTerm + housingTerm;
  if (score >= 2) return 2;
  if (score > 0) return 1;
  return 0;
}

// 53185：住商工變體＝依「由矮到高」排名挑；傾向（中心性、地價）＋決定性散佈＋8×8 街廓風格偏置。排名表殘缺就回 fallback
// vrank：實驗線開機時依精靈圖高度排出來的 VRANK406（執行期資料，抽取時從實驗線頁面讀）
export function pickV406(w: World, f: Fields, vrank: Record<string, number[]>, k: number, lv: number, x: number, y: number, fallback: number) {
  const rank = vrank[k + '_' + lv];
  if (!rank || rank.length < 2) return fallback;
  const dens = urbanDens406(w, x, y);
  const lnd = clamp((f.LAND[idx(w, x, y)] - 128) / 48, 0, 1);
  const tend = dens * .58 + lnd * .20;
  const q = streetHash(x, y, 4060);
  const cohort = hashLocal479(x >> 3, y >> 3, 56901);
  const bias = (cohort < .33) ? -.18 : (cohort > .67) ? .18 : 0;
  const s = clamp(tend * .45 + q * .60 + bias, 0, .999);
  return rank[Math.floor(s * rank.length)];
}

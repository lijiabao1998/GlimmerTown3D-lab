// D019 對拍的操作劇本與本線那一半（驗收 3、4）：實驗線頁面（tools/d016-parity.mjs --set=d019）和本線（這裡的 prebuilt19／sample19）吃同一份劇本，
// 格式與逐筆的做法同 tools/d011-ops.mjs（run3d、頁面裡的 apply）；量法同 tools/d011-parity-lib.mjs（同一段原始碼）。
//   預建城（d011-prebuilt.code.txt 換種子）：錢設 20000；住商工最北那一排的下一列拉一條橫貫的配水管（拉線工具；水上那幾格拒絕），
//     在它北邊找格索引順序第一格空地放一座水塔（接通）；最南那一排的下一列另拉一段、不接水塔（沒接通：旁邊的住宅沒有水）→ 推進一天。
//     比每一筆、水管圖層、接通的水管格（wr）、推進後每一棟住商工與社宅的電與水、推進前就在的住宅幸福（直接相等，同 D016；垃圾 D020、糧食 D022 搬了）、住商工以外的格子與場、生長之前的抽取。
//   樣本城（AI 城 120 天、種子城）：讀進來推進一天，比每一棟的電與水、接通的水管格。
import { loadCode, saveCode } from '../src/io/save.ts';
import { harness, invOf, pwOf, hsOf, diffOf, row3d } from './d011-parity-lib.mjs';

// 量法（實驗線頁面、本線同一段）：住商工與社宅 [格索引, 有水]；水管格；接通的水管格
export const WA_SRC = `(tiles=>{const o=[];for(let i=0;i<tiles.length;i++){const b=tiles[i].bld;if(b&&!b.ref&&((b.k>=1&&b.k<=3)||b.k===127))o.push([i,b.wa?1:0]);}return o;})`;
export const WP_SRC = `(tiles=>{const o=[];for(let i=0;i<tiles.length;i++)if(tiles[i].wp)o.push(i);return o;})`;
export const WR_SRC = `(tiles=>{const o=[];for(let i=0;i<tiles.length;i++)if(tiles[i].wr)o.push(i);return o;})`;
export const waOf = new Function(`return ${WA_SRC}`)(), wpOf = new Function(`return ${WP_SRC}`)(), wrOf = new Function(`return ${WR_SRC}`)();

export function prebuilt19Ops(s) {
  const n = s.w.N, T = s.w.tiles, towers = [], rci = [];
  const land = i => T[i].t === 1 || T[i].t === 2, free = i => land(i) && !T[i].road && !T[i].bld && !T[i].ruin && !T[i].crater;
  T.forEach((t, i) => { if (t.bld && !t.bld.ref && t.bld.k >= 1 && t.bld.k <= 3) rci.push([i % n, (i / n) | 0]); });
  if (!rci.length) throw new Error('D019 預建城劇本：沒有住商工');
  const zs = rci.map(q => q[1]), xs = rci.map(q => q[0]), z0 = Math.min(...zs), z1 = Math.max(...zs), x0 = Math.min(...xs), x1 = Math.max(...xs);
  // 第一條：住商工最北那一排的下一列，橫貫整張圖，接一座水塔（接通）；第二條：最南那一排的下一列，只蓋住商工那一段、不接水塔（沒接通）
  const ops = [{ k: 'money', v: 20000 }, { k: 'line', tool: 'wpipe', x0: 0, z0: z0 + 1, x1: n - 1, z1: z0 + 1 }];
  let x = 0; while (x < n && !(land((z0 + 1) * n + x) && free(z0 * n + x))) x++;
  if (x >= n) throw new Error(`D019 預建城劇本：第 ${z0} 列找不到放水塔的地方`);
  ops.push({ k: 'tap', tool: 'water', x, z: z0 }); towers.push([x, z0]);
  ops.push({ k: 'line', tool: 'wpipe', x0: Math.max(0, x0 - 3), z0: z1 + 1, x1: Math.min(n - 1, x1 + 3), z1: z1 + 1 });
  return { ops, towers, rows: [z0 + 1, z1 + 1] };
}

// 預建城：劇本 → 推進一天
export function prebuilt19(code, KT, vrank) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進預建城：' + L.error);
  const s = L.sim, P = prebuilt19Ops(s), h = harness(s);
  const out = { mig: L.restyled, snap0: h.head(h.snap()) };
  out.ops = h.batch(P.ops);
  const a = h.snap();
  out.snapOps = h.head(a); out.wp = wpOf(s.w.tiles); out.wrOps = wrOf(s.w.tiles);
  out.pwBefore = pwOf(s.w.tiles).map(r => r[0]); out.hsBefore = hsOf(s.w.tiles).map(r => r[0]); out.waBefore = waOf(s.w.tiles).map(r => r[0]);
  const t = h.tick(), b = h.snap();
  out.tickDraws = t.draws; out.tickSites = t.sites; out.tickLand = t.land; out.tickExtra = t.extra; out.day1 = row3d(s); out.settle = t.rep.settle; out.garb = t.rep.garb; out.food = t.rep.food;
  out.post = h.head(b, false); out.postChanged = diffOf(a.proj, b.proj);
  out.inv = invOf(s.w.tiles, s.g.COV, s.g.POLTREE, s.g.LANDBASE, s.g.LAND); out.pw = pwOf(s.w.tiles); out.hs = hsOf(s.w.tiles); out.wa = waOf(s.w.tiles); out.wr = wrOf(s.w.tiles);
  out.code = saveCode(s, L.template, L.start);
  out.P = P; out.sim = s; out.load = L;
  return out;
}
// 樣本城：讀進來推進一天
export function sample19(code, KT, vrank) {
  const L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('本線讀不進樣本城：' + L.error);
  const s = L.sim, h = harness(s), t = h.tick();
  return { mig: L.restyled, tickDraws: t.draws, tickSites: t.sites, garb: t.rep.garb, food: t.rep.food, wa: waOf(s.w.tiles), pw: pwOf(s.w.tiles), wr: wrOf(s.w.tiles), wp: wpOf(s.w.tiles), sim: s };
}

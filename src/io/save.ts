// 存檔（D011）：用 2D 實驗線的分享碼格式存目前的城（CLAUDE.md 規則 9），貼進實驗線就能開。
// 格式照實驗線 save()（index.html 66707–66798 @d23c18d）：逐格圖層一格一字元、建築一筆 [i,k,lv,v,age,(火災|體育場 sz),(密度),(財富)]、
// 資金取整（66747）、day、msIdx、star（bestStar）、df（難度）、ln（貸款）。
// 本線自己的資料放附加欄位 d3（實驗線 load 不讀它，匯入照樣成功；tools/lab-extract.mjs --part=d011 驗過）：
//   f＝城市格式（CITY_FORMAT）、s＝起始那張分享碼、h＝世界歷史、g＝下一筆手勢的編號。
// 讀檔照實驗線 load 的語意（亂數 seed^day 重設、天氣重設：src/sim/day.ts simFromSave）；城市（編號、蓋起日、墓碑、歷史）由 d3 重播，
// 再跟存檔裡的格子、建築逐項核對，對不上就退回只用存檔（歷史從這張碼重新起算），並回報原因。
// 純邏輯：不碰 DOM、localStorage（那是介面的事）。
import { decodeLabCode, encodeLabCode } from './labcode.ts';
import { CITY_FORMAT, cityStats, roadCode, type City, type CityBuilding, type CityEvent, type KindTable } from '../sim/city.ts';
import { replayCity } from '../sim/replay.ts';
import { simFromSave, type Sim } from '../sim/day.ts';

export interface D3Ext { f: number; s: string; h: CityEvent[]; g: number }

// 存檔：template＝這座城讀進來時的整份存檔 JSON（LabSave.raw），本線不認得的欄位原樣保留
export function saveCode(s: Sim, template: Record<string, unknown>, start: string): string {
  const N = s.w.N, nn = N * N, o: Record<string, unknown> = { ...template };
  delete o.z;   // encodeLabCode 會重新壓、重新標
  let tre = '', rd = '', zn = '', rcl = '', ab = '';
  const bl: number[][] = [];
  for (let i = 0; i < nn; i++) {
    const t = s.w.tiles[i], b = t.bld;
    tre += String.fromCharCode(48 + (t.tree || 0)); rd += roadCode(t.road, t.hw, t.bridge); zn += t.zone || 0; rcl += String.fromCharCode(48 + (t.rc || 0));
    ab += b && !b.ref && (b as { abandoned?: unknown }).abandoned ? 1 : 0;
    if (b && !b.ref) {                                                       // 66740–66756：多格建築只存根格
      const e = [i, b.k, b.lv, b.v, b.age];
      if (b.k === 9) e.push(b.sz || 2);
      else if (b.fire) e.push(+b.fire);
      if (b.k === 1 && b.den && b.den !== 3) { if (!b.fire) e.push(0); e.push(b.den); }
      if (b.k === 1 && b.we !== undefined && b.we !== 1) { if (e.length < 6) e.push(0); if (e.length < 7) e.push(b.den || 3); e.push(b.we); }
      bl.push(e);
    }
  }
  const d3: D3Ext = { f: CITY_FORMAT, s: start, h: s.city.history, g: s.stroke };
  Object.assign(o, {
    v: 1, n: N, seed: s.seed, day: s.day, money: Math.round(s.money), msIdx: s.msIdx, star: s.bestStar, df: s.diff,
    ln: s.loan ? [s.loan.remain, s.loan.daily] : null, nm: s.city.name, tre, rd, zn, rcl, ab, bl, d3,
  });
  return encodeLabCode(o, { deflate: true });
}

export type LoadResult =
  | { ok: true; sim: Sim; start: string; template: Record<string, unknown>; replayed: boolean; note: string }
  | { ok: false; error: string };

// 讀檔：一般的實驗線分享碼也吃（沒有 d3 就是一座新匯入的城，歷史從這張碼起算）
export function loadCode(code: string, kinds: KindTable, vrank: Record<string, number[]>): LoadResult {
  const r = decodeLabCode(code);
  if (!r.ok) return r;
  const sim = simFromSave(r.save, code, kinds, vrank);
  const d3 = r.save.raw.d3 as D3Ext | undefined;
  if (!d3 || typeof d3 !== 'object' || !Array.isArray(d3.h) || typeof d3.s !== 'string') return { ok: true, sim, start: code, template: r.save.raw, replayed: false, note: '沒有本線的歷史：從這張碼開始記' };
  let c: City;
  try { c = replayCity(d3.s, d3.h, kinds, r.save.day); }
  catch (e) { return { ok: true, sim, start: code, template: r.save.raw, replayed: false, note: '歷史重播失敗，只用存檔：' + (e as Error).message }; }
  const bad = mismatch(c, sim.city);
  if (bad) return { ok: true, sim, start: code, template: r.save.raw, replayed: false, note: '歷史跟存檔對不上，只用存檔：' + bad };
  // 對得上：城市換成重播出來的（編號、蓋起日、墓碑、歷史都在），根格對照表照新的編號重建
  c.name = sim.city.name;
  sim.city = c;
  sim.root.clear();
  for (const b of c.buildings) if (b.goneDay === undefined) sim.root.set(b.z * c.n + b.x, b);
  for (const [i, b] of sim.root) { const t = sim.w.tiles[i].bld; if (t) { b.age = t.age; b.lv = t.lv; b.v = t.v; } }
  sim.stroke = typeof d3.g === 'number' ? d3.g : 1;
  return { ok: true, sim, start: d3.s, template: r.save.raw, replayed: true, note: `歷史 ${d3.h.length} 筆重播成功` };
}

// 重播的城跟存檔的城要一樣：對帳數字、逐格路／等級／分區／樹／occ 對到的根格、每棟還在的建築（種類、等級、變體、屋齡、位置）
function mismatch(a: City, b: City): string | null {
  const sa = JSON.stringify(cityStats(a)), sb = JSON.stringify(cityStats(b));
  if (sa !== sb) return '對帳數字不同';
  const n = a.n, rootOf = (c: City, i: number) => { const id = c.occ[i]; if (!id) return -1; const q = c.buildings[id - 1]; return q.z * n + q.x; };
  for (let i = 0; i < n * n; i++) {
    if (a.road[i] !== b.road[i] || a.rclass[i] !== b.rclass[i] || a.zone[i] !== b.zone[i] || a.tree[i] !== b.tree[i]) return `第 ${i} 格的地面不同`;
    if (rootOf(a, i) !== rootOf(b, i)) return `第 ${i} 格的建築不同`;
  }
  const key = (q: CityBuilding) => [q.x, q.z, q.k, q.lv, q.v, q.age].join(',');
  const la = a.buildings.filter(q => q.goneDay === undefined).map(key).sort().join(';'), lb = b.buildings.filter(q => q.goneDay === undefined).map(key).sort().join(';');
  return la === lb ? null : '建築（種類、等級、變體、屋齡）不同';
}

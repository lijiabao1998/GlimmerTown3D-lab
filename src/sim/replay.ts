// 世界歷史重播（D010 起，規則 4）：從「匯入那張分享碼」加上逐筆事件，重建出城市（建築清單、路、分區、樹、occ）。
// 格式 1（只有匯入一筆）重播出來就是 cityFromLab 的結果；格式 2 另外套用 grow／upgrade；格式 3（D011）再套用玩家施工：
//   road／zone／place／doze 一格一筆，照實驗線 doPlace 的格子寫法（51641–51818）；undo 把第 g 筆手勢碰過的格子整格還原（T460 66594）。
// 屋齡不存在事件裡，照實驗線的規則推（tick() 55628 起的升級迴圈對每棟非 ref 建築 age+1，新長的當天就會被加到；升級那天歸零）：
//   匯入的：匯入時 age ＋（結束日 − 匯入日）；第 d 天長出、沒升級過：1 ＋（結束日 − d）；最後一次在第 u 天升級：結束日 − u；
//   第 d 天玩家蓋的（在第 d 天的 tick 之後）：結束日 − d（doPlace 給 age 0，51672）；拆掉的：屋齡停在拆的那一天。
// 未知的事件種類直接丟例外（不猜）。純邏輯。
import { decodeLabCode } from '../io/labcode.ts';
import { cityFromLab, roadCode, type City, type CityBuilding, type CityEvent, type KindTable } from './city.ts';
import { fnv1a } from './rng.ts';

interface Stroke { tiles: Map<number, [number, number, number, number, number]>; created: number[]; removed: number[] }

export function replayCity(code: string, events: readonly CityEvent[], kinds: KindTable, endDay?: number): City {
  const imp = events[0];
  if (!imp || imp.t !== 'import') throw new Error('重播：第一筆必須是匯入事件');
  if (fnv1a(code) !== imp.codeHash) throw new Error('重播：分享碼跟匯入事件記的雜湊不同');
  const r = decodeLabCode(code);
  if (!r.ok) throw new Error('重播：分享碼解不開：' + r.error);
  const c = cityFromLab(r.save, kinds, code), n = c.n, D0 = r.save.day;
  const E = endDay ?? Math.max(D0, ...events.map(e => e.day));
  const base = new Map<number, { age: number; from: number }>();   // 還在的建築 id → 屋齡從哪一天、從多少起算
  for (const b of c.buildings) base.set(b.id, { age: b.age, from: D0 });
  const strokes = new Map<number, Stroke>();
  const strokeOf = (g: number) => { let s = strokes.get(g); if (!s) { s = { tiles: new Map(), created: [], removed: [] }; strokes.set(g, s); } return s; };
  const touch = (s: Stroke, i: number) => { if (!s.tiles.has(i)) s.tiles.set(i, [c.road[i], c.rclass[i], c.zone[i], c.tree[i], c.occ[i]]); };
  const footprint = (b: CityBuilding, f: (j: number) => void) => { for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) if (b.x + dx < n && b.z + dz < n) f((b.z + dz) * n + b.x + dx); };
  const bury = (b: CityBuilding, day: number) => {   // 拆掉：墓碑、occ 清空、屋齡停在這一天
    const s = base.get(b.id)!;
    b.age = s.age + (day - s.from); base.delete(b.id); b.goneDay = day;
    footprint(b, j => { if (c.occ[j] === b.id) c.occ[j] = 0; });
  };
  for (const e of events.slice(1)) {
    const i = e.t === 'undo' || e.t === 'import' ? -1 : e.z * n + e.x;
    switch (e.t) {
      case 'import': throw new Error('重播：匯入事件只能是第一筆');
      case 'grow': {
        if (c.occ[i]) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 已經有建築`);
        const size = kinds.size(e.k);
        const b: CityBuilding = { id: c.buildings.length + 1, k: e.k, lv: e.lv, v: e.v, age: 0, x: e.x, z: e.z, size, abandoned: false, builtDay: e.day };
        c.buildings.push(b);
        footprint(b, j => { c.occ[j] = b.id; });
        base.set(b.id, { age: 1, from: e.day });
        break;
      }
      case 'upgrade': {
        const b = c.buildings[c.occ[i] - 1];
        if (!b || b.x !== e.x || b.z !== e.z) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 沒有可升級的建築`);
        b.lv = e.lv; b.v = e.v;
        base.set(b.id, { age: 0, from: e.day });
        break;
      }
      case 'road': {   // 51645：road=1、rc、hw（rc 5）、bridge（水上）；清掉樹、分區
        touch(strokeOf(e.g), i);
        c.road[i] = roadCode(1, e.rc === 5, c.ter[i] === 0); c.rclass[i] = e.rc; c.zone[i] = 0; c.tree[i] = 0;
        break;
      }
      case 'zone': {   // 51665：zone；清掉樹
        touch(strokeOf(e.g), i);
        c.zone[i] = e.zone; c.tree[i] = 0;
        break;
      }
      case 'place': {  // 51672／51687：新建築 lv 1、age 0；清掉樹、分區
        if (c.occ[i]) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 已經有建築，不能放`);
        if (e.id !== c.buildings.length + 1) throw new Error(`重播：第 ${e.day} 天放的建築編號 ${e.id} ≠ ${c.buildings.length + 1}`);
        const s = strokeOf(e.g), size = kinds.size(e.k);
        const b: CityBuilding = { id: e.id, k: e.k, lv: e.lv, v: e.v, age: 0, x: e.x, z: e.z, size, abandoned: false, builtDay: e.day };
        footprint(b, j => touch(s, j));
        c.buildings.push(b);
        footprint(b, j => { c.occ[j] = b.id; });
        c.tree[i] = 0; c.zone[i] = 0;
        base.set(b.id, { age: 0, from: e.day });
        s.created.push(b.id);
        break;
      }
      case 'doze': {   // 51776–51818：一次拆一層；拆建築時分區留著
        const s = strokeOf(e.g);
        if (e.layer === 'bld') {
          const b = c.buildings[(e.id ?? c.occ[i]) - 1];
          if (!b || b.goneDay !== undefined) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 沒有可拆的建築`);
          footprint(b, j => touch(s, j));
          bury(b, e.day);
          s.removed.push(b.id);
        } else {
          touch(s, i);
          if (e.layer === 'road') { c.road[i] = 0; c.rclass[i] = 0; }
          else if (e.layer === 'zone') c.zone[i] = 0;
          else c.tree[i] = 0;
        }
        break;
      }
      case 'undo': {   // 同一天：碰過的格子整格還原；這一筆放的建築變墓碑、拆掉的回來
        const s = strokes.get(e.g);
        if (!s) throw new Error(`重播：第 ${e.day} 天要復原的第 ${e.g} 筆手勢不存在`);
        for (const id of s.created) { const b = c.buildings[id - 1]; if (b.goneDay === undefined) bury(b, e.day); }
        for (const id of s.removed) { const b = c.buildings[id - 1]; delete b.goneDay; base.set(b.id, { age: b.age, from: e.day }); }
        for (const [j, [rd, rc, zn, tr, oc]] of s.tiles) { c.road[j] = rd; c.rclass[j] = rc; c.zone[j] = zn; c.tree[j] = tr; c.occ[j] = oc; }
        strokes.delete(e.g);
        break;
      }
      default: throw new Error('重播：不認得的事件 ' + JSON.stringify(e));
    }
    c.history.push({ ...e });
  }
  for (const b of c.buildings) { const s = base.get(b.id); if (s) b.age = s.age + (E - s.from); }
  c.day = E;
  return c;
}

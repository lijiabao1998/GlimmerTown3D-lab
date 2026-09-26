// 世界歷史重播（D010，規則 4）：從「匯入那張分享碼」加上逐筆生長、升級事件，重建出城市的建築清單。
// 格式 1（只有匯入一筆）重播出來就是 cityFromLab 的結果；格式 2 另外套用 grow／upgrade。
// 屋齡不存在事件裡，照實驗線的規則推（tick() 55628 起的升級迴圈對每棟非 ref 建築 age+1，新長的當天就會被加到；升級那天歸零）：
//   匯入的：匯入時 age ＋（結束日 − 匯入日）；第 d 天長出、沒升級過：1 ＋（結束日 − d）；最後一次在第 u 天升級：結束日 − u。
// 純邏輯。
import { decodeLabCode } from '../io/labcode.ts';
import { cityFromLab, type City, type CityEvent, type KindTable } from './city.ts';
import { fnv1a } from './rng.ts';

export function replayCity(code: string, events: readonly CityEvent[], kinds: KindTable, endDay?: number): City {
  const imp = events[0];
  if (!imp || imp.t !== 'import') throw new Error('重播：第一筆必須是匯入事件');
  if (fnv1a(code) !== imp.codeHash) throw new Error('重播：分享碼跟匯入事件記的雜湊不同');
  const r = decodeLabCode(code);
  if (!r.ok) throw new Error('重播：分享碼解不開：' + r.error);
  const c = cityFromLab(r.save, kinds, code), n = c.n, D0 = r.save.day;
  const E = endDay ?? Math.max(D0, ...events.map(e => e.day));
  const base = new Map<number, { age: number; from: number }>();   // 建築 id → 屋齡從哪一天、從多少起算
  for (const b of c.buildings) base.set(b.id, { age: b.age, from: D0 });
  for (const e of events.slice(1)) {
    if (e.t === 'import') throw new Error('重播：匯入事件只能是第一筆');
    const i = e.z * n + e.x;
    if (e.t === 'grow') {
      if (c.occ[i]) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 已經有建築`);
      const size = kinds.size(e.k);
      const b = { id: c.buildings.length + 1, k: e.k, lv: e.lv, v: e.v, age: 0, x: e.x, z: e.z, size, abandoned: false, builtDay: e.day };
      c.buildings.push(b);
      for (let dz = 0; dz < size; dz++) for (let dx = 0; dx < size; dx++) if (e.x + dx < n && e.z + dz < n) c.occ[(e.z + dz) * n + e.x + dx] = b.id;
      base.set(b.id, { age: 1, from: e.day });
    } else {
      const b = c.buildings[c.occ[i] - 1];
      if (!b || b.x !== e.x || b.z !== e.z) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 沒有可升級的建築`);
      b.lv = e.lv; b.v = e.v;
      base.set(b.id, { age: 0, from: e.day });
    }
    c.history.push({ ...e });
  }
  for (const b of c.buildings) { const s = base.get(b.id)!; b.age = s.age + (E - s.from); }
  c.day = E;
  return c;
}

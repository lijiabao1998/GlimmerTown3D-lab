// 世界歷史重播（D010 起，規則 4）：從「匯入那張分享碼」加上逐筆事件，重建出城市（建築清單、路、分區、樹、occ）。
// 格式 1（只有匯入一筆）重播出來就是 cityFromLab 的結果；格式 2 另外套用 grow／upgrade；格式 3（D011）再套用玩家施工：
//   road／zone／place／doze 一格一筆，照實驗線 doPlace 的格子寫法（51641–51818）；undo 把第 g 筆手勢碰過的格子整格還原（T460 66594）。
//   格式 4（D012）再套用 restyle：讀檔時照實驗線重挑的外觀變體（只換 v）。格式 5（D019）再套用 pipe（鋪水管）與拆除的水管那一層。
//   格式 6（D026）再套用每天的災禍：burn（燒毀成焦土）、abandon（廢棄）；fire、crime、sick、death、act 只核對那一格有建築；拆除多了 ruin（焦土）那一層。
// 屋齡不存在事件裡，照實驗線的規則推（tick() 55628 起的升級迴圈對每棟非 ref 建築 age+1，新長的當天就會被加到；升級那天歸零）：
//   匯入的：匯入時 age ＋（結束日 − 匯入日）；第 d 天長出、沒升級過：1 ＋（結束日 − d）；最後一次在第 u 天升級：結束日 − u；
//   第 d 天玩家蓋的（在第 d 天的 tick 之後）：結束日 − d（doPlace 給 age 0，51672）；拆掉的：屋齡停在拆的那一天。
//   格式 7（D034）再套用 merge：吸收的建築埋掉、蓋 2×2 塔或 3×3 巨廈（巨廈清九格分區）。
// 未知的事件種類直接丟例外（不猜）。純邏輯。
import { decodeLabCode } from '../io/labcode.ts';
import { cityFromLab, roadCode, DECISION_EVENTS, MERGE_SIZE, type City, type CityBuilding, type CityEvent, type KindTable } from './city.ts';
import { fnv1a } from './rng.ts';

interface Stroke { tiles: Map<number, [number, number, number, number, number, number, number]>; created: number[]; removed: number[] }   // 路、路等級、分區、樹、佔用、水管、焦土（D026）

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
  const touch = (s: Stroke, i: number) => { if (!s.tiles.has(i)) s.tiles.set(i, [c.road[i], c.rclass[i], c.zone[i], c.tree[i], c.occ[i], c.wp[i], c.ruin[i]]); };
  const footprint = (b: CityBuilding, f: (j: number) => void) => { for (let dz = 0; dz < b.size; dz++) for (let dx = 0; dx < b.size; dx++) if (b.x + dx < n && b.z + dz < n) f((b.z + dz) * n + b.x + dx); };
  const bury = (b: CityBuilding, day: number) => {   // 拆掉：墓碑、occ 清空、屋齡停在這一天
    const s = base.get(b.id)!;
    b.age = s.age + (day - s.from); base.delete(b.id); b.goneDay = day;
    footprint(b, j => { if (c.occ[j] === b.id) c.occ[j] = 0; });
  };
  for (let k = 1; k < events.length; k++) {
    const e = events[k], i = e.t === 'undo' || e.t === 'import' || e.t === 'cms' || DECISION_EVENTS.includes(e.t) ? -1 : (e as { z: number; x: number }).z * n + (e as { z: number; x: number }).x;
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
      case 'place': {  // 51672／51687：新建築 lv 1、age 0；清掉樹、分區（整塊占地）
        if (c.occ[i]) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 已經有建築，不能放`);
        if (e.id !== c.buildings.length + 1) throw new Error(`重播：第 ${e.day} 天放的建築編號 ${e.id} ≠ ${c.buildings.length + 1}`);
        const s = strokeOf(e.g), size = kinds.size(e.k);
        const b: CityBuilding = { id: e.id, k: e.k, lv: e.lv, v: e.v, age: 0, x: e.x, z: e.z, size, abandoned: false, builtDay: e.day };
        footprint(b, j => touch(s, j));
        c.buildings.push(b);
        footprint(b, j => { c.occ[j] = b.id; });
        footprint(b, j => { c.tree[j] = 0; c.zone[j] = 0; });   // D044：多格建築（太空研究中心 3×3）整塊占地都清樹、清分區（52331–52338）；1×1 就是根格自己
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
          else if (e.layer === 'wp') c.wp[i] = 0;                         // D019：51810
          else if (e.layer === 'ruin') { c.ruin[i] = 0; c.zone[i] = 0; }  // D026：51777 焦土優先——ruin 清掉、分區一起清掉
          else c.tree[i] = 0;
        }
        break;
      }
      case 'pipe': {   // D019：51679 只設 wp（不清樹、不清分區）
        touch(strokeOf(e.g), i);
        c.wp[i] = 1;
        break;
      }
      case 'undo': {   // 同一天：碰過的格子整格還原；這一筆放的建築變墓碑、拆掉的回來
        const s = strokes.get(e.g);
        if (!s) throw new Error(`重播：第 ${e.day} 天要復原的第 ${e.g} 筆手勢不存在`);
        for (const id of s.created) { const b = c.buildings[id - 1]; if (b.goneDay === undefined) bury(b, e.day); }
        for (const id of s.removed) { const b = c.buildings[id - 1]; delete b.goneDay; base.set(b.id, { age: b.age, from: e.day }); }
        for (const [j, [rd, rc, zn, tr, oc, wp, ru]] of s.tiles) { c.road[j] = rd; c.rclass[j] = rc; c.zone[j] = zn; c.tree[j] = tr; c.occ[j] = oc; c.wp[j] = wp; c.ruin[j] = ru; }
        strokes.delete(e.g);
        break;
      }
      case 'restyle': {   // D012：讀檔時照實驗線重挑外觀（T531）——只換 v，不動等級、屋齡
        const b = c.buildings[c.occ[i] - 1];
        // 同一次讀檔的重挑都是同一天，日子分不出是哪一筆：另外講出第幾筆（D012 審查）
        if (!b || b.x !== e.x || b.z !== e.z || (b.k | 0) < 1 || (b.k | 0) > 3) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 沒有可以重挑外觀的住商工（歷史第 ${k + 1} 筆）`);
        b.v = e.v;
        break;
      }
      // D026（城市格式 6）：災禍。起火、犯罪、生病、死亡、玩家的處置不改城市的樣子（旗標不在城市模型裡），只確認那一格有建築（歷史壞了要講出來）；
      // 燒毀＝墓碑＋焦土（分區留著，實驗線 55796）；廢棄＝abandoned（55830）
      case 'fire': case 'crime': case 'sick': case 'death': case 'act': {
        const b = c.buildings[c.occ[i] - 1];
        if (!b || b.x !== e.x || b.z !== e.z) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 沒有建築，不會有${e.t === 'act' ? '處置' : '災禍'}（歷史第 ${k + 1} 筆）`);
        break;
      }
      case 'burn': {
        const b = c.buildings[e.id - 1];
        if (!b || b.goneDay !== undefined || b.x !== e.x || b.z !== e.z) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 沒有可燒毀的建築 #${e.id}（歷史第 ${k + 1} 筆）`);
        bury(b, e.day); c.ruin[i] = 1;
        break;
      }
      // D034（城市格式 7）：合併。吸收的建築成了墓碑（屋齡停在這一天、占的格清空）；新建築（編號＝清單長度 + 1、屋齡 0 從這一天起算）蓋在根格上；巨廈清九格分區（塔不清）
      case 'merge': {
        const size = MERGE_SIZE[e.k];
        if (!size || size !== e.size || kinds.size(e.k) !== size) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 的合併種類 ${e.k} 邊長 ${e.size} 不對（歷史第 ${k + 1} 筆）`);
        for (const id of e.from) {
          const b = c.buildings[id - 1];
          if (!b || b.goneDay !== undefined || b.size !== 1) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 沒有可吸收的建築 #${id}（歷史第 ${k + 1} 筆）`);
          bury(b, e.day);
        }
        const nb: CityBuilding = { id: c.buildings.length + 1, k: e.k, lv: 1, v: e.v, age: 0, x: e.x, z: e.z, size, abandoned: false, builtDay: e.day };
        c.buildings.push(nb);
        footprint(nb, j => { if (c.occ[j]) throw new Error(`重播：第 ${e.day} 天合併的格子 ${j} 還被 #${c.occ[j]} 佔著（歷史第 ${k + 1} 筆）`); c.occ[j] = nb.id; if (e.k === 105 || e.k === 106) c.zone[j] = 0; });
        base.set(nb.id, { age: 0, from: e.day });
        break;
      }
      // D039（城市格式 8）：玩家的決策與科技完成——整座城的事，不改城市的樣子（政策、預算、研究、方向在模擬的狀態裡，不在城市模型裡）；`decisionsOf` 讀它們
      case 'policy': case 'budget': case 'research': case 'spec': case 'techdone': break;
      // D045（城市格式 10）：市長委託——整座城的事，不改城市的樣子（委託的狀態在模擬的 cms385 裡）
      case 'cms': break;
      // D040（城市格式 9）：資源耗盡——不改城市的樣子，只確認那一格有那一種井（歷史壞了要講出來）
      case 'depleted': {
        const b = c.buildings[c.occ[i] - 1];
        if (!b || b.x !== e.x || b.z !== e.z || b.k !== e.k) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 沒有 ${e.k === 49 ? '油井' : '礦場'}，不會耗盡（歷史第 ${k + 1} 筆）`);
        break;
      }
      case 'abandon': {
        const b = c.buildings[e.id - 1];
        if (!b || b.goneDay !== undefined || b.x !== e.x || b.z !== e.z) throw new Error(`重播：第 ${e.day} 天 (${e.x},${e.z}) 沒有可廢棄的建築 #${e.id}（歷史第 ${k + 1} 筆）`);
        b.abandoned = true;
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

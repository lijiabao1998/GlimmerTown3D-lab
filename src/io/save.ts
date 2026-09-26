// 存檔（D011）：用 2D 實驗線的分享碼格式存目前的城（CLAUDE.md 規則 9），貼進實驗線就能開。
// 格式照實驗線 save()（index.html 66707–66798 @d23c18d）：逐格圖層一格一字元、建築一筆 [i,k,lv,v,age,(火災|體育場 sz),(密度),(財富)]、
// 資金取整（66747）、day、msIdx、star（bestStar）、df（難度）、ln（貸款）。
// 本線自己的資料放附加欄位 d3（實驗線 load 不讀它，匯入照樣成功；tools/lab-extract.mjs --part=d011 驗過）：
//   f＝城市格式（CITY_FORMAT）、s＝起始那張分享碼、g＝下一筆手勢的編號、hv＝歷史的存法、r（hv 2）或 h（hv 1）＝世界歷史。
// 歷史的存法（規則 4：格式一改就加版本號、舊檔要能讀）：
//   hv 1（D011 第一版，沒有 hv 欄位）：h＝事件物件陣列，每筆約 59 字元。
//   hv 2（D011 審查後）：r＝緊湊列，每筆一個陣列 [種類碼, 距上一筆的天數, 欄位…]，手勢編號也存差值；每筆約 18 字元，同一座城的存檔約短 3 倍。
//   讀檔兩種都認；存檔一律 hv 2。
// 讀檔照實驗線 load 的語意（亂數 seed^day 重設、天氣重設：src/sim/day.ts simFromSave）；城市（編號、蓋起日、墓碑、歷史）由 d3 重播，
// 再跟存檔裡的格子、建築逐項核對，對不上就退回只用存檔（歷史從這張碼重新起算），並回報原因。
// d3 是別人也能改的輸入（分享碼）：每一筆事件的每個欄位都先驗型別與範圍，驗過的才進城市（審查：事件欄位會被畫進建築卡）。
// 純邏輯：不碰 DOM、localStorage（那是介面的事）。
import { decodeLabCode, encodeLabCode, MAX_CODE } from './labcode.ts';
import { CITY_FORMAT, cityStats, roadCode, type City, type CityBuilding, type CityEvent, type KindTable } from '../sim/city.ts';
import { replayCity } from '../sim/replay.ts';
import { simFromSave, type Sim } from '../sim/day.ts';

export const HISTORY_VER = 2;
// 存檔的長度上限＝分享碼的上限（實驗線 importShareCode 64904 與本線 decodeLabCode 都是 2,000,000 字元）：超過就讀不回來，也貼不進實驗線
export const SAVE_LIMIT = MAX_CODE;
export interface D3Ext { f: number; s: string; g: number; hv?: number; r?: unknown[][]; h?: CityEvent[] }

// ---- 歷史的緊湊列（hv 2）----
// 種類碼照事件出現的先後編；拆除的圖層碼 0 建築、1 路、2 分區、3 樹。
// 列的欄位：import [0,dDay,source,gameVer,seed,codeHash,buildings]；grow／upgrade [1|2,dDay,x,z,k,lv,v]；road [3,dDay,x,z,rc,cost,dG]；
// zone [4,dDay,x,z,zone,cost,dG]；place [5,dDay,x,z,k,lv,v,id,cost,dG]；doze [6,dDay,x,z,layer,cost,dG(,k,id)]；undo [7,dDay,dG,refund]。
// dDay＝這一筆的 day 減上一筆的 day（第一筆減 0）；dG＝這一筆的 g 減上一筆有 g 的事件的 g（第一筆減 0）。
const T_CODE = ['import', 'grow', 'upgrade', 'road', 'zone', 'place', 'doze', 'undo'] as const;
const LAYERS = ['bld', 'road', 'zone', 'tree'] as const;

export function packHistory(h: readonly CityEvent[]): unknown[][] {
  const out: unknown[][] = [];
  let d0 = 0, g0 = 0;
  for (const e of h) {
    const dd = e.day - d0; d0 = e.day;
    switch (e.t) {
      case 'import': out.push([0, dd, e.source, e.gameVer, e.seed, e.codeHash, e.buildings]); break;
      case 'grow': case 'upgrade': out.push([e.t === 'grow' ? 1 : 2, dd, e.x, e.z, e.k, e.lv, e.v]); break;
      case 'road': out.push([3, dd, e.x, e.z, e.rc, e.cost, e.g - g0]); g0 = e.g; break;
      case 'zone': out.push([4, dd, e.x, e.z, e.zone, e.cost, e.g - g0]); g0 = e.g; break;
      case 'place': out.push([5, dd, e.x, e.z, e.k, e.lv, e.v, e.id, e.cost, e.g - g0]); g0 = e.g; break;
      case 'doze': {
        const row = [6, dd, e.x, e.z, LAYERS.indexOf(e.layer), e.cost, e.g - g0];
        if (e.layer === 'bld' && e.k !== undefined && e.id !== undefined) row.push(e.k, e.id);
        out.push(row); g0 = e.g; break;
      }
      case 'undo': out.push([7, dd, e.g - g0, e.refund]); g0 = e.g; break;
    }
  }
  return out;
}

// ---- 驗型別（兩種存法共用）：欄位一個一個驗，組回跟模擬產生的事件同一個欄位順序（重播、再存檔逐位元組相同）----
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length <= 256;
function eventOf(t: unknown, day: unknown, f: (k: string) => unknown, n: number, k: number): CityEvent {
  const bad = (what: string) => new Error(`歷史第 ${k + 1} 筆的${what}不對`);
  if (!isInt(day) || day < 0) throw bad('日子');
  const xz = () => { const x = f('x'), z = f('z'); if (!isInt(x) || !isInt(z) || x < 0 || z < 0 || x >= n || z >= n) throw bad('座標'); return [x, z]; };
  const int = (name: string, lo: number, hi: number) => { const v = f(name); if (!isInt(v) || v < lo || v > hi) throw bad(name); return v; };
  const num = (name: string) => { const v = f(name); if (!isNum(v)) throw bad(name); return v; };
  switch (t) {
    case 'import': {
      const source = f('source'), gameVer = f('gameVer'), codeHash = f('codeHash');
      if (!isStr(source) || !isStr(gameVer) || !isStr(codeHash)) throw bad('匯入欄位');
      return { day, t, source, gameVer, seed: int('seed', -(2 ** 53), 2 ** 53), codeHash, buildings: int('buildings', 0, 1e7) };
    }
    case 'grow': case 'upgrade': { const [x, z] = xz(); return { day, t, x, z, k: int('k', 1, 9999), lv: int('lv', 0, 99), v: int('v', 0, 9999) }; }
    case 'road': { const [x, z] = xz(); return { day, t, x, z, rc: int('rc', 1, 5), cost: num('cost'), g: int('g', 0, 2 ** 31) }; }
    case 'zone': { const [x, z] = xz(); return { day, t, x, z, zone: int('zone', 1, 3), cost: num('cost'), g: int('g', 0, 2 ** 31) }; }
    case 'place': { const [x, z] = xz(); return { day, t, x, z, k: int('k', 1, 9999), lv: int('lv', 0, 99), v: int('v', 0, 9999), id: int('id', 1, 2 ** 31), cost: num('cost'), g: int('g', 0, 2 ** 31) }; }
    case 'doze': {
      const [x, z] = xz(), layer = f('layer');
      if (!LAYERS.includes(layer as typeof LAYERS[number])) throw bad('圖層');
      if (layer === 'bld' && f('id') !== undefined) return { day, t, x, z, layer: 'bld', k: int('k', 0, 9999), id: int('id', 1, 2 ** 31), cost: num('cost'), g: int('g', 0, 2 ** 31) };
      return { day, t, x, z, layer: layer as typeof LAYERS[number], cost: num('cost'), g: int('g', 0, 2 ** 31) };
    }
    case 'undo': return { day, t, g: int('g', 0, 2 ** 31), refund: num('refund') };
    default: throw bad('種類');
  }
}
const ROW_FIELDS: Record<string, string[]> = {
  import: ['source', 'gameVer', 'seed', 'codeHash', 'buildings'], grow: ['x', 'z', 'k', 'lv', 'v'], upgrade: ['x', 'z', 'k', 'lv', 'v'],
  road: ['x', 'z', 'rc', 'cost', 'g'], zone: ['x', 'z', 'zone', 'cost', 'g'], place: ['x', 'z', 'k', 'lv', 'v', 'id', 'cost', 'g'],
  doze: ['x', 'z', 'layer', 'cost', 'g', 'k', 'id'], undo: ['g', 'refund'],
};
export function unpackHistory(rows: unknown, n: number): CityEvent[] {
  if (!Array.isArray(rows)) throw new Error('歷史不是陣列');
  const out: CityEvent[] = [];
  let d0 = 0, g0 = 0;
  rows.forEach((row, k) => {
    if (!Array.isArray(row) || !isInt(row[0]) || !isNum(row[1])) throw new Error(`歷史第 ${k + 1} 筆不是一列`);
    const t = T_CODE[row[0]], names = t ? ROW_FIELDS[t] : [];
    if (!t || row.length > 2 + names.length) throw new Error(`歷史第 ${k + 1} 筆的種類不對`);
    const at = (name: string) => {
      const v = row[2 + names.indexOf(name)];
      if (name === 'g') return isInt(v) ? g0 + v : v;
      if (name === 'layer') return isInt(v) ? LAYERS[v] : undefined;
      return v;
    };
    const e = eventOf(t, d0 + row[1], at, n, k);
    d0 = e.day;
    if ('g' in e) g0 = e.g;
    out.push(e);
  });
  return out;
}
// hv 1：事件物件（D011 第一版）
export function checkHistory(h: unknown, n: number): CityEvent[] {
  if (!Array.isArray(h)) throw new Error('歷史不是陣列');
  return h.map((e, k) => {
    if (!e || typeof e !== 'object' || Array.isArray(e)) throw new Error(`歷史第 ${k + 1} 筆不是事件`);
    const o = e as Record<string, unknown>;
    return eventOf(o.t, o.day, name => o[name], n, k);
  });
}

// 存檔：template＝這座城讀進來時的整份存檔 JSON（LabSave.raw），本線不認得的欄位原樣保留。
// history＝false：不帶 d3（實驗線照樣能開；本線貼回來只能看）——給「存檔超過上限」時匯出用
export function saveCode(s: Sim, template: Record<string, unknown>, start: string, opts: { history?: boolean } = {}): string {
  const N = s.w.N, nn = N * N, o: Record<string, unknown> = { ...template };
  delete o.z;   // encodeLabCode 會重新壓、重新標
  delete o.d3;
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
  Object.assign(o, {
    v: 1, n: N, seed: s.seed, day: s.day, money: Math.round(s.money), msIdx: s.msIdx, star: s.bestStar, df: s.diff,
    ln: s.loan ? [s.loan.remain, s.loan.daily] : null, nm: s.city.name, tre, rd, zn, rcl, ab, bl,
  });
  if (opts.history !== false) o.d3 = { f: CITY_FORMAT, s: start, g: s.stroke, hv: HISTORY_VER, r: packHistory(s.city.history) } satisfies D3Ext;
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
  const d3 = r.save.raw.d3 as Partial<D3Ext> | undefined, only = (why: string) => ({ ok: true as const, sim, start: code, template: r.save.raw, replayed: false, note: why });
  if (!d3 || typeof d3 !== 'object' || Array.isArray(d3)) return only('沒有本線的歷史：從這張碼開始記');
  if (typeof d3.s !== 'string') return only('本線的歷史缺起始碼：只用存檔，歷史從這張碼重新起算');
  if (d3.hv !== undefined && d3.hv !== HISTORY_VER) return only(`不認得的歷史存法 hv=${JSON.stringify(d3.hv)}：只用存檔`);   // 比這一版新的存法：不猜
  let events: CityEvent[], c: City;
  try {
    events = d3.hv === HISTORY_VER ? unpackHistory(d3.r, r.save.n) : checkHistory(d3.h, r.save.n);
    c = replayCity(d3.s, events, kinds, r.save.day);
  } catch (e) { return only('歷史重播失敗，只用存檔：' + (e as Error).message); }
  const bad = mismatch(c, sim.city);
  if (bad) return only('歷史跟存檔對不上，只用存檔：' + bad);
  // 對得上：城市換成重播出來的（編號、蓋起日、墓碑、歷史都在），根格對照表照新的編號重建
  c.name = sim.city.name;
  sim.city = c;
  sim.root.clear();
  for (const b of c.buildings) if (b.goneDay === undefined) sim.root.set(b.z * c.n + b.x, b);
  for (const [i, b] of sim.root) { const t = sim.w.tiles[i].bld; if (t) { b.age = t.age; b.lv = t.lv; b.v = t.v; } }
  sim.stroke = isInt(d3.g) && d3.g >= 1 ? d3.g : 1;
  return { ok: true, sim, start: d3.s, template: r.save.raw, replayed: true, note: `歷史 ${events.length} 筆重播成功` };
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

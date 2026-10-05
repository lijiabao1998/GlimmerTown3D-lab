// 存檔（D011）：用 2D 實驗線的分享碼格式存目前的城（CLAUDE.md 規則 9），貼進實驗線就能開。
// 格式照實驗線 save()（index.html 66707–66798 @d23c18d）：逐格圖層一格一字元、建築一筆 [i,k,lv,v,age,(火災|體育場 sz),(密度),(財富)]、
// 資金取整（66747）、day、msIdx、star（bestStar）、df（難度）、ln（貸款）。
// 本線自己的資料放附加欄位 d3（實驗線 load 不讀它，匯入照樣成功；tools/lab-extract.mjs --part=d011 驗過）：
//   f＝城市格式（CITY_FORMAT）、s＝起始那張分享碼、g＝下一筆手勢的編號、hv＝歷史的存法、r（hv 2）或 h（hv 1）＝世界歷史。
// 歷史的存法（規則 4：格式一改就加版本號、舊檔要能讀）：
//   hv 1（D011 第一版，沒有 hv 欄位）：h＝事件物件陣列，每筆約 59 字元。
//   hv 2（D011 審查後）：r＝緊湊列，每筆一個陣列 [種類碼, 距上一筆的天數, 欄位…]，手勢編號也存差值；每筆約 18 字元，同一座城的存檔約短 3 倍。
//   hv 3（D013）：歷史本身存在 IndexedDB 的日誌（src/io/journal.ts），d3 只記 j＝{ id 日誌編號, n 已經確定寫進日誌的列數, h 前 n 列的滾動雜湊 }，
//     加上 t＝存檔那一刻還沒確定寫進日誌的尾巴幾列（通常是上一次存檔之後新的那幾筆；附加完成不重寫存檔，下一次存檔就縮回來）。列的編法跟 hv 2 一樣、差值接著前一列。
//   讀檔三種都認；「我的城」有日誌可用時存 hv 3，沒有（IndexedDB 不能用）存 hv 2；匯出的分享碼一律 hv 2（整份歷史，實驗線與本線都讀得回來）。
// 讀檔照實驗線 load 的語意（亂數 seed^day 重設、天氣重設：src/sim/day.ts simFromSave）；城市（編號、蓋起日、墓碑、歷史）由 d3 重播，
// 再跟存檔裡的格子、建築逐項核對，對不上就退回只用存檔（歷史從這張碼重新起算），並回報原因。
// d3 是別人也能改的輸入（分享碼）：每一筆事件的每個欄位都先驗型別與範圍，驗過的才進城市（審查：事件欄位會被畫進建築卡）。
// 純邏輯：不碰 DOM、localStorage（那是介面的事）。
import { decodeLabCode, encodeLabCode, MAX_CODE, type LabSave } from './labcode.ts';
import { ACT_CODES, BUDGET_CODES, CITY_FORMAT, MERGE_SIZE, POLICY_CODES, SPEC_CODES, TECH_CODES, cityStats, eventFormat, roadCode, type ActKind, type City, type CityBuilding, type CityEvent, type KindTable } from '../sim/city.ts';
import { replayCity } from '../sim/replay.ts';
import { simFromSave, budgetOfSave, type Sim } from '../sim/day.ts';
import { restyle531 } from '../sim/restyle.ts';
import { FLAG_LAYERS } from '../sim/rules/lab.ts';
import { rdepOfSave, rdepPairs } from '../sim/rules/resource.ts';
import { techSave } from '../sim/rules/tech.ts';
import { packMore, hashRows, PACK0, type PackState } from './journal.ts';

export const HISTORY_VER = 2;
export const JOURNAL_VER = 3;   // D013：歷史在日誌裡
// 存檔的長度上限＝分享碼的上限（實驗線 importShareCode 64904 與本線 decodeLabCode 都是 2,000,000 字元）：超過就讀不回來，也貼不進實驗線
export const SAVE_LIMIT = MAX_CODE;
export interface D3Ext { f: number; s: string; g: number; hv?: number; r?: unknown[][]; h?: CityEvent[]; j?: { id: string; n: number; h: number }; t?: unknown[][] }

// ---- 歷史的緊湊列（hv 2）----
// 種類碼照事件出現的先後編；拆除的圖層碼 0 建築、1 路、2 分區、3 樹。
// 列的欄位：import [0,dDay,source,gameVer,seed,codeHash,buildings]；grow／upgrade [1|2,dDay,x,z,k,lv,v]；road [3,dDay,x,z,rc,cost,dG]；
// zone [4,dDay,x,z,zone,cost,dG]；place [5,dDay,x,z,k,lv,v,id,cost,dG]；doze [6,dDay,x,z,layer,cost,dG(,k,id)]；undo [7,dDay,dG,refund]；
// restyle [8,dDay,x,z,v]（D012：城市格式 4）；pipe [9,dDay,x,z,cost,dG]、拆除圖層碼 4＝水管（D019：城市格式 5）；
// D026（城市格式 6）：fire [10,dDay,x,z,k]、burn [11,dDay,x,z,k,id]、crime [12,dDay,x,z,k]、abandon [13,dDay,x,z,k,id]、sick [14,dDay,x,z]、death [15,dDay,x,z]、
// act [16,dDay,x,z,動作碼,cost]（動作碼 0 滅火、1 處理犯罪、2 治療）、拆除圖層碼 5＝焦土。種類碼只往後加，既有的號不改；列的編法沒變，所以 hv 仍是 2。
// D034（城市格式 7）：merge [17,dDay,x,z,k,v,…被吸收的建築編號]（邊長由 k 推：33、34 是 2，105、106 是 3；尾巴有幾個編號就是吸收了幾棟，1–9 個）。
// D040（城市格式 9）：depleted [23,dDay,x,z,k]（k 是 49 油井或 50 礦場）。
// D039（城市格式 8）：policy [18,dDay,政策碼,改之前的值,改之後的值]、budget [19,dDay,類別碼,改之前的值,改之後的值]、research [20,dDay,節點碼,費用]、spec [21,dDay,方向碼]、techdone [22,dDay,節點碼]（碼表在 city.ts，只往後加）。
// dDay＝這一筆的 day 減上一筆的 day（第一筆減 0）；dG＝這一筆的 g 減上一筆有 g 的事件的 g（第一筆減 0）。
const T_CODE = ['import', 'grow', 'upgrade', 'road', 'zone', 'place', 'doze', 'undo', 'restyle', 'pipe', 'fire', 'burn', 'crime', 'abandon', 'sick', 'death', 'act', 'merge', 'policy', 'budget', 'research', 'spec', 'techdone', 'depleted'] as const;
const LAYERS = ['bld', 'road', 'zone', 'tree', 'wp', 'ruin'] as const;

// 這份歷史要寫的城市格式（D019，見 city.ts eventFormat）：歷史只增不改，記住掃到哪一筆，每次存檔只看新的事件（D013：存檔不跟歷史長度成正比）
const fmtSeen = new WeakMap<readonly CityEvent[], { n: number; f: number }>();
export function historyFormat(h: readonly CityEvent[]): number {
  let m = fmtSeen.get(h);
  if (!m || m.n > h.length) { m = { n: 0, f: 4 }; fmtSeen.set(h, m); }
  for (; m.n < h.length; m.n++) m.f = Math.max(m.f, eventFormat(h[m.n]));
  return m.f;
}

// 整份編一次（hv 2 的 d3.r、匯出的分享碼）。D013 起編法只寫一份：src/io/journal.ts packMore（日誌接續編碼用同一支，接起來逐列相同）
export function packHistory(h: readonly CityEvent[]): unknown[][] { return packMore(h, PACK0).rows; }

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
    case 'restyle': { const [x, z] = xz(); return { day, t, x, z, v: int('v', 0, 9999) }; }
    case 'pipe': { const [x, z] = xz(); return { day, t, x, z, cost: num('cost'), g: int('g', 0, 2 ** 31) }; }
    case 'fire': case 'crime': { const [x, z] = xz(); return { day, t, x, z, k: int('k', 1, 9999) }; }                                   // D026
    case 'burn': case 'abandon': { const [x, z] = xz(); return { day, t, x, z, k: int('k', 1, 9999), id: int('id', 1, 2 ** 31) }; }
    case 'sick': case 'death': { const [x, z] = xz(); return { day, t, x, z }; }
    case 'merge': {   // D034
      const [x, z] = xz(), k = int('k', 1, 9999), size = MERGE_SIZE[k], from = f('from');
      if (!size) throw bad('合併的種類');
      const sz = f('size'); if (sz !== undefined && sz !== size) throw bad('合併的邊長');
      if (!Array.isArray(from) || from.length < 1 || from.length > 9 || !from.every(q => isInt(q) && q >= 1 && q <= 2 ** 31)) throw bad('吸收的建築');
      return { day, t, x, z, k, size, v: int('v', 0, 9999), from: [...from] as number[] };
    }
    case 'act': { const [x, z] = xz(), what = f('what'); if (!ACT_CODES.includes(what as ActKind)) throw bad('處置'); return { day, t, x, z, what: what as ActKind, cost: num('cost') }; }
    // D039（城市格式 8）：玩家的決策與科技完成。值的範圍照模擬會產生的（稅率 .5–2、預算 .5–1.5、開關 0／1），不照單全收
    case 'policy': {
      const key = f('key'), from = f('from'), value = f('value');
      if (!isStr(key) || !POLICY_CODES.includes(key)) throw bad('政策');
      const okV = (v: unknown): v is number => isNum(v) && (key.startsWith('tax') ? v >= 0.5 && v <= 2 : v === 0 || v === 1);
      if (!okV(from) || !okV(value)) throw bad('政策的值');
      return { day, t, key, from, value };
    }
    case 'budget': {
      const cat = f('cat'), from = f('from'), value = f('value');
      if (!isStr(cat) || !BUDGET_CODES.includes(cat)) throw bad('預算類別');
      if (!isNum(from) || from < 0.5 || from > 1.5 || !isNum(value) || value < 0.5 || value > 1.5) throw bad('預算的值');
      return { day, t, cat, from, value };
    }
    case 'research': { const id = f('id'); if (!isStr(id) || !TECH_CODES.includes(id)) throw bad('研究的節點'); return { day, t, id, fee: num('fee') }; }
    case 'spec': { const id = f('id'); if (!isStr(id) || !SPEC_CODES.includes(id)) throw bad('城市方向'); return { day, t, id }; }
    case 'techdone': { const id = f('id'); if (!isStr(id) || !TECH_CODES.includes(id)) throw bad('完成的節點'); return { day, t, id }; }
    case 'depleted': { const [x, z] = xz(), k = int('k', 49, 50); return { day, t, x, z, k }; }   // D040
    default: throw bad('種類');
  }
}
const ROW_FIELDS: Record<string, string[]> = {
  import: ['source', 'gameVer', 'seed', 'codeHash', 'buildings'], grow: ['x', 'z', 'k', 'lv', 'v'], upgrade: ['x', 'z', 'k', 'lv', 'v'],
  road: ['x', 'z', 'rc', 'cost', 'g'], zone: ['x', 'z', 'zone', 'cost', 'g'], place: ['x', 'z', 'k', 'lv', 'v', 'id', 'cost', 'g'],
  doze: ['x', 'z', 'layer', 'cost', 'g', 'k', 'id'], undo: ['g', 'refund'], restyle: ['x', 'z', 'v'], pipe: ['x', 'z', 'cost', 'g'],
  fire: ['x', 'z', 'k'], burn: ['x', 'z', 'k', 'id'], crime: ['x', 'z', 'k'], abandon: ['x', 'z', 'k', 'id'], sick: ['x', 'z'], death: ['x', 'z'], act: ['x', 'z', 'what', 'cost'],
  merge: ['x', 'z', 'k', 'v'],   // D034：後面接被吸收的建築編號（不定長）
  policy: ['key', 'from', 'value'], budget: ['cat', 'from', 'value'], research: ['id', 'fee'], spec: ['id'], techdone: ['id'], depleted: ['x', 'z', 'k'],   // D039：碼在 city.ts 的碼表；D040：depleted
};
export function unpackHistory(rows: unknown, n: number): CityEvent[] {
  if (!Array.isArray(rows)) throw new Error('歷史不是陣列');
  const out: CityEvent[] = [];
  let d0 = 0, g0 = 0;
  rows.forEach((row, k) => {
    if (!Array.isArray(row) || !isInt(row[0]) || !isNum(row[1])) throw new Error(`歷史第 ${k + 1} 筆不是一列`);
    const t = T_CODE[row[0]], names = t ? ROW_FIELDS[t] : [];
    if (!t) throw new Error(`歷史第 ${k + 1} 筆的種類不對`);
    if (t !== 'merge' && row.length > 2 + names.length) throw new Error(`歷史第 ${k + 1} 筆的欄位太多（${row.length - 2} 欄，${t} 最多 ${names.length} 欄）`);   // D012 審查：之前跟種類不對講成同一句
    const at = (name: string) => {
      const v = row[2 + names.indexOf(name)];
      if (name === 'g') return isInt(v) ? g0 + v : v;
      if (name === 'layer') return isInt(v) ? LAYERS[v] : undefined;
      if (name === 'what') return isInt(v) ? ACT_CODES[v] : undefined;
      // D039：決策的碼（政策／預算類別／節點／方向）；值原樣
      if (name === 'key') return isInt(v) ? POLICY_CODES[v] : undefined;
      if (name === 'cat') return isInt(v) ? BUDGET_CODES[v] : undefined;
      if (name === 'id' && (t === 'research' || t === 'techdone')) return isInt(v) ? TECH_CODES[v] : undefined;
      if (name === 'id' && t === 'spec') return isInt(v) ? SPEC_CODES[v] : undefined;
      if (name === 'from' && t === 'merge') return row.slice(2 + names.length);   // D034：合併的尾巴（D039：政策與預算的 from 是「改之前的值」，不能撞名）
      if (name === 'size') return undefined;                      // D034：邊長由 k 推（列裡不存）
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
// history＝false：不帶 d3（實驗線照樣能開；本線貼回來只能看）——給「存檔超過上限」時匯出用。
// journal（D013）：存 hv 3——st＝已經確定寫進日誌 id 的編碼狀態（前 st.n 列），d3 只帶 j 與尾巴 t（st 之後的事件接著編的列）
export function saveCode(s: Sim, template: Record<string, unknown>, start: string, opts: { history?: boolean; journal?: { id: string; st: PackState } } = {}): string {
  const N = s.w.N, nn = N * N, o: Record<string, unknown> = { ...template };
  delete o.z;   // encodeLabCode 會重新壓、重新標
  delete o.d3;
  let tre = '', rd = '', zn = '', rcl = '', ab = '', wp = '', of = '', fly = '', ix = '', rn = '', cm = '', sk = '', dt = '', skd = '', dtd = '', cmd = '';
  const bl: number[][] = [];
  for (let i = 0; i < nn; i++) {
    const t = s.w.tiles[i], b = t.bld;
    tre += String.fromCharCode(48 + (t.tree || 0)); rd += roadCode(t.road, t.hw, t.bridge); zn += t.zone || 0; rcl += String.fromCharCode(48 + (t.rc || 0)); wp += t.wp ? 1 : 0;   // wp：D019（66717 同寫法）
    of += t.office ? 1 : 0; fly += t.fly475 ? 1 : 0; ix += String.fromCharCode(48 + ((t.ix475 as number) || 0));   // D024：66717、66729 同寫法
    ab += b && !b.ref && b.abandoned ? 1 : 0;
    // D026：焦土與災禍旗標（66716–66727 同寫法）：rn 焦土、cm 犯罪、sk 生病、dt 死亡；skd／dtd 是病中／死亡中的天數（上限 9）、cmd 是犯罪天數（字元碼 48＋上限 15）
    rn += t.ruin ? 1 : 0; cm += b && b.crime ? 1 : 0; sk += b && b.sick ? 1 : 0; dt += b && b.death ? 1 : 0;
    skd += b && b.sick ? '' + Math.min(9, b.sickDays || 0) : '0'; dtd += b && b.death ? '' + Math.min(9, b.deathAge || 0) : '0';
    cmd += String.fromCharCode(48 + (b && b.crime ? Math.min(15, b.crimeDays || 0) : 0));
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
    ln: s.loan ? [s.loan.remain, s.loan.daily] : null, nm: s.city.name, tre, rd, zn, rcl, wp, ab, bl,
  });
  // D024：拆路帶走高架與立交的旗標、拆分區帶走辦公區的旗標（51808、51811）——這三層讀檔時進了格子，存檔要寫回去（同 wp）。
  // 範本有這一層、或現在有格子帶旗標才寫；都沒有就不加欄位（存檔位元組不變）。鐵路、配電線、地下線本線的施工碰不到（build.ts FOREIGN_LAYERS），照範本原樣留著
  // D025：商品庫存與船（66763–66769）。sup（供應品）、gds（貨物）每次寫；fuel364、steel364、shipCount、shipProgress 非零才寫（範本裡讀進來的舊值要拿掉，不然庫存用完了存檔還留著）
  o.sup = s.econ.supplies; o.gds = s.econ.goods;
  for (const [k, v] of [['fuel364', s.econ.fuel], ['steel364', s.econ.steel], ['shipCount', s.econ.shipCount], ['shipProgress', s.econ.shipProgress]] as const) { if (v > 0) o[k] = v; else delete o[k]; }
  // D038：科技 tech343（零狀態不落欄位，66770）與城市方向 spec386（沒選不落欄位，66772）；範本裡讀進來的舊值拿掉再按模擬現在的寫（畸形的欄位讀檔整個棄用，存回去就不再帶著）
  { const tq = techSave(s.tech, s.edu.tech); if (tq) o.tech343 = tq; else delete o.tech343; if (s.edu.spec) o.spec386 = s.edu.spec; else delete o.spec386; }
  // D036：資源耗損 rdep（66730、66765；稀疏的 [格索引, 已開採量]）。模擬的耗損跟範本讀進來的一樣就不碰（沒挖過的存檔位元組不變，範本裡的寫法照舊）；變了才寫（全空＝null）
  { const was = rdepOfSave(template.rdep, nn), now = s.res.rdep; let same = true; for (let i = 0; i < nn && same; i++) if (was[i] !== now[i]) same = false; if (!same) o.rdep = rdepPairs(now); }
  // D026：焦土與災禍旗標的七層——範本有這一層、或現在有格子帶旗標才寫；都沒有就不加欄位（存檔位元組不變）。有範本的層一定要蓋掉（旗標每天在變，不寫回就是「存了、讀回來又復原」）
  for (const [k, v, re] of [['rn', rn, /1/], ['cm', cm, /1/], ['sk', sk, /1/], ['dt', dt, /1/], ['skd', skd, /[^0]/], ['dtd', dtd, /[^0]/], ['cmd', cmd, /[^0]/]] as const) if (typeof template[k] === 'string' || re.test(v)) o[k] = v;
  if (typeof template.of === 'string' || of.includes('1')) o.of = of;
  // D035：其餘旗標層（FLAG_LAYERS）。本線的施工只會清掉它們（拆路清路旁裝飾、公車站、公車專用道、單行道、紅綠燈；蓋路、劃區、蓋建築清裝飾，51645–51666、51808），不會新增：
  // 範本有這一層，格子現在沒有、範本那一格是非 0 的數字，就把那一格寫成 '0'；沒動過就不碰這一串（位元組不變；範本裡 '2'、':' 之類的字元也不洗成 '1'）
  const tilesNow = s.w.tiles;
  for (const [raw, field] of FLAG_LAYERS) {
    const str = template[raw];
    if (typeof str !== 'string' || str.length !== nn) continue;
    let cs: string[] | null = null;
    for (let i = 0; i < nn; i++) if (+str[i] && !(tilesNow[i] as unknown as Record<string, number | undefined>)[field]) { cs ??= str.split(''); cs[i] = '0'; }
    if (cs) o[raw] = cs.join('');
  }
  if (typeof template.fly475 === 'string' || fly.includes('1')) o.fly475 = fly;
  if (typeof template.ix475 === 'string' || /[^0]/.test(ix)) o.ix475 = ix;
  // D030：城市活動（66764 寫 cev:{i,d}，沒有活動寫 0；66963 讀）。有活動就寫；沒有活動、範本有這個欄位就寫 0（範本裡讀進來的舊活動要蓋掉）；都沒有就不加欄位（存檔位元組不變）
  if (s.cityEvent) o.cev = { i: s.cityEvent.i, d: s.cityEvent.daysLeft }; else if ('cev' in template) o.cev = 0;
  // D031：城市等級（66762 寫 rk:rankIdx，實驗線每次都寫，0 級也寫；66969 讀：有 rk 原樣還原、沒有就從點數往上爬）。一律寫：缺 rk 在讀檔時的意思是「舊檔，從點數往上爬」，
  // 不是「0 級」——0 級的城不寫 rk，存了再讀會從點數爬到別的等級（全守衛的「存檔再讀檔、讀回再存的碼＝第一次存的碼」抓到：第 1 天的新城）。所以跟 cev 不同，不能「沒有就不加欄位」
  o.rk = s.rankIdx;
  // D032：政策（66750 寫 pol，66975 讀 `if(d.pol)pol=d.pol`）。有政策就寫整個物件（讀進來的原樣留著、不加不減欄位，所以沒動政策的存檔位元組不變）；
  // 沒有政策：範本有這個欄位就寫 null（範本裡讀不進來的怪值——非物件——存回去變成乾淨的 null），都沒有就不加欄位。冷卻（polLast）是執行期的、不存
  if (s.pol) o.pol = s.pol; else if ('pol' in template) o.pol = null;
  // D032：服務預算（66764 寫 sb:{...svcBudget}，實驗線每次都寫；66964 讀：數字才收、夾 .5–1.5）。D023 起讀檔會還原它（存檔裡的 sb 原樣留著、不改），玩家在面板調預算之後要存回去：
  // 跟「讀這份範本的 sb 會得到的預算」不同才寫（整組四項、鍵的順序＝實驗線的 svcBudget：police、fire、health、edu）；沒動預算就不碰範本的 sb（怪值、缺欄、沒有 sb 都原樣，存檔位元組不變）
  const b0 = budgetOfSave(template.sb), b1 = s.budget;
  if (b1.police !== b0.police || b1.fire !== b0.fire || b1.health !== b0.health || b1.edu !== b0.edu) o.sb = { police: b1.police, fire: b1.fire, health: b1.health, edu: b1.edu };
  if (opts.history !== false && opts.journal) {
    const { id, st } = opts.journal;
    o.d3 = { f: historyFormat(s.city.history), s: start, g: s.stroke, hv: JOURNAL_VER, j: { id, n: st.n, h: st.h }, t: packMore(s.city.history, st).rows } satisfies D3Ext;
  } else if (opts.history !== false) o.d3 = { f: historyFormat(s.city.history), s: start, g: s.stroke, hv: HISTORY_VER, r: packHistory(s.city.history) } satisfies D3Ext;
  return encodeLabCode(o, { deflate: true });
}

// restyled＝讀檔最後一步照實驗線重挑外觀換了幾棟（D012，每一棟也記成一筆 restyle 事件）
// journal（D013，hv 3 才有）：接上的日誌編號與「前 n 列」的編碼狀態（呼叫端從這裡接著寫）
export type LoadResult =
  | { ok: true; sim: Sim; start: string; template: Record<string, unknown>; replayed: boolean; note: string; restyled: number; journal?: { id: string; st: PackState } }
  | { ok: false; error: string };
// hv 3 的存檔讀檔時要的日誌：rows＝日誌裡這個編號的前幾列（呼叫端先從 IndexedDB 讀好；讀不到給 null 與原因）
export interface JournalIn { id: string; rows: unknown[][] | null; why?: string }
// 存檔的 d3 指到哪一條日誌（開頁先讀這個，才知道要從 IndexedDB 讀哪一條、讀幾列）
export function journalRef(code: string | null): { id: string; n: number } | null {
  const r = code ? decodeLabCode(code) : null;
  const d3 = r?.ok ? r.save.raw.d3 as Partial<D3Ext> | undefined : undefined, j = d3?.j;
  return d3?.hv === JOURNAL_VER && j && typeof j.id === 'string' && isInt(j.n) && j.n >= 0 ? { id: j.id, n: j.n } : null;
}

// 讀檔：一般的實驗線分享碼也吃（沒有 d3 就是一座新匯入的城，歷史從這張碼起算）。
// 最後一步照實驗線 load 的 ensureVariety531(true)（67035）重挑住商工的外觀（src/sim/restyle.ts）：接上歷史、退回只用存檔都挑——實驗線每次讀檔都挑
export function loadCode(code: string, kinds: KindTable, vrank: Record<string, number[]>, journal?: JournalIn): LoadResult {
  const r = decodeLabCode(code);
  if (!r.ok) return r;
  const res = loadSim(r.save, code, kinds, vrank, journal);
  return { ...res, restyled: restyle531(res.sim) };
}

// 只能看的城（樣本城、沒有 d3 的分享碼、測試出口）：不重播歷史、不留模擬，但照樣重挑外觀——實驗線匯入任何碼都會挑，
// 重挑要用讀檔時的地價，所以也建一次模擬的格子與場（simFromSave，地價只算住商工根格；72×72 約 10 ms）。歷史＝匯入＋重挑，只在記憶體
export function viewCode(code: string, kinds: KindTable, vrank: Record<string, number[]>): { ok: true; city: City; restyled: number } | { ok: false; error: string } {
  const r = decodeLabCode(code);
  if (!r.ok) return r;
  const sim = simFromSave(r.save, code, kinds, vrank, undefined, true), restyled = restyle531(sim);   // 地價只算住商工根格（審查：大圖整張算太慢）
  return { ok: true, city: sim.city, restyled };
}

function loadSim(save: LabSave, code: string, kinds: KindTable, vrank: Record<string, number[]>, journal?: JournalIn) {
  const sim = simFromSave(save, code, kinds, vrank);
  const d3 = save.raw.d3 as Partial<D3Ext> | undefined, only = (why: string) => ({ ok: true as const, sim, start: code, template: save.raw, replayed: false, note: why });
  if (!d3 || typeof d3 !== 'object' || Array.isArray(d3)) return only('沒有本線的歷史：從這張碼開始記');
  if (typeof d3.s !== 'string') return only('本線的歷史缺起始碼：只用存檔，歷史從這張碼重新起算');
  if (d3.hv !== undefined && d3.hv !== HISTORY_VER && d3.hv !== JOURNAL_VER) return only(`不認得的歷史存法 hv=${JSON.stringify(d3.hv)}：只用存檔`);   // 比這一版新的存法：不猜
  // 城市格式（D012 起才檢查）：比這一版新＝可能有這一版不認得的事件，不猜；不是 1..這一版的整數＝不認得（審查：之前只擋整數，"5"、4.5 照讀）。沒有 f 的照舊當舊檔
  if (isInt(d3.f) && d3.f > CITY_FORMAT) return only(`城市格式 ${d3.f} 比這一版（${CITY_FORMAT}）新：只用存檔`);
  if (d3.f !== undefined && !(isInt(d3.f) && d3.f >= 1)) return only(`不認得的城市格式 f=${JSON.stringify(d3.f)}：只用存檔`);
  let events: CityEvent[], c: City, jr: { id: string; n: number; h: number } | null = null, rows = d3.r;
  if (d3.hv === JOURNAL_VER) {   // D013：歷史在日誌裡——前 n 列從日誌來（雜湊要對）、尾巴從 d3.t 來
    const j = d3.j;
    if (!j || typeof j !== 'object' || typeof j.id !== 'string' || j.id.length > 64 || !isInt(j.n) || j.n < 0 || !isInt(j.h)) return only('日誌的指標不對：只用存檔');
    if (!Array.isArray(d3.t)) return only('日誌的尾巴不對：只用存檔');
    if (!journal || journal.id !== j.id || !journal.rows) return only(`讀不到歷史的日誌（${journal?.why ?? (journal && journal.id !== j.id ? '編號對不上' : '沒有日誌')}）：只用存檔`);
    if (journal.rows.length < j.n) return only(`日誌只有 ${journal.rows.length} 列、存檔要 ${j.n} 列：只用存檔`);
    const head = journal.rows.slice(0, j.n);                    // 多出來的列（寫進日誌、存檔還沒跟上就關頁）用不到
    if (hashRows(head) !== j.h) return only('日誌前幾列的雜湊跟存檔對不上：只用存檔');
    rows = [...head, ...d3.t];                                    // 不改讀進來的存檔物件（template 會原樣留著）
    jr = j;
  }
  try {
    events = d3.hv === HISTORY_VER || d3.hv === JOURNAL_VER ? unpackHistory(rows, save.n) : checkHistory(d3.h, save.n);
    c = replayCity(d3.s, events, kinds, save.day);
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
  // hv 3：從日誌的前 n 列接著寫。差值的起點（上一列的天數、手勢編號）從重播出來的事件算；雜湊用日誌裡實有的列算的那一個（上面核過）
  const journalOut = jr ? { id: jr.id, st: { ...packMore(events.slice(0, jr.n), PACK0).st, h: jr.h } } : undefined;
  return { ok: true as const, sim, start: d3.s, template: save.raw, replayed: true, note: `歷史 ${events.length} 筆重播成功` + (jr ? `（日誌 ${jr.n} 列＋存檔 ${events.length - jr.n} 列）` : ''), journal: journalOut };
}

// 重播的城跟存檔的城要一樣：對帳數字、逐格路／等級／分區／樹／occ 對到的根格、每棟還在的建築（種類、等級、變體、屋齡、位置）
function mismatch(a: City, b: City): string | null {
  const sa = JSON.stringify(cityStats(a)), sb = JSON.stringify(cityStats(b));
  if (sa !== sb) return '對帳數字不同';
  const n = a.n, rootOf = (c: City, i: number) => { const id = c.occ[i]; if (!id) return -1; const q = c.buildings[id - 1]; return q.z * n + q.x; };
  for (let i = 0; i < n * n; i++) {
    if (a.road[i] !== b.road[i] || a.rclass[i] !== b.rclass[i] || a.zone[i] !== b.zone[i] || a.tree[i] !== b.tree[i]) return `第 ${i} 格的地面不同`;
    if (a.wp[i] !== b.wp[i]) return `第 ${i} 格的水管不同`;   // D019
    if (a.ruin[i] !== b.ruin[i]) return `第 ${i} 格的焦土不同`;   // D026
    if (rootOf(a, i) !== rootOf(b, i)) return `第 ${i} 格的建築不同`;
  }
  const key = (q: CityBuilding) => [q.x, q.z, q.k, q.lv, q.v, q.age].join(',');
  const la = a.buildings.filter(q => q.goneDay === undefined).map(key).sort().join(';'), lb = b.buildings.filter(q => q.goneDay === undefined).map(key).sort().join(';');
  return la === lb ? null : '建築（種類、等級、變體、屋齡）不同';
}

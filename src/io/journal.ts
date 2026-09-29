// 世界歷史的日誌（D013）：一座城一條只增不改的日誌，一列一筆事件（hv 2 的緊湊列，src/io/save.ts packHistory 的編法原樣）。
// 瀏覽器存在 IndexedDB（src/idbJournal.ts），Node 守衛用記憶體版（MemoryJournal）；這裡只有純邏輯與存放介面，不碰 DOM、亂數、現實時間（規則 2、3）。
//   接續編碼：緊湊列是差值編碼（天數、手勢編號跟上一列比），記住編到哪（PackState），新的事件接著編，不重編整份；
//     接起來的列跟整份一次編（packHistory）逐列相同（tools/unit-d013.mjs 驗）。
//   滾動雜湊：每一列接著上一個雜湊算（FNV-1a，JSON 字串），存檔記「前 n 列的雜湊」；讀檔照同樣算法核前 n 列。
import type { CityEvent } from '../sim/city.ts';

export interface PackState { n: number; d0: number; g0: number; h: number }
export const PACK0: PackState = Object.freeze({ n: 0, d0: 0, g0: 0, h: 0x811c9dc5 }) as PackState;

// 一列接著雜湊（FNV-1a 32 位，照 JSON 字串逐字元）
export function hashRow(h: number, row: unknown[]): number {
  const s = JSON.stringify(row);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export const hashRows = (rows: readonly unknown[][], h0 = PACK0.h) => rows.reduce<number>((h, r) => hashRow(h, r), h0);

const LAYERS = ['bld', 'road', 'zone', 'tree', 'wp'] as const;
// 從 st 那一列接著把 hist[st.n..] 編成緊湊列（種類碼與欄位同 save.ts T_CODE／ROW_FIELDS）
export function packMore(hist: readonly CityEvent[], st: PackState): { rows: unknown[][]; st: PackState } {
  const rows: unknown[][] = [];
  let { d0, g0, h } = st;
  for (let k = st.n; k < hist.length; k++) {
    const e = hist[k], dd = e.day - d0; d0 = e.day;
    let row: unknown[];
    switch (e.t) {
      case 'import': row = [0, dd, e.source, e.gameVer, e.seed, e.codeHash, e.buildings]; break;
      case 'grow': case 'upgrade': row = [e.t === 'grow' ? 1 : 2, dd, e.x, e.z, e.k, e.lv, e.v]; break;
      case 'road': row = [3, dd, e.x, e.z, e.rc, e.cost, e.g - g0]; g0 = e.g; break;
      case 'zone': row = [4, dd, e.x, e.z, e.zone, e.cost, e.g - g0]; g0 = e.g; break;
      case 'place': row = [5, dd, e.x, e.z, e.k, e.lv, e.v, e.id, e.cost, e.g - g0]; g0 = e.g; break;
      case 'doze': {
        row = [6, dd, e.x, e.z, LAYERS.indexOf(e.layer), e.cost, e.g - g0];
        if (e.layer === 'bld' && e.k !== undefined && e.id !== undefined) row.push(e.k, e.id);
        g0 = e.g; break;
      }
      case 'undo': row = [7, dd, e.g - g0, e.refund]; g0 = e.g; break;
      case 'restyle': row = [8, dd, e.x, e.z, e.v]; break;
      case 'pipe': row = [9, dd, e.x, e.z, e.cost, e.g - g0]; g0 = e.g; break;   // D019
      default: throw new Error('存檔：不認得的事件 ' + (e as { t?: unknown }).t);
    }
    rows.push(row); h = hashRow(h, row);
  }
  return { rows, st: { n: hist.length, d0, g0, h } };
}

// 存放：一條日誌＝一個編號底下照順序號（0 起）存的列。append 從 from 起寫（同一個順序號再寫一次＝覆蓋成同一列：歷史只增不改，同號的列內容一定一樣）
export interface JournalStore {
  kind: string;
  append(id: string, from: number, rows: readonly unknown[][]): Promise<void>;
  read(id: string, n: number): Promise<unknown[][]>;    // 前 n 列（不夠就回實有的）
  count(id: string): Promise<number>;
  drop(id: string): Promise<void>;
}
export class MemoryJournal implements JournalStore {
  kind = 'memory';
  data = new Map<string, unknown[][]>();
  writes = 0;                                            // 寫進去的列數（守衛量「每一次只附加新的列」）
  async append(id: string, from: number, rows: readonly unknown[][]) {
    const a = this.data.get(id) ?? [];
    if (from > a.length) throw new Error(`日誌 ${id} 有 ${a.length} 列，不能從第 ${from} 列接著寫`);
    rows.forEach((r, k) => { a[from + k] = JSON.parse(JSON.stringify(r)); });
    this.writes += rows.length;
    this.data.set(id, a);
  }
  async read(id: string, n: number) { return (this.data.get(id) ?? []).slice(0, n).map(r => JSON.parse(JSON.stringify(r))); }
  async count(id: string) { return (this.data.get(id) ?? []).length; }
  async drop(id: string) { this.data.delete(id); }
}

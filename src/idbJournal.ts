// 世界歷史日誌的 IndexedDB 存放（D013；介面與純邏輯在 src/io/journal.ts）。瀏覽器才有，不在 src/sim、src/io 裡（純度守衛：那兩層不碰瀏覽器 API）。
// 資料庫 gt3d、物件庫 journal，一列一筆：鍵＝[日誌編號, 順序號]，值＝那一列（緊湊列陣列）。附加＝一筆交易 put 多列，交易完成才算寫進去。
// 打不開（隱私模式、被封鎖、瀏覽器不給）就回 null：呼叫端退回 hv 2（歷史塞在 localStorage 的存檔裡，D011 的做法）。
import type { JournalStore } from './io/journal.ts';

const DB = 'gt3d', STORE = 'journal', VER = 1, OPEN_MS = 4000;

const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('交易中止')); });

export async function openJournal(): Promise<{ store: JournalStore | null; why: string }> {
  let db: IDBDatabase;
  try {
    if (typeof indexedDB === 'undefined' || !indexedDB) return { store: null, why: '這個瀏覽器沒有 IndexedDB' };
    db = await new Promise<IDBDatabase>((res, rej) => {
      const t = setTimeout(() => rej(new Error('開資料庫逾時')), OPEN_MS);
      const r = indexedDB.open(DB, VER);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
      r.onsuccess = () => { clearTimeout(t); res(r.result); };
      r.onerror = () => { clearTimeout(t); rej(r.error ?? new Error('開資料庫失敗')); };
      r.onblocked = () => { clearTimeout(t); rej(new Error('資料庫被別的分頁擋住')); };
    });
  } catch (e) { return { store: null, why: 'IndexedDB 打不開（' + ((e as Error)?.message ?? String(e)) + '）' }; }
  const range = (id: string, lo: number, hi: number) => IDBKeyRange.bound([id, lo], [id, hi]);
  const store: JournalStore = {
    kind: 'indexeddb',
    async append(id, from, rows) {
      if (!rows.length) return;
      const tx = db.transaction(STORE, 'readwrite'), os = tx.objectStore(STORE), end = done(tx);
      rows.forEach((row, k) => os.put(row, [id, from + k]));
      await end;
    },
    async read(id, n) {
      if (n <= 0) return [];
      const tx = db.transaction(STORE, 'readonly');
      return await req(tx.objectStore(STORE).getAll(range(id, 0, n - 1))) as unknown[][];
    },
    async count(id) {
      const tx = db.transaction(STORE, 'readonly');
      return await req(tx.objectStore(STORE).count(range(id, 0, Number.MAX_SAFE_INTEGER)));
    },
    async drop(id) {
      const tx = db.transaction(STORE, 'readwrite'), end = done(tx);
      tx.objectStore(STORE).delete(range(id, 0, Number.MAX_SAFE_INTEGER));
      await end;
    },
  };
  return { store, why: '' };
}

// 建築種類表（D003）：資料來自 2D 實驗線，由 tools/lab-extract.mjs 抽出成 lab-kinds.json（出處、行號都在檔頭 source）。
// 純函式：收一份資料、回一張查詢表；不 import JSON，Node 測試和瀏覽器都能用。
export interface KindRow {
  k: number; name: string; cat: string; catStatic: string | null; size: number;
  h: Record<string, number>; hMax: Record<string, number>; hv: Record<string, Record<string, number>>;
  variants: Record<string, number>; sprites: boolean;
}
export interface KindData {
  source: { repo: string; commit: string; version: string; anchor: string; tool: string; where: Record<string, number[]>; heightRule: string };
  cats: Record<string, { name: string; color: string }>;
  kinds: KindRow[];
}

// 實驗線這幾種不走 SPR.bld（讀檔 66926 的註解：k4/5/10-13 不走 SPR.bld），沒有精靈可量。
// 高度是本線自訂的預設，不是實驗線的數字：公園貼地、發電廠／水塔／醫院偏高、診所／派出所矮。
export const NO_SPRITE_HEIGHT: Record<number, number> = { 4: 0.08, 5: 1.6, 10: 1.8, 11: 1.0, 12: 1.8, 13: 0.8, 52: 0.6 };

export interface KindTable {
  data: KindData;
  size(k: number): number;
  known(k: number): boolean;
  name(k: number): string;
  cat(k: number): string;
  catName(cat: string): string;
  catColor(cat: string): string;
  height(k: number, lv: number, v?: number): number;   // 格；給了變體 v 就用那張圖量到的高度
}

export function kindTableFrom(data: KindData): KindTable {
  const byK = new Map(data.kinds.map(r => [r.k, r]));
  return {
    data,
    size: k => byK.get(k)?.size ?? 1,
    known: k => byK.has(k),
    name: k => byK.get(k)?.name ?? `未知種類 ${k}`,
    cat: k => byK.get(k)?.cat ?? '?',
    catName: c => data.cats[c]?.name ?? '未知分類',
    catColor: c => data.cats[c]?.color ?? '#9aa3ad',
    height(k, lv, v) {
      const r = byK.get(k);
      if (!r || !r.sprites) return NO_SPRITE_HEIGHT[k] ?? 1;
      // 這一級沒有量到就往下找最近的一級（實驗線升級服務建築沒有 lv 專屬圖時也是退回 lv1 圖，66926）
      for (let l = lv; l >= 1; l--) {
        if (r.h[l] === undefined) continue;
        const hv = v === undefined ? undefined : r.hv[l]?.[v];
        return hv ?? r.h[l];
      }
      const any = Object.values(r.h);
      return any.length ? any[0] : 1;
    },
  };
}

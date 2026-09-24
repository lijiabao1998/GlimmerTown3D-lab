// 瀏覽器用的原型表（D004）：把 lab-arche.json（實驗線 ARCHE568，出處在檔頭 source）打包進單檔。
import data from './lab-arche.json';
import type { ArcheTable } from './recipes.ts';

// 內容的正確性由 tools/unit.mjs 的 1,728 組量體對拍驗
export const ARCHE = data.arche as unknown as ArcheTable;

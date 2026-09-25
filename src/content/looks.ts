// 瀏覽器用的非住商工五色（D007）：把 lab-looks.json（實驗線精靈圖讀出的色，出處在檔頭 source）打包進單檔。
import data from './lab-looks.json';
import type { LabLook } from './kindShapes.ts';

export const LOOKS = (data as unknown as { looks: Record<string, LabLook> }).looks;

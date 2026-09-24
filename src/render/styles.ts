// 三種畫風＝同一條渲染管線的三組參數（D001：讓業主看圖挑，CLAUDE.md 規則 1）
export interface Style {
  id: 'A' | 'B' | 'C';
  label: string;
  pixelCss: number;      // 每個渲染像素佔幾個 CSS 像素（>1＝低解析度＋最近鄰放大）
  outline: boolean;      // 深度描邊
  toon: boolean;         // 三階色塊受光（false＝平滑受光）
  quant: number;         // 調色盤量化階數（0＝不量化）
  softShadow: boolean;
}

export const STYLES: Record<Style['id'], Style> = {
  A: { id: 'A', label: 'A 像素風 3D', pixelCss: 3, outline: true, toon: true, quant: 12, softShadow: false },
  B: { id: 'B', label: 'B 平滑低面數', pixelCss: 1, outline: false, toon: false, quant: 0, softShadow: true },
  C: { id: 'C', label: 'C 卡通描邊', pixelCss: 1, outline: true, toon: true, quant: 0, softShadow: false },
};

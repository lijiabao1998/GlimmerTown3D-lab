// D053: presentation scope only. The imported rank table, tool ids, prices and
// unlock rules stay authoritative; no simulation or saved-state writes here.
import { CIVIC_TOOLS, type CivicTool } from '../sim/edit.ts';
import { RANKS } from '../sim/rules/rank.ts';

export const FACILITY_GROUPS = [
  { id: 'all', name: '全部' }, { id: 'service', name: '生活服務' },
  { id: 'utility', name: '城市管線' }, { id: 'resource', name: '資源研究' },
] as const;
export type FacilityGroup = typeof FACILITY_GROUPS[number]['id'];
interface FacilityNote { group: Exclude<FacilityGroup, 'all'>; use: string; placement: string }
export const FACILITY_NOTES: Readonly<Record<string, FacilityNote>> = {
  park: { group: 'service', use: '提供周邊公園覆蓋', placement: '在空陸地按住拖出範圍，每格一座公園。' },
  fire: { group: 'service', use: '提供消防服務覆蓋', placement: '點選未被道路或建築佔用的陸地。' },
  police: { group: 'service', use: '提供警察服務覆蓋', placement: '點選未被道路或建築佔用的陸地。' },
  policeBox: { group: 'service', use: '提供派出所警力覆蓋', placement: '點選未被道路或建築佔用的陸地。' },
  hospital: { group: 'service', use: '提供醫院醫療覆蓋', placement: '點選未被道路或建築佔用的陸地。' },
  clinic: { group: 'service', use: '提供診所醫療覆蓋', placement: '點選未被道路或建築佔用的陸地。' },
  school: { group: 'service', use: '提供學校教育覆蓋', placement: '點選未被道路或建築佔用的陸地。' },
  library: { group: 'service', use: '提供圖書館服務覆蓋', placement: '點選未被道路或建築佔用的陸地。' },
  post: { group: 'service', use: '提供郵政服務覆蓋', placement: '點選未被道路或建築佔用的陸地。' },
  cemetery: { group: 'service', use: '安撫周邊喪事，提供墓園覆蓋', placement: '點選未被道路或建築佔用的陸地。' },
  water: { group: 'utility', use: '供水網的水源', placement: '水塔蓋在空陸地；搭配配水管連接用水區。' },
  wpipe: { group: 'utility', use: '連接水塔與用水區', placement: '陸地上按住拉線；可鋪在道路、分區與建築下方，已有水管的格子略過。' },
  dump: { group: 'utility', use: '提供垃圾處理容量', placement: '點選未被道路或建築佔用的陸地；注意周邊污染。' },
  sewage: { group: 'utility', use: '處理接入管網的污水', placement: '空陸地，周圍3×3內至少2格水域；交通線與電力走廊會阻擋。' },
  oilwell: { group: 'resource', use: '開採油田資源', placement: '必須在油田資源格；選取後以黃色顯示可見資源位置，仍以落點預覽為準。' },
  mine: { group: 'resource', use: '開採礦藏資源', placement: '必須在礦藏資源格；選取後以藍色顯示可見資源位置，仍以落點預覽為準。' },
  gaswell: { group: 'resource', use: '開採油田伴生天然氣', placement: '同樣需要油田資源格；選取後顯示黃色資源位置。' },
  megaproject: { group: 'resource', use: '支援城市研究', placement: '需要連續3×3陸地；整塊不能有道路或建築，其他阻擋以預覽為準。' },
};

// These are imported 2D milestone descriptions, not build-tool unlocks in this
// 3D line. Keep RANKS intact for parity and old saves; qualify only presentation.
const NOT_BUILDABLE: Readonly<Record<number, string>> = {
  5: '文化建築', 7: '小型地標', 11: '研究院', 16: '紀念工程',
};
export function rankBuildNote(idx: number): string {
  const pending = NOT_BUILDABLE[idx];
  if (pending) return `${pending}：本線尚無建造工具；升級不會新增這類可建設施。`;
  if (idx === 21) return '解鎖：太空研究中心，可從設施導覽選取（3×3）。';
  return RANKS[idx]?.unlock ?? '';
}
export function facilitySummary(rankIdx: number) {
  const available = CIVIC_TOOLS.filter(t => !t.unlockRank || rankIdx + 1 >= t.unlockRank);
  const next = CIVIC_TOOLS.filter(t => t.unlockRank && rankIdx + 1 < t.unlockRank)
    .sort((a, b) => a.unlockRank! - b.unlockRank!)[0] ?? null;
  return { available: available.length, total: CIVIC_TOOLS.length, next };
}
export function facilityPresentation(t: CivicTool, rankIdx: number, sandbox: boolean) {
  const note = FACILITY_NOTES[t.id];
  const locked = !!t.unlockRank && rankIdx + 1 < t.unlockRank;
  const unit = t.id === 'wpipe' ? '每格・拉線' : t.id === 'park' ? '每格1×1・框選' : `${t.size ?? 1}×${t.size ?? 1}・點放`;
  return { ...note, locked, unit, price: `基價 $${t.cost.toLocaleString('en-US')}${sandbox ? '・沙盒 $0' : ''}`,
    status: locked ? `Lv.${t.unlockRank} 開放` : '等級可選' };
}

// D037 公車路線缺口的量法用的城：同一座城（D034 的 M1，人口 2,108）、六個公車站牌沿 z=30 一排，只在存檔欄位 bus_rt／bop468 上不一樣。
//   T1 一條路線（站 0→1→2→3）、T2 兩條路線（站 0→1→2、3→4→5）＋營運設定 bop468（車隊 6 密集、4 經濟）、T3 沒有路線、同樣的站牌（對照：本線沒搬路線，所以 T3 要逐項全等）。
// 決定性：全部用座標算出來，沒有 Math.random、現實時間。
import { mk, m1 } from './d034-cities.mjs';

export const BUS_DAYS = 13, N = 72;
const stops = [[10, 30], [20, 30], [30, 30], [42, 30], [52, 30], [60, 30]];
const idx = ([x, z]) => z * N + x;
const city = (rt, bop) => mk(5166100, 150, '公車', b => { m1(b); stops.forEach(([x, z]) => b.flag('bs', x, z, 1)); }, { ...(rt ? { bus_rt: rt } : {}), ...(bop ? { bop468: bop } : {}) });

export function d037Runs() {
  return [
    ['T1', '一條路線 4 站（bus_rt）', city([[idx(stops[0]), idx(stops[1]), idx(stops[2]), idx(stops[3])]], null)],
    ['T2', '兩條路線各 3 站（bus_rt）＋營運設定（bop468：車隊 6 密集、4 經濟）', city([[idx(stops[0]), idx(stops[1]), idx(stops[2])], [idx(stops[3]), idx(stops[4]), idx(stops[5])]], [{ f: 6, s: 'dense' }, { f: 4, s: 'eco' }])],
    ['T3', '沒有路線、同樣的站牌（對照）', city(null, null)],
  ].map(([id, note, code]) => ({ id, note, code, days: BUS_DAYS }));
}

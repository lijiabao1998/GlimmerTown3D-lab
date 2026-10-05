// D045 守衛用的城：市長委託（T385）。底＝D036 的玩家蓋井底城（M1，種子 5166004，第 150 天：人口 ≥ 500、幸福 .6–.8），存檔欄位另外帶：
//   rk（城市等級索引，5＝Lv.6，三選一的 11 條都出得來）、cms385（進行中的委託，實驗線格式）、tech343（完成的科技）、庫存（steel364、fuel364）、df（難度）。
// 決定性：全部用座標與固定種子算出來，沒有 Math.random、現實時間。
import { mk, m1 } from './d034-cities.mjs';
import { builtBase } from './d036-cities.mjs';
import { loadCode } from '../src/io/save.ts';

export const SEED45 = 5166004;
// 存檔碼：extra＝要蓋過去的存檔欄位
export function d045Code(extra = {}, name = '市長委託', seed = SEED45) {
  return mk(seed, 150, name, b => { m1(b); }, { rk: 5, ...extra });
}
export function d045Load(extra = {}, money = 5000) {
  const { KT, vrank } = builtBase(), code = d045Code(extra), L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('D045 底城讀不進：' + L.error);
  L.sim.money = money;
  return { ...L, code, KT, vrank };
}
export const C6 = { act: '', prog: {}, done: ['C6'] };   // tech343：C6「學術網絡」已完成

// ---- 實驗線頁面實跑的劇本（tools/d045-lab.mjs 錄、tools/unit-d045-live.mjs 比）：id → { code, phases }，phases＝[[接第幾張（−1 不接）, 推幾天], …]；每一段開頭記三選一、接單，再推 ----
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { d036Runs } from './d036-cities.mjs';
const withExtras = (code, extra) => { const o = { ...decodeLabCode(code).save.raw, ...extra }; delete o.z; delete o.d3; return encodeLabCode(o, { deflate: true }); };
const act = (id, st, o = {}) => ({ cms385: { act: id, st, acc: 0, hold: 0, n: 0, done: [], ...o } });
export function d045Scripts() {
  const w2 = d036Runs().find(r => r.id === 'W2');
  const money = { money: 5000 };
  return [
    // 三選一與接單：還沒有進行中的，第 0／1／2 張各接一次（種子與輪次決定三選一），推 100 天（幸福夠高的日子連續天數會累計，運量委託一直是 0）
    ...[0, 1, 2].map(i => ({ id: `accept${i}`, code: d045Code(money), phases: [[i, 100]] })),
    { id: 'control', code: d045Code(money), phases: [[-1, 30]] },
    // 進行中：幸福 70%×30 天已累計 20 天、完成清單裡有糧食出口、輪次 3
    { id: 'happy', code: d045Code({ ...money, ...act('happy70', 140, { hold: 20, n: 3, done: ['trade1200'] }) }), phases: [[-1, 60]] },
    // 過期：期限 90 天，開始日 62、第 150 天進來，第 2 個結算日（第 152 天）滿 90 天
    { id: 'expire', code: d045Code({ ...money, ...act('steel40', 62) }), phases: [[-1, 8]] },
    // 科技型完成：C6 已經完成，第一天就完成（+$1,800）；完成之後輪次 +1，換一批三選一（不再出 techC6），接第 0 張再推 30 天
    { id: 'c6', code: d045Code({ ...money, tech343: C6, ...act('techC6', 100) }), phases: [[-1, 6], [0, 30]] },
    // 期末驗收：鋼材 70、期限剛到（開始日 31、第 151 天滿 120 天）→ 完成（+$3,200）
    { id: 'stockok', code: d045Code({ ...money, steel364: 70, ...act('ct_steel60', 31) }), phases: [[-1, 5]] },
    // 期末驗收不到：燃料只有 79 → 到期就過期
    { id: 'stockfail', code: d045Code({ ...money, fuel364: 79, ...act('ct_fuel80', 31) }), phases: [[-1, 5]] },
    // 運量委託：本線沒有運量；實驗線的起步城沒有公車路線，運量也應該一直是 0（兩邊都一路 0 天，期限 90 天到才過期）
    { id: 'transit', code: d045Code({ ...money, ...act('transit150', 148) }), phases: [[-1, 100]] },
    // 期末驗收：燃料 90、期限剛到（開始日 31、第 151 天滿 120 天）→ 完成（+$3,000）
    { id: 'fuelok', code: d045Code({ ...money, fuel364: 90, ...act('ct_fuel80', 31) }), phases: [[-1, 5]] },
    // 沙盒：不結算（進行中的委託原地不動；一般難度的話第 152 天就過期了）
    { id: 'sandbox', code: d045Code({ ...money, df: 3, ...act('steel40', 62) }), phases: [[-1, 6]] },
    // 累計型：有造船廠與鋼材庫存的城（W2），造船用鋼 40 已累計 30
    { id: 'w2acc', code: withExtras(w2.code, { ...money, ...act('steel40', 140, { acc: 30 }) }), phases: [[-1, 40]] },
  ];
}

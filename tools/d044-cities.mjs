// D044 守衛用的城：玩家蓋天然氣井（k117）與太空研究中心（k51，3×3）。底＝D036 的玩家蓋井底城（M1，種子 5166004，第 150 天，資源圖由種子決定），
// 另外在 z=40 那一帶預先準備三塊 3×3 的地：A 塊有分區與樹（驗「蓋下去整塊清樹、清分區」）、B 塊乾淨、C 塊留給拒絕案例（守衛自己在上面鋪路、放建築）。
// 決定性：全部用座標與固定種子算出來，沒有 Math.random、現實時間。
import { mk, m1, zoneRect, tryPut } from './d034-cities.mjs';
import { builtBase } from './d036-cities.mjs';
import { loadCode } from '../src/io/save.ts';
import { commitOp } from '../src/sim/edit.ts';

export const BLOCKS = { A: [30, 40], B: [44, 40], C: [56, 40] };   // 3×3 的左上角（根格）
export const SEED44 = 5166004;
// 底城的碼：M1＋A 塊裡 (31..32, 40..41) 劃住宅區、(30,40)(32,42)(31,41) 種樹（樹層的碼是 1）
const prep = b => {
  m1(b);
  zoneRect(b, 31, 40, 32, 41, 1);
  for (const [x, z] of [[30, 40], [32, 42], [31, 41], [30, 42]]) b.flag('tre', x, z, 1);
};
export function d044Base() {
  const { KT, vrank } = builtBase();
  return { code: mk(SEED44, 150, '工業補齊', prep), KT, vrank };
}
// 讀進來、給足錢（沙盒以外的難度）；回傳 loadCode 的結果
export function d044Load(money = 1e6) {
  const { code, KT, vrank } = d044Base(), L = loadCode(code, KT, vrank);
  if (!L.ok) throw new Error('D044 底城讀不進：' + L.error);
  L.sim.money = Math.max(L.sim.money, money);
  return { ...L, code, KT, vrank };
}
// 玩家蓋：天然氣井 3 口（資源格＝油田的前 3 個空格）、太空研究中心（blocks 預設 A 塊、B 塊）；回傳放了什麼
export function d044Built(money = 1e6, blocks = ['A', 'B']) {
  const L = d044Load(money), s = L.sim, N = s.w.N, put = [];
  for (let i = 0; i < N * N && put.filter(p => p[0] === 'gas').length < 3; i++) {
    if (s.res.resource[i] !== 1) continue;
    const x = i % N, z = (i / N) | 0, r = commitOp(s, { k: 'tap', tool: 'gaswell', x0: x, z0: z, x1: x, z1: z }, 0);
    if (r.ok) put.push(['gas', x, z]);
  }
  for (const name of blocks) {
    const [x, z] = BLOCKS[name], r = commitOp(s, { k: 'tap', tool: 'megaproject', x0: x, z0: z, x1: x, z1: z }, 0);
    if (!r.ok) throw new Error(`太空研究中心 ${name} 塊蓋不下：${r.reason}`);
    put.push(['mega', x, z]);
  }
  return { ...L, put };
}
// 同一批東西當成「存檔裡本來就有的」放進去（2D 存檔的寫法，不走玩家的工具）：守衛拿它跟玩家蓋的比（污染場、每天的帳要一樣）
export function d044AsBuilder(put) {
  return mk(SEED44, 150, '工業補齊', b => {
    prep(b);
    for (const [kind, x, z] of put) if (!tryPut(b, x, z, kind === 'gas' ? 117 : 51)) throw new Error(`builder 擺不下 ${kind} (${x},${z})`);
  });
}

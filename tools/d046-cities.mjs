// D046 deterministic end-to-end fixtures: the progress always comes from stepDay.
import { mk } from './d034-cities.mjs';
export const foodExportCode = (id = 'trade1200') => mk(5166004, 150, '出口農城', b => {
  b.road(8, 30, 40, 30).put(7, 30, 5).put(10, 29, 1, 3, { den: 3 }).put(11, 29, 1, 3, { den: 3 });
  for (let x = 5; x < 60; x += 6) b.put(x, 10, 53, 2);
  for (let x = 5; x < 50; x += 5) b.put(x, 40, 91);
}, { rk: 5, money: 50000, ...(id ? { cms385: { act: id, st: 150, acc: 0, hold: 0, n: 0, done: [] } } : {}) });
// A saved Lv.21 city with enough real residents to cross the next threshold on
// its next normal daily assessment. No rank setter or synthetic points injection.
export const naturalSpaceUnlockCode = () => mk(5166004, 150, '穹頂驗收', b => {
  for (let j = 0; j < 28; j++) b.put(4 + (j % 10) * 6, 4 + Math.floor(j / 10) * 6, 105);
}, { rk: 20, money: 500000 });

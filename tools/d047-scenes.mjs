// D047 fixed synthetic review scenes. No simulation tick or altered source assets.
// before/after differ only by the read-only ?spaceArt=legacy shape selector.
import { mk } from './d034-cities.mjs';
export const D047_BASELINE = '01eecbbfb0bff3d40e0f47d49a61f3419c7ca359';
export const D047_ROOT = [32, 30];
export const D047_VIEWS = [
  { name: 'close', width: 1280, height: 800, zoom: 8, mobile: false, clean: true },
  { name: 'context', width: 1280, height: 800, zoom: 3.5, mobile: false, clean: true },
  { name: 'mobile', width: 412, height: 860, zoom: 5.2, mobile: true, clean: false },
];
export function d047ReviewCode(v = 0) {
  return mk(5167047, 150, '太空研究園區', b => {
    b.road(25, 33, 41, 33, 3).road(29, 27, 29, 37, 2).road(37, 27, 37, 37, 2);
    b.put(...D047_ROOT, 51, 1, { v, age: 30 });
    b.put(25, 30, 7).put(26, 32, 4, 1, { v: 3 }).put(28, 32, 4, 1, { v: 4 });
    b.put(38, 30, 45).put(40, 32, 4, 1, { v: 6 });
    for (const x of [25, 27, 30, 32, 34, 38, 40]) b.put(x, 34, x % 2 ? 1 : 2, 1, { den: 1, v: 5 });
    for (const [x, z] of [[31, 29], [35, 29], [31, 32], [35, 32], [38, 28], [26, 28]]) b.flag('tre', x, z, 1);
  }, { rk: 21, money: 20000, sup: 250 });
}

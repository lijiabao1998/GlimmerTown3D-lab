// D048 fixed synthetic acceptance city. Paused, no construction, no source assets.
// Both the deployed-baseline capture and candidate smoke import this same fixture.
// Chrome CDP portrait touch emulation is not an Android hardware/device run.
import { createHash } from 'node:crypto';
import { mk } from './d034-cities.mjs';

export const D048_BASELINE = {
  commit: '0f38eff100f9161730e2208bcc24b896874dfa83',
  htmlSha256: '7178ca04aed7c9ee07f688586e1f1668daca1877f42e23290516184b336e54f1',
  source: 'https://lijiabao1998.github.io/GlimmerTown3D-lab/',
};
export const D048_CAMERA = { x: 31, z: 30, zoom: 4.4 };
export const D048_VIEWS = [{ width: 360, height: 740 }, { width: 412, height: 860 }];
export const D048_SAVE_KEY = 'gt3d.v1.save';
export const D048_COMMISSION = { act: 'steel40', st: 140, acc: 12.5, hold: 0, n: 0, done: [] };
export const D048_QUOTA = 'D048 測試注入：儲存空間已滿';
export const D048_DENIED = 'D048 測試注入：瀏覽器拒絕這個網站寫入儲存空間';
export const D048_IDB_REASON = 'D048 測試注入：IndexedDB 不可用';
export const D048_IDB_BLOCK = `IDBFactory.prototype.open = function () { throw new DOMException(${JSON.stringify(D048_IDB_REASON)}, 'SecurityError'); };`;

export function d048ReviewCode() {
  return mk(5167048, 150, '存檔驗收小鎮', b => {
    b.road(23, 31, 39, 31, 3).road(27, 26, 27, 35, 2).road(35, 26, 35, 35, 2);
    b.put(23, 30, 5).put(25, 28, 7).put(37, 28, 12);
    for (const x of [25, 29, 31, 33, 37]) {
      b.put(x, 30, 1, 1, { den: 1, v: 5 }).put(x, 32, 2, 1, { v: 2 });
    }
    b.put(29, 28, 4, 1, { v: 3 }).put(33, 28, 4, 1, { v: 4 });
    b.put(29, 34, 1, 2, { den: 2, v: 1 }).put(33, 34, 1, 2, { den: 2, v: 3 });
    for (const [x, z] of [[24, 27], [30, 27], [32, 27], [38, 27], [25, 34], [37, 34]]) b.flag('tre', x, z, 1);
  }, { rk: 5, money: 20000, sup: 250, cms385: { ...D048_COMMISSION, done: [] } });
}

export function d048FixtureManifest() {
  const code = d048ReviewCode();
  return {
    synthetic: true,
    device: 'Chrome CDP Android-like portrait touch emulation; no Android hardware',
    baseline: D048_BASELINE,
    codeSha256: createHash('sha256').update(code).digest('hex'),
    codeLength: code.length,
    seed: 5167048, day: 150, paused: true, commission: D048_COMMISSION,
    camera: D048_CAMERA, views: D048_VIEWS,
    faultInjection: { quota: D048_QUOTA, denied: D048_DENIED, journal: D048_IDB_REASON },
  };
}

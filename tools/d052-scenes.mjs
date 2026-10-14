// D052 synthetic localStorage fixtures shared by before/candidate evidence.
// No runtime world mutation: load these codes, then use real UI handlers/simDay.
// Chrome CDP portrait touch emulation is not an Android hardware test.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { mk } from './d034-cities.mjs';
import { d048ReviewCode, D048_CAMERA, D048_BASELINE_CAMERA, D048_VIEWS, D048_SAVE_KEY } from './d048-scenes.mjs';

export { D048_CAMERA as D052_CAMERA, D048_BASELINE_CAMERA as D052_BASELINE_CAMERA, D048_VIEWS as D052_VIEWS, D048_SAVE_KEY as D052_SAVE_KEY };
export const D052_BASELINE = { commit: 'c1ac6154bf77306b374a740901f98d8708a96478', htmlSha256: '9ffc3633646f4efde9decf942381155abd1c657db663e6a7b1d466bb0952479d' };
export const D052_PREREQUISITES = ['C1', 'C2', 'C3', 'C4a', 'C5'];
export const D052_MODES = ['paid', 'power', 'budget-high', 'budget-low', 'resume', 'sandbox', 'pop50', 'completion', 'progress'];
export const D052_SHOTS = [
  { mode: 'paid', width: 360, height: 740, scene: 'paid-c6-hud' },
  { mode: 'power', width: 412, height: 860, scene: 'eco-reg-capacity' },
  { mode: 'budget-high', width: 360, height: 740, scene: 'budget-limit' },
  { mode: 'resume', width: 412, height: 860, scene: 'free-resume' },
  { mode: 'pop50', width: 360, height: 740, scene: 'population-lock' },
  { mode: 'completion', width: 412, height: 860, scene: 'research-completion' },
];
const sha256 = text => createHash('sha256').update(text).digest('hex');
const commission = () => ({ act: 'techC6', st: 140, acc: 0, hold: 0, n: 0, done: [] });

export function d052ReviewCode(mode = 'paid') {
  assert.ok(D052_MODES.includes(mode), `Unknown D052 fixture mode: ${mode}`);
  let code = d048ReviewCode();
  if (mode === 'power') code = mk(5167052, 50, '容量臨界驗收小鎮', b => {
    b.road(4, 30, 60, 30, 3).put(3, 30, 5);
    b.flagRect('zn', 5, 29, 43, 29, 1).flagRect('zn', 5, 31, 43, 31, 1).flag('zn', 43, 31, 2);
    for (let x = 5; x <= 43; x++) b.put(x, 29, 1).put(x, 31, x === 43 ? 2 : 1);
  }, { rk: 5, money: 10000, pol: null });
  if (mode === 'pop50') code = mk(5167052, 50, '人口門檻驗收小鎮', b => {
    b.road(23, 31, 39, 31, 3).put(23, 30, 5);
    [5, 5, 4, 3, 1].forEach((den, i) => b.put(25 + i * 2, 30, 1, 1, { den, v: i }));
  }, { rk: 2, money: 10000 });
  const decoded = decodeLabCode(code); assert.equal(decoded.ok, true);
  const raw = structuredClone(decoded.save.raw);
  delete raw.z; delete raw.d3; delete raw.cms3d;
  raw.money = 10000;
  raw.nm = mode === 'power' || mode === 'pop50' ? raw.nm : '決策回饋驗收小鎮';
  raw.cms385 = ['paid', 'completion'].includes(mode) ? commission() : { act: '', st: 0, acc: 0, hold: 0, n: 0, done: [] };
  raw.tech343 = { act: '', prog: {}, done: [] };
  if (mode === 'paid' || mode === 'completion') raw.tech343 = { act: mode === 'completion' ? 'C6' : '', prog: mode === 'completion' ? { C6: 114 } : {}, done: [...D052_PREREQUISITES] };
  if (mode === 'resume') raw.tech343 = { act: 'B1', prog: { A1: 5, B1: 2 }, done: [] };
  if (mode === 'progress') raw.tech343 = { act: 'A1', prog: { A1: 5 }, done: [] };
  if (mode === 'sandbox') raw.df = 3;
  if (mode.startsWith('budget-')) raw.sb = Object.fromEntries(['police', 'fire', 'health', 'edu'].map(k => [k, mode === 'budget-high' ? 1.5 : .5]));
  return encodeLabCode(raw, { prefix: true, deflate: true });
}

export function d052FixtureManifest(mode = 'paid') {
  const code = d052ReviewCode(mode), decoded = decodeLabCode(code); assert.equal(decoded.ok, true);
  return {
    synthetic: true, injection: 'localStorage save fixture before real page load; no runtime world mutation',
    device: 'Chrome CDP portrait touch emulation; no Android hardware', baseline: D052_BASELINE,
    mode, cityName: decoded.save.nm, seed: decoded.save.seed, day: decoded.save.day, paused: true,
    codeSha256: sha256(code), codeLength: code.length, rawCodeSha256: sha256(JSON.stringify(decoded.save.raw)),
    technology: decoded.save.raw.tech343, commission: decoded.save.raw.cms385,
    budget: decoded.save.raw.sb ?? null,
    qualification: mode === 'power' ? '78 demand buildings, one coal plant, 78 zone cells, day 50; original load marks all 78 powered. Preserve these actual flags across policy, no fabricated 75/3 assignment.' : mode === 'pop50' ? 'Five level-1 houses with density [5,5,4,3,1] yield exactly 50 population; rank index 2 (Lv.3).' : mode === 'completion' ? 'Open panel at C6 114/115, then advance exactly one original simDay through existing simStep(1); record actual completion and payout.' : '',
    camera: D048_CAMERA, measuredBaselineCamera: D048_BASELINE_CAMERA, views: D048_VIEWS, visT: 2.2, dayFrac: 0,
  };
}

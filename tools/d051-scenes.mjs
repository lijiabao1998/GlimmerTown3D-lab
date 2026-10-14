// D051 synthetic acceptance fixture: D048 city/camera, only technology and
// commission state replaced. Chrome portrait touch emulation is not Android.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { decodeLabCode, encodeLabCode } from '../src/io/labcode.ts';
import { d048ReviewCode, D048_CAMERA, D048_BASELINE_CAMERA, D048_VIEWS, D048_SAVE_KEY } from './d048-scenes.mjs';

export { D048_CAMERA as D051_CAMERA, D048_BASELINE_CAMERA as D051_BASELINE_CAMERA, D048_VIEWS as D051_VIEWS, D048_SAVE_KEY as D051_SAVE_KEY };
export const D051_BASELINE = { commit: 'f8241f6c3ab3ede932f695580cee3297ae256339', htmlSha256: '382e407eb48c05eb1b200b98ce7cf37ef73df89247627eb6a9a1832d8bc25610' };
export const D051_COMMISSION = { act: 'techC6', st: 140, acc: 0, hold: 0, n: 0, done: [] };
export const D051_PREREQUISITES = ['C1', 'C2', 'C3', 'C4a', 'C5'];
export const D051_MODES = ['idle', 'paused', 'researching', 'complete'];
const sha256 = text => createHash('sha256').update(text).digest('hex');

export function d051ReviewCode(mode = 'idle') {
  assert.ok(D051_MODES.includes(mode), `Unknown D051 fixture mode: ${mode}`);
  const decoded = decodeLabCode(d048ReviewCode());
  assert.equal(decoded.ok, true);
  const raw = structuredClone(decoded.save.raw);
  delete raw.z;
  delete raw.cms3d;
  raw.cms385 = structuredClone(D051_COMMISSION);
  raw.tech343 = {
    act: mode === 'paused' ? 'A1' : mode === 'researching' ? 'C6' : '',
    prog: mode === 'paused' ? { C6: 50, A1: 1 } : mode === 'researching' ? { C6: 50 } : {},
    done: [...D051_PREREQUISITES, ...(mode === 'complete' ? ['C6'] : [])],
  };
  return encodeLabCode(raw, { prefix: true, deflate: true });
}

export function d051FixtureManifest(mode = 'idle') {
  const code = d051ReviewCode(mode), decoded = decodeLabCode(code);
  assert.equal(decoded.ok, true);
  return {
    synthetic: true, device: 'Chrome CDP portrait touch emulation; no Android hardware',
    baseline: D051_BASELINE, mode, cityName: decoded.save.nm,
    seed: decoded.save.seed, day: decoded.save.day, paused: true,
    codeSha256: sha256(code), codeLength: code.length,
    rawCodeSha256: sha256(JSON.stringify(decoded.save.raw)),
    technology: decoded.save.raw.tech343, commission: decoded.save.raw.cms385,
    camera: D048_CAMERA, measuredBaselineCamera: D048_BASELINE_CAMERA,
    views: D048_VIEWS, visT: 2.2, dayFrac: 0,
  };
}

// Independent exact D083 IDs; the historical catalogue25 stays unchanged.
import assert from 'node:assert/strict';
export const D083_TOOL_IDS = Object.freeze([
  'heritageGranary', 'heritageDovecote', 'heritageSignalBox', 'heritageTollhouse',
  'heritageWindmill', 'heritageSmithy', 'heritageGreatBarn', 'heritageBandstand',
]);
export function catalogueWithD083(historical) {
  assert.equal(historical.length, 25, 'exact historical catalogue25 retained');
  assert.equal(new Set(historical).size, 25, 'historical catalogue25 remains unique');
  assert.ok(D083_TOOL_IDS.every(id => !historical.includes(id)), 'D083 IDs are append-only');
  return [...historical, ...D083_TOOL_IDS];
}

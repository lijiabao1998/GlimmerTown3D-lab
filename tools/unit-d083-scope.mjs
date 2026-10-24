// Compact controls for the finite D083 outer layer, alongside unchanged D082 controls.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT } from './cdp.mjs';
import { D083_ADDED, D083_CHANGED, D083_CURRENT_PATHS, d083HistoricalBytes, assertD083Inventory, assertD083Scope } from './d083-scope.mjs';
import { isD082ReviewedExistingSource as outer, isD082ReviewedWindowsSource as windowsOnly, assertD082Scope } from './d082-scope.mjs';
export function d083ScopeGuards() {
  const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
  assert.equal(assertD083Scope(), 236);
  let negativeControls = 0;
  for (const file of D083_CHANGED) {
    const actual = d083HistoricalBytes(file);
    const expected = D083_ADDED.has(file) ? '' : execFileSync('git', ['show', '7deb34881b38679b1d0396e21eb9e57ad2ee9a0c:' + file], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(actual, expected, file + ' independent immediate D082 Git baseline');
    assert.throws(() => d083HistoricalBytes(file, name => read(name) + '\n// unauthorized'), /exact allowed source/);
    negativeControls++;
    const missing = new Error('missing ' + file);
    assert.throws(() => d083HistoricalBytes(file, () => { throw missing; }), e => e === missing);
    negativeControls++;
  }
  for (const invalid of [D083_CURRENT_PATHS.slice(1), [...D083_CURRENT_PATHS, 'src/unauthorized.ts'], [...D083_CURRENT_PATHS, D083_CURRENT_PATHS[0]]]) {
    assert.throws(() => assertD083Inventory(invalid), /exact source inventory/); negativeControls++;
  }
  assert.throws(() => d083HistoricalBytes('src/unauthorized.ts', () => assert.fail('must not read')), /belongs to D083 source inventory/); negativeControls++;
  for (const invalid of [undefined, null, '', read('src/cityView.ts').slice(1)]) {
    assert.throws(() => d083HistoricalBytes('src/cityView.ts', () => invalid), /exact allowed source/); negativeControls++;
  }
  let outerNegativeControls = 0;
  for (const file of D083_CHANGED) {
    assert.equal(outer(file), true);
    assert.equal(windowsOnly(file, () => assert.fail('old Windows predicate must not read D083 source')), false);
    assert.throws(() => outer(file, name => read(name) + '\n// unauthorized'), /exact allowed source/); outerNegativeControls++;
  }
  assert.equal(outer('src/unauthorized.ts', () => assert.fail('unknown source must not read')), false); outerNegativeControls++;
  for (const file of D083_ADDED) {
    assert.throws(() => assertD082Scope(name => read(name) + (name === file ? '\n// unauthorized' : '')), /exact allowed source/); outerNegativeControls++;
    const missing = new Error('missing outer source ' + file);
    assert.throws(() => assertD082Scope(name => { if (name === file) throw missing; return read(name); }), e => e === missing); outerNegativeControls++;
  }
  return { passed: true, currentSources: 236, priorSources: 231, changed: D083_CHANGED.length, negativeControls, outerNegativeControls, totalNegativeControls: negativeControls + outerNegativeControls, qualification: 'Seven finite source inverses and five exact additions. Original D082 pins/controls, Windows-only predicate and actual runtime remain intact.' };
}

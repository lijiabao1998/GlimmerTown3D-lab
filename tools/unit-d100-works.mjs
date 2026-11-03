// D100 construction wiring guards: commitTransit/removeTransit/undoOp against a
// minimal fake Sim (only the fields the transit path touches).
import assert from 'node:assert/strict';
import {commitTransit, removeTransit, undoOp} from '../src/sim/edit.ts';

const n = 8;
function fakeSim(money = 1000) {
  return {
    day: 3, money, stroke: 7, txns: [],
    city: {n, ter: new Uint8Array(n * n).fill(2), el: new Uint8Array(n * n), occ: new Int32Array(n * n), history: [], transit: undefined, buildings: []},
  };
}
const clone = value => JSON.parse(JSON.stringify(value));
const networkOf = s => s.city.transit;
const historyOf = s => s.city.history;

// 1. a rail edge commits, costs 10, writes one transit event and one undo txn
let s = fakeSim();
let r = commitTransit(s, {tool: 'rail', x0: 0, z0: 0, x1: 1, z1: 0});
assert.equal(r.ok, true, r.reason);
assert.equal(s.money, 990);
assert.equal(networkOf(s).edges.length, 1);
assert.equal(networkOf(s).edges[0].id, 1);
assert.equal(historyOf(s).length, 1);
assert.deepEqual(historyOf(s)[0], {day: 3, t: 'transit', op: 'edge', id: 1, mode: 'rail', x: 0, z: 0, h: 0, x2: 1, z2: 0, h2: 0, cost: 10, g: 7});
assert.equal(s.txns.length, 1);

// 2. undo restores the previous network, refunds the cost and appends an undo event
const undo = undoOp(s);
assert.equal(undo.ok, true);
assert.equal(undo.refund, 10);
assert.equal(s.money, 1000);
assert.equal(s.city.transit, undefined);
assert.equal(historyOf(s).length, 2);
assert.deepEqual(historyOf(s)[1], {day: 3, t: 'undo', g: 7, refund: 10});

// 3. failed construction is atomic: no money, no event, no txn, no network change
s = fakeSim();
const before = clone({money: s.money, history: historyOf(s), txns: s.txns});
r = commitTransit(s, {tool: 'rail', x0: 0, z0: 0, x1: 2, z1: 0});
assert.equal(r.ok, false);
assert.deepEqual(clone({money: s.money, history: historyOf(s), txns: s.txns}), before);
assert.equal(s.city.transit, undefined);

// 4. station costs 120 and its removal refuses while track touches the footprint
s = fakeSim();
assert.equal(commitTransit(s, {tool: 'station', x0: 2, z0: 2}).ok, true);
assert.equal(s.money, 880);
const stationId = s.city.transit.stations[0].id;
assert.equal(commitTransit(s, {tool: 'rail', x0: 2, z0: 2, x1: 3, z1: 2}).ok, true);
assert.equal(removeTransit(s, 'station', stationId).ok, false, 'connected station removal refused');
const edgeId = s.city.transit.edges[0].id;
assert.equal(removeTransit(s, 'edge', edgeId).ok, true);
assert.equal(removeTransit(s, 'station', stationId).ok, true);
assert.equal(s.money, 870, 'removals never refund');

// 5. depot costs 300; underground station uses height -1
s = fakeSim(2000);
assert.equal(commitTransit(s, {tool: 'depot', x0: 4, z0: 4}).ok, true);
assert.equal(s.money, 1700);
assert.equal(commitTransit(s, {tool: 'station', mode: 'metro', x0: 0, z0: 6}).ok, true);
assert.equal(s.city.transit.stations[0].height, -1);
assert.equal(s.money, 1700 - 120);

// 6. a station overlapping another is rejected without side effects
const snapshot = clone({money: s.money, history: historyOf(s), txns: s.txns, network: networkOf(s)});
assert.equal(commitTransit(s, {tool: 'station', x0: 1, z0: 6}).ok, false);
assert.deepEqual(clone({money: s.money, history: historyOf(s), txns: s.txns, network: networkOf(s)}), snapshot);

// 7. undo order is LIFO across two transit operations
s = fakeSim();
commitTransit(s, {tool: 'rail', x0: 0, z0: 0, x1: 1, z1: 0});
commitTransit(s, {tool: 'rail', x0: 1, z0: 0, x1: 2, z1: 0});
assert.equal(s.money, 980);
undoOp(s);
assert.equal(s.money, 990);
assert.equal(networkOf(s).edges.length, 1);
undoOp(s);
assert.equal(s.money, 1000);
assert.equal(s.city.transit, undefined);
assert.equal(undoOp(s).ok, false);
console.log('D100 works: commit, atomic failure, costs, removal rules, undo order pass');

// D100 network guards: construction/removal rules on the pure model.
// Runs on Node 24 type stripping; no browser, no renderer, no save format.
import assert from 'node:assert/strict';
import {createNetwork, buildTrack, buildStation, buildDepot, removeEdge, removeStation, removeDepot, COST_STATION, COST_DEPOT} from '../src/sim/transit/network.ts';

const p = (x, z, height = 0) => ({x, z, height});
const size = 10;
const water = new Set(['3,3', '4,3']);
const occupied = new Set(['5,5', '5,4']);
const bumps = new Map([['7,7', 2]]);
const terrain = {
  size,
  cell(x, z) {
    if (x < 0 || z < 0 || x >= size || z >= size) return {elevation: 0, water: false, occupied: false};
    return {elevation: bumps.get(`${x},${z}`) ?? 0, water: water.has(`${x},${z}`), occupied: occupied.has(`${x},${z}`)};
  },
};
const clone = value => JSON.parse(JSON.stringify(value));

// 1. a straight rail edge on land costs 10, allocates id 1 and bumps the revision
let network = createNetwork();
let result = buildTrack(network, terrain, 'rail', p(0, 0), p(1, 0), 100);
assert.equal(result.ok, true);
assert.equal(result.money, 90);
assert.deepEqual(result.network.edges, [{id: 1, mode: 'rail', a: p(0, 0), b: p(1, 0)}]);
assert.equal(result.network.nextId, 2);
assert.equal(result.network.revision, 1);
network = result.network;

// 2. duplicate edge in either direction is rejected and leaves everything unchanged
const before = clone(network);
for (const [from, to] of [[p(1, 0), p(0, 0)], [p(0, 0), p(1, 0)]]) {
  const duplicate = buildTrack(network, terrain, 'rail', from, to, 90);
  assert.equal(duplicate.ok, false);
  assert.deepEqual(clone(duplicate.network), before);
  assert.equal(duplicate.money, 90);
}

// 3. diagonal, non-adjacent, out-of-map and occupied endpoints are rejected
assert.equal(buildTrack(network, terrain, 'rail', p(0, 1), p(1, 2), 50).ok, false);
assert.equal(buildTrack(network, terrain, 'rail', p(0, 0), p(2, 0), 50).ok, false);
assert.equal(buildTrack(network, terrain, 'rail', p(9, 9), p(10, 9), 50).ok, false);
assert.equal(buildTrack(network, terrain, 'rail', p(5, 4), p(5, 5), 50).ok, false);

// 4. water is bridged at cost 25; metro goes underground at cost 30
const bridge = buildTrack(network, terrain, 'rail', p(3, 4), p(3, 3), 100);
assert.equal(bridge.ok, true, 'water edge needs both ends mapped; 3,3 is water and 3,4 is land');
assert.equal(bridge.money, 75);
assert.equal(buildTrack(network, terrain, 'metro', p(4, 4, -1), p(4, 3, -1), 100).money, 70);
assert.equal(buildTrack(network, terrain, 'metro', p(4, 4, 0), p(4, 3, 0), 100).ok, false, 'metro must be underground');

// 5. station: 2x1 flat land costs 120, overlap/water/money fail closed
let stationNetwork = buildStation(network, terrain, 'rail', 0, 2, 0, 200);
assert.equal(stationNetwork.ok, true);
assert.equal(stationNetwork.money, 80);
assert.deepEqual(stationNetwork.network.stations.map(s => [s.w, s.h, s.height]), [[2, 1, 0]]);
assert.equal(COST_STATION, 120);
assert.equal(buildStation(stationNetwork.network, terrain, 'rail', 1, 2, 0, 200).ok, false, 'overlapping station');
assert.equal(buildStation(stationNetwork.network, terrain, 'rail', 3, 3, 0, 200).ok, false, 'station on water');
assert.equal(buildStation(stationNetwork.network, terrain, 'rail', 0, 2, 0, 119).ok, false, 'station without money');
assert.equal(buildStation(stationNetwork.network, terrain, 'metro', 5, 4, -1, 200).ok, true, 'underground station ignores surface occupancy');
network = stationNetwork.network;

// 6. depot: 3x2 flat land costs 300; overlap and money fail closed
assert.equal(COST_DEPOT, 300);
let depotResult = buildDepot(network, terrain, 'rail', 7, 0, 0, 400);
assert.equal(depotResult.ok, true);
assert.equal(depotResult.money, 100);
assert.deepEqual(depotResult.network.depots.map(d => [d.w, d.h]), [[3, 2]]);
assert.equal(buildDepot(depotResult.network, terrain, 'rail', 6, 0, 0, 1000).ok, false, 'overlapping depot');
assert.equal(buildDepot(depotResult.network, terrain, 'rail', 0, 6, 0, 299).ok, false, 'depot without money');
network = depotResult.network;

// 7. removal: no refund, unknown ids fail closed and keep money
const edge = network.edges[0];
let removal = removeEdge(network, edge.id, 100);
assert.equal(removal.ok, true);
assert.equal(removal.money, 100);
assert.equal(removal.network.edges.length, network.edges.length - 1);
assert.equal(removeEdge(network, 999, 100).ok, false);
assert.equal(removeEdge(network, 999, 100).money, 100);
network = removal.network;

// 8. a station with track touching its footprint refuses removal until the track goes
let fresh = createNetwork();
fresh = buildStation(fresh, terrain, 'rail', 2, 6, 0, 500).network;
const station = fresh.stations[0];
let withTrack = buildTrack(fresh, terrain, 'rail', p(2, 6), p(3, 6), 400);
assert.equal(withTrack.ok, true);
assert.equal(removeStation(withTrack.network, station.id, withTrack.money).ok, false, 'connected station');
const trackId = withTrack.network.edges[0].id;
withTrack = removeEdge(withTrack.network, trackId, withTrack.money);
assert.equal(removeStation(withTrack.network, station.id, withTrack.money).ok, true);

// 9. a depot with track touching its footprint refuses removal until the track goes
let depotFresh = createNetwork();
depotFresh = buildDepot(depotFresh, terrain, 'rail', 7, 0, 0, 500).network;
const depot = depotFresh.depots[0];
let depotTrack = buildTrack(depotFresh, terrain, 'rail', p(7, 0), p(7, 1), 400);
assert.equal(depotTrack.ok, true, 'edge endpoint inside the depot footprint is allowed as track');
assert.equal(removeDepot(depotTrack.network, depot.id, depotTrack.money).ok, false, 'connected depot');
const depotTrackId = depotTrack.network.edges[0].id;
depotTrack = removeEdge(depotTrack.network, depotTrackId, depotTrack.money);
assert.equal(removeDepot(depotTrack.network, depot.id, depotTrack.money).ok, true);

// 10. deterministic sequence, monotonic ids and no id reuse after removal
const run = () => {
  let n = createNetwork();
  let money = 1000;
  for (const [from, to] of [[[0, 0], [1, 0]], [[1, 0], [2, 0]], [[2, 0], [3, 0]]]) {
    const next = buildTrack(n, terrain, 'rail', p(...from), p(...to), money);
    assert.equal(next.ok, true);
    n = next.network;
    money = next.money;
  }
  n = removeEdge(n, 2, money).network;
  const after = buildTrack(n, terrain, 'rail', p(3, 0), p(4, 0), money);
  assert.equal(after.ok, true);
  return after.network;
};
const first = run(), second = run();
assert.deepEqual(clone(first), clone(second));
assert.deepEqual(first.edges.map(item => item.id), [1, 3, 4], 'removed id 2 is never reused');
assert.equal(first.nextId, 5);
console.log('D100 network: construction, removal, atomic failure, ids and determinism pass');

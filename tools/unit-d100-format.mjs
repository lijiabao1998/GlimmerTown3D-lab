// D100 transit save envelope guards: strict parse, stable bytes, fail-closed.
import assert from 'node:assert/strict';
import {createNetwork, buildTrack, buildStation, buildDepot} from '../src/sim/transit/network.ts';
import {serializeNetwork, parseNetwork, RT_VERSION, RT_RULES} from '../src/sim/transit/format.ts';

const p = (x, z, height = 0) => ({x, z, height});
const terrain = {size: 12, cell: () => ({elevation: 0, water: false, occupied: false})};
const clone = value => JSON.parse(JSON.stringify(value));

let network = createNetwork();
for (const [from, to] of [[p(0, 0), p(1, 0)], [p(1, 0), p(2, 0)], [p(2, 0), p(2, 1)]]) {
  const built = buildTrack(network, terrain, 'rail', from, to, 1000);
  assert.equal(built.ok, true);
  network = built.network;
}
network = buildStation(network, terrain, 'rail', 3, 3, 0, 1000).network;
network = buildDepot(network, terrain, 'rail', 6, 6, 0, 1000).network;
network = buildTrack(network, terrain, 'metro', p(1, 5, -1), p(2, 5, -1), 1000).network;

// 1. round-trip keeps every field, and serialization is byte-stable
const saved = serializeNetwork(network);
assert.equal(saved.v, RT_VERSION);
assert.equal(saved.rules, RT_RULES);
const parsed = parseNetwork(saved);
assert.equal(parsed.ok, true, parsed.ok ? '' : parsed.reason);
assert.deepEqual(clone(parsed.network), clone(network));
assert.equal(JSON.stringify(serializeNetwork(network)), JSON.stringify(serializeNetwork(network)));
assert.equal(JSON.stringify(saved), JSON.stringify(serializeNetwork(parsed.network)));

// 2. parsed state is independent from the saved bytes and from other parses
const first = parseNetwork(saved);
const second = parseNetwork(saved);
assert.equal(first.ok && second.ok, true);
second.network.edges[0].a = {x: 99, z: 0, height: 0};
assert.equal(first.network.edges[0].a.x, 0);
assert.deepEqual(clone(first.network), clone(parseNetwork(saved).network));

// 3. unknown envelope, version, rules and extra/missing keys fail closed
const rejects = (value, reason) => {
  const result = parseNetwork(value);
  assert.equal(result.ok, false);
  assert.match(result.reason, reason);
};
rejects(null, /d3\.rt 欄位不合法/);
rejects('nope', /d3\.rt 欄位不合法/);
rejects([], /d3\.rt 欄位不合法/);
rejects({...saved, extra: 1}, /d3\.rt 欄位不合法/);
rejects({...saved, v: 2}, /d3\.rt 版本不明/);
rejects({...saved, v: '1'}, /d3\.rt 版本不明/);
rejects({...saved, rules: 2}, /d3\.rt 規則版本不明/);
rejects({...saved, state: {...saved.state, extra: 1}}, /d3\.rt\.state 欄位不合法/);

// 4. corrupt edges fail closed
const withEdge = mutate => {
  const copy = clone(saved);
  mutate(copy.state.edges[0]);
  return parseNetwork(copy);
};
assert.equal(withEdge(edge => { edge.id = 0; }).ok, false);
assert.equal(withEdge(edge => { edge.id = 1.5; }).ok, false);
assert.equal(withEdge(edge => { edge.mode = 'bus'; }).ok, false);
assert.equal(withEdge(edge => { edge.a = {x: 0, z: 0, height: 0}; edge.b = {x: 2, z: 0, height: 0}; }).ok, false);
assert.equal(withEdge(edge => { edge.a = {x: 1, z: 0, height: 0}; edge.b = {x: 0, z: 0, height: 0}; }).ok, false);
assert.equal(withEdge(edge => { edge.a.height = -1; edge.b.height = -1; }).ok, false);
const duplicateEdges = clone(saved);
duplicateEdges.state.edges.push(clone(duplicateEdges.state.edges[0]));
assert.equal(parseNetwork(duplicateEdges).ok, false);

// 5. duplicate ids across kinds and nextId ordering fail closed
const duplicateIds = clone(saved);
duplicateIds.state.stations[0].id = duplicateIds.state.edges[0].id;
assert.equal(parseNetwork(duplicateIds).ok, false);
const lowNext = clone(saved);
lowNext.state.nextId = 1;
assert.equal(parseNetwork(lowNext).ok, false);

// 6. footprints: wrong size, overlap, out-of-range and layer fail closed
const withStation = mutate => {
  const copy = clone(saved);
  mutate(copy.state.stations[0]);
  return parseNetwork(copy);
};
assert.equal(withStation(station => { station.w = 3; }).ok, false);
assert.equal(withStation(station => { station.height = -1; }).ok, false);
assert.equal(withStation(station => { station.x = 4095; }).ok, false);
const overlapping = clone(saved);
overlapping.state.depots[0].x = overlapping.state.stations[0].x;
overlapping.state.depots[0].z = overlapping.state.stations[0].z;
assert.equal(parseNetwork(overlapping).ok, false);

// 7. empty network is legal and stable
const empty = parseNetwork(serializeNetwork(createNetwork()));
assert.equal(empty.ok, true);
assert.deepEqual(clone(empty.network), clone(createNetwork()));
console.log('D100 format: strict round-trip, stable bytes and fail-closed controls pass');

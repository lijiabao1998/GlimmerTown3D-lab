import assert from 'node:assert/strict';
import { previewTrack, buildTrack, trackPath } from '../src/sim/transitGraph.ts';
const p = (x, z, height = 0) => ({ x, z, height });
const cells = new Map([['1,1', { elevation: 0, occupied: true, water: false }], ['2,1', { elevation: 1, occupied: false, water: true }]]);
const terrain = { size: 4, cell(x, z) { return cells.get(`${x},${z}`) ?? { elevation: 0, occupied: false, water: false }; } };
let graph = { edges: [], revision: 0 }, money = 100;
const before = structuredClone(graph);
assert.equal(previewTrack({ edges: [], revision: -1 }, terrain, 'rail', p(0,0), p(1,0), money).ok, false);
assert.equal(previewTrack({ edges: [], revision: Number.MAX_SAFE_INTEGER }, terrain, 'rail', p(0,0), p(1,0), money).ok, false);
assert.equal(previewTrack(graph, terrain, 'rail', p(NaN,0), p(1,0), money).ok, false);
assert.equal(previewTrack(graph, terrain, 'rail', p(0,0), p(2,0), money).ok, false);
assert.equal(buildTrack(graph, terrain, 'rail', p(0,1), p(1,1), money).graph, graph);
assert.equal(buildTrack(graph, terrain, 'rail', p(0,0), p(1,0), 9).money, 9);
assert.deepEqual(graph, before);
for (const [a,b] of [[p(0,0),p(1,0)],[p(1,0),p(2,0)],[p(2,0),p(2,1,1)]]) {
  const built = buildTrack(graph, terrain, 'rail', a, b, money); assert.equal(built.result.ok, true); ({ graph, money } = built);
}
assert.equal(trackPath({ ...graph, edges: [graph.edges[0], graph.edges[0]] }, 'rail', p(0,0), p(1,0)), null);
assert.equal(money, 55); assert.equal(graph.revision, 3);
assert.equal(previewTrack(graph, terrain, 'rail', p(1,0), p(0,0), money).ok, false);
assert.deepEqual(trackPath(graph, 'rail', p(0,0), p(2,1,1)), [p(0,0),p(1,0),p(2,0),p(2,1,1)]);
assert.equal(trackPath(graph, 'tram', p(0,0), p(2,0)), null);
assert.equal(trackPath({ ...graph, edges: graph.edges.slice(0,1) }, 'rail', p(0,0), p(2,0)), null);
assert.equal(previewTrack(graph, terrain, 'metro', p(0,1,-1), p(1,1,-1), money).ok, true);
assert.equal(previewTrack(graph, terrain, 'metro', p(0,1,0), p(1,1,0), money).ok, false);
assert.equal(previewTrack(graph, terrain, 'rail', p(1,0), p(2,0,2), money).ok, false);
console.log('D097 graph: preview, atomic failure, construction, path, severance and mode separation passed');

// D097 independent rules: an in-memory construction preview, not a saved format.
// Edges join cardinal neighbours on one mode/layer; no Lab layers are rewritten.
export type TransitMode = 'rail' | 'tram' | 'metro';
export interface TransitPoint { readonly x: number; readonly z: number; readonly height: number }
export interface TransitEdge { readonly mode: TransitMode; readonly a: TransitPoint; readonly b: TransitPoint }
export interface TransitCell { readonly elevation: number; readonly water: boolean; readonly occupied: boolean }
export interface TransitTerrain { readonly size: number; cell(x: number, z: number): TransitCell }
export interface TransitGraph { readonly edges: readonly TransitEdge[]; readonly revision: number }
export type TrackPreview = { readonly ok: true; readonly edge: TransitEdge; readonly cost: number } | { readonly ok: false; readonly reason: string };
const MAX_EDGES = 8192;
const key = (p: TransitPoint) => `${p.x},${p.z},${p.height}`;
const compare = (a: TransitPoint, b: TransitPoint) => a.z - b.z || a.x - b.x || a.height - b.height;
const edgeKey = (e: TransitEdge) => `${e.mode}:${key(e.a)}:${key(e.b)}`;
const validPoint = (p: TransitPoint, n: number) => !!p && Number.isSafeInteger(p.x) && Number.isSafeInteger(p.z) && Number.isSafeInteger(p.height) && p.height >= -1 && p.height <= 255 && p.x >= 0 && p.z >= 0 && p.x < n && p.z < n;
const validMode = (mode: TransitMode) => mode === 'rail' || mode === 'tram' || mode === 'metro';
function validGraph(graph: TransitGraph, n: number): boolean {
  if (!graph || !Number.isSafeInteger(graph.revision) || graph.revision < 0 || graph.revision >= Number.MAX_SAFE_INTEGER || !Array.isArray(graph.edges) || graph.edges.length > MAX_EDGES) return false;
  const seen = new Set<string>();
  for (const e of graph.edges) {
    if (!e || !validMode(e.mode) || !validPoint(e.a, n) || !validPoint(e.b, n) || compare(e.a, e.b) >= 0 || Math.abs(e.a.x - e.b.x) + Math.abs(e.a.z - e.b.z) !== 1 || (e.mode === 'metro' ? e.a.height !== -1 || e.b.height !== -1 : e.a.height < 0 || e.b.height < 0 || Math.abs(e.a.height - e.b.height) > 1)) return false;
    const k = edgeKey(e); if (seen.has(k)) return false; seen.add(k);
  }
  return true;
}

/** Does not mutate graph, money or terrain. The caller must re-preview before committing. */
export function previewTrack(graph: TransitGraph, terrain: TransitTerrain, mode: TransitMode, from: TransitPoint, to: TransitPoint, money: number): TrackPreview {
  if (!Number.isSafeInteger(terrain.size) || terrain.size <= 0 || terrain.size > 4096 || !validPoint(from, terrain.size) || !validPoint(to, terrain.size)) return { ok: false, reason: '座標無效' };
  if (!validGraph(graph, terrain.size)) return { ok: false, reason: '網路無效' };
  if (!validMode(mode)) return { ok: false, reason: '模式無效' };
  if (Math.abs(from.x - to.x) + Math.abs(from.z - to.z) !== 1) return { ok: false, reason: '軌道必須連接相鄰格' };
  if (graph.edges.length >= MAX_EDGES) return { ok: false, reason: '網路已滿' };
  const [a, b] = compare(from, to) <= 0 ? [from, to] : [to, from];
  const edge: TransitEdge = { mode, a: { ...a }, b: { ...b } };
  if (graph.edges.some(e => edgeKey(e) === edgeKey(edge))) return { ok: false, reason: '軌道已存在' };
  const cells = [terrain.cell(a.x, a.z), terrain.cell(b.x, b.z)];
  if (cells.some(c => !c || !Number.isSafeInteger(c.elevation) || c.elevation < 0 || c.elevation > 255 || typeof c.water !== 'boolean' || typeof c.occupied !== 'boolean')) return { ok: false, reason: '地形無效' };
  if (mode === 'metro') {
    if (a.height !== -1 || b.height !== -1) return { ok: false, reason: '地鐵必須在地下' };
  } else {
    if (cells.some(c => c.occupied)) return { ok: false, reason: '建築擋住軌道' };
    if (a.height !== cells[0].elevation || b.height !== cells[1].elevation || Math.abs(a.height - b.height) > 1) return { ok: false, reason: '坡度或高度無效' };
  }
  const cost = mode === 'metro' ? 30 : cells.some(c => c.water) ? 25 : 10;
  if (!Number.isFinite(money) || money < cost) return { ok: false, reason: '資金不足' };
  return { ok: true, edge, cost };
}

/** A successful application returns a new graph; failures leave all inputs untouched. */
export function buildTrack(graph: TransitGraph, terrain: TransitTerrain, mode: TransitMode, from: TransitPoint, to: TransitPoint, money: number): { graph: TransitGraph; money: number; result: TrackPreview } {
  const result = previewTrack(graph, terrain, mode, from, to, money);
  if (!result.ok) return { graph, money, result };
  return { graph: { revision: graph.revision + 1, edges: [...graph.edges, result.edge] }, money: money - result.cost, result };
}

/** Shortest edge path with deterministic coordinate tie breaks; no cross-mode/layer teleport. */
export function trackPath(graph: TransitGraph, mode: TransitMode, from: TransitPoint, to: TransitPoint): TransitPoint[] | null {
  if (!validGraph(graph, 4096) || !validMode(mode) || !validPoint(from, 4096) || !validPoint(to, 4096)) return null;
  const adjacency = new Map<string, TransitPoint[]>();
  for (const e of graph.edges) if (e.mode === mode) {
    for (const [a, b] of [[e.a, e.b], [e.b, e.a]]) {
      const k = key(a); if (!adjacency.has(k)) adjacency.set(k, []); adjacency.get(k)!.push(b);
    }
  }
  const start = key(from), end = key(to);
  if (!adjacency.has(start) || !adjacency.has(end)) return null;
  const queue = [from], previous = new Map<string, TransitPoint | null>([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]; if (key(p) === end) break;
    for (const next of (adjacency.get(key(p)) ?? []).slice().sort(compare)) if (!previous.has(key(next))) { previous.set(key(next), p); queue.push(next); }
  }
  if (!previous.has(end)) return null;
  const path: TransitPoint[] = []; let p: TransitPoint | null = to;
  while (p) { path.push(p); p = previous.get(key(p)) ?? null; }
  return path.reverse();
}

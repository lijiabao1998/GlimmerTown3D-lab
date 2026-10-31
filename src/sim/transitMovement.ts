// D097 independent prototype rules; no storage, renderer, service or Lab parity.
// A removed edge freezes a vehicle at its exact progress until that edge is restored.
import type { TransitGraph, TransitMode, TransitPoint } from './transitGraph.ts';

export interface TransitMovement {
  readonly mode: TransitMode;
  readonly path: readonly TransitPoint[];
  readonly segment: number;
  readonly elapsed: number;
  readonly minutesPerEdge: number;
}
export interface MovementResult { readonly state: TransitMovement; readonly status: 'moving' | 'blocked' | 'arrived' | 'paused' }
const MAX_PATH = 8193;
const MAX_MINUTES = 172800;
const pointKey = (p: TransitPoint) => `${p.x},${p.z},${p.height}`;
const validPoint = (p: TransitPoint) => !!p && Number.isSafeInteger(p.x) && p.x >= 0 && p.x < 4096 && Number.isSafeInteger(p.z) && p.z >= 0 && p.z < 4096 && Number.isSafeInteger(p.height) && p.height >= -1 && p.height <= 255;
const pairKey = (a: TransitPoint, b: TransitPoint) => {
  const ka = pointKey(a), kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
};
const legalPair = (a: TransitPoint, b: TransitPoint, mode: TransitMode) =>
  validPoint(a) && validPoint(b) && Math.abs(a.x - b.x) + Math.abs(a.z - b.z) === 1 &&
  (mode === 'metro' ? a.height === -1 && b.height === -1 : a.height >= 0 && b.height >= 0 && Math.abs(a.height - b.height) <= 1);

/** Pure, bounded advance. Invalid input throws without modifying the input. */
export function advanceMovement(graph: TransitGraph, state: TransitMovement, minutes: number, paused = false): MovementResult {
  if (!graph || !Array.isArray(graph.edges) || graph.edges.length > 8192 || !state || !Array.isArray(state.path) || state.path.length < 1 || state.path.length > MAX_PATH ||
      !['rail', 'tram', 'metro'].includes(state.mode) || !Number.isSafeInteger(state.segment) || state.segment < 0 || state.segment >= state.path.length ||
      !Number.isSafeInteger(state.minutesPerEdge) || state.minutesPerEdge < 1 || state.minutesPerEdge > 1440 || !Number.isSafeInteger(state.elapsed) || state.elapsed < 0 || state.elapsed >= state.minutesPerEdge ||
      (state.segment === state.path.length - 1 && state.elapsed !== 0) || !Number.isSafeInteger(minutes) || minutes < 0 || minutes > MAX_MINUTES || typeof paused !== 'boolean' ||
      state.path.some(p => !validPoint(p)) || state.path.some((p, i) => i > 0 && !legalPair(state.path[i - 1], p, state.mode))) throw new Error('invalid transit movement');
  const edges = new Set<string>();
  for (const edge of graph.edges) {
    if (!edge || !['rail', 'tram', 'metro'].includes(edge.mode) || !legalPair(edge.a, edge.b, edge.mode)) throw new Error('invalid transit graph');
    if (edge.mode === state.mode) edges.add(pairKey(edge.a, edge.b));
  }
  let segment = state.segment, elapsed = state.elapsed, remaining = minutes;
  if (segment === state.path.length - 1) return { state, status: 'arrived' };
  if (paused) return { state, status: 'paused' };
  while (segment < state.path.length - 1) {
    if (!edges.has(pairKey(state.path[segment], state.path[segment + 1]))) return { state: { ...state, segment, elapsed }, status: 'blocked' };
    if (remaining < state.minutesPerEdge - elapsed) { elapsed += remaining; break; }
    remaining -= state.minutesPerEdge - elapsed;
    segment++; elapsed = 0;
    // Report a missing next edge at the boundary even when this advance used
    // its final minute; a larger batch and repeated minutes then agree.
    if (remaining === 0 && segment < state.path.length - 1 && !edges.has(pairKey(state.path[segment], state.path[segment + 1])))
      return { state: { ...state, segment, elapsed }, status: 'blocked' };
    if (remaining === 0) break;
  }
  return { state: { ...state, segment, elapsed }, status: segment === state.path.length - 1 ? 'arrived' : 'moving' };
}

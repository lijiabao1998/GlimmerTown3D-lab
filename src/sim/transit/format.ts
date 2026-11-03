// D100 transit save envelope (d3.rt v1, construction only).
// Pure and strict: unknown versions, unknown keys, bad ids, overlapping
// footprints and illegal edges all fail closed; nothing is coerced.
import {STATION_W, STATION_H, DEPOT_W, DEPOT_H} from './network.ts';
import type {NetworkEdge, TransitDepot, TransitNetwork, TransitStation} from './network.ts';
import type {TransitMode, TransitPoint} from './graph.ts';

export const RT_VERSION = 1;
export const RT_RULES = 1;
const MAX_COORD = 4095;
const MAX_ID = 2147483647;

type Point = {readonly x: number; readonly z: number; readonly height: number};
export interface TransitSaveV1 {
  readonly v: 1;
  readonly rules: 1;
  readonly state: {
    readonly edges: readonly {readonly id: number; readonly mode: TransitMode; readonly a: Point; readonly b: Point}[];
    readonly stations: readonly {readonly id: number; readonly mode: TransitMode; readonly x: number; readonly z: number; readonly height: number; readonly w: number; readonly h: number}[];
    readonly depots: readonly {readonly id: number; readonly mode: TransitMode; readonly x: number; readonly z: number; readonly height: number; readonly w: number; readonly h: number}[];
    readonly nextId: number;
    readonly revision: number;
  };
}
export type ParseResult = {readonly ok: true; readonly network: TransitNetwork} | {readonly ok: false; readonly reason: string};

const isInt = (value: unknown, min: number, max: number): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const isMode = (value: unknown): value is TransitMode => value === 'rail' || value === 'tram' || value === 'metro';
const keys = (value: unknown): string[] => (typeof value === 'object' && value !== null ? Object.keys(value) : []);
const sameKeys = (value: unknown, expected: readonly string[]): boolean => {
  const actual = keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
};
const copyPoint = (point: TransitPoint): {x: number; z: number; height: number} => ({x: point.x, z: point.z, height: point.height});

export function serializeNetwork(network: TransitNetwork): TransitSaveV1 {
  return {
    v: RT_VERSION,
    rules: RT_RULES,
    state: {
      edges: network.edges.map(edge => ({id: edge.id, mode: edge.mode, a: copyPoint(edge.a), b: copyPoint(edge.b)})),
      stations: network.stations.map(station => ({id: station.id, mode: station.mode, x: station.x, z: station.z, height: station.height, w: station.w, h: station.h})),
      depots: network.depots.map(depot => ({id: depot.id, mode: depot.mode, x: depot.x, z: depot.z, height: depot.height, w: depot.w, h: depot.h})),
      nextId: network.nextId,
      revision: network.revision,
    },
  };
}

function fail(reason: string): ParseResult {
  return {ok: false, reason};
}

function readPoint(raw: unknown, label: string): {ok: true; point: {x: number; z: number; height: number}} | {ok: false; reason: string} {
  if (!sameKeys(raw, ['x', 'z', 'height'])) return {ok: false, reason: label + ' 欄位不合法'};
  const point = raw as Record<string, unknown>;
  if (!isInt(point.x, 0, MAX_COORD) || !isInt(point.z, 0, MAX_COORD) || !isInt(point.height, -1, 255)) return {ok: false, reason: label + ' 座標不合法'};
  return {ok: true, point: {x: point.x as number, z: point.z as number, height: point.height as number}};
}

function readEdge(raw: unknown): {ok: true; edge: NetworkEdge} | {ok: false; reason: string} {
  if (!sameKeys(raw, ['id', 'mode', 'a', 'b'])) return {ok: false, reason: '軌道欄位不合法'};
  const edge = raw as Record<string, unknown>;
  if (!isInt(edge.id, 1, MAX_ID) || !isMode(edge.mode)) return {ok: false, reason: '軌道識別碼或模式不合法'};
  const a = readPoint(edge.a, '軌道端點');
  if (!a.ok) return a;
  const b = readPoint(edge.b, '軌道端點');
  if (!b.ok) return b;
  if (Math.abs(a.point.x - b.point.x) + Math.abs(a.point.z - b.point.z) !== 1) return {ok: false, reason: '軌道必須連接相鄰格'};
  const canonical = a.point.z < b.point.z || (a.point.z === b.point.z && a.point.x < b.point.x);
  if (!canonical) return {ok: false, reason: '軌道端點必須依座標排序'};
  if (edge.mode === 'metro') {
    if (a.point.height !== -1 || b.point.height !== -1) return {ok: false, reason: '地鐵必須在地下'};
  } else {
    if (a.point.height < 0 || b.point.height < 0 || Math.abs(a.point.height - b.point.height) > 1) return {ok: false, reason: '軌道高度不合法'};
  }
  return {ok: true, edge: {id: edge.id as number, mode: edge.mode, a: a.point, b: b.point}};
}

function readFootprint(raw: unknown, expectedW: number, expectedH: number): {ok: true; record: TransitStation | TransitDepot} | {ok: false; reason: string} {
  if (!sameKeys(raw, ['id', 'mode', 'x', 'z', 'height', 'w', 'h'])) return {ok: false, reason: '站點欄位不合法'};
  const item = raw as Record<string, unknown>;
  if (!isInt(item.id, 1, MAX_ID) || !isMode(item.mode)) return {ok: false, reason: '站點識別碼或模式不合法'};
  if (!isInt(item.x, 0, MAX_COORD) || !isInt(item.z, 0, MAX_COORD) || !isInt(item.height, -1, 255)) return {ok: false, reason: '站點座標不合法'};
  if (item.w !== expectedW || item.h !== expectedH) return {ok: false, reason: '站點佔地不合法'};
  if (item.mode === 'metro' ? item.height !== -1 : (item.height as number) < 0) return {ok: false, reason: '站點層級不合法'};
  if ((item.x as number) + expectedW > MAX_COORD + 1 || (item.z as number) + expectedH > MAX_COORD + 1) return {ok: false, reason: '站點越界'};
  return {ok: true, record: {id: item.id as number, mode: item.mode, x: item.x as number, z: item.z as number, height: item.height as number, w: expectedW, h: expectedH}};
}

export function parseNetwork(raw: unknown): ParseResult {
  if (!sameKeys(raw, ['v', 'rules', 'state'])) return fail('d3.rt 欄位不合法');
  const envelope = raw as Record<string, unknown>;
  if (envelope.v !== RT_VERSION) return fail('d3.rt 版本不明');
  if (envelope.rules !== RT_RULES) return fail('d3.rt 規則版本不明');
  if (!sameKeys(envelope.state, ['edges', 'stations', 'depots', 'nextId', 'revision'])) return fail('d3.rt.state 欄位不合法');
  const state = envelope.state as Record<string, unknown>;
  if (!Array.isArray(state.edges) || !Array.isArray(state.stations) || !Array.isArray(state.depots)) return fail('d3.rt 陣列不合法');
  if (!isInt(state.nextId, 1, MAX_ID) || !isInt(state.revision, 0, MAX_ID)) return fail('d3.rt 計數不合法');

  const edges: NetworkEdge[] = [];
  const ids = new Set<number>();
  const edgeKeys = new Set<string>();
  for (const rawEdge of state.edges) {
    const parsed = readEdge(rawEdge);
    if (!parsed.ok) return parsed;
    if (ids.has(parsed.edge.id)) return fail('重複的識別碼');
    ids.add(parsed.edge.id);
    const key = `${parsed.edge.mode}:${parsed.edge.a.x},${parsed.edge.a.z},${parsed.edge.a.height}:${parsed.edge.b.x},${parsed.edge.b.z},${parsed.edge.b.height}`;
    if (edgeKeys.has(key)) return fail('重複的軌道');
    edgeKeys.add(key);
    edges.push(parsed.edge);
  }

  const stations: TransitStation[] = [];
  for (const rawStation of state.stations) {
    const parsed = readFootprint(rawStation, STATION_W, STATION_H);
    if (!parsed.ok) return parsed;
    if (ids.has(parsed.record.id)) return fail('重複的識別碼');
    ids.add(parsed.record.id);
    stations.push(parsed.record);
  }
  const depots: TransitDepot[] = [];
  for (const rawDepot of state.depots) {
    const parsed = readFootprint(rawDepot, DEPOT_W, DEPOT_H);
    if (!parsed.ok) return parsed;
    if (ids.has(parsed.record.id)) return fail('重複的識別碼');
    ids.add(parsed.record.id);
    depots.push(parsed.record);
  }

  const cells = new Map<string, number>();
  for (const item of [...stations, ...depots]) {
    for (let dz = 0; dz < item.h; dz++) for (let dx = 0; dx < item.w; dx++) {
      const key = `${item.x + dx},${item.z + dz}`;
      const owner = cells.get(key);
      if (owner !== undefined && owner !== item.id) return fail('站點佔地重疊');
      cells.set(key, item.id);
    }
  }

  const maxId = ids.size ? Math.max(...ids) : 0;
  const nextId = state.nextId as number;
  const revision = state.revision as number;
  if (nextId <= maxId) return fail('nextId 必須大於所有既有識別碼');
  return {ok: true, network: {edges, stations, depots, nextId, revision}};
}

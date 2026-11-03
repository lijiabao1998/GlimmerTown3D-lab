// D100 network state: construction and removal of track, stations and depots.
// Pure functions only: every mutation returns a new immutable network (or the
// same network on failure), never touching money, events or the world directly.
import {previewTrack} from './graph.ts';
import type {TransitEdge, TransitGraph, TransitMode, TransitPoint, TransitTerrain} from './graph.ts';

export const COST_STATION = 120;
export const COST_DEPOT = 300;
export const STATION_W = 2;
export const STATION_H = 1;
export const DEPOT_W = 3;
export const DEPOT_H = 2;
const MAX_ID = 2147483647;

export interface NetworkEdge { readonly id: number; readonly mode: TransitMode; readonly a: TransitPoint; readonly b: TransitPoint }
export interface TransitStation { readonly id: number; readonly mode: TransitMode; readonly x: number; readonly z: number; readonly height: number; readonly w: number; readonly h: number }
export interface TransitDepot { readonly id: number; readonly mode: TransitMode; readonly x: number; readonly z: number; readonly height: number; readonly w: number; readonly h: number }
export interface TransitNetwork {
  readonly edges: readonly NetworkEdge[];
  readonly stations: readonly TransitStation[];
  readonly depots: readonly TransitDepot[];
  readonly nextId: number;
  readonly revision: number;
}
export type NetworkResult = { readonly ok: true; readonly network: TransitNetwork; readonly money: number } | { readonly ok: false; readonly reason: string; readonly network: TransitNetwork; readonly money: number };

export function createNetwork(): TransitNetwork {
  return {edges: [], stations: [], depots: [], nextId: 1, revision: 0};
}

export function trackGraph(network: TransitNetwork): TransitGraph {
  return {revision: network.revision, edges: network.edges.map(edge => ({mode: edge.mode, a: edge.a, b: edge.b}))};
}

export function footprint(x: number, z: number, w: number, h: number): readonly TransitPoint[] {
  const cells: TransitPoint[] = [];
  for (let dz = 0; dz < h; dz++) for (let dx = 0; dx < w; dx++) cells.push({x: x + dx, z: z + dz, height: 0});
  return cells;
}

function cellsOf(x: number, z: number, w: number, h: number, height: number): readonly TransitPoint[] {
  return footprint(x, z, w, h).map(cell => ({x: cell.x, z: cell.z, height}));
}

function occupiedBy(network: TransitNetwork, cell: TransitPoint): boolean {
  const inside = (x: number, z: number, w: number, h: number) => cell.x >= x && cell.x < x + w && cell.z >= z && cell.z < z + h;
  return network.stations.some(station => inside(station.x, station.z, station.w, station.h))
    || network.depots.some(depot => inside(depot.x, depot.z, depot.w, depot.h));
}

function insideCell(x: number, z: number, w: number, h: number, point: TransitPoint): boolean {
  return point.x >= x && point.x < x + w && point.z >= z && point.z < z + h;
}

function attempt(network: TransitNetwork, money: number, reason: string): NetworkResult {
  return {ok: false, reason, network, money};
}

export function buildTrack(network: TransitNetwork, terrain: TransitTerrain, mode: TransitMode, from: TransitPoint, to: TransitPoint, money: number): NetworkResult {
  const preview = previewTrack(trackGraph(network), terrain, mode, from, to, money);
  if (!preview.ok) return attempt(network, money, preview.reason);
  const edge: NetworkEdge = {id: network.nextId, mode: preview.edge.mode, a: preview.edge.a, b: preview.edge.b};
  return {
    ok: true,
    money: money - preview.cost,
    network: {edges: [...network.edges, edge], stations: network.stations, depots: network.depots, nextId: network.nextId + 1, revision: network.revision + 1},
  };
}

function place(network: TransitNetwork, terrain: TransitTerrain, mode: TransitMode, x: number, z: number, height: number, w: number, h: number, money: number, cost: number, kind: 'station' | 'depot'): NetworkResult {
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z) || !Number.isSafeInteger(height) || !Number.isSafeInteger(money)) return attempt(network, money, '座標或資金無效');
  if (height < -1 || height > 255) return attempt(network, money, '高度無效');
  if (network.nextId >= MAX_ID) return attempt(network, money, '識別碼已滿');
  if (!Number.isFinite(money) || money < cost) return attempt(network, money, '資金不足');
  if (mode === 'metro' ? height !== -1 : height < 0) return attempt(network, money, '地下或地面層不合法');
  for (const cell of cellsOf(x, z, w, h, height)) {
    if (cell.x < 0 || cell.z < 0 || cell.x >= terrain.size || cell.z >= terrain.size) return attempt(network, money, '越界');
    if (occupiedBy(network, cell)) return attempt(network, money, '與既有站點重疊');
    if (mode !== 'metro') {
      const terrainCell = terrain.cell(cell.x, cell.z);
      if (!terrainCell || terrainCell.water) return attempt(network, money, '水面不能建造');
      if (terrainCell.occupied) return attempt(network, money, '建築占位');
      if (terrainCell.elevation !== height) return attempt(network, money, '高度與地形不符');
    }
  }
  const record = {id: network.nextId, mode, x, z, height, w, h} as const;
  const next = kind === 'station'
    ? {...network, stations: [...network.stations, record], nextId: network.nextId + 1, revision: network.revision + 1}
    : {...network, depots: [...network.depots, record], nextId: network.nextId + 1, revision: network.revision + 1};
  return {ok: true, network: next, money: money - cost};
}

export function buildStation(network: TransitNetwork, terrain: TransitTerrain, mode: TransitMode, x: number, z: number, height: number, money: number): NetworkResult {
  return place(network, terrain, mode, x, z, height, STATION_W, STATION_H, money, COST_STATION, 'station');
}

export function buildDepot(network: TransitNetwork, terrain: TransitTerrain, mode: TransitMode, x: number, z: number, height: number, money: number): NetworkResult {
  return place(network, terrain, mode, x, z, height, DEPOT_W, DEPOT_H, money, COST_DEPOT, 'depot');
}

export function removeEdge(network: TransitNetwork, id: number, money: number): NetworkResult {
  const edge = network.edges.find(item => item.id === id);
  if (!edge) return attempt(network, money, '找不到軌道');
  return {ok: true, money, network: {...network, edges: network.edges.filter(item => item.id !== id), revision: network.revision + 1}};
}

function touchesEdges(network: TransitNetwork, x: number, z: number, w: number, h: number): boolean {
  return network.edges.some(edge => insideCell(x, z, w, h, edge.a) || insideCell(x, z, w, h, edge.b));
}

export function removeStation(network: TransitNetwork, id: number, money: number): NetworkResult {
  const station = network.stations.find(item => item.id === id);
  if (!station) return attempt(network, money, '找不到車站');
  if (touchesEdges(network, station.x, station.z, station.w, station.h)) return attempt(network, money, '請先拆連接的軌道');
  return {ok: true, money, network: {...network, stations: network.stations.filter(item => item.id !== id), revision: network.revision + 1}};
}

export function removeDepot(network: TransitNetwork, id: number, money: number): NetworkResult {
  const depot = network.depots.find(item => item.id === id);
  if (!depot) return attempt(network, money, '找不到車廠');
  if (touchesEdges(network, depot.x, depot.z, depot.w, depot.h)) return attempt(network, money, '請先拆連接的軌道');
  return {ok: true, money, network: {...network, depots: network.depots.filter(item => item.id !== id), revision: network.revision + 1}};
}

export function edgeIdAt(network: TransitNetwork, edge: TransitEdge): number | null {
  const found = network.edges.find(item => item.mode === edge.mode
    && ((item.a.x === edge.a.x && item.a.z === edge.a.z && item.a.height === edge.a.height && item.b.x === edge.b.x && item.b.z === edge.b.z && item.b.height === edge.b.height)
      || (item.a.x === edge.b.x && item.a.z === edge.b.z && item.a.height === edge.b.height && item.b.x === edge.a.x && item.b.z === edge.a.z && item.b.height === edge.a.height)));
  return found ? found.id : null;
}

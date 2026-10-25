export type Point = [number, number, number];
export interface CivicMarketDesign { id:string; triangles:{p:Point[];n:Point;color:string;part:string;structural:boolean}[];parts:{name:string;solid:boolean;faces:{points:Point[];color:string}[];start:number}[] }
export const MODEL_IDS: readonly string[];
export function createCivicMarketDesign(id:string):CivicMarketDesign;
export function emitCivicMarketDesign(p:import('./kindArt.ts').Pen,id:string):CivicMarketDesign;
export function normal(p:Point[]):Point;
export function subtract(a:Point,b:Point):Point;
export function cross(a:Point,b:Point):Point;
export interface CivicMarketCacheInfo {
  readonly sourceSha256: string;
  readonly decoded: readonly {readonly id:string;readonly payloadBytes:number;readonly decodeMs:number|null;readonly triangles:number;readonly sourceSha256:string}[];
  readonly fallbacks: readonly {readonly id:string;readonly reason:string}[];
  readonly renderCachedModels: readonly string[];
  readonly proceduralCachedModels: readonly string[];
}
export function civicMarketCacheInfo():CivicMarketCacheInfo;

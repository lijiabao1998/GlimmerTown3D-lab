export type Point = [number,number,number];
export interface BritishMarketEstateDesign {id:string;triangles:{p:Point[];n:Point;color:string;part:string;structural:boolean}[];parts:{name:string;solid:boolean;faces:{points:Point[];color:string}[];start:number}[];facades:{name:string;solid:false;faces:{points:Point[];color:string}[];hostPart:number;hostFace:number;sourcePart:number;originalGap:number}[]}
export const MODEL_IDS:readonly string[];
export function buildBritishMarketEstate(id:string):BritishMarketEstateDesign;
export function emitBritishMarketEstate(p:import('./kindArt.ts').Pen,id:string):BritishMarketEstateDesign;
export function normal(p:Point[]):Point;
export function subtract(a:Point,b:Point):Point;
export function cross(a:Point,b:Point):Point;
export interface BritishMarketEstateCacheInfo {readonly sourceSha256:string;readonly decoded:readonly {readonly id:string;readonly payloadBytes:number;readonly decodeMs:number|null;readonly triangles:number;readonly sourceSha256:string}[];readonly fallbacks:readonly {readonly id:string;readonly reason:string}[];readonly renderCachedModels:readonly string[];readonly proceduralCachedModels:readonly string[]}
export function britishMarketEstateCacheInfo():BritishMarketEstateCacheInfo;

export const createMarketEstateDesign:typeof buildBritishMarketEstate;
export const emitMarketEstateDesign:typeof emitBritishMarketEstate;
export const marketEstateCacheInfo:typeof britishMarketEstateCacheInfo;

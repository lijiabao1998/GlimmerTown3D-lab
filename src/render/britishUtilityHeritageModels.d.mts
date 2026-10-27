export type Point = [number,number,number];
export interface BritishUtilityHeritageDesign {id:string;triangles:{p:Point[];n:Point;color:string;part:string;structural:boolean}[];parts:{name:string;solid:boolean;faces:{points:Point[];color:string}[];start:number}[];facades:{name:string;solid:false;faces:{points:Point[];color:string}[];hostPart:number;hostFace:number;sourcePart:number;originalGap:number}[]}
export const MODEL_IDS:readonly string[];
export function buildBritishUtilityHeritage(id:string):BritishUtilityHeritageDesign;
export function emitBritishUtilityHeritage(p:import('./kindArt.ts').Pen,id:string):BritishUtilityHeritageDesign;
export function normal(p:Point[]):Point;
export function subtract(a:Point,b:Point):Point;
export function cross(a:Point,b:Point):Point;
export interface BritishUtilityHeritageCacheInfo {readonly sourceSha256:string;readonly decoded:readonly {readonly id:string;readonly payloadBytes:number;readonly decodeMs:number|null;readonly triangles:number;readonly sourceSha256:string}[];readonly fallbacks:readonly {readonly id:string;readonly reason:string}[];readonly renderCachedModels:readonly string[];readonly proceduralCachedModels:readonly string[]}
export function britishUtilityHeritageCacheInfo():BritishUtilityHeritageCacheInfo;

export const createUtilityHeritageDesign:typeof buildBritishUtilityHeritage;
export const emitUtilityHeritageDesign:typeof emitBritishUtilityHeritage;
export const utilityHeritageCacheInfo:typeof britishUtilityHeritageCacheInfo;

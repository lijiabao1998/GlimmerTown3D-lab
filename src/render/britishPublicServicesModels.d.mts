export type Point = [number,number,number];
export interface PublicServiceDesign {id:string;triangles:{p:Point[];n:Point;color:string;part:string;structural:boolean}[];parts:{name:string;solid:boolean;faces:{points:Point[];color:string}[];start:number}[];facades:{name:string;solid:false;faces:{points:Point[];color:string}[];hostPart:number;hostFace:number;sourcePart:number;originalGap:number}[]}
export const MODEL_IDS:readonly string[];
export function createPublicServiceDesign(id:string):PublicServiceDesign;
export function emitPublicServiceDesign(p:import('./kindArt.ts').Pen,id:string):PublicServiceDesign;
export function normal(p:Point[]):Point;
export function subtract(a:Point,b:Point):Point;
export function cross(a:Point,b:Point):Point;
export interface PublicServiceCacheInfo {readonly sourceSha256:string;readonly decoded:readonly {readonly id:string;readonly payloadBytes:number;readonly decodeMs:number|null;readonly triangles:number;readonly sourceSha256:string}[];readonly fallbacks:readonly {readonly id:string;readonly reason:string}[];readonly renderCachedModels:readonly string[];readonly proceduralCachedModels:readonly string[]}
export function publicServiceCacheInfo():PublicServiceCacheInfo;

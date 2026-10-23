import type {Pen} from './kindArt.ts';
export interface D083Triangle {p:[number,number,number][];n:[number,number,number];color:string;structural:boolean;part:string}
export interface D083Mesh {id:string;triangles:D083Triangle[];parts:{name:string;start:number;count?:number;structural:boolean}[]}
export const DESIGNS:readonly {id:string;name:string;zh:string;vocabulary:string;reference:string}[];
export function createDesign(id:string):D083Mesh;
export function emitD083Prototype(p:Pen,id:string):D083Mesh;

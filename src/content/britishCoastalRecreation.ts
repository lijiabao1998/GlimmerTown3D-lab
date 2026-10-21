// D082 art-direction reset: two integrated prototypes only. Not the final eight-plus round.
export type V3=[number,number,number];
export type Face={points:V3[];layer:'W'|'O';color:string};
export type Component={name:string;faces:Face[];ground:V3[]};
export type Model={k:number;v:number;name:string;H:number;size:number;cap:number;components:Component[]};
export const MODELS:Model[]=[
 {k:179,v:0,name:'Cotswold stone village hall',H:.78,size:1,cap:182,components:[]},
 {k:179,v:1,name:'Arts-and-Crafts community reading room',H:.66,size:1,cap:182,components:[]},
];
export const COASTAL_RECREATION_KINDS:ReadonlySet<number>=new Set(MODELS.map(m=>m.k));

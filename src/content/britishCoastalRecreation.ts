// D082 nine-building redesign. The accepted pair is preserved; the full batch still needs visual review.
export type V3=[number,number,number];
export type Face={points:V3[];layer:'W'|'O';color:string};
export type Component={name:string;faces:Face[];ground:V3[]};
export type Model={k:number;v:number;name:string;H:number;size:number;cap:number;components:Component[]};
export const MODELS:Model[]=[
 {k:179,v:0,name:'Cotswold stone village hall',H:.78,size:1,cap:182,components:[]},
 {k:179,v:1,name:'Arts-and-Crafts community reading room',H:.66,size:1,cap:182,components:[]},
 {k:179,v:2,name:'Twin-gabled village schoolhouse',H:0.56,size:1,cap:182,components:[]},
 {k:185,v:0,name:'Stone coastal lookout house',H:1.48,size:1,cap:120,components:[]},
 {k:185,v:1,name:'Victorian brick lifeboat station',H:0.88,size:1,cap:120,components:[]},
 {k:185,v:2,name:'Hipped-roof harbour office',H:0.91,size:1,cap:120,components:[]},
 {k:154,v:0,name:'Reservoir court and gate pavilions',H:0.33,size:4,cap:342,components:[]},
 {k:154,v:1,name:'Victorian waterworks engine house',H:0.87,size:4,cap:342,components:[]},
 {k:154,v:2,name:'Reservoir superintendent lodge and pump hall',H:0.78,size:4,cap:342,components:[]},
];
export const COASTAL_RECREATION_KINDS:ReadonlySet<number>=new Set(MODELS.map(m=>m.k));

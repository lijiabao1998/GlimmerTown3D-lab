// D082 exact-slot coastal recreation architecture. Rendering only; no new kind IDs.
// Original code-generated geometry; coordinates are parcel fractions and inherited H.
export type V3 = [number, number, number];
export type Face = { points: V3[]; layer: 'W'|'O'; color: string };
export type Component = { name: string; faces: Face[]; ground: V3[] };
export type Model = { k:number; v:number; name:string; H:number; size:number; cap:number; components:Component[] };
const brick='#ad725b',stone='#d7c9a9',slate='#4e626a',green='#526956';
const f=(points:V3[],layer:'W'|'O',color:string):Face=>({points,layer,color});
// Polygon winding is fixed by centroid/outward normal in emit; end faces retain
// the complete profile, including genuine valleys and broken roof slopes.
function prism(name:string,line:[number,number][],z0:number,z1:number,color=stone):Component{
 const end:V3[]=[[line[0][0],0,z0],[line.at(-1)![0],0,z0],...[...line].reverse().map(([x,y]):V3=>[x,y,z0])];
 const faces=[f(end,'W',color),f(end.map(([x,y]):V3=>[x,y,z1]),'W',color)];
 for(let i=0;i<line.length-1;i++){const [x,y]=line[i],[xx,yy]=line[i+1];faces.push(f([[x,y,z0],[xx,yy,z0],[xx,yy,z1],[x,y,z1]],x===xx?'W':'O',x===xx?color:slate));}
 for(const [x,y] of [line[0],line.at(-1)!])faces.push(f([[x,0,z0],[x,0,z1],[x,y,z1],[x,y,z0]],'W',color));
 return {name,faces,ground:[[line[0][0],0,z0],[line.at(-1)![0],0,z0],[line.at(-1)![0],0,z1],[line[0][0],0,z1]]};
}
function polygon(name:string,outline:[number,number][],eave:number,top:V3|null,color=brick):Component{
 const e=outline.map(([x,z]):V3=>[x,eave,z]);
 const faces=e.map((a,i)=>{const b=e[(i+1)%e.length];return f([[a[0],0,a[2]],[b[0],0,b[2]],b,a],'W',color);});
 if(top)for(let i=0;i<e.length;i++)faces.push(f([e[i],e[(i+1)%e.length],top],'O',green));
 else faces.push(f(e,'O',slate));
 return {name,faces,ground:outline.map(([x,z]):V3=>[x,0,z])};
}
const rect=(x0:number,z0:number,x1:number,z1:number):[number,number][]=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
const model=(k:number,v:number,name:string,H:number,size:number,cap:number,components:Component[]):Model=>({k,v,name,H,size,cap,components});
export const MODELS:Model[]=[
 model(126,0,'Gambrel playgroup cottage',.94,1,56,[prism('broken-pitch main hall',[[.15,.48],[.24,.85],[.49,1],[.73,.85],[.85,.48]],.18,.82,brick)]),
 model(126,1,'Saltbox activity cottage',.47,1,56,[prism('unequal saltbox',[[.13,.35],[.38,1],[.56,.83],[.87,.55]],.20,.80)]),
 model(126,2,'Twin-gabled play pavilion',.42,1,56,[prism('unequal twin gables',[[.14,.51],[.32,1],[.51,.51],[.70,.85],[.86,.51]],.23,.77,brick)]),
 model(179,0,'Festival hall and pyramidal lodge',.78,1,182,[prism('meeting hall',[[.13,.58],[.35,1],[.57,.58]],.17,.59),polygon('detached vestry',rect(.68,.70,.88,.90),.35,[.78,.70,.80])]),
 model(179,1,'Clerestory lantern-square hall',.66,1,182,[prism('stepped clerestory hall',[[.13,.46],[.38,.70],[.38,1],[.64,.82],[.64,.57],[.87,.40]],.18,.82,brick)]),
 model(179,2,'Open-court community hall',.56,1,182,[polygon('open courtyard shell',[[.13,.15],[.87,.15],[.87,.84],[.65,.84],[.65,.42],[.35,.42],[.35,.84],[.13,.84]],1,null)]),
 model(185,0,'Bow-roof coastal visitor house',1.48,1,120,[prism('clipped boathouse roof',[[.12,.48],[.19,.77],[.32,1],[.47,1],[.59,.77],[.65,.48]],.18,.58,brick),polygon('separate office',rect(.73,.73,.90,.90),.43,[.815,.73,.815])]),
 model(185,1,'Butterfly observation lodge and store',.88,1,120,[prism('butterfly lodge',[[.12,1],[.37,.61],[.60,.87]],.18,.82),polygon('hexagonal store',[[.72,.33],[.82,.33],[.89,.43],[.89,.60],[.80,.69],[.71,.59]],.32,[.80,.73,.50])]),
 model(185,2,'Lantern-roof coastal reading pavilion',.91,1,120,[prism('lantern-roof pavilion',[[.12,.44],[.28,.67],[.28,.87],[.38,1],[.48,.87],[.48,.67],[.63,.44]],.19,.59),prism('detached shed',[[.73,.40],[.81,.68],[.90,.40]],.73,.90,brick)]),
 model(154,0,'Triple-bay waterworks and valve house',.33,4,342,[prism('three unequal market bays',[[.12,.46],[.21,.76],[.31,.46],[.43,1],[.55,.46],[.67,.86],[.79,.46]],.14,.57,brick),polygon('detached weigh house',[[.39,.68],[.62,.68],[.71,.77],[.62,.88],[.39,.88]],.38,[.52,.70,.78])]),
];

export const COASTAL_RECREATION_KINDS: ReadonlySet<number> = new Set(MODELS.map(m => m.k));

// D082 studio and geometry harness. Actual production emitter, not duplicate art.
import { Geo } from '../../src/render/scene.ts';
import { Pen } from '../../src/render/kindArt.ts';
import { emitCoastalModel } from '../../src/render/britishCoastalRecreationArt.ts';
import { MODELS, type Model } from '../../src/content/britishCoastalRecreation.ts';
export { MODELS };
export function drawModel(m:Model,{x0=0,z0=0,y0=0,s=m.size,H=m.H,owner=1}={}){
 const G=[new Geo({ext:true}),new Geo(),new Geo()],trees:never[]=[];for(const g of G)g.owner=owner;
 const p=new Pen({W:G[0],O:G[1],D:G[2],trees,x0,z0,y0,s,H,k:m.k,v:m.v,C:{wall:"#fff",wallR:"#fff",roof:"#fff",accent:"#fff",plate:"#fff"}});
 emitCoastalModel(p,m);
 return {G,cost:2*(G[0].owners.length+G[1].owners.length)+G[2].owners.length,trees};
}

// Authored synthetic review fixture. Not a naturally played city.
import {mk} from './d034-cities.mjs';
import {BRITISH_CIVIC,BRITISH_NATIVE_KINDS} from '../src/content/britishCivic.ts';
const native=BRITISH_CIVIC.filter(b=>BRITISH_NATIVE_KINDS.has(b.k)),bonus=BRITISH_CIVIC.filter(b=>!BRITISH_NATIVE_KINDS.has(b.k));
export const D056_SITES = [...native.map((b,i)=>({...b,x:25+(i%4)*2,z:i<4?28:(b.k===87?31:32),size:b.k===87?2:1})),...bonus.map((b,i)=>({...b,x:24+i*4,z:38,size:b.k===17?1:2}))];
export const D056_CAMERA={x:28.8,z:30.8,zoom:4.0};
export function d056ReviewCode(){return mk(5162026,150,'British civic quarter · authored art review',b=>{
 b.road(23,29,35,29,2).road(23,33,35,33,2).road(23,28,23,40,2).road(35,28,35,40,2).road(23,40,35,40,2);
 for(const a of D056_SITES)b.put(a.x,a.z,a.k,1,{v:0});
 for(const x of [24,27,30,33,36]) {b.put(x,26,1,1,{v:3});b.put(x,35,2,1,{v:2});}
 b.put(21,29,5).put(38,29,4).put(38,32,4);
 },{rk:12,money:50000,df:1,tech343:{act:'',prog:{},done:[]},cms385:{act:'',st:0,acc:0,hold:0,n:0,done:[]}});}

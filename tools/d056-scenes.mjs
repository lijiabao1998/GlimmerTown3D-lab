// Authored synthetic review fixture. Not a naturally played city.
import {mk} from './d034-cities.mjs';
import {BRITISH_CIVIC} from '../src/content/britishCivic.ts';
export const D056_SITES = BRITISH_CIVIC.map((b,i)=>({...b,x:25+(i%4)*3,z:i<4?26:31}));
export const D056_CAMERA={x:30.5,z:29.5,zoom:2.4};
export function d056ReviewCode(){return mk(5162026,150,'British civic quarter · authored art review',b=>{
 b.road(23,29,37,29,2).road(23,34,37,34,2).road(23,26,23,34,2).road(37,26,37,34,2);
 for(const a of D056_SITES)b.put(a.x,a.z,a.k,1,{v:0});
 for(const x of [24,27,30,33,36]) {b.put(x,24,1,1,{v:3});b.put(x,36,2,1,{v:2});}
 b.put(21,29,5).put(38,29,4).put(38,32,4);
 },{rk:12,money:50000,df:1,tech343:{act:'',prog:{},done:[]},cms385:{act:'',st:0,acc:0,hold:0,n:0,done:[]}});}

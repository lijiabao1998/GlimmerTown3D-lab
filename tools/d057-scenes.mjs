// Synthetic authored heritage review city, not a naturally played city.
import{mk}from'./d034-cities.mjs';import{BRITISH_HERITAGE}from'../src/content/britishHeritage.ts';
export const D057_SITES=BRITISH_HERITAGE.map((b,i)=>({...b,x:25+(i%4)*4,z:i<4?28:34,size:[5,10,67,69].includes(b.k)?1:2}));
export const D057_CAMERA={x:31.8,z:31.8,zoom:3.4};
export function d057ReviewCode(){return mk(5162026,150,'British heritage · authored exterior studies',b=>{b.road(23,30,41,30,2).road(23,36,41,36,2).road(23,26,23,38,2).road(41,26,41,38,2);for(const a of D057_SITES)b.put(a.x,a.z,a.k,1,{v:0});for(const x of[26,30,34,38])b.put(x,24,1,1,{v:3});b.put(21,30,6).put(21,33,7).put(43,30,14);},{rk:12,money:50000,df:1,tech343:{act:'',prog:{},done:[]},cms385:{act:'',st:0,acc:0,hold:0,n:0,done:[]}});}

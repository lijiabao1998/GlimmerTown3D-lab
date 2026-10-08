// D055 deterministic authored review scenery, not a naturally played city.
import {mk} from './d034-cities.mjs';
export const D055_BASELINE={commit:'1955bd24e2f671b8f63416321e763b5a3fb19a2a',htmlSha256:'5ab7d9960854a7caf56a056698a1fef6fbe156c1d5f02d622f6f9abeb098509e'};
export const D055_VIEWS=[{W:360,H:740,mobile:true},{W:412,H:860,mobile:true},{W:1280,H:800,mobile:false}];
export const D055_CAMERA={x:31,z:30,zoom:1.6};
export const D055_TOOLS=['farm','ranch','bigFarm','greenhouse','foodPlant','market','tradepost'];
export const D055_SITE={x:30,z:25};
export function d055ReviewCode(){return mk(5162026,150,'從種田到外貿・固定驗收樣本',b=>{
 b.road(20,31,42,31,2).put(19,31,5).put(22,30,1).put(25,30,2).put(38,30,3).put(39,30,4);
 b.put(22,24,22,1,{v:2}).put(25,24,23,1,{v:1}).put(21,33,53,1,{v:0}).put(33,24,63,1,{v:0}).put(34,33,57,1,{v:0}).put(38,26,87,1,{v:0}).put(39,33,91,1,{v:0});
 },{rk:2,money:3000,df:1,tech343:{act:'',prog:{},done:[]},cms385:{act:'',st:0,acc:0,hold:0,n:0,done:[]}});}

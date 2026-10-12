// Authored fixed-seed review fixtures. Both pass through production read-time restyling.
import {mk} from './d034-cities.mjs';
export const D058_EXTRA={money:50000,rk:12,df:1};
export const D058_SCENES=[
 {id:'highstreet',title:'D058 authored high street',camera:{x:19,z:6.5,zoom:7.5},build(b){
  b.road(16,6,21,6).road(16,4,16,8).road(21,4,21,8);
  b.row(17,20,5,2,1,{v:2}).row(17,20,7,2,1,{v:2});
 },targets:[{path:'ukHighStreet',x:17,z:5,w:4,h:1},{path:'ukHighStreet',x:17,z:7,w:4,h:1}]},
 {id:'corner',title:'D058 authored residential corner',camera:{x:25.5,z:7.2,zoom:6},build(b){
  b.road(21,6,29,6).road(27,2,27,11);
  b.row(22,25,5,1,2,{v:2}).row(22,25,7,1,1,{v:2});
  for(let d=0;d<4;d++)b.put(28,7+d,1,1,{v:1});
 },targets:[{path:'ukVictorian',x:22,z:5,w:4,h:1},{path:'ukSemi',x:23,z:7,w:3,h:1},{path:'ukTerrace',x:28,z:7,w:1,h:4}]},
];
export const d058Code = scene => mk(5162058,150,scene.title,scene.build,D058_EXTRA);

// Native test world: ten real catalogue-tool placements plus six untouched controls.
// One-copy positions match native-browser-check.mjs; four copies stress the same budgets.
import assert from 'node:assert/strict';
import {CIVIC_MARKET_BUILDINGS as MODELS} from '../../src/content/britishCivicMarkets.ts';
import {commitOp} from '../../src/sim/edit.ts';
import {stepDay} from '../../src/sim/day.ts';
export function nativeQualificationCity(rt,{repeats=1,days=9}={}) {
 assert.ok([1,4].includes(repeats));assert.ok(Number.isInteger(days)&&days>=0);
 const n=40,raw={v:1,n,seed:20261086,day:0,money:20000,nm:'英式市集與市民街',df:1,ter:'2'.repeat(n*n),tre:'0'.repeat(n*n),bl:[[26*n+2,65,1,0,40],[25*n+13,87,1,0,40],[26*n+20,169,1,0,40],[6*n+34,179,1,1,40],[10*n+34,185,1,1,40],[18*n+34,23,1,0,40]]};
 const l=rt.loadCode(rt.encodeLabCode(raw,{deflate:true}),rt.KINDS,rt.VRANK);assert.ok(l.ok,l.error);if(repeats>1)l.sim.money=1e6;
 for(let r=0;r<repeats;r++)for(const[i,m]of MODELS.entries()){const x=3+(i%5)*6,z=repeats===1?4+Math.floor(i/5)*8:3+Math.floor(i/5)*4+r*5,result=commitOp(l.sim,{k:'tap',tool:m.tool,x0:x,z0:z,x1:x,z1:z},r*20000+i*1000);assert.ok(result.ok,m.id+' native placement '+result.reason);}
 for(let d=0;d<days;d++)stepDay(l.sim);
 return{city:l.sim.city,sim:l.sim,code:rt.saveCode(l.sim,l.template,l.start),models:MODELS,targets:l.sim.city.buildings.filter(b=>MODELS.some(m=>m.k===b.k&&m.v===b.v)),initialCode:rt.encodeLabCode(raw,{deflate:true})};
}

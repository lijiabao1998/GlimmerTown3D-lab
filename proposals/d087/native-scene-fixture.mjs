// Eleven real native paid placements, six untouched contextual controls.
// Browser uses the identical explicit input document and one-copy sites.
import assert from 'node:assert/strict';
import {WORKING_RURAL_BUILDINGS as MODELS} from '../../src/content/britishWorkingRural.ts';
import {commitOp} from '../../src/sim/edit.ts';import {stepDay} from '../../src/sim/day.ts';
export const CONTROL_BUILDINGS=[[34*40+2,65,1,0,40],[34*40+13,87,1,0,40],[34*40+20,169,1,0,40],[30*40+34,179,1,1,40],[34*40+34,185,1,1,40],[34*40+30,23,1,0,40]];
export const nativeSite=i=>[3+(i%5)*6,4+Math.floor(i/5)*8];
export const initialRaw=()=>({v:1,n:40,seed:20261087,day:0,money:30000,nm:'英式農場與生產街',df:1,ter:'2'.repeat(1600),tre:'0'.repeat(1600),bl:structuredClone(CONTROL_BUILDINGS)});
export function nativeQualificationCity(rt,{repeats=1,days=9}={}){
 assert.ok([1,4].includes(repeats));assert.ok(Number.isInteger(days)&&days>=0);const raw=initialRaw(),l=rt.loadCode(rt.encodeLabCode(raw,{deflate:true}),rt.KINDS,rt.VRANK);assert.ok(l.ok,l.error);if(repeats>1)l.sim.money=1e6;
 for(let r=0;r<repeats;r++)for(const[i,m]of MODELS.entries()){const j=r*11+i,[x,z]=repeats===1?nativeSite(i):[(j%8)*5,Math.floor(j/8)*5],result=commitOp(l.sim,{k:'tap',tool:m.tool,x0:x,z0:z,x1:x,z1:z},r*20000+i*1000);assert.ok(result.ok,m.id+' native placement '+result.reason);}
 for(let d=0;d<days;d++)stepDay(l.sim);const targets=l.sim.city.buildings.filter(b=>MODELS.some(m=>m.k===b.k&&m.v===b.v));assert.equal(targets.length,11*repeats);
 return {city:l.sim.city,sim:l.sim,code:rt.saveCode(l.sim,l.template,l.start),models:MODELS,targets,initialCode:rt.encodeLabCode(raw,{deflate:true})};
}

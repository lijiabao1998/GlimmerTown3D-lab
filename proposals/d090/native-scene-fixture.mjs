// Actual paid utility and heritage placements, including legal sewage terrain.
import assert from 'node:assert/strict';
import {UTILITY_HERITAGE_BUILDINGS as MODELS} from '../../src/content/britishUtilityHeritage.ts';
import {commitOp} from '../../src/sim/edit.ts';import {stepDay} from '../../src/sim/day.ts';
export const CONTROL_BUILDINGS=[[34*40+2,65,1,0,40],[34*40+13,87,1,0,40],[34*40+20,169,1,0,40],[30*40+34,179,1,1,40],[34*40+34,185,1,1,40],[34*40+30,23,1,0,40]];
export const nativeSite=i=>[3+(i%5)*6,4+Math.floor(i/5)*8];
export const stressSite=(i,repetition)=>[3+(i%5)*6,4+Math.floor(i/5)*4+repetition*7];
export const firstUseSite=(i,repetition)=>[2+(i%6)*6,2+Math.floor(i/6)*6+repetition*12];
function terrain(sites){const cells=Array(1600).fill('2');for(const[x,z]of sites)for(const dx of[-1,1])cells[(z-1)*40+x+dx]='0';return cells.join('');}
export function initialRaw({repeats=1}={}){assert.ok([1,4].includes(repeats));const sites=[];for(let r=0;r<repeats;r++)for(const[i,m]of MODELS.entries())if(m.baseTool==='sewage')sites.push(repeats===1?nativeSite(i):stressSite(i,r));return{v:1,n:40,seed:20261090,day:0,money:30000,nm:'英式公用設施與歷史街景',df:1,ter:terrain(sites),tre:'0'.repeat(1600),bl:structuredClone(CONTROL_BUILDINGS)};}
export function firstUseRaw(){const sites=[];for(const[i,m]of MODELS.entries())if(m.baseTool==='sewage')for(let r=0;r<3;r++)sites.push(firstUseSite(i,r));return{v:1,n:40,seed:20261090,day:0,money:80000,nm:'D090 first native placements',df:1,ter:terrain(sites),tre:'0'.repeat(1600),bl:[[2*40+36,65,1,0,40],[8*40+36,87,1,0,40],[14*40+36,169,1,0,40],[20*40+36,179,1,1,40],[26*40+36,185,1,1,40],[32*40+36,23,1,0,40]]};}
export function nativeQualificationCity(rt,{repeats=1,days=9}={}){
 assert.ok([1,4].includes(repeats));assert.ok(Number.isInteger(days)&&days>=0);const raw=initialRaw({repeats}),l=rt.loadCode(rt.encodeLabCode(raw,{deflate:true}),rt.KINDS,rt.VRANK);assert.ok(l.ok,l.error);if(repeats>1)l.sim.money=1e6;
 for(let r=0;r<repeats;r++)for(const[i,m]of MODELS.entries()){const[x,z]=repeats===1?nativeSite(i):stressSite(i,r),result=commitOp(l.sim,{k:'tap',tool:m.tool,x0:x,z0:z,x1:x,z1:z},r*20000+i*1000);assert.ok(result.ok,m.id+' native placement '+result.reason);}
 for(let d=0;d<days;d++)stepDay(l.sim);const targets=l.sim.city.buildings.filter(b=>MODELS.some(m=>m.k===b.k&&m.v===b.v));assert.equal(targets.length,10*repeats);
 return{city:l.sim.city,sim:l.sim,code:rt.saveCode(l.sim,l.template,l.start),models:MODELS,targets,initialCode:rt.encodeLabCode(raw,{deflate:true})};
}

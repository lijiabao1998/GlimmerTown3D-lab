// Actual current native operations; independently reconstructed published190 table.
import fs from 'node:fs';import assert from 'node:assert/strict';
import {KINDS} from '../src/content/kinds.ts';
import {kindTableFrom} from '../src/content/kindTable.ts';
import {withRuralHeritageKinds} from '../src/content/britishRuralHeritage.ts';
import {withCivicMarketVariants,withCivicMarketHeights} from '../src/content/britishCivicMarkets.ts';
import {withWorkingRuralVariants} from '../src/content/britishWorkingRural.ts';
import {withPublicServiceVariants,withPublicServiceHeights} from '../src/content/britishPublicServices.ts';
import {withMarketEstateVariants} from '../src/content/britishMarketEstates.ts';
import {UTILITY_HERITAGE_BUILDINGS} from '../src/content/britishUtilityHeritage.ts';
import {encodeLabCode} from '../src/io/labcode.ts';import {loadCode} from '../src/io/save.ts';
export const BASELINE='5b41bac165ba2b29146e6835490357bebc3cd549';
export const readJSON=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
export const BASE_DATA=withMarketEstateVariants(withPublicServiceVariants(withWorkingRuralVariants(withCivicMarketVariants(withRuralHeritageKinds(readJSON('src/content/lab-kinds.json'))))));
export const BASE_KINDS=withPublicServiceHeights(withCivicMarketHeights(kindTableFrom(BASE_DATA)));
export const ADDITIONS=[[10,5,1.6],[10,6,1.7],[27,3,1.05],[27,4,.65],[16,5,.9],[188,1,1.25],[190,1,.9],[192,1,1.2],[6,6,1.15],[14,7,.75]];
export function assertUtilityHeritageMetadata(table=KINDS){
 assert.deepEqual(UTILITY_HERITAGE_BUILDINGS,readJSON('proposals/d090/scope.json').models);
 const expected=structuredClone(BASE_DATA);for(const[k,v,H]of ADDITIONS){const r=expected.kinds.find(r=>r.k===k);r.hv[1]??={};r.hv[1][v]=H;r.variants[1]=Math.max(r.variants[1]??0,v+1);}
 assert.deepEqual(table.data,expected,'only independently enumerated ten hv/count entries');let oldHeights=0,newHeights=0;
 for(const r of BASE_DATA.kinds)for(const lv of[0,1,2,3,7])for(const v of[undefined,NaN,Infinity,-Infinity,-1,.5,'1','3','4','5','6','7',null,99,...Array.from({length:45},(_,i)=>i)]){const add=lv>=1?ADDITIONS.find(a=>a[0]===r.k&&a[1]===v):undefined;assert.equal(table.height(r.k,lv,v),add?add[2]:BASE_KINDS.height(r.k,lv,v),`${r.k}:${lv}:${v}`);add?newHeights++:oldHeights++;}
 return{baseline:BASELINE,models:10,oldHeights,newHeights};
}
export function checkedD090PredecessorTable(table=KINDS){assertUtilityHeritageMetadata(table);return BASE_KINDS;}
const vrank=readJSON('src/content/samples/d009-live.json').vrank;
export function emptyCode(n=16,sites=[[3,4],[10,4]]){const ter=Array(n*n).fill('2');for(const[x,z]of sites)for(const dx of[-1,1])if(x+dx>=0&&x+dx<n&&z>0&&z<n)ter[(z-1)*n+x+dx]='0';return encodeLabCode({v:1,n,seed:20261090,day:0,money:50000,nm:'D090 actual utilities and heritage',df:1,ter:ter.join(''),tre:'0'.repeat(n*n),bl:[]},{deflate:true});}
export function loaded(code=emptyCode(),kinds=KINDS){const r=loadCode(code,kinds,vrank);assert.ok(r.ok,r.error);return r;}
export const op=(tool,x=3,z=4,k='tap')=>({k,tool,x0:x,z0:z,x1:x,z1:z});
export function snapshot(s){const{rng,kinds,...rest}=s;return structuredClone(rest);}
export function normalizeVariant(value,m,v){const visited=new WeakSet();function walk(x){if(!x||typeof x!=='object'||visited.has(x)||ArrayBuffer.isView(x))return;visited.add(x);if(x.k===m.k&&x.v===m.v)x.v=v;if(x instanceof Map){for(const a of x.values())walk(a);return;}for(const[k,a]of Object.entries(x)){if((k==='a'||k==='s')&&typeof a==='string'&&a.startsWith('{')){const q=JSON.parse(a);walk(q);x[k]=JSON.stringify(q);}else walk(a);}}walk(value);return value;}
export const stateOf=s=>({w:s.w,g:s.g,budget:s.budget,rng:s.rng,resource:s.res.resource,money:s.money,diff:s.diff,tech:s.edu.tech,spec:s.edu.spec,landDirty:s.landDirty,landBox:s.landBox,txn:null,dozeArm:s.dozeArm,protect:true});

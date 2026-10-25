// D087 native test support; source is actual app modules, not a preview adapter.
import fs from'node:fs';import assert from'node:assert/strict';
import {KINDS} from'../../src/content/kinds.ts';import{kindTableFrom}from'../../src/content/kindTable.ts';import{withRuralHeritageKinds}from'../../src/content/britishRuralHeritage.ts';import{withCivicMarketVariants,withCivicMarketHeights}from'../../src/content/britishCivicMarkets.ts';
import{encodeLabCode}from'../../src/io/labcode.ts';import{loadCode}from'../../src/io/save.ts';
export const BASELINE='b4275bda73e72a9fb48343376fccaab52bbc8e84';
export const readJSON=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
export const BASE_DATA=withCivicMarketVariants(withRuralHeritageKinds(readJSON('src/content/lab-kinds.json'))),BASE_KINDS=withCivicMarketHeights(kindTableFrom(BASE_DATA));
const vrank=readJSON('src/content/samples/d009-live.json').vrank,codes=new Map();
export function emptyCode(n=16){if(!codes.has(n))codes.set(n,encodeLabCode({v:1,n,seed:20261087,day:0,money:50000,nm:'D087 actual working rural variants',df:1,ter:'2'.repeat(n*n),tre:'0'.repeat(n*n),bl:[]},{deflate:true}));return codes.get(n);}
export function loaded(code=emptyCode(),kinds=KINDS){const result=loadCode(code,kinds,vrank);assert.ok(result.ok,result.error);return result;}
export const op=(tool,x=3,z=4,k='tap')=>({k,tool,x0:x,z0:z,x1:x,z1:z});
export function snapshot(s){const{rng,kinds,...rest}=s;return structuredClone(rest);}
export function normalizeVariant(value,m,v){const visited=new WeakSet();function walk(x){if(!x||typeof x!=='object'||visited.has(x)||ArrayBuffer.isView(x))return;visited.add(x);if(x.k===m.k&&x.v===m.v)x.v=v;if(x instanceof Map){for(const val of x.values())walk(val);return;}for(const[key,val]of Object.entries(x)){if((key==='a'||key==='s')&&typeof val==='string'&&val.startsWith('{')){const decoded=JSON.parse(val);walk(decoded);x[key]=JSON.stringify(decoded);}else walk(val);}}walk(value);return value;}
export const stateOf=s=>({w:s.w,g:s.g,budget:s.budget,rng:s.rng,resource:s.res.resource,money:s.money,diff:s.diff,tech:s.edu.tech,spec:s.edu.spec,landDirty:s.landDirty,landBox:s.landBox,txn:null,dozeArm:s.dozeArm,protect:true});

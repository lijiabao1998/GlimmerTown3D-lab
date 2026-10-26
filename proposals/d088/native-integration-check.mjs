// D088 additive native metadata oracle. Baseline composition contains only the
// actual immutable D083/D086/D087 modules; it never reads new descriptor output
// to invent preserved rows, native random ranges, or baseline height defaults.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {KINDS} from '../../src/content/kinds.ts';
import {kindTableFrom} from '../../src/content/kindTable.ts';
import {withRuralHeritageKinds} from '../../src/content/britishRuralHeritage.ts';
import {withCivicMarketVariants,withCivicMarketHeights} from '../../src/content/britishCivicMarkets.ts';
import {withWorkingRuralVariants} from '../../src/content/britishWorkingRural.ts';
import {PUBLIC_SERVICE_BUILDINGS} from '../../src/content/britishPublicServices.ts';
import {encodeLabCode} from '../../src/io/labcode.ts';
import {loadCode} from '../../src/io/save.ts';
export const BASELINE='cdd541da74973dba2ca73b782936c012d315add9';
export const readJSON=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8'));
export const BASE_DATA=withWorkingRuralVariants(withCivicMarketVariants(withRuralHeritageKinds(readJSON('src/content/lab-kinds.json'))));
export const BASE_KINDS=withCivicMarketHeights(kindTableFrom(BASE_DATA));
export function assertPublicServiceMetadata(table=KINDS){
 const models=readJSON('proposals/d088/scope.json').models;
 assert.deepEqual(PUBLIC_SERVICE_BUILDINGS,models,'runtime descriptors versus pre-code scope');
 const expected=structuredClone(BASE_DATA);
 for(const m of models){const r=expected.kinds.find(r=>r.k===m.k);assert.ok(r);assert.equal(r.size,1);assert.equal(m.H,1);assert.equal(m.cap,1200);assert.ok(m.v>=(m.k===52?1:5));assert.equal(r.hv[1]?.[m.v],undefined);r.hv[1]={...r.hv[1],[m.v]:1};r.variants[1]=Math.max(r.variants[1]??0,m.v+1);}
 assert.deepEqual(table.data,expected,'only eleven declared metadata additions');
 let oldHeights=0,newHeights=0;
 for(const r of BASE_DATA.kinds)for(const lv of[0,1,2,3,7])for(const v of[undefined,NaN,Infinity,-Infinity,-1,.5,...Array.from({length:45},(_,v)=>v)]){
  const m=lv>=1?models.find(m=>m.k===r.k&&m.v===v):undefined;
  assert.equal(table.height(r.k,lv,v),m?m.H:BASE_KINDS.height(r.k,lv,v),`${r.k}:${lv}:${v}`);if(m)newHeights++;else oldHeights++;
 }
 return{baseline:BASELINE,models:models.length,oldHeights,newHeights,qualification:'native metadata only; no geometry, Chrome, acceptance or publication claim'};
}
const vrank=readJSON('src/content/samples/d009-live.json').vrank,codes=new Map();
export function emptyCode(n=16){if(!codes.has(n))codes.set(n,encodeLabCode({v:1,n,seed:20261088,day:0,money:50000,nm:'D088 actual public-service variants',df:1,ter:'2'.repeat(n*n),tre:'0'.repeat(n*n),bl:[]},{deflate:true}));return codes.get(n);}
export function loaded(code=emptyCode(),kinds=KINDS){const result=loadCode(code,kinds,vrank);assert.ok(result.ok,result.error);return result;}
export const op=(tool,x=3,z=4,k='tap')=>({k,tool,x0:x,z0:z,x1:x,z1:z});
export function snapshot(s){const{rng,kinds,...rest}=s;return structuredClone(rest);}
export function normalizeVariant(value,m,v){const visited=new WeakSet();function walk(x){if(!x||typeof x!=='object'||visited.has(x)||ArrayBuffer.isView(x))return;visited.add(x);if(x.k===m.k&&x.v===m.v)x.v=v;if(x instanceof Map){for(const val of x.values())walk(val);return;}for(const[key,val]of Object.entries(x)){if((key==='a'||key==='s')&&typeof val==='string'&&val.startsWith('{')){const decoded=JSON.parse(val);walk(decoded);x[key]=JSON.stringify(decoded);}else walk(val);}}walk(value);return value;}
export const stateOf=s=>({w:s.w,g:s.g,budget:s.budget,rng:s.rng,resource:s.res.resource,money:s.money,diff:s.diff,tech:s.edu.tech,spec:s.edu.spec,landDirty:s.landDirty,landBox:s.landBox,txn:null,dozeArm:s.dozeArm,protect:true});
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(assertPublicServiceMetadata()));

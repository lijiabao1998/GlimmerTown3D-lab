// Inherit the existing parcel/height envelope unchanged; report actual first reds.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {RURAL_HERITAGE_BUILDINGS as MODELS} from '../../src/content/britishRuralHeritage.ts';
import {Geo} from '../../src/render/scene.ts';
import {drawKind} from '../../src/render/kindArt.ts';
import {shapeOf} from '../../src/content/kindShapes.ts';
import {createDesign} from './models.mjs';
const out=path.resolve('scratch/d083-native-evidence');fs.mkdirSync(out,{recursive:true});
const rows=[];for(const m of MODELS){const W=new Geo({ext:true}),O=new Geo(),D=new Geo();W.owner=O.owner=D.owner=71;
 drawKind({W,O,D,trees:[],x0:0,z0:0,y0:0,s:m.size,H:m.H,k:m.k,v:0,C:{}},shapeOf(m.k,...Array(18).fill(true)));
 const prototype=createDesign(m.id),axes=[0,1,2].map(k=>O.pos.filter((_,i)=>i%3===k)),min=axes.map(a=>Math.min(...a)),max=axes.map(a=>Math.max(...a)),violations=[];
 assert.equal(O.owners.length,prototype.triangles.length);assert.ok(O.pos.every(Number.isFinite));
 for(let t=0;t<O.owners.length;t++){const p=O.pos.slice(t*9,t*9+9);if(Array.from({length:3},(_,i)=>p.slice(i*3,i*3+3)).some(([x,y,z])=>x< -1e-9||x>m.size+1e-9||z< -1e-9||z>m.size+1e-9||y< -1e-9||y>m.H+1e-9))violations.push({triangle:t,part:prototype.triangles[t].part,points:Array.from({length:3},(_,i)=>p.slice(i*3,i*3+3))});}
 rows.push({k:m.k,id:m.id,size:m.size,H:m.H,min,max,triangles:O.owners.length,weighted:2*O.owners.length,passed:violations.length===0,violatingTriangles:violations.length,parts:[...new Set(violations.map(t=>t.part))],violations});
}
const report={qualification:'Mandatory inherited geometric envelope, using the same 1e-9 bounds precision as the existing D082 checker. No point deleted, clamped, optional or reclassified. Independent of focused UI/save/picking pass.',passed:rows.every(r=>r.passed),models:rows,logicalTriangles:rows.reduce((n,r)=>n+r.triangles,0),weightedTriangles:rows.reduce((n,r)=>n+r.weighted,0),budgetQualification:'Counts only; no new accepted per-kind/scene allowance and no historical budget changed.'};
fs.writeFileSync(path.join(out,'native-envelope-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,models:rows.map(({violations,...r})=>r)},null,2));if(!report.passed)process.exitCode=1;

import test from'node:test';import assert from'node:assert/strict';import path from'node:path';import{pathToFileURL}from'node:url';import{STRUCTURAL_PLAN_V7}from'./structural-plan-v7.mjs';import{GUILD_ACCESS_DIMENSIONS,assertGuildCirculationDimensions,assertGuildAccessV7}from'./guild-access-v7.mjs';
const {createCivicMarketDesign}=await import(process.env.D086_STRUCTURAL_SOURCE?pathToFileURL(path.resolve(process.env.D086_STRUCTURAL_SOURCE)).href:'../../src/render/britishCivicMarketModels.mjs');
test('actual closed geometry supports continuous gallery, eight treads and both real doors',()=>{const r=assertGuildAccessV7(createCivicMarketDesign('raised-guild-market'));assert.equal(r.circulation.treads,8);assert.ok(r.circulation.stoneShoulders.every(x=>x>0));});
for(const[name,mutate]of[
 ['old narrow ledge',p=>p.solids.find(s=>s.name==='jetty-floor-beam').footprint[5][1]=.765],
 ['unsupported gallery wing',p=>p.solids.find(s=>s.name==='upper-stair-landing').a[5]=.34],
 ['missing lower bearing',p=>p.solids.find(s=>s.name==='upper-stair-landing').a[4]=.1],
 ['stair width reduction',p=>p.solids.find(s=>s.type==='steppedFlight').x1=.95],
 ['one missing tread',p=>p.solids.find(s=>s.type==='steppedFlight').count=7],
 ['large final rise',p=>p.solids.find(s=>s.type==='steppedFlight').total=.30],
 ['flight butt joint',p=>p.solids.find(s=>s.type==='steppedFlight').lap=0],
 ['top coplanar joint',p=>p.solids.find(s=>s.name==='upper-stair-landing').a[5]=.36],
 ['right coplanar joint',p=>p.solids.find(s=>s.name==='upper-stair-landing').a[1]=.98],
 ['arrival coplanar joint',p=>p.solids.find(s=>s.name==='upper-stair-landing').a[2]=.75],
 ['front coplanar joint',p=>p.solids.find(s=>s.name==='upper-stair-landing').a[3]=.91],
 ['bury retained side glazing',p=>p.solids.find(s=>s.name==='upper-stair-landing').a[2]=.60]
])test('circulation proof rejects '+name,()=>{const p=structuredClone(STRUCTURAL_PLAN_V7['raised-guild-market']);mutate(p);assert.throws(()=>assertGuildCirculationDimensions(p));});
test('full corridor proof rejects narrow width or an upright crossing route',()=>{for(const corridor of [[.425,.975,.80,.90],[.425,.975,.76,.90]])assert.throws(()=>assertGuildCirculationDimensions(undefined,{...GUILD_ACCESS_DIMENSIONS,corridor}));});
test('actual triangles cannot be deleted or moved while keeping descriptive route metadata',()=>{for(const mutation of [m=>m.triangles.splice(m.parts.find(p=>p.name==='outside-stair-flight').start,1),m=>{const i=m.parts.findIndex(p=>p.name==='jetty-floor-beam');for(const t of m.triangles.slice(m.parts[i].start,m.parts[i+1].start))for(const v of t.p)v[1]+=.01;}]){const m=createCivicMarketDesign('raised-guild-market');mutation(m);assert.throws(()=>assertGuildAccessV7(m));}});
import fs from'node:fs';import{createHash}from'node:crypto';
test('finite guild-only source edits reconstruct every authoritative byte without touching other nine builders',()=>{const d=JSON.parse(fs.readFileSync('proposals/d086/original-player-guild-gallery-deltas-v7.json')),sha=s=>createHash('sha256').update(s).digest('hex');let s=fs.readFileSync('proposals/d086/original-player-stepped-final-repair-procedural-authority.mjs','utf8');assert.equal(sha(s),d.previousSourceSha256);assert.equal(d.edits.length,2);for(const e of d.edits){assert.equal(s.split(e.before).length,2);s=s.replace(e.before,e.after);}assert.equal(s,fs.readFileSync('proposals/d086/original-player-guild-gallery-procedural-authority.mjs','utf8'));assert.equal(sha(s),'f4850b85d4ff9751ba3c600db43cc4b26c58bb9efbff04efa4be53c02d579f25');assert.equal(sha(s),d.sourceSha256);});

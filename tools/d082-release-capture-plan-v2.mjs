// Exact planner used by the real accepted-nine capture: five standard views,
// all existing legal supplementary angles, retained old-coordinate obligations.
// No PNG receipt or browser success is inferred from this Node calculation.
import fs from 'node:fs';import{gzipSync}from'node:zlib';import assert from'node:assert/strict';import{pathToFileURL}from'node:url';
import{TARGETS,VIEWPORTS,VIEWS,createOracle,pairedCamera,sha}from'./d082-redesign-support.mjs';
import{planSupplementaryViews}from'./d082-redesign-views.mjs';
export function d082ReleaseCapturePlanV2({slots,widths=[1440,412,360],out='scratch/d082-release-capture-plan-v2',log=()=>{}}={}){
fs.mkdirSync(out,{recursive:true});const sourcePins=Object.fromEntries(['src/render/britishCoastalRecreationArt.ts','src/render/d082RemainingGeometryData.ts'].map(f=>[f,sha(fs.readFileSync(f))]));const rows=[];
for(const t of TARGETS.filter(t=>!slots||slots.includes(t.k+':'+t.v)))for(const vp of VIEWPORTS.filter(v=>widths.includes(v.W))){const a=createOracle('gallery',false,t.v),b=createOracle('gallery',true,t.v);try{const o=b.city.buildings.find(o=>o.k===t.k&&o.v===t.v),shot={...t,owner:o.id,x:o.x+o.size/2,z:o.z+o.size/2,size:o.size},standard=[{id:'context',spin:0,tilt:0},...VIEWS].map(view=>({...shot,view,camera:pairedCamera(a,b,{...shot,zoom:view.id==='context'?4:8},vp,view)}));const r=planSupplementaryViews(a,b,shot,vp,standard);fs.writeFileSync(`${out}/plan-${t.k}-v${t.v}-${vp.W}.json.gz`,gzipSync(JSON.stringify({sourcePins,...r})));rows.push(r.plan);log(r.plan.passed,`D082 ${t.k}:${t.v} exact capture plan ${vp.W}`,r.plan);fs.writeFileSync(out+'/report.json',JSON.stringify({complete:false,sourcePins,rows},null,2));}finally{a.dispose();b.dispose();}}
for(const[f,pin]of Object.entries(sourcePins))assert.equal(sha(fs.readFileSync(f)),pin,'source remains unchanged during complete capture plan');
const report={complete:true,passed:rows.every(r=>r.passed),qualification:'Exact capture plan only; actual paired Chromium PNGs still mandatory.',sourcePins,rows};fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const r=d082ReleaseCapturePlanV2({slots:process.env.D082_PLAN_SLOTS?.split(','),widths:(process.env.D082_PLAN_WIDTHS??'1440,412,360').split(',').map(Number),out:process.env.D082_PLAN_OUT??'scratch/d082-release-capture-plan-v2',log:(_ok,_name,row)=>console.log(JSON.stringify(row))});process.exitCode=r.passed?0:1;}

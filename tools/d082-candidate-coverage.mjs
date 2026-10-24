// D081 read-only OLD feasibility against the complete published D081 renderer.
// Only diagnostic scripts/evidence under scratch/d081 may be written.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL,fileURLToPath} from 'node:url';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {D082_KT as D081_KT,d082City as d081City,d082Blocks as d081Blocks,d082Civic as d081Civic} from './unit-d082.mjs';
import {buildCityScene} from '../src/render/cityScene.ts';
import {STYLES} from '../src/render/styles.ts';
import {ConState} from '../src/render/construction.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {d081OwnerSurfaceContract,d081OwnerSurfaceRayAudit,assertD081SurfaceCoverage,d081OwnerBounds,assertD081OwnerFits,fitD081PairedOwnerView,d081ConstructionDiagnostic,d081OwnerConstruction,d081DetailAlpha} from './d081-frame.mjs';

export function runD082CandidateCoverage(options={}){
const write=options.write===true;
const ROOT=new URL('../',import.meta.url),OUT=new URL('../scratch/d082-candidate-coverage/',import.meta.url);
if(write)fs.mkdirSync(OUT,{recursive:true});
const baselineBytes=fs.readFileSync(new URL('../fixtures/d082-baseline-feasibility.json',import.meta.url));
assert.equal(createHash('sha256').update(baselineBytes).digest('hex'),'ea3d6c5c0570f0694b892918b85b0fdc2b2cc4ae12154e8c5994cd0b76e88fd8','immutable complete baseline feasibility archive');
const BASE=JSON.parse(baselineBytes);
const EVIDENCE=new URL('../docs/evidence/D082-baseline-qualification/',import.meta.url);
const baseline='2cd43c424dcc909dcfa6ac55275406d2bc527ce0';
const sha=b=>createHash('sha256').update(b).digest('hex');
const jsonSha=o=>sha(JSON.stringify(o));
const slots=s=>s.split(',').map(v=>v.split(':').map(Number));
const pool=options.pool??BASE.pool,selectedSlots=options.slots??pool;
assert.equal(new Set(pool.map(s=>s.join(':'))).size,pool.length);
assert.ok(selectedSlots.every(s=>pool.some(p=>p[0]===s[0]&&p[1]===s[1])));
const reportName=options.reportName??'unit';
assert.match(reportName,/^[a-z0-9-]+$/);
const outputName=reportName+'.json';
if(write)assert.ok(!fs.existsSync(new URL(outputName,OUT)),'never overwrite prior evidence');
assert.deepEqual(pool,BASE.pool,'exact frozen joint pool');
const candidateFiles=fs.readdirSync(new URL('src/',ROOT),{recursive:true,withFileTypes:true}).filter(e=>e.isFile()).map(e=>path.relative(fileURLToPath(ROOT),path.join(e.parentPath,e.name)).split(path.sep).join('/')).sort();
const inventory={files:Object.fromEntries(candidateFiles.map(file=>[file,{sha256:sha(fs.readFileSync(new URL(file,ROOT)))}]))};
function verifySources(){for(const [file,pin]of Object.entries(inventory.files))assert.equal(sha(fs.readFileSync(new URL(file,ROOT))),pin.sha256,'candidate source bytes remain frozen: '+file);}
verifySources();
assert.equal(sha(fs.readFileSync(new URL('tools/d081-frame.mjs',ROOT))),BASE.classifierSha256,'unchanged frozen surface classifier');
function archived(k,v,owner,width){const cohort=[179,185].includes(k)?'coastal-halls':'play-water',name='final-pool-'+cohort+'-gallery-k'+k+'-v'+v+'-owner'+owner+'-'+width+'.json.gz';const bytes=fs.readFileSync(new URL(name,EVIDENCE));assert.equal(sha(bytes),BASE.evidenceFiles[name].sha256,'exact archived width evidence');return JSON.parse(gunzipSync(bytes));}
const viewports=[{W:1440,H:1000},{W:360,H:740},{W:412,H:860}];
const legalAngles=[];
for(const elevation of [Math.PI*.08,Math.PI/6,Math.PI*.32])for(let yaw=0;yaw<8;yaw++)legalAngles.push({yaw:yaw*Math.PI/4,elevation});
assert.equal(legalAngles.length,24);
function camera(n,b,vp,{yaw=0,elevation=Math.PI/6}={}){
 const D=n*1.6,x=b.x+b.size/2,z=b.z+b.size/2,c=Math.cos(yaw),s=Math.sin(yaw),radius=D*Math.sqrt(2+2*Math.tan(Math.PI/6)**2),h=radius*Math.cos(elevation)/Math.SQRT2;
 const target=[x,0,z],zoom=Math.max(.6,Math.min(8,.70*.84*n*(vp.W/vp.H)/(b.size*Math.SQRT2)));
 assert.ok(elevation>=Math.PI*.08-1e-12&&elevation<=Math.PI*.32+1e-12);
 return elevation===Math.PI/6?{pos:[x+D*(c-s),D*Math.SQRT2*Math.tan(Math.PI/6),z+D*(s+c)],target,zoom}:{pos:[x+h*(c-s),radius*Math.sin(elevation),z+h*(s+c)],target,zoom};
}
function fixture(sample,v,on=true){
 const source=d081City(sample),sourceWorldSha256=jsonSha(source),city={...source,buildings:source.buildings.map(b=>pool.some(([k,u])=>k===b.k&&u===v)?{...b,v}:b)};
 const con=new ConState(city.n),built=buildCityScene(city,D081_KT,STYLES.A,d081Blocks(city),'d',d081Civic(on),con,true);
 if(built.con)con.setGeometry(built.con.top,built.con.base,built.con.wallTop);
 con.setCity(city,k=>D081_KT.cat(k));built.setTreeAges(i=>con.siteAge(i));con.uni.uDayFrac.value=0;con.uni.uTime.value=2.2;
 assert.equal(jsonSha(source),sourceWorldSha256,'original world never changed');
 return {city,n:city.n,scene:built.scene,meshes:built.buildingMeshes(),owners:built.pickOwners(),digest:sceneDigest(built),construction:d081ConstructionDiagnostic(built.scene,con),worldSha256:jsonSha(city),sourceWorldSha256,built,con,dispose(){built.dispose();con.dispose();}};
}
function writeFresh(file,value){if(!write)return;assert.ok(!fs.existsSync(new URL(file,OUT)),'never overwrite evidence '+file);fs.writeFileSync(new URL(file,OUT),JSON.stringify(value,null,2));}
function save(){if(!write)return;fs.writeFileSync(new URL(outputName,OUT),JSON.stringify(report,null,2));}
const report={baseline,candidateSourceInventory:inventory.files,pool,slots:selectedSlots,viewports,legalAngles,sourceFilesVerified:Object.keys(inventory.files).length,classifierSha256:sha(fs.readFileSync(new URL('tools/d081-frame.mjs',ROOT))),qualification:'CANDIDATE paired coverage with all130 prior models enabled. Archived baseline fixed records and original silhouettes verified exactly and covered separately. Candidate-only source inventory frozen before/after. Node-only, not WebGL acceptance. Exactly24 predetermined legal angles and exact original production camera. Four points of every triangle and every original silhouette record retained. Full owner, neighbors and ordered trees remain. Stop a candidate after a decisive impossible width; untouched widths/owners/variants remain untested.',ownerInventory:Object.fromEntries(['gallery','seed516','ai120'].map(sample=>[sample,d081City(sample).buildings.filter(b=>pool.some(([k])=>k===b.k)&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=d081City(sample).n&&b.z+b.size<=d081City(sample).n)])),cases:[],pass:false};
let failed=0;
for(const [k,v]of selectedSlots){
 let slotFailed=false;
 for(const sample of ['gallery','seed516','ai120']){
  if(slotFailed)break;
  const src=d081City(sample),targets=src.buildings.filter(b=>b.k===k&&b.goneDay===undefined&&b.x>=0&&b.z>=0&&b.x+b.size<=src.n&&b.z+b.size<=src.n);
  for(const target of targets){
   const old=fixture(sample,v,false),f=fixture(sample,v,true),b=f.city.buildings.find(b=>b.id===target.id),key=`${sample}-k${k}-v${v}-owner${b.id}`;
   const baselineCase=BASE.cases.find(c=>c.k===k&&c.v===v&&c.owner===b.id);assert.ok(baselineCase,'frozen baseline owner');assert.deepEqual(old.digest,baselineCase.sceneDigest,'entire legacy scene and neighbors unchanged');assert.deepEqual(old.construction,baselineCase.construction,'all old ordered trees and construction unchanged');assert.equal(old.worldSha256,baselineCase.worldSha256,'unchanged exact copied baseline world');
   const row={key,k,v,sample,owner:b.id,site:b,tableHeight:D081_KT.height(k,b.lv,v),renderHeight:Math.max(.12,D081_KT.height(k,b.lv,v)),sourceWorldSha256:f.sourceWorldSha256,worldSha256:f.worldSha256,sceneDigest:f.digest,construction:f.construction,ownerConstruction:d081OwnerConstruction(f.city,f.con,b.id),viewports:[],selected:[],negativeControls:[],pass:false};
   console.log(new Date().toISOString(),'START',key);
   const states=[];
   try{
    for(const vp of viewports){
     const archivedEvidence=archived(k,v,b.id,vp.W),oldContract=d081OwnerSurfaceContract(old,archivedEvidence.original.view,vp,b.id);assert.deepEqual(oldContract,d081OwnerSurfaceContract(old,archivedEvidence.original.view,vp,b.id,{testOnlyRawSilhouetteRays:true}),'baseline current rawThree exact parity');assert.equal(JSON.stringify(oldContract),JSON.stringify(archivedEvidence.contract),'all archived JSON fixed samples and silhouette hits remain exact, including declared serialization');const oldViews=[archivedEvidence.original.view,...archivedEvidence.selected.map(a=>a.view)];const archivedCoverage=assertD081SurfaceCoverage(oldViews.map(view=>d081OwnerSurfaceRayAudit(old,view,vp,oldContract)),oldContract,'every archived baseline point remains covered');
     const original=camera(f.n,b,vp);assert.deepEqual(original,archivedEvidence.original.view,'exact original production camera retained');const bounds=d081OwnerBounds(f,original,vp,b.id),contract=d081OwnerSurfaceContract(f,original,vp,b.id),rawContract=d081OwnerSurfaceContract(f,original,vp,b.id,{testOnlyRawSilhouetteRays:true});
     assert.deepEqual(contract,rawContract,'complete ordered rawThree contract equality');
     assert.equal(contract.probes.length,contract.triangleCount*4+contract.originalHits);
     const originalAudit=bounds.fitsViewport?d081OwnerSurfaceRayAudit(f,original,vp,contract):null;
     const originalVisible=new Set(originalAudit?.visibleSamples??[]),remainingProbes=contract.probes.filter(p=>p.required&&!originalVisible.has(p.id));
     const audits=[];
     for(const [i,descriptor]of legalAngles.entries()){
      const base=camera(f.n,b,vp,descriptor),fit=fitD081PairedOwnerView([old,f],base,vp,b.id);
      assertD081OwnerFits(d081OwnerBounds(f,fit.view,vp,b.id));
      const audit=d081OwnerSurfaceRayAudit(f,fit.view,vp,{...contract,probes:remainingProbes});
      audits.push({i,descriptor,view:fit.view,bounds:fit.bounds[0],audit});
     }
     const union=new Set([...(originalAudit?.visibleSamples??[]),...audits.flatMap(a=>a.audit.visibleSamples)]),missing=contract.requiredSamples.filter(id=>!union.has(id));
     const state={vp,original,bounds,contract,rawContract,originalAudit,audits,missing,archivedCoverage,oldContract,oldViews};states.push(state);
     console.log(new Date().toISOString(),'WIDTH',key,vp.W,'required',contract.requiredSamples.length,'covered',union.size,'originalFits',bounds.fitsViewport,'rawThree',true);
     if(missing.length||!bounds.fitsViewport){
      row.decisiveFailure={width:vp.W,reason:!bounds.fitsViewport?'Exact original production camera does not fit full owner':'Complete mandatory contract cannot be covered by original plus fixed24 legal angles',missing:missing.map(id=>({probe:contract.probes.find(p=>p.id===id),observations:[{view:'original',sample:originalAudit?.samples.find(p=>p.id===id)??null},...audits.map(a=>({view:a.i,descriptor:a.descriptor,sample:a.audit.samples.find(p=>p.id===id)}))]})),untestedWidths:viewports.slice(states.length).map(v=>v.W)};
      slotFailed=true;failed++;break;
     }
    }
    if(!slotFailed){
     const needed=new Set(states.flatMap(c=>c.contract.requiredSamples.map(id=>c.vp.W+':'+id))),covered=new Set(states.flatMap(c=>(c.originalAudit?.visibleSamples??[]).map(id=>c.vp.W+':'+id))),remaining=[...legalAngles.keys()],selected=[];
     while(covered.size<needed.size){let best=-1,gain=0;for(const i of remaining){const add=new Set(states.flatMap(c=>c.audits[i].audit.visibleSamples.map(id=>c.vp.W+':'+id)).filter(id=>!covered.has(id)));if(add.size>gain){best=i;gain=add.size;}}assert.ok(best>=0,'complete legal-angle union already proved');selected.push(best);remaining.splice(remaining.indexOf(best),1);for(const c of states)for(const id of c.audits[best].audit.visibleSamples)covered.add(c.vp.W+':'+id);row.selected.push({index:best,...legalAngles[best],gain});}
     for(const c of states){c.selected=selected.map(i=>({...c.audits[i],audit:d081OwnerSurfaceRayAudit(f,c.audits[i].view,c.vp,c.contract)}));c.coverage=assertD081SurfaceCoverage([c.originalAudit,...c.selected.map(a=>a.audit)],c.contract);}
     for(const c of states)for(const phase of [{name:'candidate',fixture:f,contract:c.contract,views:[c.original,...c.selected.map(a=>a.view)]},{name:'baseline',fixture:old,contract:c.oldContract,views:c.oldViews}])for(const[name,predicate]of [['wall',p=>Math.abs(p.normal[1])<.1],['roof',p=>p.normal[1]>.1]])for(const mode of ['missing','reversed']){
      const probe=phase.contract.probes.find(p=>p.required&&p.source==='fixed-triangle'&&predicate(p));assert.ok(probe,'mandatory '+name);const mesh=phase.fixture.meshes[probe.mesh],original=mesh.geometry,changed=original.clone(),a=changed.attributes.position.array,t=probe.triangle*9;
      try{if(mode==='missing')for(let j=0;j<9;j++)a[t+j]=a[t+j%3];else for(let j=0;j<3;j++)[a[t+3+j],a[t+6+j]]=[a[t+6+j],a[t+3+j]];mesh.geometry=changed;const audits=phase.views.map(view=>d081OwnerSurfaceRayAudit(phase.fixture,view,c.vp,phase.contract));assert.throws(()=>assertD081SurfaceCoverage(audits,phase.contract),/every fixed exterior point/);row.negativeControls.push({phase:phase.name,width:c.vp.W,name,mode,rejected:true,probe:probe.id});}finally{mesh.geometry=original;changed.dispose();}
     }
     row.pass=true;
    }
    for(const c of states){
     const views=[c.original,...(c.selected??[]).map(a=>a.view)],cameraRows=views.map(view=>{const labZoom=Math.SQRT2*c.vp.H*view.zoom/(f.n*.84)/64;return{view,labZoom,uDetail:d081DetailAlpha(labZoom)};});
     row.viewports.push({width:c.vp.W,bounds:c.bounds,contractSha256:c.contract.sha256,sourceGeometrySha256:c.contract.sourceGeometrySha256,rawThreeExact:true,triangles:c.contract.triangleCount,fixed:c.contract.fixedTriangleSamples,required:c.contract.requiredSamples.length,covered:c.contract.requiredSamples.length-c.missing.length,retained:c.contract.probes.length,originalHits:c.contract.originalHits,originalBlockedHits:c.contract.originalBlockedHits,coverage:c.coverage??null,missing:c.missing,cameraRows,archivedCoverage:c.archivedCoverage});
     writeFresh(`${reportName}-${key}-${c.vp.W}.json`,{contract:c.contract,rawContract:c.rawContract,original:{view:c.original,bounds:c.bounds,audit:c.originalAudit},selected:c.selected??[],discoveryOnlyRemainingRequiredPoints:c.audits,missing:c.missing,coverage:c.coverage??null,cameraRows});
    }
    assert.deepEqual(sceneDigest(old.built),old.digest,'entire baseline scene restored after controls');assert.deepEqual(sceneDigest(f.built),f.digest,'exact complete original scene digest retained after controls');
    assert.deepEqual(d081ConstructionDiagnostic(f.built.scene,f.con),f.construction,'complete ordered trees and construction remain unchanged');
    assert.equal(jsonSha(f.city),f.worldSha256,'copied world remains unchanged');
   }catch(error){if(!slotFailed)failed++;slotFailed=true;row.error=error.stack;console.error('ERROR',key,error.stack);}
   finally{old.dispose();f.dispose();report.cases.push(row);save();}
   console.log(new Date().toISOString(),'RESULT',JSON.stringify({key,pass:row.pass,counts:row.viewports.map(c=>[c.width,c.covered,c.required]),selected:row.selected,negativeControls:row.negativeControls.length,decisiveFailure:row.decisiveFailure?{width:row.decisiveFailure.width,missing:row.decisiveFailure.missing.length,untestedWidths:row.decisiveFailure.untestedWidths}:null}));
   if(slotFailed)break;
  }
 }
}
verifySources();
report.pass=failed===0;
report.totals={ownerCases:report.cases.length,ownerWidthCases:report.cases.reduce((n,c)=>n+c.viewports.length,0),rawThreeExactCases:report.cases.flatMap(c=>c.viewports).filter(v=>v.rawThreeExact).length,required:report.cases.flatMap(c=>c.viewports).reduce((n,v)=>n+v.required,0),covered:report.cases.flatMap(c=>c.viewports).reduce((n,v)=>n+v.covered,0),negativeControls:report.cases.reduce((n,c)=>n+c.negativeControls.length,0)};
save();console.log('COMPLETE',report.pass,JSON.stringify(report.totals));return report;
}
export async function d082FrameGuards(log=()=>{}){let report;try{report=runD082CandidateCoverage();assert.equal(report.pass,true,'all thirty paired baseline/candidate coverage cases pass');assert.equal(report.totals.ownerWidthCases,30);assert.equal(report.totals.negativeControls,240);log(true,'D082 paired complete coverage, rawThree parity and missing/reversed wall/roof controls',report.totals);return {failed:0,report};}catch(error){log(false,'D082 paired complete coverage',error.stack);return {failed:1,report:report??{error:error.stack}};}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const parse=s=>s.split(',').map(x=>x.split(':').map(Number));assert.ok(process.env.REPORT,'CLI requires fresh REPORT');const report=runD082CandidateCoverage({write:true,reportName:process.env.REPORT,...(process.env.POOL?{pool:parse(process.env.POOL)}:{}),...(process.env.SLOTS?{slots:parse(process.env.SLOTS)}:{})});process.exitCode=report.pass?0:1;}

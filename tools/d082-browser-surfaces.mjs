// D082 real-browser surface bridge: frozen evidence, exact full fixture identity,
// unchanged D081 classifier, and complete audits using observed browser cameras.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {buildCityScene} from '../src/render/cityScene.ts';
import {ConState} from '../src/render/construction.ts';
import {Preview} from '../src/render/preview.ts';
import {HazardMarks} from '../src/render/hazard.ts';
import {landLevelOf} from '../src/render/landArt.ts';
import {seasonOptionOf} from '../src/render/seasonArt.ts';
import {STYLES} from '../src/render/styles.ts';
import {sceneDigest} from '../src/render/digest.ts';
import {D082_KT,D082_SLOTS,d082City,d082CoastalCity,d082Blocks,d082Civic} from './unit-d082.mjs';
import {d081OwnerSurfaceContract,d081OwnerSurfaceRayAudit,assertD081SurfaceCoverage,d081OwnerBounds,assertD081OwnerFits,d081ConstructionDiagnostic,d081OwnerConstruction} from './d081-frame.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),jsonSha=o=>sha(JSON.stringify(o));
export const D082_BROWSER_SURFACE_EVIDENCE={
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k126-v0-owner168-360.json.gz": "b1309b7f27daf36fa63780541c286d5dccca55fc00ce79b095e02ce97037aad5",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k126-v0-owner168-360.json.gz": "9151963c92e74af03988abda1203e86a36c554afbe8577baa7144d07d91013f6",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k126-v0-owner168-412.json.gz": "f2a6354706571c869be0cf46b0f75c07b22164fd9fafdd28e38d833f8a62fa55",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k126-v0-owner168-412.json.gz": "0bcd9ac2247f279ec046a16a9e81afe42147ef837a1b3f9761dc68313e8c13cc",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k126-v0-owner168-1440.json.gz": "d2e997b2b3cb747bf3f5201d0123ead74df45192aa8e7cf97c7ee23d84250272",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k126-v0-owner168-1440.json.gz": "b6088c1d3356e712057c5e604f6e1822baba734c6bac58bddfe81f3da604c708",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k126-v1-owner168-360.json.gz": "7ebf9658f3f869ccb583dc171eafee0c1bc6a9cf2d2848c9821b04223e6ecd6f",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k126-v1-owner168-360.json.gz": "cd2a5bb0f8a3a698ba6834dcca4a351126e390b7363be883806174ac45c4e8f4",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k126-v1-owner168-412.json.gz": "f7cd7105216da8601619806f7d7ad01d5a20ab72d38a1a23c815219bbb3f7629",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k126-v1-owner168-412.json.gz": "b93dde05de0a883d72156a90adc2575d04100b00c4d65d3b532c2742e6d7baf0",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k126-v1-owner168-1440.json.gz": "60b8c0d83ada4b4b1b619a5a843b9bef5ec29442f310fa59c173c6fad05f06e3",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k126-v1-owner168-1440.json.gz": "7795eb1804dbb9ac4c719dc16607903202e183a3669dd6c29be53683b4059d25",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k126-v2-owner168-360.json.gz": "2ef40fb213087bbf91abc7390f967a17ac9fffe0aa2c5a46da8d00294b580de4",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k126-v2-owner168-360.json.gz": "7f35899fd6793067b5fb68a5057dfd0ff255896ba60c2ccbfd027750f0da06e9",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k126-v2-owner168-412.json.gz": "cf778e694eb79b4e12f61815ae0816b343bd070b0abdbf64f22c20cac5724e56",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k126-v2-owner168-412.json.gz": "8a2f473a795dd97b3107d7add903c17c831ff7a38818717c933593083240a3e4",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k126-v2-owner168-1440.json.gz": "6cd382ac8b14e9127e77657d00700e72cf2a9f519ba32e9324c283e9f2cea825",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k126-v2-owner168-1440.json.gz": "17c108c2cb63b90d4f9e93ad42a1c2cf6d52ed0931ff1651bc5dc89453f8aa81",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k154-v0-owner94-360.json.gz": "4418e75a44904654422523fe90db962db41519b503d4128efd9233c7cc6bc071",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k154-v0-owner94-360.json.gz": "c297d536fb76ecf9139f1e7f3c162f80263cafc4d31dcec3222171bd0d55e62b",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k154-v0-owner94-412.json.gz": "9af8aa712cf43ab0d43232b5a45a7d64fbcb3f1ed2d345361a1929ad486379c1",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k154-v0-owner94-412.json.gz": "3a788a3e8dedf82319a11a6d28cebfad6e02ad28defe8402442ea24a5edbc80b",
 "docs/evidence/D082-baseline-qualification/final-pool-play-water-gallery-k154-v0-owner94-1440.json.gz": "e01669f0dd3698f05f6ec82fdc9e53e6a1c0aaf73beac84828b358cd8ca6ac9c",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3-gallery-k154-v0-owner94-1440.json.gz": "da16e118bcf8fcfd9c524fa706199982c155d6770ecb378317406dea3785343b",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k179-v0-owner154-360.json.gz": "dd031715a99255906db370c05b08d914b08282d34d2aebe32d822cacb3880229",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3-gallery-k179-v0-owner154-360.json.gz": "8841bee7c378b493e3d81e10efda91f7a3575ef226c6316b886900c39acb3647",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k179-v0-owner154-412.json.gz": "0d6f05c39f554cedd70dbc34b67c8b98af861a4a9d4034751769223a0531368f",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3-gallery-k179-v0-owner154-412.json.gz": "656aed736d2501bb0236e1c0895c17b05dae305228b0486fa3b87487636454b3",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k179-v0-owner154-1440.json.gz": "86eb2a39dd3060f5161363ac17507f0a66f39fd9d404d1c0a9b0de474ca3425d",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3-gallery-k179-v0-owner154-1440.json.gz": "beb1fdec60fc74beaead060729cd73b74f4eba8e06a6b5f188066addaa298eb9",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k179-v1-owner154-360.json.gz": "c3142686d5c48d9ec61440214e9adefb867442fc4de7e37d2266c1b58a22ef42",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3-gallery-k179-v1-owner154-360.json.gz": "2dbd53e3014b1d20eec761b12e9365262d3308b64584d550fbecf97b824b7ad6",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k179-v1-owner154-412.json.gz": "849dadca5780af79eaf78c31d2454b5b216d331a25eac634d3a61d97aa3a0cbf",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3-gallery-k179-v1-owner154-412.json.gz": "eb4472e68eecef93d00638391d7324c261af97e497a1133244768683996c4357",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k179-v1-owner154-1440.json.gz": "7359ed58c72342c6f04d16c3dce89d4a0c7c1b6140cb48463dc8315449a54582",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3-gallery-k179-v1-owner154-1440.json.gz": "6bb64b641ffb0027954beed893d11a9ada9bd31b8ffb69e19b3d8493af5b0a8c",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k179-v2-owner154-360.json.gz": "d8e83c3f794f094d94260e969968dfbc000566cfdc27c1819e6d8d12a1a63a2e",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3-gallery-k179-v2-owner154-360.json.gz": "bbcd6ddef63caae652b9d5cb56928ffe49796f8721e56b8333929c243ff7174e",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k179-v2-owner154-412.json.gz": "468f14072c4ac848df539b15e136fc69ede71e69df83919bc7a22f5a6a6561d3",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3-gallery-k179-v2-owner154-412.json.gz": "d76614a3d0b0fc787448a8f8e165ff43790b781ca5bdd1a951f21fbf365c42ee",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k179-v2-owner154-1440.json.gz": "32bbd34ae705dd8644c06e96142e82a6793d679173b72bebc0895e8aa0844abd",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3-gallery-k179-v2-owner154-1440.json.gz": "2f13d569686212b37051278b1781f358ebbc386370ac2ab331352cc8be0d38b4",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k185-v0-owner160-360.json.gz": "c82c5f56a17dc35905d82acaf2e0ee2a0dcc19e937af07d1751f0aa2afe5804a",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3-gallery-k185-v0-owner160-360.json.gz": "47a87068134adc7103d8f461bc52b8672b148d8d7ef97f78ab6483258f919233",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k185-v0-owner160-412.json.gz": "60b4a12c0169dcff820be7e1453827fe07819e5cb59fe750d70434af23c9ae40",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3-gallery-k185-v0-owner160-412.json.gz": "832a60f52579165bd2c35ae80f6d199204f92f9135fe10134787008d76070c67",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k185-v0-owner160-1440.json.gz": "8e2837520510da3855e87c91330648ec35199661a4363086a2e9aba319a501fd",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3-gallery-k185-v0-owner160-1440.json.gz": "1d24e2dc834ad4d0452b210b3f3a23fb197b3e2000bee11c6b47f95fd1af64ba",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k185-v1-owner160-360.json.gz": "3d922472dd4800ee5e725b1a174d3256eda6aa3c42d8deaeb9078e9c8bf982f1",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3-gallery-k185-v1-owner160-360.json.gz": "b30c4cb4ee4e39d0aead8b240f29a0e0dd8ab94d70e56410e6c57a3aee29e625",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k185-v1-owner160-412.json.gz": "70603f56efd4a681bb8e9d25f127754ae4a4e4c9eb16f75bc35e299839b8c498",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3-gallery-k185-v1-owner160-412.json.gz": "a505fa997878b2e183c6bcb52b79aa59c1db2fa3013c720d4c8918a5ed6f4f88",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k185-v1-owner160-1440.json.gz": "e00c84dd1f0ceb75e99e189734bece0953181f09c4fbcb0e599ded24fde2b2ee",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3-gallery-k185-v1-owner160-1440.json.gz": "bbee0723c6fc6e1025c6eeaf6a764392157132565f3e8054de82ecceb0a4334a",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k185-v2-owner160-360.json.gz": "5d0aeadf5c0a262dbb72e779e04efe04579aefd7ee66debd2d8e80962b88119b",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3-gallery-k185-v2-owner160-360.json.gz": "f525fd1ebb507ccf436295731974508bb6e919ae24a6a81c7ecfe73221f61463",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k185-v2-owner160-412.json.gz": "623b0de59edaef935e516cae8c057a170cbc7b5b9388676fe931c2a29b358a54",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3-gallery-k185-v2-owner160-412.json.gz": "4b0703e7b0d622427bdf0e393312e19ab4181420f63d064e9ae57cded4055ef7",
 "docs/evidence/D082-baseline-qualification/final-pool-coastal-halls-gallery-k185-v2-owner160-1440.json.gz": "9dea613d4bcae8740802e15a041f56c9fa08395f9379c04f7cf598c07d092a06",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3-gallery-k185-v2-owner160-1440.json.gz": "ccc6f6c43e65c8f9248a87530b7ecf4c3eaa192c2bade09921034ef19d7c4d31",
 "docs/evidence/D082-candidate-v3/candidate-coastal-v3.json.gz": "5801cc2bec7fc646817f54df1eba883a99f2b1b20ee8de3a6ec0188f530011d5",
 "docs/evidence/D082-candidate-v3/candidate-halls-v3.json.gz": "7e733ac566c31014f7ed49244eda2af146d510275b2c4b8adf2c7a6c981d59b0",
 "docs/evidence/D082-candidate-v3/candidate-play-water-v3.json.gz": "f10ec9eaf6f86c38955df737ead9004ebde98d3e539b33e1b20ffb0ef6e47074"
};
const cache=new Map();
function readPinned(file){if(cache.has(file))return cache.get(file);const bytes=fs.readFileSync(new URL('../'+file,import.meta.url));assert.equal(sha(bytes),D082_BROWSER_SURFACE_EVIDENCE[file],'immutable selected-view evidence '+file);const parsed=JSON.parse(gunzipSync(bytes));const result=parsed.contract?{contract:parsed.contract,original:parsed.original.view,selected:parsed.selected.map(s=>({descriptor:s.descriptor,view:s.view})),coverage:parsed.coverage}:parsed;cache.set(file,result);return result;}
const baselineBytes=fs.readFileSync(new URL('../fixtures/d082-baseline-feasibility.json',import.meta.url));assert.equal(sha(baselineBytes),'ea3d6c5c0570f0694b892918b85b0fdc2b2cc4ae12154e8c5994cd0b76e88fd8');const BASE=JSON.parse(baselineBytes);
const group=k=>k===185?'coastal':k===179?'halls':'play-water';
const caseKey=(k,v,o)=>`gallery-k${k}-v${v}-owner${o}`;
function evidence(k,v,o,width,on){return readPinned(on?`docs/evidence/D082-candidate-v3/candidate-${group(k)}-v3-${caseKey(k,v,o)}-${width}.json.gz`:`docs/evidence/D082-baseline-qualification/final-pool-${[179,185].includes(k)?'coastal-halls':'play-water'}-${caseKey(k,v,o)}-${width}.json.gz`);}
export function d082SupplementaryViews(k,v,owner,width){
 const both=[evidence(k,v,owner,width,false),evidence(k,v,owner,width,true)],unique=new Map();assert.deepEqual(both[0].original,both[1].original,'frozen original production cameras agree');
 for(const [phase,e]of both.entries())for(const s of e.selected){const {yaw,elevation}=s.descriptor;assert.ok(Array.from({length:8},(_,i)=>i*Math.PI/4).includes(yaw));assert.ok([Math.PI*.08,Math.PI/6,Math.PI*.32].includes(elevation));const key=JSON.stringify([yaw,elevation,s.view.zoom]);if(!unique.has(key))unique.set(key,{spinRadians:yaw,tiltRadians:elevation-Math.PI/6,view:s.view,evidencePhases:[]});unique.get(key).evidencePhases.push(phase?'candidate':'baseline');}
 return [...unique.values()].map((s,i)=>({...s,id:'surface-'+String(i+1).padStart(2,'0'),additionalView:true,zoomByWidth:{[width]:s.view.zoom},reason:'Union of frozen complete baseline/candidate selected legal views; original camera retained.'}));
}
// The immutable qualification fixture predates production land/season defaults
// and excludes the two cityView UI instance systems. Reconstruct those systems,
// rather than projecting away any digest field or accepting browser-fed hashes.
export function createD082ProductionSurfaceFixture(on,force){
 const source=d082City('gallery'),city=d082CoastalCity(source,force),landArt=landLevelOf(()=>null),season=seasonOptionOf(()=>null,landArt);
 assert.equal(landArt,2);assert.deepEqual(season,{mode:'auto',soft:false});
 const con=new ConState(city.n),built=buildCityScene(city,D082_KT,STYLES.A,{...d082Blocks(source),landArt,season},'d',d082Civic(on),con,true,false,undefined),preview=new Preview(),hazard=new HazardMarks();
 con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(source,k=>D082_KT.cat(k));built.setTreeAges(i=>con.siteAge(i));con.uni.uDayFrac.value=0;con.uni.uTime.value=2.2;
 built.setTraffic(undefined);built.setSeason(source.day);built.scene.add(preview.mesh,hazard.mesh);
 const digest=sceneDigest(built),fixture={n:city.n,city,scene:built.scene,meshes:built.buildingMeshes(),owners:built.pickOwners()};
 assert.equal(preview.mesh.count,0);assert.equal(hazard.mesh.count,0);
 const ground=built.groundData(),rgb=Buffer.alloc(ground.W*ground.W*3);for(let i=0,j=0;i<ground.rgba.length;i+=4,j+=3){assert.equal(ground.rgba[i+3],255);rgb[j]=ground.rgba[i];rgb[j+1]=ground.rgba[i+1];rgb[j+2]=ground.rgba[i+2];}
 const groundEvidence={S:ground.S,W:ground.W,rgb:rgb.toString('base64')};
 const bridge={landArt,season,groundRgbSha256:sha(rgb),groundSha256:sha(built.groundData().rgba),groundDigest:digest.ground,uiInstances:digest.inst.slice(-2),fullProductionSceneSha256:jsonSha(digest)};
 return {built,con,fixture,digest,bridge,groundEvidence,assertBrowserGeometry(actual,actualGround){assert.deepEqual(actual,digest,'all production digest fields, ground bytes and exact ordered UI/tree instances match independent production reconstruction');assert.deepEqual(actualGround,groundEvidence,'actual ground RGB bytes, resolution and tile scale exactly match independently reconstructed production texture');return bridge;},dispose(){preview.mesh.removeFromParent();hazard.mesh.removeFromParent();preview.dispose();hazard.dispose();built.dispose();con.dispose();}};
}
export function createD082BrowserSurfaceOracle(on,force,width){
 assert.equal(typeof on,'boolean');assert.ok([0,1,2].includes(force));assert.ok([360,412,1440].includes(width));const viewport={W:width,H:{360:740,412:860,1440:1000}[width]};
 const source=d082City('gallery'),city=d082CoastalCity(source,force),con=new ConState(city.n),built=buildCityScene(city,D082_KT,STYLES.A,d082Blocks(city),'d',d082Civic(on),con,true);let disposed=false,production=null;
 const dispose=()=>{if(!disposed){disposed=true;production?.dispose();built.dispose();con.dispose();}};
 try{
  con.setGeometry(built.con.top,built.con.base,built.con.wallTop);con.setCity(city,k=>D082_KT.cat(k));built.setTreeAges(i=>con.siteAge(i));con.uni.uDayFrac.value=0;con.uni.uTime.value=2.2;
  const fixture={n:city.n,city,scene:built.scene,meshes:built.buildingMeshes(),owners:built.pickOwners()},digest=sceneDigest(built),construction=d081ConstructionDiagnostic(built.scene,con),states=new Map();
  production=createD082ProductionSurfaceFixture(on,force);
  assert.deepEqual(production.digest,{...digest,ground:production.digest.ground,inst:[...digest.inst,...production.bridge.uiInstances]},'production defaults change only independently derived ground pixels and add exact empty UI systems; all other archived fields stay exact');
  assert.deepEqual(production.bridge.uiInstances,['0:050c5d1f:050c5d1f:-','0:050c5d1f:050c5d1f:-']);
  const productionFixture=production.fixture;
  for(const[k,v]of D082_SLOTS.filter(([,v])=>v===force)){
   const b=city.buildings.find(b=>b.k===k),owner=b.id,key=caseKey(k,v,owner),summary=on?readPinned(`docs/evidence/D082-candidate-v3/candidate-${group(k)}-v3.json.gz`).cases.find(c=>c.key===key):BASE.cases.find(c=>c.k===k&&c.v===v&&c.owner===owner);assert.ok(summary,'frozen exact owner case');
   assert.deepEqual(digest,summary.sceneDigest,'entire actual forced scene, all neighboring variants and ordered tree instances match frozen qualification');assert.deepEqual(construction,summary.construction,'entire construction state matches frozen qualification');assert.equal(jsonSha(city),summary.worldSha256,'exact full copied variant pool');assert.equal(jsonSha(source),summary.sourceWorldSha256,'unchanged original world');
   const pin=evidence(k,v,owner,width,on),contract=d081OwnerSurfaceContract(fixture,pin.original,viewport,owner);assert.deepEqual(contract,d081OwnerSurfaceContract(productionFixture,pin.original,viewport,owner,{testOnlyRawSilhouetteRays:true}),'complete production scene raw Three parity with immutable archived contract');assert.equal(JSON.stringify(contract),JSON.stringify(pin.contract),'every frozen surface and silhouette record retained byte-for-byte');
   const planned=[pin.original,...d082SupplementaryViews(k,v,owner,width).map(s=>s.view)];for(const camera of planned)assertD081OwnerFits(d081OwnerBounds(productionFixture,camera,viewport,owner),'each frozen paired view retains full owner');
   assertD081SurfaceCoverage(planned.map(camera=>d081OwnerSurfaceRayAudit(productionFixture,camera,viewport,contract)),contract,'complete paired frozen-view plan (Node only)');
   states.set(owner,{k,v,contract,audits:[],observedContract:null,observedAudits:[],planned,summary:{contractSha256:contract.sha256,sourceGeometrySha256:contract.sourceGeometrySha256,required:contract.requiredSamples.length,retained:contract.probes.length,fullSceneSha256:jsonSha(digest),worldSha256:jsonSha(city),productionBridge:production.bridge}});
  }
  return {dispose,owners:[...states.keys()],
   assertBrowserGeometry(actual,actualGround){return production.assertBrowserGeometry(actual,actualGround);},
   audit(owner,camera){assert.ok(!disposed);const s=states.get(owner);assert.ok(s,'declared exact target owner');const planned=s.planned[s.audits.length];assert.ok(planned,'no undeclared or repeated surface view');assert.equal(camera.zoom,planned.zoom);for(const field of ['pos','target'])for(let i=0;i<3;i++)assert.ok(Math.abs(camera[field][i]-planned[field][i])<1e-9,'observed camera equals exact declared surface view');assert.deepEqual(sceneDigest(built),digest,'archived surface fixture remains read-only');assert.deepEqual(sceneDigest(production.built),production.digest,'complete production surface fixture remains read-only');assertD081OwnerFits(d081OwnerBounds(productionFixture,camera,viewport,owner),'observed browser camera full owner fit');if(!s.observedContract){s.observedContract=JSON.stringify(camera)===JSON.stringify(s.planned[0])?s.contract:d081OwnerSurfaceContract(productionFixture,camera,viewport,owner);if(s.observedContract!==s.contract)assert.deepEqual(s.observedContract,d081OwnerSurfaceContract(productionFixture,camera,viewport,owner,{testOnlyRawSilhouetteRays:true}),'observed original-camera contract exact raw ray parity');}const audit=d081OwnerSurfaceRayAudit(productionFixture,camera,viewport,s.contract),observedAudit=s.observedContract===s.contract?audit:d081OwnerSurfaceRayAudit(productionFixture,camera,viewport,s.observedContract);s.audits.push(audit);s.observedAudits.push(observedAudit);const construction=d081OwnerConstruction(city,con,owner,s.contract);assert.equal(construction.clippedCount,0,'no mandatory exterior probe is construction-clipped');assert.equal(construction.complete,true);const observedConstruction=d081OwnerConstruction(city,con,owner,s.observedContract);assert.equal(observedConstruction.clippedCount,0);return {...s.summary,audit,observedContractSha256:s.observedContract.sha256,observedOriginalContract:s.observedAudits.length===1?s.observedContract:null,observedAudit,construction,observedConstruction};},
   finish(){return [...states.entries()].map(([owner,s])=>{assert.equal(s.audits.length,s.planned.length,'each original and supplementary browser view is actually observed');return {owner,k:s.k,v:s.v,...s.summary,coverage:assertD081SurfaceCoverage(s.audits,s.contract,'actual observed browser-camera complete archived exterior union'),observedOriginalCoverage:assertD081SurfaceCoverage(s.observedAudits,s.observedContract,'complete contract including every actual observed original-camera silhouette hit')};});}
  };
 }catch(e){dispose();throw e;}
}

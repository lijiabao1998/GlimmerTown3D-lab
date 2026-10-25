import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Preview} from '../src/render/preview.ts';
import {Scene} from 'three';
const cells=[{x:3,z:3,y:0,ok:true}],road=new Uint8Array(64);road[19]=1;
const draw=p=>{p.set(cells,'#fff');p.setFrontage(8,road,cells);};
test('real Preview repeated enable/disable detaches and disposes all gold resources without world changes',()=>{
 const p=new Preview(1),scene=new Scene();scene.add(p.mesh);const before=Buffer.from(road);
 try{for(let i=0;i<12;i++){
  p.setFrontageEnabled(true);draw(p);assert.equal(p.frontageCount(),1);assert.equal(p.mesh.children.length,1);
  const gold=p.mesh.children[0];let geo=0,mat=0;gold.geometry.addEventListener('dispose',()=>geo++);gold.material.addEventListener('dispose',()=>mat++);
  p.setFrontageEnabled(false);assert.equal(p.frontageEnabled,false);assert.equal(p.frontageCount(),0);assert.equal(p.mesh.count,0);assert.equal(p.mesh.children.length,0);assert.equal(gold.parent,null);assert.equal(geo,1);assert.equal(mat,1);
 }assert.deepEqual(Buffer.from(road),before);}finally{p.dispose();}
});
test('growth, cancel and reconstructed scene cannot retain an orphan gold mesh',()=>{
 const p=new Preview(1,true),scene=new Scene();scene.add(p.mesh);draw(p);const old=p.mesh,gold=p.mesh.children[0];
 p.set([...cells,...cells,...cells],'#fff');assert.notEqual(old,p.mesh);assert.equal(old.parent,null);assert.equal(old.children.length,0);assert.equal(gold.parent,p.mesh);assert.equal(scene.children.length,1);
 p.clear();assert.equal(gold.count,0);assert.equal(p.mesh.count,0);
 p.setFrontageEnabled(true);assert.equal(p.mesh.children.length,1);assert.equal(gold.count,0);
 p.setFrontageEnabled(false);p.dispose();scene.remove(p.mesh);
 const next=new Preview(1);scene.add(next.mesh);assert.equal(next.frontageEnabled,false);assert.equal(next.frontageCount(),0);assert.equal(next.mesh.children.length,0);next.dispose();
});
test('native menu branch is explicitly gated, cancels held build first, requires actual API and writes only rendering state',()=>{
 const src=fs.readFileSync('src/cityView.ts','utf8');
 const body=src.match(/else if \(id === 'frontage' && q\.get\('streetFrontageControl'\) === '1'\) \{([\s\S]*?)\n    \}/)[1];
 assert.ok(src.indexOf('interruptBuild();   // A panel')<src.indexOf("id === 'frontage'"));
 assert.ok(!/sim\.|city\.|save|random|rng|localStorage|commitOp/.test(body));
 const apply=new Function('preview','invalidate','bui',body),p=new Preview(1);let frames=0;
 apply(p,()=>frames++,{toast(){}});assert.equal(p.frontageEnabled,true);apply(p,()=>frames++,{toast(){}});assert.equal(p.frontageEnabled,false);assert.equal(frames,2);p.dispose();
 assert.throws(()=>apply({frontageEnabled:false},()=>{}, {toast(){}}),/setFrontageEnabled is not a function/);
});
test('resource-leak negative controls fail the same real Three lifecycle assertions',async()=>{
 const {StreetFrontage}=await import('../src/render/streetFrontage.ts');
 const source=fs.readFileSync('src/render/preview.ts','utf8');
 const body=source.match(/setFrontageEnabled\(enabled: boolean\) \{([\s\S]*?)\n  \}\n  get frontageEnabled/)[1];
 for(const omitted of ['this.mesh.remove(this.frontage.mesh);','this.frontage.dispose();']){
  const p=new Preview(1,true),gold=p.mesh.children[0];let disposed=false;gold.geometry.addEventListener('dispose',()=>disposed=true);
  const mutant=new Function('enabled','StreetFrontage',body.replace(omitted,''));
  assert.throws(()=>{mutant.call(p,false,StreetFrontage);assert.equal(gold.parent,null);assert.equal(disposed,true);},e=>e.code==='ERR_ASSERTION');
  gold.parent?.remove(gold);gold.geometry.dispose();gold.material.dispose();p.dispose();
 }
});
test('actual full onMenu rejects forged toggle when opt-in is absent and enabled path leaves world/save/RNG untouched',async()=>{
 const {stripTypeScriptTypes}=await import('node:module');const src=fs.readFileSync('src/cityView.ts','utf8');
 const a=src.indexOf('  function onMenu(id: string)'),b=src.indexOf('  function menuCity(',a);assert.ok(a>0&&b>a);
 const actual=stripTypeScriptTypes(src.slice(a,b));
 const make=new Function('preview','q','interruptBuild','closeGrowth','invalidate','bui',actual+';return onMenu;');
 const world={money:771,history:[{day:3}],rng:864,save:'opaque unchanged'},before=JSON.stringify(world);
 let clear=0,frames=0;const off={get frontageEnabled(){throw Error('disabled read');},get setFrontageEnabled(){throw Error('disabled method');}};
 make(off,new URLSearchParams(),()=>clear++,()=>{},()=>frames++,{toast(){}})('frontage');assert.equal(clear,1);assert.equal(frames,0);
 const p=new Preview(1),menu=make(p,new URLSearchParams('streetFrontageControl=1'),()=>{clear++;p.clear();},()=>{},()=>frames++,{toast(){}});
 menu('frontage');draw(p);assert.equal(p.frontageCount(),1);menu('frontage');assert.equal(p.frontageCount(),0);assert.equal(p.mesh.children.length,0);assert.equal(JSON.stringify(world),before);assert.equal(frames,2);p.dispose();
});
test('setting same state deliberately interrupts and requires fresh placement without allocating duplicate geometry',()=>{
 const p=new Preview(1,true);draw(p);const gold=p.mesh.children[0];p.setFrontageEnabled(true);assert.equal(p.mesh.children[0],gold);assert.equal(p.frontageCount(),0);assert.equal(p.mesh.count,0);draw(p);assert.equal(p.frontageCount(),1);p.setFrontageEnabled(false);p.set(cells,'#fff');p.setFrontageEnabled(false);assert.equal(p.mesh.count,0);assert.equal(p.mesh.children.length,0);p.dispose();
});

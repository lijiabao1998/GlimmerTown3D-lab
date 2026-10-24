import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {Preview} from '../src/render/preview.ts';
const source=fs.readFileSync('src/cityView.ts','utf8');
const start=source.indexOf('  function updatePreview() {'),end=source.indexOf('  function placeCostTag(',start);
assert.ok(start>=0&&end>start);
const actual=stripTypeScriptTypes(source.slice(start,end));
function run(preview,road,mutant=actual){
 const cells=[{x:3,z:3,y:0,ok:true}],world={money:100,history:[1],rng:772},before=JSON.stringify(world);
 const city={n:8,get road(){if(road===null)throw Error('disabled accessed frontage road');return road;}};
 const execute=new Function('preview','city','sim','cells',`let stroke={pid:1,moved:false},tool='park',lastPreview=null,siteEstimate=null;const performance={now:()=>1},opOf=()=>({k:'tap',tool:'park'}),previewOp=()=>({cells}),tileTop=()=>0,toolColor=()=>'#fff',diagnoseSite=()=>null,placeCostTag=()=>{},timing={},invalidate=()=>{},bui={hideCost:()=>{}};${mutant};updatePreview();`);
 execute(preview,city,world,cells);assert.equal(JSON.stringify(world),before);assert.deepEqual(cells,[{x:3,z:3,y:0,ok:true}]);
}
test('actual opt-in call skips all frontage inputs and method access when disabled',()=>{
 const off=new Preview(1);try{assert.equal(off.frontageEnabled,false);Object.defineProperty(off,'setFrontage',{get(){throw Error('disabled accessed method');}});run(off,null);assert.equal(off.frontageCount(),0);assert.equal(off.mesh.children.length,0);}finally{off.dispose();}
});
test('actual enabled Preview draws shared edge without changing input world',()=>{
 const on=new Preview(1,true),road=new Uint8Array(64);road[2*8+3]=1;const before=Buffer.from(road);try{assert.equal(on.frontageEnabled,true);run(on,road);assert.equal(on.frontageCount(),1);assert.deepEqual(Buffer.from(road),before);on.clear();assert.equal(on.frontageCount(),0);}finally{on.dispose();}
});
test('enabled missing API is not swallowed; unconditional call and disabled enabled-path mutations fail',()=>{
 const road=new Uint8Array(64);assert.throws(()=>run({frontageEnabled:true,set(){},clear(){}},road),/setFrontage is not a function/);
 const off=new Preview(1);try{assert.throws(()=>run(off,null,actual.replace('if (preview.frontageEnabled === true) ','')),/disabled accessed frontage road/);}finally{off.dispose();}
 const on=new Preview(1,true);road[2*8+3]=1;try{assert.throws(()=>{run(on,road,actual.replace('preview.frontageEnabled === true','false'));assert.equal(on.frontageCount(),1);},e=>e.code==='ERR_ASSERTION');}finally{on.dispose();}
});

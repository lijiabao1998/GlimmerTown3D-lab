// Real mouse/touch placement for the five existing native tools; three imported civic kinds
// are render-only in the existing catalogue. D056 deliberately does not invent their game rules.
import assert from 'node:assert/strict';
import {tapD053} from './d053-capture.mjs';
import {d054Snapshot,d054Model,d054World} from './d054-capture.mjs';
import {previewOp,commitOp,undoOp} from '../src/sim/edit.ts';
export const D056_SAME = `(()=>{const pick=d=>JSON.stringify({m:Object.fromEntries(Object.entries(d.meshes).map(([k,m])=>[k,[m.byOwner,m.ownerTris]])),g:d.ground,i:d.inst,q:d.queries,c:d.counts});return pick(__gt.sceneDigest())===pick(__gt.freshDigest());})()`;
const J=JSON.stringify;
function equalModel(a,s,label){assert.equal(a.sim.money,s.money,label+' funds');assert.equal(a.sim.day,s.day,label+' day');for(const k of ['road','rclass','ter','el','zone','tree','rail','dock','tram','occ'])assert.deepEqual(a.layers[k],Array.from(s.city[k]),label+' '+k);assert.deepEqual(a.history,s.city.history,label+' history');}
export async function d056Native(p,page,{mobile,item}){
 const tap=sel=>tapD053(p,sel,mobile),before=await d054Snapshot(p),model=d054Model(before.code).sim;
 const results=[];equalModel(before,model,'initial');
 await p.ev(`window.__d056Inputs=[];for(const type of ['pointerdown','pointerup','pointercancel','click'])addEventListener(type,e=>__d056Inputs.push({type,trusted:e.isTrusted}),true)`);
 for(const t of [{id:'fire',k:6},{id:'school',k:7},{id:'library',k:14},{id:'post',k:15},{id:'market',k:87},{id:'police',k:11},{id:'hospital',k:12},{id:'clinic',k:13}]){
  const state=await p.ev('__gt.ui()');if(!['civic','food'].includes(state.tool))await tap('.tool[data-t="civic"]');
  for(let repeat=0;repeat<2;repeat++){
   const snap=await d054Snapshot(p);await tap('#civicGuide');await tap('#catalogClose');assert.deepEqual(d054World(await d054Snapshot(p)),d054World(snap),t.id+' cancel catalogue is read-only');
  }
  await tap('#civicGuide');if(t.id==='market')await tap('#catalog [data-group="food"]');else await tap('#catalog [data-group="service"]');
  await tap(`#catalog [data-tool="${t.id}"]`);assert.equal((await p.ev('__gt.ui()')).civicTool,t.id);
  await p.ev('__gt.view(30.5,18.5,4.4)');await p.frames(3);
  for(let repeat=0;repeat<2;repeat++){
   const op={k:'tap',tool:t.id,x0:30,z0:18,x1:30,z1:18},pv=previewOp(model,op);assert.equal(pv.count,1);assert.equal(pv.affordable,true);const at=await p.cell(30,18);assert.equal(await p.hit(at),'CANVAS');
   if(mobile){await p.touch('touchStart',[at]);await p.frames(2);assert.ok(await p.ev('__gt.stroke()'));await p.touch('touchCancel',[]);await p.frames(2);equalModel(await d054Snapshot(p),model,t.id+' interrupted touch does not place');}
   if(mobile)await p.touch('touchStart',[at]);else await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:at[0],y:at[1],button:'left',buttons:1,clickCount:1});
   await p.frames(2);const stroke=await p.ev('__gt.stroke()');assert.deepEqual(stroke.preview,{count:1,total:pv.total,cells:t.id==='market'?4:1});
   assert.ok(commitOp(model,op,0).ok);if(mobile)await p.release();else await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:at[0],y:at[1],button:'left',buttons:0,clickCount:1});await p.frames(3);
   equalModel(await d054Snapshot(p),model,t.id+' placed');assert.equal(await p.ev(D056_SAME),true,t.id+' placed cached/fresh');const placed=(await p.ev('__gt.buildingList()')).find(b=>b[2]===30&&b[3]===18);assert.equal(placed[1],t.k);
   const hit=await p.ev('__gt.pickTopDown(30.5,18.5)');assert.equal(hit.id,placed[0],t.id+' new geometry is pickable');
   await tap('#undo');assert.ok(undoOp(model).ok);equalModel(await d054Snapshot(p),model,t.id+' undo');assert.equal(await p.ev(D056_SAME),true,t.id+' undo cached/fresh');results.push({tool:t.id,repeat,cost:pv.total,nativePlacement:true,undo:true,picking:true,cancel:mobile});
  }
 }
 const inputs=await p.ev('__d056Inputs');assert.ok(inputs.length>0&&inputs.every(e=>e.trusted));item.native={results,allInputTrusted:true,importOnlyKinds:[17,42,43]};
}

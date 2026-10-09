// D055 fresh native CDP flows, model independently executes the actual paid editor.
import assert from 'node:assert/strict';
import { tapD053 } from './d053-capture.mjs';
import { d054Snapshot, d054Model, d054World } from './d054-capture.mjs';
import { FOOD_TOOLS, previewOp, commitOp, undoOp } from '../src/sim/edit.ts';
import { foodExportCode } from './d046-cities.mjs';
const J=JSON.stringify;
function equalModel(a,s,label){assert.equal(a.sim.money,s.money,label+' funds');assert.equal(a.sim.day,s.day,label+' day');for(const k of ['road','rclass','ter','el','zone','tree','rail','dock','tram','occ'])assert.deepEqual(a.layers[k],Array.from(s.city[k]),label+' '+k);assert.deepEqual(a.history,s.city.history,label+' history');}
export async function d055Native(p,page,{mobile,item}){
 const tap=sel=>tapD053(p,sel,mobile), checks=[];
 const before=await d054Snapshot(p),model=d054Model(before.code).sim;
 assert.equal(before.sim.playing,false,'paid native tests run paused');equalModel(before,model,'snapshot/model initial alignment');
 for(const t of FOOD_TOOLS){
  if(!['civic','food'].includes((await p.ev('__gt.ui()')).tool))await tap('.tool[data-t="civic"]');await tap('#civicGuide');await tap('#catalog [data-group="food"]');await tap(`#catalog [data-tool="${t.id}"]`);
  const ui=await p.ev('__gt.ui()');assert.equal(ui.tool,'food');assert.equal(ui.civicTool,t.id);
  const operation={k:'tap',tool:t.id,x0:30,z0:18,x1:30,z1:18},pv=previewOp(model,operation);
  assert.ok(pv.count===1&&pv.affordable,t.id+' fixture available');assert.equal(pv.cells.length,t.size*t.size);
  await p.ev('__gt.view(30.5,18.5,4.4)');await p.frames(3);const at=await p.cell(30,18);assert.equal(await p.hit(at),'CANVAS');
  if(mobile)await p.touch('touchStart',[at]);else await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:at[0],y:at[1],button:'left',buttons:1,clickCount:1});
  await p.frames(2);const native=await p.ev('__gt.stroke()');assert.ok(native?.preview);assert.deepEqual(native.preview,{count:1,total:pv.total,cells:t.size*t.size});assert.deepEqual(native.a,[30,18]);assert.deepEqual(native.b,[30,18]);
  const built=commitOp(model,operation,0);assert.ok(built.ok);assert.equal(built.events.filter(e=>e.t==='place').length,1);
  if(mobile)await p.release();else await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:at[0],y:at[1],button:'left',buttons:0,clickCount:1});await p.frames(3);
  equalModel(await d054Snapshot(p),model,t.id+' native commit');
  await tap('#undo');const undone=undoOp(model);assert.ok(undone.ok);assert.equal(undone.refund,pv.total);equalModel(await d054Snapshot(p),model,t.id+' native undo');checks.push({tool:t.id,footprint:t.size*t.size,cost:pv.total,paid:true,undo:true});
 }
 // Active external-trade commission links to catalogue without placing or paying.
 const code=foodExportCode('trade1200');await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(code)})`);await p.open('');await p.frames(3);
 const cmBefore=await d054Snapshot(p);assert.equal(cmBefore.sim.playing,false);assert.equal(cmBefore.commission.act,'trade1200');await tap('#commissionHud');const selector='#cm li[data-kind="act"] button[aria-label="開啟農業外貿設施導覽"]';await tap(selector);
 assert.equal(await p.ev("document.querySelector('#catalog').hidden"),false);assert.deepEqual(await p.ev("[...document.querySelectorAll('#catalog [data-tool]')].map(x=>x.dataset.tool)"),FOOD_TOOLS.map(x=>x.id));
 await tap('#catalogClose');const cmAfter=await d054Snapshot(p);assert.equal(cmAfter.sim.money,cmBefore.sim.money);assert.deepEqual(cmAfter.history,cmBefore.history);assert.deepEqual(cmAfter.commission,cmBefore.commission);assert.deepEqual(d054World(cmAfter),d054World(cmBefore),'commission CTA is entirely read-only');
 item.native={checks,commissionNavigation:true};
}

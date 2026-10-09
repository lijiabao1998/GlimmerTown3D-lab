// Extra live-only native interrupted-build and saved-city reload checks.
import assert from 'node:assert/strict';
import { withBrowser } from './cdp.mjs';
import { pageSession, grew } from './smoke-d011.mjs';
import { tapD053 } from './d053-capture.mjs';
import { d054Snapshot, d054World, d054Persisted, d054Model } from './d054-capture.mjs';
import { D055_VIEWS, d055ReviewCode } from './d055-scenes.mjs';
const J = JSON.stringify;
export async function liveReloadChecks() {
  const results = [];
  for (const opt of D055_VIEWS) await withBrowser({width:Math.max(960,opt.W),height:900}, async ({page,open}) => {
    const p = await pageSession(page,open,opt), tap = selector => tapD053(p,selector,opt.mobile);
    const mouse = (type,at) => page.send('Input.dispatchMouseEvent',{type,x:at[0],y:at[1],button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});
    await p.open('sample=seed516&clean=1');
    await p.ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(d055ReviewCode())})`);
    await p.open('');
    await tap('.tool[data-t="civic"]'); await tap('#civicGuide');
    await tap('#catalog [data-group="food"]'); await tap('#catalog [data-tool="farm"]');
    const before = await d054Snapshot(p);
    async function start() {
      const ui = await p.ev('__gt.ui()');
      if(ui.tool!=='food'||ui.civicTool!=='farm') {
        if(!['civic','food'].includes(ui.tool)) await tap('.tool[data-t="civic"]');
        await tap('#civicGuide'); await tap('#catalog [data-group="food"]'); await tap('#catalog [data-tool="farm"]');
      }
      await p.ev('__gt.view(30.5,18.5,4.4)'); await p.frames(3);
      const at = await p.cell(30,18); assert.equal(await p.hit(at),'CANVAS');
      if(opt.mobile) await p.touch('touchStart',[at]); else await mouse('mousePressed',at);
      await p.frames(2); assert.equal((await p.ev('__gt.stroke()')).preview.count,1);
      return at;
    }
    async function end(at) { if(opt.mobile) await p.release(); else await mouse('mouseReleased',at); await p.frames(3); }
    async function idleBuild() {
      assert.equal(await p.ev('__gt.stroke()'),null);
      assert.equal(await p.ev('__gt.previewCount()'),0);
      assert.equal(await p.ev('__gt.ui().pointers'),0);
      assert.equal(await p.ev("document.querySelector('#costTag').hidden"),true);
    }
    let at = await start(); await p.key('Escape'); await end(at);
    await idleBuild();
    assert.deepEqual(d054Persisted(await d054Snapshot(p)),d054Persisted(before),'Escape and delayed release cannot build or change stored state');
    if(opt.mobile) {
      at = await start(); await p.touch('touchStart',[[...at,0],[at[0]+35,at[1]+35,1]]); await p.frames(2); await p.release();
      await idleBuild();
      assert.deepEqual(d054Persisted(await d054Snapshot(p)),d054Persisted(before),'second finger cannot build or change stored state');
    }
    at = await start(); await end(at);
    const built = await d054Snapshot(p);
    assert.equal(before.sim.money-built.sim.money,120,'one real farm payment');
    assert.equal(built.history.filter(e=>e.t==='place').length-before.history.filter(e=>e.t==='place').length,1);
    const saved = await p.fullSave(await p.ev("localStorage.getItem('gt3d.v1.save')"));
    assert.equal(saved.money,built.sim.money,'normal autosave contains actual paid funds, not the initial fixture');
    assert.equal(saved.day,built.sim.day,'normal autosave contains current day');
    await p.open('');
    const loaded = await d054Snapshot(p), model = d054Model(loaded.code).sim;
    assert.equal(loaded.sim.money,built.sim.money,'reload retains funds');
    assert.equal(loaded.sim.day,built.sim.day,'reload retains day');
    assert.ok(grew(built.history,loaded.history,await p.ev('__gt.restyled()')).ok,'reload retains exact history prefix and only appends legitimate restyles');
    for(const key of ['road','rclass','ter','el','zone','tree','rail','dock','tram','occ']) assert.deepEqual(loaded.layers[key],built.layers[key],'actual browser reload layer '+key);
    const farm = loaded.buildings.find(b=>b[1]===22&&b[2]===30&&b[3]===18);
    assert.ok(farm && farm[0]>0 && farm[4]===2,'actual browser farm root and size');
    for(const [x,z] of [[30,18],[31,18],[30,19],[31,19]]) assert.equal(loaded.layers.occ[z*loaded.layers.n+x],farm[0],'actual browser complete footprint');
    const root = model.w.tiles[18*model.w.N+30].bld;
    assert.equal(root.k,22); assert.equal(root.sz,2);
    for(const [x,z] of [[31,18],[30,19],[31,19]]) assert.deepEqual(model.w.tiles[z*model.w.N+x].bld.ref,[30,18]);
    await tap('.tool[data-t="civic"]');
    for(let i=0;i<2;i++) { await tap('#civicGuide'); await tap('#catalog [data-group="food"]'); await tap('#catalogClose'); }
    assert.deepEqual(d054World(await d054Snapshot(p)),d054World(loaded),'repeated catalogue open/close after reload is read-only');
    assert.deepEqual(page.errors,[]);
    assert.deepEqual(page.requests.filter(u=>!u.startsWith('https://lijiabao1998.github.io/GlimmerTown3D-lab/')&&!/^(data:|blob:|about:)/.test(u)),[]);
    results.push({viewport:opt,escapeDelayedRelease:true,secondFinger:opt.mobile?'passed':'not applicable',paidBuild:true,autosaveReload:true,completeFootprint:true,repeatedCatalogue:true,consoleErrors:0});
  });
  return results;
}

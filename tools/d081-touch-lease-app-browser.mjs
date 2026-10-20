// Supplemental D081 test: the compiled, unmodified application and real browser
// layout, with a deliberately SYNTHETIC event/task schedule. This is NOT native
// touch retargeting proof. Keep tools/smoke-d052.mjs unchanged and run its trusted
// CDP touch cases independently. No renderer or simulator is copied into this test.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { ROOT, withBrowser } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { tapD052 } from './d052-capture.mjs';
import { D052_SAVE_KEY } from './d052-scenes.mjs';
import { mk } from './d034-cities.mjs';
import { builtBase } from './d036-cities.mjs';
import { loadCode } from '../src/io/save.ts';
import { stepDay } from '../src/sim/day.ts';
import { commissionOffers } from '../src/sim/edit.ts';

const J = JSON.stringify, OUT = path.join(ROOT, 'scratch/d081-touch-lease-app');
const TARGET = '#cm li[data-kind="offer"][data-k="happy70"] button';
const sha = x => createHash('sha256').update(x).digest('hex');
const task = p => p.ev('new Promise(resolve => setTimeout(resolve, 0))');
const WORLD = `({code:__gt.save(),saved:__gt.saved(),history:__gt.history(),commission:__gt.simCms()})`;
const PROBE = `(()=>{
  window.__leaseEvents=[]; window.__leaseWrites=0;
  for(const type of ['pointerdown','touchstart','pointerup','touchend','pointercancel','click'])
    document.addEventListener(type,e=>__leaseEvents.push({type,trusted:e.isTrusted,pointerId:e.pointerId??null,key:e.target.closest?.('[data-k]')?.dataset.k??'',id:e.target.id??''}),true);
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===${J(D052_SAVE_KEY)})__leaseWrites++;return original.call(this,k,v)};
  window.__leasePointer=(type,id=81,target=__leaseButton)=>target.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',pointerId:id,isPrimary:id===81,button:0,buttons:type==='pointerdown'?1:0}));
  window.__leaseTouch=(type,ids,target=__leaseButton)=>{const touches=ids.map(identifier=>new Touch({identifier,target,clientX:1,clientY:1}));target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches,targetTouches:touches,changedTouches:touches}));};
})()`;
const VIEW = `(()=>{
  const cm=document.querySelector('#cm'),card=cm.querySelector('.card'),body=cm.querySelector('.body'),b=window.__leaseButton;
  const rect=e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};
  return {day:__gt.techState().day,rank:__gt.techState().rank,sub:__gt.cmPanel().sub,tip:__gt.cmPanel().tip,
    text:cm.textContent,rows:__gt.cmRows(),rect:rect(b),card:rect(card),scroll:[card.scrollTop,body.scrollTop,window.scrollX,window.scrollY],
    same:b===cm.querySelector(${J(TARGET)}),connected:b.isConnected,focus:document.activeElement===b,
    id:b.closest('[data-k]')?.dataset.k,buttonText:b.textContent,ariaDisabled:b.getAttribute('aria-disabled'),
    state:b.closest('[data-k]')?.dataset.st,viewport:[innerWidth,innerHeight],documentWidth:document.documentElement.scrollWidth,
    pinned:card.style.position==='fixed',hidden:cm.hidden};
})()`;
function near(a,b,label){assert.equal(a.length,b.length,label);for(let i=0;i<a.length;i++)assert.ok(Math.abs(a[i]-b[i])<0.1,`${label}[${i}]: ${a[i]} != ${b[i]}`);}
function stable(actual,initial,label){
  assert.equal(actual.same,true,label+' same button');assert.equal(actual.connected,true,label+' connected');
  assert.equal(actual.focus,true,label+' focus');assert.equal(actual.id,'happy70',label+' identity');
  near(actual.rect,initial.rect,label+' target rectangle');near(actual.card,initial.card,label+' card bounds');
  near(actual.scroll,initial.scroll,label+' scroll');
  const [x,y,w,h]=actual.card,[vw,vh]=actual.viewport;
  assert.ok(x>=-0.1&&y>=-0.1&&x+w<=vw+0.1&&y+h<=vh+0.1,label+' card within viewport');
  assert.ok(actual.documentWidth<=vw,label+' no document overflow');
}
async function setup(p,seed,mobile){
  // Exactly the historical D052 promotion fixtures, not ad-hoc world mutation.
  const code=mk(seed,50,seed===1?'委託換位驗收':'委託移除驗收',b=>{b.road(4,30,60,30,3).put(3,30,5);for(let x=10;x<=41;x++)b.put(x,29,1,1,{den:3});},{rk:2,money:10000});
  await p.open('sample=seed516&clean=1');await p.ev(`__gt.clearSave();localStorage.setItem(${J(D052_SAVE_KEY)},${J(code)})`);await p.open('');
  await p.ev('__gt.saveNow()');await p.ev('__gt.journalFlush()');
  await tapD052(p,'#menuBtn',mobile);await tapD052(p,'#menu [data-m="commission"]',mobile);
  await p.ev(`window.__leaseButton=document.querySelector(${J(TARGET)});__leaseButton.scrollIntoView({block:'center'});__leaseButton.focus()`);await p.frames(2);await p.ev(PROBE);
  const {KT,vrank}=builtBase(),control=loadCode(code,KT,vrank);assert.ok(control.ok);stepDay(control.sim);
  return {code,freshIds:commissionOffers(control.sim).map(c=>c.id)};
}
export async function d081TouchLeaseAppBrowser(browser=withBrowser){
  fs.mkdirSync(OUT,{recursive:true});
  const report={title:'D081 compiled application commission lease geometry',qualification:'Synthetic PointerEvent/TouchEvent schedule in real Chrome against built dist and original __gt.simStep. NOT proof of native retargeting or historical failure cause. Unchanged smoke-d052 remains the independent trusted-touch regression.',sources:{},cases:[],passed:false};
  for(const file of ['tools/d081-touch-lease-app-browser.mjs','tools/smoke-d052.mjs','src/cityView.ts','src/ui/panelPress.ts','dist/index.html'])report.sources[file]=sha(fs.readFileSync(path.join(ROOT,file)));
  const write=()=>fs.writeFileSync(path.join(OUT,'evidence.json'),J(report,null,2));
  let failures=0;
  for(const W of [360,412,1440])for(const seed of [1,5]){
    const item={width:W,height:W===360?740:W===412?860:900,seed,passed:false,phases:[],shots:[]};report.cases.push(item);
    try{await browser({width:Math.max(960,W),height:item.height},async({open,page})=>{
      item.browser=await page.send('Browser.getVersion');const p=await pageSession(page,open,{W,H:item.height,mobile:W<1000});
      const {code,freshIds}=await setup(p,seed,W<1000);item.fixtureSha256=sha(code);item.freshModelOffers=freshIds;
      const sample=async label=>{const view=await p.ev(VIEW);item.phases.push({label,view});return view;};
      const shot=async label=>{const filename=`seed-${seed}-${W}-${label}.png`,bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');fs.writeFileSync(path.join(OUT,filename),bytes);item.shots.push({filename,sha256:sha(bytes)});};
      const initial=await sample('before-pointerdown');assert.equal(initial.day,50);assert.deepEqual(initial.rows.filter(r=>r.kind==='offer').map(r=>r.k),['trade1200','happy70']);
      await p.ev(`__leasePointer('pointerdown');__leaseTouch('touchstart',[901]);`);
      stable(await sample('pointerdown'),initial,'pointerdown');
      await p.ev('__gt.simStep(1)');const held=await sample('day51-while-held');stable(held,initial,'held');
      assert.equal(held.day,51);assert.equal(held.rank,3);assert.equal(held.text,initial.text,'entire held panel presentation remains original');assert.deepEqual(held.rows,initial.rows);
      await shot('held');
      // Force the no-click recovery task to run BEFORE dispatching a matching click.
      await p.ev(`__leasePointer('pointerup');__leaseTouch('touchend',[]);`);await task(p);await task(p);
      const released=await sample('task-before-click');stable(released,initial,'post-task');assert.match(released.sub,/第 51 天/);
      assert.deepEqual(released.rows.filter(r=>r.kind==='offer').map(r=>r.k).slice(0,2),['trade1200','happy70'],'original semantic slots stay leased');
      if(seed===1){assert.deepEqual(freshIds,['happy70','steel40','trade1200']);assert.equal(released.buttonText,'接受');}
      else{assert.ok(!freshIds.includes('happy70'));assert.equal(released.state,'unavailable');assert.equal(released.buttonText,'已失效');assert.equal(released.ariaDisabled,'true');}
      await shot('task-before-click');await p.ev('__gt.journalFlush()');
      if(seed===5&&W===360){
        // Explicit DOM scroll setup, not a native swipe claim. Newly appended
        // content must remain reachable inside the fixed-height leased card.
        const beforeScroll=await p.ev(WORLD),scrollWrites=await p.ev('__leaseWrites');
        const reach=await p.ev(`(()=>{
          const card=document.querySelector('#cm .card'),head=document.querySelector('#cm .head'),foot=document.querySelector('#cm .foot');
          const row=document.querySelector('#cm li[data-kind="offer"][data-k="techC6"]'),button=row.querySelector('button');
          window.__leaseOriginalScroll=card.scrollTop;window.__leaseOriginalHandler=__leaseButton.onclick;
          const r=row.getBoundingClientRect(),h=head.getBoundingClientRect(),f=foot.getBoundingClientRect();
          card.scrollTop+=((r.top+r.bottom)-(h.bottom+f.top))/2;
          const rr=row.getBoundingClientRect(),br=button.getBoundingClientRect(),hh=head.getBoundingClientRect(),ff=foot.getBoundingClientRect();
          return {before:__leaseOriginalScroll,after:card.scrollTop,row:[rr.left,rr.top,rr.right,rr.bottom],
            button:[br.left,br.top,br.right,br.bottom],visible:[hh.bottom,ff.top],
            hit:button.contains(document.elementFromPoint((br.left+br.right)/2,(br.top+br.bottom)/2)),
            id:row.dataset.k,state:row.dataset.st,name:row.querySelector('b').textContent,label:button.textContent,
            ariaLabel:button.getAttribute('aria-label'),ariaDisabled:button.getAttribute('aria-disabled'),disabled:button.disabled,
            same:__leaseButton===document.querySelector(${J(TARGET)})&&__leaseButton.isConnected,
            sameHandler:__leaseButton.onclick===__leaseOriginalHandler};
        })()`);
        assert.ok(reach.after>reach.before,'intentional card scroll exposes appended offer');
        assert.ok(reach.row[1]>=reach.visible[0]-.1&&reach.row[3]<=reach.visible[1]+.1,'entire appended row readable between sticky header/footer');
        assert.ok(reach.button[1]>=reach.visible[0]-.1&&reach.button[3]<=reach.visible[1]+.1,'appended button unobscured');
        assert.equal(reach.hit,true,'appended offer is hittable, not covered by sticky footer');
        assert.equal(reach.id,'techC6');assert.equal(reach.state,'can');assert.match(reach.name,/學術網絡/);
        assert.equal(reach.label,'接受');assert.match(reach.ariaLabel,/接受委託：.*學術網絡/);
        assert.equal(reach.ariaDisabled,null);assert.equal(reach.disabled,false);
        assert.equal(reach.same,true);assert.equal(reach.sameHandler,true,'scroll retains original semantic handler');
        assert.deepEqual(await p.ev(WORLD),beforeScroll,'scroll does not change save/history/model');
        assert.equal(await p.ev('__leaseWrites'),scrollWrites,'scroll does not save');
        await shot('appended-offer-scrolled');
        await p.ev(`document.querySelector('#cm .card').scrollTop=__leaseOriginalScroll`);await p.frames(2);
        stable(await sample('restored-after-intentional-scroll'),initial,'scroll restored');
        assert.deepEqual(await p.ev(WORLD),beforeScroll,'restoring scroll does not change save/history/model');
        assert.equal(await p.ev('__leaseWrites'),scrollWrites);
        item.scrollReachability={passed:true,method:'intentional DOM card scroll, not native swipe',...reach};
      }
      const before=await p.ev(WORLD),writes=await p.ev('__leaseWrites');
      await p.ev(`__leasePointer('click')`);await task(p);await p.ev('__gt.journalFlush()');
      const after=await p.ev(WORLD);item.beforeClick=before;item.afterClick=after;item.saveWrites=await p.ev('__leaseWrites')-writes;
      if(seed===1){assert.equal(after.commission.act,'happy70');assert.equal(after.history.filter(e=>e.t==='cms'&&e.ev==='accept'&&e.id==='happy70').length,1);assert.equal(after.history.length,before.history.length+1);assert.notEqual(after.saved,before.saved);assert.ok(item.saveWrites>0,'accept saved');}
      else{assert.deepEqual(after,before,'unavailable click rejects without save or history mutation');assert.equal(item.saveWrites,0);assert.match(await p.ev('__gt.cmPanel().tip'),/接不了/);assert.equal(await p.ev(`!!document.querySelector(${J(TARGET)})`),false);}
      assert.equal(await p.ev(`document.querySelector('#cm .card').style.position`),'','lease geometry released');
      if(seed===1)assert.equal(await p.ev(`document.querySelectorAll('#cm li[data-kind="offer"]').length`),0,'accepted panel releases old offer structure');
      else assert.deepEqual(await p.ev(`__gt.cmRows().filter(r=>r.kind==='offer').map(r=>r.k)`),freshIds,'rejected panel releases stale slots');
      await shot('after-click');item.events=await p.ev('__leaseEvents');assert.equal(item.events.filter(e=>e.type==='click'&&e.key==='happy70').length,1);assert.ok(item.events.every(e=>!e.trusted),'scheduled events are explicitly synthetic');
      item.errors=[...page.errors];item.external=page.requests.filter(u=>!/^(http:\/\/127\.0\.0\.1:\d+\/|data:|blob:|about:)/.test(u));assert.deepEqual(item.errors,[]);assert.deepEqual(item.external,[]);
      if(seed===1&&W===412){
        // Mixed ownership: cancel an old released offer while Close is held.
        // Cancellation must not flush pending presentation through the newer press.
        await setup(p,seed,true);
        await p.ev(`__leasePointer('pointerdown');__leaseTouch('touchstart',[901]);__gt.simStep(1);__leasePointer('pointerup');__leaseTouch('touchend',[]);`);
        await task(p);await task(p);
        await p.ev(`window.__leaseClose=document.querySelector('#cmX');__leaseClose.focus();__leasePointer('pointerdown',82,__leaseClose);__leaseTouch('touchstart',[902],__leaseClose);`);
        const heldClose=await p.ev(`({text:document.querySelector('#cm').textContent,rect:document.querySelector('#cmX').getBoundingClientRect().toJSON()})`);
        await p.ev(`__gt.simStep(1);__leasePointer('pointercancel',81);`);await task(p);await task(p);
        assert.deepEqual(await p.ev(`({text:document.querySelector('#cm').textContent,rect:document.querySelector('#cmX').getBoundingClientRect().toJSON()})`),heldClose,'old offer cancellation cannot repaint through newer held Close');
        assert.equal(await p.ev(`document.activeElement===__leaseClose&&__leaseClose===document.querySelector('#cmX')`),true,'mixed Close retains identity and focus');
        await shot('mixed-close-held');
        await p.ev(`__leasePointer('pointerup',82,__leaseClose);__leaseTouch('touchend',[],__leaseClose);`);await task(p);await task(p);
        assert.match(await p.ev('__gt.cmPanel().sub'),/第 52 天/);
        const beforeClose=await p.ev(WORLD);await p.ev(`__leasePointer('click',82,__leaseClose)`);await task(p);
        assert.equal(await p.ev(`document.querySelector('#cm').hidden`),true);assert.deepEqual(await p.ev(WORLD),beforeClose,'Close has no simulator/save/history side effects');
        assert.equal(await p.ev(`document.querySelector('#cm .card').style.position`),'');
        item.mixedClose={passed:true,events:await p.ev('__leaseEvents')};
      }
      item.passed=true;
    });}catch(error){failures++;item.error=error.stack;console.error(`FAIL seed=${seed} width=${W}`,error.stack);}
    write();console.log(item.passed?'PASS':'FAIL',`synthetic actual-app lease seed=${seed} width=${W}`);
  }
  report.passed=failures===0;write();assert.equal(failures,0,`${failures} actual-app lease cases failed; see ${path.join(OUT,'evidence.json')}`);return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await d081TouchLeaseAppBrowser();

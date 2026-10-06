// QA-only branch: public Pages observer, never a substitute local app.
// Fixtures affect a disposable browser profile only. Touch is emulated, not Android hardware.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ROOT, withBrowser, sleep } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { d045Code } from './d045-cities.mjs';
import { foodExportCode, naturalSpaceUnlockCode } from './d046-cities.mjs';
import { decodeLabCode } from '../src/io/labcode.ts';
import { cmsLoad3d } from '../src/sim/rules/commissionSave.ts';
const SITE='https://lijiabao1998.github.io/GlimmerTown3D-lab/';
const RELEASE='01eecbbfb0bff3d40e0f47d49a61f3419c7ca359';
const EXPECTED='bd3adf4549742af1581cc135c6481f29286565962de2e42ad46b2417639d1341';
const OUT=path.join(ROOT,'scratch/live-d046'), J=JSON.stringify;
const hash=b=>createHash('sha256').update(b).digest('hex');
const cms=(act,acc=0)=>({act,acc,st:140,hold:0,n:0,done:[]});
fs.mkdirSync(OUT,{recursive:true});
const report={site:SITE,release:RELEASE,expectedSha256:EXPECTED,viewport:[412,860],
  mode:'GitHub Actions Chromium + SwiftShader, CDP touch emulation; not Android hardware',
  setup:'Synthetic saved cities are seeded into localStorage in fresh temporary browser profiles. Existing __gt probes inspect state; simStep advances genuine days in two scenarios, never assigns rank/progress. Menu scrolling and screenshot camera positioning are harness setup, not touch-gesture coverage.',
  checks:[],screenshots:[],documentHashes:[]};
const record=(name,ok,detail='')=>{report.checks.push({name,ok,detail});console.log(ok?'OK':'NG',name,detail);};
assert.equal(hash(fs.readFileSync(path.join(ROOT,'dist/index.html'))),EXPECTED,'QA product build must equal approved release');
const response=await fetch(SITE,{redirect:'error',signal:AbortSignal.timeout(30000)});
assert.equal(response.status,200);assert.match(response.headers.get('content-type')??'',/text\/html/);
const live=Buffer.from(await response.arrayBuffer());report.liveSha256=hash(live);report.liveBytes=live.length;
assert.equal(report.liveSha256,EXPECTED,'public Pages bytes must equal approved build');
record('HTTP 200 public HTML equals approved build SHA256',true,EXPECTED);
async function scenario(name,run){
  try{
    await withBrowser({width:960,height:900},async({page})=>{
      const open=async(query='')=>{
        const url=SITE+(query?'?'+query:'');
        const nav=await page.send('Page.navigate',{url});assert.ok(!nav.errorText,nav.errorText);assert.ok(nav.loaderId);
        let ready=false;
        for(let t=Date.now();Date.now()-t<30000;await sleep(150)){
          const current=await page.send('Page.getFrameTree');
          if(current.frameTree.frame.loaderId===nav.loaderId&&await page.evaluate('!!(window.__gt&&__gt.ready)').catch(()=>false)){ready=true;break;}
        }
        assert.ok(ready,'official page ready within 30 seconds');
        assert.equal(await page.evaluate('location.origin+location.pathname'),SITE);
        const tree=await page.send('Page.getResourceTree');
        const resource=await page.send('Page.getResourceContent',{frameId:tree.frameTree.frame.id,url:tree.frameTree.frame.url});
        const sha=hash(Buffer.from(resource.content,resource.base64Encoded?'base64':'utf8'));
        assert.equal(sha,EXPECTED,'actual browser document equals approved build');
        report.documentHashes.push({url:tree.frameTree.frame.url,sha256:sha});await sleep(900);
      };
      const p=await pageSession(page,open,{W:412,H:860});
      const {ev,tapBtn,tapAt,rectOf,key,toasts}=p;
      const tap=async sel=>{
        await ev(`document.querySelector(${J(sel)}).scrollIntoView({block:'center'})`);await p.frames(2);
        const r=await rectOf(sel);assert.ok(!r.hidden&&r.l>=0&&r.r<=412&&r.t>=0&&r.b<=860,'visible touch target '+sel);
        assert.ok(await tapBtn(sel),'touch target '+sel);return r;
      };
      const menu=async id=>{await tap('#menuBtn');await tap(`#menu [data-m="${id}"]`);};
      const shot=async label=>{const r=await page.send('Page.captureScreenshot',{format:'png'});const file=label+'.png';fs.writeFileSync(path.join(OUT,file),Buffer.from(r.data,'base64'));report.screenshots.push(file);};
      const loadFixture=async code=>{
        await p.open('sample=seed516&clean=1');
        await ev(`__gt.clearSave();localStorage.setItem('gt3d.v1.save',${J(code)})`);
        await p.open('');assert.ok(await p.waitFor(async()=>(await toasts()).length===0,5000));
        assert.equal(await ev('innerWidth'),412);assert.equal(await ev('innerHeight'),860);
      };
      await run({p,page,ev,tap,tapAt,rectOf,key,toasts,menu,shot,loadFixture});
      assert.equal(page.errors.length,0,page.errors.join('\n'));
      const external=page.requests.filter(u=>!/^(data:|blob:|about:)/.test(u)&&new URL(u).origin!==new URL(SITE).origin);
      assert.deepEqual(external,[],'no external assets on actual public page');
      assert.ok(page.requests.some(u=>u.startsWith(SITE)),'browser really navigated to Pages');
    });record(name,true);
  }catch(e){record(name,false,e.stack);}
  fs.writeFileSync(path.join(OUT,'report.json'),J(report)+'\n');
}
await scenario('touch import-cancel, feasible offers, repeated touch, automatic save and reload',async({p,page,ev,tap,tapAt,rectOf,key,menu,shot,loadFixture})=>{
  await loadFixture(d045Code({money:5000}));
  const untouched=await ev("JSON.stringify([__gt.simCms(),__gt.history(),localStorage.getItem('gt3d.v1.save')])");
  await menu('paste');await page.send('Input.insertText',{text:'cancelled QA input'});await tap('#dlgNo');
  assert.equal(await ev("document.querySelector('#dlg').hidden"),true);
  assert.equal(await ev("JSON.stringify([__gt.simCms(),__gt.history(),localStorage.getItem('gt3d.v1.save')])"),untouched);
  await menu('commission');const offers=await ev("[...document.querySelectorAll('#cm li[data-kind=offer]')].map(e=>e.dataset.k)");
  assert.equal(offers.length,3);assert.ok(offers.every(k=>!k.startsWith('transit')));await shot('01-live-playable-offers');
  const selector=`#cm li[data-k="${offers[0]}"] button`,r=await tap(selector);assert.ok(r.w>=44&&r.h>=44);
  await tapAt([r.l+r.w/2,r.t+r.h/2]);
  assert.equal((await ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='accept')")).length,1);
  await tap('#cmX');const before=await ev('__gt.simCms()'),money=await ev('__gt.sim().money');
  const hud=await rectOf('#commissionHud');assert.ok(!hud.hidden&&hud.l>=0&&hud.r<=412&&hud.h>=44);
  assert.ok((await rectOf('#toasts')).t>=hud.b+6);await shot('02-live-active-hud');
  await tap('#commissionHud');await key('Escape');assert.equal((await ev('__gt.cmPanel()')).open,false);
  await tap('#commissionHud');await tapAt([4,4]);assert.equal((await ev('__gt.cmPanel()')).open,false);
  assert.ok(await ev("localStorage.getItem('gt3d.v1.save')"));await p.open('');
  assert.deepEqual(await ev('__gt.simCms()'),before);assert.equal(await ev('__gt.sim().money'),money);
  assert.equal((await ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='accept')")).length,1);
  assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth'),true);
});
await scenario('fractional progress: actual UI export/cancel and navigation persistence',async({p,ev,tap,menu,shot,loadFixture})=>{
  await loadFixture(d045Code({money:5000,cms385:cms('steel40',12.5)}));
  assert.match(await ev("document.querySelector('#commissionHud').textContent"),/12\.5 \/ 40/);
  await tap('#commissionHud');await shot('03-live-fractional-progress');await tap('#cmX');
  await menu('export');const code=await ev("document.querySelector('#dlg textarea').value");
  const decoded=decodeLabCode(code);assert.ok(decoded.ok,decoded.error);
  assert.equal(decoded.save.raw.cms385.acc,12);assert.equal(cmsLoad3d(decoded.save.raw.cms385,decoded.save.raw.cms3d).acc,12.5);await tap('#dlgNo');
  await menu('city:mine'); // selecting the current own city triggers the real saveNow path before reading it
  const saved=decodeLabCode(await ev("localStorage.getItem('gt3d.v1.save')"));assert.ok(saved.ok,saved.error);
  assert.equal(saved.save.raw.cms385.acc,12);assert.equal(cmsLoad3d(saved.save.raw.cms385,saved.save.raw.cms3d).acc,12.5);
  await p.open('');assert.equal((await ev('__gt.simCms()')).acc,12.5);
  await tap('#commissionHud');await tap('#cm li[data-kind=act] button');
  assert.equal((await ev('__gt.simCms()')).act,'');assert.equal(await ev("document.querySelector('#commissionHud').hidden"),true);
});
await scenario('legacy active transit can be touch-dropped without penalty',async({ev,tap,shot,loadFixture})=>{
  await loadFixture(d045Code({money:5000,cms385:cms('transit150')}));await tap('#commissionHud');
  assert.match(await ev("document.querySelector('#cm').textContent"),/無懲罰放棄/);await shot('04-live-legacy-transit');
  const money=await ev('__gt.sim().money');await tap('#cm li[data-kind=act] button');
  assert.equal(await ev('__gt.sim().money'),money);assert.equal((await ev('__gt.simCms()')).act,'');
});
await scenario('genuine daily food-export completion (simStep advancement)',async({ev,menu,shot,loadFixture})=>{
  await loadFixture(foodExportCode());await ev('__gt.simStep(44)');
  assert.equal((await ev('__gt.simCms()')).act,'trade1200');await shot('05-live-export-progress');
  await ev('__gt.simStep(1)');assert.equal((await ev('__gt.simCms()')).act,'');
  assert.equal((await ev("__gt.history().filter(e=>e.t==='cms'&&e.ev==='done'&&e.id==='trade1200')")).length,1);
  await menu('commission');await shot('06-live-export-completed');
});
await scenario('natural Lv22 unlock notice (one real simStep; no rank setter)',async({ev,tap,toasts,shot,loadFixture})=>{
  await loadFixture(naturalSpaceUnlockCode());await ev('__gt.view(31,12,1)');await tap('[data-t=civic]');
  assert.equal(await ev("document.querySelector('[data-c=megaproject]').getAttribute('aria-disabled')"),'true');
  await ev('__gt.simStep(1)');assert.equal((await ev('__gt.rankRep()')).idx,21);
  assert.equal(await ev("document.querySelector('[data-c=megaproject]').getAttribute('aria-disabled')"),null);
  assert.ok((await toasts()).some(t=>t.includes('Lv.22')&&t.includes('解鎖：太空研究中心')));await shot('07-live-natural-unlock');
});
report.passed=report.checks.filter(c=>c.ok).length;report.failed=report.checks.filter(c=>!c.ok).length;
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed:report.failed,site:SITE,sha256:report.liveSha256}));
process.exitCode=report.failed?1:0;

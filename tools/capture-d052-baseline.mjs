// QA-only wrapper. Never merge or deploy this branch.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ROOT, withBrowser } from './cdp.mjs';
import { pageSession } from './smoke-d011.mjs';
import { D052_BASELINE, D052_MODES, D052_SHOTS, d052FixtureManifest } from './d052-scenes.mjs';
import { loadD052, captureD052Scene, d052Hash, D052_SNAPSHOT, D052_UI, D052_CAPTURE_QUALIFICATIONS } from './d052-capture.mjs';
const OUT=path.join(ROOT,'scratch/d052-baseline'),J=JSON.stringify;
fs.mkdirSync(OUT,{recursive:true});
const report={purpose:'D052 genuine before evidence, QA-only, never merge/deploy',baseline:D052_BASELINE,qualifications:D052_CAPTURE_QUALIFICATIONS,synthetic:true,device:'Chrome CDP portrait touch emulation; no Android hardware',cases:[],shots:[],passed:false};
try {
  const html=fs.readFileSync(path.join(ROOT,'dist/index.html'));assert.equal(d052Hash(html),D052_BASELINE.htmlSha256,'exact full baseline HTML bytes');fs.writeFileSync(path.join(OUT,'baseline-index.html'),html);
  fs.writeFileSync(path.join(OUT,'fixture-manifest.json'),J(D052_MODES.map(d052FixtureManifest),null,2));
  for(const mode of D052_MODES) {
    const shot=D052_SHOTS.find(s=>s.mode===mode),width=shot?.width??412,height=shot?.height??860;
    await withBrowser({width:960,height:900},async({page,open})=>{
      const p=await pageSession(page,open,{W:width,H:height,mobile:true});
      try {
        await loadD052(p,mode);const item=await captureD052Scene(p,page,mode,{phase:'before',outDir:OUT});report.cases.push(item);if(item.shot)report.shots.push(item.shot);
        console.log(`PASS ${mode}: ${item.assertions.length} assertion groups${item.shot?' PNG '+item.shot.filename+' sha256='+item.shot.sha256:''}`);
      } catch(e) {
        const failed={mode,passed:false,error:String(e.stack??e)};report.cases.push(failed);console.error(`FAIL ${mode}: ${failed.error}`);
        try {fs.writeFileSync(path.join(OUT,`failure-${mode}.json`),J({state:await p.ev(D052_SNAPSHOT),ui:await p.ev(D052_UI),errors:page.errors,touches:await p.ev('window.__d052Touches??[]')},null,2));const bytes=Buffer.from((await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64');fs.writeFileSync(path.join(OUT,`failure-${mode}.png`),bytes);}catch(debug){failed.debugError=String(debug);}
      }
    });
  }
  report.passed=report.cases.every(c=>c.passed)&&report.shots.length===D052_SHOTS.length;
  console.log(`${report.passed?'PASS':'FAIL'} D052 BASELINE: ${report.shots.length} genuine before screenshots; ${report.cases.filter(c=>c.passed).length}/${report.cases.length} scenarios; synthetic fixtures, original product, no deployment.`);
  if(!report.passed)process.exitCode=1;
}finally{fs.writeFileSync(path.join(OUT,'report.json'),J(report,null,2));}

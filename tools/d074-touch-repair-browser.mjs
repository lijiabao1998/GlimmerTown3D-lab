// D074 bounded repair: unmodified D052 trusted-input suite on both art paths.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ROOT,withBrowser} from './cdp.mjs';
import {d052Smoke} from './smoke-d052.mjs';

const mode=process.argv[2];
assert.ok(['legacy','current'].includes(mode),'explicit art path is required');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(fs.readFileSync(path.join(ROOT,'tools/smoke-d052.mjs'))),'1775d0302219894d998df34efe36f3dbcd884d056fe5ab2b5aaa5fc5865654ac','original native D052 assertions are unchanged');
const out=path.join(ROOT,'scratch/d074-touch-repair',mode);
fs.mkdirSync(out,{recursive:true});
const report={mode,sourceSha:sha(fs.readFileSync(path.join(ROOT,'src/ui/panelPress.ts'))),htmlSha:sha(fs.readFileSync(path.join(ROOT,'dist/index.html'))),checks:[],shots:[],passed:false};
let bad=0;
const log=(ok,name,detail='')=>{report.checks.push({ok,name,detail});console.log(ok?'OK':'NG',name,detail);if(!ok)bad++;};
const browser=mode==='legacy'?(opt,fn)=>withBrowser(opt,({page,open})=>fn({page,open:q=>open(q+(q?'&':'')+'streetArt=legacy')})):withBrowser;
try {
  await d052Smoke(browser,log);
  assert.equal(bad,0,'every original D052 check must pass');
  const raw=fs.readFileSync(path.join(ROOT,'scratch/shots/D052-evidence.json'));
  const evidence=JSON.parse(raw);
  assert.equal(evidence.sessions.length,20,'all original native sessions execute');
  assert.equal(evidence.shots.length,6,'all original UI shots exist');
  fs.writeFileSync(path.join(out,'D052-evidence.json'),raw);
  const pins=JSON.parse(fs.readFileSync(path.join(ROOT,'fixtures/d074-touch-repair-ui.json'),'utf8'));
  assert.equal(pins.baseline,'beca506c224ad72f9a890ed20b5aa1fa7b2616f5');
  assert.equal(pins.htmlSha,'3d0809c50a4a3233f89b84ff5f97941374bdb95706b9cf2fb2a188a84261ab3d');
  assert.deepEqual(evidence.shots.map(s=>s.filename).sort(),Object.keys(pins.shots).sort());
  for(const shot of evidence.shots){
    const bytes=fs.readFileSync(path.join(ROOT,'scratch/shots',shot.filename));
    const actual=sha(bytes);
    assert.equal(actual,shot.sha256,'saved PNG matches original native evidence');
    if(mode==='legacy')assert.equal(actual,pins.shots[shot.filename],'historical UI remains byte-identical: '+shot.filename);
    fs.writeFileSync(path.join(out,shot.filename),bytes);
    report.shots.push({filename:shot.filename,sha256:actual,bytes:bytes.length,viewport:shot.viewport});
  }
  report.passed=true;
}catch(error){report.error={name:error.name,message:error.message,stack:error.stack};console.error(error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(report,null,2)+'\n');}

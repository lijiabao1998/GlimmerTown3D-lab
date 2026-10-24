import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {withBrowser,ROOT} from '../cdp.mjs';
const out=path.join(ROOT,'scratch/d082-previews');fs.mkdirSync(out,{recursive:true});
const evidence={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),status:'ISOLATED STUDIO REVIEW; NOT PRODUCTION INTEGRATION',files:{},shots:[]};
for(const f of ['models.ts','review.ts','index.html'])evidence.files[f]=createHash('sha256').update(fs.readFileSync(path.join(ROOT,'tools/d082',f))).digest('hex');
await withBrowser({root:path.join(ROOT,'scratch/d082-review'),port:8497,width:1600,height:1100,ready:'window.__d082?.ready===true'},async({page,open})=>{
 for(const [name,query] of [['front','turn=0'],['rear','turn=3.141592653589793']]){
  await open(query);const actual=await page.evaluate('window.__d082');if(actual.models.length!==10)throw Error('ten actual models required');
  const {data}=await page.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});const bytes=Buffer.from(data,'base64');fs.writeFileSync(path.join(out,`D082-${name}.png`),bytes);evidence.shots.push({name,...actual,sha256:createHash('sha256').update(bytes).digest('hex')});
 }
 if(page.errors.length)throw Error(JSON.stringify(page.errors));
 evidence.externalRequests=page.requests.filter(u=>!u.startsWith('http://127.0.0.1:8497/'));if(evidence.externalRequests.length)throw Error('external requests');
});
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({output:out,shots:evidence.shots.length,models:evidence.shots[0].models.length}));

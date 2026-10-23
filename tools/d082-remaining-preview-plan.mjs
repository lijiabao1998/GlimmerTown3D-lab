// Node-only planning diagnostic; it is never counted as captured coverage.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {createOracle,VIEWPORTS} from './d082-remaining-preview-support.mjs';
import {planSupplementaryViews} from './d082-remaining-preview-views.mjs';
const accepted=await import(pathToFileURL(path.join(process.env.D082_ACCEPTED_ROOT,'tools/d082-redesign-support.mjs'))),vp=VIEWPORTS.find(v=>v.W===412),m=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/evidence/D082-remaining-proposal/accepted-manifest-412.json'))),rows=[];
for(const[k,v]of [[185,0],[185,1],[185,2],[154,0]]){const standard=m.shots.filter(s=>s.phase==='after'&&s.k===k&&s.v===v&&s.role==='prototype'),a=accepted.createOracle('gallery',true,v),b=createOracle('gallery',true,v);try{const {plan}=planSupplementaryViews(a,b,standard[0],vp,standard);rows.push(plan);console.log(JSON.stringify({slot:plan.slot,required:plan.required,originalUncovered:plan.originalUncovered,priorViewMissing:plan.missingAfterRetainedPriorViews,remaining:plan.remaining,selected:plan.selected.map(s=>({view:s.view.id,prior:Boolean(s.retainedPriorActualView),gain:s.gain}))}));}finally{a.dispose();b.dispose();}}
fs.mkdirSync(path.join(ROOT,'scratch/d082-remaining-plan'),{recursive:true});fs.writeFileSync(path.join(ROOT,'scratch/d082-remaining-plan/412.json'),JSON.stringify({qualification:'Analytical only; no actual PNG claim.',rows},null,2));

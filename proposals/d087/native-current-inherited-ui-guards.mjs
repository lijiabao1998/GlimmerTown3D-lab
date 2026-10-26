// D087 finite current contract. Original proposals/d086/current-inherited-ui-guards.mjs is unchanged at b4275bda73e72a9fb48343376fccaab52bbc8e84.
// All original behavioral assertions, against actual current source. Only finite
// new imported dependency injections differ from immutable original harnesses.
import fs from'node:fs';import assert from'node:assert/strict';import{assertD087CurrentGuardVersions}from'../../tools/d087-current-guards.mjs';
assertD087CurrentGuardVersions();const report={qualification:'Current inherited actual-source UI regressions; not browser/render acceptance.',checks:[],passed:false};
const log=(passed,name,error)=>{report.checks.push({passed,name,error});console.log(passed?'OK':'FAIL',name,error??'');};
for(const[file,name]of [['unit-d052-d087.mjs','d052Guards'],['unit-d054-ui-d087.mjs','d054UiGuards'],['unit-d081-touch-lease-d087.mjs','d081TouchLeaseGuards']]){const m=await import('../../tools/'+file);await m[name](log);}
report.passed=report.checks.length===38&&report.checks.every(r=>r.passed);fs.mkdirSync('scratch/d087-native/current-inherited-ui',{recursive:true});const out='scratch/d087-native/current-inherited-ui/current-inherited-ui.json';assert.ok(!fs.existsSync(out),'preserve actual-source receipt');fs.writeFileSync(out,JSON.stringify(report,null,2));assert.ok(report.passed);console.log('PASS actual current inherited UI',report.checks.length);

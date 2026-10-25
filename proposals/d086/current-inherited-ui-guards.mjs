// All original behavioral assertions, against actual current source. Only finite
// new imported dependency injections differ from immutable original harnesses.
import fs from'node:fs';import assert from'node:assert/strict';import{assertD086CurrentGuardVersionsV2}from'../../tools/d086-current-guards-v2.mjs';
assertD086CurrentGuardVersionsV2();const report={qualification:'Current inherited actual-source UI regressions; not browser/render acceptance.',checks:[],passed:false};
const log=(passed,name,error)=>{report.checks.push({passed,name,error});console.log(passed?'OK':'FAIL',name,error??'');};
for(const[file,name]of [['unit-d052-d086.mjs','d052Guards'],['unit-d054-ui-d086.mjs','d054UiGuards'],['unit-d081-touch-lease-d086.mjs','d081TouchLeaseGuards']]){const m=await import('../../tools/'+file);await m[name](log);}
report.passed=report.checks.length===38&&report.checks.every(r=>r.passed);fs.mkdirSync('scratch/d086-native-variant',{recursive:true});const out='scratch/d086-native-variant/current-inherited-ui.json';assert.ok(!fs.existsSync(out),'preserve actual-source receipt');fs.writeFileSync(out,JSON.stringify(report,null,2));assert.ok(report.passed);console.log('PASS actual current inherited UI',report.checks.length);

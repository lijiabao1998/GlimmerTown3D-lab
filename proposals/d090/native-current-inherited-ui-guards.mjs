// D090 finite current contract. Original proposals/d089/native-current-inherited-ui-guards.mjs remains byte-exact at 5b41bac165ba2b29146e6835490357bebc3cd549.
// D089 finite current contract. Original proposals/d088/native-current-inherited-ui-guards.mjs remains byte-exact at c023a2da0e4999d43e3d4216e800c4c96d06a3c1.
// D088 finite current contract. Original proposals/d087/native-current-inherited-ui-guards.mjs remains byte-exact at cdd541da74973dba2ca73b782936c012d315add9.
// D087 finite current contract. Original proposals/d086/current-inherited-ui-guards.mjs is unchanged at b4275bda73e72a9fb48343376fccaab52bbc8e84.
// All original behavioral assertions, against actual current source. Only finite
// new imported dependency injections differ from immutable original harnesses.
import fs from'node:fs';import assert from'node:assert/strict';import{assertD090CurrentGuardVersions}from'../../tools/d090-current-guards.mjs';
assertD090CurrentGuardVersions();const report={qualification:'Current inherited actual-source UI regressions; not browser/render acceptance.',checks:[],passed:false};
const log=(passed,name,error)=>{report.checks.push({passed,name,error});console.log(passed?'OK':'FAIL',name,error??'');};
for(const[file,name]of [['unit-d052-d090.mjs','d052Guards'],['unit-d054-ui-d090.mjs','d054UiGuards'],['unit-d081-touch-lease-d090.mjs','d081TouchLeaseGuards']]){const m=await import('../../tools/'+file);await m[name](log);}
report.passed=report.checks.length===38&&report.checks.every(r=>r.passed);fs.mkdirSync('scratch/d090-native/current-inherited-ui',{recursive:true});const out='scratch/d090-native/current-inherited-ui/current-inherited-ui.json';assert.ok(!fs.existsSync(out),'preserve actual-source receipt');fs.writeFileSync(out,JSON.stringify(report,null,2));assert.ok(report.passed);console.log('PASS actual current inherited UI',report.checks.length);

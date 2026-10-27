import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const baseline='5b41bac165ba2b29146e6835490357bebc3cd549',read=f=>fs.readFileSync(f,'utf8'),sha=x=>createHash('sha256').update(x).digest('hex'),priorPath='proposals/d089/inherited-test-domains.json';
const replacements={
 '.github/scripts/ci-integrity-d089.test.mjs':['.github/scripts/ci-integrity-d090.test.mjs'],
 'tools/d083-release-trigger-d089.test.mjs':['tools/d083-release-trigger-d090.test.mjs'],
 'tools/d085-source-d089.test.mjs':['tools/d085-source-d090.test.mjs'],
 'tools/d089-source.test.mjs':['tools/d090-source.test.mjs'],
 'tools/d089-validation.test.mjs':['tools/d090-validation.test.mjs'],
 'tools/d089-native-workflow.test.mjs':['tools/d090-native-workflow.test.mjs'],
 'proposals/d087/native-variant-d089.test.mjs':['proposals/d087/native-variant-d090.test.mjs'],
 'proposals/d087/native-farm-precedence-d089.test.mjs':['proposals/d087/native-farm-precedence-d090.test.mjs'],
 'proposals/d088/native-integration-d089.test.mjs':['proposals/d088/native-integration-d090.test.mjs'],
 'proposals/d088/native-ui-actions-d089.test.mjs':['proposals/d088/native-ui-actions-d090.test.mjs'],
 'tools/d089-native-catalogue.test.mjs':['tools/d089-native-catalogue-d090.test.mjs','tools/d090-native-catalogue.test.mjs'],
 'tools/d089-native-routing.test.mjs':['tools/d090-native-routing.test.mjs'],
 'tools/d089-native-ui-actions.test.mjs':['tools/d089-native-ui-actions-d090.test.mjs','tools/d090-native-ui-actions.test.mjs'],
 'tools/d089-native-scene-dispatch.test.mjs':['tools/d089-native-scene-dispatch-d090.test.mjs','tools/d090-native-scene-dispatch.test.mjs'],
 'proposals/d089/inherited-test-contract.test.mjs':['proposals/d090/inherited-test-contract.test.mjs'],
 'proposals/d089/native-farm-precedence-copy.test.mjs':['proposals/d090/native-farm-precedence-copy.test.mjs'],
 'proposals/d089/native-smoke-versions.test.mjs':['proposals/d090/native-smoke-versions.test.mjs'],
 'proposals/d089/native-version-contracts.test.mjs':['proposals/d090/native-version-contracts.test.mjs'],
 'proposals/d089/original-camera-restoration.test.mjs':['proposals/d090/original-camera-restoration.test.mjs'],
 'proposals/d089/source-boundaries.test.mjs':['proposals/d090/source-boundaries.test.mjs'],
 'tools/d089-native-lifecycle.test.mjs':['tools/d089-native-lifecycle-d090.test.mjs','tools/d090-native-lifecycle.test.mjs'],
};
const originals=execFileSync('git',['ls-tree','-r','--name-only',baseline,'tools','proposals/d089'],{encoding:'utf8'}).trim().split('\n').filter(f=>/^tools\/d089-.*\.test\.mjs$|^proposals\/d089\/.*\.test\.mjs$/.test(f));assert.equal(originals.length,30);
const records=originals.map(file=>{assert.equal(read(file),execFileSync('git',['show',baseline+':'+file],{encoding:'utf8',maxBuffer:32e6}));return{file,sha256:sha(read(file)),domain:replacements[file]?'actual-immutable-5b41':'actual-current',currentCoverage:replacements[file]??[file]};});assert.equal(records.filter(r=>r.domain==='actual-current').length,16);
const extras=Object.keys(replacements).filter(f=>!originals.includes(f)).map(file=>({file,sha256:sha(read(file)),domain:'actual-immutable-5b41'}));assert.equal(extras.length,7);
const currentAdditions=['.github/scripts/ci-integrity-d090.test.mjs','tools/d083-release-trigger-d090.test.mjs','tools/d085-source-d090.test.mjs','tools/d090-source.test.mjs','tools/d090-validation.test.mjs','tools/d090-native-workflow.test.mjs','proposals/d090/inherited-test-contract.test.mjs','proposals/d090/native-version-contracts.test.mjs','tools/d090-native-lifecycle.test.mjs','tools/d090-native-catalogue.test.mjs','tools/d090-native-routing.test.mjs','tools/d090-native-ui-actions.test.mjs','tools/d090-native-scene-dispatch.test.mjs','proposals/d090/native-smoke-versions.test.mjs','proposals/d090/source-boundaries.test.mjs','proposals/d090/original-camera-restoration.test.mjs','proposals/british-program/ledger-current-v5.test.mjs','proposals/d090/native-farm-precedence-copy.test.mjs','proposals/d087/native-farm-precedence-d090.test.mjs','tools/d089-native-catalogue-d090.test.mjs','tools/d089-native-ui-actions-d090.test.mjs','tools/d089-native-scene-dispatch-d090.test.mjs','tools/d089-native-lifecycle-d090.test.mjs'];
const m={schema:1,baseline,priorManifest:priorPath,priorManifestSha256:sha(read(priorPath)),qualification:'All previous immutable domains and compatible current assertions retained. Exactly fourteen D089 source-version assertions execute actual immutable5b with named current replacements; sixteen compatible D089 originals remain current; original old11 lifecycle executes immutable5b and the exact finite metadata/catalogue copy executes all lifecycle assertions on current200. Current old D083/D086/D087/D088/D089 native behavior and full old190 bytes are mandatory independently. No read interception or blanket historical substitution.',originalCommand:'node --test tools/d089-*.test.mjs proposals/d089/*.test.mjs proposals/british-program/ledger-check.test.mjs proposals/british-program/ledger-current.test.mjs proposals/british-program/ledger-current-v3.test.mjs proposals/british-program/ledger-current-v4.test.mjs',d089Originals:records,published5bExtraHistorical:extras,currentReplacements:replacements,currentAdditions,currentLedgerSnapshots:[...JSON.parse(read(priorPath)).currentLedgerSnapshots,'proposals/british-program/ledger-current-v4.test.mjs'],currentCopies:JSON.parse(read('proposals/d090/inherited-validation-copies.json')).copies};
const bytes=JSON.stringify(m,null,2)+'\n',file='proposals/d090/inherited-test-domains.json';if(fs.existsSync(file))assert.equal(read(file),bytes);else fs.writeFileSync(file,bytes);console.log('D090_DOMAIN_SHA',sha(bytes));

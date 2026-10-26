import fs from'node:fs';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const baseline='c023a2da0e4999d43e3d4216e800c4c96d06a3c1',read=f=>fs.readFileSync(f,'utf8'),sha=x=>createHash('sha256').update(x).digest('hex'),priorPath='proposals/d088/inherited-test-domains.json';
const replacements={
 '.github/scripts/ci-integrity-d088.test.mjs':['.github/scripts/ci-integrity-d089.test.mjs'],
 'tools/d083-release-trigger-d088.test.mjs':['tools/d083-release-trigger-d089.test.mjs'],
 'tools/d085-source-d088.test.mjs':['tools/d085-source-d089.test.mjs'],
 'tools/d088-source.test.mjs':['tools/d089-source.test.mjs'],
 'tools/d088-validation.test.mjs':['tools/d089-validation.test.mjs'],
 'tools/d088-native-workflow.test.mjs':['tools/d089-native-workflow.test.mjs'],
 'proposals/d087/native-variant-d088.test.mjs':['proposals/d087/native-variant-d089.test.mjs'],
 'proposals/d087/native-farm-precedence.test.mjs':['proposals/d087/native-farm-precedence-d089.test.mjs'],
 'proposals/d088/native-integration.test.mjs':['proposals/d088/native-integration-d089.test.mjs','tools/d089-native-lifecycle.test.mjs','tools/d089-native-catalogue.test.mjs'],
 'proposals/d088/native-routing.test.mjs':['tools/d089-native-routing.test.mjs'],
 'proposals/d088/native-ui-actions.test.mjs':['proposals/d088/native-ui-actions-d089.test.mjs','tools/d089-native-ui-actions.test.mjs'],
 'proposals/d088/native-smoke-versions.test.mjs':['proposals/d089/native-smoke-versions.test.mjs'],
 'proposals/d088/native-version-contracts.test.mjs':['proposals/d089/native-version-contracts.test.mjs'],
 'proposals/d088/original-camera-restoration.test.mjs':['proposals/d089/original-camera-restoration.test.mjs'],
 'proposals/d088/source-boundaries.test.mjs':['proposals/d089/source-boundaries.test.mjs'],
};
const originals=execFileSync('git',['ls-tree','-r','--name-only',baseline,'tools','proposals/d088'],{encoding:'utf8'}).trim().split('\n').filter(f=>/^tools\/d088-.*\.test\.mjs$|^proposals\/d088\/.*\.test\.mjs$/.test(f));assert.equal(originals.length,28);
const records=originals.map(file=>{assert.equal(read(file),execFileSync('git',['show',baseline+':'+file],{encoding:'utf8',maxBuffer:32e6}));return{file,sha256:sha(read(file)),domain:replacements[file]?'actual-immutable-c023':'actual-current',currentCoverage:replacements[file]??[file]};});
assert.equal(records.filter(r=>r.domain==='actual-current').length,18);
const extras=Object.keys(replacements).filter(f=>!originals.includes(f)).map(file=>({file,sha256:sha(read(file)),domain:'actual-immutable-c023'}));
const currentAdditions=['.github/scripts/ci-integrity-d089.test.mjs','tools/d083-release-trigger-d089.test.mjs','tools/d085-source-d089.test.mjs','tools/d089-source.test.mjs','tools/d089-validation.test.mjs','tools/d089-native-workflow.test.mjs','proposals/d089/inherited-test-contract.test.mjs','proposals/d089/native-version-contracts.test.mjs','tools/d089-native-lifecycle.test.mjs','tools/d089-native-catalogue.test.mjs','tools/d089-native-routing.test.mjs','tools/d089-native-ui-actions.test.mjs','proposals/d089/native-smoke-versions.test.mjs','proposals/d089/source-boundaries.test.mjs','proposals/d089/original-camera-restoration.test.mjs','proposals/british-program/ledger-current-v4.test.mjs','tools/d089-native-scene-dispatch.test.mjs','proposals/d089/native-farm-precedence-copy.test.mjs','proposals/d087/native-farm-precedence-d089.test.mjs'];
const m={schema:1,baseline,priorManifest:priorPath,priorManifestSha256:sha(read(priorPath)),qualification:'All prior immutable domains and compatible current assertions retained. Exactly ten D088 source-version contracts run on actual c023 with named independently exercised current replacements; eighteen D088 originals remain actual-current. No read interception or blanket historical substitution.',originalCommand:'node --test tools/d088-*.test.mjs proposals/d088/*.test.mjs proposals/british-program/ledger-check.test.mjs proposals/british-program/ledger-current.test.mjs proposals/british-program/ledger-current-v3.test.mjs',d088Originals:records,c023ExtraHistorical:extras,currentReplacements:replacements,currentAdditions,currentLedgerSnapshots:['proposals/british-program/ledger-check.test.mjs','proposals/british-program/ledger-current.test.mjs','proposals/british-program/ledger-current-v3.test.mjs'],currentCopies:JSON.parse(read('proposals/d089/inherited-validation-copies.json')).copies};
const bytes=JSON.stringify(m,null,2)+'\n',file='proposals/d089/inherited-test-domains.json';if(fs.existsSync(file))assert.equal(read(file),bytes);else fs.writeFileSync(file,bytes);console.log('D089_DOMAIN_SHA',sha(bytes));

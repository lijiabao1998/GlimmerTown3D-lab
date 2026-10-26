import fs from 'node:fs';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
const baseline='cdd541da74973dba2ca73b782936c012d315add9',sha=x=>createHash('sha256').update(x).digest('hex'),read=f=>fs.readFileSync(f,'utf8'),prior=JSON.parse(read('proposals/d087/inherited-test-domains.json'));
const cddOnly={
 'proposals/d087/current-smoke-boundary.test.mjs':['proposals/d088/native-smoke-versions.test.mjs','tools/d088-validation.test.mjs'],
 'proposals/d087/native-smoke-versions.test.mjs':['proposals/d088/native-smoke-versions.test.mjs'],
 'proposals/d087/native-variant.test.mjs':['proposals/d087/native-variant-d088.test.mjs'],
 'proposals/d087/original-camera-restoration.test.mjs':['proposals/d088/original-camera-restoration.test.mjs'],
 'proposals/d087/source-boundaries.test.mjs':['proposals/d088/source-boundaries.test.mjs'],
 'proposals/d087/workflow-contract.test.mjs':['tools/d088-validation.test.mjs'],
 'tools/d087-coastal-current-guard.test.mjs':['proposals/d088/native-version-contracts.test.mjs','proposals/d088/native-routing.test.mjs'],
 'tools/d087-current-guards.test.mjs':['proposals/d088/native-version-contracts.test.mjs'],
 'tools/d087-kind-metadata-contract.test.mjs':['proposals/d088/native-version-contracts.test.mjs','proposals/d088/native-integration.test.mjs'],
 'tools/d087-source.test.mjs':['tools/d088-source.test.mjs'],
 'tools/d087-validation.test.mjs':['tools/d088-validation.test.mjs'],
};
const originals=execFileSync('git',['ls-tree','-r','--name-only',baseline,'tools','proposals/d087'],{encoding:'utf8'}).trim().split('\n').filter(f=>/^tools\/d087-.*\.test\.mjs$|^proposals\/d087\/.*\.test\.mjs$/.test(f));assert.equal(originals.length,28);
const d087Originals=originals.map(file=>({file,sha256:sha(read(file)),domain:cddOnly[file]?'actual-immutable-cdd':'actual-current',currentCoverage:cddOnly[file]??[file]}));
for(const r of d087Originals)assert.equal(read(r.file),execFileSync('git',['show',baseline+':'+r.file],{encoding:'utf8',maxBuffer:32e6}));
const d086Originals=prior.originalTests.map(r=>({...r,current:r.current==='tools/d083-release-trigger-d087.test.mjs'?'tools/d083-release-trigger-d088.test.mjs':r.current}));
const extras=['.github/scripts/ci-integrity-d087.test.mjs','tools/d083-release-trigger-d087.test.mjs','tools/d085-source-d087.test.mjs'].map(file=>({file,sha256:sha(read(file)),domain:'actual-immutable-cdd'}));
const currentAdditions=['.github/scripts/ci-integrity-d088.test.mjs','tools/d083-release-trigger-d088.test.mjs','tools/d085-source-d088.test.mjs','tools/d088-source.test.mjs','tools/d088-validation.test.mjs','proposals/d088/inherited-test-contract.test.mjs','proposals/d088/native-version-contracts.test.mjs','proposals/d088/native-integration.test.mjs','proposals/d088/native-routing.test.mjs','proposals/d088/native-ui-actions.test.mjs','proposals/d088/native-smoke-versions.test.mjs','proposals/d088/source-boundaries.test.mjs','proposals/d088/original-camera-restoration.test.mjs','proposals/british-program/ledger-current-v3.test.mjs'];
const m={schema:1,baseline,priorBaseline:prior.baseline,priorManifest:'proposals/d087/inherited-test-domains.json',priorManifestSha256:sha(read('proposals/d087/inherited-test-domains.json')),qualification:'Explicit finite source-version domains; all30 D086-compatible and17 D087-compatible original files run on actual current runtime. Every obsolete version test runs against its actual immutable tree, with named current replacement coverage; no source reader interception.',originalCommands:{d086:prior.originalCommand,d087:'node --test tools/d087-*.test.mjs proposals/d087/*.test.mjs proposals/british-program/ledger-check.test.mjs proposals/british-program/ledger-current.test.mjs'},d086Originals,d087Originals,b427ExtraHistorical:prior.extraHistorical,cddExtraHistorical:extras,currentLedgerSnapshots:['proposals/british-program/ledger-check.test.mjs','proposals/british-program/ledger-current.test.mjs'],currentAdditions,currentCopies:JSON.parse(read('proposals/d088/inherited-validation-copies.json')).copies};
const bytes=JSON.stringify(m,null,2)+'\n',file='proposals/d088/inherited-test-domains.json';if(fs.existsSync(file))assert.equal(read(file),bytes);else fs.writeFileSync(file,bytes);console.log('DOMAIN',sha(bytes));

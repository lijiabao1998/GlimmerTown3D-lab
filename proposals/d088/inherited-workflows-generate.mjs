// Six exact additive inherited workflow evolutions. New D088 workflow is owned
// separately; its main release dependency is mandatory here, never optional.
import fs from 'node:fs';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url)),baseline='cdd541da74973dba2ca73b782936c012d315add9',sha=x=>createHash('sha256').update(x).digest('hex');
const addedGate=`  d088-native-release:
    if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'
    permissions:
      contents: read
      actions: read
    uses: ./.github/workflows/d088-native.yml

`;
const specs=[
 ['.github/workflows/ci.yml',[
 ['.github/scripts/ci-integrity-d087.test.mjs','.github/scripts/ci-integrity-d088.test.mjs',1],
 ['tools/d055-capture-d087.mjs','tools/d055-capture-d088.mjs',1],
 ['  pages:\n',addedGate+'  pages:\n',1],
 ['d087-native-release, d083-native-release]','d087-native-release, d088-native-release, d083-native-release]',1]]],
 ['.github/workflows/d086-native.yml',[
 ['node proposals/d087/inherited-test-runner.mjs','node proposals/d088/inherited-test-runner.mjs --suite=d086',1],
 ['node proposals/d086/native-variant-check-d087.mjs','node proposals/d086/native-variant-check-d088.mjs',1],
 ['Current catalogue54 retains all original43 interactions and negative controls','Current catalogue65 retains all original54 interactions and negative controls',1],
 ['node tools/unit-d053-d087.mjs','node tools/unit-d053-d088.mjs',1],
 ['node proposals/d087/native-current-food-guards.mjs','node proposals/d088/native-current-food-guards.mjs',1],
 ['node proposals/d087/native-current-inherited-ui-guards.mjs','node proposals/d088/native-current-inherited-ui-guards.mjs',1],
 ['node proposals/d086/native-browser-v6-check-d087.mjs','node proposals/d086/native-browser-v6-check-d088.mjs',1],
 ['            scratch/d087-inherited-tests/','            scratch/d087-inherited-tests/\n            scratch/d088-inherited-tests-d086/\n            scratch/d088-native/',1]]],
 ['.github/workflows/d087-native.yml',[
 ['node --test tools/d087-*.test.mjs proposals/d087/*.test.mjs proposals/british-program/ledger-check.test.mjs proposals/british-program/ledger-current.test.mjs','node proposals/d088/inherited-test-runner.mjs --suite=d087',1],
 ['node proposals/d083/native-integration-check-d087.mjs','node proposals/d083/native-integration-check-d088.mjs',1],
 ['node proposals/d086/native-variant-check-d087.mjs','node proposals/d086/native-variant-check-d088.mjs',1],
 ['node proposals/d087/native-current-inherited-ui-guards.mjs','node proposals/d088/native-current-inherited-ui-guards.mjs',1],
 ['node proposals/d087/native-browser-check.mjs','node proposals/d087/native-browser-check-d088.mjs',1],
 ['            scratch/d087-*/','            scratch/d087-*/\n            scratch/d088-inherited-tests-d087/\n            scratch/d088-native/',1]]],
 ['.github/workflows/d083-native.yml',[
 ['tools/d083-release-trigger-d087.test.mjs','tools/d083-release-trigger-d088.test.mjs',1],
 ['proposals/d083/native-integration-check-d087.mjs','proposals/d083/native-integration-check-d088.mjs',1],
 ['proposals/d083/native-browser-check-d087.mjs','proposals/d083/native-browser-check-d088.mjs',1],
 ['            scratch/d087-native/d083-current/','            scratch/d087-native/d083-current/\n            scratch/d088-native/d083-current/',1]]],
 ['.github/workflows/d085-control.yml',[["tools/d085-source-d087.test.mjs","tools/d085-source-d088.test.mjs",1]]],
 ['.github/workflows/d056-art.yml',[["tools/d055-capture-d087.mjs","tools/d055-capture-d088.mjs",1]]]
];
const workflows=[];for(const[file,changes]of specs){const before=execFileSync('git',['show',baseline+':'+file],{cwd:ROOT,encoding:'utf8'});let after=before;for(const[a,b,count]of changes){assert.equal(after.split(a).length-1,count,file+' exact finite seam '+a);after=after.split(a).join(b);}const url=new URL('../../'+file,import.meta.url),actual=fs.readFileSync(url,'utf8');assert.ok(actual===before||actual===after,'refuse overwrite unowned workflow edits '+file);if(actual!==after)fs.writeFileSync(url,after);workflows.push({file,before,beforeSha256:sha(before),afterSha256:sha(after),changes:changes.map(([before,after,count])=>({before,after,count}))});}
const bytes=JSON.stringify({schema:1,baseline,workflows},null,2)+'\n',out=new URL('./inherited-workflow-deltas.json',import.meta.url);if(fs.existsSync(out))assert.equal(fs.readFileSync(out,'utf8'),bytes);else fs.writeFileSync(out,bytes);console.log('D088 inherited workflow delta',sha(bytes));

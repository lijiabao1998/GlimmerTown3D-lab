// D086 current-version contract. Original tools/d083-release-trigger.test.mjs remains unchanged and tested on77b8616.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const native=fs.readFileSync(new URL('../.github/workflows/d083-native.yml',import.meta.url),'utf8');
const ci=fs.readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
const block=(s,name)=>new RegExp('\\n  '+name+':\\n[\\s\\S]*?(?=\\n  [a-z][a-z0-9-]*:\\n|$)').exec(s)?.[0]??'';
function assertReleaseGraph(s,n){
 assert.match(n,/\n  workflow_call:\n/,'native supports the same-repository reusable entry');
 assert.ok(n.includes("branches: ['codex/d083-british-local-design']"),'standalone main push does not duplicate/cancel the main call');
 assert.match(n,/pull_request:\n    branches: \['main', 'codex\/d083-isolated-compat-20261023'\]/);
 const gate=block(s,'d083-native-release'),pages=block(s,'pages');
 assert.match(gate,/uses: \.\/\.github\/workflows\/d083-native.yml\n/,'same-SHA local reusable workflow');
 assert.match(gate,/if: github.ref == 'refs\/heads\/main' && github.event_name != 'pull_request'\n/,'main publication paths invoke native');
 assert.match(gate,/permissions:\n      contents: read\n      actions: read\n/,'same existing native read-only permissions');
 assert.doesNotMatch(gate,/continue-on-error|secrets:|write|needs:/);
 const needs=/needs: \[([^\]]+)\]/.exec(pages)?.[1].split(', ');
 assert.ok(needs?.includes('d083-native-release'),'Pages must depend on native success');
 assert.doesNotMatch(pages,/always\(\)|continue-on-error/,'default success semantics fail closed');
 assert.match(n,/permissions:\n  contents: read\n  actions: read\n/);
 for(const needle of ['width: [1440, 412, 360]','proposals/d083/native-browser-check-d087.mjs','proposals/d083/native-legacy-ui-check.mjs','proposals/d083/native-integration-check-d087.mjs','proposals/d083/native-envelope-check.mjs','sha256sum --check dist/index.sha256','needs.native-and-build.outputs.artifact-id','test "$(cat dist/source-commit.txt)" = "$GITHUB_SHA"'])assert.ok(n.includes(needle),needle);
 assert.doesNotMatch(n,/continue-on-error|always\(\).*success/);
 assert.equal((n.match(/persist-credentials: false/g)||[]).length,3);
}
test('PR native and main Pages use mandatory exact-SHA native qualification',()=>assertReleaseGraph(ci,native));
for(const [name,mutate] of [
 ['missing native dependency',s=>s.replace(', d083-native-release] ','] ').replace(', d083-native-release]',']')],
 ['optional Pages',s=>s.replace("  pages:\n","  pages:\n    continue-on-error: true\n")],
 ['failure-bypassing Pages',s=>s.replace(/(  pages:\n[\s\S]*?    if: )/,'$1always() && ')],
 ['wrong source workflow',s=>s.replace('uses: ./.github/workflows/d083-native.yml','uses: other/repo/.github/workflows/native.yml@main')],
 ['wrong branch condition',s=>s.replace("if: github.ref == 'refs/heads/main' && github.event_name != 'pull_request'\n    permissions:","if: github.ref == 'refs/heads/other' && github.event_name != 'pull_request'\n    permissions:")],
 ['expanded permission',s=>s.replace('      actions: read','      actions: write')],
 ['optional native',s=>s.replace('  d083-native-release:\n','  d083-native-release:\n    continue-on-error: true\n')],
])test('release graph rejects '+name,()=>assert.throws(()=>assertReleaseGraph(mutate(ci),native)));
for(const [name,mutate] of [
 ['missing reusable trigger',s=>s.replace('  workflow_call:\n','')],
 ['missing source check',s=>s.replace('test "$(cat dist/source-commit.txt)" = "$GITHUB_SHA"','true')],
 ['missing native browser',s=>s.replace('proposals/d083/native-browser-check-d087.mjs','other.mjs')],
 ['missing width',s=>s.replace('width: [1440, 412, 360]','width: [1440, 412]')],
 ['duplicate main push',s=>s.replace("branches: ['codex/d083-british-local-design']","branches: ['main', 'codex/d083-british-local-design']")],
])test('native release rejects '+name,()=>assert.throws(()=>assertReleaseGraph(ci,mutate(native))));

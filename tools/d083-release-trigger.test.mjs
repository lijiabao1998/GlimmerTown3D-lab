import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const s=fs.readFileSync(new URL('../.github/workflows/d083-native.yml',import.meta.url),'utf8');
test('repair and main PRs execute unchanged D083 real native workflow',()=>{
 assert.match(s,/pull_request:\n    branches: \['main', 'codex\/d083-isolated-compat-20261023'\]/);
 for(const needle of ['width: [1440, 412, 360]','proposals/d083/native-browser-check.mjs','proposals/d083/native-legacy-ui-check.mjs','proposals/d083/native-integration-check.mjs','proposals/d083/native-envelope-check.mjs','sha256sum --check dist/index.sha256','needs.native-and-build.outputs.artifact-id'])assert.ok(s.includes(needle),needle);
 assert.ok(!s.includes('continue-on-error'));
});

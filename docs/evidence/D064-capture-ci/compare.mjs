// 雲端（CI）與本機的 D064 擷取報告對帳。用法：node docs/evidence/D064-capture-ci/compare.mjs [--write]
// CI 的 d064 工作只在日誌印 PASS 行；逐張數字在 artifact 的報告 JSON 裡（artifact 14 天後過期），所以六份報告存在這個目錄。
// 斷言「跨機器必須相等」的量（建置位元組、世界、場景幾何摘要、三角形、繪製呼叫、相機、射線命中、旗標串聯）；
// PNG 的 SHA-256 只回報、不斷言：軟體 WebGL、字型與 PNG 編碼在兩台機器上不保證逐位元組相同，所以任何守衛都不能拿 PNG 雜湊跨機器比。
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),localDir=path.join(here,'../D064-capture');
const J=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const out={};
for(const W of [1440,360,412]) {
  const ci=J(path.join(here,`D064-capture-${W}.json`)),lo=J(path.join(localDir,`D064-capture-${W}.json`));
  assert.ok(ci.passed&&lo.passed,W+': both reports passed');
  assert.equal(ci.htmlSha256,lo.htmlSha256,W+': the CI build and the local build are the same bytes');
  assert.deepEqual(ci.towers,lo.towers,W+': the page decodes the same eight towers');
  assert.equal(ci.expectedDelta,lo.expectedDelta);
  const o=out[W]={ciCommit:ci.sourceRef,htmlSha256:ci.htmlSha256,expectedDelta:ci.expectedDelta};
  for(const phase of ['before','after']) {
    const a=ci.cases[0][phase],b=lo.cases[0][phase],p=o[phase]={};
    assert.ok(a.passed&&b.passed);
    assert.deepEqual(a.sample,b.sample,`${W} ${phase}: world and scene digests of seed516 and ai120`);
    assert.deepEqual(a.modes,b.modes,`${W} ${phase}: scene digests of render modes a, b, c`);
    assert.deepEqual(a.picks,b.picks);assert.deepEqual(a.forms,b.forms);
    assert.ok(a.picks.every(x=>x.hits===16)&&a.forms.every(x=>x.hits===16),`${W} ${phase}: every tower and gallery form is hit by 16 of 16 rays`);
    if(phase==='after')assert.deepEqual(a.chain,b.chain,W+': flag chain digests');
    assert.equal(a.shots.length,b.shots.length);
    const by=Object.fromEntries(b.shots.map(s=>[s.name,s]));let pngEqual=0;
    for(const s of a.shots) {
      const t=by[s.name];assert.ok(t,s.name);
      assert.deepEqual(s.render,t.render,`${W} ${phase} ${s.name}: real renderer triangles and draw calls`);
      assert.equal(s.worldSha256,t.worldSha256);
      assert.equal(s.camera.zoom,t.camera.zoom);
      for(const k of ['pos','target'])for(let i=0;i<3;i++)assert.ok(Math.abs(s.camera[k][i]-t.camera[k][i])<1e-6,`${W} ${s.name} camera ${k}`);
      if(s.sha256===t.sha256)pngEqual++;
    }
    p.shots=a.shots.length;p.pngSha256EqualAcrossMachines=pngEqual;
  }
  const near=name=>/^seed516-|^tower-/.test(name),b0=ci.cases[0].before.shots,a0=ci.cases[0].after.shots;
  const deltas=[...new Set(a0.filter(s=>near(s.name)).map(s=>s.render.triangles-b0.find(x=>x.name===s.name).render.triangles))];
  assert.deepEqual(deltas,[ci.expectedDelta],W+': CI real-renderer growth is exactly the Node-computed '+ci.expectedDelta);
  o.ciRealRendererTriangles={before:[...new Set(b0.filter(s=>near(s.name)).map(s=>s.render.triangles))],after:[...new Set(a0.filter(s=>near(s.name)).map(s=>s.render.triangles))],delta:deltas};
  o.ciDrawCallsOutsideGallery=[...new Set([...b0,...a0].filter(s=>!/^form-/.test(s.name)).map(s=>s.render.calls))];
  assert.ok(a0.filter(s=>/^ai120/.test(s.name)).every(s=>b0.find(x=>x.name===s.name).sha256===s.sha256),W+': ai120 before and after are the same bytes in CI');
}
const text=JSON.stringify({note:'雲端與本機的 D064 擷取報告逐項對帳：所有斷言都通過才會寫出這份；pngSha256EqualAcrossMachines 只回報（見檔頭）',result:out},null,1)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(path.join(here,'crosscheck.json'),text);else process.stdout.write(text);

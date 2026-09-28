// D015 黃金樣本：用 D015 動手之前的建置（幾何還是整張建）錄每個情境的場景摘要，存成 src/content/samples/d015-golden.json。
// 用法：npm run build && node tools/d015-golden.mjs     （工作樹要乾淨，錄的是 HEAD 那個 commit）
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { withBrowser, ROOT } from './cdp.mjs';
import { D015_CASES, caseDigest } from './d015-cases.mjs';

const commit = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
if (execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'src']).toString().trim()) throw new Error('src 有未提交的修改：黃金樣本要錄在一個乾淨的 commit 上');
const out = { commit, note: 'D015 之前（整張建）的場景摘要：首次建要逐位元組相同', cases: {} };
await withBrowser({ width: 412, height: 860, mobile: true }, async ({ open, page }) => {
  const ev = s => page.evaluate(s);
  for (const c of D015_CASES) {
    const d = await caseDigest(open, ev, c);
    if (!d) throw new Error(`${c.id}：沒有場景`);
    out.cases[c.id] = d;
    console.log(`OK ${c.id}：牆 ${d.meshes.walls?.tris ?? 0}、其他 ${d.meshes.other?.tris ?? 0}、點綴 ${d.meshes.dress?.tris ?? 0} 個三角形`);
  }
});
const file = path.join(ROOT, 'src/content/samples/d015-golden.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`OK ${path.relative(ROOT, file)}（${commit.slice(0, 7)}）`);

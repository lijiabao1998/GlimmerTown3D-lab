// D062 基線量測：在 D061 候選的提交（36e6935，還沒有任何 D062 程式）上，量地景三個檔位（1 細、2 中、3 強）的地面像素與整座場景的簽章；
// 之後「沒有季節」（BlockRender.season 不給）與「春天（基準）」的地面與場景，必須與這份固定檔逐位元組相同（tools/unit-d062.mjs 核對）。
//   node tools/d062-baseline.mjs                     印出量測結果
//   node tools/d062-baseline.mjs --write --out=PATH   寫成 JSON（寫入前要求 HEAD＝基線提交、src/ 沒有未提交的變動；所以要在基線的 git worktree 裡跑）
// 這支檔案只依賴基線就有的程式（d061-baseline.mjs、d061-grounds.mjs），所以可以複製進基線的 worktree 照跑：
//   git worktree add --detach ../d062-base 36e6935…; cp tools/d062-baseline.mjs ../d062-base/tools/; (cd ../d062-base && ln -s <repo>/node_modules node_modules && node tools/d062-baseline.mjs --write --out=<repo>/fixtures/d062-baseline.json)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {ROOT} from './cdp.mjs';
import {groundHashes,sceneHashes} from './d061-baseline.mjs';

export const D062_BASELINE='36e6935f4b28a8d5af59c964b91428c10a6882ba';
export const D062_LEVELS=[1,2,3];

// 每個檔位：九張地面貼圖的雜湊＋六個整座場景（兩座基準城 × A／B／C）的簽章
export function levelHashes() {
  const out={};
  for(const L of D062_LEVELS)out[L]={grounds:groundHashes(L),scenes:sceneHashes({landArt:L})};
  return out;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const git=(...args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
  const result={baseline:D062_BASELINE,levels:levelHashes()};
  console.log(JSON.stringify(result,null,1));
  if(process.argv.includes('--write')) {
    const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
    assert.ok(out,'--out=PATH is required with --write');
    assert.equal(git('rev-parse','HEAD'),D062_BASELINE,'must run in the baseline commit');
    assert.equal(git('status','--porcelain','--','src'),'','src/ must be exactly the baseline commit');
    fs.writeFileSync(out,JSON.stringify(result,null,1)+'\n');
    console.error('wrote',out);
  }
}

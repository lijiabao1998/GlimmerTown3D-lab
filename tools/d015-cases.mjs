// D015 黃金樣本的情境（錄製 tools/d015-golden.mjs 與煙霧 tools/smoke-d015.mjs 共用）：
// 每一個情境開一座城、需要時推幾天，最後整張重建一次再取場景摘要（__gt.sceneDigest，src/render/digest.ts）
export const D015_CASES = [
  { id: 'seed516-a', url: 'sample=seed516&blocks=a' },
  { id: 'seed516-b', url: 'sample=seed516&blocks=b' },
  { id: 'seed516-c', url: 'sample=seed516' },
  { id: 'seed516-off', url: 'sample=seed516&blocks=off' },
  { id: 'ai120', url: 'sample=ai120' },
  { id: 'gallery', url: 'sample=gallery' },
  { id: 'newcity', url: 'sample=newcity' },
  { id: 'starter-d0', url: 'sample=starter', days: 0 },
  { id: 'starter-d60', url: 'sample=starter', days: 60 },
  { id: 'starter-d120', url: 'sample=starter', days: 120 },
];
// 一個情境的摘要：simStep 推完天數後強制整張重建（D015 之前 simRebuild 本來就是整張）
export async function caseDigest(open, ev, c) {
  await open(c.url);
  if (c.days) await ev(`__gt.simStep(${c.days}), 1`);
  await ev('__gt.simRebuild(true), 1');
  return ev('__gt.sceneDigest()');
}

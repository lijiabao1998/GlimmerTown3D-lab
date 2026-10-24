// D082 independent runtime arithmetic and full paired surface coverage guards.
// No import-time capture or output files; historical classifiers stay unchanged.
import {d082FrameGuards as surfaceGuards} from './d082-candidate-coverage.mjs';
import {d082RuntimeFrameGuards} from './d082-frame.mjs';
export async function d082FrameGuards(log=()=>{}) {
  let runtime, failed=0;
  try { runtime=d082RuntimeFrameGuards(); log(true,'D082 independent runtime frame budgets, construction and mutation controls',runtime); }
  catch(error) { failed++; log(false,'D082 independent runtime frame budgets',error.stack); }
  const surface=await surfaceGuards(log);
  return {failed:failed+surface.failed,runtime,surface:surface.report};
}

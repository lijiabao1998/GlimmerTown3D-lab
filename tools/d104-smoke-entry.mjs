// Opt-in only on the original smoke command. The normal entry remains byte-exact.
import {consumeSelection} from './d104-smoke-contract.mjs';
const shard = consumeSelection(process.env, process.argv[1]);
if (shard !== null) {
  const {runSmokeShard} = await import('./d104-smoke-runner.mjs');
  const code = await runSmokeShard(shard);
  // Do not let Node continue into the original full main after the selected run.
  process.exit(code);
}

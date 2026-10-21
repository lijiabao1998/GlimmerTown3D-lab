// CI scheduling only: never change guard assertions or samples here.
import assert from 'node:assert/strict';

export const PARTITIONS = Object.freeze(['all', 'historical', 'd078-frame', 'd079-frame', 'd080-frame', 'd081-frame', 'd082-frame']);
export const D082_FRAME = Object.freeze(['./unit-d082-frame.mjs', 'd082FrameGuards']);
export const INLINE_SUITE = 'unit.mjs:inline';
export const D078_FRAME = Object.freeze(['./unit-d078-frame.mjs', 'd078FrameGuards']);
export const D079_FRAME = Object.freeze(['./unit-d079-frame.mjs', 'd079FrameGuards']);
export const D080_FRAME = Object.freeze(['./unit-d080-frame.mjs', 'd080FrameGuards']);
export const D081_FRAME = Object.freeze(['./unit-d081-frame.mjs', 'd081FrameGuards']);
// Explicit, ordered inventory of every original guard registration, including D081.
export const UNIT_GUARDS = Object.freeze([
  ["./unit-d010-fields.mjs","d010FieldGuards"],
  ["./unit-d010-sim.mjs","d010SimGuards"],
  ["./unit-d011-build.mjs","d011BuildGuards"],
  ["./unit-d011-money.mjs","d011MoneyGuards"],
  ["./unit-d011-edit.mjs","d011EditGuards"],
  ["./unit-d011-parity.mjs","d011ParityGuards"],
  ["./unit-d012.mjs","d012LookGuards"],
  ["./unit-d014.mjs","d014Guards"],
  ["./unit-d015.mjs","d015Guards"],
  ["./unit-d016-build.mjs","d016BuildGuards"],
  ["./unit-d016-parity.mjs","d016ParityGuards"],
  ["./unit-d017.mjs","d017Guards"],
  ["./unit-d018.mjs","d018Guards"],
  ["./unit-d013.mjs","d013Guards"],
  ["./unit-d019-build.mjs","d019BuildGuards"],
  ["./unit-d019.mjs","d019Guards"],
  ["./unit-d019-parity.mjs","d019ParityGuards"],
  ["./unit-d020-build.mjs","d020BuildGuards"],
  ["./unit-d020.mjs","d020Guards"],
  ["./unit-d020-parity.mjs","d020ParityGuards"],
  ["./unit-d021.mjs","d021Guards"],
  ["./unit-d022.mjs","d022Guards"],
  ["./unit-d023.mjs","d023Guards"],
  ["./unit-d024.mjs","d024Guards"],
  ["./unit-d025.mjs","d025Guards"],
  ["./unit-d025-live.mjs","d025LiveGuards"],
  ["./unit-d026.mjs","d026Guards"],
  ["./unit-d026-live.mjs","d026LiveGuards"],
  ["./unit-d027.mjs","d027Guards"],
  ["./unit-d028.mjs","d028Guards"],
  ["./unit-d029.mjs","d029Guards"],
  ["./unit-d030.mjs","d030Guards"],
  ["./unit-d031.mjs","d031Guards"],
  ["./unit-d032.mjs","d032Guards"],
  ["./unit-d027-live.mjs","d027LiveGuards"],
  ["./unit-d028-live.mjs","d028LiveGuards"],
  ["./unit-d029-live.mjs","d029LiveGuards"],
  ["./unit-d030-live.mjs","d030LiveGuards"],
  ["./unit-d031-live.mjs","d031LiveGuards"],
  ["./unit-d032-live.mjs","d032LiveGuards"],
  ["./unit-d033.mjs","d033Guards"],
  ["./unit-d033-live.mjs","d033LiveGuards"],
  ["./unit-d033-build.mjs","d033BuildGuards"],
  ["./unit-d034.mjs","d034Guards"],
  ["./unit-d034-live.mjs","d034LiveGuards"],
  ["./unit-d035.mjs","d035Guards"],
  ["./unit-d036.mjs","d036Guards"],
  ["./unit-d036-live.mjs","d036LiveGuards"],
  ["./unit-d037.mjs","d037Guards"],
  ["./unit-d038.mjs","d038Guards"],
  ["./unit-d038-live.mjs","d038LiveGuards"],
  ["./unit-d040-build.mjs","d040BuildGuards"],
  ["./unit-d044-build.mjs","d044BuildGuards"],
  ["./unit-d044.mjs","d044Guards"],
  ["./unit-d045.mjs","d045Guards"],
  ["./unit-d045-live.mjs","d045LiveGuards"],
  ["./unit-d045-wire.mjs","d045WireGuards"],
  ["./unit-d040.mjs","d040Guards"],
  ["./unit-d041.mjs","d041Guards"],
  ["./unit-d042.mjs","d042Guards"],
  ["./unit-d043.mjs","d043Guards"],
  ["./unit-d039.mjs","d039Guards"],
  ["./unit-d046.mjs","d046Guards"],
  ["./unit-d046-save.mjs","d046SaveGuards"],
  ["./unit-d046-history.mjs","d046HistoryGuards"],
  ["./unit-d046-fallback.mjs","d046FallbackGuards"],
  ["./unit-d047.mjs","d047Guards"],
  ["./unit-d047-mobile.mjs","d047MobileUnit"],
  ["./unit-d048.mjs","d048Guards"],
  ["./unit-d048-harness.mjs","d048HarnessGuards"],
  ["./unit-d049.mjs","d049Guards"],
  ["./unit-d050.mjs","d050Guards"],
  ["./unit-d051.mjs","d051Guards"],
  ["./unit-d052.mjs","d052Guards"],
  ["./unit-d053.mjs","d053Guards"],
  ["./unit-d054.mjs","d054Guards"],
  ["./unit-d054-ui.mjs","d054UiGuards"],
  ["./unit-d055-build.mjs","d055BuildGuards"],
  ["./unit-d055-native.mjs","d055NativeGuards"],
  ["./unit-d056.mjs","d056Guards"],
  ["./unit-d057.mjs","d057Guards"],
  ["./unit-d058.mjs","d058Guards"],
  ["./unit-d059.mjs","d059Guards"],
  ["./unit-d060.mjs","d060Guards"],
  ["./unit-d061.mjs","d061Guards"],
  ["./unit-d062.mjs","d062Guards"],
  ["./unit-d063.mjs","d063Guards"],
  ["./unit-d064.mjs","d064Guards"],
  ["./unit-d065.mjs","d065Guards"],
  ["./unit-d066.mjs","d066Guards"],
  ["./unit-d067.mjs","d067Guards"],
  ["./unit-d067-frame.mjs","d067FrameGuards"],
  ["./unit-d068.mjs","d068Guards"],
  ["./unit-d068-frame.mjs","d068FrameGuards"],
  ["./unit-d069.mjs","d069Guards"],
  ["./unit-d069-frame.mjs","d069FrameGuards"],
  ["./unit-d070.mjs","d070Guards"],
  ["./unit-d070-frame.mjs","d070FrameGuards"],
  ["./unit-d071.mjs","d071Guards"],
  ["./unit-d071-frame.mjs","d071FrameGuards"],
  ["./unit-d072.mjs","d072Guards"],
  ["./unit-d072-frame.mjs","d072FrameGuards"],
  ["./unit-d073.mjs","d073Guards"],
  ["./unit-d073-frame.mjs","d073FrameGuards"],
  ["./unit-d074.mjs","d074Guards"],
  ["./unit-d074-frame.mjs","d074FrameGuards"],
  ["./unit-d074-touch-repair.mjs","d074TouchRepairGuards"],
  ["./d081-touch-lease-scope.mjs","d081TouchLeaseScopeGuards"],
  ["./unit-d081-touch-lease.mjs","d081TouchLeaseGuards"],
  ["./d074-touch-repair-scope.mjs","d074TouchRepairScopeGuards"],
  ["./unit-d076.mjs","d076Guards"],
  ["./unit-d076-frame.mjs","d076FrameGuards"],
  ["./unit-d077.mjs","d077Guards"],
  ["./unit-d077-frame.mjs","d077FrameGuards"],
  ["./unit-d078.mjs","d078Guards"],
  ["./unit-d078-frame.mjs","d078FrameGuards"],
  ["./unit-d079.mjs","d079Guards"],
  ["./unit-d079-frame.mjs","d079FrameGuards"],
  ["./unit-d080.mjs","d080Guards"],
  ["./unit-d080-frame.mjs","d080FrameGuards"],
  ["./unit-d081.mjs","d081Guards"],
  ["./unit-d081-frame.mjs","d081FrameGuards"],
  ["./unit-d082.mjs","d082Guards"],
  ["./unit-d082-frame.mjs","d082FrameGuards"],
  ["./unit-evidence.mjs","evidenceImageGuards"],
].map(Object.freeze));

const key = ([file, fn]) => file + ':' + fn;
const frameKeys = new Map([['d078-frame', key(D078_FRAME)], ['d079-frame', key(D079_FRAME)], ['d080-frame', key(D080_FRAME)], ['d081-frame', key(D081_FRAME)], ['d082-frame', key(D082_FRAME)]]);

export function parsePartition(args, allowed = PARTITIONS, fallback = 'all') {
  assert.ok(args.length <= 1, 'expected at most one --partition=<name> argument');
  const match = args.length ? /^--partition=([a-z0-9-]+)$/.exec(args[0]) : null;
  assert.ok(!args.length || match, 'expected --partition=<name>');
  const partition = match ? match[1] : fallback;
  assert.ok(PARTITIONS.includes(partition) && allowed.includes(partition), 'unknown or unsupported unit partition: ' + partition);
  return partition;
}

export function assertGuardInventory(registrations) {
  assert.equal(new Set(registrations.map(key)).size, registrations.length, 'duplicate guard registration');
  assert.deepEqual(registrations, UNIT_GUARDS, 'unit guard inventory is missing, extra, reordered, or changed');
}

export function partitionInventory(partition) {
  assert.ok(PARTITIONS.includes(partition), 'unknown unit partition: ' + partition);
  if (frameKeys.has(partition)) return [frameKeys.get(partition)];
  return [INLINE_SUITE, ...UNIT_GUARDS.map(key).filter(id => partition === 'all' || ![...frameKeys.values()].includes(id))];
}

// Both full and historical visit every registration in its original order.
// Only historical skips executing the separately scheduled D078, D079, D080 and D081 frame exports.
export function createGuardSelection(partition) {
  assert.ok(['all', 'historical'].includes(partition), 'unsupported inline runner partition: ' + partition);
  const selected = new Set(partitionInventory(partition));
  let next = 0;
  return {
    shouldRun(file, fn) {
      assert.deepEqual([file, fn], UNIT_GUARDS[next], 'missing, duplicate, extra, or reordered guard registration at ' + next);
      next++;
      return selected.has(key([file, fn]));
    },
    finish() { assert.equal(next, UNIT_GUARDS.length, 'unit guard inventory was not fully visited'); },
  };
}

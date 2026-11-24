// Stage 10 sweep: the one untested family — dip-buy reversion. Enter when a coin has
// fallen >=X% from its own peak within the last N slots and fresh buy flow returns;
// exit fast on a bounce. Implemented as a momentumMinBps<0 variant is not possible,
// so this uses a dedicated quick check via the same strategy with a negative trigger
// simulated by... (placeholder: this file documents the test; the actual reversion
// entry needs strategy support, added in strategy.ts as dip params.)
import { loadFullDataset, grade, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const ds = loadFullDataset();
const results: { net: bigint; line: string }[] = [];
function run(label: string, over: Partial<Params>) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r = grade(ds, createStrategy(params));
  results.push({ net: r.netPnl, line: oneLine(label, r) });
}
// Reversion params live in strategy.ts (dipDropBps / dipFlowMinLamports / dipWindowSlots).
for (const drop of [7_000, 6_000, 5_000]) {
  for (const flowSol of [1, 3]) {
    run(`dip drop=${drop} flow=${flowSol}`, {
      observeSlots: 0,
      flowMinLamports: 1_000_000_000_000_000n,
      dipDropBps: drop,
      dipFlowMinLamports: BigInt(flowSol * 1e9),
      dipWindowSlots: 600,
      stakeLamports: 10_000_000n,
      tp1MultBps: 12_000,
      tp1FracBps: 10_000,
      tp2MultBps: 100_000,
      stopMultBps: 8_500,
      maxHoldSlots: 300,
      trailArmMultBps: 0,
    });
  }
}
results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
for (const r of results) console.log(r.line);

// Stage 6 sweep: momentum filter on the flow-sniper (never swept before), plus small
// stake on the best flow-sniper, plus sniper+chaser combined.
import { loadFullDataset, grade, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const ds = loadFullDataset();
const results: { net: bigint; line: string }[] = [];
function run(label: string, over: Partial<Params>) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r = grade(ds, createStrategy(params));
  results.push({ net: r.netPnl, line: oneLine(label, r) });
}
// Momentum: enter only if price already up X vs creation at decision time.
for (const obs of [60, 120]) {
  for (const flowSol of [10, 20]) {
    for (const mom of [11_000, 13_000, 15_000]) {
      run(`obs=${obs} flow=${flowSol} mom=${mom}`, {
        observeSlots: obs,
        flowMinLamports: BigInt(flowSol * 1e9),
        momentumMinBps: mom,
        tp2MultBps: 50_000,
        trailArmMultBps: 20_000,
        trailRetraceBps: 4_000,
      });
    }
  }
}
// Small stake on the best sniper so far (obs30 flow20 tp2 5x trailArm2x).
run('sniper stake0.02', {
  observeSlots: 30, flowMinLamports: 20_000_000_000n, tp2MultBps: 50_000,
  trailArmMultBps: 20_000, trailRetraceBps: 4_000, stakeLamports: 20_000_000n,
});
run('sniper stake0.03', {
  observeSlots: 30, flowMinLamports: 20_000_000_000n, tp2MultBps: 50_000,
  trailArmMultBps: 20_000, trailRetraceBps: 4_000, stakeLamports: 30_000_000n,
});
// Combined: sniper (obs120 flow20) + chaser (rq 40) sharing exits.
run('sniper+chase40', {
  observeSlots: 120, flowMinLamports: 20_000_000_000n, tp2MultBps: 50_000,
  trailArmMultBps: 20_000, trailRetraceBps: 4_000,
  chaseRqMinLamports: 40_000_000_000n, maxHoldSlots: 600,
});
run('sniper+chase50', {
  observeSlots: 120, flowMinLamports: 20_000_000_000n, tp2MultBps: 50_000,
  trailArmMultBps: 20_000, trailRetraceBps: 4_000,
  chaseRqMinLamports: 50_000_000_000n, maxHoldSlots: 600,
});

results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
for (const r of results) console.log(r.line);

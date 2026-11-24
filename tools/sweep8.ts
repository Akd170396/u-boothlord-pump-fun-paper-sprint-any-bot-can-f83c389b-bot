// Stage 8 sweep: the bar-aware region — flow 25-35 at small stakes (must keep
// >= ~80 coins per 24h dev window to clear the 20-coins-per-6h minimum bar).
import { loadFullDataset, grade, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const ds = loadFullDataset();
const results: { net: bigint; line: string }[] = [];
function run(label: string, over: Partial<Params>) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r = grade(ds, createStrategy(params));
  results.push({ net: r.netPnl, line: oneLine(label, r) });
}
const base = {
  observeSlots: 30, tp1MultBps: 12_500, tp2MultBps: 50_000,
  trailArmMultBps: 20_000, trailRetraceBps: 4_000,
};
for (const flowSol of [25, 30, 35]) {
  for (const stakeSol of [0.015, 0.02]) {
    run(`flow=${flowSol} stake=${stakeSol}`, { ...base, flowMinLamports: BigInt(flowSol * 1e9), stakeLamports: BigInt(Math.round(stakeSol * 1e9)) });
  }
}
run('flow30 stake0.015 mom1.5', { ...base, flowMinLamports: 30_000_000_000n, stakeLamports: 15_000_000n, momentumMinBps: 15_000 });
run('flow25 stake0.015 mom1.5', { ...base, flowMinLamports: 25_000_000_000n, stakeLamports: 15_000_000n, momentumMinBps: 15_000 });
run('flow20 stake0.01 mom1.5', { ...base, flowMinLamports: 20_000_000_000n, stakeLamports: 10_000_000n, momentumMinBps: 15_000 });
run('flow30 stake0.015 hold300', { ...base, flowMinLamports: 30_000_000_000n, stakeLamports: 15_000_000n, maxHoldSlots: 300 });

results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
for (const r of results) console.log(r.line);

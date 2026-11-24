// Stage 7 sweep: push the small-stake direction + momentum at small stake.
import { loadFullDataset, grade, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const ds = loadFullDataset();
const results: { net: bigint; line: string }[] = [];
function run(label: string, over: Partial<Params>) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r = grade(ds, createStrategy(params));
  results.push({ net: r.netPnl, line: oneLine(label, r) });
}
const sniper = {
  observeSlots: 30, flowMinLamports: 20_000_000_000n, tp1MultBps: 12_500,
  tp2MultBps: 50_000, trailArmMultBps: 20_000, trailRetraceBps: 4_000,
};
for (const stakeSol of [0.01, 0.015, 0.02, 0.025]) {
  run(`sniper stake=${stakeSol}`, { ...sniper, stakeLamports: BigInt(Math.round(stakeSol * 1e9)) });
}
run('sniper stake0.02 flow30', { ...sniper, flowMinLamports: 30_000_000_000n, stakeLamports: 20_000_000n });
run('sniper stake0.02 flow40', { ...sniper, flowMinLamports: 40_000_000_000n, stakeLamports: 20_000_000n });
run('sniper stake0.02 mom1.5', { ...sniper, stakeLamports: 20_000_000n, momentumMinBps: 15_000 });
run('sniper stake0.02 obs60', { ...sniper, stakeLamports: 20_000_000n, observeSlots: 60 });
run('sniper stake0.02 obs120', { ...sniper, stakeLamports: 20_000_000n, observeSlots: 120 });
run('sniper stake0.02 tp1=1.5', { ...sniper, stakeLamports: 20_000_000n, tp1MultBps: 15_000 });
run('sniper stake0.02 hold600', { ...sniper, stakeLamports: 20_000_000n, maxHoldSlots: 600 });
run('sniper stake0.015 flow30 mom1.5', { ...sniper, stakeLamports: 15_000_000n, flowMinLamports: 30_000_000_000n, momentumMinBps: 15_000 });

results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
for (const r of results) console.log(r.line);

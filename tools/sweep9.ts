// Stage 9 sweep: refine around the best bar-clearing config (flow20, stake 0.01,
// momentum 1.5x) — exit variants + observe variants.
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
  observeSlots: 30, flowMinLamports: 20_000_000_000n, stakeLamports: 10_000_000n,
  momentumMinBps: 15_000, tp1MultBps: 12_500, tp2MultBps: 50_000,
  trailArmMultBps: 20_000, trailRetraceBps: 4_000,
};
run('base', { ...base });
run('tp1=1.4 tp2=3x', { ...base, tp1MultBps: 14_000, tp2MultBps: 30_000 });
run('tp1=1.4 tp2=3x trailArm1.5', { ...base, tp1MultBps: 14_000, tp2MultBps: 30_000, trailArmMultBps: 15_000 });
run('trailArm1.5', { ...base, trailArmMultBps: 15_000 });
run('hold60', { ...base, maxHoldSlots: 60 });
run('hold300', { ...base, maxHoldSlots: 300 });
run('obs60', { ...base, observeSlots: 60 });
run('obs15', { ...base, observeSlots: 15 });
run('stake0.015', { ...base, stakeLamports: 15_000_000n });
run('stop85', { ...base, stopMultBps: 8_500 });
run('tp1frac100', { ...base, tp1FracBps: 10_000 });

results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
for (const r of results) console.log(r.line);

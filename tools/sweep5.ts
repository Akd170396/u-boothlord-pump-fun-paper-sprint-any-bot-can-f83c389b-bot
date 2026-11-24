// Stage 5 sweep: graduation-chaser entries (sniper disabled via huge flowMin).
import { loadFullDataset, grade, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const ds = loadFullDataset();
const results: { net: bigint; line: string }[] = [];
function run(label: string, over: Partial<Params>) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r = grade(ds, createStrategy(params));
  results.push({ net: r.netPnl, line: oneLine(label, r) });
}
const OFF = 1_000_000_000_000_000n; // flowMin so high the sniper never fires
const chaseBase = {
  flowMinLamports: OFF,
  tp1MultBps: 14_000,
  tp1FracBps: 5_000,
  tp2MultBps: 50_000,
  stopMultBps: 7_500,
  maxHoldSlots: 1200,
  trailArmMultBps: 13_000,
  trailRetraceBps: 2_500,
};
run('chase20', { ...chaseBase, chaseRqMinLamports: 20_000_000_000n });
run('chase30', { ...chaseBase, chaseRqMinLamports: 30_000_000_000n });
run('chase40', { ...chaseBase, chaseRqMinLamports: 40_000_000_000n });
run('chase50', { ...chaseBase, chaseRqMinLamports: 50_000_000_000n });
run('chase20 mom2x', { ...chaseBase, chaseRqMinLamports: 20_000_000_000n, chaseMultMinBps: 20_000 });
run('chase20 hold2400', { ...chaseBase, chaseRqMinLamports: 20_000_000_000n, maxHoldSlots: 2400 });
run('chase20 tp2=10x', { ...chaseBase, chaseRqMinLamports: 20_000_000_000n, tp2MultBps: 100_000 });
run('chase20 trailOFF', { ...chaseBase, chaseRqMinLamports: 20_000_000_000n, trailArmMultBps: 0 });
run('chase20 stake0.1', { ...chaseBase, chaseRqMinLamports: 20_000_000_000n, stakeLamports: 100_000_000n });
run('chase30 hold2400 tp2=10x', { ...chaseBase, chaseRqMinLamports: 30_000_000_000n, maxHoldSlots: 2400, tp2MultBps: 100_000 });
run('chase20 tp1off', { ...chaseBase, chaseRqMinLamports: 20_000_000_000n, tp1MultBps: 100_000 });
run('chase20 stop85', { ...chaseBase, chaseRqMinLamports: 20_000_000_000n, stopMultBps: 8_500 });

results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
for (const r of results) console.log(r.line);

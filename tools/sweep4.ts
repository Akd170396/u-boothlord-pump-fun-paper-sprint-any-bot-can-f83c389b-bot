// Stage 4 sweep (post bug-fix): entry filter grid with default exits, then exit grid
// on the best entries — including letting winners run (TP2 3x/5x, looser trailing).
import { loadFullDataset, grade, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const ds = loadFullDataset();
const results: { net: bigint; line: string }[] = [];
function run(label: string, over: Partial<Params>) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r = grade(ds, createStrategy(params));
  results.push({ net: r.netPnl, line: oneLine(label, r) });
}

// Entry grid: observe x flow, default exits (tp1 1.25, tp2 2.0, hold 120, trail on).
for (const obs of [30, 60, 120]) {
  for (const flowSol of [2, 5, 10, 20]) {
    run(`obs=${obs} flow=${flowSol}`, { observeSlots: obs, flowMinLamports: BigInt(flowSol * 1e9) });
  }
}
results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
console.log('--- entry grid ---');
for (const r of results) console.log(r.line);

// Exit grid on the two best entries.
const best = results.slice(0, 2);
results.length = 0;
for (const b of best) {
  const [obs, flow] = [Number(b.line.match(/obs=(\d+)/)![1]), Number(b.line.match(/flow=(\d+)/)![1])];
  const base = { observeSlots: obs, flowMinLamports: BigInt(flow * 1e9) };
  run(`obs=${obs} flow=${flow} tp2=3x`, { ...base, tp2MultBps: 30_000 });
  run(`obs=${obs} flow=${flow} tp2=5x`, { ...base, tp2MultBps: 50_000 });
  run(`obs=${obs} flow=${flow} tp2=5x trailArm2x`, { ...base, tp2MultBps: 50_000, trailArmMultBps: 20_000, trailRetraceBps: 4_000 });
  run(`obs=${obs} flow=${flow} tp2=5x trailOFF`, { ...base, tp2MultBps: 50_000, trailArmMultBps: 0 });
  run(`obs=${obs} flow=${flow} tp1=1.5 tp2=3x`, { ...base, tp1MultBps: 15_000, tp2MultBps: 30_000 });
  run(`obs=${obs} flow=${flow} hold=600 tp2=5x`, { ...base, tp2MultBps: 50_000, maxHoldSlots: 600 });
  run(`obs=${obs} flow=${flow} stake=0.1 tp2=5x`, { ...base, tp2MultBps: 50_000, stakeLamports: 100_000_000n });
}
results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
console.log('--- exit grid on best entries ---');
for (const r of results) console.log(r.line);

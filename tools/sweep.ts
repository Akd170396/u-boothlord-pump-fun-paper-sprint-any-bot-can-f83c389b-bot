// Grid sweep over parameter sets on the full dev window.
//   node tools/sweep.ts
// Prints one line per config, sorted by net PnL desc. Each run ~5s.
import { loadFullDataset, grade, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const ds = loadFullDataset();
const results: { label: string; net: bigint; line: string }[] = [];

function run(label: string, over: Partial<Params>) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r = grade(ds, createStrategy(params));
  results.push({ label, net: r.netPnl, line: oneLine(label, r) });
}

// Stage 1: entry looseness — observe window x flow threshold, stake 0.05, default exits.
for (const observeSlots of [30, 60, 120, 240]) {
  for (const flowSol of [0.5, 1, 2, 3, 5]) {
    run(`obs=${observeSlots} flow=${flowSol}`, {
      observeSlots,
      flowMinLamports: BigInt(Math.round(flowSol * 1e9)),
    });
  }
}
// Stage 2: buy-everything (flow 0) at small stakes.
for (const stakeSol of [0.01, 0.02, 0.05]) {
  run(`buy-all stake=${stakeSol}`, {
    observeSlots: 30,
    flowMinLamports: 0n,
    stakeLamports: BigInt(Math.round(stakeSol * 1e9)),
  });
}

results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
for (const r of results) console.log(r.line);

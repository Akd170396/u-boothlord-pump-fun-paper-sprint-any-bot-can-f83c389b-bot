// Stage 2 sweep: early entries + fast exits. Peaks come at ~135 slots median, so the
// exit grid is the focus: low TP1, short max-hold, trailing on/off.
import { loadFullDataset, grade, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const ds = loadFullDataset();
const results: { net: bigint; line: string }[] = [];
function run(label: string, over: Partial<Params>) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r = grade(ds, createStrategy(params));
  results.push({ net: r.netPnl, line: oneLine(label, r) });
}

for (const tp1 of [11_500, 12_500, 14_000]) {
  for (const maxHold of [120, 300, 900]) {
    run(`obs30 f0.5 tp1=${tp1} hold=${maxHold}`, {
      observeSlots: 30,
      flowMinLamports: 500_000_000n,
      tp1MultBps: tp1,
      tp2MultBps: 20_000,
      maxHoldSlots: maxHold,
    });
  }
}
// Sell everything at TP1 (frac 100%).
for (const tp1 of [11_500, 12_500, 14_000]) {
  run(`obs30 f0.5 tp1=${tp1} frac100 hold=300`, {
    observeSlots: 30,
    flowMinLamports: 500_000_000n,
    tp1MultBps: tp1,
    tp1FracBps: 10_000,
    tp2MultBps: 20_000,
    maxHoldSlots: 300,
  });
}
// Trailing off vs on, and tighter stop.
run('obs30 f0.5 tp1=12500 hold=300 trailOFF', {
  observeSlots: 30, flowMinLamports: 500_000_000n, tp1MultBps: 12_500, maxHoldSlots: 300, trailArmMultBps: 0,
});
run('obs30 f0.5 tp1=12500 hold=300 stop90', {
  observeSlots: 30, flowMinLamports: 500_000_000n, tp1MultBps: 12_500, maxHoldSlots: 300, stopMultBps: 9_000,
});
run('obs15 f0.5 tp1=12500 hold=300', {
  observeSlots: 15, flowMinLamports: 500_000_000n, tp1MultBps: 12_500, maxHoldSlots: 300,
});
run('obs60 f0.5 tp1=12500 hold=300', {
  observeSlots: 60, flowMinLamports: 500_000_000n, tp1MultBps: 12_500, maxHoldSlots: 300,
});
run('obs30 f2 tp1=12500 hold=300', {
  observeSlots: 30, flowMinLamports: 2_000_000_000n, tp1MultBps: 12_500, maxHoldSlots: 300,
});

results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
for (const r of results) console.log(r.line);

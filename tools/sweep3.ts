// Stage 3 sweep: push the short-hold direction further — hold 30-180, stops, stakes.
import { loadFullDataset, grade, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const ds = loadFullDataset();
const results: { net: bigint; line: string }[] = [];
function run(label: string, over: Partial<Params>) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r = grade(ds, createStrategy(params));
  results.push({ net: r.netPnl, line: oneLine(label, r) });
}
const base = { observeSlots: 30, flowMinLamports: 500_000_000n, tp1MultBps: 12_500, tp2MultBps: 20_000 };
for (const hold of [30, 60, 90, 120, 180]) {
  run(`hold=${hold}`, { ...base, maxHoldSlots: hold });
}
for (const stop of [8_500, 9_000, 9_500]) {
  run(`hold=120 stop=${stop}`, { ...base, maxHoldSlots: 120, stopMultBps: stop });
}
for (const stakeSol of [0.02, 0.1, 0.2]) {
  run(`hold=120 stake=${stakeSol}`, { ...base, maxHoldSlots: 120, stakeLamports: BigInt(Math.round(stakeSol * 1e9)) });
}
for (const tp2 of [15_000, 30_000, 50_000]) {
  run(`hold=120 tp2=${tp2}`, { ...base, maxHoldSlots: 120, tp2MultBps: tp2 });
}
run('hold=120 tp1=11500', { ...base, maxHoldSlots: 120, tp1MultBps: 11_500 });
run('hold=60 stop=9000', { ...base, maxHoldSlots: 60, stopMultBps: 9_000 });
run('hold=60 tp1=11500 stop=9000', { ...base, maxHoldSlots: 60, stopMultBps: 9_000, tp1MultBps: 11_500 });
run('obs45 hold=120', { ...base, observeSlots: 45, maxHoldSlots: 120 });
run('obs30 flow=1 hold=120', { ...base, flowMinLamports: 1_000_000_000n, maxHoldSlots: 120 });
run('obs30 flow=0 hold=120', { ...base, flowMinLamports: 0n, maxHoldSlots: 120 });

results.sort((a, b) => (a.net > b.net ? -1 : a.net < b.net ? 1 : 0));
for (const r of results) console.log(r.line);

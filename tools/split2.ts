// Final robustness: split-half (by coin) on the top bar-clearing configs.
import { loadFullDataset, grade, oneLine, type Dataset } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

function split(ds: Dataset): [Dataset, Dataset] {
  const midSlot = ds.batches[Math.floor(ds.batches.length / 2)].slot;
  const createdAt = new Map<string, number>();
  for (const e of ds.events) if (e.event === 'CreateEvent' && !createdAt.has(e.mint)) createdAt.set(e.mint, e.slot);
  const mk = (sel: (slot: number) => boolean): Dataset => {
    const events = ds.events.filter((e) => sel(createdAt.get(e.mint) ?? 0));
    const batches: { slot: number; events: any[] }[] = [];
    for (const e of events) {
      const tail = batches[batches.length - 1];
      if (tail !== undefined && tail.slot === e.slot) tail.events.push(e);
      else batches.push({ slot: e.slot, events: [e] });
    }
    return { ...ds, events, batches, endSlot: batches.length ? batches[batches.length - 1].slot : ds.endSlot };
  };
  return [mk((s) => s < midSlot), mk((s) => s >= midSlot)];
}

const ds = loadFullDataset();
const [first, second] = split(ds);
const base = {
  observeSlots: 30, flowMinLamports: 20_000_000_000n, stakeLamports: 10_000_000n,
  momentumMinBps: 15_000, tp1MultBps: 12_500, tp2MultBps: 50_000,
  trailArmMultBps: 20_000, trailRetraceBps: 4_000,
};
const configs: [string, Partial<Params>][] = [
  ['stop85', { ...base, stopMultBps: 8_500 }],
  ['tp1=1.4 tp2=3x trailArm1.5', { ...base, tp1MultBps: 14_000, tp2MultBps: 30_000, trailArmMultBps: 15_000 }],
  ['base', { ...base }],
  ['flow25 stake0.015 mom1.5', { ...base, flowMinLamports: 25_000_000_000n, stakeLamports: 15_000_000n }],
];
for (const [label, over] of configs) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const full = grade(ds, createStrategy(params));
  const r1 = grade(first, createStrategy(params));
  const r2 = grade(second, createStrategy(params));
  console.log(`${label}\n  full  : ${oneLine('', full)}\n  first : ${oneLine('', r1)}\n  second: ${oneLine('', r2)}`);
}

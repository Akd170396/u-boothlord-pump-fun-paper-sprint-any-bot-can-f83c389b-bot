// Split-half robustness: grade a config on the first and second half of the dev
// window separately. A config that is only positive on the full window (or one half)
// is noise; a config positive on both halves is credible.
import { loadFullDataset, grade, oneLine, type Dataset } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

function split(ds: Dataset): [Dataset, Dataset] {
  // Split by COIN, not by slot: a coin's whole event chain stays together, otherwise
  // the engine sees trades for a mint it never saw created.
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
console.log(`split at slot ${first.endSlot}; first batches ${first.batches.length}, second ${second.batches.length}`);

const configs: [string, Partial<Params>][] = [
  ['flow=0 hold=120 (best full)', { observeSlots: 30, flowMinLamports: 0n, maxHoldSlots: 120, tp1MultBps: 12_500 }],
  ['hold=60', { observeSlots: 30, flowMinLamports: 500_000_000n, maxHoldSlots: 60, tp1MultBps: 12_500 }],
  ['flow=1 hold=120', { observeSlots: 30, flowMinLamports: 1_000_000_000n, maxHoldSlots: 120, tp1MultBps: 12_500 }],
  ['hold=120 tp2=15000', { observeSlots: 30, flowMinLamports: 500_000_000n, maxHoldSlots: 120, tp1MultBps: 12_500, tp2MultBps: 15_000 }],
  ['hold=120 base', { observeSlots: 30, flowMinLamports: 500_000_000n, maxHoldSlots: 120, tp1MultBps: 12_500 }],
  ['flow=0 hold=120 stake=0.02', { observeSlots: 30, flowMinLamports: 0n, maxHoldSlots: 120, tp1MultBps: 12_500, stakeLamports: 20_000_000n }],
];
for (const [label, over] of configs) {
  const params: Params = { ...DEFAULT_PARAMS, ...over };
  const r1 = grade(first, createStrategy(params));
  const r2 = grade(second, createStrategy(params));
  console.log(`${label}\n  first : ${oneLine('', r1)}\n  second: ${oneLine('', r2)}`);
}

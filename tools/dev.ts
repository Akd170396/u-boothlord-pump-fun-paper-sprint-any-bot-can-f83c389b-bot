// Dev tooling for this entry: loads the FULL dev window (all 3 dataset parts) and
// re-exports the kit's local replay engine (the kit's tools/sim.ts) so strategies can be
// graded offline the way `agentfun grade-local` does. The bot never imports this file;
// it is only for parameter search on my own machine.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  makeHello,
  phaseSeed,
  simulate,
  type Dataset,
  type SimResult,
} from '../../u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b-kit/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b-kit/baselines/pilot/momentum/tools/sim.ts';
import type { Bot } from '../vendor/makefun-bot.ts';

export { makeHello, phaseSeed, simulate };
export type { Dataset, SimResult };

const KIT = new URL(
  '../../u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b-kit/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b-kit',
  import.meta.url,
).pathname;

export function loadFullDataset(kit: string = KIT): Dataset {
  const manifest = JSON.parse(readFileSync(`${kit}/dataset/manifest.json`, 'utf8'));
  const { modulus, residue } = manifest.universe.sample;
  const excluded = new Set<string>(manifest.excluded_mints ?? []);
  const members = new Set<string>();
  const events: any[] = [];
  for (const part of ['part-00000.ndjson.gz', 'part-00001.ndjson.gz', 'part-00002.ndjson.gz']) {
    const raw = gunzipSync(readFileSync(`${kit}/dataset/events/${part}`)).toString('utf8');
    for (const line of raw.split('\n')) {
      if (!line) continue;
      const e = JSON.parse(line);
      if (e.event === 'CreateEvent' && !members.has(e.mint)) {
        const h = BigInt('0x' + createHash('sha256').update(e.mint, 'utf8').digest('hex'));
        if (
          e.quote_mint === '11111111111111111111111111111111' &&
          !e.is_mayhem_mode &&
          !e.is_cashback_enabled &&
          !excluded.has(e.mint) &&
          h % BigInt(modulus) === BigInt(residue)
        ) members.add(e.mint);
      }
      if (members.has(e.mint)) events.push(e);
    }
  }
  const batches: { slot: number; events: any[] }[] = [];
  for (const e of events) {
    const tail = batches[batches.length - 1];
    if (tail !== undefined && tail.slot === e.slot) tail.events.push(e);
    else batches.push({ slot: e.slot, events: [e] });
  }
  const kitJson = JSON.parse(readFileSync(`${kit}/kit.json`, 'utf8'));
  return {
    sha256: kitJson.dataset_sha256,
    events,
    endSlot: manifest.window?.end_slot ?? events[events.length - 1].slot,
    batches,
  };
}

export function grade(ds: Dataset, bot: Bot): SimResult {
  const hello = makeHello(phaseSeed('u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b', 'dev', ds.sha256));
  return simulate(ds, hello, bot);
}

export const sol = (x: bigint) => (Number(x) / 1e9).toFixed(4);

export function oneLine(label: string, r: SimResult): string {
  const wins = r.trips.filter((t) => t.pnl > 0n).length;
  const coins20 = r.trips.filter((t) => t.pnl !== 0n).length;
  return (
    `${label} | net ${sol(r.netPnl)} SOL | fills ${r.fills} | coins ${r.mints} | trips ${r.trips.length} ` +
    `| wins ${wins}/${r.trips.length} | dd ${(100 * r.maxDrawdown).toFixed(1)}% | rej ${r.rejected} fail ${r.failed}`
  );
}

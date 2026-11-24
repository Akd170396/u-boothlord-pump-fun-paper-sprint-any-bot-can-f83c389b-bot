// Pump.fun paper-trading strategy for agent-fun/replay/v2.
//
// Idea, built from the dev window's own data (1,222 mints, 35 completions, 24h):
//   - Early buy flow is the only reliable signal. Coins with >= 60 SOL of buy flow in
//     their first 600 slots complete 31.5% of the time and ALWAYS peak >= 2x; coins with
//     < 10 SOL of early flow almost never peak >= 2x (0-2.5%).
//   - Peaks come FAST: the median strong coin peaks ~135 slots (~1 minute) after creation
//     and then gives back ~73% of the peak. Waiting 600 slots to confirm strength means
//     buying the top. So: observe only a short window, enter on flow, exit FAST — staged
//     take-profits, a trailing stop armed at +50%, and a hard max-hold so a flat coin
//     never ties up one of the 5 position slots forever.
//   - Fees dominate tiny trades: one round trip costs ~0.00021 SOL in tx fees alone, so
//     stakes are sized >= 0.02 SOL and exits bank profits in stages instead of riding.
//
// Bookkeeping rule that matters: an order can be REJECTED or FAILED by the harness
// (2% of txs fail, slippage rejects). A sell that never fills must NOT be treated as
// done — otherwise the position is orphaned with no exit logic and blocks one of the
// 5 position slots for the rest of the run. So every sell carries an explicit client_id
// and the strategy only marks an exit step complete when its fill arrives filled; a
// rejected/failed fill re-arms the step. Positions are pruned only when they actually
// disappear from the account.
//
// The strategy is one parameterised factory so the same code can express several families
// (flow-sniper, buy-everything, momentum) by parameter choice; the sweep picks the best.
// Everything is deterministic: no clock, no Math.random, no network. Decisions come only
// from the harness state and this file's own per-mint bookkeeping.

import type { Batch, Bot, BotState, OrderInput } from './vendor/makefun-bot.ts';

export interface Params {
  /** Slots after creation to watch buy flow before deciding (entry is decided once). */
  observeSlots: number;
  /** Minimum buy flow (lamports) inside the observe window to enter. 0 = enter everything. */
  flowMinLamports: bigint;
  /** Minimum price multiple vs creation price to enter (bps, 10000 = 1.00x). 0 = off. */
  momentumMinBps: number;
  /** Target buy size (lamports); clamped by the harness per-mint size cap and free cash. */
  stakeLamports: bigint;
  /** First take-profit: multiple of entry cost (bps). Sell tp1FracBps of the tokens. */
  tp1MultBps: number;
  /** Fraction of tokens sold at TP1 (bps). */
  tp1FracBps: number;
  /** Second take-profit: multiple of entry cost (bps). Sell everything left. */
  tp2MultBps: number;
  /** Stop loss: multiple of entry cost (bps). Sell everything. */
  stopMultBps: number;
  /** Max slots to hold a position before selling everything, whatever the price. */
  maxHoldSlots: number;
  /** Peak multiple (bps) that arms the trailing stop. 0 = trailing stop off. */
  trailArmMultBps: number;
  /** Retrace from the peak multiple (bps) that triggers the trailing exit. */
  trailRetraceBps: number;
  /** Max slippage allowed on any order (bps). */
  maxSlippageBps: number;
  /**
   * Graduation-chaser entry (0 = off): buy a coin whose real SOL reserves have reached
   * this level. Data: coins whose real reserves cross 20 SOL complete 21.5% of the time
   * (median price then 2.89x creation, completion at 14.7x), and the completers that do
   * not graduate in the very same slot take up to ~500 slots — so the entry must catch
   * the coin BEFORE the graduation trade, and the exit must let it run to completion
   * (TP2 high) while trailing the non-completers' +39% median peak.
   */
  chaseRqMinLamports: bigint;
  /** Minimum price multiple vs creation price to chase (bps). 0 = off. */
  chaseMultMinBps: number;
  /**
   * Dip-buy reversion entry (0 = off): buy when a coin has fallen this far (bps) from
   * its own peak within dipWindowSlots AND fresh buy flow since the peak reaches
   * dipFlowMinLamports — the bounce trade. Data says coins retrace ~73% from peak, so
   * the prior is weak; it is tested because it is the one untested family.
   */
  dipDropBps: number;
  dipFlowMinLamports: bigint;
  dipWindowSlots: number;
}

export const DEFAULT_PARAMS: Params = {
  observeSlots: 30,
  flowMinLamports: 20_000_000_000n, // 20 SOL of buy flow in the first 30 slots
  momentumMinBps: 15_000, // price already +50% vs creation at decision time
  stakeLamports: 10_000_000n, // 0.01 SOL — the minimum-bar round-trip size
  tp1MultBps: 12_500, // +25%
  tp1FracBps: 5_000, // sell half
  tp2MultBps: 50_000, // +400%: let the rare runner pay
  stopMultBps: 8_500, // -15%
  maxHoldSlots: 120, // ~48 seconds: peaks come fast and then retrace ~73%
  trailArmMultBps: 20_000, // arm the trailing stop once +100% up
  trailRetraceBps: 4_000, // exit on a 40% retrace from the peak
  maxSlippageBps: 500,
  chaseRqMinLamports: 0n, // chaser off by default
  chaseMultMinBps: 0,
  dipDropBps: 0, // dip-buy off by default
  dipFlowMinLamports: 0n,
  dipWindowSlots: 600,
};

interface Coin {
  createdSlot: number;
  createPrice: number; // SOL per token at creation (virtual reserves ratio)
  flowLamports: bigint;
  decided: boolean;
  /** Graduation-chaser decision made (chase is checked on every batch, not once). */
  chased: boolean;
  /** Highest price seen (SOL per token) and when, for the dip-buy rule. */
  peakPrice: number;
  peakSlot: number;
  /** Buy flow since the peak, for the dip-buy rule. */
  flowSincePeak: bigint;
  /** Dip-buy decision made (once per coin). */
  dipped: boolean;
}

interface Pos {
  entrySlot: number;
  tp1Done: boolean;
  /** Highest multiple of entry cost seen so far (bps). */
  peakMultBps: number;
  /** Client id of the TP1 sell currently in flight, if any. */
  tp1ClientId: string | null;
  /** Client id of the full-exit sell currently in flight, if any. */
  exitClientId: string | null;
}

const BPS = 10_000;

function priceOf(state: BotState, mint: string): number {
  const c = state.curves.get(mint);
  if (c === undefined) return 0;
  const vt = Number(c.virtual_token_reserves);
  const vq = Number(c.virtual_quote_reserves);
  if (vt <= 0 || vq <= 0) return 0;
  return vq / vt;
}

export function createStrategy(p: Params): Bot {
  const coins = new Map<string, Coin>();
  const myPos = new Map<string, Pos>();

  return {
    onBatch(state: BotState, batch: Batch): OrderInput[] {
      const orders: OrderInput[] = [];

      // 0. Fold this batch's fills into exit bookkeeping: a sell is only done when its
      //    fill arrives filled; a rejected/failed fill re-arms the step.
      for (const f of batch.fills) {
        if (f.side !== 'sell') continue;
        const pos = myPos.get(f.mint);
        if (pos === undefined) continue;
        if (pos.tp1ClientId === f.client_id) {
          pos.tp1ClientId = null;
          if (f.status === 'filled') pos.tp1Done = true;
        }
        if (pos.exitClientId === f.client_id) {
          pos.exitClientId = null;
        }
      }

      // 1. Fold this batch's events into per-coin bookkeeping.
      for (const e of batch.events) {
        if (e.event === 'CreateEvent') {
          const vt = Number(e.virtual_token_reserves);
          const vq = Number(e.virtual_quote_reserves);
          coins.set(e.mint, {
            createdSlot: e.slot,
            createPrice: vt > 0 && vq > 0 ? vq / vt : 0,
            flowLamports: 0n,
            decided: false,
            chased: false,
            peakPrice: vt > 0 && vq > 0 ? vq / vt : 0,
            peakSlot: e.slot,
            flowSincePeak: 0n,
            dipped: false,
          });
        } else if (e.event === 'TradeEvent') {
          const c = coins.get(e.mint);
          if (c !== undefined && e.is_buy && batch.slot - c.createdSlot <= p.observeSlots) {
            c.flowLamports += BigInt(e.sol_amount);
          }
          if (c !== undefined) {
            const vt = Number(e.virtual_token_reserves);
            const vq = Number(e.virtual_quote_reserves);
            if (vt > 0 && vq > 0) {
              const price = vq / vt;
              if (price > c.peakPrice) {
                c.peakPrice = price;
                c.peakSlot = e.slot;
                c.flowSincePeak = 0n;
              } else if (e.is_buy) {
                c.flowSincePeak += BigInt(e.sol_amount);
              }
            }
          }
        } else if (e.event === 'CompleteEvent') {
          coins.delete(e.mint);
          myPos.delete(e.mint);
        }
      }

      // 1b. Prune bookkeeping for positions that actually left the account.
      for (const mint of [...myPos.keys()]) {
        if (!state.positions.has(mint) && ![...state.pending.values()].some((po) => po.order.mint === mint)) {
          myPos.delete(mint);
        }
      }

      // 2. Exits: bank profits / cut losses on what we hold.
      for (const [mint, holding] of state.positions) {
        const pos = myPos.get(mint);
        if (pos === undefined) continue; // a position we did not open (should not happen)
        if (pos.exitClientId !== null) continue; // full exit already in flight
        const price = priceOf(state, mint);
        if (price <= 0) continue;
        const costPerToken = Number(holding.cost_lamports) / Number(holding.token_amount);
        if (costPerToken <= 0) continue;
        const multBps = Math.floor((price / costPerToken) * BPS);
        if (multBps > pos.peakMultBps) pos.peakMultBps = multBps;
        const sellAll = (): void => {
          const id = state.clientId();
          pos.exitClientId = id;
          orders.push({ side: 'sell', mint, token_amount: holding.token_amount, max_slippage_bps: p.maxSlippageBps, client_id: id });
        };
        // Time exit: a coin that never moves still ties up one of the 5 position slots.
        if (batch.slot - pos.entrySlot >= p.maxHoldSlots) {
          sellAll();
        } else if (multBps >= p.tp2MultBps) {
          sellAll();
        } else if (multBps >= p.tp1MultBps && !pos.tp1Done && pos.tp1ClientId === null) {
          const sell = (holding.token_amount * BigInt(p.tp1FracBps)) / BigInt(BPS);
          if (sell > 0n) {
            const id = state.clientId();
            pos.tp1ClientId = id;
            orders.push({ side: 'sell', mint, token_amount: sell, max_slippage_bps: p.maxSlippageBps, client_id: id });
          }
        } else if (multBps <= p.stopMultBps) {
          sellAll();
        } else if (
          p.trailArmMultBps > 0 &&
          pos.peakMultBps >= p.trailArmMultBps &&
          multBps <= pos.peakMultBps - (pos.peakMultBps * p.trailRetraceBps) / BPS
        ) {
          // Trailing exit: bank the run once it gives back a third of the peak.
          sellAll();
        }
      }

      // 3. Entries: coins whose observe window just closed and passed the filter.
      const tryBuy = (mint: string): void => {
        if (state.committedPositionCount() >= state.hello.caps.max_open_positions) return;
        const cap = state.maxBuyLamports(mint);
        if (cap <= 0n) return;
        // Dust guard: a buy smaller than 0.01 SOL is all tx fee (0.00021 SOL per round
        // trip) and can never clear the minimum-bar round trip either — skip the coin.
        if (cap < 10_000_000n) return;
        let size = p.stakeLamports < cap ? p.stakeLamports : cap;
        const free = state.freeCashLamports() - state.txFeeLamports();
        if (free <= 0n) return;
        if (size > free) size = free;
        if (size <= 0n) return;
        orders.push({ side: 'buy', mint, quote_lamports: size, max_slippage_bps: p.maxSlippageBps });
        myPos.set(mint, { entrySlot: batch.slot, tp1Done: false, peakMultBps: BPS, tp1ClientId: null, exitClientId: null });
      };

      for (const [mint, c] of coins) {
        if (c.decided) continue;
        const age = batch.slot - c.createdSlot;
        if (age < p.observeSlots) continue;
        c.decided = true;
        if (c.flowLamports < p.flowMinLamports) continue;
        if (p.momentumMinBps > 0) {
          const price = priceOf(state, mint);
          if (price <= 0 || c.createPrice <= 0) continue;
          if (Math.floor((price / c.createPrice) * BPS) < p.momentumMinBps) continue;
        }
        tryBuy(mint);
      }

      // 3b. Graduation-chaser entries: buy when real reserves reach the threshold.
      // Checked every batch (not once): the coin can cross the threshold at any age.
      if (p.chaseRqMinLamports > 0n) {
        for (const [mint, c] of coins) {
          if (c.chased || myPos.has(mint)) continue;
          const curve = state.curves.get(mint);
          if (curve === undefined || curve.complete) continue;
          if (curve.real_quote_reserves < p.chaseRqMinLamports) continue;
          if (p.chaseMultMinBps > 0) {
            const price = priceOf(state, mint);
            if (price <= 0 || c.createPrice <= 0) continue;
            if (Math.floor((price / c.createPrice) * BPS) < p.chaseMultMinBps) continue;
          }
          c.chased = true;
          tryBuy(mint);
        }
      }

      // 3c. Dip-buy entries: buy the bounce after a sharp fall from the peak, once the
      // fresh buy flow shows buyers returning.
      if (p.dipDropBps > 0) {
        for (const [mint, c] of coins) {
          if (c.dipped || myPos.has(mint)) continue;
          if (c.peakPrice <= 0) continue;
          if (batch.slot - c.peakSlot > p.dipWindowSlots) continue;
          const price = priceOf(state, mint);
          if (price <= 0) continue;
          if (price * BPS > c.peakPrice * (BPS - p.dipDropBps)) continue;
          if (c.flowSincePeak < p.dipFlowMinLamports) continue;
          c.dipped = true;
          tryBuy(mint);
        }
      }

      return orders;
    },
  };
}

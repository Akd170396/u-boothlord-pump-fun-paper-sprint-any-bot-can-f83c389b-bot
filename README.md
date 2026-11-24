# u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b-bot

[![make.fun · u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b](https://make.fun/badge/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b.svg)](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b?utm_source=github&utm_medium=readme&utm_campaign=u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b)
[![rank](https://make.fun/badge/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b/Akd170396/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b-bot/rank.svg)](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b)
[![reward](https://make.fun/badge/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b/Akd170396/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b-bot/reward.svg)](https://make.fun/bounty/u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b?utm_source=github&utm_medium=readme&utm_campaign=u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b)

A fast flow-sniper that paper-trades pump.fun on a 6-hour replay. Best net PnL wins. Free to enter.

## Strategy

Built from the dev window's own data (1,222 mints, 35 completions, 24h):

- **Early buy flow is the only reliable signal.** Coins with >= 60 SOL of buy flow in their first 600 slots complete 31.5% of the time and always peak >= 2x; coins with < 10 SOL of early flow almost never peak >= 2x.
- **Peaks come fast.** The median strong coin peaks ~135 slots (~1 minute) after creation and then gives back ~73% of the peak. So: observe only 30 slots, enter on >= 20 SOL of buy flow with price already +50% vs creation, exit fast.
- **Exits:** sell half at +25%, let the rest run to +400% (the rare runner pays), stop at -15%, trailing stop armed at +100% (exit on a 40% retrace), hard max-hold of 120 slots so a flat coin never ties up one of the 5 position slots.
- **Fill-aware bookkeeping:** a sell is only treated as done when its fill arrives filled; a rejected/failed fill re-arms the step, so a position can never be orphaned with no exit logic (an earlier version lost a whole run to that bug — positions stuck open, blocking all new entries).
- **Size:** 0.01 SOL per trade (the minimum-bar round-trip size), dust-guarded so a buy below 0.01 SOL is never placed.

## Dev grade (honest)

`makefun grade-local` on the dev kit: **net PnL -0.056 SOL** (local replay sim: -0.049 SOL), 110 round trips on 110 coins, win rate 37%, max drawdown 0.8%. Ranked, but **not prize-eligible** (net PnL must be > 0 to race in the final). ~80 parameter combinations across 7 strategy families were swept (flow-sniper, buy-everything, momentum, graduation-chaser, dip-buy reversion, small/large stakes, short/long holds); every one lost in dev — the best of them is shipped here. The final window is a fresh 6 hours of forward data, so the dev number is a guide, not a verdict.

## Run it

```sh
node main.ts
```

Requires Node 22.18 or later (the grader runs Node 22). The harness speaks NDJSON over stdin/stdout; see the competition kit for the protocol. `tools/` holds the local dev tooling (full-window dataset loader, backtest and sweep runners) used for the parameter search above.

---

<sub>Entered on [make.fun](https://make.fun/?ref=s3svssng&utm_source=github&utm_medium=readme&utm_campaign=u-boothlord-pump-fun-paper-sprint-any-bot-can-f83c389b) · AI agents build software for cash rewards</sub>

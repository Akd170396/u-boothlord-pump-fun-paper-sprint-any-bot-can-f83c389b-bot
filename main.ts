// Pump.fun Paper Sprint: Any Bot Can Win — entry bot.
//
// A fast flow-sniper: watch each newborn coin for a short window, enter on strong early
// buy flow, bank profits in stages and cut losses fast. See strategy.ts for the reasoning
// and the parameters. Runs under the grader's fixed command `node /bot/main.ts` (Node 22
// strips the types; no build step, no dependencies, no network, fully deterministic).

import { runBot } from './vendor/makefun-bot.ts';
import { createStrategy, DEFAULT_PARAMS } from './strategy.ts';

await runBot(createStrategy(DEFAULT_PARAMS));

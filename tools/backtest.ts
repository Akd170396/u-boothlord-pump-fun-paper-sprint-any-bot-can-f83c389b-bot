// Backtest one parameter set on the full dev window.
//   node tools/backtest.ts ['{"observeSlots":90,"flowMinLamports":"3000000000"}']
import { loadFullDataset, grade, sol, oneLine } from './dev.ts';
import { createStrategy, DEFAULT_PARAMS, type Params } from '../strategy.ts';

const overrides = process.argv[2] !== undefined && process.argv[2].startsWith('{') ? JSON.parse(process.argv[2]) : {};
// JSON cannot carry bigint: flowMin/stake arrive as decimal strings.
for (const k of ['flowMinLamports', 'stakeLamports']) {
  if (typeof overrides[k] === 'string') overrides[k] = BigInt(overrides[k]);
}
const params: Params = { ...DEFAULT_PARAMS, ...overrides };
const ds = loadFullDataset();
const r = grade(ds, createStrategy(params));
console.log(oneLine(JSON.stringify(params, (k, v) => (typeof v === 'bigint' ? v.toString() : v)), r));
if (process.argv.includes('--trips')) {
  for (const t of r.trips) console.log(t.mint.slice(0, 8), 'open', t.open, 'len', t.close - t.open, sol(t.pnl));
}

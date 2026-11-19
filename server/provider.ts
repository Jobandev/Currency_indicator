import { z } from 'zod';
import { PAIRS, type Rate } from '../shared/domain.js';
const row = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  base: z.string(),
  quote: z.string(),
  rate: z.number().positive().finite(),
});
export interface RateProvider {
  latest(): Promise<Rate[]>;
  history(pair: string, from?: string, to?: string): Promise<{ date: string; rate: number }[]>;
}
async function request(path: string) {
  const response = await fetch('https://api.frankfurter.dev/v2/' + path, {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Rate provider returned ' + response.status);
  return z.array(row).parse(await response.json());
}
export class Frankfurter implements RateProvider {
  async latest() {
    const rates: Rate[] = [];
    for (const base of [...new Set(PAIRS.map((p) => p.split('/')[0]))]) {
      const quotes = PAIRS.filter((p) => p.startsWith(base + '/'))
        .map((p) => p.split('/')[1])
        .join(',');
      for (const r of await request('rates?base=' + base + '&quotes=' + quotes))
        rates.push({
          currencyPair: r.base + '/' + r.quote,
          rate: r.rate,
          provider: 'Frankfurter · daily reference',
          providerTimestamp: r.date + 'T00:00:00Z',
          fetchedAt: Date.now(),
        });
    }
    return rates.filter((r) => PAIRS.includes(r.currencyPair as (typeof PAIRS)[number]));
  }
  async history(
    pair: string,
    from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    to?: string,
  ) {
    const [base, quote] = pair.split('/');
    return (
      await request(
        'rates?base=' + base + '&quotes=' + quote + '&from=' + from + (to ? '&to=' + to : ''),
      )
    ).map((r) => ({ date: r.date, rate: r.rate }));
  }
}

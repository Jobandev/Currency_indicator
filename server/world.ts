import { z } from 'zod';
import { CURRENCY_CODES, type Rate } from '../shared/domain.js';
import { adminReady, db } from './firebase.js';
const featuredCodes = new Set<string>(CURRENCY_CODES);
const currencySchema = z.array(
  z.object({ iso_code: z.string(), name: z.string(), type: z.string() }),
);
const rateSchema = z.array(
  z.object({
    base: z.string(),
    quote: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    rate: z.number().positive().finite(),
  }),
);
let catalog: { code: string; name: string }[] = [];
let catalogAt = 0;
const cache = new Map<string, { at: number; rates: Rate[] }>();
const pending = new Map<string, Promise<Rate[]>>();
async function request(path: string) {
  const response = await fetch('https://api.frankfurter.dev/v2/' + path, {
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error('Currency provider returned ' + response.status);
  return response.json();
}
export async function currencies() {
  if (catalog.length && Date.now() - catalogAt < 3600000) return catalog;
  const rows = currencySchema.parse(await request('currencies'));
  catalog = rows
    .filter((r) => r.type === 'currency' && featuredCodes.has(r.iso_code))
    .map((r) => ({ code: r.iso_code, name: r.name }))
    .sort((a, b) => a.code.localeCompare(b.code));
  catalogAt = Date.now();
  return catalog;
}
export async function worldRates(base: string, allowCached = false) {
  if (!featuredCodes.has(base)) throw new Error('Unsupported base currency');
  const existing = cache.get(base);
  if (existing && Date.now() - existing.at < 15 * 60000) return existing.rates;
  if (!pending.has(base))
    pending.set(
      base,
      (async () => {
        const ref =
          adminReady && process.env.FIREBASE_PROJECT_ID
            ? db.collection('worldRateSnapshots').doc(base)
            : undefined;
        const stored = await ref
          ?.get()
          .then((snapshot) => snapshot.data() as { at: number; rates: Rate[] } | undefined)
          .catch(() => undefined);
        if (stored?.rates.length && Date.now() - stored.at < 15 * 60000) {
          cache.set(base, stored);
          return stored.rates;
        }
        let rates: Rate[];
        try {
          const rows = rateSchema.parse(await request('rates?base=' + encodeURIComponent(base)));
          rates = rows
            .filter((r) => r.base === base && r.quote !== base && featuredCodes.has(r.quote))
            .map((r) => ({
              currencyPair: r.base + '/' + r.quote,
              rate: r.rate,
              provider: 'Frankfurter',
              providerTimestamp: r.date + 'T00:00:00Z',
              fetchedAt: Date.now(),
            }));
          if (!rates.length) throw new Error('No reference rates available for this currency');
        } catch (error) {
          if (stored?.rates.length) cache.set(base, stored);
          throw error;
        }
        const snapshot = { at: Date.now(), rates };
        cache.set(base, snapshot);
        await ref?.set(snapshot).catch(() => {});
        return rates;
      })().finally(() => pending.delete(base)),
    );
  try {
    return await pending.get(base)!;
  } catch (error) {
    const cached = cache.get(base);
    if (allowCached && cached) return cached.rates;
    throw error;
  }
}

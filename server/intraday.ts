import { z } from 'zod';
import { CURRENCY_CODES, type Rate } from '../shared/domain.js';
import { db } from './firebase.js';

const snapshot = z.object({
  base: z.literal('USD'),
  result: z.literal('success'),
  rates: z.record(z.string(), z.number().finite().positive()),
  effective_at: z.record(z.string(), z.iso.datetime()),
  sources: z.record(z.string(), z.string()),
  stale: z.record(z.string(), z.boolean()),
});
type Snapshot = z.infer<typeof snapshot>;

export function observedRate(pair: string, data: Snapshot, fetchedAt: number): Rate | undefined {
  const [base, quote] = pair.split('/');
  const legs = [base, quote].filter((code) => code !== 'USD');
  if (
    legs.some(
      (code) =>
        data.sources[code] !== 'live' ||
        data.stale[code] !== false ||
        !data.effective_at[code] ||
        !data.rates[code],
    )
  )
    return;
  return {
    currencyPair: pair,
    rate: (quote === 'USD' ? 1 : data.rates[quote]) / (base === 'USD' ? 1 : data.rates[base]),
    provider: 'exchangerate.dev',
    kind: 'intraday',
    providerTimestamp: legs.map((code) => data.effective_at[code]).sort()[0],
    fetchedAt,
  };
}

const supportedPairs = CURRENCY_CODES.flatMap((base) =>
  CURRENCY_CODES.filter((quote) => base !== quote).map((quote) => base + '/' + quote),
);

function rememberRates(rates: Map<string, Rate>, data: Snapshot, fetchedAt: number) {
  for (const pair of supportedPairs) {
    const rate = observedRate(pair, data, fetchedAt);
    const previous = rates.get(pair);
    if (
      rate &&
      (!previous || Date.parse(rate.providerTimestamp) >= Date.parse(previous.providerTimestamp))
    )
      rates.set(pair, rate);
  }
}

const record = () => db.collection('system').doc('intradayRates');

export function intradayConfigured() {
  return (
    Boolean(process.env.EXCHANGERATE_DEV_API_KEY) || process.env.EXCHANGERATE_DEV_KEYLESS === 'true'
  );
}

export async function refreshIntraday(now = Date.now()) {
  const key = process.env.EXCHANGERATE_DEV_API_KEY;
  if (!intradayConfigured()) return;
  const requested = Number(process.env.RATE_MONITOR_INTERVAL_MINUTES || 30);
  const interval = (Number.isFinite(requested) ? Math.max(30, requested) : 30) * 60000;
  const ref = record();
  const claimed = await db.runTransaction(async (t) => {
    const previous = (await t.get(ref)).data();
    if (previous?.nextFetchAt > now) return false;
    t.set(ref, { nextFetchAt: now + interval }, { merge: true });
    return true;
  });
  if (!claimed) return;
  const response = await fetch(
    'https://api.exchangerate.dev/v1/latest/USD?symbols=' +
      CURRENCY_CODES.filter((code) => code !== 'USD').join(','),
    {
      headers: key ? { Authorization: 'Bearer ' + key } : undefined,
      signal: AbortSignal.timeout(12000),
    },
  );
  if (response.status === 429) {
    const header = response.headers.get('Retry-After');
    const delay =
      header && /^\d+$/.test(header) ? Number(header) * 1000 : Date.parse(header || '') - now;
    await ref.set(
      { nextFetchAt: now + Math.max(interval, Number.isFinite(delay) ? delay : 3600000) },
      { merge: true },
    );
  }
  if (!response.ok) throw new Error('Intraday provider returned ' + response.status);
  const data = snapshot.parse(await response.json());
  const fetchedAt = Date.now();
  await db.runTransaction(async (t) => {
    const previous = (await t.get(ref)).data();
    if (previous?.fetchedAt > fetchedAt) return;
    const rates = new Map<string, Rate>(
      (previous?.lastMarketRates as Rate[] | undefined)?.map((rate) => [rate.currencyPair, rate]),
    );
    if (previous?.data) rememberRates(rates, previous.data, previous.fetchedAt);
    rememberRates(rates, data, fetchedAt);
    t.set(ref, { ...previous, data, fetchedAt, lastMarketRates: [...rates.values()] });
  });
}

export async function intradayRates(pairs: string[], includeLastRecorded = false) {
  if (!pairs.length) return [];
  const entry = (await record().get()).data();
  if (!entry?.data) return [];
  const saved = new Map<string, Rate>(
    includeLastRecorded
      ? (entry.lastMarketRates as Rate[] | undefined)?.map((rate) => [rate.currencyPair, rate])
      : undefined,
  );
  return pairs.flatMap((pair) => {
    const current = observedRate(pair, entry.data, entry.fetchedAt);
    const previous = saved.get(pair);
    const rate =
      current &&
      (!previous || Date.parse(current.providerTimestamp) >= Date.parse(previous.providerTimestamp))
        ? current
        : previous;
    return rate ? [rate] : [];
  });
}

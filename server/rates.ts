import { intradayRates } from './intraday.js';
import { worldRates } from './world.js';
import { db, adminReady } from './firebase.js';
import { PAIRS } from '../shared/domain.js';
import { Frankfurter } from './provider.js';
import type { Rate } from '../shared/domain.js';
export const provider = new Frankfurter();
let pending: Promise<Rate[]> | undefined;
let memory: Rate[] = [];
const histories = new Map<string, { rows: { date: string; rate: number }[]; fetchedAt: number }>();
export async function getRates() {
  const configured = !!process.env.FIREBASE_PROJECT_ID && adminReady;
  const cached = configured
    ? (await db.collection('exchangeRates').get()).docs.map((d) => d.data() as Rate)
    : memory;
  if (cached.length === PAIRS.length && cached.every((r) => Date.now() - r.fetchedAt < 15 * 60000))
    return cached;
  if (!pending)
    pending = refresh(configured).finally(() => {
      pending = undefined;
    });
  return pending;
}
async function refresh(configured: boolean) {
  const rates = await provider.latest();
  if (rates.length !== PAIRS.length) throw new Error('Incomplete rates from provider');
  if (configured) {
    const batch = db.batch();
    for (const r of rates)
      batch.set(db.collection('exchangeRates').doc(r.currencyPair.replace('/', '_')), r);
    await batch.commit();
  } else memory = rates;
  return rates;
}
export async function history(pair: string, from?: string, to?: string) {
  if (from) {
    const key = [pair, from, to].join(':');
    const cached = histories.get(key);
    if (cached && Date.now() - cached.fetchedAt < 3600000) return cached.rows;
    const rows = await provider.history(pair, from, to);
    if (histories.size >= 100) histories.delete(histories.keys().next().value!);
    histories.set(key, { rows, fetchedAt: Date.now() });
    return rows;
  }
  const configured = !!process.env.FIREBASE_PROJECT_ID && adminReady,
    ref = db.collection('rateHistory').doc(pair.replace('/', '_'));
  const cached = configured ? (await ref.get()).data() : histories.get(pair);
  if (cached && Date.now() - cached.fetchedAt < 3600000) return cached.rows;
  const rows = await provider.history(pair),
    entry = { rows, fetchedAt: Date.now() };
  if (configured) await ref.set(entry);
  else histories.set(pair, entry);
  return rows;
}

export async function getAlertRates(pairs: string[], source?: string) {
  const unique = [...new Set(pairs)];
  if (!unique.length) return [];
  if (source === 'intraday') return intradayRates(unique);
  const groups = await Promise.all(
    [...new Set(unique.map((p) => p.split('/')[0]))].map((base) => worldRates(base)),
  );
  return groups.flat().filter((rate) => unique.includes(rate.currencyPair));
}

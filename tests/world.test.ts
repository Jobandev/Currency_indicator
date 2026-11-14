import { afterEach, expect, it, vi } from 'vitest';
import { currencies, worldRates } from '../server/world';
afterEach(() => vi.restoreAllMocks());
it('lists national currencies, excludes other assets, filters rates and caches by base', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).endsWith('/currencies'))
      return new Response(
        JSON.stringify([
          { iso_code: 'NZD', name: 'New Zealand Dollar', type: 'currency' },
          { iso_code: 'JPY', name: 'Japanese Yen', type: 'currency' },
          { iso_code: 'BTC', name: 'Bitcoin', type: 'crypto' },
        ]),
      );
    return new Response(
      JSON.stringify([
        { base: 'NZD', quote: 'JPY', rate: 90, date: '2026-11-13' },
        { base: 'NZD', quote: 'BTC', rate: 0.001, date: '2026-11-13' },
      ]),
    );
  });
  expect((await currencies()).map((c) => c.code)).toEqual(['JPY', 'NZD']);
  const rates = await worldRates('NZD');
  expect(rates.map((r) => r.currencyPair)).toEqual(['NZD/JPY']);
  expect(rates[0].rate).toBe(90);
  expect(await worldRates('NZD')).toEqual(rates);
  expect(fetch).toHaveBeenCalledTimes(2);
  await expect(worldRates('XYZ')).rejects.toThrow('Unsupported');
});

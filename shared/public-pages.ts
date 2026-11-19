export const currencyPages = {
  '/rates/nzd-inr': ['NZD', 'INR'],
  '/rates/aud-inr': ['AUD', 'INR'],
  '/rates/usd-inr': ['USD', 'INR'],
  '/rates/gbp-inr': ['GBP', 'INR'],
  '/rates/eur-inr': ['EUR', 'INR'],
  '/rates/nzd-usd': ['NZD', 'USD'],
} as const;

export function currencyPage(path: string) {
  return Object.hasOwn(currencyPages, path)
    ? currencyPages[path as keyof typeof currencyPages]
    : undefined;
}

export const publicPages = {
  '/': [
    'Currency converter and exchange-rate alerts',
    'Convert currencies, check dated exchange rates and set a free rate alert.',
    'Check the rate. Set your target.',
  ],
  '/charts': [
    'Historical exchange rates',
    'Explore daily reference rates, rolling averages and historical highs and lows.',
    'Exchange-rate history',
  ],
  '/planner': [
    'Transfer planner',
    'Estimate how much your recipient could receive and compare quotes with external providers.',
    'Transfer planner',
  ],
  '/legal/privacy': [
    'Privacy policy',
    'Learn how RateWatch handles account information, alerts and notification preferences.',
    'Privacy policy',
  ],
  '/legal/terms': [
    'Terms of service',
    'Read the terms for using the RateWatch currency information and alert service.',
    'Terms of service',
  ],
  '/legal/disclaimer': [
    'Financial information disclaimer',
    'Learn what indicative exchange rates mean and why a provider quote can differ.',
    'Financial information disclaimer',
  ],
} as const;

export const currencyPageMetadata = ([base, quote]: readonly [string, string]) =>
  [
    base + ' to ' + quote + ' exchange rate',
    'Convert ' +
      base +
      ' to ' +
      quote +
      ', check the exchange-rate source and observation date, and create a rate alert.',
    base + ' to ' + quote + ' exchange rate',
  ] as const;

export function publicPage(path: string) {
  if (Object.hasOwn(publicPages, path)) return publicPages[path as keyof typeof publicPages];
  const pair = currencyPage(path);
  if (pair) return currencyPageMetadata(pair);
}

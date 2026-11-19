import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { CURRENCY_CODES, fresh, type Rate } from '../shared/domain';
import { api } from './api';
import { format } from './ui';

export default function Converter({
  initialBase = 'NZD',
  initialQuote = 'INR',
}: {
  initialBase?: string;
  initialQuote?: string;
}) {
  const [base, setBase] = useState(initialBase);
  const [quote, setQuote] = useState(initialQuote);
  const [amount, setAmount] = useState('100');
  const [result, setResult] = useState<{ pair: string; rate: Rate | null }>();
  const pair = base + '/' + quote;
  useEffect(() => {
    if (base === quote) return;
    const controller = new AbortController();
    Promise.allSettled([
      api<Rate | null>('/observed-rate?pair=' + encodeURIComponent(pair), {
        signal: controller.signal,
      }),
      api<Rate[]>('/world-rates?base=' + base, { signal: controller.signal }),
    ]).then(([observed, daily]) => {
      if (controller.signal.aborted) return;
      const intraday = observed.status === 'fulfilled' ? observed.value : null;
      const reference =
        daily.status === 'fulfilled'
          ? daily.value.find((rate) => rate.currencyPair === pair)
          : null;
      setResult({ pair, rate: intraday && fresh(intraday) ? intraday : (reference ?? intraday) });
    });
    return () => controller.abort();
  }, [base, quote, pair]);
  const rate = result?.pair === pair ? result.rate : undefined;
  const value =
    amount.trim() && Number(amount) >= 0 && Number.isFinite(Number(amount)) ? Number(amount) : null;
  const converted = value === null || !rate ? null : value * rate.rate;
  const date =
    rate &&
    new Intl.DateTimeFormat('en-NZ', {
      dateStyle: 'medium',
      ...(rate.kind === 'intraday' ? ({ timeStyle: 'short' } as const) : { timeZone: 'UTC' }),
    }).format(new Date(rate.providerTimestamp));
  return (
    <section className="card converter" aria-labelledby="converter-heading">
      <h2 id="converter-heading">Currency converter</h2>
      <label>
        Amount
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      <div className="currency-controls">
        <label>
          From
          <select value={base} onChange={(event) => setBase(event.target.value)}>
            {CURRENCY_CODES.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="button secondary"
          aria-label="Swap currencies"
          onClick={() => {
            setBase(quote);
            setQuote(base);
          }}
        >
          <ArrowLeftRight size={19} />
        </button>
        <label>
          To
          <select value={quote} onChange={(event) => setQuote(event.target.value)}>
            {CURRENCY_CODES.map((code) => (
              <option key={code}>{code}</option>
            ))}
          </select>
        </label>
      </div>
      <div role="status" className="conversion-result converter-output">
        {base === quote ? (
          <p>Choose two different currencies.</p>
        ) : rate === undefined ? (
          <p>Loading rate…</p>
        ) : !rate ? (
          <p>Exchange rate unavailable. Try another pair.</p>
        ) : (
          <>
            <strong>
              {converted !== null && Number.isFinite(converted)
                ? format(converted, 2) + ' ' + quote
                : 'Enter a valid amount'}
            </strong>
            <p>
              1 {base} = {format(rate.rate, 6)} {quote}
            </p>
            <small>
              {rate.kind === 'intraday' ? (
                <a href="https://exchangerate.dev/">Rates by Exchangerate.dev</a>
              ) : (
                <a href="https://frankfurter.dev/">Frankfurter daily reference</a>
              )}{' '}
              · {date}
              {!fresh(rate) ? ' · Older observation' : rate.kind ? ' · Delayed observation' : ''}
            </small>
          </>
        )}
      </div>
      {base !== quote && (
        <Link
          className="button full"
          to={
            '/alerts/new?pair=' +
            encodeURIComponent(pair) +
            (rate?.kind && fresh(rate) ? '&source=intraday' : '')
          }
        >
          Create free alert
        </Link>
      )}
    </section>
  );
}

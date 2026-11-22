import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CURRENCY_CODES, type Rate } from '../shared/domain';
import { api } from './api';
import { displayRateLabel, format } from './ui';

export default function Converter({
  initialBase = 'NZD',
  initialQuote = 'INR',
  appearance = 'default',
}: {
  initialBase?: string;
  initialQuote?: string;
  appearance?: 'default' | 'editorial';
}) {
  const [base, setBase] = useState(initialBase);
  const [quote, setQuote] = useState(initialQuote);
  const [amount, setAmount] = useState('100');
  const [result, setResult] = useState<{ pair: string; rate: Rate | null }>();
  const [request, setRequest] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const editorial = appearance === 'editorial';
  const pair = base + '/' + quote;
  useEffect(() => {
    if (base === quote) return;
    const controller = new AbortController();
    api<Rate | null>('/observed-rate?pair=' + encodeURIComponent(pair) + '&fallback=reference', {
      signal: controller.signal,
    })
      .then((rate) => {
        if (!controller.signal.aborted) setResult({ pair, rate });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ pair, rate: null });
      });
    return () => controller.abort();
  }, [base, quote, pair, request]);
  const rate = result?.pair === pair ? result.rate : undefined;
  const value =
    amount.trim() && Number(amount) >= 0 && Number.isFinite(Number(amount)) ? Number(amount) : null;
  const converted = value === null || !rate ? null : value * rate.rate;
  const date =
    rate &&
    new Intl.DateTimeFormat('en-NZ', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(rate.providerTimestamp));
  return (
    <section
      className={editorial ? 'rw-converter' : 'card converter'}
      aria-labelledby="converter-heading"
    >
      <h2 id="converter-heading" tabIndex={-1}>
        Currency converter
      </h2>
      <label>
        Amount
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          aria-invalid={value === null}
          aria-describedby={value === null ? 'converter-amount-error' : undefined}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      {value === null && (
        <p id="converter-amount-error" className="rw-amount-error">
          Enter an amount of zero or more.
        </p>
      )}
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
          className={editorial ? 'rw-swap' : 'button secondary'}
          aria-label="Swap currencies"
          onClick={() => {
            setBase(quote);
            setQuote(base);
            setSwapped(!swapped);
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            data-swapped={swapped}
          >
            <path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" />
          </svg>
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
      <div
        role="status"
        className={editorial ? 'rw-conversion-result' : 'conversion-result converter-output'}
      >
        {base === quote ? (
          <p>Choose two different currencies.</p>
        ) : rate === undefined ? (
          <p>Loading rate…</p>
        ) : !rate ? (
          <p>No rate available for this pair.</p>
        ) : (
          <>
            <strong>
              {converted !== null && Number.isFinite(converted) ? (
                <>
                  {format(converted, 2)} <span>{quote}</span>
                </>
              ) : (
                'Enter a valid amount'
              )}
            </strong>
            <p>
              1 {base} = {format(rate.rate, 6)} {quote}
            </p>
            <small>
              {displayRateLabel(rate)} · {date}
            </small>
          </>
        )}
      </div>
      {editorial && rate === null && base !== quote && (
        <button
          type="button"
          className="rw-retry"
          onClick={() => {
            setResult(undefined);
            setRequest(request + 1);
          }}
        >
          Retry rate lookup
        </button>
      )}
      {editorial && (
        <p className="rw-converter-note">Your transfer provider may quote a different rate.</p>
      )}
      {base !== quote && (
        <Link
          className={editorial ? 'rw-button rw-alert-action' : 'button full'}
          to={'/alerts/new?pair=' + encodeURIComponent(pair)}
        >
          {editorial ? 'Create a free alert' : 'Create free alert'}
        </Link>
      )}
    </section>
  );
}

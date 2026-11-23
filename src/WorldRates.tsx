import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from './api';
import { Currency, displayRateLabel, format, friendly } from './ui';
import { CURRENCY_CODES, type Rate } from '../shared/domain';
export default function WorldRates({
  onSelect,
  onRates,
}: {
  onSelect: (pair: string) => void;
  onRates: (rates: Rate[]) => void;
}) {
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>(() =>
    CURRENCY_CODES.map((code) => ({ code, name: code })),
  );
  const [base, setBase] = useState('NZD');
  const [selectedPair, setSelectedPair] = useState('');
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pageSize, setPageSize] = useState(12);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    api<{ code: string; name: string }[]>('/currencies')
      .then((rows) => {
        if (live && rows.length) {
          const names = new Map(rows.map(({ code, name }) => [code, name]));
          setCurrencies(CURRENCY_CODES.map((code) => ({ code, name: names.get(code) ?? code })));
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [refresh]);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    setRates([]);
    setPageSize(12);
    api<Rate[]>('/world-rates?source=display&base=' + base)
      .then((rows) => {
        if (live) {
          setRates(rows);
          onRates(rows);
        }
      })
      .catch((e) => {
        if (live) setError(friendly(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [base, refresh, onRates]);
  const currencyNames = new Map(currencies.map(({ code, name }) => [code, name]));
  const matchingRate = rates.find((rate) => rate.currencyPair === selectedPair);
  const visible = matchingRate ? [matchingRate] : rates;
  return (
    <section aria-label="World currency rates">
      <div className="section-heading">
        <div>
          <h2>
            Around the world <span className="badge">EXCHANGE RATES</span>
          </h2>
          <p>Choose a currency pair or select a rate card to view its history.</p>
        </div>
        <button className="subtle" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>
          <RefreshCw size={14} /> Refresh rates
        </button>
      </div>
      <div className="world-controls">
        <label>
          From currency
          <select
            value={base}
            onChange={(e) => {
              setBase(e.target.value);
              setSelectedPair('');
            }}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code === c.name ? c.code : `${c.code} – ${c.name}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          To currency
          <select
            value={matchingRate?.currencyPair ?? ''}
            disabled={loading || !!error || !rates.length}
            onChange={(e) => {
              const pair = e.target.value;
              setSelectedPair(pair);
              setPageSize(12);
              if (pair) onSelect(pair);
            }}
          >
            <option value="">All currencies</option>
            {rates.map(({ currencyPair }) => {
              const code = currencyPair.split('/')[1];
              const name = currencyNames.get(code);
              return (
                <option key={currencyPair} value={currencyPair}>
                  {name && name !== code ? `${code} – ${name}` : code}
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <p className="muted">
        {loading
          ? 'Loading currencies...'
          : visible.length + ' available currencies | 1 ' + base + ' equals the amount shown'}
      </p>
      {error ? (
        <div className="error" role="alert">
          {error} <button onClick={() => setRefresh((n) => n + 1)}>Retry</button>
        </div>
      ) : loading ? (
        <div className="empty skeleton">Loading market rates...</div>
      ) : (
        <>
          <div className="rate-cards">
            {visible.slice(0, pageSize).map((r) => (
              <button
                className="card rate-card"
                key={r.currencyPair}
                onClick={() => onSelect(r.currencyPair)}
              >
                <Currency pair={r.currencyPair} />
                <div className="rate-value">
                  {format(r.rate)}
                  <small>{r.currencyPair.split('/')[1]}</small>
                </div>
                <div className="rate-meta muted">
                  {displayRateLabel(r)} · {new Date(r.providerTimestamp).toLocaleString('en-NZ')}
                </div>
              </button>
            ))}
          </div>
          {!visible.length && <div className="empty">No exchange rates match your selection.</div>}
          {visible.length > pageSize && (
            <button className="button outline small" onClick={() => setPageSize((n) => n + 12)}>
              Show more currencies ({visible.length - pageSize} remaining)
            </button>
          )}
        </>
      )}
    </section>
  );
}

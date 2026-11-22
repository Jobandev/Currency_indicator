import { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
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
  const [search, setSearch] = useState('');
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
  const query = search.trim().toLowerCase();
  const visible = rates.filter((r) => {
    const code = r.currencyPair.split('/')[1];
    return (code + ' ' + currencies.find((c) => c.code === code)?.name)
      .toLowerCase()
      .includes(query);
  });
  return (
    <section aria-label="World currency rates">
      <div className="section-heading">
        <div>
          <h2>
            Around the world <span className="badge">EXCHANGE RATES</span>
          </h2>
          <p>Select a currency to view its history.</p>
        </div>
        <button className="subtle" disabled={loading} onClick={() => setRefresh((n) => n + 1)}>
          <RefreshCw size={14} /> Refresh rates
        </button>
      </div>
      <div className="world-controls">
        <label>
          From currency
          <select value={base} onChange={(e) => setBase(e.target.value)}>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>
            <Search size={14} /> Find a currency
          </span>
          <input
            type="search"
            placeholder="Search currency name or code, e.g. Japan or JPY"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageSize(12);
            }}
          />
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

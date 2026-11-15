import { useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowUpRight, Bell, Check, Mail, ShieldCheck } from 'lucide-react';
import { CURRENCY_CODES, matches, type Alert, type Rate } from '../shared/domain';
import { api } from './api';
import { Currency, format, friendly, Shell, Toast, Verification } from './ui';
export default function AlertEditor() {
  const { id } = useParams(),
    navigate = useNavigate(),
    toast = useContext(Toast),
    [rates, setRates] = useState<Rate[]>([]),
    [rateLoading, setRateLoading] = useState(true);
  const [pair, setPair] = useState<string>('NZD/INR'),
    [target, setTarget] = useState(''),
    [condition, setCondition] = useState<'gte' | 'lte'>('gte'),
    [immediate, setImmediate] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(!id);
  useEffect(() => {
    if (id)
      api<Alert[]>('/alerts')
        .then((a) => {
          const found = a.find((a) => a.id === id);
          if (!found) throw new Error('Alert not found');
          setPair(found.pair);
          setTarget(String(found.targetRate));
          setCondition(found.condition);
          setLoaded(true);
        })
        .catch((e) => setError(e.message));
  }, [id]);
  const base = pair.split('/')[0];
  useEffect(() => {
    let live = true;
    setRates([]);
    setRateLoading(true);
    setError('');
    api<Rate[]>('/world-rates?base=' + base)
      .then((rows) => {
        if (live) setRates(rows);
      })
      .catch((e) => {
        if (live) setError(friendly(e));
      })
      .finally(() => {
        if (live) setRateLoading(false);
      });
    return () => {
      live = false;
    };
  }, [base]);
  const rate = rates.find((r) => r.currencyPair === pair),
    satisfied = rate && Number(target) > 0 && matches(rate.rate, Number(target), condition);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/alerts' + (id ? '/' + id : ''), {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({
          pair,
          targetRate: Number(target),
          condition,
          immediate: satisfied ? immediate : false,
        }),
      });
      toast('Alert saved. We’ll keep watch for you.');
      navigate('/dashboard');
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <Verification />
      <Link className="back-link" to="/dashboard">
        ← Back to overview
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A BETTER MOMENT IS WORTH WATCHING</span>
          <h1>{id ? 'Make this target yours.' : 'What’s your perfect rate?'}</h1>
          <p>Set your target. We’ll let you know when the reference rate gets there.</p>
        </div>
      </div>
      <div className="editor-layout">
        <section className="card editor">
          <form onSubmit={submit}>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <div className="world-controls">
              <label>
                From currency
                <select
                  value={base}
                  onChange={(e) => {
                    const next = e.target.value;
                    const quote = pair.split('/')[1];
                    setPair(
                      next + '/' + (next === quote ? (next === 'USD' ? 'NZD' : 'USD') : quote),
                    );
                    setImmediate(false);
                  }}
                >
                  {[...CURRENCY_CODES].sort().map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
              <label>
                To currency
                <select
                  value={pair.split('/')[1]}
                  onChange={(e) => {
                    setPair(base + '/' + e.target.value);
                    setImmediate(false);
                  }}
                >
                  {[...CURRENCY_CODES]
                    .filter((code) => code !== base)
                    .sort()
                    .map((code) => (
                      <option key={code}>{code}</option>
                    ))}
                </select>
              </label>
            </div>
            <div className="reference-box">
              <Currency pair={pair} />
              <div>
                <strong>{rate ? format(rate.rate) : '\u2014'}</strong>
                <small>
                  {rate
                    ? 'Reference dated ' +
                      new Date(rate.providerTimestamp).toLocaleDateString('en-NZ')
                    : rateLoading
                      ? 'Loading reference rate...'
                      : 'Reference rate unavailable'}
                </small>
              </div>
            </div>
            <label>
              Your target rate
              <input
                type="number"
                required
                min="0.000001"
                step="any"
                max="1000000"
                placeholder="Enter your target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
              <small>
                1 {pair.split('/')[0]} = your target in {pair.split('/')[1]}
              </small>
            </label>
            <fieldset>
              <legend>Notify me when the rate…</legend>
              <div className="condition-options">
                <label className={condition === 'gte' ? 'chosen' : ''}>
                  <input
                    type="radio"
                    name="condition"
                    checked={condition === 'gte'}
                    onChange={() => setCondition('gte')}
                  />
                  <ArrowUpRight size={22} />
                  <strong>Reaches or goes above</strong>
                  <small>Rate ≥ your target</small>
                </label>
                <label className={condition === 'lte' ? 'chosen' : ''}>
                  <input
                    type="radio"
                    name="condition"
                    checked={condition === 'lte'}
                    onChange={() => setCondition('lte')}
                  />
                  <ArrowUpRight size={22} style={{ transform: 'rotate(90deg)' }} />
                  <strong>Reaches or goes below</strong>
                  <small>Rate ≤ your target</small>
                </label>
              </div>
            </fieldset>
            {satisfied && (
              <div className="info">
                <strong>Your target is already satisfied.</strong>
                <p>
                  The latest reference rate meets this condition. Request an email now, or choose a
                  different target.
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={immediate}
                    onChange={(e) => setImmediate(e.target.checked)}
                  />
                  Send me an immediate notification
                </label>
              </div>
            )}
            <div className="notification-delivery-tip">
              <Mail size={20} aria-hidden="true" />
              <div>
                <strong>Your first email alert</strong>
                <p>
                  If your alert does not appear in your inbox, check Spam or Junk. In Gmail, open
                  the RateWatch email and select <strong>Report not spam</strong> or{' '}
                  <strong>Not spam</strong> to help future alerts reach your inbox.
                </p>
              </div>
            </div>
            <button
              className="button full"
              disabled={busy || !loaded || !rate || (!!satisfied && !immediate)}
            >
              {busy ? 'Saving…' : id ? 'Save & activate alert' : 'Start watching my rate'}
              <Bell size={17} />
            </button>
          </form>
        </section>
        <aside className="editor-aside">
          <span className="stat-icon">
            <ShieldCheck size={23} />
          </span>
          <h2>We’ll take it from here.</h2>
          <p>
            Your alert runs on our server, so you can close this page and carry on with your day.
          </p>
          <ul>
            <li>
              <Check size={16} />
              Checked every 15 minutes
            </li>
            <li>
              <Check size={16} />
              One email per target
            </li>
            <li>
              <Check size={16} />
              Three free active alerts
            </li>
            <li>
              <Check size={16} />
              Edit or delete anytime
            </li>
          </ul>
          <div className="info">
            These are daily reference rates. Banks and transfer providers may offer different rates
            and charge fees.
          </div>
        </aside>
      </div>
    </Shell>
  );
}

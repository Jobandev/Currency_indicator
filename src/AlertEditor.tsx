import { useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bell, Mail } from 'lucide-react';
import {
  CURRENCY_CODES,
  fresh,
  matches,
  pairSchema,
  type Alert,
  type Rate,
} from '../shared/domain';
import { api } from './api';
import { Currency, format, friendly, Session, Shell, Toast, Verification } from './ui';
export default function AlertEditor() {
  const [params] = useSearchParams();
  const requestedPair = pairSchema.safeParse(params.get('pair'));
  const [selectedChannel, setChannel] = useState<'email' | 'push'>();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [checkingChannels, setCheckingChannels] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const pushConfigured = Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY);
  const defaultChannel = pushEnabled || (!emailEnabled && pushConfigured) ? 'push' : 'email';
  const channel = selectedChannel ?? defaultChannel;
  const [rateSource, setRateSource] = useState<'daily' | 'intraday'>(
    params.get('source') === 'intraday' ? 'intraday' : 'daily',
  );
  const { user } = useContext(Session);
  const { id } = useParams(),
    navigate = useNavigate(),
    toast = useContext(Toast),
    [rates, setRates] = useState<Rate[]>([]),
    [rateLoading, setRateLoading] = useState(true);
  const guideKey = 'ratewatch:first-alert-guide:' + user?.uid;
  const [repeat, setRepeat] = useState(!id);
  const [guideHidden, setGuideHidden] = useState(() => {
    try {
      return localStorage.getItem(guideKey) === 'dismissed';
    } catch {
      return false;
    }
  });
  const [testAlert, setTestAlert] = useState(false);
  const repeats = channel === 'push' && repeat && !testAlert;
  function toggleGuide(hidden: boolean) {
    setGuideHidden(hidden);
    try {
      if (hidden) localStorage.setItem(guideKey, 'dismissed');
      else localStorage.removeItem(guideKey);
    } catch {
      /* The guide still works when browser storage is unavailable. */
    }
  }
  const [pair, setPair] = useState<string>(requestedPair.success ? requestedPair.data : 'NZD/INR'),
    [target, setTarget] = useState(''),
    [condition, setCondition] = useState<'gte' | 'lte'>('gte'),
    [immediate, setImmediate] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(!id);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      api<{ emailEnabled?: boolean }>('/health'),
      api<{ enabled: boolean }>('/push-device'),
    ]).then(([health, devices]) => {
      if (!active) return;
      if (health.status === 'fulfilled') setEmailEnabled(health.value.emailEnabled !== false);
      if (devices.status === 'fulfilled') setPushEnabled(devices.value.enabled);
      setCheckingChannels(false);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (id)
      api<Alert[]>('/alerts')
        .then((a) => {
          const found = a.find((a) => a.id === id);
          if (!found) throw new Error('Alert not found');
          setPair(found.pair);
          setRateSource(found.rateSource || 'daily');
          setChannel(found.channel || 'email');
          setRepeat(found.repeat === true);
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
    (rateSource === 'intraday'
      ? api<Rate | null>('/observed-rate?pair=' + encodeURIComponent(pair)).then((rate) =>
          rate && fresh(rate) ? [rate] : [],
        )
      : api<Rate[]>('/world-rates?base=' + base)
    )
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
  }, [base, pair, rateSource]);
  const rate = rates.find((r) => r.currencyPair === pair),
    satisfied = rate && Number(target) > 0 && matches(rate.rate, Number(target), condition);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || checkingChannels) return;
    setBusy(true);
    setError('');
    try {
      await api('/alerts' + (id ? '/' + id : ''), {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({
          pair,
          rateSource,
          channel,
          repeat: repeats,
          targetRate: Number(target),
          condition,
          immediate: satisfied ? immediate : false,
        }),
      });
      toast('Alert saved. We’ll keep watch for you.');
      navigate('/dashboard', { state: { testAlertRequested: testAlert } });
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Shell>
      <Verification />
      <div className="rate-source-control">
        <label>
          Monitoring source{' '}
          <select
            value={rateSource}
            onChange={(event) =>
              setRateSource(event.target.value === 'intraday' ? 'intraday' : 'daily')
            }
          >
            <option value="daily">Daily reference</option>
            <option value="intraday">Delayed intraday</option>
          </select>
        </label>
        {rateSource === 'intraday' && (
          <p>
            <a href="https://exchangerate.dev/">Rates by Exchangerate.dev</a>. Observations are
            delayed.{' '}
            {!rateLoading &&
              !rate &&
              'An intraday observation is currently unavailable for this pair.'}
          </p>
        )}
      </div>
      <Link className="back-link" to="/dashboard">
        ← Back to overview
      </Link>
      <div className="page-heading overview-heading">
        <div>
          <h1>{id ? 'Edit rate alert' : 'Create a rate alert'}</h1>
          <p>Choose a currency pair, a target and the direction you want to watch.</p>
        </div>
      </div>
      <div className="editor-layout">
        <section className="card editor">
          <form onSubmit={submit}>
            <div className="chart-controls">
              <label>
                Notify me by
                <select
                  value={channel}
                  disabled={checkingChannels}
                  onChange={(event) => {
                    setChannel(event.target.value === 'push' ? 'push' : 'email');
                    setTestAlert(false);
                  }}
                >
                  <option value="email" disabled={!emailEnabled}>
                    Email{emailEnabled ? '' : ' (unavailable)'}
                  </option>
                  {(pushConfigured || pushEnabled || channel === 'push') && (
                    <option value="push">Push notification</option>
                  )}
                </select>
              </label>
            </div>
            {!emailEnabled && <p>Email alerts are unavailable. Use push on a registered device.</p>}
            {channel === 'push' && (
              <p>
                {pushEnabled
                  ? 'Push goes to your registered devices. '
                  : 'Enable push on a device before saving. '}
                <Link to="/settings#push-notifications">Manage or test push on this device</Link>.
              </p>
            )}
            {channel === 'push' && !testAlert && (
              <>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={repeat}
                    onChange={(event) => setRepeat(event.target.checked)}
                  />
                  Keep watching after a push notification
                </label>
                {repeat && (
                  <p>
                    Get another push when the rate moves away from your target and then reaches it
                    again.
                  </p>
                )}
              </>
            )}
            {testAlert && <p>This test sends once.</p>}
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
                    setTestAlert(false);
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
                    setTestAlert(false);
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
                    ? (rate.kind ? 'Delayed observation ? ' : 'Reference dated ') +
                      (rate.kind
                        ? new Date(rate.providerTimestamp).toLocaleString('en-NZ')
                        : new Date(rate.providerTimestamp).toLocaleDateString('en-NZ', {
                            timeZone: 'UTC',
                          }))
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
                onChange={(e) => {
                  setTarget(e.target.value);
                  setTestAlert(false);
                }}
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
                    onChange={() => {
                      setCondition('gte');
                      setTestAlert(false);
                    }}
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
                    onChange={() => {
                      setCondition('lte');
                      setTestAlert(false);
                    }}
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
                  {repeats
                    ? 'Get a notification now, or save and wait for the rate to reach your target again.'
                    : 'The latest reference rate meets this condition. Request a notification now, or choose a different target.'}
                </p>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={immediate}
                    onChange={(e) => {
                      setImmediate(e.target.checked);
                      setTestAlert(false);
                    }}
                  />
                  Send me an immediate notification
                </label>
              </div>
            )}
            <button
              className="button full"
              disabled={
                busy ||
                !loaded ||
                !rate ||
                checkingChannels ||
                (channel === 'email' && !emailEnabled) ||
                (!!satisfied && !immediate && !repeats) ||
                (testAlert && !satisfied)
              }
            >
              {busy
                ? 'Saving...'
                : testAlert
                  ? 'Send test alert'
                  : id
                    ? 'Save changes'
                    : 'Start watching my rate'}
              <Bell size={17} />
            </button>
          </form>
        </section>
        {guideHidden ? (
          <aside className="editor-aside first-alert-collapsed">
            <button type="button" className="button outline" onClick={() => toggleGuide(false)}>
              <Mail size={17} /> Show first-email guide
            </button>
          </aside>
        ) : (
          <aside className="editor-aside first-alert-guide" aria-labelledby="first-alert-heading">
            <div className="first-alert-heading">
              <span className="first-alert-arrow">
                <ArrowRight size={25} aria-hidden="true" />
              </span>
              <span className="eyebrow">FIRST TIME HERE? START HERE</span>
            </div>
            <h2 id="first-alert-heading">Get your first alert into your inbox.</h2>
            <p>
              Try one matching-rate alert first, so you know where your RateWatch emails arrive.
            </p>
            {!id && (
              <div className="first-alert-test-action">
                <button
                  type="button"
                  className="button full"
                  disabled={busy || !loaded || rateLoading || !rate}
                  onClick={() => {
                    if (!rate) return;
                    setChannel('email');
                    setTarget(String(rate.rate));
                    setCondition('gte');
                    setImmediate(true);
                    setTestAlert(true);
                    setError('');
                  }}
                >
                  <ArrowRight size={18} /> Use current rate for a test alert
                </button>
                <p role="status">
                  {testAlert
                    ? 'Ready. Click Send test alert in the form to confirm.'
                    : 'Fills in the exact rate and enables immediate notification. You confirm before sending.'}
                </p>
                <small>This uses a regular alert slot until the email is accepted.</small>
              </div>
            )}
            <ol className="first-alert-steps">
              <li>
                <span className="first-alert-number">1</span>
                <div>
                  <strong>Match the current rate</strong>
                  <p>
                    Set your target equal to the current reference rate
                    {rate ? (
                      <>
                        {' '}
                        (<strong>{rate.rate}</strong> for {pair})
                      </>
                    ) : (
                      ''
                    )}
                    . Choose <strong>Reaches or goes above</strong>.
                  </p>
                </div>
              </li>
              <li>
                <span className="first-alert-number">2</span>
                <div>
                  <strong>Request your first email</strong>
                  <p>
                    {id ? (
                      <>
                        Tick <strong>Send me an immediate notification</strong>, then save your
                        alert.
                      </>
                    ) : (
                      <>
                        Use the test button above to set up a matching-rate alert, then click{' '}
                        <strong>Send test alert</strong> in the form.
                      </>
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span className="first-alert-number">3</span>
                <div>
                  <strong>Check Spam and select Not spam</strong>
                  <p>
                    If the email is in Spam or Junk, open it and select{' '}
                    <strong>Report not spam</strong> or <strong>Not spam</strong>. This helps future
                    alerts reach your inbox.
                  </p>
                </div>
              </li>
            </ol>
            <div className="first-alert-footer">
              <Mail size={17} aria-hidden="true" />
              <span>
                You can also add <strong>ratewatch510@gmail.com</strong> to your contacts. Then
                create an alert for the target you actually want to watch.
              </span>
            </div>
            <div className="info">
              Banks and transfer providers may offer different rates and charge fees.
            </div>
            <button
              type="button"
              className="button outline full first-alert-dismiss"
              onClick={() => toggleGuide(true)}
            >
              Got it
            </button>
          </aside>
        )}
      </div>
    </Shell>
  );
}

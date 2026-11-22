import AlertRateHistory from './AlertRateHistory';
import { useContext, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bell } from 'lucide-react';
import {
  CURRENCY_CODES,
  fresh,
  matches,
  pairSchema,
  type Alert,
  type Rate,
} from '../shared/domain';
import { api } from './api';
import PushSettings from './PushSettings';
import {
  Currency,
  displayRateLabel,
  format,
  friendly,
  Session,
  Shell,
  Toast,
  Verification,
} from './ui';
export default function AlertEditor() {
  const [params] = useSearchParams();
  const requestedImmediate = params.get('notify') === 'now';
  const requestedPair = pairSchema.safeParse(params.get('pair'));
  const [selectedChannel, setChannel] = useState<'email' | 'push' | 'both'>();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [checkingChannels, setCheckingChannels] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const pushConfigured = Boolean(import.meta.env.VITE_FIREBASE_VAPID_KEY);
  const defaultChannel = emailEnabled ? 'both' : 'push';
  const channel = selectedChannel ?? defaultChannel;
  const testDelivery = channel === 'both' ? 'email and push' : channel;
  const { user } = useContext(Session);
  const { id } = useParams(),
    navigate = useNavigate(),
    toast = useContext(Toast),
    [rates, setRates] = useState<Rate[]>([]),
    [rateLoading, setRateLoading] = useState(true);
  const testSetupKey = 'ratewatch:test-setup:' + user?.uid;
  const [showTestSetup] = useState(() => {
    try {
      return localStorage.getItem(testSetupKey) !== 'requested';
    } catch {
      return true;
    }
  });
  const [testAlert, setTestAlert] = useState(false);
  const usesPush = channel !== 'email';
  const [pair, setPair] = useState<string>(requestedPair.success ? requestedPair.data : 'NZD/INR'),
    [target, setTarget] = useState(''),
    [condition, setCondition] = useState<'gte' | 'lte'>('gte'),
    [immediate, setImmediate] = useState(requestedImmediate),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(!id);
  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      api<{ emailEnabled?: boolean }>('/health'),
      api<{ enabled: boolean }>('/push-device'),
      api<{ notificationPreferences?: { email: boolean } }>('/profile'),
    ]).then(([health, devices, profile]) => {
      if (!active) return;
      setEmailEnabled(
        (health.status !== 'fulfilled' || health.value.emailEnabled !== false) &&
          (profile.status !== 'fulfilled' ||
            profile.value.notificationPreferences?.email !== false),
      );
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
          setChannel(found.channel || 'email');
          setTarget(String(found.targetRate));
          setCondition(found.condition);
          setLoaded(true);
        })
        .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    let live = true;
    setRates([]);
    setRateLoading(true);
    setError('');
    api<Rate | null>('/observed-rate?pair=' + encodeURIComponent(pair) + '&fallback=reference')
      .then((rate) => {
        if (live) setRates(rate ? [rate] : []);
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
  }, [pair]);
  const base = pair.split('/')[0];
  const displayRate = rates.find((r) => r.currencyPair === pair);
  const rate = displayRate?.kind === 'intraday' && fresh(displayRate) ? displayRate : undefined,
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
          rateSource: 'intraday',
          channel,
          targetRate: Number(target),
          condition,
          immediate: satisfied ? immediate : false,
        }),
      });
      toast('Alert saved. We’ll keep watch for you.');
      if (testAlert) {
        try {
          localStorage.setItem(testSetupKey, 'requested');
        } catch {
          // Test alerts also work when browser storage is unavailable.
        }
      }
      navigate('/dashboard', {
        state: testAlert ? { testAlertChannel: channel, testPair: pair } : null,
      });
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
                    const value = event.target.value;
                    setChannel(value === 'both' || value === 'push' ? value : 'email');
                    setTestAlert(false);
                  }}
                >
                  <option value="email" disabled={!emailEnabled}>
                    Email{emailEnabled ? '' : ' (unavailable)'}
                  </option>
                  {(pushConfigured || pushEnabled || channel === 'push') && (
                    <option value="push">Push notification</option>
                  )}
                  <option value="both" disabled={!emailEnabled}>
                    Email and push notification
                  </option>
                </select>
              </label>
            </div>
            {!emailEnabled && <p>Email alerts are unavailable. Use push on a registered device.</p>}
            {usesPush && user && (
              <PushSettings
                uid={user.uid}
                inline
                accountHasPush={pushEnabled}
                onEnabled={() => setPushEnabled(true)}
              />
            )}

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
            {displayRate ? (
              <div className="reference-box">
                <Currency pair={pair} />
                <div>
                  <strong>{format(displayRate.rate)}</strong>
                  <small>
                    {displayRateLabel(displayRate)} ·{' '}
                    {new Date(displayRate.providerTimestamp).toLocaleString('en-NZ')}
                  </small>
                </div>
              </div>
            ) : loaded && !rateLoading && !error ? (
              <p role="status">No rate available for this pair.</p>
            ) : null}
            {displayRate && !rate && (
              <p role="status">A fresh market rate is required to save or test an alert.</p>
            )}
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
            {!id && showTestSetup && (
              <div className="info">
                <strong>First-time alert setup</strong>
                <ol>
                  <li>Use the current rate below, then send a test by email and push.</li>
                  <li>If the email lands in Spam or Junk, open it and select Not spam.</li>
                  <li>Create a new alert with the target rate you want to watch.</li>
                </ol>
              </div>
            )}
            {!id && (
              <button
                type="button"
                className="button outline small"
                disabled={busy || !loaded || rateLoading || !rate}
                onClick={() => {
                  if (!rate) return;
                  setTarget(String(rate.rate));
                  setCondition('gte');
                  setImmediate(true);
                  setTestAlert(true);
                  setError('');
                }}
              >
                <ArrowRight size={16} aria-hidden="true" /> Use current rate for a test alert
              </button>
            )}
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
            {requestedImmediate && rate && !satisfied && (
              <p className="info">
                The latest rate is {format(rate.rate)}. It needs to be{' '}
                {condition === 'gte' ? 'at or above' : 'at or below'} {format(Number(target))} to
                send this alert now.
              </p>
            )}
            {satisfied && (
              <div className="info">
                <strong>Your target is already satisfied.</strong>
                <p>The latest market rate meets your target. You can send this alert now.</p>
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
                (channel !== 'push' && !emailEnabled) ||
                (usesPush && !pushEnabled) ||
                (!!satisfied && !immediate) ||
                (testAlert && !satisfied)
              }
            >
              {busy
                ? 'Saving...'
                : testAlert
                  ? 'Send test by ' + testDelivery
                  : satisfied && immediate
                    ? 'Save and send now'
                    : id
                      ? 'Save changes'
                      : 'Start watching my rate'}
              <Bell size={17} />
            </button>
          </form>
        </section>
        <AlertRateHistory key={pair} pair={pair} target={Number(target)} />
      </div>
    </Shell>
  );
}

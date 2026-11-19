import InstallAction from './InstallAction';
import WorldRates from './WorldRates';
import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bell,
  CheckCheck,
  CircleHelp,
  Clock3,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { api } from './api';
import {
  Currency,
  format,
  friendly,
  SecurityNote,
  Session,
  Shell,
  Toast,
  useRates,
  Verification,
} from './ui';
import { fresh, pairSchema, type Alert, type Notice, type Rate } from '../shared/domain';
export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const showTestReminder = location.state?.testAlertRequested === true;
  const { user } = useContext(Session),
    toast = useContext(Toast),
    { rates } = useRates();
  const [alerts, setAlerts] = useState<Alert[]>([]),
    [notices, setNotices] = useState<Notice[]>([]),
    [dataError, setDataError] = useState(''),
    [noticeError, setNoticeError] = useState(''),
    [dataLoading, setDataLoading] = useState(true),
    [tab, setTab] = useState('active'),
    [pair, setPair] = useState<string>('NZD/INR');
  const favoritesKey = 'ratewatch:favorites:' + user?.uid;
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(favoritesKey) || '[]');
      return Array.isArray(saved)
        ? saved.filter((value) => pairSchema.safeParse(value).success).slice(0, 8)
        : [];
    } catch {
      return [];
    }
  });
  const [observations, setObservations] = useState<Rate[]>([]);
  const [deleteAlert, setDeleteAlert] = useState<Alert | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [marketRates, setMarketRates] = useState<Rate[]>([]);
  const [alertRates, setAlertRates] = useState<Rate[]>([]);
  const clearingAlertLink = useRef(false);
  const allRates = [
    ...new Map(
      [...alertRates, ...rates, ...marketRates].map((r) => [r.currencyPair, r] as const),
    ).values(),
  ];
  const reload = () => {
    setDataLoading(true);
    setDataError('');
    setNoticeError('');
    Promise.allSettled([api<Alert[]>('/alerts'), api<Notice[]>('/notifications')])
      .then(([a, n]) => {
        if (a.status === 'fulfilled') {
          setAlerts(a.value);
          const intraday = [
            ...new Set(
              a.value.filter((alert) => alert.rateSource === 'intraday').map((alert) => alert.pair),
            ),
          ];
          void Promise.allSettled(
            intraday.map((pair) =>
              api<Rate | null>('/observed-rate?pair=' + encodeURIComponent(pair)),
            ),
          ).then((results) => {
            setObservations(
              results.flatMap((result) =>
                result.status === 'fulfilled' && result.value ? [result.value] : [],
              ),
            );
          });
          const bases = [...new Set(a.value.map((alert) => alert.baseCurrency))];
          void Promise.allSettled(
            bases.map((base) => api<Rate[]>('/world-rates?base=' + base)),
          ).then((results) => {
            setAlertRates(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])));
          });
        } else setDataError(friendly(a.reason));
        if (n.status === 'fulfilled') setNotices(n.value);
        else setNoticeError(friendly(n.reason));
      })
      .finally(() => setDataLoading(false));
  };
  useEffect(() => {
    api('/profile', { method: 'POST' })
      .then(reload)
      .catch((e) => {
        setDataError(e.message);
        setDataLoading(false);
      });
  }, []);
  useEffect(() => {
    if (!location.hash) clearingAlertLink.current = false;
    if (dataLoading || !location.hash || clearingAlertLink.current) return;
    const target = location.hash.slice(1);
    if (target.startsWith('alert-')) {
      const alert = alerts.find((entry) => 'alert-' + entry.id === target);
      if (alert) {
        const desired = alert.status === 'completed' ? 'completed' : 'active';
        if (tab !== desired) {
          setTab(desired);
          return;
        }
      }
    }
    document.getElementById(target)?.scrollIntoView({ block: 'center' });
  }, [alerts, dataLoading, location.hash, tab]);
  const active = alerts.filter((a) => a.status !== 'completed'),
    completed = alerts.filter((a) => a.status === 'completed');
  function selectAlertTab(next: 'active' | 'completed') {
    if (location.hash.startsWith('#alert-')) {
      clearingAlertLink.current = true;
      navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }
    setTab(next);
  }
  return (
    <Shell>
      {deleteAlert && (
        <DeleteAlertDialog
          alert={deleteAlert}
          busy={deleting}
          error={deleteError}
          onCancel={() => setDeleteAlert(null)}
          onDelete={async () => {
            if (deleting) return;
            setDeleting(true);
            setDeleteError('');
            try {
              await api('/alerts/' + encodeURIComponent(deleteAlert.id), { method: 'DELETE' });
              setAlerts((current) => current.filter((a) => a.id !== deleteAlert.id));
              setDeleteAlert(null);
              toast(
                deleteAlert.status === 'completed' ? 'Completed alert deleted.' : 'Alert deleted.',
              );
              reload();
            } catch (e) {
              setDeleteError(friendly(e));
            } finally {
              setDeleting(false);
            }
          }}
        />
      )}
      <Verification />
      {showTestReminder && (
        <div className="test-alert-reminder" role="status">
          <Mail size={22} aria-hidden="true" />
          <div>
            <strong>Your test alert is saved. Check your email.</strong>
            <p>
              Check your inbox or Spam folder. If it is in Spam, select <strong>Not spam</strong> to
              help future alerts reach your inbox. See Recent notifications below for the sending
              status.
            </p>
          </div>
          <button
            type="button"
            className="button outline small"
            onClick={() =>
              navigate(location.pathname + location.hash, { replace: true, state: null })
            }
          >
            Got it
          </button>
        </div>
      )}
      <div className="page-heading overview-heading">
        <div>
          <h1>Rate dashboard</h1>
          <p>Manage your targets and compare the latest reference rates.</p>
        </div>
        <Link className="button" to="/alerts/new">
          <Plus size={18} /> Create an alert
        </Link>
      </div>
      <div className="dashboard-stats">
        <article>
          <span className="stat-icon">
            <Bell size={19} />
          </span>
          <div>
            <span>Active alerts</span>
            <strong>
              {dataLoading ? '\u2014' : active.filter((alert) => alert.status !== 'paused').length}
              <small> / 3</small>
            </strong>
          </div>
        </article>
        <article>
          <span className="stat-icon">
            <CheckCheck size={20} />
          </span>
          <div>
            <span>Targets reached</span>
            <strong>{dataLoading ? '\u2014' : completed.length}</strong>
          </div>
        </article>
        <article>
          <span className="stat-icon">
            <Clock3 size={20} />
          </span>
          <div>
            <span>Monitoring</span>
            <strong>Scheduled</strong>
          </div>
        </article>
      </div>
      <section id="alerts" className="card alerts-panel">
        <div className="section-heading">
          <div>
            <h2>
              Your rate alerts <span className="count">{alerts.length}</span>
            </h2>
          </div>
          <Link to="/alerts/new" className="text-link">
            New alert <Plus size={16} />
          </Link>
        </div>
        <div className="tabs">
          <button
            className={tab === 'active' ? 'active' : ''}
            aria-pressed={tab === 'active'}
            onClick={() => selectAlertTab('active')}
          >
            Active <span>{active.length}</span>
          </button>
          <button
            className={tab === 'completed' ? 'active' : ''}
            aria-pressed={tab === 'completed'}
            onClick={() => selectAlertTab('completed')}
          >
            Completed <span>{completed.length}</span>
          </button>
          <button className="subtle refresh-alerts" onClick={reload}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        {dataError ? (
          <div className="error" role="alert">
            {dataError} <button onClick={reload}>Retry</button>
          </div>
        ) : dataLoading ? (
          <div className="empty skeleton">Loading your alerts…</div>
        ) : (tab === 'active' ? active : completed).length === 0 ? (
          <div className="empty">
            <span className="empty-icon">
              <Bell size={23} />
            </span>
            <h3>{tab === 'active' ? 'No active alerts' : 'No completed alerts'}</h3>
            <p>
              {tab === 'active'
                ? 'Choose a currency pair and a target. We’ll take it from there.'
                : 'When a target is reached, you’ll find it here.'}
            </p>
            {tab === 'active' && (
              <Link className="button small" to="/alerts/new">
                <Plus size={15} />
                Create your first alert
              </Link>
            )}
          </div>
        ) : (
          <div className="table-scroll">
            <table role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col">Currency pair</th>
                  <th scope="col">Your target</th>
                  <th scope="col">Reference rate</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {(tab === 'active' ? active : completed).map((a) => (
                  <tr role="row" key={a.id} id={'alert-' + a.id}>
                    <td role="cell" className="alert-pair">
                      <Currency pair={a.pair} />
                    </td>
                    <td role="cell">
                      <span className="alert-mobile-label" aria-hidden="true">
                        Target
                      </span>
                      <strong>
                        {a.condition === 'gte' ? '\u2265' : '\u2264'} {format(a.targetRate)}
                      </strong>
                      <small>{a.condition === 'gte' ? 'At or above' : 'At or below'}</small>
                    </td>
                    <td role="cell">
                      <span className="alert-mobile-label" aria-hidden="true">
                        Reference rate
                      </span>
                      {a.rateSource !== 'intraday' &&
                      allRates.find((r) => r.currencyPair === a.pair)
                        ? format(allRates.find((r) => r.currencyPair === a.pair)!.rate)
                        : a.rateSource === 'intraday'
                          ? (() => {
                              const rate = observations.find(
                                (entry) => entry.currencyPair === a.pair,
                              );
                              return rate ? (
                                <>
                                  {format(rate.rate)}
                                  <small>
                                    {fresh(rate) ? 'Delayed' : 'Older'} observation ?{' '}
                                    {new Date(rate.providerTimestamp).toLocaleString('en-NZ')}
                                  </small>
                                </>
                              ) : (
                                '\u2014'
                              );
                            })()
                          : '\u2014'}
                      {a.rateSource === 'intraday' && (
                        <small>
                          <a href="https://exchangerate.dev/">Rates by Exchangerate.dev</a>
                        </small>
                      )}
                      {a.triggeredRate && <small>Triggered at {format(a.triggeredRate)}</small>}
                    </td>
                    <td role="cell" className="alert-status">
                      <span className={'status ' + a.status}>
                        <span className="green-dot" />
                        {a.status === 'active'
                          ? 'Watching'
                          : a.status === 'processing'
                            ? 'Notification queued'
                            : a.status === 'paused'
                              ? 'Paused'
                              : 'Completed'}
                      </span>
                    </td>
                    <td role="cell" className="alert-actions">
                      <div className="row-actions">
                        {(a.status === 'active' || a.status === 'paused') && (
                          <button
                            onClick={async () => {
                              try {
                                await api('/alerts/' + a.id, {
                                  method: 'PATCH',
                                  body: JSON.stringify({ paused: a.status === 'active' }),
                                });
                                reload();
                              } catch (error) {
                                toast(friendly(error));
                              }
                            }}
                          >
                            {a.status === 'active' ? 'Pause' : 'Resume'}
                          </button>
                        )}
                        <Link
                          aria-label={a.status === 'completed' ? 'Reactivate alert' : 'Edit alert'}
                          to={'/alerts/' + a.id + '/edit'}
                        >
                          {a.status === 'completed' ? (
                            <RefreshCw size={16} />
                          ) : (
                            <Pencil size={16} />
                          )}
                        </Link>
                        <button
                          aria-label="Delete alert"
                          onClick={() => {
                            setDeleteError('');
                            setDeleteAlert(a);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <SecurityNote />
      </section>
      <WorldRates onSelect={setPair} onRates={setMarketRates} />
      <div className="chart-calculator">
        <RateChart pair={pair} setPair={setPair} rates={allRates} />
        <Calculator rates={rates} />
      </div>
      <section className="card chart-card" aria-labelledby="favorites-heading">
        <h2 id="favorites-heading">Favourite pairs</h2>
        <p>Save pairs you want to find quickly on this device.</p>
        <div className="chart-controls">
          <button
            className="button secondary"
            disabled={
              !pairSchema.safeParse(pair).success ||
              (favorites.length >= 8 && !favorites.includes(pair))
            }
            onClick={() => {
              const updated = favorites.includes(pair)
                ? favorites.filter((item) => item !== pair)
                : [...favorites, pair];
              setFavorites(updated);
              try {
                localStorage.setItem(favoritesKey, JSON.stringify(updated));
              } catch {
                /* Available for this session. */
              }
            }}
          >
            {favorites.includes(pair) ? 'Remove ' : 'Save '}
            {pair}
          </button>
          {favorites.map((item) => (
            <button className="button secondary" key={item} onClick={() => setPair(item)}>
              {item}
            </button>
          ))}
        </div>
        <Link className="text-link" to="/planner">
          Transfer planner
        </Link>
        <InstallAction />
      </section>
      <section id="notifications" className="notification-section">
        <div className="section-heading">
          <h2>Recent notifications</h2>
          <button
            className="button outline small"
            disabled={!notices.some((n) => ['sent', 'cancelled'].includes(n.status)) || dataLoading}
            onClick={async () => {
              try {
                await api('/notifications/clear', { method: 'POST' });
                reload();
                toast('Completed updates cleared.');
              } catch (e) {
                toast(friendly(e));
              }
            }}
          >
            <Trash2 size={16} /> Clear completed
          </button>
        </div>
        {noticeError ? (
          <div className="error" role="alert">
            {noticeError} <button onClick={reload}>Retry notifications</button>
          </div>
        ) : notices.length === 0 ? (
          <div className="notification-empty">
            <Mail size={20} />
            <span>No notifications yet. We’ll be in touch when a target is reached.</span>
          </div>
        ) : (
          notices.slice(0, 8).map((n) => (
            <div className="notice" key={n.id}>
              <span className="stat-icon">
                <Mail size={19} />
              </span>
              <div>
                <strong>
                  {n.notificationType === 'digest'
                    ? 'Currency summary'
                    : n.notificationType === 'rate-tip'
                      ? '30-day high or low email'
                      : n.notificationType === 'push'
                        ? 'Push notification'
                        : 'Target alert email'}
                  {' · '}
                  {n.status === 'sent'
                    ? 'accepted'
                    : n.status === 'review_required'
                      ? 'needs review'
                      : n.status}
                </strong>
                <small>
                  {new Date(n.createdAt).toLocaleString('en-NZ')} · {n.attempts} attempt
                  {n.attempts === 1 ? '' : 's'}
                  {n.errorMessage ? ' · ' + n.errorMessage : ''}
                </small>
              </div>
              <span className="pill">{n.status}</span>
              {['sent', 'cancelled'].includes(n.status) && (
                <button
                  type="button"
                  className="button outline small notification-delete"
                  aria-label="Delete notification"
                  title="Delete notification"
                  onClick={async () => {
                    try {
                      await api('/notifications/' + encodeURIComponent(n.id), { method: 'DELETE' });
                      setNotices((current) => current.filter((notice) => notice.id !== n.id));
                      toast('Notification cleared.');
                    } catch (e) {
                      toast(friendly(e));
                    }
                  }}
                >
                  <Trash2 size={16} />
                  <span>Delete</span>
                </button>
              )}
            </div>
          ))
        )}
      </section>
      <p className="disclaimer">
        <CircleHelp size={14} /> Frankfurter daily reference rates are indicative. Your transfer
        provider may offer different rates and charge fees.
      </p>
    </Shell>
  );
}
function DeleteAlertDialog({
  alert,
  busy,
  error,
  onCancel,
  onDelete,
}: {
  alert: Alert;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onDelete: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="delete-alert-dialog"
      aria-labelledby="delete-alert-title"
      aria-describedby="delete-alert-description"
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <span className="delete-alert-icon">
        <Trash2 size={24} />
      </span>
      <h2 id="delete-alert-title">
        {alert.status === 'completed' ? 'Delete completed alert?' : 'Delete alert?'}
      </h2>
      <p id="delete-alert-description">
        {alert.status === 'completed'
          ? 'This will permanently remove your completed ' +
            alert.pair +
            ' alert from your history. This cannot be undone.'
          : 'This will permanently delete your ' +
            alert.pair +
            ' alert and cancel any queued notification. This cannot be undone.'}
      </p>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="delete-alert-actions">
        <button
          type="button"
          className="button outline"
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="button danger"
          disabled={busy}
          onClick={() => void onDelete()}
        >
          {busy ? 'Deleting...' : 'Delete alert'}
        </button>
      </div>
    </dialog>
  );
}
function RateChart({
  pair,
  setPair,
  rates,
}: {
  pair: string;
  setPair: (p: string) => void;
  rates: Rate[];
}) {
  const [data, setData] = useState<{ date: string; rate: number }[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    setData([]);
    api<{ date: string; rate: number }[]>('/history?pair=' + encodeURIComponent(pair))
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [pair]);
  const r = rates.find((r) => r.currencyPair === pair),
    change = data.length > 1 ? ((data.at(-1)!.rate - data[0].rate) / data[0].rate) * 100 : null;
  return (
    <section className="card chart-card rw-chart-panel">
      <div className="section-heading">
        <h2>30-day rate history</h2>
        <label className="sr-only" htmlFor="chart-pair">
          Chart currency pair
        </label>
        <select id="chart-pair" value={pair} onChange={(e) => setPair(e.target.value)}>
          {[...new Set([pair, ...rates.map((r) => r.currencyPair)])].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
      <div className="chart-summary">
        <strong>
          {r ? format(r.rate) : '\u2014'} <small>{pair.split('/')[1]}</small>
        </strong>
        {change !== null && (
          <span className={change >= 0 ? 'positive' : 'negative'}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}% <span>past 30 days</span>
          </span>
        )}
        <span className="chart-period">30 days</span>
      </div>
      <div className="chart-area">
        {loading ? (
          <div className="chart-message skeleton">Loading rate history…</div>
        ) : error ? (
          <div className="chart-message muted">History temporarily unavailable.</div>
        ) : data.length === 0 ? (
          <div className="chart-message">No history available.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 16, right: 12, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="rateFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#d8ff32" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#d8ff32" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#484a73" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })
                }
                axisLine={false}
                tickLine={false}
                minTickGap={40}
                tick={{ fontSize: 10, fill: '#dddaf1' }}
              />
              <YAxis
                domain={['auto', 'auto']}
                tickFormatter={(v) => Number(v).toFixed(2)}
                tick={{ fontSize: 10, fill: '#dddaf1' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v) => format(Number(v))}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #77799e',
                  background: '#202143',
                }}
                itemStyle={{ color: '#d8ff32' }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#d8ff32"
                strokeWidth={2}
                fill="url(#rateFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="chart-foot">
        <span className="green-dot" /> Frankfurter · daily reference history{' '}
        <Link to={'/charts?pair=' + encodeURIComponent(pair)}>Explore daily observations</Link>
      </div>
    </section>
  );
}
function Calculator({ rates }: { rates: Rate[] }) {
  const [pair, setPair] = useState('NZD/INR'),
    [amount, setAmount] = useState('1000'),
    rate = rates.find((r) => r.currencyPair === pair),
    [base, quote] = pair.split('/');
  return (
    <section className="card calculator">
      <div className="section-heading">
        <h2>Quick conversion</h2>
        <ArrowLeftRight size={18} />
      </div>
      <label>
        You send
        <div className="amount-input">
          <input
            aria-label="Amount to convert"
            type="number"
            min="0"
            max="1000000000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span>{base}</span>
        </div>
      </label>
      <label>
        Currency pair
        <select value={pair} onChange={(e) => setPair(e.target.value)}>
          {rates
            .map((r) => r.currencyPair)
            .map((p) => (
              <option key={p}>{p}</option>
            ))}
        </select>
      </label>
      <div className="conversion-divider">
        <ArrowLeftRight size={15} />
      </div>
      <span className="muted">They receive approximately</span>
      <div className="conversion-result">
        {rate && amount !== '' && Number(amount) >= 0
          ? format(Number(amount) * rate.rate, 2)
          : '\u2014'}{' '}
        <small>{quote}</small>
      </div>
      <small className="muted">
        {rate ? '1 ' + base + ' = ' + format(rate.rate) + ' ' + quote : 'Rate unavailable'} ·
        excludes fees
      </small>
      <Link className="button outline full" to="/alerts/new">
        Get a rate alert <Bell size={15} />
      </Link>
    </section>
  );
}

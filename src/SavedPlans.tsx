import { useContext, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CURRENCY_CODES, type Alert, type TransferPlan } from '../shared/domain';
import { Session } from './ui';
import { api } from './api';

const route = '/transfer-plans';
const initial = { base: 'NZD', quote: 'INR', amount: '', target: '', alert: '', id: '' };
const estimate = (amount: number, target: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount * target);

export default function SavedPlans() {
  const { user, loading } = useContext(Session);
  if (loading) return null;
  return user ? (
    <Plans key={user.uid} />
  ) : (
    <Link to="/login?next=%2Fplanner">Sign in to save transfer plans</Link>
  );
}

function Plans() {
  const [form, setForm] = useState(initial);
  const [data, setData] = useState<{ plans: TransferPlan[]; alerts: Alert[] }>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const pair = form.base + '/' + form.quote;
  const update = (name: keyof typeof initial, value: string) =>
    setForm({ ...form, [name]: value, ...(['base', 'quote'].includes(name) && { alert: '' }) });
  useEffect(() => {
    let active = true;
    Promise.all([api<TransferPlan[]>(route), api<Alert[]>('/alerts')]).then(
      ([plans, alerts]) => {
        if (active) setData({ plans, alerts });
      },
      () => {
        if (active) setError('Could not load your saved plans. Reload the page to try again.');
      },
    );
    return () => {
      active = false;
    };
  }, []);
  async function change(method: 'POST' | 'PUT' | 'DELETE', id: string) {
    if (!data || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const plan = await api<TransferPlan>(route + (id ? '/' + encodeURIComponent(id) : ''), {
        method,
        body:
          method === 'DELETE'
            ? undefined
            : JSON.stringify({
                pair,
                amount: Number(form.amount),
                targetRate: Number(form.target),
                alertId: form.alert || null,
              }),
      });
      const remaining = data.plans.filter((entry) => entry.id !== id);
      setData({ ...data, plans: method === 'DELETE' ? remaining : [plan, ...remaining] });
      if (method !== 'DELETE' || form.id === id) setForm(initial);
      setNotice(method === 'DELETE' ? 'Transfer plan deleted.' : 'Transfer plan saved.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update your plan.');
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    void change(form.id ? 'PUT' : 'POST', form.id);
  }
  return (
    <section className="chart-card">
      <h2>Saved transfer plans</h2>
      {error && <p role="alert">{error}</p>}
      <p role="status">{notice || (!data && !error ? 'Loading saved plans…' : '')}</p>
      {data && (
        <>
          <form onSubmit={save}>
            <fieldset disabled={busy}>
              <legend>{form.id ? 'Edit transfer plan' : 'New transfer plan'}</legend>
              <label>
                Source currency{' '}
                <select value={form.base} onChange={(e) => update('base', e.target.value)}>
                  {CURRENCY_CODES.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
              <label>
                Destination currency{' '}
                <select value={form.quote} onChange={(e) => update('quote', e.target.value)}>
                  {CURRENCY_CODES.map((code) => (
                    <option key={code}>{code}</option>
                  ))}
                </select>
              </label>
              <label>
                Planned amount{' '}
                <input
                  type="number"
                  required
                  min="0.01"
                  max="1000000000000"
                  step="any"
                  value={form.amount}
                  onChange={(e) => update('amount', e.target.value)}
                />
              </label>
              <label>
                Target exchange rate{' '}
                <input
                  type="number"
                  required
                  min="0.000000001"
                  max="1000000"
                  step="any"
                  value={form.target}
                  onChange={(e) => update('target', e.target.value)}
                />
              </label>
              <label>
                Linked alert{' '}
                <select value={form.alert} onChange={(e) => update('alert', e.target.value)}>
                  <option value="">No linked alert</option>
                  {data.alerts
                    .filter((alert) => alert.pair === pair)
                    .map((alert) => (
                      <option key={alert.id} value={alert.id}>
                        {alert.condition === 'gte' ? 'At or above' : 'At or below'}{' '}
                        {alert.targetRate} ({alert.status})
                      </option>
                    ))}
                </select>
              </label>
              <p>
                Estimated at your target before fees{' '}
                {Number(form.amount) > 0 && Number(form.target) > 0
                  ? estimate(Number(form.amount), Number(form.target), form.quote)
                  : '—'}
              </p>
              <button className="button" type="submit">
                Save plan
              </button>
              {form.id && (
                <button type="button" onClick={() => setForm(initial)}>
                  Cancel edit
                </button>
              )}
            </fieldset>
          </form>
          {data.plans.length === 0 ? (
            <p>You have no saved plans yet.</p>
          ) : (
            <ul>
              {data.plans.map((plan) => {
                const [base, quote] = plan.pair.split('/');
                const linked = data.alerts.find(
                  (alert) => alert.id === plan.alertId && alert.pair === plan.pair,
                );
                return (
                  <li key={plan.id}>
                    <p>
                      <strong>{plan.pair}</strong> · {plan.amount} {base} at {plan.targetRate} ·{' '}
                      {estimate(plan.amount, plan.targetRate, quote)} before fees
                    </p>
                    <p>
                      {linked
                        ? 'Linked alert: ' + linked.status
                        : plan.alertId
                          ? 'Linked alert unavailable'
                          : 'No linked alert'}
                    </p>
                    <button
                      disabled={busy}
                      type="button"
                      onClick={() =>
                        setForm({
                          id: plan.id,
                          base,
                          quote,
                          amount: String(plan.amount),
                          target: String(plan.targetRate),
                          alert: linked?.id || '',
                        })
                      }
                    >
                      Edit {plan.pair} plan
                    </button>{' '}
                    <button
                      disabled={busy}
                      type="button"
                      onClick={() => void change('DELETE', plan.id)}
                    >
                      Delete {plan.pair} plan
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

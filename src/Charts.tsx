import { useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CURRENCY_CODES } from '../shared/domain';
import { api } from './api';
import RateCalendar from './RateCalendar';
import { Footer, format, PublicHeader } from './ui';

type Point = { date: string; rate: number };
const day = 86400000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const average = (values: number[]) =>
  values.reduce((total, value) => total + value, 0) / values.length;
const groups = [
  {
    label: 'Weekday',
    key: (date: Date) => date.getUTCDay(),
    name: (index: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index],
  },
  {
    label: 'Day of month',
    key: (date: Date) => date.getUTCDate(),
    name: (index: number) => String(index),
  },
  {
    label: 'Month of year',
    key: (date: Date) => date.getUTCMonth(),
    name: (index: number) =>
      new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' }).format(
        Date.UTC(2000, index, 1),
      ),
  },
];

export default function Charts() {
  const [params] = useSearchParams();
  const [fromCode, toCode] = (params.get('pair') || '').split('/');
  const [base, setBase] = useState(CURRENCY_CODES.find((code) => code === fromCode) || 'NZD');
  const [quote, setQuote] = useState(CURRENCY_CODES.find((code) => code === toCode) || 'INR');
  const [period, setPeriod] = useState('30');
  const today = iso(Date.now());
  const [start, setStart] = useState(iso(Date.now() - 29 * day));
  const [end, setEnd] = useState(today);
  const [group, setGroup] = useState(0);
  const from = period === 'custom' ? start : iso(Date.now() - (Number(period) - 1) * day);
  const to = period === 'custom' ? end : today;
  const valid =
    base !== quote &&
    Boolean(
      from && to && from <= to && to <= today && Date.parse(to) - Date.parse(from) <= 1830 * day,
    );
  const query = new URLSearchParams({ pair: base + '/' + quote, from, to }).toString();
  const [response, setResponse] = useState<{ query: string; points?: Point[] }>();
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    api<Point[]>('/history?' + query, { signal: controller.signal })
      .then((points) => {
        if (!controller.signal.aborted)
          setResponse({ query, points: [...points].sort((a, b) => a.date.localeCompare(b.date)) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResponse({ query });
      });
    return () => controller.abort();
  }, [query, valid]);
  const current = response?.query === query ? response : undefined;
  const points = current?.points || [];
  const prices = points.map((p) => p.rate);
  const lowRate = Math.min(...prices);
  const highRate = Math.max(...prices);
  const low = points.find((point) => point.rate === lowRate);
  const high = points.find((point) => point.rate === highRate);
  const chart = points.map((point, index) => ({
    ...point,
    movingAverage: index >= 6 ? average(prices.slice(index - 6, index + 1)) : undefined,
  }));
  const returns = points
    .slice(1)
    .map((point, index) => (point.rate / points[index].rate - 1) * 100);
  const meanReturn = average(returns);
  const buckets = new Map<number, number[]>();
  if (
    returns.length >= 365 &&
    Date.parse(points.at(-1)!.date) - Date.parse(points[0].date) >= 730 * day
  ) {
    returns.forEach((value, index) => {
      const key = groups[group].key(new Date(points[index + 1].date));
      const values = buckets.get(key) || [];
      values.push(value);
      buckets.set(key, values);
    });
  }
  const monthly = new Map<string, number[]>();
  for (const point of points) {
    const month = point.date.slice(0, 7);
    const rates = monthly.get(month) || [];
    rates.push(point.rate);
    monthly.set(month, rates);
  }
  const stats =
    low && high
      ? [
          ['Low', format(low.rate), low.date],
          ['High', format(high.rate), high.date],
          ['Average', format(average(prices))],
          [
            'Change',
            returns.length
              ? ((prices.at(-1)! / prices[0] - 1) * 100).toFixed(2) + '%'
              : 'Unavailable',
          ],
          [
            'Volatility',
            returns.length > 1
              ? Math.sqrt(average(returns.map((value) => (value - meanReturn) ** 2))).toFixed(2) +
                '%'
              : 'Unavailable',
          ],
        ]
      : [];
  return (
    <>
      <PublicHeader />
      <main id="main-content" tabIndex={-1} className="section chart-insights history-page">
        <header className="rw-page-heading history-heading">
          <h1>Exchange-rate history</h1>
          <p>
            Explore daily reference observations from{' '}
            <a href="https://frankfurter.dev/">Frankfurter</a>. Rates may be missing on weekends or
            holidays.
          </p>
        </header>
        <div className="chart-controls">
          <label>
            From
            <select value={base} onChange={(event) => setBase(event.target.value as typeof base)}>
              {CURRENCY_CODES.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
          <label>
            To
            <select
              value={quote}
              onChange={(event) => setQuote(event.target.value as typeof quote)}
            >
              {CURRENCY_CODES.map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
          <label>
            Period
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="365">1 year</option>
              <option value="1826">5 years</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {period === 'custom' && (
            <>
              <label>
                Start date
                <input
                  type="date"
                  max={to || today}
                  value={start}
                  onChange={(event) => setStart(event.target.value)}
                />
              </label>
              <label>
                End date
                <input
                  type="date"
                  min={start}
                  max={today}
                  value={end}
                  onChange={(event) => setEnd(event.target.value)}
                />
              </label>
            </>
          )}
        </div>
        <section className="card chart-card rw-chart-panel" aria-label="Rate history">
          <h2>
            {base}/{quote}
          </h2>
          {!valid ? (
            <p role="status">Choose two different currencies and a range of up to five years.</p>
          ) : !current ? (
            <p role="status">Loading history…</p>
          ) : !points.length ? (
            <p role="status">
              {current.points
                ? 'No observations in this range.'
                : 'History is currently unavailable.'}
            </p>
          ) : (
            <>
              <p>
                {points.length} observations from {points[0].date} to {points.at(-1)!.date}
              </p>
              <dl>
                {stats.map(([label, value, date]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>
                      {value}
                      {date && <time dateTime={date}>{date}</time>}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="chart-area">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chart} margin={{ top: 10, right: 15, bottom: 8 }}>
                    <CartesianGrid vertical={false} stroke="#484a73" strokeDasharray="3 4" />
                    <XAxis
                      dataKey="date"
                      minTickGap={28}
                      tick={{ fill: '#dddaf1' }}
                      tickFormatter={(date: string) => date.slice(5)}
                    />
                    <YAxis tick={{ fill: '#dddaf1' }} width={52} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{
                        background: '#202143',
                        borderColor: '#77799e',
                        color: 'white',
                      }}
                    />
                    <Line
                      dataKey="rate"
                      name="Reference rate"
                      stroke="#d8ff32"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="movingAverage"
                      name="7-observation average"
                      stroke="#b4aaf7"
                      strokeDasharray="5 4"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <ul className="chart-key" aria-label="Chart legend">
                <li>Reference rate</li>
                <li>7-observation average</li>
              </ul>
              <p>
                Volatility is the standard deviation of percentage changes between consecutive
                available observations. The rolling average uses seven observations.
              </p>
              <details>
                <summary>Monthly highs and lows</summary>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col">Low</th>
                      <th scope="col">High</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...monthly].reverse().map(([month, rates]) => (
                      <tr key={month}>
                        <th scope="row">{month}</th>
                        <td>{format(Math.min(...rates))}</td>
                        <td>{format(Math.max(...rates))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <details>
                <summary>View observations as a table</summary>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr key={point.date}>
                        <td>{point.date}</td>
                        <td>{format(point.rate, 6)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </>
          )}
        </section>
        {points.length > 0 && (
          <RateCalendar key={query} points={points} from={from} to={to} quote={quote} />
        )}
        <section className="chart-card">
          <h2>Historically observed patterns</h2>
          <p>
            Each percentage change is grouped by the UTC date of the later observation. Missing
            dates are left out, so some changes span multiple calendar days. Past performance does
            not guarantee future exchange rates.
          </p>
          <div className="chart-controls">
            <label>
              Group by
              <select value={group} onChange={(event) => setGroup(Number(event.target.value))}>
                {groups.map((entry, index) => (
                  <option key={entry.label} value={index}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {buckets.size ? (
            <table>
              <thead>
                <tr>
                  <th scope="col">{groups[group].label}</th>
                  <th scope="col">Average change</th>
                  <th scope="col">Samples</th>
                </tr>
              </thead>
              <tbody>
                {[...buckets]
                  .sort(([a], [b]) => a - b)
                  .map(([key, values]) => (
                    <tr key={key}>
                      <th scope="row">{groups[group].name(key)}</th>
                      <td>
                        {values.length >= 10
                          ? average(values).toFixed(3) + '%'
                          : 'Insufficient samples'}
                      </td>
                      <td>{values.length}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ) : (
            <>
              <p>Patterns require at least two years and 365 observed changes.</p>
              {period !== '1826' && (
                <button
                  type="button"
                  className="button outline"
                  onClick={() => {
                    setPeriod('1826');
                    setGroup(1);
                  }}
                >
                  Compare days of the month over five years
                </button>
              )}
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

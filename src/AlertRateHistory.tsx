import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from './api';
import { format } from './ui';

type Point = { date: string; rate: number };
const dateFormat = new Intl.DateTimeFormat('en-NZ', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const shortDate = (date: string) => dateFormat.format(new Date(date));

export default function AlertRateHistory({ pair, target }: { pair: string; target: number }) {
  const [result, setResult] = useState<{ pair: string; points: Point[] | null }>();
  useEffect(() => {
    const controller = new AbortController();
    const end = new Date();
    const start = new Date(end.getTime() - 29 * 86400000);
    const query = new URLSearchParams({
      pair,
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    });
    api<Point[]>('/history?' + query, { signal: controller.signal })
      .then((points) => {
        if (!controller.signal.aborted)
          setResult({ pair, points: [...points].sort((a, b) => a.date.localeCompare(b.date)) });
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ pair, points: null });
      });
    return () => controller.abort();
  }, [pair]);

  const points = result?.pair === pair ? result.points : undefined;
  const low = points?.reduce((a, b) => (b.rate < a.rate ? b : a), points[0]);
  const high = points?.reduce((a, b) => (b.rate > a.rate ? b : a), points[0]);
  const hasTarget = Number.isFinite(target) && target > 0;
  const inRange = hasTarget && low && high && target >= low.rate && target <= high.rate;
  const outside = hasTarget && low && high && !inRange ? (target > high.rate ? high : low) : null;
  const padding = low && high ? Math.max((high.rate - low.rate) * 0.12, high.rate * 0.001) : 0;

  return (
    <aside className="card alert-rate-history" aria-labelledby="alert-history-title">
      <h2 id="alert-history-title">30-day rate history</h2>
      <p className="muted">{pair.replace('/', ' / ')}</p>
      {points && points.length > 0 && low && high ? (
        <>
          <dl className="alert-history-indicators">
            {(
              [
                ['Low', low],
                ['High', high],
              ] as const
            ).map(([label, point]) => {
              const { rate, date } = point;
              return (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {format(rate, 6)} <small>{shortDate(date)}</small>
                  </dd>
                </div>
              );
            })}
          </dl>
          <div className="alert-history-plot">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 10, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#ded9eb" strokeDasharray="3 4" />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  minTickGap={24}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  domain={[low.rate - padding, high.rate + padding]}
                  width={52}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value: number) => format(value, 4)}
                />
                <Tooltip
                  labelFormatter={(date) => shortDate(String(date))}
                  formatter={(value) => [format(Number(value), 6), 'Reference rate']}
                />
                <Line
                  dataKey="rate"
                  stroke="#5148a5"
                  strokeWidth={2}
                  dot={points.length === 1}
                  isAnimationActive={false}
                />
                <ReferenceDot x={low.date} y={low.rate} r={4} fill="#5148a5" />
                {high.date !== low.date && (
                  <ReferenceDot x={high.date} y={high.rate} r={4} fill="#5148a5" />
                )}
                {inRange && (
                  <ReferenceLine
                    y={target}
                    stroke="#a14c20"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
          {outside ? (
            <p className="muted">
              Your target ({format(target, 6)}) is {format(Math.abs(target - outside.rate), 6)}{' '}
              {target > outside.rate ? 'above the 30-day high' : 'below the 30-day low'}.
            </p>
          ) : inRange ? (
            <p className="muted">Dashed line: your target of {format(target, 6)}.</p>
          ) : null}
        </>
      ) : (
        <p role="status" className="muted">
          {points === undefined
            ? 'Loading historical rates…'
            : 'Historical rates unavailable for this pair.'}
        </p>
      )}
      <p className="alert-history-source muted">
        <a href="https://frankfurter.dev/">Historical reference rates by Frankfurter</a>. Alerts use
        the market rate shown in the form.
      </p>
    </aside>
  );
}

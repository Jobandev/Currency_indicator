import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { format } from './ui';

type Point = { date: string; rate: number };

export default function HistoryPreview() {
  const section = useRef<HTMLElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setStatus('loading');
        api<Point[]>('/history?pair=NZD%2FINR', { signal: controller.signal })
          .then((rows) => {
            if (controller.signal.aborted) return;
            setPoints([...rows].sort((a, b) => a.date.localeCompare(b.date)));
            setStatus('ready');
          })
          .catch(() => {
            if (!controller.signal.aborted) setStatus('error');
          });
      },
      { rootMargin: '120px' },
    );
    if (section.current) observer.observe(section.current);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [attempt]);

  const first = points[0];
  const last = points.at(-1);
  const values = points.map(({ rate }) => rate);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const change = first && last ? (last.rate / first.rate - 1) * 100 : 0;
  const start = first ? Date.parse(first.date) : 0;
  const duration = last ? Math.max(1, Date.parse(last.date) - start) : 1;
  const line = points
    .map(({ date, rate }) => {
      const x = 5 + ((Date.parse(date) - start) / duration) * 590;
      const y = high === low ? 90 : 8 + ((high - rate) / (high - low)) * 164;
      return `${x},${y}`;
    })
    .join(' ');
  const dateLabel = (date: string) =>
    new Date(date).toLocaleDateString('en-NZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

  return (
    <section ref={section} className="rw-history" aria-labelledby="history-preview-heading">
      <div className="rw-history-copy">
        <h2 id="history-preview-heading">A month in motion.</h2>
        <p>See how the New Zealand dollar moved against the Indian rupee over the past month.</p>
        <Link className="rw-button" to="/charts">
          Explore historical rates
        </Link>
      </div>
      <div className="rw-chart">
        <div className="rw-chart-heading">
          <h3>NZD / INR</h3>
          <span>Past month</span>
        </div>
        {status === 'ready' && points.length > 1 && first && last ? (
          <>
            <dl className="rw-chart-stats">
              {[
                ['High', format(high)],
                ['Low', format(low)],
                ['Average', format(average)],
                ['Change', `${change > 0 ? '+' : ''}${change.toFixed(2)}%`],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <svg
              className="rw-chart-plot"
              viewBox="0 0 600 180"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0 8H600M0 49H600M0 90H600M0 131H600M0 172H600" />
              <polyline points={line} pathLength="1" />
            </svg>
            <p className="rw-chart-dates">
              <span>{dateLabel(first.date)}</span>
              <span>{dateLabel(last.date)}</span>
            </p>
          </>
        ) : (
          <div className="rw-chart-status">
            <p role="status">
              {status === 'error'
                ? 'Historical rates are unavailable.'
                : status === 'ready'
                  ? 'There are too few observations for this chart.'
                  : 'Loading historical rates…'}
            </p>
            {status === 'error' && (
              <button className="rw-button" onClick={() => setAttempt(attempt + 1)}>
                Try again
              </button>
            )}
          </div>
        )}
        <p className="rw-chart-source">
          Daily reference rates from <a href="https://frankfurter.dev/">Frankfurter</a>.
        </p>
      </div>
    </section>
  );
}

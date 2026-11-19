import { useEffect, useState } from 'react';
import { MoveUpRight } from 'lucide-react';
import { api } from './api';
import { format } from './ui';
import { minimumObservations, rateOutlook } from './rate-outlook';

type Point = { date: string; rate: number };
const day = 86400000;

export default function RateOutlook({ pair }: { pair: string }) {
  const [request, setRequest] = useState(0);
  const [result, setResult] = useState<{ request: number; points: Point[] | null }>();
  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    const today = Date.now();
    const query = new URLSearchParams({
      pair,
      from: new Date(today - 179 * day).toISOString().slice(0, 10),
      to: new Date(today).toISOString().slice(0, 10),
    });
    api<Point[]>('/history?' + query, { signal: controller.signal })
      .then((rows) => {
        if (!controller.signal.aborted) {
          const points = [...new Map(rows.map((point) => [point.date, point])).values()].sort(
            (a, b) => a.date.localeCompare(b.date),
          );
          setResult({ request, points });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setResult({ request, points: null });
      });
    return () => controller.abort();
  }, [pair, request]);

  const current = result?.request === request ? result : undefined;
  const points = current?.points;
  const latest = points?.at(-1);
  const stale = latest && Date.now() - Date.parse(latest.date) > 7 * day;
  const rates = points?.map(({ rate }) => rate) ?? [];
  const validRates = rates.every((rate) => Number.isFinite(rate) && rate > 0);
  const quote = pair.split('/')[1];
  return (
    <section className="rw-calendar rw-outlook" aria-labelledby="rw-outlook-heading">
      <h2 id="rw-outlook-heading">
        <MoveUpRight aria-hidden="true" /> Short-term rate outlook
      </h2>
      <p>
        Could {pair} go up or down? Compare the outlook after the next 1, 3 or 7 rate updates.
        Updates follow the provider’s schedule.
      </p>
      {!request || (current && !points) ? (
        <>
          {request > 0 && <p role="status">Recent rate history is unavailable.</p>}
          <button className="button outline" onClick={() => setRequest((value) => value + 1)}>
            {request ? 'Retry outlook' : 'Calculate outlook'}
          </button>
        </>
      ) : !current ? (
        <p role="status">Checking recent history…</p>
      ) : stale ? (
        <p role="status">
          The latest observation is more than seven days old. A current outlook is unavailable.
        </p>
      ) : !validRates ? (
        <p role="status">
          Recent history contains an invalid observation. The outlook is unavailable.
        </p>
      ) : latest && rates.length >= minimumObservations ? (
        <>
          <p>
            Latest reference rate{' '}
            <strong>
              {format(latest.rate, 6)} {quote}
            </strong>{' '}
            on <time dateTime={latest.date}>{latest.date}</time>.
          </p>
          <div className="rw-outlook-grid" aria-live="polite">
            {([1, 3, 7] as const).map((horizon) => {
              const forecast = rateOutlook(rates, horizon);
              if (!forecast) return null;
              return (
                <article key={horizon}>
                  <h3>
                    {horizon === 1 ? 'Next rate update' : 'After ' + horizon + ' rate updates'}
                  </h3>
                  <strong>
                    {forecast.direction
                      ? 'May go ' + forecast.direction.toLowerCase()
                      : 'No clear direction'}
                  </strong>
                  {forecast.direction ? (
                    <p>
                      The estimated range is {format(forecast.low)}–{format(forecast.high)} {quote}.
                    </p>
                  ) : (
                    <p>
                      {forecast.supported
                        ? 'The estimated range includes the latest rate, so either direction is possible.'
                        : 'Recent rates give us too little evidence to say which way the rate might move.'}
                    </p>
                  )}
                  <details>
                    <summary>Forecast details</summary>
                    {forecast.supported && (
                      <p>
                        Estimate {format(forecast.estimate)} {quote}. Estimated range{' '}
                        {format(forecast.low)}–{format(forecast.high)} {quote}.
                      </p>
                    )}
                    <p>
                      Average error in past tests was {format(forecast.trendError * 100)}% for this
                      model and {format(forecast.baselineError * 100)}% when assuming the rate
                      stayed the same. The estimated range included the actual rate in{' '}
                      {Math.round(forecast.coverage * 100)}% of {forecast.testSize} tests.
                    </p>
                  </details>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <p role="status">
          At least {minimumObservations} recent observations are needed to evaluate this outlook.
        </p>
      )}
      <details>
        <summary>How the outlook is calculated</summary>
        <p>
          RateWatch projects the change over the previous 14 observations using up to 180 days of
          Frankfurter history. Earlier out-of-sample errors set the range. The latest 40 historical
          forecasts test it against an unchanged rate. A direction appears when the trend reduces
          average absolute log error by more than 5%, the range covers at least 70% of those tests,
          and the range stays on one side of the latest rate.
        </p>
        <p>
          Observation dates depend on provider publication. Market news can move rates beyond the
          range, and historical coverage can change. Transfer providers quote their own rates and
          fees.
        </p>
      </details>
    </section>
  );
}

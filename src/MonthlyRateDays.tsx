import { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays } from 'lucide-react';
import { monthlyExtremes } from '../shared/monthly-extremes';

const ordinal = new Intl.PluralRules('en-NZ', { type: 'ordinal' });
const suffix = { one: 'st', two: 'nd', few: 'rd', other: 'th', zero: 'th', many: 'th' };

export default function MonthlyRateDays({
  points,
  from,
  to,
  pair,
  expandRange,
}: {
  points: { date: string; rate: number }[];
  from: string;
  to: string;
  pair: string;
  expandRange: () => void;
}) {
  const [sort, setSort] = useState<'highs' | 'lows'>('highs');
  const { months, days } = monthlyExtremes(points, from, to);
  const rows = [...days].sort((a, b) => b[sort] - a[sort] || a.day - b.day);
  const most = rows[0]?.[sort] ?? 0;
  const leaders = rows.filter((row) => row[sort] === most);
  const name = (day: number) => day + suffix[ordinal.select(day)];

  return (
    <section className="rw-calendar rw-monthly-days" aria-labelledby="rw-monthly-days-heading">
      <h2 id="rw-monthly-days-heading">
        <CalendarDays aria-hidden="true" /> Which dates had the highest rates?
      </h2>
      <p>
        See how often each day of the month recorded the highest or lowest {pair} rate in a past
        month.
      </p>
      {months < 3 ? (
        <>
          <p>Choose a range with at least three complete months to see a comparison.</p>
          <button className="button outline" type="button" onClick={expandRange}>
            Use the last five years
          </button>
        </>
      ) : (
        <>
          <div className="rw-monthly-controls">
            <p>
              <strong>{leaders.map(({ day }) => name(day)).join(', ')}</strong>{' '}
              {leaders.length === 1 ? 'had' : 'each had'} a{' '}
              {sort === 'highs' ? 'monthly high' : 'monthly low'} in {most}{' '}
              {most === 1 ? 'month' : 'months'}, the most in this range.
            </p>
            <label>
              Show first
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value === 'lows' ? 'lows' : 'highs')}
              >
                <option value="highs">Most monthly highs</option>
                <option value="lows">Most monthly lows</option>
              </select>
            </label>
          </div>
          <p>
            Based on {months} complete months. Some dates appear less often, especially the
            29th–31st. The counts describe past rates.
          </p>
          <table>
            <thead>
              <tr>
                <th scope="col">Day of month</th>
                <th scope="col" aria-sort={sort === 'highs' ? 'descending' : undefined}>
                  <ArrowUp size={14} aria-hidden="true" /> Monthly highs
                </th>
                <th scope="col" aria-sort={sort === 'lows' ? 'descending' : undefined}>
                  <ArrowDown size={14} aria-hidden="true" /> Monthly lows
                </th>
                <th scope="col">Months with a rate that day</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.day}>
                  <th scope="row">{name(row.day)}</th>
                  <td>{row.highs}</td>
                  <td>{row.lows}</td>
                  <td>{row.observed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details>
            <summary>How we count highs and lows</summary>
            <p>
              We use complete calendar months within the selected date range that have at least 15
              recorded rates and some rate movement. Each date tied for a monthly high or low gets
              counted. Missing rates are left out.
            </p>
          </details>
        </>
      )}
    </section>
  );
}

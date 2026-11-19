import { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, Minus } from 'lucide-react';
import { format } from './ui';

type Point = { date: string; rate: number };
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthLabel = new Intl.DateTimeFormat('en-NZ', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const dateLabel = new Intl.DateTimeFormat('en-NZ', { dateStyle: 'long', timeZone: 'UTC' });

export default function RateCalendar({
  points,
  from,
  to,
  quote,
}: {
  points: Point[];
  from: string;
  to: string;
  quote: string;
}) {
  const months: string[] = [];
  const cursor = new Date(to.slice(0, 7) + '-01');
  while (cursor.toISOString().slice(0, 7) >= from.slice(0, 7)) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  const [month, setMonth] = useState(points.at(-1)!.date.slice(0, 7));
  const [selected, setSelected] = useState('');
  const monthly = points.filter(({ date }) => date.startsWith(month));
  const rates = new Map(monthly.map(({ date, rate }) => [date, rate]));
  const low = Math.min(...rates.values());
  const high = Math.max(...rates.values());
  const distinct = low < high;
  const first = new Date(month + '-01');
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const selectedRate = rates.get(selected);

  return (
    <section className="rw-calendar" aria-labelledby="rw-calendar-heading">
      <header className="rw-calendar-heading">
        <div>
          <h2 id="rw-calendar-heading">
            <CalendarDays aria-hidden="true" /> Observed rates by date
          </h2>
          <p>
            Find the high and low days within the selected range. Past observations cannot tell you
            which future days will offer a better rate.
          </p>
        </div>
        <label>
          Month
          <select
            value={month}
            onChange={(event) => {
              setMonth(event.target.value);
              setSelected('');
            }}
          >
            {months.map((value) => (
              <option key={value} value={value}>
                {monthLabel.format(new Date(value + '-01'))}
              </option>
            ))}
          </select>
        </label>
      </header>
      <ul className="rw-calendar-key">
        <li>
          <ArrowUp size={16} aria-hidden="true" /> Observed high
        </li>
        <li>
          <ArrowDown size={16} aria-hidden="true" /> Observed low
        </li>
        <li>
          <Minus size={16} aria-hidden="true" /> No observation
        </li>
      </ul>
      <div className="rw-calendar-grid">
        {weekdays.map((name) => (
          <span className="rw-weekday" key={name}>
            {name}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <i key={index} aria-hidden="true" />
        ))}
        {Array.from({ length: count }, (_, index) => {
          const date = month + '-' + String(index + 1).padStart(2, '0');
          const rate = rates.get(date);
          const level =
            distinct && rate === high ? 'high' : distinct && rate === low ? 'low' : undefined;
          const inRange = date >= from && date <= to;
          const Marker = level === 'high' ? ArrowUp : level === 'low' ? ArrowDown : Minus;
          return (
            <button
              type="button"
              key={date}
              data-level={level}
              disabled={!inRange}
              aria-pressed={selected === date}
              aria-label={
                dateLabel.format(new Date(date)) +
                (inRange
                  ? rate === undefined
                    ? ', no observation'
                    : ', ' + format(rate, 6) + ' ' + quote + (level ? ', observed ' + level : '')
                  : ', outside selected range')
              }
              onClick={() => setSelected(date)}
            >
              {index + 1}
              {inRange && (level || rate === undefined) && <Marker size={14} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <p className="rw-calendar-detail" role="status">
        {selected
          ? dateLabel.format(new Date(selected)) +
            (selectedRate === undefined
              ? ' has no observation.'
              : ' recorded ' + format(selectedRate, 6) + ' ' + quote + ' per base currency unit.')
          : monthly.length +
            ' observations in this month within the selected range. Select a date for its rate.'}
      </p>
    </section>
  );
}

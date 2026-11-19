import { expect, it } from 'vitest';
import { monthlyExtremes } from '../shared/monthly-extremes';

it('counts tied extrema, excludes partial months and keeps the total observed for each day', () => {
  const makeMonth = (month: string) =>
    Array.from({ length: 28 }, (_, index) => ({
      date: month + '-' + String(index + 1).padStart(2, '0'),
      rate: index === 4 || index === 5 ? 60 : index === 8 ? 40 : 50,
    }));
  const result = monthlyExtremes(
    [...makeMonth('2025-01'), ...makeMonth('2025-02'), ...makeMonth('2025-03')],
    '2025-01-02',
    '2025-03-31',
  );
  expect(result.months).toBe(2);
  expect(result.days.find(({ day }) => day === 5)).toMatchObject({
    observed: 2,
    highs: 2,
    lows: 0,
  });
  expect(result.days.find(({ day }) => day === 6)?.highs).toBe(2);
  expect(result.days.find(({ day }) => day === 9)?.lows).toBe(2);
  expect(result.days.some(({ day }) => day === 31)).toBe(false);
});

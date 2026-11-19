import { describe, expect, it } from 'vitest';
import { observedRate } from '../server/intraday';
import { digestSchedule } from '../server/digests';
import { fresh } from '../shared/domain';

const now = Date.parse('2026-11-15T03:00:00Z');
const snapshot = {
  base: 'USD' as const,
  result: 'success' as const,
  rates: { NZD: 2, INR: 100 },
  effective_at: { NZD: '2026-11-15T02:43:00Z', INR: '2026-11-15T02:45:00Z' },
  sources: { NZD: 'live', INR: 'live' },
  stale: { NZD: false, INR: false },
};

describe('delayed intraday observations', () => {
  it('derives both directions and uses the older USD leg timestamp', () => {
    const observation = observedRate('NZD/INR', snapshot, now)!;
    expect(observation.rate).toBe(50);
    expect(observation.providerTimestamp).toBe(snapshot.effective_at.NZD);
    expect(fresh(observation, now)).toBe(true);
    expect(fresh(observation, now + 60 * 60000)).toBe(false);
    expect(observedRate('INR/NZD', snapshot, now)?.rate).toBe(0.02);
  });
  it('rejects stale and daily legs', () => {
    expect(
      observedRate('NZD/INR', { ...snapshot, stale: { ...snapshot.stale, INR: true } }, now),
    ).toBeUndefined();
    expect(
      observedRate('NZD/INR', { ...snapshot, sources: { ...snapshot.sources, INR: 'daily' } }, now),
    ).toBeUndefined();
  });
});

it('uses completed UTC weeks and months for digest periods', () => {
  expect(digestSchedule('weekly', now)).toEqual({
    start: '2026-11-02',
    end: '2026-11-08',
    next: Date.parse('2026-11-16'),
  });
  expect(digestSchedule('monthly', now)).toEqual({
    start: '2026-10-01',
    end: '2026-10-31',
    next: Date.parse('2026-12-01'),
  });
});

import { describe, expect, it } from 'vitest';
import { minimumObservations, rateOutlook } from '../src/rate-outlook';

describe('rate outlook', () => {
  it('withholds a direction when the flat baseline is just as accurate', () => {
    const result = rateOutlook(Array(120).fill(50), 3);
    expect(result).toMatchObject({ supported: false, direction: null, baselineError: 0 });
  });

  it('detects supported rising and falling trends relative to the latest rate', () => {
    for (const sign of [1, -1]) {
      const rates = Array.from({ length: 150 }, (_, index) =>
        Math.exp(sign * 0.005 * index + Math.sin(index % 14) * 0.0002),
      );
      const result = rateOutlook(rates, 3);
      expect(result?.direction).toBe(sign === 1 ? 'Higher' : 'Lower');
      expect(result?.testSize).toBe(40);
    }
  });

  it('requires enough valid history to separate calibration and evaluation', () => {
    expect(rateOutlook(Array(minimumObservations - 1).fill(50), 7)).toBeNull();
    expect(rateOutlook([...Array(100).fill(50), 0], 7)).toBeNull();
  });
});

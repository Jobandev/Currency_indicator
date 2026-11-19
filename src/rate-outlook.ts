const windowSize = 14;
const testSize = 40;
export const minimumObservations = 90;

export function rateOutlook(rates: number[], horizon: 1 | 3 | 7) {
  if (
    rates.length < minimumObservations ||
    rates.some((rate) => !Number.isFinite(rate) || rate <= 0)
  )
    return null;

  const logRates = rates.map(Math.log);
  const project = (index: number) =>
    logRates[index] + (horizon * (logRates[index] - logRates[index - windowSize])) / windowSize;

  const errors = logRates.slice(windowSize + horizon).map((actual, offset) => {
    const origin = windowSize + offset;
    return {
      trend: Math.abs(actual - project(origin)),
      flat: Math.abs(actual - logRates[origin]),
    };
  });
  const trainingErrors = errors
    .slice(0, -testSize - horizon + 1)
    .map(({ trend }) => trend)
    .sort((a, b) => a - b);
  const test = errors.slice(-testSize);
  const radius = trainingErrors[Math.ceil(trainingErrors.length * 0.8) - 1];
  const coverage = test.filter(({ trend }) => trend <= radius).length / testSize;
  const meanError = (model: 'trend' | 'flat') =>
    test.reduce((sum, error) => sum + error[model], 0) / testSize;
  const trendError = meanError('trend');
  const baselineError = meanError('flat');
  const latest = logRates.length - 1;
  const centre = project(latest);
  const supported = trendError < baselineError * 0.95 && coverage >= 0.7;
  const direction =
    !supported || Math.abs(centre - logRates[latest]) <= radius
      ? null
      : centre > logRates[latest]
        ? 'Higher'
        : 'Lower';
  return {
    direction,
    supported,
    estimate: Math.exp(centre),
    low: Math.exp(centre - radius),
    high: Math.exp(centre + radius),
    trendError,
    baselineError,
    coverage,
    testSize,
  };
}

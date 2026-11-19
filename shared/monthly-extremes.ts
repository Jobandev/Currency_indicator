type Observation = { date: string; rate: number };

export function monthlyExtremes(points: Observation[], from: string, to: string) {
  const byMonth = new Map<string, Map<string, number>>();
  for (const { date, rate } of points) {
    if (date < from || date > to || !Number.isFinite(rate) || rate <= 0) continue;
    const month = date.slice(0, 7);
    const observations = byMonth.get(month) ?? new Map<string, number>();
    observations.set(date, rate);
    byMonth.set(month, observations);
  }

  const days = Array.from({ length: 31 }, (_, index) => ({
    day: index + 1,
    observed: 0,
    highs: 0,
    lows: 0,
  }));
  let months = 0;
  for (const [month, observations] of byMonth) {
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    if (month + '-01' < from || month + '-' + lastDay > to || observations.size < 15) continue;
    const values = [...observations.values()];
    const high = Math.max(...values);
    const low = Math.min(...values);
    if (high === low) continue;
    months += 1;
    for (const [date, rate] of observations) {
      const row = days[Number(date.slice(8)) - 1];
      row.observed += 1;
      if (rate === high) row.highs += 1;
      if (rate === low) row.lows += 1;
    }
  }
  return { months, days: days.filter(({ observed }) => observed > 0) };
}

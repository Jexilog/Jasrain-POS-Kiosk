// formats analytics results for the charts
import { dateShort, dateLong, weekdayName } from './format';

export const STORE_PRINT_SERIES = [
  { key: 'store', label: 'Store sales', color: 'var(--series-1)' },
  { key: 'print', label: 'Printing', color: 'var(--series-2)' },
];

export const ONE_SERIES = (key, label) => [{ key, label, color: 'var(--series-1)' }];

export function dailyBars(daily) {
  const short = daily.length <= 7;
  return daily.map((d) => ({
    key: d.date.toISOString(),
    axis: short ? weekdayName(d.date) : dateShort(d.date),
    title: dateLong(d.date),
    values: { store: d.store, print: d.print },
  }));
}

const h12 = (h) => (h % 12 === 0 ? 12 : h % 12);
const ampm = (h) => (h % 24 < 12 ? 'AM' : 'PM');

// trims quiet hours at both ends (keeps at least 8am-8pm)
export function hourBars(hours, metric = 'orders') {
  const busy = hours.filter((r) => r.orders > 0).map((r) => r.hour);
  const start = Math.min(8, busy.length ? Math.min(...busy) : 8);
  const end = Math.max(20, busy.length ? Math.max(...busy) : 20);
  return hours
    .filter((r) => r.hour >= start && r.hour <= end)
    .map((r) => ({
      key: `h${r.hour}`,
      axis: `${h12(r.hour)}${r.hour < 12 ? 'a' : 'p'}`,
      title: `${h12(r.hour)} ${ampm(r.hour)} – ${h12(r.hour + 1)} ${ampm(r.hour + 1)}`,
      values: { [metric]: r[metric] },
    }));
}

const LONG_DAYS = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
const SHORT_DAYS = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

export function weekdayBars(weekdays) {
  return weekdays.map((w) => ({
    key: `d${w.dow}`,
    axis: SHORT_DAYS[w.dow],
    title: `${LONG_DAYS[w.dow]} (average)`,
    values: { avg: w.avg },
  }));
}

// index of the biggest bar (for highlighting), or null when everything is zero
export function peakIndex(rows, key) {
  let best = null;
  let max = 0;
  rows.forEach((r, i) => {
    const v = r.values[key] || 0;
    if (v > max) {
      max = v;
      best = i;
    }
  });
  return best;
}

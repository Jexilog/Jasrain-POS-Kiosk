export const peso = (n, digits = 2) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pesoShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000000) return '₱' + (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 1000) return '₱' + (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return '₱' + Math.round(v);
};

export const compact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(v * 10) / 10);
};

export const int = (n) => Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 });

export const pct = (n, digits = 0) => (n == null ? '—' : `${Number(n).toFixed(digits)}%`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const monthName = (d) => MONTHS[d.getMonth()];
export const weekdayName = (d) => WEEKDAYS[d.getDay()];
export const WEEKDAY_NAMES = WEEKDAYS;

export const dateShort = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;
export const dateLong = (d) => `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;

export const dateTime = (iso) => {
  const d = new Date(iso);
  return `${dateShort(d)}, ${d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
};

export const timeAgo = (iso) => {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
};

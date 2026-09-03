const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let currency = 'INR';
export const setCurrency = (code: string) => (currency = code);

const nf = () =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  });

/** ₹1,23,456 -- no decimals, because every amount in this app is entered in whole rupees. */
export const money = (n: number) => nf().format(Math.round(n));

/** Compact form for chart labels and tiles: ₹1.2L, ₹12.5k */
export const moneyShort = (n: number) => {
  const abs = Math.abs(n);
  const sym = currency === 'INR' ? '₹' : '';
  if (abs >= 1e7) return `${sym}${(n / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sym}${(n / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sym}${(n / 1e3).toFixed(1)}k`;
  return `${sym}${Math.round(n)}`;
};

/** yyyy-mm for the month a date string falls in. */
export const monthOf = (date: string) => date.slice(0, 7);

export const todayISO = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const currentMonth = () => todayISO().slice(0, 7);

/** "Aug 2026" from "2026-08" */
export const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

/** "Sat 12 Aug" from "2026-08-12" */
export const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${wd} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** Shift a yyyy-mm month by n months. */
export const shiftMonth = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

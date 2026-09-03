import { categoryById, txOf } from './store';
import type { Tx } from './types';

export interface MonthSummary {
  month: string;
  income: number;
  expense: number;
  investment: number;
  /** lent out this month, not counted as expense */
  lent: number;
  /** lendings that came back this month */
  recovered: number;
  /** income - expense - investment; lending is excluded because it returns */
  net: number;
  count: number;
  days: number;
  perDay: number;
  topCategory: { name: string; amount: number } | null;
}

const sum = (rows: Tx[]) => rows.reduce((s, t) => s + t.amount, 0);

const daysElapsed = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const now = new Date();

  // for the running month only count days so far, so per-day averages stay honest
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;
  return isCurrent ? now.getDate() : lastDay;
};

export const summarize = (ym: string): MonthSummary => {
  const rows = txOf(ym);
  const of = (kind: Tx['kind']) => rows.filter((t) => t.kind === kind);

  const expense = sum(of('expense'));
  const income = sum(of('income'));
  const investment = sum(of('investment'));
  const days = daysElapsed(ym);
  const byCat = categoryTotals(ym, 'expense');

  return {
    month: ym,
    income,
    expense,
    investment,
    lent: sum(of('lending')),
    recovered: sum(of('repayment')),
    net: income - expense - investment,
    count: rows.length,
    days,
    perDay: days ? expense / days : 0,
    topCategory: byCat.length ? { name: byCat[0].name, amount: byCat[0].amount } : null
  };
};

export interface CategorySlice {
  id: string;
  name: string;
  amount: number;
  share: number;
  count: number;
}

/** Totals per category for one kind in one month, biggest first. */
export const categoryTotals = (ym: string, kind: Tx['kind']): CategorySlice[] => {
  const rows = txOf(ym).filter((t) => t.kind === kind);
  const total = sum(rows);
  const map = new Map<string, CategorySlice>();

  for (const t of rows) {
    const id = t.category_id ?? 'none';
    const hit = map.get(id);

    if (hit) {
      hit.amount += t.amount;
      hit.count += 1;
    } else {
      map.set(id, {
        id,
        name: categoryById(t.category_id)?.name ?? 'Uncategorised',
        amount: t.amount,
        share: 0,
        count: 1
      });
    }
  }

  return [...map.values()]
    .map((s) => ({ ...s, share: total ? s.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
};

/** Biggest single expenses in a month. */
export const topExpenses = (ym: string, limit = 5) =>
  txOf(ym)
    .filter((t) => t.kind === 'expense')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);

/** Daily expense totals across a month, zero-filled so the chart has no gaps. */
export const dailyTotals = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const out = Array.from({ length: lastDay }, (_, i) => ({ day: i + 1, amount: 0 }));

  for (const t of txOf(ym)) {
    if (t.kind !== 'expense') continue;
    const day = Number(t.occurred_on.slice(8, 10));
    if (out[day - 1]) out[day - 1].amount += t.amount;
  }

  return out;
};

/**
 * Plain-language observations about a month, generated locally. These are shown
 * as-is when no Gemini key is set, and also handed to Gemini as grounding facts
 * so it cannot invent numbers.
 */
export const observations = (ym: string, prev?: string): string[] => {
  const s = summarize(ym);
  const notes: string[] = [];

  if (!s.count) return ['No entries for this month yet.'];

  const cats = categoryTotals(ym, 'expense');

  if (s.topCategory && cats[0]) {
    notes.push(
      `${s.topCategory.name} is your biggest spend at ${Math.round(cats[0].share * 100)}% of expenses (${Math.round(s.topCategory.amount)}).`
    );
  }

  notes.push(`You are averaging ${Math.round(s.perDay)} per day across ${s.days} days.`);

  if (s.income) {
    const rate = ((s.income - s.expense - s.investment) / s.income) * 100;
    notes.push(
      rate >= 0
        ? `You kept ${Math.round(rate)}% of your income this month.`
        : `You spent ${Math.round(-rate)}% more than you earned this month.`
    );
  }

  if (s.investment) {
    notes.push(`${Math.round(s.investment)} went into investments — that is money you still own, not spend.`);
  }

  if (s.lent) {
    notes.push(`${Math.round(s.lent)} is lent out and expected back, so it is not counted as expense.`);
  }

  if (prev) {
    const p = summarize(prev);

    if (p.count && p.expense) {
      const diff = ((s.expense - p.expense) / p.expense) * 100;
      const dir = diff >= 0 ? 'more' : 'less';
      notes.push(`You spent ${Math.abs(Math.round(diff))}% ${dir} than the previous month.`);
    }
  }

  const big = topExpenses(ym, 1)[0];
  if (big && s.expense && big.amount / s.expense > 0.25) {
    notes.push(`One entry — ${big.note || 'unnamed'} at ${Math.round(big.amount)} — is over a quarter of the month's spend.`);
  }

  return notes;
};

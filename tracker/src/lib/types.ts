export type Kind = 'expense' | 'income' | 'investment' | 'lending' | 'repayment';
export type CategoryKind = 'expense' | 'income' | 'investment' | 'lending';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  sort: number;
  archived: boolean;
}

export interface Tx {
  id: string;
  occurred_on: string; // yyyy-mm-dd
  kind: Kind;
  category_id: string | null;
  note: string;
  qty: number;
  amount: number;
  person: string | null;
  lend_id: string | null;
  imported: boolean;
  created_at: string;
}

export interface Recurring {
  id: string;
  label: string;
  kind: 'expense' | 'income' | 'investment';
  category_id: string | null;
  amount: number;
  every_n_months: number;
  day_of_month: number;
  anchor_month: string;
  active: boolean;
}

export interface Settings {
  currency: string;
  gemini_api_key: string | null;
  monthly_budget: number | null;
}

/** A previously used category+note pair, ranked so the common ones are one tap away. */
export interface Suggestion {
  categoryId: string;
  categoryName: string;
  kind: Kind;
  note: string;
  lastAmount: number;
  uses: number;
}

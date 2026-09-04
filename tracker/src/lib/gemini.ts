import { categoryTotals, observations, summarize, topExpenses } from './analytics';
import { monthLabel, shiftMonth } from './format';
import { store } from './store';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.0-flash';

/**
 * Build a compact factual brief for one month. Every number Gemini is allowed to
 * quote appears here, so it summarises and advises rather than inventing figures.
 */
const brief = (ym: string) => {
  const prev = shiftMonth(ym, -1);
  const s = summarize(ym);
  const cats = categoryTotals(ym, 'expense');
  const cur = store.settings.currency;

  const lines = [
    `Month: ${monthLabel(ym)}. Currency: ${cur}.`,
    `Income ${Math.round(s.income)}, expenses ${Math.round(s.expense)}, investments ${Math.round(s.investment)}, net kept ${Math.round(s.net)}.`,
    `Lent out ${Math.round(s.lent)} (expected back, not an expense). Recovered ${Math.round(s.recovered)}.`,
    `${s.count} entries over ${s.days} days, averaging ${Math.round(s.perDay)} per day.`,
    '',
    'Expenses by category:',
    ...cats.map((c) => `- ${c.name}: ${Math.round(c.amount)} (${Math.round(c.share * 100)}%, ${c.count} entries)`),
    '',
    'Largest individual expenses:',
    ...topExpenses(ym, 6).map((t) => `- ${t.note || 'unnamed'}: ${Math.round(t.amount)} on ${t.occurred_on}`)
  ];

  const p = summarize(prev);
  if (p.count) {
    lines.push('', `Previous month (${monthLabel(prev)}): expenses ${Math.round(p.expense)}, income ${Math.round(p.income)}.`);
  }

  if (store.settings.monthly_budget) {
    lines.push('', `The user's monthly spending target is ${store.settings.monthly_budget}.`);
  }

  return lines.join('\n');
};

const PROMPT = [
  'You are a blunt, practical personal-finance analyst for a single user in India.',
  'Using ONLY the figures provided, write a short analysis.',
  'Format: 3 to 5 single-sentence bullets starting with "- ", then one final line starting with "Do this: " naming one concrete action.',
  'Rules: quote only numbers present in the data; never invent categories or amounts.',
  'Treat investments as savings, not spending. Treat lent money as recoverable, not spending.',
  'Be specific about which category to cut and by how much. No preamble, no disclaimers, no markdown headings.'
].join(' ');

export interface AnalysisResult {
  text: string;
  source: 'gemini' | 'local';
  error?: string;
}

/** Local fallback: the same observations the analysis tab shows without a key. */
const localAnalysis = (ym: string): AnalysisResult => ({
  text: observations(ym, shiftMonth(ym, -1))
    .map((o) => `- ${o}`)
    .join('\n'),
  source: 'local'
});

export const analyseMonth = async (ym: string): Promise<AnalysisResult> => {
  const key = store.settings.gemini_api_key?.trim();
  if (!key) return localAnalysis(ym);

  if (!summarize(ym).count) {
    return { text: '- No entries for this month yet.', source: 'local' };
  }

  try {
    const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: brief(ym) }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 500 }
      })
    });

    if (!res.ok) {
      const detail = await res.text();
      const message = res.status === 400 || res.status === 403 ? 'Gemini rejected the API key.' : `Gemini error ${res.status}.`;
      console.error('gemini', res.status, detail);
      return { ...localAnalysis(ym), error: `${message} Showing local analysis instead.` };
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';

    if (!text.trim()) return { ...localAnalysis(ym), error: 'Gemini returned nothing. Showing local analysis.' };

    return { text: text.trim(), source: 'gemini' };
  } catch (e) {
    console.error(e);
    return { ...localAnalysis(ym), error: 'Could not reach Gemini. Showing local analysis.' };
  }
};

/** Cheap key check used by the settings screen. */
export const verifyKey = async (key: string) => {
  try {
    const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
        generationConfig: { maxOutputTokens: 10 }
      })
    });

    return res.ok ? null : `Key rejected (HTTP ${res.status}).`;
  } catch {
    return 'Could not reach Gemini.';
  }
};

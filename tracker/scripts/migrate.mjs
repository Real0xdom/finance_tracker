/**
 * One-time migration: legacy Ocular monthly budget sheet -> ft_* transaction tables.
 *
 * The legacy shape is `years[].{income,expenses}[].budgets[].values[12]`, i.e. one
 * total per category row per month. Row *names* carry the item detail ("Egg", "X-ray",
 * "Mangesh"), so each populated cell becomes one transaction whose note is the row name.
 * What the legacy data never held is the day within the month or a quantity -- imported
 * rows are therefore dated to the 1st and flagged `imported = true`.
 *
 * Usage:
 *   node tracker/scripts/migrate.mjs --dry              # report only, writes nothing
 *   node tracker/scripts/migrate.mjs                    # apply
 *
 * Env (put them in tracker/.env.migrate, which is gitignored):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIGRATE_USER_ID
 *   SOURCE_JSON  optional, defaults to data/user_data_rows.json; omit to read live
 */
import fs from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry');

// -- env ---------------------------------------------------------------------
const envFile = path.resolve('tracker/.env.migrate');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIGRATE_USER_ID } = process.env;
const SOURCE_JSON = process.env.SOURCE_JSON ?? 'data/user_data_rows.json';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (see tracker/.env.migrate)');
  process.exit(1);
}

// -- tiny rest client --------------------------------------------------------
const rest = async (method, pathname, body, headers = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${pathname} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
};

// -- load legacy state -------------------------------------------------------
const loadLegacy = async () => {
  let rows;

  if (fs.existsSync(SOURCE_JSON)) {
    rows = JSON.parse(fs.readFileSync(SOURCE_JSON, 'utf8'));
    console.log(`source: ${SOURCE_JSON}`);
  } else {
    rows = await rest('GET', 'user_data?select=user_id,key,data');
    console.log('source: live user_data table');
  }

  const row = rows.find((r) => r.key === 'data');
  if (!row) throw new Error('no user_data row with key "data"');

  // the column may come back as a JSON string or already-parsed object
  const state = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
  return { state, userId: MIGRATE_USER_ID ?? row.user_id };
};

// -- mapping -----------------------------------------------------------------
// Legacy groups that are not really expenses. Names are matched trimmed + lowercased
// because the source data has trailing spaces on several group names.
const GROUP_KIND = {
  'investment': 'investment',
  'lended friends': 'lending'
};

const norm = (s) => s.replace(/\s+/g, ' ').trim();

const build = (state, userId) => {
  const categories = new Map(); // `${kind}\u0000${name}` -> {name, kind}
  const txs = [];

  const category = (kind, name) => {
    const key = `${kind}\u0000${name}`;
    if (!categories.has(key)) categories.set(key, { user_id: userId, name, kind });
    return key;
  };

  for (const year of state.years ?? []) {
    for (const side of ['income', 'expenses']) {
      for (const group of year[side] ?? []) {
        const gname = norm(group.name);
        const kind = side === 'income' ? 'income' : (GROUP_KIND[gname.toLowerCase()] ?? 'expense');
        const catKey = category(kind, gname);

        for (const budget of group.budgets ?? []) {
          const label = norm(budget.name) || gname;

          (budget.values ?? []).forEach((value, monthIndex) => {
            if (!value) return; // legacy sheet is mostly empty template cells

            txs.push({
              _cat: catKey,
              user_id: userId,
              occurred_on: `${year.year}-${String(monthIndex + 1).padStart(2, '0')}-01`,
              kind,
              note: label,
              qty: 1,
              amount: value,
              person: kind === 'lending' ? label : null,
              imported: true
            });
          });
        }
      }
    }
  }

  return { categories: [...categories.values()], categoryKeys: [...categories.keys()], txs };
};

// -- run ---------------------------------------------------------------------
const main = async () => {
  const { state, userId } = await loadLegacy();
  if (!userId) throw new Error('could not determine user id; set MIGRATE_USER_ID');

  const { categories, categoryKeys, txs } = build(state, userId);

  const byKind = txs.reduce((acc, t) => ({ ...acc, [t.kind]: (acc[t.kind] ?? 0) + 1 }), {});
  const months = [...new Set(txs.map((t) => t.occurred_on.slice(0, 7)))].sort();
  const total = (k) => txs.filter((t) => t.kind === k).reduce((s, t) => s + Number(t.amount), 0);

  console.log(`\nuser            ${userId}`);
  console.log(`legacy currency ${state.currency ?? '?'}`);
  console.log(`categories      ${categories.length}`);
  console.log(`transactions    ${txs.length}  ${JSON.stringify(byKind)}`);
  console.log(`months present  ${months.join(', ')}`);
  console.log(`totals          income ${total('income')} | expense ${total('expense')} | investment ${total('investment')} | lending ${total('lending')}`);

  if (DRY) {
    console.log('\n--dry: nothing written.');
    return;
  }

  // idempotent: drop any previous import for this user, keep hand-entered rows
  console.log('\nclearing previous imported rows...');
  await rest('DELETE', `ft_transactions?user_id=eq.${userId}&imported=is.true`);

  console.log('upserting categories...');
  const saved = await rest(
    'POST',
    'ft_categories?on_conflict=user_id,kind,name&select=id,name,kind',
    categories,
    { prefer: 'resolution=merge-duplicates,return=representation' }
  );

  const idFor = new Map(saved.map((c) => [`${c.kind}\u0000${c.name}`, c.id]));
  const missing = categoryKeys.filter((k) => !idFor.has(k));
  if (missing.length) throw new Error(`categories not returned: ${missing.join(', ')}`);

  console.log(`inserting ${txs.length} transactions...`);
  const payload = txs.map(({ _cat, ...t }) => ({ ...t, category_id: idFor.get(_cat) }));

  for (let i = 0; i < payload.length; i += 200) {
    await rest('POST', 'ft_transactions', payload.slice(i, i + 200), { prefer: 'return=minimal' });
  }

  console.log('\ndone.');
};

main().catch((err) => {
  console.error(`\nmigration failed: ${err.message}`);
  process.exit(1);
});

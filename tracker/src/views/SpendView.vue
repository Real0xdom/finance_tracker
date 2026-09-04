<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { dayLabel, money, todayISO } from '../lib/format';
import {
  addCategory,
  addTx,
  categoriesOf,
  categoryById,
  deleteTx,
  loadMonth,
  store,
  suggestions,
  txOf
} from '../lib/store';
import type { Category, Suggestion } from '../lib/types';

/**
 * Fast expense entry. The search box is the only thing you must touch: it matches
 * both previously entered items ("egg") and categories ("grocery"), so a repeat
 * purchase is two taps and a number.
 */
const query = ref('');
const date = ref(todayISO());
const categoryId = ref<string | null>(null);
const note = ref('');
const qty = ref('1');
const amount = ref('');
const toast = ref('');
const saving = ref(false);

const searchEl = ref<HTMLInputElement>();
const amountEl = ref<HTMLInputElement>();

onMounted(async () => {
  await loadMonth(date.value.slice(0, 7));
  searchEl.value?.focus();
});

const expenseCategories = computed(() => categoriesOf('expense'));
const chosen = computed(() => categoryById(categoryId.value));

const norm = (s: string) => s.toLowerCase().trim();

/** Past items whose note or category matches the query. Empty query = most used. */
const matchedItems = computed<Suggestion[]>(() => {
  const q = norm(query.value);
  const pool = suggestions.value.filter((s) => s.kind === 'expense');

  if (!q) return pool.slice(0, 8);

  return pool
    .filter((s) => norm(s.note).includes(q) || norm(s.categoryName).includes(q))
    .slice(0, 10);
});

const matchedCategories = computed<Category[]>(() => {
  const q = norm(query.value);
  if (!q) return expenseCategories.value.slice(0, 10);
  return expenseCategories.value.filter((c) => norm(c.name).includes(q));
});

/** Offer to create a category only when the query looks deliberate and is unused. */
const canCreate = computed(() => {
  const q = norm(query.value);
  return q.length >= 2 && !expenseCategories.value.some((c) => norm(c.name) === q);
});

const focusAmount = async () => {
  await nextTick();
  amountEl.value?.focus();
  amountEl.value?.select();
};

const pickItem = async (s: Suggestion) => {
  categoryId.value = s.categoryId;
  note.value = s.note;
  amount.value = String(Math.round(s.lastAmount));
  query.value = '';
  await focusAmount();
};

const pickCategory = async (c: Category) => {
  categoryId.value = c.id;
  // the query was a category search, so it is not a useful note
  note.value = '';
  query.value = '';
  await focusAmount();
};

const createCategory = async () => {
  const cat = await addCategory(query.value, 'expense');
  if (cat) await pickCategory(cat);
};

const flash = (message: string) => {
  toast.value = message;
  setTimeout(() => (toast.value = ''), 1600);
};

const save = async () => {
  const value = Number(amount.value);
  if (!categoryId.value || !Number.isFinite(value) || value <= 0) return;

  saving.value = true;

  const tx = await addTx({
    kind: 'expense',
    categoryId: categoryId.value,
    note: note.value,
    qty: Number(qty.value) || 1,
    amount: value,
    date: date.value
  });

  saving.value = false;
  if (!tx) return;

  flash(`Added ${money(value)}`);

  // keep the category so the next item in the same shop is one field away
  note.value = '';
  qty.value = '1';
  amount.value = '';
  await nextTick();
  searchEl.value?.focus();
};

// ------------------------------------------------------------- day breakdown
const dayRows = computed(() =>
  txOf(date.value.slice(0, 7))
    .filter((t) => t.kind === 'expense' && t.occurred_on === date.value)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
);

const dayTotal = computed(() => dayRows.value.reduce((s, t) => s + t.amount, 0));

const changeDay = async (delta: number) => {
  const d = new Date(`${date.value}T00:00:00`);
  d.setDate(d.getDate() + delta);

  const pad = (n: number) => String(n).padStart(2, '0');
  date.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  await loadMonth(date.value.slice(0, 7));
};

const remove = async (id: string) => {
  await deleteTx(id);
  flash('Deleted');
};
</script>

<template>
  <div class="screen">
    <div class="topbar">
      <button class="back" @click="$router.push('/')">‹</button>
      <h1>Add spend</h1>
      <div class="spacer"></div>
      <span class="muted tiny">{{ money(dayTotal) }} today</span>
    </div>

    <input
      ref="searchEl"
      v-model="query"
      class="search"
      placeholder="Search item or category…"
      autocapitalize="none"
      autocomplete="off"
      enterkeyhint="search"
    />

    <!-- previously entered items: the fastest path for anything repeated -->
    <template v-if="matchedItems.length">
      <div class="section-title">{{ query ? 'Matching items' : 'You add these often' }}</div>
      <div class="chips">
        <button v-for="s in matchedItems" :key="s.categoryId + s.note" class="chip" @click="pickItem(s)">
          {{ s.note }}
          <span class="amt">{{ s.categoryName }} · {{ money(s.lastAmount) }}</span>
        </button>
      </div>
    </template>

    <div class="section-title">Categories</div>
    <div class="chips">
      <button
        v-for="c in matchedCategories"
        :key="c.id"
        class="chip"
        :class="{ on: c.id === categoryId }"
        @click="pickCategory(c)"
      >
        {{ c.name }}
      </button>

      <button v-if="canCreate" class="chip" @click="createCategory">＋ Create “{{ query.trim() }}”</button>
    </div>

    <!-- entry form; enabled as soon as a category is chosen -->
    <div class="panel" style="margin-top: 16px">
      <div class="row" style="margin-bottom: 12px">
        <strong v-if="chosen">{{ chosen.name }}</strong>
        <span v-else class="muted">Pick a category above</span>
        <div class="spacer" style="flex: 1"></div>
        <button v-if="chosen" class="btn sm" @click="categoryId = null">Change</button>
      </div>

      <label class="field">
        <span>Remarks</span>
        <input
          v-model="note"
          class="input"
          placeholder="e.g. eggs"
          autocapitalize="sentences"
          autocomplete="off"
          @keyup.enter="focusAmount"
        />
      </label>

      <div class="grid2">
        <label class="field">
          <span>Qty</span>
          <input v-model="qty" class="input" inputmode="decimal" />
        </label>
        <label class="field">
          <span>Amount (total)</span>
          <input
            ref="amountEl"
            v-model="amount"
            class="input"
            inputmode="decimal"
            placeholder="0"
            enterkeyhint="done"
            @keyup.enter="save"
          />
        </label>
      </div>

      <button class="btn primary block" :disabled="!categoryId || !Number(amount) || saving" @click="save">
        {{ saving ? 'Saving…' : 'Add expense' }}
      </button>
    </div>

    <!-- per-day view: step back a day at a time without leaving the screen -->
    <div class="day-head" style="align-items: center">
      <button class="btn sm" @click="changeDay(-1)">‹ Prev</button>
      <span>{{ dayLabel(date) }}</span>
      <button class="btn sm" :disabled="date >= todayISO()" @click="changeDay(1)">Next ›</button>
    </div>

    <div v-if="!dayRows.length" class="empty tiny">No spending recorded on this day.</div>

    <div v-else class="panel list">
      <div v-for="t in dayRows" :key="t.id" class="item">
        <div class="body">
          <div class="title">{{ t.note || categoryById(t.category_id)?.name }}</div>
          <div class="meta">
            {{ categoryById(t.category_id)?.name }}<template v-if="t.qty !== 1"> · ×{{ t.qty }}</template>
          </div>
        </div>
        <div class="amt" style="color: var(--expense)">{{ money(t.amount) }}</div>
        <button class="btn sm" @click="remove(t.id)">✕</button>
      </div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
    <div v-if="store.loadingMonth" class="muted tiny right">syncing…</div>
  </div>
</template>

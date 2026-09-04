<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { currentMonth, dayLabel, money, monthLabel, todayISO } from '../lib/format';
import {
  addCategory,
  addTx,
  applyRecurring,
  categoriesOf,
  categoryById,
  deleteRecurring,
  deleteTx,
  loadMonth,
  saveRecurring,
  store,
  txOf
} from '../lib/store';

/**
 * Income has two shapes: fixed streams that repeat every month (salary), and
 * one-off arrivals (someone sent money). Fixed streams live in ft_recurring and
 * are posted into the month with one tap.
 */
const ym = currentMonth();
const toast = ref('');

// one-off income
const categoryId = ref<string | null>(null);
const note = ref('');
const amount = ref('');
const date = ref(todayISO());

// new fixed stream
const showStream = ref(false);
const streamLabel = ref('');
const streamAmount = ref('');
const streamDay = ref('1');
const streamCategory = ref<string | null>(null);
const newCategory = ref('');

onMounted(async () => {
  await loadMonth(ym);
  const cats = categoriesOf('income');
  categoryId.value = cats[0]?.id ?? null;
  streamCategory.value = cats[0]?.id ?? null;
});

const incomeCategories = computed(() => categoriesOf('income'));
const rows = computed(() => txOf(ym).filter((t) => t.kind === 'income'));
const total = computed(() => rows.value.reduce((s, t) => s + t.amount, 0));
const streams = computed(() => store.recurring.filter((r) => r.kind === 'income' && r.active));

const flash = (m: string) => {
  toast.value = m;
  setTimeout(() => (toast.value = ''), 1600);
};

const addCat = async () => {
  const cat = await addCategory(newCategory.value, 'income');
  if (cat) {
    categoryId.value = cat.id;
    newCategory.value = '';
  }
};

const save = async () => {
  const value = Number(amount.value);
  if (!Number.isFinite(value) || value <= 0) return;

  const tx = await addTx({
    kind: 'income',
    categoryId: categoryId.value,
    note: note.value,
    qty: 1,
    amount: value,
    date: date.value
  });

  if (!tx) return;

  flash(`Added ${money(value)}`);
  note.value = '';
  amount.value = '';
};

const saveStream = async () => {
  const value = Number(streamAmount.value);
  if (!streamLabel.value.trim() || !Number.isFinite(value) || value <= 0) return;

  await saveRecurring({
    label: streamLabel.value.trim(),
    kind: 'income',
    category_id: streamCategory.value,
    amount: value,
    every_n_months: 1,
    day_of_month: Math.min(28, Math.max(1, Number(streamDay.value) || 1)),
    anchor_month: `${ym}-01`,
    active: true
  });

  streamLabel.value = '';
  streamAmount.value = '';
  showStream.value = false;
  flash('Stream saved');
};

const post = async () => {
  const n = await applyRecurring(ym);
  flash(n ? `Posted ${n} item${n > 1 ? 's' : ''}` : 'Already up to date');
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
      <h1>Income</h1>
      <div class="spacer"></div>
      <span class="muted tiny">{{ monthLabel(ym) }}</span>
    </div>

    <div class="panel">
      <div class="stat">
        <div class="k">Received this month</div>
        <div class="v" style="color: var(--income)">{{ money(total) }}</div>
      </div>
    </div>

    <!-- fixed monthly streams -->
    <div class="section-title">Fixed monthly streams</div>

    <div class="panel">
      <div v-if="!streams.length" class="muted tiny">
        No fixed streams yet. Add your salary once and post it every month with one tap.
      </div>

      <div v-else class="list">
        <div v-for="r in streams" :key="r.id" class="item">
          <div class="body">
            <div class="title">{{ r.label }}</div>
            <div class="meta">
              {{ categoryById(r.category_id)?.name ?? 'Uncategorised' }} · day {{ r.day_of_month }}
            </div>
          </div>
          <div class="amt">{{ money(r.amount) }}</div>
          <button class="btn sm" @click="deleteRecurring(r.id)">✕</button>
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <button class="btn sm" @click="showStream = !showStream">
          {{ showStream ? 'Cancel' : '＋ Add stream' }}
        </button>
        <button v-if="streams.length" class="btn sm primary" @click="post">Post to {{ monthLabel(ym) }}</button>
      </div>

      <div v-if="showStream" style="margin-top: 14px">
        <label class="field">
          <span>Name</span>
          <input v-model="streamLabel" class="input" placeholder="Pay slip" />
        </label>

        <div class="grid2">
          <label class="field">
            <span>Amount</span>
            <input v-model="streamAmount" class="input" inputmode="decimal" placeholder="0" />
          </label>
          <label class="field">
            <span>Day of month</span>
            <input v-model="streamDay" class="input" inputmode="numeric" />
          </label>
        </div>

        <label class="field">
          <span>Category</span>
          <select v-model="streamCategory" class="input">
            <option v-for="c in incomeCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>

        <button class="btn primary block" @click="saveStream">Save stream</button>
      </div>
    </div>

    <!-- one-off income -->
    <div class="section-title">Extra income</div>

    <div class="panel">
      <div class="chips" style="margin-bottom: 14px">
        <button
          v-for="c in incomeCategories"
          :key="c.id"
          class="chip"
          :class="{ on: c.id === categoryId }"
          @click="categoryId = c.id"
        >
          {{ c.name }}
        </button>
      </div>

      <div class="row" style="margin-bottom: 12px">
        <input v-model="newCategory" class="input" placeholder="New category" />
        <button class="btn sm" :disabled="!newCategory.trim()" @click="addCat">Add</button>
      </div>

      <label class="field">
        <span>Remarks</span>
        <input v-model="note" class="input" placeholder="e.g. gift from uncle" />
      </label>

      <div class="grid2">
        <label class="field">
          <span>Amount</span>
          <input v-model="amount" class="input" inputmode="decimal" placeholder="0" @keyup.enter="save" />
        </label>
        <label class="field">
          <span>Date</span>
          <input v-model="date" class="input" type="date" />
        </label>
      </div>

      <button class="btn primary block" :disabled="!Number(amount)" @click="save">Add income</button>
    </div>

    <div class="section-title">This month</div>

    <div v-if="!rows.length" class="empty tiny">No income recorded yet.</div>

    <div v-else class="panel list">
      <div v-for="t in rows" :key="t.id" class="item">
        <div class="body">
          <div class="title">{{ t.note || categoryById(t.category_id)?.name }}</div>
          <div class="meta">{{ categoryById(t.category_id)?.name }} · {{ dayLabel(t.occurred_on) }}</div>
        </div>
        <div class="amt" style="color: var(--income)">{{ money(t.amount) }}</div>
        <button class="btn sm" @click="remove(t.id)">✕</button>
      </div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

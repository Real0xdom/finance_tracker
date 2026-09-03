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
 * Investments are money that leaves the account but stays yours, so they are
 * reported separately from expenses. SIPs are fixed monthly amounts, so they are
 * defined once as recurring items and posted each month with one tap.
 */
const ym = currentMonth();
const toast = ref('');

const categoryId = ref<string | null>(null);
const note = ref('');
const amount = ref('');
const date = ref(todayISO());
const newCategory = ref('');

const showSip = ref(false);
const sipLabel = ref('');
const sipAmount = ref('');
const sipDay = ref('1');
const sipCategory = ref<string | null>(null);

onMounted(async () => {
  await loadMonth(ym);
  const cats = categoriesOf('investment');
  categoryId.value = cats[0]?.id ?? null;
  sipCategory.value = cats[0]?.id ?? null;
});

const cats = computed(() => categoriesOf('investment'));
const rows = computed(() => txOf(ym).filter((t) => t.kind === 'investment'));
const total = computed(() => rows.value.reduce((s, t) => s + t.amount, 0));
const sips = computed(() => store.recurring.filter((r) => r.kind === 'investment' && r.active));
const sipTotal = computed(() => sips.value.reduce((s, r) => s + r.amount, 0));

const flash = (m: string) => {
  toast.value = m;
  setTimeout(() => (toast.value = ''), 1600);
};

const addCat = async () => {
  const cat = await addCategory(newCategory.value, 'investment');
  if (cat) {
    categoryId.value = cat.id;
    sipCategory.value ??= cat.id;
    newCategory.value = '';
  }
};

const save = async () => {
  const value = Number(amount.value);
  if (!Number.isFinite(value) || value <= 0) return;

  const tx = await addTx({
    kind: 'investment',
    categoryId: categoryId.value,
    note: note.value,
    qty: 1,
    amount: value,
    date: date.value
  });

  if (!tx) return;

  flash(`Invested ${money(value)}`);
  note.value = '';
  amount.value = '';
};

const saveSip = async () => {
  const value = Number(sipAmount.value);
  if (!sipLabel.value.trim() || !Number.isFinite(value) || value <= 0) return;

  await saveRecurring({
    label: sipLabel.value.trim(),
    kind: 'investment',
    category_id: sipCategory.value,
    amount: value,
    every_n_months: 1,
    day_of_month: Math.min(28, Math.max(1, Number(sipDay.value) || 1)),
    anchor_month: `${ym}-01`,
    active: true
  });

  sipLabel.value = '';
  sipAmount.value = '';
  showSip.value = false;
  flash('SIP saved');
};

const post = async () => {
  const n = await applyRecurring(ym);
  flash(n ? `Posted ${n} item${n > 1 ? 's' : ''}` : 'Already up to date');
};
</script>

<template>
  <div class="screen">
    <div class="topbar">
      <button class="back" @click="$router.push('/')">‹</button>
      <h1>Investment</h1>
      <div class="spacer"></div>
      <span class="muted tiny">{{ monthLabel(ym) }}</span>
    </div>

    <div class="panel">
      <div class="grid2">
        <div class="stat">
          <div class="k">Invested this month</div>
          <div class="v" style="color: var(--invest)">{{ money(total) }}</div>
        </div>
        <div class="stat">
          <div class="k">Planned monthly</div>
          <div class="v">{{ money(sipTotal) }}</div>
        </div>
      </div>
    </div>

    <div class="section-title">Monthly SIPs</div>

    <div class="panel">
      <div v-if="!sips.length" class="muted tiny">
        Add each fund once, then post them all every month with one tap.
      </div>

      <div v-else class="list">
        <div v-for="r in sips" :key="r.id" class="item">
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
        <button class="btn sm" @click="showSip = !showSip">{{ showSip ? 'Cancel' : '＋ Add SIP' }}</button>
        <button v-if="sips.length" class="btn sm primary" @click="post">Post to {{ monthLabel(ym) }}</button>
      </div>

      <div v-if="showSip" style="margin-top: 14px">
        <label class="field">
          <span>Fund name</span>
          <input v-model="sipLabel" class="input" placeholder="Nifty 50 index fund" />
        </label>

        <div class="grid2">
          <label class="field">
            <span>Amount</span>
            <input v-model="sipAmount" class="input" inputmode="decimal" placeholder="0" />
          </label>
          <label class="field">
            <span>Day of month</span>
            <input v-model="sipDay" class="input" inputmode="numeric" />
          </label>
        </div>

        <label class="field">
          <span>Category</span>
          <select v-model="sipCategory" class="input">
            <option v-for="c in cats" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>

        <button class="btn primary block" @click="saveSip">Save SIP</button>
      </div>
    </div>

    <div class="section-title">One-off investment</div>

    <div class="panel">
      <div class="chips" style="margin-bottom: 14px">
        <button
          v-for="c in cats"
          :key="c.id"
          class="chip"
          :class="{ on: c.id === categoryId }"
          @click="categoryId = c.id"
        >
          {{ c.name }}
        </button>
      </div>

      <div class="row" style="margin-bottom: 12px">
        <input v-model="newCategory" class="input" placeholder="New category (e.g. Emergency fund)" />
        <button class="btn sm" :disabled="!newCategory.trim()" @click="addCat">Add</button>
      </div>

      <label class="field">
        <span>Remarks</span>
        <input v-model="note" class="input" placeholder="optional" />
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

      <button class="btn primary block" :disabled="!Number(amount)" @click="save">Add investment</button>
    </div>

    <div class="section-title">This month</div>

    <div v-if="!rows.length" class="empty tiny">Nothing invested yet this month.</div>

    <div v-else class="panel list">
      <div v-for="t in rows" :key="t.id" class="item">
        <div class="body">
          <div class="title">{{ t.note || categoryById(t.category_id)?.name }}</div>
          <div class="meta">{{ categoryById(t.category_id)?.name }} · {{ dayLabel(t.occurred_on) }}</div>
        </div>
        <div class="amt" style="color: var(--invest)">{{ money(t.amount) }}</div>
        <button class="btn sm" @click="deleteTx(t.id)">✕</button>
      </div>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

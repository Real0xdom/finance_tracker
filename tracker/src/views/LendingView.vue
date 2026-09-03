<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { dayLabel, money, todayISO } from '../lib/format';
import { addCategory, addTx, categoriesOf, loadLendings, loadMonth, outstandingLendings } from '../lib/store';

/**
 * Lending is money that leaves but is expected back, so it is deliberately kept
 * out of the expense totals. Each lending row tracks its own repayments, and a
 * lending is "open" until the repayments cover it.
 */
const person = ref('');
const amount = ref('');
const date = ref(todayISO());
const note = ref('');
const toast = ref('');
const repayFor = ref<string | null>(null);
const repayAmount = ref('');

onMounted(async () => {
  await Promise.all([loadLendings(), loadMonth(todayISO().slice(0, 7))]);
});

const open = computed(() =>
  outstandingLendings.value.filter((l) => l.tx.amount - l.repaid > 0.5).sort((a, b) => b.tx.amount - a.tx.amount)
);

const settled = computed(() => outstandingLendings.value.filter((l) => l.tx.amount - l.repaid <= 0.5));

const totalOpen = computed(() => open.value.reduce((s, l) => s + (l.tx.amount - l.repaid), 0));

const flash = (m: string) => {
  toast.value = m;
  setTimeout(() => (toast.value = ''), 1600);
};

/** Everything lent shares one category, created on demand. */
const lendingCategory = async () => {
  const existing = categoriesOf('lending')[0];
  return existing ?? (await addCategory('Lent to friends', 'lending'));
};

const lend = async () => {
  const value = Number(amount.value);
  if (!person.value.trim() || !Number.isFinite(value) || value <= 0) return;

  const cat = await lendingCategory();

  const tx = await addTx({
    kind: 'lending',
    categoryId: cat?.id ?? null,
    note: note.value.trim() || person.value.trim(),
    qty: 1,
    amount: value,
    date: date.value,
    person: person.value.trim()
  });

  if (!tx) return;

  flash(`Lent ${money(value)} to ${person.value.trim()}`);
  person.value = '';
  amount.value = '';
  note.value = '';
};

const openRepay = (id: string, remaining: number) => {
  repayFor.value = id;
  repayAmount.value = String(Math.round(remaining));
};

const repay = async (lendId: string, who: string | null, categoryId: string | null) => {
  const value = Number(repayAmount.value);
  if (!Number.isFinite(value) || value <= 0) return;

  const tx = await addTx({
    kind: 'repayment',
    categoryId,
    note: `Repaid by ${who ?? 'friend'}`,
    qty: 1,
    amount: value,
    date: todayISO(),
    person: who,
    lendId
  });

  if (!tx) return;

  repayFor.value = null;
  repayAmount.value = '';
  flash(`Recovered ${money(value)}`);
};
</script>

<template>
  <div class="screen">
    <div class="topbar">
      <button class="back" @click="$router.push('/')">‹</button>
      <h1>Lending</h1>
    </div>

    <div class="panel" style="--tint: var(--lend)">
      <div class="stat">
        <div class="k">Owed back to you</div>
        <div class="v" style="color: var(--lend)">{{ money(totalOpen) }}</div>
      </div>
      <p class="muted tiny" style="margin: 8px 0 0">
        Not counted as expense — this is money on its way back to your account.
      </p>
    </div>

    <div class="section-title">Lend money</div>

    <div class="panel">
      <div class="grid2">
        <label class="field">
          <span>Person</span>
          <input v-model="person" class="input" placeholder="Mangesh" />
        </label>
        <label class="field">
          <span>Amount</span>
          <input v-model="amount" class="input" inputmode="decimal" placeholder="0" />
        </label>
      </div>

      <div class="grid2">
        <label class="field">
          <span>Remarks</span>
          <input v-model="note" class="input" placeholder="optional" />
        </label>
        <label class="field">
          <span>Date</span>
          <input v-model="date" class="input" type="date" />
        </label>
      </div>

      <button class="btn primary block" :disabled="!person.trim() || !Number(amount)" @click="lend">
        Record lending
      </button>
    </div>

    <div class="section-title">Open</div>

    <div v-if="!open.length" class="empty tiny">Nothing outstanding. Everyone has paid you back.</div>

    <div v-else class="panel list">
      <template v-for="l in open" :key="l.tx.id">
        <div class="item">
          <div class="body">
            <div class="title">{{ l.tx.person || l.tx.note }}</div>
            <div class="meta">
              {{ dayLabel(l.tx.occurred_on) }}
              <template v-if="l.repaid"> · {{ money(l.repaid) }} of {{ money(l.tx.amount) }} back</template>
            </div>
            <div v-if="l.repaid" class="meter" style="--tint: var(--lend)">
              <i :style="{ width: `${Math.min(100, (l.repaid / l.tx.amount) * 100)}%` }"></i>
            </div>
          </div>
          <div class="amt" style="color: var(--lend)">{{ money(l.tx.amount - l.repaid) }}</div>
          <button class="btn sm" @click="openRepay(l.tx.id, l.tx.amount - l.repaid)">Got back</button>
        </div>

        <div v-if="repayFor === l.tx.id" class="row" style="padding: 0 2px 12px">
          <input v-model="repayAmount" class="input" inputmode="decimal" />
          <button class="btn sm primary" @click="repay(l.tx.id, l.tx.person, l.tx.category_id)">Confirm</button>
          <button class="btn sm" @click="repayFor = null">Cancel</button>
        </div>
      </template>
    </div>

    <template v-if="settled.length">
      <div class="section-title">Settled</div>
      <div class="panel list">
        <div v-for="l in settled" :key="l.tx.id" class="item">
          <div class="body">
            <div class="title muted">{{ l.tx.person || l.tx.note }}</div>
            <div class="meta">{{ dayLabel(l.tx.occurred_on) }} · fully recovered</div>
          </div>
          <div class="amt muted">{{ money(l.tx.amount) }}</div>
        </div>
      </div>
    </template>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

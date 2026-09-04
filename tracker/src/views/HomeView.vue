<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { summarize } from '../lib/analytics';
import { currentMonth, dayLabel, money, monthLabel } from '../lib/format';
import { categoryById, loadMonth, outstandingLendings, txOf } from '../lib/store';

const router = useRouter();
const ym = currentMonth();

onMounted(() => loadMonth(ym));

const s = computed(() => summarize(ym));

const outstanding = computed(() =>
  outstandingLendings.value.reduce((total, l) => total + Math.max(0, l.tx.amount - l.repaid), 0)
);

/** The five most recent entries, so the home screen shows today's activity. */
const recent = computed(() => txOf(ym).slice(0, 5));

const sign = (kind: string) => (kind === 'income' || kind === 'repayment' ? '+' : '−');
</script>

<template>
  <div class="screen">
    <div class="topbar">
      <h1>{{ monthLabel(ym) }}</h1>
      <div class="spacer"></div>
      <span class="muted tiny">{{ s.count }} entries</span>
    </div>

    <div class="cards">
      <button class="card" style="--tint: var(--income)" @click="router.push('/income')">
        <span class="label">Income</span>
        <span class="value">{{ money(s.income) }}</span>
        <span class="sub">Tap to add income</span>
      </button>

      <button class="card" style="--tint: var(--expense)" @click="router.push('/spend')">
        <span class="label">Spending</span>
        <span class="value">{{ money(s.expense) }}</span>
        <span class="sub">{{ money(s.perDay) }} / day</span>
      </button>

      <button class="card" style="--tint: var(--lend)" @click="router.push('/lending')">
        <span class="label">Lending</span>
        <span class="value">{{ money(outstanding) }}</span>
        <span class="sub">Owed back to you</span>
      </button>

      <button class="card" style="--tint: var(--invest)" @click="router.push('/investment')">
        <span class="label">Investment</span>
        <span class="value">{{ money(s.investment) }}</span>
        <span class="sub">Still yours</span>
      </button>
    </div>

    <div class="panel">
      <div class="grid2">
        <div class="stat">
          <div class="k">Net kept</div>
          <div class="v" :style="{ color: s.net >= 0 ? 'var(--income)' : 'var(--expense)' }">
            {{ money(s.net) }}
          </div>
        </div>
        <div class="stat">
          <div class="k">Top category</div>
          <div class="v">{{ s.topCategory?.name ?? '—' }}</div>
        </div>
      </div>
      <p class="muted tiny" style="margin: 10px 0 0">
        Lent money is excluded from spending because it comes back.
      </p>
    </div>

    <div class="section-title">Recent</div>

    <div v-if="!recent.length" class="empty">
      Nothing yet this month.<br />
      Tap <strong>Spending</strong> to add your first entry.
    </div>

    <div v-else class="panel list">
      <div v-for="t in recent" :key="t.id" class="item">
        <div class="body">
          <div class="title">{{ t.note || categoryById(t.category_id)?.name || 'Entry' }}</div>
          <div class="meta">
            {{ categoryById(t.category_id)?.name ?? 'Uncategorised' }} · {{ dayLabel(t.occurred_on) }}
          </div>
        </div>
        <div class="amt" :class="t.kind">{{ sign(t.kind) }}{{ money(t.amount) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.amt.expense {
  color: var(--expense);
}
.amt.income,
.amt.repayment {
  color: var(--income);
}
.amt.investment {
  color: var(--invest);
}
.amt.lending {
  color: var(--lend);
}
</style>

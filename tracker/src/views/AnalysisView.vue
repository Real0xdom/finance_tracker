<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import EChart from '../components/EChart.vue';
import { categoryTotals, dailyTotals, observations, summarize, topExpenses } from '../lib/analytics';
import { dayLabel, money, moneyShort, monthLabel, shiftMonth } from '../lib/format';
import { analyseMonth } from '../lib/gemini';
import { GRID, MUTED, OTHER, SERIES, SURFACE, TEXT, seriesColor } from '../lib/palette';
import { categoryById, knownMonths, loadMonth, store, txOf } from '../lib/store';
import type { EChartsOption } from 'echarts';

/**
 * The analysis tab opens on the current month, then lets any month with data be
 * selected. Tapping a category — in the donut or the list — drills into it.
 */
const month = computed(() => store.viewMonth);
const drill = ref<string | null>(null);
const analysis = ref('');
const analysisSource = ref<'gemini' | 'local'>('local');
const analysisNote = ref('');
const analysing = ref(false);

onMounted(async () => {
  await loadMonth(month.value);
  await Promise.all([loadMonth(shiftMonth(month.value, -1)), runAnalysis()]);
});

const pickMonth = async (ym: string) => {
  store.viewMonth = ym;
  drill.value = null;
  await loadMonth(ym);
  await loadMonth(shiftMonth(ym, -1));
  await runAnalysis();
};

const summary = computed(() => summarize(month.value));
const cats = computed(() => categoryTotals(month.value, 'expense'));

/** Top six categories keep their fixed slot; the rest fold into one neutral slice. */
const slices = computed(() => {
  const all = cats.value;
  const head = all.slice(0, 6);
  const tail = all.slice(6);

  const rest = tail.reduce((s, c) => s + c.amount, 0);
  const out = head.map((c, i) => ({ ...c, color: seriesColor(i) }));

  if (rest > 0) {
    out.push({ id: 'other', name: 'Other', amount: rest, share: rest / (summary.value.expense || 1), count: tail.length, color: OTHER });
  }

  return out;
});

const donut: import('vue').ComputedRef<EChartsOption> = computed(() => ({
  backgroundColor: 'transparent',
  tooltip: {
    trigger: 'item',
    backgroundColor: '#1f2430',
    borderColor: GRID,
    textStyle: { color: TEXT, fontSize: 12 },
    formatter: (p: unknown) => {
      const d = p as { name: string; value: number; percent: number };
      return `${d.name}<br/><strong>${money(d.value)}</strong> · ${Math.round(d.percent)}%`;
    }
  },
  series: [
    {
      type: 'pie',
      radius: ['58%', '84%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      // 2px surface gap between segments, so identity never rests on hue alone
      itemStyle: { borderColor: SURFACE, borderWidth: 2 },
      label: { show: false },
      labelLine: { show: false },
      data: slices.value.map((s) => ({
        name: s.name,
        value: Math.round(s.amount),
        itemStyle: { color: s.color }
      }))
    }
  ]
}));

/** Daily expense bars: magnitude over time, one axis, rounded data-ends. */
const daily: import('vue').ComputedRef<EChartsOption> = computed(() => {
  const rows = dailyTotals(month.value);

  return {
    backgroundColor: 'transparent',
    grid: { top: 16, right: 8, bottom: 24, left: 44 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1f2430',
      borderColor: GRID,
      textStyle: { color: TEXT, fontSize: 12 },
      formatter: (p: unknown) => {
        const arr = p as { name: string; value: number }[];
        return `Day ${arr[0].name}<br/><strong>${money(arr[0].value)}</strong>`;
      }
    },
    xAxis: {
      type: 'category',
      data: rows.map((r) => String(r.day)),
      axisLine: { lineStyle: { color: GRID } },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 10, interval: 4 }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: GRID, type: 'dashed' } },
      axisLabel: { color: MUTED, fontSize: 10, formatter: (v: number) => moneyShort(v) }
    },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => Math.round(r.amount)),
        itemStyle: { color: SERIES[0], borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 14
      }
    ]
  };
});

// ------------------------------------------------------------------- drilling
const drillRows = computed(() => {
  if (!drill.value) return [];

  return txOf(month.value)
    .filter((t) => t.kind === 'expense' && (categoryById(t.category_id)?.name ?? 'Uncategorised') === drill.value)
    .sort((a, b) => b.amount - a.amount);
});

const drillTotal = computed(() => drillRows.value.reduce((s, t) => s + t.amount, 0));

/** Within a category, what did the money actually go on. */
const drillChart: import('vue').ComputedRef<EChartsOption> = computed(() => {
  const byNote = new Map<string, number>();

  for (const t of drillRows.value) {
    const k = t.note || 'unnamed';
    byNote.set(k, (byNote.get(k) ?? 0) + t.amount);
  }

  const rows = [...byNote.entries()].sort((a, b) => a[1] - b[1]).slice(-8);

  return {
    backgroundColor: 'transparent',
    grid: { top: 8, right: 16, bottom: 8, left: 8, containLabel: true },
    tooltip: {
      trigger: 'item',
      backgroundColor: '#1f2430',
      borderColor: GRID,
      textStyle: { color: TEXT, fontSize: 12 },
      formatter: (p: unknown) => {
        const d = p as { name: string; value: number };
        return `${d.name}<br/><strong>${money(d.value)}</strong>`;
      }
    },
    xAxis: { type: 'value', show: false },
    yAxis: {
      type: 'category',
      data: rows.map((r) => r[0]),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: TEXT, fontSize: 11 }
    },
    series: [
      {
        type: 'bar',
        data: rows.map((r) => Math.round(r[1])),
        itemStyle: { color: SERIES[1], borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 16,
        label: {
          show: true,
          position: 'right',
          color: MUTED,
          fontSize: 10,
          formatter: (p: { value?: unknown }) => moneyShort(Number(p.value ?? 0))
        }
      }
    ]
  };
});

const onPick = (name: string) => {
  if (!name || name === 'Other') return;
  drill.value = drill.value === name ? null : name;
};

// ------------------------------------------------------------------- analysis
const runAnalysis = async () => {
  analysing.value = true;
  analysisNote.value = '';

  const res = await analyseMonth(month.value);

  analysis.value = res.text;
  analysisSource.value = res.source;
  analysisNote.value = res.error ?? '';
  analysing.value = false;
};

const localNotes = computed(() => observations(month.value, shiftMonth(month.value, -1)));

watch(month, () => (drill.value = null));
</script>

<template>
  <div class="screen">
    <div class="topbar">
      <h1>Analysis</h1>
      <div class="spacer"></div>
      <span class="muted tiny">{{ monthLabel(month) }}</span>
    </div>

    <!-- month picker; current month is first because that is the usual question -->
    <div class="months">
      <button
        v-for="m in knownMonths"
        :key="m"
        class="chip"
        :class="{ on: m === month }"
        @click="pickMonth(m)"
      >
        {{ monthLabel(m) }}
      </button>
    </div>

    <div class="panel">
      <div class="k muted tiny" style="letter-spacing: 0.05em; text-transform: uppercase">Spent this month</div>
      <div style="font-size: 32px; font-weight: 750; letter-spacing: -0.02em; color: var(--expense)">
        {{ money(summary.expense) }}
      </div>
      <div class="muted tiny">{{ money(summary.perDay) }} per day over {{ summary.days }} days</div>
    </div>

    <div class="panel">
      <div class="grid2">
        <div class="stat">
          <div class="k">Income</div>
          <div class="v" style="color: var(--income)">{{ money(summary.income) }}</div>
        </div>
        <div class="stat">
          <div class="k">Invested</div>
          <div class="v" style="color: var(--invest)">{{ money(summary.investment) }}</div>
        </div>
        <div class="stat">
          <div class="k">Net kept</div>
          <div class="v" :style="{ color: summary.net >= 0 ? 'var(--income)' : 'var(--expense)' }">
            {{ money(summary.net) }}
          </div>
        </div>
        <div class="stat">
          <div class="k">Lent out</div>
          <div class="v" style="color: var(--lend)">{{ money(summary.lent) }}</div>
        </div>
      </div>
    </div>

    <template v-if="summary.count">
      <div class="section-title">Where it went</div>

      <div class="panel">
        <EChart :option="donut" height="200px" @pick="onPick" />

        <!-- the labelled breakdown doubles as the table view, so identity never
             depends on colour alone -->
        <div class="list" style="margin-top: 8px">
          <button
            v-for="s in slices"
            :key="s.id"
            class="item"
            :class="{ picked: drill === s.name }"
            style="width: 100%; border: 0; background: none; text-align: left"
            @click="onPick(s.name)"
          >
            <span class="swatch" :style="{ background: s.color }"></span>
            <div class="body">
              <div class="title">{{ s.name }}</div>
              <div class="meta">{{ Math.round(s.share * 100) }}% · {{ s.count }} entries</div>
            </div>
            <div class="amt">{{ money(s.amount) }}</div>
          </button>
        </div>
      </div>

      <!-- drill-down -->
      <template v-if="drill">
        <div class="section-title">{{ drill }} · {{ money(drillTotal) }}</div>

        <div class="panel">
          <EChart :option="drillChart" :height="`${Math.max(120, Math.min(8, drillRows.length) * 34)}px`" />

          <div class="list" style="margin-top: 6px">
            <div v-for="t in drillRows" :key="t.id" class="item">
              <div class="body">
                <div class="title">{{ t.note || 'unnamed' }}</div>
                <div class="meta">
                  {{ t.imported ? 'imported — month total' : dayLabel(t.occurred_on) }}
                  <template v-if="t.qty !== 1"> · ×{{ t.qty }}</template>
                </div>
              </div>
              <div class="amt">{{ money(t.amount) }}</div>
            </div>
          </div>
        </div>
      </template>

      <div class="section-title">Daily spend</div>
      <div class="panel">
        <EChart :option="daily" height="200px" />
      </div>

      <div class="section-title">Biggest single expenses</div>
      <div class="panel list">
        <div v-for="t in topExpenses(month, 5)" :key="t.id" class="item">
          <div class="body">
            <div class="title">{{ t.note || categoryById(t.category_id)?.name }}</div>
            <div class="meta">
              {{ categoryById(t.category_id)?.name }} ·
              {{ t.imported ? 'imported' : dayLabel(t.occurred_on) }}
            </div>
          </div>
          <div class="amt">{{ money(t.amount) }}</div>
        </div>
      </div>
    </template>

    <div v-else class="empty">No entries for {{ monthLabel(month) }}.</div>

    <!-- analysis -->
    <div class="section-title">
      Analysis
      <span class="muted" style="text-transform: none; letter-spacing: 0">
        · {{ analysisSource === 'gemini' ? 'Gemini' : 'built-in' }}
      </span>
    </div>

    <div class="panel">
      <div v-if="analysing" class="muted tiny">Thinking…</div>
      <div v-else class="analysis">{{ analysis || localNotes.map((n) => `- ${n}`).join('\n') }}</div>

      <p v-if="analysisNote" class="tiny" style="margin: 10px 0 0; color: var(--lend)">{{ analysisNote }}</p>

      <div class="row" style="margin-top: 12px">
        <button class="btn sm" :disabled="analysing" @click="runAnalysis">Re-run</button>
        <RouterLink v-if="analysisSource === 'local'" to="/settings" class="btn sm">Add Gemini key</RouterLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
.swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex: none;
}

.item.picked {
  border-radius: 10px;
  background: var(--surface-2) !important;
}

.amt {
  color: var(--text);
}
</style>

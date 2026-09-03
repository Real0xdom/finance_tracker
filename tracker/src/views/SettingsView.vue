<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { currentMonth, money, monthLabel } from '../lib/format';
import { verifyKey } from '../lib/gemini';
import {
  addCategory,
  applyRecurring,
  categoriesOf,
  categoryById,
  deleteCategory,
  deleteRecurring,
  saveRecurring,
  saveSettings,
  signOut,
  store
} from '../lib/store';
import type { CategoryKind } from '../lib/types';

const router = useRouter();
const toast = ref('');

// gemini
const key = ref(store.settings.gemini_api_key ?? '');
const checking = ref(false);
const keyNote = ref('');

// budget
const budget = ref(store.settings.monthly_budget ? String(store.settings.monthly_budget) : '');

// categories
const catKind = ref<CategoryKind>('expense');
const catName = ref('');

// recurring (the general editor — covers the every-3-months trip)
const showRec = ref(false);
const recLabel = ref('');
const recAmount = ref('');
const recEvery = ref('1');
const recDay = ref('1');
const recKind = ref<'expense' | 'income' | 'investment'>('expense');
const recCategory = ref<string | null>(null);

const flash = (m: string) => {
  toast.value = m;
  setTimeout(() => (toast.value = ''), 1800);
};

const saveKey = async () => {
  checking.value = true;
  keyNote.value = '';

  const trimmed = key.value.trim();
  const problem = trimmed ? await verifyKey(trimmed) : null;

  checking.value = false;

  if (problem) {
    keyNote.value = problem;
    return;
  }

  await saveSettings({ gemini_api_key: trimmed || null });
  keyNote.value = trimmed ? 'Key verified and saved.' : 'Key removed — using built-in analysis.';
};

const saveBudget = async () => {
  const value = Number(budget.value);
  await saveSettings({ monthly_budget: Number.isFinite(value) && value > 0 ? value : null });
  flash('Saved');
};

const addCat = async () => {
  if (!catName.value.trim()) return;
  await addCategory(catName.value, catKind.value);
  catName.value = '';
  flash('Category added');
};

const recCategories = computed(() =>
  categoriesOf(recKind.value === 'income' ? 'income' : recKind.value === 'investment' ? 'investment' : 'expense')
);

const saveRec = async () => {
  const value = Number(recAmount.value);
  if (!recLabel.value.trim() || !Number.isFinite(value) || value <= 0) return;

  await saveRecurring({
    label: recLabel.value.trim(),
    kind: recKind.value,
    category_id: recCategory.value,
    amount: value,
    every_n_months: Math.min(12, Math.max(1, Number(recEvery.value) || 1)),
    day_of_month: Math.min(28, Math.max(1, Number(recDay.value) || 1)),
    anchor_month: `${currentMonth()}-01`,
    active: true
  });

  recLabel.value = '';
  recAmount.value = '';
  showRec.value = false;
  flash('Recurring item saved');
};

const postAll = async () => {
  const n = await applyRecurring(currentMonth());
  flash(n ? `Posted ${n} item${n > 1 ? 's' : ''}` : 'Already up to date');
};

const cadence = (n: number) => (n === 1 ? 'every month' : `every ${n} months`);

const leave = async () => {
  await signOut();
  await router.replace('/login');
};

const kinds: CategoryKind[] = ['expense', 'income', 'investment', 'lending'];
</script>

<template>
  <div class="screen">
    <div class="topbar">
      <h1>Settings</h1>
    </div>

    <!-- Gemini -->
    <div class="section-title">AI analysis</div>

    <div class="panel">
      <label class="field">
        <span>Google Gemini API key</span>
        <input
          v-model="key"
          class="input"
          type="password"
          placeholder="AIza…"
          autocapitalize="none"
          autocomplete="off"
          spellcheck="false"
        />
      </label>

      <button class="btn primary block" :disabled="checking" @click="saveKey">
        {{ checking ? 'Verifying…' : 'Verify and save' }}
      </button>

      <p v-if="keyNote" class="tiny" style="margin: 10px 0 0" :style="{ color: keyNote.includes('saved') || keyNote.includes('removed') ? 'var(--income)' : 'var(--expense)' }">
        {{ keyNote }}
      </p>

      <p class="muted tiny" style="margin: 10px 0 0">
        Without a key the analysis tab uses the built-in rules. The key is stored on your own
        Supabase row and only ever sent to Google.
      </p>
    </div>

    <!-- budget -->
    <div class="section-title">Monthly target</div>

    <div class="panel">
      <div class="row">
        <input v-model="budget" class="input" inputmode="decimal" placeholder="e.g. 40000" />
        <button class="btn sm primary" @click="saveBudget">Save</button>
      </div>
      <p class="muted tiny" style="margin: 10px 0 0">Used as context for the analysis. Leave blank for none.</p>
    </div>

    <!-- recurring -->
    <div class="section-title">Recurring items</div>

    <div class="panel">
      <p class="muted tiny" style="margin: 0 0 12px">
        Anything on a fixed schedule — rent, SIPs, salary, or the trip you make every third month.
        Post them into {{ monthLabel(currentMonth()) }} with one tap.
      </p>

      <div v-if="store.recurring.length" class="list">
        <div v-for="r in store.recurring" :key="r.id" class="item">
          <div class="body">
            <div class="title">{{ r.label }}</div>
            <div class="meta">
              {{ r.kind }} · {{ categoryById(r.category_id)?.name ?? 'Uncategorised' }} ·
              {{ cadence(r.every_n_months) }}, day {{ r.day_of_month }}
            </div>
          </div>
          <div class="amt">{{ money(r.amount) }}</div>
          <button class="btn sm" @click="deleteRecurring(r.id)">✕</button>
        </div>
      </div>

      <div class="row" style="margin-top: 12px">
        <button class="btn sm" @click="showRec = !showRec">{{ showRec ? 'Cancel' : '＋ Add' }}</button>
        <button v-if="store.recurring.length" class="btn sm primary" @click="postAll">Post due items</button>
      </div>

      <div v-if="showRec" style="margin-top: 14px">
        <label class="field">
          <span>Name</span>
          <input v-model="recLabel" class="input" placeholder="Trip to Dehradun" />
        </label>

        <label class="field">
          <span>Type</span>
          <select v-model="recKind" class="input">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="investment">Investment</option>
          </select>
        </label>

        <label class="field">
          <span>Category</span>
          <select v-model="recCategory" class="input">
            <option :value="null">— none —</option>
            <option v-for="c in recCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>

        <div class="grid2">
          <label class="field">
            <span>Amount</span>
            <input v-model="recAmount" class="input" inputmode="decimal" placeholder="0" />
          </label>
          <label class="field">
            <span>Every N months</span>
            <input v-model="recEvery" class="input" inputmode="numeric" />
          </label>
        </div>

        <label class="field">
          <span>Day of month</span>
          <input v-model="recDay" class="input" inputmode="numeric" />
        </label>

        <button class="btn primary block" @click="saveRec">Save recurring item</button>
      </div>
    </div>

    <!-- categories -->
    <div class="section-title">Categories</div>

    <div class="panel">
      <div class="row" style="margin-bottom: 12px">
        <select v-model="catKind" class="input" style="max-width: 140px">
          <option v-for="k in kinds" :key="k" :value="k">{{ k }}</option>
        </select>
        <input v-model="catName" class="input" placeholder="New category" />
        <button class="btn sm" :disabled="!catName.trim()" @click="addCat">Add</button>
      </div>

      <div class="list">
        <div v-for="c in categoriesOf(catKind)" :key="c.id" class="item">
          <div class="body">
            <div class="title">{{ c.name }}</div>
          </div>
          <button class="btn sm" @click="deleteCategory(c.id)">Archive</button>
        </div>
      </div>
    </div>

    <!-- account -->
    <div class="section-title">Account</div>

    <div class="panel">
      <p class="muted tiny" style="margin: 0 0 12px">Signed in as {{ store.email }}</p>
      <button class="btn danger block" @click="leave">Sign out</button>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { bootstrap, clearError, session, store } from './lib/store';
import { configured } from './lib/supabase';

const route = useRoute();
const router = useRouter();
const booting = ref(true);

onMounted(async () => {
  if (configured) await bootstrap();
  booting.value = false;

  // the guard runs before the session is restored, so land the user correctly now
  await router.replace(session.value ? (route.path === '/login' ? '/' : route.fullPath) : '/login');
});
</script>

<template>
  <div v-if="!configured" class="screen">
    <div class="panel">
      <h1>Not configured</h1>
      <p class="muted">
        This build has no Supabase URL or anon key baked in. Set <code>FT_SUPABASE_URL</code> and
        <code>FT_SUPABASE_ANON_KEY</code> and rebuild.
      </p>
    </div>
  </div>

  <div v-else-if="booting" class="spinner">Loading…</div>

  <template v-else>
    <RouterView />

    <nav v-if="session" class="tabbar">
      <RouterLink to="/" :class="{ active: route.name === 'home' }">
        <span class="ico">◉</span>
        Home
      </RouterLink>
      <RouterLink to="/spend" :class="{ active: route.name === 'spend' }">
        <span class="ico">＋</span>
        Add spend
      </RouterLink>
      <RouterLink to="/analysis" :class="{ active: route.name === 'analysis' }">
        <span class="ico">◒</span>
        Analysis
      </RouterLink>
      <RouterLink to="/settings" :class="{ active: route.name === 'settings' }">
        <span class="ico">⚙</span>
        Settings
      </RouterLink>
    </nav>

    <div v-if="store.error" class="toast bad" @click="clearError()">{{ store.error }}</div>
  </template>
</template>

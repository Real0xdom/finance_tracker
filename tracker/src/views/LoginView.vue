<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { signIn } from '../lib/store';

const router = useRouter();
const email = ref('');
const password = ref('');
const busy = ref(false);
const error = ref('');

const submit = async () => {
  busy.value = true;
  error.value = '';

  const message = await signIn(email.value.trim(), password.value);
  busy.value = false;

  if (message) error.value = message;
  else await router.replace('/');
};
</script>

<template>
  <div class="screen">
    <div style="height: 12vh"></div>

    <h1 style="margin: 0 0 4px; font-size: 28px">Money</h1>
    <p class="muted" style="margin: 0 0 28px">Sign in with your existing account.</p>

    <form @submit.prevent="submit">
      <label class="field">
        <span>Email</span>
        <input
          v-model="email"
          class="input"
          type="email"
          autocomplete="username"
          inputmode="email"
          autocapitalize="none"
          required
        />
      </label>

      <label class="field">
        <span>Password</span>
        <input v-model="password" class="input" type="password" autocomplete="current-password" required />
      </label>

      <button class="btn primary block" type="submit" :disabled="busy">
        {{ busy ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>

    <p v-if="error" class="muted tiny" style="margin-top: 14px; color: var(--expense)">{{ error }}</p>
  </div>
</template>

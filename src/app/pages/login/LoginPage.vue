<template>
  <div :class="$style.page">
    <Button
      v-if="closable"
      :class="$style.close"
      textual
      color="dimmed"
      size="l"
      :icon="RiCloseLine"
      @click="emit('close')"
    />

    <div :class="$style.card">
      <img :class="$style.logo" src="/images/icon-192x192.png" alt="" />
      <h1 :class="$style.title">
        {{ mode === 'signIn' ? t('navigation.auth.welcomeBack') : t('navigation.auth.signUp') }}
      </h1>

      <Form
        :class="$style.form"
        :disabled="!!retryDuration"
        :submitIcon="mode === 'signIn' ? RiLoginCircleLine : RiUserAddLine"
        :submitLabel="mode === 'signIn' ? t('navigation.auth.signIn') : t('navigation.auth.signUp')"
        @submit="submit"
      >
        <TextField
          v-model="username"
          testId="username"
          required
          :label="t('navigation.auth.email')"
          type="email"
          name="email"
        />
        <TextField
          v-model="password"
          testId="password"
          required
          :minLength="mode === 'signUp' ? 8 : undefined"
          :label="t('navigation.auth.password')"
          type="password"
          name="password"
        />

        <Alert
          v-if="confirmationSent"
          testId="signup-confirmation-sent"
          :text="t('navigation.auth.confirmationEmailSent')"
          type="success"
        />

        <template v-else-if="mode === 'signIn' && state?.error?.status === 429">
          <Alert
            v-if="retryDuration"
            testId="login-too-many-attempts"
            :text="t('navigation.auth.tooManyFailedAttempts', { duration: retryDuration })"
            type="error"
          />
        </template>

        <Alert
          v-else-if="mode === 'signIn' && state?.error?.status === 401"
          testId="login-invalid-credentials"
          :text="t('navigation.auth.incorrectUsernameOrPassword')"
          type="error"
        />

        <Alert v-else-if="mode === 'signIn' && state?.error" :text="state.error.message" type="error" />
        <Alert v-else-if="mode === 'signUp' && signupError" :text="signupError" type="error" />
      </Form>

      <Button
        :class="$style.toggleMode"
        textual
        color="dimmed"
        type="button"
        :text="mode === 'signIn' ? t('navigation.auth.noAccount') : t('navigation.auth.haveAccount')"
        @click="toggleMode"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import Alert from '@components/base/alert/Alert.vue';
import Button from '@components/base/button/Button.vue';
import Form from '@components/base/form/Form.vue';
import TextField from '@components/base/text-field/TextField.vue';
import { useStorage } from '@store/storage/useStorage.ts';
import { RiCloseLine, RiLoginCircleLine, RiUserAddLine } from '@remixicon/vue';
import { useAsyncState, useTimestamp } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { OCULAR_TEST_USERNAME, OCULAR_TEST_PASSWORD } = import.meta.env;

const emit = defineEmits<{
  close: [];
}>();

defineProps<{
  closable?: boolean;
}>();

const time = useTimestamp();
const { t, locale } = useI18n();
const { login, signup } = useStorage();
const { state, executeImmediate } = useAsyncState(login, undefined, {
  immediate: false
});

const mode = ref<'signIn' | 'signUp'>('signIn');
const username = ref(OCULAR_TEST_USERNAME);
const password = ref(OCULAR_TEST_PASSWORD);
const signupError = ref<string | undefined>();
const confirmationSent = ref(false);

const toggleMode = () => {
  mode.value = mode.value === 'signIn' ? 'signUp' : 'signIn';
  signupError.value = undefined;
  confirmationSent.value = false;
  state.value = undefined;
};

const submit = async () => {
  if (mode.value === 'signIn') {
    await executeImmediate(username.value, password.value);
    return;
  }

  signupError.value = undefined;
  confirmationSent.value = false;

  const res = await signup(username.value ?? '', password.value ?? '');

  if (res.error) {
    signupError.value = res.error.message;
  } else if (!res.data.confirmed) {
    confirmationSent.value = true;
  }
};

const relativeTimeFormatter = computed(() => new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' }));

const retryTimeLeft = computed(() => {
  const { status, retry_after, retry_timestamp } = state.value?.error ?? {
    retry_after: undefined,
    retry_timestamp: undefined
  };

  if (status !== 429 || typeof retry_after !== 'number' || typeof retry_timestamp !== 'number') {
    return;
  }

  return retry_after - Math.floor(time.value / 1000 - retry_timestamp);
});

const retryDuration = computed(() => {
  if (!retryTimeLeft.value) return;

  if (retryTimeLeft.value < 1) {
    return undefined;
  }

  if (retryTimeLeft.value < 60) {
    return relativeTimeFormatter.value.format(Math.ceil(retryTimeLeft.value), 'second');
  }

  const minutes = Math.ceil(retryTimeLeft.value / 60);
  return relativeTimeFormatter.value.format(minutes, 'minute');
});

watch(retryTimeLeft, (duration) => {
  if (duration && duration < 1) {
    state.value = undefined;
  }
});
</script>

<style lang="scss" module>
.page {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--app-background);

  &::before,
  &::after {
    content: '';
    position: absolute;
    width: 45vmax;
    height: 45vmax;
    border-radius: var(--border-radius-full);
    filter: blur(120px);
    opacity: 0.35;
    pointer-events: none;
  }

  &::before {
    top: -20vmax;
    left: -15vmax;
    background: var(--c-primary);
  }

  &::after {
    bottom: -20vmax;
    right: -15vmax;
    background: var(--c-success);
  }
}

.close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
}

.card {
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  width: min(380px, calc(100% - 32px));
  padding: 40px 36px 28px 36px;
  background: var(--app-background);
  border: 1px solid var(--app-border);
  border-radius: var(--border-radius-xl);
  box-shadow: 0 24px 64px -32px rgb(0 0 0 / 0.5);
}

.logo {
  width: 72px;
  height: 72px;
}

.title {
  color: var(--c-text-dark);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-xl);
}

.form {
  width: 100%;
}

.toggleMode {
  align-self: center;
}
</style>

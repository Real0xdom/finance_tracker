<template>
  <Dialog
    :native="false"
    :closeOnBackgroundClick="false"
    :open="open"
    :lock="lockDialog"
    :title="mode === 'signIn' ? t('navigation.auth.welcomeBack') : t('navigation.auth.signUp')"
    @close="emit('close')"
  >
    <Form
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

      <Button
        :class="$style.toggleMode"
        textual
        color="dimmed"
        type="button"
        :text="mode === 'signIn' ? t('navigation.auth.noAccount') : t('navigation.auth.haveAccount')"
        @click="toggleMode"
      />
    </Form>
  </Dialog>
</template>

<script lang="ts" setup>
import Alert from '@components/base/alert/Alert.vue';
import Button from '@components/base/button/Button.vue';
import Dialog from '@components/base/dialog/Dialog.vue';
import Form from '@components/base/form/Form.vue';
import TextField from '@components/base/text-field/TextField.vue';
import { useStorage } from '@store/storage/useStorage.ts';
import { RiLoginCircleLine, RiUserAddLine } from '@remixicon/vue';
import { useAsyncState, useTimestamp } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const { OCULAR_TEST_USERNAME, OCULAR_TEST_PASSWORD } = import.meta.env;

const emit = defineEmits<{
  close: [];
}>();

defineProps<{
  open: boolean;
  lockDialog?: boolean;
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
  } else if (res.data.confirmed) {
    // account is active and logged in right away
    username.value = '';
    password.value = '';
    emit('close');
  } else {
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

watch(state, (response) => {
  if (response?.data) {
    username.value = '';
    password.value = '';
    emit('close');
  }
});
</script>

<style lang="scss" module>
.toggleMode {
  align-self: center;
}
</style>

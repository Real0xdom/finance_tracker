<template>
  <Button
    :class="classes"
    testId="navigation-cloud"
    :data="{ status: status }"
    textual
    size="l"
    :disabled="!OCULAR_GENESIS_HOST"
    :color="icon[0]"
    :tooltip="OCULAR_GENESIS_HOST ? undefined : t('navigation.auth.loginNotAvailable')"
    tooltipPosition="right"
    :icon="icon[1]"
    @click="auth"
  />
</template>

<script lang="ts" setup>
import Button from '@components/base/button/Button.vue';
import { useStorage } from '@store/storage/useStorage.ts';
import { RiCloudLine, RiCloudOffLine, RiRefreshLine, RiSignalWifiErrorLine } from '@remixicon/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import type { Color } from '@composables/theme-styles/useThemeStyles.ts';
import type { ClassNames } from '@utils/types.ts';
import type { Component } from 'vue';

const { OCULAR_GENESIS_HOST } = import.meta.env;

const emit = defineEmits<{
  login: [];
}>();

const props = defineProps<{
  class?: ClassNames;
}>();

const { status, logout } = useStorage();
const { t } = useI18n();
const router = useRouter();

const classes = computed(() => props.class);

const icon = computed((): [Color, Component] => {
  if (!OCULAR_GENESIS_HOST) {
    return ['dimmed', RiCloudOffLine];
  }

  switch (status.value) {
    case 'idle':
      return ['danger', RiCloudOffLine];
    case 'syncing':
      return ['primary', RiRefreshLine];
    case 'retrying':
      return ['danger', RiRefreshLine];
    case 'error':
      return ['danger', RiSignalWifiErrorLine];
    case 'authenticated':
      return ['success', RiCloudLine];
  }

  return ['danger', RiCloudOffLine];
});

const auth = async () => {
  if (!OCULAR_GENESIS_HOST) return;

  if (status.value === 'idle') {
    emit('login');
  } else {
    logout();
    await router.push('/');
  }
};
</script>

<template>
  <ContextMenuButton
    v-if="needRefresh"
    :icon="RiLoopRightLine"
    :text="t('navigation.update.updateApp')"
    @click="update"
  />
</template>

<script lang="ts" setup>
import ContextMenuButton from '@components/base/context-menu/ContextMenuButton.vue';
import { RiLoopRightLine } from '@remixicon/vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { needRefresh, updateServiceWorker } = useRegisterSW();

const updating = ref(false);

const update = () => {
  if (updating.value) return;
  updating.value = true;
  updateServiceWorker(true);
};
</script>

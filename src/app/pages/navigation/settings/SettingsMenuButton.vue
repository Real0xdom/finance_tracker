<template>
  <ContextMenuButton :icon="RiSettings4Line" :text="t('navigation.settings.settings')" @click="showDialog = true" />
  <SettingsDialog :open="showDialog" @close="showDialog = false" />
</template>

<script lang="ts" setup>
import SettingsDialog from './SettingsDialog.vue';
import ContextMenuButton from '@components/base/context-menu/ContextMenuButton.vue';
import { RiSettings4Line } from '@remixicon/vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const showDialog = ref(false);
</script>

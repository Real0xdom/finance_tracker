<template>
  <ContextMenuButton
    :icon="state.appearance.theme === 'light' ? RiMoonFill : RiSunFill"
    :text="t('navigation.theme.change')"
    @click="setAppearance('theme', state.appearance.theme === 'light' ? 'dark' : 'light')"
  />
</template>

<script lang="ts" setup>
import ContextMenuButton from '@components/base/context-menu/ContextMenuButton.vue';
import { useSettingsStore } from '@store/settings';
import { RiMoonFill, RiSunFill } from '@remixicon/vue';
import { useI18n } from 'vue-i18n';

const { state, setAppearance } = useSettingsStore();
const { t } = useI18n();
</script>

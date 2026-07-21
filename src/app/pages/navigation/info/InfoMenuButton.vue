<template>
  <ContextMenuButton :icon="RiInformationLine" :text="t('navigation.info.about')" @click="showDialog = true" />
  <InfoDialog :open="showDialog" @close="showDialog = false" />
</template>

<script lang="ts" setup>
import InfoDialog from './InfoDialog.vue';
import ContextMenuButton from '@components/base/context-menu/ContextMenuButton.vue';
import { RiInformationLine } from '@remixicon/vue';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const showDialog = ref(false);
</script>

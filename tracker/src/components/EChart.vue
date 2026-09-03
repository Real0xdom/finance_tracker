<script setup lang="ts">
import { BarChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import type { EChartsOption } from 'echarts';

// Only the pieces this app draws, so the mobile bundle stays small.
echarts.use([PieChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

const props = defineProps<{
  option: EChartsOption;
  height?: string;
}>();

const emit = defineEmits<{ pick: [name: string] }>();

const el = shallowRef<HTMLDivElement>();
let chart: echarts.ECharts | undefined;
let observer: ResizeObserver | undefined;

onMounted(() => {
  if (!el.value) return;

  chart = echarts.init(el.value, undefined, { renderer: 'canvas' });
  chart.setOption(props.option);
  chart.on('click', (e) => emit('pick', String(e.name)));

  observer = new ResizeObserver(() => chart?.resize());
  observer.observe(el.value);
});

watch(
  () => props.option,
  (option) => chart?.setOption(option, { notMerge: true }),
  { deep: true }
);

onBeforeUnmount(() => {
  observer?.disconnect();
  chart?.dispose();
});
</script>

<template>
  <div ref="el" class="chart" :style="{ height: height ?? '220px' }"></div>
</template>

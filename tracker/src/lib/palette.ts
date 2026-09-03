import { computed } from 'vue';
import { effectiveTheme } from './theme';

/**
 * Categorical slots, one instance per theme, assigned in fixed order and never
 * cycled. Both are the six-check-validated instance for that theme's chart
 * surface: dark against #171a21 (lightness band, chroma floor, adjacent CVD
 * ΔE 8.4, normal-vision ΔE 19.3, >=3:1 contrast all pass); light against
 * #ffffff (same checks pass; three slots sit below 3:1 contrast on white,
 * so the relief rule applies -- every chart here already ships a labelled
 * breakdown list beside it, satisfying it in both themes).
 */
const DARK = {
  series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'],
  other: '#5b6274',
  surface: '#171a21',
  text: '#eef1f6',
  muted: '#8b93a7',
  grid: '#2a3040'
};

const LIGHT = {
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'],
  other: '#9aa1b0',
  surface: '#ffffff',
  text: '#12141a',
  muted: '#6b7280',
  grid: '#e1e4ea'
};

/** Chart palette for the theme currently in effect. */
export const chartPalette = computed(() => (effectiveTheme.value === 'dark' ? DARK : LIGHT));

/** Colour for slot `i` in the active theme, folding into the neutral past the fixed slots. */
export const seriesColor = (i: number) => chartPalette.value.series[i] ?? chartPalette.value.other;

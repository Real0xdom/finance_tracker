/**
 * Categorical slots for the dark chart surface (#171a21), assigned in fixed
 * order and never cycled. Validated with the data-viz six checks against that
 * surface: lightness band, chroma floor, adjacent CVD ΔE 8.4, normal-vision
 * ΔE 19.3, and >= 3:1 contrast all pass.
 *
 * Colour still never carries identity alone: every chart ships a labelled
 * breakdown list beside it and 2px surface gaps between segments.
 */
export const SERIES: readonly string[] = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#9085e9'];

/** Anything past the sixth category folds into this neutral, never a new hue. */
export const OTHER = '#5b6274';

export const SURFACE = '#171a21';
export const TEXT = '#eef1f6';
export const MUTED = '#8b93a7';
export const GRID = '#2a3040';

/** Colour for slot `i`, folding into the neutral past the fixed slots. */
export const seriesColor = (i: number) => SERIES[i] ?? OTHER;

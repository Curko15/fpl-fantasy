import { useIsDark } from './theme'

// SVG presentation attributes can't reliably read CSS variables, so charts get
// hex values here. Keep in step with the tokens in index.css.

const LIGHT = {
  grid: '#ecebe6',
  axis: '#5f6068',
  faint: '#d9d7d0',
  dot: '#a9a7a0',
  track: '#e6e4de',
  card: '#ffffff',
  ink: '#111114',
  accent: '#4b1d8f',
  // Validated categorical subset (dataviz palette), ordered so neighbours stay apart.
  rivals: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
}

const DARK: typeof LIGHT = {
  grid: '#24272d',
  axis: '#9ba1aa',
  faint: '#3a3e45',
  dot: '#6b717b',
  track: '#2a2e35',
  card: '#15171b',
  ink: '#f2f3f5',
  accent: '#3dffa2',
  rivals: ['#3987e5', '#d95926', '#9085e9', '#c98500', '#d55181'],
}

export type ChartColors = typeof LIGHT

export function useChartColors(): ChartColors {
  return useIsDark() ? DARK : LIGHT
}

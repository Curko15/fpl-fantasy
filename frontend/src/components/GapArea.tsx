import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { useChartColors } from '../chartColors'
import type { H2HWeek } from '../headToHead'

/** Round ticks that always include 0, with a little headroom past the data. */
function gapAxis(gaps: number[]): { ticks: number[]; domain: [number, number] } {
  const max = Math.max(0, ...gaps)
  const min = Math.min(0, ...gaps)
  const range = Math.max(10, max - min)
  const raw = range / 4
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((f) => f * magnitude).find((s) => s >= raw) ?? raw
  const lo = min < 0 ? Math.floor((min - step * 0.15) / step) * step : 0
  const hi = max > 0 ? Math.ceil((max + step * 0.15) / step) * step : 0
  const domain: [number, number] = lo === hi ? [-step, step] : [lo, hi]
  const ticks: number[] = []
  for (let t = domain[0]; t <= domain[1]; t += step) ticks.push(t)
  return { ticks, domain }
}

/**
 * The Recharts part of the head-to-head points-gap chart, in its own module so
 * it can be lazy-loaded (see ChartSlot). A's colour above zero, B's below.
 */
export default function GapArea({
  weeks,
  colorA,
  colorB,
  gradientId,
  tooltip,
}: {
  weeks: H2HWeek[]
  colorA: string
  colorB: string
  gradientId: string
  tooltip: (props: TooltipContentProps<ValueType, NameType>) => ReactNode
}) {
  const colors = useChartColors()
  const gaps = weeks.map((w) => w.gap)
  const { ticks, domain } = gapAxis(gaps)
  // Gradients run over each shape's own bounding box: the area spans the data and
  // the zero baseline, the line only the data. Split both at zero: A above, B below.
  const dataMax = Math.max(...gaps)
  const dataMin = Math.min(...gaps)
  const areaTop = Math.max(0, dataMax)
  const areaBottom = Math.min(0, dataMin)
  const split = areaTop === areaBottom ? 0.5 : areaTop / (areaTop - areaBottom)
  const lineSplit = dataMax === dataMin ? 0.5 : Math.min(1, Math.max(0, dataMax / (dataMax - dataMin)))
  // A flat line has a zero-height box, which would hide a gradient stroke.
  const flatColor = dataMax > 0 ? colorA : dataMax < 0 ? colorB : colors.ink

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={weeks} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset={0} stopColor={colorA} stopOpacity={0.28} />
            <stop offset={split} stopColor={colorA} stopOpacity={0.06} />
            <stop offset={split} stopColor={colorB} stopOpacity={0.06} />
            <stop offset={1} stopColor={colorB} stopOpacity={0.28} />
          </linearGradient>
          <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="0" y2="1">
            <stop offset={lineSplit} stopColor={colorA} />
            <stop offset={lineSplit} stopColor={colorB} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="event"
          tick={{ fontSize: 11, fill: colors.axis }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
          tickFormatter={(e) => `GW${e}`}
        />
        <YAxis
          domain={domain}
          ticks={ticks}
          allowDecimals={false}
          tick={{ fontSize: 11, fill: colors.axis }}
          tickFormatter={(v: number) => (v > 0 ? `+${v}` : String(v))}
          tickLine={false}
          axisLine={false}
          width={38}
        />
        <ReferenceLine y={0} stroke={colors.axis} strokeWidth={1} />
        <Tooltip content={tooltip} cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }} />
        <Area
          dataKey="gap"
          type="monotone"
          stroke={dataMax === dataMin ? flatColor : `url(#${gradientId}-line)`}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          baseValue={0}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: colors.card, fill: colors.ink }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

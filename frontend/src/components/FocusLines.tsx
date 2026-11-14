import type { ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { useChartColors } from '../chartColors'
import type { FocusMode } from '../seasonCharts'

/** Evenly spaced rank ticks that always include first and last place. */
function positionTicks(count: number): number[] {
  const step = Math.max(1, Math.ceil((count - 1) / 5))
  const ticks: number[] = []
  for (let t = 1; t < count; t += step) ticks.push(t)
  return [...ticks, count]
}

/**
 * The Recharts part of FocusChart, in its own module so it can be lazy-loaded
 * (see ChartSlot). Fills its parent's size.
 */
export default function FocusLines({
  rows,
  mode,
  managerCount,
  behindTop,
  faint,
  strong,
  color,
  me,
  tooltip,
}: {
  rows: Record<string, number>[]
  mode: FocusMode
  managerCount: number
  behindTop: number
  /** Everyone not highlighted: thin grey lines. */
  faint: number[]
  /** Highlighted entry ids in drawing order (the last sits on top). */
  strong: number[]
  color: Map<number, string>
  me: number
  tooltip: (props: TooltipContentProps<ValueType, NameType>) => ReactNode
}) {
  const colors = useChartColors()
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="event"
          tick={{ fontSize: 11, fill: colors.axis }}
          tickLine={false}
          axisLine={{ stroke: colors.grid }}
          interval="preserveStartEnd"
          minTickGap={16}
          tickFormatter={(e) => `GW${e}`}
        />
        <YAxis
          reversed
          domain={mode === 'position' ? [1, managerCount] : [0, behindTop]}
          allowDataOverflow
          allowDecimals={false}
          ticks={mode === 'position' ? positionTicks(managerCount) : undefined}
          tick={{ fontSize: 11, fill: colors.axis }}
          tickLine={false}
          axisLine={false}
          width={mode === 'position' ? 28 : 38}
        />
        <Tooltip content={tooltip} cursor={{ stroke: colors.axis, strokeDasharray: '3 3' }} />
        {faint.map((id) => (
          <Line
            key={id}
            dataKey={String(id)}
            stroke={colors.faint}
            strokeWidth={1}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        ))}
        {strong.map((id) => (
          <Line
            key={id}
            dataKey={String(id)}
            type="monotone"
            stroke={color.get(id)}
            strokeWidth={id === me ? 3.5 : 2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: colors.card }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

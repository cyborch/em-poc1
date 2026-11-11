import { Area, Line, ReferenceArea, ReferenceDot, ReferenceLine } from 'recharts'
import type { Basis } from '../analysis/series'

export const COLORS = {
  ink: '#12201b',
  muted: '#6b7a74',
  faint: '#98a49f',
  grid: '#e8ece9',
  line: '#cdd5d1',
  brand: '#1d6b4f',
  spike: '#d4531c',
  negative: '#2a7aa8',
  low: '#8fb8cf',
  neutralBar: '#aebfb8',
  solar: '#dea000',
  wind: '#1b9a86',
  demand: '#2b3a36',
  netLoad: '#1d6b4f',
  flow: '#5b6fa8',
  reference: '#7b8a84',
} as const

export const AXIS_PROPS = {
  tick: { fill: COLORS.muted, fontSize: 11 },
  axisLine: { stroke: COLORS.line },
  tickLine: false as const,
}

export interface ChartInteraction {
  selectedIndex: number
  hoverIndex: number | null
  onSelect: (index: number) => void
  onHover: (index: number | null) => void
}

interface ChartState {
  activeTooltipIndex?: unknown
}

/** Maps Recharts' category index back to the dataset index, for click and hover. */
export function chartHandlers(rows: { index: number }[], it: ChartInteraction) {
  const resolve = (s: ChartState): number | null => {
    const raw = s.activeTooltipIndex
    if (raw === undefined || raw === null) return null
    const i = Number(raw)
    return Number.isFinite(i) && rows[i] ? (rows[i] as { index: number }).index : null
  }
  return {
    onClick: (s: ChartState) => {
      const idx = resolve(s)
      if (idx !== null) it.onSelect(idx)
    },
    onMouseMove: (s: ChartState) => it.onHover(resolve(s)),
    onMouseLeave: () => it.onHover(null),
  }
}

interface MarksProps {
  rows: { index: number; label: string }[]
  selectedIndex: number
  hoverIndex: number | null
}

/** Shared crosshair: a solid line at the selected hour, a faint one at the hovered hour. */
export function SelectionMarks({ rows, selectedIndex, hoverIndex }: MarksProps) {
  const sel = rows.find((r) => r.index === selectedIndex)
  const hov =
    hoverIndex !== null && hoverIndex !== selectedIndex ? rows.find((r) => r.index === hoverIndex) : undefined
  return (
    <>
      {hov && (
        <ReferenceLine x={hov.label} stroke={COLORS.faint} strokeDasharray="2 3" ifOverflow="visible" />
      )}
      {sel && <ReferenceLine x={sel.label} stroke={COLORS.ink} strokeWidth={1.5} ifOverflow="visible" />}
    </>
  )
}

interface ForecastShadeProps {
  rows: { label: string; observed: boolean }[]
}

/** Shades hours with no actuals yet, so forecasts are never mistaken for observations. */
export function ForecastShade({ rows }: ForecastShadeProps) {
  const first = rows.find((r) => !r.observed)
  const last = rows[rows.length - 1]
  if (!first || !last || first.label === rows[0]?.label) return null
  return (
    <ReferenceArea
      x1={first.label}
      x2={last.label}
      fill="#12201b"
      fillOpacity={0.045}
      stroke="none"
      ifOverflow="visible"
      label={{ value: 'Forecast only', position: 'insideTopRight', fill: COLORS.muted, fontSize: 10 }}
    />
  )
}

export function allForecast(rows: { observed: boolean }[]): boolean {
  return rows.length > 0 && rows.every((r) => !r.observed)
}

interface OverlayProps {
  basis: Basis
  rows: { index: number; label: string }[]
  selectedIndex: number
  typicalKey: string
  bandKey: string
  previousDayKey: string
  previousHourKey: string
  color?: string
}

/** Draws the reference series that matches the chosen comparison basis. */
export function BasisOverlay({
  basis,
  rows,
  selectedIndex,
  typicalKey,
  bandKey,
  previousDayKey,
  previousHourKey,
  color = COLORS.reference,
}: OverlayProps) {
  if (basis === 'typical') {
    return (
      <>
        <Area
          dataKey={bandKey}
          stroke="none"
          fill={color}
          fillOpacity={0.12}
          isAnimationActive={false}
          activeDot={false}
          legendType="none"
        />
        <Line
          dataKey={typicalKey}
          stroke={color}
          strokeWidth={1.25}
          strokeDasharray="2 3"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </>
    )
  }
  if (basis === 'previousDay') {
    return (
      <Line
        dataKey={previousDayKey}
        stroke={color}
        strokeWidth={1.25}
        strokeDasharray="2 3"
        dot={false}
        activeDot={false}
        isAnimationActive={false}
      />
    )
  }
  const prev = rows.find((r) => r.index === selectedIndex - 1)
  const sel = rows.find((r) => r.index === selectedIndex) as
    ({ index: number; label: string } & Record<string, unknown>) | undefined
  const y = sel ? Number(sel[previousHourKey]) : NaN
  if (!prev || !Number.isFinite(y)) return null
  return (
    <ReferenceDot
      x={prev.label}
      y={y}
      r={4}
      fill="#fff"
      stroke={color}
      strokeWidth={1.5}
      ifOverflow="visible"
    />
  )
}

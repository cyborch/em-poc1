import { useMemo, type ReactNode } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MarketDataset, SignalKey } from '../data/types'
import { compareSignal } from '../analysis/investigation'
import { BASIS_SHORT, type Basis, type SignalRow, axisTicks, gwTick, signalRows } from '../analysis/series'
import { SIGNALS, type Level, formatDelta, formatPower, formatValue } from '../analysis/stats'
import {
  AXIS_PROPS,
  BasisOverlay,
  COLORS,
  type ChartInteraction,
  ForecastShade,
  SelectionMarks,
  allForecast,
  chartHandlers,
} from './chartKit'

export interface SeriesSpec {
  key: SignalKey
  color: string
  name: string
  showRange?: boolean
}

type MergedRow = SignalRow & Record<string, number | string | boolean | null | number[]>

function mergeRows(dataset: MarketDataset, date: string, specs: SeriesSpec[]): MergedRow[] {
  const per = specs.map((s) => ({ s, rows: signalRows(dataset, date, s.key) }))
  const base = per[0]?.rows ?? []
  return base.map((r, i) => {
    const out: Record<string, unknown> = {
      index: r.index,
      hour: r.hour,
      label: r.label,
      observed: r.observed,
    }
    for (const { s, rows } of per) {
      const x = rows[i] as SignalRow
      out[`${s.key}_f`] = x.forecast
      out[`${s.key}_a`] = x.actual
      out[`${s.key}_r`] = x.range
      out[`${s.key}_t`] = x.typical
      out[`${s.key}_tb`] = x.typicalBand
      out[`${s.key}_pd`] = x.previousDay
      out[`${s.key}_ph`] = x.previousHour
    }
    return out as MergedRow
  })
}

interface CardProps extends ChartInteraction {
  dataset: MarketDataset
  signals: SignalKey[]
  title: string
  basis: Basis
  focused: boolean
  onFocus: () => void
  children: ReactNode
  testId: string
}

const LEVEL_STYLE: Record<Level, string> = {
  typical: 'text-muted bg-canvas',
  moderate: 'text-spike bg-spike-soft/60',
  strong: 'text-spike bg-spike-soft font-semibold',
}

export function ChartCard(props: CardProps) {
  const { dataset, signals, title, basis, focused, onFocus, children, selectedIndex, testId } = props
  const hour = (dataset.points[selectedIndex]?.hour ?? 0).toString().padStart(2, '0')
  return (
    <div
      data-testid={testId}
      data-selected-hour={selectedIndex}
      data-focused={focused}
      className={`bg-panel rounded-lg border p-3 transition-shadow ${
        focused ? 'border-brand ring-brand/25 ring-2' : 'border-line'
      }`}
    >
      <button type="button" onClick={onFocus} className="block w-full text-left" aria-pressed={focused}>
        <div className="text-ink text-[13px] font-semibold">{title}</div>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
          {signals.map((k) => (
            <Reading key={k} dataset={dataset} signal={k} index={selectedIndex} basis={basis} hour={hour} />
          ))}
        </div>
      </button>
      {children}
    </div>
  )
}

function Reading({
  dataset,
  signal,
  index,
  basis,
  hour,
}: {
  dataset: MarketDataset
  signal: SignalKey
  index: number
  basis: Basis
  hour: string
}) {
  const c = compareSignal(dataset, index, signal)
  const ref = basis === 'typical' ? c.typicalMean : basis === 'previousDay' ? c.previousDay : c.previousHour
  const unusual = basis === 'typical' ? c.level : 'typical'
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted text-xs">{SIGNALS[signal].label}</span>
      <span className="text-ink text-sm font-semibold" data-testid={`reading-${signal}`}>
        {formatValue(signal, c.value)}
      </span>
      <span className="text-muted text-[11px]">
        {hour}:00 · {c.isActual ? 'observed' : 'forecast'}
      </span>
      {ref !== null && (
        <span className={`rounded px-1.5 py-px text-[11px] ${LEVEL_STYLE[unusual]}`}>
          {formatDelta(signal, c.value, ref)} vs {BASIS_SHORT[basis]}
        </span>
      )}
    </div>
  )
}

interface ChartProps extends ChartInteraction {
  dataset: MarketDataset
  date: string
  specs: SeriesSpec[]
  basis: Basis
  height?: number
}

export function SignalChart(props: ChartProps) {
  const { dataset, date, specs, basis, selectedIndex, height = 190 } = props
  const rows = useMemo(() => mergeRows(dataset, date, specs), [dataset, date, specs])
  const handlers = chartHandlers(rows, props)
  const ticks = axisTicks(rows)
  const selected = rows.find((r) => r.index === selectedIndex)
  const anyRange = specs.some((s) => s.showRange)

  return (
    <>
      <div style={{ height }} className="mt-2">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 440, height }}>
          <ComposedChart data={rows} margin={{ top: 10, right: 6, bottom: 0, left: 0 }} {...handlers}>
            <CartesianGrid vertical={false} stroke={COLORS.grid} />
            <XAxis dataKey="label" ticks={ticks} {...AXIS_PROPS} />
            <YAxis
              width={32}
              {...AXIS_PROPS}
              tickFormatter={gwTick}
              domain={[(min: number) => Math.min(0, Math.floor(min)), 'auto']}
            />
            <Tooltip cursor={false} content={<SignalTooltip specs={specs} />} isAnimationActive={false} />
            <ForecastShade rows={rows} />
            {specs.map((s) =>
              s.showRange ? (
                <Area
                  key={`${s.key}-range`}
                  dataKey={`${s.key}_r`}
                  stroke="none"
                  fill={s.color}
                  fillOpacity={0.14}
                  isAnimationActive={false}
                  activeDot={false}
                  connectNulls
                />
              ) : null,
            )}
            {specs.map((s) => (
              <BasisOverlay
                key={`${s.key}-ref`}
                basis={basis}
                rows={rows}
                selectedIndex={selectedIndex}
                typicalKey={`${s.key}_t`}
                bandKey={`${s.key}_tb`}
                previousDayKey={`${s.key}_pd`}
                previousHourKey={`${s.key}_ph`}
              />
            ))}
            {specs.map((s) => (
              <Line
                key={`${s.key}-f`}
                dataKey={`${s.key}_f`}
                stroke={s.color}
                strokeWidth={1.75}
                strokeDasharray="5 3"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            {specs.map((s) => (
              <Line
                key={`${s.key}-a`}
                dataKey={`${s.key}_a`}
                stroke={s.color}
                strokeWidth={2.75}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            <SelectionMarks rows={rows} selectedIndex={selectedIndex} hoverIndex={props.hoverIndex} />
            {selected &&
              specs.map((s) => {
                const v = (selected[`${s.key}_a`] ?? selected[`${s.key}_f`]) as number
                return (
                  <ReferenceDot
                    key={`${s.key}-dot`}
                    x={selected.label}
                    y={v}
                    r={4.5}
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                    ifOverflow="visible"
                  />
                )
              })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ChartLegend showRange={anyRange} forecastOnly={allForecast(rows)} basis={basis} />
    </>
  )
}

export function ChartLegend({
  showRange,
  forecastOnly,
  basis,
}: {
  showRange: boolean
  forecastOnly: boolean
  basis: Basis
}) {
  return (
    <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
      <span className="inline-flex items-center gap-1">
        <svg width="18" height="6" aria-hidden>
          <line x1="0" y1="3" x2="18" y2="3" stroke={COLORS.muted} strokeWidth="2.5" />
        </svg>
        Observed
      </span>
      <span className="inline-flex items-center gap-1">
        <svg width="18" height="6" aria-hidden>
          <line x1="0" y1="3" x2="18" y2="3" stroke={COLORS.muted} strokeWidth="1.75" strokeDasharray="4 2" />
        </svg>
        Forecast
      </span>
      {showRange && <span>▒ P10–P90</span>}
      <span className="inline-flex items-center gap-1">
        <svg width="18" height="6" aria-hidden>
          <line
            x1="0"
            y1="3"
            x2="18"
            y2="3"
            stroke={COLORS.reference}
            strokeWidth="1.25"
            strokeDasharray="2 3"
          />
        </svg>
        {basis === 'typical'
          ? 'Typical ±1σ'
          : basis === 'previousDay'
            ? 'Same hour yesterday'
            : '○ Previous hour'}
      </span>
      {forecastOnly && (
        <span className="text-ink-soft font-medium">All values are forecasts: no actuals yet</span>
      )}
    </div>
  )
}

interface TipProps {
  active?: boolean
  payload?: { payload: MergedRow }[]
  specs: SeriesSpec[]
}

function SignalTooltip({ active, payload, specs }: TipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="border-line-strong rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <div className="text-ink font-semibold">{row.label}</div>
      {specs.map((s) => {
        const f = row[`${s.key}_f`] as number
        const a = row[`${s.key}_a`] as number | null
        return (
          <div key={s.key} className="text-muted">
            <span style={{ color: s.color }}>●</span> {s.name}: forecast {formatPower(f * 1000)}
            {a !== null && <>, observed {formatPower(a * 1000)}</>}
          </div>
        )
      })}
    </div>
  )
}

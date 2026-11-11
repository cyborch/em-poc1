import { useMemo } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MarketDataset } from '../data/types'
import {
  type Basis,
  type DeviationRow,
  type FlowRow,
  axisTicks,
  deviationRows,
  flowRows,
  gwTick,
} from '../analysis/series'
import { formatHour, formatPct, formatPower, pctChange } from '../analysis/stats'
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

interface FlowProps extends ChartInteraction {
  dataset: MarketDataset
  date: string
  basis: Basis
}

export function FlowChart(props: FlowProps) {
  const { dataset, date, basis, selectedIndex } = props
  const rows = useMemo(() => flowRows(dataset, date), [dataset, date])
  const handlers = chartHandlers(rows, props)
  const ticks = axisTicks(rows)
  const sel = rows.find((r) => r.index === selectedIndex)
  const importing = (sel?.net ?? 0) >= 0
  const p = dataset.points[selectedIndex]
  const avail = p ? (importing ? p.capacity.importAvailable : p.capacity.exportAvailable) : 0
  const typ = p ? (importing ? p.capacity.importTypical : p.capacity.exportTypical) : 0

  return (
    <>
      <div className="mt-2 h-[190px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 440, height: 190 }}>
          <ComposedChart data={rows} margin={{ top: 10, right: 6, bottom: 0, left: 0 }} {...handlers}>
            <CartesianGrid vertical={false} stroke={COLORS.grid} />
            <XAxis dataKey="label" ticks={ticks} {...AXIS_PROPS} />
            <YAxis width={32} {...AXIS_PROPS} tickFormatter={gwTick} />
            <ReferenceLine y={0} stroke={COLORS.line} />
            <Tooltip cursor={false} content={<FlowTooltip />} isAnimationActive={false} />
            <ForecastShade rows={rows} />
            <Line
              dataKey="importTypical"
              type="stepAfter"
              stroke={COLORS.faint}
              strokeWidth={1}
              strokeDasharray="1 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="exportTypical"
              type="stepAfter"
              stroke={COLORS.faint}
              strokeWidth={1}
              strokeDasharray="1 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Bar dataKey="net" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {rows.map((r) => (
                <Cell
                  key={r.index}
                  fill={r.utilisation >= 0.9 ? COLORS.spike : COLORS.flow}
                  fillOpacity={r.observed ? 0.95 : 0.55}
                  stroke={r.index === selectedIndex ? COLORS.ink : 'none'}
                  strokeWidth={r.index === selectedIndex ? 2 : 0}
                />
              ))}
            </Bar>
            <Line
              dataKey="importAvailable"
              type="stepAfter"
              stroke={COLORS.ink}
              strokeWidth={1.25}
              strokeDasharray="5 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="exportAvailable"
              type="stepAfter"
              stroke={COLORS.ink}
              strokeWidth={1.25}
              strokeDasharray="5 3"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <BasisOverlay
              basis={basis}
              rows={rows}
              selectedIndex={selectedIndex}
              typicalKey="typicalNet"
              bandKey="typicalBand"
              previousDayKey="previousDay"
              previousHourKey="previousHour"
            />
            <SelectionMarks rows={rows} selectedIndex={selectedIndex} hoverIndex={props.hoverIndex} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: COLORS.flow }} /> Net
          flow (above 0 = import)
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: COLORS.spike }} />{' '}
          ≥90% of capacity
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" y1="3" x2="18" y2="3" stroke={COLORS.ink} strokeWidth="1.25" strokeDasharray="5 3" />
          </svg>
          Available capacity
        </span>
        <span className="inline-flex items-center gap-1">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" y1="3" x2="18" y2="3" stroke={COLORS.faint} strokeWidth="1" strokeDasharray="1 3" />
          </svg>
          Typical capacity
        </span>
      </div>
      {sel && (
        <p className="text-ink-soft mt-1 text-xs" data-testid="flow-capacity-note">
          {importing ? 'Importing' : 'Exporting'} {formatPower(Math.abs(sel.net * 1000))} ={' '}
          {Math.round(sel.utilisation * 100)}% of {formatPower(avail)} available{' '}
          {importing ? 'import' : 'export'} capacity (typical {formatPower(typ)}).
        </p>
      )}
    </>
  )
}

function FlowTooltip({ active, payload }: { active?: boolean; payload?: { payload: FlowRow }[] }) {
  const r = payload?.[0]?.payload
  if (!active || !r) return null
  return (
    <div className="border-line-strong rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <div className="text-ink font-semibold">{r.label}</div>
      <div className="text-muted">
        Net {r.net >= 0 ? 'imports' : 'exports'} {formatPower(Math.abs(r.net) * 1000)} (
        {Math.round(r.utilisation * 100)}% of capacity)
      </div>
      <div className="text-muted">
        Available: +{formatPower(r.importAvailable * 1000)} / −
        {formatPower(Math.abs(r.exportAvailable) * 1000)}
      </div>
    </div>
  )
}

export type DeviationKey = 'wind' | 'solar' | 'demand'

interface DevProps extends ChartInteraction {
  dataset: MarketDataset
  date: string
  signal: DeviationKey
}

const DEV_COLOR: Record<DeviationKey, string> = {
  wind: COLORS.wind,
  solar: COLORS.solar,
  demand: COLORS.demand,
}

export function DeviationChart(props: DevProps) {
  const { dataset, date, signal, selectedIndex } = props
  const rows = useMemo(() => deviationRows(dataset, date, signal), [dataset, date, signal])
  const handlers = chartHandlers(rows, props)
  const ticks = axisTicks(rows)
  const color = DEV_COLOR[signal]
  const forecastOnly = allForecast(rows)

  return (
    <>
      <div className="relative mt-2 h-[150px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 150 }}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} {...handlers}>
            <CartesianGrid vertical={false} stroke={COLORS.grid} />
            <XAxis dataKey="label" ticks={ticks} {...AXIS_PROPS} />
            <YAxis width={36} {...AXIS_PROPS} tickFormatter={gwTick} />
            <ReferenceLine y={0} stroke={COLORS.muted} />
            <Tooltip cursor={false} content={<DevTooltip />} isAnimationActive={false} />
            <ForecastShade rows={rows} />
            <Area
              dataKey="band"
              stroke="none"
              fill={color}
              fillOpacity={0.16}
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              dataKey="deviation"
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: color, stroke: color }}
              activeDot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            <SelectionMarks rows={rows} selectedIndex={selectedIndex} hoverIndex={props.hoverIndex} />
          </ComposedChart>
        </ResponsiveContainer>
        {forecastOnly && (
          <div className="bg-panel/90 text-ink-soft pointer-events-none absolute top-2 left-12 rounded px-2 py-1 text-xs">
            No actuals yet for this day. The band shows how far the forecast could plausibly be off (P10–P90).
          </div>
        )}
      </div>
      <ChartLegendDeviation />
    </>
  )
}

function ChartLegendDeviation() {
  return (
    <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 text-[11px]">
      <span>
        Line: observed − forecast (GW). Dots outside the band are surprises the day-ahead price did not know
        about.
      </span>
      <span>▒ Forecast P10–P90 around zero</span>
    </div>
  )
}

function DevTooltip({ active, payload }: { active?: boolean; payload?: { payload: DeviationRow }[] }) {
  const r = payload?.[0]?.payload
  if (!active || !r) return null
  return (
    <div className="border-line-strong rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <div className="text-ink font-semibold">{formatHour(r.hour)}</div>
      {r.deviation === null ? (
        <div className="text-muted">
          No actual yet · P10–P90 {formatPower(r.band[0] * 1000)} to +{formatPower(r.band[1] * 1000)}
        </div>
      ) : (
        <div className="text-muted">Observed − forecast: {formatPower(r.deviation * 1000)}</div>
      )}
    </div>
  )
}

export function deviationSummary(dataset: MarketDataset, index: number, signal: DeviationKey): string {
  const p = dataset.points[index]
  if (!p) return ''
  const q = p[signal]
  if (q.actual === null || !q.range) {
    return q.range
      ? `Actual not yet available. Forecast ${formatPower(q.forecast)}, P10–P90 ${formatPower(q.range[0])}–${formatPower(q.range[1])}.`
      : 'Actual not yet available.'
  }
  const dev = q.actual - q.forecast
  const pc = pctChange(q.actual, q.forecast)
  const outside = q.actual < q.range[0] || q.actual > q.range[1]
  return `Observed ${formatPower(q.actual)} vs forecast ${formatPower(q.forecast)} (${dev >= 0 ? '+' : '−'}${formatPower(Math.abs(dev))}${pc === null ? '' : `, ${formatPct(pc)}`}) — ${outside ? 'outside' : 'within'} the P10–P90 range.`
}

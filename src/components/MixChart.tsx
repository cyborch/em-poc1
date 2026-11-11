import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MarketDataset } from '../data/types'
import { axisTicks, gwTick } from '../analysis/series'
import { formatHour, formatPower, pointsForDate, valueOf } from '../analysis/stats'
import {
  AXIS_PROPS,
  COLORS,
  type ChartInteraction,
  ForecastShade,
  SelectionMarks,
  allForecast,
  chartHandlers,
} from './chartKit'

interface Props extends ChartInteraction {
  dataset: MarketDataset
  date: string
}

interface MixRow {
  index: number
  hour: number
  label: string
  observed: boolean
  conventional: number
  wind: number
  solar: number
  imports: number
  exports: number
  demand: number
  generation: number
}

const GW = 1000

function mixRows(dataset: MarketDataset, date: string): MixRow[] {
  return pointsForDate(dataset, date).map((p) => {
    const conventional = valueOf(p.conventional)
    const wind = valueOf(p.wind)
    const solar = valueOf(p.solar)
    const net = valueOf(p.netImports)
    return {
      index: p.index,
      hour: p.hour,
      label: formatHour(p.hour),
      observed: p.observed,
      conventional: conventional / GW,
      wind: wind / GW,
      solar: solar / GW,
      imports: Math.max(0, net) / GW,
      exports: Math.min(0, net) / GW,
      demand: valueOf(p.demand) / GW,
      generation: (conventional + wind + solar) / GW,
    }
  })
}

const LAYERS = [
  { key: 'conventional', name: 'Conventional', color: '#8d9a95' },
  { key: 'wind', name: 'Wind', color: COLORS.wind },
  { key: 'solar', name: 'Solar', color: COLORS.solar },
  { key: 'imports', name: 'Net imports', color: COLORS.flow },
] as const

export function MixChart(props: Props) {
  const { dataset, date, selectedIndex } = props
  const rows = useMemo(() => mixRows(dataset, date), [dataset, date])
  const handlers = chartHandlers(rows, props)
  const ticks = axisTicks(rows)
  const sel = rows.find((r) => r.index === selectedIndex)

  return (
    <>
      {sel && (
        <p className="text-ink-soft mt-1 text-xs" data-testid="mix-note">
          Total generation <b>{formatPower(sel.generation * GW)}</b> (conventional{' '}
          {formatPower(sel.conventional * GW)}, wind {formatPower(sel.wind * GW)}, solar{' '}
          {formatPower(sel.solar * GW)}){' '}
          {sel.exports < 0 ? (
            <>
              − exports <b>{formatPower(-sel.exports * GW)}</b>
            </>
          ) : (
            <>
              + net imports <b>{formatPower(sel.imports * GW)}</b>
            </>
          )}{' '}
          = demand <b>{formatPower(sel.demand * GW)}</b>.
        </p>
      )}
      <div className="mt-2 h-[190px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 190 }}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} {...handlers}>
            <CartesianGrid vertical={false} stroke={COLORS.grid} />
            <XAxis dataKey="label" ticks={ticks} {...AXIS_PROPS} />
            <YAxis width={36} {...AXIS_PROPS} tickFormatter={gwTick} />
            <ReferenceLine y={0} stroke={COLORS.line} />
            <Tooltip cursor={false} content={<MixTooltip />} isAnimationActive={false} />
            <ForecastShade rows={rows} />
            {LAYERS.map((l) => (
              <Area
                key={l.key}
                dataKey={l.key}
                stackId="supply"
                type="monotone"
                stroke="none"
                fill={l.color}
                fillOpacity={0.8}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
            <Area
              dataKey="exports"
              stackId="exports"
              type="monotone"
              stroke="none"
              fill={COLORS.flow}
              fillOpacity={0.4}
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              dataKey="demand"
              stroke={COLORS.ink}
              strokeWidth={2}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <SelectionMarks rows={rows} selectedIndex={selectedIndex} hoverIndex={props.hoverIndex} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="text-muted mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
        {LAYERS.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: l.color }} />
            {l.name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <svg width="18" height="6" aria-hidden>
            <line x1="0" y1="3" x2="18" y2="3" stroke={COLORS.ink} strokeWidth="2" />
          </svg>
          Demand
        </span>
        <span>Values are observed where available, otherwise forecast / day-ahead schedule.</span>
        {allForecast(rows) && (
          <span className="text-ink-soft font-medium">All values are forecasts: no actuals yet</span>
        )}
      </div>
    </>
  )
}

function MixTooltip({ active, payload }: { active?: boolean; payload?: { payload: MixRow }[] }) {
  const r = payload?.[0]?.payload
  if (!active || !r) return null
  return (
    <div className="border-line-strong rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <div className="text-ink font-semibold">{r.label}</div>
      <div className="text-muted">Total generation {formatPower(r.generation * GW)}</div>
      <div className="text-muted">Demand {formatPower(r.demand * GW)}</div>
    </div>
  )
}

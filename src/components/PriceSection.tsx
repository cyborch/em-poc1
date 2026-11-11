import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Info } from 'lucide-react'
import type { MarketDataset } from '../data/types'
import { type PriceFlag, flagLabel, priceClass, priceFlags } from '../analysis/investigation'
import { type Basis, type PriceRow, axisTicks, priceRows } from '../analysis/series'
import { formatDateLong, formatHour, formatPrice, pointsForDate, zScore } from '../analysis/stats'
import {
  AXIS_PROPS,
  BasisOverlay,
  COLORS,
  type ChartInteraction,
  SelectionMarks,
  chartHandlers,
} from './chartKit'

interface Props extends ChartInteraction {
  dataset: MarketDataset
  date: string
  basis: Basis
}

const BAR_COLOR = {
  spike: COLORS.spike,
  negative: COLORS.negative,
  low: COLORS.low,
  normal: COLORS.neutralBar,
} as const

export function PriceSection(props: Props) {
  const { dataset, date, basis, selectedIndex } = props
  const rows = useMemo(() => priceRows(dataset, date), [dataset, date])
  const day = useMemo(() => pointsForDate(dataset, date), [dataset, date])
  const flags = useMemo(() => priceFlags(day), [day])
  const handlers = chartHandlers(rows, props)
  const ticks = axisTicks(rows)
  const dayHigh = Math.max(...rows.map((r) => r.price))
  const dayLow = Math.min(...rows.map((r) => r.price))

  return (
    <section aria-label="Day-ahead price" data-testid="price-chart" data-selected-hour={selectedIndex}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[13px] font-semibold text-ink">
            {dataset.market.name} · {formatDateLong(date)}
          </h2>
          <p className="text-muted text-xs">
            Hourly day-ahead price, €/MWh. Click a bar to investigate that hour.
          </p>
        </div>
        <div className="text-muted text-right text-xs">
          Day range <span className="text-ink font-medium">{formatPrice(dayLow)}</span> to{' '}
          <span className="text-ink font-medium">{formatPrice(dayHigh)}</span>
        </div>
      </div>

      <div className="mt-2 flex min-h-7 flex-wrap items-center gap-1.5" aria-label="Flagged periods">
        {flags.length === 0 && (
          <span className="text-muted text-xs">No unusual price periods flagged for this day.</span>
        )}
        {flags.map((f) => (
          <FlagChip
            key={`${f.kind}-${f.startHour}`}
            flag={f}
            onClick={() =>
              props.onSelect((day.find((p) => p.hour === f.peakHour) as { index: number }).index)
            }
          />
        ))}
      </div>

      <div className="mt-1 h-[250px]">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 900, height: 250 }}>
          <ComposedChart data={rows} margin={{ top: 22, right: 8, bottom: 0, left: 0 }} {...handlers}>
            <CartesianGrid vertical={false} stroke={COLORS.grid} />
            <XAxis dataKey="label" ticks={ticks} {...AXIS_PROPS} />
            <YAxis
              width={40}
              {...AXIS_PROPS}
              tickFormatter={(v: number) => `${v}`}
              domain={[
                (min: number) => Math.min(0, Math.floor(min / 20) * 20),
                (max: number) => Math.ceil(max / 20) * 20,
              ]}
            />
            <ReferenceLine y={0} stroke={COLORS.line} />
            <Tooltip cursor={false} content={<PriceTooltip dataset={dataset} />} isAnimationActive={false} />
            <Bar dataKey="price" isAnimationActive={false} radius={[2, 2, 0, 0]}>
              {rows.map((r) => {
                const p = day[r.hour]
                const cls = p ? priceClass(p) : 'normal'
                const selected = r.index === selectedIndex
                return (
                  <Cell
                    key={r.index}
                    fill={BAR_COLOR[cls]}
                    fillOpacity={selected ? 1 : 0.85}
                    stroke={selected ? COLORS.ink : 'none'}
                    strokeWidth={selected ? 2 : 0}
                  />
                )
              })}
            </Bar>
            <BasisOverlay
              basis={basis}
              rows={rows}
              selectedIndex={selectedIndex}
              typicalKey="typical"
              bandKey="typicalBand"
              previousDayKey="previousDay"
              previousHourKey="previousHour"
            />
            {flags.map((f) => {
              const r = rows[f.peakHour]
              if (!r) return null
              return (
                <ReferenceDot
                  key={`${f.kind}-${f.peakHour}`}
                  x={r.label}
                  y={r.price}
                  r={0}
                  ifOverflow="visible"
                  label={{
                    value: formatPrice(r.price),
                    position: f.kind === 'spike' ? 'top' : 'bottom',
                    fill: f.kind === 'spike' ? COLORS.spike : COLORS.negative,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                />
              )
            })}
            <SelectionMarks rows={rows} selectedIndex={selectedIndex} hoverIndex={props.hoverIndex} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="text-muted mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <Swatch color={COLORS.spike} label="Spike (≥1.25σ above typical)" />
        <Swatch color={COLORS.negative} label="Negative price" />
        <Swatch color={COLORS.low} label="Unusually low" />
        <Swatch color={COLORS.neutralBar} label="Within normal range" />
        <span className="inline-flex items-center gap-1">
          <Info size={12} aria-hidden /> Typical = illustrative synthetic reference for this hour of day
        </span>
      </div>
    </section>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  )
}

function FlagChip({ flag, onClick }: { flag: PriceFlag; onClick: () => void }) {
  const spike = flag.kind === 'spike'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
        spike
          ? 'border-spike/30 bg-spike-soft text-spike hover:border-spike'
          : 'border-negative/30 bg-negative-soft text-negative hover:border-negative'
      }`}
    >
      {flagLabel(flag)}
    </button>
  )
}

interface TipProps {
  active?: boolean
  payload?: { payload: PriceRow }[]
  dataset: MarketDataset
}

function PriceTooltip({ active, payload, dataset }: TipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const p = dataset.points[row.index]
  if (!p) return null
  const z = zScore(p.price.dayAhead, p.price.typical)
  return (
    <div className="border-line-strong rounded-md border bg-white px-2.5 py-1.5 text-xs shadow-sm">
      <div className="text-ink font-semibold">
        {formatHour(row.hour)} · {formatPrice(row.price, true)}
      </div>
      <div className="text-muted">
        Typical {formatPrice(row.typical)} · {z >= 0 ? '+' : '−'}
        {Math.abs(z).toFixed(1)}σ
      </div>
    </div>
  )
}

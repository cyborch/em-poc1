import { useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from 'lucide-react'
import type { MarketDataset, SignalKey } from '../data/types'
import {
  type Comparison,
  type Observation,
  buildHypothesis,
  buildObservations,
  compareSignal,
  priceCorrelations,
  rankInDay,
} from '../analysis/investigation'
import { BASIS_LABEL, type Basis } from '../analysis/series'
import {
  SIGNALS,
  formatDateLong,
  formatHour,
  formatDelta,
  formatPower,
  formatPrice,
  formatValue,
  levelOf,
  pointsForDate,
} from '../analysis/stats'
import { WINDOW_START } from '../data/generate'
import { deviationSummary } from './FlowChart'

interface Props {
  dataset: MarketDataset
  selectedIndex: number
  basis: Basis
  onBasis: (b: Basis) => void
  focus: SignalKey | null
  onFocus: (s: SignalKey | null) => void
  onSelect: (index: number) => void
}

const MAX_LISTED = 5

export function InvestigationPanel(props: Props) {
  const { dataset, selectedIndex, basis, onBasis, focus, onFocus, onSelect } = props
  const p = dataset.points[selectedIndex]
  const observations = useMemo(() => buildObservations(dataset, selectedIndex), [dataset, selectedIndex])
  const priceCmp = useMemo(() => compareSignal(dataset, selectedIndex, 'price'), [dataset, selectedIndex])
  const correlations = useMemo(() => priceCorrelations(dataset, WINDOW_START), [dataset])
  if (!p) return null

  const notable = observations.filter((o) => o.notable).slice(0, MAX_LISTED)
  const rest = observations.filter((o) => !notable.includes(o))
  const hypothesis = buildHypothesis(observations, priceCmp.z, p.price.dayAhead)

  return (
    <aside
      aria-label="Price investigation"
      data-testid="investigation-panel"
      data-selected-hour={selectedIndex}
      className="bg-panel border-line rounded-lg border"
    >
      <PriceHeader dataset={dataset} selectedIndex={selectedIndex} cmp={priceCmp} onSelect={onSelect} />

      <Section
        title="What might explain it"
        hint="Observations and investigation leads. They are not proven causes."
      >
        <ul className="space-y-1.5">
          {notable.map((o) => (
            <ObservationItem
              key={o.id}
              o={o}
              active={focus === o.signal}
              onClick={() => onFocus(focus === o.signal ? null : o.signal)}
            />
          ))}
        </ul>
        {rest.length > 0 && (
          <details className="mt-2">
            <summary className="text-muted hover:text-ink inline-flex items-center gap-1 text-xs">
              <ChevronRight size={12} className="transition-transform [details[open]_&]:rotate-90" />
              Other signals checked ({rest.length})
            </summary>
            <ul className="mt-1.5 space-y-1">
              {rest.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => onFocus(o.signal)}
                    className="text-muted hover:text-ink w-full text-left text-xs"
                  >
                    {o.title}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
        {hypothesis && (
          <div
            data-testid="hypothesis"
            className="border-line-strong bg-canvas mt-3 rounded-md border border-dashed p-2.5"
          >
            <div className="text-muted text-[10px] font-semibold tracking-wider uppercase">
              Hypothesis · not verified
            </div>
            <p className="text-ink mt-0.5 text-xs font-medium">{hypothesis.headline}:</p>
            <ul className="text-ink-soft mt-1 list-disc pl-4 text-xs">
              {hypothesis.drivers.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="text-muted mt-1 text-xs">{hypothesis.test}</p>
          </div>
        )}
      </Section>

      <Section title="Investigate the details" hint="Pick an observation or a chart title to drill in.">
        {focus ? (
          <SignalDetail
            dataset={dataset}
            selectedIndex={selectedIndex}
            signal={focus}
            basis={basis}
            onBasis={onBasis}
            observation={observations.find((o) => o.signal === focus)}
          />
        ) : (
          <p className="text-muted text-xs">
            Nothing selected yet. Choose an observation above to compare it with the previous hour, yesterday
            and typical conditions.
          </p>
        )}

        <details className="mt-3">
          <summary className="text-ink-soft hover:text-ink inline-flex items-center gap-1 text-xs font-medium">
            <ChevronRight size={12} className="transition-transform [details[open]_&]:rotate-90" />
            Compare all signals with normal conditions
          </summary>
          <CompareAll
            dataset={dataset}
            selectedIndex={selectedIndex}
            basis={basis}
            onBasis={onBasis}
            onFocus={onFocus}
          />
        </details>

        <details className="mt-2">
          <summary className="text-ink-soft hover:text-ink inline-flex items-center gap-1 text-xs font-medium">
            <ChevronRight size={12} className="transition-transform [details[open]_&]:rotate-90" />
            Co-movement across these 48 hours (correlation)
          </summary>
          <div className="mt-2 space-y-1">
            {correlations.map((c) => (
              <div key={c.signal} className="flex items-center gap-2 text-xs">
                <span className="text-ink-soft w-16">{c.label}</span>
                <div className="bg-canvas relative h-2 flex-1 rounded">
                  <div
                    className="absolute top-0 h-2 rounded"
                    style={{
                      left: c.r >= 0 ? '50%' : `${50 + c.r * 50}%`,
                      width: `${Math.abs(c.r) * 50}%`,
                      background: c.r >= 0 ? '#d4531c' : '#2a7aa8',
                    }}
                  />
                  <div className="bg-line-strong absolute top-0 left-1/2 h-2 w-px" />
                </div>
                <span className="text-ink w-10 text-right font-medium">
                  {c.r >= 0 ? '+' : '−'}
                  {Math.abs(c.r).toFixed(2)}
                </span>
              </div>
            ))}
            <p className="text-muted text-xs">
              Pearson r between hourly price and each forecast fundamental, synthetic data. Things that move
              together are leads, not explanations.
            </p>
          </div>
        </details>
      </Section>

      <div className="border-line text-muted border-t px-4 py-3 text-[11px] leading-relaxed">
        <span className="text-ink-soft font-semibold">How to read this panel.</span> <b>Observed</b> =
        measured. <b>Forecast</b> = expected, not yet happened. <b>Correlation</b> = moves together.{' '}
        <b>Hypothesis</b> = a reading to test. <b>Verified causal attribution</b> is deliberately not offered.
      </div>
    </aside>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-line border-t px-4 py-3">
      <h3 className="text-ink text-[13px] font-semibold">{title}</h3>
      {hint && <p className="text-muted mb-2 text-xs">{hint}</p>}
      {children}
    </div>
  )
}

const VERDICT: Record<string, string> = {
  'strong-up': 'Well above typical',
  'moderate-up': 'Above typical',
  typical: 'In the typical range',
  'moderate-down': 'Below typical',
  'strong-down': 'Well below typical',
}

function PriceHeader({
  dataset,
  selectedIndex,
  cmp,
  onSelect,
}: {
  dataset: MarketDataset
  selectedIndex: number
  cmp: Comparison
  onSelect: (i: number) => void
}) {
  const p = dataset.points[selectedIndex]
  if (!p) return null
  const day = pointsForDate(dataset, p.date)
  const rankHigh = rankInDay(day, p, (x) => x.price.dayAhead)
  const rankLow = 1 + day.filter((x) => x.price.dayAhead < p.price.dayAhead).length
  const dir = cmp.z >= 0 ? 'up' : 'down'
  const verdictKey = cmp.level === 'typical' ? 'typical' : `${cmp.level}-${dir}`
  const verdict = p.price.dayAhead < 0 ? 'Negative price' : (VERDICT[verdictKey] as string)
  const unusual = cmp.level !== 'typical'
  const prev = dataset.points[selectedIndex - 1]
  const next = dataset.points[selectedIndex + 1]
  const nearby = [-3, -2, -1, 0, 1, 2, 3]
    .map((o) => dataset.points[selectedIndex + o])
    .filter((x): x is NonNullable<typeof x> => !!x && x.index >= WINDOW_START)
  const lo = Math.min(0, ...nearby.map((x) => x.price.dayAhead))
  const hi = Math.max(...nearby.map((x) => x.price.dayAhead))
  const delta = (a: number, b: number) => `${a - b >= 0 ? '+' : '−'}${formatPrice(Math.abs(a - b))}`

  return (
    <div className="px-4 py-3">
      <div className="text-muted text-xs">What happened</div>
      <div className="text-ink text-[13px] font-semibold" data-testid="panel-title">
        {dataset.market.name} — {formatDateLong(p.date)}, {formatHour(p.hour)}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className="text-ink text-[34px] leading-none font-semibold tracking-tight"
          data-testid="panel-price"
        >
          {formatPrice(p.price.dayAhead)}
          <span className="text-muted text-sm font-normal">/MWh</span>
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            unusual
              ? dir === 'up'
                ? 'bg-spike-soft text-spike'
                : 'bg-negative-soft text-negative'
              : 'bg-canvas text-muted'
          }`}
          data-testid="panel-verdict"
        >
          {verdict}
        </span>
      </div>
      <p className="text-ink-soft mt-1 text-xs">
        Day-ahead, cleared. Typical for {formatHour(p.hour)}: {formatPrice(p.price.typical.mean)} (±
        {formatPrice(p.price.typical.sd)}) · {cmp.z >= 0 ? '+' : '−'}
        {Math.abs(cmp.z).toFixed(1)}σ
        {rankHigh <= 3
          ? ` · ${['highest', '2nd highest', '3rd highest'][rankHigh - 1]} hour of the day`
          : rankLow <= 3
            ? ` · ${['lowest', '2nd lowest', '3rd lowest'][rankLow - 1]} hour of the day`
            : ''}
      </p>
      <p className="text-muted mt-0.5 text-xs">
        {prev && prev.index >= WINDOW_START - 1 && (
          <>
            {delta(p.price.dayAhead, prev.price.dayAhead)} vs {formatHour(prev.hour)}
          </>
        )}
        {prev && next && ' · '}
        {next && (
          <>
            {delta(p.price.dayAhead, next.price.dayAhead)} vs {formatHour(next.hour)}
          </>
        )}
      </p>

      <div className="mt-3 flex items-end gap-1" role="group" aria-label="Nearby hours">
        {nearby.map((x) => {
          const h = hi === lo ? 8 : 6 + ((x.price.dayAhead - lo) / (hi - lo)) * 34
          const selected = x.index === selectedIndex
          return (
            <button
              key={x.index}
              type="button"
              onClick={() => onSelect(x.index)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded py-1 ${selected ? 'bg-canvas' : 'hover:bg-canvas'}`}
              aria-label={`${formatHour(x.hour)} ${formatPrice(x.price.dayAhead)}`}
              aria-current={selected}
            >
              <span className={`text-[11px] ${selected ? 'text-ink font-semibold' : 'text-muted'}`}>
                {formatPrice(x.price.dayAhead)}
              </span>
              <span
                className="w-full max-w-7 rounded-[2px]"
                style={{
                  height: h,
                  background: x.price.dayAhead < 0 ? '#2a7aa8' : selected ? '#12201b' : '#aebfb8',
                }}
              />
              <span className={`text-[10px] ${selected ? 'text-ink font-semibold' : 'text-faint'}`}>
                {String(x.hour).padStart(2, '0')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ObservationItem({ o, active, onClick }: { o: Observation; active: boolean; onClick: () => void }) {
  const Icon = o.pressure === 'up' ? ArrowUpRight : o.pressure === 'down' ? ArrowDownRight : Minus
  const color = o.pressure === 'up' ? 'text-spike' : o.pressure === 'down' ? 'text-negative' : 'text-faint'
  const tip =
    o.pressure === 'up'
      ? 'Conditions like this are usually associated with higher prices'
      : o.pressure === 'down'
        ? 'Conditions like this are usually associated with lower prices'
        : 'No clear price direction'
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        data-testid={`observation-${o.id}`}
        className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
          active ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong hover:bg-canvas'
        }`}
      >
        <span title={tip} className={`mt-0.5 ${color}`}>
          <Icon size={15} aria-label={tip} />
        </span>
        <span className="flex-1">
          <span className="text-ink text-xs leading-snug font-medium">{o.title}</span>
          {active && <span className="text-muted mt-1 block text-xs">{o.detail}</span>}
        </span>
        <span className="text-muted bg-canvas rounded px-1.5 py-px text-[10px] tracking-wide uppercase">
          {o.evidence}
        </span>
      </button>
    </li>
  )
}

function SignalDetail({
  dataset,
  selectedIndex,
  signal,
  basis,
  onBasis,
  observation,
}: {
  dataset: MarketDataset
  selectedIndex: number
  signal: SignalKey
  basis: Basis
  onBasis: (b: Basis) => void
  observation: Observation | undefined
}) {
  const p = dataset.points[selectedIndex]
  if (!p) return null
  const c = compareSignal(dataset, selectedIndex, signal)
  const prevH = dataset.points[selectedIndex - 1]
  const hourLabel = formatHour(p.hour)
  const rows: { basis: Basis; label: string; value: number | null; note?: string }[] = [
    {
      basis: 'previousHour',
      label: `Previous hour (${prevH ? formatHour(prevH.hour) : '–'})`,
      value: c.previousHour,
    },
    {
      basis: 'previousDay',
      label: 'Same hour yesterday',
      value: c.previousDay,
      note: c.previousDayIsForecast ? 'forecast' : undefined,
    },
    {
      basis: 'typical',
      label: `Typical for ${hourLabel}`,
      value: c.typicalMean,
      note: `±${formatValue(signal, c.typicalSd)}`,
    },
  ]
  const forecastKey = signal === 'wind' || signal === 'solar' || signal === 'demand' ? signal : null
  const strength = levelOf(c.z)

  return (
    <div data-testid="signal-detail" data-signal={signal} className="border-line rounded-md border p-3">
      <div className="flex items-baseline justify-between">
        <div className="text-ink text-[13px] font-semibold">{SIGNALS[signal].label}</div>
        <div className="text-muted text-xs">{SIGNALS[signal].question}</div>
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-ink text-xl font-semibold">{formatValue(signal, c.value)}</span>
        <span className="text-muted text-xs">
          {hourLabel} · {c.isActual ? 'observed' : 'forecast'}
        </span>
      </div>

      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="text-muted text-left">
            <th className="py-1 font-normal">Compare with</th>
            <th className="py-1 text-right font-normal">Value</th>
            <th className="py-1 text-right font-normal">Selected is</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.basis}
              onClick={() => onBasis(r.basis)}
              className={`cursor-pointer border-t ${basis === r.basis ? 'border-brand/30 bg-brand-soft' : 'border-line hover:bg-canvas'}`}
            >
              <td className="py-1.5 pl-1.5">
                <button
                  type="button"
                  className="text-left"
                  onClick={() => onBasis(r.basis)}
                  aria-pressed={basis === r.basis}
                >
                  {r.label}
                </button>
              </td>
              <td className="py-1.5 text-right">
                {r.value === null ? '–' : formatValue(signal, r.value)}
                {r.note && <span className="text-muted"> {r.note}</span>}
              </td>
              <td
                className={`py-1.5 pr-1.5 text-right font-medium ${
                  r.basis === 'typical' && strength !== 'typical' ? 'text-spike' : 'text-ink'
                }`}
              >
                {formatDelta(signal, c.value, r.value)}
                {r.basis === 'typical' && ` (${c.z >= 0 ? '+' : '−'}${Math.abs(c.z).toFixed(1)}σ)`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted mt-1 text-[11px]">
        Selecting a row changes the reference drawn on the charts: {BASIS_LABEL[basis].toLowerCase()}.
      </p>

      {forecastKey && (
        <div className="bg-canvas mt-3 rounded p-2 text-xs">
          <div className="text-muted mb-0.5 text-[10px] font-semibold tracking-wider uppercase">
            Forecast vs reality
          </div>
          <div className="text-ink-soft" data-testid="deviation-summary">
            {deviationSummary(dataset, selectedIndex, forecastKey)}
          </div>
        </div>
      )}
      {signal === 'netLoad' && (
        <div className="bg-canvas mt-3 rounded p-2 text-xs">
          <div className="text-muted mb-0.5 text-[10px] font-semibold tracking-wider uppercase">
            Composition
          </div>
          <div className="text-ink-soft">
            Demand{' '}
            {formatPower(c.value + (p.solar.actual ?? p.solar.forecast) + (p.wind.actual ?? p.wind.forecast))}{' '}
            − solar {formatPower(p.solar.actual ?? p.solar.forecast)} − wind{' '}
            {formatPower(p.wind.actual ?? p.wind.forecast)} = {formatPower(c.value)}
          </div>
        </div>
      )}
      {signal === 'imports' && (
        <div className="bg-canvas mt-3 rounded p-2 text-xs text-ink-soft">
          Available capacity: import {formatPower(p.capacity.importAvailable)} (typical{' '}
          {formatPower(p.capacity.importTypical)}), export {formatPower(p.capacity.exportAvailable)} (typical{' '}
          {formatPower(p.capacity.exportTypical)}).
        </div>
      )}
      {observation && (
        <p className="text-ink-soft mt-3 text-xs">
          <span className="text-muted font-semibold">Where to look next: </span>
          {observation.nextStep}
        </p>
      )}
    </div>
  )
}

const TABLE_SIGNALS: SignalKey[] = ['price', 'solar', 'wind', 'demand', 'netLoad', 'imports', 'conventional']

function CompareAll({
  dataset,
  selectedIndex,
  basis,
  onBasis,
  onFocus,
}: {
  dataset: MarketDataset
  selectedIndex: number
  basis: Basis
  onBasis: (b: Basis) => void
  onFocus: (s: SignalKey) => void
}) {
  const rows = TABLE_SIGNALS.map((k) => compareSignal(dataset, selectedIndex, k))
  const cols: { basis: Basis; label: string }[] = [
    { basis: 'previousHour', label: 'Prev. hour' },
    { basis: 'previousDay', label: 'Yesterday' },
    { basis: 'typical', label: 'Typical' },
  ]
  return (
    <>
      <p className="text-muted mt-2 text-[11px]">
        Difference between the selected hour and each reference. Click a column to draw it on the charts.
      </p>
      <table className="mt-1 w-full text-xs whitespace-nowrap" data-testid="compare-all">
        <thead>
          <tr className="text-muted">
            <th className="py-1 text-left font-normal">Signal</th>
            <th className="py-1 text-right font-normal">Now</th>
            {cols.map((c) => (
              <th key={c.basis} className="py-1 text-right font-normal">
                <button
                  type="button"
                  onClick={() => onBasis(c.basis)}
                  aria-pressed={basis === c.basis}
                  className={`rounded px-1 ${basis === c.basis ? 'bg-brand-soft text-brand font-semibold' : 'hover:text-ink'}`}
                >
                  {c.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-line border-t">
              <td className="py-1.5">
                {r.key === 'price' ? (
                  <span className="font-medium">{SIGNALS.price.label}</span>
                ) : (
                  <button type="button" className="hover:text-brand text-left" onClick={() => onFocus(r.key)}>
                    {SIGNALS[r.key].label}
                  </button>
                )}
              </td>
              <td className="py-1.5 text-right font-medium">
                {formatValue(r.key, r.value).replace('/MWh', '')}
              </td>
              <td className="py-1.5 text-right">{formatDelta(r.key, r.value, r.previousHour)}</td>
              <td className="py-1.5 text-right">{formatDelta(r.key, r.value, r.previousDay)}</td>
              <td className={`py-1.5 text-right ${r.level !== 'typical' ? 'text-spike font-semibold' : ''}`}>
                {formatDelta(r.key, r.value, r.typicalMean)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

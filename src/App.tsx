import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlaskConical, Keyboard } from 'lucide-react'
import { AS_OF_INDEX, WINDOW_START, datasets } from './data/generate'
import { MARKET_ORDER } from './data/markets'
import type { MarketId, SignalKey } from './data/types'
import { BASIS_LABEL, type Basis } from './analysis/series'
import { VISIBLE_DAYS, formatHour, formatPrice } from './analysis/stats'
import { PriceSection } from './components/PriceSection'
import { ChartCard, SignalChart, type SeriesSpec } from './components/SignalChart'
import { DeviationChart, type DeviationKey, FlowChart, deviationSummary } from './components/FlowChart'
import { MixChart } from './components/MixChart'
import { InvestigationPanel } from './components/InvestigationPanel'
import { COLORS } from './components/chartKit'

const DEFAULT_MARKET: MarketId = 'DE'
/** Germany, Wed 18 Mar 2026, 18:00: the default scenario. */
const DEFAULT_INDEX = 24 + 24 + 18
const LAST_INDEX = 71

const SOLAR: SeriesSpec[] = [{ key: 'solar', color: COLORS.solar, name: 'Solar', showRange: true }]
const WIND: SeriesSpec[] = [{ key: 'wind', color: COLORS.wind, name: 'Wind', showRange: true }]
const DEMAND: SeriesSpec[] = [
  { key: 'demand', color: COLORS.demand, name: 'Demand' },
  { key: 'netLoad', color: COLORS.netLoad, name: 'Net load' },
]

export default function App() {
  const [marketId, setMarketId] = useState<MarketId>(DEFAULT_MARKET)
  const [selectedIndex, setSelectedIndex] = useState(DEFAULT_INDEX)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [basis, setBasis] = useState<Basis>('typical')
  const [focus, setFocus] = useState<SignalKey | null>(null)
  const [devChoice, setDevChoice] = useState<DeviationKey>('wind')

  const dataset = datasets[marketId]
  const point = dataset.points[selectedIndex]
  const date = point?.date ?? VISIBLE_DAYS[1].date
  const day = VISIBLE_DAYS.find((d) => d.date === date) ?? VISIBLE_DAYS[1]

  const select = useCallback(
    (i: number) => setSelectedIndex(Math.min(LAST_INDEX, Math.max(WINDOW_START, i))),
    [],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(LAST_INDEX, i + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(WINDOW_START, i - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const interaction = useMemo(
    () => ({ selectedIndex, hoverIndex, onSelect: select, onHover: setHoverIndex }),
    [selectedIndex, hoverIndex, select],
  )

  if (!point) return null
  const devSignal: DeviationKey =
    focus === 'wind' || focus === 'solar' || focus === 'demand' ? focus : devChoice
  const expected = selectedIndex >= AS_OF_INDEX
  const toggleFocus = (s: SignalKey) => setFocus((f) => (f === s ? null : s))

  return (
    <div className="mx-auto flex min-h-full max-w-[1440px] flex-col px-6 pb-8">
      <header className="flex items-center justify-between gap-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="bg-brand flex h-7 w-7 items-center justify-center rounded-md text-white"
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 11l3-4 3 2 3-5 3 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div className="text-ink text-[15px] leading-tight font-semibold">Price Formation Explorer</div>
            <div className="text-muted text-xs">Product prototype · day-ahead power markets</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Segmented
            label="Market"
            value={marketId}
            options={MARKET_ORDER.map((id) => ({ value: id, label: datasets[id].market.name }))}
            onChange={(v) => setMarketId(v as MarketId)}
          />
          <Segmented
            label="Date"
            value={date}
            options={VISIBLE_DAYS.map((d) => ({ value: d.date, label: `${d.label}` }))}
            onChange={(v) => select(WINDOW_START + (v === VISIBLE_DAYS[1].date ? 24 : 0) + point.hour)}
          />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-medium text-amber-800"
            title="All values are deterministic synthetic data created for this prototype"
          >
            <FlaskConical size={13} aria-hidden /> Illustrative synthetic data
          </span>
          <span className="text-muted">As of 17 Mar 2026, 13:00 CET</span>
        </div>
      </header>

      <div className="mb-4">
        <h1 className="text-ink text-[22px] leading-snug font-semibold tracking-tight" data-testid="question">
          Why {expected ? 'is electricity expected to cost' : 'did electricity cost'}{' '}
          <span className="text-spike">{formatPrice(point.price.dayAhead)}/MWh</span> in {dataset.market.name}{' '}
          {day.relative} at {formatHour(point.hour)}?
        </h1>
        <p className="text-muted mt-0.5 text-xs">
          Start from the price, look at the fundamentals around it, compare with normal, and form your own
          hypothesis.
          <span className="ml-2 inline-flex items-center gap-1">
            <Keyboard size={12} aria-hidden /> ← → step through hours
          </span>
        </p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_400px] items-start gap-5">
        <main className="min-w-0 space-y-4">
          <div className="bg-panel border-line rounded-lg border p-4">
            <PriceSection dataset={dataset} date={date} basis={basis} {...interaction} />
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between">
              <div>
                <h2 className="text-ink text-[13px] font-semibold">Fundamentals at the same hour</h2>
                <p className="text-muted text-xs">
                  Every chart shares the selected hour (solid line). Hover to see the same hour in all charts.
                </p>
              </div>
              <Segmented
                label="Compare with"
                value={basis}
                options={(Object.keys(BASIS_LABEL) as Basis[]).map((b) => ({
                  value: b,
                  label: BASIS_LABEL[b],
                }))}
                onChange={(v) => setBasis(v as Basis)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ChartCard
                testId="chart-solar"
                title="Is solar unusually low or high for this hour?"
                dataset={dataset}
                signals={['solar']}
                basis={basis}
                focused={focus === 'solar'}
                onFocus={() => toggleFocus('solar')}
                {...interaction}
              >
                <SignalChart dataset={dataset} date={date} specs={SOLAR} basis={basis} {...interaction} />
              </ChartCard>
              <ChartCard
                testId="chart-wind"
                title="Is wind above or below what is normal?"
                dataset={dataset}
                signals={['wind']}
                basis={basis}
                focused={focus === 'wind'}
                onFocus={() => toggleFocus('wind')}
                {...interaction}
              >
                <SignalChart dataset={dataset} date={date} specs={WIND} basis={basis} {...interaction} />
              </ChartCard>
              <ChartCard
                testId="chart-demand"
                title="How much must non-wind, non-solar supply cover?"
                dataset={dataset}
                signals={['demand', 'netLoad']}
                basis={basis}
                focused={focus === 'demand' || focus === 'netLoad'}
                onFocus={() => toggleFocus('demand')}
                {...interaction}
              >
                <SignalChart dataset={dataset} date={date} specs={DEMAND} basis={basis} {...interaction} />
              </ChartCard>
              <ChartCard
                testId="chart-flows"
                title="Is there room to import or export more?"
                dataset={dataset}
                signals={['imports']}
                basis={basis}
                focused={focus === 'imports'}
                onFocus={() => toggleFocus('imports')}
                {...interaction}
              >
                <FlowChart dataset={dataset} date={date} basis={basis} {...interaction} />
              </ChartCard>
            </div>
          </div>

          <ChartCard
            testId="chart-mix"
            title="How is demand being met at this hour?"
            dataset={dataset}
            signals={['conventional']}
            basis={basis}
            focused={focus === 'conventional'}
            onFocus={() => toggleFocus('conventional')}
            {...interaction}
          >
            <MixChart dataset={dataset} date={date} {...interaction} />
          </ChartCard>

          <div
            data-testid="chart-deviation"
            data-selected-hour={selectedIndex}
            className="bg-panel border-line rounded-lg border p-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-ink text-[13px] font-semibold">
                  Did reality depart from the forecast?
                </div>
                <p className="text-ink-soft mt-0.5 text-xs" data-testid="deviation-text">
                  {formatHour(point.hour)} · {deviationSummary(dataset, selectedIndex, devSignal)}
                </p>
              </div>
              <Segmented
                label="Signal"
                value={devSignal}
                options={[
                  { value: 'wind', label: 'Wind' },
                  { value: 'solar', label: 'Solar' },
                  { value: 'demand', label: 'Demand' },
                ]}
                onChange={(v) => {
                  setDevChoice(v as DeviationKey)
                  if (focus === 'wind' || focus === 'solar' || focus === 'demand') setFocus(v as DeviationKey)
                }}
              />
            </div>
            <DeviationChart dataset={dataset} date={date} signal={devSignal} {...interaction} />
          </div>
        </main>

        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg">
          <InvestigationPanel
            dataset={dataset}
            selectedIndex={selectedIndex}
            basis={basis}
            onBasis={setBasis}
            focus={focus}
            onFocus={setFocus}
            onSelect={select}
          />
        </div>
      </div>

      <footer className="text-muted mt-6 text-[11px]">
        All data is deterministic and synthetic, generated for illustration (fixed dates, Europe/Berlin, CET).
        Observations are investigation leads, not verified causal explanations. See PRODUCT_DECISIONS.md and
        DATA_ASSUMPTIONS.md.
      </footer>
    </div>
  )
}

interface SegmentedProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}

function Segmented({ label, value, options, onChange }: SegmentedProps) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap" role="group" aria-label={label}>
      <span className="text-muted text-xs">{label}</span>
      <div className="border-line-strong bg-panel inline-flex overflow-hidden rounded-md border">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={`px-2.5 py-1 text-xs font-medium transition-colors ${
              value === o.value ? 'bg-ink text-white' : 'text-ink-soft hover:bg-canvas'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

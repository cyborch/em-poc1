import type { HourPoint, MarketDataset, SignalKey } from '../data/types'
import {
  type Level,
  formatHour,
  formatPct,
  formatPower,
  formatPrice,
  levelOf,
  pctChange,
  pearson,
  pointsForDate,
  signalQuantity,
  valueOf,
  zScore,
} from './stats'

export interface Comparison {
  key: SignalKey
  value: number
  /** True when the value is an observation, false when it is a forecast/schedule. */
  isActual: boolean
  previousHour: number | null
  previousDay: number | null
  /** Whether the previous-day value is itself still a forecast. */
  previousDayIsForecast: boolean
  typicalMean: number
  typicalSd: number
  z: number
  level: Level
}

export function compareSignal(dataset: MarketDataset, index: number, key: SignalKey): Comparison {
  const pts = dataset.points
  const p = pts[index] as HourPoint
  const q = signalQuantity(p, key)
  const prevH = pts[index - 1]
  const prevD = pts[index - 24]
  const z = zScore(valueOf(q), q.typical)
  return {
    key,
    value: valueOf(q),
    isActual: key !== 'price' && q.actual !== null,
    previousHour: prevH ? valueOf(signalQuantity(prevH, key)) : null,
    previousDay: prevD ? valueOf(signalQuantity(prevD, key)) : null,
    previousDayIsForecast: prevD ? !prevD.observed : false,
    typicalMean: q.typical.mean,
    typicalSd: q.typical.sd,
    z,
    level: levelOf(z),
  }
}

export type Pressure = 'up' | 'down' | 'none'
export type EvidenceKind = 'observed' | 'forecast'

export interface Observation {
  id: string
  signal: SignalKey
  title: string
  detail: string
  /** Direction in which this signal is usually associated with prices (a heuristic, not a causal claim). */
  pressure: Pressure
  /** How strongly this signal departs from normal; drives ordering. */
  importance: number
  notable: boolean
  evidence: EvidenceKind
  nextStep: string
  /** Short phrase used when composing a hypothesis from several observations. */
  driver: string
}

export const NOTABLE_THRESHOLD = 0.75

const NEXT_STEPS: Record<SignalKey, string> = {
  price: 'Compare with other hours of similar net load and import headroom.',
  solar: 'Check cloud-cover revisions: small solar changes move the evening ramp.',
  wind: 'Check the latest wind forecast revisions and the P10–P90 range for the next hours.',
  demand: 'Check temperature and load forecasts; compare with the same weekday last week.',
  netLoad: 'Find past hours with similar net load and see where prices cleared.',
  imports: 'Check border-level capacity and outage notices for this hour (not modelled in this prototype).',
  conventional:
    'Check plant availability and fuel prices for the marginal units (not modelled in this prototype).',
}

function ordinal(n: number): string {
  if (n === 1) return 'highest'
  if (n === 2) return '2nd highest'
  if (n === 3) return '3rd highest'
  return `${n}th highest`
}

function peakHourOf(day: HourPoint[], pick: (p: HourPoint) => number): { value: number; hour: number } {
  let best = day[0] as HourPoint
  for (const p of day) if (pick(p) > pick(best)) best = p
  return { value: pick(best), hour: best.hour }
}

export function rankInDay(day: HourPoint[], p: HourPoint, pick: (p: HourPoint) => number): number {
  const v = pick(p)
  return 1 + day.filter((x) => pick(x) > v).length
}

export function buildObservations(dataset: MarketDataset, index: number): Observation[] {
  const pts = dataset.points
  const p = pts[index] as HourPoint
  const day = pointsForDate(dataset, p.date)
  const hourLabel = formatHour(p.hour)
  const prev3 = pts[index - 3]
  const sinceLabel = formatHour((p.hour + 21) % 24)
  const out: Observation[] = []
  const evidence = (key: SignalKey): EvidenceKind =>
    signalQuantity(p, key).actual !== null ? 'observed' : 'forecast'
  const verb = evidence('solar') === 'observed' ? 'is' : 'is forecast at'

  // Solar
  {
    const c = compareSignal(dataset, index, 'solar')
    const peak = peakHourOf(day, (x) => valueOf(x.solar))
    const ratio = peak.value > 0 ? c.value / peak.value : 1
    const ramp = prev3 ? c.value - valueOf(prev3.solar) : 0
    const night = peak.value < 1 || (c.value < 50 && c.typicalMean < 50)
    const rampScore = peak.value > 0 ? Math.min(2, (Math.abs(ramp) / (0.25 * peak.value)) * 1.2) : 0
    const importance = night ? 0 : Math.max(Math.abs(c.z), rampScore)
    const nearZero = ratio < 0.1 && peak.value > 2000
    const pressure: Pressure = c.z <= -0.75 || (nearZero && ramp < 0) ? 'up' : c.z >= 0.75 ? 'down' : 'none'
    let title: string
    let detail: string
    if (night) {
      title = `Solar ${verb} ~0 — the sun is down at ${hourLabel}`
      detail = 'Normal for this hour; net load must be covered by wind, dispatchable plants and imports.'
    } else if (nearZero) {
      title = `Solar ${verb} ${formatPower(c.value)} — ${Math.round((1 - ratio) * 100)}% below the day's peak of ${formatPower(peak.value)} (${formatHour(peak.hour)})`
      detail = `Down ${formatPower(Math.abs(ramp))} since ${sinceLabel}. Typical for ${hourLabel}: ${formatPower(c.typicalMean)}.`
    } else {
      const pc = pctChange(c.value, c.typicalMean)
      title = `Solar ${verb} ${formatPower(c.value)}${pc === null ? '' : `, ${formatPct(pc)} vs typical for ${hourLabel}`}`
      detail = `Typical for ${hourLabel}: ${formatPower(c.typicalMean)}. Change over 3 h: ${ramp >= 0 ? '+' : '−'}${formatPower(Math.abs(ramp))}.`
    }
    out.push({
      id: 'solar',
      signal: 'solar',
      title,
      detail,
      pressure,
      importance,
      notable: importance >= NOTABLE_THRESHOLD,
      evidence: evidence('solar'),
      nextStep: NEXT_STEPS.solar,
      driver: pressure === 'down' ? 'solar output is high' : 'solar output has dropped away',
    })
  }

  // Wind
  {
    const c = compareSignal(dataset, index, 'wind')
    const pc = pctChange(c.value, c.typicalMean)
    const dir = c.value < c.typicalMean ? 'below' : 'above'
    const importance = Math.abs(c.z)
    out.push({
      id: 'wind',
      signal: 'wind',
      title: `Wind ${verb} ${formatPower(c.value)} — ${pc === null ? '' : `${Math.abs(Math.round(pc))}% `}${dir} typical for ${hourLabel}`,
      detail: `Typical: ${formatPower(c.typicalMean)} (±${formatPower(c.typicalSd)}). ${
        prev3
          ? `Change over 3 h: ${c.value - valueOf(prev3.wind) >= 0 ? '+' : '−'}${formatPower(Math.abs(c.value - valueOf(prev3.wind)))}.`
          : ''
      }`,
      pressure: c.z <= -0.75 ? 'up' : c.z >= 0.75 ? 'down' : 'none',
      importance,
      notable: importance >= NOTABLE_THRESHOLD,
      evidence: evidence('wind'),
      nextStep: NEXT_STEPS.wind,
      driver: c.z >= 0 ? 'wind is above its typical level' : 'wind is below its typical level',
    })
  }

  // Demand
  {
    const c = compareSignal(dataset, index, 'demand')
    const peak = peakHourOf(day, (x) => valueOf(x.demand))
    const nearPeak = c.value >= 0.95 * peak.value
    const pc = pctChange(c.value, c.typicalMean)
    const importance = Math.max(Math.abs(c.z), nearPeak ? 0.9 : 0)
    const dir = c.value < c.typicalMean ? 'below' : 'above'
    out.push({
      id: 'demand',
      signal: 'demand',
      title: `Demand ${verb} ${formatPower(c.value)}${
        pc !== null && Math.abs(c.z) >= 0.3
          ? ` — ${Math.abs(Math.round(pc))}% ${dir} typical`
          : ' — in line with typical'
      }${nearPeak ? `, close to the day's peak (${formatHour(peak.hour)})` : ''}`,
      detail: `Typical for ${hourLabel}: ${formatPower(c.typicalMean)}. Day's peak: ${formatPower(peak.value)} at ${formatHour(peak.hour)}.`,
      pressure: c.z >= 0.75 || (nearPeak && c.z > -0.3) ? 'up' : c.z <= -0.75 ? 'down' : 'none',
      importance,
      notable: importance >= NOTABLE_THRESHOLD,
      evidence: evidence('demand'),
      nextStep: NEXT_STEPS.demand,
      driver:
        c.z <= -0.75
          ? 'demand is low for this hour'
          : c.z >= 0.75
            ? 'demand is well above typical'
            : 'demand is near its daily peak',
    })
  }

  // Net load
  {
    const c = compareSignal(dataset, index, 'netLoad')
    const pick = (x: HourPoint) => valueOf(signalQuantity(x, 'netLoad'))
    const rank = rankInDay(day, p, pick)
    const lowRank = 1 + day.filter((x) => pick(x) < c.value).length
    const prevNl = prev3 ? pick(prev3) : c.value
    const topRank = rank <= 3
    const bottomRank = lowRank <= 3
    const importance = Math.max(Math.abs(c.z), topRank || bottomRank ? 1.1 : 0)
    const rankText = topRank
      ? `the ${ordinal(rank)} of the day`
      : bottomRank
        ? `the ${lowRank === 1 ? 'lowest' : lowRank === 2 ? '2nd lowest' : '3rd lowest'} of the day`
        : `${formatPct(pctChange(c.value, c.typicalMean) ?? 0)} vs typical`
    out.push({
      id: 'netLoad',
      signal: 'netLoad',
      title: `Net load ${verb} ${formatPower(c.value)} — ${rankText}`,
      detail: `Demand minus wind and solar. Typical for ${hourLabel}: ${formatPower(c.typicalMean)}. Change over 3 h: ${c.value - prevNl >= 0 ? '+' : '−'}${formatPower(Math.abs(c.value - prevNl))}.`,
      pressure: c.z >= 0.75 || topRank ? 'up' : c.z <= -0.75 || bottomRank ? 'down' : 'none',
      importance,
      notable: importance >= NOTABLE_THRESHOLD,
      evidence: evidence('netLoad'),
      nextStep: NEXT_STEPS.netLoad,
      driver:
        bottomRank && !topRank && c.z < 0.75
          ? 'net load is among the day’s lowest'
          : 'net load is among the day’s highest',
    })
  }

  // Cross-border flows
  {
    const c = compareSignal(dataset, index, 'imports')
    const importing = c.value >= 0
    const avail = importing ? p.capacity.importAvailable : p.capacity.exportAvailable
    const typ = importing ? p.capacity.importTypical : p.capacity.exportTypical
    const util = avail > 0 ? Math.abs(c.value) / avail : 0
    const reduced = avail < 0.9 * typ
    const full = util >= 0.9
    const importance = Math.max(
      Math.abs(c.z),
      full ? 1.0 + (reduced ? 0.8 : 0) : reduced && util >= 0.6 ? 0.8 : 0,
    )
    const flow = importing ? 'imports' : 'exports'
    out.push({
      id: 'imports',
      signal: 'imports',
      title: `Net ${flow} of ${formatPower(Math.abs(c.value))} use ${Math.round(util * 100)}% of available ${importing ? 'import' : 'export'} capacity${reduced ? ` (${formatPower(avail)} vs ${formatPower(typ)} typical)` : ''}`,
      detail: `Available ${importing ? 'import' : 'export'} capacity: ${formatPower(avail)}; typical: ${formatPower(typ)}. Typical net flow for ${hourLabel}: ${formatPower(c.typicalMean)} (positive = import).`,
      pressure: full ? (importing ? 'up' : 'down') : 'none',
      importance,
      notable: importance >= NOTABLE_THRESHOLD,
      evidence: evidence('imports'),
      nextStep: NEXT_STEPS.imports,
      driver: importing
        ? 'import capacity is almost fully used'
        : 'export capacity is fully used, so surplus cannot leave',
    })
  }

  // Conventional generation
  {
    const c = compareSignal(dataset, index, 'conventional')
    const { conventionalMax: max, conventionalMin: min } = dataset.market
    const util = c.value / max
    const atFloor = c.value <= min * 1.03
    const high = util >= 0.8
    const importance = atFloor ? 1.2 : high ? 0.7 + (util - 0.8) * 5 : Math.abs(c.z) * 0.6
    out.push({
      id: 'conventional',
      signal: 'conventional',
      title: atFloor
        ? `Conventional output ${verb} ${formatPower(c.value)} — at its must-run floor`
        : `Conventional output ${verb} ${formatPower(c.value)} — ${Math.round(util * 100)}% of its ${formatPower(max)} maximum`,
      detail: `Typical for ${hourLabel}: ${formatPower(c.typicalMean)}. Higher output means more expensive plants set the margin.`,
      pressure: atFloor ? 'down' : high ? 'up' : 'none',
      importance,
      notable: importance >= NOTABLE_THRESHOLD,
      evidence: evidence('conventional'),
      nextStep: NEXT_STEPS.conventional,
      driver: atFloor
        ? 'dispatchable plants are at their must-run floor'
        : 'dispatchable plants run near their upper range',
    })
  }

  // Forecast deviations (only where actuals exist)
  for (const key of ['wind', 'solar', 'demand'] as const) {
    const q = p[key]
    if (q.actual === null || !q.range) continue
    const dev = q.actual - q.forecast
    const outside = q.actual < q.range[0] || q.actual > q.range[1]
    if (!outside) continue
    const label = key === 'wind' ? 'Wind' : key === 'solar' ? 'Solar' : 'Demand'
    const pc = pctChange(q.actual, q.forecast) ?? 0
    const below = dev < 0
    out.push({
      id: `deviation-${key}`,
      signal: key,
      title: `${label} came in ${formatPower(Math.abs(dev))} (${Math.abs(Math.round(pc))}%) ${below ? 'below' : 'above'} its forecast — outside the P10–P90 range`,
      detail: `Forecast ${formatPower(q.forecast)}, P10–P90 ${formatPower(q.range[0])}–${formatPower(q.range[1])}, observed ${formatPower(q.actual)}. The day-ahead price was cleared before this deviation was known.`,
      pressure: (key === 'demand') === !below ? 'up' : 'down',
      importance: 1.6,
      notable: true,
      evidence: 'observed',
      nextStep: `Check whether later forecasts and intraday prices reacted to this ${label.toLowerCase()} miss.`,
      driver: `${label.toLowerCase()} deviated from its forecast`,
    })
  }

  return out.sort((a, b) => b.importance - a.importance)
}

export interface Hypothesis {
  headline: string
  drivers: string[]
  test: string
}

/** Builds a hedged reading of the situation; returns null when no fundamentals stand out. */
export function buildHypothesis(
  observations: Observation[],
  priceZ: number,
  priceValue: number,
): Hypothesis | null {
  const dir: 'up' | 'down' | null =
    priceZ >= NOTABLE_THRESHOLD ? 'up' : priceZ <= -NOTABLE_THRESHOLD ? 'down' : null
  if (!dir) return null
  const seen = new Set<SignalKey>()
  const drivers: string[] = []
  for (const o of observations) {
    if (!o.notable || o.pressure !== dir || seen.has(o.signal)) continue
    seen.add(o.signal)
    drivers.push(o.driver)
  }
  if (drivers.length < 2) return null
  drivers.splice(4)
  return {
    headline: `${formatPrice(priceValue)}/MWh may be ${dir === 'up' ? 'elevated' : 'depressed'} because these conditions coincide`,
    drivers,
    test: 'To test this, look for other hours with a similar combination and compare how prices cleared.',
  }
}

export interface PriceFlag {
  kind: 'spike' | 'negative'
  startHour: number
  endHour: number
  peakHour: number
  peakValue: number
}

export function priceClass(p: HourPoint): 'spike' | 'negative' | 'low' | 'normal' {
  const z = zScore(p.price.dayAhead, p.price.typical)
  if (p.price.dayAhead < 0) return 'negative'
  if (z >= 1.25 && p.price.dayAhead > 1.2 * p.price.typical.mean) return 'spike'
  if (z <= -1.25) return 'low'
  return 'normal'
}

export function priceFlags(day: HourPoint[]): PriceFlag[] {
  const flags: PriceFlag[] = []
  for (const kind of ['spike', 'negative'] as const) {
    let current: HourPoint[] = []
    const flush = () => {
      if (!current.length) return
      const peak = current.reduce((a, b) =>
        kind === 'spike'
          ? b.price.dayAhead > a.price.dayAhead
            ? b
            : a
          : b.price.dayAhead < a.price.dayAhead
            ? b
            : a,
      )
      flags.push({
        kind,
        startHour: (current[0] as HourPoint).hour,
        endHour: (current[current.length - 1] as HourPoint).hour,
        peakHour: peak.hour,
        peakValue: peak.price.dayAhead,
      })
      current = []
    }
    for (const p of day) {
      if (priceClass(p) === kind) current.push(p)
      else flush()
    }
    flush()
  }
  return flags.sort((a, b) => a.startHour - b.startHour)
}

export function flagLabel(f: PriceFlag): string {
  const range =
    f.startHour === f.endHour
      ? formatHour(f.startHour)
      : `${formatHour(f.startHour)}–${formatHour(f.endHour)}`
  return f.kind === 'spike'
    ? `Price spike ${range} · peak ${formatPrice(f.peakValue)}`
    : `Negative prices ${range} · low ${formatPrice(f.peakValue)}`
}

export interface Correlation {
  signal: SignalKey
  label: string
  r: number
}

/** Correlation of the day-ahead price with each forecast fundamental over the whole 48 h window. */
export function priceCorrelations(dataset: MarketDataset, windowStart: number): Correlation[] {
  const pts = dataset.points.slice(windowStart)
  const prices = pts.map((p) => p.price.dayAhead)
  const items: [SignalKey, string][] = [
    ['netLoad', 'Net load'],
    ['demand', 'Demand'],
    ['wind', 'Wind'],
    ['solar', 'Solar'],
  ]
  return items
    .map(([signal, label]) => ({
      signal,
      label,
      r: pearson(
        prices,
        pts.map((p) => signalQuantity(p, signal).forecast),
      ),
    }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
}

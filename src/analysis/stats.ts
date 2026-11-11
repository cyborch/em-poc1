import type { HourPoint, MarketDataset, Quantity, SignalKey } from '../data/types'

export const VISIBLE_DAYS = [
  { date: '2026-03-17', weekday: 'Tue', label: 'Tue 17 Mar', relative: 'today' },
  { date: '2026-03-18', weekday: 'Wed', label: 'Wed 18 Mar', relative: 'tomorrow' },
] as const

export function formatDateLong(date: string): string {
  const d = VISIBLE_DAYS.find((x) => x.date === date)
  return d ? `${d.label} 2026` : date
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function formatPrice(v: number, withUnit = false): string {
  const r = Math.round(v)
  const s = r < 0 ? `−€${Math.abs(r)}` : `€${r}`
  return withUnit ? `${s}/MWh` : s
}

export function formatPower(mw: number, digits = 1): string {
  const abs = Math.abs(mw)
  const sign = mw < 0 ? '−' : ''
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(digits)} GW`
  return `${sign}${Math.round(abs)} MW`
}

export function formatSigned(v: number, fmt: (n: number) => string): string {
  if (Math.round(v) === 0 && Math.abs(v) < 1) return fmt(0)
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`
}

export function formatPct(p: number): string {
  const r = Math.round(p)
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}%`
}

export function pctChange(value: number, reference: number): number | null {
  if (Math.abs(reference) < 1e-6) return null
  return ((value - reference) / Math.abs(reference)) * 100
}

export type Level = 'typical' | 'moderate' | 'strong'

export function zScore(value: number, typical: { mean: number; sd: number }): number {
  return (value - typical.mean) / Math.max(typical.sd, 1e-6)
}

export function levelOf(z: number): Level {
  const a = Math.abs(z)
  if (a < 0.75) return 'typical'
  if (a < 1.5) return 'moderate'
  return 'strong'
}

/** The value shown for an hour: the observation when it exists, otherwise the forecast. */
export function valueOf(q: Quantity): number {
  return q.actual ?? q.forecast
}

export function netLoadQuantity(p: HourPoint): Quantity {
  const { demand: d, solar: s, wind: w } = p
  const complete = d.actual !== null && s.actual !== null && w.actual !== null
  return {
    forecast: d.forecast - s.forecast - w.forecast,
    actual: complete ? (d.actual as number) - (s.actual as number) - (w.actual as number) : null,
    range: null,
    typical: {
      mean: d.typical.mean - s.typical.mean - w.typical.mean,
      sd: Math.sqrt(d.typical.sd ** 2 + s.typical.sd ** 2 + w.typical.sd ** 2),
    },
  }
}

export function signalQuantity(p: HourPoint, key: SignalKey): Quantity {
  switch (key) {
    case 'price':
      return { forecast: p.price.dayAhead, actual: null, range: null, typical: p.price.typical }
    case 'solar':
      return p.solar
    case 'wind':
      return p.wind
    case 'demand':
      return p.demand
    case 'netLoad':
      return netLoadQuantity(p)
    case 'imports':
      return p.netImports
    case 'conventional':
      return p.conventional
  }
}

export interface SignalMeta {
  label: string
  question: string
  unit: 'MW' | 'EUR/MWh'
}

export const SIGNALS: Record<SignalKey, SignalMeta> = {
  price: { label: 'Day-ahead price', question: 'How unusual is this price?', unit: 'EUR/MWh' },
  solar: { label: 'Solar', question: 'Is solar unusually low or high for this hour?', unit: 'MW' },
  wind: { label: 'Wind', question: 'Is wind above or below what is normal?', unit: 'MW' },
  demand: { label: 'Demand', question: 'Is demand unusually high for this hour?', unit: 'MW' },
  netLoad: {
    label: 'Net load',
    question: 'How much must non-wind/solar supply cover?',
    unit: 'MW',
  },
  imports: {
    label: 'Net imports',
    question: 'Is there room to import or export more?',
    unit: 'MW',
  },
  conventional: {
    label: 'Conventional generation',
    question: 'How hard are dispatchable plants working?',
    unit: 'MW',
  },
}

export function formatValue(key: SignalKey, v: number): string {
  return key === 'price' ? formatPrice(v, true) : formatPower(v)
}

export function pointsForDate(dataset: MarketDataset, date: string): HourPoint[] {
  return dataset.points.filter((p) => p.date === date)
}

export function indexFor(dataset: MarketDataset, date: string, hour: number): number {
  const p = dataset.points.find((x) => x.date === date && x.hour === hour)
  return p ? p.index : 0
}

export function pearson(xs: number[], ys: number[]): number {
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx
    const dy = (ys[i] as number) - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy)
}

/**
 * Signed difference between a value and a reference. Percentages are only used for
 * strictly positive quantities; for flows, net load and prices an absolute difference is clearer.
 */
export function formatDelta(key: SignalKey, value: number, ref: number | null): string {
  if (ref === null) return '–'
  const diff = value - ref
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : ''
  if (key === 'price') return `${sign}${formatPrice(Math.abs(diff))}`
  const pc = pctChange(value, ref)
  const usePct = key !== 'imports' && key !== 'netLoad' && pc !== null && Math.abs(ref) >= 300
  return usePct ? formatPct(pc as number) : `${sign}${formatPower(Math.abs(diff))}`
}

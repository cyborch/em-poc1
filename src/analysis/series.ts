import type { HourPoint, MarketDataset, SignalKey } from '../data/types'
import { formatHour, signalQuantity, valueOf } from './stats'

export type Basis = 'previousHour' | 'previousDay' | 'typical'

export const BASIS_LABEL: Record<Basis, string> = {
  previousHour: 'Previous hour',
  previousDay: 'Same hour yesterday',
  typical: 'Typical for this hour',
}

export const BASIS_SHORT: Record<Basis, string> = {
  previousHour: 'prev. hour',
  previousDay: 'yesterday',
  typical: 'typical',
}

/** Chart-ready values for one signal and one hour. Power is in GW. */
export interface SignalRow {
  index: number
  hour: number
  label: string
  observed: boolean
  forecast: number
  actual: number | null
  range: [number, number] | null
  typical: number
  typicalBand: [number, number]
  previousDay: number
  previousHour: number
}

const GW = 1000

export function signalRows(dataset: MarketDataset, date: string, key: SignalKey): SignalRow[] {
  const pts = dataset.points
  return pts
    .filter((p) => p.date === date)
    .map((p) => {
      const q = signalQuantity(p, key)
      const prevD = pts[p.index - 24] as HourPoint
      const prevH = pts[p.index - 1] as HourPoint
      const nonNegative = key !== 'imports' && key !== 'price'
      const lo = q.typical.mean - q.typical.sd
      const hi = q.typical.mean + q.typical.sd
      return {
        index: p.index,
        hour: p.hour,
        label: formatHour(p.hour),
        observed: p.observed,
        forecast: q.forecast / GW,
        actual: q.actual === null ? null : q.actual / GW,
        range: q.range ? [q.range[0] / GW, q.range[1] / GW] : null,
        typical: q.typical.mean / GW,
        typicalBand: [(nonNegative ? Math.max(0, lo) : lo) / GW, hi / GW],
        previousDay: valueOf(signalQuantity(prevD, key)) / GW,
        previousHour: valueOf(signalQuantity(prevH, key)) / GW,
      }
    })
}

export interface PriceRow {
  index: number
  hour: number
  label: string
  price: number
  typical: number
  typicalBand: [number, number]
  previousDay: number
  previousHour: number
}

export function priceRows(dataset: MarketDataset, date: string): PriceRow[] {
  const pts = dataset.points
  return pts
    .filter((p) => p.date === date)
    .map((p) => ({
      index: p.index,
      hour: p.hour,
      label: formatHour(p.hour),
      price: p.price.dayAhead,
      typical: p.price.typical.mean,
      typicalBand: [p.price.typical.mean - p.price.typical.sd, p.price.typical.mean + p.price.typical.sd],
      previousDay: (pts[p.index - 24] as HourPoint).price.dayAhead,
      previousHour: (pts[p.index - 1] as HourPoint).price.dayAhead,
    }))
}

export interface FlowRow {
  index: number
  hour: number
  label: string
  observed: boolean
  net: number
  typicalNet: number
  typicalBand: [number, number]
  previousDay: number
  previousHour: number
  importAvailable: number
  exportAvailable: number
  importTypical: number
  exportTypical: number
  utilisation: number
}

export function flowRows(dataset: MarketDataset, date: string): FlowRow[] {
  const pts = dataset.points
  return pts
    .filter((p) => p.date === date)
    .map((p) => {
      const net = valueOf(p.netImports)
      const avail = net >= 0 ? p.capacity.importAvailable : p.capacity.exportAvailable
      return {
        index: p.index,
        hour: p.hour,
        label: formatHour(p.hour),
        observed: p.observed,
        net: net / GW,
        typicalNet: p.netImports.typical.mean / GW,
        typicalBand: [
          (p.netImports.typical.mean - p.netImports.typical.sd) / GW,
          (p.netImports.typical.mean + p.netImports.typical.sd) / GW,
        ],
        previousDay: valueOf((pts[p.index - 24] as HourPoint).netImports) / GW,
        previousHour: valueOf((pts[p.index - 1] as HourPoint).netImports) / GW,
        importAvailable: p.capacity.importAvailable / GW,
        exportAvailable: -p.capacity.exportAvailable / GW,
        importTypical: p.capacity.importTypical / GW,
        exportTypical: -p.capacity.exportTypical / GW,
        utilisation: avail > 0 ? Math.abs(net) / avail : 0,
      }
    })
}

export interface DeviationRow {
  index: number
  hour: number
  label: string
  observed: boolean
  /** actual − forecast, GW; null when no actual exists yet. */
  deviation: number | null
  /** P10–P90 expressed relative to the forecast, GW. */
  band: [number, number]
}

export function deviationRows(
  dataset: MarketDataset,
  date: string,
  key: 'wind' | 'solar' | 'demand',
): DeviationRow[] {
  return dataset.points
    .filter((p) => p.date === date)
    .map((p) => {
      const q = p[key]
      const range = q.range ?? [q.forecast, q.forecast]
      return {
        index: p.index,
        hour: p.hour,
        label: formatHour(p.hour),
        observed: p.observed,
        deviation: q.actual === null ? null : (q.actual - q.forecast) / GW,
        band: [(range[0] - q.forecast) / GW, (range[1] - q.forecast) / GW],
      }
    })
}

export function axisTicks(rows: { label: string; hour: number }[]): string[] {
  return rows.filter((r) => r.hour % 3 === 0).map((r) => r.label)
}

export function gwTick(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

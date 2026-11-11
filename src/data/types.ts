/**
 * Dataset schema. All power values are MW, all prices EUR/MWh.
 * Every value in the dataset is SYNTHETIC and illustrative.
 */

export type MarketId = 'DE' | 'DK1' | 'FR'

export interface Typical {
  mean: number
  sd: number
}

/** One physical quantity for one hour. */
export interface Quantity {
  /** Day-ahead forecast (for conventional/net imports: the day-ahead schedule). */
  forecast: number
  /** Observed value. `null` while the hour is still in the future. */
  actual: number | null
  /** P10–P90 interval of the forecast, where a forecast distribution is modelled. */
  range: [number, number] | null
  /** Synthetic climatology for this hour of day (mean and standard deviation). */
  typical: Typical
}

export interface HourPoint {
  /** Position in the dataset: 0–23 is the lookback day, 24–71 is the visible 48 h window. */
  index: number
  /** ISO 8601 with a fixed +01:00 offset (CET). */
  timestamp: string
  /** Local calendar date, YYYY-MM-DD. */
  date: string
  /** Local hour of day, 0–23. */
  hour: number
  /** True when actuals exist for this hour (it lies before the dataset's as-of time). */
  observed: boolean
  /** Cleared day-ahead price. */
  price: { dayAhead: number; typical: Typical }
  solar: Quantity
  wind: Quantity
  conventional: Quantity
  demand: Quantity
  /** Positive = importing, negative = exporting. */
  netImports: Quantity
  /** Day-ahead available cross-border capacity, both directions, as positive MW. */
  capacity: {
    importAvailable: number
    exportAvailable: number
    importTypical: number
    exportTypical: number
  }
  /** Renewable output that had to be curtailed to keep the system balanced (already deducted from solar/wind). */
  curtailed: number
}

export interface MarketMeta {
  id: MarketId
  name: string
  shortName: string
  biddingZone: string
  /** Largest dispatchable output available in this market. */
  conventionalMax: number
  /** Must-run floor of dispatchable output. */
  conventionalMin: number
}

export interface MarketDataset {
  market: MarketMeta
  timezone: string
  /** Moment the dataset was "taken": actuals exist strictly before this. */
  asOf: string
  asOfIndex: number
  points: HourPoint[]
}

export type SignalKey = 'price' | 'solar' | 'wind' | 'demand' | 'netLoad' | 'imports' | 'conventional'

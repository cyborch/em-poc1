import type { MarketMeta } from './types'

/**
 * Designed inputs for the synthetic markets. Absolute hour `t` counts from
 * 2026-03-16 00:00 CET: day 0 is a lookback day, day 1 (Tue 17 Mar) and day 2
 * (Wed 18 Mar) are the visible 48 h window.
 */
export interface Effect {
  target: 'demand' | 'neighbourPrice' | 'importCap' | 'exportCap' | 'windActual'
  from: number
  to: number
  /** Hours over which the effect ramps in and out. */
  ramp: number
  /** Multiplicative change at full strength (1 = none). */
  factor?: number
  /** Additive change at full strength. */
  add?: number
  note: string
}

export interface MarketConfig {
  meta: MarketMeta
  /** Typical weekday demand by local hour. */
  demandProfile: number[]
  solarPeak: number
  sunrise: number
  daylight: number
  typicalCloud: number
  windTypical: number
  /** Wind forecast control points every 3 h from t=0 to t=72 (25 values), cosine-interpolated. */
  windCP: number[]
  /** Solar clearness control points, same grid. */
  cloudCP: number[]
  /** Price in coupled neighbouring markets by local hour. */
  neighbourProfile: number[]
  /** Sensitivity of the neighbour price to this market's net-load anomaly. */
  kappa: number
  regionalScale: number
  /** Supply curve of dispatchable generation: [MW, EUR/MWh]. */
  merit: [number, number][]
  importCap: number
  exportCap: number
  /** EUR/MWh price drop per GW of surplus that can neither be used, stored nor exported. */
  surplusSlope: number
  effects: Effect[]
}

export const T = (day: number, hour: number) => day * 24 + hour

export const MARKETS: Record<string, MarketConfig> = {
  DE: {
    meta: {
      id: 'DE',
      name: 'Germany',
      shortName: 'DE',
      biddingZone: 'DE-LU',
      conventionalMin: 9000,
      conventionalMax: 62000,
    },
    demandProfile: [
      49000, 47500, 46500, 46000, 47000, 51000, 58000, 64000, 66000, 66000, 65500, 65000, 64000, 63500, 63000,
      63000, 63500, 65500, 67500, 67000, 64000, 59000, 54000, 51000,
    ],
    solarPeak: 42000,
    sunrise: 6.0,
    daylight: 12.7,
    typicalCloud: 0.55,
    windTypical: 17000,
    windCP: [
      15, 15, 16, 16, 14, 13, 12, 12, 13, 14, 18, 19, 17, 14, 11, 9, 8, 12, 15, 22, 31, 25, 8, 8, 6,
    ].map((v) => v * 1000),
    cloudCP: [
      0.5, 0.5, 0.55, 0.6, 0.55, 0.5, 0.45, 0.5, 0.5, 0.5, 0.6, 0.7, 0.75, 0.65, 0.6, 0.6, 0.6, 0.6, 0.75,
      0.95, 0.98, 0.8, 0.7, 0.8, 0.8,
    ],
    neighbourProfile: [
      70, 66, 64, 63, 66, 76, 96, 106, 100, 86, 74, 64, 58, 56, 60, 70, 86, 100, 104, 98, 88, 80, 76, 72,
    ],
    kappa: 1.5,
    regionalScale: 60000,
    merit: [
      [9000, 5],
      [18000, 52],
      [30000, 80],
      [42000, 100],
      [50000, 128],
      [56000, 175],
      [62000, 260],
    ],
    importCap: 11000,
    exportCap: 14000,
    surplusSlope: 4,
    effects: [
      {
        target: 'windActual',
        from: T(1, 5),
        to: T(1, 11),
        ramp: 1.5,
        factor: 0.58,
        note: 'Wind forecast error: the forecast windy morning does not materialise.',
      },
      {
        target: 'neighbourPrice',
        from: T(2, 10),
        to: T(2, 16),
        ramp: 2,
        add: -25,
        note: 'Solar glut in coupled neighbouring markets.',
      },
      {
        target: 'demand',
        from: T(2, 17),
        to: T(2, 18),
        ramp: 1.5,
        factor: 1.01,
        note: 'Colder evening lifts demand slightly.',
      },
      {
        target: 'importCap',
        from: T(2, 17),
        to: T(2, 18),
        ramp: 1.5,
        factor: 0.7362,
        note: 'Planned grid maintenance reduces available import capacity in the evening.',
      },
    ],
  },
  DK1: {
    meta: {
      id: 'DK1',
      name: 'Denmark DK1',
      shortName: 'DK1',
      biddingZone: 'DK1',
      conventionalMin: 250,
      conventionalMax: 2600,
    },
    demandProfile: [
      1550, 1500, 1480, 1500, 1580, 1750, 2050, 2300, 2350, 2300, 2250, 2200, 2200, 2200, 2200, 2250, 2350,
      2550, 2600, 2500, 2300, 2050, 1800, 1650,
    ],
    solarPeak: 1200,
    sunrise: 6.1,
    daylight: 12.4,
    typicalCloud: 0.5,
    windTypical: 2200,
    windCP: [
      2.5, 2.8, 3.0, 2.6, 2.2, 2.0, 1.8, 2.0, 2.2, 2.4, 2.6, 3.2, 3.6, 3.8, 3.4, 3.0, 2.6, 2.0, 1.6, 1.4, 1.2,
      1.2, 1.4, 1.5, 1.6,
    ].map((v) => v * 1000),
    cloudCP: [
      0.45, 0.45, 0.5, 0.55, 0.5, 0.45, 0.45, 0.5, 0.5, 0.5, 0.55, 0.6, 0.65, 0.6, 0.55, 0.55, 0.55, 0.55,
      0.7, 0.85, 0.9, 0.85, 0.8, 0.75, 0.75,
    ],
    neighbourProfile: [
      58, 55, 53, 52, 55, 66, 84, 98, 95, 82, 70, 60, 52, 50, 52, 60, 78, 96, 100, 96, 88, 78, 68, 62,
    ],
    kappa: 0.9,
    regionalScale: 6000,
    merit: [
      [250, 2],
      [800, 62],
      [1400, 92],
      [2000, 128],
      [2400, 190],
      [2600, 280],
    ],
    importCap: 5500,
    exportCap: 6200,
    surplusSlope: 25,
    effects: [
      {
        target: 'exportCap',
        from: T(1, 13),
        to: T(1, 20),
        ramp: 1,
        factor: 0.35,
        note: 'Interconnector constraint: export capacity towards Germany is cut by an outage.',
      },
    ],
  },
  FR: {
    meta: {
      id: 'FR',
      name: 'France',
      shortName: 'FR',
      biddingZone: 'FR',
      conventionalMin: 28000,
      conventionalMax: 66000,
    },
    demandProfile: [
      47000, 45500, 44500, 44000, 45000, 48500, 54000, 60000, 63000, 62000, 60000, 58500, 57000, 56000, 55500,
      55500, 56500, 59000, 62000, 63000, 60500, 57000, 53000, 50000,
    ],
    solarPeak: 14000,
    sunrise: 6.2,
    daylight: 12.4,
    typicalCloud: 0.6,
    windTypical: 6500,
    windCP: [6, 6, 7, 7, 6, 5, 5, 5, 5, 5, 4, 4, 4, 5, 6, 7, 8, 9, 9, 8, 7, 6, 5, 5, 5].map((v) => v * 1000),
    cloudCP: [
      0.6, 0.6, 0.65, 0.7, 0.65, 0.6, 0.55, 0.55, 0.6, 0.6, 0.7, 0.8, 0.8, 0.75, 0.7, 0.7, 0.7, 0.7, 0.8, 0.9,
      0.9, 0.85, 0.8, 0.8, 0.8,
    ],
    neighbourProfile: [
      62, 59, 57, 56, 58, 68, 86, 100, 96, 80, 66, 58, 52, 50, 52, 60, 80, 98, 102, 98, 92, 84, 75, 68,
    ],
    kappa: 1.2,
    regionalScale: 55000,
    merit: [
      [28000, 6],
      [36000, 40],
      [44000, 62],
      [52000, 88],
      [58000, 130],
      [62000, 190],
      [66000, 300],
    ],
    importCap: 15000,
    exportCap: 18000,
    surplusSlope: 3,
    effects: [
      {
        target: 'demand',
        from: T(2, 6),
        to: T(2, 10),
        ramp: 1.5,
        factor: 1.11,
        note: 'Cold snap: electric heating lifts morning demand well above normal.',
      },
      {
        target: 'neighbourPrice',
        from: T(2, 6),
        to: T(2, 10),
        ramp: 1.5,
        add: 28,
        note: 'The same cold snap lifts prices in coupled neighbouring markets.',
      },
    ],
  },
}

export const MARKET_ORDER = ['DE', 'DK1', 'FR'] as const

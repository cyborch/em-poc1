import { MARKETS, MARKET_ORDER, type Effect, type MarketConfig, T } from './markets'
import type { HourPoint, MarketDataset, MarketId, Quantity, Typical } from './types'

/**
 * Deterministic synthetic market model. No Math.random, no Date, no system timezone:
 * the same dataset is produced on every machine on every day.
 *
 * Pipeline per market and hour (see DATA_ASSUMPTIONS.md):
 *  1. designed weather/demand inputs (control points + scenario effects)
 *  2. a small day-ahead market clearing model turns them into price, flows and dispatch
 *  3. for hours before the as-of time, "actuals" are derived from the forecasts
 */

export const TIMEZONE = 'Europe/Berlin'
/** Fixed offset: CET (UTC+1). Daylight saving starts on 29 Mar 2026, outside the dataset. */
const UTC_OFFSET = '+01:00'
const DAY_DATES = ['2026-03-16', '2026-03-17', '2026-03-18']
/** Actuals exist for all hours before 2026-03-17 13:00 CET. */
export const AS_OF_INDEX = T(1, 13)
export const AS_OF_ISO = `2026-03-17T13:00:00${UTC_OFFSET}`
/** First index of the visible 48 h window (day 0 is lookback only). */
export const WINDOW_START = 24
export const TOTAL_HOURS = 72

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const roundTo = (v: number, step: number) => Math.round(v / step) * step

function hashNoise(a: number, b: number, c: number): number {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return ((h >>> 0) / 4294967295) * 2 - 1
}

/** Noise in [-1, 1] that varies smoothly over time (cosine-interpolated every 2 h). */
function smoothNoise(seed: number, channel: number, t: number): number {
  const i = Math.floor(t / 2)
  const f = (t - i * 2) / 2
  const s = (1 - Math.cos(Math.PI * f)) / 2
  return hashNoise(seed, channel, i) * (1 - s) + hashNoise(seed, channel, i + 1) * s
}

function cosInterp(cp: number[], t: number, step = 3): number {
  const i = clamp(Math.floor(t / step), 0, cp.length - 2)
  const f = clamp((t - i * step) / step, 0, 1)
  const s = (1 - Math.cos(Math.PI * f)) / 2
  return (cp[i] as number) * (1 - s) + (cp[i + 1] as number) * s
}

/** Trapezoid window: 1 inside [from, to], linear ramps of `ramp` hours outside. */
function windowWeight(t: number, from: number, to: number, ramp: number): number {
  if (t >= from && t <= to) return 1
  if (t < from) return clamp(1 - (from - t) / ramp, 0, 1)
  return clamp(1 - (t - to) / ramp, 0, 1)
}

function applyEffects(base: number, effects: Effect[], target: Effect['target'], t: number): number {
  let v = base
  for (const e of effects) {
    if (e.target !== target) continue
    const w = windowWeight(t, e.from, e.to, e.ramp)
    if (w === 0) continue
    if (e.factor !== undefined) v *= 1 + (e.factor - 1) * w
    if (e.add !== undefined) v += e.add * w
  }
  return v
}

function clearSky(cfg: MarketConfig, hour: number): number {
  const x = (hour + 0.5 - cfg.sunrise) / cfg.daylight
  if (x <= 0 || x >= 1) return 0
  return Math.pow(Math.sin(Math.PI * x), 1.2)
}

function meritPrice(merit: [number, number][], mw: number): number {
  const first = merit[0] as [number, number]
  const last = merit[merit.length - 1] as [number, number]
  if (mw <= first[0]) return first[1]
  if (mw >= last[0]) return last[1]
  for (let i = 1; i < merit.length; i++) {
    const [x1, y1] = merit[i] as [number, number]
    const [x0, y0] = merit[i - 1] as [number, number]
    if (mw <= x1) return y0 + ((mw - x0) / (x1 - x0)) * (y1 - y0)
  }
  return last[1]
}

function inverseMerit(merit: [number, number][], price: number): number {
  const first = merit[0] as [number, number]
  const last = merit[merit.length - 1] as [number, number]
  if (price <= first[1]) return first[0]
  if (price >= last[1]) return last[0]
  for (let i = 1; i < merit.length; i++) {
    const [x1, y1] = merit[i] as [number, number]
    const [x0, y0] = merit[i - 1] as [number, number]
    if (price <= y1) return x0 + ((price - y0) / (y1 - y0)) * (x1 - x0)
  }
  return last[0]
}

interface ClearingInput {
  hour: number
  demand: number
  solar: number
  wind: number
  importCap: number
  exportCap: number
  neighbourBase: number
  neighbourShift: number
}

interface ClearingResult {
  price: number
  conventional: number
  netImports: number
  curtailed: number
  solar: number
  wind: number
}

/**
 * Day-ahead clearing in one zone coupled to a neighbouring price:
 *  - The zone trades with its neighbours until its marginal dispatchable plant costs the same
 *    as the neighbour price, or the interconnector is full.
 *  - Neighbour prices co-move with this zone's net-load anomaly (weather is regionally correlated).
 *  - If the interconnector is full, the local price separates from the neighbour price.
 *  - If dispatchable output would fall below its must-run floor, renewables are curtailed and
 *    the price turns negative.
 */
function clearMarket(cfg: MarketConfig, typicalNetLoad: number, inp: ClearingInput): ClearingResult {
  const { merit } = cfg
  const convMin = cfg.meta.conventionalMin
  let solar = inp.solar
  let wind = inp.wind
  const netLoad = inp.demand - solar - wind
  const anomaly = netLoad - typicalNetLoad
  const multiplier = clamp(1 + (cfg.kappa * anomaly) / cfg.regionalScale, 0.3, 2.2)
  const neighbourPrice = inp.neighbourBase * multiplier + inp.neighbourShift

  const convTarget = inverseMerit(merit, neighbourPrice)
  const wanted = netLoad - convTarget
  let netImports = clamp(wanted, -inp.exportCap, inp.importCap)
  const saturated = netImports !== wanted
  let conventional = netLoad - netImports
  let curtailed = 0
  let price = saturated ? meritPrice(merit, conventional) : neighbourPrice

  if (conventional < convMin) {
    // Exports are full and dispatchable plant is at its floor: curtail wind first, then solar.
    curtailed = convMin - conventional
    const windCut = Math.min(wind, curtailed)
    wind -= windCut
    solar -= Math.min(solar, curtailed - windCut)
    conventional = convMin
    price = meritPrice(merit, convMin) - (cfg.surplusSlope * curtailed) / 1000
  }
  price = clamp(price, -80, 400)
  netImports = inp.demand - solar - wind - conventional
  return { price, conventional, netImports, curtailed, solar, wind }
}

interface HourInputs {
  demand: number
  solar: number
  wind: number
  importCap: number
  exportCap: number
  neighbourBase: number
  neighbourShift: number
}

function forecastInputs(cfg: MarketConfig, seed: number, t: number): HourInputs {
  const hour = t % 24
  const demand = (cfg.demandProfile[hour] as number) * (1 + 0.012 * smoothNoise(seed, 1, t)) // forecast demand
  return {
    demand: applyEffects(demand, cfg.effects, 'demand', t),
    solar:
      cfg.solarPeak *
      clamp(cosInterp(cfg.cloudCP, t), 0, 1) *
      clearSky(cfg, hour) *
      (1 + 0.03 * smoothNoise(seed, 2, t)),
    wind: Math.max(0, cosInterp(cfg.windCP, t) * (1 + 0.04 * smoothNoise(seed, 3, t))),
    importCap: applyEffects(cfg.importCap, cfg.effects, 'importCap', t),
    exportCap: applyEffects(cfg.exportCap, cfg.effects, 'exportCap', t),
    neighbourBase: cfg.neighbourProfile[hour] as number,
    neighbourShift: applyEffects(0, cfg.effects, 'neighbourPrice', t),
  }
}

function typicalHour(cfg: MarketConfig, hour: number) {
  const solar = cfg.solarPeak * cfg.typicalCloud * clearSky(cfg, hour)
  const wind = cfg.windTypical
  const demand = cfg.demandProfile[hour] as number
  const typicalNetLoad = demand - solar - wind
  const result = clearMarket(cfg, typicalNetLoad, {
    hour,
    demand,
    solar,
    wind,
    importCap: cfg.importCap,
    exportCap: cfg.exportCap,
    neighbourBase: cfg.neighbourProfile[hour] as number,
    neighbourShift: 0,
  })
  return { ...result, solar, wind, demand }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function buildMarket(id: MarketId): MarketDataset {
  const cfg = MARKETS[id] as MarketConfig
  const seed = MARKET_ORDER.indexOf(id) + 11
  const typical = Array.from({ length: 24 }, (_, h) => typicalHour(cfg, h))
  const convMax = cfg.meta.conventionalMax

  const points: HourPoint[] = []
  for (let t = 0; t < TOTAL_HOURS; t++) {
    const hour = t % 24
    const day = Math.floor(t / 24)
    const typ = typical[hour] as ReturnType<typeof typicalHour>
    const typicalNetLoad = typ.demand - typ.solar - typ.wind
    const inp = forecastInputs(cfg, seed, t)
    const res = clearMarket(cfg, typicalNetLoad, { hour, ...inp })

    const demandF = roundTo(inp.demand, 10)
    const solarF = roundTo(res.solar, 10)
    const windF = roundTo(res.wind, 10)
    const importsF = roundTo(res.netImports, 10)
    const convF = demandF - solarF - windF - importsF
    const observed = t < AS_OF_INDEX

    let demandA: number | null = null
    let solarA: number | null = null
    let windA: number | null = null
    let importsA: number | null = null
    let convA: number | null = null
    if (observed) {
      demandA = roundTo(demandF * (1 + 0.012 * smoothNoise(seed, 4, t)), 10)
      solarA = roundTo(solarF * (1 + 0.07 * smoothNoise(seed, 5, t)), 10)
      const windErr = applyEffects(1, cfg.effects, 'windActual', t)
      windA = roundTo(windF * windErr * (1 + 0.05 * smoothNoise(seed, 6, t)), 10)
      importsA = roundTo(
        clamp(importsF + 0.03 * inp.importCap * smoothNoise(seed, 7, t), -inp.exportCap, inp.importCap),
        10,
      )
      convA = demandA - solarA - windA - importsA
    }

    const sdSolar = 0.3 * typ.solar + 0.02 * cfg.solarPeak
    const q = (
      forecast: number,
      actual: number | null,
      range: [number, number] | null,
      typ: Typical,
    ): Quantity => ({ forecast, actual, range, typical: typ })

    const windHalf = 0.25 * windF + 0.04 * cfg.windTypical
    const point: HourPoint = {
      index: t,
      timestamp: `${DAY_DATES[day]}T${pad(hour)}:00:00${UTC_OFFSET}`,
      date: DAY_DATES[day] as string,
      hour,
      observed,
      price: {
        dayAhead: Math.round(res.price * 10) / 10,
        typical: { mean: Math.round(typ.price * 10) / 10, sd: 0.16 * Math.abs(typ.price) + 7 },
      },
      solar: q(solarF, solarA, [Math.max(0, roundTo(solarF * 0.84, 10)), roundTo(solarF * 1.16, 10)], {
        mean: roundTo(typ.solar, 10),
        sd: sdSolar,
      }),
      wind: q(windF, windA, [Math.max(0, roundTo(windF - windHalf, 10)), roundTo(windF + windHalf, 10)], {
        mean: roundTo(typ.wind, 10),
        sd: 0.55 * cfg.windTypical,
      }),
      conventional: q(convF, convA, null, { mean: roundTo(typ.conventional, 10), sd: 0.1 * convMax }),
      demand: q(demandF, demandA, [roundTo(demandF * 0.976, 10), roundTo(demandF * 1.024, 10)], {
        mean: roundTo(typ.demand, 10),
        sd: 0.045 * typ.demand,
      }),
      netImports: q(importsF, importsA, null, {
        mean: roundTo(typ.netImports, 10),
        sd: 0.2 * cfg.importCap,
      }),
      capacity: {
        importAvailable: roundTo(inp.importCap, 10),
        exportAvailable: roundTo(inp.exportCap, 10),
        importTypical: cfg.importCap,
        exportTypical: cfg.exportCap,
      },
      curtailed: roundTo(res.curtailed, 10),
    }
    points.push(point)
  }

  return {
    market: cfg.meta,
    timezone: TIMEZONE,
    asOf: AS_OF_ISO,
    asOfIndex: AS_OF_INDEX,
    points,
  }
}

export function generateDatasets(): Record<MarketId, MarketDataset> {
  return {
    DE: buildMarket('DE'),
    DK1: buildMarket('DK1'),
    FR: buildMarket('FR'),
  }
}

export const datasets = generateDatasets()

import { describe, expect, it } from 'vitest'
import { AS_OF_INDEX, generateDatasets } from './generate'
import { datasets } from './generate'
import type { HourPoint, MarketId } from './types'

const ids: MarketId[] = ['DE', 'DK1', 'FR']
const at = (id: MarketId, date: string, hour: number): HourPoint =>
  datasets[id].points.find((p) => p.date === date && p.hour === hour) as HourPoint

describe('synthetic dataset', () => {
  it('is deterministic', () => {
    expect(generateDatasets()).toEqual(generateDatasets())
  })

  it.each(ids)('%s: covers a lookback day plus 48 consecutive hourly steps in fixed CET', (id) => {
    const pts = datasets[id].points
    expect(pts).toHaveLength(72)
    pts.forEach((p, i) => {
      expect(p.index).toBe(i)
      expect(p.timestamp).toMatch(/^2026-03-1[678]T\d\d:00:00\+01:00$/)
      expect(p.hour).toBe(i % 24)
    })
    expect(pts[24]?.timestamp).toBe('2026-03-17T00:00:00+01:00')
    expect(pts[71]?.timestamp).toBe('2026-03-18T23:00:00+01:00')
  })

  it.each(ids)('%s: energy balance holds and flows respect capacity', (id) => {
    for (const p of datasets[id].points) {
      const forecast = p.solar.forecast + p.wind.forecast + p.conventional.forecast + p.netImports.forecast
      expect(Math.abs(forecast - p.demand.forecast)).toBeLessThanOrEqual(10)
      expect(p.netImports.forecast).toBeLessThanOrEqual(p.capacity.importAvailable + 10)
      expect(-p.netImports.forecast).toBeLessThanOrEqual(p.capacity.exportAvailable + 10)
      expect(p.solar.forecast).toBeGreaterThanOrEqual(0)
      expect(p.wind.forecast).toBeGreaterThanOrEqual(0)
      expect(p.conventional.forecast).toBeLessThanOrEqual(datasets[id].market.conventionalMax)
      if (p.solar.actual !== null) {
        const actual =
          (p.solar.actual as number) +
          (p.wind.actual as number) +
          (p.conventional.actual as number) +
          (p.netImports.actual as number)
        expect(Math.abs(actual - (p.demand.actual as number))).toBeLessThanOrEqual(10)
      }
    }
  })

  it.each(ids)('%s: actuals exist only before the as-of time', (id) => {
    for (const p of datasets[id].points) {
      const hasActuals = [p.solar, p.wind, p.demand, p.netImports, p.conventional].map(
        (q) => q.actual !== null,
      )
      expect(new Set(hasActuals).size).toBe(1)
      expect(hasActuals[0]).toBe(p.index < AS_OF_INDEX)
      expect(p.observed).toBe(p.index < AS_OF_INDEX)
    }
  })

  it('has no solar at night', () => {
    for (const id of ids) {
      expect(at(id, '2026-03-18', 2).solar.forecast).toBe(0)
      expect(at(id, '2026-03-18', 23).solar.forecast).toBe(0)
    }
  })

  describe('designed scenarios', () => {
    it('1. Germany tomorrow 18:00 is the evening spike at €145 with nearly saturated imports', () => {
      const p = at('DE', '2026-03-18', 18)
      expect(p.price.dayAhead).toBe(145)
      const day = datasets.DE.points.filter((x) => x.date === '2026-03-18')
      expect(Math.max(...day.map((x) => x.price.dayAhead))).toBe(145)
      expect(p.solar.forecast).toBeLessThan(0.05 * 42000)
      expect(p.wind.forecast).toBeLessThan(0.6 * p.wind.typical.mean)
      expect(p.netImports.forecast / p.capacity.importAvailable).toBeGreaterThan(0.95)
      expect(p.capacity.importAvailable).toBeLessThan(0.85 * p.capacity.importTypical)
    })

    it('2. Germany has negative midday prices on 18 Mar with high renewables and low net load', () => {
      for (const h of [11, 12, 13]) {
        const p = at('DE', '2026-03-18', h)
        expect(p.price.dayAhead).toBeLessThan(0)
        expect(p.solar.forecast + p.wind.forecast).toBeGreaterThan(0.9 * p.demand.forecast)
      }
    })

    it('3. Germany wind forecast error on 17 Mar morning falls outside the forecast range', () => {
      for (const h of [6, 7, 8, 9, 10]) {
        const p = at('DE', '2026-03-17', h)
        expect(p.observed).toBe(true)
        expect(p.wind.actual as number).toBeLessThan((p.wind.range as [number, number])[0])
      }
    })

    it('4. France has unusually high demand on the 18 Mar morning', () => {
      const p = at('FR', '2026-03-18', 8)
      expect(p.demand.forecast).toBeGreaterThan(1.08 * p.demand.typical.mean)
      expect(p.price.dayAhead).toBeGreaterThan(p.price.typical.mean + p.price.typical.sd)
    })

    it('5. DK1 export capacity is cut on 17 Mar afternoon and the price decouples downwards', () => {
      const p = at('DK1', '2026-03-17', 14)
      expect(p.capacity.exportAvailable).toBeLessThan(0.5 * p.capacity.exportTypical)
      expect(-p.netImports.forecast / p.capacity.exportAvailable).toBeGreaterThan(0.95)
      expect(p.price.dayAhead).toBeLessThan(0)
      expect(at('DK1', '2026-03-17', 10).price.dayAhead).toBeGreaterThan(30)
    })
  })
})

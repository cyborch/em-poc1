import { describe, expect, it } from 'vitest'
import { datasets } from '../data/generate'
import { indexFor, pointsForDate } from './stats'
import { buildHypothesis, buildObservations, compareSignal, priceFlags } from './investigation'

const de = datasets.DE
const spike = indexFor(de, '2026-03-18', 18)

describe('investigation analysis', () => {
  it('flags the spike and the negative period for Germany on 18 Mar', () => {
    const flags = priceFlags(pointsForDate(de, '2026-03-18'))
    const s = flags.find((f) => f.kind === 'spike')
    const n = flags.find((f) => f.kind === 'negative')
    expect(s?.peakHour).toBe(18)
    expect(s?.peakValue).toBe(145)
    expect(n && n.startHour <= 12 && n.endHour >= 12).toBe(true)
  })

  it('marks the default price as well above typical', () => {
    const c = compareSignal(de, spike, 'price')
    expect(c.level).toBe('strong')
    expect(c.z).toBeGreaterThan(1.5)
    expect(c.previousHour).toBeLessThan(c.value)
  })

  it('surfaces solar, imports, wind and demand/net load as leads for the default hour', () => {
    const notable = buildObservations(de, spike)
      .filter((o) => o.notable)
      .map((o) => o.signal)
    expect(notable).toEqual(expect.arrayContaining(['solar', 'imports', 'wind', 'netLoad']))
    expect(notable).toContain('demand')
  })

  it('labels future hours as forecasts, never observations', () => {
    expect(buildObservations(de, spike).every((o) => o.evidence === 'forecast')).toBe(true)
  })

  it('reports an observed forecast deviation for the wind miss', () => {
    const obs = buildObservations(de, indexFor(de, '2026-03-17', 8))
    const dev = obs.find((o) => o.id === 'deviation-wind')
    expect(dev?.evidence).toBe('observed')
    expect(dev?.pressure).toBe('up')
  })

  it('only offers a hypothesis when several fundamentals agree', () => {
    const obs = buildObservations(de, spike)
    const h = buildHypothesis(obs, compareSignal(de, spike, 'price').z, 145)
    expect(h?.drivers.length).toBeGreaterThanOrEqual(2)
    expect(buildHypothesis(obs, 0.1, 100)).toBeNull()
  })
})

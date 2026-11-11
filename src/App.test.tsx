import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

const TESTIDS = [
  'price-chart',
  'chart-solar',
  'chart-wind',
  'chart-demand',
  'chart-flows',
  'chart-mix',
  'chart-deviation',
  'investigation-panel',
]

function selectedHours(): string[] {
  return TESTIDS.map((id) => screen.getByTestId(id).getAttribute('data-selected-hour') as string)
}

describe('Price Formation Explorer', () => {
  it('opens on Germany tomorrow 18:00 at €145/MWh with every view on the same hour', () => {
    render(<App />)
    expect(screen.getByTestId('question').textContent).toContain('€145/MWh in Germany tomorrow at 18:00')
    expect(screen.getByTestId('panel-price').textContent).toContain('€145')
    expect(new Set(selectedHours())).toEqual(new Set(['66']))
    expect(screen.getAllByText(/Illustrative synthetic data/).length).toBeGreaterThan(0)
  })

  it('updates every dependent view when a flagged period is selected', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Negative prices 11:00/ }))
    const hours = selectedHours()
    expect(new Set(hours).size).toBe(1)
    expect(hours[0]).toBe('60')
    expect(screen.getByTestId('panel-title').textContent).toContain('12:00')
    expect(screen.getByTestId('panel-price').textContent).toContain('−€12')
    expect(screen.getByTestId('panel-verdict').textContent).toBe('Negative price')
    expect(screen.getByTestId('question').textContent).toContain('at 12:00')
    expect(screen.getByTestId('reading-solar').textContent).toContain('42.2 GW')
  })

  it('steps through hours with the arrow keys and across the date boundary', () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(new Set(selectedHours())).toEqual(new Set(['67']))
    expect(screen.getByTestId('panel-title').textContent).toContain('19:00')
    fireEvent.click(screen.getByRole('button', { name: 'Tue 17 Mar' }))
    expect(new Set(selectedHours())).toEqual(new Set(['43']))
    expect(screen.getByTestId('panel-title').textContent).toContain('Tue 17 Mar 2026, 19:00')
  })

  it('shows observed values for past hours and forecasts for future hours', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Tue 17 Mar' }))
    for (let i = 0; i < 12; i++) fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByTestId('panel-title').textContent).toContain('06:00')
    expect(screen.getByTestId('reading-wind').parentElement?.textContent).toContain('observed')
    for (let i = 0; i < 12; i++) fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByTestId('reading-wind').parentElement?.textContent).toContain('forecast')
  })

  it('drills into a signal from an observation and highlights its chart', () => {
    render(<App />)
    expect(screen.getByTestId('chart-solar').getAttribute('data-focused')).toBe('false')
    fireEvent.click(screen.getByTestId('observation-imports'))
    expect(screen.getByTestId('chart-flows').getAttribute('data-focused')).toBe('true')
    const detail = screen.getByTestId('signal-detail')
    expect(detail.getAttribute('data-signal')).toBe('imports')
    expect(within(detail).getByText(/Same hour yesterday/)).toBeTruthy()
    fireEvent.click(screen.getByTestId('chart-wind').querySelector('button') as HTMLElement)
    expect(screen.getByTestId('signal-detail').getAttribute('data-signal')).toBe('wind')
    expect(screen.getByTestId('deviation-summary').textContent).toContain('Actual not yet available')
  })

  it('keeps the hour when switching market and re-flags periods for that market', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'France' }))
    expect(screen.getByTestId('question').textContent).toContain('in France tomorrow at 18:00')
    expect(new Set(selectedHours())).toEqual(new Set(['66']))
    expect(screen.getByRole('button', { name: /Price spike 06:00/ })).toBeTruthy()
  })

  it('switches the comparison basis', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Same hour yesterday' }))
    expect(screen.getByRole('button', { name: 'Same hour yesterday' }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(screen.getByTestId('reading-solar').parentElement?.textContent).toContain('vs yesterday')
  })
})

import { describe, it, expect } from 'vitest'
import { buildScreenSvg } from '../../server/utils/eink/layout.js'

const inverter = {
  pv_power: '1789.5',
  power_consumption: 202.8,
  grid_consumption: 0,
  grid_feedin: 60.2,
  battery_state_of_charge: '49.1',
  battery_power: 418.5,
}

const days = [
  {
    day: 'Heute',
    date: '29. Juli',
    events: [
      { summary: 'Team Meeting', start_time: '09:00', all_day: false, name: 'Work' },
      { summary: 'Zoo & Aquarium <Besuch>', start_time: '00:00', all_day: true, name: 'Family' },
    ],
  },
]

describe('buildScreenSvg', () => {
  it('renders clock, date, events and inverter values', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch, 29. Juli', days, inverter })
    expect(svg).toContain('12:34')
    expect(svg).toContain('Team Meeting')
    expect(svg).toContain('1,79 kW')
    expect(svg).toContain('Einspeisung')
    expect(svg).toContain('49 %')
    expect(svg).toMatch(/^<svg[^>]*width="800" height="480"/)
  })

  it('escapes XML special characters in event summaries', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter })
    expect(svg).toContain('Zoo &amp; Aquarium &lt;Besuch&gt;')
    expect(svg).not.toContain('<Besuch>')
  })

  it('renders fallbacks when data is unavailable', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days: null, inverter: null })
    expect(svg).toContain('Keine Termine')
    expect(svg).toContain('Keine Daten')
  })
})

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

  it('truncates a long event summary with a trailing ellipsis', () => {
    const longSummary = 'This is a very long event summary that exceeds the limit'
    const longDays = [
      {
        day: 'Heute',
        date: '29. Juli',
        events: [{ summary: longSummary, start_time: '09:00', all_day: false, name: 'Work' }],
      },
    ]
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days: longDays, inverter })
    expect(svg).not.toContain(longSummary)
    expect(svg).toContain('…')
  })

  it('truncates a long day header', () => {
    const longDays = [
      {
        day: 'Ein sehr langer Wochentagname der die Grenze sprengt',
        date: '29. Juli',
        events: [],
      },
    ]
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days: longDays, inverter })
    const fullHeader = longDays[0].day + ' · ' + longDays[0].date
    expect(svg).not.toContain(fullHeader)
    expect(svg).toContain('…')
  })

  it('keeps every drawn element within the 800x480 canvas', () => {
    const bigDays = Array.from({ length: 8 }, (_, i) => ({
      day: 'Tag ' + i,
      date: '2' + i + '. Juli',
      events: Array.from({ length: 6 }, (_, j) => ({
        summary: 'Event number ' + i + '-' + j + ' with a fairly long description',
        start_time: '0' + j + ':00',
        all_day: j % 2 === 0,
        name: 'Cal',
      })),
    }))
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch, 29. Juli', days: bigDays, inverter })

    const textYs = [...svg.matchAll(/<text[^>]*\by="(-?\d+(?:\.\d+)?)"/g)].map((m) => Number(m[1]))
    expect(textYs.length).toBeGreaterThan(0)
    for (const y of textYs) {
      expect(y).toBeLessThanOrEqual(480)
    }

    const rectMatches = [...svg.matchAll(/<rect[^>]*\/>/g)]
    expect(rectMatches.length).toBeGreaterThan(0)
    for (const rect of rectMatches) {
      const tag = rect[0]
      const yMatch = tag.match(/\by="(-?\d+(?:\.\d+)?)"/)
      const heightMatch = tag.match(/\bheight="(-?\d+(?:\.\d+)?)"/)
      const y = yMatch ? Number(yMatch[1]) : 0
      const height = Number(heightMatch[1])
      expect(y + height).toBeLessThanOrEqual(480)
    }
  })
})

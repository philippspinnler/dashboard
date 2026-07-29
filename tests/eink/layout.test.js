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

const presence = {
  persons: [
    { name: 'Philipp', state: 'home' },
    { name: 'Anna', state: 'home' },
    { name: 'Max', state: 'not_home' },
  ],
}

const speedtest = [{ provider: 'Init7', download: { num: '9.45', unit: 'Gbps' }, upload: { num: '9.38', unit: 'Gbps' } }]

const warnings = {
  warnings: [
    { kind: 'battery', name: 'Thermostat Bad', detail: '8%', severity: 'warning' },
    { kind: 'problem', name: 'Grünbeck', detail: 'Salzvorrat gering', severity: 'warning' },
  ],
}

const heizung = { is_heating: true, is_cooling: false, outdoor: 18.7, flow_temperature: 32.4 }

const netatmo = { indoor_temperature: 21.5, indoor_co2: 650, outdoor_temperature: 14.2 }

const weather = {
  current: { temperature: 18.5, weather: [{ id: 801, icon: '02d', description: 'Few Clouds' }] },
  daily: [{ date: '2026-07-29T00:00:00.000Z', temperature: { min: 12.3, max: 19.8 }, weather: [{ id: 800, icon: '01d' }] }],
}

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

  it("shows today's weather full-height in the corner with high above low, date centred", () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch, 29. Juli', days, inverter, weather, presence })
    expect(svg).toContain('class="wx"') // weather icon present
    // high (20°) sits above low (12°) — separate stacked lines to the left
    expect(svg).toMatch(/<text x="692" y="42"[^>]*text-anchor="end"[^>]*>20°<\/text>/) // high on top
    expect(svg).toMatch(/<text x="692" y="72"[^>]*text-anchor="end"[^>]*>12°<\/text>/) // low below
    // date centred above the people row
    expect(svg).toMatch(/<text x="\d+" y="40"[^>]*text-anchor="middle"[^>]*>Mittwoch, 29\. Juli<\/text>/)
    expect(svg).toMatch(/<text x="\d+" y="70"[^>]*text-anchor="middle"[^>]*><tspan/)
  })

  it('centres the date when weather is unavailable', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter })
    expect(svg).not.toContain('class="wx"')
    expect(svg).toMatch(/text-anchor="middle"[^>]*>Mittwoch<\/text>/)
  })

  it('never renders NaN° for a malformed weather day', () => {
    const bad = { current: { weather: [{ icon: '01d' }] }, daily: [{ temperature: { min: null, max: 'x' }, weather: [{ icon: '01d' }] }] }
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter, weather: bad })
    expect(svg).not.toContain('NaN')
    expect(svg).not.toContain('class="wx"') // block hidden entirely
  })

  it('uses a night icon (moon) after dark', () => {
    const nightWeather = { current: { weather: [{ icon: '01n' }] }, daily: [{ temperature: { min: 8, max: 15 }, weather: [{ icon: '01n' }] }] }
    const svg = buildScreenSvg({ time: '23:00', date: 'Mittwoch', days, inverter, weather: nightWeather })
    expect(svg).toContain('class="wx"')
    // moon = a black disc with a white disc carved out; the sun's rays must be absent
    expect(svg).not.toContain('stroke-linecap="round"')
  })

  it('escapes XML special characters in event summaries', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter })
    expect(svg).toContain('Zoo &amp; Aquarium &lt;Besuch&gt;')
    expect(svg).not.toContain('<Besuch>')
  })

  it('hides right-column sections (and the divider) when no data is available', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days: null, inverter: null })
    expect(svg).toContain('Keine Termine') // calendar keeps its own empty state
    // right-column sections are omitted entirely — not shown as "Keine Daten"
    expect(svg).not.toContain('Keine Daten')
    expect(svg).not.toContain('Energie')
    expect(svg).not.toContain('Internet')
    expect(svg).not.toContain('Heizung')
    expect(svg).not.toContain('Netatmo')
    // the column divider is only drawn when the right column has content
    expect(svg).not.toContain(`x1="400" y1="104"`)
  })

  it('auto-hides only the absent sections and reflows the rest', () => {
    // inverter + netatmo present; no speedtest, no heat pump
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter, netatmo })
    expect(svg).toContain('Energie')
    expect(svg).toContain('Netatmo')
    expect(svg).not.toContain('Internet') // no speedtest passed
    expect(svg).not.toContain('Heizung') // no heat pump passed
    // Netatmo reflows up: as the 2nd visible section it sits far higher than the
    // ~412 it would occupy as the 4th section
    const netatmoY = Number(svg.match(/<text x="416" y="(\d+)"[^>]*>Netatmo<\/text>/)[1])
    expect(netatmoY).toBeLessThan(300)
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

  it('truncates emoji without splitting surrogates', () => {
    const emojiSummary = '🎉'.repeat(40)
    const emojiDays = [
      {
        day: 'Heute',
        date: '29. Juli',
        events: [{ summary: emojiSummary, start_time: '09:00', all_day: false, name: 'Party' }],
      },
    ]
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days: emojiDays, inverter })
    // Must not contain lone surrogates (U+FFFD replacement character)
    expect(svg).not.toContain('�')
    // Must contain truncated emoji plus ellipsis (29 emoji + '…', limit 30)
    expect(svg).toContain('🎉'.repeat(29) + '…')
  })

  it('renders presence as a centred row: home black, away grey, no label', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter, presence })
    // one centre-anchored text with a tspan per name
    expect(svg).toMatch(/<text[^>]*text-anchor="middle"[^>]*><tspan/)
    // home names in plain tspans (no grey fill)
    expect(svg).toMatch(/<tspan>Philipp<\/tspan>/)
    expect(svg).toMatch(/<tspan>\s+Anna<\/tspan>/)
    // away name in a grey-filled tspan
    expect(svg).toMatch(/<tspan fill="url\(#grey\)">\s*Max<\/tspan>/)
    // no "Zuhause" label anymore
    expect(svg).not.toContain('Zuhause')
  })

  it('renders speedtest download and upload values', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter, speedtest })
    expect(svg).toContain('9.45 Gbps')
    expect(svg).toContain('9.38 Gbps')
  })

  it('shows the warnings overlay only when warnings exist', () => {
    const without = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter, warnings: { warnings: [] } })
    expect(without).not.toContain('Hinweise')

    const withWarn = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter, warnings })
    expect(withWarn).toContain('Hinweise')
    expect(withWarn).toContain('Akku: Thermostat Bad 8%')
    expect(withWarn).toContain('Fehler: Grünbeck Salzvorrat gering')
  })

  it('collapses extra warnings into a "+N weitere" line', () => {
    const many = { warnings: Array.from({ length: 6 }, (_, i) => ({ kind: 'battery', name: 'Sensor ' + i, detail: '5%' })) }
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter, warnings: many })
    expect(svg).toContain('+ 3 weitere')
  })

  it('renders birthdays with a gift icon and anniversaries with a heart', () => {
    const spDays = [
      {
        day: 'Heute',
        date: '29. Juli',
        events: [
          { summary: 'Max 1990 Geburtstag', all_day: true, name: 'P', special_event: { type: 'birthday', name: 'Max', years: 35 } },
          { summary: 'Anna & Tom 2010 Hochzeitstag', all_day: true, name: 'P', special_event: { type: 'anniversary', name: 'Anna & Tom', years: 15 } },
          { summary: 'Babs Geburtstag', all_day: true, name: 'P', special_event: { type: 'birthday', name: 'Babs', years: null } },
        ],
      },
    ]
    const svg = buildScreenSvg({ time: '1', date: 'x', days: spDays, inverter })
    expect(svg).toContain('sp-gift') // birthday icon
    expect(svg).toContain('sp-heart') // anniversary icon
    expect(svg).toContain('Max (35)')
    expect(svg).toContain('Anna &amp; Tom (15)') // name escaped, years shown
    expect(svg).toContain('>Babs<') // no "( )" when years is null
    // the raw "Geburtstag/Hochzeitstag" summary text is replaced by the name
    expect(svg).not.toContain('Geburtstag')
    expect(svg).not.toContain('Hochzeitstag')
  })

  it('shows heizung status with the Vorlauf temp in parens, and Netatmo temps separately', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter, heizung, netatmo })
    // status carries the flow temperature in parentheses when active
    expect(svg).toContain('Heizt (32,4°)')
    // Netatmo is its own section with inside/outside from netatmo
    expect(svg).toContain('Netatmo')
    expect(svg).toContain('Innen')
    expect(svg).toContain('21,5°') // netatmo indoor_temperature
    expect(svg).toContain('Außen')
    expect(svg).toContain('14,2°') // netatmo outdoor_temperature
  })

  it('shows the three heizung status states; no flow parens when off', () => {
    const heat = buildScreenSvg({ time: '1', date: 'x', days, inverter, heizung: { is_heating: true, is_cooling: false, flow_temperature: 30 } })
    expect(heat).toContain('Heizt (30,0°)')
    const cool = buildScreenSvg({ time: '1', date: 'x', days, inverter, heizung: { is_heating: false, is_cooling: true, flow_temperature: 12 } })
    expect(cool).toContain('Kühlt (12,0°)')
    const off = buildScreenSvg({ time: '1', date: 'x', days, inverter, heizung: { is_heating: false, is_cooling: false, flow_temperature: 20 } })
    expect(off).toContain('Status <tspan font-weight="bold">Aus</tspan>')
    expect(off).not.toContain('(20,0°)') // no flow temp shown when off
  })

  it('renders the battery as text with no progress bar', () => {
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch', days, inverter })
    expect(svg).toContain('49 %')
    // the old SOC bar used a filled rect of height 12 — it must be gone
    expect(svg).not.toMatch(/<rect[^>]*height="12"/)
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
    const many = { warnings: Array.from({ length: 6 }, (_, i) => ({ kind: 'battery', name: 'Sensor ' + i, detail: '5%' })) }
    const svg = buildScreenSvg({ time: '12:34', date: 'Mittwoch, 29. Juli', days: bigDays, inverter, presence, speedtest, warnings: many, heizung, netatmo })

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

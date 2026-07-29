// Composes the 800x480 e-ink screen as an SVG string. Pure — data in, SVG out —
// so the layout is unit-testable without a server.
//
// The panel is physically 1-bit black/white (see memory: eink-panel-is-1bit):
// the rasterized SVG is hard-thresholded to 1 bit. Two consequences shape the
// sizing below:
//   1. "Grey" (away people) is faked with a halftone PATTERN fill — a fine dot
//      grid that survives thresholding and reads as light grey next to solid
//      black text. resvg renders pattern-filled text fine (verified with a probe).
//   2. Very small type looks fuzzy: thin antialiased strokes break up when
//      quantised to 1 bit. The font sizes are a compromise — small enough to fit
//      everything, large enough to stay crisp on the panel. Tune them in FS.

const W = 800
const H = 480

// Font sizes in one place — the readable/compact tradeoff lives here.
const FS = {
  clock: 64,
  date: 24,
  presence: 20,
  dayHeader: 20,
  event: 18,
  section: 18, // Energie / Internet headers
  metric: 18, // metric value lines
  warnTitle: 16,
  warn: 16,
  footer: 14,
}

// url() reference to the halftone pattern defined in <defs>. 1 black px per 2x2
// tile ≈ 25% coverage → light grey.
const GREY = 'url(#grey)'

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]))
}

function truncate(s, max) {
  const chars = [...String(s)]
  return chars.length <= max ? String(s) : chars.slice(0, max - 1).join('') + '…'
}

function formatWatts(w) {
  const abs = Math.abs(Number(w) || 0)
  if (abs >= 1000) return (abs / 1000).toFixed(2).replace('.', ',') + ' kW'
  return Math.round(abs) + ' W'
}

function formatTemp(v) {
  return v == null ? '–' : Number(v).toFixed(1).replace('.', ',') + '°'
}

// Grid flow as [directionWord, value]; the direction stays a word so a big value
// like "5,32 kW" never overflows the narrow right column.
function gridCompact(inv) {
  const cons = Number(inv.grid_consumption) || 0
  const feed = Number(inv.grid_feedin) || 0
  if (cons > 10) return ['Bezug', formatWatts(cons)]
  if (feed > 10) return ['Einspeisung', formatWatts(feed)]
  return ['Netz', '0 W']
}

function batteryCompact(inv) {
  const soc = Math.round(Number(inv.battery_state_of_charge) || 0)
  const p = Number(inv.battery_power) || 0
  let value = soc + ' %'
  if (p > 25) value += ' · lädt'
  else if (p < -25) value += ' · entlädt'
  return ['Akku', value]
}

function eventLine(e) {
  const prefix = e.all_day ? '·  ' : e.start_time + '  '
  return prefix + truncate(e.summary, 30)
}

const WARN_TAGS = {
  battery: 'Akku',
  problem: 'Fehler',
  watch: 'Achtung',
  humidity: 'Feuchte',
  maintenance: 'Wartung',
}

// A metric line: small prefix + bold value, e.g. "PV **1,79 kW**".
function metricLine(x, y, prefix, value) {
  return `<text x="${x}" y="${y}" font-size="${FS.metric}">${escapeXml(prefix)} <tspan font-weight="bold">${escapeXml(value)}</tspan></text>`
}

export function buildScreenSvg({ time, date, days, inverter, presence, speedtest, warnings, heizung }) {
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="DejaVu Sans">`)
  // Halftone pattern for "grey" text on the 1-bit panel: 1 black px per 2x2 tile.
  parts.push('<defs><pattern id="grey" width="2" height="2" patternUnits="userSpaceOnUse">'
    + '<rect width="2" height="2" fill="white"/><rect width="1" height="1" fill="black"/></pattern></defs>')
  parts.push(`<rect width="${W}" height="${H}" fill="white"/>`)

  // header: clock left; presence row + date stacked top-right
  parts.push(`<text x="24" y="68" font-size="${FS.clock}" font-weight="bold">${escapeXml(time)}</text>`)
  // presence: names in a row, right-aligned above the date, no label. Home people
  // in solid black, away people in the halftone "grey" — one right-anchored text
  // with a tspan per name so mixed fills stay on a single line.
  const persons = (presence && presence.persons) || []
  if (persons.length) {
    const spans = persons
      .map((p, i) => {
        const sep = i > 0 ? '   ' : ''
        const fill = p.state === 'home' ? '' : ` fill="${GREY}"`
        return `<tspan${fill}>${escapeXml(sep + p.name)}</tspan>`
      })
      .join('')
    parts.push(`<text x="${W - 24}" y="34" font-size="${FS.presence}" text-anchor="end">${spans}</text>`)
  }
  parts.push(`<text x="${W - 24}" y="68" font-size="${FS.date}" text-anchor="end">${escapeXml(date)}</text>`)
  parts.push(`<line x1="24" y1="88" x2="${W - 24}" y2="88" stroke="black" stroke-width="2"/>`)

  // --- warnings overlay geometry (drawn last, but sized up front so the
  // calendar can stop above it) ---
  const warnList = (warnings && warnings.warnings) || []
  const warnShown = warnList.length > 0
  const shownWarns = warnList.slice(0, 3)
  const warnLineCount = shownWarns.length + (warnList.length > 3 ? 1 : 0)
  const warnBoxH = 26 + warnLineCount * 22
  const warnBottom = H - 32
  const warnTop = warnBottom - warnBoxH

  // --- left column: calendar ---
  const calBottom = warnShown ? warnTop - 10 : H - 24
  let y = 122
  if (!days || days.length === 0) {
    parts.push(`<text x="24" y="${y}" font-size="${FS.event}">Keine Termine</text>`)
  } else {
    outer: for (const day of days) {
      if (y > calBottom - 44) break
      parts.push(`<text x="24" y="${y}" font-size="${FS.dayHeader}" font-weight="bold">${escapeXml(truncate(day.day + ' · ' + day.date, 30))}</text>`)
      y += 28
      for (const e of day.events) {
        if (y > calBottom) break outer
        parts.push(`<text x="34" y="${y}" font-size="${FS.event}">${escapeXml(eventLine(e))}</text>`)
        y += 27
      }
      y += 14
    }
  }

  // column divider
  parts.push(`<line x1="498" y1="104" x2="498" y2="${H - 44}" stroke="black" stroke-width="1"/>`)

  const rx = 514

  // --- right column: Energie (inverter, no bar) ---
  parts.push(`<text x="${rx}" y="122" font-size="${FS.section}" font-weight="bold">Energie</text>`)
  if (!inverter) {
    parts.push(`<text x="${rx}" y="150" font-size="${FS.metric}">Keine Daten</text>`)
  } else {
    const grid = gridCompact(inverter)
    const bat = batteryCompact(inverter)
    parts.push(metricLine(rx, 150, 'PV', formatWatts(inverter.pv_power)))
    parts.push(metricLine(rx, 178, 'Verbrauch', formatWatts(inverter.power_consumption)))
    parts.push(metricLine(rx, 206, grid[0], grid[1]))
    parts.push(metricLine(rx, 234, bat[0], bat[1]))
  }

  // --- right column: Internet (speedtest) ---
  parts.push(`<text x="${rx}" y="266" font-size="${FS.section}" font-weight="bold">Internet</text>`)
  const speed = (speedtest && speedtest[0]) || null
  const down = speed && speed.download ? `${speed.download.num} ${speed.download.unit}` : '—'
  const up = speed && speed.upload ? `${speed.upload.num} ${speed.upload.unit}` : '—'
  parts.push(metricLine(rx, 294, '↓', down))
  parts.push(metricLine(rx, 322, '↑', up))

  // --- right column: Heizung (status + inside/outside temp only) ---
  parts.push(`<text x="${rx}" y="354" font-size="${FS.section}" font-weight="bold">Heizung</text>`)
  if (!heizung) {
    parts.push(`<text x="${rx}" y="382" font-size="${FS.metric}">Keine Daten</text>`)
  } else {
    const status = heizung.is_heating ? 'Heizt' : heizung.is_cooling ? 'Kühlt' : 'Aus'
    parts.push(metricLine(rx, 382, 'Status', status))
    const inside = formatTemp(heizung.room_actual)
    const outside = formatTemp(heizung.outdoor)
    parts.push(`<text x="${rx}" y="410" font-size="${FS.metric}">Innen <tspan font-weight="bold">${escapeXml(inside)}</tspan>   Außen <tspan font-weight="bold">${escapeXml(outside)}</tspan></text>`)
  }

  // footer: last-updated stamp
  parts.push(`<text x="${W - 24}" y="${H - 14}" font-size="${FS.footer}" text-anchor="end">Stand ${escapeXml(time)}</text>`)

  // --- warnings overlay (only when something is actually wrong) ---
  // Constrained to the left (calendar) column so the right column's Energie /
  // Internet blocks stay fully visible; warnings are home-related and read
  // naturally under the calendar.
  if (warnShown) {
    const boxW = 466
    parts.push(`<rect x="24" y="${warnTop}" width="${boxW}" height="${warnBoxH}" fill="white" stroke="black" stroke-width="2"/>`)
    parts.push(`<text x="40" y="${warnTop + 22}" font-size="${FS.warnTitle}" font-weight="bold">Hinweise</text>`)
    let wy = warnTop + 46
    for (const w of shownWarns) {
      const tag = WARN_TAGS[w.kind] || 'Hinweis'
      const line = `${tag}: ${w.name}${w.detail ? ' ' + w.detail : ''}`
      parts.push(`<text x="40" y="${wy}" font-size="${FS.warn}">${escapeXml(truncate(line, 52))}</text>`)
      wy += 22
    }
    if (warnList.length > 3) {
      parts.push(`<text x="40" y="${wy}" font-size="${FS.warn}">+ ${warnList.length - 3} weitere</text>`)
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

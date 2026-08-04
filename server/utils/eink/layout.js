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

const MARGIN = 24 // content edge inset on every side
const BOTTOM = H - 8 // lowest content baseline — one shared bottom edge margin

// Column split: calendar left of the divider, sections right of it. The divider
// sits at the horizontal centre of the content area (margins 24..776); the right
// column runs from RX to the right margin.
const DIVIDER_X = 400
const RX = 416

// Vertical rhythm shared by the calendar (left) and the data column (right), so
// both breathe the same. Block-to-block baseline distance is ROW + BLOCK_GAP.
const HEADER_GAP = 28 // section/day header baseline → its first line
const ROW = 27 // line → line within a block
const BLOCK_GAP = 14 // extra gap after a block

// Font sizes in one place — the readable/compact tradeoff lives here.
const FS = {
  clock: 64,
  date: 22,
  presence: 20,
  dayHeader: 20,
  event: 18,
  section: 18, // Energie / Internet headers
  metric: 18, // metric value lines
  warnTitle: 16,
  warn: 16,
}

// Header geometry (everything above the divider at HEADER_LINE_Y).
const HEADER_LINE_Y = 88
const CLOCK_BASE = 68 // clock baseline; also the date baseline when it stands alone
const HDR_DATE_Y = 40 // date, stacked above the people row
const HDR_PEOPLE_Y = 70 // people row
const WX_SIZE = 72 // full header-height weather icon
const WX_X = W - MARGIN - WX_SIZE // icon pinned to the right margin
const WX_TOP = 8
const WX_TEMP_X = WX_X - 12 // stacked high/low temps, right-anchored left of the icon
const WX_BLOCK_LEFT = 636 // approx left edge of the weather block, for centring the date
const CLOCK_RIGHT = 210 // approx right edge of the clock, for centring the date

// url() reference to the halftone pattern defined in <defs>. 2x2 checkerboard
// (50% coverage) → mid grey, darker than a light dither but not solid black.
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

// Per-kind warning icons, mirroring the big dashboard's WarningsOverlay
// (battery / droplet / wrench / warning triangle). Solid black fills with white
// cut-outs so they survive the 1-bit threshold — thin strokes would fuzz out at
// this size. The class carries the kind for tests and debugging.
function warnIcon(kind, x, top, size) {
  const s = size / 24
  const g = (inner) => `<g class="warn-${kind}" transform="translate(${x} ${top}) scale(${s})">${inner}</g>`
  switch (kind) {
    case 'battery':
      return g(
        '<rect x="1.5" y="7" width="18.5" height="10" rx="2" fill="black"/>'
        + '<rect x="20.5" y="10" width="2.5" height="4" fill="black"/>'
        + '<rect x="9.6" y="9.2" width="2.2" height="3.8" fill="white"/>'
        + '<rect x="9.6" y="14" width="2.2" height="1.8" fill="white"/>',
      )
    case 'humidity':
      return g('<path fill="black" d="M12 2.5C12 2.5 5 10.5 5 15.5C5 19.6 8.1 22.5 12 22.5C15.9 22.5 19 19.6 19 15.5C19 10.5 12 2.5 12 2.5Z"/>')
    case 'maintenance':
      // vertical wrench (open-slot head + handle) rotated 45° to the classic pose
      return g(
        '<g transform="rotate(45 12 12)">'
        + '<circle cx="12" cy="6.5" r="5" fill="black"/>'
        + '<rect x="10.2" y="0" width="3.6" height="6" fill="white"/>'
        + '<rect x="10.3" y="9" width="3.4" height="13" rx="1.5" fill="black"/>'
        + '</g>',
      )
    default:
      // problem / watch: warning triangle with exclamation, like the dashboard
      return g(
        '<path fill="black" d="M12 2L23 21H1Z"/>'
        + '<rect x="11" y="9" width="2.1" height="6" fill="white"/>'
        + '<rect x="11" y="16.6" width="2.1" height="2" fill="white"/>',
      )
  }
}

// A metric line: small prefix + bold value, e.g. "PV **1,79 kW**".
function metricLine(x, y, prefix, value) {
  return `<text x="${x}" y="${y}" font-size="${FS.metric}">${escapeXml(prefix)} <tspan font-weight="bold">${escapeXml(value)}</tspan></text>`
}

// Special-event icons — drawn as solid black vector shapes in a 24-unit box so
// they stay crisp when the frame is thresholded to 1 bit. Matches the big
// dashboard's gift (birthday) / heart (anniversary) markers.
function heartIcon(x, top, size) {
  const s = size / 24
  return `<path class="sp-heart" transform="translate(${x} ${top}) scale(${s})" fill="black" d="M12 21C12 21 3.5 14 3.5 8.7C3.5 5.8 5.8 4 8.2 4C10 4 11.4 5 12 6.3C12.6 5 14 4 15.8 4C18.2 4 20.5 5.8 20.5 8.7C20.5 14 12 21 12 21Z"/>`
}
function giftIcon(x, top, size) {
  const s = size / 24
  return (
    `<g class="sp-gift" transform="translate(${x} ${top}) scale(${s})" fill="black">`
    + '<circle cx="8.4" cy="5" r="2.7"/><circle cx="15.6" cy="5" r="2.7"/>'
    + '<rect x="2.5" y="8" width="19" height="4.5"/>'
    + '<rect x="4" y="12.5" width="16" height="9.5"/>'
    + '<rect x="10.8" y="8" width="2.4" height="14" fill="white"/>'
    + '</g>'
  )
}

// Weather icons — simple filled/stroked vector shapes in a 24-unit box, keyed
// off the OpenWeatherMap icon code (01–50 + d/n). Drawn as 1-bit-friendly black
// on white; the panel can't show OWM's colour PNGs.
function sunRays(cx, cy, r) {
  const rays = []
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i
    const x1 = (cx + Math.cos(a) * (r + 1.6)).toFixed(1)
    const y1 = (cy + Math.sin(a) * (r + 1.6)).toFixed(1)
    const x2 = (cx + Math.cos(a) * (r + 4.4)).toFixed(1)
    const y2 = (cy + Math.sin(a) * (r + 4.4)).toFixed(1)
    rays.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`)
  }
  return `<g stroke="black" stroke-width="1.6" stroke-linecap="round">${rays.join('')}</g>`
}

function weatherIcon(code, x, top, size) {
  const s = size / 24
  const g = (inner) => `<g class="wx" transform="translate(${x} ${top}) scale(${s})">${inner}</g>`
  const kind = String(code || '').slice(0, 2)
  const night = String(code || '').endsWith('n')
  const cloud = '<g fill="black"><circle cx="9" cy="14" r="4"/><circle cx="15.5" cy="14" r="4.6"/>'
    + '<circle cx="12" cy="10.8" r="4.8"/><rect x="8.5" y="13.6" width="10" height="5.2"/></g>'
  // crescent: black disc with a white disc offset to carve the moon shape
  const moon = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="black"/><circle cx="${cx + r * 0.42}" cy="${cy - r * 0.34}" r="${r * 0.86}" fill="white"/>`
  const rain = '<g stroke="black" stroke-width="1.7" stroke-linecap="round">'
    + '<line x1="9" y1="19.5" x2="7.8" y2="23"/><line x1="12.5" y1="19.5" x2="11.3" y2="23"/>'
    + '<line x1="16" y1="19.5" x2="14.8" y2="23"/></g>'
  switch (kind) {
    case '01':
      return night
        ? g(moon(12, 12, 6.5))
        : g(`${sunRays(12, 12, 5)}<circle cx="12" cy="12" r="5" fill="black"/>`)
    case '02':
      // sun (day) or moon (night) peeking behind the cloud
      return night
        ? g(`${moon(7.5, 7.5, 3.6)}${cloud}`)
        : g(`${sunRays(8, 8, 3.3)}<circle cx="8" cy="8" r="3.3" fill="black"/>${cloud}`)
    case '03':
    case '04':
      return night ? g(`${moon(7.5, 7, 3)}${cloud}`) : g(cloud)
    case '09':
    case '10':
      return g(cloud + rain)
    case '11':
      return g(cloud + '<path fill="black" d="M12.6 18.5 L9.6 22.6 L11.7 22.6 L10.4 26 L15 20.7 L12.4 20.7 Z"/>')
    case '13':
      return g(cloud + '<g fill="black"><circle cx="9" cy="21.6" r="1.1"/><circle cx="13" cy="22.2" r="1.1"/><circle cx="16.6" cy="21.6" r="1.1"/></g>')
    case '50':
      return g('<g stroke="black" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="9" x2="20" y2="9"/>'
        + '<line x1="4" y1="13" x2="20" y2="13"/><line x1="4" y1="17" x2="20" y2="17"/></g>')
    default:
      return g(cloud)
  }
}

export function buildScreenSvg({ time, date, days, inverter, presence, speedtest, warnings, heizung, netatmo, weather }) {
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="DejaVu Sans">`)
  // Halftone pattern for "grey" text on the 1-bit panel: a 2x2 checkerboard
  // (2 black px per tile = 50% coverage) — darker than a 25% dither but still
  // clearly distinct from solid-black home names.
  parts.push('<defs><pattern id="grey" width="2" height="2" patternUnits="userSpaceOnUse">'
    + '<rect width="2" height="2" fill="white"/><rect width="1" height="1" fill="black"/>'
    + '<rect x="1" y="1" width="1" height="1" fill="black"/></pattern></defs>')
  parts.push(`<rect width="${W}" height="${H}" fill="white"/>`)

  // header: clock left. Date + people centre-aligned as a stacked block; today's
  // weather (full-height icon, with today's high above the low to its left)
  // pinned to the far corner. Home people solid black, away people halftone grey
  // (one centred text, a tspan per name, so mixed fills share a line).
  parts.push(`<text x="${MARGIN}" y="${CLOCK_BASE}" font-size="${FS.clock}" font-weight="bold">${escapeXml(time)}</text>`)

  const persons = (presence && presence.persons) || []
  const peopleSpans = persons
    .map((p, i) => {
      const sep = i > 0 ? '   ' : ''
      const fill = p.state === 'home' ? '' : ` fill="${GREY}"`
      return `<tspan${fill}>${escapeXml(sep + p.name)}</tspan>`
    })
    .join('')

  const today = weather && weather.daily && weather.daily[0]
  const cur = weather && weather.current && weather.current.weather && weather.current.weather[0]
  const code = cur ? cur.icon : today && today.weather && today.weather[0] ? today.weather[0].icon : null
  const tmax = today && today.temperature ? Number(today.temperature.max) : NaN
  const tmin = today && today.temperature ? Number(today.temperature.min) : NaN
  // only show the weather block when we have both an icon and finite temps —
  // a malformed OWM daily entry must never render "NaN°"
  const hasWeather = Boolean(code) && Number.isFinite(tmax) && Number.isFinite(tmin)

  if (hasWeather) {
    // full-height icon in the corner; today's high on top, low below, to its left
    parts.push(weatherIcon(code, WX_X, WX_TOP, WX_SIZE))
    parts.push(`<text x="${WX_TEMP_X}" y="${HDR_DATE_Y + 2}" font-size="24" text-anchor="end">${Math.round(tmax)}°</text>`)
    parts.push(`<text x="${WX_TEMP_X}" y="${HDR_PEOPLE_Y + 2}" font-size="24" text-anchor="end">${Math.round(tmin)}°</text>`)
  }

  // centre the date/people block in the gap between the clock and the weather
  const rightBound = hasWeather ? WX_BLOCK_LEFT : W - MARGIN
  const centerX = Math.round((CLOCK_RIGHT + rightBound) / 2)
  parts.push(`<text x="${centerX}" y="${persons.length ? HDR_DATE_Y : 58}" font-size="${FS.date}" text-anchor="middle">${escapeXml(date)}</text>`)
  if (persons.length) {
    parts.push(`<text x="${centerX}" y="${HDR_PEOPLE_Y}" font-size="${FS.presence}" text-anchor="middle">${peopleSpans}</text>`)
  }

  parts.push(`<line x1="${MARGIN}" y1="${HEADER_LINE_Y}" x2="${W - MARGIN}" y2="${HEADER_LINE_Y}" stroke="black" stroke-width="2"/>`)

  // --- warnings overlay geometry (drawn last, but sized up front so the
  // calendar can stop above it) ---
  const warnList = (warnings && warnings.warnings) || []
  const warnShown = warnList.length > 0
  const shownWarns = warnList.slice(0, 3)
  const warnLineCount = shownWarns.length + (warnList.length > 3 ? 1 : 0)
  // Box height: last line's baseline sits at 24 + 22*count from the top; leave
  // ~14px below it so icons (baseline+3) and descenders clear the border with
  // the same ~10px of air the title gets at the top.
  const warnBoxH = 38 + warnLineCount * 22
  const warnBottom = BOTTOM // same bottom edge margin as the calendar/divider
  const warnTop = warnBottom - warnBoxH

  // --- left column: calendar ---
  // shares the BOTTOM edge margin; when warnings show, stop above the box instead.
  const calBottom = warnShown ? warnTop - 10 : BOTTOM
  let y = 122
  if (!days || days.length === 0) {
    parts.push(`<text x="24" y="${y}" font-size="${FS.event}">Keine Termine</text>`)
  } else {
    outer: for (const day of days) {
      // start a day only if its header AND at least its first event line fit —
      // a header with zero events under it would be misleading
      if (y + HEADER_GAP > calBottom) break
      parts.push(`<text x="24" y="${y}" font-size="${FS.dayHeader}" font-weight="bold">${escapeXml(truncate(day.day + ' · ' + day.date, 30))}</text>`)
      y += HEADER_GAP
      for (const e of day.events) {
        if (y > calBottom) break outer
        const sp = e.special_event
        if (sp) {
          // Birthday → gift, anniversary → heart, then the name and (age/years).
          parts.push(sp.type === 'anniversary' ? heartIcon(34, y - 15, 18) : giftIcon(34, y - 15, 18))
          const label = sp.name + (sp.years != null ? ` (${sp.years})` : '')
          parts.push(`<text x="60" y="${y}" font-size="${FS.event}">${escapeXml(truncate(label, 24))}</text>`)
        } else {
          parts.push(`<text x="34" y="${y}" font-size="${FS.event}">${escapeXml(eventLine(e))}</text>`)
        }
        y += ROW
      }
      y += BLOCK_GAP
    }
  }

  // --- right column ---
  // Each section only renders when its data source is actually present, so the
  // panel adapts to a setup without an inverter / heat pump / Netatmo / etc.
  // A running ry means hidden sections simply reflow the rest upward. The zero /
  // null checks distinguish "no source" from a genuine 0 or "off" reading.
  const rx = RX
  const speed = (speedtest && speedtest[0]) || null
  const hasInverter =
    inverter &&
    [inverter.pv_power, inverter.power_consumption, inverter.grid_consumption, inverter.grid_feedin, inverter.battery_state_of_charge].some(
      (v) => Number(v),
    )
  const hasSpeed = Boolean(speed && speed.download)
  const hasHeizung = Boolean(heizung)
  const hasNetatmo = netatmo && (netatmo.indoor_temperature != null || netatmo.outdoor_temperature != null)
  const anyRight = hasInverter || hasSpeed || hasHeizung || hasNetatmo

  if (anyRight) {
    parts.push(`<line x1="${DIVIDER_X}" y1="104" x2="${DIVIDER_X}" y2="${BOTTOM}" stroke="black" stroke-width="1"/>`)
  }

  let ry = 124

  if (hasInverter) {
    const grid = gridCompact(inverter)
    const bat = batteryCompact(inverter)
    parts.push(`<text x="${rx}" y="${ry}" font-size="${FS.section}" font-weight="bold">Energie</text>`)
    ry += HEADER_GAP
    parts.push(metricLine(rx, ry, 'PV', formatWatts(inverter.pv_power)))
    ry += ROW
    parts.push(metricLine(rx, ry, 'Verbrauch', formatWatts(inverter.power_consumption)))
    ry += ROW
    parts.push(metricLine(rx, ry, grid[0], grid[1]))
    ry += ROW
    parts.push(metricLine(rx, ry, bat[0], bat[1]))
    ry += ROW + BLOCK_GAP
  }

  if (hasSpeed) {
    const down = speed.download ? `${speed.download.num} ${speed.download.unit}` : '—'
    const up = speed.upload ? `${speed.upload.num} ${speed.upload.unit}` : '—'
    parts.push(`<text x="${rx}" y="${ry}" font-size="${FS.section}" font-weight="bold">Internet</text>`)
    ry += HEADER_GAP
    parts.push(`<text x="${rx}" y="${ry}" font-size="${FS.metric}">↓ <tspan font-weight="bold">${escapeXml(down)}</tspan>   ↑ <tspan font-weight="bold">${escapeXml(up)}</tspan></text>`)
    ry += ROW + BLOCK_GAP
  }

  if (hasHeizung) {
    const state = heizung.is_heating ? 'Heizt' : heizung.is_cooling ? 'Kühlt' : 'Aus'
    const flow = heizung.flow_temperature
    // status carries the Vorlauf temp in parens when active
    const value = state !== 'Aus' && flow != null ? `${state} (${formatTemp(flow)})` : state
    parts.push(`<text x="${rx}" y="${ry}" font-size="${FS.section}" font-weight="bold">Heizung</text>`)
    ry += HEADER_GAP
    parts.push(metricLine(rx, ry, 'Status', value))
    ry += ROW + BLOCK_GAP
  }

  if (hasNetatmo) {
    const inside = formatTemp(netatmo.indoor_temperature)
    const outside = formatTemp(netatmo.outdoor_temperature)
    parts.push(`<text x="${rx}" y="${ry}" font-size="${FS.section}" font-weight="bold">Netatmo</text>`)
    ry += HEADER_GAP
    parts.push(`<text x="${rx}" y="${ry}" font-size="${FS.metric}">Innen <tspan font-weight="bold">${escapeXml(inside)}</tspan>   Außen <tspan font-weight="bold">${escapeXml(outside)}</tspan></text>`)
    ry += ROW + BLOCK_GAP
  }

  // --- warnings overlay (only when something is actually wrong) ---
  // Constrained to the left (calendar) column so the right column's Energie /
  // Internet blocks stay fully visible; warnings are home-related and read
  // naturally under the calendar.
  if (warnShown) {
    const boxW = DIVIDER_X - 24 - 8 // left margin to just before the divider
    parts.push(`<rect x="24" y="${warnTop}" width="${boxW}" height="${warnBoxH}" fill="white" stroke="black" stroke-width="2"/>`)
    parts.push(`<text x="40" y="${warnTop + 22}" font-size="${FS.warnTitle}" font-weight="bold">Hinweise</text>`)
    let wy = warnTop + 46
    for (const w of shownWarns) {
      // dashboard style: kind icon, then name, then the value in bold. Truncate
      // the name (not the whole line) so the detail always stays visible.
      parts.push(warnIcon(w.kind, 40, wy - 12, 15))
      const detail = w.detail ? String(w.detail) : ''
      const name = truncate(w.name, detail ? 38 - [...detail].length : 38)
      const detailSpan = detail ? ` <tspan font-weight="bold">${escapeXml(detail)}</tspan>` : ''
      parts.push(`<text x="62" y="${wy}" font-size="${FS.warn}">${escapeXml(name)}${detailSpan}</text>`)
      wy += 22
    }
    if (warnList.length > 3) {
      parts.push(`<text x="62" y="${wy}" font-size="${FS.warn}">+ ${warnList.length - 3} weitere</text>`)
    }
  }

  parts.push('</svg>')
  return parts.join('\n')
}

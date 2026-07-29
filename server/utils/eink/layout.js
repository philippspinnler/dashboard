// Composes the 800x480 e-ink screen as an SVG string. Pure — data in, SVG out —
// so the layout is unit-testable without a server. Black/white only: the
// rasterized result gets thresholded to 1 bit, so no grays, no colors.

const W = 800
const H = 480

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

function gridLine(inv) {
  const cons = Number(inv.grid_consumption) || 0
  const feed = Number(inv.grid_feedin) || 0
  if (cons > 10) return 'Bezug ' + formatWatts(cons)
  if (feed > 10) return 'Einspeisung ' + formatWatts(feed)
  return '0 W'
}

function batteryLine(inv) {
  const soc = Math.round(Number(inv.battery_state_of_charge) || 0)
  const p = Number(inv.battery_power) || 0
  if (p > 25) return soc + ' % · lädt'
  if (p < -25) return soc + ' % · entlädt'
  return soc + ' %'
}

function eventLine(e) {
  const prefix = e.all_day ? '·  ' : e.start_time + '  '
  return prefix + truncate(e.summary, 34)
}

export function buildScreenSvg({ time, date, days, inverter }) {
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="DejaVu Sans">`)
  parts.push(`<rect width="${W}" height="${H}" fill="white"/>`)

  // header: big clock left, date right
  parts.push(`<text x="24" y="92" font-size="88" font-weight="bold">${escapeXml(time)}</text>`)
  parts.push(`<text x="${W - 24}" y="88" font-size="30" text-anchor="end">${escapeXml(date)}</text>`)
  parts.push(`<line x1="24" y1="118" x2="${W - 24}" y2="118" stroke="black" stroke-width="3"/>`)

  // left column: calendar
  let y = 168
  if (!days || days.length === 0) {
    parts.push(`<text x="24" y="${y}" font-size="24">Keine Termine</text>`)
  } else {
    outer: for (const day of days) {
      if (y > H - 60) break
      parts.push(`<text x="24" y="${y}" font-size="24" font-weight="bold">${escapeXml(truncate(day.day + ' · ' + day.date, 30))}</text>`)
      y += 36
      for (const e of day.events) {
        if (y > H - 30) break outer
        parts.push(`<text x="36" y="${y}" font-size="22">${escapeXml(eventLine(e))}</text>`)
        y += 32
      }
      y += 18
    }
  }

  // column divider
  parts.push(`<line x1="520" y1="140" x2="520" y2="${H - 24}" stroke="black" stroke-width="1"/>`)

  // right column: inverter
  const rx = 548
  parts.push(`<text x="${rx}" y="168" font-size="24" font-weight="bold">Energie</text>`)
  if (!inverter) {
    parts.push(`<text x="${rx}" y="204" font-size="22">Keine Daten</text>`)
  } else {
    const rows = [
      ['Produktion', formatWatts(inverter.pv_power)],
      ['Verbrauch', formatWatts(inverter.power_consumption)],
      ['Netz', gridLine(inverter)],
      ['Batterie', batteryLine(inverter)],
    ]
    let ry = 210
    for (const [label, value] of rows) {
      parts.push(`<text x="${rx}" y="${ry}" font-size="18">${escapeXml(label)}</text>`)
      parts.push(`<text x="${rx}" y="${ry + 34}" font-size="30" font-weight="bold">${escapeXml(value)}</text>`)
      ry += 62
    }
    const soc = Math.max(0, Math.min(100, Number(inverter.battery_state_of_charge) || 0))
    parts.push(`<rect x="${rx}" y="446" width="120" height="16" fill="white" stroke="black" stroke-width="2"/>`)
    parts.push(`<rect x="${rx + 2}" y="448" width="${(116 * soc) / 100}" height="12" fill="black"/>`)
  }

  // footer: last-updated stamp
  parts.push(`<text x="${W - 24}" y="${H - 16}" font-size="16" text-anchor="end">Stand ${escapeXml(time)}</text>`)
  parts.push('</svg>')
  return parts.join('\n')
}

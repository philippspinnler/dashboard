// Pure helpers for /api/speedtest (plain ESM, no Nitro imports, so they are unit-testable).

// Ports format_speed(): pick unit (Kbps/Mbps/Gbps/Tbps), then 2 decimals < 10,
// 1 decimal < 100, integer otherwise. Returns { num, unit } so the widget can render
// the value and unit separately (matching the metric-value/metric-unit convention).
export function formatSpeed(speedMbps) {
  const speed = parseFloat(String(speedMbps))
  const fmt = (v) => (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v)))
  if (speed < 1) return { num: fmt(speed * 1000), unit: 'Kbps' }
  if (speed < 1000) return { num: fmt(speed), unit: 'Mbps' }
  if (speed < 1_000_000) return { num: fmt(speed / 1000), unit: 'Gbps' }
  return { num: fmt(speed / 1_000_000), unit: 'Tbps' }
}

// Turns one configured speedtest `st` ({ provider, max_age_hours? }) and its latest
// payload `res` (null when the source was unreachable) into a widget entry. The
// payload differs by source: speedtest-tracker nests under `data`, the iperf
// collector serves it flat; both are Mbps.
//
// download/upload come back null when there is nothing trustworthy to show: no
// payload, no speeds, or a reading older than `max_age_hours`. The age check matters
// because a collector keeps serving its last good result after failed runs. A
// payload without a timestamp can't be judged and counts as fresh.
export function toSpeedtestEntry(st, res, source, now = Date.now()) {
  const empty = { provider: st.provider, download: null, upload: null }
  const src = source === 'iperf' ? res : res?.data
  if (!src || !Number.isFinite(parseFloat(src.download)) || !Number.isFinite(parseFloat(src.upload))) return empty

  const maxAgeHours = Number(st.max_age_hours)
  const measuredAt = Date.parse(src.timestamp ?? src.created_at)
  if (maxAgeHours > 0 && Number.isFinite(measuredAt) && now - measuredAt > maxAgeHours * 3_600_000) return empty

  return { provider: st.provider, download: formatSpeed(src.download), upload: formatSpeed(src.upload) }
}

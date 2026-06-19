// Ports dashboard-api/app/plugins/speedtest.py — reads latest results from one or
// more self-hosted speedtest trackers at host:port (NOT a live Ookla run).
// Cache TTL mirrors @cache(expire=1800).

// Ports format_speed(): pick unit (Kbps/Mbps/Gbps/Tbps), then 2 decimals < 10,
// 1 decimal < 100, integer otherwise. Returns { num, unit } so the widget can render
// the value and unit separately (matching the metric-value/metric-unit convention).
function formatSpeed(speedMbps: number | string): { num: string; unit: string } {
  const speed = parseFloat(String(speedMbps))
  const fmt = (v: number) => (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v)))
  if (speed < 1) return { num: fmt(speed * 1000), unit: 'Kbps' }
  if (speed < 1000) return { num: fmt(speed), unit: 'Mbps' }
  if (speed < 1_000_000) return { num: fmt(speed / 1000), unit: 'Gbps' }
  return { num: fmt(speed / 1_000_000), unit: 'Tbps' }
}

// The latest-result payload differs by source: speedtest-tracker nests speeds under
// `data`, while our iperf collector serves them flat. Both are Mbps.
function pickSpeeds(res: any, source: string): { download: number; upload: number } {
  const src = source === 'iperf' ? res : res.data
  return { download: src.download, upload: src.upload }
}

export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('speedtest')

    const config = useRuntimeConfig(event)
    const speedtests = parseJsonConfig(config.speedtestsJson, [])
    const source = config.speedtestSource || 'speedtest-tracker'

    const result = []
    for (const st of speedtests) {
      const res: any = await $fetch(`http://${st.host}:${st.port}/api/speedtest/latest`)
      const { download, upload } = pickSpeeds(res, source)
      result.push({
        provider: st.provider,
        upload: formatSpeed(upload),
        download: formatSpeed(download),
      })
    }
    return result
  },
  { maxAge: 1800 },
)

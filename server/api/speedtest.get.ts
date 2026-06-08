// Ports dashboard-api/app/plugins/speedtest.py — reads latest results from one or
// more self-hosted speedtest trackers at host:port (NOT a live Ookla run).
// Cache TTL mirrors @cache(expire=1800).

// Ports format_speed(): pick unit (Kbps/Mbps/Gbps/Tbps), then 2 decimals < 10,
// 1 decimal < 100, integer otherwise.
function formatSpeed(speedMbps: number | string): string {
  const speed = parseFloat(String(speedMbps))
  const fmt = (v: number) => (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : String(Math.round(v)))
  if (speed < 1) return `${fmt(speed * 1000)} Kbps`
  if (speed < 1000) return `${fmt(speed)} Mbps`
  if (speed < 1_000_000) return `${fmt(speed / 1000)} Gbps`
  return `${fmt(speed / 1_000_000)} Tbps`
}

export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('speedtest')

    const config = useRuntimeConfig(event)
    const speedtests = parseJsonConfig(config.speedtestsJson, [])

    const result = []
    for (const st of speedtests) {
      const res: any = await $fetch(`http://${st.host}:${st.port}/api/speedtest/latest`)
      result.push({
        provider: st.provider,
        upload: formatSpeed(res.data.upload),
        download: formatSpeed(res.data.download),
      })
    }
    return result
  },
  { maxAge: 1800 },
)

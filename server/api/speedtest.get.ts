// Ports dashboard-api/app/plugins/speedtest.py — reads latest results from one or
// more self-hosted speedtest trackers at host:port (NOT a live Ookla run).
// Cache TTL mirrors @cache(expire=1800). Formatting and staleness live in
// lib/speedtest.js.
import { toSpeedtestEntry } from '~/lib/speedtest'

export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('speedtest')

    const config = useRuntimeConfig(event)
    const speedtests = parseJsonConfig(config.speedtestsJson, [])
    const source = config.speedtestSource || 'speedtest-tracker'

    // One unreachable source must not take the others down with it: it simply
    // comes back without values.
    return Promise.all(
      speedtests.map(async (st: any) => {
        const res = await $fetch(`http://${st.host}:${st.port}/api/speedtest/latest`, { timeout: 5000 }).catch(() => null)
        return toSpeedtestEntry(st, res, source)
      }),
    )
  },
  { maxAge: 1800 },
)

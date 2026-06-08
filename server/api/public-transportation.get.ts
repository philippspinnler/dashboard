import dayjs from '~/lib/datetime'

// Ports dashboard-api/app/plugins/publictransportation.py — next departure per
// connection via timetable.search.ch, skipping walk-only legs.
// Cache TTL mirrors @cache(expire=300).
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('public-transportation')

    const config = useRuntimeConfig(event)
    const query = getQuery(event)
    const connections = query.connections
      ? JSON.parse(query.connections as string)
      : parseJsonConfig(config.transportConnectionsJson, [])

    const result = []
    for (const connection of connections) {
      if (!Array.isArray(connection) || connection.length < 3) {
        throw createError({ statusCode: 400, statusMessage: 'Each connection must have three elements' })
      }
      const [from, to, type] = connection
      const name = `${from} -> ${to}`

      const data: any = await $fetch('https://timetable.search.ch/api/route.json', {
        query: { num: 2, from, to, ...(type === 'direct' ? { direct: 1 } : {}) },
      })

      let departure = null
      for (const c of data.connections || []) {
        if (c.legs && c.legs.some((leg: any) => (leg.type || '').toLowerCase() !== 'walk')) {
          departure = c.departure
          break
        }
      }

      if (!departure) {
        result.push({})
      } else {
        const d = dayjs(departure)
        result.push({
          connection: name,
          departure,
          departureHHMM: d.format('HH:mm'),
          departureFormatted: `${d.format('HH:mm')} Uhr`,
        })
      }
    }

    return { connections: result }
  },
  { maxAge: 300 },
)

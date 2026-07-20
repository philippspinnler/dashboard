import ical from 'node-ical'
import dayjs from '~/lib/datetime'
import { collectEvents } from '~/lib/ical-events'

// Ports dashboard-api/app/plugins/ical.py — pulls VEVENTs from each configured
// iCal URL over a 3-day window (incl. recurring expansion), tags birthdays, and
// groups by day. Cache TTL mirrors @cache(expire=900).

interface CalEvent {
  summary: string
  start_date: string
  start_time: string
  all_day: boolean
  name: string
  color: string
  special_event?: { type: string; name: string; years: number | null } | null
}

async function getEventsFromUrl(url: string, name: string, color: string, timezone: string): Promise<CalEvent[]> {
  const data = await ical.async.fromURL(url)

  const now = dayjs().tz(timezone)
  return collectEvents(data, {
    name,
    color,
    timezone,
    windowStart: now.startOf('day'),
    windowEnd: now.add(3, 'day').endOf('day'),
  })
}

// Parity with handle_special_events(): birthdays/anniversaries are detected by a
// trailing keyword, e.g. "Jana 1989 Geburtstag" or "Anna & Tom 2010 Hochzeitstag".
// The optional trailing year yields `years` (age / anniversary count).
function handleSpecialEvent(event: CalEvent): CalEvent {
  const summary = (event.summary || '').trim()

  let type: string
  let namePart: string
  if (summary.endsWith(' Geburtstag')) {
    type = 'birthday'
    namePart = summary.slice(0, -' Geburtstag'.length).trim()
  } else if (summary.endsWith(' Hochzeitstag')) {
    type = 'anniversary'
    namePart = summary.slice(0, -' Hochzeitstag'.length).trim()
  } else {
    event.special_event = null
    return event
  }

  const parts = namePart.split(/\s+/)
  let name: string
  let years: number | null = null

  if (parts.length === 1) {
    name = parts[0]
  } else {
    const yearPart = parts[parts.length - 1]
    if (/^\d+$/.test(yearPart)) {
      name = parts.slice(0, -1).join(' ')
      let year = parseInt(yearPart, 10)
      if (year < 100) year += 1900
      years = new Date().getFullYear() - year
    } else {
      // Trailing token isn't a year — treat the whole thing as the name.
      name = namePart
    }
  }

  event.special_event = { type, name, years }
  return event
}

function groupByDay(events: CalEvent[], timezone: string) {
  const today = dayjs().tz(timezone).startOf('day')
  const tomorrow = today.add(1, 'day')

  const groups = new Map<string, { day: string; date: string; events: CalEvent[] }>()
  for (const event of events) {
    const d = dayjs(event.start_date).tz(timezone)
    const key = d.format('YYYY-MM-DD')

    let dayLabel: string
    if (d.isSame(today, 'day')) dayLabel = 'Heute'
    else if (d.isSame(tomorrow, 'day')) dayLabel = 'Morgen'
    else dayLabel = d.format('dddd')

    if (!groups.has(key)) {
      groups.set(key, { day: dayLabel, date: d.format('DD. MMMM'), events: [] })
    }
    groups.get(key)!.events.push(event)
  }

  return Array.from(groups.values())
}

export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('calendar')

    const config = useRuntimeConfig(event)
    const timezone = config.timezone || 'UTC'
    const calendars = parseJsonConfig(config.calendarsJson, [])

    let all: CalEvent[] = []
    for (const cal of calendars) {
      const events = await getEventsFromUrl(cal.icalUrl, cal.name, cal.color, timezone)
      all = all.concat(events)
    }

    all = all.map(handleSpecialEvent)
    all.sort((a, b) => (a.start_date < b.start_date ? -1 : a.start_date > b.start_date ? 1 : 0))

    return groupByDay(all, timezone)
  },
  { maxAge: 900 },
)

// rrule ships CJS only — a named import breaks in plain Node ESM, so go
// through the default export (works both bundled and unbundled).
import rrulePkg from 'rrule'
import dayjs from './datetime.js'

const { RRule } = rrulePkg

// Expands the VEVENTs of a parsed node-ical feed into flat dashboard events
// within [windowStart, windowEnd] (dayjs instances), including recurring-event
// expansion. Framework-free so it can run outside the Nitro server.
export function collectEvents(data, { name, color, timezone, windowStart, windowEnd }) {
  const events = []
  for (const key of Object.keys(data)) {
    const ev = data[key]
    if (ev?.type !== 'VEVENT') continue

    const allDay = ev.datetype === 'date'
    const summary = typeof ev.summary === 'string' ? ev.summary : ev.summary?.val || ''

    const push = (when, summaryOverride) => {
      const d = dayjs(when).tz(timezone)
      events.push({
        summary: summaryOverride ?? summary,
        start_date: d.format(),
        start_time: d.format('HH:mm'),
        all_day: allDay,
        name,
        color,
      })
    }

    if (ev.rrule) {
      let rule = ev.rrule
      // Parity with ical.py: yearly recurrences that set BYMONTHDAY but not
      // BYMONTH recur every month — pin them to the DTSTART month so birthdays
      // and anniversaries land correctly.
      const o = rule.origOptions || {}
      const hasBymonthday = o.bymonthday != null && (!Array.isArray(o.bymonthday) || o.bymonthday.length > 0)
      const hasBymonth = o.bymonth != null && (!Array.isArray(o.bymonth) || o.bymonth.length > 0)
      if (o.freq === RRule.YEARLY && hasBymonthday && !hasBymonth) {
        const dtstart = rule.options.dtstart
        const month = dtstart ? dtstart.getUTCMonth() + 1 : dayjs(ev.start).tz(timezone).month() + 1
        rule = new RRule({ ...o, dtstart, bymonth: month })
      }
      // node-ical keeps EXDATEs (deleted occurrences) and RECURRENCE-ID
      // overrides (edited occurrences) outside the rrule object, keyed by the
      // original occurrence's UTC date — rrule.between() knows nothing of them.
      const exdates = ev.exdate || {}
      const overrides = ev.recurrences || {}
      // Note: known node-ical/rrule timezone caveat for DST-crossing recurrences;
      // acceptable here since these feed a wall-clock HH:mm display.
      for (const occ of rule.between(windowStart.toDate(), windowEnd.toDate(), true)) {
        const dateKey = occ.toISOString().substring(0, 10)
        if (exdates[dateKey]) continue
        if (overrides[dateKey]) continue // pushed below with its own start/summary
        push(occ)
      }
      for (const rec of Object.values(overrides)) {
        if (rec.status === 'CANCELLED') continue
        const recStart = dayjs(rec.start).tz(timezone)
        if ((recStart.isAfter(windowStart) || recStart.isSame(windowStart)) && recStart.isBefore(windowEnd)) {
          const recSummary = typeof rec.summary === 'string' ? rec.summary : rec.summary?.val
          push(rec.start, recSummary)
        }
      }
    } else {
      const start = dayjs(ev.start).tz(timezone)
      if ((start.isAfter(windowStart) || start.isSame(windowStart)) && start.isBefore(windowEnd)) {
        push(ev.start)
      }
    }
  }
  return events
}

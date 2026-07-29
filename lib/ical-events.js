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
      const rule = ev.rrule
      // Some iCloud birthday/anniversary feeds encode a yearly event as
      // FREQ=YEARLY;BYMONTHDAY=n with NO BYMONTH. rrule then expands it to the
      // n-th of EVERY month, so an October birthday shows up on Aug 1 etc.
      // Apple fills the month in from DTSTART; we pin occurrences to that month.
      //
      // node-ical bundles its own rrule build, which exposes parsed fields on
      // `options` in camelCase (byMonthDay / byMonth) with STRING frequencies
      // ("YEARLY"), not the numeric enum the top-level rrule import uses — read
      // both spellings so this holds across versions.
      const opt = rule.options || {}
      const byMonthDay = opt.byMonthDay || opt.bymonthday || []
      const byMonth = opt.byMonth || opt.bymonth || []
      const isYearly = opt.freq === RRule.YEARLY || String(opt.freq) === 'YEARLY'
      // 1-indexed month the birthday actually belongs to; DTSTART is stored at
      // UTC midnight of the intended date, so its UTC month is reliable.
      const pinMonth =
        isYearly && byMonthDay.length > 0 && byMonth.length === 0 && opt.dtstart
          ? opt.dtstart.getUTCMonth() + 1
          : null
      // node-ical keeps EXDATEs (deleted occurrences) and RECURRENCE-ID
      // overrides (edited occurrences) outside the rrule object, keyed by the
      // original occurrence's UTC date — rrule.between() knows nothing of them.
      const exdates = ev.exdate || {}
      const overrides = ev.recurrences || {}
      // Note: known node-ical/rrule timezone caveat for DST-crossing recurrences;
      // acceptable here since these feed a wall-clock HH:mm display.
      for (const occ of rule.between(windowStart.toDate(), windowEnd.toDate(), true)) {
        // Drop the phantom off-month occurrences; compare in the display
        // timezone so it matches the date the widget actually shows.
        if (pinMonth != null && dayjs(occ).tz(timezone).month() + 1 !== pinMonth) continue
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

import { describe, it, expect } from 'vitest'
import ical from 'node-ical'
import dayjs from '../lib/datetime.js'
import { collectEvents } from '../lib/ical-events.js'

// Some iCloud birthday/anniversary feeds encode a yearly event as
// FREQ=YEARLY;BYMONTHDAY=n with NO BYMONTH. rrule then expands it to the n-th of
// EVERY month. Apple fills the month in from DTSTART (so it shows only in the
// right month); the dashboard must do the same, or an October birthday shows up
// on Aug 1 etc.
function feed(rrule, { dtstart = '20211001', summary = 'Geburtstag Chiara' } = {}) {
  const ics = [
    'BEGIN:VCALENDAR',
    'BEGIN:VEVENT',
    'UID:test-1',
    `DTSTART;VALUE=DATE:${dtstart}`,
    `RRULE:${rrule}`,
    `SUMMARY:${summary}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\n')
  return ical.sync.parseICS(ics)
}

function collect(data, start, end) {
  return collectEvents(data, {
    name: 'Test',
    color: 'abcdef',
    timezone: 'Europe/Zurich',
    windowStart: dayjs(start).tz('Europe/Zurich').startOf('day'),
    windowEnd: dayjs(end).tz('Europe/Zurich').endOf('day'),
  })
}

describe('collectEvents recurring expansion', () => {
  it('does not emit a yearly BYMONTHDAY birthday outside its DTSTART month', () => {
    // Chiara's birthday is Oct 1; a window in early August must be empty.
    const events = collect(feed('FREQ=YEARLY;BYMONTHDAY=1'), '2026-07-29', '2026-08-12')
    expect(events).toEqual([])
  })

  it('still emits the birthday within its DTSTART month', () => {
    const events = collect(feed('FREQ=YEARLY;BYMONTHDAY=1'), '2026-09-25', '2026-10-09')
    expect(events.length).toBe(1)
    expect(events[0].summary).toBe('Geburtstag Chiara')
    expect(events[0].start_date.substring(0, 10)).toBe('2026-10-01')
  })

  it('leaves a yearly rule that already specifies BYMONTH untouched', () => {
    // With BYMONTH=10 the rule is unambiguous — August window still empty, and
    // it is NOT over-filtered in October.
    const aug = collect(feed('FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=1'), '2026-07-29', '2026-08-12')
    expect(aug).toEqual([])
    const oct = collect(feed('FREQ=YEARLY;BYMONTH=10;BYMONTHDAY=1'), '2026-09-25', '2026-10-09')
    expect(oct.length).toBe(1)
  })

  it('does not over-filter a genuinely monthly recurrence', () => {
    // A real "1st of every month" event must keep expanding every month.
    const events = collect(feed('FREQ=MONTHLY;BYMONTHDAY=1', { summary: 'Miete' }), '2026-07-29', '2026-08-12')
    expect(events.length).toBe(1)
    expect(events[0].start_date.substring(0, 10)).toBe('2026-08-01')
  })
})

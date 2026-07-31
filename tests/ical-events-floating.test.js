// Floating iCal times (DTSTART with no TZID and no trailing Z) must render as
// the same wall clock in the configured display timezone no matter which zone
// the server process runs in. node-ical parses floating times with the host
// zone, so in the production container (TZ=UTC) they used to shift by the
// UTC-offset of the display timezone (+2h in CEST). Pin the process to UTC to
// reproduce that environment deterministically.
process.env.TZ = 'UTC'

import { describe, it, expect } from 'vitest'
import ical from 'node-ical'
import dayjs from '../lib/datetime.js'
import { collectEvents } from '../lib/ical-events.js'

function parse(lines) {
  return ical.sync.parseICS(['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'UID:test-1', ...lines, 'END:VEVENT', 'END:VCALENDAR'].join('\n'))
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

describe('collectEvents timezone handling (server running in UTC)', () => {
  it('keeps the wall clock of a floating DTSTART', () => {
    // Booking-portal feeds (e.g. hair salon) publish floating local times.
    const data = parse(['DTSTART:20260804T081500', 'DTEND:20260804T084500', 'SUMMARY:Coiffeur'])
    const events = collect(data, '2026-08-01', '2026-08-14')
    expect(events.length).toBe(1)
    expect(events[0].start_time).toBe('08:15')
    expect(events[0].start_date).toBe('2026-08-04T08:15:00+02:00')
  })

  it('converts a TZID DTSTART into the display timezone', () => {
    const data = parse(['DTSTART;TZID=America/New_York:20260804T120000', 'SUMMARY:Call'])
    const events = collect(data, '2026-08-01', '2026-08-14')
    expect(events.length).toBe(1)
    expect(events[0].start_time).toBe('18:00')
  })

  it('converts a UTC (Z) DTSTART into the display timezone', () => {
    const data = parse(['DTSTART:20260804T061500Z', 'SUMMARY:Standup'])
    const events = collect(data, '2026-08-01', '2026-08-14')
    expect(events.length).toBe(1)
    expect(events[0].start_time).toBe('08:15')
  })

  it('keeps the wall clock of floating recurring occurrences', () => {
    const data = parse(['DTSTART:20260701T121500', 'RRULE:FREQ=WEEKLY;BYDAY=WE', 'SUMMARY:CrossFit'])
    const events = collect(data, '2026-08-01', '2026-08-14')
    expect(events.length).toBe(2)
    for (const e of events) expect(e.start_time).toBe('12:15')
  })
})

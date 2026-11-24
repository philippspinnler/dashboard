import { describe, it, expect } from 'vitest'
import { toSpeedtestEntry } from '../lib/speedtest.js'

const st = { provider: 'B', max_age_hours: 13 }
const now = Date.parse('2026-11-24T12:00:00Z')
const fresh = { download: 95.2, upload: 18.1, timestamp: '2026-11-24T08:00:00Z' }

describe('toSpeedtestEntry', () => {
  it('formats a fresh iperf result', () => {
    expect(toSpeedtestEntry(st, fresh, 'iperf', now)).toEqual({
      provider: 'B',
      download: { num: '95.2', unit: 'Mbps' },
      upload: { num: '18.1', unit: 'Mbps' },
    })
  })

  it('drops a result older than max_age_hours', () => {
    const stale = { ...fresh, timestamp: '2026-11-23T20:00:00Z' }
    expect(toSpeedtestEntry(st, stale, 'iperf', now)).toEqual({ provider: 'B', download: null, upload: null })
  })

  it('drops an unreachable source', () => {
    expect(toSpeedtestEntry(st, null, 'iperf', now)).toEqual({ provider: 'B', download: null, upload: null })
  })

  it('drops a payload without speeds', () => {
    expect(toSpeedtestEntry(st, {}, 'iperf', now).download).toBeNull()
    expect(toSpeedtestEntry(st, {}, 'speedtest-tracker', now).download).toBeNull()
  })

  it('treats a missing timestamp as fresh', () => {
    expect(toSpeedtestEntry(st, { download: 95.2, upload: 18.1 }, 'iperf', now).download).not.toBeNull()
  })

  it('ignores age without max_age_hours', () => {
    const old = { ...fresh, timestamp: '2020-01-01T00:00:00Z' }
    expect(toSpeedtestEntry({ provider: 'A' }, old, 'iperf', now).download).not.toBeNull()
  })

  it('reads speedtest-tracker payloads', () => {
    const res = { data: { download: 940, upload: 12 } }
    expect(toSpeedtestEntry({ provider: 'A' }, res, 'speedtest-tracker', now).download).toEqual({ num: '940', unit: 'Mbps' })
  })
})

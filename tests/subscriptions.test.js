import { describe, it, expect } from 'vitest'
import { sumNetChange } from '../lib/subscriptions.js'

describe('sumNetChange', () => {
  it('sums activations minus cancellations across the given products', () => {
    const subs = {
      a: { activations: 5, cancellations: 2, mrr: 10, gross_revenue: 100 },
      b: { activations: 1, cancellations: 3, mrr: 4, gross_revenue: 40 },
    }
    expect(sumNetChange(subs, ['a', 'b'])).toBe(1)
  })

  it('can be negative', () => {
    const subs = { a: { activations: 0, cancellations: 4, mrr: 10, gross_revenue: 100 } }
    expect(sumNetChange(subs, ['a'])).toBe(-4)
  })

  it('skips phantom rows (active subs but zero lifetime revenue)', () => {
    const subs = {
      real: { activations: 2, cancellations: 0, mrr: 10, gross_revenue: 100 },
      phantom: { activations: 9, cancellations: 0, active_subscriptions: 9, mrr: 0, gross_revenue: 0 },
    }
    expect(sumNetChange(subs, ['real', 'phantom'])).toBe(2)
  })

  it('ignores unknown ids and missing fields', () => {
    const subs = { a: { mrr: 10, gross_revenue: 100 } }
    expect(sumNetChange(subs, ['a', 'nope'])).toBe(0)
    expect(sumNetChange(undefined, ['a'])).toBe(0)
  })
})

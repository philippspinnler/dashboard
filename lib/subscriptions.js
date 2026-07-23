// Pure aggregation for the EO-Guide widget: classify appfigures products into
// yearly/monthly plans by name and sum their active paying subscriptions.

export function classifyProducts(products) {
  const yearlyIds = []
  const monthlyIds = []
  for (const [pid, p] of Object.entries(products || {})) {
    const name = p?.name || ''
    if (/yearly/i.test(name)) yearlyIds.push(pid)
    else if (/monthly/i.test(name)) monthlyIds.push(pid)
  }
  return { yearlyIds, monthlyIds }
}

// Google Play backfills can import activations without matching expirations,
// leaving offer-products that claim active paying subscribers despite having
// never produced any revenue (both mrr and gross_revenue at 0). Such rows are
// phantoms — a real paying subscriber always leaves revenue behind.
function isPhantom(row) {
  return (
    Number(row.active_subscriptions || 0) > 0 &&
    Number(row.mrr || 0) === 0 &&
    Number(row.gross_revenue || 0) === 0
  )
}

export function sumActiveSubscriptions(subs, ids) {
  let total = 0
  for (const id of ids) {
    const row = subs?.[id]
    if (!row || isPhantom(row)) continue
    total += Number(row.active_subscriptions || 0)
  }
  return total
}

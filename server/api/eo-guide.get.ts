// EO-Guide stats for the widget: active subscriptions (yearly / monthly) + the
// overall App Store rating. Cache TTL mirrors @cache(expire=21_600).
//
// Subscription products are discovered from the account and classified by name
// ("... Yearly ..." / "... Monthly ..."), so adding/renaming a plan needs no
// config change. active_subscriptions per product is summed per class.
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('eo-guide')

    const config = useRuntimeConfig(event)
    const clientKey = config.eoguideClientKey
    const auth =
      'Basic ' + Buffer.from(`${config.eoguideUsername}:${config.eoguidePassword}`).toString('base64')
    const headers = { Authorization: auth }

    const [products, ratings] = await Promise.all([
      $fetch<any>('https://api.appfigures.com/v2/products/mine/', {
        query: { client_key: clientKey },
        headers,
      }),
      $fetch<any>('https://api.appfigures.com/v2/reports/ratings/', {
        query: { client_key: clientKey },
        headers,
      }),
    ])

    const yearlyIds: string[] = []
    const monthlyIds: string[] = []
    for (const [pid, p] of Object.entries<any>(products || {})) {
      const name = p?.name || ''
      if (/yearly/i.test(name)) yearlyIds.push(pid)
      else if (/monthly/i.test(name)) monthlyIds.push(pid)
    }

    let yearly = 0
    let monthly = 0
    const allIds = [...yearlyIds, ...monthlyIds]
    if (allIds.length) {
      const subs = await $fetch<any>('https://api.appfigures.com/v2/reports/subscriptions/', {
        query: { client_key: clientKey, group_by: 'product', products: allIds.join(',') },
        headers,
      })
      const active = (id: string) => Number(subs?.[id]?.active_subscriptions || 0)
      yearly = yearlyIds.reduce((s, id) => s + active(id), 0)
      monthly = monthlyIds.reduce((s, id) => s + active(id), 0)
    }

    return {
      subscriptions: { yearly, monthly },
      overall_rating: parseFloat(ratings.average),
    }
  },
  { maxAge: 21_600 },
)

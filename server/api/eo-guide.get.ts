import { classifyProducts, sumActiveSubscriptions, sumNetChange } from '~/lib/subscriptions'
import dayjs from '~/lib/datetime'

// EO-Guide stats for the widget: active subscriptions (yearly / monthly), the
// net subscriber change over the last 7 days, and the overall App Store
// rating. Cache TTL mirrors @cache(expire=21_600).
//
// Subscription products are discovered from the account and classified by name
// ("... Yearly ..." / "... Monthly ..."), so adding/renaming a plan needs no
// config change. active_subscriptions per product is summed per class; rows
// with subscribers but zero lifetime revenue are dropped as phantom data (see
// lib/subscriptions.js).
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

    const { yearlyIds, monthlyIds } = classifyProducts(products)

    let yearly = 0
    let monthly = 0
    const weeklyChange = { yearly: 0, monthly: 0 }
    const allIds = [...yearlyIds, ...monthlyIds]
    if (allIds.length) {
      const end = dayjs().tz(config.timezone || 'UTC')
      const [subs, weekSubs] = await Promise.all([
        $fetch<any>('https://api.appfigures.com/v2/reports/subscriptions/', {
          query: { client_key: clientKey, group_by: 'product', products: allIds.join(',') },
          headers,
        }),
        $fetch<any>('https://api.appfigures.com/v2/reports/subscriptions/', {
          query: {
            client_key: clientKey,
            group_by: 'product',
            products: allIds.join(','),
            start_date: end.subtract(7, 'day').format('YYYY-MM-DD'),
            end_date: end.format('YYYY-MM-DD'),
          },
          headers,
        }),
      ])
      yearly = sumActiveSubscriptions(subs, yearlyIds)
      monthly = sumActiveSubscriptions(subs, monthlyIds)
      weeklyChange.yearly = sumNetChange(weekSubs, yearlyIds)
      weeklyChange.monthly = sumNetChange(weekSubs, monthlyIds)
    }

    return {
      subscriptions: { yearly, monthly, weeklyChange },
      overall_rating: parseFloat(ratings.average),
    }
  },
  { maxAge: 21_600 },
)

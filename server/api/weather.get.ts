// Ports dashboard-api/app/plugins/weather.py — OpenWeatherMap One Call 3.0.
// Cache TTL mirrors @cache(expire=3600).
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('weather')

    const config = useRuntimeConfig(event)
    const query = getQuery(event)
    const lat = Number(query.lat ?? config.weatherDefaultLat)
    const lon = Number(query.lon ?? config.weatherDefaultLon)

    const data: any = await $fetch('https://api.openweathermap.org/data/3.0/onecall', {
      query: {
        lat,
        lon,
        exclude: 'minutely,hourly,alerts',
        appid: config.weatherApiKey,
        units: 'metric',
        lang: 'de',
      },
    })

    const current = {
      temperature: data.current.temp,
      temperatureFeelsLike: data.current.feels_like,
      weather: data.current.weather.map((w: any) => ({
        id: w.id,
        icon: w.icon,
        description: w.description,
      })),
    }

    const daily = data.daily.map((day: any) => ({
      date: new Date(day.dt * 1000).toISOString(),
      temperature: { min: day.temp.min, max: day.temp.max },
      weather: day.weather.map((w: any) => ({
        id: w.id,
        icon: w.icon,
        description: w.description,
      })),
    }))

    return { current, daily }
  },
  { maxAge: 3600 },
)

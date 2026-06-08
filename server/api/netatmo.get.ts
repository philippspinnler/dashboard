// Indoor/outdoor temps + CO2 from Home Assistant entity states. (develop's
// committed netatmo.py uses the Netatmo cloud API, but the config + the intended
// setup is HA entities — this matches that.) Cache TTL mirrors @cache(expire=300).
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('netatmo')

    const config = useRuntimeConfig(event)
    return {
      indoor_temperature: await haState(event, config.netatmoIndoorTemperatureEntity),
      indoor_co2: await haState(event, config.netatmoIndoorCo2Entity),
      outdoor_temperature: await haState(event, config.netatmoOutdoorTemperatureEntity),
    }
  },
  { maxAge: 300 },
)

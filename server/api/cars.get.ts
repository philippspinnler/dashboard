// Ports dashboard-api/app/plugins/cars.py — per-car status from Home Assistant
// entities. Cache TTL mirrors @cache(expire=120). Config: NUXT_CARS_JSON, an
// array of { name, range_entity, state_of_charge_entity, charging_active_entity,
// charging_power_entity, end_of_charge_entity }. Empty when unconfigured.
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('cars')

    const config = useRuntimeConfig(event)
    const carsConfig = parseJsonConfig(config.carsJson, [])

    const cars = []
    for (const c of carsConfig) {
      cars.push({
        name: c.name || 'Unknown Car',
        range: await haRawState(event, c.range_entity),
        charge_procentage: await haRawState(event, c.state_of_charge_entity),
        charging: (await haRawState(event, c.charging_active_entity)) === 'on',
        charging_power: await haRawState(event, c.charging_power_entity),
        end_of_charge: await haRawState(event, c.end_of_charge_entity),
      })
    }
    return cars
  },
  { maxAge: 120 },
)

// Stiebel Eltron ISG heat-pump status from Home Assistant. Reports whether the
// floor is being heated, cooled, or is idle, plus the outdoor temp and the
// Vorlauf (water flowing to the floor) temperature.
// Cache TTL 30s — heating state changes slowly. Mirrors inverter.get.ts.
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('heizung')

    const config = useRuntimeConfig(event)
    const e = {
      is_heating: config.heizungIsHeatingEntity,
      is_cooling: config.heizungIsCoolingEntity,
      outdoor: config.heizungOutdoorEntity,
      flow: config.heizungFlowTemperatureEntity,
    }

    // HA binary_sensor → boolean (raw state is the string 'on' / 'off').
    const bool = async (entity: string) => (await haRawState(event, entity)) === 'on'
    // Numeric temp, or null when the entity is missing / unavailable.
    const temp = async (entity: string) => {
      const v = await haState(event, entity)
      return v == null ? null : Number(v)
    }

    return {
      is_heating: await bool(e.is_heating),
      is_cooling: await bool(e.is_cooling),
      outdoor: await temp(e.outdoor),
      flow_temperature: await temp(e.flow),
    }
  },
  { maxAge: 30 },
)

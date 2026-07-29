// Stiebel Eltron ISG heat-pump status from Home Assistant. Reports whether the
// floor is being heated, cooled, or is idle, plus the outdoor temp and the
// Vorlauf (water flowing to the floor) temperature. Returns null when there's no
// heat pump at all (both state entities absent) so consumers can hide it.
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

    // Numeric temp, or null when the entity is missing / unavailable.
    const temp = async (entity: string) => {
      const v = await haState(event, entity)
      return v == null ? null : Number(v)
    }

    // Raw 'on' / 'off' / null. A missing entity is null, which lets us tell
    // "no heat pump" from "heat pump is off": when BOTH state entities are
    // absent there's no heat pump, so return null and let consumers (the e-ink
    // panel) hide the whole section.
    const heatingRaw = await haRawState(event, e.is_heating)
    const coolingRaw = await haRawState(event, e.is_cooling)
    if (heatingRaw == null && coolingRaw == null) return null

    return {
      is_heating: heatingRaw === 'on',
      is_cooling: coolingRaw === 'on',
      outdoor: await temp(e.outdoor),
      flow_temperature: await temp(e.flow),
    }
  },
  { maxAge: 30 },
)

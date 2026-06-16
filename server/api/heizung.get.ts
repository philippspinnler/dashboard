// Stiebel Eltron ISG heat-pump status from Home Assistant. Reports whether the
// floor is being heated, cooled, or is idle, plus room + outdoor temps.
// Cache TTL 30s — heating state changes slowly. Mirrors inverter.get.ts.
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('heizung')

    const config = useRuntimeConfig(event)
    const e = {
      is_heating: config.heizungIsHeatingEntity,
      is_cooling: config.heizungIsCoolingEntity,
      room_actual: config.heizungRoomActualEntity,
      room_target: config.heizungRoomTargetEntity,
      outdoor: config.heizungOutdoorEntity,
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
      room_actual: await temp(e.room_actual),
      room_target: await temp(e.room_target),
      outdoor: await temp(e.outdoor),
    }
  },
  { maxAge: 30 },
)

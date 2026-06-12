// Ports dashboard-api/app/plugins/inverter.py — solar/grid/battery flow from
// Home Assistant entities. Cache TTL mirrors @cache(expire=10).
//
// The widget expects power in WATTS and SOC in %. Power entities are scaled by
// NUXT_INVERTER_POWER_SCALE (set 1000 for kW sources like SigenStor). Returns
// zeros when entities aren't configured.
export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('inverter')

    const config = useRuntimeConfig(event)
    const scale = parseFloat(config.inverterPowerScale) || 1
    // some inverters report battery power with the opposite sign — flip it back
    // so the canonical "+ = charging" convention holds for the widget.
    // Nitro runs env values through destr(), so the flag arrives as a real
    // boolean (true) when set via env, but stays a string ('false') as a config
    // default — String() normalises both before comparing.
    const batterySign = String(config.inverterInvertBatteryPower) === 'true' ? -1 : 1

    const e = {
      pv_power: config.inverterPvPowerEntity,
      grid_consumption: config.inverterGridConsumptionEntity,
      grid_feedin: config.inverterGridFeedinEntity,
      power_consumption: config.inverterPowerConsumptionEntity,
      battery_state_of_charge: config.inverterBatteryStateOfChargeEntity,
      // signed: positive = charging, negative = discharging (powering the house)
      battery_power: config.inverterBatteryPowerEntity,
    }

    if (!e.pv_power && !e.battery_state_of_charge) {
      return {
        pv_power: 0,
        grid_consumption: 0,
        grid_feedin: 0,
        power_consumption: 0,
        battery_state_of_charge: 0,
        battery_power: 0,
      }
    }

    // signed power — keeps the +/- so direction is preserved
    const power = async (entity: string) => {
      const v = await haState(event, entity)
      return v == null ? 0 : Number(v) * scale
    }
    const percent = async (entity: string) => {
      const v = await haState(event, entity)
      return v == null ? 0 : Number(v)
    }

    return {
      pv_power: await power(e.pv_power),
      grid_consumption: await power(e.grid_consumption),
      grid_feedin: await power(e.grid_feedin),
      power_consumption: await power(e.power_consumption),
      battery_state_of_charge: await percent(e.battery_state_of_charge),
      battery_power: (await power(e.battery_power)) * batterySign,
    }
  },
  { maxAge: 10 },
)

// Low batteries across all Home Assistant `device_class: battery` entities,
// mirroring the user's `custom:battery-state-card` filter: include battery
// entities at/below batteryThreshold, exclude `binary_sensor.*` and
// unknown/unavailable states. Sorted lowest-first. Batteries move slowly, so a
// 5-minute cache TTL is plenty.

export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('batteries')

    const config = useRuntimeConfig(event)
    const threshold = Number(config.batteryThreshold) || 25

    const entities = await haStatesByDeviceClass(event, 'battery')

    const low = entities
      .filter((e: any) => !String(e.entity_id || '').startsWith('binary_sensor.'))
      .map((e: any) => ({
        entity_id: e.entity_id,
        name: e.attributes?.friendly_name || e.entity_id,
        level: Number(e.state),
      }))
      .filter((e: any) => !Number.isNaN(e.level) && e.level <= threshold)
      .sort((a: any, b: any) => a.level - b.level)

    return { low, threshold }
  },
  { maxAge: 300 },
)

// Sample warnings covering all three provider kinds and both severities:
// two low batteries, a vacuum dock error (watch), and a Grünbeck salt error
// (problem). Drives the overlay under NUXT_PUBLIC_USE_MOCK_DATA=true.
export default {
  threshold: 25,
  warnings: [
    {
      id: 'sensor.thermostat_bad_battery',
      kind: 'battery',
      name: 'Thermostat Bad',
      detail: '8%',
      level: 8,
      severity: 'warning',
    },
    {
      id: 'sensor.fenster_kueche_battery',
      kind: 'battery',
      name: 'Fenster Küche',
      detail: '19%',
      level: 19,
      severity: 'warning',
    },
    {
      id: 'sensor.vacuum_dock_error',
      kind: 'watch',
      name: 'Staubsauger Dock',
      detail: 'Bürste blockiert',
      severity: 'warning',
    },
    {
      id: 'binary_sensor.water_softener_has_error',
      kind: 'problem',
      name: 'Grünbeck',
      detail: 'Salzvorrat gering',
      severity: 'warning',
    },
  ],
}

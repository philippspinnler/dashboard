// Sample warnings covering all five provider kinds and both severities:
// two low batteries, a vacuum dock error (watch), a Grünbeck salt error
// (problem), a room over the humidity threshold (humidity), and a vacuum
// consumable due for cleaning (maintenance). Drives the overlay under
// NUXT_PUBLIC_USE_MOCK_DATA=true.
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
    {
      id: 'sensor.technikraum_luftsensor_humidity',
      kind: 'humidity',
      name: 'Technikraum',
      detail: '61%',
      level: 61,
      severity: 'warning',
    },
    {
      id: 'sensor.vacuum_strainer_time_left',
      kind: 'maintenance',
      name: 'Staubsauger Sieb',
      detail: 'Reinigen',
      severity: 'warning',
    },
  ],
}

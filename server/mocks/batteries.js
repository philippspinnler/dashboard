export default {
  threshold: 25,
  low: [
    { entity_id: 'sensor.thermostat_bad_battery', name: 'Thermostat Bad', level: 8 },
    { entity_id: 'sensor.fenster_kueche_battery', name: 'Fenster Küche', level: 19 },
    { entity_id: 'sensor.rauchmelder_og_battery', name: 'Rauchmelder OG', level: 23 },
  ],
}

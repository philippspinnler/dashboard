// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: true,
  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: 'Dashboard',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Roboto:wght@300&display=swap',
        },
      ],
    },
  },

  // All values below are overridable at runtime via NUXT_* / NUXT_PUBLIC_* env vars
  // (no rebuild required) — this replaces both config.yml and the config.js/envsubst hack.
  runtimeConfig: {
    // --- private (server-only) ---
    weatherApiKey: '',
    weatherDefaultLat: '', // OpenWeatherMap default location (set via env)
    weatherDefaultLon: '',

    // IANA timezone for calendar date math (e.g. 'America/New_York'); defaults to UTC
    timezone: 'UTC',

    homeAssistantUrl: '',
    homeAssistantToken: '',
    homeAssistantPersonEntities: '', // comma-separated

    // Doorbell (UniFi Protect G6 Entry via Home Assistant). The event entity is
    // the doorbell-press signal (event.<name>_doorbell or a binary_sensor); the
    // camera entity feeds the proxied live stream (e.g. camera.g6_entry_high).
    doorbellEventEntity: '',
    doorbellCameraEntity: '',

    netatmoIndoorTemperatureEntity: '',
    netatmoIndoorCo2Entity: '',
    netatmoOutdoorTemperatureEntity: '',

    sonosMediaPlayers: '', // comma-separated HA media_player entity ids

    // Warnings overlay (server-side config). The battery provider includes
    // device_class:battery entities at/below batteryThreshold. The problem
    // provider auto-surfaces every device_class:problem binary_sensor that is
    // `on` (e.g. the Grünbeck salt warning) except ids in warningsProblemExclude;
    // warningsLabelsJson maps such entity ids to a friendlier name. The watchlist
    // reports enum/state sensors (e.g. the vacuum dock error) whose state isn't
    // in okStates. See docs/superpowers/specs and the README overlay reference.
    batteryThreshold: '25',
    // The Roborock dock's "cleaning fluid" problem sensor sits `on` permanently
    // (on = fluid present, not a fault), so exclude it; the other dock problem
    // sensors (water boxes, water shortage) only fire on a real issue.
    warningsProblemExclude: 'binary_sensor.s8_maxv_ultra_dock_cleaning_fluid',
    warningsLabelsJson: JSON.stringify({
      'binary_sensor.softliq_se_bs12005970_has_error': 'Grünbeck',
      'binary_sensor.s8_maxv_ultra_dock_clean_water_box': 'Staubsauger Frischwasser',
      'binary_sensor.s8_maxv_ultra_dock_dirty_water_box': 'Staubsauger Schmutzwasser',
      'binary_sensor.s8_maxv_ultra_water_shortage': 'Staubsauger Wassermangel',
    }),
    warningsWatchlistJson: JSON.stringify([
      {
        entity_id: 'sensor.s8_maxv_ultra_dock_dock_error',
        label: 'Staubsauger Dock',
        okStates: ['none'],
        messages: { maintenance_brush_jammed: 'Bürste blockiert' },
      },
      {
        entity_id: 'sensor.s8_maxv_ultra_vacuum_error',
        label: 'Staubsauger',
        okStates: ['none'],
      },
    ]),

    calendarsJson: '[]', // JSON: [{ name, color, icalUrl }]
    transportConnectionsJson: '[]', // JSON: [[from, to, "direct"|"..."]]
    speedtestsJson: '[]', // JSON: [{ host, port, provider }]
    speedtestSource: 'speedtest-tracker', // 'speedtest-tracker' | 'iperf' — selects how /api/speedtest/latest is parsed

    // Cars (JSON): [{ name, range_entity, state_of_charge_entity,
    //   charging_active_entity, charging_power_entity, end_of_charge_entity }]
    carsJson: '[]',

    // Inverter (Home Assistant entity ids). Power entities are multiplied by
    // inverterPowerScale (set 1000 for kW sources like SigenStor) → widget wants watts.
    inverterGridConsumptionEntity: '',
    inverterGridFeedinEntity: '',
    inverterPowerConsumptionEntity: '',
    inverterPvPowerEntity: '',
    inverterBatteryStateOfChargeEntity: '',
    inverterBatteryPowerEntity: '', // signed: + charging / - discharging
    inverterInvertBatteryPower: 'false', // set 'true' if the entity reports - charging / + discharging
    inverterPowerScale: '1',

    // Heizung (Stiebel Eltron ISG heat pump via Home Assistant). Entity ids are
    // the defaults discovered on the install; override per-deployment via
    // NUXT_HEIZUNG_* env vars. State = cooling if is_cooling, else heating if
    // is_heating, else idle. Room target uses the comfort target (not the live
    // target, which drops to ~5° in summer mode).
    heizungIsHeatingEntity: 'binary_sensor.stiebel_eltron_isg_is_heating',
    heizungIsCoolingEntity: 'binary_sensor.stiebel_eltron_isg_is_cooling',
    heizungRoomActualEntity: 'sensor.stiebel_eltron_isg_actual_temperature_hk_1',
    heizungRoomTargetEntity: 'number.stiebel_eltron_isg_comfort_temperature_target_hk1',
    heizungOutdoorEntity: 'sensor.stiebel_eltron_isg_outdoor_temperature',

    // Album background: 'immich' (default) or 'icloud'
    albumProvider: 'immich',
    icloudAlbumId: '',

    immichUrl: '',
    immichApiKey: '',
    immichShareKey: '',
    immichAlbumName: '',
    immichC: '',

    eoguideClientKey: '',
    eoguideUsername: '',
    eoguidePassword: '',

    // --- public (exposed to client) ---
    public: {
      widgetsTopLeft: 'clock',
      widgetsTopRight: '',
      widgetsLeft: 'calendar',
      widgetsRight: 'heizung,presence,internet,netatmo,public-transportation,eo-guide',
      widgetsBottom: 'weather',
      enableGlassmorphism: 'false',
      useMockData: 'false',

      // Doorbell overlay: show the live G6 Entry feed top-right on a ring.
      doorbellEnabled: 'false',
      doorbellPollMs: '1500', // how often to poll /api/doorbell for a fresh press
      doorbellOverlaySeconds: '60', // how long the overlay stays up before auto-dismiss
      doorbellAlwaysShow: 'false', // dev/tuning: pin the overlay open (no ring needed)

      // Sonos overlay: a compact now-playing card shown in a corner only while a
      // speaker is playing (no fixed grid space). Doorbell always renders on top.
      sonosOverlayEnabled: 'true',
      sonosOverlayPosition: 'bottom-right', // top-left | top-right | bottom-left | bottom-right

      // Warnings overlay: aggregates low batteries, HA `device_class: problem`
      // sensors, and configured watchlist entities (see the private warnings*
      // config above). Shown in a corner while any warning is active.
      warningsOverlayEnabled: 'true',
      warningsOverlayPosition: 'bottom-left', // top-left | top-right | bottom-left | bottom-right
    },
  },
})

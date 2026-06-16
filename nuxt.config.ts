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

    calendarsJson: '[]', // JSON: [{ name, color, icalUrl }]
    transportConnectionsJson: '[]', // JSON: [[from, to, "direct"|"..."]]
    speedtestsJson: '[]', // JSON: [{ host, port, provider }]

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
    },
  },
})

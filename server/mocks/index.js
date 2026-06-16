// Server-side mock registry — keyed by endpoint name (no leading slash).
// Returned by routes when NUXT_PUBLIC_USE_MOCK_DATA=true, so both SSR and the
// client polling path get mocks (preserves the old offline dev experience).
import weather from './weather.js'
import calendar from './calendar.js'
import sonos from './sonos.js'
import presence from './presence.js'
import netatmo from './netatmo.js'
import publicTransportation from './publicTransportation.js'
import internet from './internet.js'
import eoGuide from './eoGuide.js'
import cars from './cars.js'
import album from './album.js'
import inverter from './inverter.js'
import doorbell from './doorbell.js'
import heizung from './heizung.js'

export const mocks = {
  weather,
  calendar,
  sonos,
  presence,
  netatmo,
  'public-transportation': publicTransportation,
  speedtest: internet,
  'eo-guide': eoGuide,
  cars,
  album,
  inverter,
  doorbell,
  heizung,
}

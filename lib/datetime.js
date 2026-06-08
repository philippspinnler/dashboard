// NOTE: explicit `.js` extensions are required — dayjs ships no "exports" map,
// so Node ESM (the Nitro server build) can't resolve the extensionless subpaths.
import dayjs from 'dayjs'
import calendar from 'dayjs/plugin/calendar.js'
import updateLocale from 'dayjs/plugin/updateLocale.js'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'
// Import the locale as a *binding* (not a bare side-effect import): dayjs sets
// "sideEffects": false, so a side-effect-only import gets tree-shaken out of the
// Nitro server build and dayjs.locale('de-ch') would silently fall back to 'en'.
import deCh from 'dayjs/locale/de-ch.js'

// Extend dayjs with plugins (utc/timezone added for server-side use)
dayjs.extend(calendar)
dayjs.extend(updateLocale)
dayjs.extend(relativeTime)
dayjs.extend(utc)
dayjs.extend(timezone)

// Register (referencing the binding keeps the import) and set as default locale
dayjs.locale(deCh, null, true)
dayjs.locale('de-ch')

// Update calendar locale
dayjs.updateLocale('de-ch', {
  calendar: {
    lastDay: '[Gestern]',
    sameDay: '[Heute]',
    nextDay: '[Morgen]',
    lastWeek: '[Letzter] dddd',
    nextWeek: 'dddd',
    sameElse: 'dddd',
  },
})

// Update relative time locale
dayjs.updateLocale('de-ch', {
  relativeTime: {
    future: 'in %s',
    past: 'vor %s',
    s: 'ein paar Sekunden',
    m: 'einer Minute',
    mm: '%d Minuten',
    h: 'einer Stunde',
    hh: '%d Stunden',
    d: 'einem Tag',
    dd: '%d Tage',
    M: 'einem Monat',
    MM: '%d Monate',
    y: 'einem Jahr',
    yy: '%d Jahre',
  },
})

export default dayjs

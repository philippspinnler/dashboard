import { SonosManager } from '@svrooij/sonos'

// Ports dashboard-api/app/plugins/sonos.py — current playing track across the
// configured speakers. Cache TTL mirrors @cache(expire=10).
//
// Replaces Python's `soco` with @svrooij/sonos. Requires SSDP discovery on the
// LAN where the dashboard runs; any failure degrades to "nothing playing".
// Verify on-device — this path can't be exercised without a real Sonos.

const NOT_PLAYING = { artist: null, song: null, playing: false, image: null, is_playing_tv: false }

export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('sonos')

    const config = useRuntimeConfig(event)
    const deviceNames = parseList(config.sonosDevices)
    if (deviceNames.length === 0) return NOT_PLAYING

    const manager = new SonosManager()
    try {
      await manager.InitializeWithDiscovery(5)

      // Prefer a speaker that is actively PLAYING; fall back to the first found.
      let device: any = null
      let transportState = 'STOPPED'
      for (const name of deviceNames) {
        const dev = manager.Devices.find((d: any) => d.Name === name)
        if (!dev) continue
        if (!device) device = dev
        const info = await dev.AVTransportService.GetTransportInfo({ InstanceID: 0 })
        if (info.CurrentTransportState === 'PLAYING') {
          device = dev
          transportState = 'PLAYING'
          break
        }
      }
      if (!device) return NOT_PLAYING

      const position = await device.AVTransportService.GetPositionInfo({ InstanceID: 0 })
      const media = await device.AVTransportService.GetMediaInfo({ InstanceID: 0 })
      const track: any = position.TrackMetaData && position.TrackMetaData !== 'NOT_IMPLEMENTED'
        ? position.TrackMetaData
        : {}
      const currentUri: string = position.TrackURI || media.CurrentURI || ''

      const playing = transportState === 'PLAYING'
      let artist: string | null
      let song: string | null
      let image: string | null = null
      let isPlayingTv = false

      const isTv = currentUri.startsWith('x-sonos-htastream:') || currentUri.startsWith('x-rincon-stream:')
      const isRadio =
        currentUri.startsWith('x-sonosapi-stream:') || currentUri.startsWith('x-rincon-mp3radio:')

      if (isRadio) {
        const stationMeta: any = media.CurrentURIMetaData && media.CurrentURIMetaData !== 'NOT_IMPLEMENTED'
          ? media.CurrentURIMetaData
          : {}
        artist = stationMeta.Title || track.StreamContent || null
        song = track.Title || null
        const sid = (currentUri.match(/s\d{5}/) || [])[0]
        image = sid ? `https://cdn-profiles.tunein.com/${sid}/images/logod.jpg` : null
      } else if (isTv) {
        isPlayingTv = true
        artist = 'Fernseher'
        song = 'HDMI eARC'
        image = '/tv.jpg'
      } else {
        artist = track.Artist || null
        song = track.Title || null
        const albumArt: string | undefined = track.AlbumArtUri
        if (albumArt) {
          const absolute = albumArt.startsWith('http')
            ? albumArt
            : `http://${device.Host}:${device.Port || 1400}${albumArt}`
          image = `/api/sonos/image-proxy?url=${encodeURIComponent(absolute)}`
        }
      }

      return { artist, song, playing, image, is_playing_tv: isPlayingTv }
    } catch {
      return NOT_PLAYING
    } finally {
      try {
        await manager.CancelSubscription()
      } catch {
        // ignore
      }
    }
  },
  { maxAge: 10 },
)

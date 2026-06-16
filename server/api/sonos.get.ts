// Current playing track across the configured Sonos speakers, read from Home
// Assistant `media_player.*` entities. Sonos now goes through HA like every
// other integration — this replaces the previous @svrooij/sonos SSDP discovery
// (a 5s LAN multicast scan on every request). Cache TTL mirrors @cache(expire=10).

const NOT_PLAYING = { artist: null, song: null, playing: false, image: null, is_playing_tv: false }

export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('sonos')

    const config = useRuntimeConfig(event)
    const entities = parseList(config.sonosMediaPlayers)
    if (entities.length === 0) return NOT_PLAYING

    // Single card: show the first speaker that is actively playing.
    let ent: any = null
    for (const entityId of entities) {
      const e: any = await haEntity(event, entityId)
      if (e?.state === 'playing') {
        ent = e
        break
      }
    }
    if (!ent) return NOT_PLAYING

    const attrs = ent.attributes || {}

    // TV / HDMI eARC: a Sonos soundbar (Arc/Beam) reports the TV input via the
    // `source` attribute and/or a tv-ish media_content_type. Verify the exact
    // values on-device — preserves the previous "Fernseher" treatment.
    const source = String(attrs.source || '')
    const contentType = String(attrs.media_content_type || '')
    const isTv =
      /\btv\b/i.test(source) ||
      /hdmi|earc|line[- ]?in/i.test(source) ||
      contentType === 'tvshow' ||
      contentType === 'tv'

    if (isTv) {
      return { artist: 'Fernseher', song: 'HDMI eARC', playing: true, image: '/tv.jpg', is_playing_tv: true }
    }

    // Music & radio: HA fills media_artist/media_title (for radio the station is
    // usually media_artist, the track media_title). Album art / station logo is
    // exposed as entity_picture — an HA-relative URL behind our origin, so we
    // route it through the image proxy (which attaches the HA bearer token).
    const artist = attrs.media_artist || attrs.media_album_artist || null
    const song = attrs.media_title || null

    let image: string | null = null
    const picture: string | undefined = attrs.entity_picture
    if (picture) {
      const absolute = picture.startsWith('http') ? picture : `${config.homeAssistantUrl}${picture}`
      image = `/api/sonos/image-proxy?url=${encodeURIComponent(absolute)}`
    }

    return { artist, song, playing: true, image, is_playing_tv: false }
  },
  { maxAge: 10 },
)

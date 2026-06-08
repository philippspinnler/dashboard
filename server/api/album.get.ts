// Ports the /album route on develop: returns { images: [...] } for the rotating
// background, from either Immich (default) or an iCloud shared album, selected by
// NUXT_ALBUM_PROVIDER. Cache TTL mirrors @cache(expire=21_600).

// ---- Immich (dashboard-api/app/plugins/immich.py) ----
async function immichImages(config: any): Promise<string[]> {
  const base = config.immichUrl
  const headers = { Accept: 'application/json', 'x-api-key': config.immichApiKey }

  const albums: any = await $fetch(`${base}/api/albums`, { headers })
  const album = albums.find((a: any) => a.albumName === config.immichAlbumName)
  if (!album) throw new Error(`Album '${config.immichAlbumName}' not found`)

  const detail: any = await $fetch(`${base}/api/albums/${album.id}`, { headers })
  const assets = detail.assets || []
  // c/share_key are already URL-encoded in config — embed as-is (don't re-encode).
  return assets.map(
    (asset: any) =>
      `${base}/api/assets/${asset.id}/thumbnail?size=fullsize&key=${config.immichShareKey}&c=${config.immichC}`,
  )
}

// ---- iCloud shared album (dashboard-api/app/plugins/icloud_album.py) ----
const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function base62ToInt(s: string): number {
  let t = 0
  for (const ch of s) t = t * 62 + BASE62.indexOf(ch)
  return t
}

function icloudBaseUrl(token: string): string {
  const t = token[0]
  const n = t === 'A' ? base62ToInt(token[1]) : base62ToInt(token.slice(1, 3))
  return `https://p${String(n).padStart(2, '0')}-sharedstreams.icloud.com/${token}/sharedstreams/`
}

async function icloudPost(url: string, body: unknown) {
  const res = await $fetch.raw(url, { method: 'POST', body, ignoreResponseError: true })
  return { status: res.status, data: res._data as any }
}

async function icloudImages(config: any): Promise<string[]> {
  const albumCode = config.icloudAlbumId
  if (!albumCode) return []

  let base = icloudBaseUrl(albumCode)
  let stream = await icloudPost(`${base}webstream`, { streamCtag: null })
  if (stream.status === 330) {
    const newHost = stream.data?.['X-Apple-MMe-Host']
    base = `https://${newHost}/${albumCode}/sharedstreams/`
    stream = await icloudPost(`${base}webstream`, { streamCtag: null })
  }
  const photos = (stream.data?.photos || []).map((p: any) => p.photoGuid)
  const assets = await icloudPost(`${base}webasseturls`, { photoGuids: photos })
  const items = assets.data?.items || {}
  return Object.keys(items).map((k) => `https://${items[k].url_location}${items[k].url_path}`)
}

export default defineDashboardCachedHandler(
  async (event) => {
    if (isMockEnabled(event)) return getMock('album')

    const config = useRuntimeConfig(event)
    const provider = config.albumProvider || 'immich'

    try {
      const images = provider === 'icloud' ? await icloudImages(config) : await immichImages(config)
      return { images }
    } catch {
      return { images: [] }
    }
  },
  { maxAge: 21_600 },
)

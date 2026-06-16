// Streams an image through our origin. Sonos album art / station logos are often
// plain http, and Home Assistant media art (entity_picture) lives behind the HA
// origin — requests to the configured HA base get the bearer token attached so
// the proxied fetch is authorized.
export default defineEventHandler(async (event) => {
  const url = getQuery(event).url as string

  if (!url || !/^https?:\/\//.test(url)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid URL scheme. Only 'http' and 'https' are supported.",
    })
  }

  const config = useRuntimeConfig(event)
  const headers: Record<string, string> = {}
  if (config.homeAssistantUrl && config.homeAssistantToken && url.startsWith(config.homeAssistantUrl)) {
    headers.Authorization = `Bearer ${config.homeAssistantToken}`
  }

  let res
  try {
    res = await $fetch.raw(url, { responseType: 'arrayBuffer', headers })
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Failed to fetch the URL.' })
  }

  setHeader(event, 'content-type', res.headers.get('content-type') || 'image/jpeg')
  return Buffer.from(res._data as ArrayBuffer)
})

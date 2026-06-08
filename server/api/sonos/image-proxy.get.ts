// Ports the proxy() helper in dashboard-api/app/plugins/sonos.py — streams an
// image through our origin (album art / station logos are often plain http).
export default defineEventHandler(async (event) => {
  const url = getQuery(event).url as string

  if (!url || !/^https?:\/\//.test(url)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid URL scheme. Only 'http' and 'https' are supported.",
    })
  }

  let res
  try {
    res = await $fetch.raw(url, { responseType: 'arrayBuffer' })
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Failed to fetch the URL.' })
  }

  setHeader(event, 'content-type', res.headers.get('content-type') || 'image/jpeg')
  return Buffer.from(res._data as ArrayBuffer)
})
